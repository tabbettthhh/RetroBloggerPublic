// Posting by email: only to the secret address, only from your own addresses, never forged; the
// subject as the title, the writing as the post, photos (cleaned) making a photo dump; drafts
// or straight on; and the Control Panel page that sets it up.
import fs from 'node:fs';
import { test, report, assert, eq, api, getFile, fileExists, publicData, launch, close, BASE, chromium, PHOTOS } from './lib.mjs';

const set = (body) => api('email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
let n = 0;
// An email, as it arrives (MIME, with photos attached if any).
function mime({ from = 'me@example.com', to, subject = 'Hello', text = 'Hi there.', html = '', photos = [], extra = '' }) {
  const b = 'b' + Date.now() + n;
  const parts = [];
  parts.push(html ? `Content-Type: text/html; charset=utf-8\r\n\r\n${html}` : `Content-Type: text/plain; charset=utf-8\r\n\r\n${text}`);
  for (const [name, buf, type] of photos) parts.push(`Content-Type: ${type || 'image/jpeg'}; name="${name}"\r\nContent-Disposition: attachment; filename="${name}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${buf.toString('base64').replace(/.{76}/g, '$&\r\n')}`);
  return `From: Me <${from}>\r\nTo: ${to}\r\nSubject: ${subject}\r\nMessage-ID: <t${Date.now()}.${n++}@example.com>\r\nDate: ${new Date().toUTCString()}\r\nMIME-Version: 1.0\r\n${extra}Content-Type: multipart/mixed; boundary="${b}"\r\n\r\n${parts.map((p) => `--${b}\r\n${p}\r\n`).join('')}--${b}--\r\n`;
}
async function send(opts) {
  const r = await fetch(`${BASE}/cdn-cgi/local/email?from=${encodeURIComponent(opts.envelope || opts.from || 'me@example.com')}&to=${encodeURIComponent(opts.to)}`, { method: 'POST', body: mime(opts) });
  // (The local stand-in for Cloudflare answers in words: taken, or bounced with the reason.)
  const text = await r.text();
  return r.ok ? { outcome: 'ok' } : { outcome: 'rejected', rejectReason: /reason: (.*)$/s.exec(text)?.[1] || text };
}
const posts = async () => (await api('overview')).posts;

await launch();
let word = '';
let to = '';

await test('off to start with: emails go nowhere', async () => {
  const st = await api('email');
  eq([st.on, st.word], [false, ''], 'off, no address yet');
  const before = (await posts()).length;
  const out = await send({ to: 'post-anything@example.com' });
  eq(out.outcome, 'ok', 'quietly dropped');
  eq((await posts()).length, before, 'nothing posted');
  let err = '';
  try {
    await set({ on: true, senders: [] });
  } catch (e) {
    err = e.message;
  }
  assert(err.includes('address you’ll send from'), 'needs your address first: ' + err);
  err = '';
  try {
    await set({ senders: ['not an address'] });
  } catch (e) {
    err = e.message;
  }
  assert(err.includes('doesn’t look like'), 'odd addresses refused: ' + err);
});

await test('switched on: a secret address, and only your own emails to it', async () => {
  const st = await set({ on: true, senders: ['Me@Example.com'], draft: false });
  eq(st.senders, ['me@example.com'], 'your address');
  assert(/^[a-z0-9]{12}$/.test(st.word), 'a secret word');
  word = st.word;
  to = `post-${word}@example.com`;
  const before = (await posts()).length;
  // The wrong address, a stranger, a forged one: all dropped without a word.
  eq((await send({ to: 'post-guess@example.com' })).outcome, 'ok', 'wrong address: dropped');
  eq((await send({ to, from: 'stranger@example.org' })).outcome, 'ok', 'a stranger: dropped');
  eq((await send({ to, from: 'me@example.com', envelope: 'bounce@elsewhere.net' })).outcome, 'ok', 'sent by someone else in your name: dropped');
  eq((await send({ to, extra: 'Authentication-Results: mx.example.com; spf=pass; dkim=fail; dmarc=fail\r\n' })).outcome, 'ok', 'forged: dropped');
  eq((await posts()).length, before, 'nothing posted');
  const log = (await api('email')).log;
  eq(log.filter((e) => !e.ok).length, 3, 'the ones from the wrong person are noted for you');
});

await test('a thought by email: the subject is its title, the writing its words (no signature, no quoted reply)', async () => {
  const out = await send({ to, subject: 'Re: A quiet Sunday', text: 'Coffee, a book, *rain*.\r\n\r\nPerfect.\r\n\r\nOn Sat, Me wrote:\r\n> old stuff\r\n> more\r\n\r\n-- \r\nMe\r\nmy signature' });
  eq(out.outcome, 'ok', 'taken');
  const p = (await posts()).find((x) => x.title === 'A quiet Sunday');
  assert(p, 'posted');
  eq([p.type, p.draft], ['thoughts', false], 'a thought, straight on (as chosen)');
  eq(p.body.trim(), 'Coffee, a book, *rain*.\n\nPerfect.', 'just the writing');
  assert((await publicData()).posts.some((x) => x.slug === p.slug), 'on the site');
  eq((await api('email')).log[0].post, p.key, 'noted');
});

await test('photos attached: a photo dump, each photo cleaned; [draft] keeps it back', async () => {
  const jpg = fs.readFileSync(PHOTOS[0]);
  const out = await send({ to, subject: 'Beach [draft]', text: 'Sand.', photos: [['one.jpg', jpg], ['two.jpg', fs.readFileSync(PHOTOS[1])], ['notes.txt', Buffer.from('hello'), 'text/plain'], ['odd.heic', Buffer.from('not really a photo at all, just bytes'), 'image/heic']] });
  eq(out.outcome, 'ok', 'taken');
  const p = (await posts()).find((x) => x.title === 'Beach');
  eq([p.type, p.draft, p.files], ['photos', true, ['email-1.jpg', 'email-2.jpg']], 'a draft photo dump with both photos');
  assert(!(await publicData()).posts.some((x) => x.slug === p.slug), 'not on the site yet');
  assert(await fileExists(`photos/${p.slug}/email-1.jpg`), 'the photo is kept');
  // (Cleaned on the way in: the stored photo carries no camera data.)
  const stored = Buffer.from(await (await fetch(`${BASE}/media/photos/${p.slug}/email-1.jpg`)).arrayBuffer());
  assert(stored.length > 1000 && !stored.includes(Buffer.from('Exif')), 'a photo, with nothing hidden in it');
  const why = (await api('email')).log[0].why;
  assert(why.includes('notes.txt') && why.includes('odd.heic'), 'what was left out, said: ' + why);
});

await test('drafts by default; [now] puts one straight on; an empty email is bounced back to you', async () => {
  await set({ draft: true });
  await send({ to, subject: 'Just a draft', text: 'Hmm.' });
  eq((await posts()).find((x) => x.title === 'Just a draft').draft, true, 'a draft');
  await send({ to, subject: 'Right away [now]', text: 'Go!' });
  eq((await posts()).find((x) => x.title === 'Right away').draft, false, '[now]: on the site');
  const empty = await send({ to, subject: '', text: '' });
  eq(empty.outcome !== 'ok' || !!empty.rejectReason, true, 'bounced');
  assert(String(empty.rejectReason).includes('Nothing to post'), 'saying why: ' + empty.rejectReason);
  // An HTML-only email still reads as words.
  await send({ to, subject: 'From my phone', html: '<div>Line one<br>Line <b>two</b></div><p>Para &amp; more</p>' });
  eq((await posts()).find((x) => x.title === 'From my phone').body.trim(), 'Line one\nLine two\n\nPara & more', 'html made plain');
  // The same day, the same title: a post of its own.
  await send({ to, subject: 'Just a draft', text: 'Again.' });
  eq((await posts()).filter((x) => x.title === 'Just a draft').length, 2, 'never overwrites');
});

await test('a new secret address: the old one stops working', async () => {
  const st = await set({ newWord: true });
  assert(st.word !== word, 'new word');
  const before = (await posts()).length;
  await send({ to, subject: 'Old address', text: 'Hi' });
  eq((await posts()).length, before, 'old address: dropped');
  to = `post-${st.word}@example.com`;
  word = st.word;
  await send({ to, subject: 'New address', text: 'Hi' });
  eq((await posts()).length, before + 1, 'new one works');
});

await test('Control Panel › Post by email', async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    p.on('dialog', (d) => d.accept());
    await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await p.goto(BASE + '/?owner=1#/');
    await p.waitForSelector('.okit-me');
    await p.locator('.okit-me').first().click();
    await p.locator('.okit-menu button', { hasText: 'Control Panel' }).click();
    await p.locator('.cp-item[data-cp="email"]').click();
    await p.waitForSelector('.em-address');
    eq(await p.locator('.em-address code').innerText(), `post-${word}`, 'your secret address');
    assert((await p.locator('.em-steps').innerText()).includes('Send to a Worker'), 'with the steps');
    assert((await p.locator('.em-log').innerText()).includes('New address'), 'what happened lately');
    await p.locator('.em .okit-btn', { hasText: 'Turn off' }).click();
    await p.waitForSelector('.em .okit-btn:has-text("Turn on")');
    eq((await api('email')).on, false, 'off');
    assert(!p.errors.length, p.errors.join('; '));
  } finally {
    await b.close();
  }
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
