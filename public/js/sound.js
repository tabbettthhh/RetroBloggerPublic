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
  vol *= pack.vol || 1;
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
  page: () => {
    const a = audio();
    if (!a) return;
    const len = Math.floor(a.sampleRate * 0.18);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2) * 0.25;
    const src = a.createBufferSource();
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2500;
    src.buffer = buf;
    src.connect(f).connect(a.destination);
    src.start();
  }
};
