// Online when you're actually here (see the presence part of worker.js): whether you're here,
// whether a status you chose still holds, and so what your site shows right now.
export const HERE_FOR = 3 * 60 * 1000;
export const STATUS_LASTS = 24 * 60 * 60 * 1000;
export function presenceNow(p, now = Date.now()) {
  // (Never here yet, since this came in: a status you'd chosen still holds.)
  return { here: !!p.seen && now - p.seen < HERE_FOR && !(p.left >= p.seen), active: !p.seen || now - p.seen < STATUS_LASTS };
}
// The presence your site shows right now, from the one in site.md (yours to choose) and when you
// were last here.
export function livePresence(site, p, now = Date.now()) {
  const { here, active } = presenceNow(p, now);
  if (site.away_on) return { presence: site.presence, auto: false };
  const chosen = site.presence && site.presence !== 'online' ? site.presence : '';
  if (chosen && active) return { presence: chosen, auto: false };
  // (Automatic: when you were last here, to the nearest ten minutes, so friends' sites can tell
  // when you've gone even if you never said goodbye.)
  return { presence: here ? 'online' : 'offline', auto: true, seen: here ? Math.floor(p.seen / 600000) * 600000 : 0 };
}
