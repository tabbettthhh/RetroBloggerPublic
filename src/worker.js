// The whole server. It reads Markdown from the R2 bucket, serves the site,
// and runs the back office API (only reachable through Cloudflare Access).

import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import { stripImage, UnsupportedImage, CLEAN_TYPES } from './strip.js';
import { parseVisited } from './content.js';
import { TYPES, buildPost, isVisible, parseWishlist, parseSite, parseStatusLog, parseCategories, parseTravel, parsePassport, parseKeepsakeSettings, parseTheme, parseGuestbookEntry, parseComment, isCommentKey, splitFrontMatter, headerProblem } from './content.js';
import { adminCheck } from './auth.js';
import * as friends from './friends.js';

const ROBOTS_TAG = 'noindex, nofollow, noarchive, nosnippet, noimageai';

// Crawlers asked to stay away entirely. Search engines are deliberately NOT listed:
// they need to fetch pages to see the noindex header, which keeps you out of results.
const AI_CRAWLERS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'CCBot', 'Google-Extended', 'Applebot-Extended', 'PerplexityBot', 'Perplexity-User', 'Bytespider',
  'Amazonbot', 'meta-externalagent', 'meta-externalfetcher', 'FacebookBot', 'cohere-ai', 'cohere-training-data-crawler',
  'Diffbot', 'ImagesiftBot', 'Omgilibot', 'Timpibot', 'YouBot', 'DuckAssistBot', 'MistralAI-User', 'AI2Bot', 'Ai2Bot-Dolma'
];

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

const IMAGE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', heic: 'image/heic' };

export default {
  async fetch(request, env, ctx) {
    let res;
    try {
      res = await route(request, env, ctx);
    } catch (e) {
      console.error(e);
      res = json({ error: 'Something went wrong on the server.' }, 500);
    }
    return finish(res, new URL(request.url).pathname);
  },
  // Every 10 minutes: read your friends' sites for new posts and statuses (in case one was
  // offline when it had news), and tell them about a post of yours that has just gone live.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      Promise.all([
        friends
          .refreshFriends(env)
          .then((r) => r.of && bumpVersion(env))
          .catch((e) => console.error(e)),
        friends.shareNews(env, buildEverything).catch((e) => console.error(e))
      ])
    );
  }
};

function finish(res, path = '') {
  const out = new Response(res.body, res);
  const h = out.headers;
  h.set('X-Robots-Tag', ROBOTS_TAG);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), interest-cohort=()');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  if ((h.get('Content-Type') || '').includes('text/html')) {
    // The back office may start a background worker to convert iPhone HEIC/HEIF photos.
    h.set('Content-Security-Policy', path.startsWith('/admin') ? CSP + "; worker-src 'self' blob:" : CSP);
  }
  return out;
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }
  });
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const p = url.pathname;
  const method = request.method;

  if (p === '/robots.txt') return robots();
  const moved = await mainAddress(request, env, url);
  if (moved) return moved;
  if (p === '/manifest.webmanifest') return manifest(env);

  if (p === '/admin' || p.startsWith('/admin/')) {
    const check = await adminCheck(request, env);
    if (!check.ok) return lockedPage(check, url, p.startsWith('/admin/api/'));
    if (p.startsWith('/admin/api/')) {
      const res = await adminApi(request, env, url, ctx);
      // Anything saved might be news for your friends: their sites hear straight away (and
      // nothing is sent when what they see hasn't changed).
      if (method !== 'GET' && res.ok) ctx.waitUntil(friends.shareNews(env, buildEverything).catch((e) => console.error(e)));
      return res;
    }
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'no-store');
    return out;
  }

  if (p === '/api/all' && method === 'GET') return apiAll(request, env, ctx);
  if (p === '/api/visit' && method === 'POST') return visit(request, env);
  if (p === '/api/guestbook' && method === 'POST') return signGuestbook(request, env);
  if (p === '/api/comment' && method === 'POST') return leaveComment(request, env);
  if (p === '/api/suggest' && method === 'POST') return suggest(request, env);
  if (p === '/api/nudge' && method === 'POST') return nudge(request, env);
  if (p.startsWith('/media/') && (method === 'GET' || method === 'HEAD')) return media(request, env, p);
  // Photos in your Friends feed, fetched from your friends' sites by yours.
  if (p.startsWith('/friends-media/') && method === 'GET') {
    let parts;
    try {
      parts = p.slice('/friends-media/'.length).split('/').map(decodeURIComponent);
    } catch {
      return new Response('Bad path', { status: 400 });
    }
    return friends.friendPhotoForVisitor(env, parts[0], parts.slice(1).join('/'));
  }
  // Friends' sites talking to yours (every request signed with the secret you share).
  if (p.startsWith('/api/friends/')) return friends.friendsApi(request, env, p, { buildEverything, mediaForFriend: (key) => friendMedia(env, key), changed: () => bumpVersion(env), waitUntil: (work) => ctx.waitUntil(work) });
  if (p.startsWith('/api/')) return json({ error: 'Not found' }, 404);

  return staticFile(request, env, p);
}

// Fonts, the map and photo libraries, icons and cursors hardly ever change, so browsers keep
// them for a month instead of asking again on every visit. (Change one? Give it a new name.)
// The site's own scripts and styles are still checked each visit, so an update shows at once.
const LONG_LIVED = /^\/(fonts|vendor|icons|cursors)\//;
async function staticFile(request, env, path) {
  const res = await env.ASSETS.fetch(request);
  if (!LONG_LIVED.test(path) || res.status !== 200) return res;
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'public, max-age=2592000');
  return out;
}

// The back office is locked: say why, in plain words, so the owner knows what to fix. Nothing
// here reveals a setting; a stranger learns no more than that the door is locked.
const LOCKED = {
  setup: ['The lock isn’t set up yet', 'The settings <b>ACCESS_TEAM_DOMAIN</b> and <b>ACCESS_AUD</b> are empty or say <b>none</b>. Fill them in as in step 2 of the README (Workers &amp; Pages › your site › Settings › Variables and Secrets), then deploy.'],
  'no-pass': ['This address didn’t go through the Cloudflare sign-in', 'Cloudflare Access isn’t guarding <b>{host}/admin</b>, so no sign-in reached the site. In Zero Trust › Access › Applications, open your back office application and check it lists this exact address twice: with the path <b>admin</b> and with <b>admin/*</b>. (Using your own domain, or a preview address? Each one needs adding.)'],
  keys: ['Couldn’t check your sign-in with Cloudflare', 'The site couldn’t read Cloudflare’s keys for your team. Check <b>ACCESS_TEAM_DOMAIN</b> is your team domain exactly, like <b>yourteam.cloudflareaccess.com</b>, then try again in a minute.'],
  bad: ['That sign-in wasn’t accepted', 'Sign out and sign in again with the button below.'],
  expired: ['Your sign-in has run out', 'Sign out and sign in again with the button below.'],
  audience: ['This sign-in is for a different application', '<b>ACCESS_AUD</b> doesn’t match your back office application. In Zero Trust › Access › Applications, open it, copy its <b>Application Audience (AUD) Tag</b> again and paste it into <b>ACCESS_AUD</b>, then deploy.'],
  email: ['Signed in, but not as the owner', 'You signed in as <b>{email}</b>, which isn’t the email in <b>ADMIN_EMAIL</b>. Sign out and use the owner’s email, or set <b>ADMIN_EMAIL</b> to this address (or to <b>none</b> to rely on the Access rule alone), then deploy.']
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function lockedPage(check, url, isApi) {
  const [title, how] = LOCKED[check.why] || LOCKED.bad;
  if (isApi) return json({ error: `Back office is locked: ${title.replace(/’/g, "'")}.`, why: check.why }, 403);
  if (check.why === 'setup') return setupGuide(url);
  const body = how.replace('{host}', esc(url.hostname)).replace('{email}', esc(check.email || ''));
  const signOut = ['bad', 'expired', 'email', 'audience'].includes(check.why) ? '<p><a href="/cdn-cgi/access/logout" style="display:inline-block;padding:8px 14px;border:1px solid #003c74;border-radius:3px;background:#ecebe6;color:#000;text-decoration:none">Sign out, then sign in again</a></p>' : '';
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Back office</title><body style="font-family:Tahoma,sans-serif;padding:24px;max-width:620px;line-height:1.5">' +
      `<h1 style="font-size:22px">Back office is locked</h1><h2 style="font-size:17px;color:#0d3a9a">${title}</h2><p>${body}</p>${signOut}` +
      '<p style="color:#666;font-size:13px">Only the site’s owner can open the back office. If that’s not you, there’s nothing to see here: <a href="/">back to the site</a>.</p></body>',
    { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}

// Your site's main address is the one set under Friends › My site's address (a domain of your
// own, say). Visitors who arrive at the old workers.dev address, or at the www / non-www twin of
// your domain, are sent there. The back office and friends' sites are never sent away, so a
// mistyped address can't lock you out, and friends who haven't heard you moved still reach you.
const mainCache = new WeakMap();
export async function mainAddress(request, env, url) {
  if (!['GET', 'HEAD'].includes(request.method)) return null;
  const p = url.pathname;
  if (p === '/admin' || p.startsWith('/admin/') || p.startsWith('/api/friends/') || p.startsWith('/cdn-cgi/')) return null;
  const host = url.hostname;
  const twin = (a, b) => a === 'www.' + b || b === 'www.' + a;
  let known = mainCache.get(env);
  if (!known || Date.now() - known.at > 60_000) {
    known = { at: Date.now(), me: (await friends.loadFriends(env).catch(() => ({}))).me || '' };
    mainCache.set(env, known);
  }
  let main;
  try {
    main = new URL(known.me);
  } catch {
    return null;
  }
  if (main.protocol !== 'https:' || main.hostname === host || main.hostname.endsWith('.workers.dev')) return null;
  if (!host.endsWith('.workers.dev') && !twin(host, main.hostname)) return null;
  return new Response(null, { status: 301, headers: { Location: main.origin + p + url.search, 'Cache-Control': 'public, max-age=300' } });
}

// A brand-new site: the back office walks its owner through locking it, with this site's own
// address filled in, and a prompt to paste into an AI helper. (It shows nothing that isn't
// public already: the site's address, and steps anyone can read in the README.)
export function setupPrompt(host) {
  return [
    `I've just put my own website online with Cloudflare, using the open-source "My Corner" blog. Its address is https://${host}. I'm not technical, so please guide me one small step at a time and wait for me to say "done" before the next one.`,
    '',
    'The goal: lock the back office (the /admin part of my site) so only I can get in, using Cloudflare Zero Trust Access (free plan). The rest of the site stays public.',
    '',
    'Cloudflare changes its menus now and then, so please check the current Cloudflare documentation as we go:',
    '- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/',
    '- https://developers.cloudflare.com/workers/configuration/cloudflare-access/',
    '- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/',
    '',
    'What needs doing:',
    '1. In the Cloudflare dashboard open Zero Trust. If it asks, choose a team name and the Free plan. Note the team domain (like myteam.cloudflareaccess.com).',
    `2. Create a self-hosted Access application named "Back office" for ${host} with the path admin, and add the same address again with the path admin/* (two entries).`,
    '3. Give it an Allow policy that includes only my own email address, and sign in with a one-time PIN sent by email.',
    '4. Copy the application’s Application Audience (AUD) Tag.',
    '5. In Workers & Pages, open my site (the Worker), then Settings > Variables and Secrets, and set: ACCESS_TEAM_DOMAIN = my team domain; ACCESS_AUD = the AUD tag; ADMIN_EMAIL = my email (or none); CONTACT_EMAIL = my email (or none). Save and deploy.',
    `6. Visit https://${host}/admin. Cloudflare should email me a code; once I'm in, we're done. If the page says the back office is locked, it explains why: help me fix what it says.`,
    '',
    'Please never ask me to paste passwords, one-time codes or API tokens into this chat. The team domain, AUD tag and my site address are fine to share.'
  ].join('\n');
}
function setupGuide(url) {
  const host = url.host;
  const dev = host.endsWith('.workers.dev');
  const [sub, ...rest] = host.split('.');
  const code = (t) => `<code style="background:#eef2fb;border:1px solid #c9d4ee;border-radius:3px;padding:1px 5px;user-select:all">${esc(t)}</code>`;
  const where = dev ? `subdomain ${code(sub)}, domain ${code(rest.join('.'))}` : `your site’s address ${code(host)}`;
  const steps = [
    `In the <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener">Cloudflare dashboard</a>, open <b>Zero Trust</b>. The first time, pick a team name (like ${code('mycorner')}) and the <b>Free</b> plan. Your <b>team domain</b> is that name followed by ${code('.cloudflareaccess.com')}.`,
    `Go to <b>Access controls › Applications</b> (on older dashboards, <b>Access › Applications</b>) and create a <b>Self-hosted</b> application called ${code('Back office')}.`,
    `Add a public hostname: ${where}, path ${code('admin')}. Then add the same again with path ${code('admin/*')}.`,
    `Add a policy: <b>Allow</b>, include <b>Emails</b>, and type your own email address. Save the application.`,
    `Open the application again and copy its <b>Application Audience (AUD) Tag</b>.`,
    `Go to <b>Workers &amp; Pages</b>, open this site, then <b>Settings › Variables and Secrets</b>, and fill in: <b>ACCESS_TEAM_DOMAIN</b> (your team domain), <b>ACCESS_AUD</b> (the tag), <b>ADMIN_EMAIL</b> (your email) and <b>CONTACT_EMAIL</b> (your email, or ${code('none')}). Save and deploy.`,
    `Come back to this page and refresh it. Cloudflare emails you a code; type it in and you’re in.`
  ];
  const domain = dev
    ? '<p><b>Got a domain of your own</b> (like myname.com)? Set things up at this address first. Then the README’s “Your own domain” section moves your site there, and this address keeps working.</p>'
    : '';
  const page =
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Set up your back office</title>' +
    '<body style="font-family:Tahoma,sans-serif;padding:24px;max-width:680px;line-height:1.55;color:#1b1b1b">' +
    '<h1 style="font-size:22px;margin-bottom:4px">Your site is online. One more step!</h1>' +
    '<p style="margin-top:0">The back office is where you write posts and change everything. It stays shut until you lock it so that only you can get in. It takes about ten minutes, and costs nothing.</p>' +
    `<ol style="padding-left:22px">${steps.map((t) => `<li style="margin-bottom:8px">${t}</li>`).join('')}</ol>` +
    domain +
    '<h2 style="font-size:17px;color:#0d3a9a;margin-top:24px">Rather have an AI help?</h2>' +
    '<p>Copy all of this into an AI assistant (Claude, ChatGPT, Gemini…) and it will walk you through it, step by step. It already knows your site’s address.</p>' +
    `<textarea readonly rows="12" aria-label="A prompt for your AI helper" style="width:100%;box-sizing:border-box;font:13px/1.45 Consolas,monospace;padding:8px;border:1px solid #9aa8c7;border-radius:3px;background:#fafbfe">${esc(setupPrompt(host))}</textarea>` +
    '<p style="color:#666;font-size:13px">Never paste passwords or sign-in codes into an AI chat. The README has the same steps, and what to do if something goes wrong. Not the owner? There’s nothing to see here: <a href="/">back to the site</a>.</p></body>';
  return new Response(page, { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function robots() {
  const lines = [];
  for (const bot of AI_CRAWLERS) lines.push(`User-agent: ${bot}`, 'Disallow: /', '');
  lines.push('User-agent: *', 'Disallow: /admin', '');
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

// The home-screen app takes its name from the site name you set in the back office.
async function manifest(env) {
  const site = parseSite(await readText(env, 'site.md'));
  const body = {
    name: site.name,
    short_name: site.name.length > 14 ? site.name.slice(0, 14) : site.name,
    start_url: '/',
    display: 'standalone',
    background_color: '#2e6bd8',
    theme_color: '#0a3ec4',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' }
    ]
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=300' } });
}

function siteSlug(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-corner';
}

// ---------- reading content ----------

async function listAll(env, prefix = '') {
  const out = [];
  let cursor;
  do {
    const page = await env.CONTENT.list({ prefix, cursor, limit: 1000 });
    out.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function readText(env, key) {
  const obj = await env.CONTENT.get(key);
  return obj ? obj.text() : null;
}

const PARSED_CACHE = 'data/_parsed.json';
const PARSED_VERSION = 30; // bump when buildPost changes shape

// "reading [book]" (or [film], [podcast], [music]) becomes "reading The Remains of the Day" while a book is marked as reading.
function fillStatus(status, posts) {
  if (!status) return status;
  const current = (type) => posts.find((p) => p.type === type && p.state === 'now');
  const TYPE = { book: 'books', film: 'films', podcast: 'podcasts', music: 'music', album: 'music', song: 'music', tv: 'tv', show: 'tv' };
  return status.replace(/\[(book|film|podcast|music|album|song|tv|show)\]/g, (m, kind) => current(TYPE[kind])?.title || m);
}

async function bumpVersion(env) {
  await env.CONTENT.put('data/_version', String(Date.now()));
}

function tzOffset(env) {
  return env.TIMEZONE || 'Europe/London';
}

async function buildEverything(env, { includeHidden = false } = {}) {
  const tz = tzOffset(env);
  const objects = await listAll(env);
  const mdKeys = objects.map((o) => o.key).filter((k) => k.endsWith('.md'));

  const postKeys = mdKeys.filter((k) => {
    const [folder, file, more] = k.split('/');
    return TYPES.includes(folder) && file && !more;
  });
  // Parsed posts are kept in one cache file and only re-read when a file changes, so a big
  // shelf (hundreds of imported books) doesn't mean hundreds of reads on every visit.
  const etags = new Map(objects.map((o) => [o.key, o.etag]));
  let cache = {};
  try {
    const c = JSON.parse((await readText(env, PARSED_CACHE)) || '{}');
    if (c.v === PARSED_VERSION && c.tz === tz) cache = c.posts || {};
  } catch {}
  const stale = postKeys.filter((k) => cache[k]?.etag !== etags.get(k));
  const texts = await Promise.all(stale.map((k) => readText(env, k)));
  stale.forEach((k, i) => {
    if (texts[i] == null) return;
    let post;
    try {
      post = buildPost(k.split('/')[0], k, texts[i], tz);
    } catch (e) {
      // One file the site can't read must never take the whole site down: it's hidden and
      // shows as a problem in the back office instead.
      console.error(k, e);
      post = { ...buildPost(k.split('/')[0], k, '', tz), error: `This post could not be read: ${String(e?.message || e).slice(0, 200)}` };
    }
    cache[k] = { etag: etags.get(k), post };
  });
  const keep = new Set(postKeys);
  let dropped = false;
  for (const k of Object.keys(cache)) if (!keep.has(k)) (delete cache[k], (dropped = true));
  if (stale.length || dropped) await env.CONTENT.put(PARSED_CACHE, JSON.stringify({ v: PARSED_VERSION, tz, posts: cache }));
  const now = Date.now();
  const posts = [];
  for (const k of postKeys) {
    const post = cache[k]?.post;
    if (post && (includeHidden || isVisible(post, now))) posts.push(post);
  }
  posts.sort((a, b) => b.ts - a.ts || b.slug.localeCompare(a.slug));

  const gbKeys = mdKeys.filter((k) => k.startsWith('guestbook/'));
  const gbTexts = await Promise.all(gbKeys.map((k) => readText(env, k)));
  const guestbook = gbKeys
    .map((k, i) => parseGuestbookEntry(k, gbTexts[i] || ''))
    .map(({ key, ...rest }) => rest)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const [siteText, wishText, travelText, logText, catText, passportText, keepText, themeText] = await Promise.all([
    readText(env, 'site.md'),
    readText(env, 'wishlist.md'),
    readText(env, 'travel.md'),
    readText(env, 'status-log.md'),
    readText(env, 'categories.md'),
    readText(env, 'passport.md'),
    readText(env, 'keepsakes.md'),
    readText(env, 'theme.md')
  ]);

  const site = parseSite(siteText);
  // Approved comments, each with its post (and none at all while comments are switched off).
  const commentKeys = site.comments ? mdKeys.filter((k) => isCommentKey(k)) : [];
  const commentTexts = await Promise.all(commentKeys.map((k) => readText(env, k)));
  const byPost = {};
  commentKeys.forEach((k, i) => {
    const { key, post, ...c } = parseComment(k, commentTexts[i] || '');
    (byPost[post] ||= []).push(c);
  });
  for (let i = 0; site.comments && i < posts.length; i++) {
    const list = (byPost[`${posts[i].type}/${posts[i].slug}`] || []).sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id));
    posts[i] = { ...posts[i], comments: list.slice(0, 300) };
  }
  site.status = fillStatus(site.status, posts);
  // Past statuses, newest first, without the one that's showing now.
  site.history = parseStatusLog(logText)
    .filter((e, i) => !(i === 0 && e.text === site.status))
    .slice(0, 30);
  return {
    site,
    posts,
    wishlist: parseWishlist(wishText),
    stats: travelFor(parseTravel(travelText), includeHidden),
    // Countries visited show as passport stamps even when the flight stats are hidden.
    visited: parseVisited(travelText),
    // Your own place categories, on top of the built-in ones.
    categories: parseCategories(catText),
    // The visa design, and keepsakes you've switched off or designed yourself.
    passport: parsePassport(passportText),
    keepsakes: parseKeepsakeSettings(keepText),
    // The site's theme: colours, wallpaper, charms and pointer (theme.md).
    theme: parseTheme(themeText),
    guestbook,
    generated: now
  };
}

// Hidden travel stats only show in the back office.
function travelFor(stats, includeHidden) {
  if (!stats) return null;
  if (stats.hidden && !includeHidden) return null;
  return stats;
}

async function apiAll(request, env, ctx) {
  const version = (await readText(env, 'data/_version')) || '0';
  // Rebuilt every 5 minutes as well, so posts scheduled for later appear on time.
  const slot = Math.floor(Date.now() / 300000);
  // Browsers check back every time (a tiny "nothing new" answer when nothing has changed), so
  // a post shows up the moment it's published, even in a tab that had the site open.
  const etag = `"${version.replace(/\W/g, '')}-${slot}"`;
  // (Cloudflare may hand the tag back marked "weak" after compressing the answer; same tag.)
  if ((request.headers.get('If-None-Match') || '').replace(/^W\//, '') === etag) return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'no-cache' } });

  const cacheKey = new Request(`https://cache.internal/api/all?v=${encodeURIComponent(version)}&t=${slot}`);
  const cache = caches.default;
  let res = await cache.match(cacheKey);
  if (!res) {
    const data = await buildEverything(env);
    // Visitors get the finished HTML; the raw Markdown and file names stay for the back office.
    data.posts = data.posts.map(({ body, files, key, ...p }) => p);
    // Your friends: who they are and how they are, and their latest posts (unless you've turned
    // that off in the back office).
    const pals = await friends.publicFriends(env).catch(() => ({ buddies: [], posts: [] }));
    data.buddies = pals.buddies;
    data.friendPosts = pals.posts;
    data.friendLooks = pals.looks || {};
    // (Their keepsake designs and place categories, for drawing their posts as on their site.)
    data.friendKeepsakes = pals.keepsakes || [];
    data.friendCategories = pals.categories || [];
    // (No Friends tab when you don't show friends' posts; the friends list, if shown, is on About.)
    data.friendsTab = !!pals.postsShown;
    res = json(data, 200, { 'Cache-Control': 'public, max-age=300' });
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'no-cache');
  out.headers.set('ETag', etag);
  return out;
}

async function media(request, env, path) {
  let key;
  try {
    key = decodeURIComponent(path.slice('/media/'.length));
  } catch {
    return new Response('Bad path', { status: 400 });
  }
  return mediaFor(env, key, request.method === 'HEAD');
}

// For a friend's site: a photo only if it belongs to a post that's published (not a draft, not
// scheduled for later).
async function friendMedia(env, key) {
  const [type, slug, file, more] = String(key).split('/');
  if (more !== undefined) return new Response('Not found', { status: 404 });
  const { posts } = await buildEverything(env);
  const post = posts.find((x) => x.type === type && x.slug === slug);
  if (!post || !post.files.includes(file)) return new Response('Not found', { status: 404 });
  return mediaFor(env, key);
}

async function mediaFor(env, key, head = false) {
  const [folder] = key.split('/');
  const ext = (key.split('.').pop() || '').toLowerCase();
  if (!(TYPES.includes(folder) || folder === 'design') || !IMAGE_TYPES[ext] || key.includes('..')) return new Response('Not found', { status: 404 });
  const obj = await env.CONTENT.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  // Every photo is cleaned again on the way out, so nothing hidden ever reaches a visitor,
  // even from a file that was put in the bucket some other way.
  let clean;
  try {
    clean = stripImage(await obj.arrayBuffer());
  } catch {
    return new Response('This photo could not be cleaned of hidden data, so it is not shown.', { status: 415 });
  }
  return new Response(head ? null : clean.bytes, {
    headers: {
      'Content-Type': CLEAN_TYPES[clean.kind],
      'Content-Length': String(clean.bytes.length),
      // Visitors' browsers may keep a photo for three hours at most (and nothing in between may
      // keep it at all), so a photo you delete is gone from everyone's screen within three hours.
      'Cache-Control': 'private, max-age=10800',
      ETag: obj.httpEtag
    }
  });
}

// ---------- visitors writing ----------

function looksLikeBot(request) {
  const ua = (request.headers.get('User-Agent') || '').toLowerCase();
  return !ua || /bot|crawl|spider|slurp|curl|wget|python|headless/.test(ua);
}

async function visit(request, env) {
  if (looksLikeBot(request)) return json({ count: null });
  const raw = await readText(env, 'data/counter.json');
  let count = 0;
  try {
    count = JSON.parse(raw || '{}').count || 0;
  } catch {}
  count += 1;
  await env.CONTENT.put('data/counter.json', JSON.stringify({ count }), { httpMetadata: { contentType: 'application/json' } });
  return json({ count });
}

// A Messenger-style nudge. Only a total is kept (and the times of the last few, to slow
// down anyone hammering the button); nothing about who sent it.
async function nudge(request, env) {
  if (looksLikeBot(request)) return json({ ok: false }, 400);
  let n = { count: 0, recent: [] };
  try {
    n = { count: 0, recent: [], ...JSON.parse((await readText(env, 'data/nudges.json')) || '{}') };
  } catch {}
  const now = Date.now();
  n.recent = (n.recent || []).filter((t) => now - t < 10 * 60 * 1000);
  if (n.recent.length >= 20) return json({ ok: false, error: 'Lots of nudges right now. Try again in a few minutes.' }, 429);
  n.count = (n.count || 0) + 1;
  n.recent.push(now);
  n.last = now;
  // The times of the last 100, for the back office's notifications.
  n.log = [...(n.log || []), now].slice(-100);
  await env.CONTENT.put('data/nudges.json', JSON.stringify(n), { httpMetadata: { contentType: 'application/json' } });
  return json({ ok: true });
}

function cleanText(s, max) {
  return String(s || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, max);
}

function yamlString(s) {
  return JSON.stringify(String(s)); // JSON strings are valid YAML strings
}

function stamp() {
  const d = new Date();
  const iso = d.toISOString();
  const rand = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  return { iso, file: iso.replace(/[-:]/g, '').replace(/\..+$/, '') + '-' + rand };
}

async function readBody(request) {
  const type = request.headers.get('Content-Type') || '';
  if (type.includes('application/json')) return request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

async function signGuestbook(request, env) {
  if (looksLikeBot(request)) return json({ error: 'Not accepted' }, 400);
  let body;
  try {
    body = await readBody(request);
  } catch {
    return json({ error: 'Could not read that.' }, 400);
  }
  if (body.website) return json({ ok: true, pending: true }); // honeypot: bots fill hidden fields
  const name = cleanText(body.name, 40) || 'Visitor';
  const message = cleanText(body.message, 600);
  if (message.length < 2) return json({ error: 'Write a message first.' }, 400);
  const pending = await env.CONTENT.list({ prefix: 'guestbook-pending/', limit: 300 });
  if (pending.objects.length >= 300) return json({ error: 'The guestbook is full for now. Try again later.' }, 429);
  const { iso, file } = stamp();
  const text = `---\nname: ${yamlString(name)}\ndate: ${yamlString(iso.slice(0, 16).replace('T', ' '))}\n---\n${message}\n`;
  await env.CONTENT.put(`guestbook-pending/${file}.md`, text, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
  return json({ ok: true, pending: true });
}

// A visitor's comment on a post (or a reply to another comment). Only a name is asked for, and
// nothing else about them is kept. It waits for the owner's approval in the back office.
async function leaveComment(request, env) {
  if (looksLikeBot(request)) return json({ error: 'Not accepted' }, 400);
  let body;
  try {
    body = await readBody(request);
  } catch {
    return json({ error: 'Could not read that.' }, 400);
  }
  if (body.website) return json({ ok: true, pending: true }); // honeypot: bots fill hidden fields
  const name = cleanText(body.name, 40).replace(/\s+/g, ' ');
  if (!name) return json({ error: 'Write a name first (any name you like).' }, 400);
  const message = cleanText(body.message, 1000);
  if (message.length < 2) return json({ error: 'Write a comment first.' }, 400);
  const [type, slug] = String(body.post || '').split('/');
  const data = await buildEverything(env);
  if (!data.site.comments) return json({ error: 'Comments are switched off here.' }, 403);
  const post = data.posts.find((x) => x.type === type && x.slug === slug);
  if (!post) return json({ error: 'That post isn’t here any more.' }, 404);
  // A reply is to a comment that's on the site.
  const replyTo = String(body.reply_to || '');
  const answering = replyTo && post.comments.some((c) => c.id === replyTo) ? replyTo : '';
  if (replyTo && !answering) return json({ error: 'That comment isn’t here any more.' }, 404);
  const waiting = await env.CONTENT.list({ prefix: 'comments-pending/', limit: 300 });
  if (waiting.objects.length >= 300) return json({ error: 'Lots of comments are waiting already. Try again later.' }, 429);
  if (waiting.objects.filter((o) => o.key.startsWith(`comments-pending/${type}/${slug}/`)).length >= 40) return json({ error: 'Lots of comments are waiting on this post already. Try again later.' }, 429);
  const { iso, file } = stamp();
  const text = `---\nname: ${yamlString(name)}\ndate: ${yamlString(iso.slice(0, 16).replace('T', ' '))}\n${answering ? `reply_to: ${yamlString(answering)}\n` : ''}---\n${message}\n`;
  await env.CONTENT.put(`comments-pending/${type}/${slug}/${file}.md`, text, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
  return json({ ok: true, pending: true });
}

async function suggest(request, env) {
  if (looksLikeBot(request)) return json({ error: 'Not accepted' }, 400);
  let body;
  try {
    body = await readBody(request);
  } catch {
    return json({ error: 'Could not read that.' }, 400);
  }
  if (body.website) return json({ ok: true });
  // Visitors can suggest a place, a book, a film or a podcast.
  const kind = ['place', 'book', 'film', 'podcast', 'music', 'tv'].includes(body.kind) ? body.kind : 'place';
  const title = cleanText(body.title ?? body.place, 120);
  if (title.length < 2) return json({ error: `Name the ${kind} first.` }, 400);
  const from = cleanText(body.name, 40) || 'Visitor';
  const note = cleanText(body.note, 400);
  const pending = await env.CONTENT.list({ prefix: 'suggestions/', limit: 300 });
  if (pending.objects.length >= 300) return json({ error: 'Too many suggestions waiting. Try again later.' }, 429);
  const { iso, file } = stamp();
  const text = `---\nkind: ${kind}\ntitle: ${yamlString(title)}\nfrom: ${yamlString(from)}\ndate: ${yamlString(iso.slice(0, 16).replace('T', ' '))}\n---\n${note}\n`;
  await env.CONTENT.put(`suggestions/${file}.md`, text, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
  return json({ ok: true });
}

// ---------- back office ----------

const KEY_OK = /^[A-Za-z0-9][A-Za-z0-9._\-/ ]{0,300}$/;
function validKey(key) {
  return typeof key === 'string' && KEY_OK.test(key) && !key.includes('..') && !key.includes('//') && !key.startsWith('data/_');
}

const WMO = {
  0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 56: 'freezing drizzle', 57: 'freezing drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'light showers', 81: 'showers', 82: 'heavy showers', 85: 'snow showers', 86: 'heavy snow showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail'
};

async function adminApi(request, env, url, ctx) {
  const p = url.pathname.slice('/admin/api/'.length);
  const m = request.method;
  const key = url.searchParams.get('key');

  if (p === 'overview' && m === 'GET') {
    const data = await buildEverything(env, { includeHidden: true });
    const objects = await listAll(env);
    const files = objects
      .filter((o) => !o.key.startsWith('data/_'))
      .map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded, etag: o.etag }));
    const pendingGb = await Promise.all(
      objects.filter((o) => o.key.startsWith('guestbook-pending/')).map(async (o) => parseGuestbookEntry(o.key, (await readText(env, o.key)) || ''))
    );
    const approvedGb = await Promise.all(
      objects.filter((o) => o.key.startsWith('guestbook/') && o.key.endsWith('.md')).map(async (o) => parseGuestbookEntry(o.key, (await readText(env, o.key)) || ''))
    );
    approvedGb.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    // Comments: the ones waiting for your approval, and the ones on the site (newest first).
    const commentsIn = (folder) => Promise.all(objects.filter((o) => isCommentKey(o.key, folder)).map(async (o) => parseComment(o.key, (await readText(env, o.key)) || '')));
    const newest = (list) => list.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id.localeCompare(a.id));
    const pendingComments = newest(await commentsIn('comments-pending'));
    const approvedComments = newest(await commentsIn('comments'));
    const suggestions = await Promise.all(
      objects.filter((o) => o.key.startsWith('suggestions/')).map(async (o) => {
        const { data: d, body } = splitFrontMatter((await readText(env, o.key)) || '');
        return { key: o.key, kind: String(d.kind || 'place'), title: String(d.title ?? d.place ?? ''), from: String(d.from || ''), date: String(d.date || ''), note: body.trim() };
      })
    );
    let counter = 0;
    try {
      counter = JSON.parse((await readText(env, 'data/counter.json')) || '{}').count || 0;
    } catch {}
    let nudges = { count: 0, last: null, log: [] };
    try {
      const n = JSON.parse((await readText(env, 'data/nudges.json')) || '{}');
      nudges = { count: n.count || 0, last: n.last || null, log: Array.isArray(n.log) ? n.log : n.last ? [n.last] : [] };
    } catch {}
    // When you last looked at your notifications.
    let notifySeen = 0;
    try {
      notifySeen = JSON.parse((await readText(env, 'data/notify.json')) || '{}').seen || 0;
    } catch {}
    // Your friends' latest posts, for the notifications.
    const friendNotes = await friends.friendNotes(env).catch(() => ({ count: 0, posts: [] }));
    return json({ ...data, files, pendingGuestbook: pendingGb, approvedGuestbook: approvedGb, pendingComments, approvedComments, suggestions, counter, nudges, notifySeen, friendNotes, now: Date.now() });
  }

  // Many Markdown files at once (used by the Goodreads and Letterboxd imports).
  if (p === 'batch' && m === 'POST') {
    let files;
    try {
      ({ files } = await request.json());
    } catch {
      return json({ error: 'Bad request.' }, 400);
    }
    if (!Array.isArray(files) || files.length > 200) return json({ error: 'Send up to 200 files at a time.' }, 400);
    for (const f of files) {
      if (!f || !validKey(f.key) || !/\.md$/i.test(f.key) || typeof f.text !== 'string' || f.text.length > 200_000) return json({ error: `Bad file: ${f?.key || '?'}` }, 400);
    }
    for (const f of files) await env.CONTENT.put(f.key, f.text, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
    await bumpVersion(env);
    return json({ ok: true, count: files.length });
  }

  if (p === 'file') {
    if (!validKey(key)) return json({ error: 'That file name is not allowed.' }, 400);
    if (m === 'GET') {
      // Just which version is stored now (to spot a change made from another device).
      if (url.searchParams.get('info')) {
        const head = await env.CONTENT.head(key);
        return head ? json({ etag: head.etag, uploaded: head.uploaded, size: head.size }) : json({ error: 'Not found' }, 404);
      }
      const text = await readText(env, key);
      return text == null ? json({ error: 'Not found' }, 404) : new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    if (m === 'PUT') {
      if (!/\.(md|json|txt)$/i.test(key)) return json({ error: 'Only .md, .json and .txt files can be written here.' }, 400);
      const text = await request.text();
      if (text.length > 1_000_000) return json({ error: 'That file is too big.' }, 413);
      // A header the site can't read would hide the post, so it isn't saved at all.
      const problem = /\.md$/i.test(key) ? headerProblem(text) : null;
      if (problem) return json({ error: `Not saved: the header (between the --- lines) has a mistake. ${problem} Text with a colon, # or quotes in it needs "double quotes" around it.`, problem }, 422);
      const type = key.endsWith('.json') ? 'application/json' : 'text/markdown; charset=utf-8';
      await env.CONTENT.put(key, text, { httpMetadata: { contentType: type } });
      await bumpVersion(env);
      return json({ ok: true, key });
    }
    if (m === 'DELETE') {
      await env.CONTENT.delete(key);
      const [folder, file, more] = key.split('/');
      if (TYPES.includes(folder) && file && !more && file.endsWith('.md')) {
        const mediaPrefix = `${folder}/${file.replace(/\.md$/, '')}/`;
        // (Its photos go with it, and its comments, on the site or waiting.)
        const extra = [...(await listAll(env, mediaPrefix)), ...(await listAll(env, 'comments/' + mediaPrefix)), ...(await listAll(env, 'comments-pending/' + mediaPrefix))];
        if (extra.length) await env.CONTENT.delete(extra.map((o) => o.key));
      }
      await bumpVersion(env);
      return json({ ok: true });
    }
  }

  if (p === 'move' && m === 'POST') {
    const to = url.searchParams.get('to');
    if (!validKey(key) || !validKey(to)) return json({ error: 'Bad file name.' }, 400);
    const obj = await env.CONTENT.get(key);
    if (!obj) return json({ error: 'Not found' }, 404);
    await env.CONTENT.put(to, await obj.arrayBuffer(), { httpMetadata: obj.httpMetadata });
    await env.CONTENT.delete(key);
    await bumpVersion(env);
    return json({ ok: true });
  }

  if (p === 'upload' && m === 'PUT') {
    if (!validKey(key)) return json({ error: 'Bad file name.' }, 400);
    const ext = (key.split('.').pop() || '').toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return json({ error: 'Photos must be jpg, png, webp or gif.' }, 400);
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 15 * 1024 * 1024) return json({ error: 'Photos must be under 15 MB.' }, 413);
    // Strip every bit of hidden data before the photo is stored.
    let clean;
    try {
      clean = stripImage(buf);
    } catch (e) {
      return json({ error: e instanceof UnsupportedImage ? e.message : 'That photo could not be read.' }, 415);
    }
    await env.CONTENT.put(key, clean.bytes, { httpMetadata: { contentType: CLEAN_TYPES[clean.kind] } });
    await bumpVersion(env);
    return json({ ok: true, key, url: `/media/${key.split('/').map(encodeURIComponent).join('/')}` });
  }

  if (p === 'geocode' && m === 'GET') {
    const q = url.searchParams.get('q') || '';
    if (q.trim().length < 2) return json([]);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': userAgent(env), 'Accept-Language': 'en' }
    });
    if (!r.ok) return json({ error: 'Place search is unavailable right now.' }, 502);
    return json((await r.json()).map(simplifyPlace));
  }

  if (p === 'reverse' && m === 'GET') {
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, {
      headers: { 'User-Agent': userAgent(env), 'Accept-Language': 'en' }
    });
    if (!r.ok) return json({ error: 'Location lookup is unavailable right now.' }, 502);
    return json(simplifyPlace(await r.json()));
  }

  if (p === 'weather' && m === 'GET') {
    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: 'Pick a place first.' }, 400);
    const today = new Date().toISOString().slice(0, 10);
    const ageDays = (Date.parse(today) - Date.parse(date)) / 864e5;
    let api;
    if (ageDays <= 0) api = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
    else if (ageDays < 60) api = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,weather_code&start_date=${date}&end_date=${date}&timezone=auto`;
    else api = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,weather_code&start_date=${date}&end_date=${date}&timezone=auto`;
    const r = await fetch(api);
    if (!r.ok) return json({ error: 'Weather is unavailable for that date.' }, 502);
    const w = await r.json();
    const temp = w.current ? w.current.temperature_2m : w.daily?.temperature_2m_max?.[0];
    const code = w.current ? w.current.weather_code : w.daily?.weather_code?.[0];
    if (temp == null) return json({ error: 'No weather found for that date.' }, 404);
    return json({ text: `${Math.round(temp)}°C, ${WMO[code] || 'mixed'}` });
  }

  // ---- Friends ----
  if (p.startsWith('friends')) {
    const fkey = url.searchParams.get('friend') || '';
    // Your site's own address, as friends will reach it, is taken from the back office itself.
    await friends.rememberMe(env, url.origin);
    let body = {};
    if (m === 'POST') {
      try {
        body = await request.json();
      } catch {}
    }
    try {
      if (p === 'friends' && m === 'GET') return json(await friends.friendsOverview(env, url.origin));
      // Your site has moved to another address: tell your friends (or tell the ones who missed it).
      if (p === 'friends/address' && m === 'POST') {
        const out = await friends.moveSite(env, String(body.address || ''));
        await bumpVersion(env);
        return json(out);
      }
      if (p === 'friends/tell' && m === 'POST') return json(await friends.tellFriends(env));
      // Your friend code (the same every time), or a new one, or switched off or on.
      if (p === 'friends/invite' && m === 'POST') return json(await friends.friendCode(env, 'get'));
      if (p === 'friends/code' && m === 'POST') return json(await friends.friendCode(env, ['new', 'off', 'on'].includes(body.action) ? body.action : 'get'));
      // (Each of these changes the Friends tab on your site, so it's redrawn at once.)
      if (p === 'friends/add' && m === 'POST') {
        const out = await friends.useInvite(env, String(body.code || ''), parseSite(await readText(env, 'site.md')));
        await bumpVersion(env);
        return json(out);
      }
      if (p === 'friends/refresh' && m === 'POST') {
        const out = await friends.refreshFriends(env, fkey || undefined);
        await bumpVersion(env);
        return json(out);
      }
      if (p === 'friends/remove' && m === 'POST') {
        await friends.removeFriend(env, fkey);
        await bumpVersion(env);
        return json({ ok: true });
      }
      if (p === 'friends/settings' && m === 'POST') {
        const out = await friends.setFriendSettings(env, body);
        await bumpVersion(env);
        return json({ ok: true, ...out });
      }
      if (p === 'friends/photo' && m === 'GET') return friends.friendPhoto(env, fkey, url.searchParams.get('p') || '');
    } catch (e) {
      return json({ error: String(e.message || e) }, 400);
    }
    return json({ error: 'Not found' }, 404);
  }

  // The whole bucket as one zip, written out file by file as it downloads, so it works however
  // many photos there are (it never has to fit in memory). ?photos=0 leaves the photos out.
  if (p === 'export' && m === 'GET') {
    const withPhotos = url.searchParams.get('photos') !== '0';
    const objects = (await listAll(env)).filter((o) => !o.key.startsWith('data/_') && (withPhotos || /\.(md|json|txt)$/i.test(o.key)));
    const day = new Date().toISOString().slice(0, 10);
    const slug = siteSlug(parseSite(await readText(env, 'site.md')).name);
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const zip = new Zip((err, chunk, final) => {
      if (err) return writer.abort(err).catch(() => {});
      writer.write(chunk).catch(() => {});
      if (final) writer.close().catch(() => {});
    });
    const work = (async () => {
      try {
        for (const o of objects) {
          const obj = await env.CONTENT.get(o.key);
          if (!obj) continue;
          const bytes = new Uint8Array(await obj.arrayBuffer());
          // Text is squeezed; photos are already compressed, so they go in as they are.
          const entry = /\.(md|json|txt)$/i.test(o.key) ? new ZipDeflate(o.key, { level: 6 }) : new ZipPassThrough(o.key);
          entry.mtime = o.uploaded ? new Date(o.uploaded) : new Date();
          zip.add(entry);
          entry.push(bytes, true);
          // Wait for the download to catch up before reading the next file.
          await writer.ready;
        }
        zip.end();
      } catch (e) {
        console.error(e);
        writer.abort(e).catch(() => {});
      }
    })();
    ctx.waitUntil(work);
    const name = `${slug}-${withPhotos ? '' : 'posts-'}${day}.zip`;
    return new Response(readable, {
      headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' }
    });
  }

  return json({ error: 'Not found' }, 404);
}

function userAgent(env) {
  const email = String(env.CONTACT_EMAIL || '').trim();
  const contact = email && !/^none$/i.test(email) ? ` (${email})` : '';
  return `PersonalBlogBackOffice/1.0${contact}`;
}

function simplifyPlace(r) {
  const a = r.address || {};
  const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || '';
  const area = a.suburb || a.neighbourhood || a.quarter || a.city_district || '';
  return {
    name: r.name || (r.display_name || '').split(',')[0],
    display: r.display_name || '',
    lat: r.lat != null ? Number(Number(r.lat).toFixed(5)) : null,
    lon: r.lon != null ? Number(Number(r.lon).toFixed(5)) : null,
    area: [area, city].filter(Boolean).join(', '),
    city,
    country: a.country || '',
    country_code: (a.country_code || '').toUpperCase()
  };
}
