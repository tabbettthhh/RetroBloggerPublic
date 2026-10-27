// Search across everything on the site, done in the visitor's browser: nothing they type
// is sent anywhere. Every word typed has to appear somewhere in the post.
import { h, iconEl, ICON, niceDate, catLabel } from './util.js';
import { SHELF_ICON } from './shelves.js';
import { floppy } from './helper.js';

export const MAGNIFIER = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.6" fill="#e8f2ff" stroke="currentColor" stroke-width="1.6"/><path d="M10 10l4.3 4.3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

const KINDS = [
  ['all', 'Everything'],
  ['thoughts', 'Thoughts'],
  ['places', 'Places'],
  ['photos', 'Photos'],
  ['lists', 'Lists'],
  ['quotes', 'Quotes'],
  ['books', 'Books'],
  ['films', 'Films'],
  ['podcasts', 'Podcasts'],
  ['music', 'Music'],
  ['tv', 'TV']
];
const LABEL = { thoughts: 'Thought', places: 'Place', photos: 'Photo dump', lists: 'List', quotes: 'Quote', books: 'Book', films: 'Film', podcasts: 'Podcast', music: 'Music', tv: 'TV show' };
const ICONS = { thoughts: ICON.bubble, places: ICON.pin, photos: ICON.camera, lists: ICON.list, quotes: ICON.book, ...SHELF_ICON };
const SHELVES = ['books', 'films', 'podcasts', 'music', 'tv'];

// Lowercase, without accents, so "cafe" finds "Café".
const fold = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

function plain(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

export function hrefFor(p) {
  if (p.type === 'places') return `#/journal/${p.slug}`;
  if (SHELVES.includes(p.type)) return `#/${p.type}/${p.slug}`;
  return `#/post/${p.type}/${p.slug}`;
}

let cache = null;
function index(data) {
  if (cache && cache.data === data) return cache.items;
  const items = data.posts.map((p) => {
    const body = plain(p.html);
    const parts = [p.creator, p.album, p.episode, p.season && `Season ${p.season}`, p.network, p.year, p.area, p.city, p.country, p.category && catLabel(p.category), p.source, p.quote, p.suggested_by, ...(p.captions || [])].filter(Boolean).map(String);
    // Leave out bits already said, like the city when the area already names it.
    const meta = parts.filter((x, i) => !parts.some((y, j) => j !== i && y.length > x.length && y.toLowerCase().includes(x.toLowerCase()))).filter((x, i, a) => a.indexOf(x) === i).join(' · ');
    return { post: p, title: p.title || '', meta, body, hay: { title: fold(p.title), meta: fold(meta), body: fold(body) } };
  });
  // Wishlist places too, so "noodle" finds the noodle bar you still want to try.
  for (const w of data.wishlist?.want || []) {
    const meta = [w.city, w.category && catLabel(w.category), w.note].filter(Boolean).join(' · ');
    items.push({ wish: true, title: w.name, meta, body: '', hay: { title: fold(w.name), meta: fold(meta), body: '' } });
  }
  cache = { data, items };
  return items;
}

function run(data, query, kind) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out = [];
  for (const it of index(data)) {
    if (kind !== 'all' && (it.wish ? kind !== 'places' : it.post.type !== kind)) continue;
    let score = 0;
    let ok = true;
    for (const w of words) {
      const t = it.hay.title.includes(w);
      const m = it.hay.meta.includes(w);
      const b = it.hay.body.includes(w);
      if (!t && !m && !b) {
        ok = false;
        break;
      }
      score += (t ? 6 : 0) + (m ? 3 : 0) + (b ? 1 : 0) + (it.hay.title.startsWith(w) ? 2 : 0);
    }
    if (ok) out.push({ ...it, score: score + (it.post?.pinned ? 1 : 0), ts: it.post?.ts || 0 });
  }
  return out.sort((a, b) => b.score - a.score || b.ts - a.ts).slice(0, 60);
}

// Text with the matching words highlighted, built safely from text nodes.
function marked(text, words) {
  const span = h('span');
  if (!words.length || !text) {
    span.textContent = text || '';
    return span;
  }
  const f = fold(text);
  const hits = [];
  for (const w of words) {
    let i = f.indexOf(w);
    while (i >= 0) {
      hits.push([i, i + w.length]);
      i = f.indexOf(w, i + w.length);
    }
  }
  hits.sort((a, b) => a[0] - b[0]);
  let at = 0;
  for (const [s, e] of hits) {
    if (s < at) continue;
    span.append(text.slice(at, s), h('mark', null, text.slice(s, e)));
    at = e;
  }
  span.append(text.slice(at));
  return span;
}

// A piece of the body around the first match.
function snippet(body, words) {
  if (!body) return '';
  const f = fold(body);
  let i = -1;
  for (const w of words) {
    const k = f.indexOf(w);
    if (k >= 0 && (i < 0 || k < i)) i = k;
  }
  if (i < 0) return body.length > 140 ? body.slice(0, 140) + '…' : body;
  const start = Math.max(0, i - 50);
  return (start ? '…' : '') + body.slice(start, start + 150) + (start + 150 < body.length ? '…' : '');
}

export function search(ctx) {
  const data = ctx.data;
  let kind = 'all';
  let query = ctx.param || '';
  const input = h('input', { type: 'search', class: 'search-input', placeholder: 'Search posts, places, books, films…', 'aria-label': 'Search', value: query, autocomplete: 'off', enterkeyhint: 'search' });
  const chips = h('div', { class: 'search-chips', role: 'group', 'aria-label': 'Only show' });
  const results = h('div', { class: 'search-results', role: 'region', 'aria-live': 'polite' });
  const helper = floppy(data, hrefFor);
  const draw = () => {
    const present = new Set(data.posts.map((p) => p.type));
    if (data.wishlist?.want?.length) present.add('places');
    chips.replaceChildren(
      ...KINDS.filter(([k]) => k === 'all' || present.has(k)).map(([k, label]) =>
        h('button', { type: 'button', class: 'search-chip' + (kind === k ? ' on' : ''), 'aria-pressed': String(kind === k), onclick: () => { kind = k; draw(); } }, label)
      )
    );
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (!words.length) {
      const pinned = data.posts.filter((p) => p.pinned);
      results.replaceChildren(
        ...[
          h('p', { class: 'search-hint' }, 'Type a word: a place, a dish, a book, an artist, a city…'),
          pinned.length ? h('h3', { class: 'search-heading' }, 'Pinned') : null,
          ...pinned.map((p) => row({ post: p, title: p.title || p.excerpt || '', meta: '', body: '' }, []))
        ].filter(Boolean)
      );
      return;
    }
    const found = run(data, query, kind);
    helper.results(found.length);
    results.replaceChildren(
      h('p', { class: 'search-count' }, found.length ? `${found.length}${found.length === 60 ? '+' : ''} result${found.length === 1 ? '' : 's'}` : `Nothing found for “${query.trim()}”.`),
      ...found.map((it) => row(it, words))
    );
  };
  const row = (it, words) => {
    if (it.wish) {
      return h('a', { class: 'search-row', href: '#/wishlist' }, h('span', { class: 'search-ico', html: ICON.pin }), h('span', { class: 'search-text' }, h('strong', null, marked(it.title, words)), h('small', null, 'On the wishlist', it.meta ? ' · ' : '', marked(it.meta, words))));
    }
    const p = it.post;
    const snip = snippet(it.body, words);
    return h(
      'a',
      { class: 'search-row', href: hrefFor(p) },
      h('span', { class: 'search-ico', html: ICONS[p.type] || ICON.bubble }),
      h(
        'span',
        { class: 'search-text' },
        h('strong', null, p.pinned ? '📌 ' : '', marked(it.title || p.excerpt?.slice(0, 60) || LABEL[p.type], words)),
        h('small', null, `${LABEL[p.type]} · ${niceDate(p.date)}`, it.meta ? ' · ' : '', marked(it.meta.length > 90 ? it.meta.slice(0, 90) + '…' : it.meta, words)),
        snip ? h('span', { class: 'search-snip' }, marked(snip, words)) : null
      )
    );
  };
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      query = input.value;
      helper.typed(query);
      // Keep the address in step without reloading the page, so Back works and links can be shared.
      history.replaceState(null, '', query.trim() ? `#/search/${encodeURIComponent(query.trim())}` : '#/search');
      draw();
    }, 120);
  });
  draw();
  setTimeout(() => input.focus({ preventScroll: true }), 50);
  return h('div', { class: 'search' }, h('div', { class: 'search-box' }, h('span', { class: 'search-glass', html: MAGNIFIER }), input), chips, results, helper.el);
}
