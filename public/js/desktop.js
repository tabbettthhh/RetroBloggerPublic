// Desktop mode: an XP desktop where every section opens in a window wearing its own era.
import { presenceDot, PRESENCE } from './statusbar.js';
import { withEmoticons } from './emoticons.js';
import { h, iconEl, ICON, niceDate, busy } from './util.js';
import { APPS, appTitle, sections, renderSafely, menuOf } from './apps.js';
import { sound, isMuted, setMuted } from './sound.js';
import { clockText, wallpaperChoice, setWallpaperChoice } from './sky.js';
import { themeChoice, setThemeChoice } from './theme.js';
import { startMenuParts } from './startmenu.js';
import { word } from './skins.js';

const DESKTOP_ICONS = [
  ['home', 'Thoughts', 'di-thoughts'],
  ['journal', 'Places Journal', 'di-journal'],
  ['atlas', 'Atlas', 'di-atlas'],
  ['friends', 'Friends', 'di-friends'],
  ['album', 'Photo album', 'di-album'],
  ['more', 'Photos & lists', 'di-photos'],
  ['passport', 'Passport', 'di-passport'],
  ['wishlist', 'Trips Wishlist', 'di-wish'],
  ['planner', 'Planner', 'di-planner'],
  ['books', 'Bookshelf', 'di-books'],
  ['films', 'Cinema', 'di-films'],
  ['podcasts', 'Podcasts', 'di-podcasts'],
  ['music', 'Records', 'di-music'],
  ['tv', 'TV', 'di-tv'],
  ['guestbook', 'Guestbook', 'di-guest'],
  ['about', 'About', 'di-about']
];

export function startDesktop(root, data) {
  const wins = new Map();
  let z = 20;
  let cascade = 0;

  const desk = h('div', { class: 'desktop wall' });
  const layer = h('div', { class: 'win-layer' });
  const tasks = h('div', { class: 'tasks' });
  const icons = h('div', { class: 'desk-icons', role: 'list' });

  // ---- icons ----
  // (Drawn again when what's shown changes: signed in, say, your Friends and Planner appear.)
  let iconSet = '';
  const drawIcons = () => {
    const { hidden } = menuOf(data);
    const shown = DESKTOP_ICONS.filter(([id]) => !(id === 'stats' && !data.stats) && !hidden.has(id));
    const now = JSON.stringify(shown.map(([id, usual]) => [id, word(id, usual)]));
    if (now === iconSet) return;
    iconSet = now;
    icons.replaceChildren();
    for (const [id, usual, cls] of shown) iconFor(id, word(id, usual), cls);
  };
  const iconFor = (id, label, cls) => {
    // (Sections the theme leaves out of the menus have no icon either.)
    const btn = h('button', { type: 'button', class: 'desk-icon', role: 'listitem', title: `Open ${label}` }, h('span', { class: 'dock-icon ' + cls, 'aria-hidden': 'true' }), h('span', { class: 'desk-label' }, label));
    btn.addEventListener('dblclick', () => go('#/' + (id === 'home' ? '' : id)));
    btn.addEventListener('click', (e) => {
      icons.querySelectorAll('.selected').forEach((n) => n.classList.remove('selected'));
      btn.classList.add('selected');
      if (e.pointerType === 'touch' || e.detail === 0) go('#/' + (id === 'home' ? '' : id));
    });
    icons.append(btn);
  };
  drawIcons();

  function go(hashStr) {
    if (location.hash === hashStr || (hashStr === '#/' && (location.hash === '' || location.hash === '#/'))) open(hashStr);
    else location.hash = hashStr;
  }

  // ---- windows ----
  function frame(id, title) {
    const era = APPS[id].era;
    const close = h('button', { type: 'button', class: 'wbtn close', 'aria-label': 'Close ' + title });
    const min = h('button', { type: 'button', class: 'wbtn min', 'aria-label': 'Minimise ' + title });
    const max = h('button', { type: 'button', class: 'wbtn max', 'aria-label': 'Maximise ' + title });
    let bar;
    if (era === 'xp') bar = h('div', { class: 'wbar xp-title' }, iconEl(ICON[APPS[id].icon] || ICON.globe), h('span', { class: 'xp-title-text' }, title), min, max, close);
    else if (era === 'leather') bar = h('div', { class: 'wbar leather-bar' }, h('span', { class: 'gold' }, title), min, close);
    else if (era === 'mac') bar = h('div', { class: 'wbar mac-title' }, h('span', { class: 'lights' }, close, min, max), h('span', null, title));
    else if (era === 'shelf') bar = h('div', { class: 'wbar shelf-bar' }, h('span', { class: 'shelf-bar-title' }, title), min, max, close);
    else if (era === 'cinema') bar = h('div', { class: 'wbar marquee' }, h('span', { class: 'marquee-board' }, title), min, max, close);
    else if (era === 'tape') bar = h('div', { class: 'wbar deck-bar' }, h('span', { class: 'lcd' }, title.toUpperCase()), min, max, close);
    else if (era === 'record') bar = h('div', { class: 'wbar hifi-bar' }, h('span', { class: 'hifi-dial' }, title), min, max, close);
    else if (era === 'album') bar = h('div', { class: 'wbar al-bar' }, h('span', { class: 'al-bar-title' }, title), min, max, close);
    else if (era === 'planner') bar = h('div', { class: 'wbar pln-bar' }, h('span', { class: 'pln-bar-title' }, title), min, max, close);
    else if (era === 'crt') bar = h('div', { class: 'wbar tv-bar' }, h('span', { class: 'tv-channel' }, h('span', { class: 'tv-led', 'aria-hidden': 'true' }, 'CH 03'), title), min, max, close);
    else bar = h('div', { class: 'wbar droid-bar' }, h('span', { class: 'droid-icon', html: ICON.book }), h('span', { class: 'droid-title' }, title), min, close);
    const body = h('div', { class: 'wbody' });
    // (Marked with its app, so a theme can give each app its own look.)
    const el = h('section', { class: `dw dw-${era}`, 'data-app': id, 'aria-label': title }, bar, body);
    return { el, bar, body, close, min, max };
  }

  function focus(w) {
    for (const o of wins.values()) {
      o.el.classList.remove('active');
      o.task.classList.remove('active');
    }
    w.el.style.zIndex = ++z;
    w.el.classList.add('active');
    w.task.classList.add('active');
    w.el.hidden = false;
    w.minimized = false;
  }

  function render(w, id, param) {
    w.param = param;
    w.body.replaceChildren(renderSafely(id, { data, param, desktop: true }));
    w.body.scrollTop = 0;
  }

  function open(hashStr) {
    const route = parseHash(hashStr);
    if (route.app === 'welcome') return;
    const id = APPS[route.app] ? route.app : 'home';
    let w = wins.get(id);
    if (w) {
      if (w.param !== route.param) {
        busy(350);
        render(w, id, route.param);
        if (id === 'journal') sound.page();
      }
      focus(w);
      return;
    }
    busy(650);
    const title = appTitle(id, data);
    const f = frame(id, title);
    const [dw, dh] = APPS[id].size;
    // (The desktop's own size: an old computer's case can leave it smaller than the window.)
    const vw = desk.clientWidth || window.innerWidth;
    const vh = (desk.clientHeight || window.innerHeight) - 44;
    const width = Math.min(dw, vw - 140);
    const height = Math.min(dh, vh - 40);
    const left = Math.min(130 + (cascade % 6) * 36 + (id === 'journal' ? 260 : 0), Math.max(110, vw - width - 20));
    const top = Math.min(24 + (cascade % 6) * 30, Math.max(10, vh - height - 10));
    cascade++;
    Object.assign(f.el.style, { width: width + 'px', height: height + 'px', left: left + 'px', top: top + 'px' });

    const task = h('button', { type: 'button', class: 'task-btn task-' + APPS[id].era }, title);
    w = { ...f, task, minimized: false, param: null };
    wins.set(id, w);
    render(w, id, route.param);
    layer.append(f.el);
    tasks.append(task);
    sound.open();

    f.el.addEventListener('pointerdown', () => focus(w));
    f.close.addEventListener('click', (e) => {
      e.stopPropagation();
      f.el.remove();
      task.remove();
      wins.delete(id);
      sound.close();
    });
    f.min.addEventListener('click', (e) => {
      e.stopPropagation();
      f.el.hidden = true;
      w.minimized = true;
      task.classList.remove('active');
      sound.click();
    });
    f.max.addEventListener('click', (e) => {
      e.stopPropagation();
      f.el.classList.toggle('maxed');
      sound.click();
    });
    task.addEventListener('click', () => {
      if (!w.minimized && w.el.classList.contains('active')) {
        f.el.hidden = true;
        w.minimized = true;
        task.classList.remove('active');
      } else focus(w);
    });
    drag(f.el, f.bar);
    focus(w);
  }

  // Dragging a window by its title bar. It only moves while the button is actually held down,
  // and only once the pointer has moved a few pixels, so a click, a tap on a trackpad or a
  // wobble while double-clicking never nudges it. If the browser loses track of the release
  // (let go outside the window, or a trackpad tap), the drag stops instead of the window
  // following the pointer around.
  function drag(el, handle) {
    let sx, sy, ox, oy, id = null;
    let moving = false;
    const stop = () => {
      if (id != null && handle.hasPointerCapture?.(id)) handle.releasePointerCapture(id);
      id = null;
      moving = false;
      el.classList.remove('dragging');
    };
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button,a') || el.classList.contains('maxed')) return;
      id = e.pointerId;
      handle.setPointerCapture(id);
      sx = e.clientX;
      sy = e.clientY;
      ox = el.offsetLeft;
      oy = el.offsetTop;
      moving = false;
    });
    handle.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      if (e.pointerType === 'mouse' && !(e.buttons & 1)) return stop();
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!moving) {
        if (Math.hypot(dx, dy) < 5) return;
        moving = true;
        el.classList.add('dragging');
      }
      const maxX = (desk.clientWidth || window.innerWidth) - 80;
      const maxY = (desk.clientHeight || window.innerHeight) - 44 - 30;
      el.style.left = Math.max(-el.offsetWidth + 80, Math.min(maxX, ox + dx)) + 'px';
      el.style.top = Math.max(0, Math.min(maxY, oy + dy)) + 'px';
    });
    const end = (e) => e.pointerId === id && stop();
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    handle.addEventListener('lostpointercapture', end);
    window.addEventListener('blur', stop);
    handle.addEventListener('dblclick', (e) => {
      if (!e.target.closest('button,a')) el.classList.toggle('maxed');
    });
  }

  // ---- start menu ----
  const all = sections(data);
  const startMenu = h('div', { class: 'start-menu', hidden: true, role: 'menu' }, ...startMenuParts(data, { onScreensaver: () => { hideStart(); screensaver.start(); } }));
  const startBtn = h('button', { type: 'button', class: 'start-btn', 'aria-haspopup': 'true', 'aria-expanded': 'false' }, iconEl(ICON.compass), word('explore', 'Explore'));
  const hideStart = () => {
    startMenu.hidden = true;
    startBtn.classList.remove('pressed');
    startBtn.setAttribute('aria-expanded', 'false');
  };
  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const show = startMenu.hidden;
    hideStart();
    hideContext();
    if (show) {
      // (Drawn afresh each time: the latest posts, and whose menu it is.)
      startMenu.replaceChildren(...startMenuParts(data, { onScreensaver: () => { hideStart(); screensaver.start(); } }));
      startMenu.hidden = false;
      startBtn.classList.add('pressed');
      startBtn.setAttribute('aria-expanded', 'true');
      sound.click();
    }
  });
  startMenu.addEventListener('click', (e) => e.target.closest('a') && hideStart());

  // ---- right-click menu ----
  const ctxMenu = h('div', { class: 'ctx-menu', hidden: true, role: 'menu' });
  const hideContext = () => (ctxMenu.hidden = true);
  function buildContext() {
    const choice = wallpaperChoice();
    const wpItem = (v, label) =>
      h('button', { type: 'button', class: 'ctx-item', role: 'menuitemradio', 'aria-checked': String(choice === v), onclick: () => { setWallpaperChoice(v); hideContext(); sound.click(); } }, h('span', { class: 'ctx-tick', html: choice === v ? ICON.check : '' }), label);
    const theme = themeChoice();
    const themeItem = (v, label) =>
      h('button', { type: 'button', class: 'ctx-item', role: 'menuitemradio', 'aria-checked': String(theme === v), onclick: () => { setThemeChoice(v); hideContext(); sound.click(); } }, h('span', { class: 'ctx-tick', html: theme === v ? ICON.check : '' }), label);
    ctxMenu.replaceChildren(
      h('div', { class: 'ctx-item has-sub', tabindex: '0' }, 'Open section', h('span', { class: 'ctx-arrow' }, '›'), h('div', { class: 'ctx-sub' }, all.filter((s) => s.group !== 'leave').map((s) => h('a', { href: s.href, class: 'ctx-item', role: 'menuitem', onclick: hideContext }, s.label)))),
      h('div', { class: 'ctx-item has-sub', tabindex: '0' }, 'Wallpaper', h('span', { class: 'ctx-arrow' }, '›'), h('div', { class: 'ctx-sub' }, wpItem('auto', 'Auto (follows the clock)'), h('div', { class: 'ctx-sep' }), wpItem('morning', 'Morning'), wpItem('day', 'Day'), wpItem('sunset', 'Sunset'), wpItem('night', 'Night'))),
      h('div', { class: 'ctx-item has-sub', tabindex: '0' }, 'Appearance', h('span', { class: 'ctx-arrow' }, '›'), h('div', { class: 'ctx-sub' }, themeItem('auto', 'Auto (follows your computer)'), h('div', { class: 'ctx-sep' }), themeItem('light', 'Light'), themeItem('dark', 'Dark'))),
      h('div', { class: 'ctx-sep' }),
      h('button', { type: 'button', class: 'ctx-item', onclick: () => { setMuted(!isMuted()); hideContext(); } }, isMuted() ? 'Turn sounds on' : 'Mute sounds'),
      h('button', { type: 'button', class: 'ctx-item', onclick: () => { hideContext(); screensaver.start(); } }, 'Start screensaver')
    );
  }
  desk.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.dw, .taskbar, .start-menu')) return;
    e.preventDefault();
    hideStart();
    buildContext();
    ctxMenu.hidden = false;
    const box = desk.getBoundingClientRect();
    const x = Math.min(e.clientX - box.left, box.width - 250);
    const y = Math.min(e.clientY - box.top, box.height - 220);
    Object.assign(ctxMenu.style, { left: x + 'px', top: y + 'px' });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ctx-menu')) hideContext();
    if (!e.target.closest('.start-menu, .start-btn')) hideStart();
  });
  document.addEventListener('keydown', (e) => {
    // "/" or Ctrl/Cmd+K opens search, unless you're typing somewhere.
    const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
    if ((!typing && e.key === '/') || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      go('#/search');
      return;
    }
    if (e.key === 'Escape') {
      hideContext();
      hideStart();
    }
  });

  // ---- taskbar ----
  const mute = h('button', { type: 'button', class: 'tray-btn' });
  const paintMute = () => {
    mute.innerHTML = isMuted() ? ICON.speakerOff : ICON.speaker;
    mute.setAttribute('aria-label', isMuted() ? 'Turn sounds on' : 'Mute sounds');
  };
  mute.addEventListener('click', () => {
    setMuted(!isMuted());
  });
  document.addEventListener('mutechange', paintMute);
  paintMute();
  const clock = h('span', { class: 'clock' }, clockText());
  setInterval(() => (clock.textContent = clockText()), 20000);
  const taskbar = h(
    'div',
    { class: 'taskbar' },
    startBtn,
    tasks,
    h('span', { class: 'tray' }, h('span', { class: 'tray-status' }), mute, clock)
  );
  // The words on the Explore button and your status in the tray: drawn again whenever the site
  // changes (a new theme's words, a new status), so nothing keeps an old look until a reload.
  const paintBar = () => {
    const label = word('explore', 'Explore');
    const words = [...startBtn.childNodes].find((n) => n.nodeType === 3);
    if (words && words.textContent !== label) words.textContent = label;
    const st = taskbar.querySelector('.tray-status');
    const title = [PRESENCE[data.site.presence]?.[0], data.site.status].filter(Boolean).join(' · ');
    if (st.dataset.was === title) return;
    st.dataset.was = title;
    st.title = title;
    st.replaceChildren(presenceDot(data.site), ...[data.site.status ? withEmoticons(data.site.status, 14) : PRESENCE[data.site.presence]?.[0]].flat().filter(Boolean));
  };
  paintBar();

  // ---- balloon: the newest post ----
  // Yours, or a friend's if theirs is newer: only what this visitor may see (a friend's post is in
  // their data only if you show them your friends' posts, and a friends-only one never is);
  // signed in, whatever the latest of everything is. Chosen when it's shown, by which time the
  // owner's own copy (with everything in it) has been read.
  const KIND = { thoughts: 'thought', places: 'place in the journal', photos: 'photo dump', lists: 'list', quotes: 'quote' };
  const newest = () => {
    const mine = data.posts[0];
    const theirs = (data.friendPosts || [])[0];
    if (theirs && (!mine || (theirs.ts || 0) > (mine.ts || 0))) {
      const name = theirs.friend?.owner || theirs.friend?.name || 'a friend';
      return { href: '#/friends', head: `New ${KIND[theirs.type] || 'post'} from ${name}`, text: (theirs.title || theirs.excerpt || 'Open it').slice(0, 80), date: theirs.date };
    }
    if (!mine) return null;
    return { href: mine.type === 'places' ? `#/journal/${mine.slug}` : `#/post/${mine.type}/${mine.slug}`, head: 'New ' + (KIND[mine.type] || 'post'), text: (mine.title || mine.excerpt || 'Open it').slice(0, 80), date: mine.date };
  };
  const balloonHead = h('strong');
  const balloonLink = h('a', { class: 'balloon-text', onclick: () => (balloon.hidden = true) });
  const balloon = h(
    'div',
    { class: 'balloon', role: 'status', hidden: true },
    h('div', { class: 'balloon-top' }, h('span', { class: 'balloon-i', 'aria-hidden': 'true' }, 'i'), balloonHead, h('button', { type: 'button', class: 'balloon-x', 'aria-label': 'Dismiss', onclick: () => (balloon.hidden = true) }, '×')),
    balloonLink
  );

  desk.append(...[icons, layer, ctxMenu, startMenu, balloon, taskbar].filter(Boolean));
  root.replaceChildren(desk);

  // ---- screensaver ----
  // Fetched the first time it's needed (after two idle minutes, or from the menus).
  let saver = null;
  const screensaver = {
    start: () => import('./screensaver.js').then(({ makeScreensaver }) => (saver ||= makeScreensaver(data)).start())
  };
  let idle;
  const resetIdle = () => {
    clearTimeout(idle);
    idle = setTimeout(() => screensaver.start(), 120000);
  };
  ['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach((ev) => window.addEventListener(ev, resetIdle, { passive: true }));
  resetIdle();

  return {
    open,
    // New posts arrived: each open window that's at the top is drawn again with them (one you're
    // scrolled down in is left alone, and shows them next time it changes).
    // (`all`: every window, wherever it's scrolled to, as when the owner changes something.)
    refresh(all = false) {
      drawIcons();
      paintBar();
      for (const [id, w] of wins)
        if (all) {
          // (Kept where you were in it.)
          const at = w.body.scrollTop;
          render(w, id, w.param);
          w.body.scrollTop = at;
        }
      else if (w.body.scrollTop < 80 && [...w.body.querySelectorAll('*')].every((x) => x.scrollTop < 80)) render(w, id, w.param);
    },
    welcomeDone() {
      busy(900);
      setTimeout(() => {
        const n = newest();
        if (!n) return;
        balloonHead.textContent = n.head;
        balloonLink.href = n.href;
        balloonLink.replaceChildren(n.text, ' · ', niceDate(n.date));
        balloon.hidden = false;
        sound.chime();
        setTimeout(() => (balloon.hidden = true), 9000);
      }, 1200);
    },
    openDefault(hashStr) {
      open('#/');
      if (data.posts.some((p) => p.type === 'places')) open('#/journal');
      if (hashStr && hashStr !== '#/' && hashStr !== '#' && hashStr !== '') open(hashStr);
    }
  };
}

function parseHash(hashStr) {
  const parts = String(hashStr || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { app: 'home', param: '' };
  const [first, ...rest] = parts;
  if (first === 'welcome') return { app: 'welcome', param: '' };
  return { app: APPS[first] ? first : 'home', param: rest.join('/') };
}

