// How a post's card is dressed: a design for the card itself (Polaroid, Scrapbook, Postcard…,
// the theme's or the post's own), ribbons like "Reliving a memory" (one of your own words, and
// one for a post written on a festive day or one of your own days), and a mark in the corner
// (the season it was written in, or the theme's charm). All drawn from the theme's colours, so
// they suit any theme, light or dark. The looks themselves are in css/cards.css.
import { h } from './util.js';
import { activeSkin, OPTIONS, FESTIVALS, FESTIVE_COLOURS, festivalOn, lookOf, seasonOf, drawingUrl, SEASONS, luminance, ownCardsCss } from './skins.js';

// One of your own card designs (Themes › Post cards).
export const isOwnCard = (id, t = activeSkin()) => !!id && !!t?.cards?.some((c) => c.id === id);
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

// Dresses a card (made by apps.js) for its post. `open`: the post on its own page.
export function dressCard(el, post, open = false) {
  if (!el || !post) return el;
  const t = activeSkin();
  const style = CARD_STYLES[post.card] || isOwnCard(post.card, t) ? post.card : t?.card_style || 'classic';
  if (style !== 'classic') el.dataset.card = style;
  else delete el.dataset.card;
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
    el.style.setProperty('--card-pic', drawingUrl(t?.decoration && !['none', 'plain'].includes(t.decoration) ? t.decoration : 'heart', t || {}, 28));
    if (post.ts) el.dataset.day = new Date(post.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const corner = cornerMark(post, t);
  if (corner) {
    const date = el.querySelector(':scope > .card-head > .card-date');
    if (date) date.before(corner);
    else el.append(corner);
  }
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
