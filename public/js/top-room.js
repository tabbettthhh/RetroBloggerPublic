// Room at the top on a phone's Home Screen. Opened from the Home Screen, an iPhone puts its clock
// and battery over the top of the page and fades the page out beneath them, which can wash out
// the top bar. The site already keeps its bars below the clock; this adds extra room on top of
// that (Back office › Site › On a phone's Home Screen), for the site and the back office.
// It only applies when opened from the Home Screen: in a browser tab nothing changes.
import { storage } from './util.js';

export const TOP_ROOM = { '': 'As it is', some: 'A little more', more: 'More', lots: 'Lots more' };
const saved = storage('local');
const root = document.documentElement;

// Opened from the Home Screen (as an app), rather than in a browser tab.
export const onHomeScreen = () => !!(navigator.standalone || window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches);

// Sets the room (and remembers it on this phone, so it's there before the site has loaded).
export function setTopRoom(value) {
  const v = TOP_ROOM[value] && value ? value : '';
  if (v) root.dataset.topRoom = v;
  else delete root.dataset.topRoom;
  try {
    if (v) saved?.setItem('top-room', v);
    else saved?.removeItem('top-room');
  } catch {}
}

if (onHomeScreen()) root.dataset.homeScreen = '';
try {
  setTopRoom(saved?.getItem('top-room') || '');
} catch {}
