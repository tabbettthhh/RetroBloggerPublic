// Owner mode: signed in, the site itself has your tools on it. (Locally the lock is open, as
// DEV_ADMIN does for the back office; on the internet Cloudflare Access decides.)
import { test, report, assert, eq, launch, close, putFile, getFile, publicData, overview, BASE, chromium, PHOTOS } from './lib.mjs';

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
      await p.waitForSelector('.okit-host .cp-item');
      eq(await p.locator('.okit-host .cp-item').count(), 13, 'its categories');
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

const send = (path, body) => fetch(`${BASE}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (test)' }, body: JSON.stringify(body) });

await test('things waiting for you, where they happen: a comment under its post, a signature in the guestbook, a suggestion by its shelf', async () => {
  await putFile('thoughts/talk-to-me.md', `---\ndate: ${at(2)}\ntitle: Talk to me\n---\nAnyone there?\n`);
  eq((await send('comment', { post: 'thoughts/talk-to-me', name: 'Ali', message: 'Hello from the comments!' })).status, 200, 'a comment sent');
  eq((await send('guestbook', { name: 'Bea', message: 'Lovely little site.' })).status, 200, 'a signature sent');
  eq((await send('suggest', { kind: 'book', title: 'The Remains of the Day', name: 'Cy', note: 'you’ll love it' })).status, 200, 'a suggestion sent');
  await site(PHONE, async (p) => {
    // In the feed: how many are waiting, on the post.
    const card = p.locator('.card', { hasText: 'Talk to me' });
    await card.locator('.okit-state.waiting').waitFor();
    // Under the post: approve it there.
    await p.goto(BASE + '/#/post/thoughts/talk-to-me');
    const wait = p.locator('.comments .okit-waiting', { hasText: 'Hello from the comments!' });
    await wait.waitFor();
    await wait.locator('button', { hasText: 'Approve' }).click();
    await p.waitForFunction(() => document.querySelector('.okit-toast.on')?.textContent.includes('Approved'));
    await p.locator('.comments .cm-item', { hasText: 'Hello from the comments!' }).waitFor();
    eq(await p.locator('.comments .okit-waiting').count(), 0, 'no longer waiting');
    // And answer it, as you.
    const item = p.locator('.comments .cm-item', { hasText: 'Hello from the comments!' });
    await item.locator('button', { hasText: 'Reply as you' }).click();
    await item.locator('textarea.okit-input').fill('Hello back!');
    await item.locator('.okit-replybox button', { hasText: 'Save' }).click();
    await p.waitForFunction(() => [...document.querySelectorAll('.cm-owner')].some((x) => x.textContent.includes('Hello back!')));
    // The guestbook: approve the signature in it.
    await p.goto(BASE + '/#/guestbook');
    const sig = p.locator('.okit-waiting', { hasText: 'Lovely little site.' });
    await sig.waitFor();
    await sig.locator('button', { hasText: 'Approve' }).click();
    await p.locator('.gb-entry', { hasText: 'Lovely little site.' }).waitFor();
    // The bookshelf: the suggestion, onto the shelf.
    await p.goto(BASE + '/#/books');
    const sg = p.locator('.okit-waiting', { hasText: 'The Remains of the Day' });
    await sg.waitFor();
    await sg.locator('button.go').click();
    await p.waitForFunction(() => document.querySelector('.okit-toast.on')?.textContent.includes('Added'));
  });
  const d = await publicData();
  assert(d.posts.find((x) => x.slug === 'talk-to-me').comments.some((c) => c.reply === 'Hello back!'), 'the comment and your reply are on the site');
  assert(d.guestbook.some((g) => g.message === 'Lovely little site.'), 'the signature too');
  assert((await overview()).posts.some((x) => x.type === 'books' && x.title === 'The Remains of the Day' && x.suggested_by === 'Cy'), 'the book on the shelf, with who suggested it');
});

await test('your status, the planner and the trips wishlist change where they are', async () => {
  await putFile('planner.md', '---\n---\n## To do\n- [ ] Post the parcel\n- [ ] Book the dentist\n');
  await putFile('wishlist.md', '# Want to go\n- [ ] Lisbon, Portugal\n');
  await site(PHONE, async (p) => {
    // Status, from the profile.
    await p.locator('.okit-status-edit').first().click();
    await p.locator('.okit-status-box .okit-chip', { hasText: 'Busy' }).click();
    await p.locator('.okit-status-box input').fill('Writing my essay (book)');
    await p.locator('.okit-status-box button', { hasText: 'Save' }).click();
    await p.waitForFunction(() => document.querySelector('.okit-toast.on')?.textContent.includes('Status updated'));
    const site = (await publicData()).site;
    eq([site.status, site.presence], ['Writing my essay (book)', 'busy'], 'status and how you are');
    // The planner: tick, take off, add.
    await p.goto(BASE + '/#/planner');
    await p.locator('.pln-item', { hasText: 'Post the parcel' }).locator('.pln-box').click();
    await p.waitForFunction(() => document.querySelector('.okit-toast.on')?.textContent.includes('Done'));
    await p.locator('.pln-item', { hasText: 'Book the dentist' }).locator('.okit-x').click();
    await p.waitForFunction(() => document.querySelector('.okit-toast.on')?.textContent.includes('Taken off'));
    await p.locator('.okit-add input[aria-label="Add to this list"]').fill('Buy stamps');
    await p.locator('.okit-add input[aria-label="Add to this list"]').press('Enter');
    await p.locator('.pln-item', { hasText: 'Buy stamps' }).waitFor();
    eq((await getFile('planner.md')).split('## To do\n')[1].trim(), '- [x] Post the parcel\n- [ ] Buy stamps', 'planner.md as you left it');
    // The trips wishlist: add, been there.
    await p.goto(BASE + '/#/wishlist');
    await p.locator('.okit-wish-add input[aria-label="Place"]').fill('Kyoto');
    await p.locator('.okit-wish-add input[aria-label="City"]').fill('Japan');
    await p.locator('.okit-wish-add button').click();
    await p.locator('.wish', { hasText: 'Kyoto' }).waitFor();
    await p.locator('.wish', { hasText: 'Lisbon' }).locator('.aqua-check').click();
    await p.waitForFunction(() => document.querySelector('.okit-toast.on')?.textContent.includes('Been there'));
    const w = await getFile('wishlist.md');
    assert(w.includes('- [x] Lisbon, Portugal') && w.includes('- [ ] Kyoto, Japan'), 'wishlist.md: ' + w);
  });
});

await test('the highlights, in the cabinet: a line on why, a new place on the shelf', async () => {
  await putFile('places/one.md', `---\ndate: ${at(40)}\ntitle: First Place\n---\nA.\n`);
  await putFile('places/two.md', `---\ndate: ${at(41)}\ntitle: Second Place\n---\nB.\n`);
  await putFile('highlights.md', '---\nplaces: ["places/one", "places/two"]\n---\n');
  await site({ ...PHONE, reducedMotion: 'reduce' }, async (p) => {
    await p.locator('.cab-room .cab-doors').click();
    await p.waitForSelector('.cab-room .cabinet.open');
    await p.locator('.cab-room .cab-shelf-places .cab-pick').nth(1).click();
    await p.waitForSelector('dialog.cab-dialog[open] .okit-hl');
    await p.locator('.okit-hl button', { hasText: 'Say why it’s here' }).click();
    await p.locator('.okit-hl textarea').fill('The best window seat in town.');
    await p.locator('.okit-hl button', { hasText: 'Save' }).click();
    await p.waitForFunction(() => document.querySelector('.okit-toast')?.textContent.includes('Saved'));
  }, '/?owner=1#/highlights');
  const hl = (await overview()).highlights.places;
  eq(hl.find((x) => x.post === 'places/two').why, 'The best window seat in town.', 'its line on why');
});

await test('the Control Panel: categories, each in the same place, and back', async () => {
  for (const opts of [DESK, PHONE]) {
    await site(opts, async (p) => {
      await p.waitForSelector('.okit-me');
      await p.locator('.okit-me').first().click();
      await p.locator('.okit-menu button', { hasText: 'Control Panel' }).click();
      await p.waitForSelector('.okit-host .cp-item');
      eq(await p.locator('.okit-host .cp-group h3').allInnerTexts().then((x) => x.map((t) => t.toUpperCase())), ['WRITING', 'PEOPLE', 'LOOK', 'YOUR SITE'], 'four groups');
      await p.locator('.cp-item[data-cp="friends"]').click();
      await p.waitForSelector('.okit-host .okit-back:visible');
      assert((await p.locator('.okit-host .xp-title-text').innerText()).includes('Friends'), 'its name in the bar');
      await p.locator('.okit-host .okit-back').click();
      await p.waitForSelector('.okit-host .cp-item');
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => !document.querySelector('.okit-host'));
    });
  }
});

await test('signed in, the Explore menu is yours; your picture: one of the site’s own, or a photo', async () => {
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\n---\nHi.\n');
  // A visitor's Explore menu is a visitor's.
  await site(PHONE, async (p) => {
    await p.locator('.start-btn').first().click();
    eq(await p.locator('.sm-head strong').innerText(), 'Visitor', 'a visitor’s');
  }, '/#/');
  for (const opts of [DESK, PHONE]) {
    await site(opts, async (p) => {
      await p.waitForSelector('.okit-me');
      await p.locator('.start-btn').first().click();
      eq(await p.locator('.sm-head strong').innerText(), 'Sam', 'signed in: yours');
      // Your picture there opens the chooser (as XP's did).
      await p.locator('.sm-head.mine .avatar').click();
      await p.waitForSelector('.okit-host .pic-pick');
      assert((await p.locator('.okit-host .xp-title-text').innerText()).includes('Your picture'), 'in the Control Panel');
      if (opts === PHONE) return;
      await p.locator('.pic-pick[aria-label="Cat"]').click();
      await p.waitForFunction(() => document.querySelector('.pic-pick[aria-label="Cat"]')?.getAttribute('aria-checked') === 'true');
      await p.waitForSelector('.okit-me .okit-face.has-pic svg');
      // A photo: cropped square, and its hidden data left behind.
      await p.locator('.pic-chooser input[type="file"]').setInputFiles(PHOTOS[0]);
      await p.waitForFunction(() => document.querySelector('.pic-now img')?.complete);
    });
  }
  const pic = (await publicData()).site.picture;
  assert(/^design\/me-[a-z0-9]+\.jpg$/.test(pic), 'a photo of yours: ' + pic);
  assert(/^picture: design\/me-/m.test(await getFile('site.md')), 'kept in site.md');
  const img = await fetch(`${BASE}/media/${pic}`);
  eq(img.status, 200, 'shown to visitors');
  // On the welcome screen, by your name.
  await site(PHONE, async (p) => {
    await p.waitForSelector('.owner-tile .tile-avatar.has-pic img');
    eq(await p.locator('.owner-tile .tile-avatar img').evaluate((i) => i.naturalWidth === i.naturalHeight), true, 'square');
  }, '/#/welcome');
  // Back to a picture of the site's: the photo isn't kept.
  await site(DESK, async (p) => {
    await p.waitForSelector('.okit-me');
    await p.locator('.okit-me').first().click();
    await p.locator('.okit-menu button', { hasText: 'Your picture' }).click();
    await p.locator('.pic-pick[aria-label="Rubber duck"]').click();
    await p.waitForFunction(() => document.querySelector('.pic-pick[aria-label="Rubber duck"]')?.getAttribute('aria-checked') === 'true');
  });
  eq((await publicData()).site.picture, 'duck', 'the duck');
  eq((await fetch(`${BASE}/media/${pic}`)).status, 404, 'the old photo gone');
  assert(!(await overview()).files.some((f) => f.key === pic), 'not in your files');
});

await test('no separate back office: /admin is your site, signed in; the plain editor is kept as a safety net', async () => {
  for (const path of ['/admin', '/admin/', '/admin/index.html']) eq((await fetch(BASE + path, { redirect: 'manual' })).headers.get('location'), '/?owner=1#/', path + ' → your site, signed in');
  const plain = await fetch(BASE + '/admin/plain');
  const html = await plain.text();
  assert(plain.ok && html.includes('The plain editor') && html.includes('/admin/signin?to=%23%2F'), 'the plain editor, saying what it is, with the way back');
  eq(plain.headers.get('cache-control'), 'no-store', 'never cached');
  await site(PHONE, async (p) => {
    await p.waitForSelector('.okit-me');
    await p.locator('.okit-me').first().click();
    await p.locator('.okit-menu button', { hasText: 'Control Panel' }).click();
    await p.waitForSelector('.okit-host .cp-item');
    eq(await p.locator('.cp-plain a').getAttribute('href'), '/admin/plain', 'a quiet link to it, at the foot of the Control Panel');
  });
  // And it still works: it opens, and its way back goes to your site, signed in.
  await site(PHONE, async (p) => {
    await p.waitForSelector('.admin-sections button');
    assert((await p.locator('.plain-note').innerText()).includes('safety net'), 'says why it’s there');
    await p.locator('.plain-note a').click();
    await p.waitForURL((u) => u.search.includes('owner=1'));
    await p.waitForSelector('.okit-me');
  }, '/admin/plain');
});

await test('a theme changed elsewhere reaches pages already open, words and all (signed in or not)', async () => {
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  const browser = await chromium.launch();
  try {
    const pages = [];
    for (const path of ['/#/', '/?owner=1#/']) {
      const p = await browser.newPage(DESK);
      p.errors = [];
      p.on('pageerror', (e) => p.errors.push(e.message));
      await p.clock.install();
      await p.addInitScript(() => sessionStorage.setItem('entered', '1'));
      await p.goto(BASE + path);
      await p.waitForSelector('.start-btn');
      if (path.includes('owner')) await p.waitForSelector('.okit-me');
      pages.push(p);
    }
    // Changed on another device: a new theme, with its own word on the Explore button.
    await putFile('theme.md', '---\ntheme: matcha\nlabels:\n  explore: Begin\n---\n');
    for (const p of pages) {
      await p.clock.fastForward('02:00');
      await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await p.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--sk-main').trim() === '#7d9f68', null, { timeout: 15000 });
      await p.waitForFunction(() => document.querySelector('.start-btn')?.textContent.trim() === 'Begin', null, { timeout: 15000 });
      assert(!p.errors.length, p.errors.join('; '));
    }
  } finally {
    await browser.close();
  }
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('in dark mode, what you type in your windows can always be read', async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage(PHONE);
    await p.addInitScript(() => {
      sessionStorage.setItem('entered', '1');
      localStorage.setItem('theme', 'dark');
    });
    await p.goto(BASE + '/?owner=1#/');
    await p.waitForSelector('.okit-me');
    await p.locator('.okit-me').first().click();
    await p.locator('.okit-menu button', { hasText: 'Control Panel' }).click();
    await p.locator('.cp-item[data-cp="site"]').click();
    await p.waitForSelector('.okit-host input.input');
    const [fg, bg] = await p.locator('.okit-host input.input').first().evaluate((i) => [getComputedStyle(i).color, getComputedStyle(i).backgroundColor]);
    assert(fg !== bg && /^rgb\((\d{1,2}|1[0-4]\d), /.test(fg), `dark ink on the light box: ${fg} on ${bg}`);
  } finally {
    await browser.close();
  }
});

await test('Themes: the real site wears what you try; closing without saving puts it back; saving keeps it', async () => {
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  await site(DESK, async (p) => {
    await p.waitForSelector('.okit-me');
    const main = () => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sk-main').trim());
    const was = await main();
    await p.locator('.okit-me').first().click();
    await p.locator('.okit-menu button', { hasText: 'Themes' }).click();
    await p.waitForSelector('.okit-dock .tm-card');
    eq(await p.locator('.okit-dock iframe').count(), 0, 'no miniature: the site itself');
    await p.locator('.okit-dock .tm-card', { hasText: 'Matcha' }).click();
    await p.waitForFunction((w) => getComputedStyle(document.documentElement).getPropertyValue('--sk-main').trim() !== w, was);
    await p.locator('.okit-dock .okit-close').click();
    await p.waitForFunction((w) => getComputedStyle(document.documentElement).getPropertyValue('--sk-main').trim() === w, was);
    // Again, and save.
    await p.locator('.okit-me').first().click();
    await p.locator('.okit-menu button', { hasText: 'Themes' }).click();
    await p.waitForSelector('.okit-dock .tm-card');
    await p.locator('.okit-dock .tm-card', { hasText: 'Matcha' }).click();
    await p.locator('.okit-dock button', { hasText: 'Save the theme' }).click();
    await p.waitForFunction(() => document.querySelector('.okit-toast.on')?.textContent.includes('theme is on your site'));
    await p.locator('.okit-dock .okit-close').click();
    await p.waitForFunction(() => !document.querySelector('.okit-host'));
    assert((await main()) !== was, 'still wearing it');
  });
  eq((await publicData()).theme.theme, 'matcha', 'saved for everyone');
  await putFile('theme.md', '---\ntheme: classic\n---\n');
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
