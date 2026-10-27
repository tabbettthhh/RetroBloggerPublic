// Floppy, the search helper: a little floppy disk who pops up when someone opens search and
// is cheerfully, confidently useless. Purely for fun: nothing is sent anywhere.
import { h } from './util.js';
import { GENERAL, categoryLines } from './floppy-lines.js';
import { catLabel } from './util.js';
import { activeSkin, CHARMS, inks, mix } from './skins.js';
import { dressFloppy, outfitFor } from './floppy-look.js';

// Floppy's everyday lines live in floppy-lines.js, with the rest of what he says.
export const LINES = GENERAL;

const TYPING = [
  (q) => `“${q}”? Bold choice.`,
  (q) => `Ooh, “${q}”. I would never have thought of that.`,
  (q) => `I've written “${q}” on a sticky note. I've lost the sticky note.`,
  (q) => `Spelling “${q}” right is optional. I believe in you.`,
  (q) => `“${q}”… that rings a bell. No, that was the dial-up.`,
  (q) => `Searching for “${q}” on all 1.44 MB of me… nothing. Classic.`,
  () => 'Keep typing, you are doing amazing.',
  () => 'Hmm. Hmm hmm. Hmm. (I have nothing.)'
];

const NOTHING = ['Nothing? Have you tried searching for something that is here?', 'No results. I blame the modem.', 'Nothing found. Maybe it is in another castle.'];
const FOUND = ['Look at that, results! I had nothing to do with it.', 'Results! You are welcome. (I did not help.)', 'Found some. I was about to say that.'];

// ---------- gossip about recent posts ----------

const DAY = 86400000;
function ago(ts) {
  const d = Math.floor((Date.now() - ts) / DAY);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 14) return 'last week';
  return `${Math.round(d / 7)} weeks ago`;
}
const q = (t) => `“${t.length > 40 ? t.slice(0, 40) + '…' : t}”`;
const starsWord = (n) => (n === 1 ? '1 star' : `${n} stars`);

// A handful of things Floppy might say about one post. Each returns text, or nothing if it doesn't fit.
function postLines(p, who) {
  const t = p.title ? q(p.title) : '';
  const when = ago(p.ts);
  const r = p.rating;
  const out = [];
  if (p.pinned) out.push(`${who} pinned ${t || 'something'} to the top. I'm not allowed to touch it.`);
  switch (p.type) {
    case 'thoughts':
      out.push(`${who} had a thought ${when}. I had one in 1997. It was about lunch.`);
      out.push(`There's a fresh thought from ${when}. Deep stuff. Probably. I can't read.`);
      break;
    case 'places':
      if (t && r) out.push(`${t}${p.city ? ` in ${p.city}` : ''} got ${starsWord(r)}. I've never left this computer, so I'll trust it.`);
      if (t) out.push(`${who} went to ${t} ${when}. Nobody invited me. Again.`);
      if (p.would_return) out.push(`${who} would go back to ${t || 'that place'}. I would go back to 1998.`);
      if (p.category) {
        const kind = categoryLines(p.category, catLabel(p.category));
        if (kind.length) out.push(kind[Math.floor(Math.random() * kind.length)]);
      }
      break;
    case 'photos':
      out.push(`New photos from ${when}! I'm in none of them. As usual.`);
      if (p.photos?.length > 1) out.push(`${p.photos.length} new photos. That's about ${p.photos.length * 3} of me, storage-wise.`);
      break;
    case 'lists':
      if (t) out.push(`New list: ${t}. I checked twice. I'm not on it.`);
      break;
    case 'quotes':
      out.push(`New quote from ${when}. I'd read it out, but I'd get it wrong.`);
      break;
    case 'books':
      if (t && p.state === 'now') out.push(`${who} is reading ${t}. I've been trying to read for years. I'm a disk.`);
      if (t && r) out.push(`${t} got ${starsWord(r)}. I judge books by their cover. It's a nice cover.`);
      if (t && p.state === 'want') out.push(`${t} is on the to-read pile. Like me, on the pile of old disks.`);
      break;
    case 'films':
      if (t && r) out.push(`${t} got ${starsWord(r)}. I'd watch it, but I don't have a screen. Or eyes. Well, I have eyes.`);
      if (t) out.push(`${who} watched ${t} ${when}. Spoiler: I don't know how it ends.`);
      break;
    case 'tv':
      if (t && p.state === 'now') out.push(`${who} is watching ${t}${p.season ? `, season ${p.season}` : ''}. I'm on season 0 of everything.`);
      if (t && r) out.push(`${t} got ${starsWord(r)}. Don't tell me what happens. I won't remember anyway.`);
      break;
    case 'music':
      if (t) out.push(`${who} has been listening to ${t}${p.creator ? ` by ${p.creator}` : ''}. I only play the dial-up tone.`);
      if (t && r === 5) out.push(`${t}: five stars. I hummed along. Floppies can't hum.`);
      break;
    case 'podcasts':
      if (t) out.push(`${who} is into ${t}. I'd prefer a podcast about defragmenting.`);
      break;
  }
  if (p.suggested_by) out.push(`${p.suggested_by} suggested ${t || 'that'}. Nobody ever asks what I'd suggest.`);
  // What you asked Floppy to say about this post, given extra weight.
  for (const line of p.floppy || []) out.push(line, line);
  return out;
}

const pick = (list, not) => {
  let x;
  do x = list[Math.floor(Math.random() * list.length)];
  while (list.length > 1 && x === not);
  return x;
};

// Remembered for this visit only, in the visitor's own browser.
const HIDE_KEY = 'floppy-hidden';
function hidden() {
  try {
    return sessionStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}
function remember() {
  try {
    sessionStorage.setItem(HIDE_KEY, '1');
  } catch {}
}

export const FLOPPY = `<svg viewBox="0 0 64 70" width="64" height="70" aria-hidden="true">
  <ellipse class="fl-shadow" cx="32" cy="66" rx="20" ry="3"/>
  <g class="fl-body">
    <path d="M6 4h44l8 8v46a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill="#2c4f9e" stroke="#1a2f63" stroke-width="1.5"/>
    <rect x="16" y="4" width="28" height="17" rx="1.5" fill="#c9ced6" stroke="#8b919b" stroke-width="1"/>
    <rect x="34" y="7" width="6" height="11" rx="1" fill="#4a505a"/>
    <rect x="12" y="30" width="40" height="28" rx="2" fill="#fbfaf3" stroke="#d6d2bf" stroke-width="1"/>
    <path d="M15 33h34M15 36.5h34" stroke="#e7a0a0" stroke-width=".8"/>
    <g class="fl-eyes">
      <ellipse cx="24.5" cy="44" rx="5" ry="5.6" fill="#fff" stroke="#222" stroke-width="1.2"/>
      <ellipse cx="39.5" cy="44" rx="5" ry="5.6" fill="#fff" stroke="#222" stroke-width="1.2"/>
      <circle class="fl-pupil" cx="25.5" cy="45" r="2.2" fill="#222"/>
      <circle class="fl-pupil" cx="40.5" cy="45" r="2.2" fill="#222"/>
      <path class="fl-lid" d="M19.5 44a5 5.6 0 0 1 10 0zM34.5 44a5 5.6 0 0 1 10 0z" fill="#2c4f9e"/>
    </g>
    <path d="M18.5 37.5l11-1.6M34.5 35.9l11 1.6" stroke="#222" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M27 53q5 3.4 10 0" fill="none" stroke="#222" stroke-width="1.4" stroke-linecap="round"/>
    <rect x="9" y="8" width="3" height="3" fill="#1a2f63"/>
  </g>
</svg>`;

// Floppy as the theme dresses him today: for the season or festive day, or in the owner's own
// outfit, and in the colour they picked (Themes > Floppy).
export function floppySvg() {
  const t = activeSkin();
  const f = t?.floppy;
  if (!f || (f.dress === 'off' && f.colour === 'classic')) return FLOPPY;
  const outfit = outfitFor(f.dress, f.own, t.today);
  const body = f.colour === 'theme' ? mix(t.main, '#000000', 0.15) : f.colour === 'own' ? f.hex : '';
  return dressFloppy(FLOPPY, outfit, { body, tint: outfit.tint || f.own?.tint || t.accent, today: t.today?.charm || '', charm: (name) => (CHARMS[name] ? CHARMS[name](inks(t)) : '') });
}

// The helper, ready to drop at the bottom of the search page.
// Returns { el, typed(query), results(count) } so search can poke him as people type.
export function floppy(data, hrefFor) {
  const quiet = { el: null, typed() {}, results() {} };
  if (hidden()) return quiet;

  // Gossip from the newest posts (the last couple of months, a dozen at most).
  const who = (data?.site?.owner || '').trim().split(/\s+/)[0] || 'Someone';
  const recent = (data?.posts || [])
    .filter((p) => !p.draft && p.ts && Date.now() - p.ts < 60 * DAY)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 12);
  const gossip = recent.flatMap((p) => postLines(p, who).map((text) => ({ text, href: hrefFor?.(p) })));
  if (recent[0]) gossip.push({ text: `The newest post is from ${ago(recent[0].ts)}. Still warm. Like me after a long copy.`, href: hrefFor?.(recent[0]) });
  // Half the time a joke, half the time gossip about a post (when there's any to share).
  // He also tries not to repeat anything from his last dozen lines.
  const said = [];
  const fresh = (list, key) => {
    const left = list.filter((x) => !said.includes(key(x)));
    return pick(left.length ? left : list);
  };
  const next = () => (gossip.length && Math.random() < 0.55 ? fresh(gossip, (g) => g.text) : { text: fresh(LINES, (x) => x) });

  let line = recent.length ? pick(gossip) : { text: pick(LINES) };
  let lastTalk = 0;
  const text = h('p', { class: 'fl-text' });
  const go = h('a', { class: 'fl-btn fl-go', href: '#/' }, 'Show me ›');
  const show = (l) => {
    text.textContent = l.text;
    go.hidden = !l.href;
    if (l.href) go.href = l.href;
  };
  show(line);
  said.push(line.text);
  const say = (s) => {
    line = typeof s === 'string' ? { text: s } : s;
    said.push(line.text);
    if (said.length > 12) said.shift();
    show(line);
    lastTalk = Date.now();
    el.classList.remove('talk');
    void el.offsetWidth; // restart the little hop
    el.classList.add('talk');
  };
  const another = () => say(next());
  const el = h(
    'div',
    { class: 'floppy talk', role: 'complementary', 'aria-label': 'Floppy, the not very helpful helper' },
    h(
      'div',
      { class: 'fl-balloon' },
      text,
      h(
        'div',
        { class: 'fl-actions' },
        go,
        h('button', { type: 'button', class: 'fl-btn', onclick: another }, 'Tell me another'),
        h(
          'button',
          {
            type: 'button',
            class: 'fl-btn',
            onclick: () => {
              remember();
              el.classList.add('bye');
              setTimeout(() => el.remove(), 350);
            }
          },
          'Go away, Floppy'
        )
      )
    ),
    h('button', { type: 'button', class: 'fl-disk', 'aria-label': 'Poke Floppy', title: 'Poke Floppy', html: floppySvg(), onclick: another })
  );

  // While people type he chips in now and then, never more than every few seconds.
  let timer;
  let pending = null;
  const typed = (q) => {
    clearTimeout(timer);
    const query = (q || '').trim();
    if (!query) return;
    timer = setTimeout(() => {
      if (!el.isConnected || Date.now() - lastTalk < 3500) return;
      if (pending != null && Math.random() < 0.5) {
        say(pick(pending ? FOUND : NOTHING));
      } else {
        const short = query.length > 24 ? query.slice(0, 24) + '…' : query;
        say(pick(TYPING)(short));
      }
      pending = null;
    }, 900);
  };
  const results = (n) => {
    pending = n > 0;
  };
  return { el, typed, results };
}
