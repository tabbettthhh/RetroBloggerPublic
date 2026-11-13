// Friends: other people running their own copy of this site, whose posts you follow.
//
// How it fits together:
// - Two sites become friends with a friend code: your site's address and a secret. It doesn't
//   expire and any number of friends can use it, until you switch it off or make a new one.
//   A friend pastes it into their back office, their site says hello to yours (signed with the
//   code's secret), and your site gives that friendship a secret of its own, so no friend can
//   pass as another.
// - Every request between friends is signed with it (an HMAC of the method, path, time and
//   body), so only a friend can read your friend feed or post to your inbox, and nobody can
//   pretend to be them. Requests more than five minutes old are refused.
// - Notes between friends (mail) go only to the friend they're for, kept on their site for them alone.
// - Your site's address is set once (the first time you open Friends). If your site moves to
//   another address (a domain of your own, say), "My site has moved" tells each friend's site,
//   signed with the secret you share; their site checks you really are at the new address
//   before it switches, and still recognises the old one.
// - When something friends see changes (a post published, edited or deleted, your status, a
//   scheduled post going live), your site tells each friend's site straight away, and theirs
//   reads your feed again. Every 20 minutes each site also reads its friends' feeds, in case
//   one was offline when told. Your site keeps a copy of each feed. Their photos are fetched
//   through your own site, so your browser never talks to theirs.
// - Secrets and copies of feeds live under data/_ in your bucket, which the file list, the
//   export and visitors never see.

import * as push from './push.js';
import { safeMarkdown, buildPost, photoOfDay, TYPES, THEME_OPTIONS, KEEPSAKE_SHAPES, THEMES, THEME_CHARMS } from './content.js';
import { cleanCards, OWN_CARD, MIX, cleanMix, cleanSeed } from '../public/js/card-parts.js';

const STORE = 'data/_friends.json';
// A fingerprint of the feed your friends last heard about.
const SENT = 'data/_friendsent';
const MAX_FRIENDS = 40;
const MAX_PHOTOS = 12;
// The newest comments on each post that go with it to friends' sites.
const MAX_COMMENTS = 40;
const SKEW = 5 * 60 * 1000;
export const FRIEND_UA = 'MyCorner-Friends/1 (a friend site, following)';
// 2: each post also comes in full (keepsakes, memories, flair and all), with your own keepsake
// designs and place categories, so a friend's site can show it as it looks on yours.
export const FEED_VERSION = 2;

// ---------- small helpers ----------

const enc = new TextEncoder();
function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const randomSecret = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
async function sha256(text) {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signature(secret, method, pathAndQuery, time, body) {
  const msg = `${method.toUpperCase()}\n${pathAndQuery}\n${time}\n${await sha256(body || '')}`;
  return b64url(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(msg)));
}
async function signatureOk(secret, method, pathAndQuery, time, body, sig) {
  try {
    const msg = `${method.toUpperCase()}\n${pathAndQuery}\n${time}\n${await sha256(body || '')}`;
    return await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(sig), enc.encode(msg));
  } catch {
    return false;
  }
}
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
// A photo of a friend's post is named "type/post/file.jpg", nothing more.
const photoKeyOk = (k) => typeof k === 'string' && k.length <= 200 && /^[a-z]+\/[^/\\]+\/[^/\\]+\.(jpe?g|png|webp|gif)$/i.test(k) && !k.includes('..');
const PRESENCE = ['online', 'away', 'brb', 'lunch', 'busy', 'offline'];

// A friend's site address, tidied to its origin. Only https on the open internet; plain http
// and localhost only while testing on your own computer.
export function siteOrigin(value, env) {
  let u;
  try {
    u = new URL(String(value || '').trim());
  } catch {
    return null;
  }
  const dev = env.DEV_ADMIN === 'true';
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (dev && local && u.protocol === 'http:') return u.origin;
  if (u.protocol !== 'https:' || local || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.hostname.includes(':') || !u.hostname.includes('.')) return null;
  if (u.username || u.password) return null;
  return u.origin;
}
// A short, file-safe name for a friend, from their address.
export const friendKey = (origin) => origin.replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]+/gi, '_').slice(0, 80);

// ---------- the store ----------

export async function loadFriends(env) {
  let s = {};
  try {
    const obj = await env.CONTENT.get(STORE);
    if (obj) s = JSON.parse(await obj.text());
  } catch {}
  return {
    me: s.me || '',
    // Who sees your friends list (on About, and the buddies on Friends), and who sees their posts
    // (the Friends tab and their photos of the day): "everyone", "friends" (your friends, visiting
    // your site with Visit) or just "me", signed in. (Older sites said it in one: see fromOld.)
    ...seenFrom(s),
    // Whether their posts are mixed into your Home feed while you're signed in (only you see that).
    inHome: s.inHome !== false,
    // Whether friends' sites may show your posts to their visitors (they always see them
    // themselves, signed in on their own site).
    letShare: s.letShare !== false,
    // Whether friends may knock on your door (see receiveKnock).
    knocks: s.knocks !== false,
    friends: Array.isArray(s.friends) ? s.friends : [],
    // Your friend code's secret (none while it's switched off).
    code: s.code && typeof s.code.secret === 'string' ? s.code : null,
    codeOff: !!s.codeOff,
    // Codes made before codes lasted: each still works once.
    invites: Array.isArray(s.invites) ? s.invites.filter((i) => !i.used) : []
  };
}
export async function saveFriends(env, store) {
  await env.CONTENT.put(STORE, JSON.stringify(store));
}
export const VISIBILITY = ['all', 'list', 'off'];
// Who may see something, widest first: everyone, your friends (visiting), or only you.
export const SEEN = ['everyone', 'friends', 'me'];
// (The older one setting: their posts and the list ("all"), just the list ("list"), or neither.)
const fromOld = (v) => ({ listSeen: v === 'off' ? 'me' : 'everyone', postsSeen: v === 'all' ? 'everyone' : 'me' });
function seenFrom(s) {
  const old = fromOld(VISIBILITY.includes(s.visibility) ? s.visibility : s.showOnSite === true ? 'all' : 'off');
  return { listSeen: SEEN.includes(s.listSeen) ? s.listSeen : old.listSeen, postsSeen: SEEN.includes(s.postsSeen) ? s.postsSeen : old.postsSeen };
}
// Whether someone sees what's kept to `level`: who is "everyone", "friends" or "me".
const sees = (level, who) => SEEN.indexOf(level) <= SEEN.indexOf(who);
// Your site's own address, as your friends know it: taken from the back office the first time,
// then kept (opening the back office at another address doesn't change it; moving does).
export async function rememberMe(env, origin) {
  const store = await loadFriends(env);
  if (!store.me) {
    store.me = origin;
    await saveFriends(env, store);
  }
  return store;
}

// ---------- talking to a friend's site ----------

async function signedFetch(env, store, friend, method, path, payload, wait = 8000) {
  const body = payload == null ? '' : JSON.stringify(payload);
  const time = String(Date.now());
  const sig = await signature(friend.secret, method, path, time, body);
  const res = await fetch(friend.url + path, {
    method,
    // (Introduced by the address this friend knows you by, until they've heard you moved.)
    headers: { 'User-Agent': FRIEND_UA, 'X-Friend-From': friend.as || store.me, 'X-Friend-Time': time, 'X-Friend-Sig': sig, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body || undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(wait)
  });
  return res;
}

// Checks a request from a friend's site: who it says it's from, that it's recent, and that it
// was signed with the secret you share. Returns the friend, or null.
async function verify(request, env, store, body, secrets) {
  const from = siteOrigin(request.headers.get('X-Friend-From'), env);
  const time = request.headers.get('X-Friend-Time') || '';
  const sig = request.headers.get('X-Friend-Sig') || '';
  if (!from || !/^\d{10,16}$/.test(time) || Math.abs(Date.now() - Number(time)) > SKEW || !sig) return null;
  const url = new URL(request.url);
  const pq = url.pathname + url.search;
  // (A friend who has moved is still recognised by their old address.)
  const candidates = secrets ? secrets : store.friends.filter((f) => f.url === from || (f.aliases || []).includes(from));
  for (const c of candidates) if (await signatureOk(c.secret, request.method, pq, time, body, sig)) return { ...c, from };
  return null;
}

// ---------- strolling between streets ----------
// Your street, as anyone may see it: just the houses your Friends tab already shows a visitor
// (names, addresses, lights on or off), never more. Another site's neighbourhood asks for it when
// someone strolls over from theirs.
export async function street(env, site) {
  const pals = await publicFriends(env, { viewer: 'everyone' }).catch(() => ({ buddies: [] }));
  return { v: 1, name: clipText(site.name, 60), owner: clipText(site.owner, 60), houses: pals.buddies.slice(0, STREET_MAX).map((b) => ({ name: clipText(b.name, 60), owner: clipText(b.owner, 60), url: b.url, presence: b.presence === 'offline' ? 'offline' : 'online' })) };
}
const STREET_MAX = 24;
const clipText = (v, n) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
// Another site's street, fetched for a stroll, and trimmed to what a street holds: nothing else
// they sent gets through. Null when there's no way there (no such site, or one that hasn't got
// streets yet).
export async function fetchStreet(env, origin) {
  const res = await fetch(origin + '/api/street', { headers: { 'User-Agent': FRIEND_UA, Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!res || !res.ok || !/json/.test(res.headers.get('Content-Type') || '')) return null;
  const text = await res.text().catch(() => '');
  if (!text || text.length > 60000) return null;
  let s;
  try {
    s = JSON.parse(text);
  } catch {
    return null;
  }
  if (!s || typeof s !== 'object' || !Array.isArray(s.houses)) return null;
  const seen = new Set();
  const houses = [];
  for (const h of s.houses.slice(0, STREET_MAX)) {
    const url = siteOrigin(h?.url, env);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    houses.push({ name: clipText(h.name, 60) || new URL(url).hostname, owner: clipText(h.owner, 60), url, presence: h.presence === 'offline' ? 'offline' : 'online' });
  }
  return { name: clipText(s.name, 60) || new URL(origin).hostname, owner: clipText(s.owner, 60), url: origin, houses };
}

// ---------- the public endpoints a friend's site calls ----------

const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

// deps: { buildEverything, mediaForFriend, friendComment, changed, news, waitUntil }
export async function friendsApi(request, env, path, deps) {
  const method = request.method;
  const body = method === 'POST' ? await request.text() : '';
  // (A photo for a shared album is bigger than anything else a friend's site sends.)
  if (body.length > (path === '/api/friends/album' ? 6_000_000 : 20000)) return reply({ error: 'Too big.' }, 413);
  const store = await loadFriends(env);

  // A friend pasted your code: their site says hello, signed with the secret in it.
  if (path === '/api/friends/hello' && method === 'POST') {
    const who = await verify(request, env, store, body, [...(store.code ? [store.code] : []), ...store.invites]);
    if (!who) return reply({ error: 'That friend code isn’t working (it may have been switched off or replaced): ask your friend for their current one.' }, 403);
    if (store.friends.length >= MAX_FRIENDS && !store.friends.some((f) => f.url === who.from)) return reply({ error: 'This site has as many friends as it can keep.' }, 409);
    let info = {};
    try {
      info = JSON.parse(body);
    } catch {}
    // The friendship's own secret, sent back to their site. (A site from before this change
    // doesn't ask for one, and keeps using the code's.)
    const secret = info.v >= 2 ? randomSecret() : who.secret;
    const invite = store.invites.find((i) => i.secret === who.secret);
    if (invite) invite.used = true;
    store.invites = store.invites.filter((i) => !i.used);
    store.friends = store.friends.filter((f) => f.url !== who.from);
    store.friends.push({ url: who.from, key: friendKey(who.from), secret, as: store.me, name: clean(info.name, 60) || who.from, owner: clean(info.owner, 60), since: Date.now() });
    await saveFriends(env, store);
    const data = await deps.buildEverything(env);
    return reply({ ok: true, name: data.site.name, owner: data.site.owner, ...(info.v >= 2 ? { secret, me: store.me } : {}) });
  }

  const friend = await verify(request, env, store, body);
  if (!friend) return reply({ error: 'Not a friend of this site.' }, 403);

  // Your friend feed: who you are, how you are, and your recent posts.
  if (path === '/api/friends/feed' && method === 'GET') {
    const data = await deps.buildEverything(env, { forFriends: true });
    // (And today's photo of the day, for their reel: the very one your own site shows friends today.)
    const day = photoOfDay(data.posts, env.TIMEZONE || 'Europe/London');
    let photo = '';
    try {
      photo = day ? decodeURIComponent(day.src.slice('/media/'.length)) : '';
    } catch {}
    return reply({ ...friendFeed(data, store.me || new URL(request.url).origin, friend), share: store.letShare, photo_day: photo ? { id: day.post, photo, cap: day.cap, friends_only: day.friends_only } : null });
  }

  // A friend about to visit your site in their browser: a one-time pass for it (see acceptPass).
  if (path === '/api/friends/pass' && method === 'POST') {
    const ticket = randomSecret();
    await env.CONTENT.put(`${PASSES}${ticket}.json`, JSON.stringify({ k: friend.key, exp: Date.now() + PASS_TTL }), { httpMetadata: { contentType: 'application/json' } });
    return reply({ ticket, ttl: PASS_TTL });
  }

  // They've moved: check they really are at the new address (their site there must answer,
  // signed with the secret you share), then follow them there, still recognising the old one.
  if (path === '/api/friends/moved' && method === 'POST') {
    let info = {};
    try {
      info = JSON.parse(body);
    } catch {}
    const to = siteOrigin(info.to, env);
    if (!to) return reply({ error: 'That new address can’t be used.' }, 400);
    const f = store.friends.find((x) => x.key === friend.key);
    if (to !== f.url) {
      const there = await signedFetch(env, store, { ...f, url: to }, 'GET', '/api/friends/feed').then((r) => r.ok, () => false);
      if (!there) return reply({ error: 'Couldn’t find your site at the new address yet.' }, 409);
      f.aliases = [...new Set([...(f.aliases || []), f.url])].filter((a) => a !== to).slice(-5);
      f.url = to;
      await saveFriends(env, store);
    }
    return reply({ ok: true });
  }

  // They unfriended you: forget them too.
  if (path === '/api/friends/bye' && method === 'POST') {
    store.friends = store.friends.filter((f) => f.url !== friend.url);
    await saveFriends(env, store);
    await env.CONTENT.delete(`data/_friendcache/${friend.key}.json`);
    return reply({ ok: true });
  }

  // A friend changed something (like whether you may show their posts): read their feed again.
  // (It answers at once and reads their feed in the background, so their site never gives up
  // waiting while yours reads theirs.)
  if (path === '/api/friends/changed' && method === 'POST') {
    const work = refreshFriends(env, friend.key)
      .then(() => deps.changed?.())
      .catch((e) => console.error(e));
    if (deps.waitUntil) deps.waitUntil(work);
    else await work;
    return reply({ ok: true });
  }

  // A friend commenting on one of your posts, from their own site: it goes straight on (they're
  // your friend), under their name, linking to their site. (deps.friendComment keeps it.)
  // A note from a friend ("You've got mail!"): kept for you, and nobody else, to read signed in.
  if (path === '/api/friends/note' && method === 'POST') {
    let info = {};
    try {
      info = JSON.parse(body);
    } catch {}
    const f = store.friends.find((x) => x.key === friend.key) || friend;
    const out = await receiveNote(env, f, info);
    return reply(out.ok ? { ok: true } : { error: out.error }, out.status || 200);
  }

  // A knock on your door, from a friend at their own site: kept for you alone (see receiveKnock).
  if (path === '/api/friends/knock' && method === 'POST') {
    const f = store.friends.find((x) => x.key === friend.key) || friend;
    const out = await receiveKnock(env, store, f);
    return reply(out.ok ? { ok: true } : { error: out.error }, out.status || 200);
  }

  if (path === '/api/friends/comment' && method === 'POST' && deps.friendComment) {
    let info = {};
    try {
      info = JSON.parse(body);
    } catch {}
    const f = store.friends.find((x) => x.key === friend.key) || friend;
    const out = await deps.friendComment({ name: clean(f.owner || f.name, 40) || f.url, site: f.url }, { post: clean(info.post, 160), message: String(info.message ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, 1000), reply_to: clean(info.reply_to, 41) });
    // (Your site shows it at once, and your friends' sites hear: it's in your feed for them too.)
    if (out.ok && deps.waitUntil) deps.waitUntil(Promise.resolve(deps.changed?.()).then(() => deps.news?.()).catch(() => {}));
    return reply(out.ok ? { ok: true } : { error: out.error }, out.status || 200);
  }

  // A ♥, a ☆, a smile or an emoji on one of your posts, from a friend on their own site.
  if (path === '/api/friends/react' && method === 'POST' && deps.react) {
    let info = {};
    try {
      info = JSON.parse(body);
    } catch {}
    const out = await deps.react({ post: info.post, kind: info.kind, emoji: info.emoji, undo: info.undo === true });
    return reply(out.body, out.status || 200);
  }

  // A photo for one of your shared albums, from a friend it's shared with.
  if (path === '/api/friends/album' && method === 'POST' && deps.albumPhoto) {
    let info = {};
    try {
      info = JSON.parse(body);
    } catch {}
    const f = store.friends.find((x) => x.key === friend.key) || friend;
    const out = await deps.albumPhoto({ ...f, me: store.me }, info);
    if (out.ok && deps.waitUntil) deps.waitUntil(Promise.resolve(deps.news?.()).catch(() => {}));
    return reply(out.ok ? { ok: true } : { error: out.error }, out.status || 200);
  }

  // A photo from one of your published posts, for a friend's site to show.
  if (path === '/api/friends/media' && method === 'GET') {
    const key = new URL(request.url).searchParams.get('key') || '';
    return deps.mediaForFriend(key);
  }

  return reply({ error: 'Not found' }, 404);
}

// What a friend's site gets: your name and status, and your latest posts (newest first).
// The parts of a post a friend's site can show it with, as it looks on yours: everything but
// what's already sent on its own (or never leaves your site), and nothing left at its default.
const NOT_SENT = new Set(['body', 'files', 'key', 'error', 'extra', 'html', 'excerpt', 'draft', 'photos', 'captions', 'comments', 'with', 'album_with', 'album']);
function fullPost(p) {
  const base = TYPES.includes(p.type) ? blank(p.type) : {};
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (NOT_SENT.has(k) || JSON.stringify(v) === JSON.stringify(base[k])) continue;
    out[k] = v;
  }
  return out;
}
// `to`: the friend it's for (whether they may add photos to an album depends on who's asking;
// none: every friend's, to tell when anything's changed).
export function friendFeed(data, origin, to = null) {
  const mayAdd = (p) => (to ? (p.album_with || []).some((u) => u === to.url || u === to.from || (to.aliases || []).includes(u)) : (p.album_with || []).join(' '));
  const site = data.site;
  const link = (p) => origin + (p.type === 'places' ? `/#/journal/${p.slug}` : ['books', 'films', 'podcasts', 'music', 'tv'].includes(p.type) ? `/#/${p.type}/${p.slug}` : `/#/post/${p.type}/${p.slug}`);
  return {
    v: FEED_VERSION,
    name: site.name,
    owner: site.owner,
    presence: site.presence,
    status: site.status,
    status_updated: site.status_updated,
    // (Whether friends can comment on your posts: only while comments are on.)
    comments_on: !!site.comments,
    // Your best score in the arcade (none while there's nothing posted for friends to see).
    arcade: data.posts.length && data.arcade?.scores?.[0] ? { best: data.arcade.scores[0].score, date: data.arcade.scores[0].date } : null,
    posts: data.posts.slice(0, 30).map((p) => ({
      id: `${p.type}/${p.slug}`,
      type: p.type,
      title: p.title || '',
      excerpt: p.excerpt || '',
      text: String(p.body || '').slice(0, 4000),
      date: p.date,
      ts: p.ts,
      city: p.city || '',
      creator: p.creator || '',
      rating: p.rating ?? null,
      friends_only: !!p.friends_only,
      // Who it's with (friends' sites), and whether this friend may add photos to it.
      with: p.with || [],
      album_open: mayAdd(p),
      // Its ♥, ☆, smiles and emoji, so a friend can add theirs. (Left out of what tells your
      // friends something's changed: a reaction alone isn't news.)
      ...(to ? { reactions: site.reactions === false ? null : p.reactions || {} } : {}),
      // The comments on it that are on your site, so a friend can see the conversation (and join in).
      comments: (p.comments || []).slice(-MAX_COMMENTS).map((c) => ({ id: c.id, name: c.name, date: c.date, message: c.message, reply: c.reply || '', reply_to: c.reply_to || '', site: c.site || '' })),
      // Your own photos only (as "type/post/file"), fetched through the friend's own site.
      photos: (p.photos || [])
        .filter((u) => String(u).startsWith('/media/'))
        .slice(0, MAX_PHOTOS)
        .map((u) => {
          try {
            return decodeURIComponent(String(u).slice('/media/'.length));
          } catch {
            return '';
          }
        })
        .filter(Boolean),
      captions: (p.captions || []).slice(0, MAX_PHOTOS),
      full: fullPost(p),
      url: link(p)
    })),
    // Your own keepsake designs (their pictures stay on your site) and place categories.
    keepsakes: (data.keepsakes?.custom || []).map(({ picture, ...d }) => d),
    // How your post cards look: the card you chose (or your mix), your colours and charm, and the
    // cards you've made, so your posts wear them on your friends' sites too.
    cards_look: cardLook(data.theme),
    categories: data.categories || []
  };
}

// ---------- your side: following, refreshing, sending ----------

// ---------- a friend's post in full, made safe ----------
// A friend's site sends each post in full, so yours can show it as it looks on theirs. It's
// rebuilt here on your own site's idea of a post: only the parts your site knows, each the
// kind of value it should be (text, a number, a list…), sizes capped. Text can't carry markup
// (the few characters that could are swapped for look-alikes), photos come through your own
// site, and the writing is turned into HTML by your own site's cleaner.
const BLANK = {};
const blank = (type) => (BLANK[type] ||= buildPost(type, `${type}/x.md`, '', 'Europe/London'));
const LOOKALIKE = { '<': '‹', '>': '›', '"': '”', "'": '’' };
const words = (v, n = 2000) => String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>"']/g, (c) => LOOKALIKE[c]).slice(0, n);
const KEY = /^[a-z0-9][a-z0-9_-]{0,40}$/i;
// Any plain value, a few levels deep.
function plain(v, depth = 0) {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return words(v);
  if (depth > 3 || typeof v !== 'object') return undefined;
  if (Array.isArray(v)) return v.slice(0, 60).map((x) => plain(x, depth + 1)).filter((x) => x !== undefined);
  const out = {};
  for (const [k, x] of Object.entries(v).slice(0, 80)) {
    const y = KEY.test(k) ? plain(x, depth + 1) : undefined;
    if (y !== undefined) out[k] = y;
  }
  return out;
}
// A value shaped like `def`, your site's own default for that part of a post. (Where that's
// "nothing yet", it's a number or a list, or for a memory, a date.)
const DATE_ONLY = /^\d{4}(-\d{2}(-\d{2})?)?$/;
function fit(def, v, key) {
  if (v === undefined) return def;
  if (def === null) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (Array.isArray(v)) return plain(v);
    return key === 'memory' && typeof v === 'string' && DATE_ONLY.test(v) ? v : null;
  }
  if (v === null) return Array.isArray(def) ? [] : def && typeof def === 'object' ? {} : typeof def === 'string' ? '' : typeof def === 'boolean' ? false : null;
  const kind = (x) => (Array.isArray(x) ? 'list' : x === null ? 'any' : typeof x);
  const want = kind(def);
  const got = kind(v);
  if (want !== 'any' && want !== got) return def;
  return plain(v) ?? def;
}
const FONTS = new Set(THEME_OPTIONS.font);
// A friend's own keepsake design, named after them so it can't stand in for one of yours.
const designId = (friend, id) => `${friend.key}~${id}`;
function fullFrom(p, friend, id) {
  const type = TYPES.includes(p.type) ? p.type : null;
  if (!type || !p.full || typeof p.full !== 'object' || Array.isArray(p.full)) return null;
  const base = blank(type);
  const out = {};
  for (const k of Object.keys(base)) {
    if (NOT_SENT.has(k) || k === 'type' || k === 'slug') continue;
    out[k] = fit(base[k], p.full[k], k);
  }
  const ck = out.custom_keepsakes && typeof out.custom_keepsakes === 'object' ? out.custom_keepsakes : {};
  out.custom_keepsakes = Object.fromEntries(Object.entries(ck).filter(([, lines]) => Array.isArray(lines)).slice(0, 20).map(([k, lines]) => [designId(friend, k), lines]));
  if (!FONTS.has(out.font)) out.font = '';
  // (A card of their own making is drawn from their cards_look; see publicFriends.)
  if (!OWN_CARD.test(out.card) && !THEME_OPTIONS.card_style.includes(out.card)) out.card = '';
  out.category = /^[a-z0-9-]{0,30}$/.test(out.category) ? out.category : '';
  out.slug = (/^[a-z0-9][a-z0-9._-]{0,120}$/i.test(String(p.full.slug || '')) ? String(p.full.slug) : id.split('/')[1] || 'post').slice(0, 120);
  out.type = type;
  return out;
}
function designsFrom(list, friend) {
  const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? String(v).toLowerCase() : '');
  return (Array.isArray(list) ? list : [])
    .slice(0, 60)
    .filter((d) => d && typeof d === 'object' && /^[a-z0-9][a-z0-9-]{0,29}$/.test(String(d.id || '')))
    .map((d) => ({ id: designId(friend, d.id), name: clean(d.name, 40) && words(clean(d.name, 40)), heading: words(clean(d.heading, 30)), sub: words(clean(d.sub, 50)), shape: KEEPSAKE_SHAPES.includes(d.shape) ? d.shape : 'ticket', paper: hex(d.paper), ink: hex(d.ink), accent: hex(d.accent), picture: '', types: [], prices: !!d.prices }))
    .filter((d) => d.name);
}
function categoriesFrom(list) {
  return (Array.isArray(list) ? list : [])
    .slice(0, 60)
    .filter((c) => c && /^[a-z0-9-]{1,30}$/.test(String(c.key || '')))
    .map((c) => ({ key: c.key, label: words(clean(c.label, 30)) || c.key, color: /^#[0-9a-f]{6}$/i.test(String(c.color || '')) ? c.color : '' }));
}

// The part of a theme that dresses post cards: the theme, its colours and charm, the card for
// every post (or "mix", with the designs in it and the shuffle), and cards of your own. Only
// known choices and plain colours; the same on the way out and on the way in.
export function cardLook(theme) {
  const t = theme && typeof theme === 'object' ? theme : {};
  const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? String(v).toLowerCase() : '');
  const out = { theme: THEMES.includes(t.theme) ? t.theme : 'classic' };
  for (const k of ['main', 'accent']) if (hex(t[k])) out[k] = hex(t[k]);
  if (THEME_CHARMS.includes(t.decoration)) out.decoration = t.decoration;
  const cards = cleanCards(t.cards, THEME_OPTIONS.title_font);
  if (cards.length) out.cards = cards;
  if (t.card_style === MIX || THEME_OPTIONS.card_style.includes(t.card_style) || cards.some((c) => c.id === t.card_style)) out.card_style = t.card_style;
  const mix = cleanMix(t.card_mix, THEME_OPTIONS.card_style, cards);
  if (mix.length) out.card_mix = mix;
  if (cleanSeed(t.card_seed)) out.card_seed = cleanSeed(t.card_seed);
  return out;
}

// A comment on a friend's post, as their site sends it: plain text only, sizes capped.
const COMMENT_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,40}$/;
function tidyComment(c) {
  return {
    id: COMMENT_ID.test(String(c?.id || '')) ? String(c.id) : '',
    name: clean(c?.name, 60),
    date: clean(c?.date, 20),
    message: clean(c?.message, 1000),
    reply: clean(c?.reply, 1000),
    reply_to: COMMENT_ID.test(String(c?.reply_to || '')) ? String(c.reply_to) : '',
    site: linkOrigin(c?.site)
  };
}
// (Just a site's address, shown as a link: http or https only.)
function linkOrigin(v) {
  try {
    const u = new URL(String(v || ''));
    return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.origin : '';
  } catch {
    return '';
  }
}

// A post's reaction counts, from a friend's site (null: they have reactions off).
function tidyReactions(r) {
  if (!r || typeof r !== 'object') return null;
  const n = (v) => Math.max(0, Math.min(1e6, Math.floor(Number(v) || 0)));
  const custom = Object.fromEntries(
    Object.entries(r.custom && typeof r.custom === 'object' ? r.custom : {})
      .filter(([e, v]) => typeof e === 'string' && e.length <= 16 && /\p{Extended_Pictographic}/u.test(e) && !/[\s<>&"']/.test(e) && n(v) > 0)
      .slice(0, 30)
      .map(([e, v]) => [e, n(v)])
  );
  return { heart: n(r.heart), star: n(r.star), grin: n(r.grin), ...(Object.keys(custom).length ? { custom } : {}) };
}

// Where a post of theirs is on their site, from its name ("places/x" → "/#/journal/x").
function postPath(id) {
  const [type, slug] = String(id).split('/');
  return type === 'places' ? `/#/journal/${slug}` : ['books', 'films', 'podcasts', 'music', 'tv'].includes(type) ? `/#/${type}/${slug}` : `/#/post/${type}/${slug}`;
}
// Their photo of the day (a photo of one of their posts, by its name, and its caption).
function tidyDay(d) {
  if (!d || typeof d !== 'object' || !photoKeyOk(d.photo) || !/^[a-z]+\/[^/\\]{1,100}$/.test(String(d.id || ''))) return null;
  return { id: clean(d.id, 120), photo: d.photo, cap: clean(d.cap, 200), friends_only: d.friends_only === true };
}

// Tidies a feed from a friend's site before keeping it: plain values only, sizes capped.
function tidyArcade(a) {
  const best = Math.floor(Number(a?.best));
  if (!Number.isFinite(best) || best < 1 || best > 9999999) return null;
  return { best, date: /^\d{4}-\d{2}-\d{2}$/.test(a?.date) ? a.date : '' };
}
export function tidyFeed(f, friend) {
  const posts = (Array.isArray(f?.posts) ? f.posts : []).slice(0, 30).map((p) => ({
    id: clean(p.id, 120),
    type: clean(p.type, 12),
    title: clean(p.title, 140),
    excerpt: clean(p.excerpt, 300),
    // Turned into HTML here, by your own site's cleaner, never taken as HTML from theirs.
    // (Any HTML they wrote is shown as text, and the back office lets through plain formatting only.)
    // (Links only to web pages and email: anything else loses its link, here and again in the browser.)
    html: safeMarkdown(String(p.text ?? '').slice(0, 4000).replace(/&/g, '&amp;').replace(/</g, '&lt;')).replace(/<a href="(?!https?:\/\/|mailto:)[^"]*"/gi, '<a'),
    date: clean(p.date, 20),
    ts: Number(p.ts) || 0,
    city: clean(p.city, 60),
    creator: clean(p.creator, 80),
    rating: Number.isFinite(+p.rating) && p.rating !== null ? Math.max(0, Math.min(10, +p.rating)) : null,
    friends_only: !!p.friends_only,
    with: (Array.isArray(p.with) ? p.with : []).slice(0, 12).map(linkOrigin).filter(Boolean),
    album_open: p.album_open === true && p.type === 'photos',
    reactions: tidyReactions(p.reactions),
    comments: (Array.isArray(p.comments) ? p.comments : []).slice(-MAX_COMMENTS).map(tidyComment).filter((c) => c.id && c.message),
    photos: (Array.isArray(p.photos) ? p.photos : []).map((k) => clean(k, 200)).filter(photoKeyOk).slice(0, MAX_PHOTOS),
    captions: (Array.isArray(p.captions) ? p.captions : []).slice(0, MAX_PHOTOS).map((c) => words(clean(c, 200))),
    full: fullFrom(p, friend, clean(p.id, 120)),
    url: String(p.url || '').startsWith(friend.url + '/') ? clean(p.url, 300) : friend.url
  }));
  return {
    name: clean(f?.name, 60) || friend.name,
    owner: clean(f?.owner, 60),
    presence: PRESENCE.includes(f?.presence) ? f.presence : 'online',
    status: clean(f?.status, 200),
    status_updated: Number(f?.status_updated) || null,
    // (Whether they let you show their posts to your visitors.)
    share: f?.share !== false,
    // (Their photo of the day, for your Friends reel.)
    photo_day: tidyDay(f?.photo_day),
    // (Their best score in the arcade.)
    arcade: tidyArcade(f?.arcade),
    // (Whether you can comment on their posts: a site new enough, with comments on.)
    comments_on: f?.comments_on === true,
    posts,
    keepsakes: designsFrom(f?.keepsakes, friend),
    categories: categoriesFrom(f?.categories),
    // (Their post cards, from a site new enough to send them.)
    cards_look: f?.cards_look && typeof f.cards_look === 'object' && !Array.isArray(f.cards_look) ? cardLook(f.cards_look) : null
  };
}

// Reads every friend's feed now and keeps a copy. Returns how many it reached.
export async function refreshFriends(env, only) {
  const store = await loadFriends(env);
  if (!store.me) return { reached: 0, of: 0 };
  let reached = 0;
  const names = {};
  const list = only ? store.friends.filter((f) => f.key === only) : store.friends;
  await Promise.all(
    list.map(async (friend) => {
      const at = Date.now();
      try {
        const res = await signedFetch(env, store, friend, 'GET', '/api/friends/feed');
        if (!res.ok) throw new Error('status ' + res.status);
        const feed = tidyFeed(await res.json(), friend);
        // (What you'd already seen of theirs, to tell you about anything new.)
        const before = await readCache(env, friend.key);
        await env.CONTENT.put(`data/_friendcache/${friend.key}.json`, JSON.stringify({ at, ok: true, feed }));
        if (before?.feed) {
          const seen = new Set((before.feed.posts || []).map((p) => p.id));
          const fresh = feed.posts.filter((p) => !seen.has(p.id) && Date.now() - (p.ts || 0) < 2 * 24 * 60 * 60 * 1000);
          const who = feed.owner || feed.name || friend.name;
          if (fresh.length) {
            const p = fresh[0];
            await push.notifyOwner(env, 'friends', { title: `${who} posted${fresh.length > 1 ? ` ${fresh.length} new things` : ''}`, body: p.title || p.excerpt || 'Have a look', url: '/?owner=1#/friends', tag: `friend-${friend.key}` }, store.me).catch(() => {});
          }
          // Tagged in one of theirs (or asked to add photos to their album) since last time.
          const was = new Map((before.feed.posts || []).map((p) => [p.id, p]));
          const me = [store.me, friend.as].filter(Boolean);
          const tagged = feed.posts.find((p) => p.with.some((u) => me.includes(u)) && !(was.get(p.id)?.with || []).some((u) => me.includes(u)));
          const album = feed.posts.find((p) => p.album_open && !was.get(p.id)?.album_open);
          if (tagged || album) {
            const p = tagged || album;
            await push.notifyOwner(env, 'friends', { title: tagged ? `🏷 ${who} tagged you` : `📷 ${who} shared an album with you`, body: (p.title || p.excerpt || 'Have a look') + (album && !tagged ? ': add your photos' : ''), url: '/?owner=1#/friends', tag: `friend-tag-${friend.key}` }, store.me).catch(() => {});
          }
        }
        names[friend.key] = { name: feed.name, owner: feed.owner };
        reached++;
      } catch (e) {
        // (Their last good copy is kept, marked as not reached this time. Noting that is a nicety:
        // it never stops the other friends' feeds being read.)
        try {
          const prev = (await readCache(env, friend.key)) || {};
          await env.CONTENT.put(`data/_friendcache/${friend.key}.json`, JSON.stringify({ ...prev, tried: at, ok: false, error: String(e?.message || e).slice(0, 120) }));
        } catch (e2) {
          console.error('friend cache', e2?.message || e2);
        }
      }
    })
  );
  // Their names, kept up to date. Read afresh first: friends added or settings changed while
  // their feeds were being read are kept, not overwritten.
  const latest = await loadFriends(env);
  let rename = false;
  for (const f of latest.friends) {
    const n = names[f.key];
    if (n && (n.name !== f.name || n.owner !== f.owner)) Object.assign(f, n), (rename = true);
  }
  if (rename) await saveFriends(env, latest);
  return { reached, of: list.length };
}

// Tells your friends' sites when something they see has changed (a post published, edited or
// deleted, a scheduled one going live, your status, whether they may show your posts), so they
// read your feed straight away instead of at their next check. Nothing is sent when nothing
// they see has changed. Returns how many friends' sites heard.
export async function shareNews(env, buildEverything) {
  const store = await loadFriends(env);
  if (!store.me || !store.friends.length) return { told: 0, of: 0 };
  const data = await buildEverything(env, { forFriends: true });
  const mark = await sha256(JSON.stringify({ ...friendFeed(data, store.me), share: store.letShare }));
  const before = await env.CONTENT.get(SENT).then((o) => (o ? o.text() : ''), () => '');
  if (before === mark) return { told: 0, of: store.friends.length };
  await env.CONTENT.put(SENT, mark);
  const sent = await Promise.allSettled(store.friends.map((f) => signedFetch(env, store, f, 'POST', '/api/friends/changed', {}).then((r) => r.ok)));
  return { told: sent.filter((r) => r.status === 'fulfilled' && r.value).length, of: store.friends.length };
}

// Everything the back office shows: your friends, each with the latest copy of their feed.
export async function friendsOverview(env, here = '') {
  const store = await loadFriends(env);
  const friends = await Promise.all(
    store.friends.map(async (f) => {
      let cache = null;
      try {
        const obj = await env.CONTENT.get(`data/_friendcache/${f.key}.json`);
        if (obj) cache = JSON.parse(await obj.text());
      } catch {}
      return { url: f.url, key: f.key, name: cache?.feed?.name || f.name, owner: cache?.feed?.owner || f.owner, since: f.since, aliases: f.aliases || [], cache };
    })
  );
  // Friends who still know you by an old address (they couldn't be told you moved).
  const behind = store.friends.filter((f) => f.as && f.as !== store.me).map((f) => f.name);
  return { me: store.me, here, behind, listSeen: store.listSeen, postsSeen: store.postsSeen, letShare: store.letShare, inHome: store.inHome, knocks: store.knocks, friends, code: codeText(store), codeOff: store.codeOff };
}

const codeText = (store) => (store.code && store.me ? 'MYCORNER-' + b64url(enc.encode(JSON.stringify({ u: store.me, s: store.code.secret }))) : null);

// Your friend code: the same one every time, for as many friends as you like. "new" replaces
// it (the old one stops working; friends you have stay friends), "off" switches it off and
// "on" switches it back on with a new one.
export async function friendCode(env, action = 'get') {
  const store = await loadFriends(env);
  if (action === 'off') Object.assign(store, { code: null, codeOff: true });
  else if (action === 'new' || action === 'on' || (!store.code && !store.codeOff)) Object.assign(store, { code: { secret: randomSecret(), created: Date.now() }, codeOff: false });
  await saveFriends(env, store);
  return { code: codeText(store), codeOff: store.codeOff };
}

// You pasted a friend's code: say hello to their site with it, and keep them as a friend.
export async function useInvite(env, code, self) {
  const store = await loadFriends(env);
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(fromB64url(String(code).trim().replace(/^MYCORNER-/, ''))));
  } catch {
    throw new Error('That doesn’t look like a friend code. Copy the whole thing, starting MYCORNER-.');
  }
  const url = siteOrigin(parsed.u, env);
  if (!url || typeof parsed.s !== 'string' || parsed.s.length < 20) throw new Error('That friend code is not complete.');
  if (url === store.me) throw new Error('That’s your own friend code: send it to a friend instead.');
  if (store.friends.length >= MAX_FRIENDS) throw new Error('You have as many friends as this site can keep.');
  const friend = { url, key: friendKey(url), secret: parsed.s };
  let res;
  try {
    res = await signedFetch(env, store, friend, 'POST', '/api/friends/hello', { v: 2, name: self.name, owner: self.owner });
  } catch {
    throw new Error('Couldn’t reach your friend’s site. Check it’s online and try again.');
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'Their site said no to that code.');
  // Their site gives the friendship a secret of its own (an older site keeps the code's).
  if (typeof out.secret === 'string' && out.secret.length >= 20) friend.secret = out.secret;
  // A code from before their site moved: follow them at the address they use now (once it's
  // checked they really are there), still recognising the old one.
  const now = siteOrigin(out.me, env);
  if (now && now !== url && now !== store.me) {
    const there = await signedFetch(env, store, { ...friend, url: now }, 'GET', '/api/friends/feed').then((r) => r.ok, () => false);
    if (there) Object.assign(friend, { url: now, key: friendKey(now), aliases: [url] });
  }
  store.friends = store.friends.filter((f) => ![url, friend.url].includes(f.url) && !(f.aliases || []).some((a) => [url, friend.url].includes(a)));
  store.friends.push({ ...friend, as: store.me, name: clean(out.name, 60) || url, owner: clean(out.owner, 60), since: Date.now() });
  await saveFriends(env, store);
  await refreshFriends(env, friend.key);
  return { name: clean(out.name, 60) || url };
}

// Your site has moved: set its new address and tell every friend's site.
export async function moveSite(env, address) {
  const store = await loadFriends(env);
  const to = siteOrigin(address, env);
  if (!to) throw new Error('That address can’t be used: it needs to start https:// and be your site’s address on the internet.');
  // Visitors at your old address get sent to the new one, so make sure it really is this site.
  if (to.startsWith('https:')) {
    const ok = await fetch(to + '/robots.txt', { signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.text() : ''), () => '');
    if (!ok.includes('Disallow: /admin')) throw new Error(`Your site doesn’t answer at ${to} yet. Add it as a Custom Domain first (Workers & Pages › your site › Settings › Domains & Routes), wait a few minutes, then try again.`);
  }
  for (const f of store.friends) f.as ||= store.me;
  store.me = to;
  await saveFriends(env, store);
  return tellFriends(env);
}
// Tells the friends who still know you by an old address where you are now.
export async function tellFriends(env) {
  const store = await loadFriends(env);
  const told = [];
  const failed = [];
  for (const f of store.friends) {
    if (!f.as || f.as === store.me) continue;
    try {
      const res = await signedFetch(env, store, f, 'POST', '/api/friends/moved', { to: store.me });
      if (!res.ok) throw new Error();
      f.as = store.me;
      told.push(f.name);
    } catch {
      failed.push(f.name);
    }
  }
  await saveFriends(env, store);
  return { address: store.me, told, failed };
}

export async function removeFriend(env, key) {
  const store = await loadFriends(env);
  const friend = store.friends.find((f) => f.key === key);
  if (!friend) return;
  try {
    await signedFetch(env, store, friend, 'POST', '/api/friends/bye', {});
  } catch {}
  store.friends = store.friends.filter((f) => f.key !== key);
  await saveFriends(env, store);
  await env.CONTENT.delete(`data/_friendcache/${key}.json`);
}

// You, commenting on a friend's post: sent to their site, signed, where it goes straight on.
// Then their feed is read again, so you see it there too.
export async function commentOnFriend(env, key, body) {
  const store = await loadFriends(env);
  const friend = store.friends.find((f) => f.key === key);
  if (!friend) throw new Error('That friend isn’t on your list any more.');
  const message = String(body.message ?? '').trim().slice(0, 1000);
  if (message.length < 2) throw new Error('Write a comment first.');
  let res;
  try {
    res = await signedFetch(env, store, friend, 'POST', '/api/friends/comment', { post: String(body.post || '').slice(0, 160), message, reply_to: String(body.reply_to || '').slice(0, 41) });
  } catch {
    throw new Error('Couldn’t reach their site just now. Try again in a moment.');
  }
  const out = await res.json().catch(() => ({}));
  if (res.status === 404 && !out.error) throw new Error('Their site needs updating before it can take comments from friends.');
  if (!res.ok) throw new Error(out.error === 'Not found' ? 'Their site needs updating before it can take comments from friends.' : out.error || 'Their site didn’t take that comment.');
  await refreshFriends(env, key);
  return { ok: true };
}

// You, reacting to a friend's post: sent to their site, and their new counts kept in your copy
// of their feed (so it shows straight away).
export async function reactTo(env, key, body) {
  const store = await loadFriends(env);
  const friend = store.friends.find((f) => f.key === key);
  if (!friend) throw new Error('That friend isn’t on your list any more.');
  const post = String(body.post || '').slice(0, 160);
  let res;
  try {
    res = await signedFetch(env, store, friend, 'POST', '/api/friends/react', { post, kind: String(body.kind || '').slice(0, 10), emoji: String(body.emoji || '').slice(0, 16), undo: body.undo === true });
  } catch {
    throw new Error('Couldn’t reach their site just now. Try again in a moment.');
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error === 'Not found' ? 'Their site needs updating before it can take reactions from friends.' : out.error || 'Their site didn’t take that.');
  const counts = tidyReactions(out.counts) || {};
  const at = `data/_friendcache/${friend.key}.json`;
  try {
    const cache = JSON.parse((await env.CONTENT.get(at).then((o) => o?.text())) || 'null');
    const p = cache?.feed?.posts?.find((x) => x.id === post);
    if (p) {
      p.reactions = counts;
      await env.CONTENT.put(at, JSON.stringify(cache), { httpMetadata: { contentType: 'application/json' } });
    }
  } catch {}
  return { ok: true, counts };
}

// You, adding a photo to a friend's shared album: sent to their site (it's cleaned and kept
// there), then their feed is read again so you see it.
export async function addToAlbum(env, key, body) {
  const store = await loadFriends(env);
  const friend = store.friends.find((f) => f.key === key);
  if (!friend) throw new Error('That friend isn’t on your list any more.');
  const photo = String(body.photo || '');
  if (!photo || photo.length > 5_600_000 || !/^[A-Za-z0-9+/=]+$/.test(photo)) throw new Error('Photos need to be under 4 MB.');
  let res;
  try {
    res = await signedFetch(env, store, friend, 'POST', '/api/friends/album', { post: String(body.post || '').slice(0, 160), photo, caption: String(body.caption ?? '').slice(0, 200) }, 25000);
  } catch {
    throw new Error('Couldn’t reach their site just now. Try again in a moment.');
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error === 'Not found' ? 'Their site needs updating before it can take photos from friends.' : out.error || 'Their site didn’t take that photo.');
  if (body.last) await refreshFriends(env, key).catch(() => {});
  return { ok: true };
}

// ---------- visiting a friend's site, as a friend ----------
// Friendship is between the two sites, so a friend opening your site in their browser arrives
// like any visitor. To see what's for friends there, they tap "Visit as a friend" on their own
// site: it asks yours (signed) for a one-time pass, and their browser opens your site with it.
// Your site swaps the pass for a cookie (in that browser, for this site only, signed, for a day),
// and while it's good they see what your friends see. Visitors without one see the site as ever,
// with no hint of anything more. Unfriending them ends it at once.
const PASSES = 'data/_passes/';
const PASS_TTL = 90 * 1000;
const VISIT = 24 * 60 * 60 * 1000;
const COOKIE = 'corner_friend';
async function visitKey(env) {
  const key = 'data/_friendvisits.json';
  try {
    const s = JSON.parse((await env.CONTENT.get(key).then((o) => o?.text())) || 'null');
    if (s?.secret) return s.secret;
  } catch {}
  const secret = randomSecret();
  await env.CONTENT.put(key, JSON.stringify({ secret }), { httpMetadata: { contentType: 'application/json' } });
  return secret;
}
const cookieOf = (request) => /(?:^|;\s*)corner_friend=([\w.-]{20,400})/.exec(request.headers.get('Cookie') || '')?.[1] || '';
// Arriving with a pass (?friend_pass=…): good once, for a minute and a half. Answers with the
// page again, without the pass in its address, and the cookie set; or null (no pass, or no good).
export async function acceptPass(request, env, url) {
  const ticket = url.searchParams.get('friend_pass') || '';
  const back = new URL(url);
  back.searchParams.delete('friend_pass');
  const away = (cookie) => new Response(null, { status: 303, headers: { Location: back.pathname + (back.search ? back.search + '&' : '?') + 'friendvisit=' + (cookie ? '1' : '0'), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
  if (!/^[\w-]{30,60}$/.test(ticket)) return away('');
  const at = `${PASSES}${ticket}.json`;
  let pass = null;
  try {
    pass = JSON.parse((await env.CONTENT.get(at).then((o) => o?.text())) || 'null');
  } catch {}
  await env.CONTENT.delete(at).catch(() => {});
  const store = await loadFriends(env);
  if (!pass || pass.exp < Date.now() || !store.friends.some((f) => f.key === pass.k)) return away('');
  const body = b64url(enc.encode(JSON.stringify({ k: pass.k, exp: Date.now() + VISIT })));
  const sig = b64url(await crypto.subtle.sign('HMAC', await hmacKey(await visitKey(env)), enc.encode(body)));
  return away(`${COOKIE}=${body}.${sig}; Path=/; Max-Age=${VISIT / 1000}; HttpOnly; Secure; SameSite=Lax`);
}
// The friend visiting, from their cookie (only while it's good, and they're still a friend).
export async function friendVisitor(request, env) {
  const [body, sig] = cookieOf(request).split('.');
  if (!body || !sig) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await hmacKey(await visitKey(env)), fromB64url(sig), enc.encode(body)))) return null;
    const v = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!(v.exp > Date.now())) return null;
    const store = await loadFriends(env);
    const f = store.friends.find((x) => x.key === v.k);
    return f ? { key: f.key, url: f.url, name: f.name, owner: f.owner, until: v.exp } : null;
  } catch {
    return null;
  }
}
// Leaving: the cookie goes.
export const leaveVisit = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
// You, about to visit a friend's site: a pass from it, and where to go with it.
export async function visitPass(env, key) {
  const store = await loadFriends(env);
  const friend = store.friends.find((f) => f.key === key);
  if (!friend) throw new Error('That friend isn’t on your list any more.');
  let res;
  try {
    res = await signedFetch(env, store, friend, 'POST', '/api/friends/pass', {});
  } catch {
    throw new Error('Couldn’t reach their site just now. Try again in a moment.');
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ticket) throw new Error(res.status === 404 || out.error === 'Not found' ? 'Their site needs its next update before you can visit as a friend (it updates itself overnight).' : out.error || 'Their site didn’t give a pass.');
  return { url: `${friend.url}/?friend_pass=${encodeURIComponent(out.ticket)}` };
}

// ---------- notes between friends ("You've got mail!") ----------
// A short note, sent by your site to a friend's, signed like everything else between them. It's
// kept on their site for them alone (never on the site, never sent on), as a small file under
// data/_mail. Your own copy of what you sent is kept too, so you can see the conversation.
const MAIL = 'data/_mail/';
const NOTE_MAX = 600;
const MAIL_KEEP = 300;
const noteText = (v) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, NOTE_MAX);
const noteId = () => `${Date.now().toString(36).padStart(9, '0')}-${b64url(crypto.getRandomValues(new Uint8Array(4)))}`;
async function keepNote(env, note) {
  await env.CONTENT.put(`${MAIL}${note.id}.json`, JSON.stringify(note), { httpMetadata: { contentType: 'application/json' } });
  // Only the newest few hundred are kept.
  const all = await listMail(env);
  for (const old of all.slice(MAIL_KEEP)) await env.CONTENT.delete(old.key);
}
async function listMail(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.CONTENT.list({ prefix: MAIL, cursor, limit: 1000 });
    out.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  // (Ids start with the time, so the newest sort last; newest first here.)
  return out.sort((a, b) => b.key.localeCompare(a.key));
}
async function receiveNote(env, friend, info) {
  const text = noteText(info.text);
  if (text.length < 1) return { error: 'An empty note.', status: 400 };
  // A friend can send plenty, but not a flood: twenty an hour.
  const hour = Date.now() - 60 * 60 * 1000;
  const recent = (await readMail(env, 60)).filter((n) => !n.out && n.friend === friend.key && n.at > hour);
  if (recent.length >= 20) return { error: 'That’s a lot of notes in an hour. Try again later.', status: 429 };
  const name = clean(friend.owner || friend.name, 60) || friend.url;
  await keepNote(env, { id: noteId(), friend: friend.key, name, site: friend.url, text, at: Date.now(), read: false, reply_to: /^[0-9a-z]{9}-[\w-]{4,8}$/.test(String(info.reply_to || '')) ? String(info.reply_to) : '' });
  await push.notifyOwner(env, 'notes', { title: `✉ A note from ${name}`, body: text, url: '/?owner=1&open=mail#/', tag: 'mail' }, (await loadFriends(env)).me).catch(() => {});
  return { ok: true };
}
// (Each note is kept here as it was read, and read again only once it has changed: your mailbox,
// checked every minute or two while the site is open, costs one look at the list of notes.)
const notesRead = new WeakMap();
async function readMail(env, limit = MAIL_KEEP) {
  const keys = (await listMail(env)).slice(0, limit);
  let kept = notesRead.get(env);
  if (!kept) notesRead.set(env, (kept = new Map()));
  const notes = await Promise.all(
    keys.map(async (o) => {
      const had = kept.get(o.key);
      if (had && had.etag === o.etag) return { ...had.note };
      try {
        const note = JSON.parse(await (await env.CONTENT.get(o.key)).text());
        kept.set(o.key, { etag: o.etag, note });
        return { ...note };
      } catch {
        return null;
      }
    })
  );
  // (Only the ones still there are kept.)
  if (limit >= MAIL_KEEP) {
    const now = new Set(keys.map((o) => o.key));
    for (const k of kept.keys()) if (!now.has(k)) kept.delete(k);
  }
  return notes.filter(Boolean);
}
// A knock on the door: a friend, at their own site, knocks on your house in their neighbourhood;
// signed in at yours, your site gives a little shake and says who it was. Nothing is written by
// anyone: only who knocked and when is kept (the last few, for a day), for you alone. You can
// stop taking knocks in Control Panel › Friends.
const KNOCKS = 'data/_knocks.json';
const KNOCK_KEEP = 20;
const KNOCK_GAP = 30 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
async function readKnocks(env) {
  try {
    const o = await env.CONTENT.get(KNOCKS);
    const v = o ? JSON.parse(await o.text()) : [];
    return Array.isArray(v) ? v.filter((k) => k && Date.now() - k.at < DAY_MS) : [];
  } catch {
    return [];
  }
}
async function receiveKnock(env, store, friend) {
  if (store.knocks === false) return { error: 'They’re not answering the door just now.', status: 403 };
  const all = await readKnocks(env);
  if (all.some((k) => k.friend === friend.key && Date.now() - k.at < KNOCK_GAP)) return { error: 'You’ve only just knocked. Give them a moment to get to the door.', status: 429 };
  const name = clean(friend.owner || friend.name, 60) || friend.url;
  const next = [{ friend: friend.key, name, site: friend.url, at: Date.now() }, ...all].slice(0, KNOCK_KEEP);
  await env.CONTENT.put(KNOCKS, JSON.stringify(next), { httpMetadata: { contentType: 'application/json' } });
  await push.notifyOwner(env, 'notes', { title: `🚪 Knock knock! It’s ${name}`, body: 'They knocked on your door.', url: '/?owner=1#/friends', tag: 'knock' }, store.me).catch(() => {});
  return { ok: true };
}
// (Once you've been told who knocked, they're cleared: told once, wherever you're signed in.)
export async function clearKnocks(env) {
  await env.CONTENT.delete(KNOCKS);
  return { ok: true };
}
// You, knocking on a friend's door.
export async function sendKnock(env, key) {
  const store = await loadFriends(env);
  const friend = store.friends.find((f) => f.key === key);
  if (!friend) throw new Error('That friend isn’t on your list any more.');
  let res;
  try {
    res = await signedFetch(env, store, friend, 'POST', '/api/friends/knock', {});
  } catch {
    throw new Error('Couldn’t reach their site just now. Try again in a moment.');
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error === 'Not found' ? 'Their site needs updating before you can knock.' : out.error || 'Nobody came to the door.');
  return { ok: true };
}

// Your mail, for you signed in: every note, newest first, with who it's from (or to).
export async function myMail(env) {
  const store = await loadFriends(env);
  const known = new Map(store.friends.map((f) => [f.key, f]));
  const notes = await readMail(env);
  return {
    notes: notes.map((n) => ({ ...n, still: known.has(n.friend) })),
    unread: notes.filter((n) => !n.out && !n.read).length,
    // (Who's knocked on your door in the last day, newest first; only from friends still on your list.)
    knocks: (await readKnocks(env)).filter((k) => known.has(k.friend)),
    friends: store.friends.map((f) => ({ key: f.key, name: f.owner || f.name, site: f.url }))
  };
}
// You, sending a note to a friend.
export async function sendNote(env, key, body) {
  const store = await loadFriends(env);
  const friend = store.friends.find((f) => f.key === key);
  if (!friend) throw new Error('That friend isn’t on your list any more.');
  const text = noteText(body.text);
  if (!text) throw new Error('Write something first.');
  const reply_to = String(body.reply_to || '').slice(0, 20);
  let res;
  try {
    res = await signedFetch(env, store, friend, 'POST', '/api/friends/note', { text, reply_to });
  } catch {
    throw new Error('Couldn’t reach their site just now. Try again in a moment.');
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error === 'Not found' ? 'Their site needs updating before it can take notes.' : out.error || 'Their site didn’t take that note.');
  await keepNote(env, { id: noteId(), out: true, friend: friend.key, name: friend.owner || friend.name, site: friend.url, text, at: Date.now(), read: true, reply_to });
  return { ok: true };
}
// Marks notes as read (some, or all of them), or deletes one.
export async function markMail(env, ids, read = true) {
  const want = ids === 'all' ? null : new Set((Array.isArray(ids) ? ids : [ids]).map(String));
  for (const n of await readMail(env)) {
    if (n.out || n.read === read || (want && !want.has(n.id))) continue;
    n.read = read;
    await env.CONTENT.put(`${MAIL}${n.id}.json`, JSON.stringify(n), { httpMetadata: { contentType: 'application/json' } });
  }
  return { ok: true };
}
export async function deleteNote(env, id) {
  if (!/^[0-9a-z]{9}-[\w-]{4,8}$/.test(String(id))) throw new Error('No such note.');
  await env.CONTENT.delete(`${MAIL}${id}.json`);
  return { ok: true };
}

// Who sees your friends list and their posts, and whether your friends' sites may show yours.
// (visibility: "all", "list" or "off", and showOnSite: true/false, are the older ways of saying it.)
export async function setFriendSettings(env, body) {
  const store = await loadFriends(env);
  if (VISIBILITY.includes(body.visibility)) Object.assign(store, fromOld(body.visibility));
  else if (typeof body.showOnSite === 'boolean') Object.assign(store, fromOld(body.showOnSite ? 'all' : 'off'));
  if (SEEN.includes(body.listSeen)) store.listSeen = body.listSeen;
  if (SEEN.includes(body.postsSeen)) store.postsSeen = body.postsSeen;
  if (typeof body.letShare === 'boolean') store.letShare = body.letShare;
  if (typeof body.inHome === 'boolean') store.inHome = body.inHome;
  if (typeof body.knocks === 'boolean') store.knocks = body.knocks;
  delete store.showOnSite;
  delete store.visibility;
  await saveFriends(env, store);
  // (Friends' sites hear about a change to letShare at once: see shareNews.)
  return { listSeen: store.listSeen, postsSeen: store.postsSeen, letShare: store.letShare, inHome: store.inHome, knocks: store.knocks };
}
// A friend's posts can go in front of someone on your site only if you show them their posts and
// the friend has said yes to being shown to visitors (your friends, visiting, are visitors too).
const postsShown = (store, feed, who) => who === 'me' || (sees(store.postsSeen, who) && feed?.share !== false);

// A photo from a friend's post, fetched by your site (so your browser never talks to theirs).
export async function friendPhoto(env, key, photoKey) {
  const store = await loadFriends(env);
  const friend = store.friends.find((f) => f.key === key);
  if (!friend || !photoKeyOk(photoKey)) return new Response('Not found', { status: 404 });
  const path = '/api/friends/media?key=' + encodeURIComponent(photoKey);
  const res = await signedFetch(env, store, friend, 'GET', path).catch(() => null);
  const type = res?.headers.get('Content-Type') || '';
  if (!res || !res.ok || !/^image\/(jpeg|png|webp|gif)$/.test(type)) return new Response('Not found', { status: 404 });
  const len = Number(res.headers.get('Content-Length') || 0);
  if (len > 15 * 1024 * 1024) return new Response('Too big', { status: 413 });
  return new Response(res.body, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=10800' } });
}

// For your site's visitors, as far as you show them: your buddies' names, presence and status
// (the list), and their latest posts as one feed, newest first, with each one's photo of the day
// (`days`). Their photos go through your own site (see friendPhotoForVisitor), as the site only
// ever loads pictures from itself. `viewer`: "everyone", or "friends" for a friend visiting.
// `mine`: for you, signed in: everything, whoever else sees it, with friends-only posts and the
// comments on each post (and whether you can add one).
export async function publicFriends(env, { mine = false, viewer = 'everyone' } = {}) {
  const store = await loadFriends(env);
  const who = mine ? 'me' : viewer === 'friends' ? 'friends' : 'everyone';
  const listShown = sees(store.listSeen, who);
  const postsOk = sees(store.postsSeen, who);
  const said = { postsShown: postsOk, inHome: store.inHome, ...(mine ? { me: store.me, listSeen: store.listSeen, postsSeen: store.postsSeen } : {}) };
  if ((!listShown && !postsOk) || !store.friends.length) return { buddies: [], posts: [], days: [], looks: {}, ...said };
  const meToo = [store.me, ...store.friends.map((f) => f.as)].filter(Boolean);
  const caches = await Promise.all(store.friends.map((f) => readCache(env, f.key)));
  const buddies = [];
  const days = [];
  const posts = [];
  const keepsakes = [];
  const categories = [];
  // Each friend's post cards, once (their posts name theirs as f0, f1…).
  const looks = {};
  store.friends.forEach((f, i) => {
    const c = caches[i];
    const feed = c?.feed;
    const fresh = c && c.ok !== false && Date.now() - (c.at || 0) < 3 * 60 * 60 * 1000;
    const person = { name: feed?.name || f.name, owner: feed?.owner || f.owner, url: f.url, ...(mine ? { key: f.key, comments_on: !!feed?.comments_on } : {}) };
    // (Their names, how they are, their status and their best in the arcade: only where the list is shown.)
    if (listShown) buddies.push({ ...person, presence: fresh ? feed?.presence || 'online' : 'offline', status: feed?.status || '', ...(feed?.arcade ? { arcade: feed.arcade } : {}) });
    if (!postsShown(store, feed, who)) return;
    // Their photo of the day, for the line at the top of Friends (a friends-only one just for you).
    const pd = feed?.photo_day;
    if (pd && (mine || !pd.friends_only)) days.push({ ...person, photo_day: { src: `/friends-media/${encodeURIComponent(f.key)}/${pd.photo.split('/').map(encodeURIComponent).join('/')}`, cap: pd.cap, id: pd.id, url: f.url + postPath(pd.id), friends_only: pd.friends_only } });
    keepsakes.push(...(feed?.keepsakes || []));
    categories.push(...(feed?.categories || []));
    const look = feed?.cards_look ? `f${i}` : '';
    if (look) looks[look] = feed.cards_look;
    const from = look ? { ...person, look } : person;
    for (const p of feed?.posts || []) {
      // (Friends-only posts are for you, signed in: never on your site.)
      if (p.friends_only && !mine) continue;
      const photos = p.photos.map((k) => `/friends-media/${encodeURIComponent(f.key)}/${k.split('/').map(encodeURIComponent).join('/')}`);
      // (In full: drawn as it looks on their site, with these photos and their own writing.)
      const full = p.full ? { ...p.full, title: words(p.title), date: words(p.date), ts: p.ts, html: p.html, excerpt: p.excerpt, photos, captions: p.captions || [] } : null;
      // (A card of their own making, from a site that didn't send its cards: the theme's here.)
      if (full && !look && OWN_CARD.test(full.card || '')) full.card = '';
      const { comments, ...rest } = p;
      const { with: withWho, album_open, ...shown } = rest;
      // (Signed in: whether you're tagged in it, and whether you may add photos to it.)
      posts.push({ ...shown, ...(mine ? { comments: comments || [], tagged: (withWho || []).some((u) => meToo.includes(u)), album_open: !!album_open } : {}), friend: from, photos, full });
    }
  });
  posts.sort((a, b) => b.ts - a.ts);
  return { buddies, days, posts: posts.slice(0, 60), keepsakes, categories, looks, ...said };
}

async function readCache(env, key) {
  try {
    const obj = await env.CONTENT.get(`data/_friendcache/${key}.json`);
    return obj ? JSON.parse(await obj.text()) : null;
  } catch {
    return null;
  }
}

// A visitor's browser asking for a photo in your Friends feed: only photos of posts that are in
// the feed you're showing them, fetched from your friend's site by yours. `who`: "everyone",
// "friends" (a friend visiting) or "me" (you, signed in: the photos of every post of theirs).
export async function friendPhotoForVisitor(env, key, photoKey, who = 'everyone') {
  const store = await loadFriends(env);
  const friend = store.friends.find((f) => f.key === key);
  const cached = friend ? (await readCache(env, key))?.feed : null;
  const mine = who === 'me';
  const feed = postsShown(store, cached, SEEN.includes(who) ? who : 'everyone') ? cached : null;
  // (Not a friends-only post's: those are for you, signed in.)
  // (Their photo of the day too, which may be from an older post than the feed carries.)
  const today = feed?.photo_day?.photo === photoKey && (mine || !feed.photo_day.friends_only);
  if (!feed || !(today || (feed.posts || []).some((p) => p.photos.includes(photoKey) && (mine || !p.friends_only)))) return new Response('Not found', { status: 404 });
  return friendPhoto(env, key, photoKey);
}

// For the back office's notifications: your friends' posts from the last fortnight.
export async function friendNotes(env) {
  const store = await loadFriends(env);
  if (!store.friends.length) return { count: 0, posts: [] };
  const since = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const posts = [];
  await Promise.all(
    store.friends.map(async (f) => {
      try {
        const feed = JSON.parse(await (await env.CONTENT.get(`data/_friendcache/${f.key}.json`)).text()).feed;
        // Not their whole back catalogue the day you become friends: only what's recent.
        for (const p of feed?.posts || []) if (p.ts > since && p.ts > (f.since || 0) - 3 * 24 * 60 * 60 * 1000) posts.push({ friend: f.key, name: feed.name || f.name, id: p.id, type: p.type, title: p.title, excerpt: p.excerpt, ts: p.ts });
      } catch {}
    })
  );
  posts.sort((a, b) => b.ts - a.ts);
  return { count: store.friends.length, posts: posts.slice(0, 30) };
}
