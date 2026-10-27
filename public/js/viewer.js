// The photo viewer: a Windows XP style picture viewer window with Previous / Next,
// best fit, actual size, zoom, rotate and a slide show. Used for every photo on the site.
import { h } from './util.js';

const svg = (body, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const ROUND = (dir) =>
  svg(
    `<defs><radialGradient id="pvg${dir}" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="#a9dcff"/><stop offset=".55" stop-color="#2f86e6"/><stop offset="1" stop-color="#1350b4"/></radialGradient></defs>` +
      `<circle cx="12" cy="12" r="10.5" fill="url(#pvg${dir})" stroke="#0d3f94" stroke-width="1"/>` +
      `<path d="${dir === 'prev' ? 'M14.5 6.5L9 12l5.5 5.5' : 'M9.5 6.5L15 12l-5.5 5.5'}" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    26
  );
const SCREEN = '<rect x="2.5" y="4" width="19" height="13.5" rx="1.5" fill="#e9f2ff" stroke="#35537f" stroke-width="1.3"/><path d="M8 21h8M12 17.5V21" stroke="#35537f" stroke-width="1.5"/>';
const ICONS = {
  prev: ROUND('prev'),
  next: ROUND('next'),
  fit: svg(SCREEN + '<path d="M6 7.5l2.5 2.2M18 7.5l-2.5 2.2M6 14l2.5-2.2M18 14l-2.5-2.2" stroke="#1d63c9" stroke-width="1.6" stroke-linecap="round"/>'),
  actual: svg(SCREEN + '<text x="12" y="13.6" text-anchor="middle" font-size="7" font-weight="bold" font-family="Tahoma, sans-serif" fill="#1d63c9">1:1</text>'),
  show: svg(SCREEN + '<path d="M10 7.6v6.3l5-3.15z" fill="#2c9a3a"/>'),
  zoomIn: svg('<circle cx="10" cy="10" r="6.3" fill="#eef6ff" stroke="#35537f" stroke-width="1.6"/><path d="M14.6 14.6l5.6 5.6" stroke="#8a6a2e" stroke-width="3" stroke-linecap="round"/><path d="M7 10h6M10 7v6" stroke="#1d63c9" stroke-width="1.8" stroke-linecap="round"/>'),
  zoomOut: svg('<circle cx="10" cy="10" r="6.3" fill="#eef6ff" stroke="#35537f" stroke-width="1.6"/><path d="M14.6 14.6l5.6 5.6" stroke="#8a6a2e" stroke-width="3" stroke-linecap="round"/><path d="M7 10h6" stroke="#1d63c9" stroke-width="1.8" stroke-linecap="round"/>'),
  rotL: svg('<path d="M6.5 13.5a6 6 0 1 0 2-6.2" fill="none" stroke="#2c9a3a" stroke-width="2.2" stroke-linecap="round"/><path d="M4.5 4.5l.4 5.3 5.2-1" fill="none" stroke="#2c9a3a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  rotR: svg('<path d="M17.5 13.5a6 6 0 1 1-2-6.2" fill="none" stroke="#2c9a3a" stroke-width="2.2" stroke-linecap="round"/><path d="M19.5 4.5l-.4 5.3-5.2-1" fill="none" stroke="#2c9a3a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  photo: svg('<rect x="2.5" y="4.5" width="19" height="15" rx="1.5" fill="#fff" stroke="#35537f" stroke-width="1.2"/><path d="M4.5 17.5l5-6 3.5 4 2.5-2.5 4 4.5z" fill="#3e9b48"/><circle cx="16" cy="8.5" r="1.8" fill="#f5b301"/>', 16)
};

const ZOOMS = [0.1, 0.17, 0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
let open = false;

// photos: list of image URLs; captions: matching list; start: which one to show first.
export function photoViewer({ photos, captions = [], title = '' }, start = 0) {
  if (open || !photos?.length) return;
  open = true;
  let i = Math.max(0, Math.min(start, photos.length - 1));
  let fit = true;
  let zoom = 1;
  let turn = 0; // quarter turns clockwise
  let showTimer = null;
  const prevFocus = document.activeElement;

  const img = h('img', { class: 'pv-img', alt: '', draggable: 'false' });
  const spin = h('div', { class: 'pv-spin' }, img);
  const canvas = h('div', { class: 'pv-canvas', tabindex: '-1' }, spin);
  const titleText = h('span', { class: 'xp-title-text' });
  const caption = h('div', { class: 'pv-caption' });
  const count = h('span', { class: 'pv-count' });
  const status = h('span', { class: 'pv-zoom' });

  const tool = (key, label, fn, cls = '') => h('button', { type: 'button', class: 'pv-tool ' + cls, title: label, 'aria-label': label, html: ICONS[key], onclick: (e) => (e.stopPropagation(), fn()) });
  const prevBtn = tool('prev', 'Previous image (Left arrow)', () => go(-1), 'pv-round');
  const nextBtn = tool('next', 'Next image (Right arrow)', () => go(1), 'pv-round');
  const bar = h(
    'div',
    { class: 'pv-toolbar', role: 'toolbar', 'aria-label': 'Picture tools' },
    prevBtn,
    nextBtn,
    h('span', { class: 'pv-sep' }),
    tool('fit', 'Best fit', () => ((fit = true), draw())),
    tool('actual', 'Actual size', () => ((fit = false), (zoom = 1), draw()), 'pv-wide'),
    tool('show', 'Start slide show', () => slideshow(), 'pv-wide'),
    h('span', { class: 'pv-sep pv-wide' }),
    tool('zoomIn', 'Zoom in (+)', () => zoomBy(1)),
    tool('zoomOut', 'Zoom out (−)', () => zoomBy(-1)),
    h('span', { class: 'pv-sep' }),
    tool('rotR', 'Rotate clockwise', () => ((turn = (turn + 1) % 4), draw())),
    tool('rotL', 'Rotate anticlockwise', () => ((turn = (turn + 3) % 4), draw())),
    // On phones there's also a Close at the bottom, within easy reach of a thumb.
    h('button', { type: 'button', class: 'pv-tool pv-close-tool', onclick: (e) => (e.stopPropagation(), close()) }, h('span', { 'aria-hidden': 'true' }, '✕'), 'Close')
  );

  const closeBtn = h('button', { type: 'button', class: 'pv-wbtn close', 'aria-label': 'Close picture viewer', onclick: () => close() });
  const maxBtn = h('button', { type: 'button', class: 'pv-wbtn max', 'aria-label': 'Maximise', onclick: () => (win.classList.toggle('pv-max'), draw()) });
  const win = h(
    'div',
    { class: 'pv-win', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Picture viewer', onclick: (e) => e.stopPropagation() },
    h('div', { class: 'xp-title pv-title', ondblclick: () => (win.classList.toggle('pv-max'), draw()) }, h('span', { class: 'pv-title-icon', html: ICONS.photo }), titleText, maxBtn, closeBtn),
    canvas,
    caption,
    h('div', { class: 'pv-bottom' }, bar, h('div', { class: 'pv-status' }, count, status))
  );
  const back = h('div', { class: 'pv-back', onclick: () => close() }, win);

  function natural() {
    return [img.naturalWidth || 800, img.naturalHeight || 600];
  }
  function fitScale() {
    const [w, hgt] = natural();
    const [ew, eh] = turn % 2 ? [hgt, w] : [w, hgt];
    const cw = canvas.clientWidth - 24;
    const ch = canvas.clientHeight - 24;
    return Math.max(0.02, Math.min(cw / ew, ch / eh, 1));
  }
  function draw() {
    const [w, hgt] = natural();
    const s = fit ? fitScale() : zoom;
    if (fit) zoom = s;
    const [ew, eh] = turn % 2 ? [hgt, w] : [w, hgt];
    img.style.width = w * s + 'px';
    img.style.height = hgt * s + 'px';
    img.style.transform = `translate(-50%, -50%) rotate(${turn * 90}deg)`;
    spin.style.width = ew * s + 'px';
    spin.style.height = eh * s + 'px';
    canvas.classList.toggle('pv-scroll', !fit && (ew * s > canvas.clientWidth || eh * s > canvas.clientHeight));
    status.textContent = fit ? 'Best fit' : `${Math.round(s * 100)}%`;
  }
  function zoomBy(dir) {
    const now = fit ? fitScale() : zoom;
    const list = dir > 0 ? ZOOMS.filter((z) => z > now + 0.001) : ZOOMS.filter((z) => z < now - 0.001).reverse();
    if (!list.length) return;
    fit = false;
    zoom = list[0];
    draw();
  }
  function load() {
    const cap = captions[i] || '';
    titleText.textContent = `${cap || title || `Photo ${i + 1}`} - Picture Viewer`;
    caption.textContent = cap;
    caption.hidden = !cap;
    count.textContent = `Image ${i + 1} of ${photos.length}`;
    img.alt = cap || `Photo ${i + 1} of ${photos.length}`;
    prevBtn.disabled = nextBtn.disabled = photos.length < 2;
    fit = true;
    turn = 0;
    spin.classList.add('pv-loading');
    img.onload = () => {
      spin.classList.remove('pv-loading');
      draw();
    };
    img.src = photos[i];
    if (img.complete && img.naturalWidth) img.onload();
    // Fetch the neighbours in the background so Next is instant.
    for (const k of [i + 1, i - 1]) if (photos.length > 1) new Image().src = photos[(k + photos.length) % photos.length];
  }
  function go(d) {
    if (photos.length < 2) return;
    i = (i + d + photos.length) % photos.length;
    load();
  }

  // Slide show: full screen, black, one photo every 4 seconds. Any click or key stops it.
  function slideshow() {
    win.classList.add('pv-show');
    back.classList.add('pv-show');
    fit = true;
    draw();
    clearInterval(showTimer);
    showTimer = setInterval(() => go(1), 4000);
  }
  function stopShow() {
    if (!showTimer) return false;
    clearInterval(showTimer);
    showTimer = null;
    win.classList.remove('pv-show');
    back.classList.remove('pv-show');
    requestAnimationFrame(draw);
    return true;
  }
  canvas.addEventListener('click', (e) => {
    if (stopShow()) e.stopPropagation();
  });

  // Swipe left or right on a phone for the next photo, or down to close.
  let touch = null;
  canvas.addEventListener('touchstart', (e) => (touch = e.touches.length === 1 ? [e.touches[0].clientX, e.touches[0].clientY] : null), { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!touch || !fit) return;
    const dx = e.changedTouches[0].clientX - touch[0];
    const dy = e.changedTouches[0].clientY - touch[1];
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    else if (dy > 90 && dy > Math.abs(dx) * 1.5) close();
    touch = null;
  });

  function onKey(e) {
    if (e.key === 'Escape') {
      if (!stopShow()) close();
    } else if (showTimer) stopShow();
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
    else if (e.key === '+' || e.key === '=') zoomBy(1);
    else if (e.key === '-' || e.key === '_') zoomBy(-1);
    else return;
    e.preventDefault();
  }
  const onResize = () => draw();
  function close() {
    clearInterval(showTimer);
    open = false;
    back.remove();
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    document.documentElement.classList.remove('pv-open');
    prevFocus?.focus?.({ preventScroll: true });
  }

  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onResize);
  document.documentElement.classList.add('pv-open');
  document.body.append(back);
  load();
  canvas.focus({ preventScroll: true });
}
