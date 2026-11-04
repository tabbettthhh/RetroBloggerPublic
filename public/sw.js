// The site's service worker. It shows notifications, and keeps a copy of the site for reading
// with no signal: the page, its scripts and styles, your posts as last seen, and photos you've
// looked at. Online, everything comes fresh from the site as always (the copy is only used when
// there's no connection). Nothing from the owner's tools (/admin) is ever kept.
const PAGES = 'corner-pages-1';
const ASSETS = 'corner-assets-1';
const PHOTOS = 'corner-photos-1';
const MAX_PHOTOS = 300;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // (Straight away: the page and everything it asks for, so the first visit is enough.)
  e.waitUntil(keepPage().catch(() => {}));
});
self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('corner-') && ![PAGES, ASSETS, PHOTOS].includes(k)) await caches.delete(k);
      await self.clients.claim();
    })()
  )
);

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
  if (id) for (const r of await assets.keys()) {
    const m = /\/v\/([\w-]+)\//.exec(new URL(r.url).pathname);
    if (m && m[1] !== id) await assets.delete(r);
  }
  await Promise.all(wanted.map(async (u) => (await assets.match(u)) || assets.add(u).catch(() => {})));
  // (Afterwards, each time the site fetches your posts, the copy is brought up to date.)
  if (!first) return;
  const all = await fetch('/api/all', { cache: 'no-cache' }).catch(() => null);
  if (all?.ok) await keepPosts(all);
}
// Your posts as last seen, marked with when.
async function keepPosts(res) {
  const headers = new Headers(res.headers);
  headers.set('X-Saved', new Date().toISOString());
  headers.delete('Content-Encoding');
  headers.delete('Content-Length');
  await (await caches.open(PAGES)).put('/api/all', new Response(await res.blob(), { status: 200, headers }));
}

const LASTING = /^\/(fonts|vendor|icons|cursors|img)\//;
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p.startsWith('/admin') || p.startsWith('/cdn-cgi/') || p === '/sw.js') return;
  if (req.mode === 'navigate' && p === '/') return e.respondWith(page(req));
  if (p === '/api/all') return e.respondWith(posts(req));
  if (p.startsWith('/v/')) return e.respondWith(kept(req, ASSETS));
  if (LASTING.test(p)) return e.respondWith(kept(req, ASSETS, true));
  if (p.startsWith('/media/')) return e.respondWith(photo(req));
});

// Fresh from the site; the kept copy only with no connection.
async function page(req) {
  try {
    const res = await fetch(req);
    if (res.ok) keepPage(res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const copy = await caches.match('/', { cacheName: PAGES });
    if (copy) return copy;
    throw err;
  }
}
async function posts(req) {
  try {
    const res = await fetch(req);
    if (res.ok && res.status === 200) keepPosts(res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const copy = await caches.match('/api/all', { cacheName: PAGES });
    if (!copy) throw err;
    // (Marked, so the site can say it's showing what was saved.)
    const headers = new Headers(copy.headers);
    headers.set('X-Offline', copy.headers.get('X-Saved') || '1');
    headers.delete('Content-Encoding');
    headers.delete('Content-Length');
    return new Response(await copy.blob(), { status: 200, headers });
  }
}
// This update's scripts and styles never change: kept, used as they are. (Fonts and the like:
// used as kept, and quietly checked for a newer one.)
async function kept(req, name, refresh = false) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreSearch: false });
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
// Photos: fresh from the site (a deleted one is gone); the kept copy only with no connection.
async function photo(req) {
  try {
    const res = await fetch(req);
    const cache = await caches.open(PHOTOS);
    if (res.ok && res.status === 200) {
      cache.put(req, res.clone()).then(() => trim(cache)).catch(() => {});
    } else if (res.status === 404) cache.delete(req).catch(() => {});
    return res;
  } catch (err) {
    const copy = await caches.match(req, { cacheName: PHOTOS });
    if (copy) return copy;
    throw err;
  }
}
let trimming = false;
async function trim(cache) {
  if (trimming) return;
  trimming = true;
  try {
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_PHOTOS))) await cache.delete(k);
  } finally {
    trimming = false;
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
