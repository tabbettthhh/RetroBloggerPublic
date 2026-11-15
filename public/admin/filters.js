// Photo filters for the back office. Each one is drawn into the picture's pixels before
// upload, so the uploaded file is still a plain JPEG with no hidden data.
// Everything is done by hand on the pixels, so it looks the same in every browser.

export const FILTERS = [
  { id: 'none', name: 'Original' },
  { id: 'digicam', name: "Digicam '05", note: 'Bright, a bit soft, orange date stamp' },
  { id: 'disposable', name: 'Disposable', note: 'Warm film, light leak, grain' },
  { id: 'grunge', name: 'Grunge', note: 'Gritty, faded, scratched' },
  { id: 'flipphone', name: 'Flip phone', note: 'Low-res camera phone' },
  { id: 'bw', name: 'Black & white', note: 'Contrasty, fine grain' },
  { id: 'instant', name: 'Instant', note: 'Soft, creamy, faded' },
  { id: 'lomo', name: 'Lomo', note: 'Punchy colour, dark corners' },
  { id: 'sepia', name: 'Sepia', note: 'Old print' },
  { id: 'stainedglass', name: 'Stained glass', note: 'Jewel-coloured panes, leaded like a church window, lit from behind' }
];

// Small, repeatable random numbers so a preview and the final photo match.
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

// A tone curve through (in, out) points, as a lookup table.
function curve(points) {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    let k = 0;
    while (k < points.length - 2 && i > points[k + 1][0]) k++;
    const [x0, y0] = points[k];
    const [x1, y1] = points[k + 1];
    const t = x1 === x0 ? 0 : (i - x0) / (x1 - x0);
    const s = t * t * (3 - 2 * t); // smooth between points
    lut[i] = y0 + (y1 - y0) * (0.5 * t + 0.5 * s);
  }
  return lut;
}
const IDENT = curve([[0, 0], [255, 255]]);

// What each filter does, as numbers.
const LOOKS = {
  digicam: { lowres: 1280, sat: 1.28, r: curve([[0, 6], [128, 132], [255, 255]]), g: curve([[0, 4], [128, 130], [255, 252]]), b: curve([[0, 10], [128, 134], [255, 255]]), chroma: 9, grain: 4, vignette: 0.12, bloom: 0.18, stamp: true },
  disposable: { sat: 1.12, r: curve([[0, 28], [90, 100], [180, 200], [255, 250]]), g: curve([[0, 22], [128, 132], [255, 240]]), b: curve([[0, 30], [128, 118], [255, 215]]), grain: 18, vignette: 0.38, leak: true },
  grunge: { sat: 0.38, r: curve([[0, 12], [70, 50], [190, 200], [255, 236]]), g: curve([[0, 14], [70, 54], [190, 204], [255, 238]]), b: curve([[0, 10], [70, 42], [190, 178], [255, 210]]), grain: 30, vignette: 0.6, dust: true },
  flipphone: { lowres: 480, sat: 0.92, r: curve([[0, 14], [128, 140], [255, 255]]), g: curve([[0, 18], [128, 146], [255, 255]]), b: curve([[0, 12], [128, 130], [255, 240]]), chroma: 16, grain: 6, vignette: 0.28 },
  bw: { mono: true, r: curve([[0, 8], [60, 40], [128, 128], [200, 218], [255, 250]]), grain: 14, vignette: 0.25 },
  instant: { sat: 0.86, r: curve([[0, 40], [128, 140], [255, 246]]), g: curve([[0, 46], [128, 138], [255, 238]]), b: curve([[0, 58], [128, 132], [255, 216]]), grain: 7, vignette: 0.2 },
  lomo: { sat: 1.45, r: curve([[0, 0], [70, 52], [190, 214], [255, 255]]), g: curve([[0, 0], [70, 58], [190, 210], [255, 250]]), b: curve([[0, 24], [128, 120], [255, 200]]), grain: 8, vignette: 0.75 },
  sepia: { sepia: true, r: curve([[0, 20], [128, 136], [255, 240]]), grain: 12, vignette: 0.35 },
  stainedglass: { glass: true }
};

// Stained glass: the picture cut into panes (each the photo's own colour there, made rich like
// coloured glass and glowing brighter at its middle, as if lit from behind), with dark lead
// between them and a ripple in the glass. Panes are found by nearest point on a jittered grid
// (only the nine nearby squares are looked at, so it's quick even on a big photo).
function stainedGlass(ctx, w, hgt, rand) {
  const img = ctx.getImageData(0, 0, w, hgt);
  const d = img.data;
  // About 26 panes across, whatever the size, so a preview and the real photo match.
  const cell = Math.max(6, Math.max(w, hgt) / 26);
  const gw = Math.ceil(w / cell) + 1;
  const gh = Math.ceil(hgt / cell) + 1;
  const sx = new Float32Array(gw * gh);
  const sy = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const k = j * gw + i;
    sx[k] = (i + 0.15 + rand() * 0.7) * cell;
    sy[k] = (j + 0.15 + rand() * 0.7) * cell;
  }
  const near = new Int32Array(w * hgt);
  const edge = new Float32Array(w * hgt);
  const sum = new Float64Array(gw * gh * 4);
  for (let y = 0; y < hgt; y++) {
    const cj = Math.floor(y / cell);
    for (let x = 0; x < w; x++) {
      const ci = Math.floor(x / cell);
      let b1 = Infinity;
      let b2 = Infinity;
      let k1 = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const j = cj + dj;
        if (j < 0 || j >= gh) continue;
        for (let di = -1; di <= 1; di++) {
          const i = ci + di;
          if (i < 0 || i >= gw) continue;
          const k = j * gw + i;
          const ddx = sx[k] - x;
          const ddy = sy[k] - y;
          const dd = ddx * ddx + ddy * ddy;
          if (dd < b1) {
            b2 = b1;
            b1 = dd;
            k1 = k;
          } else if (dd < b2) b2 = dd;
        }
      }
      const p = y * w + x;
      near[p] = k1;
      edge[p] = Math.sqrt(b2) - Math.sqrt(b1);
      const q = p * 4;
      sum[k1 * 4] += d[q];
      sum[k1 * 4 + 1] += d[q + 1];
      sum[k1 * 4 + 2] += d[q + 2];
      sum[k1 * 4 + 3] += 1;
    }
  }
  // Each pane's colour: the photo's own, richer and a little brighter, like coloured glass.
  const pane = new Float32Array(gw * gh * 3);
  for (let k = 0; k < gw * gh; k++) {
    const n = sum[k * 4 + 3] || 1;
    let r = sum[k * 4] / n;
    let g = sum[k * 4 + 1] / n;
    let b = sum[k * 4 + 2] / n;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    r = l + (r - l) * 1.9;
    g = l + (g - l) * 1.9;
    b = l + (b - l) * 1.9;
    // (Very dull panes lean towards the deep blues and ambers of old windows.)
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (spread < 24) {
      const warm = rand() < 0.5;
      r += warm ? 34 : -18;
      g += warm ? 14 : -6;
      b += warm ? -26 : 40;
    }
    pane[k * 3] = clamp(r * 1.08 + 10);
    pane[k * 3 + 1] = clamp(g * 1.08 + 10);
    pane[k * 3 + 2] = clamp(b * 1.08 + 10);
  }
  const lead = Math.max(1.4, cell * 0.11);
  const u = cell;
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const q = p * 4;
      const k = near[p];
      const e = edge[p];
      if (e < lead) {
        // The lead: dark, with a faint shine along its middle.
        const t = e / lead;
        const shine = 26 * Math.max(0, 1 - Math.abs(t - 0.5) * 4);
        d[q] = d[q + 1] = 22 + shine;
        d[q + 2] = 18 + shine;
        continue;
      }
      // Lit from behind: brighter in the middle of each pane, and a gentle ripple in the glass.
      const ddx = sx[k] - x;
      const ddy = sy[k] - y;
      const glow = 1.18 - Math.min(0.42, Math.sqrt(ddx * ddx + ddy * ddy) / u * 0.5);
      const ripple = 1 + 0.06 * Math.sin((x + y * 0.6) / (u * 0.13) + k);
      const f = glow * ripple * (e < lead * 2.2 ? 0.86 : 1);
      d[q] = clamp(pane[k * 3] * f);
      d[q + 1] = clamp(pane[k * 3 + 1] * f);
      d[q + 2] = clamp(pane[k * 3 + 2] * f);
    }
  }
  ctx.putImageData(img, 0, 0);
  // The window's own glow, a little darker at its edges.
  const v = ctx.createRadialGradient(w / 2, hgt / 2, Math.min(w, hgt) * 0.2, w / 2, hgt / 2, Math.max(w, hgt) * 0.75);
  v.addColorStop(0, 'rgba(255,240,200,0.10)');
  v.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, hgt);
}

// Draws `source` (an image, bitmap or canvas) into a new canvas no bigger than `max` px,
// with the filter applied. `seed` keeps the grain and light leak the same between sizes.
export function filtered(source, id, { max = 2000, seed = 1, date = '', strength = 1 } = {}) {
  const out = filteredFull(source, id, { max, seed, date });
  // (Less than full strength: the photo as it was, showing through.)
  const k = Math.max(0, Math.min(1, Number(strength)));
  if (!LOOKS[id] || !(k < 1)) return out;
  const ctx = out.getContext('2d');
  ctx.save();
  ctx.globalAlpha = 1 - k;
  ctx.drawImage(source, 0, 0, out.width, out.height);
  ctx.restore();
  return out;
}
function filteredFull(source, id, { max = 2000, seed = 1, date = '' } = {}) {
  const sw = source.width;
  const sh = source.height;
  const scale = Math.min(1, max / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const hgt = Math.max(1, Math.round(sh * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hgt;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const look = LOOKS[id];
  if (!look) {
    ctx.drawImage(source, 0, 0, w, hgt);
    return c;
  }
  const rand = rng(seed);
  if (look.glass) {
    ctx.drawImage(source, 0, 0, w, hgt);
    stainedGlass(ctx, w, hgt, rand);
    return c;
  }

  // Low resolution: draw small, then stretch back up (soft, like an old sensor). The amount is
  // relative to a full-size 2000px photo, so previews look the same as the real thing.
  if (look.lowres) {
    const k = look.lowres / 2000;
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(w * k));
    t.height = Math.max(1, Math.round(hgt * k));
    t.getContext('2d').drawImage(source, 0, 0, t.width, t.height);
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(t, 0, 0, w, hgt);
  } else {
    ctx.drawImage(source, 0, 0, w, hgt);
  }

  const img = ctx.getImageData(0, 0, w, hgt);
  const d = img.data;
  const R = look.r || IDENT;
  const G = look.g || look.r || IDENT;
  const B = look.b || look.r || IDENT;
  const sat = look.sat ?? 1;
  // Grain is drawn in blocks that grow with the picture, so it looks alike at every size.
  const block = Math.max(1, Math.round(Math.max(w, hgt) / 900));
  const bw = Math.ceil(w / block);
  const bh = Math.ceil(hgt / block);
  const grainAmt = look.grain || 0;
  const chromaAmt = look.chroma || 0;
  const noise = new Float32Array(bw * bh * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = rand() * 2 - 1;
  const cx = w / 2;
  const cy = hgt / 2;
  const maxD = cx * cx + cy * cy;
  const vig = look.vignette || 0;

  for (let y = 0; y < hgt; y++) {
    const by = ((y / block) | 0) * bw;
    const dy = (y - cy) * (y - cy);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];
      if (look.mono || look.sepia) {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = g = b = l;
        if (look.sepia) {
          r = l * 1.07 + 18;
          g = l * 0.95 + 6;
          b = l * 0.78;
        }
      } else if (sat !== 1) {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = l + (r - l) * sat;
        g = l + (g - l) * sat;
        b = l + (b - l) * sat;
      }
      r = R[clamp(r) | 0];
      g = G[clamp(g) | 0];
      b = B[clamp(b) | 0];
      if (vig) {
        const f = 1 - vig * (((x - cx) * (x - cx) + dy) / maxD) ** 1.15;
        r *= f;
        g *= f;
        b *= f;
      }
      if (grainAmt || chromaAmt) {
        const n = (by + ((x / block) | 0)) * 3;
        const mono = noise[n] * grainAmt;
        r += mono + noise[n + 1] * chromaAmt;
        g += mono + noise[n + 2] * chromaAmt * 0.7;
        b += mono - noise[n + 1] * chromaAmt;
      }
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
  }
  ctx.putImageData(img, 0, 0);

  // A soft glow on the highlights, like a cheap lens.
  if (look.bloom) {
    ctx.save();
    ctx.globalAlpha = look.bloom;
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = `blur(${Math.max(2, w / 160)}px)`;
    if (ctx.filter && ctx.filter !== 'none') ctx.drawImage(c, 0, 0);
    ctx.restore();
  }

  // A light leak: orange and red glow creeping in from one edge.
  if (look.leak) {
    const corner = [[0, 0], [w, 0], [0, hgt], [w, hgt]][(rand() * 4) | 0];
    const g1 = ctx.createRadialGradient(corner[0], corner[1], 0, corner[0], corner[1], Math.max(w, hgt) * 0.75);
    g1.addColorStop(0, 'rgba(255,120,40,0.65)');
    g1.addColorStop(0.35, 'rgba(255,70,40,0.28)');
    g1.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, hgt);
    ctx.restore();
  }

  // Dust and scratches.
  if (look.dust) {
    const u = Math.max(w, hgt) / 1000;
    ctx.save();
    for (let k = 0; k < 70; k++) {
      ctx.fillStyle = rand() < 0.6 ? `rgba(255,255,240,${0.25 + rand() * 0.4})` : `rgba(10,10,10,${0.25 + rand() * 0.4})`;
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * hgt, (0.6 + rand() * 1.8) * u, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = Math.max(0.6, 0.9 * u);
    for (let k = 0; k < 7; k++) {
      const x = rand() * w;
      ctx.strokeStyle = `rgba(240,240,225,${0.12 + rand() * 0.22})`;
      ctx.beginPath();
      ctx.moveTo(x, rand() * hgt * 0.3);
      ctx.bezierCurveTo(x + (rand() - 0.5) * 20 * u, hgt * 0.4, x + (rand() - 0.5) * 20 * u, hgt * 0.7, x + (rand() - 0.5) * 30 * u, hgt * (0.7 + rand() * 0.3));
      ctx.stroke();
    }
    ctx.restore();
  }

  // The orange date stamp in the corner, like a 2000s digital camera.
  if (look.stamp && date) {
    const size = Math.max(10, Math.round(Math.min(w, hgt) * 0.055));
    ctx.save();
    ctx.font = `${size}px 'Share Tech Mono', 'Courier New', monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(255,110,0,0.85)';
    ctx.shadowBlur = size * 0.35;
    ctx.fillStyle = '#ffa23a';
    ctx.fillText(date, w - size * 0.8, hgt - size * 0.6);
    ctx.restore();
  }
  return c;
}

// "2026-10-22 18:30" → "'26 10 22", the way those cameras printed it.
export function stampDateText(dateStr) {
  const m = /^(\d{2})(\d{2})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  return m ? `'${m[2]} ${m[3]} ${m[4]}` : '';
}
