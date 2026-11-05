// Notifications, sent to a phone or computer even when the site isn't open (Web Push, the same
// way other apps do it: your site hands a short, encrypted message to the browser's own push
// service, Apple's, Google's or Mozilla's, which wakes the device).
//
// - For you, signed in: comments (and guestbook signatures and suggestions) waiting for you; notes
//   from friends; friends' new posts. Each kind can be switched off. Only a device signed in
//   through Cloudflare Access can sign up (see the /admin/api/push routes).
// - For visitors, only if you switch it on: they can ask to hear when you post something new,
//   and nothing else. Nothing about them is kept but the address their browser gives for it.
//
// Everything lives in your own storage under data/_push (out of your files and the export):
// the site's own key pair (made the first time it's needed), the devices signed up, and your
// choices. Every message is encrypted for the one device it goes to (RFC 8291) and signed with
// the site's key (VAPID, RFC 8292), so the push services can't read it and nobody else can send.

const DIR = 'data/_push/';
const KEYS = DIR + 'vapid.json';
const SETTINGS = DIR + 'settings.json';
const MINE = DIR + 'mine/';
const VISITORS = DIR + 'visitors/';
const ANNOUNCED = DIR + 'announced.json';
const OUTBOX = DIR + 'outbox.json';
export const KINDS = ['comments', 'notes', 'friends', 'email'];
const MAX_MINE = 20;
const MAX_VISITORS = 2000;

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function fromB64url(s) {
  const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
async function sha256Hex(text) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function readJson(env, key, fallback) {
  try {
    const o = await env.CONTENT.get(key);
    return o ? JSON.parse(await o.text()) : fallback;
  } catch {
    return fallback;
  }
}
const putJson = (env, key, v) => env.CONTENT.put(key, JSON.stringify(v), { httpMetadata: { contentType: 'application/json' } });

// ---------- the site's own key pair ----------
async function vapidKeys(env) {
  const kept = await readJson(env, KEYS, null);
  if (kept?.publicKey && kept?.privateJwk) return kept;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const keys = { publicKey: b64url(await crypto.subtle.exportKey('raw', pair.publicKey)), privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey), made: Date.now() };
  await putJson(env, KEYS, keys);
  // (Two visits making the first pair at the same moment: both go on with the one that was kept.)
  return (await readJson(env, KEYS, null)) || keys;
}
export async function publicKey(env) {
  return (await vapidKeys(env)).publicKey;
}

// ---------- your choices ----------
export async function settings(env) {
  const s = await readJson(env, SETTINGS, {});
  const kinds = Object.fromEntries(KINDS.map((k) => [k, s.kinds?.[k] !== false]));
  return { kinds, visitors: s.visitors === true };
}
export async function saveSettings(env, body) {
  const s = await settings(env);
  if (body.kinds && typeof body.kinds === 'object') for (const k of KINDS) if (typeof body.kinds[k] === 'boolean') s.kinds[k] = body.kinds[k];
  if (typeof body.visitors === 'boolean') s.visitors = body.visitors;
  await putJson(env, SETTINGS, s);
  return s;
}

// ---------- devices signed up ----------
// A browser's push address is checked before it's kept: https, at a push service's own address
// (or, testing on your own computer, any local address).
const PUSH_HOSTS = /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.api\.chrome\.google\.com)$/i;
function cleanSub(sub, env) {
  let url;
  try {
    url = new URL(String(sub?.endpoint || ''));
  } catch {
    return null;
  }
  const local = env.DEV_ADMIN === 'true' && url.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(url.hostname);
  if (!local && (url.protocol !== 'https:' || !PUSH_HOSTS.test(url.hostname))) return null;
  const p256dh = String(sub?.keys?.p256dh || '');
  const auth = String(sub?.keys?.auth || '');
  try {
    if (fromB64url(p256dh).length !== 65 || fromB64url(auth).length !== 16) return null;
  } catch {
    return null;
  }
  if (url.href.length > 1000) return null;
  return { endpoint: url.href, keys: { p256dh, auth } };
}
async function subsIn(env, prefix) {
  const out = [];
  let cursor;
  do {
    const page = await env.CONTENT.list({ prefix, cursor, limit: 1000 });
    out.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}
// You, signed in, on this device.
export async function subscribeMine(env, body) {
  const sub = cleanSub(body.subscription, env);
  if (!sub) throw new Error('That device can’t take notifications (its browser gave an address that isn’t a push service).');
  const id = (await sha256Hex(sub.endpoint)).slice(0, 32);
  const all = await subsIn(env, MINE);
  if (all.length >= MAX_MINE && !all.some((o) => o.key === `${MINE}${id}.json`)) throw new Error(`That's ${MAX_MINE} devices already: turn one off first.`);
  await putJson(env, `${MINE}${id}.json`, { ...sub, id, name: String(body.device || '').slice(0, 60), since: Date.now() });
  return { ok: true, id };
}
export async function unsubscribe(env, endpoint, who = 'mine') {
  const id = (await sha256Hex(String(endpoint || ''))).slice(0, 32);
  await env.CONTENT.delete(`${who === 'mine' ? MINE : VISITORS}${id}.json`);
  return { ok: true };
}
export async function myDevices(env) {
  const list = await subsIn(env, MINE);
  const devices = (await Promise.all(list.map((o) => readJson(env, o.key, null)))).filter(Boolean).map(({ id, name, since, endpoint }) => ({ id, name, since, endpoint }));
  return { devices, visitorCount: (await subsIn(env, VISITORS)).length, ...(await settings(env)), publicKey: await publicKey(env) };
}
// A visitor asking to hear when you post (only while you let them).
export async function subscribeVisitor(env, body) {
  if (!(await settings(env)).visitors) return { error: 'Notifications are switched off here.', status: 403 };
  const sub = cleanSub(body.subscription, env);
  if (!sub) return { error: 'This browser can’t take notifications.', status: 400 };
  const id = (await sha256Hex(sub.endpoint)).slice(0, 32);
  const all = await subsIn(env, VISITORS);
  if (all.length >= MAX_VISITORS && !all.some((o) => o.key === `${VISITORS}${id}.json`)) return { error: 'Lots of people already get notified: try again another time.', status: 429 };
  // (Only the address their browser gave, and when: nothing else about them.)
  await putJson(env, `${VISITORS}${id}.json`, { ...sub, since: Date.now() });
  return { ok: true };
}

// ---------- sending ----------
// HKDF (RFC 5869) with SHA-256, as Web Push uses it.
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
const hkdf = async (salt, ikm, info, length) => (await hmac(await hmac(salt, ikm), concat(info, new Uint8Array([1])))).slice(0, length);

// The message, encrypted for one device (RFC 8291, "aes128gcm").
export async function encryptFor(sub, payload) {
  const uaPublic = fromB64url(sub.keys.p256dh);
  const authSecret = fromB64url(sub.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const theirs = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: theirs }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, body);
}
// The site's signature for one push service (VAPID): good for twelve hours.
async function vapidHeader(keys, aud, contact) {
  const head = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: contact })));
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64url(sig)}, k=${keys.publicKey}`;
}
// Sends one message to one device. A device that has gone (unsubscribed, the app removed) is
// forgotten. Returns whether it was taken.
async function sendOne(env, key, sub, message, signed) {
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal', Authorization: await signed(sub.endpoint) },
      body: await encryptFor(sub, JSON.stringify(message)),
      signal: AbortSignal.timeout(8000)
    });
    if (res.status === 404 || res.status === 410) await env.CONTENT.delete(key);
    return res.ok;
  } catch (e) {
    console.error('push', e?.message || e);
    return false;
  }
}
// One message to a list of devices. (The site's key is read once, and signed once for each push
// service, not for every device.)
async function sendList(env, objects, message, contact) {
  if (!objects.length) return 0;
  const keys = await vapidKeys(env);
  const signatures = new Map();
  const signed = (endpoint) => {
    const aud = new URL(endpoint).origin;
    if (!signatures.has(aud)) signatures.set(aud, vapidHeader(keys, aud, contact));
    return signatures.get(aud);
  };
  let sent = 0;
  // (A few at a time.)
  for (let i = 0; i < objects.length; i += 10) {
    const done = await Promise.all(
      objects.slice(i, i + 10).map(async (o) => {
        const sub = await readJson(env, o.key, null);
        return sub ? sendOne(env, o.key, sub, message, signed) : false;
      })
    );
    sent += done.filter(Boolean).length;
  }
  return sent;
}
async function sendAll(env, prefix, message, contact) {
  return sendList(env, await subsIn(env, prefix), message, contact);
}
// Who the push services can ask about these messages: your site's own address.
const contactOf = (origin) => (/^https:\/\//.test(origin || '') ? origin : 'https://example.com');
const short = (s, n = 120) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

// To you, signed in: one of the kinds you've left on.
export async function notifyOwner(env, kind, { title, body = '', url = '/', tag = '' }, origin = '') {
  if (!KINDS.includes(kind)) return 0;
  const s = await settings(env);
  if (!s.kinds[kind]) return 0;
  return sendAll(env, MINE, { title: short(title, 80), body: short(body), url, tag: tag || kind, kind }, contactOf(origin));
}
export async function testMine(env, origin) {
  return sendAll(env, MINE, { title: 'Notifications are on', body: 'This is how they’ll look. Comments, notes and friends’ posts arrive like this.', url: '/?owner=1#/', tag: 'test' }, contactOf(origin));
}

// To visitors who asked: your new posts. Each post is announced once, when it first appears
// (published, or a scheduled one going live); the first time this runs it only notes what's
// already there, so nobody gets your back catalogue.
export async function announcePosts(env, posts, siteName, origin = '') {
  const visible = posts.filter((p) => !p.draft && !p.friends_only && !p.error);
  const ids = visible.map((p) => `${p.type}/${p.slug}`);
  const kept = await readJson(env, ANNOUNCED, null);
  if (!kept) {
    await putJson(env, ANNOUNCED, { ids: ids.slice(0, 500) });
    return 0;
  }
  const known = new Set(kept.ids || []);
  const fresh = visible.filter((p) => !known.has(`${p.type}/${p.slug}`) && Date.now() - (p.ts || 0) < 3 * 24 * 60 * 60 * 1000);
  if (!fresh.length) {
    if (ids.some((id) => !known.has(id))) await putJson(env, ANNOUNCED, { ids: [...new Set([...ids, ...known])].slice(0, 500) });
    return 0;
  }
  await putJson(env, ANNOUNCED, { ids: [...new Set([...ids, ...known])].slice(0, 500) });
  if (!(await settings(env)).visitors) return 0;
  if (!(await subsIn(env, VISITORS)).length) return 0;
  const p = fresh[0];
  const more = fresh.length - 1;
  const href = p.type === 'places' ? `/#/journal/${p.slug}` : ['books', 'films', 'podcasts', 'music', 'tv'].includes(p.type) ? `/#/${p.type}/${p.slug}` : `/#/post/${p.type}/${p.slug}`;
  const WHAT = { thoughts: 'A new thought', places: 'A new place', photos: 'New photos', lists: 'A new list', quotes: 'A new quote', books: 'A new book review', films: 'A new film review', tv: 'A new TV review', podcasts: 'A new podcast review', music: 'A new music review' };
  // (Sent in rounds: see sendOutbox. A newer post's message replaces one still going out.)
  await putJson(env, OUTBOX, { message: { title: `${siteName}: ${WHAT[p.type] || 'Something new'}`, body: short(p.title || p.excerpt || 'Have a look') + (more > 0 ? ` (and ${more} more)` : ''), url: href, tag: 'new-post' }, contact: contactOf(origin), after: '', at: Date.now() });
  return fresh.length;
}

// The message for visitors, sent a round at a time: Cloudflare's free plan lets one visit to
// your site make only 50 requests out, so each round is the next 25 visitors who asked, and the
// rest follow at the next round (straight after a save, and every 20 minutes). Returns how many
// were sent this round.
const PER_ROUND = 25;
export async function sendOutbox(env) {
  const box = await readJson(env, OUTBOX, null);
  if (!box?.message) return 0;
  // (One round at a time: another one under way is left to finish.)
  if (box.busy && Date.now() - box.busy < 60 * 1000) return 0;
  await putJson(env, OUTBOX, { ...box, busy: Date.now() });
  // (What's next, unless a newer message has taken its place meanwhile.)
  const next = async (after) => {
    if ((await readJson(env, OUTBOX, null))?.at !== box.at) return;
    if (after === null) await env.CONTENT.delete(OUTBOX);
    else await putJson(env, OUTBOX, { ...box, after, busy: 0 });
  };
  let page;
  try {
    // (Visitors' notifications switched off since: nobody else gets it.)
    if (!(await settings(env)).visitors) {
      await next(null);
      return 0;
    }
    page = await env.CONTENT.list({ prefix: VISITORS, limit: PER_ROUND, ...(box.after ? { startAfter: box.after } : {}) });
  } catch (e) {
    // (Storage didn't answer: tried again next round.)
    await next(box.after || '').catch(() => {});
    throw e;
  }
  const sent = await sendList(env, page.objects, box.message, box.contact);
  await next(page.truncated && page.objects.length ? page.objects[page.objects.length - 1].key : null);
  return sent;
}
