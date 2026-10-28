// The Friends tab: posts from friends who run their own copy of this site, as one scrollable
// feed (newest first), under a list of your friends. Tap a buddy to see only their posts. Everything comes through your own site; nothing loads from theirs.
import { h } from './util.js';
import { presenceDot, ago } from './statusbar.js';
import { withEmoticons } from './emoticons.js';
import { friendHtml } from './friend-html.js';
import { card, foldLong } from './apps.js';
import { friendSkin } from './card-dress.js';

// Each friend's post cards (from their site), by the name their posts use.
let looks = {};

const TYPE = { thoughts: ['💭', 'Thought'], places: ['📍', 'Place'], photos: ['📷', 'Photos'], lists: ['📝', 'List'], quotes: ['❝', 'Quote'], books: ['📖', 'Book'], films: ['🎬', 'Film'], podcasts: ['🎧', 'Podcast'], music: ['🎵', 'Music'], tv: ['📺', 'TV'] };
const AVATAR = ['#3a86e8', '#4bb043', '#e8692c', '#b0306a', '#7a4ab8', '#1f9d8f', '#d4a017', '#2a6fd6'];
const colourFor = (s) => AVATAR[[...String(s)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR.length];
const initial = (s) => (String(s || '?').trim()[0] || '?').toUpperCase();
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : null);

let only = null;

// A square user picture, like the ones on the XP welcome screen.
function avatar(who, size = 'small') {
  return h('span', { class: `ff-avatar ${size}`, style: { '--av': colourFor(who.url || who.name) }, 'aria-hidden': 'true' }, initial(who.owner || who.name));
}

function buddyList(buddies, redraw) {
  const online = buddies.filter((b) => b.presence !== 'offline').length;
  return h(
    'section',
    { class: 'ff-buddies', 'aria-label': 'Buddies' },
    h('div', { class: 'ff-buddies-title' }, h('span', { class: 'ff-logo', 'aria-hidden': 'true' }), 'Buddies', h('small', null, ` (${online} of ${buddies.length} online)`)),
    h(
      'ul',
      null,
      buddies.map((b) =>
        h(
          'li',
          null,
          h(
            'button',
            { type: 'button', class: 'ff-buddy' + (only === b.url ? ' on' : ''), 'aria-pressed': String(only === b.url), onclick: () => { only = only === b.url ? null : b.url; redraw(); } },
            presenceDot({ presence: b.presence }),
            avatar(b),
            h('span', { class: 'ff-buddy-text' }, h('b', null, b.owner || b.name), b.owner ? h('small', null, ` (${b.name})`) : null, b.status ? h('span', { class: 'ff-buddy-status' }, withEmoticons(b.status, 14)) : null)
          )
        )
      )
    )
  );
}

function photos(list, title) {
  if (!list.length) return null;
  const strip = h('div', { class: 'ff-photos', tabindex: '0', 'aria-label': `${list.length} photo${list.length === 1 ? '' : 's'}` }, list.map((src, i) => h('img', { src, alt: title ? `${title}, photo ${i + 1}` : `Photo ${i + 1}`, loading: 'lazy', decoding: 'async' })));
  if (list.length < 2) return h('div', { class: 'ff-media' }, strip);
  const dots = h('div', { class: 'ff-dots', 'aria-hidden': 'true' }, list.map((_, i) => h('span', { class: i ? '' : 'on' })));
  strip.addEventListener('scroll', () => {
    const at = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === at));
  }, { passive: true });
  return h('div', { class: 'ff-media' }, strip, dots, h('span', { class: 'ff-count' }, `1/${list.length}`));
}

function postCard(p) {
  const who = p.friend || {};
  const [emoji, word] = TYPE[p.type] || ['•', 'Post'];
  const link = safeUrl(p.url);
  const site = safeUrl(who.url);
  const meta = [p.creator, p.city].filter(Boolean).join(' · ');
  const text = friendHtml(p.html, 'ff-text prose');
  const card = h(
    'article',
    { class: 'ff-post' + (p.photos.length ? '' : ' no-photo') },
    h(
      'header',
      { class: 'ff-head' },
      avatar(who),
      h('span', { class: 'ff-who' }, site ? h('a', { href: site, target: '_blank', rel: 'noopener noreferrer' }, h('b', null, who.name)) : h('b', null, who.name), h('small', null, `${emoji} ${word} · ${ago(p.ts)}`))
    ),
    photos(p.photos, p.title),
    h(
      'div',
      { class: 'ff-body' },
      p.title ? h('h3', { class: 'ff-title' }, p.title) : null,
      meta || p.rating != null ? h('div', { class: 'ff-meta' }, meta, p.rating != null ? h('span', { class: 'ff-stars', 'aria-label': `Rated ${p.rating} out of 5` }, (meta ? ' · ' : '') + '★'.repeat(Math.max(0, Math.min(5, Math.round(p.rating))))) : null) : null,
      text,
      link ? h('a', { class: 'ff-open', href: link, target: '_blank', rel: 'noopener noreferrer' }, `See it on ${who.owner || who.name}’s site ↗`) : null
    )
  );
  // Long posts fold to a few lines, with "more" to read the rest.
  requestAnimationFrame(() => {
    if (text.scrollHeight > text.clientHeight + 4) {
      const more = h('button', { type: 'button', class: 'ff-more', onclick: () => { text.classList.add('open'); more.remove(); } }, 'more');
      text.after(more);
    } else text.classList.add('open');
  });
  return card;
}

// A post that came in full is drawn just as it looks on your friend's site (keepsakes, a
// memory's ribbon, its font and all), with who it's from on top. Its links go to their site.
function friendCard(p) {
  const who = p.friend || {};
  const site = safeUrl(who.url);
  let el = null;
  try {
    // (Their writing, made into HTML by your own site, goes through the friends' cleaner too.)
    // (Their post cards too: the one they chose, from their mix, or one they made.)
    const skin = friendSkin(who.look, looks[who.look]);
    el = card({ ...p.full, html: friendHtml(p.full.html, 'x').innerHTML, ...(skin ? { friend_look: skin, friend_id: who.look } : { card: /^c\d+$/.test(p.full.card || '') ? '' : p.full.card }) });
  } catch (e) {
    console.error(e);
  }
  if (!el) return postCard(p);
  for (const a of el.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#/') && site) Object.assign(a, { href: site + '/' + href, target: '_blank', rel: 'noopener noreferrer' });
    else if (!/^https?:\/\//i.test(href)) a.removeAttribute('href');
  }
  el.classList.add('ff-full');
  el.prepend(
    h(
      'div',
      { class: 'ff-head ff-from' },
      avatar(who),
      h('span', { class: 'ff-who' }, site ? h('a', { href: site, target: '_blank', rel: 'noopener noreferrer' }, h('b', null, who.name)) : h('b', null, who.name), h('small', null, ago(p.ts)))
    )
  );
  const link = safeUrl(p.url);
  if (link) el.append(h('a', { class: 'ff-open', href: link, target: '_blank', rel: 'noopener noreferrer' }, `See it on ${who.owner || who.name}’s site ↗`));
  return foldLong(el, p.full);
}

export function friendsApp(ctx) {
  const buddies = ctx.data.buddies || [];
  const all = ctx.data.friendPosts || [];
  looks = ctx.data.friendLooks || {};
  const wrap = h('div', { class: 'feed ff' });
  const redraw = () => {
    const posts = only ? all.filter((p) => p.friend?.url === only) : all;
    const pick = buddies.find((b) => b.url === only);
    const parts = [
      buddies.length ? buddyList(buddies, redraw) : null,
      pick
        ? h(
            'div',
            { class: 'ff-pick' },
            presenceDot({ presence: pick.presence }),
            h('b', null, pick.owner || pick.name),
            pick.status ? h('span', { class: 'ff-pick-status' }, ' – ', withEmoticons(pick.status, 15)) : null,
            h('button', { type: 'button', class: 'ff-all', onclick: () => { only = null; redraw(); } }, 'Everyone')
          )
        : null,
      posts.length
        ? posts.map((p) => (p.full ? friendCard(p) : postCard(p)))
        : ctx.data.friendsTab === false
          ? h('div', { class: 'card ff-empty' }, h('p', null, `${ctx.data.site.owner || 'This site'} keeps friends’ posts private.`))
          : h('div', { class: 'card ff-empty' }, h('p', null, buddies.length ? 'No posts from friends yet.' : `${ctx.data.site.owner || 'This site'} hasn’t added any friends yet.`), h('p', { class: 'muted small' }, 'Friends are people who run their own copy of this site.'))
    ];
    wrap.replaceChildren(...parts.flat().filter(Boolean));
  };
  redraw();
  return wrap;
}
