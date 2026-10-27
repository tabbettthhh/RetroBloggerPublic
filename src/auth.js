// Checks that a request to /admin really came through Cloudflare Access.
// Access puts a signed token on every request it lets through; we verify that
// signature ourselves, so the back office stays shut even if Access is misconfigured.

let certCache = { at: 0, team: '', keys: [] };

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

async function getKeys(team) {
  const now = Date.now();
  if (certCache.team === team && now - certCache.at < 60 * 60 * 1000 && certCache.keys.length) return certCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('Could not load Access certificates');
  const { keys = [] } = await res.json();
  certCache = { at: now, team, keys };
  return keys;
}

// Whether a request may use the back office, and if not, why not (shown on the locked page so
// the owner can fix their setup; it never reveals the settings themselves).
export async function adminCheck(request, env) {
  const host = new URL(request.url).hostname;
  // Local development only: `.dev.vars` sets DEV_ADMIN=true and this never applies on the internet.
  if (env.DEV_ADMIN === 'true' && (host === 'localhost' || host === '127.0.0.1')) return { ok: true };

  const setting = (v) => {
    const s = String(v || '').trim();
    return /^none$/i.test(s) ? '' : s;
  };
  const team = setting(env.ACCESS_TEAM_DOMAIN).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const aud = setting(env.ACCESS_AUD);
  const adminEmail = setting(env.ADMIN_EMAIL);
  if (!team || !aud) return { ok: false, why: 'setup' };

  const token = request.headers.get('Cf-Access-Jwt-Assertion') || getCookie(request, 'CF_Authorization');
  if (!token) return { ok: false, why: 'no-pass' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, why: 'bad' };

  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    return { ok: false, why: 'bad' };
  }
  if (header.alg !== 'RS256') return { ok: false, why: 'bad' };

  let keys;
  try {
    keys = await getKeys(team);
  } catch {
    return { ok: false, why: 'keys' };
  }
  try {
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return { ok: false, why: 'bad' };
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) return { ok: false, why: 'bad' };
  } catch {
    return { ok: false, why: 'bad' };
  }
  // Only once Cloudflare's signature is checked is anything in the pass believed.
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) return { ok: false, why: 'expired' };
  if (payload.nbf && payload.nbf > now + 60) return { ok: false, why: 'bad' };
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) return { ok: false, why: 'audience' };
  if (payload.iss && payload.iss !== `https://${team}`) return { ok: false, why: 'bad' };
  if (adminEmail && String(payload.email || '').toLowerCase() !== adminEmail.toLowerCase()) return { ok: false, why: 'email', email: String(payload.email || '') };
  return { ok: true };
}

export async function isAdmin(request, env) {
  return (await adminCheck(request, env)).ok;
}
