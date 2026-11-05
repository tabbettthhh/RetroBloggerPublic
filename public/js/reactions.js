// Reactions: a ♥, a ☆ or a smile under a post, from anyone, in one tap (and tapped again, taken
// back). Only how many of each is kept on the site; which ones you gave is remembered in your own
// browser, never on the site.
import { h, storage } from './util.js';
import { emoticonSvg } from './emoticons.js';
import { sound } from './sound.js';
import { ownerHooks } from './owner-door.js';

export const REACTIONS = [
  ['heart', 'Love it'],
  ['star', 'Brilliant'],
  ['grin', 'Made me smile']
];
const store = storage('local');
const keyOf = (post, key) => key || `react:${post.type}/${post.slug}`;
function mine(post, key) {
  try {
    const v = JSON.parse(store?.getItem(keyOf(post, key)) || 'null');
    return v && typeof v === 'object' ? v : { gave: [], counts: {}, at: 0 };
  } catch {
    return { gave: [], counts: {}, at: 0 };
  }
}
function keep(post, v, key) {
  try {
    store?.setItem(keyOf(post, key), JSON.stringify(v));
  } catch {}
}

// Whether the site has them on (set each time the site's content arrives).
let siteOn = true;
export function reactionsSetting(data) {
  siteOn = data?.site?.reactions !== false;
}
// A dozen to pick from straight away (any other one can be typed).
const PICKS = ['😂', '🥹', '😍', '🥰', '😮', '😢', '😭', '😅', '🤔', '🙌', '👏', '🙏', '💯', '🔥', '✨', '🎉', '👀', '💀', '🤍', '💛', '🌸', '☕', '🍕', '✈️', '📚', '🎵', '🌙', '🌈', '🍀', '🐶', '🐱', '😴'];
// The same test as the site's: one emoji, not words, not a flag.
const ONE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:️|\p{Emoji_Modifier}|‍(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})️?)*$/u;
export function oneEmoji(s) {
  const t = String(s ?? '').trim();
  if (!t || t.length > 16 || !ONE.test(t) || /[\u{1F1E6}-\u{1F1FF}]/u.test(t)) return '';
  try {
    if ([...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(t)].length !== 1) return '';
  } catch {}
  return t;
}

// The row: the three, any emoji visitors have added, and ＋ to add one. `data`: the site's, if to
// hand (reactions can be switched off); `cls`: where it sits. `via`: a friend's post, signed in
// ({ key: where your taps are remembered, send(reaction): sends it through your site to theirs,
// answering with their new counts}); shown only while their site has reactions on.
export function reactionRow(post, data = null, cls = '', via = null) {
  if (!post) return null;
  if (via ? !post.reactions : post.friend || post.fromFriend || post.friend_look || !(data ? data.site?.reactions !== false : siteOn)) return null;
  const me = mine(post, via?.key);
  // (The site's numbers are refreshed every few minutes: just after you've reacted, your own
  // tap still counts in what you see.)
  const fresh = Date.now() - (me.at || 0) < 10 * 60 * 1000;
  const counts = Object.fromEntries(REACTIONS.map(([k]) => [k, Math.max(post.reactions?.[k] || 0, fresh ? me.counts?.[k] || 0 : 0)]));
  for (const [e, n] of Object.entries(post.reactions?.custom || {})) counts['c:' + e] = n;
  if (fresh) for (const [k, n] of Object.entries(me.counts || {})) if (k.startsWith('c:')) counts[k] = Math.max(counts[k] || 0, n);
  const row = h('span', { class: `react-row ${cls}`, role: 'group', 'aria-label': 'Reactions' });
  let picker = null;
  const button = (k, label, face) => {
    const on = me.gave.includes(k);
    const b = h('button', { type: 'button', class: 'react-btn' + (on ? ' on' : '') + (k.startsWith('c:') ? ' own' : ''), 'aria-pressed': String(on), title: on ? `${label} (tap to take it back)` : label, 'aria-label': `${label}: ${counts[k] || 0}`, 'data-k': k }, face, counts[k] ? h('span', { class: 'react-n' }, String(counts[k])) : null);
    b.addEventListener('click', (e) => give(e, k));
    return b;
  };
  const draw = () => {
    const own = Object.keys(counts).filter((k) => k.startsWith('c:') && counts[k] > 0).sort((a, b) => counts[b] - counts[a]);
    const remove = via ? null : ownerHooks.removeReaction;
    row.replaceChildren(
      ...REACTIONS.map(([k, label]) => button(k, label, h('span', { class: 'react-ico', 'aria-hidden': 'true', html: emoticonSvg(k, 16) }))),
      ...own.map((k) => {
        const b = button(k, k.slice(2), h('span', { class: 'react-emoji', 'aria-hidden': 'true' }, k.slice(2)));
        // (Signed in: an emoji you don't want, taken off.)
        if (!remove) return b;
        const x = h('button', { type: 'button', class: 'react-x', title: `Take ${k.slice(2)} off this post`, 'aria-label': `Take ${k.slice(2)} off this post` }, '×');
        x.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (await remove(post, k.slice(2))) {
            delete counts[k];
            draw();
          }
        });
        return h('span', { class: 'react-own' }, b, x);
      }),
      (() => {
        const add = h('button', { type: 'button', class: 'react-btn react-add', title: 'Add an emoji', 'aria-label': 'Add an emoji', 'aria-haspopup': 'dialog', 'aria-expanded': String(!!picker) }, '＋', h('span', { class: 'react-add-face', 'aria-hidden': 'true' }, '☺'));
        add.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          picker ? shut() : open();
        });
        return add;
      })()
    );
  };
  const shut = () => {
    picker?.remove();
    picker = null;
    document.removeEventListener('click', away, true);
    removeEventListener('scroll', place, true);
    removeEventListener('resize', place);
    draw();
  };
  const away = (e) => !picker?.contains(e.target) && !e.target.closest?.('.react-add') && shut();
  // (Over everything, by the ＋ (and following it as the page moves): a post's card would
  // otherwise cut it off.)
  const place = () => {
    if (!picker) return;
    const at = (row.querySelector('.react-add') || row).getBoundingClientRect();
    const w = picker.offsetWidth;
    const hgt = picker.offsetHeight;
    picker.style.left = `${Math.max(8, Math.min(at.left, innerWidth - w - 8))}px`;
    picker.style.top = `${at.bottom + 6 + hgt > innerHeight - 8 ? Math.max(8, at.top - hgt - 6) : at.bottom + 6}px`;
  };
  const open = () => {
    const typed = h('input', { class: 'react-type', maxlength: 16, placeholder: 'or type one', 'aria-label': 'Type an emoji', inputmode: 'text', autocomplete: 'off' });
    const note = h('small', { class: 'react-note', role: 'status' });
    const pickOne = (e) => {
      const em = oneEmoji(e);
      if (!em) {
        note.textContent = 'Just one emoji, please.';
        return;
      }
      shut();
      give(null, 'c:' + em);
    };
    typed.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), pickOne(typed.value)));
    typed.addEventListener('keydown', (e) => e.key === 'Escape' && shut());
    picker = h(
      'span',
      { class: 'react-pick', role: 'dialog', 'aria-label': 'Pick an emoji' },
      h('span', { class: 'react-grid' }, PICKS.map((em) => h('button', { type: 'button', class: 'react-pick-btn', 'aria-label': em, onclick: (e) => (e.stopPropagation(), pickOne(em)) }, em))),
      h('span', { class: 'react-typed' }, typed, h('button', { type: 'button', class: 'react-pick-go', onclick: (e) => (e.stopPropagation(), pickOne(typed.value)) }, 'Add')),
      note
    );
    picker.addEventListener('click', (e) => e.stopPropagation());
    draw();
    document.body.append(picker);
    place();
    setTimeout(() => {
      document.addEventListener('click', away, true);
      addEventListener('scroll', place, true);
      addEventListener('resize', place);
    }, 0);
  };
  let busy = false;
  const give = async (e, k) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (busy) return;
    busy = true;
    const undo = me.gave.includes(k);
    // (Shown straight away; put back if the site says no.)
    const before = { gave: [...me.gave], counts: { ...counts } };
    me.gave = undo ? me.gave.filter((x) => x !== k) : [...me.gave, k];
    counts[k] = Math.max(0, (counts[k] || 0) + (undo ? -1 : 1));
    draw();
    if (!undo) {
      sound.click?.();
      [...row.querySelectorAll('.react-btn')].find((b) => b.dataset.k === k)?.classList.add('pop');
    }
    try {
      const custom = k.startsWith('c:');
      const ask = { kind: custom ? 'custom' : k, emoji: custom ? k.slice(2) : undefined, undo };
      let out;
      if (via) out = await via.send(ask);
      else {
        const r = await fetch('/api/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post: `${post.type}/${post.slug}`, ...ask }) });
        out = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(out.error || 'That didn’t go through.');
      }
      for (const [x] of REACTIONS) counts[x] = out.counts?.[x] ?? counts[x];
      for (const x of Object.keys(counts)) if (x.startsWith('c:')) delete counts[x];
      for (const [em, n] of Object.entries(out.counts?.custom || {})) counts['c:' + em] = n;
      keep(post, { gave: me.gave, counts, at: Date.now() }, via?.key);
    } catch (err) {
      me.gave = before.gave;
      for (const x of Object.keys(counts)) delete counts[x];
      Object.assign(counts, before.counts);
      row.title = err.message;
    }
    draw();
    busy = false;
  };
  draw();
  return row;
}
