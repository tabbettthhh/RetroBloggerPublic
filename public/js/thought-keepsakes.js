// Keepsakes for thoughts (and photo dumps): memories, the sky in all its moods, the gym and
// the time of day. Plus the "reliving a memory" flair a thought about the past gets.
import { h } from './util.js';

// ---- small helpers (the same look as the keepsakes in apps.js) ----
const wrapOf = (kind, aria, ...kids) => h('div', { class: 'ticket-wrap ' + kind }, h('div', { class: 'ks ks-' + kind, role: 'group', 'aria-label': aria }, ...kids));
const words = (list, fallback) => (list.length ? list.map((o) => o.item) : fallback ? [fallback] : []).map((t) => h('span', null, t));
const note = (list, fallback) => {
  const w = words(list, fallback);
  return w.length ? h('span', { class: 'pf-note' }, w) : null;
};
function hash(str) {
  let n = 2166136261;
  for (let i = 0; i < str.length; i++) n = Math.imul(n ^ str.charCodeAt(i), 16777619);
  return n >>> 0;
}
const pick = (post, salt, list) => list[hash(post.slug + salt) % list.length];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n) => String(n).padStart(2, '0');
// The time on the first line ("7:30", "07.30", "23:05"), or when the post was written.
function timeOf(post, list) {
  const m = /(\d{1,2})[:.](\d{2})/.exec(list?.[0]?.item || '');
  if (m && +m[1] < 24 && +m[2] < 60) return { hh: +m[1], mm: +m[2], said: true };
  const d = new Date(post.ts || Date.now());
  return { hh: d.getHours(), mm: d.getMinutes(), said: false };
}
const clock = ({ hh, mm }) => `${pad(hh)}:${pad(mm)}`;
const firstNumber = (list, fallback) => {
  const m = /(\d[\d,.]*)/.exec(list?.[0]?.item || '');
  return m ? m[1] : fallback;
};

// ---------- Reliving a memory ----------
// "2019", "2019-07" or "2019-07-14" → how to say it, and how long ago it was.
export function memoryInfo(post) {
  if (!post.memory) return null;
  const [y, mo, d] = post.memory.split('-').map(Number);
  const label = d ? `${d} ${MONTHS[mo - 1]} ${y}` : mo ? `${MONTHS[mo - 1]} ${y}` : String(y);
  const now = new Date(post.ts || Date.now());
  const years = now.getFullYear() - y - (mo && (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && d && now.getDate() < d)) ? 1 : 0);
  const ago = years >= 1 ? `${years} year${years === 1 ? '' : 's'} ago` : mo ? 'earlier this year' : 'this year';
  const short = mo ? `${MONTHS[mo - 1].slice(0, 3)} '${String(y).slice(2)}` : `'${String(y).slice(2)}`;
  return { y, mo, d, label, ago, years, short };
}
// The ribbon across a memory: a little rewind sign, when it was, and how long ago.
export function memoryRibbon(post, big = false) {
  const m = memoryInfo(post);
  if (!m) return null;
  return h(
    'div',
    { class: 'mem-ribbon' + (big ? ' big' : '') },
    h('span', { class: 'mem-rew', 'aria-hidden': 'true' }, '◀◀'),
    h('span', { class: 'mem-what' }, 'Reliving a memory'),
    h('span', { class: 'mem-when' }, m.label),
    h('span', { class: 'mem-ago' }, m.ago)
  );
}

function negativesKeepsake(post) {
  const frames = (post.photos?.length ? post.photos.slice(0, 4) : [null, null, null]).map((src, k) =>
    h('span', { class: 'ng-frame' }, src ? h('img', { src, alt: '', loading: 'lazy' }) : h('span', { class: 'ng-blank', style: { '--k': k } }))
  );
  return wrapOf('negatives', 'Film negatives', h('span', { class: 'ng-edge' }, `SAFETY FILM 400 ▸ ${(hash(post.slug) % 30) + 1}`), h('span', { class: 'ng-row' }, frames), h('span', { class: 'ng-edge' }, '▸ 24A ▸ 25 ▸ 25A'), note(post.negatives));
}
function oldprintKeepsake(post) {
  const m = memoryInfo(post);
  const src = post.photos?.[0];
  return wrapOf('oldprint', 'Old photo', h('span', { class: 'op-photo' }, src ? h('img', { src, alt: '', loading: 'lazy' }) : h('span', { class: 'op-paint', 'aria-hidden': 'true' })), h('span', { class: 'op-back' }, post.oldprint[0]?.item || (m ? (m.mo ? m.short : m.y) : 'way back when')));
}
function calendarKeepsake(post) {
  const m = memoryInfo(post);
  const d = new Date(post.ts || Date.now());
  const month = m?.mo ? MONTHS[m.mo - 1] : m ? 'The year' : MONTHS[d.getMonth()];
  const big = m ? (m.d || (m.mo ? '' : m.y)) || String(m.y) : d.getDate();
  return wrapOf('calendar', 'Calendar page', h('span', { class: 'cl-rings', 'aria-hidden': 'true' }), h('span', { class: 'cl-month' }, month.toUpperCase()), h('strong', { class: 'cl-day' }, String(big)), h('span', { class: 'cl-year' }, m ? (m.d ? String(m.y) : '') : String(d.getFullYear())), post.calendar.length ? h('span', { class: 'cl-note' }, words(post.calendar)) : null);
}
function vhstapeKeepsake(post) {
  const m = memoryInfo(post);
  return wrapOf('vhstape', 'Video tape', h('span', { class: 'vh-reels', 'aria-hidden': 'true' }, h('i'), h('i')), h('span', { class: 'vh-label' }, h('b', null, post.vhstape[0]?.item || `Memories ${m ? m.y : ''}`.trim()), h('small', null, post.vhstape[1]?.item || 'do not tape over!')));
}
function envelopeKeepsake(post) {
  const m = memoryInfo(post);
  const year = m ? m.y : new Date(post.ts || Date.now()).getFullYear();
  return wrapOf('envelope', 'Old letter', h('span', { class: 'ev-stamp', 'aria-hidden': 'true' }, h('i', null, '✿')), h('span', { class: 'ev-mark' }, h('small', null, m?.mo ? MONTHS[m.mo - 1].slice(0, 3).toUpperCase() : 'POST'), h('b', null, String(year))), h('span', { class: 'ev-to' }, words(post.envelope, 'to future me')), h('span', { class: 'ev-air', 'aria-hidden': 'true' }));
}
function thennowKeepsake(post) {
  const m = memoryInfo(post);
  const now = new Date(post.ts || Date.now()).getFullYear();
  return wrapOf('thennow', 'Then and now', h('span', { class: 'tn-col' }, h('small', null, 'THEN'), h('b', null, m ? String(m.y) : '…')), h('span', { class: 'tn-arrow', 'aria-hidden': 'true' }, '→'), h('span', { class: 'tn-col' }, h('small', null, 'NOW'), h('b', null, String(now))), h('span', { class: 'tn-ago' }, post.thennow[0]?.item || (m && m.years >= 1 ? `${m.years} year${m.years === 1 ? '' : 's'} later` : 'and here we are')));
}
function rewindKeepsake(post) {
  const m = memoryInfo(post);
  const count = String(m ? Math.max(0, m.years) : hash(post.slug) % 100).padStart(4, '0');
  return wrapOf('rewind', 'Rewind', h('span', { class: 'rw-counter', 'aria-label': `${+count} years back` }, count.split('').map((c) => h('i', null, c))), h('span', { class: 'rw-btn' }, '◀◀ REWIND'), note(post.rewind));
}

// ---------- The sky, in all its moods ----------
const svgBox = (inner) => `<svg viewBox="0 0 120 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${inner}</svg>`;
const stars = (n, seed, maxY = 70) => Array.from({ length: n }, (_, k) => {
  const r = hash(seed + k);
  return `<circle cx="${r % 120}" cy="${(r >> 8) % maxY}" r="${(r >> 4) % 3 ? 0.6 : 1.1}" fill="#fff" opacity="${0.5 + ((r >> 2) % 5) / 10}"/>`;
}).join('');
const cloud = (x, y, s, c = '#fff', o = 0.9) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}" opacity="${o}"><circle cx="0" cy="0" r="8"/><circle cx="9" cy="-4" r="10"/><circle cx="20" cy="0" r="8"/><rect x="0" y="0" width="20" height="8"/></g>`;
const SKIES = {
  skysunrise: { name: 'Sunrise', caption: 'up with the sun', paint: 'linear-gradient(180deg, #8fb6e2, #f8c79a 55%, #ff9a5c)', art: () => svgBox(`<circle cx="60" cy="84" r="20" fill="#ffd36b"/><circle cx="60" cy="84" r="28" fill="#ffd36b" opacity=".25"/><path d="M0 84h120v16H0z" fill="#3c3a4e"/><path d="M0 84q30-6 60 0t60 0" fill="#4a4660"/>`) },
  skygolden: { name: 'Golden hour', caption: 'golden hour', paint: 'linear-gradient(180deg, #f7c46a, #f39a52 60%, #d9663c)', art: (p) => svgBox(`<circle cx="86" cy="58" r="12" fill="#fff1b8"/><circle cx="86" cy="58" r="24" fill="#fff1b8" opacity=".3"/><g stroke="#5a3418" stroke-width="1.2">${Array.from({ length: 30 }, (_, k) => `<path d="M${k * 4} 100q${(hash(p.slug + k) % 6) - 3} -${12 + (hash(p.slug + 'g' + k) % 14)} ${(hash(p.slug + 'x' + k) % 8) - 4} -${18 + (hash(p.slug + 'h' + k) % 12)}"/>`).join('')}</g>`) },
  skyrainbow: { name: 'Rainbow', caption: 'after the rain', paint: 'linear-gradient(180deg, #6fa3d8, #b9d6ee)', art: () => svgBox(`<g fill="none" stroke-width="4">${['#e8433a', '#f39a2c', '#f6d33c', '#4cb85c', '#3a86e8', '#7a4bd6'].map((c, k) => `<path d="M10 100a50 50 0 0 1 100 0" transform="translate(0 ${k * 4}) scale(1 ${1 - k * 0.04})" stroke="${c}" opacity=".85" transform-origin="60 100"/>`).join('')}</g>${cloud(8, 82, 1)}${cloud(84, 86, 1.1)}`) },
  skystorm: { name: 'Storm', caption: 'what a storm', paint: 'linear-gradient(180deg, #2b3140, #4a5468 60%, #6a7488)', art: () => svgBox(`${cloud(10, 18, 2.2, '#3a404e', 1)}${cloud(60, 14, 2.4, '#454b5a', 1)}<path d="M64 34l-10 22h9l-7 22 18-28h-10l8-16z" fill="#ffe46b"/><g stroke="#cfd8e8" stroke-width=".8" opacity=".6">${Array.from({ length: 26 }, (_, k) => `<path d="M${(k * 13) % 120} ${40 + ((k * 17) % 50)}l-3 8"/>`).join('')}</g>`) },
  skysnow: { name: 'Snowy sky', caption: 'it snowed!', paint: 'linear-gradient(180deg, #7f8ea3, #b9c4d2)', art: (p) => svgBox(`<path d="M0 82q30-8 60 0t60 0v18H0z" fill="#fff"/>${Array.from({ length: 34 }, (_, k) => { const r = hash(p.slug + 'sn' + k); return `<circle cx="${r % 120}" cy="${(r >> 8) % 80}" r="${1.2 + (r % 3) * 0.6}" fill="#fff" opacity="${0.75 + (r % 4) / 16}"/>`; }).join('')}`) },
  skystars: { name: 'Starry night', caption: 'so many stars', paint: 'linear-gradient(180deg, #0b1230, #1d2a5a 70%, #2e3c74)', art: (p) => svgBox(`${stars(60, p.slug, 100)}<path d="M18 22l40 14" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".9"/><path d="M18 22l40 14" stroke="#fff" stroke-width="3" opacity=".15"/>`) },
  skymoon: { name: 'Full moon', caption: 'the moon tonight', paint: 'linear-gradient(180deg, #0e1838, #22346a)', art: (p) => svgBox(`${stars(22, p.slug + 'm')}<circle cx="78" cy="36" r="18" fill="#f4f1d8"/><circle cx="72" cy="31" r="3.4" fill="#d9d4b4"/><circle cx="84" cy="42" r="4.4" fill="#d9d4b4"/><circle cx="80" cy="28" r="2" fill="#d9d4b4"/><circle cx="78" cy="36" r="28" fill="#f4f1d8" opacity=".12"/>${cloud(20, 74, 1.3, '#3a4a7a', 0.8)}`) },
  skyaurora: { name: 'Northern lights', caption: 'northern lights', paint: 'linear-gradient(180deg, #071226, #0e2440 70%, #12304a)', art: (p) => svgBox(`${stars(30, p.slug + 'a')}<g fill="none" stroke-linecap="round"><path d="M-10 40q30-24 60-6t80-14" stroke="#4cf2a2" stroke-width="10" opacity=".45"/><path d="M-10 52q40-20 70-4t70-12" stroke="#7affc2" stroke-width="6" opacity=".4"/><path d="M0 32q30-18 70-2t60-10" stroke="#b56bff" stroke-width="6" opacity=".35"/></g><path d="M0 100V78l16-12 14 10 18-18 20 16 14-10 20 14 18-10v32z" fill="#0a1424"/>`) },
  skyclouds: { name: 'Fluffy clouds', caption: 'cloud spotting', paint: 'linear-gradient(180deg, #3f86e0, #8cc0f2)', art: () => svgBox(`${cloud(8, 30, 1.6)}${cloud(62, 18, 1.2)}${cloud(70, 62, 2)}${cloud(-6, 74, 1.4)}`) },
  skyfog: { name: 'Foggy morning', caption: 'foggy one', paint: 'linear-gradient(180deg, #c9cdd2, #dfe2e5)', art: () => svgBox(`<g fill="#8a9298" opacity=".45">${[12, 30, 52, 78, 96].map((x, k) => `<path d="M${x} 90l6 -${20 + k * 4} 6 ${20 + k * 4}z"/>`).join('')}</g><g fill="#eef0f2">${[40, 58, 74].map((y, k) => `<rect x="-10" y="${y}" width="140" height="${8 + k * 2}" rx="6" opacity=".7"/>`).join('')}</g>`) },
  skyplane: { name: 'Plane overhead', caption: 'off somewhere', paint: 'linear-gradient(180deg, #2f78d8, #9fcaf4)', art: () => svgBox(`<path d="M-4 86L88 22" stroke="#fff" stroke-width="2.4" opacity=".8" stroke-linecap="round"/><path d="M-4 90L88 26" stroke="#fff" stroke-width="1.2" opacity=".5"/><path d="M90 20l8-3 1 2-5 3 3 2-1 1-4-1-3 2-1-1 2-3-4-1z" fill="#fff"/>${cloud(70, 70, 1.1)}`) },
  skypink: { name: 'Cotton candy', caption: 'pink skies', paint: 'linear-gradient(180deg, #b48ae0, #f3a6c8 55%, #ffd1b0)', art: () => svgBox(`${cloud(4, 40, 1.8, '#ffc0d8', 0.85)}${cloud(60, 26, 1.4, '#f6b2e4', 0.85)}${cloud(50, 70, 2, '#ffd6e6', 0.8)}`) }
};
export const SKY_NAMES = Object.fromEntries(Object.entries(SKIES).map(([k, v]) => [k, v.name]));
function skyPolaroid(post, key) {
  const s = SKIES[key];
  return h('div', { class: 'ticket-wrap sky ' + key }, h('figure', { class: 'ks ks-sky', role: 'group', 'aria-label': 'Polaroid: ' + s.name }, h('span', { class: 'sk-photo', style: { background: s.paint }, html: s.art(post) }), h('figcaption', null, post[key][0]?.item || s.caption)));
}

// ---------- The gym ----------
const WORKOUTS = {
  cardio: ['CARDIO', '#d6332b'],
  hypertrophy: ['HYPERTROPHY', '#7a3fa8'],
  strength: ['STRENGTH', '#1f55b8'],
  mobility: ['MOBILITY', '#2f9e5a'],
  hiit: ['HIIT', '#e07a1c'],
  endurance: ['ENDURANCE', '#1f8f8a'],
  rest: ['REST DAY', '#6a7380'],
  'rest day': ['REST DAY', '#6a7380'],
  yoga: ['YOGA', '#c8506a'],
  'leg day': ['LEG DAY', '#8a1a2a']
};
export const WORKOUT_TYPES = ['cardio', 'hypertrophy', 'strength', 'mobility', 'HIIT', 'endurance', 'yoga', 'leg day', 'rest day'];
function workoutKeepsake(post) {
  const said = (post.workout[0]?.item || '').trim().toLowerCase();
  const [label, colour] = WORKOUTS[said] || WORKOUTS.strength;
  const d = new Date(post.ts || Date.now());
  return wrapOf('workout', 'Workout stamp', h('span', { class: 'wo-stamp', style: { '--wo': colour } }, h('small', null, '★ WORKOUT DONE ★'), h('b', null, WORKOUTS[said] ? label : (post.workout[0]?.item || label).toUpperCase().slice(0, 14)), h('small', null, `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`)), note(post.workout.slice(1)));
}
function gympassKeepsake(post) {
  const visits = firstNumber(post.gympass, String((hash(post.slug) % 90) + 10));
  return wrapOf('gympass', 'Gym pass', h('span', { class: 'gp2-top' }, h('b', null, 'GYM PASS'), h('small', null, 'MEMBER')), h('strong', { class: 'gp2-visit' }, `VISIT Nº ${visits}`), h('span', { class: 'gp2-line' }, post.gympass[1]?.item || (post.type === 'places' ? post.title : 'ALL ACCESS')), h('span', { class: 'gp2-code', 'aria-hidden': 'true' }));
}
function personalbestKeepsake(post) {
  return wrapOf('personalbest', 'Personal best', h('span', { class: 'pb-head' }, 'PERSONAL BEST'), h('strong', { class: 'pb-lift' }, post.personalbest[0]?.item || 'New PB!'), ...post.personalbest.slice(1).map((o) => h('span', { class: 'pb-line' }, o.item)), h('span', { class: 'pb-seal', 'aria-hidden': 'true' }, '★'));
}
const ART = {
  dumbbell: '<svg viewBox="0 0 120 50" width="110" height="46"><rect x="6" y="10" width="10" height="30" rx="3" fill="#2b2b2b"/><rect x="16" y="6" width="12" height="38" rx="3" fill="#3a3a3a"/><rect x="92" y="6" width="12" height="38" rx="3" fill="#3a3a3a"/><rect x="104" y="10" width="10" height="30" rx="3" fill="#2b2b2b"/><rect x="28" y="20" width="64" height="10" rx="3" fill="#9aa1a8"/><path d="M40 22v6M50 22v6M60 22v6M70 22v6M80 22v6" stroke="#6d747b" stroke-width="1.2"/></svg>',
  shaker: '<svg viewBox="0 0 60 110" width="54" height="100"><rect x="14" y="4" width="32" height="12" rx="3" fill="#2b2b2b"/><path d="M12 16h36l-4 88H16z" fill="#e8f0f4" stroke="#9aa6ae" stroke-width="2"/><path d="M14 56h32l-2 48H16z" fill="#c9a07a" opacity=".85"/><path d="M18 30h6M18 40h6M18 50h6" stroke="#9aa6ae" stroke-width="1.4"/></svg>',
  waterbottle: '<svg viewBox="0 0 50 120" width="44" height="108"><rect x="18" y="2" width="14" height="10" rx="2" fill="#2a6fd6"/><path d="M14 12h22v10q8 6 8 16v74a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6V38q0-10 8-16z" fill="#bfe3ff" stroke="#2a6fd6" stroke-width="2"/><path d="M8 60h34v52a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5z" fill="#5aaef0" opacity=".7"/><path d="M14 40v60" stroke="#fff" stroke-width="3" opacity=".6"/></svg>',
  medal: '<svg viewBox="0 0 80 110" width="70" height="96"><path d="M22 0h14l10 40H32zM58 0H44L34 40h14z" fill="#1f55b8"/><path d="M28 0h4l10 40h-4zM48 0h4L42 40h-4z" fill="#d6332b"/><circle cx="40" cy="70" r="28" fill="#e2b04a" stroke="#a87a14" stroke-width="3"/><circle cx="40" cy="70" r="20" fill="none" stroke="#fff3c4" stroke-width="1.4" opacity=".7"/></svg>'
};
const artNote = (kind, aria, art, list, fallback) => wrapOf(kind, aria, h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), note(list, fallback));
function stepsKeepsake(post) {
  const steps = firstNumber(post.steps, ((hash(post.slug) % 15000) + 6000).toLocaleString('en-GB'));
  return wrapOf('steps', 'Step counter', h('span', { class: 'st-body' }, h('small', null, 'STEPS'), h('b', { class: 'st-lcd' }, steps), h('small', null, '👟 TODAY')), note(post.steps.slice(1)));
}
function heartrateKeepsake(post) {
  const bpm = firstNumber(post.heartrate, String(120 + (hash(post.slug) % 50)));
  return wrapOf('heartrate', 'Heart rate', h('span', { class: 'hr-screen', html: '<svg viewBox="0 0 140 40" width="140" height="40" aria-hidden="true"><path d="M0 22h30l6-10 6 22 8-30 8 30 6-12h20l6-8 6 16 6-8h38" fill="none" stroke="#5dff6a" stroke-width="2"/></svg>' }), h('span', { class: 'hr-bpm' }, h('i', { 'aria-hidden': 'true' }, '♥'), ` ${bpm} BPM`), note(post.heartrate.slice(1)));
}
function setsheetKeepsake(post) {
  const rows = post.setsheet.length ? post.setsheet.map((o) => o.item) : ['Squat 5 × 5', 'Bench 4 × 8', 'Rows 3 × 10'];
  return wrapOf('setsheet', 'Training log', h('span', { class: 'ss-head' }, 'TRAINING LOG'), h('ul', { class: 'ss-rows' }, rows.map((t) => h('li', null, h('i', { 'aria-hidden': 'true' }, '✓'), t))));
}
function medalKeepsake(post) {
  return wrapOf('medal', 'Medal', h('span', { class: 'md2-art', 'aria-hidden': 'true', html: ART.medal }, h('b', { class: 'md2-txt' }, (post.medal[0]?.item || 'FINISHER').slice(0, 9))), note(post.medal.slice(1)));
}

// ---------- The time of day ----------
function hands({ hh, mm }) {
  const a = ((hh % 12) + mm / 60) * 30;
  const b = mm * 6;
  return `<path d="M40 48L40 32" stroke="#2b2b2b" stroke-width="3" stroke-linecap="round" transform="rotate(${a} 40 48)"/><path d="M40 48L40 26" stroke="#2b2b2b" stroke-width="2" stroke-linecap="round" transform="rotate(${b} 40 48)"/>`;
}
function alarmclockKeepsake(post) {
  const t = timeOf(post, post.alarmclock);
  const art = `<svg viewBox="0 0 80 90" width="76" height="86"><circle cx="18" cy="16" r="10" fill="#d6332b"/><circle cx="62" cy="16" r="10" fill="#d6332b"/><path d="M22 80l-6 8M58 80l6 8" stroke="#2b2b2b" stroke-width="4" stroke-linecap="round"/><circle cx="40" cy="48" r="30" fill="#d6332b"/><circle cx="40" cy="48" r="24" fill="#fffdf2"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => `<path d="M40 27v3" stroke="#2b2b2b" stroke-width="1.4" transform="rotate(${k * 30} 40 48)"/>`).join('')}${hands(t)}<circle cx="40" cy="48" r="2" fill="#2b2b2b"/></svg>`;
  return wrapOf('alarmclock', 'Alarm clock', h('span', { class: 'mm-art', role: 'img', 'aria-label': clock(t), html: art }), note(post.alarmclock.slice(t.said ? 1 : 0), t.hh < 9 ? 'Rise and shine!' : 'Snoozed it twice.'));
}
function riseshineKeepsake(post) {
  return wrapOf('riseshine', 'Rise and shine', h('span', { class: 'rs-sun', 'aria-hidden': 'true' }), h('strong', { class: 'rs-head' }, 'Rise & shine'), h('span', { class: 'rs-lines' }, words(post.riseshine, 'a brand new day')));
}
function firstcoffeeKeepsake(post) {
  const t = timeOf(post, post.firstcoffee);
  const art = '<svg viewBox="0 0 90 90" width="80" height="80"><path d="M30 10q-6 8 0 14t0 14M44 8q-6 8 0 14t0 14M58 10q-6 8 0 14t0 14" stroke="#9aa1a8" stroke-width="2" fill="none" opacity=".7"/><path d="M14 44h52v18a22 22 0 0 1-22 22h-8a22 22 0 0 1-22-22z" fill="#fffdf2" stroke="#3a2c1c" stroke-width="2"/><path d="M66 50h6a8 8 0 0 1 0 16h-8" fill="none" stroke="#3a2c1c" stroke-width="3"/><ellipse cx="40" cy="45" rx="25" ry="4" fill="#6b4226"/></svg>';
  return wrapOf('firstcoffee', 'First coffee', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, h('b', null, `first coffee · ${clock(t)}`), words(post.firstcoffee.slice(t.said ? 1 : 0))));
}
function lunchbreakKeepsake(post) {
  const t = timeOf(post, post.lunchbreak);
  const art = '<svg viewBox="0 0 90 70" width="84" height="64"><path d="M8 40L45 8l37 32z" fill="#e8c27c" stroke="#b98444" stroke-width="2"/><path d="M8 40h74v6H8z" fill="#7ac36a"/><path d="M8 46h74v5H8z" fill="#e8433a"/><path d="M8 51h74v6H8z" fill="#f6d33c"/><path d="M8 57h74l-37 8z" fill="#e8c27c" stroke="#b98444" stroke-width="2"/></svg>';
  return wrapOf('lunchbreak', 'Lunch break', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, h('b', null, `lunch break · ${clock(t)}`), words(post.lunchbreak.slice(t.said ? 1 : 0))));
}
function teatimeKeepsake(post) {
  const art = '<svg viewBox="0 0 100 70" width="92" height="64"><path d="M44 6q-5 7 0 12t0 12" stroke="#9aa1a8" stroke-width="2" fill="none" opacity=".7"/><path d="M18 30h50v10a25 25 0 0 1-25 25 25 25 0 0 1-25-25z" fill="#fff" stroke="#3a6fd8" stroke-width="2"/><path d="M24 40q19 6 38 0" stroke="#3a6fd8" stroke-width="1.4" fill="none"/><path d="M68 36h5a7 7 0 0 1 0 14h-6" fill="none" stroke="#3a6fd8" stroke-width="3"/><ellipse cx="43" cy="66" rx="34" ry="4" fill="#e9eef8" stroke="#3a6fd8" stroke-width="1.4"/><circle cx="86" cy="60" r="10" fill="#d9a860" stroke="#b98444" stroke-width="1.4"/><circle cx="83" cy="57" r="1" fill="#8a5a2a"/><circle cx="89" cy="62" r="1" fill="#8a5a2a"/></svg>';
  return artNote('teatime', 'Tea time', art, post.teatime, 'Time for tea.');
}
function nightowlKeepsake(post) {
  const t = timeOf(post, post.nightowl);
  const art = '<svg viewBox="0 0 90 90" width="84" height="84"><circle cx="60" cy="26" r="18" fill="#f4f1d0"/><circle cx="66" cy="22" r="16" fill="#1d2a5a" opacity="0"/><path d="M22 84q-14-30 4-52 8-10 22-10t22 10q18 22 4 52z" fill="#8a6a4a"/><circle cx="36" cy="44" r="10" fill="#fff6d0"/><circle cx="58" cy="44" r="10" fill="#fff6d0"/><circle cx="36" cy="44" r="5" fill="#2b2b2b"/><circle cx="58" cy="44" r="5" fill="#2b2b2b"/><path d="M44 52l3 6 3-6z" fill="#e8a33a"/><path d="M26 26l8 8M70 26l-8 8" stroke="#8a6a4a" stroke-width="5" stroke-linecap="round"/><path d="M14 84h66" stroke="#5a3a1a" stroke-width="4" stroke-linecap="round"/></svg>';
  return wrapOf('nightowl', 'Night owl', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: art }), h('span', { class: 'pf-note' }, h('b', null, `night owl · ${clock(t)}`), words(post.nightowl.slice(t.said ? 1 : 0))));
}
function sleepmaskKeepsake(post) {
  const art = '<svg viewBox="0 0 120 60" width="110" height="55"><path d="M4 26q2-6 12-6M116 26q-2-6-12-6" stroke="#2b2b2b" stroke-width="2" fill="none"/><path d="M14 18q46-14 92 0 6 16-4 28-18 8-30-2-12-8-24 0-12 10-30 2-10-12-4-28z" fill="#c8a8e8" stroke="#7a5aa8" stroke-width="2"/><path d="M30 32q8 6 16 0M74 32q8 6 16 0" stroke="#4a2a7a" stroke-width="2" fill="none" stroke-linecap="round"/><text x="96" y="12" font-family="Caveat, cursive" font-size="14" fill="#7a5aa8">z z</text></svg>';
  return artNote('sleepmask', 'Sleep mask', art, post.sleepmask, 'Off to bed.');
}
function ledclockKeepsake(post) {
  const t = timeOf(post, post.ledclock);
  const h12 = t.hh % 12 || 12;
  return wrapOf('ledclock', 'Digital clock', h('span', { class: 'lc2-body' }, h('b', { class: 'lc2-digits' }, `${pad(h12)}:${pad(t.mm)}`), h('small', null, t.hh < 12 ? 'AM' : 'PM')), note(post.ledclock.slice(t.said ? 1 : 0)));
}

// The makers for one post, in the order they're stuck in (like keepsakeMakers in apps.js).
const MAKERS = {
  negatives: negativesKeepsake, oldprint: oldprintKeepsake, calendar: calendarKeepsake, vhstape: vhstapeKeepsake, envelope: envelopeKeepsake, thennow: thennowKeepsake, rewind: rewindKeepsake,
  ...Object.fromEntries(Object.keys(SKIES).map((k) => [k, (post) => skyPolaroid(post, k)])),
  workout: workoutKeepsake, gympass: gympassKeepsake, personalbest: personalbestKeepsake,
  dumbbell: (p) => artNote('dumbbell', 'Dumbbell', ART.dumbbell, p.dumbbell, 'Lift heavy, rest well.'),
  steps: stepsKeepsake,
  shaker: (p) => artNote('shaker', 'Protein shaker', ART.shaker, p.shaker, 'Post-workout shake.'),
  heartrate: heartrateKeepsake, setsheet: setsheetKeepsake, medal: medalKeepsake,
  waterbottle: (p) => artNote('waterbottle', 'Water bottle', ART.waterbottle, p.waterbottle, 'Stay hydrated!'),
  alarmclock: alarmclockKeepsake, riseshine: riseshineKeepsake, firstcoffee: firstcoffeeKeepsake, lunchbreak: lunchbreakKeepsake, teatime: teatimeKeepsake, nightowl: nightowlKeepsake, sleepmask: sleepmaskKeepsake, ledclock: ledclockKeepsake
};
export function thoughtMakers(post) {
  return Object.entries(MAKERS)
    .filter(([k]) => post[k])
    .map(([, make]) => () => make(post));
}
