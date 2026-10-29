// How a post's card is dressed: a design for the card itself (Polaroid, Scrapbook, Postcard…,
// the theme's or the post's own), ribbons like "Reliving a memory" (one of your own words, and
// one for a post written on a festive day or one of your own days), and a mark in the corner
// (the season it was written in, or the theme's charm). All drawn from the theme's colours, so
// they suit any theme, light or dark. The looks themselves are in css/cards.css.
import { h } from './util.js';
import { activeSkin, resolveSkin, OPTIONS, FESTIVALS, FESTIVE_COLOURS, festivalOn, lookOf, seasonOf, drawingUrl, SEASONS, luminance, ownCardsCss, mix } from './skins.js';
import { MIX, mixPick } from './card-parts.js';

// One of your own card designs (Themes › Post cards).
export const isOwnCard = (id, t = activeSkin()) => !!id && !!t?.cards?.some((c) => c.id === id);
// The theme's card for a post: the one for every post, or (mixed at random) the one this post
// always draws from the mix.
export const themeCard = (post, t = activeSkin()) => (t?.card_style === MIX ? mixPick(`${post?.type}/${post?.slug || post?.title || ''}`, t.card_mix || [], t.card_seed) : t?.card_style || 'classic');
// The designs printed on pale paper, whatever the mode.
const LIGHT_PAPER = new Set(['polaroid', 'scrapbook', 'notebook', 'postcard', 'sticky', 'letter', 'film']);
// A post's own ribbon: a few words in one of these.
export const RIBBONS = { banner: 'Folded banner', sash: 'Corner sash', stamp: 'Rubber stamp', neon: 'Neon sign', sticker: 'Round sticker' };
export const CARD_STYLES = OPTIONS.card_style.choices;

const hash = (s) => [...String(s)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
const okHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));

// The festive day (or your own day) a post was written on, if it's one you mark.
export function festiveOf(post, t = activeSkin()) {
  if (!t || t.card_festive === 'off' || !post?.ts) return null;
  const ticked = [...(t.festivals || []), ...(FESTIVALS[t.seasons] ? [t.seasons] : [])];
  const id = festivalOn(new Date(post.ts), ticked, t.my_days || [], t.festival_dates || {});
  if (!id) return null;
  const look = lookOf(id, t);
  if (!look) return null;
  const own = id.startsWith('my_');
  return { id, name: look.name, quiet: !!look.quiet, own, charms: look.charms?.length ? look.charms : ['twinkle'], colours: FESTIVE_COLOURS[id] || [t.accent, t.main, '#f6c431'] };
}

// A ribbon of your own words.
export function ownRibbon(post, t = activeSkin()) {
  const words = String(post?.ribbon || '').trim();
  if (!words) return null;
  const style = RIBBONS[post.ribbon_style] ? post.ribbon_style : 'banner';
  const colour = okHex(post.ribbon_colour) ? post.ribbon_colour : t?.accent || '#3a9a3a';
  return h('div', { class: `card-ribbon rb-${style}`, style: { '--rb': colour, '--rb-text': luminance(colour) > 0.5 ? '#2a2a2a' : '#ffffff' } }, h('span', { class: 'rb-text' }, words));
}

// The festive day's ribbon, in its own colours and drawings.
export function festiveRibbon(post, t = activeSkin()) {
  const f = festiveOf(post, t);
  if (!f) return null;
  const pic = (what) => h('span', { class: 'fr-pic', 'aria-hidden': 'true', style: { backgroundImage: drawingUrl(what, t, 24) } });
  const [a, b, c] = f.colours;
  // (A quiet day keeps it simple: its drawing and its name.)
  return h(
    'div',
    { class: 'card-festive' + (f.quiet ? ' quiet' : ''), style: { '--f1': a, '--f2': b || a, '--f3': c || b || a } },
    pic(f.charms[0]),
    h('span', { class: 'fr-what' }, f.quiet ? 'Written during' : 'Posted on'),
    h('span', { class: 'fr-name' }, f.name),
    f.quiet ? null : pic(f.charms[1 % f.charms.length])
  );
}

// The mark in the corner: the season it was written in, or the theme's charm.
function cornerMark(post, t) {
  if (!t || t.card_corner === 'none' || !t.card_corner) return null;
  let what = '';
  let label = '';
  if (t.card_corner === 'season' && post.ts) {
    const season = seasonOf(new Date(post.ts), t.hemisphere === 'south');
    what = SEASONS[season].charms[hash(post.slug) % SEASONS[season].charms.length];
    label = `Written in ${SEASONS[season].name.toLowerCase()}`;
  } else if (t.card_corner === 'charm' && t.decoration && !['none', 'plain'].includes(t.decoration)) what = t.decoration;
  if (!what) return null;
  return h('span', { class: 'card-corner', role: label ? 'img' : null, 'aria-label': label || null, 'aria-hidden': label ? null : 'true', title: label || null, style: { backgroundImage: drawingUrl(what, t, 28) } });
}

// ---------- a friend's post cards ----------
// A friend's post wears the card they chose on their own site: theirs for every post, the one it
// draws from their mix, or one they made (drawn here as f0-c1 and so on, so it can't be taken for
// one of yours), in their theme's colours and charm.
const friendSkins = new Map();
export function friendSkin(id, look) {
  if (!/^f\d{1,3}$/.test(String(id)) || !look) return null;
  if (!friendSkins.has(id) || friendSkins.get(id).look !== look) {
    const skin = resolveSkin(look);
    friendSkins.set(id, { look, skin });
    if (typeof document !== 'undefined') {
      let style = document.getElementById(`friend-cards-${id}`);
      if (!style) {
        style = document.createElement('style');
        style.id = `friend-cards-${id}`;
        document.head.append(style);
      }
      style.textContent = ownCardsCss({ ...skin, cards: skin.cards.map((c) => ({ ...c, id: `${id}-${c.id}` })) });
    }
  }
  return friendSkins.get(id).skin;
}

// Dresses a card (made by apps.js) for its post. `open`: the post on its own page. A friend's
// post (with `friend_look`, their skin, and `friend_id`) wears their card.
export function dressCard(el, post, open = false) {
  if (!el || !post) return el;
  const t = activeSkin();
  const look = post.friend_look || t;
  const style = CARD_STYLES[post.card] || isOwnCard(post.card, look) ? post.card : themeCard(post, look);
  if (style !== 'classic') el.dataset.card = look !== t && isOwnCard(style, look) ? `${post.friend_id}-${style}` : style;
  else delete el.dataset.card;
  // What it's printed on: the papery designs (and cards of your own on pale paper) stay light in
  // dark mode, and a card of your own on dark paper stays dark in light mode, so the date, the
  // Comment button and the rest are drawn for the paper, not the mode (see cards.css).
  const own = isOwnCard(style, look) ? look.cards.find((c) => c.id === style) : null;
  const paper = own ? (luminance(own.paper || '#ffffff') > 0.45 ? 'light' : 'dark') : LIGHT_PAPER.has(style) ? 'light' : '';
  if (paper) el.dataset.paper = paper;
  else delete el.dataset.paper;
  // (In their colours.)
  if (look !== t && style !== 'classic' && look) {
    el.style.setProperty('--sk-main', look.main);
    el.style.setProperty('--sk-accent', look.accent);
    el.style.setProperty('--sk-soft', mix(look.accent, '#ffffff', 0.72));
  }
  // A little tilt for the papery ones, different for each post (and none on its own page).
  el.style.setProperty('--card-tilt', open ? '0deg' : `${((hash(post.slug || post.title) % 5) - 2) * 0.45}deg`);
  const ribbons = [ownRibbon(post, t), festiveRibbon(post, t)].filter(Boolean);
  if (ribbons.length) {
    const head = el.querySelector(':scope > .card-head');
    const memory = el.querySelector(':scope > .mem-ribbon');
    const after = memory || head;
    if (after) after.after(...ribbons);
    else el.prepend(...ribbons);
  }
  // (Postcards and letters put the theme's charm on their stamp and seal; a Polaroid writes the
  // day along its bottom.)
  if (style !== 'classic') {
    el.style.setProperty('--card-pic', drawingUrl(look?.decoration && !['none', 'plain'].includes(look.decoration) ? look.decoration : 'heart', look || {}, 28));
    if (post.ts) el.dataset.day = new Date(post.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const corner = cornerMark(post, t);
  if (corner) {
    const date = el.querySelector(':scope > .card-head > .card-date');
    if (date) date.before(corner);
    else el.append(corner);
  }
  // Where the season and festive days settle, on any design (drawn by skins.css when one is on):
  // snow along the card's top, and a little drawing in its heading by the date.
  if (!el.querySelector(':scope > .card-snow')) el.append(h('span', { class: 'card-snow', 'aria-hidden': 'true' }));
  const head = el.querySelector(':scope > .card-head');
  if (head && !head.querySelector(':scope > .card-season')) head.append(h('span', { class: 'card-season', 'aria-hidden': 'true' }));
  return el;
}

// A little card in one of the designs, for choosing between them in the back office.
export function miniCard(id, t = activeSkin()) {
  const pic = drawingUrl(t?.decoration && !['none', 'plain'].includes(t.decoration) ? t.decoration : 'heart', t || {}, 28);
  return h(
    'span',
    { class: 'dress-mini-wrap', 'aria-hidden': 'true' },
    h(
      'span',
      { class: 'card dress-mini', 'data-card': (CARD_STYLES[id] && id !== 'classic') || isOwnCard(id, t) ? id : null, 'data-day': '22 Oct', style: { '--card-tilt': '0deg', '--card-pic': pic } },
      h('span', { class: 'card-head' }, h('strong', null, 'Thought'), h('span', { class: 'card-date' }, '22 Oct')),
      h('span', { class: 'card-body' }, h('i'), h('i'), h('i'))
    )
  );
}

// "Mixed at random", as a little fan of three of the designs in the mix.
export function mixMini(t = activeSkin(), mix = t?.card_mix || []) {
  const three = mix.length ? [0, 1, 2].map((i) => mix[Math.floor((i * mix.length) / 3)]) : ['polaroid', 'scrapbook', 'postcard'];
  const fan = h('span', { class: 'dress-mini-wrap dress-mix', 'aria-hidden': 'true' });
  three.forEach((id, i) => {
    const one = miniCard(id, t).firstChild;
    one.style.setProperty('--card-tilt', `${(i - 1) * 7}deg`);
    one.style.setProperty('--mix-at', i);
    fan.append(one);
  });
  return fan;
}

// ---------- the profile header, dressed for the day ----------
// While a season or festive day is on (and allowed to settle on the profile header), bunting in
// its colours runs along the top of the header and a few of its drawings sit beside "Last post"
// like stickers. A quiet day keeps it to one small drawing and no bunting.
const SEASON_COLOURS = { winter: ['#9cc2e4', '#ffffff', '#d94a5c'], spring: ['#ffb3c7', '#bfe6a0', '#ffe08a'], summer: ['#ffd23f', '#46c1d9', '#ff8a3d'], autumn: ['#e2622b', '#d99a1c', '#8a5a33'] };
const svgData = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
export function profileDecor(t = activeSkin()) {
  const id = t?.today?.festival || t?.today?.season;
  const look = id ? lookOf(id, t) : null;
  if (!look) return { bunting: null, stickers: null };
  const charms = look.charms?.length ? look.charms : ['twinkle'];
  const [a, b, c] = FESTIVE_COLOURS[id] || SEASON_COLOURS[id] || [t.accent, t.main, '#f6c431'];
  const day = Math.floor(Date.now() / 864e5);
  const flag = (x, fill) => `<path d="M${x} 3.2l7 0.6-3.2 9.4z" fill="${fill}" stroke="rgba(0,0,0,.28)" stroke-width=".6" stroke-linejoin="round"/>`;
  const bunting = look.quiet ? null : h('span', { class: 'pd-bunting', 'aria-hidden': 'true', style: { backgroundImage: svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="16" viewBox="0 0 48 16"><path d="M0 3c8 1.4 16 1.4 24 0s16-1.4 24 0" fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".8"/>${flag(3, a)}${flag(19, b || a)}${flag(35, c || b || a)}</svg>`) } });
  const stickers = h(
    'span',
    { class: 'pd-stickers', role: 'img', 'aria-label': look.name },
    (look.quiet ? [0] : [0, 1, 2]).map((i) => h('span', { class: 'pd-sticker', style: { backgroundImage: drawingUrl(charms[(day + i) % charms.length], t, 40), '--pd-tilt': `${[-10, 8, -3][i]}deg` } }))
  );
  return { bunting, stickers };
}

// In the back office (which doesn't wear the theme), your own cards' looks, so their previews show.
export function ensureOwnCardsCss(t, doc = document) {
  let style = doc.getElementById('own-cards-css');
  if (!style) {
    style = doc.createElement('style');
    style.id = 'own-cards-css';
    doc.head.append(style);
  }
  style.textContent = ownCardsCss(t);
}
