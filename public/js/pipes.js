// Pipes for the screensaver background: shiny tubes that grow through a 3D grid, turning with
// ball joints, in a few colours at once; when the screen is busy they fade and start over.
// Drawn fresh on a canvas, our own take on the old screensaver idea.

// Softer, slightly dusky colours, so the pipes sit behind everything rather than shout.
const COLOURS = [
  [176, 84, 76],
  [78, 120, 180],
  [84, 150, 104],
  [190, 160, 84],
  [140, 100, 170],
  [80, 160, 160],
  [184, 120, 70],
  [168, 172, 184]
];
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const rgb = ([r, g, b], k = 1) => `rgb(${Math.min(255, Math.round(r * k))},${Math.min(255, Math.round(g * k))},${Math.min(255, Math.round(b * k))})`;

export function startPipes(canvas) {
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0;
  let H = 0;
  let cell = 44;
  let nx = 0;
  let ny = 0;
  const nz = 6;
  let used = new Set();
  let pipes = [];
  let drawn = 0;
  let fading = 0;
  let raf = 0;
  let last = 0;
  let restAt = 0; // after fading out, the screen stays clear until this time

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = Math.max(34, Math.min(56, Math.round(Math.min(W, H) / 16)));
    // A little wider and taller than the screen, so the depth shift still covers it.
    nx = Math.ceil(W / cell) + 1;
    ny = Math.ceil(H / cell) + 3;
  };
  // A simple oblique projection gives the pipes depth: further back is up and to the right.
  const project = ([x, y, z]) => [x * cell - z * cell * 0.38, y * cell - z * cell * 0.28];
  const key = (p) => p.join(',');
  const free = (p) => p[0] >= 0 && p[1] >= 0 && p[2] >= 0 && p[0] < nx && p[1] < ny && p[2] < nz && !used.has(key(p));

  const newPipe = () => {
    for (let tries = 0; tries < 40; tries++) {
      const p = [Math.floor(Math.random() * nx), Math.floor(Math.random() * ny), Math.floor(Math.random() * nz)];
      if (!free(p)) continue;
      used.add(key(p));
      const colour = COLOURS[Math.floor(Math.random() * COLOURS.length)];
      const pipe = { p, dir: DIRS[Math.floor(Math.random() * 6)], colour, width: cell * 0.34, alive: true };
      ball(p, pipe, 1.05);
      return pipe;
    }
    return null;
  };

  // A shaded tube segment: dark edges, the colour, a highlight along the top.
  // Further back = dimmer and more see-through, like fog, for a sense of depth.
  const fog = (z) => 0.95 - (z / (nz - 1)) * 0.55;
  const segment = (a, b, pipe) => {
    ctx.globalAlpha = fog((a[2] + b[2]) / 2);
    const [x1, y1] = project(a);
    const [x2, y2] = project(b);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nxv = -dy / len;
    const nyv = dx / len;
    const w = pipe.width;
    const g = ctx.createLinearGradient(x1 + nxv * w / 2, y1 + nyv * w / 2, x1 - nxv * w / 2, y1 - nyv * w / 2);
    g.addColorStop(0, rgb(pipe.colour, 0.35));
    g.addColorStop(0.3, rgb(pipe.colour, 0.85));
    g.addColorStop(0.55, rgb(pipe.colour, 1.22));
    g.addColorStop(0.7, rgb(pipe.colour, 1));
    g.addColorStop(1, rgb(pipe.colour, 0.3));
    ctx.strokeStyle = g;
    ctx.lineWidth = w;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  // A shiny ball joint where the pipe turns.
  const ball = (p, pipe, scale = 1.15) => {
    const [x, y] = project(p);
    ctx.globalAlpha = fog(p[2]);
    const r = (pipe.width / 2) * scale;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, rgb(pipe.colour, 1.55));
    g.addColorStop(0.35, rgb(pipe.colour, 1.1));
    g.addColorStop(1, rgb(pipe.colour, 0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const step = (pipe) => {
    // Mostly carry straight on; sometimes turn.
    let dir = pipe.dir;
    const ahead = pipe.p.map((v, k) => v + dir[k]);
    if (!free(ahead) || Math.random() < 0.22) {
      const options = DIRS.filter((d) => !(d[0] === -dir[0] && d[1] === -dir[1] && d[2] === -dir[2])).filter((d) => free(pipe.p.map((v, k) => v + d[k])));
      if (!options.length) {
        ball(pipe.p, pipe, 1.05);
        pipe.alive = false;
        return;
      }
      const turned = options[Math.floor(Math.random() * options.length)];
      if (turned !== dir) ball(pipe.p, pipe);
      dir = turned;
    }
    const next = pipe.p.map((v, k) => v + dir[k]);
    used.add(key(next));
    segment(pipe.p, next, pipe);
    pipe.p = next;
    pipe.dir = dir;
    drawn++;
  };

  const reset = () => {
    ctx.clearRect(0, 0, W, H);
    used = new Set();
    pipes = [];
    drawn = 0;
  };

  const tick = (t) => {
    raf = requestAnimationFrame(tick);
    if (t - last < 170) return;
    last = t;
    if (restAt && t < restAt) return;
    restAt = 0;
    if (fading) {
      // Fade the whole picture away, then start again.
      ctx.fillStyle = 'rgba(8,12,36,.12)';
      ctx.fillRect(0, 0, W, H);
      if (--fading === 0) {
        reset();
        // A quiet break of 10–15 seconds before the next pipes start growing.
        restAt = t + 10000 + Math.random() * 5000;
      }
      return;
    }
    pipes = pipes.filter((p) => p.alive);
    while (pipes.length < 3) {
      const p = newPipe();
      if (!p) break;
      pipes.push(p);
    }
    pipes.forEach(step);
    if (drawn > nx * ny * nz * 0.14 || !pipes.length) fading = 30;
  };

  resize();
  window.addEventListener('resize', resize);
  if (still) {
    // No animation: draw a finished picture once.
    for (let k = 0; k < 4; k++) pipes.push(newPipe());
    for (let n = 0; n < nx * ny * 0.6; n++) {
      pipes = pipes.filter((p) => p && p.alive);
      if (pipes.length < 4) {
        const p = newPipe();
        if (p) pipes.push(p);
      }
      pipes.forEach(step);
    }
  } else raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}
