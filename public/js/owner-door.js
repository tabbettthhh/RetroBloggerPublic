// The way in for the site's owner. Visitors never get further than this little file: the owner's
// tools live behind the back office's lock (/admin/owner.js), so they're only ever downloaded by
// someone Cloudflare Access has let in.
//
// Signing in: the owner's tile on the welcome screen goes to /admin/signin, Access asks who you
// are, and you come back to the site with ?owner=1. From then on this browser remembers to ask
// (quietly, once a visit) whether you're still signed in, and if you are, owner mode switches on.
const store = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
const HINT = 'owner';
const hinted = () => {
  try {
    return store?.getItem(HINT) === '1';
  } catch {
    return false;
  }
};
export function forgetOwner() {
  try {
    store?.removeItem(HINT);
  } catch {}
}

// Arriving from the sign-in: remember it, skip the welcome screen, and tidy the address.
export function ownerArrival() {
  const url = new URL(location.href);
  if (url.searchParams.get('owner') !== '1') return false;
  try {
    store?.setItem(HINT, '1');
    sessionStorage.setItem('entered', '1');
  } catch {}
  url.searchParams.delete('owner');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  return true;
}

// What the owner's tools are told about the site, and can ask it to do.
export const ownerHooks = { fresh: null, holding: null, trying: null };

// Signed in? Then the owner's tools come in. (Never inside the back office's own preview frame.)
export async function openOwnerDoor(site) {
  if (window.parent !== window || !hinted()) return;
  let r;
  try {
    // A sign-in that has run out answers with a redirect to Cloudflare's login page: don't follow it.
    r = await fetch('/admin/api/me', { credentials: 'same-origin', redirect: 'manual', cache: 'no-store' });
  } catch {
    return;
  }
  const signedIn = r.ok && r.type !== 'opaqueredirect' && (r.headers.get('Content-Type') || '').includes('application/json');
  if (!signedIn) {
    // Not signed in any more: the owner's tile on the welcome screen signs you in again. (A site
    // whose lock isn't set up forgets you entirely.)
    if (r.status === 401 || r.status === 403) forgetOwner();
    return;
  }
  try {
    const { startOwner } = await import('/admin/owner.js');
    await startOwner(site);
  } catch (e) {
    console.error('Owner mode could not start', e);
  }
}
