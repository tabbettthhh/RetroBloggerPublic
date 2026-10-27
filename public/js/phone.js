// Phone layout: each section gets the full screen, dressed in its own era.
import { h, iconEl, ICON } from './util.js';
import { APPS, appTitle, sections, renderSafely, menuOf, sectionLabel } from './apps.js';
import { sound, isMuted, setMuted } from './sound.js';
import { clockText } from './sky.js';
import { cycleTheme, themeChoice, themeLabel, MOON } from './theme.js';
import { phoneExplore } from './startmenu.js';
import { word } from './skins.js';

let closeOpenMenu = null;
function trackMenu(close) {
  if (closeOpenMenu) closeOpenMenu();
  closeOpenMenu = close;
}
document.addEventListener('click', (e) => {
  if (closeOpenMenu && !e.target.closest('.menu-root')) {
    closeOpenMenu();
    closeOpenMenu = null;
  }
});

function swatch(kind) {
  return h('span', { class: 'swatch sw-' + (kind || 'none'), 'aria-hidden': 'true' });
}

// A dropdown in one of three styles: xp, mac or droid.
function dropdown(style, data, current, { label, labelClass, buttonContent }) {
  const root = h('span', { class: `menu-root menu-${style}` });
  const panel = h('div', { class: 'menu-panel', role: 'menu', hidden: true });
  const btn = h('button', { type: 'button', class: labelClass, 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-label': label }, buttonContent);
  const close = () => {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    root.classList.remove('open');
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = panel.hidden;
    if (open) {
      trackMenu(close);
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      root.classList.add('open');
      sound.click();
    } else close();
  });
  const items = sections(data).filter((s) => style !== 'xp' || s.group !== 'main');
  let lastGroup = null;
  for (const s of items) {
    if (lastGroup && s.group !== lastGroup) panel.append(h('div', { class: 'menu-sep', role: 'separator' }));
    if (style === 'mac' && s.group === 'others' && lastGroup !== 'others') panel.append(h('span', { class: 'menu-heading' }, word('others', 'Others')));
    lastGroup = s.group;
    const isCurrent = s.id === current;
    panel.append(
      h(
        'a',
        { href: s.href, role: 'menuitem', class: 'menu-item' + (isCurrent ? ' current' : ''), 'aria-current': isCurrent ? 'page' : null, onclick: close },
        style === 'mac' ? h('span', { class: 'tick', html: isCurrent ? ICON.check : '' }) : null,
        s.group === 'others' ? swatch(s.swatch) : null,
        h('span', { class: 'menu-label' }, s.label, style === 'xp' && s.sub ? h('small', null, s.sub) : null),
        style === 'mac' && s.key ? h('span', { class: 'shortcut' }, '⌘' + s.key) : null,
        style === 'mac' && s.id === 'leave' ? h('span', { class: 'shortcut' }, '⇧⌘Q') : null
      )
    );
  }
  // Light / dark switch. Tapping it cycles Auto → Dark → Light and keeps the menu open.
  const themeBtn = h('button', { type: 'button', role: 'menuitem', class: 'menu-item theme-item' });
  const paintTheme = () => {
    const c = themeChoice();
    themeBtn.replaceChildren(
      ...[
        style === 'mac' ? h('span', { class: 'tick' }) : null,
        h('span', { class: 'swatch sw-theme', html: MOON }),
        h('span', { class: 'menu-label' }, `Appearance: ${themeLabel(c)}`, style === 'mac' ? null : h('small', null, c === 'auto' ? 'Follows your phone' : 'Tap to change'))
      ].filter(Boolean)
    );
  };
  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cycleTheme();
    paintTheme();
    sound.click();
  });
  paintTheme();
  panel.append(h('div', { class: 'menu-sep', role: 'separator' }), themeBtn);
  root.append(btn, panel);
  return root;
}

function muteButton(cls) {
  const b = h('button', { type: 'button', class: cls });
  const paint = () => {
    b.innerHTML = isMuted() ? ICON.speakerOff : ICON.speaker;
    b.setAttribute('aria-label', isMuted() ? 'Turn sounds on' : 'Mute sounds');
  };
  b.addEventListener('click', () => {
    setMuted(!isMuted());
    paint();
    sound.click();
  });
  paint();
  return b;
}

function clock() {
  const el = h('span', { class: 'clock' }, clockText());
  const t = setInterval(() => (el.isConnected ? (el.textContent = clockText()) : clearInterval(t)), 20000);
  return el;
}

function xpShell(id, data, content) {
  const app = APPS[id];
  // The main bar: the theme's choice of sections, in its order (the rest are under Others).
  const navLinks = menuOf(data).main.map((key) => [key, sectionLabel(key), key === 'home' ? '#/' : '#/' + key]);
  const nav = app.nav
    ? h(
        'nav',
        { class: 'xp-nav', 'aria-label': 'Sections' },
        // On the narrowest phones the links slide sideways, so Others always stays in reach.
        h(
          'div',
          { class: 'xp-links' },
          navLinks.map(([key, label, href]) => h('a', { href, class: key === id ? 'on' : '', 'aria-current': key === id ? 'page' : null }, label)),
          h('a', { class: 'xp-search' + (id === 'search' ? ' on' : ''), href: '#/search', 'aria-label': 'Search', html: ICON.search })
        ),
        dropdown('xp', data, id, { label: 'Other sections', labelClass: 'xp-others', buttonContent: [word('others', 'Others'), iconEl(ICON.chevronDown)] })
      )
    : null;

  // The Start button reads "Explore" and opens the same Start menu as the desktop, as a sheet.
  const explore = phoneExplore(data);

  return h(
    'div',
    { class: 'phone xp-phone wall' },
    h(
      'div',
      { class: 'xp-window' },
      h('div', { class: 'xp-title' }, iconEl(ICON[app.icon] || ICON.globe), h('span', { class: 'xp-title-text' }, appTitle(id, data)), h('span', { class: 'xp-ctl min', 'aria-hidden': 'true' }), h('span', { class: 'xp-ctl max', 'aria-hidden': 'true' }), h('a', { class: 'xp-ctl close', href: id === 'home' ? '#/welcome' : '#/', 'aria-label': id === 'home' ? 'Leave' : 'Close' }, '×')),
      nav,
      h('div', { class: 'xp-body', id: 'main' }, content)
    ),
    ...explore.layer,
    h('div', { class: 'taskbar' }, explore.btn, h('span', { class: 'task' }, appTitle(id, data)), h('span', { class: 'tray' }, muteButton('tray-btn'), clock()))
  );
}

function leatherShell(id, data, content, param) {
  // The passport goes back to the journal, to the very entry if that's where you came from.
  const back = id === 'passport' ? [param ? `#/journal/${encodeURIComponent(param)}` : '#/journal', 'Journal'] : ['#/', 'Home'];
  return h(
    'div',
    { class: 'phone leather-phone' },
    h(
      'div',
      { class: 'stitched' },
      h('header', { class: 'leather-head' }, h('a', { class: 'paper-tab', href: back[0] }, iconEl(ICON.chevronLeft), back[1]), h('h1', { class: 'gold' }, appTitle(id, data))),
      h('div', { class: 'paper', id: 'main' }, content)
    )
  );
}

function macShell(id, data, content, param) {
  const dockItem = (href, label, cls, active) =>
    active ? h('span', { class: 'dock-slot' }, h('span', { class: 'dock-icon ' + cls, 'aria-hidden': 'true' }), h('span', { class: 'dock-dot' })) : h('a', { href, class: 'dock-slot', 'aria-label': label }, h('span', { class: 'dock-icon ' + cls }));
  return h(
    'div',
    { class: 'phone mac-phone' },
    h(
      'div',
      { class: 'menubar' },
      h('span', { class: 'menubar-logo', html: '<svg width="12" height="15" viewBox="0 0 12 15" aria-hidden="true"><path d="M6 14s5-5.2 5-8.5A5 5 0 0 0 1 5.5C1 8.8 6 14 6 14z" fill="#2a2a2a"/><circle cx="6" cy="5.5" r="1.8" fill="#fff"/></svg>' }),
      h('strong', null, 'Atlas'),
      h('span', { class: 'menubar-item' }, 'File'),
      h('span', { class: 'menubar-item' }, 'View'),
      dropdown('mac', data, id === 'atlas' ? 'atlas' : id, { label: 'Go', labelClass: 'go-btn', buttonContent: 'Go' }),
      h('a', { class: 'spotlight', href: '#/search', 'aria-label': 'Search', html: ICON.search }),
      clock()
    ),
    h('div', { class: 'mac-window' }, h('div', { class: 'mac-title' }, h('span', { class: 'lights', 'aria-hidden': 'true' }, h('i', { class: 'r' }), h('i', { class: 'y' }), h('i', { class: 'g' })), h('span', null, appTitle(id, data))), h('div', { class: 'mac-body', id: 'main' }, content)),
    h(
      'nav',
      { class: 'dock', 'aria-label': 'Dock' },
      dockItem('#/', 'Home', 'di-home', false),
      dockItem(id === 'atlas' && param ? `#/journal/${encodeURIComponent(param)}` : '#/journal', 'Journal', 'di-journal', false),
      dockItem('#/atlas', 'Atlas', 'di-atlas', id === 'atlas'),
      dockItem('#/wishlist', 'Wishlist', 'di-wish', id === 'wishlist'),
      dockItem('#/guestbook', 'Guestbook', 'di-guest', false)
    )
  );
}

function droidShell(id, data, content) {
  return h(
    'div',
    { class: 'phone droid-phone' },
    h(
      'div',
      { class: 'droid-bar' },
      h('a', { class: 'droid-back', href: '#/', 'aria-label': 'Back to home', html: ICON.chevronLeft }),
      h('span', { class: 'droid-icon', html: ICON.book }),
      h('span', { class: 'droid-title' }, appTitle(id, data)),
      dropdown('droid', data, id, { label: 'More options', labelClass: 'droid-overflow', buttonContent: h('span', { class: 'dots3' }, h('i'), h('i'), h('i')) })
    ),
    h('div', { class: 'droid-body', id: 'main' }, content)
  );
}

// Bookshelf, cinema and podcasts: a themed top bar with a way back, and the shelf below.
function shelfShell(era, id, data, content, param) {
  const backHref = param ? `#/${id}` : '#/';
  const backLabel = param ? { books: 'Shelf', films: 'Tickets', podcasts: 'Tapes', music: 'Crate', tv: 'Tapes' }[id] : 'Home';
  const back = h('a', { class: `${era}-back`, href: backHref }, iconEl(ICON.chevronLeft), backLabel);
  const title = appTitle(id, data);
  const bars = {
    shelf: () => h('div', { class: 'shelf-bar' }, back, h('span', { class: 'shelf-bar-title' }, title)),
    cinema: () => h('div', { class: 'marquee' }, back, h('span', { class: 'marquee-board' }, title)),
    tape: () => h('div', { class: 'deck-bar' }, back, h('span', { class: 'lcd' }, title.toUpperCase())),
    record: () => h('div', { class: 'hifi-bar' }, back, h('span', { class: 'hifi-dial' }, title)),
    album: () => h('div', { class: 'al-bar' }, back, h('span', { class: 'al-bar-title' }, title)),
    crt: () => h('div', { class: 'tv-bar' }, back, h('span', { class: 'tv-channel' }, h('span', { class: 'tv-led', 'aria-hidden': 'true' }, 'CH 03'), title), h('span', { class: 'tv-knobs', 'aria-hidden': 'true' }, h('i'), h('i')))
  };
  return h('div', { class: `phone ${era}-phone` }, bars[era](), h('div', { class: `${era}-body`, id: 'main' }, content));
}

let lastEra = '';
export function renderPhone(root, route, data) {
  const id = route.app;
  const app = APPS[id] || APPS.home;
  // Tablets, iPads and unfolded foldables get roomier layouts (like the journal as a book).
  const tablet = window.matchMedia('(min-width: 700px)').matches;
  document.body.classList.toggle('tablet', tablet);
  const content = renderSafely(APPS[id] ? id : 'home', { data, param: route.param, desktop: false, tablet });
  const shells = { xp: xpShell, leather: leatherShell, mac: macShell, android: droidShell };
  const shell = shells[app.era] ? shells[app.era](APPS[id] ? id : 'home', data, content, route.param) : shelfShell(app.era, id, data, content, route.param);
  // Stepping into a different part of the site, what's inside fades in for a moment, rather
  // than jumping. Turning pages within one part doesn't.
  // Marked with its app, so a theme can give each app its own look.
  shell.dataset.app = APPS[id] ? id : 'home';
  if (lastEra && lastEra !== app.era) shell.classList.add('arrive');
  lastEra = app.era;
  root.replaceChildren(shell);
  window.scrollTo(0, 0);
  document.title = `${appTitle(id, data)} · ${data.site.name}`.replace(/^ · /, '');
}
