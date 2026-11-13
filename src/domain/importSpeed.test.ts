// @vitest-environment node
/* Rule 10 (import spec, section 6; backlog IM6): the engine's look-ups are maps built once and kept up, so a large file
   is checked in about the time it takes to read, and a file of thousands of rows costs about what its rows do. The limits
   are N18's for the whole check in a browser on CI; the engine alone is well inside them. Lower them as it gets leaner;
   never raise them to make a change pass. */
import { planChanges, planChangesInChunks, records, type ChangeInput, type PlanProgress, type Rec } from './changeset';
import { workbook } from './export';
import { currentWeek } from './plan';
import { buildPlatformOrg } from '../data/platformOrg';
import { scaleWorkspace } from '../spec/scale';
import type { Snapshot } from './types';

const today = new Date('2026-11-05T12:00:00Z');
const s0 = buildPlatformOrg(today);
const cycle = s0.cycles[0]!;
const week = currentWeek(cycle, today);
const tsvOf = (rows: (string | number | null)[][]) => rows.map((r) => r.map((c) => (c == null ? '' : String(c))).join('\t')).join('\n');
let n = 0;
const input = (s: Snapshot, tables: ChangeInput['tables'], extra: Partial<ChangeInput> = {}): ChangeInput => ({
  tables, snapshot: s, cycle, week, actor: s.people.find((p) => p.admin)!, now: today.toISOString(), newId: (p) => `${p}_s${++n}`, via: 'spreadsheet', ...extra,
});
/** New goals, half the rows, each with a check-in naming it by its title, the other half. */
function newRows(k: number): ChangeInput['tables'] {
  const goals: Rec[] = [], checkIns: Rec[] = [];
  for (let i = 0; i < k / 2; i++) {
    goals.push({ __row: String(i + 2), goal: `Loaded goal ${i}`, owner: s0.people[i % s0.people.length]!.name, type: 'metric', unit: '%', start: '10', target: '90' });
    checkIns.push({ __row: String(i + 2), goal: `Loaded goal ${i}`, week: '3', value: '20' });
  }
  return { goals, checkIns };
}
const timed = (run: () => void) => { const t = performance.now(); run(); return performance.now() - t; };

describe('rule 10: a large file is checked in about the time it takes to read', () => {
  for (const [k, ms] of [[1000, 3000], [5000, 8000]] as const) {
    it(`checks ${k.toLocaleString('en-GB')} new rows within ${ms / 1000} s`, () => {
      let cs: ReturnType<typeof planChanges> | null = null;
      const took = timed(() => { cs = planChanges(input(s0, newRows(k))); });
      expect(cs!.counts.newGoals).toBe(k / 2);
      expect(took).toBeLessThan(ms);
      // The limit is the assertion: the test's own timeout sits above it, so a slow machine fails on the limit, never on
      // vitest's 5 s default (a CI runner timed the 30,000-row test out at 5 s, #336).
    }, ms * 3);
  }

  /** Five copies of the workspace, each copy's goals, people and teams with their own keys, titles, names and emails, so
      the workbook reads as one real workspace would rather than as a file of clashes. */
  function bigWorkspace(): Snapshot {
    const s = scaleWorkspace(s0, 5);
    const copy = (id: string) => Number(/_x(\d+)$/.exec(id)?.[1] ?? 0);
    return {
      ...s,
      goals: s.goals.map((g) => { const c = copy(g.id); return c ? { ...g, key: g.key ? `G-${Number(g.key.slice(2)) + c * 1000}` : g.key, title: `${g.title} (copy ${c})` } : g; }),
      people: s.people.map((p) => { const c = copy(p.id); return c ? { ...p, name: `${p.name} ${c}`, email: p.email ? p.email.replace('@', `+${c}@`) : p.email } : p; }),
      teams: s.teams.map((t) => { const c = copy(t.id); return c ? { ...t, name: `${t.name} ${c}` } : t; }),
    };
  }

  it('checks an unedited workbook of nearly 30,000 rows within 20 s, and nothing would change', () => {
    const s = bigWorkspace();
    const wb = workbook({ ws: { id: 'ws', name: 'Big' } as never, snapshot: s, cycle, week, today });
    const tables = { goals: records(tsvOf(wb[1]!.rows)), plan: records(tsvOf(wb[2]!.rows)), checkIns: records(tsvOf(wb[3]!.rows)) };
    const rows = tables.goals.length + tables.plan.length + tables.checkIns.length;
    expect(rows).toBeGreaterThan(25_000);
    let cs: ReturnType<typeof planChanges> | null = null;
    const took = timed(() => { cs = planChanges(input(s, tables)); });
    expect(cs!.issues).toEqual([]);
    expect(cs!.items).toEqual([]);
    expect(Object.values(cs!.unchangedBy).reduce((a, b) => a + b, 0)).toBe(rows);
    expect(took).toBeLessThan(20_000);
  }, 60_000);

  it('costs about what its rows do: five times the rows, well under twenty-five times the time', () => {
    planChanges(input(s0, newRows(200)));
    // The best of three of each: one wall-clock sample is at the mercy of a busy machine (#257 review).
    const best = (k: number) => { const t = newRows(k); return Math.min(...[0, 1, 2].map(() => timed(() => planChanges(input(s0, t))))); };
    const small = Math.max(best(1000), 5);
    const large = best(5000);
    expect(large / small).toBeLessThan(12);
  }, 30_000);

  it('says fourteen rows with one typo once, as one group, among thousands', () => {
    const t = newRows(2000);
    const team = s0.teams[0]!.name;
    const typo = team.slice(0, -2) + team.slice(-1) + team.slice(-2, -1);
    for (let i = 0; i < 14; i++) t.goals!.push({ __row: String(2000 + i), goal: `Typo goal ${i}`, owner: s0.people[0]!.name, team: typo, type: 'metric', unit: '%', start: '1', target: '2' });
    const cs = planChanges(input(s0, t));
    const g = cs.groups.filter((x) => x.kind === 'near-ref' && x.column === 'Team');
    expect(g).toHaveLength(1);
    expect(g[0]!.count).toBe(14);
  });
});

describe('rule 10: planChangesInChunks reports every 500 rows, and ends where planChanges does', () => {
  it('yields its progress every chunk, counting up, with what it has found so far', () => {
    const tables = newRows(2000);
    const seen: PlanProgress[] = [];
    let m = 0;
    const run = planChangesInChunks(input(s0, tables, { newId: (p) => `${p}_c${++m}` }));
    let step = run.next();
    while (!step.done) { seen.push(step.value); step = run.next(); }
    expect(seen.map((p) => p.done)).toEqual([500, 1000, 1500, 2000]);
    expect(seen.every((p) => p.total === 2000)).toBe(true);
    expect(seen[1]!.added).toBe(1000);
    expect(seen.at(-1)!.added).toBeGreaterThanOrEqual(1000);
    m = 0;
    const once = planChanges(input(s0, tables, { newId: (p) => `${p}_c${++m}` }));
    expect({ ...step.value, commit: null }).toEqual({ ...once, commit: null });
    expect(step.value.counts).toEqual(once.counts);
  });

  it('counts a Must fix as it finds it', () => {
    const tables = newRows(1000);
    for (const r of tables.goals!) r.owner = '';
    const run = planChangesInChunks(input(s0, tables));
    let last: PlanProgress | null = null;
    for (let s = run.next(); !s.done; s = run.next()) last = s.value;
    expect(last!.mustFix).toBeGreaterThanOrEqual(500);
  });
});
