// The visa in the passport: a security-printed sticker. The original design (in the spirit of
// Central Asian art) is the default; passport.md can pick another design and tweak its colours,
// the strip along the foot, the emblem, the words and a background picture.
import { h } from './util.js';

// "Visas" and "visa" in the languages a well-travelled passport collects.
export const VISAS_WORLD = ['VISUM', 'VISADOS', 'VISTI', 'ВИЗЫ', 'ΘΕΩΡΗΣΕΙΣ', 'تأشيرات', 'روادید', 'ویزه', 'वीज़ा', '签证', 'ビザ', '사증'];
// Each word kept in its own direction, so right-to-left scripts don't shuffle the list.
export const wordList = (words) => words.flatMap((w, i) => [i ? ' · ' : null, h('bdi', null, w)]).filter(Boolean);
export const VISA_WORLD = ['VISUM', 'VISADO', 'VISTO', 'ВИЗА', 'ΘΕΩΡΗΣΗ', 'تأشيرة', 'روادید', 'ویزه', 'वीज़ा', '签证', 'ビザ'];
export const MICRO = 'PASSPORT PASSEPORT REISEPASS PASAPORTE PASSAPORTO ПАСПОРТ ΔΙΑΒΑΤΗΡΙΟ جواز سفر گذرنامه 护照 パスポート';

// A fine guilloche (the looping security lines on banknotes and visas), drawn fresh as SVG.
// The visa's security printing, in the spirit of Central Asian art: a khatam / girih
// pattern of eight-pointed stars, a shamsa sunburst medallion, eslimi arabesque vines in
// the corners, and a faint turquoise-glazed clay pot pressed into the paper like a
// watermark. Lapis lazuli blue, glaze turquoise and pomegranate red. The other designs are
// drawn in the same fine engraved lines (see medallion and scene below).
// Lapis, turquoise and pomegranate now come from the design's colours (see VISA_DESIGNS).
const SAFFRON = '#c98a1c';
function star8(cx, cy, r) {
  // Two overlapping squares make the classic eight-pointed star.
  const pts = (rot) => [0, 1, 2, 3].map((k) => {
    const a = rot + (k * Math.PI) / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  return `<polygon points="${pts(Math.PI / 4)}"/><polygon points="${pts(0)}"/>`;
}
function guilloche(o) {
  // Shamsa: a sunburst medallion of petals around an eight-pointed star, here the sun.
  let petals = '';
  for (let k = 0; k < 24; k++) petals += `<ellipse cx="374" cy="17" rx="2.4" ry="11" transform="rotate(${k * 15} 374 34)"/>`;
  let rays = '';
  for (let k = 0; k < 12; k++) rays += `<path d="M374 34 L${(374 + 14 * Math.cos((k * Math.PI) / 6)).toFixed(1)} ${(34 + 14 * Math.sin((k * Math.PI) / 6)).toFixed(1)}"/>`;
  // Eslimi: a curling vine with leaves, drawn once and turned to fit each corner.
  const vine = `<path d="M0 34 C 14 34, 22 26, 24 14 C 25 6, 33 2, 40 6 C 46 10, 42 18, 36 16 C 31 14, 33 8, 37 9" /><path d="M8 34 C 10 26, 16 22, 22 24" /><path d="M24 14 q 6 -2 8 -8 q -7 1 -8 8z" fill="${o.highlight}" fill-opacity=".35"/><path d="M14 32 q 2 -6 8 -8 q -1 7 -8 8z" fill="${o.accent}" fill-opacity=".35"/><circle cx="37" cy="9" r="1.6" fill="${SAFFRON}" fill-opacity=".6"/>`;
  const corners = [`<g transform="translate(4 4) scale(1.3)">${vine}</g>`, `<g transform="translate(4 196) scale(1.3 -1.3)">${vine}</g>`].join('');
  // ---- An engraved landscape, drawn in fine lines like banknote printing ----
  const INK = '#2c3f6e';
  const SEPIA = '#6b4a2a';
  // Mountains: three ranges, the far ones paler, each traced with parallel contour lines.
  const range = (pts, dy, op, fill) => {
    const d = 'M' + pts.map(([x, y]) => `${x} ${y}`).join(' L');
    let lines = '';
    for (let k = 1; k <= 7; k++) lines += `<path d="${d}" transform="translate(0 ${k * 3.2})" stroke-opacity="${(0.75 - k * 0.08).toFixed(2)}"/>`;
    return `<g opacity="${op}"><g fill="none" stroke="url(#shineCool)" stroke-width=".5">${lines}</g><path d="${d}" fill="none" stroke="url(#shineCool)" stroke-width="1"/></g>`;
  };
  const far = [[140, 128], [168, 112], [190, 120], [214, 98], [236, 110], [262, 86], [290, 104], [318, 80], [344, 98], [372, 74], [400, 90]];
  const mid = [[150, 146], [182, 126], [204, 134], [236, 108], [262, 124], [292, 100], [320, 122], [356, 96], [382, 112], [400, 104]];
  const near = [[160, 162], [198, 144], [226, 152], [262, 130], [290, 146], [330, 124], [362, 142], [400, 128]];
  // A little glint on each peak instead of painted snow.
  const snow = (pts) => pts.filter((p, i) => i > 0 && i < pts.length - 1 && p[1] < pts[i - 1][1] && p[1] < pts[i + 1][1]).map(([x, y], k) => `<path class="glint" style="animation-delay:${(k * 0.7).toFixed(1)}s" d="M${x} ${y - 4} L${x + 0.9} ${y - 0.9} L${x + 4} ${y} L${x + 0.9} ${y + 0.9} L${x} ${y + 4} L${x - 0.9} ${y + 0.9} L${x - 4} ${y} L${x - 0.9} ${y - 0.9}Z" fill="#fff8dc"/>`).join('');
  const mountains = `${range(far, 0, 0.45, 'url(#skyFade)')}${snow(far)}${range(mid, 0, 0.62, 'url(#rangeMid)')}${snow(mid)}${range(near, 0, 0.8, 'url(#rangeNear)')}`;
  // Minaret: a tapering tower of fine brick courses, decorative bands and a balcony.
  const tower = (y) => 10.5 - (178 - y) * 0.035; // half-width at height y
  let courses = '';
  for (let y = 176; y > 70; y -= 2.6) courses += `<path d="M${(330 - tower(y)).toFixed(2)} ${y.toFixed(1)} H${(330 + tower(y)).toFixed(2)}"/>`;
  let shade = '';
  for (let x = 0; x < 6; x++) shade += `<path d="M${(334 + x * 1.1).toFixed(1)} 176 L${(332.6 + x * 0.95).toFixed(1)} 70"/>`;
  const band = (y, kind) => {
    const w = tower(y);
    const x0 = 330 - w;
    let deco = '';
    if (kind === 'zig') for (let x = x0 + 1; x < 330 + w - 2; x += 3) deco += `<path d="M${x.toFixed(1)} ${y + 2.5} l1.5 -2 l1.5 2"/>`;
    if (kind === 'dot') for (let x = x0 + 2; x < 330 + w - 1; x += 3) deco += `<circle cx="${x.toFixed(1)}" cy="${y + 1.5}" r=".55"/>`;
    if (kind === 'knot') for (let x = x0 + 2.5; x < 330 + w - 2; x += 5) deco += `<path d="M${x.toFixed(1)} ${y + 1.6} l1.6 -1.6 l1.6 1.6 l-1.6 1.6z"/>`;
    return `<rect x="${x0.toFixed(2)}" y="${y - 0.5}" width="${(w * 2).toFixed(2)}" height="4" fill="none" stroke="url(#shineWarm)" stroke-width=".55"/><g fill="${kind === 'dot' ? 'url(#shineWarm)' : 'none'}" stroke="url(#${kind === 'knot' ? 'shineCool' : 'shineWarm'})" stroke-width=".5">${deco}</g>`;
  };
  const minaret = `<g>
    <path d="M${330 - tower(176)} 177 L${330 + tower(176)} 177 L${330 + tower(70)} 70 L${330 - tower(70)} 70Z" fill="none" stroke="url(#shineWarm)" stroke-width=".9"/>
    <g stroke="url(#shineWarm)" stroke-width=".32" opacity=".85">${courses}</g>
    <g stroke="url(#shineWarm)" stroke-width=".35" opacity=".5">${shade}</g>
    ${band(160, 'zig')}${band(140, 'knot')}${band(124, 'dot')}${band(104, 'knot')}${band(88, 'zig')}
    <path d="M318.5 70 h23 l-2 -3 h-19z" fill="none" stroke="url(#shineWarm)" stroke-width=".7"/>
    <path d="M320 67 v-3 M323 67 v-3 M326 67 v-3 M329 67 v-3 M332 67 v-3 M335 67 v-3 M338 67 v-3" stroke="url(#shineWarm)" stroke-width=".5"/>
    <path d="M318.5 64 h23" stroke="url(#shineWarm)" stroke-width=".8"/>
    <path d="M323.6 64 L336.4 64 L335.4 44 L324.6 44Z" fill="none" stroke="url(#shineWarm)" stroke-width=".8"/>
    <g stroke="url(#shineWarm)" stroke-width=".3" opacity=".85"><path d="M324 60h12M324.2 56h11.6M324.4 52h11.2M324.6 48h10.8"/></g>
    ${band(54, 'knot')}
    <path d="M323 44 h14 l-1.5 -2.5 h-11z" fill="none" stroke="url(#shineWarm)" stroke-width=".6"/>
    <path d="M326.8 41.5 L333.2 41.5 L332.4 31 L327.6 31Z" fill="none" stroke="url(#shineWarm)" stroke-width=".6"/>
    <path d="M327.4 31 Q330 22 332.6 31Z" fill="none" stroke="url(#shineWarm)" stroke-width=".6"/>
    <path d="M330 24 v-4" stroke="url(#shineWarm)" stroke-width=".6"/>
    <path d="M326 177 v-9 a4 4 0 0 1 8 0 v9" fill="none" stroke="url(#shineWarm)" stroke-width=".6"/>
  </g>`;
  // Lakes: still water drawn as fine ripples, turquoise into deep blue.
  let ripples = '';
  for (let k = 0; k < 11; k++) {
    const y = 170 + k * 2.9;
    let d = `M150 ${y}`;
    for (let x = 150; x <= 400; x += 10) d += ` Q${x + 5} ${(y - 1.2 + (k % 2) * 0.6).toFixed(1)} ${x + 10} ${y}`;
    ripples += `<path d="${d}" stroke-opacity="${(0.35 + k * 0.07).toFixed(2)}"/>`;
  }
  const lakes = `<g><g fill="none" stroke="url(#shineCool)" stroke-width=".55">${ripples}</g></g>`;
  // Tulips: slender stems and cupped red petals.
  const tulip = (x, y, s, r) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">
      <path d="M0 0 C 1 10, -1 18, 0 28" stroke="url(#shineLeaf)" stroke-width=".7" fill="none"/>
      <path d="M0 18 C -7 14, -9 6, -8 2 C -4 6, -1 11, 0 16Z" fill="none" stroke="url(#shineLeaf)" stroke-width=".55"/>
      <path d="M-5 0 C -6 -6, -4 -11, -1.5 -12 C -1 -8, 0 -6, 0 -4 C 0 -6, 1 -8, 1.5 -12 C 4 -11, 6 -6, 5 0 C 3 3, -3 3, -5 0Z" fill="none" stroke="url(#shineRose)" stroke-width=".7"/>
      <path d="M-3 -1 C -3.5 -5, -2.5 -8, -1 -9 M3 -1 C 3.5 -5, 2.5 -8, 1 -9 M0 -4 V2" fill="none" stroke="url(#shineRose)" stroke-width=".35"/>
    </g>`;
  const tulips = `<g>${tulip(258, 160, 0.95, -8)}${tulip(268, 156, 1.1, 4)}${tulip(279, 161, 0.9, -2)}${tulip(248, 164, 0.8, 9)}${tulip(289, 165, 0.75, 6)}${tulip(372, 158, 0.85, 5)}${tulip(382, 162, 0.7, -6)}</g>`;
  // A paper kite on a long, loose string.
  const kite = `<g>
    <path d="M284 55 C 270 76, 296 92, 280 112 S 262 140, 268 158" fill="none" stroke="url(#shineWarm)" stroke-width=".35" stroke-dasharray="1.5 2"/>
    <polygon points="284,28 296,41 284,55 272,41" fill="none" stroke="url(#shineWarm)" stroke-width=".8"/>
    <polygon points="284,32 292.5,41 284,51 275.5,41" fill="none" stroke="url(#shineRose)" stroke-width=".4"/>
    <path d="M284 28 V55 M272 41 H296" stroke="url(#shineWarm)" stroke-width=".4"/>
    <circle cx="284" cy="41" r="2" fill="none" stroke="url(#shineCool)" stroke-width=".5"/>
    <path d="M284 55 c -4 3 3 6 -1 9 c -4 3 3 6 -1 9" fill="none" stroke="url(#shineRose)" stroke-width=".7"/>
  </g>`;
  // ---- The other designs, in the same fine engraved lines ----
  // A spirograph rosette, the kind printed on banknotes: a small circle rolling inside a big one.
  const rosette = (cx, cy, R, r, d, turns, stroke, width) => {
    let path = '';
    for (let t = 0; t <= Math.PI * 2 * turns; t += 0.04) {
      const x = cx + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
      const y = cy + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
      path += (path ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
  };
  const glintAt = (x, y, k) => `<path class="glint" style="animation-delay:${(k * 0.9).toFixed(1)}s" d="M${x} ${y - 4} L${x + 0.9} ${y - 0.9} L${x + 4} ${y} L${x + 0.9} ${y + 0.9} L${x} ${y + 4} L${x - 0.9} ${y + 0.9} L${x - 4} ${y} L${x - 0.9} ${y - 0.9}Z" fill="#fff8dc"/>`;
  const waterFrom = (y0, rows, gap) => {
    let out = '';
    for (let k = 0; k < rows; k++) {
      const y = y0 + k * gap;
      let d = `M150 ${y}`;
      for (let x = 150; x <= 400; x += 10) d += ` Q${x + 5} ${(y - 1.2 + (k % 2) * 0.6).toFixed(1)} ${x + 10} ${y}`;
      out += `<path d="${d}" stroke-opacity="${(0.3 + k * (0.6 / rows)).toFixed(2)}"/>`;
    }
    return `<g fill="none" stroke="url(#shineCool)" stroke-width=".55">${out}</g>`;
  };
  const sun = (cx, cy) => {
    let r = '';
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8;
      r += `<path d="M${(cx + 15 * Math.cos(a)).toFixed(1)} ${(cy + 15 * Math.sin(a)).toFixed(1)}L${(cx + (k % 2 ? 21 : 25) * Math.cos(a)).toFixed(1)} ${(cy + (k % 2 ? 21 : 25) * Math.sin(a)).toFixed(1)}"/>`;
    }
    return `<g opacity=".6" fill="none" stroke="url(#shineWarm)" stroke-width=".7"><circle cx="${cx}" cy="${cy}" r="12"/><circle cx="${cx}" cy="${cy}" r="8"/>${r}</g>`;
  };
  const pine = (x, y, s) => {
    let tiers = '';
    for (let k = 0; k < 4; k++) tiers += `<path d="M${x - (10 - k * 2) * s} ${y - k * 7 * s} L${x} ${y - (k * 7 + 12) * s} L${x + (10 - k * 2) * s} ${y - k * 7 * s}"/>`;
    return `<g fill="none" stroke="url(#shineLeaf)" stroke-width=".6">${tiers}<path d="M${x} ${y} v${4 * s}"/></g>`;
  };
  function medallion(o) {
    if (o.design === 'classic') return `<g opacity=".55">${rosette(372, 36, 26, 9.5, 11, 19, o.ink, 0.35)}</g>`;
    if (o.design === 'city') return `<g opacity=".6" fill="none" stroke="url(#shineWarm)" stroke-width=".7"><path d="M380 22a14 14 0 1 0 0 26a11 11 0 1 1 0-26z"/><path d="M350 20l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1zM392 56l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></g>`;
    if (o.design === 'botanical') {
      let p = '';
      for (let k = 0; k < 8; k++) p += `<ellipse cx="374" cy="22" rx="4.5" ry="10" transform="rotate(${k * 45} 374 34)"/>`;
      return `<g opacity=".6" fill="none" stroke="url(#shineRose)" stroke-width=".7">${p}<circle cx="374" cy="34" r="4"/></g>`;
    }
    return sun(372, 36);
  }
  function scene(design) {
    if (design === 'classic') {
      let bands = '';
      for (let k = 0; k < 9; k++) {
        let d = `M140 ${150 + k * 5}`;
        for (let x = 140; x <= 400; x += 20) d += ` Q${x + 10} ${150 + k * 5 + (k % 2 ? 6 : -6)} ${x + 20} ${150 + k * 5}`;
        bands += `<path d="${d}"/>`;
      }
      return `<g opacity=".42">${rosette(300, 96, 70, 25, 34, 25, 'url(#shineCool)', 0.4)}${rosette(300, 96, 42, 15, 18, 15, 'url(#shineCool)', 0.3)}<g fill="none" stroke="url(#shineCool)" stroke-width=".45">${bands}</g></g>`;
    }
    if (design === 'mountains') {
      const pines = [[176, 182, 0.9], [192, 186, 1.1], [210, 184, 0.8], [352, 182, 1], [370, 186, 1.2], [388, 183, 0.9], [300, 188, 0.7]].map(([x, y, sc]) => pine(x, y, sc)).join('');
      return `${mountains}${waterFrom(172, 9, 3)}${pines}`;
    }
    if (design === 'seaside') {
      const boat = `<g fill="none" stroke="url(#shineWarm)" stroke-width=".7"><path d="M232 128 h40 l-6 7 h-28z"/><path d="M252 128 V92 L272 126Z M250 128 V98 L236 126Z"/><path d="M252 92 l6 2 -6 2" stroke="url(#shineRose)"/></g>`;
      let stripes = '';
      for (let y = 80; y < 160; y += 16) stripes += `<path d="M${336 + (160 - y) * 0.04} ${y} h${18 - (160 - y) * 0.08}" stroke="url(#shineRose)" stroke-width="3" opacity=".7"/>`;
      const lighthouse = `<g fill="none" stroke="url(#shineWarm)" stroke-width=".7"><path d="M334 160 L338 72 H352 L356 160Z"/>${stripes}<path d="M336 72 h18 M339 72 v-10 h12 v10 M338 62 l7 -6 7 6"/><path d="M351 66 L398 52 M351 66 L398 80" stroke-width=".4" stroke-dasharray="2 2"/><path d="M326 160 h38"/></g>`;
      const gulls = [[210, 60], [226, 52], [300, 40]].map(([x, y]) => `<path d="M${x - 5} ${y} q2.5 -3 5 0 q2.5 -3 5 0" fill="none" stroke="url(#shineCool)" stroke-width=".6"/>`).join('');
      return `${waterFrom(124, 22, 3.4)}${boat}${lighthouse}${gulls}${[[240, 150], [300, 170], [380, 140]].map(([x, y], k) => glintAt(x, y, k)).join('')}`;
    }
    if (design === 'city') {
      const towers = [[150, 22, 52], [174, 16, 80], [192, 26, 60], [220, 18, 96], [240, 30, 70], [272, 14, 110], [288, 24, 84], [314, 20, 64], [336, 26, 100], [364, 18, 74], [384, 16, 58]];
      let out = '';
      towers.forEach(([x, w, ht], k) => {
        const top = 170 - ht;
        let win = '';
        for (let y = top + 6; y < 166; y += 6) win += `<path d="M${x + 3} ${y} h${w - 6}" stroke-dasharray="2 2"/>`;
        out += `<rect x="${x}" y="${top}" width="${w}" height="${ht}"/>${win}${k === 5 ? `<path d="M${x + w / 2} ${top} v-16"/>` : ''}`;
      });
      const bridge = `<g fill="none" stroke="url(#shineWarm)" stroke-width=".6"><path d="M150 176 Q205 150 260 176 Q315 150 370 176"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => `<path d="M${160 + k * 18} 176 v-${(8 + Math.abs(5.5 - k) * 2).toFixed(0)}"/>`).join('')}<path d="M150 176 H400"/></g>`;
      return `<g fill="none" stroke="url(#shineCool)" stroke-width=".55">${out}</g>${bridge}${waterFrom(180, 7, 3)}${towers.filter((_, k) => k % 3 === 2).map(([x, w, ht], k) => glintAt(x + w / 2, 170 - ht, k)).join('')}`;
    }
    // Botanical: arching vines with leaves, tulips and ferns.
    const leafAt = (x, y, r, s) => `<path d="M0 0 C 6 -6, 16 -6, 22 0 C 16 6, 6 6, 0 0Z M0 0 H20" transform="translate(${x} ${y}) rotate(${r}) scale(${s})"/>`;
    const vines = `<g fill="none" stroke="url(#shineLeaf)" stroke-width=".7"><path d="M150 190 C 200 120, 260 170, 300 110 S 380 60, 400 40"/><path d="M220 200 C 250 160, 320 180, 340 140 S 390 110, 400 120"/>${[[180, 156, -40, 0.9], [214, 140, 20, 0.8], [262, 152, -60, 1], [298, 116, -30, 1.1], [330, 86, 10, 0.9], [366, 62, -50, 0.8], [256, 182, 30, 0.8], [318, 166, -20, 0.9], [356, 130, 40, 0.8]].map(([x, y, r, s]) => leafAt(x, y, r, s)).join('')}</g>`;
    const fern = (x, y) => {
      let f = `<path d="M${x} ${y} Q${x + 6} ${y - 30} ${x + 2} ${y - 60}"/>`;
      for (let k = 1; k < 10; k++) f += `<path d="M${x + 3} ${y - k * 6} l${(10 - k) * 1.3} -3 M${x + 3} ${y - k * 6} l-${(10 - k) * 1.3} -3"/>`;
      return `<g fill="none" stroke="url(#shineLeaf)" stroke-width=".5">${f}</g>`;
    };
    const flower = (x, y) => {
      let p = '';
      for (let k = 0; k < 6; k++) p += `<ellipse cx="${x}" cy="${y - 5}" rx="2.4" ry="5" transform="rotate(${k * 60} ${x} ${y})"/>`;
      return `<g fill="none" stroke="url(#shineRose)" stroke-width=".55">${p}<circle cx="${x}" cy="${y}" r="1.6"/></g>`;
    };
    const butterfly = `<g fill="none" stroke="url(#shineWarm)" stroke-width=".6" class="v-kite"><path d="M300 60 c -8 -10 -16 -4 -10 4 c -6 6 2 10 10 2 c 8 8 16 4 10 -2 c 6 -8 -2 -14 -10 -4z"/><path d="M300 56 v10"/></g>`;
    return `${vines}${fern(390, 196)}${fern(170, 200)}${flower(240, 120)}${flower(352, 104)}${flower(282, 168)}${tulip(212, 176, 0.9, -6)}${tulip(226, 172, 1, 4)}${tulip(380, 170, 0.8, 6)}${butterfly}`;
  }
  return `<svg class="v-guilloche" viewBox="0 0 400 200" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
    <defs>
      <pattern id="khatam" width="22" height="22" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="${o.ink}" stroke-width=".55">${star8(11, 11, 6.6)}<path d="M0 11h4.4M17.6 11H22M11 0v4.4M11 17.6V22"/></g>
        <circle cx="11" cy="11" r="1.4" fill="${o.accent}" fill-opacity=".5"/>
      </pattern>
      ${o.original ? `<linearGradient id="shineWarm" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="160" y2="60" spreadMethod="reflect"><stop offset="0" stop-color="#9a6a2a"/><stop offset=".3" stop-color="#e2b04a"/><stop offset=".45" stop-color="#fff2c4"/><stop offset=".6" stop-color="#c77a5a"/><stop offset=".8" stop-color="#7a5aa8"/><stop offset="1" stop-color="#9a6a2a"/><animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="320 120" dur="9s" repeatCount="indefinite"/></linearGradient>` : shine('shineWarm', o)}
      ${o.original ? `<linearGradient id="shineCool" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="180" y2="40" spreadMethod="reflect"><stop offset="0" stop-color="#2a4b8d"/><stop offset=".3" stop-color="#2aa3b0"/><stop offset=".45" stop-color="#e6fbff"/><stop offset=".6" stop-color="#7a6ad0"/><stop offset=".8" stop-color="#2f7fbf"/><stop offset="1" stop-color="#2a4b8d"/><animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="360 80" dur="11s" repeatCount="indefinite"/></linearGradient>` : shine('shineCool', o)}
      ${o.original ? `<linearGradient id="shineRose" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="60" y2="40" spreadMethod="reflect"><stop offset="0" stop-color="#8e1430"/><stop offset=".45" stop-color="#ff9aa8"/><stop offset=".6" stop-color="#e2b04a"/><stop offset="1" stop-color="#a8324a"/><animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="120 80" dur="7s" repeatCount="indefinite"/></linearGradient>` : shine('shineRose', o)}
      ${o.original ? `<linearGradient id="shineLeaf" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="60" y2="40" spreadMethod="reflect"><stop offset="0" stop-color="#2f5f2e"/><stop offset=".5" stop-color="#a8e09a"/><stop offset="1" stop-color="#3d6b3a"/><animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="120 80" dur="8s" repeatCount="indefinite"/></linearGradient>` : shine('shineLeaf', o)}
      <linearGradient id="brickWash" x1="0" x2="1"><stop offset="0" stop-color="#ead6b2"/><stop offset=".55" stop-color="#d9b88a"/><stop offset="1" stop-color="#b48a5c"/></linearGradient>
      <linearGradient id="skyFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfdcee"/><stop offset="1" stop-color="#cfdcee" stop-opacity="0"/></linearGradient>
      <linearGradient id="rangeMid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9bcd8"/><stop offset="1" stop-color="#e7ecf2" stop-opacity=".2"/></linearGradient>
      <linearGradient id="rangeNear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8aa2c4"/><stop offset="1" stop-color="#dfe7ee" stop-opacity=".3"/></linearGradient>
      <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cc8cf"/><stop offset=".5" stop-color="#2690b0"/><stop offset="1" stop-color="#1b4f8a"/></linearGradient>
      <linearGradient id="petal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2475c"/><stop offset="1" stop-color="#8e1430"/></linearGradient>
      <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fa35f"/><stop offset="1" stop-color="#2f5f2e"/></linearGradient>
      <linearGradient id="kiteA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2c45a"/><stop offset="1" stop-color="#d0901e"/></linearGradient>
      <linearGradient id="rainbow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e7b0"/><stop offset=".55" stop-color="#eef0e8"/><stop offset="1" stop-color="#cfe0f2"/></linearGradient>
      <linearGradient id="fadeL" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".28" stop-color="#fff" stop-opacity=".25"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff"/></linearGradient>
      <pattern id="fineWaves" width="40" height="8" patternUnits="userSpaceOnUse"><path d="M0 4 Q10 0 20 4 T40 4" fill="none" stroke="${o.ink}" stroke-width=".5"/></pattern>
      <mask id="sceneMask"><rect width="400" height="200" fill="url(#fadeL)"/></mask>
    </defs>
    <rect width="400" height="200" fill="url(#rainbow)" opacity=".7"/>
    ${o.design === 'central' ? '<rect width="400" height="200" fill="url(#khatam)" opacity=".08"/>' : '<rect width="400" height="200" fill="url(#fineWaves)" opacity=".16"/>'}
    ${o.design === 'central' ? `<g opacity=".5"><g fill="none" stroke="${SAFFRON}" stroke-width=".55">${petals}</g><g fill="none" stroke="${SAFFRON}" stroke-width=".6"><circle cx="374" cy="34" r="15"/>${rays}${star8(374, 34, 7)}</g></g>` : medallion(o)}
    <g class="v-scene" mask="url(#sceneMask)" opacity=".9">${o.picture ? `<image href="${o.picture}" x="0" y="0" width="400" height="200" preserveAspectRatio="xMaxYMid slice" opacity=".9"/>` : o.design === 'central' ? `${mountains}${lakes}${minaret}<g class="v-kite">${kite}</g>${tulips}` : scene(o.design)}</g>
    ${o.design === 'central' ? `<g fill="none" stroke="${o.highlight}" stroke-width=".9" opacity=".5">${corners}</g>` : ''}
  </svg>`;
}

// A strip of kilim carpet: octagonal gul medallions on pomegranate red.
const KILIM_ORIGINAL = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='28' height='12'><rect width='28' height='12' fill='#8e2633'/><path d='M0 0h28M0 12h28' stroke='#e9d8b4' stroke-width='1.4'/><polygon points='9,2 19,2 23,6 19,10 9,10 5,6' fill='#1f2f5c'/><polygon points='14,3.2 17,6 14,8.8 11,6' fill='#e9d8b4'/><circle cx='14' cy='6' r='1' fill='#c98a1c'/><path d='M0 6l2.5-2.5L5 6 2.5 8.5zM23 6l2.5-2.5L28 6l-2.5 2.5z' fill='#c98a1c'/></svg>`)}")`;

const EMBLEM_ORIGINAL = `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="#2a6f63" stroke-width="1.3"><circle cx="32" cy="32" r="20"/><ellipse cx="32" cy="32" rx="9" ry="20"/><ellipse cx="32" cy="32" rx="16" ry="20"/><path d="M32 12v40M12.5 26h39M12.5 38h39M16 19h32M16 45h32" stroke-width=".9"/></g><ellipse cx="32" cy="32" rx="29" ry="10" transform="rotate(-22 32 32)" fill="none" stroke="#b03a2e" stroke-width="1.2" stroke-dasharray="3 2.4"/><path d="M53.5 20.5l3.2-1.6-1 3.4 1.9 1.4-2.4.2-1 2.2-.4-2.6-2.6-1z" fill="#b03a2e"/><g fill="#2a6f63" font-family="Oswald, sans-serif" font-size="5" letter-spacing="1" text-anchor="middle"><text x="32" y="61">✦ MUNDUS ✦</text></g></svg>`;

// The round "valid" stamp pressed half across the visa.
function validStamp() {
  const ring = 'VALID · VALABLE · GÜLTIG · VÁLIDO · ДЕЙСТВИТЕЛЕН · صالح · ';
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><g filter="url(#ink2)" fill="none" stroke="#5b3a8c"><circle cx="50" cy="50" r="46" stroke-width="2.6"/><circle cx="50" cy="50" r="33" stroke-width="1.4"/></g><defs><path id="vring" d="M50 50m-39.5 0a39.5 39.5 0 1 1 79 0a39.5 39.5 0 1 1-79 0"/></defs><g filter="url(#ink2)" fill="#5b3a8c" font-family="Oswald, sans-serif"><text font-size="7.4" letter-spacing=".6"><textPath href="#vring">${ring}</textPath></text><path d="M50 30l2.2 6.5 9.8 4.2-9.8 1.4-1.6 7.4 3.4 2.5h-8l3.4-2.5-1.6-7.4-9.8-1.4 9.8-4.2z" transform="rotate(45 50 41)"/><text x="50" y="62" font-size="9" font-weight="700" text-anchor="middle" letter-spacing="1">MULTIPLE</text><text x="50" y="71" font-size="6.5" text-anchor="middle" letter-spacing="1.4">ENTRIES · ENTRÉES</text></g></svg>`;
}

// The machine-readable lines at the bottom of a real visa, made from the travel numbers.
// UTO is the made-up country the passport standard uses for its own examples.
function mrz(stats, owner) {
  const fill = (str) => (str + '<'.repeat(44)).slice(0, 44);
  const name = (owner || 'TRAVELLER').toUpperCase().normalize('NFKD').replace(/[^A-Z]+/g, '<').replace(/^<|<$/g, '') || 'TRAVELLER';
  const n = (v) => (v == null ? '' : String(Math.round(v)));
  const line1 = fill(`V<UTO${name}<<FLIGHT<LOG`);
  const line2 = fill(`${String(stats.flights ?? 0).padStart(9, '0')}<UTO${n(stats.distance_km)}KM<${n(stats.hours) && n(stats.hours) + 'H<'}${n(stats.airports)}APT<${n(stats.countries)}CTY`);
  return [line1, line2];
}

// ---- Designs you can swap (passport.md) ----
// Each design brings its own colours, strip and emblem; any of them can be changed.
export const VISA_DESIGNS = {
  central: { name: 'Central Asian (the original)', ink: '#2a4b8d', accent: '#1f8f8a', highlight: '#a8324a', strip: 'kilim', emblem: 'globe' },
  classic: { name: 'Classic', ink: '#1d6a5c', accent: '#3f6b62', highlight: '#b3261e', strip: 'none', emblem: 'globe' },
  mountains: { name: 'Mountains and pines', ink: '#2c4a6e', accent: '#4f7f5a', highlight: '#c2582a', strip: 'checks', emblem: 'compass' },
  seaside: { name: 'Seaside', ink: '#1f5f8a', accent: '#2aa3b0', highlight: '#e07a3a', strip: 'waves', emblem: 'compass' },
  city: { name: 'City lights', ink: '#33365a', accent: '#7a6ad0', highlight: '#d4a23a', strip: 'stripes', emblem: 'plane' },
  botanical: { name: 'Botanical', ink: '#3d6b3a', accent: '#8fb05a', highlight: '#c8506a', strip: 'stripes', emblem: 'leaf' }
};
export const VISA_STRIPS = { kilim: 'Woven carpet', waves: 'Waves', checks: 'Checks', stripes: 'Stripes', none: 'No strip' };
export const VISA_EMBLEMS = { globe: 'Globe', compass: 'Compass', star: 'Star', plane: 'Aeroplane', leaf: 'Leaf', none: 'No emblem' };

// Everything the visa needs, from passport.md's settings (any of which may be missing).
export function visaLook(p = {}) {
  const design = VISA_DESIGNS[p.design] ? p.design : 'central';
  const base = VISA_DESIGNS[design];
  const o = {
    design,
    ink: p.ink || base.ink,
    accent: p.accent || base.accent,
    highlight: p.highlight || base.highlight,
    strip: VISA_STRIPS[p.strip] ? p.strip : base.strip,
    emblem: VISA_EMBLEMS[p.emblem] ? p.emblem : base.emblem,
    words: p.words?.length ? p.words : null,
    picture: p.pictureUrl || (p.picture ? '/media/' + p.picture.split('/').map(encodeURIComponent).join('/') : '')
  };
  // The original, exactly as it was drawn, when nothing about it has been changed.
  o.original = design === 'central' && !p.ink && !p.accent && !p.highlight;
  return o;
}

// The shimmering inks of the engraving, mixed from the design's colours.
function shine(id, o) {
  const stops = {
    shineWarm: ['#9a6a2a', '#e2b04a', '#fff2c4', o.highlight, o.accent, '#9a6a2a'],
    shineCool: [o.ink, o.accent, '#eefbff', o.highlight, o.accent, o.ink],
    shineRose: [o.highlight, '#ffd0d8', '#e2b04a', o.highlight],
    shineLeaf: [o.ink, '#cdeec0', o.accent]
  }[id];
  const size = { shineWarm: [160, 60, '320 120', 9], shineCool: [180, 40, '360 80', 11], shineRose: [60, 40, '120 80', 7], shineLeaf: [60, 40, '120 80', 8] }[id];
  const st = stops.map((c, k) => `<stop offset="${(k / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${size[0]}" y2="${size[1]}" spreadMethod="reflect">${st}<animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="${size[2]}" dur="${size[3]}s" repeatCount="indefinite"/></linearGradient>`;
}

const dataUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const LIGHT = '#f3ead6';
// The strip along the foot of the visa (28 × 12 tiles).
function stripFor(o) {
  if (o.strip === 'none') return '';
  if (o.strip === 'kilim' && o.original) return KILIM_ORIGINAL;
  const svg = {
    kilim: `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='12'><rect width='28' height='12' fill='${o.highlight}'/><path d='M0 0h28M0 12h28' stroke='#e9d8b4' stroke-width='1.4'/><polygon points='9,2 19,2 23,6 19,10 9,10 5,6' fill='${o.ink}'/><polygon points='14,3.2 17,6 14,8.8 11,6' fill='#e9d8b4'/><circle cx='14' cy='6' r='1' fill='${o.accent}'/><path d='M0 6l2.5-2.5L5 6 2.5 8.5zM23 6l2.5-2.5L28 6l-2.5 2.5z' fill='${o.accent}'/></svg>`,
    waves: `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='12'><rect width='28' height='12' fill='${o.ink}'/><path d='M0 7 Q7 1 14 7 T28 7' fill='none' stroke='${o.accent}' stroke-width='2'/><path d='M0 11 Q7 5 14 11 T28 11' fill='none' stroke='${LIGHT}' stroke-width='1' opacity='.6'/></svg>`,
    checks: `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='12'><rect width='28' height='12' fill='${o.ink}'/><path d='M0 0h7v6H0zM14 0h7v6h-7zM7 6h7v6H7zM21 6h7v6h-7z' fill='${o.accent}' opacity='.85'/><path d='M0 3h28M0 9h28' stroke='${o.highlight}' stroke-width='.8' opacity='.8'/></svg>`,
    stripes: `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='12'><rect width='28' height='12' fill='${o.highlight}'/><path d='M-4 16L12 -4M10 16L26 -4M24 16L40 -4' stroke='${o.ink}' stroke-width='4'/><path d='M3 16L19 -4M17 16L33 -4' stroke='${LIGHT}' stroke-width='1.2' opacity='.7'/></svg>`
  }[o.strip];
  return dataUrl(svg);
}
// The tiled frame round the original design, and the tiles behind its emblem.
const frameTile = (o) => dataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18'><rect width='18' height='18' fill='${o.ink}'/><rect x='6' y='6' width='6' height='6' fill='${o.accent}'/><path d='M3 1.2l.9 1.9 1.9.9-1.9.9L3 6.8l-.9-1.9L.2 4l1.9-.9zM15 1.2l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9zM3 11.2l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9zM15 11.2l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9z' fill='${LIGHT}'/><circle cx='9' cy='9' r='1.2' fill='#c98a1c'/></svg>`);
const emblemTile = (o) => dataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><rect width='10' height='10' fill='${o.accent}'/><path d='M5 1l1.2 2.8L9 5 6.2 6.2 5 9 3.8 6.2 1 5l2.8-1.2z' fill='${LIGHT}'/></svg>`);

// The emblem in the box beside the fields.
function emblemFor(o) {
  if (o.emblem === 'none') return '';
  if (o.emblem === 'globe' && o.original) return EMBLEM_ORIGINAL;
  const motto = (word) => `<g fill="${o.ink}" font-family="Oswald, sans-serif" font-size="5" letter-spacing="1" text-anchor="middle"><text x="32" y="61">✦ ${word} ✦</text></g>`;
  const art = {
    globe: `<g fill="none" stroke="${o.ink}" stroke-width="1.3"><circle cx="32" cy="32" r="20"/><ellipse cx="32" cy="32" rx="9" ry="20"/><ellipse cx="32" cy="32" rx="16" ry="20"/><path d="M32 12v40M12.5 26h39M12.5 38h39M16 19h32M16 45h32" stroke-width=".9"/></g><ellipse cx="32" cy="32" rx="29" ry="10" transform="rotate(-22 32 32)" fill="none" stroke="${o.highlight}" stroke-width="1.2" stroke-dasharray="3 2.4"/><path d="M53.5 20.5l3.2-1.6-1 3.4 1.9 1.4-2.4.2-1 2.2-.4-2.6-2.6-1z" fill="${o.highlight}"/>${motto('MUNDUS')}`,
    compass: `<g fill="none" stroke="${o.ink}" stroke-width="1.1"><circle cx="32" cy="30" r="22"/><circle cx="32" cy="30" r="17" stroke-dasharray="1 2"/></g><path d="M32 8 L36 30 L32 52 L28 30Z" fill="${o.ink}" opacity=".85"/><path d="M32 8 L36 30 L28 30Z" fill="${o.highlight}"/><path d="M10 30 L32 26 L54 30 L32 34Z" fill="none" stroke="${o.accent}" stroke-width="1"/><g fill="${o.ink}" font-family="Oswald, sans-serif" font-size="5" text-anchor="middle"><text x="32" y="6.5">N</text></g>${motto('ITER')}`,
    star: `<g fill="none" stroke="${o.ink}" stroke-width="1"><circle cx="32" cy="30" r="22"/></g><path d="M32 10l5.9 12.6 13.8 1.6-10.2 9.4 2.7 13.6L32 40.4l-12.2 6.8 2.7-13.6-10.2-9.4 13.8-1.6z" fill="none" stroke="${o.ink}" stroke-width="1.2"/><path d="M32 18l3.5 7.5 8.2.9-6.1 5.6 1.6 8.1L32 36l-7.2 4.1 1.6-8.1-6.1-5.6 8.2-.9z" fill="${o.highlight}" opacity=".8"/>${motto('ASTRA')}`,
    plane: `<g fill="none" stroke="${o.ink}" stroke-width="1"><circle cx="32" cy="30" r="22"/><path d="M14 44 Q32 52 50 44" stroke-dasharray="2 2" stroke="${o.accent}"/></g><path d="M32 12c2 0 3 2 3 5v9l15 8v4l-15-4v8l5 4v3l-8-2-8 2v-3l5-4v-8l-15 4v-4l15-8v-9c0-3 1-5 3-5z" fill="${o.ink}"/><circle cx="32" cy="24" r="1.4" fill="${o.highlight}"/>${motto('AERO')}`,
    leaf: `<g fill="none" stroke="${o.ink}" stroke-width="1"><circle cx="32" cy="30" r="22"/></g><path d="M32 50 C 14 38, 16 18, 32 10 C 48 18, 50 38, 32 50Z" fill="${o.accent}" opacity=".55" stroke="${o.ink}" stroke-width="1.1"/><path d="M32 50 V14 M32 22 l-7 -4 M32 30 l-9 -5 M32 38 l-8 -5 M32 26 l7 -4 M32 34 l9 -5 M32 42 l7 -4" fill="none" stroke="${o.ink}" stroke-width=".8"/>${motto('FLORA')}`
  }[o.emblem];
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${art}</svg>`;
}

// Gives every id inside a drawing its own suffix, so several visas can share a page.
const ownIds = (svg, uid) => (uid ? svg.replace(/id="([\w-]+)"/g, `id="$1-${uid}"`).replace(/url\(#([\w-]+)\)/g, `url(#$1-${uid})`) : svg);

// stats: the travel numbers; owner: the name on the passport; passport: passport.md's
// settings; uid: only needed when more than one visa is on a page (the back office previews).
export function visaCard(stats, owner, passport, uid = '') {
  const o = visaLook(passport || {});
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('lite');
  const art = ownIds(guilloche(o), uid);
  const field = (en, fr, value, wide) => (value == null || value === '' ? null : h('span', { class: 'v-field' + (wide ? ' wide' : '') }, h('i', null, en, h('em', null, ' / ' + fr)), h('b', null, value)));
  const km = stats.distance_km != null ? Number(stats.distance_km) : null;
  const laps = km ? (km / 40075).toFixed(1) : null;
  const [l1, l2] = mrz(stats, owner);
  const emblem = emblemFor(o);
  const strip = stripFor(o);
  const style = { '--v-ink': o.ink, '--v-accent': o.accent, '--v-hi': o.highlight };
  if (o.design === 'central') Object.assign(style, { '--v-frame': frameTile(o), '--v-emblem-bg': emblemTile(o) });
  const card = h(
    'div',
    { class: 'visa' + (strip ? '' : ' no-strip'), 'data-design': o.design, style },
    h('span', { class: 'v-bg', html: still ? art.replace(/<animateTransform[^>]*\/>/g, '') : art }),
    h(
      'div',
      { class: 'visa-main' },
      h(
        'div',
        { class: 'visa-top' },
        h('span', { class: 'visa-word' }, 'VISA'),
        h('span', { class: 'v-world', lang: 'mul' }, wordList(o.words || VISA_WORLD)),
        h('span', { class: 'v-serial' }, '№ ' + String(stats.flights ?? 0).padStart(7, '0'))
      ),
      h(
        'div',
        { class: 'v-body' },
        emblem ? h('span', { class: 'v-emblem', html: emblem }) : null,
        h(
          'div',
          { class: 'visa-fields' },
          field('TYPE', 'TYPE', 'FLIGHT LOG'),
          field('ENTRIES', 'ENTRÉES', stats.flights != null ? `${stats.flights} FLIGHTS` : null),
          field('DISTANCE', 'DISTANCE', km != null ? km.toLocaleString('en-GB') + ' KM' : null),
          field('HOURS ALOFT', 'HEURES', stats.hours != null ? `${stats.hours} H` : null),
          field('AIRPORTS', 'AÉROPORTS', stats.airports != null ? String(stats.airports) : null),
          field('COUNTRIES', 'PAYS', stats.countries != null ? String(stats.countries) : null),
          field('HOLDER', 'TITULAIRE', owner ? owner.toUpperCase() : null),
          field('REMARKS', 'OBSERVATIONS', laps ? `${laps}× AROUND THE EARTH` : null, true)
        )
      ),
      h('div', { class: 'v-mrz', 'aria-hidden': 'true' }, h('span', null, l1), h('span', null, l2)),
      h('a', { class: 'visa-link', href: '#/stats' }, 'Open travel stats ›')
    ),
    h('span', { class: 'holo', 'aria-hidden': 'true' }),
    strip ? h('span', { class: 'v-kilim', 'aria-hidden': 'true', style: { '--kilim': strip } }) : null
  );
  // The shimmer only runs while the visa is on screen; scrolled away, it rests.
  if ('IntersectionObserver' in window) {
    const svgs = () => card.querySelectorAll('svg');
    const io = new IntersectionObserver((entries) => {
      if (!card.isConnected) return io.disconnect();
      const on = entries[entries.length - 1].isIntersecting;
      card.classList.toggle('v-off', !on);
      svgs().forEach((s) => (on ? s.unpauseAnimations?.() : s.pauseAnimations?.()));
    });
    io.observe(card);
  }
  return h('div', { class: 'visa-wrap' }, card, h('span', { class: 'v-stamp', html: validStamp() }));
}
