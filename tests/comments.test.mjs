// Comments: visitors comment on posts (or reply to a comment) with just a name; each waits for
// approval in the back office, where the owner can reply; and nothing about the visitor is kept.
import { test, report, assert, eq, api, putFile, publicData, overview, adminPage, launch, close, BASE, chromium } from './lib.mjs';

const PERSON = { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' };
const send = async (body, headers = PERSON) => {
  const r = await fetch(`${BASE}/api/comment`, { method: 'POST', headers, body: JSON.stringify(body) });
  return [r.status, await r.json().catch(() => ({}))];
};
const approve = (key) => api(`move?key=${encodeURIComponent(key)}&to=${encodeURIComponent(key.replace('comments-pending/', 'comments/'))}`, { method: 'POST' });
const at = (h) => new Date(Date.now() - h * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const POST = 'thoughts/sunny-day';
await launch();
const onSite = async () => (await publicData()).posts.find((p) => `${p.type}/${p.slug}` === POST);

await test('a visitor comments with just a name, and it waits for approval', async () => {
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\n---\nHi.\n');
  await putFile('thoughts/sunny-day.md', `---\ndate: ${at(2)}\ntitle: A sunny day\n---\nWent to the park.\n`);
  await putFile('places/harbour.md', `---\ndate: ${at(3)}\ntitle: Harbour Café\ncity: Whitby\n---\nGood scones.\n`);
  eq((await onSite()).comments, [], 'comments are on, none yet');
  eq((await send({ post: POST, name: '  ', message: 'Hello' }))[0], 400, 'a name is needed');
  eq((await send({ post: POST, name: 'Jo', message: ' ' }))[0], 400, 'and some words');
  eq((await send({ post: POST, name: 'Jo', message: 'Hi' }, { 'Content-Type': 'application/json', 'User-Agent': 'curl/8' }))[0], 400, 'bots are turned away');
  eq((await send({ post: POST, name: 'Jo', message: 'Hi', website: 'http://spam' }))[1].pending, true, 'a bot filling the hidden field is answered politely');
  eq((await send({ post: 'thoughts/nope', name: 'Jo', message: 'Hi' }))[0], 404, 'only posts that are there');
  eq((await send({ post: POST, name: 'Jo', message: 'Hi', reply_to: 'no-such-comment' }))[0], 404, 'only replies to comments that are there');
  eq(await send({ post: POST, name: 'Jo', message: 'Love this! :)' }), [200, { ok: true, pending: true }], 'sent');
  eq((await onSite()).comments, [], 'not on the site until approved');
  const waiting = (await overview()).pendingComments;
  eq(waiting.map((c) => [c.post, c.name, c.message]), [[POST, 'Jo', 'Love this! :)']], 'waiting in the back office, honeypot one not kept');
  assert(!JSON.stringify(waiting).match(/ip|email|agent/i), 'nothing about the visitor but their name');
});

await test('approved, it shows; the owner replies; visitors reply to comments', async () => {
  const [jo] = (await overview()).pendingComments;
  await approve(jo.key);
  const shown = (await onSite()).comments;
  eq(shown.map((c) => [c.name, c.message, c.reply]), [['Jo', 'Love this! :)', '']], 'on the site');
  assert(!('key' in shown[0]), 'file names stay in the back office');
  // The owner's reply, saved with it from the back office.
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Comments' }).click();
  await page.waitForSelector('.cm-admin');
  await page.getByRole('textbox', { name: 'Reply to Jo' }).fill('Thank you Jo!');
  await page.locator('.cm-admin button', { hasText: 'Save reply' }).click();
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('Reply saved'));
  eq((await onSite()).comments[0].reply, 'Thank you Jo!', 'the reply is on the site');
  // A visitor replies to Jo, and it's approved from the notifications.
  eq((await send({ post: POST, name: 'Max', message: 'Same here', reply_to: shown[0].id }))[0], 200, 'a reply');
  await page.reload();
  await page.locator('.admin-tabs button.tab-bell').click();
  await page.waitForSelector('.note-comment');
  assert((await page.locator('.note-comment').first().innerText()).includes('replied to a comment on'), 'in the notifications');
  await page.locator('.note-comment button', { hasText: 'Approve' }).first().click();
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('Approved'));
  const both = (await onSite()).comments;
  eq(both.map((c) => [c.name, c.reply_to === shown[0].id]), [['Jo', false], ['Max', true]], 'threaded under Jo');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

await test('on the site: the comments under a post, a form to leave one, and the count in the feed', async () => {
  const browser = await chromium.launch();
  const site = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: PERSON['User-Agent'] });
  site.errors = [];
  site.on('pageerror', (e) => site.errors.push(e.message));
  await site.addInitScript(() => sessionStorage.setItem('entered', '1'));
  await site.goto(BASE + '/#/');
  const link = site.locator('.card', { hasText: 'A sunny day' }).locator('.card-comments');
  assert((await link.innerText()).includes('2 comments'), 'the count on its card');
  await link.click();
  await site.waitForSelector('.comments');
  const block = site.locator('.comments');
  assert((await block.locator('.cm-title').innerText()).includes('2 comments'), 'how many');
  assert((await block.locator('.cm-owner').innerText()).includes('Thank you Jo!'), 'the owner’s reply, marked as theirs');
  eq(await block.locator('.cm-list.replies .cm-item b').innerText(), 'Max', 'the reply under the comment it answers');
  // Leaving one: a name and the words.
  const leave = block.locator('.cm-form').last();
  await leave.getByRole('textbox', { name: 'Your name' }).fill('Lee');
  await leave.getByRole('textbox', { name: 'Your comment' }).fill('Great park.');
  await leave.locator('button[type=submit]').click();
  await site.waitForSelector('.cm-thanks');
  assert((await site.locator('.cm-thanks').innerText()).includes('once approved'), 'thanks, and it waits');
  eq((await overview()).pendingComments.map((c) => c.name), ['Lee'], 'waiting in the back office');
  // A place: the comments open in a little window from the journal.
  await site.goto(BASE + '/#/journal/harbour');
  await site.locator('.cm-open').click();
  await site.waitForSelector('.cm-dialog[open] .comments');
  assert((await site.locator('.cm-dialog .cm-empty').innerText()).includes('Be the first'), 'no comments yet');
  await site.locator('.cm-close').click();
  await site.waitForSelector('.cm-dialog', { state: 'detached' });
  assert(!site.errors.length, site.errors.join('; '));
  await browser.close();
});

await test('switched off, none show and none can be left; a deleted post takes its comments; friends never get them', async () => {
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Comments' }).click();
  await page.waitForSelector('.cm-admin');
  await page.getByRole('checkbox', { name: /Let visitors comment/ }).uncheck();
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])')?.textContent.includes('off'));
  await page.close();
  eq('comments' in (await onSite()), false, 'none show');
  eq((await send({ post: POST, name: 'Jo', message: 'Hi' }))[0], 403, 'none can be left');
  // Saving the site's settings keeps them off.
  await putFile('site.md', (await (await fetch(`${BASE}/admin/api/file?key=site.md`)).text()));
  assert(/comments: (off|"off")/.test(await (await fetch(`${BASE}/admin/api/file?key=site.md`)).text()), 'kept in site.md');
  await putFile('site.md', '---\nname: Home Corner\nowner: Sam\n---\nHi.\n');
  eq((await onSite()).comments.length, 2, 'back on, all still there');
  // Friends' sites never get visitors' comments.
  const { friendFeed } = await import('../src/friends.js');
  const feed = friendFeed(await publicData(), BASE);
  assert(!JSON.stringify(feed).includes('Thank you Jo'), 'not in the friend feed');
  // Deleting the post deletes its comments, on the site and waiting.
  await api('file?key=' + encodeURIComponent('thoughts/sunny-day.md'), { method: 'DELETE' });
  const files = (await overview()).files.map((f) => f.key);
  assert(!files.some((k) => k.includes('/thoughts/sunny-day/')), 'its comments are gone too');
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
