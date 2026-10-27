// Light and dark appearance. "Auto" follows the visitor's phone or computer setting;
// a choice of Light or Dark is remembered in their own browser.
import { storage } from './util.js';

const store = storage();
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const CHOICES = ['auto', 'light', 'dark'];
const BAR = { light: '#0a3ec4', dark: '#141414' };

export function themeChoice() {
  const v = store.getItem('theme');
  return CHOICES.includes(v) ? v : 'auto';
}

export function isDark() {
  const c = themeChoice();
  return c === 'dark' || (c === 'auto' && mq.matches);
}

export function applyTheme() {
  const mode = isDark() ? 'dark' : 'light';
  document.documentElement.dataset.theme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = BAR[mode];
  return mode;
}

export function setThemeChoice(v) {
  store.setItem('theme', CHOICES.includes(v) ? v : 'auto');
  applyTheme();
}

// Auto → Dark → Light → Auto, for the one-button switch in the phone menus.
export function cycleTheme() {
  const next = { auto: 'dark', dark: 'light', light: 'auto' }[themeChoice()];
  setThemeChoice(next);
  return next;
}

export function themeLabel(c = themeChoice()) {
  return c === 'auto' ? 'Auto' : c === 'dark' ? 'Dark' : 'Light';
}

export function startTheme() {
  applyTheme();
  mq.addEventListener('change', () => themeChoice() === 'auto' && applyTheme());
}

export const MOON = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 1.6A6.6 6.6 0 1 0 14.4 11 5.4 5.4 0 0 1 10.8 1.6z" fill="#f4e7a8" stroke="#8a7420" stroke-width="0.9"/></svg>';
