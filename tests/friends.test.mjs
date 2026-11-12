// Friends: two copies of the site (this one, and a second on TEST_BASE2) become buddies with a
// friend code, follow each other's posts, send each other notes, and refuse anyone else.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { test, report, assert, eq, launch, close, adminPage, editPost, unfold, clickSave, api, putFile, getFile, publicData, overview, PHOTOS, BASE, chromium, openTab } from './lib.mjs';

const BASE2 = process.env.TEST_BASE2 || 'http://localhost:8801';
async function api2(p, opts = {}) {
  const r = await fetch(`${BASE2}/admin/api/${p}`, opts);
  const body = (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error(`${p} → ${r.status} ${JSON.stringify(body)}`);
  return body;
}
// Waits (up to a few seconds) for something that happens in the background.
async function until(fn, what, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert(false, what);
}
async function assertThrows(fn, what) {
  let threw = false;
  try {
    await fn();
  } catch {
    threw = true;
  }
  assert(threw, what);
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
  await openTab(page, 'Friends');
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
  // (Their posts are on the site, signed in: Control Panel › Friends doesn't list them again.)
  const page = await adminPage();
  await openTab(page, 'Friends');
  await page.waitForSelector('.fr-privacy');
  eq(await page.locator('.fr-feed, .fr-post, .pal-posts').count(), 0, 'no list of their posts in the Control Panel');
  // In the notifications.
  await openTab(page, 'Notifications');
  await page.waitForSelector('.note-friendpost');
  assert((await page.locator('.note-friendpost').first().innerText()).includes('Harbour walk'), 'notification');
  await page.locator('.note-friendpost button', { hasText: 'See it' }).first().click();
  await page.waitForSelector('.pal-convo');
  assert((await page.locator('.pal-convo').innerText()).includes('Lina'), 'opens their panel');
  eq(await page.locator('.pal-convo .fr-post').count(), 0, 'with no posts in it');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  const bad = await fetch(`${BASE}/friends-media/localhost_8801/${encodeURIComponent('../../site.md')}`);
  eq(bad.status, 404, 'odd photo names refused');
});

await test('your site has a Friends tab with their posts if you choose (to start with, they’re just for you)', async () => {
  const before = await publicData();
  eq([before.buddies, before.friendPosts, before.friendsTab], [[], [], false], 'to start with, visitors see nothing of your friends');
  const fr = await api('friends');
  eq([fr.listSeen, fr.postsSeen], ['me', 'me'], 'only you');
  await post_(api, 'friends/settings', { visibility: 'all' });
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
  await site.waitForSelector('.ff-full');
  assert(await site.locator('.xp-links a', { hasText: 'Friends' }).count(), 'a Friends tab');
  eq(await site.locator('.ff-buddy').count(), 1, 'the buddy list');
  // The neighbourhood: a house for each friend on the list, linking to their own site, lit while they're online.
  eq(await site.locator('.nb .nb-house').count(), 1, 'a house for the friend');
  eq(await site.locator('.nb-house').first().getAttribute('href'), BASE2, 'which opens their site');
  assert(await site.locator('.nb-house.on').count(), 'lights on: they’re online');
  assert((await site.locator('.nb-house').first().getAttribute('aria-label')).includes('Lina'), 'named for them');
  eq(await site.evaluate(() => document.querySelector('.feed.ff').firstElementChild.className.split(' ')[0]), 'nb', 'the street comes first');
  const post = site.locator('.ff-full').first();
  assert((await post.innerText()).includes('Harbour walk'), 'post shown');
  eq(await post.locator('.card-body img, .prose img').count(), 0, 'no pictures from the text');
  eq(await post.locator('a[href^="javascript"]').count(), 0, 'no script links');
  const loaded = await site.waitForFunction(() => { const img = document.querySelector('.ff-full img[src^="/friends-media/"]'); return img && img.complete && img.naturalWidth > 0; }, null, { timeout: 10000 }).then(() => true, () => false);
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

await test('a friends-only post: not on their site, nor on yours; only in your back office', async () => {
  const at = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  await fetch(`${BASE2}/admin/api/upload?key=thoughts/just-us/c.jpg`, { method: 'PUT', body: fs.readFileSync(PHOTOS[0]) });
  await fetch(`${BASE2}/admin/api/file?key=thoughts/just-us.md`, { method: 'PUT', body: `---\ndate: ${at}\ntitle: Just for friends\nfriends_only: true\nphotos: [c.jpg]\n---\nSmall news.\n` });
  const theirs = await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).json();
  assert(!theirs.posts.some((p) => p.title === 'Just for friends'), 'not on their own site');
  eq((await signed(BASE2, 'GET', '/api/friends/media?key=' + encodeURIComponent('thoughts/just-us/c.jpg'), FAKE, secret)).status, 200, 'its photo is shared with friends');
  await post_(api, 'friends/refresh');
  const mine = (await api('friends')).friends[0].cache.feed.posts.find((p) => p.title === 'Just for friends');
  assert(mine && mine.friends_only, 'in my feed from them, marked');
  const d = await publicData();
  assert(!d.friendPosts.some((p) => p.title === 'Just for friends'), 'not on my site’s Friends tab');
  eq((await fetch(BASE + '/friends-media/localhost_8801/thoughts/just-us/c.jpg')).status, 404, 'its photo isn’t for my visitors');
  // Signed in, on your Friends tab: marked, with no link to a page that isn't public.
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await p.goto(BASE + '/?owner=1#/friends');
    const card = p.locator('.feed.ff [data-friend-post$="|thoughts/just-us"]');
    await card.waitFor();
    assert((await card.innerText()).includes('friends only'), 'marked, for you');
    eq(await card.locator('.ff-open').count(), 0, 'no link to a page that isn’t public');
    assert(!p.errors.length, p.errors.join('; '));
  } finally {
    await browser.close();
  }
});

await test('you choose who sees your friends, and friends choose whether you can show their posts', async () => {
  const photo = (await publicData()).friendPosts[0].photos[0];
  // Just the friends list: no posts, no photos, no Friends tab.
  let set = await post_(api, 'friends/settings', { listSeen: 'everyone', postsSeen: 'me' });
  eq([set.listSeen, set.postsSeen], ['everyone', 'me'], 'list only');
  let d = await publicData();
  eq([d.buddies.map((b) => b.name), d.friendPosts, d.friendDays, d.friendsTab], [['Lina Lounge'], [], [], true], 'the list, without posts: the tab holds the street and buddies');
  // (A visitor then sees the houses but nothing of the posts: no smoke, no envelope, no word of posts.)
  {
    const b = await chromium.launch();
    const v = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    v.errors = [];
    v.on('pageerror', (e) => v.errors.push(e.message));
    await v.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await v.goto(BASE + '/#/friends');
    await v.waitForSelector('.nb .nb-house');
    eq([await v.locator('.nb-house').count(), await v.locator('.nb-puff').count(), await v.locator('.nb-mail').count(), await v.locator('.ff-full, .ff-post').count()], [1, 0, 0, 0], 'houses only: no smoke, no envelope, no posts');
    assert(!v.errors.length, v.errors.join('; '));
    await b.close();
  }
  eq((await fetch(BASE + photo)).status, 404, 'and no photos');
  // Just their posts: the Friends tab, without the list.
  await post_(api, 'friends/settings', { listSeen: 'me', postsSeen: 'everyone' });
  d = await publicData();
  eq([d.buddies, d.friendPosts.length > 0, d.friendsTab], [[], true, true], 'their posts, without the list');
  eq(d.friendPosts[0].friend.name, 'Lina Lounge', 'each still says who it’s from');
  eq((await fetch(BASE + photo)).status, 200, 'with their photos');
  // For friends only: visitors see neither (friends visiting do: see the visiting test).
  set = await post_(api, 'friends/settings', { listSeen: 'friends', postsSeen: 'friends' });
  eq([set.listSeen, set.postsSeen], ['friends', 'friends'], 'for friends');
  d = await publicData();
  eq([d.buddies, d.friendPosts, d.friendsTab], [[], [], false], 'visitors see nothing');
  eq((await fetch(BASE + photo)).status, 404, 'nor the photos');
  // Only me: nothing.
  await post_(api, 'friends/settings', { listSeen: 'me', postsSeen: 'me' });
  d = await publicData();
  eq([d.buddies, d.friendPosts, d.friendsTab], [[], [], false], 'nothing at all');
  // In the Control Panel: two choices, each Everyone, My friends or Only me.
  const page = await adminPage();
  await openTab(page, 'Friends');
  await page.waitForSelector('.fr-privacy');
  eq(await page.locator('.fr-seen').count(), 2, 'two choices');
  eq(await page.locator('.fr-seen').first().locator('.fr-vis').allInnerTexts(), ['👁 Everyone', '👥 My friends', '🔒 Only me'], 'each the same three');
  assert(await page.locator('input[name="fr-listSeen"][value="me"]').isChecked() && (await page.locator('input[name="fr-postsSeen"][value="me"]').isChecked()), 'the back office shows the choice');
  await page.locator('.fr-seen', { hasText: 'Their posts' }).locator('.fr-vis', { hasText: 'Everyone' }).click();
  await page.waitForFunction(() => document.querySelector('.fr-vis.on input[name="fr-postsSeen"][value="everyone"]')?.checked);
  await page.locator('.fr-seen', { hasText: 'Your friends list' }).locator('.fr-vis', { hasText: 'Everyone' }).click();
  await page.waitForFunction(() => document.querySelector('.fr-vis.on input[name="fr-listSeen"][value="everyone"]')?.checked);
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  d = await publicData();
  eq([d.buddies.length, d.friendPosts.length > 0, d.friendsTab], [1, true, true], 'everyone again');
  // Your friend says no to being shown on other sites: their posts leave yours (you still see them).
  eq((await post_(api2, 'friends/settings', { letShare: false })).letShare, false, 'friend says no');
  await until(async () => (await publicData()).friendPosts.length === 0, 'their posts leave your site (moments later)');
  d = await publicData();
  eq([d.buddies.length, d.friendPosts], [1, []], 'their posts leave your site');
  eq((await fetch(BASE + photo)).status, 404, 'and their photos');
  assert((await api('friends')).friends[0].cache.feed.posts.length > 0, 'you still see them yourself');
  await post_(api2, 'friends/settings', { letShare: true });
  await until(async () => (await publicData()).friendPosts.length > 0, 'back when they say yes (moments later)');
  // The old settings still work.
  const seen = async () => (({ listSeen, postsSeen }) => [listSeen, postsSeen])(await api('friends'));
  await post_(api, 'friends/settings', { showOnSite: false });
  eq(await seen(), ['me', 'me'], 'old off');
  await post_(api, 'friends/settings', { visibility: 'list' });
  eq(await seen(), ['everyone', 'me'], 'old list');
  await post_(api, 'friends/settings', { showOnSite: true });
  eq(await seen(), ['everyone', 'everyone'], 'old on');
});

await test('signed in: their posts in your Home, a dot on Friends, and comments that go straight on', async () => {
  await post_(api, 'friends/settings', { visibility: 'off' });
  const pub = await publicData();
  eq([pub.friendPosts, pub.friendsTab], [[], false], 'visitors: nothing of theirs');
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  p.on('dialog', (dl) => dl.accept());
  await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
  try {
    await p.goto(BASE + '/?owner=1#/');
    await p.waitForSelector('.okit-plus');
    // In your Home, as on their site, with who it's from on top; friends-only ones marked.
    const harbour = p.locator('.ff-in-home[data-friend-post$="|places/harbour"]');
    await harbour.waitFor();
    assert((await harbour.locator('.ff-from').innerText()).includes('Lina Lounge'), 'who it’s from');
    const only = p.locator('.ff-in-home', { hasText: 'Just for friends' });
    assert((await only.innerText()).includes('friends only'), 'a friends-only post, marked');
    eq(await harbour.locator('.okit-more').count(), 0, 'not taken for one of yours');
    // Something new: a dot on Friends.
    await p.waitForSelector('.okit-ndot');
    eq(await p.locator('.okit-ndot').first().innerText(), '2', 'two new posts');
    // Comment on theirs: it goes straight on at their site.
    await harbour.locator('.okit-talk-btn').click();
    await harbour.locator('.okit-talk textarea').fill('Lovely gulls!');
    await harbour.locator('.okit-talk .okit-btn.go', { hasText: 'Post' }).click();
    await p.waitForFunction(() => /Posted on their site/.test(document.querySelector('.okit-toast')?.textContent || ''));
    const again = p.locator('.ff-in-home[data-friend-post$="|places/harbour"]');
    await p.waitForFunction(() => /1 comment/.test(document.querySelector('.ff-in-home[data-friend-post$="|places/harbour"] .okit-talk-btn')?.textContent || ''));
    assert(!(await again.locator('.okit-talk').isHidden()), 'still open after the page redraws');
    assert((await again.locator('.okit-talk-item').innerText()).includes('You'), 'yours, marked');
    const theirs = await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).json();
    const c = theirs.posts.find((x) => x.slug === 'harbour').comments;
    eq(c.map((x) => [x.name, x.site, x.message]), [['Sam', BASE, 'Lovely gulls!']], 'on their site, under your name, linking to yours');
    eq((await api2('overview')).pendingComments.length, 0, 'not waiting for approval');
    // Their visitors' comments still wait.
    const v = await (await fetch(`${BASE2}/api/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post: 'places/harbour', name: 'Visitor', message: 'Hi there' }) })).json();
    eq(v.pending, true, 'a visitor’s comment waits');
    eq(await again.locator('.okit-talk-item .okit-btn.link').count(), 0, 'no replying to yourself');
    // Once they approve it, you see it, and can answer it.
    const waiting = (await api2('overview')).pendingComments[0];
    await post_(api2, `move?key=${encodeURIComponent(waiting.key)}&to=${encodeURIComponent(waiting.key.replace('comments-pending/', 'comments/'))}`);
    await until(async () => (await api('overview')).friendsMine.posts.find((x) => x.id === 'places/harbour').comments.length === 2, 'their approved comment reaches you');
    await p.reload();
    const fresh = p.locator('.ff-in-home[data-friend-post$="|places/harbour"]');
    await fresh.locator('.okit-talk-btn', { hasText: '2 comments' }).click();
    await fresh.locator('.okit-talk-item', { hasText: 'Visitor' }).locator('.okit-btn.link', { hasText: 'Reply' }).click();
    await fresh.locator('.okit-talk-item textarea').fill('And the chips.');
    await fresh.locator('.okit-talk-item .okit-btn.go').click();
    await p.waitForFunction(() => /3 comments/.test(document.querySelector('.ff-in-home[data-friend-post$="|places/harbour"] .okit-talk-btn')?.textContent || ''));
    const after = await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).json();
    const cs = after.posts.find((x) => x.slug === 'harbour').comments;
    eq(cs.find((x) => x.message === 'And the chips.').reply_to, cs.find((x) => x.name === 'Visitor').id, 'a reply, under the comment it answers');
    // Friends: only you see it (it says so), and opening it clears the dot.
    await p.goto(BASE + '/?owner=1#/friends');
    await p.waitForSelector('.feed.ff .okit-note');
    assert((await p.locator('.okit-note').innerText()).includes('Only you'), 'only you');
    await p.waitForTimeout(400);
    eq(await p.locator('.okit-ndot').count(), 0, 'dot cleared');
    await p.goto(BASE + '/?owner=1#/');
    await p.waitForSelector('.ff-in-home');
    await p.waitForTimeout(400);
    eq(await p.locator('.okit-ndot').count(), 0, 'and stays cleared');
    // On a computer, the Friends icon on the desktop (only there while you're signed in) has it.
    const dp = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await dp.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await dp.goto(BASE + '/#/');
    await dp.waitForSelector('.desk-icon');
    eq(await dp.locator('.desk-icon .di-friends').count(), 0, 'visitors: no Friends icon');
    await dp.goto(BASE + '/?owner=1#/');
    await dp.addInitScript(() => localStorage.removeItem('okit-friends-seen'));
    await dp.reload();
    await dp.waitForSelector('.desk-icon .di-friends .okit-ndot');
    await dp.close();
    // View as a visitor: none of it.
    await p.locator('.okit-me').first().click();
    await p.locator('.okit-menu button', { hasText: 'View as a visitor' }).click();
    await p.waitForSelector('.okit-preview');
    await p.waitForTimeout(400);
    eq(await p.locator('.ff-in-home').count(), 0, 'no friends’ posts for visitors');
    assert(!p.errors.length, p.errors.join('; '));
  } finally {
    await browser.close();
  }
  // Mixing them into Home is yours to turn off.
  eq((await post_(api, 'friends/settings', { inHome: false })).inHome, false, 'not in Home');
  eq((await api('overview')).friendsMine.inHome, false, 'told to the site');
  await post_(api, 'friends/settings', { inHome: true, visibility: 'all' });
});

await test('notes between friends: the newest pops up, the rest wait in Mail; only for the one it’s to', async () => {
  // Not from just anyone.
  eq((await fetch(`${BASE2}/api/friends/note`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Friend-From': BASE }, body: '{"text":"hi"}' })).status, 403, 'unsigned: refused');
  // Two notes from Sam to Lina.
  await post_(api, 'mail/send', { friend: 'localhost_8801', text: 'Fancy a walk on Saturday?' });
  await post_(api, 'mail/send', { friend: 'localhost_8801', text: 'Bring the camera!\nAnd snacks.' });
  const lina = await api2('mail');
  eq([lina.unread, lina.notes.map((n) => [n.name, n.text, n.out || false])], [2, [['Sam', 'Bring the camera!\nAnd snacks.', false], ['Sam', 'Fancy a walk on Saturday?', false]]], 'in Lina’s mail, newest first');
  eq((await api('mail')).notes.filter((n) => n.out).length, 2, 'Sam keeps a copy of what he sent');
  assert(!JSON.stringify(await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).json()).includes('Fancy a walk'), 'never on the site');
  await assertThrows(() => post_(api, 'mail/send', { friend: 'localhost_8801', text: '   ' }), 'an empty note isn’t sent');
  const browser = await chromium.launch();
  try {
    // Lina, on a computer: the newest pops up over the tray; the other is in Mail.
    const p = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await p.goto(BASE2 + '/?owner=1#/');
    const pop = p.locator('.okit-mailpop.balloon');
    await pop.waitFor();
    const said = await pop.innerText();
    assert(said.includes('Bring the camera') && !said.includes('Fancy a walk') && said.includes('1 more'), 'only the newest: ' + said);
    await p.waitForFunction(() => [...document.querySelectorAll('.okit-mailbtn')].some((b) => b.offsetParent && b.querySelector('.okit-badge').textContent === '2'));
    await pop.locator('button', { hasText: 'Read it' }).click();
    await p.waitForSelector('.okit-mailwin .ml-read');
    assert((await p.locator('.ml-read').innerText()).includes('Bring the camera'), 'open in Mail');
    eq(await p.locator('.ml-row').count(), 2, 'both in the inbox');
    eq(await p.locator('.ml:not(.narrow) .ml-side').count(), 1, 'side by side on a computer');
    await p.waitForFunction(() => document.querySelector('.okit-mailbtn .okit-badge')?.textContent === '1');
    await p.locator('.ml-read button', { hasText: 'Reply' }).click();
    await p.locator('.ml-compose textarea').fill('Yes! See you at ten.');
    await p.locator('.ml-compose button', { hasText: 'Send' }).click();
    await p.waitForFunction(() => /Sent to Sam/.test(document.querySelector('.okit-toast')?.textContent || ''));
    // Only once: it doesn't pop up again next time.
    await p.reload();
    await p.waitForSelector('.okit-mailbtn');
    await p.waitForTimeout(1500);
    eq(await p.locator('.okit-mailpop').count(), 0, 'popped once');
    assert(!p.errors.length, p.errors.join('; '));
    // Sam, on a phone: a banner along the top; Mail one thing at a time.
    const q = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    q.errors = [];
    q.on('pageerror', (e) => q.errors.push(e.message));
    await q.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await q.goto(BASE + '/?owner=1#/');
    const banner = q.locator('.okit-mailpop.banner');
    await banner.waitFor();
    assert((await banner.innerText()).includes('See you at ten'), 'Lina’s reply');
    await q.waitForTimeout(500);
    const box = await banner.boundingBox();
    assert(box.y >= 0 && box.y < 60 && box.x >= 0 && box.x + box.width <= 390, 'along the top, within the screen: ' + JSON.stringify(box));
    await banner.locator('.mp-x').click();
    await q.locator('.okit-mailbtn').first().click();
    await q.waitForSelector('.ml.narrow .ml-row');
    eq(await q.locator('.ml-pane').isVisible(), false, 'the list first');
    await q.locator('.ml-row').first().click();
    await q.waitForSelector('.ml.narrow.reading .ml-read');
    eq(await q.locator('.ml-side').isVisible(), false, 'then the note on its own');
    await q.locator('.ml-read .ml-back').click();
    await q.waitForSelector('.ml.narrow:not(.reading) .ml-row');
    // From the Friends tab: a note to a buddy.
    await q.keyboard.press('Escape');
    await q.goto(BASE + '/?owner=1#/friends');
    await q.locator('.okit-note-btn').first().click();
    await q.waitForSelector('.ml-compose select');
    eq(await q.locator('.ml-compose select').inputValue(), 'localhost_8801', 'to them');
    assert(!q.errors.length, q.errors.join('; '));
  } finally {
    await browser.close();
  }
  eq((await api('mail')).notes.find((n) => !n.out).reply_to, lina.notes[0].id, 'a reply, to the note it answers');
  // Deleting one.
  const id = (await api2('mail')).notes[0].id;
  await post_(api2, 'mail/delete', { id });
  assert(!(await api2('mail')).notes.some((n) => n.id === id), 'deleted');
});


await test('a knock at the door: a friend knocks from their neighbourhood; your site shakes and says who, once; you can stop taking them', async () => {
  // Not from just anyone.
  eq((await fetch(`${BASE2}/api/friends/knock`, { method: 'POST', headers: { 'X-Friend-From': BASE } })).status, 403, 'unsigned: refused');
  const browser = await chromium.launch();
  try {
    // Sam knocks on Lina's house, on his Friends tab.
    const p = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await p.goto(BASE + '/?owner=1#/friends');
    const knocker = p.locator('.nb-plot .okit-knock').first();
    await knocker.waitFor();
    await knocker.click();
    await p.waitForFunction(() => /Knock knock! Lina/.test(document.querySelector('.okit-toast')?.textContent || ''));
    assert(await p.locator('.nb-plot.nb-knocked').count(), 'her house jumps');
    // Straight away again: not yet.
    await knocker.click();
    await p.waitForFunction(() => /only just knocked/.test(document.querySelector('.okit-toast')?.textContent || ''));
    assert(!p.errors.length, p.errors.join('; '));
    // Kept for Lina alone, with no words: who and when.
    const kept = (await api2('mail')).knocks;
    eq([kept.length, kept[0].name, Object.keys(kept[0]).sort()], [1, 'Sam', ['at', 'friend', 'name', 'site']], 'who knocked, and when');
    const pub = await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).text();
    assert(!/knock/i.test(pub), 'never on the site');
    // Lina, signed in: the site shakes and says who.
    const q = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    q.errors = [];
    q.on('pageerror', (e) => q.errors.push(e.message));
    await q.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await q.goto(BASE2 + '/?owner=1#/');
    const pop = q.locator('.okit-knockpop');
    await pop.waitFor();
    assert(/Sam\s+knocked on your door/.test((await pop.innerText()).replace(/\n/g, ' ')), 'it says who: ' + (await pop.innerText()));
    // Told once.
    await q.waitForFunction(async () => !(await (await fetch('/admin/api/mail')).json()).knocks.length);
    await q.reload();
    await q.waitForSelector('.okit-mailbtn');
    await q.waitForTimeout(1500);
    eq(await q.locator('.okit-knockpop').count(), 0, 'heard once');
    assert(!q.errors.length, q.errors.join('; '));
    // A visitor has no knocker.
    const v = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await v.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await v.goto(BASE + '/#/');
    await v.waitForTimeout(800);
    eq(await v.locator('.okit-knock').count(), 0, 'nothing for visitors');
  } finally {
    await browser.close();
  }
  // Lina stops taking knocks: Sam is told so, and nothing is kept.
  await post_(api2, 'friends/settings', { knocks: false });
  await assertThrows(() => post_(api, 'mail/knock', { friend: 'localhost_8801' }), 'not answering the door');
  eq((await api2('mail')).knocks.length, 0, 'nothing kept');
  await post_(api2, 'friends/settings', { knocks: true });
});
await test('a friend\'s new post reaches your site within moments, and an open page picks it up', async () => {
  // Your site is open on a phone (like the site saved to its home screen).
  const browser = await chromium.launch();
  const site = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  site.errors = [];
  site.on('pageerror', (e) => site.errors.push(e.message));
  await site.clock.install();
  await site.addInitScript(() => sessionStorage.setItem('entered', '1'));
  await site.goto(BASE + '/#/friends');
  await site.waitForSelector('.ff-full');
  // Your friend posts. Nobody presses Check now and nobody waits for the 10-minute check.
  const at = new Date(Date.now() - 60e3).toISOString().slice(0, 16).replace('T', ' ');
  await fetch(`${BASE2}/admin/api/file?key=thoughts/fresh-news.md`, { method: 'PUT', body: `---\ndate: ${at}\ntitle: Fresh news\n---\nJust now.\n` });
  await until(async () => (await publicData()).friendPosts.some((p) => p.title === 'Fresh news'), 'their post is on your site within moments');
  // Editing it: the change follows. Deleting it: it goes.
  await fetch(`${BASE2}/admin/api/file?key=thoughts/fresh-news.md`, { method: 'PUT', body: `---\ndate: ${at}\ntitle: Fresh news (edited)\n---\nJust now.\n` });
  await until(async () => (await publicData()).friendPosts.some((p) => p.title === 'Fresh news (edited)'), 'an edit follows');
  // The page that was already open shows it when you come back to it.
  assert(!(await site.locator('.ff-full', { hasText: 'Fresh news' }).count()), 'not there before');
  await site.clock.fastForward(61000);
  await site.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await site.waitForSelector('.ff-full:has-text("Fresh news (edited)")', { timeout: 10000 });
  assert(!site.errors.length, site.errors.join('; '));
  await browser.close();
  await fetch(`${BASE2}/admin/api/file?key=thoughts/fresh-news.md`, { method: 'DELETE' });
  await until(async () => !(await publicData()).friendPosts.some((p) => p.title.startsWith('Fresh news')), 'a deleted post goes');
  // Saving something friends don't see (the wallpaper: only the theme's post cards go to them)
  // doesn't bother them.
  const before = (await api('friends')).friends[0].cache.at;
  await fetch(`${BASE2}/admin/api/file?key=theme.md`, { method: 'PUT', body: '---\ntheme: classic\nwallpaper: hearts\n---\n' });
  await new Promise((r) => setTimeout(r, 2500));
  eq((await api('friends')).friends[0].cache.at, before, 'no news, no message');
  await fetch(`${BASE2}/admin/api/file?key=theme.md`, { method: 'PUT', body: '---\ntheme: classic\n---\n' });
});

await test('a friend\'s post looks as it does on their site: keepsakes, a memory, their own designs', async () => {
  const at = new Date(Date.now() - 30e3).toISOString().slice(0, 16).replace('T', ' ');
  await fetch(`${BASE2}/admin/api/file?key=keepsakes.md`, { method: 'PUT', body: '---\ncustom: [{"id":"ferry","name":"Ferry ticket","shape":"ticket","heading":"ISLAND FERRY","paper":"#fde7a8","types":["places","thoughts"]}]\n---\n' });
  await fetch(`${BASE2}/admin/api/file?key=thoughts/by-the-sea.md`, { method: 'PUT', body: `---\ndate: ${at}\ntitle: That summer by the sea\nmemory: 2019-07\nflower: [Daisy from the cliff path]\nsky: true\ncustom_keepsakes: {ferry: ["Return — £8"]}\n---\nWe swam until the sun went down.\n` });
  await until(async () => (await publicData()).friendPosts.some((p) => p.title === 'That summer by the sea' && p.full?.memory === '2019-07'), 'it arrives in full');
  const d = await publicData();
  eq(d.friendKeepsakes.map((k) => [k.id, k.name, k.picture]), [['localhost_8801~ferry', 'Ferry ticket', '']], 'their own keepsake design, under their name');
  const browser = await chromium.launch();
  const site = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  site.errors = [];
  site.on('pageerror', (e) => site.errors.push(e.message));
  await site.addInitScript(() => sessionStorage.setItem('entered', '1'));
  await site.goto(BASE + '/#/friends');
  const card = site.locator('.ff-full', { hasText: 'That summer by the sea' });
  await card.waitFor();
  assert((await card.locator('.ff-from').innerText()).includes('Lina Lounge'), 'who it’s from');
  eq(await card.evaluate((el) => el.classList.contains('memory')), true, 'a memory, on its old card');
  assert((await card.innerText()).toUpperCase().includes('RELIVING A MEMORY'), 'with its ribbon');
  assert(await card.locator('.ks-sky, .sky').count(), 'the sky keepsake');
  assert((await card.innerText()).includes('Daisy from the cliff path'), 'the pressed flower');
  assert((await card.locator('.km-wrap').innerText()).includes('ISLAND FERRY'), 'their own ferry ticket design');
  const links = await card.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  assert(links.length && links.every((h) => h.startsWith(BASE2)), 'every link goes to their site: ' + links.join(', '));
  assert(!site.errors.length, site.errors.join('; '));
  await browser.close();
  await fetch(`${BASE2}/admin/api/file?key=thoughts/by-the-sea.md`, { method: 'DELETE' });
});

await test('a friend\'s post wears the card they chose: their own made card, the one it drew from their mix, or its own', async () => {
  const at = (m) => new Date(Date.now() - m * 60e3).toISOString().slice(0, 16).replace('T', ' ');
  // Your own card c1 is a different card: theirs mustn't be drawn as yours.
  await putFile('theme.md', '---\ntheme: classic\ncards: [{"id": "c1", "name": "Mine", "edge": "glow"}]\n---\n');
  await fetch(`${BASE2}/admin/api/file?key=theme.md`, { method: 'PUT', body: '---\ntheme: classic\nmain: "#aa2266"\ncard_style: c1\ncards: [{"id": "c1", "name": "Theirs", "edge": "stripes", "deco": "seal", "paper": "#fff3d1"}]\n---\n' });
  await fetch(`${BASE2}/admin/api/file?key=thoughts/my-card.md`, { method: 'PUT', body: `---\ndate: ${at(1)}\ntitle: Wearing my card\n---\nHi.\n` });
  await fetch(`${BASE2}/admin/api/file?key=thoughts/a-ticket.md`, { method: 'PUT', body: `---\ndate: ${at(2)}\ntitle: Dressed as a ticket\ncard: ticket\n---\nHi.\n` });
  await until(async () => {
    const d = await publicData();
    return d.friendPosts.some((p) => p.title === 'Dressed as a ticket') && Object.values(d.friendLooks || {}).some((l) => l.card_style === 'c1' && l.cards?.[0]?.edge === 'stripes');
  }, 'their cards arrive with their posts');
  const shown = async () => {
    const browser = await chromium.launch();
    const site = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    site.errors = [];
    site.on('pageerror', (e) => site.errors.push(e.message));
    await site.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await site.goto(BASE + '/#/friends');
    await site.locator('.ff-full', { hasText: 'Dressed as a ticket' }).waitFor();
    const out = await site.evaluate(() => Object.fromEntries([...document.querySelectorAll('.ff-full')].map((c) => [c.querySelector('.card-title')?.textContent.trim(), [c.dataset.card || 'classic', getComputedStyle(c).borderTopWidth]])));
    assert(!site.errors.length, site.errors.join('; '));
    await browser.close();
    return out;
  };
  let cards = await shown();
  assert(/^f\d+-c1$/.test(cards['Wearing my card'][0]), 'their own card, under their name: ' + cards['Wearing my card'][0]);
  eq(cards['Wearing my card'][1], '7px', 'drawn from their parts (airmail edge), not yours');
  eq(cards['Dressed as a ticket'][0], 'ticket', 'a post dressed in a design of its own');
  // Mixed at random on their site: each post wears what it drew there.
  await fetch(`${BASE2}/admin/api/file?key=theme.md`, { method: 'PUT', body: '---\ntheme: classic\ncard_style: mix\ncard_mix: ["polaroid"]\n---\n' });
  await until(async () => Object.values((await publicData()).friendLooks || {}).some((l) => l.card_style === 'mix'), 'their mix arrives');
  cards = await shown();
  eq([cards['Wearing my card'][0], cards['Dressed as a ticket'][0]], ['polaroid', 'ticket'], 'from their mix');
  // Tidied on the way in.
  const { tidyFeed } = await import('../src/friends.js');
  const look = tidyFeed({ cards_look: { theme: '<x>', main: 'red;', card_style: 'mix', card_mix: ['polaroid', '"><b>'], card_seed: 'x', cards: [{ id: 'c1', name: '<b>x</b>', edge: 'evil' }] } }, { url: 'https://pal.example', key: 'pal.example', name: 'Pal' }).cards_look;
  eq(look, { theme: 'classic', cards: [{ ...look.cards[0], edge: 'none' }], card_style: 'mix', card_mix: ['polaroid'] }, 'only known choices');
  assert(!/[<>]/.test(JSON.stringify(look)), 'no markup');
  await fetch(`${BASE2}/admin/api/file?key=theme.md`, { method: 'PUT', body: '---\ntheme: classic\n---\n' });
  for (const k of ['my-card', 'a-ticket']) await fetch(`${BASE2}/admin/api/file?key=thoughts/${k}.md`, { method: 'DELETE' });
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('a post in full from a friend\'s site is made safe before anyone sees it', async () => {
  const { tidyFeed } = await import('../src/friends.js');
  const friend = { url: 'https://pal.example', key: 'pal.example', name: 'Pal' };
  const nasty = '<img src=x onerror=alert(1)>"\'><svg onload=alert(1)>';
  const feed = tidyFeed({
    name: 'Pal',
    keepsakes: [{ id: 'ferry', name: nasty, shape: '<b>', paper: 'red;background:url(x)', picture: 'design/x.jpg' }, { id: '../../x', name: 'Bad id' }],
    categories: [{ key: 'brunch', label: nasty, color: 'url(x)' }, { key: '<x>', label: 'no' }],
    posts: [{
      id: 'thoughts/hello', type: 'thoughts', title: 'Hi', text: 'Hello <script>alert(1)</script>', ts: 1, photos: ['../../site.md', 'thoughts/hello/1.jpg'],
      full: { slug: '../../etc', flower: [{ item: nasty, price: 3 }], sky: [], memory: { evil: 1 }, rating: 'five', font: '<x>', made_up: 'dropped', __proto__x: 1, custom_keepsakes: { ferry: [{ item: 'ok' }] }, ordered: Array(500).fill('x'), html: '<script>x</script>', photos: ['https://elsewhere.example/x.jpg'] }
    }, { id: 'nope/x', type: 'nope', full: { title: 'x' } }]
  }, friend);
  const [p, q] = feed.posts;
  const f = p.full;
  const text = JSON.stringify(feed);
  assert(!/[<>]/.test(JSON.stringify([f, feed.keepsakes, feed.categories])), 'no markup characters anywhere in the full post, designs or categories');
  eq(f.flower[0].item.includes('‹img'), true, 'text kept, made harmless');
  eq(f.sky, [], 'a plain keepsake stays');
  eq([f.memory, f.rating, f.font], [{}.memory ?? null, null, ''], 'wrong kinds of values fall back');
  assert(!('made_up' in f) && !('__proto__x' in f) && !('html' in f) && !('photos' in f), 'only what your site knows');
  eq(f.ordered.length, 60, 'long lists are capped');
  eq(Object.keys(f.custom_keepsakes), ['pal.example~ferry'], 'their designs keep their own names');
  eq(f.slug, 'hello', 'an odd slug is replaced');
  eq(p.photos, ['thoughts/hello/1.jpg'], 'only their own photos, by name');
  assert(!p.html.includes('<script'), 'the writing is cleaned');
  eq(q.full, null, 'an unknown kind of post isn’t drawn in full');
  eq(feed.keepsakes.map((k) => [k.id, k.shape, k.paper, k.picture]), [['pal.example~ferry', 'ticket', '', '']], 'designs checked, no picture from elsewhere');
  eq(feed.categories.map((c) => [c.key, c.color]), [['brunch', '']], 'categories checked');
  assert(!text.includes('javascript:'), 'nothing that runs');
});

await test('tagging a friend, and a shared album they add photos to', async () => {
  const at = (d) => new Date(Date.now() - d * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  await fetch(`${BASE2}/admin/api/upload?key=photos/beach/own.jpg`, { method: 'PUT', body: fs.readFileSync(PHOTOS[2]) });
  await fetch(`${BASE2}/admin/api/file?key=photos/beach.md`, { method: 'PUT', body: `---\ndate: ${at(1)}\ntitle: Beach day\nphotos: [own.jpg]\nwith: ["${BASE}"]\nalbum_with: ["${BASE}/"]\n---\nSand everywhere.\n` });
  await post_(api, 'friends/refresh');
  const mine = (await api('overview')).friendsMine.posts.find((x) => x.id === 'photos/beach');
  eq([mine.tagged, mine.album_open], [true, true], 'you’re tagged, and may add photos');
  // Someone it isn't shared with can't add to it.
  const png = fs.readFileSync(PHOTOS[0]).toString('base64');
  const no = await signed(BASE2, 'POST', '/api/friends/album', FAKE, secret, { body: JSON.stringify({ post: 'photos/beach', photo: png }) });
  eq(no.status, 403, 'not shared with the pretend site');
  // You add one, from your own site, signed in.
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  p.on('dialog', (dl) => dl.accept());
  await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
  try {
    await p.goto(BASE + '/?owner=1#/');
    const beach = p.locator('.ff-in-home[data-friend-post$="|photos/beach"]');
    await beach.locator('.okit-album-add').waitFor();
    assert((await beach.locator('.ff-from').innerText()).includes('with you'), 'tagged, said on top');
    await beach.locator('.okit-album-add + input[type=file]').setInputFiles(PHOTOS[1]);
    await p.waitForFunction(() => /Your photo is in/.test(document.querySelector('.okit-toast')?.textContent || ''), null, { timeout: 20000 });
    // A ♥ and an emoji on their post, from yours: they go to their site.
    const heart = beach.locator('.ff-react .react-btn[data-k="heart"]');
    await heart.click();
    await p.waitForFunction(() => document.querySelector('.ff-in-home[data-friend-post$="|photos/beach"] .ff-react .react-btn[data-k="heart"]')?.getAttribute('aria-pressed') === 'true' && !document.querySelector('.ff-react')?.title);
    await until(async () => (await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).json()).posts.find((x) => x.slug === 'beach').reactions?.heart === 1, 'your ♥ on their site');
    await beach.locator('.ff-react .react-add').click();
    await p.locator('.react-pick .react-pick-btn', { hasText: '🔥' }).click();
    await until(async () => (await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).json()).posts.find((x) => x.slug === 'beach').reactions?.custom?.['🔥'] === 1, 'and your emoji');
    eq(await beach.locator('.ff-react .react-x').count(), 0, 'their emoji aren’t yours to take off');
    await beach.locator('.ff-react .react-btn[data-k="heart"]').click();
    await until(async () => !(await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).json()).posts.find((x) => x.slug === 'beach').reactions?.heart, 'taken back');
    eq((await api('overview')).friendsMine.posts.find((x) => x.id === 'photos/beach').reactions, { heart: 0, star: 0, grin: 0, custom: { '🔥': 1 } }, 'your copy of their feed has the new counts');
    assert(!p.errors.length, p.errors.join('; '));
  } finally {
    await browser.close();
  }
  const theirs = async () => (await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).json()).posts.find((x) => x.slug === 'beach');
  const b = await theirs();
  eq(b.photos.length, 2, 'in their album, after theirs');
  eq(b.captions[1], '📷 Sam', 'with your name');
  eq(b.album_with, undefined, 'who may add isn’t shown to visitors');
  eq((await fetch(BASE2 + b.photos[1])).status, 200, 'the photo is there');
  // Their back office lists who gave which, and they can take one out.
  const album = (await api2('overview')).posts.find((x) => x.slug === 'beach').album;
  eq(album.map((e) => [e.name, e.site]), [['Sam', BASE]], 'listed with who gave it');
  eq((await api2('overview')).posts.find((x) => x.slug === 'beach').photos.length, 1, 'kept apart from their own photos in the editor');
  await post_(api2, 'albums/remove', { post: 'photos/beach', file: album[0].file });
  eq((await theirs()).photos.length, 1, 'taken out');
  eq((await fetch(BASE2 + b.photos[1])).status, 404, 'and deleted');
  // Who it's with shows to their visitors only while they can see who their friends are.
  await post_(api2, 'friends/settings', { visibility: 'list' });
  let pub = await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).json();
  eq(pub.posts.find((x) => x.slug === 'beach').with, [BASE], 'with you, on their site');
  eq(pub.webring, undefined, 'no friends ring any more');
  const v = await chromium.launch();
  const vp = await v.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  vp.errors = [];
  vp.on('pageerror', (e) => vp.errors.push(e.message));
  await vp.addInitScript(() => sessionStorage.setItem('entered', '1'));
  try {
    await vp.goto(BASE2 + '/#/post/photos/beach');
    await vp.waitForSelector('.with-line');
    eq((await vp.locator('.with-line').innerText()).trim(), '👥 with Sam', 'on the post, linking to your site');
    eq(await vp.locator('.with-line a').getAttribute('href'), BASE, 'your site');
    await vp.evaluate(() => (location.hash = '#/about'));
    await vp.waitForSelector('.about-note');
    eq(await vp.locator('.webring').count(), 0, 'no ring on About');
    assert(!vp.errors.length, vp.errors.join('; '));
  } finally {
    await v.close();
  }
  await post_(api2, 'friends/settings', { visibility: 'off' });
  pub = await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).json();
  eq(pub.posts.find((x) => x.slug === 'beach').with, [], 'friends private: no names');
  // Tagging from the editor: your friends as chips.
  await putFile('thoughts/walk.md', `---\ndate: ${at(2)}\ntitle: A walk\n---\nOut and about.\n`);
  const page = await adminPage();
  await editPost(page, 'A walk');
  await unfold(page);
  await page.locator('.friends-field .friend-chip', { hasText: 'Lina' }).click();
  eq(await page.locator('.friends-field .friend-chip.on').count(), 1, 'chosen');
  await clickSave(page);
  await until(async () => (await getFile('thoughts/walk.md')).includes(BASE2), 'saved in the post');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

await test('a post just for them never reaches a friend’s site', async () => {
  const at = new Date(Date.now() - 30 * 60e3).toISOString().slice(0, 16).replace('T', ' ');
  await fetch(`${BASE2}/admin/api/file?key=thoughts/hush.md`, { method: 'PUT', body: `---\ndate: ${at}\ntitle: Hush\nonly_me: true\n---\nNobody else.\n` });
  await post_(api, 'friends/refresh');
  const theirs = (await api('overview')).friendsMine.posts;
  assert(theirs.some((x) => x.id === 'photos/beach'), 'their other posts arrive');
  assert(!theirs.some((x) => x.id === 'thoughts/hush'), 'not the one only for them');
  await fetch(`${BASE2}/admin/api/file?key=thoughts/hush.md`, { method: 'DELETE' });
});

await test('visiting a friend’s site as their friend: what’s for friends, with a pass; visitors see none of it', async () => {
  const at = new Date(Date.now() - 20 * 60e3).toISOString().slice(0, 16).replace('T', ' ');
  await fetch(`${BASE2}/admin/api/upload?key=thoughts/pals-only/p.jpg`, { method: 'PUT', body: fs.readFileSync(PHOTOS[3]) });
  await fetch(`${BASE2}/admin/api/file?key=thoughts/pals-only.md`, { method: 'PUT', body: `---\ndate: ${at}\ntitle: Pals only\nfriends_only: true\nphotos: [p.jpg]\n---\nJust for friends.\n` });
  await post_(api, 'friends/refresh');
  // (A visitor to their site, not signed in, by another name than "localhost".)
  const asVisitor = (path) => new Promise((res, rej) => http.get({ host: 'localhost', port: new URL(BASE2).port, path, headers: { Host: 'visitor.test', 'User-Agent': 'Mozilla/5.0 (Macintosh) Safari/605' } }, (r) => (r.resume(), res(r.statusCode))).on('error', rej));
  eq(await asVisitor('/media/thoughts/pals-only/p.jpg'), 404, 'its photo isn’t for visitors');
  assert(!(await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).json()).posts.some((x) => x.slug === 'pals-only'), 'nor the post');
  // Their friends list and their friends' posts, kept to friends: not for visitors.
  await post_(api2, 'friends/settings', { listSeen: 'friends', postsSeen: 'friends' });
  const plain = await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).json();
  eq([plain.buddies, plain.friendPosts, plain.friendsTab], [[], [], false], 'visitors see none of their friends');
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
    const p = await ctx.newPage();
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await p.goto(BASE + '/?owner=1#/');
    const card = p.locator('.ff-in-home[data-friend-post$="|thoughts/pals-only"]');
    await card.locator('.okit-talk-wrap').waitFor();
    eq([await card.locator('.ff-open').count(), await card.locator('.okit-visit').count()], [0, 0], 'no link under it: their house is the way in');
    // Their house in the neighbourhood: tapping it visits as their friend.
    await p.goto(BASE + '/?owner=1#/friends');
    await p.waitForSelector('.feed.ff .okit-note');
    await p.locator('.nb-house').first().waitFor();
    const [tab] = await Promise.all([ctx.waitForEvent('page'), p.locator('.nb-house').first().click()]);
    tab.errors = [];
    tab.on('pageerror', (e) => tab.errors.push(e.message));
    await tab.waitForSelector('.visit-bar', { timeout: 20000 });
    assert(tab.url().startsWith(BASE2) && !tab.url().includes('friend_pass') && !tab.url().includes('friendvisit'), 'their site, the pass gone from the address: ' + tab.url());
    assert(/visiting as Lina’s friend/.test(await tab.locator('.visit-bar').innerText()), 'it says so');
    await tab.waitForSelector('[data-post="thoughts/pals-only"]', { timeout: 15000 });
    eq(await tab.evaluate(async () => (await fetch('/media/thoughts/pals-only/p.jpg')).status), 200, 'its photo too');
    const cookie = (await ctx.cookies(BASE2)).find((c) => c.name === 'corner_friend');
    assert(cookie?.httpOnly && cookie.sameSite === 'Lax', 'kept safely, for this site');
    eq(await tab.evaluate(() => fetch('/api/all', { cache: 'no-cache' }).then((r) => r.headers.get('Cache-Control'))), 'private, no-store', 'never kept anywhere shared');
    // What they keep for friends: their friends list, and the Friends tab.
    const asFriend = await tab.evaluate(() => fetch('/api/all', { cache: 'no-cache' }).then((r) => r.json()));
    assert(asFriend.buddies.some((b) => b.url === BASE) && asFriend.friendsTab === true, 'their friends, for you as their friend: ' + JSON.stringify([asFriend.buddies.length, asFriend.friendsTab]));
    assert(asFriend.buddies.every((b) => !b.key), 'never the keys between their sites');
    // A ♥ on it, as their friend.
    await tab.locator('[data-post="thoughts/pals-only"] .react-btn[data-k="heart"]').first().click();
    await until(async () => (await (await fetch(`${BASE2}/admin/api/overview`)).json()).posts.find((x) => x.slug === 'pals-only')?.reactions?.heart === 1, 'your ♥ on a post for friends');
    // A pass is good once: the same address again, in another browser, is just a visitor.
    const used = tab.url().replace(/[?#].*$/, '') + '?friend_pass=' + 'x'.repeat(43);
    const other = await browser.newContext();
    const o = await other.newPage();
    await o.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await o.goto(used);
    await o.waitForSelector('.feed');
    eq(await o.locator('.visit-bar').count(), 0, 'a made-up pass: no visit');
    eq(await o.locator('[data-post="thoughts/pals-only"]').count(), 0, 'nothing for friends');
    await other.close();
    // Stop: the cookie goes, and their site is as any visitor sees it.
    await tab.locator('.visit-stop').click();
    await tab.waitForFunction(() => !document.querySelector('.visit-bar') && document.querySelector('.feed'), null, { timeout: 20000 });
    await tab.waitForTimeout(500);
    eq(await tab.locator('[data-post="thoughts/pals-only"]').count(), 0, 'gone once you stop');
    eq((await ctx.cookies(BASE2)).filter((c) => c.name === 'corner_friend').length, 0, 'and the cookie with it');
    assert(!p.errors.length && !tab.errors.length, [...p.errors, ...tab.errors].join('; '));
  } finally {
    await browser.close();
  }
  await fetch(`${BASE2}/admin/api/file?key=thoughts/pals-only.md`, { method: 'DELETE' });
  await post_(api2, 'friends/settings', { listSeen: 'me', postsSeen: 'me' });
});

await test('the little notice on the desktop: the newest post, yours or a friend’s; a visitor never sees what’s kept back', async () => {
  const at = (m) => new Date(Date.now() - m * 60e3).toISOString().slice(0, 16).replace('T', ' ');
  await putFile('thoughts/bal-mine.md', `---\ndate: ${at(120)}\ntitle: My own post\n---\nHello.\n`);
  await fetch(`${BASE2}/admin/api/file?key=thoughts/bal-theirs.md`, { method: 'PUT', body: `---\ndate: ${at(30)}\ntitle: Their public post\n---\nHi.\n` });
  await fetch(`${BASE2}/admin/api/file?key=thoughts/bal-pals.md`, { method: 'PUT', body: `---\ndate: ${at(10)}\ntitle: Their friends-only post\nfriends_only: true\n---\nHi.\n` });
  const was = await api('friends');
  await post_(api, 'friends/settings', { listSeen: 'everyone', postsSeen: 'everyone' });
  await post_(api, 'friends/refresh');
  const browser = await chromium.launch();
  const notice = async (owner) => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
    try {
      await p.goto(BASE + (owner ? '/?owner=1' : '/') + '#/');
      await p.waitForSelector('.balloon:not([hidden])', { timeout: 15000 });
      assert(!p.errors.length, p.errors.join('; '));
      return { head: await p.locator('.balloon strong').innerText(), text: await p.locator('.balloon-text').innerText(), href: await p.locator('.balloon-text').getAttribute('href') };
    } finally {
      await p.close();
    }
  };
  try {
    // A visitor: their newest public post (not the friends-only one), as it's newer than yours.
    let n = await notice(false);
    assert(/from Lina/.test(n.head) && n.text.includes('Their public post') && !n.text.includes('friends-only'), 'a visitor: the friend’s public post: ' + JSON.stringify(n));
    eq(n.href, '#/friends', 'which opens their posts');
    // You, signed in: the newest of everything, a friends-only post too.
    n = await notice(true);
    assert(n.text.includes('Their friends-only post'), 'signed in: whatever is newest: ' + JSON.stringify(n));
    // Their posts kept from visitors: the newest of yours that visitors may see.
    await post_(api, 'friends/settings', { listSeen: 'everyone', postsSeen: 'me' });
    n = await notice(false);
    assert(!/from/.test(n.head) && !n.text.includes('Their') && n.href.startsWith('#/post/thoughts/'), 'a visitor, with friends’ posts kept back: one of yours: ' + JSON.stringify(n));
    // A post of yours newer than theirs wins.
    await post_(api, 'friends/settings', { listSeen: 'everyone', postsSeen: 'everyone' });
    await putFile('thoughts/bal-mine.md', `---\ndate: ${at(5)}\ntitle: My own post\n---\nHello.\n`);
    n = await notice(false);
    eq([n.head, n.text.startsWith('My own post')], ['New thought', true], 'newer than theirs: yours');
  } finally {
    await browser.close();
    await post_(api, 'friends/settings', { listSeen: was.listSeen, postsSeen: was.postsSeen });
    await fetch(`${BASE}/admin/api/file?key=thoughts/bal-mine.md`, { method: 'DELETE' });
    for (const k of ['bal-theirs', 'bal-pals']) await fetch(`${BASE2}/admin/api/file?key=thoughts/${k}.md`, { method: 'DELETE' });
  }
});

await test('friends’ pictures of the day: a sign in each one’s garden in the neighbourhood, the very ones their sites show', async () => {
  const at = (h) => new Date(Date.now() - h * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  // (Only public posts to pick from: which one is today's is by the date, so a friends-only post
  // left over from an earlier test would make this one pass on some days and not on others.)
  await fetch(`${BASE2}/admin/api/file?key=thoughts/just-us.md`, { method: 'DELETE' });
  for (const [n, f] of [[1, 0], [2, 1], [3, 2]]) await fetch(`${BASE2}/admin/api/upload?key=photos/day-${n}/a.jpg`, { method: 'PUT', body: fs.readFileSync(PHOTOS[f]) });
  for (const n of [1, 2, 3]) await fetch(`${BASE2}/admin/api/file?key=photos/day-${n}.md`, { method: 'PUT', body: `---\ndate: ${at(n + 2)}\ntitle: Day ${n}\nphotos: [a.jpg]\n---\n` });
  // Their site: today's photo, picked by the site itself.
  const theirs = (await (await fetch(`${BASE2}/api/all?nocache=${Date.now()}`)).json()).photoOfDay;
  assert(theirs?.src?.startsWith('/media/') && theirs.post, 'their site has one: ' + JSON.stringify(theirs));
  // What their feed tells friends is the one their site shows friends today.
  const feed = await (await signed(BASE2, 'GET', '/api/friends/feed', FAKE, secret)).json();
  assert(feed.photo_day?.photo && `/media/${feed.photo_day.photo}` .length > 7, 'in their feed');
  await post_(api, 'friends/refresh');
  const lina = (await api('overview')).friendsMine.days.find((b) => b.url === BASE2);
  eq(lina.photo_day.id, feed.photo_day.id, 'yours shows the same one');
  eq((await fetch(BASE + lina.photo_day.src)).status, 200, 'and it loads, through your site: ' + JSON.stringify(lina.photo_day));
  // On your Friends tab: a sign in their garden.
  const theme = await getFile('theme.md').catch(() => '');
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await p.goto(BASE + '/?owner=1#/friends');
    await p.waitForSelector('.nb .nb-sign');
    // The houses' state: lights from presence; smoke and the envelope only from posts you may see.
    const st = await p.evaluate(async () => {
      const { houseState } = await import('/js/neighbourhood.js');
      const now = new Date(2026, 10, 12, 15, 0);
      const b = { url: 'https://x.test', presence: 'online' };
      const at = (d, h) => new Date(2026, 10, d, h).getTime();
      const post = (ts) => ({ ts, friend: { url: 'https://x.test' } });
      const pick = (s) => [s.lit, s.smoke, s.mail];
      return [
        pick(houseState(b, [], now)),
        pick(houseState({ ...b, presence: 'offline' }, [post(at(12, 9))], now)),
        pick(houseState(b, [post(at(10, 9))], now)),
        pick(houseState(b, [post(at(10, 9))], now, { 'https://x.test': at(11, 9) })),
        pick(houseState(b, [{ ts: at(12, 9), friend: { url: 'https://y.test' } }], now))
      ];
    });
    eq(st, [[true, false, false], [false, true, true], [true, false, true], [true, false, false], [true, false, false]], 'lights, smoke and envelope');
    eq([await p.locator('.pl, .pl-pin').count(), await p.locator('.nb-sign').count()], [0, 1], 'no washing line any more: a sign in their garden');
    assert((await p.locator('.nb-sign').innerText()).includes('Picture of the day'), 'which says what it is');
    await p.waitForFunction(() => document.querySelector('.nb-sign img')?.naturalWidth > 0);
    eq(await p.locator('.nb-snow').count(), 0, 'no snow with the seasons off');
    // The seasons on: the street dresses for winter.
    await putFile('theme.md', '---\ntheme: classic\nseasons: winter\n---\n');
    await p.reload();
    await p.waitForSelector('.nb .nb-snow');
    assert(!p.errors.length, p.errors.join('; '));
  } finally {
    await browser.close();
    await putFile('theme.md', theme || '---\ntheme: classic\n---\n');
  }
  for (const n of [1, 2, 3]) await fetch(`${BASE2}/admin/api/file?key=photos/day-${n}.md`, { method: 'DELETE' });
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
  await openTab(page, 'Friends');
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
