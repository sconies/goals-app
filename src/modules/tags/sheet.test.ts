// @vitest-environment node
/* Fields' columns on the Goals sheet (TG2, spec 2.4): one per live field, headed with its name, written by every export
   and read back by the change engine. Exported and loaded back, nothing changes; a value a list doesn't hold is asked
   once per value, an admin may add it and anyone else leaves the cells empty; with Fields off the columns are written by
   no export and read by nothing, and the file line names them. */
import { beforeAll, describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../../data/platformOrg';
import { applyCommit } from '../../data/store';
import { planChanges, type ChangeSet, type Tables } from '../../domain/changeset';
import { currentCycle, scopeToCycle } from '../../domain/cycle';
import { workbook } from '../../domain/export';
import { currentWeek } from '../../domain/plan';
import type { ModuleRecords } from '../../domain/records';
import { readTables, recordsOf } from '../../domain/sheets';
import type { ActionContext } from '../../domain/actions';
import type { Snapshot } from '../../domain/types';
import { addField, fieldsOf, liveFields, MODULE, setGoalFields, valueOf } from './fields';
import tags from './records';

const today = new Date('2026-11-05T12:00:00Z');
const built = buildPlatformOrg(today);
const cycle = currentCycle(built.cycles, today)!;
const week = currentWeek(cycle, today);
const RECORDS: ModuleRecords[] = [{ ...tags, module: MODULE }];
let n = 0;
const newId = (p: string) => `${p}_sh${++n}`;
const ctx = (s: Snapshot, who: string): ActionContext => ({ snapshot: s, cycle, week, actor: s.people.find((p) => p.id === who)!, now: today.toISOString(), newId });

/** The demo with Stage (Discover, Build, Run) and Programme (free text); lead-flaky in Build, ci-docker “Runners”. */
function withFields(): Snapshot {
  let s = applyCommit(structuredClone(built), addField(ctx(built, 'amara'), { name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'] }));
  s = applyCommit(s, addField(ctx(s, 'amara'), { name: 'Programme', kind: 'text', options: [] }));
  const [stage, prog] = liveFields(s);
  s = applyCommit(s, setGoalFields(ctx(s, 'amara'), s.goals.find((g) => g.id === 'lead-flaky')!, { [stage!.id]: 'Build' })!);
  return applyCommit(s, setGoalFields(ctx(s, 'amara'), s.goals.find((g) => g.id === 'ci-docker')!, { [prog!.id]: 'Runners' })!);
}
const scoped = (s: Snapshot) => scopeToCycle(s, cycle);
const grids = (s: Snapshot, on = true) => workbook({ ws: { id: 'platform-org', name: 'Platform Engineering' }, snapshot: scoped(s), cycle, week, today, goalColumns: on ? [tags.goalSheet!] : [] })
  .map((t) => ({ name: t.name, rows: t.rows.map((r) => r.map((c) => (c == null ? '' : String(c)))) }));
const load = (s: Snapshot, tables: Tables, who = 'amara', answers: Record<string, { choice: string }> = {}, on = true): ChangeSet =>
  planChanges({ tables, snapshot: scoped(s), cycle, week, actor: s.people.find((p) => p.id === who)!, now: today.toISOString(), newId, via: 'spreadsheet', full: s, answers, records: on ? RECORDS : [] });
const keyOf = (s: Snapshot, id: string) => s.goals.find((g) => g.id === id)!.key!;
const csv = (text: string) => recordsOf(text.split('\n').filter(Boolean).map((l) => l.split('|')));

beforeAll(() => tags.goalSheet!.load());

describe('the Goals sheet’s field columns', () => {
  it('has one column per live field, headed with its name, after the core’s; the README says what each holds', () => {
    const s = withFields();
    const goals = grids(s).find((g) => g.name === 'Goals')!;
    const head = goals.rows[0]!;
    expect(head.slice(-2)).toEqual(['Stage', 'Programme']);
    const row = goals.rows.find((r) => r[head.indexOf('Key')] === keyOf(s, 'lead-flaky'))!;
    expect(row.slice(-2)).toEqual(['Build', '']);
    const readme = grids(s).find((g) => g.name === 'Start here')!.rows.map((r) => r[0]);
    expect(readme).toContain('Stage');
  });

  it('exported and loaded back, changes nothing, and reads every column', () => {
    const s = withFields();
    const read = readTables(grids(s));
    const cs = load(s, read.tables);
    expect(cs.issues.filter((i) => i.level !== 'note')).toEqual([]);
    expect(cs.items).toEqual([]);
  });

  it('changes what differs, in History as the goal’s page says it, and an empty cell clears a value', () => {
    const s = withFields();
    const cs = load(s, { goals: csv(`key|stage|programme\n${keyOf(s, 'lead-flaky')}|run|\n${keyOf(s, 'ci-docker')}||Runners`) });
    expect(cs.issues.filter((i) => i.level !== 'note')).toEqual([]);
    expect(cs.items.map((i) => [i.goalId, i.diffs.map((d) => `${d.field}: ${d.from} → ${d.to}`)])).toEqual([['lead-flaky', ['Stage: Build → Run']]]);
    const after = applyCommit(s, cs.commit!);
    const stage = liveFields(after)[0]!;
    expect(valueOf(after, 'lead-flaky', stage.id)).toBe('Run');
    expect(after.changes.some((c) => c.entity === 'field' && c.goalId === 'lead-flaky' && c.summary === 'Stage: Build → Run' && c.importId)).toBe(true);
    const cleared = load(after, { goals: csv(`key|stage\n${keyOf(s, 'lead-flaky')}|`) });
    expect(cleared.items[0]!.diffs.map((d) => `${d.field}: ${d.from} → ${d.to}`)).toEqual(['Stage: Run → —']);
  });

  it('asks once about a value a list doesn’t hold; an admin may add it, and every row it covers takes it', () => {
    const s = withFields();
    const rows = `key|stage\n${keyOf(s, 'lead-flaky')}|Operate\n${keyOf(s, 'ci-docker')}|operate\n${keyOf(s, 'ns-ci')}|Build`;
    const cs = load(s, { goals: csv(rows) });
    const groups = cs.groups.filter((g) => g.kind === 'module-value');
    expect(groups.map((g) => [g.title, g.count, g.answers.map((a) => a.label)])).toEqual([['Stage says “Operate” on 2 rows. Add “Operate” to Stage, or leave these cells empty?', 2, ['Add “Operate” to Stage', 'Leave these cells empty']]]);
    expect(cs.commit).toBeNull();
    const added = load(s, { goals: csv(rows) }, 'amara', { [groups[0]!.id]: { choice: 'add' } });
    const after = applyCommit(s, added.commit!);
    const stage = liveFields(after)[0]!;
    expect(stage.options).toEqual(['Discover', 'Build', 'Run', 'Operate']);
    expect(['lead-flaky', 'ci-docker', 'ns-ci'].map((id) => valueOf(after, id, stage.id))).toEqual(['Operate', 'Operate', 'Build']);
    expect(after.changes.some((c) => c.entity === 'field' && c.summary === 'Stage’s values changed')).toBe(true);
  });

  it('anyone but an admin may only leave the cells empty, or fix the file', () => {
    const s = withFields();
    const own = s.goals.filter((g) => g.ownerId === 'rhea').slice(0, 1);
    const rows = `key|stage\n${own.map((g) => `${g.key}|Operate`).join('\n')}`;
    const cs = load(s, { goals: csv(rows) }, 'rhea');
    const g = cs.groups.find((x) => x.kind === 'module-value')!;
    expect(g.title).toBe('Stage says “Operate” on 1 row, which isn’t one of its values, and only an admin can add one. Leave these cells empty, or fix the file?');
    expect(g.answers.map((a) => a.choice)).toEqual(['empty']);
    // Answered "add" anyway (a forged answer), it is asked again; answered "empty", nothing changes for a goal with none.
    expect(load(s, { goals: csv(rows) }, 'rhea', { [g.id]: { choice: 'add' } }).commit).toBeNull();
    const empty = load(s, { goals: csv(rows) }, 'rhea', { [g.id]: { choice: 'empty' } });
    expect(empty.issues.filter((i) => i.level !== 'note')).toEqual([]);
    expect(fieldsOf(applyCommit(s, empty.commit ?? { changes: [] }))[0]!.options).toEqual(['Discover', 'Build', 'Run']);
  });

  it('refuses free text over 80 characters, and a goal its loader may not change', () => {
    const s = withFields();
    const long = load(s, { goals: csv(`key|programme\n${keyOf(s, 'lead-flaky')}|${'x'.repeat(81)}`) });
    expect(long.issues.map((i) => [i.kind, i.message])).toContainEqual(['too-long', 'Keep Programme to 80 characters.']);
    const other = s.goals.find((g) => g.ownerId !== 'rhea' && g.id !== 'lead-flaky')!;
    const not = load(s, { goals: csv(`key|stage\n${other.key}|Run`) }, 'rhea');
    expect(not.issues.map((i) => [i.kind, i.message])).toContainEqual(['not-allowed', 'Only the goal’s owner or an admin can change its fields.']);
  });

  it('with Fields off: no columns in an export, a file’s are read by nothing, and values stay (the file line: spreadsheets/unread.test.ts)', () => {
    const s = withFields();
    expect(grids(s, false).find((g) => g.name === 'Goals')!.rows[0]).not.toContain('Stage');
    const cs = load(s, { goals: csv(`key|stage\n${keyOf(s, 'lead-flaky')}|Run`) }, 'amara', {}, false);
    expect(cs.items).toEqual([]);
    expect(valueOf(s, 'lead-flaky', liveFields(s)[0]!.id)).toBe('Build');
  });
});
