// Turns the Markdown files in your R2 bucket into the data the site displays.
// Nothing here is specific to a design: any future template can reuse it.

import YAML from 'yaml';
import { cleanFloppy } from '../public/js/floppy-look.js';
import { cleanCards, OWN_CARD, MIX, cleanMix, cleanSeed } from '../public/js/card-parts.js';
import { marked } from 'marked';

export const TYPES = ['thoughts', 'places', 'photos', 'lists', 'quotes', 'books', 'films', 'podcasts', 'music', 'tv'];
export const SHELF_TYPES = ['books', 'films', 'podcasts', 'music', 'tv'];

// Where a book, film or podcast is: now (reading, watching, listening), done, want (to read…)
// or dropped. Files can use everyday words; these are what they mean.
const STATE_WORDS = {
  now: ['reading', 'currently-reading', 'watching', 'listening', 'now', 'current', 'in progress', 'repeat', 'on repeat'],
  done: ['read', 'finished', 'done', 'watched', 'listened', 'heard', 'seen', 'completed'],
  want: ['want', 'to-read', 'to read', 'want to read', 'to-watch', 'watchlist', 'want to watch', 'to-listen', 'want to listen', 'want to hear', 'later'],
  dropped: ['dropped', 'abandoned', 'dnf', 'did-not-finish', 'did not finish', 'gave up', 'skipped']
};
export function shelfState(status) {
  const s = String(status ?? '').trim().toLowerCase();
  if (!s) return 'done';
  for (const [state, words] of Object.entries(STATE_WORDS)) if (words.includes(s)) return state;
  return 'done';
}

marked.setOptions({ gfm: true, breaks: false });

// Markdown nested absurdly deep (hundreds of quote or list levels, which nobody writes on
// purpose) can stall or crash the Markdown reader, and with it the whole site. Such text, or
// anything else the reader chokes on, is shown as plain text instead.
const escapeHtml = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function safeMarkdown(md) {
  const text = String(md || '');
  let deep = false;
  for (const line of text.split('\n')) {
    const lead = /^[ \t>]*/.exec(line)[0];
    if ((lead.match(/>/g) || []).length > 30 || lead.replace(/>/g, '').replace(/\t/g, '    ').length > 160) {
      deep = true;
      break;
    }
  }
  if (!deep) {
    try {
      return marked.parse(text);
    } catch {}
  }
  return `<pre class="plain-text">${escapeHtml(text)}</pre>`;
}

// Split "---\nfront matter\n---\nbody" into its two parts.
export function splitFrontMatter(text) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text };
  let data = {};
  try {
    data = YAML.parse(m[1]) || {};
  } catch (e) {
    data = { _error: 'The header has a mistake. ' + yamlProblem(e) };
  }
  if (typeof data !== 'object' || Array.isArray(data)) data = {};
  return { data, body: m[2] };
}

// A YAML error in plain words, with the line in the file where it is.
function yamlProblem(e) {
  // The header starts on the file's second line.
  const line = e?.linePos?.[0]?.line;
  const msg = String(e?.message || e).split('\n')[0].replace(/ at line \d+, column \d+:?$/, '');
  const what = /nested mappings|mapping values/i.test(msg)
    ? 'there is a colon (:) inside a value'
    : /missing closing/i.test(msg)
      ? 'a quote mark is opened but not closed'
      : /unique/i.test(msg)
        ? 'the same name is used twice'
        : /tab/i.test(msg)
          ? 'there is a tab; use spaces instead'
          : /implicit (map )?keys/i.test(msg)
            ? "a line doesn't look like name: value"
            : msg;
  return `${line ? `Line ${line + 1}` : 'The header'}: ${what}.`;
}

// What's wrong with a file's header, in plain words, or null if it reads fine. Used to refuse
// a save that would hide a post from the site.
export function headerProblem(text) {
  // Found exactly the way the site finds it (see splitFrontMatter).
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/.exec(String(text || ''));
  if (!m) return null;
  try {
    const data = YAML.parse(m[1]);
    if (data != null && (typeof data !== 'object' || Array.isArray(data))) return 'The header should be "name: value" lines.';
    return null;
  } catch (e) {
    return yamlProblem(e);
  }
}

// Minutes the given time zone is ahead of UTC at a moment (handles summer time).
function zoneOffset(ts, timeZone) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = Object.fromEntries(dtf.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
    return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ts) / 60000;
  } catch {
    return 0;
  }
}

// Accepts "2026-10-22", "2026-10-22 16:08", "2026-10-22T16:08+01:00".
// Times written without an offset are read as local time in the site's time zone.
export function parseDate(value, timeZone = 'UTC') {
  if (value == null) return NaN;
  const s = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(s);
  if (!m) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? NaN : t;
  }
  const [, y, mo, d, h = '0', mi = '0', se = '0', zone] = m;
  let t = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
  if (zone && zone !== 'Z') {
    const sign = zone[0] === '-' ? -1 : 1;
    const digits = zone.slice(1).replace(':', '');
    t -= sign * (+digits.slice(0, 2) * 60 + +digits.slice(2, 4)) * 60000;
  } else if (!zone && timeZone && timeZone !== 'UTC') {
    const first = t - zoneOffset(t, timeZone) * 60000;
    t = t - zoneOffset(first, timeZone) * 60000;
  }
  return t;
}

const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

function mediaUrl(type, slug, p) {
  const s = String(p).trim();
  if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s;
  return `/media/${type}/${slug}/${encodeURIComponent(s)}`;
}

function plainExcerpt(md, n = 160) {
  const t = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

// The fields a post may carry. Anything else in the header is kept under `extra`.
const KNOWN = new Set([
  'date', 'title', 'draft', 'font', 'photos', 'area', 'city', 'country', 'country_code', 'lat', 'lon',
  'category', 'rating', 'would_return', 'weather', 'source', 'caption', 'captions', 'stamp',
  'author', 'director', 'host', 'episode', 'year', 'status', 'recommend', 'quote', 'rewatch', 'suggested_by', 'artist', 'album', 'format', 'pinned', 'creator', 'season', 'network', 'episodes', 'pages', 'page', 'reading_log', 'floppy', 'floppy_journal', 'ordered', 'bought', 'tickets', 'rides', 'gallery', 'theatre', 'invite', 'boarding', 'cinema', 'cloakroom', 'wristband', 'postcard', 'fortune', 'luggage', 'matchbook', 'coaster', 'roomkey', 'flower', 'postcard_scene', 'pitch', 'trailmap', 'parkpass', 'patch', 'summit', 'signpost', 'leaf', 'marshmallow', 'tides', 'compass', 'bookmark', 'librarycard', 'bookplate', 'note', 'popcorn', 'glasses3d', 'rental', 'tvguide', 'remote', 'headphones', 'gig', 'pick', 'setlist', 'busticket', 'coffeering', 'signature', 'bookclub', 'dogear', 'stubpair', 'programme', 'picknmix', 'drivein', 'tally', 'takeaway', 'nospoil', 'battery', 'jcard', 'walkmap', 'napkin', 'vinyllabel', 'mixtape', 'backstage', 'lighter', 'sky', 'diary', 'moodring', 'doodle', 'cootie', 'forecast', 'lyric', 'handstamp', 'glowstick', 'racebib', 'ceremony', 'confetti', 'balloon', 'matchday', 'funfair', 'rosette', 'namebadge', 'sparkler', 'flyer', 'tourtee', 'earplugs', 'drumstick', 'buttonbadge', 'seatplan', 'lozenge', 'masks', 'stageprog', 'comedyticket', 'mic', 'interval', 'operaglasses', 'curtain', 'laughmeter', 'joke', 'custom_keepsakes', 'memory', 'negatives', 'oldprint', 'calendar', 'vhstape', 'envelope', 'thennow', 'rewind', 'skysunrise', 'skygolden', 'skyrainbow', 'skystorm', 'skysnow', 'skystars', 'skymoon', 'skyaurora', 'skyclouds', 'skyfog', 'skyplane', 'skypink', 'workout', 'gympass', 'personalbest', 'dumbbell', 'steps', 'shaker', 'heartrate', 'setsheet', 'medal', 'waterbottle', 'alarmclock', 'riseshine', 'firstcoffee', 'lunchbreak', 'teatime', 'nightowl', 'sleepmask', 'ledclock', 'discaward', 'trophy', 'chartno1', 'winnercard', 'goldmic', 'autograph', 'fanclub', 'jukebox', 'radiorequest', 'magreview', 'yearonrepeat', 'sevenninch', 'profile', 'grid_photo', 'flashcard', 'highlighter', 'pagetabs', 'timetable', 'examslip', 'pomodoro', 'desklamp', 'librarypass', 'grade', 'casecard', 'mindmap', 'revisionlist', 'pencil', 'calculator', 'gradcap', 'diploma', 'stopwatch', 'lecturenotes', 'doordnd', 'readinglist', 'idbadge', 'timecard', 'meetinginvite', 'outofoffice', 'businesscard', 'inboxzero', 'laptop', 'briefcase', 'deskplate', 'stapler', 'paperclips', 'memo', 'wfh', 'tgif', 'deadline', 'employeemonth', 'card', 'ribbon', 'ribbon_style', 'ribbon_colour']);

export function buildPost(type, key, text, tz) {
  const { data, body } = splitFrontMatter(text);
  const file = key.split('/').pop();
  const slug = file.replace(/\.md$/i, '');
  const date = data.date != null ? String(data.date) : (slug.match(/^\d{4}-\d{2}-\d{2}/) || [''])[0];
  const ts = parseDate(date, tz);
  const extra = {};
  for (const [k, v] of Object.entries(data)) if (!KNOWN.has(k) && !k.startsWith('_')) extra[k] = v;

  let city = data.city != null ? String(data.city) : '';
  if (!city && data.area) {
    const parts = String(data.area).split(',').map((s) => s.trim()).filter(Boolean);
    city = parts[parts.length - 1] || '';
  }
  const num = (v) => (v == null || v === '' || Number.isNaN(+v) ? null : +v);

  return {
    type,
    slug,
    key,
    date,
    ts: Number.isNaN(ts) ? 0 : ts,
    title: data.title != null ? String(data.title) : '',
    draft: data.draft === true,
    // Pinned posts sit at the top of the feed and their section.
    pinned: data.pinned === true,
    // How its card is dressed (one of the card designs; empty: the theme's), and a ribbon of its
    // own: a few words, in one of the ribbon styles, in a colour of its own (or the theme's).
    card: THEME_OPTIONS.card_style.includes(String(data.card ?? '').trim().toLowerCase()) || OWN_CARD.test(String(data.card ?? '').trim()) ? String(data.card).trim().toLowerCase() : '',
    ribbon: data.ribbon != null ? String(data.ribbon).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 40) : '',
    ribbon_style: RIBBON_STYLES.includes(String(data.ribbon_style ?? '').trim().toLowerCase()) ? String(data.ribbon_style).trim().toLowerCase() : 'banner',
    ribbon_colour: /^#[0-9a-f]{6}$/i.test(String(data.ribbon_colour ?? '').trim()) ? String(data.ribbon_colour).trim().toLowerCase() : '',
    // Its own font (one of the theme fonts); empty: the site's font from the theme.
    font: THEME_OPTIONS.font.includes(String(data.font ?? '').trim().toLowerCase()) ? String(data.font).trim().toLowerCase() : '',
    // On the profile grid (the About page): only shows for a post with photos.
    profile: data.profile === true,
    // Which of its photos is the thumbnail on the grid (`grid_photo: 3.jpg`); the first if not set.
    grid_cover: Math.max(0, toArray(data.photos).map(String).indexOf(String(data.grid_photo ?? ''))),
    photos: toArray(data.photos).map((p) => mediaUrl(type, slug, p)),
    captions: toArray(data.captions).map((c) => (c == null ? '' : String(c))),
    area: data.area != null ? String(data.area) : '',
    city,
    country: data.country != null ? String(data.country) : '',
    country_code: data.country_code != null ? String(data.country_code).toUpperCase() : '',
    lat: num(data.lat),
    lon: num(data.lon),
    category: data.category != null ? String(data.category).toLowerCase() : '',
    rating: num(data.rating),
    would_return: data.would_return === true,
    weather: data.weather != null ? String(data.weather) : '',
    source: data.source != null ? String(data.source) : '',
    // A passport stamp picked by hand: a country code (e.g. "de") or a design name (e.g. "postmark").
    stamp: /^[a-z0-9-]{1,20}$/i.test(String(data.stamp ?? '')) ? String(data.stamp).toLowerCase() : '',
    // Books, films and podcasts
    creator: String(data.author ?? data.director ?? data.host ?? data.artist ?? data.creator ?? ''),
    // TV: which season, and where it was on (a channel or streaming service)
    season: data.season != null ? String(data.season) : '',
    network: data.network != null ? String(data.network) : '',
    // Music: an album or a single song (and the album it's from)
    format: type === 'music' ? (/^(song|single|track)$/i.test(String(data.format ?? '')) ? 'song' : 'album') : '',
    album: data.album != null ? String(data.album) : '',
    episode: data.episode != null ? String(data.episode) : '',
    // TV: a diary of single episodes, each with its own stars and note
    episodes: type === 'tv' ? parseEpisodes(data.episodes) : [],
    // What Floppy, the site's little helper, should say about this post (optional).
    // One line, or a list he picks from at random (screensaver and search).
    floppy: floppyList(data.floppy),
    // Places: what Floppy says in the journal margin, kept apart from the above.
    floppy_journal: floppyList(data.floppy_journal),
    // What you ordered, for a till receipt (any post: keepsakes are one shared pool)
    ordered: parseOrdered(data.ordered),
    // Places: other keepsakes for the journal. What you bought (a shop receipt), and entry or
    // travel tickets: `true` for a plain one, or lines like "Adult — €14".
    bought: parseOrdered(data.bought),
    tickets: keepsake(data.tickets),
    rides: keepsake(data.rides),
    gallery: keepsake(data.gallery),
    theatre: keepsake(data.theatre),
    invite: keepsake(data.invite),
    boarding: keepsake(data.boarding),
    cinema: keepsake(data.cinema),
    cloakroom: keepsake(data.cloakroom),
    wristband: keepsake(data.wristband),
    postcard: keepsake(data.postcard),
    // The postcard's front: your photo (left out) or a painted scene.
    postcard_scene: data.postcard_scene ? String(data.postcard_scene).toLowerCase() : '',
    fortune: keepsake(data.fortune),
    luggage: keepsake(data.luggage),
    matchbook: keepsake(data.matchbook),
    coaster: keepsake(data.coaster),
    roomkey: keepsake(data.roomkey),
    pitch: keepsake(data.pitch),
    trailmap: keepsake(data.trailmap),
    parkpass: keepsake(data.parkpass),
    patch: keepsake(data.patch),
    summit: keepsake(data.summit),
    signpost: keepsake(data.signpost),
    leaf: keepsake(data.leaf),
    marshmallow: keepsake(data.marshmallow),
    tides: keepsake(data.tides),
    compass: keepsake(data.compass),
    flower: keepsake(data.flower),
    // Books, films, TV, podcasts and music have keepsakes of their own, shown with the review.
    bookmark: keepsake(data.bookmark),
    librarycard: keepsake(data.librarycard),
    bookplate: keepsake(data.bookplate),
    note: keepsake(data.note),
    popcorn: keepsake(data.popcorn),
    glasses3d: keepsake(data.glasses3d),
    rental: keepsake(data.rental),
    tvguide: keepsake(data.tvguide),
    remote: keepsake(data.remote),
    headphones: keepsake(data.headphones),
    gig: keepsake(data.gig),
    pick: keepsake(data.pick),
    setlist: keepsake(data.setlist),
    busticket: keepsake(data.busticket),
    coffeering: keepsake(data.coffeering),
    signature: keepsake(data.signature),
    bookclub: keepsake(data.bookclub),
    dogear: keepsake(data.dogear),
    stubpair: keepsake(data.stubpair),
    programme: keepsake(data.programme),
    picknmix: keepsake(data.picknmix),
    drivein: keepsake(data.drivein),
    tally: keepsake(data.tally),
    takeaway: keepsake(data.takeaway),
    nospoil: keepsake(data.nospoil),
    battery: keepsake(data.battery),
    jcard: keepsake(data.jcard),
    walkmap: keepsake(data.walkmap),
    napkin: keepsake(data.napkin),
    vinyllabel: keepsake(data.vinyllabel),
    mixtape: keepsake(data.mixtape),
    backstage: keepsake(data.backstage),
    lighter: keepsake(data.lighter),
    // Thoughts have keepsakes too.
    sky: keepsake(data.sky),
    diary: keepsake(data.diary),
    moodring: keepsake(data.moodring),
    doodle: keepsake(data.doodle),
    cootie: keepsake(data.cootie),
    forecast: keepsake(data.forecast),
    lyric: keepsake(data.lyric),
    // Events: gigs, festivals, weddings, races, fairs and nights out.
    handstamp: keepsake(data.handstamp),
    glowstick: keepsake(data.glowstick),
    racebib: keepsake(data.racebib),
    ceremony: keepsake(data.ceremony),
    confetti: keepsake(data.confetti),
    balloon: keepsake(data.balloon),
    matchday: keepsake(data.matchday),
    funfair: keepsake(data.funfair),
    rosette: keepsake(data.rosette),
    namebadge: keepsake(data.namebadge),
    sparkler: keepsake(data.sparkler),
    flyer: keepsake(data.flyer),
    tourtee: keepsake(data.tourtee),
    earplugs: keepsake(data.earplugs),
    drumstick: keepsake(data.drumstick),
    buttonbadge: keepsake(data.buttonbadge),
    seatplan: keepsake(data.seatplan),
    lozenge: keepsake(data.lozenge),
    masks: keepsake(data.masks),
    stageprog: keepsake(data.stageprog),
    comedyticket: keepsake(data.comedyticket),
    mic: keepsake(data.mic),
    interval: keepsake(data.interval),
    operaglasses: keepsake(data.operaglasses),
    curtain: keepsake(data.curtain),
    laughmeter: keepsake(data.laughmeter),
    joke: keepsake(data.joke),
    // Keepsakes you designed yourself (in keepsakes.md), by their id: { ferry: [Return — £8] }.
    custom_keepsakes: customKeepsakes(data.custom_keepsakes),
    // Thoughts and photos: memories, the sky, the gym and the time of day.
    negatives: keepsake(data.negatives),
    oldprint: keepsake(data.oldprint),
    calendar: keepsake(data.calendar),
    vhstape: keepsake(data.vhstape),
    envelope: keepsake(data.envelope),
    thennow: keepsake(data.thennow),
    rewind: keepsake(data.rewind),
    skysunrise: keepsake(data.skysunrise),
    skygolden: keepsake(data.skygolden),
    skyrainbow: keepsake(data.skyrainbow),
    skystorm: keepsake(data.skystorm),
    skysnow: keepsake(data.skysnow),
    skystars: keepsake(data.skystars),
    skymoon: keepsake(data.skymoon),
    skyaurora: keepsake(data.skyaurora),
    skyclouds: keepsake(data.skyclouds),
    skyfog: keepsake(data.skyfog),
    skyplane: keepsake(data.skyplane),
    skypink: keepsake(data.skypink),
    workout: keepsake(data.workout),
    gympass: keepsake(data.gympass),
    personalbest: keepsake(data.personalbest),
    dumbbell: keepsake(data.dumbbell),
    steps: keepsake(data.steps),
    shaker: keepsake(data.shaker),
    heartrate: keepsake(data.heartrate),
    setsheet: keepsake(data.setsheet),
    medal: keepsake(data.medal),
    waterbottle: keepsake(data.waterbottle),
    alarmclock: keepsake(data.alarmclock),
    riseshine: keepsake(data.riseshine),
    firstcoffee: keepsake(data.firstcoffee),
    lunchbreak: keepsake(data.lunchbreak),
    teatime: keepsake(data.teatime),
    nightowl: keepsake(data.nightowl),
    sleepmask: keepsake(data.sleepmask),
    ledclock: keepsake(data.ledclock),
    // Music: awards, charts and the things fans keep.
    discaward: keepsake(data.discaward),
    trophy: keepsake(data.trophy),
    chartno1: keepsake(data.chartno1),
    winnercard: keepsake(data.winnercard),
    goldmic: keepsake(data.goldmic),
    autograph: keepsake(data.autograph),
    fanclub: keepsake(data.fanclub),
    jukebox: keepsake(data.jukebox),
    radiorequest: keepsake(data.radiorequest),
    magreview: keepsake(data.magreview),
    yearonrepeat: keepsake(data.yearonrepeat),
    sevenninch: keepsake(data.sevenninch),
    // Studying and work.
    flashcard: keepsake(data.flashcard),
    highlighter: keepsake(data.highlighter),
    pagetabs: keepsake(data.pagetabs),
    timetable: keepsake(data.timetable),
    examslip: keepsake(data.examslip),
    pomodoro: keepsake(data.pomodoro),
    desklamp: keepsake(data.desklamp),
    librarypass: keepsake(data.librarypass),
    grade: keepsake(data.grade),
    casecard: keepsake(data.casecard),
    mindmap: keepsake(data.mindmap),
    revisionlist: keepsake(data.revisionlist),
    pencil: keepsake(data.pencil),
    calculator: keepsake(data.calculator),
    gradcap: keepsake(data.gradcap),
    diploma: keepsake(data.diploma),
    stopwatch: keepsake(data.stopwatch),
    lecturenotes: keepsake(data.lecturenotes),
    doordnd: keepsake(data.doordnd),
    readinglist: keepsake(data.readinglist),
    idbadge: keepsake(data.idbadge),
    timecard: keepsake(data.timecard),
    meetinginvite: keepsake(data.meetinginvite),
    outofoffice: keepsake(data.outofoffice),
    businesscard: keepsake(data.businesscard),
    inboxzero: keepsake(data.inboxzero),
    laptop: keepsake(data.laptop),
    briefcase: keepsake(data.briefcase),
    deskplate: keepsake(data.deskplate),
    stapler: keepsake(data.stapler),
    paperclips: keepsake(data.paperclips),
    memo: keepsake(data.memo),
    wfh: keepsake(data.wfh),
    tgif: keepsake(data.tgif),
    deadline: keepsake(data.deadline),
    employeemonth: keepsake(data.employeemonth),
    // Reliving a memory: when it happened (a year, a month or a day), for thoughts and photos.
    memory: type === 'thoughts' || type === 'photos' ? memoryWhen(data.memory) : null,
    // Books: how long it is, where you're up to, and a log of reading sessions
    pages: type === 'books' ? pageNum(data.pages) : null,
    page: type === 'books' ? pageNum(data.page) : null,
    reading_log: type === 'books' ? parseReadingLog(data.reading_log) : [],
    year: data.year != null ? String(data.year) : '',
    status: data.status != null ? String(data.status) : '',
    state: SHELF_TYPES.includes(type) ? shelfState(data.status) : '',
    recommend: data.recommend === true,
    rewatch: data.rewatch === true,
    quote: data.quote != null ? String(data.quote) : '',
    // A reader's suggestion: shown as a "Suggested by …" stamp.
    suggested_by: data.suggested_by != null ? String(data.suggested_by).slice(0, 40) : '',
    html: safeMarkdown(body),
    excerpt: plainExcerpt(body || ''),
    body: body || '',
    files: toArray(data.photos).map(String),
    error: data._error || null,
    extra
  };
}

export function isVisible(post, now = Date.now()) {
  return !post.draft && !post.error && post.ts > 0 && post.ts <= now;
}

// "- [ ] Name, City (type) — note"  /  "- [x] Name, City"
export function parseWishlist(text) {
  const { body } = splitFrontMatter(text || '');
  const want = [];
  const done = [];
  for (const raw of body.split(/\r?\n/)) {
    const m = /^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/.exec(raw);
    if (!m) continue;
    let rest = m[2].trim();
    let note = '';
    const noteSplit = rest.split(/\s+[—–]\s+|\s+-\s+/);
    if (noteSplit.length > 1) {
      rest = noteSplit.shift().trim();
      note = noteSplit.join(' — ').trim();
    }
    let category = '';
    const cat = /\(([^)]+)\)\s*$/.exec(rest);
    if (cat) {
      category = cat[1].trim().toLowerCase();
      rest = rest.slice(0, cat.index).trim();
    }
    let name = rest;
    let city = '';
    const comma = rest.lastIndexOf(',');
    if (comma > 0) {
      name = rest.slice(0, comma).trim();
      city = rest.slice(comma + 1).trim();
    }
    (m[1] === ' ' ? want : done).push({ name, city, category, note });
  }
  return { want, done };
}

const PRESENCE = ['online', 'away', 'brb', 'lunch', 'busy', 'offline'];

export function parseSite(text) {
  const { data, body } = splitFrontMatter(text || '');
  const day = /^\d{4}-\d{2}-\d{2}$/.exec(String(data.countdown_date ?? '').trim());
  const updated = Date.parse(String(data.status_updated ?? ''));
  return {
    name: data.name ? String(data.name) : 'My Corner',
    owner: data.owner ? String(data.owner) : '',
    status: data.status ? String(data.status) : '',
    // Messenger-style presence: online, away, brb (be right back), lunch, busy or offline.
    presence: PRESENCE.includes(String(data.presence ?? '').toLowerCase()) ? String(data.presence).toLowerCase() : 'online',
    status_updated: Number.isNaN(updated) ? null : updated,
    // "12 days until …", hidden once the day has passed.
    countdown: data.countdown && day ? { label: String(data.countdown).slice(0, 60), date: day[0], icon: /^[a-z]{1,16}$/.test(String(data.countdown_icon ?? '')) ? String(data.countdown_icon) : '' } : null,
    // The "listening to / watching / reading" line, filled from the shelves.
    now_playing: !(data.now_playing === false || /^(false|no|off)$/i.test(String(data.now_playing ?? ''))),
    // Visitors can comment on posts (each waits for your approval), unless you switch it off.
    comments: !(data.comments === false || /^(false|no|off)$/i.test(String(data.comments ?? ''))),
    // Extra room at the top when opened from a phone's Home Screen ('' as it is).
    top_room: ['some', 'more', 'lots'].includes(String(data.top_room ?? '').trim()) ? String(data.top_room).trim() : '',
    tagline: data.tagline ? String(data.tagline) : '',
    about_html: safeMarkdown(body)
  };
}

// status-log.md: one past status per line, newest first: "- 2026-10-23 11:39 · text".
// categories.md: your own place categories, one per line: "- Bookshops, #8a4f26".
// The colour is optional. Built-in ones (food, coffee…) don't need to be listed.
export function parseCategories(text) {
  const out = [];
  const seen = new Set();
  for (const line of String(text || '').split('\n')) {
    const m = /^\s*[-*]\s*([^,#\n]{1,30}?)\s*(?:,\s*(#[0-9a-f]{3}(?:[0-9a-f]{3})?))?\s*$/i.exec(line);
    if (!m) continue;
    const label = m[1].trim();
    const key = label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label, color: m[2] ? m[2].toLowerCase() : '' });
    if (out.length >= 40) break;
  }
  return out;
}

export function parseStatusLog(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const m = /^\s*[-*]\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?\s*[·|-]\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    out.push({ date: m[1], time: m[2] || '', text: m[3].slice(0, 200) });
    if (out.length >= 40) break;
  }
  return out;
}

// travel.md: flight totals in the header, an optional note underneath.
// Only the keys below ever reach a visitor, and only as plain numbers and short names.
const TRAVEL_NUMBERS = ['flights', 'distance_km', 'hours', 'airports', 'countries'];
const TRAVEL_LISTS = ['top_airlines', 'top_aircraft'];

function cleanNumber(v) {
  const s = String(v ?? '').replace(/[,\s]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
}

export function parseTravel(text) {
  if (!text) return null;
  const { data, body } = splitFrontMatter(text);
  if (data._error) return null;
  const out = {};
  for (const k of TRAVEL_NUMBERS) {
    const n = cleanNumber(data[k]);
    if (n != null) out[k] = n;
  }
  if (data.per_year && typeof data.per_year === 'object' && !Array.isArray(data.per_year)) {
    const years = {};
    for (const [y, v] of Object.entries(data.per_year)) {
      const n = cleanNumber(v);
      if (/^\d{4}$/.test(String(y).trim()) && n != null) years[String(y).trim()] = n;
    }
    if (Object.keys(years).length) out.per_year = years;
  }
  for (const k of TRAVEL_LISTS) {
    const list = Array.isArray(data[k]) ? data[k] : typeof data[k] === 'string' ? data[k].split(',') : [];
    const clean = list.map((s) => String(s ?? '').trim().slice(0, 60)).filter(Boolean).slice(0, 10);
    if (clean.length) out[k] = clean;
  }
  const note = String(body || '').trim();
  if (note) out.note_html = safeMarkdown(note);
  if (!Object.keys(out).length) return null;
  out.hidden = isTrue(data.hidden) || isTrue(data.draft);
  return out;
}

// ---- Designs you can swap: the visa in the passport, and your own keepsakes ----
const HEX = /^#[0-9a-f]{6}$/i;
const hexOr = (v) => (HEX.test(String(v ?? '').trim()) ? String(v).trim().toLowerCase() : '');
const short = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
// A picture you uploaded for a design: only ever a file in the design/ folder.
const designPicture = (v) => {
  const key = String(v ?? '').trim();
  return /^design\/[A-Za-z0-9._-]{1,80}\.(jpe?g|png|webp|gif)$/i.test(key) ? key : '';
};
export const VISA_DESIGNS = ['central', 'classic', 'mountains', 'seaside', 'city', 'botanical'];
export const VISA_STRIPS = ['kilim', 'waves', 'checks', 'stripes', 'none'];
export const VISA_EMBLEMS = ['globe', 'compass', 'star', 'plane', 'leaf', 'none'];

// passport.md: which visa design the passport uses, and your tweaks to it. Without the file
// (or with nothing set) the passport keeps the original design.
export function parsePassport(text) {
  const { data } = splitFrontMatter(text || '');
  const pick = (v, list) => (list.includes(String(v ?? '').trim().toLowerCase()) ? String(v).trim().toLowerCase() : '');
  const words = (Array.isArray(data.words) ? data.words : typeof data.words === 'string' ? data.words.split(',') : []).map((w) => short(w, 24)).filter(Boolean).slice(0, 14);
  return {
    // (Anything it doesn't know, including an old name for the original, is the original.)
    design: pick(data.design, VISA_DESIGNS) || 'central',
    ink: hexOr(data.ink),
    accent: hexOr(data.accent),
    highlight: hexOr(data.highlight),
    strip: pick(data.strip, VISA_STRIPS),
    emblem: pick(data.emblem, VISA_EMBLEMS),
    words,
    picture: designPicture(data.picture)
  };
}

// theme.md: the site's theme. A built-in one by name, and any parts changed: three colours
// (and the journal's leather), a wallpaper, a charm for the title bars and one for the pointer.
// Anything missing or odd falls back to the built-in theme's own.
// (These lists match public/js/skins.js.)
export const THEMES = ['classic', 'bunny', 'matcha', 'chrome', 'arcade', 'lemonade', 'cherry', 'cloud', 'froggy', 'boba', 'peach', 'moonlit', 'neon', 'empire', 'rococo', 'disco', 'popart', 'memphis', 'leopard', 'opera', 'blocky', 'bigtop', 'wintry', 'springtime', 'summery', 'autumnal', 'seasonal', 'graphite', 'paper', 'slate', 'sand', 'olive', 'navy', 'mono'];
export const THEME_WALLPAPERS = ['sky', 'bunnies', 'hearts', 'leaves', 'sparkles', 'stars', 'grid', 'daisies', 'cherries', 'clouds', 'lilypads', 'boba', 'bubbles', 'moons', 'gingham', 'checks', 'plain', 'dots', 'lines', 'graph', 'linen', 'contours', 'grain', 'sunset', 'laurels', 'rococo', 'disco', 'benday', 'memphis', 'leopard', 'damask', 'blocks', 'bigtop', 'frost', 'blossoms', 'seaside', 'harvest', 'emoji', 'picture'];
export const THEME_CHARMS = ['none', 'heart', 'ears', 'bunny', 'bow', 'leaf', 'sparkle', 'star', 'daisy', 'cherry', 'cloud', 'frog', 'boba', 'peach', 'moon', 'plain', 'dot', 'ring', 'diamond', 'plus', 'asterisk', 'chevron', 'rainbow', 'pal', 'twinkle', 'hearts', 'snowman', 'snowflake', 'mitten', 'santa', 'fir', 'present', 'tulip', 'chick', 'bee', 'sun', 'icelolly', 'watermelon', 'maple', 'acorn', 'pumpkin', 'jack', 'ghost', 'lantern', 'blossom', 'sabzeh', 'goldfish', 'fanous', 'mooncake', 'diya', 'splash', 'dreidel', 'pomegranate', 'marigold', 'papel', 'mask', 'crown', 'egg', 'shamrock', 'flowercrown', 'firework', 'tanzaku', 'dragonboat', 'zongzi', 'koinobori', 'palm', 'laurel', 'fan', 'discoball', 'boom', 'squiggle', 'lips', 'chandelier', 'pickaxe', 'tent'];
export const EMOJI_LAYOUTS = ['grid', 'scatter', 'big'];
// The rest of a theme's settings, each one of a few choices (these match public/js/skins.js).
// Festive days an owner can tick (these match FESTIVALS in public/js/skins.js).
export const THEME_FESTIVALS = ['lunar_new_year', 'hanami', 'childrens_day', 'dragon_boat', 'tanabata', 'mid_autumn', 'nowruz', 'holi', 'ramadan', 'eid_al_fitr', 'eid_al_adha', 'diwali', 'yalda', 'dia_de_reyes', 'carnival', 'dia_de_muertos', 'st_patricks', 'easter', 'midsummer', 'bonfire_night', 'halloween', 'hanukkah', 'christmas'];
// Words on buttons that can be renamed (these match LABELS in public/js/skins.js).
export const THEME_LABELS = ['home', 'thoughts', 'journal', 'atlas', 'friends', 'album', 'more', 'passport', 'wishlist', 'guestbook', 'books', 'films', 'podcasts', 'music', 'tv', 'stats', 'about', 'explore', 'others', 'search', 'leave', 'nudge', 'open_journal', 'read_review', 'visitor', 'come_in'];
// Places the seasons' glass can go (these match GLASS_PLACES in public/js/skins.js).
export const THEME_GLASS = ['photos', 'thoughts', 'journal', 'passport', 'atlas', 'wishlist', 'guestbook', 'books', 'films', 'podcasts', 'music', 'tv'];
export const THEME_OPTIONS = {
  font: ['classic', 'modern', 'system', 'mono', 'rounded', 'bubbly', 'pixel', 'terminal', 'comic', 'handwritten', 'typewriter', 'elegant'],
  title_font: ['classic', 'modern', 'system', 'mono', 'condensed', 'rounded', 'bubbly', 'pixel', 'terminal', 'comic', 'handwritten', 'typewriter', 'elegant', 'arcade', 'tiny'],
  text_size: ['m', 's', 'l'],
  selector: ['bar', 'gradient', 'pointer', 'outline', 'invert'],
  bars: ['glossy', 'flat', 'stripes', 'pixel'],
  corners: ['classic', 'square', 'round'],
  density: ['cosy', 'compact', 'roomy'],
  posts: ['cards', 'lines'],
  scrollbar: ['classic', 'themed', 'thin', 'hidden'],
  taskbar: ['bottom', 'top'],
  icons: ['colour', 'soft', 'mono'],
  sounds: ['classic', 'soft', 'chip', 'bubbly', 'quiet'],
  header: ['banner', 'card', 'minimal', 'hidden'],
  name_style: ['plain', 'rainbow', 'glitter', 'glow', 'wordart', 'outline', 'chrome'],
  trail: ['none', 'sparkles', 'hearts', 'stars', 'bubbles', 'rainbow', 'pixels'],
  falling: ['none', 'snow', 'petals', 'hearts', 'stars', 'leaves', 'confetti', 'bubbles', 'sunshine'],
  seasons: ['off', 'auto', 'winter', 'spring', 'summer', 'autumn', 'lunar_new_year', 'hanami', 'childrens_day', 'dragon_boat', 'tanabata', 'mid_autumn', 'nowruz', 'holi', 'ramadan', 'eid_al_fitr', 'eid_al_adha', 'diwali', 'yalda', 'dia_de_reyes', 'carnival', 'dia_de_muertos', 'st_patricks', 'easter', 'midsummer', 'bonfire_night', 'halloween', 'hanukkah', 'christmas', 'my_1', 'my_2', 'my_3', 'my_4', 'my_5', 'my_6', 'my_7', 'my_8', 'my_9', 'my_10', 'my_11', 'my_12'],
  hemisphere: ['north', 'south'],
  glass_style: ['season', 'winter', 'spring', 'summer', 'autumn', 'festive', 'gloss'],
  glass_strength: ['medium', 'soft', 'strong'],
  card_style: ['classic', 'polaroid', 'scrapbook', 'notebook', 'postcard', 'sticky', 'ticket', 'torn', 'comic', 'neon', 'letter', 'film', 'pixel', 'chrome'],
  card_festive: ['on', 'off'],
  card_corner: ['none', 'season', 'charm'],
  page: ['layered', 'pattern', 'wallpaper', 'tint', 'plain'],
  page_strength: ['medium', 'soft', 'strong'],
  wall_time: ['day', 'still']
};
export const THEME_HIDEABLE = ['lastpost', 'status', 'playing', 'countdown', 'nudge', 'clock', 'traystatus'];
export const THEME_SECTIONS = ['home', 'thoughts', 'journal', 'atlas', 'friends', 'album', 'more', 'passport', 'wishlist', 'guestbook', 'books', 'films', 'podcasts', 'music', 'tv', 'stats', 'about'];
// Each app's own look (these match public/js/skins.js).
export const THEME_APPS = { 'journal': ['paper', 'hand', 'map', 'font'], 'passport': ['paper', 'hand', 'font'], 'atlas': ['map', 'font'], 'wishlist': ['font'], 'guestbook': ['font'], 'books': ['font'], 'films': ['font'], 'podcasts': ['font'], 'music': ['font'], 'tv': ['font'], 'album': ['font'] };
export const APP_LOOKS = ['auto', 'original', 'tint', 'custom'];
export const APP_EXTRAS = { 'paper': ['aged', 'cream', 'white', 'kraft', 'grid', 'dotted'], 'hand': ['caveat', 'gaegu', 'comic', 'typewriter', 'pixel', 'elegant'], 'map': ['classic', 'soft', 'mono', 'sepia', 'night'], 'font': ['own', 'theme', 'classic', 'modern', 'system', 'mono', 'rounded', 'bubbly', 'pixel', 'terminal', 'comic', 'handwritten', 'typewriter', 'elegant'] };
export const STICKER_SPOTS = ['title', 'corner-bl', 'corner-br', 'profile', 'cards', 'taskbar', 'desktop'];
// Only whole emoji (skin tones, flags and families kept together), at most `max`.
function emojiOnly(text, max) {
  const s = String(text ?? '').slice(0, 200);
  const parts = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);
  return parts.filter((g) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g) && g.length <= 16 && !/[<>&"'\\]/.test(g)).slice(0, max);
}
export function parseTheme(text) {
  const { data } = splitFrontMatter(text || '');
  const pick = (v, list) => (list.includes(String(v ?? '').trim().toLowerCase()) ? String(v).trim().toLowerCase() : '');
  const out = { theme: pick(data.theme, THEMES) || 'classic' };
  for (const k of ['main', 'accent', 'paper', 'leather']) if (hexOr(data[k])) out[k] = hexOr(data[k]);
  const lists = { wallpaper: THEME_WALLPAPERS, decoration: THEME_CHARMS, pointer: THEME_CHARMS };
  for (const k of Object.keys(lists)) if (pick(data[k], lists[k])) out[k] = pick(data[k], lists[k]);
  const picture = designPicture(data.picture);
  if (picture) out.picture = picture;
  // The emoji wallpaper: up to three emoji, and how they're laid out.
  const emoji = emojiOnly(data.emoji, 3).join('');
  if (emoji) out.emoji = emoji;
  if (pick(data.emoji_layout, EMOJI_LAYOUTS)) out.emoji_layout = pick(data.emoji_layout, EMOJI_LAYOUTS);
  // Stickers: an emoji or one of the drawings, in one of the places they can go.
  const num = (v, a, b, d) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.max(a, Math.min(b, Math.round(+v))) : d);
  const stickers = (Array.isArray(data.stickers) ? data.stickers : [])
    .slice(0, 16)
    .map((st) => {
      if (!st || typeof st !== 'object') return null;
      const what = THEME_CHARMS.includes(String(st.what)) && !['none', 'plain'].includes(st.what) ? String(st.what) : emojiOnly(st.what, 1)[0];
      const where = pick(st.where, STICKER_SPOTS);
      if (!what || !where) return null;
      const one = { what, where, size: ['s', 'm', 'l'].includes(st.size) ? st.size : 'm', tilt: num(st.tilt, -45, 45, 0) };
      if (where === 'desktop') Object.assign(one, { x: num(st.x, 0, 100, 50), y: num(st.y, 0, 100, 50) });
      return one;
    })
    .filter(Boolean);
  if (stickers.length) out.stickers = stickers;
  for (const [k, list] of Object.entries(THEME_OPTIONS)) if (pick(data[k], list)) out[k] = pick(data[k], list);
  // Post cards of your own (made from parts), and one of them for every post.
  const cards = cleanCards(data.cards, THEME_OPTIONS.title_font);
  if (cards.length) out.cards = cards;
  if (OWN_CARD.test(String(data.card_style)) && cards.some((c) => c.id === data.card_style)) out.card_style = data.card_style;
  // …or every post a different one, mixed at random from the designs ticked.
  if (String(data.card_style ?? '').trim() === MIX) out.card_style = MIX;
  const mix = cleanMix(data.card_mix, THEME_OPTIONS.card_style, cards);
  if (mix.length) out.card_mix = mix;
  if (cleanSeed(data.card_seed)) out.card_seed = cleanSeed(data.card_seed);
  // The browser tab's icon (a drawing or one emoji), and another theme for after dark.
  const tab = THEME_CHARMS.includes(String(data.tab_icon)) && !['none', 'plain'].includes(data.tab_icon) ? String(data.tab_icon) : emojiOnly(data.tab_icon, 1)[0];
  if (tab) out.tab_icon = tab;
  const night = pick(data.night_theme, THEMES);
  if (night && night !== out.theme) out.night_theme = night;
  // Lists: parts of the header and tray left out, the main menu's sections in order (up to
  // five), and sections left out of the menus (never Home).
  const words = (v, list) => [...new Set((Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\s,]+/) : []).map((x) => String(x).trim().toLowerCase()).filter((x) => list.includes(x)))];
  const hide = words(data.hide, THEME_HIDEABLE);
  if (hide.length) out.hide = hide;
  const menu = words(data.menu, THEME_SECTIONS).slice(0, 5);
  if (menu.length) out.menu = menu;
  const gone = words(data.sections_hidden, THEME_SECTIONS).filter((x) => x !== 'home' && !menu.includes(x));
  if (gone.length) out.sections_hidden = gone;
  const festivals = words(data.festivals, THEME_FESTIVALS);
  if (festivals.length) out.festivals = festivals;
  const glass = words(data.glass, THEME_GLASS);
  if (glass.length) out.glass = glass;
  // Floppy's outfit and colour.
  if (data.floppy && typeof data.floppy === 'object' && !Array.isArray(data.floppy)) {
    const f = cleanFloppy(data.floppy, (x) => (THEME_CHARMS.includes(String(x)) && !['none', 'plain'].includes(x) ? String(x) : emojiOnly(x, 1)[0] || ''));
    if (f.dress !== 'off' || f.colour !== 'classic') out.floppy = f;
  }
  // Your own drawings (a drawing's name or one emoji each, up to eight) and what falls, for any
  // season or festive day.
  if (data.looks && typeof data.looks === 'object' && !Array.isArray(data.looks)) {
    const looks = {};
    for (const [id, o] of Object.entries(data.looks)) {
      if (!(['winter', 'spring', 'summer', 'autumn'].includes(id) || THEME_FESTIVALS.includes(id)) || !o || typeof o !== 'object') continue;
      const one = {};
      const charms = [...new Set((Array.isArray(o.charms) ? o.charms : []).map((x) => (THEME_CHARMS.includes(String(x)) && !['none', 'plain'].includes(x) ? String(x) : emojiOnly(x, 1)[0])).filter(Boolean))].slice(0, 8);
      if (charms.length) one.charms = charms;
      if (THEME_OPTIONS.falling.includes(String(o.falling))) one.falling = String(o.falling);
      const where = [...new Set((Array.isArray(o.where) ? o.where : []).map(String).filter((x) => STICKER_SPOTS.includes(x)))];
      if (where.length) one.where = where;
      if (Array.isArray(o.settle)) one.settle = [...new Set(o.settle.map(String).filter((x) => ['bars', 'icons', 'taskbar', 'ground', 'posts', 'menu', 'profile'].includes(x)))];
      if (Object.keys(one).length) looks[id] = one;
    }
    if (Object.keys(looks).length) out.looks = looks;
  }
  // What each app's top bar wears (these match BAR_APPS and BAR_DECOR in public/js/skins.js):
  // 'random', 'none', or 'mine' with up to three drawings or emoji; the day's is the default.
  if (data.bar_decor && typeof data.bar_decor === 'object' && !Array.isArray(data.bar_decor)) {
    const bars = {};
    for (const [app, o] of Object.entries(data.bar_decor)) {
      if (!(app === 'windows' || THEME_APPS[app]) || !o || typeof o !== 'object' || !['random', 'mine', 'none'].includes(o.mode)) continue;
      if (o.mode !== 'mine') bars[app] = { mode: o.mode };
      else {
        const charms = [...new Set((Array.isArray(o.charms) ? o.charms : []).map((x) => (THEME_CHARMS.includes(String(x)) && !['none', 'plain'].includes(x) ? String(x) : emojiOnly(x, 1)[0])).filter(Boolean))].slice(0, 3);
        if (charms.length) bars[app] = { mode: 'mine', charms };
      }
    }
    if (Object.keys(bars).length) out.bar_decor = bars;
  }
  // Days of your own: a name, from and to (month-day, every year), a drawing or emoji, and something falling.
  const okMd = (v) => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(v ?? '')) && +String(v).slice(3) <= new Date(2024, +String(v).slice(0, 2), 0).getDate();
  const mine = (Array.isArray(data.my_days) ? data.my_days : [])
    .slice(0, 12)
    .map((x) => {
      if (!x || typeof x !== 'object' || !okMd(x.from)) return null;
      const what = THEME_CHARMS.includes(String(x.what)) && !['none', 'plain'].includes(x.what) ? String(x.what) : emojiOnly(x.what, 1)[0] || 'twinkle';
      const one = { name: short(String(x.name ?? '').replace(/[<>]/g, ''), 40) || 'My day', from: String(x.from), to: okMd(x.to) ? String(x.to) : String(x.from), what };
      if (THEME_OPTIONS.falling.includes(String(x.falling)) && x.falling !== 'none') one.falling = String(x.falling);
      return one;
    })
    .filter(Boolean);
  if (mine.length) out.my_days = mine;
  // Your own words on the buttons (short, plain text).
  if (data.labels && typeof data.labels === 'object' && !Array.isArray(data.labels)) {
    const labels = {};
    for (const [k, v] of Object.entries(data.labels)) {
      const text = String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
      if (THEME_LABELS.includes(k) && text) labels[k] = text;
    }
    if (Object.keys(labels).length) out.labels = labels;
  }
  // Dates you've set for festive days (one stretch each, up to six weeks).
  if (data.festival_dates && typeof data.festival_dates === 'object' && !Array.isArray(data.festival_dates)) {
    const iso = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) && new Date(v + 'T12:00:00Z').toISOString?.().slice(0, 10) === v ? v : '');
    const dates = {};
    for (const [id, o] of Object.entries(data.festival_dates)) {
      if (!THEME_FESTIVALS.includes(id) || !o || typeof o !== 'object') continue;
      let from, to;
      try {
        from = iso(o.from instanceof Date ? o.from.toISOString().slice(0, 10) : o.from);
        to = iso(o.to instanceof Date ? o.to.toISOString().slice(0, 10) : o.to) || from;
      } catch {
        continue;
      }
      if (!from || to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 42) continue;
      dates[id] = { from, to };
    }
    if (Object.keys(dates).length) out.festival_dates = dates;
  }
  // Each app's look: which apps, how they look, a colour of their own, and their own settings.
  if (data.apps && typeof data.apps === 'object' && !Array.isArray(data.apps)) {
    const apps = {};
    for (const [id, a] of Object.entries(data.apps)) {
      if (!THEME_APPS[id] || !a || typeof a !== 'object') continue;
      const one = {};
      const look = pick(a.look, APP_LOOKS);
      if (look && look !== 'auto') one.look = look;
      if (look === 'custom') one.colour = hexOr(a.colour) || '#7a6a9a';
      for (const k of THEME_APPS[id]) {
        const v = pick(a[k], APP_EXTRAS[k]);
        if (v && v !== APP_EXTRAS[k][0]) one[k] = v;
      }
      if (Object.keys(one).length) apps[id] = one;
    }
    if (Object.keys(apps).length) out.apps = apps;
  }
  return out;
}

// A post's own ribbon (these match RIBBONS in public/js/card-dress.js).
export const RIBBON_STYLES = ['banner', 'sash', 'stamp', 'neon', 'sticker'];
export const KEEPSAKE_SHAPES = ['ticket', 'card', 'tag', 'badge', 'sticker', 'note', 'picture'];
const SHELF_AND_PLACES = ['places', 'books', 'films', 'tv', 'podcasts', 'music', 'thoughts'];
// keepsakes.md: built-in keepsakes you've switched off (they leave the back office, though a
// post that already has one keeps it), and keepsakes you've designed yourself.
export function parseKeepsakeSettings(text) {
  const { data } = splitFrontMatter(text || '');
  const hidden = (Array.isArray(data.hidden) ? data.hidden : []).map((x) => String(x ?? '').trim()).filter((x) => /^[a-z0-9]{1,30}$/.test(x)).slice(0, 200);
  const seen = new Set();
  const custom = [];
  for (const d of Array.isArray(data.custom) ? data.custom : []) {
    if (!d || typeof d !== 'object') continue;
    const id = String(d.id ?? '').trim().toLowerCase();
    const name = short(d.name, 40);
    if (!DESIGN_ID.test(id) || !name || seen.has(id)) continue;
    seen.add(id);
    const types = (Array.isArray(d.types) ? d.types : []).map((t) => String(t).trim()).filter((t) => SHELF_AND_PLACES.includes(t));
    custom.push({
      id,
      name,
      sub: short(d.sub, 50),
      tab: short(d.tab, 24) || 'My keepsakes',
      shape: KEEPSAKE_SHAPES.includes(String(d.shape)) ? String(d.shape) : 'ticket',
      heading: short(d.heading, 30),
      paper: hexOr(d.paper),
      ink: hexOr(d.ink),
      accent: hexOr(d.accent),
      picture: designPicture(d.picture),
      types: types.length ? [...new Set(types)] : ['places'],
      prices: isTrue(d.prices)
    });
    if (custom.length >= 60) break;
  }
  return { hidden, custom };
}

// Countries you've been to, for passport stamps. Each entry is a country code with a city
// (and optionally when): "GB London", or { country: GB, city: London, date: 2019-07 }.
// "Flat white — £3.20", "Flat white | 3.20", or { item: Flat white, price: £3.20 }.
// A ticket: left out (null), a plain one (no lines), or one with lines on it.
// When a remembered thing happened: "2019", "2019-07" or "2019-07-14" (a year from 1900 on).
function memoryWhen(v) {
  const m = /^\s*(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?\s*$/.exec(String(v ?? ''));
  if (!m || +m[1] < 1900 || +m[1] > 2200) return null;
  const mo = m[2] && +m[2] >= 1 && +m[2] <= 12 ? m[2].padStart(2, '0') : '';
  const d = mo && m[3] && +m[3] >= 1 && +m[3] <= 31 ? m[3].padStart(2, '0') : '';
  return [m[1], mo, d].filter(Boolean).join('-');
}

const DESIGN_ID = /^[a-z0-9][a-z0-9-]{0,29}$/;
function customKeepsakes(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out = {};
  for (const [id, lines] of Object.entries(v)) {
    const k = keepsake(lines);
    if (DESIGN_ID.test(id) && k) out[id] = k;
  }
  return out;
}

function keepsake(v) {
  if (v == null || v === false || v === '' || v === 'false' || v === 'no') return null;
  if (v === true || v === 'true' || v === 'yes') return [];
  return parseOrdered(v);
}

function parseOrdered(list) {
  if (!Array.isArray(list)) list = list != null && list !== '' ? [list] : [];
  const out = [];
  for (const e of list.slice(0, 30)) {
    let item = '';
    let price = '';
    if (e && typeof e === 'object' && !Array.isArray(e)) {
      item = String(e.item ?? e.name ?? '').trim();
      price = String(e.price ?? '').trim();
      // A line written by hand with a colon in it ("Dress code: smart") reads as a pair.
      const keys = Object.keys(e);
      if (!item && keys.length === 1 && (typeof e[keys[0]] === 'string' || typeof e[keys[0]] === 'number')) item = `${keys[0]}: ${e[keys[0]]}`;
    } else {
      const str = String(e ?? '').trim();
      const m = /^(.*?)\s*(?:—|–|-|\||·|@)\s*([£$€¥₹]?\s?\d+(?:[.,]\d{1,2})?\s?(?:[£$€¥₹]|AED|USD|EUR|GBP)?)\s*$/i.exec(str);
      [item, price] = m ? [m[1], m[2]] : [str, ''];
    }
    item = item.replace(/\s+/g, ' ').slice(0, 60);
    price = price.replace(/\s+/g, ' ').slice(0, 14);
    if (item) out.push({ item, price });
  }
  return out;
}

function floppyList(v) {
  return (Array.isArray(v) ? v : v != null ? [v] : []).map((x) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)).filter(Boolean).slice(0, 20);
}

function pageNum(v) {
  const n = parseInt(String(v ?? '').replace(/[,\s]/g, ''), 10);
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : null;
}

// Book reading log: a list under `reading_log:` with date, from, to (pages), chapter and note.
// `pages: 12-40` works too.
function parseReadingLog(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list.slice(0, 500)) {
    if (!e || typeof e !== 'object') continue;
    const str = (v, n) => (v == null ? '' : String(v).trim().slice(0, n));
    let from = pageNum(e.from);
    let to = pageNum(e.to);
    const range = /^(\d+)\s*(?:-|–|—|to)\s*(\d+)$/i.exec(str(e.pages, 30));
    if (range) [from, to] = [+range[1], +range[2]];
    if (from && to && to < from) [from, to] = [to, from];
    const date = /^\d{4}-\d{2}-\d{2}/.exec(str(e.date, 30));
    const item = { date: date ? date[0] : '', from, to, chapter: str(e.chapter, 140), note: str(e.note, 2000) };
    if (item.from || item.to || item.chapter || item.note) out.push(item);
  }
  return out;
}

// TV episode diary: a list under `episodes:` with season, ep, title, rating, note and date.
// A binge is a range: `ep: 4` with `to: 8`, or `ep: 4-8`.
function parseEpisodes(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list.slice(0, 500)) {
    if (!e || typeof e !== 'object') continue;
    const str = (v, n) => (v == null ? '' : String(v).trim().slice(0, n));
    const rating = e.rating == null || e.rating === '' || Number.isNaN(+e.rating) ? null : Math.max(0, Math.min(5, Math.round(+e.rating * 2) / 2));
    const date = /^\d{4}-\d{2}-\d{2}/.exec(str(e.date, 30));
    let ep = str(e.ep ?? e.episode, 12);
    let to = str(e.to, 12);
    const range = /^(\d+)\s*(?:-|–|—|to)\s*(\d+)$/i.exec(ep);
    if (range) [ep, to] = [range[1], range[2]];
    if (!/^\d+$/.test(to) || !/^\d+$/.test(ep) || +to <= +ep) to = '';
    const item = { season: str(e.season, 12), ep, to, title: str(e.title, 140), rating, note: str(e.note, 2000), date: date ? date[0] : '' };
    if (item.ep || item.title || item.note || item.rating != null) out.push(item);
  }
  return out;
}

export function parseVisited(text) {
  if (!text) return [];
  const { data } = splitFrontMatter(text);
  if (data._error || !Array.isArray(data.visited)) return [];
  const out = [];
  for (const v of data.visited.slice(0, 300)) {
    let code = '';
    let city = '';
    let date = '';
    if (typeof v === 'string') {
      const m = /^\s*([A-Za-z]{2})\b\s*(.*)$/.exec(v);
      if (m) [code, city] = [m[1], m[2]];
    } else if (v && typeof v === 'object') {
      code = String(v.country ?? v.code ?? '');
      city = String(v.city ?? '');
      date = v.date != null ? String(v.date) : '';
    }
    code = code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) continue;
    const ym = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(date.trim());
    out.push({ code, city: city.trim().slice(0, 60), date: ym ? `${ym[1]}-${(ym[2] || '1').padStart(2, '0')}-${(ym[3] || '1').padStart(2, '0')}` : '' });
  }
  return out;
}

function isTrue(v) {
  return v === true || /^(true|yes)$/i.test(String(v ?? ''));
}

// A comment on a post (comments/<type>/<post>/<id>.md, or comments-pending/… while it waits):
// a name (any name: no email, nothing else about the visitor), when, the comment it answers if
// it's a reply, your reply to it, and the words.
const COMMENT_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,40}$/;
export function parseComment(key, text) {
  const [, type = '', slug = '', file = ''] = String(key).split('/');
  const { data, body } = splitFrontMatter(text || '');
  return {
    key,
    post: `${type}/${slug}`,
    id: file.replace(/\.md$/i, ''),
    name: String(data.name || 'Visitor').slice(0, 40),
    date: data.date ? String(data.date) : '',
    reply_to: COMMENT_ID.test(String(data.reply_to ?? '')) ? String(data.reply_to) : '',
    reply: data.reply ? String(data.reply).slice(0, 2000) : '',
    message: String(body || '').trim().slice(0, 2000)
  };
}
export const isCommentKey = (k, folder = 'comments') => new RegExp(`^${folder}/[a-z]+/[^/]+/[A-Za-z0-9-]+\\.md$`).test(k);

export function parseGuestbookEntry(key, text) {
  const { data, body } = splitFrontMatter(text);
  return {
    key,
    name: String(data.name || 'Visitor').slice(0, 60),
    date: data.date ? String(data.date) : '',
    reply: data.reply ? String(data.reply).slice(0, 2000) : '',
    message: String(body || '').trim().slice(0, 2000)
  };
}
