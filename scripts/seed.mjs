// Uploads everything in ./content to your R2 bucket.
//   node scripts/seed.mjs --local    -> the pretend bucket used by `npm run dev`
//   node scripts/seed.mjs --remote   -> your real bucket on Cloudflare
// Files already in the bucket with the same name are replaced; nothing is deleted.

import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const mode = process.argv.includes('--remote') ? '--remote' : '--local';
const bucket = process.env.BUCKET || 'my-corner-content';
const root = new URL('../content', import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const types = { md: 'text/markdown; charset=utf-8', json: 'application/json', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

const files = walk(root).filter((f) => !f.split(sep).pop().startsWith('.'));
for (const file of files) {
  const key = relative(root, file).split(sep).join('/');
  const ext = key.split('.').pop().toLowerCase();
  const args = ['wrangler', 'r2', 'object', 'put', `${bucket}/${key}`, `--file=${file}`, mode];
  if (types[ext]) args.push(`--content-type=${types[ext]}`);
  process.stdout.write(`Uploading ${key} ... `);
  execFileSync('npx', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('done');
}
console.log(`\n${files.length} files uploaded to ${bucket} (${mode.slice(2)}).`);
