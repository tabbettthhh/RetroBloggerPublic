// The planner (#/planner): your lists from planner.md, kept in a leather personal organiser.
// On a computer it lies open: a month on the left page (with what's due marked in pen), the
// list on the right, ring binder down the middle and an index tab for each list. On a phone it's
// one page at a time, the tabs along the top and the month underneath. Lists are written in the
// back office (Posts › Planner); visitors only read them. Private lists never reach the site.
import { h } from './util.js';
import { sound } from './sound.js';

const TAB_COLOURS = ['#c0392b', '#2f6f9f', '#3f7a4a', '#c99a2a', '#7a4a8a', '#2a7a72', '#b5651d', '#8a2a4a', '#4a5a8a', '#6a7a2a', '#a33a6a', '#3a6a8a'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isWish = (l) => /wish|want|someday|dream/i.test(l.name);
const dayName = (s) => {
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(+d) ? s : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

// A box drawn in pen, ticked if it's done (a star for a wish, filled in once it came true).
const BOX = (done) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4.2 5.1c5-.6 10.2-.8 15.4-.2.5 4.9.6 9.8.1 14.6-5 .6-10.2.5-15.2.1-.6-4.8-.7-9.6-.3-14.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>${done ? '<path d="M6.5 12.4c1.6 1.4 3 3 4.2 4.8 2.4-4.6 5.5-8.6 9.6-12.3" fill="none" stroke="var(--pln-tick, #c0392b)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' : ''}</svg>`;
const STAR = (done) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" fill="${done ? 'var(--pln-star, #e2b23a)' : 'none'}" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;

function monthPage(state, lists, redraw) {
  const { y, m } = state.month;
  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const today = iso(new Date());
  // What's due on each day, from every list.
  const due = {};
  lists.forEach((l, li) => l.items.forEach((it) => it.due && (due[it.due] ||= []).push({ ...it, li })));
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(h('span', { class: 'pln-day blank', 'aria-hidden': 'true' }));
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${pad(m + 1)}-${pad(d)}`;
    const here = due[key] || [];
    cells.push(
      h(
        'button',
        {
          type: 'button',
          class: 'pln-day' + (key === today ? ' today' : '') + (here.length ? ' has' : '') + (state.day === key ? ' on' : ''),
          'aria-pressed': String(state.day === key),
          'aria-label': `${dayName(key)}${here.length ? `: ${here.length} to do` : ''}`,
          onclick: () => {
            state.day = state.day === key ? '' : key;
            redraw();
          }
        },
        h('span', null, String(d)),
        here.length ? h('i', { class: 'pln-dots', 'aria-hidden': 'true' }, here.slice(0, 3).map((x) => h('b', { style: { background: TAB_COLOURS[x.li % TAB_COLOURS.length] } }))) : null
      )
    );
  }
  const go = (n) => {
    const d = new Date(y, m + n, 1);
    state.month = { y: d.getFullYear(), m: d.getMonth() };
    sound.page?.();
    redraw();
  };
  // Coming up: the next few things with a date, not yet done.
  const soon = Object.entries(due)
    .filter(([k]) => k >= today)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([k, xs]) => xs.filter((x) => !x.done).map((x) => ({ ...x, k })))
    .slice(0, 5);
  return h(
    'section',
    { class: 'pln-page pln-month', 'aria-label': 'Calendar' },
    h('header', { class: 'pln-month-head' }, h('button', { type: 'button', class: 'pln-turn', 'aria-label': 'The month before', onclick: () => go(-1) }, '‹'), h('h3', null, first.toLocaleDateString('en-GB', { month: 'long' }), h('small', null, String(y))), h('button', { type: 'button', class: 'pln-turn', 'aria-label': 'The month after', onclick: () => go(1) }, '›')),
    h('div', { class: 'pln-week', 'aria-hidden': 'true' }, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('span', null, d))),
    h('div', { class: 'pln-grid' }, cells),
    h('div', { class: 'pln-soon' }, h('h4', null, 'Coming up'), soon.length ? h('ul', null, soon.map((x) => h('li', null, h('b', { style: { color: TAB_COLOURS[x.li % TAB_COLOURS.length] } }, dayName(x.k)), ' ', x.text))) : h('p', null, 'Nothing with a date. Lovely.'))
  );
}

function itemRow(it, wish) {
  const today = iso(new Date());
  const late = it.due && !it.done && it.due < today;
  return h(
    'li',
    { class: 'pln-item' + (it.done ? ' done' : '') + (late ? ' late' : '') },
    h('span', { class: 'pln-box', role: 'img', 'aria-label': it.done ? (wish ? 'Came true' : 'Done') : wish ? 'Still wishing' : 'To do', html: wish ? STAR(it.done) : BOX(it.done) }),
    h('span', { class: 'pln-text' }, h('span', { class: 'pln-what' }, it.text), it.due ? h('small', { class: 'pln-due' }, late ? `was due ${dayName(it.due)}` : `by ${dayName(it.due)}`) : null, it.note ? h('span', { class: 'pln-note' }, it.note) : null),
    wish && it.done ? h('span', { class: 'pln-got', 'aria-hidden': 'true' }, 'Got it!') : null
  );
}

function listPage(state, lists) {
  const l = lists[state.at] || lists[0];
  const wish = isWish(l);
  let items = l.items;
  if (state.day) items = lists.flatMap((x) => x.items.filter((it) => it.due === state.day));
  const open = items.filter((x) => !x.done);
  const done = items.filter((x) => x.done);
  return h(
    'section',
    { class: 'pln-page pln-list', style: { '--tab': TAB_COLOURS[state.at % TAB_COLOURS.length] }, 'aria-label': state.day ? `Due ${dayName(state.day)}` : l.name },
    h('h2', { class: 'pln-title' }, state.day ? `Due ${dayName(state.day)}` : l.name),
    !state.day && l.items.length ? h('p', { class: 'pln-count' }, wish ? `${done.length} of ${items.length} came true` : `${done.length} of ${items.length} done`) : null,
    items.length ? h('ul', { class: 'pln-items' }, [...open, ...done].map((it) => itemRow(it, wish && !state.day))) : state.day ? h('p', { class: 'pln-empty' }, 'Nothing due that day.') : null,
    !state.day && l.notes ? h('div', { class: 'pln-notes' }, l.notes.split(/\n{2,}/).map((p) => h('p', null, p.split('\n').flatMap((line, i) => (i ? [h('br'), line] : [line]))))) : null,
    !state.day && !l.items.length && !l.notes ? h('p', { class: 'pln-empty' }, 'A blank page.') : null
  );
}

export function plannerApp(ctx) {
  const lists = ctx.data.planner || [];
  const now = new Date();
  const state = { at: 0, day: '', month: { y: now.getFullYear(), m: now.getMonth() } };
  // A list can be opened by name: #/planner/To%20do
  if (ctx.param) {
    const i = lists.findIndex((l) => l.name.toLowerCase() === decodeURIComponent(ctx.param).toLowerCase());
    if (i >= 0) state.at = i;
  }
  const book = h('div', { class: 'pln-book' });
  const wide = () => ctx.desktop || ctx.tablet;
  const draw = () => {
    if (!lists.length) return book.replaceChildren(h('div', { class: 'pln-page pln-list' }, h('p', { class: 'pln-empty' }, 'Nothing in the planner yet.')));
    const tabs = h(
      'nav',
      { class: 'pln-tabs', 'aria-label': 'Lists' },
      lists.map((l, i) =>
        h(
          'button',
          {
            type: 'button',
            class: 'pln-tab' + (i === state.at && !state.day ? ' on' : ''),
            style: { '--tab': TAB_COLOURS[i % TAB_COLOURS.length] },
            'aria-pressed': String(i === state.at && !state.day),
            onclick: () => {
              state.at = i;
              state.day = '';
              sound.page?.();
              draw();
            }
          },
          l.name
        )
      )
    );
    const rings = h('span', { class: 'pln-rings', 'aria-hidden': 'true' }, Array.from({ length: 6 }, () => h('i')));
    const month = monthPage(state, lists, draw);
    const list = listPage(state, lists);
    book.classList.toggle('wide', wide());
    book.replaceChildren(...(wide() ? [month, rings, list, tabs] : [tabs, rings, list, month]));
  };
  draw();
  return h('div', { class: 'pln-desk' }, h('div', { class: 'pln-cover' }, book, h('span', { class: 'pln-strap', 'aria-hidden': 'true' }, h('i'))));
}
