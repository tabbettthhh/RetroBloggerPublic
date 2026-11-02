// Keepsakes from everyday life: food and drink (a menu card, a wine label, a recipe card…),
// home (a candle, a house key, a plant label…), travel (a train ticket, a luggage label, a
// passport stamp…) and celebrations (a birthday card, a gift tag, a place card…). Each takes a
// few lines: usually the first is what's printed or written on it, the rest your note.
// Everything is generic: no real brands, operators, flags or emblems.
import { h } from './util.js';

const wrapOf = (kind, aria, ...kids) => h('div', { class: 'ticket-wrap ' + kind }, h('div', { class: 'ks ks-' + kind, role: 'group', 'aria-label': aria }, ...kids));
const lines = (list) => list.map((o) => o.item).filter(Boolean);
const first = (list, fallback) => list[0]?.item || fallback;
const rest = (list, from = 1) => lines(list.slice(from));
const note = (list, fallback) => {
  const w = list.length ? list : fallback ? [fallback] : [];
  return w.length ? h('span', { class: 'pf-note' }, w.map((t) => h('span', null, t))) : null;
};
const art = (cls, svg) => h('span', { class: 'mm-art ' + cls, 'aria-hidden': 'true', html: svg });
const when = (post) => new Date(post.ts || Date.now());
const day = (post) => when(post).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const placeOf = (post) => post.city || post.area || post.title || '';
function hash(str) {
  let n = 2166136261;
  for (let i = 0; i < str.length; i++) n = Math.imul(n ^ str.charCodeAt(i), 16777619);
  return n >>> 0;
}
const pick = (post, list, salt = '') => list[hash(String(post.slug || post.title || '') + salt) % list.length];
const numberIn = (list, fallback) => {
  const m = /(\d{1,3})/.exec(list[0]?.item || '');
  return m ? m[1] : fallback;
};

// ================= Food & drink =================

// A restaurant's menu card: the dishes, in a serif, with a little rule.
function menucard(post) {
  const dishes = post.menucard.length ? lines(post.menucard) : ['Soup of the day', 'Something with chips', 'Sticky toffee pudding'];
  return wrapOf('menucard', 'Menu card', h('span', { class: 'mc-head' }, h('small', null, 'Menu'), h('b', null, post.title || 'Tonight')), h('span', { class: 'mc-rule', 'aria-hidden': 'true' }, '❦'), h('ul', { class: 'mc-dishes' }, dishes.slice(0, 8).map((d) => h('li', null, d))));
}
// A wine label: a name, a year, a little engraving of hills.
const VINES = '<svg viewBox="0 0 120 40" width="110" height="36"><path d="M0 34q20-18 40-8t40-12 40 6v20H0z" fill="#d9ccb0"/><path d="M0 38q30-14 60-6t60-4v12H0z" fill="#c5b48f"/>' + Array.from({ length: 9 }, (_, k) => `<path d="M${8 + k * 13} 38v-6" stroke="#6b5a3a" stroke-width="1"/><circle cx="${8 + k * 13}" cy="31" r="1.6" fill="#5a3a4a"/>`).join('') + '</svg>';
function winelabel(post) {
  const name = first(post.winelabel, post.title || 'House red');
  const year = (/\b(19|20)\d{2}\b/.exec(rest(post.winelabel).join(' ')) || [])[0] || String(when(post).getFullYear());
  return wrapOf('winelabel', 'Wine label', h('span', { class: 'wl-frame' }, h('span', { class: 'wl-art', 'aria-hidden': 'true', html: VINES }), h('b', { class: 'wl-name' }, name), h('span', { class: 'wl-year' }, year), h('small', { class: 'wl-sub' }, rest(post.winelabel).filter((t) => !t.includes(year)).join(' · ') || 'Bottled with care')));
}
// A recipe card: the dish, then what goes in (and how), in pen on a lined index card.
function recipecard(post) {
  const dish = first(post.recipecard, post.title || 'Grandma’s scones');
  const items = rest(post.recipecard);
  return wrapOf('recipecard', 'Recipe card', h('span', { class: 'rc-head' }, h('small', null, 'Recipe for'), h('b', null, dish)), h('span', { class: 'rc-lines' }, (items.length ? items : ['a little of this', 'a little of that', 'bake till golden']).slice(0, 9).map((t) => h('span', null, t))));
}
// A paper sugar packet, torn open at the corner.
function sugarpacket(post) {
  const said = first(post.sugarpacket, 'SUGAR');
  return wrapOf('sugarpacket', 'Sugar packet', h('span', { class: 'sp2-packet' }, h('small', null, placeOf(post).toUpperCase().slice(0, 22) || 'CAFÉ'), h('b', null, said.toUpperCase()), h('small', null, 'PURE CANE · 5g')), note(rest(post.sugarpacket)));
}
// The tag off a tea bag, on its string.
function teabagtag(post) {
  return wrapOf('teabagtag', 'Tea bag tag', h('span', { class: 'tb-string', 'aria-hidden': 'true' }), h('span', { class: 'tb-tag' }, h('b', null, first(post.teabagtag, 'Breakfast')), h('small', null, 'brew 3–5 min')), note(rest(post.teabagtag)));
}
// The paper sleeve chopsticks come in, with a word or two printed down it.
function chopsticks(post) {
  return wrapOf('chopsticks', 'Chopsticks', h('span', { class: 'ch-sticks', 'aria-hidden': 'true' }, h('i'), h('i')), h('span', { class: 'ch-sleeve' }, h('b', null, first(post.chopsticks, 'Thank you'))), note(rest(post.chopsticks)));
}
// A bakery box, tied with string, with its sticker.
function bakerybox(post) {
  return wrapOf('bakerybox', 'Bakery box', h('span', { class: 'bb-box' }, h('span', { class: 'bb-string', 'aria-hidden': 'true' }), h('span', { class: 'bb-sticker' }, h('small', null, 'fresh from'), h('b', null, first(post.bakerybox, placeOf(post) || 'the bakery')))), note(rest(post.bakerybox)));
}
// A folded table number.
function tablenumber(post) {
  const n = numberIn(post.tablenumber, String((hash(String(post.slug)) % 24) + 1));
  return wrapOf('tablenumber', 'Table number', h('span', { class: 'tn-tent' }, h('small', null, 'TABLE'), h('b', null, n)), note(rest(post.tablenumber, /\d/.test(post.tablenumber[0]?.item || '') ? 1 : 0)));
}

// ================= Home & cosy =================

const CANDLE = '<svg viewBox="0 0 60 110" width="44" height="82"><defs><radialGradient id="lkglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe7a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffb84a" stop-opacity="0"/></radialGradient><linearGradient id="lkwax" x1="0" x2="1"><stop offset="0" stop-color="#e9dcc2"/><stop offset=".45" stop-color="#fbf3e2"/><stop offset="1" stop-color="#cfbf9f"/></linearGradient></defs><circle cx="30" cy="22" r="20" fill="url(#lkglow)"/><path d="M30 8q6 9 0 18q-6-9 0-18z" fill="#ffb02e"/><path d="M30 14q3 5 0 10q-3-5 0-10z" fill="#fff4c2"/><path d="M30 26v6" stroke="#3a2a1a" stroke-width="1.4"/><path d="M14 34q16-5 32 0v66q-16 5-32 0z" fill="url(#lkwax)"/><path d="M14 34q16 5 32 0" fill="none" stroke="#d9c9a6"/><path d="M40 36q2 8 0 14" stroke="#fff" stroke-width="2" opacity=".6" fill="none"/></svg>';
function candle(post) {
  return wrapOf('candle', 'Candle', art('lk-candle', CANDLE), note(lines(post.candle), 'A quiet evening in.'));
}
// A house key on a ring, with a paper-edged fob tag.
const KEY = '<svg viewBox="0 0 120 50" width="110" height="46"><defs><linearGradient id="lkbrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dc8a"/><stop offset=".5" stop-color="#c9952a"/><stop offset="1" stop-color="#8a6416"/></linearGradient></defs><circle cx="16" cy="24" r="12" fill="none" stroke="#9aa1a8" stroke-width="3"/><circle cx="38" cy="24" r="12" fill="url(#lkbrass)"/><circle cx="38" cy="24" r="4" fill="#fffaf0"/><path d="M50 21h58v6h-6v6h-5v-6h-4v8h-5v-8h-4v4h-5v-4H50z" fill="url(#lkbrass)"/></svg>';
function housekey(post) {
  return wrapOf('housekey', 'House key', art('lk-key', KEY), h('span', { class: 'hk-fob' }, h('b', null, first(post.housekey, 'Home'))), note(rest(post.housekey)));
}
// A plant's label, pushed into the soil, written in pencil.
function planttag(post) {
  return wrapOf('planttag', 'Plant label', h('span', { class: 'pt-stake' }, h('b', null, first(post.planttag, 'Basil')), ...rest(post.planttag).slice(0, 3).map((t) => h('small', null, t))));
}
// A knitted square (a swatch), its stitches, and a note pinned to it.
function knitsquare(post) {
  const c = pick(post, ['#b0413e', '#4a6b8a', '#6b8a4a', '#c99a3a', '#8a5a7a', '#4a7a72'], 'k');
  return wrapOf('knitsquare', 'Knitted square', h('span', { class: 'ks2-swatch', style: { '--yarn': c }, 'aria-hidden': 'true' }), note(lines(post.knitsquare), 'Cast on, finally.'));
}
const HOTWATER = '<svg viewBox="0 0 100 110" width="80" height="88"><defs><linearGradient id="lkrub" x1="0" x2="1"><stop offset="0" stop-color="#a8304a"/><stop offset=".45" stop-color="#e05a70"/><stop offset="1" stop-color="#8a2236"/></linearGradient></defs><rect x="41" y="2" width="18" height="14" rx="3" fill="#3a3a3a"/><path d="M38 14h24l4 10q22 2 24 18v52q0 12-12 12H22q-12 0-12-12V42q2-16 24-18z" fill="url(#lkrub)"/>' + Array.from({ length: 6 }, (_, k) => `<path d="M20 ${46 + k * 9}q30 4 60 0" stroke="#7a1a2c" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".5"/>`).join('') + '<path d="M18 44q2-10 14-14" stroke="#fff" stroke-width="3" fill="none" opacity=".35" stroke-linecap="round"/></svg>';
function hotwaterbottle(post) {
  return wrapOf('hotwaterbottle', 'Hot water bottle', art('lk-hwb', HOTWATER), note(lines(post.hotwaterbottle), 'Cold night, warm feet.'));
}
// A coir doormat with a word on it.
function doormat(post) {
  return wrapOf('doormat', 'Doormat', h('span', { class: 'dm-mat' }, h('b', null, first(post.doormat, 'Welcome').toUpperCase())), note(rest(post.doormat)));
}
// A jar of something homemade, with its handwritten label and a gingham top.
function jamjar(post) {
  return wrapOf('jamjar', 'Jam jar', h('span', { class: 'jj-jar' }, h('span', { class: 'jj-lid', 'aria-hidden': 'true' }), h('span', { class: 'jj-label' }, h('b', null, first(post.jamjar, 'Strawberry')), h('small', null, when(post).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })))), note(rest(post.jamjar)));
}
// A note held on the fridge with a magnet.
function fridgenote(post) {
  const c = pick(post, ['#e8433a', '#3a86e8', '#f2b81c', '#2f9e5a'], 'm');
  return wrapOf('fridgenote', 'Note on the fridge', h('span', { class: 'fn-magnet', style: { '--m': c }, 'aria-hidden': 'true' }), h('span', { class: 'fn-paper' }, (post.fridgenote.length ? lines(post.fridgenote) : ['milk', 'eggs', 'call home']).slice(0, 8).map((t) => h('span', null, t))));
}

// ================= Travel & transport =================

// A train ticket on card, from and to, with the day.
function trainticket(post) {
  const from = first(post.trainticket, 'Home');
  const to = post.trainticket[1]?.item || placeOf(post) || 'Away';
  return wrapOf('trainticket', 'Train ticket', h('span', { class: 'tt-card' }, h('span', { class: 'tt-top' }, h('small', null, 'STANDARD CLASS'), h('small', null, 'SINGLE')), h('span', { class: 'tt-row' }, h('small', null, 'FROM'), h('b', null, from.toUpperCase())), h('span', { class: 'tt-row' }, h('small', null, 'TO'), h('b', null, to.toUpperCase())), h('span', { class: 'tt-foot' }, h('small', null, day(post).toUpperCase()), h('small', null, `№ ${String(hash(String(post.slug)) % 900000 + 100000)}`))), note(rest(post.trainticket, 2)));
}
// A ferry boarding card with a little wave.
function ferrypass(post) {
  return wrapOf('ferrypass', 'Ferry pass', h('span', { class: 'fp-card' }, h('span', { class: 'fp-wave', 'aria-hidden': 'true' }), h('small', null, 'FOOT PASSENGER'), h('b', null, first(post.ferrypass, placeOf(post) || 'Across the water')), h('small', null, `${day(post)} · DECK ${pick(post, ['A', 'B', 'C'])}`)), note(rest(post.ferrypass)));
}
// A map pin, with a little paper flag.
const PUSHPIN = '<svg viewBox="0 0 40 70" width="30" height="54"><defs><radialGradient id="lkpin" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#ffb3a8"/><stop offset=".5" stop-color="#d6332b"/><stop offset="1" stop-color="#6e0f0a"/></radialGradient></defs><path d="M20 68 19 34h2z" fill="#9aa1a8"/><circle cx="20" cy="20" r="14" fill="url(#lkpin)"/><ellipse cx="15" cy="14" rx="5" ry="3" fill="#fff" opacity=".55"/></svg>';
function travelpin(post) {
  return wrapOf('travelpin', 'Map pin', art('lk-pin', PUSHPIN), h('span', { class: 'tp-flag' }, h('b', null, first(post.travelpin, placeOf(post) || 'Here')), h('small', null, day(post))), note(rest(post.travelpin)));
}
// A passport page with an arrival stamp: the place and the day, in ink (no country emblems).
function passportstamp(post) {
  const shape = pick(post, ['round', 'rect', 'oval'], 's');
  const ink = pick(post, ['#2a4a9a', '#9a2a3a', '#2f7a4a', '#5a3a8a'], 'i');
  return wrapOf('passportstamp', 'Passport stamp', h('span', { class: 'ps-page' }, h('span', { class: 'ps-stamp ' + shape, style: { '--ink': ink } }, h('small', null, 'ARRIVED'), h('b', null, first(post.passportstamp, placeOf(post) || 'Somewhere').toUpperCase()), h('small', null, day(post).toUpperCase()))), note(rest(post.passportstamp)));
}
// A luggage label from a hotel of old, stuck on a case.
function suitcasesticker(post) {
  const c = pick(post, [['#1f4a6e', '#f2d27a'], ['#8a2a2a', '#fbe7b8'], ['#2f5a3a', '#f6e2a8'], ['#3a2a5a', '#f2c97a']], 'c');
  return wrapOf('suitcasesticker', 'Luggage label', h('span', { class: 'ss-label', style: { '--bg': c[0], '--fg': c[1] } }, h('small', null, 'GREETINGS FROM'), h('b', null, first(post.suitcasesticker, placeOf(post) || 'Abroad')), h('small', null, rest(post.suitcasesticker)[0] || String(when(post).getFullYear()))), note(rest(post.suitcasesticker, 2)));
}
// A station platform sign.
function platform(post) {
  const n = numberIn(post.platform, String((hash(String(post.slug)) % 12) + 1));
  return wrapOf('platform', 'Platform sign', h('span', { class: 'pl-sign' }, h('span', { class: 'pl-n' }, n), h('span', { class: 'pl-text' }, h('small', null, 'Platform'), h('b', null, rest(post.platform, /\d/.test(post.platform[0]?.item || '') ? 1 : 0)[0] || placeOf(post) || 'All trains'))), note(rest(post.platform, /\d/.test(post.platform[0]?.item || '') ? 2 : 1)));
}
// A seat reservation slip, the kind tucked into the seat back.
function seatres(post) {
  const seat = first(post.seatres, `Coach ${pick(post, ['A', 'B', 'C', 'D', 'E'])} · Seat ${(hash(String(post.slug)) % 70) + 1}`);
  return wrapOf('seatres', 'Seat reservation', h('span', { class: 'sr-slip' }, h('small', null, 'RESERVED'), h('b', null, seat), h('small', null, rest(post.seatres)[0] || `${placeOf(post) ? 'to ' + placeOf(post) : ''}`.trim() || day(post))), note(rest(post.seatres, 2)));
}
// A road sign with how far it is.
function milesign(post) {
  const to = first(post.milesign, placeOf(post) || 'The coast');
  const miles = (/(\d{1,4})/.exec(post.milesign[1]?.item || '') || [])[1] || String((hash(String(post.slug)) % 180) + 3);
  return wrapOf('milesign', 'Road sign', h('span', { class: 'ms-sign' }, h('b', null, to), h('span', { class: 'ms-n' }, miles)), note(rest(post.milesign, 2)));
}

// ================= Celebrations & family =================

// A folded birthday card, standing, with the message inside showing.
function birthdaycard(post) {
  const age = numberIn(post.birthdaycard, '');
  const inside = rest(post.birthdaycard, age ? 1 : 0);
  return wrapOf('birthdaycard', 'Birthday card', h('span', { class: 'bd-front' }, h('small', null, 'Happy'), h('b', null, 'Birthday'), age ? h('span', { class: 'bd-age' }, age) : h('span', { class: 'bd-bunting', 'aria-hidden': 'true' })), h('span', { class: 'bd-inside' }, (inside.length ? inside : ['With love', 'xx']).slice(0, 6).map((t) => h('span', null, t))));
}
// A gift tag on its string.
function gifttag(post) {
  return wrapOf('gifttag', 'Gift tag', h('span', { class: 'gt-tag' }, h('span', { class: 'gt-hole', 'aria-hidden': 'true' }), h('span', { class: 'gt-row' }, h('small', null, 'To'), h('b', null, first(post.gifttag, 'You'))), h('span', { class: 'gt-row' }, h('small', null, 'From'), h('b', null, post.gifttag[1]?.item || 'Me'))), note(rest(post.gifttag, 2)));
}
// A number candle off the cake (a little melted), with a note.
function cakecandle(post) {
  const n = numberIn(post.cakecandle, '1');
  return wrapOf('cakecandle', 'Cake candle', h('span', { class: 'cc-candle' }, h('span', { class: 'cc-flame', 'aria-hidden': 'true' }), h('b', null, n)), note(rest(post.cakecandle, /\d/.test(post.cakecandle[0]?.item || '') ? 1 : 0), 'Make a wish.'));
}
// A place card from a table, the name in script.
function placecard(post) {
  return wrapOf('placecard', 'Place card', h('span', { class: 'plc-card' }, h('span', { class: 'plc-sprig', 'aria-hidden': 'true' }, '❦'), h('b', null, first(post.placecard, 'Guest')), rest(post.placecard)[0] ? h('small', null, rest(post.placecard)[0]) : null), note(rest(post.placecard, 2)));
}
// A favour: a little organza bag tied with ribbon, and its tag.
function favour(post) {
  return wrapOf('favour', 'Favour', h('span', { class: 'fv-bag', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('span', { class: 'fv-tag' }, h('b', null, first(post.favour, 'Thank you')), h('small', null, rest(post.favour)[0] || day(post))), note(rest(post.favour, 2)));
}
// A knitted baby bootie.
const BOOTIE = '<svg viewBox="0 0 100 80" width="88" height="70"><defs><pattern id="lkknit" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0l3 6 3-6" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="1"/></pattern></defs><path d="M30 10h28v30q20 2 30 14t-8 16H24q-12 0-12-12V40q0-6 6-6h12z" fill="var(--yarn, #f2d7e0)"/><path d="M30 10h28v30q20 2 30 14t-8 16H24q-12 0-12-12V40q0-6 6-6h12z" fill="url(#lkknit)"/><path d="M28 22h32" stroke="#fff" stroke-width="4" stroke-dasharray="3 3"/><path d="M40 22q-8-10 0-12q8 2 0 12q8-10 12-6q2 6-12 6" fill="none" stroke="#fff" stroke-width="2.2"/></svg>';
function bootie(post) {
  const c = pick(post, ['#f2d7e0', '#d7e6f2', '#f6eccb', '#dcefd8'], 'b');
  return wrapOf('bootie', 'Baby bootie', h('span', { class: 'mm-art lk-bootie', style: { '--yarn': c }, 'aria-hidden': 'true', html: BOOTIE }), note(lines(post.bootie), 'So tiny.'));
}
// A party hat, striped, with its elastic.
function partyhat(post) {
  const c = pick(post, [['#e8433a', '#f2b81c'], ['#3a86e8', '#fbfbfb'], ['#2f9e5a', '#f2b81c'], ['#8a5a9a', '#f2c4d8']], 'h');
  return wrapOf('partyhat', 'Party hat', h('span', { class: 'ph-hat', style: { '--a': c[0], '--b': c[1] }, 'aria-hidden': 'true' }), note(lines(post.partyhat), 'Wore it all night.'));
}
// A thank-you note, folded, in your handwriting.
function thankyou(post) {
  return wrapOf('thankyou', 'Thank-you note', h('span', { class: 'ty-card' }, h('b', null, 'Thank you'), h('span', { class: 'ty-lines' }, (post.thankyou.length ? lines(post.thankyou) : ['for everything']).slice(0, 6).map((t) => h('span', null, t)))));
}

const MAKERS = {
  menucard, winelabel, recipecard, sugarpacket, teabagtag, chopsticks, bakerybox, tablenumber,
  candle, housekey, planttag, knitsquare, hotwaterbottle, doormat, jamjar, fridgenote,
  trainticket, ferrypass, travelpin, passportstamp, suitcasesticker, platform, seatres, milesign,
  birthdaycard, gifttag, cakecandle, placecard, favour, bootie, partyhat, thankyou
};
export const LIFE_KEEPSAKES = Object.keys(MAKERS);
export function lifeMakers(post) {
  return Object.entries(MAKERS)
    .filter(([k]) => post[k])
    .map(([, make]) => () => make(post));
}
