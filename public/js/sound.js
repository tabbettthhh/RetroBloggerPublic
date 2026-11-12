// Original little sounds, synthesised on the fly. No audio files, nothing borrowed.
import { storage } from './util.js';

const store = storage();
let ctx = null;

// The site's theme picks a sound pack: the same little tunes, played differently. "quiet"
// starts with sounds off until a visitor turns them on.
const PACKS = {
  classic: {},
  soft: { type: 'sine', pitch: 0.9, vol: 0.7 },
  chip: { type: 'square', pitch: 1, vol: 0.55 },
  bubbly: { type: 'sine', pitch: 1, vol: 0.85, glide: true },
  quiet: {}
};
let pack = PACKS.classic;
let packName = 'classic';
export function setSoundPack(name) {
  packName = PACKS[name] ? name : 'classic';
  pack = PACKS[packName];
}

export function isMuted() {
  const v = store.getItem('muted');
  return v === '1' || (v == null && packName === 'quiet');
}
export function setMuted(m) {
  store.setItem('muted', m ? '1' : '0');
  document.dispatchEvent(new CustomEvent('mutechange'));
}

// How loud, 0 to 1 (the old computers' volume knobs turn it; see machine.js), kept in this
// browser only. Each sound also tells the page it played, so speakers can pulse and needles swing.
export function getVolume() {
  const v = Number(store.getItem('volume'));
  return store.getItem('volume') == null || !Number.isFinite(v) ? 1 : Math.max(0, Math.min(1, v));
}
export function setVolume(v) {
  store.setItem('volume', String(Math.max(0, Math.min(1, Number(v) || 0))));
  document.dispatchEvent(new CustomEvent('volumechange'));
}
let lastPing = 0;
function ping(level) {
  const now = performance.now();
  if (now - lastPing < 40) return;
  lastPing = now;
  document.dispatchEvent(new CustomEvent('sitesound', { detail: { level: Math.min(1, level) } }));
}

function audio() {
  if (isMuted()) return null;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, start, dur, type = 'sine', vol = 0.05) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = pack.type || type;
  freq *= pack.pitch || 1;
  vol *= (pack.vol || 1) * getVolume();
  ping(vol * 18);
  if (vol <= 0) return;
  o.frequency.value = freq;
  const t = a.currentTime + start;
  if (pack.glide) {
    o.frequency.setValueAtTime(freq * 0.72, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.12, t + dur);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// A short burst of filtered noise (wood, metal, paper).
function noise(dur, freq, vol, start = 0) {
  const a = audio();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  vol *= getVolume();
  ping(vol);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * vol;
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 2.5;
  src.buffer = buf;
  src.connect(f).connect(a.destination);
  src.start(a.currentTime + start);
}

export const sound = {
  click: () => tone(1800, 0, 0.03, 'square', 0.015),
  // A buzzy two-part rattle for a nudge.
  nudge: () => {
    for (let i = 0; i < 6; i++) tone(i % 2 ? 210 : 260, i * 0.07, 0.07, 'sawtooth', 0.03);
    tone(523, 0.46, 0.12, 'triangle', 0.04);
    tone(784, 0.54, 0.18, 'triangle', 0.035);
  },
  open: () => {
    tone(660, 0, 0.12, 'triangle', 0.04);
    tone(990, 0.06, 0.16, 'triangle', 0.035);
  },
  close: () => {
    tone(880, 0, 0.1, 'triangle', 0.035);
    tone(587, 0.05, 0.14, 'triangle', 0.03);
  },
  chime: () => {
    tone(784, 0, 0.5, 'sine', 0.05);
    tone(988, 0.12, 0.5, 'sine', 0.045);
    tone(1319, 0.24, 0.7, 'sine', 0.04);
  },
  stamp: () => {
    tone(140, 0, 0.12, 'square', 0.05);
    tone(90, 0.02, 0.18, 'sine', 0.06);
  },
  // A knock at the door: three raps on wood.
  knock: () => {
    for (const t of [0, 0.16, 0.32]) {
      noise(0.07, 520, 0.9, t);
      tone(150, t, 0.07, 'sine', 0.06);
    }
  },
  // A door creaking open: a slow, wavering squeak.
  creak: () => {
    for (let i = 0; i < 9; i++) tone(300 + i * 34 + (i % 2 ? 26 : 0), i * 0.055, 0.07, 'sawtooth', 0.012);
    noise(0.06, 700, 0.3, 0.52);
  },
  // The highlights cabinet: a small key turning in its lock, and the doors' latch.
  key: () => {
    noise(0.05, 4200, 0.35, 0);
    noise(0.06, 3000, 0.3, 0.09);
    tone(2400, 0.09, 0.05, 'triangle', 0.012);
  },
  latch: () => {
    noise(0.08, 900, 0.4, 0);
    tone(196, 0, 0.12, 'sine', 0.03);
  },
  page: () => {
    const a = audio();
    if (!a) return;
    const len = Math.floor(a.sampleRate * 0.18);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    const loud = 0.25 * getVolume();
    ping(loud);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2) * loud;
    const src = a.createBufferSource();
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2500;
    src.buffer = buf;
    src.connect(f).connect(a.destination);
    src.start();
  }
};
