// Bakes the paper, leather and ink textures (scripts/textures/*.svg, each drawn with a noise
// filter) into small pictures (public/img/tex/*.webp). The site uses the pictures: a browser
// working the noise out afresh each time it draws a page made the journals slow to turn.
// Run it after changing one of the .svg files:  node scripts/textures.mjs  (needs Playwright).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'scripts/textures');
const to = path.join(root, 'public/img/tex');
fs.mkdirSync(to, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const file of fs.readdirSync(from).filter((f) => f.endsWith('.svg')).sort()) {
  const svg = fs.readFileSync(path.join(from, file), 'utf8').trim();
  // (At its own size, so the styles that tile it need no change.)
  const data = await page.evaluate(async (svg) => {
    const img = new Image();
    img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.8);
  }, svg);
  const out = path.join(to, file.replace(/\.svg$/, '.webp'));
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  console.log(path.relative(root, out), fs.statSync(out).size);
}
await browser.close();
