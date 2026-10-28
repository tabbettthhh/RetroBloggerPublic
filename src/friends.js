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
// - There are no messages: friends only read each other's posts, presence and status.
// - Your site's address is set once (the first time you open Friends). If your site moves to
//   another address (a domain of your own, say), "My site has moved" tells each friend's site,
//   signed with the secret you share; their site checks you really are at the new address
//   before it switches, and still recognises the old one.
// - When something friends see changes (a post published, edited or deleted, your status, a
//   scheduled post going live), your site tells each friend's site straight away, and theirs
//   reads your feed again. Every 10 minutes each site also reads its friends' feeds, in case
//   one was offline when told. Your site keeps a copy of each feed. Their photos are fetched
//   through your own site, so your browser never talks to theirs.
// - Secrets and copies of feeds live under data/_ in your bucket, which the file list, the
//   export and visitors never see.

import { safeMarkdown, buildPost, TYPES, THEME_OPTIONS, KEEPSAKE_SHAPES, THEMES, THEME_CHARMS } from './content.js';
import { cleanCards, OWN_CARD, MIX, cleanMix, cleanSeed } from '../public/js/card-parts.js';

const STORE = 'data/_friends.json';
// A fingerprint of the feed your friends last heard about.
const SENT = 'data/_friendsent';
const MAX_FRIENDS = 40;
const MAX_PHOTOS = 12;
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
    // What your site's visitors see of your friends: their posts and your friends list ("all"),
    // just the list ("list"), or nothing: only you see them, in the back office ("off").
    visibility: VISIBILITY.includes(s.visibility) ? s.visibility : s.showOnSite === false ? 'off' : 'all',
    // Whether friends' sites may show your posts to their visitors (they always see them
    // themselves, in their back office).
    letShare: s.letShare !== false,
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

async function signedFetch(env, store, friend, method, path, payload) {
  const body = payload == null ? '' : JSON.stringify(payload);
  const time = String(Date.now());
  const sig = await signature(friend.secret, method, path, time, body);
  const res = await fetch(friend.url + path, {
    method,
    // (Introduced by the address this friend knows you by, until they've heard you moved.)
    headers: { 'User-Agent': FRIEND_UA, 'X-Friend-From': friend.as || store.me, 'X-Friend-Time': time, 'X-Friend-Sig': sig, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body || undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(8000)
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

// ---------- the public endpoints a friend's site calls ----------

const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

// deps: { buildEverything, mediaForFriend, changed, waitUntil }
export async function friendsApi(request, env, path, deps) {
  const method = request.method;
  const body = method === 'POST' ? await request.text() : '';
  if (body.length > 20000) return reply({ error: 'Too big.' }, 413);
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
    const data = await deps.buildEverything(env);
    return reply({ ...friendFeed(data, store.me || new URL(request.url).origin), share: store.letShare });
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
const NOT_SENT = new Set(['body', 'files', 'key', 'error', 'extra', 'html', 'excerpt', 'draft', 'photos', 'captions', 'comments']);
function fullPost(p) {
  const base = TYPES.includes(p.type) ? blank(p.type) : {};
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (NOT_SENT.has(k) || JSON.stringify(v) === JSON.stringify(base[k])) continue;
    out[k] = v;
  }
  return out;
}
export function friendFeed(data, origin) {
  const site = data.site;
  const link = (p) => origin + (p.type === 'places' ? `/#/journal/${p.slug}` : ['books', 'films', 'podcasts', 'music', 'tv'].includes(p.type) ? `/#/${p.type}/${p.slug}` : `/#/post/${p.type}/${p.slug}`);
  return {
    v: FEED_VERSION,
    name: site.name,
    owner: site.owner,
    presence: site.presence,
    status: site.status,
    status_updated: site.status_updated,
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

// Tidies a feed from a friend's site before keeping it: plain values only, sizes capped.
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
        await env.CONTENT.put(`data/_friendcache/${friend.key}.json`, JSON.stringify({ at, ok: true, feed }));
        names[friend.key] = { name: feed.name, owner: feed.owner };
        reached++;
      } catch (e) {
        const old = await env.CONTENT.get(`data/_friendcache/${friend.key}.json`);
        const prev = old ? JSON.parse(await old.text()) : {};
        await env.CONTENT.put(`data/_friendcache/${friend.key}.json`, JSON.stringify({ ...prev, tried: at, ok: false, error: String(e.message || e).slice(0, 120) }));
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
  const data = await buildEverything(env);
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
  return { me: store.me, here, behind, visibility: store.visibility, letShare: store.letShare, friends, code: codeText(store), codeOff: store.codeOff };
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
    const ok = await fetch(to + '/robots.txt').then((r) => (r.ok ? r.text() : ''), () => '');
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

// What visitors see of your friends, and whether your friends' sites may show your posts.
// (showOnSite: true/false is the older way of saying "all" or "off".)
export async function setFriendSettings(env, body) {
  const store = await loadFriends(env);
  if (VISIBILITY.includes(body.visibility)) store.visibility = body.visibility;
  else if (typeof body.showOnSite === 'boolean') store.visibility = body.showOnSite ? 'all' : 'off';
  if (typeof body.letShare === 'boolean') store.letShare = body.letShare;
  delete store.showOnSite;
  await saveFriends(env, store);
  // (Friends' sites hear about a change to letShare at once: see shareNews.)
  return { visibility: store.visibility, letShare: store.letShare };
}
// A friend's posts can go on your site only if you show posts and they've said yes.
const postsShown = (store, feed) => store.visibility === 'all' && feed?.share !== false;

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

// For your site's visitors (unless you've turned it off): your buddies' names, presence and
// status, and their latest posts as one feed, newest first. Their photos go through your own
// site (see friendPhotoForVisitor), as the site only ever loads pictures from itself.
export async function publicFriends(env) {
  const store = await loadFriends(env);
  if (store.visibility === 'off' || !store.friends.length) return { buddies: [], posts: [], looks: {}, postsShown: store.visibility === 'all' };
  const caches = await Promise.all(store.friends.map((f) => readCache(env, f.key)));
  const buddies = [];
  const posts = [];
  const keepsakes = [];
  const categories = [];
  // Each friend's post cards, once (their posts name theirs as f0, f1…).
  const looks = {};
  store.friends.forEach((f, i) => {
    const c = caches[i];
    const feed = c?.feed;
    const fresh = c && c.ok !== false && Date.now() - (c.at || 0) < 3 * 60 * 60 * 1000;
    const who = { name: feed?.name || f.name, owner: feed?.owner || f.owner, url: f.url };
    buddies.push({ ...who, presence: fresh ? feed?.presence || 'online' : 'offline', status: feed?.status || '' });
    if (!postsShown(store, feed)) return;
    keepsakes.push(...(feed?.keepsakes || []));
    categories.push(...(feed?.categories || []));
    const look = feed?.cards_look ? `f${i}` : '';
    if (look) looks[look] = feed.cards_look;
    const from = look ? { ...who, look } : who;
    for (const p of feed?.posts || []) {
      const photos = p.photos.map((k) => `/friends-media/${encodeURIComponent(f.key)}/${k.split('/').map(encodeURIComponent).join('/')}`);
      // (In full: drawn as it looks on their site, with these photos and their own writing.)
      const full = p.full ? { ...p.full, title: words(p.title), date: words(p.date), ts: p.ts, html: p.html, excerpt: p.excerpt, photos, captions: p.captions || [] } : null;
      // (A card of their own making, from a site that didn't send its cards: the theme's here.)
      if (full && !look && OWN_CARD.test(full.card || '')) full.card = '';
      posts.push({ ...p, friend: from, photos, full });
    }
  });
  posts.sort((a, b) => b.ts - a.ts);
  return { buddies, posts: posts.slice(0, 60), keepsakes, categories, looks, postsShown: store.visibility === 'all' };
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
// the feed you're showing, fetched from your friend's site by yours.
export async function friendPhotoForVisitor(env, key, photoKey) {
  const store = await loadFriends(env);
  const friend = store.friends.find((f) => f.key === key);
  const cached = friend ? (await readCache(env, key))?.feed : null;
  const feed = postsShown(store, cached) ? cached : null;
  if (!feed || !(feed.posts || []).some((p) => p.photos.includes(photoKey))) return new Response('Not found', { status: 404 });
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
