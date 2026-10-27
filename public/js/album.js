// The photo album: every photo from every post, newest first, stuck into an old 90s
// "magnetic" album. Yellowed sticky pages under a crinkly plastic film, glossy prints with
// an orange date stamp in the corner, handwritten month labels on masking tape, and Floppy
// tucked inside the cover. Tap a print to open it in the picture viewer and flick through
// the whole album from there.
import { h, niceDate } from './util.js';
import { floppySvg } from './helper.js';
import { ABOUT } from './floppy-lines.js';
import { openViewer } from './apps.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHELVES = ['books', 'films', 'podcasts', 'music', 'tv'];

function postHref(p) {
  if (p.type === 'places') return `#/journal/${p.slug}`;
  if (SHELVES.includes(p.type)) return `#/${p.type}/${p.slug}`;
  return `#/post/${p.type}/${p.slug}`;
}

// The orange date a 90s camera burnt into the corner of the print: '26 10 23
function dateStamp(date) {
  const m = String(date || '').match(/^(\d{2})(\d{2})-(\d{2})-(\d{2})/);
  return m ? `'${m[2]} ${m[3]} ${m[4]}` : '';
}

// A small, steady wonkiness for each print, so the page looks stuck in by hand but doesn't
// jump about every time it's drawn.
function tilt(src, k) {
  let n = k * 7919;
  for (let i = 0; i < src.length; i++) n = (n * 31 + src.charCodeAt(i)) | 0;
  return ((Math.abs(n) % 9) - 4) * 0.55;
}

// What's written under a print: its caption, else the post's title, place, first few words or day.
function label(s) {
  const p = s.post;
  const words = String(p.excerpt || '').trim().split(/\s+/).slice(0, 5).join(' ');
  return s.caption || p.title || p.city || (words ? words + (String(p.excerpt).trim().split(/\s+/).length > 5 ? '…' : '') : niceDate(p.date));
}

export function albumApp(ctx) {
  const { data } = ctx;
  const shots = [];
  [...data.posts]
    .filter((p) => p.photos?.length)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .forEach((post) => post.photos.forEach((src, i) => shots.push({ src, caption: post.captions?.[i] || '', post })));

  const owner = (data.site.owner || '').trim();
  const years = shots.map((s) => String(s.post.date || '').slice(0, 4)).filter(Boolean);
  const span = years.length ? (years[0] === years[years.length - 1] ? years[0] : `${years[years.length - 1]}–${years[0]}`) : '';

  const lines = ABOUT.album();
  const said = h('span', { class: 'al-said hand' }, lines[Math.floor(Math.random() * lines.length)]);
  const cover = h(
    'div',
    { class: 'al-cover' },
    h('span', { class: 'al-emboss' }, 'Photos'),
    h('span', { class: 'al-cover-sub' }, [owner ? `${owner}'s album` : 'Album', span, `${shots.length} ${shots.length === 1 ? 'print' : 'prints'}`].filter(Boolean).join(' · ')),
    h(
      'button',
      { type: 'button', class: 'al-floppy', title: 'Poke Floppy', 'aria-label': 'Poke Floppy', onclick: () => (said.textContent = lines[Math.floor(Math.random() * lines.length)]) },
      h('span', { class: 'al-floppy-disk', html: floppySvg() }),
      said
    )
  );

  if (!shots.length) return h('div', { class: 'album' }, cover, h('div', { class: 'al-page al-empty' }, h('p', { class: 'hand' }, 'No photos stuck in yet. The first one goes here.')));

  // Everything opens in the picture viewer, with Previous / Next through the whole album.
  const all = shots.map((s) => s.src);
  const caps = shots.map((s) => [label(s), dateStamp(s.post.date).replace(/^'/, '’')].filter(Boolean).join(' · '));
  const open = (i) => openViewer({ photos: all, captions: caps, title: 'Photo album' }, i);

  // Month by month, a few prints to a page.
  const perPage = ctx.desktop || ctx.tablet ? 6 : 4;
  const months = [];
  shots.forEach((s, i) => {
    const key = String(s.post.date || '').slice(0, 7);
    let m = months[months.length - 1];
    if (!m || m.key !== key) months.push((m = { key, items: [] }));
    m.items.push({ ...s, i });
  });

  const pages = [];
  for (const m of months) {
    const [y, mo] = m.key.split('-');
    const heading = mo ? `${MONTHS[Number(mo) - 1]} ${y}` : 'Undated';
    for (let at = 0; at < m.items.length; at += perPage) {
      const chunk = m.items.slice(at, at + perPage);
      pages.push(
        h(
          'section',
          { class: 'al-page', 'aria-label': `${heading}, page ${at / perPage + 1}` },
          at === 0 ? h('h2', { class: 'al-month hand' }, heading) : h('span', { class: 'al-month cont hand' }, `${heading}, cont.`),
          h(
            'div',
            { class: 'al-prints' + (chunk.length === 1 ? ' one' : '') },
            chunk.map((s) =>
              h(
                'figure',
                { class: 'al-print', style: { '--tilt': tilt(s.src, s.i).toFixed(2) + 'deg' } },
                h(
                  'button',
                  { type: 'button', class: 'al-photo', onclick: () => open(s.i), 'aria-label': `Open ${label(s)}` },
                  // A photo that can't be found is quietly left out rather than shown broken.
                  h('img', { src: s.src, alt: label(s), loading: 'lazy', onerror: (e) => e.target.closest('.al-print')?.remove() }),
                  h('span', { class: 'al-stamp', 'aria-hidden': 'true' }, dateStamp(s.post.date))
                ),
                h('figcaption', { class: 'hand' }, h('a', { href: postHref(s.post) }, label(s)))
              )
            )
          )
        )
      );
    }
  }
  return h('div', { class: 'album' }, cover, ...pages, h('p', { class: 'al-end hand' }, '~ more pages to fill ~'));
}
