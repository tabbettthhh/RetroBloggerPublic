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
  { id: 'sepia', name: 'Sepia', note: 'Old print' }
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
  sepia: { sepia: true, r: curve([[0, 20], [128, 136], [255, 240]]), grain: 12, vignette: 0.35 }
};

// Draws `source` (an image, bitmap or canvas) into a new canvas no bigger than `max` px,
// with the filter applied. `seed` keeps the grain and light leak the same between sizes.
export function filtered(source, id, { max = 2000, seed = 1, date = '' } = {}) {
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
