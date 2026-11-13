// The Friends tab: posts from friends who run their own copy of this site, as one scrollable
// feed (newest first), under the neighbourhood: a street with a house for each friend (it's the
// buddy list too: lights on while they're online, their status in a bubble). Everything comes
// through your own site; nothing loads from theirs.
// (Signed in, their posts are mixed into your Home too: see friendPost.)
import { h } from './util.js';
import { ago } from './statusbar.js';
import { withEmoticons } from './emoticons.js';
import { friendHtml } from './friend-html.js';
import { card, foldLong } from './apps.js';
import { friendSkin } from './card-dress.js';
import { ownerHooks } from './owner-door.js';
import { sound } from './sound.js';
import { activeSkin, lookOf, drawingUrl, festiveScenery, FESTIVE_COLOURS } from './skins.js';
import { houseState } from './neighbourhood.js';
import { openVillage } from './village.js';

// Each friend's post cards (from their site), by the name their posts use.
let looks = {};

const TYPE = { thoughts: ['💭', 'Thought'], places: ['📍', 'Place'], photos: ['📷', 'Photos'], lists: ['📝', 'List'], quotes: ['❝', 'Quote'], books: ['📖', 'Book'], films: ['🎬', 'Film'], podcasts: ['🎧', 'Podcast'], music: ['🎵', 'Music'], tv: ['📺', 'TV'] };
const AVATAR = ['#3a86e8', '#4bb043', '#e8692c', '#b0306a', '#7a4ab8', '#1f9d8f', '#d4a017', '#2a6fd6'];
const colourFor = (s) => AVATAR[[...String(s)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR.length];
const initial = (s) => (String(s || '?').trim()[0] || '?').toUpperCase();
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : null);

// A square user picture, like the ones on the XP welcome screen.
function avatar(who, size = 'small') {
  return h('span', { class: `ff-avatar ${size}`, style: { '--av': colourFor(who.url || who.name) }, 'aria-hidden': 'true' }, initial(who.owner || who.name));
}

// The street dresses for the season or festive day, as the rest of the site does (and not at
// all when they're switched off). A festive day strings its garland across the sky, tints the
// sky in its colours, hangs its drawings on every door and stands one in every garden, and brings
// its own weather; an evening one (lanterns, lamps, bonfires) brings dusk, and a few bring
// fireworks.
const EVENING = new Set(['diwali', 'bonfire_night', 'eid_al_fitr', 'eid_al_adha', 'ramadan', 'hanukkah', 'mid_autumn', 'tanabata', 'halloween', 'yalda', 'lunar_new_year', 'dia_de_muertos']);
const FIREWORKS = new Set(['bonfire_night', 'diwali', 'lunar_new_year']);
const WEATHER = { petals: 'petal', confetti: 'confetti', stars: 'star', snow: 'snow', leaves: 'leaf', sunshine: 'spark' };
function lineDress() {
  const on = document.documentElement.dataset;
  const t = activeSkin();
  const id = on.festival ? t?.today?.festival : on.season;
  const look = id && t ? lookOf(id, t) : null;
  if (!look?.charms?.length) return null;
  let garland = '';
  try {
    garland = on.festival ? festiveScenery(look, id, t).garland : '';
  } catch {}
  const fest = on.festival ? id : '';
  return {
    charm: (i) => drawingUrl(look.charms[i % look.charms.length], t, 26),
    // (The same, as a plain address for a picture inside the drawing.)
    pic: (i) => drawingUrl(look.charms[i % look.charms.length], t, 26).replace(/^url\("(.*)"\)$/, '$1'),
    garland,
    fest,
    falling: fest ? WEATHER[look.falling] || '' : '',
    colours: fest ? FESTIVE_COLOURS[fest] || [t.accent, t.main, '#f6c431'] : null,
    evening: EVENING.has(fest),
    fireworks: FIREWORKS.has(fest) && !look.quiet
  };
}
// Whether the street's at night: dark mode, or a computer theme that's dark all over.
const isNight = () => document.documentElement.dataset.theme === 'dark' || getComputedStyle(document.documentElement).getPropertyValue('--k-scene-night').trim() === '1';
// (The festive day's dressing, for the houses being drawn.)
let dressNow = null;
// The Neighbourhood: a little street at the top of Friends, one house per friend on your list.
// It shows nothing the list doesn't: a name, whether they're online (lights on) and, only where
// you may see their posts, whether they posted today (smoke from the chimney) and whether
// there's something you haven't opened yet (an envelope on the step). No places, no addresses.
// Houses wear the season or festive day your site wears; tap one to visit, as with Visit.
const SVG = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, String(v));
  for (const k of kids.flat(Infinity)) if (k) e.append(k);
  return e;
};
const SEEN_KEY = 'nb-seen';
const readSeen = () => {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
};
const markSeen = (url, ts) => {
  try {
    const v = readSeen();
    v[url] = Math.max(Number(v[url]) || 0, ts || Date.now());
    localStorage.setItem(SEEN_KEY, JSON.stringify(v));
  } catch {}
};
const hexOk = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : '');

// Drawn like a Saturday-morning cartoon: thick ink lines, wonky walls, houses that breathe,
// blink and look about while their owner's online, and snooze (Zzz) while they're not. All of it
// our own drawings: no characters from anywhere.
const SHAPES = [
  { body: 'M16 60 L102 55 L106 113 L13 115Z', roof: 'M4 64 Q58 4 116 58 Q60 48 4 64Z', chim: 'M78 16l14-3 3 28-14 3Z', ex: [38, 82], ey: 80, dx: 60, eave: 60, sx: 87, sy: 8 },
  { body: 'M32 48 L88 44 L94 114 L27 115Z', roof: 'M20 54 Q50 30 64 2 Q78 30 102 47 Q60 40 20 54Z', chim: 'M76 14l11-1 2 24-12 3Z', ex: [46, 76], ey: 66, dx: 61, eave: 50, sx: 83, sy: 6 },
  { body: 'M22 64 Q19 110 25 114 L96 114 Q102 108 98 62Z', roof: 'M8 68 Q12 16 60 12 Q108 16 112 66 Q60 54 8 68Z', chim: 'M80 8l12 0 1 22-13 2Z', ex: [40, 82], ey: 82, dx: 61, eave: 64, sx: 87, sy: 0 },
  { body: 'M20 66 L98 60 L101 114 L17 115Z', roof: 'M6 72 Q28 22 50 10 Q96 38 114 64 Q60 52 6 72Z', chim: 'M74 18l13-2 2 26-13 3Z', ex: [40, 82], ey: 84, dx: 61, eave: 66, sx: 82, sy: 10 }
];
const WALLS = ['#ffd23f', '#ff7eb0', '#4fd6cb', '#b79bff', '#ff9a4d', '#8be35a', '#6cb6ff', '#ff7069'];
const ROOFS = ['#e8443a', '#7a4ad8', '#ff7a1a', '#1f9d8f', '#3a6fe8', '#d6338a', '#f0b400', '#2fa84a'];
const hashOf = (v) => [...String(v)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

function house(b, st, looks, i, ctx, day) {
  const root = document.documentElement.dataset;
  const season = root.season;
  const hsh = hashOf(b.url || b.name);
  const S = SHAPES[hsh % SHAPES.length];
  const lk = b.colours || looks[(ctx.data.friendPosts || []).find((p) => p.friend?.url === b.url)?.friend?.look] || {};
  const wall = hexOk(lk.main) || WALLS[hsh % WALLS.length];
  const roof = hexOk(lk.accent) || ROOFS[(hsh >>> 3) % ROOFS.length];
  const name = (b.owner || b.name || '').split(/\s+/)[0];
  const say = [st.lit ? 'online' : 'offline', st.smoke ? 'posted today' : '', st.mail ? 'something new' : ''].filter(Boolean).join(', ');
  const k = 'nb-k';
  // (Windows for eyes: open and looking about while they're online, shut while they're not.)
  const eye = (x) =>
    svg(
      'g',
      null,
      svg('rect', { x: x - 10, y: S.ey - 11, width: 20, height: 22, rx: 8, class: `${k} nb-pane` + (st.lit ? ' lit' : '') }),
      st.lit
        ? svg('g', { class: 'nb-eye' }, svg('g', { class: 'nb-pupil', style: `animation-delay:${-(hsh % 5)}s` }, svg('ellipse', { cx: x, cy: S.ey + 1, rx: 3.6, ry: 4.8, class: 'nb-ink' }), svg('circle', { cx: x + 1.2, cy: S.ey - 1, r: 1.1, fill: '#fff' })))
        : svg('path', { d: `M${x - 6} ${S.ey + 1}q6 5 12 0`, class: `${k} nb-shut` })
    );
  const lights = root.festival || season === 'winter';
  const clip = `nbc${i}`;
  const d = S.dx;
  const kind = season === 'winter' && hsh % 3 === 0 ? 'snowman' : hsh % 3 === 1 ? 'lamp' : 'tree';
  const prop =
    kind === 'snowman'
      ? svg('g', { class: 'nb-prop' }, svg('circle', { cx: 154, cy: 138, r: 11, class: `${k} nb-snowball` }), svg('circle', { cx: 154, cy: 121, r: 8, class: `${k} nb-snowball` }), svg('circle', { cx: 151, cy: 119, r: 1.2, class: 'nb-ink' }), svg('circle', { cx: 157, cy: 119, r: 1.2, class: 'nb-ink' }), svg('path', { d: 'M154 122l8 2-8 1Z', fill: '#ff8a1f', class: k, 'stroke-width': 1.5 }))
      : kind === 'lamp'
        ? svg('g', { class: 'nb-prop' }, svg('circle', { cx: 154, cy: 92, r: 17, class: 'nb-glow' }), svg('path', { d: 'M154 150V100', class: `${k} nb-post` }), svg('path', { d: 'M147 100h14l-3-13h-8Z', class: `${k} nb-lamp` }))
        : svg('g', { class: 'nb-prop nb-tree', style: `animation-delay:${-(hsh % 4)}s` }, svg('rect', { x: 151, y: 116, width: 7, height: 34, rx: 2, class: `${k} nb-trunk` }), svg('path', { d: 'M136 106q-5-16 9-19q3-15 17-7q13-2 10 13q9 10-4 17q-16 8-28 2q-7-2-4-6Z', class: `${k} nb-leaves` }));
  const art = svg(
    'svg',
    { viewBox: '0 0 170 170', class: 'nb-art', 'aria-hidden': 'true', focusable: 'false' },
    svg('ellipse', { cx: 82, cy: 150, rx: 56, ry: 6, class: 'nb-shadow' }),
    // (The garden path, from the door down to the road.)
    svg('path', { d: `M${d + 13} 148l-6 22h34l-10-22Z`, class: `${k} nb-path` }),
    day?.photo_day?.src ? null : dressNow?.fest ? svg('image', { href: dressNow.pic(i + 1), x: 136, y: 112, width: 34, height: 34, class: 'nb-fest-prop' }) : prop,
    svg(
      'g',
      { class: 'nb-body', transform: 'translate(22 34)' },
      svg(
        'g',
        { class: 'nb-breathe', style: `animation-delay:${-(hsh % 7) * 0.4}s` },
        svg('path', { d: S.chim, class: `${k} nb-chimney` }),
        st.smoke ? [0, 1, 2].map((n) => svg('circle', { cx: S.sx, cy: S.sy, r: 5 + n * 1.5, class: `${k} nb-puff`, style: `animation-delay:${n * 1.1}s` })) : null,
        svg('path', { d: S.body, class: `${k} nb-wall`, style: `fill:${wall}` }),
        svg('path', { d: S.roof, class: `${k} nb-roof`, style: `fill:${roof}` }),
        season === 'winter'
          ? [
              svg('clipPath', { id: clip }, svg('path', { d: `M-10 -10H130V${S.eave - 22}q-9 9-17 0q-9 9-17 0q-9 9-17 0q-9 9-17 0q-9 9-17 0q-9 9-17 0q-9 9-17 0q-9 9-17 0Z` })),
              svg('path', { d: S.roof, class: 'nb-snow', 'clip-path': `url(#${clip})` }),
              svg('path', { d: S.roof, class: `${k} nb-line` })
            ]
          : null,
        eye(S.ex[0]),
        eye(S.ex[1]),
        svg('path', { d: `M${d - 9} 114V98Q${d} 84 ${d + 9} 98V114Z`, class: `${k} nb-door` }),
        svg('circle', { cx: d + 5, cy: 103, r: 1.6, class: 'nb-knob' }),
        // (A festive day's drawing hung on the door.)
        dressNow?.fest ? svg('image', { href: dressNow.pic(i), x: d - 8, y: 86, width: 16, height: 16, class: 'nb-fest-door' }) : null,
        svg('path', { d: 'M88 116q-3-12 8-10q4-8 12-2q9 2 4 12Z', class: `${k} nb-bush` }),
        season === 'spring' ? [[95, 109], [103, 106], [108, 111]].map(([x, y]) => svg('circle', { cx: x, cy: y, r: 2, class: 'nb-bloom' })) : null,
        lights
          ? [svg('path', { d: `M18 ${S.eave + 3}Q60 ${S.eave + 11} 102 ${S.eave - 1}`, class: 'nb-wire' }), [24, 37, 50, 63, 76, 89].map((x, n) => svg('circle', { cx: x, cy: S.eave + 6 + (n === 2 || n === 3 ? 2 : 0) - n * 0.4, r: 2.6, class: 'nb-bulb', style: `animation-delay:${(n % 3) * 0.4}s`, fill: ['#ff5d5d', '#ffd23f', '#6cd4ff', '#8be35a'][n % 4] }))]
          : null,
        st.lit ? null : ['z', 'z', 'Z'].map((z, n) => svg('text', { x: S.ex[1] + 10 + n * 6, y: S.ey - 16 - n * 9, class: 'nb-zz', style: `animation-delay:${n * 0.5}s; font-size:${9 + n * 3}px` }, z))
      )
    ),
    // (A cat on the lawn, at some houses.)
    hsh % 4 === 2 ? svg('g', { class: 'nb-cat' }, svg('path', { d: 'M118 148q10-8 4-14', class: `${k} nb-tail` }), svg('ellipse', { cx: 111, cy: 144, rx: 8, ry: 6, class: `${k} nb-fur` }), svg('path', { d: 'M99 140l1-9 5 4 4-5 2 9q0 6-6 6t-6-5Z', class: `${k} nb-fur` }), svg('circle', { cx: 103, cy: 139, r: 1, class: 'nb-ink' }), svg('circle', { cx: 108, cy: 139, r: 1, class: 'nb-ink' })) : null,
    // (The mailbox: its flag up, and a letter poking out, while there's something new.)
    svg('path', { d: 'M13 150V126', class: `${k} nb-post` }),
    svg('path', { d: 'M3 128v-8q0-9 9-9h7q8 0 8 9v8Z', class: `${k} nb-box` }),
    st.mail ? svg('g', { class: 'nb-mail' }, svg('path', { d: 'M27 122V104h8v6h-8', class: `${k} nb-flag` }), svg('g', { class: 'nb-letter' }, svg('rect', { x: 5, y: 100, width: 17, height: 12, rx: 1.5, class: `${k} nb-env`, 'stroke-width': 2 }), svg('path', { d: 'M5 101l8.5 6 8.5-6', class: `${k} nb-flap`, 'stroke-width': 2 }))) : null
  );
  const pic = day?.photo_day?.src ? daySign(day, name) : null;
  const a = h(
    'a',
    { class: 'nb-house' + (st.lit ? ' on' : ' asleep') + (st.arrived ? ' nb-arrive' : ''), href: b.url, target: '_blank', rel: 'noopener noreferrer', title: `${name}’s site (${say})`, 'aria-label': `${name}’s site, ${say}` },
    art,
    h('span', { class: 'nb-name', style: `--nb-tilt:${[-3, 2, -1.5, 3][i % 4]}deg` }, name)
  );
  a.addEventListener('click', (e) => {
    sound.click?.();
    markSeen(b.url, st.newest);
    st.mail = false;
    a.querySelector('.nb-mail')?.remove();
    // (Signed in: off to their site as their friend, with a pass. Looked up now, in case you signed in since this was drawn.)
    const key = b.key || (ctx.data.buddies || []).find((x) => x.url === b.url)?.key;
    if (ownerHooks.visitFriend && key) {
      e.preventDefault();
      ownerHooks.visitFriend(key, b.url);
    }
  });
  // (Their status, in a speech bubble over the house: on your own street.)
  const said = b.status ? h('span', { class: 'nb-say', title: b.status }, withEmoticons(String(b.status).slice(0, 90), 13)) : null;
  return h('div', { class: 'nb-plot', 'data-house': b.url }, said, a, pic);
}

// Their photo of the day (the very one their own site shows today), on a sign in the garden.
// Tapping it opens its post (signed in: here, if it's in your feed, or on their site as their friend).
function daySign(b, name) {
  const d = b.photo_day;
  const a = h(
    'a',
    { class: 'nb-sign', href: d.url, target: '_blank', rel: 'noopener noreferrer', title: `${name}’s picture of the day${d.cap ? ': ' + d.cap : ''}` },
    h('span', { class: 'nb-sign-say' }, 'Picture of the day'),
    h('span', { class: 'nb-sign-pic' }, h('img', { src: d.src, alt: d.cap || `${name}’s picture of the day`, loading: 'lazy' })),
    h('span', { class: 'nb-sign-post', 'aria-hidden': 'true' })
  );
  a.addEventListener('click', (e) => {
    sound.click?.();
    if (!b.key) return;
    const card = document.querySelector(`[data-friend-post="${CSS.escape(`${b.key}|${d.id}`)}"]`);
    if (card) {
      e.preventDefault();
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card.classList.remove('pl-found');
      void card.offsetWidth;
      card.classList.add('pl-found');
    } else if (ownerHooks.visitFriend) {
      e.preventDefault();
      ownerHooks.visitFriend(b.key, d.url);
    }
  });
  return a;
}

// The sun (a moon at night), each with a face.
function skyFace(night) {
  const k = 'nb-k';
  return night
    ? svg('svg', { viewBox: '0 0 64 64', class: 'nb-sun moon', 'aria-hidden': 'true' }, svg('path', { d: 'M40 8a25 25 0 1 0 16 38a20 20 0 0 1-16-38Z', class: `${k} nb-moonface` }), svg('path', { d: 'M24 30q4 4 8 0', class: k, fill: 'none', 'stroke-width': 2.5 }), svg('path', { d: 'M24 42q5 4 10 1', class: k, fill: 'none', 'stroke-width': 2.5 }))
    : svg(
        'svg',
        { viewBox: '0 0 64 64', class: 'nb-sun', 'aria-hidden': 'true' },
        svg('g', { class: 'nb-rays' }, [0, 45, 90, 135, 180, 225, 270, 315].map((r) => svg('path', { d: 'M32 3v8', class: k, transform: `rotate(${r} 32 32)` }))),
        svg('circle', { cx: 32, cy: 32, r: 15, class: `${k} nb-sunface` }),
        svg('circle', { cx: 27, cy: 29, r: 1.8, class: 'nb-ink' }),
        svg('circle', { cx: 37, cy: 29, r: 1.8, class: 'nb-ink' }),
        svg('path', { d: 'M26 35q6 6 12 0', class: k, fill: 'none', 'stroke-width': 2.5 })
      );
}

// Who was in, last time this browser looked: a friend who's come online since gets their door
// creaking open and the lights flicking on, as buddies used to arrive.
const HOME_KEY = 'nb-home';
function arrivals(buddies) {
  let was = null;
  try {
    was = JSON.parse(localStorage.getItem(HOME_KEY) || 'null');
  } catch {}
  const now = Object.fromEntries(buddies.map((b) => [b.url, b.presence !== 'offline' ? 1 : 0]));
  try {
    localStorage.setItem(HOME_KEY, JSON.stringify(now));
  } catch {}
  if (!was || typeof was !== 'object') return new Set();
  return new Set(buddies.filter((b) => now[b.url] === 1 && was[b.url] === 0).map((b) => b.url));
}

// Strolling: the signpost at the end of your street points to each friend's street, and theirs
// to their friends' streets, and so on. Another street is only what that site's own Friends tab
// shows any visitor (names and lights on or off; no posts, no mail, no smoke), fetched by your
// own site. Where you've strolled to, beyond your own street (kept while the page is open).
let trail = [];
const firstName = (b) => (b.owner || b.name || '').split(/\s+/)[0];
const homeUrl = () => location.origin;

function neighbourhood(ctx) {
  const buddies = ctx.data.buddies || [];
  if (!buddies.length) return null;
  const night = isNight();
  const dress = lineDress();
  const dusk = !night && !!dress?.evening;
  const section = h('section', { class: 'nb' + (night ? ' night' : '') + (dusk ? ' night dusk' : '') + (dress?.fest ? ' fest' : '') });
  if (dress?.fest) {
    section.dataset.fest = dress.fest;
    dress.colours.slice(0, 3).forEach((c, n) => section.style.setProperty(`--nb-f${n + 1}`, c));
  }
  const note = (text) => {
    section.querySelector('.nb-note')?.remove();
    if (text) section.querySelector('.nb-title')?.append(h('span', { class: 'nb-note', role: 'status' }, text));
  };
  // Over to another street (or back along the way you came).
  let busy = false;
  const go = async (to, label) => {
    if (busy) return;
    sound.click?.();
    if (to === homeUrl()) return walk([]);
    const back = trail.findIndex((t) => t.url === to);
    if (back >= 0) return walk(trail.slice(0, back + 1));
    busy = true;
    note(`Strolling over to ${label}’s street…`);
    let s = null;
    try {
      const res = await fetch('/api/stroll?to=' + encodeURIComponent(to), { headers: { Accept: 'application/json' } });
      s = res.ok ? await res.json() : null;
    } catch {}
    busy = false;
    if (!s || !Array.isArray(s.houses)) return note(`No way through to ${label}’s street just now.`);
    walk([...trail, s].slice(-8));
  };
  const walk = (next) => {
    const scene = section.querySelector('.nb-street');
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const away = next.length >= trail.length ? 'nb-out' : 'nb-out back';
    trail = next;
    if (!scene || calm) return show();
    scene.className += ' ' + away;
    setTimeout(() => show(next.length >= 1 && away === 'nb-out' ? 'nb-in' : 'nb-in back'), 420);
  };
  const show = (arrive = '') => {
    const here = trail[trail.length - 1];
    section.setAttribute('aria-label', here ? `${firstName(here)}’s street` : 'Your neighbourhood');
    section.replaceChildren(titleOf(here), sceneOf(ctx, here, go, arrive));
  };
  // (Top right: the whole neighbourhood, opened out as a village.)
  const opener = (here) =>
    h('button', {
      type: 'button',
      class: 'nb-open',
      title: 'Open the whole neighbourhood',
      onclick: () => {
        const night = isNight();
        const dress = lineDress();
        openVillage({ title: here ? `${firstName(here)}’s neighbourhood` : 'Your neighbourhood', seed: here?.url || homeUrl(), houses: plotsFor(ctx, here, go).map((el) => ({ el })), me: here ? null : myHouse(ctx), dress, night: night || !!dress?.evening, dusk: !night && !!dress?.evening });
      }
    }, '⤢ Open');
  const titleOf = (here) => {
    const row = titleBar(here);
    row.append(opener(here));
    return row;
  };
  const titleBar = (here) =>
    here
      ? h(
          'div',
          { class: 'nb-title nb-trail' },
          '🚶 ',
          h('button', { type: 'button', class: 'nb-crumb', onclick: () => go(homeUrl()) }, 'My street'),
          trail.map((t, i) => [h('span', { class: 'nb-sep', 'aria-hidden': 'true' }, ' › '), i === trail.length - 1 ? h('b', null, `${firstName(t)}’s street`) : h('button', { type: 'button', class: 'nb-crumb', onclick: () => go(t.url, firstName(t)) }, `${firstName(t)}’s street`)])
        )
      : h('div', { class: 'nb-title' }, '🏘 The neighbourhood');
  // (If you'd strolled off before the page was drawn again, you're still there.)
  show();
  return section;
}

// The houses on a street: your friends' on yours (lights, smoke, mail, their status), or, on
// another street, just lights (your own house there takes you home).
function plotsFor(ctx, here, go) {
  const buddies = ctx.data.buddies || [];
  const posts = ctx.data.friendPosts || [];
  const now = new Date();
  dressNow = lineDress();
  if (!here) {
    const seen = readSeen();
    const came = arrivals(buddies);
    if (came.size) setTimeout(() => sound.creak?.(), 350);
    return buddies.map((b, i) => house(b, { ...houseState(b, posts, now, seen), arrived: came.has(b.url) }, ctx.data.friendLooks || {}, i, ctx, (ctx.data.friendDays || []).find((x) => x.url === b.url)));
  }
  return here.houses.map((b, i) => {
    const you = b.url === homeUrl();
    const el = house(you ? { ...b, owner: 'You', name: 'You' } : b, { lit: b.presence !== 'offline' }, {}, i, ctx, null);
    if (you) {
      const a = el.querySelector('.nb-house');
      a.removeAttribute('target');
      a.href = '#/friends';
      a.title = a.ariaLabel = 'Your house: back to your street';
      a.addEventListener('click', (e) => (e.preventDefault(), e.stopImmediatePropagation(), document.querySelector('.vl')?.remove(), go(homeUrl())), { capture: true });
    }
    return el;
  });
}

// Your own house, for the middle of the village: in your theme's colours, with your status.
function myHouse(ctx) {
  const site = ctx.data.site || {};
  const t = activeSkin();
  const el = house({ url: homeUrl(), name: site.name || 'You', owner: 'You', status: site.status || '', colours: t ? { main: t.main, accent: t.accent } : null }, { lit: site.presence !== 'offline' }, {}, 0, ctx, null);
  const a = el.querySelector('.nb-house');
  a.removeAttribute('target');
  a.removeAttribute('rel');
  a.href = '#/';
  a.title = a.ariaLabel = 'Your house';
  el.removeAttribute('data-house');
  return el;
}

function sceneOf(ctx, here, go, arrive) {
  const buddies = ctx.data.buddies || [];
  const posts = ctx.data.friendPosts || [];
  const now = new Date();
  const dress = lineDress();
  dressNow = dress;
  const night = isNight() || !!dress?.evening;
  const season = document.documentElement.dataset.season;
  const k = 'nb-k';
  const falling = dress?.fest ? dress.falling : { winter: 'snow', autumn: 'leaf', spring: 'petal' }[season];
  const cols = dress?.colours || [];
  let plots = plotsFor(ctx, here, go);
  if (here && !plots.length) plots = [h('div', { class: 'nb-plot nb-empty' }, h('span', { class: 'nb-name' }, 'Nobody about'))];
  // The signpost at the end of the road: one board for each street you can stroll to from here.
  const ways = (here ? here.houses : buddies).filter((b) => b.url && b.url !== homeUrl() && b.url !== here?.url).slice(0, 12);
  const post = ways.length
    ? h(
        'div',
        { class: 'nb-plot nb-way' },
        h(
          'div',
          { class: 'nb-boards', role: 'group', 'aria-label': 'Stroll to another street' },
          ways.map((b, i) => h('button', { type: 'button', class: 'nb-board', style: `--nb-tilt:${[-4, 3, -2, 4, -3][i % 5]}deg; --nb-board:${WALLS[hashOf(b.url) % WALLS.length]}`, onclick: () => go(b.url, firstName(b)) }, `${firstName(b)}’s street`, h('span', { 'aria-hidden': 'true' }, ' ➜')))
        ),
        h('span', { class: 'nb-way-post', 'aria-hidden': 'true' }),
        h('span', { class: 'nb-way-say', 'aria-hidden': 'true' }, 'Stroll')
      )
    : null;
  return h(
    'div',
    { class: 'nb-scroll' },
    h(
      'div',
      { class: 'nb-street' + (arrive ? ' ' + arrive : '') },
      h('span', { class: 'nb-stars', 'aria-hidden': 'true' }),
      skyFace(night),
      h('span', { class: 'nb-clouds', 'aria-hidden': 'true' }),
      h('span', { class: 'nb-clouds far', 'aria-hidden': 'true' }),
      night ? null : svg('svg', { viewBox: '0 0 40 12', class: 'nb-birds', 'aria-hidden': 'true' }, svg('path', { d: 'M2 7q4-6 7 0q3-6 7 0', class: `${k} nb-wing` }), svg('path', { d: 'M24 5q3-5 6 0q3-5 6 0', class: `${k} nb-wing` })),
      dress?.garland ? h('span', { class: 'nb-garland', 'aria-hidden': 'true', style: `--nb-garland:${dress.garland}` }) : null,
      // (Rolling hills behind, the lawn in front.)
      svg('svg', { viewBox: '0 0 600 96', preserveAspectRatio: 'none', class: 'nb-land', 'aria-hidden': 'true' }, svg('path', { d: 'M0 60Q80 10 170 46Q250 0 340 44Q430 8 520 40Q570 24 600 44V96H0Z', class: `${k} nb-hill` }), svg('path', { d: 'M0 72Q75 66 150 72T300 72T450 72T600 72V96H0Z', class: `${k} nb-lawn` })),
      h('div', { class: 'nb-row' }, plots, post),
      h(
        'div',
        { class: 'nb-road', 'aria-hidden': 'true' },
        h(
          'span',
          { class: 'nb-car' },
          svg('svg', { viewBox: '0 0 60 34' }, svg('path', { d: 'M4 24v-6q0-4 5-5l6-1q5-9 13-9h8q8 0 12 9q9 1 9 7v5Z', class: `${k} nb-carbody` }), svg('path', { d: 'M19 12q4-6 9-6h2v6ZM33 6h3q5 0 8 6H33Z', class: `${k} nb-glass`, 'stroke-width': 2 }), svg('circle', { cx: 16, cy: 25, r: 5.5, class: `${k} nb-wheel` }), svg('circle', { cx: 44, cy: 25, r: 5.5, class: `${k} nb-wheel` }), svg('circle', { cx: 55, cy: 18, r: 2, class: 'nb-beam' }))
        )
      ),
      // (Fireworks over the roofs, on the few days that have them.)
      dress?.fireworks ? h('span', { class: 'nb-fireworks', 'aria-hidden': 'true' }, [[18, 22], [46, 12], [72, 26], [88, 10]].map(([x, y], n) => h('i', { style: `left:${x}%; top:${y}px; --c:${cols[n % cols.length] || '#ffd23f'}; animation-delay:${n * 0.7}s` }))) : null,
      falling ? h('span', { class: `nb-weather ${falling}`, 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, n) => h('i', { style: `left:${(n * 37 + 11) % 100}%; animation-delay:${-((n * 1.7) % 9)}s; animation-duration:${7 + (n % 5)}s` + (falling === 'confetti' && cols.length ? `; background:${cols[n % cols.length]}` : '') }))) : null
    )
  );
}

function photos(list, title) {
  if (!list.length) return null;
  const strip = h('div', { class: 'ff-photos', tabindex: '0', 'aria-label': `${list.length} photo${list.length === 1 ? '' : 's'}` }, list.map((src, i) => h('img', { src, alt: title ? `${title}, photo ${i + 1}` : `Photo ${i + 1}`, loading: 'lazy', decoding: 'async' })));
  if (list.length < 2) return h('div', { class: 'ff-media' }, strip);
  const dots = h('div', { class: 'ff-dots', 'aria-hidden': 'true' }, list.map((_, i) => h('span', { class: i ? '' : 'on' })));
  strip.addEventListener('scroll', () => {
    const at = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === at));
  }, { passive: true });
  return h('div', { class: 'ff-media' }, strip, dots, h('span', { class: 'ff-count' }, `1/${list.length}`));
}

// Which friend's post a card is, for the owner's tools (commenting on it from here).
function markFriendPost(el, p) {
  const who = p.friend || {};
  // (Never taken for one of your own posts that happens to share its name.)
  delete el.dataset.post;
  if (who.key && p.id) el.dataset.friendPost = `${who.key}|${p.id}`;
  // (Friends-only: theirs for you to see, never your visitors.)
  if (p.friends_only) el.querySelector('.ff-who small')?.append(h('span', { class: 'ff-only' }, ' · 👥 friends only'));
  return el;
}

function postCard(p) {
  const who = p.friend || {};
  const [emoji, word] = TYPE[p.type] || ['•', 'Post'];
  const link = safeUrl(p.url);
  const site = safeUrl(who.url);
  const meta = [p.creator, p.city].filter(Boolean).join(' · ');
  const text = friendHtml(p.html, 'ff-text prose');
  const card = h(
    'article',
    { class: 'ff-post' + (p.photos.length ? '' : ' no-photo') },
    h(
      'header',
      { class: 'ff-head' },
      avatar(who),
      h('span', { class: 'ff-who' }, site ? h('a', { href: site, target: '_blank', rel: 'noopener noreferrer' }, h('b', null, who.name)) : h('b', null, who.name), h('small', null, `${emoji} ${word} · ${ago(p.ts)}`))
    ),
    photos(p.photos, p.title),
    h(
      'div',
      { class: 'ff-body' },
      p.title ? h('h3', { class: 'ff-title' }, p.title) : null,
      meta || p.rating != null ? h('div', { class: 'ff-meta' }, meta, p.rating != null ? h('span', { class: 'ff-stars', 'aria-label': `Rated ${p.rating} out of 5` }, (meta ? ' · ' : '') + '★'.repeat(Math.max(0, Math.min(5, Math.round(p.rating))))) : null) : null,
      text,
      // (Not for a friends-only post: on their site it's only for friends visiting with a pass.)
      link && !p.friends_only ? h('a', { class: 'ff-open', href: link, target: '_blank', rel: 'noopener noreferrer' }, `See it on ${who.owner || who.name}’s site ↗`) : null
    )
  );
  // Long posts fold to a few lines, with "more" to read the rest.
  requestAnimationFrame(() => {
    if (text.scrollHeight > text.clientHeight + 4) {
      const more = h('button', { type: 'button', class: 'ff-more', onclick: () => { text.classList.add('open'); more.remove(); } }, 'more');
      text.after(more);
    } else text.classList.add('open');
  });
  return markFriendPost(card, p);
}

// A post that came in full is drawn just as it looks on your friend's site (keepsakes, a
// memory's ribbon, its font and all), with who it's from on top. Its links go to their site.
function friendCard(p) {
  const who = p.friend || {};
  const site = safeUrl(who.url);
  let el = null;
  try {
    // (Their writing, made into HTML by your own site, goes through the friends' cleaner too.)
    // (Their post cards too: the one they chose, from their mix, or one they made.)
    const skin = friendSkin(who.look, looks[who.look]);
    el = card({ ...p.full, html: friendHtml(p.full.html, 'x').innerHTML, ...(skin ? { friend_look: skin, friend_id: who.look } : { card: /^c\d+$/.test(p.full.card || '') ? '' : p.full.card }) });
  } catch (e) {
    console.error(e);
  }
  if (!el) return postCard(p);
  for (const a of el.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#/') && site) Object.assign(a, { href: site + '/' + href, target: '_blank', rel: 'noopener noreferrer' });
    else if (!/^https?:\/\//i.test(href)) a.removeAttribute('href');
  }
  el.classList.add('ff-full');
  el.prepend(
    h(
      'div',
      { class: 'ff-head ff-from' },
      avatar(who),
      h('span', { class: 'ff-who' }, site ? h('a', { href: site, target: '_blank', rel: 'noopener noreferrer' }, h('b', null, who.name)) : h('b', null, who.name), h('small', null, ago(p.ts)))
    )
  );
  const link = safeUrl(p.url);
  if (link && !p.friends_only) el.append(h('a', { class: 'ff-open', href: link, target: '_blank', rel: 'noopener noreferrer' }, `See it on ${who.owner || who.name}’s site ↗`));
  return markFriendPost(foldLong(el, p.full), p);
}

// A friend's post, drawn as on their site with who it's from on top (for your Home, signed in).
export function friendPost(p, data) {
  looks = data?.friendLooks || looks;
  const el = p.full ? friendCard(p) : postCard(p);
  el.classList.add('ff-in-home');
  return el;
}

export function friendsApp(ctx) {
  const buddies = ctx.data.buddies || [];
  const all = ctx.data.friendPosts || [];
  looks = ctx.data.friendLooks || {};
  const wrap = h('div', { class: 'feed ff' });
  const redraw = () => {
    const posts = all;
    const parts = [
      // (First of all: the street, with a house for each friend. It's the buddy list now too.)
      neighbourhood(ctx),
      posts.length
        ? posts.map((p) => (p.full ? friendCard(p) : postCard(p)))
        : // (Never why: to a visitor, there's just nothing from friends yet.)
          ctx.data.friendsTab === false || (!buddies.length && !ctx.data.ownerView)
          ? h('div', { class: 'card ff-empty' }, h('p', null, 'No posts from friends yet.'))
          : h('div', { class: 'card ff-empty' }, h('p', null, buddies.length ? 'No posts from friends yet.' : `${ctx.data.site.owner || 'This site'} hasn’t added any friends yet.`), h('p', { class: 'muted small' }, 'Friends are people who run their own copy of this site.'))
    ];
    wrap.replaceChildren(...parts.flat().filter(Boolean));
  };
  redraw();
  return wrap;
}
