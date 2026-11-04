// Little extras around the posts: where a post sits in its series, the "Start here" post for new
// visitors, the fortune cookie and the photo of the day.
import { h, storage } from './util.js';
import { sound } from './sound.js';
import { postHref } from './comments.js';

// ---------- series ----------
// On a post's own page: a quiet line saying which part it is, with the parts either side.
export function seriesLine(post, cls = '') {
  const s = post?.series_info;
  if (!s || s.of < 2) return null;
  const go = (p, words) => (p ? h('a', { class: 'series-go', href: postHref(p), title: p.title || '' }, words) : h('span', { class: 'series-go none', 'aria-hidden': 'true' }, words));
  return h(
    'nav',
    { class: `series-line ${cls}`, 'aria-label': `${s.name}: part ${s.part} of ${s.of}` },
    go(s.prev, '‹ Previous'),
    h('span', { class: 'series-where' }, h('b', null, s.name), ` · part ${s.part} of ${s.of}`),
    go(s.next, 'Next ›')
  );
}
// On a card in the feed: just the series and the part, small.
export function seriesTag(post) {
  const s = post?.series_info;
  if (!s || s.of < 2) return null;
  return h('span', { class: 'series-tag', title: `${s.name}: part ${s.part} of ${s.of}` }, `${s.name} ${s.part}/${s.of}`);
}

// ---------- Start here ----------
// The post new visitors see first. Once they've closed it, it's in its usual place from then on
// (remembered in their own browser).
const local = storage('local');
const seenKey = (p) => `start-here:${p.type}/${p.slug}`;
export function startHerePost(data) {
  const p = data.posts.filter((x) => x.start_here).sort((a, b) => b.ts - a.ts)[0];
  if (!p) return null;
  try {
    if (local?.getItem(seenKey(p))) return null;
  } catch {}
  return p;
}
export function startHereWrap(p, cardEl) {
  const close = h('button', { type: 'button', class: 'start-here-close', 'aria-label': 'Close: I’ve read it' }, 'Got it ✓');
  const wrap = h('section', { class: 'start-here', 'aria-label': 'Start here' }, h('div', { class: 'start-here-head' }, h('span', { class: 'start-here-tag' }, '👋 Start here'), close), cardEl);
  close.addEventListener('click', () => {
    try {
      local?.setItem(seenKey(p), '1');
    } catch {}
    sound.click?.();
    wrap.remove();
  });
  return wrap;
}

// ---------- the fortune cookie ----------
const COOKIE = '<svg viewBox="0 0 32 24" width="22" height="17" aria-hidden="true"><path d="M3 15c0-7 6-12 13-12s13 5 13 12c-3-3-7-4-10-2-2 1-4 4-3 7-6 0-13-1-13-5z" fill="#e8b45a" stroke="#8a5a1c" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 13c2-3 5-5 9-5" fill="none" stroke="#fbe0a8" stroke-width="1.6" stroke-linecap="round"/></svg>';
export function fortuneCookie(data) {
  const lines = data.fortunes || [];
  if (!lines.length) return null;
  const btn = h('button', { type: 'button', class: 'fortune-btn', title: 'Open a fortune cookie', 'aria-expanded': 'false', html: COOKIE });
  const slip = h('span', { class: 'fortune-slip', role: 'status', hidden: true });
  let last = -1;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    let i = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && i === last) i = (i + 1) % lines.length;
    last = i;
    slip.textContent = lines[i];
    slip.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    btn.classList.remove('crack');
    void btn.offsetWidth;
    btn.classList.add('crack');
    sound.chime?.();
    // (Folded away again after a while, or with a tap anywhere else.)
    clearTimeout(timer);
    timer = setTimeout(fold, 9000);
    setTimeout(() => document.addEventListener('click', fold, { once: true }), 0);
  });
  let timer = 0;
  const fold = () => {
    slip.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  return h('span', { class: 'fortune' }, btn, slip);
}

// ---------- photo of the day ----------
// One of your photos, a different one each day (the same for everyone that day), opening its post.
export function photoOfTheDay(data) {
  const all = data.posts.flatMap((p) => (p.photos || []).filter((src) => String(src).startsWith('/media/')).map((src, i) => ({ p, src, cap: p.captions?.[i] || p.title || '' })));
  if (all.length < 2) return null;
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  // (Spread through the year, so neighbours on the list aren't neighbours in time.)
  const pick = all[(day * 7919) % all.length];
  return h(
    'a',
    { class: 'photo-day', href: postHref(pick.p), title: `Photo of the day${pick.cap ? ': ' + pick.cap : ''}` },
    h('img', { src: pick.src, alt: pick.cap || 'Photo of the day', loading: 'lazy' }),
    h('span', { class: 'photo-day-label' }, 'Photo of the day')
  );
}
