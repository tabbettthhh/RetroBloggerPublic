// The Explore (Start) menu, shared by the desktop and the phone. On a phone it opens as a
// sheet from the taskbar with bigger rows; on the desktop it's the classic two columns.
import { withEmoticons } from './emoticons.js';
import { h, ICON, niceDate } from './util.js';
import { sound } from './sound.js';
import { menuOf } from './apps.js';
import { isDark, setThemeChoice } from './theme.js';
import { word } from './skins.js';

const MAIN = [
  ['#/', 'Thoughts', 'The latest posts', 'di-thoughts'],
  ['#/journal', 'Places Journal', 'Reviews in leather', 'di-journal'],
  ['#/atlas', 'Atlas', 'Every place on a map', 'di-atlas'],
  ['#/friends', 'Friends', 'Posts from my buddies', 'di-friends'],
  ['#/album', 'Photo album', 'Every photo, by date', 'di-album'],
  ['#/more', 'Photo dumps & lists', 'Film strips, top 5s, quotes', 'di-photos'],
  ['#/passport', 'Passport', 'A stamp per city', 'di-passport'],
  ['#/books', 'Bookshelf', 'Book reviews', 'di-books'],
  ['#/films', 'Cinema', 'Film reviews', 'di-films'],
  ['#/podcasts', 'Podcasts', 'On tape', 'di-podcasts'],
  ['#/music', 'Record crate', 'Albums and songs', 'di-music'],
  ['#/tv', 'TV', 'Shows on tape', 'di-tv']
];
const SHELVES = ['books', 'films', 'podcasts', 'music', 'tv'];

function postHref(p) {
  if (p.type === 'places') return `#/journal/${p.slug}`;
  if (SHELVES.includes(p.type)) return `#/${p.type}/${p.slug}`;
  return `#/post/${p.type}/${p.slug}`;
}

// Returns the menu's parts, with a Screensaver button when onScreensaver is given.
export function startMenuParts(data, { onScreensaver } = {}) {
  const head = h(
    'div',
    { class: 'sm-head' },
    h('span', { class: 'avatar', html: ICON.person() }),
    h('span', null, h('strong', null, 'Visitor'), data.site.status ? h('small', null, `${data.site.owner || 'The author'} is `, withEmoticons(data.site.status, 13)) : null)
  );
  const left = h(
    'div',
    { class: 'sm-left' },
    MAIN.filter(([href]) => !menuOf(data).hidden.has(href.slice(2) || 'home')).map(([href, label, sub, cls]) => h('a', { href, class: 'sm-item', role: 'menuitem' }, h('span', { class: 'dock-icon small ' + cls, 'aria-hidden': 'true' }), h('span', null, h('strong', null, word(href.slice(2) || 'home', label)), h('small', null, sub))))
  );
  const right = h(
    'div',
    { class: 'sm-right' },
    h('a', { href: '#/search', class: 'sm-link bold sm-search', role: 'menuitem' }, h('span', { class: 'ico', html: ICON.search }), word('search', 'Search')),
    h('div', { class: 'sm-sep' }),
    h('span', { class: 'sm-heading' }, 'Recent'),
    data.posts.slice(0, 3).map((p) => h('a', { href: postHref(p), class: 'sm-link', role: 'menuitem' }, p.title || (p.excerpt || '').slice(0, 32) || niceDate(p.date))),
    h('div', { class: 'sm-sep' }),
    menuOf(data).hidden.has('guestbook') ? null : h('a', { href: '#/guestbook', class: 'sm-link bold', role: 'menuitem' }, 'Sign the guestbook'),
    menuOf(data).hidden.has('wishlist') ? null : h('a', { href: '#/wishlist', class: 'sm-link bold', role: 'menuitem' }, 'Wishlist'),
    data.stats ? h('a', { href: '#/stats', class: 'sm-link bold', role: 'menuitem' }, 'Travel stats') : null,
    h('div', { class: 'sm-sep' }),
    h('a', { href: '#/about', class: 'sm-link', role: 'menuitem' }, 'About ' + (data.site.owner || ''))
  );
  const theme = h('button', { type: 'button', class: 'sm-foot-btn' });
  const paint = () => theme.replaceChildren(h('span', { class: 'sm-foot-ico theme' }), isDark() ? 'Light mode' : 'Dark mode');
  theme.addEventListener('click', (e) => {
    e.stopPropagation();
    setThemeChoice(isDark() ? 'light' : 'dark');
    paint();
    sound.click();
  });
  paint();
  const foot = h(
    'div',
    { class: 'sm-foot' },
    theme,
    onScreensaver ? h('button', { type: 'button', class: 'sm-foot-btn', onclick: onScreensaver }, h('span', { class: 'sm-foot-ico ss' }), 'Screensaver') : null,
    h('a', { href: '#/welcome', class: 'sm-foot-btn' }, h('span', { class: 'sm-foot-ico leave' }), word('leave', 'Leave'))
  );
  return [head, h('div', { class: 'sm-rule' }), h('div', { class: 'sm-cols' }, left, right), foot];
}

// Phone: the Explore button and its sheet, with a dimmed backdrop behind it.
// The screensaver is only downloaded the first time someone starts it, and only runs while
// it's on screen. Phones never start it by themselves.
let phoneSaver = null;
function startPhoneScreensaver(data) {
  import('./screensaver.js').then(({ makeScreensaver }) => (phoneSaver ||= makeScreensaver(data)).start());
}

export function phoneExplore(data) {
  const btn = h('button', { type: 'button', class: 'start-btn', 'aria-haspopup': 'true', 'aria-expanded': 'false' }, h('span', { class: 'ico', html: ICON.compass }), word('explore', 'Explore'));
  const menu = h('div', { class: 'start-menu mobile', role: 'menu', 'aria-label': 'Explore', hidden: true }, ...startMenuParts(data, { onScreensaver: () => { close(); startPhoneScreensaver(data); } }));
  const scrim = h('div', { class: 'start-scrim', hidden: true });
  const onKey = (e) => e.key === 'Escape' && close();
  function close() {
    menu.hidden = scrim.hidden = true;
    btn.classList.remove('pressed');
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey);
  }
  function open() {
    menu.hidden = scrim.hidden = false;
    btn.classList.add('pressed');
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKey);
    sound.click();
    menu.querySelector('.sm-item')?.focus({ preventScroll: true });
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden ? open() : close();
  });
  scrim.addEventListener('click', close);
  menu.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    close();
    // Tapping the section you're already on still closes the menu.
    if (a.getAttribute('href') === (location.hash || '#/')) e.preventDefault();
  });
  return { btn, layer: [scrim, menu] };
}
