// Notifications: two sites (this one, and a friend's on TEST_BASE2), and a pretend push service
// on this computer that keeps what it's sent. Each message is decrypted here exactly as a phone
// would (RFC 8291) and its signature checked (VAPID), so what the site sends is really readable
// by the device it's for, and only that device.
import crypto from 'node:crypto';
import http from 'node:http';
import { test, report, assert, eq, launch, close, api, putFile, publicData, BASE, chromium } from './lib.mjs';

const BASE2 = process.env.TEST_BASE2 || 'http://localhost:8801';
async function api2(p, opts = {}) {
  const r = await fetch(`${BASE2}/admin/api/${p}`, opts);
  const body = (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error(`${p} → ${r.status} ${JSON.stringify(body)}`);
  return body;
}
const post_ = (fn, p, body) => fn(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
const at = (h) => new Date(Date.now() - h * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
async function until(fn, what, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert(false, what);
}

// ---------- a pretend push service ----------
const PORT = 8899;
const got = []; // { path, headers, body }
const gone = new Set(); // paths that answer "this device has gone"
const server = http.createServer((req, res) => {
  const parts = [];
  req.on('data', (c) => parts.push(c));
  req.on('end', () => {
    got.push({ path: req.url, headers: req.headers, body: Buffer.concat(parts) });
    res.statusCode = gone.has(req.url) ? 410 : 201;
    res.end();
  });
});
await new Promise((r) => server.listen(PORT, r));
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
// A device: its keys, and its address at the pretend push service.
function device(name) {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ecdh, auth, path: `/push/${name}`, sub: { endpoint: `http://localhost:${PORT}/push/${name}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } };
}
// What the device would read: decrypted, its signature checked.
function read(dev, msg) {
  const b = msg.body;
  const salt = b.subarray(0, 16);
  const idlen = b[20];
  const asPublic = b.subarray(21, 21 + idlen);
  const ct = b.subarray(21 + idlen);
  const shared = dev.ecdh.computeSecret(asPublic);
  const ikm = hmac(hmac(dev.auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), dev.ecdh.getPublicKey(), asPublic, Buffer.from([1])])).subarray(0, 32);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  assert(plain[plain.length - 1] === 2, 'the last record');
  // The site's signature, for this push service, with the site's own key.
  const [, jwt, k] = /vapid t=([^,]+), k=(.+)$/.exec(msg.headers.authorization) || [];
  const [h, c, s] = jwt.split('.');
  const raw = Buffer.from(k, 'base64url');
  const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') }, format: 'jwk' });
  assert(crypto.verify('sha256', Buffer.from(`${h}.${c}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')), 'signed by the site');
  const claims = JSON.parse(Buffer.from(c, 'base64url'));
  eq(claims.aud, `http://localhost:${PORT}`, 'for this push service');
  assert(claims.exp * 1000 > Date.now(), 'not expired');
  eq(msg.headers['content-encoding'], 'aes128gcm', 'encrypted for the device');
  return JSON.parse(plain.subarray(0, plain.length - 1).toString());
}
const sentTo = (dev, from = 0) => got.slice(from).filter((m) => m.path === dev.path);
const nextFor = async (dev, from, what) => read(dev, (await until(() => sentTo(dev, from)[0], what))[0] || sentTo(dev, from)[0]);

await launch();
const phone = device('my-phone');
const visitor = device('visitor');

await test('two sites, friends; your phone signs up for notifications', async () => {
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\n---\nHi.\n');
  await fetch(`${BASE2}/admin/api/file?key=site.md`, { method: 'PUT', body: '---\nname: Lina Lounge\nowner: Lina\n---\nHi.\n' });
  await putFile('thoughts/old.md', `---\ndate: ${at(30)}\ntitle: Already here\n---\nOld news.\n`);
  const code = (await post_(api2, 'friends/invite')).code;
  await post_(api, 'friends/add', { code });
  const st = await api('push');
  eq(Buffer.from(st.publicKey, 'base64url').length, 65, 'the site’s own key');
  eq([st.devices, st.kinds, st.visitors], [[], { comments: true, notes: true, friends: true, email: true }, false], 'nothing yet; all kinds on; visitors off');
  // Not just any address: a push service's (or, testing, this computer).
  let refused = '';
  await post_(api, 'push/subscribe', { subscription: { ...phone.sub, endpoint: 'https://evil.example/collect' } }).catch((e) => (refused = e.message));
  assert(refused.includes('push service'), 'only a push service: ' + refused);
  eq((await post_(api, 'push/subscribe', { subscription: phone.sub, device: 'iPhone' })).ok, true, 'signed up');
  eq((await api('push')).devices.map((d) => d.name), ['iPhone'], 'listed');
  const before = got.length;
  await post_(api, 'push/test');
  eq((await nextFor(phone, before, 'a test')).title, 'Notifications are on', 'a test arrives, readable');
});

await test('you hear about comments, signatures and suggestions waiting for you', async () => {
  await putFile('thoughts/hello.md', `---\ndate: ${at(2)}\ntitle: Hello\n---\nHi there.\n`);
  let from = got.length;
  await fetch(`${BASE}/api/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post: 'thoughts/hello', name: 'Jo', message: 'Lovely post!' }) });
  const m = await nextFor(phone, from, 'a comment');
  eq([m.title, m.body, m.url], ['💬 Jo commented on “Hello”', 'Lovely post!', '/?owner=1#/post/thoughts/hello'], 'who, what, and where it opens');
  from = got.length;
  await fetch(`${BASE}/api/guestbook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Ana', message: 'Hi from Lisbon' }) });
  eq((await nextFor(phone, from, 'a signature')).title, '✍ Ana signed the guestbook', 'a signature');
  from = got.length;
  await fetch(`${BASE}/api/suggest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'book', title: 'A good one', name: 'Max' }) });
  eq((await nextFor(phone, from, 'a suggestion')).url, '/?owner=1#/books', 'a suggestion, by its shelf');
  // Switched off: nothing.
  await post_(api, 'push/settings', { kinds: { comments: false } });
  from = got.length;
  await fetch(`${BASE}/api/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post: 'thoughts/hello', name: 'Jo', message: 'Again' }) });
  await new Promise((r) => setTimeout(r, 1500));
  eq(sentTo(phone, from).length, 0, 'not when you’ve switched it off');
  await post_(api, 'push/settings', { kinds: { comments: true } });
});

await test('a note from a friend, and a friend’s new post', async () => {
  let from = got.length;
  await post_(api2, 'mail/send', { friend: 'localhost_8800', text: 'Coffee tomorrow?' });
  const m = await nextFor(phone, from, 'a note');
  eq([m.title, m.body, m.url], ['✉ A note from Lina', 'Coffee tomorrow?', '/?owner=1&open=mail#/'], 'opens Mail');
  // Lina posts; your site reads her feed.
  await post_(api, 'friends/refresh');
  from = got.length;
  await fetch(`${BASE2}/admin/api/file?key=thoughts/news.md`, { method: 'PUT', body: `---\ndate: ${at(0.1)}\ntitle: Big news\n---\nWe moved!\n` });
  await post_(api, 'friends/refresh');
  const p = await nextFor(phone, from, 'a friend’s post');
  eq([p.title, p.body, p.url], ['Lina posted', 'Big news', '/?owner=1#/friends'], 'who posted what');
  // (Only once.)
  from = got.length;
  await post_(api, 'friends/refresh');
  await new Promise((r) => setTimeout(r, 1000));
  eq(sentTo(phone, from).length, 0, 'not again');
});

await test('visitors: only if you allow it, only if they ask, only about your new posts', async () => {
  // Off to start with: nobody can sign up.
  eq((await (await fetch(`${BASE}/api/push/key`)).json()).on, false, 'off');
  eq((await fetch(`${BASE}/api/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: visitor.sub }) })).status, 403, 'refused while off');
  eq((await publicData()).notifyPosts, false, 'no bell on the site');
  await post_(api, 'push/settings', { visitors: true });
  eq((await publicData()).notifyPosts, true, 'the bell, now');
  const key = (await (await fetch(`${BASE}/api/push/key`)).json()).key;
  eq(key, (await api('push')).publicKey, 'the site’s key');
  eq((await fetch(`${BASE}/api/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: visitor.sub }) })).status, 200, 'a visitor asks');
  eq((await api('push')).visitorCount, 1, 'counted');
  // A draft and a friends-only post: nothing. A new post: yes.
  let from = got.length;
  await putFile('thoughts/draft.md', `---\ndate: ${at(0)}\ntitle: Not yet\ndraft: true\n---\nShh.\n`);
  await putFile('thoughts/secret.md', `---\ndate: ${at(0)}\ntitle: Just us\nfriends_only: true\n---\nShh.\n`);
  await new Promise((r) => setTimeout(r, 1500));
  eq(sentTo(visitor, from).length, 0, 'not drafts, not friends-only');
  from = got.length;
  await putFile('thoughts/brand-new.md', `---\ndate: ${at(0)}\ntitle: Brand new\n---\nFresh.\n`);
  const m = await nextFor(visitor, from, 'a new post');
  eq([m.title, m.body, m.url], ['Home Corner: A new thought', 'Brand new', '/#/post/thoughts/brand-new'], 'your new post');
  assert(!JSON.stringify(m).includes('Jo') && !JSON.stringify(m).includes('owner'), 'nothing else');
  // Already-there posts were never announced.
  assert(!got.some((g) => g.path === visitor.path && read(visitor, g).body === 'Already here'), 'no back catalogue');
  // Lots of visitors: everyone hears, once each, a round of 25 at a time (Cloudflare's free plan
  // lets one visit to the site make only so many requests out); the next round follows the next
  // save (or the next check, every 20 minutes).
  const crowd = [visitor, ...Array.from({ length: 30 }, (_, i) => device(`crowd-${i}`))];
  for (const c of crowd.slice(1)) eq((await fetch(`${BASE}/api/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: c.sub }) })).status, 200, 'another visitor asks');
  from = got.length;
  await putFile('thoughts/for-everyone.md', `---\ndate: ${at(0)}\ntitle: For everyone\n---\nHello all.\n`);
  const heard = () => crowd.filter((c) => sentTo(c, from).length).length;
  await until(() => heard() >= 25, 'the first round');
  await new Promise((r) => setTimeout(r, 1500));
  eq(heard(), 25, 'one round of 25');
  await putFile('wishlist.md', '- Somewhere sunny\n');
  await until(() => heard() === crowd.length, 'the rest, in the next round');
  await new Promise((r) => setTimeout(r, 1500));
  assert(crowd.every((c) => sentTo(c, from).length === 1 && read(c, sentTo(c, from)[0]).body === 'For everyone'), 'once each, readable by each');
  for (const c of crowd.slice(1)) await fetch(`${BASE}/api/push/unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: c.sub.endpoint }) });
  // They change their mind; or their browser has gone: forgotten.
  await fetch(`${BASE}/api/push/unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: visitor.sub.endpoint }) });
  eq((await api('push')).visitorCount, 0, 'unsubscribed');
  await fetch(`${BASE}/api/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: visitor.sub }) });
  gone.add(visitor.path);
  await putFile('thoughts/another.md', `---\ndate: ${at(0)}\ntitle: Another\n---\nMore.\n`);
  await until(async () => (await api('push')).visitorCount === 0, 'a device that has gone is forgotten');
  await post_(api, 'push/settings', { visitors: false });
});

await test('the Control Panel: Notifications; the 🔔 Notify me button only when you allow it', async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await p.goto(BASE + '/?owner=1#/');
    await p.waitForSelector('.okit-me');
    await p.locator('.okit-me').first().click();
    await p.locator('.okit-menu button', { hasText: 'Control Panel' }).click();
    await p.locator('.cp-item[data-cp="notify"]').click();
    await p.waitForSelector('.nt');
    const text = await p.locator('.nt').textContent();
    assert(text.includes('This device') && text.includes('Tell me about') && text.includes('iPhone') && text.includes('Let visitors ask'), 'all there: ' + text.slice(0, 200));
    eq(await p.locator('.notify-btn').count(), 0, 'no Notify me for you');
    await p.locator('.nt-check', { hasText: 'Let visitors ask' }).locator('input').check();
    await p.waitForFunction(() => /Visitors can ask/.test(document.querySelector('.okit-toast')?.textContent || ''));
    assert(!p.errors.length, p.errors.join('; '));
    // A visitor (on an iPhone, in Safari): the button, and how to use it there.
    const v = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    await v.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await v.goto(BASE + '/#/');
    await v.locator('.notify-btn').click();
    assert((await v.locator('.notify-tip').innerText()).includes('Add to Home Screen'), 'from the Home Screen, on an iPhone');
    await post_(api, 'push/settings', { visitors: false });
    await v.reload();
    await v.waitForSelector('.profile-name');
    eq(await v.locator('.notify-btn').count(), 0, 'gone when you switch it off');
  } finally {
    await browser.close();
  }
});

server.close();
const failed = report();
await close();
process.exit(failed ? 1 : 0);
