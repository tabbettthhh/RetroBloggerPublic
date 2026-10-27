// Brings a copy of this site (yours, made with the Deploy button) up to date with the latest
// version of the template it came from, keeping what's yours. Run by the "Update my site"
// workflow (.github/workflows/update.yml), from the newest template's own copy of this script:
//
//   node <template>/scripts/update-from-template.mjs <template folder> [<your site's folder>]
//
// What it does:
// - Copies every file of the template over yours: the code, the styles, the README…
// - Keeps your own settings in wrangler.jsonc (your site's name, your storage bucket, your
//   address, your settings) and takes everything else in it from the template.
// - Removes files the template itself has since removed (only ones that came from it).
// - Leaves alone: .git, .github, and any file or folder you list in .keep-mine (one per line),
//   for things you've changed by hand and want to keep.
// Your posts, photos and theme live in your Cloudflare storage, not here, so they're never touched.
import fs from 'node:fs';
import path from 'node:path';

// Never copied, never removed.
const SKIP = new Set(['.git', '.github', 'node_modules', '.wrangler', '.dev.vars', '.template-files', '.template-version', '.keep-mine']);
const keepMineIn = (to) => {
  try {
    return fs
      .readFileSync(path.join(to, '.keep-mine'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^\.?\//, ''))
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return [];
  }
};

function filesIn(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...filesIn(path.join(dir, e.name), rel));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

// wrangler.jsonc is JSON with comments: the comments are taken out (carefully, so a "//" inside
// a web address stays) before it's read.
export function readJsonc(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === '\\') out += text[++i] ?? '';
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

// Yours: what the Deploy button (or you) set for your own site.
const YOURS = ['name', 'account_id', 'routes', 'route', 'workers_dev', 'r2_buckets', 'kv_namespaces', 'd1_databases', 'vars'];
export function mergeSettings(templateText, yoursText) {
  const t = readJsonc(templateText);
  let y = {};
  try {
    y = readJsonc(yoursText);
  } catch {
    return templateText;
  }
  const merged = {};
  // Anything you added that the template doesn't have, then the template, then your own parts.
  for (const [k, v] of Object.entries(y)) if (!(k in t)) merged[k] = v;
  Object.assign(merged, t);
  for (const k of YOURS) if (k in y) merged[k] = y[k];
  return (
    '// Your site\'s settings for Cloudflare. When the site updates itself (the "Update my site"\n' +
    '// workflow), your own parts are kept: its name, your storage bucket, your address and your\n' +
    '// settings. The rest comes from the latest version of the template.\n' +
    JSON.stringify(merged, null, 2) +
    '\n'
  );
}

export function update(from, to) {
  const keepMine = keepMineIn(to);
  const kept = (rel) => keepMine.some((k) => rel === k || rel.startsWith(k.replace(/\/+$/, '') + '/'));
  const files = filesIn(from);
  const changed = [];
  for (const rel of files) {
    if (kept(rel)) continue;
    const src = path.join(from, rel);
    const dst = path.join(to, rel);
    let next = fs.readFileSync(src);
    if (rel === 'wrangler.jsonc' && fs.existsSync(dst)) next = Buffer.from(mergeSettings(next.toString('utf8'), fs.readFileSync(dst, 'utf8')));
    const now = fs.existsSync(dst) ? fs.readFileSync(dst) : null;
    if (now && now.equals(next)) continue;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, next);
    changed.push(rel);
  }
  // Files the template has removed since the last update (only ones that came from it).
  let before = [];
  try {
    before = fs.readFileSync(path.join(to, '.template-files'), 'utf8').split('\n').filter(Boolean);
  } catch {}
  const now = new Set(files);
  for (const rel of before) {
    if (now.has(rel) || kept(rel) || !fs.existsSync(path.join(to, rel))) continue;
    fs.rmSync(path.join(to, rel));
    changed.push(rel + ' (removed)');
  }
  fs.writeFileSync(path.join(to, '.template-files'), files.join('\n') + '\n');
  return changed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const from = path.resolve(process.argv[2] || '');
  const to = path.resolve(process.argv[3] || '.');
  if (!process.argv[2] || !fs.existsSync(path.join(from, 'wrangler.jsonc'))) {
    console.error('Usage: node update-from-template.mjs <template folder> [<your site folder>]');
    process.exit(2);
  }
  const changed = update(from, to);
  console.log(changed.length ? `Updated ${changed.length} file(s):\n` + changed.map((f) => '  ' + f).join('\n') : 'Already up to date.');
}
