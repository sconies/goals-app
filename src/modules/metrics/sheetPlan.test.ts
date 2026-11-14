/* The Metrics sheet in and out (MI, round 2's MT6; docs/design/metrics-2/spec.md 2.9, 3.1, 3.4): an export loaded back
   changes nothing; rows add, change, retire and bring back metrics through the library's rules; the same Must fix and
   Check words as the form; one Undo puts every row back; with the Metric library off the sheet is said once, not read. */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadSheetPlanners, MODULE_RECORDS, MODULE_SHEETS, sheetHeadsFor } from '../../core/records';
import { buildPlatformOrg } from '../../data/platformOrg';
import { applyCommit } from '../../data/store';
import { planChanges, type Answers, type Tables } from '../../domain/changeset';
import { currentCycle, scopeToCycle } from '../../domain/cycle';
import { workbook } from '../../domain/export';
import { currentWeek } from '../../domain/plan';
import { undoImport } from '../../domain/removal';
import { readLine, readTables, type NamedGrid } from '../../domain/sheets';
import type { Snapshot } from '../../domain/types';
import { liveMetrics, metricsOf } from './rules';
import { linkedGoals } from './rulesChange';

const today = new Date('2026-11-05T12:00:00Z');
const full = buildPlatformOrg(today);
const cycle = currentCycle(full.cycles, today)!;
const week = currentWeek(cycle, today);
let n = 0;
const newId = (p: string) => `${p}_mi${++n}`;
const ws = { id: 'ws', name: 'Platform Engineering' };

const plan = (tables: Tables, o: { actor?: string; answers?: Answers; snap?: Snapshot } = {}) => {
  const f = o.snap ?? full;
  const s = scopeToCycle(f, cycle);
  return planChanges({ tables, snapshot: s, full: f, cycle, week, actor: s.people.find((p) => p.id === (o.actor ?? 'amara'))!, now: today.toISOString(), newId, via: 'spreadsheet', records: MODULE_RECORDS, answers: o.answers ?? {} });
};
const metricsTable = (rows: Record<string, string>[]): Tables => ({ modules: { Metrics: rows.map((r, i) => ({ ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])), __row: String(i + 2) })) } });
const must = (cs: ReturnType<typeof plan>) => cs.issues.filter((i) => i.level === 'must').map((i) => i.message);
const grids = (book: ReturnType<typeof workbook>): NamedGrid[] => book.map((t) => ({ name: t.name, rows: t.rows.map((r) => r.map((c) => (c == null ? '' : String(c)))) }));

describe('the Metrics sheet in and out (MI)', () => {
  beforeAll(() => loadSheetPlanners());
  const live = liveMetrics(full);
  const used = live.find((m) => linkedGoals(full, m.id).length)!;
  const spare = live.find((m) => !linkedGoals(full, m.id).length)!;

  it('[METRIC-SHEET] an export loaded back changes nothing, and the Metrics sheet is read', () => {
    const book = workbook({ ws, snapshot: scopeToCycle(full, cycle), cycle, week, today, sheets: MODULE_SHEETS });
    const read = readTables(grids(book), sheetHeadsFor({}));
    expect(read.read.map((r) => r.name)).toContain('Metrics');
    expect(read.tables.modules?.Metrics?.length).toBe(metricsOf(full).filter((m) => !m.removedAt).length);
    const cs = plan(read.tables);
    expect(must(cs)).toEqual([]);
    expect(cs.items.filter((x) => x.sheet === 'Metrics')).toEqual([]);
    expect(cs.unchangedBy.Metrics).toBe(read.tables.modules!.Metrics!.length);
  });

  it('adds a metric, changes one, and one Undo puts both back', () => {
    const cs = plan(metricsTable([
      { Metric: 'Retried test share', Unit: '%', Direction: 'Lower is better', Meaning: 'Test runs that fail then pass on retry, out of all runs, over 7 days.' },
      { ID: spare.id, Caveats: 'Read with the release calendar.' },
    ]));
    expect(must(cs)).toEqual([]);
    expect(cs.counts.records).toEqual([{ one: 'metric', many: 'metrics', added: 1, changed: 1 }]);
    expect(cs.commit).not.toBeNull();
    const after = applyCommit(full, cs.commit!);
    expect(liveMetrics(after).find((m) => m.name === 'Retried test share')?.ownerId).toBe('amara');
    expect(metricsOf(after).find((m) => m.id === spare.id)?.caveats).toBe('Read with the release calendar.');
    const imp = cs.commit!.changes.find((c) => c.action === 'imported')!;
    const later = new Date(today.getTime() + 60_000).toISOString();
    const out = undoImport({ snapshot: scopeToCycle(after, cycle), full: after, cycle, week, actor: after.people.find((p) => p.id === 'amara')!, now: later, newId }, imp.importId!);
    const back = applyCommit(after, out.commit);
    expect(liveMetrics(back).some((m) => m.name === 'Retried test share')).toBe(false);
    expect(metricsOf(back).find((m) => m.id === spare.id)?.caveats).toBe(spare.caveats);
  });

  it('says what can’t be saved in section 3.1’s words', () => {
    const cs = plan(metricsTable([
      { ID: 'metric_nope', Metric: 'Nope' },
      { Metric: 'Queue depth', Unit: 'jobs', Direction: 'sideways' },
      { Metric: 'Queue depth', Unit: 'jobs', Direction: 'Lower is better' },
      { ID: used.id, Unit: `${used.unit}x` },
      { ID: spare.id, Action: 'Retire' },
      { ID: spare.id, Action: 'Archive' },
    ]));
    expect(must(cs)).toEqual([
      'ID “metric_nope” isn’t a metric in this workspace. Leave ID empty to add a new metric, or use an ID from an export.',
      'Direction says “sideways”. Use Higher is better or Lower is better.',
      'Rows 3 and 4 are both called “Queue depth”. A metric’s name is used once.',
      expect.stringMatching(/A file can’t change its unit: change it on the metric’s page/),
      'Say why it is retired, in the Reason column. Its goals will show this.',
      'Rows 6 and 7 have the same ID.',
    ]);
    expect(cs.commit).toBeNull();
  });

  it('retires with a reason and brings back; a change of meaning on a metric goals use is asked', () => {
    const retire = plan(metricsTable([{ ID: spare.id, Action: 'Retire', Reason: 'Replaced by the new dashboard.' }]));
    expect(must(retire)).toEqual([]);
    const after = applyCommit(full, retire.commit!);
    expect(metricsOf(after).find((m) => m.id === spare.id)?.retiredAt).toBeTruthy();
    const back = plan(metricsTable([{ ID: spare.id, Action: 'Bring back' }]), { snap: after });
    expect(must(back)).toEqual([]);
    expect(metricsOf(applyCommit(after, back.commit!)).find((m) => m.id === spare.id)?.retiredAt).toBeFalsy();

    const meaning = plan(metricsTable([{ ID: used.id, Meaning: `${used.meaning} Counted per service.` }]));
    const q = meaning.groups.find((g) => g.kind === 'same-number')!;
    expect(q.title).toMatch(/Is it still the same number\?/);
    expect(meaning.commit).toBeNull();
    const changes = plan(metricsTable([{ ID: used.id, Meaning: `${used.meaning} Counted per service.` }]), { answers: { [q.id]: { choice: 'changes' } } });
    expect(must(changes)).toEqual([expect.stringMatching(/^Say why, in the Reason column/)]);
    const same = plan(metricsTable([{ ID: used.id, Meaning: `${used.meaning} Counted per service.` }]), { answers: { [q.id]: { choice: 'same' } } });
    expect(must(same)).toEqual([]);
    expect(same.commit).not.toBeNull();
  });

  it('a metric the actor may not change says whose it is', () => {
    const theirs = live.find((m) => m.ownerId !== 'tunde')!;
    const cs = plan(metricsTable([{ ID: theirs.id, Caveats: 'Mine now.' }]), { actor: 'tunde' });
    expect(must(cs)).toEqual([expect.stringMatching(/^Only .* or an admin can change this metric\.$/)]);
  });

  it('with the Metric library off, the sheet is said once and not read', () => {
    const book = workbook({ ws, snapshot: scopeToCycle(full, cycle), cycle, week, today, sheets: MODULE_SHEETS });
    const read = readTables(grids(book), sheetHeadsFor({ modulesOff: ['metrics'] }));
    expect(read.tables.modules).toBeUndefined();
    expect(readLine(read, 0, { workspace: ws.name })).toContain('Metric library is off in Platform Engineering, so the Metrics sheet was not read.');
  });
});
