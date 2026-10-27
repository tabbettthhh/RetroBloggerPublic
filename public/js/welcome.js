// The welcome screen: one Visitor tile, no sign-in.
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

// A little settings gear in the XP style: steel blue, with a soft shine.
const GEAR = '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9f0fb"/><stop offset="1" stop-color="#9fb3d6"/></linearGradient></defs><path d="M10.3 1.8h3.4l.5 2.6 1.7.7 2.2-1.5 2.4 2.4-1.5 2.2.7 1.7 2.6.5v3.4l-2.6.5-.7 1.7 1.5 2.2-2.4 2.4-2.2-1.5-1.7.7-.5 2.6h-3.4l-.5-2.6-1.7-.7-2.2 1.5-2.4-2.4 1.5-2.2-.7-1.7-2.6-.5v-3.4l2.6-.5.7-1.7-1.5-2.2 2.4-2.4 2.2 1.5 1.7-.7z" fill="url(#wg)" stroke="#2c4a86" stroke-width="1.1" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.4" fill="#3d63b8" stroke="#2c4a86" stroke-width="1"/><circle cx="11" cy="11" r="1" fill="#fff" opacity=".6"/></svg>';

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
    // A quiet way into the back office for the owner. It's locked by Cloudflare Access, so
    // anyone else who taps it just meets a sign-in page they can't get past.
    h('div', { class: 'welcome-band top' }, h('a', { class: 'welcome-owner', href: '/admin/', 'aria-label': 'Back office (for the owner)', title: 'Back office (for the owner)', html: GEAR })),
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
