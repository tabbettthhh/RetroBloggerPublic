// Post cards of your own, made from parts in Themes › Post cards (saved in theme.md as `cards`).
// Shared by the site (skins.js draws them), the back office (the card maker) and the server
// (which checks them), so it has nothing that needs a browser.

export const CARD_PARTS = {
  texture: { name: 'Paper', choices: { plain: 'Plain', lined: 'Lined', grid: 'Grid', dots: 'Dots', kraft: 'Kraft', linen: 'Linen', halftone: 'Halftone' } },
  edge: { name: 'Edge', choices: { none: 'None', line: 'Thin line', thick: 'Thick ink', dashed: 'Dashed', double: 'Double', stripes: 'Airmail stripes', glow: 'Glow', pixel: 'Pixel steps', torn: 'Torn bottom' } },
  corners: { name: 'Corners', choices: { soft: 'Soft', square: 'Square', round: 'Round' } },
  shadow: { name: 'Shadow', choices: { soft: 'Soft', none: 'None', lifted: 'Lifted', hard: 'Hard offset' } },
  deco: { name: 'On top', choices: { none: 'Nothing', tape: 'Washi tape', tapetop: 'A strip of tape', pin: 'Pushpin', clip: 'Paperclip', stamp: 'A stamp', seal: 'A wax seal', sparkles: 'Sparkles' } },
  head: { name: 'Heading', choices: { plain: 'Plain', solid: 'Solid colour', halftone: 'Halftone dots', stripes: 'Stripes', none: 'Blended in' } },
  tilt: { name: 'Tilt', choices: { none: 'Straight', slight: 'A little tilt' } }
};
// The colours a card of your own can choose (empty: the theme's).
export const CARD_COLOURS = { paper: 'Paper', edge_colour: 'Edge', deco_colour: 'On top', head_colour: 'Heading', ink: 'Writing' };
export const MAX_CARDS = 12;
// A card of your own is named c1, c2… (so it can't be mistaken for one that comes with the site).
export const OWN_CARD = /^c([1-9]|1[0-2])$/;

const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v ?? '').trim()) ? String(v).trim().toLowerCase() : '');
const one = (v, part) => (CARD_PARTS[part].choices[v] ? v : Object.keys(CARD_PARTS[part].choices)[0]);

// Keeps only what a card can be: known parts, plain colours, a short name, a font from `fonts`.
export function cleanCards(list, fonts = []) {
  const seen = new Set();
  const out = [];
  for (const c of Array.isArray(list) ? list : []) {
    if (!c || typeof c !== 'object' || !OWN_CARD.test(String(c.id)) || seen.has(c.id)) continue;
    seen.add(c.id);
    const card = { id: String(c.id), name: String(c.name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30) || 'My card' };
    for (const part of Object.keys(CARD_PARTS)) card[part] = one(c[part], part);
    for (const k of Object.keys(CARD_COLOURS)) card[k] = hex(c[k]);
    card.paper ||= '#ffffff';
    card.font = fonts.includes(c.font) ? c.font : '';
    out.push(card);
    if (out.length >= MAX_CARDS) break;
  }
  return out;
}

// ---------- mixed at random ----------
// Every post's card can be "mixed": each post wears one of the designs in the mix (any of the
// site's and your own), picked from the post itself, so it wears the same one every time.
// (Each design draws a number for the post and the highest wins, so ticking another design only
// moves the posts it wins, and Shuffle, a new `seed`, deals them all again.)
export const MIX = 'mix';
export const MAX_SEED = 9999;
// The designs in the mix: known ones only (the site's `builtIn` ids and your own `cards`).
export function cleanMix(list, builtIn, cards = []) {
  const ok = (id) => builtIn.includes(id) || cards.some((c) => c.id === id);
  return [...new Set((Array.isArray(list) ? list : typeof list === 'string' ? list.split(/[\s,]+/) : []).map((x) => String(x).trim()).filter(ok))];
}
// Nothing ticked: every design but the plain one, and all of yours.
export const fullMix = (builtIn, cards = []) => [...builtIn.filter((id) => id !== 'classic'), ...cards.map((c) => c.id)];
export const cleanSeed = (v) => (Number.isInteger(+v) && +v > 0 ? Math.min(+v, MAX_SEED) : 0);
const draw = (s) => {
  let n = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 0x01000193);
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return (n ^ (n >>> 16)) >>> 0;
};
// The design a post wears from the mix. `key` names the post (its type and slug).
export function mixPick(key, mix, seed = 0) {
  let best = '';
  let top = -1;
  for (const id of mix) {
    const n = draw(`${seed}|${key}|${id}`);
    if (n > top) [best, top] = [id, n];
  }
  return best || 'classic';
}

// The next free name for a new card.
export const nextCardId = (cards) => `c${[...Array(MAX_CARDS)].map((_, i) => i + 1).find((n) => !cards.some((c) => c.id === `c${n}`)) || MAX_CARDS}`;
