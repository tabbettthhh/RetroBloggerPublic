// The Atlas, as a travel board: the map is a sheet of paper pinned to cork in a wooden frame,
// each place a pushpin with its name on a little tag, the places of one trip joined by red
// thread in the order you went. Open a pin and you get the memory: its photo as a Polaroid,
// when it was, the weather, your stars and a line of what you wrote. Above it, ways of looking
// back (first visits, the ones you'd go back to, your best, rainy days, sunny ones, by year);
// tucked into the frame, a few notes the board noticed; under it, your trips, in your hand.
import { h, esc, catColor, catLabel, CATEGORIES } from './util.js';
import { mountMap } from './maps.js';
import { sound } from './sound.js';

const DAY = 864e5;
const fmtDay = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtMonth = (ts) => new Date(ts).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const rainy = (p) => /rain|drizzle|shower|storm|thunder|sleet|snow/i.test(p.weather || '');
const sunny = (p) => /sun|clear|hot|warm|bright/i.test(p.weather || '') && !rainy(p);
const firstLine = (p) => String(p.excerpt || '').split(/(?<=[.!?])\s/)[0].slice(0, 120);

// Trips: places you went one after another, no more than three days apart.
export function tripsOf(places) {
  const by = places.filter((p) => p.ts).slice().sort((a, b) => a.ts - b.ts);
  const trips = [];
  for (const p of by) {
    const t = trips[trips.length - 1];
    if (t && p.ts - t.places[t.places.length - 1].ts <= 3 * DAY) t.places.push(p);
    else trips.push({ places: [p] });
  }
  for (const t of trips) {
    const cities = [...new Set(t.places.map((p) => p.city).filter(Boolean))];
    t.name = cities.length ? cities.slice(0, 3).join(', ') + (cities.length > 3 ? '…' : '') : t.places[0].title || 'Somewhere';
    t.from = t.places[0].ts;
    t.to = t.places[t.places.length - 1].ts;
  }
  return trips.reverse();
}

// The ways of looking back. Each keeps only what it says.
function lensesFor(all) {
  const firstIn = new Set();
  const seen = new Set();
  for (const p of all.slice().sort((a, b) => a.ts - b.ts)) {
    const c = (p.city || '').toLowerCase();
    if (c && !seen.has(c)) (seen.add(c), firstIn.add(p));
  }
  const years = [...new Set(all.map((p) => new Date(p.ts).getFullYear()).filter((y) => y > 1970))].sort((a, b) => b - a);
  const L = [
    ['all', 'Everywhere', () => true],
    ['first', 'First visits', (p) => firstIn.has(p)],
    ['again', 'I’d go back', (p) => p.would_return],
    ['best', 'My best', (p) => p.rating != null && p.rating >= 4.5],
    ['rain', 'Rainy days', rainy],
    ['sun', 'Sunny days', sunny],
    ...years.map((y) => [`y${y}`, String(y), (p) => new Date(p.ts).getFullYear() === y])
  ];
  return L.filter(([id, , f]) => id === 'all' || all.some(f));
}

// A few things the board noticed, written on notes tucked into the frame.
function notesFor(all, trips) {
  const out = [];
  const cities = new Set(all.map((p) => (p.city || '').toLowerCase()).filter(Boolean));
  if (cities.size) out.push(`${cities.size} ${cities.size === 1 ? 'town' : 'towns and cities'}, ${all.length} ${all.length === 1 ? 'place' : 'places'}`);
  const first = all.slice().sort((a, b) => a.ts - b.ts)[0];
  if (first?.ts) out.push(`Where it started: ${first.title || first.city} · ${fmtMonth(first.ts)}`);
  const longest = trips.slice().sort((a, b) => b.places.length - a.places.length)[0];
  if (longest && longest.places.length > 2) out.push(`Biggest trip: ${longest.name}, ${longest.places.length} stops`);
  const wet = all.filter(rainy).length;
  if (wet) out.push(`${wet} ${wet === 1 ? 'place' : 'places'} in the rain, and worth it`);
  const loved = all.filter((p) => p.would_return).length;
  if (loved) out.push(`${loved} I’d go back to`);
  return out.slice(0, 4);
}

// The memory, in the popup: a Polaroid (or the colour of its kind), the day, the weather, your
// stars and a line of what you wrote.
function memoryCard(p) {
  const photo = p.photos?.[0];
  const n = Number.isFinite(+p.rating) && p.rating !== null ? Math.max(0, Math.min(5, Math.round(+p.rating))) : null;
  const stars = n != null ? '★'.repeat(n) + '☆'.repeat(5 - n) : '';
  return `<div class="mpop">
    <div class="mpop-polaroid"${photo ? '' : ` style="--c:${esc(catColor(p.category))}"`}>${photo ? `<img src="${esc(photo)}" alt="" loading="lazy">` : `<span class="mpop-blank">${esc(catLabel(p.category) || 'A place')}</span>`}<span class="mpop-cap">${esc(p.title || '')}</span></div>
    <div class="mpop-when">${esc([p.city, p.ts ? fmtDay(p.ts) + ' ' + new Date(p.ts).getFullYear() : ''].filter(Boolean).join(' · '))}</div>
    ${p.weather ? `<div class="mpop-weather">${esc(p.weather)}</div>` : ''}
    ${stars ? `<div class="mpop-stars" aria-label="${esc(String(p.rating))} out of 5">${stars}</div>` : ''}
    ${firstLine(p) ? `<p class="mpop-line">“${esc(firstLine(p))}”</p>` : ''}
    <a class="mpop-open" href="#/journal/${esc(p.slug)}">Open the journal ›</a>
  </div>`;
}

export function atlasBoard(ctx, all, toolbar) {
  const trips = tripsOf(all);
  const lenses = lensesFor(all);
  const used = new Set(all.map((p) => p.category).filter(Boolean));
  const kinds = [...Object.keys(CATEGORIES).filter((c) => used.has(c)), ...[...used].filter((c) => !CATEGORIES[c])];
  let lens = 'all';
  let kind = 'all';
  // Pins, or how often: warm circles where you go most.
  let heat = false;
  const heatBtn = h('button', { type: 'button', class: 'board-tab board-heat', 'aria-pressed': 'false', title: 'Show how often you’ve been to each spot' }, '🔥 How often');
  heatBtn.addEventListener('click', () => {
    heat = !heat;
    heatBtn.setAttribute('aria-pressed', String(heat));
    heatBtn.classList.toggle('on', heat);
    sound.click?.();
    draw();
  });
  // Arriving from a journal entry: the map opens on that place's pin, its trip marked.
  const from = ctx.param ? all.find((p) => p.slug === ctx.param) : null;
  let focusOnce = !!from;
  const mapHolder = h('div', { class: 'board-map' });
  const tabs = h('div', { class: 'board-lenses', role: 'radiogroup', 'aria-label': 'Look back at' });
  const legend = h('div', { class: 'board-legend', role: 'radiogroup', 'aria-label': 'Kind of place' });
  const diary = h('div', { class: 'board-diary' });
  const notes = h('div', { class: 'board-notes', 'aria-label': 'Noticed' }, notesFor(all, trips).map((t, i) => h('p', { class: 'board-note', style: { '--r': `${[-3, 2, -1.5, 3][i % 4]}deg` } }, t)));

  const draw = () => {
    const f = lenses.find(([id]) => id === lens)?.[2] || (() => true);
    const shown = all.filter((p) => f(p) && (kind === 'all' || p.category === kind));
    const keep = new Set(shown);
    mapHolder.replaceChildren();
    const el = h('div', { class: 'atlas-map board-sheet' });
    mapHolder.append(el, h('span', { class: 'board-folds', 'aria-hidden': 'true' }));
    mountMap(el, {
      places: shown.map((p) => ({ ...p, href: `#/journal/${p.slug}` })),
      style: 'board',
      tags: shown.length <= 12,
      card: memoryCard,
      heat,
      strings: trips.map((t) => t.places.filter((p) => keep.has(p) && Number.isFinite(p.lat) && Number.isFinite(p.lon)).map((p) => [p.lat, p.lon])).filter((l) => l.length > 1),
      focus: focusOnce ? shown.indexOf(from) : -1
    });
    const pick = (cur, id, set) => h('button', { type: 'button', role: 'radio', class: 'board-tab' + (cur === id ? ' on' : ''), 'aria-checked': String(cur === id), onclick: () => { set(id); sound.click?.(); draw(); } });
    tabs.replaceChildren(...lenses.map(([id, label]) => Object.assign(pick(lens, id, (v) => (lens = v)), { textContent: label })), heatBtn);
    legend.replaceChildren(
      Object.assign(pick(kind, 'all', (v) => (kind = v)), { textContent: 'All kinds' }),
      ...kinds.map((c) => {
        const b = pick(kind, c, (v) => (kind = v));
        b.append(h('span', { class: 'bpin mini', style: { '--c': catColor(c) }, 'aria-hidden': 'true' }, h('i')), catLabel(c));
        return b;
      })
    );
    // Your trips, newest first, in your hand: where, when, and the stops.
    const tripsShown = trips.map((t) => ({ ...t, places: t.places.filter((p) => keep.has(p)) })).filter((t) => t.places.length);
    diary.replaceChildren(
      h('h3', null, 'Trips'),
      ...(tripsShown.length
        ? tripsShown.map((t) =>
            h(
              'section',
              { class: 'board-trip' + (from && t.places.includes(from) ? ' found' : '') },
              h('header', null, h('b', null, t.name), h('small', null, t.from === t.to || fmtDay(t.from) === fmtDay(t.to) ? `${fmtDay(t.from)} ${new Date(t.from).getFullYear()}` : `${fmtDay(t.from)} – ${fmtDay(t.to)} ${new Date(t.to).getFullYear()}`)),
              h('ol', null, t.places.map((p) => h('li', null, h('a', { class: 'board-row' + (p === from ? ' found' : ''), href: `#/journal/${p.slug}` }, h('span', { class: 'bpin mini', style: { '--c': catColor(p.category) }, 'aria-hidden': 'true' }, h('i')), h('span', { class: 'board-row-name' }, p.title || 'Untitled'), p.rating != null ? h('small', null, `${p.rating}/5`) : null))))
            )
          )
        : [h('p', { class: 'board-empty' }, 'No places here yet.')])
    );
    focusOnce = false;
  };
  draw();
  return h(
    'div',
    { class: 'atlas board' },
    toolbar,
    h('div', { class: 'board-wall' }, tabs, h('div', { class: 'board-frame' }, h('div', { class: 'board-cork' }, mapHolder, notes)), legend, diary)
  );
}
