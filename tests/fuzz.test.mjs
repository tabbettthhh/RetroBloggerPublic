// Fill the bucket with awkward, half-wrong and oversized content (as hand edits, imports or
// old files might be) and visit every page on a phone, a tablet and a desktop. No page may
// crash, and every section must still show something.
import { api, test, report, assert, launch, close, upload, PHOTOS, BASE, publicData, chromium } from './lib.mjs';

const long = Array.from({ length: 120 }, (_, i) => `Paragraph ${i + 1}: ` + 'lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(6)).join('\n\n');
const FILES = {
  // ratings, numbers and places in odd shapes
  'places/2026-07-01-odd-rating.md': '---\ndate: 2026-07-01 12:00\ntitle: Odd Rating Place\nrating: five\nlat: abc\nlon: 999\ncategory: Bookshops And More\ncountry_code: zz\n---\nWords.\n',
  'places/2026-07-02-huge-rating.md': '---\ndate: 2026-07-02 12:00\ntitle: Huge Rating\nrating: 99\nlat: 51.5\nlon: -0.12\ncity: London\ncountry: United Kingdom\ncountry_code: GB\ncategory: food\n---\n' + long + '\n',
  'places/2026-07-03-negative.md': '---\ndate: 2026-07-03 12:00\ntitle: Negative\nrating: -3\nlat: -33.86\nlon: 151.2\ncity: Sydney\ncountry_code: AU\nordered: 42\nbought: [null, {x: 1}, Mug — 8]\ntickets: {a: 1}\nrides: 42\npostcard: [[1], {b: [2]}]\nroomkey: "Room 9999999"\ncloakroom: -4\nfortune: ""\nwristband: true\nracebib: [abc]\nlaughmeter: [99]\nrosette: {x: 1}\nglowstick: [neon]\ninterval: [\"\"]\nbuttonbadge: [\"<b>x</b>\"]\nfloppy: [1, 2, [3]]\nfloppy_journal: {a: b}\n---\n',
  'places/2026-07-04-photos-odd.md': '---\ndate: 2026-07-04 12:00\ntitle: Photos Odd\nphotos: 1.jpg\ncaptions: [null, null]\nlat: 48.85\nlon: 2.35\ncity: Paris\ncountry_code: FR\n---\nOne photo written as text, not a list.\n',
  'places/2026-07-05-no-coords.md': '---\ndate: 2026-07-05 12:00\ntitle: No Coordinates\n---\nNowhere in particular.\n',
  // shelves with odd values
  'books/2026-07-06-book-odd.md': '---\ndate: 2026-07-06 12:00\ntitle: [Odd, Title]\nauthor: 42\nstatus: weird-status\npages: 0\npage: 9999\nreading_log: [a, b, {from: x}, {pages: 50-10, date: 2026-07-07}]\nrating: 2.5\n---\n',
  'books/2026-07-07-book-now.md': '---\ndate: 2026-07-07 12:00\ntitle: Reading Now\nstatus: reading\npages: 200\npage: 50\n---\n',
  'tv/2026-07-08-tv-odd.md': '---\ndate: 2026-07-08 12:00\ntitle: TV Odd\nstatus: watching\nseason: {a: 1}\nepisodes: not a list\n---\n',
  'tv/2026-07-09-tv-odd2.md': '---\ndate: 2026-07-09 12:00\ntitle: TV Odd Two\nstatus: watching\nepisodes:\n  - ep: abc\n  - season: 1\n    ep: 5\n    to: 2\n    rating: 9\n  - just a string\n---\n',
  'films/2026-07-10-film-odd.md': '---\ndate: 2026-07-10 12:00\ntitle: ""\ndirector: ~\nyear: [1999]\nstatus: watched\n---\nNo title film.\n',
  'music/2026-07-11-music-odd.md': '---\ndate: 2026-07-11 12:00\ntitle: Song\nformat: song\nstatus: repeat\nrating: 99\ndiscaward: [unobtainium]\nchartno1: [999]\nfanclub: abc\nyearonrepeat: {a: 1}\njukebox: ["<b>"]\nmagreview: true\nsevenninch: [[1]]\ntrophy: true\nautograph: true\n---\n',
  'podcasts/2026-07-12-pod-odd.md': '---\ndate: 2026-07-12 12:00\ntitle: Pod\nepisode: {n: 1}\nstatus: listening\n---\n',
  // text with markup, a giant table, very long words
  'thoughts/2026-07-13-markup.md': '---\ndate: 2026-07-13 12:00\ntitle: Markup\n---\n# Heading\n\n<div style="width:4000px">wide html</div>\n\n| a | b | c |\n|---|---|---|\n' + Array.from({ length: 60 }, (_, i) => `| ${i} | ${'x'.repeat(80)} | y |`).join('\n') + '\n\n' + 'Averyveryverylongwordwithoutanyspaces'.repeat(20) + '\n\n```\ncode block\n```\n\n![external image](https://example.com/x.jpg)\n',
  'thoughts/2026-07-14-long-title.md': '---\ndate: 2026-07-14 12:00\ntitle: ' + JSON.stringify('A very long title '.repeat(30)) + '\n---\nShort body.\n',
  'thoughts/2026-07-15-empty.md': '---\ndate: 2026-07-15 12:00\n---\n',
  'thoughts/2026-07-15-odd-study.md': '---\ndate: 2026-07-15 15:00\nflashcard: true\ntimetable: [[1]]\npomodoro: [999]\ngrade: {a: 1}\ncasecard: [" v "]\nmindmap: [a, b, c, d, e, f, g, h, i]\ntimecard: ["99:99 - 00:00"]\ndeadline: [45]\ninboxzero: [-3]\nidbadge: true\nmemo: true\n---\nOdd study.\n',
  'thoughts/2026-07-15-odd-memory.md': '---\ndate: 2026-07-15 13:00\nmemory: 99999\nalarmclock: ["99:99"]\nsteps: abc\nworkout: {a: 1}\nskystars: 5\nnegatives: [[1]]\ncalendar: true\nthennow: true\nledclock: ["25:61"]\n---\nOdd memory.\n',
  'photos/2026-07-15-memory-dump.md': '---\ndate: 2026-07-15 14:00\nmemory: 2011-02-30\noldprint: true\nrewind: true\n---\nNo photos at all.\n',
  'thoughts/2026-07-16-crlf.md': '---\r\ndate: 2026-07-16 12:00\r\ntitle: Windows line endings\r\n---\r\nBody with CRLF.\r\n',
  'thoughts/2026-07-17-bom.md': '﻿---\ndate: 2026-07-17 12:00\ntitle: Starts with a BOM\n---\nBody.\n',
  'thoughts/2026-07-18-bad-date.md': '---\ndate: yesterday\ntitle: Bad date\n---\nHidden, but must not break anything.\n',
  'thoughts/2026-07-19-broken.md': '---\ndate: 2026-07-19 12:00\ntitle: Broken: header\n---\nHidden because of the header.\n',
  'photos/2026-07-20-dump.md': '---\ndate: 2026-07-20 12:00\nphotos: [1.jpg, 2.jpg, missing.jpg]\ncaptions: [one]\n---\nTwo real, one missing.\n',
  'lists/2026-07-21-list.md': '---\ndate: 2026-07-21 12:00\ntitle: List\n---\n' + Array.from({ length: 200 }, (_, i) => `${i + 1}. item ${i + 1}`).join('\n') + '\n',
  'quotes/2026-07-22-quote.md': '---\ndate: 2026-07-22 12:00\nsource: 12345\n---\n> ' + 'quote '.repeat(300) + '\n',
  // site files in odd shapes
  'site.md': '---\nname: Fuzz Site\nowner: Fuzz Owner\nstatus: reading [book] and [tv] (book) :) <b>bold</b>\npresence: sleeping\ncountdown: Trip\ncountdown_date: 2020-01-01\nstatus_updated: not a date\n---\n# About\n\nHello.\n',
  'wishlist.md': '# Want\n- [ ] Place One, Paris (food) — note\n- [x] Done Place\n- [ ] , \n- [ ]\n- not a checkbox\n- [ ] Only, (x)\n',
  'categories.md': '- Bookshops, #123\n- , #fff\n- Bad colour, red\n- ' + 'x'.repeat(40) + '\n',
  'status-log.md': '- 2026-10-01 10:00 · first\n- not a status\n- 2026-13-45 · bad date\n',
  'travel.md': '---\nflights: "1,234"\ndistance_km: -5\nhours: lots\nper_year: {2024: 3, abc: 2, 2025: x}\ntop_airlines: Airline A, Airline B\nvisited: [GB London, {country: fr, city: Lyon, date: 2019-7}, XX Nowhere, 12]\n---\nNote.\n',
  'guestbook/20260101T000000-a.md': '---\nname: "<img src=x onerror=alert(1)>"\ndate: not a date\nreply: "Thanks"\n---\n<script>alert(1)</script> hello\n'
};

const ROUTES = ['#/', '#/thoughts', '#/journal', '#/journal/shelf', '#/journal/year/2026', '#/journal/year/1999', '#/journal/no-such-place', '#/atlas', '#/passport', '#/wishlist', '#/guestbook', '#/more', '#/books', '#/films', '#/podcasts', '#/music', '#/tv', '#/stats', '#/about', '#/search', '#/album', '#/friends', '#/post/thoughts/no-such', '#/nonsense/route',
  // the passport and map opened from a journal entry, including odd and missing places
  '#/passport/2026-07-02-huge-rating', '#/atlas/2026-07-02-huge-rating', '#/passport/2026-07-05-no-coords', '#/atlas/2026-07-01-odd-rating', '#/passport/no-such-place', '#/atlas/no-such-place'];

await launch();
if (!process.env.EMPTY) await test('seed the awkward content', async () => {
  await upload('photos/2026-07-20-dump/1.jpg', PHOTOS[0]);
  await upload('photos/2026-07-20-dump/2.jpg', PHOTOS[1]);
  await upload('places/2026-07-04-photos-odd/1.jpg', PHOTOS[2]);
  await api('batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: Object.entries(FILES).map(([key, text]) => ({ key, text })) }) });
  const d = await publicData();
  assert(d.posts.length > 10, 'posts: ' + d.posts.length);
});

const data = await publicData();
const postRoutes = data.posts.map((p) => (p.type === 'places' ? `#/journal/${p.slug}` : ['books', 'films', 'podcasts', 'music', 'tv'].includes(p.type) ? `#/${p.type}/${p.slug}` : `#/post/${p.type}/${p.slug}`));
const all = [...ROUTES, ...postRoutes];

const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  desktop: { viewport: { width: 1366, height: 860 } }
};

for (const [name, opts] of Object.entries(DEVICES)) {
  await test(`every page on a ${name} (${all.length} pages)`, async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage(opts);
    const errors = [];
    page.on('pageerror', (e) => errors.push(`${page.url().split('#')[1] || '/'}: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/Failed to load resource|ERR_|tile\.openstreetmap|AudioContext/.test(t)) return;
      errors.push(`${page.url().split('#')[1] || '/'}: console: ${t}`);
    });
    page.on('dialog', (d) => {
      errors.push('a dialog opened: ' + d.message());
      d.dismiss();
    });
    await page.goto(BASE + '/');
    await page.waitForSelector('.visitor-tile');
    await page.locator('.visitor-tile').click();
    await page.waitForTimeout(800);
    const empty = [];
    for (const r of all) {
      await page.evaluate((h) => (location.hash = h), r);
      await page.waitForTimeout(name === 'desktop' ? 500 : 350);
      const text = await page.evaluate(() => (document.querySelector('.dw.active .wbody') || document.querySelector('#main') || document.body).innerText.trim().length);
      if (!text) empty.push(r);
    }
    await browser.close();
    assert(!errors.length, [...new Set(errors)].slice(0, 25).join('\n'));
    assert(!empty.length, 'blank pages: ' + empty.join(', '));
  });
}

const failed = report();
await close();
process.exit(failed ? 1 : 0);
