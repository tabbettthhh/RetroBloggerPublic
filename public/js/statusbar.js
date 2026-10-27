// The Messenger-style status: presence dot, personal message with emoticons, when it was
// updated, what's playing (from the shelves), a countdown, past statuses and a nudge.
import { h, storage } from './util.js';
import { withEmoticons, emoticonSvg } from './emoticons.js';
import { SHELF_ICON } from './shelves.js';
import { sound } from './sound.js';
import { word } from './skins.js';

export const PRESENCE = {
  online: ['Online', 'green'],
  away: ['Away', 'amber'],
  brb: ['Be right back', 'amber'],
  lunch: ['Out to lunch', 'amber'],
  busy: ['Busy', 'red'],
  offline: ['Offline', 'grey']
};

export function presenceDot(site, cls = '') {
  const [label, colour] = PRESENCE[site.presence] || PRESENCE.online;
  return h('span', { class: `online-dot dot-${colour} ${cls}`, role: 'img', 'aria-label': label, title: label });
}

export function ago(ts, now = Date.now()) {
  if (!ts) return '';
  const m = Math.round((now - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const hrs = Math.round(m / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const d = Math.round(hrs / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// "12 days until Lisbon". Gone once the day has passed.
export function countdownText(cd, now = new Date()) {
  if (!cd) return null;
  const [y, m, d] = cd.date.split('-').map(Number);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
  if (days < 0) return null;
  if (days === 0) return `Today: ${cd.label}!`;
  if (days === 1) return `1 day until ${cd.label}`;
  return `${days} days until ${cd.label}`;
}

// Things marked as "now" on the shelves, newest first.
const NOW_WORDS = { music: 'Listening to', podcasts: 'Listening to', tv: 'Watching', films: 'Watching', books: 'Reading' };
export function nowPlaying(data) {
  if (data.site.now_playing === false) return [];
  return data.posts
    .filter((p) => NOW_WORDS[p.type] && p.state === 'now' && p.title)
    .slice(0, 6)
    .map((p) => {
      let extra = '';
      if (p.type === 'tv') {
        const se = String(p.season || '').trim();
        const ep = String(p.episode || '').trim();
        extra = /^\d+$/.test(se) && /^\d+$/.test(ep) ? ` · S${se} E${ep}` : /^\d+$/.test(ep) ? ` · episode ${ep}` : '';
      } else if (p.type === 'music' && p.creator) extra = ` · ${p.creator}`;
      else if (p.type === 'books' && p.page) extra = p.pages ? ` · p. ${p.page}/${p.pages}` : ` · p. ${p.page}`;
      return { type: p.type, words: NOW_WORDS[p.type], title: p.title, extra, href: `#/${p.type}/${p.slug}` };
    });
}

function nowLine(data) {
  const items = nowPlaying(data);
  if (!items.length) return null;
  const line = h('a', { class: 'now-line' });
  let i = 0;
  const show = () => {
    const it = items[i % items.length];
    line.href = it.href;
    line.replaceChildren(h('span', { class: 'now-ico', html: SHELF_ICON[it.type] || '' }), h('span', { class: 'now-text' }, h('em', null, it.words + ' '), it.title, it.extra));
    line.classList.remove('flip');
    void line.offsetWidth;
    line.classList.add('flip');
  };
  show();
  if (items.length > 1) {
    const timer = setInterval(() => {
      if (!line.isConnected) return clearInterval(timer);
      i++;
      show();
    }, 4500);
  }
  return line;
}

// ---------- nudge ----------

const session = storage('session');
function shake(from) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // The window the button is in on a computer, or the whole phone screen.
  const target = from.closest('.dw') || from.closest('[class*="-phone"]') || document.body;
  target.classList.remove('nudge-shake');
  void target.offsetWidth;
  target.classList.add('nudge-shake');
  setTimeout(() => target.classList.remove('nudge-shake'), 700);
}

function nudgeButton(site) {
  const who = site.owner || 'them';
  const btn = h('button', { type: 'button', class: 'nudge-btn', title: `Send ${who} a nudge` });
  const idle = () => btn.replaceChildren(h('span', { class: 'nudge-ico', 'aria-hidden': 'true' }), word('nudge', 'Nudge'));
  const wait = Number(session.getItem('nudged') || 0) + 30000 - Date.now();
  idle();
  if (wait > 0) {
    btn.disabled = true;
    btn.replaceChildren('Nudged!');
    setTimeout(() => ((btn.disabled = false), idle()), wait);
  }
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    btn.disabled = true;
    shake(btn);
    sound.nudge();
    btn.replaceChildren('Nudged!');
    session.setItem('nudged', String(Date.now()));
    try {
      const r = await fetch('/api/nudge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        btn.replaceChildren(j.error ? 'Try later' : 'Didn’t send');
      }
    } catch {
      btn.replaceChildren('Didn’t send');
    }
    setTimeout(() => ((btn.disabled = false), idle()), 30000);
  });
  return btn;
}

// ---------- the whole block, for the profile tile ----------

export function statusBlock(data) {
  const site = data.site;
  const [label, colour] = PRESENCE[site.presence] || PRESENCE.online;
  const history = site.history || [];
  const cd = countdownText(site.countdown);
  const panel = history.length
    ? h(
        'div',
        { class: 'status-history', hidden: true },
        h('strong', null, 'Earlier'),
        h(
          'ol',
          null,
          history.map((e) => h('li', null, h('time', null, shortDate(e.date) + (e.time ? ' ' + e.time : '')), h('span', null, withEmoticons(e.text, 15))))
        )
      )
    : null;
  const pillInner = [
    presenceDot(site),
    site.presence !== 'online' ? h('b', { class: `presence-word p-${colour}` }, label + (site.status ? ' · ' : '')) : null,
    site.status ? h('span', { class: 'status-text' }, h('span', { class: 'status-cur' }, 'Currently: '), withEmoticons(site.status, 16)) : null,
    site.status_updated ? h('small', { class: 'status-ago' }, ago(site.status_updated)) : null,
    panel ? h('span', { class: 'status-more', 'aria-hidden': 'true' }, '▾') : null
  ].filter(Boolean);
  const pill = panel
    ? h('button', { type: 'button', class: 'status-pill clickable', 'aria-expanded': 'false', title: 'Show earlier statuses', onclick: () => {
        const open = panel.hidden;
        panel.hidden = !open;
        pill.setAttribute('aria-expanded', String(open));
        pill.classList.toggle('open', open);
      } }, pillInner)
    : h('span', { class: 'status-pill' }, pillInner);
  return h(
    'div',
    { class: 'status-block' },
    pill,
    panel,
    nowLine(data),
    cd ? h('span', { class: 'countdown' }, site.countdown.icon ? h('span', { class: 'emo-wrap', 'aria-hidden': 'true', html: emoticonSvg(site.countdown.icon, 16) }) : null, cd) : null
  );
}

export { nudgeButton };

function shortDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
