// Removes every piece of hidden data from a photo: EXIF (camera, date, GPS location),
// XMP, IPTC, comments, colour profiles, thumbnails, and anything tacked on after the
// picture. Only what is needed to draw the image is kept.
//
// The back office already re-draws every photo before upload, which drops all of this.
// This is the safety net: it runs again on every upload and on every photo the site
// serves, so a photo that reached the bucket some other way is cleaned too.

export class UnsupportedImage extends Error {}

export function imageKind(bytes) {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
  if (ascii(b, 0, 4) === 'GIF8') return 'gif';
  return null;
}

export const CLEAN_TYPES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

// Returns a clean copy. Throws UnsupportedImage for anything it can't safely clean.
export function stripImage(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const kind = imageKind(bytes);
  if (kind === 'jpeg') return { kind, bytes: stripJpeg(bytes) };
  if (kind === 'png') return { kind, bytes: stripPng(bytes) };
  if (kind === 'webp') return { kind, bytes: stripWebp(bytes) };
  if (kind === 'gif') return { kind, bytes: stripGif(bytes) };
  throw new UnsupportedImage('Only JPEG, PNG, WebP and GIF photos can be cleaned.');
}

function ascii(b, at, n) {
  let s = '';
  for (let i = 0; i < n && at + i < b.length; i++) s += String.fromCharCode(b[at + i]);
  return s;
}

function join(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// ---- JPEG: drop APP0–APP15 (JFIF, EXIF, XMP, ICC, IPTC, MPF…) and COM, stop at the end marker.
function stripJpeg(b) {
  const out = [b.subarray(0, 2)];
  let i = 2;
  const bad = () => {
    throw new UnsupportedImage('This JPEG is damaged.');
  };
  while (i < b.length) {
    if (b[i] !== 0xff) bad();
    while (b[i] === 0xff && b[i + 1] === 0xff) i++; // fill bytes
    const marker = b[i + 1];
    if (marker === undefined) bad();
    if (marker === 0xd9) {
      out.push(b.subarray(i, i + 2)); // end of image: anything after it is dropped
      return join(out);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > b.length) bad();
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) bad();
    const end = i + 2 + len;
    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (!isApp && marker !== 0xfe) out.push(b.subarray(i, end));
    i = end;
    if (marker === 0xda) {
      // Picture data follows until the next real marker.
      let j = i;
      while (j < b.length - 1 && !(b[j] === 0xff && b[j + 1] !== 0x00 && !(b[j + 1] >= 0xd0 && b[j + 1] <= 0xd7))) j++;
      out.push(b.subarray(i, j));
      i = j;
    }
  }
  bad();
}

// ---- PNG: keep only the chunks that draw the picture (and APNG animation).
const PNG_KEEP = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND', 'acTL', 'fcTL', 'fdAT']);
function stripPng(b) {
  const out = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) throw new UnsupportedImage('This PNG is damaged.');
    if (PNG_KEEP.has(type)) out.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') return join(out);
  }
  throw new UnsupportedImage('This PNG is damaged.');
}

// ---- WebP: drop EXIF, XMP and ICCP chunks and clear their flags.
function stripWebp(b) {
  const parts = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const len = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)) >>> 0;
    const end = i + 8 + len + (len & 1);
    if (i + 8 + len > b.length) throw new UnsupportedImage('This WebP is damaged.');
    if (!['EXIF', 'XMP ', 'ICCP'].includes(type)) {
      const chunk = b.slice(i, Math.min(end, b.length));
      if (type === 'VP8X') chunk[8] &= ~(0x20 | 0x08 | 0x04); // ICC, EXIF, XMP flags
      parts.push(chunk);
    }
    i = end;
  }
  const body = join(parts);
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 12));
  const size = body.length + 4;
  head[4] = size & 255;
  head[5] = (size >> 8) & 255;
  head[6] = (size >> 16) & 255;
  head[7] = (size >> 24) & 255;
  return join([head, body]);
}

// ---- GIF: drop comments and application blocks (except the animation loop count).
function stripGif(b) {
  const out = [];
  let i = 13;
  const flags = b[10];
  if (flags & 0x80) i += 3 * (1 << ((flags & 7) + 1));
  out.push(b.subarray(0, i));
  const skipBlocks = (j) => {
    while (j < b.length && b[j] !== 0) j += b[j] + 1;
    return j + 1;
  };
  while (i < b.length) {
    const t = b[i];
    if (t === 0x3b) {
      out.push(b.subarray(i, i + 1));
      return join(out);
    }
    if (t === 0x2c) {
      let j = i + 10;
      const f = b[i + 9];
      if (f & 0x80) j += 3 * (1 << ((f & 7) + 1));
      j = skipBlocks(j + 1);
      out.push(b.subarray(i, j));
      i = j;
    } else if (t === 0x21) {
      const label = b[i + 1];
      const j = skipBlocks(i + 2);
      const isLoop = label === 0xff && ascii(b, i + 3, 11) === 'NETSCAPE2.0';
      if (label === 0xf9 || label === 0x01 || isLoop) out.push(b.subarray(i, j));
      i = j;
    } else throw new UnsupportedImage('This GIF is damaged.');
  }
  throw new UnsupportedImage('This GIF is damaged.');
}
