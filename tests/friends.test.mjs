// Friends: two copies of the site (this one, and a second on TEST_BASE2) become buddies with a
// friend code, follow each other's posts, and refuse anyone else. Following only: no messages.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { test, report, assert, eq, launch, close, adminPage, api, putFile, publicData, overview, PHOTOS, BASE, chromium } from './lib.mjs';

const BASE2 = process.env.TEST_BASE2 || 'http://localhost:8801';
async function api2(p, opts = {}) {
  const r = await fetch(`${BASE2}/admin/api/${p}`, opts);
  const body = (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error(`${p} → ${r.status} ${JSON.stringify(body)}`);
  return body;
}
const post_ = (fn, p, body) => fn(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
const b64url = (buf) => Buffer.from(buf).toString('base64url');
function signed(base, method, pathAndQuery, from, secret, { time = Date.now(), body = '' } = {}) {
  const hash = b64url(crypto.createHash('sha256').update(body).digest());
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${method}\n${pathAndQuery}\n${time}\n${hash}`).digest());
  return fetch(base + pathAndQuery, { method, headers: { 'X-Friend-From': from, 'X-Friend-Time': String(time), 'X-Friend-Sig': sig, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body || undefined });
}

await launch();
// The code's secret, and the secret of a friendship the tests make themselves (a pretend site).
let codeSecret = '';
let secret = '';
const FAKE = 'http://localhost:9999';

await test('two sites, named', async () => {
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\nstatus: "At home :)"\n---\nHi.\n');
  await fetch(`${BASE2}/admin/api/file?key=site.md`, { method: 'PUT', body: '---\nname: Lina Lounge\nowner: Lina\nstatus: "revising (book)"\npresence: busy\n---\nHi.\n' });
  eq((await api('friends')).friends, [], 'no friends to start with');
});

await test('friend codes: odd ones are refused with a clear reason', async () => {
  for (const [code, word] of [['hello', 'doesn’t look like'], ['MYCORNER-' + b64url('{"u":"http://localhost:8801"}'), 'not complete'], ['MYCORNER-' + b64url(JSON.stringify({ u: 'javascript:alert(1)', s: 'x'.repeat(40) })), 'not complete'], ['MYCORNER-' + b64url(JSON.stringify({ u: 'https://10.0.0.1', s: 'x'.repeat(40) })), 'not complete']]) {
    let err = '';
    try {
      await post_(api, 'friends/add', { code });
    } catch (e) {
      err = e.message;
    }
    assert(err.includes(word), `${code}: ${err}`);
  }
  const own = (await post_(api, 'friends/invite')).code;
  let err = '';
  try {
    await post_(api, 'friends/add', { code: own });
  } catch (e) {
    err = e.message;
  }
  assert(err.includes('your own'), 'own code: ' + err);
  // A made-up secret for a real site: that site says no.
  err = '';
  try {
    await post_(api, 'friends/add', { code: 'MYCORNER-' + b64url(JSON.stringify({ u: BASE2, s: 'a'.repeat(43) })) });
  } catch (e) {
    err = e.message;
  }
  assert(err.includes('isn’t working'), 'made-up secret: ' + err);
  eq((await api('friends')).friends.length, 0, 'still no friends');
});

await test('pasting a friend code makes you buddies, both ways', async () => {
  const code = (await post_(api2, 'friends/invite')).code;
  codeSecret = JSON.parse(Buffer.from(code.replace('MYCORNER-', ''), 'base64url').toString()).s;
  eq((await post_(api2, 'friends/invite')).code, code, 'the same code every time');
  // A code's secret alone doesn't open the feed: only a hello with it does.
  eq((await signed(BASE2, 'GET', '/api/friends/feed', BASE, codeSecret)).status, 403, 'the code’s secret');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Friends' }).click();
  await page.waitForSelector('.pal-win');
  await page.locator('button', { hasText: 'Add a friend' }).click();
  await page.getByRole('textbox', { name: 'Your friend’s code' }).fill(code);
  await page.locator('.fr-box button', { hasText: 'Add' }).click();
  await page.waitForSelector('.buddy');
  assert((await page.locator('.buddy').innerText()).includes('Lina Lounge'), 'buddy shown');
  assert((await page.locator('.buddy').innerText()).includes('revising'), 'their status');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  const mine = await api('friends');
  const theirs = await api2('friends');
  eq([mine.friends.map((f) => f.url), theirs.friends.map((f) => f.url)], [[BASE2], [BASE]], 'each follows the other');
  eq(mine.friends[0].cache.feed.presence, 'busy', 'presence');
  // The friendship has a secret of its own, not the code's.
  eq((await signed(BASE2, 'GET', '/api/friends/feed', BASE, codeSecret)).status, 403, 'not the code’s secret');
  // The code keeps working (adding again changes nothing).
  await post_(api, 'friends/add', { code });
  eq([(await api('friends')).friends.length, (await api2('friends')).friends.length], [1, 1], 'still one friend each');
});

await test('a friend code lasts, for any number of friends, until you change it', async () => {
  // Another site (pretend) uses the same code, and gets its own secret back.
  const hello = await signed(BASE2, 'POST', '/api/friends/hello', FAKE, codeSecret, { body: JSON.stringify({ v: 2, name: 'Pretend Site' }) });
  eq(hello.status, 200, 'a second friend with the same code');
  secret = (await hello.json()).secret;
  assert(secret && secret !== codeSecret, 'with a secret of its own');
  eq((await signed(BASE2, 'GET', '/api/friends/feed', FAKE, secret)).status, 200, 'which works');
  eq((await signed(BASE2, 'GET', '/api/friends/feed', BASE, secret)).status, 403, 'and only for that friend');
  // A new code: the old one stops working, friends stay friends.
  const fresh = (await post_(api2, 'friends/code', { action: 'new' })).code;
  const freshSecret = JSON.parse(Buffer.from(fresh.replace('MYCORNER-', ''), 'base64url').toString()).s;
  assert(freshSecret !== codeSecret, 'a new code');
  eq((await signed(BASE2, 'POST', '/api/friends/hello', 'http://localhost:9998', codeSecret, { body: '{"v":2}' })).status, 403, 'the old code no longer works');
  eq((await signed(BASE2, 'GET', '/api/friends/feed', FAKE, secret)).status, 200, 'friends stay friends');
  // Switched off: nobody new; switched on: a new code.
  eq((await post_(api2, 'friends/code', { action: 'off' })).code, null, 'switched off');
  eq((await signed(BASE2, 'POST', '/api/friends/hello', 'http://localhost:9998', freshSecret, { body: '{"v":2}' })).status, 403, 'refused while off');
  eq((await post_(api2, 'friends/invite')).code, null, 'stays off');
  assert((await post_(api2, 'friends/code', { action: 'on' })).code.startsWith('MYCORNER-'), 'switched on again');
  eq((await api2('friends')).friends.length, 2, 'two friends now');
});

await test('requests between sites must be signed, recent and untampered', async () => {
  eq((await signed(BASE2, 'GET', '/api/friends/feed', FAKE, secret)).status, 200, 'a real friend’s request');
  eq((await fetch(BASE2 + '/api/friends/feed')).status, 403, 'unsigned');
  eq((await signed(BASE2, 'GET', '/api/friends/feed', FAKE, 'wrong-secret-wrong-secret')).status, 403, 'wrong secret');
  eq((await signed(BASE2, 'GET', '/api/friends/feed', 'http://localhost:9997', secret)).status, 403, 'someone else');
  eq((await signed(BASE2, 'GET', '/api/friends/feed', FAKE, secret, { time: Date.now() - 10 * 60 * 1000 })).status, 403, 'too old');
  eq((await signed(BASE2, 'GET', '/api/friends/feed?x=1', FAKE, secret)).status, 200, 'query is signed too');
  const t = Date.now();
  const hash = b64url(crypto.createHash('sha256').update('').digest());
  const sig = b64url(crypto.createHmac('sha256', secret).update(`GET\n/api/friends/feed\n${t}\n${hash}`).digest());
  eq((await fetch(BASE2 + '/api/friends/feed?more=1', { headers: { 'X-Friend-From': FAKE, 'X-Friend-Time': String(t), 'X-Friend-Sig': sig } })).status, 403, 'changed path');
  eq((await signed(BASE2, 'POST', '/api/friends/inbox', FAKE, secret, { body: '{"text":"hi"}' })).status, 404, 'no messages');
  eq((await signed(BASE2, 'GET', '/api/friends/media?key=' + encodeURIComponent('places/nope/a.jpg'), FAKE, secret)).status, 404, 'a photo that isn’t in a post');
});

await test('their posts show up (not drafts), with photos through your own site', async () => {
  const at = (d) => new Date(Date.now() - d * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  await fetch(`${BASE2}/admin/api/upload?key=places/harbour/a.jpg`, { method: 'PUT', body: fs.readFileSync(PHOTOS[0]) });
  await fetch(`${BASE2}/admin/api/upload?key=thoughts/secret/b.jpg`, { method: 'PUT', body: fs.readFileSync(PHOTOS[1]) });
  await fetch(`${BASE2}/admin/api/file?key=places/harbour.md`, { method: 'PUT', body: `---\ndate: ${at(2)}\ntitle: Harbour walk\ncity: Whitby\nphotos: [a.jpg]\n---\nGulls *everywhere*. <img src=x onerror=alert(1)> [click](javascript:alert(1)) [ok](https://example.com)\n` });
  await fetch(`${BASE2}/admin/api/file?key=thoughts/secret.md`, { method: 'PUT', body: `---\ndate: ${at(1)}\ntitle: Not yet\ndraft: true\nphotos: [b.jpg]\n---\nDraft.\n` });
  eq((await signed(BASE2, 'GET', '/api/friends/media?key=' + encodeURIComponent('thoughts/secret/b.jpg'), FAKE, secret)).status, 404, 'a draft’s photo is not shared');
  await post_(api, 'friends/refresh');
  const feed = (await api('friends')).friends[0].cache.feed;
  eq(feed.posts.map((p) => p.title), ['Harbour walk'], 'only the published post');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Friends' }).click();
  await page.waitForSelector('.fr-feed .fr-post');
  const card = page.locator('.fr-feed .fr-post').first();
  assert((await card.innerText()).includes('Harbour walk'), 'post in the feed');
  eq(await card.locator('.fr-text img').count(), 0, 'no pictures from the text');
  eq(await card.locator('.fr-text a[href^="javascript"]').count(), 0, 'no script links');
  eq(await card.locator('.fr-text a[href="https://example.com"]').count(), 1, 'ordinary links kept');
  const src = await card.locator('.fr-photos img').first().getAttribute('src');
  assert(src.startsWith('/admin/api/friends/photo?'), 'photo comes through your own site: ' + src);
  await page.locator('.fr-photos img').first().scrollIntoViewIfNeeded();
  const ok = await page.waitForFunction(() => { const img = document.querySelector('.fr-photos img'); return img.complete && img.naturalWidth > 0; }, null, { timeout: 10000 }).then(() => true, () => false);
  assert(ok, 'the photo loads');
  // And in the notifications.
  await page.locator('.admin-tabs button.tab-bell').click();
  await page.waitForSelector('.note-friendpost');
  assert((await page.locator('.note-friendpost').first().innerText()).includes('Harbour walk'), 'notification');
  await page.locator('.note-friendpost button', { hasText: 'See it' }).first().click();
  await page.waitForSelector('.pal-convo');
  assert((await page.locator('.pal-convo').innerText()).includes('Lina'), 'opens their panel');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  const bad = await fetch(`${BASE}/admin/api/friends/photo?friend=${encodeURIComponent('localhost_8801')}&p=${encodeURIComponent('../../site.md')}`);
  eq(bad.status, 404, 'odd photo names refused');
});

await test('your site has a Friends tab with their posts, unless you turn it off', async () => {
  const d = await publicData();
  eq(d.buddies.map((x) => [x.name, x.url, x.presence]), [['Lina Lounge', BASE2, 'busy']], 'buddies shown');
  eq(d.friendPosts.map((p) => [p.title, p.friend.name]), [['Harbour walk', 'Lina Lounge']], 'their posts');
  assert(!/javascript:/i.test(d.friendPosts[0].html) && d.friendPosts[0].html.includes('href="https://example.com"'), 'script links gone before they reach a browser');
  const photo = d.friendPosts[0].photos[0];
  assert(photo.startsWith('/friends-media/'), 'photo through your own site: ' + photo);
  eq((await fetch(BASE + photo)).status, 200, 'the photo loads for a visitor');
  eq((await fetch(BASE + '/friends-media/localhost_8801/thoughts/secret/b.jpg')).status, 404, 'only photos in the feed');
  eq((await fetch(BASE + '/friends-media/nobody/places/harbour/a.jpg')).status, 404, 'only friends');
  assert(![secret, codeSecret].some((x) => JSON.stringify(d).includes(x)), 'no secrets anywhere in the public data');
  const browser = await chromium.launch();
  const site = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  site.errors = [];
  site.on('pageerror', (e) => site.errors.push(e.message));
  await site.addInitScript(() => sessionStorage.setItem('entered', '1'));
  await site.goto(BASE + '/#/friends');
  await site.waitForSelector('.ff-post');
  assert(await site.locator('.xp-links a', { hasText: 'Friends' }).count(), 'a Friends tab');
  eq(await site.locator('.ff-buddy').count(), 1, 'the buddy list');
  const post = site.locator('.ff-post').first();
  assert((await post.innerText()).includes('Harbour walk'), 'post shown');
  eq(await post.locator('.ff-text img').count(), 0, 'no pictures from the text');
  eq(await post.locator('a[href^="javascript"]').count(), 0, 'no script links');
  const loaded = await site.waitForFunction(() => { const img = document.querySelector('.ff-photos img'); return img && img.complete && img.naturalWidth > 0; }, null, { timeout: 10000 }).then(() => true, () => false);
  assert(loaded, 'the photo shows');
  await site.locator('.ff-buddy').first().click();
  assert((await site.locator('.ff-pick').innerText()).includes('Lina'), 'tap a buddy to see only theirs');
  assert(!site.errors.length, site.errors.join('; '));
  await browser.close();
  await post_(api, 'friends/settings', { showOnSite: false });
  const off = await publicData();
  eq([off.buddies, off.friendPosts], [[], []], 'hidden when turned off');
  eq((await fetch(BASE + photo)).status, 404, 'and their photos too');
  await post_(api, 'friends/settings', { showOnSite: true });
  assert(!(await overview()).files.some((f) => f.key.startsWith('data/_')), 'friends files never listed');
});

await test('you choose who sees your friends, and friends choose whether you can show their posts', async () => {
  const photo = (await publicData()).friendPosts[0].photos[0];
  // Just the friends list: no posts, no photos, no Friends tab.
  eq((await post_(api, 'friends/settings', { visibility: 'list' })).visibility, 'list', 'list only');
  let d = await publicData();
  eq([d.buddies.map((b) => b.name), d.friendPosts, d.friendsTab], [['Lina Lounge'], [], false], 'the list, without posts');
  eq((await fetch(BASE + photo)).status, 404, 'and no photos');
  // Only me: nothing.
  await post_(api, 'friends/settings', { visibility: 'off' });
  d = await publicData();
  eq([d.buddies, d.friendPosts, d.friendsTab], [[], [], false], 'nothing at all');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Friends' }).click();
  await page.waitForSelector('.fr-privacy');
  assert(await page.locator('.fr-vis input[value="off"]').isChecked(), 'the back office shows the choice');
  await page.locator('.fr-vis', { hasText: 'Everyone' }).click();
  await page.waitForFunction(() => document.querySelector('.fr-vis input[value="all"]')?.checked && document.querySelector('.fr-vis.on input[value="all"]'));
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  d = await publicData();
  eq([d.friendPosts.length > 0, d.friendsTab], [true, true], 'everyone again');
  // Your friend says no to being shown on other sites: their posts leave yours (you still see them).
  eq((await post_(api2, 'friends/settings', { letShare: false })).letShare, false, 'friend says no');
  d = await publicData();
  eq([d.buddies.length, d.friendPosts], [1, []], 'their posts leave your site');
  eq((await fetch(BASE + photo)).status, 404, 'and their photos');
  assert((await api('friends')).friends[0].cache.feed.posts.length > 0, 'you still see them yourself');
  await post_(api2, 'friends/settings', { letShare: true });
  eq((await publicData()).friendPosts.length > 0, true, 'back when they say yes (straight away)');
  // The old setting still works.
  await post_(api, 'friends/settings', { showOnSite: false });
  eq((await api('friends')).visibility, 'off', 'old off');
  await post_(api, 'friends/settings', { showOnSite: true });
  eq((await api('friends')).visibility, 'all', 'old on');
});

await test('your site keeps its address, and friends follow when it moves', async () => {
  const NEW = BASE.replace('localhost', '127.0.0.1');
  // Opening the back office at another address doesn't change who you are to friends.
  const there = await (await fetch(NEW + '/admin/api/friends')).json();
  eq([there.me, there.here], [BASE, NEW], 'your address stays put');
  eq((await api2('friends')).friends.map((f) => f.url), [BASE, FAKE], 'they know your old address');
  // Moving: the friend's site checks you're really there, then follows.
  const out = await post_(api, 'friends/address', { address: NEW + '/' });
  eq([out.address, out.told, out.failed], [NEW, ['Lina Lounge'], []], 'friends told');
  eq((await api('friends')).me, NEW, 'your new address');
  eq((await api('friends')).behind, [], 'nobody left behind');
  const oldCode = (await post_(api, 'friends/invite')).code;
  const lina = (await api2('friends')).friends.find((f) => f.name !== 'Pretend Site');
  eq([lina.url, lina.aliases], [NEW, [BASE]], 'they follow, and remember the old address');
  // Both ways still work.
  eq((await post_(api, 'friends/refresh')).reached, 1, 'you read theirs');
  eq((await post_(api2, 'friends/refresh')).reached, 1, 'they read yours (the pretend site has no feed)');
  assert((await api2('friends')).friends.find((f) => f.url === NEW).cache.feed, 'with your feed');
  // A friend can't be moved somewhere their site isn't.
  const odd = await signed(BASE2, 'POST', '/api/friends/moved', FAKE, secret, { body: JSON.stringify({ to: 'http://localhost:9996' }) });
  eq(odd.status, 409, 'not followed somewhere that isn’t there');
  eq((await api2('friends')).friends.find((f) => f.name === 'Pretend Site').url, FAKE, 'and stays put');
  // Addresses that can't be used.
  for (const bad of ['', 'not an address', 'ftp://example.com', 'javascript:alert(1)']) {
    const r = await fetch(BASE + '/admin/api/friends/address', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: bad }) });
    eq(r.status, 400, 'refused: ' + bad);
  }
  // And back again, which works the same way.
  eq((await post_(api, 'friends/address', { address: BASE })).told, ['Lina Lounge'], 'moved back');
  const back = (await api2('friends')).friends.find((f) => f.name !== 'Pretend Site');
  eq([back.url, back.aliases], [BASE, [NEW]], 'followed back');
  // The back office, opened at another address, offers to move there.
  const page = await adminPage(NEW);
  await page.locator('.admin-tabs button', { hasText: 'Friends' }).click();
  await page.waitForSelector('.fr-address');
  await page.locator('.fr-move button', { hasText: 'Move my site to' }).click();
  await page.waitForFunction(() => /Moved, and your friend knows/.test(document.body.innerText));
  await page.waitForFunction(() => !document.querySelector('.fr-move'), null, { timeout: 5000 }).catch(() => {});
  eq(await page.locator('.fr-move').count(), 0, 'nothing more to say');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  eq((await api('friends')).me, NEW, 'moved from the back office');
  eq((await post_(api, 'friends/address', { address: BASE })).told, ['Lina Lounge'], 'and back');
  // A code sent before you moved still works, and they follow you where you are now.
  const key = (await api2('friends')).friends.find((f) => f.url === BASE).key;
  await post_(api2, 'friends/remove?friend=' + encodeURIComponent(key));
  eq((await api('friends')).friends.length, 0, 'unfollowed');
  await post_(api2, 'friends/add', { code: oldCode });
  const again = (await api2('friends')).friends.find((f) => f.name !== 'Pretend Site');
  eq([again.url, again.aliases], [BASE, [NEW]], 'an old code finds you');
  eq((await api('friends')).friends.map((f) => f.url), [BASE2], 'friends again');
});

await test('removing a buddy unfollows both ways', async () => {
  // The pretend site says goodbye first.
  eq((await signed(BASE2, 'POST', '/api/friends/bye', FAKE, secret, { body: '{}' })).status, 200, 'goodbye');
  eq((await signed(BASE2, 'GET', '/api/friends/feed', FAKE, secret)).status, 403, 'its secret no longer works');
  const key = (await api('friends')).friends[0].key;
  await post_(api, 'friends/remove?friend=' + encodeURIComponent(key));
  eq([(await api('friends')).friends.length, (await api2('friends')).friends.length], [0, 0], 'both forgot');
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
