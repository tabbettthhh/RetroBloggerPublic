// Refresh: everything fresh from the site. The copy kept for quick opening and for reading with
// no signal (posts, photos, the map's pieces: see sw.js) is thrown away, then the page loads again.
export function refreshSite() {
  const sw = navigator.serviceWorker?.controller;
  if (!sw) return location.reload();
  navigator.serviceWorker.addEventListener('message', (e) => e.data?.type === 'refreshed' && location.reload());
  sw.postMessage({ type: 'refresh' });
  // (In case the service worker doesn't answer.)
  setTimeout(() => location.reload(), 2500);
}
// Tell the service worker whether this is the site's owner, signed in (photos are kept longer).
export function tellWho(owner) {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: owner ? 'owner' : 'visitor' });
  } catch {}
}
