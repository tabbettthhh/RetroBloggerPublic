# The theme kit

One way to make a computer theme, so every app takes it on by itself.

A computer theme dresses the whole site: the desktop, the taskbar, every app's window, and what's inside every app (the journal, the album, the atlas, the shelves, the guestbook…). You don't style apps one by one. You fill in one list of values, and the kit does the rest.

## The three pieces

| File | What it is | Changes when… |
| --- | --- | --- |
| `public/css/kits.css` | One block of values per theme. | You add or change a theme. |
| `public/css/kit.css` | Maps every app onto those values. | A new app is added (add its classes once). |
| `public/css/machine.css` + `public/js/machine.js` | The hardware around the screen (case, speakers, knobs) and the phones. | Only if a theme needs a case or a phone of its own. |

A theme also needs a name in two places: the **Computer** choice (`machine` in `OPTIONS`, `public/js/skins.js`, and `THEME_OPTIONS`, `src/content.js`), and usually a matching theme in `SKINS` (colours, fonts, wallpaper) in the **Old computers** group.

## Adding a theme, step by step

1. **Pick a short id**, like `amber`. Add it to `machine` in `skins.js` (`OPTIONS.machine.choices`) and in `content.js` (`THEME_OPTIONS.machine`).
2. **Copy a block in `kits.css`** that's closest in feel (dark or light), rename it to `:root[data-sk-machine="amber"]`, and change the values (the list is below). Every value must be filled in.
3. **Check the words can be read**: `--k-ink` on `--k-page`, `--k-surface-ink` on `--k-surface`, `--k-surface-2-ink` on `--k-surface-2`, `--k-ctl-ink` on `--k-ctl-bg`, `--k-bar-ink` on `--k-bar-bg`. At least 4.5 to 1.
4. **Extras, if any**: anything the values can't say goes just under the theme's block in `kits.css` (a round start button, a prompt before headings). Keep it short.
5. **A case, if it has one** (speakers, a bezel, knobs): add the id to `CASES` and a `caseFor` branch in `machine.js`, and its case styles in `machine.css`. Things drawn inside the screen go in `insideFor`.
6. **A matching theme** in `SKINS` (`skins.js`), with `machine: 'amber'`, added to the **Old computers** group, to `THEMES` in `content.js`, and to the README.
7. **Bump the version** (`src/version.js`), and run the `themes` tests.

## The values

Every value starts `--k-`. Borders and edges are a whole `border` value (like `2px solid #000`, or `2px outset #ddd` for a bevel). Fonts are font-family lists, except the `*-font` values marked "font", which are whole `font` values (like `700 13px 'Arimo', sans-serif`).

### Inside every app

| Value | What it paints |
| --- | --- |
| `font`, `head-font`, `hand-font`, `mono-font` | Body words; headings; what was handwriting; code-like bits. |
| `zoom` | Optional: makes everything inside a little bigger (for narrow fonts). |
| `page`, `ink`, `ink-soft`, `head-ink`, `link` | The background each app is drawn on; its words; quiet words; headings; plain links. |
| `surface`, `surface-ink` | Sheets, cards, panels, pages of the journal, the album's pages. |
| `surface-2`, `surface-2-ink` | Their headers and insets (a card's top line, a list's header). |
| `edge`, `radius`, `shadow` | The sheets' border, corners and shadow. |
| `ctl-bg`, `ctl-ink`, `ctl-edge`, `ctl-radius` | Buttons, tabs and chips. |
| `ctl-on-bg`, `ctl-on-ink` | The one that's chosen. |
| `field-bg`, `field-ink`, `field-edge` | Boxes you type in. |

### Windows

| Value | What it paints |
| --- | --- |
| `win-bg`, `win-edge`, `win-radius`, `win-pad`, `win-shadow` | The window's frame. Optional: `win-outline`, `win-blur` (for glass). |
| `bar-bg`, `bar-ink`, `bar-font` (font), `bar-h` | The title bar. Optional: `bar-off-bg`, `bar-off-ink` (a window not in front), `bar-glow`, `bar-gap`, `bar-icon` (`none` hides the little icon). |
| `wbtn-bg`, `wbtn-edge`, `wbtn-w`, `wbtn-h`, `wbtn-radius`, `glyph` | Minimise, maximise and close. Optional: `close-bg`, `close-glyph`, `close-w`, `close-order` (`-1` puts close first), `glyphs` (`none` for plain dots). |
| `body-edge` | Optional: a line around what's inside. |

### The desktop

| Value | What it paints |
| --- | --- |
| `taskbar-bg`, `taskbar-edge` | The taskbar. Optional: `taskbar-h`. |
| `task-bg`, `task-ink`, `task-edge`, `task-radius`, `task-font` (font) | The Explore button and each window's button. Optional: `task-margin`, `start-bg`, `start-ink` (Explore alone). |
| `task-on-bg`, `task-on-ink` | The button of the window in front. Optional: `task-on-edge`. |
| `tray-bg`, `tray-ink` | The clock corner. Optional: `tray-edge`. |
| `label-ink`, `label-font` (font) | The desktop icons' names. Optional: `label-bg`, `label-shadow`, `label-pad`. |

## Rules every theme keeps

- **Everything drawn for the site**: no real brands, logos, product names or characters, in the drawings or the words.
- **Readable**: the contrast pairs in step 3.
- **Gentle on motion**: anything that moves stops under `prefers-reduced-motion`.
- **Keepsakes keep their own look** (receipts, tickets, stamps, polaroids, post cards with a design of their own, the neighbourhood). The kit leaves them alone on purpose.
- **Nothing private**: a theme only shows what the page already shows that visitor.

## Adding an app

When a new app arrives, add its classes once to the lists in `kit.css`: its big background to the **page** list, its sheets and cards to the **surface** list, its header strips to the **surface-2** list, and its buttons to the **controls** list. Every theme then dresses it.
