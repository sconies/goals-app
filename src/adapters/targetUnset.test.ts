// @vitest-environment node
/* A proposed number goal saved with a baseline and no target (GB) is given its target later, through a file or the AI
   tools, on plain Postgres (PGlite, after bootstrap.sql and every migration): the target is written, the goal stops
   saying "not set", and "Baseline period: none" removes the baseline. All three doors share the bulk-change engine
   (GB review, HIGH: the engine kept the stored targetUnset over a build that left it out). */
import type { PGlite } from '@electric-sql/pglite';
import { serve } from '../../server/mcp';
import { createToken, type ActionContext } from '../domain/actions';
import { planChanges, type Rec } from '../domain/changeset';
import { currentWeek } from '../domain/plan';
import type { MetricGoal, Snapshot } from '../domain/types';
import { contractWorkspace } from '../ports/contracts/store';
import { postgresDeps } from './postgres/server';
import { PostgresStore } from './postgres/goalsStore';
import { freshPostgres } from './postgres/testDb';

const NOW = new Date('2026-10-30T12:00:00Z');
let n = 0;
const ids = (p: string) => `${p}_gb${String(++n).padStart(4, '0')}`;

const firstNumberGoal = (s: Snapshot) => (x: Snapshot['goals'][number]) => x.kind === 'metric' && !s.checkIns.some((c) => c.goalId === x.id);

/** A workspace whose first number goal is proposed, with a baseline and its target unset. */
function withUnsetTarget(suffix: string): { s: Snapshot; goal: MetricGoal } {
  const s = contractWorkspace(suffix);
  const g = s.goals.find(firstNumberGoal(s)) as MetricGoal;
  const goal: MetricGoal = { ...g, proposedAt: NOW.toISOString(), proposedBy: g.ownerId, targetUnset: true, plan: { ...g.plan, target: g.plan.start }, baseline: { value: g.plan.start, period: 'June to September 2026', provisional: true } };
  return { s: { ...s, goals: s.goals.map((x) => (x.id === g.id ? goal : x)) }, goal };
}

describe('a target given later to a proposed goal, on plain Postgres (GB)', () => {
  let db: PGlite;
  let store: PostgresStore;
  beforeAll(async () => {
    db = await freshPostgres();
    store = new PostgresStore(db);
  }, 60_000);

  const stored = async (id: string) => (await db.query<{ plan_target: string | null; proposed_at: string | null; baseline_period: string | null }>(`select plan_target::text, proposed_at::text, baseline_period from faro.okr_goals where id = $1`, [id])).rows[0]!;

  describe('through a file (the import)', () => {
    async function load(row: Record<string, string>) {
      const ws = ids('ws');
      const { s, goal } = withUnsetTarget(ws);
      await store.createWorkspace({ id: ws, name: 'GB import', kind: 'own', createdAt: NOW.toISOString() }, s);
      const snap = await store.load(ws);
      const cycle = snap.cycles[0]!;
      const r: Rec = { __row: '2', id: goal.id, ...Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v])) };
      const cs = planChanges({ tables: { goals: [r] }, snapshot: snap, cycle, week: currentWeek(cycle, NOW), actor: snap.people.find((p) => p.admin)!, now: NOW.toISOString(), newId: ids, via: 'spreadsheet' });
      expect(cs.issues.filter((i) => i.severity !== 'note').map((i) => i.message)).toEqual([]);
      expect(cs.items).toHaveLength(1);
      await store.commit(ws, cs.commit!);
      return { goal, after: (await store.load(ws)).goals.find((g) => g.id === goal.id) as MetricGoal };
    }

    it('a target alone is written, and the goal no longer says it has none', async () => {
      const { goal, after } = await load({ Target: String(goal0Target()) });
      expect(after.targetUnset).toBeUndefined();
      expect(after.plan.target).toBe(goal0Target());
      expect(after.proposedAt).toBeTruthy();
      expect(await stored(goal.id)).toMatchObject({ plan_target: String(goal0Target()), baseline_period: 'June to September 2026' });
    }, 60_000);

    it('a target with State active makes it active with its target', async () => {
      const { goal, after } = await load({ Target: String(goal0Target()), State: 'active' });
      expect(after.targetUnset).toBeUndefined();
      expect(after.proposedAt ?? null).toBeNull();
      expect(after.plan.target).toBe(goal0Target());
      expect(await stored(goal.id)).toMatchObject({ plan_target: String(goal0Target()), proposed_at: null });
    }, 60_000);

    it('Baseline period none removes the baseline, and the target stays unset', async () => {
      const { goal, after } = await load({ 'Baseline period': 'none' });
      expect(after.baseline ?? null).toBeNull();
      expect(after.targetUnset).toBe(true);
      expect(await stored(goal.id)).toMatchObject({ plan_target: null, baseline_period: null });
    }, 60_000);
  });

  describe('through the AI tools (update_goal)', () => {
    async function update(args: Record<string, unknown>) {
      const ws = ids('ws');
      const { s, goal } = withUnsetTarget(ws);
      await store.createWorkspace({ id: ws, name: 'GB tools', kind: 'own', createdAt: NOW.toISOString() }, s);
      const deps = postgresDeps(db);
      const admin = s.people.find((p) => p.admin)!;
      const ctx = { snapshot: s, full: s, allGoals: s.goals, cycle: s.cycles[0]!, week: 1, actor: admin, now: NOW.toISOString(), newId: ids } as unknown as ActionContext;
      const secret = await deps.issueToken!(ws, createToken(ctx, admin.id, 'GB test'));
      const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'update_goal', arguments: { goal_id: goal.id, ...args } } }) }), deps);
      const out = (await res.json()).result as { isError: boolean; content: { text: string }[] };
      expect(out.isError, out.content[0]?.text).toBe(false);
      return { goal, after: (await store.load(ws)).goals.find((g) => g.id === goal.id) as MetricGoal };
    }

    it('a target alone is written, and the goal no longer says it has none', async () => {
      const { goal, after } = await update({ target: goal0Target() });
      expect(after.targetUnset).toBeUndefined();
      expect(after.plan.target).toBe(goal0Target());
      expect(await stored(goal.id)).toMatchObject({ plan_target: String(goal0Target()) });
    }, 60_000);

    it('a target with state active makes it active with its target', async () => {
      const { goal, after } = await update({ target: goal0Target(), state: 'active' });
      expect(after.targetUnset).toBeUndefined();
      expect(after.proposedAt ?? null).toBeNull();
      expect(await stored(goal.id)).toMatchObject({ plan_target: String(goal0Target()), proposed_at: null });
    }, 60_000);

    it('baseline_period none removes the baseline', async () => {
      const { goal, after } = await update({ baseline_period: 'none' });
      expect(after.baseline ?? null).toBeNull();
      expect(after.targetUnset).toBe(true);
      expect(await stored(goal.id)).toMatchObject({ plan_target: null, baseline_period: null });
    }, 60_000);
  });
});

/** The target the goal had before it was proposed without one: the one given later. */
function goal0Target(): number {
  const s = contractWorkspace('t');
  return (s.goals.find(firstNumberGoal(s)) as MetricGoal).plan.target;
}
