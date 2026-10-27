// The back office lock, with the developer bypass off: nobody gets in without a real Cloudflare
// Access sign-in, and the locked page says why in plain words (without revealing a setting).
import { test, report, assert, eq, BASE } from './lib.mjs';

const unset = process.env.LOCK_MODE === 'unset';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const forged = `${b64({ alg: 'RS256', kid: 'k1' })}.${b64({ aud: ['abc123'], email: 'owner@example.com', exp: 9999999999 })}.${Buffer.from('sig').toString('base64url')}`;
const unsigned = `${b64({ alg: 'none' })}.${b64({ aud: ['abc123'], email: 'owner@example.com', exp: 9999999999 })}.`;
const get = (p, opts = {}) => fetch(BASE + p, { redirect: 'manual', ...opts });

await test('every way into the back office is shut without signing in', async () => {
  for (const p of ['/admin', '/admin/', '/admin/admin.js', '/admin/themes.js', '/admin/api/overview', '/admin/api/file?key=site.md', '/admin/api/export', '/admin/api/friends']) eq((await get(p)).status, 403, p);
  for (const [m, p] of [['PUT', '/admin/api/file?key=site.md'], ['DELETE', '/admin/api/file?key=site.md'], ['POST', '/admin/api/batch'], ['PUT', '/admin/api/upload?key=places/x/a.jpg'], ['POST', '/admin/api/friends/invite']]) eq((await get(p, { method: m, body: m === 'DELETE' ? undefined : 'x' })).status, 403, `${m} ${p}`);
  eq((await get('/admin/api/overview', { headers: { 'Cf-Access-Jwt-Assertion': forged } })).status, 403, 'forged pass in the header');
  eq((await get('/admin/api/overview', { headers: { Cookie: `CF_Authorization=${forged}` } })).status, 403, 'forged pass as a cookie');
  eq((await get('/admin/api/overview', { headers: { 'Cf-Access-Jwt-Assertion': unsigned } })).status, 403, 'unsigned pass');
  eq((await get('/admin/api/overview', { headers: { 'Cf-Access-Jwt-Assertion': 'nonsense' } })).status, 403, 'nonsense pass');
  eq((await get('/')).status, 200, 'the site itself is open');
});

await test('the locked page says why', async () => {
  const page = await (await get('/admin/')).text();
  if (unset) {
    // A new site: the steps to lock it, with this site's own address, and a prompt for an AI helper.
    assert(page.includes('One more step') && page.includes('Application Audience (AUD) Tag'), 'setup steps: ' + page.slice(0, 300));
    assert(page.includes('<code') && /localhost(:\d+)?<\/code>/.test(page) && page.includes('admin/*'), 'this site’s address filled in');
    assert(/<textarea[^>]*>I’ve just put my own website online[\s\S]*https:\/\/localhost(:\d+)?\/admin/.test(page.replace(/'/g, '’')), 'the AI prompt, with the address');
    assert(!/<script/i.test(page), 'no scripts');
  }
  else {
    assert(page.includes('didn’t go through the Cloudflare sign-in') && page.includes('localhost/admin'), 'no sign-in: ' + page.slice(0, 300));
    const withPass = await (await get('/admin/', { headers: { 'Cf-Access-Jwt-Assertion': forged } })).text();
    assert(withPass.includes('Couldn’t check your sign-in'), 'keys unreachable: ' + withPass.slice(0, 300));
    const junk = await (await get('/admin/', { headers: { 'Cf-Access-Jwt-Assertion': 'a.b' } })).text();
    assert(junk.includes('wasn’t accepted') && junk.includes('/cdn-cgi/access/logout'), 'junk pass');
  }
  assert(!/abc123|nosuchteam/.test(page), 'no settings revealed');
  const api = await get('/admin/api/overview');
  eq((await api.json()).why, unset ? 'setup' : 'no-pass', 'the back office gets the reason too');
});

const failed = report();
process.exit(failed ? 1 : 0);
