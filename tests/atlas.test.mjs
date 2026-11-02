// The Atlas as a travel board: pins, trips joined by thread, memories in the popups, ways of
// looking back, and notes tucked into the frame.
import { test, report, assert, eq, launch, close, putFile, BASE, chromium } from './lib.mjs';

await launch();
const place = (slug, title, city, lat, lon, date, extra = '') => putFile(`places/${slug}.md`, `---\ndate: ${date}\ntitle: ${title}\ncity: ${city}\nlat: ${lat}\nlon: ${lon}\ncategory: food\n${extra}---\nA lovely afternoon. Then more.\n`);

await test('trips are places one after another; the board shows them, with their memories', async () => {
  const { tripsOf } = await import('../public/js/atlas.js');
  const d = (s) => Date.parse(s);
  const t = tripsOf([{ ts: d('2026-08-01'), city: 'A' }, { ts: d('2026-08-03'), city: 'B' }, { ts: d('2026-09-20'), city: 'C' }]);
  eq(t.map((x) => [x.name, x.places.length]), [['C', 1], ['A, B', 2]], 'newest trip first; three days apart at most');
  await place('ab-1', 'Harbour Kitchen', 'Whitby', 54.486, -0.615, '2026-08-03 12:00', 'weather: "14°C, light rain"\nrating: 4.5\nwould_return: true\n');
  await place('ab-2', 'Old Town Café', 'Scarborough', 54.283, -0.398, '2026-08-05 10:00', 'weather: "19°C, sunny"\nrating: 5\n');
  await place('ab-3', 'Corner Bookshop', 'Birmingham', 52.478, -1.899, '2025-11-02 13:00');
  for (const opts of [{ viewport: { width: 1280, height: 900 } }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]) {
    const browser = await chromium.launch();
    const p = await browser.newPage(opts);
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await p.goto(BASE + '/#/atlas');
    await p.waitForSelector('.board-trip');
    const trips = await p.locator('.board-trip header b').allInnerTexts();
    assert(trips.indexOf('Whitby, Scarborough') >= 0 && trips.indexOf('Whitby, Scarborough') < trips.indexOf('Birmingham'), 'trips, newest first: ' + trips);
    const lenses = await p.locator('.board-lenses .board-tab').allInnerTexts();
    for (const l of ['Everywhere', 'First visits', 'I’d go back', 'My best', 'Rainy days', 'Sunny days', '2026', '2025']) assert(lenses.includes(l), `a way to look back: ${l} (${lenses})`);
    assert(/\d+ places/.test(await p.locator('.board-notes').innerText()), 'notes tucked into the frame');
    await p.locator('.board-lenses .board-tab', { hasText: 'Rainy days' }).click();
    const rainy = await p.locator('.board-row').allInnerTexts().then((x) => x.map((t) => t.split('\n')[0]));
    assert(rainy.includes('Harbour Kitchen') && !rainy.includes('Old Town Café'), 'only rainy ones: ' + rainy);
    await p.waitForSelector('.pin-board');
    await p.locator('.board-row', { hasText: 'Harbour Kitchen' }).count();
    await p.evaluate(() => { const el = document.querySelector('.board-sheet'); const m = el._markers.find((x) => x.options.title === 'Harbour Kitchen'); m.openPopup(); });
    const mem = await p.locator('.memory-pop').innerText();
    assert(mem.includes('Harbour Kitchen') && mem.includes('light rain') && mem.includes('A lovely afternoon'), 'the memory: ' + mem);
    assert(!p.errors.length, p.errors.join('; '));
    await browser.close();
  }
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
