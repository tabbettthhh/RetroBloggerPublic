// The site's service worker: it only shows notifications (it never stores pages or changes how
// the site loads). A message arrives encrypted from the browser's push service; this shows it,
// and tapping it opens the right page (or brings an open tab to it).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
