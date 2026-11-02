// The highlights cabinet, on the About page: your best places, music, films, TV and podcasts, up
// to five on each shelf, chosen in the back office (highlights.md), each with a line on why.
// A grand Victorian cabinet with an Empire flourish (red lacquer, gold leaf, laurel and acanthus,
// a pediment, glass doors, velvet shelves and engraved nameplates), dressed for the season or
// festive day, and in the theme's colours. Decorations are the kind people put up at home: no
// scripture, places of worship, flags or emblems.
import { h, niceDate } from './util.js';
import { activeSkin, drawingUrl, FESTIVE_COLOURS, lookOf } from './skins.js';
import { postHref } from './comments.js';
import { sound } from './sound.js';

export const SHELVES = [
  ['places', 'Places'],
  ['music', 'Music'],
  ['films', 'Films'],
  ['tv', 'Television'],
  ['podcasts', 'Podcasts']
];
export const PER_SHELF = 5;

// ---------- which look ----------
// Festive days with an ornament of their own; any other day gets a garland of its drawings.
const FAMILY = {
  lunar_new_year: 'dragon', dragon_boat: 'dragon', mid_autumn: 'lantern-east', hanami: 'blossom', tanabata: 'lantern-east', childrens_day: 'garland',
  nowruz: 'carpet', yalda: 'carpet',
  dia_de_muertos: 'papel', dia_de_reyes: 'garland', carnival: 'garland',
  diwali: 'diya', holi: 'garland',
  ramadan: 'lantern', eid_al_fitr: 'lantern', eid_al_adha: 'lantern',
  christmas: 'holly', hanukkah: 'garland', easter: 'garland', st_patricks: 'garland', midsummer: 'garland', halloween: 'garland', bonfire_night: 'garland'
};
// What today is, as the rest of the site has it (a festive day, a season, or neither).
function today(t) {
  const root = document.documentElement;
  if (root.dataset.festival && t?.today?.festival) return { id: t.today.festival, family: FAMILY[t.today.festival] || 'garland', festive: true };
  if (root.dataset.season) return { id: root.dataset.season, family: root.dataset.season, festive: false };
  return { id: 'classic', family: 'classic', festive: false };
}

// ---------- the ornaments (our own drawings; nothing from a visitor goes in here) ----------
const GOLD = 'var(--cab-gold)';
const laurel = (flip) => {
  const leaves = Array.from({ length: 7 }, (_, i) => {
    const x = 16 + i * 9;
    const y = 30 - Math.sin(i / 2) * 9;
    return `<ellipse cx="${x}" cy="${y - 4}" rx="4.4" ry="1.9" transform="rotate(-38 ${x} ${y - 4})"/><ellipse cx="${x + 2}" cy="${y + 3}" rx="4.4" ry="1.9" transform="rotate(30 ${x + 2} ${y + 3})"/>`;
  }).join('');
  return `<g transform="${flip ? 'translate(400 0) scale(-1 1)' : ''}"><g transform="translate(112 16)" fill="url(#cabm)"><path d="M12 32C30 26 52 20 74 18" stroke="url(#cabm)" stroke-width="2" fill="none"/>${leaves}</g></g>`;
};
// Gold urns standing at either end, and acanthus scrolls curling in from the sides.
const URN = (x) => `<g transform="translate(${x} 70)" fill="url(#cabm)"><path d="M-7 0h14l-2 4h-10z"/><path d="M-9 -2c0-8 4-12 9-12s9 4 9 12z"/><rect x="-2" y="-19" width="4" height="5" rx="1"/><circle cy="-21" r="3"/><path d="M-12-6c-4-1-5-5-2-7M12-6c4-1 5-5 2-7" fill="none" stroke="url(#cabm)" stroke-width="1.4"/></g>`;
const SCROLL = (flip) => `<g transform="${flip ? 'translate(400 0) scale(-1 1)' : ''}"><g fill="none" stroke="url(#cabm)" stroke-width="2.4" stroke-linecap="round"><path d="M44 74c10-14 26-20 44-18 10 1 14 9 8 14-5 4-12 1-10-4"/><path d="M58 70c6-6 14-8 22-6" stroke-width="1.4"/></g><g fill="url(#cabm)"><path d="M70 58c4-6 10-8 14-6-3 2-6 5-6 9z"/><path d="M84 56c5-3 10-2 12 1-4 0-7 2-8 5z"/></g></g>`;
// The pediment: a curved top with gold mouldings, laurel festoons and a central cartouche.
function pediment(centre, extra = '', carved = '') {
  return `<svg class="cab-pediment" viewBox="0 0 400 96" aria-hidden="true">
<defs>
<linearGradient id="cabg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--cab-wood-hi)"/><stop offset=".55" stop-color="var(--cab-wood)"/><stop offset="1" stop-color="var(--cab-wood-lo)"/></linearGradient>
<linearGradient id="cabm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c4"/><stop offset=".22" stop-color="var(--cab-gold)"/><stop offset=".48" stop-color="var(--cab-gold-lo)"/><stop offset=".62" stop-color="var(--cab-gold)"/><stop offset=".8" stop-color="#fff0b0"/><stop offset="1" stop-color="var(--cab-gold-lo)"/></linearGradient>
<filter id="cabgrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.16" numOctaves="4" seed="11"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.9 0 0 0 -0.32"/></filter>
<filter id="cabemb" x="-15%" y="-15%" width="130%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="b"/><feSpecularLighting in="b" surfaceScale="2.6" specularConstant="1.05" specularExponent="16" lighting-color="#fff7d6" result="s"><feDistantLight azimuth="235" elevation="38"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/><feOffset in="SourceAlpha" dx=".8" dy="1.6" result="o"/><feGaussianBlur in="o" stdDeviation="1.1" result="ob"/><feFlood flood-color="#120400" flood-opacity=".65"/><feComposite in2="ob" operator="in" result="sh"/><feMerge><feMergeNode in="sh"/><feMergeNode in="SourceGraphic"/><feMergeNode in="sp"/></feMerge></filter>
<filter id="cablift" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx=".8" dy="1.8" stdDeviation="1.2" flood-color="#120400" flood-opacity=".6"/></filter>
<radialGradient id="cabshine" cx=".5" cy=".15" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<clipPath id="cabclip"><path d="M4 96V74Q200 -8 396 74V96z"/></clipPath>
</defs>
<path d="M4 96V74Q200 -8 396 74V96z" fill="url(#cabg)"/>
<g clip-path="url(#cabclip)"><rect width="400" height="96" filter="url(#cabgrain)"/><rect width="400" height="96" fill="url(#cabshine)"/><path d="M4 74Q200 -8 396 74" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="10" transform="translate(0 8)"/></g>
<g filter="url(#cabemb)">
<path d="M14 80Q200 6 386 80" fill="none" stroke="url(#cabm)" stroke-width="3.6"/>
<path d="M26 84Q200 18 374 84" fill="none" stroke="url(#cabm)" stroke-width="1.4"/>
<g fill="url(#cabm)">${Array.from({ length: 23 }, (_, i) => `<rect x="${10 + i * 17}" y="88.5" width="9" height="6" rx="1"/>`).join('')}</g>
${laurel(false)}${laurel(true)}${URN(26)}${URN(374)}${SCROLL(false)}${SCROLL(true)}${carved}
</g>
<g transform="translate(200 50)" filter="url(#cablift)">${centre}</g>${extra}</svg>`;
}
// The cartouche: an oval frame (what's in it changes with the day).
const cartouche = (inner, fill = 'var(--cab-velvet)') => `<ellipse rx="27" ry="22" fill="${fill}"/><ellipse rx="25" ry="20" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="3"/><g filter="url(#cabemb)"><ellipse rx="27" ry="22" fill="none" stroke="url(#cabm)" stroke-width="3.8"/><ellipse rx="21.5" ry="17" fill="none" stroke="url(#cabm)" stroke-width="1.1"/></g>${inner}`;
const STAR = (r, n = 8) => Array.from({ length: n * 2 }, (_, k) => { const a = (Math.PI * k) / n - Math.PI / 2; const d = k % 2 ? r * 0.45 : r; return `${(Math.cos(a) * d).toFixed(2)},${(Math.sin(a) * d).toFixed(2)}`; }).join(' ');
const wreath = `<g filter="url(#cabemb)"><g fill="url(#cabm)">${[-1, 1].map((sd) => Array.from({ length: 6 }, (_, k) => { const a = (Math.PI * (0.6 + k * 0.17)); const x = (sd * Math.cos(a) * 15).toFixed(1); const y = (Math.sin(a) * 13 - 1).toFixed(1); return `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="1.5" transform="rotate(${(sd * (k * 30 - 70)).toFixed(0)} ${x} ${y})"/>`; }).join('')).join('')}</g><polygon points="${STAR(9.5)}" fill="url(#cabm)" stroke="var(--cab-wood-lo)" stroke-width=".6"/><circle r="2.6" fill="var(--cab-wood)"/></g>`;

// A coiling dragon across the pediment, carved in gold.
const DRAGON = `<g fill="none" stroke="url(#cabm)" stroke-linecap="round"><path d="M70 74C96 50 120 78 146 56S186 30 200 40s40 26 62 10 50 0 70 22" stroke-width="7"/><path d="M70 74C96 50 120 78 146 56S186 30 200 40s40 26 62 10 50 0 70 22" stroke="var(--cab-wood)" stroke-width="2.4" stroke-dasharray="3 5"/></g>
<g transform="translate(330 70)"><path d="M0 0c8-10 22-10 26-2-4 2-8 4-10 9-6-2-12-3-16-7z" fill="url(#cabm)"/><circle cx="17" cy="-3" r="1.6" fill="var(--cab-wood)"/><path d="M24-4c8-6 14-4 18-10M22 2c8 0 14 4 16 10" stroke="url(#cabm)" stroke-width="1.4" fill="none"/></g>
<g fill="url(#cabm)">${[96, 132, 172, 232, 278].map((x, i) => `<path d="M${x} ${[56, 62, 38, 46, 52][i]}l5-9 5 9z"/>`).join('')}</g>`;
// Good fortune on red paper, turned on its corner as it's hung for the new year.
const FU = `<g transform="rotate(45)"><rect x="-15" y="-15" width="30" height="30" fill="#c8102e" stroke="url(#cabm)" stroke-width="2"/></g><text y="8" text-anchor="middle" font-size="22" font-weight="700" fill="#f4d27a" font-family="'Kaiti SC','STKaiti','KaiTi','Noto Serif SC','Songti SC',serif">福</text>`;
// A carpet medallion (central Asian carpets: a gul, its border, deep red and indigo).
const MEDALLION = `<g><path d="M0-17 15 0 0 17-15 0z" fill="#1f2f6b" stroke="url(#cabm)" stroke-width="1.6"/><path d="M0-10 9 0 0 10-9 0z" fill="#a01c22"/><circle r="3.4" fill="#f2d48a"/>${[0, 90, 180, 270].map((a) => `<path d="M0-17 3-22 0-27-3-22z" fill="#f2d48a" transform="rotate(${a})"/>`).join('')}</g>`;
// A painted skull, bright and friendly, as made for the day.
const CALAVERA = `<g><path d="M-14-2a14 14 0 0 1 28 0c0 6-3 9-6 10v6h-16v-6c-3-1-6-4-6-10z" fill="#fff7ec" stroke="#2b1a14" stroke-width="1.2"/><circle cx="-6" cy="0" r="4.2" fill="#3a9fd6"/><circle cx="6" cy="0" r="4.2" fill="#3a9fd6"/><circle cx="-6" cy="0" r="1.6" fill="#fff"/><circle cx="6" cy="0" r="1.6" fill="#fff"/><path d="M0 4l-2 3h4z" fill="#e2412e"/><path d="M-6 11h12M-3 9v4M0 9v4M3 9v4" stroke="#2b1a14" stroke-width=".9"/>${[-9, -3, 3, 9].map((x, i) => `<circle cx="${x}" cy="-10" r="1.8" fill="${['#e2412e', '#f7a21b', '#3a9a3a', '#c86bd9'][i]}"/>`).join('')}</g>`;
const LANTERN = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0-12v6" stroke="url(#cabm)" stroke-width="1.2"/><path d="M-6-6h12l3 4v14l-3 4H-6l-3-4V-2z" fill="#f6c453" stroke="url(#cabm)" stroke-width="1.4"/><path d="M-4-2h8v12h-8z" fill="#fff3c0" opacity=".9"/><path d="M0-2v12M-4 4h8" stroke="#c98a1e" stroke-width=".7"/><path d="M-4 16 0 20 4 16" fill="url(#cabm)"/></g>`;
const DIYA = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-9 0h18c-2 6-6 8-9 8s-7-2-9-8z" fill="#c8662a" stroke="#7a3412" stroke-width=".8"/><path d="M0-1c3-3 3-7 0-11-3 4-3 8 0 11z" fill="#ffd34d"/><path d="M0-3c1.4-1.6 1.4-3.6 0-5.6-1.4 2-1.4 4 0 5.6z" fill="#fff4b8"/></g>`;
const HOLLY = (x, y, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M0 0c-6-2-10 1-14-2 2 4-1 6 1 9 3-2 7-1 13-7zM0 0c6-2 10 1 14-2-2 4 1 6-1 9-3-2-7-1-13-7z" fill="#2f7a3a" stroke="#1a4a22" stroke-width=".6"/><circle cx="-2" cy="2" r="2.4" fill="#d1222f"/><circle cx="2.4" cy="3" r="2.4" fill="#d1222f"/></g>`;
const PAPEL = (colours) => {
  // A string of cut-paper flags across the top, each with its little cut pattern.
  const flags = Array.from({ length: 11 }, (_, i) => {
    const x = 18 + i * 34;
    const c = colours[i % colours.length];
    return `<g transform="translate(${x} 4)"><path d="M0 0h30v26l-5-4-5 4-5-4-5 4-5-4-5 4z" fill="${c}" opacity=".95"/><g fill="var(--cab-wood)" opacity=".75"><circle cx="15" cy="9" r="3"/><path d="M6 15h4v4H6zM20 15h4v4h-4z"/><path d="M15 15l3 4h-6z"/></g></g>`;
  }).join('');
  return `<svg class="cab-papel" viewBox="0 0 400 34" aria-hidden="true"><path d="M0 4Q200 10 400 4" stroke="#6b4a2a" stroke-width="1" fill="none"/>${flags}</svg>`;
};

// What crowns the cabinet today: the pediment with its centre, and anything strung or set on it.
function crown(day, t) {
  const charms = (day.festive && lookOf(day.id, t)?.charms) || [];
  const colours = FESTIVE_COLOURS[day.id] || [t?.accent || '#c9a227', t?.main || '#7a0f1d', '#f6c431'];
  switch (day.family) {
    case 'dragon':
      return pediment(FU, '', DRAGON);
    case 'carpet':
      return pediment(cartouche(MEDALLION, '#7a1418'));
    case 'papel':
      return pediment(cartouche(CALAVERA, '#2b1a3a')) + PAPEL(['#e2412e', '#f7a21b', '#3a9fd6', '#c86bd9', '#3a9a3a', '#ff6f91']);
    case 'diya':
      return pediment(cartouche(DIYA(0, 4), '#5a1414'), [40, 90, 310, 360].map((x) => DIYA(x, 84)).join(''));
    case 'lantern':
    case 'lantern-east':
      return pediment(cartouche(LANTERN(0, 2, 1.1), day.family === 'lantern-east' ? '#8c1220' : '#123a4a'), LANTERN(30, 82, 0.9) + LANTERN(370, 82, 0.9));
    case 'holly':
      return pediment(cartouche(wreath), HOLLY(150, 40, -18) + HOLLY(250, 40, 18) + HOLLY(30, 80, -30) + HOLLY(370, 80, 30));
    case 'garland': {
      // Any other festive day: a ribbon in its colours and its drawings along the top.
      const pics = charms.length ? charms : ['twinkle'];
      return pediment(cartouche(wreath)) + `<div class="cab-garland" aria-hidden="true" style="--g1:${colours[0]};--g2:${colours[1] || colours[0]};--g3:${colours[2] || colours[0]}">${Array.from({ length: 7 }, (_, i) => `<span style="background-image:${drawingUrl(pics[i % pics.length], t || {}, 28).replace(/"/g, '&quot;')}"></span>`).join('')}</div>`;
    }
    default:
      return pediment(cartouche(wreath));
  }
}

// ---------- the objects ----------
// Each highlight is the real thing its app would hold, presented as a piece in a collection: a
// map or photograph in a gilt frame on a brass easel, a record in its sleeve (a dark leather one,
// gold-tooled, if there's no cover), a cinema ticket on ivory card or the film's poster framed, a
// VHS tape, a cassette. All of it warmed by the cabinet's lamp. Titles go in as text, never markup.
// The map around a place (OpenStreetMap tiles, as the journal's maps use), and where it sits.
function mapAt(lat, lon, z = 15) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { z, x: Math.floor(x), y: Math.floor(y), fx: x % 1, fy: y % 1, url: (dx = 0, dy = 0) => `https://tile.openstreetmap.org/${z}/${Math.floor(x) + dx}/${Math.floor(y) + dy}.png` };
}
const PIN = '<svg viewBox="0 0 24 34" aria-hidden="true"><defs><radialGradient id="pinh" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#ff8a80"/><stop offset=".5" stop-color="#b8201c"/><stop offset="1" stop-color="#5e0a08"/></radialGradient></defs><path d="M12 33 11 18h2z" fill="#9aa3ad"/><circle cx="12" cy="11" r="9" fill="url(#pinh)"/><ellipse cx="9" cy="7.5" rx="3" ry="2" fill="#fff" opacity=".55"/></svg>';
const hasMap = (p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && !(p.lat === 0 && p.lon === 0);
// The map: a 3 × 3 block of tiles with the place in the middle (big = the unfolded one).
function mapSheet(post) {
  const m = mapAt(post.lat, post.lon);
  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push(h('img', { src: m.url(dx, dy), alt: '', loading: 'lazy', draggable: 'false' }));
  // (Shifted so the place itself is at the centre.)
  return h('span', { class: 'cab-map-tiles', style: { '--fx': m.fx.toFixed(3), '--fy': m.fy.toFixed(3) } }, tiles);
}
function objectFor(post) {
  const pic = post.photos?.[0] || post.cover || '';
  const img = pic ? h('img', { src: pic, alt: '', loading: 'lazy', draggable: 'false' }) : null;
  const title = post.title || '';
  const frame = (inner, cls) => h('span', { class: `cab-obj cab-framed ${cls}` }, h('span', { class: 'cab-frame' }, h('span', { class: 'cab-frame-in' }, inner)), h('span', { class: 'cab-easel', 'aria-hidden': 'true' }));
  switch (post.type) {
    case 'places':
      return hasMap(post)
        ? frame([h('span', { class: 'cab-map' }, mapSheet(post), h('span', { class: 'cab-map-folds', 'aria-hidden': 'true' }), h('span', { class: 'cab-map-pin', 'aria-hidden': 'true', html: PIN })), h('span', { class: 'cab-map-name' }, post.city || title)], 'is-map')
        : frame(img || h('span', { class: 'cab-blank' }, title), 'is-photo');
    case 'music':
      return h('span', { class: 'cab-obj cab-record' }, h('span', { class: 'cab-vinyl', 'aria-hidden': 'true' }, h('span', { class: 'cab-vinyl-label' })), h('span', { class: 'cab-sleeve' + (img ? '' : ' leather') }, img || [h('span', { class: 'cab-sleeve-ring', 'aria-hidden': 'true' }), h('span', { class: 'cab-sleeve-title' }, title)]));
    case 'films':
      return img
        ? frame(img, 'is-poster')
        : h('span', { class: 'cab-obj cab-ticket' }, h('span', { class: 'cab-ticket-face' }, h('span', { class: 'cab-ticket-top' }, 'CINEMA'), h('span', { class: 'cab-ticket-title' }, title), h('span', { class: 'cab-ticket-admit' }, 'ADMIT ONE'), h('span', { class: 'cab-ticket-no' }, `№ ${((String(post.slug || '').length * 7919) % 90000) + 10000}`)));
    case 'tv':
      return h('span', { class: 'cab-obj cab-vhs' }, h('span', { class: 'cab-vhs-case' }, h('span', { class: 'cab-vhs-spine' }, title)), h('span', { class: 'cab-vhs-tape', 'aria-hidden': 'true' }, h('span', { class: 'cab-vhs-window' })));
    default:
      return h('span', { class: 'cab-obj cab-cassette' }, h('span', { class: 'cab-cassette-label' }, title), h('span', { class: 'cab-cassette-window', 'aria-hidden': 'true' }), h('span', { class: 'cab-cassette-screws', 'aria-hidden': 'true' }));
  }
}
const subline = (p) => [p.type === 'places' ? [p.city, p.country].filter(Boolean).join(', ') : p.creator, p.year].filter(Boolean).join(' · ');
const stillness = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------- the closer look ----------
// A piece lifts off its shelf into your hands, and does what it does: the record slides out and
// spins, the map unfolds, the ticket turns over to show why it's there, the tape slides out of
// its case. Its museum label sits underneath. Go along the shelf with the arrows (or a swipe).
function closerLook(items, start, shelf, fromEl, make = null) {
  let at = start;
  const stage = h('div', { class: 'cab-stage' });
  const label = h('div', { class: 'cab-museum' });
  const prev = h('button', { type: 'button', class: 'cab-nav prev', 'aria-label': 'The one before' }, '‹');
  const next = h('button', { type: 'button', class: 'cab-nav next', 'aria-label': 'The next one' }, '›');
  const close = h('button', { type: 'button', class: 'cab-close', 'aria-label': 'Put it back' }, '×');
  const dlg = h('dialog', { class: 'cab-dialog', 'aria-label': `${shelf}: the closer look` }, h('div', { class: 'cab-spot', 'aria-hidden': 'true' }), close, stage, items.length > 1 ? [prev, next] : null, label);
  const show = (i, dir = 0) => {
    at = (i + items.length) % items.length;
    const { post, why, note } = items[at];
    const obj = make ? make(items[at]) : objectFor(post);
    obj.classList.add('in-hand');
    // The back of a ticket: why it's here, by hand.
    if (post.type === 'films' && obj.classList.contains('cab-ticket')) obj.append(h('span', { class: 'cab-ticket-back' }, h('span', null, why || post.title || ''), post.date ? h('small', null, niceDate(post.date)) : null));
    // The unfolded map: more of it, and a little bigger.
    stage.replaceChildren(obj);
    stage.dataset.dir = String(dir);
    label.replaceChildren(
      ...[h('p', { class: 'cab-museum-no' }, `${shelf} · № ${at + 1} of ${items.length}`),
      h('h3', null, post.title || ''),
      subline(post) ? h('p', { class: 'cab-museum-sub' }, subline(post)) : null,
      note ? h('p', { class: 'cab-museum-note' }, note) : null,
      why && !make && !(post.type === 'films' && obj.classList.contains('cab-ticket')) ? h('blockquote', { class: 'cab-why' }, h('small', null, 'Why it’s here'), h('span', null, why)) : null,
      h('div', { class: 'cab-museum-row' }, h('a', { class: 'cab-open', href: postHref(post) }, post.type === 'places' ? 'Open it in the journal ›' : 'Open it ›'), hasMap(post) && post.type === 'places' ? h('small', { class: 'cab-credit' }, 'Map © OpenStreetMap contributors') : null)].filter(Boolean)
    );
    label.querySelector('.cab-open').addEventListener('click', () => dlg.close());
    // (Its moment: after it's arrived.)
    requestAnimationFrame(() => requestAnimationFrame(() => obj.classList.add('act')));
    sound.page?.();
  };
  prev.addEventListener('click', () => show(at - 1, -1));
  next.addEventListener('click', () => show(at + 1, 1));
  close.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(at - 1, -1);
    if (e.key === 'ArrowRight') show(at + 1, 1);
  });
  // A swipe goes along the shelf.
  let x0 = null;
  stage.addEventListener('pointerdown', (e) => (x0 = e.clientX));
  stage.addEventListener('pointerup', (e) => {
    if (x0 != null && Math.abs(e.clientX - x0) > 40 && items.length > 1) show(at + (e.clientX < x0 ? 1 : -1), e.clientX < x0 ? 1 : -1);
    x0 = null;
  });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  show(start);
  dlg.showModal();
  // Lifted off the shelf: from where it stood to your hands.
  const to = stage.firstChild?.getBoundingClientRect();
  const from = fromEl?.getBoundingClientRect();
  if (from && to && to.width && !stillness()) {
    stage.firstChild.animate([{ transform: `translate(${from.left + from.width / 2 - (to.left + to.width / 2)}px, ${from.top + from.height / 2 - (to.top + to.height / 2)}px) scale(${from.width / to.width})`, opacity: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

// ---------- gilt bronze (ormolu): the mounts, capitals and feet ----------
let gid = 0;
// Gilt, lit from the top left: a gold gradient, an emboss, and a shadow underneath.
function gilt(w, hgt, inner) {
  const id = `g${++gid}`;
  return `<svg viewBox="0 0 ${w} ${hgt}" aria-hidden="true"><defs><linearGradient id="${id}m" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#fff5c8"/><stop offset=".2" stop-color="#e8c060"/><stop offset=".45" stop-color="#9c6e1c"/><stop offset=".62" stop-color="#e6bd58"/><stop offset=".82" stop-color="#fff0b2"/><stop offset="1" stop-color="#8a5f16"/></linearGradient><filter id="${id}e" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation=".9" result="b"/><feSpecularLighting in="b" surfaceScale="2.4" specularConstant="1.1" specularExponent="18" lighting-color="#fff7d6" result="s"><feDistantLight azimuth="235" elevation="40"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/><feDropShadow dx=".6" dy="1.4" stdDeviation=".9" flood-color="#1a0800" flood-opacity=".7" result="sh"/><feMerge><feMergeNode in="sh"/><feMergeNode in="SourceGraphic"/><feMergeNode in="sp"/></feMerge></filter></defs><g fill="url(#${id}m)" stroke="url(#${id}m)" filter="url(#${id}e)">${inner}</g></svg>`;
}
// An acanthus capital for the columns; an acanthus mount for the corners; a lion's paw foot;
// the keyhole's escutcheon; and a central mount for the apron.
const CAPITAL = () => gilt(40, 30, '<path d="M4 28h32v-4H4zM6 24c0-8 6-10 14-10s14 2 14 10z" stroke-width="0"/><path d="M8 22c-2-6 2-12 6-12-2 4-1 8 2 10M32 22c2-6-2-12-6-12 2 4 1 8-2 10M20 8c-4 4-4 10 0 14 4-4 4-10 0-14z" stroke-width="0"/><path d="M2 4h36v4H2z" stroke-width="0"/><circle cx="6" cy="10" r="3" stroke-width="0"/><circle cx="34" cy="10" r="3" stroke-width="0"/>');
const BASE = () => gilt(40, 14, '<path d="M2 12h36v2H2zM4 8h32v4H4zM7 2h26v6H7z" stroke-width="0"/>');
const CORNER = (flip) => gilt(60, 60, `<g transform="${flip ? 'translate(60 0) scale(-1 1)' : ''}"><path d="M2 2c20 0 34 6 40 16-8-4-16-4-22 2 4-10-6-16-18-14z" stroke-width="0"/><path d="M2 2c0 20 6 34 16 40-4-8-4-16 2-22-10 4-16-6-14-18z" stroke-width="0"/><circle cx="20" cy="20" r="5" stroke-width="0"/><path d="M26 26c6 0 12 2 16 8M26 26c0 6 2 12 8 16" fill="none" stroke-width="2.2"/></g>`);
const PAW = () => gilt(44, 40, '<path d="M8 4h28v8c0 6-4 8-4 8H12s-4-2-4-8z" stroke-width="0"/><path d="M4 36c0-8 4-16 8-16h20c4 0 8 8 8 16z" stroke-width="0"/><g fill="none" stroke-width="1.6" stroke="#5a3a08" opacity=".6"><path d="M13 36c0-5 1-10 3-14M22 36V22M31 36c0-5-1-10-3-14"/></g>');
const ESCUTCHEON = () => gilt(22, 34, '<path d="M11 1c6 4 10 9 10 16s-4 12-10 16C5 29 1 24 1 17S5 5 11 1z" stroke-width="0"/><path d="M11 12a3 3 0 0 1 2 5l1 7h-6l1-7a3 3 0 0 1 2-5z" fill="#1a0c02" stroke="none"/>');
const APRON = () => gilt(120, 26, '<path d="M60 2c8 0 14 6 14 11s-6 11-14 11-14-6-14-11 6-11 14-11z" stroke-width="0"/><path d="M46 13C34 4 18 6 4 13c14 4 28 6 42 0zM74 13c12-9 28-7 42 0-14 4-28 6-42 0z" stroke-width="0"/><circle cx="60" cy="13" r="5" fill="#1a0c02" opacity=".25" stroke="none"/>');

// ---------- the cabinet ----------
// Closed, you see everything through the glass, its reflections moving as you do. Turn the key
// and the doors swing open, the lamp warms up and dust drifts in its light; pick anything out to
// look at it closely. A gilt handle closes it again.
export function cabinet(data) {
  const hl = data?.highlights || {};
  const byId = new Map((data?.posts || []).map((p) => [`${p.type}/${p.slug}`, p]));
  const shelves = SHELVES.map(([type, name]) => [type, name, (hl[type] || []).map((x) => ({ ...x, post: byId.get(x.post) })).filter((x) => x.post).slice(0, PER_SHELF)]).filter(([, , items]) => items.length);
  if (!shelves.length) return null;
  const t = activeSkin();
  const day = today(t);
  const doors = h('button', { type: 'button', class: 'cab-doors', 'aria-label': 'Turn the key and open the cabinet', 'aria-expanded': 'false' }, h('span', { class: 'cab-door left' }, h('span', { class: 'cab-pane' })), h('span', { class: 'cab-door right' }, h('span', { class: 'cab-pane' })), h('span', { class: 'cab-escutcheon', html: ESCUTCHEON() }, h('span', { class: 'cab-key', 'aria-hidden': 'true' })));
  const shut = h('button', { type: 'button', class: 'cab-shut', 'aria-label': 'Close the cabinet' }, h('span', { 'aria-hidden': 'true' }), 'Close');
  const dust = h('span', { class: 'cab-dust', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) => h('i', { style: { '--d': `${(i * 37) % 100}%`, '--t': `${9 + ((i * 7) % 8)}s`, '--w': `${-((i * 13) % 9)}s`, '--s': `${1 + (i % 3) * 0.6}px` } })));
  const box = h(
    'section',
    { class: 'cabinet', id: 'highlights', 'data-cab': day.family, 'data-cab-day': day.id, 'aria-label': 'Highlights' },
    h('div', { class: 'cab-crown', html: crown(day, t) }),
    h('div', { class: 'cab-cornice' }, h('span', { class: 'cab-corner left', html: CORNER(false) }), h('span', { class: 'cab-title' }, 'Highlights'), h('span', { class: 'cab-corner right', html: CORNER(true) })),
    h(
      'div',
      { class: 'cab-body' },
      h('span', { class: 'cab-pilaster left' }, h('span', { class: 'cab-capital', html: CAPITAL() }), h('span', { class: 'cab-base', html: BASE() })),
      h(
        'div',
        { class: 'cab-glass' },
        h('span', { class: 'cab-lamp', 'aria-hidden': 'true' }),
        h('span', { class: 'cab-warmth', 'aria-hidden': 'true' }),
        dust,
        shelves.map(([type, name, items]) =>
          h(
            'div',
            { class: `cab-shelf cab-shelf-${type}` },
            h('div', { class: 'cab-plate' }, h('span', null, name)),
            h(
              'ul',
              { class: 'cab-row' },
              items.map(({ post, why }, i) =>
                h(
                  'li',
                  { class: 'cab-item' + (i === 0 ? ' first' : '') },
                  h('button', { type: 'button', class: 'cab-pick', tabindex: '-1', 'aria-label': `${post.title || name}${i === 0 ? ', number one' : ''}${why ? `: ${why}` : ''}`, onclick: (e) => closerLook(items, i, name, e.currentTarget.querySelector('.cab-obj')) }, objectFor(post)),
                  i === 0 ? h('span', { class: 'cab-no1', 'aria-hidden': 'true' }, '№ 1') : null,
                  h('span', { class: 'cab-label' }, post.title || '')
                )
              )
            ),
            h('span', { class: 'cab-shelf-glass', 'aria-hidden': 'true' })
          )
        ),
        doors
      ),
      h('span', { class: 'cab-pilaster right' }, h('span', { class: 'cab-capital', html: CAPITAL() }), h('span', { class: 'cab-base', html: BASE() }))
    ),
    h('div', { class: 'cab-apron' }, h('span', { class: 'cab-apron-mount', html: APRON() }), shut),
    h('div', { class: 'cab-plinth' }, h('span', { class: 'cab-foot left', html: PAW() }), h('span', { class: 'cab-foot right', html: PAW() }))
  );
  const picks = () => box.querySelectorAll('.cab-pick');
  // Turning the key: a click, the latch, the doors swing back and the lamp warms up.
  doors.addEventListener('click', () => {
    if (box.classList.contains('open')) return;
    sound.key?.();
    box.classList.add('unlocking');
    setTimeout(() => {
      sound.latch?.();
      box.classList.add('open');
      doors.setAttribute('aria-expanded', 'true');
      picks().forEach((b) => b.removeAttribute('tabindex'));
      picks()[0]?.focus({ preventScroll: true });
    }, stillness() ? 0 : 380);
  });
  shut.addEventListener('click', () => {
    box.classList.remove('open', 'unlocking');
    doors.setAttribute('aria-expanded', 'false');
    picks().forEach((b) => b.setAttribute('tabindex', '-1'));
    setTimeout(() => sound.latch?.(), stillness() ? 0 : 700);
    doors.focus({ preventScroll: true });
  });
  // The glass catches the light as you move around it (the pointer on a computer; scrolling on a
  // phone): its reflections slide, and the back of the case shifts a little behind the shelves.
  if (!stillness()) {
    let raf = 0;
    const set = (px, py) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        box.style.setProperty('--px', px.toFixed(3));
        box.style.setProperty('--py', py.toFixed(3));
      });
    };
    box.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = box.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    });
    box.addEventListener('pointerleave', () => set(0, 0));
    const onScroll = () => {
      if (!box.isConnected) return document.removeEventListener('scroll', onScroll, { capture: true });
      const r = box.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      set(Math.max(-1, Math.min(1, ((r.top + r.height / 2) / vh) * 2 - 1)) * 0.8, 0);
    };
    // (Any scrolling box the cabinet is in.)
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  }
  return box;
}

// ---------- the library ----------
// Either side of the cabinet, a low mahogany bookcase with a marble top: one holds what was once in
// the cabinet, the other what you recommend. Each is a leather-bound volume (oxblood, bottle green,
// navy, tan, black), raised bands and a gilt-tooled title on the spine. Take one down and it opens:
// a tipped-in plate and the title on the left, your words on the right.
const LEATHER = [['#5a1414', '#2a0606'], ['#1f3b2a', '#0b1a11'], ['#1c2747', '#0a1022'], ['#7a4a22', '#3a200c'], ['#2a1d17', '#0d0806'], ['#4b1830', '#1f0613'], ['#3b3a1c', '#17160a']];
const SHELF_OF = { places: 'Places', music: 'Music', films: 'Films', tv: 'Television', podcasts: 'Podcasts', books: 'Books' };
const hash = (str) => [...String(str)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const monthYear = (d) => {
  const t = new Date(`${d}T12:00:00`);
  return Number.isNaN(+t) ? '' : t.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};
// What the library holds: former highlights, and the posts you recommend.
export function libraryOf(data) {
  const byId = new Map((data?.posts || []).map((p) => [`${p.type}/${p.slug}`, p]));
  const now = new Set(Object.values(data?.highlights || {}).flat().map((x) => x.post));
  const past = (data?.highlightsPast || [])
    .map((x) => ({ post: byId.get(x.post), why: x.why, note: [`On the ${SHELF_OF[x.post.split('/')[0]] || ''} shelf`, x.until && monthYear(x.until) ? `until ${monthYear(x.until)}` : ''].filter(Boolean).join(' ') }))
    .filter((x) => x.post && !now.has(`${x.post.type}/${x.post.slug}`))
    .slice(0, 24);
  const NOTE = { books: 'A book I recommend', films: 'Worth watching again', tv: 'Worth watching again', places: 'I’d go back' };
  const shown = new Set(past.map((x) => x.post));
  const recs = (data?.posts || [])
    .filter((p) => !shown.has(p) && !now.has(`${p.type}/${p.slug}`) && ((p.type === 'books' && p.recommend) || ((p.type === 'films' || p.type === 'tv') && p.rewatch) || (p.type === 'places' && p.would_return)))
    .slice(0, 24)
    .map((post) => ({ post, why: '', note: NOTE[post.type] }));
  return { past, recs };
}
function spine(item, i) {
  const { post } = item;
  const k = hash(post.slug || post.title || i);
  const [c1, c2] = LEATHER[k % LEATHER.length];
  const tall = 72 + (k % 5) * 5;
  const wide = 15 + ((k >> 3) % 4) * 3 + Math.min(6, Math.floor(String(post.title || '').length / 6));
  return h('span', { class: 'lib-spine' + ((k >> 5) % 4 === 0 ? ' banded' : ''), style: { '--c1': c1, '--c2': c2, '--h': `${tall}px`, '--bw': `${Math.min(30, wide)}px` } }, h('span', { class: 'lib-label' }, h('span', null, post.title || '')));
}
// The book, open: a tipped-in plate (its photo or cover, if it has one) and its title on the left;
// on the right, your line on why, or its opening words.
function openBook({ post, why }) {
  const k = hash(post.slug || post.title || '');
  const [c1, c2] = LEATHER[k % LEATHER.length];
  const pic = post.photos?.[0] || post.cover || '';
  const words = why || post.excerpt || '';
  return h(
    'span',
    { class: 'cab-obj lib-book', style: { '--c1': c1, '--c2': c2 } },
    h('span', { class: 'lib-boards', 'aria-hidden': 'true' }),
    h('span', { class: 'lib-page left' }, h('small', null, SHELF_OF[post.type] || ''), pic ? h('span', { class: 'lib-plate' }, h('img', { src: pic, alt: '', loading: 'lazy', draggable: 'false' })) : h('span', { class: 'lib-fleuron', 'aria-hidden': 'true' }, '❦'), h('strong', null, post.title || ''), subline(post) ? h('em', null, subline(post)) : null),
    h('span', { class: 'lib-page right' }, words ? h('span', { class: why ? 'lib-hand' : 'lib-text' }, words.length > 420 ? `${words.slice(0, 420).replace(/\s+\S*$/, '')}…` : words) : null, post.date ? h('small', null, niceDate(post.date)) : null),
    h('span', { class: 'lib-cover', 'aria-hidden': 'true' }, h('span', null, post.title || ''))
  );
}
function bookcase(name, items, side) {
  if (!items.length) return null;
  const perShelf = 9;
  const rows = [];
  for (let i = 0; i < items.length; i += perShelf) rows.push(items.slice(i, i + perShelf));
  return h(
    'section',
    { class: `lib ${side}`, 'aria-label': name },
    h('div', { class: 'lib-top', 'aria-hidden': 'true' }),
    h('div', { class: 'lib-frieze' }, h('span', { class: 'lib-plate-name' }, name)),
    h(
      'div',
      { class: 'lib-body' },
      rows.slice(0, 3).map((row, r) =>
        h(
          'ul',
          { class: 'lib-shelf' },
          row.map((item, j) => {
            const i = r * perShelf + j;
            return h('li', null, h('button', { type: 'button', class: 'lib-pick', 'aria-label': `${item.post.title || ''}: ${item.note}`, onclick: (e) => { const b = e.currentTarget; b.classList.add('pulled'); sound.page?.(); setTimeout(() => { b.classList.remove('pulled'); closerLook(items, i, name, b.firstChild, openBook); }, stillness() ? 0 : 220); } }, spine(item, i)));
          }),
          // A bookend at the end of a short row.
          row.length < perShelf ? h('li', { class: 'lib-end', 'aria-hidden': 'true' }) : null
        )
      )
    ),
    h('div', { class: 'lib-plinth', 'aria-hidden': 'true' })
  );
}
export function library(data) {
  const { past, recs } = libraryOf(data);
  return [bookcase('Once in the cabinet', past, 'left'), bookcase('Recommended', recs, 'right')];
}

// ---------- the room ----------
// The cabinet stands in a room of its own (#/highlights): crimson silk walls in white-and-gold
// panelling, a parquet floor, a chandelier's light. Nothing of the desktop or phone shows while
// you're in it; Leave (or Escape) takes you back where you were.
let room = null;
let cameFrom = '';
export function cabinetCount(data) {
  const hl = data?.highlights || {};
  const there = new Set((data?.posts || []).map((p) => `${p.type}/${p.slug}`));
  return SHELVES.reduce((n, [type]) => n + (hl[type] || []).filter((x) => there.has(x.post)).slice(0, PER_SHELF).length, 0);
}
function leave() {
  if (cameFrom && cameFrom !== '#/highlights') history.back();
  else location.hash = '#/about';
}
export function syncRoom(data, hash = location.hash, from = '') {
  const want = /^#\/highlights\/?$/.test(hash);
  if (!want) {
    room?.remove();
    room = null;
    document.documentElement.classList.remove('in-room');
    return;
  }
  if (from) cameFrom = from;
  if (room) return;
  const piece = cabinet(data);
  const name = data?.site?.owner || data?.site?.name || '';
  const back = h('button', { type: 'button', class: 'room-leave' }, h('span', { 'aria-hidden': 'true' }, '‹'), 'Leave');
  back.addEventListener('click', leave);
  room = h(
    'div',
    { class: 'cab-room', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Highlights' },
    h('div', { class: 'room-wall', 'aria-hidden': 'true' }, h('span', { class: 'room-panel left' }), h('span', { class: 'room-panel right' }), h('span', { class: 'room-dado' })),
    h('div', { class: 'room-floor', 'aria-hidden': 'true' }),
    h('div', { class: 'room-light', 'aria-hidden': 'true' }),
    h('header', { class: 'room-head' }, back, h('p', { class: 'room-title' }, h('small', null, name ? `${name}’s` : 'The'), 'Highlights')),
    h('div', { class: 'room-stage' }, h('div', { class: 'room-set' }, ...(() => {
      const [left, right] = library(data);
      return [left, piece || h('p', { class: 'room-empty' }, 'Nothing in the cabinet yet.'), right];
    })()))
  );
  room.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.querySelector('.cab-dialog[open]')) leave();
  });
  document.documentElement.classList.add('in-room');
  document.body.append(room);
  back.focus({ preventScroll: true });
  // Sized to stand in the room: the whole cabinet scaled to fit the height there is (on a phone,
  // a little smaller at most, and you can scroll the rest).
  const stage = room.querySelector('.room-stage');
  // On a computer the bookcases stand either side, and the whole set is scaled to fit the room;
  // on a phone they're below the cabinet, a scroll away.
  const set = room.querySelector('.room-set');
  const fit = () => {
    if (!room || !piece) return;
    const wide = window.innerWidth >= 900;
    const what = wide ? set : piece;
    set.style.zoom = piece.style.zoom = '1';
    const cs = getComputedStyle(stage);
    const room_h = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 16;
    const room_w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const z = Math.min(1, room_h / what.offsetHeight, wide ? room_w / what.scrollWidth : 1);
    what.style.zoom = String(Math.max(window.innerWidth > 640 ? 0.45 : 0.84, z).toFixed(3));
  };
  requestAnimationFrame(fit);
  const onResize = () => (room ? fit() : window.removeEventListener('resize', onResize));
  window.addEventListener('resize', onResize);
}

// On the About page: the way into the room.
export function cabinetEntrance(data) {
  const n = cabinetCount(data);
  if (!n) return null;
  return h(
    'a',
    { class: 'cab-entrance', href: '#/highlights' },
    h('span', { class: 'cab-entrance-frame' }, h('small', null, 'The'), h('strong', null, 'Highlights'), h('span', { class: 'cab-entrance-sub' }, `The best of the places, music, films, television and podcasts · ${n} piece${n === 1 ? '' : 's'}`), h('span', { class: 'cab-entrance-go' }, 'Step inside ›'))
  );
}
