// Help articles, read from the kit's Help guide (spec/core/help-guide.md): each "###" heading is an article.
import fs from 'node:fs';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SLUG = { 'Home and your week at a glance': 'home', 'Getting around': 'getting-around', 'Finding and choosing': 'finding', 'Checking in': 'check-in' };
export function helpArticles(file) {
  const text = fs.readFileSync(file, 'utf8');
  const out = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^### (.+)$/);
    if (m) { cur = { title: m[1].trim(), lines: [] }; out.push(cur); continue; }
    if (/^## /.test(line)) { cur = null; continue; }
    if (cur) cur.lines.push(line);
  }
  return out.map((a) => {
    const id = SLUG[a.title] || a.title.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const body = a.lines.join('\n');
    const summary = (a.lines.find((l) => l.trim() && !l.startsWith('#')) || '').replace(/[*`]/g, '').slice(0, 180);
    const html = a.lines.map((l) => (l.startsWith('#### ') ? `<h2>${esc(l.slice(5))}</h2>` : l.trim() ? `<p>${esc(l.replace(/[*`]/g, ''))}</p>` : '')).join('');
    return { id, title: a.title, text: body.replace(/[*`#]/g, ''), summary, html };
  });
}
