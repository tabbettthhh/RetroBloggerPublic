// Decorating your plot in the village: the things you can put out (all drawn here, the site's
// own), where they stand, and the editor (signed in, on your own island): pick a thing from the
// tray, drag it where you like, tap × to take it away, Save. It's kept in village.md, and your
// friends see it round your house on their islands too.
import { h } from './util.js';

const SVG = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, String(v));
  for (const k of kids.flat(Infinity)) if (k) e.append(k);
  return e;
};
const K = 'nb-k';
const p = (d, fill, sw = 2.5) => svg('path', { d, fill, class: K, 'stroke-width': sw });
const c = (cx, cy, r, fill, sw = 2.5) => svg('circle', { cx, cy, r, fill, class: K, 'stroke-width': sw });
const line = (d, sw = 2.5) => svg('path', { d, fill: 'none', class: K, 'stroke-width': sw });

// Each thing: its name, its size (feet at the bottom middle), and its drawing.
export const ITEMS = {
  bench: ['A bench', 70, 40, () => [p('M6 20h58v6H6Z', '#b07a45'), p('M8 10h54v6H8Z', '#b07a45'), line('M12 26v12M58 26v12M14 16v4M56 16v4')]],
  fountain: ['A fountain', 70, 66, () => [svg('ellipse', { cx: 35, cy: 54, rx: 32, ry: 10, fill: '#cfd6e0', class: K, 'stroke-width': 2.5 }), svg('ellipse', { cx: 35, cy: 52, rx: 24, ry: 6, fill: '#7fd6ff' }), p('M30 52V28h10v24Z', '#cfd6e0'), svg('ellipse', { cx: 35, cy: 28, rx: 14, ry: 5, fill: '#cfd6e0', class: K, 'stroke-width': 2.5 }), svg('path', { d: 'M35 24q-2-12-12-6M35 24q2-12 12-6M35 24V8', fill: 'none', stroke: '#7fd6ff', 'stroke-width': 3, 'stroke-linecap': 'round', class: 'vl-spray' })]],
  flowerbed: ['A flower bed', 70, 30, () => [svg('ellipse', { cx: 35, cy: 22, rx: 32, ry: 8, fill: '#8a5a34', class: K, 'stroke-width': 2.5 }), [10, 22, 35, 48, 60].map((x, i) => [line(`M${x} 22v-8`, 2), c(x, 12, 4.5, ['#ff5d8f', '#ffd23f', '#b79bff', '#ff7069', '#fff'][i], 1.5)])]],
  hammock: ['A hammock', 90, 56, () => [line('M8 54V8M82 54V8', 4), p('M8 18q37 40 74 0q-37 26-74 0Z', '#ff9a1f', 2)]],
  kennel: ['A kennel', 54, 50, () => [p('M6 48V22L27 6l21 16v26Z', '#c2553f'), p('M18 48V32q9-8 18 0v16Z', '#3a2410', 2)]],
  birdbath: ['A bird bath', 44, 50, () => [p('M4 16q18 10 36 0Z', '#cfd6e0'), p('M18 20h8v24h-8Z', '#cfd6e0'), p('M10 48h24v-4H10Z', '#cfd6e0'), c(30, 8, 5, '#ffd23f', 2)]],
  lantern: ['A lantern', 26, 66, () => [line('M13 64V20', 3), p('M5 6h16l-2 14H7Z', '#ffd23f'), svg('circle', { cx: 13, cy: 13, r: 12, class: 'nb-glow' })]],
  swing: ['A swing', 64, 66, () => [line('M6 64L14 4h36l8 60M14 4h36', 3.5), line('M24 4v38M40 4v38', 1.5), p('M20 42h24v5H20Z', '#ff5d8f', 2)]],
  beehive: ['A beehive', 40, 50, () => [p('M6 46h28V40Q34 8 20 6Q6 8 6 40Z', '#ffd23f'), line('M8 18h24M6 28h28M6 38h28', 2), p('M16 46v-8h8v8', '#3a2410', 2)]],
  scarecrow: ['A scarecrow', 56, 72, () => [line('M28 70V20M8 32h40', 3.5), c(28, 14, 8, '#f3d9a4'), p('M16 10h24l-5-8H21Z', '#b07a45', 2), p('M18 28h20v20H18Z', '#4fbf3c', 2)]],
  pumpkins: ['Pumpkins', 60, 34, () => [svg('ellipse', { cx: 20, cy: 22, rx: 16, ry: 11, fill: '#ff9a1f', class: K, 'stroke-width': 2.5 }), svg('ellipse', { cx: 44, cy: 25, rx: 11, ry: 8, fill: '#ff9a1f', class: K, 'stroke-width': 2.5 }), line('M20 11V5M44 17v-5', 3)]],
  washing: ['A washing line', 90, 54, () => [line('M6 52V6M84 52V6', 3.5), line('M6 10q39 10 78 0', 1.5), p('M18 12h14v16H18Z', '#6cb6ff', 2), p('M38 14h12v20H38Z', '#ff5d8f', 2), p('M56 13h16v12H56Z', '#ffd23f', 2)]],
  picnic: ['A picnic', 74, 30, () => [p('M4 26l12-16h50l4 16Z', '#ff7069'), line('M14 14l52 0M10 20h58', 1.5), p('M30 12h14l-2-8H32Z', '#b07a45', 2)]],
  telescope: ['A telescope', 50, 60, () => [line('M25 58l-12-0M25 34l-10 24M25 34l10 24M25 34v24', 2.5), p('M8 30l30-22 6 8-30 22Z', '#2a5fb0')]],
  bike: ['A bike', 70, 40, () => [c(16, 26, 12, 'none', 3), c(54, 26, 12, 'none', 3), line('M16 26l14-14h16l8 14M30 12l8 14h-22M46 12l-2-6h-6', 3)]],
  snowman: ['A snowman', 44, 64, () => [c(22, 46, 16, '#fff'), c(22, 20, 11, '#fff'), p('M22 20l10 3-10 1Z', '#ff9a1f', 1.5), p('M12 10h20v-4H12ZM15 6V0h14v6', '#3a2410', 2)]],
  mushrooms: ['Mushrooms', 50, 34, () => [p('M12 32V20h6v12Z', '#fff6dc', 2), p('M2 20q13-18 26 0Z', '#ff4d6d'), p('M34 32V24h5v8Z', '#fff6dc', 2), p('M27 24q9-12 19 0Z', '#ff4d6d'), c(10, 14, 2, '#fff', 0), c(36, 19, 1.6, '#fff', 0)]],
  well: ['A wishing well', 60, 70, () => [p('M8 66V40h44v26Z', '#cfd6e0'), line('M14 40V12M46 40V12', 3.5), p('M4 14L30 2l26 12Z', '#c2553f'), line('M30 14v18', 1.5), p('M26 30h8v6h-8Z', '#b07a45', 1.5)]]
};
export const ITEM_IDS = Object.keys(ITEMS);
const REACH = { x: 360, up: 230, down: 170 };
const MAX = 20;
// Where new things land, nearest your door first.
const DROPS = [[-130, 40], [130, 40], [-60, 110], [60, 110], [-210, 0], [210, 0], [-170, 110], [170, 110], [0, 150], [-260, 70], [260, 70], [-110, -120], [130, -120], [-280, -60], [280, -60], [-200, 150], [200, 150], [-320, 20], [320, 20], [0, -190]];

// One thing, standing with its feet at (fx + x, fy + y).
export function decorEl(id, fx, fy, x, y, scale = 1) {
  const it = ITEMS[id];
  if (!it) return null;
  const [name, w, hh, draw] = it;
  const el = h('span', { class: 'vl-decor', 'data-id': id, title: name, style: `left:${fx + x - (w * scale) / 2}px; top:${fy + y - hh * scale}px; width:${w * scale}px; height:${hh * scale}px` }, svg('svg', { viewBox: `0 0 ${w} ${hh}`, width: w * scale, height: hh * scale, 'aria-hidden': 'true' }, draw()));
  el.dataset.x = x;
  el.dataset.y = y;
  return el;
}

// The editor: a tray of things, drag to place, × to remove, Save or Cancel.
export function decorEditor({ layer, feet, items, scale, save, onDone }) {
  let work = items.map((it) => ({ ...it }));
  const place = () => {
    layer.replaceChildren(...work.map((it, i) => editable(it, i)));
  };
  const editable = (it, i) => {
    const el = decorEl(it.id, feet.x, feet.y, it.x, it.y);
    el.classList.add('vl-editing');
    const x = h('button', { type: 'button', class: 'vl-decor-x', 'aria-label': `Take away ${ITEMS[it.id][0].toLowerCase()}` }, '×');
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      work.splice(i, 1);
      place();
      count();
    });
    el.append(x);
    // (Dragged about with a finger or the mouse; the village doesn't pan while you do.)
    el.addEventListener('pointerdown', (e) => {
      if (e.target === x) return;
      e.stopPropagation();
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      const start = [e.clientX, e.clientY, it.x, it.y];
      const move = (ev) => {
        const s = scale();
        it.x = Math.round(Math.max(-REACH.x, Math.min(REACH.x, start[2] + (ev.clientX - start[0]) / s)));
        it.y = Math.round(Math.max(-REACH.up, Math.min(REACH.down, start[3] + (ev.clientY - start[1]) / s)));
        const [, w, hh] = ITEMS[it.id];
        el.style.left = `${feet.x + it.x - w / 2}px`;
        el.style.top = `${feet.y + it.y - hh}px`;
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    return el;
  };
  const left = h('span', { class: 'vl-tray-count' });
  const count = () => (left.textContent = `${work.length} of ${MAX}`);
  const tray = h(
    'div',
    { class: 'vl-tray', role: 'toolbar', 'aria-label': 'Things to put on your plot' },
    h('div', { class: 'vl-tray-things' }, ITEM_IDS.map((id) => {
      const [name, w, hh, draw] = ITEMS[id];
      return h('button', { type: 'button', class: 'vl-tray-btn', title: name, 'aria-label': `Put out ${name.toLowerCase()}`, onclick: () => {
        if (work.length >= MAX) return;
        // (It lands on a free bit of your plot, round your house, ready to be dragged.)
        const free = DROPS.find(([dx, dy]) => work.every((w) => Math.hypot(w.x - dx, w.y - dy) > 55)) || DROPS[work.length % DROPS.length];
        work.push({ id, x: free[0], y: free[1] });
        place();
        count();
      } }, svg('svg', { viewBox: `0 0 ${w} ${hh}`, 'aria-hidden': 'true' }, draw()));
    })),
    h('div', { class: 'vl-tray-end' }, left, h('button', { type: 'button', class: 'vl-go vl-cancel', onclick: () => onDone(null) }, 'Cancel'), h('button', { type: 'button', class: 'vl-go', onclick: async (e) => {
      e.currentTarget.disabled = true;
      const kept = await save(work).catch(() => null);
      onDone(kept);
    } }, 'Save'))
  );
  place();
  count();
  return tray;
}
