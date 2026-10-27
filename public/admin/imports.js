// Turns a Goodreads or Letterboxd export into Markdown posts for the shelves.
// Only titles, creators, years, dates, ratings, shelves and your own reviews are used.
// Private notes, ISBNs, profile links and account details are never read.

export function parseCSV(text) {
  text = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let f = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(f);
      f = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f);
      rows.push(row);
      row = [];
      f = '';
    } else f += c;
  }
  if (f !== '' || row.length) {
    row.push(f);
    rows.push(row);
  }
  const [head = [], ...rest] = rows;
  const keys = head.map((k) => k.trim());
  return rest.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(keys.map((k, j) => [k, (r[j] ?? '').trim()])));
}

// Reviews from both sites may contain a little HTML; keep the words and the line breaks.
function htmlToText(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/?(i|em)>/gi, '*')
    .replace(/<\/?(b|strong)>/gi, '**')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// "2024/05/01" or "2024-05-01" → "2024-05-01 12:00"
function day(s) {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(String(s || ''));
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')} 12:00` : '';
}
const num = (s) => {
  const n = Number(String(s ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function fromGoodreads(rows) {
  if (!rows.length || !('Exclusive Shelf' in rows[0]) || !('Title' in rows[0])) throw new Error('That doesn’t look like a Goodreads export. Use the file Goodreads emails you (goodreads_library_export.csv).');
  return rows.map((r) => {
    const shelf = (r['Exclusive Shelf'] || '').toLowerCase();
    const status = shelf === 'currently-reading' ? 'reading' : shelf === 'to-read' ? 'want' : /dnf|did-not-finish|abandon|gave-up/.test(shelf) ? 'dropped' : 'read';
    return {
      type: 'books',
      title: r.Title,
      fm: {
        date: day(r['Date Read']) || day(r['Date Added']),
        title: r.Title,
        author: r.Author,
        year: num(r['Original Publication Year']) || num(r['Year Published']),
        status,
        rating: num(r['My Rating'])
      },
      body: htmlToText(r['My Review'])
    };
  });
}

// Letterboxd exports several files; this merges them into one entry per film.
export function fromLetterboxd(files) {
  const get = (name) => {
    const k = Object.keys(files).find((f) => f.toLowerCase().split('/').pop() === name);
    return k ? parseCSV(files[k]) : [];
  };
  const watched = get('watched.csv');
  const diary = get('diary.csv');
  const reviews = get('reviews.csv');
  const ratings = get('ratings.csv');
  const watchlist = get('watchlist.csv');
  if (![watched, diary, reviews, ratings, watchlist].some((l) => l.length)) throw new Error('No Letterboxd files found. Choose the .zip Letterboxd gives you, or the .csv files inside it.');
  const films = new Map();
  const film = (r) => {
    const key = `${r.Name}|${r.Year}`.toLowerCase();
    if (!films.has(key)) films.set(key, { title: r.Name, year: num(r.Year), date: '', rating: null, review: '', reviewDate: '', rewatch: false, status: 'watched' });
    return films.get(key);
  };
  const later = (a, b) => (b > a ? b : a);
  for (const r of watched) {
    const f = film(r);
    f.date = later(f.date, day(r.Date));
  }
  for (const r of ratings) film(r).rating = num(r.Rating);
  for (const r of diary) {
    const f = film(r);
    const d = day(r['Watched Date']) || day(r.Date);
    if (d >= f.date) {
      f.date = d;
      if (num(r.Rating)) f.rating = num(r.Rating);
      f.rewatch = /^yes$/i.test(r.Rewatch || '');
    }
  }
  for (const r of reviews) {
    const f = film(r);
    const d = day(r['Watched Date']) || day(r.Date);
    if (d >= f.reviewDate) {
      f.reviewDate = d;
      f.review = htmlToText(r.Review);
      if (num(r.Rating)) f.rating = num(r.Rating);
    }
    f.date = later(f.date, d);
  }
  for (const r of watchlist) {
    const key = `${r.Name}|${r.Year}`.toLowerCase();
    if (films.has(key)) continue;
    const f = film(r);
    f.status = 'want';
    f.date = day(r.Date);
  }
  return [...films.values()].map((f) => ({
    type: 'films',
    title: f.title,
    fm: { date: f.date, title: f.title, year: f.year, status: f.status, rating: f.rating, rewatch: f.rewatch },
    body: f.review
  }));
}

export function summarise(items) {
  const count = (s) => items.filter((i) => i.fm.status === s).length;
  return count;
}
