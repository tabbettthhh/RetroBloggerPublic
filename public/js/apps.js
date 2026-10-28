// What each section shows. The same renderers fill a phone screen or a desktop window.
import { pagedSpread } from './journal-pages.js';
import { ABOUT } from './floppy-lines.js';
import { floppySvg } from './helper.js';
import { statusBlock, nudgeButton, presenceDot } from './statusbar.js';
import { withEmoticons } from './emoticons.js';
import { h, esc, iconEl, ICON, niceDate, monthYear, catColor, catLabel, CATEGORIES, storage, postForm, bringIntoView } from './util.js';
import { mountMap } from './maps.js';
import { INK_DEFS, stampSvg, passportStamps, stampLook } from './stamps.js';
import { sound } from './sound.js';
import { SHELF_TYPES, shelfCard, shelfApp, inFeed, SHELF_ICON } from './shelves.js';
import { search } from './search.js';
import { visaCard, wordList, VISAS_WORLD, MICRO } from './visa.js';
import { customMakers } from './keepsake-maker.js';
import { thoughtMakers, memoryRibbon } from './thought-keepsakes.js';
import { musicMakers } from './music-keepsakes.js';
import { studyMakers } from './study-keepsakes.js';
import { albumApp } from './album.js';
import { friendsApp } from './friends-feed.js';
import { dressCard, profileDecor } from './card-dress.js';
import { commentLink, commentsBlock, commentsButton } from './comments.js';
import { activeSkin, resolveSkin, word, postFontAttrs } from './skins.js';

const session = storage('session');

// Every section, with how it shows in the menus. Which are in the main bar (and in what
// order), and which are left out of the menus altogether, is part of the site's theme.
const SECTION_INFO = {
  home: { label: 'Home', href: '#/' },
  thoughts: { label: 'Thoughts', href: '#/thoughts', sub: 'The latest posts', swatch: 'xp' },
  journal: { label: 'Places', href: '#/journal', sub: 'Places journal', swatch: 'leather' },
  atlas: { label: 'Map', href: '#/atlas', sub: 'Every place on a map', swatch: 'mac' },
  friends: { label: 'Friends', href: '#/friends', sub: 'Posts from my buddies', swatch: 'xp' },
  album: { label: 'Photos', long: 'Photo album', href: '#/album', sub: 'Every photo, by date', swatch: 'album' },
  more: { label: 'Dumps', long: 'Photo dumps & lists', href: '#/more', sub: 'Top 5s, quotes', swatch: 'film' },
  passport: { label: 'Passport', href: '#/passport', sub: 'Leather journal', swatch: 'leather' },
  wishlist: { label: 'Wishlist', href: '#/wishlist', sub: 'Retro Mac', swatch: 'mac' },
  guestbook: { label: 'Guestbook', href: '#/guestbook', sub: 'Retro Android', swatch: 'android' },
  books: { label: 'Books', long: 'Bookshelf', href: '#/books', sub: 'Book reviews', swatch: 'shelf' },
  films: { label: 'Films', long: 'Cinema', href: '#/films', sub: 'Film reviews', swatch: 'cinema' },
  podcasts: { label: 'Podcasts', href: '#/podcasts', sub: 'On tape', swatch: 'tape' },
  music: { label: 'Music', long: 'Record crate', href: '#/music', sub: 'Albums and songs', swatch: 'record' },
  tv: { label: 'TV', href: '#/tv', sub: 'Shows on tape', swatch: 'crt' },
  stats: { label: 'Stats', long: 'Travel stats', href: '#/stats', sub: 'From the flight log', swatch: 'xp' },
  about: { label: 'About', href: '#/about', swatch: 'about' }
};
const OTHERS_ORDER = ['album', 'passport', 'wishlist', 'guestbook', 'more', 'books', 'films', 'podcasts', 'music', 'tv', 'stats', 'about', 'thoughts', 'journal', 'atlas', 'friends'];
// The main bar's sections (in order) and the ones left out of the menus.
export function menuOf(data) {
  const t = activeSkin() || resolveSkin(data.theme || {});
  const hidden = new Set(t.sections_hidden);
  if (!data.stats) hidden.add('stats');
  // Friends' posts kept off the site (in the back office): no Friends tab, anywhere.
  if (data.friendsTab === false) hidden.add('friends');
  return { main: t.menu.filter((id) => !hidden.has(id)), hidden };
}
export const sectionLabel = (id) => word(id, SECTION_INFO[id]?.label || id);

export function sections(data) {
  const { main, hidden } = menuOf(data);
  const list = main.map((id, i) => ({ id, label: word(id, SECTION_INFO[id].label), href: SECTION_INFO[id].href, group: 'main', key: String(i + 1) }));
  list.push({ id: 'search', label: word('search', 'Search'), sub: 'Find anything', href: '#/search', group: 'others', swatch: 'search' });
  for (const id of OTHERS_ORDER) {
    if (main.includes(id) || hidden.has(id)) continue;
    const s = SECTION_INFO[id];
    list.push({ id, label: word(id, s.long || s.label), sub: id === 'about' ? data.site.owner || 'Who writes this' : s.sub, href: s.href, group: 'others', swatch: s.swatch });
  }
  list.push({ id: 'leave', label: word('leave', 'Leave'), href: '#/welcome', group: 'leave' });
  return list;
}

const withFont = (el, post) => {
  for (const [k, v] of Object.entries(postFontAttrs(post))) el?.setAttribute(k, v);
  return el;
};
export const places = (data) => data.posts.filter((p) => p.type === 'places');

// ---------- small shared pieces ----------

function prose(html, cls = '') {
  return h('div', { class: 'prose ' + cls, html });
}

function stars(n, cls = 'stars') {
  if (n == null) return null;
  const wrap = h('span', { class: cls, role: 'img', 'aria-label': `Rated ${n} out of 5` });
  for (let i = 1; i <= 5; i++) wrap.append(iconEl(ICON.star(i <= n ? '#f5b301' : '#e2e2e2')));
  return wrap;
}

// Every photo opens in the XP style picture viewer, with Previous / Next through the post's photos.
// (The viewer itself is only fetched the first time a photo is opened.)
export function lightbox(post, i = 0) {
  openViewer({ photos: post.photos, captions: post.captions || [], title: post.title }, i);
}
export function openViewer(set, i = 0) {
  import('./viewer.js').then(({ photoViewer }) => photoViewer(set, i));
}

function photoGrid(post) {
  if (!post.photos.length) return null;
  return h(
    'div',
    { class: 'photo-grid n' + Math.min(post.photos.length, 4) },
    post.photos.map((src, i) =>
      h('button', { type: 'button', class: 'photo-btn', onclick: () => lightbox(post, i) }, h('img', { src, alt: post.captions[i] || 'Photo', loading: 'lazy' }))
    )
  );
}

function miniMap(post) {
  // A drawn mini map: a pin, roads and the category colour. Real maps live in the journal and atlas.
  const c = catColor(post.category);
  const s = h('span', { class: 'mini-map', 'aria-hidden': 'true' });
  s.innerHTML = `<svg width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="#eef0e2"/><path d="M8 64 C 22 52, 36 70, 52 58 S 80 40, 96 46" fill="none" stroke="#9cc6ea" stroke-width="7"/><rect x="58" y="8" width="30" height="22" rx="3" fill="#c7e2a6"/><path d="M0 30 H96 M30 0 V96 M0 82 L 96 74" stroke="#fff" stroke-width="5"/><ellipse cx="49" cy="47" rx="6" ry="2" fill="rgba(0,0,0,.25)"/><path d="M49 46s9-8.5 9-14a9 9 0 0 0-18 0c0 5.5 9 14 9 14z" fill="${c}" stroke="rgba(0,0,0,.45)"/><circle cx="49" cy="32" r="3.2" fill="#fff"/></svg>`;
  return s;
}

// ---------- XP feed ----------

function cardHead(post, icon, label, svg) {
  const href = SHELF_TYPES.includes(post.type) ? `#/${post.type}/${post.slug}` : `#/post/${post.type}/${post.slug}`;
  return h('header', { class: 'card-head' }, iconEl(svg || ICON[icon]), h('strong', null, label), h('a', { class: 'card-date', href }, niceDate(post.date, true)));
}

// `open`: the post on its own page (a memory's ribbon is bigger there).
export function card(post, open = false) {
  const el = cardInner(post, open);
  // (A post written in a font of its own.)
  for (const [k, v] of Object.entries(postFontAttrs(post))) el?.setAttribute(k, v);
  if (post.type === 'thoughts') el?.classList.add('card-is-thought');
  // (Its design, ribbons and corner mark; and in the feed, how many comments it has.)
  dressCard(el, post, open);
  if (!open) {
    const link = commentLink(post);
    if (link && el) el.append(link);
  }
  return el;
}
function cardInner(post, open) {
  if (SHELF_TYPES.includes(post.type)) return shelfCard(post, cardHead);
  if (post.type === 'thoughts') {
    // Keepsakes sit along the bottom of the card, like things tucked in with a note.
    const keeps = keepsakeMakers(post).map((make) => make()).filter(Boolean);
    // A thought about the past: an old, sepia-toned card with a "reliving a memory" ribbon.
    return h('article', { class: 'card' + (post.memory ? ' memory' : '') }, cardHead(post, 'bubble', post.memory ? 'Memory' : 'Thought'), memoryRibbon(post, open), post.title ? h('h3', { class: 'card-title' }, post.title) : null, prose(post.html, 'card-body'), photoGrid(post), keeps.length ? h('div', { class: 'card-keeps' }, keeps) : null);
  }
  if (post.type === 'places') {
    const thumb = post.photos[0] ? h('img', { class: 'place-thumb', src: post.photos[0], alt: '', loading: 'lazy' }) : miniMap(post);
    return h(
      'article',
      { class: 'card' },
      cardHead(post, 'pin', 'Place'),
      h(
        'div',
        { class: 'place-card' },
        thumb,
        h(
          'div',
          { class: 'place-info' },
          h('strong', { class: 'place-name' }, post.title || 'Untitled place'),
          h('span', { class: 'muted' }, post.area || post.city),
          stars(post.rating),
          h('span', { class: 'cat-chip' }, h('span', { class: 'dot', style: { background: catColor(post.category) } }), catLabel(post.category)),
          post.suggested_by ? h('span', { class: 'muted small' }, `Suggested by ${post.suggested_by}`) : null,
          h('a', { class: 'xp-btn', href: `#/journal/${post.slug}` }, `${word('open_journal', 'Open in journal')} ›`)
        )
      )
    );
  }
  if (post.type === 'photos') {
    const keeps = keepsakeMakers(post).map((make) => make()).filter(Boolean);
    return h(
      'article',
      { class: 'card' + (post.memory ? ' memory' : '') },
      cardHead(post, 'camera', post.memory ? 'Memory' : 'Photo dump'),
      memoryRibbon(post, open),
      post.title ? h('h3', { class: 'card-title' }, post.title) : null,
      h(
        'div',
        { class: 'filmstrip' },
        post.photos.length
          ? post.photos.map((src, i) => h('button', { type: 'button', class: 'frame', onclick: () => lightbox(post, i) }, h('img', { src, alt: post.captions[i] || 'Photo', loading: 'lazy' })))
          : h('span', { class: 'frame empty' }, 'No photos yet')
      ),
      prose(post.html, 'card-body'),
      keeps.length ? h('div', { class: 'card-keeps' }, keeps) : null
    );
  }
  if (post.type === 'lists') {
    return h('article', { class: 'card' }, cardHead(post, 'list', 'List'), h('div', { class: 'card-body' }, post.title ? h('h3', { class: 'card-title' }, post.title) : null, prose(post.html, 'list-body')));
  }
  if (post.type === 'quotes') {
    return h(
      'article',
      { class: 'card' },
      cardHead(post, 'book', 'Quote'),
      h('figure', { class: 'quote' }, h('span', { class: 'quote-mark', 'aria-hidden': 'true' }, '“'), prose(post.html, 'quote-body'), post.source ? h('figcaption', null, '— ', post.source) : null)
    );
  }
  return h('article', { class: 'card' }, prose(post.html));
}

// `here`: on the About page itself, where the picture doesn't need to link anywhere.
function profileTile(data, here = false) {
  const latest = data.posts[0];
  // (Bunting and stickers for the season or festive day: shown by skins.css while one is on.)
  const decor = profileDecor();
  return h(
    'div',
    { class: 'profile-tile' },
    decor.bunting,
    // Your picture opens your profile: the About page, with your photo grid after the bio.
    here ? h('span', { class: 'avatar', html: ICON.person() }) : h('a', { class: 'avatar', href: '#/about', title: 'Profile', 'aria-label': `${data.site.owner || data.site.name}: profile`, html: ICON.person() }),
    h(
      'div',
      { class: 'profile-text' },
      h('div', { class: 'profile-name' }, h('strong', null, data.site.owner || data.site.name), nudgeButton(data.site)),
      h('div', { class: 'profile-sub' }, latest ? h('span', { class: 'small' }, 'Last post · ' + niceDate(latest.date)) : null, decor.stickers),
      statusBlock(data)
    )
  );
}

// A feed shows twenty posts to start with and adds the next twenty as you near the end (or
// tap "Older posts"), so a site with years of posts still opens quickly on an old phone.
const FEED_PAGE = 20;
function feed(filter, withProfile) {
  return (ctx) => {
    const list = ctx.data.posts.filter((p) => (filter === 'all' ? p.pinned || inFeed(p) : filter.includes(p.type)));
    // Pinned posts first, newest pinned at the top; then everything else by date.
    const posts = [...list.filter((p) => p.pinned), ...list.filter((p) => !p.pinned)];
    const wrap = h('div', { class: 'feed' }, withProfile ? profileTile(ctx.data) : null);
    if (!posts.length) {
      wrap.append(h('p', { class: 'empty' }, 'Nothing here yet.'));
      return wrap;
    }
    let shown = 0;
    let io = null;
    const more = h('button', { type: 'button', class: 'feed-more' });
    const addMore = () => {
      const next = posts.slice(shown, shown + FEED_PAGE);
      shown += next.length;
      more.before(...next.map((p) => foldLong(pinnedCard(p), p)));
      if (shown >= posts.length) {
        more.remove();
        io?.disconnect();
        return;
      }
      more.textContent = `Older posts (${posts.length - shown} more) ›`;
      // Watched afresh, so a button still in view after short posts brings the next lot too.
      if (io) {
        io.unobserve(more);
        io.observe(more);
      }
    };
    more.addEventListener('click', addMore);
    wrap.append(more);
    addMore();
    if (shown < posts.length && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        if (!more.isConnected) return;
        if (entries.some((e) => e.isIntersecting)) addMore();
      }, { rootMargin: '0px 0px 800px 0px' });
      io.observe(more);
    }
    return wrap;
  };
}

// In the feed, a very long post shows its first part with a fade and "Keep reading", which
// opens the rest in place. The post's own page always shows everything.
export function foldLong(el, post) {
  const body = el.querySelector('.card-body, .list-body, .quote-body');
  if (!body || SHELF_TYPES.includes(post.type) || post.type === 'places') return el;
  body.classList.add('foldable');
  const more = h('button', { type: 'button', class: 'keep-reading', hidden: true, 'aria-expanded': 'false' }, 'Keep reading ›');
  more.addEventListener('click', () => {
    body.classList.remove('folded');
    more.remove();
  });
  body.after(more);
  queueFold(el, body, more);
  return el;
}

// Long posts are measured once they're on screen, all together in one go (measuring them one
// at a time made the browser lay the whole page out again for every post).
const foldChecks = [];
let foldFrame = 0;
function queueFold(el, body, more) {
  foldChecks.push({ el, body, more, tries: 0 });
  foldFrame ||= requestAnimationFrame(measureFolds);
}
function measureFolds() {
  foldFrame = 0;
  const all = foldChecks.splice(0);
  const here = all.filter((f) => f.el.isConnected);
  const later = all.filter((f) => !f.el.isConnected && ++f.tries < 600);
  const tall = here.map((f) => f.body.scrollHeight > 460);
  here.forEach((f, i) => {
    if (!tall[i]) return;
    f.body.classList.add('folded');
    f.more.hidden = false;
  });
  if (later.length) {
    foldChecks.push(...later);
    foldFrame = requestAnimationFrame(measureFolds);
  }
}

// A card with a pushpin stuck in it, for pinned posts.
function pinnedCard(post) {
  const el = card(post);
  if (post.pinned) {
    el.classList.add('pinned');
    el.prepend(h('span', { class: 'card-pin', role: 'img', 'aria-label': 'Pinned' }));
    el.querySelector('.card-head strong')?.after(h('span', { class: 'pinned-label' }, 'Pinned'));
  }
  return el;
}

function single(ctx) {
  const [type, slug] = String(ctx.param || '').split('/');
  const post = ctx.data.posts.find((p) => p.type === type && p.slug === slug);
  if (!post) return h('div', { class: 'feed' }, h('p', { class: 'empty' }, 'That post is not here any more.'), h('a', { class: 'xp-btn', href: '#/' }, '‹ Back home'));
  return h('div', { class: 'feed' }, card(post, true), commentsBlock(post, ctx.data), h('a', { class: 'xp-btn', href: '#/' }, '‹ Back home'));
}

// ---------- Leather journal ----------

function visitNumber(all, post) {
  const key = (post.title + '|' + post.city).toLowerCase();
  return all.filter((p) => (p.title + '|' + p.city).toLowerCase() === key && p.ts <= post.ts).length;
}

const yearOf = (p) => String(p.date || '').slice(0, 4);

function journal(ctx) {
  const all = places(ctx.data);
  if (!all.length) return h('div', { class: 'journal-empty' }, h('p', null, 'No places reviewed yet.'), h('p', { class: 'hand' }, 'The first one starts the journal.'));
  // One notebook per year: the shelf of them, a year's contents page, or one entry.
  if (ctx.param === 'shelf') return journalShelf(ctx, all);
  const ym = /^year\/(\d{4})$/.exec(ctx.param || '');
  if (ym) return yearContents(ctx, all, ym[1]);
  const post = all.find((p) => p.slug === ctx.param) || all[0];
  const year = yearOf(post);
  const list = all.filter((p) => yearOf(p) === year);
  const i = list.indexOf(post);
  const years = [...new Set(all.map(yearOf))];
  const olderYear = years[years.indexOf(year) + 1];
  const newerYear = years[years.indexOf(year) - 1];
  const visit = visitNumber(all, post);

  const mapWrap = Number.isFinite(post.lat) && Number.isFinite(post.lon) ? h('div', { class: 'taped' }, h('span', { class: 'tape l' }), h('span', { class: 'tape r' }), (() => {
    const el = h('div', { class: 'journal-map' });
    mountMap(el, { places: [post], style: 'journal', interactive: true, zoom: 15 });
    return el;
  })()) : null;

  const chips = h(
    'div',
    { class: 'chips' },
    post.weather ? h('span', { class: 'chip' }, iconEl(ICON.cloud), post.weather) : null,
    h('span', { class: 'chip' }, iconEl(ICON.repeat), 'Visit #' + visit),
    post.category ? h('span', { class: 'chip' }, h('span', { class: 'dot', style: { background: catColor(post.category) } }), catLabel(post.category)) : null
  );

  const rating = post.rating != null || post.would_return || post.suggested_by
    ? h(
        'div',
        { class: 'rating-row' },
        post.rating != null
          ? h('div', { class: 'stickers', role: 'img', 'aria-label': `Rated ${post.rating} out of 5` }, [1, 2, 3, 4, 5].map((n) => h('span', { class: 'sticker' + (n <= post.rating ? ' on' : ''), html: ICON.star(n <= post.rating ? '#fff8dc' : '#d8ccb4') })))
          : null,
        post.would_return ? h('span', { class: 'return-stamp' }, 'WOULD RETURN') : null,
        suggestedStamp(post)
      )
    : null;

  const nav = h(
    'div',
    { class: 'page-nav' },
    // The book reads newest first: page 1 is the latest place, turning on goes back in time.
    i > 0
      ? h('a', { class: 'leather-pill', href: `#/journal/${list[i - 1].slug}`, onclick: () => sound.page() }, '‹ Newer')
      : newerYear
        ? h('a', { class: 'leather-pill', href: `#/journal/year/${newerYear}`, onclick: () => sound.page() }, `‹ ${newerYear}`)
        : h('span'),
    h('span', { class: 'hand' }, `page ${i + 1} of ${list.length} · ${year}`),
    i < list.length - 1
      ? h('a', { class: 'leather-pill', href: `#/journal/${list[i + 1].slug}`, onclick: () => sound.page() }, 'Older ›')
      : olderYear
        ? h('a', { class: 'leather-pill', href: `#/journal/year/${olderYear}`, onclick: () => sound.page() }, `${olderYear} ›`)
        : h('span')
  );

  const journalHead = h('div', { class: 'journal-head', ...postFontAttrs(post) }, h('h2', null, post.title || 'Untitled place'), h('span', { class: 'hand big' }, [post.area || post.city, 'visited ' + niceDate(post.date)].filter(Boolean).join(' · ')));
  // The passport opens at this city's stamp, and the map at this place's pin.
  const slug = encodeURIComponent(post.slug);
  const links = h(
    'div',
    { class: 'journal-links' },
    h('a', { class: 'paper-pill', href: `#/journal/year/${year}` }, `${year} contents`),
    h('a', { class: 'paper-pill', href: '#/journal/shelf' }, 'All my journals'),
    h('a', { class: 'paper-pill', href: post.city ? `#/passport/${slug}` : '#/passport' }, 'Passport'),
    h('a', { class: 'leather-pill', href: mapWrap ? `#/atlas/${slug}` : '#/atlas' }, 'Map of everywhere'),
    commentsButton(post, ctx.data)
  );
  // Photos and keepsakes, in the order they're stuck in; then Floppy and the "Also in" note.
  const scraps = [...scrapOrder(post), () => floppyMargin(post), () => alsoIn(post, all)];
  if (ctx.desktop || ctx.tablet) {
    // A book: the map on the left with as many photos and keepsakes as fit under it, writing
    // on the right. The rest go into the margins of the following pages, one a page, and any
    // still left over fill scrapbook pages after the writing, so nothing needs scrolling.
    // How far through the journal this entry is (0 = the oldest), for the thickness of the page stacks.
    const through = list.length > 1 ? i / (list.length - 1) : 0.5;
    return pagedSpread({ through, extras: pageExtras(post), scraps, left: h('div', { class: 'left-stick' }, mapWrap), head: [journalHead, chips, rating].filter(Boolean), body: withFont(prose(post.html, 'ruled'), post), foot: [nav, links], title: post.title || 'This place' });
  }
  // A phone: one page. The first photos lead, then the writing with the rest woven in between
  // paragraphs, and whatever's left at the end.
  return h('div', { class: 'page single' }, mapWrap, journalHead, chips, rating, ...weave(withFont(prose(post.html, 'ruled'), post), scraps, post), nav, links);
}

// ---------- the shelf of journals, one per year ----------

const COVERS = ['#5a3620', '#2f4a3a', '#6b2b2b', '#2b3f5c', '#5c4a1e', '#4a2f4f', '#3b3b3b', '#7a4a1e'];
function journalShelf(ctx, all) {
  const years = [...new Set(all.map(yearOf))];
  const books = years.map((y, k) => {
    const items = all.filter((p) => yearOf(p) === y);
    const codes = [...new Set(items.map((p) => (p.country_code || '').toUpperCase()).filter(Boolean))];
    const cities = new Set(items.map((p) => p.city).filter(Boolean));
    const width = 54 + Math.min(items.length, 40) * 2.2;
    return h(
      'a',
      { class: 'jbook', href: `#/journal/year/${y}`, onclick: () => sound.page(), style: { '--cover': COVERS[Number(y) % COVERS.length], '--w': width + 'px', '--tilt': (k % 3 === 2 ? -3 : 0) + 'deg' }, 'aria-label': `${y} journal: ${items.length} place${items.length === 1 ? '' : 's'}` },
      h('span', { class: 'jb-band top', 'aria-hidden': 'true' }),
      h('span', { class: 'jb-year' }, y),
      h('span', { class: 'jb-label' }, h('span', { class: 'hand' }, `${items.length} place${items.length === 1 ? '' : 's'}`), h('small', null, `${cities.size} cit${cities.size === 1 ? 'y' : 'ies'}`)),
      codes.length ? h('span', { class: 'jb-codes' }, codes.slice(0, 4).map((c) => h('span', null, c))) : null,
      h('span', { class: 'jb-band bottom', 'aria-hidden': 'true' })
    );
  });
  const doodle = h('button', { type: 'button', class: 'floppy-doodle jshelf-floppy' }, h('span', { class: 'fd-say' }, pickLine(ABOUT.shelf({ years }))), h('span', { class: 'fd-pic', html: floppySvg() }));
  doodle.addEventListener('click', () => (doodle.firstChild.textContent = pickLine(ABOUT.shelf({ years }))));
  return h(
    'div',
    { class: 'jshelf-wrap' + (ctx.desktop || ctx.tablet ? ' wide' : '') },
    h('div', { class: 'jshelf-head' }, h('h2', null, 'My journals'), h('span', { class: 'hand big' }, `One notebook a year · ${all.length} place${all.length === 1 ? '' : 's'} so far`)),
    h('div', { class: 'jshelf' }, h('div', { class: 'jshelf-row' }, ...books)),
    doodle
  );
}

// A year's contents page: places by month, with page numbers, and a cover page beside it.
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function yearContents(ctx, all, year) {
  const items = all.filter((p) => yearOf(p) === year);
  if (!items.length) return journalShelf(ctx, all);
  // Newest first, like the book itself: this month at the top, page 1 the latest place.
  const pageOf = (p) => items.indexOf(p) + 1;
  const byMonth = new Map();
  for (const p of items) {
    const m = Number(String(p.date).slice(5, 7)) - 1;
    (byMonth.get(m) || byMonth.set(m, []).get(m)).push(p);
  }
  // Month headings and entries as separate pieces, so the list can break across pages.
  const body = h(
    'div',
    { class: 'contents' },
    ...[...byMonth.entries()].flatMap(([m, ps]) => [
      h('h3', { class: 'hand ct-month-h' }, MONTHS_LONG[m]),
      ...ps.map((p) => h('div', { class: 'ct-item' }, h('a', { href: `#/journal/${p.slug}`, onclick: () => sound.page() }, h('span', { class: 'ct-title' }, p.title || 'Untitled place'), h('span', { class: 'ct-dots', 'aria-hidden': 'true' }), h('span', { class: 'ct-page' }, `p. ${pageOf(p)}`)), p.city ? h('small', null, p.city) : null))
    ])
  );
  const codes = [...new Set(items.map((p) => (p.country_code || '').toUpperCase()).filter(Boolean))];
  const cities = [...new Set(items.map((p) => p.city).filter(Boolean))];
  const years = [...new Set(all.map(yearOf))];
  const older = years[years.indexOf(year) + 1];
  const newer = years[years.indexOf(year) - 1];
  const cover = h(
    'div',
    { class: 'year-cover' },
    h('span', { class: 'yc-year' }, year),
    h('span', { class: 'hand big' }, 'travel journal'),
    h('div', { class: 'yc-stats' }, h('span', null, h('b', null, String(items.length)), ` place${items.length === 1 ? '' : 's'}`), h('span', null, h('b', null, String(cities.length)), ` cit${cities.length === 1 ? 'y' : 'ies'}`), h('span', null, h('b', null, String(codes.length)), ` countr${codes.length === 1 ? 'y' : 'ies'}`)),
    cities.length ? h('p', { class: 'hand yc-cities' }, cities.slice(0, 12).join(' · ')) : null,
    floppyContents(year, items)
  );
  const nav = h(
    'div',
    { class: 'page-nav' },
    newer ? h('a', { class: 'leather-pill', href: `#/journal/year/${newer}` }, `‹ ${newer}`) : h('span'),
    h('a', { class: 'paper-pill', href: '#/journal/shelf' }, 'All my journals'),
    older ? h('a', { class: 'leather-pill', href: `#/journal/year/${older}` }, `${older} ›`) : h('span')
  );
  const head = h('div', { class: 'journal-head' }, h('h2', null, 'Contents'), h('span', { class: 'hand big' }, `${year} · newest first`));
  if (ctx.desktop || ctx.tablet) {
    const through = years.length > 1 ? years.indexOf(year) / (years.length - 1) : 0.5;
    return pagedSpread({ through, left: cover, head: [head], body, foot: [nav], title: `${year} contents`, bodyClass: 'contents' });
  }
  return h('div', { class: 'page single' }, cover, head, body, nav);
}

function floppyContents(year, items) {
  const lines = ABOUT.contents({ year, count: items.length, first: items[items.length - 1]?.title, last: items[0]?.title });
  const text = h('span', { class: 'fd-say' }, pickLine(lines));
  return h('button', { type: 'button', class: 'floppy-doodle', onclick: () => (text.textContent = pickLine(lines)) }, text, h('span', { class: 'fd-pic', html: floppySvg() }));
}

// Little things from the place for the margins of long entries' later pages.
function pageExtras(post) {
  const out = [];
  if (post.weather) {
    out.push(() => h('div', { class: 'deco-weather' }, h('span', { class: 'dw-top' }, 'WEATHER'), iconEl(ICON.cloud), h('span', { class: 'hand' }, post.weather), h('small', null, niceDate(post.date))));
  }
  if (Number.isFinite(post.lat) && Number.isFinite(post.lon)) {
    out.push(() => {
      const lat = `${Math.abs(post.lat).toFixed(2)}°${post.lat >= 0 ? 'N' : 'S'}`;
      const lon = `${Math.abs(post.lon).toFixed(2)}°${post.lon >= 0 ? 'E' : 'W'}`;
      const city = esc((post.city || post.title || '').toUpperCase().slice(0, 18));
      const d = new Date(post.ts || Date.now());
      const day = esc(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase());
      return h('div', { class: 'deco-postmark', role: 'img', 'aria-label': `${post.city || ''} ${lat} ${lon}`, html: `<svg viewBox="0 0 150 110" aria-hidden="true"><defs><path id="pm-ring" d="M55 55m-36 0a36 36 0 1 1 72 0a36 36 0 1 1-72 0"/></defs><g fill="none" stroke="#1f3a6b" stroke-width="2"><circle cx="55" cy="55" r="44"/><circle cx="55" cy="55" r="28"/><path d="M104 38q11-6 22 0t22 0M104 55q11-6 22 0t22 0M104 72q11-6 22 0t22 0" stroke-width="2.2"/></g><g fill="#1f3a6b" font-family="Oswald, sans-serif"><text font-size="9" letter-spacing="1.5"><textPath href="#pm-ring">${city} · ${lat} · ${lon} ·</textPath></text><text x="55" y="52" font-size="8.5" text-anchor="middle" letter-spacing=".5">${day.slice(0, 6)}</text><text x="55" y="64" font-size="9" text-anchor="middle" font-weight="700">${day.slice(-4)}</text></g></svg>` });
    });
  }
  if (post.rating != null) {
    out.push(() => h('div', { class: 'deco-rating' }, h('span', { class: 'hand' }, 'my verdict'), h('div', { class: 'stickers' }, [1, 2, 3, 4, 5].map((n) => h('span', { class: 'sticker' + (n <= post.rating ? ' on' : ''), html: ICON.star(n <= post.rating ? '#fff8dc' : '#d8ccb4') })))));
  }
  return out;
}

// ---------- journal scrapbook: the receipt, Floppy in the margin, other places nearby ----------

// Prices added up, when every line has one in the same currency.
function totalOf(lines) {
  const money = lines.map((o) => /^([^\d]*)\s?(\d+(?:[.,]\d{1,2})?)\s?([^\d]*)$/.exec(o.price || ''));
  const signs = new Set(money.map((m) => (m ? (m[1] + '|' + m[3]).trim() : null)));
  if (!money.length || !money.every(Boolean) || signs.size !== 1) return null;
  const n = money.reduce((t, m) => t + parseFloat(m[2].replace(',', '.')), 0);
  const [pre, post] = [money[0][1].trim(), money[0][3].trim()];
  return `${pre}${n.toFixed(2)}${post ? ' ' + post : ''}`;
}
const pad2 = (n) => String(n).padStart(2, '0');
const when = (post) => {
  const d = new Date(post.ts || Date.now());
  return { day: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`, time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}` };
};
const lineList = (cls, lines) => h('ul', { class: cls }, lines.map((o) => h('li', null, h('span', { class: 'rc-item' }, o.item), h('span', { class: 'rc-dots', 'aria-hidden': 'true' }), o.price ? h('span', { class: 'rc-price' }, o.price) : null)));
// A made-up ticket number that stays the same for a place.
const serial = (post, salt) => String((hashText(post.slug + salt) % 900000) + 100000);
function hashText(str) {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619);
  return x >>> 0;
}

// A till receipt (what you ordered) or a shop receipt (what you bought).
function receipt(post, lines, kind = 'till') {
  if (!lines?.length) return null;
  const total = totalOf(lines);
  const t = when(post);
  const shop = kind === 'shop';
  return h(
    'div',
    { class: 'receipt-wrap' + (shop ? ' shop' : '') },
    h(
      'div',
      { class: 'receipt' + (shop ? ' shop' : ''), role: 'group', 'aria-label': shop ? 'What I bought' : 'What I ordered' },
      shop ? h('span', { class: 'rc-bag', 'aria-hidden': 'true' }) : null,
      h('strong', { class: 'rc-name' }, (post.title || 'Receipt').toUpperCase()),
      post.city ? h('span', { class: 'rc-sub' }, post.city.toUpperCase()) : null,
      h('span', { class: 'rc-sub' }, `${t.day}  ${t.time}`),
      shop ? h('span', { class: 'rc-sub' }, `SALE  ·  NO. ${serial(post, 'shop')}`) : null,
      h('span', { class: 'rc-rule', 'aria-hidden': 'true' }),
      lineList('rc-items', lines),
      h('span', { class: 'rc-rule', 'aria-hidden': 'true' }),
      shop ? h('div', { class: 'rc-count' }, h('span', null, 'ITEMS'), h('span', null, String(lines.length))) : null,
      total != null ? h('div', { class: 'rc-total' }, h('span', null, shop ? 'PAID' : 'TOTAL'), h('span', null, total)) : null,
      h('span', { class: 'rc-thanks' }, shop ? 'PLEASE KEEP YOUR RECEIPT' : 'THANK YOU · COME AGAIN'),
      h('span', { class: 'rc-barcode', 'aria-hidden': 'true' })
    )
  );
}

// An entry ticket, with a tear-off stub.
function entryTicket(post) {
  if (!post.tickets) return null;
  const t = when(post);
  const total = post.tickets.length > 1 ? totalOf(post.tickets) : null;
  return h(
    'div',
    { class: 'ticket-wrap entry', style: { '--band': post.category ? catColor(post.category) : '#8a1a1a' } },
    h(
      'div',
      { class: 'entry-ticket', role: 'group', 'aria-label': 'Entry ticket' },
      h(
        'div',
        { class: 'et-main' },
        h('span', { class: 'et-kind' }, 'ADMISSION'),
        h('strong', { class: 'et-name' }, post.title || 'Admission'),
        h('span', { class: 'et-sub' }, [post.city, t.day].filter(Boolean).join(' · ')),
        post.tickets.length ? lineList('et-lines', post.tickets) : h('span', { class: 'et-admit' }, 'ADMIT ONE'),
        total ? h('span', { class: 'et-total' }, total) : null
      ),
      h('div', { class: 'et-stub', 'aria-hidden': 'true' }, h('span', { class: 'et-stub-word' }, 'ADMIT ONE'), h('span', { class: 'et-no' }, 'Nº ' + serial(post, 'entry')))
    )
  );
}

// A small card travel ticket, the kind a machine stamps and a guard clips.
function travelTicket(post) {
  if (!post.rides) return null;
  const t = when(post);
  return h(
    'div',
    { class: 'ticket-wrap ride' },
    h(
      'div',
      { class: 'ride-ticket', role: 'group', 'aria-label': 'Travel ticket' },
      h('span', { class: 'rt-top' }, h('span', null, 'TRAVEL'), h('span', null, t.day)),
      h('strong', { class: 'rt-name' }, (post.city || post.title || 'Anywhere').toUpperCase()),
      post.rides.length ? lineList('rt-lines', post.rides) : h('span', { class: 'rt-plain' }, 'VALID TODAY ONLY'),
      h('span', { class: 'rt-foot' }, h('span', null, 'Nº ' + serial(post, 'ride')), h('span', null, 'NOT TRANSFERABLE'))
    )
  );
}

const longDay = (post) => new Date(post.ts || Date.now()).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDay = (post) => new Date(post.ts || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
const plainLines = (cls, lines) => h('ul', { class: cls }, lines.map((o) => h('li', null, o.item, o.price ? h('span', { class: 'kl-price' }, ' · ' + o.price) : null)));

// An exhibition ticket: a clean white card, a bold block of colour, a hole for the lanyard.
function galleryTicket(post) {
  if (!post.gallery) return null;
  return h(
    'div',
    { class: 'ticket-wrap gallery', style: { '--band': post.category ? catColor(post.category) : '#e2552b' } },
    h(
      'div',
      { class: 'gallery-ticket', role: 'group', 'aria-label': 'Gallery ticket' },
      h('span', { class: 'gt-blob', 'aria-hidden': 'true' }),
      h('span', { class: 'gt-kind' }, 'EXHIBITION'),
      h('strong', { class: 'gt-name' }, post.title || 'Exhibition'),
      h('span', { class: 'gt-sub' }, [post.city, shortDay(post)].filter(Boolean).join(' — ')),
      post.gallery.length ? plainLines('gt-lines', post.gallery) : null,
      h('span', { class: 'gt-foot' }, 'ONE VISITOR · PLEASE KEEP')
    )
  );
}

// A theatre ticket: red and gold, the stalls, a stub to tear.
function theatreTicket(post) {
  if (!post.theatre) return null;
  return h(
    'div',
    { class: 'ticket-wrap theatre' },
    h(
      'div',
      { class: 'theatre-ticket', role: 'group', 'aria-label': 'Theatre ticket' },
      h('div', { class: 'tt-stub', 'aria-hidden': 'true' }, h('span', null, '★ ADMIT ONE ★')),
      h(
        'div',
        { class: 'tt-main' },
        h('span', { class: 'tt-kind' }, '✦ TONIGHT ✦'),
        h('strong', { class: 'tt-name' }, post.title || 'The Show'),
        h('span', { class: 'tt-sub' }, [post.city, longDay(post)].filter(Boolean).join(' · ')),
        post.theatre.length ? plainLines('tt-lines', post.theatre) : h('span', { class: 'tt-plain' }, 'Doors open at seven'),
        h('span', { class: 'tt-no' }, 'Nº ' + serial(post, 'theatre'))
      )
    )
  );
}

// An invitation: a deckle-edged card, handwritten, with a wax seal.
function invitation(post) {
  if (!post.invite) return null;
  return h(
    'div',
    { class: 'ticket-wrap invite' },
    h(
      'div',
      { class: 'invite-card', role: 'group', 'aria-label': 'Invitation' },
      h('span', { class: 'iv-hand' }, "You're invited"),
      h('span', { class: 'iv-to' }, 'to'),
      h('strong', { class: 'iv-name' }, post.title || 'a little get-together'),
      h('span', { class: 'iv-when' }, longDay(post)),
      post.city ? h('span', { class: 'iv-where' }, post.city) : null,
      post.invite.length ? plainLines('iv-lines', post.invite) : null,
      h('span', { class: 'iv-rsvp' }, 'R.S.V.P.'),
      h('span', { class: 'iv-seal', 'aria-hidden': 'true' })
    )
  );
}

// A boarding pass to the place: just the place and the day (no flight numbers, seats or codes).
function boardingPass(post) {
  if (!post.boarding) return null;
  const to = (post.city || post.title || 'Somewhere').toUpperCase();
  return h(
    'div',
    { class: 'ticket-wrap boarding' },
    h(
      'div',
      { class: 'boarding-pass', role: 'group', 'aria-label': 'Boarding pass' },
      h('div', { class: 'bp-head' }, h('span', { class: 'bp-plane', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" fill="currentColor"/></svg>' }), h('span', null, 'BOARDING PASS')),
      h(
        'div',
        { class: 'bp-body' },
        h('span', { class: 'bp-label' }, 'TO'),
        h('strong', { class: 'bp-to' }, to),
        h('span', { class: 'bp-label' }, 'DATE'),
        h('span', { class: 'bp-date' }, shortDay(post)),
        post.boarding.length ? plainLines('bp-lines', post.boarding) : null
      ),
      h('span', { class: 'bp-code', 'aria-hidden': 'true' })
    )
  );
}

// The first line, if it's a number (a room, a coat-check ticket); otherwise one of our own.
const numberFrom = (lines, post, salt, max) => {
  const m = /^\s*(?:no\.?|nº|#|room)?\s*(\d{1,4})\s*$/i.exec(lines[0]?.item || '');
  return { n: m ? m[1] : String((hashText(post.slug + salt) % max) + 1), rest: m ? lines.slice(1) : lines };
};
const wrapOf = (kind, aria, ...kids) => h('div', { class: 'ticket-wrap ' + kind }, h('div', { class: 'ks ks-' + kind, role: 'group', 'aria-label': aria }, ...kids));

// A cinema stub: pink card, ADMIT ONE, the screen number.
function cinemaStub(post) {
  if (!post.cinema) return null;
  return wrapOf('cinema', 'Cinema ticket',
    h('span', { class: 'cs-admit' }, 'ADMIT ONE'),
    h('strong', { class: 'cs-name' }, (post.title || 'Picture house').toUpperCase()),
    h('span', { class: 'cs-sub' }, `SCREEN ${(hashText(post.slug) % 9) + 1} · ${shortDay(post)}`),
    post.cinema.length ? lineList('cs-lines', post.cinema) : null,
    h('span', { class: 'cs-no' }, 'Nº ' + serial(post, 'cinema')));
}

// A cloakroom ticket: a big number on a little raffle stub.
function cloakroomTicket(post) {
  if (!post.cloakroom) return null;
  const { n, rest } = numberFrom(post.cloakroom, post, 'coat', 250);
  return wrapOf('cloakroom', 'Cloakroom ticket',
    h('span', { class: 'ck-kind' }, 'CLOAKROOM'),
    h('strong', { class: 'ck-no' }, n),
    rest.length ? plainLines('ck-lines', rest) : h('span', { class: 'ck-sub' }, post.title || ''),
    h('span', { class: 'ck-foot' }, 'KEEP THIS HALF'));
}

// A wristband, torn off at the end of the night.
function wristband(post) {
  if (!post.wristband) return null;
  const words = [post.title || 'All access', shortDay(post), ...post.wristband.map((o) => o.item)].join('  ★  ');
  return wrapOf('wristband', 'Wristband', h('span', { class: 'wb-snap', 'aria-hidden': 'true' }), h('span', { class: 'wb-text' }, words.toUpperCase()));
}

// Painted fronts for postcards without a photo of their own.
const SKY = (a, b) => `<defs><linearGradient id="pcs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="200" fill="url(#pcs)"/>`;
const SCENES = {
  seaside: () => `${SKY('#f6a96b', '#f7d79a')}<circle cx="222" cy="62" r="24" fill="#ffe9a8"/><rect y="104" width="300" height="96" fill="#3f8fb3"/><rect y="104" width="300" height="10" fill="#7cc0d8"/><path d="M0 150q20-6 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0" stroke="#9fd3e6" stroke-width="2" fill="none" opacity=".6"/><path d="M0 200V170q60-14 120 0t180-4V200z" fill="#f1d8a0"/>`,
  city: () => `${SKY('#7fb8e6', '#f3d9b0')}<circle cx="60" cy="50" r="18" fill="#fff3c4"/><g fill="#5a6b85"><rect x="10" y="98" width="34" height="102"/><rect x="48" y="70" width="26" height="130"/><rect x="78" y="110" width="40" height="90"/><rect x="122" y="56" width="22" height="144"/><rect x="128" y="40" width="10" height="16"/><rect x="148" y="92" width="36" height="108"/><rect x="188" y="78" width="28" height="122"/><rect x="220" y="104" width="44" height="96"/><rect x="268" y="86" width="30" height="114"/></g><g fill="#3e4a5e"><rect x="0" y="140" width="300" height="60"/></g><g fill="#ffd877" opacity=".85">${Array.from({ length: 40 }, (_, k) => `<rect x="${14 + (k * 37) % 280}" y="${104 + (k * 23) % 90}" width="4" height="5"/>`).join('')}</g>`,
  countryside: () => `${SKY('#9fd0f0', '#e9f4d8')}<circle cx="240" cy="48" r="20" fill="#fff6c8"/><path d="M0 120q60-40 130-10t170-20V200H0z" fill="#9cc86a"/><path d="M0 150q80-34 160-6t140-8V200H0z" fill="#7bb04e"/><path d="M0 178q90-24 180 0t120-4V200H0z" fill="#5f9a3a"/><g stroke="#8a6a3a" stroke-width="2"><path d="M20 176v-14M44 172v-14M68 170v-14M8 166h70"/></g><circle cx="200" cy="128" r="9" fill="#4f8a32"/><rect x="198.5" y="134" width="3" height="8" fill="#6a4a2a"/>`,
  forest: () => `${SKY('#cfe3d8', '#eef3e6')}<g fill="#7fa58c">${Array.from({ length: 9 }, (_, k) => `<path d="M${k * 36 - 6} 140l22-60 22 60z"/>`).join('')}</g><g fill="#3f6e4f">${Array.from({ length: 8 }, (_, k) => `<path d="M${k * 40 + 4} 176l26-80 26 80z"/>`).join('')}</g><g fill="#24493a">${Array.from({ length: 7 }, (_, k) => `<path d="M${k * 48 - 14} 200l30-90 30 90z"/>`).join('')}</g>`,
  mountains: () => `${SKY('#6fa7e0', '#d7ecfa')}<path d="M-10 160L70 50l50 60 40-70 70 90 40-40 50 70V200H-10z" fill="#7d8fa8"/><path d="M70 50l18 26-12-4-10 10-12-8zM160 40l20 28-14-6-8 8-12-6zM270 80l12 16-10-4-6 6z" fill="#fff"/><path d="M0 170q80-30 160-4t140-6V200H0z" fill="#6f9a5a"/>`,
  lakeside: () => `${SKY('#f2b07a', '#f6dcb2')}<circle cx="150" cy="78" r="22" fill="#ffe7a6"/><path d="M0 104q50-40 100-14t90-10 110 4V108H0z" fill="#5f7d6a"/><rect y="106" width="300" height="94" fill="#86b6c8"/><circle cx="150" cy="134" r="22" fill="#ffe7a6" opacity=".45"/><path d="M0 106q50 30 100 10t90 8 110-4" fill="#5f7d6a" opacity=".35"/><path d="M110 150h80M130 162h40M90 140h120" stroke="#cfe6ee" stroke-width="2" opacity=".7"/>`
};
// Which painting suits the place, unless you chose one.
const SCENE_FOR = { food: 'city', coffee: 'city', drinks: 'city', shopping: 'city', culture: 'city', sights: 'city', nature: 'forest', stays: 'countryside' };
const sceneSvg = (name) => `<svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">${(SCENES[name] || SCENES.seaside)()}</svg>`;

// Long names get smaller letters rather than breaking in the middle of a word.
const greetSize = (name) => (name.length > 16 ? '14px' : name.length > 12 ? '17px' : name.length > 9 ? '20px' : '24px');
// A postcard: greetings from the place on the front (your photo, or a painted sky), your note
// and a postmark on the back. Tap to turn it over.
function postcard(post) {
  if (!post.postcard) return null;
  // Your first photo here, unless you picked a painted scene; with no photo, a painting that
  // suits the place.
  const chosen = SCENES[post.postcard_scene] ? post.postcard_scene : null;
  const photo = chosen ? null : post.photos?.[0];
  const scene = chosen || SCENE_FOR[post.category] || 'seaside';
  const card = h(
    'button',
    { type: 'button', class: 'pc-card', 'aria-label': 'Postcard: tap to turn it over', onclick: () => card.classList.toggle('over') },
    h('span', { class: 'pc-front' + (photo ? '' : ' painted') }, photo ? h('img', { src: photo, alt: '', loading: 'lazy' }) : h('span', { class: 'pc-scene', html: sceneSvg(scene) }), h('span', { class: 'pc-greet' }, h('small', null, 'Greetings from'), h('b', { style: { fontSize: greetSize(post.city || post.title || 'here') } }, (post.city || post.title || 'here').toUpperCase()))),
    h(
      'span',
      { class: 'pc-back' },
      h('span', { class: 'pc-note' }, post.postcard.length ? post.postcard.map((o) => h('span', null, o.item)) : h('span', null, 'Wish you were here!')),
      h('span', { class: 'pc-side' }, h('span', { class: 'pc-stamp', 'aria-hidden': 'true' }), h('span', { class: 'pc-mark' }, post.city || 'POST', h('small', null, shortDay(post))), h('span', { class: 'pc-lines', 'aria-hidden': 'true' }))
    )
  );
  return h('div', { class: 'ticket-wrap postcard' }, card);
}

// A fortune cookie slip, with lucky numbers.
const FORTUNES = ['A journey will bring you joy.', 'You will find what you are looking for in an unexpected place.', 'Good food is coming your way.', 'An old friend will make you smile.', 'Your next adventure is closer than you think.', 'Say yes to the window seat.'];
function fortuneSlip(post) {
  if (!post.fortune) return null;
  const text = post.fortune[0]?.item || FORTUNES[hashText(post.slug) % FORTUNES.length];
  const nums = [7, 13, 21, 29, 34, 42].map((k) => ((hashText(post.slug + k) % 49) + 1)).slice(0, 5).join(' ');
  return wrapOf('fortune', 'Fortune', h('span', { class: 'fs-text' }, text), h('span', { class: 'fs-nums' }, 'Lucky numbers ' + nums));
}

// A luggage tag on a string, written by hand.
function luggageTag(post) {
  if (!post.luggage) return null;
  return wrapOf('luggage', 'Luggage tag',
    h('span', { class: 'lt-hole', 'aria-hidden': 'true' }),
    h('span', { class: 'lt-label' }, 'TO'),
    h('strong', { class: 'lt-to' }, post.city || post.title || 'Somewhere nice'),
    post.luggage.length ? plainLines('lt-lines', post.luggage) : null,
    h('span', { class: 'lt-date' }, shortDay(post)));
}

// A matchbook from the bar, flap closed, striker along the bottom.
function matchbook(post) {
  if (!post.matchbook) return null;
  return wrapOf('matchbook', 'Matchbook',
    h('span', { class: 'mb-flap', 'aria-hidden': 'true' }),
    h('strong', { class: 'mb-name' }, post.title || 'The Bar'),
    post.city ? h('span', { class: 'mb-city' }, post.city) : null,
    post.matchbook.length ? plainLines('mb-lines', post.matchbook) : null,
    h('span', { class: 'mb-strike', 'aria-hidden': 'true' }));
}

// A beer mat, with a ring where the glass stood.
function coaster(post) {
  if (!post.coaster) return null;
  return wrapOf('coaster', 'Coaster',
    h('span', { class: 'co-ring', 'aria-hidden': 'true' }),
    h('strong', { class: 'co-name' }, post.title || 'Cheers'),
    post.coaster.length ? plainLines('co-lines', post.coaster) : h('span', { class: 'co-lines' }, 'CHEERS!'),
    h('span', { class: 'co-city' }, (post.city || '').toUpperCase()));
}

// A room key on its tag.
function roomKey(post) {
  if (!post.roomkey) return null;
  const { n, rest } = numberFrom(post.roomkey, post, 'room', 60);
  return wrapOf('roomkey', 'Room key',
    h('span', { class: 'rk-key', 'aria-hidden': 'true', html: '<svg viewBox="0 0 120 40" width="120" height="40"><defs><linearGradient id="rkb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3d27a"/><stop offset=".5" stop-color="#c79a3a"/><stop offset="1" stop-color="#8a6420"/></linearGradient></defs><circle cx="18" cy="20" r="14" fill="none" stroke="url(#rkb)" stroke-width="6"/><rect x="30" y="16" width="80" height="8" rx="2" fill="url(#rkb)"/><path d="M92 24h6v9h-6zM102 24h5v6h-5z" fill="url(#rkb)"/></svg>' }),
    h('span', { class: 'rk-tag' }, h('small', null, (post.title || 'Hotel').toUpperCase()), h('b', null, n), rest.length ? h('small', null, rest.map((o) => o.item).join(' · ')) : null));
}

// A flower pressed between the pages, with a note beside it.
function pressedFlower(post) {
  if (!post.flower) return null;
  const hue = hashText(post.slug + 'f') % 360;
  const petals = Array.from({ length: 6 }, (_, k) => `<ellipse cx="40" cy="22" rx="7" ry="13" transform="rotate(${k * 60} 40 34)" fill="hsl(${hue} 55% 68% / .78)" stroke="hsl(${hue} 40% 45% / .5)"/>`).join('');
  const svg = `<svg viewBox="0 0 80 120" width="80" height="120"><path d="M40 40 C38 70 44 90 40 118" stroke="#6f8a4a" stroke-width="2.5" fill="none"/><ellipse cx="31" cy="78" rx="12" ry="5" transform="rotate(-35 31 78)" fill="#86a35c" opacity=".8"/><ellipse cx="50" cy="94" rx="11" ry="4.5" transform="rotate(30 50 94)" fill="#86a35c" opacity=".8"/>${petals}<circle cx="40" cy="34" r="5" fill="hsl(${(hue + 40) % 360} 70% 55%)"/></svg>`;
  return wrapOf('flower', 'Pressed flower', h('span', { class: 'pf-art', 'aria-hidden': 'true', html: svg }), h('span', { class: 'pf-note' }, post.flower.length ? post.flower.map((o) => h('span', null, o.item)) : h('span', null, post.title || 'from here')));
}

// ---- Outdoors ----
const firstWords = (lines) => lines.map((o) => o.item);
// A campsite pitch tag, clipped to the tent.
function pitchKeepsake(post) {
  const { n, rest } = numberFrom(post.pitch, post, 'pitch', 80);
  return wrapOf('pitch', 'Campsite pitch tag', h('span', { class: 'pt-hole', 'aria-hidden': 'true' }), h('span', { class: 'pt-kind' }, 'PITCH'), h('strong', { class: 'pt-no' }, n), h('span', { class: 'pt-name' }, post.title || 'Campsite'), rest.length ? plainLines('pt-lines', rest) : h('span', { class: 'pt-lines' }, shortDay(post)));
}
// A torn corner of an old map: contour lines, a dotted route and an X.
function trailmapKeepsake(post) {
  const x = 30 + (hashText(post.slug) % 50);
  const svg = `<svg viewBox="0 0 200 140" width="100%" height="100%" preserveAspectRatio="none"><g fill="none" stroke="#b9a274" stroke-width="1">${[18, 32, 46, 60, 74].map((r) => `<ellipse cx="${x + 40}" cy="70" rx="${r * 1.4}" ry="${r}"/>`).join('')}</g><path d="M8 120 C40 100 60 112 80 90 S120 60 ${x + 40} 70" stroke="#c0392b" stroke-width="2.4" stroke-dasharray="5 5" fill="none"/><path d="M${x + 33} 63l14 14M${x + 47} 63l-14 14" stroke="#c0392b" stroke-width="3"/><path d="M160 20l8-14 8 14" fill="none" stroke="#5a4632" stroke-width="1.5"/><text x="168" y="30" font-size="9" text-anchor="middle" fill="#5a4632">N</text></svg>`;
  return wrapOf('trailmap', 'Trail map', h('span', { class: 'tm-map', 'aria-hidden': 'true', html: svg }), h('span', { class: 'tm-note' }, h('b', null, post.title || 'here'), ...firstWords(post.trailmap).map((t) => h('span', null, t))));
}
// A national park day pass.
function parkpassKeepsake(post) {
  return wrapOf('parkpass', 'Park pass',
    h('span', { class: 'pp-band', 'aria-hidden': 'true', html: '<svg viewBox="0 0 200 40" width="100%" height="40" preserveAspectRatio="none"><path d="M0 40L30 14l18 14 26-22 30 26 22-14 34 22 18-10 22 10V40z" fill="#2f5d3a"/><path d="M74 6l8 7-8-2-8 3z" fill="#fff"/></svg>' }),
    h('span', { class: 'pp-kind' }, 'PARK PASS'), h('strong', { class: 'pp-name' }, post.title || 'The park'), h('span', { class: 'pp-sub' }, shortDay(post) + ' · VALID ONE DAY'),
    post.parkpass.length ? plainLines('pp-lines', post.parkpass) : null);
}
// An embroidered patch: the place stitched round the top, a little scene in the middle.
function patchKeepsake(post) {
  const id = 'pt' + (hashText(post.slug) % 100000);
  const name = esc((post.title || post.city || 'Outdoors').toUpperCase().slice(0, 22));
  const under = esc(post.patch[0]?.item || String(new Date(post.ts || Date.now()).getFullYear()));
  const svg = `<svg viewBox="0 0 140 140" width="140" height="140"><defs><path id="${id}" d="M22 70a48 48 0 0 1 96 0"/></defs><circle cx="70" cy="70" r="66" fill="#2b4a6b"/><circle cx="70" cy="70" r="61" fill="none" stroke="#f2e2b0" stroke-width="2" stroke-dasharray="3 3"/><circle cx="70" cy="70" r="40" fill="#f6c46b"/><circle cx="84" cy="58" r="9" fill="#fff3c4"/><path d="M30 92l22-28 14 16 14-20 30 32z" fill="#3f7a4f"/><path d="M52 64l6 8-6-2-6 3z" fill="#fff"/><path d="M30 92h80a40 40 0 0 1-80 0z" fill="#2f5d3a"/><text font-size="11" font-weight="700" fill="#f2e2b0" letter-spacing="2" font-family="Oswald, sans-serif"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${name}</textPath></text><text x="70" y="124" font-size="10" fill="#f2e2b0" text-anchor="middle" font-family="Oswald, sans-serif" letter-spacing="2">${under}</text></svg>`;
  return wrapOf('patch', 'Woven patch', h('span', { class: 'pa-art', 'aria-hidden': 'true', html: svg }));
}
// A round summit sticker.
function summitKeepsake(post) {
  return wrapOf('summit', 'Summit sticker', h('span', { class: 'su-peak', 'aria-hidden': 'true', html: '<svg viewBox="0 0 80 40" width="80" height="40"><path d="M2 38L30 6l12 14 8-8 28 26z" fill="#5a3a1a"/><path d="M30 6l7 8-7-2-6 3z" fill="#fff"/><path d="M30 6V-6l12 5-12 4" fill="#c0392b"/></svg>' }), h('strong', { class: 'su-top' }, post.summit[0]?.item ? 'MADE IT!' : 'I MADE IT TO THE TOP!'), h('span', { class: 'su-name' }, (post.title || '').toUpperCase()), post.summit.length ? h('span', { class: 'su-line' }, firstWords(post.summit).join(' · ')) : null);
}
// A wooden fingerpost pointing to the place.
function signpostKeepsake(post) {
  return wrapOf('signpost', 'Trail signpost', h('span', { class: 'sp-arm' }, h('b', null, post.title || post.city || 'This way'), post.signpost[0] ? h('small', null, post.signpost[0].item) : null), h('span', { class: 'sp-post', 'aria-hidden': 'true' }));
}
// A leaf, or a feather, picked up on the way.
function leafKeepsake(post) {
  const feather = post.leaf.some((o) => /feather/i.test(o.item));
  const hue = [18, 32, 45, 8][hashText(post.slug) % 4];
  const art = feather
    ? '<svg viewBox="0 0 60 130" width="60" height="130"><path d="M30 128C30 90 28 40 34 4" stroke="#7a6a58" stroke-width="2" fill="none"/><path d="M33 8C50 30 52 70 31 104C20 80 18 40 33 8z" fill="#c9c2b6" opacity=".9"/><path d="M33 20l-10 8M33 34l-12 8M32 48l-13 9M32 62l-12 9M31 76l-10 8M34 26l9 8M33 40l11 9M33 54l11 9M32 68l10 8" stroke="#a49a8a" stroke-width="1"/></svg>'
    : `<svg viewBox="0 0 100 110" width="90" height="100"><path d="M50 104V60" stroke="hsl(${hue} 50% 30%)" stroke-width="2.5"/><path d="M50 62L22 70l6-14-20-6 18-8-8-18 20 8 4-22 8 14 8-14 4 22 20-8-8 18 18 8-20 6 6 14z" fill="hsl(${hue} 75% 48%)" stroke="hsl(${hue} 55% 32%)" stroke-width="1.2"/><path d="M50 62V14M50 40L32 26M50 40l18-14M50 52L26 46M50 52l24-6" stroke="hsl(${hue} 55% 32%)" stroke-width="1" fill="none"/></svg>`;
  return wrapOf('leaf', feather ? 'Feather' : 'Leaf', h('span', { class: 'lf-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, post.leaf.length ? firstWords(post.leaf).map((t) => h('span', null, t)) : h('span', null, post.title || 'from the path')));
}
// A toasted marshmallow on a stick.
function marshmallowKeepsake(post) {
  const art = '<svg viewBox="0 0 150 60" width="150" height="60"><path d="M4 50L100 26" stroke="#8a6a3a" stroke-width="4" stroke-linecap="round"/><rect x="96" y="12" width="40" height="30" rx="9" transform="rotate(-14 116 27)" fill="#f7ead2"/><rect x="96" y="12" width="40" height="30" rx="9" transform="rotate(-14 116 27)" fill="url(#mm)" opacity=".9"/><defs><radialGradient id="mm" cx=".5" cy=".7" r=".7"><stop offset="0" stop-color="#e3a24c"/><stop offset=".6" stop-color="#b8692a"/><stop offset="1" stop-color="#5a2e12"/></radialGradient></defs></svg>';
  return wrapOf('marshmallow', 'Toasted marshmallow', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, post.marshmallow.length ? firstWords(post.marshmallow).map((t) => h('span', null, t)) : h('span', null, 'Perfectly golden. Mostly.')));
}
// A little card of the day's tides.
function tidesKeepsake(post) {
  return wrapOf('tides', 'Tide times', h('span', { class: 'td-kind' }, 'TIDE TIMES'), h('strong', { class: 'td-name' }, post.city || post.title || 'The coast'), h('span', { class: 'td-day' }, longDay(post)),
    post.tides.length ? plainLines('td-lines', post.tides) : null,
    h('span', { class: 'td-wave', 'aria-hidden': 'true', html: '<svg viewBox="0 0 160 30" width="100%" height="30" preserveAspectRatio="none"><path d="M0 15C20 0 40 0 60 15S100 30 120 15 150 0 160 8" stroke="#2a6fa8" stroke-width="2.5" fill="none"/></svg>' }));
}
// A brass compass, the needle pointing the way it was.
const POINTS = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5 };
function compassKeepsake(post) {
  const said = (post.compass[0]?.item || '').trim().toUpperCase();
  const deg = POINTS[said] ?? (hashText(post.slug) % 360);
  const svg = `<svg viewBox="0 0 120 120" width="120" height="120"><defs><radialGradient id="cb" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#f3d27a"/><stop offset=".6" stop-color="#c79a3a"/><stop offset="1" stop-color="#7a5418"/></radialGradient></defs><circle cx="60" cy="60" r="56" fill="url(#cb)"/><circle cx="60" cy="60" r="46" fill="#f8f1dc"/><g font-family="Oswald, sans-serif" font-size="11" fill="#3a2c1c" text-anchor="middle"><text x="60" y="26">N</text><text x="96" y="64">E</text><text x="60" y="102">S</text><text x="24" y="64">W</text></g><g transform="rotate(${deg} 60 60)"><path d="M60 22l7 38h-14z" fill="#c0392b"/><path d="M60 98l7-38h-14z" fill="#3a3a3a"/></g><circle cx="60" cy="60" r="4" fill="#7a5418"/></svg>`;
  return wrapOf('compass', 'Compass', h('span', { class: 'cp-art', 'aria-hidden': 'true', html: svg }), h('span', { class: 'pf-note' }, h('span', null, post.title || ''), said && POINTS[said] != null ? h('span', null, 'heading ' + said) : null, ...firstWords(post.compass.slice(said && POINTS[said] != null ? 1 : 0)).map((t) => h('span', null, t))));
}

// ---- Books, films, TV, podcasts and music ----
const creatorOf = (post) => post.creator || '';
// A bookmark with a tassel.
function bookmarkKeepsake(post) {
  return wrapOf('bookmark', 'Bookmark', h('span', { class: 'bm-tassel', 'aria-hidden': 'true' }), h('span', { class: 'bm-body' }, h('b', null, post.title || ''), post.bookmark.length ? firstWords(post.bookmark).map((t) => h('em', null, t)) : h('em', null, '— read to here —')));
}
// The card from the pocket inside a library book, stamped with due dates.
function librarycardKeepsake(post) {
  const stamps = post.librarycard.length ? firstWords(post.librarycard) : [0, 1, 2].map((k) => new Date((post.ts || Date.now()) - (2 - k) * 86400000 * 21).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase());
  return wrapOf('librarycard', 'Library card', h('span', { class: 'lc-head' }, 'DATE DUE'), h('strong', { class: 'lc-title' }, post.title || ''), h('ul', { class: 'lc-stamps' }, stamps.map((d, k) => h('li', { style: { '--r': (k % 2 ? 2 : -3) + 'deg' } }, d))));
}
// An ex libris bookplate.
function bookplateKeepsake(post) {
  const who = post.bookplate[0]?.item || '';
  return wrapOf('bookplate', 'Bookplate', h('span', { class: 'bp2-ex' }, 'Ex Libris'), h('span', { class: 'bp2-orn', 'aria-hidden': 'true' }, '❦'), who ? h('strong', { class: 'bp2-who' }, who) : h('strong', { class: 'bp2-who' }, 'from my shelf'), ...firstWords(post.bookplate.slice(1)).map((t) => h('span', { class: 'bp2-line' }, t)));
}
// A sticky note stuck on.
function noteKeepsake(post) {
  return wrapOf('note', 'Note', h('span', { class: 'sn-text' }, post.note.length ? firstWords(post.note).map((t) => h('span', null, t)) : h('span', null, 'Must remember this one.')));
}
// A striped popcorn box.
function popcornKeepsake(post) {
  return wrapOf('popcorn', 'Popcorn', h('span', { class: 'pc2-pop', 'aria-hidden': 'true' }), h('span', { class: 'pc2-box' }, h('b', null, 'POPCORN'), post.popcorn[0] ? h('small', null, post.popcorn[0].item) : null));
}
// Cardboard 3D glasses.
function glasses3dKeepsake(post) {
  const art = '<svg viewBox="0 0 160 60" width="150" height="56"><path d="M4 14h152v10l-6 26H96l-10-14h-12l-10 14H10L4 24z" fill="#f4f1e8" stroke="#2a2a2a" stroke-width="2"/><path d="M14 22h52l-6 22H20z" fill="#e2322b" opacity=".85"/><path d="M94 22h52l-6 22H100z" fill="#2aa7d6" opacity=".85"/></svg>';
  return wrapOf('glasses3d', '3D glasses', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, post.glasses3d.length ? firstWords(post.glasses3d).map((t) => h('span', null, t)) : h('span', null, 'Ducked twice.')));
}
// A video shop rental sticker.
function rentalKeepsake(post) {
  return wrapOf('rental', 'Video rental sticker', h('span', { class: 'rn-shop' }, 'VIDEO CLUB'), h('strong', { class: 'rn-big' }, 'BE KIND, REWIND'), h('span', { class: 'rn-line' }, post.rental[0]?.item || 'Please return by 7pm'));
}
// A TV guide clipping, the show circled in pen.
function tvguideKeepsake(post) {
  const rows = post.tvguide.length ? firstWords(post.tvguide) : ['8.00 News', '8.30 Quiz night'];
  return wrapOf('tvguide', 'TV guide', h('span', { class: 'tg-head' }, 'TONIGHT'), h('ul', { class: 'tg-rows' }, rows.map((r, k) => h('li', null, r)), h('li', { class: 'tg-circled' }, (post.title || 'The show'))));
}
// A chunky old remote.
function remoteKeepsake(post) {
  const art = '<svg viewBox="0 0 50 130" width="46" height="120"><rect x="4" y="2" width="42" height="126" rx="12" fill="#2b2b2b"/><circle cx="25" cy="18" r="6" fill="#d23a2a"/><g fill="#6a6a6a">' + [0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => `<rect x="${11 + c * 10}" y="${36 + r * 14}" width="7" height="8" rx="2"/>`).join('')).join('') + '</g><rect x="14" y="96" width="22" height="22" rx="11" fill="#4a4a4a"/></svg>';
  return wrapOf('remote', 'Remote control', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, post.remote.length ? firstWords(post.remote).map((t) => h('span', null, t)) : h('span', null, 'Just one more episode.')));
}
// A pair of headphones.
function headphonesKeepsake(post) {
  const art = '<svg viewBox="0 0 100 90" width="90" height="80"><path d="M14 56V44a36 36 0 0 1 72 0v12" stroke="#2b2b2b" stroke-width="7" fill="none"/><rect x="6" y="50" width="20" height="32" rx="8" fill="#e8692c"/><rect x="74" y="50" width="20" height="32" rx="8" fill="#e8692c"/></svg>';
  return wrapOf('headphones', 'Headphones', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, post.headphones.length ? firstWords(post.headphones).map((t) => h('span', null, t)) : h('span', null, 'On repeat.')));
}
// A gig ticket.
function gigKeepsake(post) {
  return wrapOf('gig', 'Gig ticket', h('span', { class: 'gg-kind' }, 'LIVE'), h('strong', { class: 'gg-name' }, (creatorOf(post) || post.title || 'Live').toUpperCase()), creatorOf(post) && post.title ? h('span', { class: 'gg-sub' }, post.title) : null, h('span', { class: 'gg-sub' }, shortDay(post)), post.gig.length ? lineList('gg-lines', post.gig) : h('span', { class: 'gg-sub' }, 'GENERAL ADMISSION'), h('span', { class: 'gg-no' }, 'Nº ' + serial(post, 'gig')));
}
// A guitar pick.
function pickKeepsake(post) {
  return wrapOf('pick', 'Guitar pick', h('span', { class: 'gp-pick' }, h('b', null, (post.pick[0]?.item || creatorOf(post) || 'ROCK').slice(0, 14))));
}
// The setlist taped to the stage.
function setlistKeepsake(post) {
  const songs = post.setlist.length ? firstWords(post.setlist) : [post.title || 'Opener', '…', 'Encore'];
  return wrapOf('setlist', 'Setlist', h('span', { class: 'sl-head' }, (creatorOf(post) || 'SETLIST').toUpperCase()), h('ol', { class: 'sl-songs' }, songs.map((t) => h('li', null, t))));
}

// ---- More for books, the screen and music ----
const notes = (list, fallback) => (list.length ? firstWords(list) : [fallback]).map((t) => h('span', null, t));
const numberIn = (list, post, salt, max) => {
  const m = /(\d{1,4})/.exec(list[0]?.item || '');
  return m ? m[1] : String((hashText(post.slug + salt) % max) + 1);
};
function busticketKeepsake(post) {
  return wrapOf('busticket', 'Bus ticket', h('span', { class: 'bt-top' }, h('span', null, 'BUS'), h('span', null, 'SINGLE')), h('strong', { class: 'bt-fare' }, 'ADULT FARE'), h('span', { class: 'bt-line' }, post.busticket[0]?.item || 'Into town'), h('span', { class: 'bt-no' }, 'Nº ' + serial(post, 'bus') + ' · ' + shortDay(post)));
}
function coffeeringKeepsake(post) {
  return wrapOf('coffeering', 'Coffee ring', h('span', { class: 'cr-ring', 'aria-hidden': 'true' }), h('span', { class: 'cr-note' }, notes(post.coffeering, 'Oops.')));
}
function signatureKeepsake(post) {
  const to = post.signature[0]?.item || 'you';
  return wrapOf('signature', 'Signed card', h('span', { class: 'sg-to' }, `To ${to},`), h('span', { class: 'sg-wish' }, 'with best wishes'), h('span', { class: 'sg-name' }, post.creator || 'the author'), ...firstWords(post.signature.slice(1)).map((t) => h('span', { class: 'sg-line' }, t)));
}
function bookclubKeepsake(post) {
  return wrapOf('bookclub', 'Book club invite', h('span', { class: 'bc-kind' }, 'BOOK CLUB'), h('span', { class: 'bc-next' }, "Next month we're reading"), h('strong', { class: 'bc-title' }, post.title || 'something good'), post.creator ? h('span', { class: 'bc-by' }, 'by ' + post.creator) : null, ...firstWords(post.bookclub).map((t) => h('span', { class: 'bc-line' }, t)));
}
function dogearKeepsake(post) {
  return wrapOf('dogear', 'Dog-eared page', h('span', { class: 'de-lines', 'aria-hidden': 'true' }), h('span', { class: 'de-fold', 'aria-hidden': 'true' }), h('span', { class: 'de-page' }, 'p. ' + numberIn(post.dogear, post, 'page', 380)), post.dogear.length > 1 ? h('span', { class: 'de-note' }, post.dogear[1].item) : null);
}
function stubpairKeepsake(post) {
  const stub = (k) => h('span', { class: 'sp2-stub', style: { rotate: (k ? 7 : -5) + 'deg' } }, h('b', null, 'ADMIT ONE'), h('span', null, (post.title || '').toUpperCase()), h('small', null, 'SEAT ' + String.fromCharCode(70 + k) + (hashText(post.slug) % 20 + 1)));
  return wrapOf('stubpair', 'Ticket stubs for two', stub(0), stub(1), post.stubpair.length ? h('span', { class: 'pf-note' }, notes(post.stubpair, '')) : null);
}
function programmeKeepsake(post) {
  return wrapOf('programme', 'Cinema programme', h('span', { class: 'pg-panel' }, h('small', null, 'NOW SHOWING')), h('span', { class: 'pg-panel mid' }, h('b', null, post.title || 'Tonight'), post.creator ? h('small', null, 'a film by ' + post.creator) : null), h('span', { class: 'pg-panel' }, notes(post.programme, shortDay(post))));
}
function picknmixKeepsake(post) {
  return wrapOf('picknmix', "Pick 'n' mix", h('span', { class: 'pm-sweets', 'aria-hidden': 'true' }), h('span', { class: 'pm-bag' }, h('b', null, "PICK 'N' MIX"), h('small', null, post.picknmix[0]?.item || '100g')));
}
function driveinKeepsake(post) {
  return wrapOf('drivein', 'Drive-in speaker', h('span', { class: 'di-speaker', 'aria-hidden': 'true' }), h('span', { class: 'di-tag' }, h('b', null, 'BAY ' + numberIn(post.drivein, post, 'bay', 40)), h('small', null, (post.title || 'Drive-in').toUpperCase())));
}
function tallyKeepsake(post) {
  const n = Math.min(40, Number(numberIn(post.tally, post, 'tally', 1)) || (post.episodes?.length || 5));
  const gates = Array.from({ length: Math.ceil(n / 5) }, (_, k) => Math.min(5, n - k * 5));
  return wrapOf('tally', 'Binge tally', h('span', { class: 'ty-head' }, 'in one go:'), h('span', { class: 'ty-marks', 'aria-label': `${n} episodes` }, gates.map((g) => h('span', { class: 'ty-gate' + (g === 5 ? ' full' : '') }, '|'.repeat(Math.min(g, 4))))), h('span', { class: 'ty-n' }, `${n} episodes`));
}
function takeawayKeepsake(post) {
  const items = post.takeaway.length ? firstWords(post.takeaway) : ['Chips', 'Spring rolls', 'Noodles'];
  return wrapOf('takeaway', 'Takeaway menu', h('span', { class: 'tk2-head' }, 'TAKEAWAY · OPEN LATE'), h('ul', { class: 'tk2-items' }, items.map((t, k) => h('li', { class: k === 0 ? 'circled' : '' }, t))));
}
function nospoilKeepsake(post) {
  return wrapOf('nospoil', 'No spoilers', h('strong', { class: 'ns-big' }, 'NO SPOILERS!'), h('span', { class: 'sn-text' }, notes(post.nospoil, "I haven't finished it yet")));
}
function batteryKeepsake(post) {
  const art = '<svg viewBox="0 0 70 50" width="70" height="50"><rect x="4" y="4" width="62" height="42" rx="6" fill="#2b2b2b"/><path d="M14 18h42M14 26h42M14 34h42" stroke="#444" stroke-width="3"/><path d="M58 10l6 6" stroke="#555" stroke-width="3"/></svg>';
  return wrapOf('battery', 'Remote battery cover', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, notes(post.battery, 'Gone missing again.')));
}
function jcardKeepsake(post) {
  return wrapOf('jcard', 'Cassette J-card', h('span', { class: 'jc-spine' }, (post.title || 'TAPE').toUpperCase()), h('span', { class: 'jc-face' }, h('b', null, post.title || 'Untitled'), post.creator ? h('small', null, post.creator) : null, h('span', { class: 'jc-notes' }, notes(post.jcard, 'Side A: the good bits'))));
}
function walkmapKeepsake(post) {
  const svg = '<svg viewBox="0 0 200 110" width="100%" height="100%" preserveAspectRatio="none"><path d="M0 70Q50 40 100 60T200 50" stroke="#9ec98a" stroke-width="18" fill="none"/><circle cx="150" cy="30" r="16" fill="#8fc0e0"/><path d="M14 92C40 70 60 90 90 64S140 40 168 46" stroke="#c0392b" stroke-width="2.4" stroke-dasharray="5 5" fill="none"/><circle cx="14" cy="92" r="4" fill="#c0392b"/></svg>';
  return wrapOf('walkmap', 'Walk map', h('span', { class: 'wm-map', 'aria-hidden': 'true', html: svg }), h('span', { class: 'tm-note' }, h('b', null, 'listened on a walk'), ...firstWords(post.walkmap).map((t) => h('span', null, t))));
}
function napkinKeepsake(post) {
  return wrapOf('napkin', 'Napkin quote', h('span', { class: 'nk-text' }, notes(post.napkin, 'Write it down before you forget')), h('span', { class: 'nk-who' }, '— ' + (post.title || '')));
}
function vinyllabelKeepsake(post) {
  return wrapOf('vinyllabel', 'Record label', h('span', { class: 'vl-disc' }, h('span', { class: 'vl-label' }, h('b', null, post.title || ''), h('small', null, post.creator || ''), h('small', { class: 'vl-side' }, (post.vinyllabel[0]?.item || 'SIDE A').toUpperCase() + ' · 33⅓'))));
}
function mixtapeKeepsake(post) {
  const tracks = post.mixtape.length ? firstWords(post.mixtape) : [post.title || 'Track one', '…'];
  return wrapOf('mixtape', 'Mixtape label', h('span', { class: 'mx-title' }, 'for the car'), h('ol', { class: 'mx-tracks' }, tracks.map((t) => h('li', null, t))));
}
function backstageKeepsake(post) {
  return wrapOf('backstage', 'Backstage pass', h('span', { class: 'bs-strap', 'aria-hidden': 'true' }), h('span', { class: 'bs-card' }, h('b', null, 'BACKSTAGE'), h('strong', null, (post.creator || post.title || 'The band').toUpperCase()), h('small', null, (post.backstage[0]?.item || 'ALL ACCESS').toUpperCase()), h('small', null, shortDay(post))));
}
function lighterKeepsake(post) {
  const art = '<svg viewBox="0 0 40 90" width="40" height="90"><path d="M20 4C30 18 30 26 20 34C10 26 10 18 20 4z" fill="#ffb347"/><path d="M20 14C25 22 25 27 20 31C15 27 15 22 20 14z" fill="#fff3c4"/><rect x="10" y="38" width="20" height="8" rx="2" fill="#9a9a9a"/><rect x="8" y="46" width="24" height="42" rx="4" fill="#d6332b"/></svg>';
  return wrapOf('lighter', 'Lighter', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, notes(post.lighter, 'For the encore.')));
}

// ---- Events: gigs, festivals, weddings, races, fairs and nights out ----
// On a review the act is the artist, author or host (or the title); in the journal, the place.
const actOf = (post) => (post.type === 'places' ? post.title : creatorOf(post) || post.title) || '';
const pickOf = (post, salt, list) => list[hashText(post.slug + salt) % list.length];
// The words after a first line that set a colour or a number (or all of them, if it didn't).
const restAfter = (lines, used) => (used ? lines.slice(1) : lines);
// An ink stamp on the back of your hand, for getting back in.
function handstampKeepsake(post) {
  const word = (post.handstamp[0]?.item || '').slice(0, 12);
  return wrapOf('handstamp', 'Hand stamp', h('span', { class: 'hs-skin' }, h('span', { class: 'hs-stamp' }, h('small', null, (actOf(post) || 'Re-entry').toUpperCase().slice(0, 20)), h('b', null, word ? word.toUpperCase() : '★'))), post.handstamp.length > 1 ? h('span', { class: 'pf-note' }, notes(post.handstamp.slice(1), '')) : null);
}
const GLOW = { pink: '#ff4fb8', green: '#5dff6a', blue: '#4fc3ff', yellow: '#fff04f', orange: '#ff9a3c', purple: '#b26bff' };
function glowstickKeepsake(post) {
  const said = (post.glowstick[0]?.item || '').trim().toLowerCase();
  const c = GLOW[said] || pickOf(post, 'glow', Object.values(GLOW));
  const art = `<svg viewBox="0 0 34 140" width="30" height="124"><rect x="10" y="2" width="14" height="10" rx="3" fill="#ddd"/><rect x="8" y="10" width="18" height="124" rx="9" fill="${c}"/><rect x="12" y="16" width="4" height="108" rx="2" fill="#fff" opacity=".55"/></svg>`;
  return wrapOf('glowstick', 'Glow stick', h('span', { class: 'mm-art gs-art', style: { '--glow': c }, 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, notes(restAfter(post.glowstick, GLOW[said]), 'Danced till the lights came on.')));
}
// A paper race bib, pinned on at the corners.
function racebibKeepsake(post) {
  const { n, rest } = numberFrom(post.racebib, post, 'bib', 4000);
  return wrapOf('racebib', 'Race bib', ...[0, 1, 2, 3].map((k) => h('span', { class: 'rb-pin p' + k, 'aria-hidden': 'true' })), h('span', { class: 'rb-band' }, (post.title || 'Fun run').toUpperCase()), h('strong', { class: 'rb-no' }, n), h('span', { class: 'rb-lines' }, rest.length ? firstWords(rest).join(' · ') : shortDay(post)));
}
// The folded card from a wedding or a ceremony.
function ceremonyKeepsake(post) {
  const parts = post.ceremony.length ? firstWords(post.ceremony) : ['Welcome', 'The ceremony', 'Speeches', 'Dancing'];
  return wrapOf('ceremony', 'Order of service', h('span', { class: 'os-head' }, 'Order of Service'), h('span', { class: 'os-orn', 'aria-hidden': 'true' }, '❦'), h('strong', { class: 'os-where' }, post.title || ''), h('span', { class: 'os-day' }, longDay(post)), h('ol', { class: 'os-parts' }, parts.map((t) => h('li', null, t))));
}
const CONFETTI = ['#ff6fa8', '#ffd23c', '#5ac8fa', '#7ed67a', '#ff8a3c', '#b98cff', '#fff'];
function confettiKeepsake(post) {
  const bits = Array.from({ length: 26 }, (_, k) => {
    const r = hashText(post.slug + 'cf' + k);
    return h('i', { style: { left: (r % 92) + '%', top: ((r >> 7) % 86) + '%', background: CONFETTI[k % CONFETTI.length], rotate: (r % 180) + 'deg', borderRadius: k % 3 ? '1px' : '50%' } });
  });
  return wrapOf('confetti', 'Confetti', h('span', { class: 'cf-bits', 'aria-hidden': 'true' }, bits), h('span', { class: 'pf-note' }, notes(post.confetti, 'Still finding it in my pockets.')));
}
const BALLOON = ['#e8433a', '#3a86e8', '#f2b81c', '#3cb371', '#d14ab0'];
// Its class is "partyballoon": plain "balloon" is the desktop's notification bubble.
function balloonKeepsake(post) {
  const c = pickOf(post, 'balloon', BALLOON);
  const word = esc((post.balloon[0]?.item || 'Yay!').slice(0, 6));
  const art = `<svg viewBox="0 0 90 150" width="84" height="140"><path d="M45 100c-6 14 8 22 0 34s4 14 2 16" stroke="#777" stroke-width="1.4" fill="none"/><ellipse cx="45" cy="50" rx="36" ry="44" fill="${c}"/><path d="M40 93l5 7 5-7z" fill="${c}"/><ellipse cx="32" cy="30" rx="8" ry="13" fill="#fff" opacity=".35" transform="rotate(-20 32 30)"/><text x="45" y="58" text-anchor="middle" font-family="Caveat, cursive" font-weight="700" font-size="${word.length > 4 ? 18 : 24}" fill="#fff">${word}</text></svg>`;
  return wrapOf('partyballoon', 'Party balloon', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), post.balloon.length > 1 ? h('span', { class: 'pf-note' }, notes(post.balloon.slice(1), '')) : h('span', { class: 'pf-note' }, h('span', null, 'Happy days.')));
}
// A turnstile ticket for a match.
function matchdayKeepsake(post) {
  const match = post.matchday[0]?.item;
  return wrapOf('matchday', 'Match ticket', h('span', { class: 'md-stripe', 'aria-hidden': 'true' }), h('span', { class: 'md-body' }, h('span', { class: 'md-kind' }, 'MATCH DAY · ADMIT ONE'), h('strong', { class: 'md-match' }, (match || post.title || 'The big game').toUpperCase()), h('span', { class: 'md-sub' }, [match ? post.title : post.city, shortDay(post)].filter(Boolean).join(' · ')), post.matchday.length > 1 ? lineList('md-lines', post.matchday.slice(1)) : null, h('span', { class: 'md-no' }, 'TURNSTILE ' + ((hashText(post.slug + 'gate') % 24) + 1) + ' · Nº ' + serial(post, 'match'))));
}
// A brass token for one ride at the fair.
function funfairKeepsake(post) {
  const id = 'ft' + hashText(post.slug + 'fair');
  const name = esc((post.title || 'The fair').toUpperCase().slice(0, 22));
  const art = `<svg viewBox="0 0 110 110" width="96" height="96"><defs><path id="${id}" d="M55 55m-38 0a38 38 0 1 1 76 0a38 38 0 1 1-76 0"/><radialGradient id="${id}g" cx=".35" cy=".3"><stop offset="0" stop-color="#ffe7a0"/><stop offset=".6" stop-color="#d4a23a"/><stop offset="1" stop-color="#9a6e1c"/></radialGradient></defs><circle cx="55" cy="55" r="52" fill="url(#${id}g)" stroke="#8a5e14" stroke-width="2"/><circle cx="55" cy="55" r="30" fill="none" stroke="#8a5e14" stroke-width="1.2" stroke-dasharray="2 3"/><text font-family="Oswald, sans-serif" font-size="9" letter-spacing="1.5" fill="#6a440c"><textPath href="#${id}">${name} · ${name} ·</textPath></text><text x="55" y="50" text-anchor="middle" font-family="Oswald, sans-serif" font-size="8" fill="#6a440c">GOOD FOR</text><text x="55" y="66" text-anchor="middle" font-family="Oswald, sans-serif" font-weight="700" font-size="15" fill="#6a440c">1 RIDE</text></svg>`;
  return wrapOf('funfair', 'Fairground token', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, notes(post.funfair, 'Two goes on the waltzer.')));
}
// A ribbon rosette from a show: red for first, blue for second, yellow for third.
function rosetteKeepsake(post) {
  const said = (post.rosette[0]?.item || '').trim();
  const place = /\b1(st)?\b|first/i.test(said) ? 0 : /\b2(nd)?\b|second/i.test(said) ? 1 : /\b3(rd)?\b|third/i.test(said) ? 2 : 3;
  const c = ['#c8202a', '#1f55b8', '#e8b51c', '#7a3fa8'][place];
  return wrapOf('rosette', 'Rosette', h('span', { class: 'ro-tails', style: { '--c': c }, 'aria-hidden': 'true' }), h('span', { class: 'ro-ruff', style: { '--c': c } }, h('span', { class: 'ro-face' }, h('b', null, (said || 'Best day').slice(0, 10)), h('small', null, (post.title || '').toUpperCase().slice(0, 18)))), post.rosette.length > 1 ? h('span', { class: 'pf-note' }, notes(post.rosette.slice(1), '')) : null);
}
// A "Hello, my name is" sticker.
function namebadgeKeepsake(post) {
  return wrapOf('namebadge', 'Name badge', h('span', { class: 'nb-top' }, h('b', null, 'HELLO'), h('small', null, 'my name is')), h('span', { class: 'nb-name' }, post.namebadge[0]?.item || 'a friend'), h('span', { class: 'nb-foot' }, post.namebadge.length > 1 ? firstWords(post.namebadge.slice(1)).join(' · ') : (post.title || '')));
}
function sparklerKeepsake(post) {
  const sparks = Array.from({ length: 14 }, (_, k) => {
    const a = (k / 14) * Math.PI * 2;
    const r1 = 6, r2 = 16 + (hashText(post.slug + 'sp' + k) % 12);
    return `<path d="M${(30 + Math.cos(a) * r1).toFixed(1)} ${(26 + Math.sin(a) * r1).toFixed(1)}L${(30 + Math.cos(a) * r2).toFixed(1)} ${(26 + Math.sin(a) * r2).toFixed(1)}"/>`;
  }).join('');
  const art = `<svg viewBox="0 0 60 150" width="54" height="136"><g stroke="#ffd25c" stroke-width="1.6" stroke-linecap="round">${sparks}</g><circle cx="30" cy="26" r="6" fill="#fff6c8"/><path d="M30 30L30 100" stroke="#6a6a6a" stroke-width="4" stroke-linecap="round"/><path d="M30 100L30 146" stroke="#9a9a9a" stroke-width="2"/></svg>`;
  return wrapOf('sparkler', 'Sparkler', h('span', { class: 'mm-art sk-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, notes(post.sparkler, 'Wrote my name in the air.')));
}
// A photocopied gig flyer peeled off a wall.
function flyerKeepsake(post) {
  const who = post.flyer[0]?.item;
  return wrapOf('flyer', 'Gig flyer', h('span', { class: 'fy-tape a', 'aria-hidden': 'true' }), h('span', { class: 'fy-tape b', 'aria-hidden': 'true' }), h('span', { class: 'fy-live' }, 'LIVE!'), h('strong', { class: 'fy-name' }, (who || actOf(post) || 'Tonight').toUpperCase()), who && post.type === 'places' && post.title ? h('span', { class: 'fy-at' }, 'at ' + post.title) : null, h('span', { class: 'fy-day' }, shortDay(post)), ...firstWords(post.flyer.slice(1)).map((t) => h('span', { class: 'fy-line' }, t)), h('span', { class: 'fy-foot' }, 'PAY ON THE DOOR'));
}

// ---- More for concerts ----
// The back of a tour T-shirt, with the dates down it.
function tourteeKeepsake(post) {
  const dates = post.tourtee.length ? firstWords(post.tourtee) : [[post.city || actOf(post), shortDay(post)].filter(Boolean).join(' · ')];
  return wrapOf('tourtee', 'Tour T-shirt', h('span', { class: 'tt2-shirt' }, h('b', null, 'ON TOUR'), h('ul', { class: 'tt2-dates' }, dates.map((t) => h('li', null, t)))));
}
function earplugsKeepsake(post) {
  const u = hashText(post.slug);
  const plug = (x, r) => `<g transform="rotate(${r} ${x + 12} 30)"><rect x="${x}" y="8" width="24" height="44" rx="11" fill="#f59a2c"/><rect x="${x}" y="8" width="24" height="44" rx="11" fill="url(#ep-dots${u})"/></g>`;
  const art = `<svg viewBox="0 0 80 64" width="76" height="60"><defs><pattern id="ep-dots${u}" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".9" fill="#c86a10" opacity=".45"/></pattern></defs>${plug(8, -18)}${plug(44, 14)}</svg>`;
  return wrapOf('earplugs', 'Foam earplugs', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, notes(post.earplugs, 'Ears still ringing.')));
}
function drumstickKeepsake(post) {
  const u = hashText(post.slug);
  const word = esc((post.drumstick[0]?.item || post.title || 'Caught it!').slice(0, 26));
  const art = `<svg viewBox="0 0 240 40" width="230" height="38"><defs><linearGradient id="ds-wood${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0cf94"/><stop offset=".5" stop-color="#d9a860"/><stop offset="1" stop-color="#b98444"/></linearGradient></defs><path d="M8 14h170l50 3a4 4 0 0 1 0 6l-50 3H8a6 6 0 0 1 0-12z" fill="url(#ds-wood${u})"/><ellipse cx="230" cy="20" rx="7" ry="5" fill="#e8c27c"/><text x="20" y="25" font-family="Caveat, cursive" font-size="15" fill="#24305c">${word}</text></svg>`;
  return wrapOf('drumstick', 'Drumstick', h('span', { class: 'mm-art', role: 'img', 'aria-label': post.drumstick[0]?.item || 'Drumstick', html: art }), post.drumstick.length > 1 ? h('span', { class: 'pf-note' }, notes(post.drumstick.slice(1), '')) : null);
}
const BADGE = [['#d6332b', '#fff'], ['#111', '#ffd23c'], ['#2a6fd6', '#fff'], ['#ffd23c', '#111'], ['#2f9e5a', '#fff']];
function buttonbadgeKeepsake(post) {
  const [bg, ink] = pickOf(post, 'badge', BADGE);
  const id = 'bb' + hashText(post.slug + 'badge');
  const ring = esc((actOf(post) || 'Live').toUpperCase().slice(0, 20));
  const word = esc((post.buttonbadge[0]?.item || 'I was there').toUpperCase().slice(0, 14));
  const art = `<svg viewBox="0 0 100 100" width="92" height="92"><defs><path id="${id}" d="M50 50m-36 0a36 36 0 1 1 72 0a36 36 0 1 1-72 0"/><radialGradient id="${id}s" cx=".35" cy=".3"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="47" fill="${bg}" stroke="#bbb" stroke-width="2"/><text font-family="Oswald, sans-serif" font-size="8" letter-spacing="2" fill="${ink}"><textPath href="#${id}">★ ${ring} ★ ${ring}</textPath></text><text x="50" y="55" text-anchor="middle" font-family="Oswald, sans-serif" font-weight="700" font-size="${word.length > 8 ? 9 : 13}" fill="${ink}">${word}</text><circle cx="50" cy="50" r="47" fill="url(#${id}s)"/></svg>`;
  return wrapOf('buttonbadge', 'Button badge', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), post.buttonbadge.length > 1 ? h('span', { class: 'pf-note' }, notes(post.buttonbadge.slice(1), '')) : null);
}
// The venue's seating plan, your seat circled in pen.
function seatplanKeepsake(post) {
  const pick = hashText(post.slug + 'seat');
  const rows = [6, 8, 10, 12, 14];
  const mine = [pick % rows.length, (pick >> 3) % 6];
  let seats = '';
  rows.forEach((n, r) => {
    for (let k = 0; k < n; k++) {
      const x = 100 + (k - (n - 1) / 2) * 13, y = 44 + r * 13 + Math.abs(k - (n - 1) / 2) * 1.2;
      seats += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${r === mine[0] && k === Math.min(mine[1] + 1, n - 1) ? '#24305c' : '#c9b48a'}"/>`;
      if (r === mine[0] && k === Math.min(mine[1] + 1, n - 1)) seats += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="10" ry="8" fill="none" stroke="#c0392b" stroke-width="2" transform="rotate(-10 ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }
  });
  const svg = `<svg viewBox="0 0 200 116" width="100%" height="100%"><rect x="50" y="6" width="100" height="18" rx="3" fill="#2b2b2b"/><text x="100" y="19" text-anchor="middle" font-family="Oswald, sans-serif" font-size="10" letter-spacing="3" fill="#f3ead2">STAGE</text>${seats}</svg>`;
  return wrapOf('seatplan', 'Seating plan', h('span', { class: 'sp2-map', 'aria-hidden': 'true', html: svg }), h('span', { class: 'tm-note' }, notes(post.seatplan, 'my seat!')));
}
function lozengeKeepsake(post) {
  const art = '<svg viewBox="0 0 90 90" width="80" height="80"><circle cx="45" cy="45" r="42" fill="#c7ccd1" stroke="#8d949b" stroke-width="2"/><circle cx="45" cy="45" r="34" fill="#2f7a4f"/><circle cx="45" cy="45" r="30" fill="none" stroke="#e8d27a" stroke-width="1.5"/><text x="45" y="42" text-anchor="middle" font-family="Oswald, sans-serif" font-size="9" letter-spacing="1" fill="#f4ecd0">THROAT</text><text x="45" y="54" text-anchor="middle" font-family="Oswald, sans-serif" font-size="9" letter-spacing="1" fill="#f4ecd0">SWEETS</text></svg>';
  return wrapOf('lozenge', 'Throat sweets', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, notes(post.lozenge, 'Sang every word. No voice left.')));
}

// ---- Stage and comedy ----
const MASKS = '<svg viewBox="0 0 130 90" width="120" height="84"><path d="M20 30q-6 30 22 44q8-6 22-16q4-30-2-46q-24-4-42 18z" fill="#f2c94c" stroke="#a87a14" stroke-width="2" transform="rotate(-12 42 44)"/><g transform="rotate(-12 42 44)" fill="#5a3a0c"><path d="M28 36q6-6 12 0q-6 4-12 0z"/><path d="M46 32q6-6 12 0q-6 4-12 0z"/><path d="M30 54q12 12 26 -2q-12 4-26 2z"/></g><path d="M66 22q-4 30 20 46q10-4 22-16q6-28 0-46q-24-4-42 16z" fill="#d9dde3" stroke="#7a828c" stroke-width="2" transform="rotate(12 88 40)"/><g transform="rotate(12 88 40)" fill="#3a4250"><path d="M74 30q6 5 12 0q-6-4-12 0z"/><path d="M92 28q6 5 12 0q-6-4-12 0z"/><path d="M78 56q12-12 24 0q-12-4-24 0z"/></g><path d="M58 70q6 8 2 16M60 70q-8 6-10 14" stroke="#c0392b" stroke-width="2.5" fill="none"/></svg>';
function masksKeepsake(post) {
  return wrapOf('masks', 'Theatre masks', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: MASKS }), h('span', { class: 'pf-note' }, notes(post.masks, 'Laughed, then cried.')));
}
function stageprogKeepsake(post) {
  const show = post.stageprog[0]?.item;
  return wrapOf('stageprog', 'Theatre programme', h('span', { class: 'tp-kind' }, 'PROGRAMME'), h('span', { class: 'tp-orn', 'aria-hidden': 'true' }, '🎭'), h('strong', { class: 'tp-show' }, show || post.title || 'Tonight'), show && post.type === 'places' && post.title ? h('span', { class: 'tp-at' }, 'at ' + post.title) : null, h('span', { class: 'tp-day' }, longDay(post)), ...firstWords(post.stageprog.slice(1)).map((t) => h('span', { class: 'tp-line' }, t)));
}
function comedyticketKeepsake(post) {
  return wrapOf('comedyticket', 'Comedy night ticket', h('span', { class: 'ct-kind' }, 'COMEDY CLUB · ADMIT ONE'), h('strong', { class: 'ct-name' }, 'STAND-UP NIGHT'), h('span', { class: 'ct-sub' }, [post.title, shortDay(post)].filter(Boolean).join(' · ')), post.comedyticket.length ? plainLines('ct-lines', post.comedyticket) : null, h('span', { class: 'ct-no' }, 'Nº ' + serial(post, 'comedy') + ' · NO HECKLING (MUCH)'));
}
function micKeepsake(post) {
  const u = hashText(post.slug);
  const art = `<svg viewBox="0 0 60 150" width="54" height="136"><defs><pattern id="mic-grille${u}" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 2h4M2 0v4" stroke="#7d848c" stroke-width=".8"/></pattern></defs><rect x="14" y="6" width="32" height="44" rx="16" fill="#cfd4d9"/><rect x="14" y="6" width="32" height="44" rx="16" fill="url(#mic-grille${u})"/><rect x="12" y="26" width="36" height="5" fill="#9aa1a8"/><rect x="26" y="50" width="8" height="14" fill="#3a3a3a"/><path d="M30 64v76" stroke="#2b2b2b" stroke-width="4"/><path d="M12 146l18-8 18 8" stroke="#2b2b2b" stroke-width="4" fill="none"/></svg>`;
  return wrapOf('mic', 'Microphone', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, notes(post.mic, 'Is this thing on?')));
}
// The little tub of ice cream from the interval, with its wooden spoon.
function intervalKeepsake(post) {
  const flavour = esc((post.interval[0]?.item || 'Vanilla').slice(0, 12));
  const art = `<svg viewBox="0 0 110 80" width="104" height="76"><path d="M14 30h66l-6 40H20z" fill="#f6f1e4" stroke="#c9b48a" stroke-width="1.5"/><path d="M18 40h58" stroke="#e8a3b5" stroke-width="4"/><ellipse cx="47" cy="28" rx="36" ry="10" fill="#e8a3b5" stroke="#c46a84" stroke-width="1.5"/><text x="47" y="32" text-anchor="middle" font-family="Caveat, cursive" font-weight="700" font-size="13" fill="#fff">${flavour}</text><path d="M78 56l26-36" stroke="#d9b07a" stroke-width="6" stroke-linecap="round"/><ellipse cx="103" cy="20" rx="5" ry="7" fill="#d9b07a" transform="rotate(35 103 20)"/></svg>`;
  return wrapOf('interval', 'Interval ice cream', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, notes(post.interval.slice(1), 'Best part of the interval.')));
}
function operaglassesKeepsake(post) {
  const u = hashText(post.slug);
  const art = `<svg viewBox="0 0 120 80" width="110" height="74"><defs><linearGradient id="og-gold${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe7a0"/><stop offset=".5" stop-color="#d4a23a"/><stop offset="1" stop-color="#9a6e1c"/></linearGradient><linearGradient id="og-pearl${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdfaf2"/><stop offset=".5" stop-color="#e6e0f0"/><stop offset="1" stop-color="#d8eaf0"/></linearGradient></defs><rect x="14" y="20" width="34" height="40" rx="8" fill="url(#og-pearl${u})" stroke="#9a6e1c" stroke-width="2"/><rect x="62" y="20" width="34" height="40" rx="8" fill="url(#og-pearl${u})" stroke="#9a6e1c" stroke-width="2"/><ellipse cx="31" cy="60" rx="18" ry="7" fill="url(#og-gold${u})"/><ellipse cx="79" cy="60" rx="18" ry="7" fill="url(#og-gold${u})"/><ellipse cx="31" cy="20" rx="15" ry="5" fill="url(#og-gold${u})"/><ellipse cx="79" cy="20" rx="15" ry="5" fill="url(#og-gold${u})"/><rect x="46" y="32" width="18" height="8" fill="url(#og-gold${u})"/><path d="M96 40q14 4 20 30" stroke="url(#og-gold${u})" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;
  return wrapOf('operaglasses', 'Opera glasses', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, notes(post.operaglasses, 'Every face, from the back row.')));
}
// Red velvet curtains, the place in lights between them.
function curtainKeepsake(post) {
  return wrapOf('curtain', 'Curtain call', h('span', { class: 'cc-valance', 'aria-hidden': 'true' }), h('span', { class: 'cc-stage' }, h('span', { class: 'cc-drape l', 'aria-hidden': 'true' }), h('span', { class: 'cc-lights' }, h('b', null, (post.title || 'Tonight').toUpperCase()), h('small', null, shortDay(post))), h('span', { class: 'cc-drape r', 'aria-hidden': 'true' })), h('span', { class: 'cc-notes' }, notes(post.curtain, 'Bravo!')));
}
// How hard you laughed, from 0 to 10.
function laughmeterKeepsake(post) {
  const u = hashText(post.slug);
  const m = /(\d{1,2}(?:\.\d)?)/.exec(post.laughmeter[0]?.item || '');
  const n = Math.max(0, Math.min(10, m ? Number(m[1]) : 7 + (hashText(post.slug + 'laugh') % 4)));
  const a = Math.PI * (1 - n / 10);
  const x = (60 + Math.cos(a) * 40).toFixed(1), y = (62 - Math.sin(a) * 40).toFixed(1);
  const ticks = Array.from({ length: 11 }, (_, k) => {
    const t = Math.PI * (1 - k / 10);
    return `<path d="M${(60 + Math.cos(t) * 46).toFixed(1)} ${(62 - Math.sin(t) * 46).toFixed(1)}L${(60 + Math.cos(t) * 52).toFixed(1)} ${(62 - Math.sin(t) * 52).toFixed(1)}" stroke="#3a2c1c" stroke-width="${k % 5 ? 1.2 : 2.2}"/>`;
  }).join('');
  const svg = `<svg viewBox="0 0 120 72" width="150" height="90"><path d="M8 62a52 52 0 0 1 104 0" fill="none" stroke="url(#lm-g${u})" stroke-width="10"/><defs><linearGradient id="lm-g${u}"><stop offset="0" stop-color="#8fc0e0"/><stop offset=".5" stop-color="#ffd25c"/><stop offset="1" stop-color="#e8432c"/></linearGradient></defs>${ticks}<text x="14" y="70" font-family="Oswald, sans-serif" font-size="7" fill="#3a2c1c">MEH</text><text x="92" y="70" font-family="Oswald, sans-serif" font-size="7" fill="#3a2c1c">CRYING</text><path d="M60 62L${x} ${y}" stroke="#c0392b" stroke-width="2.4" stroke-linecap="round"/><circle cx="60" cy="62" r="4" fill="#2b2b2b"/></svg>`;
  return wrapOf('laughmeter', 'Laugh-o-meter', h('span', { class: 'lm-head' }, 'LAUGH-O-METER'), h('span', { class: 'lm-dial', role: 'img', 'aria-label': `${n} out of 10`, html: svg }), h('span', { class: 'lm-n' }, `${n} / 10`), post.laughmeter.length > (m ? 1 : 0) ? h('span', { class: 'pf-note' }, notes(post.laughmeter.slice(m ? 1 : 0), '')) : null);
}
function jokeKeepsake(post) {
  return wrapOf('joke', 'Best joke of the night', h('span', { class: 'jk-head' }, 'the best line:'), h('span', { class: 'jk-text' }, notes(post.joke, 'You had to be there.')), h('span', { class: 'jk-ha', 'aria-hidden': 'true' }, 'ha!'));
}

// ---- For thoughts ----
const SKY_PAINT = {
  morning: 'linear-gradient(180deg, #f2a66b, #f8d3a0 55%, #c8e4f4)',
  day: 'linear-gradient(180deg, #2e6bd8, #6fa7ee 60%, #b9dcfb)',
  sunset: 'linear-gradient(180deg, #3a2a6e, #b8507a 50%, #f39a52)',
  night: 'radial-gradient(circle at 75% 25%, #f4f1d0 0 9px, transparent 10px), radial-gradient(circle at 20% 30%, #fff 0 1px, transparent 2px), radial-gradient(circle at 45% 18%, #fff 0 1px, transparent 2px), radial-gradient(circle at 60% 55%, #fff 0 1px, transparent 2px), linear-gradient(180deg, #0a1236, #1c2a66 70%, #33427e)'
};
function skyKeepsake(post) {
  const hr = new Date(post.ts || Date.now()).getHours();
  const when2 = hr < 6 ? 'night' : hr < 10 ? 'morning' : hr < 17 ? 'day' : hr < 20 ? 'sunset' : 'night';
  return h('div', { class: 'ticket-wrap sky' }, h('figure', { class: 'ks ks-sky', role: 'group', 'aria-label': 'Polaroid of the sky' }, h('span', { class: 'sk-photo', style: { background: SKY_PAINT[when2] } }), h('figcaption', null, post.sky[0]?.item || { morning: 'this morning', day: 'today', sunset: 'tonight', night: 'late' }[when2])));
}
function diaryKeepsake(post) {
  return wrapOf('diary', 'Diary page', h('span', { class: 'dy-date' }, longDay(post)), h('span', { class: 'dy-dear' }, 'Dear diary,'), h('span', { class: 'dy-text' }, notes(post.diary, '…')));
}
const MOODS = { calm: '#3fb3a3', happy: '#f2b233', stormy: '#3a3f8a', love: '#e2557a', sad: '#3a6fd8', excited: '#9b3fd6', sleepy: '#7a8aa8', curious: '#3fa84f' };
function moodringKeepsake(post) {
  const said = (post.moodring[0]?.item || '').trim().toLowerCase();
  const mood = MOODS[said] ? said : Object.keys(MOODS)[hashText(post.slug) % 8];
  const svg = `<svg viewBox="0 0 90 80" width="90" height="80"><ellipse cx="45" cy="52" rx="30" ry="20" fill="none" stroke="#c9a14a" stroke-width="6"/><ellipse cx="45" cy="52" rx="30" ry="20" fill="none" stroke="#f3d27a" stroke-width="2"/><ellipse cx="45" cy="26" rx="17" ry="13" fill="#c9a14a"/><ellipse cx="45" cy="25" rx="13" ry="10" fill="${MOODS[mood]}"/><ellipse cx="40" cy="21" rx="4" ry="2.5" fill="#fff" opacity=".55"/></svg>`;
  return wrapOf('moodring', 'Mood ring', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: svg }), h('span', { class: 'pf-note' }, h('span', null, mood), ...firstWords(post.moodring.slice(MOODS[said] ? 1 : 0)).map((x) => h('span', null, x))));
}
const DOODLES = {
  heart: 'M40 70C10 50 6 26 22 18c10-5 18 2 18 10 0-8 8-15 18-10 16 8 12 32-18 52z',
  star: 'M40 8l9 22 24 2-18 15 6 23-21-13-21 13 6-23L7 32l24-2z',
  cloud: 'M20 60h42a14 14 0 0 0 0-28 18 18 0 0 0-34-4A15 15 0 0 0 20 60z',
  spiral: 'M40 40m0 0a4 4 0 0 1 8 0a8 8 0 0 1-16 0a12 12 0 0 1 24 0a16 16 0 0 1-32 0a20 20 0 0 1 40 0a24 24 0 0 1-48 0',
  sun: 'M40 26a14 14 0 1 1 0 28a14 14 0 1 1 0-28M40 6v10M40 64v10M6 40h10M64 40h10M16 16l7 7M57 57l7 7M64 16l-7 7M23 57l-7 7',
  flower: 'M40 40m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M40 34c-6-16 6-22 0-28M46 40c16-6 22 6 28 0M40 46c6 16-6 22 0 28M34 40c-16 6-22-6-28 0'
};
function doodleKeepsake(post) {
  const said = (post.doodle[0]?.item || '').trim().toLowerCase();
  const shape = DOODLES[said] ? said : Object.keys(DOODLES)[hashText(post.slug) % 6];
  const svg = `<svg viewBox="0 0 80 80" width="76" height="76"><path d="${DOODLES[shape]}" fill="none" stroke="var(--pen)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return wrapOf('doodle', 'Doodle', h('span', { class: 'dd-art', 'aria-hidden': 'true', html: svg }), post.doodle.length > (DOODLES[said] ? 1 : 0) ? h('span', { class: 'pf-note dd-note' }, ...firstWords(post.doodle.slice(DOODLES[said] ? 1 : 0)).map((x) => h('span', null, x))) : null);
}
function cootieKeepsake(post) {
  const svg = '<svg viewBox="0 0 100 100" width="96" height="96"><path d="M50 4L96 50 50 96 4 50z" fill="#fff" stroke="#c9c2b6"/><path d="M50 4L50 50 4 50z" fill="#ffb3c8"/><path d="M50 4L96 50 50 50z" fill="#b3e0ff"/><path d="M96 50L50 96 50 50z" fill="#fff59a"/><path d="M4 50L50 96 50 50z" fill="#c8f0b8"/><path d="M50 4v92M4 50h92" stroke="#a49a8a" stroke-width="1"/><g font-family="Oswald, sans-serif" font-size="11" fill="#555" text-anchor="middle"><text x="34" y="40">1</text><text x="66" y="40">2</text><text x="66" y="68">3</text><text x="34" y="68">4</text></g></svg>';
  return wrapOf('cootie', 'Paper fortune teller', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: svg }), h('span', { class: 'pf-note' }, h('small', null, 'under the flap:'), notes(post.cootie, 'You will have a lovely day')));
}
function forecastKeepsake(post) {
  const text = post.forecast[0]?.item || ['Cloudy with a chance of overthinking', 'Sunny spells, bright outlook', 'Light drizzle of nostalgia', 'Clear skies by evening'][hashText(post.slug) % 4];
  return wrapOf('forecast', 'Weather report', h('span', { class: 'fc-head' }, "TODAY'S FORECAST"), h('span', { class: 'fc-icon', 'aria-hidden': 'true', html: ICON.cloud }), h('strong', { class: 'fc-text' }, text), ...firstWords(post.forecast.slice(1)).map((x) => h('span', { class: 'fc-line' }, x)));
}
function lyricKeepsake(post) {
  return wrapOf('lyric', 'Song scrap', h('span', { class: 'ly-note', 'aria-hidden': 'true' }, '♪'), h('span', { class: 'ly-text' }, notes(post.lyric, 'the song stuck in my head')));
}

// Everything stuck in under the map: receipts, tickets, invitations, as you ticked them.
function keepsakes(post) {
  const items = [receipt(post, post.ordered, 'till'), receipt(post, post.bought, 'shop'), entryTicket(post), galleryTicket(post), theatreTicket(post), cinemaStub(post), travelTicket(post), boardingPass(post), cloakroomTicket(post), invitation(post), postcard(post), fortuneSlip(post), luggageTag(post), matchbook(post), coaster(post), roomKey(post), pressedFlower(post), wristband(post)].filter(Boolean);
  return items.length ? h('div', { class: 'keepsakes' + (items.length > 1 ? ' several' : '') }, items) : null;
}

function floppyMargin(post) {
  const about = ABOUT.place({ ...post, categoryLabel: post.category ? catLabel(post.category) : '' });
  // His journal lines are separate from the screensaver ones; without any, he makes something up.
  const say = () => (post.floppy_journal?.length && Math.random() < 0.75 ? pickLine(post.floppy_journal) : pickLine(about));
  const text = h('span', { class: 'fd-say' }, say());
  return h(
    'button',
    { type: 'button', class: 'floppy-doodle', title: 'Poke Floppy', 'aria-label': 'Floppy says something. Tap for another.', onclick: () => (text.textContent = say()) },
    text,
    h('span', { class: 'fd-pic', html: floppySvg() })
  );
}
const pickLine = (list) => list[Math.floor(Math.random() * list.length)];

function alsoIn(post, list) {
  const city = (post.city || '').trim().toLowerCase();
  if (!city) return null;
  const others = list.filter((p) => p.slug !== post.slug && (p.city || '').trim().toLowerCase() === city);
  const seen = new Set();
  // Three at random from your other places there, different each visit.
  const uniq = others.filter((p) => !seen.has(p.title) && seen.add(p.title));
  for (let k = uniq.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [uniq[k], uniq[j]] = [uniq[j], uniq[k]];
  }
  uniq.length = Math.min(uniq.length, 3);
  if (!uniq.length) return null;
  return h(
    'div',
    { class: 'also-in' },
    h('span', { class: 'paperclip', 'aria-hidden': 'true' }),
    h('strong', { class: 'hand' }, `Also in ${post.city}`),
    h('ul', null, uniq.map((p) => h('li', null, h('a', { href: `#/journal/${p.slug}`, onclick: () => sound.page() }, p.title || 'Untitled'), p.rating != null ? h('span', { class: 'ai-stars' }, '★'.repeat(Math.round(p.rating))) : null)))
  );
}

// One photo as a polaroid, tilted one way or the other.
function polaroidOf(post, k) {
  return h('button', { type: 'button', class: 'polaroid', style: { '--r': (k % 2 ? 2.5 : -3) + 'deg' }, onclick: () => lightbox(post, k) }, h('img', { src: post.photos[k], alt: post.captions[k] || 'Photo', loading: 'lazy' }), h('span', { class: 'hand' }, post.captions[k] || ''));
}

// The keepsakes a place has, each as something that makes a fresh copy (pages are laid out
// again when a window changes size).
export function keepsakeMakers(post) {
  return [
    post.ordered?.length && (() => receipt(post, post.ordered, 'till')),
    post.bought?.length && (() => receipt(post, post.bought, 'shop')),
    post.tickets && (() => entryTicket(post)),
    post.gallery && (() => galleryTicket(post)),
    post.theatre && (() => theatreTicket(post)),
    post.cinema && (() => cinemaStub(post)),
    post.rides && (() => travelTicket(post)),
    post.boarding && (() => boardingPass(post)),
    post.cloakroom && (() => cloakroomTicket(post)),
    post.invite && (() => invitation(post)),
    post.postcard && (() => postcard(post)),
    post.fortune && (() => fortuneSlip(post)),
    post.luggage && (() => luggageTag(post)),
    post.matchbook && (() => matchbook(post)),
    post.coaster && (() => coaster(post)),
    post.roomkey && (() => roomKey(post)),
    post.flower && (() => pressedFlower(post)),
    post.wristband && (() => wristband(post)),
    post.pitch && (() => pitchKeepsake(post)),
    post.trailmap && (() => trailmapKeepsake(post)),
    post.parkpass && (() => parkpassKeepsake(post)),
    post.patch && (() => patchKeepsake(post)),
    post.summit && (() => summitKeepsake(post)),
    post.signpost && (() => signpostKeepsake(post)),
    post.leaf && (() => leafKeepsake(post)),
    post.marshmallow && (() => marshmallowKeepsake(post)),
    post.tides && (() => tidesKeepsake(post)),
    post.compass && (() => compassKeepsake(post)),
    post.bookmark && (() => bookmarkKeepsake(post)),
    post.librarycard && (() => librarycardKeepsake(post)),
    post.bookplate && (() => bookplateKeepsake(post)),
    post.note && (() => noteKeepsake(post)),
    post.popcorn && (() => popcornKeepsake(post)),
    post.glasses3d && (() => glasses3dKeepsake(post)),
    post.rental && (() => rentalKeepsake(post)),
    post.tvguide && (() => tvguideKeepsake(post)),
    post.remote && (() => remoteKeepsake(post)),
    post.headphones && (() => headphonesKeepsake(post)),
    post.gig && (() => gigKeepsake(post)),
    post.pick && (() => pickKeepsake(post)),
    post.setlist && (() => setlistKeepsake(post)),
    post.busticket && (() => busticketKeepsake(post)),
    post.coffeering && (() => coffeeringKeepsake(post)),
    post.signature && (() => signatureKeepsake(post)),
    post.bookclub && (() => bookclubKeepsake(post)),
    post.dogear && (() => dogearKeepsake(post)),
    post.stubpair && (() => stubpairKeepsake(post)),
    post.programme && (() => programmeKeepsake(post)),
    post.picknmix && (() => picknmixKeepsake(post)),
    post.drivein && (() => driveinKeepsake(post)),
    post.tally && (() => tallyKeepsake(post)),
    post.takeaway && (() => takeawayKeepsake(post)),
    post.nospoil && (() => nospoilKeepsake(post)),
    post.battery && (() => batteryKeepsake(post)),
    post.jcard && (() => jcardKeepsake(post)),
    post.walkmap && (() => walkmapKeepsake(post)),
    post.napkin && (() => napkinKeepsake(post)),
    post.vinyllabel && (() => vinyllabelKeepsake(post)),
    post.mixtape && (() => mixtapeKeepsake(post)),
    post.backstage && (() => backstageKeepsake(post)),
    post.lighter && (() => lighterKeepsake(post)),
    post.sky && (() => skyKeepsake(post)),
    post.diary && (() => diaryKeepsake(post)),
    post.moodring && (() => moodringKeepsake(post)),
    post.doodle && (() => doodleKeepsake(post)),
    post.cootie && (() => cootieKeepsake(post)),
    post.forecast && (() => forecastKeepsake(post)),
    post.lyric && (() => lyricKeepsake(post)),
    post.handstamp && (() => handstampKeepsake(post)),
    post.glowstick && (() => glowstickKeepsake(post)),
    post.racebib && (() => racebibKeepsake(post)),
    post.ceremony && (() => ceremonyKeepsake(post)),
    post.confetti && (() => confettiKeepsake(post)),
    post.balloon && (() => balloonKeepsake(post)),
    post.matchday && (() => matchdayKeepsake(post)),
    post.funfair && (() => funfairKeepsake(post)),
    post.rosette && (() => rosetteKeepsake(post)),
    post.namebadge && (() => namebadgeKeepsake(post)),
    post.sparkler && (() => sparklerKeepsake(post)),
    post.flyer && (() => flyerKeepsake(post)),
    post.tourtee && (() => tourteeKeepsake(post)),
    post.earplugs && (() => earplugsKeepsake(post)),
    post.drumstick && (() => drumstickKeepsake(post)),
    post.buttonbadge && (() => buttonbadgeKeepsake(post)),
    post.seatplan && (() => seatplanKeepsake(post)),
    post.lozenge && (() => lozengeKeepsake(post)),
    post.masks && (() => masksKeepsake(post)),
    post.stageprog && (() => stageprogKeepsake(post)),
    post.comedyticket && (() => comedyticketKeepsake(post)),
    post.mic && (() => micKeepsake(post)),
    post.interval && (() => intervalKeepsake(post)),
    post.operaglasses && (() => operaglassesKeepsake(post)),
    post.curtain && (() => curtainKeepsake(post)),
    post.laughmeter && (() => laughmeterKeepsake(post)),
    post.joke && (() => jokeKeepsake(post)),
    // memories, skies, the gym and the time of day
    ...thoughtMakers(post),
    // awards, charts and fan things for music
    ...musicMakers(post),
    // studying and work
    ...studyMakers(post),
    // and the ones you designed yourself
    ...customMakers(post)
  ].filter(Boolean);
}

// The order things are stuck in: photos come first (the first one or two), then a keepsake
// and a photo by turns, then whatever is left of either. Each is used once.
function scrapOrder(post) {
  const photos = post.photos.map((_, k) => () => polaroidOf(post, k));
  const keeps = keepsakeMakers(post);
  const out = photos.slice(0, 2);
  const rest = photos.slice(2);
  for (let k = 0; k < Math.max(keeps.length, rest.length); k++) {
    if (keeps[k]) out.push(keeps[k]);
    if (rest[k]) out.push(rest[k]);
  }
  return out;
}

// A phone's single page: the leading photos above the writing, then the rest spread evenly
// between paragraphs through the whole entry (never straight after a heading). A short entry
// hasn't the room, so what doesn't get a place gathers together after the writing.
function weave(body, scraps, post) {
  const queue = [...scraps];
  const lead = [];
  while (queue.length && lead.length < Math.min(2, post.photos.length)) lead.push(queue.shift()());
  const blocks = [...body.children];
  const size = (b) => (b.textContent || '').length + (b.querySelector('img, table') ? 300 : 0);
  const total = blocks.reduce((n, b) => n + size(b), 0);
  // Enough reading between two things that they never crowd each other.
  const gap = Math.max(420, total / (queue.length + 1));
  let since = 0;
  let side = 0;
  blocks.forEach((b, k) => {
    since += size(b);
    if (!queue.length || !blocks[k + 1] || since < gap || /^H[1-6]$/.test(b.tagName)) return;
    const el = queue.shift()();
    if (!el) return;
    b.after(h('div', { class: 'scrap-inline ' + (side++ % 2 ? 'lean-r' : 'lean-l') }, el));
    since = 0;
  });
  const end = queue.map((make) => make()).filter(Boolean);
  return [lead.length ? h('div', { class: 'polaroids' }, lead) : null, body, end.length ? h('div', { class: 'scrap-end' }, end) : null];
}

function scrapbook(post, list) {
  const r = keepsakes(post);
  const a = alsoIn(post, list);
  // More than one keepsake: they go side by side across the foot of the scrapbook.
  const many = r?.classList.contains('several');
  return h('div', { class: 'scrapbook' + (r ? '' : ' no-receipt') + (a ? '' : ' no-also') + (many ? ' many' : '') }, r, floppyMargin(post), a);
}

// ---------- Passport ----------

function passport(ctx) {
  const cities = passportStamps(places(ctx.data), ctx.data.visited || []);
  const countries = new Set(cities.map((c) => (c.code || c.country || '').toUpperCase()).filter(Boolean));
  const grid = h('div', { class: 'stamp-grid' + (ctx.desktop || ctx.tablet ? ' wide' : '') });
  // Arriving from a journal entry: that city's stamp is pressed again, where you can see it.
  const from = ctx.param ? places(ctx.data).find((p) => p.slug === ctx.param) : null;
  const fromCity = (from?.city || '').trim().toLowerCase();
  cities.forEach((c, i) => {
    const look = stampLook(c.city);
    const style = { '--rot': look.rot + 'deg', '--dx': look.dx + 'px', '--dy': look.dy + 'px', '--op': look.op };
    // Reviewed cities open their review; countries from the flight log are just stamps.
    const cell = c.slug ? h('a', { class: 'stamp', href: `#/journal/${c.slug}`, style, title: c.city }) : h('span', { class: 'stamp', style, title: `${c.city}, ${c.country}` });
    cell.innerHTML = stampSvg({ ...c, index: i });
    if (fromCity && c.city.toLowerCase() === fromCity) {
      cell.classList.add('found');
      bringIntoView(cell);
    }
    grid.append(cell);
  });
  grid.append(h('div', { class: 'stamp next' }, h('span', { class: 'hand' }, 'Your next city goes here')));

  const visa = ctx.data.stats ? visaCard(ctx.data.stats, ctx.data.site.owner || '', ctx.data.passport) : null;
  // Your own words for "visas" (passport.md) replace the list in the heading too.
  const visasWords = ctx.data.passport?.words?.length ? ctx.data.passport.words : VISAS_WORLD;

  const wrap = h(
    'div',
    { class: 'passport-page' },
    h(
      'div',
      { class: 'passport-head' },
      h('div', { class: 'pp-title' }, h('span', { class: 'visas' }, 'VISAS'), h('span', { class: 'pp-langs', lang: 'mul' }, wordList(visasWords))),
      h('span', { class: 'owner' }, (ctx.data.site.owner || '').toUpperCase())
    ),
    h('span', { class: 'hand pp-sub' }, 'A stamp for every city and country'),
    visa,
    grid,
    h(
      'div',
      { class: 'passport-foot' },
      h('span', { class: 'hand' }, `${cities.length} ${cities.length === 1 ? 'city' : 'cities'} · ${countries.size} ${countries.size === 1 ? 'country' : 'countries'}`),
      h('span', { class: 'microprint', 'aria-hidden': 'true' }, (MICRO + ' ').repeat(4))
    )
  );
  const defs = h('div', { class: 'ink-defs', 'aria-hidden': 'true' });
  defs.innerHTML = INK_DEFS;
  wrap.prepend(defs);
  return wrap;
}

// ---------- Mac atlas + wishlist ----------

function segmented(active) {
  return h(
    'div',
    { class: 'segmented' },
    active === 'atlas' ? h('span', { class: 'seg on', 'aria-current': 'page' }, 'Map') : h('a', { class: 'seg', href: '#/atlas' }, 'Map'),
    active === 'wishlist' ? h('span', { class: 'seg on', 'aria-current': 'page' }, 'Wishlist') : h('a', { class: 'seg', href: '#/wishlist' }, 'Wishlist')
  );
}

function atlas(ctx) {
  const all = places(ctx.data);
  // Categories in use: built-in and your own first, in their order, then any others.
  const used = new Set(all.map((p) => p.category).filter(Boolean));
  const present = [...Object.keys(CATEGORIES).filter((c) => used.has(c)), ...[...used].filter((c) => !CATEGORIES[c])];
  let filter = 'all';
  const mapHolder = h('div', { class: 'atlas-map-frame' });
  const listHolder = h('div', { class: 'finder' });
  const chips = h('div', { class: 'aqua-chips' });
  // Arriving from a journal entry: the map opens on that place's pin, its row selected.
  const from = ctx.param ? all.find((p) => p.slug === ctx.param) : null;
  let focusOnce = !!from;

  const draw = () => {
    const shown = all.filter((p) => filter === 'all' || p.category === filter);
    mapHolder.replaceChildren();
    const el = h('div', { class: 'atlas-map' });
    mapHolder.append(el);
    mountMap(el, {
      places: shown.map((p) => ({ lat: p.lat, lon: p.lon, title: p.title, category: p.category, href: `#/journal/${p.slug}`, sub: p.area || p.city })),
      style: 'mac',
      focus: focusOnce ? shown.indexOf(from) : -1
    });
    focusOnce = false;
    listHolder.replaceChildren(
      h('div', { class: 'finder-head' }, h('span', null, 'Name'), h('span', null, 'City'), h('span', null, 'Rating')),
      ...(shown.length
        ? shown.map((p) => h('a', { class: 'finder-row' + (p === from ? ' found' : ''), href: `#/journal/${p.slug}` }, h('span', null, h('span', { class: 'dot', style: { background: catColor(p.category) } }), p.title || 'Untitled'), h('span', null, p.city), h('span', null, p.rating != null ? `${p.rating}/5` : '–')))
        : [h('div', { class: 'finder-row empty' }, 'No places in this category yet.')])
    );
    chips.replaceChildren(
      h('button', { type: 'button', class: 'aqua-pill' + (filter === 'all' ? ' on' : ''), onclick: () => { filter = 'all'; sound.click(); draw(); } }, 'All'),
      ...present.map((c) =>
        h('button', { type: 'button', class: 'aqua-pill' + (filter === c ? ' on' : ''), onclick: () => { filter = c; sound.click(); draw(); } }, h('span', { class: 'dot', style: { background: catColor(c) } }), catLabel(c))
      )
    );
  };
  draw();
  return h('div', { class: 'atlas' }, h('div', { class: 'mac-toolbar' }, segmented('atlas')), h('div', { class: 'mac-pad' }, chips, mapHolder, listHolder));
}

// A form for visitors to suggest a place, book, film or podcast. Their name goes on a
// "Suggested by" stamp if the suggestion gets reviewed.
const SUGGEST_WORDS = { place: 'a place to try', book: 'a book to read', film: 'a film to watch', podcast: 'a podcast to listen to', music: 'an album or song', tv: 'a TV show to watch' };
export function suggestForm(kind, data, { cls = '', field = 'aqua-field', button = 'aqua-pill on' } = {}) {
  const who = data.site.owner || 'me';
  const msg = h('p', { class: 'form-msg', role: 'status' });
  const id = 'sg-' + kind;
  const form = h(
    'form',
    {
      class: 'suggest ' + cls,
      onsubmit: async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        try {
          await postForm('/api/suggest', { kind, ...Object.fromEntries(f.entries()) });
          e.target.reset();
          msg.textContent = 'Thanks! Your suggestion has been passed on.';
          sound.chime();
        } catch (err) {
          msg.textContent = err.message;
        }
      }
    },
    h('label', { class: 'sr', for: id }, `Suggest ${SUGGEST_WORDS[kind]}`),
    h('input', { id, name: 'title', class: field, placeholder: `Suggest ${SUGGEST_WORDS[kind]} for ${who}`, required: true, maxlength: 120 }),
    h('div', { class: 'suggest-row' },
      h('label', { class: 'sr', for: id + '-name' }, 'Your name'),
      h('input', { id: id + '-name', name: 'name', class: field, placeholder: 'Your name (for the stamp)', maxlength: 40, autocomplete: 'nickname' }),
      h('button', { type: 'submit', class: button }, 'Suggest')
    ),
    h('input', { name: 'website', class: 'hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' })
  );
  return h('div', { class: 'suggest-box' }, form, msg);
}

export function suggestedStamp(post) {
  return post.suggested_by ? h('span', { class: 'suggest-stamp' }, h('small', null, 'SUGGESTED BY'), post.suggested_by.toUpperCase()) : null;
}

function wishlist(ctx) {
  const { want, done } = ctx.data.wishlist;
  const all = places(ctx.data);
  const findReview = (w) => all.find((p) => p.title.toLowerCase() === w.name.toLowerCase());
  const form = suggestForm('place', ctx.data);
  const item = (w, isDone) => {
    const review = isDone ? findReview(w) : null;
    return h(
      'div',
      { class: 'wish' + (isDone ? ' done' : '') },
      h('span', { class: 'aqua-check' + (isDone ? ' on' : ''), 'aria-hidden': 'true', html: isDone ? ICON.check : '' }),
      h(
        'div',
        { class: 'wish-text' },
        h('strong', null, w.name),
        h('span', { class: 'muted' }, h('span', { class: 'dot', style: { background: catColor(w.category) } }), [w.city, w.category ? catLabel(w.category) : ''].filter(Boolean).join(' · ')),
        w.note ? h('em', { class: 'muted' }, w.note) : null,
        review ? h('a', { class: 'aqua-pill on small', href: `#/journal/${review.slug}` }, `${word('read_review', 'Read the review')} ›`) : null
      )
    );
  };
  return h(
    'div',
    { class: 'wishlist' },
    h('div', { class: 'mac-toolbar' }, segmented('wishlist')),
    h(
      'div',
      { class: 'mac-pad' },
      form,
      h('h3', { class: 'mac-label' }, `Want to go · ${want.length}`),
      want.length ? want.map((w) => item(w, false)) : h('p', { class: 'muted' }, 'Nothing on the list yet.'),
      done.length ? h('h3', { class: 'mac-label' }, 'Been there') : null,
      done.map((w) => item(w, true))
    )
  );
}

// ---------- Android guestbook ----------

function guestbook(ctx) {
  const digits = h('div', { class: 'led', role: 'img', 'aria-label': 'Visitor counter' });
  const setDigits = (n) => {
    const s = String(n == null ? 0 : n).padStart(6, '0');
    digits.replaceChildren(...[...s].map((d) => h('span', null, d)));
    digits.setAttribute('aria-label', `Visitor number ${n ?? 0}`);
  };
  setDigits(Number(session.getItem('visitor-number')) || 0);
  if (!session.getItem('visitor-number')) {
    fetch('/api/visit', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d.count) {
          session.setItem('visitor-number', d.count);
          setDigits(d.count);
        }
      })
      .catch(() => {});
  }

  const entries = ctx.data.guestbook.map((g) =>
    h(
      'div',
      { class: 'gb-entry' },
      h('span', { class: 'gb-avatar', html: ICON.person('#1d4f86') }),
      h(
        'div',
        { class: 'gb-text' },
        h('div', { class: 'gb-top' }, h('strong', null, g.name), h('span', { class: 'gb-date' }, niceDate(g.date))),
        h('p', null, g.message),
        g.reply ? h('div', { class: 'gb-reply' }, h('strong', null, (ctx.data.site.owner || 'Reply') + ' '), g.reply) : null
      )
    )
  );
  const msg = h('p', { class: 'form-msg', role: 'status' });
  const form = h(
    'form',
    {
      class: 'gb-form',
      onsubmit: async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        try {
          await postForm('/api/guestbook', Object.fromEntries(f.entries()));
          e.target.reset();
          msg.textContent = 'Thanks for signing! It appears once it has been approved.';
          sound.chime();
        } catch (err) {
          msg.textContent = err.message;
        }
      }
    },
    h('span', { class: 'gb-label' }, 'Sign the guestbook'),
    h('input', { name: 'name', class: 'droid-field', placeholder: 'Your name', 'aria-label': 'Your name', maxlength: 40 }),
    h('div', { class: 'gb-row' }, h('input', { name: 'message', class: 'droid-field', placeholder: 'Write something nice…', 'aria-label': 'Message', required: true, maxlength: 600 }), h('button', { type: 'submit', class: 'droid-btn' }, 'Sign')),
    h('input', { name: 'website', class: 'hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }),
    msg
  );
  return h(
    'div',
    { class: 'guestbook' },
    h('div', { class: 'gb-scroll' }, h('div', { class: 'counter' }, h('span', { class: 'counter-label' }, 'VISITOR COUNTER'), digits, h('span', { class: 'counter-sub' }, 'You are one of these')), h('div', { class: 'droid-section' }, 'SIGNATURES'), entries.length ? entries : h('p', { class: 'gb-empty' }, 'No signatures yet. Be the first.')),
    form
  );
}

// ---------- XP extras ----------

function stats(ctx) {
  const s = ctx.data.stats;
  if (!s) return h('div', { class: 'feed' }, h('p', { class: 'empty' }, 'No travel stats yet.'));
  const big = (label, value) => (value == null ? null : h('div', { class: 'bp-field' }, h('span', null, label), h('b', null, value)));
  const years = s.per_year && typeof s.per_year === 'object' ? Object.entries(s.per_year).sort(([a], [b]) => a.localeCompare(b)) : [];
  const max = Math.max(1, ...years.map(([, v]) => Number(v) || 0));
  return h(
    'div',
    { class: 'feed' },
    h(
      'div',
      { class: 'boarding-pass' },
      h('div', { class: 'bp-top' }, h('span', null, 'FLIGHT LOG'), h('span', null, 'ALL TIME')),
      h(
        'div',
        { class: 'bp-grid' },
        big('Flights', s.flights),
        big('Distance', s.distance_km != null ? Number(s.distance_km).toLocaleString('en-GB') + ' km' : null),
        big('In the air', s.hours != null ? s.hours + ' h' : null),
        big('Airports', s.airports),
        big('Countries', s.countries)
      ),
      h('div', { class: 'bp-tear', 'aria-hidden': 'true' })
    ),
    s.note_html ? h('article', { class: 'card' }, prose(s.note_html, 'card-body')) : null,
    years.length
      ? h('article', { class: 'card' }, h('header', { class: 'card-head' }, h('strong', null, 'Flights per year')), h('div', { class: 'bars' }, years.map(([y, v]) => h('div', { class: 'bar-row' }, h('span', null, y), h('span', { class: 'bar' }, h('span', { style: { width: ((Number(v) || 0) / max) * 100 + '%' } })), h('b', null, String(v))))))
      : null,
    Array.isArray(s.top_airlines) && s.top_airlines.length ? h('article', { class: 'card' }, h('header', { class: 'card-head' }, h('strong', null, 'Most-flown airlines')), h('ol', { class: 'plain-list' }, s.top_airlines.slice(0, 5).map((a) => h('li', null, String(a))))) : null,
    Array.isArray(s.top_aircraft) && s.top_aircraft.length ? h('article', { class: 'card' }, h('header', { class: 'card-head' }, h('strong', null, 'Most-flown aircraft')), h('ol', { class: 'plain-list' }, s.top_aircraft.slice(0, 5).map((a) => h('li', null, String(a))))) : null,
    h('p', { class: 'muted small' }, 'Totals only. No flight numbers, bookings, seats or exact times are kept.')
  );
}

// ---------- Profile grid ----------
// The posts you've put on your profile, as a grid of their first photos, newest first:
// a photo app's grid as Windows XP would have done it, in a "My Pictures" window with
// thumbnails, a toolbar and a status bar.
const postHref = (p) => (p.type === 'places' ? `#/journal/${p.slug}` : SHELF_TYPES.includes(p.type) ? `#/${p.type}/${p.slug}` : `#/post/${p.type}/${p.slug}`);
function profileGrid(data) {
  const picks = data.posts.filter((p) => p.profile && p.photos.length);
  if (!picks.length) return null;
  const photos = picks.reduce((n, p) => n + p.photos.length, 0);
  const places = picks.filter((p) => p.type === 'places').length;
  const tiles = picks.map((p, i) =>
    h(
      'a',
      { class: 'pg-tile', href: postHref(p), title: p.title || p.excerpt || '', style: { '--i': i } },
      // The photo you chose as its thumbnail, or the first.
      h('img', { src: p.photos[p.grid_cover] || p.photos[0], alt: p.captions?.[p.grid_cover || 0] || p.title || 'Photo', loading: 'lazy', decoding: 'async' }),
      p.photos.length > 1 ? h('span', { class: 'pg-many', 'aria-label': `${p.photos.length} photos`, html: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="4.5" y="1.5" width="10" height="10" rx="1" fill="none" stroke="#fff" stroke-width="1.6"/><rect x="1.5" y="4.5" width="10" height="10" rx="1" fill="#fff"/></svg>' }) : null,
      p.memory ? h('span', { class: 'pg-mem', 'aria-hidden': 'true' }, '◀◀') : null,
      h('span', { class: 'pg-name' }, (p.title || p.excerpt || 'Photo').slice(0, 40))
    )
  );
  // Thumbnails or a list with names, like the View menu in an XP folder.
  const box = h('section', { class: 'profile-grid' + (gridView === 'list' ? ' as-list' : ''), 'aria-label': 'Photos' });
  const view = (v, label, icon) => {
    const b = h('button', { type: 'button', class: 'pg-view', 'aria-pressed': String(gridView === v), title: label, 'aria-label': label }, icon);
    b.addEventListener('click', () => {
      gridView = v;
      box.classList.toggle('as-list', v === 'list');
      box.querySelectorAll('.pg-view').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    return b;
  };
  box.append(
    h('div', { class: 'pg-bar' }, h('span', { class: 'pg-title' }, h('span', { class: 'pg-icon', 'aria-hidden': 'true', html: ICON.camera }), 'My Pictures'), h('span', { class: 'pg-tools' }, view('grid', 'Thumbnails', '▦'), view('list', 'List', '☰'))),
    h('div', { class: 'pg-counts' }, h('span', null, h('b', null, String(picks.length)), ' posts'), h('span', null, h('b', null, String(photos)), ' photos'), places ? h('span', null, h('b', null, String(places)), places === 1 ? ' place' : ' places') : null),
    h('div', { class: 'pg-tiles' }, tiles),
    h('div', { class: 'pg-status' }, `${picks.length} object${picks.length === 1 ? '' : 's'}`)
  );
  return box;
}
let gridView = 'grid';

// Friends who run their own copy of this site (only if you've chosen to show them): a little
// friends list linking to their sites.
function buddiesCard(data) {
  const list = Array.isArray(data.buddies) ? data.buddies.filter((b) => b && /^https?:\/\//.test(b.url)) : [];
  if (!list.length) return null;
  return h(
    'section',
    { class: 'card buddies' },
    h('h2', { class: 'buddies-title' }, h('span', { class: 'buddies-logo', 'aria-hidden': 'true' }), `My buddies (${list.length})`),
    h(
      'ul',
      null,
      list.map((b) =>
        h(
          'li',
          null,
          presenceDot({ presence: b.presence }),
          h('a', { href: b.url, target: '_blank', rel: 'noopener noreferrer' }, b.name),
          b.owner ? h('span', { class: 'muted' }, ` (${b.owner})`) : null,
          b.status ? h('span', { class: 'buddy-says' }, ' – ', withEmoticons(b.status, 14)) : null
        )
      )
    )
  );
}

function about(ctx) {
  return h(
    'div',
    { class: 'feed' },
    profileTile(ctx.data, true),
    h('article', { class: 'card' }, prose(ctx.data.site.about_html, 'card-body')),
    profileGrid(ctx.data),
    buddiesCard(ctx.data),
    h('p', { class: 'muted small' }, 'No trackers, no ads, no cookies. Your sound and wallpaper choices stay in your own browser.')
  );
}

export const APPS = {
  home: { title: (d) => d.site.name, era: 'xp', icon: 'globe', size: [500, 640], nav: true, render: feed('all', true) },
  thoughts: { title: 'Thoughts', era: 'xp', icon: 'bubble', size: [480, 620], nav: true, render: feed(['thoughts'], true) },
  more: { title: 'Photo dumps & lists', era: 'xp', icon: 'camera', size: [480, 620], nav: true, render: feed(['photos', 'lists', 'quotes'], false) },
  post: { title: 'Post', era: 'xp', icon: 'bubble', size: [480, 560], nav: true, render: single },
  journal: { title: 'Places Journal', era: 'leather', size: [900, 620], render: journal },
  passport: { title: 'Passport', era: 'leather', size: [560, 680], render: passport },
  atlas: { title: 'Atlas', era: 'mac', size: [680, 600], render: atlas },
  wishlist: { title: 'Wishlist', era: 'mac', size: [460, 600], render: wishlist },
  guestbook: { title: 'Guestbook', era: 'android', size: [400, 620], render: guestbook },
  stats: { title: 'Travel stats', era: 'xp', icon: 'globe', size: [460, 580], nav: true, render: stats },
  about: { title: 'About', era: 'xp', icon: 'bubble', size: [500, 640], nav: true, render: about },
  search: { title: 'Search', era: 'xp', icon: 'search', size: [520, 620], nav: true, render: search },
  books: { title: 'Bookshelf', era: 'shelf', size: [620, 640], render: shelfApp('books') },
  films: { title: 'Cinema', era: 'cinema', size: [620, 640], render: shelfApp('films') },
  podcasts: { title: 'Podcasts', era: 'tape', size: [560, 640], render: shelfApp('podcasts') },
  music: { title: 'Record crate', era: 'record', size: [620, 640], render: shelfApp('music') },
  tv: { title: 'TV', era: 'crt', size: [620, 640], render: shelfApp('tv') },
  album: { title: 'Photo album', era: 'album', size: [760, 680], render: albumApp },
  friends: { title: 'Friends', era: 'xp', icon: 'bubble', size: [480, 680], nav: true, render: friendsApp }
};

// If a page can't be drawn (something in a post it didn't expect), it says so and offers a
// way out, instead of leaving a blank screen. The rest of the site keeps working.
export function renderSafely(id, ctx) {
  try {
    return APPS[id].render(ctx);
  } catch (e) {
    console.error(e);
    return h(
      'div',
      { class: 'snag', role: 'alert' },
      h('span', { class: 'snag-floppy', html: floppySvg() }),
      h('div', null, h('strong', null, 'This page hit a snag.'), h('p', null, 'Something in one of the posts confused it. The rest of the site is fine.'), h('p', { class: 'snag-floppy-says' }, 'Floppy: "I may have chewed on something. Sorry."'), h('a', { href: '#/', class: 'snag-home' }, 'Go to the home page'), h('details', null, h('summary', null, 'Details'), h('code', null, String(e?.message || e))))
    );
  }
}

export function appTitle(id, data) {
  const t = APPS[id]?.title;
  // (A section you've renamed keeps your name on its window too; Home's window is your site.)
  const own = id !== 'home' && activeSkin()?.labels?.[id];
  return own || (typeof t === 'function' ? t(data) : t || '');
}

export function parseRoute(hashStr) {
  const parts = String(hashStr || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { app: 'home', param: '' };
  const [first, ...rest] = parts;
  if (first === 'welcome') return { app: 'welcome', param: '' };
  if (APPS[first]) return { app: first, param: rest.join('/') };
  return { app: 'home', param: '' };
}

export { esc, monthYear };
