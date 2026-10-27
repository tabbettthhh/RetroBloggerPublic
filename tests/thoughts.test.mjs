// Thoughts about the past ("reliving a memory") and the thought keepsakes: memories, skies,
// the gym and the time of day.
import { test, report, assert, eq, launch, close, adminPage, newPost, editPost, clickSave, publicData, overview, getFile, putFile, BASE, chromium } from './lib.mjs';

await launch();

await test('a thought set as a memory saves when it was, and keeps it through an edit', async () => {
  const page = await adminPage();
  await newPost(page, 'Thought');
  await page.locator('textarea.textarea').first().fill('That summer by the lake.');
  await page.locator('.memory-pick legend input').check();
  await page.locator('.memory-pick select[aria-label="How exactly"]').selectOption('month');
  await page.locator('.memory-pick input[aria-label="Year"]').fill('2019');
  await page.locator('.memory-pick input[aria-label="Year"]').dispatchEvent('change');
  await page.locator('.memory-pick select[aria-label="Month"]').selectOption('07');
  await page.evaluate(() => (document.querySelector('details.keep-panel').open = true));
  await page.locator('.keep-tab', { hasText: 'Memories' }).click();
  await page.locator('.keep-tick', { hasText: 'Then and now' }).click();
  await page.locator('.keep-tab', { hasText: 'Gym' }).click();
  await page.locator('.keep-tick', { hasText: 'Workout stamp' }).click();
  await page.locator('.keep-lines[data-kind="workout"] button', { hasText: '+ Add a line' }).click();
  await page.locator('.keep-lines[data-kind="workout"] .fl-row input').first().fill('hypertrophy');
  await clickSave(page);
  const post = (await overview()).posts.find((p) => p.excerpt?.startsWith('That summer by the lake'));
  assert(post, 'not saved');
  eq([post.memory, post.thennow, post.workout], ['2019-07', [], [{ item: 'hypertrophy', price: '' }]], 'saved');
  assert(/^memory: "?2019-07"?$/m.test(await getFile(post.key)), 'memory line in the file');
  await editPost(page, 'That summer by the lake');
  await clickSave(page);
  const again = (await overview()).posts.find((p) => p.key === post.key);
  eq([again.memory, again.thennow, again.workout], [post.memory, post.thennow, post.workout], 'after a second save');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

await test('a memory has its flair in the feed and its own page; odd memory dates are ignored', async () => {
  await putFile('thoughts/2026-01-02-odd-memory.md', '---\ndate: 2026-01-02 10:00\nmemory: last summer\n---\nNot a date.\n');
  await putFile('photos/2026-01-03-old-photos.md', '---\ndate: 2026-01-03 10:00\ntitle: Old photos\nmemory: 2009\nvhstape: [Holiday 2009]\n---\nScanned.\n');
  const d = await publicData();
  eq(d.posts.find((p) => p.slug === '2026-01-02-odd-memory').memory, null, 'odd date');
  eq(d.posts.find((p) => p.slug === '2026-01-03-old-photos').memory, '2009', 'a year on a photo dump');
  const browser = await chromium.launch();
  const site = await browser.newPage({ viewport: { width: 420, height: 1200 }, isMobile: true });
  await site.addInitScript(() => {
    try {
      sessionStorage.setItem('entered', '1');
    } catch {}
  });
  const errors = [];
  site.on('pageerror', (e) => errors.push(e.message));
  const slug = d.posts.find((p) => p.excerpt?.startsWith('That summer by the lake')).slug;
  await site.goto(`${BASE}/#/post/thoughts/${slug}`);
  await site.waitForSelector('.card.memory .mem-ribbon.big');
  const ribbon = await site.locator('.mem-ribbon').first().innerText();
  assert(/July 2019/.test(ribbon) && /years ago/.test(ribbon), 'ribbon: ' + ribbon);
  assert(/2019/.test(await site.locator('.ks-thennow').innerText()), 'then and now');
  assert(/HYPERTROPHY/.test(await site.locator('.ks-workout').innerText()), 'workout stamp');
  await site.goto('about:blank');
  await site.goto(`${BASE}/#/post/photos/2026-01-03-old-photos`);
  await site.waitForSelector('.card.memory .ks-vhstape');
  await browser.close();
  assert(!errors.length, errors.join('; '));
});

await test('music awards show on a review, with the disc you chose', async () => {
  await putFile('music/2026-01-04-neon-summer.md', '---\ndate: 2026-01-04 20:00\ntitle: Neon Summer\nartist: The Band Name\nformat: album\nrating: 4\ndiscaward: [platinum]\nchartno1: [3]\nmagreview: [An instant classic]\n---\nLoud.\n');
  const browser = await chromium.launch();
  const site = await browser.newPage({ viewport: { width: 420, height: 1600 }, isMobile: true });
  await site.addInitScript(() => {
    try {
      sessionStorage.setItem('entered', '1');
    } catch {}
  });
  const errors = [];
  site.on('pageerror', (e) => errors.push(e.message));
  await site.goto(`${BASE}/#/music/2026-01-04-neon-summer`);
  await site.waitForSelector('.ks-discaward');
  assert(/CERTIFIED PLATINUM/.test(await site.locator('.ks-discaward').innerText()), 'disc level');
  assert(/^3/.test(await site.locator('.ch-rows li.mine').innerText()), 'chart position');
  eq(await site.locator('.mr-stars').getAttribute('aria-label'), '4 out of 5', 'stars from the rating');
  await browser.close();
  assert(!errors.length, errors.join('; '));
});

await test('study and work keepsakes show on a thought', async () => {
  await putFile('thoughts/2026-01-05-revising.md', '---\ndate: 2026-01-05 21:00\ntitle: Revising\nflashcard: [What is consideration?, Something of value]\ngrade: ["2:1", Well argued!]\ncasecard: [Carlill v Carbolic Smoke Ball]\ndeadline: [28, Essay due]\nidbadge: [Sam Example, LEGAL]\ntimecard: ["9:02 - 17:45"]\n---\nLate one.\n');
  const browser = await chromium.launch();
  const site = await browser.newPage({ viewport: { width: 420, height: 1600 }, isMobile: true });
  await site.addInitScript(() => {
    try {
      sessionStorage.setItem('entered', '1');
    } catch {}
  });
  const errors = [];
  site.on('pageerror', (e) => errors.push(e.message));
  await site.goto(`${BASE}/#/post/thoughts/2026-01-05-revising`);
  await site.waitForSelector('.ks-flashcard');
  assert(/consideration/.test(await site.locator('.fc3-q').innerText()), 'flashcard question');
  eq((await site.locator('.gr-mark').innerText()).trim(), '2:1', 'grade');
  eq(await site.locator('.cc2-name i').count(), 2, 'case name set as a case');
  eq((await site.locator('.dl-grid i.due').innerText()).trim(), '28', 'deadline circled');
  assert(/IN 09:02/.test(await site.locator('.ks-timecard').innerText()), 'clocked in');
  assert(/Sam Example/.test(await site.locator('.ks-idbadge').innerText()), 'ID badge');
  await browser.close();
  assert(!errors.length, errors.join('; '));
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
