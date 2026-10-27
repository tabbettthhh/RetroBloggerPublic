// One pool of keepsakes: every keepsake can go on every kind of post that has them. Every one,
// on every kind of post, must draw without an error.
import fs from 'node:fs';
import path from 'node:path';
import { test, report, assert, eq, launch, close, adminPage, newPost, clickSave, overview, putFile, publicData, BASE, HERE, chromium } from './lib.mjs';

// Every keepsake the server knows, straight from its list.
const src = fs.readFileSync(path.join(HERE, '..', 'src', 'content.js'), 'utf8');
const KEYS = [...src.matchAll(/^\s+(\w+): keepsake\(data\.\w+\),$/gm)].map((m) => m[1]);
const FILES = {
  places: '2026-03-01-every-keepsake', thoughts: '2026-03-02-every-keepsake', photos: '2026-03-03-every-keepsake',
  books: '2026-03-04-every-keepsake', films: '2026-03-05-every-keepsake', tv: '2026-03-06-every-keepsake', podcasts: '2026-03-07-every-keepsake', music: '2026-03-08-every-keepsake'
};
const ROUTE = (type, slug) => (type === 'places' ? `#/journal/${slug}` : ['thoughts', 'photos'].includes(type) ? `#/post/${type}/${slug}` : `#/${type}/${slug}`);

await launch();

await test(`all ${KEYS.length} keepsakes, plus receipts, on every kind of post`, async () => {
  assert(KEYS.length > 150, 'only found ' + KEYS.length);
  const lines = KEYS.map((k) => `${k}: [Line one 12, "Line two 9:30"]`).join('\n');
  for (const [type, slug] of Object.entries(FILES)) {
    await putFile(`${type}/${slug}.md`, `---\ndate: 2026-03-0${Object.keys(FILES).indexOf(type) + 1} 12:00\ntitle: Every keepsake\ncity: Birmingham\ncountry_code: GB\nlat: 52.48\nlon: -1.9\nstatus: ${type === 'books' ? 'read' : 'watched'}\nordered: [Flat white — £3.40]\nbought: [Mug — £8]\npostcard_scene: forest\n${lines}\n---\nEverything at once.\n`);
  }
  const d = await publicData();
  for (const [type, slug] of Object.entries(FILES)) {
    const p = d.posts.find((x) => x.slug === slug);
    assert(p, `${type} missing`);
    eq([p.ordered.length, p.bought.length, p.postcard_scene], [1, 1, 'forest'], `${type}: receipts and postcard front`);
  }
  const browser = await chromium.launch();
  for (const opts of [{ viewport: { width: 1366, height: 860 } }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]) {
    const page = await browser.newPage(opts);
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('entered', '1');
      } catch {}
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE + '/');
    for (const [type, slug] of Object.entries(FILES)) {
      await page.evaluate((h) => (location.hash = h), ROUTE(type, slug));
      await page.waitForTimeout(900);
      const n = await page.locator('.ticket-wrap').count();
      // (a journal on a computer shows one spread at a time, so only a few are on screen)
      const want = type === 'places' && !opts.isMobile ? 3 : 100;
      assert(n > want, `${type} on ${opts.isMobile ? 'a phone' : 'a computer'}: only ${n} keepsakes drawn`);
    }
    await page.close();
    assert(!errors.length, [...new Set(errors)].join('\n'));
  }
  await browser.close();
});

await test('the editor offers the whole pool, with the tabs for this kind of post first', async () => {
  const page = await adminPage();
  const tabsFor = async (type) => {
    await newPost(page, type);
    await page.evaluate(() => (document.querySelector('details.keep-panel').open = true));
    return (await page.locator('.keep-tab').allInnerTexts()).map((t) => t.replace(/\d+$/, '').trim());
  };
  const film = await tabsFor('Film');
  assert(film[0] === 'For the screen', 'film tabs start: ' + film.slice(0, 3).join(', '));
  for (const g of ['Receipts', 'Outdoors', 'Sky', 'Gym', 'Study', 'Work', 'Awards & charts', 'Concerts']) assert(film.includes(g), 'film is missing ' + g);
  const thought = await tabsFor('Thought');
  assert(thought.indexOf('For a thought') < thought.indexOf('Receipts'), 'thought tabs: ' + thought.join(', '));
  assert(thought.includes('For the screen') && thought.includes('Tickets'), 'thought is missing the screen or tickets');
  // and a till receipt on a thought saves
  await page.locator('.keep-tab', { hasText: 'Receipts' }).click();
  await page.locator('.keep-tick', { hasText: 'Till receipt' }).click();
  await page.locator('.keep-lines[data-kind="till"] .fl-row input').first().fill('Flat white');
  await page.locator('textarea.textarea').first().fill('Coffee thought for the pool test.');
  await clickSave(page);
  const p = (await overview()).posts.find((x) => x.excerpt?.startsWith('Coffee thought for the pool test'));
  eq(p?.ordered, [{ item: 'Flat white', price: '' }], 'receipt on a thought');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
