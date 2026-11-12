// @vitest-environment node
/* Rule 10 (import spec, section 6; backlog IM6): the engine's look-ups are maps built once and kept up, so a large file
   is checked in about the time it takes to read, and a file of thousands of rows costs about what its rows do. The limits
   are N18's for the whole check in a browser on CI; the engine alone is well inside them. Lower them as it gets leaner;
   never raise them to make a change pass. */
import { planChanges, records, type ChangeInput, type Rec } from './changeset';
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
    });
  }

  it('checks an unedited workbook of nearly 30,000 rows within 20 s, and nothing would change', () => {
    const s = scaleWorkspace(s0, 5) as Snapshot;
    const wb = workbook({ ws: { id: 'ws', name: 'Big' } as never, snapshot: s, cycle, week, today });
    const tables = { goals: records(tsvOf(wb[1]!.rows)), plan: records(tsvOf(wb[2]!.rows)), checkIns: records(tsvOf(wb[3]!.rows)) };
    const rows = tables.goals.length + tables.plan.length + tables.checkIns.length;
    expect(rows).toBeGreaterThan(25_000);
    let cs: ReturnType<typeof planChanges> | null = null;
    const took = timed(() => { cs = planChanges(input(s, tables)); });
    expect(cs!.items).toEqual([]);
    expect(took).toBeLessThan(20_000);
  });

  it('costs about what its rows do: five times the rows, well under twenty-five times the time', () => {
    planChanges(input(s0, newRows(200)));
    const small = Math.max(timed(() => planChanges(input(s0, newRows(1000)))), 5);
    const large = timed(() => planChanges(input(s0, newRows(5000))));
    expect(large / small).toBeLessThan(12);
  });

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
