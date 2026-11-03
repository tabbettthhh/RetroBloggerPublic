// Notifications in this browser: signing this device up (and off) with the browser's own push
// service, through the site's small service worker (/sw.js, which only ever shows notifications).
// Used by the owner's Control Panel, and by the 🔔 button visitors get if the owner allows it.
import { h } from './util.js';

const ua = () => navigator.userAgent || '';
export const isIOS = () => /iPhone|iPad|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
// Whether this browser can have notifications at all, and (on an iPhone or iPad) whether it first
// needs the site adding to the Home Screen and opening from there.
export function pushState() {
  if (isIOS() && !standalone()) return 'homescreen';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return 'ok';
}
// A name for this device, for your list of devices: "iPhone", "Mac · Safari"…
export function deviceName() {
  const s = ua();
  const what = /iPhone/.test(s) ? 'iPhone' : /iPad/.test(s) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(s) ? (/Mobile/.test(s) ? 'Android phone' : 'Android tablet') : /Mac/.test(s) ? 'Mac' : /Windows/.test(s) ? 'Windows PC' : /CrOS/.test(s) ? 'Chromebook' : /Linux/.test(s) ? 'Linux computer' : 'This device';
  const browser = /Edg\//.test(s) ? 'Edge' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : '';
  return browser && !/iPhone|iPad/.test(what) ? `${what} · ${browser}` : what;
}
const keyBytes = (b64) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
async function registration() {
  return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js', { scope: '/' });
}
// This device's current sign-up, if it has one.
export async function currentSub() {
  if (pushState() !== 'ok' && pushState() !== 'blocked') return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}
// Asks for permission (only ever after a tap) and signs this device up. Returns the subscription.
export async function signUp(publicKey) {
  const ok = await Notification.requestPermission();
  if (ok !== 'granted') throw new Error(ok === 'denied' ? 'Notifications are blocked for this site in your browser’s settings.' : 'Notifications weren’t allowed.');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const old = await reg.pushManager.getSubscription();
  // (Signed up with another key before, say by a copy of the site at another address: start again.)
  if (old) {
    const had = old.options?.applicationServerKey ? new Uint8Array(old.options.applicationServerKey) : null;
    const want = keyBytes(publicKey);
    if (had && had.length === want.length && had.every((b, i) => b === want[i])) return old.toJSON();
    await old.unsubscribe().catch(() => {});
  }
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  return sub.toJSON();
}
export async function signOff() {
  const sub = await currentSub();
  const endpoint = sub?.endpoint || '';
  await sub?.unsubscribe().catch(() => {});
  return endpoint;
}

// For visitors (only when the owner allows it): 🔔 Notify me, to hear when they post. Tapping it again stops.
// (On an iPhone or iPad it first says how: add the site to the Home Screen, open it from there.)
export function notifyButton(data) {
  if (!data.notifyPosts || data.ownerView) return null;
  const who = data.site.owner || data.site.name || 'they';
  const btn = h('button', { type: 'button', class: 'nudge-btn notify-btn', 'aria-pressed': 'false' });
  const paint = (on, words) => {
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? `You’ll hear when ${who} posts. Tap to stop.` : `Get a notification when ${who} posts`;
    btn.replaceChildren(h('span', { 'aria-hidden': 'true' }, '🔔'), words || (on ? 'Notifying' : 'Notify me'));
  };
  paint(false);
  currentSub().then((s) => s && paint(true));
  let tip = null;
  const say = (text) => {
    tip?.remove();
    tip = h('span', { class: 'notify-tip', role: 'status' }, text);
    btn.after(tip);
    setTimeout(() => tip?.remove(), 9000);
  };
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const state = pushState();
    if (state === 'homescreen') return say(`On an iPhone or iPad: tap Share, then “Add to Home Screen”, open the site from there, and tap Notify me again.`);
    if (state === 'unsupported') return say('This browser can’t show notifications.');
    if (state === 'blocked') return say('Notifications are blocked for this site in your browser’s settings.');
    btn.disabled = true;
    try {
      if (btn.getAttribute('aria-pressed') === 'true') {
        const endpoint = await signOff();
        await fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }) });
        paint(false);
        say('No more notifications from here.');
      } else {
        const { on, key } = await (await fetch('/api/push/key', { cache: 'no-store' })).json();
        if (!on || !key) throw new Error('Notifications are switched off here just now.');
        const subscription = await signUp(key);
        const r = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription }) });
        const out = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(out.error || 'That didn’t work. Try again in a moment.');
        paint(true);
        say(`You’ll get a notification when ${who} posts something new. Tap Notifying to stop.`);
      }
    } catch (err) {
      say(err.message);
    }
    btn.disabled = false;
  });
  return btn;
}
