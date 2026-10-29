// Themes, in the back office: pick one of the site's themes, or make it your own, with the
// real site previewed live beside it. Like a Rockbox theme, every level can be changed:
// colours, wallpaper, fonts, the highlight, bars and corners, spacing and how posts sit, the
// profile header, the menu, the taskbar and scroll bars, icons and sounds, charms, the pointer
// and stickers. Saved as theme.md, which can be downloaded, shared and installed.
import { h } from '/js/util.js';
import { CARD_STYLES, miniCard, mixMini, isOwnCard, ensureOwnCardsCss } from '/js/card-dress.js';
import { CARD_PARTS, CARD_COLOURS, MAX_CARDS, cleanCards, nextCardId, MIX, MAX_SEED, cleanMix, cleanSeed } from '/js/card-parts.js';
import { SKINS, SKIN_GROUPS, WALLPAPERS, CHARMS, CHARM_NAMES, resolveSkin, wallpaperCss, charmUrl, pointerSvgs, themeColour, TITLE_STOPS, inks, mix, emojiList, EMOJI_LAYOUTS, STICKER_SPOTS, STICKER_SIZES, OPTIONS, HIDEABLE, SECTIONS, DEFAULT_MENU, FONT_FAMILIES, APPS, APP_LOOKS, APP_EXTRAS, cleanApps, hexHsl, hslHex, SEASONS, FESTIVALS, FALLING_CHOICES, cleanMyDays, MAX_MY_DAYS, cleanFestivalDates, nextFestival, LABELS, LABEL_GROUPS, cleanLabels, GLASS_PLACES, SCENERY_PLACES, lookOf, cleanLooks, MAX_LOOK_CHARMS, seasonOf, BAR_APPS, BAR_DECOR, MAX_BAR_STICKERS, cleanBarDecor } from '/js/skins.js';
import { FLOPPY_PIECES, FLOPPY_DRESS, outfitFor, dressFloppy, cleanFloppy } from '/js/floppy-look.js';
import { FLOPPY } from '/js/helper.js';

const PARTS = ['main', 'accent', 'paper', 'leather', 'wallpaper', 'decoration', 'pointer', 'tab_icon', 'night_theme', ...Object.keys(OPTIONS)];
// Your own layout choices and extras stay when you switch to another theme; the look comes with the theme.
const KEEP_ON_SWITCH = ['card_festive', 'card_corner', 'page', 'page_strength', 'wall_time', 'taskbar', 'text_size', 'header', 'sounds', 'name_style', 'trail', 'falling', 'tab_icon', 'night_theme', 'seasons', 'hemisphere'];
// Each change, so Undo can step back one at a time (while you're on the Themes page).
let history = [];
// Showing the after-dark look in the preview (rather than the daytime one).
let nightPreview = false;
// Showing a season or festive day in the preview ('' is as it is today).
let seasonPreview = '';
// The preview tucked away (on a phone).
let tucked = false;
const firstChoice = (k) => Object.keys(OPTIONS[k].choices)[0];
let ownTab = 'colours';
let ownOpen = false;
// Opens a page of the site in the preview (set while the Themes page is showing).
let showInPreview = () => {};
let draft = null;
// Theme groups opened or closed by hand (otherwise only the current theme's group is open).
const groupOpen = new Map();
let device = 'phone';
let pickerFor = null;
const MAX_STICKERS = 16;
// Emoji to start from (any emoji from the keyboard works too).
const SUGGESTED = ['⚪', '⚫', '🤍', '🖤', '🤎', '◽', '➕', '✳️', '〰️', '🌿', '☕', '📎', '📌', '🕯️', '🪴', '🐰', '🎀', '💖', '✨', '🌈', '⭐', '🍓', '🌸', '☁️', '🫧', '🍄', '🦋', '🐸', '🧋', '🍑', '🌙', '💫', '🍒', '🌼', '🐻', '🐱', '🍰', '🎧', '💿', '📼', '🪐', '🌷', '🧸', '💌', '🫶'];
const DOODLES = Object.keys(CHARM_NAMES).filter((k) => !['none', 'ears', 'plain'].includes(k));
const blank = () => ({ theme: 'classic', ...Object.fromEntries(PARTS.map((k) => [k, ''])), picture: '', file: null, blob: '', emoji: '', emoji_layout: '', cards: [], card_mix: [], card_seed: 0, stickers: [], hide: [], menu: null, sections_hidden: [], apps: {}, festivals: [], my_days: [], festival_dates: {}, labels: {}, glass: [], looks: {}, bar_decor: {}, floppy: { dress: 'off', colour: 'classic', own: {} } });

// What goes in theme.md: the theme's name, and only the parts you've changed.
function themeFile(d) {
  const base = SKINS[d.theme] || SKINS.classic;
  const out = { theme: d.theme || 'classic' };
  for (const k of PARTS) if (d[k] && d[k] !== (base[k] ?? (OPTIONS[k] ? firstChoice(k) : undefined))) out[k] = d[k];
  if (out.wallpaper === 'picture' || (!out.wallpaper && base.wallpaper === 'picture')) out.picture = d.picture || '';
  if ((out.wallpaper || base.wallpaper) === 'emoji' && d.emoji) {
    out.emoji = d.emoji;
    if (d.emoji_layout) out.emoji_layout = d.emoji_layout;
  }
  const cards = cleanCards(d.cards, Object.keys(OPTIONS.title_font.choices));
  if (cards.length) out.cards = cards;
  if (/^c\d+$/.test(out.card_style || '') && !cards.some((c) => c.id === out.card_style)) delete out.card_style;
  // (Mixed at random: the designs ticked, and the shuffle.)
  const mixed = cleanMix(d.card_mix, Object.keys(CARD_STYLES), cards);
  if (mixed.length) out.card_mix = mixed;
  if (cleanSeed(d.card_seed)) out.card_seed = cleanSeed(d.card_seed);
  if (d.stickers?.length) out.stickers = d.stickers.map(({ what, where, size, tilt, x, y }) => (where === 'desktop' ? { what, where, size, tilt, x, y } : { what, where, size, tilt }));
  if (d.hide?.length) out.hide = [...d.hide];
  if (d.menu && JSON.stringify(d.menu) !== JSON.stringify(DEFAULT_MENU)) out.menu = [...d.menu];
  if (d.sections_hidden?.length) out.sections_hidden = [...d.sections_hidden];
  if (d.festivals?.length) out.festivals = [...d.festivals];
  const dates = cleanFestivalDates(d.festival_dates);
  if (Object.keys(dates).length) out.festival_dates = dates;
  const labels = cleanLabels(d.labels);
  if (Object.keys(labels).length) out.labels = labels;
  if (d.glass?.length) out.glass = Object.keys(GLASS_PLACES).filter((x) => d.glass.includes(x));
  const looks = cleanLooks(d.looks);
  if (Object.keys(looks).length) out.looks = looks;
  const bars = cleanBarDecor(d.bar_decor);
  if (Object.keys(bars).length) out.bar_decor = bars;
  const fl = cleanFloppy(d.floppy, (x) => (CHARMS[x] ? x : emojiList(x, 1)[0] || ''));
  if (fl.dress !== 'off' || fl.colour !== 'classic') out.floppy = fl;
  const mine = cleanMyDays(d.my_days);
  if (mine.length) out.my_days = mine.map(({ name, from, to, what, falling }) => ({ name, from, to, what, ...(falling ? { falling } : {}) }));
  const apps = cleanApps(d.apps);
  if (Object.keys(apps).length) out.apps = apps;
  return out;
}

// A draft to edit, from theme.md's settings (saved, or from a theme file being installed).
function fromSettings(st) {
  return { ...blank(), theme: st.theme in SKINS ? st.theme : 'classic', ...Object.fromEntries(PARTS.map((k) => [k, st[k] || ''])), picture: st.picture || '', emoji: st.emoji || '', emoji_layout: st.emoji_layout || '', cards: JSON.parse(JSON.stringify(st.cards || [])), card_mix: [...(st.card_mix || [])], card_seed: st.card_seed || 0, stickers: (st.stickers || []).map((x) => ({ x: 50, y: 50, ...x })), hide: [...(st.hide || [])], menu: st.menu ? [...st.menu] : null, sections_hidden: [...(st.sections_hidden || [])], apps: JSON.parse(JSON.stringify(st.apps || {})), festivals: [...(st.festivals || [])], my_days: JSON.parse(JSON.stringify(st.my_days || [])), festival_dates: JSON.parse(JSON.stringify(st.festival_dates || {})), labels: { ...(st.labels || {}) }, glass: [...(st.glass || [])], looks: JSON.parse(JSON.stringify(st.looks || {})), bar_decor: JSON.parse(JSON.stringify(st.bar_decor || {})), floppy: JSON.parse(JSON.stringify(st.floppy || { dress: 'off', colour: 'classic', own: {} })) };
}
// theme.md as text: colours, emoji and lists in quotes or as JSON (which is valid YAML).
function themeText(file) {
  const lines = Object.entries(file).filter(([, v]) => v && (!Array.isArray(v) || v.length)).map(([k, v]) => `${k}: ${typeof v === 'object' || k === 'emoji' || k === 'tab_icon' || /^#/.test(v) ? JSON.stringify(v) : v}`);
  return `---\n${lines.join('\n')}\n---\nThe site's theme. Change it under Themes in the back office.\n`;
}
// Reads a theme file written as above (or by hand, as simple "key: value" lines).
function readThemeText(text) {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(String(text || ''));
  if (!m) throw new Error('That isn’t a theme file: it should start with --- lines.');
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = /^([a-z_]+):\s*(.*?)\s*(#.*)?$/.exec(line);
    if (!mm) continue;
    let v = mm[2];
    if (/^[\[{"]/.test(v)) {
      try {
        v = JSON.parse(v);
      } catch {
        continue;
      }
    }
    out[mm[1]] = v;
  }
  if (!out.theme) throw new Error('That theme file doesn’t say which theme it is.');
  return out;
}

// A little window in the theme's colours, for the cards.
function mini(t) {
  const title = `linear-gradient(180deg, ${TITLE_STOPS.map((c, i) => `${themeColour(c, t)} ${[0, 8, 40, 88, 100][i]}%`).join(', ')})`;
  const start = themeColour('#3a9a3a', t);
  const wall = wallpaperCss(t) || `linear-gradient(180deg, ${themeColour('#2e6bd8', t)}, ${themeColour('#b9dcfb', t)})`;
  const p = pointerSvgs(t);
  return h(
    'span',
    { class: 'tm-mini', 'aria-hidden': 'true', style: { background: wall } },
    h('span', { class: 'tm-win', style: { borderColor: themeColour('#0831d9', t) } }, h('span', { class: 'tm-title', style: { background: title } }, t.decoration !== 'none' ? h('span', { class: 'tm-charm', style: { background: `${charmUrl(t.decoration, t, 14)} center / contain no-repeat` } }) : null), h('span', { class: 'tm-body', style: { background: themeColour('#ece9d8', t) } }, h('i'), h('i'), h('i'))),
    h('span', { class: 'tm-start', style: { background: start } }),
    t.pointer !== 'none' ? h('span', { class: 'tm-pointer', style: { background: `${p.arrow} center / contain no-repeat` } }) : null
  );
}

// ctx: { api, toast, putFile, delFile, uploadPicture, refreshAll, saved: () => theme settings }
export function viewThemes(ctx) {
  const saved = ctx.saved() || { theme: 'classic' };
  if (!draft) {
    history = [];
    nightPreview = false;
    seasonPreview = '';
    pictureSets = null;
  }
  draft ||= fromSettings(saved);
  const wrap = h('div', { class: 'field themes' });
  try {
    sessionStorage.setItem('entered', '1');
  } catch {}
  const frame = h('iframe', { class: 'tm-frame', title: 'Preview of your site', src: '/#/', loading: 'eager' });
  const frameBox = h('div', { class: 'tm-frame-box ' + device }, frame);
  const settings = () => ({ ...themeFile(draft), picture: draft.picture, pictureUrl: draft.blob || undefined, night_preview: draft.night_theme ? nightPreview : undefined, season_preview: seasonPreview || undefined });
  let timer;
  const preview = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!draft || !frame.isConnected) return;
      try {
        sessionStorage.setItem('skin-preview', JSON.stringify({ ...settings(), pictureUrl: undefined }));
      } catch {}
      frame.contentWindow?.postMessage({ type: 'skin-preview', theme: settings() }, location.origin);
    }, 40);
  };
  // The menus and taskbar are built when the site opens, so a change to them reopens the preview.
  let lastBuilt = '';
  // (Menus and buttons are built when the site opens, so new words reopen it too.)
  const structure = () => JSON.stringify([draft?.menu, draft?.sections_hidden, draft?.taskbar, cleanLabels(draft?.labels), draft?.floppy]);
  const reloadIfNeeded = () => {
    if (!draft || structure() === lastBuilt) return;
    lastBuilt = structure();
    try {
      sessionStorage.setItem('skin-preview', JSON.stringify(settings()));
    } catch {}
    frame.contentWindow?.location.reload();
  };
  showInPreview = (hash) => {
    if (frame.contentWindow) frame.contentWindow.location.hash = hash;
  };
  frame.addEventListener('load', () => {
    lastBuilt = structure();
    // The site loads its saved theme first; the one being tried goes on top a moment later.
    for (const ms of [0, 600, 1500]) setTimeout(preview, ms);
  });
  const fit = () => {
    // On a phone, the pinned preview is the whole site in miniature (a third of the screen tall).
    const small = device !== 'computer' && matchMedia('(max-width: 979px)').matches;
    if (small) {
      const tall = Math.round(innerHeight * 0.34);
      const scale = tall / 720;
      Object.assign(frame.style, { width: '390px', height: '720px', flex: 'none', transform: `scale(${scale})`, transformOrigin: '0 0' });
      Object.assign(frameBox.style, { width: Math.round(390 * scale) + 'px', height: tall + 'px' });
      return;
    }
    for (const k of ['width', 'height', 'flex', 'transform', 'transformOrigin']) frame.style[k] = '';
    frameBox.style.width = '';
    if (device !== 'computer') return frameBox.style.removeProperty('height');
    const scale = Math.min(1, frameBox.clientWidth / 1280);
    frame.style.transform = `scale(${scale})`;
    frameBox.style.height = 800 * scale + 'px';
  };
  new ResizeObserver(fit).observe(frameBox);
  const onResize = () => (frame.isConnected ? fit() : removeEventListener('resize', onResize));
  addEventListener('resize', onResize);
  const previewBox = h(
    'div',
    { class: 'tm-preview' + (tucked ? ' tucked' : '') },
    h(
      'div',
      { class: 'tm-preview-top' },
      h(
      'div',
      { class: 'chip-row', role: 'radiogroup', 'aria-label': 'Preview on' },
      [['phone', 'Phone'], ['computer', 'Computer']].map(([id, label]) =>
        h('button', { type: 'button', role: 'radio', class: 'chip-btn', 'aria-checked': String(device === id), 'aria-pressed': String(device === id), onclick: (e) => {
          device = id;
          frameBox.className = 'tm-frame-box ' + id;
          frameBox.style.removeProperty('height');
          e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
          fit();
        } }, label)
      )
      ),
      // (On a phone, the preview can be tucked away to give the choices the whole screen.)
      h('button', { type: 'button', class: 'btn small tm-peek', 'aria-expanded': String(!tucked), onclick: (e) => {
        tucked = !tucked;
        previewBox.classList.toggle('tucked', tucked);
        e.currentTarget.setAttribute('aria-expanded', String(!tucked));
        e.currentTarget.textContent = tucked ? 'Show preview' : 'Hide preview';
        fit();
      } }, tucked ? 'Show preview' : 'Hide preview')
    ),
    frameBox,
    h('p', { class: 'hint' }, 'This is your real site, wearing the theme. Nothing changes for visitors until you save.')
  );
  const controls = h('div', { class: 'tm-controls' });
  let drawing = false;
  const redraw = () => {
    if (drawing) return;
    drawing = true;
    try {
      const snap = snapshot(draft);
      if (history[history.length - 1] !== snap) history = [...history, snap].slice(-60);
      controls.replaceChildren(...themeControls(ctx, saved, redraw, preview).filter(Boolean));
    } finally {
      drawing = false;
    }
    preview();
    if (frame.contentDocument?.readyState === 'complete') reloadIfNeeded();
  };
  redraw();
  wrap.append(
    h('div', null, h('h2', { class: 'section-title' }, 'Themes'), h('p', { class: 'hint' }, 'Dress the whole site in your own style, down to the last detail: colours, wallpaper, fonts, bars and corners, how posts sit, the menu, sounds, charms, stickers, effects, the browser tab’s icon, a look for after dark, and even the mouse pointer. Visitors can still switch to dark mode.')),
    h('div', { class: 'tm-layout' }, previewBox, controls)
  );
  return wrap;
}

function themeControls(ctx, saved, redraw, preview) {
  const d = draft;
  const t = resolveSkin({ ...themeFile(d), picture: d.picture, pictureUrl: d.blob || undefined });
  const c = inks(t);
  // The themes, in groups that fold away: only the group with the current theme is open to start
  // with; each folded one is a single line with a strip of its colours.
  const card = (id) => {
      const s = SKINS[id];
      const st = resolveSkin({ theme: id });
      const on = d.theme === id;
      return h(
        'button',
        { type: 'button', role: 'radio', 'aria-checked': String(on), class: 'tm-card' + (on ? ' on' : ''), style: st.pointer !== 'none' ? { cursor: `${pointerSvgs(st).arrow} 3 3, pointer` } : null, onclick: () => {
          // A new theme brings all of its own parts (your stickers and emoji stay).
          draft = { ...blank(), theme: id, picture: d.picture, file: d.file, blob: d.blob, emoji: d.emoji, emoji_layout: d.emoji_layout, stickers: d.stickers, cards: d.cards, card_mix: d.card_mix, card_seed: d.card_seed, ...(d.card_style === MIX ? { card_style: MIX } : {}), hide: d.hide, menu: d.menu, sections_hidden: d.sections_hidden, apps: d.apps, festivals: d.festivals, my_days: d.my_days, festival_dates: d.festival_dates, labels: d.labels, glass: d.glass, looks: d.looks, bar_decor: d.bar_decor, floppy: d.floppy, ...Object.fromEntries(KEEP_ON_SWITCH.map((k) => [k, d[k]])) };
          redraw();
        } },
        mini(st),
        h('b', null, s.name),
        h('small', null, s.vibe)
      );
  };
  const cards = h(
    'div',
    { class: 'tm-groups', role: 'radiogroup', 'aria-label': 'Themes' },
    SKIN_GROUPS.map(([name, ids]) => {
      const here = ids.includes(d.theme);
      return h(
        'details',
        { class: 'tm-gbox' + (here ? ' here' : ''), open: (groupOpen.get(name) ?? here) || null, ontoggle: (e) => (e.currentTarget.open === here ? groupOpen.delete(name) : groupOpen.set(name, e.currentTarget.open)) },
        h(
          'summary',
          null,
          h('b', null, name),
          h('small', null, here ? `${SKINS[d.theme].name} · ${ids.length} themes` : `${ids.length} themes`),
          h('span', { class: 'tm-swatches', 'aria-hidden': 'true' }, ids.map((id) => h('i', { style: { background: `linear-gradient(135deg, ${SKINS[id].main} 50%, ${SKINS[id].accent} 50%)` } })))
        ),
        h('div', { class: 'tm-cards' }, ids.map(card))
      );
    })
  );
  const colour = (key, label) => {
    const value = d[key] || t[key] || '#5a3620';
    const input = h('input', { type: 'color', value, 'aria-label': label });
    input.addEventListener('input', () => {
      d[key] = input.value;
      preview();
    });
    input.addEventListener('change', redraw);
    return h('label', { class: 'colour-pick' }, input, h('span', null, label));
  };
  const chips = (key, options, label, look) =>
    h(
      'div',
      { class: 'design-field wide' },
      h('span', null, label),
      h(
        'div',
        { class: 'tm-chips', role: 'radiogroup', 'aria-label': label },
        options.map(([id, name]) =>
          h('button', { type: 'button', role: 'radio', 'aria-checked': String(t[key] === id), class: 'tm-chip' + (t[key] === id ? ' on' : ''), title: name, onclick: () => {
            d[key] = id;
            redraw();
          } }, look(id), h('span', null, name))
        )
      )
    );
  const wallLook = (id) => {
    if (id === 'picture') return h('span', { class: 'tm-swatch pic', style: d.blob || d.picture ? { background: `url("${d.blob || '/media/' + d.picture}") center / cover` } : null }, d.blob || d.picture ? null : '+');
    const css = id === 'sky' ? `linear-gradient(180deg, ${themeColour('#2e6bd8', t)}, ${themeColour('#b9dcfb', t)} 70%, ${themeColour('#74b843', t)} 70%)` : wallpaperCss({ ...t, wallpaper: id });
    return h('span', { class: 'tm-swatch', style: { background: css } });
  };
  const charmLook = (id) => h('span', { class: 'tm-swatch charm', style: id === 'none' ? null : { background: `${charmUrl(id, t, 22)} center / 22px no-repeat, ${c.soft}` } }, id === 'none' ? '–' : null);
  const pointerLook = (id) => h('span', { class: 'tm-swatch charm', style: { background: `${id === 'none' ? 'url(/cursors/cursor-xp.svg)' : pointerSvgs({ ...t, pointer: id }).arrow} center / 26px no-repeat, ${c.soft}` } });
  const changed = JSON.stringify(themeFile(d)) !== JSON.stringify(themeFile({ theme: saved.theme in SKINS ? saved.theme : 'classic', ...saved })) || !!d.file;
  unsaved = changed;
  const walls = Object.entries(WALLPAPERS).map(([id, w]) => [id, w.name]);
  // Each part of the theme in its own tab, like the sections of Rockbox's Theme Settings.
  const opt = (key, extra = {}) =>
    h(
      'div',
      { class: 'design-field wide' },
      h('span', null, OPTIONS[key].name),
      h(
        'div',
        { class: 'chip-row', role: 'radiogroup', 'aria-label': OPTIONS[key].name },
        Object.entries(OPTIONS[key].choices).map(([id, label]) =>
          h('button', { type: 'button', role: 'radio', class: 'chip-btn', 'aria-checked': String(t[key] === id), 'aria-pressed': String(t[key] === id), style: extra.font && FONT_FAMILIES[id] ? { fontFamily: FONT_FAMILIES[id] } : null, onclick: () => { d[key] = id; redraw(); } }, label)
        )
      )
    );
  const tick = (list, id, label, on) =>
    h('label', { class: 'check tm-tick' }, h('input', { type: 'checkbox', checked: on, onchange: (e) => {
      const set = new Set(d[list] || []);
      e.target.checked === (list === 'hide') ? set.delete(id) : set.add(id);
      d[list] = [...set];
      redraw();
    } }), ' ', label);
  const TABS = {
    colours: ['Colours', () => [
      h('p', { class: 'hint' }, 'Every other shade on the site follows these colours, so it always matches and words stay easy to read.'),
      h('div', { class: 'design-row' }, colour('main', 'Main'), colour('accent', 'Accent'), colour('paper', 'Background'), colour('leather', 'Journal leather')),
      pictureColours(ctx, d, redraw),
      opt('selector')
    ]],
    wallpaper: ['Wallpaper', () => [
      chips('wallpaper', walls, 'Wallpaper', wallLook),
      t.wallpaper === 'picture' || d.wallpaper === 'picture'
        ? h('div', { class: 'design-row' }, ctx.pictureInput(d.picture || d.blob ? 'Change picture' : 'Choose a picture', (f) => {
            d.file = f;
            if (d.blob) URL.revokeObjectURL(d.blob);
            d.blob = URL.createObjectURL(f);
            d.wallpaper = 'picture';
            redraw();
          }), h('span', { class: 'hint' }, 'Your own picture fills the desktop behind everything. It’s cleaned of hidden data like every photo.'))
        : null,
      t.wallpaper === 'emoji' ? emojiWallControls(d, t, redraw, preview) : null,
      opt('wall_time'),
      h('p', { class: 'hint' }, 'Like the classic sky: a warm morning, the day as it is, a golden evening and a starry night, by each visitor’s clock. In dark mode it’s always night.')
    ]],
    words: ['Fonts', () => [opt('font', { font: true }), opt('title_font', { font: true }), opt('text_size')]],
    shapes: ['Bars & corners', () => [opt('bars'), opt('corners'), h('p', { class: 'hint' }, 'Bar styles show in light mode; dark mode keeps its own dark bars.')]],
    cards: ['Post cards', () => [
      cardChoice(d, t, redraw),
      cardMaker(d, t, redraw),
      opt('card_festive'),
      opt('card_corner'),
      h('p', { class: 'hint' }, 'A post can wear a design of its own, and a ribbon of your own words: choose them when you write it (Dress this post). Festive ribbons go on posts written on a festive day you’ve ticked, or one of your own days, in that day’s colours and drawings.')
    ]],
    feed: ['Feed', () => [opt('posts'), opt('density'), opt('page'), t.page !== 'plain' ? opt('page_strength') : null, h('p', { class: 'hint' }, 'Behind the posts: Layered puts the theme’s colours, its pattern (or your emoji or picture) and, when the seasons are on, the season’s or festive day’s drawings behind your posts, softened so they stay easy to read.')]],
    header: ['Profile header', () => [
      opt('header'),
      h('div', { class: 'design-field wide' }, h('span', null, 'What it shows'), h('div', { class: 'tm-ticks' }, ['lastpost', 'status', 'playing', 'countdown', 'nudge'].map((id) => tick('hide', id, HIDEABLE[id], !t.hide.includes(id)))))
    ]],
    menu: ['Menu', () => menuControls(d, t, redraw)],
    bars: ['Taskbar & scrolling', () => [
      opt('taskbar'),
      h('div', { class: 'design-field wide' }, h('span', null, 'In the taskbar'), h('div', { class: 'tm-ticks' }, ['clock', 'traystatus'].map((id) => tick('hide', id, HIDEABLE[id].replace(/ \(.*\)/, ''), !t.hide.includes(id))))),
      opt('scrollbar')
    ]],
    icons: ['Icons & sounds', () => [opt('icons'), opt('sounds'), h('p', { class: 'hint' }, 'Sounds are the site’s little clicks and chimes. Visitors can always mute them.')]],
    charms: ['Charms & pointer', () => [
      chips('decoration', Object.entries(CHARM_NAMES).filter(([id]) => id !== 'plain'), 'Charm on the title bars', charmLook),
      chips('pointer', Object.entries(CHARM_NAMES).filter(([id]) => id !== 'ears'), 'Mouse pointer (on computers)', pointerLook)
    ]],
    effects: ['Effects', () => [
      h('p', { class: 'hint' }, 'A little old-homepage magic. Moving effects stay still for visitors who’ve asked their device for less motion, and never get in the way of tapping or clicking.'),
      opt('name_style'),
      opt('trail'),
      opt('falling')
    ]],
    words_own: ['Words', () => labelControls(d, redraw)],
    floppy: ['Floppy', () => floppyControls(d, t, redraw)],
    seasons: ['Seasons & festive days', () => seasonControls(d, t, redraw, opt)],
    extras: ['Tab icon & after dark', () => [tabIconControls(d, t, redraw), nightControls(d, t, redraw, preview)]],
    apps: ['Apps', () => appControls(d, t, redraw)],
    stickers: [`Stickers${d.stickers.length ? ` (${d.stickers.length})` : ''}`, () => [stickerControls(d, t, c, redraw, preview)]],
    share: ['Share', () => shareControls(ctx, d, redraw)]
  };
  if (!TABS[ownTab]) ownTab = 'colours';
  return [
    cards,
    h(
      'details',
      // (Stays open while you work in it, as everything redraws on each change.)
      { class: 'tm-own', open: ownOpen || t.custom || null, ontoggle: (e) => (ownOpen = e.currentTarget.open) },
      h('summary', null, `Make ${SKINS[d.theme].name} your own`),
      h(
        'div',
        { class: 'tm-tabs', role: 'tablist', 'aria-label': 'Parts of the theme' },
        Object.entries(TABS).map(([id, [label]]) => h('button', { type: 'button', role: 'tab', class: 'tm-tab' + (ownTab === id ? ' on' : ''), 'aria-selected': String(ownTab === id), onclick: () => { ownTab = id; redraw(); } }, label))
      ),
      h('div', { class: 'tm-tabpanel', role: 'tabpanel', 'aria-label': TABS[ownTab][0] }, TABS[ownTab][1]().filter(Boolean)),
      PARTS.some((k) => d[k]) || d.hide.length || d.menu || d.sections_hidden.length || Object.keys(d.apps).length
        ? h('button', { type: 'button', class: 'btn small', onclick: () => { for (const k of PARTS) d[k] = ''; Object.assign(d, { hide: [], menu: null, sections_hidden: [], apps: {} }); redraw(); } }, `Back to ${SKINS[d.theme].name} as it comes`)
        : null
    ),
    // (While there are changes, this row stays in view and says they aren't on the site yet:
    // picking a theme only changes the preview until it's saved.)
    h(
      'div',
      { class: 'row tm-savebar' + (changed ? ' unsaved' : '') },
      changed ? h('span', { class: 'tm-unsaved', role: 'status' }, 'Not saved yet: only the preview has changed.') : null,
      h('button', { type: 'button', class: 'btn go', disabled: !changed, onclick: (e) => save(ctx, saved, e.currentTarget, redraw) }, 'Save the theme'),
      h('button', { type: 'button', class: 'btn', disabled: history.length < 2, title: 'Step back one change', onclick: () => {
        history = history.slice(0, -1);
        draft = { ...JSON.parse(history[history.length - 1]), file: d.file, blob: d.blob };
        redraw();
      } }, '↶ Undo'),
      h('button', { type: 'button', class: 'btn', title: 'A whole new look, every part of it at random: keep pressing until you love one (Undo goes back)', onclick: () => { draft = surprise(d); ownOpen = true; pictureSets = null; redraw(); } }, '🎲 Surprise me'),
      d.theme !== 'classic' || PARTS.some((k) => d[k]) || d.stickers.length ? h('button', { type: 'button', class: 'btn', onclick: () => { draft = blank(); redraw(); } }, 'Back to Classic') : null,
      changed ? h('button', { type: 'button', class: 'btn', onclick: () => { draft = null; history = []; unsaved = false; ctx.go(); } }, 'Discard changes') : null
    )
  ];
}

// ---------- the menu: the main bar's sections and order, and sections left out ----------

function menuControls(d, t, redraw) {
  const menu = [...t.menu];
  const slot = (i) => {
    const sel = h('select', { class: 'input', 'aria-label': `Main menu, place ${i + 1}` }, h('option', { value: '' }, '(nothing)'), Object.entries(SECTIONS).map(([id, label]) => h('option', { value: id, selected: menu[i] === id, disabled: menu.includes(id) && menu[i] !== id }, label)));
    sel.addEventListener('change', () => {
      const next = [...menu];
      next[i] = sel.value;
      d.menu = [...new Set(next.filter(Boolean))];
      if (!d.menu.length) d.menu = ['home'];
      d.sections_hidden = (d.sections_hidden || []).filter((x) => !d.menu.includes(x));
      redraw();
    });
    return h('label', { class: 'tm-slot' }, h('b', null, i + 1), sel);
  };
  return [
    h('p', { class: 'hint' }, 'The main bar holds up to five sections, in this order; the rest are under Others (and in the Explore menu). Sections you untick are left out of the menus and the desktop, though their pages still work.'),
    h('div', { class: 'design-field wide' }, h('span', null, 'Main bar'), h('div', { class: 'tm-slots' }, [0, 1, 2, 3, 4].map(slot))),
    h(
      'div',
      { class: 'design-field wide' },
      h('span', null, 'In the menus'),
      h('div', { class: 'tm-ticks' }, Object.entries(SECTIONS).filter(([id]) => id !== 'home' && !menu.includes(id)).map(([id, label]) => tick2(d, id, label, !t.sections_hidden.includes(id), redraw)))
    )
  ];
}
function tick2(d, id, label, on, redraw) {
  return h('label', { class: 'check tm-tick' }, h('input', { type: 'checkbox', checked: on, onchange: (e) => {
    const set = new Set(d.sections_hidden || []);
    e.target.checked ? set.delete(id) : set.add(id);
    d.sections_hidden = [...set];
    redraw();
  } }), ' ', label);
}

// ---------- sharing: download, install, or swap a theme code with a friend ----------

const toCode = (file) => 'MYTHEME-' + btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(file)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function fromCode(code) {
  const s = String(code).trim().replace(/^MYTHEME-/, '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
}
function shareControls(ctx, d, redraw) {
  const file = themeFile(d);
  delete file.picture;
  const code = toCode(file);
  const codeBox = h('textarea', { class: 'input tm-code', readonly: true, rows: 3, 'aria-label': 'Your theme code' }, code);
  const paste = h('textarea', { class: 'input tm-code', rows: 3, placeholder: 'MYTHEME-…', 'aria-label': 'Paste a theme code' });
  const install = (st) => {
    draft = fromSettings(st);
    ownTab = 'colours';
    redraw();
    ctx.toast('Theme loaded into the preview. Save it to put it on your site.');
  };
  const fileInput = h('input', { type: 'file', accept: '.md,text/markdown,text/plain', class: 'sr' });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    try {
      if (f.size > 100000) throw new Error('That file is too big to be a theme.');
      install(readThemeText(await f.text()));
    } catch (e) {
      ctx.toast(e.message, true);
    }
  });
  return [
    h('p', { class: 'hint' }, 'Themes travel like Rockbox themes: as one small file. Send yours to a friend, or try theirs. (Your own wallpaper picture stays on your site.)'),
    h(
      'div',
      { class: 'row' },
      h('button', { type: 'button', class: 'btn small', onclick: () => {
        const url = URL.createObjectURL(new Blob([themeText(file)], { type: 'text/markdown' }));
        const a = h('a', { href: url, download: `${(SKINS[d.theme]?.name || 'theme').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-theme.md` });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } }, 'Download theme file'),
      h('label', { class: 'btn small' }, 'Install a theme file', fileInput)
    ),
    h('div', { class: 'design-field wide' }, h('span', null, 'Your theme code'), codeBox, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: async () => {
      try {
        await navigator.clipboard.writeText(code);
        ctx.toast('Copied.');
      } catch {
        codeBox.select();
      }
    } }, 'Copy'))),
    h('div', { class: 'design-field wide' }, h('span', null, 'A friend’s theme code'), paste, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: () => {
      try {
        const st = fromCode(paste.value);
        if (!st || typeof st !== 'object' || !st.theme) throw new Error();
        install(st);
      } catch {
        ctx.toast('That doesn’t look like a theme code. Copy the whole thing, starting MYTHEME-.', true);
      }
    } }, 'Try it')))
  ];
}

// Leaving the back office with a theme that isn't saved yet asks first, so it's never lost
// without a word.
let unsaved = false;
window.addEventListener('beforeunload', (e) => {
  if (!unsaved || !draft) return;
  e.preventDefault();
  e.returnValue = '';
});

async function save(ctx, saved, btn, redraw) {
  btn.disabled = true;
  try {
    if (draft.file && draft.wallpaper === 'picture') draft.picture = await ctx.uploadPicture(draft.file, 'wallpaper');
    const file = themeFile(draft);
    await ctx.putFile('theme.md', themeText(file));
    history = [];
    unsaved = false;
    if (saved.picture && saved.picture !== file.picture) await ctx.delFile(saved.picture).catch(() => {});
    if (draft.blob) URL.revokeObjectURL(draft.blob);
    draft = null;
    await ctx.refreshAll();
    ctx.toast(`${SKINS[file.theme]?.name || 'Your'} theme is on your site now.`);
    ctx.go();
  } catch (e) {
    btn.disabled = false;
    ctx.toast(e.message, true);
  }
}

// ---------- the emoji wallpaper ----------

function emojiWallControls(d, t, redraw, preview) {
  const input = h('input', { class: 'input tm-emoji-in', value: (t.emoji || []).join(''), maxlength: 40, placeholder: '🐰🎀✨', 'aria-label': 'Emoji for the wallpaper', inputmode: 'text' });
  input.addEventListener('input', () => {
    d.emoji = emojiList(input.value, 3).join('');
    preview();
  });
  input.addEventListener('change', redraw);
  const add = (e) => {
    const list = emojiList(d.emoji || (t.emoji || []).join(''), 3);
    d.emoji = (list.length >= 3 ? [...list.slice(1), e] : [...list, e]).join('');
    redraw();
  };
  return h(
    'div',
    { class: 'design-field wide tm-emoji' },
    h('span', null, 'Your emoji (up to three, from your keyboard or below)'),
    h('div', { class: 'row' }, input, d.emoji ? h('button', { type: 'button', class: 'btn small', onclick: () => { d.emoji = ''; redraw(); } }, 'Clear') : null),
    h('div', { class: 'tm-emoji-pal', role: 'group', 'aria-label': 'Suggested emoji' }, SUGGESTED.map((e) => h('button', { type: 'button', class: 'tm-emoji-btn', 'aria-label': `Add ${e}`, onclick: () => add(e) }, e))),
    h(
      'div',
      { class: 'chip-row', role: 'radiogroup', 'aria-label': 'Emoji layout' },
      Object.entries(EMOJI_LAYOUTS).map(([id, L]) => h('button', { type: 'button', role: 'radio', class: 'chip-btn', 'aria-checked': String(t.emojiLayout === id), 'aria-pressed': String(t.emojiLayout === id), onclick: () => { d.emoji_layout = id; redraw(); } }, L.name))
    )
  );
}

// ---------- stickers ----------

function stickerLook(s, t, size = 30) {
  return CHARMS[s.what] ? h('span', { class: 'tm-stk-look', style: { width: size + 'px', height: size + 'px', background: `${charmUrl(s.what, t, 64)} center / contain no-repeat` } }) : h('span', { class: 'tm-stk-look', style: { width: size + 'px', height: size + 'px', fontSize: size * 0.82 + 'px' } }, s.what);
}

function stickerControls(d, t, c, redraw, preview) {
  const list = d.stickers;
  const rows = list.map((s, i) => {
    const where = h('select', { class: 'input', 'aria-label': 'Where it goes' }, Object.entries(STICKER_SPOTS).map(([id, label]) => h('option', { value: id, selected: s.where === id }, label)));
    where.addEventListener('change', () => {
      s.where = where.value;
      redraw();
    });
    const tilt = h('input', { type: 'range', min: -30, max: 30, step: 2, value: s.tilt || 0, 'aria-label': 'Tilt' });
    tilt.addEventListener('input', () => {
      s.tilt = +tilt.value;
      preview();
    });
    tilt.addEventListener('change', redraw);
    return [
      h(
        'div',
        { class: 'tm-stk-row' },
        h('button', { type: 'button', class: 'tm-stk-what' + (pickerFor === i ? ' open' : ''), 'aria-label': 'Choose the sticker', 'aria-expanded': String(pickerFor === i), onclick: () => { pickerFor = pickerFor === i ? null : i; redraw(); } }, stickerLook(s, t)),
        where,
        h('div', { class: 'tm-sizes', role: 'radiogroup', 'aria-label': 'Size' }, Object.entries(STICKER_SIZES).map(([id, label]) => h('button', { type: 'button', role: 'radio', class: 'tm-size' + (s.size === id ? ' on' : ''), 'aria-checked': String(s.size === id), title: label, onclick: () => { s.size = id; redraw(); } }, id.toUpperCase()))),
        h('label', { class: 'tm-tilt' }, h('span', null, 'Tilt'), tilt),
        h('button', { type: 'button', class: 'btn small danger', 'aria-label': 'Remove this sticker', onclick: () => { list.splice(i, 1); pickerFor = null; redraw(); } }, '×')
      ),
      pickerFor === i ? stickerPicker(s, t, redraw) : null
    ];
  });
  const desk = list.filter((s) => s.where === 'desktop');
  return h(
    'div',
    { class: 'tm-stickers' },
    h('p', { class: 'hint' }, 'Little extras in places that suit them: the title bars, the corners of the window, your profile picture, every post, next to the clock, or anywhere on the computer desktop. They never get in the way of tapping. Any emoji works, or one of the drawings.'),
    rows,
    desk.length ? desktopBoard(desk, t, preview) : null,
    list.length < MAX_STICKERS
      ? h('button', { type: 'button', class: 'btn small', onclick: () => {
          list.push({ what: t.pointer && t.pointer !== 'none' ? t.pointer : 'twinkle', where: list.some((s) => s.where === 'corner-bl') ? 'title' : 'corner-bl', size: 'm', tilt: 0, x: 50, y: 50 });
          pickerFor = list.length - 1;
          redraw();
        } }, '+ Add a sticker')
      : h('p', { class: 'hint' }, `That’s the most stickers (${MAX_STICKERS}).`)
  );
}

function stickerPicker(s, t, redraw) {
  const input = h('input', { class: 'input tm-emoji-in', placeholder: 'Or type any emoji', maxlength: 20, 'aria-label': 'Any emoji for the sticker' });
  input.addEventListener('input', () => {
    const e = emojiList(input.value, 1)[0];
    if (e) {
      s.what = e;
      redraw();
    }
  });
  return h(
    'div',
    { class: 'tm-picker' },
    h('div', { class: 'tm-pick-grid', role: 'group', 'aria-label': 'Drawings' }, DOODLES.map((id) => h('button', { type: 'button', class: 'tm-pick' + (s.what === id ? ' on' : ''), title: CHARM_NAMES[id], 'aria-label': CHARM_NAMES[id], onclick: () => { s.what = id; redraw(); } }, stickerLook({ what: id }, t, 26)))),
    h('div', { class: 'tm-pick-grid', role: 'group', 'aria-label': 'Emoji' }, SUGGESTED.map((e) => h('button', { type: 'button', class: 'tm-pick' + (s.what === e ? ' on' : ''), 'aria-label': e, onclick: () => { s.what = e; redraw(); } }, stickerLook({ what: e }, t, 24)))),
    input
  );
}

// A small picture of the computer desktop: drag the stickers to where they should sit.
function desktopBoard(desk, t, preview) {
  const sky = `linear-gradient(180deg, ${themeColour('#2e6bd8', t)}, ${themeColour('#b9dcfb', t)} 75%, ${themeColour('#74b843', t)} 75%)`;
  const board = h('div', { class: 'tm-board', style: { background: wallpaperCss(t) || sky } }, h('span', { class: 'tm-board-bar', style: { background: themeColour('#2157d7', t) } }));
  for (const s of desk) {
    const el = h('span', { class: 'tm-board-stk tm-board-' + s.size, style: { left: s.x + '%', top: s.y + '%', rotate: (s.tilt || 0) + 'deg' }, role: 'img', 'aria-label': 'Sticker on the desktop: drag to move' }, stickerLook(s, t, { s: 16, m: 24, l: 40 }[s.size] || 24));
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const r = board.getBoundingClientRect();
        s.x = Math.round(Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100)));
        s.y = Math.round(Math.max(0, Math.min(100, ((ev.clientY - r.top) / (r.height * 0.94)) * 100)));
        el.style.left = s.x + '%';
        el.style.top = s.y + '%';
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        preview();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    board.append(el);
  }
  return h('div', { class: 'design-field wide' }, h('span', null, 'On the computer desktop: drag them where you like (windows open on top of them)'), board);
}

// ---------- each app's own look ----------

function appControls(d, t, redraw) {
  d.apps ||= {};
  const setAll = (look) => {
    for (const id of Object.keys(APPS)) d.apps[id] = { ...(d.apps[id] || {}), look };
    redraw();
  };
  const fontAll = (font) => {
    for (const id of Object.keys(APPS)) d.apps[id] = { ...(d.apps[id] || {}), font };
    redraw();
  };
  const cards = Object.entries(APPS).map(([id, app]) => {
    const a = d.apps[id] || {};
    const look = a.look || 'auto';
    const set = (k, v) => {
      d.apps[id] = { ...(d.apps[id] || {}), [k]: v };
      if (k === 'look' && v === 'custom' && !d.apps[id].colour) d.apps[id].colour = t.accent;
      redraw();
      showInPreview('#/' + id);
    };
    const colour = h('input', { type: 'color', value: a.colour || t.accent, 'aria-label': `${app.name} colour` });
    colour.addEventListener('change', () => set('colour', colour.value));
    return h(
      'section',
      { class: 'tm-app', 'aria-label': app.name },
      h('div', { class: 'tm-app-head' }, h('b', null, app.name), h('button', { type: 'button', class: 'btn small', onclick: () => showInPreview('#/' + id) }, 'Show it')),
      h(
        'div',
        { class: 'chip-row', role: 'radiogroup', 'aria-label': `${app.name} look` },
        Object.entries(APP_LOOKS).map(([v, label]) => h('button', { type: 'button', role: 'radio', class: 'chip-btn', 'aria-checked': String(look === v), 'aria-pressed': String(look === v), onclick: () => set('look', v) }, label)),
        look === 'custom' ? h('label', { class: 'colour-pick' }, colour, h('span', null, 'Its colour')) : null
      ),
      app.extras.map((k) => {
        const spec = APP_EXTRAS[k];
        const cur = a[k] || Object.keys(spec.choices)[0];
        return h(
          'div',
          { class: 'tm-app-extra' },
          h('span', null, spec.name),
          h('div', { class: 'chip-row', role: 'radiogroup', 'aria-label': `${app.name} ${spec.name.toLowerCase()}` }, Object.entries(spec.choices).map(([v, label]) => h('button', { type: 'button', role: 'radio', class: 'chip-btn small', 'aria-checked': String(cur === v), 'aria-pressed': String(cur === v), style: k === 'font' && FONT_FAMILIES[v] ? { fontFamily: FONT_FAMILIES[v] } : null, onclick: () => set(k, v) }, label)))
        );
      })
    );
  });
  return [
    h('p', { class: 'hint' }, 'Each app can have a look of its own, with the same choices everywhere: as the theme has it, its original era look, in the theme’s colour, or a colour of its own. Each app keeps its era’s own lettering unless you pick the theme’s font or another one for it. Some apps have extras too, like the journal’s paper and handwriting. Tap Show it to see the app in the preview.'),
    h('div', { class: 'row tm-app-all' }, h('span', { class: 'hint' }, 'Every app:'), Object.entries(APP_LOOKS).filter(([v]) => v !== 'custom').map(([v, label]) => h('button', { type: 'button', class: 'btn small', onclick: () => setAll(v) }, label))),
    h('div', { class: 'row tm-app-all' }, h('span', { class: 'hint' }, 'Every app’s font:'), h('button', { type: 'button', class: 'btn small', onclick: () => fontAll('theme') }, 'The theme’s font'), h('button', { type: 'button', class: 'btn small', onclick: () => fontAll('own') }, 'Each its own')),
    h('div', { class: 'tm-apps' }, cards)
  ];
}

// ---------- the browser tab's icon, and another theme after dark ----------

function tabIconControls(d, t, redraw) {
  const set = (v) => {
    d.tab_icon = v;
    redraw();
  };
  const input = h('input', { class: 'input tm-emoji-in', placeholder: 'Or type any emoji', maxlength: 20, 'aria-label': 'Any emoji for the tab icon' });
  input.addEventListener('input', () => {
    const e = emojiList(input.value, 1)[0];
    if (e) set(e);
  });
  return h(
    'div',
    { class: 'design-field wide' },
    h('span', null, 'Browser tab icon'),
    h('p', { class: 'hint' }, 'The little picture on your site’s browser tab and bookmarks.'),
    h(
      'div',
      { class: 'tm-pick-grid', role: 'radiogroup', 'aria-label': 'Browser tab icon' },
      h('button', { type: 'button', role: 'radio', class: 'tm-pick tm-pick-own' + (!t.tab_icon ? ' on' : ''), 'aria-checked': String(!t.tab_icon), title: 'The site’s own', 'aria-label': 'The site’s own', onclick: () => set('') }, h('img', { src: '/icons/icon.svg', alt: '', width: 22, height: 22 })),
      DOODLES.map((id) => h('button', { type: 'button', role: 'radio', class: 'tm-pick' + (t.tab_icon === id ? ' on' : ''), 'aria-checked': String(t.tab_icon === id), title: CHARM_NAMES[id], 'aria-label': CHARM_NAMES[id], onclick: () => set(id) }, stickerLook({ what: id }, t, 24))),
      SUGGESTED.slice(14, 40).map((e) => h('button', { type: 'button', role: 'radio', class: 'tm-pick' + (t.tab_icon === e ? ' on' : ''), 'aria-checked': String(t.tab_icon === e), 'aria-label': e, onclick: () => set(e) }, stickerLook({ what: e }, t, 22)))
    ),
    input
  );
}

function nightControls(d, t, redraw, preview) {
  const sel = h(
    'select',
    { class: 'input', 'aria-label': 'After dark' },
    h('option', { value: '' }, 'Keep the same look'),
    Object.entries(SKINS)
      .filter(([id]) => id !== d.theme)
      .map(([id, s]) => h('option', { value: id, selected: t.night_theme === id }, `${s.name}: ${s.vibe}`))
  );
  sel.addEventListener('change', () => {
    d.night_theme = sel.value;
    nightPreview = !!sel.value;
    redraw();
  });
  return h(
    'div',
    { class: 'design-field wide tm-night' },
    h('span', null, 'After dark'),
    h('p', { class: 'hint' }, 'From 7pm to 7am (wherever your visitor is), your site can change into another theme’s colours, wallpaper, charm and pointer. Everything else stays yours.'),
    sel,
    t.night_theme
      ? h(
          'div',
          { class: 'chip-row', role: 'radiogroup', 'aria-label': 'Preview' },
          [[false, '☀️ Daytime'], [true, '🌙 After dark']].map(([v, label]) =>
            h('button', { type: 'button', role: 'radio', class: 'chip-btn', 'aria-checked': String(nightPreview === v), 'aria-pressed': String(nightPreview === v), onclick: () => { nightPreview = v; redraw(); } }, label)
          )
        )
      : null
  );
}

// ---------- colours from a picture ----------
// Finds a picture's main colours (in this browser: the picture isn't uploaded) and offers a
// few colour sets made from them.

function pictureColours(ctx, d, redraw) {
  const input = h('input', { type: 'file', accept: 'image/*', class: 'sr' });
  const run = async (src) => {
    try {
      pictureSets = await paletteFrom(src);
      redraw();
    } catch {
      ctx.toast('That picture couldn’t be read. Try a JPEG or PNG.', true);
    }
  };
  input.addEventListener('change', () => input.files?.[0] && run(input.files[0]));
  const own = d.blob || (d.picture ? '/media/' + d.picture : '');
  return h(
    'div',
    { class: 'design-field wide tm-fromPic' },
    h('span', null, 'Colours from a picture'),
    h(
      'div',
      { class: 'row' },
      h('label', { class: 'btn small' }, '🎨 Choose a picture', input),
      own ? h('button', { type: 'button', class: 'btn small', onclick: () => run(own) }, 'From my wallpaper') : null,
      h('span', { class: 'hint' }, 'A favourite photo, an album cover, your outfit… Your picture stays on this device.')
    ),
    pictureSets
      ? h(
          'div',
          { class: 'tm-sets', role: 'group', 'aria-label': 'Colour sets from your picture' },
          pictureSets.map((set, i) =>
            h(
              'button',
              { type: 'button', class: 'tm-set', 'aria-label': `Colour set ${i + 1}`, onclick: () => { Object.assign(d, set); redraw(); } },
              ['main', 'accent', 'paper'].map((k) => h('span', { style: { background: set[k] } })),
              h('small', null, set.name)
            )
          )
        )
      : null
  );
}
let pictureSets = null;

async function paletteFrom(src) {
  const img = src instanceof Blob ? await createImageBitmap(src) : await new Promise((ok, no) => {
    const el = new Image();
    el.onload = () => ok(el);
    el.onerror = no;
    el.src = src;
  });
  const W = 72;
  const H = Math.max(1, Math.round((W * (img.height || 1)) / (img.width || 1)));
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = Math.min(H, 120);
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, cv.width, cv.height);
  const px = g.getImageData(0, 0, cv.width, cv.height).data;
  const pts = [];
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200) pts.push([px[i], px[i + 1], px[i + 2]]);
  if (!pts.length) throw new Error('empty');
  // A few rounds of k-means: the picture's six main colours, biggest first.
  let centres = Array.from({ length: 6 }, (_, k) => pts[Math.floor(((k + 0.5) / 6) * pts.length)]);
  let groups = [];
  for (let round = 0; round < 8; round++) {
    groups = centres.map(() => ({ n: 0, r: 0, g: 0, b: 0 }));
    for (const p of pts) {
      let best = 0;
      let bd = Infinity;
      centres.forEach((c, j) => {
        const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (dd < bd) (bd = dd), (best = j);
      });
      const q = groups[best];
      q.n++;
      q.r += p[0];
      q.g += p[1];
      q.b += p[2];
    }
    centres = groups.map((q, j) => (q.n ? [q.r / q.n, q.g / q.n, q.b / q.n] : centres[j]));
  }
  const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const found = centres.map((c, j) => ({ hex: hex(c), n: groups[j].n, hsl: hexHsl(hex(c)) })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  // The main colour: plenty of it, and colourful; the accent: another colourful one, a different hue.
  const lively = [...found].sort((a, b) => b.n * (0.2 + b.hsl[1]) * (1 - Math.abs(b.hsl[2] - 0.5)) - a.n * (0.2 + a.hsl[1]) * (1 - Math.abs(a.hsl[2] - 0.5)));
  const main = lively[0];
  const apart = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  const accent = lively.find((x) => x !== main && apart(x.hsl[0], main.hsl[0]) > 35 && x.hsl[1] > 0.15) || { hsl: [(main.hsl[0] + 150) % 360, Math.max(0.45, main.hsl[1]), 0.48] };
  const tone = ([hh, ss], l, smax = 1) => hslHex(hh, Math.min(smax, Math.max(0.3, ss)), l);
  const paperFrom = (x) => hslHex(x.hsl[0], Math.min(0.45, x.hsl[1] * 0.6 + 0.08), 0.91);
  const lightest = [...found].sort((a, b) => b.hsl[2] - a.hsl[2])[0];
  return [
    { name: 'Bold', main: tone(main.hsl, Math.min(0.5, Math.max(0.36, main.hsl[2]))), accent: tone(accent.hsl, 0.46), paper: paperFrom(lightest) },
    { name: 'Swapped', main: tone(accent.hsl, 0.44), accent: tone(main.hsl, 0.48), paper: paperFrom(main) },
    { name: 'Soft', main: tone(main.hsl, 0.62, 0.55), accent: tone(accent.hsl, 0.6, 0.5), paper: hslHex(main.hsl[0], 0.35, 0.94) },
    { name: 'Deep', main: tone(main.hsl, 0.3), accent: tone(accent.hsl, 0.4), paper: paperFrom(accent) }
  ];
}

// ---------- surprise me: a random theme that still hangs together ----------

const anyOf = (list) => list[Math.floor(Math.random() * list.length)];
function surprise(d) {
  const theme = anyOf(Object.keys(SKINS));
  const chance = (p) => Math.random() < p;
  const choose = (k, weights) => anyOf(weights || Object.keys(OPTIONS[k].choices));
  const some = (list, min, max) => [...list].sort(() => Math.random() - 0.5).slice(0, min + Math.floor(Math.random() * (max - min + 1)));
  const charms = Object.keys(CHARMS).filter((id) => !['none', 'ears', 'plain'].includes(id));
  const drawingOrEmoji = () => (chance(0.65) ? anyOf(charms) : anyOf(SUGGESTED));

  // Colours: a scheme picked at random (they still go together).
  const hue = Math.random() * 360;
  const scheme = anyOf(['analogous', 'complementary', 'triadic', 'split', 'pastel', 'bold', 'muted', 'neon']);
  const sat = { pastel: 0.45, bold: 0.75, muted: 0.28, neon: 0.95 }[scheme] ?? 0.45 + Math.random() * 0.35;
  const lit = { pastel: 0.62, neon: 0.5, muted: 0.42 }[scheme] ?? 0.38 + Math.random() * 0.16;
  const turn = { analogous: anyOf([30, -30, 45]), complementary: 180, triadic: anyOf([120, -120]), split: anyOf([150, 210]) }[scheme] ?? anyOf([150, 180, 120, -60, 40, 200]);
  const main = hslHex(hue, sat, lit);
  const accent = hslHex(hue + turn, Math.min(1, sat + 0.05), Math.min(0.62, lit + 0.06));
  const paper = hslHex(hue + anyOf([0, 0, 20, -20, turn]), scheme === 'muted' ? 0.12 : 0.2 + Math.random() * 0.35, 0.89 + Math.random() * 0.07);

  // Each app: a look of its own, and sometimes its own colour, paper, handwriting, map and font.
  const apps = {};
  for (const [id, app] of Object.entries(APPS)) {
    if (chance(0.35)) continue;
    const one = { look: anyOf(['auto', 'original', 'tint', 'custom']) };
    if (one.look === 'custom') one.colour = hslHex(hue + anyOf([0, turn, 60, -60, 180]), sat, lit);
    for (const k of app.extras) if (chance(0.5)) one[k] = anyOf(Object.keys(APP_EXTRAS[k].choices));
    apps[id] = one;
  }

  // Stickers in a few places that suit them.
  const stickers = chance(0.6)
    ? Array.from({ length: 1 + Math.floor(Math.random() * 5) }, () => ({ what: drawingOrEmoji(), where: anyOf(Object.keys(STICKER_SPOTS)), size: anyOf(Object.keys(STICKER_SIZES)), tilt: anyOf([0, 0, -12, -6, 6, 12, 20, -20]), x: 10 + Math.floor(Math.random() * 80), y: 10 + Math.floor(Math.random() * 75) }))
    : [];

  // The wallpaper: a pattern, the sky, or emoji (your own picture stays yours to choose).
  const wallpaper = anyOf([...Object.keys(WALLPAPERS).filter((id) => id !== 'picture'), 'emoji']);

  // The seasons: off, following the date, or a season or festive day picked at random.
  const seasons = anyOf(['off', 'off', 'auto', 'auto', anyOf(Object.keys(SEASONS)), anyOf(Object.keys(FESTIVALS))]);

  // Floppy: as he is, dressed for the day, or an outfit of his own.
  const dress = anyOf(['off', 'auto', 'own', 'own']);
  const piece = (k) => anyOf(Object.keys(FLOPPY_PIECES[k].choices));
  const floppy = { dress, colour: anyOf(['classic', 'theme', 'own']), hex: hslHex(hue + anyOf([0, turn, 90]), 0.55, 0.38), own: dress === 'own' ? { hat: piece('hat'), eyes: piece('eyes'), neck: piece('neck'), held: chance(0.5) ? piece('held') : drawingOrEmoji(), tint: hslHex(hue + turn, 0.7, 0.5) } : {} };

  return {
    ...blank(),
    theme,
    // Kept: your own picture, your menu, words and hidden sections, your own days and dates.
    picture: d.picture,
    file: d.file,
    blob: d.blob,
    hide: d.hide,
    menu: d.menu,
    sections_hidden: d.sections_hidden,
    labels: d.labels,
    my_days: d.my_days,
    festival_dates: d.festival_dates,
    festivals: seasons === 'auto' ? some(Object.keys(FESTIVALS), 2, 8) : d.festivals,
    looks: d.looks,
    hemisphere: d.hemisphere,
    main,
    accent,
    paper,
    leather: chance(0.4) ? hslHex(hue + anyOf([0, turn, 20]), 0.4, 0.3) : '',
    wallpaper,
    emoji: wallpaper === 'emoji' ? some(SUGGESTED, 1, 3).join('') : d.emoji,
    emoji_layout: wallpaper === 'emoji' ? anyOf(Object.keys(EMOJI_LAYOUTS)) : '',
    decoration: anyOf(charms),
    pointer: chance(0.15) ? 'none' : anyOf(charms),
    font: choose('font'),
    title_font: choose('title_font'),
    text_size: choose('text_size', ['m', 'm', 'm', 's', 'l']),
    selector: choose('selector'),
    bars: choose('bars'),
    corners: choose('corners'),
    posts: choose('posts', ['cards', 'cards', 'lines']),
    density: choose('density'),
    page: choose('page', ['layered', 'layered', 'pattern', 'wallpaper', 'tint']),
    card_style: choose('card_style'),
    card_festive: choose('card_festive', ['on', 'on', 'off']),
    card_corner: choose('card_corner'),
    page_strength: choose('page_strength'),
    scrollbar: choose('scrollbar', ['classic', 'themed', 'themed', 'thin']),
    taskbar: d.taskbar,
    icons: choose('icons', ['colour', 'colour', 'soft', 'mono']),
    sounds: choose('sounds'),
    header: choose('header', ['banner', 'banner', 'card', 'minimal']),
    name_style: choose('name_style'),
    trail: choose('trail', ['none', 'none', ...Object.keys(OPTIONS.trail.choices)]),
    falling: choose('falling', ['none', 'none', 'none', ...Object.keys(OPTIONS.falling.choices)]),
    seasons,
    tab_icon: chance(0.6) ? drawingOrEmoji() : '',
    night_theme: chance(0.35) ? anyOf(Object.keys(SKINS).filter((id) => id !== theme)) : '',
    glass: chance(0.5) ? some(Object.keys(GLASS_PLACES), 1, 6) : [],
    glass_style: choose('glass_style'),
    glass_strength: choose('glass_strength'),
    stickers,
    apps,
    floppy
  };
}

// A draft as text, to compare and to step back to (the picture file itself isn't part of it).
function snapshot(dd) {
  const { file, blob, ...rest } = dd || {};
  return JSON.stringify(rest);
}

// ---------- the seasons and festive days ----------

const WHEN = { lunar_new_year: 'late January or February', hanami: 'late March to early April', childrens_day: 'carp streamers, 5 May', dragon_boat: 'May or June', tanabata: 'the star festival, 7 July', mid_autumn: 'September or early October', nowruz: 'the spring new year, around 21 March', holi: 'the festival of colours, in March', ramadan: 'the month of fasting: just a quiet lantern', eid_al_fitr: 'at the end of Ramadan', eid_al_adha: 'the Feast of Sacrifice', diwali: 'the festival of lights, October or November', yalda: 'the longest night, around 21 December', dia_de_reyes: '6 January', carnival: 'the days before Lent, February or March', dia_de_muertos: 'marigolds and paper bunting, 1 and 2 November', st_patricks: '17 March', easter: 'March or April', midsummer: 'around 21 June', bonfire_night: '5 November', halloween: '24 to 31 October', hanukkah: 'eight nights in December', christmas: '1 to 26 December' };
const REGIONS = [
  ['East Asia', ['lunar_new_year', 'hanami', 'childrens_day', 'dragon_boat', 'tanabata', 'mid_autumn']],
  ['South and Central Asia, and the Middle East', ['nowruz', 'holi', 'ramadan', 'eid_al_fitr', 'eid_al_adha', 'diwali', 'yalda']],
  ['Latin America', ['dia_de_reyes', 'carnival', 'dia_de_muertos']],
  ['Europe and beyond', ['st_patricks', 'easter', 'midsummer', 'bonfire_night', 'halloween', 'hanukkah', 'christmas']]
];
const festName = (id) => FESTIVALS[id].name + (FESTIVALS[id].also ? ` (${FESTIVALS[id].also})` : '');
function seasonControls(d, t, redraw, opt) {
  d.my_days ||= [];
  const chip = (id, label) =>
    h('button', { type: 'button', role: 'radio', class: 'chip-btn', 'aria-checked': String(t.seasons === id), 'aria-pressed': String(t.seasons === id), onclick: () => { d.seasons = id; seasonPreview = ''; redraw(); } }, label);
  const tick = (id) => {
    const on = (d.festivals || []).includes(id);
    return h(
      'div',
      { class: 'tm-fest-row' },
      h('label', { class: 'check tm-tick tm-fest' }, h('input', { type: 'checkbox', checked: on, onchange: (e) => {
        const set = new Set(d.festivals || []);
        e.target.checked ? set.add(id) : set.delete(id);
        d.festivals = Object.keys(FESTIVALS).filter((x) => set.has(x));
        if (e.target.checked) seasonPreview = id;
        redraw();
      } }), ' ', h('span', null, h('b', null, festName(id)), h('small', null, WHEN[id]))),
      on ? festivalDate(d, id, redraw) : null
    );
  };
  const auto = t.seasons === 'auto';
  const mine = cleanMyDays(d.my_days);
  const previews = [['', 'Today'], ...Object.entries(SEASONS).map(([id, x]) => [id, x.name]), ...(d.festivals || []).map((id) => [id, FESTIVALS[id].name]), ...mine.map((m, i) => [`my_${i + 1}`, m.name])];
  return [
    h('p', { class: 'hint' }, 'Little touches for the time of year, in every theme: snow settling on your windows and apps in winter, blossom and new shoots in spring, sunshine and bunting in summer, leaves falling and piling up in autumn, or a decoration for a festive day. Very gentle, and they never get in the way. Pick one yourself, or let your site follow the date.'),
    h('div', { class: 'design-field wide' }, h('span', null, 'Season'), h('div', { class: 'chip-row', role: 'radiogroup', 'aria-label': 'Season' }, chip('off', 'Off'), chip('auto', '📅 Automatic, by the date'), Object.entries(SEASONS).map(([id, x]) => chip(id, x.name)))),
    h(
      'div',
      { class: 'design-field wide' },
      h('span', null, 'Or a festive day'),
      REGIONS.map(([region, ids]) => h('div', { class: 'tm-region' }, h('small', null, region), h('div', { class: 'chip-row', role: 'radiogroup', 'aria-label': `Festive day: ${region}` }, ids.map((id) => chip(id, FESTIVALS[id].name))))),
      mine.length ? h('div', { class: 'tm-region' }, h('small', null, 'Your own days'), h('div', { class: 'chip-row', role: 'radiogroup', 'aria-label': 'Festive day: your own' }, mine.map((m, i) => chip(`my_${i + 1}`, m.name)))) : null
    ),
    auto
      ? [
          opt('hemisphere'),
          h(
            'div',
            { class: 'design-field wide' },
            h('span', null, 'Festive days that come round by themselves'),
            h('p', { class: 'hint' }, 'Tick the ones you celebrate. On their days your site wears a little decoration of the day, the kind people put up at home. Your own days below always come round.'),
            REGIONS.map(([region, ids]) => h('div', { class: 'tm-region' }, h('small', null, region), h('div', { class: 'tm-ticks tm-fests' }, ids.map(tick))))
          )
        ]
      : null,
    glassControls(d, redraw, opt),
    looksControls(d, t, redraw),
    barControls(d, t, redraw),
    myDaysControls(d, t, redraw),
    auto
      ? h(
          'div',
          { class: 'design-field wide' },
          h('span', null, 'Preview'),
          h('div', { class: 'chip-row', role: 'radiogroup', 'aria-label': 'Preview a season or festive day' }, previews.map(([id, label]) => h('button', { type: 'button', role: 'radio', class: 'chip-btn', 'aria-checked': String(seasonPreview === id), 'aria-pressed': String(seasonPreview === id), onclick: () => { seasonPreview = id; redraw(); } }, label)))
        )
      : null
  ].flat();
}

// Days of your own: a birthday, an anniversary, a team's big day, a festival that isn't here.
function myDaysControls(d, t, redraw) {
  const list = d.my_days;
  const rows = list.map((m, i) => {
    const name = h('input', { class: 'input', value: m.name || '', maxlength: 40, placeholder: 'Its name', 'aria-label': 'Name of the day' });
    name.addEventListener('change', () => { m.name = name.value; redraw(); });
    const date = (key, label) => {
      const el = h('input', { type: 'date', class: 'input', value: m[key] ? `2024-${m[key]}` : '', 'aria-label': label });
      el.addEventListener('change', () => { m[key] = el.value ? el.value.slice(5) : ''; if (key === 'from' && (!m.to || m.to < m.from)) m.to = m.from; redraw(); });
      return el;
    };
    const fall = h('select', { class: 'input', 'aria-label': 'Falling on the day' }, Object.entries(FALLING_CHOICES).map(([id, label]) => h('option', { value: id === 'none' ? '' : id, selected: (m.falling || '') === (id === 'none' ? '' : id) }, id === 'none' ? 'Nothing falling' : label)));
    fall.addEventListener('change', () => { m.falling = fall.value; redraw(); });
    const picking = pickerFor === `day${i}`;
    return [
      h(
        'div',
        { class: 'tm-myday' },
        h('button', { type: 'button', class: 'tm-stk-what' + (picking ? ' open' : ''), 'aria-label': 'Choose its drawing', 'aria-expanded': String(picking), onclick: () => { pickerFor = picking ? null : `day${i}`; redraw(); } }, stickerLook({ what: m.what || 'twinkle' }, t)),
        name,
        h('label', { class: 'tm-date' }, h('span', null, 'From'), date('from', 'From')),
        h('label', { class: 'tm-date' }, h('span', null, 'To'), date('to', 'To')),
        fall,
        h('button', { type: 'button', class: 'btn small', onclick: () => { seasonPreview = `my_${i + 1}`; if (d.seasons !== 'auto') d.seasons = `my_${i + 1}`; redraw(); } }, 'Show it'),
        h('button', { type: 'button', class: 'btn small danger', 'aria-label': 'Remove this day', onclick: () => { list.splice(i, 1); pickerFor = null; if (/^my_/.test(d.seasons || '')) d.seasons = 'auto'; redraw(); } }, '×')
      ),
      picking ? stickerPicker(m, t, redraw) : null
    ];
  });
  return h(
    'div',
    { class: 'design-field wide tm-mydays' },
    h('span', null, 'Your own days'),
    h('p', { class: 'hint' }, 'A birthday, an anniversary, a festival that isn’t here yet: give it a name, its dates (every year), a drawing or any emoji, and something falling if you like.'),
    rows,
    list.length < MAX_MY_DAYS
      ? h('button', { type: 'button', class: 'btn small', onclick: () => {
          const today = new Date();
          const md = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          list.push({ name: 'My day', from: md, to: md, what: 'twinkle', falling: 'confetti' });
          pickerFor = `day${list.length - 1}`;
          redraw();
        } }, '+ Add a day of your own')
      : null
  );
}

// When a ticked festive day next comes round, and changing it (dates differ from place to place,
// and some depend on the moon being seen). Your dates count for that year; other years keep the usual.
let changingDate = null;
const fmtDay = (x) => x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const isoDay = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
function festivalDate(d, id, redraw) {
  d.festival_dates ||= {};
  const next = nextFestival(id, cleanFestivalDates(d.festival_dates));
  const mine = d.festival_dates[id];
  const when = next ? (isoDay(next[0]) === isoDay(next[1]) ? fmtDay(next[0]) : `${fmtDay(next[0])} to ${fmtDay(next[1])}`) : 'not in the coming year';
  const open = changingDate === id;
  const input = (key, label) => {
    const el = h('input', { type: 'date', class: 'input', value: mine?.[key] || (next ? isoDay(key === 'from' ? next[0] : next[1]) : ''), 'aria-label': `${FESTIVALS[id].name}: ${label}` });
    el.addEventListener('change', () => {
      const cur = { ...(d.festival_dates[id] || (next ? { from: isoDay(next[0]), to: isoDay(next[1]) } : {})) };
      cur[key] = el.value;
      if (key === 'from' && (!cur.to || cur.to < cur.from)) cur.to = cur.from;
      d.festival_dates[id] = cur;
      redraw();
    });
    return h('label', { class: 'tm-date' }, h('span', null, label), el);
  };
  return h(
    'div',
    { class: 'tm-fest-when' },
    h('small', null, `${mine ? 'Your dates' : 'Next'}: ${when}`),
    h('button', { type: 'button', class: 'btn small link', 'aria-expanded': String(open), onclick: () => { changingDate = open ? null : id; redraw(); } }, open ? 'Done' : 'Change the date'),
    open ? h('div', { class: 'row' }, input('from', 'From'), input('to', 'To'), mine ? h('button', { type: 'button', class: 'btn small', onclick: () => { delete d.festival_dates[id]; redraw(); } }, 'Usual dates') : null) : null
  );
}

// ---------- your own words on the buttons ----------

function labelControls(d, redraw) {
  d.labels ||= {};
  const field = (key) => {
    const input = h('input', { class: 'input', value: d.labels[key] || '', placeholder: LABELS[key], maxlength: 24, 'aria-label': `Your words for “${LABELS[key]}”` });
    input.addEventListener('change', () => {
      const v = input.value.replace(/[<>]/g, '').trim();
      if (v && v !== LABELS[key]) d.labels[key] = v;
      else delete d.labels[key];
      redraw();
    });
    return h('label', { class: 'tm-label' }, h('span', null, LABELS[key]), input);
  };
  const any = Object.keys(cleanLabels(d.labels)).length > 0;
  return [
    h('p', { class: 'hint' }, 'Call things what you like: rename the sections (everywhere they show: the menus, the desktop icons and the Explore menu) and the site’s buttons. Leave a box empty to keep the usual words.'),
    LABEL_GROUPS.map(([group, keys]) => h('div', { class: 'design-field wide' }, h('span', null, group), h('div', { class: 'tm-labels' }, keys.map(field)))),
    any ? h('button', { type: 'button', class: 'btn small', onclick: () => { d.labels = {}; redraw(); } }, 'Back to the usual words') : null
  ];
}

// The seasons' glass: an optional extra, place by place.
function glassControls(d, redraw, opt) {
  d.glass ||= [];
  const tick = (id) =>
    h('label', { class: 'check tm-tick' }, h('input', { type: 'checkbox', checked: d.glass.includes(id), onchange: (e) => {
      const set = new Set(d.glass);
      e.target.checked ? set.add(id) : set.delete(id);
      d.glass = Object.keys(GLASS_PLACES).filter((x) => set.has(x));
      redraw();
    } }), ' ', GLASS_PLACES[id].name);
  return h(
    'div',
    { class: 'design-field wide' },
    h('span', null, 'Seasonal glass (an extra, if you like)'),
    h('p', { class: 'hint' }, 'A pane of glass in the season’s mood over the places you tick: frost in winter, petals and a soft bloom in spring, a sun flare in summer, raindrops and a fallen leaf in autumn, sparkles on festive days. Photos and covers get the whole pane; thoughts only the corners, so the words stay clear.'),
    h('div', { class: 'tm-ticks' }, Object.keys(GLASS_PLACES).map(tick)),
    d.glass.length ? [opt('glass_style'), opt('glass_strength')] : null,
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: () => { d.glass = Object.keys(GLASS_PLACES); redraw(); } }, 'Everywhere'), d.glass.length ? h('button', { type: 'button', class: 'btn small', onclick: () => { d.glass = []; redraw(); } }, 'Nowhere') : null)
  );
}

// ---------- your own touches for each season and festive day ----------

let lookFor = 'winter';
let addingTo = false;
function looksControls(d, t, redraw) {
  d.looks ||= {};
  const ids = [...Object.keys(SEASONS), ...Object.keys(FESTIVALS)];
  if (!ids.includes(lookFor)) lookFor = 'winter';
  const look = lookOf(lookFor, { looks: cleanLooks(d.looks) });
  const own = (d.looks[lookFor] ||= {});
  const isSeason = !!SEASONS[lookFor];
  const sel = h('select', { class: 'input', 'aria-label': 'Season or festive day to change' }, h('optgroup', { label: 'Seasons' }, Object.entries(SEASONS).map(([id, x]) => h('option', { value: id, selected: id === lookFor }, x.name))), h('optgroup', { label: 'Festive days' }, Object.entries(FESTIVALS).map(([id, x]) => h('option', { value: id, selected: id === lookFor }, x.name))));
  sel.addEventListener('change', () => { lookFor = sel.value; seasonPreview = sel.value; addingTo = false; redraw(); });
  const charms = own.charms || look.charms;
  const setCharms = (list) => { own.charms = list; seasonPreview = lookFor; redraw(); };
  const fall = h('select', { class: 'input', 'aria-label': 'What falls' }, h('option', { value: '' }, `As it comes (${FALLING_CHOICES[(SEASONS[lookFor] || FESTIVALS[lookFor]).falling || 'none'] || 'nothing'})`), Object.entries(FALLING_CHOICES).map(([id, label]) => h('option', { value: id, selected: own.falling === id }, id === 'none' ? 'Nothing' : label)));
  fall.addEventListener('change', () => { own.falling = fall.value || undefined; seasonPreview = lookFor; redraw(); });
  const spots = own.where || ['corner-br'];
  const spotTick = (id) => h('label', { class: 'check tm-tick' }, h('input', { type: 'checkbox', checked: spots.includes(id), onchange: (e) => {
    const set = new Set(spots);
    e.target.checked ? set.add(id) : set.delete(id);
    own.where = Object.keys(STICKER_SPOTS).filter((x) => set.has(x));
    if (!own.where.length) own.where = ['corner-br'];
    seasonPreview = lookFor;
    redraw();
  } }), ' ', STICKER_SPOTS[id]);
  const settle = own.settle || Object.keys(SCENERY_PLACES);
  const settleTick = (id) => h('label', { class: 'check tm-tick' }, h('input', { type: 'checkbox', checked: settle.includes(id), onchange: (e) => {
    const set = new Set(settle);
    e.target.checked ? set.add(id) : set.delete(id);
    own.settle = Object.keys(SCENERY_PLACES).filter((x) => set.has(x));
    seasonPreview = lookFor;
    redraw();
  } }), ' ', SCENERY_PLACES[id]);
  const changed = Object.keys(cleanLooks({ [lookFor]: own })).length > 0;
  return h(
    'div',
    { class: 'design-field wide tm-looks' },
    h('span', null, 'Your own touches, day by day'),
    h('p', { class: 'hint' }, 'Make any season or festive day your own: its drawings (any drawing or emoji), what falls, where the drawings go, and for the seasons, where they settle. Floppy holds the day’s drawing too.'),
    sel,
    h(
      'div',
      { class: 'tm-look-charms' },
      charms.map((c, i) => h('span', { class: 'tm-look-charm' }, stickerLook({ what: c }, t, 30), h('button', { type: 'button', class: 'btn small danger', 'aria-label': `Take this drawing off`, onclick: () => setCharms(charms.filter((_, k) => k !== i)) }, '×'))),
      charms.length < MAX_LOOK_CHARMS ? h('button', { type: 'button', class: 'btn small', 'aria-expanded': String(addingTo), onclick: () => { addingTo = !addingTo; redraw(); } }, '+ Add a drawing') : null
    ),
    addingTo ? drawingPicker(t, (what) => { addingTo = false; setCharms([...new Set([...charms, what])]); }) : null,
    h('label', { class: 'design-field' }, h('span', null, 'What falls'), fall),
    h('div', { class: 'design-field wide' }, h('span', null, 'Where its drawings go'), h('div', { class: 'tm-ticks' }, Object.keys(STICKER_SPOTS).map(spotTick))),
    h('div', { class: 'design-field wide' }, h('span', null, isSeason ? 'Where the season settles' : 'Where the day settles'), h('div', { class: 'tm-ticks' }, Object.keys(SCENERY_PLACES).map(settleTick))),
    changed ? h('button', { type: 'button', class: 'btn small', onclick: () => { delete d.looks[lookFor]; redraw(); } }, `${(SEASONS[lookFor] || FESTIVALS[lookFor]).name} as it comes`) : null
  );
}
// The apps' top bars: for each app, what its bar wears (bunting under it while a season or
// festive day is on, and stickers on its corner).
let barPicking = '';
function barControls(d, t, redraw) {
  d.bar_decor ||= {};
  const set = (app, one) => {
    if (one.mode === 'day') delete d.bar_decor[app];
    else d.bar_decor[app] = one;
    redraw();
  };
  const row = (app) => {
    const now = d.bar_decor[app] || { mode: 'day' };
    const mine = now.mode === 'mine' ? now.charms || [] : [];
    return h(
      'div',
      { class: 'tm-bar-row' },
      h('b', null, BAR_APPS[app]),
      h('div', { class: 'chip-row', role: 'radiogroup', 'aria-label': `On the ${BAR_APPS[app]} bar` }, Object.entries(BAR_DECOR).map(([mode, label]) => h('button', { type: 'button', role: 'radio', class: 'chip-btn', 'aria-checked': String(now.mode === mode), 'aria-pressed': String(now.mode === mode), onclick: () => {
        if (mode === 'mine' && now.mode !== 'mine') {
          // (Opens the drawings to choose from.)
          barPicking = app;
          set(app, { mode, charms: [] });
        } else set(app, mode === 'mine' ? now : { mode });
      } }, label))),
      now.mode === 'mine'
        ? h(
            'div',
            { class: 'tm-look-charms' },
            mine.map((c, i) => h('span', { class: 'tm-look-charm' }, stickerLook({ what: c }, t, 28), h('button', { type: 'button', class: 'btn small danger', 'aria-label': 'Take this drawing off', onclick: () => set(app, { mode: 'mine', charms: mine.filter((_, k) => k !== i) }) }, '×'))),
            mine.length < MAX_BAR_STICKERS ? h('button', { type: 'button', class: 'btn small', 'aria-expanded': String(barPicking === app), onclick: () => { barPicking = barPicking === app ? '' : app; redraw(); } }, '+ Add a drawing') : null
          )
        : null,
      now.mode === 'mine' && barPicking === app ? drawingPicker(t, (what) => { barPicking = mine.length + 1 < MAX_BAR_STICKERS ? app : ''; set(app, { mode: 'mine', charms: [...new Set([...mine, what])] }); }) : null
    );
  };
  return h(
    'div',
    { class: 'design-field wide tm-bars' },
    h('span', null, 'On the apps’ top bars'),
    h('p', { class: 'hint' }, `Bunting hangs under each app’s top bar while a season or festive day is on, and a few drawings sit on its corner like stickers. Choose for each app: the day’s drawings, different ones every day, up to ${MAX_BAR_STICKERS} of your own (any drawing or emoji, all year round), or nothing.`),
    Object.keys(BAR_APPS).map(row)
  );
}
function drawingPicker(t, onPick) {
  const input = h('input', { class: 'input tm-emoji-in', placeholder: 'Or type any emoji', maxlength: 20, 'aria-label': 'Any emoji to add' });
  input.addEventListener('input', () => {
    const e = emojiList(input.value, 1)[0];
    if (e) onPick(e);
  });
  return h(
    'div',
    { class: 'tm-picker' },
    h('div', { class: 'tm-pick-grid', role: 'group', 'aria-label': 'Drawings' }, DOODLES.map((id) => h('button', { type: 'button', class: 'tm-pick', title: CHARM_NAMES[id], 'aria-label': CHARM_NAMES[id], onclick: () => onPick(id) }, stickerLook({ what: id }, t, 26)))),
    h('div', { class: 'tm-pick-grid', role: 'group', 'aria-label': 'Emoji' }, SUGGESTED.map((e) => h('button', { type: 'button', class: 'tm-pick', 'aria-label': e, onclick: () => onPick(e) }, stickerLook({ what: e }, t, 24)))),
    input
  );
}

// ---------- Floppy's wardrobe ----------

let floppyTry = '';
function floppyControls(d, t, redraw) {
  d.floppy ||= { dress: 'off', colour: 'classic', own: {} };
  const f = d.floppy;
  f.own ||= {};
  const chips = (label, value, choices, set, look) =>
    h('div', { class: 'design-field wide' }, h('span', null, label), h('div', { class: 'chip-row', role: 'radiogroup', 'aria-label': label }, Object.entries(choices).map(([id, name]) => h('button', { type: 'button', role: 'radio', class: 'chip-btn', 'aria-checked': String(value === id), 'aria-pressed': String(value === id), onclick: () => { set(id); redraw(); } }, look ? look(id) : null, name))));
  // A picture of him as he'll look (on Automatic, for the day picked below).
  const tryOn = floppyTry || (FESTIVALS[seasonPreview] || SEASONS[seasonPreview] ? seasonPreview : seasonOf(new Date(), t.hemisphere === 'south'));
  const today = SEASONS[tryOn] ? { season: tryOn, festival: '' } : { season: '', festival: tryOn };
  const day = lookOf(tryOn, { looks: cleanLooks(d.looks) });
  const clean = cleanFloppy(f, (x) => (CHARMS[x] ? x : emojiList(x, 1)[0] || ''));
  const outfit = outfitFor(clean.dress, clean.own, today);
  const body = clean.colour === 'theme' ? mix(t.main, '#000000', 0.15) : clean.colour === 'own' ? clean.hex : '';
  const pic = dressFloppy(FLOPPY, outfit, { body, tint: outfit.tint || clean.own.tint || t.accent, today: day?.charms?.[0] || '', charm: (name) => (CHARMS[name] ? CHARMS[name](inks(t)) : '') });
  const colour = h('input', { type: 'color', value: f.hex || '#2c4f9e', 'aria-label': 'His colour' });
  colour.addEventListener('change', () => { f.hex = colour.value; f.colour = 'own'; redraw(); });
  const tint = h('input', { type: 'color', value: f.own.tint || t.accent, 'aria-label': 'His outfit’s colour' });
  tint.addEventListener('change', () => { f.own.tint = tint.value; redraw(); });
  return [
    h('p', { class: 'hint' }, 'Floppy, the site’s little helper, can dress for the seasons and festive days (a scarf and bobble hat in winter, sunglasses in summer, a festive hat in December, holding the day’s drawing), or wear an outfit you put together.'),
    h('div', { class: 'tm-floppy' }, h('div', { class: 'tm-floppy-pic', html: pic, role: 'img', 'aria-label': 'Floppy, as he’ll look' }), h('div', { class: 'tm-floppy-side' },
      chips('Dress him', f.dress || 'off', FLOPPY_DRESS, (v) => (f.dress = v)),
      f.dress === 'auto' ? h('div', { class: 'design-field wide' }, h('span', null, 'Try on'), h('div', { class: 'chip-row', role: 'radiogroup', 'aria-label': 'Try on' }, [...Object.entries(SEASONS), ...Object.entries(FESTIVALS)].map(([id, x]) => h('button', { type: 'button', role: 'radio', class: 'chip-btn small', 'aria-pressed': String(tryOn === id), onclick: () => { floppyTry = id; redraw(); } }, x.name)))) : null
    )),
    f.dress === 'own'
      ? [
          chips(FLOPPY_PIECES.hat.name, f.own.hat || 'none', FLOPPY_PIECES.hat.choices, (v) => (f.own.hat = v)),
          chips(FLOPPY_PIECES.eyes.name, f.own.eyes || 'none', FLOPPY_PIECES.eyes.choices, (v) => (f.own.eyes = v)),
          chips(FLOPPY_PIECES.neck.name, f.own.neck || 'none', FLOPPY_PIECES.neck.choices, (v) => (f.own.neck = v)),
          h('div', { class: 'design-field wide' }, h('span', null, 'Holding'), h('div', { class: 'chip-row', role: 'radiogroup', 'aria-label': 'Holding' }, Object.entries(FLOPPY_PIECES.held.choices).map(([id, name]) => h('button', { type: 'button', role: 'radio', class: 'chip-btn', 'aria-pressed': String((f.own.held || 'none') === id), onclick: () => { f.own.held = id; redraw(); } }, name))), drawingPicker(t, (what) => { f.own.held = what; redraw(); })),
          h('label', { class: 'colour-pick' }, tint, h('span', null, 'Outfit colour'))
        ]
      : null,
    chips(FLOPPY_PIECES.colour.name, f.colour || 'classic', FLOPPY_PIECES.colour.choices, (v) => (f.colour = v)),
    f.colour === 'own' ? h('label', { class: 'colour-pick' }, colour, h('span', null, 'His colour')) : null
  ].flat();
}

// ---------- every post's card ----------
// One design for every post, or mixed at random: each post draws one of the designs ticked (the
// site's and your own) and keeps it, and Shuffle deals them out again. Either way, a post dressed
// in a design of its own (Dress this post) keeps it.
function cardChoice(d, t, redraw) {
  const mixing = t.card_style === MIX;
  const designs = [...Object.entries(CARD_STYLES), ...t.cards.map((c) => [c.id, c.name])];
  const single = mixing ? (CARD_STYLES[SKINS[d.theme]?.card_style] ? SKINS[d.theme].card_style : 'classic') : t.card_style;
  const mode = h(
    'div',
    { class: 'dress-grid cards-mode', role: 'radiogroup', 'aria-label': 'How posts wear them' },
    h('button', { type: 'button', role: 'radio', class: 'dress-pick' + (mixing ? '' : ' on'), 'aria-checked': String(!mixing), onclick: () => { if (mixing) { d.card_style = ''; redraw(); } } }, miniCard(single, t), h('small', null, 'One design for every post')),
    h('button', { type: 'button', role: 'radio', class: 'dress-pick' + (mixing ? ' on' : ''), 'aria-checked': String(mixing), onclick: () => { if (!mixing) { d.card_style = MIX; redraw(); } } }, mixMini(t, mixing ? t.card_mix : designs.map(([id]) => id).filter((id) => id !== 'classic')), h('small', null, 'Mixed at random'))
  );
  if (!mixing)
    return h('div', { class: 'design-field wide' }, h('span', null, 'Every post’s card'), mode, h(
      'div',
      { class: 'dress-grid', role: 'radiogroup', 'aria-label': 'Post cards' },
      designs.map(([id, name]) => h('button', { type: 'button', role: 'radio', class: 'dress-pick' + (t.card_style === id ? ' on' : ''), 'aria-checked': String(t.card_style === id), onclick: () => { d.card_style = id; redraw(); } }, miniCard(id, t), h('small', null, name)))
    ));
  // Mixed: tick the designs that go in (at least one stays ticked).
  const inMix = t.card_mix;
  const setMix = (list) => {
    d.card_mix = designs.map(([id]) => id).filter((id) => list.includes(id));
    redraw();
  };
  return h(
    'div',
    { class: 'design-field wide' },
    h('span', null, 'Every post’s card'),
    mode,
    h('p', { class: 'hint' }, `Each post draws one of the designs ticked here and keeps it: it looks the same every time, and only changes if you shuffle or take its design out of the mix. A post you’ve dressed in a design of its own keeps that one. ${inMix.length} in the mix.`),
    h(
      'div',
      { class: 'dress-grid', role: 'group', 'aria-label': 'Designs in the mix' },
      designs.map(([id, name]) => h('button', { type: 'button', role: 'checkbox', class: 'dress-pick', 'aria-checked': String(inMix.includes(id)), onclick: () => {
        const now = inMix.includes(id) ? inMix.filter((x) => x !== id) : [...inMix, id];
        if (now.length) setMix(now);
      } }, miniCard(id, t), h('small', null, name)))
    ),
    h(
      'div',
      { class: 'mix-tools' },
      h('button', { type: 'button', class: 'btn small go', onclick: () => {
        let seed = t.card_seed;
        while (seed === t.card_seed) seed = 1 + Math.floor(Math.random() * MAX_SEED);
        d.card_seed = seed;
        redraw();
      } }, '🎲 Shuffle'),
      h('button', { type: 'button', class: 'btn small', disabled: inMix.length === designs.length || null, onclick: () => setMix(designs.map(([id]) => id)) }, 'Tick them all'),
      t.cards.length ? h('button', { type: 'button', class: 'btn small', onclick: () => setMix(t.cards.map((c) => c.id)) }, 'Just my own cards') : null
    )
  );
}

// ---------- post cards of your own ----------
// Made from parts (paper, edge, corners, shadow, something on top, the heading, colours, a font
// and a tilt), with a live preview. Up to twelve, each one choosable for every post (above) or
// for a single post (Dress this post).
let maker = null;
function cardMaker(d, t, redraw) {
  ensureOwnCardsCss({ ...t, cards: [...t.cards.filter((c) => c.id !== maker?.card.id), ...(maker ? [maker.card] : [])] });
  const own = t.cards;
  const start = (card, isNew) => {
    maker = { card: JSON.parse(JSON.stringify(card)), isNew };
    redraw();
  };
  const list = h(
    'div',
    { class: 'cm-own-list' },
    own.map((c) => h('div', { class: 'cm-own' }, miniCard(c.id, t), h('small', null, c.name), h('button', { type: 'button', class: 'btn small', onclick: () => start(c, false) }, 'Change'))),
    own.length < MAX_CARDS && !maker ? h('button', { type: 'button', class: 'btn small go', onclick: () => start({ id: nextCardId(own), name: 'My card', paper: '#fffaf0', texture: 'dots', edge: 'line', corners: 'soft', shadow: 'soft', deco: 'tape', head: 'plain', tilt: 'slight', edge_colour: '', deco_colour: '', head_colour: '', ink: '', font: '' }, true) }, '+ Make a card') : null
  );
  const box = h('div', { class: 'design-field wide card-maker' }, h('span', null, 'Your own cards'), h('p', { class: 'hint' }, own.length ? 'Choose one of yours above for every post, or for one post when you write it.' : 'Make post cards of your own from parts: the paper, its edge and corners, a shadow, something on top, the heading and the colours.'), list);
  if (!maker) return box;
  const c = maker.card;
  // The preview: a whole card, as it will look.
  const sample = () => h('article', { class: 'card', 'data-card': c.id, style: { '--card-tilt': c.tilt === 'slight' ? '-1deg' : '0deg', '--card-pic': `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 14C2.5 10.2 1.2 6.6 3.4 4.3 5.2 2.6 7.3 3.4 8 5c.7-1.6 2.8-2.4 4.6-.7 2.2 2.3.9 5.9-4.6 9.7z" fill="#fff"/></svg>')}")` } }, h('header', { class: 'card-head' }, h('strong', null, 'Thought'), h('span', { class: 'card-date' }, 'Wed 28 Oct · 10:30')), h('h3', { class: 'card-title' }, 'A day out'), h('div', { class: 'card-body' }, h('p', null, 'Coffee by the sea, a long walk, and home before the rain. This is how your posts will look.')));
  const preview = h('div', { class: 'card-maker-preview' }, sample());
  const refresh = () => {
    ensureOwnCardsCss({ ...t, cards: [...t.cards.filter((x) => x.id !== c.id), c] });
    preview.replaceChildren(sample());
  };
  const chips = (part) =>
    h(
      'div',
      { class: 'design-field' },
      h('span', null, CARD_PARTS[part].name),
      h(
        'div',
        { class: 'chip-row', role: 'radiogroup', 'aria-label': CARD_PARTS[part].name },
        Object.entries(CARD_PARTS[part].choices).map(([id, label]) =>
          h('button', { type: 'button', role: 'radio', class: 'chip-btn', 'aria-pressed': String(c[part] === id), onclick: (e) => {
            c[part] = id;
            e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
            refresh();
          } }, label)
        )
      )
    );
  const colour = (key) => {
    const input = h('input', { type: 'color', value: c[key] || (key === 'paper' ? '#ffffff' : key === 'ink' ? '#232323' : key === 'deco_colour' ? t.accent : t.main), 'aria-label': `${CARD_COLOURS[key]} colour` });
    const reset = key === 'paper' ? null : h('button', { type: 'button', class: 'btn small', disabled: !c[key], onclick: () => { c[key] = ''; reset.disabled = true; refresh(); } }, key === 'ink' ? 'Automatic' : 'The theme’s');
    input.addEventListener('input', () => {
      c[key] = input.value;
      if (reset) reset.disabled = false;
      refresh();
    });
    return h('label', { class: 'card-maker-colour' }, h('span', null, CARD_COLOURS[key]), input, reset);
  };
  const name = h('input', { class: 'input', value: c.name, maxlength: 30, 'aria-label': 'Name of this card' });
  name.addEventListener('input', () => (c.name = name.value));
  const font = h('select', { class: 'input', 'aria-label': 'Font for its heading' }, h('option', { value: '' }, 'The theme’s'), Object.entries(OPTIONS.title_font.choices).map(([id, label]) => h('option', { value: id, selected: c.font === id || null }, label)));
  font.addEventListener('change', () => {
    c.font = font.value;
    refresh();
  });
  const save = () => {
    c.name = name.value.trim() || 'My card';
    d.cards = [...(d.cards || []).filter((x) => x.id !== c.id), c].sort((a, b) => +a.id.slice(1) - +b.id.slice(1));
    // (A new card is put on every post straight away: you can choose another above.)
    if (maker.isNew) d.card_style = c.id;
    maker = null;
    redraw();
  };
  const remove = () => {
    d.cards = (d.cards || []).filter((x) => x.id !== c.id);
    if (d.card_style === c.id) d.card_style = '';
    maker = null;
    redraw();
  };
  box.append(
    h(
      'div',
      { class: 'card-maker-panel' },
      h('div', { class: 'card-maker-parts' }, h('label', { class: 'design-field' }, h('span', null, 'Its name'), name), ...['texture', 'edge', 'corners', 'shadow', 'deco', 'head', 'tilt'].map(chips), h('div', { class: 'card-maker-colours' }, Object.keys(CARD_COLOURS).map(colour)), h('label', { class: 'design-field' }, h('span', null, 'Font for its heading'), font)),
      h('div', { class: 'card-maker-side' }, preview, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn go', onclick: save }, maker.isNew ? 'Add this card' : 'Keep these changes'), h('button', { type: 'button', class: 'btn', onclick: () => { maker = null; redraw(); } }, 'Cancel'), maker.isNew ? null : h('button', { type: 'button', class: 'btn danger', onclick: remove }, 'Delete it')), h('p', { class: 'hint' }, 'A stamp and a wax seal carry your theme’s charm. Then press Save the theme to put it on your site.'))
    )
  );
  return box;
}
