/* The import's worker (import spec 2.2 and section 7; backlog IM6): checks a large file off the page's thread, with the
   same engine as everywhere else (domain/changeset planChangesInChunks), reporting its progress every 500 rows. Stop
   ends the worker; nothing is saved by it either way: the change set it sends back is saved by the page, as any is.

   What it is sent must survive being copied between threads, so the two functions in the engine's input come as
   data: `newId` is made here, the same shape as the store's, and the modules' records are only read for what
   measures a goal, so that comes as a table by goal id. */
import { planChangesInChunks, type ChangeSet } from '../../domain/changeset';
import { CHANGES_SAVE_MAX } from '../../domain/importLimits';
import { loadSheetReaders } from '../../core/records';
import { inputOf, SLICE, type CheckReply, type CheckRequest } from './workerInput';

const post = (r: CheckReply) => (self as unknown as { postMessage(m: CheckReply): void }).postMessage(r);

/**
 * The change set, its rows and problems a slice at a time, then the rest. A file that changes more than one import saves
 * can't be saved (spec 2.8), so its commit, as large again as its rows, stays here.
 */
function send(cs: ChangeSet) {
  const { items, issues, ...rest } = cs;
  for (let i = 0; i < items.length; i += SLICE) post({ type: 'items', items: items.slice(i, i + SLICE) });
  for (let i = 0; i < issues.length; i += SLICE) post({ type: 'issues', issues: issues.slice(i, i + SLICE) });
  post({ type: 'done', cs: { ...rest, items: [], issues: [], commit: items.length > CHANGES_SAVE_MAX ? null : rest.commit } });
}

self.onmessage = async (e: MessageEvent<CheckRequest>) => {
  try {
    // A module's sheet (Metrics) is read by its module's reader: loaded here, as the page loaded it (core/records).
    const readers = e.data.input.tables.modules ? await loadSheetReaders() : {};
    const run = planChangesInChunks({ ...inputOf(e.data), readers });
    for (;;) {
      const step = run.next();
      if (step.done) { send(step.value); return; }
      post({ type: 'progress', progress: step.value });
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
