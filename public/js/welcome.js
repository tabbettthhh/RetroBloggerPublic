// The welcome screen: a Visitor tile (no sign-in) and, like XP's, the owner's own account tile.
import { h, ICON, storage } from './util.js';
import { greeting } from './sky.js';
import { word } from './skins.js';
import { sound, isMuted, setMuted } from './sound.js';

const session = storage('session');

export function hasEntered() {
  return session.getItem('entered') === '1';
}
export function forgetEntered() {
  session.removeItem('entered');
}

// A small padlock, for the owner's tile.
const LOCK = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="1.5" fill="#fff"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="8" cy="11" r="1.2" fill="#2a4f9c"/></svg>';

export function renderWelcome(data, onEnter, { overlay = false } = {}) {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const enter = () => {
    session.setItem('entered', '1');
    sound.chime();
    onEnter();
  };
  const mute = h('button', { type: 'button', class: 'welcome-mute' });
  const paint = () => {
    mute.innerHTML = isMuted() ? ICON.speakerOff : ICON.speaker;
    mute.setAttribute('aria-label', isMuted() ? 'Turn sounds on' : 'Mute sounds');
  };
  mute.addEventListener('click', () => {
    setMuted(!isMuted());
    paint();
  });
  paint();

  return h(
    'div',
    { class: 'welcome' + (overlay ? ' overlay' : ''), role: 'dialog', 'aria-label': 'Welcome' },
    h('div', { class: 'welcome-band top' }),
    h(
      'div',
      { class: 'welcome-mid' },
      h('div', { class: 'welcome-brand' }, h('span', { class: 'orb', 'aria-hidden': 'true' }), h('div', null, h('span', { class: 'welcome-name' }, data.site.name), h('span', { class: 'welcome-greet' }, greeting()))),
      data.site.tagline ? h('p', { class: 'welcome-tag' }, data.site.tagline) : null,
      h('span', { class: 'welcome-hint' }, word('come_in', 'Tap to come in')),
      h(
        'button',
        { type: 'button', class: 'visitor-tile', onclick: enter, autofocus: true },
        h('span', { class: 'tile-avatar', html: ICON.person() }),
        h('span', { class: 'tile-text' }, h('strong', null, word('visitor', 'Visitor')), h('small', null, 'No sign-in needed')),
        h('span', { class: 'tile-go', 'aria-hidden': 'true' }, '›')
      ),
      // The owner's account: sign in (Cloudflare Access, as before; anyone else meets a sign-in
      // they can't get past) and come back to the site with your tools on it.
      h(
        'a',
        { class: 'owner-tile', href: '/admin/signin' },
        h('span', { class: 'tile-avatar owner', html: ICON.person() }),
        h('span', { class: 'tile-text' }, h('strong', null, data.site.owner || 'Owner'), h('small', null, 'Sign in to write and edit')),
        h('span', { class: 'tile-go lock', 'aria-hidden': 'true', html: LOCK })
      ),
      !overlay && !standalone
        ? h(
            'div',
            { class: 'a2hs' },
            h('span', { class: 'a2hs-icon', 'aria-hidden': 'true' }),
            h('span', null, h('strong', null, 'Add to Home Screen'), h('small', null, isIOS ? 'Tap Share, then "Add to Home Screen". It opens like an app.' : 'Use your browser menu: "Add to Home screen". It opens like an app.'))
          )
        : null
    ),
    h('div', { class: 'welcome-band bottom' }, h('span', { class: 'welcome-note' }, 'Open to visitors. Search engines and AI scrapers are asked to stay out.'), mute)
  );
}
