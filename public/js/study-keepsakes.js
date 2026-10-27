// Keepsakes for studying and for work (thoughts, and a few for books): flashcards, a marked
// essay, a revision timetable, an exam slip… and an ID badge, a time card, a meeting invite,
// an out-of-office note, a business card…
import { h } from './util.js';

const wrapOf = (kind, aria, ...kids) => h('div', { class: 'ticket-wrap ' + kind }, h('div', { class: 'ks ks-' + kind, role: 'group', 'aria-label': aria }, ...kids));
const lines = (list) => list.map((o) => o.item);
const spans = (list) => list.map((t) => h('span', null, t));
const note = (list, fallback) => {
  const w = list.length ? lines(list) : fallback ? [fallback] : [];
  return w.length ? h('span', { class: 'pf-note' }, spans(w)) : null;
};
function hash(str) {
  let n = 2166136261;
  for (let i = 0; i < str.length; i++) n = Math.imul(n ^ str.charCodeAt(i), 16777619);
  return n >>> 0;
}
const pad = (n) => String(n).padStart(2, '0');
const when = (post) => new Date(post.ts || Date.now());
const dayLong = (post) => when(post).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const firstNumber = (list, fallback) => {
  const m = /(\d[\d,.:]*)/.exec(list?.[0]?.item || '');
  return m ? m[1] : fallback;
};
const art = (kind, aria, svg, list, fallback) => wrapOf(kind, aria, h('span', { class: 'mm-art', 'aria-hidden': 'true', html: svg }), note(list, fallback));

// ================= Studying =================

// A flashcard: the question on the first line, the answer on the second.
function flashcardKeepsake(post) {
  const [q, a] = [post.flashcard[0]?.item || 'Key term?', post.flashcard[1]?.item || '…and the answer'];
  return wrapOf('flashcard', 'Flashcard', h('span', { class: 'fc3-q' }, h('small', null, 'Q'), q), h('span', { class: 'fc3-a' }, h('small', null, 'A'), a), ...post.flashcard.slice(2).map((o) => h('span', { class: 'fc3-more' }, o.item)));
}
// A line run through with highlighter.
const HIGHLIGHT = ['#fff35c', '#9dff8a', '#ff9ad5', '#8ad8ff', '#ffc46b'];
function highlighterKeepsake(post) {
  const rows = post.highlighter.length ? lines(post.highlighter) : ['the bit that will be in the exam'];
  return wrapOf('highlighter', 'Highlighted', h('span', { class: 'hl-page' }, rows.map((t, k) => h('mark', { style: { '--hl': HIGHLIGHT[(hash(post.slug) + k) % HIGHLIGHT.length] } }, t))), h('span', { class: 'hl-pen', 'aria-hidden': 'true', style: { '--hl': HIGHLIGHT[hash(post.slug) % HIGHLIGHT.length] } }));
}
// Coloured page tabs sticking out of a book.
function pagetabsKeepsake(post) {
  const tabs = post.pagetabs.length ? lines(post.pagetabs) : ['Ch. 3', 'Key case', 'Exam!'];
  return wrapOf('pagetabs', 'Page tabs', h('span', { class: 'pt2-book', 'aria-hidden': 'true' }), h('span', { class: 'pt2-tabs' }, tabs.slice(0, 6).map((t, k) => h('span', { class: 'pt2-tab', style: { '--tc': HIGHLIGHT[k % HIGHLIGHT.length], '--k': k } }, t))));
}
// A week's revision timetable, the subjects in your lines, a few slots ticked off.
function timetableKeepsake(post) {
  const subjects = post.timetable.length ? lines(post.timetable).slice(0, 5) : ['Reading', 'Notes', 'Practice'];
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = (when(post).getDay() + 6) % 7;
  return wrapOf('timetable', 'Revision timetable', h('span', { class: 'tt3-head' }, 'REVISION TIMETABLE'), h('span', { class: 'tt3-grid', style: { '--cols': days.length } }, h('span'), days.map((d, k) => h('b', { class: k === today ? 'now' : '' }, d)), subjects.flatMap((s, r) => [h('em', null, s), ...days.map((_, k) => h('i', { class: k < today && hash(post.slug + r + k) % 3 ? 'done' : k === today && r === 0 ? 'now' : '' }))])));
}
// The slip you get for an exam: candidate number, paper, "silence please".
function examslipKeepsake(post) {
  const no = String((hash(post.slug) % 9000) + 1000);
  return wrapOf('examslip', 'Exam slip', h('span', { class: 'ex-head' }, 'EXAMINATION · CANDIDATE COPY'), h('span', { class: 'ex-row' }, h('small', null, 'Candidate Nº'), h('b', null, no)), h('span', { class: 'ex-row' }, h('small', null, 'Paper'), h('b', null, post.examslip[0]?.item || 'Paper 1')), h('span', { class: 'ex-row' }, h('small', null, 'Date'), h('b', null, dayLong(post))), ...post.examslip.slice(1).map((o) => h('span', { class: 'ex-note' }, o.item)), h('span', { class: 'ex-quiet' }, 'SILENCE PLEASE · TURN OVER WHEN TOLD'));
}
// A tomato timer, with a tally of the sessions done.
function pomodoroKeepsake(post) {
  const n = Math.max(1, Math.min(12, parseInt(firstNumber(post.pomodoro, '4'), 10) || 4));
  const svg = '<svg viewBox="0 0 80 80" width="74" height="74"><circle cx="40" cy="46" r="30" fill="#e8433a"/><ellipse cx="30" cy="36" rx="8" ry="5" fill="#fff" opacity=".25"/><path d="M40 16c-4-6-12-6-14-2 6 0 10 4 14 6 4-2 8-6 14-6-2-4-10-4-14 2z" fill="#3a9a3a"/><path d="M40 16v-6" stroke="#2a6a2a" stroke-width="3" stroke-linecap="round"/><text x="40" y="52" text-anchor="middle" font-family="Share Tech Mono, monospace" font-size="14" fill="#fff">25:00</text></svg>';
  return wrapOf('pomodoro', 'Pomodoro timer', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: svg }), h('span', { class: 'pf-note' }, h('span', null, `${n} pomodoro${n === 1 ? '' : 's'}`), h('span', { class: 'po-tally', 'aria-hidden': 'true' }, '🍅'.repeat(n)), ...spans(lines(post.pomodoro.slice(/\d/.test(post.pomodoro[0]?.item || '') ? 1 : 0)))));
}
const DESKLAMP = '<svg viewBox="0 0 90 100" width="80" height="90"><path d="M20 30L60 10" stroke="#2b2b2b" stroke-width="4"/><path d="M20 30L34 76" stroke="#2b2b2b" stroke-width="4"/><path d="M50 4l26 14-10 14-26-14z" fill="#2f7a4f"/><path d="M66 32q-6 30 10 60" fill="#fff6c8" opacity=".5"/><path d="M58 30l20 10" stroke="#fff6c8" stroke-width="2" opacity=".9"/><rect x="18" y="76" width="34" height="8" rx="3" fill="#2b2b2b"/><circle cx="20" cy="30" r="4" fill="#9aa1a8"/></svg>';
function librarypassKeepsake(post) {
  return wrapOf('librarypass', 'Library pass', h('span', { class: 'lp-head' }, h('b', null, 'LIBRARY'), h('small', null, 'READER’S PASS')), h('span', { class: 'lp-photo', 'aria-hidden': 'true' }), h('span', { class: 'lp-lines' }, h('small', null, post.librarypass[0]?.item || 'Reading room'), h('small', null, 'Valid ' + when(post).getFullYear()), h('span', { class: 'lp-code', 'aria-hidden': 'true' })));
}
// A marked essay: the grade circled in red pen, with a comment.
function gradeKeepsake(post) {
  const mark = post.grade[0]?.item || 'A';
  return wrapOf('grade', 'Marked work', h('span', { class: 'gr-lines', 'aria-hidden': 'true' }), h('span', { class: 'gr-mark' }, mark.slice(0, 8)), h('span', { class: 'gr-comment' }, spans(post.grade.length > 1 ? lines(post.grade.slice(1)) : ['Well argued!'])), h('span', { class: 'gr-tick', 'aria-hidden': 'true' }, '✓'));
}
// An index card for a case (or a key reading): the name on top, your notes underneath.
function casecardKeepsake(post) {
  const name = post.casecard[0]?.item || 'Smith v Jones';
  const [a, b] = name.split(/\s+v\.?\s+/i);
  return wrapOf('casecard', 'Case card', h('span', { class: 'cc2-name' }, b ? [h('i', null, a), ' v ', h('i', null, b)] : h('i', null, name)), h('ul', { class: 'cc2-notes' }, (post.casecard.length > 1 ? lines(post.casecard.slice(1)) : ['Facts', 'Held', 'Why it matters']).map((t) => h('li', null, t))));
}
// A mind map: the first line in the middle, the rest branching off.
function mindmapKeepsake(post) {
  const centre = post.mindmap[0]?.item || 'Big idea';
  const twigs = post.mindmap.length > 1 ? lines(post.mindmap.slice(1, 7)) : ['why?', 'how?', 'so what?'];
  const pos = twigs.map((_, k) => {
    const a = (k / twigs.length) * Math.PI * 2 - Math.PI / 2;
    return [50 + Math.cos(a) * 38, 50 + Math.sin(a) * 34];
  });
  const svg = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${pos.map(([x, y]) => `<path d="M50 50Q${(50 + x) / 2 + 4} ${(50 + y) / 2 - 4} ${x} ${y}" stroke="#24305c" stroke-width=".8" fill="none"/>`).join('')}</svg>`;
  return wrapOf('mindmap', 'Mind map', h('span', { class: 'mmp-lines', html: svg }), h('span', { class: 'mmp-centre' }, centre), twigs.map((t, k) => h('span', { class: 'mmp-twig', style: { left: pos[k][0] + '%', top: pos[k][1] + '%' } }, t)));
}
function revisionlistKeepsake(post) {
  const rows = post.revisionlist.length ? lines(post.revisionlist) : ['Read the notes', 'Make flashcards', 'Past paper'];
  return wrapOf('revisionlist', 'Revision checklist', h('span', { class: 'rv-head' }, 'to revise:'), h('ul', { class: 'rv-rows' }, rows.map((t, k) => h('li', { class: hash(post.slug + k) % 3 ? 'done' : '' }, h('i', { 'aria-hidden': 'true' }), t))));
}
const PENCIL = '<svg viewBox="0 0 160 30" width="150" height="28"><path d="M20 6h110v18H20z" fill="#f6c23c"/><path d="M20 6h110v6H20z" fill="#ffd96b"/><path d="M130 6l22 9-22 9z" fill="#f0d2a8"/><path d="M146 13l6 2-6 2z" fill="#2b2b2b"/><rect x="6" y="6" width="14" height="18" fill="#9aa1a8"/><rect x="0" y="6" width="8" height="18" rx="3" fill="#e8798a"/></svg>';
function calculatorKeepsake(post) {
  const shown = (post.calculator[0]?.item || String((hash(post.slug) % 900) + 100)).slice(0, 10);
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];
  return wrapOf('calculator', 'Calculator', h('span', { class: 'ca-body' }, h('b', { class: 'ca-lcd' }, shown), h('span', { class: 'ca-keys', 'aria-hidden': 'true' }, keys.map((k) => h('i', null, k)))), note(post.calculator.slice(1)));
}
function gradcapKeepsake(post) {
  const svg = '<svg viewBox="0 0 100 80" width="92" height="74"><path d="M50 8L96 26 50 44 4 26z" fill="#1a1a1a"/><path d="M24 34v18c0 8 52 8 52 0V34L50 44z" fill="#2b2b2b"/><path d="M50 26L84 34v22" stroke="#e2b04a" stroke-width="2" fill="none"/><path d="M80 56h8l-2 14h-4z" fill="#e2b04a"/><circle cx="50" cy="26" r="3" fill="#e2b04a"/></svg>';
  return wrapOf('gradcap', 'Graduation cap', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: svg }), h('span', { class: 'pf-note' }, h('b', null, post.gradcap[0]?.item || `Class of ${when(post).getFullYear()}`), ...spans(lines(post.gradcap.slice(1)))));
}
// A rolled certificate tied with a ribbon.
function diplomaKeepsake(post) {
  return wrapOf('diploma', 'Certificate', h('span', { class: 'dp-roll', 'aria-hidden': 'true' }), h('span', { class: 'dp-sheet' }, h('small', null, 'THIS IS TO CERTIFY THAT'), h('b', null, post.diploma[0]?.item || 'the course is complete'), ...lines(post.diploma.slice(1)).map((t) => h('small', { class: 'dp-line' }, t)), h('span', { class: 'dp-seal', 'aria-hidden': 'true' }, '★')));
}
function stopwatchKeepsake(post) {
  const hrs = firstNumber(post.stopwatch, String(2 + (hash(post.slug) % 6)));
  const svg = '<svg viewBox="0 0 80 90" width="72" height="82"><rect x="34" y="2" width="12" height="8" rx="2" fill="#9aa1a8"/><path d="M62 18l6-6" stroke="#9aa1a8" stroke-width="4" stroke-linecap="round"/><circle cx="40" cy="52" r="34" fill="#e9eef3" stroke="#4a5562" stroke-width="5"/><path d="M40 52V26" stroke="#c0392b" stroke-width="2.5" stroke-linecap="round" transform="rotate(130 40 52)"/><circle cx="40" cy="52" r="3" fill="#2b2b2b"/>' + Array.from({ length: 12 }, (_, k) => `<path d="M40 22v4" stroke="#4a5562" stroke-width="1.5" transform="rotate(${k * 30} 40 52)"/>`).join('') + '</svg>';
  return wrapOf('stopwatch', 'Study stopwatch', h('span', { class: 'mm-art', 'aria-hidden': 'true', html: svg }), h('span', { class: 'pf-note' }, h('b', null, `${hrs} hours studied`), ...spans(lines(post.stopwatch.slice(/\d/.test(post.stopwatch[0]?.item || '') ? 1 : 0)))));
}
// A page of lecture notes, with a doodle in the margin.
function lecturenotesKeepsake(post) {
  const rows = post.lecturenotes.length > 1 ? lines(post.lecturenotes.slice(1)) : ['key point', '→ another one', '!! exam'];
  return wrapOf('lecturenotes', 'Lecture notes', h('span', { class: 'ln-head' }, h('b', null, post.lecturenotes[0]?.item || 'Lecture'), h('small', null, `${pad(when(post).getDate())}/${pad(when(post).getMonth() + 1)}`)), h('ul', { class: 'ln-rows' }, rows.map((t) => h('li', null, t))), h('span', { class: 'ln-doodle', 'aria-hidden': 'true' }, '☆'));
}
// A "do not disturb" sign for the door.
function doordndKeepsake(post) {
  return wrapOf('doordnd', 'Do not disturb', h('span', { class: 'dn-hole', 'aria-hidden': 'true' }), h('strong', { class: 'dn-big' }, 'DO NOT DISTURB'), h('span', { class: 'dn-why' }, post.doordnd[0]?.item || 'revising!'), ...lines(post.doordnd.slice(1)).map((t) => h('span', { class: 'dn-why small' }, t)));
}
function readinglistKeepsake(post) {
  const rows = post.readinglist.length ? lines(post.readinglist) : ['Chapter 1', 'The article', 'Lecture slides'];
  return wrapOf('readinglist', 'Reading list', h('span', { class: 'rd-clip', 'aria-hidden': 'true' }), h('span', { class: 'rd-head' }, 'READING LIST'), h('ol', { class: 'rd-rows' }, rows.map((t, k) => h('li', { class: k < rows.length - 1 && hash(post.slug + 'r' + k) % 2 ? 'done' : '' }, t))));
}

// ================= Work =================

// A staff ID badge on a lanyard.
function idbadgeKeepsake(post) {
  return wrapOf('idbadge', 'ID badge', h('span', { class: 'ib-strap', 'aria-hidden': 'true' }), h('span', { class: 'ib-card' }, h('span', { class: 'ib-top' }, post.idbadge[1]?.item || 'STAFF'), h('span', { class: 'ib-photo', 'aria-hidden': 'true' }), h('b', null, post.idbadge[0]?.item || 'Visitor'), h('span', { class: 'ib-code', 'aria-hidden': 'true' })));
}
// A time card, clocked in and out.
function timecardKeepsake(post) {
  const t = when(post);
  const stamp = (hh, mm) => `${pad(hh)}:${pad(mm)}`;
  const m = /(\d{1,2})[:.](\d{2})\D+(\d{1,2})[:.](\d{2})/.exec(post.timecard[0]?.item || '');
  const [inn, out] = m ? [stamp(+m[1], +m[2]), stamp(+m[3], +m[4])] : [stamp(9, hash(post.slug) % 30), stamp(Math.max(10, t.getHours()), t.getMinutes())];
  return wrapOf('timecard', 'Time card', h('span', { class: 'tc2-head' }, 'TIME CARD'), h('span', { class: 'tc2-row' }, h('small', null, t.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()), h('b', null, `IN ${inn}`), h('b', { class: 'out' }, `OUT ${out}`)), note(post.timecard.slice(m ? 1 : 0)));
}
// A meeting invite, printed out.
function meetinginviteKeepsake(post) {
  const t = when(post);
  return wrapOf('meetinginvite', 'Meeting invite', h('span', { class: 'mi-bar' }, h('span', null, '📅 Meeting'), h('span', { class: 'mi-x', 'aria-hidden': 'true' }, '×')), h('strong', { class: 'mi-title' }, post.meetinginvite[0]?.item || 'Quick sync'), h('span', { class: 'mi-when' }, `${t.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} · ${pad(t.getHours())}:00`), ...lines(post.meetinginvite.slice(1)).map((t2) => h('span', { class: 'mi-line' }, t2)), h('span', { class: 'mi-btns', 'aria-hidden': 'true' }, h('i', null, 'Accept'), h('i', null, 'Maybe'), h('i', { class: 'no' }, 'Decline')));
}
function outofofficeKeepsake(post) {
  return wrapOf('outofoffice', 'Out of office', h('span', { class: 'oo-head' }, 'OUT OF OFFICE'), h('span', { class: 'oo-text' }, spans(post.outofoffice.length ? lines(post.outofoffice) : ['Back Monday.', 'Probably.'])), h('span', { class: 'oo-sun', 'aria-hidden': 'true' }, '☀'));
}
function businesscardKeepsake(post) {
  return wrapOf('businesscard', 'Business card', h('strong', { class: 'bc3-name' }, post.businesscard[0]?.item || 'Your Name'), h('span', { class: 'bc3-role' }, post.businesscard[1]?.item || 'Job title'), h('span', { class: 'bc3-rule', 'aria-hidden': 'true' }), ...lines(post.businesscard.slice(2)).map((t) => h('small', { class: 'bc3-line' }, t)));
}
function inboxzeroKeepsake(post) {
  const n = firstNumber(post.inboxzero, '0');
  return wrapOf('inboxzero', 'Inbox', h('span', { class: 'iz-bar' }, '✉ Inbox'), h('strong', { class: 'iz-n' }, n), h('span', { class: 'iz-sub' }, +n === 0 ? 'inbox zero!' : 'unread'), note(post.inboxzero.slice(/\d/.test(post.inboxzero[0]?.item || '') ? 1 : 0)));
}
const LAPTOP = '<svg viewBox="0 0 120 80" width="110" height="74"><rect x="18" y="6" width="84" height="54" rx="4" fill="#2b2b2b"/><rect x="23" y="11" width="74" height="44" fill="#1f3a6e"/><path d="M28 20h30M28 27h44M28 34h22M28 41h36" stroke="#8ad8ff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/><path d="M6 62h108l-8 12H14z" fill="#9aa1a8"/><rect x="50" y="64" width="20" height="3" rx="1.5" fill="#6d747b"/></svg>';
const BRIEFCASE = '<svg viewBox="0 0 100 80" width="90" height="72"><path d="M38 14v-6h24v6" fill="none" stroke="#5a3418" stroke-width="5"/><rect x="6" y="14" width="88" height="58" rx="6" fill="#8a5a2a"/><path d="M6 36h88" stroke="#5a3418" stroke-width="3"/><rect x="44" y="30" width="12" height="12" rx="2" fill="#e2b04a"/></svg>';
function deskplateKeepsake(post) {
  return wrapOf('deskplate', 'Desk name plate', h('span', { class: 'dk-plate' }, h('b', null, post.deskplate[0]?.item || 'THE BOSS'), post.deskplate[1] ? h('small', null, post.deskplate[1].item) : null), h('span', { class: 'dk-base', 'aria-hidden': 'true' }));
}
const STAPLER = '<svg viewBox="0 0 120 60" width="110" height="55"><path d="M10 46h96v8H10z" fill="#2b2b2b"/><path d="M14 44q0-18 20-22l66-8q8 0 8 8v14H14z" fill="#d6332b"/><path d="M20 30q10-6 30-8" stroke="#ff8a7a" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/><circle cx="22" cy="40" r="3" fill="#9aa1a8"/></svg>';
const PAPERCLIPS = '<svg viewBox="0 0 140 40" width="130" height="38">' + [0, 1, 2, 3].map((k) => `<path transform="translate(${k * 32} ${k % 2 ? 6 : 0}) rotate(${k % 2 ? 8 : -6} 20 20)" d="M10 12h26a6 6 0 0 1 0 12H12a4 4 0 0 1 0-8h22" fill="none" stroke="${['#9aa1a8', '#e8433a', '#3a86e8', '#f2b81c'][k]}" stroke-width="2.4" stroke-linecap="round"/>`).join('') + '</svg>';
// A typed memo.
function memoKeepsake(post) {
  const t = when(post);
  return wrapOf('memo', 'Memo', h('span', { class: 'me-head' }, 'MEMO'), h('span', { class: 'me-row' }, h('small', null, 'TO:'), post.memo[1]?.item || 'Everyone'), h('span', { class: 'me-row' }, h('small', null, 'DATE:'), t.toLocaleDateString('en-GB')), h('span', { class: 'me-row' }, h('small', null, 'RE:'), post.memo[0]?.item || 'Biscuits in the kitchen'), ...lines(post.memo.slice(2)).map((x) => h('span', { class: 'me-body' }, x)));
}
const WFH = '<svg viewBox="0 0 120 70" width="110" height="64"><path d="M8 50q0-14 16-14h20q10 0 10 10v8q0 6-6 6H14q-6 0-6-10z" fill="#f2c4d8"/><path d="M14 40q8-10 22-6" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/><path d="M62 50q0-14 16-14h20q10 0 10 10v8q0 6-6 6H68q-6 0-6-10z" fill="#f2c4d8"/><path d="M68 40q8-10 22-6" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/></svg>';
// "TGIF": the Friday feeling, stamped.
function tgifKeepsake(post) {
  return wrapOf('tgif', 'Friday!', h('span', { class: 'tg2-stamp' }, h('b', null, post.tgif[0]?.item || 'FRIDAY!'), h('small', null, 'WEEK DONE · CLOCKED OFF')), note(post.tgif.slice(1)));
}
// A deadline circled on a desk calendar.
function deadlineKeepsake(post) {
  const t = when(post);
  const day = parseInt(firstNumber(post.deadline, String(t.getDate())), 10) || t.getDate();
  const first = (new Date(t.getFullYear(), t.getMonth(), 1).getDay() + 6) % 7;
  const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(''), ...Array.from({ length: dim }, (_, k) => k + 1)];
  return wrapOf('deadline', 'Deadline', h('span', { class: 'dl-head' }, t.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase()), h('span', { class: 'dl-grid' }, cells.map((c) => h('i', { class: c === day ? 'due' : '' }, c ? String(c) : ''))), h('span', { class: 'dl-note' }, post.deadline.length > (/\d/.test(post.deadline[0]?.item || '') ? 1 : 0) ? lines(post.deadline.slice(/\d/.test(post.deadline[0]?.item || '') ? 1 : 0)).join(' · ') : 'DEADLINE!'));
}
function employeemonthKeepsake(post) {
  return wrapOf('employeemonth', 'Employee of the month', h('span', { class: 'em-frame' }, h('small', null, 'EMPLOYEE OF THE MONTH'), h('span', { class: 'em-photo', 'aria-hidden': 'true' }, '☺'), h('b', null, post.employeemonth[0]?.item || 'Me, obviously'), h('small', null, when(post).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }))));
}

const MAKERS = {
  flashcard: flashcardKeepsake, highlighter: highlighterKeepsake, pagetabs: pagetabsKeepsake, timetable: timetableKeepsake, examslip: examslipKeepsake, pomodoro: pomodoroKeepsake,
  desklamp: (p) => art('desklamp', 'Desk lamp', DESKLAMP, p.desklamp, 'Late one at the library.'),
  librarypass: librarypassKeepsake, grade: gradeKeepsake, casecard: casecardKeepsake, mindmap: mindmapKeepsake, revisionlist: revisionlistKeepsake,
  pencil: (p) => art('pencil', 'Pencil', PENCIL, p.pencil, 'Sharpened and ready.'),
  calculator: calculatorKeepsake, gradcap: gradcapKeepsake, diploma: diplomaKeepsake, stopwatch: stopwatchKeepsake, lecturenotes: lecturenotesKeepsake, doordnd: doordndKeepsake, readinglist: readinglistKeepsake,
  idbadge: idbadgeKeepsake, timecard: timecardKeepsake, meetinginvite: meetinginviteKeepsake, outofoffice: outofofficeKeepsake, businesscard: businesscardKeepsake, inboxzero: inboxzeroKeepsake,
  laptop: (p) => art('laptop', 'Laptop', LAPTOP, p.laptop, 'Heads down.'),
  briefcase: (p) => art('briefcase', 'Briefcase', BRIEFCASE, p.briefcase, 'Off to work.'),
  deskplate: deskplateKeepsake,
  stapler: (p) => art('stapler', 'Stapler', STAPLER, p.stapler, 'Don’t touch my stapler.'),
  paperclips: (p) => art('paperclips', 'Paperclips', PAPERCLIPS, p.paperclips, 'Holding it together.'),
  memo: memoKeepsake,
  wfh: (p) => art('wfh', 'Working from home', WFH, p.wfh, 'Working from home today.'),
  tgif: tgifKeepsake, deadline: deadlineKeepsake, employeemonth: employeemonthKeepsake
};
export const STUDY_WORK_KEEPSAKES = Object.keys(MAKERS);
export function studyMakers(post) {
  return Object.entries(MAKERS)
    .filter(([k]) => post[k])
    .map(([, make]) => () => make(post));
}
