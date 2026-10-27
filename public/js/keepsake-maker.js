// Keepsakes you design yourself (keepsakes.md, made in the back office under Designs).
// Each one picks a shape, three colours, a heading and optionally a picture you uploaded; a
// post sticks it in with lines of its own, the same way as the built-in keepsakes.
import { h } from './util.js';

export const SHAPES = {
  ticket: 'Ticket with a stub',
  card: 'Folded card',
  tag: 'Tag on a string',
  badge: 'Round badge',
  sticker: 'Sticker',
  note: 'Handwritten note',
  picture: 'Just my picture'
};
// The colours a new one starts with, per shape: paper, ink, accent.
export const SHAPE_COLOURS = {
  ticket: ['#f3e3b5', '#3a2c1c', '#c0392b'],
  card: ['#fffdf6', '#3a2c1c', '#b08a3a'],
  tag: ['#f0e2c0', '#3a2c1c', '#8a5a2a'],
  badge: ['#2a6fd6', '#ffffff', '#ffd23c'],
  sticker: ['#ffd23c', '#1a1a1a', '#d6332b'],
  note: ['#fff6a8', '#24305c', '#e0b84a'],
  picture: ['#ffffff', '#24305c', '#c0392b']
};

let DESIGNS = new Map();
// Called once the site's data has loaded.
export function registerKeepsakes(list = []) {
  DESIGNS = new Map((list || []).map((d) => [d.id, d]));
}
export const keepsakeDesign = (id) => DESIGNS.get(id);

const mediaUrl = (key) => (key ? '/media/' + key.split('/').map(encodeURIComponent).join('/') : '');
const day = (post) => new Date(post.ts || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
function hash(str) {
  let n = 2166136261;
  for (let i = 0; i < str.length; i++) n = Math.imul(n ^ str.charCodeAt(i), 16777619);
  return n >>> 0;
}
// The name that belongs on it: the place in the journal; the artist, author or host (or the
// title) on a review; the date on a thought.
const subjectOf = (post) => (post.type === 'places' ? post.title : post.type === 'thoughts' ? '' : post.creator || post.title) || '';

// One keepsake. `def` is its design; `lines` are the post's lines ({ item, price }); `post`
// gives the place or title and the date. `picture` may be a blob URL while it's being made.
export function customKeepsake(def, post, lines = [], picture) {
  const pic = picture || mediaUrl(def.picture);
  const [p0, i0, a0] = SHAPE_COLOURS[def.shape] || SHAPE_COLOURS.ticket;
  const style = { '--kp': def.paper || p0, '--ki': def.ink || i0, '--ka': def.accent || a0, rotate: ((hash((post.slug || '') + def.id) % 9) - 4) + 'deg' };
  const heading = def.heading || def.name;
  const subject = subjectOf(post);
  const items = lines.map((o) => h('li', null, h('span', null, o.item), o.price ? h('span', { class: 'km-price' }, o.price) : null));
  const list = items.length ? h('ul', { class: 'km-lines' }, items) : null;
  const img = pic ? h('img', { class: 'km-pic', src: pic, alt: '', loading: 'lazy', decoding: 'async' }) : null;
  let body;
  switch (def.shape) {
    case 'card':
      body = [h('span', { class: 'km-orn', 'aria-hidden': 'true' }, '❦'), h('strong', { class: 'km-head' }, heading), subject ? h('span', { class: 'km-sub' }, subject) : null, h('span', { class: 'km-day' }, day(post)), img, list];
      break;
    case 'tag':
      body = [h('span', { class: 'km-hole', 'aria-hidden': 'true' }), h('span', { class: 'km-string', 'aria-hidden': 'true' }), img, h('strong', { class: 'km-head' }, heading), subject ? h('span', { class: 'km-sub' }, subject) : null, list];
      break;
    case 'badge':
      body = [h('span', { class: 'km-disc' }, img || h('strong', { class: 'km-head' }, heading), img ? h('strong', { class: 'km-head small' }, heading) : null), list ? h('span', { class: 'km-notes' }, list) : null];
      break;
    case 'sticker':
      body = [img, h('strong', { class: 'km-head' }, heading), subject ? h('span', { class: 'km-sub' }, subject) : null, list];
      break;
    case 'note':
      body = [h('strong', { class: 'km-head' }, heading), list || h('span', { class: 'km-sub' }, subject || day(post)), img];
      break;
    case 'picture':
      body = [img || h('strong', { class: 'km-head' }, heading), list ? h('span', { class: 'km-notes' }, list) : null];
      break;
    default:
      body = [h('span', { class: 'km-main' }, h('span', { class: 'km-kind' }, 'ADMIT ONE'), h('strong', { class: 'km-head' }, heading), subject ? h('span', { class: 'km-sub' }, subject) : null, h('span', { class: 'km-day' }, day(post)), list), h('span', { class: 'km-stub' }, img || h('span', { class: 'km-no' }, 'Nº ' + String((hash((post.slug || '') + def.id) % 900000) + 100000)))];
  }
  return h('div', { class: 'ticket-wrap km-wrap km-' + (SHAPES[def.shape] ? def.shape : 'ticket') }, h('div', { class: 'ks km', role: 'group', 'aria-label': def.name, style }, ...body));
}

// The keepsakes of your own a post has, as makers (like keepsakeMakers in apps.js). One whose
// design has since been deleted is quietly left out.
export function customMakers(post) {
  return Object.entries(post.custom_keepsakes || {})
    .filter(([id]) => DESIGNS.has(id))
    .map(([id, lines]) => () => customKeepsake(DESIGNS.get(id), post, lines));
}
