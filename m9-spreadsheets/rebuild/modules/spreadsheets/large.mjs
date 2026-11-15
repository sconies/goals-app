// A large file (more than 500 rows) is checked off the page's thread (IMPORT-LARGE): a worker runs the change engine
// over the file part by part, saying how far it has got and what it has found so far; Stop ends it and nothing is saved.
// The preview is then made from one full run (the engine, stage 2), so its result is the same a row-by-row scan gives.
import { Worker } from 'node:worker_threads';

const CHUNK = 1000;
export function startCheck(app, actor, tables, answers) {
  const flat = Object.fromEntries(Object.entries(tables).map(([k, rows]) => [k, rows.map((r) => ({ line: r.__line, row: { ...r } }))]));
  const total = Object.values(tables).reduce((n, t) => n + t.length, 0);
  const p = { total, read: 0, must: 0, questions: 0, done: false, error: null, started: Date.now() };
  p.worker = new Worker(new URL('./largeWorker.mjs', import.meta.url), { workerData: { W: app.W, flat, actor, answers, at: app.now || app.W.builtFor, chunk: CHUNK } });
  p.worker.on('message', (m) => { Object.assign(p, m); });
  p.worker.on('error', (e) => { p.error = String(e.message || e); p.done = true; });
  p.worker.on('exit', () => { p.done = true; });
  return p;
}
export const progressOf = (p) => p;
export function stopCheck(p) { if (p && p.worker && !p.done) { p.stopped = true; p.worker.terminate(); } }
