/* What the import's worker is sent and sends back (backlog IM6; ./worker.ts), and its input made whole again. Plain
   data both ways: the two functions in the engine's input are made on the worker's side. */
import type { ChangeInput, ChangeSet, PlanProgress } from '../../domain/changeset';
import type { GoalMeasure, ModuleRecords } from '../../domain/records';

/** What the page sends: the engine's input without its functions, and what measures each goal. */
export interface CheckRequest { input: Omit<ChangeInput, 'newId' | 'records'>; measures: Record<string, GoalMeasure> }
/** What the worker sends back: progress as it goes, then the change set, or why it couldn't. */
export type CheckReply = { type: 'progress'; progress: PlanProgress } | { type: 'items'; items: ChangeSet['items'] } | { type: 'issues'; issues: ChangeSet['issues'] } | { type: 'done'; cs: ChangeSet } | { type: 'error'; message: string };

/** Rows of a change set per message: a large one comes back in slices, so the page unpacks it a slice per task. */
export const SLICE = 2000;

/** A new ID, the same shape as the store's (src/data/store.ts newId). */
const newId = (prefix: string) => prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** The engine's input, its functions put back. */
export function inputOf(req: CheckRequest): ChangeInput {
  const records: ModuleRecords[] = [{ module: 'measures', records: [], measures: (_s, goalId) => req.measures[goalId] ?? null }];
  return { ...req.input, newId, records };
}

