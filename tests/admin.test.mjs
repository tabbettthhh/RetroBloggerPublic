// End-to-end checks of the back office: every save should leave the site showing exactly
// what was saved, with every photo loading and nothing lost.
import { api, test, report, assert, eq, launch, close, adminPage, newPost, waitPhotos, editPost, clickSave, toastText, publicData, overview, getFile, putFile, fileExists, mediaOk, split, upload, PHOTOS, BASE, chromium } from './lib.mjs';

const findPost = async (pred) => (await overview()).posts.find(pred);
async function photosAllLoad(post) {
  assert(post, 'post not found');
  const problems = [];
  for (const u of post.photos) {
    const p = await mediaOk(u);
    if (p) problems.push(p);
  }
  assert(!problems.length, 'broken photos: ' + problems.join(', '));
}

await launch();

await test('a new thought is published and shows on the site', async () => {
  const page = await adminPage();
  await newPost(page, 'Thought');
  await page.locator('textarea.textarea').first().fill('Hello from the test run. Colons: fine? "Quotes" too.');
  const msg = await clickSave(page);
  assert(/Published/.test(msg), 'toast: ' + msg);
  const pub = await publicData();
  assert(pub.posts.some((p) => p.excerpt.startsWith('Hello from the test run')), 'not on the site');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

await test('a photo post with two photos and captions: every photo loads, cleaned', async () => {
  const page = await adminPage();
  await newPost(page, 'Photos');
  await page.locator('#photo-in').setInputFiles([PHOTOS[0], PHOTOS[1]]);
  await waitPhotos(page);
  const caps = page.locator('input[aria-label^="Caption for photo"]');
  await caps.nth(0).fill('first one');
  await caps.nth(1).fill('second: with colon');
  await page.locator('textarea.textarea').first().fill('Two photos test');
  const msg = await clickSave(page);
  assert(/Published/.test(msg), 'toast: ' + msg);
  const post = await findPost((p) => p.body.includes('Two photos test'));
  eq(post.photos.length, 2, 'photo count');
  eq(post.captions, ['first one', 'second: with colon'], 'captions');
  await photosAllLoad(post);
  await page.close();
});

await test('replacing a photo on a saved post keeps every photo working', async () => {
  const page = await adminPage();
  await editPost(page, 'Two photos test');
  await page.locator('.thumb .x').first().click();
  await page.locator('#photo-in').setInputFiles([PHOTOS[2]]);
  await waitPhotos(page);
  await clickSave(page);
  const post = await findPost((p) => p.body.includes('Two photos test'));
  eq(post.photos.length, 2, 'photo count');
  await photosAllLoad(post);
  await page.close();
});

await test('changing only a caption keeps the photos', async () => {
  const page = await adminPage();
  await editPost(page, 'Two photos test');
  await page.locator('input[aria-label^="Caption for photo"]').first().fill('renamed caption');
  await clickSave(page);
  const post = await findPost((p) => p.body.includes('Two photos test'));
  eq(post.captions[0], 'renamed caption', 'caption');
  await photosAllLoad(post);
  await page.close();
});

await test('new post with a photo, saved from "Edit as Markdown": photo still loads', async () => {
  const page = await adminPage();
  await newPost(page, 'Photos');
  await page.locator('#photo-in').setInputFiles([PHOTOS[3]]);
  await waitPhotos(page);
  await page.locator('textarea.textarea').first().fill('Raw mode photo test');
  await page.locator('button', { hasText: 'Edit as Markdown' }).click();
  await page.waitForSelector('textarea.mono');
  const raw = await page.locator('textarea.mono').inputValue();
  assert(!/undefined/.test(raw), 'the file text says "undefined":\n' + raw);
  await page.locator('button', { hasText: 'Save file' }).click();
  await toastText(page);
  const post = await findPost((p) => p.body.includes('Raw mode photo test'));
  assert(post && post.photos.length === 1, 'expected 1 photo, got ' + JSON.stringify(post?.files));
  await photosAllLoad(post);
  await page.close();
});

await test('removing a photo, then saving from "Edit as Markdown": no broken photo', async () => {
  const page = await adminPage();
  await editPost(page, 'Two photos test');
  await page.locator('.thumb .x').first().click();
  await page.locator('button', { hasText: 'Edit as Markdown' }).click();
  await page.waitForSelector('textarea.mono');
  await page.locator('button', { hasText: 'Save file' }).click();
  await toastText(page);
  const post = await findPost((p) => p.body.includes('Two photos test'));
  await photosAllLoad(post);
  await page.close();
});

await test('a post whose header has a mistake opens as text, not an empty form', async () => {
  const key = 'thoughts/2026-10-01-broken-header.md';
  const text = '---\ndate: 2026-10-01 10:00\ntitle: Rome: day one\nphotos: [1.jpg]\n---\nBody of the broken post\n';
  // Saving it through the back office is now refused, so put it in the bucket the way a
  // hand-uploaded file would arrive.
  await api('batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: [{ key, text }] }) });
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Posts' }).click();
  const row = page.locator('.list-row').filter({ hasText: 'Body of the broken post' }).first();
  await row.locator('button', { hasText: 'Edit' }).click();
  // Either the raw file is shown, or the form still holds the title and photo.
  const rawShown = await page.locator('textarea.mono').count();
  if (!rawShown) {
    // Saving the empty form would throw away the date, title and photo.
    await clickSave(page).catch(() => {});
    const after = await getFile(key);
    assert(after.includes('Rome') && after.includes('1.jpg'), 'header was thrown away:\n' + after);
  }
  await page.close();
});

await test('the server refuses to save a header it could not read', async () => {
  const r = await fetch(`${BASE}/admin/api/file?key=thoughts/2026-10-02-x.md`, { method: 'PUT', body: '---\ntitle: a: b\n---\nx' });
  eq(r.status, 422, 'status');
  assert(!(await fileExists('thoughts/2026-10-02-x.md')), 'it was saved anyway');
});

await test('a mistake typed in "Edit as Markdown" is flagged straight away', async () => {
  const page = await adminPage();
  await editPost(page, 'Hello from the test run');
  await page.locator('button', { hasText: 'Edit as Markdown' }).click();
  await page.waitForSelector('textarea.mono');
  const raw = await page.locator('textarea.mono').inputValue();
  await page.locator('textarea.mono').fill(raw.replace(/^date:/m, 'title: Oops: a colon\ndate:'));
  await page.locator('button', { hasText: 'Save file' }).click();
  const msg = await toastText(page);
  assert(/mistake|problem|hidden|couldn|error/i.test(msg), 'no warning, toast said: ' + msg);
  // put it back so later checks see a normal post
  const p = (await overview()).posts.find((x) => x.body.includes('Hello from the test run'));
  await putFile(p.key, raw);
  await page.close();
});

await test('drafts and scheduled posts stay off the site', async () => {
  const page = await adminPage();
  await newPost(page, 'Thought');
  await page.locator('textarea.textarea').first().fill('A secret draft');
  await page.locator('label.row', { hasText: 'Keep as a draft' }).locator('input').check();
  await clickSave(page);
  await newPost(page, 'Thought');
  await page.locator('textarea.textarea').first().fill('A post for next year');
  await page.locator('input[type="datetime-local"]').fill('2027-06-01T10:00');
  await clickSave(page);
  const pub = await publicData();
  assert(!pub.posts.some((p) => /secret draft|next year/.test(p.excerpt)), 'hidden post visible');
  const all = (await overview()).posts;
  assert(all.some((p) => /secret draft/.test(p.excerpt)) && all.some((p) => /next year/.test(p.excerpt)), 'missing in back office');
  await page.close();
});

await test('a place: category, order, Floppy lines and stamp survive an edit', async () => {
  const page = await adminPage();
  await newPost(page, 'Place');
  await page.locator('input[placeholder="Name of the place"]').fill('Test Café "Zero"');
  await page.locator('.chip-btn', { hasText: 'Coffee' }).click();
  await page.locator('.star-pick button').nth(3).click();
  // Keepsakes are folded away until opened; ticking the till receipt opens its first line.
  await page.locator('details.keep-panel summary').click();
  await page.locator('.keep-tick', { hasText: 'Till receipt' }).click();
  const rows = page.locator('.keep-lines[data-kind="till"] .fl-row');
  await rows.last().locator('input').first().fill('Flat white');
  await rows.last().locator('input.price-in').fill('£3.40');
  // An entry ticket with a line, and a plain travel ticket.
  await page.locator('.keep-tab', { hasText: 'Tickets' }).click();
  await page.locator('.keep-tick', { hasText: 'Entry ticket' }).click();
  await page.locator('.keep-lines[data-kind="entry"] button', { hasText: '+ Add a line' }).click();
  await page.locator('.keep-lines[data-kind="entry"] .fl-row input').first().fill('Adult entry');
  await page.locator('.keep-lines[data-kind="entry"] .fl-row input.price-in').fill('€14');
  await page.locator('.keep-tick', { hasText: 'Travel ticket' }).click();
  await page.locator('.keep-tab', { hasText: 'Little things' }).click();
  await page.locator('.keep-tick', { hasText: 'Room key' }).click();
  await page.locator('.keep-lines[data-kind="roomkey"] button', { hasText: '+ Add a line' }).click();
  await page.locator('.keep-lines[data-kind="roomkey"] .fl-row input').first().fill('12');
  // the gig ticket is shared with music reviews but sits under Concerts here; masks are plain
  await page.locator('.keep-tab', { hasText: 'Concerts' }).click();
  await page.locator('.keep-tick', { hasText: 'Gig ticket' }).click();
  await page.locator('.keep-lines[data-kind="gig"] button', { hasText: '+ Add a line' }).click();
  await page.locator('.keep-lines[data-kind="gig"] .fl-row input').first().fill('Standing');
  await page.locator('.keep-tab', { hasText: 'Stage & comedy' }).click();
  await page.locator('.keep-tick', { hasText: 'Theatre masks' }).click();
  await page.locator('details.floppy-panel summary').click();
  await page.locator('.floppy-panel input').first().fill('Get the flat white: trust me');
  await page.locator('textarea.textarea').first().fill('Lovely little place.');
  await clickSave(page);
  const before = await findPost((p) => p.title === 'Test Café "Zero"');
  assert(before, 'place missing');
  eq([before.category, before.rating, before.ordered, before.floppy], ['coffee', 4, [{ item: 'Flat white', price: '£3.40' }], ['Get the flat white: trust me']], 'saved fields');
  eq([before.tickets, before.rides, before.bought, before.roomkey, before.postcard, before.gig, before.masks], [[{ item: 'Adult entry', price: '€14' }], [], [], [{ item: '12', price: '' }], null, [{ item: 'Standing', price: '' }], []], 'saved keepsakes');
  await editPost(page, 'Test Café');
  await clickSave(page);
  const after = await findPost((p) => p.title === 'Test Café "Zero"');
  eq([after.category, after.rating, after.ordered, after.floppy], [before.category, before.rating, before.ordered, before.floppy], 'fields after a second save');
  eq([after.tickets, after.rides, after.bought, after.roomkey, after.postcard, after.gig, after.masks], [before.tickets, before.rides, before.bought, before.roomkey, before.postcard, before.gig, before.masks], 'keepsakes after a second save');
  await page.close();
});

await test('TV episodes and a book reading log survive an edit', async () => {
  await putFile('tv/2026-09-01-show.md', '---\ndate: 2026-09-01 20:00\ntitle: Test Show\ncreator: Someone\nstatus: watching\nseason: 2\nepisode: 5\nepisodes:\n  - season: 2\n    ep: 1\n    to: 3\n    rating: 4.5\n    date: 2026-09-01\n    note: "Binge: great"\n  - season: 2\n    ep: 4\n    title: The one with the twist\n    date: 2026-09-03\n---\nGood show.\n');
  await putFile('books/2026-09-01-book.md', '---\ndate: 2026-09-01 20:00\ntitle: Test Book\nauthor: A. Writer\nstatus: reading\npages: 300\npage: 120\nreading_log:\n  - date: 2026-09-02\n    from: 1\n    to: 60\n    chapter: "One: the start"\n  - date: 2026-09-05\n    pages: 61-120\n---\nGood book.\n');
  const before = (await overview()).posts;
  const tv0 = before.find((p) => p.title === 'Test Show');
  const bk0 = before.find((p) => p.title === 'Test Book');
  const page = await adminPage();
  await editPost(page, 'Test Show');
  await clickSave(page);
  await editPost(page, 'Test Book');
  await clickSave(page);
  const after = (await overview()).posts;
  const tv1 = after.find((p) => p.title === 'Test Show');
  const bk1 = after.find((p) => p.title === 'Test Book');
  eq(tv1.episodes, tv0.episodes, 'episodes');
  eq([tv1.season, tv1.episode, tv1.state], [tv0.season, tv0.episode, tv0.state], 'tv fields');
  eq(bk1.reading_log, bk0.reading_log, 'reading log');
  eq([bk1.pages, bk1.page, bk1.state], [bk0.pages, bk0.page, bk0.state], 'book fields');
  await page.close();
});

await test('extra fields written by hand survive an edit unchanged', async () => {
  await putFile('thoughts/2026-09-02-extras.md', '---\ndate: 2026-09-02 09:00\ntitle: Extras test\nmood: happy\ntags: [one, two]\nlinks:\n  site: https://example.com\n  count: 3\nrating_note: "5/5"\n---\nExtras body\n');
  const page = await adminPage();
  await editPost(page, 'Extras test');
  await clickSave(page);
  const { data } = split(await getFile('thoughts/2026-09-02-extras.md'));
  eq([data.mood, data.tags, data.links, data.rating_note], ['happy', ['one', 'two'], { site: 'https://example.com', count: 3 }, '5/5'], 'extra fields');
  await page.close();
});

await test('pinning and unpinning only changes the pin', async () => {
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Posts' }).click();
  const row = () => page.locator('.list-row').filter({ hasText: 'Extras test' }).first();
  const before = await getFile('thoughts/2026-09-02-extras.md');
  await row().locator('button', { hasText: 'Pin' }).click();
  await toastText(page);
  assert((await overview()).posts.find((p) => p.title === 'Extras test').pinned, 'not pinned');
  await page.waitForTimeout(300);
  await row().locator('button', { hasText: 'Unpin' }).click();
  await page.waitForTimeout(800);
  const after = await getFile('thoughts/2026-09-02-extras.md');
  eq(split(after).data, split(before).data, 'header after pin + unpin');
  await page.close();
});

await test('deleting a post removes it and its photos', async () => {
  await upload('photos/2026-09-03-to-delete/1.jpg', PHOTOS[0]);
  await upload('photos/2026-09-03-to-delete/2.jpg', PHOTOS[1]);
  await putFile('photos/2026-09-03-to-delete.md', '---\ndate: 2026-09-03 10:00\nphotos: ["1.jpg", "2.jpg"]\n---\nDelete me please\n');
  const post = await findPost((p) => p.body.includes('Delete me please'));
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Posts' }).click();
  await page.locator('.list-row').filter({ hasText: 'Delete me please' }).first().locator('button', { hasText: 'Delete' }).click();
  await toastText(page);
  assert(!(await fileExists(post.key)), 'file still there');
  for (const f of post.files) assert(!(await fileExists(post.key.replace(/\.md$/, '/') + f)), 'photo still there: ' + f);
  await page.close();
});

await test('site settings keep the About text and wishlist when saving the status', async () => {
  await putFile('site.md', '---\nname: Test Site\nowner: Tester\nstatus: hello\n---\nAbout me: I like tests.\n');
  await putFile('wishlist.md', '# Want to go\n- [ ] Somewhere, Paris (food) — a note\n');
  const page = await adminPage();
  // The status has its own tab, straight after the bell.
  const tabs = await page.locator('.admin-tabs button').allInnerTexts();
  eq(tabs[1].trim(), 'Status', 'the tab after the bell');
  await page.locator('.admin-tabs button', { hasText: /^Status$/ }).click();
  await page.waitForSelector('input[placeholder^="What are you up to"]');
  await page.locator('input[placeholder^="What are you up to"]').fill('testing things :)');
  await page.locator('button', { hasText: 'Update status' }).click();
  await toastText(page);
  const site = await getFile('site.md');
  assert(site.includes('About me: I like tests.'), 'About lost:\n' + site);
  assert(/status: "?testing things :\)"?/.test(site), 'status not saved:\n' + site);
  const log = await getFile('status-log.md');
  assert(log.includes('testing things'), 'status log missing');
  await page.close();
});

await test('posting with "Update my status too" sets the status as well', async () => {
  await putFile('site.md', '---\nname: Test Site\nowner: Tester\nstatus: before\n---\nAbout me: I like tests.\n');
  const page = await adminPage();
  await newPost(page, 'Music');
  await page.locator('.field', { has: page.locator('label', { hasText: /title|name/i }) }).locator('input').first().fill('Blue Skies');
  await page.locator('label.check', { hasText: 'Update my status too' }).locator('input').check();
  const box = page.getByRole('textbox', { name: 'New status' });
  assert(/Listening to Blue Skies/.test(await box.inputValue()), 'suggestion: ' + (await box.inputValue()));
  await box.fill('On repeat: Blue Skies (music)');
  const msg = await clickSave(page);
  assert(/Status updated too/.test(msg), 'toast: ' + msg);
  const site = await getFile('site.md');
  assert(site.includes('On repeat: Blue Skies (music)') && site.includes('About me: I like tests.') && site.includes('name: Test Site'), 'site.md:\n' + site);
  assert((await getFile('status-log.md')).includes('On repeat: Blue Skies'), 'not in past statuses');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

await test('the posts list: ten newest, the rest folded by month, and a search', async () => {
  const files = Array.from({ length: 14 }, (_, i) => ({ key: `thoughts/2025-0${(i % 3) + 1}-1${i % 9}-old-${i}.md`, text: `---\ndate: 2025-0${(i % 3) + 1}-1${i % 9} 12:00\ntitle: Old thought ${i}${i === 7 ? ' about pelicans' : ''}\n---\nWords.\n` }));
  await api('batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) });
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Posts' }).click();
  const top = await page.locator('.post-results > .list > .list-row').count();
  eq(top, 10, 'newest shown');
  const folds = await page.locator('.month-fold > summary').allInnerTexts();
  assert(folds.some((f) => /January 2025/.test(f)), 'month folds: ' + folds.join(' | '));
  assert(!(await page.locator('.month-fold .list-row', { hasText: 'about pelicans' }).isVisible()), 'folded months should start closed');
  await page.getByRole('searchbox', { name: 'Search posts' }).fill('pelicans');
  const hits = await page.locator('.post-results .list-row').allInnerTexts();
  eq(hits.length, 1, 'one hit');
  assert(/about pelicans/.test(hits[0]), 'hit: ' + hits[0]);
  await page.getByRole('searchbox', { name: 'Search posts' }).fill('');
  assert(await page.locator('.month-fold').count(), 'folds come back');
  await page.close();
});

await test('if the site files cannot be read, nothing can be overwritten with blanks', async () => {
  const page = await adminPage();
  await page.route('**/admin/api/file?key=site.md', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 500, body: '{"error":"boom"}', contentType: 'application/json' }) : r.continue()));
  await page.route('**/admin/api/file?key=wishlist.md', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 500, body: '{"error":"boom"}', contentType: 'application/json' }) : r.continue()));
  for (const tab of [/^Status$/, /^Site & wishlist$/]) {
    await page.locator('.admin-tabs button', { hasText: tab }).click();
    await page.waitForTimeout(1200);
    for (const t of ['Update status', 'Save site settings', 'Save wishlist']) {
      const b = page.locator('button', { hasText: t });
      if (await b.count()) {
        await b.first().click();
        await page.waitForTimeout(800);
      }
    }
  }
  const site = await getFile('site.md');
  const wish = await getFile('wishlist.md');
  assert(site.includes('About me: I like tests.'), 'About was wiped:\n' + site);
  assert(wish.includes('Somewhere, Paris'), 'wishlist was wiped:\n' + wish);
  await page.close();
});

await test('a new category added while categories.md cannot be read does not wipe the others', async () => {
  await putFile('categories.md', '- Bookshops, #8a4f26\n- Bakeries, #c97b2a\n');
  const page = await adminPage();
  await page.route('**/admin/api/file?key=categories.md', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 500, body: '{"error":"boom"}', contentType: 'application/json' }) : r.continue()));
  await newPost(page, 'Place');
  await page.locator('button', { hasText: '+ New category' }).click();
  await page.locator('input[aria-label="New category name"]').fill('Museums');
  await page.locator('button', { hasText: 'Add category' }).click();
  await page.waitForTimeout(800);
  const cats = await getFile('categories.md');
  assert(cats.includes('Bookshops') && cats.includes('Bakeries'), 'categories wiped:\n' + cats);
  await page.close();
});

await test('a suggestion added to the wishlist while it cannot be read does not wipe it', async () => {
  const r = await fetch(`${BASE}/api/suggest`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 Test' }, body: JSON.stringify({ kind: 'place', title: 'Suggested Spot', name: 'Ali', note: 'try the tea' }) });
  assert(r.ok, 'suggest failed ' + r.status);
  const page = await adminPage();
  await page.route('**/admin/api/file?key=wishlist.md', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 500, body: '{"error":"boom"}', contentType: 'application/json' }) : r.continue()));
  await page.locator('.admin-tabs button', { hasText: 'Suggestions' }).click();
  await page.locator('button', { hasText: 'Add to wishlist' }).first().click();
  await page.waitForTimeout(1000);
  const wish = await getFile('wishlist.md');
  assert(wish.includes('Somewhere, Paris'), 'wishlist wiped:\n' + wish);
  await page.close();
});

await test('guestbook: sign, approve, reply; it shows on the site', async () => {
  const r = await fetch(`${BASE}/api/guestbook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 Test' }, body: JSON.stringify({ name: 'Visitor <b>bold</b>', message: 'Hi there: "nice" site <script>alert(1)</script>' }) });
  assert(r.ok, 'sign failed');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Guestbook' }).click();
  await page.locator('button', { hasText: 'Approve' }).first().click();
  await toastText(page);
  await page.waitForTimeout(500);
  await page.locator('input[aria-label^="Reply to"]').first().fill('Thanks: really!');
  await page.locator('button', { hasText: 'Save reply' }).first().click();
  await toastText(page);
  const pub = await publicData();
  const g = pub.guestbook.find((x) => x.message.includes('nice'));
  assert(g && g.reply === 'Thanks: really!', 'guestbook entry: ' + JSON.stringify(g));
  await page.close();
});

await test('travel stats keep their note when saved', async () => {
  await putFile('travel.md', '---\nflights: 12\ndistance_km: 34000\n---\nMostly short hops.\n');
  const page = await adminPage();
  await page.route('**/admin/api/file?key=travel.md', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 500, body: '{"error":"boom"}', contentType: 'application/json' }) : r.continue()));
  await page.locator('.admin-tabs button', { hasText: 'Travel stats' }).click();
  await page.waitForTimeout(1000);
  const b = page.locator('button', { hasText: 'Save travel stats' });
  if (await b.count()) {
    await b.click();
    await page.waitForTimeout(800);
  }
  const t = await getFile('travel.md');
  assert(t.includes('Mostly short hops.'), 'note wiped:\n' + t);
  await page.close();
});

await test('logging an episode just after midnight uses today, not yesterday', async () => {
  const page = await adminPage();
  // Pretend it is 00:30 on 24 Oct, British Summer Time (23:30 on the 23rd in UTC).
  await page.addInitScript(() => {
    const fake = new Date('2026-10-24T00:30:00+01:00').getTime();
    const RealDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate {
      constructor(...a) {
        super(...(a.length ? a : [fake]));
      }
      static now() {
        return fake;
      }
    };
  });
  await page.reload();
  await page.waitForSelector('.admin-tabs button');
  await editPost(page, 'Test Show');
  await page.locator('button', { hasText: '+ Log an episode' }).click();
  const d = await page.locator('.ep-edit input[type="date"]').first().inputValue();
  eq(d, '2026-10-24', 'episode date');
  await page.close();
});

await test('a sign-in that has run out is reported as such, and the writing stays', async () => {
  const page = await adminPage();
  await newPost(page, 'Thought');
  await page.locator('textarea.textarea').first().fill('Written while signed out');
  await page.route('**/admin/api/file?key=*', (r) => r.fulfill({ status: 302, headers: { Location: 'https://team.cloudflareaccess.com/cdn-cgi/access/login' }, body: '' }));
  const msg = await clickSave(page);
  assert(/sign-in has run out/.test(msg), 'toast: ' + msg);
  eq(await page.locator('textarea.textarea').first().inputValue(), 'Written while signed out', 'text kept');
  await page.close();
});

await test('unsaved writing survives closing the tab and can be carried on', async () => {
  const page = await adminPage();
  await newPost(page, 'Thought');
  await page.locator('input[placeholder="Optional"]').fill('Half-written');
  await page.locator('textarea.textarea').first().fill('This was not saved before the tab closed');
  await page.waitForTimeout(900);
  await page.reload();
  await page.waitForSelector('.draft-banner');
  await page.locator('.draft-banner button', { hasText: 'Carry on writing' }).click();
  eq(await page.locator('textarea.textarea').first().inputValue(), 'This was not saved before the tab closed', 'restored text');
  const msg = await clickSave(page);
  assert(/Published/.test(msg), 'toast: ' + msg);
  await page.reload();
  await page.waitForSelector('.admin-tabs button');
  eq(await page.locator('.draft-banner').count(), 0, 'banner after saving');
  await page.close();
});

await test('starting a new post asks before throwing away unsaved writing', async () => {
  const page = await adminPage();
  await newPost(page, 'Thought');
  await page.locator('textarea.textarea').first().fill('Do not lose me');
  await page.locator('.admin-tabs button', { hasText: 'Posts' }).click();
  let asked = '';
  page.removeAllListeners('dialog');
  page.once('dialog', (d) => {
    asked = d.message();
    d.dismiss();
  });
  await page.locator('button', { hasText: '+ New post' }).click();
  assert(/isn't saved/.test(asked), 'no question asked');
  await page.locator('.admin-tabs button', { hasText: /New post|Edit post/ }).click();
  eq(await page.locator('textarea.textarea').first().inputValue(), 'Do not lose me', 'writing kept');
  await page.close();
});

await test('saving over a change made on another device asks first', async () => {
  await putFile('thoughts/2026-09-10-two-devices.md', '---\ndate: 2026-09-10 10:00\ntitle: Two devices\n---\nOriginal words\n');
  const page = await adminPage();
  await editPost(page, 'Two devices');
  await page.locator('textarea.textarea').first().fill('Laptop words');
  // Meanwhile, on the phone:
  await putFile('thoughts/2026-09-10-two-devices.md', '---\ndate: 2026-09-10 10:00\ntitle: Two devices\n---\nPhone words\n');
  let asked = '';
  page.removeAllListeners('dialog');
  page.once('dialog', (d) => {
    asked = d.message();
    d.dismiss();
  });
  await page.locator('.row.end button.go').last().click();
  await page.waitForTimeout(800);
  assert(/changed somewhere else/.test(asked), 'no question asked');
  assert((await getFile('thoughts/2026-09-10-two-devices.md')).includes('Phone words'), 'the phone version was overwritten');
  page.once('dialog', (d) => d.accept());
  await page.locator('.row.end button.go').last().click();
  await toastText(page);
  await page.waitForTimeout(500);
  assert((await getFile('thoughts/2026-09-10-two-devices.md')).includes('Laptop words'), 'not saved after saying yes');
  await page.close();
});

await test('re-opening the post you are editing keeps your changes', async () => {
  const page = await adminPage();
  await editPost(page, 'Two devices');
  await page.locator('textarea.textarea').first().fill('Changes in progress');
  await editPost(page, 'Two devices');
  eq(await page.locator('textarea.textarea').first().inputValue(), 'Changes in progress', 'text');
  await page.close();
});

await test('extra room at the top on a phone’s Home Screen: chosen in Site, kept, and only on the Home Screen', async () => {
  const content = await import('../src/content.js');
  eq([content.parseSite('---\ntop_room: more\n---\n').top_room, content.parseSite('---\ntop_room: huge\n---\n').top_room], ['more', ''], 'checked by the server');
  await putFile('site.md', '---\nname: Test Site\nowner: Tester\nstatus: kept\n---\nAbout me: I like tests.\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Site' }).first().click();
  await page.getByRole('radiogroup', { name: 'Room at the top' }).getByRole('radio', { name: 'More', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('Saved'));
  const site = await getFile('site.md');
  assert(/top_room: more/.test(site) && site.includes('status: kept') && site.includes('About me: I like tests.'), 'saved, keeping the rest:\n' + site);
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  // The site's top bar on a phone: the same in a browser tab, 24px lower from the Home Screen.
  const topOf = async (homeScreen) => {
    const browser = await chromium.launch();
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    if (homeScreen) await p.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }));
    await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
    await p.goto(BASE + '/#/');
    await p.waitForSelector('.xp-phone .xp-title');
    await p.waitForTimeout(300);
    const pad = await p.locator('.xp-phone .xp-title').first().evaluate((e) => parseFloat(getComputedStyle(e).paddingTop));
    // (And the back office the same way.)
    await p.goto(BASE + '/admin');
    await p.waitForSelector('.admin-tabs button');
    const shell = await p.locator('.admin-shell').evaluate((e) => parseFloat(getComputedStyle(e).paddingTop));
    await browser.close();
    return [pad, shell];
  };
  eq(await topOf(false), [0, 12], 'in a browser tab, as it is');
  eq(await topOf(true), [24, 36], 'from the Home Screen, more room');
  await putFile('site.md', '---\nname: Test Site\nowner: Tester\n---\nAbout me: I like tests.\n');
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
