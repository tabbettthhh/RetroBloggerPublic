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
// - Your friends' posts are mixed into your Home (only you see that), each as it looks on their
//   site with who it's from on top; you can comment on them right there, and a dot on Friends
//   says when there's something new.
import { h, ICON, registerCategories } from '/js/util.js';
import { registerKeepsakes } from '/js/keepsake-maker.js';
import { pictureHtml, hasPicture } from '/js/pictures.js';
import { kit } from '/admin/admin.js';
import { forgetOwner, ownerHooks } from '/js/owner-door.js';
import { rebuildRoom } from '/js/cabinet.js';
import { applySkin } from '/js/skins.js';
import { sound } from '/js/sound.js';
import { pushState, currentSub, signUp, signOff, deviceName, isIOS } from '/js/push-client.js';
import { mountMap } from '/js/maps.js';
import { refreshSite } from '/js/refresh.js';
import { reactionRow } from '/js/reactions.js';
import { MIDDLES } from '/admin/countries.js';

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
let owner = null; // everything, as you see it signed in (drafts and all)
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
// (And what visitors see of your friends, which may be nothing.)
const FRIENDS = ['buddies', 'friendPosts', 'friendLooks', 'friendKeepsakes', 'friendCategories', 'friendsTab', 'friendsInHome', 'ownerView'];
function keepPublic(d) {
  publicCopy = Object.fromEntries([...MINE, ...FRIENDS].map((k) => [k, d[k]]));
}
// `fromSite`: the site's own copy has just been fetched afresh, so its theme is the newest (it
// may have been changed on another device since your copy was read); yours is then read again.
function merge(d, fromSite = false) {
  if (!owner || previewing) return;
  // (A post whose header can't be read stays in the Control Panel, where it can be fixed.)
  d.posts = owner.posts.filter((p) => !p.error);
  for (const k of MINE.slice(1)) if (owner[k] !== undefined && !(fromSite && k === 'theme')) d[k] = owner[k];
  // (Whose site it is, for the Explore menu: yours, with your name and picture.)
  d.ownerView = true;
  // Your friends, all of them, whoever else sees them: the Friends tab, and (unless you've said
  // not to) their posts in your Home.
  const fm = owner.friendsMine;
  if (fm) {
    Object.assign(d, { buddies: fm.buddies || [], friendDays: fm.days || [], friendPosts: fm.posts || [], friendLooks: fm.looks || {}, friendKeepsakes: fm.keepsakes || [], friendCategories: fm.categories || [], friendsTab: true, friendsInHome: fm.inHome === false ? [] : fm.posts || [] });
    registerCategories(d.friendCategories);
    registerKeepsakes([...(d.keepsakes?.custom || []), ...d.friendKeepsakes]);
  }
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
  showFaces();
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
function openHost(title, { nav = false, dock = false, icon = '' } = {}) {
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
  const bar = h('div', { class: 'xp-title okit-bar' }, back, h('span', { class: 'okit-ico', 'aria-hidden': 'true', html: icon || (nav || dock ? GEAR : PLUS) }), titleEl, tuck, close);
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
  ['Writing', [['posts', 'Posts & drafts', 'Every post, drafts and scheduled ones included: find, pin, edit', '🗂'], ['highlights', 'Highlights', 'The cabinet’s shelves, in order, with why', '★'], ['planner', 'Planner', 'Your lists, private ones too', '📒'], ['email', 'Post by email', 'Email your site, and it’s a post (photos too)', '📧']]],
  ['People', [['notifications', 'Inbox', 'Comments, signatures, suggestions, nudges, friends’ news', '✉'], ['friends', 'Friends', 'Your buddies, and who sees what', '👥'], ['mail', 'Mail', 'Notes from friends, and ones you’ve sent', '📨'], ['notify', 'Notifications', 'On your phone or computer, even with the site closed', '🔔'], ['status', 'Status', 'How you are, your message, a countdown', '💬']]],
  ['Look', [['themes', 'Themes', 'Colours, wallpaper, fonts and the rest, on your real site as you choose', '🎨'], ['designs', 'Designs', 'The visa in your passport, and keepsakes of your own', '🎟']]],
  ['Your site', [['privacy', 'Privacy', 'Who sees your posts: everyone, friends or only you', '🔒'], ['picture', 'Your picture', 'A photo of you, or one of the site’s own pictures', '🖼'], ['site', 'Site & wishlist', 'Its name, about you, the small print, place categories, the trips wishlist', '🏠'], ['travel', 'Travel stats', 'The flight log in your passport', '✈'], ['visitors', 'Visitors', 'How many, and which countries they come from', '🌍'], ['files', 'Export & files', 'Download everything, import, all your files', '💾']]]
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
  host.mail = false;
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
      ),
      // The safety net: the plain editor, if something on the site ever stops working.
      versionLine(),
      h('p', { class: 'cp-plain' }, 'Something on your site not working? ', h('a', { href: '/admin/plain', target: '_blank', rel: 'noopener' }, 'Open the plain editor'), ' (everything here, in plain pages).')
    )
  );
}
// At the foot of the Control Panel: whether your site has the latest version. (A copy made with
// the Deploy button brings each new version in by itself overnight.)
const niceVersion = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : String(v || '');
};
function versionLine() {
  const line = h('div', { class: 'cp-version', role: 'status' }, h('span', null, 'Checking for a newer version…'));
  const show = async (again) => {
    let v;
    try {
      v = await kit.version(again);
    } catch {
      return line.replaceChildren(h('span', null, 'Couldn’t check for a newer version just now.'));
    }
    const repo = `https://github.com/${v.template}`;
    const ago = v.at ? ` (checked ${new Date(v.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})` : '';
    const again2 = btn('Check again', 'link', (e) => busyOn(e.currentTarget, () => show(true)));
    if (!v.latest) return line.replaceChildren(h('span', null, `Version of ${niceVersion(v.mine)}. Couldn’t reach GitHub to check for a newer one just now. `), again2);
    if (v.latest <= v.mine) return line.replaceChildren(h('span', { class: 'cp-ok' }, `✓ Up to date: the version of ${niceVersion(v.mine)}${ago}. `), again2);
    line.classList.add('behind');
    line.replaceChildren(
      h('b', null, `A newer version is ready (${niceVersion(v.latest)}; yours is ${niceVersion(v.mine)}).`),
      h('span', null, ' A copy made with the Deploy button brings it in by itself overnight. To have it now: your site’s repository on GitHub › Actions › Update my site › Run workflow. Still not arriving? '),
      h('a', { href: `${repo}#getting-updates`, target: '_blank', rel: 'noopener' }, 'Getting updates'),
      h('span', null, ' has the one-time setup for sites made before updates existed. '),
      again2
    );
  };
  show(false);
  return line;
}
function openPage(id) {
  if (id === 'themes') return openThemes();
  if (id === 'mail') {
    setPage(id);
    return drawMail(host.body);
  }
  if (id === 'notify') {
    setPage(id);
    if (host) host.mail = false;
    return drawNotify(host.body);
  }
  if (id === 'visitors') {
    setPage(id);
    if (host) host.mail = false;
    return drawVisitors(host.body);
  }
  if (id === 'email') {
    setPage(id);
    if (host) host.mail = false;
    return drawEmail(host.body);
  }
  if (id === 'privacy') {
    setPage(id);
    if (host) host.mail = false;
    return drawPrivacy(host.body);
  }
  if (host) host.mail = false;
  setPage(id);
  kit.show(id);
}
// Visitors: how many have come, and from which countries (only a count for each: Cloudflare's own
// reckoning of where a connection comes from, never anything about anyone).
function drawVisitors(body) {
  const by = Object.entries(owner?.visitorCountries || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  let names = null;
  try {
    names = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {}
  const name = (cc) => names?.of(cc) || cc;
  const total = by.reduce((n, [, x]) => n + x, 0);
  const map = h('div', { class: 'okit-visit-map' });
  body.replaceChildren(
    h(
      'div',
      { class: 'nt okit-visitors' },
      h('p', { class: 'okit-lead' }, `${(owner?.counter || 0).toLocaleString('en-GB')} visits so far${by.length ? `, from ${by.length} ${by.length === 1 ? 'country' : 'countries'}` : ''}.`),
      by.length ? map : h('p', { class: 'okit-note' }, 'Countries show here as visits come in.'),
      by.length
        ? h(
            'ol',
            { class: 'okit-visit-list' },
            by.slice(0, 40).map(([cc, n]) => h('li', null, h('span', null, name(cc)), h('span', { class: 'okit-visit-bar', style: { '--w': `${Math.max(4, Math.round((n / by[0][1]) * 100))}%` } }), h('b', null, n.toLocaleString('en-GB'))))
          )
        : null,
      h('p', { class: 'okit-note' }, `Only a count for each country is kept: Cloudflare’s own reckoning of where a visit’s connection comes from, never anything about anyone. Each visit counts once, and your own visits never count.${total < (owner?.counter || 0) ? ' (Visits from before this was added aren’t on the map.)' : ''}`)
    )
  );
  if (by.length) mountMap(map, { places: by.filter(([cc]) => MIDDLES[cc]).map(([cc, n]) => ({ lat: MIDDLES[cc][0], lon: MIDDLES[cc][1], title: name(cc), count: n, unit: n === 1 ? 'visit' : 'visits' })), heat: true, style: 'mac', zoom: 2 });
}
function controlPanel(page = '') {
  closeMenus();
  if (page === 'themes') return openThemes();
  if (page === 'mail') return openMail();
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
      { label: mailBox.unread ? `Mail (${mailBox.unread} new)` : 'Mail', icon: '📨', run: () => openMail() },
      { label: 'Posts, drafts and highlights', icon: '🗂', run: () => controlPanel('posts') },
      { label: 'Themes', icon: '🎨', run: () => openThemes() },
      { label: 'Your picture', icon: '🖼', run: () => controlPanel('picture') },
      { label: 'Control Panel', icon: '⚙', run: () => controlPanel() },
      '-',
      { label: previewing ? 'Back to owner view' : 'View as a visitor', icon: '👁', run: togglePreview },
      { label: 'Refresh (everything fresh)', icon: '↻', run: () => refreshSite() },
      { label: 'Sign out', icon: '⎋', run: signOut }
    ],
    'You'
  );
}
// Who sees a post: everyone, friends or only you (nothing more open than the whole site is).
function whoMenu(anchor, p) {
  const now = p.only_me ? 2 : p.friends_only ? 1 : 0;
  const site = kit.siteLevel();
  const choices = [
    ['🌍', 'Everyone'],
    ['👥', 'Friends only'],
    ['🔒', 'Only me']
  ];
  popMenu(
    anchor,
    [
      ...choices.map(([icon, label], i) => (i < site ? null : { label: (i === now ? '✓ ' : '') + label, icon, run: () => i !== now && kit.setLevel(kit.post(p.key) || p, i) })),
      site ? '-' : null,
      site ? { label: 'Whole site’s privacy…', icon: '⚙', run: () => controlPanel('privacy') } : null
    ].filter((x) => x !== null),
    'Who sees it'
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
      p.friends_only || p.only_me ? null : { label: p.start_here ? 'Not “Start here” any more' : 'Start here (new visitors see it first)', icon: '👋', run: () => kit.toggleFlag(kit.post(p.key) || p, 'start_here', p.start_here ? 'Back in its usual place.' : 'New visitors see it first now, until they close it.') },
      shelf ? { label: rank ? `Out of my highlights (№${rank})` : 'Add to my highlights', icon: '★', run: () => (rank ? kit.takeOutHighlight(kit.post(p.key) || p) : kit.addHighlight(kit.post(p.key) || p)) } : null,
      { label: `Who sees it: ${p.only_me ? 'only me' : p.friends_only ? 'friends' : 'everyone'}…`, icon: p.only_me ? '🔒' : p.friends_only ? '👥' : '🌍', run: () => whoMenu(anchor, p) },
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
    for (const d of document.querySelectorAll('.okit-ndot')) d.remove();
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
  const b = h('button', { type: 'button', class: `okit-me ${cls}`, 'aria-label': `${name}: your menu`, title: name, 'aria-haspopup': 'menu' }, h('span', { class: 'okit-face', 'aria-hidden': 'true' }), h('span', { class: 'okit-name' }, name), h('span', { class: 'okit-badge', hidden: true }));
  showFaces(b);
  b.addEventListener('click', () => meMenu(b));
  return b;
}
// Your picture and name on your tile (in the taskbar, the dock or floating), kept up to date.
let faceShown = '';
function showFaces(only) {
  const pic = owner?.site?.picture || '';
  const name = owner?.site?.owner || 'You';
  if (!only && faceShown === pic + '|' + name) return;
  if (!only) faceShown = pic + '|' + name;
  for (const b of only ? [only] : document.querySelectorAll('.okit-me')) {
    const face = b.querySelector('.okit-face');
    face.classList.toggle('has-pic', hasPicture(pic));
    face.innerHTML = pictureHtml(pic, '#1d3f8a');
    b.querySelector('.okit-name').textContent = name;
    b.setAttribute('aria-label', `${name}: your menu`);
    b.title = name;
  }
}
// In the Explore menu, signed in, your picture changes it (as XP's did).
function decorateStartHead() {
  for (const av of document.querySelectorAll('.sm-head.mine .avatar:not([data-okit])')) {
    av.dataset.okit = '1';
    Object.assign(av, { role: 'button', tabIndex: 0, title: 'Change your picture' });
    av.setAttribute('aria-label', 'Change your picture');
    av.classList.add('okit-pic-btn');
    const go = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // (The menu closes first: on a phone by its backdrop, on a computer by its button.)
      const scrim = document.querySelector('.start-scrim:not([hidden])');
      if (scrim) scrim.click();
      else document.querySelector('.start-btn.pressed')?.click();
      controlPanel('picture');
    };
    av.addEventListener('click', go);
    av.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && go(e));
  }
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
    if (tray) tray.prepend(meButton('in-tray'), mailButton('in-tray'));
  }
  // The Mac dock on a phone.
  for (const dock of document.querySelectorAll('.dock:not([data-okit])')) {
    dock.dataset.okit = '1';
    dock.append(plusButton('in-dock'), mailButton('in-dock'), meButton('in-dock'));
  }
  // Screens with neither (the journal, the shelves…): the same two, floating at the bottom.
  const hasBar = [...document.querySelectorAll('.taskbar, .dock')].some((b) => b.offsetParent);
  let float = document.querySelector('.okit-float');
  if (!hasBar && !float) document.body.append(h('div', { class: 'okit-float' }, plusButton('floating'), mailButton('floating'), meButton('floating')));
  else if (hasBar && float) float.remove();
  // (Room left at the foot of the page, so the floating pair never covers anything.)
  document.documentElement.classList.toggle('okit-floating', !hasBar);
  const n = badgeCount();
  for (const b of document.querySelectorAll('.okit-me .okit-badge')) {
    b.hidden = !n;
    b.textContent = n ? String(n) : '';
  }
}
function stateOf(p) {
  if (p.draft) return ['draft', 'Draft'];
  if (p.ts > Date.now()) return ['later', `Scheduled · ${new Date(p.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`];
  if (p.only_me) return ['me', '🔒 Only me'];
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
    // (No header strip, as on a journal page or a review: the ⋯ sits beside the title, which
    // wraps around it, so a long title is never hidden under it. Failing that, in the corner.)
    const title = head ? null : el.querySelector(':scope > :is(h1, h2, h3)');
    const st = stateOf(p);
    const badge = st ? h('span', { class: `okit-state ${st[0]}` }, st[1]) : null;
    if (st) el.classList.add('okit-hidden-post');
    if (head) {
      head.append(more);
      if (badge) head.prepend(badge);
    } else if (title) {
      more.classList.add('by-title');
      badge?.classList.add('by-title');
      title.before(...[more, badge].filter(Boolean));
    } else {
      el.classList.add('okit-has-more');
      el.append(more);
      if (badge) el.prepend(badge);
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
        waitingCard(g.card ? '📮 Postcard' : 'Signature', g.name, niceWhen(g.date), g.message, [
          btn('Delete', 'danger', (e) => busyOn(e.currentTarget, () => kit.act(() => kit.files.delFile(g.key), 'Deleted.'))),
          btn('Approve', 'go', (e) => busyOn(e.currentTarget, () => kit.act(() => kit.files.move(g.key, g.key.replace('guestbook-pending/', 'guestbook/')), 'Approved: it’s on the site now.')))
        ])
      )
    );
    list.querySelector('.droid-section')?.after(box);
  }
  // (Signatures, and postcards: each can be answered or taken off.)
  for (const el of list.querySelectorAll('.gb-entry[data-gb], .gb-postcard[data-gb]')) {
    const [date, name] = el.dataset.gb.split('|');
    const g = (owner.approvedGuestbook || []).find((x) => String(x.date) === date && x.name === name);
    if (!g) continue;
    const box = h('div', { class: 'okit-cm-box' });
    el.querySelector('.gb-text, .gbp-back')?.append(
      h('div', { class: 'okit-row okit-cm-tools' }, btn(g.reply ? 'Edit your reply' : 'Reply', '', () => box.replaceChildren(box.firstChild ? '' : replyBox(g.reply, 'Your reply', (text) => kit.act(() => kit.files.putFile(g.key, kit.gbText(g, text)), text ? 'Reply saved.' : 'Reply removed.')))), btn('Remove', 'danger', (e) => confirm(`Remove ${g.name}’s ${g.card ? 'postcard' : 'signature'}?`) && busyOn(e.currentTarget, () => kit.act(() => kit.files.delFile(g.key), 'Removed.')))),
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
const plannerTyping = {};
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
    // (What you're typing survives the list being drawn again, after a tick saved a moment ago.)
    const typed = plannerTyping[at];
    if (typed) {
      text.value = typed.text;
      due.value = typed.due;
      if (typed.focus) setTimeout(() => text.focus(), 0);
    }
    const remember = () => (plannerTyping[at] = { text: text.value, due: due.value, focus: document.activeElement === text });
    text.addEventListener('input', remember);
    due.addEventListener('change', remember);
    text.addEventListener('blur', () => plannerTyping[at] && (plannerTyping[at].focus = false));
    const add = btn('Add', 'go', (e) => {
      const t = text.value.trim();
      if (!t) return text.focus();
      delete plannerTyping[at];
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

// ---------- your friends ----------
// On each of their posts (in your Home and on Friends): its comments, and yours to add. Yours
// go straight on at their site, under your name, linking to yours; their visitors' still wait
// for them to approve.
const friendOf = (key) => (owner.friendsMine?.buddies || []).find((b) => b.key === key) || null;
const friendPostOf = (key, id) => (owner.friendsMine?.posts || []).find((p) => p.friend?.key === key && p.id === id) || null;
const openTalk = new Set(); // posts whose comments you had open (kept open as the page redraws)
function sendToFriend(key, id, text, replyTo, b) {
  return busyOn(b, () => kit.act(() => kit.friendComment(key, id, text, replyTo), 'Posted on their site.'));
}
function talkBox(key, id, replyTo, who) {
  const me = owner.site?.owner || owner.site?.name || 'you';
  const label = replyTo ? `Reply to ${who} as ${me}…` : `Comment as ${me}…`;
  const ta = h('textarea', { class: 'okit-input', rows: 2, maxlength: 1000, placeholder: label, 'aria-label': label });
  const send = btn(replyTo ? 'Reply' : 'Post', 'go', (e) => {
    if (ta.value.trim().length < 2) return ta.focus();
    sendToFriend(key, id, ta.value.trim(), replyTo, e.currentTarget);
  });
  ta.addEventListener('keydown', (e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && send.click());
  return h('div', { class: 'okit-replybox okit-talk-box' }, ta, h('div', { class: 'okit-row' }, send));
}
function talkList(p, key, mine, canTalk) {
  const all = p.comments || [];
  const top = all.filter((c) => !c.reply_to || !all.some((x) => x.id === c.reply_to));
  const who = p.friend?.owner || p.friend?.name || 'They';
  const one = (c, replies) => {
    const box = h('div');
    const isMe = c.site && c.site === mine;
    return h(
      'li',
      { class: 'okit-talk-item' + (isMe ? ' me' : '') },
      h('div', { class: 'okit-talk-head' }, h('b', null, isMe ? 'You' : c.name), c.site && !isMe ? h('small', { class: 'okit-tag' }, '👥 friend') : null, h('small', null, niceWhen(c.date))),
      h('p', null, c.message),
      c.reply ? h('div', { class: 'okit-talk-reply' }, h('b', null, who), ' ', c.reply) : null,
      replies.length ? h('ul', { class: 'okit-talk-list' }, replies.map((r) => one(r, []))) : null,
      canTalk && !c.reply_to && !isMe ? btn('Reply', 'link', () => box.replaceChildren(box.firstChild ? '' : talkBox(key, p.id, c.id, c.name)), { 'aria-label': `Reply to ${c.name}` }) : null,
      box
    );
  };
  return top.length ? h('ul', { class: 'okit-talk-list' }, top.map((c) => one(c, all.filter((x) => x.reply_to === c.id)))) : h('p', { class: 'okit-talk-none' }, 'No comments yet.');
}
function decorateFriendPosts() {
  for (const el of document.querySelectorAll('[data-friend-post]:not([data-okit])')) {
    const [key, id] = el.dataset.friendPost.split('|');
    const p = friendPostOf(key, id);
    if (!p) continue;
    el.dataset.okit = '1';
    const f = friendOf(key);
    const canTalk = !!f?.comments_on;
    const n = (p.comments || []).length;
    const panel = h('div', { class: 'okit-talk', hidden: true }, talkList(p, key, owner.friendsMine?.me || '', canTalk), canTalk ? talkBox(key, id, '', '') : h('p', { class: 'okit-talk-none' }, `${f?.owner || f?.name || 'They'} can’t take comments from friends just now (they’re switched off, or their site needs updating).`));
    const toggle = btn(n ? `💬 ${n} comment${n === 1 ? '' : 's'}` : '💬 Comment', 'okit-talk-btn', () => {
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
      if (panel.hidden) openTalk.delete(el.dataset.friendPost);
      else {
        openTalk.add(el.dataset.friendPost);
        panel.querySelector(':scope > .okit-talk-box textarea')?.focus();
      }
    }, { 'aria-expanded': 'false' });
    if (openTalk.has(el.dataset.friendPost)) {
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    }
    // (And a note, just to them.)
    const note = btn('✉ Note', 'okit-talk-note', () => sendTo(key), { 'aria-label': `Send ${f?.owner || f?.name || 'them'} a note`, title: `Send ${f?.owner || f?.name || 'them'} a note` });
    // Tagged in it: said on top. A shared album: your photos can go in it too.
    if (p.tagged) el.querySelector('.ff-who small')?.append(h('span', { class: 'ff-tagged' }, ' · 🏷 with you'));
    const add = p.album_open ? albumButton(key, id, f) : null;
    // A ♥, a ☆, a smile or any emoji, as on your own posts: it goes to their site.
    const reacts = reactionRow(p, null, 'ff-react', { key: `react:friend:${key}|${id}`, send: (ask) => kit.reactToFriend(key, id, ask) });
    if (reacts) el.append(reacts);
    // (No plain link to it, which only shows what any visitor sees: their house in the
    // neighbourhood, on Friends, takes you to their site as their friend.)
    el.querySelector(':scope > .ff-open, .ff-open')?.remove();
    el.append(h('div', { class: 'okit-talk-wrap' }, h('div', { class: 'okit-row' }, toggle, note, add), panel));
  }
}
// Off to a friend's site as their friend: a pass from it (asked for by your site, signed), then
// their site in a new tab, at the post. (The tab is opened straight away, so it isn't blocked.)
async function visitFriend(key, where = '') {
  const tab = window.open('', '_blank');
  try {
    if (tab) tab.opener = null;
  } catch {}
  try {
    const { url } = await kit.visitFriend(key);
    let hash = '';
    try {
      hash = new URL(where).hash;
    } catch {}
    if (tab) tab.location.href = url + hash;
    else location.href = url + hash;
  } catch (e) {
    tab?.close();
    toast(e.message, true);
  }
}
// "📷 Add photos" on a friend's shared album: pick a few, and each goes to their site in turn.
function albumButton(key, id, f) {
  const who = f?.owner || f?.name || 'their';
  const pick = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  const b = btn('📷 Add photos', 'okit-album-add', () => pick.click(), { title: `Add your photos to ${who === 'their' ? 'their' : who + '’s'} album` });
  pick.addEventListener('change', async () => {
    const files = [...pick.files].slice(0, 10);
    pick.value = '';
    if (!files.length) return;
    b.disabled = true;
    let done = 0;
    try {
      for (const file of files) {
        b.textContent = `📷 Sending ${done + 1} of ${files.length}…`;
        await kit.addToAlbum(key, id, file, '', done === files.length - 1);
        done++;
      }
      toast(`${done === 1 ? 'Your photo is' : `Your ${done} photos are`} in ${who === 'their' ? 'their' : who + '’s'} album.`);
    } catch (e) {
      toast(done ? `${done} sent, then: ${e.message}` : e.message, true);
    }
    b.disabled = false;
    b.textContent = '📷 Add photos';
  });
  return h('span', null, b, pick);
}
// On the Friends tab: who else sees it, and where to change that.
function decorateFriendsTab() {
  const feed = document.querySelector('.feed.ff:not([data-okit])');
  if (!feed) return;
  feed.dataset.okit = '1';
  const seen = owner.friendsMine?.postsSeen || 'me';
  const say = { everyone: '👁 Everyone can see this tab and your friends’ posts on it.', friends: '👥 Your friends can see this tab when they visit your site. Other visitors don’t see your friends’ posts.', me: '🔒 Only you can see this tab: your visitors don’t see your friends’ posts.' };
  // (After the neighbourhood, which always comes first.)
  const line = feed.querySelector(':scope > .nb');
  (line ? (n) => line.after(n) : (n) => feed.prepend(n))(h('div', { class: 'okit-note' }, h('span', null, say[seen] || say.me), btn('Change', '', () => controlPanel('friends'))));
  decorateHouses(feed);
  // (A stroll to another street and back draws the houses again: they get theirs again too.)
  new MutationObserver(() => decorateHouses(feed)).observe(feed, { childList: true, subtree: true });
}
// A knocker by each friend's house in the neighbourhood, and a note to slip through the door.
function decorateHouses(feed) {
  for (const plot of feed.querySelectorAll('.nb-plot[data-house]:not([data-okit])')) {
    plot.dataset.okit = '1';
    const b = (owner.friendsMine?.buddies || []).find((x) => x.url === plot.dataset.house);
    if (!b?.key) continue;
    const who = (b.owner || b.name || 'them').split(/\s+/)[0];
    plot.append(btn('✊', 'okit-knock', () => knockOn(b.key, who), { title: `Knock on ${who}’s door`, 'aria-label': `Knock on ${who}’s door` }));
    plot.append(btn('✉', 'okit-knock okit-slip', () => sendTo(b.key), { title: `Send ${who} a note`, 'aria-label': `Send ${who} a note` }));
  }
}
// Knocking on a friend's door: three raps, their house jumps, and their site hears of it (signed
// in there, it gives a little shake and says it was you).
const houseOf = (key) => {
  const b = friendOf(key);
  return b ? document.querySelector(`.nb-plot[data-house="${CSS.escape(b.url)}"]`) : null;
};
function jolt(el) {
  if (!el) return;
  el.classList.remove('nb-knocked');
  void el.offsetWidth;
  el.classList.add('nb-knocked');
}
async function knockOn(key, who) {
  sound.knock?.();
  jolt(houseOf(key));
  try {
    await kit.mail.knock(key);
    toast(`Knock knock! ${who} will hear it at their site.`);
  } catch (e) {
    toast(e.message, true);
  }
}
// Someone knocked on yours (told once; unheard knocks are kept a day): the site
// shakes, three raps, and a little notice says who, with a way to knock back.
const KNOCK_SEEN = 'okit-knock-seen';
let knockEl = null;
function showKnocks() {
  const all = mailBox.knocks || [];
  if (!all.length || previewing) return;
  let seen = 0;
  try {
    seen = Number(localStorage.getItem(KNOCK_SEEN)) || 0;
  } catch {}
  const fresh = all.filter((k) => k.at > seen);
  if (!fresh.length) return;
  try {
    localStorage.setItem(KNOCK_SEEN, String(all[0].at));
  } catch {}
  kit.mail.knocksHeard().catch(() => {});
  const newest = fresh[0];
  const first = (n) => String(n || 'A friend').split(/\s+/)[0];
  const others = [...new Set(fresh.slice(1).map((k) => first(k.name)))].filter((n) => n !== first(newest.name));
  knockEl?.remove();
  const close = () => {
    knockEl?.classList.remove('on');
    const el = knockEl;
    setTimeout(() => el?.remove(), 300);
    knockEl = null;
  };
  knockEl = h(
    'aside',
    { class: 'okit okit-mailpop okit-knockpop' + (site.desktop ? ' balloon' : ' banner'), role: 'status', 'aria-live': 'polite', 'aria-label': 'A knock at the door' },
    h('div', { class: 'mp-head' }, h('span', { class: 'mp-env', 'aria-hidden': 'true' }, '🚪'), h('b', null, 'Knock knock!'), h('button', { type: 'button', class: 'mp-x', 'aria-label': 'Close', onclick: close }, '×')),
    h('div', { class: 'mp-body' }, h('span', { class: 'ml-av', 'aria-hidden': 'true' }, initialOf(newest.name)), h('div', null, h('b', null, first(newest.name)), h('p', null, `knocked on your door at ${whenOf(newest.at)}.${others.length ? ` (So did ${others.join(', ')}.)` : ''}`))),
    h(
      'div',
      { class: 'okit-row mp-acts' },
      btn('Visit', '', () => {
        close();
        visitFriend(newest.friend);
      }),
      btn('Knock back', 'go', () => {
        close();
        knockOn(newest.friend, first(newest.name));
      })
    )
  );
  document.body.append(knockEl);
  requestAnimationFrame(() => knockEl?.classList.add('on'));
  sound.knock?.();
  document.documentElement.classList.add('okit-shook');
  setTimeout(() => document.documentElement.classList.remove('okit-shook'), 700);
  jolt(houseOf(newest.friend));
  setTimeout(() => knockEl && close(), 30000);
}
// A dot on Friends, wherever it's shown (the menus, the desktop, the dock), while there are
// posts you haven't seen yet. Opening Friends clears it.
const SEEN = 'okit-friends-seen';
function friendsSeen() {
  try {
    const v = Number(localStorage.getItem(SEEN));
    if (v) return v;
  } catch {}
  return Date.now() - 7 * 24 * 60 * 60 * 1000;
}
function newFromFriends() {
  const seen = friendsSeen();
  return (owner?.friendsMine?.posts || []).filter((p) => p.ts > seen && p.ts <= Date.now()).length;
}
function friendsDot() {
  if (/^#\/friends\b/.test(location.hash)) {
    const latest = Math.max(0, ...(owner?.friendsMine?.posts || []).map((p) => p.ts || 0));
    if (latest > friendsSeen()) {
      try {
        localStorage.setItem(SEEN, String(latest));
      } catch {}
    }
  }
  const n = previewing ? 0 : newFromFriends();
  const spots = new Set();
  for (const icon of document.querySelectorAll('.dock-icon.di-friends')) spots.add(icon);
  for (const a of document.querySelectorAll('a[href="#/friends"]')) if (!a.querySelector('.di-friends')) spots.add(a);
  for (const spot of spots) {
    let dot = spot.querySelector(':scope > .okit-ndot');
    if (!n) {
      dot?.remove();
      continue;
    }
    const text = n > 9 ? '9+' : String(n);
    if (!dot) {
      spot.classList.add('okit-has-ndot');
      spot.append((dot = h('span', { class: 'okit-ndot ' + (spot.classList.contains('dock-icon') ? 'on-icon' : 'on-word'), role: 'status' })));
    }
    if (dot.textContent !== text) dot.textContent = text;
    dot.setAttribute('aria-label', `${n} new from friends`);
  }
}
window.addEventListener('hashchange', () => owner && friendsDot());

// ---------- mail: notes between friends ----------
// A friend's site can send yours a short note. When one comes in, the newest pops up (a balloon
// over the tray on a computer, a banner along the top on a phone); every note, read or not,
// waits in Mail, with the ones you've sent. Only you ever see them, signed in.
const mailBox = { notes: [], unread: 0, knocks: [], friends: [], loaded: false };
const POPPED = 'okit-mail-popped';
const MAIL_EVERY = 90 * 1000;
let mailAt = 0;
let mailView = { folder: 'in', open: '', compose: null };
const initialOf = (s) => (String(s || '?').trim()[0] || '?').toUpperCase();
const MAIL_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const whenOf = (t) => {
  const d = new Date(t);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
async function loadMail(force = false) {
  if (!force && Date.now() - mailAt < 20 * 1000) return;
  mailAt = Date.now();
  try {
    Object.assign(mailBox, await kit.mail.list(), { loaded: true });
  } catch {
    return;
  }
  showMailCount();
  popNewest();
  showKnocks();
  // (Mail that's open shows what came in.)
  if (host?.mail) drawMail(host.body, true);
}
function startMail() {
  loadMail(true);
  setInterval(() => !document.hidden && loadMail(), MAIL_EVERY);
  document.addEventListener('visibilitychange', () => !document.hidden && loadMail());
}
function mailButton(cls) {
  const b = h('button', { type: 'button', class: `okit-mailbtn ${cls}`, 'aria-label': 'Mail', title: 'Mail', html: MAIL_ICON });
  b.append(h('span', { class: 'okit-badge', hidden: true }));
  b.addEventListener('click', () => openMail());
  setTimeout(showMailCount, 0);
  return b;
}
function showMailCount() {
  const n = mailBox.unread;
  for (const b of document.querySelectorAll('.okit-mailbtn')) {
    const badge = b.querySelector('.okit-badge');
    badge.hidden = !n;
    badge.textContent = n ? (n > 9 ? '9+' : String(n)) : '';
    b.classList.toggle('has-new', !!n);
    b.setAttribute('aria-label', n ? `Mail: ${n} new` : 'Mail');
  }
}
// The newest unread note, once: it pops up. (Any others are in Mail.)
let popEl = null;
let popTimer;
function popNewest() {
  const newest = mailBox.notes.find((n) => !n.out && !n.read);
  if (!newest || previewing || host?.mail) return;
  let popped = '';
  try {
    popped = localStorage.getItem(POPPED) || '';
  } catch {}
  if (newest.id <= popped) return;
  try {
    localStorage.setItem(POPPED, newest.id);
  } catch {}
  popEl?.remove();
  const others = mailBox.unread - 1;
  const close = () => {
    clearTimeout(popTimer);
    popEl?.classList.remove('on');
    const el = popEl;
    setTimeout(() => el?.remove(), 300);
    popEl = null;
  };
  popEl = h(
    'aside',
    { class: 'okit okit-mailpop' + (site.desktop ? ' balloon' : ' banner'), role: 'status', 'aria-live': 'polite', 'aria-label': 'New mail' },
    h('div', { class: 'mp-head' }, h('span', { class: 'mp-env', 'aria-hidden': 'true', html: MAIL_ICON }), h('b', null, 'You have new mail'), h('button', { type: 'button', class: 'mp-x', 'aria-label': 'Close', onclick: close }, '×')),
    h('div', { class: 'mp-body' }, h('span', { class: 'ml-av', 'aria-hidden': 'true' }, initialOf(newest.name)), h('div', null, h('b', null, newest.name), h('p', null, newest.text))),
    h(
      'div',
      { class: 'okit-row mp-acts' },
      others > 0 ? h('small', null, `and ${others} more in Mail`) : null,
      btn('Reply', '', () => {
        close();
        openMail({ open: newest.id, compose: { to: newest.friend, reply: newest.id } });
      }),
      btn('Read it', 'go', () => {
        close();
        openMail({ open: newest.id });
      })
    )
  );
  document.body.append(popEl);
  requestAnimationFrame(() => popEl?.classList.add('on'));
  sound.chime?.();
  popTimer = setTimeout(close, 20000);
}
function openMail(view = {}) {
  closeMenus();
  if (popEl) popEl.querySelector('.mp-x')?.click();
  mailView = { folder: 'in', open: '', compose: null, ...view };
  if (!openHost('Mail', { icon: MAIL_ICON.replace('fill="#fff"', 'fill="none"').replace('currentColor', '#fff').replace('currentColor', '#fff') })) return;
  host.mail = true;
  host.el.classList.add('okit-mailwin');
  drawMail(host.body);
  loadMail(true);
}
function sendTo(key, reply = '') {
  openMail({ folder: 'in', compose: { to: key, reply } });
}
// Mail: the folders (in, sent), the list, and a note (or a new one) beside it, or on its own on
// a narrow screen.
function drawMail(body, quietly = false) {
  if (!host) return;
  host.mail = true;
  host.el.classList.add('okit-mailwin');
  const v = mailView;
  const list = mailBox.notes.filter((n) => (v.folder === 'out' ? n.out : !n.out));
  const note = mailBox.notes.find((n) => n.id === v.open) || null;
  // (Reading a note marks it read.)
  if (note && !note.out && !note.read) {
    note.read = true;
    mailBox.unread = Math.max(0, mailBox.unread - 1);
    showMailCount();
    kit.mail.read([note.id]).catch(() => {});
  }
  const pick = (patch) => {
    Object.assign(mailView, patch);
    drawMail(body);
  };
  const folder = (id, label, n) => h('button', { type: 'button', class: 'ml-folder', 'aria-pressed': String(v.folder === id), onclick: () => pick({ folder: id, open: '', compose: null }) }, label, n ? h('span', { class: 'okit-badge' }, String(n)) : null);
  const toolbar = h(
    'div',
    { class: 'ml-bar' },
    btn('✎ New note', 'go', () => pick({ compose: { to: mailBox.friends[0]?.key || '', reply: '' }, open: '' }), { disabled: !mailBox.friends.length || null }),
    h('div', { class: 'ml-folders', role: 'group', 'aria-label': 'Folders' }, folder('in', 'Inbox', mailBox.unread), folder('out', 'Sent', 0))
  );
  const rows = list.length
    ? h(
        'ul',
        { class: 'ml-list', role: 'list' },
        list.map((n) =>
          h(
            'li',
            null,
            h(
              'button',
              { type: 'button', class: 'ml-row' + (n.out || n.read ? '' : ' unread') + (n.id === v.open ? ' on' : ''), 'aria-current': n.id === v.open ? 'true' : null, onclick: () => pick({ open: n.id, compose: null }) },
              h('span', { class: 'ml-av', 'aria-hidden': 'true' }, initialOf(n.name)),
              h('span', { class: 'ml-words' }, h('span', { class: 'ml-top' }, h('b', null, (n.out ? 'To ' : '') + n.name), h('small', null, whenOf(n.at))), h('span', { class: 'ml-snip' }, n.text))
            )
          )
        )
      )
    : h('p', { class: 'ml-empty' }, v.folder === 'out' ? 'Nothing sent yet.' : mailBox.friends.length ? 'No mail yet. Notes from your friends arrive here.' : 'No mail yet. Once you have friends (Control Panel › Friends), you can send each other notes.');
  let pane;
  if (v.compose) {
    const to = h('select', { class: 'okit-input ml-to', 'aria-label': 'To' }, mailBox.friends.map((f) => h('option', { value: f.key, selected: f.key === v.compose.to }, f.name)));
    const ta = h('textarea', { class: 'okit-input ml-text', rows: 6, maxlength: 600, placeholder: 'Write a note…', 'aria-label': 'Your note' });
    ta.value = v.compose.text || '';
    const count = h('small', { class: 'ml-count' }, `${ta.value.length}/600`);
    ta.addEventListener('input', () => {
      v.compose.text = ta.value;
      count.textContent = `${ta.value.length}/600`;
    });
    const replyTo = v.compose.reply ? mailBox.notes.find((n) => n.id === v.compose.reply) : null;
    pane = h(
      'div',
      { class: 'ml-pane ml-compose' },
      h('div', { class: 'ml-back-row' }, btn('‹ Back', 'link ml-back', () => pick({ compose: null }))),
      h('label', { class: 'ml-field' }, h('span', null, 'To'), to),
      replyTo ? h('blockquote', { class: 'ml-quote' }, h('small', null, `${replyTo.name} wrote:`), replyTo.text) : null,
      ta,
      h('div', { class: 'okit-row ml-send' }, count, btn('Send', 'go', (e) => {
        const text = ta.value.trim();
        if (!text) return ta.focus();
        busyOn(e.currentTarget, async () => {
          try {
            await kit.mail.send(to.value, text, v.compose.reply || '');
            const who = mailBox.friends.find((f) => f.key === to.value)?.name || 'them';
            toast(`Sent to ${who}.`);
            mailView = { folder: 'out', open: '', compose: null };
            await loadMail(true);
            drawMail(body);
          } catch (err) {
            toast(err.message, true);
          }
        });
      })),
      h('p', { class: 'ml-hint' }, 'It goes straight to their site, where only they can read it.')
    );
    setTimeout(() => (v.compose.to ? ta : to).focus({ preventScroll: true }), 0);
  } else if (note) {
    pane = h(
      'article',
      { class: 'ml-pane ml-read' },
      h('div', { class: 'ml-back-row' }, btn(v.folder === 'out' ? '‹ Sent' : '‹ Inbox', 'link ml-back', () => pick({ open: '' }))),
      h('header', { class: 'ml-from' }, h('span', { class: 'ml-av big', 'aria-hidden': 'true' }, initialOf(note.name)), h('div', null, h('b', null, (note.out ? 'To ' : 'From ') + note.name), h('small', null, new Date(note.at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })), /^https?:\/\//.test(note.site) ? h('a', { href: note.site, target: '_blank', rel: 'noopener noreferrer' }, note.site.replace(/^https?:\/\//, '')) : null)),
      h('p', { class: 'ml-body' }, note.text),
      h(
        'div',
        { class: 'okit-row ml-acts' },
        note.still ? btn(note.out ? 'Write again' : 'Reply', 'go', () => pick({ compose: { to: note.friend, reply: note.out ? '' : note.id } })) : h('small', null, 'No longer a friend.'),
        !note.out ? btn('Mark unread', '', () => {
          note.read = false;
          mailBox.unread++;
          showMailCount();
          kit.mail.read([note.id], false).catch(() => {});
          pick({ open: '' });
        }) : null,
        btn('Delete', 'danger', (e) =>
          confirm('Delete this note?') &&
          busyOn(e.currentTarget, async () => {
            try {
              await kit.mail.remove(note.id);
              mailBox.notes = mailBox.notes.filter((n) => n.id !== note.id);
              toast('Deleted.');
              pick({ open: '' });
            } catch (err) {
              toast(err.message, true);
            }
          })
        )
      )
    );
  } else pane = h('div', { class: 'ml-pane ml-none' }, h('span', { class: 'ml-big-env', 'aria-hidden': 'true', html: MAIL_ICON }), h('p', null, list.length ? 'Pick a note to read it.' : ''));
  const wrap = h('div', { class: 'ml' + (v.compose || note ? ' reading' : '') }, toolbar, h('div', { class: 'ml-split' }, h('div', { class: 'ml-side' }, rows), pane));
  // (Side by side when there's room; one at a time when there isn't.)
  const fit = () => wrap.classList.toggle('narrow', wrap.clientWidth < 560);
  if (quietly && v.compose) return; // (Never redrawn under your hands while you write.)
  body.replaceChildren(wrap);
  fit();
  new ResizeObserver(fit).observe(wrap);
}
// ---------- notifications ----------
// Control Panel › Notifications: this device on or off, what you're told about, a test, your
// other devices, and whether visitors may ask to hear when you post. (See src/push.js.)
async function drawNotify(body) {
  body.replaceChildren(h('p', { class: 'okit-note' }, 'Loading…'));
  let st;
  try {
    st = await kit.push.status();
  } catch (e) {
    body.replaceChildren(h('p', { class: 'okit-note' }, e.message));
    return;
  }
  const state = pushState();
  const mine = await currentSub();
  const here = mine && st.devices.some((d) => d.endpoint === mine.endpoint);
  const again = () => drawNotify(body);
  const act = (fn, msg) => async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      await fn();
      if (msg) toast(msg);
      await again();
    } catch (err) {
      toast(err.message, true);
      b.disabled = false;
    }
  };
  const thisDevice = h(
    'section',
    { class: 'nt-box' },
    h('h3', null, 'This device'),
    state === 'homescreen'
      ? h('p', null, `On ${isIOS() ? 'an iPhone or iPad' : 'this device'}, notifications only work from the Home Screen: tap Share, then “Add to Home Screen”, open the site from there, sign in, and come back here.`)
      : state === 'unsupported'
        ? h('p', null, 'This browser can’t show notifications. Try another browser, or your phone.')
        : state === 'blocked'
          ? h('p', null, 'Notifications are blocked for this site in this browser’s settings. Allow them there, then come back.')
          : here
            ? h('div', null, h('p', { class: 'nt-on' }, `🔔 On, as “${deviceName()}”.`), h('div', { class: 'okit-row' }, btn('Send a test', 'go', act(() => kit.push.test(), 'Sent: it should arrive in a moment.')), btn('Turn off here', '', act(async () => kit.push.unsubscribe(await signOff()), 'Off on this device.'))))
            : h('div', null, h('p', null, 'Get told about the things you choose below on this device, even when the site isn’t open.'), btn('🔔 Turn on notifications here', 'go', act(async () => kit.push.subscribe(await signUp(st.publicKey), deviceName()), 'On: you’ll be told here.')))
  );
  const kinds = [
    ['comments', 'Comments waiting for you', 'And guestbook signatures, suggestions, and comments from friends'],
    ['notes', 'Notes from friends', 'When a friend sends you a note (Mail)'],
    ['friends', 'Friends’ new posts', 'When a friend posts something new'],
    ['email', 'Posts sent by email', 'When an email you sent becomes a post (or a draft)']
  ];
  const choose = (k) => (e) => kit.push.settings({ kinds: { [k]: e.target.checked } }).then(() => toast('Saved.'), (err) => toast(err.message, true));
  const what = h('section', { class: 'nt-box' }, h('h3', null, 'Tell me about'), kinds.map(([k, label, sub]) => h('label', { class: 'nt-check' }, h('input', { type: 'checkbox', checked: st.kinds[k], onchange: choose(k) }), h('span', null, h('b', null, label), h('small', null, sub)))));
  const devices = h(
    'section',
    { class: 'nt-box' },
    h('h3', null, 'Your devices'),
    st.devices.length
      ? h(
          'ul',
          { class: 'nt-devices' },
          st.devices.map((d) => h('li', null, h('span', null, h('b', null, d.name || 'A device'), h('small', null, ` since ${new Date(d.since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}${mine?.endpoint === d.endpoint ? ' · this one' : ''}`)), btn('Remove', 'danger', act(() => kit.push.unsubscribe(d.endpoint), 'Removed.'))))
        )
      : h('p', { class: 'nt-none' }, 'None yet.')
  );
  const visitors = h(
    'section',
    { class: 'nt-box' },
    h('h3', null, 'Visitors'),
    h(
      'label',
      { class: 'nt-check' },
      h('input', { type: 'checkbox', checked: st.visitors, onchange: (e) => kit.push.settings({ visitors: e.target.checked }).then(() => toast(e.target.checked ? 'Visitors can ask to hear when you post.' : 'Off: visitors aren’t told about new posts.'), (err) => toast(err.message, true)) }),
      h('span', null, h('b', null, 'Let visitors ask to hear when I post'), h('small', null, 'A 🔔 Notify me button appears by your name. Only visitors who tap it, and allow it, are told; only about your new posts, never anything else. Nothing about them is kept but the address their browser gives for it.'))
    ),
    h('p', { class: 'nt-count' }, st.visitorCount ? `${st.visitorCount} ${st.visitorCount === 1 ? 'visitor gets' : 'visitors get'} notified when you post.` : 'Nobody has asked yet.')
  );
  body.replaceChildren(h('div', { class: 'nt' }, thisDevice, what, devices, visitors));
}
// ---------- privacy, all at once ----------
// Control Panel › Privacy: who sees your posts, every one of them at once. More private changes
// every post there and then; more open changes none (the ones still more private than the site
// are listed, to open up again all together or one by one).
const LEVEL_NAMES = [
  ['public', '🌍', 'Everyone', 'Visitors and friends see your posts (apart from any you’ve made more private).'],
  ['friends', '👥', 'Friends', 'Visitors still get your site (About, guestbook, its look) but no posts. Friends see them, on their sites.'],
  ['me', '🔒', 'Only me', 'Nobody else sees any post: not visitors, not friends. Visitors get your site, with a little something instead.']
];
function drawPrivacy(body) {
  const posts = (owner?.posts || []).filter((p) => !p.error && p.key);
  const site = kit.siteLevel();
  const levelOf = (p) => (p.only_me ? 2 : p.friends_only ? 1 : 0);
  const still = posts.filter((p) => levelOf(p) > site).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const busy = h('p', { class: 'pv-busy', role: 'status' });
  const again = () => drawPrivacy(body);
  const choose = async (i) => {
    if (i === site) return;
    const more = posts.filter((p) => levelOf(p) < i).length;
    if (i > site && more && !confirm(`Make ${more === 1 ? 'your 1 post' : `all ${more} posts`} that ${more === 1 ? 'is' : 'are'} more open ${i === 2 ? 'only for you' : 'friends only'}?\n\nSwitching back later won’t open them up again: you’d do that here, all together or one by one.`)) return;
    body.querySelectorAll('button').forEach((b) => (b.disabled = true));
    busy.textContent = more && i > site ? `Changing ${more} posts…` : 'Saving…';
    try {
      const out = await kit.privacy.set(LEVEL_NAMES[i][0], (n, left) => left && (busy.textContent = `Changed ${n}; ${left} to go…`));
      toast(i > site && out.changed ? `Done: ${out.changed} post${out.changed === 1 ? '' : 's'} made ${i === 2 ? 'only for you' : 'friends only'}.` : `Your site is set to ${LEVEL_NAMES[i][2].toLowerCase()} now.`);
    } catch (e) {
      toast(e.message, true);
    }
    again();
  };
  const reopen = async (keys, label) => {
    body.querySelectorAll('button').forEach((b) => (b.disabled = true));
    busy.textContent = 'Opening up…';
    try {
      const out = await kit.privacy.reopen(keys, LEVEL_NAMES[site][0]);
      toast(`${label || (out.changed === 1 ? '1 post' : `${out.changed} posts`)}: ${site === 1 ? 'friends only now' : 'for everyone now'}.`);
    } catch (e) {
      toast(e.message, true);
    }
    again();
  };
  const cards = h(
    'div',
    { class: 'pv-levels', role: 'radiogroup', 'aria-label': 'Who sees your posts' },
    LEVEL_NAMES.map(([k, icon, name, what], i) =>
      h('button', { type: 'button', role: 'radio', class: 'pv-level' + (i === site ? ' on' : ''), 'aria-checked': String(i === site), 'data-level': k, onclick: () => choose(i) }, h('span', { class: 'pv-ico', 'aria-hidden': 'true' }, icon), h('b', null, name), h('small', null, what))
    )
  );
  const word = (p) => (p.only_me ? '🔒 Only me' : '👥 Friends only');
  const when = (p) => (p.ts ? new Date(p.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  // A few at once: tick them (or all of them), then open up just those.
  const picked = new Set();
  const to = site === 1 ? 'friends only' : 'for everyone';
  const shown = still.slice(0, 200);
  const all = h('input', { type: 'checkbox', class: 'pv-all', 'aria-label': 'Choose them all' });
  const openPicked = btn('Open up the ones ticked', 'pv-open-picked', () => {
    const keys = [...picked];
    if (keys.length && confirm(`Make ${keys.length === 1 ? 'this one' : `these ${keys.length}`} ${to}?`)) reopen(keys, keys.length === 1 ? '1 post' : `${keys.length} posts`);
  });
  const sync = () => {
    openPicked.disabled = !picked.size;
    openPicked.textContent = picked.size ? `Open up ${picked.size} ticked` : 'Open up the ones ticked';
    all.checked = picked.size === shown.length;
    all.indeterminate = picked.size > 0 && picked.size < shown.length;
  };
  const boxes = [];
  all.addEventListener('change', () => {
    for (const [key, box] of boxes) {
      box.checked = all.checked;
      all.checked ? picked.add(key) : picked.delete(key);
    }
    sync();
  });
  const row = (p) => {
    const box = h('input', { type: 'checkbox', class: 'pv-pick', 'aria-label': `Choose “${p.title || p.excerpt || p.slug}”` });
    box.addEventListener('change', () => {
      box.checked ? picked.add(p.key) : picked.delete(p.key);
      sync();
    });
    boxes.push([p.key, box]);
    return h(
      'li',
      { 'data-key': p.key },
      // (The whole row ticks its box, apart from its own button.)
      h('label', { class: 'pv-row' }, box, h('span', { class: 'pv-badge' }, word(p)), h('span', { class: 'pv-title' }, p.title || p.excerpt || p.slug), h('small', null, [TYPE_WORD[p.type] || '', when(p)].filter(Boolean).join(' · '))),
      btn('Open up', 'pv-open', () => reopen([p.key], p.title ? `“${p.title}”` : 'That post'))
    );
  };
  const list = still.length
    ? h(
        'section',
        { class: 'nt-box pv-still' },
        h('h3', null, `Still more private than that (${still.length})`),
        h('p', null, `These stay as they are until you open them up: one at a time, the ones you tick, or all of them. Opening one up makes it ${to}, like the rest.`),
        h('div', { class: 'pv-bar' }, h('label', { class: 'pv-all-label' }, all, h('span', null, 'All')), openPicked, btn(`Open up all ${still.length}`, '', () => confirm(`Make all ${still.length} ${to}?`) && reopen(null, `All ${still.length}`))),
        h('ul', { class: 'pv-list' }, shown.map(row))
      )
    : site < 2
      ? h('section', { class: 'nt-box' }, h('p', { class: 'nt-none' }, `Every post is as open as your site: ${site === 1 ? 'friends only' : 'for everyone'}.`))
      : null;
  sync();
  body.replaceChildren(
    h(
      'div',
      { class: 'nt pv' },
      h('section', { class: 'nt-box' }, h('h3', null, '🔒 Who sees your posts'), h('p', null, 'All of them, at once. Making it more private changes every post there and then. Making it more open changes none of them: any still more private are listed below, to open up when you choose.'), cards, busy),
      list
    )
  );
}

// ---------- posting by email ----------
// Control Panel › Post by email: on or off, your secret address (and how to set it up on
// Cloudflare), the addresses you send from, drafts or straight on, and the last few emails.
async function drawEmail(body) {
  body.replaceChildren(h('p', { class: 'okit-note' }, 'Loading…'));
  let st;
  try {
    st = await kit.email.get();
  } catch (e) {
    body.replaceChildren(h('p', { class: 'okit-note' }, e.message));
    return;
  }
  const again = () => drawEmail(body);
  const act = (fn, msg) => async (e) => {
    const b = e?.currentTarget;
    if (b) b.disabled = true;
    try {
      await fn();
      if (msg) toast(msg);
      await again();
    } catch (err) {
      toast(err.message, true);
      if (b) b.disabled = false;
    }
  };
  const senders = h('textarea', { class: 'em-senders', rows: 2, 'aria-label': 'Your email addresses, one a line', placeholder: 'you@example.com' }, st.senders.join('\n'));
  const list = () => senders.value.split(/[\s,;]+/).filter(Boolean);
  const from = h('section', { class: 'nt-box' }, h('h3', null, 'Sent from'), h('p', null, 'Only emails from these addresses of yours become posts (one a line). Anyone else’s are dropped.'), senders, h('div', { class: 'okit-row' }, btn('Save addresses', '', act(() => kit.email.set({ senders: list() }), 'Saved.'))));
  if (!st.on) {
    body.replaceChildren(
      h(
        'div',
        { class: 'nt em' },
        h('section', { class: 'nt-box' }, h('h3', null, '📧 Post by email'), h('p', null, 'Write an email, attach some photos, send it to your site’s own secret address: it’s a post. The subject is its title. With photos it’s a photo dump; without, a thought.'), h('p', { class: 'em-small' }, 'It needs a domain of your own on Cloudflare (for its free Email Routing). Turn it on to see the steps.')),
        from,
        h('div', { class: 'okit-row' }, btn('Turn on', 'go', act(() => kit.email.set({ on: true, senders: list() }), 'On. Now the steps below.')))
      )
    );
    return;
  }
  const word = `post-${st.word}`;
  const copy = btn('Copy', '', () => navigator.clipboard?.writeText(word).then(() => toast('Copied.'), () => toast(word)));
  const steps = h(
    'section',
    { class: 'nt-box' },
    h('h3', null, 'Your secret address'),
    h('p', { class: 'em-address' }, h('code', null, word), h('span', null, '@your-domain'), copy),
    h(
      'ol',
      { class: 'em-steps' },
      h('li', null, 'In Cloudflare, open your domain (it needs to be on Cloudflare), then ', h('b', null, 'Email › Email Routing'), ', and switch it on if it isn’t.'),
      h('li', null, 'Under ', h('b', null, 'Routing rules'), ', ', h('b', null, 'Create address'), ': type ', h('code', null, word), ', choose the action ', h('b', null, 'Send to a Worker'), ', and pick your site.'),
      h('li', null, 'Send an email to ', h('code', null, word + '@your-domain'), ' from one of your addresses below. Keep the address to yourself, like a password.')
    ),
    h('div', { class: 'okit-row' }, btn('New secret address', '', (e) => confirm('Make a new secret address? The old one stops working straight away (change it in Cloudflare too).') && act(() => kit.email.set({ newWord: true }), 'A new address. Change it in Cloudflare too.')(e)))
  );
  const draft = h('input', { type: 'checkbox', checked: st.draft, onchange: (e) => kit.email.set({ draft: e.target.checked }).then(() => toast(e.target.checked ? 'Emailed posts wait as drafts for you.' : 'Emailed posts go straight on the site.'), (err) => toast(err.message, true)) });
  const how = h('section', { class: 'nt-box' }, h('h3', null, 'When one arrives'), h('label', { class: 'nt-check' }, draft, h('span', null, h('b', null, 'Keep it as a draft for me to check first'), h('small', null, 'Untick it to put emailed posts straight on the site. Either way, [draft] or [now] in a subject decides for that email.'))));
  const when = (t) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const log = h(
    'section',
    { class: 'nt-box' },
    h('h3', null, 'Lately'),
    st.log.length
      ? h(
          'ul',
          { class: 'em-log' },
          st.log.map((e) => h('li', { class: e.ok ? 'ok' : 'no' }, h('b', null, e.ok ? (e.draft ? '📝 A draft' : '✅ Posted') : '✋ Not posted'), h('small', null, ` · ${when(e.at)}${e.from ? ' · ' + e.from : ''}`), e.title ? h('span', null, ' “', e.title, '”') : null, e.why ? h('small', { class: 'em-why' }, e.why) : null))
        )
      : h('p', { class: 'nt-none' }, 'Nothing yet.')
  );
  body.replaceChildren(h('div', { class: 'nt em' }, steps, from, how, log, h('div', { class: 'okit-row' }, btn('Turn off', 'danger', act(() => kit.email.set({ on: false }), 'Off: emails to your address are dropped.')))));
}
// Opened from a notification: straight to what it's about.
function openFromNotice() {
  const url = new URL(location.href);
  const open = url.searchParams.get('open');
  if (!open) return;
  url.searchParams.delete('open');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  if (open === 'mail') openMail();
}
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.type === 'open' && typeof e.data.url === 'string' && e.data.url.startsWith('/')) location.href = e.data.url;
});

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
    decorateFriendPosts();
    decorateStartHead();
    decorateFriendsTab();
    friendsDot();
  } finally {
    decorating = false;
  }
}

let refreshing = null;
function refreshSoon() {
  if (refreshing || writing() || host) return;
  refreshing = kit.refresh().catch(() => {}).finally(() => setTimeout(() => (refreshing = null), 15000));
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
  // (A friend's site as their friend, from anywhere on yours: the photos-of-the-day line, say.)
  ownerHooks.visitFriend = visitFriend;
  ownerHooks.trying = () => trying;
  // (An emoji left on one of your posts that you don't want: × takes it off.)
  ownerHooks.removeReaction = async (p, emoji) => {
    if (!confirm(`Take ${emoji} off “${p.title || 'this post'}”?`)) return false;
    try {
      await kit.removeReaction(p, emoji);
      toast(`${emoji} taken off.`);
      return true;
    } catch (e) {
      toast(e.message, true);
      return false;
    }
  };
  ownerHooks.fresh = (d) => {
    keepPublic(d);
    merge(d, true);
    // (Something changed on the site, perhaps from another device: your own copy is read again
    // too, so drafts, the inbox and the theme here are never left behind.)
    refreshSoon();
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
  startMail();
  openFromNotice();
}
