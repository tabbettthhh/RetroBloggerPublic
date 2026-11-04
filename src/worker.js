// The whole server. It reads Markdown from the R2 bucket, serves the site,
// and runs the back office API (only reachable through Cloudflare Access).

import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import { stripImage, UnsupportedImage, CLEAN_TYPES } from './strip.js';
import { parseVisited } from './content.js';
import { TYPES, buildPost, isVisible, todayIn, parseFortunes, parseWishlist, parseSite, parseStatusLog, parseCategories, parseTravel, parsePassport, parseKeepsakeSettings, parseTheme, parseHighlights, parseHighlightsPast, parsePlanner, parseGuestbookEntry, parseComment, isCommentKey, splitFrontMatter, headerProblem } from './content.js';
import { adminCheck } from './auth.js';
import { VERSION } from './version.js';
import * as friends from './friends.js';
import * as push from './push.js';

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
      // (Someone opening a page gets a page saying so, with a way to try again; anything else, a
      // short answer it can read.)
      const page = request.method === 'GET' && (request.headers.get('Accept') || '').includes('text/html');
      res = page
        ? new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>One moment</title><body style="font-family:Tahoma,sans-serif;padding:24px;max-width:560px;line-height:1.5"><h1 style="font-size:20px">The site hit a snag</h1><p>Something went wrong for a moment. Try again in a few seconds.</p><p><a href="" style="display:inline-block;padding:8px 14px;border:1px solid #003c74;border-radius:3px;background:#ecebe6;color:#000;text-decoration:none">Try again</a></p></body>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '5' } })
        : json({ error: 'Something went wrong on the server.' }, 500);
    }
    return finish(res, new URL(request.url).pathname);
  },
  // Every 20 minutes: read your friends' sites for new posts and statuses (in case one was
  // offline when it had news), and tell them about a post of yours that has just gone live.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      Promise.all([
        friends
          .refreshFriends(env)
          .then((r) => r.of && bumpVersion(env))
          .catch((e) => console.error(e)),
        friends.shareNews(env, buildEverything).catch((e) => console.error(e)),
        // (A post scheduled for later that has just gone live: visitors who asked hear about it.)
        announce(env).catch((e) => console.error(e))
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
  // The site's own scripts and styles, under this deploy's id (see deployId below).
  const pinned = PINNED.exec(p);
  if (pinned) return pinnedFile(request, env, url, pinned[1], pinned[2]);
  if (p.startsWith('/v/')) return new Response('Not found', { status: 404 });

  if (p === '/admin' || p.startsWith('/admin/')) {
    const check = await adminCheck(request, env);
    if (!check.ok) return lockedPage(check, url, p.startsWith('/admin/api/'));
    // Signing in from the owner's tile on the welcome screen: once Cloudflare Access has let you
    // through, back to the site (where it's on), never to a separate back office.
    if (p === '/admin/signin') {
      const to = url.searchParams.get('to') || '';
      const back = /^#\/[\w\-/%.]*$/.test(to) ? to : '#/';
      return new Response(null, { status: 302, headers: { Location: `/?owner=1${back}`, 'Cache-Control': 'no-store' } });
    }
    // There's no separate back office any more: /admin is your site, signed in. (The plain
    // editor at /admin/plain is kept as a safety net, in case something on the site isn't
    // working.)
    if (p === '/admin' || p === '/admin/' || p === '/admin/index.html') return new Response(null, { status: 302, headers: { Location: '/?owner=1#/', 'Cache-Control': 'no-store' } });
    if (p.startsWith('/admin/api/')) {
      // Changes only ever come from your own site's pages (never a form on someone else's).
      const origin = request.headers.get('Origin');
      if (method !== 'GET' && origin && origin !== url.origin) return json({ error: 'Not from this site.' }, 403);
      const res = await adminApi(request, env, url, ctx);
      // Anything saved might be news for your friends: their sites hear straight away (and
      // nothing is sent when what they see hasn't changed).
      if (method !== 'GET' && res.ok) ctx.waitUntil(friends.shareNews(env, buildEverything).catch((e) => console.error(e)));
      // (And a post that has just gone on the site is announced to visitors who asked.)
      if (method !== 'GET' && res.ok) ctx.waitUntil(announce(env, url.origin).catch((e) => console.error(e)));
      return res;
    }
    return ownerFile(request, env, url);
  }

  if (p === '/api/all' && method === 'GET') return apiAll(request, env, ctx);
  if (p === '/api/visit' && method === 'POST') return visit(request, env);
  if (p === '/api/guestbook' && method === 'POST') return signGuestbook(request, env, ctx);
  if (p === '/api/comment' && method === 'POST') return leaveComment(request, env, ctx);
  if (p === '/api/suggest' && method === 'POST') return suggest(request, env, ctx);
  // Visitors asking to hear when you post (only while you let them), and changing their minds.
  if (p === '/api/push/key' && method === 'GET') {
    const on = (await push.settings(env)).visitors;
    return json({ on, key: on ? await push.publicKey(env) : '' }, 200, { 'Cache-Control': 'no-store' });
  }
  if (p === '/api/push/subscribe' && method === 'POST') {
    if (looksLikeBot(request)) return json({ error: 'Not accepted' }, 400);
    const out = await push.subscribeVisitor(env, await request.json().then((b) => (b && typeof b === 'object' ? b : {}), () => ({})));
    return json(out.ok ? { ok: true } : { error: out.error }, out.status || 200);
  }
  if (p === '/api/push/unsubscribe' && method === 'POST') {
    const body = await request.json().then((b) => (b && typeof b === 'object' ? b : {}), () => ({}));
    return json(await push.unsubscribe(env, body?.endpoint, 'visitor'));
  }
  if (p === '/api/nudge' && method === 'POST') return nudge(request, env);
  if (p === '/api/react' && method === 'POST') return react(request, env);
  if (p.startsWith('/media/') && (method === 'GET' || method === 'HEAD')) return media(request, env, p);
  // Photos in your Friends feed, fetched from your friends' sites by yours.
  if (p.startsWith('/friends-media/') && method === 'GET') {
    let parts;
    try {
      parts = p.slice('/friends-media/'.length).split('/').map(decodeURIComponent);
    } catch {
      return new Response('Bad path', { status: 400 });
    }
    // (Signed in, you see the photos of every post of theirs you have, friends-only ones too.)
    // (Only a browser's own request is checked: a sign-in only ever arrives with one.)
    const mine = (request.headers.has('Cookie') || request.headers.get('Sec-Fetch-Site') === 'same-origin') && (await adminCheck(request, env)).ok;
    return friends.friendPhotoForVisitor(env, parts[0], parts.slice(1).join('/'), mine);
  }
  // Friends' sites talking to yours (every request signed with the secret you share).
  if (p.startsWith('/api/friends/')) return friends.friendsApi(request, env, p, { buildEverything, mediaForFriend: (key) => friendMedia(env, key), friendComment: (who, info) => friendComment(env, who, info, ctx, url.origin), changed: () => bumpVersion(env), news: () => friends.shareNews(env, buildEverything), waitUntil: (work) => ctx.waitUntil(work) });
  if (p.startsWith('/api/')) return json({ error: 'Not found' }, 404);

  return staticFile(request, env, p);
}

// Fonts, the map and photo libraries, icons and cursors hardly ever change, so browsers keep
// them for a month instead of asking again on every visit. (Change one? Give it a new name.)
const LONG_LIVED = /^\/(fonts|vendor|icons|cursors)\//;
async function staticFile(request, env, path) {
  const page = path === '/' || path.endsWith('.html');
  const res = await env.ASSETS.fetch(page ? unconditional(request) : request);
  // (The notifications worker is always checked afresh, so a change to it reaches every device.)
  if (path === '/sw.js' && res.status === 200) {
    const sw = new Response(res.body, res);
    sw.headers.set('Cache-Control', 'no-cache');
    return sw;
  }
  if (page) return pointAtDeploy(res, env);
  if (!LONG_LIVED.test(path) || res.status !== 200) return res;
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'public, max-age=2592000');
  return out;
}

// The site's own scripts and styles change with each update, but not in between. Every deploy has
// an id of its own (from Cloudflare, see "version_metadata" in wrangler.jsonc), and the page asks
// for them under it: /v/<id>/js/app.js. A browser keeps those for good, instead of checking all
// sixty-odd files on every visit; the next deploy has a new id, so new addresses, and an update
// still shows at once. (Without an id, as on a copy whose settings predate this, everything is
// asked for as before and checked each visit.)
function deployId(env) {
  const id = env.CF_VERSION_METADATA?.id;
  return typeof id === 'string' && /^[\w-]{8,64}$/.test(id) ? id : '';
}
const PINNED = /^\/v\/([\w-]{8,64})(\/(?:js|css)\/[\w-]+\.(?:js|css))$/;
const ID_OK = /^[\w-]{8,64}$/;
// For good when it's this deploy's file. A page loaded just before a deploy may still ask under the
// old id: it gets the new file, checked again next time. (On your own computer, always checked,
// so a file you're editing shows as soon as you save it.)
function keepFor(env, url, id, who) {
  const local = env.DEV_ADMIN === 'true' && ['localhost', '127.0.0.1'].includes(url.hostname);
  return id === deployId(env) && !local ? `${who}, max-age=31536000, immutable` : `${who}, no-cache`;
}
// The same request without "only if it changed" (a page must come fresh, to point at the
// latest deploy's files).
function unconditional(request) {
  const r = new Request(request);
  r.headers.delete('If-None-Match');
  r.headers.delete('If-Modified-Since');
  return r;
}
async function pinnedFile(request, env, url, id, path) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const res = await env.ASSETS.fetch(new Request(url.origin + path, request));
  if (res.status !== 200) return res;
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', keepFor(env, url, id, 'public'));
  return out;
}
// A page, pointing at this deploy's scripts and styles. (Your owner tools, under /admin, keep
// their own address, so Cloudflare Access still guards them: they're marked with the id instead.)
async function pointAtDeploy(res, env) {
  const id = deployId(env);
  if (res.status !== 200 || !id || !(res.headers.get('Content-Type') || '').includes('text/html')) return res;
  const html = (await res.text())
    .replace(/((?:href|src)=")\/((?:js|css)\/[\w-]+\.(?:js|css))"/g, `$1/v/${id}/$2"`)
    .replace(/((?:href|src)=")\/(admin\/[\w-]+\.(?:js|css))"/g, `$1/$2?v=${id}"`);
  const headers = new Headers(res.headers);
  headers.delete('Content-Length');
  headers.delete('ETag');
  headers.set('Cache-Control', 'no-cache');
  return new Response(html, { status: 200, headers });
}
// Your owner tools' files (only ever reached past the lock). Asked for with this deploy's id
// (?v=…), they're kept like the site's own, privately, and point at the same copies of the site's
// scripts as the site itself, so the two share them.
async function ownerFile(request, env, url) {
  const p = url.pathname;
  const v = url.searchParams.get('v') || '';
  const id = ID_OK.test(v) ? v : '';
  const page = !/\.\w+$/.test(p) || p.endsWith('.html');
  let res = await env.ASSETS.fetch(page ? unconditional(request) : id ? new Request(url.origin + p, request) : request);
  if (page) {
    res = await pointAtDeploy(res, env);
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'no-store');
    return out;
  }
  if (id && res.status === 200 && p.endsWith('.js')) {
    const text = (await res.text())
      .replace(/(['"])\/((?:js|css)\/[\w-]+\.(?:js|css))\1/g, `$1/v/${id}/$2$1`)
      .replace(/(['"])\/(admin\/[\w-]+\.(?:js|css|json))\1/g, `$1/$2?v=${id}$1`);
    const headers = new Headers(res.headers);
    headers.delete('Content-Length');
    headers.delete('ETag');
    res = new Response(text, { status: 200, headers });
  }
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', id && res.status === 200 ? keepFor(env, url, id, 'private') : 'private, no-cache');
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
  if (isApi) return json({ error: `Signing in isn’t working: ${title.replace(/’/g, "'")}.`.replace(/’/g, "'"), why: check.why }, 403);
  if (check.why === 'setup') return setupGuide(url);
  const body = how.replace('{host}', esc(url.hostname)).replace('{email}', esc(check.email || ''));
  const signOut = ['bad', 'expired', 'email', 'audience'].includes(check.why) ? '<p><a href="/cdn-cgi/access/logout" style="display:inline-block;padding:8px 14px;border:1px solid #003c74;border-radius:3px;background:#ecebe6;color:#000;text-decoration:none">Sign out, then sign in again</a></p>' : '';
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Back office</title><body style="font-family:Tahoma,sans-serif;padding:24px;max-width:620px;line-height:1.5">' +
      `<h1 style="font-size:22px">Your owner tools are locked</h1><h2 style="font-size:17px;color:#0d3a9a">${title}</h2><p>${body}</p>${signOut}` +
      '<p style="color:#666;font-size:13px">Only the site’s owner can sign in here. If that’s not you, there’s nothing to see here: <a href="/">back to the site</a>.</p></body>',
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
    'The goal: lock the owner’s sign-in (the /admin part of my site) so only I can get in, using Cloudflare Zero Trust Access (free plan). The rest of the site stays public.',
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
    `6. Visit https://${host}/admin. Cloudflare should email me a code; once I'm in, we're done. If the page says my owner tools are locked, it explains why: help me fix what it says.`,
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
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Set up signing in</title>' +
    '<body style="font-family:Tahoma,sans-serif;padding:24px;max-width:680px;line-height:1.55;color:#1b1b1b">' +
    '<h1 style="font-size:22px;margin-bottom:4px">Your site is online. One more step!</h1>' +
    '<p style="margin-top:0">Signed in, you write posts and change everything right on your site. Signing in stays shut until you lock it so that only you can get in. It takes about ten minutes, and costs nothing.</p>' +
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
// The cache file as this copy of the server last read or wrote it: read again (and worked
// through again, which for hundreds of posts is most of the work) only when it has changed.
const parsedKept = new WeakMap();
async function readParsed(env) {
  const kept = parsedKept.get(env);
  try {
    const obj = await env.CONTENT.get(PARSED_CACHE, kept ? { onlyIf: { etagDoesNotMatch: kept.etag } } : {});
    if (!obj) return {};
    if (kept && !('body' in obj)) return kept.c;
    const c = JSON.parse(await obj.text());
    parsedKept.set(env, { etag: obj.etag, c });
    return c;
  } catch {
    return {};
  }
}
const PARSED_VERSION = 33; // bump when buildPost changes shape

// "reading [book]" (or [film], [podcast], [music]) becomes "reading The Remains of the Day" while a book is marked as reading.
function fillStatus(status, posts) {
  if (!status) return status;
  const current = (type) => posts.find((p) => p.type === type && p.state === 'now');
  const TYPE = { book: 'books', film: 'films', podcast: 'podcasts', music: 'music', album: 'music', song: 'music', tv: 'tv', show: 'tv' };
  return status.replace(/\[(book|film|podcast|music|album|song|tv|show)\]/g, (m, kind) => current(TYPE[kind])?.title || m);
}

// Marks that something changed, so everything worked out before is worked out again. (Storage
// takes one change a second to any one file: a change straight after another, a few photos
// uploaded one after the other say, waits a moment and tries again, rather than failing the save.)
async function bumpVersion(env) {
  const put = () => env.CONTENT.put('data/_version', String(Date.now()));
  try {
    await put();
  } catch {
    await new Promise((r) => setTimeout(r, 1100));
    await put().catch((e) => console.error('version', e?.message || e));
  }
}

function tzOffset(env) {
  return env.TIMEZONE || 'Europe/London';
}

// includeHidden: everything, for the back office. forFriends: what's live, friends-only posts too
// (for your friends' sites). Otherwise: what the public sees.
// (The back office's view is always worked out fresh; the site's and your friends' are shared, see
// everything() below.)
function buildEverything(env, opts = {}) {
  return opts.includeHidden ? buildFresh(env, opts) : everything(env, opts);
}
async function buildFresh(env, { includeHidden = false, forFriends = false } = {}) {
  const tz = tzOffset(env);
  const objects = await listAll(env);
  const mdKeys = objects.map((o) => o.key).filter((k) => k.endsWith('.md'));

  const postKeys = mdKeys.filter((k) => {
    const [folder, file, more] = k.split('/');
    return TYPES.includes(folder) && file && !more;
  });
  // Parsed posts are kept in one cache file and only re-read when a file changes, so a big
  // shelf (hundreds of imported books) doesn't mean hundreds of reads on every visit. Comments
  // and guestbook entries are kept in it too.
  const etags = new Map(objects.map((o) => [o.key, o.etag]));
  let cache = {};
  let extras = {};
  const c = await readParsed(env);
  if (c.v === PARSED_VERSION && c.tz === tz) (cache = { ...c.posts }), (extras = { ...c.extras });
  // (Cloudflare lets one visit read only so many files: a big refresh, after an update say, is
  // finished over the next few visits. Until then a changed post shows as it was, and a new one
  // a moment later.)
  const stale = postKeys.filter((k) => cache[k]?.etag !== etags.get(k));
  const todo = stale.slice(0, READS_PER_BUILD);
  const texts = await Promise.all(todo.map((k) => readText(env, k)));
  todo.forEach((k, i) => {
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
  const gbKeys = mdKeys.filter((k) => k.startsWith('guestbook/'));
  const commentKeys = mdKeys.filter((k) => isCommentKey(k));
  // (Visitors' ♥, ☆ and smiles: one small file for each post that has any.)
  const reactionKeys = objects.map((o) => o.key).filter((k) => REACTION_FILE.test(k));
  const extraKeys = [...gbKeys, ...commentKeys, ...reactionKeys];
  const extraStale = extraKeys.filter((k) => extras[k]?.etag !== etags.get(k));
  const extraTodo = extraStale.slice(0, Math.max(0, READS_PER_BUILD - todo.length));
  const extraTexts = await Promise.all(extraTodo.map((k) => readText(env, k)));
  extraTodo.forEach((k, i) => {
    if (extraTexts[i] == null) return;
    try {
      extras[k] = { etag: etags.get(k), value: k.startsWith('guestbook/') ? parseGuestbookEntry(k, extraTexts[i]) : k.startsWith('reactions/') ? reactionCounts(extraTexts[i]) : parseComment(k, extraTexts[i]) };
    } catch (e) {
      console.error(k, e);
    }
  });
  let dropped = false;
  const keep = new Set(postKeys);
  for (const k of Object.keys(cache)) if (!keep.has(k)) (delete cache[k], (dropped = true));
  const keepExtra = new Set(extraKeys);
  for (const k of Object.keys(extras)) if (!keepExtra.has(k)) (delete extras[k], (dropped = true));
  // (Saving it is a nicety: if several visits try at once, one of them saves it.)
  if (todo.length || extraTodo.length || dropped) {
    const fresh = { v: PARSED_VERSION, tz, posts: cache, extras };
    await env.CONTENT.put(PARSED_CACHE, JSON.stringify(fresh)).then(
      (o) => o && parsedKept.set(env, { etag: o.etag, c: fresh }),
      (e) => console.error('parsed cache', e?.message || e)
    );
  }
  const partial = stale.length > todo.length || extraStale.length > extraTodo.length;
  const now = Date.now();
  const posts = [];
  for (const k of postKeys) {
    const post = cache[k]?.post;
    if (post && (includeHidden || (isVisible(post, now) && (forFriends || !post.friends_only)))) posts.push(post);
  }
  posts.sort((a, b) => b.ts - a.ts || b.slug.localeCompare(a.slug));

  const parsedGuestbook = gbKeys.map((k) => extras[k]?.value).filter(Boolean);
  const parsedComments = commentKeys.map((k) => extras[k]?.value).filter(Boolean);
  const guestbook = parsedGuestbook.map(({ key, ...rest }) => rest).sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const [siteText, wishText, travelText, logText, catText, passportText, keepText, themeText, highlightsText, plannerText, fortuneText] = await Promise.all([
    readText(env, 'site.md'),
    readText(env, 'wishlist.md'),
    readText(env, 'travel.md'),
    readText(env, 'status-log.md'),
    readText(env, 'categories.md'),
    readText(env, 'passport.md'),
    readText(env, 'keepsakes.md'),
    readText(env, 'theme.md'),
    readText(env, 'highlights.md'),
    readText(env, 'planner.md'),
    readText(env, 'fortunes.md')
  ]);
  // The highlights cabinet: only posts that are on the site (the back office sees them all), and
  // each of them marked with its place on its shelf, for the rosette on its card.
  const highlights = {};
  const byKey = new Map(posts.map((p, i) => [`${p.type}/${p.slug}`, i]));
  for (const [shelf, list] of Object.entries(parseHighlights(highlightsText))) {
    const kept = includeHidden ? list : list.filter((x) => byKey.has(x.post) && !posts[byKey.get(x.post)].friends_only);
    if (kept.length) highlights[shelf] = kept;
    kept.forEach((x, i) => byKey.has(x.post) && (posts[byKey.get(x.post)] = { ...posts[byKey.get(x.post)], highlight: i + 1 }));
  }
  // Once in the cabinet: the room's library of former highlights (on the site, only posts still
  // there and not back in the cabinet).
  const inCabinet = new Set(Object.values(highlights).flat().map((x) => x.post));
  const highlightsPast = parseHighlightsPast(highlightsText).filter((x) => includeHidden || (byKey.has(x.post) && !posts[byKey.get(x.post)].friends_only && !inCabinet.has(x.post)));

  const site = parseSite(siteText);
  // Approved comments, each with its post (and none at all while comments are switched off).
  const byPost = {};
  if (site.comments)
    for (const { key, post, ...c } of parsedComments) (byPost[post] ||= []).push(c);
  for (let i = 0; site.comments && i < posts.length; i++) {
    const list = (byPost[`${posts[i].type}/${posts[i].slug}`] || []).sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id));
    posts[i] = { ...posts[i], comments: list.slice(0, 300) };
  }
  // Reactions on each post (only the ones that have any; none at all while they're off).
  if (site.reactions)
    for (let i = 0; i < posts.length; i++) {
      const r = extras[`reactions/${posts[i].type}/${posts[i].slug}.json`]?.value;
      if (r && (r.heart || r.star || r.grin || r.custom)) posts[i] = { ...posts[i], reactions: r };
    }
  // Series: each post's part, out of how many, and the ones either side (by date).
  const series = new Map();
  for (const p of posts) if (p.series) (series.get(p.series.toLowerCase()) || series.set(p.series.toLowerCase(), []).get(p.series.toLowerCase())).push(p);
  if (series.size) {
    const info = new Map();
    const brief = (p) => (p ? { type: p.type, slug: p.slug, title: p.title || '' } : null);
    for (const list of series.values()) {
      list.sort((a, b) => a.ts - b.ts || a.slug.localeCompare(b.slug));
      list.forEach((p, i) => info.set(p, { name: list[0].series, part: i + 1, of: list.length, prev: brief(list[i - 1]), next: brief(list[i + 1]) }));
    }
    for (let i = 0; i < posts.length; i++) if (info.has(posts[i])) posts[i] = { ...posts[i], series_info: info.get(posts[i]) };
  }
  // While you're away: on the days you set, that status shows (and how you show), then yours
  // comes back by itself. Visitors never see the dates.
  const away = site.away;
  if (away && away.from <= todayIn(tz) && todayIn(tz) <= away.to) {
    if (away.status) site.status = away.status;
    site.presence = away.presence;
    site.status_updated = Date.parse(away.from) || site.status_updated;
    site.away_on = true;
  }
  if (!includeHidden) delete site.away;
  site.status = fillStatus(site.status, posts);
  // Past statuses, newest first, without the one that's showing now.
  site.history = parseStatusLog(logText)
    .filter((e, i) => !(i === 0 && e.text === site.status))
    .slice(0, 30);
  const out = {
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
    highlights,
    highlightsPast,
    // The planner's lists (private ones only in the back office).
    planner: parsePlanner(plannerText).filter((l) => includeHidden || !l.private),
    guestbook,
    // The lines in your fortune cookie.
    fortunes: parseFortunes(fortuneText),
    generated: now
  };
  // (Not sent anywhere: for the back office, which lists every file and comment, and to know
  // whether the big refresh above is still under way.)
  Object.defineProperty(out, 'inside', { value: { objects, comments: parsedComments, guestbook: parsedGuestbook, partial } });
  return out;
}

// ---------- reactions ----------
// A ♥, a ☆ or a smile on a post, from anyone: only how many of each is kept, with the times of
// the last few (to slow down anyone tapping away), and nothing about who.
const REACTIONS = ['heart', 'star', 'grin'];
const REACTION_FILE = /^reactions\/[a-z]+\/[^/]+\.json$/;
// Visitors' own emoji too: any one emoji (not words, not flags), up to a dozen different ones on a post.
const MAX_CUSTOM = 12;
const ONE_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\p{Emoji_Modifier}|\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})\uFE0F?)*$/u;
export function oneEmoji(s) {
  const t = String(s ?? '').trim();
  if (!t || t.length > 16 || !ONE_EMOJI.test(t) || /[\u{1F1E6}-\u{1F1FF}]/u.test(t) || /^[\d#*]/.test(t)) return '';
  try {
    if ([...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(t)].length !== 1) return '';
  } catch {}
  return t;
}
function reactionCounts(text) {
  let r = {};
  try {
    r = JSON.parse(text) || {};
  } catch {}
  const out = Object.fromEntries(REACTIONS.map((k) => [k, Math.max(0, Math.floor(Number(r[k]) || 0))]));
  const custom = Object.entries(r.custom && typeof r.custom === 'object' ? r.custom : {})
    .map(([e, n]) => [oneEmoji(e), Math.max(0, Math.floor(Number(n) || 0))])
    .filter(([e, n]) => e && n)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CUSTOM);
  if (custom.length) out.custom = Object.fromEntries(custom);
  return out;
}
async function react(request, env) {
  if (looksLikeBot(request)) return json({ error: 'Not accepted' }, 400);
  let body;
  try {
    body = await readBody(request);
  } catch {
    return json({ error: 'Could not read that.' }, 400);
  }
  const emoji = body.kind === 'custom' ? oneEmoji(body.emoji) : '';
  const kind = REACTIONS.includes(body.kind) || emoji ? body.kind : '';
  if (!kind) return json({ error: body.kind === 'custom' ? 'That isn’t one emoji.' : 'Pick a ♥, a ☆ or a smile.' }, 400);
  const [type, slug] = String(body.post || '').split('/');
  const data = await buildEverything(env);
  if (!data.site.reactions) return json({ error: 'Reactions are switched off here.' }, 403);
  if (!data.posts.some((p) => p.type === type && p.slug === slug)) return json({ error: 'That post isn’t here any more.' }, 404);
  const key = `reactions/${type}/${slug}.json`;
  let r = {};
  try {
    r = JSON.parse((await readText(env, key)) || '{}') || {};
  } catch {}
  const now = Date.now();
  const recent = (Array.isArray(r.recent) ? r.recent : []).filter((t) => now - t < 10 * 60 * 1000);
  const undo = body.undo === true || body.undo === 'true';
  if (!undo && recent.length >= 60) return json({ error: 'Lots of reactions just now. Try again in a few minutes.' }, 429);
  const counts = reactionCounts(JSON.stringify(r));
  if (emoji) {
    const custom = { ...(counts.custom || {}) };
    if (!(emoji in custom) && !undo && Object.keys(custom).length >= MAX_CUSTOM) return json({ error: 'That post has lots of emoji already: tap one of those.' }, 409);
    custom[emoji] = Math.max(0, (custom[emoji] || 0) + (undo ? -1 : 1));
    if (!custom[emoji]) delete custom[emoji];
    if (Object.keys(custom).length) counts.custom = custom;
    else delete counts.custom;
  } else counts[kind] = Math.max(0, counts[kind] + (undo ? -1 : 1));
  if (!undo) recent.push(now);
  // (Several in the same second: the one that didn't fit says try again.)
  const kept = await env.CONTENT.put(key, JSON.stringify({ ...counts, recent }), { httpMetadata: { contentType: 'application/json' } }).then(() => true, () => false);
  if (!kept) return json({ error: 'Lots of reactions just now. Try again in a moment.' }, 429);
  // (So everyone sees it next time they look, not a few minutes later.)
  await bumpVersion(env);
  return json({ ok: true, counts });
}

// The site, worked out once and shared by the requests that arrive together (a page's photos all
// ask at once), until anything changes (every save marks a new version), or for a minute at
// most. Whoever uses it must leave what they're given as it is (they get their own copy of the
// top level and the list of posts, to add to).
const READS_PER_BUILD = 500;
const builds = new WeakMap();
async function everything(env, opts = {}) {
  const version = (await readText(env, 'data/_version').catch(() => null)) || '0';
  const key = `${version}|${Math.floor(Date.now() / 60000)}|${opts.forFriends ? 'friends' : 'public'}`;
  let mine = builds.get(env);
  if (!mine) builds.set(env, (mine = new Map()));
  let job = mine.get(key);
  if (!job) {
    job = buildFresh(env, { forFriends: !!opts.forFriends });
    mine.set(key, job);
    // (Only the latest few, and never one that failed or isn't finished.)
    job.then((d) => d.inside.partial && mine.delete(key), () => mine.delete(key));
    while (mine.size > 4) mine.delete(mine.keys().next().value);
  }
  const data = await job;
  const copy = { ...data, posts: [...data.posts] };
  Object.defineProperty(copy, 'inside', { value: data.inside });
  return copy;
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

  // (Kept here as well as in Cloudflare's cache: that one isn't there at a workers.dev address.)
  const memoKey = `${version}|${slot}`;
  const kept = lastAll.get(env);
  if (kept?.key === memoKey) return new Response(kept.text, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache', ETag: etag } });
  const cacheKey = new Request(`https://cache.internal/api/all?v=${encodeURIComponent(version)}&t=${slot}`);
  const cache = caches.default;
  let res = await cache.match(cacheKey);
  let partial = false;
  if (!res) {
    const data = await buildEverything(env);
    partial = data.inside.partial;
    // Visitors get the finished HTML; the raw Markdown and file names stay for the back office.
    data.posts = data.posts.map(({ body, files, key, ...p }) => p);
    // Your friends: who they are and how they are, and their latest posts (only if you've chosen
    // to show them to everyone: otherwise they're just for you, signed in).
    const pals = await friends.publicFriends(env).catch(() => ({ buddies: [], posts: [] }));
    data.buddies = pals.buddies;
    data.friendPosts = pals.posts;
    data.friendLooks = pals.looks || {};
    // (Their keepsake designs and place categories, for drawing their posts as on their site.)
    data.friendKeepsakes = pals.keepsakes || [];
    data.friendCategories = pals.categories || [];
    // (No Friends tab when you don't show friends' posts; the friends list, if shown, is on About.)
    data.friendsTab = !!pals.postsShown;
    // (Whether visitors can ask to hear when you post.)
    data.notifyPosts = (await push.settings(env).catch(() => ({}))).visitors === true;
    res = json(data, 200, { 'Cache-Control': 'public, max-age=300' });
    if (!partial) ctx.waitUntil(cache.put(cacheKey, res.clone()).catch(() => {}));
  }
  const text = await res.text();
  if (!partial) lastAll.set(env, { key: memoKey, text });
  // (Still filling in after an update: no tag, so the browser asks again next time.)
  return new Response(text, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache', ...(partial ? {} : { ETag: etag }) } });
}
const lastAll = new WeakMap();

async function media(request, env, path) {
  let key;
  try {
    key = decodeURIComponent(path.slice('/media/'.length));
  } catch {
    return new Response('Bad path', { status: 400 });
  }
  // A friends-only post's photos aren't for the public (the back office still sees them).
  const [type, slug] = key.split('/');
  if (type && slug && (await friendsOnlyPost(env, type, slug)) && !(await adminCheck(request, env)).ok) return new Response('Not found', { status: 404 });
  return mediaFor(env, key, request.method === 'HEAD', request.headers.get('If-None-Match'));
}
async function friendsOnlyPost(env, type, slug) {
  const { posts } = await buildEverything(env, { forFriends: true });
  return posts.some((p) => p.type === type && p.slug === slug && p.friends_only);
}

// For a friend's site: a photo only if it belongs to a post that's published (not a draft, not
// scheduled for later).
async function friendMedia(env, key) {
  const [type, slug, file, more] = String(key).split('/');
  if (more !== undefined) return new Response('Not found', { status: 404 });
  const { posts } = await buildEverything(env, { forFriends: true });
  const post = posts.find((x) => x.type === type && x.slug === slug);
  if (!post || !post.files.includes(file)) return new Response('Not found', { status: 404 });
  return mediaFor(env, key);
}

async function mediaFor(env, key, head = false, ifNoneMatch = '') {
  const [folder] = key.split('/');
  const ext = (key.split('.').pop() || '').toLowerCase();
  if (!(TYPES.includes(folder) || folder === 'design') || !IMAGE_TYPES[ext] || key.includes('..')) return new Response('Not found', { status: 404 });
  // A browser that has this photo already (and asks whether it's changed) is told it hasn't,
  // without sending it again.
  const known = String(ifNoneMatch || '').replace(/^W\//, '');
  const obj = await (known ? env.CONTENT.get(key, { onlyIf: { etagDoesNotMatch: known.replace(/"/g, '') } }) : env.CONTENT.get(key));
  if (!obj) return new Response('Not found', { status: 404 });
  if (known && !('body' in obj)) return new Response(null, { status: 304, headers: { ETag: obj.httpEtag, 'Cache-Control': 'private, max-age=10800' } });
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
  // (Lots of visitors in the same second: some aren't counted, rather than anything going wrong.)
  await env.CONTENT.put('data/counter.json', JSON.stringify({ count }), { httpMetadata: { contentType: 'application/json' } }).catch(() => {});
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
  // (Several in the same second: the one that didn't fit says try again.)
  const kept = await env.CONTENT.put('data/nudges.json', JSON.stringify(n), { httpMetadata: { contentType: 'application/json' } }).then(() => true, () => false);
  if (!kept) return json({ ok: false, error: 'Lots of nudges right now. Try again in a moment.' }, 429);
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
  // (To the thousandth of a second, so two left in the same second keep their order: an older
  // name, without the thousandths, still sorts before a newer one from that second.)
  return { iso, file: iso.replace(/[-:]/g, '').replace(/\.(\d+)Z$/, '$1') + '-' + rand };
}

async function readBody(request) {
  const type = request.headers.get('Content-Type') || '';
  // (Anything but a set of fields, "null" say, counts as an empty form.)
  const fields = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  if (type.includes('application/json')) return fields(await request.json());
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

async function signGuestbook(request, env, ctx) {
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
  later(ctx, push.notifyOwner(env, 'comments', { title: `✍ ${name} signed the guestbook`, body: message, url: '/?owner=1#/guestbook', tag: 'guestbook' }, new URL(request.url).origin));
  return json({ ok: true, pending: true });
}

// A visitor's comment on a post (or a reply to another comment). Only a name is asked for, and
// nothing else about them is kept. It waits for the owner's approval in the back office.
async function leaveComment(request, env, ctx) {
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
  later(ctx, push.notifyOwner(env, 'comments', { title: `💬 ${name} ${answering ? 'replied' : 'commented'}${post.title ? ` on “${post.title}”` : ''}`, body: message, url: '/?owner=1' + postHash(post), tag: `comment-${type}-${slug}` }, new URL(request.url).origin));
  return json({ ok: true, pending: true });
}

// A friend's comment on one of your posts, sent by their site (it's checked there and signed):
// it goes straight on, under their name, linking to their site. Friends see friends-only posts,
// so they can comment on those too.
async function friendComment(env, who, { post: id, message, reply_to }, ctx, origin = '') {
  if (message.length < 2) return { error: 'Write a comment first.', status: 400 };
  const [type, slug] = String(id || '').split('/');
  const data = await buildEverything(env, { forFriends: true });
  if (!data.site.comments) return { error: 'Comments are switched off on their site.', status: 403 };
  const post = data.posts.find((x) => x.type === type && x.slug === slug);
  if (!post) return { error: 'That post isn’t on their site any more.', status: 404 };
  const answering = reply_to && post.comments.some((c) => c.id === reply_to) ? reply_to : '';
  if (post.comments.filter((c) => c.site === who.site).length >= 100) return { error: 'That’s a lot of comments on one post. Try another!', status: 429 };
  const { iso, file } = stamp();
  const text = `---\nname: ${yamlString(who.name)}\nsite: ${yamlString(who.site)}\ndate: ${yamlString(iso.slice(0, 16).replace('T', ' '))}\n${answering ? `reply_to: ${yamlString(answering)}\n` : ''}---\n${message}\n`;
  await env.CONTENT.put(`comments/${type}/${slug}/${file}.md`, text, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
  later(ctx, push.notifyOwner(env, 'comments', { title: `💬 ${who.name} (a friend) commented${post.title ? ` on “${post.title}”` : ''}`, body: message, url: '/?owner=1' + postHash(post), tag: `comment-${type}-${slug}` }, origin));
  return { ok: true };
}

// This copy's version, and the template's newest (asked of GitHub at most every six hours, and
// kept). A copy made with the Deploy button updates itself overnight ("Update my site").
const TEMPLATE = 'tabbettthhh/RetroBloggerPublic';
const VERSION_CHECK = 'data/_version-check.json';
async function updateCheck(env, again = false) {
  let kept = null;
  try {
    kept = JSON.parse((await readText(env, VERSION_CHECK)) || 'null');
  } catch {}
  if (!again && kept && Date.now() - kept.at < 6 * 60 * 60 * 1000) return { mine: VERSION, latest: kept.latest, at: kept.at, template: TEMPLATE };
  let latest = '';
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${TEMPLATE}/main/src/version.js`, { headers: { 'User-Agent': 'MyCorner-UpdateCheck/1' }, signal: AbortSignal.timeout(5000) });
    latest = r.ok ? /VERSION\s*=\s*'([\w.-]{1,30})'/.exec(await r.text())?.[1] || '' : '';
  } catch {}
  if (!latest) return { mine: VERSION, latest: kept?.latest || '', at: kept?.at || 0, template: TEMPLATE, unreachable: true };
  const at = Date.now();
  await env.CONTENT.put(VERSION_CHECK, JSON.stringify({ latest, at }));
  return { mine: VERSION, latest, at, template: TEMPLATE };
}

async function suggest(request, env, ctx) {
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
  later(ctx, push.notifyOwner(env, 'comments', { title: `💡 ${from} suggested a ${kind}`, body: title, url: '/?owner=1#/' + (kind === 'place' ? 'wishlist' : { book: 'books', film: 'films', podcast: 'podcasts', music: 'music', tv: 'tv' }[kind]), tag: 'suggestion' }, new URL(request.url).origin));
  return json({ ok: true });
}

// Notifications go out after the answer (a slow push service never holds anyone up).
function later(ctx, work) {
  const p = Promise.resolve(work).catch((e) => console.error('push', e));
  if (ctx?.waitUntil) ctx.waitUntil(p);
}
const postHash = (post) => (post.type === 'places' ? `#/journal/${post.slug}` : ['books', 'films', 'podcasts', 'music', 'tv'].includes(post.type) ? `#/${post.type}/${post.slug}` : `#/post/${post.type}/${post.slug}`);
// Your new posts, announced to visitors who asked (see push.announcePosts).
// (Then the next round of a message still going out: see push.sendOutbox.)
async function announce(env, origin = '', round = true) {
  const data = await buildEverything(env);
  await push.announcePosts(env, data.posts, data.site.name, origin || (await friends.loadFriends(env)).me);
  return round ? push.sendOutbox(env) : 0;
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

  // Whether you're signed in (the site asks, to switch on its owner's tools).
  if (p === 'me' && m === 'GET') return json({ owner: true });
  // Whether this copy of the site has the latest version of the template.
  if (p === 'version' && m === 'GET') return json(await updateCheck(env, url.searchParams.get('again') === '1'));
  // Notifications: your devices, your choices, a test, and visitors' (off unless you say).
  if (p === 'push' && m === 'GET') return json(await push.myDevices(env));
  if (p.startsWith('push/') && m === 'POST') {
    const body = await request.json().then((b) => (b && typeof b === 'object' ? b : {}), () => ({}));
    try {
      if (p === 'push/subscribe') return json(await push.subscribeMine(env, body));
      if (p === 'push/unsubscribe') return json(await push.unsubscribe(env, body.endpoint, 'mine'));
      if (p === 'push/settings') {
        const out = await push.saveSettings(env, body);
        await bumpVersion(env);
        // (What's on the site already is noted, so only posts from now on are announced.)
        if (out.visitors) await announce(env, url.origin, false).catch(() => {});
        return json(out);
      }
      if (p === 'push/test') return json({ sent: await push.testMine(env, url.origin) });
    } catch (e) {
      return json({ error: String(e.message || e) }, 400);
    }
    return json({ error: 'Not found' }, 404);
  }

  // An emoji you don't want on a post, taken off it.
  if (p === 'reactions/remove' && m === 'POST') {
    const body = await request.json().then((b) => (b && typeof b === 'object' ? b : {}), () => ({}));
    const [type, slug] = String(body.post || '').split('/');
    if (!TYPES.includes(type) || !slug || slug.includes('..')) return json({ error: 'No such post.' }, 400);
    const key = `reactions/${type}/${slug}.json`;
    let r = {};
    try {
      r = JSON.parse((await readText(env, key)) || '{}') || {};
    } catch {}
    if (r.custom && typeof r.custom === 'object') delete r.custom[String(body.emoji || '')];
    await env.CONTENT.put(key, JSON.stringify(r), { httpMetadata: { contentType: 'application/json' } });
    await bumpVersion(env);
    return json({ ok: true });
  }
  if (p === 'overview' && m === 'GET') {
    const data = await buildEverything(env, { includeHidden: true });
    const { objects } = data.inside;
    const files = objects
      .filter((o) => !o.key.startsWith('data/_'))
      .map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded, etag: o.etag }));
    const pendingGb = await Promise.all(
      objects.filter((o) => o.key.startsWith('guestbook-pending/')).map(async (o) => parseGuestbookEntry(o.key, (await readText(env, o.key)) || ''))
    );
    // (The ones on the site were read for the site itself, just now.)
    const approvedGb = [...data.inside.guestbook];
    approvedGb.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    // Comments: the ones waiting for your approval, and the ones on the site (newest first).
    const commentsIn = (folder) => Promise.all(objects.filter((o) => isCommentKey(o.key, folder)).map(async (o) => parseComment(o.key, (await readText(env, o.key)) || '')));
    const newest = (list) => list.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id.localeCompare(a.id));
    const pendingComments = newest(await commentsIn('comments-pending'));
    const approvedComments = newest([...data.inside.comments]);
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
    // And everything of theirs, for you, signed in, on the site: friends-only posts and comments too.
    const friendsMine = await friends.publicFriends(env, { mine: true }).catch(() => ({ buddies: [], posts: [] }));
    return json({ ...data, files, pendingGuestbook: pendingGb, approvedGuestbook: approvedGb, pendingComments, approvedComments, suggestions, counter, nudges, notifySeen, friendNotes, friendsMine, now: Date.now() });
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
        const extra = [...(await listAll(env, mediaPrefix)), ...(await listAll(env, 'comments/' + mediaPrefix)), ...(await listAll(env, 'comments-pending/' + mediaPrefix)), ...(await listAll(env, `reactions/${folder}/${file.replace(/\.md$/, '')}.json`))];
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
      headers: { 'User-Agent': userAgent(env), 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000)
    }).catch(() => null);
    const found = r?.ok ? await r.json().catch(() => null) : null;
    if (!Array.isArray(found)) return json({ error: 'Place search is unavailable right now.' }, 502);
    return json(found.map(simplifyPlace));
  }

  if (p === 'reverse' && m === 'GET') {
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, {
      headers: { 'User-Agent': userAgent(env), 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000)
    }).catch(() => null);
    const found = r?.ok ? await r.json().catch(() => null) : null;
    if (!found || typeof found !== 'object') return json({ error: 'Location lookup is unavailable right now.' }, 502);
    return json(simplifyPlace(found));
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
    const r = await fetch(api, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    const w = r?.ok ? await r.json().catch(() => null) : null;
    if (!w) return json({ error: 'Weather is unavailable for that date.' }, 502);
    const temp = w.current ? w.current.temperature_2m : w.daily?.temperature_2m_max?.[0];
    const code = w.current ? w.current.weather_code : w.daily?.weather_code?.[0];
    if (temp == null) return json({ error: 'No weather found for that date.' }, 404);
    return json({ text: `${Math.round(temp)}°C, ${WMO[code] || 'mixed'}` });
  }

  // ---- Friends ----
  if (p.startsWith('friends') || p === 'mail' || p.startsWith('mail/')) {
    const fkey = url.searchParams.get('friend') || '';
    // Your site's own address, as friends will reach it, is taken from the back office itself.
    await friends.rememberMe(env, url.origin);
    let body = {};
    if (m === 'POST') {
      try {
        body = (await request.json()) || {};
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
      // Notes between friends: your mail, sending one, marking them read, deleting one.
      if (p === 'mail' && m === 'GET') return json(await friends.myMail(env));
      if (p === 'mail/send' && m === 'POST') return json(await friends.sendNote(env, String(body.friend || ''), body));
      if (p === 'mail/read' && m === 'POST') return json(await friends.markMail(env, body.ids === 'all' ? 'all' : body.ids || [], body.read !== false));
      if (p === 'mail/delete' && m === 'POST') return json(await friends.deleteNote(env, String(body.id || '')));
      // A comment from you on a friend's post (it goes on at their site, straight away).
      if (p === 'friends/comment' && m === 'POST') return json(await friends.commentOnFriend(env, fkey || String(body.friend || ''), body));
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
