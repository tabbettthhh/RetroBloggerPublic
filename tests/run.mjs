// Runs the end-to-end checks: each group gets a fresh local copy of the site (an empty bucket,
// back office open without a login) on port 8800, then the next group starts from scratch.
//
//   npm i --no-save playwright && npx playwright install chromium   (once)
//   npm test                      every group
//   npm test -- admin journal     only some groups
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const PORT = 8800;
const BASE = `http://localhost:${PORT}`;

// A group is one or more test files run one after another on the same fresh site.
const GROUPS = {
  admin: ['admin', 'designs', 'thoughts', 'profile', 'pool', 'themes'],
  roundtrip: ['roundtrip'],
  server: ['server', 'updater', 'comments'],
  photos: ['photos'],
  import: ['import'],
  journal: ['journal'],
  pages: ['fuzz', 'interact'],
  // Two sites at once (a second on port 8801), becoming friends.
  friends: ['friends'],
  // The back office lock with the developer bypass off: once with the lock's settings, once without.
  locked: [['locked', { LOCK_MODE: 'set' }]],
  'locked-unset': [['locked', { LOCK_MODE: 'unset' }]],
  empty: [['fuzz', { EMPTY: '1' }]]
};
const TWO_SITES = new Set(['friends']);
// The local site's settings for each group: the back office open without a login, except
// where the lock itself is being checked.
const SITE_VARS = {
  locked: ['--var', 'ACCESS_TEAM_DOMAIN:nosuchteam.invalid', '--var', 'ACCESS_AUD:abc123'],
  'locked-unset': []
};
const BASE2 = `http://localhost:${PORT + 1}`;
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(GROUPS);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function up(base = BASE) {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(base + '/')).ok) return true;
    } catch {}
    await sleep(500);
  }
  return false;
}
function run(cmd, args, opts) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('exit', (code) => resolve(code ?? 1));
  });
}

let failed = 0;
for (const name of wanted) {
  const files = GROUPS[name];
  if (!files) {
    console.log(`No group called "${name}". Groups: ${Object.keys(GROUPS).join(', ')}`);
    failed++;
    continue;
  }
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'site-state-'));
  const vars = SITE_VARS[name] || ['--var', 'DEV_ADMIN:true'];
  const server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--inspector-port', '9331', '--persist-to', state, ...vars], { cwd: ROOT, stdio: 'ignore', detached: true });
  const state2 = TWO_SITES.has(name) ? fs.mkdtempSync(path.join(os.tmpdir(), 'site-state-')) : null;
  const server2 = state2 ? spawn('npx', ['wrangler', 'dev', '--port', String(PORT + 1), '--inspector-port', '9332', '--persist-to', state2, '--var', 'DEV_ADMIN:true'], { cwd: ROOT, stdio: 'ignore', detached: true }) : null;
  console.log(`\n== ${name}`);
  if (!(await up()) || (server2 && !(await up(BASE2)))) {
    console.log('  The local site did not start.');
    failed++;
  } else {
    for (const f of files) {
      const [file, env] = Array.isArray(f) ? f : [f, {}];
      const code = await run(process.execPath, [path.join(HERE, `${file}.test.mjs`)], { env: { ...process.env, TEST_BASE: BASE, TEST_BASE2: BASE2, ...env } });
      if (code) failed++;
    }
  }
  for (const s of [server, server2]) {
    try {
      if (s) process.kill(-s.pid);
    } catch {}
  }
  await sleep(1000);
  for (const dir of [state, state2]) if (dir) fs.rmSync(dir, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} group(s) had failures.` : '\nEverything passed.');
process.exit(failed ? 1 : 0);
