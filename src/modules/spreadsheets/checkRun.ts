/* Checking a large file without freezing the page (import spec 2.2, section 7; backlog IM6): the engine runs in the
   import's worker (./worker.ts) and reports its progress; Stop ends it. Where a browser has no workers (the unit
   tests' jsdom), the same engine runs here a chunk at a time, letting the page draw between chunks. The result is kept
   in the import's store (./importStore.ts), for the inputs it was made for. */
import { planChangesInChunks, type ChangeInput, type ChangeSet, type PlanProgress } from '../../domain/changeset';
import { goalMeasureOf, type GoalMeasure } from '../../domain/records';
import { readersNow } from '../../core/records';
import { importStore, NO_RUN, onCancelRun, type RunFor } from './importStore';
import type { CheckReply, CheckRequest } from './workerInput';

let stop: (() => void) | null = null;
const end = () => { stop?.(); stop = null; };
onCancelRun(end);

const same = (a: RunFor | null, b: RunFor) => !!a && a.tables === b.tables && a.answers === b.answers && a.name === b.name && a.left === b.left && a.snapshot === b.snapshot;

/** What the engine's input becomes to cross to the worker: plain data, what measures each goal worked out here. */
export function requestOf(input: ChangeInput): CheckRequest {
  const { newId: _n, records, readers: _r, ...rest } = input;
  const measures: Record<string, GoalMeasure> = {};
  for (const g of input.snapshot.goals) { const m = goalMeasureOf(records, input.snapshot, g.id); if (m) measures[g.id] = m; }
  return { input: rest, measures };
}

/**
 * Checks the file for these inputs, unless that check is already made or under way. A check for other inputs is
 * ended first. While an answer is re-checked (same file), the change set before it stays on screen.
 */
export function startCheck(key: RunFor, input: () => ChangeInput): void {
  const run = importStore.get().run;
  if (same(run.for, key)) return;
  end();
  const keep = run.for?.tables === key.tables ? run.cs : null;
  importStore.set({ run: { for: key, cs: keep, progress: null, started: performance.now(), running: true, error: '' } });
  const progress = (p: PlanProgress) => { const r = importStore.get().run; if (r.for === key) importStore.set({ run: { ...r, progress: p } }); };
  const done = (cs: ChangeSet) => { const r = importStore.get().run; if (r.for === key) importStore.set({ run: { ...r, cs, running: false } }); stop = null; };
  const failed = (message: string) => { const r = importStore.get().run; if (r.for === key) importStore.set({ run: { ...r, running: false, error: message } }); stop = null; };

  if (typeof Worker !== 'undefined') {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const items: ChangeSet['items'] = [], issues: ChangeSet['issues'] = [];
    w.onmessage = (e: MessageEvent<CheckReply>) => {
      const m = e.data;
      if (m.type === 'progress') progress(m.progress);
      else if (m.type === 'items') items.push(...m.items);
      else if (m.type === 'issues') issues.push(...m.issues);
      else if (m.type === 'done') { done({ ...m.cs, items, issues }); w.terminate(); }
      else { failed(m.message); w.terminate(); }
    };
    w.onerror = (e) => { failed(e.message || 'The check stopped.'); w.terminate(); };
    stop = () => w.terminate();
    w.postMessage(requestOf(input()));
    return;
  }
  // No workers: the same engine here, a chunk at a time.
  let stopped = false;
  stop = () => { stopped = true; };
  const gen = planChangesInChunks({ ...input(), readers: readersNow() });
  const step = () => {
    if (stopped) return;
    try {
      const s = gen.next();
      if (s.done) done(s.value);
      else { progress(s.value); setTimeout(step, 0); }
    } catch (e) { failed(e instanceof Error ? e.message : String(e)); }
  };
  setTimeout(step, 0);
}

/** Stop (spec 2.2): the check ends and nothing is kept. */
export function stopCheck(): void {
  end();
  importStore.set({ run: NO_RUN });
}
