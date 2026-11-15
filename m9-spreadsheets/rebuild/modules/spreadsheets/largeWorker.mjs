// The worker of large.mjs: the engine over the file, a part at a time, posting progress.
import { parentPort, workerData } from 'node:worker_threads';
import { planChanges } from '../../engine.mjs';
import { makeS1 } from '../../rules.mjs';

const { W, flat, actor, answers, at, chunk } = workerData;
const S1 = makeS1(W);
const back = (xs) => xs.map(({ line, row }) => { Object.defineProperty(row, '__line', { value: line, enumerable: false }); return row; });
const tables = Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, back(v)]));
let read = 0;
const mustRows = new Set(), groups = new Set();
for (const [k, rows] of Object.entries(tables)) {
  if (k === 'plan') { read += rows.length; continue; }
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const res = planChanges({ W, S1 }, { actor, sheet: k, rows: part, answers, idTag: 'w', given: { at } });
    for (const x of res.issues) { if (x.level === 'must') mustRows.add(`${x.sheet}:${x.row}`); else if (x.level === 'check') groups.add(x.group); }
    read += part.length;
    parentPort.postMessage({ read, must: mustRows.size, questions: groups.size });
  }
}
parentPort.postMessage({ read, must: mustRows.size, questions: groups.size, done: true });
