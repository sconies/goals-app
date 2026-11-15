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
import { undoImport, undoPreview } from '../../domain/removal';
import { readLine, readTables, type NamedGrid } from '../../domain/sheets';
import type { Snapshot } from '../../domain/types';
import { liveMetrics, metricsOf, saveMetric } from './rules';
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

  it('[METRIC-SHEET] carries where a metric sits, its confidence and how it could be gamed, in and out (MQ)', () => {
    const cs = plan(metricsTable([
      { ID: spare.id, 'Part of': used.name, 'How it relates': 'driver', Confidence: 'Medium', 'How it could be gamed': 'Retrying until green hides flaky tests.' },
    ]));
    expect(must(cs)).toEqual([]);
    const after = applyCommit(full, cs.commit!);
    const m = metricsOf(after).find((v) => v.id === spare.id)!;
    expect(m).toMatchObject({ parentId: used.id, level: 'driver', confidence: 'medium', gaming: 'Retrying until green hides flaky tests.' });
    // Out: the export says it in the same words, and loading it back changes nothing.
    const book = workbook({ ws, snapshot: scopeToCycle(after, cycle), cycle, week, today, sheets: MODULE_SHEETS });
    const sheet = book.find((t) => t.name === 'Metrics')!;
    const head = sheet.rows[0]!.map(String);
    const row = sheet.rows.find((r) => r[0] === spare.id)!;
    const at = (col: string) => row[head.indexOf(col)];
    expect([at('Part of'), at('How it relates'), at('Confidence'), at('How it could be gamed')]).toEqual([used.name, 'Driver', 'Medium', 'Retrying until green hides flaky tests.']);
    const again = plan(readTables(grids(book), sheetHeadsFor({})).tables, { snap: after });
    expect(must(again)).toEqual([]);
    expect(again.items.filter((x) => x.sheet === 'Metrics')).toEqual([]);
  });

  it('[METRIC-SHEET] refuses a loop, a level with no parent and words it can’t read, in the library’s words (MQ)', () => {
    const cs = plan(metricsTable([
      { ID: spare.id, 'Part of': used.name, 'How it relates': 'Driver' },
      { ID: used.id, 'Part of': spare.id },
      { Metric: 'Queue depth', Unit: 'jobs', Direction: 'Lower is better', 'How it relates': 'Component' },
      { Metric: 'Queue wait', Unit: 'min', Direction: 'Lower is better', 'How it relates': 'sibling', Confidence: 'sure' },
      { Metric: 'Queue age', Unit: 'min', Direction: 'Lower is better', 'Part of': 'No such metric' },
    ]));
    expect(must(cs)).toEqual([
      'Choose another parent: it’s already under this one.',
      `Say what it is a component of: choose its parent, or leave the level empty.`,
      'How it relates says “sibling”. Use Component, Driver, Control or Breakdown, or leave it empty.',
      'Confidence says “sure”. Use High, Medium or Low, or leave it empty.',
      'Part of says “No such metric”, which isn’t a metric in this workspace. Give the name or ID of a metric in the library or on an earlier row, or leave it empty.',
    ]);
    const loop = cs.issues.find((i) => i.kind === 'loop')!;
    expect(loop).toMatchObject({ level: 'must', column: 'Part of' });
  });

  // #520 review: a gap metric whose goals are held to no number (the demo's state after "Gap" is said).
  const at = (n: number) => new Date(today.getTime() + n * 60_000).toISOString();
  const as = (snap: Snapshot, now: string) => ({ snapshot: scopeToCycle(snap, cycle), full: snap, cycle, week, actor: snap.people.find((p) => p.id === 'amara')!, now, newId });
  const gapped = (): Snapshot => {
    const f = structuredClone(full) as Snapshot;
    for (const m of metricsOf(f)) if (m.id === used.id) Object.assign(m, { measurement: 'gap', measurementNote: 'No feed yet.' });
    const held = new Set(linkedGoals(f, used.id).map((g) => g.id));
    f.goals = f.goals.map((g) => (held.has(g.id) ? { ...g, unmeasuredSince: today.toISOString() } : g));
    return f;
  };
  const importOf = (cs: ReturnType<typeof plan>) => cs.commit!.changes.find((c) => c.action === 'imported')!.importId!;

  it('[#520 review] Undo leaves a goal of another year as it was, when a retire let go of it', () => {
    const f = gapped();
    const gid = linkedGoals(f, used.id)[0]!.id;
    f.cycles = [...f.cycles, { ...cycle, id: 'cyc-other' }];
    f.goals = f.goals.map((g) => (g.id === gid ? { ...g, cycleId: 'cyc-other' } : g));
    const cs = plan(metricsTable([{ ID: used.id, Action: 'Retire', Reason: 'Replaced by the new dashboard.' }]), { snap: f });
    expect(must(cs)).toEqual([]);
    expect(cs.commit!.goals!.find((g) => g.id === gid)?.unmeasuredSince ?? null).toBeNull();
    const after = applyCommit(f, cs.commit!);
    const back = applyCommit(after, undoImport(as(after, at(1)), importOf(cs)).commit);
    const g = back.goals.find((v) => v.id === gid)!;
    expect(g.removedAt ?? null).toBeNull();
    expect(g.unmeasuredSince).toBeTruthy();
  });

  it('[#520 review] one file that retires a gap metric and renames its goal keeps both', () => {
    const f = gapped();
    const g = f.goals.find((v) => v.id === linkedGoals(f, used.id).find((l) => l.cycleId === cycle.id)!.id)!;
    const cs = plan({ ...metricsTable([{ ID: used.id, Action: 'Retire', Reason: 'Replaced by the new dashboard.' }]), goals: [{ key: g.key!, goal: `${g.title} (renamed)`, __row: '2' }] }, { snap: f });
    expect(must(cs)).toEqual([]);
    const saved = applyCommit(f, cs.commit!).goals.find((v) => v.id === g.id)!;
    expect(saved.title).toBe(`${g.title} (renamed)`);
    expect(saved.unmeasuredSince ?? null).toBeNull();
  });

  it('[#520 review] Undo leaves a metric changed since as it is, and says so', () => {
    const cs = plan(metricsTable([{ ID: spare.id, Caveats: 'Read with the release calendar.' }]));
    const after = applyCommit(full, cs.commit!);
    const later = applyCommit(after, saveMetric(as(after, at(60)), { id: spare.id, source: 'The new dashboard', confirm: true }).commit!);
    const preview = undoPreview(as(later, at(61)), importOf(cs));
    expect(preview.restores).toBe(0);
    expect(preview.skipped.map((k) => k.name)).toEqual([spare.name]);
    expect(metricsOf(later).find((m) => m.id === spare.id)?.source).toBe('The new dashboard');
  });

  it('[#520 review] a Goals sheet made by hand with a Metric column is read as goals', () => {
    for (const head of [['Goal', 'Metric', 'Unit', 'Target', 'Owner'], ['Key', 'Goal', 'Metric', 'Unit', 'Now']]) {
      const read = readTables([{ name: 'Sheet1', rows: [head, head.map(() => 'x')] }], sheetHeadsFor({}));
      expect(read.tables.modules?.Metrics).toBeUndefined();
      expect(read.tables.goals?.length).toBe(1);
    }
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
