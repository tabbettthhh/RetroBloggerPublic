// The Friends tab: posts from friends who run their own copy of this site, as one scrollable
// feed (newest first), under a list of your friends. Tap a buddy to see only their posts. Everything comes through your own site; nothing loads from theirs.
// (Signed in, their posts are mixed into your Home too: see friendPost.)
import { h } from './util.js';
import { presenceDot, ago } from './statusbar.js';
import { withEmoticons } from './emoticons.js';
import { friendHtml } from './friend-html.js';
import { card, foldLong } from './apps.js';
import { friendSkin } from './card-dress.js';
import { ownerHooks } from './owner-door.js';
import { sound } from './sound.js';
import { activeSkin, lookOf, drawingUrl, festiveScenery } from './skins.js';

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

// Your friends' photos of the day, as polaroids pegged along a washing line at the top of
// Friends: scroll along it. Each is the very one their own site shows today. Tapping one opens
// its post (signed in: here, if it's in your feed, or on their site as their friend).
// The line dresses for the season or festive day, as the rest of the site does (and not at all
// when they're switched off): the day's drawings hang between the photos, a festive day strings
// its garland along the wire, and in winter snow settles on it.
function lineDress() {
  const on = document.documentElement.dataset;
  const t = activeSkin();
  const id = on.festival ? t?.today?.festival : on.season;
  const look = id && t ? lookOf(id, t) : null;
  if (!look?.charms?.length) return null;
  let garland = '';
  try {
    garland = on.festival ? festiveScenery(look, id, t).garland : '';
  } catch {}
  return { charm: (i) => drawingUrl(look.charms[i % look.charms.length], t, 26), garland };
}
function photoLine(days) {
  const today = days.filter((b) => b.photo_day?.src);
  if (!today.length) return null;
  const dress = lineDress();
  const pin = (b, i) => {
    const d = b.photo_day;
    const name = (b.owner || b.name || '').split(/\s+/)[0];
    const a = h(
      'a',
      { class: 'pl-pin', href: d.url, target: '_blank', rel: 'noopener noreferrer', title: `${name}’s photo of the day${d.cap ? ': ' + d.cap : ''}`, style: `--tilt:${[-3, 2.5, -1.5, 3.5, -2.5, 1.5][i % 6]}deg; --sway:${(i % 3) * 0.6}s` },
      h('span', { class: 'pl-peg', 'aria-hidden': 'true' }),
      h('span', { class: 'pl-photo' }, h('img', { src: d.src, alt: d.cap || `${name}’s photo of the day`, loading: 'lazy' }), h('span', { class: 'pl-name' }, name)),
      // (The season's or day's drawing, hanging on the wire after it.)
      dress ? h('span', { class: 'pl-charm', 'aria-hidden': 'true', style: `background-image:${dress.charm(i)}; --tilt:${i % 2 ? 6 : -6}deg; --sway:${(i % 3) * 0.5}s` }) : null
    );
    a.addEventListener('click', (e) => {
      sound.click?.();
      // (Signed in: their post in your feed, if it's there, or their site as their friend.)
      if (!b.key) return;
      const card = document.querySelector(`[data-friend-post="${CSS.escape(`${b.key}|${d.id}`)}"]`);
      if (card) {
        e.preventDefault();
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        card.classList.remove('pl-found');
        void card.offsetWidth;
        card.classList.add('pl-found');
      } else if (ownerHooks.visitFriend) {
        e.preventDefault();
        ownerHooks.visitFriend(b.key, d.url);
      }
    });
    return a;
  };
  return h(
    'section',
    { class: 'pl', 'aria-label': 'Friends’ photos of the day' },
    h('div', { class: 'pl-title' }, '📷 Friends’ photos of the day'),
    h(
      'div',
      { class: 'pl-scroll' },
      h(
        'div',
        { class: 'pl-line' + (dress ? ' dressed' : '') + (dress?.garland ? ' festive' : ''), style: dress?.garland ? `--pl-garland:${dress.garland}` : null },
        today.map(pin)
      )
    )
  );
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

// Which friend's post a card is, for the owner's tools (commenting on it from here).
function markFriendPost(el, p) {
  const who = p.friend || {};
  // (Never taken for one of your own posts that happens to share its name.)
  delete el.dataset.post;
  if (who.key && p.id) el.dataset.friendPost = `${who.key}|${p.id}`;
  // (Friends-only: theirs for you to see, never your visitors.)
  if (p.friends_only) el.querySelector('.ff-who small')?.append(h('span', { class: 'ff-only' }, ' · 👥 friends only'));
  return el;
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
      // (Not for a friends-only post: on their site it's only for friends visiting with a pass.)
      link && !p.friends_only ? h('a', { class: 'ff-open', href: link, target: '_blank', rel: 'noopener noreferrer' }, `See it on ${who.owner || who.name}’s site ↗`) : null
    )
  );
  // Long posts fold to a few lines, with "more" to read the rest.
  requestAnimationFrame(() => {
    if (text.scrollHeight > text.clientHeight + 4) {
      const more = h('button', { type: 'button', class: 'ff-more', onclick: () => { text.classList.add('open'); more.remove(); } }, 'more');
      text.after(more);
    } else text.classList.add('open');
  });
  return markFriendPost(card, p);
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
  if (link && !p.friends_only) el.append(h('a', { class: 'ff-open', href: link, target: '_blank', rel: 'noopener noreferrer' }, `See it on ${who.owner || who.name}’s site ↗`));
  return markFriendPost(foldLong(el, p.full), p);
}

// A friend's post, drawn as on their site with who it's from on top (for your Home, signed in).
export function friendPost(p, data) {
  looks = data?.friendLooks || looks;
  const el = p.full ? friendCard(p) : postCard(p);
  el.classList.add('ff-in-home');
  return el;
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
      // (First of all: today's photos, on the line.)
      only ? null : photoLine(ctx.data.friendDays || []),
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
        : // (Never why: to a visitor, there's just nothing from friends yet.)
          ctx.data.friendsTab === false || (!buddies.length && !ctx.data.ownerView)
          ? h('div', { class: 'card ff-empty' }, h('p', null, 'No posts from friends yet.'))
          : h('div', { class: 'card ff-empty' }, h('p', null, buddies.length ? 'No posts from friends yet.' : `${ctx.data.site.owner || 'This site'} hasn’t added any friends yet.`), h('p', { class: 'muted small' }, 'Friends are people who run their own copy of this site.'))
    ];
    wrap.replaceChildren(...parts.flat().filter(Boolean));
  };
  redraw();
  return wrap;
}
