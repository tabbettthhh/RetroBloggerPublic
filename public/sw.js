// The site's service worker. It shows notifications, and keeps a copy of the site so it opens
// quickly and can be read with no signal:
// - the page itself: fresh each time (a copy only with no connection, or a very slow one);
// - this update's scripts and styles: kept as they are (each update has new addresses);
// - your posts: shown straight from the copy, then brought up to date (the page hears and
//   redraws if anything changed);
// - photos you've looked at, and the map's pieces: kept and shown at once, and fetched again once
//   they're old (photos after 3 hours for visitors, so a photo you delete is soon gone from their
//   screens; after a day for you, signed in; the map's pieces after a week);
// - nothing from the owner's tools (/admin), ever.
// "Refresh" (in the menus) throws away the kept posts, photos and map pieces.
const PAGES = 'corner-pages-1';
const ASSETS = 'corner-assets-1';
const PHOTOS = 'corner-photos-2';
const TILES = 'corner-tiles-1';
const MAX_PHOTOS = 400;
const MAX_TILES = 800;
const HOUR = 3600e3;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // (Straight away: the page and everything it asks for, so the first visit is enough.)
  e.waitUntil(keepPage().catch(() => {}));
});
self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('corner-') && ![PAGES, ASSETS, PHOTOS, TILES].includes(k)) await caches.delete(k);
      await self.clients.claim();
    })()
  )
);

// Whether it's you, signed in (the site says so), for how long photos are kept.
let owner = null;
async function isOwner() {
  if (owner === null) owner = !!(await caches.match('/__owner', { cacheName: PAGES }));
  return owner;
}
self.addEventListener('message', (e) => {
  const t = e.data?.type;
  if (t === 'owner' || t === 'visitor') {
    owner = t === 'owner';
    e.waitUntil(caches.open(PAGES).then((c) => (owner ? c.put('/__owner', new Response('1')) : c.delete('/__owner'))));
  }
  // Refresh: the kept posts, photos and map pieces thrown away (then the page loads afresh).
  if (t === 'refresh')
    e.waitUntil(
      Promise.all([caches.delete(PHOTOS), caches.delete(TILES), caches.open(PAGES).then((c) => c.delete('/api/all'))]).then(() => e.source?.postMessage({ type: 'refreshed' }))
    );
});

// The page, its posts, and the scripts and styles it names (this update's), keeping only those.
async function keepPage(res = null) {
  const first = !res;
  res ||= await fetch('/', { cache: 'no-cache' });
  if (!res.ok || !(res.headers.get('Content-Type') || '').includes('text/html')) return;
  const html = await res.clone().text();
  const pages = await caches.open(PAGES);
  await pages.put('/', res);
  const wanted = [...new Set([...html.matchAll(/(?:href|src)="(\/v\/[\w-]+\/(?:js|css)\/[\w-]+\.(?:js|css))"/g)].map((m) => m[1]))];
  const id = /\/v\/([\w-]+)\//.exec(wanted[0] || '')?.[1];
  const assets = await caches.open(ASSETS);
  // (Files from an older update aren't needed any more.)
  if (id)
    for (const r of await assets.keys()) {
      const m = /\/v\/([\w-]+)\//.exec(new URL(r.url).pathname);
      if (m && m[1] !== id) await assets.delete(r);
    }
  await Promise.all(wanted.map(async (u) => (await assets.match(u)) || assets.add(u).catch(() => {})));
  // (Afterwards, each time the site fetches your posts, the copy is brought up to date.)
  if (!first) return;
  const all = await fetch('/api/all', { cache: 'no-cache' }).catch(() => null);
  if (all?.ok) await keepPosts(all);
}
// A copy, marked with when it was kept.
function stamped(res, extra = {}) {
  const headers = new Headers(res.headers);
  headers.set('X-Saved', new Date().toISOString());
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  headers.delete('Content-Encoding');
  headers.delete('Content-Length');
  return res.blob().then((b) => new Response(b, { status: 200, headers }));
}
const age = (res) => Date.now() - (Date.parse(res?.headers.get('X-Saved') || '') || 0);
async function keepPosts(res) {
  await (await caches.open(PAGES)).put('/api/all', await stamped(res));
}

const LASTING = /^\/(fonts|vendor|icons|cursors|img)\//;
const TILE_HOST = 'tile.openstreetmap.org';
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.hostname.endsWith(TILE_HOST)) return e.respondWith(tile(req));
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p.startsWith('/admin') || p.startsWith('/cdn-cgi/') || p === '/sw.js') return;
  if (req.mode === 'navigate' && p === '/') return e.respondWith(page(req));
  if (p === '/api/all') return e.respondWith(posts(req));
  if (p.startsWith('/v/')) return e.respondWith(kept(req, ASSETS));
  if (LASTING.test(p)) return e.respondWith(kept(req, ASSETS, true));
  if (p.startsWith('/media/')) return e.respondWith(photo(req));
});

// Fresh from the site; the kept copy only with no connection (or none for 4 seconds).
async function page(req) {
  const fresh = fetch(req).then((res) => {
    if (res.ok) keepPage(res.clone()).catch(() => {});
    return res;
  });
  const slow = new Promise((r) => setTimeout(r, 4000)).then(() => caches.match('/', { cacheName: PAGES }));
  try {
    return (await Promise.race([fresh, slow.then((c) => c || fresh)])) || (await fresh);
  } catch (err) {
    const copy = await caches.match('/', { cacheName: PAGES });
    if (copy) return copy;
    throw err;
  }
}
// Your posts: the kept copy at once, marked as the copy (the page then asks for the site's own
// straight away, and draws it if anything's changed). Asked for fresh: the site's, kept for next
// time. No copy yet: the site's, as it comes. No connection: the copy, marked so the page can
// say so.
async function posts(req) {
  const copy = await caches.match('/api/all', { cacheName: PAGES });
  if (copy && req.cache !== 'no-cache' && req.cache !== 'reload' && age(copy) < 24 * HOUR) {
    const headers = new Headers(copy.headers);
    headers.set('X-Copy', '1');
    return new Response(await copy.blob(), { status: 200, headers });
  }
  try {
    const res = await fetch(req);
    // (What a friend sees on a visit is never kept: only what any visitor sees.)
    if (res.ok && res.status === 200 && !res.headers.get('X-Friend-Visit')) keepPosts(res.clone()).catch(() => {});
    return res;
  } catch (err) {
    if (!copy) throw err;
    return offlineCopy(copy);
  }
}
async function offlineCopy(copy) {
  const headers = new Headers(copy.headers);
  headers.set('X-Offline', copy.headers.get('X-Saved') || '1');
  return new Response(await copy.blob(), { status: 200, headers });
}
// This update's scripts and styles never change: kept, used as they are. (Fonts and the like:
// used as kept, and quietly checked for a newer one.)
async function kept(req, name, refresh = false) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit && !refresh) return hit;
  const fetching = fetch(req).then((res) => {
    if (res.ok && res.status === 200) cache.put(req, res.clone()).catch(() => {});
    return res;
  });
  if (hit) {
    fetching.catch(() => {});
    return hit;
  }
  return fetching;
}
// Photos: kept and shown at once while young enough; then fetched again (a deleted one is gone).
async function photo(req) {
  const cache = await caches.open(PHOTOS);
  const hit = await cache.match(req);
  if (hit && age(hit) < ((await isOwner()) ? 24 * HOUR : 3 * HOUR)) return hit;
  try {
    // (Checked with the site, not the browser's own store: this is when it's due a look.)
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok && res.status === 200) {
      cache.put(req, await stamped(res.clone(), { 'Content-Type': res.headers.get('Content-Type') || 'image/jpeg' })).then(() => trim(cache, MAX_PHOTOS)).catch(() => {});
    } else if (res.status === 404) cache.delete(req).catch(() => {});
    return res;
  } catch (err) {
    if (hit) return hit;
    throw err;
  }
}
// The map's pieces (from OpenStreetMap): kept for a week, so a map you've seen comes up at once.
async function tile(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req);
  if (hit && age(hit) < 7 * 24 * HOUR) return hit;
  try {
    const res = await fetch(req);
    if (res.ok && res.status === 200) cache.put(req, await stamped(res.clone())).then(() => trim(cache, MAX_TILES)).catch(() => {});
    return res;
  } catch (err) {
    if (hit) return hit;
    throw err;
  }
}
const trimming = new Set();
async function trim(cache, max) {
  if (trimming.has(cache)) return;
  trimming.add(cache);
  try {
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(k);
  } finally {
    trimming.delete(cache);
  }
}

self.addEventListener('push', (e) => {
  let m = {};
  try {
    m = e.data ? e.data.json() : {};
  } catch {
    m = { title: e.data?.text() || 'Something new' };
  }
  const url = typeof m.url === 'string' && m.url.startsWith('/') ? m.url : '/';
  e.waitUntil(
    self.registration.showNotification(String(m.title || 'Something new').slice(0, 120), {
      body: String(m.body || '').slice(0, 240),
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: String(m.tag || ''),
      renotify: !!m.tag,
      data: { url }
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const tab = open.find((c) => new URL(c.url).origin === self.location.origin);
      if (tab) {
        await tab.focus();
        // (An open tab goes to the page: a new address with the same start just changes its #.)
        return tab.navigate ? tab.navigate(url).catch(() => tab.postMessage({ type: 'open', url })) : tab.postMessage({ type: 'open', url });
      }
      return self.clients.openWindow(url);
    })()
  );
});
