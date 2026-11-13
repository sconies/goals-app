/* Runs every action's sample (src/spec/readsSamples.ts) on the demo workspace and notes what it reads (src/spec/reads.ts),
   and the same for one goal's summary row: its summary, flags, needs attention and being handled. For
   spec/rebuild/reads.md and its test. No database, screens or network. */
import { actionNames, loadEngine, loadGoalEntry, performAny, ready, type RunContext } from '../app/actions';
import { MODULE_RECORDS } from '../core/records';
import { MODULES } from '../core/registry';
import { buildPlatformOrg } from '../data/platformOrg';
import { attentionFor, handledFor } from '../domain/attention';
import { currentCycle, scopeToCycle } from '../domain/cycle';
import { currentWeek } from '../domain/plan';
import { summarise } from '../domain/summary';
import type { Snapshot } from '../domain/types';
import { readsOf, type ListReads } from './reads';
import { SAMPLES } from './readsSamples';

/** The moment the demo is built for: the conformance workspace's. */
export const READS_AT = new Date('2026-11-05T12:00:00Z');

export interface ActionReads { action: string; as: string; outcome: 'saved' | 'nothing to save' | 'refused'; said: string; reads: ListReads[] }

/** The demo, built once: the rules are pure, so no run changes it. */
let demo: { full: Snapshot; snapshot: Snapshot; cycle: ReturnType<typeof currentCycle> & object } | null = null;
function context(who: string): { x: RunContext; full: Snapshot } {
  if (!demo) {
    const f = buildPlatformOrg(READS_AT);
    const c = currentCycle(f.cycles, READS_AT)!;
    demo = { full: f, snapshot: scopeToCycle(f, c), cycle: c };
  }
  const { full, snapshot, cycle } = demo;
  const actor = full.people.find((p) => p.id === who)!;
  let n = 0;
  const x: RunContext = { snapshot, cycle, week: currentWeek(cycle, READS_AT), actor, now: '2026-11-05T13:00:00Z', newId: (p) => `${p}_r${++n}`, allGoals: full.goals, full, records: MODULE_RECORDS, workspace: { id: 'w', name: 'Platform Engineering' }, modules: MODULES.map((m) => ({ id: m.id, name: m.name, needs: [...(m.needs ?? [])] })) };
  return { x, full };
}

export async function actionReads(): Promise<ActionReads[]> {
  await loadEngine();
  await loadGoalEntry();
  for (const a of actionNames()) await ready(a);
  return actionNames().map((action) => {
    const sample = SAMPLES[action];
    if (!sample) throw new Error(`No sample for ${action}: add one to src/spec/readsSamples.ts.`);
    const who = typeof sample.as === 'string' ? sample.as : sample.as(context('amara').x.snapshot);
    const { x, full } = context(who);
    const input = sample.input(x);
    let out: unknown = null;
    const { reads, error } = readsOf(x.snapshot, full, (s, f) => { out = performAny({ ...x, snapshot: s, full: f!, allGoals: f!.goals }, action, input); });
    return { action, as: who, outcome: error ? 'refused' : out == null ? 'nothing to save' : 'saved', said: error ? (error as Error).message : '', reads };
  });
}

/** A goal's summary row, as R4 rule 2 lists it: the summary, the flags, needs attention and being handled. */
export function summaryReads(part: 'row' | 'handled', goalId: string): ListReads[] {
  const { x } = context('amara');
  const goal = x.snapshot.goals.find((g) => g.id === goalId)!;
  return readsOf(x.snapshot, null, (s) => {
    const g = s.goals.find((h) => h.id === goal.id)!;
    if (part === 'row') { summarise(g, s, x.cycle, READS_AT, x.week); attentionFor(g, s, x.cycle, READS_AT); }
    else handledFor(g, s, x.cycle, READS_AT);
  }).reads;
}

/** The demo's live goals in this cycle. */
export const liveGoals = (): string[] => context('amara').x.snapshot.goals.map((g) => g.id);

/**
 * One goal's own records: the goal, its parent and children, and the goals an ask it shares names; its check-ins and decisions; the asks that name it; the
 * reviews those name; the people named by any of them, its team and the people in it; and nothing else. A summary
 * row worked out from these alone must equal the one worked out from the whole workspace (src/spec/reads.test.ts):
 * that is what lets the server read one goal's records for it.
 */
export function goalSlice(s: Snapshot, goalId: string): Snapshot {
  const goal = s.goals.find((g) => g.id === goalId)!;
  const checkIns = s.checkIns.filter((c) => c.goalId === goalId);
  const decisions = s.decisions.filter((d) => d.goalId === goalId);
  const requests = (s.requests ?? []).filter((r) => r.goalIds.includes(goalId));
  // An ask shared with other goals names them by title.
  const shared = new Set(requests.flatMap((r) => r.goalIds));
  const goals = s.goals.filter((g) => g.id === goalId || g.id === goal.parentId || g.parentId === goalId || shared.has(g.id));
  const reviewIds = new Set([...decisions, ...requests].map((r) => r.reviewId).filter(Boolean));
  const named = new Set<string>([goal.ownerId, ...checkIns.map((c) => c.authorId), ...decisions.map((d) => d.byId), ...requests.flatMap((r) => [r.askedBy, r.recipientId, r.answeredBy])].filter((x): x is string => !!x));
  const teams = s.teams.filter((t) => t.id === goal.teamId);
  for (const t of teams) if (t.leadId) named.add(t.leadId);
  return { ...s, goals, checkIns, decisions, requests, reviews: s.reviews.filter((r) => reviewIds.has(r.id)), people: s.people.filter((p) => named.has(p.id) || p.teamId === goal.teamId), teams, watches: [], changes: [], views: [] };
}

/** A goal's summary row (R4, rule 2) from a snapshot, as JSON: the summary, its attention and being handled. */
export function summaryRow(s: Snapshot, goalId: string): string {
  const { x } = context('amara');
  const g = s.goals.find((h) => h.id === goalId)!;
  return JSON.stringify({ summary: summarise(g, s, x.cycle, READS_AT, x.week), attention: attentionFor(g, s, x.cycle, READS_AT) });
}

/** For every live goal: whether its row from its own records equals its row from the whole workspace, and what the
    row read from its own records (src/spec/reads.ts). */
export function sliceProof(): { goalId: string; same: boolean; reads: ListReads[]; handled: ListReads[] }[] {
  const { x } = context('amara');
  return x.snapshot.goals.map((g) => {
    const slice = goalSlice(x.snapshot, g.id);
    const reads = readsOf(slice, null, (s) => summaryRow(s, g.id)).reads;
    const handled = readsOf(slice, null, (s) => handledFor(s.goals.find((h) => h.id === g.id)!, s, x.cycle, READS_AT)).reads;
    return { goalId: g.id, same: summaryRow(slice, g.id) === summaryRow(x.snapshot, g.id), reads, handled };
  });
}
