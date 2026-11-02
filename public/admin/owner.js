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
  toastEl ||= document.body.appendChild(h('div', { class: 'okit-toast', role: 'status', 'aria-live': 'polite' }));
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
function keepPublic(d) {
  publicCopy = { posts: d.posts, planner: d.planner, highlights: d.highlights, highlightsPast: d.highlightsPast };
}
function merge(d) {
  if (!owner || previewing) return;
  // (A post whose header can't be read stays in the Control Panel, where it can be fixed.)
  d.posts = owner.posts.filter((p) => !p.error);
  d.planner = owner.planner;
  d.highlights = owner.highlights;
  d.highlightsPast = owner.highlightsPast;
}
let redrawSoon;
function redraw() {
  clearTimeout(redrawSoon);
  redrawSoon = setTimeout(() => site.redraw(), 30);
}
function changed(d) {
  owner = d;
  merge(site.data);
  redraw();
}

// ---------- the window (computer) or sheet (phone) the back office draws in ----------
let host = null;
function closeHost(force = false) {
  if (!host) return true;
  if (!force && kit.editing() && !confirm('Close without saving what you’ve written? (It’s kept in this browser, so you can carry on later.)')) return false;
  const was = host;
  host = null;
  was.el.remove();
  document.documentElement.classList.remove('okit-open');
  if (history.state?.okit) history.back();
  return true;
}
window.addEventListener('popstate', () => {
  if (!host) return;
  // Back closes the window or sheet (asking first if there's unsaved writing).
  if (kit.editing() && !confirm('Close without saving what you’ve written? (It’s kept in this browser, so you can carry on later.)')) {
    history.pushState({ okit: 1 }, '', location.href);
    return;
  }
  const was = host;
  host = null;
  was.el.remove();
  document.documentElement.classList.remove('okit-open');
});
function openHost(title, { nav = false } = {}) {
  if (host && !closeHost()) return null;
  const sections = nav ? h('nav', { class: 'admin-sections', 'aria-label': 'Control Panel' }) : null;
  const tabs = nav ? h('nav', { class: 'admin-tabs', role: 'tablist', 'aria-label': 'Pages in this section' }) : null;
  const body = h('main', { class: 'admin-body' });
  // (In the site's own window style, so the theme dresses it like every other window.)
  const titleEl = h('span', { class: 'xp-title-text' }, title);
  const close = h('button', { type: 'button', class: 'xp-ctl close okit-close', 'aria-label': 'Close' }, '×');
  const bar = h('div', { class: 'xp-title okit-bar' }, h('span', { class: 'okit-ico', 'aria-hidden': 'true', html: nav ? GEAR : PLUS }), titleEl, close);
  const el = h('section', { class: `okit okit-host xp-window ${site.desktop ? 'okit-win' : 'okit-sheet'}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, bar, sections, tabs, body);
  close.addEventListener('click', () => closeHost());
  el.addEventListener('keydown', (e) => e.key === 'Escape' && !e.target.closest('input, textarea, select') && closeHost());
  // On a computer it's a window you can move by its title bar.
  if (site.desktop) dragBy(bar, el);
  document.body.append(el);
  document.documentElement.classList.add('okit-open');
  history.pushState({ okit: 1 }, '', location.href);
  host = { el, body, titleEl, sections, tabs };
  kit.attach({
    panel: body,
    tabs,
    sections,
    toast,
    changed,
    editorDone: () => closeHost(true)
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

// ---------- the things you do ----------
const TYPE_WORD = Object.fromEntries(TYPES.map(([id, w]) => [id, w]));
function newPost(type) {
  closeMenus();
  if (!openHost(`New ${TYPE_WORD[type].toLowerCase()}`)) return;
  if (!kit.write(type)) closeHost(true);
}
async function editPost(p) {
  closeMenus();
  if (!openHost(`Edit ${(p.title || TYPE_WORD[p.type] || 'post').slice(0, 40)}`)) return;
  await kit.edit(p.key);
}
function controlPanel(page = 'posts') {
  closeMenus();
  if (!openHost('Control Panel', { nav: true })) return;
  kit.show(page);
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
      { label: 'Themes', icon: '🎨', run: () => controlPanel('themes') },
      { label: 'Control Panel', icon: '⚙', run: () => controlPanel('site') },
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
      { label: 'Edit', icon: '✎', run: () => editPost(p) },
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
let decorating = false;
function decorate() {
  if (decorating || previewing) return;
  decorating = true;
  try {
    decorateBars();
    decoratePosts();
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
