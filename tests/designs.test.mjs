// Designs you can swap: the visa in the passport (passport.md) and keepsakes switched off or
// designed yourself (keepsakes.md). Saved from the back office, they must reach the site, and
// posts must keep their keepsakes through edits, even ones whose design is gone.
import { test, report, assert, eq, launch, close, adminPage, editPost, clickSave, publicData, overview, getFile, putFile, fileExists, mediaOk, split, PHOTOS, BASE, chromium } from './lib.mjs';

await launch();

await test('with no settings the passport keeps the original visa', async () => {
  const d = await publicData();
  eq([d.passport.design, d.passport.picture, d.keepsakes.hidden, d.keepsakes.custom], ['central', '', [], []], 'defaults');
});

await test('the visa: pick a design, change a colour and the words, add a picture', async () => {
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Designs' }).click();
  await page.waitForSelector('.visa-preview .visa');
  await page.locator('.design-pick', { hasText: 'Seaside' }).click();
  eq(await page.locator('.visa-preview .visa').getAttribute('data-design'), 'seaside', 'preview follows the pick');
  await page.locator('.colour-pick', { hasText: 'Ink' }).locator('input').evaluate((el) => {
    el.value = '#6a2a8d';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const words = page.getByRole('textbox', { name: 'Words for visa' });
  await words.fill('VISA, VIZA, BISA');
  await words.dispatchEvent('change');
  await page.locator('.design-box').first().locator('input[type=file]').setInputFiles(PHOTOS[0]);
  await page.locator('button', { hasText: 'Save the visa' }).click();
  await page.waitForSelector('.toast:not([hidden])');
  const d = await publicData();
  eq([d.passport.design, d.passport.ink, d.passport.words], ['seaside', '#6a2a8d', ['VISA', 'VIZA', 'BISA']], 'saved settings');
  assert(/^design\/visa-/.test(d.passport.picture), 'picture: ' + d.passport.picture);
  const problem = await mediaOk('/media/' + d.passport.picture);
  assert(!problem, 'picture does not load: ' + problem);
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

await test('the passport shows the chosen visa, and "Back to the original" restores it', async () => {
  const browser = await chromium.launch();
  const site = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await site.addInitScript(() => sessionStorage.setItem('entered', '1'));
  await site.goto(BASE + '/#/passport');
  await site.waitForSelector('.visa');
  eq(await site.locator('.visa').first().getAttribute('data-design'), 'seaside', 'design on the site');
  assert((await site.locator('.visa .v-world').first().innerText()).includes('VIZA'), 'words on the visa');
  assert(await site.locator('.visa image').count(), 'the picture is in the visa');
  await browser.close();
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Designs' }).click();
  await page.waitForSelector('.visa-preview .visa');
  const old = (await publicData()).passport.picture;
  await page.locator('button', { hasText: 'Back to the original' }).click();
  await page.locator('button', { hasText: 'Save the visa' }).click();
  await page.waitForSelector('.toast:not([hidden])');
  const d = await publicData();
  eq([d.passport.design, d.passport.ink, d.passport.picture], ['central', '', ''], 'back to the original');
  assert(!(await fileExists(old)), 'the old picture was not removed');
  await page.close();
});

await test('keepsakes: switch one off and make one of your own', async () => {
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Designs' }).click();
  await page.waitForSelector('.keep-switch');
  const tickets = page.locator('.keep-switch').filter({ has: page.locator('summary', { hasText: /^Tickets/ }) });
  await tickets.locator('summary').click();
  await tickets.locator('.keep-tick', { hasText: 'Boarding pass' }).locator('input').uncheck();
  await page.locator('.km-new').click();
  await page.getByRole('textbox', { name: 'Name (in the editor)' }).fill('Ferry ticket');
  await page.getByRole('textbox', { name: 'Heading on it (leave empty for the name)' }).fill('FERRY');
  await page.locator('.km-form label.check', { hasText: 'Books' }).locator('input').check();
  await page.locator('.km-form label.check', { hasText: 'price' }).locator('input').check();
  await page.locator('.km-form button', { hasText: 'Add it' }).click();
  await page.locator('button', { hasText: 'Save keepsakes' }).click();
  await page.waitForSelector('.toast:not([hidden])');
  const d = await publicData();
  eq(d.keepsakes.hidden, ['boarding'], 'switched off');
  eq(d.keepsakes.custom.map((x) => [x.id, x.name, x.heading, x.types, x.prices]), [['ferry-ticket', 'Ferry ticket', 'FERRY', ['places', 'books'], true]], 'your own');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

await test('a journal entry gets your own keepsake; switched-off ones leave the editor', async () => {
  await putFile('places/2026-10-25-the-bay.md', '---\ndate: 2026-10-25 10:00\ntitle: The Bay\ncity: Oban\ncountry_code: GB\nlat: 56.41\nlon: -5.47\ncustom_keepsakes: {gone: [Kept as it was]}\n---\nA day by the sea.\n');
  const page = await adminPage();
  await editPost(page, 'The Bay');
  await page.evaluate(() => (document.querySelector('details.keep-panel').open = true));
  await page.locator('.keep-tab', { hasText: 'Tickets' }).click();
  assert(!(await page.locator('.keep-tick', { hasText: 'Boarding pass' }).count()), 'a switched-off keepsake is still offered');
  await page.locator('.keep-tab', { hasText: 'My keepsakes' }).click();
  await page.locator('.keep-tick', { hasText: 'Ferry ticket' }).click();
  await page.locator('.keep-lines[data-kind="c-ferry-ticket"] button', { hasText: '+ Add a line' }).click();
  await page.locator('.keep-lines[data-kind="c-ferry-ticket"] .fl-row input').first().fill('Return');
  await page.locator('.keep-lines[data-kind="c-ferry-ticket"] .fl-row input.price-in').first().fill('£8.50');
  await clickSave(page);
  const post = (await overview()).posts.find((p) => p.title === 'The Bay');
  eq(post.custom_keepsakes, { gone: [{ item: 'Kept as it was', price: '' }], 'ferry-ticket': [{ item: 'Return', price: '£8.50' }] }, 'saved, and the deleted design kept');
  await editPost(page, 'The Bay');
  await clickSave(page);
  const again = (await overview()).posts.find((p) => p.title === 'The Bay');
  eq(again.custom_keepsakes, post.custom_keepsakes, 'after a second save');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  const browser = await chromium.launch();
  const site = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true });
  await site.addInitScript(() => sessionStorage.setItem('entered', '1'));
  await site.goto(BASE + '/#/journal/2026-10-25-the-bay');
  await site.waitForSelector('.km');
  const text = await site.locator('.km').allInnerTexts();
  eq(text.length, 1, 'only the keepsake with a design shows');
  assert(/FERRY/.test(text[0]) && /£8.50/.test(text[0]), 'ferry ticket: ' + text[0]);
  await browser.close();
});

await test('odd settings files never break the site', async () => {
  await putFile('passport.md', '---\ndesign: nonsense\nink: red\nwords: {a: 1}\npicture: ../../secret.jpg\nstrip: [x]\n---\n');
  await putFile('keepsakes.md', '---\nhidden: oops\ncustom:\n  - just a string\n  - {id: "Bad Id!", name: x}\n  - {id: ok, name: "", shape: blob}\n  - {id: fine, name: Fine, shape: blob, types: [nope]}\n---\n');
  const d = await publicData();
  eq([d.passport.design, d.passport.ink, d.passport.words, d.passport.picture, d.passport.strip], ['central', '', [], '', ''], 'passport falls back');
  eq(d.keepsakes.custom.map((x) => [x.id, x.shape, x.types]), [['fine', 'ticket', ['places']]], 'only the sound one');
  eq(d.keepsakes.hidden, [], 'hidden falls back');
  await putFile('passport.md', '---\n---\n');
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
