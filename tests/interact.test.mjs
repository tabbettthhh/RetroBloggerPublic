// Clicking around with the awkward content still in place: search with odd characters, the
// photo viewer, the album, page turns, the screensaver, the status bar, forms. No crashes.
import { test, report, assert, BASE, chromium, seed, publicData } from './lib.mjs';

const browser = await chromium.launch();
const watch = (page) => {
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`${(page.url().split('#')[1] || '/')}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|AudioContext|Refused to load the image 'https:\/\/example.com/.test(m.text())) page.errors.push('console: ' + m.text());
  });
  page.on('dialog', (d) => d.dismiss());
};
const enter = async (page) => {
  await page.goto(BASE + '/');
  await page.waitForSelector('.visitor-tile');
  await page.locator('.visitor-tile').click();
  await page.waitForTimeout(800);
};
const go = (page, h) => page.evaluate((x) => (location.hash = x), h);

const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
watch(phone);
await enter(phone);

await test('search with odd characters', async () => {
  await go(phone, '#/search');
  await phone.waitForSelector('.search-input');
  for (const q of ['(', '[', '\\', '*', '?', '.*', 'café', 'سلام', '<b>', '"', "'", '   ', 'a'.repeat(300), '🌙', 'Rome: day']) {
    await phone.locator('.search-input').fill(q);
    await phone.waitForTimeout(120);
  }
  await phone.locator('.search-chip').nth(1).click().catch(() => {});
  await phone.locator('.fl-disk').click().catch(() => {});
  await phone.locator('.fl-btn', { hasText: 'Tell me another' }).click().catch(() => {});
  assert(!phone.errors.length, phone.errors.join('\n'));
});

await test('photo viewer from a photo dump: next, previous, zoom, rotate, close', async () => {
  await go(phone, '#/more');
  await phone.waitForTimeout(500);
  const frame = phone.locator('.filmstrip .frame').first();
  await frame.click();
  await phone.waitForSelector('.pv-win');
  for (const label of ['Next image (Right arrow)', 'Next image (Right arrow)', 'Previous image (Left arrow)', 'Rotate clockwise']) await phone.locator(`button[title="${label}"]`).click();
  await phone.locator('.pv-close-tool').click();
  assert(!(await phone.locator('.pv-win').count()), 'viewer did not close');
  assert(!phone.errors.length, phone.errors.join('\n'));
});

await test('album: open a print, flick through, close', async () => {
  await go(phone, '#/album');
  await phone.waitForTimeout(600);
  await phone.locator('.al-floppy').click();
  const prints = await phone.locator('.al-photo').count();
  assert(prints > 0, 'no prints');
  await phone.locator('.al-photo').first().click();
  await phone.waitForSelector('.pv-win');
  await phone.keyboard.press('ArrowRight');
  await phone.keyboard.press('ArrowLeft');
  await phone.keyboard.press('Escape');
  assert(!phone.errors.length, phone.errors.join('\n'));
});

await test('status bar: earlier statuses and a nudge', async () => {
  await go(phone, '#/');
  await phone.waitForTimeout(500);
  const pill = phone.locator('.status-pill.clickable');
  if (await pill.count()) await pill.first().click();
  const nudge = phone.locator('.nudge-btn');
  if (await nudge.count()) await nudge.first().click();
  await phone.waitForTimeout(800);
  assert(!phone.errors.length, phone.errors.join('\n'));
});

await test('guestbook and suggestion forms', async () => {
  await go(phone, '#/guestbook');
  await phone.waitForSelector('.gb-form');
  await phone.locator('.gb-form input[name="name"]').fill('Tester "quotes" <b>');
  await phone.locator('.gb-form input[name="message"]').fill('Hello: <script>x</script> ' + 'long '.repeat(100));
  await phone.locator('.gb-form button[type="submit"]').click();
  await phone.waitForTimeout(600);
  const msg = await phone.locator('.gb-form .form-msg').textContent();
  assert(/Thanks/.test(msg), 'guestbook said: ' + msg);
  await go(phone, '#/wishlist');
  await phone.waitForTimeout(500);
  assert(!phone.errors.length, phone.errors.join('\n'));
});

await test("a journal entry leads to its city's stamp and its pin on the map, and back", async () => {
  await go(phone, '#/journal/2026-07-02-huge-rating');
  await phone.waitForTimeout(600);
  await phone.locator('.journal-links a', { hasText: 'Passport' }).click();
  await phone.waitForSelector('.stamp.found');
  assert((await phone.locator('.stamp.found').getAttribute('title')) === 'London', 'the wrong stamp was picked out');
  await phone.waitForTimeout(900);
  const box = await phone.locator('.stamp.found').boundingBox();
  assert(box && box.y >= 0 && box.y + box.height <= 844, 'the stamp is not on screen');
  await phone.locator('.paper-tab').click();
  await phone.waitForTimeout(500);
  assert((await phone.evaluate(() => location.hash)) === '#/journal/2026-07-02-huge-rating', 'back did not return to the entry');
  await phone.locator('.journal-links a', { hasText: 'Map of everywhere' }).click();
  await phone.waitForSelector('.finder-row.found');
  assert(/Huge Rating/.test(await phone.locator('.finder-row.found').textContent()), 'the wrong place is selected');
  await phone.waitForSelector('.leaflet-popup-content', { timeout: 10000 });
  assert(/Huge Rating/.test(await phone.locator('.leaflet-popup-content').textContent()), 'the map did not open on the place');
  assert(!phone.errors.length, phone.errors.join('\n'));
});

await test('a long feed shows twenty posts, then the rest as you scroll', async () => {
  const day = (i) => String((i % 28) + 1).padStart(2, '0');
  await seed(Object.fromEntries(Array.from({ length: 45 }, (_, i) => [`thoughts/2025-01-${day(i)}-many-${i}.md`, `---\ndate: 2025-01-${day(i)} 12:${String(i).padStart(2, '0')}\n---\nThought number ${i}.\n`])));
  const total = (await publicData()).posts.filter((p) => p.type === 'thoughts').length;
  await go(phone, '#/thoughts');
  await phone.reload();
  await phone.waitForSelector('.feed > .card');
  const cards = () => phone.locator('.feed > .card').count();
  assert((await cards()) === 20, 'first lot: ' + (await cards()));
  for (let i = 0; i < 10 && (await phone.locator('.feed-more').count()); i++) {
    await phone.locator('.feed-more').scrollIntoViewIfNeeded();
    await phone.waitForTimeout(400);
    if (i > 3 && (await phone.locator('.feed-more').count())) await phone.locator('.feed-more').click();
  }
  assert((await cards()) === total, `shown ${await cards()} of ${total}`);
  assert(!phone.errors.length, phone.errors.join('\n'));
});

const desk = await browser.newPage({ viewport: { width: 1366, height: 860 } });
watch(desk);
await enter(desk);

await test('desktop: journal page turns on a very long review', async () => {
  await go(desk, '#/journal/2026-07-02-huge-rating');
  await desk.waitForTimeout(1200);
  for (let i = 0; i < 12; i++) {
    await desk.keyboard.press('ArrowRight');
    await desk.waitForTimeout(80);
  }
  for (let i = 0; i < 4; i++) await desk.keyboard.press('ArrowLeft');
  await go(desk, '#/journal/shelf');
  await desk.waitForTimeout(400);
  await go(desk, '#/journal/year/2026');
  await desk.waitForTimeout(400);
  assert(!desk.errors.length, desk.errors.join('\n'));
});

await test('desktop: a page can be turned by dragging its corner, and falls back if let go early', async () => {
  await go(desk, '#/journal/2026-07-02-huge-rating');
  await desk.waitForTimeout(1200);
  const nums = () => desk.locator('.dw.active .spread.paged > .page .page-no').allTextContents();
  const corner = async () => desk.locator('.dw.active .spread.paged > .page.right .page-turn.next').boundingBox();
  const before = await nums();
  let c = await corner();
  await desk.mouse.move(c.x + 50, c.y + 50);
  await desk.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await desk.mouse.move(c.x + 50 - i * 12, c.y + 50);
    await desk.waitForTimeout(40);
  }
  await desk.waitForTimeout(150);
  await desk.mouse.up();
  await desk.waitForTimeout(800);
  assert(JSON.stringify(await nums()) === JSON.stringify(before), 'a short drag turned the page');
  assert(!(await desk.locator('.leaf').count()), 'the turning page was left behind');
  // Mid-turn, each strip of the page shows exactly one side, even where the browser doesn't
  // hide the far side of a turned layer (Firefox, with strips inside strips): otherwise the
  // front's writing shows through mirrored.
  await desk.addStyleTag({ content: '.leaf .face { backface-visibility: visible !important; -webkit-backface-visibility: visible !important; }' });
  c = await corner();
  await desk.mouse.move(c.x + 50, c.y + 50);
  await desk.mouse.down();
  for (let i = 1; i <= 9; i++) {
    await desk.mouse.move(c.x + 50 - i * 30, c.y + 50);
    await desk.waitForTimeout(30);
  }
  await desk.waitForTimeout(200);
  const sidesShown = await desk.evaluate(() => [...document.querySelectorAll('.leaf .strip')].map((st) => [...st.children].filter((x) => x.classList.contains('face') && getComputedStyle(x).visibility === 'visible').length));
  assert(sidesShown.length && sidesShown.every((n) => n === 1), 'strips showing both sides at once: ' + JSON.stringify(sidesShown));
  await desk.mouse.up();
  await desk.waitForTimeout(900);
  c = await corner();
  await desk.mouse.move(c.x + 50, c.y + 50);
  await desk.mouse.down();
  for (let i = 1; i <= 30; i++) {
    await desk.mouse.move(c.x + 50 - i * 22, c.y + 50);
    await desk.waitForTimeout(25);
  }
  await desk.mouse.up();
  await desk.waitForTimeout(900);
  assert(JSON.stringify(await nums()) !== JSON.stringify(before), 'dragging across did not turn the page');
  assert(!(await desk.locator('.leaf').count()), 'the turning page was left behind');
  assert(!desk.errors.length, desk.errors.join('\n'));
});

await test('desktop: open many windows, drag, maximise, minimise, close', async () => {
  for (const h of ['#/atlas', '#/passport', '#/books', '#/tv', '#/album', '#/stats', '#/about']) {
    await go(desk, h);
    await desk.waitForTimeout(300);
  }
  const bar = desk.locator('.dw.active .wbar');
  const bb = await bar.boundingBox();
  await desk.mouse.move(bb.x + 80, bb.y + 10);
  await desk.mouse.down();
  await desk.mouse.move(bb.x + 300, bb.y + 200, { steps: 5 });
  await desk.mouse.up();
  await desk.locator('.dw.active .wbtn.max').click().catch(() => {});
  await desk.locator('.dw.active .wbtn.min').click().catch(() => {});
  await desk.locator('.dw.active .wbtn.close').first().click().catch(() => {});
  assert(!desk.errors.length, desk.errors.join('\n'));
});

await test('desktop: the screensaver runs with all the awkward content', async () => {
  await desk.locator('.start-btn').click();
  await desk.locator('.sm-foot-btn', { hasText: 'Screensaver' }).click();
  await desk.waitForTimeout(9000);
  await desk.mouse.move(400, 400);
  await desk.mouse.move(420, 420);
  await desk.waitForTimeout(500);
  assert(!desk.errors.length, desk.errors.join('\n'));
});

const failed = report();
await browser.close();
process.exit(failed ? 1 : 0);
