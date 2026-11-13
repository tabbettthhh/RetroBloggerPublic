// The old computers: the whole machine around your site. On a big screen, a case of its own
// around the desktop (a cream monitor with stereo speakers, a breadbin's round speakers, a
// wood-cabinet telly, a hi-fi stack, an old web browser) or an operating system's look inside it
// (glass, a superbar, tiles, a tiling terminal). On a phone, a flip phone or a handheld.
// The theme's "Computer" and "Phone" settings pick them (data-sk-machine and data-sk-handset on
// the page; see skins.js); machine.css draws them. Every drawing here is the site's own.
//
// The parts that do something: the speakers pulse whenever the site makes a sound, the volume
// knobs really turn the site's sounds up and down (and the other knob the screen's brightness),
// the hi-fi's needles swing, its source buttons and the telly's channel buttons open your
// sections, the old browser's buttons go back, forward and home, and its webring links your
// friends' sites (only those your friends list already shows this visitor).
import { h } from './util.js';
import { getVolume, setVolume, isMuted, setMuted } from './sound.js';
import { clockText } from './sky.js';
import { photoOfTheDay } from './extras.js';
import { sections } from './apps.js';
import { nowPlaying } from './statusbar.js';

const root = document.documentElement;
const CASES = new Set(['beige', 'breadbin', 'bluedesk', 'teletext', 'hifi', 'browser']);
let data = null;
let desktop = false;
let built = '';
let parts = [];
let timers = [];

const keep = (k, v) => {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, String(v));
  } catch {}
  return null;
};
const svg = (markup, cls = '') => h('span', { class: 'mc-svg ' + cls, 'aria-hidden': 'true', html: markup });
const name = () => String(data?.site?.name || '').trim() || 'My site';
// Your sections, as this visitor's menus show them: the first few.
const places = (n = 6) => {
  try {
    return sections(data)
      .filter((s) => s.id !== 'about' && s.id !== 'search' && s.href)
      .slice(0, n)
      .map((s) => ({ id: s.id, label: s.label, href: s.href }));
  } catch {
    return [{ id: 'home', label: 'Home', href: '#/' }];
  }
};

// ---------- a knob that really turns ----------
// Drag it (up or round to the right turns it up), scroll on it, or use the arrow keys.
function knob(label, get, set, cls = '') {
  const el = h('button', { type: 'button', class: 'mc-knob ' + cls, role: 'slider', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '10' }, h('span', { class: 'mc-knob-cap' }, h('span', { class: 'mc-knob-mark' })));
  const paint = () => {
    const v = get();
    el.style.setProperty('--turn', `${-135 + v * 270}deg`);
    el.setAttribute('aria-valuenow', String(Math.round(v * 10)));
    el.setAttribute('aria-valuetext', `${Math.round(v * 10)} of 10`);
  };
  const turn = (by) => {
    set(Math.round(Math.max(0, Math.min(1, get() + by)) * 10) / 10);
    paint();
  };
  let from = null;
  el.addEventListener('pointerdown', (e) => {
    from = { x: e.clientX, y: e.clientY, v: get() };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!from) return;
    set(Math.round(Math.max(0, Math.min(1, from.v + (e.clientX - from.x - (e.clientY - from.y)) / 160)) * 20) / 20);
    paint();
  });
  const end = () => (from = null);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    turn(e.deltaY < 0 ? 0.1 : -0.1);
  }, { passive: false });
  el.addEventListener('keydown', (e) => {
    const by = { ArrowUp: 0.1, ArrowRight: 0.1, ArrowDown: -0.1, ArrowLeft: -0.1, PageUp: 0.3, PageDown: -0.3 }[e.key];
    if (by == null) return;
    e.preventDefault();
    turn(by);
  });
  paint();
  return { el, paint };
}
function volumeKnob(cls = '') {
  const k = knob('Volume', () => (isMuted() ? 0 : getVolume()), (v) => {
    if (v > 0 && isMuted()) setMuted(false);
    setVolume(v);
  }, cls);
  on(document, 'volumechange', k.paint);
  on(document, 'mutechange', k.paint);
  return k.el;
}
const brightness = () => {
  const v = Number(keep('mc-bright'));
  return keep('mc-bright') == null || !Number.isFinite(v) ? 1 : Math.max(0, Math.min(1, v));
};
function paintBrightness() {
  root.style.setProperty('--mc-dim', ((1 - brightness()) * 0.6).toFixed(2));
}
const brightKnob = (cls = '') =>
  knob('Brightness', brightness, (v) => {
    keep('mc-bright', v.toFixed(2));
    paintBrightness();
  }, cls).el;

// Listeners and timers that go when the machine changes.
function on(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  timers.push(() => target.removeEventListener(type, fn, opts));
}
function every(ms, fn) {
  const id = setInterval(fn, ms);
  timers.push(() => clearInterval(id));
}

// ---------- the speakers ----------
const speaker = (side, kind) =>
  h('div', { class: `mc-spk mc-spk-${side} mc-spk-${kind}`, 'aria-hidden': 'true' }, h('span', { class: 'mc-grille' }), h('span', { class: 'mc-cone mc-cone-a' }), h('span', { class: 'mc-cone mc-cone-b' }), h('span', { class: 'mc-cone mc-cone-c' }));
const light = (cls, label) => h('span', { class: 'mc-led ' + cls, role: 'img', 'aria-label': label });
const badge = () => h('span', { class: 'mc-badge' }, name());

// ---------- each case ----------
function caseFor(kind) {
  const L = speaker('l', kind);
  const R = speaker('r', kind);
  const strip = (...kids) => h('div', { class: 'mc-strip' }, ...kids);
  const channels = (cls) =>
    h('nav', { class: 'mc-channels ' + cls, 'aria-label': 'Sections' }, places(6).map((p, i) => h('a', { class: 'mc-chan', href: p.href, title: p.label, 'aria-label': p.label }, kind === 'hifi' ? h('span', null, p.label) : String(i + 1), kind === 'hifi' ? h('i', { class: 'mc-chan-led' }) : null)));
  if (kind === 'beige')
    return [L, R, h('div', { class: 'mc-knobs mc-knobs-l' }, volumeKnob(), h('span', { class: 'mc-cap' }, 'Volume')), h('div', { class: 'mc-knobs mc-knobs-r' }, brightKnob(), h('span', { class: 'mc-cap' }, 'Brightness')), strip(badge(), h('span', { class: 'mc-slots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('span', { class: 'mc-cap' }, 'Power'), light('mc-power', 'Power on'))];
  if (kind === 'breadbin')
    return [L, R, h('div', { class: 'mc-knobs mc-knobs-l' }, volumeKnob(), h('span', { class: 'mc-cap' }, 'Volume')), h('div', { class: 'mc-knobs mc-knobs-r' }, brightKnob(), h('span', { class: 'mc-cap' }, 'Brightness')), strip(h('span', { class: 'mc-rainbow', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i')), badge(), h('span', { class: 'mc-cap' }, 'Power'), light('mc-power mc-red', 'Power on'))];
  if (kind === 'bluedesk')
    return [L, R, h('div', { class: 'mc-knobs mc-knobs-l' }, volumeKnob('small'), h('span', { class: 'mc-cap' }, 'Vol')), h('div', { class: 'mc-knobs mc-knobs-r' }, brightKnob('small'), h('span', { class: 'mc-cap' }, 'Bright')), strip(badge(), h('span', { class: 'mc-cap' }, 'Power'), light('mc-power', 'Power on'), h('span', { class: 'mc-cap' }, 'Drive'), light('mc-drive', 'Drive light'))];
  if (kind === 'teletext')
    return [L, R, strip(badge(), channels('mc-tv-chans'), volumeKnob(), light('mc-power mc-red', 'Power on'))];
  if (kind === 'hifi') {
    const meter = (side) => h('span', { class: 'mc-meter', role: 'img', 'aria-label': `${side} level meter` }, h('span', { class: 'mc-meter-face' }, h('b', null, side[0]), h('span', { class: 'mc-needle' })));
    const now = data ? nowPlaying(data).find((x) => x.type === 'music' || x.type === 'podcasts') : null;
    const playing = now ? now.title + now.extra : '';
    return [
      L,
      R,
      strip(
        h('span', { class: 'mc-meters' }, meter('Left'), meter('Right')),
        channels('mc-sources'),
        h('span', { class: 'mc-deck', 'aria-hidden': !playing }, h('span', { class: 'mc-deck-label' }, playing || name()), h('span', { class: 'mc-reels' }, h('i', { class: 'mc-reel' }), h('i', { class: 'mc-reel' }))),
        h('span', { class: 'mc-knobwrap' }, volumeKnob('big'), h('span', { class: 'mc-cap' }, 'Volume')),
        light('mc-power mc-red', 'Power on')
      )
    ];
  }
  if (kind === 'browser') {
    const addr = h('input', { class: 'mc-addr', type: 'text', readonly: true, 'aria-label': 'Address', value: location.href });
    const paintAddr = () => (addr.value = location.href);
    on(window, 'hashchange', () => {
      paintAddr();
      throb();
    });
    const globe = svg('<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="16" fill="#2f7be0" stroke="#0b1a3a" stroke-width="2.5"/><path d="M6 15c8 3 20 3 28 0M6 25c8-3 20-3 28 0M20 4c-7 8-7 24 0 32M20 4c7 8 7 24 0 32" fill="none" stroke="#bfe0ff" stroke-width="2"/></svg>', 'mc-globe');
    const throb = () => {
      globe.classList.remove('spin');
      void globe.offsetWidth;
      globe.classList.add('spin');
    };
    const btn = (label, d, act) => h('button', { type: 'button', class: 'mc-bbtn', onclick: act }, svg(`<svg viewBox="0 0 24 24" width="22" height="22"><path d="${d}" fill="currentColor"/></svg>`), h('span', null, label));
    const latest = (data?.posts || []).find((p) => p.title) || null;
    const marquee = `★ Welcome to ${name()}! ★ ${latest ? `Newest: ${latest.title} ★ ` : ''}Thanks for stopping by ★ Sign the guestbook on your way out ★`;
    // The webring: your friends' sites, only as far as your friends list is shown to this visitor.
    const ring = (data?.buddies || []).filter((b) => /^https?:\/\//.test(b.url || ''));
    const pick = () => ring[Math.floor(Math.random() * ring.length)];
    const webring = ring.length
      ? h(
          'nav',
          { class: 'mc-ring', 'aria-label': 'Webring' },
          h('a', { href: ring[ring.length - 1].url, target: '_blank', rel: 'noopener noreferrer' }, '◄ Prev'),
          h('span', null, `${name()} webring`),
          h('a', { href: pick().url, target: '_blank', rel: 'noopener noreferrer', onclick: (e) => (e.currentTarget.href = pick().url) }, 'Random'),
          h('a', { href: ring[0].url, target: '_blank', rel: 'noopener noreferrer' }, 'Next ►')
        )
      : null;
    return [
      h(
        'div',
        { class: 'mc-browser-top' },
        h('div', { class: 'mc-btitle' }, h('span', null, `${name()} - Web Browser`)),
        h(
          'div',
          { class: 'mc-btools' },
          btn('Back', 'M10 5 3 12l7 7v-4h11V9H10Z', () => history.back()),
          btn('Forward', 'M14 5l7 7-7 7v-4H3V9h11Z', () => history.forward()),
          btn('Home', 'M3 11 12 3l9 8v10h-6v-6H9v6H3Z', () => (location.hash = '#/')),
          btn('Sound', 'M3 9h4l5-5v16l-5-5H3ZM15 8q3 4 0 8M18 5q6 7 0 14', () => setMuted(!isMuted())),
          globe
        ),
        h('div', { class: 'mc-baddr' }, h('span', { class: 'mc-cap' }, 'Address'), addr),
        h('div', { class: 'mc-marquee', 'aria-hidden': 'true' }, h('span', null, marquee), h('span', null, marquee))
      ),
      h('div', { class: 'mc-browser-foot' }, h('span', { class: 'mc-done' }, 'Document: Done'), webring, h('span', { class: 'mc-zone' }, svg('<svg viewBox="0 0 20 20" width="16" height="16"><circle cx="10" cy="10" r="8" fill="#2f7be0" stroke="#0b1a3a" stroke-width="1.5"/></svg>'), 'Internet zone'))
    ];
  }
  return [];
}

// ---------- inside the screen ----------
function insideFor(kind, desk) {
  const add = (el) => {
    desk.append(el);
    parts.push(el);
  };
  if (kind === 'breadbin') {
    const cur = h('span', { class: 'mc-cursor' });
    add(h('pre', { class: 'mc-ready', 'aria-hidden': 'true' }, `**** ${name().toUpperCase()} ****\n\nREADY.\n`, cur));
  }
  if (kind === 'bluedesk') add(h('div', { class: 'mc-screenbar' }, h('span', null, `${name()} desk`), h('span', { class: 'mc-depth', 'aria-hidden': 'true' }, h('i'), h('i'))));
  if (kind === 'teletext') {
    const head = h('div', { class: 'mc-ttx-head' });
    const paint = () => {
      const d = new Date();
      head.replaceChildren(h('span', null, 'P100'), h('b', null, name().toUpperCase().slice(0, 18)), h('span', null, d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })), h('b', null, clockText()));
    };
    paint();
    every(20000, paint);
    add(head);
    const four = places(4);
    const colours = ['red', 'green', 'yellow', 'cyan'];
    add(h('nav', { class: 'mc-fastext', 'aria-label': 'Coloured keys' }, four.map((p, i) => h('a', { href: p.href, class: 'mc-fx-' + colours[i] }, p.label))));
  }
  if (kind === 'glass') {
    const hands = svg('<svg viewBox="0 0 140 140" width="130" height="130"><circle cx="70" cy="70" r="64" fill="#f7fbff" stroke="#1d2b36" stroke-width="5"/><circle cx="70" cy="70" r="56" fill="none" stroke="#9db4c6" stroke-width="2" stroke-dasharray="2 27.3"/><path class="mc-h" d="M70 70V36" stroke="#1d2b36" stroke-width="5" stroke-linecap="round"/><path class="mc-m" d="M70 70V22" stroke="#1d2b36" stroke-width="3.5" stroke-linecap="round"/><circle cx="70" cy="70" r="5" fill="#c8321e"/></svg>', 'mc-clock');
    const tick = () => {
      const d = new Date();
      hands.querySelector('.mc-h')?.setAttribute('transform', `rotate(${(d.getHours() % 12) * 30 + d.getMinutes() / 2} 70 70)`);
      hands.querySelector('.mc-m')?.setAttribute('transform', `rotate(${d.getMinutes() * 6} 70 70)`);
    };
    tick();
    every(20000, tick);
    const pic = data ? photoOfTheDay(data) : null;
    const status = data?.site?.status ? h('div', { class: 'mc-note' }, String(data.site.status)) : null;
    add(h('aside', { class: 'mc-gadgets', 'aria-label': 'Gadgets' }, hands, pic ? h('div', { class: 'mc-slides' }, pic) : null, status));
  }
  if (kind === 'terminal') {
    const s = data?.site || {};
    const row = (k, v) => (v ? h('div', null, h('b', null, k.padEnd(8, ' ')), String(v)) : null);
    add(
      h(
        'pre',
        { class: 'mc-fetch', 'aria-hidden': 'true' },
        h('span', { class: 'mc-art' }, '      .-~~~-.\n  .- ~       ~ -.\n (    ~~   ~~    )\n~~~~~~~~~~~~~~~~~~~\n  ~~~   ~~~~   ~~\n~~~~~~~~~~~~~~~~~~~'),
        h('span', { class: 'mc-info' }, h('div', { class: 'mc-who' }, `you@${name().toLowerCase().replace(/[^a-z0-9]+/g, '') || 'site'}`), h('div', null, '--------------'), row('site', name()), row('status', s.status), row('posts', (data?.posts || []).length), row('shell', 'floppy'), h('div', { class: 'mc-palette' }, h('i'), h('i'), h('i'), h('i'), h('i'), h('i'), h('i')))
      )
    );
  }
}

// ---------- the sound, seen ----------
// Speakers pulse, needles swing, the drive light flickers and the deck's reels turn.
function hearSounds() {
  let fade = 0;
  on(document, 'sitesound', (e) => {
    const level = Math.max(0.25, e.detail?.level || 0.5);
    root.style.setProperty('--mc-level', level.toFixed(2));
    root.classList.add('mc-playing');
    clearTimeout(fade);
    fade = setTimeout(() => {
      root.classList.remove('mc-playing');
      root.style.setProperty('--mc-level', '0');
    }, 260);
  });
}

// ---------- phones ----------
// The flip phone: five dome lights along the top (a new post since this visit's last, a friend
// online, a friend posted today, sounds on, power), and, once a visit, the phone closed: tap it
// and it flips open onto the site.
function flipPhone() {
  const posts = data?.posts || [];
  const newest = posts.reduce((n, p) => Math.max(n, p.ts || 0), 0);
  const seen = Number(keep('mc-seen')) || 0;
  if (newest) keep('mc-seen', newest);
  const today = new Date().toDateString();
  const lit = {
    post: !!seen && newest > seen,
    online: (data?.buddies || []).some((b) => b.presence && b.presence !== 'offline'),
    friend: (data?.friendPosts || []).some((p) => p.ts && new Date(p.ts).toDateString() === today),
    sound: !isMuted()
  };
  const say = { post: 'Something new since you were last here', online: 'A friend is online', friend: 'A friend posted today', sound: 'Sounds are on', power: 'Power' };
  const domes = () => ['post', 'online', 'friend', 'sound', 'power'].map((k) => h('span', { class: `mc-dome mc-dome-${k}` + (k === 'power' || lit[k] ? ' on' : ''), title: say[k] + (k === 'power' || lit[k] ? '' : ': not now') }));
  const lights = h('div', { class: 'mc-domes' }, domes());
  on(document, 'mutechange', () => {
    lit.sound = !isMuted();
    lights.replaceChildren(...domes());
  });
  const summary = Object.entries(lit).filter(([, v]) => v).map(([k]) => say[k]);
  const bar = h('div', { class: 'mc-flipbar', role: 'img', 'aria-label': `Five lights: ${summary.length ? summary.join(', ') : 'nothing new'}` }, h('span', { class: 'mc-earpiece' }), lights);
  document.body.prepend(bar);
  parts.push(bar);
  let flipped = false;
  try {
    flipped = sessionStorage.getItem('mc-flipped') === '1';
  } catch {}
  if (flipped) return;
  const outer = h('div', { class: 'mc-outer' }, h('div', { class: 'mc-outer-top' }, h('span', { class: 'mc-bars', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')), h('span', { class: 'mc-batt', 'aria-hidden': 'true' })), h('div', { class: 'mc-outer-time' }, clockText()));
  const lid = h(
    'button',
    { type: 'button', class: 'mc-lid', 'aria-label': `Open ${name()}` },
    h('span', { class: 'mc-hinge-band' }),
    outer,
    h('span', { class: 'mc-domes' }, domes()),
    h('span', { class: 'mc-lid-name' }, name()),
    h('span', { class: 'mc-lid-hint' }, 'Tap to flip open')
  );
  const closed = h('div', { class: 'mc-closed' }, lid);
  lid.addEventListener('click', () => {
    try {
      sessionStorage.setItem('mc-flipped', '1');
    } catch {}
    closed.classList.add('open');
    setTimeout(() => closed.remove(), 700);
  });
  document.body.append(closed);
  parts.push(closed);
  setTimeout(() => lid.focus(), 50);
}

// The handheld: the phone's screen in four shades of green, with a direction pad (scrolls), A
// (opens the menu), B (back), Select (sound on or off) and Start (home) underneath.
function handheld() {
  const scroller = () => {
    const all = [document.scrollingElement, ...document.querySelectorAll('#app *')].filter((el) => el && el.scrollHeight > el.clientHeight + 20 && (el === document.scrollingElement || /auto|scroll/.test(getComputedStyle(el).overflowY)));
    return all.sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement;
  };
  const press = (fn) => (e) => {
    e.preventDefault();
    fn();
  };
  const scroll = (dy) => scroller().scrollBy({ top: dy * Math.max(120, innerHeight * 0.35), behavior: 'smooth' });
  const openMenu = () => {
    const b = [...document.querySelectorAll('#app .start-btn, #app [aria-haspopup="true"]')].find((x) => x.offsetParent);
    b?.click();
  };
  const dir = (cls, label, act) => h('button', { type: 'button', class: 'mc-dpad-' + cls, 'aria-label': label, onclick: press(act) });
  const pill = (label, act) => h('button', { type: 'button', class: 'mc-pill', onclick: press(act) }, label);
  const round = (letter, label, act) => h('button', { type: 'button', class: 'mc-ab mc-ab-' + letter.toLowerCase(), 'aria-label': label, onclick: press(act) }, letter);
  const deck = h(
    'div',
    { class: 'mc-hand', role: 'group', 'aria-label': 'Controls' },
    h('div', { class: 'mc-hand-row' }, h('div', { class: 'mc-dpad' }, dir('up', 'Scroll up', () => scroll(-1)), dir('left', 'Back', () => history.back()), h('span', { class: 'mc-dpad-mid', 'aria-hidden': 'true' }), dir('right', 'Forward', () => history.forward()), dir('down', 'Scroll down', () => scroll(1))), h('div', { class: 'mc-abs' }, round('B', 'B: back', () => history.back()), round('A', 'A: open the menu', openMenu))),
    h('div', { class: 'mc-hand-row mc-hand-low' }, pill('Select', () => setMuted(!isMuted())), pill('Start', () => (location.hash = '#/')), h('span', { class: 'mc-hand-grille', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i')))
  );
  document.body.append(deck);
  parts.push(deck);
}

// ---------- putting it together ----------
function build() {
  // (On a phone there's no case, but every app still takes the computer's look: see kit.css.)
  const machine = root.dataset.skMachine || 'none';
  const cased = desktop && machine !== 'none';
  const handset = desktop ? 'none' : root.dataset.skHandset || 'none';
  const sig = `${machine}|${handset}`;
  if (sig === built) return;
  // (Whatever the last one put up comes down first.)
  for (const el of parts) el.remove();
  for (const stop of timers) stop();
  parts = [];
  timers = [];
  built = sig;
  root.classList.toggle('mc-case', cased && CASES.has(machine));
  root.classList.toggle('mc-on', machine !== 'none');
  root.classList.toggle('mc-flip', handset === 'flip');
  root.classList.toggle('mc-handheld', handset === 'handheld');
  if (cased) {
    paintBrightness();
    if (CASES.has(machine)) {
      const kase = h('div', { class: `mc-body mc-body-${machine}` }, caseFor(machine));
      document.body.prepend(kase);
      parts.push(kase);
    }
    const desk = document.querySelector('.desktop');
    if (desk) {
      insideFor(machine, desk);
      if (CASES.has(machine)) {
        const glass = h('div', { class: 'mc-screen', 'aria-hidden': 'true' });
        desk.append(glass);
        parts.push(glass);
      }
    }
    hearSounds();
  }
  if (handset === 'flip') flipPhone();
  if (handset === 'handheld') {
    handheld();
    hearSounds();
  }
}

export function startMachine(d, isDesktop) {
  data = d;
  desktop = !!isDesktop;
  build();
  // (A new theme, or one being tried in Themes, can bring a different machine.)
  if (!startMachine.watching) {
    startMachine.watching = true;
    new MutationObserver(() => build()).observe(root, { attributes: true, attributeFilter: ['data-sk-machine', 'data-sk-handset'] });
  }
}
