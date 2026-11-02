// Owner mode: the site itself, with your tools on it. Only ever downloaded once Cloudflare Access
// has let you in (it lives behind the back office's lock), and started by /js/owner-door.js.
//
// What it does, following what's known to work for editing on a live page:
// - You can always tell you're signed in: your own tile sits in the taskbar (or the dock), with
//   + for a new post beside it. Nothing depends on hovering, so phones get everything too.
// - Every post of yours has a ⋯ menu right on it (edit, pin, highlights, friends only, the
//   profile grid, delete), and your drafts, scheduled and friends-only posts show, marked.
// - Writing, and everything else the back office does, opens over the site: a window on a
//   computer, a sheet on a phone (Back or ✕ closes it), never one stacked on another.
// - View as a visitor shows the site exactly as everyone else sees it.
import { h, ICON } from '/js/util.js';
import { kit } from '/admin/admin.js';
import { forgetOwner, ownerHooks } from '/js/owner-door.js';
import { rebuildRoom } from '/js/cabinet.js';
import { applySkin } from '/js/skins.js';

const TYPES = [
  ['thoughts', 'Thought', '💭'],
  ['places', 'Place', '📍'],
  ['photos', 'Photos', '📷'],
  ['lists', 'List', '📝'],
  ['quotes', 'Quote', '❝'],
  ['books', 'Book', '📚'],
  ['films', 'Film', '🎬'],
  ['tv', 'TV', '📺'],
  ['podcasts', 'Podcast', '🎙'],
  ['music', 'Music', '🎵']
];
const SHELVES = ['places', 'music', 'films', 'tv', 'podcasts'];
const PLUS = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 3.5v13M3.5 10h13" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
const GEAR = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 6.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm7 4.4v-2l-2-.4a5.6 5.6 0 0 0-.6-1.5l1.2-1.7-1.4-1.4-1.7 1.2a5.6 5.6 0 0 0-1.5-.6L10.6 2.6h-2l-.4 2a5.6 5.6 0 0 0-1.5.6L5 4 3.6 5.4l1.2 1.7a5.6 5.6 0 0 0-.6 1.5l-2 .4v2l2 .4c.1.5.3 1 .6 1.5l-1.2 1.7L5 16l1.7-1.2c.5.3 1 .5 1.5.6l.4 2h2l.4-2c.5-.1 1-.3 1.5-.6L14.2 16l1.4-1.4-1.2-1.7c.3-.5.5-1 .6-1.5z" fill="#fff"/></svg>';
const DOTS = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="4" cy="10" r="1.9" fill="currentColor"/><circle cx="10" cy="10" r="1.9" fill="currentColor"/><circle cx="16" cy="10" r="1.9" fill="currentColor"/></svg>';

let site = null;
let owner = null; // the back office's view of everything (drafts and all)
let publicCopy = null; // what visitors see, for "View as a visitor"
let previewing = false;

// ---------- styles: the owner's own, and the back office's, kept inside its windows ----------
async function loadStyles() {
  if (document.getElementById('okit-css')) return;
  const own = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/admin/owner.css', id: 'okit-css' });
  document.head.append(own);
  // The back office's look, only inside the owner's windows and sheets (so it never touches the site).
  try {
    const css = await (await fetch('/admin/admin.css', { credentials: 'same-origin' })).text();
    const style = Object.assign(document.createElement('style'), { id: 'okit-scoped', textContent: `.okit { ${css} }` });
    document.head.append(style);
  } catch {}
  // The map for choosing a place, as the back office has it.
  if (!window.L && !document.querySelector('script[src="/vendor/leaflet/leaflet.js"]')) {
    document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/vendor/leaflet/leaflet.css' }), Object.assign(document.createElement('script'), { src: '/vendor/leaflet/leaflet.js', async: true }));
  }
}

// ---------- telling you things ----------
let toastEl;
let toastTimer;
function toast(msg, err = false) {
  toastEl ||= h('div', { class: 'okit-toast', role: 'status', 'aria-live': 'polite' });
  // (Over a dialog that's open, like the cabinet's closer look, it goes inside it, to be seen.)
  const over = document.querySelector('dialog[open]') || document.body;
  if (toastEl.parentNode !== over) over.append(toastEl);
  toastEl.textContent = msg;
  toastEl.classList.toggle('err', err);
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), err ? 7000 : 3500);
}

// ---------- what's showing: yours, drafts and all ----------
const idOf = (p) => `${p.type}/${p.slug}`;
const postFor = (id) => owner?.posts.find((p) => !p.error && idOf(p) === id) || null;
// What visitors see, kept for "View as a visitor" (taken from the site's own fresh copies).
const MINE = ['posts', 'planner', 'highlights', 'highlightsPast', 'guestbook', 'wishlist', 'site', 'theme'];
function keepPublic(d) {
  publicCopy = Object.fromEntries(MINE.map((k) => [k, d[k]]));
}
function merge(d) {
  if (!owner || previewing) return;
  // (A post whose header can't be read stays in the Control Panel, where it can be fixed.)
  d.posts = owner.posts.filter((p) => !p.error);
  for (const k of MINE.slice(1)) if (owner[k] !== undefined) d[k] = owner[k];
}
let redrawSoon;
let redrawWaiting = false;
function redraw() {
  // (Never under your hands: while you're writing in a post, the page waits until you're done.)
  if (writing()) {
    redrawWaiting = true;
    return;
  }
  clearTimeout(redrawSoon);
  redrawSoon = setTimeout(() => site.redraw(), 30);
}
function changed(d) {
  const before = JSON.stringify([owner?.highlights, owner?.highlightsPast]);
  const themeBefore = JSON.stringify(owner?.theme || null);
  owner = d;
  merge(site.data);
  redraw();
  // (The highlights changed and you're in their room: built again, the closer look put back.)
  if (before !== JSON.stringify([d.highlights, d.highlightsPast]) && document.querySelector('.cab-room') && before !== '[null,null]') {
    document.querySelector('dialog.cab-dialog[open]')?.close();
    rebuildRoom(site.data);
  }
  // (A theme just saved: the site wears it, and remembers it for next time.)
  if (themeBefore !== 'null' && themeBefore !== JSON.stringify(d.theme || null) && !trying) {
    applySkin(d.theme || {});
    try {
      localStorage.setItem('skin', JSON.stringify(d.theme || {}));
    } catch {}
  }
}

// ---------- the window (computer) or sheet (phone) the back office draws in ----------
let host = null;
function okToLeaveThemes() {
  if (!trying) return true;
  if (themeUnsaved?.() && !confirm('Close without saving your theme? Your site goes back to its saved look. (Your choices are kept for next time.)')) return false;
  stopTrying();
  return true;
}
function closeHost(force = false, keepPlace = false) {
  if (!host) return true;
  if (!force && kit.editing() && !confirm('Close without saving what you’ve written? (It’s kept in this browser, so you can carry on later.)')) return false;
  if (!force && !okToLeaveThemes()) return false;
  if (force) stopTrying();
  const was = host;
  host = null;
  was.el.remove();
  document.documentElement.classList.remove('okit-open', 'okit-docked');
  // (Going straight to another window or sheet keeps this one's place in Back's history.)
  if (!keepPlace && history.state?.okit) history.back();
  return true;
}
// Escape closes the window or sheet (not while typing, and not while a menu is open).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !host || menu || e.target.closest?.('input, textarea, select') || document.querySelector('dialog[open]')) return;
  closeHost();
});
window.addEventListener('popstate', () => {
  if (!host) return;
  // Back closes the window or sheet (asking first if there's unsaved writing).
  if ((kit.editing() && !confirm('Close without saving what you’ve written? (It’s kept in this browser, so you can carry on later.)')) || !okToLeaveThemes()) {
    history.pushState({ okit: 1 }, '', location.href);
    return;
  }
  const was = host;
  host = null;
  was.el.remove();
  document.documentElement.classList.remove('okit-open', 'okit-docked');
});

// ---------- themes, on the real site ----------
// The Themes panel sits at the side (at the bottom on a phone) and the site itself wears each
// choice as you make it. Closing without saving puts the saved look back.
let trying = false;
let themeUnsaved = null;
let lastStructure = '';
function stopTrying() {
  if (!trying) return;
  trying = false;
  applySkin(owner?.theme || {});
  if (lastStructure) {
    lastStructure = '';
    redraw();
  }
}
const themesLive = {
  apply(settings, structure) {
    trying = true;
    applySkin(settings);
    // (A new menu, taskbar or words on the buttons: the page is drawn again with them.)
    if (lastStructure && structure !== lastStructure) redraw();
    lastStructure = structure;
  },
  restore() {
    stopTrying();
  },
  onLeave(fn) {
    themeUnsaved = fn;
  }
};
function openHost(title, { nav = false, dock = false } = {}) {
  const replacing = !!host && history.state?.okit;
  if (host && !closeHost(false, true)) return null;
  if (!leaveInline()) return null;
  const sections = null;
  const tabs = null;
  const body = h('main', { class: 'admin-body' });
  // (In the site's own window style, so the theme dresses it like every other window.)
  const titleEl = h('span', { class: 'xp-title-text' }, title);
  const close = h('button', { type: 'button', class: 'xp-ctl close okit-close', 'aria-label': 'Close' }, '×');
  // (Back to the Control Panel's categories, from one of them.)
  const back = h('button', { type: 'button', class: 'okit-back', hidden: true, 'aria-label': 'Back to the Control Panel' }, '‹');
  back.addEventListener('click', () => (trying && !okToLeaveThemes() ? null : cpHome()));
  // (A docked panel on a phone can be tucked down to look at the site.)
  const tuck = dock && !site.desktop ? h('button', { type: 'button', class: 'okit-tuck', 'aria-expanded': 'true', 'aria-label': 'Tuck the panel away' }, '▾') : null;
  tuck?.addEventListener('click', () => {
    const tucked = el.classList.toggle('tucked');
    tuck.setAttribute('aria-expanded', String(!tucked));
    tuck.textContent = tucked ? '▴' : '▾';
    tuck.setAttribute('aria-label', tucked ? 'Bring the panel back' : 'Tuck the panel away');
  });
  const bar = h('div', { class: 'xp-title okit-bar' }, back, h('span', { class: 'okit-ico', 'aria-hidden': 'true', html: nav || dock ? GEAR : PLUS }), titleEl, tuck, close);
  const kind = dock ? 'okit-dock' : site.desktop ? 'okit-win' : 'okit-sheet';
  const el = h('section', { class: `okit okit-host xp-window ${kind}`, role: 'dialog', 'aria-modal': dock ? 'false' : 'true', 'aria-label': title }, bar, sections, tabs, body);
  close.addEventListener('click', () => closeHost());

  // On a computer it's a window you can move by its title bar.
  if (site.desktop && !dock) dragBy(bar, el);
  document.body.append(el);
  // (A docked panel leaves the site free to look at and scroll.)
  document.documentElement.classList.add(dock ? 'okit-docked' : 'okit-open');
  if (!replacing) history.pushState({ okit: 1 }, '', location.href);
  host = { el, body, titleEl, back, sections, tabs, nav };
  kit.attach({
    panel: body,
    tabs,
    sections,
    toast,
    changed,
    editorDone: () => closeHost(true),
    // (Moving to another page from inside one, e.g. "See it" in the inbox: its name in the bar.)
    go: (id) => {
      if (id === 'themes' && host && !host.el.classList.contains('okit-dock')) {
        setTimeout(() => openThemes(), 0);
        return false;
      }
      if (host?.nav) setPage(id);
    }
  });
  setTimeout(() => close.focus({ preventScroll: true }), 0);
  return host;
}
function dragBy(handle, el) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    handle.setPointerCapture(e.pointerId);
    const move = (ev) => {
      el.style.left = Math.max(0, Math.min(innerWidth - 120, ev.clientX - dx)) + 'px';
      el.style.top = Math.max(0, Math.min(innerHeight - 60, ev.clientY - dy)) + 'px';
      el.style.translate = 'none';
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
}

// ---------- writing inside the post itself ----------
// Edit turns the post into its editor, right where it is (a card in the feed becomes the card
// you're writing; a journal page or a review becomes it, in that app). + puts a new, blank post
// at the top of your feed. Done (saved, cancelled or thrown away), the page is drawn again.
let inline = null;
function writing() {
  if (inline && !inline.host.isConnected) {
    // (The page moved on without it: what you'd typed is kept in this browser, offered again
    // next time you write.)
    inline = null;
    kit.attach({ panel: null, toast, changed });
  }
  return !!inline;
}
function finishInline() {
  const was = inline;
  inline = null;
  kit.attach({ panel: null, toast, changed });
  if (was) {
    was.host.remove();
    for (const [el, display] of was.hidden) el.style.display = display;
  }
  if (redrawWaiting || was) {
    redrawWaiting = false;
    redraw();
  }
}
function leaveInline() {
  if (!inline) return true;
  if (kit.editing() && !confirm('Leave the post you’re writing? (What you’ve written is kept in this browser, so you can carry on later.)')) return false;
  finishInline();
  return true;
}
function startInline(place) {
  const host = h('div', { class: 'ied-host' });
  const hidden = [];
  if (place.replace) {
    hidden.push([place.replace, place.replace.style.display]);
    place.replace.style.display = 'none';
    place.replace.before(host);
  } else if (place.into) {
    for (const el of place.into.children) hidden.push([el, el.style.display]);
    for (const [el] of hidden) el.style.display = 'none';
    place.into.prepend(host);
  } else place.before.before(host);
  inline = { host, hidden };
  kit.attach({ panel: host, toast, changed, editorDone: finishInline, layout: 'card' });
  return host;
}
const show = (host) => requestAnimationFrame(() => {
  host.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  host.querySelector('.ied-text, .ied-title, input')?.focus({ preventScroll: true });
});
// Where your writing goes: the post's own card; or the app it's in (a journal page, a review).
function placeFor(el) {
  if (el.matches('.card')) return { replace: el };
  const body = el.closest('.wbody') || document.getElementById('main');
  return body ? { into: body } : { replace: el };
}
// The top of your feed, opening Home first if it isn't showing.
async function feedTop() {
  const find = () => {
    const feed = site.desktop ? document.querySelector('.dw[data-app="home"] .feed') : document.querySelector('#main .feed');
    return feed && !document.querySelector('.okit-host') ? feed : null;
  };
  if (!find() || (!site.desktop && location.hash !== '#/' && location.hash !== '')) location.hash = '#/';
  for (let i = 0; i < 60 && !find(); i++) await new Promise((r) => setTimeout(r, 50));
  // (On a computer, Home comes to the front.)
  if (site.desktop) document.querySelector('.dw[data-app="home"] .wbody')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  return find();
}

// ---------- the things you do ----------
const TYPE_WORD = Object.fromEntries(TYPES.map(([id, w]) => [id, w]));
async function newPost(type) {
  closeMenus();
  if (host && !closeHost()) return;
  if (!leaveInline()) return;
  const feed = await feedTop();
  if (!feed) {
    // (No feed to write into: the window or sheet, as before.)
    if (!openHost(`New ${TYPE_WORD[type].toLowerCase()}`)) return;
    if (!kit.write(type)) closeHost(true);
    return;
  }
  const first = feed.querySelector(':scope > .card, :scope > .feed-more, :scope > .empty');
  const hostEl = startInline(first ? { before: first } : { into: feed });
  if (!kit.write(type)) return finishInline();
  show(hostEl);
}
async function editPost(p, el) {
  closeMenus();
  if (host && !closeHost()) return;
  if (!leaveInline()) return;
  const hostEl = startInline(placeFor(el));
  await kit.edit(p.key);
  if (!hostEl.firstChild) return finishInline();
  show(hostEl);
}
// ---------- the Control Panel ----------
// Like XP's: pick a category. A window on a computer, a sheet on a phone (in the theme's colours);
// each category opens in the same place, with ‹ back to the categories.
const CP = [
  ['Writing', [['posts', 'Posts & drafts', 'Every post, drafts and scheduled ones included: find, pin, edit', '🗂'], ['highlights', 'Highlights', 'The cabinet’s shelves, in order, with why', '★'], ['planner', 'Planner', 'Your lists, private ones too', '📒']]],
  ['People', [['notifications', 'Inbox', 'Comments, signatures, suggestions, nudges, friends’ news', '✉'], ['friends', 'Friends', 'Your buddies, and who sees what', '👥'], ['status', 'Status', 'How you are, your message, a countdown', '💬']]],
  ['Look', [['themes', 'Themes', 'Colours, wallpaper, fonts and the rest, on your real site as you choose', '🎨'], ['designs', 'Designs', 'The visa in your passport, and keepsakes of your own', '🎟']]],
  ['Your site', [['site', 'Site & wishlist', 'Its name, about you, place categories, the trips wishlist', '🏠'], ['travel', 'Travel stats', 'The flight log in your passport', '✈'], ['files', 'Export & files', 'Download everything, import, all your files', '💾']]]
];
const CP_NAME = Object.fromEntries(CP.flatMap(([, items]) => items.map(([id, name]) => [id, name])));
CP_NAME.comments = 'Comments';
CP_NAME.guestbook = 'Guestbook';
CP_NAME.suggestions = 'Suggestions';
CP_NAME.new = 'Writing';
function setPage(id) {
  if (!host) return;
  host.titleEl.textContent = `Control Panel › ${CP_NAME[id] || 'Page'}`;
  host.back.hidden = false;
  host.body.scrollTop = 0;
}
function cpHome() {
  if (!host) return;
  host.titleEl.textContent = 'Control Panel';
  host.back.hidden = true;
  const n = badgeCount();
  host.body.replaceChildren(
    h(
      'div',
      { class: 'cp-home' },
      h('p', { class: 'cp-pick' }, 'Pick a category'),
      CP.map(([group, items]) =>
        h(
          'section',
          { class: 'cp-group', 'aria-label': group },
          h('h3', null, group),
          h(
            'div',
            { class: 'cp-items' },
            items.map(([id, name, sub, icon]) =>
              h('button', { type: 'button', class: 'cp-item', 'data-cp': id, onclick: () => openPage(id) }, h('span', { class: 'cp-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'cp-words' }, h('b', null, name, id === 'notifications' && n ? h('span', { class: 'okit-badge cp-badge' }, String(n)) : null), h('small', null, sub)), h('span', { class: 'cp-go', 'aria-hidden': 'true' }, '›'))
            )
          )
        )
      )
    )
  );
}
function openPage(id) {
  if (id === 'themes') return openThemes();
  setPage(id);
  kit.show(id);
}
function controlPanel(page = '') {
  closeMenus();
  if (page === 'themes') return openThemes();
  if (!openHost('Control Panel', { nav: true })) return;
  if (page) openPage(page);
  else cpHome();
}
function openThemes() {
  closeMenus();
  if (!openHost('Themes', { dock: true })) return;
  kit.themesLive(themesLive);
  kit.show('themes');
}

// ---------- menus (one at a time) ----------
let menu = null;
function closeMenus() {
  menu?.remove();
  menu = null;
}
document.addEventListener('pointerdown', (e) => menu && !e.target.closest('.okit-menu, .okit-more, .okit-plus, .okit-me') && closeMenus(), true);
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeMenus());
function popMenu(anchor, items, label) {
  closeMenus();
  menu = h(
    'div',
    { class: 'okit-menu', role: 'menu', 'aria-label': label },
    items.filter(Boolean).map((it) =>
      it === '-'
        ? h('hr')
        : h('button', { type: 'button', role: 'menuitem', class: it.danger ? 'danger' : '', onclick: () => { closeMenus(); it.run(); } }, it.icon ? h('span', { class: 'okit-mi', 'aria-hidden': 'true' }, it.icon) : null, it.label)
    )
  );
  document.body.append(menu);
  // Next to what opened it, inside the screen.
  const r = anchor.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const below = r.bottom + m.height + 8 < innerHeight;
  menu.style.top = `${Math.max(8, below ? r.bottom + 4 : r.top - m.height - 4)}px`;
  menu.style.left = `${Math.max(8, Math.min(innerWidth - m.width - 8, r.right - m.width))}px`;
  menu.querySelector('button')?.focus({ preventScroll: true });
}
function typeMenu(anchor) {
  popMenu(anchor, TYPES.map(([id, w, icon]) => ({ label: w, icon, run: () => newPost(id) })), 'New post');
}
function meMenu(anchor) {
  const n = badgeCount();
  popMenu(
    anchor,
    [
      { label: 'New post…', icon: '＋', run: () => typeMenu(anchor) },
      { label: n ? `Inbox (${n} waiting)` : 'Inbox', icon: '✉', run: () => controlPanel(n && owner.pendingComments?.length ? 'comments' : n && owner.pendingGuestbook?.length ? 'guestbook' : 'notifications') },
      { label: 'Posts, drafts and highlights', icon: '🗂', run: () => controlPanel('posts') },
      { label: 'Themes', icon: '🎨', run: () => openThemes() },
      { label: 'Control Panel', icon: '⚙', run: () => controlPanel() },
      '-',
      { label: previewing ? 'Back to owner view' : 'View as a visitor', icon: '👁', run: togglePreview },
      { label: 'Sign out', icon: '⎋', run: signOut }
    ],
    'You'
  );
}
function postMenu(anchor, p) {
  const shelf = SHELVES.includes(p.type);
  const rank = shelf ? kit.highlightRank(kit.post(p.key) || p) : 0;
  popMenu(
    anchor,
    [
      { label: 'Edit', icon: '✎', run: () => editPost(p, anchor.closest('[data-post]')) },
      { label: p.pinned ? 'Unpin' : 'Pin to the top', icon: '📌', run: () => kit.togglePin(kit.post(p.key) || p) },
      shelf ? { label: rank ? `Out of my highlights (№${rank})` : 'Add to my highlights', icon: '★', run: () => (rank ? kit.takeOutHighlight(kit.post(p.key) || p) : kit.addHighlight(kit.post(p.key) || p)) } : null,
      { label: p.friends_only ? 'For everyone' : 'Friends only', icon: '👥', run: () => kit.toggleFlag(kit.post(p.key) || p, 'friends_only', p.friends_only ? 'On the site for everyone.' : 'Friends only now: off the site.') },
      p.photos?.length ? { label: p.profile ? 'Off my profile grid' : 'On my profile grid', icon: '▦', run: () => kit.toggleFlag(kit.post(p.key) || p, 'profile', p.profile ? 'Off the grid.' : 'On your profile grid.') } : null,
      '-',
      { label: 'Delete…', icon: '🗑', danger: true, run: () => kit.remove(kit.post(p.key) || p) }
    ],
    `${p.title || 'Post'}: options`
  );
}

// ---------- signing out, and seeing it as a visitor ----------
function signOut() {
  if (host && !closeHost()) return;
  forgetOwner();
  // Cloudflare Access's own sign-out, then back to the site as a visitor.
  location.href = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? '/' : '/cdn-cgi/access/logout';
}
let previewBanner = null;
function togglePreview() {
  previewing = !previewing;
  document.documentElement.classList.toggle('owner-preview', previewing);
  if (previewing) {
    Object.assign(site.data, publicCopy);
    previewBanner = document.body.appendChild(h('div', { class: 'okit-preview', role: 'status' }, h('span', null, '👁 You’re seeing the site as a visitor does.'), h('button', { type: 'button', onclick: togglePreview }, 'Back to owner view')));
  } else {
    previewBanner?.remove();
    merge(site.data);
  }
  redraw();
}

// ---------- putting your tools on the page, wherever it's drawn ----------
function plusButton(cls) {
  const b = h('button', { type: 'button', class: `okit-plus ${cls}`, 'aria-label': 'New post', title: 'New post', 'aria-haspopup': 'menu', html: PLUS });
  b.addEventListener('click', () => typeMenu(b));
  return b;
}
function meButton(cls) {
  const name = owner.site?.owner || 'You';
  const b = h('button', { type: 'button', class: `okit-me ${cls}`, 'aria-label': `${name}: your menu`, title: name, 'aria-haspopup': 'menu' }, h('span', { class: 'okit-face', 'aria-hidden': 'true', html: ICON.person('#1d3f8a') }), h('span', { class: 'okit-name' }, name), h('span', { class: 'okit-badge', hidden: true }));
  b.addEventListener('click', () => meMenu(b));
  return b;
}
function badgeCount() {
  return (owner.pendingGuestbook?.length || 0) + (owner.pendingComments?.length || 0) + (owner.suggestions?.length || 0);
}
function decorateBars() {
  // The taskbar (computers, and the XP screens on a phone): + next to Explore, you in the tray.
  for (const bar of document.querySelectorAll('.taskbar:not([data-okit])')) {
    bar.dataset.okit = '1';
    bar.querySelector('.start-btn')?.after(plusButton('in-taskbar'));
    const tray = bar.querySelector('.tray');
    if (tray) tray.prepend(meButton('in-tray'));
  }
  // The Mac dock on a phone.
  for (const dock of document.querySelectorAll('.dock:not([data-okit])')) {
    dock.dataset.okit = '1';
    dock.append(plusButton('in-dock'), meButton('in-dock'));
  }
  // Screens with neither (the journal, the shelves…): the same two, floating at the bottom.
  const hasBar = [...document.querySelectorAll('.taskbar, .dock')].some((b) => b.offsetParent);
  let float = document.querySelector('.okit-float');
  if (!hasBar && !float) document.body.append(h('div', { class: 'okit-float' }, plusButton('floating'), meButton('floating')));
  else if (hasBar && float) float.remove();
  // (Room left at the foot of the page, so the floating pair never covers anything.)
  document.documentElement.classList.toggle('okit-floating', !hasBar);
  const n = badgeCount();
  for (const b of document.querySelectorAll('.okit-badge')) {
    b.hidden = !n;
    b.textContent = n ? String(n) : '';
  }
}
function stateOf(p) {
  if (p.draft) return ['draft', 'Draft'];
  if (p.ts > Date.now()) return ['later', `Scheduled · ${new Date(p.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`];
  if (p.friends_only) return ['friends', '👥 Friends only'];
  return null;
}
function decoratePosts() {
  for (const el of document.querySelectorAll('[data-post]:not([data-okit])')) {
    const p = postFor(el.dataset.post);
    if (!p) continue;
    el.dataset.okit = '1';
    const more = h('button', { type: 'button', class: 'okit-more', 'aria-label': `Options for ${p.title || 'this post'}`, 'aria-haspopup': 'menu', html: DOTS });
    more.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      postMenu(more, p);
    });
    const head = el.querySelector(':scope > .card-head');
    (head || el).append(more);
    if (!head) el.classList.add('okit-has-more');
    const st = stateOf(p);
    if (st) {
      el.classList.add('okit-hidden-post');
      (head || el).prepend(h('span', { class: `okit-state ${st[0]}` }, st[1]));
    }
  }
}

// ---------- doing things where they happen ----------
// Comments wait under their post, signatures in the guestbook, suggestions by the shelf they're
// for; your status changes where it shows; the planner, the trips wishlist and the highlights
// change in place. Each is one tap, saved straight away, with a word to say it's done.
const niceWhen = (d) => {
  const t = new Date(String(d).replace(' ', 'T'));
  return Number.isNaN(+t) ? '' : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const btn = (label, cls, run, extra = {}) => h('button', { type: 'button', class: `okit-btn ${cls || ''}`, ...extra, onclick: (e) => { e.preventDefault(); e.stopPropagation(); run(e); } }, label);
// (A button that's working says so, and can't be pressed twice.)
const busyOn = async (b, fn) => {
  if (b.disabled) return;
  b.disabled = true;
  try {
    await fn();
  } finally {
    b.disabled = false;
  }
};
function waitingCard(title, who, when, words, buttons) {
  return h('div', { class: 'okit-waiting' }, h('div', { class: 'okit-waiting-head' }, h('span', { class: 'okit-tag' }, title), h('b', null, who), h('small', null, when)), words ? h('p', null, words) : null, h('div', { class: 'okit-row' }, buttons));
}
// An inline box to write a reply (or a line on why), with Save; empty removes it.
function replyBox(start, label, onSave) {
  const ta = h('textarea', { class: 'okit-input', rows: 2, placeholder: label, 'aria-label': label });
  ta.value = start || '';
  const save = btn('Save', 'go', (e) => busyOn(e.currentTarget, () => onSave(ta.value.trim())));
  const box = h('div', { class: 'okit-replybox' }, ta, h('div', { class: 'okit-row' }, save));
  setTimeout(() => ta.focus(), 0);
  return box;
}

function decorateComments() {
  for (const sec of document.querySelectorAll('.comments[data-comments-for]:not([data-okit])')) {
    sec.dataset.okit = '1';
    const id = sec.dataset.commentsFor;
    const waiting = (owner.pendingComments || []).filter((c) => c.post === id);
    if (waiting.length) {
      const list = h(
        'div',
        { class: 'okit-waitlist', 'aria-label': 'Comments waiting for you' },
        h('h4', null, `Waiting for you · ${waiting.length}`),
        waiting.map((c) =>
          waitingCard('Comment', c.name, niceWhen(c.date), c.message, [
            btn('Delete', 'danger', (e) => busyOn(e.currentTarget, () => kit.act(() => kit.files.delFile(c.key), 'Deleted.'))),
            btn('Approve', 'go', (e) => busyOn(e.currentTarget, () => kit.act(() => kit.approveComment(c), 'Approved: it’s on the site now.')))
          ])
        )
      );
      sec.querySelector('.cm-title')?.after(list);
    }
    // Yours to answer, or take down.
    for (const li of sec.querySelectorAll('.cm-item[data-comment]')) {
      const c = (owner.approvedComments || []).find((x) => x.post === id && x.id === li.dataset.comment);
      if (!c) continue;
      const box = h('div', { class: 'okit-cm-box' });
      const reply = btn(c.reply ? 'Edit your reply' : 'Reply as you', '', () => box.replaceChildren(box.firstChild ? '' : replyBox(c.reply, 'Your reply (shown under theirs)', (text) => kit.act(() => kit.files.putFile(c.key, kit.commentText(c, text)), text ? 'Reply saved.' : 'Reply removed.'))));
      const del = btn('Delete', 'danger', (e) => confirm(`Delete ${c.name}’s comment?`) && busyOn(e.currentTarget, () => kit.act(() => kit.files.delFile(c.key), 'Deleted.')));
      li.querySelector(':scope > .cm-text')?.after(h('div', { class: 'okit-row okit-cm-tools' }, reply, del), box);
    }
    // (You answer as yourself above, not with the visitors' form.)
    sec.classList.add('okit-owner-comments');
  }
  // In the feed: how many are waiting, on the post they're for.
  for (const card of document.querySelectorAll('.card[data-post]:not([data-okit-cm])')) {
    card.dataset.okitCm = '1';
    const n = (owner.pendingComments || []).filter((c) => c.post === card.dataset.post).length;
    if (n) card.querySelector('.card-head')?.append(h('span', { class: 'okit-state waiting' }, `💬 ${n} waiting`));
  }
}

function decorateGuestbook() {
  const list = document.querySelector('[data-gb-list]:not([data-okit])');
  if (!list) return;
  list.dataset.okit = '1';
  const waiting = owner.pendingGuestbook || [];
  if (waiting.length) {
    const box = h(
      'div',
      { class: 'okit-waitlist', 'aria-label': 'Signatures waiting for you' },
      h('h4', null, `Waiting for you · ${waiting.length}`),
      waiting.map((g) =>
        waitingCard('Signature', g.name, niceWhen(g.date), g.message, [
          btn('Delete', 'danger', (e) => busyOn(e.currentTarget, () => kit.act(() => kit.files.delFile(g.key), 'Deleted.'))),
          btn('Approve', 'go', (e) => busyOn(e.currentTarget, () => kit.act(() => kit.files.move(g.key, g.key.replace('guestbook-pending/', 'guestbook/')), 'Approved: it’s on the site now.')))
        ])
      )
    );
    list.querySelector('.droid-section')?.after(box);
  }
  for (const el of list.querySelectorAll('.gb-entry[data-gb]')) {
    const [date, name] = el.dataset.gb.split('|');
    const g = (owner.approvedGuestbook || []).find((x) => String(x.date) === date && x.name === name);
    if (!g) continue;
    const box = h('div', { class: 'okit-cm-box' });
    el.querySelector('.gb-text')?.append(
      h('div', { class: 'okit-row okit-cm-tools' }, btn(g.reply ? 'Edit your reply' : 'Reply', '', () => box.replaceChildren(box.firstChild ? '' : replyBox(g.reply, 'Your reply', (text) => kit.act(() => kit.files.putFile(g.key, kit.gbText(g, text)), text ? 'Reply saved.' : 'Reply removed.')))), btn('Remove', 'danger', (e) => confirm(`Remove ${g.name}’s signature?`) && busyOn(e.currentTarget, () => kit.act(() => kit.files.delFile(g.key), 'Removed.')))),
      box
    );
  }
}

// Suggestions: next to the form they came from (the shelf they're for, or the trips wishlist).
const SUGGEST_KINDS = { place: ['place'], book: ['book'], film: ['film'], podcast: ['podcast'], music: ['music'], tv: ['tv'] };
function decorateSuggestions() {
  for (const box of document.querySelectorAll('.suggest-box[data-suggest]:not([data-okit])')) {
    box.dataset.okit = '1';
    const kinds = SUGGEST_KINDS[box.dataset.suggest] || [box.dataset.suggest];
    const these = (owner.suggestions || []).filter((sg) => kinds.includes(sg.kind || 'place'));
    if (!these.length) continue;
    box.before(
      h(
        'div',
        { class: 'okit-waitlist', 'aria-label': 'Suggestions for you' },
        h('h4', null, `Suggested to you · ${these.length}`),
        these.map((sg) =>
          waitingCard('Suggestion', sg.title, `from ${sg.from || 'a visitor'}`, sg.note, [
            btn('Delete', 'danger', (e) => busyOn(e.currentTarget, () => kit.act(() => kit.files.delFile(sg.key), 'Deleted.'))),
            btn(`Add to ${kit.suggestionGoesTo(sg).replace(/^your /, '')}`, 'go', (e) => busyOn(e.currentTarget, () => kit.act(() => kit.addSuggestion(sg), `Added to ${kit.suggestionGoesTo(sg)}.`)))
          ])
        )
      )
    );
  }
}

// Your status: tap ✎ by it, and change it there.
const PRESENCES = [['online', 'Online'], ['away', 'Away'], ['brb', 'Be right back'], ['lunch', 'Out to lunch'], ['busy', 'Busy'], ['offline', 'Appear offline']];
function decorateStatus() {
  for (const block of document.querySelectorAll('.status-block:not([data-okit])')) {
    block.dataset.okit = '1';
    const edit = btn('✎', 'okit-status-edit', () => {
      const open = block.querySelector('.okit-status-box');
      if (open) return open.remove();
      const text = h('input', { class: 'okit-input', value: owner.site?.status || '', maxlength: 140, placeholder: 'What are you up to? (try :) or (music))', 'aria-label': 'Your status' });
      let presence = owner.site?.presence || 'online';
      const chips = h('div', { class: 'okit-row okit-chips', role: 'radiogroup', 'aria-label': 'How you are' });
      const drawChips = () => chips.replaceChildren(...PRESENCES.map(([v, l]) => h('button', { type: 'button', role: 'radio', class: 'okit-chip', 'aria-checked': String(presence === v), onclick: () => { presence = v; drawChips(); } }, l)));
      drawChips();
      const save = btn('Save', 'go', (e) =>
        busyOn(e.currentTarget, () =>
          kit.act(async () => {
            if (presence !== (owner.site?.presence || 'online')) await kit.setSiteField('presence', presence === 'online' ? '' : presence);
            if (text.value.trim() !== (owner.site?.status || '')) await kit.setStatus(text.value.trim());
          }, 'Status updated.')
        )
      );
      text.addEventListener('keydown', (e) => e.key === 'Enter' && save.click());
      block.append(h('div', { class: 'okit-status-box' }, chips, text, h('div', { class: 'okit-row' }, btn('Cancel', '', () => block.querySelector('.okit-status-box')?.remove()), save)));
      text.focus();
    }, { 'aria-label': 'Change your status', title: 'Change your status' });
    block.querySelector('.status-pill')?.after(edit);
  }
}

// The planner: tick, take off and add, on the page.
// (One change at a time, each building on the last, even when you tap quickly.)
let saving = Promise.resolve();
const inTurn = (fn) => (saving = saving.then(fn, fn));
function savePlanner(change, msg) {
  return inTurn(() => {
    const lists = (owner.planner || []).map((l) => ({ ...l, items: l.items.map((x) => ({ text: x.text, done: x.done, due: x.due, note: x.note })) }));
    change(lists);
    owner.planner = lists;
    return kit.act(() => kit.files.putFile('planner.md', kit.plannerText(lists)), msg);
  });
}
function decoratePlanner() {
  for (const li of document.querySelectorAll('.pln-item[data-pl]:not([data-okit])')) {
    li.dataset.okit = '1';
    const [a, b] = li.dataset.pl.split(':').map(Number);
    const box = li.querySelector('.pln-box');
    if (box) {
      box.setAttribute('role', 'checkbox');
      box.setAttribute('aria-checked', String(li.classList.contains('done')));
      box.tabIndex = 0;
      box.classList.add('okit-tick');
      const tick = () => savePlanner((ls) => (ls[a].items[b].done = !ls[a].items[b].done), li.classList.contains('done') ? 'Not done yet.' : 'Done ✓');
      box.addEventListener('click', tick);
      box.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), tick()));
    }
    li.append(btn('×', 'okit-x', () => savePlanner((ls) => ls[a].items.splice(b, 1), 'Taken off.'), { 'aria-label': 'Take it off the list', title: 'Take it off' }));
  }
  // An empty planner: start one.
  for (const empty of document.querySelectorAll('[data-pl-empty]:not([data-okit])')) {
    empty.dataset.okit = '1';
    empty.after(h('div', { class: 'okit-row' }, btn('Start a to-do list, a wishlist and notes', 'go', (e) => busyOn(e.currentTarget, () => kit.act(() => kit.files.putFile('planner.md', kit.plannerText([{ name: 'To do', private: true, items: [], notes: '' }, { name: 'Wishlist', private: false, items: [], notes: '' }, { name: 'Notes', private: false, items: [], notes: '' }])), 'Your planner is ready.')))));
  }
  for (const page of document.querySelectorAll('.pln-list[data-pl-list]:not([data-okit])')) {
    page.dataset.okit = '1';
    if (page.dataset.plList === '') continue;
    const at = Number(page.dataset.plList);
    const text = h('input', { class: 'okit-input', maxlength: 200, placeholder: 'Add to this list…', 'aria-label': 'Add to this list' });
    const due = h('input', { class: 'okit-input okit-date', type: 'date', 'aria-label': 'By when (optional)' });
    const add = btn('Add', 'go', (e) => {
      const t = text.value.trim();
      if (!t) return text.focus();
      busyOn(e.currentTarget, () => savePlanner((ls) => ls[at].items.push({ text: t, done: false, due: due.value, note: '' }), 'Added.'));
    });
    text.addEventListener('keydown', (e) => e.key === 'Enter' && add.click());
    const form = h('div', { class: 'okit-row okit-add' }, text, due, add);
    (page.querySelector('.pln-items') || page.querySelector('.pln-count') || page.querySelector('.pln-title'))?.after(form);
  }
}

// The trips wishlist: add, tick off (been there), take off, on the page.
function saveWishlist(change, msg) {
  return inTurn(() => kit.act(async () => {
    const text = (await kit.files.readFile('wishlist.md')) ?? '# Want to go\n';
    await kit.files.putFile('wishlist.md', change(text));
  }, msg));
}
const wishLine = (lines, name) => lines.findIndex((l) => /^\s*[-*]\s+\[( |x|X)\]\s+/.test(l) && l.replace(/^\s*[-*]\s+\[( |x|X)\]\s+/, '').split(/,|\s+[—–-]\s+|\s\(/)[0].trim().toLowerCase() === name.trim().toLowerCase());
function decorateWishlist() {
  const pad = document.querySelector('[data-wishlist]:not([data-okit])');
  if (!pad) return;
  pad.dataset.okit = '1';
  const name = h('input', { class: 'okit-input', maxlength: 120, placeholder: 'A place you want to go', 'aria-label': 'Place' });
  const city = h('input', { class: 'okit-input', maxlength: 60, placeholder: 'City (optional)', 'aria-label': 'City' });
  const add = btn('Add', 'go', (e) => {
    const n = name.value.trim().replace(/[\n,]/g, ' ');
    if (!n) return name.focus();
    const c = city.value.trim().replace(/[\n,]/g, ' ');
    busyOn(e.currentTarget, () => saveWishlist((t) => t.replace(/\s*$/, '\n') + `- [ ] ${n}${c ? `, ${c}` : ''}\n`, 'On the list.'));
  });
  name.addEventListener('keydown', (e) => e.key === 'Enter' && add.click());
  pad.querySelector('.mac-label')?.before(h('div', { class: 'okit-row okit-add okit-wish-add' }, name, city, add));
  for (const el of pad.querySelectorAll('.wish[data-wish]')) {
    const n = el.dataset.wish;
    const done = el.classList.contains('done');
    const flip = (e) => busyOn(e.currentTarget, () => saveWishlist((t) => {
      const lines = t.split('\n');
      const i = wishLine(lines, n);
      if (i >= 0) lines[i] = lines[i].replace(/\[( |x|X)\]/, done ? '[ ]' : '[x]');
      return lines.join('\n');
    }, done ? 'Back on the list.' : 'Been there ✓'));
    const check = el.querySelector('.aqua-check');
    if (check) {
      check.removeAttribute('aria-hidden');
      check.setAttribute('role', 'checkbox');
      check.setAttribute('aria-checked', String(done));
      check.setAttribute('aria-label', done ? `${n}: been there` : `${n}: tick when you’ve been`);
      check.tabIndex = 0;
      check.classList.add('okit-tick');
      check.addEventListener('click', flip);
      check.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), flip(e)));
    }
    el.append(btn('×', 'okit-x', (e) => confirm(`Take ${n} off the list?`) && busyOn(e.currentTarget, () => saveWishlist((t) => {
      const lines = t.split('\n');
      const i = wishLine(lines, n);
      if (i >= 0) lines.splice(i, 1);
      return lines.join('\n');
    }, 'Taken off.')), { 'aria-label': `Take ${n} off the list`, title: 'Take it off' }));
  }
}

// The highlights: in the closer look, its line on why, its place on the shelf, or out.
function decorateHighlights() {
  for (const label of document.querySelectorAll('.cab-museum[data-hl]')) {
    if (label.dataset.okit === label.dataset.hl) continue;
    label.dataset.okit = label.dataset.hl;
    label.querySelector('.okit-hl')?.remove();
    const id = label.dataset.hl;
    const shelf = id.split('/')[0];
    const all = kit.highlights();
    const list = all[shelf] || [];
    const i = list.findIndex((x) => x.post === id);
    if (i < 0) continue;
    const save = (change, msg) => kit.act(async () => {
      const now = kit.highlights();
      change(now[shelf]);
      await kit.saveHighlights(now);
    }, msg);
    const box = h('div', { class: 'okit-cm-box' });
    label.append(
      h(
        'div',
        { class: 'okit-hl' },
        h(
          'div',
          { class: 'okit-row' },
          btn(list[i].why ? 'Change why it’s here' : 'Say why it’s here', '', () => box.replaceChildren(box.firstChild ? '' : replyBox(list[i].why, 'Why it’s here (a line visitors read)', (text) => save((l) => (l[i].why = text.slice(0, 160)), 'Saved.')))),
          btn('‹ Earlier', '', () => save((l) => l.splice(i - 1, 0, l.splice(i, 1)[0]), `Now №${i}.`), { disabled: i === 0 || null }),
          btn('Later ›', '', () => save((l) => l.splice(i + 1, 0, l.splice(i, 1)[0]), `Now №${i + 2}.`), { disabled: i === list.length - 1 || null }),
          btn('Take out', 'danger', () => confirm('Take it out of the cabinet? (It goes into the library as a book.)') && save((l) => l.splice(i, 1), 'Out of the cabinet.'))
        ),
        box
      )
    );
  }
}

let decorating = false;
function decorate() {
  writing();
  if (decorating || previewing) return;
  decorating = true;
  try {
    decorateBars();
    decoratePosts();
    decorateComments();
    decorateGuestbook();
    decorateSuggestions();
    decorateStatus();
    decoratePlanner();
    decorateWishlist();
    decorateHighlights();
  } finally {
    decorating = false;
  }
}

export async function startOwner(s) {
  site = s;
  keepPublic(site.data);
  await loadStyles();
  kit.attach({ panel: null, toast, changed });
  try {
    await kit.refresh();
  } catch (e) {
    toast(e.message, true);
    return;
  }
  document.documentElement.classList.add('owner-on');
  ownerHooks.holding = () => writing();
  ownerHooks.trying = () => trying;
  ownerHooks.fresh = (d) => {
    keepPublic(d);
    merge(d);
  };
  // Whatever the site draws next gets your tools.
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      decorate();
    });
  }).observe(document.body, { childList: true, subtree: true });
  decorate();
}
