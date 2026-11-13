// @vitest-environment node
/* MI: the Metrics sheet read back through the change engine (docs/design/metrics-2/spec.md 3.1 and 2.9), with the
   library's own rules: every Must fix and Check of 3.1 that a file can raise, a rename by ID, retiring and bringing back,
   the header's other names, leaving rows out, and one Undo for the lot. */
import { applyCommit } from '../../data/store';
import { buildPlatformOrg } from '../../data/platformOrg';
import { loadSheetReaders, MODULE_RECORDS } from '../../core/records';
import { describe as said, planChanges, type ChangeSet } from '../../domain/changeset';
import { currentCycle, scopeToCycle } from '../../domain/cycle';
import { currentWeek } from '../../domain/plan';
import { undoImport } from '../../domain/removal';
import { moduleRecs, readTables, recordsOf, type Rec } from '../../domain/sheets';
import type { Answers } from '../../domain/problemLevels';
import type { Snapshot } from '../../domain/types';
import { linksOf, metricsOf } from './rules';
import { METRICS_SHEET } from './sheet';

const today = new Date('2026-11-05T12:00:00Z');
const base = buildPlatformOrg(today);
const cycle = currentCycle(base.cycles, today)!;
const week = currentWeek(cycle, today);
let n = 0;
const newId = (p: string) => `${p}_mi${++n}`;
let readers: Awaited<ReturnType<typeof loadSheetReaders>>;
beforeAll(async () => { readers = await loadSheetReaders([METRICS_SHEET as never]); });

/** A Metrics sheet as CSV text, read as a file would be. */
const sheet = (csv: string): Rec[] => moduleRecs(METRICS_SHEET, recordsOf(csv.trim().split('\n').map((l) => l.split('|'))));
const plan = (rows: Rec[], o: { answers?: Answers; actor?: string; full?: Snapshot } = {}): ChangeSet => {
  const full = o.full ?? base;
  const s = scopeToCycle(full, cycle);
  return planChanges({ tables: { modules: { Metrics: rows } }, snapshot: s, cycle, week, actor: s.people.find((p) => p.id === (o.actor ?? 'rhea'))!, now: today.toISOString(), newId, via: 'spreadsheet', full, readers, workspace: 'Platform Engineering', answers: o.answers });
};
const must = (cs: ChangeSet) => cs.issues.filter((i) => i.level === 'must').map((i) => `${i.row} ${i.column}: ${i.message}`);
const checks = (cs: ChangeSet) => cs.groups.filter((g) => g.level === 'check');
const metric = (s: Snapshot, name: string) => metricsOf(s).find((m) => m.name === name)!;
const usedId = 'metric_lead-time';
const unused = metricsOf(base).find((m) => !linksOf(base).some((l) => l.metricId === m.id))?.id;

describe('the Metrics sheet, read back (MI)', () => {
  it('adds a metric with a name, a unit and a direction, and says so in the import’s words', () => {
    const cs = plan(sheet('Metric|Unit|Direction|Meaning\nPlatform onboarding time|days|Lower is better|Working days from a new engineer’s start to their first production deploy, median over 90 days.'));
    expect(must(cs)).toEqual([]);
    expect(checks(cs)).toEqual([]);
    expect(cs.items.map((x) => [x.sheet, x.kind, x.goal])).toEqual([['Metrics', 'new record', 'Platform onboarding time']]);
    expect(said(cs)).toBe('1 new metric');
    const after = applyCommit(base, cs.commit!);
    expect(metric(after, 'Platform onboarding time')).toMatchObject({ unit: 'days', direction: 'lower', ownerId: 'rhea' });
    expect(cs.commit!.changes.at(-1)!.summary).toBe('Loaded a spreadsheet: 1 new metric');
  });

  it('a row with an ID that matches and a new name renames the metric; one that says what it says changes nothing', () => {
    const lead = metric(base, 'Lead time for changes');
    const cs = plan(sheet(`ID|Metric|Unit|Direction\n${lead.id}|Lead time to production|hours|Lower is better\nmetric_ci-time|CI pipeline time on main (p90)|min|Lower is better`));
    expect(must(cs)).toEqual([]);
    expect(cs.items.map((x) => x.summary)).toEqual(['Renamed the metric “Lead time for changes” to “Lead time to production”']);
    expect(cs.unchangedBy.Metrics).toBe(1);
  });

  it('says each Must fix of 3.1 in its words, at its row and column', () => {
    const cs = plan(sheet([
      'ID|Metric|Unit|Direction|Decimals|Refresh|Owner email',
      'metric_nope|Ghost|min|Lower is better||| ',
      '|No unit here||Higher is better|||',
      '|Odd direction|min|sideways|||',
      '|Too many places|min|Lower is better|7||',
      '|Ab|min|Lower is better|||',
      '|Twice|min|Lower is better|||',
      '|twice|min|Lower is better|||',
      '|Owner from nowhere|min|Lower is better|||nobody@example.com',
      `${usedId}|Lead time for changes|days|Lower is better|||`,
      '|Long unit|deploys per developer week|Higher is better|||',
    ].join('\n')));
    const m = must(cs);
    expect(m).toContain('2 ID: ID “metric_nope” isn’t a metric in Platform Engineering. Leave ID empty to add a new metric, or use an ID from an export.');
    expect(m).toContain('3 Unit: Say its unit: %, min, hours, USD, deploys…');
    expect(m).toContain('4 Direction: Direction says “sideways”. Use Higher is better or Lower is better.');
    expect(m).toContain('5 Decimals: Decimals says “7”. Use a whole number from 0 to 4.');
    expect(m).toContain('6 Metric: Give the metric a name of at least three characters.');
    expect(m).toContain('7 Metric: Rows 7 and 8 are both called “Twice”. A metric’s name is used once.');
    expect(m).toContain('9 Owner email: Owner email “nobody@example.com” isn’t a person in Platform Engineering. Add them on the People sheet, or leave it empty to own it yourself.');
    expect(m.find((x) => x.startsWith('10 Unit:'))).toMatch(/It is in hours and 1 goal is measured by it\. A file can’t change its unit/);
    expect(cs.issues.find((i) => i.row === 11 && i.level === 'must')).toMatchObject({ kind: 'text-length', column: 'Unit', message: 'Keep the unit to 20 characters or fewer.' });
    expect(cs.commit).toBeNull();
    // The rows that must be fixed are counted there only.
    expect(cs.items.filter((x) => [2, 3, 4, 5, 6, 7, 8, 9, 10].includes(x.row))).toEqual([]);
  });

  it('asks rule 1’s questions once per group: a close name, a unit spelt another way, a percentage that doesn’t say out of what', () => {
    const rows = sheet([
      'Metric|Unit|Direction|Meaning|Owner',
      'Flaky test rates|%|Lower is better||Rhea Kapoor',
      'Deploy success share|percent|Higher is better|Deploys that worked.|Rhea Kapoor',
      'Rollback share|%|Lower is better|Deploys rolled back.|Rhea Kapoor',
    ].join('\n'));
    const cs = plan(rows);
    const g = checks(cs);
    const name = g.find((x) => x.kind === 'near-ref')!;
    expect(name.title).toMatch(/^This is one letter from “Flaky test rate” \(%, lower is better/);
    expect(name.answers.map((a) => a.label)).toEqual(['Change “Flaky test rate” with this row', 'Add “Flaky test rates” as a new metric']);
    expect(g.find((x) => x.kind === 'near-word')!.example).toBe('Other metrics here use “%”. Use “%”, or keep “percent”?');
    const out = g.find((x) => x.kind === 'out-of-what')!;
    expect(out.count).toBe(2);
    expect(cs.commit).toBeNull();
    // One answer each: the name kept as new, the unit as in use, the meanings as written. Then it saves.
    const answers: Answers = { [name.id]: { choice: 'keep' }, [g.find((x) => x.kind === 'near-word')!.id]: { choice: 'use' }, [out.id]: { choice: 'as-written' } };
    const done = plan(rows, { answers });
    expect(checks(done)).toEqual([]);
    expect(done.commit).not.toBeNull();
    expect(metric(applyCommit(base, done.commit!), 'Deploy success share').unit).toBe('%');
    // "Change Flaky test rate with this row": the row changes that metric instead.
    const use = plan(rows, { answers: { ...answers, [name.id]: { choice: `use:${metric(base, 'Flaky test rate').id}` } } });
    expect(use.items.find((x) => x.row === 2)?.kind).not.toBe('new record');
  });

  it('a new meaning on a metric goals use asks if it is the same number; “it changes” needs a Reason, then marks its goals', () => {
    const rows = (reason: string) => sheet(`ID|Metric|Meaning|Reason\n${usedId}|Lead time for changes|Median hours from merge to production, over 28 days.|${reason}`);
    const cs = plan(rows(''));
    const q = checks(cs).find((x) => x.kind === 'changes-goals')!;
    expect(q.title).toBe('Lead time for changes: 1 goal is measured by it. Is it still the same number?');
    expect(q.answers.map((a) => a.label)).toEqual(['Same number, better words', 'The number changes from this week', 'Leave this row out']);
    const changes = plan(rows(''), { answers: { [q.id]: { choice: 'changes' } } });
    expect(must(changes)).toEqual(['2 Reason: Say why, in the Reason column: 1 goal measured by Lead time for changes will show it.']);
    const ok = plan(rows('Commit time was unreliable for squashed merges.'), { answers: { [q.id]: { choice: 'changes' } } });
    expect(must(ok)).toEqual([]);
    expect(metric(applyCommit(base, ok.commit!), 'Lead time for changes').marks?.at(-1)).toMatchObject({ kind: 'definition', why: 'Commit time was unreliable for squashed merges.' });
    // "Same number, better words" saves with no reason and no mark.
    const same = plan(rows(''), { answers: { [q.id]: { choice: 'same' } } });
    expect(metric(applyCommit(base, same.commit!), 'Lead time for changes').marks ?? []).toEqual([]);
  });

  it('two new rows with no owner ask once who owns them; “Leave these rows out” leaves them out', () => {
    const rows = sheet('Metric|Unit|Direction\nMetric number one|min|Lower is better\nMetric number two|min|Lower is better');
    const cs = plan(rows);
    const q = checks(cs).find((x) => x.kind === 'no-owner')!;
    expect(q.title).toBe('2 rows give no Owner email. You will own those 2 metrics.');
    expect(q.answers.map((a) => a.label)).toEqual(['I’ll own them', 'Leave these 2 rows out']);
    const left = plan(rows, { answers: { [q.id]: { choice: 'leave' } } });
    expect(left.leftOut).toEqual([{ sheet: 'Metrics', row: 2 }, { sheet: 'Metrics', row: 3 }]);
    expect(left.items).toEqual([]);
    expect(plan(rows, { answers: { [q.id]: { choice: 'right' } } }).items).toHaveLength(2);
  });

  it('retires a metric with a reason, asking first when goals use it; brings a retired one back', () => {
    const noWhy = plan(sheet(`ID|Metric|Action\n${usedId}|Lead time for changes|Retire`));
    const q = checks(noWhy).find((x) => x.kind === 'big-removal')!;
    expect(q.title).toBe('Retiring 1 metric leaves 1 goal measured by a retired metric.');
    const answered = plan(sheet(`ID|Metric|Action|Reason\n${usedId}|Lead time for changes|Retire|`), { answers: { [q.id]: { choice: 'right' } } });
    expect(must(answered)).toEqual(['2 Reason: Say why it is retired, in a line. Its goals will show this.']);
    const ok = plan(sheet(`ID|Metric|Action|Reason\n${usedId}|Lead time for changes|Retire|Replaced by the DORA four keys.`), { answers: { [q.id]: { choice: 'right' } } });
    expect(ok.items.map((x) => x.kind)).toEqual(['retire record']);
    expect(said(ok)).toBe('1 metric retired');
    const retired = applyCommit(base, ok.commit!);
    expect(metric(retired, 'Lead time for changes').retiredAt).toBeTruthy();
    // Bring back, in the same file's words; and one that isn't retired says so.
    const back = plan(sheet(`ID|Metric|Action\n${usedId}|Lead time for changes|Bring back`), { full: retired });
    expect(back.items.map((x) => x.kind)).toEqual(['bring back record']);
    expect(metric(applyCommit(retired, back.commit!), 'Lead time for changes').retiredAt).toBeNull();
    expect(must(plan(sheet(`ID|Metric|Action\n${usedId}|Lead time for changes|Bring back`)))).toEqual(['2 Action: Bring back: Lead time for changes isn’t retired.']);
  });

  it('reads the header’s other names: Name, Description, Better, Owner e-mail; a header row is the sheet by its own test', () => {
    const asRead = readTables([{ name: 'Library', rows: [['Name', 'Unit', 'Better'], ['X metric', 'min', 'lower']] }, { name: 'Staff', rows: [['Name', 'Email', 'Team'], ['Ana', 'ana@example.com', 'Platform']] }], [{ name: 'Metrics', columns: METRICS_SHEET.spec.columns, loaded: true, also: METRICS_SHEET.also, is: METRICS_SHEET.is }]);
    expect(asRead.read).toEqual([{ name: 'Library', kind: 'Metrics' }, { name: 'Staff', kind: 'people' }]);
    const rows = sheet('Name|Unit|Better|Description|Owner e-mail\nOn-call pages per week|pages|Lower is better|Pages to the primary on-call, per week, over 4 weeks.|rhea.kapoor@example.com');
    expect(Object.keys(rows[0]!).sort()).toEqual(['__row', 'direction', 'meaning', 'metric', 'owner email', 'unit']);
    const cs = plan(rows);
    expect(must(cs)).toEqual([]);
    expect(cs.items).toHaveLength(1);
  });

  it('only a metric’s owner or an admin changes it; reading it back unchanged is fine for anyone', () => {
    const lead = metric(base, 'Lead time for changes');
    const tunde = plan(sheet(`ID|Metric|Caveats\n${lead.id}|Lead time for changes|Something new`), { actor: 'tunde' });
    expect(must(tunde)[0]).toMatch(/^2 Caveats: Only Rhea Kapoor or an admin can change Lead time for changes\./);
    expect(plan(sheet(`ID|Metric|Caveats\n${lead.id}|Lead time for changes|${lead.caveats}`), { actor: 'tunde' }).items).toEqual([]);
  });

  it('one Undo takes the whole load back: a metric added is removed, one changed is as it was', () => {
    const lead = metric(base, 'Lead time for changes');
    const cs = plan(sheet(`ID|Metric|Unit|Direction|Caveats\n|Undo me please|min|Lower is better|\n${lead.id}|Lead time for changes|hours|Lower is better|New caveat.`));
    expect(must(cs)).toEqual([]);
    const after = applyCommit(base, cs.commit!);
    const importId = cs.commit!.changes.find((c) => c.action === 'imported')!.entityId;
    const s = scopeToCycle(after, cycle);
    const undo = undoImport({ snapshot: s, cycle, week, actor: s.people.find((p) => p.id === 'rhea')!, now: '2026-11-05T13:00:00Z', newId, full: after, records: MODULE_RECORDS }, importId);
    expect(undo.restored).toBe(2);
    const back = applyCommit(after, undo.commit);
    expect(metric(back, 'Undo me please').removedAt).toBeTruthy();
    expect(metric(back, 'Lead time for changes').caveats).toBe(lead.caveats);
  });

  it('a Metrics sheet with no reader (its module switched off) is not read, and said once', () => {
    const s = scopeToCycle(base, cycle);
    const cs = planChanges({ tables: { modules: { Metrics: sheet('Metric|Unit|Direction\nX metric|min|Lower is better') } }, snapshot: s, cycle, week, actor: s.people.find((p) => p.id === 'rhea')!, now: today.toISOString(), newId, via: 'spreadsheet', full: base, workspace: 'Platform Engineering' });
    expect(cs.items).toEqual([]);
    expect(cs.issues.map((i) => [i.level, i.message])).toEqual([['note', 'The Metrics sheet was not read: its feature is switched off in Platform Engineering.']]);
  });

  it(`an unused metric's unit can change from a file (${unused ?? 'none in the demo'})`, () => {
    if (!unused) return;
    const m = metricsOf(base).find((x) => x.id === unused)!;
    const cs = plan(sheet(`ID|Metric|Unit\n${m.id}|${m.name}|things`), { actor: 'amara' });
    expect(must(cs)).toEqual([]);
    expect(cs.items).toHaveLength(1);
  });
});
