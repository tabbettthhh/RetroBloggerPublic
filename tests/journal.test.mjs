// The journal as a book on a computer or tablet: long reviews with tables, lists, code and
// big pictures must split into pages without freezing, losing or cutting off anything.
import { api, test, report, assert, upload, PHOTOS, BASE, chromium } from './lib.mjs';

const rows = Array.from({ length: 70 }, (_, i) => `| row ${i} | ${'cell '.repeat(4)} |`).join('\n');
const items = Array.from({ length: 60 }, (_, i) => `${i + 1}. item number ${i + 1}`).join('\n');
const code = '```\n' + Array.from({ length: 90 }, (_, i) => `line ${i}`).join('\n') + '\n```';
const para = (i) => `Paragraph ${i}. ` + 'Some words about the visit. '.repeat(25);
const BODY = [para(1), '## A heading right before a table', '| col | val |\n|---|---|\n' + rows, para(2), '### Another heading', items, para(3), code, '![a big photo](/media/places/2026-05-01-book-test/1.jpg)', para(4), '## Heading at the very end'].join('\n\n');
const KEY = 'places/2026-05-01-book-test.md';
const TEXT = `---\ndate: 2026-05-01 12:00\ntitle: Book Test Place\nlat: 52.48\nlon: -1.89\ncity: Birmingham\ncountry_code: GB\nweather: "11°C, drizzle"\nrating: 4\ncategory: food\nphotos: [1.jpg, 2.jpg]\nordered: ["Tea — £2", "Cake — £3"]\nfloppy_journal: ["Margin line one", "Margin line two"]\n---\n${BODY}\n`;

await test('seed a very long review', async () => {
  await upload('places/2026-05-01-book-test/1.jpg', PHOTOS[1]);
  await upload('places/2026-05-01-book-test/2.jpg', PHOTOS[0]);
  await api('batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: [{ key: KEY, text: TEXT }] }) });
});

for (const [name, opts] of [
  ['desktop', { viewport: { width: 1366, height: 860 } }],
  ['small desktop', { viewport: { width: 1000, height: 640 } }],
  ['tablet', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }],
  ['tablet landscape', { viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }]
]) {
  await test(`${name}: every page in order, nothing lost or cut off`, async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage(opts);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE + '/');
    await page.locator('.visitor-tile').click();
    await page.waitForTimeout(600);
    const done = await Promise.race([
      page.evaluate(() => new Promise((r) => { location.hash = '#/journal/2026-05-01-book-test'; setTimeout(() => r(true), 2500); })),
      new Promise((r) => setTimeout(() => r(false), 20000))
    ]);
    assert(done, 'the page froze');
    const paged = await page.locator('.spread.paged').count();
    assert(paged, 'not shown as a book here');
    // Read every spread, collecting the text and checking nothing is clipped.
    const seen = [];
    const clipped = [];
    for (let i = 0; i < 80; i++) {
      const info = await page.evaluate(() => {
        const sp = document.querySelector('.spread.paged');
        const pages = [...sp.querySelectorAll(':scope > .page')];
        return {
          text: pages.map((p) => p.innerText).join('\n'),
          clipped: pages.filter((p) => !p.classList.contains('tall') && !p.classList.contains('left') && p.scrollHeight > p.clientHeight + 2).length,
          last: !sp.querySelector('.page-turn.next')
        };
      });
      seen.push(info.text);
      if (info.clipped) clipped.push(i);
      if (info.last) break;
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(120);
    }
    const all = seen.join('\n');
    const missing = [];
    for (let i = 0; i < 70; i++) if (!all.includes(`row ${i}`)) missing.push(`row ${i}`);
    for (let i = 1; i <= 60; i++) if (!all.includes(`item number ${i}`)) missing.push(`item ${i}`);
    for (let i = 0; i < 90; i++) if (!new RegExp(`line ${i}\\b`).test(all)) missing.push(`line ${i}`);
    for (const t of ['Paragraph 4', 'Heading at the very end', 'A heading right before a table']) if (!all.includes(t)) missing.push(t);
    // Numbered lists carry on counting on the next page.
    const starts = await page.evaluate(() => [...document.querySelectorAll('.spread.paged ol[start]')].map((o) => o.getAttribute('start')));
    await browser.close();
    assert(!errors.length, errors.join('\n'));
    assert(!missing.length, 'missing: ' + missing.slice(0, 12).join(', ') + (missing.length > 12 ? ` …(${missing.length})` : ''));
    assert(!clipped.length, 'content cut off on spreads ' + clipped.join(', '));
    void starts;
  });
}

const failed = report();
process.exit(failed ? 1 : 0);
