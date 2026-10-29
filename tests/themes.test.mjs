// Themes: picked or made in the back office (saved as theme.md), previewed live, and worn by the
// whole site: re-coloured stylesheets, a wallpaper, title-bar charms and the mouse pointer.
import fs from 'node:fs';
import { test, report, assert, eq, launch, close, adminPage, getFile, putFile, delFile, overview, publicData, BASE, chromium, newPost, toastText, editPost } from './lib.mjs';

await launch();

await test('the server knows the same themes, wallpapers and charms as the site', async () => {
  const skins = await import('../public/js/skins.js');
  const content = await import('../src/content.js');
  eq(content.THEMES, Object.keys(skins.SKINS), 'themes');
  eq(content.THEME_WALLPAPERS, Object.keys(skins.WALLPAPERS), 'wallpapers');
  eq(content.THEME_CHARMS, Object.keys(skins.CHARMS), 'charms');
  eq(content.EMOJI_LAYOUTS, Object.keys(skins.EMOJI_LAYOUTS), 'emoji layouts');
  eq(content.STICKER_SPOTS, Object.keys(skins.STICKER_SPOTS), 'sticker spots');
  eq(Object.fromEntries(Object.entries(content.THEME_OPTIONS)), Object.fromEntries(Object.entries(skins.OPTIONS).map(([k, o]) => [k, Object.keys(o.choices)])), 'settings and their choices');
  eq(content.THEME_HIDEABLE, Object.keys(skins.HIDEABLE), 'parts that can be left out');
  eq(content.THEME_FESTIVALS, Object.keys(skins.FESTIVALS), 'festive days');
  eq(content.THEME_LABELS, Object.keys(skins.LABELS), 'words that can be renamed');
  eq(content.THEME_SECTIONS, Object.keys(skins.SECTIONS), 'sections');
  eq(content.THEME_APPS, Object.fromEntries(Object.entries(skins.APPS).map(([k, a]) => [k, a.extras])), 'apps and their own settings');
  eq(content.APP_LOOKS, Object.keys(skins.APP_LOOKS), 'app looks');
  eq(content.APP_EXTRAS, Object.fromEntries(Object.entries(skins.APP_EXTRAS).map(([k, x]) => [k, Object.keys(x.choices)])), 'app settings and their choices');
});

async function site(fn, { desktop = false, dark = false } = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage(desktop ? { viewport: { width: 1280, height: 820 }, colorScheme: dark ? 'dark' : 'light' } : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: dark ? 'dark' : 'light' });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript(() => sessionStorage.setItem('entered', '1'));
  await page.goto(BASE + '/#/');
  await page.waitForSelector(desktop ? '.dw' : '.xp-window');
  await page.waitForTimeout(300);
  try {
    return await fn(page);
  } finally {
    assert(!page.errors.length, page.errors.join('; '));
    await browser.close();
  }
}
// Opens "Make … your own" (it's already open when the theme has changes).
async function openEditor(page) {
  if (!(await page.locator('details.tm-own').evaluate((d) => d.open))) await page.locator('.tm-own > summary').click();
}
const skinCss = (page) => page.evaluate(() => document.getElementById('skin-css')?.textContent || '');

await test('with no theme set, the site keeps its classic look', async () => {
  eq((await publicData()).theme, { theme: 'classic' }, 'data');
  await site(async (page) => {
    eq(await page.evaluate(() => document.documentElement.dataset.skin), 'classic', 'marked classic');
    eq(await skinCss(page), '', 'nothing re-coloured');
  });
});

await test('picking a theme previews it live, and saving puts it on the site', async () => {
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-card');
  eq(await page.locator('.tm-card').count(), 34, 'thirty-four themes');
  // In groups that fold away: only the current theme's group is open to start with.
  eq(await page.locator('.tm-gbox').count(), 4, 'four groups');
  eq(await page.locator('.tm-gbox').evaluateAll((g) => g.map((x) => [x.querySelector('summary b').textContent, x.open])), [['Cute and colourful', true], ['Bold and loud', false], ['The four seasons', false], ['Calm and neutral', false]], 'only the current one open');
  eq(await page.locator('.tm-card:visible').count(), 12, 'the others folded away');
  assert(await page.locator('.tm-gbox:not([open]) .tm-swatches i').count() === 22, 'each folded group shows a strip of its colours');
  await page.locator('.tm-card', { hasText: 'Bunny Hop' }).click();
  const frame = page.frameLocator('.tm-frame');
  await page.waitForFunction(() => document.querySelector('.tm-frame')?.contentDocument?.documentElement.dataset.skin === 'bunny', null, { timeout: 15000 });
  assert(await frame.locator('#skin-css').count(), 'the preview is re-coloured');
  eq((await publicData()).theme.theme, 'classic', 'not on the site until saved');
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForSelector('.toast:not([hidden])');
  eq((await publicData()).theme, { theme: 'bunny' }, 'saved, by name only');
  assert(/theme: bunny/.test(await getFile('theme.md')), 'theme.md');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await site(async (page) => {
    eq(await page.evaluate(() => document.documentElement.dataset.skin), 'bunny', 'worn on a phone');
    const css = await skinCss(page);
    assert(css.length > 2000, 'stylesheets re-coloured: ' + css.length);
    const title = await page.evaluate(() => getComputedStyle(document.querySelector('.xp-title')).backgroundImage);
    assert(!/rgb\(0, 84, 227\)/.test(title), 'the title bar is no longer XP blue: ' + title);
    const wall = await page.evaluate(() => getComputedStyle(document.querySelector('.wall')).backgroundImage);
    assert(wall.includes('data:image/svg+xml'), 'a pattern wallpaper');
  });
  await site(async (page) => {
    const p = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--cur-arrow'));
    assert(p.includes('data:image/svg+xml'), 'its own pointer: ' + p.slice(0, 60));
    const after = await page.evaluate(() => getComputedStyle(document.querySelector('.dw-xp .xp-title-text'), '::after').backgroundImage);
    assert(after.includes('data:image/svg+xml'), 'a charm on the title bar');
  }, { desktop: true });
});

await test('make it your own: colours, wallpaper, charm and pointer', async () => {
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-card');
  await openEditor(page);
  await page.getByLabel('Main', { exact: true }).evaluate((el) => {
    el.value = '#3a8fb7';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('.tm-tab', { hasText: 'Wallpaper' }).click();
  await page.locator('.tm-chips[aria-label="Wallpaper"] .tm-chip', { hasText: 'Hearts' }).click();
  await page.locator('.tm-tab', { hasText: 'Charms' }).click();
  await page.locator('.tm-chips[aria-label="Charm on the title bars"] .tm-chip', { hasText: 'Star' }).click();
  await page.locator('.tm-chips[aria-label="Mouse pointer (on computers)"] .tm-chip', { hasText: 'Frog' }).click();
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForSelector('.toast:not([hidden])');
  eq((await publicData()).theme, { theme: 'bunny', main: '#3a8fb7', wallpaper: 'hearts', decoration: 'star', pointer: 'frog' }, 'only the changes are saved');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
});

await test('pale themes keep their words readable', async () => {
  await putFile('theme.md', '---\ntheme: lemonade\n---\n');
  await site(async (page) => {
    const colour = await page.evaluate(() => getComputedStyle(document.querySelector('.xp-title')).color);
    assert(colour !== 'rgb(255, 255, 255)', 'dark words on the yellow title bar: ' + colour);
  });
  // In dark mode the taskbar's buttons are dark again, so their words stay light.
  await site(async (page) => {
    const colour = await page.evaluate(() => getComputedStyle(document.querySelector('.task-btn')).color);
    eq(colour, 'rgb(255, 255, 255)', 'light words in dark mode');
  }, { desktop: true, dark: true });
});

await test('odd theme files never break the site', async () => {
  await putFile('theme.md', '---\ntheme: "<script>"\nmain: red\naccent: "#12"\nwallpaper: nope\ndecoration: {a: 1}\npointer: ../x\npicture: ../../secret.jpg\n---\n');
  eq((await publicData()).theme, { theme: 'classic' }, 'falls back');
  await putFile('theme.md', '---\ntheme: nosuchtheme\nwallpaper: hearts\n---\n');
  eq((await publicData()).theme, { theme: 'classic', wallpaper: 'hearts' }, 'an unknown theme is classic');
  await site(async (page) => {
    eq(await page.evaluate(() => document.documentElement.dataset.skin), 'classic', 'worn as classic');
  });
});

await test('back to Classic', async () => {
  await putFile('theme.md', '---\ntheme: cherry\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-card');
  await page.locator('button', { hasText: 'Back to Classic' }).click();
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForSelector('.toast:not([hidden])');
  eq((await publicData()).theme, { theme: 'classic' }, 'classic again');
  await page.close();
  await site(async (page) => eq(await skinCss(page), '', 'nothing re-coloured'));
});

await test('an emoji wallpaper and stickers, chosen in the back office', async () => {
  await putFile('theme.md', '---\ntheme: bunny\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-card');
  await openEditor(page);
  await page.locator('.tm-tab', { hasText: 'Wallpaper' }).click();
  await page.locator('.tm-chips[aria-label="Wallpaper"] .tm-chip', { hasText: 'Emoji' }).click();
  await page.getByRole('textbox', { name: 'Emoji for the wallpaper' }).fill('🍓 x 🌸');
  await page.getByRole('textbox', { name: 'Emoji for the wallpaper' }).dispatchEvent('change');
  await page.locator('.chip-btn', { hasText: 'Big and small' }).click();
  await page.locator('.tm-tab', { hasText: 'Stickers' }).click();
  await page.locator('button', { hasText: '+ Add a sticker' }).click();
  await page.getByRole('button', { name: 'Rainbow', exact: true }).click();
  await page.locator('.tm-stk-row select').first().selectOption('title');
  await page.locator('button', { hasText: '+ Add a sticker' }).click();
  await page.getByRole('textbox', { name: 'Any emoji for the sticker' }).fill('🐸');
  await page.locator('.tm-stk-row select').nth(1).selectOption('desktop');
  await page.locator('.tm-stk-row').nth(1).getByRole('radio', { name: 'L' }).click();
  // Previewed before saving.
  await page.waitForFunction(() => document.querySelector('.tm-frame')?.contentDocument?.querySelector('.xp-title .stk'), null, { timeout: 15000 });
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForSelector('.toast:not([hidden])');
  const theme = (await publicData()).theme;
  eq([theme.wallpaper, theme.emoji, theme.emoji_layout], ['emoji', '🍓🌸', 'big'], 'emoji wallpaper');
  eq(theme.stickers, [{ what: 'rainbow', where: 'title', size: 'm', tilt: 0 }, { what: '🐸', where: 'desktop', size: 'l', tilt: 0, x: 50, y: 50 }], 'stickers');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await site(async (p) => {
    assert(await p.locator('.xp-title .stk').count(), 'a sticker on the title bar');
    const wall = await p.evaluate(() => getComputedStyle(document.querySelector('.wall')).backgroundImage);
    assert(wall.match(/data:image\/svg\+xml,[^"]+/g).some((u) => decodeURIComponent(u).includes('🍓')), 'emoji in the wallpaper');
    // Stickers keep up with the page: a new page of the feed still has them.
    await p.goto(BASE + '/#/thoughts');
    await p.waitForTimeout(400);
    assert(await p.locator('.xp-title .stk').count(), 'still there after changing page');
  });
  await site(async (p) => {
    eq(await p.locator('.stk-desktop .stk').innerText(), '🐸', 'on the desktop');
    eq(await p.locator('.dw-xp .xp-title .stk').count() > 0, true, 'on window title bars');
  }, { desktop: true });
});

await test('odd stickers and emoji are left out', async () => {
  await putFile('theme.md', '---\ntheme: bunny\nwallpaper: emoji\nemoji: "<b>hi</b> 🍑"\nstickers: [{"what":"<img src=x>","where":"title"},{"what":"🍑","where":"ceiling"},"x",{"what":"pal","where":"cards","size":"huge","tilt":900}]\n---\n');
  const theme = (await publicData()).theme;
  eq([theme.emoji, theme.stickers], ['🍑', [{ what: 'pal', where: 'cards', size: 'm', tilt: 45 }]], 'only the sound ones');
  await site(async (p) => {
    eq(await p.locator('.stk').count() >= 1, true, 'the good one shows');
    eq(await p.locator('.stk img').count(), 0, 'nothing odd');
  });
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('every level: fonts, feed, header, menu, taskbar, icons and sounds', async () => {
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-card');
  await openEditor(page);
  const pick = async (tabName, group, choice) => {
    await page.locator('.tm-tab', { hasText: tabName }).click();
    await page.locator(`.chip-row[aria-label="${group}"] .chip-btn`, { hasText: choice }).first().click();
  };
  await pick('Colours', 'Highlight', 'Pointer');
  await pick('Fonts', 'Words', 'Pixel');
  await pick('Fonts', 'Titles', 'Arcade');
  await pick('Fonts', 'Text size', 'Bigger');
  await pick('Bars & corners', 'Title bars', 'Striped');
  await pick('Bars & corners', 'Corners', 'Square');
  await pick('Feed', 'Posts in the feed', 'A list with lines');
  await pick('Feed', 'Spacing', 'Compact');
  await pick('Profile header', 'Profile header', 'Card');
  await page.locator('.tm-tick', { hasText: 'Nudge button' }).locator('input').uncheck();
  await page.locator('.tm-tab', { hasText: 'Menu' }).click();
  await page.getByLabel('Main menu, place 2').selectOption('music');
  await page.getByLabel('Main menu, place 5').selectOption('');
  await page.locator('.tm-tick', { hasText: 'Wishlist' }).locator('input').uncheck();
  await pick('Taskbar & scrolling', 'Taskbar (computers)', 'At the top');
  await page.locator('.tm-tick', { hasText: 'Clock' }).locator('input').uncheck();
  await pick('Taskbar & scrolling', 'Scroll bars', 'Thin');
  await pick('Icons & sounds', 'Icons', 'Black and white');
  await pick('Icons & sounds', 'Sounds', 'Off until');
  // The preview reopens with the new menu.
  await page.waitForFunction(() => [...(document.querySelector('.tm-frame')?.contentDocument?.querySelectorAll('.xp-links a') || [])].map((a) => a.textContent).filter(Boolean).join(',') === 'Home,Music,Places,Map', null, { timeout: 20000 });
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForSelector('.toast:not([hidden])');
  eq((await publicData()).theme, { theme: 'classic', font: 'pixel', title_font: 'arcade', text_size: 'l', selector: 'pointer', bars: 'stripes', corners: 'square', density: 'compact', posts: 'lines', scrollbar: 'thin', taskbar: 'top', icons: 'mono', sounds: 'quiet', header: 'card', hide: ['nudge', 'clock'], menu: ['home', 'music', 'journal', 'atlas'], sections_hidden: ['wishlist'] }, 'all saved');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await site(async (p) => {
    const r = await p.evaluate(() => ({ ...document.documentElement.dataset, font: getComputedStyle(document.querySelector('.card-body')).fontFamily }));
    eq([r.skFont, r.skPosts, r.skHeader, r.skHide], ['pixel', 'lines', 'card', 'nudge clock'], 'marks on the page');
    assert(r.font.includes('Pixelify'), 'pixel font: ' + r.font);
    eq((await p.locator('.xp-links a').allInnerTexts()).filter(Boolean), ['Home', 'Music', 'Places', 'Map'], 'the main bar');
    eq(await p.locator('.profile-tile .nudge-btn').isVisible(), false, 'no nudge button');
    await p.locator('.xp-others').click();
    const others = await p.locator('.menu-panel .menu-label').allInnerTexts();
    assert(!others.some((x) => /Wishlist/.test(x)) && others.some((x) => /Bookshelf/.test(x)), 'wishlist left out of Others: ' + others.join(','));
    eq(await p.evaluate(async () => (await import('/js/sound.js')).isMuted()), true, 'sounds start off');
  });
  await site(async (p) => {
    const bar = await p.locator('.desktop .taskbar').boundingBox();
    eq(bar.y, 0, 'taskbar at the top');
    eq(await p.locator('.taskbar .clock').isVisible(), false, 'no clock');
    eq(await p.locator('.desk-icon', { hasText: 'Wishlist' }).count(), 0, 'no wishlist icon');
  }, { desktop: true });
});

await test('themes travel: a theme code and a theme file', async () => {
  await putFile('theme.md', '---\ntheme: froggy\nfont: comic\nstickers: [{"what":"🐸","where":"title","size":"m","tilt":0}]\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-card');
  await openEditor(page);
  await page.locator('.tm-tab', { hasText: 'Share' }).click();
  const code = await page.getByRole('textbox', { name: 'Your theme code' }).inputValue();
  assert(code.startsWith('MYTHEME-'), code);
  await page.locator('button', { hasText: 'Back to Classic' }).click();
  await page.locator('.tm-tab', { hasText: 'Share' }).click();
  await page.getByRole('textbox', { name: 'Paste a theme code' }).fill(code);
  await page.locator('button', { hasText: 'Try it' }).click();
  eq(await page.locator('.tm-card.on b').innerText(), 'Froggy Pond', 'the code brings the theme back');
  await page.locator('.tm-tab', { hasText: 'Share' }).click();
  await page.locator('label', { hasText: 'Install a theme file' }).locator('input').setInputFiles({ name: 'friend-theme.md', mimeType: 'text/markdown', buffer: Buffer.from('---\ntheme: moonlit\nbars: flat\nmenu: ["home", "friends"]\n---\nA friend\'s theme.\n') });
  await page.waitForFunction(() => document.querySelector('.tm-card.on b')?.textContent === 'Moonlit');
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => /on your site now/.test(document.querySelector('.toast')?.textContent || ''));
  eq((await publicData()).theme, { theme: 'moonlit', bars: 'flat', menu: ['home', 'friends'] }, 'the installed theme is saved');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('each app its own look, chosen in the back office', async () => {
  await putFile('theme.md', '---\ntheme: bunny\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-card');
  await openEditor(page);
  await page.locator('.tm-tab', { hasText: 'Apps' }).click();
  const journal = page.locator('.tm-app[aria-label="Places journal"]');
  await journal.locator('.chip-btn', { hasText: 'A colour of its own' }).click();
  await page.locator('.tm-app[aria-label="Places journal"] input[type=color]').evaluate((el) => {
    el.value = '#2f6f6a';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('.tm-app[aria-label="Places journal"] .chip-btn', { hasText: 'Graph paper' }).click();
  await page.locator('.tm-app[aria-label="Places journal"] .chip-btn', { hasText: 'Doodly' }).click();
  await page.locator('.tm-app[aria-label="Bookshelf"] .chip-btn', { hasText: 'In the theme’s colour' }).click();
  await page.locator('.tm-app[aria-label="Atlas"] .chip-btn', { hasText: 'Its original look' }).click();
  // Shown in the preview as it's chosen.
  await page.waitForFunction(() => /#\/atlas/.test(document.querySelector('.tm-frame')?.contentWindow?.location.hash || ''));
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => /on your site now/.test(document.querySelector('.toast')?.textContent || ''));
  eq((await publicData()).theme.apps, { journal: { look: 'custom', colour: '#2f6f6a', paper: 'grid', hand: 'gaegu' }, books: { look: 'tint' }, atlas: { look: 'original' } }, 'saved');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await site(async (p) => {
    await p.goto(BASE + '/#/journal');
    await p.waitForSelector('.leather-phone[data-app="journal"]');
    await p.waitForTimeout(300);
    const j = await p.evaluate(() => {
      const el = document.querySelector('[data-app="journal"]');
      const cs = getComputedStyle(el);
      const pen = document.querySelector('[data-app="journal"] .ruled');
      return { leather: cs.getPropertyValue('--leather').trim(), paper: cs.getPropertyValue('--paper-base').trim(), pen: pen ? getComputedStyle(pen).fontFamily : 'Gaegu' };
    });
    eq([j.leather, j.paper], ['#2f6f6a', '#fbf8ee'], 'the journal’s leather and paper');
    assert(/Gaegu/.test(j.pen), 'the journal’s handwriting: ' + j.pen);
    await p.goto(BASE + '/#/books');
    await p.waitForSelector('[data-app="books"]');
    assert((await p.evaluate(() => document.getElementById('skin-css').textContent)).includes('[data-app="books"]'), 'the bookshelf has its own rules');
  });
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('neutral themes and a plain pointer', async () => {
  await putFile('theme.md', '---\ntheme: graphite\n---\n');
  await site(async (p) => {
    eq(await p.evaluate(() => document.documentElement.dataset.skin), 'graphite', 'graphite');
    const wall = await p.evaluate(() => getComputedStyle(document.querySelector('.wall')).backgroundColor);
    assert(wall !== 'rgba(0, 0, 0, 0)', 'a plain wallpaper: ' + wall);
  });
  await site(async (p) => {
    const arrow = await p.evaluate(() => getComputedStyle(document.body).getPropertyValue('--cur-arrow'));
    assert(arrow.includes('data:image/svg+xml'), 'a plain arrow in the theme’s colours');
    eq(await p.locator('.dw-xp .xp-title-text').first().evaluate((el) => getComputedStyle(el, '::after').content), 'none', 'no charm on the title bars');
  }, { desktop: true });
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('the welcome screen has a quiet way into the back office', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await page.goto(BASE + '/#/welcome');
  const gear = page.getByRole('link', { name: 'Back office (for the owner)' });
  await gear.waitFor();
  eq(await gear.getAttribute('href'), '/admin/', 'links to the back office');
  await browser.close();
});

// A page of the site with more control: reduced motion, a fixed time of day.
async function siteAt(fn, { desktop = true, reducedMotion = 'no-preference', time = null } = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ ...(desktop ? { viewport: { width: 1280, height: 820 } } : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), reducedMotion });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  if (time) await page.clock.install({ time });
  await page.addInitScript(() => sessionStorage.setItem('entered', '1'));
  await page.goto(BASE + '/#/');
  await page.waitForSelector(desktop ? '.dw' : '.xp-window');
  await page.waitForTimeout(300);
  try {
    return await fn(page);
  } finally {
    assert(!page.errors.length, page.errors.join('; '));
    await browser.close();
  }
}

await test('effects: your name in lights, a pointer trail and things falling (but never for visitors who want stillness)', async () => {
  await putFile('theme.md', '---\ntheme: bunny\nname_style: rainbow\ntrail: sparkles\nfalling: petals\n---\n');
  eq((await publicData()).theme, { theme: 'bunny', name_style: 'rainbow', trail: 'sparkles', falling: 'petals' }, 'saved');
  await siteAt(async (p) => {
    const clip = await p.evaluate(() => getComputedStyle(document.querySelector('.profile-name strong') || document.body).backgroundClip);
    eq(clip, 'text', 'the name is painted in a rainbow');
    const fx = p.locator('canvas.fx-layer');
    eq(await fx.count(), 1, 'one effects layer');
    eq(await fx.evaluate((c) => getComputedStyle(c).pointerEvents), 'none', 'never catches a click');
    await p.mouse.move(300, 300);
    await p.mouse.move(420, 360, { steps: 8 });
    await p.waitForTimeout(120);
    const drawn = await fx.evaluate((c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0));
    assert(drawn, 'something drawn');
    // Still clickable underneath.
    await p.locator('.desk-icon').first().dblclick();
  });
  await siteAt(async (p) => eq(await p.locator('canvas.fx-layer').count(), 0, 'no motion when the visitor asks for less'), { reducedMotion: 'reduce' });
  // Things keep falling after the page has been in the background (another tab, a locked phone).
  await siteAt(async (p) => {
    const frame = () => p.evaluate(() => { const c = document.querySelector('canvas.fx-layer'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 3; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; });
    const setHidden = (hidden) => p.evaluate((hidden) => { Object.defineProperty(document, 'hidden', { value: hidden, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: hidden ? 'hidden' : 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, hidden);
    await setHidden(true);
    await p.waitForTimeout(300);
    await setHidden(false);
    const a = await frame();
    await p.waitForTimeout(400);
    const b = await frame();
    assert(a !== b, 'still falling after coming back');
  }, { desktop: false });
  await siteAt(async (p) => {
    eq(await p.locator('canvas.fx-layer').count(), 1, 'falling petals on a phone too');
  }, { desktop: false });
  // Odd values are left out.
  await putFile('theme.md', '---\ntheme: bunny\nname_style: blink\ntrail: "<script>"\nfalling: lava\n---\n');
  eq((await publicData()).theme, { theme: 'bunny' }, 'odd effects ignored');
});

await test('a tab icon of your own, and another theme after dark', async () => {
  await putFile('theme.md', '---\ntheme: lemonade\ntab_icon: "🍋"\nnight_theme: moonlit\n---\n');
  eq((await publicData()).theme, { theme: 'lemonade', tab_icon: '🍋', night_theme: 'moonlit' }, 'saved');
  const look = (p) => p.evaluate(() => ({ skin: document.documentElement.dataset.skin, icon: decodeURIComponent(document.querySelector('link[rel="icon"]').getAttribute('href')) }));
  await siteAt(async (p) => {
    const r = await look(p);
    eq(r.skin, 'lemonade', 'daytime: the theme itself');
    assert(r.icon.startsWith('data:image/svg+xml') && r.icon.includes('🍋'), 'the lemon in the tab: ' + r.icon.slice(0, 80));
  }, { time: new Date('2026-07-01T12:00:00') });
  await siteAt(async (p) => {
    eq((await look(p)).skin, 'moonlit', 'after dark: the night theme');
    // And back in the morning, without reloading.
    await p.clock.fastForward('10:00:00');
    await p.waitForFunction(() => document.documentElement.dataset.skin === 'lemonade', null, { timeout: 5000 });
  }, { time: new Date('2026-07-01T22:30:00') });
  await putFile('theme.md', '---\ntheme: lemonade\ntab_icon: pal\nnight_theme: nonsense\n---\n');
  eq((await publicData()).theme, { theme: 'lemonade', tab_icon: 'pal' }, 'a drawing works, an unknown night theme doesn’t');
  await putFile('theme.md', '---\ntheme: lemonade\ntab_icon: "<b>x</b>"\nnight_theme: lemonade\n---\n');
  eq((await publicData()).theme, { theme: 'lemonade' }, 'no odd icon, and no night theme the same as the day');
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('the editor: effects, after dark, colours from a picture, surprise me and undo', async () => {
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-card');
  await openEditor(page);
  await page.locator('.tm-tab', { hasText: 'Effects' }).click();
  await page.locator('.chip-row[aria-label="Your name"] .chip-btn', { hasText: 'Glitter' }).click();
  await page.locator('.chip-row[aria-label="Falling over the page"] .chip-btn', { hasText: 'Snow' }).click();
  // The preview shows it.
  await page.waitForFunction(() => document.querySelector('.tm-frame')?.contentDocument?.documentElement.dataset.skNameStyle === 'glitter', null, { timeout: 10000 });
  // Undo steps back one change at a time.
  await page.locator('button', { hasText: '↶ Undo' }).click();
  eq(await page.locator('.chip-row[aria-label="Falling over the page"] .chip-btn[aria-pressed="true"]').innerText(), 'Nothing', 'snow undone');
  eq(await page.locator('.chip-row[aria-label="Your name"] .chip-btn[aria-pressed="true"]').innerText(), 'Glitter', 'glitter kept');
  // Tab icon and after dark.
  await page.locator('.tm-tab', { hasText: 'Tab icon' }).click();
  await page.locator('.tm-pick[aria-label="Bunny friend"]').click();
  await page.getByLabel('After dark', { exact: true }).selectOption('moonlit');
  await page.waitForFunction(() => document.querySelector('.tm-frame')?.contentDocument?.documentElement.dataset.skin === 'moonlit', null, { timeout: 10000 });
  await page.locator('.chip-btn', { hasText: 'Daytime' }).click();
  await page.waitForFunction(() => document.querySelector('.tm-frame')?.contentDocument?.documentElement.dataset.skin === 'classic', null, { timeout: 10000 });
  // Colours from a picture.
  await page.locator('.tm-tab', { hasText: 'Colours' }).click();
  await page.locator('label', { hasText: 'Choose a picture' }).locator('input').setInputFiles('tests/fixtures/p1.jpg');
  await page.waitForSelector('.tm-set');
  eq(await page.locator('.tm-set').count(), 4, 'four colour sets');
  await page.locator('.tm-set').first().click();
  const main = await page.getByLabel('Main', { exact: true }).inputValue();
  assert(/^#[0-9a-f]{6}$/.test(main) && main !== '#0054e3', 'main colour from the picture: ' + main);
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => /on your site now/.test(document.querySelector('.toast')?.textContent || ''));
  const saved = (await publicData()).theme;
  eq([saved.theme, saved.name_style, saved.tab_icon, saved.night_theme, saved.falling], ['classic', 'glitter', 'pal', 'moonlit', undefined], 'saved: ' + JSON.stringify(saved));
  eq(saved.main, main, 'the picture’s colour');
  // Surprise me: a whole new look, still valid when saved.
  await page.waitForSelector('.tm-card');
  await page.locator('button', { hasText: 'Surprise me' }).click();
  await page.locator('button', { hasText: 'Surprise me' }).click();
  await page.locator('button', { hasText: 'Save the theme' }).click();
  let random = {};
  for (let i = 0; i < 40; i++) {
    random = (await publicData()).theme;
    if (random.main !== saved.main) break;
    await page.waitForTimeout(250);
  }
  assert(/^#[0-9a-f]{6}$/.test(random.main) && random.main !== saved.main, 'a random theme: ' + JSON.stringify(random));
  // Every part remixed (and all of it accepted by the server).
  const parts = ['main', 'accent', 'paper', 'wallpaper', 'decoration', 'font', 'title_font', 'selector', 'bars', 'corners', 'density', 'name_style', 'header'];
  const got = parts.filter((k) => random[k] != null);
  assert(got.length >= parts.length - 6, 'most parts set: ' + JSON.stringify(random));
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('seasons and festive days: picked by hand, or automatic by the date', async () => {
  const { seasonOf, festivalOn, FESTIVALS } = await import('../public/js/skins.js');
  const at = (d) => new Date(d + 'T12:00:00');
  eq([seasonOf(at('2026-01-10')), seasonOf(at('2026-04-10')), seasonOf(at('2026-07-10')), seasonOf(at('2026-10-10')), seasonOf(at('2026-07-10'), true)], ['winter', 'spring', 'summer', 'autumn', 'winter'], 'the seasons, north and south');
  const all = Object.keys(FESTIVALS);
  const days = { '2026-12-25': 'christmas', '2027-02-10': 'lunar_new_year', '2026-03-20': 'eid_al_fitr', '2026-03-28': 'nowruz', '2026-11-08': 'diwali', '2026-12-21': 'yalda', '2026-03-03': 'holi', '2026-02-25': 'ramadan', '2026-10-31': 'halloween', '2026-12-08': 'hanukkah', '2026-05-27': 'eid_al_adha', '2026-09-25': 'mid_autumn', '2026-06-15': '' };
  for (const [d, want] of Object.entries(days)) eq(festivalOn(at(d), all), want, d);
  eq(festivalOn(at('2026-12-25'), ['diwali']), '', 'only the ones you tick');
  eq(festivalOn(at('2026-03-20'), ['nowruz', 'ramadan']), 'nowruz', 'the next one ticked');
  await putFile('theme.md', '---\ntheme: matcha\nseasons: auto\nfestivals: [christmas, diwali, nonsense]\n---\n');
  eq((await publicData()).theme, { theme: 'matcha', seasons: 'auto', festivals: ['christmas', 'diwali'] }, 'saved (odd ones left out)');
  const look = (p) => p.evaluate(() => ({ season: document.documentElement.dataset.season, festival: document.documentElement.dataset.festival || '', corner: document.querySelectorAll('.stk-corner-br .stk').length, fx: document.querySelectorAll('canvas.fx-layer').length }));
  await siteAt(async (p) => eq(await look(p), { season: 'winter', festival: 'christmas', corner: 1, fx: 1 }, 'Christmas, in winter: snow and a drawing in the corner'), { time: new Date('2026-12-20T12:00:00') });
  await siteAt(async (p) => eq(await look(p), { season: 'summer', festival: '', corner: 1, fx: 1 }, 'summer sunshine'), { time: new Date('2026-07-01T12:00:00'), desktop: false });
  await siteAt(async (p) => eq(await look(p), { season: 'autumn', festival: 'diwali', corner: 1, fx: 0 }, 'still the decoration, but nothing moving for visitors who want stillness'), { time: new Date('2026-11-08T12:00:00'), reducedMotion: 'reduce' });
  // A snowy title bar in winter.
  await siteAt(async (p) => eq(await p.evaluate(() => getComputedStyle(document.querySelector('.xp-title'), '::before').content), '""', 'snow on the title bar'), { time: new Date('2026-01-10T12:00:00') });
  // Something you've chosen to fall yourself stays; the season only adds its drawing.
  await putFile('theme.md', '---\ntheme: matcha\nseasons: auto\nfalling: hearts\n---\n');
  await siteAt(async (p) => eq(await look(p), { season: 'spring', festival: '', corner: 1, fx: 1 }, 'spring, with your own hearts'), { time: new Date('2026-04-10T12:00:00') });
  // Picked by hand: whatever the date.
  await putFile('theme.md', '---\ntheme: matcha\nseasons: winter\n---\n');
  await siteAt(async (p) => eq(await look(p), { season: 'winter', festival: '', corner: 1, fx: 1 }, 'winter in July, because you picked it'), { time: new Date('2026-07-01T12:00:00') });
  await putFile('theme.md', '---\ntheme: matcha\nseasons: nowruz\n---\n');
  await siteAt(async (p) => eq(await look(p), { season: undefined, festival: 'nowruz', corner: 1, fx: 1 }, 'Nowruz, picked by hand'), { time: new Date('2026-07-01T12:00:00') });
  await putFile('theme.md', '---\ntheme: matcha\nseasons: ramadan\n---\n');
  await siteAt(async (p) => eq(await look(p), { season: undefined, festival: 'ramadan', corner: 1, fx: 0 }, 'Ramadan stays quiet: a lantern, nothing falling'), { time: new Date('2026-07-01T12:00:00') });
  await putFile('theme.md', '---\ntheme: matcha\n---\n');
  await siteAt(async (p) => eq(await look(p), { season: undefined, festival: '', corner: 0, fx: 0 }, 'off unless you choose'), { time: new Date('2026-12-24T12:00:00') });
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('Surprise me remixes every part, optional extras too, but keeps your menu and words', async () => {
  await putFile('theme.md', '---\ntheme: classic\nmenu: ["home", "music"]\nlabels: {"music": "Tunes"}\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-card');
  await openEditor(page);
  await page.locator('.tm-tab', { hasText: 'Share' }).click();
  // Press it many times, reading the whole theme (as it would be saved) each time.
  const seen = new Set();
  const mains = new Set();
  let last;
  for (let i = 0; i < 30; i++) {
    await page.locator('button', { hasText: 'Surprise me' }).click();
    const code = await page.getByRole('textbox', { name: 'Your theme code' }).inputValue();
    last = JSON.parse(Buffer.from(code.replace('MYTHEME-', ''), 'base64url').toString());
    for (const [k, v] of Object.entries(last)) if (v && (!Array.isArray(v) || v.length) && (typeof v !== 'object' || Object.keys(v).length)) seen.add(k);
    mains.add(last.main);
    eq([last.menu, last.labels], [['home', 'music'], { music: 'Tunes' }], 'your menu and words stay');
  }
  assert(mains.size > 25, 'new colours every time');
  const every = ['main', 'accent', 'paper', 'wallpaper', 'decoration', 'pointer', 'font', 'title_font', 'selector', 'bars', 'corners', 'density', 'name_style', 'sounds', 'apps', 'stickers', 'glass', 'floppy', 'seasons', 'tab_icon', 'night_theme', 'trail', 'falling'];
  const missing = every.filter((k) => !seen.has(k));
  assert(missing.length <= 2, 'every part comes up across the remixes, missing: ' + missing.join(', '));
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => /on your site now/.test(document.querySelector('.toast')?.textContent || ''));
  const saved = (await publicData()).theme;
  eq([saved.menu, saved.labels], [['home', 'music'], { music: 'Tunes' }], 'saved, with your menu and words');
  assert(/^#[0-9a-f]{6}$/.test(saved.main), 'and the server accepts the remix');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('the editor: seasons and festive days, previewed', async () => {
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-card');
  await openEditor(page);
  await page.locator('.tm-tab', { hasText: 'Seasons' }).click();
  // By hand first: shown straight away in the preview.
  await page.locator('.chip-row[aria-label^="Festive day"] .chip-btn', { hasText: 'Diwali' }).click();
  await page.waitForFunction(() => document.querySelector('.tm-frame')?.contentDocument?.documentElement.dataset.festival === 'diwali', null, { timeout: 10000 });
  await page.locator('.chip-row[aria-label="Season"] .chip-btn', { hasText: 'Automatic' }).click();
  await page.locator('.tm-fest', { hasText: 'Nowruz' }).locator('input').check();
  await page.waitForFunction(() => document.querySelector('.tm-frame')?.contentDocument?.documentElement.dataset.festival === 'nowruz', null, { timeout: 10000 });
  await page.locator('.chip-row[aria-label="Preview a season or festive day"] .chip-btn', { hasText: 'Winter' }).click();
  await page.waitForFunction(() => { const r = document.querySelector('.tm-frame')?.contentDocument?.documentElement; return r?.dataset.season === 'winter' && !r.dataset.festival; }, null, { timeout: 10000 });
  await page.locator('.tm-fest', { hasText: 'Yalda' }).locator('input').check();
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => /on your site now/.test(document.querySelector('.toast')?.textContent || ''));
  eq((await publicData()).theme, { theme: 'classic', seasons: 'auto', festivals: ['nowruz', 'yalda'] }, 'saved');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('festive days from everywhere, days of your own, and dates you can change', async () => {
  const { festivalOn, nextFestival, cleanFestivalDates, FESTIVALS } = await import('../public/js/skins.js');
  const at = (d) => new Date(d + 'T12:00:00');
  const all = Object.keys(FESTIVALS);
  const days = { '2026-06-19': 'dragon_boat', '2027-03-28': 'easter', '2027-02-09': 'carnival', '2026-11-01': 'dia_de_muertos', '2026-01-06': 'dia_de_reyes', '2026-07-07': 'tanabata', '2026-05-05': 'childrens_day', '2026-03-17': 'st_patricks', '2026-11-05': 'bonfire_night', '2026-06-21': 'midsummer', '2026-04-05': 'easter', '2026-04-08': 'hanami' };
  for (const [d, want] of Object.entries(days)) eq(festivalOn(at(d), all), want, d);
  // Your own days come first, every year (and can run over New Year).
  const mine = [{ name: 'Mum’s birthday', from: '06-19', to: '06-19', what: '🎂', falling: 'confetti' }, { name: 'Winter break', from: '12-30', to: '01-02', what: 'twinkle', falling: '' }];
  eq([festivalOn(at('2026-06-19'), all, mine), festivalOn(at('2027-01-01'), all, mine), festivalOn(at('2026-06-20'), [], mine)], ['my_1', 'my_2', ''], 'your own days');
  // Eid seen a day later where you are: your dates that year, the usual ones other years.
  const dates = cleanFestivalDates({ eid_al_fitr: { from: '2026-03-21', to: '2026-03-23' }, nonsense: { from: '2026-01-01' }, holi: { from: '2026-01-01', to: '2026-12-31' } });
  eq(Object.keys(dates), ['eid_al_fitr'], 'odd and over-long dates left out');
  eq([festivalOn(at('2026-03-20'), ['eid_al_fitr'], [], dates), festivalOn(at('2026-03-23'), ['eid_al_fitr'], [], dates), festivalOn(at('2027-03-10'), ['eid_al_fitr'], [], dates)], ['', 'eid_al_fitr', 'eid_al_fitr'], 'your dates, then the usual');
  const next = nextFestival('christmas', {}, at('2026-11-30'));
  eq([next[0].getDate(), next[0].getMonth(), next[1].getDate()], [1, 11, 26], 'when it next comes round');
  // Saved and shown.
  await putFile('theme.md', '---\ntheme: classic\nseasons: auto\nfestivals: [eid_al_fitr]\nfestival_dates: {"eid_al_fitr": {"from": "2027-03-11", "to": "2027-03-13"}}\nmy_days: [{"name": "Our anniversary", "from": "07-01", "to": "07-01", "what": "💐", "falling": "hearts"}]\n---\n');
  const theme = (await publicData()).theme;
  eq([theme.festival_dates, theme.my_days.map((m) => m.name)], [{ eid_al_fitr: { from: '2027-03-11', to: '2027-03-13' } }, ['Our anniversary']], 'saved');
  const look = (p) => p.evaluate(() => ({ festival: document.documentElement.dataset.festival || '', corner: document.querySelector('.stk-corner-br .stk')?.textContent || '' }));
  await siteAt(async (p) => eq(await look(p), { festival: 'mine', corner: '💐' }, 'your own day, with your emoji'), { time: new Date('2027-07-01T12:00:00') });
  await siteAt(async (p) => eq((await look(p)).festival, 'eid_al_fitr', 'Eid on your date'), { time: new Date('2027-03-13T12:00:00') });
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('the seasons settle on everything: title bars, icons, the taskbar, the desktop, posts and the menu', async () => {
  const has = (p, sel, pseudo) => p.evaluate(([sel, pseudo]) => { const el = document.querySelector(sel); if (!el) return 'missing ' + sel; const cs = getComputedStyle(el, pseudo); return cs.content !== 'none' && cs.backgroundImage !== 'none' && cs.pointerEvents === 'none'; }, [sel, pseudo]);
  for (const season of ['winter', 'spring', 'summer', 'autumn']) {
    await putFile('theme.md', `---\ntheme: bunny\nseasons: ${season}\n---\n`);
    await siteAt(async (p) => {
      for (const [sel, pseudo] of [['.dw-xp .xp-title', '::before'], ['.desk-icon .dock-icon', '::before'], ['.desktop .taskbar', '::before'], ['.desktop', '::before']]) eq(await has(p, sel, pseudo), true, `${season}: ${sel}${pseudo}`);
      // The icons keep their own pictures (the Atlas's green continent is drawn with ::after).
      assert(await p.evaluate(() => { const a = getComputedStyle(document.querySelector('.dock-icon.di-atlas'), '::after'); return a.backgroundColor !== 'rgba(0, 0, 0, 0)' && a.backgroundImage === 'none' && a.width !== 'auto'; }), `${season}: the icons' own pictures stay`);
      // Still clickable.
      await p.locator('.desk-icon').first().dblclick();
    }, { reducedMotion: 'reduce' });
    await siteAt(async (p) => {
      eq(await has(p, '.xp-title', '::before'), true, `${season} on a phone: the title bar`);
      if (season !== 'autumn') eq(await has(p, '.xp-nav', '::after'), true, `${season} on a phone: under the menu`);
      await p.locator('.xp-links a', { hasText: 'Thoughts' }).click();
    }, { desktop: false, reducedMotion: 'reduce' });
  }
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('while you choose, the preview stays in view (beside the choices, or pinned on a phone)', async () => {
  const browser = await chromium.launch();
  for (const [opts, label] of [[{ viewport: { width: 1280, height: 860 } }, 'computer'], [{ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'phone']]) {
    const page = await browser.newPage(opts);
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    await page.goto(BASE + '/admin/');
    await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
    await page.waitForSelector('.tm-card');
    await page.evaluate(() => scrollBy(0, 900));
    await page.waitForTimeout(200);
    const box = await page.locator('.tm-frame-box').boundingBox();
    assert(box.y >= -2 && box.y < 140 && box.height > 150, `${label}: the preview is still in view (${Math.round(box.y)}, ${Math.round(box.height)} tall)`);
    if (label === 'phone') {
      assert(box.height < 844 * 0.45, 'small enough to leave room for the choices');
      // The whole site in miniature, not squashed.
      const inner = await page.frames().find((f) => f !== page.mainFrame()).evaluate(() => innerHeight);
      assert(inner > 600, 'the site inside is full height: ' + inner);
      await page.locator('button', { hasText: 'Hide preview' }).click();
      eq(await page.locator('.tm-frame-box').isVisible(), false, 'tucked away');
      await page.locator('button', { hasText: 'Show preview' }).click();
      eq(await page.locator('.tm-frame-box').isVisible(), true, 'and back');
    }
    // The visa on Designs too.
    await page.locator('.admin-tabs button', { hasText: 'Designs' }).click();
    await page.waitForSelector('.visa-layout');
    const top = await page.evaluate(() => document.querySelector('.visa-layout').getBoundingClientRect().top + scrollY);
    await page.evaluate((t) => scrollTo(0, t + 100), top);
    await page.waitForTimeout(200);
    const visa = await page.locator('.visa-preview').boundingBox();
    assert(visa.y >= -2 && visa.y < 20, `${label}: the visa stays in view (${Math.round(visa.y)})`);
    assert(!page.errors.length, page.errors.join('; '));
    await page.close();
  }
  await browser.close();
});

await test('your own words on the buttons, everywhere they show', async () => {
  await putFile('theme.md', '---\ntheme: classic\nlabels: {"thoughts": "Diary", "journal": "Where I ate", "explore": "Start", "others": "More", "nudge": "Poke", "home": "Feed", "nonsense": "x", "about": "<b>Me</b>", "music": "   "}\n---\n');
  eq((await publicData()).theme.labels, { thoughts: 'Diary', journal: 'Where I ate', explore: 'Start', others: 'More', nudge: 'Poke', home: 'Feed', about: 'bMe/b' }, 'saved, cleaned');
  await siteAt(async (p) => {
    const links = (await p.locator('.xp-links a').allInnerTexts()).filter(Boolean);
    eq(links.slice(0, 3), ['Feed', 'Diary', 'Where I ate'], 'the menu bar');
    assert((await p.locator('.xp-others').innerText()).includes('More'), 'Others renamed');
    assert((await p.locator('.start-btn').innerText()).includes('Start'), 'Explore renamed');
    eq((await p.locator('.nudge-btn').innerText()).trim(), 'Poke', 'Nudge renamed');
  }, { desktop: false });
  await siteAt(async (p) => {
    const icons = await p.locator('.desk-label').allInnerTexts();
    assert(icons.includes('Feed') && icons.includes('Where I ate'), 'desktop icons: ' + icons.join(', '));
    await p.locator('.start-btn').click();
    const menu = await p.locator('.start-menu').innerText();
    assert(menu.includes('Where I ate'), 'the Explore menu: ' + menu.slice(0, 200));
    await p.locator('.start-btn').click();
    await p.locator('.desk-icon', { hasText: 'Where I ate' }).dblclick();
    await p.waitForFunction(() => [...document.querySelectorAll('.dw .wbar')].some((b) => b.textContent.includes('Where I ate')));
  });
  // Renamed in the back office.
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-card');
  await openEditor(page);
  await page.locator('.tm-tab', { hasText: 'Words' }).click();
  await page.getByLabel('Your words for “Thoughts”').fill('Diary');
  await page.getByLabel('Your words for “Thoughts”').press('Tab');
  await page.waitForFunction(() => [...(document.querySelector('.tm-frame')?.contentDocument?.querySelectorAll('.xp-links a') || [])].some((a) => a.textContent === 'Diary'), null, { timeout: 20000 });
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => /on your site now/.test(document.querySelector('.toast')?.textContent || ''));
  eq((await publicData()).theme, { theme: 'classic', labels: { thoughts: 'Diary' } }, 'saved from the editor');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('a post can have a font of its own; the rest follow the theme', async () => {
  const at = (d) => new Date(Date.now() - d * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  await putFile('theme.md', '---\ntheme: classic\nfont: typewriter\n---\n');
  await putFile('thoughts/font-pixel.md', `---\ndate: ${at(1)}\ntitle: In pixels\nfont: pixel\n---\nA thought written in pixels.\n`);
  await putFile('thoughts/font-none.md', `---\ndate: ${at(2)}\ntitle: In the site's font\n---\nA thought in the theme's font.\n`);
  await putFile('thoughts/font-odd.md', `---\ndate: ${at(3)}\ntitle: Odd font\nfont: "<script>"\n---\nStill fine.\n`);
  await putFile('places/font-cafe.md', `---\ndate: ${at(4)}\ntitle: Font Café\ncity: Leeds\nrating: 4\nfont: elegant\n---\nAn elegant review.\n`);
  await putFile('books/font-book.md', `---\ndate: ${at(5)}\ntitle: A Font Book\nauthor: Someone\nrating: 4\nfont: comic\n---\nA comic review.\n`);
  const css = fs.readFileSync(new URL('../public/css/skins.css', import.meta.url), 'utf8');
  const { OPTIONS } = await import('../public/js/skins.js');
  for (const k of Object.keys(OPTIONS.font.choices)) assert(css.includes(`[data-font="${k}"] .prose`), 'a rule for the ' + k + ' font');
  const posts = (await publicData()).posts;
  const fontOf = (slug) => posts.find((p) => p.slug === slug)?.font;
  eq([fontOf('font-pixel'), fontOf('font-none'), fontOf('font-odd'), fontOf('font-cafe'), fontOf('font-book')], ['pixel', '', '', 'elegant', 'comic'], 'read from the files');
  const family = (p, sel) => p.evaluate((sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontFamily : 'missing ' + sel; }, sel);
  await siteAt(async (p) => {
    await p.goto(BASE + '/#/post/thoughts/font-pixel');
    await p.waitForSelector('.card .prose p');
    assert((await family(p, '.card[data-font="pixel"] .prose p')).includes('Pixelify'), 'the pixel post');
    assert((await family(p, '.card[data-font="pixel"] .card-title')).includes('Pixelify'), 'its title too');
    await p.goto(BASE + '/#/post/thoughts/font-none');
    await p.waitForSelector('.card .prose p');
    assert((await family(p, '.card .prose p')).includes('Special Elite'), 'the theme’s font for the rest');
    eq(await p.locator('.card[data-font]').count(), 0, 'no font of its own');
    await p.goto(BASE + '/#/journal/font-cafe');
    await p.waitForSelector('.ruled p');
    assert((await family(p, '.ruled p')).includes('Libre Baskerville'), 'the journal page: ' + (await family(p, '.ruled p')));
    await p.goto(BASE + '/#/books/font-book');
    await p.waitForSelector('.review-body p');
    assert((await family(p, '.review-body p')).includes('Comic Neue'), 'the review');
  }, { desktop: false });
  // Chosen in the editor.
  const page = await adminPage();
  await newPost(page, 'Thought');
  await page.locator('.post-fonts .chip-btn', { hasText: 'Handwritten' }).click();
  const box = page.locator('textarea.textarea').first();
  assert((await box.evaluate((el) => getComputedStyle(el).fontFamily)).includes('Gaegu'), 'the writing box shows the font');
  await box.fill('Written by hand, as it were.');
  await page.locator('button', { hasText: /^Publish$/ }).click();
  assert(/Published/.test(await toastText(page)), 'published');
  const mine = (await publicData()).posts.find((p) => p.excerpt?.startsWith('Written by hand'));
  eq(mine?.font, 'handwritten', 'saved with the post');
  // And back to the site's font.
  await editPost(page, 'Written by hand');
  await page.locator('.post-fonts .chip-btn', { hasText: 'The site’s' }).click();
  await page.locator('button', { hasText: /^Save changes$/ }).click();
  await toastText(page);
  await page.waitForTimeout(500);
  eq((await publicData()).posts.find((p) => p.excerpt?.startsWith('Written by hand'))?.font, '', 'back to the site’s font');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('every app can take the theme’s font, or any font (and a post’s own font still wins)', async () => {
  const at = (d) => new Date(Date.now() - d * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  await putFile('places/appfont-cafe.md', `---\ndate: ${at(1)}\ntitle: App Font Café\ncity: York\nrating: 4\n---\nA review in the journal.\n`);
  await putFile('books/appfont-book.md', `---\ndate: ${at(2)}\ntitle: App Font Book\nauthor: Someone\nrating: 4\n---\nA book review.\n`);
  await putFile('books/appfont-own.md', `---\ndate: ${at(3)}\ntitle: Its Own Font\nauthor: Someone\nrating: 3\nfont: comic\n---\nA review in comic letters.\n`);
  const all = (font) => '{' + ['journal', 'passport', 'atlas', 'wishlist', 'guestbook', 'books', 'films', 'podcasts', 'music', 'tv', 'album'].map((id) => `"${id}": {"font": "${font}"}`).join(', ') + '}';
  await putFile('theme.md', `---\ntheme: classic\napps: ${all('pixel')}\n---\n`);
  eq((await publicData()).theme.apps.books, { font: 'pixel' }, 'saved');
  const family = (p, sel) => p.evaluate((sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontFamily : 'missing ' + sel; }, sel);
  const check = async (p, want) => {
    for (const [hash, sel] of [['#/books/appfont-book', '.review-card > h2'], ['#/books/appfont-book', '.review-body p'], ['#/journal/appfont-cafe', '.journal-head > h2'], ['#/wishlist', '[data-app="wishlist"] h1, [data-app="wishlist"] h2, [data-app="wishlist"] .mac-title'], ['#/guestbook', '[data-app="guestbook"] .droid-bar, [data-app="guestbook"] h1, [data-app="guestbook"] h2, [data-app="guestbook"] button']]) {
      await p.goto(BASE + '/' + hash);
      await p.waitForTimeout(700);
      const f = await family(p, sel);
      assert(f.includes(want), `${hash} ${sel}: ${f}`);
    }
    await p.goto(BASE + '/#/books/appfont-own');
    await p.waitForSelector('.review-body p');
    assert((await family(p, '.review-body p')).includes('Comic Neue'), 'a post’s own font wins inside the app');
  };
  await siteAt((p) => check(p, 'Pixelify'), { desktop: false });
  // The theme's font, whatever it is.
  await putFile('theme.md', `---\ntheme: classic\nfont: typewriter\napps: ${all('theme')}\n---\n`);
  await siteAt((p) => check(p, 'Special Elite'), { desktop: false });
  // Each its own: back to the era's lettering.
  await putFile('theme.md', '---\ntheme: classic\nfont: typewriter\n---\n');
  await siteAt(async (p) => {
    await p.goto(BASE + '/#/books/appfont-book');
    await p.waitForSelector('.review-card > h2');
    assert(!(await family(p, '.review-card > h2')).includes('Special Elite'), 'the shelf keeps its own lettering');
  }, { desktop: false });
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('every day your own way: its drawings and their places, what falls, and where a season settles', async () => {
  await putFile('theme.md', '---\ntheme: classic\nseasons: winter\nlooks: {"winter": {"charms": ["⛄", "snowflake"], "where": ["title", "profile"], "settle": ["bars", "taskbar"], "falling": "none"}}\n---\n');
  eq((await publicData()).theme.looks, { winter: { charms: ['⛄', 'snowflake'], falling: 'none', where: ['title', 'profile'], settle: ['bars', 'taskbar'] } }, 'saved');
  await siteAt(async (p) => {
    const r = await p.evaluate(() => ({
      settle: document.documentElement.dataset.settle,
      title: document.querySelectorAll('.stk-title .stk').length,
      profile: document.querySelectorAll('.stk-profile .stk').length,
      corner: document.querySelectorAll('.stk-corner-br .stk').length,
      fx: document.querySelectorAll('canvas.fx-layer').length,
      icon: getComputedStyle(document.querySelector('.desk-icon .dock-icon'), '::before').backgroundImage,
      bar: getComputedStyle(document.querySelector('.dw-xp .xp-title'), '::before').content
    }));
    eq([r.settle, r.title > 0, r.profile > 0, r.corner, r.fx, r.icon, r.bar], ['bars taskbar', true, true, 0, 0, 'none', '""'], 'your drawings where you put them, nothing falling, snow only where you said');
  });
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('seasonal glass over photos, thoughts and covers: with the season, or a style of its own', async () => {
  const at = (d) => new Date(Date.now() - d * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  await putFile('thoughts/glass-thought.md', `---\ndate: ${at(1)}\ntitle: Through the glass\n---\nA thought behind frosted glass.\n`);
  await putFile('books/glass-book.md', `---\ndate: ${at(2)}\ntitle: Glass Book\nauthor: Someone\nrating: 4\n---\nA review.\n`);
  await putFile('theme.md', '---\ntheme: classic\nseasons: winter\nglass: [thoughts, books, photos]\n---\n');
  eq((await publicData()).theme.glass, ['thoughts', 'books', 'photos'], 'saved');
  const look = (p) => p.evaluate(() => ({ look: document.documentElement.dataset.glassLook, thought: !!document.querySelector('.card-is-thought > .glass.glass-card'), opacity: getComputedStyle(document.querySelector('.glass') || document.body).opacity }));
  await siteAt(async (p) => {
    const r = await look(p);
    eq([r.look, r.thought], ['winter', true], 'frost on the thoughts');
    await p.goto(BASE + '/#/books');
    await p.waitForSelector('.book-cover > .glass.glass-item');
    eq(await p.locator('.book-cover > .glass').first().evaluate((g) => getComputedStyle(g).pointerEvents), 'none', 'never in the way');
  }, { desktop: false });
  // A style of its own, with no season at all, and softer.
  await putFile('theme.md', '---\ntheme: classic\nglass: [thoughts]\nglass_style: festive\nglass_strength: soft\n---\n');
  await siteAt(async (p) => {
    const r = await look(p);
    eq([r.look, r.thought, r.opacity], ['festive', true, '0.5'], 'sparkles, softly');
  }, { desktop: false });
  // Off.
  await putFile('theme.md', '---\ntheme: classic\nseasons: winter\n---\n');
  await siteAt(async (p) => eq(await p.locator('.glass').count(), 0, 'no glass unless you choose it'), { desktop: false });
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('Floppy dresses for the seasons and festive days, or in your own outfit', async () => {
  const floppy = (p) => p.evaluate(() => document.querySelector('.fl-disk svg, .floppy-doodle svg, .snag-floppy svg')?.outerHTML || '');
  const open = async (p) => { await p.goto(BASE + '/#/search'); await p.waitForSelector('.fl-disk svg'); };
  await putFile('theme.md', '---\ntheme: classic\nfloppy: {"dress": "auto"}\n---\n');
  await siteAt(async (p) => { await open(p); const svg = await floppy(p); assert(svg.includes('fl-outfit') && svg.includes('#d6283f'), 'a red scarf and bobble hat in winter'); }, { desktop: false, time: new Date('2026-01-10T12:00:00') });
  await siteAt(async (p) => { await open(p); const svg = await floppy(p); assert(svg.includes('fl-outfit') && svg.includes('#1d1d24'), 'sunglasses in summer'); }, { desktop: false, time: new Date('2026-07-10T12:00:00') });
  await putFile('theme.md', '---\ntheme: classic\nseasons: auto\nfestivals: [christmas]\nfloppy: {"dress": "auto"}\n---\n');
  await siteAt(async (p) => { await open(p); const svg = await floppy(p); assert(svg.includes('#7a1420'), 'a festive hat at Christmas'); }, { desktop: false, time: new Date('2026-12-20T12:00:00') });
  await putFile('theme.md', '---\ntheme: classic\nfloppy: {"dress": "own", "colour": "own", "hex": "#aa3366", "own": {"hat": "crown", "eyes": "glasses", "held": "🎈"}}\n---\n');
  eq((await publicData()).theme.floppy, { dress: 'own', colour: 'own', own: { hat: 'crown', eyes: 'glasses', held: '🎈' }, hex: '#aa3366' }, 'saved');
  await siteAt(async (p) => {
    await open(p);
    const svg = await floppy(p);
    assert(svg.includes('#aa3366') && svg.includes('#f6c431') && svg.includes('🎈'), 'his colour, a crown and a balloon emoji');
  }, { desktop: false });
  // In the editor.
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-card');
  await openEditor(page);
  await page.locator('.tm-tab', { hasText: 'Floppy' }).click();
  await page.locator('.chip-row[aria-label="Dress him"] .chip-btn', { hasText: 'My own outfit' }).click();
  await page.locator('.chip-row[aria-label="Hat"] .chip-btn', { hasText: 'Party hat' }).click();
  assert((await page.locator('.tm-floppy-pic').innerHTML()).includes('fl-outfit'), 'the picture shows the outfit');
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => /on your site now/.test(document.querySelector('.toast')?.textContent || ''));
  eq((await publicData()).theme.floppy?.own, { hat: 'party' }, 'saved from the editor');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('festive days and your own days settle across the site like the seasons', async () => {
  const has = (p, sel, pseudo) => p.evaluate(([sel, pseudo]) => { const el = document.querySelector(sel); if (!el) return 'missing ' + sel; const cs = getComputedStyle(el, pseudo); return cs.backgroundImage.includes('data:image/svg') && cs.pointerEvents === 'none'; }, [sel, pseudo]);
  for (const day of ['christmas', 'diwali', 'nowruz', 'eid_al_fitr', 'dia_de_muertos', 'hanami', 'my_1']) {
    await putFile('theme.md', `---\ntheme: matcha\nseasons: ${day}\nmy_days: [{"name": "Our day", "from": "06-01", "to": "06-01", "what": "🎂", "falling": "confetti"}]\nfloppy: {"dress": "auto"}\n---\n`);
    await siteAt(async (p) => {
      for (const [sel, pseudo] of [['.dw-xp .xp-title', '::before'], ['.desk-icon .dock-icon', '::before'], ['.desktop .taskbar', '::before'], ['.desktop', '::before']]) eq(await has(p, sel, pseudo), true, `${day}: ${sel}${pseudo}`);
      eq(await p.evaluate(() => document.documentElement.dataset.festival), day === 'my_1' ? 'mine' : day, `${day} is on`);
    }, { reducedMotion: 'reduce', time: new Date('2026-07-01T12:00:00') });
    await siteAt(async (p) => {
      eq(await has(p, '.xp-title', '::before'), true, `${day} on a phone: the title bar`);
      eq(await has(p, '.xp-nav', '::after'), true, `${day} on a phone: a garland under the menu`);
      await p.goto(BASE + '/#/search');
      await p.waitForSelector('.fl-disk svg');
      assert((await p.locator('.fl-disk').innerHTML()).includes('fl-outfit'), `${day}: Floppy dresses for it`);
    }, { desktop: false, reducedMotion: 'reduce', time: new Date('2026-07-01T12:00:00') });
  }
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('stylesheet pictures are whole: no raw # cuts one short (it would end the address there and draw nothing)', async () => {
  const dir = new URL('../public/css/', import.meta.url);
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.css'))) {
    const css = fs.readFileSync(new URL(f, dir), 'utf8');
    for (const m of css.matchAll(/url\((["'])data:image\/svg\+xml,(.*?)\1\)/g)) assert(!m[2].includes('#'), `${f}: a picture with a raw # near "${m[2].slice(0, 60)}"`);
  }
});

await test('on a phone the season settles on every app\'s top bar, below the clock, and under the menu', async () => {
  const bars = { home: '.xp-title', journal: '.leather-head', atlas: '.menubar', guestbook: '.droid-bar', books: '.shelf-bar', films: '.marquee', podcasts: '.deck-bar', music: '.hifi-bar', tv: '.tv-bar', album: '.al-bar' };
  const has = (p, sel, pseudo) => p.evaluate(([sel, pseudo]) => { const el = document.querySelector(sel); if (!el) return 'missing ' + sel; const cs = getComputedStyle(el, pseudo); return cs.content !== 'none' && cs.backgroundImage !== 'none' && cs.pointerEvents === 'none'; }, [sel, pseudo]);
  for (const season of ['winter', 'spring', 'summer', 'autumn', 'diwali']) {
    await putFile('theme.md', `---\ntheme: arcade\nseasons: ${season}\n---\n`);
    await siteAt(async (p) => {
      eq(await has(p, '.xp-nav', '::after'), true, `${season}: under the menu`);
      for (const [app, sel] of Object.entries(bars)) {
        await p.goto(BASE + '/#/' + app);
        await p.waitForSelector('.phone ' + sel);
        eq(await has(p, '.phone ' + sel, '::before'), true, `${season}: the ${app} bar`);
      }
    }, { desktop: false, reducedMotion: 'reduce', time: new Date('2026-07-01T12:00:00') });
  }
  // The bars that run up under a phone's clock keep it clear: the scenery starts below it.
  const css = fs.readFileSync(new URL('../public/css/skins.css', import.meta.url), 'utf8');
  assert(/\[data-settle~="bars"\] :is\(\.xp-phone \.xp-title, \.phone :is\(\.al-bar[^)]*\)\)::before \{ top: var\(--safe-top, 0px\); \}/.test(css), 'kept below the clock');
  // On a computer the app's own bar sits inside its window, under the window's bar: only the window's bar gets it.
  await putFile('theme.md', '---\ntheme: arcade\nseasons: autumn\n---\n');
  await siteAt(async (p) => {
    await p.goto(BASE + '/#/books');
    await p.waitForSelector('.dw-shelf .shelf-bar');
    eq(await p.evaluate(() => [...document.querySelectorAll('.dw-shelf *')].filter((e) => getComputedStyle(e, '::before').backgroundImage.includes('svg')).length), 1, 'once on a computer: along the window\'s bar');
  }, { reducedMotion: 'reduce' });
  await putFile('theme.md', '---\ntheme: classic\nseasons: summer\n---\n');
  await siteAt(async (p) => {
    eq(await p.evaluate(() => [...document.querySelectorAll('.feed > .card > .card-head > .card-season')].some((s) => getComputedStyle(s).backgroundImage.includes('svg'))), true, 'summer peeks over the posts');
  }, { reducedMotion: 'reduce' });
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('a theme that isn\'t saved yet says so, and leaving asks first; an open page picks up a saved theme', async () => {
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-savebar');
  eq(await page.locator('.tm-savebar.unsaved').count(), 0, 'nothing unsaved to start with');
  await page.locator('button', { hasText: 'Surprise me' }).click();
  await page.waitForSelector('.tm-savebar.unsaved .tm-unsaved');
  assert((await page.locator('.tm-unsaved').innerText()).includes('Not saved yet'), 'says it isn’t on the site');
  eq(await page.locator('.tm-savebar').evaluate((e) => getComputedStyle(e).position), 'sticky', 'stays in view');
  const asks = () => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  eq(await asks(), true, 'leaving asks first');
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => !document.querySelector('.tm-savebar.unsaved'));
  eq(await asks(), false, 'saved: leaving doesn’t ask');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  const saved = (await publicData()).theme.theme;
  // A page that was already open (like the site saved to a phone's home screen) puts on a newly
  // saved theme when you come back to it.
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  await siteAt(async (p) => {
    eq(await p.evaluate(() => document.documentElement.dataset.skin), 'classic', 'classic to start');
    await putFile('theme.md', '---\ntheme: bunny\n---\n');
    await p.clock.fastForward(61000);
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await p.waitForFunction(() => document.documentElement.dataset.skin === 'bunny', null, { timeout: 10000 });
  }, { desktop: false, reducedMotion: 'reduce', time: new Date() });
  assert(saved !== undefined, 'the remix was saved');
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('bold and loud themes: each with its own wallpaper, charm and touches, picked from a group that unfolds', async () => {
  const skins = await import('../public/js/skins.js');
  const content = await import('../src/content.js');
  const bold = skins.SKIN_GROUPS.find(([name]) => name === 'Bold and loud')[1];
  eq(bold, ['neon', 'empire', 'rococo', 'disco', 'popart', 'memphis', 'leopard', 'opera', 'blocky', 'bigtop'], 'ten of them');
  eq(skins.SKIN_GROUPS.flatMap(([, ids]) => ids).sort(), Object.keys(skins.SKINS).sort(), 'every theme is in exactly one group');
  for (const id of bold) {
    const t = skins.resolveSkin({ theme: id });
    assert(skins.wallpaperCss(t).length > 200, `${id}: a wallpaper of its own`);
    assert(t.decoration !== 'none' && skins.CHARMS[t.decoration](skins.inks(t)).includes('<'), `${id}: its charm draws`);
    assert(skins.CHARM_NAMES[t.decoration], `${id}: its charm has a name`);
    eq(content.parseTheme(`---\ntheme: ${id}\n---\n`).theme, id, `${id}: the server knows it`);
  }
  // Their touches come with them, and can still be changed.
  const neon = skins.resolveSkin({ theme: 'neon' });
  eq([neon.name_style, neon.trail, neon.wallpaper], ['glow', 'stars', 'sunset'], 'neon’s own touches');
  eq(skins.resolveSkin({ theme: 'neon', name_style: 'plain' }).name_style, 'plain', 'still yours to change');
  // Picking one from the folded group.
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-gbox');
  await page.locator('.tm-gbox summary', { hasText: 'Bold and loud' }).click();
  await page.locator('.tm-card', { hasText: 'Block World' }).click();
  await page.waitForFunction(() => document.querySelector('.tm-frame')?.contentDocument?.documentElement.dataset.skin === 'blocky', null, { timeout: 15000 });
  eq(await page.locator('.tm-gbox').evaluateAll((g) => g.map((x) => x.open)), [false, true, false, false], 'its group stays open, the old one folds');
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => !document.querySelector('.tm-savebar.unsaved'));
  eq((await publicData()).theme, { theme: 'blocky' }, 'saved');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  // On the site, each draws without a hitch.
  for (const id of bold) {
    await putFile('theme.md', `---\ntheme: ${id}\n---\n`);
    await siteAt(async (p) => {
      eq(await p.evaluate(() => document.documentElement.dataset.skin), id, `${id} on`);
      assert((await p.evaluate(() => getComputedStyle(document.querySelector('.desktop') || document.body).backgroundImage)).includes('url('), `${id}: its wallpaper shows`);
    }, { reducedMotion: 'reduce' });
  }
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('behind the posts: layered with the theme, its pattern and the season, or as you choose', async () => {
  const bg = (p) => p.evaluate(() => getComputedStyle(document.querySelector('.xp-phone .xp-body, .dw-xp .wbody')).backgroundImage);
  // Layered (the usual): the season's drawings on top, a wash, then the theme's pattern.
  await putFile('theme.md', '---\ntheme: bunny\nseasons: winter\n---\n');
  await siteAt(async (p) => {
    const b = await bg(p);
    eq((b.match(/url\(/g) || []).length >= 2, true, 'the season’s drawings and the bunny pattern');
    assert(b.includes('linear-gradient'), 'with a wash between');
    const card = await p.evaluate(() => getComputedStyle(document.querySelector('.feed > .card:not(.memory)')).backgroundColor);
    assert(/rgba\(255, 255, 255, 0\.8/.test(card), 'posts are frosted, so a little shows through: ' + card);
  }, { desktop: false, reducedMotion: 'reduce' });
  // Pattern only: no season drawings.
  await putFile('theme.md', '---\ntheme: bunny\nseasons: winter\npage: pattern\n---\n');
  await siteAt(async (p) => eq(((await bg(p)).match(/url\(/g) || []).length, 1, 'just the pattern'), { desktop: false, reducedMotion: 'reduce' });
  // Classic (the sky has no pattern): soft dots on the theme's colours. And on a computer too.
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  await siteAt(async (p) => assert((await bg(p)).includes('radial-gradient'), 'classic gets soft dots'), { reducedMotion: 'reduce' });
  // Plain: white, as before.
  await putFile('theme.md', '---\ntheme: bunny\npage: plain\n---\n');
  await siteAt(async (p) => {
    eq(await bg(p), 'none', 'plain white');
    eq(await p.evaluate(() => getComputedStyle(document.querySelector('.feed > .card')).backgroundColor), 'rgb(255, 255, 255)', 'solid posts');
  }, { desktop: false, reducedMotion: 'reduce' });
  // Saved and checked by the server.
  await putFile('theme.md', '---\ntheme: bunny\npage: wallpaper\npage_strength: strong\n---\n');
  eq([(await publicData()).theme.page, (await publicData()).theme.page_strength], ['wallpaper', 'strong'], 'kept');
  await putFile('theme.md', '---\ntheme: bunny\npage: nonsense\n---\n');
  eq((await publicData()).theme.page, undefined, 'an unknown choice is dropped');
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('post cards: designs for every post or just one, ribbons of your own, festive ribbons and a corner mark', async () => {
  const content = await import('../src/content.js');
  const { RIBBONS } = await import('../public/js/card-dress.js');
  eq(content.RIBBON_STYLES, Object.keys(RIBBONS), 'the server knows the same ribbons');
  const p = content.buildPost('thoughts', 'thoughts/x.md', '---\ncard: Postcard\nribbon: "  Big news!  "\nribbon_style: stamp\nribbon_colour: "#FF0080"\n---\nHi\n', 'Europe/London');
  eq([p.card, p.ribbon, p.ribbon_style, p.ribbon_colour], ['postcard', 'Big news!', 'stamp', '#ff0080'], 'read from the file');
  const q = content.buildPost('thoughts', 'thoughts/y.md', '---\ncard: wobbly\nribbon_style: nope\nribbon_colour: red\nribbon: "' + 'x'.repeat(80) + '"\n---\nHi\n', 'Europe/London');
  eq([q.card, q.ribbon.length, q.ribbon_style, q.ribbon_colour], ['', 40, 'banner', ''], 'odd values fall back');

  const at = (d) => d + ' 12:00';
  await putFile('thoughts/card-own.md', `---\ndate: ${at('2026-10-20')}\ntitle: Own card\ncard: postcard\nribbon: Big news!\nribbon_style: sticker\nribbon_colour: "#ffe14d"\n---\nHi.\n`);
  await putFile('thoughts/card-theme.md', `---\ndate: ${at('2026-10-19')}\ntitle: Theme card\n---\nHi.\n`);
  await putFile('thoughts/card-halloween.md', `---\ndate: ${at('2025-10-31')}\ntitle: Spooky\n---\nBoo.\n`);
  await putFile('thoughts/card-ourday.md', `---\ndate: ${at('2026-06-01')}\ntitle: Cake\n---\nYum.\n`);
  await putFile('theme.md', '---\ntheme: bunny\ncard_style: polaroid\ncard_corner: season\nfestivals: ["halloween"]\nmy_days: [{"name": "Our day", "from": "06-01", "to": "06-01", "what": "🎂"}]\n---\n');
  const cardOf = (pg, title) => pg.locator('.feed > .card', { hasText: title });
  await siteAt(async (pg) => {
    await pg.goto(BASE + '/#/thoughts');
    await pg.waitForSelector('.feed > .card');
    eq(await cardOf(pg, 'Theme card').getAttribute('data-card'), 'polaroid', 'the theme’s design on every post');
    eq(await cardOf(pg, 'Own card').getAttribute('data-card'), 'postcard', 'a post’s own design wins');
    const rb = cardOf(pg, 'Own card').locator('.card-ribbon.rb-sticker');
    eq(await rb.innerText(), 'BIG NEWS!', 'its ribbon');
    eq(await rb.evaluate((e) => e.style.getPropertyValue('--rb-text')), '#2a2a2a', 'dark words on a light ribbon');
    eq(await cardOf(pg, 'Theme card').locator('.card-ribbon').count(), 0, 'no ribbon unless you write one');
    const halloween = cardOf(pg, 'Spooky').locator('.card-festive');
    assert((await halloween.innerText()).includes('Halloween'), 'a post written on a ticked festive day gets its ribbon');
    assert((await cardOf(pg, 'Cake').locator('.card-festive').innerText()).includes('Our day'), 'and one written on your own day');
    eq(await cardOf(pg, 'Theme card').locator('.card-festive').count(), 0, 'an ordinary day doesn’t');
    eq(await cardOf(pg, 'Spooky').locator('.card-head .card-corner').getAttribute('aria-label'), 'Written in autumn', 'the season it was written in, by the date');
    eq(await cardOf(pg, 'Cake').locator('.card-corner').getAttribute('aria-label'), 'Written in summer', 'summer for June');
    eq(await cardOf(pg, 'Theme card').evaluate((e) => getComputedStyle(e, '::after').content), '"19 Oct 2026"', 'a Polaroid writes its day along the bottom');
  }, { desktop: false, reducedMotion: 'reduce' });
  // Off, none, and posts as a list with lines stay plain.
  await putFile('theme.md', '---\ntheme: bunny\ncard_style: neon\ncard_festive: off\nposts: lines\nfestivals: ["halloween"]\n---\n');
  await siteAt(async (pg) => {
    await pg.goto(BASE + '/#/thoughts');
    await pg.waitForSelector('.feed > .card');
    eq(await pg.locator('.card-festive').count(), 0, 'festive ribbons off');
    eq(await pg.locator('.card-corner').count(), 0, 'no corner mark');
    eq(await cardOf(pg, 'Theme card').evaluate((e) => getComputedStyle(e).boxShadow), 'none', 'as a list, posts stay plain');
  }, { desktop: false, reducedMotion: 'reduce' });
  // Every design draws (light and dark) without a hitch.
  for (const style of Object.keys((await import('../public/js/skins.js')).OPTIONS.card_style.choices)) {
    await putFile('theme.md', `---\ntheme: classic\ncard_style: ${style}\n---\n`);
    await siteAt(async (pg) => {
      await pg.goto(BASE + '/#/thoughts');
      await pg.waitForSelector('.feed > .card');
      eq(await cardOf(pg, 'Theme card').getAttribute('data-card'), style === 'classic' ? null : style, style);
    }, { desktop: true, reducedMotion: 'reduce' });
  }
  // Chosen in the editor: a post's own design and ribbon are saved in its file.
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  const page = await adminPage();
  await newPost(page, 'Thought');
  await page.locator('textarea').first().fill('Dressed up.');
  await page.locator('.dress-pick', { hasText: 'Comic panel' }).click();
  await page.getByRole('textbox', { name: 'Ribbon words' }).fill('Hot take');
  await page.locator('.dress .chip-btn', { hasText: 'Neon sign' }).click();
  eq(await page.locator('.dress-ribbon .card-ribbon.rb-neon').innerText(), 'Hot take', 'previewed as you type');
  await page.locator('button', { hasText: /^Publish/ }).first().click();
  await page.waitForFunction(() => document.querySelector('.toast:not([hidden])'));
  const saved = (await publicData()).posts.find((x) => x.ribbon === 'Hot take');
  eq([saved?.card, saved?.ribbon_style], ['comic', 'neon'], 'saved with the post');
  // And for every post, in Themes.
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-own');
  if (!(await page.locator('.tm-own').evaluate((e) => e.open))) await page.locator('.tm-own summary').click();
  await page.locator('.tm-tab', { hasText: 'Post cards' }).click();
  await page.locator('.tm-tabpanel .dress-pick', { hasText: 'Scrapbook' }).click();
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => !document.querySelector('.tm-savebar.unsaved'));
  eq((await publicData()).theme.card_style, 'scrapbook', 'every post’s card, saved');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('post cards of your own: made from parts in Themes, for every post or one, checked by the server', async () => {
  const content = await import('../src/content.js');
  const { cleanCards } = await import('../public/js/card-parts.js');
  // Only what a card can be.
  const odd = cleanCards([{ id: 'c1', name: '<b>Mine</b>', paper: 'red', texture: 'velvet', edge: 'glow', font: 'comic', ink: '#ABCDEF' }, { id: 'c1' }, { id: 'x9' }, { id: 'c13' }], ['comic']);
  eq(odd.map((c) => [c.id, c.name, c.paper, c.texture, c.edge, c.font, c.ink]), [['c1', 'bMine/b', '#ffffff', 'plain', 'glow', 'comic', '#abcdef']], 'checked');
  const parsed = content.parseTheme('---\ntheme: classic\ncard_style: c1\ncards: [{"id": "c1", "name": "Mine", "deco": "pin"}]\n---\n');
  eq([parsed.card_style, parsed.cards[0].deco], ['c1', 'pin'], 'the server keeps them');
  eq(content.parseTheme('---\ntheme: classic\ncard_style: c4\n---\n').card_style, undefined, 'not one that isn’t there');
  eq(content.buildPost('thoughts', 'thoughts/x.md', '---\ncard: c2\n---\nHi\n', 'Europe/London').card, 'c2', 'a post can wear one');
  const { tidyFeed } = await import('../src/friends.js');
  const fromFriend = tidyFeed({ posts: [{ id: 'thoughts/a', type: 'thoughts', ts: 1, full: { card: 'c1' } }] }, { url: 'https://pal.example', key: 'pal.example', name: 'Pal' });
  eq(fromFriend.posts[0].full.card, 'c1', 'a friend’s own card is kept, to be drawn from their cards (see the friends tests)');
  // Made in the card maker.
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  await putFile('thoughts/maker-post.md', `---\ndate: 2026-10-20 12:00\ntitle: Maker post\n---\nHi.\n`);
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-own');
  if (!(await page.locator('.tm-own').evaluate((e) => e.open))) await page.locator('.tm-own summary').click();
  await page.locator('.tm-tab', { hasText: 'Post cards' }).click();
  await page.locator('button', { hasText: '+ Make a card' }).click();
  await page.getByRole('textbox', { name: 'Name of this card' }).fill('Sunday paper');
  for (const [part, choice] of [['Paper', 'Grid'], ['Edge', 'Airmail stripes'], ['On top', 'A wax seal'], ['Heading', 'Solid colour']]) await page.getByRole('radiogroup', { name: part }).getByRole('radio', { name: choice }).click();
  await page.getByLabel('Paper colour').fill('#fff3d1');
  // (The preview shows it as you go.)
  eq(await page.locator('.card-maker-preview .card').evaluate((e) => getComputedStyle(e).borderTopWidth), '7px', 'previewed: the airmail edge');
  await page.locator('button', { hasText: 'Add this card' }).click();
  assert(await page.locator('.dress-pick', { hasText: 'Sunday paper' }).count(), 'among the cards to choose');
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => !document.querySelector('.tm-savebar.unsaved'));
  const theme = (await publicData()).theme;
  eq([theme.card_style, theme.cards.map((c) => [c.id, c.name, c.texture, c.edge, c.deco, c.head, c.paper])], ['c1', [['c1', 'Sunday paper', 'grid', 'stripes', 'seal', 'solid', '#fff3d1']]], 'saved, and on every post');
  // And for one post.
  await newPost(page, 'Thought');
  assert(await page.locator('.dress-pick', { hasText: 'Sunday paper' }).count(), 'offered for a single post too');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await siteAt(async (pg) => {
    await pg.goto(BASE + '/#/thoughts');
    const card = pg.locator('.feed > .card', { hasText: 'Maker post' });
    await card.waitFor();
    eq(await card.getAttribute('data-card'), 'c1', 'wearing it');
    eq(await card.evaluate((e) => getComputedStyle(e).borderTopWidth), '7px', 'drawn from its parts');
    eq(await card.evaluate((e) => getComputedStyle(e, '::after').borderRadius.length > 0), true, 'with its seal');
  }, { desktop: false, reducedMotion: 'reduce' });
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('the four seasons: a theme for each, with its own wallpaper and scenery, and one that follows the year', async () => {
  const skins = await import('../public/js/skins.js');
  const content = await import('../src/content.js');
  const group = skins.SKIN_GROUPS.find(([name]) => name === 'The four seasons')[1];
  eq(group, ['seasonal', 'wintry', 'springtime', 'summery', 'autumnal'], 'five of them');
  const own = { wintry: ['frost', 'winter', 'snow'], springtime: ['blossoms', 'spring', 'petals'], summery: ['seaside', 'summer', 'sunshine'], autumnal: ['harvest', 'autumn', 'leaves'] };
  for (const [id, [wall, season, falling]] of Object.entries(own)) {
    const t = skins.resolveSkin({ theme: id });
    eq([t.wallpaper, t.seasons, t.falling], [wall, season, falling], `${id}: its wallpaper, its season settling on everything, and what falls`);
    assert(skins.wallpaperCss(t).length > 1000, `${id}: a wallpaper of its own`);
    eq(content.parseTheme(`---\ntheme: ${id}\n---\n`).theme, id, `${id}: the server knows it`);
  }
  // Through the year: whichever season it is (the other way round south of the equator).
  eq(['2027-01-10', '2027-04-10', '2027-07-10', '2027-10-10'].map((d) => skins.seasonalSkin(false, new Date(d)).wallpaper), ['frost', 'blossoms', 'seaside', 'harvest'], 'each season in turn');
  eq(skins.seasonalSkin(true, new Date('2027-01-10')).wallpaper, 'seaside', 'south of the equator, January is summer');
  const now = skins.seasonOf(new Date());
  eq([skins.resolveSkin({ theme: 'seasonal' }).wallpaper, skins.resolveSkin({ theme: 'seasonal' }).seasons], [own[{ winter: 'wintry', spring: 'springtime', summer: 'summery', autumn: 'autumnal' }[now]][0], 'auto'], 'today’s, with the seasons on');
  eq(content.parseTheme('---\ntheme: seasonal\n---\n').theme, 'seasonal', 'the server knows it');
  // Picked in the back office, it's on the site with its season.
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-gbox');
  await page.locator('.tm-gbox summary', { hasText: 'The four seasons' }).click();
  await page.locator('.tm-card', { hasText: 'Winter Frost' }).click();
  await page.waitForFunction(() => document.querySelector('.tm-frame')?.contentDocument?.documentElement.dataset.skin === 'wintry', null, { timeout: 15000 });
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => !document.querySelector('.tm-savebar.unsaved'));
  eq((await publicData()).theme, { theme: 'wintry' }, 'saved');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await siteAt(async (p) => {
    eq(await p.evaluate(() => [document.documentElement.dataset.skin, document.documentElement.dataset.season]), ['wintry', 'winter'], 'snow settles on the site');
  }, { reducedMotion: 'reduce' });
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('the profile header dresses for the season or festive day: bunting and stickers, quiet days quietly', async () => {
  const look = (p) => p.evaluate(() => {
    const tile = [...document.querySelectorAll('.feed > .profile-tile')].find((x) => x.offsetParent);
    const shown = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
    const stickers = [...(tile.querySelectorAll('.pd-sticker') || [])].filter(shown);
    const box = tile.getBoundingClientRect();
    return { bunting: shown(tile.querySelector('.pd-bunting')), stickers: stickers.length, inside: stickers.every((s) => { const r = s.getBoundingClientRect(); return r.right <= box.right + 4 && r.left >= box.left; }), label: tile.querySelector('.pd-stickers')?.getAttribute('aria-label') || '' };
  });
  const cases = [
    ['seasons: christmas', { bunting: true, stickers: 3, inside: true, label: 'Christmas' }, 'a festive day: bunting and three of its drawings'],
    ['seasons: autumn', { bunting: true, stickers: 3, inside: true, label: 'Autumn' }, 'a season too'],
    ['seasons: ramadan', { bunting: false, stickers: 1, inside: true, label: 'Ramadan' }, 'a quiet day: one small drawing, no bunting'],
    ['seasons: off', { bunting: false, stickers: 0, inside: true }, 'off: nothing'],
    ['seasons: winter\nlooks: {"winter": {"settle": ["bars", "posts"]}}', { bunting: false, stickers: 0, inside: true }, 'not where you’ve said it shouldn’t settle']
  ];
  for (const [settings, want, what] of cases) {
    await putFile('theme.md', `---\ntheme: classic\n${settings}\n---\n`);
    await siteAt(async (p) => {
      const got = await look(p);
      if (!want.label) delete got.label;
      eq(got, want, what);
    }, { desktop: false, reducedMotion: 'reduce' });
  }
  // A drawing put "on my profile picture" stays on the picture, bunting or not.
  for (const settings of ['seasons: autumn\nlooks: {"autumn": {"where": ["profile"]}}', 'seasons: off\nstickers: [{"what": "cloud", "where": "profile"}]']) {
    await putFile('theme.md', `---\ntheme: classic\n${settings}\n---\n`);
    await siteAt(async (p) => {
      const at = await p.evaluate(() => {
        const tile = [...document.querySelectorAll('.feed > .profile-tile')].find((x) => x.offsetParent);
        const pic = tile.querySelector('.avatar').getBoundingClientRect();
        const st = tile.querySelector('.stk-profile').getBoundingClientRect();
        return { overPicture: st.left < pic.right && st.right > pic.left - 20 && st.top < pic.bottom, position: getComputedStyle(tile.querySelector('.stk-profile')).position };
      });
      eq(at, { overPicture: true, position: 'absolute' }, 'on the profile picture: ' + settings.split('\n')[0]);
    }, { desktop: false, reducedMotion: 'reduce' });
  }
  // Drawings of your own stay where you put them, clear of the day's decorations.
  const overlap = (a, b) => a && b && a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
  const placed = async (pg) => pg.evaluate(() => {
    const box = (el) => el && (({ left, right, top, bottom, width }) => ({ left, right, top, bottom, width }))(el.getBoundingClientRect());
    const vis = (sel) => [...document.querySelectorAll(sel)].find((x) => x.getBoundingClientRect().width > 0);
    const tile = vis('.feed > .profile-tile');
    const title = vis('.xp-phone .xp-title');
    const letter = [...document.querySelectorAll('.feed > .card[data-card="letter"]')].find((x) => x.offsetParent);
    return {
      pic: box(tile.querySelector('.avatar')), cloud: box(tile.querySelector('.stk-profile')),
      star: box(title.querySelector('.stk-title')), bar: box(title.querySelector('.bar-decor')), buttons: box(title.querySelector('.xp-ctl')),
      corner: box(letter?.querySelector(':scope > .stk-cards')), seal: letter && (() => { const r = letter.getBoundingClientRect(); return { left: r.right - 52, right: r.right - 14, top: r.bottom - 44, bottom: r.bottom - 6 }; })()
    };
  });
  await putFile('thoughts/sealed.md', `---\ndate: ${new Date(Date.now() - 60e3).toISOString().slice(0, 16).replace('T', ' ')}\ntitle: Sealed\ncard: letter\n---\nHi.\n`);
  await putFile('theme.md', '---\ntheme: classic\nseasons: autumn\nstickers: [{"what": "cloud", "where": "profile"}, {"what": "star", "where": "title"}, {"what": "heart", "where": "cards"}]\n---\n');
  await siteAt(async (pg) => {
    const at = await placed(pg);
    assert(overlap(at.cloud, at.pic), 'on the profile picture: ' + JSON.stringify([at.cloud, at.pic]));
    assert(at.star && at.bar?.width > 0 && !overlap(at.star, at.bar) && !overlap(at.bar, at.buttons), 'title bar drawings side by side: ' + JSON.stringify([at.star, at.bar, at.buttons]));
    assert(at.corner && !overlap(at.corner, at.seal), 'the post-corner drawing clear of the wax seal');
  }, { desktop: false, reducedMotion: 'reduce' });
  await delFile('thoughts/sealed.md');
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('the apps’ top bars: bunting and stickers for the day, and each app can choose its own, random ones or none', async () => {
  const content = await import('../src/content.js');
  const skins = await import('../public/js/skins.js');
  eq(Object.keys(skins.BAR_APPS), ['windows', ...Object.keys(content.THEME_APPS)], 'the server knows the same apps');
  eq(content.parseTheme('---\ntheme: classic\nbar_decor: {"album": {"mode": "mine", "charms": ["santa", "🎂", "<b>", "star", "sun"]}, "tv": {"mode": "none"}, "music": {"mode": "random"}, "nope": {"mode": "none"}, "books": {"mode": "mine"}}\n---\n').bar_decor, { album: { mode: 'mine', charms: ['santa', '🎂', 'star'] }, tv: { mode: 'none' }, music: { mode: 'random' } }, 'checked by the server');
  const bars = (p) => p.evaluate(() => [...document.querySelectorAll('.bar-decor')].filter((d) => d.parentElement.offsetParent).map((d) => {
    const s = getComputedStyle(d);
    return { app: d.closest('[data-app]')?.dataset.app || '', shown: s.display !== 'none', stickers: s.backgroundImage.includes('svg') ? (decodeURIComponent(s.backgroundImage).match(/<g transform="rotate/g) || []).length : 0, bunting: s.backgroundImage.split('url("').length > 2 };
  }));
  const at = async (route, settings) => {
    await putFile('theme.md', `---\ntheme: classic\n${settings}\n---\n`);
    return siteAt(async (p) => {
      await p.goto(BASE + '/' + route);
      await p.waitForTimeout(900);
      return bars(p);
    }, { desktop: false, reducedMotion: 'reduce' });
  };
  // A festive day: bunting and three stickers on every app's bar.
  for (const route of ['#/thoughts', '#/album', '#/books', '#/journal']) {
    const [b] = await at(route, 'seasons: christmas');
    // (On a phone the windows' title bar has its stickers only: the menu under it has its garland.)
    eq([b?.shown, b?.stickers, b?.bunting], [true, 3, route !== '#/thoughts'], `${route}: dressed`);
  }
  eq((await at('#/album', 'seasons: ramadan'))[0].stickers, 1, 'a quiet day: one drawing');
  assert(!(await at('#/album', 'seasons: ramadan'))[0].bunting, 'and no bunting');
  eq((await at('#/album', 'seasons: off'))[0].shown, false, 'no day: nothing');
  // Each app its own way.
  const own = 'seasons: christmas\nbar_decor: {"album": {"mode": "mine", "charms": ["bunny", "🎂"]}, "tv": {"mode": "none"}, "music": {"mode": "random"}}';
  eq((await at('#/album', own))[0].stickers, 2, 'the album: your own two');
  eq((await at('#/tv', own))[0].shown, false, 'the TV: nothing');
  eq((await at('#/music', own))[0].stickers, 3, 'the record crate: three different ones');
  // Your own and random ones stay all year; the bunting only while a day is on.
  const off = 'seasons: off\nbar_decor: {"album": {"mode": "mine", "charms": ["bunny"]}}';
  const [alb] = await at('#/album', off);
  eq([alb.shown, alb.stickers, alb.bunting], [true, 1, false], 'your own, all year round');
  // Chosen in Themes.
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-own');
  if (!(await page.locator('.tm-own').evaluate((e) => e.open))) await page.locator('.tm-own summary').click();
  await page.locator('.tm-tab', { hasText: 'Seasons' }).click();
  await page.getByRole('radiogroup', { name: 'On the Cinema bar' }).getByRole('radio', { name: 'My own' }).click();
  await page.locator('.tm-bars .tm-pick[aria-label="Snowman"]').click();
  await page.getByRole('radiogroup', { name: 'On the TV bar' }).getByRole('radio', { name: 'Nothing' }).click();
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => !document.querySelector('.tm-savebar.unsaved'));
  eq((await publicData()).theme.bar_decor, { films: { mode: 'mine', charms: ['snowman'] }, tv: { mode: 'none' } }, 'saved');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('every wallpaper through the day: morning light, an evening glow and a starry night (always night in dark mode)', async () => {
  const at = (time, dark, settings = '') => siteAt(async (p) => p.evaluate(() => getComputedStyle(document.querySelector('.wall')).backgroundImage), { desktop: true, reducedMotion: 'reduce', time: new Date(time), ...(dark ? { dark: true } : {}) });
  for (const theme of ['bunny', 'neon', 'autumnal']) {
    await putFile('theme.md', `---\ntheme: ${theme}\nseasons: off\n---\n`);
    const day = await at('2026-10-28T13:00:00');
    const night = await at('2026-10-28T23:30:00');
    const morning = await at('2026-10-28T08:00:00');
    assert(day.includes('svg') && night.includes('svg'), `${theme}: its own wallpaper, day and night`);
    assert(/rgba\(10, 18, 66/.test(night) && !/rgba\(10, 18, 66/.test(day), `${theme}: night falls`);
    assert(/rgba\(255, 168, 108/.test(morning), `${theme}: morning light`);
  }
  // Your own picture too; and "stays the same all day" keeps the day.
  await putFile('theme.md', '---\ntheme: classic\nseasons: off\nwallpaper: emoji\nemoji: "🌸"\n---\n');
  assert(/rgba\(10, 18, 66/.test(await at('2026-10-28T23:30:00')), 'emoji wallpaper at night');
  await putFile('theme.md', '---\ntheme: bunny\nseasons: off\nwall_time: still\n---\n');
  assert(!/rgba\(10, 18, 66/.test(await at('2026-10-28T23:30:00')), 'kept as it is when you ask');
  eq((await import('../src/content.js')).parseTheme('---\ntheme: bunny\nwall_time: still\n---\n').wall_time, 'still', 'the server keeps it');
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('post cards mixed at random: each post keeps its own draw, a dressed post keeps its design, chosen in Themes', async () => {
  const content = await import('../src/content.js');
  const { mixPick, cleanMix } = await import('../public/js/card-parts.js');
  // Checked by the server.
  const parsed = content.parseTheme('---\ntheme: classic\ncard_style: mix\ncard_mix: ["polaroid", "nope", "c1", "c9"]\ncard_seed: 77\ncards: [{"id": "c1", "name": "Mine"}]\n---\n');
  eq([parsed.card_style, parsed.card_mix, parsed.card_seed], ['mix', ['polaroid', 'c1'], 77], 'only designs that are there');
  eq(content.parseTheme('---\ntheme: classic\ncard_seed: -4\n---\n').card_seed, undefined, 'a shuffle is a plain number');
  // The same post always draws the same design; another design in the mix only takes the posts it wins.
  const mix = ['polaroid', 'scrapbook', 'ticket', 'letter'];
  const keys = Array.from({ length: 200 }, (_, i) => `thoughts/p${i}`);
  const first = keys.map((k) => mixPick(k, mix, 5));
  eq(keys.map((k) => mixPick(k, mix, 5)), first, 'the same every time');
  eq(new Set(first).size, 4, 'every design gets posts');
  const more = keys.map((k) => mixPick(k, [...mix, 'neon'], 5));
  assert(more.every((d, i) => d === first[i] || d === 'neon'), 'adding a design only moves posts to it');
  assert(keys.filter((k, i) => mixPick(k, mix, 6) !== first[i]).length > 100, 'a shuffle deals them again');
  eq(cleanMix('polaroid, x, ticket', ['polaroid', 'ticket']), ['polaroid', 'ticket'], 'tidied');
  // In Themes: mixed, a few designs ticked out, and a shuffle.
  await putFile('theme.md', '---\ntheme: classic\n---\n');
  const ago = (m) => new Date(Date.now() - m * 60e3).toISOString().slice(0, 16).replace('T', ' ');
  for (let i = 0; i < 8; i++) await putFile(`thoughts/mix-${i}.md`, `---\ndate: ${ago(i + 1)}\ntitle: Mix post ${i}\n${i === 0 ? 'card: neon\n' : ''}---\nHi.\n`);
  const page = await adminPage();
  await page.locator('.admin-tabs button', { hasText: 'Themes' }).click();
  await page.waitForSelector('.tm-own');
  if (!(await page.locator('.tm-own').evaluate((e) => e.open))) await page.locator('.tm-own summary').click();
  await page.locator('.tm-tab', { hasText: 'Post cards' }).click();
  await page.getByRole('radiogroup', { name: 'How posts wear them' }).getByRole('radio', { name: 'Mixed at random' }).click();
  const inMix = page.getByRole('group', { name: 'Designs in the mix' });
  eq(await inMix.getByRole('checkbox', { checked: true }).count(), 13, 'every design but the plain one, to start');
  for (const name of ['Neon', '8-bit', 'Chrome glass', 'Comic panel', 'Film frame', 'Ticket', 'Torn page', 'Notebook', 'Sticky note', 'Postcard']) await inMix.getByRole('checkbox', { name }).click();
  eq(await inMix.getByRole('checkbox', { checked: true }).count(), 3, 'ticked out');
  await page.locator('button', { hasText: 'Shuffle' }).click();
  await page.locator('button', { hasText: 'Save the theme' }).click();
  await page.waitForFunction(() => !document.querySelector('.tm-savebar.unsaved'));
  const theme = (await publicData()).theme;
  eq([theme.card_style, theme.card_mix], ['mix', ['polaroid', 'scrapbook', 'letter']], 'saved');
  assert(theme.card_seed > 0, 'with the shuffle');
  // Dress this post says what a post drew.
  await newPost(page, 'Thought');
  assert((await page.locator('.dress-pick').first().innerText()).includes('mixed at random'), 'a new post: drawn once it’s saved');
  assert(!page.errors.length, page.errors.join('; '));
  await page.close();
  const want = (i) => (i === 0 ? 'neon' : mixPick(`thoughts/mix-${i}`, theme.card_mix, theme.card_seed));
  const seen = async () => siteAt(async (pg) => {
    await pg.goto(BASE + '/#/thoughts');
    await pg.locator('.feed > .card', { hasText: 'Mix post 7' }).first().waitFor();
    return pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('.feed > .card')].filter((c) => c.offsetParent).map((c) => [c.querySelector('.card-title')?.textContent.trim(), c.dataset.card])));
  }, { desktop: false, reducedMotion: 'reduce' });
  const once = await seen();
  eq(Array.from({ length: 8 }, (_, i) => once[`Mix post ${i}`]), Array.from({ length: 8 }, (_, i) => want(i)), 'each post wears its draw, and a dressed post its own');
  assert(new Set(Object.values(once)).size > 2, 'a mix');
  eq(await seen(), once, 'and the same next time');
  for (let i = 0; i < 8; i++) await delFile(`thoughts/mix-${i}.md`);
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

await test('seasons and festive days settle on every card design, your own too', async () => {
  await putFile('theme.md', '---\ntheme: classic\nseasons: winter\ncard_style: mix\ncards: [{"id": "c1", "name": "Mine", "edge": "stripes", "deco": "tape"}]\n---\n');
  // (The earlier tests' posts go, so all of these fit on the first page. This is the group's last test.)
  for (const f of (await overview()).files) if (/^(thoughts|photos|lists|quotes)\/[^/]+\.md$/.test(f.key)) await delFile(f.key);
  const designs = ['classic', 'polaroid', 'scrapbook', 'notebook', 'postcard', 'sticky', 'ticket', 'torn', 'comic', 'neon', 'letter', 'film', 'pixel', 'chrome', 'c1'];
  for (const [i, d] of designs.entries()) await putFile(`thoughts/season-${String(i).padStart(2, '0')}.md`, `---\ndate: ${new Date(Date.now() - i * 60e3).toISOString().slice(0, 16).replace('T', ' ')}\ntitle: Season ${d}\ncard: ${d}\n---\nHi.\n`);
  const look = (pg) => pg.evaluate(() => [...document.querySelectorAll('.feed > .card')].filter((c) => c.offsetParent && c.querySelector('.card-title')?.textContent.startsWith('Season')).map((c) => {
    const snow = c.querySelector(':scope > .card-snow');
    const s = snow && getComputedStyle(snow);
    const pic = c.querySelector(':scope > .card-head > .card-season');
    const p = pic && getComputedStyle(pic);
    const box = c.getBoundingClientRect();
    const sb = snow?.getBoundingClientRect();
    return { card: c.dataset.card || 'classic', snow: !!s && s.display === 'block' && s.backgroundImage.includes('svg') && Math.abs(sb.top - box.top) < 9 && sb.width > box.width * 0.8, pic: !!p && p.display === 'block' && p.backgroundImage !== 'none' && pic.getBoundingClientRect().width > 10 };
  }));
  await siteAt(async (pg) => {
    await pg.goto(BASE + '/#/thoughts');
    await pg.locator('.feed > .card', { hasText: 'Season c1' }).first().waitFor();
    const winter = await look(pg);
    eq(winter.map((c) => c.card), designs, 'every design');
    eq(winter.filter((c) => !c.snow).map((c) => c.card), [], 'winter: snow along the top of each');
  }, { desktop: false, reducedMotion: 'reduce' });
  await putFile('theme.md', '---\ntheme: classic\nseasons: christmas\ncards: [{"id": "c1", "name": "Mine", "edge": "stripes", "deco": "stamp"}]\n---\n');
  await siteAt(async (pg) => {
    await pg.goto(BASE + '/#/thoughts');
    await pg.locator('.feed > .card', { hasText: 'Season c1' }).first().waitFor();
    const festive = await look(pg);
    assert(festive.filter((c) => c.pic).length >= 6, 'a festive day: its drawing by the date, every other card: ' + JSON.stringify(festive));
    eq(festive.filter((c) => c.snow).length, 0, 'and no winter snow');
  }, { desktop: false, reducedMotion: 'reduce' });
  for (let i = 0; i < designs.length; i++) await delFile(`thoughts/season-${String(i).padStart(2, '0')}.md`);
  await putFile('theme.md', '---\ntheme: classic\n---\n');
});

const failed = report();
await close();
process.exit(failed ? 1 : 0);
