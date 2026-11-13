// The village: the neighbourhood opened out, full screen, like a little island town seen from
// above. (Fetched only the first time it's opened; everything that moves is CSS, and it all holds
// still in a hidden tab.) Your house stands on the green in the middle; every friend's house sits round the ring
// road (two rings when there are many), with trees, a pond, flower beds, a bandstand, fences and
// a car or two going round. Drag to look about, pinch or scroll (or + and −) to zoom, Escape or ✕
// to close. The same houses as the street (lights, smoke, mail, statuses, knockers), the same
// season or festive day, the same theme. Nothing on it that the street doesn't show.
import { h } from './util.js';
import { sound } from './sound.js';
import { decorEl, decorEditor } from './village-decor.js';

const SVG = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, String(v));
  for (const k of kids.flat(Infinity)) if (k) e.append(k);
  return e;
};
// A little random that's the same every time for the same village (so trees don't move about).
function seeded(seed) {
  let a = [...String(seed)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 2166136261);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ellipsePath = (cx, cy, rx, ry) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0`;

// opts: { title, seed, houses: [{ el }], me: el | null, dress, night, dusk, festive vars }
export function openVillage({ ctx, home, title, seed, houses, me, dress, night, dusk, festive }) {
  document.querySelector('.vl')?.remove();
  const n = houses.length;
  const twoRings = n > 10;
  const W = twoRings ? 2200 : 1700;
  const H = twoRings ? 1600 : 1240;
  const cx = W / 2;
  const cy = H / 2 + 20;
  const rand = seeded(seed || title);
  const k = 'nb-k';

  // Where everything goes: rings of plots round the middle.
  const rings = twoRings ? [{ rx: 470, ry: 300, count: Math.min(10, Math.ceil(n / 2.4)) }, { rx: 820, ry: 560 }] : [{ rx: 500, ry: 330, count: n }];
  if (twoRings) rings[1].count = n - rings[0].count;
  const spots = [];
  rings.forEach((r, ri) => {
    for (let i = 0; i < r.count; i++) {
      // (Starting at the top, round clockwise, a little off the four paths in.)
      let a = -Math.PI / 2 + ((i + 0.5) / r.count) * Math.PI * 2 + (ri ? 0.12 : 0);
      // (Never on one of the four roads in.)
      const off = Math.atan2(Math.sin(a * 4), Math.cos(a * 4)) / 4;
      if (Math.abs(off) < 0.3) a += (off < 0 ? -1 : 1) * (0.3 - Math.abs(off));
      spots.push({ x: cx + Math.cos(a) * (r.rx + 95), y: cy + Math.sin(a) * (r.ry + 70), ring: ri });
    }
  });
  const roads = rings.map((r) => ({ rx: r.rx, ry: r.ry }));
  const outer = roads[roads.length - 1];

  // ---------- the ground: an island in the sea, roads, the green, a pond ----------
  const islandRx = outer.rx + 330;
  const islandRy = outer.ry + 270;
  // (The pond goes in whichever corner is furthest from anyone's house.)
  const pond = [[-0.62, -0.5], [0.62, -0.5], [-0.62, 0.45], [0.62, 0.45]]
    .map(([fx, fy]) => ({ x: cx + islandRx * fx, y: cy + islandRy * fy, rx: 120, ry: 70 }))
    .map((p) => ({ ...p, room: Math.min(...spots.map((s) => Math.hypot(s.x - p.x, s.y - 80 - p.y)), 1e9) }))
    .sort((a, b) => b.room - a.room)[0];
  const blob = (rx, ry, wob) => {
    const pts = Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2;
      const r = 1 + (rand() - 0.5) * wob;
      return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
    });
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[(i + 1) % pts.length];
      const [x0, y0] = pts[i];
      d += `Q${x0 + (x1 - x0) / 2 + (rand() - 0.5) * 40} ${y0 + (y1 - y0) / 2 + (rand() - 0.5) * 40} ${x1} ${y1}`;
    }
    return d + 'Z';
  };
  const coast = blob(islandRx, islandRy, 0.1);
  const ground = svg(
    'svg',
    { class: 'vl-ground', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' },
    svg('path', { d: coast, class: 'vl-sand', transform: `translate(0 14)` }),
    svg('path', { d: coast, class: `${k} nb-lawn vl-grass` }),
    // (Darker patches of grass, for a bit of life.)
    Array.from({ length: 14 }, () => svg('ellipse', { cx: cx + (rand() - 0.5) * islandRx * 1.6, cy: cy + (rand() - 0.5) * islandRy * 1.5, rx: 60 + rand() * 90, ry: 30 + rand() * 40, class: 'nb-hill vl-patch' })),
    // The roads: the rings, four paths in to the green, and one down to the jetty.
    roads.map((r) => [svg('path', { d: ellipsePath(cx, cy, r.rx, r.ry), class: 'vl-road-edge' }), svg('path', { d: ellipsePath(cx, cy, r.rx, r.ry), class: 'vl-road' }), svg('path', { d: ellipsePath(cx, cy, r.rx, r.ry), class: 'vl-road-line' })]),
    [0, 1, 2, 3].map((q) => {
      const a = (q * Math.PI) / 2;
      const r = roads[roads.length - 1];
      return [svg('path', { d: `M${cx + Math.cos(a) * 190} ${cy + Math.sin(a) * 120}L${cx + Math.cos(a) * r.rx} ${cy + Math.sin(a) * r.ry}`, class: 'vl-road-edge' }), svg('path', { d: `M${cx + Math.cos(a) * 190} ${cy + Math.sin(a) * 120}L${cx + Math.cos(a) * r.rx} ${cy + Math.sin(a) * r.ry}`, class: 'vl-road' })];
    }),
    svg('path', { d: `M${cx} ${cy + outer.ry}L${cx} ${cy + islandRy + 40}`, class: 'vl-road-edge' }),
    svg('path', { d: `M${cx} ${cy + outer.ry}L${cx} ${cy + islandRy + 40}`, class: 'vl-road' }),
    // The green in the middle, with a path round it.
    svg('ellipse', { cx, cy, rx: 200, ry: 128, class: `${k} vl-plaza` }),
    svg('ellipse', { cx, cy, rx: 168, ry: 104, class: `${k} nb-lawn vl-green` }),
    // The pond, with lily pads.
    svg('ellipse', { cx: pond.x, cy: pond.y, rx: pond.rx, ry: pond.ry, class: `${k} vl-pond` }),
    svg('ellipse', { cx: pond.x - 30, cy: pond.y - 10, rx: 70, ry: 34, class: 'vl-shine' }),
    [[-50, 18], [40, -20], [60, 26]].map(([dx, dy]) => svg('path', { d: `M${pond.x + dx} ${pond.y + dy}m-13 0a13 8 0 1 0 26 0l-13 0Z`, class: `${k} vl-pad`, 'stroke-width': 2 })),
    // The jetty, out into the sea.
    svg('rect', { x: cx - 26, y: cy + islandRy + 20, width: 52, height: 120, rx: 4, class: `${k} vl-jetty` })
  );

  // ---------- things on the ground: trees, flowers, fences, a bandstand, ducks ----------
  const clear = (x, y, r) => {
    // (Not on a road, the green, the pond or anyone's plot.)
    for (const rd of roads) {
      const e = Math.hypot((x - cx) / rd.rx, (y - cy) / rd.ry);
      if (Math.abs(e - 1) * Math.min(rd.rx, rd.ry) < 50 + r) return false;
    }
    if (Math.hypot((x - cx) / 230, (y - cy) / 150) < 1.15) return false;
    if (Math.hypot((x - pond.x) / (pond.rx + 40), (y - pond.y) / (pond.ry + 40)) < 1) return false;
    if (Math.abs(x - cx) < 60 + r && y > cy) return false;
    for (const s of spots) if (Math.abs(x - s.x) < 110 + r && y > s.y - 190 && y < s.y + 40 + r) return false;
    // (And on the island.)
    return Math.hypot((x - cx) / (islandRx - 70), (y - cy) / (islandRy - 60)) < 1;
  };
  const things = [];
  // (Kept clear for the noticeboard, the arcade and the bench, inside the first ring.)
  const inner = roads[0];
  const slot = (deg) => ({ x: cx + Math.cos((deg * Math.PI) / 180) * inner.rx * 0.68, y: cy + Math.sin((deg * Math.PI) / 180) * inner.ry * 0.7, r: 80 });
  const slots = home ? { board: slot(-40), arcade: slot(40), bench: slot(-140) } : { arcade: slot(40) };
  things.push(...Object.values(slots));
  // (And for what you've put out on your plot, round your house in the middle.)
  const feet = me ? { x: cx + 45, y: cy + 50 } : null;
  let mine = home && feet ? [...(ctx?.data?.village?.items || [])] : [];
  for (const it of mine) things.push({ x: feet.x + it.x, y: feet.y + it.y, r: 36 });
  const place = (r, tries = 40) => {
    for (let t = 0; t < tries; t++) {
      const x = cx + (rand() - 0.5) * islandRx * 2;
      const y = cy + (rand() - 0.5) * islandRy * 2;
      if (clear(x, y, r) && things.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r)) {
        const at = { x, y, r };
        things.push(at);
        return at;
      }
    }
    return null;
  };
  const props = [];
  const tree = (x, y, i) =>
    svg(
      'svg',
      { viewBox: '0 0 80 100', class: 'vl-thing vl-tree', style: `left:${x - 40}px; top:${y - 96}px; animation-delay:${-(i % 5)}s`, 'aria-hidden': 'true' },
      svg('ellipse', { cx: 40, cy: 94, rx: 26, ry: 6, class: 'nb-shadow' }),
      svg('rect', { x: 35, y: 58, width: 10, height: 36, rx: 3, class: `${k} nb-trunk` }),
      i % 3 === 0
        ? svg('path', { d: 'M40 6L70 66H10Z', class: `${k} nb-leaves vl-fir` })
        : svg('path', { d: 'M14 52q-10-22 10-28q4-20 24-14q20-6 20 16q12 14-4 26q-22 12-42 6q-12-2-8-6Z', class: `${k} nb-leaves` })
    );
  for (let i = 0; i < (twoRings ? 70 : 46); i++) {
    const at = place(34);
    if (at) props.push({ y: at.y, el: tree(at.x, at.y, i) });
  }
  for (let i = 0; i < 14; i++) {
    const at = place(26);
    if (!at) continue;
    const cols = ['#ff7eb0', '#ffd23f', '#b79bff', '#ff7069', '#ffffff'];
    props.push({ y: at.y, el: svg('svg', { viewBox: '0 0 60 30', class: 'vl-thing vl-flowers', style: `left:${at.x - 30}px; top:${at.y - 24}px`, 'aria-hidden': 'true' }, svg('ellipse', { cx: 30, cy: 22, rx: 28, ry: 8, class: `${k} vl-bed`, 'stroke-width': 2 }), [8, 18, 28, 38, 48].map((fx, j) => svg('circle', { cx: fx + 2, cy: 16 + (j % 2) * 4, r: 4, fill: cols[(i + j) % cols.length], class: k, 'stroke-width': 1.5 }))) });
  }
  // (A bit of fence here and there.)
  for (let i = 0; i < 6; i++) {
    const at = place(40);
    if (at) props.push({ y: at.y, el: svg('svg', { viewBox: '0 0 90 34', class: 'vl-thing vl-fence', style: `left:${at.x - 45}px; top:${at.y - 30}px`, 'aria-hidden': 'true' }, svg('path', { d: 'M4 12h82M4 24h82', class: `${k} vl-rail`, 'stroke-width': 3 }), [6, 26, 46, 66, 84].map((fx) => svg('path', { d: `M${fx - 4} 32V8l4-5 4 5v24Z`, class: `${k} vl-picket`, 'stroke-width': 2 }))) });
  }
  // ---------- things to do: the noticeboard, the arcade, the bench, fishing ----------
  const fun = buildFun({ ctx, home, slots, pond, k, panel: (...a) => openPanel(...a), leave: () => close(), soundOn: () => soundOn() });
  props.push(...fun.props);

  // The bandstand on the green (your house sits in front of it), and ducks on the pond.
  props.push({ y: cy - 2, el: svg('svg', { viewBox: '0 0 120 90', class: 'vl-thing vl-band', style: `left:${cx - 175}px; top:${cy - 92}px`, 'aria-hidden': 'true' }, svg('path', { d: 'M10 34L60 6l50 28Z', class: `${k} vl-band-roof` }), svg('path', { d: 'M18 34v40M44 34v40M76 34v40M102 34v40', class: k, 'stroke-width': 4 }), svg('rect', { x: 8, y: 72, width: 104, height: 12, rx: 3, class: `${k} vl-band-floor` })) });
  const ducks = h('span', { class: 'vl-ducks', style: `left:${pond.x - 40}px; top:${pond.y - 22}px`, 'aria-hidden': 'true' }, [0, 1].map((d) => svg('svg', { viewBox: '0 0 30 22', class: 'vl-duck', style: `animation-delay:${-d * 3}s` }, svg('path', { d: 'M4 14q0 7 10 7h8q6 0 6-6q-3 2-8 0q0-8-6-8q-6 0-5 5Z', class: `${k} vl-duck-body`, 'stroke-width': 2 }), svg('circle', { cx: 13, cy: 10, r: 1.2, class: 'nb-ink' }), svg('path', { d: 'M7 10l-5 1 5 2Z', fill: '#ff9a1f', class: k, 'stroke-width': 1.2 }))));
  // Cars going round the ring road (and, at night, their lamps).
  const cars = roads.flatMap((r, ri) =>
    [0, 1].slice(0, ri ? 1 : 2).map((c) =>
      h(
        'span',
        { class: 'vl-car', style: `offset-path: path("${ellipsePath(cx, cy, r.rx, r.ry)}"); animation-duration:${38 + ri * 20}s; animation-delay:${-c * 19}s; --car:${['#ff4d6d', '#4fd6cb', '#ffd23f'][(ri + c) % 3]}`, 'aria-hidden': 'true' },
        svg('svg', { viewBox: '0 0 60 34' }, svg('path', { d: 'M4 24v-6q0-4 5-5l6-1q5-9 13-9h8q8 0 12 9q9 1 9 7v5Z', class: `${k} vl-carbody` }), svg('path', { d: 'M19 12q4-6 9-6h2v6ZM33 6h3q5 0 8 6H33Z', class: `${k} nb-glass`, 'stroke-width': 2 }), svg('circle', { cx: 16, cy: 25, r: 5.5, class: `${k} nb-wheel` }), svg('circle', { cx: 44, cy: 25, r: 5.5, class: `${k} nb-wheel` }))
      )
    )
  );
  // Street lamps by the paths in.
  for (const q of [0.5, 1.5, 2.5, 3.5]) {
    const a = (q * Math.PI) / 2;
    const x = cx + Math.cos(a) * 250;
    const y = cy + Math.sin(a) * 170;
    props.push({ y, el: svg('svg', { viewBox: '0 0 40 90', class: 'vl-thing vl-lamp', style: `left:${x - 20}px; top:${y - 86}px`, 'aria-hidden': 'true' }, svg('circle', { cx: 20, cy: 18, r: 18, class: 'nb-glow' }), svg('path', { d: 'M20 86V26', class: `${k} nb-post` }), svg('path', { d: 'M12 26h16l-3-14h-10Z', class: `${k} nb-lamp` })) });
  }

  // ---------- the houses ----------
  const plots = houses.map(({ el }, i) => {
    const s = spots[i];
    el.classList.add('vl-plot');
    el.style.left = `${s.x - 85}px`;
    el.style.top = `${s.y - 170}px`;
    return { y: s.y, el };
  });
  if (me) {
    me.classList.add('vl-plot', 'vl-mine');
    me.style.left = `${cx - 40}px`;
    me.style.top = `${cy + 50 - 170}px`;
    plots.push({ y: cy + 50, el: me });
  }
  // Friends who are online, as little people in their gardens; now and then two of them wander
  // over to the green for a chat. (A few at most, all moved by CSS: nothing to work out per frame.)
  const person = (colour, x, y, path, n) =>
    h(
      'span',
      { class: 'vl-person' + (path ? ' strolls' : ''), style: (path ? `offset-path: path("${path}"); animation-delay:${-n * 7}s;` : `left:${x}px; top:${y}px;`) + ` --shirt:${colour}`, 'aria-hidden': 'true' },
      svg('svg', { viewBox: '0 0 20 34' }, svg('circle', { cx: 10, cy: 7, r: 5.5, class: `${k} vl-face`, 'stroke-width': 2 }), svg('path', { d: 'M3 26v-8q0-5 7-5t7 5v8Z', class: `${k} vl-shirt`, 'stroke-width': 2 }), svg('path', { d: 'M7 26v6M13 26v6', class: k, 'stroke-width': 2.5 })),
      path ? h('span', { class: 'vl-chat' }, '…') : null
    );
  const people = [];
  const online = houses.map((hs, i) => ({ el: hs.el, s: spots[i] })).filter((o) => o.s && o.el.dataset.online).slice(0, 8);
  online.forEach((o, n) => {
    const x = o.s.x + 52;
    const y = o.s.y - 34;
    // (Pairs of friends meet on the green, either side of the middle.)
    const pair = Math.floor(n / 2);
    const meet = pair < 3 && online.length > 1 && n < online.length - (online.length % 2) ? [cx + (n % 2 ? 26 : -26) + (pair - 1) * 90, cy + 92 + (pair % 2) * 14] : null;
    people.push({ y: y + 34, el: person(o.el.dataset.wall || '#6cb6ff', x, y, meet ? `M${x + 10} ${y + 34}L${meet[0]} ${meet[1]}` : '', pair) });
  });
  // The postie: for each friend with something new (a few at most), a walk from their house to
  // your mailbox, once, and a letter pops up when it's delivered.
  const posties = me
    ? houses
        .map((hs, i) => ({ el: hs.el, s: spots[i] }))
        .filter((o) => o.s && o.el.dataset.mail)
        .slice(0, 3)
        .map((o, n) => {
          const x = o.s.x;
          const y = o.s.y - 30;
          const to = [cx - 40 + 12, cy + 50 - 26];
          const walker = h('span', { class: 'vl-postie', style: `offset-path: path("M${x} ${y + 30}L${to[0]} ${to[1] + 30}"); animation-delay:${0.8 + n * 3.5}s`, 'aria-hidden': 'true' }, svg('svg', { viewBox: '0 0 22 34' }, svg('path', { d: 'M4 12h14l-2-6H6Z', class: `${k} vl-cap`, 'stroke-width': 2 }), svg('circle', { cx: 11, cy: 14, r: 5, class: `${k} vl-face`, 'stroke-width': 2 }), svg('path', { d: 'M4 30v-9q0-4 7-4t7 4v9Z', class: `${k} vl-cap`, 'stroke-width': 2 }), svg('rect', { x: 13, y: 20, width: 8, height: 7, rx: 1, class: `${k} vl-bag`, 'stroke-width': 1.5 })));
          walker.addEventListener('animationend', () => {
            walker.remove();
            me.classList.remove('vl-got');
            void me.offsetWidth;
            me.classList.add('vl-got');
            if (soundOn()) sound.blip?.(1320, 0.08, 'triangle', 0.03);
          });
          return walker;
        })
    : [];
  // (Further back drawn first, so nearer things stand in front.)
  const standing = [...props, ...plots, ...people].sort((a, b) => a.y - b.y).map((t) => t.el);

  // Festive days: bunting strung across the green, and fireworks over it.
  const bunting = dress?.garland ? [-1, 1].map((side) => h('span', { class: 'vl-bunting', style: `left:${cx - 230}px; top:${cy - 150 + side * 6}px; rotate:${side * 4}deg; --nb-garland:${dress.garland}`, 'aria-hidden': 'true' })) : [];
  const cols = dress?.colours || [];
  const fireworks = dress?.fireworks ? h('span', { class: 'nb-fireworks vl-fireworks', style: `left:${cx - 300}px; top:${cy - 420}px`, 'aria-hidden': 'true' }, [[12, 60], [40, 10], [66, 80], [88, 30], [28, 120]].map(([x, y], j) => h('i', { style: `left:${x}%; top:${y}px; --c:${cols[j % cols.length] || '#ffd23f'}; animation-delay:${j * 0.6}s` }))) : null;

  // What you've put out on your plot; and what your friends have, round their houses (the few
  // things nearest their door, a little smaller).
  const decor = h('div', { class: 'vl-decor-layer' });
  const showMine = () => decor.replaceChildren(...mine.map((it) => decorEl(it.id, feet.x, feet.y, it.x, it.y)).filter(Boolean));
  if (feet) showMine();
  const theirs = houses.flatMap(({ el }, i) => {
    const b = (ctx?.data?.buddies || []).find((x) => x.url === el.dataset.house);
    const s = spots[i];
    if (!b?.village?.length || !s) return [];
    return b.village
      .filter((it) => Math.abs(it.x) <= 160 && it.y >= -60 && it.y <= 70)
      .slice(0, 4)
      .map((it) => decorEl(it.id, s.x, s.y + 6, Math.round(it.x * 0.8), Math.round(it.y * 0.6), 0.75));
  });
  const world = h('div', { class: 'vl-world', style: `width:${W}px; height:${H}px` }, ground, fun.fishing, ducks, cars, bunting, standing, theirs, decor, posties, fireworks);
  const view = h('div', { class: 'vl-view', tabindex: '0', 'aria-label': `${title}. Drag to look about; plus and minus to zoom.` }, world);
  const falling = dress?.falling || { winter: 'snow', autumn: 'leaf', spring: 'petal' }[document.documentElement.dataset.season];
  const weather = falling ? h('span', { class: `nb-weather vl-weather ${falling}`, 'aria-hidden': 'true' }, Array.from({ length: 28 }, (_, j) => h('i', { style: `left:${(j * 37 + 11) % 100}%; animation-delay:${-((j * 1.3) % 12)}s; animation-duration:${10 + (j % 6)}s` + (falling === 'confetti' && cols.length ? `; background:${cols[j % cols.length]}` : '') }))) : null;

  // ---------- looking about: drag, pinch, scroll, + and − ----------
  let x = 0;
  let y = 0;
  let s = 1;
  let fit = 1;
  const paint = () => (world.style.transform = `translate(${x}px, ${y}px) scale(${s})`);
  const keepIn = () => {
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    const ww = W * s;
    const wh = H * s;
    x = ww <= vw ? (vw - ww) / 2 : Math.min(0, Math.max(vw - ww, x));
    y = wh <= vh ? (vh - wh) / 2 : Math.min(0, Math.max(vh - wh, y));
  };
  const zoomAt = (to, px, py) => {
    const next = Math.max(fit, Math.min(2.2, to));
    x = px - ((px - x) * next) / s;
    y = py - ((py - y) * next) / s;
    s = next;
    keepIn();
    paint();
  };
  const start = () => {
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    fit = Math.min(vw / W, vh / H);
    // (Opening with the island filling the screen, so the houses read; drag to see the rest.)
    s = Math.min(1, Math.max(fit, Math.max(vw / (islandRx * 2), vh / (islandRy * 2))));
    x = vw / 2 - cx * s;
    y = vh / 2 - (cy - 40) * s;
    keepIn();
    paint();
  };
  const pointers = new Map();
  let moved = 0;
  let pinch = null;
  view.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    moved = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s };
    }
  });
  view.addEventListener('pointermove', (e) => {
    const was = pointers.get(e.pointerId);
    if (!was) return;
    const now = [e.clientX, e.clientY];
    pointers.set(e.pointerId, now);
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const r = view.getBoundingClientRect();
      zoomAt((pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1])) / pinch.d, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
      moved = 99;
      return;
    }
    moved += Math.abs(now[0] - was[0]) + Math.abs(now[1] - was[1]);
    if (moved > 6) {
      view.setPointerCapture?.(e.pointerId);
      view.classList.add('dragging');
    }
    x += now[0] - was[0];
    y += now[1] - was[1];
    keepIn();
    paint();
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) view.classList.remove('dragging');
  };
  for (const ev of ['pointerup', 'pointercancel']) view.addEventListener(ev, up);
  // (A drag isn't a tap: no visiting a house you only meant to look past.)
  view.addEventListener('click', (e) => {
    if (moved > 6) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  view.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = view.getBoundingClientRect();
    zoomAt(s * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  const zoomBy = (f) => zoomAt(s * f, view.clientWidth / 2, view.clientHeight / 2);
  view.addEventListener('keydown', (e) => {
    const step = 60;
    if (e.key === '+' || e.key === '=') zoomBy(1.25);
    else if (e.key === '-') zoomBy(0.8);
    else if (e.key === 'ArrowLeft') x += step;
    else if (e.key === 'ArrowRight') x -= step;
    else if (e.key === 'ArrowUp') y += step;
    else if (e.key === 'ArrowDown') y -= step;
    else return;
    e.preventDefault();
    keepIn();
    paint();
  });

  // ---------- the sky: your clock, and the weather where you are ----------
  // (Not on a dark theme's night or a festive dusk: those stay as they are.)
  const hour = new Date().getHours();
  const clock = night || dusk ? '' : hour < 6 || hour >= 21 ? 'night' : hour < 8 || hour >= 18 ? 'night dusk' : '';
  const skyLayer = h('span', { class: 'vl-sky', 'aria-hidden': 'true' });
  fetch('/api/sky', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((w) => {
      if (!w || !box.isConnected) return;
      const kind = String(w.kind || '');
      if (/^(rain|storm|cloud|fog|snow)$/.test(kind)) box.classList.add('sky-' + kind);
      if (w.windy) box.classList.add('sky-windy');
      // (Snow from the sky, if the season or day hasn't brought its own weather already.)
      if (kind === 'snow' && !weather) skyLayer.append(h('span', { class: 'nb-weather vl-weather snow' }, Array.from({ length: 24 }, (_, j) => h('i', { style: `left:${(j * 41 + 7) % 100}%; animation-delay:${-((j * 1.1) % 12)}s; animation-duration:${11 + (j % 5)}s` }))));
    })
    .catch(() => {});

  // ---------- sounds: birds by day, crickets by night, a little tune on a festive day ----------
  // (Off unless you turn them on here; and never louder than the site's own sound setting allows.)
  const SOUND_KEY = 'vl-sound';
  const soundOn = () => {
    try {
      return localStorage.getItem(SOUND_KEY) === '1';
    } catch {
      return false;
    }
  };
  let ambient = 0;
  const dark = () => box.classList.contains('night');
  const tick = () => {
    if (document.hidden || Math.random() < 0.4) return;
    if (dark()) [0, 0.09, 0.18].forEach((d) => setTimeout(() => sound.blip?.(4300, 0.025, 'square', 0.005), d * 1000));
    else {
      const f = 2300 + Math.random() * 900;
      sound.blip?.(f, 0.05, 'sine', 0.02);
      setTimeout(() => sound.blip?.(f * 1.25, 0.06, 'sine', 0.018), 90);
    }
  };
  const tune = () => [523, 659, 784, 659, 1047].forEach((f, j) => setTimeout(() => sound.blip?.(f, 0.16, 'triangle', 0.03), j * 180));
  const setSound = (on) => {
    clearInterval(ambient);
    if (on) {
      ambient = setInterval(tick, 3200);
      if (festive) tune();
    }
    soundBtn.textContent = on ? '🔊' : '🔈';
    soundBtn.setAttribute('aria-pressed', String(on));
  };
  const soundBtn = h('button', { type: 'button', class: 'vl-btn vl-sound', 'aria-label': 'Village sounds', 'aria-pressed': 'false', onclick: () => {
    const on = !soundOn();
    try {
      localStorage.setItem(SOUND_KEY, on ? '1' : '0');
    } catch {}
    setSound(on);
  } }, '🔈');
  // (A hidden tab: everything holds still, and quiet.)
  const onHide = () => box.classList.toggle('vl-paused', document.hidden);

  // ---------- decorating your plot (signed in, on your own island) ----------
  let tray = null;
  const decorate = () => {
    if (tray) return;
    box.classList.add('vl-decorating');
    tray = decorEditor({
      layer: decor,
      feet,
      items: mine,
      scale: () => s,
      save: async (items) => {
        const res = await fetch('/admin/api/village', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
        const out = await res.json();
        if (!res.ok) throw new Error(out.error || 'Not saved');
        return out.items;
      },
      onDone: (kept) => {
        if (kept) {
          mine = kept;
          if (ctx?.data) ctx.data.village = { items: kept };
        }
        tray?.remove();
        tray = null;
        box.classList.remove('vl-decorating');
        showMine();
      }
    });
    box.append(tray);
    // (Your plot, in view.)
    zoomAt(Math.max(s, Math.min(1, view.clientWidth / 900)), 0, 0);
    x = view.clientWidth / 2 - feet.x * s;
    y = view.clientHeight / 2 - (feet.y - 40) * s;
    keepIn();
    paint();
  };
  const decorBtn = home && feet && ctx?.data?.ownerView ? h('button', { type: 'button', class: 'vl-btn vl-decorate', 'aria-label': 'Decorate your plot', title: 'Decorate your plot', onclick: decorate }, '🖌') : null;

  // ---------- a panel over the village (the noticeboard close up, fishing, the bench) ----------
  let panelEl = null;
  const openPanel = (heading, body, cls = '') => {
    panelEl?.remove();
    const shut = () => {
      panelEl?.remove();
      panelEl = null;
      view.focus();
    };
    const x = h('button', { type: 'button', class: 'vl-btn vl-panel-x', 'aria-label': 'Close', onclick: shut }, '✕');
    panelEl = h('div', { class: 'vl-panel ' + cls, role: 'dialog', 'aria-label': heading }, h('div', { class: 'vl-panel-card' }, h('div', { class: 'vl-panel-head' }, h('b', null, heading), x), body));
    panelEl.addEventListener('click', (e) => e.target === panelEl && shut());
    box.append(panelEl);
    x.focus();
    return { shut, el: panelEl };
  };

  // ---------- the window itself ----------
  const close = () => {
    sound.click?.();
    clearInterval(ambient);
    document.removeEventListener('visibilitychange', onHide);
    removeEventListener('keydown', onKey);
    removeEventListener('resize', onResize);
    box.classList.add('closing');
    setTimeout(() => box.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200);
    opener?.focus?.();
  };
  const onKey = (e) => e.key === 'Escape' && (panelEl ? (panelEl.remove(), (panelEl = null)) : tray ? tray.querySelector('.vl-cancel')?.click() : close());
  const onResize = () => (keepIn(), paint());
  const opener = document.activeElement;
  const closeBtn = h('button', { type: 'button', class: 'vl-btn vl-close', 'aria-label': 'Close the village', onclick: close }, '✕');
  const box = h(
    'div',
    { class: 'nb vl' + (night ? ' night' : '') + (dusk ? ' dusk' : '') + (clock ? ' ' + clock : '') + (dress?.fest ? ' fest' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'vl-sea', 'aria-hidden': 'true' }),
    view,
    skyLayer,
    weather,
    h('div', { class: 'vl-bar' }, h('span', { class: 'vl-title' }, title), h('span', { class: 'vl-zoom' }, decorBtn, soundBtn, h('button', { type: 'button', class: 'vl-btn', 'aria-label': 'Zoom out', onclick: () => zoomBy(0.8) }, '−'), h('button', { type: 'button', class: 'vl-btn', 'aria-label': 'Zoom in', onclick: () => zoomBy(1.25) }, '+')), closeBtn)
  );
  if (dress?.fest) dress.colours.slice(0, 3).forEach((c, j) => box.style.setProperty(`--nb-f${j + 1}`, c));
  document.body.append(box);
  document.addEventListener('visibilitychange', onHide);
  setSound(soundOn());
  addEventListener('keydown', onKey);
  addEventListener('resize', onResize);
  requestAnimationFrame(() => {
    start();
    box.classList.add('open');
    closeBtn.focus();
  });
  sound.click?.();
  return box;
}

// ---------- things to do ----------
// The noticeboard (your friends' pictures of the day, pinned up, and the fortune of the day), the
// arcade (its best scores on a board outside; tap it to play), the bench (visitors leave a wave,
// which waits for your approval like the guestbook), and fishing at the pond (your catches are
// kept in this browser only).
const CATCHES = [
  ['👢', 'an old boot'], ['✉️', 'a letter in a bottle'], ['🐟', 'a tiny fish'], ['🗝️', 'a rusty key'], ['🐚', 'a shell'], ['⭐', 'a starfish'], ['🥫', 'a tin can'], ['🐸', 'a surprised frog'], ['🌿', 'some pondweed'], ['🦆', 'a rubber duck'], ['🧦', 'one sock'], ['🐠', 'a stripy fish'], ['💍', 'a ring (finders keepers)'], ['📯', 'a little horn']
];
const CATCH_KEY = 'vl-catches';
function readCatches() {
  try {
    const v = JSON.parse(localStorage.getItem(CATCH_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
function buildFun({ ctx, home, slots, pond, k, panel, leave, soundOn }) {
  const data = ctx?.data || {};
  const props = [];
  const at = (spot, w, hgt) => `left:${spot.x - w / 2}px; top:${spot.y - hgt}px`;
  const firstName = (b) => String(b?.owner || b?.name || '').split(/\s+/)[0];

  // The noticeboard.
  if (slots.board) {
    const days = (data.friendDays || []).filter((d) => d.photo_day?.src).slice(0, 6);
    const lines = data.fortunes || [];
    const fortune = lines.length ? lines[Math.floor(Date.now() / 86400000) % lines.length] : '';
    const buddy = (url) => (data.buddies || []).find((b) => b.url === url);
    const board = h(
      'button',
      { type: 'button', class: 'vl-thing vl-fun vl-board', style: at(slots.board, 150, 120), 'aria-label': 'The noticeboard' },
      h('span', { class: 'vl-board-face' }, days.slice(0, 3).map((d, i) => h('img', { src: d.photo_day.src, alt: '', loading: 'lazy', style: `--tilt:${[-6, 4, -3][i]}deg` })), fortune ? h('span', { class: 'vl-board-slip' }, '🥠') : null, !days.length && !fortune ? h('span', { class: 'vl-board-empty' }, 'Notices') : null),
      h('span', { class: 'vl-board-legs', 'aria-hidden': 'true' })
    );
    board.addEventListener('click', () => {
      panel(
        'The noticeboard',
        h(
          'div',
          { class: 'vl-notices' },
          days.length
            ? days.map((d) =>
                h(
                  'figure',
                  { class: 'vl-pin' },
                  h('img', { src: d.photo_day.src, alt: d.photo_day.cap || `${firstName(buddy(d.url))}’s picture of the day`, loading: 'lazy' }),
                  h('figcaption', null, h('b', null, firstName(buddy(d.url)) || 'A friend'), d.photo_day.cap ? ` · ${d.photo_day.cap}` : '', /^https?:/.test(d.photo_day.url || '') ? h('a', { href: d.photo_day.url, target: '_blank', rel: 'noopener noreferrer' }, ' ↗') : null)
                )
              )
            : h('p', { class: 'vl-quiet' }, 'No pictures of the day pinned up yet.'),
          fortune ? h('p', { class: 'vl-fortune' }, '🥠 ', fortune) : null
        )
      );
    });
    props.push({ y: slots.board.y, el: board });
  }

  // The arcade, with its best scores outside.
  if (slots.arcade) {
    const rows = [];
    if (data.arcade?.scores?.[0]) rows.push([data.ownerView ? 'You' : firstName({ owner: data.site?.owner, name: data.site?.name }) || 'Host', data.arcade.scores[0].score]);
    for (const b of (data.ownerView ? data.friendsMine?.buddies : data.buddies) || []) if (b.arcade?.best) rows.push([firstName(b), b.arcade.best]);
    rows.sort((a, b) => b[1] - a[1]);
    const hut = h(
      'button',
      { type: 'button', class: 'vl-thing vl-fun vl-arcade', style: at(slots.arcade, 130, 130), 'aria-label': 'The arcade: tap to play' },
      h('span', { class: 'vl-arcade-sign' }, 'ARCADE'),
      h('span', { class: 'vl-arcade-hut' }, h('span', { class: 'vl-arcade-door' })),
      h('span', { class: 'vl-arcade-scores' }, rows.length ? rows.slice(0, 3).map(([n, sc], i) => h('span', null, `${i + 1}. ${n} ${sc}`)) : h('span', null, 'Hi-scores'))
    );
    hut.addEventListener('click', () => {
      leave();
      location.hash = '#/arcade';
    });
    props.push({ y: slots.arcade.y, el: hut });
  }

  // The bench.
  if (slots.bench) {
    const waves = (data.guestbook || []).filter((g) => g.wave).slice(0, 8);
    const bench = h(
      'button',
      { type: 'button', class: 'vl-thing vl-fun vl-bench', style: at(slots.bench, 120, 70), 'aria-label': 'The bench: leave a wave' },
      h('span', { class: 'vl-bench-seat', 'aria-hidden': 'true' }),
      h('span', { class: 'vl-bench-sign' }, waves.length ? `👋 ${waves.length}` : '👋')
    );
    bench.addEventListener('click', () => {
      const list = waves.length ? h('ul', { class: 'vl-waves' }, waves.map((g) => h('li', null, h('b', null, g.name), ' ', g.message))) : h('p', { class: 'vl-quiet' }, 'Nobody’s waved from the bench yet.');
      if (data.ownerView) return panel('The bench', h('div', null, list, h('p', { class: 'vl-quiet' }, 'Visitors can wave from here. Their waves wait in your inbox until you approve them, like the guestbook.')));
      const name = h('input', { type: 'text', maxlength: '40', placeholder: 'Your name', 'aria-label': 'Your name', autocomplete: 'off' });
      const words = h('input', { type: 'text', maxlength: '80', placeholder: 'A few words (if you like)', 'aria-label': 'A few words', autocomplete: 'off' });
      const trap = h('input', { type: 'text', class: 'hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
      const say = h('p', { class: 'vl-quiet', role: 'status' });
      const go = h('button', { type: 'submit', class: 'vl-go' }, 'Wave 👋');
      const form = h('form', { class: 'vl-wave-form' }, name, words, trap, go, say);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        go.disabled = true;
        try {
          const res = await fetch('/api/guestbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.value, message: words.value, wave: true, website: trap.value }) });
          const out = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(out.error || 'That didn’t go through.');
          form.replaceChildren(h('p', { class: 'vl-quiet' }, 'Waved! It’ll show here once it’s been seen to.'));
        } catch (err) {
          say.textContent = err.message;
          go.disabled = false;
        }
      });
      panel('The bench', h('div', null, list, form));
      name.focus();
    });
    props.push({ y: slots.bench.y, el: bench });
  }

  // Fishing at the pond: a little jetty with a rod; cast, wait for the bob, reel in.
  const fishing = h('button', { type: 'button', class: 'vl-fun vl-fishing', style: `left:${pond.x + pond.rx - 60}px; top:${pond.y - 10}px`, 'aria-label': 'Go fishing' }, h('span', { class: 'vl-rod', 'aria-hidden': 'true' }), h('span', { class: 'vl-fish-sign' }, '🎣'));
  fishing.addEventListener('click', () => {
    let state = 'idle';
    let timer = 0;
    const kept = readCatches();
    const total = () => Object.values(kept).reduce((a, b) => a + (Number(b) || 0), 0);
    const water = h('div', { class: 'vl-water' }, h('span', { class: 'vl-bob' }));
    const say = h('p', { class: 'vl-fish-say', role: 'status' }, 'Cast your line, then reel in when the float bobs.');
    const count = h('p', { class: 'vl-quiet' }, `Caught so far: ${total()}`);
    const btn = h('button', { type: 'button', class: 'vl-go' }, 'Cast');
    const reset = () => {
      state = 'idle';
      water.classList.remove('cast', 'bite');
      btn.textContent = 'Cast';
    };
    btn.addEventListener('click', () => {
      clearTimeout(timer);
      if (state === 'idle') {
        state = 'waiting';
        water.classList.add('cast');
        btn.textContent = 'Reel in';
        say.textContent = 'Waiting for a bite…';
        timer = setTimeout(() => {
          state = 'bite';
          water.classList.add('bite');
          say.textContent = 'A bite! Reel in!';
          if (soundOn()) sound.blip?.(880, 0.06, 'square', 0.02);
          timer = setTimeout(() => {
            if (state === 'bite') {
              say.textContent = 'It got away. Try again?';
              reset();
            }
          }, 1400);
        }, 1500 + Math.random() * 4000);
      } else if (state === 'bite') {
        const [icon, what] = CATCHES[Math.floor(Math.random() * CATCHES.length)];
        kept[what] = (Number(kept[what]) || 0) + 1;
        try {
          localStorage.setItem(CATCH_KEY, JSON.stringify(kept));
        } catch {}
        say.replaceChildren(h('span', { class: 'vl-catch' }, icon), ` You caught ${what}!`);
        count.textContent = `Caught so far: ${total()}`;
        if (soundOn()) [660, 880, 1100].forEach((f, j) => setTimeout(() => sound.blip?.(f, 0.08, 'triangle', 0.025), j * 90));
        reset();
      } else {
        say.textContent = 'Too soon! Wait for the float to bob.';
        reset();
      }
    });
    const p = panel('Fishing', h('div', { class: 'vl-fish' }, water, say, btn, count), 'vl-fish-panel');
    // (Closed: no bites left waiting.)
    new MutationObserver((_, o) => !p.el.isConnected && (clearTimeout(timer), o.disconnect())).observe(p.el.parentNode, { childList: true });
  });
  return { props, fishing };
}
