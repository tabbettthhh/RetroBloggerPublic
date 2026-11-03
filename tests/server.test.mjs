// The server on its own: fresh data straight after publishing, the export zip, photo
// cleaning and the visitor-facing endpoints.
import { api, test, report, assert, eq, putFile, getFile, upload, publicData, overview, PHOTOS, BASE, chromium } from './lib.mjs';
import { unzipSync, strFromU8 } from 'fflate';

await test('a post shows up straight away in a tab that already had the site open', async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const p1 = await ctx.newPage();
  await p1.goto(BASE + '/');
  await p1.waitForTimeout(1200);
  const n1 = await p1.evaluate(async () => (await (await fetch('/api/all')).json()).posts.length);
  await putFile(`thoughts/2026-10-23-fresh-${Date.now()}.md`, '---\ndate: 2026-10-23 10:00\n---\nA brand new post\n');
  const n2 = await p1.evaluate(async () => (await (await fetch('/api/all')).json()).posts.length);
  await b.close();
  eq(n2, n1 + 1, 'posts seen');
});

await test('unchanged data is answered with a tiny "nothing new"', async () => {
  const r1 = await fetch(`${BASE}/api/all`);
  const etag = r1.headers.get('etag');
  assert(etag, 'no ETag');
  assert(/no-cache/.test(r1.headers.get('cache-control')), 'cache-control: ' + r1.headers.get('cache-control'));
  const r2 = await fetch(`${BASE}/api/all`, { headers: { 'If-None-Match': etag } });
  eq(r2.status, 304, 'status');
});

await test('empty captions stay empty instead of saying "null"', async () => {
  await api('batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: [{ key: 'photos/2026-10-20-nullcap.md', text: '---\ndate: 2026-10-20 10:00\nphotos: [a.jpg, b.jpg]\ncaptions: [~, "two"]\n---\nNull caption\n' }] }) });
  const d = await (await fetch(`${BASE}/api/all`)).json();
  eq(d.posts.find((p) => p.slug === '2026-10-20-nullcap').captions, ['', 'two'], 'captions');
});

await test('every kind of header file is checked before saving', async () => {
  for (const key of ['site.md', 'travel.md', 'books/2026-01-01-x.md']) {
    const r = await fetch(`${BASE}/admin/api/file?key=${encodeURIComponent(key)}`, { method: 'PUT', body: '---\nname: a: b\n---\n' });
    eq(r.status, 422, key);
  }
  // A wishlist with no header at all is fine.
  const r = await fetch(`${BASE}/admin/api/file?key=wishlist.md`, { method: 'PUT', body: '# Want\n- [ ] A: place with a colon\n' });
  eq(r.status, 200, 'wishlist');
});

await test('the export zip holds every file, byte for byte', async () => {
  for (let i = 0; i < 40; i++) await upload(`photos/2026-10-21-many/${i}.jpg`, PHOTOS[i % 4]);
  await putFile('photos/2026-10-21-many.md', '---\ndate: 2026-10-21 10:00\nphotos: [' + Array.from({ length: 40 }, (_, i) => `"${i}.jpg"`).join(', ') + ']\n---\nMany photos\n');
  const ov = await api('overview');
  const keys = ov.files.map((f) => f.key).sort();
  const r = await fetch(`${BASE}/admin/api/export`);
  eq(r.status, 200, 'status');
  // Unzipping checks every file's checksum as well.
  const zip = unzipSync(new Uint8Array(await r.arrayBuffer()));
  const names = Object.keys(zip).sort();
  eq(names.length, keys.length, 'number of files');
  eq(names, keys, 'file names');
  eq(strFromU8(zip['photos/2026-10-21-many.md']), await getFile('photos/2026-10-21-many.md'), 'a post inside the zip');
  const served = new Uint8Array(await (await fetch(`${BASE}/media/photos/2026-10-21-many/3.jpg`)).arrayBuffer());
  eq(Buffer.compare(Buffer.from(zip['photos/2026-10-21-many/3.jpg']), Buffer.from(served)), 0, 'a photo inside the zip');
});

await test('the posts-only export has no photos and is small', async () => {
  const r = await fetch(`${BASE}/admin/api/export?photos=0`);
  const buf = Buffer.from(await r.arrayBuffer());
  const names = Object.keys(unzipSync(new Uint8Array(buf)));
  assert(names.length > 0 && names.every((n) => /\.(md|json|txt)$/.test(n)), 'unexpected files: ' + names.filter((n) => !/\.(md|json|txt)$/.test(n)).slice(0, 5));
  assert(buf.length < 200_000, 'size ' + buf.length);
});

await test('photos are cleaned on upload and on the way out', async () => {
  const r = await fetch(`${BASE}/media/photos/2026-10-21-many/0.jpg`);
  const b = Buffer.from(await r.arrayBuffer()).toString('latin1');
  assert(!/Exif|TestCam/.test(b), 'hidden data left');
  const bad = await fetch(`${BASE}/admin/api/upload?key=photos/x/evil.jpg`, { method: 'PUT', body: 'not a picture' });
  eq(bad.status, 415, 'non-picture upload');
  const trav = await fetch(`${BASE}/media/photos/..%2f..%2fsite.md`);
  assert(trav.status === 404 || trav.status === 400, 'path trick: ' + trav.status);
});

await test('visitors: bots are turned away, real people can sign and nudge', async () => {
  const bot = await fetch(`${BASE}/api/guestbook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'curl/8' }, body: JSON.stringify({ message: 'spam' }) });
  eq(bot.status, 400, 'bot');
  const hp = await fetch(`${BASE}/api/guestbook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, body: JSON.stringify({ message: 'hello', website: 'http://spam' }) });
  eq((await hp.json()).pending, true, 'honeypot answered politely');
  const empty = await fetch(`${BASE}/api/guestbook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, body: JSON.stringify({ message: ' ' }) });
  eq(empty.status, 400, 'empty message');
  const n = await fetch(`${BASE}/api/nudge`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, body: '{}' });
  eq((await n.json()).ok, true, 'nudge');
  const junk = await fetch(`${BASE}/api/guestbook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, body: '{not json' });
  eq(junk.status, 400, 'broken request');
});

await test('admin file names that could escape the bucket are refused', async () => {
  for (const key of ['../x.md', 'a//b.md', 'data/_parsed.json', '/abs.md', '.hidden.md']) {
    const r = await fetch(`${BASE}/admin/api/file?key=${encodeURIComponent(key)}`, { method: 'PUT', body: 'x' });
    eq(r.status, 400, key);
  }
});

await test('old addresses send visitors to your main address (but never the back office)', async () => {
  const { mainAddress } = await import('../src/worker.js');
  const envWith = (me) => ({ CONTENT: { get: async (k) => (k === 'data/_friends.json' && me !== null ? { text: async () => JSON.stringify({ me }) } : null) } });
  const go = async (env, address, method = 'GET') => {
    const res = await mainAddress(new Request(address, { method }), env, new URL(address));
    return res ? `${res.status} ${res.headers.get('Location')}` : 'stays';
  };
  const moved = envWith('https://omar.example');
  eq(await go(moved, 'https://my-corner.someone.workers.dev/#/x'), '301 https://omar.example/', 'workers.dev → your domain');
  eq(await go(moved, 'https://my-corner.someone.workers.dev/places?a=1'), '301 https://omar.example/places?a=1', 'keeping the page');
  eq(await go(moved, 'https://www.omar.example/'), '301 https://omar.example/', 'www → without');
  eq(await go(moved, 'https://omar.example/'), 'stays', 'already there');
  eq(await go(moved, 'https://other.example/'), 'stays', 'some other address');
  eq(await go(moved, 'https://my-corner.someone.workers.dev/admin/'), 'stays', 'the back office stays put');
  eq(await go(moved, 'https://my-corner.someone.workers.dev/api/friends/feed'), 'stays', 'friends still reach you');
  eq(await go(moved, 'https://my-corner.someone.workers.dev/api/guestbook', 'POST'), 'stays', 'only page visits');
  eq(await go(envWith('https://www.omar.example'), 'https://omar.example/'), '301 https://www.omar.example/', 'without → www, if that’s yours');
  eq(await go(envWith('https://my-corner.someone.workers.dev'), 'https://my-corner.someone.workers.dev/'), 'stays', 'not moved');
  eq(await go(envWith(null), 'https://my-corner.someone.workers.dev/'), 'stays', 'no address set');
  eq(await go(envWith('http://localhost:8800'), 'https://my-corner.someone.workers.dev/'), 'stays', 'never to a local address');
});

await test('the site’s own scripts and styles: under this update’s id, kept by browsers until the next one', async () => {
  const html = await (await fetch(BASE + '/')).text();
  const id = /\/v\/([\w-]+)\/js\/app\.js/.exec(html)?.[1];
  assert(id, 'the page asks for them under an id');
  assert(!/(href|src)="\/(js|css)\//.test(html), 'every one of them');
  const a = await fetch(`${BASE}/v/${id}/js/app.js`);
  eq(a.status, 200, 'there');
  eq(await a.text(), await (await fetch(`${BASE}/js/app.js`)).text(), 'the same file');
  for (const bad of [`/v/${id}/admin/owner.js`, `/v/${id}/js/nothing.js`, '/v/x/js/app.js', `/v/${id}/js/..%2Fadmin/owner.js`, `/v/${id}/js/.%2E/admin/owner.js`]) eq((await fetch(BASE + bad)).status, 404, bad);
  // Your owner tools keep their own address (behind the lock), pointing at the same copies as the site.
  const owner = await (await fetch(`${BASE}/admin/owner.js?v=${id}`)).text();
  assert(owner.includes(`from '/v/${id}/js/util.js'`) && owner.includes(`'/admin/admin.js?v=${id}'`) && owner.includes(`'/admin/owner.css?v=${id}'`), 'the same copies');
  // On the internet they're kept for good (here on your own computer, checked each time).
  const { default: worker } = await import('../src/worker.js');
  const env = {
    CF_VERSION_METADATA: { id: 'abcdef12-3456' },
    CONTENT: { get: async () => null, list: async () => ({ objects: [] }) },
    ASSETS: { fetch: async (r) => (new URL(r.url).pathname === '/' ? new Response('<link rel="stylesheet" href="/css/base.css"><script type="module" src="/js/app.js"></script>', { headers: { 'Content-Type': 'text/html', ETag: '"page"' } }) : new Response('x', { headers: { 'Content-Type': 'text/javascript' } })) }
  };
  const get = (path, e = env) => worker.fetch(new Request('https://corner.example' + path, { headers: { 'If-None-Match': '"page"' } }), e, { waitUntil() {} });
  eq((await get('/v/abcdef12-3456/js/app.js')).headers.get('cache-control'), 'public, max-age=31536000, immutable', 'this update’s: for good');
  eq((await get('/v/older-update/js/app.js')).headers.get('cache-control'), 'public, no-cache', 'an older id: the new file, checked next time');
  const page = await get('/');
  eq([page.status, page.headers.get('cache-control'), page.headers.get('etag')], [200, 'no-cache', null], 'the page itself: always fresh');
  eq(await page.text(), '<link rel="stylesheet" href="/v/abcdef12-3456/css/base.css"><script type="module" src="/v/abcdef12-3456/js/app.js"></script>', 'pointing at this update’s');
  const before = await get('/', { ...env, CF_VERSION_METADATA: undefined });
  assert((await before.text()).includes('src="/js/app.js"'), 'without an id (settings from before this): as before');
});

await test('the page asks for every script the first screen needs at once (not one revealing the next)', async () => {
  const fs = await import('node:fs');
  const dir = new URL('../public/js/', import.meta.url);
  const imports = (f) => [...fs.readFileSync(new URL(f, dir), 'utf8').matchAll(/^import\s[^;]*?from\s*'\.\/([\w-]+\.js)'/gm)].map((m) => m[1]);
  const needed = new Set();
  const walk = (f) => !needed.has(f) && (needed.add(f), imports(f).forEach(walk));
  ['app.js', 'phone.js', 'desktop.js'].forEach(walk);
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const preloaded = new Set([...html.matchAll(/rel="modulepreload" href="\/js\/([\w-]+\.js)"/g)].map((m) => m[1]));
  eq([...needed].filter((f) => !preloaded.has(f)), [], 'every one of them');
});

await test('a photo the browser already has isn’t sent again', async () => {
  await upload('photos/2026-10-22-again/1.jpg', PHOTOS[0]);
  await putFile('photos/2026-10-22-again.md', '---\ndate: 2026-10-22 10:00\nphotos: [1.jpg]\n---\nOnce\n');
  const url = `${BASE}/media/photos/2026-10-22-again/1.jpg`;
  const r1 = await fetch(url);
  const tag = r1.headers.get('etag');
  assert(r1.status === 200 && tag && (await r1.arrayBuffer()).byteLength > 1000, 'the first time: the photo');
  const r2 = await fetch(url, { headers: { 'If-None-Match': tag } });
  eq([r2.status, (await r2.arrayBuffer()).byteLength], [304, 0], 'again: "not changed", nothing sent');
  eq((await fetch(url, { headers: { 'If-None-Match': '"another"' } })).status, 200, 'a different photo by that name: sent');
});

await test('odd requests are turned away politely, never with a server error', async () => {
  for (const path of ['/api/comment', '/api/guestbook', '/api/suggest', '/api/push/subscribe', '/api/push/unsubscribe'])
    for (const body of ['null', '[]', '"x"', '{', '1'])
      assert((await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, body })).status < 500, `${path} ${body}`);
});

await test('lots of comments and guestbook entries: every one shown, and a change shows straight away', async () => {
  await putFile('thoughts/2026-10-01-chatty.md', '---\ndate: 2026-10-01 09:00\n---\nTalk to me\n');
  const files = {};
  const at = (i) => `20261001T1000${String(i).padStart(5, '0')}`;
  for (let i = 0; i < 120; i++) files[`comments/thoughts/2026-10-01-chatty/${at(i)}-n${i}.md`] = `---\nname: "Reader ${i}"\ndate: "2026-10-01 10:00"\n---\nComment ${i}\n`;
  for (let i = 0; i < 40; i++) files[`guestbook/${at(i)}-g${i}.md`] = `---\nname: "Guest ${i}"\ndate: "2026-10-01 10:${String(i).padStart(2, '0')}"\n---\nHello ${i}\n`;
  await api('batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: Object.entries(files).map(([key, text]) => ({ key, text })) }) });
  const chatty = (d) => d.posts.find((p) => p.slug === '2026-10-01-chatty').comments;
  const guests = (list) => list.filter((g) => /^Guest /.test(g.name));
  let d = await publicData();
  eq(chatty(d).length, 120, 'every comment');
  eq(guests(d.guestbook).length, 40, 'every guestbook entry');
  const ov = await overview();
  eq(ov.approvedComments.filter((c) => c.post === 'thoughts/2026-10-01-chatty').length, 120, 'in the back office too');
  eq(guests(ov.approvedGuestbook).length, 40, 'and the guestbook');
  // One edited, one deleted: straight away.
  await putFile(`comments/thoughts/2026-10-01-chatty/${at(7)}-n7.md`, '---\nname: "Reader 7"\ndate: "2026-10-01 10:00"\n---\nChanged my mind\n');
  await api('file?key=' + encodeURIComponent(`guestbook/${at(3)}-g3.md`), { method: 'DELETE' });
  d = await publicData();
  eq(chatty(d).find((c) => c.name === 'Reader 7').message, 'Changed my mind', 'the edit');
  eq(guests(d.guestbook).length, 39, 'the deletion');
  // (Tidied away: the post takes its comments with it.)
  await api('file?key=' + encodeURIComponent('thoughts/2026-10-01-chatty.md'), { method: 'DELETE' });
  for (let i = 0; i < 40; i++) if (i !== 3) await api('file?key=' + encodeURIComponent(`guestbook/${at(i)}-g${i}.md`), { method: 'DELETE' });
  eq((await overview()).approvedComments.filter((c) => c.post === 'thoughts/2026-10-01-chatty').length, 0, 'tidied');
});

const failed = report();
process.exit(failed ? 1 : 0);
