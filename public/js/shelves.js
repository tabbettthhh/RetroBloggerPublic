// The three shelves: books on a wooden bookshelf, films as cinema ticket stubs, and podcasts
// as cassette tapes. Covers are drawn in the site's own style with the title only.
import { h, iconEl, ICON, niceDate, monthYear, hash } from './util.js';
import { sound } from './sound.js';
import { word, postFontAttrs } from './skins.js';
import { commentsButton } from './comments.js';
import { lightbox, suggestForm, suggestedStamp, keepsakeMakers } from './apps.js';

export const SHELF_TYPES = ['books', 'films', 'podcasts', 'music', 'tv'];
const KIND_OF = { books: 'book', films: 'film', podcasts: 'podcast', music: 'music', tv: 'tv' };

const WORDS = {
  books: { one: 'Book', creator: 'by', now: 'Reading now', done: 'Read', want: 'Want to read', dropped: 'Put down', home: 'Bookshelf', back: 'Shelf' },
  films: { one: 'Film', creator: 'directed by', now: 'Watching', done: 'Watched', want: 'Want to watch', dropped: 'Walked out', home: 'Cinema', back: 'Tickets' },
  podcasts: { one: 'Podcast', creator: 'with', now: 'Listening now', done: 'Finished', want: 'Want to listen', dropped: 'Stopped', home: 'Podcasts', back: 'Tapes' },
  music: { one: 'Music', creator: 'by', now: 'On repeat', done: 'Listened', want: 'Want to hear', dropped: 'Skipped', home: 'Record crate', back: 'Crate' },
  tv: { one: 'TV show', creator: 'created by', now: 'Watching', done: 'Finished', want: 'Want to watch', dropped: 'Gave up', home: 'TV', lower: 'TV shelf', back: 'Tapes' }
};
const ORDER = ['now', 'done', 'want', 'dropped'];

export const SHELF_ICON = {
  books: '<svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true"><rect x="1" y="2" width="3" height="11" fill="#b8402e" stroke="#5a1a10" stroke-width=".7"/><rect x="4.5" y="1" width="3" height="12" fill="#2f5d8a" stroke="#14304f" stroke-width=".7"/><rect x="8" y="3" width="2.6" height="10" fill="#d6a53a" stroke="#6b4e10" stroke-width=".7"/><path d="M11.2 4.2l2.6-.8 2 9-2.6.8z" fill="#3f7a4a" stroke="#1b3d22" stroke-width=".7"/></svg>',
  films: '<svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M1 2h14v2.6a1.4 1.4 0 0 0 0 2.8V10H1V7.4a1.4 1.4 0 0 0 0-2.8z" fill="#f4d36b" stroke="#8a5a10" stroke-width=".8"/><path d="M5 2.5v7" stroke="#8a5a10" stroke-width=".7" stroke-dasharray="1 1"/></svg>',
  music: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="9" cy="8" r="6.5" fill="#1a1a1a"/><circle cx="9" cy="8" r="4.5" fill="none" stroke="#444" stroke-width=".5"/><circle cx="9" cy="8" r="2" fill="#e8692c"/><rect x="1" y="1.5" width="9" height="13" fill="#2f5d8a" stroke="#14304f" stroke-width=".6"/></svg>',
  tv: '<svg width="16" height="15" viewBox="0 0 16 15" aria-hidden="true"><path d="M5 1l3 3 3-3" fill="none" stroke="#555" stroke-width="1"/><rect x=".5" y="4" width="15" height="10.5" rx="1.5" fill="#8a5a30" stroke="#3a2410"/><rect x="2" y="5.5" width="9.5" height="7.5" rx="1.6" fill="#7fb6d9" stroke="#1a1a1a" stroke-width=".6"/><circle cx="13.4" cy="7" r=".9" fill="#ddd"/><circle cx="13.4" cy="10" r=".9" fill="#ddd"/></svg>',
  podcasts: '<svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true"><rect x=".5" y=".5" width="15" height="10" rx="1.5" fill="#3a3a3a" stroke="#111"/><rect x="2" y="2" width="12" height="4" rx=".6" fill="#f2e6c8"/><circle cx="5.2" cy="7.8" r="1.3" fill="#ddd"/><circle cx="10.8" cy="7.8" r="1.3" fill="#ddd"/></svg>'
};

export const shelfPosts = (data, type) => data.posts.filter((p) => p.type === type);

// Reviews worth showing in the home feed: something written, and not just "want to".
export function inFeed(post) {
  if (!SHELF_TYPES.includes(post.type)) return true;
  return post.state !== 'want' && !!(post.excerpt || '').trim();
}

const pick = (list, seed) => list[hash(String(seed).toLowerCase()) % list.length];

function sizeClass(title) {
  const n = String(title || '').length;
  return n > 34 ? ' tiny' : n > 20 ? ' long' : n < 9 ? ' short' : '';
}

// ---------- covers ----------

const CLOTH = ['#7a1f24', '#1f3a5f', '#2f5d3a', '#a8782a', '#1e5b5b', '#5a2d5e', '#33363b', '#8a4f26', '#2b4a7a', '#6b2b2b', '#e6dcc2', '#3d5a40'];
export function bookCover(post, cls = '') {
  const cloth = pick(CLOTH, post.title + '#cloth');
  const light = cloth === '#e6dcc2';
  return h(
    'span',
    { class: `book-cover${light ? ' light' : ''}${post.state === 'want' ? ' wanted' : ''} ${cls}`, style: { '--cloth': cloth } },
    h('span', { class: 'bc-title' + sizeClass(post.title) }, post.title || 'Untitled'),
    post.state === 'now' ? h('span', { class: 'bc-ribbon', 'aria-hidden': 'true' }) : null,
    post.state === 'now' && bookPct(post) != null ? h('span', { class: 'bc-progress', 'aria-hidden': 'true', style: { '--pct': bookPct(post) + '%' } }) : null
  );
}

// How far through a book, 0–100, when both the page and the length are known.
export function bookPct(post) {
  if (!post.pages || !post.page) return null;
  return Math.max(0, Math.min(100, Math.round((post.page / post.pages) * 100)));
}

const TICKET = [
  ['#f4d6d2', '#8a1a1a'],
  ['#d4e8f2', '#173f6b'],
  ['#f4e7c2', '#7a4a0a'],
  ['#d8ecd2', '#1f5a2a'],
  ['#e6d8f0', '#4a2270'],
  ['#f6dcc0', '#8a3a10']
];
export function ticket(post, cls = '') {
  const [paper, ink] = pick(TICKET, post.title + '#ticket');
  const n = hash(post.title + '#seat');
  const row = 'ABCDEFGHJKLM'[n % 12];
  const seat = 1 + ((n >>> 4) % 24);
  return h(
    'span',
    { class: `ticket${post.state === 'want' ? ' wanted' : ''} ${cls}`, style: { '--tk': paper, '--ink': ink } },
    h('span', { class: 'tk-stub', 'aria-hidden': 'true' }, h('span', null, 'ADMIT ONE')),
    h(
      'span',
      { class: 'tk-main' },
      h('span', { class: 'tk-top', 'aria-hidden': 'true' }, 'ADMIT ONE'),
      h('span', { class: 'tk-title' + sizeClass(post.title) }, post.title || 'Untitled'),
      h('span', { class: 'tk-seat', 'aria-hidden': 'true' }, `ROW ${row} · SEAT ${seat}`)
    )
  );
}

const LABEL = [
  ['#f2e6c8', '#c8402a', '#e89a2a'],
  ['#eef0f2', '#2a6fc8', '#5fb4e8'],
  ['#f6eedd', '#2f8a4a', '#9ccc5a'],
  ['#f8e8e8', '#b02a6a', '#e86aa0'],
  ['#efe9dc', '#333333', '#8a8a8a'],
  ['#f4efe0', '#7a3ab0', '#c08ae8']
];
export function cassette(post, cls = '') {
  const [paper, a, b] = pick(LABEL, post.title + '#tape');
  return h(
    'span',
    { class: `cassette${post.state === 'want' ? ' wanted' : ''} ${cls}`, style: { '--label': paper, '--s1': a, '--s2': b } },
    h('span', { class: 'cs-label' }, h('span', { class: 'cs-stripes', 'aria-hidden': 'true' }), h('span', { class: 'cs-title' + sizeClass(post.title) }, post.title || 'Untitled')),
    h('span', { class: 'cs-window', 'aria-hidden': 'true' }, h('i'), h('i')),
    h('span', { class: 'cs-screws', 'aria-hidden': 'true' })
  );
}

// Records: a 12-inch album sleeve with the record sliding out, or a 7-inch single in a
// paper sleeve with a hole showing the label.
const SLEEVE = [
  ['#e8692c', '#f2c14e', '#2b2b2b'],
  ['#1f4f7a', '#e6dcc2', '#d9533a'],
  ['#2f5d3a', '#e8d27a', '#f4efe0'],
  ['#5a2d5e', '#f08a7a', '#f6e7d0'],
  ['#1b1b1b', '#e8e2d2', '#c8402a'],
  ['#c8402a', '#f4e7c2', '#1f3a5f'],
  ['#e6dcc2', '#1f6a6a', '#c9993f']
];
const MOTIFS = ['stripes', 'sun', 'rings', 'band'];
export function record(post, cls = '') {
  const [a, b, c] = pick(SLEEVE, post.title + '#sleeve');
  const style = { '--sa': a, '--sb': b, '--sc': c, '--lb': pick(['#e8692c', '#f2c14e', '#d9533a', '#7fbf5a', '#e8e2d2'], post.title + '#label') };
  const wanted = post.state === 'want' ? ' wanted' : '';
  if (post.format === 'song') {
    return h('span', { class: `vinyl-single${wanted} ${cls}`, style }, h('span', { class: 'sg-sleeve' }, h('span', { class: 'sg-title' + sizeClass(post.title) }, post.title || 'Untitled')));
  }
  return h(
    'span',
    { class: `record${wanted} ${cls}`, style },
    h('span', { class: 'rc-disc', 'aria-hidden': 'true' }),
    h('span', { class: 'rc-sleeve rc-' + pick(MOTIFS, post.title + '#motif') }, h('span', { class: 'rc-title' + sizeClass(post.title) }, post.title || 'Untitled'))
  );
}

// TV: a video tape sleeve, with the season on a sticker.
const SLEEVE_TV = [
  ['#1b1b1b', '#e8402e', '#f2c14e'],
  ['#14306a', '#f2c14e', '#e8e2d2'],
  ['#2a2a2a', '#3ab0d6', '#e86aa0'],
  ['#6b1f2a', '#f4e7c2', '#e89a2a'],
  ['#1f4f3a', '#e8e2d2', '#c8402a'],
  ['#3a2a5a', '#f08a7a', '#7fbf5a']
];
const num = (v) => /^\d+$/.test(String(v || '').trim());
// "Season 2", "Episode 5" or, with both, "S2 · E5".
function tvSticker(post) {
  const se = String(post.season || '').trim();
  const ep = String(post.episode || '').trim();
  if (num(se) && num(ep)) return `S${se} · E${ep}`;
  if (se) return num(se) ? `Season ${se}` : se;
  if (ep) return num(ep) ? `Episode ${ep}` : ep;
  return '';
}

export function vhs(post, cls = '') {
  const [a, b, c] = pick(SLEEVE_TV, post.title + '#vhs');
  return h(
    'span',
    { class: `vhs${post.state === 'want' ? ' wanted' : ''} ${cls}`, style: { '--va': a, '--vb': b, '--vc': c } },
    h('span', { class: 'vhs-band', 'aria-hidden': 'true' }),
    h('span', { class: 'vhs-title' + sizeClass(post.title) }, post.title || 'Untitled'),
    tvSticker(post) ? h('span', { class: 'vhs-season' }, tvSticker(post)) : null,
    h('span', { class: 'vhs-foot', 'aria-hidden': 'true' }, 'VIDEO')
  );
}

const COVER = { books: bookCover, films: ticket, podcasts: cassette, music: record, tv: vhs };

// ---------- small pieces ----------

function stars(n) {
  if (n == null) return null;
  const wrap = h('span', { class: 'stars', role: 'img', 'aria-label': `Rated ${n} out of 5` });
  for (let i = 1; i <= 5; i++) {
    const fill = n >= i ? '#f5b301' : n >= i - 0.5 ? 'url(#half-star)' : '#e2e2e2';
    wrap.append(iconEl(ICON.star(fill)));
  }
  return wrap;
}
const HALF_DEF = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="half-star"><stop offset="50%" stop-color="#f5b301"/><stop offset="50%" stop-color="#e2e2e2"/></linearGradient></defs></svg>';

// When you really started: the earliest of the post's date and anything logged in its episode
// or reading diary, so adding earlier episodes moves "since" back to the first one.
function startedOn(post) {
  const dates = [post.date, ...(post.episodes || []).map((e) => e.date), ...(post.reading_log || []).map((e) => e.date)].filter((x) => /^\d{4}-\d{2}-\d{2}/.test(x || ''));
  return dates.sort((a, b) => a.slice(0, 10).localeCompare(b.slice(0, 10)))[0] || post.date;
}

function when(post) {
  const w = WORDS[post.type];
  const d = niceDate(post.date);
  if (post.state === 'now') return `${w.now.replace(' now', '')} since ${niceDate(startedOn(post))}`;
  if (post.state === 'want') return `${w.want} · added ${d}`;
  if (post.state === 'dropped') return `${w.dropped} · ${d}`;
  return `${w.done} ${d}`;
}

function creatorLine(post) {
  const w = WORDS[post.type];
  const bits = [];
  if (post.type === 'music') bits.push(post.format === 'song' ? 'Song' : 'Album');
  if (post.creator) bits.push(`${w.creator} ${post.creator}`);
  if (post.album) bits.push(`from ${post.album}`);
  if (post.season) bits.push(/^\d+$/.test(post.season.trim()) ? `Season ${post.season.trim()}` : post.season);
  if (post.type === 'books' && post.pages) {
    bits.push(post.state === 'now' && post.page ? `page ${post.page} of ${post.pages} (${bookPct(post)}%)` : `${post.pages} pages`);
  } else if (post.type === 'books' && post.state === 'now' && post.page) bits.push(`up to page ${post.page}`);
  if (post.type === 'tv' && post.episode) {
    const ep = post.episode.trim();
    bits.push(num(ep) ? (post.state === 'now' ? `up to episode ${ep}` : `episode ${ep}`) : ep);
  }
  if (post.network) bits.push(`on ${post.network}`);
  if (post.year) bits.push(post.year);
  return bits.join(' · ');
}

// ---------- the home feed card ----------

export function shelfCard(post, cardHead) {
  const w = WORDS[post.type];
  return h(
    'article',
    { class: 'card' },
    cardHead(post, null, w.one, SHELF_ICON[post.type]),
    h(
      'div',
      { class: 'shelf-card' },
      h('a', { class: 'shelf-card-cover', href: `#/${post.type}/${post.slug}`, 'aria-label': post.title }, COVER[post.type](post, 'small')),
      h(
        'div',
        { class: 'place-info' },
        h('strong', { class: 'place-name' }, post.title || 'Untitled'),
        post.episode && post.type !== 'tv' ? h('span', { class: 'muted' }, post.episode) : null,
        post.episodes?.length ? h('span', { class: 'muted small' }, `${post.episodes.length} episode${post.episodes.length === 1 ? '' : 's'} in the diary`) : null,
        creatorLine(post) ? h('span', { class: 'muted' }, creatorLine(post)) : null,
        stars(post.rating),
        post.suggested_by ? h('span', { class: 'muted small' }, `Suggested by ${post.suggested_by}`) : null,
        post.excerpt ? h('span', { class: 'shelf-excerpt' }, post.excerpt) : null,
        h('a', { class: 'xp-btn', href: `#/${post.type}/${post.slug}` }, `${word('read_review', 'Read the review')} ›`)
      )
    )
  );
}

// ---------- shelves ----------

function shelfView(type, ctx) {
  const w = WORDS[type];
  const list = shelfPosts(ctx.data, type);
  const wrap = h('div', { class: `shelf-view shelf-${type}`, html: HALF_DEF });
  const kind = KIND_OF[type];
  const suggest = h('div', { class: 'shelf-suggest' }, suggestForm(kind, ctx.data, { cls: 'suggest-' + type, field: 'shelf-field', button: 'shelf-btn' }));
  if (!list.length) {
    wrap.append(h('div', { class: 'shelf-empty' }, h('p', null, `Nothing on the ${(w.lower || w.home.toLowerCase())} yet.`), h('p', { class: 'hand' }, 'The first review goes here.')), suggest);
    return wrap;
  }
  for (const state of ORDER) {
    // Albums first, then singles, on the record shelf.
    const items = list.filter((p) => p.state === state).sort((x, y) => (y.pinned - x.pinned) || ((x.format === 'song') - (y.format === 'song')));
    if (!items.length) continue;
    wrap.append(
      h('h2', { class: 'shelf-plaque' }, h('span', null, w[state]), h('small', null, String(items.length))),
      h(
        'div',
        { class: 'shelf-row' },
        items.map((p) =>
          h('a', { class: 'shelf-item' + (p.pinned ? ' pinned' : ''), href: `#/${type}/${p.slug}`, title: p.pinned ? `${p.title} (pinned)` : p.title, onclick: () => sound.click() }, p.pinned ? h('span', { class: 'card-pin', role: 'img', 'aria-label': 'Pinned' }) : null, COVER[type](p), type !== 'books' && p.rating != null ? stars(p.rating) : null)
        )
      )
    );
  }
  wrap.append(suggest);
  return wrap;
}

// ---------- book reading log ----------

// A library-card style log of reading sessions, oldest first, with a progress bar.
function readingLog(post) {
  const list = post.reading_log || [];
  const pct = bookPct(post);
  if (!list.length && pct == null) return null;
  const sorted = list
    .map((e, k) => ({ ...e, k }))
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.from || 0) - (b.from || 0) || a.k - b.k);
  const read = list.reduce((n, e) => n + (e.from && e.to ? e.to - e.from + 1 : 0), 0);
  const pages = (e) => (e.from && e.to ? (e.from === e.to ? `p. ${e.from}` : `pp. ${e.from}–${e.to}`) : e.to ? `to p. ${e.to}` : e.from ? `from p. ${e.from}` : '');
  return h(
    'section',
    { class: 'read-log', 'aria-label': 'Reading log' },
    h('h3', { class: 'rl-head' }, h('span', null, 'READING LOG'), h('span', { class: 'rl-sum' }, [list.length ? `${list.length} session${list.length === 1 ? '' : 's'}` : '', read ? `${read.toLocaleString('en-GB')} pages` : ''].filter(Boolean).join(' · '))),
    pct != null
      ? h(
          'div',
          { class: 'rl-progress', role: 'img', 'aria-label': `Page ${post.page} of ${post.pages}, ${pct}%` },
          h('div', { class: 'rl-bar' }, h('span', { style: { '--pct': pct + '%' } })),
          h('small', null, post.state === 'done' ? `Finished · ${post.pages} pages` : `Page ${post.page} of ${post.pages} · ${pct}%`)
        )
      : null,
    list.length
      ? h(
          'ol',
          { class: 'rl-list' },
          sorted.map((e) =>
            h(
              'li',
              { class: 'rl-row' },
              h('span', { class: 'rl-date' }, e.date ? shortDay(e.date) : '—'),
              h('div', { class: 'rl-main' }, h('div', { class: 'rl-line' }, pages(e) ? h('b', null, pages(e)) : null, e.chapter ? h('span', { class: 'rl-chapter' }, e.chapter) : null), e.note ? h('p', { class: 'rl-note' }, e.note) : null)
            )
          )
        )
      : null
  );
}

function shortDay(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).toUpperCase();
}

// ---------- TV episode diary ----------

// A TV-guide style listing of the episodes logged for a show, in order.
function episodeDiary(post) {
  const list = post.episodes || [];
  if (!list.length) return null;
  const key = (e) => [parseInt(e.season, 10) || 0, parseInt(e.ep, 10) || 0];
  const sorted = list
    .map((e, k) => ({ ...e, k }))
    .sort((a, b) => {
      const [as, ae] = key(a);
      const [bs, be] = key(b);
      return as - bs || ae - be || a.k - b.k;
    });
  const eps = (e) => (e.to ? `${e.ep}–${e.to}` : String(e.ep || '').trim());
  const code = (e) => {
    const se = e.season || post.season || '';
    if (num(se) && num(e.ep)) return `S${se.trim()}·E${eps(e)}`;
    if (num(e.ep)) return `EP ${eps(e)}`;
    return e.ep || '—';
  };
  // A binge covers several episodes at once.
  const size = (e) => (e.to ? +e.to - +e.ep + 1 : 1);
  const total = list.reduce((n, e) => n + size(e), 0);
  const best = list.reduce((m, e) => (e.rating != null && (m == null || e.rating > m) ? e.rating : m), null);
  return h(
    'section',
    { class: 'ep-diary', 'aria-label': 'Episode diary' },
    h('h3', { class: 'ep-head' }, h('span', { class: 'ep-led' }, 'EPISODE GUIDE'), h('span', { class: 'ep-count' }, total > list.length ? `${total} episodes · ${list.length} logged` : `${list.length} logged`)),
    h(
      'ol',
      { class: 'ep-list' },
      sorted.map((e) =>
        h(
          'li',
          { class: 'ep-row' + (best != null && best >= 4.5 && e.rating === best ? ' ep-best' : '') + (e.to ? ' ep-binge' : '') },
          h('span', { class: 'ep-code' }, code(e)),
          h(
            'div',
            { class: 'ep-main' },
            h(
              'div',
              { class: 'ep-line' },
              h('strong', { class: 'ep-title' }, e.title || (e.to ? `Episodes ${e.ep}–${e.to}` : num(e.ep) ? `Episode ${e.ep}` : 'Episode')),
              e.to ? h('span', { class: 'ep-binge-tag' }, `BINGE ×${size(e)}`) : null,
              e.rating != null ? stars(e.rating) : null
            ),
            e.date ? h('span', { class: 'ep-date' }, `Watched ${monthDay(e.date)}`) : null,
            e.note ? h('p', { class: 'ep-note' }, e.note) : null
          )
        )
      )
    )
  );
}

function monthDay(d) {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// ---------- one review ----------

function detailView(type, ctx) {
  const w = WORDS[type];
  const list = shelfPosts(ctx.data, type);
  const i = list.findIndex((p) => p.slug === ctx.param);
  if (i < 0) return h('div', { class: 'shelf-empty' }, h('p', null, 'That review is not here any more.'), h('a', { class: 'shelf-btn', href: `#/${type}` }, `‹ ${w.back}`));
  const post = list[i];
  const nav = h(
    'div',
    { class: 'shelf-nav' },
    i < list.length - 1 ? h('a', { class: 'shelf-btn', href: `#/${type}/${list[i + 1].slug}`, onclick: () => sound.page() }, '‹ Older') : h('span'),
    h('a', { class: 'shelf-btn', href: `#/${type}` }, `Back to the ${(w.lower || w.home.toLowerCase())}`),
    i > 0 ? h('a', { class: 'shelf-btn', href: `#/${type}/${list[i - 1].slug}`, onclick: () => sound.page() }, 'Newer ›') : h('span')
  );
  const photos = post.photos.length
    ? h('div', { class: 'polaroids' }, post.photos.map((src, k) => h('button', { type: 'button', class: 'polaroid', style: { '--r': (k % 2 ? 2.5 : -3) + 'deg' }, onclick: () => lightbox(post, k) }, h('img', { src, alt: post.captions[k] || 'Photo', loading: 'lazy' }), h('span', { class: 'hand' }, post.captions[k] || ''))))
    : null;
  return h(
    'div',
    { class: `review review-${type}`, html: HALF_DEF },
    h('div', { class: 'review-cover' }, COVER[type](post, 'big')),
    h(
      'article',
      { class: 'review-card', ...postFontAttrs(post) },
      h('h2', null, post.title || 'Untitled'),
      post.episode && post.type !== 'tv' ? h('p', { class: 'review-episode' }, post.episode) : null,
      creatorLine(post) ? h('p', { class: 'review-meta' }, creatorLine(post)) : null,
      h('p', { class: 'review-when' }, when(post), post.rewatch ? h('span', { class: 'review-tag' }, 'Rewatch') : null),
      post.rating != null || post.recommend || post.suggested_by ? h('div', { class: 'review-rating' }, stars(post.rating), post.recommend ? h('span', { class: 'recommend-stamp' }, 'RECOMMENDED') : null, suggestedStamp(post)) : null,
      post.html ? h('div', { class: 'prose review-body', html: post.html }) : null,
      post.quote ? h('blockquote', { class: 'review-quote' }, post.quote) : null,
      photos
    ),
    reviewKeepsakes(post),
    episodeDiary(post),
    readingLog(post),
    // (Its comments open in a little window.)
    commentsButton(post, ctx.data) ? h('div', { class: 'shelf-comments' }, commentsButton(post, ctx.data)) : null,
    nav
  );
}

// Keepsakes stuck around the review: a bookmark, a ticket stub, a setlist…
function reviewKeepsakes(post) {
  const items = keepsakeMakers(post).map((make) => make()).filter(Boolean);
  return items.length ? h('div', { class: 'review-keeps' + (items.length > 1 ? ' several' : '') }, items) : null;
}

export function shelfApp(type) {
  return (ctx) => (ctx.param ? detailView(type, ctx) : shelfView(type, ctx));
}

export { WORDS as SHELF_WORDS, monthYear };
