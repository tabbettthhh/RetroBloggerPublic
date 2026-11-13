// The little extras: reactions, series, Start here, read time, the fortune cookie, the photo of the
// day, your mood, a status for while you're away, the countdown from the planner, and the visitor
// counter's styles.
import { test, report, assert, eq, putFile, getFile, upload, publicData, overview, launch, close, BASE, chromium, PHOTOS } from './lib.mjs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const PERSON = { 'Content-Type': 'application/json', 'User-Agent': UA };
const react = async (post, kind, undo = false) => {
  const r = await fetch(`${BASE}/api/react`, { method: 'POST', headers: PERSON, body: JSON.stringify({ post, kind, undo }) });
  return [r.status, await r.json().catch(() => ({}))];
};
const at = (h) => new Date(Date.now() - h * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA, reducedMotion: 'reduce' };
const DESK = { viewport: { width: 1280, height: 860 }, userAgent: UA, reducedMotion: 'reduce' };
await launch();
async function site(opts, fn, path = '/#/') {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript(() => sessionStorage.setItem('entered', '1'));
    const p = await ctx.newPage();
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.goto(BASE + path);
    await p.waitForSelector(path.includes('owner=1') ? '.okit-me' : '.card, .review-card, .journal-head', { timeout: 15000 });
    await p.waitForTimeout(500);
    await fn(p, ctx);
    assert(!p.errors.length, p.errors.join('; '));
  } finally {
    await b.close();
  }
}
const find = async (slug) => (await publicData()).posts.find((p) => p.slug === slug);

await test('reactions: a ♥, a ☆ or a smile, only how many kept; taken back; never on a post that isn’t there', async () => {
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\n---\nHi.\n');
  await putFile('thoughts/nice-day.md', `---\ndate: ${at(2)}\ntitle: A nice day\n---\nSunshine.\n`);
  await putFile('thoughts/secret.md', `---\ndate: ${at(2)}\ntitle: Just us\nfriends_only: true\n---\nShh.\n`);
  eq((await react('thoughts/nice-day', 'heart'))[1], { ok: true, counts: { heart: 1, star: 0, grin: 0 } }, 'one ♥');
  await react('thoughts/nice-day', 'heart');
  await react('thoughts/nice-day', 'grin');
  eq((await react('thoughts/nice-day', 'heart', true))[1].counts, { heart: 1, star: 0, grin: 1 }, 'taken back');
  eq((await react('thoughts/nope', 'heart'))[0], 404, 'not a post that isn’t there');
  eq((await react('thoughts/secret', 'heart'))[0], 404, 'nor a friends-only one');
  eq((await react('thoughts/nice-day', 'poop'))[0], 400, 'only the three');
  eq((await fetch(`${BASE}/api/react`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'curl/8' }, body: JSON.stringify({ post: 'thoughts/nice-day', kind: 'heart' }) })).status, 400, 'bots are turned away');
  eq((await find('nice-day')).reactions, { heart: 1, star: 0, grin: 1 }, 'on the site');
  const kept = await getFile('reactions/thoughts/nice-day.json');
  assert(!/agent|ip|mozilla/i.test(kept), 'nothing about who: ' + kept);
  // Switched off: none show, none can be given (the counts are kept).
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\nreactions: off\n---\nHi.\n');
  eq((await react('thoughts/nice-day', 'heart'))[0], 403, 'off');
  eq((await find('nice-day')).reactions, undefined, 'none shown');
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\n---\nHi.\n');
  eq((await find('nice-day')).reactions, { heart: 1, star: 0, grin: 1 }, 'back, as they were');
});

await test('reactions on the site: one tap, shown at once, remembered in this browser; a second tap takes it back', async () => {
  await site(PHONE, async (p) => {
    const row = p.locator('.card[data-post="thoughts/nice-day"] .react-row');
    eq(await row.locator('.react-btn:not(.react-add)').count(), 3, 'three');
    eq(await row.locator('.react-add').count(), 1, 'and ＋ for your own');
    await row.locator('.react-btn').nth(1).tap();
    await p.waitForFunction(() => document.querySelector('.card[data-post="thoughts/nice-day"] .react-btn:nth-child(2)')?.getAttribute('aria-pressed') === 'true');
    await p.waitForTimeout(400);
    eq(await row.locator('.react-btn').nth(1).textContent(), '1', 'counted');
    await p.reload();
    await p.waitForSelector('.card[data-post="thoughts/nice-day"] .react-row');
    eq(await p.locator('.card[data-post="thoughts/nice-day"] .react-btn').nth(1).getAttribute('aria-pressed'), 'true', 'remembered here');
    await p.locator('.card[data-post="thoughts/nice-day"] .react-btn').nth(1).tap();
    await p.waitForFunction(() => document.querySelector('.card[data-post="thoughts/nice-day"] .react-btn:nth-child(2)')?.getAttribute('aria-pressed') === 'false');
  });
  await new Promise((r) => setTimeout(r, 1100));
  eq((await find('nice-day')).reactions.star, 0, 'taken back on the site too');
  // Deleting the post takes its reactions with it.
  await fetch(`${BASE}/admin/api/file?key=thoughts/nice-day.md`, { method: 'DELETE' });
  eq((await fetch(`${BASE}/admin/api/file?key=reactions/thoughts/nice-day.json`)).status, 404, 'gone with the post');
});

await test('your own emoji: any one emoji (not words, not flags), a dozen at most on a post; you can take one off', async () => {
  await putFile('thoughts/emoji.md', `---\ndate: ${at(4)}\ntitle: Emoji please\n---\nGo on.\n`);
  const own = async (emoji, undo = false) => {
    const r = await fetch(`${BASE}/api/react`, { method: 'POST', headers: PERSON, body: JSON.stringify({ post: 'thoughts/emoji', kind: 'custom', emoji, undo }) });
    return [r.status, await r.json().catch(() => ({}))];
  };
  eq((await own('🔥'))[1].counts.custom, { '🔥': 1 }, 'one 🔥');
  await own('🔥');
  eq((await own('👍🏽'))[1].counts.custom, { '🔥': 2, '👍🏽': 1 }, 'with a skin tone');
  eq((await own('👨‍👩‍👧'))[0], 200, 'a family, as one');
  for (const bad of ['hello', '🔥🔥', '🇬🇧', '1', '<b>', '']) eq((await own(bad))[0], 400, `not: ${bad || 'nothing'}`);
  eq((await own('👍🏽', true))[1].counts.custom, { '🔥': 2, '👨‍👩‍👧': 1 }, 'taken back, and gone at nought');
  for (const e of ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😊', '😇', '🙂']) await own(e);
  eq((await own('🦄'))[0], 409, 'a dozen at most');
  eq((await own('🔥'))[0], 200, 'but more of one already there');
  eq(Object.keys((await find('emoji')).reactions.custom).length, 12, 'on the site');
  // On the site: ＋ opens a picker; one tap adds it.
  await site(PHONE, async (p) => {
    const row = p.locator('.card[data-post="thoughts/emoji"] .react-row');
    eq(await row.locator('.react-btn.own').first().getAttribute('data-k'), 'c:🔥', 'the most first');
    await putFile('thoughts/emoji-2.md', `---\ndate: ${at(3.5)}\ntitle: Fresh\n---\nNone yet.\n`);
    await p.reload();
    const row2 = p.locator('.card[data-post="thoughts/emoji-2"] .react-row');
    await row2.locator('.react-add').tap();
    await p.waitForSelector('.react-pick');
    await p.locator('.react-type').fill('hello');
    await p.locator('.react-pick-go').tap();
    eq(await p.locator('.react-note').textContent(), 'Just one emoji, please.', 'only an emoji');
    await p.locator('.react-pick-btn', { hasText: '🎉' }).tap();
    await p.waitForFunction(() => document.querySelector('.card[data-post="thoughts/emoji-2"] .react-btn.own.on')?.textContent === '🎉1');
    eq(await p.locator('.react-pick').count(), 0, 'the picker closed');
  });
  eq((await find('emoji-2')).reactions.custom, { '🎉': 1 }, 'kept');
  // Signed in: × takes one off.
  await site(PHONE, async (p) => {
    p.on('dialog', (d) => d.accept());
    await p.locator('.card[data-post="thoughts/emoji-2"] .react-x').click();
    await p.waitForFunction(() => !document.querySelector('.card[data-post="thoughts/emoji-2"] .react-own'));
  }, '/?owner=1#/');
  eq((await find('emoji-2')).reactions, undefined, 'taken off');
});

await test('series: parts by date, the name as first written; a quiet line on the post, a small tag in the feed', async () => {
  await putFile('thoughts/japan-1.md', `---\ndate: ${at(50)}\ntitle: Landing in Tokyo\nseries: Japan trip\n---\nFirst night.\n`);
  await putFile('thoughts/japan-3.md', `---\ndate: ${at(30)}\ntitle: Osaka food\nseries: japan trip\n---\nTakoyaki.\n`);
  await putFile('thoughts/japan-2.md', `---\ndate: ${at(40)}\ntitle: Kyoto temples\nseries: Japan Trip\n---\nQuiet.\n`);
  await putFile('thoughts/japan-draft.md', `---\ndate: ${at(20)}\ntitle: Not yet\nseries: Japan trip\ndraft: true\n---\nShh.\n`);
  const two = (await find('japan-2')).series_info;
  eq(two, { name: 'Japan trip', part: 2, of: 3, prev: { type: 'thoughts', slug: 'japan-1', title: 'Landing in Tokyo' }, next: { type: 'thoughts', slug: 'japan-3', title: 'Osaka food' } }, 'part 2 of 3 (the draft isn’t counted)');
  eq((await find('nice-day'))?.series_info, undefined, 'not in a series');
  await site(PHONE, async (p) => {
    eq(await p.locator('.card[data-post="thoughts/japan-2"] .series-tag').textContent(), 'Japan trip 2/3', 'in the feed');
    await p.evaluate(() => (location.hash = '#/post/thoughts/japan-2'));
    await p.waitForSelector('.series-line');
    eq((await p.locator('.series-line').innerText()).replace(/\s+/g, ' '), '‹ Previous Japan trip · part 2 of 3 Next ›', 'on the post');
    await p.locator('.series-line a', { hasText: 'Next' }).click();
    await p.waitForFunction(() => location.hash === '#/post/thoughts/japan-3' && /part 3 of 3/.test(document.querySelector('.series-line')?.textContent));
    eq(await p.locator('.series-line .series-go.none').count(), 1, 'the last part: no next');
  });
});

await test('series in the editor: one box that finds the series you have, or starts a new one', async () => {
  await putFile('thoughts/plain.md', `---\ndate: ${at(1)}\ntitle: Plain\n---\nNothing special.\n`);
  await site(PHONE, async (p) => {
    await p.waitForSelector('.card[data-post="thoughts/plain"] .okit-more');
    await p.locator('.card[data-post="thoughts/plain"] .okit-more').click();
    await p.locator('.okit-menu button', { hasText: 'Edit' }).click();
    await p.waitForSelector('.series-box input', { state: 'attached' });
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
    const box = p.locator('.series-box input');
    await box.fill('');
    await box.type('JAP');
    eq((await p.locator('.series-opt').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()), ['📚 Japan trip · 4 posts', '＋ New series: JAP'], 'what you have (a draft too), or a new one');
    await p.locator('.series-opt').first().click();
    eq(await box.inputValue(), 'Japan trip', 'chosen');
    assert((await p.locator('.series-chosen').innerText()).includes('with 4 other posts'), 'with the others');
    await p.locator('button', { hasText: /^Save changes$/ }).click();
    await p.waitForFunction(() => !document.querySelector('.series-box'), null, { timeout: 15000 });
  }, '/?owner=1#/');
  eq((await getFile('thoughts/plain.md')).includes('series: Japan trip'), true, 'saved in the post');
  eq((await find('plain')).series_info.part, 4, 'the fourth part, by date');
});

await test('Start here: new visitors see it first, until they close it; and read time on longer posts', async () => {
  await putFile('thoughts/welcome.md', `---\ndate: ${at(400)}\ntitle: Welcome\nstart_here: true\n---\nHello and welcome.\n`);
  await putFile('thoughts/long.md', `---\ndate: ${at(3)}\ntitle: A long one\n---\n${'word '.repeat(620)}\n`);
  eq([(await find('welcome')).start_here, (await find('long')).read_mins, (await find('long')).words, (await find('plain')).read_mins], [true, 3, 620, 0], 'marked, timed');
  await site(PHONE, async (p) => {
    eq(await p.locator('.feed > .start-here .card').getAttribute('data-post'), 'thoughts/welcome', 'first of all');
    eq(await p.locator('.card[data-post="thoughts/welcome"]').count(), 1, 'and only once');
    eq(await p.locator('.card[data-post="thoughts/long"] .card-read').textContent(), '3 min read', 'read time');
    eq(await p.locator('.card[data-post="thoughts/plain"] .card-read').count(), 0, 'not on short posts');
    await p.locator('.start-here-close').click();
    eq(await p.locator('.start-here').count(), 0, 'closed');
    await p.reload();
    await p.waitForSelector('.card');
    eq(await p.locator('.start-here').count(), 0, 'and stays closed here');
  });
});

await test('the fortune cookie, the photo of the day and your mood, in your profile', async () => {
  await putFile('fortunes.md', '- Today is a good day for cake.\n- Say yes to the next adventure.\n');
  for (let i = 1; i <= 2; i++) await upload(`photos/day-${i}/1.jpg`, PHOTOS[i]);
  for (let i = 1; i <= 2; i++) await putFile(`photos/day-${i}.md`, `---\ndate: ${at(5 + i)}\ntitle: Day ${i}\nphotos: [1.jpg]\n---\n`);
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\nmood: sleepy\n---\nHi.\n');
  eq((await publicData()).fortunes, ['Today is a good day for cake.', 'Say yes to the next adventure.'], 'the lines');
  await site(PHONE, async (p) => {
    await p.locator('.profile-tile .fortune-btn').click();
    assert(['Today is a good day for cake.', 'Say yes to the next adventure.'].includes(await p.locator('.fortune-slip').textContent()), 'a fortune');
    eq(await p.locator('.profile-tile .status-mood').getAttribute('aria-label'), 'Mood: sleepy', 'the mood');
    const day = p.locator('.profile-tile .photo-day');
    assert(/^#\/post\/photos\/day-[12]$/.test(await day.getAttribute('href')), 'the photo of the day, opening its post');
  });
  await putFile('fortunes.md', '');
  await site(PHONE, async (p) => eq(await p.locator('.fortune-btn').count(), 0, 'no lines: no cookie'));
});

await test('while you’re away: the status shows on those days only, and visitors never see the dates', async () => {
  await putFile('site.md', `---\nname: Home Corner\nowner: Sam\nstatus: At my desk\naway_status: On holiday (plane)\naway_presence: busy\naway_from: ${day(-1)}\naway_to: ${day(1)}\n---\nHi.\n`);
  let d = await publicData();
  eq([d.site.status, d.site.presence, d.site.away], ['On holiday (plane)', 'busy', undefined], 'away now, no dates for visitors');
  assert(!JSON.stringify(d).includes(day(1)), 'the dates nowhere');
  eq((await overview()).site.away, { status: 'On holiday (plane)', presence: 'busy', from: day(-1), to: day(1) }, 'the back office has them');
  await putFile('site.md', `---\nname: Home Corner\nowner: Sam\nstatus: At my desk\naway_status: On holiday\naway_from: ${day(3)}\naway_to: ${day(9)}\n---\nHi.\n`);
  d = await publicData();
  eq([d.site.status, d.site.presence === 'away'], ['At my desk', false], 'not yet');
});

await test('online when you’re actually here: automatic, or one you chose until you’ve been away a day', async () => {
  const say = (state) => fetch(`${BASE}/admin/api/presence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) });
  const shown = async () => (await publicData()).site.presence;
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\n---\nHi.\n');
  await say('here');
  eq(await shown(), 'online', 'here: online');
  await say('bye');
  eq(await shown(), 'offline', 'gone: offline');
  // One you choose holds while you keep coming back…
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\npresence: busy\n---\nHi.\n');
  await say('here');
  eq(await shown(), 'busy', 'busy, as chosen');
  await say('bye');
  eq(await shown(), 'busy', 'still busy after you’ve gone for now');
  await say('bye');
  // …and lapses after a day away: back to automatic.
  const { livePresence } = await import('../src/presence.js');
  const now = Date.now();
  const H = 3600e3;
  eq(livePresence({ presence: 'busy' }, { seen: now - 23 * H, left: now - 23 * H }, now).presence, 'busy', 'away 23 hours: still busy');
  eq(livePresence({ presence: 'busy' }, { seen: now - 25 * H, left: now - 25 * H }, now).presence, 'offline', 'away a day: automatic, and not here');
  eq(livePresence({ presence: 'busy' }, { seen: 0, left: 0 }, now).presence, 'busy', 'never here since this came in: as chosen');
  eq(livePresence({ presence: 'online' }, { seen: now - 60e3, left: 0 }, now).presence, 'online', 'automatic, here a minute ago: online');
  eq(livePresence({ presence: 'online' }, { seen: now - 5 * 60e3, left: 0 }, now).presence, 'offline', 'no word for five minutes: offline');
  eq(livePresence({ presence: 'busy', away_on: true }, { seen: 0, left: 0 }, now).presence, 'busy', 'a schedule for while you’re away still wins');
});

await test('the Status page: mood, while you’re away, fortunes, and a countdown from the planner; nothing else lost', async () => {
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\nreactions: off\ntop_room: some\n---\nHi.\n');
  await putFile('planner.md', `## Trips\n- [ ] Lisbon @${day(12)}\n- [x] Paris @${day(5)}\n`);
  await site(PHONE, async (p) => {
    await p.locator('.okit-me:visible').first().click();
    await p.locator('.okit-menu button', { hasText: 'Control Panel' }).click();
    await p.locator('.cp-item[data-cp="status"]').click();
    await p.waitForSelector('.emo-picker[aria-label="Mood"]');
    eq(await p.locator('.chip-btn', { hasText: 'Automatic' }).getAttribute('aria-pressed'), 'true', 'Automatic, to start with');
    await p.locator('.emo-picker[aria-label="Mood"] [aria-label="Cool"]').click();
    const plan = p.locator('select[aria-label="From your planner"]');
    eq((await plan.locator('option').allInnerTexts()).length, 2, 'only what’s still to do, with a date ahead');
    await plan.selectOption({ index: 1 });
    await p.locator('input[placeholder^="e.g. On holiday"]').fill('Gone fishing');
    await p.locator('input[aria-label="Away from"]').fill(day(2));
    await p.locator('input[aria-label="Away until"]').fill(day(4));
    await p.locator('textarea[placeholder^="Today is a good day"]').fill('Smile more.\n\nEat cake.');
    await p.locator('button', { hasText: 'Save fortunes' }).click();
    await p.waitForTimeout(800);
    await p.locator('button', { hasText: 'Update status' }).click();
    await p.waitForTimeout(1500);
  }, '/?owner=1#/');
  const fm = await getFile('site.md');
  for (const line of ['mood: cool', 'countdown: Lisbon', `countdown_date: ${day(12)}`, 'away_status: Gone fishing', `away_from: ${day(2)}`, `away_to: ${day(4)}`, 'reactions: "off"', 'top_room: some']) assert(fm.includes(line), `${line} in: ${fm}`);
  eq(await getFile('fortunes.md'), '- Smile more.\n- Eat cake.\n', 'fortunes, one a line');
});

await test('the visitor counter’s styles', async () => {
  await putFile('theme.md', '---\ncounter: nixie\n---\n');
  await site(PHONE, async (p) => {
    await p.evaluate(() => (location.hash = '#/guestbook'));
    await p.waitForSelector('.led span');
    eq(await p.evaluate(() => document.documentElement.dataset.skCounter), 'nixie', 'the style');
    assert((await p.locator('.led span').first().evaluate((e) => getComputedStyle(e).textShadow)).includes('rgb(255, 122, 26)'), 'glowing');
  });
});

await test('postcards in the guestbook: a painted front, waiting for your approval like any signature', async () => {
  const sign = (body) => fetch(`${BASE}/api/guestbook`, { method: 'POST', headers: PERSON, body: JSON.stringify(body) }).then((r) => r.status);
  eq(await sign({ name: 'Lina', message: 'Wish you were here!', card: 'seaside' }), 200, 'sent');
  eq(await sign({ name: 'Odd', message: 'A strange front', card: '<svg>' }), 200, 'an odd front is just a signature');
  const waiting = (await overview()).pendingGuestbook;
  eq(waiting.map((g) => [g.name, g.card]).sort(), [['Lina', 'seaside'], ['Odd', '']], 'waiting, with its front');
  for (const g of waiting) await fetch(`${BASE}/admin/api/move?key=${encodeURIComponent(g.key)}&to=${encodeURIComponent(g.key.replace('guestbook-pending/', 'guestbook/'))}`, { method: 'POST' });
  await site(PHONE, async (p) => {
    await p.evaluate(() => (location.hash = '#/guestbook'));
    await p.waitForSelector('.gb-postcard');
    eq(await p.locator('.gb-postcard .gbp-words').textContent(), 'Wish you were here!', 'on the site, as a postcard');
    eq(await p.locator('.gb-entry', { hasText: 'A strange front' }).count(), 1, 'the other, as a signature');
    // Sending one: pick a front, see it, send.
    await p.locator('.gb-card-pick').selectOption('forest');
    assert(await p.locator('.gb-card-peek svg').isVisible(), 'a peek at the front');
    await p.locator('.gb-form input[name="name"]').fill('Jo');
    await p.locator('.gb-form input[name="message"]').fill('Lovely trees');
    await p.locator('.gb-form button[type="submit"]').click();
    await p.waitForFunction(() => /postcard is on its way/.test(document.querySelector('.form-msg')?.textContent || ''));
  });
  eq((await overview()).pendingGuestbook.map((g) => g.card), ['forest'], 'sent from the site');
  // Signed in: a postcard on the site can be answered, or taken off.
  await site(PHONE, async (p) => {
    p.on('dialog', (d) => d.accept());
    await p.evaluate(() => (location.hash = '#/guestbook'));
    await p.waitForSelector('.gb-postcard .okit-cm-tools');
    await p.locator('.gb-postcard .okit-cm-tools button', { hasText: 'Remove' }).click();
    await p.waitForFunction(() => !document.querySelector('.gb-postcard'));
  }, '/?owner=1#/');
  eq((await publicData()).guestbook.some((g) => g.card), false, 'taken off');
});

await test('the atlas: pins, or how often you’ve been', async () => {
  for (const [slug, lat, n] of [['leeds-a', 53.8, 1], ['leeds-b', 53.801, 2], ['york', 53.96, 3]]) await putFile(`places/${slug}.md`, `---\ndate: ${at(10 + n)}\ntitle: ${slug}\ncity: ${slug.split('-')[0]}\nlat: ${lat}\nlon: -1.55\n---\nHere.\n`);
  await site(DESK, async (p) => {
    await p.evaluate(() => (location.hash = '#/atlas'));
    await p.waitForSelector('.board-heat');
    await p.waitForSelector('.leaflet-marker-icon');
    await p.locator('.board-heat').click();
    await p.waitForSelector('.heat-spot');
    eq(await p.locator('.atlas .leaflet-marker-icon').count(), 0, 'no pins');
    eq(await p.locator('.atlas .heat-spot').count(), 2, 'one spot for the two close together, one for the other');
    await p.locator('.board-heat').click();
    await p.waitForSelector('.leaflet-marker-icon');
  });
});

await test('visitors: counted once a visit (never yours), and only how many from each country', async () => {
  const before = await overview();
  const n = (o) => Object.values(o.visitorCountries || {}).reduce((a, b) => a + b, 0);
  await site(PHONE, async (p) => {
    await p.waitForTimeout(800);
    await p.reload();
    await p.waitForTimeout(800);
  });
  const after = await overview();
  eq(after.counter - before.counter, 1, 'once for the visit, not for each page');
  eq(n(after) - n(before), 1, 'and its country');
  assert(Object.keys(after.visitorCountries).every((k) => /^[A-Z]{2}$/.test(k)), 'only country codes');
  await site(PHONE, async (p) => {
    await p.waitForTimeout(800);
    await p.locator('.okit-me:visible').first().click();
    await p.locator('.okit-menu button', { hasText: 'Control Panel' }).click();
    await p.locator('.cp-item[data-cp="visitors"]').click();
    await p.waitForSelector('.okit-visit-list li');
    assert((await p.locator('.okit-visitors').textContent()).includes(`${after.counter.toLocaleString('en-GB')} visits so far`), 'how many');
  }, '/?owner=1#/');
  eq((await overview()).counter, after.counter, 'yours not counted');
});
await test('a wave from the bench in the village: a name and a few words, waiting for approval like the guestbook', async () => {
  const sign = (body) => fetch(`${BASE}/api/guestbook`, { method: 'POST', headers: PERSON, body: JSON.stringify(body) }).then((r) => r.status);
  eq(await sign({ name: 'Ana', wave: true }), 200, 'just a name is enough');
  eq(await sign({ name: 'Bo', message: 'x'.repeat(200), wave: true }), 200, 'and a long message is cut short');
  const waiting = (await overview()).pendingGuestbook.filter((g) => g.wave);
  eq(waiting.map((g) => [g.name, g.message.length <= 80]).sort(), [['Ana', true], ['Bo', true]], 'waiting, as waves');
  eq(waiting.find((g) => g.name === 'Ana').message, '👋', 'a wave with no words');
  for (const g of waiting) await fetch(`${BASE}/admin/api/move?key=${encodeURIComponent(g.key)}&to=${encodeURIComponent(g.key.replace('guestbook-pending/', 'guestbook/'))}`, { method: 'POST' });
  const gb = (await publicData()).guestbook.filter((g) => g.wave);
  eq(gb.length, 2, 'on the site once approved');
});


const failed = report();
await close();
process.exit(failed ? 1 : 0);
