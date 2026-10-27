// The profile grid: tapping your picture opens the About page, where the posts with photos you
// put on your profile show as a grid after your bio.
import { test, report, assert, eq, launch, close, adminPage, editPost, clickSave, overview, getFile, putFile, upload, PHOTOS, BASE, chromium } from './lib.mjs';

await launch();

await test('posts go on the grid from the list and the editor; only ones with photos', async () => {
  await putFile('site.md', '---\nname: Test Corner\nowner: Sam Example\n---\nHi, I write this.\n');
  for (const [i, slug] of ['2026-02-01-grid-a', '2026-02-02-grid-b'].entries()) {
    await upload(`photos/${slug}/1.jpg`, PHOTOS[i]);
    await putFile(`photos/${slug}.md`, `---\ndate: 2026-02-0${i + 1} 12:00\ntitle: Grid ${i ? 'B' : 'A'}\nphotos: [1.jpg]\n---\nWords.\n`);
  }
  await putFile('thoughts/2026-02-03-no-photos.md', '---\ndate: 2026-02-03 12:00\ntitle: No photos grid\nprofile: true\n---\nJust words.\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Posts' }).click();
  await page.getByRole('searchbox', { name: 'Search posts' }).fill('grid');
  assert(!(await page.locator('.list-row', { hasText: 'No photos grid' }).locator('button', { hasText: 'To grid' }).count()), 'a post without photos offers the grid');
  await page.locator('.list-row', { hasText: 'Grid A' }).locator('button', { hasText: 'To grid' }).click();
  await page.getByRole('searchbox', { name: 'Search posts' }).fill('grid');
  await page.waitForSelector('.list-row:has-text("Grid A") button:has-text("Off grid")');
  assert(/^profile: true$/m.test(await getFile('photos/2026-02-01-grid-a.md')), 'profile line written');
  await editPost(page, 'Grid B');
  await page.locator('label', { hasText: 'Show it on my profile grid' }).locator('input').check();
  await clickSave(page);
  await editPost(page, 'Grid B');
  await clickSave(page);
  const posts = (await overview()).posts;
  eq(['Grid A', 'Grid B'].map((t) => posts.find((p) => p.title === t).profile), [true, true], 'both on the grid');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

await test('your picture opens the profile, with the grid after the bio', async () => {
  const browser = await chromium.launch();
  const site = await browser.newPage({ viewport: { width: 390, height: 1000 }, isMobile: true });
  await site.addInitScript(() => {
    try {
      sessionStorage.setItem('entered', '1');
    } catch {}
  });
  const errors = [];
  site.on('pageerror', (e) => errors.push(e.message));
  await site.goto(BASE + '/#/');
  await site.locator('a.avatar:visible').first().click();
  await site.waitForSelector('.profile-grid');
  eq(await site.evaluate(() => location.hash), '#/about', 'opens the About page');
  const names = await site.locator('.pg-tile').evaluateAll((els) => els.map((e) => e.title));
  eq(names, ['Grid B', 'Grid A'], 'newest first, only posts with photos');
  await site.locator('.pg-view[aria-label="List"]').click();
  assert(await site.locator('.profile-grid.as-list').count(), 'list view');
  await site.locator('.pg-tile', { hasText: 'Grid A' }).click();
  await site.waitForFunction(() => location.hash === '#/post/photos/2026-02-01-grid-a');
  await browser.close();
  assert(!errors.length, errors.join('; '));
});

await test('with several photos, you choose which one is the thumbnail on the grid', async () => {
  const slug = '2026-02-05-two-photos';
  await upload(`photos/${slug}/1.jpg`, PHOTOS[0]);
  await upload(`photos/${slug}/2.jpg`, PHOTOS[1]);
  await putFile(`photos/${slug}.md`, '---\ndate: 2026-02-05 12:00\ntitle: Cover choice\nphotos: [1.jpg, 2.jpg]\nprofile: true\n---\nWords.\n');
  const page = await adminPage();
  await editPost(page, 'Cover choice');
  const picks = page.locator('.grid-cover-pick');
  eq(await picks.count(), 2, 'both photos offered');
  eq(await picks.first().getAttribute('aria-checked'), 'true', 'the first to start with');
  await picks.nth(1).click();
  await clickSave(page);
  assert(/^grid_photo: "?2\.jpg"?$/m.test(await getFile(`photos/${slug}.md`)), 'grid_photo line');
  eq((await overview()).posts.find((p) => p.slug === slug).grid_cover, 1, 'parsed');
  await editPost(page, 'Cover choice');
  eq(await page.locator('.grid-cover-pick').nth(1).getAttribute('aria-checked'), 'true', 'still chosen when reopened');
  await page.close();
  const browser = await chromium.launch();
  const site = await browser.newPage({ viewport: { width: 390, height: 1000 }, isMobile: true });
  await site.addInitScript(() => {
    try {
      sessionStorage.setItem('entered', '1');
    } catch {}
  });
  await site.goto(BASE + '/#/about');
  const src = await site.locator('.pg-tile', { hasText: 'Cover choice' }).locator('img').getAttribute('src');
  assert(/\/2\.jpg$/.test(src), 'thumbnail: ' + src);
  await browser.close();
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
