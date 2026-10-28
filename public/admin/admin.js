// The back office. Every save writes a plain Markdown file into your R2 bucket.
import { h, ICON, CATEGORIES, CUSTOM_COLORS, catColor, catLabel, niceDate, registerCategories } from '/js/util.js';
import { stampSvg, INK_DEFS, COUNTRIES, DESIGN_NAMES } from '/js/stamps.js';
import { parseCSV, fromGoodreads, fromLetterboxd } from '/admin/imports.js';
import { FILTERS, filtered, stampDateText } from '/admin/filters.js';
import { EMOTICONS, emoticonSvg, withEmoticons } from '/js/emoticons.js';
import { visaCard, visaLook, VISA_DESIGNS, VISA_STRIPS, VISA_EMBLEMS, VISA_WORLD } from '/js/visa.js';
import { customKeepsake, SHAPES, SHAPE_COLOURS } from '/js/keepsake-maker.js';
import { viewFriends } from '/admin/friends.js';
import { viewThemes } from '/admin/themes.js';
import { OPTIONS, FONT_FAMILIES, resolveSkin } from '/js/skins.js';
import { CARD_STYLES, RIBBONS, miniCard, mixMini, themeCard, ownRibbon, ensureOwnCardsCss } from '/js/card-dress.js';
import { TOP_ROOM, setTopRoom, onHomeScreen } from '/js/top-room.js';

const panel = document.getElementById('panel');
const tabsEl = document.querySelector('.admin-tabs');
const toastEl = document.querySelector('.toast');

let data = null;
let tab = 'posts';
let editor = null;
let travel = null;

const TYPES = [
  ['thoughts', 'Thought'],
  ['places', 'Place'],
  ['photos', 'Photos'],
  ['lists', 'List'],
  ['quotes', 'Quote'],
  ['books', 'Book'],
  ['films', 'Film'],
  ['podcasts', 'Podcast'],
  ['music', 'Music'],
  ['tv', 'TV']
];
const TYPE_LABEL = Object.fromEntries(TYPES);

// Books, films and podcasts: who made it, and where you are with it.
const SHELF = {
  books: { creatorKey: 'author', creator: 'Author', titleLabel: 'Book title', states: [['read', 'Read'], ['reading', 'Reading now'], ['want', 'Want to read'], ['dropped', 'Put down']] },
  films: { creatorKey: 'director', creator: 'Director', titleLabel: 'Film title', states: [['watched', 'Watched'], ['watching', 'Watching'], ['want', 'Want to watch'], ['dropped', 'Walked out']] },
  podcasts: { creatorKey: 'host', creator: 'Host', titleLabel: 'Podcast name', states: [['finished', 'Finished'], ['listening', 'Listening now'], ['want', 'Want to listen'], ['dropped', 'Stopped']] },
  music: { creatorKey: 'artist', creator: 'Artist', titleLabel: 'Album or song title', states: [['listened', 'Listened'], ['repeat', 'On repeat'], ['want', 'Want to hear'], ['skipped', 'Skipped']] },
  tv: { creatorKey: 'creator', creator: 'Created by', titleLabel: 'Show name', states: [['finished', 'Finished'], ['watching', 'Watching'], ['want', 'Want to watch'], ['dropped', 'Gave up']] }
};
const STATE_OF = { read: 'done', watched: 'done', finished: 'done', listened: 'done', reading: 'now', watching: 'now', listening: 'now', repeat: 'now', want: 'want', dropped: 'dropped', skipped: 'dropped' };
// Turn whatever word a file uses into one of this type's choices.
function statusWord(type, status, state) {
  const list = SHELF[type].states;
  if (list.some(([w]) => w === status)) return status;
  const st = state || STATE_OF[status] || 'done';
  return (list.find(([w]) => STATE_OF[w] === st) || list[0])[0];
}

// ---------- plumbing ----------

const SIGNED_OUT = "Your sign-in has run out, so nothing was saved. Open the back office in a new tab and sign in, then come back to this tab and try again: what you've written is still here.";
async function api(path, opts = {}) {
  let r;
  try {
    // A sign-in that has run out answers with a redirect to the login page; don't follow it.
    r = await fetch('/admin/api/' + path, { credentials: 'same-origin', redirect: 'manual', ...opts });
  } catch {
    throw Object.assign(new Error("Couldn't reach your site. Check the connection and try again. Nothing was changed."), { status: 0 });
  }
  if (r.type === 'opaqueredirect' || r.status === 401 || r.status === 403 || (r.ok && /text\/html/.test(r.headers.get('Content-Type') || ''))) {
    throw Object.assign(new Error(SIGNED_OUT), { status: 401 });
  }
  if (!r.ok) {
    let body = {};
    try {
      body = await r.json();
    } catch {}
    throw Object.assign(new Error(body.error || `That didn't work (error ${r.status}).`), { status: r.status, problem: body.problem || null });
  }
  const ct = r.headers.get('Content-Type') || '';
  return ct.includes('application/json') ? r.json() : r.text();
}
const enc = encodeURIComponent;
const putFile = (key, text) => api('file?key=' + enc(key), { method: 'PUT', body: text, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
const delFile = (key) => api('file?key=' + enc(key), { method: 'DELETE' });
const getFile = (key) => api('file?key=' + enc(key));
// Reads a file that may not exist yet: null when it isn't there. Any other problem (no
// connection, a server hiccup) is an error, so a failed read is never mistaken for an empty
// file and then saved over the real one.
async function readFile(key) {
  try {
    return await getFile(key);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}
// Today's date where you are (not in UTC, which is yesterday for an hour after midnight in summer).
const today = () => nowLocal().slice(0, 10);

let toastTimer;
function toast(msg, err = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('err', err);
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), err ? 7000 : 3500);
}

async function refresh() {
  data = await api('overview');
  registerCategories(data.categories);
  setTopRoom(data.site?.top_room);
  drawTabs();
}

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
const toInputDate = (s) => (s ? String(s).replace(' ', 'T').slice(0, 16) : nowLocal());
const fromInputDate = (s) => String(s || nowLocal()).replace('T', ' ');

function slugify(s) {
  return (
    String(s || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'post'
  );
}

// Writes the header between the --- lines. Strings are quoted when YAML could misread them.
function yamlValue(v) {
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (v == null) return 'null';
  if (Array.isArray(v)) return '[' + v.map(yamlValue).join(', ') + ']';
  // A group of values (only ever from a field you wrote by hand): JSON is valid YAML.
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(s)) return s;
  if (/^[A-Za-z][\w .'&()/-]*$/.test(s) && !/^(true|false|yes|no|on|off|null)$/i.test(s) && !/\s$/.test(s)) return s;
  return JSON.stringify(s);
}
// `keep` lists fields written even when false (fields you added by hand mean what they say).
function frontMatter(obj, keep = new Set()) {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '' || (v === false && !keep.has(k)) || (Array.isArray(v) && !v.length)) continue;
    if (Array.isArray(v) && v.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
      lines.push(`${k}:`);
      for (const item of v) {
        const pairs = Object.entries(item).filter(([, x]) => x != null && x !== '' && x !== false);
        pairs.forEach(([ik, iv], j) => lines.push(`${j ? '    ' : '  - '}${ik}: ${yamlValue(iv)}`));
      }
      continue;
    }
    lines.push(`${k}: ${yamlValue(v)}`);
  }
  return `---\n${lines.join('\n')}\n---\n`;
}
function splitFM(text) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/.exec(text || '');
  return m ? { head: m[1], body: m[2] } : { head: '', body: text || '' };
}

function status(p) {
  if (p.error) return ['error', 'Problem'];
  if (p.draft) return ['draft', 'Draft'];
  if (p.ts > data.now) return ['later', 'Scheduled'];
  return ['', 'Live'];
}

// When a page's files can't be loaded: say so, change nothing, and offer to try again.
function loadProblem(e, what) {
  return h('div', { class: 'info problem' }, h('strong', null, `Couldn't load ${what}. `), `${e.message} Nothing was changed, and nothing can be saved here until it loads.`, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => draw() }, 'Try again')));
}

// ---------- tabs ----------

function drawTabs() {
  const pending = data.pendingGuestbook.length;
  const sugg = data.suggestions.length;
  const waitingComments = (data.pendingComments || []).length;
  const unread = unreadCount();
  document.title = (unread ? `(${unread}) ` : '') + 'Back office';
  const defs = [
    ['notifications', h('span', { class: 'bell', 'aria-hidden': 'true' }), unread, 'Notifications'],
    ['status', 'Status'],
    ['friends', 'Friends'],
    ['posts', 'Posts'],
    ['new', editor && editor.key ? 'Edit post' : 'New post'],
    ['comments', 'Comments', waitingComments],
    ['guestbook', 'Guestbook', pending],
    ['suggestions', 'Suggestions', sugg],
    ['site', 'Site & wishlist'],
    ['designs', 'Designs'],
    ['themes', 'Themes'],
    ['travel', 'Travel stats'],
    ['files', 'Export & files']
  ];
  tabsEl.replaceChildren(
    ...defs.map(([id, label, n, aria]) =>
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === id), 'aria-label': aria ? `${aria}${n ? `, ${n} new` : ''}` : null, title: aria || null, class: aria ? 'tab-bell' : null, onclick: () => go(id) }, label, n ? h('span', { class: 'badge' }, String(n)) : null)
    )
  );
}

let friendToOpen = null;
function go(id, friend) {
  tab = id;
  friendToOpen = friend || null;
  if (id === 'new' && !editor) editor = newEditor('thoughts');
  if (id !== 'travel') travel = null;
  drawTabs();
  draw();
  panel.scrollTop = 0;
}

function draw() {
  const views = { notifications: viewNotifications, posts: viewPosts, new: viewEditor, guestbook: viewGuestbook, comments: viewComments, suggestions: viewSuggestions, status: () => viewSite('status'), friends: () => { const k = friendToOpen; friendToOpen = null; return viewFriends(friendsCtx, k); }, site: () => viewSite('site'), designs: viewDesigns, themes: () => viewThemes(themesCtx), travel: viewTravel, files: viewFiles };
  panel.replaceChildren(views[tab]());
}


// What the Friends page needs from the rest of the back office.
const friendsCtx = {
  api,
  toast,
  go: () => go('friends'),
  me: () => data.site,
  refreshAll: refresh
};

// What the Themes page needs from the rest of the back office.
const themesCtx = {
  api,
  toast,
  putFile,
  delFile,
  go: () => go('themes'),
  saved: () => data.theme,
  refreshAll: refresh,
  uploadPicture: (file, name) => uploadDesignPicture(file, name),
  pictureInput: (label, onPick) => pictureInput(label, onPick)
};

// ---------- status, from anywhere ----------
const pad2 = (n) => String(n).padStart(2, '0');
const stampNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
// The fields site.md can hold, kept as they are when only the status changes.
const SITE_KEYS = ['name', 'owner', 'status', 'presence', 'status_updated', 'now_playing', 'countdown', 'countdown_date', 'countdown_icon', 'tagline', 'comments', 'top_room'];
// Changes one setting in site.md, keeping everything else as it is.
async function setSiteField(key, value) {
  const siteRaw = await readFile('site.md');
  const { head, body } = splitFM(siteRaw ?? '');
  const fm = Object.fromEntries(SITE_KEYS.map((k) => [k, rawField(head, k)]));
  fm[key] = value;
  await putFile('site.md', frontMatter(fm) + body.trim() + '\n');
}
// Extra room at the top when the site (or this back office) is opened from a phone's Home Screen,
// where an iPhone puts its clock over the page and fades out what's beneath it. Saved straight away.
function topRoomControls() {
  const now = data.site?.top_room || '';
  const row = h(
    'div',
    { class: 'chip-row', role: 'radiogroup', 'aria-label': 'Room at the top' },
    Object.entries(TOP_ROOM).map(([v, label]) =>
      h('button', { type: 'button', role: 'radio', class: 'chip-btn', 'aria-pressed': String(now === v), 'aria-checked': String(now === v), onclick: async (e) => {
        const chips = [...e.currentTarget.parentElement.children];
        chips.forEach((b) => { b.setAttribute('aria-pressed', String(b === e.currentTarget)); b.setAttribute('aria-checked', String(b === e.currentTarget)); });
        setTopRoom(v);
        try {
          await setSiteField('top_room', v);
          await refresh();
          toast(v ? `Saved: ${label.toLowerCase()} room at the top.` : 'Saved: the top as it is.');
        } catch (err) {
          toast(err.message, true);
        }
      } }, label)
    )
  );
  return h(
    'fieldset',
    { class: 'group' },
    h('legend', null, 'On a phone’s Home Screen'),
    h('p', { class: 'hint' }, 'Opened from the Home Screen, an iPhone puts its clock over the top of the page and fades out what’s under it. If the top bar looks washed out, give it more room. This is for the site and this back office, and only when opened from the Home Screen.'),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Room at the top'), row),
    onHomeScreen() ? h('p', { class: 'hint' }, 'You’re on the Home Screen now, so you can see it change as you choose.') : null
  );
}
// Sets a new status (and adds it to the top of the past statuses), keeping everything else.
async function setStatus(text) {
  const siteRaw = await readFile('site.md');
  const logRaw = (await readFile('status-log.md')) ?? '';
  const { head, body } = splitFM(siteRaw ?? '');
  const fm = Object.fromEntries(SITE_KEYS.map((k) => [k, rawField(head, k)]));
  Object.assign(fm, { status: text, status_updated: new Date().toISOString() });
  await putFile('site.md', frontMatter(fm) + body.trim() + '\n');
  await refresh();
  // Saved as it shows, with any [book] filled in as it is today.
  const shown = (data.site.status || text).replace(/\s+/g, ' ');
  await putFile('status-log.md', `- ${stampNow()} · ${shown}` + (logRaw.trim() ? '\n' + logRaw.trim() : '') + '\n');
}
// A status to start from, for the kind of post: you can change it before posting.
function statusSuggestion(s) {
  const t = (s.title || '').trim();
  const by = (s.creator || '').trim();
  switch (s.type) {
    case 'music': return t ? `Listening to ${t}${by ? ' by ' + by : ''} (music)` : 'Listening to something good (music)';
    case 'podcasts': return t ? `Listening to ${t} (music)` : 'Listening to a podcast (music)';
    case 'films': return t ? `Watching ${t} (tv)` : 'Watching a film (tv)';
    case 'tv': return t ? `Watching ${t} (tv)` : 'Watching something (tv)';
    case 'books': return t ? `Reading ${t} (book)` : 'Reading (book)';
    case 'places': return t ? `At ${t}${s.city ? ', ' + s.city : ''} (sun)` : 'Out and about (sun)';
    case 'photos': return 'Just posted some photos :)';
    case 'lists': return t ? `Made a list: ${t}` : 'Made a list';
    case 'quotes': return 'Thinking about this one';
    default: {
      // A thought: its first line, cut short.
      const first = (s.body || '').trim().split(/\n/)[0].replace(/[#>*_`]/g, '').trim();
      return first.length > 90 ? first.slice(0, 88).replace(/\s+\S*$/, '') + '…' : first || t;
    }
  }
}
// "Update my status too", next to Publish: tick it and a quick box opens with a status to start from.
function statusToggle(s) {
  s._status ||= { on: false, text: '' };
  const st = s._status;
  const text = h('input', { class: 'input', value: st.text, maxlength: 140, placeholder: 'Your new status', 'aria-label': 'New status' });
  const preview = h('div', { class: 'status-preview' });
  const drawPreview = () => preview.replaceChildren(h('small', null, 'Preview: '), ...withEmoticons(text.value || '…', 16));
  text.addEventListener('input', () => {
    st.text = text.value;
    drawPreview();
  });
  drawPreview();
  const line = h('div', { class: 'status-quick-line', hidden: !st.on }, text, preview, h('span', { class: 'hint' }, 'Posted with this one. Emoticons like :) and (music) work; drafts and posts for later leave the status alone.'));
  const box = h('input', { type: 'checkbox', checked: st.on });
  box.addEventListener('change', () => {
    st.on = box.checked;
    if (st.on && !st.text.trim()) {
      st.text = statusSuggestion(s);
      text.value = st.text;
      drawPreview();
    }
    line.hidden = !st.on;
    if (st.on) text.focus();
  });
  return h('div', { class: 'status-quick' }, h('label', { class: 'row check' }, box, h('span', null, 'Update my status too')), line);
}

// ---------- posts list ----------

function viewPosts() {
  const posts = data.posts;
  return h(
    'div',
    { class: 'field' },
    draftBanner(),
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn go', onclick: () => { if (!okToReplaceEditor()) return; editor = newEditor('thoughts'); go('new'); } }, '+ New post'), h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener' }, 'View the site')),
    posts.length
      ? postsList(posts)
      : h(
          'div',
          { class: 'field' },
          h('p', { class: 'hint' }, 'No posts yet. Start with "New post", or add a few example posts to see how every page looks.'),
          (() => {
            const b = h('button', { type: 'button', class: 'btn' }, 'Add example posts');
            b.addEventListener('click', () => loadExamples(b));
            return b;
          })()
        )
  );
}


function postRow(p) {
  const [cls, label] = status(p);
  return h(
    'div',
    { class: 'list-row' },
    h('span', { class: 'dot', style: { background: p.type === 'places' ? catColor(p.category) : '#2a63e0' } }),
    h('div', { class: 'grow' }, h('strong', null, p.pinned ? '📌 ' : '', p.title || p.excerpt || '(no text)'), h('small', null, `${TYPE_LABEL[p.type]} · ${niceDate(p.date, true)}${p.error ? ' · ' + p.error : ''}`)),
    h('span', { class: 'pill ' + cls }, label),
    h('button', { type: 'button', class: 'btn small', 'aria-pressed': String(!!p.pinned), onclick: () => togglePin(p) }, p.pinned ? 'Unpin' : 'Pin'),
    p.photos?.length ? h('button', { type: 'button', class: 'btn small', 'aria-pressed': String(!!p.profile), title: 'Show it on the profile grid on your About page', onclick: () => toggleFlag(p, 'profile', p.profile ? 'Off the profile grid.' : 'On your profile grid.') }, p.profile ? 'Off grid' : 'To grid') : null,
    h('button', { type: 'button', class: 'btn small', onclick: () => edit(p) }, 'Edit'),
    h('button', { type: 'button', class: 'btn small danger', onclick: () => removePost(p) }, 'Delete')
  );
}
// What a search looks through: the title, the words, the kind of post, where and who.
const postWords = (p) => [p.title, p.excerpt, TYPE_LABEL[p.type], p.city, p.area, p.country, p.creator, p.category && catLabel(p.category), p.status, niceDate(p.date, true), p.slug].filter(Boolean).join(' ').toLowerCase();
let postQuery = '';
const openMonths = new Set();
// A search box, then the ten newest posts, then the rest folded away by month, newest first.
function postsList(posts) {
  const results = h('div', { class: 'post-results' });
  const search = h('input', { class: 'input', type: 'search', value: postQuery, placeholder: `Search ${posts.length} posts: a title, a word, a city, "film"…`, 'aria-label': 'Search posts' });
  const show = () => {
    const words = postQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length) {
      const hits = posts.filter((p) => {
        const hay = postWords(p);
        return words.every((w) => hay.includes(w));
      });
      results.replaceChildren(
        h('p', { class: 'hint' }, hits.length ? `${hits.length} found` : `Nothing matches "${postQuery.trim()}".`),
        hits.length ? h('div', { class: 'list' }, hits.map(postRow)) : null
      );
      return;
    }
    const recent = posts.slice(0, 10);
    const months = new Map();
    for (const p of posts.slice(10)) {
      const m = /^(\d{4})-(\d{2})/.exec(String(p.date || ''));
      const key = m ? `${m[1]}-${m[2]}` : 'undated';
      if (!months.has(key)) months.set(key, []);
      months.get(key).push(p);
    }
    const label = (key) => (key === 'undated' ? 'No date' : new Date(`${key}-15T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
    results.replaceChildren(
      h('div', { class: 'list' }, recent.map(postRow)),
      months.size
        ? h(
            'div',
            { class: 'month-folds' },
            [...months].map(([key, list]) => {
              const fold = h('details', { class: 'month-fold', open: openMonths.has(key) }, h('summary', null, label(key), h('span', { class: 'month-n' }, `${list.length} post${list.length === 1 ? '' : 's'}`)), h('div', { class: 'list' }, list.map(postRow)));
              fold.addEventListener('toggle', () => (fold.open ? openMonths.add(key) : openMonths.delete(key)));
              return fold;
            })
          )
        : null
    );
  };
  search.addEventListener('input', () => {
    postQuery = search.value;
    show();
  });
  show();
  return h('div', { class: 'posts-box' }, search, results);
}

// Turns a true/false line in a post's header on or off, changing nothing else in the file.
async function toggleFlag(p, key, done) {
  try {
    const raw = await getFile(p.key);
    const { head, body } = splitFM(raw);
    const lines = head.split(/\r?\n/).filter((l) => !new RegExp(`^${key}\\s*:`).test(l));
    if (!p[key]) lines.push(`${key}: true`);
    await putFile(p.key, `---\n${lines.filter((l, i) => l || i < lines.length - 1).join('\n')}\n---\n${body}`);
    toast(done);
    await refresh();
    draw();
  } catch (e) {
    toast(e.message, true);
  }
}

// Pin or unpin straight from the list: just the "pinned:" line in the file changes.
async function togglePin(p) {
  try {
    const raw = await getFile(p.key);
    const { head, body } = splitFM(raw);
    const lines = head.split(/\r?\n/).filter((l) => !/^pinned\s*:/.test(l));
    if (!p.pinned) lines.push('pinned: true');
    await putFile(p.key, `---\n${lines.filter((l, i) => l || i < lines.length - 1).join('\n')}\n---\n${body}`);
    toast(p.pinned ? 'Unpinned.' : 'Pinned to the top.');
    await refresh();
    draw();
  } catch (e) {
    toast(e.message, true);
  }
}

async function removePost(p) {
  if (!confirm(`Delete "${p.title || p.excerpt || p.slug}" and its photos? This can't be undone (download an export first if unsure).`)) return;
  try {
    await delFile(p.key);
  } catch (e) {
    return toast(e.message, true);
  }
  toast('Deleted.');
  try {
    await refresh();
  } catch {
    data.posts = data.posts.filter((x) => x.key !== p.key);
  }
  draw();
}

// ---------- editor ----------

// ---------- unsaved work ----------

// Has the post open in the editor been changed since it was opened?
function isDirty(s) {
  if (!s) return false;
  if (s.raw != null || s.photos.some((p) => p.file) || s.removed.length) return true;
  if (s.key) {
    try {
      return buildText(s) !== s._orig;
    } catch {
      return true;
    }
  }
  // A new post: anything filled in at all (a pin on the map, stars, an episode…) counts.
  if (s.photos.length) return true;
  try {
    return buildText(s) !== buildText({ ...newEditor(s.type), date: s.date });
  } catch {
    return true;
  }
}
// Before opening another post: never throw away writing without asking.
function okToReplaceEditor() {
  return !isDirty(editor) || confirm("You have a post open that isn't saved yet. Open another one and lose those changes?");
}

// What you're writing is also kept in this browser as you type, so a closed tab, a crash or a
// sign-in that runs out doesn't lose it. New photos can't be kept this way (only their count).
const DRAFT_KEY = 'back-office-unsaved';
function keepDraft() {
  const s = editor;
  if (!s || !isDirty(s)) return forgetDraft();
  const plain = {};
  for (const [k, v] of Object.entries(s)) if (!k.startsWith('_') || k === '_orig' || k === '_etag') plain[k] = v;
  plain.photos = s.photos.filter((p) => p.name).map((p) => ({ name: p.name, url: p.url, caption: p.caption || '', cover: !!p.cover }));
  plain._newPhotos = s.photos.filter((p) => p.file).length;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), s: plain }));
  } catch {}
}
function forgetDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}
function storedDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    return d && d.s && typeof d.s === 'object' ? d : null;
  } catch {
    return null;
  }
}
let draftTimer;
panel.addEventListener('input', () => {
  if (tab !== 'new') return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(keepDraft, 600);
});
panel.addEventListener('click', () => {
  if (tab !== 'new') return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(keepDraft, 600);
});
window.addEventListener('pagehide', () => tab === 'new' && keepDraft());

function draftBanner(inEditor = false) {
  const d = storedDraft();
  if (!d || (editor && !inEditor)) return null;
  const s = d.s;
  const what = s.title || (s.body || s.raw || '').replace(/^---[\s\S]*?---\s*/, '').trim().slice(0, 60) || 'a post';
  const when = new Date(d.at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return h(
    'div',
    { class: 'info draft-banner' },
    h('span', { class: 'grow' }, h('strong', null, 'Unsaved writing found. '), `“${what}”, from ${when}.${s._newPhotos ? ` (${s._newPhotos} new photo${s._newPhotos === 1 ? '' : 's'} will need adding again.)` : ''}`),
    h('button', { type: 'button', class: 'btn small go', onclick: () => {
      const { _newPhotos, ...rest } = s;
      editor = { ...newEditor(rest.type || 'thoughts'), ...rest, photos: (rest.photos || []).map((p) => ({ ...p })), removed: rest.removed || [] };
      go('new');
    } }, 'Carry on writing'),
    h('button', { type: 'button', class: 'btn small', onclick: () => {
      if (!confirm('Throw away this unsaved writing?')) return;
      forgetDraft();
      draw();
    } }, 'Throw away')
  );
}

function newEditor(type) {
  return { key: null, type, date: nowLocal(), title: '', body: '', draft: false, pinned: false, photos: [], removed: [], area: '', city: '', country: '', country_code: '', lat: null, lon: null, category: '', rating: null, would_return: false, weather: '', source: '', stamp: '', creator: '', year: '', episode: '', format: 'album', album: '', season: '', network: '', episodes: [], pages: '', page: '', reading_log: [], status: SHELF[type] ? SHELF[type].states[0][0] : '', recommend: false, rewatch: false, quote: '', suggested_by: '', font: '', card: '', ribbon: '', ribbon_style: 'banner', ribbon_colour: '', floppy: [], floppy_journal: [], ordered: [], bought: [], tickets: [], rides: [], keep: {}, memory: '', extra: {}, raw: null };
}

async function edit(p) {
  // Already open with changes: carry on with them rather than reloading the saved version.
  if (editor && editor.key === p.key && isDirty(editor)) return go('new');
  if (editor && editor.key !== p.key && !okToReplaceEditor()) return;
  // A post whose header has a mistake can't be shown in the form (it would come up empty and
  // saving it would throw the header away), so it opens as the file itself, with the problem.
  if (p.error) {
    let raw;
    try {
      raw = await getFile(p.key);
    } catch (e) {
      return toast(e.message, true);
    }
    editor = { ...newEditor(p.type), key: p.key, raw, problem: p.error, problemHidden: true, _etag: data.files.find((f) => f.key === p.key)?.etag || null };
    tab = 'new';
    drawTabs();
    draw();
    panel.scrollTop = 0;
    return;
  }
  editor = {
    key: p.key,
    type: p.type,
    date: toInputDate(p.date),
    title: p.title,
    body: p.body,
    draft: p.draft,
    pinned: !!p.pinned,
    profile: !!p.profile,
    font: p.font || '',
    card: p.card || '',
    ribbon: p.ribbon || '',
    ribbon_style: p.ribbon_style || 'banner',
    ribbon_colour: p.ribbon_colour || '',
    photos: p.files.map((name, i) => ({ name, url: p.photos[i], caption: p.captions[i] || '', cover: i > 0 && i === p.grid_cover })),
    removed: [],
    area: p.area,
    city: p.city,
    country: p.country,
    country_code: p.country_code,
    lat: p.lat,
    lon: p.lon,
    category: p.category,
    rating: p.rating,
    would_return: p.would_return,
    weather: p.weather,
    source: p.source,
    stamp: p.stamp || '',
    creator: p.creator || '',
    year: p.year || '',
    episode: p.episode || '',
    format: p.format || 'album',
    album: p.album || '',
    season: p.season || '',
    network: p.network || '',
    pages: p.pages ? String(p.pages) : '',
    page: p.page ? String(p.page) : '',
    reading_log: (p.reading_log || []).map((e) => ({ date: e.date || '', from: e.from ? String(e.from) : '', to: e.to ? String(e.to) : '', chapter: e.chapter || '', note: e.note || '' })),
    episodes: (p.episodes || []).map((e) => ({ season: e.season || '', ep: e.ep || '', to: e.to || '', title: e.title || '', rating: e.rating ?? null, note: e.note || '', date: e.date || '' })),
    status: SHELF[p.type] ? statusWord(p.type, String(p.status || '').toLowerCase(), p.state) : '',
    recommend: !!p.recommend,
    rewatch: !!p.rewatch,
    quote: p.quote || '',
    suggested_by: p.suggested_by || '',
    floppy: [...(p.floppy || [])],
    floppy_journal: [...(p.floppy_journal || [])],
    ordered: (p.ordered || []).map((o) => ({ item: o.item || '', price: o.price || '' })),
    bought: (p.bought || []).map((o) => ({ item: o.item || '', price: o.price || '' })),
    tickets: (p.tickets || []).map((o) => ({ item: o.item || '', price: o.price || '' })),
    ...Object.fromEntries(KEEPSAKES.filter((k) => !['ordered', 'bought', 'tickets'].includes(k.list)).map(({ list: k }) => [k, (p[k] || []).map((o) => ({ item: o.item || '', price: o.price || '' }))])),
    ...Object.fromEntries(customKinds().map((k) => [k.list, (p.custom_keepsakes?.[k.custom] || []).map((o) => ({ item: o.item || '', price: o.price || '' }))])),
    // Keepsakes of your own whose design has since been deleted (or no longer offered for this kind
    // of post): kept in the file as they are.
    custom_orphans: Object.fromEntries(Object.entries(p.custom_keepsakes || {}).filter(([id]) => !customKinds().some((k) => k.custom === id && k.types.includes(p.type)))),
    postcard_scene: p.postcard_scene || '',
    memory: p.memory || '',
    keep: Object.fromEntries([...KEEPSAKES.map((k) => [k.id, k.plain ? p[k.list] != null : !!p[k.list]?.length]), ...customKinds().map((k) => [k.id, p.custom_keepsakes?.[k.custom] != null])]),
    extra: p.extra || {},
    raw: null
  };
  // What the form looked like when opened, to tell later whether anything was changed, and
  // which stored version it came from, to spot a change made on another device meanwhile.
  try {
    editor._orig = buildText(editor);
  } catch {
    editor._orig = null;
  }
  editor._etag = data.files.find((f) => f.key === p.key)?.etag || null;
  tab = 'new';
  drawTabs();
  draw();
  panel.scrollTop = 0;
}

function buildText(s) {
  const fm = { date: fromInputDate(s.date), title: s.title.trim() };
  if (s.type === 'thoughts' || s.type === 'photos') fm.memory = s.memory || '';
  if (s.type === 'places') {
    Object.assign(fm, {
      area: s.area,
      city: s.city,
      country: s.country,
      country_code: s.country_code,
      lat: Number.isFinite(s.lat) ? s.lat : null,
      lon: Number.isFinite(s.lon) ? s.lon : null,
      category: s.category,
      rating: s.rating,
      would_return: s.would_return,
      weather: s.weather,
      stamp: s.stamp,
    });
  }
  // Keepsakes (places, and the shelves): receipts need lines; a ticket, card or little thing
  // with nothing written on it is still one.
  for (const k of keepsakesFor(s.type)) {
    if (k.custom) continue;
    fm[k.list] = !keepOn(s)[k.id] ? (k.plain ? null : []) : keepLines(s[k.list]).length ? keepLines(s[k.list]) : k.plain ? true : [];
  }
  // The postcard's painted front, whatever the kind of post.
  fm.postcard_scene = keepOn(s).postcard ? s.postcard_scene || '' : '';
  // Your own keepsakes go together under one key: { ferry: [Return — £8], badge: true }.
  const mine = {};
  for (const [id, lines] of Object.entries(s.custom_orphans || {})) mine[id] = lines.length ? keepLines(lines) : true;
  for (const k of keepsakesFor(s.type).filter((x) => x.custom && keepOn(s)[x.id])) mine[k.custom] = keepLines(s[k.list]).length ? keepLines(s[k.list]) : true;
  fm.custom_keepsakes = Object.keys(mine).length ? mine : null;
  if (SHELF[s.type]) {
    fm[SHELF[s.type].creatorKey] = s.creator.trim();
    if (s.type === 'podcasts') fm.episode = s.episode.trim();
    let tvEpisodes = null;
    let bookLog = null;
    if (s.type === 'books') {
      const num = (v) => (/^\d+$/.test(String(v ?? '').trim()) ? Number(String(v).trim()) : null);
      fm.pages = num(s.pages) ?? '';
      // "Up to page" follows the furthest page in the log.
      const furthest = Math.max(0, ...s.reading_log.map((e) => num(e.to) ?? num(e.from) ?? 0));
      fm.page = furthest && (num(s.page) == null || furthest > num(s.page)) ? furthest : num(s.page) ?? '';
      bookLog = s.reading_log
        .filter((e) => String(e.from).trim() || String(e.to).trim() || e.chapter.trim() || e.note.trim())
        .map((e) => ({ date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : '', from: num(e.from) ?? '', to: num(e.to) ?? '', chapter: e.chapter.trim(), note: e.note.trim() }));
    }
    if (s.type === 'tv') {
      const n = (v) => (/^\d+$/.test(String(v).trim()) ? Number(String(v).trim()) : String(v).trim());
      fm.season = n(s.season);
      // "Up to episode" follows the furthest episode logged this season.
      const num = (v) => (/^\d+$/.test(String(v ?? '').trim()) ? Number(String(v).trim()) : null);
      const furthest = Math.max(0, ...s.episodes.filter((e) => String(e.season).trim() === String(s.season).trim()).map((e) => num(e.to) ?? num(e.ep) ?? 0));
      fm.episode = furthest && (num(s.episode) == null || furthest > num(s.episode)) ? furthest : n(s.episode);
      fm.network = s.network.trim();
      tvEpisodes = s.episodes
        .filter((e) => String(e.ep).trim() || e.title.trim() || e.note.trim() || e.rating != null)
        .map((e) => ({ season: n(e.season), ep: n(e.ep), to: num(e.to) != null && num(e.ep) != null && num(e.to) > num(e.ep) ? num(e.to) : '', title: e.title.trim(), rating: e.rating, date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : '', note: e.note.trim() }));
    }
    if (s.type === 'music') {
      fm.format = s.format === 'song' ? 'song' : 'album';
      if (s.format === 'song') fm.album = s.album.trim();
    }
    fm.year = /^\d{3,4}$/.test(String(s.year).trim()) ? Number(s.year) : String(s.year).trim();
    Object.assign(fm, { status: s.status, rating: s.rating, recommend: s.recommend, rewatch: (s.type === 'films' || s.type === 'tv') && s.rewatch, quote: s.quote.trim() });
    // The episode diary goes last, so the header stays easy to read by hand.
    if (tvEpisodes) fm.episodes = tvEpisodes;
    if (bookLog) fm.reading_log = bookLog;
  }
  if (s.type === 'places' || SHELF[s.type]) fm.suggested_by = s.suggested_by.trim();
  if (s.type === 'quotes') fm.source = s.source;
  const kept = s.photos.filter((ph) => ph.name || ph.file);
  if (kept.length) {
    fm.photos = kept.map((ph) => ph.name || ph.pendingName);
    if (kept.some((ph) => ph.caption)) fm.captions = kept.map((ph) => ph.caption || '');
  }
  // One line is written as text, several as a list.
  const clean = (list) => (list || []).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const one = (list) => (list.length > 1 ? list : list[0] || '');
  fm.floppy = one(clean(s.floppy));
  if (s.type === 'places') fm.floppy_journal = one(clean(s.floppy_journal));
  fm.draft = s.draft;
  fm.pinned = s.pinned;
  fm.font = s.font || null;
  // How its card is dressed, and a ribbon of its own (only what's been chosen is written).
  fm.card = s.card || null;
  fm.ribbon = s.ribbon?.trim() || null;
  fm.ribbon_style = fm.ribbon && s.ribbon_style && s.ribbon_style !== 'banner' ? s.ribbon_style : null;
  fm.ribbon_colour = fm.ribbon && s.ribbon_colour ? s.ribbon_colour : null;
  fm.profile = s.profile && s.photos.length ? true : null;
  // The grid's thumbnail, when it isn't the first photo (it stays chosen even off the grid).
  const cover = kept.find((ph) => ph.cover);
  fm.grid_photo = cover && kept.indexOf(cover) > 0 ? cover.name || cover.pendingName : null;
  Object.assign(fm, s.extra);
  return frontMatter(fm, new Set(Object.keys(s.extra || {}))) + (s.body || '').trim() + '\n';
}

function keyFor(s) {
  if (s.key) return s.key;
  const day = fromInputDate(s.date).slice(0, 10);
  const words = s.title || (s.body || '').replace(/[#>*_`[\]()!-]/g, ' ').trim().split(/\s+/).slice(0, 6).join(' ') || TYPE_LABEL[s.type];
  let base = `${s.type}/${day}-${slugify(words)}`;
  const taken = new Set(data.files.map((f) => f.key));
  let key = base + '.md';
  for (let n = 2; taken.has(key); n++) key = `${base}-${n}.md`;
  return key;
}

// iPhone photos are often HEIC/HEIF. Safari opens them itself; other browsers get a decoder
// that is only downloaded the first time it's needed.
const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'mif2'];
async function looksLikeHeif(file) {
  if (/\.(heic|heif|hif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)) return true;
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const box = String.fromCharCode(...head.slice(4, 8));
  const brand = String.fromCharCode(...head.slice(8, 12));
  return box === 'ftyp' && HEIF_BRANDS.includes(brand);
}
let heicLib = null;
async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {}
  if (await looksLikeHeif(file)) {
    try {
      heicLib ||= import('/vendor/heic-to/heic-to.js');
      const { heicTo } = await heicLib;
      // The decoder applies the photo's rotation itself.
      return await heicTo({ blob: file, type: 'bitmap' });
    } catch (e) {
      console.error(e);
      throw new Error(`"${file.name}" is a HEIC photo this browser couldn't open. Try again in Safari, or set your iPhone camera to "Most Compatible".`);
    }
  }
  throw new Error(`"${file.name}" can't be opened in this browser. Save it as a JPEG first.`);
}

// Photos are kept at a 2000s-digicam size: 1600px on the long side (about 2 megapixels) and
// squeezed to roughly half a megabyte. Plenty for a phone or laptop screen, and quick to load.
const PHOTO_MAX = 1600;
const PHOTO_TARGET = 520 * 1024;
const toJpeg = (c, q) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('That photo could not be converted.'))), 'image/jpeg', q));

// The smallest good-looking JPEG: start at a high quality and step down until it fits the
// target. Very busy photos (grain, leaves, crowds) that still don't fit are made a bit smaller.
async function compact(c) {
  let best = null;
  for (let round = 0; round < 2; round++) {
    for (const q of [0.82, 0.76, 0.7, 0.64, 0.58]) {
      const b = await toJpeg(c, q);
      if (!best || b.size < best.size) best = b;
      if (b.size <= PHOTO_TARGET) return b;
    }
    const smaller = document.createElement('canvas');
    smaller.width = Math.round(c.width * 0.8);
    smaller.height = Math.round(c.height * 0.8);
    const g = smaller.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, smaller.width, smaller.height);
    c = smaller;
  }
  return best;
}

// The finished photo to upload, with or without a filter.
async function finalPhoto(ph, s) {
  if (ph.filter && ph.filter !== 'none') return withFilter(ph, s);
  const bmp = await createImageBitmap(await (ph.ready || shrink(ph.file)));
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close?.();
  return compact(c);
}

// Phone photos are big to unpack, so only two are worked on at once: picking twenty photos for
// a photo dump shouldn't run a phone out of memory.
let busyShrinks = 0;
const waitingShrinks = [];
function twoAtATime(job) {
  return new Promise((resolve, reject) => {
    const run = () => {
      busyShrinks++;
      job()
        .then(resolve, reject)
        .finally(() => {
          busyShrinks--;
          waitingShrinks.shift()?.();
        });
    };
    if (busyShrinks < 2) run();
    else waitingShrinks.push(run);
  });
}

// A working copy at the final size, kept at high quality so the filter and the final
// squeeze start from good pixels. It never leaves the browser as is.
async function shrink(file) {
  const bmp = await decode(file);
  const max = PHOTO_MAX;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  // Re-drawing the picture keeps only the pixels: every bit of hidden data (GPS location,
  // phone model, date taken…) is left behind. The server strips the result again.
  return toJpeg(c, 0.93);
}

// ---------- photo filters ----------

const fontReady = () => (document.fonts?.load ? document.fonts.load("20px 'Share Tech Mono'").catch(() => {}) : Promise.resolve());

// The full-size photo with its filter drawn in. Still a plain JPEG with nothing hidden in it.
async function withFilter(ph, s) {
  const bmp = await createImageBitmap(await ph.ready);
  await fontReady();
  const c = filtered(bmp, ph.filter, { max: PHOTO_MAX, seed: ph.seed, date: stampDateText(stampDay(ph)) });
  bmp.close?.();
  return compact(c);
}

function previewURL(ph, id, max, s) {
  return filtered(ph.small, id, { max, seed: ph.seed, date: stampDateText(stampDay(ph)) }).toDataURL('image/jpeg', 0.85);
}

// The day a digicam-style photo has burnt into its corner: the day it was added, unless you
// set the camera's date yourself.
const stampDay = (ph) => ph.stamp || ph.added || today();
const niceDay = (d) => new Date(d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// The camera's DATE button: shows the date it will print, and opens a box to change it.
function stampSetting(ph, s, refresh) {
  const day = stampDay(ph);
  const custom = ph.stamp && ph.stamp !== ph.added;
  if (!ph._setDate) {
    return h('div', { class: 'stamp-set' },
      h('button', { type: 'button', class: 'cam-date', onclick: () => { ph._setDate = true; refresh(); }, 'aria-label': `Date printed on the photo: ${niceDay(day)}. Change it` },
        h('span', { class: 'cam-date-key' }, 'DATE'), h('span', { class: 'cam-date-lcd' }, stampDateText(day))),
      h('span', { class: 'hint' }, custom ? `Set by you: ${niceDay(day)}.` : `The day you added it. Tap DATE to set your own.`));
  }
  const input = h('input', { type: 'date', value: day, max: today(), 'aria-label': 'Date printed on the photo' });
  const apply = (value) => {
    ph.stamp = value && value !== ph.added ? value : null;
    ph._setDate = false;
    ph.tiles = null;
    refresh();
  };
  return h('div', { class: 'stamp-set open' },
    h('label', { class: 'stamp-label' }, 'Date printed on the photo', input),
    h('button', { type: 'button', class: 'btn go', onclick: () => apply(input.value) }, 'Set date'),
    custom ? h('button', { type: 'button', class: 'btn', onclick: () => apply(null) }, 'Back to the day I added it') : null,
    h('button', { type: 'button', class: 'btn', onclick: () => { ph._setDate = false; refresh(); } }, 'Cancel'));
}

function filterPanel(s, ph, rerender) {
  if (!ph.tiles) ph.tiles = Object.fromEntries(FILTERS.map((f) => [f.id, previewURL(ph, f.id, 150, s)]));
  if (ph.filter && ph.filter !== 'none' && !ph.thumb) ph.thumb = ph.tiles[ph.filter];
  const current = FILTERS.find((f) => f.id === (ph.filter || 'none'));
  const big = h('img', { class: 'filter-big', alt: `Preview: ${current.name}`, src: previewURL(ph, current.id, 640, s) });
  const choose = (id) => {
    ph.filter = id;
    ph.thumb = id === 'none' ? null : ph.tiles[id];
    rerender();
  };
  const others = s.photos.filter((p) => p !== ph && p.small);
  return h(
    'fieldset',
    { class: 'group filter-panel' },
    h('legend', null, 'Filter'),
    big,
    h('p', { class: 'hint' }, current.note || 'The photo as you took it.'),
    current.id === 'digicam' ? stampSetting(ph, s, () => { ph.tiles = null; if (ph.filter === 'digicam') ph.thumb = null; rerender(); }) : null,
    h(
      'div',
      { class: 'filter-strip', role: 'group', 'aria-label': 'Filters' },
      FILTERS.map((f) => h('button', { type: 'button', class: 'filter-tile', 'aria-pressed': String(current.id === f.id), onclick: () => choose(f.id) }, h('img', { src: ph.tiles[f.id], alt: '' }), h('span', null, f.name)))
    ),
    h(
      'div',
      { class: 'row end' },
      others.length
        ? h('button', { type: 'button', class: 'btn', onclick: () => {
            for (const p of others) {
              p.filter = ph.filter;
              if (p.stamp !== ph.stamp) p.tiles = null;
              p.stamp = ph.stamp;
              p.tiles ||= Object.fromEntries(FILTERS.map((f) => [f.id, previewURL(p, f.id, 150, s)]));
              p.thumb = ph.filter === 'none' ? null : p.tiles[ph.filter];
            }
            toast(`${current.name} on all ${others.length + 1} new photos.`);
            rerender();
          } }, 'Use on all new photos')
        : null,
      h('button', { type: 'button', class: 'btn go', onclick: () => { s._filterFor = null; rerender(); } }, 'Done')
    )
  );
}

// New photos get names no other photo in this post has ever had, the first time a name is
// needed, and keep them. Re-using the name of a photo that was just removed would upload the
// new one and then delete it straight after, and browsers would keep showing the old picture
// they remember under that name.
function nameNewPhotos(s) {
  const used = new Set([...s.photos.map((p) => p.name || p.pendingName), ...s.removed].filter(Boolean));
  const stamp = Date.now().toString(36).slice(-5);
  let n = 1;
  for (const ph of s.photos) {
    if (!ph.file || ph.pendingName) continue;
    while (used.has(`${n}-${stamp}.jpg`)) n++;
    ph.pendingName = `${n}-${stamp}.jpg`;
    used.add(ph.pendingName);
  }
}

async function save(s, btn) {
  btn.disabled = true;
  try {
    const key = keyFor(s);
    const base = key.replace(/\.md$/, '');
    // Changed somewhere else since it was opened here (another tab, the phone)? Ask before
    // saving over it.
    if (s.key && s._etag) {
      const now = await api('file?info=1&key=' + enc(s.key)).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (now && now.etag !== s._etag && !confirm('This post has been changed somewhere else (another tab or device) since you opened it here. Save your version over it?')) {
        toast('Not saved. Your writing is still here; copy anything you need, then reopen the post to see the newer version.', true);
        return;
      }
    }
    nameNewPhotos(s);
    const text = s.raw != null ? s.raw : buildText(s);
    // When editing the file as text, the text decides which photos the post uses: a new photo
    // that isn't in it isn't uploaded, and a removed one that's still in it isn't deleted.
    const inText = (name) => s.raw == null || text.includes(name);
    for (const ph of s.photos) {
      if (!ph.file || !inText(ph.pendingName)) continue;
      const blob = await finalPhoto(ph, s);
      await api('upload?key=' + enc(`${base}/${ph.pendingName}`), { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
    }
    await putFile(key, text);
    forgetDraft();
    for (const name of s.removed) if (s.raw == null || !text.includes(name)) await delFile(`${base}/${name}`).catch(() => {});
    s.photos.forEach((ph) => {
      if (ph.pendingName) {
        ph.name = ph.pendingName;
        delete ph.file;
      }
    });
    editor = null;
    // It's saved. If the list can't be refreshed right now, say it's saved anyway, so nobody
    // writes the same post twice thinking it was lost.
    try {
      await refresh();
    } catch {
      toast("Saved. The list couldn't be refreshed just now; reload the page to see it.");
      go('posts');
      return;
    }
    // Belt and braces: if the site still can't read what was saved, say so and reopen it.
    const saved = data.posts.find((p) => p.key === key);
    if (saved?.error) {
      toast('Saved, but the site can\'t read its header, so the post is hidden. Fix it here.', true);
      return edit(saved);
    }
    // "Update my status too": only for a post that's live now (a draft or a post for later
    // shouldn't give itself away early).
    const later = new Date(fromInputDate(s.date).replace(' ', 'T')) > new Date();
    let statusNote = '';
    if (s._status?.on && s._status.text.trim() && !s.draft && !later) {
      try {
        await setStatus(s._status.text.trim());
        statusNote = ' Status updated too.';
      } catch (e) {
        statusNote = ` (The status couldn't be updated: ${e.message})`;
      }
    }
    toast((s.draft ? 'Saved as a draft.' : later ? 'Saved. It goes live at the time you set.' : 'Published!') + statusNote);
    go('posts');
  } catch (e) {
    toast(e.message, true);
    // A header mistake caught by the server: keep the text open with the problem showing.
    if (e.problem && s.raw != null && editor === s) {
      s.problem = e.problem;
      s.problemHidden = false;
      draw();
    }
  } finally {
    btn.disabled = false;
  }
}

// This post's own font: the site's (from Themes) unless you pick one. The writing box shows it.
const CLASSIC_FONT = "Tahoma, 'DejaVu Sans', Verdana, sans-serif";
const fontOf = (id) => FONT_FAMILIES[id] || CLASSIC_FONT;
// (Pixel, terminal, handwritten and comic letters are small for their size: evened out, as on the site.)
const sizeOf = (id) => (['pixel', 'terminal', 'handwritten', 'comic'].includes(id) ? '.53' : '');
function fontPicker(s, box) {
  const themeFont = data.theme?.font && OPTIONS.font.choices[data.theme.font] ? data.theme.font : 'classic';
  const show = () => {
    box.style.fontFamily = s.font ? fontOf(s.font) : '';
    box.style.fontSizeAdjust = sizeOf(s.font);
    row.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.font === (s.font || ''))));
  };
  const chip = (id, label, fam, size = sizeOf(id)) => h('button', { type: 'button', class: 'chip-btn', 'data-font': id, 'aria-pressed': String((s.font || '') === id), style: { fontFamily: fam, fontSizeAdjust: size }, onclick: () => { s.font = id; show(); } }, label);
  const row = h(
    'div',
    { class: 'chip-row post-fonts', role: 'radiogroup', 'aria-label': 'Font for this post' },
    chip('', `The site’s (${OPTIONS.font.choices[themeFont]})`, fontOf(themeFont), sizeOf(themeFont)),
    Object.entries(OPTIONS.font.choices).map(([id, label]) => chip(id, label, fontOf(id)))
  );
  queueMicrotask(show);
  return h('div', { class: 'field' }, h('span', { class: 'label' }, 'Font for this post'), row, h('span', { class: 'hint' }, 'Write this one in a font of its own. Left on the site’s font, it follows your theme.'));
}

// How this post's card is dressed: a design of its own (or the theme's), and a ribbon of your own
// words in one of the ribbon styles, in the theme's colour or one of your own. Shown as they'll
// look, in the site's own card designs.
function dressPicker(s) {
  const t = resolveSkin(data.theme || {});
  const box = h('div', { class: 'field dress' });
  const preview = h('div');
  const showRibbon = () => {
    const rb = ownRibbon({ ribbon: s.ribbon, ribbon_style: s.ribbon_style, ribbon_colour: s.ribbon_colour }, t);
    preview.replaceChildren(rb ? h('div', { class: 'card', 'data-card': s.card && s.card !== 'classic' ? s.card : null }, h('div', { class: 'card-head' }, h('strong', null, 'Preview')), rb, h('div', { class: 'card-body' }, 'Your post goes here.')) : h('span', { class: 'hint' }, 'Write a few words to see the ribbon.'));
  };
  const draw = () => {
    // (Your own cards too, made in Themes › Post cards.)
    ensureOwnCardsCss(t);
    const ownName = (id) => t.cards.find((c) => c.id === id)?.name;
    // (Mixed at random: the design this post draws, once it's saved and has its name.)
    const mixing = t.card_style === 'mix';
    const drawn = mixing && s.key ? themeCard({ type: s.type, slug: s.key.split('/').pop().replace(/\.md$/i, '') }, t) : '';
    const theirs = mixing ? (drawn ? `mixed: ${CARD_STYLES[drawn] || ownName(drawn)}` : 'mixed at random') : CARD_STYLES[t.card_style] || ownName(t.card_style) || 'Classic';
    const picks = [['', `The theme’s (${theirs})`, mixing ? drawn || 'mix' : t.card_style], ...Object.entries(CARD_STYLES).map(([id, name]) => [id, name, id]), ...t.cards.map((c) => [c.id, c.name, c.id])];
    const grid = h(
      'div',
      { class: 'dress-grid', role: 'radiogroup', 'aria-label': 'Card design for this post' },
      picks.map(([id, name, look]) => h('button', { type: 'button', role: 'radio', class: 'dress-pick' + ((s.card || '') === id ? ' on' : ''), 'aria-checked': String((s.card || '') === id), onclick: () => { s.card = id; draw(); } }, look === 'mix' ? mixMini(t) : miniCard(look, t), h('small', null, name)))
    );
    const words = h('input', { class: 'input', value: s.ribbon || '', maxlength: 40, placeholder: 'e.g. Big news!', 'aria-label': 'Ribbon words' });
    words.addEventListener('input', () => {
      s.ribbon = words.value;
      showRibbon();
    });
    const styles = h(
      'div',
      { class: 'chip-row', role: 'radiogroup', 'aria-label': 'Ribbon style' },
      Object.entries(RIBBONS).map(([id, name]) => h('button', { type: 'button', role: 'radio', class: 'chip-btn', 'aria-pressed': String((s.ribbon_style || 'banner') === id), onclick: () => { s.ribbon_style = id; draw(); } }, name))
    );
    const colour = h('input', { type: 'color', value: s.ribbon_colour || t.accent, 'aria-label': 'Ribbon colour' });
    colour.addEventListener('input', () => {
      s.ribbon_colour = colour.value;
      showRibbon();
    });
    const themes = h('button', { type: 'button', class: 'btn small', disabled: !s.ribbon_colour, onclick: () => { s.ribbon_colour = ''; draw(); } }, 'The theme’s colour');
    box.replaceChildren(
      h('span', { class: 'label' }, 'Dress this post'),
      grid,
      h('span', { class: 'hint' }, 'A design of its own for this post’s card. Left on the theme’s, it follows Themes.'),
      h('div', { class: 'dress-ribbon' }, h('span', { class: 'label' }, 'A ribbon (optional)'), words, styles, h('div', { class: 'row' }, colour, themes), preview)
    );
    showRibbon();
  };
  draw();
  return box;
}

function field(label, input, hint) {
  const id = 'f-' + Math.random().toString(36).slice(2, 8);
  input.id = id;
  return h('div', { class: 'field' }, h('label', { for: id }, label), input, hint ? h('span', { class: 'hint' }, hint) : null);
}

// Books: a log of reading sessions. Newest at the top; logging the next one starts
// where the last left off.
function readingLogEditor(s, rerender) {
  const num = (v) => (/^\d+$/.test(String(v ?? '').trim()) ? Number(String(v).trim()) : null);
  const add = () => {
    const furthest = Math.max(0, ...s.reading_log.map((e) => num(e.to) ?? num(e.from) ?? 0), num(s.page) ?? 0);
    s.reading_log.push({ date: today(), from: String(furthest + 1), to: '', chapter: '', note: '' });
    rerender();
  };
  const rows = s.reading_log
    .map((e, i) => [e, i])
    .reverse()
    .map(([e, i]) => {
      const inp = (key, attrs) => {
        const el = h('input', { class: 'input', value: e[key] ?? '', ...attrs });
        el.addEventListener('input', () => (e[key] = el.value));
        return el;
      };
      const note = h('textarea', { class: 'textarea short', placeholder: 'A thought, a line you liked (optional)', maxlength: 2000 });
      note.value = e.note;
      note.addEventListener('input', () => (e.note = note.value));
      return h(
        'div',
        { class: 'ep-edit' },
        h(
          'div',
          { class: 'rl-top' },
          h('label', { class: 'ep-mini' }, 'From page', inp('from', { maxlength: 6, inputmode: 'numeric' })),
          h('label', { class: 'ep-mini' }, 'To page', inp('to', { maxlength: 6, inputmode: 'numeric' })),
          h('label', { class: 'rl-date-in' }, 'Read on', inp('date', { type: 'date' })),
          h('label', { class: 'rl-chap' }, 'Chapter (optional)', inp('chapter', { maxlength: 140 }))
        ),
        note,
        h('button', { type: 'button', class: 'btn small danger', onclick: () => { s.reading_log.splice(i, 1); rerender(); } }, 'Remove this session')
      );
    });
  return h(
    'fieldset',
    { class: 'group ep-log' },
    h('legend', null, `Reading log${s.reading_log.length ? ` (${s.reading_log.length})` : ''}`),
    h('p', { class: 'hint' }, 'Log what you read and when, with an optional chapter and note. It shows as a library card under the review, and "Up to page" follows along.'),
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: add }, '+ Log reading')),
    ...rows
  );
}

// TV: a diary of single episodes. Newest at the top; logging the next one moves
// "Up to episode" along with it.
function episodeLog(s, rerender) {
  const num = (v) => (/^\d+$/.test(String(v).trim()) ? Number(String(v).trim()) : null);
  // Logs the next episode, or the next few at once for a binge.
  const add = (count = 1) => {
    const last = s.episodes[s.episodes.length - 1];
    const season = String(s.season || last?.season || '').trim();
    const same = s.episodes.filter((e) => String(e.season).trim() === season).map((e) => num(e.to) ?? num(e.ep)).filter((x) => x != null);
    const upTo = num(s.episode);
    const ep = Math.max(0, ...same, upTo ?? 0) + 1;
    const to = count > 1 ? ep + count - 1 : null;
    s.episodes.push({ season, ep: String(ep), to: to ? String(to) : '', title: '', rating: null, note: '', date: today() });
    if (upTo == null || (to ?? ep) > upTo) s.episode = String(to ?? ep);
    rerender();
  };
  const rows = s.episodes
    .map((e, i) => [e, i])
    .reverse()
    .map(([e, i]) => {
      const inp = (key, attrs) => {
        const el = h('input', { class: 'input', value: e[key] ?? '', ...attrs });
        el.addEventListener('input', () => (e[key] = el.value));
        return el;
      };
      const starRow = h('div', { class: 'star-pick small', role: 'group', 'aria-label': 'Episode rating' });
      for (let k = 1; k <= 5; k++) {
        starRow.append(h('button', { type: 'button', 'aria-label': `${k} star${k > 1 ? 's' : ''}`, 'aria-pressed': String(e.rating === k), html: ICON.star(e.rating >= k ? '#f5b301' : '#e2e2e2'), onclick: () => { e.rating = e.rating === k ? null : k; rerender(); } }));
      }
      const note = h('textarea', { class: 'textarea short', placeholder: 'What happened, what you thought (optional)', maxlength: 2000 });
      note.value = e.note;
      note.addEventListener('input', () => (e.note = note.value));
      return h(
        'div',
        { class: 'ep-edit' },
        h(
          'div',
          { class: 'ep-edit-top' },
          h('label', { class: 'ep-mini' }, 'Season', inp('season', { maxlength: 12, inputmode: 'numeric', 'aria-label': 'Season' })),
          h('label', { class: 'ep-mini' }, 'Ep', inp('ep', { maxlength: 12, inputmode: 'numeric', 'aria-label': 'Episode number' })),
          h('label', { class: 'ep-mini' }, 'to Ep', inp('to', { maxlength: 12, inputmode: 'numeric', placeholder: 'binge', 'aria-label': 'Last episode, for a binge' })),
          h('label', { class: 'ep-grow' }, 'Episode title (optional)', inp('title', { maxlength: 140 })),
          h('label', { class: 'ep-date-in' }, 'Watched', inp('date', { type: 'date' }))
        ),
        starRow,
        note,
        h('button', { type: 'button', class: 'btn small danger', onclick: () => { s.episodes.splice(i, 1); rerender(); } }, 'Remove this episode')
      );
    });
  return h(
    'fieldset',
    { class: 'group ep-log' },
    h('legend', null, `Episode diary${s.episodes.length ? ` (${s.episodes.length})` : ''}`),
    h('p', { class: 'hint' }, 'Log single episodes, or a binge of several (fill in "to Ep"), with their own stars and a note. They show as an episode guide under the review.'),
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => add(1) }, '+ Log an episode'), h('button', { type: 'button', class: 'btn', onclick: () => add(3) }, '+ Log a binge')),
    ...rows
  );
}

// ---------- place categories ----------

// The built-in kinds plus your own (kept in categories.md), and a way to add one on the spot.
async function saveCategoryLines(fn) {
  const text = (await readFile('categories.md')) ?? '';
  const lines = text.split('\n').filter((l) => /^\s*[-*]\s*\S/.test(l));
  const next = fn(lines);
  await putFile('categories.md', '# My place categories, one per line: "- Name, #colour"\n' + next.join('\n') + '\n');
}
const catKey = (label) => label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

function categoryPicker(s, rerender) {
  const chips = Object.entries(CATEGORIES).map(([c, v]) => h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(s.category === c), onclick: () => { s.category = c; rerender(); } }, h('span', { class: 'dot', style: { background: v.color } }), v.label));
  // A category typed into the file by hand that isn't in the list yet still shows.
  if (s.category && !CATEGORIES[s.category]) chips.push(h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'true' }, h('span', { class: 'dot', style: { background: catColor(s.category) } }), catLabel(s.category)));
  let maker = null;
  if (s._newCat) {
    const name = h('input', { class: 'input', maxlength: 30, placeholder: 'e.g. Bookshops', 'aria-label': 'New category name' });
    let colour = s._newCatColour || CUSTOM_COLORS[Object.keys(CATEGORIES).length % CUSTOM_COLORS.length];
    const swatches = h('div', { class: 'cat-swatches', role: 'group', 'aria-label': 'Colour' });
    const drawSw = () => swatches.replaceChildren(...CUSTOM_COLORS.map((c) => h('button', { type: 'button', class: 'cat-sw', 'aria-pressed': String(c === colour), 'aria-label': c, style: { background: c }, onclick: () => { colour = c; s._newCatColour = c; drawSw(); } })));
    drawSw();
    const add = h('button', { type: 'button', class: 'btn small go' }, 'Add category');
    add.addEventListener('click', async () => {
      const label = name.value.replace(/[,#]/g, ' ').replace(/\s+/g, ' ').trim();
      const key = catKey(label);
      if (!key) return name.focus();
      add.disabled = true;
      try {
        if (!CATEGORIES[key]) await saveCategoryLines((lines) => [...lines, `- ${label}, ${colour}`]);
        registerCategories([{ key, label, color: colour }]);
        s.category = key;
        s._newCat = false;
        toast(`"${label}" added. It's there for every place now.`);
        rerender();
      } catch (e) {
        toast(e.message, true);
        add.disabled = false;
      }
    });
    name.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), add.click()));
    setTimeout(() => name.focus(), 0);
    maker = h('div', { class: 'cat-maker' }, name, swatches, h('div', { class: 'row' }, add, h('button', { type: 'button', class: 'btn small', onclick: () => { s._newCat = false; rerender(); } }, 'Cancel')));
  }
  return h(
    'fieldset',
    { class: 'group' },
    h('legend', null, 'Type'),
    h('div', { class: 'chip-row' }, ...chips, s._newCat ? null : h('button', { type: 'button', class: 'chip-btn add-cat', onclick: () => { s._newCat = true; rerender(); } }, '+ New category')),
    maker
  );
}

// Site settings: your own categories, to recolour or remove.
function categoryManager() {
  const mine = Object.entries(CATEGORIES).filter(([, v]) => v.custom);
  const used = (k) => data.posts.filter((p) => p.category === k).length;
  return h(
    'fieldset',
    { class: 'group' },
    h('legend', null, 'Place categories'),
    h('p', { class: 'hint' }, `Built in: ${Object.values(CATEGORIES).filter((v) => !v.custom).map((v) => v.label).join(', ')}. Add your own from a place's "Type" with "+ New category".`),
    mine.length
      ? mine.map(([k, v]) =>
          h(
            'div',
            { class: 'row cat-row' },
            h('span', { class: 'dot big', style: { background: v.color } }),
            h('strong', { class: 'grow' }, v.label, h('small', { class: 'hint' }, ` · ${used(k)} place${used(k) === 1 ? '' : 's'}`)),
            h('div', { class: 'cat-swatches' }, CUSTOM_COLORS.map((c) => h('button', { type: 'button', class: 'cat-sw', 'aria-pressed': String(c === v.color), 'aria-label': `Make ${v.label} ${c}`, style: { background: c }, onclick: async () => {
              try {
                await saveCategoryLines((lines) => lines.map((l) => (catKey(l.replace(/^\s*[-*]\s*/, '').split(',')[0]) === k ? `- ${v.label}, ${c}` : l)));
                v.color = c;
                toast('Colour changed.');
                draw();
              } catch (e) {
                toast(e.message, true);
              }
            } }))),
            h('button', { type: 'button', class: 'btn small danger', onclick: async () => {
              if (!confirm(`Remove "${v.label}"? Places in it keep the name but lose its colour.`)) return;
              try {
                await saveCategoryLines((lines) => lines.filter((l) => catKey(l.replace(/^\s*[-*]\s*/, '').split(',')[0]) !== k));
                delete CATEGORIES[k];
                toast('Removed.');
                draw();
              } catch (e) {
                toast(e.message, true);
              }
            } }, 'Remove')
          )
        )
      : h('p', { class: 'hint' }, 'No categories of your own yet.')
  );
}

// Keepsakes you designed yourself (keepsakes.md), as editor entries like the built-in ones.
const customKinds = () =>
  (data?.keepsakes?.custom || []).map((d) => ({ types: d.types, group: d.tab, id: 'c-' + d.id, list: 'c_' + d.id, custom: d.id, name: d.name, sub: d.sub || SHAPES[d.shape] || '', label: 'written on it', first: '+ Add a line', ph: 'e.g. A line for it', pricePh: '£5', hint: 'Your own design: change it under Designs.', plain: true, noPrice: !d.prices }));
const allKinds = () => [...KEEPSAKES, ...customKinds()];
// The keepsakes a kind of post can have.
const keepsakesFor = (type) => allKinds().filter((k) => k.types.includes(type));
// The ones to offer in the editor: switched-off built-ins are left out, unless this post
// already has one stuck in (so it can still be taken out).
const keepsakesOffered = (s) => {
  const off = new Set(data?.keepsakes?.hidden || []);
  return keepsakesFor(s.type).filter((k) => !off.has(k.id) || s.keep?.[k.id]);
};

// Which keepsakes are ticked (a draft saved before they existed has none, apart from the
// till receipt it already had).
function keepOn(s) {
  for (const k of allKinds()) s[k.list] ||= [];
  s.keep ||= { till: !!s.ordered.length };
  return s.keep;
}
// Lines on a receipt or ticket, as written in the file: "Flat white — £3.40".
const keepLines = (list = []) => list.filter((o) => o.item.trim()).map((o) => (o.price.trim() ? `${o.item.trim()} — ${o.price.trim()}` : o.item.trim()));

// Places: keepsakes stuck into the journal under the map. Tick the ones you want; each opens
// its own short list of lines.
// Concerts, events and the stage are one pool shared by the journal and every review.
const ALL_SHARED = ['places', 'books', 'films', 'tv', 'podcasts', 'music'];
const KEEPSAKES = [
  { types: ['places'], group: 'Receipts', id: 'till', list: 'ordered', name: 'Till receipt', sub: 'café, restaurant, bar', label: 'what I ordered', first: '+ Add what you ordered', ph: 'e.g. Flat white', pricePh: '£3.40', hint: 'Prices are optional; with a price on every line it adds up the total.' },
  { types: ['places'], group: 'Receipts', id: 'shop', list: 'bought', name: 'Shop receipt', sub: 'what you bought', label: 'what I bought', first: '+ Add what you bought', ph: 'e.g. Linen shirt', pricePh: '£25', hint: 'Prices are optional; with a price on every line it adds up the total.' },
  { types: ['places'], group: 'Tickets', id: 'entry', list: 'tickets', name: 'Entry ticket', sub: 'museum, sights', label: 'on the ticket', first: '+ Add a line', ph: 'e.g. Adult entry', pricePh: '€14', hint: 'Leave it empty for a plain "admit one" ticket.', plain: true },
  { types: ['places'], group: 'Tickets', id: 'gallery', list: 'gallery', name: 'Gallery ticket', sub: 'exhibition, art', label: 'on the ticket', first: '+ Add a line', ph: 'e.g. Late opening', pricePh: '£12', hint: 'Leave it empty for a plain exhibition ticket.', plain: true },
  { types: ['places'], group: 'Tickets', id: 'theatre', list: 'theatre', name: 'Theatre ticket', sub: 'play, concert, show', label: 'on the ticket', first: '+ Add a line', ph: 'e.g. Stalls, row F', pricePh: '£35', hint: 'Leave it empty for a plain ticket.', plain: true },
  { types: ['places', 'films'], group: 'Tickets', id: 'cinema', list: 'cinema', name: 'Cinema stub', sub: 'a film night out', label: 'on the stub', first: '+ Add a line', ph: 'e.g. The late showing', pricePh: '£9', hint: 'Leave it empty for a plain stub.', plain: true },
  { types: ['places', 'books', 'podcasts'], group: 'Tickets', id: 'travel', list: 'rides', name: 'Travel ticket', sub: 'train, tram, boat', label: 'on the ticket', first: '+ Add a line', ph: 'e.g. Tram day pass', pricePh: '€5', hint: 'Leave it empty for a plain ticket with the place and date.', plain: true },
  { types: ['places'], group: 'Tickets', id: 'boarding', list: 'boarding', name: 'Boarding pass', sub: 'the flight there', label: 'on the pass', first: '+ Add a line', ph: 'e.g. Window seat, sunrise', hint: 'It shows the place, the date and your lines. Keep it to that: no flight numbers, seats or booking codes.', plain: true, noPrice: true },
  { types: ['places'], group: 'Tickets', id: 'cloakroom', list: 'cloakroom', name: 'Cloakroom ticket', sub: 'coat check', label: 'on the ticket', first: '+ Add a line', ph: 'e.g. 42 (the number)', hint: 'A number on the first line goes big on the ticket; without one it gets its own.', plain: true, noPrice: true },
  { types: ALL_SHARED, group: 'Concerts', id: 'wristband', list: 'wristband', name: 'Wristband', sub: 'festival, gig, club', label: 'on the band', first: '+ Add a line', ph: 'e.g. Weekend · all areas', hint: 'Leave it empty for a band with the place and date.', plain: true, noPrice: true },
  { types: ALL_SHARED, group: 'Concerts', plain: true, noPrice: true, id: 'handstamp', list: 'handstamp', name: 'Hand stamp', sub: 'for getting back in', label: 'the stamp', first: '+ Add a line', ph: 'e.g. Re-entry', hint: 'A word on the first line goes in the stamp; leave it empty for a star.' },
  { types: ALL_SHARED, group: 'Concerts', plain: true, noPrice: true, id: 'glowstick', list: 'glowstick', name: 'Glow stick', sub: 'festival, rave, party', label: 'written beside it', first: '+ Add a line', ph: 'e.g. pink', hint: 'pink, green, blue, yellow, orange or purple on the first line sets the glow; anything after is written beside it.' },
  { types: ALL_SHARED, group: 'Events', plain: true, noPrice: true, id: 'racebib', list: 'racebib', name: 'Race bib', sub: 'fun run, marathon, race', label: 'on the bib', first: '+ Add a line', ph: 'e.g. 1024 (your number)', hint: 'A number on the first line goes big on the bib; then anything else, like "10K" or a time.' },
  { types: ALL_SHARED, group: 'Events', plain: true, noPrice: true, id: 'ceremony', list: 'ceremony', name: 'Order of service', sub: 'wedding, ceremony, celebration', label: 'what happened', first: '+ Add a line', ph: 'e.g. First dance', hint: "One part of the day a line. It's headed with the place and the date." },
  { types: ALL_SHARED, group: 'Events', plain: true, noPrice: true, id: 'confetti', list: 'confetti', name: 'Confetti', sub: 'wedding, party, parade', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Still finding it in my bag', hint: 'A scatter of paper confetti, with your words.' },
  { types: ALL_SHARED, group: 'Events', plain: true, noPrice: true, id: 'balloon', list: 'balloon', name: 'Party balloon', sub: 'birthday, party', label: 'on the balloon', first: '+ Add a line', ph: 'e.g. 30!', hint: 'A word or a number on the first line goes on the balloon; anything after is written beside it.' },
  { types: ALL_SHARED, group: 'Events', plain: true, noPrice: true, id: 'matchday', list: 'matchday', name: 'Match ticket', sub: 'football, rugby, any game', label: 'on the ticket', first: '+ Add a line', ph: 'e.g. Home v Away', hint: 'Your first line is the match; leave it empty for a plain ticket with the ground and date.' },
  { types: ALL_SHARED, group: 'Events', plain: true, noPrice: true, id: 'funfair', list: 'funfair', name: 'Fairground token', sub: 'fair, carnival, arcade', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Won a goldfish', hint: 'A brass ride token with the place round the edge.' },
  { types: ALL_SHARED, group: 'Events', plain: true, noPrice: true, id: 'rosette', list: 'rosette', name: 'Rosette', sub: 'show, fête, county fair', label: 'in the middle', first: '+ Add a line', ph: 'e.g. 1st', hint: '1st, 2nd or 3rd on the first line sets the colour (red, blue, yellow); anything else gets purple.' },
  { types: ALL_SHARED, group: 'Events', plain: true, noPrice: true, id: 'namebadge', list: 'namebadge', name: 'Name badge', sub: 'conference, meetup, workshop', label: 'on the badge', first: '+ Add a line', ph: 'e.g. Your name', hint: 'Your name on the first line, written on a "Hello, my name is" sticker.' },
  { types: ALL_SHARED, group: 'Events', plain: true, noPrice: true, id: 'sparkler', list: 'sparkler', name: 'Sparkler', sub: 'bonfire night, new year', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Wrote my name in the air', hint: 'Fizzing, with your words beside it.' },
  { types: ALL_SHARED, group: 'Stage & comedy', plain: true, noPrice: true, id: 'masks', list: 'masks', name: 'Theatre masks', sub: 'comedy and tragedy 🎭', label: 'written beside them', first: '+ Add a line', ph: 'e.g. Laughed, then cried', hint: 'The two masks, with your words beside them.' },
  { types: ALL_SHARED, group: 'Stage & comedy', plain: true, noPrice: true, id: 'stageprog', list: 'stageprog', name: 'Theatre programme', sub: 'the play, the show', label: 'on the cover', first: '+ Add a line', ph: 'e.g. The name of the show', hint: 'The first line is the show (or the place, if you leave it empty); the rest go underneath.' },
  { types: ALL_SHARED, group: 'Stage & comedy', plain: true, noPrice: true, id: 'comedyticket', list: 'comedyticket', name: 'Comedy night ticket', sub: 'stand-up, open mic', label: 'on the ticket', first: '+ Add a line', ph: 'e.g. Front row (brave)', hint: 'Leave it empty for a plain comedy-club ticket.' },
  { types: ALL_SHARED, group: 'Stage & comedy', plain: true, noPrice: true, id: 'mic', list: 'mic', name: 'Microphone', sub: 'stand-up, open mic, karaoke', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Didn’t get picked on', hint: 'An old chrome mic on a stand, with your words.' },
  { types: ALL_SHARED, group: 'Stage & comedy', plain: true, noPrice: true, id: 'interval', list: 'interval', name: 'Interval ice cream', sub: 'the little tub and spoon', label: 'on the lid', first: '+ Add a line', ph: 'e.g. Strawberry', hint: 'The flavour on the first line goes on the lid; anything after is written beside it.' },
  { types: ALL_SHARED, group: 'Stage & comedy', plain: true, noPrice: true, id: 'operaglasses', list: 'operaglasses', name: 'Opera glasses', sub: 'for the back row', label: 'written beside them', first: '+ Add a line', ph: 'e.g. Could see every face', hint: 'Gold and mother-of-pearl, with your words.' },
  { types: ALL_SHARED, group: 'Stage & comedy', plain: true, noPrice: true, id: 'curtain', list: 'curtain', name: 'Curtain call', sub: 'red velvet curtains', label: 'under the curtain', first: '+ Add a line', ph: 'e.g. Standing ovation', hint: 'The place in lights between the curtains; your lines underneath.' },
  { types: ALL_SHARED, group: 'Stage & comedy', plain: true, noPrice: true, id: 'laughmeter', list: 'laughmeter', name: 'Laugh-o-meter', sub: 'how hard you laughed', label: 'the reading', first: '+ Add a line', ph: 'e.g. 9', hint: 'A number from 0 to 10 on the first line sets the needle; anything after is written underneath.' },
  { types: ALL_SHARED, group: 'Stage & comedy', plain: true, noPrice: true, id: 'joke', list: 'joke', name: 'Best line', sub: 'the joke you keep repeating', label: 'the joke', first: '+ Add a line', ph: 'e.g. In your own words', hint: 'The line you wanted to remember, in your own words.' },
  { types: ALL_SHARED, group: 'Concerts', plain: true, noPrice: true, id: 'flyer', list: 'flyer', name: 'Gig flyer', sub: 'the poster on the wall', label: 'on the flyer', first: '+ Add a line', ph: "e.g. The band's name", hint: 'The first line is the big name (or the place, if you leave it empty); the rest go underneath.' },
  { types: ALL_SHARED, group: 'Concerts', plain: true, noPrice: true, id: 'tourtee', list: 'tourtee', name: 'Tour T-shirt', sub: 'the dates on the back', label: 'the dates', first: '+ Add a line', ph: 'e.g. Birmingham 20 Oct', hint: 'One date a line, like the back of a tour shirt; leave it empty and it lists this one.' },
  { types: ALL_SHARED, group: 'Concerts', plain: true, noPrice: true, id: 'earplugs', list: 'earplugs', name: 'Foam earplugs', sub: 'for the loud ones', label: 'written beside them', first: '+ Add a line', ph: 'e.g. Ears still ringing', hint: 'A squashed orange pair, with your words.' },
  { types: ALL_SHARED, group: 'Concerts', plain: true, noPrice: true, id: 'drumstick', list: 'drumstick', name: 'Drumstick', sub: 'thrown into the crowd', label: 'on the stick', first: '+ Add a line', ph: 'e.g. Caught it!', hint: 'A few words written along the stick.' },
  { types: ALL_SHARED, group: 'Concerts', plain: true, noPrice: true, id: 'buttonbadge', list: 'buttonbadge', name: 'Button badge', sub: 'pinned on your jacket', label: 'on the badge', first: '+ Add a line', ph: 'e.g. I was there', hint: 'A round pin badge; a few words on the first line, the place round the edge.' },
  { types: ALL_SHARED, group: 'Concerts', plain: true, noPrice: true, id: 'seatplan', list: 'seatplan', name: 'Seating plan', sub: 'where you sat', label: 'written on it', first: '+ Add a line', ph: 'e.g. Way up in the gods', hint: 'The venue plan with your seat circled; your words underneath.' },
  { types: ALL_SHARED, group: 'Concerts', plain: true, noPrice: true, id: 'lozenge', list: 'lozenge', name: 'Throat sweets', sub: 'sang too loud', label: 'written beside it', first: '+ Add a line', ph: 'e.g. No voice left', hint: 'A little tin, for the morning after.' },
  { types: ['places'], group: 'Cards and paper', id: 'invite', list: 'invite', name: 'Invitation', sub: 'party, wedding, opening', label: 'on the card', first: '+ Add a line', ph: 'e.g. Dress code: garden party', hint: 'Leave it empty for a plain card.', plain: true, noPrice: true },
  { types: ['places'], group: 'Cards and paper', id: 'postcard', list: 'postcard', name: 'Postcard', sub: 'greetings from…', label: 'written on the back', first: '+ Add a line', ph: 'e.g. Wish you were here!', hint: 'The front is your first photo here (or a painted one). Tap it in the journal to turn it over.', plain: true, noPrice: true },
  { types: ['places', 'thoughts'], group: 'Cards and paper', id: 'fortune', list: 'fortune', name: 'Fortune slip', sub: 'from the cookie', label: 'the fortune', first: '+ Write the fortune', ph: 'e.g. A journey will bring you joy', hint: 'Leave it empty and one is picked for you.', plain: true, noPrice: true },
  { types: ['places'], group: 'Cards and paper', id: 'luggage', list: 'luggage', name: 'Luggage tag', sub: 'tied on with string', label: 'on the tag', first: '+ Add a line', ph: 'e.g. Fragile: souvenirs', hint: 'It says where to; your lines go underneath.', plain: true, noPrice: true },
  { types: ['places', 'thoughts'], group: 'Little things', id: 'matchbook', list: 'matchbook', name: 'Matchbook', sub: 'from a bar or restaurant', label: 'on the cover', first: '+ Add a line', ph: 'e.g. Since 1962', hint: 'The place name goes on the front; your lines go small underneath.', plain: true, noPrice: true },
  { types: ['places'], group: 'Little things', id: 'coaster', list: 'coaster', name: 'Coaster', sub: 'pub, bar', label: 'on the mat', first: '+ Add a line', ph: 'e.g. Pint of the house ale', hint: 'Comes with a ring stain, free of charge.', plain: true, noPrice: true },
  { types: ['places'], group: 'Little things', id: 'roomkey', list: 'roomkey', name: 'Room key', sub: 'hotel, stay', label: 'on the tag', first: '+ Add a line', ph: 'e.g. 12 (the room)', hint: 'A number on the first line goes on the tag; without one it gets its own.', plain: true, noPrice: true },
  { types: ['places'], group: 'Little things', id: 'flower', list: 'flower', name: 'Pressed flower', sub: 'park, garden, walk', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Picked by the lake', hint: 'Taped into the page, with your words beside it.', plain: true, noPrice: true },
  { types: ['places'], group: 'Outdoors', plain: true, noPrice: true, id: 'pitch', list: 'pitch', name: 'Campsite pitch tag', sub: 'clipped to the tent', label: 'on the tag', first: '+ Add a line', ph: 'e.g. 14 (the pitch)', hint: 'A number on the first line goes big on the tag; then anything else, like "2 nights".' },
  { types: ['places'], group: 'Outdoors', plain: true, noPrice: true, id: 'trailmap', list: 'trailmap', name: 'Trail map scrap', sub: 'a torn corner of the map', label: 'written on it', first: '+ Add a line', ph: 'e.g. Lunch at the top', hint: 'A dotted route, an X, and your notes in pen.' },
  { types: ['places'], group: 'Outdoors', plain: true, noPrice: true, id: 'parkpass', list: 'parkpass', name: 'Park pass', sub: 'national park, nature reserve', label: 'on the pass', first: '+ Add a line', ph: 'e.g. Day visitor', hint: 'Leave it empty for a plain day pass.' },
  { types: ['places'], group: 'Outdoors', plain: true, noPrice: true, id: 'patch', list: 'patch', name: 'Woven patch', sub: 'an embroidered badge', label: 'stitched on it', first: '+ Add a line', ph: 'e.g. 2026', hint: 'The place goes round the top; a line underneath if you like.' },
  { types: ['places'], group: 'Outdoors', plain: true, noPrice: true, id: 'summit', list: 'summit', name: 'Summit sticker', sub: 'made it to the top', label: 'on the sticker', first: '+ Add a line', ph: 'e.g. 978 m', hint: 'Leave it empty for "I made it to the top!"' },
  { types: ['places'], group: 'Outdoors', plain: true, noPrice: true, id: 'signpost', list: 'signpost', name: 'Trail signpost', sub: 'a wooden fingerpost', label: 'on the arm', first: '+ Add a line', ph: 'e.g. 3 miles', hint: 'The arm points to the place; your first line goes underneath, like a distance.' },
  { types: ['places'], group: 'Outdoors', plain: true, noPrice: true, id: 'leaf', list: 'leaf', name: 'Leaf or feather', sub: 'picked up on the way', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Found by the river', hint: 'An autumn leaf, or a feather if a line mentions one.' },
  { types: ['places'], group: 'Outdoors', plain: true, noPrice: true, id: 'marshmallow', list: 'marshmallow', name: 'Toasted marshmallow', sub: 'round the campfire', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Slightly on fire', hint: 'Golden, on a stick. Silly, but there.' },
  { types: ['places'], group: 'Outdoors', plain: true, noPrice: true, id: 'tides', list: 'tides', name: 'Tide times card', sub: 'beach, coastal walk', label: 'the tides', first: '+ Add a tide', ph: 'e.g. High 06:12', hint: 'One tide a line. Leave it empty for a plain card with a wave.' },
  { types: ['places'], group: 'Outdoors', plain: true, noPrice: true, id: 'compass', list: 'compass', name: 'Compass', sub: 'which way it was', label: 'the bearing', first: '+ Add a line', ph: 'e.g. NE', hint: 'A compass point on the first line (N, NE, SW…) sets the needle.' },
  { types: ['books'], group: 'For a book', id: 'bookmark', list: 'bookmark', name: 'Bookmark', sub: 'with a tassel', label: 'on the bookmark', first: '+ Add a line', ph: 'e.g. A line I underlined', hint: 'Your favourite line, or leave it plain.', plain: true, noPrice: true },
  { types: ['books'], group: 'For a book', id: 'librarycard', list: 'librarycard', name: 'Library card', sub: 'stamped due dates', label: 'the stamps', first: '+ Add a date', ph: 'e.g. 12 MAR', hint: 'One stamp a line; leave it empty and it gets a few of its own.', plain: true, noPrice: true },
  { types: ['books'], group: 'For a book', id: 'bookplate', list: 'bookplate', name: 'Bookplate', sub: 'ex libris', label: 'on the plate', first: '+ Add a line', ph: 'e.g. Your name', hint: 'A name on the first line, like "this book belongs to".', plain: true, noPrice: true },
  { types: ['films', 'tv'], group: 'For the screen', id: 'popcorn', list: 'popcorn', name: 'Popcorn box', sub: 'striped, half eaten', label: 'on the box', first: '+ Add a line', ph: 'e.g. Sweet and salty', hint: 'Leave it empty for plain popcorn.', plain: true, noPrice: true },
  { types: ['films'], group: 'For the screen', id: 'glasses3d', list: 'glasses3d', name: '3D glasses', sub: 'red and blue', label: 'written beside them', first: '+ Add a line', ph: 'e.g. Worth it for the ending', hint: 'Cardboard, a bit bent.', plain: true, noPrice: true },
  { types: ['films', 'tv'], group: 'For the screen', id: 'rental', list: 'rental', name: 'Video rental sticker', sub: 'be kind, rewind', label: 'on the sticker', first: '+ Add a line', ph: 'e.g. Due back Friday', hint: 'Leave it empty for "please rewind".', plain: true, noPrice: true },
  { types: ['tv'], group: 'For the screen', id: 'tvguide', list: 'tvguide', name: 'TV guide clipping', sub: 'circled in pen', label: 'the listing', first: '+ Add a line', ph: 'e.g. 9.00 Two-part finale', hint: 'The show is circled in pen; your lines become the listing.', plain: true, noPrice: true },
  { types: ['tv'], group: 'For the screen', id: 'remote', list: 'remote', name: 'Remote control', sub: 'chunky, old', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Fought over this', hint: 'With your note beside it.', plain: true, noPrice: true },
  { types: ['podcasts', 'music'], group: 'For listening', id: 'headphones', list: 'headphones', name: 'Headphones', sub: 'over the ears', label: 'written beside them', first: '+ Add a line', ph: 'e.g. On the train home', hint: 'Where you were listening, perhaps.', plain: true, noPrice: true },
  { types: ALL_SHARED, group: 'Concerts', id: 'gig', list: 'gig', name: 'Gig ticket', sub: 'a night out', label: 'on the ticket', first: '+ Add a line', ph: 'e.g. Standing · doors 7pm', pricePh: '£28', hint: 'Leave it empty for a plain ticket.', plain: true },
  { types: ALL_SHARED, group: 'Concerts', id: 'pick', list: 'pick', name: 'Guitar pick', sub: 'thrown into the crowd', label: 'on the pick', first: '+ Add a line', ph: 'e.g. Caught it!', hint: 'A word or two fits on it.', plain: true, noPrice: true },
  { types: ALL_SHARED, group: 'Concerts', id: 'setlist', list: 'setlist', name: 'Setlist', sub: 'taped to the stage', label: 'the songs', first: '+ Add a song', ph: 'e.g. Song title', hint: 'One song a line, in the order played.', plain: true, noPrice: true },
  { types: ['books'], group: 'For a book', id: 'busticket', list: 'busticket', name: 'Bus ticket bookmark', sub: 'used to keep your place', label: 'on the ticket', first: '+ Add a line', ph: 'e.g. Number 50 into town', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['books'], group: 'For a book', id: 'coffeering', list: 'coffeering', name: 'Coffee ring', sub: 'a stain on the page', label: 'written by it', first: '+ Add a line', ph: 'e.g. Sorry, library', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['books'], group: 'For a book', id: 'signature', list: 'signature', name: 'Signed card', sub: 'from the author', label: 'who it\'s to', first: '+ Add a line', ph: 'e.g. Sebastian', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['books'], group: 'For a book', id: 'bookclub', list: 'bookclub', name: 'Book club invite', sub: 'next month we\'re reading…', label: 'on the invite', first: '+ Add a line', ph: 'e.g. At Sam\'s, bring wine', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['books'], group: 'For a book', id: 'dogear', list: 'dogear', name: 'Dog-eared page', sub: 'where you got to', label: 'the page', first: '+ Add a line', ph: 'e.g. 214', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['films'], group: 'For the screen', id: 'stubpair', list: 'stubpair', name: 'Ticket stubs for two', sub: 'stuck together', label: 'on the stubs', first: '+ Add a line', ph: 'e.g. With Sam', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['films'], group: 'For the screen', id: 'programme', list: 'programme', name: 'Cinema programme', sub: 'a little fold-out leaflet', label: 'in the programme', first: '+ Add a line', ph: 'e.g. Director\'s cut', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['films'], group: 'For the screen', id: 'picknmix', list: 'picknmix', name: 'Pick \'n\' mix bag', sub: 'sweets for the film', label: 'on the bag', first: '+ Add a line', ph: 'e.g. Mostly cola bottles', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['films'], group: 'For the screen', id: 'drivein', list: 'drivein', name: 'Drive-in speaker tag', sub: 'hung on the window', label: 'on the tag', first: '+ Add a line', ph: 'e.g. Bay 12', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['tv'], group: 'For the screen', id: 'tally', list: 'tally', name: 'Binge tally', sub: 'episodes in one go', label: 'the count', first: '+ Add a line', ph: 'e.g. 7', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['tv'], group: 'For the screen', id: 'takeaway', list: 'takeaway', name: 'Takeaway menu', sub: 'your order circled', label: 'the order', first: '+ Add a line', ph: 'e.g. Chips and curry sauce', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['tv'], group: 'For the screen', id: 'nospoil', list: 'nospoil', name: '"No spoilers!" note', sub: 'for everyone else', label: 'on the note', first: '+ Add a line', ph: 'e.g. Season 3 ending!!', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['tv'], group: 'For the screen', id: 'battery', list: 'battery', name: 'Remote battery cover', sub: 'the bit that falls off', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Found under the sofa', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['podcasts'], group: 'For listening', id: 'jcard', list: 'jcard', name: 'Cassette J-card', sub: 'the folded insert', label: 'your notes', first: '+ Add a line', ph: 'e.g. Ep. 12 was the best', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['podcasts'], group: 'For listening', id: 'walkmap', list: 'walkmap', name: 'Walk map', sub: 'where you were walking', label: 'on the map', first: '+ Add a line', ph: 'e.g. Round the park', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['podcasts'], group: 'For listening', id: 'napkin', list: 'napkin', name: 'Napkin quote', sub: 'a line scribbled down', label: 'the quote', first: '+ Add a line', ph: 'e.g. Something worth keeping', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['music'], group: 'For listening', id: 'vinyllabel', list: 'vinyllabel', name: 'Record label', sub: 'the middle of the vinyl', label: 'on the label', first: '+ Add a line', ph: 'e.g. Side B', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['music'], group: 'For listening', id: 'mixtape', list: 'mixtape', name: 'Mixtape label', sub: 'tracks in your writing', label: 'the tracks', first: '+ Add a line', ph: 'e.g. Song for the car', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ALL_SHARED, group: 'Concerts', id: 'backstage', list: 'backstage', name: 'Backstage pass', sub: 'on a lanyard', label: 'on the pass', first: '+ Add a line', ph: 'e.g. All access', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ALL_SHARED, group: 'Concerts', id: 'lighter', list: 'lighter', name: 'Lighter in the air', sub: 'for the encore', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Encore was unreal', hint: 'Leave it empty and it makes something up.', plain: true, noPrice: true },
  { types: ['thoughts'], group: 'For a thought', id: 'diary', list: 'diary', name: 'Diary page', sub: 'dear diary…', label: 'written on it', first: '+ Add a line', ph: 'e.g. Today was a good one', hint: 'A torn page with the date, in your handwriting.', plain: true, noPrice: true },
  { types: ['thoughts'], group: 'For a thought', id: 'moodring', list: 'moodring', name: 'Mood ring', sub: 'the colour of the day', label: 'the mood', first: '+ Add the mood', ph: 'e.g. calm', hint: 'calm, happy, stormy, love, sad, excited, sleepy or curious sets the stone.', plain: true, noPrice: true },
  { types: ['thoughts'], group: 'For a thought', id: 'doodle', list: 'doodle', name: 'Doodle', sub: 'drawn in the margin', label: 'what to draw', first: '+ Add a line', ph: 'e.g. heart', hint: 'heart, star, cloud, spiral, sun or flower on the first line; anything after is written beside it.', plain: true, noPrice: true },
  { types: ['thoughts'], group: 'For a thought', id: 'cootie', list: 'cootie', name: 'Paper fortune teller', sub: 'folded, from school', label: 'under the flaps', first: '+ Add a line', ph: 'e.g. You will have a nap', hint: 'Your lines go under its flaps.', plain: true, noPrice: true },
  { types: ['thoughts'], group: 'For a thought', id: 'forecast', list: 'forecast', name: 'Weather report', sub: 'a newspaper clipping', label: 'the forecast', first: '+ Add a line', ph: 'e.g. Cloudy with a chance of overthinking', hint: 'Leave it empty and it makes one up.', plain: true, noPrice: true },
  { types: ['thoughts'], group: 'For a thought', id: 'lyric', list: 'lyric', name: 'Song scrap', sub: 'a song on your mind', label: 'on the scrap', first: '+ Add a line', ph: 'e.g. A song title', hint: 'A song title, or your own words.', plain: true, noPrice: true },
  { types: ['thoughts', 'photos'], group: 'Memories', plain: true, noPrice: true, id: 'negatives', list: 'negatives', name: 'Film negatives', sub: 'a strip from the old roll', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Found these in a drawer', hint: 'Your photos here, as negatives (or empty frames if there are none).' },
  { types: ['thoughts', 'photos'], group: 'Memories', plain: true, noPrice: true, id: 'oldprint', list: 'oldprint', name: 'Old photo print', sub: 'faded, written on the back', label: 'on the back', first: '+ Add a line', ph: "e.g. Summer '19", hint: 'Your first photo, faded and sepia; leave it empty for the date of the memory.' },
  { types: ['thoughts', 'photos'], group: 'Memories', plain: true, noPrice: true, id: 'calendar', list: 'calendar', name: 'Calendar page', sub: 'the day it happened', label: 'written on it', first: '+ Add a line', ph: 'e.g. Best day ever', hint: 'Shows the date of the memory (or the day you posted).' },
  { types: ['thoughts', 'photos'], group: 'Memories', plain: true, noPrice: true, id: 'vhstape', list: 'vhstape', name: 'Home video tape', sub: 'labelled in pen', label: 'on the label', first: '+ Add a line', ph: 'e.g. Holiday 2009', hint: 'The first line is the label; leave it empty for "Memories" and the year.' },
  { types: ['thoughts', 'photos'], group: 'Memories', plain: true, noPrice: true, id: 'envelope', list: 'envelope', name: 'Old letter', sub: 'airmail, postmarked', label: 'written on it', first: '+ Add a line', ph: 'e.g. to Mum', hint: 'Postmarked with the year of the memory.' },
  { types: ['thoughts', 'photos'], group: 'Memories', plain: true, noPrice: true, id: 'thennow', list: 'thennow', name: 'Then and now', sub: 'how long ago it was', label: 'underneath', first: '+ Add a line', ph: 'e.g. still friends', hint: 'The year of the memory, this year, and how many years between.' },
  { types: ['thoughts', 'photos'], group: 'Memories', plain: true, noPrice: true, id: 'rewind', list: 'rewind', name: 'Rewind button', sub: 'with a tape counter', label: 'written beside it', first: '+ Add a line', ph: 'e.g. take me back', hint: 'The counter shows how many years back.' },
  { types: ['thoughts'], group: 'Sky', id: 'sky', list: 'sky', name: 'The sky right now', sub: 'matches when you posted', label: 'the caption', first: '+ Add a caption', ph: 'e.g. Pink again tonight', hint: 'The sky matches the time you posted: morning, day, sunset or night.', plain: true, noPrice: true },
  { types: ['thoughts'], group: 'Sky', plain: true, noPrice: true, id: 'skysunrise', list: 'skysunrise', name: 'Sunrise', sub: 'up with the sun', label: 'the caption', first: '+ Add a line', ph: 'e.g. up with the sun', hint: 'A Polaroid of the sky; your words go underneath.' },
  { types: ['thoughts'], group: 'Sky', plain: true, noPrice: true, id: 'skygolden', list: 'skygolden', name: 'Golden hour', sub: 'warm and low', label: 'the caption', first: '+ Add a line', ph: 'e.g. warm and low', hint: 'A Polaroid of the sky; your words go underneath.' },
  { types: ['thoughts'], group: 'Sky', plain: true, noPrice: true, id: 'skyrainbow', list: 'skyrainbow', name: 'Rainbow', sub: 'after the rain', label: 'the caption', first: '+ Add a line', ph: 'e.g. after the rain', hint: 'A Polaroid of the sky; your words go underneath.' },
  { types: ['thoughts'], group: 'Sky', plain: true, noPrice: true, id: 'skystorm', list: 'skystorm', name: 'Storm', sub: 'lightning and all', label: 'the caption', first: '+ Add a line', ph: 'e.g. lightning and all', hint: 'A Polaroid of the sky; your words go underneath.' },
  { types: ['thoughts'], group: 'Sky', plain: true, noPrice: true, id: 'skysnow', list: 'skysnow', name: 'Snowy sky', sub: 'flakes falling', label: 'the caption', first: '+ Add a line', ph: 'e.g. flakes falling', hint: 'A Polaroid of the sky; your words go underneath.' },
  { types: ['thoughts'], group: 'Sky', plain: true, noPrice: true, id: 'skystars', list: 'skystars', name: 'Starry night', sub: 'and a shooting star', label: 'the caption', first: '+ Add a line', ph: 'e.g. and a shooting star', hint: 'A Polaroid of the sky; your words go underneath.' },
  { types: ['thoughts'], group: 'Sky', plain: true, noPrice: true, id: 'skymoon', list: 'skymoon', name: 'Full moon', sub: 'bright tonight', label: 'the caption', first: '+ Add a line', ph: 'e.g. bright tonight', hint: 'A Polaroid of the sky; your words go underneath.' },
  { types: ['thoughts'], group: 'Sky', plain: true, noPrice: true, id: 'skyaurora', list: 'skyaurora', name: 'Northern lights', sub: 'green and purple', label: 'the caption', first: '+ Add a line', ph: 'e.g. green and purple', hint: 'A Polaroid of the sky; your words go underneath.' },
  { types: ['thoughts'], group: 'Sky', plain: true, noPrice: true, id: 'skyclouds', list: 'skyclouds', name: 'Fluffy clouds', sub: 'cloud spotting', label: 'the caption', first: '+ Add a line', ph: 'e.g. cloud spotting', hint: 'A Polaroid of the sky; your words go underneath.' },
  { types: ['thoughts'], group: 'Sky', plain: true, noPrice: true, id: 'skyfog', list: 'skyfog', name: 'Foggy morning', sub: 'trees in the mist', label: 'the caption', first: '+ Add a line', ph: 'e.g. trees in the mist', hint: 'A Polaroid of the sky; your words go underneath.' },
  { types: ['thoughts'], group: 'Sky', plain: true, noPrice: true, id: 'skyplane', list: 'skyplane', name: 'Plane overhead', sub: 'a vapour trail', label: 'the caption', first: '+ Add a line', ph: 'e.g. a vapour trail', hint: 'A Polaroid of the sky; your words go underneath.' },
  { types: ['thoughts'], group: 'Sky', plain: true, noPrice: true, id: 'skypink', list: 'skypink', name: 'Cotton candy', sub: 'pink and lilac', label: 'the caption', first: '+ Add a line', ph: 'e.g. pink and lilac', hint: 'A Polaroid of the sky; your words go underneath.' },
  { types: ['thoughts', 'places'], group: 'Gym', plain: true, noPrice: true, id: 'workout', list: 'workout', name: 'Workout stamp', sub: 'cardio, hypertrophy, strength…', label: 'the workout', first: '+ Add a line', ph: 'e.g. hypertrophy', hint: 'cardio, hypertrophy, strength, mobility, HIIT, endurance, yoga, leg day or rest day on the first line sets the stamp; anything after is written beside it.' },
  { types: ['thoughts', 'places'], group: 'Gym', plain: true, noPrice: true, id: 'gympass', list: 'gympass', name: 'Gym pass', sub: 'membership card', label: 'on the card', first: '+ Add a line', ph: 'e.g. 42 (the visit)', hint: 'A number on the first line is the visit number.' },
  { types: ['thoughts', 'places'], group: 'Gym', plain: true, noPrice: true, id: 'personalbest', list: 'personalbest', name: 'Personal best', sub: 'a new PB', label: 'the lift', first: '+ Add a line', ph: 'e.g. Deadlift 140 kg', hint: 'The first line goes big on the certificate.' },
  { types: ['thoughts', 'places'], group: 'Gym', plain: true, noPrice: true, id: 'dumbbell', list: 'dumbbell', name: 'Dumbbell', sub: 'lift heavy', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Upper body day', hint: 'With your words beside it.' },
  { types: ['thoughts', 'places'], group: 'Gym', plain: true, noPrice: true, id: 'steps', list: 'steps', name: 'Step counter', sub: 'steps today', label: 'the steps', first: '+ Add a line', ph: 'e.g. 12,408', hint: 'A number on the first line shows on the screen.' },
  { types: ['thoughts', 'places'], group: 'Gym', plain: true, noPrice: true, id: 'shaker', list: 'shaker', name: 'Protein shaker', sub: 'post-workout', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Chocolate, obviously', hint: 'With your words beside it.' },
  { types: ['thoughts', 'places'], group: 'Gym', plain: true, noPrice: true, id: 'heartrate', list: 'heartrate', name: 'Heart rate', sub: 'beats per minute', label: 'the reading', first: '+ Add a line', ph: 'e.g. 168', hint: 'A number on the first line is the BPM.' },
  { types: ['thoughts', 'places'], group: 'Gym', plain: true, noPrice: true, id: 'setsheet', list: 'setsheet', name: 'Training log', sub: 'sets and reps, ticked off', label: 'the sets', first: '+ Add a line', ph: 'e.g. Squat 5 × 5', hint: 'One exercise a line.' },
  { types: ['thoughts', 'places'], group: 'Gym', plain: true, noPrice: true, id: 'medal', list: 'medal', name: 'Finisher medal', sub: 'race, challenge', label: 'on the medal', first: '+ Add a line', ph: 'e.g. 10K', hint: 'A word or two on the first line goes on the medal.' },
  { types: ['thoughts', 'places'], group: 'Gym', plain: true, noPrice: true, id: 'waterbottle', list: 'waterbottle', name: 'Water bottle', sub: 'stay hydrated', label: 'written beside it', first: '+ Add a line', ph: 'e.g. 3 litres today', hint: 'With your words beside it.' },
  { types: ['thoughts'], group: 'Times of day', plain: true, noPrice: true, id: 'alarmclock', list: 'alarmclock', name: 'Alarm clock', sub: 'what time you got up', label: 'the time', first: '+ Add a line', ph: 'e.g. 6:30', hint: 'A time on the first line sets the hands; otherwise it shows when you posted.' },
  { types: ['thoughts'], group: 'Times of day', plain: true, noPrice: true, id: 'riseshine', list: 'riseshine', name: 'Rise and shine', sub: 'good morning!', label: 'underneath', first: '+ Add a line', ph: 'e.g. a brand new day', hint: 'A card with the sun coming up.' },
  { types: ['thoughts'], group: 'Times of day', plain: true, noPrice: true, id: 'firstcoffee', list: 'firstcoffee', name: 'First coffee', sub: 'the morning cup', label: 'written beside it', first: '+ Add a line', ph: 'e.g. 7:15', hint: 'A time on the first line; otherwise when you posted.' },
  { types: ['thoughts'], group: 'Times of day', plain: true, noPrice: true, id: 'lunchbreak', list: 'lunchbreak', name: 'Lunch break', sub: 'a sandwich, at last', label: 'written beside it', first: '+ Add a line', ph: 'e.g. 13:05', hint: 'A time on the first line; otherwise when you posted.' },
  { types: ['thoughts'], group: 'Times of day', plain: true, noPrice: true, id: 'teatime', list: 'teatime', name: 'Tea time', sub: 'a cup and a biscuit', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Builder’s, two sugars', hint: 'With your words beside it.' },
  { types: ['thoughts'], group: 'Times of day', plain: true, noPrice: true, id: 'nightowl', list: 'nightowl', name: 'Night owl', sub: 'up late', label: 'written beside it', first: '+ Add a line', ph: 'e.g. 2:14', hint: 'A time on the first line; otherwise when you posted.' },
  { types: ['thoughts'], group: 'Times of day', plain: true, noPrice: true, id: 'sleepmask', list: 'sleepmask', name: 'Sleep mask', sub: 'off to bed', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Big day tomorrow', hint: 'With your words beside it.' },
  { types: ['thoughts'], group: 'Times of day', plain: true, noPrice: true, id: 'ledclock', list: 'ledclock', name: 'Digital clock', sub: 'red numbers', label: 'the time', first: '+ Add a line', ph: 'e.g. 23:59', hint: 'A time on the first line; otherwise when you posted.' },
  { types: ['music'], group: 'Awards & charts', plain: true, noPrice: true, id: 'discaward', list: 'discaward', name: 'Disc award', sub: 'framed, gold or platinum', label: 'on the plaque', first: '+ Add a line', ph: 'e.g. platinum', hint: 'silver, gold, platinum or diamond on the first line sets the disc; anything after goes on the plaque.' },
  { types: ['music', 'podcasts'], group: 'Awards & charts', plain: true, noPrice: true, id: 'trophy', list: 'trophy', name: 'Trophy', sub: 'engraved cup', label: 'engraved on it', first: '+ Add a line', ph: 'e.g. Album of the year', hint: 'The first line is engraved on the plate.' },
  { types: ['music', 'podcasts'], group: 'Awards & charts', plain: true, noPrice: true, id: 'chartno1', list: 'chartno1', name: 'Chart clipping', sub: 'top of the charts', label: 'its position', first: '+ Add a line', ph: 'e.g. 1', hint: 'A number on the first line is where it got to (number one if you leave it empty).' },
  { types: ['music'], group: 'Awards & charts', plain: true, noPrice: true, id: 'winnercard', list: 'winnercard', name: '"And the winner is…"', sub: 'the card from the envelope', label: 'the category', first: '+ Add a line', ph: 'e.g. Best album', hint: 'The first line is the award; the title and artist are the winner.' },
  { types: ['music', 'podcasts'], group: 'Awards & charts', plain: true, noPrice: true, id: 'goldmic', list: 'goldmic', name: 'Golden microphone', sub: 'an award on a stand', label: 'on the plate', first: '+ Add a line', ph: 'e.g. Best voice', hint: 'The first line goes on the plate.' },
  { types: ['music'], group: 'Awards & charts', plain: true, noPrice: true, id: 'autograph', list: 'autograph', name: 'Signed photo', sub: 'on stage, signed', label: 'the dedication', first: '+ Add a line', ph: 'e.g. To you,', hint: 'Signed with the artist’s name; your first line is the dedication.' },
  { types: ['music'], group: 'Awards & charts', plain: true, noPrice: true, id: 'fanclub', list: 'fanclub', name: 'Fan club card', sub: 'official member', label: 'on the card', first: '+ Add a line', ph: 'e.g. 0042 (your number)', hint: 'A number on the first line is your member number; a second line is the year you joined.' },
  { types: ['music'], group: 'Awards & charts', plain: true, noPrice: true, id: 'jukebox', list: 'jukebox', name: 'Jukebox title strip', sub: 'A1, B7…', label: 'the selection', first: '+ Add a line', ph: 'e.g. B7', hint: 'A code like B7 on the first line; otherwise one is picked.' },
  { types: ['music'], group: 'Awards & charts', plain: true, noPrice: true, id: 'radiorequest', list: 'radiorequest', name: 'Radio request', sub: 'please play…', label: 'who it’s for', first: '+ Add a line', ph: 'e.g. Mum', hint: 'The first line is who it’s for; any more lines are your message.' },
  { types: ['music'], group: 'Awards & charts', plain: true, noPrice: true, id: 'magreview', list: 'magreview', name: 'Magazine review', sub: 'clipped, with stars', label: 'the pull quote', first: '+ Add a line', ph: 'e.g. An instant classic', hint: 'The stars come from your rating.' },
  { types: ['music', 'podcasts'], group: 'Awards & charts', plain: true, noPrice: true, id: 'yearonrepeat', list: 'yearonrepeat', name: 'Year on repeat', sub: 'plays this year', label: 'the plays', first: '+ Add a line', ph: 'e.g. 1,204', hint: 'A number on the first line is how many plays.' },
  { types: ['music'], group: 'Awards & charts', plain: true, noPrice: true, id: 'sevenninch', list: 'sevenninch', name: '7-inch single', sub: 'in its picture sleeve', label: 'on the sleeve', first: '+ Add a line', ph: 'e.g. Side A · 45 RPM', hint: 'The first line goes small at the bottom of the sleeve.' },
  { types: ['thoughts', 'books'], group: 'Study', plain: true, noPrice: true, id: 'flashcard', list: 'flashcard', name: 'Flashcard', sub: 'question and answer', label: 'question, then answer', first: '+ Add a line', ph: 'e.g. What is consideration?', hint: 'The first line is the question, the second the answer.' },
  { types: ['thoughts', 'books'], group: 'Study', plain: true, noPrice: true, id: 'highlighter', list: 'highlighter', name: 'Highlighted line', sub: 'in neon highlighter', label: 'the lines', first: '+ Add a line', ph: 'e.g. the bit that will come up', hint: 'One line each; they get a highlighter colour each.' },
  { types: ['thoughts', 'books'], group: 'Study', plain: true, noPrice: true, id: 'pagetabs', list: 'pagetabs', name: 'Page tabs', sub: 'sticking out of a book', label: 'on the tabs', first: '+ Add a line', ph: 'e.g. Ch. 3', hint: 'A word or two per tab, up to six.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'timetable', list: 'timetable', name: 'Revision timetable', sub: 'the week, ticked off', label: 'the subjects', first: '+ Add a line', ph: 'e.g. Contract law', hint: 'One subject a line; slots before today are ticked.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'examslip', list: 'examslip', name: 'Exam slip', sub: 'candidate copy', label: 'the paper', first: '+ Add a line', ph: 'e.g. Paper 2: Equity', hint: 'The first line is the paper; any more are notes.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'pomodoro', list: 'pomodoro', name: 'Pomodoro timer', sub: '25 minutes at a time', label: 'how many', first: '+ Add a line', ph: 'e.g. 6', hint: 'A number on the first line is how many sessions.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'desklamp', list: 'desklamp', name: 'Desk lamp', sub: 'late at the library', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Last one out', hint: 'With your words beside it.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'librarypass', list: 'librarypass', name: 'Library pass', sub: 'reader’s card', label: 'the room', first: '+ Add a line', ph: 'e.g. Law library', hint: 'The first line goes on the pass.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'grade', list: 'grade', name: 'Marked work', sub: 'grade in red pen', label: 'the grade, then the comment', first: '+ Add a line', ph: 'e.g. 2:1', hint: 'The first line is circled in red; the rest is the comment.' },
  { types: ['thoughts', 'books'], group: 'Study', plain: true, noPrice: true, id: 'casecard', list: 'casecard', name: 'Case card', sub: 'a case or key reading', label: 'name, then notes', first: '+ Add a line', ph: 'e.g. Carlill v Carbolic Smoke Ball', hint: 'A name with "v" in it is set like a case; the rest are your notes.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'mindmap', list: 'mindmap', name: 'Mind map', sub: 'ideas branching off', label: 'the centre, then branches', first: '+ Add a line', ph: 'e.g. Big idea', hint: 'The first line goes in the middle; up to six branches.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'revisionlist', list: 'revisionlist', name: 'Revision checklist', sub: 'some ticked off', label: 'the tasks', first: '+ Add a line', ph: 'e.g. Past paper', hint: 'One task a line.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'pencil', list: 'pencil', name: 'Pencil', sub: 'sharpened', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Ready', hint: 'With your words beside it.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'calculator', list: 'calculator', name: 'Calculator', sub: 'the answer on the screen', label: 'the number', first: '+ Add a line', ph: 'e.g. 42', hint: 'The first line shows on the screen.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'gradcap', list: 'gradcap', name: 'Graduation cap', sub: 'mortarboard', label: 'underneath', first: '+ Add a line', ph: 'e.g. Class of 2027', hint: 'The first line goes under it.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'diploma', list: 'diploma', name: 'Certificate', sub: 'rolled, with a seal', label: 'what it certifies', first: '+ Add a line', ph: 'e.g. LLM, with merit', hint: 'The first line goes big on the certificate.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'stopwatch', list: 'stopwatch', name: 'Study stopwatch', sub: 'hours studied', label: 'the hours', first: '+ Add a line', ph: 'e.g. 5', hint: 'A number on the first line is the hours.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'lecturenotes', list: 'lecturenotes', name: 'Lecture notes', sub: 'a page, with a doodle', label: 'title, then notes', first: '+ Add a line', ph: 'e.g. Lecture 3', hint: 'The first line is the title; then your notes.' },
  { types: ['thoughts'], group: 'Study', plain: true, noPrice: true, id: 'doordnd', list: 'doordnd', name: 'Do not disturb', sub: 'for the door', label: 'why', first: '+ Add a line', ph: 'e.g. revising!', hint: 'The first line goes under the sign.' },
  { types: ['thoughts', 'books'], group: 'Study', plain: true, noPrice: true, id: 'readinglist', list: 'readinglist', name: 'Reading list', sub: 'on a clipboard', label: 'the readings', first: '+ Add a line', ph: 'e.g. Chapter 4', hint: 'One reading a line; some get crossed off.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'idbadge', list: 'idbadge', name: 'ID badge', sub: 'on a lanyard', label: 'name, then team', first: '+ Add a line', ph: 'e.g. Your name', hint: 'The first line is the name; the second goes on the strip.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'timecard', list: 'timecard', name: 'Time card', sub: 'clocked in and out', label: 'the times', first: '+ Add a line', ph: 'e.g. 9:02 – 17:45', hint: 'Two times on the first line set in and out.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'meetinginvite', list: 'meetinginvite', name: 'Meeting invite', sub: 'accept, maybe, decline', label: 'the meeting', first: '+ Add a line', ph: 'e.g. Quick sync', hint: 'The first line is the title; then notes.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'outofoffice', list: 'outofoffice', name: 'Out of office', sub: 'auto-reply', label: 'the message', first: '+ Add a line', ph: 'e.g. Back Monday.', hint: 'Your message, one line each.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'businesscard', list: 'businesscard', name: 'Business card', sub: 'name and title', label: 'name, title, details', first: '+ Add a line', ph: 'e.g. Your name', hint: 'Name, then job title, then anything else.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'inboxzero', list: 'inboxzero', name: 'Inbox', sub: 'unread count', label: 'the number', first: '+ Add a line', ph: 'e.g. 0', hint: 'A number on the first line; 0 is inbox zero!' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'laptop', list: 'laptop', name: 'Laptop', sub: 'heads down', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Deep work', hint: 'With your words beside it.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'briefcase', list: 'briefcase', name: 'Briefcase', sub: 'off to work', label: 'written beside it', first: '+ Add a line', ph: 'e.g. First day!', hint: 'With your words beside it.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'deskplate', list: 'deskplate', name: 'Desk name plate', sub: 'brass on wood', label: 'the name, then title', first: '+ Add a line', ph: 'e.g. The Boss', hint: 'The first line goes on the plate.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'stapler', list: 'stapler', name: 'Red stapler', sub: 'don’t touch it', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Mine.', hint: 'With your words beside it.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'paperclips', list: 'paperclips', name: 'Paperclips', sub: 'a little chain', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Holding it together', hint: 'With your words beside it.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'memo', list: 'memo', name: 'Memo', sub: 'typed', label: 'subject, then to', first: '+ Add a line', ph: 'e.g. Biscuits in the kitchen', hint: 'The first line is RE:, the second TO:, then the message.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'wfh', list: 'wfh', name: 'Working from home', sub: 'slippers on', label: 'written beside it', first: '+ Add a line', ph: 'e.g. Camera off', hint: 'With your words beside it.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'tgif', list: 'tgif', name: 'Friday stamp', sub: 'week done', label: 'the stamp', first: '+ Add a line', ph: 'e.g. FRIDAY!', hint: 'The first line goes in the stamp.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'deadline', list: 'deadline', name: 'Deadline', sub: 'circled on the calendar', label: 'the day', first: '+ Add a line', ph: 'e.g. 28', hint: 'A day number on the first line is circled.' },
  { types: ['thoughts'], group: 'Work', plain: true, noPrice: true, id: 'employeemonth', list: 'employeemonth', name: 'Employee of the month', sub: 'framed', label: 'the name', first: '+ Add a line', ph: 'e.g. Me, obviously', hint: 'The first line goes under the picture.' },
  { types: ['books', 'films', 'tv', 'podcasts', 'music', 'thoughts'], group: 'Notes', id: 'note', list: 'note', name: 'Sticky note', sub: 'a thought stuck on', label: 'written on it', first: '+ Add a line', ph: 'e.g. Recommend to Mum', hint: 'A little yellow note, in your handwriting.', plain: true, noPrice: true }
];
// One pool: every keepsake can go on every kind of post that has keepsakes. Each keeps the
// kinds of post it was made for (`home`), and the editor shows those tabs first.
const KEEP_TYPES = ['places', 'thoughts', 'photos', 'books', 'films', 'tv', 'podcasts', 'music'];
for (const k of KEEPSAKES) {
  k.home = k.types;
  k.types = KEEP_TYPES;
}
// The front of the postcard: your first photo, or one of the painted scenes.
const SCENE_NAMES = [['', 'My photo (or one to suit the place)'], ['seaside', 'Seaside'], ['city', 'City'], ['countryside', 'Countryside, hills'], ['forest', 'Forest'], ['mountains', 'Mountains'], ['lakeside', 'Lakeside at sunset']];
function sceneChoice(s) {
  const pick = h('select', { class: 'input', 'aria-label': 'Front of the postcard' }, SCENE_NAMES.map(([v, label]) => h('option', { value: v, selected: (s.postcard_scene || '') === v }, label)));
  pick.addEventListener('change', () => (s.postcard_scene = pick.value));
  return h('label', { class: 'scene-pick' }, h('span', null, 'Front'), pick);
}
function keepsakesEditor(s, rerender) {
  keepOn(s);
  const kinds = keepsakesOffered(s);
  const count = kinds.filter((k) => s.keep[k.id]).length;
  // Folded away like Floppy's lines, so the editor stays tidy; open while you're using it.
  const box = h('details', { class: 'keep-panel', open: s._keepOpen ?? count > 0 });
  box.addEventListener('toggle', () => (s._keepOpen = box.open));
  box.append(h('summary', null, s.type === 'places' ? 'Keepsakes in the journal' : s.type === 'thoughts' ? 'Keepsakes with the thought' : s.type === 'photos' ? 'Keepsakes with the photos' : 'Keepsakes with the review', count ? h('span', { class: 'keep-count' }, `${count} stuck in`) : h('span', { class: 'keep-count none' }, s.type === 'places' ? 'receipts, tickets, little things' : 'tick what to stick in')));
  // One tab per group, so only one set of tick boxes shows at a time; each tab says how many
  // of its keepsakes are ticked.
  // The groups made for this kind of post come first, then the shared ones.
  // The tabs made for this kind of post come first (those only for it, then those it shares),
  // then the rest of the pool, each in the usual order.
  const fit = (g) => Math.max(0, ...kinds.filter((k) => k.group === g).map((k) => ((k.home || k.types).includes(s.type) ? ((k.home || k.types).length === 1 ? 2 : 1) : 0)));
  const groups = [...new Set(kinds.map((k) => k.group))].sort((a, b) => fit(b) - fit(a));
  // Open on a tab with something ticked, or this kind of post's own first tab (afresh whenever
  // the kind of post changes, as every tab is offered to every kind now).
  if (!groups.includes(s._keepTab) || s._keepTabFor !== s.type) {
    s._keepTab = groups.find((g) => kinds.some((k) => k.group === g && s.keep[k.id])) || groups[0];
    s._keepTabFor = s.type;
  }
  box.append(
    h(
      'div',
      { class: 'keep-tabs', role: 'tablist' },
      groups.map((g) => {
        const n = kinds.filter((k) => k.group === g && s.keep[k.id]).length;
        return h('button', { type: 'button', role: 'tab', class: 'keep-tab' + (g === s._keepTab ? ' on' : ''), 'aria-selected': String(g === s._keepTab), onclick: () => { s._keepTab = g; rerender(); } }, g, n ? h('span', { class: 'keep-tab-n' }, String(n)) : null);
      })
    )
  );
  const ticks = h('div', { class: 'keep-ticks' });
  box.append(ticks);
  for (const k of kinds.filter((x) => x.group === s._keepTab)) {
    const on = h('input', { type: 'checkbox', checked: !!s.keep[k.id] });
    on.addEventListener('change', () => {
      s.keep[k.id] = on.checked;
      s._keepOpen = true;
      if (on.checked && !k.plain && !s[k.list].length) s[k.list].push({ item: '', price: '' });
      rerender();
      if (on.checked) setTimeout(() => document.querySelector(`.keep-lines[data-kind="${k.id}"] .input`)?.focus(), 0);
    });
    ticks.append(h('label', { class: 'keep-tick' + (s.keep[k.id] ? ' on' : '') }, on, h('span', null, h('strong', null, k.name), h('small', null, k.sub))));
  }
  // The lines for what's ticked in this tab.
  for (const k of kinds.filter((x) => x.group === s._keepTab)) {
    if (!s.keep[k.id]) continue;
    const list = s[k.list];
    const rows = list.map((o, i) => {
      const item = h('input', { class: 'input', value: o.item, maxlength: 60, placeholder: k.ph, 'aria-label': `${k.name}, line ${i + 1}` });
      item.addEventListener('input', () => (o.item = item.value));
      const price = k.noPrice ? null : h('input', { class: 'input price-in', value: o.price, maxlength: 14, placeholder: k.pricePh, 'aria-label': `Price ${i + 1}` });
      price?.addEventListener('input', () => (o.price = price.value));
      return h('div', { class: 'row fl-row' }, item, price, h('button', { type: 'button', class: 'btn small danger fl-remove', 'aria-label': `Remove line ${i + 1}`, onclick: () => { list.splice(i, 1); rerender(); } }, '×'));
    });
    box.append(
      h(
        'div',
        { class: 'keep-lines', 'data-kind': k.id },
        h('span', { class: 'keep-name' }, `${k.name}: ${k.label}`),
        k.id === 'postcard' ? sceneChoice(s) : null,
        ...rows,
        list.length < 30 ? h('button', { type: 'button', class: 'btn small fl-add', onclick: () => { list.push({ item: '', price: '' }); rerender(); setTimeout(() => [...document.querySelectorAll(`.keep-lines[data-kind="${k.id}"] .fl-row .input:not(.price-in)`)].pop()?.focus(), 0); } }, list.length ? '+ Add another line' : k.first) : null,
        h('span', { class: 'hint' }, k.hint)
      )
    );
  }
  return box;
}

// Floppy's lines for a post, folded away in one small section so the editor stays tidy.
// Places get two tabs: what he says in the screensaver and search, and in the journal margin.
const FLOPPY_TABS = [['floppy', 'Screensaver & search'], ['floppy_journal', 'Journal margin']];
function floppyLines(s, rerender) {
  const tabs = s.type === 'places' ? FLOPPY_TABS : FLOPPY_TABS.slice(0, 1);
  if (!tabs.some(([k]) => k === s._floppyTab)) s._floppyTab = 'floppy';
  const key = s._floppyTab;
  const list = s[key];
  const total = tabs.reduce((n, [k]) => n + s[k].filter((x) => x.trim()).length, 0);
  const rows = (list.length ? list : ['']).map((line, i) => {
    const input = h('input', { class: 'input grow', value: line, maxlength: 200, placeholder: i === 0 ? (key === 'floppy_journal' ? 'e.g. "I doodled myself here. Sorry."' : FLOPPY_HINT[s.type] || 'e.g. "I would have liked this one too."') : 'Another line…', 'aria-label': `Floppy line ${i + 1}` });
    input.addEventListener('input', () => {
      if (!list.length) list.push('');
      list[i] = input.value;
    });
    const remove = list.length > 1 ? h('button', { type: 'button', class: 'btn small danger fl-remove', 'aria-label': `Remove line ${i + 1}`, title: 'Remove this line', onclick: () => { list.splice(i, 1); rerender(); } }, '×') : null;
    return h('div', { class: 'row fl-row' }, input, remove);
  });
  const add = list.length < 20 ? h('button', { type: 'button', class: 'btn small fl-add', onclick: () => { if (!list.length) list.push(''); list.push(''); rerender(); setTimeout(() => [...document.querySelectorAll('.floppy-panel .fl-row input')].pop()?.focus(), 0); } }, '+ Add another line') : null;
  const where = key === 'floppy_journal' ? 'next to his doodle in the journal' : 'when he finds this post in search or pokes it in the screensaver';
  const panel = h(
    'details',
    { class: 'floppy-panel', open: s._floppyOpen || null },
    h('summary', null, h('span', { class: 'fp-ico', 'aria-hidden': 'true' }), 'Floppy', h('small', null, total ? `${total} line${total === 1 ? '' : 's'}` : 'optional · he makes things up')),
    tabs.length > 1 ? h('div', { class: 'chip-row fp-tabs', role: 'tablist' }, tabs.map(([k, label]) => h('button', { type: 'button', class: 'chip-btn', role: 'tab', 'aria-selected': String(k === key), 'aria-pressed': String(k === key), onclick: () => { s._floppyTab = k; rerender(); } }, label, s[k].filter((x) => x.trim()).length ? ` (${s[k].filter((x) => x.trim()).length})` : ''))) : null,
    ...rows,
    add,
    h('span', { class: 'hint' }, `He says one of these at random ${where}. Leave empty and he makes something up.`)
  );
  panel.addEventListener('toggle', () => (s._floppyOpen = panel.open));
  return panel;
}

const FLOPPY_HINT = {
  books: 'e.g. "Chapter 12 made me cry. I am a disk. I leaked."',
  films: 'e.g. "The bit with the train! I was not ready."',
  tv: 'e.g. "Season 2, episode 4. Never recovered."',
  music: 'e.g. "Track 3 is the one. Trust me."',
  podcasts: 'e.g. "Start with the one about lighthouses."',
  places: 'e.g. "Get the flat white. Thank me later."',
  photos: 'e.g. "I am in none of these. Again."',
  thoughts: 'e.g. "Deep stuff. I needed a lie down."'
};

function starPicker(s, rerender) {
  const starRow = h('div', { class: 'star-pick', role: 'group', 'aria-label': 'Rating' });
  for (let i = 1; i <= 5; i++) {
    const b = h('button', { type: 'button', 'aria-label': `${i} star${i > 1 ? 's' : ''}`, 'aria-pressed': String(s.rating === i), html: ICON.star(s.rating >= i ? '#f5b301' : s.rating >= i - 0.5 ? '#f8d77a' : '#e2e2e2') });
    b.addEventListener('click', () => {
      s.rating = s.rating === i ? null : i;
      rerender();
    });
    starRow.append(b);
  }
  return h('div', { class: 'field' }, h('span', { class: 'label' }, 'Rating'), starRow);
}

// "Suggested by" field. For a place, a matching wishlist entry that a reader suggested
// offers to fill it in.
function suggestedField(s, rerender) {
  const input = h('input', { class: 'input', value: s.suggested_by, maxlength: 40, placeholder: 'Leave empty if nobody suggested it' });
  input.addEventListener('input', () => (s.suggested_by = input.value));
  let offer = null;
  if (!s.suggested_by && s.type === 'places' && s.title.trim()) {
    const w = (data.wishlist?.want || []).find((x) => x.name.toLowerCase() === s.title.trim().toLowerCase());
    const m = w && /suggested by ([^:—]+)/i.exec(w.note || '');
    if (m) offer = h('button', { type: 'button', class: 'btn small', onclick: () => { s.suggested_by = m[1].trim(); rerender(); } }, `From your wishlist: suggested by ${m[1].trim()}. Add the stamp`);
  }
  return h('div', { class: 'field' }, h('label', null, 'Suggested by'), input, offer, h('span', { class: 'hint' }, 'Adds a "Suggested by …" stamp to the review.'));
}

function viewEditor() {
  const s = editor || (editor = newEditor('thoughts'));
  const wrap = h('div', { class: 'field' });
  const rerender = () => {
    panel.replaceChildren(viewEditor());
  };

  if (s.raw != null) {
    const ta = h('textarea', { class: 'textarea mono', spellcheck: 'false' });
    ta.value = s.raw;
    const start = s.raw;
    ta.addEventListener('input', () => (s.raw = ta.value));
    const saveBtn = h('button', { type: 'button', class: 'btn go' }, 'Save file');
    saveBtn.addEventListener('click', () => save(s, saveBtn));
    const back = () => {
      if (s.raw !== start && !confirm('Go back to the form? Changes made to the text here will be lost.')) return;
      s.raw = null;
      rerender();
    };
    wrap.append(
      s.problem
        ? h('div', { class: 'info problem' }, h('strong', null, s.problemHidden ? 'This post is hidden from the site because its header has a mistake. ' : 'Not saved yet: the header has a mistake. '), 'Fix it below and save. Text with a colon, # or quotes in it needs "double quotes" around it.', h('pre', { class: 'problem-msg' }, String(s.problem).replace(/^The header has a mistake\. /, '')))
        : h('div', { class: 'info' }, 'You are editing the file itself. The part between the --- lines is the header; your words go underneath.'),
      field(s.key || keyFor(s), ta),
      h('div', { class: 'row end' }, s.problemHidden ? h('button', { type: 'button', class: 'btn', onclick: () => { editor = null; forgetDraft(); go('posts'); } }, 'Cancel') : h('button', { type: 'button', class: 'btn', onclick: back }, 'Back to the form'), saveBtn)
    );
    return wrap;
  }

  // Unsaved writing from before, offered again when starting a fresh post.
  if (!s.key && !isDirty(s)) {
    const b = draftBanner(true);
    if (b) wrap.append(b);
  }

  // Type
  if (!s.key) {
    wrap.append(
      h(
        'div',
        { class: 'type-tabs', role: 'group', 'aria-label': 'Type of post' },
        TYPES.map(([t, label]) => h('button', { type: 'button', 'aria-pressed': String(s.type === t), onclick: () => { s.type = t; if (SHELF[t] && !SHELF[t].states.some(([w]) => w === s.status)) s.status = SHELF[t].states[0][0]; rerender(); } }, label))
      )
    );
  } else {
    wrap.append(h('p', { class: 'hint' }, `Editing ${TYPE_LABEL[s.type].toLowerCase()} · ${s.key}`));
  }

  if (s.type === 'places') wrap.append(placePicker(s, rerender));

  const title = h('input', { class: 'input', value: s.title, maxlength: 140, placeholder: s.type === 'places' ? 'Name of the place' : s.type === 'lists' ? 'Top 5 albums this month' : SHELF[s.type] ? '' : 'Optional' });
  title.addEventListener('input', () => (s.title = title.value));
  wrap.append(field(s.type === 'places' ? 'Place name' : SHELF[s.type] ? SHELF[s.type].titleLabel : 'Title', title));

  if (s.type === 'places') {
    wrap.append(
      categoryPicker(s, rerender)
    );
    const ret = h('input', { type: 'checkbox', checked: s.would_return });
    ret.addEventListener('change', () => (s.would_return = ret.checked));
    wrap.append(starPicker(s, rerender), h('label', { class: 'row' }, ret, 'Stamp it "Would return"'), suggestedField(s, rerender));
    wrap.append(stampPicker(s, rerender));
    wrap.append(keepsakesEditor(s, rerender));
  }

  if (SHELF[s.type]) {
    const cfg = SHELF[s.type];
    const text = (key, label, placeholder, attrs = {}) => {
      const el = h('input', { class: 'input', value: s[key], placeholder, ...attrs });
      el.addEventListener('input', () => (s[key] = el.value));
      return field(label, el);
    };
    if (s.type === 'podcasts') wrap.append(text('episode', 'Episode (optional)', 'Leave empty to review the whole show', { maxlength: 140 }));
    if (s.type === 'books') {
      wrap.append(h('div', { class: 'grid-2' }, text('pages', 'Pages (optional)', 'e.g. 320', { maxlength: 6, inputmode: 'numeric' }), text('page', 'Up to page (optional)', 'e.g. 142', { maxlength: 6, inputmode: 'numeric' })));
    }
    if (s.type === 'tv') {
      wrap.append(
        h('div', { class: 'grid-2' }, text('season', 'Season (optional)', 'e.g. 2', { maxlength: 30, inputmode: 'numeric' }), text('episode', 'Up to episode (optional)', 'e.g. 5', { maxlength: 30, inputmode: 'numeric' })),
        text('network', 'Watched on (optional)', 'e.g. BBC, Netflix', { maxlength: 40 })
      );
    }
    if (s.type === 'music') {
      wrap.append(h('fieldset', { class: 'group' }, h('legend', null, 'Album or song'), h('div', { class: 'chip-row' }, [['album', 'Album'], ['song', 'Song']].map(([f, label]) => h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(s.format === f), onclick: () => { s.format = f; rerender(); } }, label)))));
      if (s.format === 'song') wrap.append(text('album', 'From the album (optional)', '', { maxlength: 140 }));
    }
    wrap.append(
      h('div', { class: 'grid-2' }, text('creator', cfg.creator, '', { maxlength: 100 }), text('year', 'Year', 'e.g. 1989', { maxlength: 10, inputmode: 'numeric' })),
      h('fieldset', { class: 'group' }, h('legend', null, 'Where you are with it'), h('div', { class: 'chip-row' }, cfg.states.map(([w, label]) => h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(s.status === w), onclick: () => { s.status = w; rerender(); } }, label)))),
      starPicker(s, rerender)
    );
    const rec = h('input', { type: 'checkbox', checked: s.recommend });
    rec.addEventListener('change', () => (s.recommend = rec.checked));
    wrap.append(h('label', { class: 'row' }, rec, 'Stamp it "Recommended"'));
    if (s.type === 'films' || s.type === 'tv') {
      const rw = h('input', { type: 'checkbox', checked: s.rewatch });
      rw.addEventListener('change', () => (s.rewatch = rw.checked));
      wrap.append(h('label', { class: 'row' }, rw, 'This was a rewatch'));
    }
    if (s.type === 'tv') wrap.append(episodeLog(s, rerender));
    if (s.type === 'books') wrap.append(readingLogEditor(s, rerender));
    const q = h('textarea', { class: 'textarea short', placeholder: s.type === 'books' ? 'A line you underlined' : s.type === 'music' ? 'A lyric that stuck' : 'A line that stuck' });
    q.value = s.quote;
    q.addEventListener('input', () => (s.quote = q.value));
    wrap.append(field('Favourite quote (optional)', q), suggestedField(s, rerender));
  }

  if (s.type === 'quotes') {
    const src = h('input', { class: 'input', value: s.source, placeholder: 'Author, Title' });
    src.addEventListener('input', () => (s.source = src.value));
    wrap.append(field('Source', src));
  }

  if (SHELF[s.type] || s.type === 'thoughts' || s.type === 'photos') wrap.append(keepsakesEditor(s, rerender));
  const body = h('textarea', { class: 'textarea', placeholder: s.type === 'places' ? 'What you ordered, the vibe, would you go back…' : s.type === 'lists' ? '1. One\n2. Two\n3. Three' : s.type === 'quotes' ? '> The line you want to keep.' : SHELF[s.type] ? 'What you thought of it. Leave empty if you just want it on the shelf.' : 'What is on your mind?' });
  body.value = s.body;
  body.addEventListener('input', () => (s.body = body.value));
  wrap.append(fontPicker(s, body));
  wrap.append(dressPicker(s));
  wrap.append(field(s.type === 'places' || SHELF[s.type] ? 'Review' : s.type === 'quotes' ? 'Quote' : 'Text', body, 'Markdown works: *italic*, **bold**, [links](https://…), "> " for a quote, "1." for a list.'));

  if (s.type === 'thoughts' || s.type === 'photos') wrap.append(memoryPicker(s, rerender));
  wrap.append(photoPicker(s, rerender));

  // Lines for Floppy to say about this post, in search and in the screensaver.
  wrap.append(floppyLines(s, rerender));

  const date = h('input', { class: 'input', type: 'datetime-local', value: s.date });
  date.addEventListener('change', () => (s.date = date.value));
  const draft = h('input', { type: 'checkbox', checked: s.draft });
  draft.addEventListener('change', () => (s.draft = draft.checked));
  const pin = h('input', { type: 'checkbox', checked: s.pinned });
  pin.addEventListener('change', () => (s.pinned = pin.checked));
  wrap.append(h('label', { class: 'row' }, pin, '📌 Pin it to the top of the feed and its section'));
  // The profile grid on the About page: posts with photos you pick, newest first.
  const grid = h('input', { type: 'checkbox', checked: !!s.profile, disabled: !s.photos.length });
  grid.addEventListener('change', () => {
    s.profile = grid.checked;
    rerender();
  });
  wrap.append(h('label', { class: 'row' + (s.photos.length ? '' : ' muted') }, grid, s.photos.length ? '▦ Show it on my profile grid (the About page)' : '▦ Show it on my profile grid (add a photo first)'));
  const coverPick = s.profile ? gridCoverPicker(s, rerender) : null;
  if (coverPick) wrap.append(coverPick);
  wrap.append(field('Date and time', date, SHELF[s.type] ? 'When you finished it, started it or added it. A time in the future publishes it later.' : 'Pick a time in the future to publish it later.'), h('label', { class: 'row' }, draft, 'Keep as a draft (only you can see it)'));

  const saveBtn = h('button', { type: 'button', class: 'btn go' }, s.key ? 'Save changes' : 'Publish');
  saveBtn.addEventListener('click', () => {
    if (s.type === 'places' && !s.title.trim()) return toast('Give the place a name first.', true);
    if (SHELF[s.type] && !s.title.trim()) return toast(`Add the ${TYPE_LABEL[s.type].toLowerCase()}'s title first.`, true);
    if (!s.body.trim() && !s.photos.length && !s.title.trim()) return toast('Write something first.', true);
    save(s, saveBtn);
  });
  const rawBtn = h('button', { type: 'button', class: 'btn', onclick: async () => {
    try {
      // The file as it is now, or, once anything has been changed in the form, the form's
      // version (so nothing typed, added or removed is lost on the way).
      nameNewPhotos(s);
      const fromForm = buildText(s);
      const untouched = s.key && fromForm === s._orig && !s.photos.some((p) => p.file) && !s.removed.length;
      s.raw = untouched ? await getFile(s.key) : fromForm;
      rerender();
    } catch (e) {
      toast(e.message, true);
    }
  } }, 'Edit as Markdown');
  wrap.append(statusToggle(s));
  wrap.append(h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: () => {
    if (isDirty(s) && !confirm(s.key ? 'Close without saving your changes?' : 'Throw away this post?')) return;
    editor = null;
    forgetDraft();
    go('posts');
  } }, s.key ? 'Cancel' : 'Discard'), rawBtn, saveBtn));
  return wrap;
}


// ---------- The thumbnail on the profile grid ----------
// With several photos, tap the one to show on the grid (the first, unless you pick another).
function gridCoverPicker(s, rerender) {
  const photos = s.photos.filter((ph) => ph.name || ph.file);
  if (photos.length < 2) return null;
  const chosen = photos.find((ph) => ph.cover) || photos[0];
  return h(
    'div',
    { class: 'grid-cover' },
    h('span', { class: 'label' }, 'Thumbnail on the grid'),
    h(
      'div',
      { class: 'grid-cover-row', role: 'radiogroup', 'aria-label': 'Thumbnail on the grid' },
      photos.map((ph, i) => {
        const src = ph.url || ph.thumb || ph.preview || '';
        return h(
          'button',
          { type: 'button', role: 'radio', class: 'grid-cover-pick' + (ph === chosen ? ' on' : ''), 'aria-checked': String(ph === chosen), 'aria-label': `Photo ${i + 1}${ph.caption ? ': ' + ph.caption : ''}`, onclick: () => {
            photos.forEach((x) => (x.cover = x === ph && i > 0));
            rerender();
          } },
          src ? h('img', { src, alt: '' }) : h('span', { class: 'thumb-wait' }, String(i + 1)),
          ph === chosen ? h('span', { class: 'grid-cover-tick', 'aria-hidden': 'true' }, '✓') : null
        );
      })
    )
  );
}

// ---------- Reliving a memory ----------
// A thought or photo dump about the past: tick it, say when it was (a year, a month or a
// day), and it gets an old, sepia look with a "reliving a memory" ribbon, plus the Memories
// keepsakes.
function memoryPicker(s, rerender) {
  const on = h('input', { type: 'checkbox', checked: !!s.memory });
  const parts = (s.memory || '').split('-');
  const exact = parts.length === 3 ? 'day' : parts.length === 2 ? 'month' : 'year';
  const box = h('fieldset', { class: 'group memory-pick' + (s.memory ? ' on' : '') }, h('legend', null, h('label', { class: 'check' }, on, ' Reliving a memory')));
  on.addEventListener('change', () => {
    s.memory = on.checked ? String(new Date().getFullYear() - 1) : '';
    rerender();
  });
  if (!s.memory) {
    box.append(h('p', { class: 'hint' }, 'Writing about the past, or posting old photos? Tick this and say when it was.'));
    return box;
  }
  const how = h('select', { class: 'input', 'aria-label': 'How exactly' }, [['year', 'Just the year'], ['month', 'The month'], ['day', 'The day']].map(([v, l]) => h('option', { value: v, selected: exact === v }, l)));
  const year = h('input', { class: 'input', type: 'number', min: 1900, max: new Date().getFullYear(), value: parts[0], 'aria-label': 'Year' });
  const month = h('select', { class: 'input', 'aria-label': 'Month' }, ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, k) => h('option', { value: String(k + 1).padStart(2, '0'), selected: parts[1] === String(k + 1).padStart(2, '0') }, m)));
  const day = h('input', { class: 'input', type: 'number', min: 1, max: 31, value: parts[2] ? String(+parts[2]) : '1', 'aria-label': 'Day' });
  const write = () => {
    const y = String(year.value).trim();
    if (!/^\d{4}$/.test(y)) return;
    s.memory = how.value === 'year' ? y : how.value === 'month' ? `${y}-${month.value}` : `${y}-${month.value}-${String(Math.min(31, Math.max(1, +day.value || 1))).padStart(2, '0')}`;
  };
  [year, month, day].forEach((el) => el.addEventListener('change', write));
  how.addEventListener('change', () => {
    write();
    rerender();
  });
  box.append(h('div', { class: 'row' }, how, how.value === 'day' ? day : null, how.value !== 'year' ? month : null, year), h('span', { class: 'hint' }, 'The Memories keepsakes (negatives, an old print, a calendar page…) are in the keepsakes below.'));
  return box;
}

// ---------- passport stamp picker ----------

let inkDefsAdded = false;
function stampPicker(s, rerender) {
  if (!inkDefsAdded) {
    const defs = h('div', { 'aria-hidden': 'true', style: { position: 'absolute', width: '0', height: '0', overflow: 'hidden' } });
    defs.innerHTML = INK_DEFS;
    document.body.append(defs);
    inkDefsAdded = true;
  }
  const city = s.city || s.title || 'Your city';
  const base = { city, country: s.country, code: s.country_code, date: fromInputDate(s.date), first: true };
  const label = (pick) => {
    if (!pick) return 'Automatic';
    const c = COUNTRIES[pick.toUpperCase()];
    return c ? c.name : DESIGN_NAMES[pick] || pick;
  };
  const preview = h('div', { class: 'stamp-preview', html: stampSvg({ ...base, index: 9000, stamp: s.stamp }) });
  const toggle = h('button', { type: 'button', class: 'btn' }, s._picking ? 'Close' : 'Change stamp');
  toggle.addEventListener('click', () => {
    s._picking = !s._picking;
    rerender();
  });

  const box = h(
    'fieldset',
    { class: 'group' },
    h('legend', null, 'Passport stamp'),
    h('div', { class: 'stamp-current' }, preview, h('div', null, h('strong', null, label(s.stamp)), h('p', { class: 'hint' }, s.stamp ? 'Picked by you.' : 'Picked for you from the country and city. The first city in each country gets that country\'s own stamp.'), toggle))
  );
  if (!s._picking) return box;

  const choose = (pick) => {
    s.stamp = pick;
    s._picking = false;
    rerender();
  };
  const tile = (pick, svg, name, search) => {
    const b = h('button', { type: 'button', class: 'stamp-tile', 'aria-pressed': String((s.stamp || '') === pick), 'data-search': search.toLowerCase(), onclick: () => choose(pick) });
    b.innerHTML = svg;
    b.append(h('span', null, name));
    return b;
  };
  const countries = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));
  const countryGrid = h(
    'div',
    { class: 'stamp-tiles' },
    countries.map((c, i) => tile(c.code.toLowerCase(), stampSvg({ city: c.capital, country: c.name, code: c.code, date: base.date, index: 9100 + i, stamp: c.code, plain: true }), c.name, `${c.name} ${c.capital} ${c.code}`))
  );
  const designGrid = h(
    'div',
    { class: 'stamp-tiles' },
    Object.entries(DESIGN_NAMES).map(([k, name], i) => tile(k, stampSvg({ ...base, index: 9400 + i, stamp: k, plain: true }), name, name))
  );
  let countryTitle, designTitle;
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Search countries and designs', 'aria-label': 'Search stamps' });
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const el of box.querySelectorAll('.stamp-tile[data-search]')) el.hidden = !!q && !el.dataset.search.includes(q);
    for (const [title, grid] of [[countryTitle, countryGrid], [designTitle, designGrid]]) title.hidden = grid.hidden = !grid.querySelector('.stamp-tile:not([hidden])');
  });
  const auto = h('button', { type: 'button', class: 'btn' + (s.stamp ? '' : ' go'), onclick: () => choose('') }, 'Automatic');
  countryTitle = h('p', { class: 'label' }, 'Countries');
  designTitle = h('p', { class: 'label' }, 'Other designs');
  box.append(h('div', { class: 'row' }, search, auto), countryTitle, countryGrid, designTitle, designGrid);
  setTimeout(() => search.focus({ preventScroll: true }), 0);
  return box;
}

function photoPicker(s, rerenderEditor) {
  // Photos finish converting in the background; only redraw if this post is still open.
  const rerender = () => tab === 'new' && editor === s && rerenderEditor();
  const thumbs = h('div', { class: 'thumbs' });
  s.photos.forEach((ph, i) => {
    const src = ph.url || ph.thumb || ph.preview || '';
    const cap = h('input', { value: ph.caption || '', placeholder: 'caption', 'aria-label': `Caption for photo ${i + 1}` });
    cap.addEventListener('input', () => (ph.caption = cap.value));
    thumbs.append(
      h(
        'div',
        { class: 'thumb' },
        src
          ? h('img', {
              src,
              alt: '',
              // A saved photo that can't be found: say so, so it can be removed and added again.
              onerror: (e) => e.target.replaceWith(h('span', { class: 'thumb-wait missing' }, 'Photo missing. Remove it and add it again.'))
            })
          : h('span', { class: 'thumb-wait' }, 'Preparing…'),
        cap,
        ph.small ? h('button', { type: 'button', class: 'filter-btn' + (s._filterFor === ph ? ' on' : ''), onclick: () => { s._filterFor = s._filterFor === ph ? null : ph; rerender(); } }, ph.filter && ph.filter !== 'none' ? FILTERS.find((f) => f.id === ph.filter).name : 'Filter…') : null,
        h('button', { type: 'button', class: 'x', 'aria-label': `Remove photo ${i + 1}`, onclick: () => { if (ph.name) s.removed.push(ph.name); if (s._filterFor === ph) s._filterFor = null; s.photos.splice(i, 1); rerender(); } }, '×')
      )
    );
  });
  const input = h('input', { type: 'file', accept: 'image/*,.heic,.heif,.hif', multiple: true, class: 'sr', id: 'photo-in' });
  input.addEventListener('change', () => {
    for (const f of input.files) {
      // Convert straight away: the preview then shows exactly what will be uploaded.
      const ph = { file: f, caption: '', filter: 'none', seed: (Math.random() * 2 ** 31) | 0, added: today() };
      ph.ready = twoAtATime(() => shrink(f));
      ph.ready.then(
        async (blob) => {
          ph.preview = URL.createObjectURL(blob);
          // A small copy to draw filter previews from.
          const bmp = await createImageBitmap(blob);
          ph.small = filtered(bmp, 'none', { max: 640 });
          bmp.close?.();
          await fontReady();
          rerender();
        },
        (e) => {
          s.photos.splice(s.photos.indexOf(ph), 1);
          toast(e.message, true);
          rerender();
        }
      );
      s.photos.push(ph);
    }
    rerender();
  });
  thumbs.append(h('label', { class: 'add-photo', for: 'photo-in' }, '+ Add photos'), input);
  const panel = s._filterFor && s._filterFor.small && s.photos.includes(s._filterFor) ? filterPanel(s, s._filterFor, rerender) : null;
  return h('div', { class: 'field' }, h('span', { class: 'label' }, 'Photos'), thumbs, panel, h('span', { class: 'hint' }, 'Tap Filter… under a photo to give it a look. Photos are resized and stripped of all hidden data (location, camera, date, everything) before upload, and checked again by the server.'));
}

function placePicker(s, rerender) {
  const box = h('fieldset', { class: 'group' }, h('legend', null, 'Where?'));
  const q = h('input', { class: 'input grow', type: 'search', placeholder: 'Search a café, park, street…', 'aria-label': 'Search for a place' });
  const results = h('div', { class: 'results', hidden: true });
  const choose = async (r) => {
    s.lat = r.lat;
    s.lon = r.lon;
    s.area = r.area || r.city;
    s.city = r.city;
    s.country = r.country;
    s.country_code = r.country_code;
    if (!s.title && r.name) s.title = r.name;
    rerender();
    fetchWeather(s, rerender, true);
  };
  const search = async () => {
    if (q.value.trim().length < 2) return;
    results.hidden = false;
    results.replaceChildren(h('button', { type: 'button', disabled: true }, 'Searching…'));
    try {
      const list = await api('geocode?q=' + enc(q.value));
      results.replaceChildren(...(list.length ? list.map((r) => h('button', { type: 'button', onclick: () => choose(r) }, r.name, h('small', null, r.display))) : [h('button', { type: 'button', disabled: true }, 'Nothing found. Try adding the city.')]));
    } catch (e) {
      results.replaceChildren(h('button', { type: 'button', disabled: true }, e.message));
    }
  };
  q.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), search()));
  const near = h('button', { type: 'button', class: 'btn' }, 'Near me');
  near.addEventListener('click', () => {
    if (!navigator.geolocation) return toast('This browser cannot share your location.', true);
    near.disabled = true;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await api(`reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          await choose(r);
        } catch (e) {
          toast(e.message, true);
        } finally {
          near.disabled = false;
        }
      },
      () => {
        near.disabled = false;
        toast('Location permission was declined.', true);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
  box.append(h('div', { class: 'row' }, q, h('button', { type: 'button', class: 'btn', onclick: search }, 'Search'), near), results);

  if (Number.isFinite(s.lat) && Number.isFinite(s.lon)) {
    const mapEl = h('div', { class: 'pick-map' });
    box.append(
      h('div', { class: 'picked' }, h('span', { html: ICON.pin }), h('span', { class: 'grow' }, h('strong', null, s.area || 'Picked spot'), h('small', { class: 'hint' }, ` ${s.country || ''} · drag the pin to adjust`))),
      mapEl
    );
    requestAnimationFrame(() => {
      if (!window.L) return;
      const map = L.map(mapEl).setView([s.lat, s.lon], 16);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      const m = L.marker([s.lat, s.lon], { draggable: true }).addTo(map);
      m.on('dragend', () => {
        const p = m.getLatLng();
        s.lat = Number(p.lat.toFixed(5));
        s.lon = Number(p.lng.toFixed(5));
      });
    });
  }

  const area = h('input', { class: 'input', value: s.area, placeholder: 'Digbeth, Birmingham' });
  area.addEventListener('input', () => (s.area = area.value));
  const city = h('input', { class: 'input', value: s.city, placeholder: 'Birmingham' });
  city.addEventListener('input', () => (s.city = city.value));
  const weather = h('input', { class: 'input grow', value: s.weather, placeholder: '12°C, light rain' });
  weather.addEventListener('input', () => (s.weather = weather.value));
  box.append(
    h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Area', area)), h('div', { class: 'grow' }, field('City (for the passport)', city))),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Weather'), h('div', { class: 'row' }, weather, h('button', { type: 'button', class: 'btn', onclick: () => fetchWeather(s, rerender, false) }, 'Look it up')))
  );
  return box;
}

async function fetchWeather(s, rerender, quiet) {
  if (!Number.isFinite(s.lat)) return quiet ? null : toast('Pick the place first.', true);
  try {
    const w = await api(`weather?lat=${s.lat}&lon=${s.lon}&date=${fromInputDate(s.date).slice(0, 10)}`);
    s.weather = w.text;
    rerender();
  } catch (e) {
    if (!quiet) toast(e.message, true);
  }
}

// ---------- guestbook ----------

// ---------- comments ----------
// Visitors' comments on posts wait here (comments-pending/…) until approved, which moves them
// onto the site (comments/…). Your reply is kept with the comment it answers.
const postOfComment = (c) => data.posts.find((p) => `${p.type}/${p.slug}` === c.post);
const approveComment = (c) => api(`move?key=${enc(c.key)}&to=${enc(c.key.replace(/^comments-pending\//, 'comments/'))}`, { method: 'POST' });
function commentText(c, reply) {
  return `---\nname: ${JSON.stringify(c.name)}\ndate: ${JSON.stringify(c.date)}\n${c.reply_to ? `reply_to: ${JSON.stringify(c.reply_to)}\n` : ''}${reply ? `reply: ${JSON.stringify(reply)}\n` : ''}---\n${c.message}\n`;
}
function viewComments() {
  const act = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      await refresh();
      draw();
    } catch (e) {
      toast(e.message, true);
    }
  };
  const on = data.site?.comments !== false;
  // What a comment is on, and what it answers.
  const context = (c) => {
    const post = postOfComment(c);
    const parent = c.reply_to ? (data.approvedComments || []).find((x) => x.post === c.post && x.id === c.reply_to) : null;
    return h(
      'div',
      { class: 'cm-context hint' },
      'On ',
      post ? h('b', null, post.title || (post.excerpt ? `“${post.excerpt.length > 50 ? post.excerpt.slice(0, 48) + '…' : post.excerpt}”` : 'a post')) : 'a post that’s gone',
      parent ? [', replying to ', h('b', null, parent.name), ': “', parent.message.length > 80 ? parent.message.slice(0, 78) + '…' : parent.message, '”'] : null
    );
  };
  const pending = (data.pendingComments || []).map((c) =>
    h(
      'div',
      { class: 'gb-pending cm-admin' },
      h('div', { class: 'row' }, h('strong', { class: 'grow' }, c.name), h('small', { class: 'hint' }, niceDate(c.date, true))),
      context(c),
      h('p', null, c.message),
      h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn small danger', onclick: () => act(() => delFile(c.key), 'Deleted.') }, 'Delete'), h('button', { type: 'button', class: 'btn small go', onclick: () => act(() => approveComment(c), 'Approved. It is on the site now.') }, 'Approve'))
    )
  );
  const approved = (data.approvedComments || []).map((c) => {
    const reply = h('textarea', { class: 'textarea cm-reply', rows: 2, placeholder: 'Write a reply (optional): it shows under their comment, from you', 'aria-label': `Reply to ${c.name}` });
    reply.value = c.reply || '';
    return h(
      'div',
      { class: 'gb-pending cm-admin' },
      h('div', { class: 'row' }, h('strong', { class: 'grow' }, c.name), h('small', { class: 'hint' }, niceDate(c.date, true))),
      context(c),
      h('p', null, c.message),
      reply,
      h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn small danger', onclick: () => act(() => delFile(c.key), 'Deleted.') }, 'Delete'), h('button', { type: 'button', class: 'btn small go', onclick: () => act(() => putFile(c.key, commentText(c, reply.value.trim())), reply.value.trim() ? 'Reply saved. It is on the site now.' : 'Reply removed.') }, 'Save reply'))
    );
  });
  const toggle = h('input', { type: 'checkbox', checked: on });
  toggle.addEventListener('change', () => act(() => setSiteField('comments', toggle.checked ? '' : 'off'), toggle.checked ? 'Comments are on.' : 'Comments are off: none show, and visitors can’t leave any.'));
  return h(
    'div',
    { class: 'field' },
    h('h2', { class: 'section-title' }, 'Comments'),
    h('p', { class: 'hint' }, 'Visitors can comment on any post, or reply to a comment, with just a name (any name: nothing else about them is asked for or kept). Each one waits here until you approve it. Your replies show under the comment they answer.'),
    h('label', { class: 'row check' }, toggle, h('span', null, h('b', null, 'Let visitors comment on posts'), h('small', { class: 'hint' }, ' (switch off to hide them all; nothing is deleted)'))),
    h('h3', null, `Waiting for you (${pending.length})`),
    pending.length ? pending : h('p', { class: 'hint' }, 'Nothing waiting.'),
    h('h3', null, `On the site (${approved.length})`),
    approved.length ? approved : h('p', { class: 'hint' }, 'No comments on the site yet.')
  );
}

function gbText(name, date, reply, message) {
  return `---\nname: ${JSON.stringify(name)}\ndate: ${JSON.stringify(date)}\n${reply ? `reply: ${JSON.stringify(reply)}\n` : ''}---\n${message}\n`;
}

function viewGuestbook() {
  const act = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      await refresh();
      draw();
    } catch (e) {
      toast(e.message, true);
    }
  };
  const pending = data.pendingGuestbook.map((g) =>
    h(
      'div',
      { class: 'gb-pending' },
      h('div', { class: 'row' }, h('strong', { class: 'grow' }, g.name), h('small', { class: 'hint' }, niceDate(g.date, true))),
      h('p', null, g.message),
      h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn small danger', onclick: () => act(() => delFile(g.key), 'Deleted.') }, 'Delete'), h('button', { type: 'button', class: 'btn small go', onclick: () => act(() => api(`move?key=${enc(g.key)}&to=${enc(g.key.replace('guestbook-pending/', 'guestbook/'))}`, { method: 'POST' }), 'Approved. It is on the site now.') }, 'Approve'))
    )
  );
  const approved = data.approvedGuestbook.map((g) => {
    const reply = h('input', { class: 'input grow', value: g.reply, placeholder: 'Write a reply (optional)', 'aria-label': `Reply to ${g.name}` });
    return h(
      'div',
      { class: 'gb-pending' },
      h('div', { class: 'row' }, h('strong', { class: 'grow' }, g.name), h('small', { class: 'hint' }, niceDate(g.date, true))),
      h('p', null, g.message),
      h('div', { class: 'row' }, reply, h('button', { type: 'button', class: 'btn small', onclick: () => act(() => putFile(g.key, gbText(g.name, g.date, reply.value.trim(), g.message)), 'Reply saved.') }, 'Save reply'), h('button', { type: 'button', class: 'btn small danger', onclick: () => confirm('Remove this signature?') && act(() => delFile(g.key), 'Removed.') }, 'Remove'))
    );
  });
  return h(
    'div',
    { class: 'field' },
    h('h2', { class: 'section-title' }, `Waiting for approval · ${pending.length}`),
    pending.length ? pending : h('p', { class: 'hint' }, 'Nothing waiting. New signatures land here first, so spam never reaches the site.'),
    h('h2', { class: 'section-title' }, `On the site · ${approved.length}`),
    approved.length ? approved : h('p', { class: 'hint' }, 'No signatures yet.')
  );
}

// ---------- suggestions ----------

const KIND_TYPE = { book: 'books', film: 'films', podcast: 'podcasts', music: 'music', tv: 'tv' };
const KIND_LABEL = { place: 'Place', book: 'Book', film: 'Film', podcast: 'Podcast', music: 'Music', tv: 'TV' };

async function addToWishlist(sg) {
  let text = (await readFile('wishlist.md')) ?? '# Want to go\n';
  const note = [`suggested by ${sg.from}`, sg.note].filter(Boolean).join(': ');
  text = text.replace(/\s*$/, '\n') + `- [ ] ${sg.title.replace(/\n/g, ' ')} — ${note.replace(/\n/g, ' ')}\n`;
  await putFile('wishlist.md', text);
  await delFile(sg.key);
}
// A suggested book, film or podcast goes on the shelf as "want to…", with the reader's name.
async function addToShelf(sg) {
  const type = KIND_TYPE[sg.kind];
  const day = nowLocal().slice(0, 10);
  const taken = new Set(data.files.map((f) => f.key));
  let key = `${type}/${day}-${slugify(sg.title)}.md`;
  for (let n = 2; taken.has(key); n++) key = `${type}/${day}-${slugify(sg.title)}-${n}.md`;
  const fm = { date: fromInputDate(nowLocal()), title: sg.title, status: 'want', suggested_by: sg.from && sg.from !== 'Visitor' ? sg.from : '' };
  await putFile(key, frontMatter(fm));
  await delFile(sg.key);
}

const SHELF_NAME = { books: 'bookshelf', films: 'cinema', podcasts: 'podcasts', music: 'record crate', tv: 'TV shelf' };

// ---------- notification centre ----------

// Guestbook and suggestion dates are written in UTC as "2026-10-23 10:44".
const utcTs = (d) => {
  const t = Date.parse(String(d || '').trim().replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(d) ? '' : 'Z'));
  return Number.isNaN(t) ? 0 : t;
};
const POSTED_WORD = { thoughts: 'a thought', places: 'a place', photos: 'some photos', lists: 'a list', quotes: 'a quote', books: 'a book', films: 'a film', podcasts: 'a podcast', music: 'some music', tv: 'a TV show' };
const A_WORD = { place: 'a place', book: 'a book', film: 'a film', podcast: 'a podcast', music: 'some music', tv: 'a TV show' };
const NOTE_ICON = {
  suggestion: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-1.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="#ffd23c" stroke="#b06a00" stroke-width="1.2"/><path d="M9.6 19.2h4.8M10.4 21.2h3.2" stroke="#6a5a3a" stroke-width="1.4" stroke-linecap="round"/></svg>',
  guestbook: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2z" fill="#8a4a2a" stroke="#4e2810" stroke-width="1"/><path d="M8 3v18" stroke="#4e2810" stroke-width="1"/><path d="M10.5 8h6M10.5 11h6M10.5 14h4" stroke="#f4dcb4" stroke-width="1.2" stroke-linecap="round"/><path d="M14.5 15.5l5.8-5.8 1.6 1.6-5.8 5.8-2.2.6z" fill="#3a86e8" stroke="#1d4fb8" stroke-width=".8"/></svg>',
  friendpost: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><defs><linearGradient id="nf-base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6c9cf0"/><stop offset="1" stop-color="#1d4fb8"/></linearGradient><linearGradient id="nf-card" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf5"/><stop offset="1" stop-color="#ece4c9"/></linearGradient></defs><path d="M2.6 17.2h18.8l-1.7 4.3H4.3z" fill="url(#nf-base)" stroke="#173f8f" stroke-width=".8" stroke-linejoin="round"/><path d="M5 18.4h14" stroke="#fff" stroke-opacity=".45" stroke-width=".7"/><rect x="5.4" y="4.2" width="13.2" height="12" rx="1.2" fill="#efe5c8" stroke="#8a7a52" stroke-width=".7" transform="rotate(-9 12 16)"/><rect x="5.4" y="4.2" width="13.2" height="12" rx="1.2" fill="#f5eed8" stroke="#8a7a52" stroke-width=".7" transform="rotate(7 12 16)"/><path d="M7.2 5.2V3.5h4.6v1.7" fill="#f6c84c" stroke="#a07a18" stroke-width=".6" stroke-linejoin="round"/><rect x="5" y="5" width="14" height="12" rx="1.2" fill="url(#nf-card)" stroke="#7a6a42" stroke-width=".8"/><circle cx="9.4" cy="10.2" r="2.5" fill="#ffd34d" stroke="#b8860b" stroke-width=".6"/><circle cx="8.65" cy="9.8" r=".38" fill="#5a4210"/><circle cx="10.15" cy="9.8" r=".38" fill="#5a4210"/><path d="M8.5 10.9q.9.8 1.8 0" fill="none" stroke="#5a4210" stroke-width=".5" stroke-linecap="round"/><path d="M13 9.2h4M13 11h3.2M7.2 14.3h9.6" stroke="#93a3c4" stroke-width=".8" stroke-linecap="round"/><path d="M8.4 17v1.2M15.6 17v1.2" stroke="#4a4a4a" stroke-width="1"/></svg>',
  nudge: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="6" y="5" width="12" height="14" rx="2" fill="#e8eef6" stroke="#1d4fb8" stroke-width="1.2"/><g fill="none" stroke="#1d4fb8" stroke-width="1.6" stroke-linecap="round"><path d="M3 8q-1.4 4 0 8M20.9 8q1.4 4 0 8M1 6q-2 6 0 12M23 6q2 6 0 12" opacity=".7"/></g><circle cx="10" cy="11" r="1.1" fill="#1d4fb8"/><circle cx="14" cy="11" r="1.1" fill="#1d4fb8"/><path d="M10 14.6q2 1.4 4 0" fill="none" stroke="#1d4fb8" stroke-width="1.2" stroke-linecap="round"/></svg>'
};

// Everything that has happened, newest first. Nudges close together are grouped.
function notifications() {
  const items = [];
  for (const sg of data.suggestions) items.push({ kind: 'suggestion', ts: utcTs(sg.date), sg });
  for (const g of data.pendingGuestbook) items.push({ kind: 'guestbook', ts: utcTs(g.date), g });
  for (const c of data.pendingComments || []) items.push({ kind: 'comment', ts: utcTs(c.date), c });
  const log = [...(data.nudges?.log || [])].sort((a, b) => a - b);
  for (const t of log) {
    const last = items.findLast?.((x) => x.kind === 'nudge') ?? [...items].reverse().find((x) => x.kind === 'nudge');
    if (last && t - last.ts < 15 * 60 * 1000) {
      last.count++;
      last.ts = t;
    } else items.push({ kind: 'nudge', ts: t, count: 1 });
  }
  // From friends' sites: their new posts.
  for (const fp of data.friendNotes?.posts || []) items.push({ kind: 'friendpost', ts: fp.ts, fp });
  return items.sort((a, b) => b.ts - a.ts);
}
const unreadCount = () => notifications().filter((n) => n.ts > (data.notifySeen || 0)).length;

async function markSeen() {
  const seen = Date.now();
  await putFile('data/notify.json', JSON.stringify({ seen }));
  data.notifySeen = seen;
}

let noteFilter = 'all';
function viewNotifications() {
  const seenBefore = data.notifySeen || 0;
  const all = notifications();
  const act = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      await refresh();
      drawTabs();
      draw();
    } catch (e) {
      toast(e.message, true);
    }
  };
  const ago = (ts) => {
    if (!ts) return '';
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
    return new Date(ts).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const card = (n) => {
    const fresh = n.ts > seenBefore;
    let title;
    let body = null;
    let actions = [];
    if (n.kind === 'suggestion') {
      const sg = n.sg;
      const shelf = KIND_TYPE[sg.kind];
      title = h('span', null, h('b', null, sg.from || 'Someone'), ` suggested ${A_WORD[sg.kind] || 'something'}: `, h('b', null, sg.title));
      body = sg.note ? h('p', null, sg.note) : null;
      actions = [
        h('button', { type: 'button', class: 'btn small danger', onclick: () => act(() => delFile(sg.key), 'Deleted.') }, 'Delete'),
        shelf
          ? h('button', { type: 'button', class: 'btn small go', onclick: () => act(() => addToShelf(sg), `Added to your ${SHELF_NAME[shelf]}.`) }, 'Add to shelf')
          : h('button', { type: 'button', class: 'btn small go', onclick: () => act(() => addToWishlist(sg), 'Added to your wishlist.') }, 'Add to wishlist')
      ];
    } else if (n.kind === 'guestbook') {
      const g = n.g;
      title = h('span', null, h('b', null, g.name || 'Someone'), ' signed the guestbook');
      body = h('p', null, g.message);
      actions = [
        h('button', { type: 'button', class: 'btn small danger', onclick: () => act(() => delFile(g.key), 'Deleted.') }, 'Delete'),
        h('button', { type: 'button', class: 'btn small go', onclick: () => act(() => api(`move?key=${enc(g.key)}&to=${enc(g.key.replace('guestbook-pending/', 'guestbook/'))}`, { method: 'POST' }), 'Approved. It is on the site now.') }, 'Approve')
      ];
    } else if (n.kind === 'comment') {
      const c = n.c;
      const post = postOfComment(c);
      title = h('span', null, h('b', null, c.name || 'Someone'), c.reply_to ? ' replied to a comment on ' : ' commented on ', h('b', null, post?.title || (post?.excerpt ? `“${post.excerpt.slice(0, 40)}${post.excerpt.length > 40 ? '…' : ''}”` : 'a post')));
      body = h('p', null, c.message);
      actions = [
        h('button', { type: 'button', class: 'btn small danger', onclick: () => act(() => delFile(c.key), 'Deleted.') }, 'Delete'),
        h('button', { type: 'button', class: 'btn small go', onclick: () => act(() => approveComment(c), 'Approved. It is on the site now.') }, 'Approve')
      ];
    } else if (n.kind === 'friendpost') {
      const fp = n.fp;
      title = h('span', null, h('b', null, fp.name), ` posted ${POSTED_WORD[fp.type] || 'something'}`, fp.title ? [': ', h('b', null, fp.title)] : '');
      body = fp.excerpt ? h('p', null, fp.excerpt.length > 200 ? fp.excerpt.slice(0, 198) + '…' : fp.excerpt) : null;
      actions = [h('button', { type: 'button', class: 'btn small', onclick: () => go('friends', fp.friend) }, 'See it')];
    } else {
      title = h('span', null, n.count > 1 ? h('span', null, 'You were nudged ', h('b', null, `${n.count} times`)) : 'Someone nudged you');
    }
    return h(
      'article',
      { class: `note note-${n.kind}${fresh ? ' unread' : ''}` },
      h('span', { class: 'note-ico', html: NOTE_ICON[n.kind] }),
      h(
        'div',
        { class: 'note-main' },
        h('div', { class: 'note-top' }, h('span', { class: 'note-title' }, title), fresh ? h('span', { class: 'note-new' }, 'New') : null),
        h('small', { class: 'note-when' }, n.kind === 'suggestion' ? `${KIND_LABEL[n.sg.kind] || 'Place'} · ${ago(n.ts)}` : ago(n.ts)),
        body,
        actions.length ? h('div', { class: 'row end' }, ...actions) : null
      )
    );
  };
  const KINDS = [['all', 'All'], ['suggestion', 'Suggestions'], ['guestbook', 'Guestbook'], ['nudge', 'Nudges'], ...(data.friendNotes?.count ? [['friend', 'Friends']] : [])];
  const kindOf = (n) => (n.kind === 'friendpost' ? 'friend' : n.kind);
  const shown = all.filter((n) => noteFilter === 'all' || kindOf(n) === noteFilter);
  const unread = all.filter((n) => n.ts > seenBefore).length;
  // Opening the centre marks everything as read (the "New" labels stay until you leave).
  if (unread) markSeen().then(drawTabs).catch(() => {});
  return h(
    'div',
    { class: 'field notes' },
    h(
      'div',
      { class: 'notes-head' },
      h('div', null, h('h2', { class: 'section-title' }, 'Notifications'), h('p', { class: 'hint' }, unread ? `${unread} new since you last looked.` : 'You are all caught up.')),
      h('div', { class: 'notes-stats' }, ...[[data.suggestions.length, 'suggestion', 'to sort'], [data.pendingGuestbook.length, 'signature', 'to approve'], [data.nudges?.count || 0, 'nudge', 'in total']].map(([n, word, tail]) => h('span', null, h('b', null, String(n)), ` ${word}${n === 1 ? '' : 's'} ${tail}`)))
    ),
    h('div', { class: 'chip-row' }, KINDS.map(([k, label]) => h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(noteFilter === k), onclick: () => { noteFilter = k; draw(); } }, label, k !== 'all' ? ` (${all.filter((n) => kindOf(n) === k).length})` : ''))),
    shown.length ? shown.map(card) : h('p', { class: 'hint empty-notes' }, noteFilter === 'all' ? 'Nothing here yet. Suggestions, guestbook signatures, nudges and friends’ new posts will show up here.' : 'Nothing of this kind yet.')
  );
}

function viewSuggestions() {
  const act = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      await refresh();
      draw();
    } catch (e) {
      toast(e.message, true);
    }
  };
  return h(
    'div',
    { class: 'field' },
    h('p', { class: 'hint' }, 'Places, books, films, TV shows, podcasts and music visitors suggested. Add one and their name goes on a "Suggested by" stamp when you review it.'),
    data.suggestions.length
      ? data.suggestions.map((sg) => {
          const shelf = KIND_TYPE[sg.kind];
          return h(
            'div',
            { class: 'gb-pending' },
            h('div', { class: 'row' }, h('span', { class: 'kind-badge kind-' + sg.kind }, KIND_LABEL[sg.kind] || 'Place'), h('strong', { class: 'grow' }, sg.title), h('small', { class: 'hint' }, `from ${sg.from} · ${niceDate(sg.date)}`)),
            sg.note ? h('p', null, sg.note) : null,
            h(
              'div',
              { class: 'row end' },
              h('button', { type: 'button', class: 'btn small danger', onclick: () => act(() => delFile(sg.key), 'Deleted.') }, 'Delete'),
              shelf
                ? h('button', { type: 'button', class: 'btn small go', onclick: () => act(() => addToShelf(sg), `Added to your ${SHELF_NAME[shelf]}.`) }, 'Add to shelf')
                : h('button', { type: 'button', class: 'btn small go', onclick: () => act(() => addToWishlist(sg), 'Added to your wishlist.') }, 'Add to wishlist')
            )
          );
        })
      : h('p', { class: 'hint' }, 'No suggestions yet.')
  );
}

// ---------- site settings ----------

// One value from the raw header, as written (so "reading [book]" stays a token).
function rawField(head, key) {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(head || '');
  if (!m) return '';
  const v = m[1].trim();
  if (/^".*"$/.test(v)) {
    try {
      return JSON.parse(v);
    } catch {}
  }
  return v.replace(/^'(.*)'$/, '$1');
}

const PRESENCES = [['online', 'Online', 'green'], ['away', 'Away', 'amber'], ['brb', 'Be right back', 'amber'], ['lunch', 'Out to lunch', 'amber'], ['busy', 'Busy', 'red'], ['offline', 'Appear offline', 'grey']];

// Status (presence, message, countdown, past statuses) and Site & wishlist share one form, so
// saving either keeps everything in site.md; each tab shows its own part.
function viewSite(part = 'site') {
  const wrap = h('div', { class: 'field' }, h('p', { class: 'loading' }, 'Loading…'));
  (async () => {
    let siteRaw, wishRaw, logRaw;
    try {
      [siteRaw, wishRaw, logRaw] = await Promise.all(['site.md', 'wishlist.md', 'status-log.md'].map(readFile));
    } catch (e) {
      // Showing the form with blanks would let a save wipe your real settings.
      wrap.replaceChildren(loadProblem(e, 'your site settings'));
      return;
    }
    siteRaw ??= '';
    wishRaw ??= '';
    logRaw ??= '';
    const head = splitFM(siteRaw).head;
    const raw = (k) => rawField(head, k);
    const site = data.site;
    const st = {
      presence: raw('presence') || 'online',
      status: raw('status'),
      status_updated: raw('status_updated'),
      now_playing: !/^(false|no|off)$/i.test(raw('now_playing')),
      countdown: raw('countdown'),
      countdown_date: raw('countdown_date'),
      countdown_icon: raw('countdown_icon') || 'plane'
    };
    const inputs = {
      name: h('input', { class: 'input', value: raw('name') || site.name }),
      owner: h('input', { class: 'input', value: raw('owner') || site.owner }),
      tagline: h('input', { class: 'input', value: raw('tagline') || site.tagline })
    };
    const about = h('textarea', { class: 'textarea' });
    about.value = splitFM(siteRaw).body.trim();

    // ----- status -----
    const statusIn = h('input', { class: 'input', value: st.status, maxlength: 140, placeholder: 'What are you up to? (book) and :) work here' });
    const preview = h('div', { class: 'status-preview' });
    const drawPreview = () => preview.replaceChildren(h('small', null, 'Preview: '), ...withEmoticons(statusIn.value || '…', 16));
    statusIn.addEventListener('input', drawPreview);
    drawPreview();
    const insert = (code) => {
      const a = statusIn.selectionStart ?? statusIn.value.length;
      const b = statusIn.selectionEnd ?? a;
      const before = statusIn.value.slice(0, a);
      const pad = before && !/\s$/.test(before) ? ' ' : '';
      statusIn.value = before + pad + code + ' ' + statusIn.value.slice(b).replace(/^\s+/, '');
      const at = (before + pad + code + ' ').length;
      statusIn.focus();
      statusIn.setSelectionRange(at, at);
      drawPreview();
    };
    const picker = h(
      'div',
      { class: 'emo-picker', role: 'group', 'aria-label': 'Emoticons' },
      EMOTICONS.map(([id, label, codes]) => h('button', { type: 'button', class: 'emo-btn', title: `${label}  ${codes[0]}`, 'aria-label': label, html: emoticonSvg(id, 22), onclick: () => insert(codes[0]) }))
    );
    const presenceRow = h('div', { class: 'chip-row' });
    const drawPresence = () =>
      presenceRow.replaceChildren(
        ...PRESENCES.map(([v, label, colour]) => h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(st.presence === v), onclick: () => { st.presence = v; drawPresence(); } }, h('span', { class: `pres-dot ${colour}` }), label))
      );
    drawPresence();
    const nowBox = h('input', { type: 'checkbox', checked: st.now_playing });
    const cdLabel = h('input', { class: 'input', value: st.countdown, maxlength: 60, placeholder: 'e.g. Lisbon, exams, my birthday' });
    const cdDate = h('input', { class: 'input', type: 'date', value: /^\d{4}-\d{2}-\d{2}$/.test(st.countdown_date) ? st.countdown_date : '' });
    const cdIcon = h('select', { class: 'input' }, h('option', { value: '' }, 'No picture'), EMOTICONS.map(([id, label]) => h('option', { value: id, selected: st.countdown_icon === id }, label)));
    const cdClear = h('button', { type: 'button', class: 'btn small', onclick: () => { cdLabel.value = ''; cdDate.value = ''; } }, 'Clear countdown');
    const nudges = data.nudges || { count: 0 };
    const logBox = h('textarea', { class: 'textarea mono short', spellcheck: 'false', placeholder: '- 2026-10-23 11:39 · Why is there a storm (storm)' });
    logBox.value = logRaw.trim();

    const save = async (btn) => {
      btn.disabled = true;
      try {
        const newStatus = statusIn.value.trim();
        const changed = newStatus !== (st.status || '').trim();
        const fm = {
          name: inputs.name.value.trim(),
          owner: inputs.owner.value.trim(),
          status: newStatus,
          presence: st.presence === 'online' ? '' : st.presence,
          status_updated: changed ? new Date().toISOString() : st.status_updated,
          now_playing: nowBox.checked ? '' : 'off',
          countdown: cdLabel.value.trim() && cdDate.value ? cdLabel.value.trim() : '',
          countdown_date: cdLabel.value.trim() && cdDate.value ? cdDate.value : '',
          countdown_icon: cdLabel.value.trim() && cdDate.value ? cdIcon.value : '',
          tagline: inputs.tagline.value.trim(),
          // (Kept as it is: switched in the Comments tab.)
          comments: data.site?.comments === false ? 'off' : '',
          top_room: data.site?.top_room || ''
        };
        await putFile('site.md', frontMatter(fm) + about.value.trim() + '\n');
        // A new status goes to the top of the log (with any [book] filled in as it is today).
        let log = logBox.value.trim();
        if (changed && newStatus) {
          await refresh();
          const shown = (data.site.status || newStatus).replace(/\s+/g, ' ');
          log = `- ${stampNow()} · ${shown}` + (log ? '\n' + log : '');
          logBox.value = log;
        }
        if (log !== logRaw.trim()) {
          await putFile('status-log.md', log + '\n');
          logRaw = log;
        }
        st.status = newStatus;
        st.status_updated = fm.status_updated;
        toast(changed ? 'Status updated.' : 'Saved.');
        await refresh();
      } catch (e) {
        toast(e.message, true);
      }
      btn.disabled = false;
    };
    const saveStatus = h('button', { type: 'button', class: 'btn go' }, 'Update status');
    saveStatus.addEventListener('click', () => save(saveStatus));
    const saveSite = h('button', { type: 'button', class: 'btn go' }, 'Save site settings');
    saveSite.addEventListener('click', () => save(saveSite));

    const wish = h('textarea', { class: 'textarea mono', spellcheck: 'false' });
    wish.value = wishRaw || '# Want to go\n- [ ] Place name, City (food) — who recommended it\n';
    const saveWish = h('button', { type: 'button', class: 'btn go' }, 'Save wishlist');
    saveWish.addEventListener('click', async () => {
      try {
        await putFile('wishlist.md', wish.value);
        toast('Wishlist saved.');
        await refresh();
      } catch (e) {
        toast(e.message, true);
      }
    });

    const parts = [
      h(
        'fieldset',
        { class: 'group' },
        h('legend', null, 'Status'),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Show me as'), presenceRow),
        field('Personal message', statusIn, 'Shown as "Currently: …". [book], [film], [tv], [music] or [podcast] fill in what you have marked as "now" on that shelf.'),
        picker,
        preview,
        h('label', { class: 'row check' }, nowBox, h('span', null, 'Also show what I’m listening to, watching and reading (from the shelves)')),
        h(
          'div',
          { class: 'field' },
          h('span', { class: 'label' }, 'Countdown (optional)'),
          h('div', { class: 'grid-2' }, cdLabel, cdDate),
          h('div', { class: 'row' }, cdIcon, cdClear),
          h('span', { class: 'hint' }, 'Shows "12 days until …" under your status, and disappears once the day has passed.')
        ),
        h('p', { class: 'nudge-count' }, nudges.count ? `You've been nudged ${nudges.count} time${nudges.count === 1 ? '' : 's'}${nudges.last ? ` · last on ${new Date(nudges.last).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}.` : 'Nobody has nudged you yet.'),
        h('div', { class: 'row end' }, saveStatus)
      ),
      h(
        'fieldset',
        { class: 'group' },
        h('legend', null, 'Past statuses'),
        h('p', { class: 'hint' }, 'Visitors can tap your status to see these. Each new status is added at the top; delete a line to remove it.'),
        logBox,
        h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn go', onclick: async (e) => { try { await putFile('status-log.md', logBox.value.trim() + '\n'); logRaw = logBox.value.trim(); toast('Past statuses saved.'); await refresh(); } catch (err) { toast(err.message, true); } } }, 'Save past statuses'))
      ),
      h('fieldset', { class: 'group' }, h('legend', null, 'About the site'), field('Site name', inputs.name, 'Shown on the welcome screen, every title bar, the tab and the home-screen app.'), field('Your name', inputs.owner), field('Tagline', inputs.tagline, 'Shown on the welcome screen.'), field('About you', about, 'Markdown works here too.'), h('div', { class: 'row end' }, saveSite)),
      categoryManager(),
      topRoomControls(),
      h('fieldset', { class: 'group' }, h('legend', null, 'Wishlist'), h('p', { class: 'hint' }, 'One place per line: "- [ ] Name, City (food) — note". Change [ ] to [x] once you have been.'), wish, h('div', { class: 'row end' }, saveWish))
    ];
    // The first two are the status and past statuses; the rest are the site and wishlist.
    wrap.replaceChildren(...(part === 'status' ? parts.slice(0, 2) : parts.slice(2)));
  })();
  return wrap;
}

// ---------- travel stats (travel.md) ----------

const TRAVEL_FIELDS = [
  ['flights', 'Flights'],
  ['distance_km', 'Distance (km)'],
  ['hours', 'Hours in the air'],
  ['airports', 'Airports'],
  ['countries', 'Countries']
];

function travelFromData(raw) {
  const s = data.stats || {};
  return {
    exists: raw != null,
    ...Object.fromEntries(TRAVEL_FIELDS.map(([k]) => [k, s[k] != null ? String(s[k]) : ''])),
    years: Object.entries(s.per_year || {}).sort(([a], [b]) => b.localeCompare(a)).map(([y, n]) => ({ year: y, count: String(n) })),
    airlines: (s.top_airlines || []).join('\n'),
    aircraft: (s.top_aircraft || []).join('\n'),
    note: raw != null ? splitFM(raw).body.trim() : '',
    hidden: !!s.hidden,
    visited: (data.visited || []).map((v) => ({ code: v.code, city: v.city || COUNTRIES[v.code]?.capital || '', month: v.date ? v.date.slice(0, 7) : '' })),
    raw: null
  };
}

function travelText(t) {
  const lines = [];
  for (const [k] of TRAVEL_FIELDS) {
    const n = Number(String(t[k]).replace(/[,\s]/g, ''));
    if (String(t[k]).trim() !== '' && Number.isFinite(n)) lines.push(`${k}: ${n}`);
  }
  const years = t.years.filter((r) => /^\d{4}$/.test(r.year.trim()) && r.count.trim() !== '' && Number.isFinite(Number(r.count)));
  if (years.length) {
    lines.push('per_year:');
    years.sort((a, b) => a.year.localeCompare(b.year)).forEach((r) => lines.push(`  ${r.year.trim()}: ${Number(r.count)}`));
  }
  const list = (v) => v.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 10);
  if (list(t.airlines).length) lines.push(`top_airlines: ${yamlValue(list(t.airlines))}`);
  if (list(t.aircraft).length) lines.push(`top_aircraft: ${yamlValue(list(t.aircraft))}`);
  const visited = t.visited.filter((v) => /^[A-Z]{2}$/.test(v.code));
  if (visited.length) {
    lines.push('visited:');
    for (const v of visited) {
      lines.push(`  - country: ${v.code === 'NO' ? '"NO"' : v.code}`);
      if (v.city.trim()) lines.push(`    city: ${yamlValue(v.city.trim())}`);
      if (/^\d{4}-\d{2}$/.test(v.month)) lines.push(`    date: ${v.month}`);
    }
  }
  if (t.hidden) lines.push('hidden: true');
  return `---\n${lines.join('\n')}\n---\n${t.note.trim() ? t.note.trim() + '\n' : ''}`;
}

// Countries you've been to: each gets a stamp in the passport, at its capital unless you
// name another city.
function visitedBox(t) {
  const all = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));
  const rows = h('div', { class: 'visited-rows' });
  const draw = () => {
    rows.replaceChildren(
      ...t.visited.map((v, i) => {
        const sel = h('select', { class: 'select', 'aria-label': 'Country' }, all.map((c) => h('option', { value: c.code, selected: c.code === v.code }, c.name)));
        const city = h('input', { class: 'input', value: v.city, placeholder: COUNTRIES[v.code]?.capital || 'City', 'aria-label': 'City on the stamp', maxlength: 60 });
        const month = h('input', { class: 'input', type: 'month', value: v.month, 'aria-label': 'When (optional)' });
        sel.addEventListener('change', () => {
          const old = COUNTRIES[v.code]?.capital;
          v.code = sel.value;
          // Swap the city too, unless you'd typed your own.
          if (!v.city || v.city === old) v.city = COUNTRIES[v.code]?.capital || '';
          draw();
        });
        city.addEventListener('input', () => (v.city = city.value));
        month.addEventListener('input', () => (v.month = month.value));
        return h('div', { class: 'visited-row' }, h('span', { class: 'visited-stamp', html: stampSvg({ city: v.city || COUNTRIES[v.code]?.capital || v.code, country: COUNTRIES[v.code]?.name, code: v.code, date: v.month ? v.month + '-01' : '', index: 9800 + i, plain: true, first: true }) }), sel, city, month, h('button', { type: 'button', class: 'btn small', 'aria-label': 'Remove this country', onclick: () => { t.visited.splice(i, 1); draw(); } }, '✕'));
      }),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn small', onclick: () => { t.visited.push({ code: 'FR', city: COUNTRIES.FR.capital, month: '' }); draw(); } }, '+ Add a country'),
        t.visited.length ? h('span', { class: 'hint' }, `${t.visited.length} ${t.visited.length === 1 ? 'country' : 'countries'}`) : null,
        t.visited.length ? h('button', { type: 'button', class: 'btn small', onclick: () => { t.countries = String(new Set(t.visited.map((v) => v.code)).size); rerenderTravel(); } }, 'Use as the countries total') : null
      )
    );
  };
  draw();
  return h('fieldset', { class: 'group' }, h('legend', null, 'Countries you’ve been to'), h('p', { class: 'hint' }, 'Each one gets a stamp in your passport, at the capital unless you change the city. The date is optional. Cities you review get their own stamps too.'), rows);
}
let rerenderTravel = () => {};

function viewTravel() {
  const wrap = h('div', { class: 'field' }, h('p', { class: 'loading' }, 'Loading…'));
  const rerender = () => panel.replaceChildren(viewTravel());
  rerenderTravel = rerender;
  const done = async (msg) => {
    toast(msg);
    travel = null;
    await refresh();
    draw();
  };
  const saveText = async (text, btn) => {
    btn.disabled = true;
    try {
      await putFile('travel.md', text);
      await done('Travel stats saved.');
    } catch (e) {
      toast(e.message, true);
      btn.disabled = false;
    }
  };

  (async () => {
    if (!travel) {
      let raw;
      try {
        raw = await readFile('travel.md');
      } catch (e) {
        wrap.replaceChildren(loadProblem(e, 'your travel stats'));
        return;
      }
      travel = travelFromData(raw);
    }
    const t = travel;

    if (t.raw != null) {
      const ta = h('textarea', { class: 'textarea mono', spellcheck: 'false' });
      ta.value = t.raw;
      ta.addEventListener('input', () => (t.raw = ta.value));
      const saveBtn = h('button', { type: 'button', class: 'btn go' }, 'Save file');
      saveBtn.addEventListener('click', () => saveText(t.raw, saveBtn));
      wrap.replaceChildren(
        h('div', { class: 'info' }, 'You are editing travel.md itself. The totals go between the --- lines; anything underneath shows as a note on the stats page.'),
        field('travel.md', ta),
        h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: () => { travel = null; rerender(); } }, 'Back to the form'), saveBtn)
      );
      return;
    }

    const num = (k, label) => {
      const el = h('input', { class: 'input', type: 'text', inputmode: 'decimal', value: t[k], placeholder: '—' });
      el.addEventListener('input', () => (t[k] = el.value));
      return field(label, el);
    };

    const yearRows = h('div', { class: 'year-rows' });
    const drawYears = () => {
      yearRows.replaceChildren(
        ...t.years.map((r, i) => {
          const y = h('input', { class: 'input', inputmode: 'numeric', maxlength: 4, value: r.year, placeholder: 'Year', 'aria-label': 'Year' });
          const c = h('input', { class: 'input', inputmode: 'numeric', value: r.count, placeholder: 'Flights', 'aria-label': `Flights in ${r.year || 'that year'}` });
          y.addEventListener('input', () => (r.year = y.value));
          c.addEventListener('input', () => (r.count = c.value));
          return h('div', { class: 'year-row' }, y, c, h('button', { type: 'button', class: 'btn small', 'aria-label': 'Remove this year', onclick: () => { t.years.splice(i, 1); drawYears(); } }, '✕'));
        }),
        h('button', { type: 'button', class: 'btn small', onclick: () => { const top = Math.max(0, ...t.years.map((r) => Number(r.year) || 0)); t.years.unshift({ year: String(top ? top + 1 : new Date().getFullYear()), count: '' }); drawYears(); } }, '+ Add a year')
      );
    };
    drawYears();

    const listArea = (k, placeholder) => {
      const el = h('textarea', { class: 'textarea short', placeholder });
      el.value = t[k];
      el.addEventListener('input', () => (t[k] = el.value));
      return el;
    };
    const note = h('textarea', { class: 'textarea short', placeholder: 'Optional. Shown under the boarding pass.' });
    note.value = t.note;
    note.addEventListener('input', () => (t.note = note.value));
    const hidden = h('input', { type: 'checkbox', checked: t.hidden });
    hidden.addEventListener('change', () => (t.hidden = hidden.checked));

    const saveBtn = h('button', { type: 'button', class: 'btn go' }, 'Save travel stats');
    saveBtn.addEventListener('click', () => {
      const any = TRAVEL_FIELDS.some(([k]) => String(t[k]).trim()) || t.years.some((r) => r.count.trim()) || t.airlines.trim() || t.aircraft.trim() || t.visited.length;
      if (!any) return toast('Fill in at least one number first.', true);
      saveText(travelText(t), saveBtn);
    });
    const rawBtn = h('button', { type: 'button', class: 'btn', onclick: () => { t.raw = travelText(t); rerender(); } }, 'Edit as Markdown');
    const removeBtn = t.exists
      ? h('button', { type: 'button', class: 'btn danger', onclick: async () => {
          if (!confirm('Delete travel.md and remove the travel stats from the site?')) return;
          try {
            await delFile('travel.md');
            await done('Travel stats removed.');
          } catch (e) {
            toast(e.message, true);
          }
        } }, 'Remove')
      : null;

    wrap.replaceChildren(
      h('div', { class: 'info' }, 'Totals only. Never add flight numbers, booking codes, seats or exact dates. Everything is saved as travel.md, and leaving a box empty simply hides it.'),
      h('fieldset', { class: 'group' }, h('legend', null, 'All-time totals'), h('div', { class: 'grid-2' }, ...TRAVEL_FIELDS.map(([k, l]) => num(k, l)))),
      h('fieldset', { class: 'group' }, h('legend', null, 'Flights per year'), yearRows),
      h('fieldset', { class: 'group' }, h('legend', null, 'Most flown'), field('Airlines', listArea('airlines', 'One per line, most flown first'), 'Up to 10.'), field('Aircraft', listArea('aircraft', 'One per line, e.g. Airbus A320'), 'Up to 10.')),
      h('fieldset', { class: 'group' }, h('legend', null, 'Note'), field('Shown on the stats page', note, 'Markdown works here.')),
      visitedBox(t),
      h('label', { class: 'row' }, hidden, 'Hide the travel stats from visitors for now'),
      h('div', { class: 'row end' }, removeBtn, rawBtn, saveBtn)
    );
  })();
  return wrap;
}

// ---------- example posts ----------

async function loadExamples(btn) {
  btn.disabled = true;
  try {
    const res = await fetch('/admin/examples.json', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Could not load the example posts.');
    const { files } = await res.json();
    const existing = new Set(data.files.map((f) => f.key));
    let n = 0;
    for (const f of files) {
      if (existing.has(f.key)) continue;
      if (f.text != null) {
        await putFile(f.key, f.text);
      } else {
        const bytes = Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0));
        await api('upload?key=' + enc(f.key), { method: 'PUT', body: new Blob([bytes], { type: 'image/jpeg' }), headers: { 'Content-Type': 'image/jpeg' } });
      }
      n++;
    }
    toast(`Added ${n} example files. Delete them from Posts whenever you like.`);
    await refresh();
    draw();
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
  }
}

// ---------- Goodreads and Letterboxd ----------

function importBox(kind) {
  const isGr = kind === 'goodreads';
  const type = isGr ? 'books' : 'films';
  const word = isGr ? 'books' : 'films';
  const fin = h('input', { type: 'file', accept: isGr ? '.csv,text/csv' : '.zip,.csv,application/zip,text/csv', multiple: !isGr });
  const out = h('div', { class: 'import-out' });
  fin.addEventListener('change', async () => {
    out.replaceChildren(h('p', { class: 'hint' }, 'Reading…'));
    try {
      let items;
      if (isGr) {
        items = fromGoodreads(parseCSV(await fin.files[0].text()));
      } else {
        const files = {};
        for (const f of fin.files) {
          if (/\.zip$/i.test(f.name)) {
            const { unzipSync, strFromU8 } = await import('/vendor/fflate/fflate.js');
            // Only the film lists are read; profile and account files in the zip are ignored.
            const wanted = ['watched.csv', 'diary.csv', 'reviews.csv', 'ratings.csv', 'watchlist.csv'];
            const unz = unzipSync(new Uint8Array(await f.arrayBuffer()), { filter: (e) => wanted.includes(e.name.toLowerCase().split('/').pop()) && !e.name.includes('deleted/') && !e.name.includes('orphaned/') });
            for (const [name, bytes] of Object.entries(unz)) files[name] = strFromU8(bytes);
          } else files[f.name] = await f.text();
        }
        items = fromLetterboxd(files);
      }
      items = items.filter((i) => i.title && i.fm.date);
      const have = new Set(data.posts.filter((p) => p.type === type).map((p) => p.title.trim().toLowerCase()));
      const fresh = items.filter((i) => !have.has(i.title.trim().toLowerCase()));
      const by = (st) => fresh.filter((i) => i.fm.status === st).length;
      const parts = isGr
        ? [[by('read'), 'read'], [by('reading'), 'reading now'], [by('want'), 'want to read'], [by('dropped'), 'put down']]
        : [[by('watched'), 'watched'], [by('want'), 'on your watchlist']];
      const reviewsN = fresh.filter((i) => i.body).length;
      const go = h('button', { type: 'button', class: 'btn go' }, `Import ${fresh.length} ${word}`);
      go.disabled = !fresh.length;
      go.addEventListener('click', async () => {
        go.disabled = true;
        try {
          const taken = new Set(data.files.map((f) => f.key));
          const files = fresh.map((i) => {
            const base = `${type}/${i.fm.date.slice(0, 10)}-${slugify(i.title)}`;
            let key = base + '.md';
            for (let n = 2; taken.has(key); n++) key = `${base}-${n}.md`;
            taken.add(key);
            return { key, text: frontMatter(i.fm) + (i.body ? i.body + '\n' : '') };
          });
          for (let k = 0; k < files.length; k += 100) {
            go.textContent = `Importing ${Math.min(k + 100, files.length)} of ${files.length}…`;
            await api('batch', { method: 'POST', body: JSON.stringify({ files: files.slice(k, k + 100) }), headers: { 'Content-Type': 'application/json' } });
          }
          toast(`Imported ${files.length} ${word}.`);
          await refresh();
          draw();
        } catch (e) {
          toast(e.message, true);
          go.disabled = false;
        }
      });
      out.replaceChildren(...[
        h('p', null, `Found ${fresh.length} new ${word}: ` + parts.filter(([n]) => n).map(([n, l]) => `${n} ${l}`).join(', ') + `. ${reviewsN} with a written review.`),
        items.length > fresh.length ? h('p', { class: 'hint' }, `${items.length - fresh.length} already on your shelf will be skipped.`) : null,
        h('p', { class: 'hint' }, 'Reviews with words appear in your home feed; the rest only sit on the shelf.'),
        h('div', { class: 'row' }, go)
      ].filter(Boolean));
    } catch (e) {
      out.replaceChildren(h('p', { class: 'hint' }, e.message));
    }
  });
  return h(
    'fieldset',
    { class: 'group' },
    h('legend', null, isGr ? 'Import from Goodreads' : 'Import from Letterboxd'),
    h('p', { class: 'hint' }, isGr
      ? 'On Goodreads: My Books › Import and export › Export library. Choose the .csv file it gives you. Only titles, authors, years, dates, ratings, shelves and your reviews are used; private notes are left out.'
      : 'On Letterboxd: Settings › Data › Export your data. Choose the .zip (or the .csv files inside it). Only your watched films, ratings, diary, reviews and watchlist are used; your profile and account details are never read.'),
    fin,
    out
  );
}

// ---------- export, import, files ----------

function viewFiles() {
  const total = data.files.reduce((n, f) => n + f.size, 0);
  const typeSel = h('select', { class: 'select', 'aria-label': 'Type of the imported posts' }, TYPES.map(([t, l]) => h('option', { value: t }, l)));
  const fin = h('input', { type: 'file', accept: '.md,text/markdown,text/plain', multiple: true });
  const importBtn = h('button', { type: 'button', class: 'btn go' }, 'Import');
  const importOut = h('div', { class: 'import-out' });
  importBtn.addEventListener('click', async () => {
    if (!fin.files.length) return toast('Choose one or more .md files first.', true);
    importBtn.disabled = true;
    let ok = 0;
    const skipped = [];
    try {
      const taken = new Set(data.files.map((f) => f.key));
      for (const f of fin.files) {
        let text = await f.text();
        let name = slugify(f.name.replace(/\.(md|markdown|txt)$/i, ''));
        if (!/^\d{4}-\d{2}-\d{2}/.test(name)) name = nowLocal().slice(0, 10) + '-' + name;
        if (!/^﻿?---\r?\n/.test(text)) text = frontMatter({ date: fromInputDate(nowLocal()) }) + text;
        let key = `${typeSel.value}/${name}.md`;
        for (let n = 2; taken.has(key); n++) key = `${typeSel.value}/${name}-${n}.md`;
        try {
          await putFile(key, text);
        } catch (e) {
          // A file the site couldn't read is skipped (and listed); the rest still go in.
          if (e.status === 422 || e.status === 413 || e.status === 400) {
            skipped.push(`${f.name}: ${e.problem || e.message}`);
            continue;
          }
          throw e;
        }
        taken.add(key);
        ok++;
      }
      toast(`Imported ${ok} file${ok === 1 ? '' : 's'}.${skipped.length ? ` ${skipped.length} skipped, see below.` : ''}`, !!skipped.length);
      await refresh();
      if (!skipped.length) draw();
      else importOut.replaceChildren(h('p', { class: 'hint' }, 'Not imported (fix these and import them again):'), h('ul', null, skipped.map((x) => h('li', { class: 'hint' }, x))));
    } catch (e) {
      toast(e.message + (ok ? ` (${ok} imported before that.)` : ''), true);
    } finally {
      importBtn.disabled = false;
    }
  });
  return h(
    'div',
    { class: 'field' },
    h('div', { class: 'stat' }, h('div', null, h('small', null, 'Posts'), h('b', null, String(data.posts.length))), h('div', null, h('small', null, 'Files'), h('b', null, String(data.files.length))), h('div', null, h('small', null, 'Size'), h('b', null, (total / 1048576).toFixed(1) + ' MB')), h('div', null, h('small', null, 'Visits'), h('b', null, String(data.counter)))),
    h('fieldset', { class: 'group' }, h('legend', null, 'Download everything'), h('p', { class: 'hint' }, 'One zip with every post, photo and setting, in the same folders as the bucket. It opens in Obsidian or any text editor. The posts-only zip is tiny and quick: handy as a regular backup.'), h('div', { class: 'row' }, h('a', { class: 'btn go', href: '/admin/api/export' }, 'Download everything (.zip)'), h('a', { class: 'btn', href: '/admin/api/export?photos=0' }, 'Posts and settings only'))),
    h('fieldset', { class: 'group' }, h('legend', null, 'Example posts'), h('p', { class: 'hint' }, 'Adds a few sample thoughts, places, photos, a list, a quote, a wishlist and travel stats so you can see every page. Your own site settings and stats are never overwritten.'), (() => {
      const b = h('button', { type: 'button', class: 'btn' }, 'Add example posts');
      b.addEventListener('click', () => loadExamples(b));
      return h('div', { class: 'row' }, b);
    })()),
    importBox('goodreads'),
    importBox('letterboxd'),
    h('fieldset', { class: 'group' }, h('legend', null, 'Import posts'), h('p', { class: 'hint' }, 'Drop in .md files written in Obsidian or by an AI. Files without a header get today\'s date.'), h('div', { class: 'row' }, typeSel, fin, importBtn), importOut),
    h('fieldset', { class: 'group' }, h('legend', null, 'All files'), h('div', { class: 'list' }, data.files.map((f) => h('div', { class: 'list-row' }, h('div', { class: 'grow' }, h('strong', null, f.key), h('small', null, `${(f.size / 1024).toFixed(1)} KB`))))))
  );
}

// ---------- start ----------

(async () => {
  try {
    await refresh();
    draw();
  } catch (e) {
    panel.replaceChildren(h('p', null, e.message));
  }
})();

// ---------- Designs: the visa in the passport, and keepsakes ----------
// The visa and keepsakes that come with the site are examples: here they can be swapped for
// another visa design, tweaked, switched off, or joined by keepsakes you design yourself.
// Settings live in passport.md and keepsakes.md, like the rest of the site.

const SAMPLE_STATS = { flights: 42, distance_km: 98000, hours: 130, airports: 21, countries: 12 };
const PICTURE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const KEEP_FOR = [['places', 'Journal'], ['books', 'Books'], ['films', 'Films'], ['tv', 'TV'], ['podcasts', 'Podcasts'], ['music', 'Music'], ['thoughts', 'Thoughts']];

function addInkDefs() {
  if (inkDefsAdded) return;
  const defs = h('div', { 'aria-hidden': 'true', style: { position: 'absolute', width: '0', height: '0', overflow: 'hidden' } });
  defs.innerHTML = INK_DEFS;
  document.body.append(defs);
  inkDefsAdded = true;
}
// Uploads a picture for a design (its hidden data is stripped on the way in) and returns its key.
async function uploadDesignPicture(file, name) {
  const ext = PICTURE_TYPES[file.type];
  if (!ext) throw new Error('Pictures must be jpg, png, webp or gif.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Pictures must be under 8 MB.');
  const key = `design/${name}-${Date.now().toString(36)}.${ext}`;
  await api('upload?key=' + enc(key), { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  return key;
}
function pictureInput(label, onPick) {
  const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', class: 'sr' });
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (!f) return;
    if (!PICTURE_TYPES[f.type]) return toast('Pictures must be jpg, png, webp or gif.', true);
    onPick(f);
  });
  return h('label', { class: 'btn small' }, label, input);
}

function viewDesigns() {
  addInkDefs();
  return h('div', { class: 'field designs' }, visaDesigner(), keepsakeDesigner());
}

// ----- the visa -----
let visaDraft = null;
function visaDesigner() {
  const saved = data.passport || {};
  visaDraft ||= { ...saved, file: null, blob: '' };
  const v = visaDraft;
  const box = h('section', { class: 'design-box' });
  // Redrawing moves focus off a field, which can fire its change handler mid-redraw: skip that.
  let drawing = false;
  const draw = () => {
    if (drawing) return;
    drawing = true;
    try {
      box.replaceChildren(...visaControls(v, draw, saved).filter(Boolean));
    } finally {
      drawing = false;
    }
  };
  draw();
  return box;
}
function visaControls(v, redraw, saved) {
  const look = visaLook(v);
  const base = VISA_DESIGNS[look.design];
  const preview = h('div', { class: 'visa-preview' }, visaCard(data.stats || SAMPLE_STATS, data.site.owner || '', { ...v, pictureUrl: v.blob || undefined }, 'pv'));
  const designs = h(
    'div',
    { class: 'design-picks', role: 'radiogroup', 'aria-label': 'Visa design' },
    Object.entries(VISA_DESIGNS).map(([id, d]) =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(look.design === id), class: 'design-pick' + (look.design === id ? ' on' : ''), onclick: () => {
        // A new design brings its own colours, strip and emblem.
        Object.assign(v, { design: id, ink: '', accent: '', highlight: '', strip: '', emblem: '' });
        redraw();
      } }, h('span', { class: 'swatches', 'aria-hidden': 'true' }, [d.ink, d.accent, d.highlight].map((c) => h('i', { style: { background: c } }))), d.name)
    )
  );
  const colour = (key, label) => {
    const input = h('input', { type: 'color', value: look[key], 'aria-label': label });
    input.addEventListener('input', () => {
      v[key] = input.value;
      preview.replaceChildren(visaCard(data.stats || SAMPLE_STATS, data.site.owner || '', { ...v, pictureUrl: v.blob || undefined }, 'pv'));
    });
    input.addEventListener('change', redraw);
    return h('label', { class: 'colour-pick' }, input, h('span', null, label));
  };
  const select = (key, options, label) => {
    const sel = h('select', { class: 'input', 'aria-label': label }, Object.entries(options).map(([id, name]) => h('option', { value: id, selected: look[key] === id }, name + (base[key] === id ? ' (this design’s own)' : ''))));
    sel.addEventListener('change', () => {
      v[key] = sel.value === base[key] ? '' : sel.value;
      redraw();
    });
    return h('label', { class: 'design-field' }, h('span', null, label), sel);
  };
  const words = h('input', { class: 'input', value: (v.words || []).join(', '), placeholder: VISA_WORLD.join(', '), 'aria-label': 'Words for visa' });
  words.addEventListener('change', () => {
    v.words = words.value.split(',').map((w) => w.trim()).filter(Boolean).slice(0, 14);
    redraw();
  });
  const changed = JSON.stringify(visaFile(v)) !== JSON.stringify(visaFile(saved)) || !!v.file;
  return [
    h('h3', null, 'Visa in the passport'),
    h('p', { class: 'hint' }, 'The original design is yours to keep; pick another, change its colours, the strip along the bottom, the emblem and the words, or put your own picture behind it. It shows in the passport.'),
    h(
      'div',
      { class: 'visa-layout' },
      preview,
      h(
        'div',
        { class: 'visa-side' },
    designs,
    h('div', { class: 'design-row' }, colour('ink', 'Ink'), colour('accent', 'Accent'), colour('highlight', 'Highlight'), v.ink || v.accent || v.highlight ? h('button', { type: 'button', class: 'btn small', onclick: () => { Object.assign(v, { ink: '', accent: '', highlight: '' }); redraw(); } }, 'Use the design’s own colours') : null),
    h('div', { class: 'design-row' }, select('strip', VISA_STRIPS, 'Strip along the bottom'), select('emblem', VISA_EMBLEMS, 'Emblem')),
    h('label', { class: 'design-field wide' }, h('span', null, '"Visa" in other languages, with commas between (leave empty for the usual ones)'), words),
    h(
      'div',
      { class: 'design-row' },
      pictureInput(v.picture || v.blob ? 'Change picture' : 'Add a picture behind it', (f) => {
        v.file = f;
        if (v.blob) URL.revokeObjectURL(v.blob);
        v.blob = URL.createObjectURL(f);
        redraw();
      }),
      v.picture || v.blob ? h('button', { type: 'button', class: 'btn small danger', onclick: () => { v.file = null; v.blob = ''; v.picture = ''; redraw(); } }, 'Remove picture') : null,
      h('span', { class: 'hint' }, 'A picture takes the place of the drawn scene, fading out behind the writing.')
    ),
    h(
      'div',
      { class: 'row' },
      h('button', { type: 'button', class: 'btn go', disabled: !changed, onclick: (e) => saveVisa(v, saved, e.currentTarget) }, 'Save the visa'),
      h('button', { type: 'button', class: 'btn', onclick: () => { Object.assign(v, { design: '', ink: '', accent: '', highlight: '', strip: '', emblem: '', words: [], picture: '', file: null, blob: '' }); redraw(); } }, 'Back to the original'),
      changed ? h('button', { type: 'button', class: 'btn', onclick: () => { visaDraft = null; draw(); } }, 'Undo changes') : null
    )
      )
    )
  ];
}
// What goes in passport.md.
const visaFile = (v) => ({ design: v.design && v.design !== 'central' ? v.design : '', ink: v.ink || '', accent: v.accent || '', highlight: v.highlight || '', strip: v.strip || '', emblem: v.emblem || '', words: v.words || [], picture: v.picture || '' });
async function saveVisa(v, saved, btn) {
  btn.disabled = true;
  try {
    if (v.file) v.picture = await uploadDesignPicture(v.file, 'visa');
    await putFile('passport.md', frontMatter(visaFile(v)) + '\nThe visa in the passport. Change it under Designs in the back office.\n');
    if (saved.picture && saved.picture !== v.picture) await delFile(saved.picture).catch(() => {});
    if (v.blob) URL.revokeObjectURL(v.blob);
    visaDraft = null;
    await refresh();
    toast('Visa saved.');
    draw();
  } catch (e) {
    toast(e.message, true);
    btn.disabled = false;
  }
}

// ----- keepsakes -----
let keepsDraft = null;
function keepsakeDesigner() {
  const saved = data.keepsakes || { hidden: [], custom: [] };
  keepsDraft ||= { hidden: new Set(saved.hidden), custom: saved.custom.map((d) => ({ ...d })), files: {}, blobs: {}, editing: null };
  const k = keepsDraft;
  const box = h('section', { class: 'design-box' });
  let drawing = false;
  const redraw = () => {
    if (drawing) return;
    drawing = true;
    try {
      box.replaceChildren(...keepControls(k, redraw, saved).filter(Boolean));
    } finally {
      drawing = false;
    }
  };
  redraw();
  return box;
}
const keepFile = (k) => ({
  hidden: [...k.hidden].sort(),
  custom: k.custom.map((d) => ({ id: d.id, name: d.name, sub: d.sub, tab: d.tab, shape: d.shape, heading: d.heading, paper: d.paper, ink: d.ink, accent: d.accent, picture: d.picture, types: d.types, prices: !!d.prices }))
});
function keepControls(k, redraw, saved) {
  // Built-ins, by the tab they sit in, each with a switch.
  const groups = [...new Set(KEEPSAKES.map((x) => x.group))];
  const switches = groups.map((g) => {
    const kinds = KEEPSAKES.filter((x) => x.group === g);
    const on = kinds.filter((x) => !k.hidden.has(x.id)).length;
    return h(
      'details',
      { class: 'keep-switch' },
      h('summary', null, g, h('span', { class: 'keep-count' + (on ? '' : ' none') }, `${on} of ${kinds.length} on`)),
      h(
        'div',
        { class: 'keep-ticks' },
        kinds.map((x) => {
          const box = h('input', { type: 'checkbox', checked: !k.hidden.has(x.id) });
          box.addEventListener('change', () => {
            if (box.checked) k.hidden.delete(x.id);
            else k.hidden.add(x.id);
            redraw();
          });
          return h('label', { class: 'keep-tick' + (box.checked ? ' on' : '') }, box, h('span', null, h('strong', null, x.name), h('small', null, x.sub)));
        })
      )
    );
  });
  const sample = (d) => ({ slug: 'sample-' + d.id, ts: Date.now(), type: d.types?.[0] || 'places', title: d.types?.[0] === 'places' || !d.types?.length ? 'Somewhere nice' : 'Something good', creator: '' });
  const sampleLines = (d) => [{ item: 'A line you write', price: d.prices ? '£5' : '' }];
  const gallery = h(
    'div',
    { class: 'km-gallery' },
    k.custom.map((d) =>
      h(
        'div',
        { class: 'km-item' },
        h('div', { class: 'km-show' }, customKeepsake(d, sample(d), sampleLines(d), k.blobs[d.id])),
        h('div', { class: 'km-meta' }, h('strong', null, d.name), h('small', null, `${d.tab} · ${(d.types || []).map((t) => KEEP_FOR.find(([id]) => id === t)?.[1]).join(', ')}`)),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: () => { k.editing = { ...d, _old: d.id }; redraw(); } }, 'Edit'), h('button', { type: 'button', class: 'btn small danger', onclick: () => {
          if (!confirm(`Delete "${d.name}"? Posts that have it keep their lines, but it won't show.`)) return;
          k.custom = k.custom.filter((x) => x !== d);
          redraw();
        } }, 'Delete'))
      )
    ),
    h('button', { type: 'button', class: 'km-new', onclick: () => {
      const [paper, ink, accent] = SHAPE_COLOURS.ticket;
      k.editing = { id: '', name: '', sub: '', tab: 'My keepsakes', shape: 'ticket', heading: '', paper, ink, accent, picture: '', types: ['places'], prices: false, _new: true };
      redraw();
    } }, '+ Make a keepsake')
  );
  const changed = JSON.stringify(keepFile(k)) !== JSON.stringify(keepFile({ hidden: new Set(saved.hidden), custom: saved.custom })) || Object.keys(k.files).length;
  return [
    h('h3', null, 'Keepsakes'),
    h('p', { class: 'hint' }, 'Switch off any that aren’t for you (they leave the editor; posts that already have one keep it), and make your own: they get their own tab in the editor and stick into posts like the rest.'),
    h('div', { class: 'keep-switches' }, switches),
    h('h4', null, 'Your own'),
    gallery,
    k.editing ? keepForm(k, redraw, sample, sampleLines) : null,
    h(
      'div',
      { class: 'row' },
      h('button', { type: 'button', class: 'btn go', disabled: !changed || !!k.editing, onclick: (e) => saveKeepsakes(k, saved, e.currentTarget) }, 'Save keepsakes'),
      changed ? h('button', { type: 'button', class: 'btn', onclick: () => { keepsDraft = null; draw(); } }, 'Undo changes') : null
    )
  ];
}
function keepForm(k, redraw, sample, sampleLines) {
  const d = k.editing;
  const blob = k.blobs[d._old || d.id] || k.blobs._editing;
  const show = h('div', { class: 'km-show big' });
  const drawShow = () => show.replaceChildren(customKeepsake({ ...d, id: d.id || 'new' }, sample(d), sampleLines(d), d.picture === '' && !blob ? '' : blob));
  drawShow();
  const text = (key, label, max, ph) => {
    const input = h('input', { class: 'input', value: d[key] || '', maxlength: max, placeholder: ph || '' });
    input.addEventListener('input', () => {
      d[key] = input.value;
      drawShow();
    });
    return h('label', { class: 'design-field' }, h('span', null, label), input);
  };
  const shape = h('select', { class: 'input' }, Object.entries(SHAPES).map(([id, name]) => h('option', { value: id, selected: d.shape === id }, name)));
  shape.addEventListener('change', () => {
    d.shape = shape.value;
    [d.paper, d.ink, d.accent] = SHAPE_COLOURS[d.shape];
    redraw();
  });
  const colour = (key, label) => {
    const input = h('input', { type: 'color', value: d[key] || '#ffffff', 'aria-label': label });
    input.addEventListener('input', () => {
      d[key] = input.value;
      drawShow();
    });
    return h('label', { class: 'colour-pick' }, input, h('span', null, label));
  };
  const types = h(
    'div',
    { class: 'design-row' },
    KEEP_FOR.map(([id, label]) => {
      const box = h('input', { type: 'checkbox', checked: (d.types || []).includes(id) });
      box.addEventListener('change', () => {
        d.types = KEEP_FOR.map(([t]) => t).filter((t) => (t === id ? box.checked : d.types.includes(t)));
        drawShow();
      });
      return h('label', { class: 'check' }, box, ' ', label);
    })
  );
  const prices = h('input', { type: 'checkbox', checked: !!d.prices });
  prices.addEventListener('change', () => {
    d.prices = prices.checked;
    drawShow();
  });
  const done = () => {
    const name = (d.name || '').trim();
    if (!name) return toast('Give it a name first.', true);
    if (!d.types?.length) return toast('Tick at least one kind of post it can go on.', true);
    let id = d._old || slugify(name).slice(0, 30);
    if (!d._old) {
      const taken = new Set(k.custom.map((x) => x.id));
      for (let n = 2; taken.has(id); n++) id = slugify(name).slice(0, 26) + '-' + n;
    }
    const clean = { id, name, sub: (d.sub || '').trim(), tab: (d.tab || '').trim() || 'My keepsakes', shape: d.shape, heading: (d.heading || '').trim(), paper: d.paper, ink: d.ink, accent: d.accent, picture: d.picture || '', types: d.types, prices: !!d.prices };
    if (k.files._editing) {
      k.files[id] = k.files._editing;
      k.blobs[id] = k.blobs._editing;
      delete k.files._editing;
      delete k.blobs._editing;
    }
    const at = k.custom.findIndex((x) => x.id === d._old);
    if (at >= 0) k.custom[at] = clean;
    else k.custom.push(clean);
    k.editing = null;
    redraw();
  };
  return h(
    'div',
    { class: 'km-form' },
    h('h4', null, d._new ? 'A new keepsake' : 'Edit keepsake'),
    show,
    h('div', { class: 'design-row' }, text('name', 'Name (in the editor)', 40, 'e.g. Ferry ticket'), text('sub', 'A few words under it', 50, 'e.g. across the bay'), text('tab', 'Editor tab', 24, 'My keepsakes')),
    h('div', { class: 'design-row' }, h('label', { class: 'design-field' }, h('span', null, 'Shape'), shape), text('heading', 'Heading on it (leave empty for the name)', 30, 'e.g. FERRY')),
    h('div', { class: 'design-row' }, colour('paper', 'Paper'), colour('ink', 'Ink'), colour('accent', 'Accent')),
    h(
      'div',
      { class: 'design-row' },
      pictureInput(d.picture || blob ? 'Change picture' : 'Add a picture', (f) => {
        k.files._editing = f;
        if (k.blobs._editing) URL.revokeObjectURL(k.blobs._editing);
        k.blobs._editing = URL.createObjectURL(f);
        redraw();
      }),
      d.picture || blob ? h('button', { type: 'button', class: 'btn small danger', onclick: () => { d.picture = ''; delete k.files._editing; delete k.blobs._editing; delete k.files[d._old]; delete k.blobs[d._old]; redraw(); } }, 'Remove picture') : null,
      h('span', { class: 'hint' }, 'A scan of a real ticket, a drawing, a cut-out PNG… "Just my picture" shows it on its own.')
    ),
    h('span', { class: 'design-label' }, 'Can go on'),
    types,
    h('label', { class: 'check' }, prices, ' Lines can have a price (like a receipt)'),
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn go', onclick: done }, d._new ? 'Add it' : 'Done'), h('button', { type: 'button', class: 'btn', onclick: () => { delete k.files._editing; delete k.blobs._editing; k.editing = null; redraw(); } }, 'Cancel'))
  );
}
async function saveKeepsakes(k, saved, btn) {
  btn.disabled = true;
  try {
    for (const [id, file] of Object.entries(k.files)) {
      const d = k.custom.find((x) => x.id === id);
      if (d) d.picture = await uploadDesignPicture(file, 'keepsake-' + id);
    }
    await putFile('keepsakes.md', frontMatter(keepFile(k)) + '\nKeepsakes switched off, and ones you designed. Change them under Designs in the back office.\n');
    // Pictures no longer used by any design are removed.
    const now = new Set(k.custom.map((d) => d.picture).filter(Boolean));
    for (const d of saved.custom) if (d.picture && !now.has(d.picture)) await delFile(d.picture).catch(() => {});
    Object.values(k.blobs).forEach((u) => URL.revokeObjectURL(u));
    keepsDraft = null;
    await refresh();
    toast('Keepsakes saved.');
    draw();
  } catch (e) {
    toast(e.message, true);
    btn.disabled = false;
  }
}
