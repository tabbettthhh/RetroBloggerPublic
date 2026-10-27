// The desktop screensaver: a night sky with bits of the site drifting past, picked at random
// and swapped one at a time: photos, book covers, film tickets, tapes, records, passport
// stamps, thoughts, quotes, lists, the status and the flight log.
import { h, catLabel } from './util.js';
import { bookCover, ticket, cassette, record, vhs } from './shelves.js';
import { stampSvg, INK_DEFS, passportStamps } from './stamps.js';
import { withEmoticons } from './emoticons.js';
import { floppySvg, LINES } from './helper.js';
import { ABOUT } from './floppy-lines.js';
import { startPipes } from './pipes.js';

const COVERS = { books: bookCover, films: ticket, podcasts: cassette, music: record, tv: vhs };

function plain(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}
const cut = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s);
// (A rating outside 0–5 in a hand-written file is kept to 0–5 here.)
const starText = (n) => {
  if (n == null || !Number.isFinite(+n)) return '';
  const k = Math.max(0, Math.min(5, Math.round(n)));
  return '★'.repeat(k) + '☆'.repeat(5 - k);
};
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Everything that could float by. Each entry makes a fresh element when it's its turn.
function pool(data) {
  const out = [];
  const posts = data.posts;
  for (const p of posts) {
    p.photos.forEach((src, i) => out.push({ cat: 'photo', info: { title: p.captions[i] || p.title || '', floppy: p.floppy }, id: `ph:${src}`, make: () => h('figure', { class: 'ss-polaroid' }, h('img', { src, alt: '' }), h('figcaption', null, p.captions[i] || p.title || '')) }));
    if (COVERS[p.type] && p.title) {
      out.push({
        cat: 'cover',
        info: { type: p.type, title: p.title, rating: p.rating, creator: p.creator, page: p.page, pages: p.pages, state: p.state, season: p.season, episode: p.episode, best: bestEpisode(p), floppy: p.floppy },
        id: `cv:${p.slug}`,
        make: () => h('div', { class: `ss-cover ss-${p.type}` }, COVERS[p.type](p), h('span', { class: 'ss-cap' }, p.title, p.rating != null ? h('small', null, starText(p.rating)) : null))
      });
    }
    if (p.type === 'thoughts') {
      const text = cut(p.excerpt || plain(p.html), 150);
      if (text) out.push({ cat: 'thought', info: { floppy: p.floppy }, id: `th:${p.slug}`, make: () => h('div', { class: 'ss-sticky' }, text) });
    }
    if (p.type === 'quotes') {
      const text = cut(plain(p.html).replace(/^["“]|["”]$/g, ''), 160);
      if (text) out.push({ cat: 'quote', info: { floppy: p.floppy }, id: `qt:${p.slug}`, make: () => h('blockquote', { class: 'ss-quote' }, h('p', null, text), p.source ? h('cite', null, '— ' + p.source) : null) });
    }
    if (p.type === 'lists') {
      const div = document.createElement('div');
      div.innerHTML = p.html || '';
      const items = [...div.querySelectorAll('li')].slice(0, 5).map((li) => cut(li.textContent.trim(), 40)).filter(Boolean);
      if (items.length) out.push({ cat: 'list', info: { title: p.title, floppy: p.floppy }, id: `ls:${p.slug}`, make: () => h('div', { class: 'ss-list' }, p.title ? h('strong', null, p.title) : null, h('ol', null, items.map((t) => h('li', null, t)))) });
    }
  }
  passportStamps(posts.filter((p) => p.type === 'places'), data.visited || []).forEach((c, i) => {
    const place = c.slug ? posts.find((x) => x.slug === c.slug && x.type === 'places') : null;
    out.push({ cat: 'stamp', info: { city: c.city, floppy: place?.floppy || [], category: place?.category || '', categoryLabel: place?.category ? catLabel(place.category) : '' }, id: `st:${c.city}`, make: () => h('div', { class: 'ss-stamp', html: stampSvg({ ...c, index: 900 + i }) }) });
  });
  if (data.site.status) {
    out.push({
      cat: 'status',
      info: {},
      id: 'status',
      make: () => h('div', { class: 'ss-bubble' }, h('small', null, `${data.site.owner || 'Me'} says:`), h('span', null, withEmoticons(data.site.status, 18)))
    });
  }
  const s = data.stats;
  if (s && (s.flights || s.distance_km)) {
    out.push({
      cat: 'flights',
      info: { km: s.distance_km, flights: s.flights, hours: s.hours, countries: s.countries },
      id: 'flights',
      make: () =>
        h(
          'div',
          { class: 'ss-pass' },
          h('span', { class: 'ss-pass-top' }, 'BOARDING PASS · FLIGHT LOG'),
          h('b', null, s.distance_km ? `${Number(s.distance_km).toLocaleString('en-GB')} km` : `${s.flights} flights`),
          h('span', null, [s.flights && `${s.flights} flights`, s.countries && `${s.countries} countries`, s.hours && `${s.hours} h aloft`].filter(Boolean).join(' · '))
        )
    });
  }
  return out;
}

// Where things float, as % of the screen, with a tilt. A phone has room for four.
const SPOTS = [[5, 7, -7], [27, 20, 5], [49, 5, -3], [71, 16, 7], [8, 50, 6], [33, 56, -5], [57, 47, 3], [79, 54, -7]];
const PHONE_SPOTS = [[4, 6, -6], [46, 22, 5], [6, 46, 4], [44, 62, -5]];
const PHONE_SPOTS_WIDE = [[4, 8, -6], [28, 40, 5], [52, 6, -4], [74, 38, 6]];

export function makeScreensaver(data) {
  let el = null;
  let timer = null;
  // The tap that wakes the screen only wakes it: it doesn't also press whatever is underneath.
  const swallow = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const stop = (e) => {
    if (!el) return;
    clearInterval(timer);
    el.floppyStop?.();
    el.pipesStop?.();
    el.remove();
    el = null;
    window.removeEventListener('pointermove', stop);
    window.removeEventListener('keydown', stop);
    window.removeEventListener('pointerdown', stop);
    document.removeEventListener('visibilitychange', away);
    if (e?.type === 'pointerdown') {
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 700);
    }
  };
  // Nothing keeps running once the screen is off or the tab is in the background.
  const away = () => document.hidden && stop();
  return {
    start() {
      if (el) return;
      const phone = matchMedia('(max-width: 899px), (pointer: coarse)').matches;
      const spots = !phone ? SPOTS : innerWidth > innerHeight ? PHONE_SPOTS_WIDE : PHONE_SPOTS;
      const items = shuffle(pool(data));
      const slots = spots.slice(0, Math.max(1, Math.min(spots.length, items.length || 1)));
      // Kinds take turns, so 16 passport stamps don't crowd out one lonely quote:
      // the next pick comes from whichever kind has the fewest things showing.
      const groups = new Map();
      for (const it of items) (groups.get(it.cat) || groups.set(it.cat, []).get(it.cat)).push(it);
      const onScreen = new Map(); // id → kind
      // `avoid` is the kind just taken off, so a spot doesn't get the same kind straight back.
      const take = (avoid) => {
        if (!items.length) return null;
        const showing = (c) => [...onScreen.values()].filter((x) => x === c).length;
        let open = [...groups.keys()].filter((c) => groups.get(c).some((it) => !onScreen.has(it.id)));
        if (!open.length) return items[Math.floor(Math.random() * items.length)];
        if (open.length > 1) open = open.filter((c) => c !== avoid);
        const least = Math.min(...open.map(showing));
        const pickFrom = open.filter((c) => showing(c) <= least + 1);
        const group = groups.get(pickFrom[Math.floor(Math.random() * pickFrom.length)]);
        const k = group.findIndex((it) => !onScreen.has(it.id));
        const [it] = group.splice(k, 1);
        group.push(it); // to the back of its queue
        return it;
      };
      const fill = (slot, i) => {
        const was = slot.dataset.id ? onScreen.get(slot.dataset.id) : null;
        if (slot.dataset.id) onScreen.delete(slot.dataset.id);
        const it = take(was);
        slot.replaceChildren(it ? it.make() : h('span', { class: 'ss-blank' }));
        slot.dataset.id = it ? it.id : '';
        if (it) onScreen.set(it.id, it.cat);
        slot.item = it;
        slot.classList.remove('ss-out');
        slot.classList.add('ss-in');
      };
      const slotEls = slots.map(([x, y, r], i) => {
        const slot = h('div', { class: 'ss-slot', style: { left: x + '%', top: y + '%', '--r': r + 'deg', animationDuration: 9 + (i % 4) * 2 + 's', animationDelay: -i * 1.3 + 's' } });
        fill(slot, i);
        return slot;
      });
      const defs = h('div', { class: 'ink-defs', html: INK_DEFS });
      const pipes = h('canvas', { class: 'ss-pipes' });
      el = h('div', { class: 'screensaver' + (phone ? ' ss-phone' : ''), 'aria-hidden': 'true' }, pipes, defs, slotEls, h('span', { class: 'ss-note' }, `${data.site.name} · ${phone ? 'tap' : 'move the mouse'} to come back`));
      document.body.append(el);
      // Shiny pipes growing behind everything (not on low-powered phones).
      if (!document.documentElement.classList.contains('lite')) el.pipesStop = startPipes(pipes);
      document.addEventListener('visibilitychange', away);
      const fl = screensaverFloppy(el, slotEls, data);
      // Every few seconds one thing fades out and something else drifts in.
      if (items.length > slots.length || items.length > 1) {
        let last = -1;
        timer = setInterval(() => {
          let k = Math.floor(Math.random() * slotEls.length);
          if (k === last && slotEls.length > 1) k = (k + 1) % slotEls.length;
          last = k;
          const slot = slotEls[k];
          slot.classList.remove('ss-in');
          slot.classList.add('ss-out');
          setTimeout(() => el && fill(slot, k), 900);
        }, 5000);
      }
      setTimeout(() => {
        window.addEventListener('pointermove', stop);
        window.addEventListener('keydown', stop);
        window.addEventListener('pointerdown', stop);
      }, 600);
    }
  };
}

// ---------- Floppy, wandering about ----------

const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
const q = (t) => `“${t.length > 30 ? t.slice(0, 30) + '…' : t}”`;

// Something to say about whatever he's landed next to: usually what you wrote for him
// on that post (if you did), otherwise one of his lines for that kind of thing.
function remark(it, data) {
  const i = it?.info || {};
  if (i.floppy?.length && Math.random() < 0.65) return pickOne(i.floppy);
  const who = (data.site.owner || '').split(/\s+/)[0] || 'They';
  const make = it?.cat === 'cover' ? ABOUT[i.type] : ABOUT[it?.cat];
  const lines = make ? make({ ...i, who }).filter(Boolean) : [];
  return lines.length ? pickOne(lines) : pickOne(LINES);
}

// The best-rated episode in a show's diary, if it's worth bragging about.
function bestEpisode(p) {
  let best = null;
  for (const e of p.episodes || []) if (e.rating != null && e.rating >= 4 && (!best || e.rating > best.rating)) best = e;
  if (!best) return null;
  const se = best.season || p.season || '';
  const eps = best.to ? `${best.ep}–${best.to}` : best.ep;
  return { label: /^\d+$/.test(String(se)) && eps ? `S${se} E${eps}` : eps ? `Episode ${eps}` : 'One episode', title: best.title, rating: best.rating };
}

const ACTION = { stamp: 'ss-thump', cover: 'ss-spin', photo: 'ss-poke', thought: 'ss-flutter', list: 'ss-flutter' };

function screensaverFloppy(root, slots, data) {
  const say = h('div', { class: 'ss-fl-say' });
  const body = h('div', { class: 'ss-fl-body', html: floppySvg() });
  const fl = h('div', { class: 'ss-floppy' }, say, body);
  root.append(fl);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  let x = window.innerWidth - 120;
  let y = window.innerHeight - 160;
  const place = () => {
    fl.style.left = x + 'px';
    fl.style.top = y + 'px';
    fl.classList.add('moving');
    later(() => fl.classList.remove('moving'), 2200);
    // Speech goes underneath when he's near the top.
    fl.classList.toggle('say-below', y < 120);
    fl.classList.toggle('say-left', x > window.innerWidth - 300);
  };
  place();
  const talk = (text) => {
    say.textContent = text;
    say.classList.remove('show');
    void say.offsetWidth;
    say.classList.add('show');
  };
  const step = () => {
    const full = slots.filter((s) => s.item && s.firstElementChild && !s.classList.contains('ss-out'));
    const target = !still && full.length && Math.random() < 0.8 ? pickOne(full) : null;
    say.classList.remove('show');
    if (target) {
      const r = target.firstElementChild.getBoundingClientRect();
      const right = r.right + 70 < window.innerWidth;
      const nx = right ? r.right - 18 : r.left - 52;
      const ny = Math.max(20, Math.min(window.innerHeight - 110, r.top + r.height / 2 - 40));
      body.classList.toggle('face-left', nx < x);
      x = nx;
      y = ny;
      place();
      later(() => {
        const kind = target.item?.cat;
        const child = target.firstElementChild;
        const fx = ACTION[kind] || 'ss-poke';
        child?.classList.remove(fx);
        void child?.offsetWidth;
        child?.classList.add(fx);
        body.classList.add('hop');
        later(() => body.classList.remove('hop'), 600);
        talk(remark(target.item, data));
      }, still ? 0 : 2300);
    } else {
      if (!still) {
        body.classList.toggle('face-left', Math.random() < 0.5);
        x = 40 + Math.random() * (window.innerWidth - 200);
        y = 40 + Math.random() * (window.innerHeight - 220);
        place();
      }
      later(() => talk(pickOne(LINES)), still ? 0 : 2300);
    }
  };
  later(step, 1200);
  const loop = setInterval(step, 8000);
  root.floppyStop = () => {
    clearInterval(loop);
    timers.forEach(clearTimeout);
  };
  return fl;
}
