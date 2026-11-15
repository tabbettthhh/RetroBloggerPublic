// Your site's icon (the browser tab's, and the one on a phone's home screen when the site is
// added to it) is your picture: one of the site's own, or your photo. Drawn here, once per
// picture, into a square PNG kept with your designs (design/app-….png); your site hands it out at
// /icons/…, and the site's own icon whenever you have no picture.
import { pictureHtml, isPhoto, photoUrl } from '/js/pictures.js';

export const appIconKey = (picture) => `design/app-${String(picture).replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.png`;

async function draw(picture) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  if (isPhoto(picture)) img.src = photoUrl(picture);
  else {
    const svg = pictureHtml(picture).replace('width="100%" height="100%"', `width="${size}" height="${size}"`).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  await img.decode();
  // (A photo is cropped to its middle square.)
  const w = img.naturalWidth || size;
  const hgt = img.naturalHeight || size;
  const s = Math.min(w, hgt);
  g.drawImage(img, (w - s) / 2, (hgt - s) / 2, s, s, 0, 0, size, size);
  return new Promise((ok) => c.toBlob(ok, 'image/png'));
}

// Made if it isn't there yet; then the tab's icon is changed straight away.
export async function ensureAppIcon(picture) {
  if (!picture) return showIcon('');
  const key = appIconKey(picture);
  const have = await fetch('/media/' + key, { method: 'HEAD', credentials: 'same-origin' }).then((r) => r.ok, () => false);
  if (!have) {
    const blob = await draw(picture);
    if (!blob) return;
    const res = await fetch('/admin/api/upload?key=' + encodeURIComponent(key), { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/png' }, credentials: 'same-origin' });
    if (!res.ok) return;
  }
  showIcon(key);
}
function showIcon(key) {
  for (const l of document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')) l.href = l.href.replace(/\?.*$/, '') + '?v=' + encodeURIComponent(key || 'site');
  // (And your site's own window on the taskbar, which wears it too.)
  for (const i of document.querySelectorAll('img.task-site')) i.src = '/icons/icon-192.png?v=' + encodeURIComponent(key || 'site');
}
