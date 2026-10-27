// The server on its own: fresh data straight after publishing, the export zip, photo
// cleaning and the visitor-facing endpoints.
import { api, test, report, assert, eq, putFile, getFile, upload, PHOTOS, BASE, chromium } from './lib.mjs';
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

const failed = report();
process.exit(failed ? 1 : 0);
