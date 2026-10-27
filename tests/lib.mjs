// Shared helpers for the end-to-end checks. They run against a local copy of the site that
// tests/run.mjs starts with an empty bucket (see "For developers" in the README).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

// Playwright isn't one of the site's own packages (the site doesn't need it to run); install it
// with `npm i --no-save playwright && npx playwright install chromium`, or point
// PLAYWRIGHT_MODULE at an existing copy.
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
export const chromium = pw.chromium;
export { YAML };

export const BASE = process.env.TEST_BASE || 'http://localhost:8800';
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES = path.join(HERE, 'fixtures');
export const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'site-tests-'));
export const PHOTOS = [1, 2, 3, 4].map((n) => path.join(FIXTURES, `p${n}.jpg`));

export async function api(p, opts = {}) {
  const r = await fetch(`${BASE}/admin/api/${p}`, opts);
  const ct = r.headers.get('content-type') || '';
  const body = ct.includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error(`${p} → ${r.status} ${JSON.stringify(body)}`);
  return body;
}
export const putFile = (key, text) => api('file?key=' + encodeURIComponent(key), { method: 'PUT', body: text });
export const getFile = (key) => api('file?key=' + encodeURIComponent(key));
export async function fileExists(key) {
  const r = await fetch(`${BASE}/admin/api/file?key=${encodeURIComponent(key)}`);
  return r.status === 200;
}
export const delFile = (key) => api('file?key=' + encodeURIComponent(key), { method: 'DELETE' });
export const upload = (key, file) => api('upload?key=' + encodeURIComponent(key), { method: 'PUT', body: fs.readFileSync(file) });
export const overview = () => api('overview');
// Files put straight into the bucket, the way a hand upload or an import would arrive (the
// back office's own saves are checked; these aren't).
export const seed = (files) => api('batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: Object.entries(files).map(([key, text]) => ({ key, text })) }) });
export async function publicData() {
  const r = await fetch(`${BASE}/api/all?nocache=${Date.now()}`);
  return r.json();
}
export async function mediaOk(url) {
  const r = await fetch(BASE + url);
  if (r.status !== 200) return `${url} → ${r.status}`;
  const ct = r.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) return `${url} → ${ct}`;
  const b = new Uint8Array(await r.arrayBuffer());
  // No camera details may be left in a served photo.
  if (/Exif|TestCam/.test(Buffer.from(b).toString('latin1'))) return `${url} still has hidden data`;
  return null;
}
export const split = (text) => {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/.exec(text);
  return m ? { data: YAML.parse(m[1]) || {}, body: m[2] } : { data: {}, body: text };
};

// ---- a tiny test runner ----
const results = [];
export async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e.message || String(e) });
    if (process.env.TEST_STACK) console.log(e.stack);
    console.log(`  ✗ ${name}\n      ${String(e.message || e).split('\n').join('\n      ')}`);
  }
}
export function report() {
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length} passed, ${bad.length} failed`);
  return bad.length;
}
export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
export function eq(a, b, msg) {
  const A = JSON.stringify(a);
  const B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg}\n      expected ${B}\n      got      ${A}`);
}

// ---- devices ----
export const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  desktop: { viewport: { width: 1366, height: 860 } }
};
// Into the site as a visitor (past the welcome screen).
export async function enter(page) {
  await page.goto(BASE + '/');
  await page.waitForSelector('.visitor-tile');
  await page.locator('.visitor-tile').click();
  await page.waitForTimeout(800);
}

// ---- the back office in a browser ----
let browser;
export async function launch() {
  browser = await chromium.launch();
  return browser;
}
export async function close() {
  await browser?.close();
}
export async function adminPage(base = BASE) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`${base}/admin/`);
  await page.waitForSelector('.admin-tabs button');
  return page;
}
export async function toastText(page) {
  await page.waitForSelector('.toast:not([hidden])', { timeout: 15000 });
  return page.locator('.toast').textContent();
}
export async function newPost(page, type) {
  await page.locator('.admin-tabs button', { hasText: /^(New post|Edit post)$/ }).click();
  await page.locator('.type-tabs button', { hasText: new RegExp(`^${type}$`) }).click();
}
export async function waitPhotos(page) {
  await page.waitForFunction(() => ![...document.querySelectorAll('.thumb-wait')].some((e) => e.textContent.includes('Preparing')), null, { timeout: 30000 });
}
export async function editPost(page, titleText) {
  await page.locator('.admin-tabs button', { hasText: 'Posts' }).click();
  // Older posts are folded away by month: search for it, as you would.
  const search = page.getByRole('searchbox', { name: 'Search posts' });
  if (await search.count()) await search.fill(String(titleText).replace(/["“”]/g, ' ').trim());
  // The list can redraw just as it's clicked (a refresh landing): try again if so.
  for (let tries = 0; ; tries++) {
    try {
      const row = page.locator('.list-row').filter({ hasText: titleText }).first();
      await row.locator('button', { hasText: 'Edit' }).click({ timeout: 8000 });
      await page.waitForSelector('.type-tabs, .hint:has-text("Editing")', { timeout: 8000 });
      return;
    } catch (e) {
      if (tries >= 3) throw e;
      await page.waitForTimeout(500);
    }
  }
}
export async function clickSave(page) {
  await page.locator('.row.end button.go').last().click();
  return toastText(page);
}
