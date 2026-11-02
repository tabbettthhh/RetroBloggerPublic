// The highlights cabinet (five shelves of five, chosen in the back office, in a room of its own
// reached from the About page) and
// the back office's five sections.
import { test, report, assert, eq, launch, close, adminPage, editPost, clickSave, getFile, putFile, delFile, publicData, overview, BASE, chromium, openTab, rowMenu, toastText, unfold } from './lib.mjs';

await launch();
const ago = (d) => new Date(Date.now() - d * 86400e3).toISOString().slice(0, 16).replace('T', ' ');
const post = (type, slug, title, extra = '') => putFile(`${type}/${slug}.md`, `---\n${/^date:/m.test(extra) ? '' : `date: ${ago(slug.length % 9 + 1)}\n`}title: ${title}\n${extra}---\nLovely.\n`);

await test('the server keeps five live posts a shelf, in order, and marks each one', async () => {
  const { parseHighlights } = await import('../src/content.js');
  eq(parseHighlights('---\nplaces: [{"post": "places/a", "why": "Best scones"}, "places/b", {"post": "music/x"}, {"post": "places/a"}, {"post": "../x"}]\nbooks: ["books/x"]\n---\n'), { places: [{ post: 'places/a', why: 'Best scones' }, { post: 'places/b', why: '' }] }, 'only its own shelf, once each, no other shelves');
  const { parseHighlightsPast } = await import('../src/content.js');
  eq(parseHighlightsPast('---\npast: [{"post": "films/a", "why": "Once", "until": "2026-01-02"}, "books/b", {"post": "films/a"}, {"post": "x/../y"}, {"post": "tv/c", "until": "soon"}]\n---\n'), [{ post: 'films/a', why: 'Once', until: '2026-01-02' }, { post: 'tv/c', why: '', until: '' }], 'the library: cabinet shelves only, once each');
  for (let i = 1; i <= 6; i++) await post('places', `cafe-${i}`, `Café ${i}`);
  await post('places', 'later', 'Not yet', `date: 2099-01-01 10:00\n`);
  await post('films', 'secret', 'A draft', 'draft: true\n');
  await putFile('highlights.md', '---\nplaces: [{"post": "places/cafe-2", "why": "The window seat"}, "places/later", "places/cafe-1", "places/gone"]\nfilms: ["films/secret"]\n---\n');
  const d = await publicData();
  eq(d.highlights, { places: [{ post: 'places/cafe-2', why: 'The window seat' }, { post: 'places/cafe-1', why: '' }] }, 'only what’s on the site');
  eq(d.posts.filter((p) => p.highlight).map((p) => [p.slug, p.highlight]).sort(), [['cafe-1', 2], ['cafe-2', 1]], 'each marked with its place');
});

await test('the back office: five sections, each with its own pages; on a phone a bar along the bottom', async () => {
  const page = await adminPage();
  eq(await page.locator('.admin-sections button').allInnerTexts(), ['Home', 'Posts', 'Inbox', 'Look', 'More'], 'five sections');
  eq((await page.locator('.admin-tabs button:visible').allInnerTexts()).map((t) => t.trim()), ['Posts', 'New post', 'Highlights', 'Planner'], 'Posts, to start');
  await page.locator('.admin-sections button[data-section="more"]').click();
  eq((await page.locator('.admin-tabs button:visible').allInnerTexts()).map((t) => t.trim()), ['Friends', 'Site & wishlist', 'Travel stats', 'Export & files'], 'More');
  assert(await page.locator('.admin-tabs').evaluate((e) => e.scrollWidth <= e.clientWidth + 1), 'nothing off to the side');
  await page.close();
  const browser = await chromium.launch();
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.goto(BASE + '/admin/');
  await phone.waitForSelector('.admin-sections button');
  const bar = await phone.locator('.admin-sections').boundingBox();
  assert(bar.y + bar.height >= 840 && bar.width >= 380, 'along the bottom: ' + JSON.stringify(bar));
  // The posts list: tap to edit, the rest in the ⋯ menu; the editor: writing first, Publish in reach.
  await phone.locator('.list-row', { hasText: 'Café 3' }).locator('.row-main').click();
  await phone.waitForSelector('.ed-actions');
  const publish = await phone.locator('.ed-actions button.go').boundingBox();
  assert(publish.y + publish.height <= bar.y + 2 && publish.y > 500, 'Publish stays in reach, above the bar: ' + JSON.stringify(publish));
  eq(await phone.locator('.ed-fold[data-fold="options"]').evaluate((e) => e.open), false, 'options folded away');
  await browser.close();
});

await test('adding from the posts list; a full shelf asks which makes way; the order and the lines on why are kept', async () => {
  await putFile('highlights.md', '---\nplaces: ["places/cafe-2", "places/cafe-1", "places/gone"]\n---\n');
  const page = await adminPage();
  await openTab(page, 'Posts');
  for (const n of [3, 4, 5]) {
    await rowMenu(page.locator('.list-row', { hasText: `Café ${n}` }), 'Add to highlights');
    await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('In the highlights'));
  }
  eq((await overview()).highlights.places.length, 5, 'five on the shelf');
  // A sixth: the shelf is full.
  await rowMenu(page.locator('.list-row', { hasText: 'Café 6' }), 'Add to highlights');
  await page.waitForSelector('dialog.hl-choose[open]');
  await page.locator('dialog.hl-choose .list-row', { hasText: 'Café 1' }).locator('button', { hasText: 'Replace this' }).click();
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('In the highlights'));
  const ids = (await overview()).highlights.places.map((x) => x.post);
  assert(ids.includes('places/cafe-6') && !ids.includes('places/cafe-1') && ids.length === 5, 'Café 1 made way: ' + ids);
  eq((await overview()).highlightsPast.map((x) => x.post), ['places/cafe-1'], 'and went into the library');
  // Not a draft.
  await openTab(page, 'Posts');
  await rowMenu(page.locator('.list-row', { hasText: 'A draft' }), 'Add to highlights');
  assert((await toastText(page)).includes('Only posts that are on the site'), 'drafts stay out');
  // The Highlights page: move one up, write why.
  await openTab(page, 'Highlights');
  const rows = page.locator('.hl-shelf').first().locator('.hl-row');
  const second = await rows.nth(1).locator('strong').innerText();
  await rows.nth(1).getByRole('button', { name: 'Move up' }).click();
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('Moved'));
  await page.locator('.hl-shelf').first().locator('.hl-row').first().getByRole('textbox').fill('Rain on the window, a pot of tea.');
  await page.locator('.hl-shelf').first().locator('.hl-row').first().getByRole('textbox').press('Tab');
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('Saved'));
  const saved = await getFile('highlights.md');
  assert(saved.includes('Rain on the window, a pot of tea.'), 'why saved:\n' + saved);
  eq((await overview()).posts.find((p) => p.title === second).highlight, 1, 'moved to №1');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

await test('from the editor’s Options: in, with a line on why; and out again', async () => {
  await post('music', 'night-drive', 'Night Drive', 'creator: The Lanterns\n');
  const page = await adminPage();
  await editPost(page, 'Night Drive');
  await page.getByRole('checkbox', { name: /Add to my highlights/ }).check();
  await page.getByRole('textbox', { name: 'Why it’s a highlight' }).fill('Every motorway at 2am.');
  await clickSave(page);
  await page.waitForTimeout(500);
  eq((await overview()).highlights.music, [{ post: 'music/night-drive', why: 'Every motorway at 2am.' }], 'in, with its line');
  await editPost(page, 'Night Drive');
  await page.getByRole('checkbox', { name: /In my highlights/ }).uncheck();
  await clickSave(page);
  await page.waitForTimeout(500);
  eq((await overview()).highlights.music, undefined, 'and out');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

await test('on the site: a way in from About, a room of its own, shelves in order, a closer look, dressed for the day, and a rosette', async () => {
  await post('music', 'midnight', 'Midnight Static', 'creator: Ivy Lane\n');
  await post('films', 'quiet-coast', 'The Quiet Coast');
  await post('tv', 'harbour', 'Harbour Lights');
  await post('podcasts', 'slow', 'Slow History');
  const hl = (await overview()).highlights;
  await putFile('books/stoner.md', `---\ndate: ${ago(4)}\ntitle: Stoner\nauthor: John Williams\nrecommend: true\n---\nQuiet and perfect.\n`);
  await putFile('highlights.md', `---\npodcasts: ["podcasts/slow"]\ntv: ["tv/harbour"]\nplaces: ${JSON.stringify(hl.places)}\nfilms: [{"post": "films/quiet-coast", "why": "Saw it twice in a week."}]\nmusic: ["music/midnight"]\npast: [{"post": "places/cafe-1", "why": "Sunday lunch, every week.", "until": "2026-09-01"}, {"post": "places/gone"}]\n---\n`);
  const look = async (season, start = '/#/highlights') => {
    await putFile('theme.md', `---\ntheme: classic\nseasons: ${season}\n---\n`);
    const browser = await chromium.launch();
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await p.goto(BASE + start);
    if (start.endsWith('about')) {
      await p.locator('.cab-entrance:visible').first().click();
    }
    const cab = p.locator('.cab-room .cabinet');
    await cab.waitFor();
    return { browser, p, cab };
  };
  const { browser, p, cab } = await look('off', '/#/about');
  assert(await p.evaluate(() => document.documentElement.classList.contains('in-room')), 'a room of its own');
  for (const sel of ['.taskbar', '.start-menu', '.dock']) assert(!(await p.locator(`${sel}:visible`).count()), `no ${sel} in the room`);
  eq(await cab.locator('.cab-plate').allInnerTexts(), ['PLACES', 'MUSIC', 'FILMS', 'TELEVISION', 'PODCASTS'], 'Places, Music, Films, TV, Podcasts');
  eq(await cab.locator('.cab-shelf-places .cab-item').count(), 5, 'five places');
  eq(await cab.locator('.cab-shelf-places .cab-item').first().locator('.cab-no1').count(), 1, 'the first marked №1');
  for (const [type, cls] of [['places', 'cab-map, .cab-frame'], ['music', 'cab-record'], ['films', 'cab-ticket, .cab-frame'], ['tv', 'cab-vhs'], ['podcasts', 'cab-cassette']]) eq(await cab.locator(`.cab-shelf-${type} .${cls}`).count() > 0, true, `${type}: as its own kind of thing`);
  // Behind glass until the key is turned.
  await cab.locator('.cab-doors').click();
  await p.waitForSelector('.cab-room .cabinet.open');
  await cab.locator('.cab-shelf-films .cab-pick').first().click();
  await p.waitForSelector('dialog.cab-dialog[open]');
  assert((await p.locator('dialog.cab-dialog').innerText()).includes('Saw it twice in a week.'), 'a closer look, with why');
  await p.locator('dialog.cab-dialog .cab-close').click();
  // The library beside it: what was once in the cabinet, and what's recommended, as books.
  eq(await p.locator('.lib.left .lib-spine').count(), 1, 'one former highlight');
  assert((await p.locator('.lib.left').innerText()).toUpperCase().includes('ONCE IN THE CABINET'), 'its plate');
  assert(await p.locator('.lib.right .lib-spine').count() >= 1, 'a recommended book');
  await p.locator('.lib.left .lib-pick').first().click();
  await p.waitForSelector('dialog.cab-dialog[open] .lib-book');
  const book = await p.locator('dialog.cab-dialog').innerText();
  assert(book.includes('Sunday lunch, every week.') && book.includes('Café 1'), 'opened, with why: ' + book);
  await p.locator('dialog.cab-dialog .cab-close').click();
  // Leave: back where you came from.
  await p.locator('.room-leave').click();
  await p.waitForFunction(() => !document.querySelector('.cab-room') && location.hash === '#/about');
  // The rosette on a post in the cabinet.
  await p.goto(BASE + '/#/films');
  await p.goto(BASE + '/#/');
  await p.waitForSelector('.card');
  assert(await p.locator('.card-rosette').count(), 'a rosette on highlighted posts');
  assert(!p.errors.length, p.errors.join('; '));
  await browser.close();
  // Dressed for the season or festive day.
  for (const [season, family, has] of [['winter', 'winter', ''], ['lunar_new_year', 'dragon', 'text'], ['nowruz', 'carpet', ''], ['dia_de_muertos', 'papel', '.cab-papel'], ['diwali', 'diya', ''], ['eid_al_fitr', 'lantern', ''], ['christmas', 'holly', ''], ['halloween', 'garland', '.cab-garland span']]) {
    const v = await look(season);
    eq(await v.cab.getAttribute('data-cab'), family, `${season}: its own look`);
    if (has) assert(await v.cab.locator(`.cab-crown ${has}`).count(), `${season}: its ornament`);
    assert(!v.p.errors.length, v.p.errors.join('; '));
    await v.browser.close();
  }
  // Nothing in it: no cabinet.
  await delFile('highlights.md');
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  eq((await publicData()).highlights, {}, 'empty');
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
