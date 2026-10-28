// The apps' top bars get a little element of their own for their bunting and stickers (drawn by
// skins.css from what skins.js works out for each app). Bars come and go as apps open, so every
// new one is found as it appears.
const BARS = '.xp-title, .wbar, .phone :is(.al-bar, .shelf-bar, .marquee, .deck-bar, .hifi-bar, .tv-bar, .droid-bar, .menubar, .leather-head)';

function dress(root) {
  for (const bar of root.querySelectorAll(BARS)) {
    if (bar.querySelector(':scope > .bar-decor')) continue;
    const decor = document.createElement('span');
    decor.className = 'bar-decor';
    decor.setAttribute('aria-hidden', 'true');
    bar.append(decor);
  }
}

export function startBarDecor(root = document.body) {
  dress(root);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      dress(root);
    });
  }).observe(root, { childList: true, subtree: true });
}
