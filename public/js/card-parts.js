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

// The next free name for a new card.
export const nextCardId = (cards) => `c${[...Array(MAX_CARDS)].map((_, i) => i + 1).find((n) => !cards.some((c) => c.id === `c${n}`)) || MAX_CARDS}`;
