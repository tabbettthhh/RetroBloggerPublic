// While the owner keeps their posts to friends or to themselves (Control Panel › Privacy),
// visitors still get the site, and in place of the posts, a little something from the old days:
// a tumbleweed rolling through an empty town, an error box, an old computer's crash, or Floppy
// wondering if he's been forgotten. A different one each time the page is loaded.
import { h } from './util.js';
import { sound } from './sound.js';
import { floppySvg } from './helper.js';

const SCENES = ['west', 'error', 'crash', 'floppy'];
let turn = Math.floor(Math.random() * SCENES.length);

// Whether visitors are kept out of the posts just now (never for the owner, signed in).
export function isPrivateNow(data) {
  return !data?.ownerView && (data?.site?.privacy === 'friends' || data?.site?.privacy === 'me');
}

const reduce = () => matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const who = (data) => (data?.site?.owner || '').trim().split(/\s+/)[0] || 'The owner';
// What's going on, in a few words (friends: they're sharing, just not with everyone).
const why = (data) => (data?.site?.privacy === 'friends' ? `${who(data)}’s sharing with friends only right now.` : `${who(data)}’s a private person right now.`);

export function privateScene(data) {
  const box = h('div', { class: 'ps-wrap' });
  const draw = (k) => box.replaceChildren(SCENES_BY[k](data, () => draw(SCENES[(SCENES.indexOf(k) + 1) % SCENES.length])));
  draw(SCENES[turn % SCENES.length]);
  return box;
}

// ---------- the Wild West: an empty town, a tumbleweed rolling through ----------
const CACTUS = (x, s = 1) => `<g transform="translate(${x} ${118 - 46 * s}) scale(${s})" fill="#4f8a3c" stroke="#2f5e22" stroke-width="2"><rect x="10" y="0" width="12" height="48" rx="6"/><path d="M10 26h-6a5 5 0 0 1-5-5v-9a3 3 0 0 1 6 0v8h5zM22 20h6v-10a3 3 0 0 1 6 0v12a5 5 0 0 1-5 5h-7z"/></g>`;
const WEED = `<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><g fill="none" stroke="#8a6a3a" stroke-width="1.6" stroke-linecap="round"><circle cx="20" cy="20" r="15"/><path d="M7 14c8 3 18-6 27 2M6 24c9-6 20 6 28-3M12 8c4 9-3 17 3 26M26 6c-5 9 4 18-2 28M9 30c6-3 12 3 22-1M14 5c6 4 14 0 18 7"/></g></svg>`;
function west(data, next) {
  const weed = h('span', { class: 'ps-weed', html: WEED });
  const scene = h(
    'div',
    { class: 'ps ps-west', role: 'img', 'aria-label': 'An empty desert town at noon, with a tumbleweed rolling past' },
    h('span', { class: 'ps-sun', 'aria-hidden': 'true' }),
    h('span', {
      class: 'ps-land',
      'aria-hidden': 'true',
      html: `<svg viewBox="0 0 320 130" preserveAspectRatio="xMidYMax slice"><path d="M0 92q60-18 120-6t110-4 90 6v42H0z" fill="#e9c58c"/><path d="M0 108q80-10 160-2t160-4v28H0z" fill="#dcae6c"/>${CACTUS(30, 0.9)}${CACTUS(262, 0.7)}<g transform="translate(150 70)"><rect x="18" y="12" width="6" height="40" fill="#7a5530"/><rect x="0" y="0" width="64" height="20" rx="2" fill="#b07a44" stroke="#6b4423" stroke-width="2" transform="rotate(-4 32 10)"/><text x="32" y="14" text-anchor="middle" font-family="Georgia, serif" font-size="8.5" font-weight="bold" fill="#3a2410" transform="rotate(-4 32 10)">NO POSTS</text></g></svg>`
    }),
    weed
  );
  if (reduce()) weed.classList.add('still');
  return h('div', { class: 'card ps-card' }, scene, h('p', { class: 'ps-say' }, h('b', null, 'Nothin’ to see here, partner.')), h('p', { class: 'ps-small' }, `${why(data)} The posts have ridden out of town for now. Check back another day.`), again(next, '🤠 Another look'));
}

// ---------- an error box ----------
const ERRS = ['0x0FF1CE', '0xC0FFEE', '0x000BED', '0x5ECRE7'];
function error(data, next) {
  const details = h('p', { class: 'ps-err-more', hidden: true }, `Error ${ERRS[Math.floor(Math.random() * ERRS.length)]}: posts_hidden_by_owner. Nothing is broken. They’re just not out for visitors at the moment.`);
  const win = h(
    'div',
    { class: 'ps-err', role: 'alertdialog', 'aria-label': 'Posts.exe' },
    h('div', { class: 'ps-err-bar' }, h('span', null, 'Posts.exe'), h('span', { class: 'ps-err-x', 'aria-hidden': 'true' }, '×')),
    h(
      'div',
      { class: 'ps-err-body' },
      h('span', { class: 'ps-err-ico', 'aria-hidden': 'true', html: '<svg viewBox="0 0 32 32" width="34" height="34"><circle cx="16" cy="16" r="14" fill="#d8352a" stroke="#8e1b13" stroke-width="1.5"/><path d="M10.5 10.5l11 11M21.5 10.5l-11 11" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/></svg>' }),
      h('div', null, h('p', null, h('b', null, 'Posts.exe can’t show the posts.')), h('p', null, `${why(data)} Sorry, visitor!`), details)
    ),
    h(
      'div',
      { class: 'ps-err-btns' },
      h('button', {
        type: 'button',
        class: 'ps-btn',
        onclick: () => {
          sound.nudge?.();
          win.classList.remove('shake');
          void win.offsetWidth;
          win.classList.add('shake');
        }
      }, 'OK'),
      h('button', { type: 'button', class: 'ps-btn', 'aria-expanded': 'false', onclick: (e) => ((details.hidden = !details.hidden), e.currentTarget.setAttribute('aria-expanded', String(!details.hidden)), (e.currentTarget.textContent = details.hidden ? 'Details »' : '« Details')) }, 'Details »'),
      h('button', { type: 'button', class: 'ps-btn', onclick: () => (sound.click?.(), next()) }, 'Try again')
    )
  );
  return h('div', { class: 'ps-desk' }, win);
}

// ---------- an old computer's crash ----------
function crash(data, next) {
  return h(
    'div',
    { class: 'ps-desk ps-grey' },
    h(
      'div',
      { class: 'ps-bomb', role: 'alertdialog', 'aria-label': 'A system error' },
      h('span', { class: 'ps-bomb-ico', 'aria-hidden': 'true', html: '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="17" cy="24" r="12" fill="#1d1d1d"/><circle cx="13" cy="20" r="3" fill="#fff" opacity=".55"/><rect x="22" y="9" width="7" height="6" rx="1" transform="rotate(40 25 12)" fill="#555"/><path d="M28 9q3-5 8-4" fill="none" stroke="#8a6a3a" stroke-width="1.6"/><path d="M35 2l1.2 2.6L39 5l-2.4 1.4L37 9l-2-1.8L33 9l.4-2.6L31 5l2.8-.4z" fill="#f4b400"/></svg>' }),
      h('div', null, h('p', null, h('b', null, 'Sorry, a privacy error occurred.')), h('p', { class: 'ps-mono' }, 'Error type 7: posts are hiding'), h('p', { class: 'ps-small' }, why(data))),
      h('div', { class: 'ps-err-btns' }, h('button', { type: 'button', class: 'ps-btn ps-btn-mac', onclick: () => (sound.click?.(), next()) }, 'Restart'))
    )
  );
}

// ---------- Floppy, feeling a little forgotten ----------
const PATS = ['Aw, thank you. That helps.', 'I’ll tell them you stopped by.', 'Same time tomorrow?', 'You’re a good one, visitor.', 'I’ll keep the kettle on.'];
function floppy(data, next) {
  let n = 0;
  const said = h('p', { class: 'ps-bubble-line' }, 'Have we been neglected? 🥺');
  const more = h('p', { class: 'ps-small' }, `Hey visitor, I’m sorry. ${why(data)} It’s just me and the dust bunnies in here.`);
  const pal = h('span', { class: 'ps-floppy', html: floppySvg() });
  return h(
    'div',
    { class: 'card ps-card ps-floppy-card' },
    h('div', { class: 'ps-floppy-row' }, pal, h('div', { class: 'ps-bubble' }, said, more)),
    h(
      'div',
      { class: 'ps-row' },
      h('button', {
        type: 'button',
        class: 'ps-btn',
        onclick: () => {
          sound.click?.();
          said.textContent = PATS[n++ % PATS.length];
          pal.classList.remove('hop');
          void pal.offsetWidth;
          pal.classList.add('hop');
        }
      }, '✋ Pat Floppy'),
      again(next, 'Something else')
    )
  );
}

const SCENES_BY = { west, error, crash, floppy };
function again(next, label) {
  return h('button', { type: 'button', class: 'ps-btn ps-again', onclick: () => (sound.click?.(), next()) }, label);
}
