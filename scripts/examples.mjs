// Packs ./content into public/admin/examples.json so the back office can add the
// example posts with one button (no terminal needed). Run after changing ./content.

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('../content', import.meta.url).pathname;
const out = new URL('../public/admin/examples.json', import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(root)
  .filter((f) => !f.split(sep).pop().startsWith('.'))
  .map((f) => {
    const key = relative(root, f).split(sep).join('/');
    const isText = /\.(md|json|txt)$/i.test(key);
    return isText ? { key, text: readFileSync(f, 'utf8') } : { key, base64: readFileSync(f).toString('base64') };
  });

writeFileSync(out, JSON.stringify({ files }));
console.log(`Packed ${files.length} example files into public/admin/examples.json`);
