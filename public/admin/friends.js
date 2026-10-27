// Friends, in the back office: a chat-style friends list of people who run their own copy
// of this site, and their latest posts. (Following only: there are no messages.)
import { h } from '/js/util.js';
import { withEmoticons } from '/js/emoticons.js';
import { friendHtml as cleanHtml } from '/js/friend-html.js';

const TYPE_WORD = { thoughts: 'Thought', places: 'Place', photos: 'Photos', lists: 'List', quotes: 'Quote', books: 'Book', films: 'Film', podcasts: 'Podcast', music: 'Music', tv: 'TV' };
const PRES = { online: ['Online', 'green'], away: ['Away', 'amber'], brb: 'Be right back', lunch: 'Out to lunch', busy: ['Busy', 'red'], offline: ['Offline', 'grey'] };
const presOf = (p) => {
  const v = PRES[p] || PRES.online;
  return Array.isArray(v) ? v : [v, 'amber'];
};
const HOUR = 60 * 60 * 1000;

let st = { data: null, open: null, showCode: false, adding: false, busy: false, error: '' };

const ago = (ts) => {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  const d = Math.round(m / 60 / 24);
  return d < 8 ? `${d} day${d === 1 ? '' : 's'} ago` : new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const photoUrl = (friend, key) => `/admin/api/friends/photo?friend=${encodeURIComponent(friend)}&p=${encodeURIComponent(key)}`;
// Reachable lately, and not set to offline: they go in "Online".
const isOn = (f) => f.cache?.feed && f.cache.ok !== false && f.cache.feed.presence !== 'offline' && Date.now() - (f.cache.at || 0) < 3 * HOUR;

// ---------- the page ----------

// ctx: { api, toast, refreshAll, me } (me: your own site settings)
export function viewFriends(ctx, openKey) {
  if (openKey) st.open = openKey;
  const wrap = h('div', { class: 'field friends' }, h('p', { class: 'loading' }, 'Loading your buddies…'));
  const redraw = () => {
    if (!wrap.isConnected && st.data) return;
    wrap.replaceChildren(...page(ctx, redraw).filter(Boolean));
  };
  (async () => {
    try {
      st.data = await ctx.api('friends');
      if (st.open && !st.data.friends.some((f) => f.key === st.open)) st.open = null;
      st.error = '';
    } catch (e) {
      st.error = e.message;
    }
    redraw();
  })();
  return wrap;
}

function page(ctx, redraw) {
  const d = st.data;
  if (!d) return [h('div', { class: 'info problem' }, h('strong', null, 'Couldn’t load your friends. '), st.error || '', h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => ctx.go() }, 'Try again')))];
  const act = async (fn, okMsg) => {
    if (st.busy) return;
    st.busy = true;
    try {
      const out = await fn();
      if (okMsg) ctx.toast(typeof okMsg === 'function' ? okMsg(out) : okMsg);
      st.data = await ctx.api('friends');
      if (st.open && !st.data.friends.some((f) => f.key === st.open)) st.open = null;
      st.busy = false;
      redraw();
      ctx.refreshAll().catch(() => {});
      return out;
    } catch (e) {
      st.busy = false;
      ctx.toast(e.message, true);
    }
  };
  const open = d.friends.find((f) => f.key === st.open) || null;
  return [
    h('div', { class: 'notes-head' }, h('div', null, h('h2', { class: 'section-title' }, 'Friends'), h('p', { class: 'hint' }, 'Follow friends who run their own copy of this site: see how they are and what they’ve posted.'))),
    addressNotice(ctx, d, act),
    h('div', { class: 'pal-wrap' + (open ? ' has-convo' : '') }, buddyWindow(ctx, d, act, redraw), open ? friendWindow(ctx, open, act, redraw) : null),
    privacyBox(ctx, d, act),
    feedSection(d),
    addressBox(ctx, d, act, redraw),
    howItWorks()
  ];
}

// ---------- who sees what ----------

const VIS = [
  ['all', 'Everyone', 'A Friends tab on your site with their posts, and your friends list on your About page.'],
  ['list', 'Just my friends list', 'Your friends’ names on your About page, linking to their sites. Their posts stay here, for you.'],
  ['off', 'Only me', 'Nothing about your friends on your site. You still see everything here.']
];
function privacyBox(ctx, d, act) {
  const post = (body, msg) => act(() => ctx.api('friends/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), msg);
  return h(
    'fieldset',
    { class: 'fr-privacy' },
    h('legend', null, 'Who sees your friends on your site?'),
    VIS.map(([id, label, hint]) =>
      h(
        'label',
        { class: 'fr-vis' + (d.visibility === id ? ' on' : '') },
        h('input', { type: 'radio', name: 'fr-vis', value: id, checked: d.visibility === id, onchange: () => post({ visibility: id }, id === 'all' ? 'Your friends’ posts now show on your site.' : id === 'list' ? 'Only your friends list shows on your site now.' : 'Your friends are private now: only you see them.') }),
        h('span', null, h('b', null, label), h('small', null, hint))
      )
    ),
    h(
      'label',
      { class: 'row check fr-share' },
      h('input', { type: 'checkbox', checked: d.letShare, onchange: (e) => post({ letShare: e.target.checked }, e.target.checked ? 'Friends may show your posts on their sites.' : 'Your posts now stay off your friends’ sites (they still see them in their back office).') }),
      h('span', null, h('b', null, 'Let friends show my posts on their sites. '), h('small', null, 'Untick it and your friends still see your posts in their own back office, but never show them to their visitors.'))
    )
  );
}

// ---------- your site's address ----------

const moveTo = (ctx, act, address) =>
  act(
    () => ctx.api('friends/address', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) }),
    (r) => (r.failed.length ? `Moved. ${r.told.length} told; couldn’t reach ${r.failed.join(', ')} yet (try Tell them again later).` : r.told.length === 1 ? 'Moved, and your friend knows.' : r.told.length ? `Moved, and all ${r.told.length} of your friends know.` : 'Your site’s address is set.')
  );

// When you're using the back office somewhere other than your site's address (a new domain,
// say), or some friends haven't heard you moved: said at the top, with the fix.
function addressNotice(ctx, d, act) {
  const notes = [];
  const local = (u) => /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u + '/');
  // (Not when you're trying things out on your own computer with your real site's friends.)
  if (d.here && d.me && d.here !== d.me && !(local(d.here) && !local(d.me))) {
    notes.push(
      h(
        'div',
        { class: 'info fr-move' },
        h('div', null, h('strong', null, 'Has your site moved? '), `You’re in the back office at ${d.here.replace(/^https?:\/\//, '')}, but your friends know your site as ${d.me.replace(/^https?:\/\//, '')}. If it now lives here, move it and your friends’ sites will follow.`),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small go', onclick: () => moveTo(ctx, act, d.here) }, `Move my site to ${d.here.replace(/^https?:\/\//, '')}`))
      )
    );
  }
  if (d.behind?.length) {
    notes.push(
      h(
        'div',
        { class: 'info fr-move' },
        h('div', null, h('strong', null, 'Not everyone knows you’ve moved. '), `${d.behind.join(', ')} still know${d.behind.length === 1 ? 's' : ''} your old address (their site couldn’t be reached). Everything still works meanwhile.`),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: () => act(() => ctx.api('friends/tell', { method: 'POST' }), (r) => (r.failed.length ? `Still couldn’t reach ${r.failed.join(', ')}.` : 'Everyone knows now.')) }, 'Tell them again'))
      )
    );
  }
  return notes.length ? h('div', { class: 'fr-notices' }, ...notes) : null;
}

function addressBox(ctx, d, act, redraw) {
  const input = h('input', { class: 'input', value: d.me || '', placeholder: 'https://my-site.example', 'aria-label': 'My site’s address', inputmode: 'url' });
  return h(
    'details',
    { class: 'fr-how fr-address' },
    h('summary', null, 'My site’s address'),
    h('p', null, `Your friends know your site as ${d.me ? d.me.replace(/^https?:\/\//, '') : '(set the first time you open Friends)'}. Your friend code carries this address. It stays put, even if you open the back office from another address.`),
    h('p', null, 'Moved your site (to a domain of your own, say)? Add the domain to your site in Cloudflare first, then put its address here. Visitors who go to your old address are sent to the new one, each friend’s site is told and follows, and the back office keeps opening at both. The README’s “Your own domain” has every step.'),
    h('div', { class: 'row' }, input, h('button', { type: 'button', class: 'btn small go', onclick: () => {
      const v = input.value.trim();
      if (!v || v.replace(/\/+$/, '') === d.me) return ctx.toast('That’s already your site’s address.');
      if (!confirm(`Move your site to ${v}? Your friends’ sites will be told.`)) return;
      moveTo(ctx, act, v);
    } }, 'Move my site here'))
  );
}

// ---------- the friends list ----------

function buddyWindow(ctx, d, act, redraw) {
  const me = ctx.me();
  const [myWord, myDot] = presOf(me.presence);
  const on = d.friends.filter(isOn);
  const off = d.friends.filter((f) => !isOn(f));
  const row = (f) => {
    const feed = f.cache?.feed;
    const [word, dot] = isOn(f) ? presOf(feed.presence) : ['Offline', 'grey'];
    return h(
      'li',
      null,
      h(
        'button',
        { type: 'button', class: 'buddy' + (st.open === f.key ? ' open' : ''), 'aria-pressed': String(st.open === f.key), onclick: () => { st.open = st.open === f.key ? null : f.key; redraw(); } },
        h('span', { class: `pres-dot ${dot}`, title: word }),
        h('span', { class: 'buddy-name' }, f.name, f.owner ? h('small', null, ` (${f.owner})`) : null),
        feed?.status ? h('span', { class: 'buddy-status' }, ' – ', withEmoticons(feed.status, 15)) : null
      )
    );
  };
  const group = (label, list) => h('div', { class: 'buddy-group' }, h('div', { class: 'buddy-group-title' }, `▾ ${label} (${list.length})`), list.length ? h('ul', { class: 'buddy-list' }, list.map(row)) : null);
  return h(
    'section',
    { class: 'pal-win', 'aria-label': 'Your buddies' },
    h('div', { class: 'pal-title' }, h('span', { class: 'pal-logo', 'aria-hidden': 'true' }), 'Buddies'),
    h('div', { class: 'pal-me' }, h('span', { class: `pres-dot ${myDot}` }), h('b', null, me.owner || me.name), h('small', null, ` (${myWord})`), me.status ? h('div', { class: 'pal-mystatus' }, withEmoticons(me.status, 15)) : null),
    h(
      'div',
      { class: 'pal-actions' },
      h('button', { type: 'button', class: 'btn small', 'aria-expanded': String(st.adding), onclick: () => { st.adding = !st.adding; redraw(); } }, '➕ Add a friend'),
      h('button', { type: 'button', class: 'btn small', 'aria-expanded': String(st.showCode), onclick: () => act(async () => {
        // (Asking for it makes one the first time.)
        if (!st.showCode && !d.code && !d.codeOff) Object.assign(d, await ctx.api('friends/invite', { method: 'POST' }));
        st.showCode = !st.showCode;
      }) }, '🔑 My friend code'),
      d.friends.length ? h('button', { type: 'button', class: 'btn small', onclick: () => act(() => ctx.api('friends/refresh', { method: 'POST' }), (r) => (r.reached === r.of ? 'Up to date.' : `Reached ${r.reached} of ${r.of} friends’ sites.`)) }, '↻ Check now') : null
    ),
    st.showCode ? codeBox(ctx, d, act) : null,
    st.adding ? addBox(ctx, act, redraw) : null,
    d.friends.length ? [group('Online', on), group('Offline', off)] : h('p', { class: 'hint pal-empty' }, 'No buddies yet. Send a friend your friend code, or paste theirs with Add a friend.')
  );
}

function codeBox(ctx, d, act) {
  const post = (action, msg) => act(() => ctx.api('friends/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }), msg);
  if (!d.code) {
    return h(
      'div',
      { class: 'fr-box' },
      h('p', { class: 'hint' }, 'Your friend code is switched off, so nobody new can add you. Friends you already have stay friends.'),
      h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn small go', onclick: () => post('on', 'Your friend code is on.') }, 'Switch it on'))
    );
  }
  const box = h('textarea', { class: 'input fr-code', readonly: true, rows: 3, 'aria-label': 'Your friend code' }, d.code);
  return h(
    'div',
    { class: 'fr-box' },
    h('p', { class: 'hint' }, 'Send this to anyone you want as a friend (a message, an email). When they paste it into Add a friend on their site, you’re buddies. It stays the same and never runs out; switch it off or swap it for a new one whenever you like.'),
    box,
    h(
      'div',
      { class: 'row end' },
      h('button', { type: 'button', class: 'btn small', onclick: () => {
        if (!confirm('Make a new friend code? The old one stops working straight away. Friends you already have stay friends.')) return;
        post('new', 'New friend code made. The old one no longer works.');
      } }, 'Make a new code'),
      h('button', { type: 'button', class: 'btn small', onclick: () => post('off', 'Your friend code is switched off.') }, 'Switch it off'),
      h('button', { type: 'button', class: 'btn small go', onclick: async () => {
        try {
          await navigator.clipboard.writeText(d.code);
          ctx.toast('Copied. Now send it to your friend.');
        } catch {
          box.select();
          ctx.toast('Select it and copy it yourself.');
        }
      } }, 'Copy')
    )
  );
}

function addBox(ctx, act, redraw) {
  const input = h('textarea', { class: 'input fr-code', rows: 3, placeholder: 'MYCORNER-…', 'aria-label': 'Your friend’s code' });
  return h(
    'div',
    { class: 'fr-box' },
    h('p', { class: 'hint' }, 'Paste the friend code your friend sent you.'),
    input,
    h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn small go', onclick: async () => {
      const code = input.value.trim();
      if (!code) return ctx.toast('Paste their friend code first.', true);
      const out = await act(() => ctx.api('friends/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }), (r) => `${r.name} is now your buddy.`);
      if (out) {
        st.adding = false;
        redraw();
      }
    } }, 'Add'))
  );
}

// ---------- one friend ----------

function friendWindow(ctx, f, act, redraw) {
  const feed = f.cache?.feed;
  const [word, dot] = isOn(f) ? presOf(feed.presence) : ['Offline', 'grey'];
  const posts = feed?.posts || [];
  return h(
    'section',
    { class: 'pal-win pal-convo', 'aria-label': f.name },
    h('div', { class: 'pal-title' }, h('span', { class: 'pal-logo', 'aria-hidden': 'true' }), f.name, h('button', { type: 'button', class: 'pal-close', 'aria-label': 'Close', onclick: () => { st.open = null; redraw(); } }, '×')),
    h(
      'div',
      { class: 'pal-to' },
      h('div', null, h('span', { class: `pres-dot ${dot}` }), h('b', null, feed?.owner || f.owner || f.name), h('small', null, ` (${word})`), ' ', h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, f.url.replace(/^https?:\/\//, '') + ' ↗')),
      feed?.status ? h('div', { class: 'pal-theirstatus' }, withEmoticons(feed.status, 15), feed.status_updated ? h('small', null, ` · ${ago(feed.status_updated)}`) : null) : null,
      f.cache && f.cache.ok === false ? h('div', { class: 'hint warn' }, `Couldn’t reach their site ${ago(f.cache.tried)}. Showing what it said ${ago(f.cache.at) || 'before'}.`) : null,
      !f.cache ? h('div', { class: 'hint' }, 'Not checked yet: tap Check now.') : null
    ),
    h('div', { class: 'pal-posts' }, posts.length ? posts.slice(0, 10).map((p) => postCard(f, p, feed)) : h('p', { class: 'hint' }, 'No posts yet.')),
    h(
      'div',
      { class: 'row end pal-foot' },
      h('small', { class: 'hint' }, `Buddies since ${new Date(f.since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`),
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn small danger', onclick: () => {
        if (!confirm(`Remove ${f.name} from your buddies? Your two sites stop following each other. You can be buddies again any time with a friend code.`)) return;
        st.open = null;
        act(() => ctx.api('friends/remove?friend=' + encodeURIComponent(f.key), { method: 'POST' }), `${f.name} is no longer a buddy.`);
      } }, 'Remove buddy')
    )
  );
}

// ---------- their posts ----------

function postCard(f, p, feed) {
  return h(
    'article',
    { class: 'fr-post' },
    h('div', { class: 'fr-post-top' }, h('b', null, feed?.name || f.name), ` · ${TYPE_WORD[p.type] || 'Post'} · ${ago(p.ts)}`),
    p.title ? h('h3', null, p.title) : null,
    p.creator || p.city || p.rating != null ? h('div', { class: 'fr-post-meta' }, [p.creator, p.city, p.rating != null ? '★'.repeat(Math.max(0, Math.min(5, Math.round(p.rating)))) || '' : ''].filter(Boolean).join(' · ')) : null,
    p.photos.length ? h('div', { class: 'fr-photos' }, p.photos.map((k) => h('img', { src: photoUrl(f.key, k), alt: '', loading: 'lazy' }))) : null,
    cleanHtml(p.html),
    h('a', { class: 'fr-open', href: p.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open on their site ↗')
  );
}

function feedSection(d) {
  const all = [];
  for (const f of d.friends) for (const p of f.cache?.feed?.posts || []) all.push([f, p]);
  all.sort((a, b) => b[1].ts - a[1].ts);
  if (!d.friends.length) return null;
  return h(
    'section',
    { class: 'fr-feed' },
    h('h2', { class: 'section-title' }, 'Your friends’ posts'),
    all.length ? all.slice(0, 20).map(([f, p]) => postCard(f, p, f.cache.feed)) : h('p', { class: 'hint' }, 'Nothing yet. Their newest posts show up here (they arrive moments after your friends post; your site also checks every 10 minutes, or tap Check now).')
  );
}

function howItWorks() {
  return h(
    'details',
    { class: 'fr-how' },
    h('summary', null, 'How friends work'),
    h('p', null, 'You and a friend each run your own copy of this site. Copy your friend code, send it to them, and they paste it into Add a friend on theirs (or the other way round). From then on your two sites trust each other. Your code stays the same for everyone; switch it off or make a new one whenever you like.'),
    h('p', null, 'Your friends’ sites tell yours the moment they post or change their status, and your site checks theirs every 10 minutes as well. Their photos come through your own site, so your browser never connects to theirs. Drafts and scheduled posts are never shared.'),
    h('p', null, 'Your site also gets a Friends tab: their posts as one feed you can scroll, with your friends listed at the top. Untick the box above to take it off your site.'),
    h('p', null, 'It’s following only: there are no messages. Remove a buddy and both sites stop following each other.')
  );
}
