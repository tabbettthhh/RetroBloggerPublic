// Refresh: everything fresh from the site, the page loaded again. (Any copy an older version kept
// for reading with no signal is thrown away first.)
export async function refreshSite() {
  try {
    for (const k of (await window.caches?.keys()) || []) if (k.startsWith('corner-')) await caches.delete(k);
  } catch {}
  location.reload();
}
