// How each friend's house in the neighbourhood stands (see friends-feed.js): lights from the
// friends list, smoke and the envelope only from posts this viewer may see. No imports, so it
// stands on its own.
const WEEK = 7 * 24 * 60 * 60 * 1000;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// How each friend's house stands: from the list (online) and from posts this viewer may see.
export function houseState(b, posts, now = new Date(), seen = {}) {
  const mine = posts.filter((p) => p.friend?.url === b.url);
  const newest = mine.reduce((n, p) => Math.max(n, p.ts || 0), 0);
  return {
    lit: b.presence !== 'offline',
    smoke: !!newest && sameDay(new Date(newest), now),
    mail: !!newest && now.getTime() - newest < WEEK && newest > (Number(seen[b.url]) || 0),
    newest
  };
}

