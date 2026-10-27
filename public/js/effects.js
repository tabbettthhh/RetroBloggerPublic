// Little moving extras a theme can have, like an old homepage: a trail that follows the mouse
// pointer, and things gently falling (or bubbles rising) over the page. Drawn on one canvas
// that never catches a tap or a click. Nothing moves for visitors who've asked their device
// for less motion, on low-memory devices, or while the page is in the background.

export const TRAILS = { none: 'None', sparkles: 'Sparkles', hearts: 'Hearts', stars: 'Stars', bubbles: 'Bubbles', rainbow: 'Rainbow', pixels: 'Pixel dust' };
export const FALLING = { none: 'Nothing', snow: 'Snow', petals: 'Petals', hearts: 'Hearts', stars: 'Stars', leaves: 'Leaves', confetti: 'Confetti', bubbles: 'Bubbles (rising)', sunshine: 'Sunshine' };

const RAINBOW = ['#ff5f6d', '#ffb347', '#ffe66d', '#7ee081', '#4facfe', '#a974ff'];
const PALETTES = {
  snow: ['#ffffff', '#eef6ff', '#dcecff'],
  petals: ['#ffc4d6', '#ffb0c8', '#ffd6e4', '#fbe0ea'],
  hearts: ['#ff6b9a', '#ff8fb1', '#ff4f81', '#ffc2d4'],
  stars: ['#ffe066', '#fff3a8', '#ffd23f'],
  leaves: ['#e8833a', '#d9622b', '#f2b134', '#b5562b', '#9c7a2d'],
  sunshine: ['#ffd36b', '#ffe9a8', '#ffc24a', '#fff4cf'],
  bubbles: null,
  sparkles: null,
  pixels: null,
  rainbow: RAINBOW,
  confetti: null
};

let state = null;

export function stopEffects() {
  if (!state) return;
  cancelAnimationFrame(state.raf);
  state.off.forEach((f) => f());
  state.canvas.remove();
  state = null;
}

// Starts (or changes, or stops) the effects for a theme: t.trail, t.falling, and the theme's
// colours (for confetti and pixel dust).
export function startEffects(t, doc = document) {
  const win = doc.defaultView;
  const want = { trail: TRAILS[t.trail] && t.trail !== 'none' ? t.trail : null, falling: FALLING[t.falling] && t.falling !== 'none' ? t.falling : null };
  const calm = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches || doc.documentElement.classList.contains('lite');
  const fine = win.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  if (!fine) want.trail = null;
  // (The seasons are gentler: fewer, fainter, slower.)
  const gentle = !!t.gentle;
  const sig = JSON.stringify([want, t.main, t.accent, gentle]);
  if (state?.sig === sig && state.doc === doc) return;
  stopEffects();
  if (calm || (!want.trail && !want.falling)) return;

  const canvas = doc.createElement('canvas');
  canvas.className = 'fx-layer';
  canvas.setAttribute('aria-hidden', 'true');
  doc.body.append(canvas);
  const g = canvas.getContext('2d');
  if (!g) return canvas.remove();
  const theme = [t.main, t.accent, '#ffffff', mixHex(t.main, '#ffffff', 0.5), mixHex(t.accent, '#ffffff', 0.4)];
  const S = (state = { sig, doc, canvas, raf: 0, off: [], bits: [], falling: [], want, theme, gentle, w: 0, h: 0, ratio: 1, last: 0 });
  // Sunshine: a soft warm light from the top corner, and specks of light drifting in it.
  if (want.falling === 'sunshine') canvas.style.background = `radial-gradient(circle at 96% 0%, rgba(255, 214, 120, ${gentle ? 0.16 : 0.24}), rgba(255, 214, 120, 0) ${gentle ? 34 : 42}%)`;

  const size = () => {
    S.ratio = Math.min(2, win.devicePixelRatio || 1);
    S.w = win.innerWidth;
    S.h = win.innerHeight;
    canvas.width = S.w * S.ratio;
    canvas.height = S.h * S.ratio;
    if (!want.falling) return;
    // Fewer on small screens, never a blizzard.
    const count = Math.round(Math.min(42, Math.max(14, (S.w * S.h) / 30000)) * (S.gentle ? 0.5 : 1));
    while (S.falling.length < count) S.falling.push(newFaller(S, true));
    S.falling.length = count;
  };
  size();
  const onResize = () => size();
  win.addEventListener('resize', onResize);
  S.off.push(() => win.removeEventListener('resize', onResize));

  if (want.trail) {
    let lastX = -1;
    let lastY = -1;
    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (dx * dx + dy * dy < 90) return;
      lastX = e.clientX;
      lastY = e.clientY;
      if (S.bits.length < 70) S.bits.push(newBit(S, e.clientX, e.clientY));
      wake();
    };
    win.addEventListener('pointermove', onMove, { passive: true });
    S.off.push(() => win.removeEventListener('pointermove', onMove));
  }
  // Paused while the page is in the background (another tab, the phone locked), and started again
  // when it's back. (It used to stay paused: the loop thought it was still running.)
  const onVis = () => {
    if (doc.hidden) {
      cancelAnimationFrame(S.raf);
      running = false;
    } else wake();
  };
  doc.addEventListener('visibilitychange', onVis);
  win.addEventListener('pageshow', onVis);
  win.addEventListener('focus', onVis);
  S.off.push(() => {
    doc.removeEventListener('visibilitychange', onVis);
    win.removeEventListener('pageshow', onVis);
    win.removeEventListener('focus', onVis);
  });
  // A safety net: if frames ever stop coming while things should be falling, start again.
  const watchdog = win.setInterval(() => {
    if (!doc.hidden && S.want.falling && performance.now() - S.last > 1500) {
      running = false;
      wake();
    }
  }, 2000);
  S.off.push(() => win.clearInterval(watchdog));

  let running = false;
  function wake() {
    if (running || doc.hidden || state !== S) return;
    // (Put back if anything took it off the page.)
    if (!canvas.isConnected) doc.body.append(canvas);
    running = true;
    S.last = performance.now();
    S.raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    if (state !== S) return;
    const dt = Math.min(50, now - S.last) / 16.7;
    S.last = now;
    g.setTransform(S.ratio, 0, 0, S.ratio, 0, 0);
    g.clearRect(0, 0, S.w, S.h);
    if (S.want.falling) {
      for (const f of S.falling) {
        stepFaller(S, f, dt, now);
        const a = S.want.falling === 'sunshine' ? f.alpha * (0.45 + 0.55 * Math.abs(Math.sin(now / 900 + f.phase))) : f.alpha;
        draw(g, S.want.falling, f.x, f.y, f.r, f.rot, f.colour, a, f.flip);
      }
    }
    for (let i = S.bits.length - 1; i >= 0; i--) {
      const b = S.bits[i];
      b.life -= dt;
      if (b.life <= 0) {
        S.bits.splice(i, 1);
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += (S.want.trail === 'bubbles' ? -0.02 : 0.03) * dt;
      b.rot += b.spin * dt;
      draw(g, S.want.trail, b.x, b.y, b.r * (0.4 + 0.6 * (b.life / b.max)), b.rot, b.colour, Math.min(1, b.life / (b.max * 0.5)), 1);
    }
    if (S.want.falling || S.bits.length) S.raf = requestAnimationFrame(frame);
    else {
      running = false;
      g.clearRect(0, 0, S.w, S.h);
    }
  }
  wake();
  // (Stopped and started again with the theme; the canvas never outlives it.)
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
function colourFor(S, kind) {
  // (Some take the theme's own colours, so they show on pale pages too.)
  if (kind === 'confetti') return pick([...S.theme, ...RAINBOW]);
  if (kind === 'pixels') return pick(S.theme);
  if (kind === 'sparkles') return pick([S.theme[0], S.theme[1], '#ffc83d', '#ff7ac6']);
  if (kind === 'bubbles') return pick([S.theme[0], S.theme[1], S.theme[3]]);
  return pick(PALETTES[kind] || ['#ffffff']);
}
function newFaller(S, anywhere) {
  const kind = S.want.falling;
  const rising = kind === 'bubbles' || kind === 'sunshine';
  const big = { snow: [2, 4.5], petals: [5, 8], hearts: [5, 9], stars: [4, 8], leaves: [6, 10], confetti: [3, 6], bubbles: [4, 11], sunshine: [1.2, 2.8] }[kind] || [3, 6];
  const calm = (S.gentle ? 0.7 : 1) * (kind === 'sunshine' ? 0.35 : 1);
  return {
    x: Math.random() * S.w,
    y: anywhere ? Math.random() * S.h : rising ? S.h + 20 : -20,
    r: big[0] + Math.random() * (big[1] - big[0]),
    speed: (rising ? -1 : 1) * (0.35 + Math.random() * 0.6) * (kind === 'snow' ? 0.8 : 1) * calm,
    sway: 0.4 + Math.random() * 1.2,
    phase: Math.random() * Math.PI * 2,
    rot: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.04,
    colour: colourFor(S, kind),
    alpha: (kind === 'snow' ? 0.65 + Math.random() * 0.3 : kind === 'bubbles' ? 0.55 : kind === 'sunshine' ? 0.5 + Math.random() * 0.4 : 0.8) * (S.gentle ? 0.75 : 1),
    flip: 1
  };
}
function stepFaller(S, f, dt, now) {
  f.y += f.speed * dt;
  f.x += Math.sin(now / 1400 + f.phase) * 0.35 * f.sway * dt;
  f.rot += f.spin * dt;
  f.flip = S.want.falling === 'confetti' || S.want.falling === 'petals' || S.want.falling === 'leaves' ? Math.cos(now / 500 + f.phase) : 1;
  if (f.y > S.h + 24 || f.y < -30 || f.x < -30 || f.x > S.w + 30) Object.assign(f, newFaller(S, false));
}
function newBit(S, x, y) {
  const kind = S.want.trail;
  const max = 26 + Math.random() * 18;
  return { x, y, vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.7) * 1.1, r: kind === 'pixels' ? 3 : 5 + Math.random() * 4, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.15, colour: colourFor(S, kind), life: max, max };
}

// One shape, centred on x, y.
function draw(g, kind, x, y, r, rot, colour, alpha, flip) {
  g.save();
  g.globalAlpha = Math.max(0, Math.min(1, alpha));
  g.translate(x, y);
  g.rotate(rot);
  g.scale(1, flip || 1);
  g.fillStyle = colour;
  g.strokeStyle = colour;
  switch (kind) {
    case 'snow':
      // (A soft edge, so a flake shows on a white page as well as a dark one.)
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 0.9;
      g.strokeStyle = 'rgba(110, 140, 190, .55)';
      g.stroke();
      break;
    case 'bubbles':
      g.lineWidth = 1.3;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha *= 0.8;
      g.beginPath();
      g.arc(-r * 0.35, -r * 0.35, r * 0.22, 0, Math.PI * 2);
      g.fill();
      break;
    case 'petals':
      g.beginPath();
      g.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case 'leaves':
      g.beginPath();
      g.moveTo(0, -r);
      g.quadraticCurveTo(r * 0.9, 0, 0, r);
      g.quadraticCurveTo(-r * 0.9, 0, 0, -r);
      g.fill();
      g.strokeStyle = 'rgba(80, 40, 10, .35)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(0, -r);
      g.lineTo(0, r);
      g.stroke();
      break;
    case 'hearts':
      g.beginPath();
      g.moveTo(0, r * 0.35);
      g.bezierCurveTo(-r * 1.1, -r * 0.4, -r * 0.45, -r * 1.05, 0, -r * 0.4);
      g.bezierCurveTo(r * 0.45, -r * 1.05, r * 1.1, -r * 0.4, 0, r * 0.35);
      g.fill();
      break;
    case 'stars':
    case 'sparkles':
      if (kind === 'sparkles') {
        g.beginPath();
        for (let i = 0; i < 4; i++) {
          g.rotate(Math.PI / 2);
          g.moveTo(0, 0);
          g.quadraticCurveTo(r * 0.18, -r * 0.18, 0, -r);
          g.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, 0);
        }
        g.fill();
      } else {
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          const rr = i % 2 ? r * 0.45 : r;
          g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
      }
      break;
    case 'sunshine':
      g.shadowColor = colour;
      g.shadowBlur = r * 4;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      break;
    case 'rainbow':
      g.beginPath();
      g.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      g.fill();
      break;
    case 'confetti':
      g.fillRect(-r, -r * 0.45, r * 2, r * 0.9);
      break;
    case 'pixels':
      g.fillRect(-r, -r, r * 2, r * 2);
      break;
  }
  g.restore();
}

function mixHex(a, b, k) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(String(h || '#888888').slice(i, i + 2), 16) || 0);
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}
