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

const root = document.getElementById('app');
const desktopQuery = window.matchMedia('(min-width: 900px) and (pointer: fine)');
const isDesktop = desktopQuery.matches;

async function load() {
  // Fetched early by the page itself (see index.html), so this is usually already here.
  const res = await fetch('/api/all');
  if (!res.ok) throw new Error('Could not load');
  return res.json();
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
      const fresh = await res.json();
      const now = plain(fresh);
      if (now === seen) return;
      seen = now;
      for (const k of Object.keys(data)) if (!(k in fresh)) delete data[k];
      Object.assign(data, fresh);
      registerDesigns(data);
      if (!previewing) setSoundPack(applySkin(data.theme).sounds);
      redraw();
    } catch {
    } finally {
      busy = false;
    }
  };
  document.addEventListener('visibilitychange', check);
  window.addEventListener('pageshow', check);
  window.addEventListener('focus', check);
  setInterval(check, 5 * 60 * 1000);
}
// Whether the reader is at (or near) the top of what's showing, so drawing it again won't move
// anything they're reading.
const nearTop = (el) => [el, ...el.querySelectorAll('*')].every((x) => x.scrollTop < 80) && (document.scrollingElement?.scrollTop || 0) < 80;

// Your place categories and keepsake designs, and your friends' (for drawing their posts as on
// their own sites; yours come first, so a name you both use keeps yours).
function registerDesigns(data) {
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

async function main() {
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
    // Unfolding a foldable, or turning a tablet, can cross into the roomier layout.
    window.matchMedia('(min-width: 700px)').addEventListener('change', () => show());
  }

  // Switching between phone and desktop size reloads into the other layout.
  desktopQuery.addEventListener('change', () => location.reload());
}

main();
