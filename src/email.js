// Posting by email: send an email to your site's secret address and it becomes a post. The
// subject is its title, the writing is the post, and photos attached go with it (a photo dump
// when there are photos, a thought when there aren't).
//
// It's off until you switch it on (Control Panel › Post by email). Then an email only becomes a
// post when all of these are true:
//   - it was sent to your secret address (post-<your secret word>@<your domain>), which only
//     you know, and which you can change at any time;
//   - it's from one of your own email addresses (the ones you list), and the email's own
//     checks didn't fail (a forged "from" is refused);
//   - it has something in it.
// Anything else is dropped without a word (a stranger never learns the address exists). Your
// own emails that can't be used are bounced back to you, saying why.
//
// Cloudflare hands the email to the site (Email Routing › "Send to a Worker"): setting that up
// needs your own domain on Cloudflare. See the Control Panel page for the steps.
import PostalMime from 'postal-mime';
import { stripImage, UnsupportedImage } from './strip.js';
import { todayIn, parseSite, siteLevel } from './content.js';

const STORE = 'data/_email.json';
const MAX_PHOTOS = 12;
const MAX_PHOTO = 15 * 1024 * 1024;
const MAX_EMAIL = 25 * 1024 * 1024;
const LOG = 20;
const WORD = /^[a-z0-9]{12}$/;
const ADDRESS = /^[^\s@<>()",;]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;

const newWord = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
const tidyAddress = (v) => String(v ?? '').trim().toLowerCase().replace(/^.*<([^>]+)>.*$/, '$1');

export async function loadEmail(env) {
  let s = {};
  try {
    const obj = await env.CONTENT.get(STORE);
    if (obj) s = JSON.parse(await obj.text()) || {};
  } catch {}
  const admin = tidyAddress(env.ADMIN_EMAIL);
  return {
    on: s.on === true,
    word: WORD.test(s.word || '') ? s.word : '',
    // Your own addresses (to start with, the back office's owner email, if it's set).
    senders: Array.isArray(s.senders) ? s.senders.map(tidyAddress).filter((a) => ADDRESS.test(a)).slice(0, 10) : ADDRESS.test(admin) ? [admin] : [],
    // Straight onto the site, or kept as a draft for you to look over first.
    draft: s.draft !== false,
    log: Array.isArray(s.log) ? s.log.slice(0, LOG) : []
  };
}
async function saveEmail(env, s) {
  await env.CONTENT.put(STORE, JSON.stringify(s), { httpMetadata: { contentType: 'application/json' } });
}

// For the back office: the settings, and what happened to the last few emails.
export async function emailSettings(env, body = null) {
  const s = await loadEmail(env);
  if (body) {
    if (typeof body.on === 'boolean') s.on = body.on;
    if (typeof body.draft === 'boolean') s.draft = body.draft;
    if (Array.isArray(body.senders)) {
      const list = [...new Set(body.senders.map(tidyAddress).filter(Boolean))];
      const bad = list.find((a) => !ADDRESS.test(a));
      if (bad) throw new Error(`“${bad}” doesn’t look like an email address.`);
      if (list.length > 10) throw new Error('Ten addresses at most.');
      s.senders = list;
    }
    // A new secret word: the old address stops working at once.
    if (body.newWord === true) s.word = newWord();
    if (body.clearLog === true) s.log = [];
  }
  if (s.on && !s.word) s.word = newWord();
  if (s.on && !s.senders.length) throw new Error('Add the email address you’ll send from first.');
  if (body) await saveEmail(env, s);
  return s;
}

async function note(env, entry) {
  const s = await loadEmail(env);
  s.log = [{ at: Date.now(), ...entry }, ...s.log].slice(0, LOG);
  await saveEmail(env, s).catch(() => {});
}

// Whether the email's own checks (done by the servers it passed through) say it's forged.
function failsChecks(headers) {
  const results = [headers.get('authentication-results'), headers.get('arc-authentication-results')].filter(Boolean).join(' ').toLowerCase();
  return /\bdmarc=fail\b/.test(results) || (/\bspf=fail\b/.test(results) && !/\bdkim=pass\b/.test(results));
}

// The writing, from an email: plain text if there is some (else the HTML, made plain), without
// a signature, "Sent from my phone", or the email it's replying to.
export function emailText(parsed) {
  let t = String(parsed.text || '').trim();
  if (!t && parsed.html)
    t = String(parsed.html)
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h\d|blockquote|tr)>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, '&');
  t = t.replace(/\r\n?/g, '\n').replace(/ /g, ' ');
  // (A signature starts at a line that's just "-- ".)
  t = t.split(/\n-- ?\n/)[0];
  const lines = t.split('\n');
  // (Quoted replies at the end, and the "On … wrote:" line above them.)
  while (lines.length && (/^\s*>/.test(lines[lines.length - 1]) || !lines[lines.length - 1].trim())) lines.pop();
  if (lines.length && /^On .+wrote:\s*$/.test(lines[lines.length - 1].trim())) lines.pop();
  while (lines.length && (/^\s*(sent from my|get outlook for)\b/i.test(lines[lines.length - 1]) || !lines[lines.length - 1].trim())) lines.pop();
  return lines
    .join('\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 20000);
}

function slugify(s) {
  return (
    String(s || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'post'
  );
}
// Now, in your site's time zone, as the post headers write it (2026-11-04 18:05).
function nowIn(tz) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return `${todayIn(tz)} ${p.hour}:${p.minute}`;
  } catch {
    return new Date().toISOString().slice(0, 16).replace('T', ' ');
  }
}
const yamlString = (s) => JSON.stringify(String(s));

// An email arriving. deps: { saved(type, key, draft) } (to tell everything else about a new post).
export async function receiveEmail(message, env, deps = {}) {
  const s = await loadEmail(env);
  const to = tidyAddress(message.to);
  const local = to.split('@')[0] || '';
  // Not to your secret address, or posting by email is off: dropped, without a word.
  if (!s.on || !s.word || !local.includes(s.word)) return { dropped: 'address' };
  const from = tidyAddress(message.headers.get('from'));
  const envelope = tidyAddress(message.from);
  const mine = s.senders.includes(from) && (s.senders.includes(envelope) || envelope.split('@')[1] === from.split('@')[1]);
  if (!mine || failsChecks(message.headers)) {
    await note(env, { ok: false, from: from || envelope, why: !mine ? 'Not from one of your addresses: dropped.' : 'Its own checks say it’s forged: dropped.' });
    return { dropped: 'sender' };
  }
  const refuse = async (why) => {
    await note(env, { ok: false, from, why });
    message.setReject?.(why);
    return { refused: why };
  };
  if (message.rawSize > MAX_EMAIL) return refuse('That email is too big (25 MB at most). Send fewer photos at a time.');
  let parsed;
  try {
    parsed = await PostalMime.parse(await new Response(message.raw).arrayBuffer());
  } catch {
    return refuse('That email couldn’t be read.');
  }
  let subject = String(parsed.subject || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  // "[draft]" in the subject keeps it as a draft; "[now]" puts it straight on.
  let draft = s.draft;
  if (/\[draft\]/i.test(subject)) draft = true;
  if (/\[(now|publish)\]/i.test(subject)) draft = false;
  subject = subject.replace(/\[(draft|now|publish)\]/gi, '').replace(/^((re|fwd?|fw):\s*)+/i, '').trim().slice(0, 140);
  const text = emailText(parsed);
  // The photos: up to a dozen, each cleaned of hidden data (anything else is left out, and said).
  const photos = [];
  const left = [];
  for (const a of parsed.attachments || []) {
    const name = String(a.filename || 'photo').slice(0, 80);
    if (!/^image\//i.test(a.mimeType || '')) {
      if (a.disposition === 'attachment') left.push(name);
      continue;
    }
    if (photos.length >= MAX_PHOTOS) {
      left.push(name);
      continue;
    }
    const bytes = a.content instanceof ArrayBuffer ? new Uint8Array(a.content) : typeof a.content === 'string' ? new TextEncoder().encode(a.content) : new Uint8Array(a.content || []);
    if (bytes.length > MAX_PHOTO) {
      left.push(`${name} (over 15 MB)`);
      continue;
    }
    try {
      photos.push(stripImage(bytes));
    } catch (e) {
      left.push(e instanceof UnsupportedImage ? `${name} (not a jpg, png, webp or gif)` : `${name} (couldn’t be read)`);
    }
  }
  if (!text && !photos.length) return refuse(left.length ? `Nothing to post: ${left.join(', ')} couldn’t be used.` : 'Nothing to post: the email was empty.');
  const type = photos.length ? 'photos' : 'thoughts';
  const tz = env.TIMEZONE || 'Europe/London';
  const date = nowIn(tz);
  const words = subject || text.replace(/[#>*_`[\]()!-]/g, ' ').trim().split(/\s+/).slice(0, 6).join(' ');
  const base = `${type}/${date.slice(0, 10)}-${slugify(words)}`;
  let key = `${base}.md`;
  for (let n = 2; await env.CONTENT.head(key); n++) key = `${base}-${n}.md`;
  const slug = key.slice(type.length + 1, -3);
  const ext = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' };
  const files = photos.map((p, i) => `email-${i + 1}.${ext[p.kind]}`);
  await Promise.all(photos.map((p, i) => env.CONTENT.put(`${type}/${slug}/${files[i]}`, p.bytes, { httpMetadata: { contentType: `image/${p.kind}` } })));
  // (Written as private as the whole site is just now, so it stays that way if the site opens up.)
  const level = siteLevel(parseSite(await env.CONTENT.get('site.md').then((o) => (o ? o.text() : ''), () => '')));
  const head = [`date: ${yamlString(date)}`, subject ? `title: ${yamlString(subject)}` : null, draft ? 'draft: true' : null, level === 2 ? 'only_me: true' : level === 1 ? 'friends_only: true' : null, files.length ? `photos: [${files.map(yamlString).join(', ')}]` : null].filter(Boolean);
  await env.CONTENT.put(key, `---\n${head.join('\n')}\n---\n${text}\n`, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
  await note(env, { ok: true, from, post: key, title: subject, draft, why: left.length ? `Left out: ${left.join(', ')}.` : '' });
  await deps.saved?.({ type, slug, key, draft, title: subject });
  return { ok: true, key, draft };
}
