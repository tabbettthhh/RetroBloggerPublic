// Copies the map library and the fonts into ./public so visitors never load
// anything from Google or a CDN. Run once after `npm install` (already done in the zip).

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const nm = join(root, 'node_modules');
const pub = join(root, 'public');

// Leaflet (maps)
mkdirSync(join(pub, 'vendor/leaflet'), { recursive: true });
for (const f of ['leaflet.js', 'leaflet.css']) copyFileSync(join(nm, 'leaflet/dist', f), join(pub, 'vendor/leaflet', f));
cpSync(join(nm, 'leaflet/dist/images'), join(pub, 'vendor/leaflet/images'), { recursive: true });

// HEIC/HEIF decoder for iPhone photos, loaded by the back office only when the browser
// can't open a HEIC photo by itself. The CSP-safe build needs no eval and no WebAssembly.
mkdirSync(join(pub, 'vendor/heic-to'), { recursive: true });
copyFileSync(join(nm, 'heic-to/dist/csp/heic-to.min.js'), join(pub, 'vendor/heic-to/heic-to.js'));
copyFileSync(join(nm, 'heic-to/LICENSE'), join(pub, 'vendor/heic-to/LICENSE'));

// Zip reader for the Letterboxd import in the back office.
mkdirSync(join(pub, 'vendor/fflate'), { recursive: true });
copyFileSync(join(nm, 'fflate/esm/browser.js'), join(pub, 'vendor/fflate/fflate.js'));
copyFileSync(join(nm, 'fflate/LICENSE'), join(pub, 'vendor/fflate/LICENSE'));

// Fonts
const fonts = {
  caveat: ['500', '700'],
  'libre-baskerville': ['400', '700', '400-italic'],
  oswald: ['400', '600', '700'],
  'special-elite': ['400'],
  'open-sans': ['400', '600', '700'],
  'share-tech-mono': ['400'],
  // Era fonts, used when the real ones (Tahoma, Trebuchet MS, Lucida Grande, Helvetica) aren't on the device:
  'dejavu-sans': ['400', '700'], // Windows XP text (Tahoma / Verdana)
  'pt-sans': ['400', '700', '700-italic'], // XP title bars and Start button (Trebuchet MS)
  'source-sans-3': ['400', '600', '700'], // Mac OS X Aqua (Lucida Grande)
  arimo: ['400', '700'] // old iPhone and iPad (Helvetica)
};
mkdirSync(join(pub, 'fonts'), { recursive: true });
let css = '/* Self-hosted fonts (from Fontsource, SIL Open Font License). */\n';
for (const [family, weights] of Object.entries(fonts)) {
  for (const w of weights) {
    const file = join(nm, '@fontsource', family, `${w}.css`);
    if (!existsSync(file)) throw new Error('Missing ' + file);
    // Keep only the Latin alphabets (English and European accents) to keep the site small.
    let block = readFileSync(file, 'utf8')
      .split(/(?=\/\* [\w-]+ \*\/)/)
      .filter((b) => /\/\* [\w-]*-latin(-ext)?-\d{3}-(normal|italic) \*\//.test(b) || !b.includes('@font-face'))
      .join('');
    block = block.replace(/url\(\.\/files\/([^)]+?\.woff2)\)\s*format\('woff2'\)\s*,\s*url\(\.\/files\/[^)]+?\.woff\)\s*format\('woff'\)/g, (_, f) => {
      copyFileSync(join(nm, '@fontsource', family, 'files', f), join(pub, 'fonts', f));
      return `url(/fonts/${f}) format('woff2')`;
    });
    block = block.replace(/url\(\.\/files\/([^)]+?\.woff2)\)\s*format\('woff2'\)/g, (_, f) => {
      copyFileSync(join(nm, '@fontsource', family, 'files', f), join(pub, 'fonts', f));
      return `url(/fonts/${f}) format('woff2')`;
    });
    css += block + '\n';
  }
}
mkdirSync(join(pub, 'css'), { recursive: true });
writeFileSync(join(pub, 'css/fonts.css'), css);
console.log('Vendored Leaflet and fonts into ./public');
