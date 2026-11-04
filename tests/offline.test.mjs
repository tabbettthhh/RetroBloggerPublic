// Offline reading: after one visit, the site opens with no connection (here, with the local site
// stopped), showing the posts as last seen and saying so, with the photos that were looked at.
import { test, report, assert, eq, putFile, upload, launch, close, BASE, chromium, PHOTOS } from './lib.mjs';

const at = (h) => new Date(Date.now() - h * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
await launch();

await test('one visit, then no connection: the posts as last seen, a line saying so, the photos looked at', async () => {
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\n---\nHi.\n');
  await putFile('thoughts/before.md', `---\ndate: ${at(3)}\ntitle: Written before\n---\nStill readable on the train.\n`);
  await upload('photos/trip/1.jpg', PHOTOS[0]);
  await putFile('photos/trip.md', `---\ndate: ${at(4)}\ntitle: A trip\nphotos: [1.jpg]\n---\n`);
  await putFile('places/cafe.md', `---\ndate: ${at(5)}\ntitle: The Café\ncity: Leeds\n---\nGood coffee.\n`);
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => {
      sessionStorage.setItem('entered', '1');
      sessionStorage.setItem('sw-test', '1');
    });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(BASE + '/#/');
    await p.waitForSelector('.card');
    await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
    // (The photo, looked at once.)
    await p.evaluate(() => fetch('/media/photos/trip/1.jpg').then((r) => r.blob()));
    await p.waitForTimeout(2500);
    eq(await p.locator('.offline-bar').count(), 0, 'online: nothing said');
    // No connection.
    process.kill(-Number(process.env.TEST_SERVER_PID));
    await new Promise((r) => setTimeout(r, 2500));
    eq((await fetch(BASE + '/robots.txt').then((r) => r.status, () => 'gone')), 'gone', 'the site is out of reach');
    await p.reload();
    await p.waitForSelector('.card[data-post="thoughts/before"]', { timeout: 15000 });
    assert((await p.locator('.offline-bar').textContent()).startsWith('📴 No connection: showing what was saved '), 'saying so');
    eq(await p.evaluate(() => fetch('/media/photos/trip/1.jpg').then((r) => r.status, () => 'none')), 200, 'the photo looked at');
    await p.evaluate(() => (location.hash = '#/journal/cafe'));
    await p.waitForSelector('.journal-head');
    eq(await p.locator('.journal-head h2').textContent(), 'The Café', 'other pages too');
    assert(!errors.length, errors.join('; '));
  } finally {
    await b.close();
  }
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
