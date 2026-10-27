// Floppy's wardrobe: what he wears for the seasons and festive days, or an outfit the owner puts
// together (Themes > Floppy). Each piece is drawn over him in his own 64 × 70 picture; hats rise
// above it, and what he holds sits by his right side.

export const FLOPPY_PIECES = {
  hat: { name: 'Hat', choices: { none: 'None', beanie: 'Bobble hat', santa: 'Festive hat', party: 'Party hat', sunhat: 'Sun hat', flowers: 'Flower crown', crown: 'Crown', witch: 'Witch’s hat', beret: 'Beret', earmuffs: 'Earmuffs' } },
  eyes: { name: 'Glasses', choices: { none: 'None', sunglasses: 'Sunglasses', glasses: 'Round glasses', hearts: 'Heart glasses', stars: 'Star glasses' } },
  neck: { name: 'Round his neck', choices: { none: 'Nothing', scarf: 'Scarf', bowtie: 'Bow tie', garland: 'Flower garland' } },
  held: { name: 'Holding', choices: { none: 'Nothing', mug: 'Hot drink', umbrella: 'Umbrella', balloon: 'Balloon', today: 'The day’s drawing' } },
  colour: { name: 'His colour', choices: { classic: 'Classic blue', theme: 'The theme’s colour', own: 'A colour of my own' } }
};
export const FLOPPY_DRESS = { off: 'As he is', auto: 'For the seasons and festive days', own: 'My own outfit' };

// What he wears on his own, season by season and day by day (he holds the day's drawing too).
const SEASON_WEAR = {
  winter: { hat: 'beanie', neck: 'scarf', held: 'mug', tint: '#d6283f' },
  spring: { hat: 'flowers', held: 'today' },
  summer: { hat: 'sunhat', eyes: 'sunglasses', held: 'today' },
  autumn: { hat: 'beret', neck: 'scarf', held: 'umbrella', tint: '#d9622b' }
};
const FESTIVAL_WEAR = {
  lunar_new_year: { neck: 'scarf', tint: '#d6283f' },
  hanami: { hat: 'flowers' },
  childrens_day: { hat: 'party', tint: '#4facfe' },
  dragon_boat: { neck: 'scarf', tint: '#3f8f4e' },
  tanabata: { eyes: 'stars' },
  mid_autumn: { neck: 'bowtie', tint: '#e23b3b' },
  nowruz: { hat: 'flowers' },
  holi: { eyes: 'hearts', neck: 'garland' },
  ramadan: {},
  eid_al_fitr: { neck: 'bowtie', tint: '#3f8f4e' },
  eid_al_adha: { neck: 'bowtie', tint: '#3f8f4e' },
  diwali: { neck: 'garland' },
  yalda: { neck: 'scarf', tint: '#a8243a' },
  dia_de_reyes: { hat: 'crown' },
  carnival: { hat: 'party', eyes: 'stars', tint: '#ff4fa3' },
  dia_de_muertos: { hat: 'flowers', neck: 'garland' },
  st_patricks: { hat: 'beret', tint: '#3f9b4e' },
  easter: { hat: 'flowers' },
  midsummer: { hat: 'flowers', neck: 'garland' },
  bonfire_night: { hat: 'earmuffs', neck: 'scarf', tint: '#f28c28' },
  halloween: { hat: 'witch' },
  hanukkah: { neck: 'scarf', tint: '#3b6fd6' },
  christmas: { hat: 'santa', neck: 'scarf', tint: '#d6283f' }
};
// The outfit for today: { hat, eyes, neck, held, tint } (held 'today' is the day's drawing).
export function outfitFor(dress, own, today) {
  if (dress === 'own') return { hat: 'none', eyes: 'none', neck: 'none', held: 'none', ...own };
  if (dress !== 'auto' || (!today?.season && !today?.festival)) return {};
  const base = today.festival ? { held: 'today', ...(FESTIVAL_WEAR[today.festival] || (today.festival === 'mine' ? { hat: 'party' } : {})) } : SEASON_WEAR[today.season] || {};
  return { ...base };
}

const HATS = {
  beanie: (c) => `<path d="M13 8c0-11 8-17 19-17s19 6 19 17z" fill="${c}" stroke="#4a1a1a" stroke-width="1.2"/><path d="M18 -3c4-2 24-2 28 0M16 2c5-2 27-2 32 0" stroke="#fff" stroke-opacity=".35" stroke-width="1.5" fill="none"/><rect x="11" y="4" width="42" height="7" rx="3" fill="#fff" stroke="#c9c2b0" stroke-width="1"/><circle cx="32" cy="-11" r="5" fill="#fff" stroke="#c9c2b0" stroke-width="1"/>`,
  santa: () => `<path d="M14 8C16 -6 30 -14 46 -10c6 2 9 6 10 12l-6 1c-2-6-6-8-11-8C30 -5 24 0 22 8z" fill="#d6283f" stroke="#7a1420" stroke-width="1.2"/><circle cx="54" cy="5" r="4.5" fill="#fff" stroke="#c9c2b0"/><rect x="10" y="5" width="44" height="8" rx="4" fill="#fff" stroke="#c9c2b0"/>`,
  party: (c) => `<path d="M32 -16 21 8h22z" fill="${c}" stroke="#333" stroke-width="1"/><path d="M27 -4h10M24.5 2h15" stroke="#fff" stroke-width="2"/><circle cx="32" cy="-17" r="3" fill="#ffd23f" stroke="#333" stroke-width=".8"/>`,
  sunhat: () => `<ellipse cx="32" cy="7" rx="30" ry="5" fill="#e8c37a" stroke="#9c7a2d" stroke-width="1"/><path d="M18 7c0-10 6-14 14-14s14 4 14 14z" fill="#f0d08c" stroke="#9c7a2d" stroke-width="1"/><path d="M18.5 3h27" stroke="#e2506f" stroke-width="3"/>`,
  flowers: (c) => `<path d="M8 6q24-8 48 0" stroke="#5aa043" stroke-width="2" fill="none"/>${[10, 19, 28, 37, 46, 55].map((x, i) => `<g transform="translate(${x} ${i % 2 ? 1 : 3})">${[0, 72, 144, 216, 288].map((a) => `<circle cx="0" cy="-3" r="2.4" transform="rotate(${a})" fill="${['#ffb3c8', '#fff', c, '#ffd84d', '#c7b3ff', '#ffb3c8'][i]}" stroke="#a8507a" stroke-width=".4"/>`).join('')}<circle r="1.4" fill="#f6c431"/></g>`).join('')}`,
  crown: () => `<path d="M14 8V-6l7 7 5-11 6 11 6-11 5 11 7-7V8z" fill="#f6c431" stroke="#9c6b00" stroke-width="1.2" stroke-linejoin="round"/><g fill="#d6283f"><circle cx="26" cy="3" r="1.8"/><circle cx="38" cy="3" r="1.8"/></g><circle cx="32" cy="2" r="2" fill="#4facfe"/>`,
  witch: () => `<ellipse cx="32" cy="7" rx="28" ry="4.5" fill="#3b2a55" stroke="#1d1430" stroke-width="1"/><path d="M20 7 30 -16q6 -2 9 6l5 17z" fill="#4a3570" stroke="#1d1430" stroke-width="1"/><path d="M21 3h23" stroke="#f28c28" stroke-width="3"/>`,
  beret: (c) => `<path d="M10 7c-2-8 10-14 24-14s24 5 21 13c-1 3-44 4-45 1z" fill="${c}" stroke="#4a2a14" stroke-width="1.2"/><path d="M33 -7l1-4" stroke="#4a2a14" stroke-width="2" stroke-linecap="round"/>`,
  earmuffs: (c) => `<path d="M8 18C8 -6 56 -6 56 18" fill="none" stroke="#666" stroke-width="2.5"/><circle cx="6" cy="20" r="7" fill="${c}" stroke="#7a1420" stroke-width="1"/><circle cx="58" cy="20" r="7" fill="${c}" stroke="#7a1420" stroke-width="1"/><circle cx="6" cy="20" r="3" fill="#fff" opacity=".5"/><circle cx="58" cy="20" r="3" fill="#fff" opacity=".5"/>`
};
const heart = (x, y, f) => `<path d="M${x} ${y + 4}c-6-4-7-8-4-10 2-1.5 3.5-.5 4 1 .5-1.5 2-2.5 4-1 3 2 2 6-4 10z" fill="${f}" stroke="#7a1430" stroke-width=".8"/>`;
const star = (x, y, f) => `<path d="m${x} ${y - 7} 2 4.6 5 .6-3.7 3.4 1 5-4.3-2.6-4.3 2.6 1-5-3.7-3.4 5-.6z" fill="${f}" stroke="#9c6b00" stroke-width=".8"/>`;
const EYES = {
  sunglasses: () => `<rect x="17.5" y="39" width="14" height="10" rx="4" fill="#1d1d24"/><rect x="32.5" y="39" width="14" height="10" rx="4" fill="#1d1d24"/><path d="M31.5 42h1" stroke="#1d1d24" stroke-width="2"/><path d="M20 41.5l4-1.5M35 41.5l4-1.5" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" stroke-linecap="round"/>`,
  glasses: () => `<circle cx="24.5" cy="44" r="7" fill="none" stroke="#5a3a1a" stroke-width="1.6"/><circle cx="39.5" cy="44" r="7" fill="none" stroke="#5a3a1a" stroke-width="1.6"/><path d="M31.5 43h1" stroke="#5a3a1a" stroke-width="1.6"/>`,
  hearts: () => heart(24.5, 41, '#ff6b9a') + heart(39.5, 41, '#ff6b9a'),
  stars: () => star(24.5, 45, '#ffd23f') + star(39.5, 45, '#ffd23f')
};
const NECK = {
  scarf: (c) => `<path d="M6 55h52v7H6z" fill="${c}" stroke="#4a1a1a" stroke-width="1"/><path d="M44 61l3 9h6l-3-9z" fill="${c}" stroke="#4a1a1a" stroke-width="1"/><path d="M10 55v7M16 55v7M22 55v7M28 55v7M34 55v7M40 55v7M50 55v7" stroke="#fff" stroke-opacity=".3" stroke-width="1.5"/>`,
  bowtie: (c) => `<path d="M32 60 23 55v10zM32 60l9-5v10z" fill="${c}" stroke="#333" stroke-width="1"/><rect x="29.5" y="57.5" width="5" height="5" rx="1.5" fill="${c}" stroke="#333" stroke-width="1"/>`,
  garland: () => [10, 18, 26, 34, 42, 50].map((x, i) => `<circle cx="${x + 2}" cy="${59 + (i % 2)}" r="3.2" fill="${['#ff7aa2', '#ffd84d', '#fff', '#c7b3ff', '#ff9a5a', '#7ee081'][i]}" stroke="#a8507a" stroke-width=".5"/>`).join('')
};
const HELD = {
  mug: () => `<rect x="58" y="44" width="10" height="11" rx="1.5" fill="#fff" stroke="#8a5a33" stroke-width="1"/><path d="M68 47c3 0 3 5 0 5" fill="none" stroke="#8a5a33" stroke-width="1.2"/><rect x="58" y="44" width="10" height="3" fill="#7a4a2a"/><path d="M61 41q-1-3 1-5M65 41q-1-3 1-5" stroke="#bbb" stroke-width="1" fill="none" stroke-linecap="round"/>`,
  umbrella: () => `<path d="M64 18v32q0 4-3 3" fill="none" stroke="#333" stroke-width="1.4" stroke-linecap="round"/><path d="M48 20q16-16 32 0z" fill="#4facfe" stroke="#1d5fa8" stroke-width="1"/><path d="M48 20q4-4 8 0 4-4 8 0 4-4 8 0 4-4 8 0" fill="#7cc4ff" stroke="#1d5fa8" stroke-width=".8"/>`,
  balloon: (c) => `<path d="M64 46q-2-10 2-18" fill="none" stroke="#777" stroke-width=".8"/><ellipse cx="66" cy="20" rx="7" ry="8.5" fill="${c}" stroke="#7a1430" stroke-width="1"/><path d="M63 16q1-3 4-3" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" fill="none"/>`
};

// Floppy, dressed. `base` is his plain picture; `o` the outfit; `charm(name)` draws a drawing
// (16 × 16) and `emoji` any emoji, for "the day's drawing"; colours: his body colour and the
// outfit's colour.
export function dressFloppy(base, o = {}, { body = '', tint = '#d6283f', charm = () => '', today = '' } = {}) {
  let svg = base;
  if (body) svg = svg.replace(/#2c4f9e/g, body).replace(/#1a2f63/g, shade(body));
  const extra = [];
  const back = [];
  if (o.held && o.held !== 'none') {
    const what = o.held === 'today' ? today : o.held;
    // An arm, then what he holds.
    if (what) extra.push(`<path d="M57 46q4 0 5-3" fill="none" stroke="${body ? shade(body) : '#1a2f63'}" stroke-width="2" stroke-linecap="round"/>`);
    if (HELD[what]) (what === 'umbrella' || what === 'balloon' ? back : extra).push(HELD[what](o.tint || tint));
    else if (what) {
      const drawn = charm(what);
      extra.push(drawn ? `<g transform="translate(56 32) scale(1.15)">${drawn}</g>` : `<text x="66" y="50" font-size="16" text-anchor="middle">${what}</text>`);
    }
  }
  if (NECK[o.neck]) extra.push(NECK[o.neck](o.tint || tint));
  if (EYES[o.eyes]) extra.push(EYES[o.eyes]());
  if (HATS[o.hat]) extra.push(HATS[o.hat](o.tint || tint));
  if (!extra.length && !back.length) return svg;
  svg = svg.replace('<svg ', '<svg overflow="visible" ');
  if (back.length) svg = svg.replace('<g class="fl-body">', `<g class="fl-outfit-back">${back.join('')}</g><g class="fl-body">`);
  // (Inside his body group, so the outfit bobs along with him.)
  return svg.replace(/<\/g>\s*<\/svg>$/, `<g class="fl-outfit">${extra.join('')}</g></g></svg>`);
}
function shade(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  if (Number.isNaN(n)) return '#1a2f63';
  const f = (v) => Math.round(v * 0.55).toString(16).padStart(2, '0');
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

// Floppy's settings from theme.md: { dress, colour, hex, own: { hat, eyes, neck, held, tint } }.
// `drawing(x)` says whether x is one of the drawings or an emoji he can hold (and returns it).
const okHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));
export function cleanFloppy(v, drawing = () => '') {
  const f = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const out = { dress: FLOPPY_DRESS[f.dress] ? f.dress : 'off', colour: FLOPPY_PIECES.colour.choices[f.colour] ? f.colour : 'classic', own: {} };
  if (out.colour === 'own') out.hex = okHex(f.hex) ? f.hex : '#2c4f9e';
  const o = f.own && typeof f.own === 'object' ? f.own : {};
  for (const k of ['hat', 'eyes', 'neck']) if (FLOPPY_PIECES[k].choices[o[k]] && o[k] !== 'none') out.own[k] = o[k];
  const held = FLOPPY_PIECES.held.choices[o.held] ? o.held : drawing(o.held);
  if (held && held !== 'none') out.own.held = held;
  if (okHex(o.tint)) out.own.tint = o.tint;
  return out;
}
