// Owner mode: signed in, the site itself has your tools on it. (Locally the lock is open, as
// DEV_ADMIN does for the back office; on the internet Cloudflare Access decides.)
import { test, report, assert, eq, launch, close, putFile, getFile, publicData, overview, BASE, chromium } from './lib.mjs';

await launch();
const at = (d) => new Date(Date.now() - d * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

await test('signing in comes back to the site (and only to a page of it); changes only come from the site', async () => {
  const go = async (to) => (await fetch(`${BASE}/admin/signin?to=${encodeURIComponent(to)}`, { redirect: 'manual' })).headers.get('location');
  eq(await go('#/journal'), '/?owner=1#/journal', 'back where you were');
  eq(await go('https://elsewhere.example/'), '/?owner=1#/', 'never somewhere else');
  eq(await go('#/x"><script>'), '/?owner=1#/', 'nothing odd');
  eq((await (await fetch(`${BASE}/admin/api/me`)).json()).owner, true, 'signed in (locally)');
  const r = await fetch(`${BASE}/admin/api/file?key=thoughts/x.md`, { method: 'PUT', body: 'x', headers: { Origin: 'https://elsewhere.example' } });
  eq(r.status, 403, 'a change from another site is refused');
});

const site = async (opts, fn, path = '/?owner=1#/') => {
  const browser = await chromium.launch();
  const p = await browser.newPage(opts);
  p.errors = [];
  p.loaded = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  p.on('request', (r) => p.loaded.push(new URL(r.url()).pathname));
  p.on('dialog', (d) => d.accept());
  await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
  await p.goto(BASE + path);
  try {
    await fn(p);
    assert(!p.errors.length, p.errors.join('; '));
  } finally {
    await browser.close();
  }
};
const DESK = { viewport: { width: 1280, height: 860 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

await test('a visitor never gets the owner’s tools, nor downloads them', async () => {
  await putFile('thoughts/secret-draft.md', `---\ndate: ${at(1)}\ntitle: Secret draft\ndraft: true\n---\nNot yet.\n`);
  await putFile('thoughts/hello.md', `---\ndate: ${at(5)}\ntitle: Hello\n---\nHi there.\n`);
  await site(PHONE, async (p) => {
    await p.waitForSelector('.card');
    await p.waitForTimeout(800);
    eq(await p.locator('.okit-plus, .okit-me, .okit-more').count(), 0, 'no tools');
    assert(!p.loaded.some((u) => u.startsWith('/admin/')), 'nothing from the back office: ' + p.loaded.filter((u) => u.startsWith('/admin')).join(', '));
    assert(!(await p.locator('body').innerText()).includes('Secret draft'), 'no drafts');
  }, '/#/');
});

for (const [name, opts] of [['a computer', DESK], ['a phone', PHONE]]) {
  await test(`signed in on ${name}: your tools on the site, drafts marked, ⋯ on each post, + to write`, async () => {
    await putFile('thoughts/pin-me.md', `---\ndate: ${at(3)}\ntitle: Pin me\n---\nA thought.\n`);
    await site(opts, async (p) => {
      await p.waitForSelector('.okit-plus');
      const scope = opts === DESK ? '.dw[data-app="home"] ' : '';
      if (opts === DESK) await p.locator('.dw[data-app="home"] .xp-title').click();
      eq(await p.locator('.okit-me').count(), 1, 'you, in the taskbar');
      const draft = p.locator(`${scope}.card`, { hasText: 'Secret draft' });
      await draft.waitFor();
      assert((await draft.locator('.okit-state').innerText()).includes('Draft'), 'your draft, marked');
      // ⋯ › Pin.
      await p.locator(`${scope}.card`, { hasText: 'Pin me' }).locator('.okit-more').click();
      await p.locator('.okit-menu button', { hasText: 'Pin to the top' }).click();
      await p.waitForFunction(() => document.querySelector('.okit-toast.on')?.textContent.includes('Pinned'));
      assert((await getFile('thoughts/pin-me.md')).includes('pinned: true'), 'pinned in the file');
      // + › Thought: write and publish, then it's on the site.
      await p.locator('.okit-plus').first().click();
      await p.locator('.okit-menu button', { hasText: 'Thought' }).click();
      // (A blank post at the top of your feed, written where it'll be read.)
      await p.waitForSelector('.card.ied .ied-text');
      eq(await p.evaluate(() => { const ed = document.querySelector('.card.ied'); const first = ed.closest('.feed')?.querySelector('.card:not(.ied)'); return !!first && !!(ed.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING); }), true, 'at the top of the feed, above your posts');
      const words = `Written on the site, on ${name}.`;
      await p.locator('.card.ied .ied-text').fill(words);
      await p.locator('.card.ied button.go', { hasText: 'Publish' }).click();
      await p.waitForFunction(() => !document.querySelector('.card.ied'));
      await p.waitForFunction((w) => [...document.querySelectorAll('.card')].some((c) => c.textContent.includes(w)), words);
      assert((await publicData()).posts.some((x) => `${x.body || ''} ${x.html || ''} ${x.excerpt || ''}`.includes(words)), 'published for everyone');
      // ⋯ › Edit: change it in place, save.
      await p.locator(`${scope}.card`, { hasText: words }).first().locator('.okit-more').click();
      await p.locator('.okit-menu button', { hasText: 'Edit' }).click();
      // (The post itself becomes its editor, right where it was.)
      await p.waitForSelector('.card.ied .ied-text');
      eq(await p.locator(`${scope}.card[data-post]`, { hasText: words }).first().isVisible(), false, 'the post turned into its editor');
      eq((await p.locator('.card.ied .ied-text').inputValue()).trim(), words, 'with its words');
      await p.locator('.card.ied .ied-text').fill(words + ' Edited.');
      await p.locator('.card.ied button.go').click();
      await p.waitForFunction(() => !document.querySelector('.card.ied'));
      await p.waitForFunction((w) => [...document.querySelectorAll('.card')].some((c) => c.textContent.includes(w)), words + ' Edited.');
      // View as a visitor: no drafts, no tools; and back.
      await p.locator('.okit-me').first().click();
      await p.locator('.okit-menu button', { hasText: 'View as a visitor' }).click();
      await p.waitForSelector('.okit-preview');
      await p.waitForFunction(() => ![...document.querySelectorAll('.card')].some((c) => c.textContent.includes('Secret draft')));
      eq(await p.locator('.okit-more:visible, .okit-plus:visible').count(), 0, 'no tools while seeing it as a visitor');
      await p.locator('.okit-preview button').click();
      await p.waitForFunction(() => [...document.querySelectorAll('.card')].some((c) => c.textContent.includes('Secret draft')));
      // The Control Panel: everything else, over the site.
      await p.locator('.okit-me').first().click();
      await p.locator('.okit-menu button', { hasText: 'Control Panel' }).click();
      await p.waitForSelector('.okit-host .admin-sections button');
      eq(await p.locator('.okit-host .admin-sections button').allInnerTexts(), ['Home', 'Posts', 'Inbox', 'Look', 'More'], 'its sections');
      await p.locator('.okit-close').click();
      await p.waitForFunction(() => !document.querySelector('.okit-host'));
    });
    // (Tidy up for the next round.)
    const mine = (await overview()).posts.filter((x) => `${x.body || ''} ${x.html || ''} ${x.excerpt || ''}`.includes('Written on the site'));
    for (const x of mine) await fetch(`${BASE}/admin/api/file?key=${encodeURIComponent(x.key)}`, { method: 'DELETE' });
  });
}

await test('a journal page turns into its editor in the journal, and back again', async () => {
  await putFile('places/tea-room.md', `---\ndate: ${at(30)}\ntitle: The Tea Room\ncity: Whitby\nlat: 54.48\nlon: -0.61\n---\nScones the size of your fist.\n`);
  await site(PHONE, async (p) => {
    await p.waitForSelector('.journal-head .okit-more');
    await p.locator('.journal-head .okit-more').click();
    await p.locator('.okit-menu button', { hasText: 'Edit' }).click();
    await p.waitForSelector('#main .card.ied .ied-title');
    eq(await p.locator('#main .card.ied .ied-title').inputValue(), 'The Tea Room', 'its name, ready to change');
    eq(await p.locator('.journal-head').isVisible(), false, 'the page made way for it');
    await p.locator('.card.ied button', { hasText: 'Cancel' }).click();
    await p.waitForSelector('.journal-head');
    eq(await p.locator('.card.ied').count(), 0, 'and back');
  }, '/?owner=1#/journal/tea-room');
});

await test('the welcome screen’s owner tile signs you in, back to the site', async () => {
  await site(PHONE, async (p) => {
    await p.goto(BASE + '/#/welcome');
    await p.locator('.owner-tile').click();
    await p.waitForSelector('.okit-plus');
    eq(new URL(p.url()).search, '', 'the address tidied');
  }, '/#/welcome');
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
