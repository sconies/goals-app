// Rebuilds the backlog explorer page from docs/backlog.md.
// Usage: node scripts/backlog-page.mjs [--json] [--out file]
//   --json   write only the data (JSON) to the output
//   --out    where to write (default: faro-backlog-explorer.html in the system temp folder)
// The page template is scripts/backlog-page.template.html; its data marker is replaced by the JSON.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const md = fs.readFileSync(path.join(root, 'docs/backlog.md'), 'utf8');

const sections = {};
let current = '';
for (const line of md.split('\n')) {
  if (line.startsWith('## ')) { current = line.slice(3).trim(); sections[current] = []; }
  else if (current) sections[current].push(line);
}
const find = (prefix) => Object.keys(sections).find((k) => k.startsWith(prefix));
const cells = (l) => l.slice(1, -1).split(/(?<!\\)\|/).map((s) => s.trim());
const rowsOf = (name) =>
  (sections[name] || []).filter((l) => l.startsWith('|') && !/^\|\s*(-|#|ID|Item|Finding)/.test(l) && !l.startsWith('|---')).map(cells);

const strip = (s) => s.replace(/\*\*/g, '').replace(/`/g, '').replace(/\*/g, '');
const firstSentence = (s) => {
  const t = strip(s).replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.{20,220}?[.:?])(\s|$)/);
  return (m ? m[1] : t.slice(0, 200)).replace(/[.:]$/, '');
};

const AREAS = [
  ['reviews', /\breview(s|ed)?\b|agenda|walkthrough|\bRS\b|\bLP\b/i],
  ['metrics', /metric|baseline|guardrail|\bMQ|\bMS\b|\bGB\b|\bBL\b|\bGR\b|source|reading/i],
  ['check-in', /check-in|checks? in|habit|rhythm|cadence|loop|\bNR\b|\bMC\b|\bFT4\b/i],
  ['import', /import|spreadsheet|workbook|bulk|\bMI\b|\bBT\b|\bTG\b|fields?\b/i],
  ['kit', /\bkit\b|spec\b|drill|rebuild|handoff|\bKT\b|\bKL\b|\b8c\b|\bAS\b|\b11\b|\bR5\b|contract/i],
  ['platform', /migration|database|fence|schema|scale|\bAX\b|\b0c|MCP|token|workspace through|sign-in|time zone|\bTN\b|\bSK\b|evals|test/i],
  ['design', /redesign|\bRD2?\b|\bUX|header|footer|goal row|navigation|\bNAV\b|\b0a\b|\bGD\b|\bLV\b|phone|pattern|small workspace|\bSM/i],
];
const AREA_BY_ID = {
  UX2b: 'design', UX4: 'design', 'UX2a (leftovers)': 'design', 'UX (later)': 'design', '0c2': 'platform', TN: 'platform', SK: 'platform',
  "Deep dive's setup ideas": 'goals', '3a': 'reviews', '0t': 'platform', WM: 'platform', R: 'reviews', RD: 'design', RD2: 'design',
  AS: 'kit', AX: 'platform', LP: 'reviews', 'LV, GD, NAV, 0a, 0u': 'design', '11': 'kit', MC: 'check-in', FT4: 'check-in',
  'PF1–PF2': 'reviews', 'Review lows': 'kit', 'Import and spreadsheet leftovers': 'import', 'Rebuild follow-ups': 'kit',
  Ideas: 'goals', 'R1–R4': 'platform', '0b': 'metrics', '0c': 'platform', '8c': 'platform', FD: 'platform', KT: 'kit', KL: 'kit',
  AD: 'check-in', SM1h: 'design', NR: 'metrics', SM: 'design', BT: 'import', MI: 'import', GB: 'metrics', BL: 'metrics', MS: 'metrics',
  GR: 'metrics', MQ: 'metrics', MQ2: 'metrics', MQ2a: 'metrics', MQ2b: 'metrics', TG: 'import', '0v': 'check-in', RS: 'reviews',
  R5: 'kit', L: 'check-in', R4: 'check-in',
};
const areaOf = (id, text) => {
  if (AREA_BY_ID[id]) return AREA_BY_ID[id];
  const hay = text.slice(0, 160);
  for (const [a, re] of AREAS) if (re.test(hay)) return a;
  return 'goals';
};

const linksOf = (text) => {
  const out = [];
  const seen = new Set();
  const add = (label, href) => { if (!seen.has(href)) { seen.add(href); out.push({ label, href }); } };
  for (const m of text.matchAll(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g)) add(m[1], m[2]);
  for (const m of text.matchAll(/https:\/\/[^\s)`|,]+/g)) add(m[0].replace(/^https:\/\//, '').slice(0, 48), m[0].replace(/[.;]+$/, ''));
  for (const m of text.matchAll(/(?:PRs?|PR\s*\(?[^#)]*\)?:?\s*)?#(\d{2,4})\b/g)) add('#' + m[1], 'https://github.com/sconies/goals-app/pull/' + m[1]);
  for (const m of text.matchAll(/`((?:docs|spec|src|scripts|supabase)\/[^`\s]+?)`/g)) {
    const p = m[1].replace(/[:.,]+$/, '');
    add(p, 'https://github.com/sconies/goals-app/blob/main/' + p);
  }
  return out.slice(0, 14);
};

const STATE_WORDS = { building: 'Approved and building', 'not picked': 'Not picked', deferred: 'Deferred', idea: 'Idea', 'spec only': 'Spec only', check: 'Check', done: 'Done' };
const stateOf = (s) => {
  const t = s.toLowerCase();
  if (t.startsWith('approved and building')) return 'building';
  if (t.includes('replaced by rd')) return 'check';
  if (t.startsWith('check')) return 'check';
  if (t.startsWith('not picked')) return 'not picked';
  if (t.startsWith('deferred')) return 'deferred';
  if (t.startsWith('idea')) return 'idea';
  if (t.startsWith('spec only')) return 'spec only';
  return 'check';
};

// Source text for each open id: the Build row, the usability list, or a deferred bullet.
const buildRows = rowsOf('Build, in order');
const bySource = {};
for (const r of buildRows) bySource[r[0]] = r.slice(1).join(' · ');
const sourceText = (id) => {
  const ids = id.split(/[,\s–]+/).filter(Boolean);
  const parts = [];
  const SRC = { 'UX (later)': /^\*\*Later/, 'UX2a (leftovers)': /UX2a/, "Deep dive's setup ideas": /four-goal cap|team leads in setup|per-goal team choice/ };
  if (SRC[id]) return [...(sections[find('Usability study')] || []), ...(sections[find('Deep dive')] || [])].filter((l) => SRC[id].test(l.replace(/^\d+\.\s*/, ''))).join('\n\n');
  for (const i of ids) if (bySource[i]) parts.push(`**${i}** ${bySource[i]}`);
  if (parts.length) return parts.join('\n\n');
  const lines = [];
  const scan = [find('Usability study'), find('Deferred'), find('Ideas'), find('Deep dive'), find('Spec only')].filter(Boolean);
  for (const sec of scan)
    for (const l of sections[sec]) if (l.includes(id) || ids.some((i) => /\d/.test(i) && i.length > 2 && l.includes(i))) lines.push(l.replace(/^[-\d.\s]+/, ''));
  return lines.join('\n\n');
};

const items = [];
const openRows = rowsOf('Open');
for (const [id, what, effort, state] of openRows) {
  const st = stateOf(state);
  const full = sourceText(id) || what;
  items.push({
    id, title: firstSentence(what), summary: strip(what), effort: effort.replace(/\*/g, ''),
    state: st, stateNote: state, area: areaOf(id, what), text: `${what}\n\n${full === what ? '' : full}`.trim(),
    links: linksOf(full + ' ' + what),
  });
}
let n = 0;
for (const [item, shipped] of rowsOf('Done')) {
  const idm = item.match(/^\*\*([^*\s]{1,8})\*\*\s/);
  const id = idm ? idm[1] : '';
  const body = idm ? item.slice(idm[0].length) : item;
  const eff = body.match(/\*Effort:\*\s*([^.]*?)\./);
  items.push({
    id, title: firstSentence(body), summary: strip(body).slice(0, 240), effort: eff ? eff[1] : '',
    state: 'done', stateNote: shipped, area: areaOf(id, body), text: body + '\n\n**Shipped:** ' + shipped,
    links: linksOf(item + ' ' + shipped),
  });
}
const data = { generated: new Date().toISOString().slice(0, 10), states: STATE_WORDS, items };

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : path.join(os.tmpdir(), 'faro-backlog-explorer.html');
const json = JSON.stringify(data).replace(/</g, '\\u003c');
if (args.includes('--json')) fs.writeFileSync(out, JSON.stringify(data, null, 2));
else {
  const tpl = fs.readFileSync(path.join(here, 'backlog-page.template.html'), 'utf8');
  fs.writeFileSync(out, tpl.replace('/*BACKLOG_DATA*/null', json));
}
console.log(`${items.length} items (${openRows.length} open) -> ${out}`);
