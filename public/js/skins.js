// Themes: the site's colours, wallpaper, title-bar charm and mouse pointer, chosen by the owner
// in the back office (theme.md). The layout never changes, only how it's dressed.
//
// How it works: the site's stylesheets are written in the classic blue-and-green XP colours.
// A theme gives three colours (main, accent, background), and every blue in the stylesheets is
// re-coloured towards the main colour, every green towards the accent and the beige window
// paper towards the background. Each shade keeps its place (lighter stays lighter), so a theme
// someone makes themselves still looks right, and text that would get hard to read on a pale
// colour switches to dark. Patterns, charms and pointers are drawn from the same colours.
//
// (Light and dark mode are separate, in theme.js: every theme works in both.)

import { startEffects, TRAILS, FALLING } from './effects.js';
import { cleanFloppy } from './floppy-look.js';
import { cleanCards, OWN_CARD, MIX, cleanMix, fullMix, cleanSeed } from './card-parts.js';
export { FALLING as FALLING_CHOICES };

// ---------- colours ----------

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export function hexRgb(hex) {
  let s = String(hex || '').replace('#', '');
  if (s.length === 3 || s.length === 4) s = [...s].map((c) => c + c).join('');
  const n = parseInt(s.slice(0, 6), 16);
  if (!/^[0-9a-f]{6}/i.test(s) || Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1];
}
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
function rgbHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p);
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
const hsl = (hex) => rgbHsl(...hexRgb(hex).slice(0, 3));
const hslHex = (h, s, l) => toHex(...hslRgb(h, clamp(s), clamp(l)));
export { hsl as hexHsl, hslHex };
export function mix(a, b, t) {
  const x = hexRgb(a), y = hexRgb(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
// How bright a colour looks (0 black, 1 white), for choosing dark or light text on it.
export function luminance(hex) {
  const [r, g, b] = hexRgb(hex).map((v, i) => (i < 3 ? v / 255 : v)).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const okHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));

// ---------- the themes that come with the site ----------

// The classic look's own colours: what everything is re-coloured from.
const REF = { main: '#0054e3', accent: '#3a9a3a', paper: '#ece9d8' };

// The four seasons, each a theme of its own (and Through the year, which wears whichever one it
// is now). Each brings its season's scenery on the bars and posts, and what falls over the page.
const SEASON_SKINS = {
  wintry: { name: 'Winter Frost', vibe: 'Snowy hills, icy blues and a warm mug of cocoa', main: '#3f74b0', accent: '#d94a5c', paper: '#f1f7fc', leather: '#2f4466', wallpaper: 'frost', decoration: 'snowflake', pointer: 'mitten', font: 'rounded', title_font: 'elegant', name_style: 'glitter', falling: 'snow', card_style: 'letter', seasons: 'winter' },
  springtime: { name: 'Spring Bloom', vibe: 'Blossom, tulips and the first warm day', main: '#d9658c', accent: '#6fae4b', paper: '#fff8f6', leather: '#7a9a55', wallpaper: 'blossoms', decoration: 'blossom', pointer: 'tulip', font: 'rounded', title_font: 'handwritten', falling: 'petals', trail: 'sparkles', card_style: 'scrapbook', seasons: 'spring' },
  summery: { name: 'Summer Days', vibe: 'Sun, sea, sand and an ice lolly', main: '#f07a2a', accent: '#1aa3c2', paper: '#fffaeb', leather: '#1f6f87', wallpaper: 'seaside', decoration: 'sun', pointer: 'icelolly', title_font: 'bubbly', name_style: 'rainbow', falling: 'sunshine', card_style: 'polaroid', seasons: 'summer' },
  autumnal: { name: 'Autumn Leaves', vibe: 'Falling leaves, conkers and cosy jumpers', main: '#b4521f', accent: '#d99a1c', paper: '#fcf3e6', leather: '#5b3418', wallpaper: 'harvest', decoration: 'maple', pointer: 'acorn', title_font: 'typewriter', falling: 'leaves', card_style: 'notebook', seasons: 'autumn' }
};
const SEASON_OF_SKIN = { winter: 'wintry', spring: 'springtime', summer: 'summery', autumn: 'autumnal' };
// Through the year: the season's own theme for today (south of the equator, the other way round).
export function seasonalSkin(south = false, date = new Date()) {
  const now = SEASON_SKINS[SEASON_OF_SKIN[seasonOf(date, south)]];
  return { ...now, name: 'Through the year', vibe: `Each season in turn, by itself. Now: ${now.name}`, seasons: 'auto' };
}

export const SKINS = {
  classic: { name: 'Classic', vibe: 'The original blue skies', main: '#0054e3', accent: '#3a9a3a', paper: '#ece9d8', wallpaper: 'sky', decoration: 'none', pointer: 'none' },
  bunny: { name: 'Bunny Hop', vibe: 'Strawberry milk and bunnies', main: '#ec8db1', accent: '#86cfa9', paper: '#fff0f5', leather: '#d27a9c', wallpaper: 'bunnies', decoration: 'ears', pointer: 'bunny', font: 'rounded', title_font: 'bubbly', corners: 'round' },
  matcha: { name: 'Matcha', vibe: 'Sage, oat milk and slow mornings', main: '#7d9f68', accent: '#c7a26a', paper: '#f3f0e2', leather: '#5b7449', wallpaper: 'leaves', decoration: 'leaf', pointer: 'leaf', title_font: 'elegant' },
  chrome: { name: 'Y2K Chrome', vibe: 'Silver, shine and starbursts', main: '#8e9cc4', accent: '#c98ae6', paper: '#eef0f6', leather: '#6a7088', wallpaper: 'sparkles', decoration: 'sparkle', pointer: 'sparkle', selector: 'gradient' },
  arcade: { name: 'Night Arcade', vibe: 'Neon pink on deep purple', main: '#5b2bb0', accent: '#ff4fb0', paper: '#ebe4fa', leather: '#3b215f', wallpaper: 'grid', decoration: 'star', pointer: 'star', title_font: 'pixel', bars: 'pixel', selector: 'gradient', scrollbar: 'themed' },
  lemonade: { name: 'Lemonade', vibe: 'Sunshine, daisies and blue sky', main: '#f0bf2c', accent: '#4fb0e6', paper: '#fffae3', leather: '#c79a2c', wallpaper: 'daisies', decoration: 'daisy', pointer: 'daisy', title_font: 'bubbly' },
  cherry: { name: 'Cherry Soda', vibe: 'Diner red and cream', main: '#d23a4e', accent: '#2f9e6c', paper: '#fff4ea', leather: '#8c2232', wallpaper: 'cherries', decoration: 'cherry', pointer: 'cherry', title_font: 'bubbly' },
  cloud: { name: 'Cloud Nine', vibe: 'Lilac and baby blue daydreams', main: '#a596e3', accent: '#83c3ee', paper: '#f5f2ff', leather: '#8576c4', wallpaper: 'clouds', decoration: 'cloud', pointer: 'cloud', font: 'rounded', title_font: 'bubbly', corners: 'round' },
  froggy: { name: 'Froggy Pond', vibe: 'Lily pads and pink blossoms', main: '#55a247', accent: '#e886ae', paper: '#eff6e5', leather: '#3d6a33', wallpaper: 'lilypads', decoration: 'frog', pointer: 'frog', title_font: 'comic' },
  boba: { name: 'Boba', vibe: 'Brown sugar milk tea', main: '#a4734c', accent: '#e3a26f', paper: '#f7eee2', leather: '#6b4426', wallpaper: 'boba', decoration: 'boba', pointer: 'boba', title_font: 'rounded', corners: 'round' },
  peach: { name: 'Peach Fizz', vibe: 'Peachy, bubbly and warm', main: '#f2946a', accent: '#f1c453', paper: '#fff2ea', leather: '#c26845', wallpaper: 'bubbles', decoration: 'peach', pointer: 'peach', title_font: 'bubbly', corners: 'round' },
  moonlit: { name: 'Moonlit', vibe: 'Moons, stars and soft lilac', main: '#3e3a64', accent: '#b9a8ff', paper: '#ecebf4', leather: '#2b283f', wallpaper: 'moons', decoration: 'moon', pointer: 'moon', title_font: 'elegant', scrollbar: 'themed' },
  // Bold and loud: nothing minimal. Big colour, big pattern, big personality.
  neon: { name: 'Neon Boulevard', vibe: 'Pink neon, palm trees and a striped 80s sunset', main: '#ff2e97', accent: '#19d3f5', paper: '#fff0fa', leather: '#4b136b', wallpaper: 'sunset', decoration: 'palm', pointer: 'palm', title_font: 'arcade', name_style: 'glow', selector: 'gradient', scrollbar: 'themed', trail: 'stars', sounds: 'chip', card_style: 'neon' },
  empire: { name: 'Empire', vibe: 'Emerald stripes, gold laurels and a little grandeur', main: '#1f5a44', accent: '#c8a042', paper: '#f7f0dc', leather: '#5a1e22', wallpaper: 'laurels', decoration: 'laurel', pointer: 'laurel', font: 'elegant', title_font: 'elegant', name_style: 'glitter', corners: 'square', header: 'card', card_style: 'letter' },
  rococo: { name: 'Rococo', vibe: 'Sugared pastels, gilt scrolls, pearls and a fan', main: '#e48fb3', accent: '#7fc8b0', paper: '#fff6f2', leather: '#b9787f', wallpaper: 'rococo', decoration: 'fan', pointer: 'fan', font: 'elegant', title_font: 'handwritten', name_style: 'glitter', corners: 'round', trail: 'sparkles', falling: 'petals', card_style: 'scrapbook' },
  disco: { name: 'Disco Inferno', vibe: 'Mirror ball, magenta and gold on the dance floor', main: '#c2186b', accent: '#ffb000', paper: '#fff3e6', leather: '#5a1238', wallpaper: 'disco', decoration: 'discoball', pointer: 'discoball', title_font: 'bubbly', name_style: 'chrome', selector: 'gradient', scrollbar: 'themed', trail: 'stars', falling: 'confetti', card_style: 'chrome' },
  popart: { name: 'Pop Art', vibe: 'Comic dots, POW! and primary colours', main: '#e3262f', accent: '#1e5bd8', paper: '#fffbe0', leather: '#1a1a1a', wallpaper: 'benday', decoration: 'boom', pointer: 'boom', font: 'comic', title_font: 'comic', name_style: 'wordart', bars: 'flat', corners: 'square', selector: 'invert', card_style: 'comic' },
  memphis: { name: 'Memphis Party', vibe: 'Squiggles, zigzags and clashing shapes', main: '#1fb5b0', accent: '#ff5ca8', paper: '#fffbea', leather: '#2a2a2a', wallpaper: 'memphis', decoration: 'squiggle', pointer: 'squiggle', font: 'rounded', title_font: 'bubbly', name_style: 'rainbow', bars: 'stripes', corners: 'round', falling: 'confetti', card_style: 'sticky' },
  leopard: { name: 'Wild Thing', vibe: 'Leopard print, hot pink and a kiss', main: '#e0218a', accent: '#c8873a', paper: '#fff3e8', leather: '#3a2416', wallpaper: 'leopard', decoration: 'lips', pointer: 'lips', title_font: 'handwritten', name_style: 'glitter', selector: 'gradient', trail: 'hearts', card_style: 'polaroid' },
  opera: { name: 'Velvet Opera', vibe: 'Crimson velvet, gold damask and a chandelier', main: '#8e1b2b', accent: '#d4a64a', paper: '#fbf3e4', leather: '#4a0f18', wallpaper: 'damask', decoration: 'chandelier', pointer: 'chandelier', font: 'elegant', title_font: 'elegant', name_style: 'outline', scrollbar: 'themed', header: 'card', card_style: 'letter' },
  blocky: { name: 'Block World', vibe: 'Grass, dirt and stone blocks, and a pickaxe', main: '#5d9e2f', accent: '#9c6a38', paper: '#f1ead8', leather: '#5b3a1e', wallpaper: 'blocks', decoration: 'pickaxe', pointer: 'pickaxe', title_font: 'pixel', bars: 'pixel', corners: 'square', selector: 'outline', icons: 'colour', sounds: 'chip', trail: 'pixels', card_style: 'pixel' },
  bigtop: { name: 'Big Top', vibe: 'Circus stripes, bunting and showtime', main: '#d7263d', accent: '#f4b400', paper: '#fff8e7', leather: '#3b2a6b', wallpaper: 'bigtop', decoration: 'tent', pointer: 'tent', title_font: 'condensed', name_style: 'wordart', bars: 'stripes', selector: 'gradient', falling: 'confetti', card_style: 'ticket' },
  ...SEASON_SKINS,
  seasonal: seasonalSkin(),
  // Calm and neutral: nothing cute, just a quiet look.
  graphite: { name: 'Graphite', vibe: 'Cool greys, nothing extra', main: '#5d646e', accent: '#8f8676', paper: '#eeeeec', leather: '#3d3f43', wallpaper: 'plain', decoration: 'none', pointer: 'plain', font: 'modern', title_font: 'modern', bars: 'flat' },
  paper: { name: 'Paper', vibe: 'Black ink on off-white', main: '#33312e', accent: '#b5462f', paper: '#f7f5ef', leather: '#2b2a28', wallpaper: 'dots', decoration: 'none', pointer: 'plain', title_font: 'elegant', bars: 'flat', corners: 'square' },
  slate: { name: 'Slate', vibe: 'Blue-grey and calm', main: '#4f6a86', accent: '#7d9a8c', paper: '#eceff2', leather: '#3b4a5c', wallpaper: 'lines', decoration: 'none', pointer: 'plain', font: 'modern', title_font: 'modern', bars: 'flat' },
  sand: { name: 'Sand', vibe: 'Linen, stone and warm beige', main: '#a8916e', accent: '#7f8f6a', paper: '#f4efe5', leather: '#7a6446', wallpaper: 'linen', decoration: 'none', pointer: 'plain', title_font: 'elegant' },
  olive: { name: 'Olive', vibe: 'Olive, brass and maps', main: '#6b7148', accent: '#b0874f', paper: '#f0eee2', leather: '#4c5034', wallpaper: 'contours', decoration: 'none', pointer: 'plain', title_font: 'condensed', bars: 'flat' },
  navy: { name: 'Navy', vibe: 'Deep navy and brass', main: '#22345a', accent: '#b8975a', paper: '#eeebe3', leather: '#1c2740', wallpaper: 'grain', decoration: 'none', pointer: 'plain', title_font: 'elegant' },
  mono: { name: 'Mono', vibe: 'Black, white and grey', main: '#3a3a3a', accent: '#8a8a8a', paper: '#f2f2f2', leather: '#2a2a2a', wallpaper: 'graph', decoration: 'none', pointer: 'plain', font: 'modern', title_font: 'condensed', bars: 'flat', corners: 'square', icons: 'mono' }
};

// How the themes are grouped in the back office (each group folds away).
export const SKIN_GROUPS = [
  ['Cute and colourful', ['classic', 'bunny', 'matcha', 'chrome', 'arcade', 'lemonade', 'cherry', 'cloud', 'froggy', 'boba', 'peach', 'moonlit']],
  ['Bold and loud', ['neon', 'empire', 'rococo', 'disco', 'popart', 'memphis', 'leopard', 'opera', 'blocky', 'bigtop']],
  ['The four seasons', ['seasonal', 'wintry', 'springtime', 'summery', 'autumnal']],
  ['Calm and neutral', ['graphite', 'paper', 'slate', 'sand', 'olive', 'navy', 'mono']]
];

// ---------- little drawings: charms for title bars, pointers and patterns ----------

// Each draws in a 16 × 16 box. c: { main, accent, paper, ink, soft }.
export const CHARMS = {
  none: () => '',
  heart: (c) => `<path d="M8 14C2.5 10.2 1.2 6.6 3.4 4.3 5.2 2.6 7.3 3.4 8 5c.7-1.6 2.8-2.4 4.6-.7 2.2 2.3.9 5.9-4.6 9.7z" fill="${c.accent}" stroke="${c.ink}" stroke-width=".9"/>`,
  ears: (c) => `<g stroke="${c.ink}" stroke-width=".9"><ellipse cx="5.2" cy="8" rx="2.3" ry="6.2" fill="#fff" transform="rotate(-12 5.2 8)"/><ellipse cx="10.8" cy="8" rx="2.3" ry="6.2" fill="#fff" transform="rotate(12 10.8 8)"/></g><ellipse cx="5.2" cy="8.4" rx="1" ry="4.2" fill="${c.main}" transform="rotate(-12 5.2 8)"/><ellipse cx="10.8" cy="8.4" rx="1" ry="4.2" fill="${c.main}" transform="rotate(12 10.8 8)"/>`,
  bunny: (c) => `<g stroke="${c.ink}" stroke-width=".8"><ellipse cx="5.6" cy="4.6" rx="1.6" ry="3.8" fill="#fff" transform="rotate(-10 5.6 4.6)"/><ellipse cx="10.4" cy="4.6" rx="1.6" ry="3.8" fill="#fff" transform="rotate(10 10.4 4.6)"/><ellipse cx="8" cy="10.4" rx="5.2" ry="4.4" fill="#fff"/></g><ellipse cx="5.6" cy="4.8" rx=".7" ry="2.5" fill="${c.main}" transform="rotate(-10 5.6 4.6)"/><ellipse cx="10.4" cy="4.8" rx=".7" ry="2.5" fill="${c.main}" transform="rotate(10 10.4 4.6)"/><circle cx="6" cy="10" r=".75" fill="${c.ink}"/><circle cx="10" cy="10" r=".75" fill="${c.ink}"/><path d="M7.2 11.6l.8.6.8-.6" fill="${c.main}" stroke="${c.ink}" stroke-width=".5"/><circle cx="4.6" cy="11.6" r=".9" fill="${c.main}" opacity=".6"/><circle cx="11.4" cy="11.6" r=".9" fill="${c.main}" opacity=".6"/>`,
  bow: (c) => `<g stroke="${c.ink}" stroke-width=".8" stroke-linejoin="round"><path d="M8 8 2 4.2v7.6zM8 8l6-3.8v7.6z" fill="${c.main}"/><path d="M7 8.4 5 14.5l1.6-.6.8 1.3L8 8.8l.6 6.4.8-1.3 1.6.6L9 8.4" fill="${c.main}"/><rect x="6.6" y="6.6" width="2.8" height="2.8" rx="1" fill="${c.accent}"/></g>`,
  leaf: (c) => `<path d="M2.5 13.5C2 7 6 2.5 14 2.5c0 7.5-4.5 11.5-11.5 11z" fill="${c.accent === c.main ? c.main : '#7fb069'}" stroke="${c.ink}" stroke-width=".9"/><path d="M3 13 11 5.5" stroke="${c.ink}" stroke-width=".8" fill="none"/>`,
  sparkle: (c) => `<path d="M8 .8 9.7 6.3 15.2 8 9.7 9.7 8 15.2 6.3 9.7.8 8l5.5-1.7z" fill="#fff" stroke="${c.ink}" stroke-width=".8" stroke-linejoin="round"/><path d="M8 4.2 8.8 7.2 11.8 8 8.8 8.8 8 11.8 7.2 8.8 4.2 8l3-.8z" fill="${c.accent}"/>`,
  star: (c) => `<path d="m8 1 2.1 4.5 4.9.6-3.6 3.4.9 4.9L8 12l-4.3 2.4.9-4.9L1 6.1l4.9-.6z" fill="${c.accent}" stroke="${c.ink}" stroke-width=".9" stroke-linejoin="round"/>`,
  daisy: (c) => `<g fill="#fff" stroke="${c.ink}" stroke-width=".7">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse cx="8" cy="3.6" rx="1.8" ry="3" transform="rotate(${a} 8 8)"/>`).join('')}</g><circle cx="8" cy="8" r="2.6" fill="#f6c431" stroke="${c.ink}" stroke-width=".7"/>`,
  cherry: (c) => `<path d="M5 10.5C5.5 6 7.5 3.5 11 1.8M11.6 10C11 6.5 11.2 4 11 1.8" fill="none" stroke="#3c7a2c" stroke-width="1.1"/><path d="M11 1.8c1.6-.6 3 0 3.6 1.2-1.6.6-2.8.2-3.6-1.2z" fill="#5aa043"/><circle cx="4.8" cy="11.6" r="3.2" fill="#d6283f" stroke="${c.ink}" stroke-width=".8"/><circle cx="11.6" cy="11.2" r="3.2" fill="#d6283f" stroke="${c.ink}" stroke-width=".8"/><circle cx="3.8" cy="10.6" r=".8" fill="#fff" opacity=".8"/><circle cx="10.6" cy="10.2" r=".8" fill="#fff" opacity=".8"/>`,
  cloud: (c) => `<path d="M4 13h8.5a3 3 0 0 0 .3-6A4.2 4.2 0 0 0 4.6 6 3.5 3.5 0 0 0 4 13z" fill="#fff" stroke="${c.ink}" stroke-width=".9" stroke-linejoin="round"/><circle cx="6.3" cy="10" r=".55" fill="${c.ink}"/><circle cx="9.7" cy="10" r=".55" fill="${c.ink}"/><path d="M7.3 11.2q.7.6 1.4 0" stroke="${c.ink}" stroke-width=".6" fill="none"/>`,
  frog: (c) => `<g stroke="#2d5a23" stroke-width=".8"><circle cx="4.6" cy="5" r="2.6" fill="#6fbf5a"/><circle cx="11.4" cy="5" r="2.6" fill="#6fbf5a"/><ellipse cx="8" cy="10" rx="6.6" ry="4.6" fill="#6fbf5a"/></g><circle cx="4.6" cy="5" r="1.4" fill="#fff"/><circle cx="11.4" cy="5" r="1.4" fill="#fff"/><circle cx="4.8" cy="5.2" r=".7" fill="#1d2a18"/><circle cx="11.6" cy="5.2" r=".7" fill="#1d2a18"/><path d="M5 10.6q3 2.2 6 0" stroke="#2d5a23" stroke-width=".8" fill="none"/><circle cx="3.6" cy="10" r=".9" fill="#f29bb8" opacity=".8"/><circle cx="12.4" cy="10" r=".9" fill="#f29bb8" opacity=".8"/>`,
  boba: (c) => `<path d="M9.8.6 8.6 6" stroke="${c.ink}" stroke-width="1.6" stroke-linecap="round"/><path d="M3.4 5.2h9.2l-1.3 9.6H4.7z" fill="#e8c9a2" stroke="${c.ink}" stroke-width=".8" stroke-linejoin="round"/><rect x="3" y="4.4" width="10" height="1.6" rx=".6" fill="#fff" stroke="${c.ink}" stroke-width=".7"/><g fill="#3b2418"><circle cx="5.8" cy="13" r=".9"/><circle cx="8" cy="13.3" r=".9"/><circle cx="10.2" cy="13" r=".9"/><circle cx="7" cy="11.6" r=".9"/><circle cx="9.2" cy="11.6" r=".9"/></g>`,
  peach: (c) => `<path d="M8 4c3.8-1 6.6 1.4 6.4 5-.2 3.8-3.2 5.6-6.4 5.6S1.8 12.8 1.6 9C1.4 5.4 4.2 3 8 4z" fill="#f7a07a" stroke="${c.ink}" stroke-width=".8"/><path d="M8 4.4c-1.2 2.8-1 6.2 0 9.6" stroke="#d9714f" stroke-width=".8" fill="none"/><path d="M8 4.2C8.6 2.2 10.4 1 12.6 1.4 11.8 3.2 10 4.2 8 4.2z" fill="#6fb05a" stroke="${c.ink}" stroke-width=".6"/>`,
  moon: (c) => `<path d="M10.6 1.6A6.6 6.6 0 1 0 14.4 11 5.3 5.3 0 0 1 10.6 1.6z" fill="#f6e7a6" stroke="${c.ink}" stroke-width=".9"/><path d="m13 2 .5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" fill="#fff"/>`,
  // Neutral: a plain pointer (no charm) and simple shapes.
  plain: () => '',
  dot: (c) => `<circle cx="8" cy="8" r="4" fill="${c.main}" stroke="${c.ink}" stroke-width=".8"/>`,
  ring: (c) => `<circle cx="8" cy="8" r="5" fill="none" stroke="${c.main}" stroke-width="2.2"/><circle cx="8" cy="8" r="5" fill="none" stroke="${c.ink}" stroke-width=".5"/>`,
  diamond: (c) => `<path d="M8 1.8 14.2 8 8 14.2 1.8 8z" fill="${c.accent}" stroke="${c.ink}" stroke-width=".8" stroke-linejoin="round"/>`,
  plus: (c) => `<path d="M8 2.5v11M2.5 8h11" stroke="${c.ink}" stroke-width="2.4" stroke-linecap="round"/>`,
  asterisk: (c) => `<g stroke="${c.ink}" stroke-width="1.8" stroke-linecap="round"><path d="M8 2v12M2.8 5l10.4 6M2.8 11l10.4-6"/></g>`,
  chevron: (c) => `<path d="M4 3l6 5-6 5" fill="none" stroke="${c.ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  rainbow: (c) => `<g fill="none" stroke-width="1.6" stroke-linecap="round"><path d="M1.6 12.5a6.4 6.4 0 0 1 12.8 0" stroke="#f26b7a"/><path d="M3.2 12.5a4.8 4.8 0 0 1 9.6 0" stroke="#f6b05a"/><path d="M4.8 12.5a3.2 3.2 0 0 1 6.4 0" stroke="#f3d65a"/><path d="M6.4 12.5a1.6 1.6 0 0 1 3.2 0" stroke="#79c6ea"/></g><g fill="#fff" stroke="${c.ink}" stroke-width=".6"><circle cx="2.3" cy="13" r="1.9"/><circle cx="4.3" cy="13.6" r="1.5"/><circle cx="13.7" cy="13" r="1.9"/><circle cx="11.7" cy="13.6" r="1.5"/></g>`,
  pal: (c) => `<g stroke="${c.ink}" stroke-width=".7" fill="#fff"><ellipse cx="6" cy="3.4" rx="1.3" ry="3" transform="rotate(-8 6 3.4)"/><ellipse cx="10" cy="3.4" rx="1.3" ry="3" transform="rotate(8 10 3.4)"/><ellipse cx="8" cy="12.3" rx="4.4" ry="3.4"/><circle cx="8" cy="7.7" r="3.5"/><ellipse cx="5.7" cy="15.1" rx="1.5" ry=".8"/><ellipse cx="10.3" cy="15.1" rx="1.5" ry=".8"/></g><ellipse cx="6" cy="3.6" rx=".55" ry="2" fill="${c.main}" transform="rotate(-8 6 3.4)"/><ellipse cx="10" cy="3.6" rx=".55" ry="2" fill="${c.main}" transform="rotate(8 10 3.4)"/><circle cx="6.7" cy="7.6" r=".5" fill="${c.ink}"/><circle cx="9.3" cy="7.6" r=".5" fill="${c.ink}"/><path d="M7.5 8.7l.5.4.5-.4" fill="none" stroke="${c.ink}" stroke-width=".45"/><circle cx="5.6" cy="8.8" r=".7" fill="${c.main}" opacity=".55"/><circle cx="10.4" cy="8.8" r=".7" fill="${c.main}" opacity=".55"/><path d="M8 13.6c-1.3-.8-1.6-1.6-1.2-2.1.4-.4.9-.2 1.2.2.3-.4.8-.6 1.2-.2.4.5.1 1.3-1.2 2.1z" fill="${c.accent}"/>`,
  twinkle: (c) => `<g fill="#fff" stroke="${c.ink}" stroke-width=".6" stroke-linejoin="round"><path d="M5.5 1.5 6.6 5 10 6 6.6 7 5.5 10.5 4.4 7 1 6l3.4-1z"/><path d="m12 7.5.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z"/><path d="m4.5 11.5.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z"/></g><path d="M5.5 3.8 6 5.6 7.8 6 6 6.4 5.5 8.2 5 6.4 3.2 6 5 5.6z" fill="${c.accent}"/>`,
  hearts: (c) => `<g stroke="${c.ink}" stroke-width=".6"><path d="M5.5 10C1.7 7.5.9 5 2.4 3.5c1.2-1.1 2.6-.6 3.1.5.5-1.1 1.9-1.6 3.1-.5C10.1 5 9.3 7.5 5.5 10z" fill="${c.main}"/><path d="M12 7.5c-2.4-1.6-2.9-3.2-1.9-4.1.7-.7 1.6-.4 1.9.3.3-.7 1.2-1 1.9-.3 1 .9.5 2.5-1.9 4.1z" fill="${c.accent}"/><path d="M11 15c-2.1-1.4-2.5-2.8-1.7-3.6.7-.6 1.4-.3 1.7.3.3-.6 1-.9 1.7-.3.8.8.4 2.2-1.7 3.6z" fill="#fff"/></g>`,
  // The seasons (and a few festive days): drawn in their own colours, so they suit every theme.
  snowman: (c) => `<g stroke="${c.ink}" stroke-width=".7"><circle cx="8" cy="11.3" r="4.1" fill="#fff"/><circle cx="8" cy="5.6" r="2.9" fill="#fff"/><path d="M5.2 3.3h5.6M6.1 3.3V.9h3.8v2.4" fill="#33333a" stroke-linejoin="round"/></g><rect x="6.1" y="2.3" width="3.8" height=".8" fill="#d6283f"/><path d="M5.4 7.9q2.6 1.4 5.2 0l.3.9q-.6.4-1.1.5l.3 2.1-1.1.2-.3-2.1q-1.4.2-2.9-.6z" fill="#d6283f"/><circle cx="7" cy="5.2" r=".45" fill="#222"/><circle cx="9" cy="5.2" r=".45" fill="#222"/><path d="M8 6 10.4 6.5 8 6.9z" fill="#f08a24"/><g fill="#33333a"><circle cx="8" cy="10.2" r=".45"/><circle cx="8" cy="12.2" r=".45"/></g>`,
  snowflake: (c) => `<g stroke="${c.ink}" stroke-width="2.4" stroke-linecap="round"><path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5"/></g><g stroke="#fff" stroke-width="1.2" stroke-linecap="round" fill="none"><path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5M6.4 2.6 8 4.2l1.6-1.6M6.4 13.4 8 11.8l1.6 1.6"/></g>`,
  mitten: (c) => `<path d="M5 14.2V6.6C5 3.4 6.4 1.6 8.6 1.6s3.4 1.6 3.4 4.4v2.2l1.2-1.4c.8-.8 2 .2 1.4 1.2L12 12v2.2z" fill="${c.main}" stroke="${c.ink}" stroke-width=".8" stroke-linejoin="round"/><rect x="4.4" y="12.2" width="8.2" height="2.8" rx=".8" fill="#fff" stroke="${c.ink}" stroke-width=".7"/><path d="M6.6 6h3.6M6.6 8.2h3.6" stroke="#fff" stroke-width=".8" stroke-dasharray="1 .8"/>`,
  santa: (c) => `<path d="M3 7.2C3.6 3.2 6 1.2 9.4 1.6c2.2.3 3.4 1.6 4.2 3.6l-1.6.4C11 4.2 10 3.6 8.6 3.6 6.6 3.6 5.4 5 5 7.2z" fill="#d6283f" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><circle cx="13.6" cy="5.6" r="1.3" fill="#fff" stroke="${c.ink}" stroke-width=".6"/><circle cx="8" cy="9.2" r="3.4" fill="#f6c7a6" stroke="${c.ink}" stroke-width=".6"/><path d="M3.2 9.6c.2 3.6 2.2 5.4 4.8 5.4s4.6-1.8 4.8-5.4c-.8.8-1.6 1-2.4 1-.6.8-1.4 1.2-2.4 1.2s-1.8-.4-2.4-1.2c-.8 0-1.6-.2-2.4-1z" fill="#fff" stroke="${c.ink}" stroke-width=".6" stroke-linejoin="round"/><rect x="2.6" y="6.4" width="10.8" height="2" rx="1" fill="#fff" stroke="${c.ink}" stroke-width=".6"/><circle cx="6.7" cy="9.4" r=".45" fill="#222"/><circle cx="9.3" cy="9.4" r=".45" fill="#222"/><circle cx="8" cy="10.6" r=".7" fill="#e88a8a"/>`,
  fir: (c) => `<path d="M8 1 12 6H10l3.4 4.4h-2.2l3 3.8H1.8l3-3.8H2.6L6 6H4z" fill="#3f8f4e" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><rect x="6.8" y="14.2" width="2.4" height="1.6" fill="#8a5a33"/><g><circle cx="6.4" cy="8.4" r=".8" fill="#d6283f"/><circle cx="9.8" cy="11.6" r=".8" fill="#f6c431"/><circle cx="6" cy="12.4" r=".8" fill="#4facfe"/><circle cx="9.2" cy="6.2" r=".7" fill="#f6c431"/></g><path d="m8 .1.5 1.1 1.2.1-.9.8.3 1.2L8 2.7l-1.1.6.3-1.2-.9-.8 1.2-.1z" fill="#f6c431"/>`,
  present: (c) => `<rect x="2" y="6.4" width="12" height="8.4" rx=".8" fill="${c.main}" stroke="${c.ink}" stroke-width=".7"/><rect x="1.4" y="4.4" width="13.2" height="2.6" rx=".6" fill="${c.main}" stroke="${c.ink}" stroke-width=".7"/><path d="M8 4.4v10.4" stroke="${c.accent}" stroke-width="2"/><path d="M8 4.2C6.6 1.4 3.8 1.6 4.4 3.2 4.8 4.2 6.6 4.4 8 4.2zm0 0c1.4-2.8 4.2-2.6 3.6-1 -.4 1-2.2 1.2-3.6 1z" fill="${c.accent}" stroke="${c.ink}" stroke-width=".6"/>`,
  tulip: (c) => `<path d="M8 8v7.4" stroke="#3c7a2c" stroke-width="1.1"/><path d="M8 13.4C5.6 13.2 4 11.6 3.6 9.4 5.8 9.6 7.4 11 8 13.4zm0 .4c.6-2.4 2.2-3.8 4.4-4-.4 2.2-2 3.8-4.4 4z" fill="#5aa043" stroke="${c.ink}" stroke-width=".5"/><path d="M4.4 3.2C5.4 4.4 6.6 4.6 8 3.2c1.4 1.4 2.6 1.2 3.6 0 .6 3.4-.6 5.4-3.6 5.4S3.8 6.6 4.4 3.2z" fill="#ff7aa2" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><path d="M8 3.4c-.6 1.6-.6 3.4 0 5.2" stroke="#e0507e" stroke-width=".6" fill="none"/>`,
  chick: (c) => `<ellipse cx="8" cy="10" rx="5.6" ry="4.8" fill="#ffd84d" stroke="${c.ink}" stroke-width=".7"/><circle cx="8" cy="5.6" r="3.4" fill="#ffd84d" stroke="${c.ink}" stroke-width=".7"/><path d="M7.6 1.6q.4 1.2 1.2.8" stroke="${c.ink}" stroke-width=".6" fill="none"/><circle cx="6.8" cy="5.2" r=".5" fill="#222"/><circle cx="9.2" cy="5.2" r=".5" fill="#222"/><path d="M7.2 6.6h1.6L8 7.6z" fill="#f08a24"/><path d="M3.6 9.6q1.6 1.6 3.4.6" stroke="#e8b52a" stroke-width=".7" fill="none"/><g fill="#f08a24"><path d="M6 14.6h1.4l-.7.9zM8.6 14.6H10l-.7.9z"/></g>`,
  bee: (c) => `<g stroke="${c.ink}" stroke-width=".6"><ellipse cx="6" cy="4.6" rx="2.2" ry="3" fill="#e6f4ff" transform="rotate(-20 6 4.6)"/><ellipse cx="10" cy="4.6" rx="2.2" ry="3" fill="#e6f4ff" transform="rotate(20 10 4.6)"/><ellipse cx="8" cy="10" rx="5.6" ry="4.4" fill="#ffd23f"/></g><path d="M6 6.2v7.6M9.4 6v7.8" stroke="#2b2b2b" stroke-width="1.3"/><circle cx="3.8" cy="9.4" r=".5" fill="#222"/><path d="M13.6 10l1.6.4-1.6.5" fill="#2b2b2b"/>`,
  sun: (c) => `<g stroke="#f2a20d" stroke-width="1.3" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M8 1.2v1.8" transform="rotate(${a} 8 8)"/>`).join('')}</g><circle cx="8" cy="8" r="4.2" fill="#ffd23f" stroke="${c.ink}" stroke-width=".7"/><circle cx="6.6" cy="7.4" r=".5" fill="#222"/><circle cx="9.4" cy="7.4" r=".5" fill="#222"/><path d="M6.6 9.2q1.4 1.2 2.8 0" stroke="#222" stroke-width=".6" fill="none" stroke-linecap="round"/><g fill="#ff9aa2" opacity=".7"><circle cx="5.6" cy="8.8" r=".6"/><circle cx="10.4" cy="8.8" r=".6"/></g>`,
  icelolly: (c) => `<rect x="7.2" y="11" width="1.6" height="4.4" rx=".8" fill="#d9b382" stroke="${c.ink}" stroke-width=".5"/><path d="M4.4 4.6C4.4 2.4 6 1 8 1s3.6 1.4 3.6 3.6v6.2c0 .5-.4.8-.8.8H5.2c-.4 0-.8-.3-.8-.8z" fill="#ff7aa2" stroke="${c.ink}" stroke-width=".7"/><path d="M4.4 7.2h7.2v3.6c0 .5-.4.8-.8.8H5.2c-.4 0-.8-.3-.8-.8z" fill="#ffd84d"/><path d="M4.4 9.4h7.2v1.4c0 .5-.4.8-.8.8H5.2c-.4 0-.8-.3-.8-.8z" fill="#7ee081"/><path d="M4.4 4.6C4.4 2.4 6 1 8 1s3.6 1.4 3.6 3.6v6.2c0 .5-.4.8-.8.8H5.2c-.4 0-.8-.3-.8-.8z" fill="none" stroke="${c.ink}" stroke-width=".7"/><path d="M6 3.2v3" stroke="#fff" stroke-width=".8" stroke-linecap="round" opacity=".8"/>`,
  watermelon: (c) => `<path d="M1.2 5.4a6.8 6.8 0 0 0 13.6 0z" fill="#3f9b4e" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><path d="M2.4 5.4a5.6 5.6 0 0 0 11.2 0z" fill="#f2f7d8"/><path d="M3.2 5.4a4.8 4.8 0 0 0 9.6 0z" fill="#ff5f6d"/><g fill="#2b2b2b"><ellipse cx="6" cy="7.2" rx=".4" ry=".6"/><ellipse cx="8" cy="8.4" rx=".4" ry=".6"/><ellipse cx="10" cy="7.2" rx=".4" ry=".6"/></g>`,
  maple: (c) => `<path d="M8 1.2 9.2 4.4l1.8-.8-.4 3 2.8-1.4-.6 2 2 .6-3.4 2.8.6 1.2-3.4-.4V15H7.4v-3.6l-3.4.4.6-1.2L1.2 7.8l2-.6-.6-2 2.8 1.4-.4-3 1.8.8z" fill="#e2622b" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><path d="M8 4.6V12" stroke="#a83c12" stroke-width=".6"/>`,
  acorn: (c) => `<path d="M3.6 7.4h8.8v1.2c0 3.6-2 6.2-4.4 6.2S3.6 12.2 3.6 8.6z" fill="#d9a05b" stroke="${c.ink}" stroke-width=".7"/><path d="M2.6 7.6C2.8 4.8 5 3.2 8 3.2s5.2 1.6 5.4 4.4z" fill="#8a5a33" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><path d="M8 3.2c0-1.2.4-2 1.4-2.4" stroke="#5c3a1f" stroke-width="1" fill="none" stroke-linecap="round"/><path d="M4.6 6l1 .8M7.4 5.2l.6 1M10.4 5.4l-.4 1" stroke="#5c3a1f" stroke-width=".6"/>`,
  pumpkin: (c) => `<path d="M8 3.6c-.2-1.2.2-2.2 1.4-2.8l.4.8C9 2 8.8 2.8 8.9 3.7z" fill="#4f7a2c"/><g stroke="${c.ink}" stroke-width=".7"><ellipse cx="4.8" cy="9.4" rx="3.4" ry="5" fill="#f28c28"/><ellipse cx="11.2" cy="9.4" rx="3.4" ry="5" fill="#f28c28"/><ellipse cx="8" cy="9.4" rx="3.2" ry="5.4" fill="#f7a23f"/></g>`,
  jack: (c) => `<path d="M8 3.6c-.2-1.2.2-2.2 1.4-2.8l.4.8C9 2 8.8 2.8 8.9 3.7z" fill="#4f7a2c"/><g stroke="${c.ink}" stroke-width=".7"><ellipse cx="4.8" cy="9.4" rx="3.4" ry="5" fill="#f28c28"/><ellipse cx="11.2" cy="9.4" rx="3.4" ry="5" fill="#f28c28"/><ellipse cx="8" cy="9.4" rx="3.2" ry="5.4" fill="#f7a23f"/></g><g fill="#3a2410"><path d="M4.6 8.4 6.2 6.6l.8 1.8zM11.4 8.4 9.8 6.6 9 8.4z"/><path d="M4.6 10.6q3.4 2.6 6.8 0-.6 2.4-3.4 2.4t-3.4-2.4z"/></g><path d="m6.6 11.6.6.8.6-.8.6.8.6-.8" stroke="#f7a23f" stroke-width=".5" fill="none"/>`,
  ghost: (c) => `<path d="M3 14.6V7.2C3 4 5.2 1.6 8 1.6s5 2.4 5 5.6v7.4l-1.6-1.2-1.6 1.2L8 13.4l-1.8 1.2-1.6-1.2z" fill="#fff" stroke="${c.ink}" stroke-width=".8" stroke-linejoin="round"/><ellipse cx="6.4" cy="6.8" rx=".7" ry="1" fill="#222"/><ellipse cx="9.6" cy="6.8" rx=".7" ry="1" fill="#222"/><ellipse cx="8" cy="9.4" rx=".8" ry=".6" fill="#222"/><g fill="#ff9aa2" opacity=".6"><circle cx="5.2" cy="8.4" r=".6"/><circle cx="10.8" cy="8.4" r=".6"/></g>`,
  // Festive days.
  lantern: (c) => `<path d="M8 .6v1.6" stroke="${c.ink}" stroke-width=".8"/><rect x="5.6" y="2" width="4.8" height="1.4" rx=".5" fill="#f2b134" stroke="${c.ink}" stroke-width=".6"/><ellipse cx="8" cy="8" rx="5.6" ry="4.8" fill="#e23b3b" stroke="${c.ink}" stroke-width=".7"/><path d="M8 3.2c-2 1.4-2 8.2 0 9.6M8 3.2c2 1.4 2 8.2 0 9.6M4.6 4.6c-1.2 2-1.2 4.8 0 6.8M11.4 4.6c1.2 2 1.2 4.8 0 6.8" stroke="#b81f2a" stroke-width=".6" fill="none"/><rect x="5.6" y="12.6" width="4.8" height="1.4" rx=".5" fill="#f2b134" stroke="${c.ink}" stroke-width=".6"/><path d="M7 14v1.8M8 14v2M9 14v1.8" stroke="#f2b134" stroke-width=".7"/>`,
  blossom: (c) => `<path d="M1 15C5 12 9 10 15 9" stroke="#6b4a33" stroke-width="1.1" fill="none" stroke-linecap="round"/><g fill="#ffd0dc" stroke="${c.ink}" stroke-width=".5">${[0, 72, 144, 216, 288].map((a) => `<circle cx="7" cy="4.4" r="1.9" transform="rotate(${a} 7 6.6)"/>`).join('')}</g><circle cx="7" cy="6.6" r="1" fill="#e2506f"/><g fill="#ffd0dc" stroke="${c.ink}" stroke-width=".4">${[0, 72, 144, 216, 288].map((a) => `<circle cx="12.4" cy="11" r="1.1" transform="rotate(${a} 12.4 12.3)"/>`).join('')}</g><circle cx="12.4" cy="12.3" r=".6" fill="#e2506f"/>`,
  sabzeh: (c) => `<g stroke="#4f9a3a" stroke-width="1" stroke-linecap="round" fill="none"><path d="M4.6 9.6 3.6 3M6.2 9.6 6 1.8M8 9.6V1.2M9.8 9.6 10 2M11.4 9.6l1-6.4M5.4 9.6 4.8 5M10.6 9.6l.6-4.4"/></g><path d="M2 9.4h12l-1.4 5.2H3.4z" fill="#f0e6d0" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><path d="M2.8 11.6h10.4" stroke="#e23b3b" stroke-width="1.1"/>`,
  goldfish: (c) => `<path d="M2.2 8c1.6-3.2 5.2-4.4 8.2-2.6L14 3v10l-3.6-2.4C7.4 12.4 3.8 11.2 2.2 8z" fill="#f28c28" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><path d="M10.4 5.4c-.6 1.6-.6 3.6 0 5.2" stroke="#d96f12" stroke-width=".6" fill="none"/><circle cx="5" cy="7.4" r=".6" fill="#222"/><path d="M6.8 4.8 8 3.4l1 1.6" fill="#f7a23f" stroke="${c.ink}" stroke-width=".5"/>`,
  fanous: (c) => `<path d="M8 .4v1.4" stroke="${c.ink}" stroke-width=".8"/><path d="M5.4 3.4 8 1.6l2.6 1.8z" fill="#c9962e" stroke="${c.ink}" stroke-width=".6" stroke-linejoin="round"/><path d="M4.6 3.4h6.8l-.6 8H5.2z" fill="#ffe08a" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><path d="M6.4 3.4 6.8 11.4M9.6 3.4l-.4 8" stroke="#c9962e" stroke-width=".7"/><circle cx="8" cy="7.4" r="1.4" fill="#fff4cf"/><path d="M4.4 11.4h7.2l-1 2.6H5.4z" fill="#c9962e" stroke="${c.ink}" stroke-width=".6" stroke-linejoin="round"/><path d="M7 14h2v1.4H7z" fill="#c9962e"/>`,
  mooncake: (c) => `<circle cx="8" cy="8" r="6.4" fill="#d99a4e" stroke="${c.ink}" stroke-width=".7"/><g fill="#d99a4e" stroke="${c.ink}" stroke-width=".5">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<circle cx="8" cy="1.6" r="1.2" transform="rotate(${a} 8 8)"/>`).join('')}</g><circle cx="8" cy="8" r="6" fill="#d99a4e"/><circle cx="8" cy="8" r="3.8" fill="none" stroke="#b5732f" stroke-width=".8"/><path d="M8 5.4v5.2M5.4 8h5.2M6.2 6.2l3.6 3.6M9.8 6.2l-3.6 3.6" stroke="#b5732f" stroke-width=".6"/>`,
  diya: (c) => `<path d="M8 1.2C9.6 3.2 9.8 5 8 6.4 6.2 5 6.4 3.2 8 1.2z" fill="#ffc83d" stroke="#f08a24" stroke-width=".6"/><path d="M8 3.4c.6.9.6 1.8 0 2.4-.6-.6-.6-1.5 0-2.4z" fill="#fff4cf"/><path d="M1.4 8.2h13.2c-.6 3.4-3.2 5.6-6.6 5.6S2 11.6 1.4 8.2z" fill="#d9622b" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><path d="M14.6 8.2 15.4 6.8" stroke="${c.ink}" stroke-width=".7"/><g fill="#f6c431"><circle cx="5" cy="10.6" r=".6"/><circle cx="8" cy="11.4" r=".6"/><circle cx="11" cy="10.6" r=".6"/></g>`,
  splash: (c) => `<g stroke="${c.ink}" stroke-width=".5"><path d="M5.6 6.4C3.2 6 1.6 4.4 2.6 2.8c1-1.4 3-.6 3.6.6.8-1.8 3-2 3.6-.4.6 1.6-1 3-4.2 3.4z" fill="#ff4fa3"/><path d="M10.4 9.2c2.6-.4 4.2.6 3.8 2.4-.4 1.6-2.4 1.6-3.2.6-.4 1.8-2.4 2.6-3.4 1.4-1-1.4.2-3.6 2.8-4.4z" fill="#4facfe"/><path d="M4.6 10.4c1.6-.8 3.2 0 3 1.4-.2 1.6-2 2.4-3.4 1.6-1.4-.8-1.2-2.2.4-3z" fill="#ffd23f"/><path d="M11 2.6c1.2-.4 2.4.2 2.2 1.2-.2 1-1.6 1.4-2.6.8-.8-.6-.6-1.6.4-2z" fill="#7ee081"/></g>`,
  dreidel: (c) => `<path d="M8 .6v2.6" stroke="#6b4a33" stroke-width="1.6" stroke-linecap="round"/><path d="M3.6 3.4h8.8v6L8 15.2 3.6 9.4z" fill="#4f8fe0" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><path d="M8 3.4v11.8" stroke="#2f62a8" stroke-width=".6"/><path d="M3.6 6.4h8.8" stroke="#f6c431" stroke-width="1"/>`,
  pomegranate: (c) => `<path d="M6.2 2.6 7 1l1 1.2L9 1l.8 1.6" fill="#a8243a" stroke="${c.ink}" stroke-width=".6" stroke-linejoin="round"/><circle cx="8" cy="9" r="6" fill="#c62f45" stroke="${c.ink}" stroke-width=".7"/><path d="M5.4 3.8h5.2L10 5.4H6z" fill="#a8243a"/><path d="M8 9a3.6 3.6 0 0 1 3.6 3.6H4.4A3.6 3.6 0 0 1 8 9z" fill="#ffe3e0" stroke="#8c1d2e" stroke-width=".5"/><g fill="#e2234a"><circle cx="6.2" cy="11.6" r=".6"/><circle cx="7.6" cy="10.6" r=".6"/><circle cx="9" cy="11.4" r=".6"/><circle cx="10" cy="12.4" r=".5"/><circle cx="6" cy="12.6" r=".5"/></g><path d="M5 7q1-1.4 2.4-1.6" stroke="#fff" stroke-width=".6" opacity=".6" fill="none"/>`,
  marigold: (c) => `<g fill="#f7a21b" stroke="${c.ink}" stroke-width=".5">${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => `<ellipse cx="8" cy="2.6" rx="1.7" ry="2.4" transform="rotate(${a} 8 8)"/>`).join('')}</g><g fill="#f28c0f">${[15, 75, 135, 195, 255, 315].map((a) => `<ellipse cx="8" cy="4.6" rx="1.4" ry="1.9" transform="rotate(${a} 8 8)"/>`).join('')}</g><circle cx="8" cy="8" r="2" fill="#d96a0b" stroke="${c.ink}" stroke-width=".5"/>`,
  papel: (c) => `<path d="M.5 2.2Q8 3.6 15.5 2.2" stroke="${c.ink}" stroke-width=".7" fill="none"/><g stroke="${c.ink}" stroke-width=".5"><path d="M1 2.6h4.4v6.2L3.2 10 1 8.8z" fill="#ff4fa3"/><path d="M5.8 3h4.4v6.6L8 10.8l-2.2-1.2z" fill="#4facfe"/><path d="M10.6 2.6H15v6.2L12.8 10l-2.2-1.2z" fill="#7ee081"/></g><g fill="#fff"><circle cx="3.2" cy="5" r=".8"/><path d="M7.4 5.2h1.2l-.6 1.4z"/><circle cx="12.8" cy="5" r=".8"/><circle cx="3.2" cy="7.4" r=".4"/><circle cx="8" cy="7.8" r=".4"/><circle cx="12.8" cy="7.4" r=".4"/></g>`,
  mask: (c) => `<path d="M1.2 5.6C3 4.4 5.6 4.6 8 5.8c2.4-1.2 5-1.4 6.8-.2.2 3.4-1.6 5.6-4 5.6-1.2 0-2.2-.6-2.8-1.6-.6 1-1.6 1.6-2.8 1.6-2.4 0-4.2-2.2-4-5.6z" fill="${c.main}" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><g fill="#fff" stroke="${c.ink}" stroke-width=".5"><ellipse cx="4.8" cy="7.6" rx="1.6" ry="1.1"/><ellipse cx="11.2" cy="7.6" rx="1.6" ry="1.1"/></g><path d="M14.6 5.4C15.2 3 14.4 1.4 12.6 1c.4 1.6.2 3-.8 4.2" fill="#f6c431" stroke="${c.ink}" stroke-width=".5"/><g fill="#f6c431"><circle cx="8" cy="5.2" r=".7"/><circle cx="2.6" cy="9.8" r=".5"/><circle cx="13.4" cy="9.8" r=".5"/></g>`,
  crown: (c) => `<path d="M2 12.4 1.2 4.6l3.6 3L8 2.4l3.2 5.2 3.6-3-.8 7.8z" fill="#f6c431" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><rect x="2" y="12.2" width="12" height="2.2" rx=".6" fill="#e2a614" stroke="${c.ink}" stroke-width=".6"/><g stroke="${c.ink}" stroke-width=".4"><circle cx="8" cy="9.6" r="1.1" fill="#e23b3b"/><circle cx="4.6" cy="10.2" r=".8" fill="#4facfe"/><circle cx="11.4" cy="10.2" r=".8" fill="#7ee081"/></g>`,
  egg: (c) => `<path d="M8 1.2c3 0 5.4 4.4 5.4 8 0 3.2-2.4 5.6-5.4 5.6S2.6 12.4 2.6 9.2c0-3.6 2.4-8 5.4-8z" fill="#bfe3ff" stroke="${c.ink}" stroke-width=".7"/><path d="M2.9 7.6q1.3-1 2.6 0t2.5 0 2.5 0 2.6 0" stroke="#ff7aa2" stroke-width="1.1" fill="none"/><path d="M2.7 10.8q1.3-1 2.6 0t2.7 0 2.7 0 2.6 0" stroke="#ffd23f" stroke-width="1.1" fill="none"/><g fill="#7ee081"><circle cx="6" cy="4.6" r=".6"/><circle cx="10" cy="4.6" r=".6"/><circle cx="8" cy="13" r=".6"/></g>`,
  shamrock: (c) => `<path d="M8 9.6c.4 2 1.2 4 2.8 5.6" stroke="#3c7a2c" stroke-width="1.1" fill="none" stroke-linecap="round"/><g fill="#4fae4a" stroke="${c.ink}" stroke-width=".6">${[0, 120, 240].map((a) => `<path d="M8 8C6.2 6.6 5.4 4.4 6.6 3.4 7.4 2.8 8 3.4 8 4c0-.6.6-1.2 1.4-.6C10.6 4.4 9.8 6.6 8 8z" transform="rotate(${a} 8 8)"/>`).join('')}</g>`,
  flowercrown: (c) => `<path d="M1.4 10.4Q8 14.6 14.6 10.4" stroke="#5aa043" stroke-width="1.4" fill="none"/><g stroke="${c.ink}" stroke-width=".5"><circle cx="3" cy="10.6" r="1.8" fill="#ff9ac4"/><circle cx="6" cy="12" r="1.9" fill="#fff"/><circle cx="10" cy="12" r="1.9" fill="#ffd23f"/><circle cx="13" cy="10.6" r="1.8" fill="#b9a6ff"/><circle cx="8" cy="12.6" r="1.6" fill="#ff7a7a"/></g><g fill="#f6c431"><circle cx="6" cy="12" r=".6"/><circle cx="3" cy="10.6" r=".5"/><circle cx="13" cy="10.6" r=".5"/></g><path d="M3 9 2.4 6.4M13 9l.6-2.6" stroke="#5aa043" stroke-width=".8"/><ellipse cx="2.4" cy="5.8" rx=".9" ry="1.4" fill="#7ec06a"/><ellipse cx="13.6" cy="5.8" rx=".9" ry="1.4" fill="#7ec06a"/>`,
  firework: (c) => `<g stroke-linecap="round" stroke-width="1.1">${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a, i) => `<path d="M8 4.4V1.2" stroke="${['#ff4fa3', '#ffd23f', '#4facfe', '#7ee081'][i % 4]}" transform="rotate(${a} 8 8)"/>`).join('')}</g><g fill="#fff4b0">${[15, 75, 135, 195, 255, 315].map((a) => `<circle cx="8" cy="3.4" r=".6" transform="rotate(${a} 8 8)"/>`).join('')}</g><circle cx="8" cy="8" r="1.4" fill="#fff" stroke="${c.ink}" stroke-width=".5"/>`,
  tanzaku: (c) => `<path d="M3 1.4c2.4 1.6 3.6 6 3.8 13" stroke="#5aa043" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M4.2 3.6 6.4 2.6M5.2 6.4l2.4-.6" stroke="#5aa043" stroke-width=".8"/><path d="M7.6 4.6v.8" stroke="${c.ink}" stroke-width=".5"/><rect x="6.4" y="5.4" width="2.6" height="7" rx=".3" fill="#ff9ac4" stroke="${c.ink}" stroke-width=".5" transform="rotate(8 7.7 9)"/><path d="M11.8 2.6v.8" stroke="${c.ink}" stroke-width=".5"/><rect x="10.6" y="3.4" width="2.6" height="7" rx=".3" fill="#9fd4ff" stroke="${c.ink}" stroke-width=".5" transform="rotate(-6 11.9 7)"/><path d="m13.4 11.6.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z" fill="#ffd23f"/>`,
  dragonboat: (c) => `<path d="M1 9.6h12.6l1.6-2.6.4 1.4-1.2 3.4H3.2z" fill="#e23b3b" stroke="${c.ink}" stroke-width=".6" stroke-linejoin="round"/><path d="M13.6 9.6c.4-2 .2-3.6-.8-4.6 1.4.2 2.4 1 2.6 2l-.2 1z" fill="#2fa36b" stroke="${c.ink}" stroke-width=".5"/><circle cx="14.2" cy="6.6" r=".4" fill="#222"/><path d="M2.6 9.6 1 7.4" stroke="${c.ink}" stroke-width=".6"/><g stroke="#f6c431" stroke-width=".6"><path d="M4.4 9.6 3.6 6.8M7 9.6 6.2 6.8M9.6 9.6 8.8 6.8"/></g><path d="M0 13.4q2-1 4 0t4 0 4 0 4 0" stroke="#4facfe" stroke-width="1.1" fill="none"/>`,
  zongzi: (c) => `<path d="M8 1.6 14.2 13H1.8z" fill="#7cb85a" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><path d="M8 1.6 5.4 13M8 1.6 10.6 13" stroke="#5a9440" stroke-width=".6"/><path d="M3 10.6h10" stroke="#d9a05b" stroke-width="1.2"/><path d="M8 10.6l-1 3.2M8 10.6l1 3.2" stroke="#d9a05b" stroke-width=".8"/>`,
  koinobori: (c) => `<path d="M1.6 1v14.4" stroke="#8a5a33" stroke-width="1" stroke-linecap="round"/><circle cx="1.6" cy="1" r=".7" fill="#f6c431"/><path d="M2.2 2.4h9.6l3 1.9-3 1.9H2.2z" fill="#4facfe" stroke="${c.ink}" stroke-width=".5" stroke-linejoin="round"/><circle cx="4" cy="4.3" r=".9" fill="#fff" stroke="${c.ink}" stroke-width=".4"/><path d="M2.2 7.6h8l2.8 1.8-2.8 1.8h-8z" fill="#ff5f6d" stroke="${c.ink}" stroke-width=".5" stroke-linejoin="round"/><circle cx="4" cy="9.4" r=".8" fill="#fff" stroke="${c.ink}" stroke-width=".4"/><path d="M6.4 3.4q.6.9 0 1.8M8.4 3.4q.6.9 0 1.8M6.2 8.6q.6.8 0 1.6M8 8.6q.6.8 0 1.6" stroke="#fff" stroke-width=".5" fill="none"/>`,
  // Bold and loud: the big personalities.
  palm: (c) => `<path d="M8.6 15.6c-.4-3.8.1-7 1.1-9.6" fill="none" stroke="#8a5a2b" stroke-width="1.5" stroke-linecap="round"/><g fill="#2fbf71" stroke="${c.ink}" stroke-width=".5" stroke-linejoin="round"><path d="M9.6 6C7 3.6 4 3.6 1.4 5.4 4.4 5 6.8 5.4 9.6 6z"/><path d="M9.6 6c1.4-3 4-4 6-3-2.4.4-4.2 1.4-6 3z"/><path d="M9.6 6c2.6-.6 4.8.6 5.8 2.8-2-1-3.8-1.8-5.8-2.8z"/><path d="M9.6 6C8 7.6 6 8.8 3.2 9 4.8 7.4 7 6.4 9.6 6z"/><path d="M9.6 6c-.8-2.4 0-4.4 1.6-5.6-.2 2-.6 3.8-1.6 5.6z"/></g><circle cx="9.2" cy="6.8" r=".8" fill="#8a5a2b"/>`,
  laurel: (c) => `<g fill="none" stroke="#a87c22" stroke-width=".8" stroke-linecap="round"><path d="M7.4 14.4C3.6 12.6 2 8.6 3.6 3.6"/><path d="M8.6 14.4c3.8-1.8 5.4-5.8 3.8-10.8"/></g><g fill="#e0b84a" stroke="${c.ink}" stroke-width=".45">${[[4.8, 12.6, -40], [3.4, 10, -70], [3, 7.2, -95], [3.6, 4.6, -120], [6.2, 13.6, -15]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="1.7" ry=".75" transform="rotate(${r} ${x} ${y})"/><ellipse cx="${16 - x}" cy="${y}" rx="1.7" ry=".75" transform="rotate(${-r} ${16 - x} ${y})"/>`).join('')}</g><path d="M6.6 14.2 8 15.4l1.4-1.2" fill="none" stroke="${c.accent}" stroke-width="1" stroke-linecap="round"/>`,
  fan: (c) => `<path d="M8 13.6 1.4 6.8a9.4 9.4 0 0 1 13.2 0z" fill="${mix(c.main, '#ffffff', 0.45)}" stroke="${c.ink}" stroke-width=".8" stroke-linejoin="round"/><g stroke="${c.ink}" stroke-width=".45" opacity=".7">${[2.6, 4.3, 6.1, 8, 9.9, 11.7, 13.4].map((x) => `<path d="M8 13.4 ${x} ${x < 4 || x > 12 ? 5.2 : x < 6 || x > 10 ? 3.8 : 3.4}"/>`).join('')}</g><path d="M1.4 6.8q1.1-1.3 2.4-1.4 1-1.4 2.6-1.6 1.6-1 3.2 0 1.6.2 2.6 1.6 1.3.1 2.4 1.4" fill="none" stroke="#d4a640" stroke-width=".9"/><circle cx="8" cy="13.4" r="1.1" fill="#d4a640" stroke="${c.ink}" stroke-width=".5"/><path d="M8 14.5v1.2" stroke="${c.accent}" stroke-width=".9" stroke-linecap="round"/>`,
  discoball: (c) => `<path d="M8 0v2.4" stroke="${c.ink}" stroke-width=".7"/><circle cx="8" cy="8.6" r="6.2" fill="#d9dde8" stroke="${c.ink}" stroke-width=".8"/><g fill="#fff">${[[5, 5.4], [8, 4.2], [10.6, 6.6], [6.4, 8.6], [9.4, 10.4], [4.6, 11]].map(([x, y]) => `<rect x="${x}" y="${y}" width="1.8" height="1.6"/>`).join('')}</g><g fill="${c.accent}" opacity=".75"><rect x="11.4" y="9.2" width="1.6" height="1.5"/><rect x="7" y="11.6" width="1.7" height="1.5"/></g><g fill="none" stroke="${c.ink}" stroke-width=".35" opacity=".55"><ellipse cx="8" cy="8.6" rx="2.8" ry="6.2"/><path d="M1.8 8.6h12.4M2.6 5.6h10.8M2.6 11.6h10.8M8 2.4v12.4"/></g><path d="m13.6 1.4.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" fill="#fff" stroke="${c.ink}" stroke-width=".3"/>`,
  boom: (c) => {
    const pts = (r1, r2, n = 12) => Array.from({ length: n * 2 }, (_, i) => { const a = (Math.PI * i) / n - Math.PI / 2; const r = i % 2 ? r2 : r1 * (i % 4 ? 0.92 : 1); return `${(8 + r * Math.cos(a)).toFixed(2)},${(8 + r * Math.sin(a)).toFixed(2)}`; }).join(' ');
    return `<polygon points="${pts(7.8, 4.6)}" fill="#ffe14d" stroke="${c.ink}" stroke-width=".8" stroke-linejoin="round"/><polygon points="${pts(4.8, 2.8, 9)}" fill="#e3262f"/><path d="M7.6 5.4h1l-.2 3.4h-.6zM7.5 9.6h1.1v1.1H7.5z" fill="#fff"/>`;
  },
  squiggle: (c) => `<path d="M1.2 6.4l2.4-2.6 2.4 2.6 2.4-2.6 2.4 2.6 2.4-2.6 2.4 2.6" fill="none" stroke="#ff5ca8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 14.6 5.6 8.4l3.6 6.2z" fill="#1fb5b0" stroke="${c.ink}" stroke-width=".7" stroke-linejoin="round"/><circle cx="12.2" cy="11.6" r="2.6" fill="#ffd23f" stroke="${c.ink}" stroke-width=".7"/><g fill="${c.ink}"><circle cx="9.6" cy="9" r=".5"/><circle cx="14.6" cy="8" r=".5"/><circle cx="11" cy="15.2" r=".5"/></g>`,
  lips: (c) => `<path d="M1.2 8.2C3.2 5 5.6 4.2 8 6c2.4-1.8 4.8-1 6.8 2.2-1.8 3.6-4.4 4.8-6.8 4.8S3 11.8 1.2 8.2z" fill="#e0218a" stroke="${c.ink}" stroke-width=".8" stroke-linejoin="round"/><path d="M2 8.3Q8 10.2 14 8.3" fill="none" stroke="#8c0f52" stroke-width=".9" stroke-linecap="round"/><path d="M5 6.4q1.4-.6 2.2.4" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".7" stroke-linecap="round"/><path d="M5.6 11.2q2.4 1 4.8 0" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".7" stroke-linecap="round"/>`,
  chandelier: (c) => `<path d="M8 0v3.6" stroke="#a87c22" stroke-width=".8"/><g fill="none" stroke="#d4a640" stroke-width="1" stroke-linecap="round"><path d="M8 5.2C8 9 3.6 9.6 2.4 7.4M8 5.2c0 3.8 4.4 4.4 5.6 2.2M8 5.2v5.6"/><path d="M4.4 11.6Q8 13.4 11.6 11.6"/></g><circle cx="8" cy="4.6" r="1.4" fill="#e0b84a" stroke="${c.ink}" stroke-width=".5"/><g fill="#fff8e1" stroke="${c.ink}" stroke-width=".4">${[[2.4, 7.4], [13.6, 7.4], [8, 10.8]].map(([x, y]) => `<rect x="${x - 0.6}" y="${y - 2.8}" width="1.2" height="2.6"/>`).join('')}</g><g fill="#ffb84d">${[[2.4, 4.2], [13.6, 4.2], [8, 7.6]].map(([x, y]) => `<path d="M${x} ${y}c-.5-.6-.4-1.2 0-1.8.4.6.5 1.2 0 1.8z"/>`).join('')}</g><g fill="${mix(c.accent, '#ffffff', 0.4)}" stroke="${c.ink}" stroke-width=".3">${[[4.4, 12.8], [8, 14.4], [11.6, 12.8]].map(([x, y]) => `<path d="M${x} ${y - 1}l.8 1-.8 1.2-.8-1.2z"/>`).join('')}</g>`,
  pickaxe: () => {
    // Pixel art on a 16 × 16 grid: the head, then the handle.
    const map = ['................', '...aaaaaaa......', '..abbbbbbba.....', '.abccc..cbba....', '.ac......cba....', '.a......ddcba...', '.......dd..cba..', '......dd....ca..', '.....dd......a..', '....dd..........', '...dd...........', '..dd............', '.dd.............', '.d..............', '................', '................'];
    const col = { a: '#3a3a3a', b: '#7fe6e0', c: '#c9fff9', d: '#8a5a2b' };
    return `<g shape-rendering="crispEdges">${map.flatMap((row, y) => [...row].map((k, x) => (col[k] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${col[k]}"/>` : ''))).join('')}</g>`;
  },
  tent: (c) => {
    const xs = [1.6, 3.2, 4.8, 6.4, 8, 9.6, 11.2, 12.8, 14.4];
    return `<path d="M8 2.2 1.6 13.4h12.8z" fill="#fff6e3" stroke="${c.ink}" stroke-width=".8" stroke-linejoin="round"/><g fill="#d7263d">${[0, 2, 4, 6].map((i) => `<path d="M8 2.2 ${xs[i]} 13.4h1.6z"/>`).join('')}</g><path d="M8 2.2 1.6 13.4h12.8z" fill="none" stroke="${c.ink}" stroke-width=".8" stroke-linejoin="round"/><path d="M6.8 13.4 8 9.6l1.2 3.8z" fill="#3b2a6b"/><path d="M8 2.2V.4l2.6.8L8 2" fill="#f4b400" stroke="${c.ink}" stroke-width=".4"/><path d="M1 13.6h14" stroke="${c.ink}" stroke-width=".8" stroke-linecap="round"/>`;
  }
};
export const CHARM_NAMES = { none: 'None', heart: 'Heart', ears: 'Bunny ears', bunny: 'Bunny', bow: 'Bow', leaf: 'Leaf', sparkle: 'Sparkle', star: 'Star', daisy: 'Daisy', cherry: 'Cherries', cloud: 'Cloud', frog: 'Frog', boba: 'Boba', peach: 'Peach', moon: 'Moon', rainbow: 'Rainbow', pal: 'Bunny friend', twinkle: 'Twinkles', hearts: 'Hearts', snowman: 'Snowman', snowflake: 'Snowflake', mitten: 'Mitten', santa: 'Santa', fir: 'Festive tree', present: 'Present', tulip: 'Tulip', chick: 'Chick', bee: 'Bee', sun: 'Sunshine', icelolly: 'Ice lolly', watermelon: 'Watermelon', maple: 'Maple leaf', acorn: 'Acorn', pumpkin: 'Pumpkin', jack: 'Jack-o’-lantern', ghost: 'Little ghost', lantern: 'Red lantern', blossom: 'Blossom', sabzeh: 'Spring sprouts', goldfish: 'Goldfish', fanous: 'Lantern', mooncake: 'Mooncake', diya: 'Diya lamp', splash: 'Colour splash', dreidel: 'Dreidel', pomegranate: 'Pomegranate', marigold: 'Marigold', papel: 'Paper bunting', mask: 'Carnival mask', crown: 'Crown', egg: 'Painted egg', shamrock: 'Shamrock', flowercrown: 'Flower crown', firework: 'Firework', tanzaku: 'Wish papers', dragonboat: 'Dragon boat', zongzi: 'Rice dumpling', koinobori: 'Carp streamers', plain: 'Plain (no charm)', dot: 'Dot', ring: 'Ring', diamond: 'Diamond', plus: 'Plus', asterisk: 'Asterisk', chevron: 'Chevron', palm: 'Palm tree', laurel: 'Laurel wreath', fan: 'Hand fan', discoball: 'Mirror ball', boom: 'POW!', squiggle: 'Memphis shapes', lips: 'Lips', chandelier: 'Chandelier', pickaxe: 'Pickaxe', tent: 'Circus tent' };

// The colours a theme draws its little pictures with.
export function inks(t) {
  const [h, s] = hsl(t.main);
  return { main: t.main, accent: t.accent, paper: t.paper, ink: hslHex(h, Math.min(0.55, s), 0.2), soft: mix(t.main, '#ffffff', 0.72) };
}
const svgUrl = (inner, w, hgt) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}">${inner}</svg>`)}")`;
const place = (name, c, x, y, scale = 1, rot = 0) => (CHARMS[name] ? `<g transform="translate(${x} ${y}) rotate(${rot} ${8 * scale} ${8 * scale}) scale(${scale})">${CHARMS[name](c)}</g>` : '');
export const charmUrl = (name, t, size = 16) => svgUrl(place(name, inks(t), 0, 0, size / 16), size, size);

// ---------- emoji ----------

// Keeps only emoji (whole ones: skin tones, flags and families stay together), up to `max`.
const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
export function emojiList(text, max = 3) {
  const s = String(text || '').slice(0, 200);
  const parts = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].map((x) => x.segment) : [...s];
  return parts.filter((g) => PICTO.test(g) && g.length <= 16 && !/[<>&"'\\]/.test(g)).slice(0, max);
}
const xml = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const EMOJI_FONT = 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
const emojiAt = (e, x, y, size, rot = 0) => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" font-family="${EMOJI_FONT}" transform="rotate(${rot} ${x} ${y})">${xml(e)}</text>`;
// How the emoji wallpaper lays them out: [tile size, [x, y, size, tilt]…]
export const EMOJI_LAYOUTS = {
  grid: { name: 'Neat rows', tile: 64, spots: [[16, 16, 24, 0], [48, 48, 24, 0]] },
  scatter: { name: 'Scattered', tile: 128, spots: [[20, 22, 26, -12], [72, 14, 18, 10], [110, 44, 24, 8], [42, 64, 20, 15], [90, 90, 30, -8], [20, 106, 18, 6], [62, 114, 22, -15]] },
  big: { name: 'Big and small', tile: 150, spots: [[42, 42, 52, -8], [114, 112, 40, 10], [118, 30, 18, 12], [30, 122, 16, -10]] }
};

// ---------- wallpapers ----------

const dark = (t) => hsl(t.main)[2] < 0.42;
export const WALLPAPERS = {
  sky: { name: 'Sky (follows the time of day)' },
  bunnies: { name: 'Bunnies', tile: 72, draw: (c) => place('bunny', c, 8, 8, 1.3) + place('heart', c, 44, 42, 0.9, -12) + place('heart', c, 50, 6, 0.55, 14) + place('bunny', c, 6, 46, 0.8, 8) },
  hearts: { name: 'Hearts', tile: 56, draw: (c) => place('heart', c, 6, 6, 1.1) + place('heart', c, 34, 32, 0.8, 12) },
  leaves: { name: 'Leaves', tile: 64, draw: (c) => place('leaf', c, 6, 8, 1.2, -20) + place('leaf', c, 38, 38, 0.9, 30) + place('leaf', c, 42, 4, 0.6, 70) },
  sparkles: { name: 'Sparkles', tile: 64, draw: (c) => place('sparkle', c, 6, 6, 1.3) + place('sparkle', c, 40, 36, 0.8) + place('star', c, 44, 6, 0.5) + place('sparkle', c, 10, 44, 0.5) },
  stars: { name: 'Stars', tile: 60, draw: (c) => place('star', c, 8, 8, 1) + place('star', c, 38, 34, 0.7, 20) },
  grid: { name: 'Neon grid', css: (t, c) => `linear-gradient(${c.accent}55 1px, transparent 1px) 0 0 / 32px 32px, linear-gradient(90deg, ${c.accent}55 1px, transparent 1px) 0 0 / 32px 32px, radial-gradient(ellipse 90% 60% at 50% 110%, ${c.accent}66, transparent 70%), linear-gradient(180deg, ${hslHex(hsl(t.main)[0], 0.55, 0.1)}, ${hslHex(hsl(t.main)[0], 0.5, 0.24)})` },
  daisies: { name: 'Daisies', tile: 64, draw: (c) => place('daisy', c, 6, 6, 1.2) + place('daisy', c, 40, 38, 0.8) + place('daisy', c, 44, 4, 0.5) },
  cherries: { name: 'Cherries', tile: 64, draw: (c) => place('cherry', c, 6, 6, 1.2) + place('cherry', c, 38, 36, 0.9, 15) },
  clouds: { name: 'Clouds', tile: 80, draw: (c) => place('cloud', c, 6, 8, 1.6) + place('cloud', c, 44, 46, 1.1) + place('sparkle', c, 54, 10, 0.5) },
  lilypads: { name: 'Lily pads', tile: 72, draw: (c) => `<g fill="#7cc06a" stroke="#3d7a33" stroke-width=".8"><path d="M14 30a12 9 0 1 1 8-2.5L14 22z"/><path d="M54 62a9 7 0 1 1 6-2L54 56z"/></g>` + place('frog', c, 6, 12, 1) + place('heart', c, 50, 14, 0.6) },
  boba: { name: 'Boba', tile: 64, draw: (c) => place('boba', c, 6, 6, 1.3) + `<g fill="#3b2418" opacity=".55"><circle cx="44" cy="44" r="2.4"/><circle cx="52" cy="50" r="2"/><circle cx="40" cy="54" r="1.8"/></g>` },
  bubbles: { name: 'Bubbles', tile: 64, draw: (c) => `<g fill="#fff" fill-opacity=".55" stroke="${c.ink}" stroke-opacity=".35"><circle cx="16" cy="16" r="8"/><circle cx="46" cy="40" r="5"/><circle cx="30" cy="52" r="3"/></g>` + place('peach', c, 40, 4, 0.8) },
  moons: { name: 'Moons and stars', tile: 72, dark: true, draw: (c) => place('moon', c, 8, 8, 1.3) + place('sparkle', c, 46, 40, 0.7) + `<g fill="#fff"><circle cx="50" cy="12" r="1"/><circle cx="20" cy="56" r="1.2"/><circle cx="62" cy="64" r=".8"/></g>` },
  gingham: { name: 'Gingham', css: (t, c) => `repeating-linear-gradient(0deg, ${c.main}40 0 14px, transparent 14px 28px), repeating-linear-gradient(90deg, ${c.main}40 0 14px, transparent 14px 28px), ${mix(t.paper, '#ffffff', 0.4)}` },
  checks: { name: 'Checkerboard', css: (t, c) => `conic-gradient(${c.soft} 25%, ${mix(c.accent, '#ffffff', 0.6)} 0 50%, ${c.soft} 0 75%, ${mix(c.accent, '#ffffff', 0.6)} 0) 0 0 / 40px 40px` },
  // Neutral
  plain: { name: 'Plain', css: (t) => mix(t.paper, t.main, 0.16) },
  dots: { name: 'Dots', css: (t) => `radial-gradient(${mix(t.paper, t.main, 0.4)} 1.2px, transparent 1.6px) 0 0 / 18px 18px, ${mix(t.paper, t.main, 0.08)}` },
  lines: { name: 'Pinstripes', css: (t) => `repeating-linear-gradient(135deg, ${mix(t.paper, t.main, 0.22)} 0 1px, transparent 1px 9px), ${mix(t.paper, t.main, 0.1)}` },
  graph: { name: 'Graph paper', css: (t) => `linear-gradient(${mix(t.paper, t.main, 0.28)} 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, ${mix(t.paper, t.main, 0.28)} 1px, transparent 1px) 0 0 / 24px 24px, ${mix(t.paper, '#ffffff', 0.5)}` },
  linen: { name: 'Linen', css: (t) => `repeating-linear-gradient(0deg, ${mix(t.paper, t.main, 0.12)} 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, ${mix(t.paper, t.main, 0.1)} 0 1px, transparent 1px 4px), ${mix(t.paper, t.main, 0.06)}` },
  contours: { name: 'Contour lines', tile: 160, draw: (c, t) => `<g fill="none" stroke="${mix(t.paper, t.main, 0.35)}" stroke-width="1">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M-10 ${20 + i * 26} C 30 ${4 + i * 26}, 60 ${44 + i * 26}, 90 ${22 + i * 26} S 150 ${2 + i * 26}, 170 ${20 + i * 26}"/>`).join('')}</g>`, ground: (t) => mix(t.paper, t.main, 0.06) },
  grain: { name: 'Grain', tile: 200, draw: () => `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .12 0"/></filter><rect width="100%" height="100%" filter="url(#g)"/>`, ground: (t) => mix(t.main, '#000000', 0.15) },
  // Bold and loud
  sunset: {
    name: 'Neon sunset',
    css: (t, c) => {
      const night = hslHex(hsl(t.main)[0] + 40, 0.6, 0.1);
      const palm = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${night}"><path d="M44 220C46 170 52 120 64 76l5 1c-10 43-16 93-16 143z"/><path d="M66 76C40 54 12 56 0 74c22-8 44-8 66 2zM66 76C70 46 94 30 118 38 94 44 78 58 66 76zM66 76c28-14 56-8 70 14-24-12-46-14-70-14zM66 76C46 88 26 106 22 132 34 108 50 92 66 76zM66 76c4-30-8-56-30-66 16 18 24 40 30 66zM66 76c18 8 32 26 34 50-10-20-22-36-34-50z"/></g>`;
      const palms = svgUrl(palm(10, 0, 1) + palm(196, 66, 0.7), 300, 220);
      return `${palms} 0 100% / 300px 220px repeat-x, repeating-linear-gradient(0deg, ${c.main}cc 0 2px, transparent 2px 26px) 0 100% / 100% 30% no-repeat, repeating-linear-gradient(90deg, ${c.accent}88 0 2px, transparent 2px 56px) 0 100% / 100% 30% no-repeat, repeating-linear-gradient(0deg, transparent 0 9px, ${night} 9px 12px) 50% 58% / 220px 110px no-repeat, radial-gradient(circle 110px at 50% 64%, #ffd166 0, #ff8a5c 45%, ${c.main} 80%, transparent 81%), linear-gradient(180deg, ${night} 0%, ${hslHex(hsl(t.main)[0] - 40, 0.7, 0.24)} 38%, ${c.main} 62%, #ff8a5c 70%, ${night} 70.2%)`;
    }
  },
  laurels: {
    name: 'Empire stripes and laurels',
    css: (t, c) => {
      const deep = hslHex(hsl(t.main)[0], 0.5, 0.2);
      const mid = hslHex(hsl(t.main)[0], 0.45, 0.27);
      const wreaths = svgUrl(place('laurel', c, 30, 30, 3.2) + place('star', { ...c, accent: '#e0b84a' }, 70, 60, 0.7) + place('star', { ...c, accent: '#e0b84a' }, 10, 110, 0.5), 112, 140);
      return `${wreaths} 0 0 / 112px 140px, repeating-linear-gradient(90deg, ${deep} 0 26px, #c8a042 26px 28px, ${mid} 28px 54px, #c8a042 54px 56px)`;
    }
  },
  rococo: {
    name: 'Rococo scrolls',
    tile: 120,
    ground: (t) => mix(t.main, '#ffffff', 0.72),
    draw: (c) => `<g fill="none" stroke="#d4a640" stroke-width="2" stroke-linecap="round"><path d="M14 64c0-18 14-28 26-20s6 24-8 22c-8-1-8-10-2-12"/><path d="M106 56c0 18-14 28-26 20s-6-24 8-22c8 1 8 10 2 12"/><path d="M40 44c10-14 30-16 40-2"/><path d="M46 100c8 10 22 10 28 0"/></g><g fill="#fff" stroke="#d4a640" stroke-width=".8">${[[60, 30], [52, 34], [68, 34], [60, 110], [8, 8], [112, 112]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4"/>`).join('')}</g>${place('heart', c, 54, 64, 0.8)}<g transform="translate(96 96)"><circle r="7" fill="${c.accent}" stroke="${c.ink}" stroke-width=".8"/><path d="M0-4c3 0 4 3 2 4s-4-1-2-2" fill="none" stroke="${c.ink}" stroke-width=".8"/></g><g transform="translate(22 100)"><circle r="6" fill="${mix(c.main, '#ffffff', 0.25)}" stroke="${c.ink}" stroke-width=".8"/><path d="M0-3c2.5 0 3.5 2.5 1.7 3.4S-1.8-.4 0-1.6" fill="none" stroke="${c.ink}" stroke-width=".7"/></g>`
  },
  disco: {
    name: 'Mirror ball',
    tile: 48,
    dark: true,
    draw: (c) => {
      const tint = [0.08, 0.2, 0.34, 0.5, 0.12, 0.42];
      let n = 7;
      const rnd = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
      let out = '';
      for (let y = 0; y < 48; y += 8) for (let x = 0; x < 48; x += 8) {
        const r = rnd();
        const fill = r > 0.9 ? c.accent : r > 0.8 ? mix(c.main, '#ffffff', 0.5) : '#ffffff';
        out += `<rect x="${x + 0.6}" y="${y + 0.6}" width="6.8" height="6.8" rx=".8" fill="${fill}" fill-opacity="${r > 0.8 ? 0.85 : tint[Math.floor(rnd() * tint.length)]}"/>`;
      }
      return out + place('sparkle', c, 30, 6, 0.6);
    }
  },
  benday: {
    name: 'Pop-art dots',
    css: (t, c) => {
      const bursts = svgUrl(place('boom', c, 20, 24, 4.2) + place('boom', c, 150, 130, 2.6, 18) + place('star', { ...c, accent: '#1e5bd8' }, 160, 30, 1.2), 240, 220);
      const dot = mix(c.main, '#ffffff', 0.15);
      return `${bursts} 0 0 / 240px 220px, radial-gradient(${dot} 3px, transparent 3.6px) 0 0 / 16px 16px, radial-gradient(${dot} 3px, transparent 3.6px) 8px 8px / 16px 16px, #ffe14d`;
    }
  },
  memphis: {
    name: 'Memphis squiggles',
    tile: 140,
    ground: (t) => mix(t.paper, '#ffffff', 0.3),
    draw: (c) => `<g fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 24l9-9 9 9 9-9 9 9" stroke="#ff5ca8"/><path d="M80 110c8-10 16 10 24 0s16 10 24 0" stroke="#1fb5b0"/><path d="M96 20a14 14 0 0 1 28 0" stroke="${c.ink}" stroke-width="3"/></g><path d="M20 120l14-24 14 24z" fill="#ffd23f" stroke="${c.ink}" stroke-width="2" stroke-linejoin="round"/><circle cx="70" cy="58" r="12" fill="#1fb5b0" stroke="${c.ink}" stroke-width="2"/><rect x="108" y="56" width="14" height="14" fill="#ff5ca8" stroke="${c.ink}" stroke-width="2" transform="rotate(20 115 63)"/><g fill="${c.ink}">${[[44, 40], [52, 40], [44, 48], [52, 48], [120, 92], [128, 92], [120, 100], [128, 100], [10, 70], [62, 128]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8"/>`).join('')}</g><g stroke-width="4" stroke-linecap="round"><path d="M30 80l8 6" stroke="#ff5ca8"/><path d="M90 80l-4 9" stroke="#ffd23f"/><path d="M56 100l9-2" stroke="#7a5cff"/></g>`
  },
  leopard: {
    name: 'Leopard print',
    tile: 120,
    ground: () => '#e7bd84',
    draw: () => {
      const spot = (x, y, s, r) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M0-6C5-7 8-2 6 3 4 7-3 7-6 3-8-1-5-6 0-6z" fill="#b8702c"/><g fill="none" stroke="#2a1a10" stroke-width="2.4" stroke-linecap="round"><path d="M-7-2C-8-6-4-9 0-8.6"/><path d="M4-8c3 1 5 4 4.6 7"/><path d="M7.4 3C6 7 2 9-1.6 8.6"/><path d="M-4.4 7.6C-6.6 6.4-8 4.6-8.2 2.6"/></g></g>`;
      return [[18, 18, 1.3, 10], [70, 26, 1.1, -30], [104, 70, 1.25, 50], [40, 66, 1, 80], [16, 102, 1.15, -10], [78, 104, 0.95, 20]].map((p) => spot(...p)).join('') + `<g fill="#2a1a10">${[[48, 12, 2.4], [98, 14, 2], [8, 54, 2.2], [60, 92, 2.6], [112, 106, 2], [34, 40, 1.6]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}"/>`).join('')}</g>`;
    }
  },
  damask: {
    name: 'Velvet damask',
    tile: 96,
    dark: true,
    draw: () => {
      const half = '<path d="M48 8c-6 10-18 14-18 28 0 10 8 16 14 12-6 0-8-6-6-10 2-6 10-8 10-18 0 10 8 12 10 18 2 4 0 10-6 10 6 4 14-2 14-12 0-14-12-18-18-28z"/><path d="M48 52c-4 6-14 8-16 16 4-2 10-2 12 2-4 0-6 4-4 8 2-6 8-8 8-14 0 6 6 8 8 14 2-4 0-8-4-8 2-4 8-4 12-2-2-8-12-10-16-16z"/><circle cx="48" cy="90" r="3"/>';
      return `<g fill="#d4a64a" fill-opacity=".38">${half}<g transform="translate(-48 -48)">${half}</g><g transform="translate(48 -48)">${half}</g><g transform="translate(-48 48)">${half}</g><g transform="translate(48 48)">${half}</g></g>`;
    }
  },
  blocks: {
    name: 'Blocky landscape',
    css: (t, c) => {
      let n = 11;
      const rnd = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
      const px = (x, y, fill) => `<rect x="${x}" y="${y}" width="4" height="4" fill="${fill}"/>`;
      let ground = '';
      const grass = ['#5d9e2f', '#6fb33a', '#4f8a27'];
      const dirt = ['#8b5a2b', '#9c6a38', '#7a4c22', '#6b4220'];
      const stone = ['#8a8a8a', '#9c9c9c', '#777777', '#6a6a6a'];
      // Each layer's own colour, then a speckle of its other shades (and the odd ore in the stone).
      ground += `<rect width="64" height="8" fill="${grass[0]}"/><rect y="8" width="64" height="40" fill="${dirt[0]}"/><rect y="48" width="64" height="48" fill="${stone[0]}"/>`;
      for (let y = 0; y < 96; y += 4) for (let x = 0; x < 64; x += 4) {
        const r = rnd();
        const pal = y < 8 || (y < 14 && r > 0.6) ? grass : y < 48 ? dirt : stone;
        const ore = y >= 56 && r > 0.965 ? (r > 0.985 ? '#7fe6e0' : '#2b2b2b') : null;
        const shade = rnd() > 0.62 ? 1 + Math.floor(rnd() * (pal.length - 1)) : 0;
        if (ore || shade || (y >= 8 && y < 14 && pal === grass)) ground += px(x, y, ore || pal[shade]);
      }
      ground += `<g fill="none" stroke="#000" stroke-opacity=".18"><path d="M32 0v96M0 32h64M0 64h64"/></g>`;
      const strip = svgUrl(`<g shape-rendering="crispEdges">${ground}</g>`, 64, 96);
      const cloud = (x, y) => `<g fill="#fff" shape-rendering="crispEdges"><rect x="${x}" y="${y}" width="48" height="8"/><rect x="${x + 8}" y="${y - 8}" width="24" height="8"/><rect x="${x - 8}" y="${y + 8}" width="64" height="8" fill-opacity=".85"/></g>`;
      const clouds = svgUrl(cloud(20, 30) + cloud(150, 80), 240, 140);
      return `${strip} 0 100% / 64px 96px repeat-x, ${clouds} 0 0 / 240px 140px, linear-gradient(180deg, #6fb8ff, ${mix('#bfe3ff', c.paper, 0.3)})`;
    }
  },
  bigtop: {
    name: 'Circus stripes',
    css: (t, c) => {
      const flags = svgUrl(['#d7263d', '#f4b400', '#3b2a6b', '#1fb5b0'].map((f, i) => `<path d="M${i * 20} 0h20l-10 18z" fill="${f}" stroke="${c.ink}" stroke-width=".8"/>`).join('') + '<path d="M0 0.6h80" stroke="#3a3a3a" stroke-width="1.2"/>', 80, 22);
      const stars = svgUrl(place('star', { ...c, accent: '#f4b400' }, 30, 60, 1.2) + place('star', { ...c, accent: '#fff6e3' }, 120, 20, 0.8), 160, 160);
      return `${flags} 0 0 / 80px 22px repeat-x, ${stars} 0 30px / 160px 160px, repeating-conic-gradient(from -90deg at 50% -20%, ${c.main} 0 5deg, #fff6e3 5deg 10deg)`;
    }
  },
  // The four seasons.
  frost: {
    name: 'Snowy hills',
    css: (t, c) => {
      const fir = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0-30L-9-14h5l-8 12h6L-14 12h28L6-2h6L4-14h5z" fill="#2f6b4f"/><path d="M0-30l-5 9 5-2 5 2zM-7-4l5-1 4 1-2-4zM-9 10l9-2 9 2-3-5z" fill="#fff"/><rect x="-2" y="12" width="4" height="5" fill="#6b4a33"/></g>`;
      const hills = svgUrl(`<path d="M0 46C40 20 80 22 120 38s80 18 120-6v58H0z" fill="#dcecf8"/>${fir(56, 50, 0.9)}${fir(186, 40, 1.1)}${fir(204, 52, 0.7)}<path d="M0 62C50 44 100 48 140 60s70 10 100-2v32H0z" fill="#ffffff"/><path d="M0 62C50 44 100 48 140 60s70 10 100-2" fill="none" stroke="#b9d3ea" stroke-width="2"/>`, 240, 90);
      const flakes = svgUrl(place('snowflake', { ...c, ink: '#9cc2e4' }, 14, 16, 1.1, 10) + place('snowflake', { ...c, ink: '#b8d4ec' }, 92, 64, 0.7, 30) + place('snowflake', { ...c, ink: '#9cc2e4' }, 44, 104, 0.55) + `<g fill="#fff">${[[70, 20, 2], [120, 30, 1.6], [24, 70, 1.8], [110, 112, 2.2], [60, 80, 1.2]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`, 140, 140);
      return `${hills} 0 100% / 240px 90px repeat-x, ${flakes} 0 0 / 140px 140px, linear-gradient(180deg, ${mix(t.main, '#ffffff', 0.45)}, #e8f3fb 75%)`;
    }
  },
  blossoms: {
    name: 'Blossom and tulips',
    css: (t, c) => {
      const tulips = svgUrl(`<path d="M0 30c30-8 60-8 90 0s60 8 90 0v30H0z" fill="#8cc96a"/><path d="M0 40c30-6 60-6 90 0s60 6 90 0v20H0z" fill="#6fae4b"/>` + [[12, 8, 1.4], [44, 14, 1.1], [80, 6, 1.5], [118, 12, 1.2], [150, 8, 1.4]].map(([x, y, k], i) => place('tulip', { ...c, accent: ['#ff6f91', '#ffd23f', '#c86bd9', '#ff8a3d', '#ff6f91'][i] }, x, y, k)).join(''), 180, 60);
      const branch = svgUrl(place('blossom', c, 6, 8, 2.4, -8) + place('blossom', c, 100, 76, 1.6, 20) + place('bee', c, 70, 20, 0.9, 10) + `<g fill="#ffd0dc">${[[50, 60, 2.4], [130, 30, 2], [30, 120, 2.2], [120, 130, 1.6]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.6}" transform="rotate(30 ${x} ${y})"/>`).join('')}</g>`, 150, 150);
      return `${tulips} 0 100% / 180px 60px repeat-x, ${branch} 0 0 / 150px 150px, linear-gradient(180deg, #dff1ff, ${mix(t.main, '#ffffff', 0.86)} 70%)`;
    }
  },
  seaside: {
    name: 'Sun, sea and sand',
    css: (t, c) => {
      const shore = svgUrl(`<path d="M0 10c10-6 20-6 30 0s20 6 30 0 20-6 30 0 20 6 30 0v60H0z" fill="#1aa3c2"/><path d="M0 22c10-6 20-6 30 0s20 6 30 0 20-6 30 0 20 6 30 0v48H0z" fill="#46c1d9"/><path d="M0 22c10-6 20-6 30 0s20 6 30 0 20-6 30 0 20 6 30 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M0 46c30-6 90-6 120 0v24H0z" fill="#f3d59a"/><g fill="#e2b56c">${[[16, 56], [52, 62], [90, 54], [104, 64]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4"/>`).join('')}</g>`, 120, 70);
      const sky = svgUrl(`<g fill="none" stroke="#5a6b7a" stroke-width="1.4" stroke-linecap="round"><path d="M20 30q5-5 10 0q5-5 10 0"/><path d="M110 70q4-4 8 0q4-4 8 0"/></g><g fill="#fff" opacity=".9"><ellipse cx="70" cy="24" rx="16" ry="6"/><ellipse cx="80" cy="20" rx="10" ry="6"/><ellipse cx="30" cy="110" rx="12" ry="4.4"/></g>`, 160, 140);
      return `${shore} 0 100% / 120px 70px repeat-x, ${sky} 0 0 / 160px 140px, radial-gradient(circle 54px at 84% 14%, #fff6b0 0 40%, #ffd23f 41% 62%, rgba(255, 210, 63, .35) 63%, transparent 100%), linear-gradient(180deg, #7fd3f0, ${mix(t.paper, '#bfeaf8', 0.4)} 70%)`;
    }
  },
  harvest: {
    name: 'Falling leaves',
    css: (t, c) => {
      const pile = svgUrl([[0, 20, 1.4, 20, '#e2622b'], [24, 26, 1.2, -30, '#d99a1c'], [46, 18, 1.5, 60, '#b4521f'], [70, 24, 1.3, -10, '#e2622b'], [94, 20, 1.4, 40, '#c9771f'], [118, 26, 1.2, -50, '#d99a1c']].map(([x, y, k, r]) => place('maple', c, x, y, k, r)).join('') + place('pumpkin', c, 136, 14, 1.6) + place('acorn', c, 34, 6, 0.9, 20), 170, 46);
      const leaves = svgUrl(place('maple', c, 10, 12, 1.4, 25) + place('maple', c, 96, 70, 1, -35) + place('acorn', c, 60, 30, 0.9, -15) + place('maple', c, 30, 108, 0.8, 70) + place('acorn', c, 118, 120, 0.7, 30), 150, 150);
      return `${pile} 0 100% / 170px 46px repeat-x, ${leaves} 0 0 / 150px 150px, linear-gradient(180deg, ${mix(t.accent, '#ffffff', 0.55)}, ${mix(t.paper, '#f6d7b0', 0.5)} 75%)`;
    }
  },
  emoji: { name: 'Emoji' },
  picture: { name: 'My own picture' }
};

export function wallpaperCss(t) {
  const c = inks(t);
  const w = WALLPAPERS[t.wallpaper];
  if (!w || t.wallpaper === 'sky') return '';
  if (t.wallpaper === 'picture') {
    const src = t.pictureUrl || (t.picture ? '/media/' + t.picture.split('/').map(encodeURIComponent).join('/') : '');
    return src ? `url("${src}") center / cover no-repeat, ${c.soft}` : '';
  }
  if (w.css) return w.css(t, c);
  if (t.wallpaper === 'emoji') {
    const list = t.emoji?.length ? t.emoji : ['✨'];
    const L = EMOJI_LAYOUTS[t.emojiLayout] || EMOJI_LAYOUTS.scatter;
    const ground = dark(t) ? hslHex(hsl(t.main)[0], 0.35, 0.18) : mix(t.main, '#ffffff', 0.62);
    return `${svgUrl(L.spots.map(([x, y, size, rot], i) => emojiAt(list[i % list.length], x, y, size, rot)).join(''), L.tile, L.tile)} 0 0 / ${L.tile}px ${L.tile}px, ${ground}`;
  }
  const ground = w.ground ? w.ground(t) : w.dark || dark(t) ? hslHex(hsl(t.main)[0], 0.35, 0.18) : mix(t.main, '#ffffff', 0.62);
  return `${svgUrl(w.draw(c, t), w.tile, w.tile)} 0 0 / ${w.tile}px ${w.tile}px, ${ground}`;
}

// ---------- pointers ----------

const ARROW = 'M3 3 L3 24 L8.5 19 L12.5 28 L16 26.5 L12 17.5 L19.5 17.5 Z';
const HAND = (fill, stroke) => `<g stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"><rect x="9" y="1.5" width="5" height="15" rx="2.5" fill="${fill}"/><rect x="13.6" y="10.5" width="4.4" height="10" rx="2.2" fill="${fill}"/><rect x="17.6" y="11.5" width="4.4" height="9" rx="2.2" fill="${fill}"/><rect x="21.6" y="12.8" width="4.2" height="8.5" rx="2.1" fill="${fill}"/><path d="M9 14 L25.8 16 L25.8 23 Q25.8 29 19.5 29.5 L14 29.5 Q10.5 29.5 8.6 26.5 L4.2 19.6 Q3.4 18 4.9 17.3 Q6.3 16.7 7.4 18 L9 20 Z" fill="${fill}"/></g><g fill="${fill}"><rect x="9" y="1.5" width="5" height="15" rx="2.5"/><rect x="13.6" y="10.5" width="4.4" height="10" rx="2.2"/><rect x="17.6" y="11.5" width="4.4" height="9" rx="2.2"/><rect x="21.6" y="12.8" width="4.2" height="8.5" rx="2.1"/><path d="M9 14 L25.8 16 L25.8 23 Q25.8 29 19.5 29.5 L14 29.5 Q10.5 29.5 8.6 26.5 L4.2 19.6 Q3.4 18 4.9 17.3 Q6.3 16.7 7.4 18 L9 20 Z"/></g><path d="M13.8 13.5 V17 M17.8 14 V17.5 M21.8 15 V18" stroke="${stroke}" stroke-width="1" stroke-linecap="round"/>`;

// The arrow, filled with the theme's colour, with its charm riding along at the tail.
export function pointerSvgs(t) {
  const c = inks(t);
  const fill = mix(t.main, '#ffffff', 0.55);
  const arrow = `<path d="${ARROW}" fill="#000" fill-opacity=".28" transform="translate(1.6 1.6)"/><path d="${ARROW}" fill="${fill}" stroke="${c.ink}" stroke-width="1.3" stroke-linejoin="round"/><path d="M5 7.5 5 18" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" stroke-linecap="round"/>${place(t.pointer, c, 16.5, 16.5, 0.92)}`;
  const hand = HAND(fill, c.ink) + place(t.pointer, c, 20, 0.5, 0.7);
  return { arrow: svgUrl(arrow, 32, 32), hand: svgUrl(hand, 32, 32) };
}

// ---------- re-colouring the stylesheets ----------

const REF_HSL = { main: hsl(REF.main), accent: hsl(REF.accent), paper: hsl(REF.paper) };
// Moves a colour of one family (say, a shade of XP blue) to the same place in the theme's family.
function shift([h, s, l], target, ref, { noLift = false } = {}) {
  const [th, ts, tl] = target;
  const [rh, rs, rl] = ref;
  const nh = th + (h - rh) * 0.5;
  const ns = clamp(s * (rs ? ts / rs : 1));
  let lift = clamp((tl - rl) * 1.5, -0.6, 0.7);
  if (noLift) lift = Math.min(0, lift) * 0.4;
  const nl = lift >= 0 ? l + (1 - l) * lift : l * (1 + lift);
  return [nh, ns, clamp(nl)];
}
const COLOUR = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi;
const HAS_COLOUR = /#[0-9a-f]{3,8}\b|rgba?\(/i;
function parseColour(str) {
  if (str[0] === '#') return hexRgb(str);
  const n = str.match(/[\d.]+%?/g);
  if (!n || n.length < 3) return null;
  return [+n[0], +n[1], +n[2], n[3] != null ? (n[3].endsWith('%') ? parseFloat(n[3]) / 100 : +n[3]) : 1];
}
const fmt = ([r, g, b], a) => (a < 1 ? `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${+a.toFixed(3)})` : toHex(r, g, b));

function recolour(rgb, a, T, ctx) {
  const [h, s, l] = rgbHsl(rgb[0], rgb[1], rgb[2]);
  if (s < 0.14 || l < 0.06 || l > 0.985) return null;
  if (h >= 188 && h <= 258) return shift([h, s, l], T.main, REF_HSL.main, ctx);
  if (h >= 78 && h <= 165 && s >= 0.22) return shift([h, s, l], T.accent, REF_HSL.accent, ctx);
  if (h >= 30 && h <= 68 && l >= 0.78 && s <= 0.6) {
    const [ph, ps, pl] = T.paper;
    return [ph, clamp(ps * (s / REF_HSL.paper[1])), clamp(l + (pl - REF_HSL.paper[2]))];
  }
  if (ctx.leather && h >= 8 && h <= 45 && l < 0.5 && s >= 0.2) {
    const [lh, ls, ll] = T.leather;
    return [lh, clamp(ls * (s / 0.46)), clamp(l * (ll / 0.24))];
  }
  return null;
}

const SHEETS = ['base.css', 'xp.css', 'desktop.css', 'mac.css', 'android.css', 'album.css', 'dark.css', 'leather.css'];
const LEATHER_SEL = /leather|spread\.paged|\.dw-leather/;
const SHORTHANDS = ['background', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'outline', 'box-shadow', 'text-shadow'];
const BG_PROPS = /^(background|--)/;

function ruleCss(rule, T, sheetName) {
  const style = rule.style;
  const sel = rule.selectorText;
  const inLeather = sheetName === 'leather.css';
  if (inLeather && !LEATHER_SEL.test(sel)) return '';
  const ctx = { noLift: sheetName === 'dark.css' || /data-theme="dark"/.test(sel), leather: inLeather && T.leather };
  const props = new Map();
  for (let i = 0; i < style.length; i++) {
    const p = style[i];
    const v = style.getPropertyValue(p);
    if (v) props.set(p, v);
  }
  for (const sh of SHORTHANDS) {
    const v = style.getPropertyValue(sh);
    if (v && v.includes('var(')) props.set(sh, v);
  }
  const out = [];
  let bgLum = [];
  let whiteText = false;
  for (const [p, v] of props) {
    if (!HAS_COLOUR.test(v)) continue;
    let changed = false;
    const nv = v.replace(COLOUR, (m) => {
      const c = parseColour(m);
      if (!c) return m;
      const n = recolour(c, c[3], T, ctx);
      if (!n) return m;
      changed = true;
      const rgb = hslRgb(...n);
      if (BG_PROPS.test(p) && c[3] > 0.5) bgLum.push(luminance(toHex(...rgb)));
      return fmt(rgb, c[3]);
    });
    if (p === 'color') {
      const c = parseColour((v.match(COLOUR) || [''])[0] || '');
      if (c && c[0] > 235 && c[1] > 235 && c[2] > 235) whiteText = true;
    }
    if (changed) out.push(`${p}: ${nv}${style.getPropertyPriority(p) ? ' !important' : ''}`);
  }
  // White words on a colour that has gone pale: dark words instead, so they stay readable.
  // (Only in light mode: dark mode puts its own dark colours behind them.)
  let fix = '';
  if (whiteText && !ctx.noLift && bgLum.length && bgLum.reduce((a, b) => a + b, 0) / bgLum.length > 0.42) {
    const scoped = sel.includes('::') ? sel : `:where(:root:not([data-theme="dark"])) :is(${sel})`;
    fix = `${scoped} { color: ${T.inkHex}; text-shadow: none; }`;
  }
  return (out.length ? `${sel} { ${out.join('; ')}; }` : '') + fix;
}

function rulesCss(rules, T, sheetName) {
  let css = '';
  for (const rule of rules) {
    if (rule.type === 1) css += ruleCss(rule, T, sheetName);
    else if (rule.type === 4) {
      const inner = rulesCss(rule.cssRules, T, sheetName);
      if (inner) css += `@media ${rule.media.mediaText} { ${inner} }`;
    } else if (rule.type === 12) {
      const inner = rulesCss(rule.cssRules, T, sheetName);
      if (inner) css += `@supports ${rule.conditionText} { ${inner} }`;
    }
  }
  return css;
}

// One of the classic colours as it looks in a theme (for the back office's little previews).
export function themeColour(hex, t, darkMode = false) {
  const c = hexRgb(hex);
  const T = { main: hsl(t.main), accent: hsl(t.accent), paper: hsl(t.paper), leather: t.leather ? hsl(t.leather) : null };
  const n = recolour(c, 1, T, { noLift: darkMode });
  return n ? toHex(...hslRgb(...n)) : hex;
}
export const TITLE_STOPS = ['#0a5ce0', '#3d8af7', '#0054e3', '#0045c4', '#003399'];

// ---------- stickers ----------

// Where stickers can go: places on the layout where a little something looks right.
export const STICKER_SPOTS = {
  title: 'On the title bars',
  'corner-bl': 'Bottom left corner of the window',
  'corner-br': 'Bottom right corner of the window',
  profile: 'On my profile picture',
  cards: 'On the corner of every post',
  taskbar: 'Next to the clock',
  desktop: 'Anywhere on the computer desktop'
};
export const STICKER_SIZES = { s: 'Small', m: 'Medium', l: 'Large' };
const BIG = new Set(['corner-bl', 'corner-br', 'desktop']);
export function cleanStickers(list) {
  return (Array.isArray(list) ? list : [])
    .slice(0, 16)
    .map((st) => {
      if (!st || typeof st !== 'object') return null;
      const what = CHARMS[st.what] && !['none', 'plain'].includes(st.what) ? st.what : emojiList(st.what, 1)[0];
      if (!what || !STICKER_SPOTS[st.where]) return null;
      const num = (v, a, b, d) => (Number.isFinite(+v) ? Math.max(a, Math.min(b, Math.round(+v))) : d);
      return { what, where: st.where, size: STICKER_SIZES[st.size] ? st.size : 'm', tilt: num(st.tilt, -45, 45, 0), x: num(st.x, 0, 100, 50), y: num(st.y, 0, 100, 50) };
    })
    .filter(Boolean);
}

function stickerEl(st, t, doc) {
  const el = doc.createElement('span');
  el.className = `stk stk-${st.size}`;
  if (st.tilt) el.style.setProperty('--tilt', st.tilt + 'deg');
  if (st.where === 'desktop') {
    el.style.left = st.x + '%';
    el.style.top = st.y + '%';
  }
  if (CHARMS[st.what]) el.style.backgroundImage = charmUrl(st.what, t, 64);
  else el.textContent = st.what;
  return el;
}

// Puts the stickers on the page, and on anything drawn later (a window opening, the feed
// changing page), until the theme changes.
let stickerState = null;
function decorate(doc) {
  const st = stickerState;
  doc.querySelectorAll('.stk-wrap').forEach((w) => w.dataset.sig !== st?.sig && w.remove());
  if (!st || !st.t.stickers.length) return;
  const bySpot = {};
  for (const s of st.t.stickers) (bySpot[s.where] ||= []).push(s);
  const add = (target, spot, place) => {
    if (target.querySelector(`:scope > .stk-wrap[data-spot="${spot}"], :scope > * > .stk-wrap[data-spot="${spot}"]`)) return;
    const wrap = doc.createElement('span');
    wrap.className = `stk-wrap stk-${spot}`;
    wrap.dataset.spot = spot;
    wrap.dataset.sig = st.sig;
    wrap.setAttribute('aria-hidden', 'true');
    for (const s of bySpot[spot]) wrap.append(stickerEl(s, st.t, doc));
    place(wrap);
  };
  const TARGETS = {
    title: ['.xp-title', (el, w) => (el.querySelector(':scope > .xp-title-text') ? el.querySelector(':scope > .xp-title-text').after(w) : el.append(w))],
    'corner-bl': ['.xp-window, .dw-xp', (el, w) => el.append(w)],
    'corner-br': ['.xp-window, .dw-xp', (el, w) => el.append(w)],
    // (On the picture itself, so it stays on it whatever the header has around it.)
    profile: ['.profile-tile', (el, w) => (el.querySelector(':scope > .avatar') || el).append(w)],
    cards: ['.card', (el, w) => el.append(w)],
    taskbar: ['.taskbar', (el, w) => (el.querySelector(':scope > .tray') ? el.querySelector(':scope > .tray').before(w) : el.append(w))],
    desktop: ['.desktop', (el, w) => el.prepend(w)]
  };
  for (const spot of Object.keys(bySpot)) {
    const [sel, place] = TARGETS[spot];
    doc.querySelectorAll(sel).forEach((el) => add(el, spot, (w) => place(el, w)));
  }
}
// ---------- seasonal glass ----------
// An optional extra for the seasons and festive days: a pane of glass over photos and the apps'
// covers, in the season's mood (frost in winter, petals and a soft bloom in spring, a sun flare in
// summer, raindrops and a fallen leaf in autumn, sparkles on festive days). Each place gets a
// version that suits it: the whole pane over a photo or a cover, only the corners on a thought
// (so the words stay clear), and the corners of a page or the map.
export const GLASS_PLACES = {
  photos: { name: 'Photos', kind: 'photo', sel: ['.photo-btn', '.filmstrip .frame', '.polaroid', '.al-print', '.pg-tile', '.ff-photos > *'] },
  thoughts: { name: 'Thoughts', kind: 'card', sel: ['.card-is-thought'] },
  journal: { name: 'Places journal', kind: 'corner', sel: ['[data-app="journal"] .page'] },
  passport: { name: 'Passport', kind: 'corner', sel: ['.passport-page'] },
  atlas: { name: 'Atlas', kind: 'corner', sel: ['.atlas-map-frame'] },
  wishlist: { name: 'Wishlist', kind: 'card', sel: ['.wish'] },
  guestbook: { name: 'Guestbook', kind: 'card', sel: ['.gb-entry'] },
  books: { name: 'Bookshelf', kind: 'item', sel: ['.book-cover'] },
  films: { name: 'Cinema', kind: 'item', sel: ['.ticket'] },
  podcasts: { name: 'Podcasts', kind: 'item', sel: ['.cassette'] },
  music: { name: 'Record crate', kind: 'item', sel: ['.record', '.vinyl-single'] },
  tv: { name: 'TV', kind: 'item', sel: ['.vhs'] }
};
let glassState = null;
function decorateGlass(doc) {
  const st = glassState;
  doc.querySelectorAll('.glass').forEach((g) => g.dataset.sig !== st?.sig && (g.parentElement?.classList.remove('has-glass'), g.remove()));
  if (!st) return;
  for (const place of st.places) {
    const P = GLASS_PLACES[place];
    doc.querySelectorAll(P.sel.join(', ')).forEach((el) => {
      if (el.querySelector(':scope > .glass')) return;
      const g = doc.createElement('span');
      g.className = `glass glass-${P.kind}`;
      g.dataset.sig = st.sig;
      g.setAttribute('aria-hidden', 'true');
      el.classList.add('has-glass');
      el.append(g);
    });
  }
}

function watchForStickers(doc) {
  const win = doc.defaultView;
  if (win.__stickerWatch) return;
  let queued = false;
  win.__stickerWatch = new win.MutationObserver(() => {
    if (queued) return;
    queued = true;
    win.requestAnimationFrame(() => {
      queued = false;
      decorate(doc);
      decorateGlass(doc);
    });
  });
  win.__stickerWatch.observe(doc.body, { childList: true, subtree: true });
}

// ---------- the rest of the theme settings ----------
// Like a Rockbox theme's settings file: each can be set or left to the theme's own (the first
// choice in each list is how the site looks without it).
export const OPTIONS = {
  font: { name: 'Words', choices: { classic: 'Classic', modern: 'Modern', system: 'This device’s own', mono: 'Monospace', rounded: 'Rounded', bubbly: 'Bubbly', pixel: 'Pixel', terminal: 'Terminal', comic: 'Comic', handwritten: 'Handwritten', typewriter: 'Typewriter', elegant: 'Elegant' } },
  title_font: { name: 'Titles', choices: { classic: 'Classic', modern: 'Modern', system: 'This device’s own', mono: 'Monospace', condensed: 'Condensed', rounded: 'Rounded', bubbly: 'Bubbly', pixel: 'Pixel', terminal: 'Terminal', comic: 'Comic', handwritten: 'Handwritten', typewriter: 'Typewriter', elegant: 'Elegant', arcade: 'Arcade', tiny: 'Tiny pixel' } },
  text_size: { name: 'Text size', choices: { m: 'Normal', s: 'Smaller', l: 'Bigger' } },
  selector: { name: 'Highlight', choices: { bar: 'Solid bar', gradient: 'Gradient bar', pointer: 'Pointer', outline: 'Outline', invert: 'Inverted' } },
  bars: { name: 'Title bars', choices: { glossy: 'Glossy', flat: 'Flat', stripes: 'Striped', pixel: 'Pixel steps' } },
  corners: { name: 'Corners', choices: { classic: 'Classic', square: 'Square', round: 'Round' } },
  density: { name: 'Spacing', choices: { cosy: 'Cosy', compact: 'Compact', roomy: 'Roomy' } },
  posts: { name: 'Posts in the feed', choices: { cards: 'Cards', lines: 'A list with lines' } },
  scrollbar: { name: 'Scroll bars', choices: { classic: 'Usual', themed: 'In the theme’s colours', thin: 'Thin', hidden: 'Hidden' } },
  taskbar: { name: 'Taskbar (computers)', choices: { bottom: 'At the bottom', top: 'At the top' } },
  icons: { name: 'Icons', choices: { colour: 'Full colour', soft: 'Soft', mono: 'Black and white' } },
  sounds: { name: 'Sounds', choices: { classic: 'Classic', soft: 'Soft', chip: 'Chiptune', bubbly: 'Bubbly', quiet: 'Off until a visitor turns them on' } },
  header: { name: 'Profile header', choices: { banner: 'Banner', card: 'Card', minimal: 'Minimal', hidden: 'Hidden' } },
  name_style: { name: 'Your name', choices: { plain: 'Plain', rainbow: 'Rainbow', glitter: 'Glitter', glow: 'Glow', wordart: 'WordArt', outline: 'Outline', chrome: 'Chrome' } },
  trail: { name: 'Pointer trail (computers)', choices: TRAILS },
  falling: { name: 'Falling over the page', choices: FALLING },
  seasons: { name: 'Seasons & festive days', choices: { off: 'Off', auto: 'Automatic, by the date', winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn', lunar_new_year: 'Lunar New Year', hanami: 'Cherry blossom', childrens_day: 'Children’s Day', dragon_boat: 'Dragon Boat Festival', tanabata: 'Tanabata', mid_autumn: 'Mid-Autumn Festival', nowruz: 'Nowruz', holi: 'Holi', ramadan: 'Ramadan', eid_al_fitr: 'Eid al-Fitr', eid_al_adha: 'Eid al-Adha', diwali: 'Diwali', yalda: 'Yalda Night', dia_de_reyes: 'Día de Reyes', carnival: 'Carnival', dia_de_muertos: 'Día de Muertos', st_patricks: 'St Patrick’s Day', easter: 'Easter', midsummer: 'Midsummer', bonfire_night: 'Bonfire Night', halloween: 'Halloween', hanukkah: 'Hanukkah', christmas: 'Christmas', ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`my_${i + 1}`, `My day ${i + 1}`])) } },
  hemisphere: { name: 'Where the seasons are', choices: { north: 'North of the equator', south: 'South of the equator' } },
  glass_style: { name: 'Glass', choices: { season: 'With the season or festive day', winter: 'Frost', spring: 'Petals and bloom', summer: 'Sun flare', autumn: 'Raindrops and a leaf', festive: 'Sparkles', gloss: 'Plain glass' } },
  glass_strength: { name: 'How strong', choices: { medium: 'Medium', soft: 'Soft', strong: 'Strong' } },
  // How each post's card is dressed (a post can have its own: `card:` in its file), a ribbon of the
// day for posts written on a festive day, and a mark in the corner.
  card_style: { name: 'Post cards', choices: { classic: 'Classic', polaroid: 'Polaroid', scrapbook: 'Scrapbook', notebook: 'Notebook', postcard: 'Postcard', sticky: 'Sticky note', ticket: 'Ticket', torn: 'Torn page', comic: 'Comic panel', neon: 'Neon', letter: 'Letter', film: 'Film frame', pixel: '8-bit', chrome: 'Chrome glass' } },
  card_festive: { name: 'Festive ribbons', choices: { on: 'On posts written on a festive day or one of your own days', off: 'Off' } },
  card_corner: { name: 'A mark in the corner', choices: { none: 'None', season: 'The season it was written in', charm: 'The theme’s charm' } },
  // What's behind the posts in the main windows (rather than plain white).
  page: { name: 'Behind the posts', choices: { layered: 'Layered: the theme’s colours, its pattern and the season', pattern: 'The theme’s pattern, faintly', wallpaper: 'The whole wallpaper', tint: 'Just the theme’s colours', plain: 'Plain white' } },
  page_strength: { name: 'How much it shows', choices: { medium: 'Medium', soft: 'Softly', strong: 'Strongly' } },
  // Like the sky: morning light, the day as it is, a golden evening and night with stars (always
  // night in dark mode). For every wallpaper, your own picture and emoji too.
  wall_time: { name: 'The wallpaper through the day', choices: { day: 'Follows the time of day', still: 'Stays the same all day' } }
};

// ---------- the seasons, and festive days ----------
// Picked by the owner (or left to the date, on Automatic). Gently, whatever the theme: snow and a
// snowman in winter, petals in spring, sunshine in summer, leaves in autumn (unless you've picked
// something to fall yourself), one little drawing in the window's corner (a different one each
// day), and a dusting of snow on the title bars in winter.
export const SEASONS = {
  winter: { name: 'Winter', falling: 'snow', charms: ['snowman', 'snowflake', 'mitten'] },
  spring: { name: 'Spring', falling: 'petals', charms: ['tulip', 'chick', 'bee'] },
  summer: { name: 'Summer', falling: 'sunshine', charms: ['sun', 'icelolly', 'watermelon'] },
  autumn: { name: 'Autumn', falling: 'leaves', charms: ['maple', 'acorn', 'pumpkin'] }
};
export function seasonOf(date = new Date(), south = false) {
  const k = (date.getMonth() + (south ? 6 : 0)) % 12;
  return k === 11 || k < 2 ? 'winter' : k < 5 ? 'spring' : k < 8 ? 'summer' : 'autumn';
}

// Festive days from around the world: picked by the owner, or on Automatic, the ones they've ticked
// come round on their days. Only the kind
// of decorations people put up themselves: no places of worship, scripture, flags or emblems.
// Quiet months stay quiet (Ramadan has a lantern, nothing falling).
// Dates on lunar calendars come from published tables (add the next years' dates as they come),
// or from the browser's own Islamic and Hebrew calendars.
const md = (s) => s.split(' ').map((x) => x.split('-').map(Number));
const TABLES = {
  // [month, day] for 2026 onwards, one per year.
  lunar_new_year: md('2-17 2-6 1-26 2-13 2-3 1-23 2-11 1-31 2-19 2-8'),
  mid_autumn: md('9-25 9-15 10-3 9-22 9-12 10-1 9-19 9-8 9-27 9-16'),
  diwali: md('11-8 10-29 10-17 11-5 10-26 11-14 11-2 10-22 11-10 10-30'),
  holi: md('3-3 3-22 3-11 3-1 3-20 3-9 3-27 3-16 3-5 3-24')
};
const FIRST_YEAR = 2026;
function nearTable(id, date, before, after) {
  const row = TABLES[id][date.getFullYear() - FIRST_YEAR];
  if (!row) return false;
  const day = new Date(date.getFullYear(), row[0] - 1, row[1]);
  const diff = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - day) / 86400000);
  return diff >= -before && diff <= after;
}
function calendar(date, cal) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-' + cal, { month: cal === 'hebrew' ? 'long' : 'numeric', day: 'numeric', timeZone: 'UTC' }).formatToParts(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12)));
    const get = (t) => parts.find((p) => p.type === t)?.value || '';
    return { month: get('month'), day: Number(get('day')) };
  } catch {
    return null;
  }
}
// Easter Sunday (the Gregorian reckoning), for Easter and Carnival.
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(y, month - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
const daysFrom = (date, day) => Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - day) / 86400000);
const nearEaster = (date, from, to) => {
  const n = daysFrom(date, easter(date.getFullYear()));
  return n >= from && n <= to;
};
// A day on the Chinese calendar, give or take a day (calendars disagree by a day now and then).
const chinese = (date, month, day) =>
  [-1, 0, 1].some((k) => {
    const c = calendar(new Date(date.getFullYear(), date.getMonth(), date.getDate() + k), 'chinese');
    return !!c && c.month === String(month) && c.day === day;
  });
const between = (date, from, to) => {
  const n = (date.getMonth() + 1) * 100 + date.getDate();
  return from <= to ? n >= from && n <= to : n >= from || n <= to;
};
const islamic = (date, month, from, to) => {
  const c = calendar(date, 'islamic-umalqura');
  return !!c && Number(c.month) === month && c.day >= from && c.day <= to;
};
export const FESTIVALS = {
  // East Asia
  lunar_new_year: { name: 'Lunar New Year', also: 'Chinese New Year, Seollal, Tết', falling: 'petals', charms: ['lantern', 'blossom'], on: (d) => nearTable('lunar_new_year', d, 1, 6) },
  hanami: { name: 'Cherry blossom', also: 'Hanami', falling: 'petals', charms: ['blossom'], on: (d) => between(d, 325, 410) },
  childrens_day: { name: 'Children’s Day', also: 'Kodomo no Hi', falling: '', charms: ['koinobori'], on: (d) => between(d, 503, 505) },
  dragon_boat: { name: 'Dragon Boat Festival', also: 'Duanwu', falling: '', charms: ['dragonboat', 'zongzi'], on: (d) => chinese(d, 5, 5) },
  tanabata: { name: 'Tanabata', also: 'Qixi, the star festival', falling: 'stars', charms: ['tanzaku'], on: (d) => between(d, 706, 707) },
  mid_autumn: { name: 'Mid-Autumn Festival', also: 'Chuseok', falling: '', charms: ['mooncake', 'lantern'], on: (d) => nearTable('mid_autumn', d, 1, 1) },
  // South and Central Asia, and the Middle East
  nowruz: { name: 'Nowruz', falling: 'petals', charms: ['sabzeh', 'goldfish', 'tulip'], on: (d) => between(d, 319, 402) },
  holi: { name: 'Holi', falling: 'confetti', charms: ['splash'], on: (d) => nearTable('holi', d, 1, 1) },
  ramadan: { name: 'Ramadan', falling: '', quiet: true, charms: ['fanous', 'moon'], on: (d) => islamic(d, 9, 1, 30) },
  eid_al_fitr: { name: 'Eid al-Fitr', falling: 'stars', charms: ['moon', 'fanous'], on: (d) => islamic(d, 10, 1, 3) },
  eid_al_adha: { name: 'Eid al-Adha', falling: 'stars', charms: ['moon', 'fanous'], on: (d) => islamic(d, 12, 10, 13) },
  diwali: { name: 'Diwali', falling: 'sunshine', charms: ['diya'], on: (d) => nearTable('diwali', d, 2, 2) },
  yalda: { name: 'Yalda Night', falling: '', charms: ['pomegranate', 'watermelon'], on: (d) => between(d, 1220, 1222) },
  // Latin America
  dia_de_reyes: { name: 'Día de Reyes', also: 'Three Kings’ Day', falling: '', charms: ['crown'], on: (d) => between(d, 105, 106) },
  carnival: { name: 'Carnival', also: 'Carnaval', falling: 'confetti', charms: ['mask', 'papel'], on: (d) => nearEaster(d, -50, -47) },
  dia_de_muertos: { name: 'Día de Muertos', falling: 'petals', charms: ['marigold', 'papel'], on: (d) => between(d, 1101, 1102) },
  // Europe
  st_patricks: { name: 'St Patrick’s Day', falling: '', charms: ['shamrock'], on: (d) => between(d, 317, 317) },
  easter: { name: 'Easter', falling: 'petals', charms: ['egg', 'chick'], on: (d) => nearEaster(d, -2, 1) },
  midsummer: { name: 'Midsummer', also: 'Juhannus, Midsommar, Kupala', falling: 'petals', charms: ['flowercrown'], on: (d) => between(d, 619, 624) },
  bonfire_night: { name: 'Bonfire Night', falling: '', charms: ['firework'], on: (d) => between(d, 1105, 1105) },
  halloween: { name: 'Halloween', falling: 'leaves', charms: ['jack', 'ghost'], on: (d) => between(d, 1024, 1031) },
  hanukkah: { name: 'Hanukkah', falling: '', charms: ['dreidel'], on: (d) => {
    const c = calendar(d, 'hebrew');
    return !!c && ((/^Kislev/.test(c.month) && c.day >= 25) || (/^Tevet/.test(c.month) && c.day <= 2));
  } },
  christmas: { name: 'Christmas', falling: 'snow', charms: ['santa', 'fir', 'present'], on: (d) => between(d, 1201, 1226) }
};
// Each festive day's colours, for its garlands and the ground (your own days use the theme's).
export const FESTIVE_COLOURS = {
  lunar_new_year: ['#d6283f', '#f6c431', '#b81f2a'], hanami: ['#ffc7d6', '#ffffff', '#e2506f'], childrens_day: ['#4facfe', '#d6283f', '#f6c431'], dragon_boat: ['#3f8f4e', '#d6283f', '#f6c431'], tanabata: ['#7b3fe4', '#4facfe', '#f6c431'], mid_autumn: ['#d99a4e', '#e23b3b', '#f6c431'],
  nowruz: ['#5aa043', '#ff7aa2', '#f6c431'], holi: ['#ff4fa3', '#4facfe', '#ffd23f', '#7ee081'], ramadan: ['#2c4f9e', '#f6c431', '#ffe08a'], eid_al_fitr: ['#3f8f4e', '#f6c431', '#ffffff'], eid_al_adha: ['#3f8f4e', '#f6c431', '#ffffff'], diwali: ['#f6c431', '#d9622b', '#c62f8f'], yalda: ['#a8243a', '#c62f45', '#f2b134'],
  dia_de_reyes: ['#f6c431', '#7b3fe4', '#d6283f'], carnival: ['#ff4fa3', '#4facfe', '#ffd23f', '#7ee081'], dia_de_muertos: ['#f28c28', '#ff4fa3', '#7b3fe4'],
  st_patricks: ['#3f9b4e', '#7ee081', '#f6c431'], easter: ['#ffd84d', '#b3e0ff', '#ffc7d6', '#c7f0b3'], midsummer: ['#f6c431', '#7ee081', '#4facfe'], bonfire_night: ['#f28c28', '#f6c431', '#2b2b4a'], halloween: ['#f28c28', '#4a3570', '#2b2b2b'], hanukkah: ['#3b6fd6', '#ffffff', '#c9d6ee'], christmas: ['#d6283f', '#3f8f4e', '#f6c431']
};
// A festive day's scenery, drawn from its drawings: { bar, icon, garland, ground } as CSS urls.
function drawing(what, c, x, y, size) {
  if (CHARMS[what]) return place(what, c, x, y, size / 16);
  return `<text x="${x + size / 2}" y="${y + size * 0.86}" font-size="${size * 0.92}" text-anchor="middle" font-family="${EMOJI_FONT}">${what}</text>`;
}
// One drawing (or emoji) as a picture, for the cards' ribbons and corners.
export const drawingUrl = (what, t, size = 20) => svgUrl(drawing(what, inks(t), 0, 0, size), size, size);
export function festiveScenery(look, id, t) {
  const c = inks(t);
  const ch = look.charms.length ? look.charms : ['twinkle'];
  const pick = (i) => ch[i % ch.length];
  const cols = FESTIVE_COLOURS[id] || [t.accent, t.main, '#f6c431'];
  const col = (i) => cols[i % cols.length];
  const bar = svgUrl(`${drawing(pick(0), c, 6, 1, 11)}${drawing(pick(1), c, 48, 2, 10)}`, 84, 13);
  const icon = svgUrl(drawing(pick(0), c, 0, 0, 20), 20, 20);
  const garland = svgUrl(`<path d="M0 1.5Q36 6 72 1.5" fill="none" stroke="${c.ink}" stroke-width=".7" opacity=".7"/><path d="M5 2.2l4 8 4-7.6z" fill="${col(0)}"/><path d="M23 3.4l4 8 4-7.8z" fill="${col(1)}"/>${drawing(pick(2), c, 39, 3, 11)}<path d="M57 2.6l4 7.8 4-8.2z" fill="${col(2)}"/>`, 72, 15);
  const ground = svgUrl(`<path d="M0 34V26C30 22 60 24 90 25s60-4 90-1v10z" fill="${mix(col(0), '#ffffff', 0.55)}"/>${drawing(pick(0), c, 18, 6, 22)}${drawing(pick(1), c, 100, 9, 19)}${drawing(pick(2), c, 150, 12, 15)}`, 180, 34);
  return { bar, icon, garland, ground };
}

// ---------- behind the posts ----------
// The main windows are layered rather than plain white: on the bottom, a gradient in the theme's
// colours; then its pattern (or your emoji, or your own picture); then a soft wash so posts stay
// easy to read; and on top, on Layered, the season's or festive day's drawings scattered faintly.
// Everything follows the theme, your colours and wallpaper, and the day. (The wash is a colour
// in skins.css, so dark mode has a dark one.)
const WASH = { layered: { soft: 0.86, medium: 0.72, strong: 0.52 }, pattern: { soft: 0.86, medium: 0.72, strong: 0.52 }, wallpaper: { soft: 0.55, medium: 0.3, strong: 0 }, tint: { soft: 0.5, medium: 0.3, strong: 0.1 } };
export function pageLayers(t, look) {
  if (!WASH[t.page]) return null;
  const c = inks(t);
  const tint = `linear-gradient(160deg, ${mix(t.paper, '#ffffff', 0.5)}, ${mix(t.paper, t.main, 0.16)} 55%, ${mix(t.paper, t.accent, 0.2)})`;
  const quiet = t.wallpaper === 'sky' || !WALLPAPERS[t.wallpaper];
  const pattern = quiet ? `radial-gradient(${mix(t.paper, t.main, 0.45)} 1.3px, transparent 1.8px) 0 0 / 20px 20px, ${tint}` : wallpaperCss(t);
  let season = '';
  if (t.page === 'layered' && look?.charms?.length) {
    const ch = look.charms;
    const spots = [[14, 18, 24, -12], [104, 10, 18, 14], [150, 70, 26, 8], [60, 84, 20, -6], [18, 140, 18, 10], [112, 140, 22, -14]];
    season = `${svgUrl(`<g opacity=".5">${spots.map(([x, y, size, rot], i) => `<g transform="rotate(${rot} ${x + size / 2} ${y + size / 2})">${drawing(ch[i % ch.length], c, x, y, size)}</g>`).join('')}</g>`, 180, 180)} 0 0 / 180px 180px, `;
  }
  const wash = WASH[t.page][t.page_strength] ?? WASH[t.page].medium;
  const base = t.page === 'tint' ? tint : pattern;
  return { bg: `${season}linear-gradient(var(--page-wash), var(--page-wash)), ${base}`, wash, washColour: mix(t.paper, '#ffffff', 0.55) };
}

// When two fall together, the shorter, rarer one shows (a few days of Eid over a month of Ramadan).
const FESTIVAL_ORDER = ['eid_al_fitr', 'eid_al_adha', 'st_patricks', 'bonfire_night', 'holi', 'tanabata', 'childrens_day', 'dia_de_reyes', 'yalda', 'dragon_boat', 'diwali', 'mid_autumn', 'dia_de_muertos', 'carnival', 'easter', 'hanukkah', 'midsummer', 'lunar_new_year', 'nowruz', 'halloween', 'hanami', 'ramadan', 'christmas'];
// Your own days come first: you made them. A festive day whose date you've changed (Eid seen a
// day later where you are, say) follows your dates that year, and its usual ones other years.
export function festivalOn(date = new Date(), ticked = [], mine = [], dates = {}) {
  const own = mine.findIndex((m) => between(date, mdNum(m.from), mdNum(m.to)));
  if (own >= 0) return 'my_' + (own + 1);
  return FESTIVAL_ORDER.find((id) => ticked.includes(id) && festivalToday(id, date, dates)) || '';
}
function festivalToday(id, date, dates = {}) {
  const o = dates[id];
  const y = date.getFullYear();
  if (o && y >= +o.from.slice(0, 4) && y <= +o.to.slice(0, 4)) {
    const day = (v) => new Date(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10));
    const n = new Date(y, date.getMonth(), date.getDate());
    return n >= day(o.from) && n <= day(o.to);
  }
  return FESTIVALS[id].on(date);
}
// The next time a festive day comes round (from today), as [first day, last day].
export function nextFestival(id, dates = {}, from = new Date()) {
  let start = null;
  for (let i = 0; i < 400; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const on = festivalToday(id, d, dates);
    if (on && !start) start = d;
    if (!on && start) return [start, new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)];
  }
  return start ? [start, start] : null;
}
// Dates you've set for festive days: { id: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } }, up to six weeks.
const okDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
export function cleanFestivalDates(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [id, o] of Object.entries(v)) {
    if (!FESTIVALS[id] || !o || !okDate(o.from)) continue;
    const to = okDate(o.to) && o.to >= o.from ? o.to : o.from;
    if ((Date.parse(to) - Date.parse(o.from)) / 86400000 > 42) continue;
    out[id] = { from: o.from, to };
  }
  return out;
}

// Days of your own: a name, from one date to another (every year), a drawing or emoji, and
// something falling if you like.
const mdNum = (v) => {
  const [m, d] = String(v).split('-').map(Number);
  return m * 100 + d;
};
const okMd = (v) => {
  const m = /^(\d{2})-(\d{2})$/.exec(String(v || ''));
  return !!m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= new Date(2024, +m[1], 0).getDate();
};
export const MAX_MY_DAYS = 12;
export function cleanMyDays(list) {
  return (Array.isArray(list) ? list : [])
    .slice(0, MAX_MY_DAYS)
    .map((x) => {
      if (!x || typeof x !== 'object' || !okMd(x.from)) return null;
      const name = String(x.name || '').replace(/[<>]/g, '').trim().slice(0, 40) || 'My day';
      const what = CHARMS[x.what] && !['none', 'plain'].includes(x.what) ? x.what : emojiList(x.what, 1)[0] || 'twinkle';
      return { name, from: x.from, to: okMd(x.to) ? x.to : x.from, what, falling: FALLING[x.falling] && x.falling !== 'none' ? x.falling : '' };
    })
    .filter(Boolean);
}
// Where a season can settle (each can be switched off, season by season).
export const SCENERY_PLACES = { bars: 'Title bars', icons: 'Desktop icons', taskbar: 'Along the taskbar', ground: 'The foot of the desktop', posts: 'Posts', menu: 'Under the phone’s menu', profile: 'Your profile header' };
// Your own touches for any season or festive day: { id: { charms, falling, where, settle } }:
// its drawings, what falls, where the drawings go (sticker places), and where a season settles.
export const MAX_LOOK_CHARMS = 8;
export function cleanLooks(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [id, o] of Object.entries(v)) {
    if (!(SEASONS[id] || FESTIVALS[id]) || !o || typeof o !== 'object') continue;
    const charms = (Array.isArray(o.charms) ? o.charms : [])
      .map((x) => (CHARMS[x] && !['none', 'plain'].includes(x) ? x : emojiList(x, 1)[0]))
      .filter(Boolean)
      .slice(0, MAX_LOOK_CHARMS);
    const one = {};
    if (charms.length) one.charms = [...new Set(charms)];
    if (FALLING[o.falling]) one.falling = o.falling;
    const where = (Array.isArray(o.where) ? o.where : []).filter((x) => STICKER_SPOTS[x]);
    if (where.length) one.where = [...new Set(where)];
    if (Array.isArray(o.settle)) one.settle = [...new Set(o.settle.filter((x) => SCENERY_PLACES[x]))];
    if (Object.keys(one).length) out[id] = one;
  }
  return out;
}
// What a season, festive day or day of your own looks like (with your own drawings, if any).
export function lookOf(id, t) {
  if (SEASONS[id] || FESTIVALS[id]) {
    const base = SEASONS[id] || FESTIVALS[id];
    const own = t?.looks?.[id];
    return own ? { ...base, ...(own.charms ? { charms: own.charms } : {}), ...(own.falling ? { falling: own.falling === 'none' ? '' : own.falling, noFall: own.falling === 'none' } : {}), ...(own.where ? { where: own.where } : {}), ...(own.settle ? { settle: own.settle } : {}) } : base;
  }
  const mine = /^my_(\d+)$/.exec(id || '') && t.my_days?.[+id.slice(3) - 1];
  return mine ? { name: mine.name, falling: mine.falling, charms: [mine.what], own: true } : null;
}
const dayNumber = (date) => Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
// Parts that can be left out: of the profile header, and of the taskbar's tray.
export const HIDEABLE = { lastpost: 'Last post date', status: 'Status', playing: 'Now playing', countdown: 'Countdown', nudge: 'Nudge button', clock: 'Clock (taskbar)', traystatus: 'Status (taskbar, computers)' };
// The sections, for the main menu's order and for hiding ones you don't use.
export const SECTIONS = { home: 'Home', thoughts: 'Thoughts', journal: 'Places', atlas: 'Map', friends: 'Friends', album: 'Photos', more: 'Dumps & lists', passport: 'Passport', wishlist: 'Wishlist', guestbook: 'Guestbook', books: 'Books', films: 'Films', podcasts: 'Podcasts', music: 'Music', tv: 'TV', stats: 'Travel stats', about: 'About' };
export const DEFAULT_MENU = ['home', 'thoughts', 'journal', 'atlas', 'friends'];
export const FONT_FAMILIES = {
  classic: '',
  modern: "'Source Sans 3', 'Segoe UI', sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'Share Tech Mono', ui-monospace, monospace",
  condensed: "'Oswald', 'Arial Narrow', sans-serif",
  rounded: "'Nunito', 'Arial Rounded MT Bold', sans-serif",
  bubbly: "'Fredoka', 'Nunito', sans-serif",
  pixel: "'Pixelify Sans', monospace",
  terminal: "'VT323', 'Share Tech Mono', monospace",
  comic: "'Comic Neue', 'Comic Sans MS', sans-serif",
  handwritten: "'Gaegu', 'Caveat', cursive",
  typewriter: "'Special Elite', 'Courier New', monospace",
  elegant: "'Libre Baskerville', Georgia, serif",
  arcade: "'Press Start 2P', monospace",
  tiny: "'Silkscreen', monospace"
};

function resolveOptions(settings, base) {
  const out = {};
  for (const [k, spec] of Object.entries(OPTIONS)) {
    const v = settings[k] ?? base[k];
    out[k] = spec.choices[v] ? v : Object.keys(spec.choices)[0];
  }
  const list = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\s,]+/) : []);
  out.hide = [...new Set(list(settings.hide ?? base.hide).filter((x) => HIDEABLE[x]))];
  const menu = [...new Set(list(settings.menu ?? base.menu).filter((x) => SECTIONS[x]))].slice(0, 5);
  out.menu = menu.length ? menu : DEFAULT_MENU;
  out.sections_hidden = [...new Set(list(settings.sections_hidden ?? base.sections_hidden).filter((x) => SECTIONS[x] && x !== 'home' && !out.menu.includes(x)))];
  return out;
}

// ---------- a post's own font ----------
// A post can be written in any of the fonts (`font:` in its file); skins.css has a rule for each.
export const postFontAttrs = (post) => (post?.font && OPTIONS.font.choices[post.font] ? { 'data-font': post.font } : {});

// ---------- your own words on the buttons ----------
// Every section's name (in the menus, on the desktop icons and in the Explore menu) and the
// site's buttons can be renamed. Left empty, each keeps its usual words.
export const LABELS = {
  home: 'Home', thoughts: 'Thoughts', journal: 'Places', atlas: 'Map', friends: 'Friends', album: 'Photos', more: 'Dumps & lists', passport: 'Passport', wishlist: 'Wishlist', guestbook: 'Guestbook', books: 'Books', films: 'Films', podcasts: 'Podcasts', music: 'Music', tv: 'TV', stats: 'Travel stats', about: 'About',
  explore: 'Explore', others: 'Others', search: 'Search', leave: 'Leave', nudge: 'Nudge', open_journal: 'Open in journal', read_review: 'Read the review', visitor: 'Visitor', come_in: 'Tap to come in'
};
export const LABEL_GROUPS = [
  ['Sections', ['home', 'thoughts', 'journal', 'atlas', 'friends', 'album', 'more', 'passport', 'wishlist', 'guestbook', 'books', 'films', 'podcasts', 'music', 'tv', 'stats', 'about']],
  ['Buttons', ['explore', 'others', 'search', 'leave', 'nudge', 'open_journal', 'read_review', 'visitor', 'come_in']]
];
export function cleanLabels(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, text] of Object.entries(v)) {
    const clean = String(text ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
    if (LABELS[k] && clean && clean !== LABELS[k]) out[k] = clean;
  }
  return out;
}
// A word on the site: the owner's own, or the usual one (which can differ from place to place:
// "Places" in the menu bar, "Places Journal" on the desktop).
export const word = (key, usual) => active?.labels?.[key] || usual;

// ---------- each app's own look ----------
// Every app keeps one consistent set of choices: follow the theme (as it always has), go back to
// its era's original colours, take the theme's colour, or wear a colour of its own; plus a few
// settings only that app has (the journal's paper and handwriting, the atlas's map, the Mac and
// Android apps' fonts).
export const APPS = {
  journal: { name: 'Places journal', era: 'leather', extras: ['paper', 'hand', 'map', 'font'] },
  passport: { name: 'Passport', era: 'leather', extras: ['paper', 'hand', 'font'] },
  atlas: { name: 'Atlas', era: 'mac', extras: ['map', 'font'] },
  wishlist: { name: 'Wishlist', era: 'mac', extras: ['font'] },
  guestbook: { name: 'Guestbook', era: 'android', extras: ['font'] },
  books: { name: 'Bookshelf', era: 'shelf', extras: ['font'] },
  films: { name: 'Cinema', era: 'cinema', extras: ['font'] },
  podcasts: { name: 'Podcasts', era: 'tape', extras: ['font'] },
  music: { name: 'Record crate', era: 'record', extras: ['font'] },
  tv: { name: 'TV', era: 'crt', extras: ['font'] },
  album: { name: 'Photo album', era: 'album', extras: ['font'] }
};
// ---------- the apps' top bars, dressed ----------
// Bunting hangs under each app's top bar and a few drawings sit on its corner like stickers.
// Each app chooses what its bar wears (Themes › Seasons & festive days): the season's or festive
// day's drawings (while one is on), different ones every day, drawings of your own, or nothing.
export const BAR_APPS = { windows: 'The windows (Home, Thoughts and the rest)', ...Object.fromEntries(Object.entries(APPS).map(([id, a]) => [id, a.name])) };
export const BAR_DECOR = { day: 'The day’s drawings', random: 'Different ones every day', mine: 'My own', none: 'Nothing' };
export const MAX_BAR_STICKERS = 3;
// Only known apps and choices, and drawings (by name) or emoji of your own.
export function cleanBarDecor(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [app, o] of Object.entries(v)) {
    if (!BAR_APPS[app] || !o || typeof o !== 'object' || !BAR_DECOR[o.mode] || o.mode === 'day') continue;
    const one = { mode: o.mode };
    if (o.mode === 'mine') {
      const charms = [...new Set((Array.isArray(o.charms) ? o.charms : []).map((x) => (CHARMS[x] && !['none', 'plain'].includes(x) ? x : emojiList(x, 1)[0])).filter(Boolean))].slice(0, MAX_BAR_STICKERS);
      if (!charms.length) continue;
      one.charms = charms;
    }
    out[app] = one;
  }
  return out;
}
// The colours of a season's bunting (a festive day has its own, in FESTIVE_COLOURS).
export const SEASON_COLOURS = { winter: ['#9cc2e4', '#ffffff', '#d94a5c'], spring: ['#ffb3c7', '#bfe6a0', '#ffe08a'], summer: ['#ffd23f', '#46c1d9', '#ff8a3d'], autumn: ['#e2622b', '#d99a1c', '#8a5a33'] };
// A length of bunting, three flags to a 48px repeat.
export function buntingUrl([a, b, c]) {
  const flag = (x, fill) => `<path d="M${x} 3.2l7 0.6-3.2 9.4z" fill="${fill}" stroke="rgba(0,0,0,.28)" stroke-width=".6" stroke-linejoin="round"/>`;
  return svgUrl(`<path d="M0 3c8 1.4 16 1.4 24 0s16-1.4 24 0" fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".8"/>${flag(3, a)}${flag(19, b || a)}${flag(35, c || b || a)}`, 48, 16);
}
// A few drawings in a row, each with a white sticker edge and a little shadow.
export function stickerStrip(list, t, size = 24) {
  const c = inks(t);
  const step = size + 4;
  const w = list.length * step + 4;
  const edge = '<filter id="st" x="-20%" y="-20%" width="140%" height="150%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.4" result="d"/><feFlood flood-color="#fff"/><feComposite in2="d" operator="in" result="w"/><feGaussianBlur in="d" stdDeviation="1"/><feOffset dy="1.2" result="b"/><feFlood flood-color="#000" flood-opacity=".28"/><feComposite in2="b" operator="in" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  const inner = list.map((what, i) => `<g transform="rotate(${[-9, 7, -4][i % 3]} ${2 + i * step + size / 2} ${3 + size / 2})">${drawing(what, c, 2 + i * step, 3, size)}</g>`).join('');
  return { url: svgUrl(`<defs>${edge}</defs><g filter="url(#st)">${inner}</g>`, w, size + 8), width: w, height: size + 8 };
}
// Every drawing that makes a good sticker (for "different ones every day").
const STICKER_POOL = () => Object.keys(CHARM_NAMES).filter((x) => !['none', 'plain', 'ears', 'dot', 'ring', 'diamond', 'plus', 'asterisk', 'chevron', 'pal'].includes(x));
// The bars' stylesheet: for each app, whether its bar is dressed, its stickers and its bunting.
function barDecorCss(t, dayId, look, settled, now) {
  const day = dayNumber(now);
  const on = !!(look && settled);
  const flags = on && !look.quiet ? buntingUrl(FESTIVE_COLOURS[dayId] || SEASON_COLOURS[dayId] || [t.accent, t.main, '#f6c431']) : 'none';
  const pool = STICKER_POOL();
  return Object.keys(BAR_APPS)
    .map((app, n) => {
      const mine = t.bar_decor?.[app] || { mode: 'day' };
      let list = [];
      if (mine.mode === 'day' && on) {
        const ch = look.charms?.length ? look.charms : ['twinkle'];
        list = (look.quiet ? [0] : [0, 1, 2]).map((i) => ch[(day + i + n) % ch.length]);
        list = [...new Set(list)];
      } else if (mine.mode === 'random') {
        let k = (day * 7919 + n * 104729) >>> 0;
        while (list.length < 3) {
          k = (k * 1103515245 + 12345) % 2147483648;
          const what = pool[k % pool.length];
          if (!list.includes(what)) list.push(what);
        }
      } else if (mine.mode === 'mine') list = mine.charms || [];
      const sel = app === 'windows' ? ':root' : `[data-app="${app}"]`;
      if (!list.length) return `${sel} { --bd-show: none; }`;
      const strip = stickerStrip(list, t);
      return `${sel} { --bd-show: block; --bd-stickers: ${strip.url}; --bd-w: ${strip.width}px; --bd-flags: ${mine.mode === 'none' ? 'none' : flags}; }`;
    })
    .join('\n');
}

export const APP_LOOKS = { auto: 'As the theme has it', original: 'Its original look', tint: 'In the theme’s colour', custom: 'A colour of its own' };
export const APP_EXTRAS = {
  paper: { name: 'Paper', choices: { aged: 'Aged', cream: 'Cream', white: 'Crisp white', kraft: 'Brown kraft', grid: 'Graph paper', dotted: 'Dotted' } },
  hand: { name: 'Handwriting', choices: { caveat: 'Classic pen', gaegu: 'Doodly', comic: 'Comic', typewriter: 'Typewriter', pixel: 'Pixel', elegant: 'Elegant' } },
  map: { name: 'Map', choices: { classic: 'As it comes', soft: 'Soft', mono: 'Black and white', sepia: 'Old paper', night: 'Night' } },
  // Its own era's lettering, the theme's font, or any of the fonts.
  font: { name: 'Font', choices: { own: 'Its own', theme: 'The theme’s', ...OPTIONS.font.choices } }
};
const ERA_SHEETS = { mac: ['mac.css'], android: ['android.css'], album: ['album.css'], shelf: ['shelves.css'], cinema: ['shelves.css'], tape: ['shelves.css'], record: ['shelves.css'], crt: ['shelves.css'] };
// Rules for an era's windows that live in desktop.css.
const ERA_DESKTOP = { mac: /mac|menubar/, android: /droid|android/, album: /al-bar|album/, shelf: /shelf/, cinema: /marquee|cinema/, tape: /deck|tape/, record: /hifi|record/, crt: /tv-|crt/ };
const HAND_FONTS = { gaegu: "'Gaegu', cursive", comic: "'Comic Neue', 'Comic Sans MS', sans-serif", typewriter: "'Special Elite', monospace", pixel: "'Pixelify Sans', monospace", elegant: "'Libre Baskerville', serif" };
const PAPERS = {
  cream: { base: '#f8f0dc', mottle: 'none' },
  white: { base: '#fdfcf8', mottle: 'none' },
  kraft: { base: '#d8bf98' },
  grid: { base: '#fbf8ee', mottle: 'linear-gradient(rgba(70, 110, 170, .16) 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(90deg, rgba(70, 110, 170, .16) 1px, transparent 1px) 0 0 / 18px 18px' },
  dotted: { base: '#fbf8ee', mottle: 'radial-gradient(rgba(70, 60, 50, .28) 1px, transparent 1.4px) 0 0 / 16px 16px' }
};
const MAP_FILTERS = { soft: 'saturate(.55) brightness(1.06) contrast(.92)', mono: 'grayscale(1) contrast(1.05)', sepia: 'sepia(.85) saturate(.6) brightness(1.03)', night: 'invert(1) hue-rotate(180deg) brightness(.9) contrast(.9) saturate(.5)' };

export function cleanApps(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [id, a] of Object.entries(v)) {
    if (!APPS[id] || !a || typeof a !== 'object') continue;
    const one = {};
    if (APP_LOOKS[a.look] && a.look !== 'auto') one.look = a.look;
    if (one.look === 'custom') one.colour = okHex(a.colour) ? a.colour : '#7a6a9a';
    for (const k of APPS[id].extras) if (APP_EXTRAS[k].choices[a[k]] && a[k] !== Object.keys(APP_EXTRAS[k].choices)[0]) one[k] = a[k];
    if (Object.keys(one).length) out[id] = one;
  }
  return out;
}

// Splits a selector list at its top-level commas.
function splitSelectors(sel) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && !depth) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
// The same selector, but only inside one app (or on the app's own window or screen).
const ROOTISH = /^(:root|html|body|\[data-theme|\.mode-(desktop|phone)|\.tablet|\.lite|\.sky-|\[data-sk)/;
function scoped(sel, app) {
  const tag = `[data-app="${app}"]`;
  const out = [];
  for (const one of splitSelectors(sel)) {
    const parts = one.split(/\s+/);
    const lead = [];
    while (parts.length > 1 && ROOTISH.test(parts[0])) lead.push(parts.shift());
    const rest = parts.join(' ');
    const pre = lead.length ? lead.join(' ') + ' ' : '';
    out.push(`${pre}${tag} ${rest}`);
    if (/^[.[:#]/.test(rest) && !/^::/.test(rest)) out.push(`${pre}${tag}${rest}`);
  }
  return out;
}

// One colour moved to another colour's family, keeping its lightness (greys stay grey).
function tint([h, s, l], [th, ts]) {
  if (s < 0.12 || l < 0.05 || l > 0.97) return null;
  return [th, clamp(s * 0.6 + ts * 0.4), l];
}

// The stylesheet rules for one app's look: its own colours put back, or a tint.
function appRules(app, mode, target, doc) {
  const era = APPS[app].era;
  const sheets = ERA_SHEETS[era] || [];
  let css = '';
  const walk = (rules, name, wrap) => {
    for (const rule of rules) {
      if (rule.type === 4) {
        const inner = [];
        walk(rule.cssRules, name, (r) => inner.push(r));
        if (inner.length) wrap(`@media ${rule.media.mediaText} { ${inner.join(' ')} }`);
        continue;
      }
      if (rule.type !== 1) continue;
      if (name === 'desktop.css' && !ERA_DESKTOP[era].test(rule.selectorText)) continue;
      const style = rule.style;
      const decls = [];
      for (let i = 0; i < style.length; i++) {
        const p = style[i];
        const v = style.getPropertyValue(p);
        if (!v || !HAS_COLOUR.test(v)) continue;
        let changed = mode === 'original';
        const nv = mode === 'original' ? v : v.replace(COLOUR, (m) => {
          const c = parseColour(m);
          const n = c && tint(rgbHsl(c[0], c[1], c[2]), target);
          if (!n) return m;
          changed = true;
          return fmt(hslRgb(...n), c[3]);
        });
        if (changed) decls.push(`${p}: ${nv}${style.getPropertyPriority(p) ? ' !important' : ''}`);
      }
      if (decls.length) for (const sel of scoped(rule.selectorText, app)) wrap(`${sel} { ${decls.join('; ')}; }`);
    }
  };
  for (const sheet of doc.styleSheets) {
    const name = (sheet.href || '').split('/').pop().split('?')[0];
    if (!sheets.includes(name) && !(name === 'desktop.css' && ERA_DESKTOP[era])) continue;
    try {
      walk(sheet.cssRules, name, (r) => (css += r));
    } catch {}
  }
  return css;
}

// An app in another font: every rule that sets a font inside it, wherever the stylesheets have
// one, scoped to the app (handwriting stays with the app's own handwriting setting, and a post's
// own font still wins).
const CLASSIC_FONT = "Tahoma, 'DejaVu Sans', Verdana, sans-serif";
function fontRules(app, family, doc) {
  const keepHand = APPS[app].extras.includes('hand');
  let css = '';
  const walk = (rules, wrap) => {
    for (const rule of rules) {
      if (rule.type === 4) {
        const inner = [];
        walk(rule.cssRules, (r) => inner.push(r));
        if (inner.length) wrap(`@media ${rule.media.mediaText} { ${inner.join(' ')} }`);
        continue;
      }
      if (rule.type !== 1 || !rule.style.fontFamily || /data-font|data-sk|data-app/.test(rule.selectorText)) continue;
      if (keepHand && /Caveat/.test(rule.style.fontFamily)) continue;
      wrap(`${scoped(rule.selectorText, app).join(', ')} { font-family: ${family}; }`);
    }
  };
  for (const sheet of doc.styleSheets) {
    if (sheet.ownerNode?.id === 'skin-css') continue;
    try {
      walk(sheet.cssRules, (r) => (css += r));
    } catch {}
  }
  return `[data-app="${app}"] { font-family: ${family}; --font-mac: ${family}; --font-droid: ${family}; } ${css}`;
}

// Fonts written in handwriting (the journal's pen), found wherever the stylesheets use them.
function handRules(app, family, doc) {
  let css = '';
  for (const sheet of doc.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (rule.type !== 1 || !/Caveat/.test(rule.style.fontFamily || '')) continue;
      for (const sel of scoped(rule.selectorText, app)) css += `${sel} { font-family: ${family}; }`;
    }
  }
  return css;
}

function appsCss(t, doc) {
  let css = '';
  for (const [app, a] of Object.entries(t.apps || {})) {
    const era = APPS[app].era;
    const tag = `[data-app="${app}"]`;
    const colour = a.look === 'custom' ? a.colour : a.look === 'tint' ? t.main : null;
    if (era === 'leather') {
      const leather = a.look === 'original' ? '#5a3620' : colour;
      if (leather) css += `.leather-phone${tag}, .dw-leather${tag} { --leather: ${leather}; }`;
    } else if (a.look === 'original') {
      if (!isClassicColours(t)) css += appRules(app, 'original', null, doc);
    } else if (colour) css += appRules(app, 'tint', hsl(colour), doc);
    if (a.paper && PAPERS[a.paper]) {
      const P = PAPERS[a.paper];
      css += `${tag} { --paper-base: ${P.base};${P.mottle ? ` --paper-mottle: ${P.mottle};` : ''} }`;
      css += `[data-theme="dark"] ${tag} { --paper-base: ${mix(P.base, '#3a3428', 0.18)}; }`;
    }
    if (a.hand && HAND_FONTS[a.hand]) css += handRules(app, HAND_FONTS[a.hand], doc);
    if (a.map && MAP_FILTERS[a.map]) css += `${tag} .leaflet-tile-pane { filter: ${MAP_FILTERS[a.map]} !important; }`;
    if (a.font && a.font !== 'own') css += fontRules(app, a.font === 'theme' ? 'var(--font-xp)' : FONT_FAMILIES[a.font] || CLASSIC_FONT, doc);
  }
  return css;
}

// ---------- putting it together ----------

// A theme from theme.md's settings: a built-in one, with any of its parts changed.
export function resolveSkin(settings = {}) {
  // (Through the year wears the season's theme for today, wherever the owner is.)
  const base = settings.theme === 'seasonal' ? seasonalSkin(settings.hemisphere === 'south') : SKINS[settings.theme] || SKINS.classic;
  const t = { id: SKINS[settings.theme] ? settings.theme : 'classic', ...base };
  for (const k of ['main', 'accent', 'paper', 'leather']) if (okHex(settings[k])) t[k] = settings[k];
  if (WALLPAPERS[settings.wallpaper]) t.wallpaper = settings.wallpaper;
  if (settings.wallpaper === 'picture' && /^design\/[A-Za-z0-9._-]+\.(jpe?g|png|webp|gif)$/i.test(settings.picture || '')) t.picture = settings.picture;
  // (A picture not saved yet, shown only in the back office's preview.)
  if (settings.wallpaper === 'picture' && /^blob:/.test(settings.pictureUrl || '')) t.pictureUrl = settings.pictureUrl;
  if (t.wallpaper === 'picture' && !t.picture && !t.pictureUrl) t.wallpaper = base.wallpaper;
  if (CHARMS[settings.decoration]) t.decoration = settings.decoration;
  if (CHARMS[settings.pointer]) t.pointer = settings.pointer;
  t.emoji = emojiList(settings.emoji);
  t.emojiLayout = EMOJI_LAYOUTS[settings.emoji_layout] ? settings.emoji_layout : 'scatter';
  if (t.wallpaper === 'emoji' && !t.emoji.length) t.emoji = ['✨'];
  t.stickers = cleanStickers(settings.stickers);
  t.apps = cleanApps(settings.apps);
  // The browser tab's little icon: one of the drawings, or an emoji ('' is the site's own).
  t.tab_icon = CHARMS[settings.tab_icon] && !['none', 'plain'].includes(settings.tab_icon) ? settings.tab_icon : emojiList(settings.tab_icon, 1)[0] || '';
  // Another theme's colours, wallpaper, charm and pointer after dark (7pm to 7am where the visitor is).
  t.night_theme = SKINS[settings.night_theme] && settings.night_theme !== t.id ? settings.night_theme : '';
  t.festivals = [...new Set((Array.isArray(settings.festivals) ? settings.festivals : []).filter((x) => FESTIVALS[x]))];
  t.my_days = cleanMyDays(settings.my_days);
  t.festival_dates = cleanFestivalDates(settings.festival_dates);
  t.labels = cleanLabels(settings.labels);
  t.glass = [...new Set((Array.isArray(settings.glass) ? settings.glass : []).filter((x) => GLASS_PLACES[x]))];
  t.looks = cleanLooks(settings.looks);
  t.bar_decor = cleanBarDecor(settings.bar_decor);
  t.floppy = cleanFloppy(settings.floppy, (x) => (CHARMS[x] && !['none', 'plain'].includes(x) ? x : emojiList(x, 1)[0] || ''));
  Object.assign(t, resolveOptions(settings, base));
  // Post cards of your own, and one of them for every post if you've chosen it.
  t.cards = cleanCards(settings.cards, Object.keys(OPTIONS.title_font.choices));
  if (OWN_CARD.test(String(settings.card_style)) && t.cards.some((c) => c.id === settings.card_style)) t.card_style = settings.card_style;
  // …or every post a different one, mixed at random from the designs ticked (all, if none are).
  const builtIn = Object.keys(OPTIONS.card_style.choices);
  t.card_mix = cleanMix(settings.card_mix, builtIn, t.cards);
  t.card_seed = cleanSeed(settings.card_seed);
  if (settings.card_style === MIX) {
    t.card_style = MIX;
    if (!t.card_mix.length) t.card_mix = fullMix(builtIn, t.cards);
  }
  t.custom = [...['main', 'accent', 'paper', 'leather', 'wallpaper', 'decoration', 'pointer', 'tab_icon', 'night_theme'], ...Object.keys(OPTIONS)].some((k) => settings[k] != null && settings[k] !== '' && settings[k] !== base[k]) || t.stickers.length > 0 || Object.keys(t.apps).length > 0 || ['hide', 'menu', 'sections_hidden', 'festivals', 'my_days'].some((k) => Array.isArray(settings[k]) && settings[k].length);
  return t;
}
const isClassicColours = (t) => t.main === SKINS.classic.main && t.accent === SKINS.classic.accent && t.paper === SKINS.classic.paper && !t.leather;

// ---------- post cards of your own ----------
// Each card made in Themes › Post cards, drawn from its parts (see card-parts.js). Its colours
// are its own, or the theme's where it leaves one empty; the writing turns dark or light to suit
// the paper unless you've chosen its colour.
// A background's layers, split at its top-level commas.
const layers = (bg) => {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of bg) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && !depth) (out.push(cur.trim()), (cur = ''));
    else cur += ch;
  }
  return [...out, cur.trim()].filter(Boolean);
};
const rgba = (hx, a) => `rgba(${hexRgb(hx).slice(0, 3).join(', ')}, ${a})`;
const TORN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='14' viewBox='0 0 44 14'%3E%3Cpath d='M0 0h44v5l-4 7-5-8-3 9-6-7-4 8-4-9-5 7-3-8-6 9-4-6v3z'/%3E%3C/svg%3E") bottom / 44px 14px repeat-x`;
const CLIP = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='40' viewBox='0 0 16 40'%3E%3Cpath d='M11 10v19a4 4 0 0 1-8 0V7a5 5 0 0 1 10 0v24a7 7 0 0 1-14 0' fill='none' stroke='%23808a96' stroke-width='2' stroke-linecap='round' transform='translate(1.5 2)'/%3E%3C/svg%3E")`;
export function ownCardsCss(t) {
  let css = '';
  for (const c of t.cards || []) {
    const P = `:root:not([data-sk-posts="lines"]) .card[data-card="${c.id}"]`;
    const paper = c.paper || '#ffffff';
    const ink = c.ink || (luminance(paper) > 0.45 ? '#232323' : '#f2f2f2');
    const edge = c.edge_colour || t.main;
    const deco = c.deco_colour || t.accent;
    const head = c.head_colour || t.main;
    const headInk = luminance(head) > 0.5 ? '#232323' : '#ffffff';
    const texture = { lined: `repeating-linear-gradient(180deg, transparent 0 23px, ${rgba(ink, 0.16)} 23px 24px)`, grid: `linear-gradient(${rgba(ink, 0.1)} 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(90deg, ${rgba(ink, 0.1)} 1px, transparent 1px) 0 0 / 18px 18px`, dots: `radial-gradient(${rgba(ink, 0.2)} 1.2px, transparent 1.7px) 0 0 / 16px 16px`, kraft: 'repeating-linear-gradient(0deg, rgba(120, 80, 30, .06) 0 2px, transparent 2px 5px), repeating-linear-gradient(90deg, rgba(120, 80, 30, .05) 0 1px, transparent 1px 4px)', linen: `repeating-linear-gradient(0deg, ${rgba(ink, 0.05)} 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, ${rgba(ink, 0.05)} 0 1px, transparent 1px 4px)`, halftone: `radial-gradient(${rgba(deco, 0.3)} 1.4px, transparent 1.9px) 0 0 / 9px 9px` }[c.texture];
    const ground = [texture, `linear-gradient(${paper}, ${paper})`].filter(Boolean);
    const shadows = { none: [], soft: ['0 2px 8px rgba(0, 0, 0, .15)'], lifted: ['0 12px 18px -10px rgba(0, 0, 0, .45)'], hard: [`5px 5px 0 ${edge}`] }[c.shadow];
    const rules = [`color: ${ink}`, `border-radius: ${c.edge === 'pixel' ? 0 : { square: 0, soft: '6px', round: '16px' }[c.corners]}`];
    if (c.edge === 'stripes') rules.push('border: 7px solid transparent', `background: ${ground.flatMap(layers).map((layer) => `${layer} padding-box`).join(', ')}, repeating-linear-gradient(-45deg, ${edge} 0 9px, #ffffff 9px 16px, ${deco} 16px 25px, #ffffff 25px 32px) border-box`);
    else rules.push(`background: ${ground.join(', ')}`, `border: ${{ none: '0', line: `1px solid ${edge}`, thick: `3px solid ${edge}`, dashed: `2px dashed ${edge}`, double: `4px double ${edge}`, glow: `2px solid ${edge}`, pixel: '0', torn: '0' }[c.edge]}`);
    if (c.edge === 'glow') shadows.push(`0 0 6px ${edge}`, `0 0 16px ${rgba(edge, 0.5)}`);
    if (c.edge === 'pixel') shadows.push(`0 -4px 0 0 ${edge}`, `0 4px 0 0 ${edge}`, `-4px 0 0 0 ${edge}`, `4px 0 0 0 ${edge}`), rules.push('margin: 4px');
    if (c.edge === 'torn') rules.push('padding-bottom: 20px', `-webkit-mask: linear-gradient(#000 0 0) top / 100% calc(100% - 13px) no-repeat, ${TORN}`, `mask: linear-gradient(#000 0 0) top / 100% calc(100% - 13px) no-repeat, ${TORN}`);
    if (c.shadow === 'hard') rules.push('margin-right: 5px');
    rules.push(`box-shadow: ${shadows.length ? shadows.join(', ') : 'none'}`);
    if (c.tilt === 'slight') rules.push('transform: rotate(var(--card-tilt, 0deg))');
    if (['tape', 'tapetop', 'pin', 'clip'].includes(c.deco)) rules.push('overflow: visible');
    if (c.deco === 'seal') rules.push('padding-bottom: 44px');
    // (A drawing on the corner of every post keeps clear of the seal and the torn edge.)
    if (c.deco === 'seal') css += `${P} > .stk-cards { right: 62px; }`;
    else if (c.edge === 'torn') css += `${P} > .stk-cards { bottom: 22px; }`;
    css += `${P} { ${rules.join('; ')}; }`;
    css += `${P} :is(.card-body, .card-title, .card-head strong, .card-date, .place-name, .list-body, .quote-body, .muted, figcaption) { color: ${ink}; }`;
    // The heading.
    const headRule = { plain: `background: transparent; border-bottom: 1px solid ${rgba(ink, 0.15)}`, solid: `background: ${head}; border-bottom: 0`, halftone: `background: radial-gradient(${rgba(head, 0.5)} 1.4px, transparent 1.9px) 0 0 / 7px 7px, ${rgba(head, 0.12)}; border-bottom: 1px solid ${rgba(head, 0.4)}`, stripes: `background: repeating-linear-gradient(135deg, ${rgba(head, 0.28)} 0 6px, transparent 6px 12px); border-bottom: 1px solid ${rgba(head, 0.4)}`, none: 'background: transparent; border-bottom: 0' }[c.head];
    css += `${P} > .card-head { ${headRule}; ${c.deco === 'stamp' ? 'padding-right: 58px;' : c.deco === 'sparkles' ? 'padding-right: 30px;' : ''} }`;
    if (c.head === 'solid') css += `${P} > .card-head :is(strong, .card-date) { color: ${headInk}; }`;
    if (FONT_FAMILIES[c.font]) css += `${P} :is(.card-head strong, .card-title, .place-name) { font-family: ${FONT_FAMILIES[c.font]}; }`;
    // What's on top.
    const strip = (side, rot, bg) => `${P}::${side} { content: ''; position: absolute; z-index: 2; top: -9px; ${side === 'before' ? 'left' : 'right'}: 14px; width: 72px; height: 20px; opacity: .9; pointer-events: none; background: ${bg}; box-shadow: 0 1px 2px rgba(0, 0, 0, .15); transform: rotate(${rot}deg); }`;
    if (c.deco === 'tape') css += strip('before', -7, `repeating-linear-gradient(45deg, ${rgba(deco, 0.85)} 0 6px, rgba(255, 255, 255, .8) 6px 12px)`) + strip('after', 6, `repeating-linear-gradient(-45deg, ${rgba(deco, 0.6)} 0 5px, rgba(255, 255, 255, .85) 5px 10px)`);
    if (c.deco === 'tapetop') css += `${P}::before { content: ''; position: absolute; z-index: 2; top: -10px; left: calc(50% - 42px); width: 84px; height: 22px; pointer-events: none; background: ${rgba(deco, 0.35)}; box-shadow: 0 1px 2px rgba(0, 0, 0, .12); transform: rotate(-2deg); }`;
    if (c.deco === 'pin') css += `${P}::before { content: ''; position: absolute; z-index: 3; top: -7px; left: calc(50% - 8px); width: 16px; height: 16px; border-radius: 50%; pointer-events: none; background: radial-gradient(circle at 35% 32%, ${mix(deco, '#ffffff', 0.6)}, ${deco} 55%, ${mix(deco, '#000000', 0.35)}); box-shadow: 2px 3px 3px rgba(0, 0, 0, .35); }`;
    if (c.deco === 'clip') css += `${P}::before { content: ''; position: absolute; z-index: 3; top: -14px; left: 16px; width: 16px; height: 40px; pointer-events: none; background: ${CLIP} center / contain no-repeat; transform: rotate(8deg); }`;
    if (c.deco === 'stamp') css += `${P}::before { content: ''; position: absolute; z-index: 2; top: 6px; right: 8px; width: 38px; height: 46px; pointer-events: none; background: var(--card-pic, none) center 40% / 22px no-repeat, ${mix(deco, '#ffffff', 0.7)}; border: 3px dotted ${paper}; outline: 1px solid rgba(0, 0, 0, .18); transform: rotate(4deg); }`;
    if (c.deco === 'seal') css += `${P}::after { content: ''; position: absolute; right: 14px; bottom: 6px; width: 38px; height: 38px; border-radius: 47% 53% 50% 50% / 52% 46% 54% 48%; pointer-events: none; background: var(--card-pic, none) center / 18px no-repeat, radial-gradient(circle at 36% 30%, ${mix(deco, '#ffffff', 0.5)}, ${deco} 55%, ${mix(deco, '#000000', 0.3)}); box-shadow: 0 2px 3px rgba(0, 0, 0, .3), inset 0 0 0 5px ${mix(deco, '#000000', 0.2)}; transform: rotate(-12deg); }`;
    if (c.deco === 'sparkles') css += `${P}::before, ${P}::after { position: absolute; z-index: 2; pointer-events: none; color: ${deco}; text-shadow: 0 0 6px ${rgba(deco, 0.6)}; } ${P}::before { content: '✦'; top: 4px; right: 10px; font-size: 18px; } ${P}::after { content: '✧ ✦'; bottom: 4px; left: 10px; font-size: 13px; }`;
  }
  return css;
}

// Builds the stylesheet that dresses the site in a theme ('' for the classic colours).
export function skinCss(t, doc = document) {
  const c = inks(t);
  const T = { main: hsl(t.main), accent: hsl(t.accent), paper: hsl(t.paper), leather: t.leather ? hsl(t.leather) : null, inkHex: c.ink };
  let css = '';
  if (!isClassicColours(t)) {
    for (const sheet of doc.styleSheets) {
      const name = (sheet.href || '').split('/').pop().split('?')[0];
      if (!SHEETS.includes(name)) continue;
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      css += rulesCss(rules, T, name);
    }
    if (t.leather) css += `.leather-phone, .dw-leather { --leather: ${t.leather}; }`;
  }
  // Colours the other settings draw with (highlight, flat bars, scroll bars, list lines).
  const tc = (hex) => themeColour(hex, t);
  const sel = tc('#316ac5');
  const vars = {
    '--sk-sel': sel,
    '--sk-sel2': tc('#5d93f5'),
    '--sk-sel-text': luminance(sel) > 0.45 ? c.ink : '#ffffff',
    '--sk-bar': tc('#0054e3'),
    '--sk-bar-hi': tc('#3d8af7'),
    '--sk-bar-lo': tc('#003399'),
    '--sk-bar-text': luminance(tc('#0054e3')) > 0.45 ? c.ink : '#ffffff',
    '--sk-paper': tc('#ece9d8'),
    '--sk-line': mix(tc('#ece9d8'), c.ink, 0.22),
    '--sk-thumb': tc('#5d93f5'),
    '--sk-track': mix(tc('#ece9d8'), '#ffffff', 0.4),
    '--sk-ink': c.ink,
    '--sk-main': t.main,
    '--sk-accent': t.accent,
    '--sk-soft': mix(t.accent, '#ffffff', 0.72)
  };
  // (The classic colours are already the defaults in skins.css.)
  if (!isClassicColours(t)) css += `:root { ${Object.entries(vars).map(([k, v]) => `${k}: ${v}`).join('; ')}; }`;
  // (The site's fonts are set on the body, so the theme's are too.)
  if (FONT_FAMILIES[t.font]) css += `html body { --font-xp: ${FONT_FAMILIES[t.font]}; }`;
  if (FONT_FAMILIES[t.title_font]) css += `html body { --font-xp-title: ${FONT_FAMILIES[t.title_font]}; }`;
  css += appsCss(t, doc);
  css += ownCardsCss(t);
  const wall = wallpaperCss(t);
  // (With the light of the time of day on top: see skins.css.)
  if (wall) css += `:root .wall, :root .mode-desktop .wall, :root .phone.wall { background: var(--wall-time, linear-gradient(transparent, transparent)), ${wall}; background-attachment: fixed; }`;
  if (t.decoration && !['none', 'plain'].includes(t.decoration)) {
    css += `.xp-title-text::after, .dw-xp .xp-title-text::after { content: ''; display: inline-block; width: 17px; height: 17px; margin-left: 7px; vertical-align: -3px; background: ${charmUrl(t.decoration, t, 17)} center / contain no-repeat; }`;
  }
  return css;
}

// Re-colouring takes a moment on a slow phone, so the result is kept in this browser and
// reused while the theme and the site's stylesheets are the same.
function cachedCss(t, settings, doc) {
  let count = 0;
  for (const sheet of doc.styleSheets) {
    if (sheet.ownerNode?.id === 'skin-css') continue;
    try {
      count += sheet.cssRules.length;
    } catch {}
  }
  const sig = JSON.stringify(settings || {}) + ':' + count;
  let store = null;
  try {
    store = doc.defaultView.localStorage;
    const kept = JSON.parse(store.getItem('skin-css') || 'null');
    if (kept && kept.sig === sig && !t.pictureUrl) return kept.css;
  } catch {}
  const css = skinCss(t, doc);
  try {
    if (!t.pictureUrl) store?.setItem('skin-css', JSON.stringify({ sig, css }));
  } catch {}
  return css;
}

// The theme on the page now (for the menus, which are built from it).
let active = null;
export const activeSkin = () => active;

// After dark, the night theme brings its own colours, wallpaper, charm and pointer; everything
// else (fonts, layout, stickers, effects) stays as it is. (A picture wallpaper of your own stays.)
export const isNight = (date = new Date()) => date.getHours() >= 19 || date.getHours() < 7;
export function nightSettings(settings) {
  const night = settings?.night_theme;
  if (!SKINS[night] || night === settings.theme) return settings;
  const out = { ...settings, theme: night };
  for (const k of ['main', 'accent', 'paper', 'leather', 'decoration', 'pointer']) delete out[k];
  if (out.wallpaper !== 'picture') delete out.wallpaper;
  return out;
}
let nightTimer = null;
function untilSwitch(now = new Date()) {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(isNight(now) ? (now.getHours() >= 19 ? 31 : 7) : 19);
  return Math.max(60_000, next - now);
}

// The browser tab's icon: a drawing or an emoji, or the site's own.
function tabIcon(t, doc) {
  const link = doc.querySelector('link[rel="icon"]');
  if (!link) return;
  link.dataset.own ||= link.getAttribute('href');
  if (!t.tab_icon) return link.setAttribute('href', link.dataset.own);
  const svg = CHARMS[t.tab_icon]
    ? null
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text x="32" y="36" font-size="54" text-anchor="middle" dominant-baseline="middle" font-family="${EMOJI_FONT}">${t.tab_icon}</text></svg>`;
  link.setAttribute('href', svg ? 'data:image/svg+xml,' + encodeURIComponent(svg) : charmUrl(t.tab_icon, t, 64).slice(5, -2));
}

// Puts a theme on the page (or takes it off, for Classic).
export function applySkin(settings, doc = document) {
  settings ||= {};
  // (The back office's preview can ask to see the night look whatever the time.)
  const dark = settings.night_theme && (settings.night_preview ?? isNight());
  if (doc === document && settings.night_theme && settings.night_preview == null) {
    clearTimeout(nightTimer);
    nightTimer = setTimeout(() => applySkin(settings, doc), untilSwitch());
  }
  const eff = dark ? nightSettings(settings) : settings;
  const t = resolveSkin(eff);
  if (dark) t.night = true;
  if (doc === document) active = t;
  const root = doc.documentElement;

  // A season or festive day: one the owner has picked, or (on Automatic) whatever the date
  // brings. The back office's preview can show any of them.
  const now = new Date();
  const preview = settings.season_preview;
  const south = t.hemisphere === 'south';
  let season = '';
  let festival = '';
  if (SEASONS[preview]) season = preview;
  else if (lookOf(preview, t)) {
    festival = preview;
    if (t.seasons === 'auto') season = seasonOf(now, south);
  } else if (t.seasons === 'auto') {
    season = seasonOf(now, south);
    festival = festivalOn(now, t.festivals, t.my_days, t.festival_dates);
  } else if (SEASONS[t.seasons]) season = t.seasons;
  else if (lookOf(t.seasons, t)) festival = t.seasons;
  const look = festival ? lookOf(festival, t) : season ? lookOf(season, t) : null;
  let extras = [];
  if (look) {
    const fall = look.noFall ? '' : festival ? look.falling || (look.quiet || look.own || !season ? '' : lookOf(season, t).falling) : look.falling;
    // (Something you've chosen to fall yourself stays; the season only adds its drawing.)
    if (t.falling === 'none' && fall) {
      t.falling = fall;
      t.gentle = true;
    }
    // The day's drawing, in each place you've chosen for it (the window's corner unless you say).
    const what = look.charms[dayNumber(now) % look.charms.length];
    extras = (look.where || ['corner-br']).map((where, i) => ({ what: where === 'cards' || where === 'title' ? look.charms[(dayNumber(now) + i) % look.charms.length] : what, where, size: where === 'desktop' ? 'l' : 'm', tilt: where === 'corner-bl' ? -6 : 0, x: 86, y: 78 }));
  }
  // (For Floppy, who dresses for the day: see helper.js.)
  // (Floppy dresses for the time of year even when the site's seasons are off.)
  const floppySeason = season || seasonOf(now, south);
  t.today = { season: festival ? season : floppySeason, festival, charm: extras[0]?.what || lookOf(floppySeason, t).charms[0] };
  if (season) root.dataset.season = season;
  else delete root.dataset.season;
  // Where the season settles: everywhere, unless you've chosen.
  const settleFrom = festival ? look : season ? lookOf(season, t) : null;
  root.dataset.settle = settleFrom?.settle ? settleFrom.settle.join(' ') : Object.keys(SCENERY_PLACES).join(' ');
  if (festival) root.dataset.festival = festival.startsWith('my_') ? 'mine' : festival;
  else delete root.dataset.festival;
  // A festive day's own scenery, drawn from its drawings and colours.
  if (festival && look) {
    const sc = festiveScenery(look, festival, t);
    for (const [k, v] of Object.entries(sc)) root.style.setProperty(`--fx-${k}`, v);
  } else for (const k of ['bar', 'icon', 'garland', 'ground']) root.style.removeProperty(`--fx-${k}`);

  // The apps' top bars: bunting and stickers, as each app has chosen.
  let barStyle = doc.getElementById('bar-decor-css');
  if (!barStyle) {
    barStyle = doc.createElement('style');
    barStyle.id = 'bar-decor-css';
    doc.head.append(barStyle);
  }
  barStyle.textContent = barDecorCss(t, festival || season, look, root.dataset.settle.split(' ').includes('bars'), now);

  // Behind the posts: the layers, with the season's (or festive day's) drawings on top.
  const page = pageLayers(t, look);
  if (page) {
    root.style.setProperty('--page-bg', page.bg);
    root.style.setProperty('--page-wash-a', String(page.wash));
    root.style.setProperty('--page-wash-c', hexRgb(page.washColour).slice(0, 3).join(', '));
  } else for (const k of ['--page-bg', '--page-wash-a', '--page-wash-c']) root.style.removeProperty(k);

  root.dataset.skin = t.id;
  // The other settings: rules in skins.css follow these marks on the page.
  for (const k of Object.keys(OPTIONS)) root.dataset['sk' + k.replace(/(^|_)(\w)/g, (m, u, ch) => ch.toUpperCase())] = t[k];
  root.dataset.skHide = t.hide.join(' ');
  let style = doc.getElementById('skin-css');
  if (!style) {
    style = doc.createElement('style');
    style.id = 'skin-css';
    doc.head.append(style);
  }
  style.textContent = cachedCss(t, eff, doc);
  if (t.pointer && t.pointer !== 'none') {
    const p = pointerSvgs(t);
    root.style.setProperty('--skin-arrow', `${p.arrow} 3 3, default`);
    root.style.setProperty('--skin-hand', `${p.hand} 10 2, pointer`);
    root.dataset.skinPointer = '1';
  } else {
    root.style.removeProperty('--skin-arrow');
    root.style.removeProperty('--skin-hand');
    delete root.dataset.skinPointer;
  }
  const all = [...t.stickers, ...extras];
  stickerState = all.length ? { t: { ...t, stickers: all }, sig: JSON.stringify(all) + t.main + t.accent } : null;
  // The glass takes the season's mood, or a festive one (a quiet festive day keeps the season's);
  // or a style of its own, whatever the date.
  const glassLook = t.glass_style !== 'season' ? t.glass_style : festival && !(look?.quiet) ? 'festive' : season || '';
  glassState = glassLook && t.glass.length ? { places: t.glass, sig: glassLook + t.glass.join() } : null;
  if (glassState) root.dataset.glassLook = glassLook;
  else delete root.dataset.glassLook;
  if (doc.body) {
    decorate(doc);
    decorateGlass(doc);
    if (stickerState || glassState) watchForStickers(doc);
  }
  tabIcon(t, doc);
  if (doc.body) startEffects(t, doc);
  const meta = doc.querySelector('meta[name="theme-color"]');
  if (meta && root.dataset.theme !== 'dark') meta.content = t.id === 'classic' && !t.custom ? '#0a3ec4' : hslHex(hsl(t.main)[0], hsl(t.main)[1], Math.min(0.42, hsl(t.main)[2]));
  return t;
}
