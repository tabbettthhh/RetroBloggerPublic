// Privacy, all at once: a post can be for everyone, friends only or only you, and so can the whole
// site. The more private of the two wins; making the site more private changes every post there
// and then; making it more open changes none (they're opened up by hand). Visitors to a private
// site get the site, with a little something instead of posts.
import http from 'node:http';
import { test, report, assert, eq, api, getFile, putFile, upload, publicData, launch, close, adminPage, newPost, editPost, unfold, clickSave, BASE, chromium, PHOTOS } from './lib.mjs';

const set = (level) => api('privacy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level }) });
const reopen = (keys, to) => api('privacy/reopen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys, to }) });
const titles = async () => (await publicData()).posts.map((p) => p.title).sort();
const levelOf = (text) => (/^only_me: true$/m.test(text) ? 'me' : /^friends_only: true$/m.test(text) ? 'friends' : 'everyone');
// (A visitor, not signed in: the local site lets anyone on "localhost" into the back office, so
// this asks by another name.)
const asVisitor = (p) =>
  new Promise((resolve, reject) => {
    const u = new URL(BASE + p);
    http.get({ host: u.hostname, port: u.port, path: u.pathname, headers: { Host: `visitor.test:${u.port}`, 'User-Agent': 'Mozilla/5.0 (Macintosh) Safari/605' } }, (r) => (r.resume(), resolve(r.statusCode))).on('error', reject);
  });
const at = (h) => new Date(Date.now() - h * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

await launch();

await test('a post just for you: on no one else’s screen, and nor are its photos', async () => {
  await upload('thoughts/diary/a.jpg', PHOTOS[0]);
  await upload('thoughts/open/b.jpg', PHOTOS[1]);
  await putFile('thoughts/open.md', `---\ndate: ${at(5)}\ntitle: Open\nphotos: [b.jpg]\n---\nFor all.\n`);
  await putFile('thoughts/pals.md', `---\ndate: ${at(4)}\ntitle: Pals\nfriends_only: true\n---\nFor friends.\n`);
  await putFile('thoughts/diary.md', `---\ndate: ${at(3)}\ntitle: Diary\nonly_me: true\nphotos: [a.jpg]\n---\nJust me.\n`);
  eq(await titles(), ['Open'], 'visitors: only the open one');
  eq((await publicData()).site.privacy, 'public', 'the site is open');
  const mine = (await api('overview')).posts.find((p) => p.slug === 'diary');
  eq([mine.only_me, mine.friends_only], [true, false], 'yours to see');
  eq(await asVisitor('/media/thoughts/diary/a.jpg'), 404, 'its photo isn’t for visitors');
  eq(await asVisitor('/media/thoughts/open/b.jpg'), 200, 'an open post’s photo is');
  eq((await fetch(`${BASE}/media/thoughts/diary/a.jpg`)).status, 200, 'you still see it');
});

await test('the whole site to friends: every open post becomes friends only, there and then', async () => {
  const out = await set('friends');
  eq([out.level, out.changed, out.left], ['friends', 1, 0], 'one post changed');
  eq(levelOf(await getFile('thoughts/open.md')), 'friends', 'written into the post itself');
  eq(levelOf(await getFile('thoughts/diary.md')), 'me', 'only-you stays only you');
  eq(await titles(), [], 'visitors: no posts');
  eq((await publicData()).site.privacy, 'friends', 'and the site says so');
  eq(await asVisitor('/media/thoughts/open/b.jpg'), 404, 'nor its photos');
  assert((await getFile('site.md')).includes('privacy: friends'), 'kept in site.md');
});

await test('opening the site up again opens nothing by itself; posts open up when you say', async () => {
  const out = await set('public');
  eq(out.changed, 0, 'no post changed');
  eq(await titles(), [], 'still no posts for visitors');
  // One at a time…
  eq((await reopen(['thoughts/open.md'], 'public')).changed, 1, 'that one');
  eq(await titles(), ['Open'], 'back for visitors');
  // …or all of them.
  eq((await reopen(null, 'public')).changed, 2, 'the rest');
  eq(await titles(), ['Diary', 'Open', 'Pals'], 'all open');
});

await test('only you: nobody else sees a thing; never more open than the site', async () => {
  await set('me');
  for (const k of ['open', 'pals', 'diary']) eq(levelOf(await getFile(`thoughts/${k}.md`)), 'me', k);
  eq(await titles(), [], 'no posts');
  // Asking to open one up for everyone on a site that's only you: still only you.
  eq((await reopen(['thoughts/open.md'], 'public')).changed, 0, 'stays as it is');
  // A post written straight into the site's files, without saying: private as the site is.
  await putFile('thoughts/stray.md', `---\ndate: ${at(1)}\ntitle: Stray\n---\nHi.\n`);
  eq(await titles(), [], 'still nothing');
});

await test('the editor: a new post starts as private as the site, and nothing is more open than it', async () => {
  const page = await adminPage();
  await newPost(page, 'Thought');
  eq(await page.locator('.who-opt.on').getAttribute('data-level'), 'me', 'starts as only me');
  eq(await page.locator('.who-opt[data-level="everyone"]').isDisabled(), true, 'everyone isn’t possible just now');
  await page.locator('textarea.textarea').first().fill('Written while private.');
  await clickSave(page);
  const saved = (await api('overview')).posts.find((p) => p.body?.includes('Written while private'));
  eq([saved.only_me, saved.friends_only], [true, false], 'saved only for you');
  await set('public');
  await reopen(null, 'public');
  await page.reload();
  await page.waitForSelector('.admin-sections button');
  await editPost(page, 'Diary');
  await unfold(page);
  await page.locator('.who-opt[data-level="friends"]').click();
  await clickSave(page);
  eq(levelOf(await getFile('thoughts/diary.md')), 'friends', 'friends only, from the editor');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

await test('Control Panel › Privacy, and a visitor’s view of a private site', async () => {
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
    await p.locator('.cp-item[data-cp="privacy"]').click();
    await p.waitForSelector('.pv-level.on[data-level="public"]');
    // To only you (it asks first, then changes them all)…
    await p.locator('.pv-level[data-level="me"]').click();
    await p.waitForSelector('.pv-level.on[data-level="me"]', { timeout: 20000 });
    for (const k of ['open', 'pals', 'stray']) eq(levelOf(await getFile(`thoughts/${k}.md`)), 'me', k);
    // …and back to everyone: they're listed, still only you, to open up.
    await p.locator('.pv-level[data-level="public"]').click();
    await p.waitForSelector('.pv-level.on[data-level="public"]', { timeout: 20000 });
    const n = await p.locator('.pv-list li').count();
    assert(n >= 4, 'still-private posts listed: ' + n);
    await p.locator('.pv-list li', { has: p.locator('.pv-title', { hasText: /^Open$/ }) }).locator('.pv-open').click();
    await p.waitForFunction((n) => document.querySelectorAll('.pv-list li').length === n - 1, n, { timeout: 20000 });
    eq(await titles(), ['Open'], 'that one’s open again');
    // A post's own ⋯ menu: who sees it.
    await p.keyboard.press('Escape');
    await p.waitForSelector('.okit-host', { state: 'detached' }).catch(() => {});
    await p.evaluate(() => (location.hash = '#/'));
    const card = p.locator('.card[data-post="thoughts/open"]').first();
    await card.waitFor();
    await card.locator('.okit-more').click();
    await p.locator('.okit-menu button', { hasText: 'Who sees it' }).click();
    await p.locator('.okit-menu button', { hasText: 'Only me' }).click();
    for (let i = 0; i < 50 && levelOf(await getFile('thoughts/open.md')) !== 'me'; i++) await p.waitForTimeout(200);
    eq(levelOf(await getFile('thoughts/open.md')), 'me', 'only me, from its menu');
    assert(!p.errors.length, p.errors.join('; '));
    await set('me');
    // A visitor: the site opens, with one of the little scenes instead of posts, a different one
    // each visit (and another at the tap of a button).
    const v = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    v.errors = [];
    v.on('pageerror', (e) => v.errors.push(e.message));
    await v.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await v.goto(BASE + '/#/');
    await v.waitForSelector('.ps-wrap');
    // (Each one has a button to the next: all four, in turn, every button working.)
    const seen = new Set();
    for (let i = 0; i < 4; i++) {
      const scene = v.locator('.ps-wrap > *').first();
      seen.add(await scene.getAttribute('class'));
      if (await v.locator('.ps-wrap button', { hasText: 'Pat Floppy' }).count()) {
        await v.locator('.ps-wrap button', { hasText: 'Pat Floppy' }).click();
        assert(!(await v.locator('.ps-bubble-line').innerText()).includes('neglected'), 'Floppy answers a pat');
      }
      if (await v.locator('.ps-wrap button', { hasText: 'Details' }).count()) {
        await v.locator('.ps-wrap button', { hasText: 'Details' }).click();
        assert(await v.locator('.ps-err-more').isVisible(), 'the details');
        await v.locator('.ps-wrap button', { hasText: /^OK$/ }).click();
      }
      await v.locator('.ps-wrap button', { hasText: /Another look|Try again|Restart|Something else/ }).first().click();
    }
    eq(seen.size, 4, 'four different scenes: ' + [...seen].join(' / '));
    assert((await v.locator('.ps-wrap').innerText()).includes('a private person'), 'saying why');
    eq(await v.locator('.card[data-post]').count(), 0, 'no posts');
    await v.goto(BASE + '/#/post/thoughts/open');
    await v.waitForSelector('.ps-wrap');
    assert((await v.locator('.ps-wrap').innerText()).length > 20, 'a link to a post: a scene too');
    assert(!v.errors.length, v.errors.join('; '));
  } finally {
    await b.close();
  }
  await set('public');
  await reopen(null, 'public');
  eq((await titles()).length, 5, 'all open again');
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
