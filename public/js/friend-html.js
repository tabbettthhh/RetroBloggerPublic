// A friend's post arrives as HTML made by your own site from their text. Only plain formatting
// is let through: no pictures from elsewhere, no styles, nothing that runs. Links open in a new
// tab, and only ordinary web links survive.
import { h } from './util.js';

const KEEP = new Set(['P', 'BR', 'EM', 'STRONG', 'B', 'I', 'A', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'CODE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'DEL', 'S']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'svg', 'SVG', 'MATH', 'math', 'FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'IMG', 'VIDEO', 'AUDIO', 'PICTURE']);

export function friendHtml(html, cls = 'fr-text') {
  const doc = new DOMParser().parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
  const copy = (node) => {
    const out = [];
    for (const n of node.childNodes) {
      if (n.nodeType === 3) out.push(document.createTextNode(n.textContent));
      else if (n.nodeType === 1 && !DROP.has(n.tagName)) {
        if (KEEP.has(n.tagName)) {
          const el = document.createElement(n.tagName.toLowerCase());
          if (n.tagName === 'A') {
            const href = n.getAttribute('href') || '';
            if (/^https?:\/\//i.test(href)) Object.assign(el, { href, target: '_blank', rel: 'noopener noreferrer nofollow' });
          }
          el.append(...copy(n));
          out.push(el);
        } else out.push(...copy(n));
      }
    }
    return out;
  };
  return h('div', { class: cls }, doc.body.firstChild ? copy(doc.body.firstChild) : []);
}
