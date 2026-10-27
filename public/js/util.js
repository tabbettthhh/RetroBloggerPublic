// Small helpers shared by every screen.

// Build DOM without innerHTML: h('div', {class: 'x', onclick: fn}, 'text', childEl)
export function h(tag, attrs, ...children) {
  const isSvg = tag.startsWith('svg:');
  const el = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', tag.slice(4)) : document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
      else if (k === 'html') el.innerHTML = v; // only ever used for trusted Markdown from your own files
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Dates as written in the file ("2026-10-22 16:08") shown without time-zone surprises.
function parts(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(String(dateStr || ''));
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  const dow = new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay();
  return { y: +y, mo: +mo, d: +d, hh, mm, dow };
}
export function niceDate(dateStr, withTime = false) {
  const p = parts(dateStr);
  if (!p) return '';
  const base = `${DAYS[p.dow]} ${p.d} ${MONTHS[p.mo - 1]}`;
  const yearNow = new Date().getFullYear();
  const yr = p.y !== yearNow ? ` ${p.y}` : '';
  return base + yr + (withTime && p.hh ? ` · ${p.hh.padStart(2, '0')}:${p.mm}` : '');
}
export function stampDate(dateStr, style) {
  const p = parts(dateStr);
  if (!p) return '';
  const dd = String(p.d).padStart(2, '0');
  const mm = String(p.mo).padStart(2, '0');
  const yy = String(p.y).slice(2);
  if (style === 'dots') return `${dd}.${mm}.${yy}`;
  if (style === 'us') return `${MONTHS[p.mo - 1].toUpperCase()} ${dd} ${p.y}`;
  return `${dd} ${MONTHS[p.mo - 1].toUpperCase()} ${p.y}`;
}
export function monthYear(dateStr) {
  const p = parts(dateStr);
  return p ? `${MONTHS[p.mo - 1]} ${p.y}` : '';
}

// Stable pseudo-random number from a string, so stamps tilt the same way every visit.
export function hash(str) {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

export const CATEGORIES = {
  food: { label: 'Food', color: '#e8692c' },
  coffee: { label: 'Coffee', color: '#6b3d1f' },
  drinks: { label: 'Drinks', color: '#b0306a' },
  shopping: { label: 'Shopping', color: '#d4a017' },
  sights: { label: 'Sights', color: '#2a6fd6' },
  culture: { label: 'Culture', color: '#7a4ab8' },
  nature: { label: 'Nature', color: '#7fbf5a' },
  stay: { label: 'Stays', color: '#1f9d8f' }
};
// Colours for your own categories when you don't pick one.
export const CUSTOM_COLORS = ['#c0392b', '#16a085', '#8e44ad', '#d35400', '#34495e', '#e84393', '#6c5ce7', '#00897b', '#a0522d', '#5d8a2a'];
function autoColor(c) {
  let n = 0;
  for (const ch of String(c)) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return CUSTOM_COLORS[n % CUSTOM_COLORS.length];
}
// Adds your own categories (from categories.md) to the built-in ones.
export function registerCategories(list = []) {
  for (const c of list) if (c?.key && !CATEGORIES[c.key]) CATEGORIES[c.key] = { label: c.label, color: c.color || autoColor(c.key), custom: true };
}
export function catColor(c) {
  return CATEGORIES[c]?.color || (c ? autoColor(c) : '#8a8a8a');
}
export function catLabel(c) {
  return (CATEGORIES[c] || { label: c ? c[0].toUpperCase() + c.slice(1) : 'Place' }).label;
}

export function storage(kind = 'local') {
  try {
    const s = kind === 'session' ? window.sessionStorage : window.localStorage;
    const probe = '__probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    const mem = {};
    return { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => (mem[k] = String(v)), removeItem: (k) => delete mem[k] };
  }
}

// Inline icons drawn for this site (no icon fonts, nothing borrowed).
export const ICON = {
  search: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.6" fill="#e8f2ff" stroke="currentColor" stroke-width="1.6"/><path d="M10 10l4.3 4.3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  bubble: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2.5h10a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H6l-3 2.5V9.5H2a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z" fill="#fff8c4" stroke="#8a7a1a"/></svg>',
  pin: '<svg width="12" height="15" viewBox="0 0 12 15" aria-hidden="true"><path d="M6 14s5-5.2 5-8.5A5 5 0 0 0 1 5.5C1 8.8 6 14 6 14z" fill="#e2412e" stroke="#8c1f12"/><circle cx="6" cy="5.5" r="1.8" fill="#fff"/></svg>',
  camera: '<svg width="15" height="13" viewBox="0 0 15 13" aria-hidden="true"><rect x="1" y="3" width="13" height="9" rx="1.5" fill="#d9dde3" stroke="#4a4f57"/><rect x="5" y="1" width="5" height="3" rx="0.8" fill="#4a4f57"/><circle cx="7.5" cy="7.5" r="2.6" fill="#7aa7d9" stroke="#2b3f5c"/></svg>',
  list: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="1" y="1" width="12" height="12" rx="1.5" fill="#fff" stroke="#2a63e0"/><path d="M3.5 4.5h7M3.5 7h7M3.5 9.5h5" stroke="#2a63e0" stroke-width="1.2"/></svg>',
  book: '<svg width="15" height="13" viewBox="0 0 15 13" aria-hidden="true"><path d="M7.5 2.5C6 1.3 3.5 1 1 1.5v10c2.5-.5 5 0 6.5 1 1.5-1 4-1.5 6.5-1v-10c-2.5-.5-5-.2-6.5 1z" fill="#fff6dd" stroke="#8a5a12"/><path d="M7.5 2.5v10" stroke="#8a5a12"/></svg>',
  globe: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#fdfdfd" stroke="#1d4fb8"/><path d="M1 8h14M8 1c2.5 2 2.5 12 0 14M8 1c-2.5 2-2.5 12 0 14" fill="none" stroke="#1d4fb8"/></svg>',
  compass: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="#fff" stroke="#1d5a1d" stroke-width="0.8"/><path d="M10.8 5.2L9 9 5.2 10.8 7 7z" fill="#e2412e"/><circle cx="8" cy="8" r="1" fill="#1d5a1d"/></svg>',
  speaker: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z" fill="#fff"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></svg>',
  speakerOff: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z" fill="#fff"/><path d="M11 6l4 4M15 6l-4 4" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>',
  chevronLeft: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M8 1.5L3.5 6 8 10.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevronDown: '<svg width="9" height="6" viewBox="0 0 9 6" aria-hidden="true"><path d="M1 1l3.5 3.5L8 1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  check: '<svg width="11" height="9" viewBox="0 0 11 9" aria-hidden="true"><path d="M1 4.5l3 3L10 1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  person: (stroke = '#7a4a12') => `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="10" r="5.5" fill="none" stroke="${stroke}" stroke-width="2"/><path d="M4 26c1.5-6 5.5-8.5 10-8.5s8.5 2.5 10 8.5" fill="none" stroke="${stroke}" stroke-width="2"/></svg>`,
  star: (fill) => `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2l2 4.3 4.6.5-3.4 3.1 1 4.6L8 11.4 3.8 13.7l1-4.6L1.4 6l4.6-.5z" fill="${fill}" stroke="#a07a10" stroke-width="0.8"/></svg>`,
  cloud: '<svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M4.5 10.5h7.5a3 3 0 0 0 .3-6 4 4 0 0 0-7.6-.6A3.3 3.3 0 0 0 4.5 10.5z" fill="#dfe6ee" stroke="#5c6c80"/></svg>',
  repeat: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M10 6a4 4 0 1 1-1.2-2.9M9.5 1v2.4H7" fill="none" stroke="#4a3826" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

// Icons are read once and then copied, which is much quicker than reading the same drawing
// again for every star on every card.
const iconCache = new Map();
export function iconEl(svg) {
  const s = h('span', { class: 'ico', 'aria-hidden': 'true' });
  let t = iconCache.get(svg);
  if (!t) {
    t = document.createElement('template');
    t.innerHTML = svg;
    if (iconCache.size < 300) iconCache.set(svg, t);
  }
  s.append(t.content.cloneNode(true));
  return s;
}

// Shows the busy cursor (arrow with a little timer) for a moment on the desktop.
let busyTimer;
export function busy(ms = 700) {
  document.body.classList.add('busy');
  clearTimeout(busyTimer);
  busyTimer = setTimeout(() => document.body.classList.remove('busy'), ms);
}

// Scrolls whatever a thing sits in (the phone screen, a desktop window) so that the thing is
// in the middle, once it's on the page. Only that box scrolls, never the desktop behind it.
export function bringIntoView(el) {
  let tries = 0;
  const go = () => {
    if (!el.isConnected || !el.offsetParent) return ++tries < 120 && requestAnimationFrame(go);
    let box = el.parentElement;
    while (box && box !== document.body && !(box.scrollHeight > box.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    const r = el.getBoundingClientRect();
    if (!box || box === document.body) return window.scrollBy(0, r.top - (window.innerHeight - r.height) / 2);
    const b = box.getBoundingClientRect();
    box.scrollTop += r.top - b.top - (b.height - r.height) / 2;
  };
  requestAnimationFrame(go);
}

export async function postForm(url, data) {
  busy(10000);
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  } finally {
    busy(250);
  }
  let body = {};
  try {
    body = await res.json();
  } catch {}
  if (!res.ok) throw new Error(body.error || 'That did not go through. Try again.');
  return body;
}
