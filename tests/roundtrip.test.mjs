// Opening any post in the back office and saving it without touching anything must not
// change what the site shows. Checked for the example posts and a set of awkward ones.
import { api, test, report, assert, launch, close, adminPage, clickSave, overview, BASE } from './lib.mjs';

const AWKWARD = {
  'thoughts/2026-08-01-numbers.md': '---\ndate: 2026-08-01 09:00\ntitle: "1984"\n---\nA title that is a number.\n',
  'thoughts/2026-08-02-yes.md': '---\ndate: 2026-08-02 09:00\ntitle: "yes"\n---\nA title YAML could read as true.\n',
  'thoughts/2026-08-03-rtl.md': '---\ndate: 2026-08-03 09:00\ntitle: سلام دنیا\n---\nمتن نمونه 🌙\n',
  'thoughts/2026-08-04-colon.md': '---\ndate: 2026-08-04 09:00\ntitle: "Rome: day one"\nmood: "50% tired"\n---\nTitle with a colon.\n',
  'thoughts/2026-08-05-dateonly.md': '---\ndate: 2026-08-05\ntitle: Date only\n---\nNo time given.\n',
  'thoughts/2026-08-06-no-header.md': 'Just words, no header at all.\n',
  'photos/2026-08-07-captions.md': '---\ndate: 2026-08-07 09:00\nphotos: [a.jpg, b.jpg, c.jpg]\ncaptions: ["one", "", "three: with colon"]\n---\nCaptions with a gap.\n',
  'places/2026-08-08-area.md': '---\ndate: 2026-08-08 09:00\ntitle: Area Only Café\narea: Digbeth, Birmingham\ncountry: United Kingdom\ncountry_code: gb\nlat: 52.475\nlon: -1.885\ncategory: Coffee\nrating: 4.5\nwould_return: true\nweather: "12°C, light rain"\nstamp: postmark\nordered:\n  - item: Flat white\n    price: £3.40\n  - Toastie — £6\nfloppy: Single line for Floppy\nfloppy_journal: [one, two]\nsuggested_by: Ali\nbought:\n  - Mug — £8\ntickets: true\nrides:\n  - Bus — £2\n---\nArea but no city.\n',
  'books/2026-08-09-gr.md': '---\ndate: 2026-08-09\ntitle: "Dune: Messiah"\nauthor: Frank Herbert\nyear: 1969\nstatus: currently-reading\nrating: 4\nrecommend: true\npages: "336"\npage: 100\nquote: "Fear is: the mind-killer"\n---\n',
  'films/2026-08-10-film.md': '---\ndate: 2026-08-10 21:00\ntitle: Heat\ndirector: Michael Mann\nyear: 1995\nstatus: watched\nrating: 5\nrewatch: true\n---\nStill great.\n',
  'music/2026-08-11-song.md': '---\ndate: 2026-08-11 21:00\ntitle: A Song\nartist: Someone & Co\nformat: single\nalbum: The Album\nstatus: on repeat\n---\n',
  'podcasts/2026-08-12-pod.md': '---\ndate: 2026-08-12 21:00\ntitle: The Pod\nhost: Host Name\nepisode: "Ep. 12: lighthouses"\nstatus: listening\n---\n',
  'tv/2026-08-13-tv.md': '---\ndate: 2026-08-13 21:00\ntitle: Show\ncreator: Maker\nseason: "2"\nepisode: 4\nnetwork: BBC\nstatus: watching\nepisodes:\n  - season: 2\n    ep: 1-3\n    rating: 4\n    date: 2026-08-13\n  - season: 2\n    ep: 4\n    title: "Twist: part one"\n---\n',
  'quotes/2026-08-14-quote.md': '---\ndate: 2026-08-14 09:00\nsource: "Author, Book: Subtitle"\n---\n> A quote.\n',
  'lists/2026-08-15-list.md': '---\ndate: 2026-08-15 09:00\ntitle: Top 3\npinned: true\n---\n1. One\n2. Two\n3. Three\n',
  'thoughts/2026-08-16-draft.md': '---\ndate: 2026-08-16 09:00\ndraft: true\n---\nA draft.\n',
  'thoughts/2026-08-17-extras.md': '---\ndate: 2026-08-17 09:00\ntitle: Extras\ntags: [a, b]\nmeta:\n  source: notebook\n  pages: 3\nvisible: false\nscore: 0\n---\nExtra fields.\n'
};

// Fields that may legitimately be tidied on save.
// (The word for where you are with a book or show is written in the back office's own words,
// e.g. "currently-reading" becomes "reading"; what it means doesn't change.)
const comparable = (p) => {
  const { body, html, status, ...rest } = p;
  return JSON.stringify({ ...rest, body: String(body || '').trim(), html: String(html || '').trim() });
};

await launch();

await test('seed the example posts and awkward posts', async () => {
  const ex = await (await fetch(`${BASE}/admin/examples.json`)).json();
  const md = ex.files.filter((f) => f.text != null && /^(thoughts|places|photos|lists|quotes|books|films|podcasts|music|tv)\//.test(f.key));
  await api('batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: [...md.map((f) => ({ key: f.key, text: f.text })), ...Object.entries(AWKWARD).map(([key, text]) => ({ key, text }))] }) });
  const n = (await overview()).posts.length;
  assert(n >= Object.keys(AWKWARD).length, 'only ' + n + ' posts');
});

const before = (await overview()).posts.filter((p) => !p.error);
const page = await adminPage();
for (const p of before) {
  await test(`open and save unchanged: ${p.key}`, async () => {
    // (The last save's refresh finishes first, so it can't redraw over the next editor.)
    await page.waitForLoadState('networkidle');
    await page.locator('.admin-tabs button', { hasText: 'Posts' }).click();
    // Older posts are folded away by month: open every month so all the rows are there.
    await page.evaluate(() => document.querySelectorAll('.month-fold').forEach((d) => (d.open = true)));
    const rows = page.locator('.list-row');
    const n = await rows.count();
    let row = null;
    for (let i = 0; i < n; i++) {
      // Rows don't show the file name, so find it by its position in the back office list.
      const label = await rows.nth(i).locator('strong').textContent();
      if (label.replace('📌 ', '') === (p.title || p.excerpt || '(no text)')) {
        row = rows.nth(i);
        break;
      }
    }
    assert(row, 'row not found');
    await row.locator('button', { hasText: 'Edit' }).click();
    // The list may still be redrawing after the last save; if the click landed on the old
    // list, click again.
    if (!(await page.waitForSelector('.hint:has-text("Editing")', { timeout: 5000 }).catch(() => null))) {
      await page.locator('.admin-tabs button', { hasText: 'Posts' }).click();
      await page.evaluate(() => document.querySelectorAll('.month-fold').forEach((d) => (d.open = true)));
      await page.locator('.list-row').filter({ has: page.locator('strong', { hasText: p.title || p.excerpt || '(no text)' }) }).first().locator('button', { hasText: 'Edit' }).click();
      await page.waitForSelector('.hint:has-text("Editing")');
    }
    const msg = await clickSave(page);
    assert(!/n't|error|mistake/i.test(msg), 'save said: ' + msg);
    const after = (await overview()).posts.find((x) => x.key === p.key);
    assert(after, 'post vanished');
    const a = JSON.parse(comparable(p));
    const b = JSON.parse(comparable(after));
    const diffs = Object.keys({ ...a, ...b }).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    assert(!diffs.length, diffs.map((k) => `${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`).join('\n'));
  });
}
assert(!page.errors.length, page.errors.join('; '));

const failed = report();
await close();
process.exit(failed ? 1 : 0);
