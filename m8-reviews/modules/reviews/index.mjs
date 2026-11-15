// The Reviews module: registers into the core's extension points (../../modules.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { register } from '../../modules.mjs';
import * as RV from './rules.mjs';
import { reviewsExt } from './ext.mjs';
import { tools } from './tools.mjs';
import { pages } from './pages.mjs';

const csvCell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export const reviews = register({
  id: RV.ID,
  label: RV.LABEL,
  group: 'Working together',
  what: 'Walking a set of goals together on a cadence, deciding what happens next and keeping what was said.',
  routes: ['/review', '/reviews'],
  menu: { group: 0, id: 'reviews', href: '/reviews', label: 'Reviews' },
  tab: true,
  goalParam: 'review',
  help: ['reviews'],
  pageName(parts, params, R) {
    if (parts[0] === 'review') return 'Reviews';
    if (!parts[1]) return 'Reviews';
    if (parts[1] === 'new') return 'New review';
    const r = (R.W || globalThis.__W)?.reviews?.find((x) => x.id === parts[1] && !x.removedAt) || R.ext.reviewById?.(parts[1]);
    if (!r) return 'Review not found';
    if (parts[2] === 'edit') return `Change ${r.name}`;
    if (parts[2] === 'summary') return `${r.name}: summary`;
    if (parts[2] === 'print') return `${r.name}, to print`;
    return r.name;
  },
  goalPageName(g, params, R) { const r = R.ext.reviewById?.(params.get('review')); return r ? `${g.title} · ${r.name}` : g.title; },
  ext: (R, W) => reviewsExt(R, W),
  writes: (W, commit, input) => RV.writesReviews(W, commit, input),
  summary(W) { const n = (W.reviews || []).filter(RV.live).length; return `${n} review${n === 1 ? ' is' : 's are'} set up.`; },
  readBack: (W, wsName) => RV.switchOffLines(W, wsName),
  ownSheets: ['Notes'],
  // The workbook: a Notes sheet and a Review column on Asks while on; neither while off.
  sheets(W, sheets, on) {
    if (!on) return RV.sheetsWithReviews(false, sheets);
    const name = (id) => (W.reviews || []).find((r) => r.id === id)?.name || '';
    const out = sheets.map((s) => (s.name === 'Asks' ? { ...s, columns: [...s.columns, 'Review'], rows: s.rows.map((row, i) => [...row, name((W.requests || []).find((a) => a.id === s.ids?.[i])?.reviewId)]) } : s));
    const notes = (W.decisions || []).filter((d) => d.kind === 'note' && !d.removedAt);
    out.push({ name: 'Notes', columns: ['Goal', 'Review', 'Week', 'By', 'Note'], rows: notes.map((d) => [d.goalId, name(d.reviewId), d.week, d.byId, d.note]) });
    return out;
  },
  json: (W) => ({ notes: (W.decisions || []).filter((d) => d.kind === 'note' && !d.removedAt).map((d) => ({ id: d.id, goal: d.goalId, review: d.reviewId, week: d.week, note: d.note })) }),
  importNote: (on, wsName, file) => RV.importNote(on, wsName, file),
  tools,
  ...pages,
  // The drill's file for this module (spec/conformance/reviews.csv), written beside the core's.
  drillFiles(W, outDir) {
    const rows = RV.reviewsRows(W);
    fs.writeFileSync(path.join(outDir, 'reviews.csv'), [RV.REVIEWS_CSV_HEAD, ...rows.map((r) => RV.REVIEWS_CSV_HEAD.map((h) => r[h]))].map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
  },
});
