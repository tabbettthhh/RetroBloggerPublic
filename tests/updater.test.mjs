// Updates: a copy of the site made with the Deploy button brings itself up to date with the
// template (the "Update my site" workflow), keeping its own settings and anything listed in
// .keep-mine.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, report, assert, eq } from './lib.mjs';
import { update, readJsonc } from '../scripts/update-from-template.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'updater-'));
const template = path.join(tmp, 'template');
const yours = path.join(tmp, 'yours');
// The template: this repository as it stands (its tracked files).
const copyTracked = (to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const rel of execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)) {
    if (!fs.existsSync(path.join(ROOT, rel))) continue;
    fs.mkdirSync(path.dirname(path.join(to, rel)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), path.join(to, rel));
  }
};

await test('a copy of the site updates itself from the template, keeping what is its own', async () => {
  copyTracked(template);
  // Someone's copy, from an older version, with their own name, bucket and settings.
  copyTracked(yours);
  const w = path.join(yours, 'wrangler.jsonc');
  fs.writeFileSync(w, fs.readFileSync(w, 'utf8').replace(/"name": "[^"]+"/, '"name": "lina-corner"').replace(/"bucket_name": "[^"]+"/, '"bucket_name": "lina-content"').replace(/"crons": \[[^\]]*\]/, '"crons": ["*/30 * * * *"]').replace('"TIMEZONE": "Europe/London"', '"TIMEZONE": "Europe/Paris"'));
  fs.writeFileSync(path.join(yours, 'src/worker.js'), '// an old version\n');
  fs.writeFileSync(path.join(yours, 'public/css/xp.css'), '/* changed by hand */\n');
  fs.writeFileSync(path.join(yours, '.keep-mine'), '# kept\npublic/css/xp.css\n');
  const changed = update(template, yours);
  assert(changed.includes('src/worker.js'), 'the code is brought up to date');
  eq(fs.readFileSync(path.join(yours, 'src/worker.js'), 'utf8'), fs.readFileSync(path.join(template, 'src/worker.js'), 'utf8'), 'to the template’s version');
  const s = readJsonc(fs.readFileSync(w, 'utf8'));
  eq([s.name, s.r2_buckets[0].bucket_name, s.vars.TIMEZONE], ['lina-corner', 'lina-content', 'Europe/Paris'], 'their own name, bucket and settings are kept');
  eq(s.triggers, readJsonc(fs.readFileSync(path.join(template, 'wrangler.jsonc'), 'utf8')).triggers, 'the rest comes from the template');
  eq(fs.readFileSync(path.join(yours, 'public/css/xp.css'), 'utf8'), '/* changed by hand */\n', 'a file listed in .keep-mine is left alone');
  eq(update(template, yours), [], 'run again: nothing new');
  // A file the template removes goes from the copy too; one the copy added itself stays.
  fs.writeFileSync(path.join(yours, 'public/js/my-own.js'), '// mine\n');
  fs.rmSync(path.join(template, 'public/js/sky.js'));
  eq(update(template, yours), ['public/js/sky.js (removed)'], 'removed with the template');
  assert(fs.existsSync(path.join(yours, 'public/js/my-own.js')), 'their own file stays');
  // The workflow itself: runs nightly and on demand, never in the template's own repositories.
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/update.yml'), 'utf8');
  for (const bit of ['workflow_dispatch', 'schedule:', 'contents: write', "github.repository_owner != 'tabbettthhh'", 'scripts/update-from-template.mjs', '.template-version']) assert(wf.includes(bit), 'workflow: ' + bit);
});

fs.rmSync(tmp, { recursive: true, force: true });
const failed = report();
process.exit(failed ? 1 : 0);
