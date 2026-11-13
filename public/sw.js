// The notifications worker: it shows the notifications this site sends (new comments, a friend's
// post…) and opens the right page when one is tapped. It keeps no copy of the site: everything
// always comes fresh from the site. (An older version kept one for reading with no signal; that
// copy is thrown away here the first time this version runs.)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('corner-')) await caches.delete(k);
      await self.clients.claim();
    })()
  );
});

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
