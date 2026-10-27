// Keepsakes for music (a few for podcasts too): awards, charts and the things fans keep.
// All made-up designs in the spirit of the real thing: no real award statuettes, chart
// names or logos.
import { h } from './util.js';

const wrapOf = (kind, aria, ...kids) => h('div', { class: 'ticket-wrap ' + kind }, h('div', { class: 'ks ks-' + kind, role: 'group', 'aria-label': aria }, ...kids));
const words = (list) => list.map((o) => h('span', null, o.item));
function hash(str) {
  let n = 2166136261;
  for (let i = 0; i < str.length; i++) n = Math.imul(n ^ str.charCodeAt(i), 16777619);
  return n >>> 0;
}
const firstNumber = (list, fallback) => {
  const m = /(\d[\d,]*)/.exec(list?.[0]?.item || '');
  return m ? m[1] : fallback;
};
const year = (post) => new Date(post.ts || Date.now()).getFullYear();
const who = (post) => post.creator || '';
const title = (post) => post.title || 'Untitled';

// A framed disc award: silver, gold, platinum or diamond.
const DISCS = { silver: ['#f4f6f8', '#aeb6bf', '#7d868f'], gold: ['#fff1b8', '#e2b04a', '#9a6a1a'], platinum: ['#ffffff', '#d5dbe2', '#8e98a3'], diamond: ['#f2fbff', '#b9e6ff', '#6aa8d8'] };
function discawardKeepsake(post) {
  const said = (post.discaward[0]?.item || '').trim().toLowerCase();
  const level = DISCS[said] ? said : 'gold';
  const [a, b, c] = DISCS[level];
  const disc = `<svg viewBox="0 0 100 100" width="92" height="92" aria-hidden="true"><defs><radialGradient id="dg${hash(post.slug)}" cx=".35" cy=".3"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs><circle cx="50" cy="50" r="47" fill="url(#dg${hash(post.slug)})"/>${[40, 34, 28].map((r) => `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${c}" stroke-width=".6" opacity=".6"/>`).join('')}<circle cx="50" cy="50" r="15" fill="${c}"/><circle cx="50" cy="50" r="2.4" fill="#2b2b2b"/>${level === 'diamond' ? '<path d="M24 26l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="#fff"/>' : ''}</svg>`;
  return wrapOf('discaward', `${level} disc award`, h('span', { class: 'da-mat' }, h('span', { class: 'da-disc', html: disc }), h('span', { class: 'da-plate' }, h('small', null, 'PRESENTED TO COMMEMORATE'), h('b', null, title(post)), who(post) ? h('small', null, 'by ' + who(post)) : null, h('strong', { class: 'da-level' }, `CERTIFIED ${level.toUpperCase()}`), ...words(post.discaward.slice(DISCS[said] ? 1 : 0)))));
}
// A trophy cup with an engraved plate.
function trophyKeepsake(post) {
  const u = hash(post.slug + 'aw');
  const art = `<svg viewBox="0 0 100 110" width="86" height="96" aria-hidden="true"><defs><linearGradient id="tg${u}" x1="0" x2="1"><stop offset="0" stop-color="#9a6a1a"/><stop offset=".4" stop-color="#fff1b8"/><stop offset=".6" stop-color="#e2b04a"/><stop offset="1" stop-color="#9a6a1a"/></linearGradient></defs><path d="M24 8h52v18a26 26 0 0 1-52 0z" fill="url(#tg${u})"/><path d="M24 14H10v6a14 14 0 0 0 16 14M76 14h14v6a14 14 0 0 1-16 14" fill="none" stroke="#c9952a" stroke-width="5"/><path d="M44 52h12v14H44z" fill="url(#tg${u})"/><path d="M34 66h32l4 10H30z" fill="url(#tg${u})"/><rect x="24" y="76" width="52" height="26" rx="2" fill="#3a2414"/><path d="M38 18l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z" fill="#fff6d0" opacity=".8"/></svg>`;
  return wrapOf('trophy', 'Trophy', h('span', { class: 'tr-art', html: art }, h('span', { class: 'tr-plate' }, h('b', null, (post.trophy[0]?.item || 'Album of the year').slice(0, 28)), h('small', null, String(year(post))))), post.trophy.length > 1 ? h('span', { class: 'pf-note' }, words(post.trophy.slice(1))) : null);
}
// A chart clipping from the paper: your record at the top (or where you say it got to).
function chartno1Keepsake(post) {
  const pos = Math.max(1, Math.min(100, +firstNumber(post.chartno1, '1') || 1));
  const week = Math.ceil(((post.ts || Date.now()) - new Date(year(post), 0, 1)) / 604800000);
  const rows = [];
  for (let k = Math.max(1, pos - 1); k <= Math.max(3, pos + 1); k++) rows.push(k === pos ? h('li', { class: 'mine' }, h('i', null, String(k)), h('span', null, h('b', null, title(post).toUpperCase()), who(post) ? h('small', null, who(post)) : null), h('em', null, k === 1 ? '★' : '▲')) : h('li', null, h('i', null, String(k)), h('span', { class: 'blur' }), h('em', null, k % 2 ? '▼' : '–')));
  return wrapOf('chartno1', 'Chart clipping', h('span', { class: 'ch-head' }, h('b', null, 'THE CHART'), h('small', null, `WEEK ${week} · ${year(post)}`)), h('ol', { class: 'ch-rows' }, rows), post.chartno1.length > (/\d/.test(post.chartno1[0]?.item || '') ? 1 : 0) ? h('span', { class: 'ch-note' }, words(post.chartno1.slice(/\d/.test(post.chartno1[0]?.item || '') ? 1 : 0))) : null);
}
// "And the winner is…" — the card from the envelope.
function winnercardKeepsake(post) {
  return wrapOf('winnercard', 'And the winner is', h('span', { class: 'wc-cat' }, (post.winnercard[0]?.item || 'Best album').toUpperCase()), h('span', { class: 'wc-is' }, 'and the winner is…'), h('strong', { class: 'wc-title' }, title(post)), who(post) ? h('span', { class: 'wc-who' }, who(post)) : null, ...words(post.winnercard.slice(1)).map((x) => h('span', { class: 'wc-line' }, x)));
}
// A golden microphone on a little stand.
function goldmicKeepsake(post) {
  const u = hash(post.slug + 'aw');
  const art = `<svg viewBox="0 0 60 120" width="52" height="104" aria-hidden="true"><defs><linearGradient id="gm${u}" x1="0" x2="1"><stop offset="0" stop-color="#9a6a1a"/><stop offset=".45" stop-color="#fff1b8"/><stop offset="1" stop-color="#c9952a"/></linearGradient><pattern id="gmg${u}" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 2h4M2 0v4" stroke="#9a6a1a" stroke-width=".7"/></pattern></defs><rect x="14" y="4" width="32" height="40" rx="16" fill="url(#gm${u})"/><rect x="14" y="4" width="32" height="40" rx="16" fill="url(#gmg${u})" opacity=".6"/><path d="M26 44h8v40h-8z" fill="url(#gm${u})"/><path d="M12 84h36l4 12H8z" fill="url(#gm${u})"/><rect x="6" y="96" width="48" height="20" rx="2" fill="#2b1a10"/></svg>`;
  return wrapOf('goldmic', 'Golden microphone award', h('span', { class: 'gm2-art', html: art }, h('small', { class: 'gm2-plate' }, (post.goldmic[0]?.item || 'Golden mic').slice(0, 16))), post.goldmic.length > 1 ? h('span', { class: 'pf-note' }, words(post.goldmic.slice(1))) : null);
}
// A signed photo: a figure under a spotlight, signed in marker.
function autographKeepsake(post) {
  const scene = '<svg viewBox="0 0 120 100" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="120" height="100" fill="#1a1426"/><path d="M60 0L30 100h60z" fill="#fff6c8" opacity=".25"/><circle cx="60" cy="44" r="9" fill="#2b2b2b"/><path d="M46 100c0-26 6-40 14-40s14 14 14 40z" fill="#2b2b2b"/><path d="M70 60l12-14" stroke="#2b2b2b" stroke-width="3"/><circle cx="83" cy="45" r="3" fill="#9aa1a8"/></svg>';
  const name = who(post) || title(post);
  return wrapOf('autograph', 'Signed photo', h('span', { class: 'ag-photo', html: scene }), h('span', { class: 'ag-to' }, post.autograph[0]?.item || 'To you,'), h('span', { class: 'ag-sign' }, name), h('span', { class: 'ag-x', 'aria-hidden': 'true' }, 'xx'));
}
// A fan club membership card.
function fanclubKeepsake(post) {
  const no = firstNumber(post.fanclub, String((hash(post.slug) % 9000) + 1000));
  return wrapOf('fanclub', 'Fan club card', h('span', { class: 'fc2-head' }, 'OFFICIAL FAN CLUB'), h('strong', { class: 'fc2-name' }, (who(post) || title(post)).toUpperCase()), h('span', { class: 'fc2-row' }, h('small', null, `MEMBER Nº ${no}`), h('small', null, `SINCE ${post.fanclub[1]?.item || year(post)}`)), h('span', { class: 'fc2-stars', 'aria-hidden': 'true' }, '★ ★ ★'));
}
// The title strip from a jukebox.
function jukeboxKeepsake(post) {
  const code = (post.jukebox[0]?.item || '').trim().slice(0, 3).toUpperCase() || `${'ABCDEFGH'[hash(post.slug) % 8]}${(hash(post.slug + 'j') % 9) + 1}`;
  return wrapOf('jukebox', 'Jukebox title strip', h('span', { class: 'jb-code' }, code), h('span', { class: 'jb-strip' }, h('b', null, title(post).toUpperCase()), h('span', { class: 'jb-rule', 'aria-hidden': 'true' }), h('small', null, (who(post) || 'Side B').toUpperCase())));
}
// A request slip for the radio, with the dial.
function radiorequestKeepsake(post) {
  const fm = (87.5 + (hash(post.slug) % 205) / 10).toFixed(1);
  return wrapOf('radiorequest', 'Radio request', h('span', { class: 'rr-dial', 'aria-hidden': 'true' }, h('i', { style: { left: `${10 + (hash(post.slug) % 80)}%` } })), h('span', { class: 'rr-head' }, `FM ${fm} · REQUESTS`), h('span', { class: 'rr-line' }, h('small', null, 'PLEASE PLAY'), h('b', null, title(post))), h('span', { class: 'rr-line' }, h('small', null, 'FOR'), h('b', null, post.radiorequest[0]?.item || 'everyone listening')), ...post.radiorequest.slice(1).map((o) => h('span', { class: 'rr-msg' }, o.item)));
}
// A review clipped from a magazine, with its stars.
function magreviewKeepsake(post) {
  const stars = post.rating != null ? Math.max(1, Math.min(5, Math.round(post.rating))) : 5;
  return wrapOf('magreview', 'Magazine review', h('span', { class: 'mr-head' }, 'REVIEWS'), h('span', { class: 'mr-stars', 'aria-label': `${stars} out of 5` }, '★'.repeat(stars) + '☆'.repeat(5 - stars)), h('strong', { class: 'mr-quote' }, `“${post.magreview[0]?.item || 'An instant classic'}”`), h('span', { class: 'mr-what' }, [title(post), who(post)].filter(Boolean).join(' — ')));
}
// My year on repeat: plays, with a little bar chart.
function yearonrepeatKeepsake(post) {
  const plays = firstNumber(post.yearonrepeat, String((hash(post.slug) % 900) + 100));
  const bars = Array.from({ length: 12 }, (_, k) => h('i', { style: { height: `${20 + (hash(post.slug + k) % 80)}%` } }));
  return wrapOf('yearonrepeat', 'Year on repeat', h('span', { class: 'yr-head' }, `MY ${year(post)} ON REPEAT`), h('strong', { class: 'yr-title' }, title(post)), who(post) ? h('span', { class: 'yr-who' }, who(post)) : null, h('span', { class: 'yr-bars', 'aria-hidden': 'true' }, bars), h('span', { class: 'yr-plays' }, `${plays} plays`));
}
// A 7-inch single in its picture sleeve.
function sevenninchKeepsake(post) {
  const hue = hash(post.slug) % 360;
  return wrapOf('sevenninch', '7-inch single', h('span', { class: 'sv-disc', 'aria-hidden': 'true' }), h('span', { class: 'sv-sleeve', style: { '--sv': `hsl(${hue} 55% 45%)`, '--sv2': `hsl(${(hue + 40) % 360} 70% 70%)` } }, h('span', { class: 'sv-hole', 'aria-hidden': 'true' }), h('b', null, title(post)), who(post) ? h('small', null, who(post)) : null, h('small', { class: 'sv-side' }, (post.sevenninch[0]?.item || 'SIDE A · 45 RPM').toUpperCase())));
}

const MAKERS = { discaward: discawardKeepsake, trophy: trophyKeepsake, chartno1: chartno1Keepsake, winnercard: winnercardKeepsake, goldmic: goldmicKeepsake, autograph: autographKeepsake, fanclub: fanclubKeepsake, jukebox: jukeboxKeepsake, radiorequest: radiorequestKeepsake, magreview: magreviewKeepsake, yearonrepeat: yearonrepeatKeepsake, sevenninch: sevenninchKeepsake };
export const MUSIC_KEEPSAKES = Object.keys(MAKERS);
export function musicMakers(post) {
  return Object.entries(MAKERS)
    .filter(([k]) => post[k])
    .map(([, make]) => () => make(post));
}
