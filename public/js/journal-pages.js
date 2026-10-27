// On a computer, a journal entry is laid out like a real book: the first spread has the map
// and scrapbook on the left and the start of the writing on the right; if the writing is long
// it carries on over the next spreads, two pages at a time, and you turn the page instead of
// scrolling. Pages are measured to fit the window and re-measured when it changes size.
import { h } from './util.js';
import { sound } from './sound.js';

// Copies of a paragraph-like element cut at a word: the first `k` words, or everything after.
function cutWords(el, k, keepFirst) {
  const copy = el.cloneNode(true);
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  let seen = 0;
  let cutDone = false;
  for (const t of texts) {
    const parts = t.nodeValue.split(/(\s+)/);
    const words = parts.filter((x) => x && !/^\s+$/.test(x)).length;
    if (cutDone) {
      if (keepFirst) t.nodeValue = '';
      continue;
    }
    if (seen + words <= k) {
      seen += words;
      if (!keepFirst) t.nodeValue = '';
      if (seen === k) cutDone = true;
      continue;
    }
    // The cut falls inside this text node.
    let n = 0;
    let at = 0;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] && !/^\s+$/.test(parts[i])) n++;
      if (seen + n === k) {
        at = parts.slice(0, i + 1).join('').length;
        break;
      }
    }
    t.nodeValue = keepFirst ? t.nodeValue.slice(0, at) : t.nodeValue.slice(at).replace(/^\s+/, '');
    cutDone = true;
    seen = k;
  }
  // Drop now-empty inline elements.
  copy.querySelectorAll('a, strong, em, b, i, span, code').forEach((x) => !x.textContent.trim() && !x.querySelector('img') && x.remove());
  return copy;
}
const wordCount = (el) => (el.textContent.trim().match(/\S+/g) || []).length;

// Blocks that can carry over onto the next page, and how: paragraphs and quotes by words,
// lists by items, tables by rows (the header row repeats), code by lines. Each gives how many
// pieces it has, the fewest worth leaving on a page, and copies cut after the first k pieces.
function splitter(el) {
  const tag = el.tagName;
  if (tag === 'P' || tag === 'BLOCKQUOTE') {
    const n = wordCount(el);
    return n > 6 ? { n, min: 3, cut: (k, first) => cutWords(el, k, first) } : null;
  }
  if (tag === 'UL' || tag === 'OL') {
    const n = el.children.length;
    return n > 1
      ? {
          n,
          min: 1,
          cut: (k, first) => {
            const copy = el.cloneNode(false);
            [...el.children].slice(first ? 0 : k, first ? k : undefined).forEach((li) => copy.append(li.cloneNode(true)));
            if (tag === 'OL' && !first) copy.setAttribute('start', String((Number(el.getAttribute('start')) || 1) + k));
            return copy;
          }
        }
      : null;
  }
  if (tag === 'TABLE') {
    const rows = [...el.querySelectorAll(':scope > tbody > tr, :scope > tr')];
    return rows.length > 1
      ? {
          n: rows.length,
          min: 1,
          cut: (k, first) => {
            const copy = el.cloneNode(false);
            const head = el.querySelector(':scope > thead');
            if (head) copy.append(head.cloneNode(true));
            const body = document.createElement('tbody');
            rows.slice(first ? 0 : k, first ? k : undefined).forEach((tr) => body.append(tr.cloneNode(true)));
            copy.append(body);
            return copy;
          }
        }
      : null;
  }
  if (tag === 'PRE') {
    const lines = el.textContent.replace(/\n$/, '').split('\n');
    return lines.length > 1
      ? {
          n: lines.length,
          min: 2,
          cut: (k, first) => {
            const copy = el.cloneNode(false);
            const code = document.createElement('code');
            code.textContent = lines.slice(first ? 0 : k, first ? k : undefined).join('\n');
            copy.append(code);
            return copy;
          }
        }
      : null;
  }
  return null;
}
const isDeco = (n) => n.nodeType === 1 && n.classList.contains('page-deco');

export function pagedSpread({ left, head, body, foot, title, through = 0.5, extras = [], scraps = [], bodyClass = 'ruled prose' }) {
  // The little margin pieces (weather, postmark, verdict) come in a random order, decided
  // once so they don't jump about when the window is resized, and each is used only once.
  const order = extras.map((_, k) => k);
  for (let k = order.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [order[k], order[j]] = [order[j], order[k]];
  }
  let extraAt = 0;
  const nextExtra = () => (extraAt < order.length ? extras[order[extraAt++]] : null);
  // Photos and keepsakes, in their order: as many as fit under the map on the first page, then
  // one in the margin of each page of writing, then scrapbook pages for any still left.
  let carry = [];
  // Fill a space as tightly as it will go. Everything still waiting is tried in its order,
  // always at its own size; if one won't go, the next is tried, so a smaller thing fills a gap
  // a bigger one couldn't.
  const SIZES = [1];
  const pack = (box, fitsNow, mark, inOrder = false) => {
    let placed = 0;
    for (let k = 0; k < carry.length; ) {
      const el = carry[k]();
      if (!el) {
        carry.splice(k, 1);
        continue;
      }
      mark?.(el);
      box.append(el);
      const ok = SIZES.some((z) => {
        el.style.zoom = z === 1 ? '' : String(z);
        return fitsNow();
      });
      if (ok) {
        carry.splice(k, 1);
        placed++;
      } else {
        el.remove();
        if (inOrder) break;
        k++;
      }
    }
    return placed;
  };
  const fillLeft = (height, width) => {
    [...left.children].forEach((c) => c.dataset.scrap && c.remove());
    const probe = h('div', { class: 'page left probe', 'aria-hidden': 'true' });
    probe.style.height = height + 'px';
    probe.style.width = width + 'px';
    spread.append(probe);
    probe.append(left);
    carry = [...scraps];
    pack(left, () => probe.scrollHeight <= probe.clientHeight + 1, (el) => (el.dataset.scrap = '1'));
    probe.remove();
  };
  const scrapDeco = () => {
    while (carry.length) {
      const el = carry.shift()();
      if (!el) continue;
      el.classList.add('scrap-deco');
      if (el.classList.contains('wristband')) el.classList.add('deco-wide');
      if (el.classList.contains('floppy-doodle')) el.classList.add('deco-floppy');
      return el;
    }
    return null;
  };
  const spread = h('div', { class: 'spread paged' });
  // The book's thickness: pages already read pile up on the left, the rest on the right.
  const depth = (x) => Math.round(4 + 14 * Math.max(0, Math.min(1, x)));
  spread.style.setProperty('--ld', depth(through) + 'px');
  spread.style.setProperty('--rd', depth(1 - through) + 'px');
  let pages = []; // each: element for a text page
  let at = 0; // which spread: 0 = map + first page, then pairs
  let ro = null;
  // Room left spare at the foot of each page. If a page still comes out too full (a font or a
  // picture that changed size after measuring), it grows and the pages are measured again.
  let slack = 8;

  const footer = (n) => h('span', { class: 'page-no hand', 'aria-hidden': 'true' }, `— ${n} —`);
  const turnBtn = (dir, label) =>
    h('button', { type: 'button', class: `page-turn ${dir}`, title: label, 'aria-label': label, onclick: (e) => (e.stopPropagation(), go(dir === 'next' ? 1 : -1)) }, h('span', { class: 'hand' }, dir === 'next' ? 'turn over ›' : '‹ back'));

  // Build the text pages by pouring the writing into page-sized boxes.
  const paginate = () => {
    const wbody = spread.closest('.wbody, .paper');
    if (!wbody) return;
    const H = Math.max(320, wbody.clientHeight);
    spread.style.height = H + 'px';
    const sp = getComputedStyle(spread);
    const ph = H - parseFloat(sp.paddingTop) - parseFloat(sp.paddingBottom);
    const probePage = h('div', { class: 'page right probe', 'aria-hidden': 'true' });
    probePage.style.height = ph + 'px';
    probePage.style.width = (spread.clientWidth - parseFloat(sp.paddingLeft) - parseFloat(sp.paddingRight) - 6) / 2 + 'px';
    const flow = h('div', { class: 'page-flow' });
    probePage.append(flow);
    spread.append(probePage);
    const cs = getComputedStyle(probePage);
    const room = ph - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - slack;
    extraAt = 0;
    fillLeft(ph, parseFloat(probePage.style.width));
    const fits = () => flow.scrollHeight <= room;
    // How many pages the writing fills on its own, to spread what's left evenly through them:
    // a long read gets them far apart, all the way through; a short one hasn't the pages, so
    // the rest gather together after the writing.
    flow.replaceChildren(...head.map((x) => x.cloneNode(true)), body.cloneNode(true));
    const textPages = Math.max(1, Math.ceil(flow.scrollHeight / Math.max(1, room)));
    const gaps = textPages - 1; // pages after the first, each with room for one
    const spaced = Math.min(carry.length, gaps);
    const plan = new Set(Array.from({ length: spaced }, (_, k) => 1 + Math.floor(((k + 0.5) * gaps) / spaced)));
    flow.replaceChildren();

    const blocks = [...body.children].map((b) => b.cloneNode(true));
    const out = [];
    let ruled = null;
    let tall = false; // this page holds something taller than a page, so it scrolls
    // Writing on the page so far (the margin piece doesn't count).
    const hasWriting = () => [...ruled.childNodes].some((n) => !isDeco(n));
    const start = (first) => {
      flow.replaceChildren();
      if (first) flow.append(...head.map((x) => x.cloneNode(true)));
      else flow.append(h('span', { class: 'hand cont' }, `${title}, continued`));
      ruled = h('div', { class: bodyClass });
      flow.append(ruled);
      // Later pages get something from the place tucked into the margin, so a long read
      // isn't a wall of text: the weather, Floppy, a postmark, a photo… one per page.
      if (!first) {
        const n = out.length; // this page's index (1 = the first continued page)
        const deco = (plan.has(n) && scrapDeco()) || nextExtra()?.();
        if (deco) {
          deco.classList.add('page-deco', n % 2 ? 'deco-right' : 'deco-left');
          ruled.append(deco);
        }
      }
    };
    const close = () => {
      out.push({ nodes: [...flow.childNodes], tall });
      tall = false;
    };
    start(true);
    const queue = [...blocks];
    // However odd the writing, this always finishes: every round places something or starts a
    // fresh page, and as a last resort the rest goes on one page that scrolls.
    let rounds = 0;
    while (queue.length) {
      if (++rounds > 3000) {
        ruled.append(...queue.splice(0));
        tall = true;
        break;
      }
      const b = queue.shift();
      ruled.append(b);
      if (fits()) continue;
      b.remove();
      const empty = !hasWriting();
      const sp = splitter(b);
      if (sp) {
        // Fit as much as we can here, carry the rest over.
        let lo = 0;
        let hi = sp.n - 1;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          const part = sp.cut(mid, true);
          ruled.append(part);
          const ok = fits();
          part.remove();
          if (ok) lo = mid;
          else hi = mid - 1;
        }
        // On a page with nothing else on it, take at least one piece so the writing moves on.
        const take = lo >= sp.min ? lo : empty ? Math.max(lo, 1) : 0;
        if (take) {
          const first = sp.cut(take, true);
          first.classList.add('carry');
          ruled.append(first);
          if (!fits()) tall = true;
          const rest = sp.cut(take, false);
          rest.classList.add('carried');
          queue.unshift(rest);
          close();
          start(false);
          continue;
        }
      }
      if (empty) {
        // Too big for a page of its own (a huge picture): it goes on a page that scrolls.
        ruled.append(b);
        tall = true;
        close();
        start(false);
        continue;
      }
      // Don't leave a heading alone at the foot of a page (unless it's all the page has, or
      // it would just move back and forth between pages for ever).
      const last = ruled.lastElementChild;
      const writing = [...ruled.children].filter((n) => !isDeco(n)).length;
      if (last && /^H[1-6]$/.test(last.tagName) && writing > 1) {
        last.remove();
        queue.unshift(last);
      }
      close();
      start(false);
      queue.unshift(b);
    }
    // Photos and keepsakes that found no margin go after the writing: first in whatever room
    // is left on its last page, then on scrapbook pages of their own, each filled before the next.
    let scrapPages = 0;
    if (carry.length) {
      const grid = h('div', { class: 'scrap-page' });
      flow.append(grid);
      pack(grid, fits);
      if (!grid.children.length) grid.remove();
      while (carry.length) {
        close();
        const more = h('div', { class: 'scrap-page' });
        flow.replaceChildren(h('span', { class: 'hand cont' }, scrapPages++ ? 'From the scrapbook, continued' : 'From the scrapbook'), more);
        if (!pack(more, fits)) {
          // Something taller than a whole page even at its smallest: it gets one to itself.
          more.append(carry.shift()());
          tall = true;
        }
      }
    }
    // The page links go at the end of the writing, on a new page if they don't fit.
    const tail = foot.map((x) => x.cloneNode(true));
    flow.append(...tail);
    if (!fits() && (scrapPages || hasWriting())) {
      tail.forEach((x) => x.remove());
      close();
      flow.replaceChildren(...tail);
    }
    close();
    probePage.remove();
    pages = out.map(({ nodes, tall: t }) => h('div', { class: 'page-flow' + (t ? ' tall' : '') }, ...nodes));
    at = Math.min(at, lastSpread());
    draw();
  };

  const lastSpread = () => Math.ceil((pages.length - 1) / 2);
  const pageEl = (side, content, n) => h('div', { class: `page ${side}${content?.classList.contains('tall') ? ' tall' : ''}` }, content, n ? footer(n) : null);

  const draw = () => {
    const step = lastSpread() ? (at / lastSpread()) * 3 : 0;
    spread.style.setProperty('--ld', depth(through) + Math.round(step) + 'px');
    spread.style.setProperty('--rd', Math.max(3, depth(1 - through) - Math.round(step)) + 'px');
    const parts = [];
    if (at === 0) {
      parts.push(h('div', { class: 'page left' }, left), h('div', { class: 'gutter', 'aria-hidden': 'true' }), pageEl('right', pages[0], pages.length > 1 ? 1 : 0));
    } else {
      const a = 1 + (at - 1) * 2;
      const lp = pages[a];
      const rp = pages[a + 1];
      parts.push(pageEl('left', lp, a + 1), h('div', { class: 'gutter', 'aria-hidden': 'true' }), rp ? pageEl('right', rp, a + 2) : h('div', { class: 'page right blank' }, h('span', { class: 'hand fin' }, '~ fin ~')));
    }
    spread.replaceChildren(...parts);
    spread.classList.toggle('at-first', at === 0);
    const [lpEl, , rpEl] = spread.children;
    if (at > 0) lpEl.append(turnBtn('prev', 'Turn back a page'));
    if (at < lastSpread()) rpEl.append(turnBtn('next', 'Turn the page'));
    else rpEl.append(h('span', { class: 'page-curl', 'aria-hidden': 'true' }));
    // Nothing may be cut off at the foot of a page: if it is, measure again with more to spare.
    requestAnimationFrame(() => {
      if (!spread.isConnected || slack >= 64) return;
      const over = [lpEl, rpEl].some((p) => p && p.querySelector(':scope > .page-flow') && !p.classList.contains('tall') && p.scrollHeight > p.clientHeight + 1);
      if (over) {
        slack += 14;
        paginate();
      }
    });
  };

  // ---- turning a page ----
  // The page you're turning is lifted from the spine and swung over to the other side, like
  // paper: its front on one side, the next page printed on its back, a shadow sweeping over
  // the page underneath. A drag moves it with your finger (or the mouse, from the curled
  // corner); let go past halfway, or with a flick, and it carries on over, otherwise it falls back.
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let leaf = null; // the page being turned right now
  const box = (el) => ({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
  const place = (el, r) => Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });

  const lift = (d) => {
    const next = Math.max(0, Math.min(lastSpread(), at + d));
    if (next === at) return null;
    leaf?.land();
    const before = at;
    const [oldL, , oldR] = spread.children;
    if (still() || !oldL || !oldR) {
      at = next;
      draw();
      return { to: (p, done) => done?.(), land() {}, settle(p, ok) { ok?.(); } };
    }
    const from = box(d > 0 ? oldR : oldL); // the side the page lifts from
    const onto = box(d > 0 ? oldL : oldR); // the side it lands on
    at = next;
    draw();
    const [newL, , newR] = spread.children;
    // The spine is halfway across the gap between the pages.
    const gap = d > 0 ? from.left - (onto.left + onto.width) : onto.left - (from.left + from.width);
    // The sheet is made of narrow strips hinged together, so it bends like paper as it turns:
    // the outer edge leads and the part by the spine follows. Each strip shows its slice of
    // the page on the front and of the next page on the back, shaded by how it faces the light.
    const W = from.width;
    const H = from.height;
    const N = W > 360 ? 7 : 5;
    const w = W / N;
    const frontPage = d > 0 ? oldR : oldL;
    const backPage = d > 0 ? newL : newR;
    const sheet = h('div', { class: 'leaf ' + (d > 0 ? 'to-left' : 'to-right'), 'aria-hidden': 'true' });
    place(sheet, from);
    const strips = [];
    const shades = [];
    // Each strip's two sides. Which one shows is switched here as the strip passes edge-on,
    // rather than left to backface-visibility: Firefox (and sometimes Safari) doesn't hide the
    // far side of a strip nested in other turning strips, and then the front's writing shows
    // through mirrored where the next page should be.
    const sides = [];
    let parent = sheet;
    for (let k = 0; k < N; k++) {
      // Which slice of each page this strip carries (counted from the spine outwards).
      const frontAt = d > 0 ? k * w : W - (k + 1) * w;
      const backAt = d > 0 ? W - (k + 1) * w : k * w;
      const face = (pageEl, at, isBack) => {
        const copy = pageEl.cloneNode(true);
        copy.classList.add('slice');
        Object.assign(copy.style, { left: -at + 'px', width: W + 'px', height: H + 'px' });
        const shade = h('span', { class: 'turn-shade' });
        shades.push(shade);
        return h('div', { class: 'face' + (isBack ? ' back' : '') }, copy, shade);
      };
      const front = face(frontPage, frontAt, false);
      const back = face(backPage, backAt, true);
      back.style.visibility = 'hidden';
      sides.push([front, back]);
      const strip = h('div', { class: 'strip' }, front, back);
      // A hair wider than its slice, so no seams show between strips.
      Object.assign(strip.style, { width: w + 0.6 + 'px', height: H + 'px', left: k === 0 ? (d > 0 ? '0px' : W - w + 'px') : d > 0 ? w + 'px' : -w + 'px' });
      // The first strip turns about the spine (halfway across the gap); the others about the
      // edge where they join the one before.
      strip.style.transformOrigin = k === 0 ? (d > 0 ? `${-gap / 2}px 50%` : `${w + gap / 2}px 50%`) : d > 0 ? '0 50%' : `${w}px 50%`;
      parent.append(strip);
      strips.push(strip);
      parent = strip;
    }
    // What the landing side showed before, until the page comes down over it.
    const under = h('div', { class: 'under', 'aria-hidden': 'true' }, d > 0 ? oldL : oldR);
    place(under, onto);
    // The shadow of the lifting page, on the page it uncovers and the one it falls onto.
    const castFrom = h('div', { class: 'turn-cast ' + (d > 0 ? 'spine-left' : 'spine-right'), 'aria-hidden': 'true' });
    const castOnto = h('div', { class: 'turn-cast ' + (d > 0 ? 'spine-right' : 'spine-left'), 'aria-hidden': 'true' });
    place(castFrom, from);
    place(castOnto, onto);
    spread.append(under, castOnto, castFrom, sheet);
    const sign = d > 0 ? -1 : 1;
    let p = 0;
    let raf = 0;
    let aim = 1; // where it's heading: 1 over, 0 back
    const set = (v) => {
      p = Math.max(0, Math.min(1, v));
      const arc = Math.sin(Math.PI * p);
      // How far round each strip is: the outer ones lead, by up to ~55° mid-turn.
      let prev = 0;
      strips.forEach((st, k) => {
        const total = Math.min(180, 180 * p + 55 * arc * Math.pow(k / (N - 1), 1.4));
        st.style.transform = `rotateY(${sign * (total - prev)}deg)`;
        prev = total;
        // Past edge-on, you're looking at the back of this strip: show that side only.
        const over = total > 90;
        sides[k][0].style.visibility = over ? 'hidden' : 'visible';
        sides[k][1].style.visibility = over ? 'visible' : 'hidden';
        // Facing you, a strip is lit; turned edge-on, it's in shadow.
        const dark = (1 - Math.abs(Math.cos((total * Math.PI) / 180))) * 0.5;
        shades[k * 2].style.opacity = shades[k * 2 + 1].style.opacity = dark.toFixed(3);
      });
      castFrom.style.opacity = (p < 0.5 ? arc * 0.7 : arc * 0.35).toFixed(3);
      castOnto.style.opacity = (p > 0.5 ? arc * 0.6 : 0).toFixed(3);
    };
    const clear = () => {
      cancelAnimationFrame(raf);
      [sheet, under, castFrom, castOnto].forEach((x) => x.remove());
      if (leaf === ctl) leaf = null;
    };
    // Glide to `to` (1 = turned, 0 = back where it was), then call done.
    const to = (target, done) => {
      cancelAnimationFrame(raf);
      const start = p;
      const ms = Math.max(140, 680 * Math.abs(target - start));
      const t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        set(start + (target - start) * ease);
        if (k < 1) raf = requestAnimationFrame(tick);
        else done?.();
      };
      raf = requestAnimationFrame(tick);
    };
    const ctl = {
      to,
      set,
      get p() {
        return p;
      },
      // Finish straight away (another turn started before this one was done).
      land() {
        clear();
        if (aim === 0) {
          at = before;
          draw();
        }
      },
      // Let go of a drag: over it goes, or back it falls (and the spread is as it was).
      settle(turn, ok) {
        aim = turn ? 1 : 0;
        to(aim, () => ctl.land(ok?.()));
      }
    };
    set(0);
    leaf = ctl;
    return ctl;
  };

  const go = (d) => {
    const turn = lift(d);
    if (!turn) return;
    sound.page();
    turn.settle(true);
  };

  const onKey = (e) => {
    if (!spread.isConnected) return document.removeEventListener('keydown', onKey);
    // On a computer only the window in front turns its pages; a tablet's keyboard works too.
    if ((spread.closest('.dw') && !spread.closest('.dw.active')) || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    if (document.querySelector('.pv-back')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
    else return;
    e.preventDefault();
  };
  document.addEventListener('keydown', onKey);

  // Turning by hand: a finger anywhere on the pages, or the mouse from a curled corner.
  let drag = null;
  let dragged = 0;
  spread.addEventListener('pointerdown', (e) => {
    if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest('.leaflet-container, input, textarea, select')) return;
    if (e.pointerType === 'mouse' && !e.target.closest('.page-turn')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, d: 0, turn: null, w: 1, last: [e.clientX, e.timeStamp], speed: 0 };
  });
  spread.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.turn) {
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.3) {
        if (Math.abs(dy) > 24) drag = null; // scrolling a tall page, not turning
        return;
      }
      drag.d = dx < 0 ? 1 : -1;
      drag.turn = lift(drag.d);
      if (!drag.turn) return (drag = null);
      drag.w = (spread.querySelector(':scope > .page.right') || spread).offsetWidth || 300;
      try {
        spread.setPointerCapture(e.pointerId);
      } catch {}
    }
    const dt = Math.max(1, e.timeStamp - drag.last[1]);
    drag.speed = (e.clientX - drag.last[0]) / dt; // px per ms
    drag.last = [e.clientX, e.timeStamp];
    drag.turn.set((-drag.d * dx) / (drag.w * 1.6));
  });
  const letGo = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { turn, d, speed } = drag;
    drag = null;
    if (!turn) return;
    dragged = performance.now();
    // Past halfway, or a quick flick the right way, and the page goes over.
    const over = e.type !== 'pointercancel' && (turn.p > 0.45 || -d * speed > 0.45);
    if (over) sound.page();
    turn.settle(over);
  };
  spread.addEventListener('pointerup', letGo);
  spread.addEventListener('pointercancel', letGo);
  // A drag that ends on the curled corner isn't also a click on it.
  spread.addEventListener('click', (e) => performance.now() - dragged < 400 && (e.stopPropagation(), e.preventDefault()), true);

  const mount = () => {
    if (!spread.isConnected) return requestAnimationFrame(mount);
    paginate();
    // Handwriting fonts change how much fits on a page, so measure again once they've loaded.
    document.fonts?.ready.then(() => spread.isConnected && paginate());
    const wbody = spread.closest('.wbody, .paper');
    if (wbody && 'ResizeObserver' in window) {
      let t;
      let lastH = wbody.clientHeight;
      let lastW = wbody.clientWidth;
      ro = new ResizeObserver(() => {
        if (!spread.isConnected) return ro.disconnect();
        if (wbody.clientHeight === lastH && wbody.clientWidth === lastW) return;
        lastH = wbody.clientHeight;
        lastW = wbody.clientWidth;
        clearTimeout(t);
        t = setTimeout(paginate, 120);
      });
      ro.observe(wbody);
    }
  };
  // A plain version first (so nothing flashes empty), then the measured pages.
  spread.append(h('div', { class: 'page left' }, left), h('div', { class: 'gutter', 'aria-hidden': 'true' }), h('div', { class: 'page right' }, h('div', { class: 'page-flow' }, ...head, body, ...foot)));
  requestAnimationFrame(mount);
  return spread;
}
