// The arcade corner: one small game of the site's own, Post Rush, in a cabinet, with a table of
// high scores beside it. You catch the post as it falls on the street: letters, parcels and the
// odd gold stamp, and you leave the red bills alone. Three lives: each letter or parcel missed,
// and each bill caught, costs one.
//
// Whose scores are on the table: yours (the site's owner: kept in arcade.md when you play signed
// in), your friends' best (each from their own site, where your friends list is shown), and a
// visitor's own best, kept in their browser only. A site with nothing posted shows no scores.
// Everything drawn here is the site's own.
import { h, storage } from './util.js';
import { sound } from './sound.js';

const W = 160;
const H = 200;
const GROUND = 178;
const store = storage();
const LOCAL = 'arcade-best';

// ---------- the pictures, a pixel at a time ----------
// Each letter is one colour ('.' is nothing).
const PAL = { w: '#f4f1e6', r: '#d8343a', d: '#8c1c22', b: '#9a6a3a', t: '#e6c27a', k: '#3a2410', y: '#f6c83a', o: '#c8861a', s: '#2a5fb0', n: '#1a3a70', f: '#f2c9a0', h: '#5a3a1e', g: '#3a8a3a', l: '#ffffff' };
const SPRITES = {
  letter: ['wwwwwwwwww', 'wwr....rww', 'w.wr..rw.w', 'w..wddw..w', 'w...dd...w', 'w........w', 'wwwwwwwwww'],
  parcel: ['bbbbtbbbbb', 'bbbbtbbbbb', 'bbbbtbbbbb', 'tttttttttt', 'bbbbtbbbbb', 'bbbbtbbbbb', 'bbbbtbbbbb', 'kkkkkkkkkk'],
  stamp: ['y.y.y.y.y', 'yyyyyyyyy', 'yooooooyy', 'yoyyyyoy.', 'yoyrryoyy', 'yoyyyyoy.', 'yooooooyy', 'yyyyyyyyy', 'y.y.y.y.y'],
  bill: ['rrrrrrrrrr', 'rrd....drr', 'r.rd..dr.r', 'r..rlldr.r', 'r...ll...r', 'r...ll...r', 'rrrrrrrrrr'],
  // The postie: a cap, a smile and a big satchel open at the top.
  postie: ['....nnnnn....', '...nnnnnnn...', '..nnnnnnnnnn.', '....fffff....', '....fkfkf....', '....fffff....', '....ffkff....', '...sssssss...', '..sssssssss..', '.ssshhhhhhh..', '.ss.hhhhhhh..', '.ff.hhhhhhh..', '....hhhhhhh..', '....nn..nn...', '....nn..nn...', '...kkk..kkk..']
};
const cache = {};
function sprite(name) {
  if (cache[name]) return cache[name];
  const rows = SPRITES[name];
  const c = document.createElement('canvas');
  c.width = Math.max(...rows.map((r) => r.length));
  c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => PAL[ch] && ((g.fillStyle = PAL[ch]), g.fillRect(x, y, 1, 1))));
  return (cache[name] = c);
}

const KINDS = {
  letter: { points: 10, w: 10, h: 7, catch: true },
  parcel: { points: 25, w: 10, h: 8, catch: true, heavy: true },
  stamp: { points: 100, w: 9, h: 9, catch: true, bonus: true },
  bill: { points: 0, w: 10, h: 7, catch: false }
};

// Little sounds for the game, made on the spot like the rest of the site's.
const beep = (f, d = 0.06, type = 'square', vol = 0.03) => sound.blip(f, d, type, vol);

// ---------- the game ----------
// `onOver(score)` is told the score at the end of every game; `best()` gives the score to beat.
export function postRush(cv, { onOver, best }) {
  const g = cv.getContext('2d');
  cv.width = W;
  cv.height = H;
  g.imageSmoothingEnabled = false;
  const stars = Array.from({ length: 24 }, () => [Math.floor(Math.random() * W), Math.floor(Math.random() * 90)]);
  const houses = Array.from({ length: 6 }, (_, i) => ({ x: i * 28 - 4, w: 22 + Math.floor(Math.random() * 6), h: 26 + Math.floor(Math.random() * 22), lit: Array.from({ length: 4 }, () => Math.random() < 0.5) }));

  let state = 'title';
  let score = 0;
  let lives = 3;
  let level = 1;
  let items = [];
  let pops = [];
  let px = W / 2;
  let target = null;
  let held = 0;
  let spawnIn = 0;
  let overAt = 0;
  let newBest = false;
  let t0 = performance.now();
  let raf = 0;
  let stopped = false;

  const start = () => {
    state = 'play';
    score = 0;
    lives = 3;
    level = 1;
    items = [];
    pops = [];
    px = W / 2;
    spawnIn = 0.6;
    newBest = false;
    sound.click();
  };
  const over = () => {
    state = 'over';
    overAt = performance.now();
    newBest = score > 0 && score > (best() || 0);
    beep(330, 0.15, 'square', 0.035);
    setTimeout(() => beep(220, 0.3, 'square', 0.035), 160);
    onOver?.(score);
  };
  // Start, or (after a moment, so a last tap doesn't skip the score) play again.
  const press = () => {
    if (state === 'title') start();
    else if (state === 'over' && performance.now() - overAt > 900) start();
  };

  const spawn = () => {
    const r = Math.random();
    const kind = r < 0.05 ? 'stamp' : r < 0.05 + Math.min(0.3, 0.1 + level * 0.03) ? 'bill' : r < 0.6 ? 'letter' : 'parcel';
    const k = KINDS[kind];
    const speed = 28 + level * 7 + Math.random() * 10 + (k.heavy ? 8 : 0);
    items.push({ kind, x: 4 + Math.random() * (W - 8 - k.w), y: -10, vy: speed, sway: kind === 'letter' ? Math.random() * 6 : 0, ph: Math.random() * 6 });
  };

  const step = (dt) => {
    if (state !== 'play') return;
    // Moving: held buttons or keys, or towards where you're pointing.
    const speed = 110;
    if (held) px += held * speed * dt;
    else if (target !== null) px += Math.sign(target - px) * Math.min(Math.abs(target - px), speed * 1.4 * dt);
    px = Math.max(8, Math.min(W - 8, px));
    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawn();
      spawnIn = Math.max(0.32, 1.1 - level * 0.08) * (0.7 + Math.random() * 0.6);
    }
    for (const it of items) {
      it.y += it.vy * dt;
      it.ph += dt * 3;
      const k = KINDS[it.kind];
      const x = it.x + Math.sin(it.ph) * it.sway;
      // Into the satchel (its open top, about 9 pixels wide)?
      if (!it.done && it.y + k.h >= GROUND - 9 && it.y + k.h <= GROUND - 2 && Math.abs(x + k.w / 2 - px) < 9) {
        it.done = true;
        if (k.catch) {
          score += k.points * (k.bonus ? 1 : level > 3 ? 2 : 1);
          pops.push({ x, y: it.y, text: '+' + k.points * (k.bonus ? 1 : level > 3 ? 2 : 1), t: 0.8 });
          k.bonus ? (beep(988, 0.08), setTimeout(() => beep(1319, 0.12), 70)) : beep(it.kind === 'parcel' ? 520 : 760, 0.05);
          const lv = 1 + Math.floor(score / 300);
          if (lv > level) {
            level = lv;
            pops.push({ x: W / 2 - 22, y: 70, text: 'LEVEL ' + level, t: 1.4, big: true });
            beep(660, 0.08);
            setTimeout(() => beep(880, 0.12), 90);
          }
        } else {
          lives--;
          pops.push({ x, y: it.y, text: 'BILL!', t: 0.9 });
          beep(140, 0.18, 'sawtooth', 0.04);
        }
      } else if (!it.done && it.y >= GROUND) {
        it.done = true;
        // (A letter or parcel left on the pavement costs a life; a missed stamp, or a bill let go, doesn't.)
        if (k.catch && !k.bonus) {
          lives--;
          pops.push({ x, y: GROUND - 10, text: 'MISS', t: 0.8 });
          beep(180, 0.12, 'triangle', 0.04);
        }
      }
    }
    items = items.filter((it) => !it.done);
    for (const p of pops) p.t -= dt;
    pops = pops.filter((p) => p.t > 0);
    if (lives <= 0) over();
  };

  const text = (s, x, y, colour = '#fff', size = 8) => {
    g.font = `${size}px 'Press Start 2P', monospace`;
    g.fillStyle = '#000';
    g.fillText(s, x + 1, y + 1);
    g.fillStyle = colour;
    g.fillText(s, x, y);
  };
  const centre = (s, y, colour, size = 8) => {
    g.font = `${size}px 'Press Start 2P', monospace`;
    text(s, Math.round((W - g.measureText(s).width) / 2), y, colour, size);
  };

  const draw = (now) => {
    const t = (now - t0) / 1000;
    // The night street.
    const sky = g.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#0c0c2a');
    sky.addColorStop(1, '#3a2a5a');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    for (const [x, y] of stars) {
      g.fillStyle = (x + Math.floor(t * 2)) % 7 ? '#8a8ac8' : '#ffffff';
      g.fillRect(x, y, 1, 1);
    }
    // (A crescent moon.)
    g.fillStyle = '#f4e9b0';
    g.beginPath();
    g.arc(134, 22, 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#10102e';
    g.beginPath();
    g.arc(137, 20, 5.5, 0, Math.PI * 2);
    g.fill();
    for (const house of houses) {
      const top = GROUND - house.h;
      g.fillStyle = '#1c1636';
      g.fillRect(house.x, top, house.w, house.h);
      g.beginPath();
      g.moveTo(house.x - 2, top);
      g.lineTo(house.x + house.w / 2, top - 10);
      g.lineTo(house.x + house.w + 2, top);
      g.fill();
      house.lit.forEach((on, i) => {
        g.fillStyle = on ? '#f6d36a' : '#2c2650';
        g.fillRect(house.x + 4 + (i % 2) * 9, top + 5 + Math.floor(i / 2) * 9, 5, 5);
      });
    }
    // The pavement.
    g.fillStyle = '#5a5a66';
    g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = '#44444e';
    for (let x = 0; x < W; x += 16) g.fillRect(x, GROUND, 1, H - GROUND);
    g.fillStyle = '#7a7a86';
    g.fillRect(0, GROUND, W, 1);

    for (const it of items) {
      const x = it.x + Math.sin(it.ph) * it.sway;
      if (it.kind === 'stamp' && Math.floor(t * 8) % 2) {
        g.fillStyle = 'rgba(255, 240, 160, .45)';
        g.fillRect(Math.round(x) - 1, Math.round(it.y) - 1, 11, 11);
      }
      g.drawImage(sprite(it.kind), Math.round(x), Math.round(it.y));
    }
    if (state === 'play' || state === 'over') {
      const bob = state === 'play' && (held || (target !== null && Math.abs(target - px) > 1)) ? Math.floor(t * 10) % 2 : 0;
      g.drawImage(sprite('postie'), Math.round(px - 6), GROUND - 16 - bob);
    }
    for (const p of pops) text(p.text, Math.round(p.x), Math.round(p.y - (p.big ? 0 : (0.8 - p.t) * 20)), p.big ? '#f6c83a' : '#ffffff', p.big ? 8 : 6);

    // The scores along the top.
    if (state !== 'title') {
      text(String(score).padStart(6, '0'), 4, 12, '#ffffff', 8);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i < lives ? '#d8343a' : '#3a3a4a';
        g.fillRect(W - 30 + i * 9, 5, 7, 5);
        g.fillRect(W - 29 + i * 9, 10, 5, 1);
        g.fillRect(W - 28 + i * 9, 11, 3, 1);
      }
    }
    if (state === 'title') {
      centre('POST', 54, '#f6c83a', 16);
      centre('RUSH', 74, '#d8343a', 16);
      g.drawImage(sprite('letter'), 40, 92);
      text('10', 54, 99, '#fff', 6);
      g.drawImage(sprite('parcel'), 86, 91);
      text('25', 100, 99, '#fff', 6);
      g.drawImage(sprite('stamp'), 40, 108);
      text('100', 54, 116, '#fff', 6);
      g.drawImage(sprite('bill'), 86, 109);
      text('NO!', 100, 116, '#ff8a8a', 6);
      g.fillStyle = 'rgba(8, 6, 24, .7)';
      g.fillRect(0, 132, W, 34);
      if (Math.floor(t * 2) % 2) centre('PRESS START', 142, '#ffffff', 6);
      const hi = best() || 0;
      if (hi) centre('HI ' + String(hi).padStart(6, '0'), 160, '#8af08a', 6);
    }
    if (state === 'over') {
      g.fillStyle = 'rgba(0, 0, 0, .55)';
      g.fillRect(0, 60, W, 66);
      centre('GAME OVER', 82, '#d8343a', 8);
      centre(String(score), 100, '#ffffff', 8);
      if (newBest && Math.floor(t * 3) % 2) centre('NEW BEST!', 116, '#f6c83a', 6);
      else if (!newBest) centre('PRESS START', 116, '#ffffff', 6);
    }
  };

  const frame = (now) => {
    if (stopped) return;
    // (Gone from the page, a window closed or another part of the site opened: the game stops.)
    if (!cv.isConnected) return stop();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden) {
      step(dt);
      draw(now);
    }
    raf = requestAnimationFrame(frame);
  };
  let last = performance.now();
  raf = requestAnimationFrame(frame);
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };

  // Pointing (a finger or the mouse on the screen): the postie walks there.
  const at = (e) => {
    const r = cv.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  };
  cv.addEventListener('pointerdown', (e) => {
    if (state !== 'play') return press();
    target = at(e);
    cv.setPointerCapture?.(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => state === 'play' && (e.buttons || e.pointerType === 'mouse') && (target = at(e)));

  return {
    stop,
    press,
    // A button or key held down: -1 left, 1 right, 0 let go.
    hold: (d) => {
      held = d;
      if (d) target = null;
    },
    get playing() {
      return state === 'play';
    }
  };
}

// ---------- the arcade corner ----------
function localBest() {
  try {
    return Number(store.getItem(LOCAL)) || 0;
  } catch {
    return 0;
  }
}
function keepLocal(score) {
  try {
    if (score > localBest()) store.setItem(LOCAL, String(score));
  } catch {}
}

// The table: you (signed in) or the site's owner, their friends, and a visitor's own best.
function scoreRows(data) {
  const rows = [];
  const owner = data.site.owner || data.site.name || 'The owner';
  const mine = data.arcade?.scores?.[0];
  if (mine) rows.push({ name: owner, score: mine.score, me: !!data.ownerView });
  const buddies = (data.ownerView ? data.friendsMine?.buddies : data.buddies) || [];
  for (const b of buddies) if (b.arcade?.best) rows.push({ name: b.owner || b.name, score: b.arcade.best, friend: true });
  if (!data.ownerView) {
    const you = localBest();
    if (you) rows.push({ name: 'You', score: you, me: true, local: true });
  }
  return rows.sort((a, b) => b.score - a.score).slice(0, 10);
}
function scoreTable(data) {
  const rows = scoreRows(data);
  return h(
    'section',
    { class: 'arc-scores', 'aria-label': 'High scores' },
    h('h2', { class: 'arc-scores-head' }, 'High scores'),
    rows.length
      ? h(
          'ol',
          { class: 'arc-table' },
          rows.map((r, i) => h('li', { class: 'arc-row' + (r.me ? ' me' : '') }, h('span', { class: 'arc-rank' }, String(i + 1).padStart(2, '0')), h('span', { class: 'arc-name' }, r.name, r.friend ? h('small', null, ' friend') : null), h('span', { class: 'arc-score' }, String(r.score))))
        )
      : h('p', { class: 'arc-none' }, 'No scores yet. Be the first!'),
    h('p', { class: 'arc-note' }, data.ownerView ? 'Your best scores are kept on your site, and your friends see your best on theirs.' : 'Your best is kept in this browser only.')
  );
}

export function arcadeApp(ctx) {
  const { data } = ctx;
  const cv = h('canvas', { class: 'arc-canvas', width: W, height: H, tabindex: '0', 'aria-label': 'Post Rush: catch the letters, parcels and stamps, and leave the red bills. Left and right arrows to move, Space to start.' });
  const table = h('div', { class: 'arc-side' }, scoreTable(data));
  const redraw = () => table.replaceChildren(scoreTable(data));
  const best = () => (data.ownerView ? data.arcade?.scores?.[0]?.score || 0 : localBest());

  const game = postRush(cv, {
    best,
    onOver: async (score) => {
      if (!score) return;
      if (!data.ownerView) {
        keepLocal(score);
        return redraw();
      }
      try {
        const res = await fetch('/admin/api/arcade', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score }) });
        const out = await res.json();
        if (res.ok && out.scores) {
          data.arcade = { scores: out.scores };
          redraw();
        }
      } catch {}
    }
  });

  // The cabinet's own buttons (held for as long as they're pressed) and the keys.
  const pad = (d, label, cls) => {
    const b = h('button', { type: 'button', class: 'arc-btn ' + cls, 'aria-label': label });
    const down = (e) => {
      e.preventDefault();
      if (!game.playing) return game.press();
      game.hold(d);
    };
    b.addEventListener('pointerdown', down);
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => game.hold(0));
    return b;
  };
  const startBtn = h('button', { type: 'button', class: 'arc-btn arc-start', onclick: () => (game.press(), cv.focus()) }, 'Start');
  const keys = { ArrowLeft: -1, ArrowRight: 1, a: -1, d: 1, A: -1, D: 1 };
  const box = h(
    'div',
    { class: 'arcade arc-page' },
    h(
      'div',
      { class: 'arc-cab' },
      h('div', { class: 'arc-marquee', 'aria-hidden': 'true' }, h('span', null, 'Post Rush')),
      h('div', { class: 'arc-bezel' }, cv),
      h('div', { class: 'arc-panel' }, pad(-1, 'Move left', 'arc-left'), h('span', { class: 'arc-stick', 'aria-hidden': 'true' }), startBtn, pad(1, 'Move right', 'arc-right')),
      h('p', { class: 'arc-how' }, 'Catch the post in your satchel. Leave the red bills. Three slips and it’s over.')
    ),
    table
  );
  box.addEventListener('keydown', (e) => {
    if (keys[e.key] !== undefined) {
      e.preventDefault();
      if (!e.repeat) game.hold(keys[e.key]);
    } else if (e.key === ' ' || e.key === 'Enter') {
      if (e.target === startBtn) return;
      e.preventDefault();
      game.press();
    }
  });
  box.addEventListener('keyup', (e) => keys[e.key] !== undefined && game.hold(0));
  return box;
}
