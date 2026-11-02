// The planner: lists of things to do, wishes and notes (planner.md), written in the back office
// without Markdown, and on the site as a leather organiser with a month calendar.
import { test, report, assert, eq, launch, close, adminPage, getFile, putFile, publicData, overview, BASE, chromium, openTab, toastText } from './lib.mjs';

await launch();
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

await test('planner.md: lists, ticks, dates, notes and private lists', async () => {
  const { parsePlanner } = await import('../src/content.js');
  eq(parsePlanner('---\n---\n## To do\n- [ ] Post it @2026-11-05 — before Friday\n- [x] Call Nan\nRemember the stamps.\n\n## Secret (private)\n- [ ] Party\n'), [
    { name: 'To do', private: false, items: [{ text: 'Post it', done: false, due: '2026-11-05', note: 'before Friday' }, { text: 'Call Nan', done: true, due: '', note: '' }], notes: 'Remember the stamps.' },
    { name: 'Secret', private: true, items: [{ text: 'Party', done: false, due: '', note: '' }], notes: '' }
  ], 'read as written');
  await putFile('planner.md', '---\n---\n## To do\n- [ ] One\n## Secret (private)\n- [ ] Party\n');
  eq((await publicData()).planner.map((l) => l.name), ['To do'], 'private lists never reach the site');
  eq((await overview()).planner.map((l) => l.name), ['To do', 'Secret'], 'the back office sees them all');
});

await test('the back office: start a planner, add with a date, tick, note, make one private', async () => {
  await putFile('planner.md', '---\n---\n');
  const page = await adminPage();
  await openTab(page, 'Planner');
  await page.getByRole('button', { name: 'To do, Wishlist and Notes' }).click();
  await page.waitForSelector('.pl-lists');
  eq((await page.locator('.pl-lists .chip-btn').allInnerTexts()).map((t) => t.replace(/\s+\d*$/, '').trim()), ['🔒 To do', 'Wishlist', 'Notes', '+ New list'], 'three lists, the to-do list private');
  await page.getByRole('textbox', { name: 'Add to the list' }).fill('Post the parcel');
  await page.getByRole('textbox', { name: 'Add to the list' }).press('Enter');
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('Added'));
  await page.locator('.pl-item').first().locator('input[type="date"]').fill(day(3));
  await page.locator('.pl-item').first().locator('input[type="date"]').dispatchEvent('change');
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('Saved'));
  await page.locator('.pl-item').first().getByRole('textbox', { name: 'Note' }).fill('before Friday');
  await page.locator('.pl-item').first().getByRole('textbox', { name: 'Note' }).press('Tab');
  await page.waitForFunction(() => /Saved/.test(document.querySelector('.toast:not([hidden])')?.textContent || '') && document.querySelector('.pl-item input[aria-label="Note"]')?.value === 'before Friday');
  let md = await getFile('planner.md');
  assert(md.includes(`## To do (private)\n- [ ] Post the parcel @${day(3)} — before Friday`), 'written as Markdown:\n' + md);
  // Tick it; make the list public.
  await page.locator('.pl-item').first().locator('input[type="checkbox"]').check();
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('Done'));
  await page.getByRole('checkbox', { name: /Private/ }).uncheck();
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('On the site'));
  md = await getFile('planner.md');
  assert(md.includes(`## To do\n- [x] Post the parcel @${day(3)} — before Friday`), 'ticked, and on the site:\n' + md);
  // A wish, and notes.
  await page.locator('.pl-lists .chip-btn', { hasText: 'Wishlist' }).click();
  await page.getByRole('textbox', { name: 'Add to the list' }).fill('A film camera');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('Added'));
  await page.locator('.pl-lists .chip-btn', { hasText: 'Notes' }).click();
  await page.getByRole('textbox', { name: 'Notes' }).fill('## not a heading\n- [ ] not a task\nRead more.');
  await page.getByRole('textbox', { name: 'Notes' }).press('Tab');
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('Saved'));
  const lists = (await overview()).planner;
  eq(lists.map((l) => [l.name, l.items.length]), [['To do', 1], ['Wishlist', 1], ['Notes', 0]], 'nothing in the notes turned into a list or a task');
  assert(lists[2].notes.includes('Read more.'), 'the notes kept');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

await test('on the site: tabs for each list, the month with what’s due, a wish that came true', async () => {
  await putFile('planner.md', `---\n---\n## To do\n- [ ] Post the parcel @${day(1)} — before Friday\n- [x] Call Nan\n- [ ] Late one @${day(-2)}\n## Wishlist\n- [x] Linen shirt\n- [ ] A film camera\n## Secret (private)\n- [ ] Party\n`);
  for (const opts of [{ viewport: { width: 1280, height: 800 } }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]) {
    const browser = await chromium.launch();
    const p = await browser.newPage(opts);
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await p.goto(BASE + '/#/planner');
    await p.waitForSelector('.pln-book');
    eq(await p.locator('.pln-tab').allInnerTexts(), ['To do', 'Wishlist'], 'a tab for each list on the site');
    const list = await p.locator('.pln-list').innerText();
    assert(list.includes('Post the parcel') && list.includes('before Friday') && list.includes('was due'), 'the list, its note and what’s late: ' + list);
    assert(await p.locator('.pln-day.has').count() >= 1, 'due days marked on the month');
    if (day(1).slice(0, 7) === day(0).slice(0, 7)) {
      await p.locator('.pln-day.has').filter({ hasText: new RegExp(`^${+day(1).slice(8)}$`) }).first().click();
      assert((await p.locator('.pln-list').innerText()).includes('Post the parcel'), 'tap a day to see what’s due');
    }
    await p.locator('.pln-tab', { hasText: 'Wishlist' }).click();
    assert((await p.locator('.pln-list').innerText()).includes('Got it!'), 'a wish that came true');
    eq(await p.locator('body').evaluate((b) => b.innerText.includes('Party')), false, 'nothing private');
    assert(!p.errors.length, p.errors.join('; '));
    await browser.close();
  }
  // No lists: no Planner in the menus.
  await putFile('planner.md', '---\n---\n## Secret (private)\n- [ ] Party\n');
  eq((await publicData()).planner, [], 'nothing for the site');
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
