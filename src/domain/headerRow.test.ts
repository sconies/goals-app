/* Rule 3: the header row (backlog IM5, C17; docs/design/import/spec.md, section 6). Found in the first ten rows, other
   names read as their column, a header one letter out asked about once, and a People sheet needs more than a Name. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg/generate';
import { planChanges } from './changeset';
import { currentWeek } from './plan';
import { gridOf, headerRowsLine, parseDelimited, readHeader, readLine, readTables } from './sheets';

describe('rule 3: the header row', () => {
  it('skips a title row above the headers', () => {
    const h = readHeader([['Platform goals FY27', ''], ['Goal', 'Level', 'Team', 'Owner'], ['Lead time', 'team', 'Platform', 'Rhea Kapoor']]);
    expect(h).toMatchObject({ row: 2, kind: 'goals' });
  });
  it('reads other names as their column', () => {
    const h = readHeader([['Goal name', 'Owner name', 'Target value', 'Units']]);
    expect(h.kind).toBe('goals');
    expect(h.columns.map((c) => [c.as, c.how])).toEqual([['Goal', 'also'], ['Owner', 'also'], ['Target', 'also'], ['Unit', 'also']]);
  });
  it('a Name with no other People column is no Faro sheet', () => {
    expect(readHeader([['Name', 'Department', 'Salary band']]).kind).toBeNull();
    expect(readHeader([['Name', 'Email']]).kind).toBe('people');
  });
  it('judges a People sheet with each kind’s own names: Title and Objective don’t make it Goals (#199 review)', () => {
    expect(readHeader([['Name', 'Email', 'Title']]).kind).toBe('people');
    expect(readHeader([['Name', 'Email', 'Team', 'Objective']]).kind).toBe('people');
    expect(readHeader([['Title', 'Owner', 'Target']]).kind).toBe('goals');
  });
  it('a header one letter out is near', () => {
    expect(readHeader([['Key', 'Goal', 'Targett']]).columns[2]).toMatchObject({ header: 'Targett', as: 'Target', how: 'near' });
  });
  it('readTables keeps each row’s number in the sheet, says the header row, and doesn’t list a near header as not read', () => {
    const r = readTables([{ name: 'Goals', rows: [['Platform goals FY27'], ['Goal', 'Owner', 'Targett'], ['Lead time', 'Rhea Kapoor', '3']] }]);
    expect(r.headerRows).toEqual([{ sheet: 'Goals', row: 2 }]);
    expect(r.tables.goals![0]).toMatchObject({ __row: '3', goal: 'Lead time', Targett: '3' });
    expect(readLine(r)).toBe('Read Goals.');
  });
});

describe('rule 3 in the engine (every door)', () => {
  const today = new Date('2026-11-05T13:00:00Z');
  const s = buildPlatformOrg(today);
  const cycle = s.cycles[0]!;
  let n = 0;
  const run = (tables: Parameters<typeof planChanges>[0]['tables'], answers = {}) => planChanges({ tables, snapshot: s, cycle, week: currentWeek(cycle, today), actor: s.people.find((p) => p.id === 'amara')!, now: today.toISOString(), newId: (p) => `${p}_h${++n}`, via: 'spreadsheet', answers });
  const row = { __row: '2', 'goal name': 'Pipeline cache hit rate', 'owner name': 'Rhea Kapoor', team: 'CI/CD', units: '%', start: '20', targett: '90' };
  it('asks once about a header one letter out, and reads it once answered', () => {
    const cs = run({ goals: [row] });
    const g = cs.groups.find((x) => x.kind === 'near-header')!;
    expect(g.title).toBe('A column on Goals is called “targett”. Read it as Target?');
    const answered = run({ goals: [row] }, { [g.id]: { choice: 'use' } });
    expect(answered.groups.filter((x) => x.level === 'must' || x.level === 'check').map((x) => x.kind)).toEqual([]);
    expect(answered.commit!.goals![0]).toMatchObject({ title: 'Pipeline cache hit rate', ownerId: 'rhea', unit: '%', plan: { target: 90 } });
  });
  it('a near header’s Must fix waits for its question (#199 review)', () => {
    const cs = run({ goals: [row] });
    expect(cs.groups.map((x) => x.kind)).toContain('near-header');
    expect(cs.issues.filter((x) => x.level === 'must' && x.column === 'Target')).toEqual([]);
    const id = cs.groups.find((x) => x.kind === 'near-header')!.id;
    const no = run({ goals: [row] }, { [id]: { choice: 'ignore' } });
    expect(no.issues.some((x) => x.level === 'must' && x.column === 'Target')).toBe(true);
  });
  it('two columns read as one are asked about, and the one chosen is read (#199 review)', () => {
    const two = { __row: '2', goal: 'Pipeline cache hit rate', 'goal name': 'Cache hits', owner: 'Rhea Kapoor', team: 'CI/CD', unit: '%', start: '20', target: '90' };
    const cs = run({ goals: [two] });
    const g = cs.groups.find((x) => x.kind === 'two-columns')!;
    expect(g.title).toBe('Two columns on Goals are read as Goal: “goal” and “goal name”. Which should be read?');
    expect(g.answers.map((a) => a.label)).toEqual(['Read “goal”', 'Read “goal name”']);
    expect(cs.issues.filter((x) => x.level === 'must' && x.column === 'Goal')).toEqual([]);
    expect(cs.commit).toBeNull();
    const picked = run({ goals: [two] }, { [g.id]: { choice: 'use:goal name' } });
    expect(picked.commit!.goals![0]!.title).toBe('Cache hits');
    expect(run({ goals: [two] }, { [g.id]: { choice: 'use:goal' } }).commit!.goals![0]!.title).toBe('Pipeline cache hit rate');
  });
  it('reads a header that differs only by punctuation, an accent or spacing as its column (#199 review)', () => {
    const lead = s.goals.find((g) => g.id === 'ns-lead')!;
    const target = lead.kind === 'metric' ? lead.plan.target : 0;
    for (const h of ['target.', 'tárget', 'target_']) {
      const cs = run({ goals: [{ __row: '2', id: 'ns-lead', goal: lead.title, [h]: String(target + 7), reason: 'Agreed at the review with the platform leads.' }] });
      expect(cs.items.find((i) => i.goalId === 'ns-lead')?.diffs.some((d) => /target/i.test(d.field)), h).toBe(true);
    }
  });
});

describe('rows keep their number in the file (IM5 review)', () => {
  it('a blank line in a CSV or a workbook stays, so the rows after it keep their numbers; blank lines at the end go', () => {
    const csv = parseDelimited('Goal,Owner\nLead time,Rhea Kapoor\n\nBuild minutes,Rhea Kapoor\n\n', { keepBlank: true });
    expect(csv).toHaveLength(4);
    const read = readTables([{ name: 'Goals.csv', rows: csv }]);
    expect(read.tables.goals!.filter((r) => r.goal).map((r) => [r.__row, r.goal])).toEqual([['2', 'Lead time'], ['4', 'Build minutes']]);
    expect(read.rowCount).toBe(2);
    expect(gridOf([['Goal', 'Owner'], [null, ''], ['Lead time', 'Rhea Kapoor'], [null, null]])).toEqual([['Goal', 'Owner'], ['', ''], ['Lead time', 'Rhea Kapoor']]);
    // Read without keepBlank (a paste into a form), blank lines still go.
    expect(parseDelimited('a,b\n\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('the separator is the header row’s, not a title line’s', () => {
    expect(parseDelimited('Platform goals FY27\nGoal\tOwner\tUnit\nLead time\tRhea Kapoor\th')).toEqual([['Platform goals FY27'], ['Goal', 'Owner', 'Unit'], ['Lead time', 'Rhea Kapoor', 'h']]);
    expect(parseDelimited('Goals; FY27\nGoal,Owner,Unit\nLead time,Rhea Kapoor,h')[1]).toEqual(['Goal', 'Owner', 'Unit']);
  });
  it('says the header row only when something above it was skipped', () => {
    const titled = readTables([{ name: 'Goals', rows: [['Platform goals FY27'], ['Goal', 'Owner'], ['Lead time', 'Rhea Kapoor']] }]);
    expect(headerRowsLine(titled)).toBe('Row 2 of Goals is the header row; 1 row above it was skipped.');
    expect(headerRowsLine(readTables([{ name: 'Goals', rows: [[''], ['Goal', 'Owner'], ['Lead time', 'Rhea Kapoor']] }]))).toBe('');
  });
});
