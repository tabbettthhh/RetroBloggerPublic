// Messenger-style emoticons, drawn for this site. Type the code in your status (":)" or
// "(storm)") and it shows as a little picture. Codes inside words are left alone.
import { h } from './util.js';

const FACE_BG =
  '<defs><radialGradient id="emf" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#fff6a8"/><stop offset=".6" stop-color="#ffd23c"/><stop offset="1" stop-color="#f0a314"/></radialGradient></defs>' +
  '<circle cx="12" cy="12" r="10.6" fill="url(#emf)" stroke="#b06a00" stroke-width="1"/><ellipse cx="9" cy="6.4" rx="4" ry="2" fill="#fff" opacity=".55"/>';
const EYES = '<ellipse cx="8.6" cy="10" rx="1.3" ry="1.9" fill="#3a2200"/><ellipse cx="15.4" cy="10" rx="1.3" ry="1.9" fill="#3a2200"/>';
const face = (inner, eyes = EYES) => FACE_BG + eyes + inner;
const ink = 'fill="none" stroke="#3a2200" stroke-width="1.4" stroke-linecap="round"';

const PICS = {
  smile: face(`<path d="M7.6 14.2q4.4 4 8.8 0" ${ink}/>`),
  grin: face('<path d="M6.8 13.2h10.4q-.6 5.2-5.2 5.2t-5.2-5.2z" fill="#7a1d00"/><path d="M7.6 13.4h8.8v1.6H7.6z" fill="#fff"/>'),
  wink: face(`<path d="M7.6 14.2q4.4 4 8.8 0" ${ink}/>`, `<path d="M7 10.2q1.6-1.4 3.2 0" ${ink}/><ellipse cx="15.4" cy="10" rx="1.3" ry="1.9" fill="#3a2200"/>`),
  sad: face(`<path d="M8 17q4-3.6 8 0" ${ink}/>`),
  tongue: face(`<path d="M7.6 14.2q4.4 3.2 8.8 0" ${ink}/><path d="M10.6 15.4h3.6v2.2a1.8 1.8 0 0 1-3.6 0z" fill="#e8475f" stroke="#7a1d00" stroke-width=".7"/>`),
  wow: face('<ellipse cx="12" cy="15.6" rx="2.4" ry="3" fill="#7a1d00"/>', '<circle cx="8.6" cy="9.4" r="2" fill="#fff" stroke="#3a2200" stroke-width=".9"/><circle cx="15.4" cy="9.4" r="2" fill="#fff" stroke="#3a2200" stroke-width=".9"/><circle cx="8.6" cy="9.6" r=".9" fill="#3a2200"/><circle cx="15.4" cy="9.6" r=".9" fill="#3a2200"/>'),
  angry:
    '<defs><radialGradient id="ema" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#ffb08a"/><stop offset=".6" stop-color="#f05a2a"/><stop offset="1" stop-color="#b8260e"/></radialGradient></defs><circle cx="12" cy="12" r="10.6" fill="url(#ema)" stroke="#7a1600" stroke-width="1"/>' +
    `<path d="M6.4 7.6l4 1.8M17.6 7.6l-4 1.8" ${ink}/>` + EYES + `<path d="M8 17q4-2.6 8 0" ${ink}/>`,
  blush: face(`<path d="M8.6 14.6q3.4 2.4 6.8 0" ${ink}/><ellipse cx="6.6" cy="13.4" rx="2" ry="1.2" fill="#ff7a8a" opacity=".75"/><ellipse cx="17.4" cy="13.4" rx="2" ry="1.2" fill="#ff7a8a" opacity=".75"/>`),
  cool: face(`<path d="M7.6 15q4.4 3 8.8 0" ${ink}/>`, '<path d="M4.4 8.6h15.2v1.6l-1.4 2.6h-3.4l-1.6-2.6h-2.4l-1.6 2.6H5.8l-1.4-2.6z" fill="#1d1d1d"/><path d="M6 9.6l1 1.2M15.8 9.6l1 1.2" stroke="#fff" stroke-width=".7" opacity=".7"/>'),
  meh: face(`<path d="M8 15.6h8" ${ink}/>`),
  confused: face(`<path d="M7.6 16.2q2.2-2 4.4 0t4.4 0" ${ink}/>`),
  cry: face(`<path d="M8 17q4-3.6 8 0" ${ink}/><path d="M8.2 12.4q-1.2 2.2 0 3 1.2-.8 0-3z" fill="#4aa8ff"/>`),
  dizzy: face(
    `<path d="M8 16.4q2-1.6 4 0t4 0" ${ink}/>`,
    `<path d="M8.6 10a1.6 1.6 0 1 1 1.4-1.6 2.8 2.8 0 1 1-3 2.8" fill="none" stroke="#3a2200" stroke-width="1.1" stroke-linecap="round"/><path d="M15.4 10a1.6 1.6 0 1 1 1.4-1.6 2.8 2.8 0 1 1-3 2.8" fill="none" stroke="#3a2200" stroke-width="1.1" stroke-linecap="round"/>`
  ),
  sleepy: face(`<ellipse cx="12" cy="16" rx="1.6" ry="1.2" fill="#7a1d00"/><text x="17" y="6.4" font-size="6" font-weight="bold" font-family="Arial, sans-serif" fill="#3a6fd8">z</text><text x="20" y="3.6" font-size="4.4" font-weight="bold" font-family="Arial, sans-serif" fill="#3a6fd8">z</text>`, `<path d="M7 10.4q1.6 1.2 3.2 0M13.8 10.4q1.6 1.2 3.2 0" ${ink}/>`),
  love: face(`<path d="M7.6 14.2q4.4 4 8.8 0" ${ink}/>`, '<path d="M8.6 12.2l-2.4-2.3a1.4 1.4 0 0 1 2.4-1.5 1.4 1.4 0 0 1 2.4 1.5z" fill="#e8243c"/><path d="M15.4 12.2L13 9.9a1.4 1.4 0 0 1 2.4-1.5 1.4 1.4 0 0 1 2.4 1.5z" fill="#e8243c"/>'),
  heart: '<path d="M12 21l-8-7.6A5 5 0 0 1 12 6a5 5 0 0 1 8 7.4z" fill="#e8243c" stroke="#8a0a1a" stroke-width="1"/><ellipse cx="8" cy="9.6" rx="2" ry="1.2" fill="#fff" opacity=".55" transform="rotate(-35 8 9.6)"/>',
  star: '<path d="M12 2.4l2.9 6.2 6.7.8-5 4.6 1.4 6.6L12 17.2l-6 3.4 1.4-6.6-5-4.6 6.7-.8z" fill="#ffd23c" stroke="#b06a00" stroke-width="1" stroke-linejoin="round"/>',
  sun: '<g stroke="#f08a00" stroke-width="1.8" stroke-linecap="round"><path d="M12 1.6v3M12 19.4v3M1.6 12h3M19.4 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g><circle cx="12" cy="12" r="5.6" fill="#ffd23c" stroke="#f08a00" stroke-width="1"/>',
  rain: '<path d="M6.6 14.6a4 4 0 0 1 .4-8 5.4 5.4 0 0 1 10.2 1.4 3.4 3.4 0 0 1-.2 6.6z" fill="#e8eef6" stroke="#6a7a90" stroke-width="1"/><g stroke="#3a86e8" stroke-width="1.6" stroke-linecap="round"><path d="M8 17.4l-1 2.6M12 17.4l-1 2.6M16 17.4l-1 2.6"/></g>',
  storm: '<path d="M6.6 13.6a4 4 0 0 1 .4-8 5.4 5.4 0 0 1 10.2 1.4 3.4 3.4 0 0 1-.2 6.6z" fill="#8a94a6" stroke="#4a5262" stroke-width="1"/><path d="M12.6 12.4l-3.4 5h2.6l-1.6 5 5-6.6h-2.8l1.8-3.4z" fill="#ffd23c" stroke="#b06a00" stroke-width=".7" stroke-linejoin="round"/>',
  coffee: '<path d="M5 9h11v6.4A4.4 4.4 0 0 1 11.6 20H9.4A4.4 4.4 0 0 1 5 15.6z" fill="#fff" stroke="#6a4a2a" stroke-width="1.1"/><path d="M6 10h9v1.6H6z" fill="#7a4a1e"/><path d="M16 11h1.4a2.4 2.4 0 0 1 0 4.8H16" fill="none" stroke="#6a4a2a" stroke-width="1.2"/><path d="M8.6 3.4q-1 1.4 0 2.8M11.6 3q-1 1.4 0 2.8" fill="none" stroke="#a8a8a8" stroke-width="1" stroke-linecap="round"/>',
  music: '<path d="M9 17.2V5.4l10-2v11.8" fill="none" stroke="#2a3a8a" stroke-width="1.6" stroke-linejoin="round"/><ellipse cx="6.8" cy="17.4" rx="2.6" ry="2" fill="#3a5ad8"/><ellipse cx="16.8" cy="15.4" rx="2.6" ry="2" fill="#3a5ad8"/>',
  plane: '<path d="M21 4.6c.6-.6.2-1.6-.6-1.6-.6 0-1.4.4-2 1l-3.6 3.6-8.6-2.4-1.6 1.6 7 4.2-3.4 3.4-2.6-.4-1.2 1.2 3.4 1.6 1.6 3.4 1.2-1.2-.4-2.6 3.4-3.4 4.2 7 1.6-1.6-2.4-8.6z" fill="#e8eef6" stroke="#3a5ad8" stroke-width="1" stroke-linejoin="round"/>',
  book: '<path d="M3 5.4q4.4-1.4 9 1 4.6-2.4 9-1v13.2q-4.4-1.4-9 1-4.6-2.4-9-1z" fill="#fff" stroke="#6a3a1a" stroke-width="1.1" stroke-linejoin="round"/><path d="M12 6.4v13.2" stroke="#6a3a1a" stroke-width="1"/><path d="M5 8.4q2.6-.6 5 .4M5 11q2.6-.6 5 .4M14 8.8q2.4-1 5-.4M14 11.4q2.4-1 5-.4" stroke="#b8a888" stroke-width=".8" fill="none"/>',
  tv: '<rect x="2.6" y="6" width="18.8" height="13" rx="2" fill="#5a3a22" stroke="#2e1c0e" stroke-width="1"/><rect x="4.4" y="7.8" width="12.2" height="9.4" rx="1.4" fill="#7fc4e8"/><circle cx="18.8" cy="10" r="1" fill="#d8c8a8"/><circle cx="18.8" cy="13.4" r="1" fill="#d8c8a8"/><path d="M9 6l-3-3.4M15 6l3-3.4" stroke="#2e1c0e" stroke-width="1" stroke-linecap="round"/>',
  moon: '<path d="M15.6 3.2A9 9 0 1 0 20.8 16 7.4 7.4 0 0 1 15.6 3.2z" fill="#ffe680" stroke="#b08a00" stroke-width="1"/><circle cx="10" cy="13.6" r="1.2" fill="#e8c840"/><circle cx="13.6" cy="17.4" r=".8" fill="#e8c840"/>',
  party: '<path d="M4 20.6L9 6.4l8.6 8.6z" fill="#ffd23c" stroke="#b06a00" stroke-width="1" stroke-linejoin="round"/><path d="M6.2 14.4l4.4 4.4M7.6 10.4l6 6" stroke="#e8243c" stroke-width="1.4"/><circle cx="16.4" cy="4.4" r="1.2" fill="#3a86e8"/><circle cx="20" cy="9" r="1" fill="#2fa52f"/><circle cx="13" cy="3" r=".9" fill="#e8243c"/><path d="M17.4 7.4l2.6-2.6" stroke="#e8243c" stroke-width="1.2" stroke-linecap="round"/>'
};

// Code → picture. The first code is the one the back office inserts.
export const EMOTICONS = [
  ['smile', 'Smile', [':)', ':-)']],
  ['grin', 'Big grin', [':D', ':-D']],
  ['wink', 'Wink', [';)', ';-)']],
  ['tongue', 'Tongue out', [':P', ':-P', ':p']],
  ['sad', 'Sad', [':(', ':-(']],
  ['cry', 'Crying', [":'("]],
  ['wow', 'Surprised', [':O', ':-O', ':o']],
  ['angry', 'Angry', [':@']],
  ['blush', 'Embarrassed', [':$']],
  ['cool', 'Cool', ['8)', '(cool)']],
  ['meh', 'Meh', [':|']],
  ['confused', 'Confused', [':S', ':s']],
  ['dizzy', 'Dizzy', ['(dizzy)']],
  ['sleepy', 'Sleepy', ['(sleepy)', '(zzz)']],
  ['love', 'In love', ['(love)']],
  ['heart', 'Heart', ['(heart)', '<3']],
  ['star', 'Star', ['(star)']],
  ['sun', 'Sun', ['(sun)']],
  ['rain', 'Rain', ['(rain)']],
  ['storm', 'Storm', ['(storm)']],
  ['coffee', 'Coffee', ['(coffee)']],
  ['music', 'Music', ['(music)']],
  ['plane', 'Plane', ['(plane)']],
  ['book', 'Book', ['(book)']],
  ['tv', 'TV', ['(tv)']],
  ['moon', 'Moon', ['(moon)']],
  ['party', 'Party', ['(party)']]
];

const CODE_TO = new Map();
for (const [id, label, codes] of EMOTICONS) for (const c of codes) CODE_TO.set(c, [id, label]);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CODES = [...CODE_TO.keys()].sort((a, b) => b.length - a.length);
// A code counts when it isn't glued to letters on either side, so "(tv)" works but "http://x" doesn't.
const RE = new RegExp(`(^|[\\s([{"'“‘·,.!?])(${CODES.map(esc).join('|')})(?=$|[\\s)\\]}"'”’·,.!?])`, 'g');

let n = 0;
export function emoticonSvg(id, size = 18) {
  if (!PICS[id]) return '';
  // Gradient ids are made unique so many faces can share a page.
  const k = ++n;
  const body = PICS[id].replace(/id="(em[fa])"/g, `id="$1${k}"`).replace(/url\(#(em[fa])\)/g, `url(#$1${k})`);
  return `<svg class="emo" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

// Text with codes turned into pictures, built from text nodes so nothing typed becomes HTML.
export function withEmoticons(text, size = 18) {
  const out = [];
  const s = String(text || '');
  let at = 0;
  for (const m of s.matchAll(RE)) {
    const start = m.index + m[1].length;
    if (start > at) out.push(s.slice(at, start));
    const [id, label] = CODE_TO.get(m[2]);
    out.push(h('span', { class: 'emo-wrap', role: 'img', 'aria-label': label, title: m[2], html: emoticonSvg(id, size) }));
    at = start + m[2].length;
  }
  if (at < s.length) out.push(s.slice(at));
  return out;
}
