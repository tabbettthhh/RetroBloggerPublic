// The living wallpaper: the sky follows the visitor's clock unless they pick one.
import { storage } from './util.js';

const store = storage();
export const SKIES = ['morning', 'day', 'sunset', 'night'];

export function skyForHour(h) {
  return h < 6 ? 'night' : h < 10 ? 'morning' : h < 17 ? 'day' : h < 20 ? 'sunset' : 'night';
}

export function wallpaperChoice() {
  return store.getItem('wallpaper') || 'auto';
}

export function setWallpaperChoice(v) {
  store.setItem('wallpaper', v);
  applySky();
}

export function currentSky() {
  const choice = wallpaperChoice();
  return SKIES.includes(choice) ? choice : skyForHour(new Date().getHours());
}

export function applySky() {
  const sky = currentSky();
  for (const s of SKIES) document.body.classList.toggle('sky-' + s, s === sky);
  return sky;
}

export function startSky() {
  applySky();
  setInterval(applySky, 5 * 60 * 1000);
}

export function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late?' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Up late?';
}

export function clockText() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
