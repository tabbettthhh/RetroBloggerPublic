// Comments on posts. Visitors leave one with just a name (any name: nothing else about them is
// asked for or kept), or reply to another comment; each waits for the owner's approval in the
// back office. The owner's replies show under the comment they answer.
import { h, niceDate, storage } from './util.js';
import { withEmoticons } from './emoticons.js';
import { sound } from './sound.js';

const SHELF = ['books', 'films', 'podcasts', 'music', 'tv'];
// Where a post opens on its own (its comments are there).
export const postHref = (post) => (post.type === 'places' ? `#/journal/${post.slug}` : SHELF.includes(post.type) ? `#/${post.type}/${post.slug}` : `#/post/${post.type}/${post.slug}`);
const howMany = (n) => (n ? `${n} comment${n === 1 ? '' : 's'}` : 'Comment');
// (A visitor's name is remembered in this browser, so they needn't type it again.)
const names = storage('local');
const lastName = () => {
  try {
    return names?.getItem('comment-name') || '';
  } catch {
    return '';
  }
};

// On a card in the feed: how many comments, opening the post.
export function commentLink(post) {
  if (!Array.isArray(post?.comments)) return null;
  return h('a', { class: 'card-comments', href: postHref(post) }, h('span', { 'aria-hidden': 'true' }, '💬'), howMany(post.comments.length));
}

// The form: a name, the words, and a hidden field only bots fill in.
function commentForm(post, owner, replyTo, onDone) {
  const name = h('input', { class: 'cm-input', name: 'name', required: true, maxlength: 40, value: lastName(), placeholder: 'Any name you like', autocomplete: 'nickname', 'aria-label': 'Your name' });
  const message = h('textarea', { class: 'cm-input', name: 'message', required: true, maxlength: 1000, rows: 3, placeholder: replyTo ? 'Your reply…' : 'Say something nice…', 'aria-label': replyTo ? 'Your reply' : 'Your comment' });
  const trap = h('input', { name: 'website', tabindex: '-1', autocomplete: 'off', class: 'cm-trap', 'aria-hidden': 'true' });
  const note = h('p', { class: 'cm-note', role: 'status' });
  const send = h('button', { type: 'submit', class: 'xp-btn' }, replyTo ? 'Send reply' : 'Send comment');
  const form = h(
    'form',
    { class: 'cm-form' + (replyTo ? ' reply' : '') },
    h('label', { class: 'cm-label' }, 'Name', name),
    h('label', { class: 'cm-label' }, replyTo ? 'Reply' : 'Comment', message),
    trap,
    h('div', { class: 'cm-row' }, send, h('small', { class: 'cm-hint' }, `Only a name is needed. ${owner} sees it first, and it shows here once approved.`)),
    note
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    send.disabled = true;
    note.textContent = '';
    try {
      const res = await fetch('/api/comment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post: `${post.type}/${post.slug}`, name: name.value, message: message.value, reply_to: replyTo || '', website: trap.value }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'That didn’t send. Try again in a moment.');
      try {
        names?.setItem('comment-name', name.value.trim());
      } catch {}
      sound.chime?.();
      form.replaceWith(h('p', { class: 'cm-thanks', role: 'status' }, `Thanks, ${name.value.trim()}! ${owner} will see it soon, and it shows here once approved.`));
      onDone?.();
    } catch (err) {
      note.textContent = err.message;
      send.disabled = false;
    }
  });
  return form;
}

function oneComment(c, post, owner, replies) {
  const box = h('div', { class: 'cm-replybox' });
  const reply = h('button', { type: 'button', class: 'cm-reply-btn', 'aria-expanded': 'false' }, 'Reply');
  reply.addEventListener('click', () => {
    const open = reply.getAttribute('aria-expanded') === 'true';
    reply.setAttribute('aria-expanded', String(!open));
    box.replaceChildren(open ? '' : commentForm(post, owner, c.id));
    if (!open) box.querySelector('textarea')?.focus();
  });
  return h(
    'li',
    { class: 'cm-item', id: `comment-${c.id}` },
    h('div', { class: 'cm-head' }, h('span', { class: 'cm-avatar', 'aria-hidden': 'true' }, (c.name.trim()[0] || '?').toUpperCase()), h('b', null, c.name), h('small', null, niceDate(c.date, true))),
    h('p', { class: 'cm-text' }, withEmoticons(c.message, 15)),
    c.reply ? h('div', { class: 'cm-owner' }, h('div', { class: 'cm-head' }, h('span', { class: 'cm-avatar owner', 'aria-hidden': 'true' }, '★'), h('b', null, owner), h('small', { class: 'cm-badge' }, 'replied')), h('p', { class: 'cm-text' }, withEmoticons(c.reply, 15))) : null,
    replies.length ? h('ul', { class: 'cm-list replies' }, replies.map((r) => oneComment(r, post, owner, []))) : null,
    replies.length || c.reply_to ? null : reply,
    c.reply_to ? null : box
  );
}

// All of a post's comments, with replies under the comment they answer, and the form.
export function commentsBlock(post, data) {
  if (!Array.isArray(post?.comments)) return null;
  const owner = data?.site?.owner || data?.site?.name || 'The owner';
  const all = post.comments;
  const top = all.filter((c) => !c.reply_to || !all.some((x) => x.id === c.reply_to));
  const repliesTo = (id) => all.filter((c) => c.reply_to === id);
  // (Replies to a comment go under it; a reply button stays on comments with replies too.)
  const list = top.map((c) => {
    const li = oneComment(c, post, owner, repliesTo(c.id));
    if (repliesTo(c.id).length) {
      const box = h('div', { class: 'cm-replybox' });
      const btn = h('button', { type: 'button', class: 'cm-reply-btn', 'aria-expanded': 'false' }, 'Reply');
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        box.replaceChildren(open ? '' : commentForm(post, owner, c.id));
      });
      li.append(btn, box);
    }
    return li;
  });
  return h(
    'section',
    { class: 'comments', 'aria-label': 'Comments' },
    h('h3', { class: 'cm-title' }, h('span', { 'aria-hidden': 'true' }, '💬'), all.length ? howMany(all.length) : 'Comments'),
    list.length ? h('ul', { class: 'cm-list' }, list) : h('p', { class: 'cm-empty' }, 'No comments yet. Be the first!'),
    h('h4', { class: 'cm-leave' }, 'Leave a comment'),
    commentForm(post, owner, '')
  );
}

// For pages laid out like a book (a place in the journal, a review on the shelf): a button that
// opens the comments in a little window.
export function commentsButton(post, data) {
  if (!Array.isArray(post?.comments)) return null;
  const btn = h('button', { type: 'button', class: 'cm-open xp-btn' }, h('span', { 'aria-hidden': 'true' }, '💬'), post.comments.length ? howMany(post.comments.length) : 'Comments');
  btn.addEventListener('click', () => {
    const close = h('button', { type: 'button', class: 'cm-close', 'aria-label': 'Close comments' }, '×');
    const dlg = h('dialog', { class: 'cm-dialog', 'aria-label': `Comments on ${post.title || 'this post'}` }, close, h('div', { class: 'cm-dialog-body' }, commentsBlock(post, data)));
    close.addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => dlg.remove());
    dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());
    document.body.append(dlg);
    dlg.showModal();
  });
  return btn;
}
