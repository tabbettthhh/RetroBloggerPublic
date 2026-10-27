// Photos the way phones produce them: sideways-tagged JPEGs, HEIC, and lots at once.
import { test, report, assert, eq, launch, close, adminPage, newPost, waitPhotos, clickSave, overview, PHOTOS, BASE, FIXTURES } from './lib.mjs';
await launch();

async function sizeOf(url) {
  const page = await adminPage();
  const r = await page.evaluate(async (u) => {
    const b = await (await fetch(u)).blob();
    const bmp = await createImageBitmap(b);
    // Is the top band red (the photo the right way up)?
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const px = g.getImageData(Math.floor(bmp.width / 2), 5, 1, 1).data;
    return { w: bmp.width, h: bmp.height, top: [px[0], px[1], px[2]] };
  }, url);
  await page.close();
  return r;
}

await test('a sideways-tagged phone photo comes out the right way up', async () => {
  const page = await adminPage();
  await newPost(page, 'Photos');
  await page.locator('#photo-in').setInputFiles([`${FIXTURES}/rotated.jpg`]);
  await waitPhotos(page);
  await page.locator('textarea.textarea').first().fill('Rotation test');
  await clickSave(page);
  const post = (await overview()).posts.find((p) => p.body.includes('Rotation test'));
  const s = await sizeOf(post.photos[0]);
  assert(s.h > s.w, `came out landscape ${s.w}×${s.h}`);
  await page.close();
});

await test('a HEIC photo from an iPhone works in a browser that cannot open HEIC itself', async () => {
  const page = await adminPage();
  await newPost(page, 'Photos');
  await page.locator('#photo-in').setInputFiles([`${FIXTURES}/iphone.heic`]);
  await waitPhotos(page);
  const msg = await page.locator('.toast:not([hidden])').textContent().catch(() => '');
  assert(!/couldn't|can't/i.test(msg || ''), 'toast: ' + msg);
  await page.locator('textarea.textarea').first().fill('HEIC test');
  await clickSave(page);
  const post = (await overview()).posts.find((p) => p.body.includes('HEIC test'));
  assert(post?.photos.length === 1, 'photo missing');
  const s = await sizeOf(post.photos[0]);
  assert(s.w === 1600 && s.h === 1200, `size ${s.w}×${s.h}`);
  await page.close();
});

await test('twenty photos at once: all converted, saved and loading', async () => {
  const page = await adminPage();
  await newPost(page, 'Photos');
  const many = Array.from({ length: 20 }, (_, i) => PHOTOS[i % 4]);
  const t0 = Date.now();
  await page.locator('#photo-in').setInputFiles(many);
  await waitPhotos(page);
  const prepared = Date.now() - t0;
  await page.locator('textarea.textarea').first().fill('Twenty photos');
  const msg = await clickSave(page);
  assert(/Published/.test(msg), 'toast: ' + msg);
  const post = (await overview()).posts.find((p) => p.body.includes('Twenty photos'));
  eq(post.photos.length, 20, 'photos');
  for (const u of post.photos) eq((await fetch(BASE + u)).status, 200, u);
  console.log(`      (prepared in ${(prepared / 1000).toFixed(1)}s)`);
  await page.close();
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
