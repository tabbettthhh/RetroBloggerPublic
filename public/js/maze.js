// The maze screensaver: a slow walk through brick corridors, with your photos hung on the walls in
// frames, each with a little plaque. The maze is new every time; the walk keeps one hand on the
// wall, so it wanders everywhere. Drawn here on a canvas, small and then scaled up (it's meant to
// look a little blocky), and stopped the moment anything moves. Only photos already on the page
// for this visitor are hung. Every drawing is the site's own.

const TEX = 64;

// ---------- a new maze ----------
// Cells on a grid, carved by a wander that never crosses itself; walls are whole tiles.
function carve(cw, ch) {
  const W = cw * 2 + 1;
  const H = ch * 2 + 1;
  const map = Array.from({ length: H }, () => new Array(W).fill(1));
  const seen = new Set();
  const stack = [[0, 0]];
  seen.add('0,0');
  map[1][1] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cw && ny < ch && !seen.has(`${nx},${ny}`));
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [nx, ny] = next[Math.floor(Math.random() * next.length)];
    seen.add(`${nx},${ny}`);
    map[y * 2 + 1 + (ny - y)][x * 2 + 1 + (nx - x)] = 0;
    map[ny * 2 + 1][nx * 2 + 1] = 0;
    stack.push([nx, ny]);
  }
  return map;
}

// ---------- the walls' pictures ----------
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function bricks() {
  const c = canvas(TEX, TEX);
  const g = c.getContext('2d');
  g.fillStyle = '#8f8a80';
  g.fillRect(0, 0, TEX, TEX);
  const rows = 8;
  const bh = TEX / rows;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? TEX / 4 : 0;
    for (let x = -TEX / 4; x < TEX; x += TEX / 2) {
      const shade = 120 + ((r * 7 + x) % 5) * 9;
      g.fillStyle = `rgb(${shade + 40}, ${shade - 50}, ${shade - 70})`;
      g.fillRect(x + off + 1, r * bh + 1, TEX / 2 - 2, bh - 2);
      g.fillStyle = 'rgba(255,255,255,.12)';
      g.fillRect(x + off + 1, r * bh + 1, TEX / 2 - 2, 1);
    }
  }
  return c;
}
// A frame on the bricks, the photo cropped to fill it, and a plaque with its title.
function framed(wall, img, title) {
  const S = 128;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(wall, 0, 0, S, S);
  const fx = 22;
  const fy = 14;
  const fw = S - fx * 2;
  const fh = 74;
  g.fillStyle = '#5a3a1e';
  g.fillRect(fx - 7, fy - 7, fw + 14, fh + 14);
  g.fillStyle = '#c9a227';
  g.fillRect(fx - 3, fy - 3, fw + 6, fh + 6);
  const r = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
  const sw = fw / r;
  const sh = fh / r;
  g.imageSmoothingEnabled = true;
  try {
    g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, fx, fy, fw, fh);
  } catch {
    g.fillStyle = '#dbe9f4';
    g.fillRect(fx, fy, fw, fh);
  }
  if (title) {
    g.fillStyle = '#e8dcb5';
    g.fillRect(30, 100, S - 60, 14);
    g.strokeStyle = '#5a3a1e';
    g.strokeRect(30.5, 100.5, S - 61, 13);
    g.fillStyle = '#2a1a0a';
    g.font = '9px Arimo, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(title.length > 20 ? title.slice(0, 19) + '…' : title, S / 2, 107.5, S - 66);
  }
  return c;
}

// ---------- the walk ----------
export function startMaze(cv, photos = []) {
  const g = cv.getContext('2d');
  const map = carve(9, 9);
  const H = map.length;
  const W = map[0].length;
  const wall = bricks();
  // Which wall tiles hang a picture: (x, y) → texture. Only walls facing a corridor.
  const hung = new Map();
  const spots = [];
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) if (map[y][x] === 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map[y + dy]?.[x + dx] === 0)) spots.push([x, y]);
  spots.sort(() => Math.random() - 0.5);
  const list = photos.slice(0, 16);
  list.forEach((p, i) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      // (Each photo hangs in several places, about one wall in three, so you keep passing them.)
      const t = framed(wall, img, p.title);
      for (let k = i; k < spots.length; k += list.length * 3) hung.set(`${spots[k][0]},${spots[k][1]}`, t);
    };
    img.src = p.src;
  });

  // Where you are and which way you face; you keep a hand on the left wall.
  let px = 1.5;
  let py = 1.5;
  let ang = 0;
  let face = 0; // 0 east, 1 south, 2 west, 3 north
  let target = null;
  let turnTo = null;
  const D = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const open = (x, y) => map[y]?.[x] === 0;
  const plan = () => {
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    for (const t of [3, 0, 1, 2]) {
      const f = (face + t) % 4;
      if (open(cx + D[f][0], cy + D[f][1])) {
        if (f !== face) turnTo = { face: f, ang: ang + [0, Math.PI / 2, Math.PI, -Math.PI / 2][t] };
        face = f;
        target = [cx + D[f][0] + 0.5, cy + D[f][1] + 0.5];
        return;
      }
    }
  };

  let raf = 0;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Turn first, then walk.
    if (turnTo) {
      const d = turnTo.ang - ang;
      const step = Math.sign(d) * Math.min(Math.abs(d), dt * 1.6);
      ang += step;
      if (Math.abs(turnTo.ang - ang) < 1e-3) {
        ang = turnTo.ang;
        turnTo = null;
      }
    } else {
      if (!target) plan();
      const dx = target[0] - px;
      const dy = target[1] - py;
      const dist = Math.hypot(dx, dy);
      const step = dt * 1.1;
      if (dist <= step) {
        px = target[0];
        py = target[1];
        target = null;
      } else {
        px += (dx / dist) * step;
        py += (dy / dist) * step;
      }
    }
    draw();
    raf = requestAnimationFrame(frame);
  };

  // ---------- the picture: one column of wall at a time ----------
  const draw = () => {
    g.imageSmoothingEnabled = false;
    const w = cv.width;
    const h = cv.height;
    const sky = g.createLinearGradient(0, 0, 0, h / 2);
    sky.addColorStop(0, '#1a1f3a');
    sky.addColorStop(1, '#4a4f6a');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h / 2);
    const floor = g.createLinearGradient(0, h / 2, 0, h);
    floor.addColorStop(0, '#3a3530');
    floor.addColorStop(1, '#8a7f70');
    g.fillStyle = floor;
    g.fillRect(0, h / 2, w, h / 2);
    const fov = Math.PI / 3;
    const dirX = Math.cos(ang);
    const dirY = Math.sin(ang);
    const plX = -dirY * Math.tan(fov / 2);
    const plY = dirX * Math.tan(fov / 2);
    for (let col = 0; col < w; col++) {
      const camX = (2 * col) / w - 1;
      const rx = dirX + plX * camX;
      const ry = dirY + plY * camX;
      let mx = Math.floor(px);
      let my = Math.floor(py);
      const ddx = Math.abs(1 / rx);
      const ddy = Math.abs(1 / ry);
      const sx = rx < 0 ? -1 : 1;
      const sy = ry < 0 ? -1 : 1;
      let sdx = (rx < 0 ? px - mx : mx + 1 - px) * ddx;
      let sdy = (ry < 0 ? py - my : my + 1 - py) * ddy;
      let side = 0;
      for (let n = 0; n < 64; n++) {
        if (sdx < sdy) {
          sdx += ddx;
          mx += sx;
          side = 0;
        } else {
          sdy += ddy;
          my += sy;
          side = 1;
        }
        if (map[my]?.[mx] !== 0) break;
      }
      const dist = side === 0 ? sdx - ddx : sdy - ddy;
      const lineH = Math.min(h * 8, h / Math.max(dist, 0.01));
      const top = (h - lineH) / 2;
      let hit = side === 0 ? py + dist * ry : px + dist * rx;
      hit -= Math.floor(hit);
      if ((side === 0 && rx < 0) || (side === 1 && ry > 0)) hit = 1 - hit;
      const tex = hung.get(`${mx},${my}`) || wall;
      const tx = Math.min(tex.width - 1, Math.floor(hit * tex.width));
      g.drawImage(tex, tx, 0, 1, tex.height, col, top, 1, lineH);
      // Shade the far walls, and one side a little darker.
      const dark = Math.min(0.75, dist / 9) + (side ? 0.12 : 0);
      if (dark > 0.02) {
        g.fillStyle = `rgba(10, 8, 20, ${dark})`;
        g.fillRect(col, top, 1, lineH);
      }
    }
  };

  const size = () => {
    // Small, then stretched: quick on any computer, and a little blocky, as it should be.
    const scale = Math.min(1, 420 / innerWidth);
    cv.width = Math.max(200, Math.round(innerWidth * scale));
    cv.height = Math.max(120, Math.round(innerHeight * scale));
  };
  size();
  addEventListener('resize', size);
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', size);
  };
}
