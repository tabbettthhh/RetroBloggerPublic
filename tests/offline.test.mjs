// Offline reading: after one visit, the site opens with no connection (here, with the local site
// stopped), showing the posts as last seen and saying so, with the photos that were looked at.
import { test, report, assert, eq, putFile, upload, launch, close, BASE, chromium, PHOTOS } from './lib.mjs';

const at = (h) => new Date(Date.now() - h * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
await launch();

// One browser for both tests: the second carries on from the first (as a phone would).
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  sessionStorage.setItem('entered', '1');
  sessionStorage.setItem('sw-test', '1');
});
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));

await test('kept to open quickly: posts shown from the copy then brought up to date; photos kept a while; Refresh throws it away', async () => {
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\n---\nHi.\n');
  await putFile('thoughts/before.md', `---\ndate: ${at(3)}\ntitle: Written before\n---\nStill readable on the train.\n`);
  await upload('photos/trip/1.jpg', PHOTOS[0]);
  await upload('photos/trip/2.jpg', PHOTOS[1]);
  await putFile('photos/trip.md', `---\ndate: ${at(4)}\ntitle: A trip\nphotos: [1.jpg, 2.jpg]\n---\n`);
  await putFile('places/cafe.md', `---\ndate: ${at(5)}\ntitle: The Café\ncity: Leeds\n---\nGood coffee.\n`);
  await p.goto(BASE + '/#/');
  await p.waitForSelector('.card');
  await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
  await p.evaluate(() => Promise.all(['/media/photos/trip/1.jpg', '/media/photos/trip/2.jpg'].map((u) => fetch(u).then((r) => r.blob()))));
  await p.waitForTimeout(2500);
  eq(await p.locator('.offline-bar').count(), 0, 'online: nothing said');
  // A new post, written meanwhile: the page opens from the copy, then it appears by itself.
  await putFile('thoughts/meanwhile.md', `---\ndate: ${at(1)}\ntitle: Written meanwhile\n---\nNew!\n`);
  await p.reload();
  await p.waitForSelector('.card[data-post="thoughts/meanwhile"]', { timeout: 15000 });
  // A photo deleted on the site: a visitor's kept copy still shows for a while…
  await fetch(`${BASE}/admin/api/file?key=photos/trip/2.jpg`, { method: 'DELETE' });
  eq(await p.evaluate(() => fetch('/media/photos/trip/2.jpg').then((r) => r.status)), 200, 'kept a while');
  // …and Refresh throws the copy away.
  await p.evaluate(() => (location.hash = '#/'));
  await p.locator('.explore-btn, .start-btn').first().click();
  await p.locator('.sm-refresh').click();
  await p.waitForLoadState('load');
  await p.waitForSelector('.card');
  await p.waitForTimeout(800);
  eq(await p.evaluate(() => fetch('/media/photos/trip/2.jpg').then((r) => r.status)), 404, 'fresh after Refresh');
  eq(await p.evaluate(() => fetch('/media/photos/trip/1.jpg').then((r) => r.status)), 200, 'the others still there');
  await p.waitForTimeout(1500);
});

await test('then no connection: the posts as last seen, a line saying so, the photos looked at', async () => {
  // No connection.
  process.kill(-Number(process.env.TEST_SERVER_PID));
  await new Promise((r) => setTimeout(r, 2500));
  eq(await fetch(BASE + '/robots.txt').then((r) => r.status, () => 'gone'), 'gone', 'the site is out of reach');
  await p.reload();
  await p.waitForSelector('.card[data-post="thoughts/before"]', { timeout: 15000 });
  await p.waitForSelector('.offline-bar', { timeout: 10000 });
  assert((await p.locator('.offline-bar').textContent()).startsWith('📴 No connection: showing what was saved '), 'saying so');
  eq(await p.evaluate(() => fetch('/media/photos/trip/1.jpg').then((r) => r.status, () => 'none')), 200, 'the photo looked at');
  await p.evaluate(() => (location.hash = '#/journal/cafe'));
  await p.waitForSelector('.journal-head');
  eq(await p.locator('.journal-head h2').textContent(), 'The Café', 'other pages too');
  assert(!errors.length, errors.join('; '));
});

await browser.close();

const failed = report();
await close();
process.exit(failed ? 1 : 0);
