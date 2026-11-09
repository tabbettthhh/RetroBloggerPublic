// Starts the site: loads your content once, then shows the phone or desktop layout.
import { h, registerCategories } from './util.js';
import { parseRoute } from './apps.js';
import { registerKeepsakes } from './keepsake-maker.js';
import { renderWelcome, hasEntered, forgetEntered } from './welcome.js';
import { startSky } from './sky.js';
import { startTheme } from './theme.js';
import { applySkin } from './skins.js';
import { sound, setSoundPack } from './sound.js';
import { setTopRoom } from './top-room.js';
import { startBarDecor } from './bar-decor.js';
import { syncRoom } from './cabinet.js';
import { ownerArrival, openOwnerDoor, ownerHooks } from './owner-door.js';
import { reactionsSetting } from './reactions.js';
import { knowFriends } from './extras.js';
import { refreshSite } from './refresh.js';

const root = document.getElementById('app');
const desktopQuery = window.matchMedia('(min-width: 900px) and (pointer: fine)');
const isDesktop = desktopQuery.matches;

async function load() {
  // Fetched early by the page itself (see index.html), so this is usually already here. (A
  // connection that drops for a moment, on a train say, gets two more tries before giving up.)
  for (let tries = 0; ; tries++) {
    try {
      // (Visiting as a friend: always fresh, never the copy kept for opening quickly.)
      const res = await fetch('/api/all', tries || visiting() ? { cache: 'no-cache' } : {});
      if (!res.ok) throw new Error('Could not load');
      const data = await res.json();
      offline(res.headers.get('X-Offline'));
      // (The copy kept for opening quickly: the site's own is asked for straight away.)
      if (res.headers.get('X-Copy')) postsChanged = true;
      return data;
    } catch (e) {
      if (tries >= 2) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (tries + 1)));
    }
  }
}

// A page left open (a tab in the background, or the site saved to a phone's home screen) picks
// up new posts, friends' posts included, when you come back to it, and every few minutes while
// it's showing. (Asking costs almost nothing when there's nothing new.) What's showing is drawn
// again only if something changed, and never while you're scrolled down reading: then the new
// posts are there on your next tap.
function keepFresh(data, redraw) {
  const plain = ({ generated, ...rest }) => JSON.stringify(rest);
  let seen = plain(data);
  let last = Date.now();
  let busy = false;
  const check = async () => {
    if (busy || document.hidden || Date.now() - last < 60000) return;
    busy = true;
    last = Date.now();
    try {
      const res = await fetch('/api/all', { cache: 'no-cache' });
      if (!res.ok) return;
      offline(res.headers.get('X-Offline'));
      const fresh = await res.json();
      const now = plain(fresh);
      if (now === seen) return;
      seen = now;
      for (const k of Object.keys(data)) if (!(k in fresh)) delete data[k];
      Object.assign(data, fresh);
      // (Signed in: your drafts, plans and the rest stay in what's showing.)
      ownerHooks.fresh?.(data);
      registerDesigns(data);
      // (A friend's visit that has just ended, or begun.)
      if (!previewing) visitingBar(data);
      // (Not while the owner is trying on a theme.)
      if (!previewing && !ownerHooks.trying?.()) setSoundPack(applySkin(data.theme).sounds);
      // (Not while the owner is writing in a post: it's drawn again once they're done.)
      if (!ownerHooks.holding?.()) redraw();
    } catch {
    } finally {
      busy = false;
    }
  };
  document.addEventListener('visibilitychange', check);
  window.addEventListener('pageshow', check);
  // (Shown from the kept copy: the site's own, straight away.)
  onPostsChanged = () => {
    postsChanged = false;
    last = 0;
    check();
  };
  if (postsChanged) onPostsChanged();
  window.addEventListener('focus', check);
  setInterval(check, 5 * 60 * 1000);
}
// Whether the reader is at (or near) the top of what's showing, so drawing it again won't move
// anything they're reading.
const nearTop = (el) => [el, ...el.querySelectorAll('*')].every((x) => x.scrollTop < 80) && (document.scrollingElement?.scrollTop || 0) < 80;

// Your place categories and keepsake designs, and your friends' (for drawing their posts as on
// their own sites; yours come first, so a name you both use keeps yours).
function registerDesigns(data) {
  reactionsSetting(data);
  knowFriends(data);
  registerCategories(data.categories);
  registerCategories(data.friendCategories || []);
  registerKeepsakes([...(data.keepsakes?.custom || []), ...(data.friendKeepsakes || [])]);
}

function fail() {
  root.replaceChildren(
    h('div', { class: 'boot-error' }, h('div', { class: 'xp-dialog' }, h('div', { class: 'xp-title' }, h('span', { class: 'xp-title-text' }, 'Connection problem')), h('div', { class: 'xp-dialog-body' }, h('p', null, 'The site could not load its posts. Check your connection and try again.'), h('button', { type: 'button', class: 'xp-btn', onclick: () => location.reload() }, 'Try again'))))
  );
}

// Low-powered phones (2 GB of memory or less) get a lighter site: no generated paper blotches,
// the visa's shimmer stays still, and no fades. (Only Android browsers say how much memory
// they have. The number of processor cores is no guide: iPhones under-report it on purpose,
// for privacy.)
function liteMode() {
  const mem = navigator.deviceMemory;
  if (mem && mem <= 2) document.documentElement.classList.add('lite');
}

// The owner's theme. The last one seen is put on straight away from this browser's memory, so
// a returning visitor doesn't see the classic colours flash first; the site's own setting
// follows a moment later. Inside the back office's preview, the theme being tried is shown.
const skinStore = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
function rememberedSkin() {
  try {
    return JSON.parse(skinStore?.getItem('skin') || 'null');
  } catch {
    return null;
  }
}
let previewing = false;
if (window.parent !== window) {
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== window.parent || e.data?.type !== 'skin-preview') return;
    previewing = true;
    setSoundPack(applySkin(e.data.theme || {}).sounds);
  });
}

// No connection: the site as it was last seen here (kept by the service worker, sw.js), with a
// quiet line saying so, gone as soon as the connection is back.
function offline(since) {
  let bar = document.querySelector('.offline-bar');
  if (!since) return bar?.remove();
  const when = since.length > 8 ? Date.parse(since) : NaN;
  const words = `No connection: showing what was saved${Number.isNaN(when) ? '' : ' ' + new Date(when).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
  if (!bar) bar = document.body.appendChild(h('div', { class: 'offline-bar', role: 'status' }));
  bar.textContent = '📴 ' + words;
}
// Opened from the copy the service worker keeps: the site's own posts are fetched as soon as
// the page is up, and drawn if anything changed.
let postsChanged = false;
let onPostsChanged = null;
// The service worker that keeps that copy (and shows notifications). (Not while the site is being
// tested by a program, unless the test asks: it would get in the way of a test's own requests.)
function keepForOffline() {
  if (!('serviceWorker' in navigator) || (navigator.webdriver && !sessionStorage.getItem('sw-test'))) return;
  const go = () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  if (document.readyState === 'complete') setTimeout(go, 3000);
  else addEventListener('load', () => setTimeout(go, 3000), { once: true });
}
addEventListener('online', () => document.querySelector('.offline-bar') && window.dispatchEvent(new Event('focus')));

// A photo that can't be shown (deleted since the page loaded, or a friend's site not answering)
// leaves a quiet gap instead of a broken-picture icon.
document.addEventListener(
  'error',
  (e) => {
    if (e.target instanceof HTMLImageElement) e.target.classList.add('img-gone');
  },
  true
);
document.addEventListener('load', (e) => e.target instanceof HTMLImageElement && e.target.classList.remove('img-gone'), true);

// ---------- visiting as a friend ----------
// A friend arriving with a pass from their own site (see friends.acceptPass on the server): straight
// in, no welcome screen. While the visit lasts, a small bar says so, with a way to end it.
const VISITING = 'friend-visit';
function visiting() {
  try {
    return localStorage.getItem(VISITING) === '1';
  } catch {
    return false;
  }
}
function friendArrival() {
  const url = new URL(location.href);
  const v = url.searchParams.get('friendvisit');
  if (v === null) return;
  try {
    if (v === '1') {
      localStorage.setItem(VISITING, '1');
      sessionStorage.setItem('entered', '1');
    }
  } catch {}
  url.searchParams.delete('friendvisit');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}
function visitingBar(data) {
  document.querySelector('.visit-bar')?.remove();
  const v = data.friendVisit;
  try {
    if (!v) localStorage.removeItem(VISITING);
    else localStorage.setItem(VISITING, '1');
  } catch {}
  if (!v) return;
  const host = (data.site.owner || data.site.name || '').split(/\s+/)[0];
  const stop = h('button', { type: 'button', class: 'visit-stop' }, 'Stop');
  stop.addEventListener('click', async () => {
    stop.disabled = true;
    await fetch('/api/visiting/leave', { method: 'POST' }).catch(() => {});
    try {
      localStorage.removeItem(VISITING);
    } catch {}
    // (Everything kept from the visit goes, and the site comes back as any visitor sees it.)
    refreshSite();
  });
  document.body.append(
    h(
      'div',
      { class: 'visit-bar', role: 'status' },
      h('span', { class: 'visit-ico', 'aria-hidden': 'true' }, '👥'),
      h('span', null, v.as ? `Hi ${v.as.split(/\s+/)[0]}: ` : '', 'you’re visiting as ', host ? `${host}’s friend` : 'a friend', '.'),
      stop
    )
  );
}

async function main() {
  // Back from signing in as the owner: straight in, no welcome screen.
  ownerArrival();
  friendArrival();
  liteMode();
  startTheme();
  startSky();
  // In the back office's preview, the theme being tried is put on before anything is drawn
  // (so even the menus show it).
  if (window.parent !== window) {
    try {
      const tried = JSON.parse(sessionStorage.getItem('skin-preview') || 'null');
      if (tried) {
        previewing = true;
        setSoundPack(applySkin(tried).sounds);
      }
    } catch {}
  }
  const early = previewing ? null : rememberedSkin();
  if (early) setSoundPack(applySkin(early).sounds);
  document.body.classList.add(isDesktop ? 'mode-desktop' : 'mode-phone');
  let data;
  let layout;
  try {
    // Only the layout this device uses is downloaded: phones never fetch the desktop, its
    // windows and the screensaver, and computers never fetch the phone screens.
    [data, layout] = await Promise.all([load(), isDesktop ? import('./desktop.js') : import('./phone.js')]);
  } catch {
    return fail();
  }
  const { startDesktop } = isDesktop ? layout : {};
  const { renderPhone } = isDesktop ? {} : layout;
  registerDesigns(data);
  if (!previewing) visitingBar(data);
  if (!previewing) {
    setSoundPack(applySkin(data.theme).sounds);
    try {
      skinStore?.setItem('skin', JSON.stringify(data.theme || {}));
    } catch {}
  }
  document.title = data.site.name;
  // (Extra room at the top, opened from a phone's Home Screen.)
  setTopRoom(data.site.top_room);
  // (Bunting and stickers on the apps' top bars.)
  if (!startBarDecor.started) {
    startBarDecor.started = true;
    startBarDecor();
  }
  // The name a phone uses when you add the site to your home screen.
  let appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (!appTitle) {
    appTitle = document.createElement('meta');
    appTitle.name = 'apple-mobile-web-app-title';
    document.head.append(appTitle);
  }
  appTitle.content = data.site.name;

  // The highlights cabinet's room (#/highlights): over everything else while you're in it.
  window.addEventListener('hashchange', (e) => syncRoom(data, location.hash, e.oldURL ? new URL(e.oldURL).hash || '#/' : ''));
  syncRoom(data, location.hash);

  if (isDesktop) {
    const desk = startDesktop(root, data);
    let welcomed = hasEntered();
    const showWelcome = () => {
      const w = renderWelcome(data, () => {
        w.remove();
        welcomed = true;
        desk.welcomeDone();
        if (location.hash === '#/welcome') history.replaceState(null, '', '#/');
      }, { overlay: true });
      document.body.append(w);
      w.querySelector('.visitor-tile')?.focus();
    };
    desk.openDefault(location.hash);
    if (!welcomed || location.hash === '#/welcome') showWelcome();
    else desk.welcomeDone();
    window.addEventListener('hashchange', () => {
      if (location.hash === '#/welcome') {
        forgetEntered();
        showWelcome();
        return;
      }
      desk.open(location.hash);
    });
    if (!previewing) keepFresh(data, () => desk.refresh());
    openOwnerDoor({ data, desktop: true, redraw: () => desk.refresh(true), root });
  } else {
    let target = location.hash && location.hash !== '#/welcome' ? location.hash : '#/';
    const show = () => {
      const route = parseRoute(location.hash);
      if (route.app === 'welcome' || !hasEntered()) {
        if (route.app === 'welcome') forgetEntered();
        root.replaceChildren(
          renderWelcome(data, () => {
            location.hash = target === '#/welcome' ? '#/' : target;
            if (location.hash === target) show();
          })
        );
        document.title = data.site.name;
        return;
      }
      target = location.hash || '#/';
      renderPhone(root, route, data);
    };
    window.addEventListener('hashchange', () => {
      sound.click();
      show();
    });
    show();
    if (!previewing)
      keepFresh(data, () => {
        if (parseRoute(location.hash).app !== 'welcome' && hasEntered() && nearTop(root)) show();
      });
    openOwnerDoor({ data, desktop: false, redraw: () => parseRoute(location.hash).app !== 'welcome' && hasEntered() && show(), root });
    // Unfolding a foldable, or turning a tablet, can cross into the roomier layout.
    window.matchMedia('(min-width: 700px)').addEventListener('change', () => show());
  }

  // Switching between phone and desktop size reloads into the other layout.
  desktopQuery.addEventListener('change', () => location.reload());
}

// A visit counted (once a visit, never yours): the visitor counter, and where visits come from.
function countVisit() {
  try {
    if (sessionStorage.getItem('visitor-number') || localStorage.getItem('owner') === '1' || window.parent !== window) return;
    sessionStorage.setItem('visitor-number', '0');
  } catch {
    return;
  }
  fetch('/api/visit', { method: 'POST' })
    .then((r) => r.json())
    .then((d) => d.count && sessionStorage.setItem('visitor-number', d.count))
    .catch(() => {});
}

main();
keepForOffline();
countVisit();
