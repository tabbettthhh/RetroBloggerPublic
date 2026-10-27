// Passport stamps, drawn from scratch. Shape, ink, icon and tilt are picked from the city
// name, so a city always gets the same stamp, unless a stamp was picked for it in the back
// office. The first city in each country gets that country's own stamp, about a third of
// the later ones do too, and the rest get a general design (Schengen countries the EU one).
import { esc, hash, stampDate } from './util.js';

const INKS = ['#23408e', '#5b2a86', '#b2221c', '#7a1a1a', '#1d3f8a', '#1f6a4a', '#8a2e1a', '#2b6a3a', '#2f4fa3', '#4a2f7a', '#2a2a2a', '#1f5a3a', '#9c3d14', '#3b3b7a'];
const SCHENGEN = new Set(['AT', 'BE', 'BG', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH']);
const SIGN = { AT: 'A', BE: 'B', DE: 'D', ES: 'E', FR: 'F', HU: 'H', IT: 'I', LU: 'L', MT: 'M', NO: 'N', PT: 'P', SE: 'S', IS: 'IS', NL: 'NL', CH: 'CH', FI: 'FIN', DK: 'DK', GR: 'GR', PL: 'PL', CZ: 'CZ', SK: 'SK', SI: 'SLO', HR: 'HR', EE: 'EST', LV: 'LV', LT: 'LT', LI: 'FL', BG: 'BG', RO: 'RO' };
// Every country with its own stamp: [code, name, capital, layout, word, English word, icon].
// The city (the capital, or the main arrival city) is only used for previews in the back office. Layouts gb…in are drawn
// individually further down; the rest share a handful of layouts with the local word for "entry".
const COUNTRY_ROWS = [
  ['AF', 'Afghanistan', 'Kabul', 'dome', 'ورود', 'ENTRY', 'mountain'],
  ['AL', 'Albania', 'Tirana', 'cut', 'HYRJE', 'ENTRY', 'mountain'],
  ['DZ', 'Algeria', 'Algiers', 'dome', 'دخول', 'ENTRY', 'sun'],
  ['AR', 'Argentina', 'Buenos Aires', 'ovall', 'ENTRADA', 'MIGRACIONES', 'sun'],
  ['AM', 'Armenia', 'Yerevan', 'roundl', 'ՄՈՒՏՔ', 'ENTRY', 'mountain'],
  ['AU', 'Australia', 'Canberra', 'au'],
  ['AT', 'Austria', 'Vienna', 'boxl', 'EINREISE', 'ENTRY', 'mountain'],
  ['AZ', 'Azerbaijan', 'Baku', 'octl', 'GİRİŞ', 'ENTRY'],
  ['BH', 'Bahrain', 'Manama', 'cut', 'دخول', 'ENTRY', 'palm'],
  ['BD', 'Bangladesh', 'Dhaka', 'roundl', 'প্রবেশ', 'ENTRY'],
  ['BE', 'Belgium', 'Brussels', 'octl', 'ENTRÉE', 'ENTRY'],
  ['BA', 'Bosnia and Herzegovina', 'Sarajevo', 'boxl', 'ULAZ', 'ENTRY', 'mountain'],
  ['BR', 'Brazil', 'Brasília', 'cut', 'ENTRADA', 'ARRIVAL', 'palm'],
  ['BG', 'Bulgaria', 'Sofia', 'roundl', 'ВХОД', 'ENTRY'],
  ['KH', 'Cambodia', 'Phnom Penh', 'dome', 'ARRIVAL', 'IMMIGRATION', 'sun'],
  ['CA', 'Canada', 'Ottawa', 'ca'],
  ['CL', 'Chile', 'Santiago', 'boxl', 'ENTRADA', 'ADMITIDO', 'mountain'],
  ['CN', 'China', 'Beijing', 'boxl', '入境', 'ENTRY'],
  ['CO', 'Colombia', 'Bogotá', 'ovall', 'ENTRADA', 'MIGRACIÓN', 'mountain'],
  ['CR', 'Costa Rica', 'San José', 'cut', 'ENTRADA', 'MIGRACIÓN', 'palm'],
  ['HR', 'Croatia', 'Zagreb', 'roundl', 'ULAZ', 'ENTRY', 'ship'],
  ['CU', 'Cuba', 'Havana', 'ovall', 'ENTRADA', 'INMIGRACIÓN', 'palm'],
  ['CY', 'Cyprus', 'Nicosia', 'cut', 'ΑΦΙΞΗ', 'ARRIVAL', 'sun'],
  ['CZ', 'Czechia', 'Prague', 'octl', 'VSTUP', 'ENTRY'],
  ['DK', 'Denmark', 'Copenhagen', 'boxl', 'INDREJSE', 'ENTRY', 'ship'],
  ['DO', 'Dominican Republic', 'Santo Domingo', 'cut', 'ENTRADA', 'MIGRACIÓN', 'palm'],
  ['EC', 'Ecuador', 'Quito', 'roundl', 'ENTRADA', 'MIGRACIÓN', 'mountain'],
  ['EG', 'Egypt', 'Cairo', 'boxl', 'وصول', 'ARRIVAL', 'sun'],
  ['EE', 'Estonia', 'Tallinn', 'boxl', 'SISSESÕIT', 'ENTRY'],
  ['ET', 'Ethiopia', 'Addis Ababa', 'roundl', 'ARRIVAL', 'IMMIGRATION', 'mountain'],
  ['FJ', 'Fiji', 'Suva', 'cut', 'BULA', 'ARRIVAL', 'palm'],
  ['FI', 'Finland', 'Helsinki', 'octl', 'MAAHANTULO', 'ENTRY'],
  ['FR', 'France', 'Paris', 'octl', 'ENTRÉE', 'ENTRY'],
  ['GE', 'Georgia', 'Tbilisi', 'dome', 'შესვლა', 'ENTRY', 'mountain'],
  ['DE', 'Germany', 'Berlin', 'boxl', 'EINREISE', 'ENTRY'],
  ['GH', 'Ghana', 'Accra', 'roundl', 'AKWAABA', 'ARRIVAL', 'sun'],
  ['GR', 'Greece', 'Athens', 'roundl', 'ΕΙΣΟΔΟΣ', 'ENTRY', 'sun'],
  ['GT', 'Guatemala', 'Guatemala City', 'ovall', 'ENTRADA', 'MIGRACIÓN', 'mountain'],
  ['HK', 'Hong Kong', 'Hong Kong', 'octl', '入境', 'ARRIVAL'],
  ['HU', 'Hungary', 'Budapest', 'cut', 'BELÉPÉS', 'ENTRY'],
  ['IS', 'Iceland', 'Reykjavík', 'roundl', 'KOMA', 'ARRIVAL', 'mountain'],
  ['IN', 'India', 'New Delhi', 'in'],
  ['ID', 'Indonesia', 'Jakarta', 'boxl', 'KEDATANGAN', 'ARRIVAL', 'palm'],
  ['IR', 'Iran', 'Tehran', 'dome', 'ورود', 'ENTRY', 'mountain'],
  ['IQ', 'Iraq', 'Baghdad', 'dome', 'دخول', 'ENTRY', 'palm'],
  ['IE', 'Ireland', 'Dublin', 'roundl', 'LANDED', 'IMMIGRATION'],
  ['IL', 'Israel', 'Tel Aviv', 'boxl', 'כניסה', 'ENTRY', 'sun'],
  ['IT', 'Italy', 'Rome', 'roundl', 'INGRESSO', 'ENTRY'],
  ['JM', 'Jamaica', 'Kingston', 'cut', 'ARRIVAL', 'IMMIGRATION', 'palm'],
  ['JP', 'Japan', 'Tokyo', 'jp'],
  ['JO', 'Jordan', 'Amman', 'dome', 'دخول', 'ENTRY', 'sun'],
  ['KZ', 'Kazakhstan', 'Astana', 'octl', 'КІРУ', 'ENTRY', 'mountain'],
  ['KE', 'Kenya', 'Nairobi', 'roundl', 'KARIBU', 'ARRIVAL', 'sun'],
  ['KW', 'Kuwait', 'Kuwait City', 'cut', 'دخول', 'ENTRY', 'sun'],
  ['LV', 'Latvia', 'Riga', 'boxl', 'IEBRAUKŠANA', 'ENTRY'],
  ['LB', 'Lebanon', 'Beirut', 'dome', 'دخول', 'ENTRY', 'mountain'],
  ['LT', 'Lithuania', 'Vilnius', 'octl', 'ATVYKIMAS', 'ARRIVAL'],
  ['LU', 'Luxembourg', 'Luxembourg', 'octl', 'ENTRÉE', 'ENTRY'],
  ['MY', 'Malaysia', 'Kuala Lumpur', 'ovall', 'MASUK', 'ENTRY', 'palm'],
  ['MV', 'Maldives', 'Malé', 'cut', 'ARRIVAL', 'IMMIGRATION', 'palm'],
  ['MT', 'Malta', 'Valletta', 'roundl', 'DĦUL', 'ENTRY', 'ship'],
  ['MU', 'Mauritius', 'Port Louis', 'ovall', 'ARRIVAL', 'IMMIGRATION', 'palm'],
  ['MX', 'Mexico', 'Mexico City', 'ovall', 'ENTRADA', 'ADMITTED', 'sun'],
  ['ME', 'Montenegro', 'Podgorica', 'cut', 'ULAZ', 'ENTRY', 'mountain'],
  ['MA', 'Morocco', 'Rabat', 'ma'],
  ['NP', 'Nepal', 'Kathmandu', 'dome', 'आगमन', 'ARRIVAL', 'mountain'],
  ['NL', 'Netherlands', 'Amsterdam', 'boxl', 'AANKOMST', 'ARRIVAL'],
  ['NZ', 'New Zealand', 'Wellington', 'cut', 'ARRIVED', 'IMMIGRATION', 'mountain'],
  ['NG', 'Nigeria', 'Abuja', 'boxl', 'ARRIVAL', 'IMMIGRATION', 'sun'],
  ['MK', 'North Macedonia', 'Skopje', 'roundl', 'ВЛЕЗ', 'ENTRY', 'mountain'],
  ['NO', 'Norway', 'Oslo', 'boxl', 'INNREISE', 'ENTRY', 'mountain'],
  ['OM', 'Oman', 'Muscat', 'dome', 'دخول', 'ENTRY', 'palm'],
  ['PK', 'Pakistan', 'Islamabad', 'roundl', 'آمد', 'ARRIVAL'],
  ['PS', 'Palestine', 'Ramallah', 'dome', 'دخول', 'ENTRY', 'sun'],
  ['PA', 'Panama', 'Panama City', 'ovall', 'ENTRADA', 'MIGRACIÓN', 'ship'],
  ['PE', 'Peru', 'Lima', 'cut', 'ENTRADA', 'MIGRACIONES', 'mountain'],
  ['PH', 'Philippines', 'Manila', 'boxl', 'ARRIVAL', 'ADMITTED', 'palm'],
  ['PL', 'Poland', 'Warsaw', 'octl', 'WJAZD', 'ENTRY'],
  ['PT', 'Portugal', 'Lisbon', 'cut', 'ENTRADA', 'ENTRY', 'ship'],
  ['QA', 'Qatar', 'Doha', 'cut', 'وصول', 'ARRIVAL', 'palm'],
  ['RO', 'Romania', 'Bucharest', 'boxl', 'INTRARE', 'ENTRY'],
  ['RU', 'Russia', 'Moscow', 'boxl', 'ВЪЕЗД', 'ENTRY'],
  ['RW', 'Rwanda', 'Kigali', 'roundl', 'ARRIVAL', 'IMMIGRATION', 'mountain'],
  ['SA', 'Saudi Arabia', 'Riyadh', 'dome', 'دخول', 'ENTRY', 'palm'],
  ['SN', 'Senegal', 'Dakar', 'ovall', 'ENTRÉE', 'ARRIVÉE', 'sun'],
  ['RS', 'Serbia', 'Belgrade', 'roundl', 'УЛАЗ', 'ENTRY'],
  ['SG', 'Singapore', 'Singapore', 'octl', 'ARRIVAL', 'IMMIGRATION'],
  ['SK', 'Slovakia', 'Bratislava', 'octl', 'VSTUP', 'ENTRY'],
  ['SI', 'Slovenia', 'Ljubljana', 'roundl', 'VSTOP', 'ENTRY', 'mountain'],
  ['ZA', 'South Africa', 'Pretoria', 'cut', 'TOEGELAAT', 'ADMITTED', 'sun'],
  ['KR', 'South Korea', 'Seoul', 'roundl', '입국', 'ENTRY'],
  ['ES', 'Spain', 'Madrid', 'ovall', 'ENTRADA', 'ENTRY', 'sun'],
  ['LK', 'Sri Lanka', 'Colombo', 'ovall', 'ARRIVAL', 'IMMIGRATION', 'palm'],
  ['SE', 'Sweden', 'Stockholm', 'boxl', 'INRESA', 'ENTRY'],
  ['CH', 'Switzerland', 'Bern', 'octl', 'EINREISE', 'ENTRY', 'mountain'],
  ['TW', 'Taiwan', 'Taipei', 'boxl', '入境', 'ARRIVAL'],
  ['TZ', 'Tanzania', 'Dodoma', 'ovall', 'KARIBU', 'ARRIVAL', 'mountain'],
  ['TH', 'Thailand', 'Bangkok', 'th'],
  ['TN', 'Tunisia', 'Tunis', 'dome', 'دخول', 'ENTRY', 'palm'],
  ['TR', 'Türkiye', 'Ankara', 'tr'],
  ['UG', 'Uganda', 'Kampala', 'cut', 'ARRIVAL', 'IMMIGRATION', 'sun'],
  ['UA', 'Ukraine', 'Kyiv', 'octl', 'ВʼЇЗД', 'ENTRY'],
  ['AE', 'United Arab Emirates', 'Abu Dhabi', 'ae'],
  ['GB', 'United Kingdom', 'London', 'gb'],
  ['US', 'United States', 'Washington', 'us'],
  ['UY', 'Uruguay', 'Montevideo', 'roundl', 'ENTRADA', 'MIGRACIÓN', 'sun'],
  ['UZ', 'Uzbekistan', 'Tashkent', 'dome', 'KIRISH', 'ENTRY', 'sun'],
  ['VE', 'Venezuela', 'Caracas', 'boxl', 'ENTRADA', 'MIGRACIÓN', 'palm'],
  ['VN', 'Vietnam', 'Hanoi', 'boxl', 'NHẬP CẢNH', 'ENTRY']
];
const BESPOKE = new Set(['gb', 'us', 'jp', 'au', 'ca', 'tr', 'ae', 'th', 'ma', 'in']);
export const COUNTRIES = Object.fromEntries(COUNTRY_ROWS.map(([code, name, capital, tpl, word, en, icon]) => [code, { code, name, capital, tpl, word, en, icon }]));
export const NATIONAL = Object.fromEntries(COUNTRY_ROWS.filter((r) => BESPOKE.has(r[3])).map((r) => [r[0], r[3]]));
export const LOCAL = Object.fromEntries(COUNTRY_ROWS.filter((r) => !BESPOKE.has(r[3])).map(([code, , , tpl, word, en, icon]) => [code, { tpl, word, en, icon }]));
export const KINDS = ['round', 'double', 'tri', 'oval', 'hex', 'oct', 'postmark', 'stars', 'diamond', 'ticket', 'shield', 'arch', 'burst', 'banner', 'dotted', 'band', 'departed', 'pill', 'calendar', 'rosette', 'visa', 'cloud'];
// Names for the general designs, for the stamp picker in the back office.
export const DESIGN_NAMES = { schengen: 'EU border', round: 'Round', double: 'Double box', tri: 'Triangle', oval: 'Oval', hex: 'Hexagon', oct: 'Octagon', postmark: 'Postmark', stars: 'Ring of stars', diamond: 'Diamond', ticket: 'Ticket', shield: 'Shield', arch: 'Arch', burst: 'Sunburst', banner: 'Ribbon', dotted: 'Dotted', band: 'Band', departed: 'Departed', pill: 'Pill', calendar: 'Calendar', rosette: 'Rosette', visa: 'Visa', cloud: 'Cloud' };
const SUBS = ['ARRIVED', 'ENTRY', 'ADMITTED', 'WELCOME', 'VISITED', 'ARRIVAL', 'ARRIVALS', 'ENTERED', 'GRANTED', 'IN TRANSIT', 'ENTRANCE', 'CLEARED'];

const ICONS = {
  plane: { d: 'M2 11.5 L9 10.5 L14 3 H16.5 L14 10.5 L20 10 L22 7.5 H24 L23 12 L24 16.5 H22 L20 14 L14 13.5 L16.5 21 H14 L9 13.5 L2 12.5 Z' },
  ship: { d: 'M2 15 H22 L18.5 21 H5.5 Z M6 14 V9.5 H16.5 L19 14 Z M9.5 9 V4.5 H13.5 V9 Z' },
  train: { d: 'M7 2.5 H17 A3 3 0 0 1 20 5.5 V16 A2 2 0 0 1 18 18 H6 A2 2 0 0 1 4 16 V5.5 A3 3 0 0 1 7 2.5 Z M6.5 5.5 H17.5 V10.5 H6.5 Z M7 13 H9.5 V15.5 H7 Z M14.5 13 H17 V15.5 H14.5 Z M7.5 18 L5 22.5 H7.5 L9.8 18 Z M16.5 18 L19 22.5 H16.5 L14.2 18 Z', rule: 'evenodd' },
  car: { d: 'M3 12.5 L5.5 6.5 H18.5 L21 12.5 H22 V17.5 H2 V12.5 Z M6.5 8.5 L5.3 12 H18.7 L17.5 8.5 Z M5 17 A2.5 2.5 0 1 0 10 17 Z M14 17 A2.5 2.5 0 1 0 19 17 Z', rule: 'evenodd' },
  mountain: { d: 'M1 21 L8.5 7 L12.5 14 L15.5 9.5 L23 21 Z M8.5 7 L10.6 11 L9.2 10.2 L7.6 11.4 Z', rule: 'evenodd' },
  palm: { d: 'M11 22 C11.5 17 11.8 13 12.6 9.5 L13.8 9.7 C13 13 12.8 17 12.6 22 Z M12.8 9 C10 5 6 5 3 7.5 C6.5 6.8 9.5 7.6 12.4 10 Z M13.2 9 C15.5 4.5 19.5 4 22 6 C18.5 6 16 7.3 13.6 10 Z M12.9 8.8 C12 5 13 2.5 15.5 1.5 C14 4 13.8 6.5 13.6 9 Z M12.5 9.6 C9 9.5 6 11.5 4.8 14.5 C7.5 12.2 10 11.2 12.7 10.6 Z' },
  sun: { d: 'M12 7 A5 5 0 1 0 12.01 7 Z M11 1 H13 V5 H11 Z M11 19 H13 V23 H11 Z M1 11 H5 V13 H1 Z M19 11 H23 V13 H19 Z M4.1 5.5 L5.5 4.1 L8.3 6.9 L6.9 8.3 Z M15.7 17.1 L17.1 15.7 L19.9 18.5 L18.5 19.9 Z M4.1 18.5 L6.9 15.7 L8.3 17.1 L5.5 19.9 Z M15.7 6.9 L18.5 4.1 L19.9 5.5 L17.1 8.3 Z' }
};
const TRANSPORT = ['plane', 'plane', 'plane', 'plane', 'ship', 'train', 'car'];
const SCENERY = ['sun', 'mountain', 'palm', 'plane'];

const OSW = "Oswald, 'Arial Narrow', sans-serif";
const ELITE = "'Special Elite', 'Courier New', monospace";

export const INK_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
${[[0.9, 3, 2.4, '0.07 0.11', 11, -2.1, 1.75], [1.1, 7, 2, '0.05 0.09', 23, -2.4, 1.9], [0.8, 41, 2.8, '0.09 0.06', 5, -1.9, 1.6], [1.3, 17, 1.6, '0.12 0.05', 31, -2.6, 2.1]]
  .map(
    ([bf, s1, sc, bf2, s2, a, b], i) => `<filter id="ink${i + 1}" x="-6%" y="-6%" width="112%" height="112%">
<feTurbulence type="fractalNoise" baseFrequency="${bf}" numOctaves="2" seed="${s1}" result="grain"/>
<feDisplacementMap in="SourceGraphic" in2="grain" scale="${sc}" xChannelSelector="R" yChannelSelector="G" result="wobble"/>
<feTurbulence type="fractalNoise" baseFrequency="${bf2}" numOctaves="3" seed="${s2}" result="blot"/>
<feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${a} 0 0 0 ${b}" result="mask"/>
<feComposite in="wobble" in2="mask" operator="in"/></filter>`
  )
  .join('\n')}
</defs></svg>`;

function fit(text, width, max, perChar = 0.6) {
  return Math.max(7, Math.min(max, width / Math.max(1, text.length * perChar)));
}

// Points of a star or a sunburst around (cx, cy).
function starPath(cx, cy, points, outer, inner, turn = -Math.PI / 2) {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = turn + (i * Math.PI) / points;
    d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)} `;
  }
  return d + 'Z';
}

// A wavy seal edge, like a rosette or a cloud.
function scallop(cx, cy, r, bumps, depth) {
  let d = '';
  for (let i = 0; i <= bumps; i++) {
    const a = (i * 2 * Math.PI) / bumps;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (!i) {
      d = `M${x.toFixed(1)} ${y.toFixed(1)} `;
      continue;
    }
    const m = a - Math.PI / bumps;
    d += `Q${(cx + (r + depth) * Math.cos(m)).toFixed(1)} ${(cy + (r + depth) * Math.sin(m)).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d + 'Z';
}

// The first city in a country always gets that country's own stamp, if it has one;
// after that, about a third of its cities do.
export function stampKind(city, code, first = false) {
  const cc = String(code || '').toUpperCase();
  const k = hash(String(city).toLowerCase() + '#kind');
  const own = NATIONAL[cc] || (LOCAL[cc] ? 'local' : null);
  if (own && (first || k % 3 === 0)) return own;
  if (SCHENGEN.has(cc)) return 'schengen';
  return KINDS[(k >>> 1) % KINDS.length];
}

// A stamp picked by hand wins: a country code ("de") or a design name ("postmark").
export function resolveStamp({ city, code, first, stamp }) {
  const cc = String(code || '').toUpperCase();
  const pick = String(stamp || '').toLowerCase();
  if (pick) {
    const up = pick.toUpperCase();
    if (COUNTRIES[up]) return { kind: NATIONAL[up] || 'local', cc: up };
    if (DESIGN_NAMES[pick]) return { kind: pick, cc };
  }
  return { kind: stampKind(city, cc, first), cc };
}

// One stamp. Returns an SVG string; every piece of text is escaped.
// "plain" leaves out the ink texture, for quick previews.
export function stampSvg({ city, country, code, date, index, first, stamp, plain, kind: forced }) {
  const h = hash(String(city).toLowerCase());
  const h2 = hash(String(city).toLowerCase() + '#look');
  const resolved = resolveStamp({ city, code, first, stamp });
  const cc = resolved.cc;
  const kind = forced || resolved.kind;
  const ink = INKS[(h >>> 3) % INKS.length];
  const filt = `ink${(h2 % 4) + 1}`;
  const uid = `s${index}-${h % 100000}`;
  const CITY = esc(String(city).toUpperCase());
  const COUNTRY = esc(String(country || '').toUpperCase());
  const sub = esc(SUBS[(h >>> 5) % SUBS.length]);
  const num = 100 + (h % 900);
  const label = esc(`Passport stamp: ${city}${country ? ', ' + country : ''}`);
  const d = (style) => esc(stampDate(date, style));
  const ghost = !plain && h2 % 6 === 1; // now and then the officer stamped twice

  const g = (inner, w, hgt) =>
    `<svg width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}" role="img" aria-label="${label}"><g${plain ? '' : ` filter="url(#${filt})"`} fill="none" stroke="${ink}">` +
    (ghost ? `<g id="${uid}-m">${inner}</g><use href="#${uid}-m" transform="translate(2.2 1.4) rotate(-1.2 ${w / 2} ${hgt / 2})" opacity=".28"/>` : inner) +
    `</g></svg>`;
  const t = (x, y, size, family, text, extra = '', anchor = 'middle') =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${family}" font-size="${size.toFixed(1)}" fill="${ink}" stroke="none" ${extra}>${text}</text>`;
  const icon = (name, x, y, s = 1, rot = 0) => {
    const ic = ICONS[name] || ICONS.plane;
    return `<g transform="translate(${x} ${y}) scale(${s})${rot ? ` rotate(${rot} 12 12)` : ''}"><path d="${ic.d}" fill="${ink}" stroke="none"${ic.rule ? ` fill-rule="${ic.rule}"` : ''}/></g>`;
  };
  const transport = TRANSPORT[(h2 >>> 4) % TRANSPORT.length];
  const scenery = SCENERY[(h2 >>> 7) % SCENERY.length];
  // Text along the top (reads outward) or bottom (reads inward) of a circle.
  const arc = (id, cx, cy, r, text, size, top, extra = '') =>
    `<path id="${uid}-${id}" d="M${cx - r} ${cy} A${r} ${r} 0 0 ${top ? 1 : 0} ${cx + r} ${cy}" stroke="none"/>` +
    `<text font-family="${OSW}" font-size="${size}" fill="${ink}" stroke="none" text-anchor="middle" ${extra}><textPath href="#${uid}-${id}" startOffset="50%">${text}</textPath></text>`;

  if (kind === 'local') {
    const L = LOCAL[cc] || { tpl: 'boxl', word: 'ENTRY', en: 'ARRIVAL' };
    const WORD = esc(L.word);
    const EN = esc(L.en);
    const ic = L.icon || transport;
    // Letter-spacing would break up joined scripts like Arabic, so only Latin words get it.
    const sp = (n) => (/[^\u0000-\u024F\u1E00-\u1EFF]/.test(L.word) ? '' : `letter-spacing="${n}"`);
    const nat = `${CITY} · ${num}`;
    switch (L.tpl) {
      case 'dome':
        return g(
          `<path d="M5 117 V60 C5 34 40 24 75 4 C110 24 145 34 145 60 V117 Z" stroke-width="3" stroke-linejoin="round"/>
<path d="M13 109 V61 C13 40 44 31 75 14 C106 31 137 40 137 61 V109 Z" stroke-width="1" stroke-linejoin="round"/>
${icon(ic, 65, 24, 0.85)}
${t(75, 64, fit(L.word, 96, 17), OSW, WORD, 'font-weight="700"')}
${t(75, 77, 8, OSW, EN, 'letter-spacing="2.5"')}
${t(75, 94, 12, ELITE, d())}
${t(75, 105, fit(nat, 112, 8.5), OSW, nat, 'letter-spacing="1"')}`,
          150,
          120
        );
      case 'roundl':
        return g(
          `<circle cx="64" cy="64" r="60" stroke-width="3"/><circle cx="64" cy="64" r="44" stroke-width="1.4"/>
${arc('t', 64, 64, 48, WORD, fit(L.word, 110, 14), true, `${sp(2)} font-weight="600"`)}
${arc('b', 64, 64, 55, EN, 8.5, false, 'letter-spacing="2.5"')}
${icon(ic, 54, 30, 0.85)}
${t(64, 70, fit(CITY, 72, 13), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
${t(64, 87, 10.5, ELITE, d('dots'))}`,
          128,
          128
        );
      case 'ovall':
        return g(
          `<ellipse cx="85" cy="53" rx="81" ry="49" stroke-width="3"/><ellipse cx="85" cy="53" rx="76" ry="44" stroke-width="1"/>
${icon(ic, 18, 41, 0.8)}${icon(ic, 133, 41, 0.8)}
${t(85, 33, fit(L.word, 96, 15), OSW, WORD, `font-weight="700" ${sp(2)}`)}
${t(85, 57, 13, ELITE, d())}
${t(85, 76, fit(CITY, 104, 13), OSW, CITY, 'letter-spacing="1.5"')}
${t(85, 90, 7.5, OSW, `${EN} · ${num}`, 'letter-spacing="1.5"')}`,
          170,
          106
        );
      case 'octl':
        return g(
          `<path d="M37 3 H87 L121 37 V87 L87 121 H37 L3 87 V37 Z" stroke-width="3" stroke-linejoin="round"/>
<path d="M40 10 H84 L114 40 V84 L84 114 H40 L10 84 V40 Z" stroke-width="1" stroke-linejoin="round"/>
${t(62, 38, fit(L.word, 84, 14), OSW, WORD, `font-weight="700" ${sp(1.5)}`)}
<path d="M18 46 H106" stroke-width="1.2"/>
${t(62, 65, 11.5, ELITE, d())}
${t(62, 83, fit(CITY, 86, 12), OSW, CITY, 'letter-spacing="1"')}
${t(62, 99, 7.5, OSW, EN, 'letter-spacing="2"')}`,
          124,
          124
        );
      case 'cut':
        return g(
          `<path d="M14 3 H152 L163 14 V90 L152 101 H14 L3 90 V14 Z" stroke-width="3" stroke-linejoin="round"/>
${icon(ic, 11, 9, 0.85)}
${t(96, 25, fit(`${L.word} · ${L.en}`, 120, 11), OSW, `${WORD} · ${EN}`, sp(1))}
<path d="M42 33 H152" stroke-width="1.2"/>
${t(83, 58, 15, ELITE, d())}
${t(83, 74, 8, OSW, `No. ${num}`, 'letter-spacing="1.5"')}
${t(83, 92, fit(CITY, 140, 13), OSW, CITY, 'font-weight="600" letter-spacing="1.5"')}`,
          166,
          104
        );
      default:
        return g(
          `<rect x="3" y="3" width="158" height="100" rx="3" stroke-width="3"/>
${t(82, 28, fit(L.word, 136, 17), OSW, WORD, `font-weight="700" ${sp(2.5)}`)}
${t(82, 41, 8.5, OSW, EN, 'letter-spacing="2.5"')}
<path d="M12 48 H152" stroke-width="1.3"/>
${icon(ic, 16, 54, 0.8)}
${t(88, 70, 14, ELITE, d())}
${t(82, 93, fit(nat, 140, 12), OSW, nat, 'letter-spacing="1.5"')}`,
          164,
          106
        );
    }
  }

  switch (kind) {
    case 'schengen': {
      // Entry stamps have round corners and an arrow in; exit stamps are square with an arrow out.
      const sign = esc(SIGN[cc] || cc);
      const exit = h2 % 3 === 0;
      return g(
        `<rect x="3" y="3" width="144" height="98" rx="${exit ? 1 : 10}" stroke-width="3"/>
<circle cx="30" cy="30" r="17" stroke-width="2.6" stroke-dasharray="0.1 8.8" stroke-linecap="round"/>
${t(30, 36, sign.length > 2 ? 12 : 16, OSW, sign, 'font-weight="700"')}
${exit ? '<path d="M86 30 H58 M64 24 L58 30 L64 36" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' : '<path d="M58 30 H86 M80 24 L86 30 L80 36" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'}
${icon(transport, 106, 18)}
${t(75, 64, 17, ELITE, d('dots'))}
<path d="M12 72 H138" stroke-width="1.3"/>
${t(75, 92, fit(CITY, 126, 15), OSW, CITY, 'letter-spacing="1.5"')}`,
        150,
        104
      );
    }
    case 'gb':
      return g(
        `<rect x="3" y="3" width="164" height="100" rx="3" stroke-width="3"/>
${t(85, 22, 10.5, OSW, 'LEAVE TO ENTER FOR SIX MONTHS', 'letter-spacing=".6"')}
${t(85, 36, 8, OSW, 'EMPLOYMENT AND RECOURSE TO', 'letter-spacing=".4"')}
${t(85, 46, 8, OSW, 'PUBLIC FUNDS PROHIBITED', 'letter-spacing=".4"')}
<rect x="38" y="53" width="94" height="23" stroke-width="1.5"/>
${t(85, 70, 13, ELITE, d())}
${t(85, 93, fit(`${CITY} (${num})`, 150, 12), OSW, `${CITY} (${num})`, 'letter-spacing="1"')}`,
        170,
        106
      );
    case 'us':
      return g(
        `<rect x="3" y="3" width="146" height="106" rx="3" stroke-width="3"/>
${t(76, 27, 17, OSW, 'ADMITTED', 'font-weight="700" letter-spacing="4"')}
${t(76, 49, 13, ELITE, d('us'))}
<path d="M12 57 H140" stroke-width="1.3"/>
${t(14, 75, 9, OSW, 'CLASS', '', 'start')}<path d="M44 76 H72" stroke-width="1"/>${t(58, 73, 11, ELITE, 'B2')}
${t(80, 75, 9, OSW, 'UNTIL', '', 'start')}<path d="M110 76 H138" stroke-width="1"/>
${t(76, 98, fit(`${CITY} ${num}`, 128, 12), OSW, `${CITY} ${num}`, 'letter-spacing="1.5"')}`,
        152,
        112
      );
    case 'jp':
      return g(
        `<rect x="3" y="3" width="160" height="108" rx="2" stroke-width="2.6"/>
${t(83, 19, 10.5, OSW, 'LANDING PERMISSION', 'letter-spacing="2"')}
<path d="M3 25 H163" stroke-width="1.4"/>
<circle cx="32" cy="58" r="20" stroke-width="1.6"/><circle cx="32" cy="58" r="16" stroke-width="0.8"/>
${icon(transport, 22, 48, 0.85)}
${t(60, 44, 9.5, OSW, 'Status: Temporary Visitor', '', 'start')}
${t(60, 58, 9.5, OSW, 'Duration: 90 days', '', 'start')}
${t(60, 73, 10, ELITE, d(), '', 'start')}
<path d="M10 84 H156" stroke-width="1"/>
${t(83, 101, fit(CITY, 140, 12), OSW, CITY, 'letter-spacing="2"')}`,
        166,
        114
      );
    case 'au':
      return g(
        `<path d="M14 3 H150 L161 14 V90 L150 101 H14 L3 90 V14 Z" stroke-width="3" stroke-linejoin="round"/>
${icon('sun', 10, 10, 0.8)}
${t(94, 26, 10, OSW, 'IMMIGRATION · ARRIVED', 'letter-spacing=".6"')}
<path d="M44 34 H150" stroke-width="1.2"/>
${t(82, 58, 15, ELITE, d())}
${t(82, 74, 8.5, OSW, `CLEARANCE NO. ${num}`, 'letter-spacing="1.5"')}
${t(82, 92, fit(CITY, 140, 13), OSW, CITY, 'font-weight="600" letter-spacing="1.5"')}`,
        164,
        104
      );
    case 'ca':
      return g(
        `<circle cx="64" cy="64" r="60" stroke-width="3"/><circle cx="64" cy="64" r="44" stroke-width="1.4"/>
${arc('t', 64, 64, 48, `${CITY} · ${num}`, fit(CITY, 120, 11), true, 'letter-spacing="1.5"')}
${arc('b', 64, 64, 55, 'BORDER SERVICES', 8.5, false, 'letter-spacing="2"')}
${icon('mountain', 52, 34, 1)}
${t(64, 74, 12, ELITE, d())}
${t(64, 89, 8, OSW, 'ADMITTED', 'letter-spacing="2"')}`,
        128,
        128
      );
    case 'tr':
      return g(
        `<ellipse cx="85" cy="54" rx="81" ry="50" stroke-width="3"/>
<rect x="30" y="20" width="110" height="68" rx="4" stroke-width="1.4"/>
${t(85, 36, 10, OSW, `GİRİŞ · ENTRY · ${num}`, 'letter-spacing="1.2"')}
${t(85, 59, 14, ELITE, d('dots'))}
${t(85, 79, fit(CITY, 100, 13), OSW, CITY, 'font-weight="600" letter-spacing="1.5"')}`,
        170,
        108
      );
    case 'ae':
      return g(
        `<path d="M8 3 H152 V83 C152 94 140 101 128 101 H32 C20 101 8 94 8 83 Z" stroke-width="3" stroke-linejoin="round"/>
${icon('palm', 18, 12, 1)}
${t(92, 26, 11, OSW, 'ARRIVAL · وصول', 'letter-spacing="1.5"')}
<path d="M48 34 H146" stroke-width="1.2"/>
${t(80, 58, 15, ELITE, d())}
${t(80, 74, 8.5, OSW, `GATE ${(h % 9) + 1} · OFFICER ${num}`, 'letter-spacing="1.2"')}
${t(80, 92, fit(CITY, 130, 13), OSW, CITY, 'font-weight="600" letter-spacing="1.5"')}`,
        160,
        104
      );
    case 'th':
      return g(
        `<rect x="3" y="3" width="160" height="104" rx="6" stroke-width="3"/>
${t(83, 21, 10, OSW, 'IMMIGRATION · ADMITTED', 'letter-spacing="1.4"')}
<rect x="12" y="28" width="142" height="44" stroke-width="1.3"/>
${t(83, 47, 14, ELITE, d())}
${t(83, 64, 8, OSW, 'UNTIL ___________   CLASS TR', 'letter-spacing=".8"')}
${t(83, 96, fit(`${CITY} · ${num}`, 140, 12), OSW, `${CITY} · ${num}`, 'letter-spacing="1.5"')}`,
        166,
        110
      );
    case 'ma':
      return g(
        `<path d="${starPath(66, 66, 8, 62, 50)}" stroke-width="2.8" stroke-linejoin="round"/>
<circle cx="66" cy="66" r="40" stroke-width="1.2"/>
${t(66, 50, 7.5, OSW, 'ENTRÉE · ENTRY', 'letter-spacing="1.2"')}
${t(66, 69, fit(CITY, 70, 13), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
${t(66, 86, 10.5, ELITE, d('dots'))}`,
        132,
        132
      );
    case 'in':
      return g(
        `<rect x="3" y="3" width="150" height="104" rx="52" stroke-width="3"/>
<rect x="11" y="11" width="134" height="88" rx="44" stroke-width="1"/>
${t(78, 34, 10, OSW, 'IMMIGRATION', 'letter-spacing="3"')}
${t(78, 58, 14, ELITE, d())}
${t(78, 76, fit(CITY, 100, 13), OSW, CITY, 'font-weight="600" letter-spacing="1.2"')}
${t(78, 91, 8, OSW, `ARRIVAL · ${num}`, 'letter-spacing="1.5"')}`,
        156,
        110
      );
    case 'round': {
      let ring = `· ${String(city).toUpperCase()} · ARRIVAL · ${String(country || 'WELCOME').toUpperCase()} `;
      if (ring.length > 40) ring = ring.slice(0, 40);
      return g(
        `<circle cx="62" cy="62" r="58" stroke-width="3"/><circle cx="62" cy="62" r="41" stroke-width="1.4"/>
<path id="${uid}-ring" d="M15 62 A47 47 0 1 1 109 62 A47 47 0 1 1 15 62" stroke="none"/>
<text font-family="${OSW}" font-size="10.5" letter-spacing="2.2" fill="${ink}" stroke="none"><textPath href="#${uid}-ring">${esc(ring)}</textPath></text>
${t(62, 56, fit(CITY, 70, 15), OSW, CITY, 'font-weight="600"')}
${t(62, 74, 12, ELITE, d())}
${t(62, 89, 8.5, OSW, sub, 'letter-spacing="2"')}`,
        124,
        124
      );
    }
    case 'double':
      return g(
        `<rect x="3" y="3" width="150" height="90" rx="3" stroke-width="2.8"/><rect x="9" y="9" width="138" height="78" rx="2" stroke-width="1"/>
${t(78, 28, 12, OSW, sub, 'letter-spacing="3"')}
<rect x="36" y="35" width="84" height="23" stroke-width="1.5"/>
${t(78, 52, 14, ELITE, d())}
${t(78, 78, fit(CITY, 128, 15), OSW, CITY, 'letter-spacing="2"')}`,
        156,
        96
      );
    case 'tri':
      return g(
        `<path d="M70 5 L135 118 L5 118 Z" stroke-width="3" stroke-linejoin="round"/><path d="M70 21 L121 110 L19 110 Z" stroke-width="1" stroke-linejoin="round"/>
${t(70, 74, fit(CITY, 54, 13), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
${t(70, 91, 11, ELITE, d('dots'))}
${t(70, 105, 8, OSW, sub, 'letter-spacing="1.5"')}`,
        140,
        124
      );
    case 'oval':
      return g(
        `<ellipse cx="80" cy="50" rx="76" ry="46" stroke-width="3"/><ellipse cx="80" cy="50" rx="68" ry="38" stroke-width="1" stroke-dasharray="3 2"/>
${t(80, 37, 12, OSW, sub, 'letter-spacing="3.5"')}
${t(80, 58, 15, ELITE, d('us'))}
${t(80, 77, fit(CITY, 104, 13), OSW, CITY, 'font-weight="600" letter-spacing="1.5"')}`,
        160,
        100
      );
    case 'hex':
      return g(
        `<path d="M35 4 H97 L128 58 L97 112 H35 L4 58 Z" stroke-width="3" stroke-linejoin="round"/>
${t(66, 44, fit(CITY, 92, 14), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
<path d="M24 53 H108" stroke-width="1.2"/>
${t(66, 73, 13, ELITE, d())}
${t(66, 92, 8.5, OSW, sub, 'letter-spacing="1.5"')}`,
        132,
        116
      );
    case 'postmark':
      return g(
        `<circle cx="52" cy="52" r="48" stroke-width="3"/><circle cx="52" cy="52" r="33" stroke-width="1.2"/>
${arc('t', 52, 52, 37, CITY, fit(CITY, 96, 10.5), true, 'letter-spacing="1.2"')}
${arc('b', 52, 52, 44, COUNTRY || sub, fit(COUNTRY || sub, 90, 8.5), false, 'letter-spacing="1.5"')}
${t(52, 48, 10, ELITE, d('dots'))}
${t(52, 63, 8, OSW, `No ${num}`, 'letter-spacing="1"')}
${[22, 37, 52, 67, 82].map((y) => `<path d="M104 ${y} q11 -7 22 0 t22 0 t22 0 t22 0" stroke-width="2.4" stroke-linecap="round"/>`).join('')}`,
        196,
        104
      );
    case 'stars':
      return g(
        `<circle cx="62" cy="62" r="58" stroke-width="3"/><circle cx="62" cy="62" r="43" stroke-width="1.4"/>
${Array.from({ length: 14 }, (_, i) => {
  const a = (i * 2 * Math.PI) / 14 - Math.PI / 2;
  return `<path d="${starPath(62 + 50.5 * Math.cos(a), 62 + 50.5 * Math.sin(a), 5, 4, 1.7)}" fill="${ink}" stroke="none"/>`;
}).join('')}
${t(62, 47, 8.5, OSW, sub, 'letter-spacing="2"')}
${t(62, 66, fit(CITY, 72, 14), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
${t(62, 84, 11, ELITE, d())}`,
        124,
        124
      );
    case 'diamond':
      return g(
        `<path d="M66 3 L129 66 L66 129 L3 66 Z" stroke-width="3" stroke-linejoin="round"/><path d="M66 14 L118 66 L66 118 L14 66 Z" stroke-width="1" stroke-linejoin="round"/>
${icon(transport, 54, 30, 1)}
${t(66, 72, fit(CITY, 72, 13), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
${t(66, 90, 10.5, ELITE, d('dots'))}`,
        132,
        132
      );
    case 'ticket':
      return g(
        `<path d="M13 3 H159 A10 10 0 0 0 169 13 V81 A10 10 0 0 0 159 91 H13 A10 10 0 0 0 3 81 V13 A10 10 0 0 0 13 3 Z" stroke-width="3" stroke-linejoin="round"/>
<path d="M50 12 V82" stroke-width="1.4" stroke-dasharray="4 3"/>
${icon(transport, 14, 22, 1)}
${t(26, 66, 8, OSW, 'No.')}
${t(26, 79, 11, ELITE, String(num))}
${t(110, 28, 9, OSW, sub, 'letter-spacing="2.5"')}
${t(110, 53, fit(CITY, 104, 15), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
${t(110, 75, 12, ELITE, d())}`,
        172,
        94
      );
    case 'shield':
      return g(
        `<path d="M6 6 H106 V60 C106 94 80 114 56 126 C32 114 6 94 6 60 Z" stroke-width="3" stroke-linejoin="round"/>
<path d="M15 15 H97 V60 C97 88 76 105 56 116 C36 105 15 88 15 60 Z" stroke-width="1" stroke-linejoin="round"/>
${icon(scenery, 44, 22, 1)}
${t(56, 66, fit(CITY, 76, 13), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
${t(56, 83, 10.5, ELITE, d('dots'))}
${t(56, 98, 7.5, OSW, sub, 'letter-spacing="1.5"')}`,
        112,
        130
      );
    case 'arch':
      return g(
        `<path d="M5 127 V60 A55 55 0 0 1 115 60 V127 Z" stroke-width="3" stroke-linejoin="round"/>
<path d="M13 119 V60 A47 47 0 0 1 107 60 V119 Z" stroke-width="1" stroke-linejoin="round"/>
${icon(scenery, 47, 30, 1.1)}
${t(60, 78, fit(CITY, 84, 14), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
${t(60, 96, 11, ELITE, d())}
${t(60, 110, 7.5, OSW, sub, 'letter-spacing="1.8"')}`,
        120,
        130
      );
    case 'burst':
      return g(
        `<path d="${starPath(65, 65, 20, 62, 54)}" stroke-width="2.4" stroke-linejoin="round"/>
<circle cx="65" cy="65" r="44" stroke-width="1.2"/>
${t(65, 48, 8, OSW, sub, 'letter-spacing="2"')}
${t(65, 67, fit(CITY, 72, 13), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
${t(65, 84, 10.5, ELITE, d('dots'))}`,
        130,
        130
      );
    case 'banner':
      return g(
        `<circle cx="75" cy="60" r="55" stroke-width="3"/><circle cx="75" cy="60" r="48" stroke-width="1"/>
<path d="M2 47 H148 L138 60 L148 73 H2 L12 60 Z" stroke-width="2.4" stroke-linejoin="round"/>
${icon(transport, 63, 16, 1)}
${t(75, 66, fit(CITY, 100, 14), OSW, CITY, 'font-weight="600" letter-spacing="1.5"')}
${t(75, 93, 11, ELITE, d('dots'))}`,
        150,
        120
      );
    case 'dotted':
      return g(
        `<rect x="4" y="4" width="146" height="96" stroke-width="3.4" stroke-dasharray="0.1 6" stroke-linecap="round"/>
<rect x="13" y="13" width="128" height="78" rx="2" stroke-width="1.6"/>
${t(77, 31, 10, OSW, sub, 'letter-spacing="3"')}
${t(77, 56, 16, ELITE, d())}
<path d="M24 65 H130" stroke-width="1.1"/>
${t(77, 82, fit(CITY, 110, 13), OSW, CITY, 'letter-spacing="1.5"')}`,
        154,
        104
      );
    case 'band':
      return g(
        `<circle cx="62" cy="62" r="58" stroke-width="3"/>
<path d="M6 49 H118 M6 75 H118" stroke-width="1.6"/>
${arc('t', 62, 62, 44, CITY, fit(CITY, 110, 11), true, 'letter-spacing="1.5"')}
${arc('b', 62, 62, 50, sub, 8, false, 'letter-spacing="2.5"')}
${t(62, 67, 13, ELITE, d())}`,
        124,
        124
      );
    case 'departed':
      return g(
        `<rect x="3" y="3" width="154" height="92" rx="6" stroke-width="3"/>
<path d="M34 22 H14 M20 16 L14 22 L20 28" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
${t(80, 28, 14, OSW, 'DEPARTED', 'font-weight="700" letter-spacing="3"')}
${icon('plane', 122, 8, 1, -24)}
<path d="M12 37 H148" stroke-width="1.3"/>
${t(80, 60, 15, ELITE, d())}
${t(80, 83, fit(CITY, 136, 13), OSW, CITY, 'letter-spacing="1.5"')}`,
        160,
        98
      );
    case 'pill':
      return g(
        `<rect x="3" y="3" width="184" height="60" rx="30" stroke-width="3"/><rect x="10" y="10" width="170" height="46" rx="23" stroke-width="1"/>
<path d="M120 14 V52" stroke-width="1.2"/>
${t(66, 39, fit(CITY, 94, 14), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
${t(150, 29, 7.5, OSW, sub, 'letter-spacing="1.5"')}
${t(150, 46, 10.5, ELITE, d('dots'))}`,
        190,
        66
      );
    case 'calendar': {
      const [dd = '', mon = '', yyyy = ''] = stampDate(date).split(' ');
      return g(
        `<rect x="3" y="3" width="112" height="112" stroke-width="3"/>
<path d="M3 30 H115 M3 88 H115 M62 30 V88" stroke-width="1.4"/>
${icon(transport, 8, 5, 0.85)}
${t(66, 21, 9, OSW, sub, 'letter-spacing="2"')}
${t(33, 72, 34, OSW, esc(dd), 'font-weight="700"')}
${t(88, 54, 13, OSW, esc(mon), 'letter-spacing="2"')}
${t(88, 74, 12, ELITE, esc(yyyy))}
${t(59, 106, fit(CITY, 100, 12), OSW, CITY, 'letter-spacing="1.5"')}`,
        118,
        118
      );
    }
    case 'rosette':
      return g(
        `<path d="${scallop(64, 64, 55, 22, 7)}" stroke-width="2.6" stroke-linejoin="round"/>
<circle cx="64" cy="64" r="45" stroke-width="1.2"/><circle cx="64" cy="64" r="41" stroke-width="2" stroke-dasharray="0.1 4.6" stroke-linecap="round"/>
${t(64, 50, 8, OSW, sub, 'letter-spacing="2"')}
${t(64, 68, fit(CITY, 66, 13), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
${t(64, 85, 10.5, ELITE, d('dots'))}`,
        128,
        128
      );
    case 'visa':
      return g(
        `<rect x="3" y="3" width="164" height="96" rx="2" stroke-width="2.6"/>
<path d="M3 24 H167" stroke-width="1.3"/>
${t(12, 18, 10, OSW, 'VISA ON ARRIVAL', 'letter-spacing="1.8"', 'start')}
${t(158, 18, 9, ELITE, `No. ${num}`, '', 'end')}
${t(12, 42, 8, OSW, 'PLACE OF ISSUE', 'letter-spacing="1"', 'start')}
${t(12, 56, fit(CITY, 90, 12), OSW, CITY, 'font-weight="600" letter-spacing="1"', 'start')}
${t(12, 74, 8, OSW, 'DATE', 'letter-spacing="1"', 'start')}
${t(12, 88, 11, ELITE, d(), '', 'start')}
<rect x="114" y="34" width="44" height="56" rx="2" stroke-width="1.2"/>
${icon(scenery, 124, 50, 1)}`,
        170,
        102
      );
    case 'cloud':
      return g(
        `<path d="M30 92 C10 92 4 74 16 64 C6 50 20 32 38 38 C42 18 66 10 80 24 C92 10 120 14 122 36 C142 36 150 58 138 70 C148 84 134 98 116 92 Z" stroke-width="3" stroke-linejoin="round"/>
${icon('plane', 66, 30, 1, -12)}
${t(76, 66, fit(CITY, 96, 13), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
${t(76, 83, 10.5, ELITE, d('dots'))}`,
        154,
        100
      );
    default:
      return g(
        `<path d="M36 4 H84 L116 36 V84 L84 116 H36 L4 84 V36 Z" stroke-width="3" stroke-linejoin="round"/><path d="M39 11 H81 L109 39 V81 L81 109 H39 L11 81 V39 Z" stroke-width="1" stroke-linejoin="round"/>
${t(60, 54, fit(CITY, 84, 13), OSW, CITY, 'font-weight="600" letter-spacing="1"')}
${t(60, 73, 12, ELITE, d('dots'))}
${t(60, 90, 8.5, OSW, sub, 'letter-spacing="1.2"')}`,
        120,
        120
      );
  }
}

// One stamp per city, dated by the first review there.
export function passportCities(places) {
  const byCity = new Map();
  const seen = new Set();
  for (const p of [...places].sort((a, b) => a.ts - b.ts)) {
    const city = (p.city || '').trim();
    if (!city) continue;
    const k = city.toLowerCase();
    if (byCity.has(k)) {
      // A stamp picked on a later review of the same city still counts.
      const c = byCity.get(k);
      if (!c.stamp && p.stamp) c.stamp = p.stamp;
      continue;
    }
    const code = String(p.country_code || p.country || '').toUpperCase();
    byCity.set(k, { city, country: p.country, code: p.country_code, date: p.date, slug: p.slug, stamp: p.stamp || '', first: !!code && !seen.has(code) });
    seen.add(code);
  }
  return [...byCity.values()];
}

// Every stamp in the passport: cities you reviewed, plus the countries you've been to
// (from Travel stats). A country with no city named gets its capital. Oldest first;
// countries with no date go before everything else.
export function passportStamps(places, visited = []) {
  const reviewed = passportCities(places).map((c) => ({ ...c, first: false }));
  const have = new Set(reviewed.map((c) => c.city.toLowerCase()));
  const extra = [];
  for (const v of visited) {
    const info = COUNTRIES[v.code];
    const city = v.city || info?.capital || v.code;
    if (have.has(city.toLowerCase())) continue;
    have.add(city.toLowerCase());
    extra.push({ city, country: info?.name || v.code, code: v.code, date: v.date, slug: '', stamp: '', visited: true });
  }
  const order = (c) => (c.date ? Date.parse(String(c.date).replace(' ', 'T')) || 0 : -1);
  const all = [...extra, ...reviewed].sort((a, b) => order(a) - order(b));
  const seen = new Set();
  for (const c of all) {
    const code = String(c.code || c.country || '').toUpperCase();
    c.first = !!code && !seen.has(code);
    seen.add(code);
  }
  return all;
}

export function stampLook(city) {
  const h = hash(String(city).toLowerCase());
  return { rot: ((h % 21) - 10) * 1, dx: ((h >>> 4) % 17) - 8, dy: ((h >>> 9) % 13) - 6, op: 0.78 + ((h >>> 2) % 3) * 0.07 };
}
