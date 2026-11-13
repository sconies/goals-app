// @vitest-environment node
/* Kinds, levels and near misses (backlog IM2; docs/design/import/spec.md, section 4 and rules 4, 6 and 7): every worked
   example, a case per kind (its sentence, its level, its group), and the design's sample files as fixtures. */
import fs from 'node:fs';
import { buildPlatformOrg } from '../data/platformOrg';
import { planChanges, records, type ChangeInput, type Rec } from './changeset';
import { LEVEL_WORDS, TYPE_WORDS, wordsAndAlso } from './columns';
import { CHECK_KINDS, editDistance, fold, groupIssues, issueOf, levelOf, MUST_KINDS, near, whereText } from './problemLevels';
import { currentWeek, planAt } from './plan';
import type { MetricGoal, Snapshot } from './types';

const today = new Date('2026-11-11T12:00:00Z');
const demo = buildPlatformOrg(today);
// The samples name a team "Platform", which the demo doesn't have: added, so "Platfrom" is one letter from it.
const s: Snapshot = { ...demo, teams: [...demo.teams, { id: 'platform', name: 'Platform', leadId: '', objective: '' }] };
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const person = (id: string) => s.people.find((p) => p.id === id)!;
let n = 0;
const base = (actor: string, tables: ChangeInput['tables'], extra: Partial<ChangeInput> = {}): ChangeInput => ({
  tables, snapshot: s, cycle, week, actor: person(actor), now: today.toISOString(), newId: (p) => `${p}_l${++n}`, via: 'spreadsheet', ...extra,
});
const rec = (o: Record<string, string>, row = 2): Rec => ({ __row: String(row), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v])) });
const run = (actor: string, tables: ChangeInput['tables'], extra: Partial<ChangeInput> = {}) => planChanges(base(actor, tables, extra));
const sample = (f: string) => records(fs.readFileSync(`docs/design/import/samples/${f}`, 'utf8'));
const asked = (cs: ReturnType<typeof run>) => cs.groups.filter((g) => g.level !== 'note').map((g) => `${g.level} ${g.kind} ${g.count}`);

describe('rule 4: fold and near', () => {
  const teams = s.teams.map((t) => t.name);
  const people = s.people.map((p) => p.name);
  it('folds case, accents, “&” and “and”, and punctuation', () => {
    expect(fold('  CI/CD ')).toBe('ci cd');
    expect(fold('Build & Release')).toBe(fold('Build and Release'));
    expect(fold('Zoë  Müller')).toBe('zoe muller');
    expect(editDistance('platfrom', 'platform')).toBe(1);
  });
  it('gives the worked examples', () => {
    expect(near('Platfrom', teams)).toEqual({ near: 'Platform' });
    expect(near('CI CD', teams)).toEqual({ exact: 'CI/CD' });
    expect(near('Build and Release', teams)).toEqual({ exact: 'Build & Release' });
    expect(near('Rhea Kapor', people)).toEqual({ near: 'Rhea Kapoor' });
    expect(near('Rhea', people)).toEqual({ none: true });
    expect(near('vp', wordsAndAlso(LEVEL_WORDS))).toEqual({ none: true });
    expect(near('numbr', wordsAndAlso(TYPE_WORDS))).toEqual({ near: 'number' });
    // Two within reach: asked by name, never guessed.
    expect(near('Platfrom', ['Platform', 'Platforms'])).toEqual({ none: true });
  });
});

describe('rule 6: issues with kinds, and groups', () => {
  it('gives every kind its fixed level', () => {
    for (const k of MUST_KINDS) expect(levelOf(k)).toBe('must');
    for (const k of CHECK_KINDS) expect(levelOf(k)).toBe('check');
    expect(levelOf('by-name')).toBe('note');
  });
  it('makes 14 rows naming “Platfrom” one group, and says where they are', () => {
    const issues = Array.from({ length: 14 }, (_, k) => issueOf('near-ref', 'Goals', 18 + k, `Goal ${k}`, 'There’s no team called “Platfrom”. Did you mean Platform?', { column: 'Team', found: k % 2 ? 'platfrom ' : 'Platfrom', suggest: 'Platform' }));
    const groups = groupIssues(issues);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ count: 14, where: 'Goals, rows 18 to 31', level: 'check', kind: 'near-ref', title: '14 rows name a team that isn’t here: “Platfrom”. Did you mean Platform?' });
  });
  it('says rows as runs: “2 to 4 and 9”; over three runs, the first three and how many more', () => {
    expect(whereText('Goals', [2, 3, 4, 9])).toBe('Goals, rows 2 to 4 and 9');
    expect(whereText('Goals', [5])).toBe('Goals, row 5');
    expect(whereText('Check-ins', [2, 4, 6, 8, 9, 10])).toBe('Check-ins, rows 2, 4, 6 and 3 more');
  });
  it('keeps a group’s id when the same problem is in a corrected file', () => {
    const a = run('amara', { goals: sample('05b-same-team-typo-14.csv') });
    const b = run('amara', { goals: sample('05b-same-team-typo-14.csv').slice(0, 3) });
    expect(a.groups.find((g) => g.kind === 'near-ref')!.id).toBe(b.groups.find((g) => g.kind === 'near-ref')!.id);
  });
});

describe('rule 7: one answer covers every row in its group', () => {
  it('[IMPORT-LEVELS] 14 rows for “Platfrom”: one question; “Use Platform” reads every row as Platform and saves', () => {
    const t = { goals: sample('05b-same-team-typo-14.csv') };
    const cs = run('amara', t);
    expect(asked(cs)).toEqual(['check near-ref 14']);
    expect(cs.commit).toBeNull();
    const g = cs.groups[0]!;
    expect(g.answers.map((a) => a.label)).toEqual(['Use Platform', 'Add Platfrom as a new team', 'Choose another']);
    const done = run('amara', t, { answers: { [g.id]: { choice: 'use' } } });
    expect(asked(done)).toEqual([]);
    expect(done.counts.newGoals).toBe(14);
    expect(done.commit!.goals!.every((x) => x.teamId === 'platform')).toBe(true);
  });
  it('[IMPORT-LEVELS] an admin may add the team instead (C8); someone else isn’t offered it', () => {
    const t = { goals: sample('05b-same-team-typo-14.csv') };
    const id = run('amara', t).groups[0]!.id;
    const added = run('amara', t, { answers: { [id]: { choice: 'new' } } });
    expect(added.commit!.teams!.map((x) => x.name)).toEqual(['Platfrom']);
    expect(added.items.filter((x) => x.kind === 'team').map((x) => x.summary)).toEqual(['Added the team “Platfrom”']);
    expect(run('rhea', t).groups[0]!.answers.map((a) => a.choice)).toEqual(['use', 'choose']);
  });
  it('[IMPORT-LEVELS] “Leave these rows out” leaves them out and saves the rest', () => {
    const t = { goals: [...sample('05b-same-team-typo-14.csv').slice(0, 2), rec({ Goal: 'Fine goal', Owner: 'Rhea Kapoor', Team: 'CI/CD', Unit: '%', Start: '1', Target: '5' }, 20)] };
    const cs = run('amara', t);
    const done = run('amara', t, { answers: { [cs.groups.find((g) => g.kind === 'near-ref')!.id]: { choice: 'leave' } } });
    expect(done.leftOut).toEqual([{ sheet: 'Goals', row: 2 }, { sheet: 'Goals', row: 3 }]);
    expect(done.counts.newGoals).toBe(1);
    expect(done.commit).not.toBeNull();
  });
  it('[IMPORT-LEVELS] “Keep 2 decimal places for these goals” gives each goal the places, so its check-ins save', () => {
    const g = s.goals.find((x) => x.key === 'G-23') as MetricGoal;
    const t = { checkIns: [rec({ 'Goal key': 'G-23', Week: String(week), Value: '9.25', Call: 'On track', Why: 'Recounted after the cache change.' })] };
    const cs = run('amara', t);
    const p = cs.groups.find((x) => x.kind === 'precision')!;
    expect(p).toMatchObject({ level: 'must', answers: [{ choice: 'keep', label: 'Keep 2 decimal places for this goal' }] });
    const done = run('amara', t, { answers: { [p.id]: { choice: 'keep' } } });
    expect(done.issues.filter((i) => i.level === 'must')).toEqual([]);
    expect((done.commit?.goals ?? []).find((x) => x.id === g.id)).toMatchObject({ decimals: 2 });
  });
  it('[IMPORT-LEVELS] a decimal comma is asked about in a file, and read as a decimal point in the check-in grid, where it’s typed', () => {
    const g = s.goals.find((x) => x.cycleId === cycle.id && x.kind === 'metric' && x.decimals === 1 && !x.removedAt && !s.checkIns.some((c) => c.goalId === x.id && c.week === week)) as MetricGoal;
    const at = planAt(g.plan, week, cycle.weeks).toFixed(1);
    const t = { checkIns: [rec({ 'Goal ID': g.id, Week: String(week), Value: at.replace('.', ',') })] };
    expect(run('amara', t).issues.map((i) => i.kind)).toContain('decimal-comma');
    // The one-table check-in is the owner's own (check-ins are the owner's, R1).
    const grid = run(g.ownerId, t, { via: 'bulk' });
    expect(grid.issues.filter((i) => i.level !== 'note')).toEqual([]);
    expect(grid.commit!.checkIns!.find((c) => c.goalId === g.id)).toMatchObject({ week, value: Number(at) });
  });
  it('[IMPORT-LEVELS] a stage already past (C4): “They’re done” records them done in their due weeks; “Count them from this week” moves them', () => {
    const t = { goals: [rec({ Goal: 'Runbooks rewritten', Owner: 'Rhea Kapoor', Type: 'milestone', Stages: 'Draft@40; Signed off@50' })] };
    const cs = run('amara', t);
    const q = cs.groups.find((g) => g.kind === 'past-stage')!;
    expect(q.answers.map((a) => a.label)).toEqual(['They’re done', 'They’re not done', 'Count them from this week']);
    const done = run('amara', t, { answers: { [q.id]: { choice: 'done' } } });
    expect(done.commit!.checkIns!).toEqual([expect.objectContaining({ week: 40, stages: expect.arrayContaining([expect.objectContaining({ doneWeek: 40 })]) })]);
    const moved = run('amara', t, { answers: { [q.id]: { choice: 'from-now' } } });
    const stages = (moved.commit!.goals![0] as Extract<Snapshot['goals'][number], { kind: 'milestone' }>).stages;
    expect(stages.every((x) => x.dueWeek >= week)).toBe(true);
  });
  it('[IMPORT-LEVELS] a duplicate (C14): both rows named, neither applied; “Use the last row for each” applies the last', () => {
    const t = { goals: sample('06-duplicates.csv').slice(0, 2) };
    const cs = run('amara', t);
    expect(cs.issues.filter((i) => i.kind === 'duplicate').map((i) => [i.row, i.message])).toEqual([[2, 'Key G-1 is on rows 2 and 3. Give each goal one row.'], [3, 'Key G-1 is on rows 2 and 3. Give each goal one row.']].map(([r]) => [r, '“Lead time for changes” is on rows 2 and 3. Give each goal one row.']));
    const last = run('amara', t, { answers: { [cs.groups[0]!.id]: { choice: 'last' } }, reason: 'Agreed at the review', confirm: true });
    expect((last.commit!.goals![0] as MetricGoal).plan.target).toBe(22);
  });
});

describe('section 4: a case per kind, with its sentence and level', () => {
  const g1 = s.goals.find((x) => x.key === 'G-1') as MetricGoal;
  const newGoal = (o: Record<string, string>, row = 2) => rec({ Goal: 'A new goal', Owner: 'Rhea Kapoor', Unit: '%', Start: '10', Target: '50', ...o }, row);
  const twoSams: Snapshot = { ...s, people: [...s.people, { ...person('rhea'), id: 'sam1', name: 'Sam Lee', email: 'sam.lee@example.com' }, { ...person('rhea'), id: 'sam2', name: 'Sam Lee', email: 'sam.lee2@example.com' }] };
  const others = s.checkIns.filter((c) => c.authorId === 'rhea' && c.week < week - 2).slice(-10);
  const cases: [kind: string, actor: string, tables: ChangeInput['tables'], sentence: RegExp, extra?: Partial<ChangeInput>][] = [
    ['required-empty', 'amara', { goals: [rec({ Goal: 'No owner', Unit: '%', Start: '1', Target: '2' })] }, /A new goal needs an owner: Owner email, or Owner\./],
    ['required-empty', 'amara', { goals: [newGoal({ Start: '' })] }, /^Enter where it starts today\.$/],
    ['not-a-number', 'amara', { checkIns: [rec({ 'Goal key': 'G-14', Week: String(week), Value: 'six' })] }, /“six” isn’t a number/],
    ['formula', 'amara', { goals: [newGoal({ Target: '=20+2' })] }, /Target holds a formula \(“=20\+2”\), not a number\. In Excel, copy the column and paste it as values\./],
    ['precision', 'amara', { checkIns: [rec({ 'Goal key': 'G-14', Week: String(week), Value: '6.25' })] }, /has 2 decimal places, but this goal keeps whole numbers/],
    ['impossible-number', 'amara', { checkIns: [rec({ 'Goal key': 'G-31', Week: String(week), Value: '-4' })] }, /can’t be below zero %/],
    ['unknown-word', 'amara', { goals: [rec({ Key: 'G-1', Level: 'vp' })] }, /^Level says “vp”\. Use north star, svp or team\.$/],
    ['unknown-ref', 'amara', { goals: [newGoal({ Team: 'Infra Guild' })] }, /There’s no team called “Infra Guild”\./],
    ['ambiguous-ref', 'amara', { goals: [newGoal({ Owner: 'Sam Lee' })] }, /2 people are called “Sam Lee”\. Use their email instead/, { snapshot: twoSams }],
    ['conflicting-refs', 'amara', { goals: [newGoal({ 'Owner email': 'tunde.bakare@example.com' })] }, /Owner and Owner email name different people \((Rhea Kapoor and Tunde Bakare|Tunde Bakare and Rhea Kapoor)\)/],
    ['bad-key', 'amara', { goals: [rec({ Key: '12', Goal: 'x' })] }, /Key “12” should look like G-12\./],
    ['bad-key', 'amara', { goals: [rec({ Key: 'G-999', Goal: 'x' })] }, /There’s no goal with key G-999 in 2026\./],
    ['duplicate', 'amara', { goals: [rec({ Key: 'G-1', Target: '20' }), rec({ Key: 'G-1', Target: '22' }, 3)] }, /is on rows 2 and 3\. Give each goal one row\./],
    ['type-unclear', 'amara', { goals: [newGoal({ Stages: 'Design@50' })] }, /Type is empty and the row has Start and Target, and Stages\. Say metric, range or milestone\./],
    ['type-unclear', 'amara', { goals: [rec({ Goal: 'Nothing to measure', Owner: 'Rhea Kapoor' })] }, /Type is empty and the row has no Start and Target, Limit or Stages\./],
    ['plan-order', 'amara', { goals: [newGoal({ 'Due week': '10' })] }, /To \(week 10, 2–8 Mar 2026\) isn’t after From \(week 46, 9–15 Nov 2026\)\. The plan has to run forwards\./],
    ['stage-format', 'amara', { goals: [rec({ Goal: 'Stages goal', Owner: 'Rhea Kapoor', Type: 'milestone', Stages: 'Design; Pilot@50' })] }, /“Design” has no week\. Write it as Name@week, like Pilot@52\./],
    ['stage-format', 'amara', { goals: [rec({ Goal: 'Stages goal', Owner: 'Rhea Kapoor', Type: 'milestone', Stages: 'Pilot@50; pilot@52' })] }, /^Two stages are called “Pilot”\. Give each its own name, such as “pilot review”\.$/],
    ['week-wrong', 'amara', { checkIns: [rec({ 'Goal key': 'G-14', Week: '50', Value: '6' })] }, /Week 50 hasn’t happened yet; it’s week 46\./],
    ['checkin-incomplete', 'amara', { checkIns: [rec({ 'Goal key': 'G-126', Week: String(week), Value: '4.1' })] }, /needs a Cause and a Why of 10 characters or more/],
    ['cant-change', 'amara', { goals: [rec({ Key: 'G-1', Type: 'milestone' })] }, /A goal’s type can’t change\. Add a new goal instead\./],
    ['not-allowed', 'tunde', { goals: [rec({ Key: 'G-1', Target: String(g1.plan.target - 1) })] }, /Only Rhea Kapoor \(its owner\) or an admin can change “Lead time for changes”\./, { reason: 'x' }],
    ['removal-refused', 'amara', { goals: [rec({ Key: 'G-14', Action: 'Stop' })] }, /Say why/],
    ['removal-refused', 'amara', { goals: [newGoal({ Action: 'Stop', Reason: 'Not needed' })] }, /^Stop needs the goal’s Key, to say which goal\. To add “.+” instead, leave Action empty\.$/],
    ['removal-refused', 'amara', { goals: [newGoal({ Action: 'Delete' })] }, /^Delete needs the goal’s Key/],
    ['loop', 'amara', { goals: [rec({ Key: 'G-1', 'Feeds into key': 'G-1' })] }, /A goal can’t feed into itself\./],
    ['near-ref', 'amara', { goals: [newGoal({ Owner: 'Rhea Kapor' })] }, /“Rhea Kapor” isn’t here\. Did you mean Rhea Kapoor\?/],
    ['near-ref', 'amara', { goals: [newGoal({ Team: 'CI/DC' })] }, /There’s no team called “CI\/DC”\. Did you mean CI\/CD\?/],
    ['near-word', 'amara', { goals: [newGoal({ Type: 'numbr' })] }, /^Type says “numbr”\. Read it as number\?$/],
    ['same-person', 'amara', { people: [rec({ Name: 'Rhea Kapoor', Email: 'rhea.k@example.com', Team: 'CI/CD' })] }, /“Rhea Kapoor” \(rhea\.k@example\.com\) looks like Rhea Kapoor \(CI\/CD\), who is already here\./],
    ['same-goal', 'amara', { goals: [newGoal({ Goal: 'Pipeline queue wait (p90)', Team: 'CI/CD' })] }, /A goal called “Pipeline queue wait \(p90\)” is already here \(G-14, CI\/CD\)\./],
    ['other-goal', 'amara', { goals: [rec({ Key: 'G-1', Goal: 'Net revenue retention', Target: '110' })] }, /G-1 is “Lead time for changes” here, owned by Rhea Kapoor\. Row 2 calls it “Net revenue retention”\. Is it the same goal\?/],
    ['past-stage', 'amara', { goals: [rec({ Goal: 'P1', Owner: 'Rhea Kapoor', Type: 'milestone', Stages: 'Design@2; Pilot@6; All services@10' })] }, /3 stages of “P1” are due before this week \(week 46\)/],
    ['past-plan', 'amara', { goals: [newGoal({ 'Plan from week': '1', 'Due week': '10' })] }, /has a plan that ended in week 10; it’s week 46\./],
    ['odd-number', 'amara', { goals: [newGoal({ Unit: 'ms', Start: '3', Target: '3000' })] }, /^The target \(3,000 ms\) is over 100 times where it starts \(3 ms\)\. Is that right\?$/],
    ['feeds-lower', 'amara', { goals: [newGoal({ Level: 'north star', 'Feeds into key': 'G-14' })] }, /^A north star usually feeds nothing, and “Pipeline queue wait \(p90\)” is an? (SVP|Team) goal\. Is this link right\?$/],
    ['plan-question', 'amara', { goals: [rec({ Key: 'G-1', Target: String(2 * g1.plan.start - g1.plan.target) })] }, /This makes (higher|lower) better/, { reason: 'Measured the other way round' }],
    ['no-unit', 'amara', { goals: [newGoal({ Unit: '' })] }, /This number has no unit\. Is it a plain count\?/],
    ['decimal-comma', 'amara', { goals: [newGoal({ Start: '1,5' })] }, /“1,5” was read as 1\.5/],
    ['replaces-others', 'amara', { checkIns: others.map((c, k) => rec({ ID: c.id, 'Goal ID': c.goalId, Week: String(c.week), 'Next step': `Next step number ${k}` }, k + 2)) }, /10 rows replace check-ins other people posted\./],
    ['many-admins', 'amara', { people: ['rhea', 'tunde', 'samir'].map((id, k) => rec({ Email: person(id).email ?? '', Admin: 'yes' }, k + 2)) }, /3 people would become admins\. Is that right\?/],
    ['totals-row', 'amara', { goals: [rec({ Goal: 'TOTAL', Start: '10', Target: '550' })] }, /Row 2 is called “TOTAL” and has no owner\. It looks like a totals row\./],
    ['big-removal', 'amara', { goals: s.goals.filter((g) => g.cycleId === cycle.id && !g.removedAt && !s.checkIns.some((c) => c.goalId === g.id)).concat(s.goals.filter((g) => g.ownerId === 'rhea')).slice(0, 5).map((g, k) => rec({ ID: g.id, Action: 'Stop', Reason: 'No longer needed this year.' }, k + 2)) }, /This file stops 5 goals\. Is that right\?/],
  ];
  it.each(cases)('[IMPORT-LEVELS] %s (as %s)', (kind, actor, tables, sentence, extra) => {
    const cs = run(actor, tables, extra);
    const found = cs.issues.find((i) => i.kind === kind);
    expect(found, cs.issues.map((i) => `${i.kind}: ${i.message}`).join(' / ')).toBeDefined();
    expect(found!.message).toMatch(sentence);
    expect(found!.level).toBe(levelOf(found!.kind));
    expect(cs.groups.some((g) => g.id === found!.group && g.kind === kind)).toBe(true);
    expect(cs.commit).toBeNull();
  });
  it('raises every Must fix kind and every Check kind it owns (near-header and other-workspace come with the preview, IM3/IM5; new-team at set-up, ST4)', () => {
    const covered = new Set(cases.map(([k]) => k));
    expect(MUST_KINDS.filter((k) => !covered.has(k))).toEqual([]);
    expect(CHECK_KINDS.filter((k) => !covered.has(k))).toEqual(['near-header', 'two-columns', 'new-team', 'other-workspace']); // near-header, two-columns: headerRow.test.ts
  });
});

describe('the design’s samples (docs/design/import/samples) as fixtures', () => {
  const kinds = (f: string, sheet: 'goals' | 'checkIns' = 'goals') => asked(run('amara', { [sheet]: sample(f) }));
  it('03: no Type column, read from the columns filled in', () => {
    const cs = run('amara', { goals: sample('03-no-type-column.csv') });
    expect(asked(cs)).toEqual([]);
    expect(cs.commit!.goals!.map((g) => g.kind)).toEqual(['metric', 'milestone']);
  });
  it('04: numbers', () => expect(kinds('04-numbers.csv')).toEqual(['must not-a-number 1', 'must impossible-number 1', 'must required-empty 1', 'check decimal-comma 2', 'check odd-number 2', 'check odd-number 1', 'check odd-number 1', 'check no-unit 1', 'check odd-number 1']));
  it('05: typos are asked, a word too short to be near is Must fix', () => expect(kinds('05-typos.csv')).toEqual(['must unknown-word 1', 'must unknown-ref 1', 'check near-ref 1', 'check near-ref 1', 'check near-word 1', 'check near-ref 1']));
  it('[IMPORT-LEVELS] 05b: fourteen rows with one typo are one question', () => expect(kinds('05b-same-team-typo-14.csv')).toEqual(['check near-ref 14']));
  it('06: duplicates and keys', () => expect(kinds('06-duplicates.csv')).toEqual(['must duplicate 4', 'must bad-key 1', 'must bad-key 1', 'check same-goal 1']));
  it('07: past dates, and dates read as weeks', () => expect(kinds('07-past-dates.csv')).toEqual(['must stage-format 2', 'must plan-order 1', 'check past-stage 1']));
  it('08: check-ins', () => expect(kinds('08-checkins.csv', 'checkIns')).toEqual(['must week-wrong 2', 'must duplicate 2', 'must not-a-number 1', 'must precision 1', 'must impossible-number 1', 'must checkin-incomplete 1', 'must checkin-incomplete 1', 'must bad-key 1', 'must unknown-word 1', 'check decimal-comma 1']));
  it('09e: a totals row is asked about', () => expect(kinds('09e-blank-and-merged.csv')).toEqual(['must required-empty 1', 'check totals-row 1']));
  it('09f: decimal commas, asked once', () => expect(kinds('09f-semicolons.csv')).toEqual(['check decimal-comma 4']));
  it('09h: keys from another workspace name other goals', () => expect(kinds('09h-other-workspace-keys-only.csv')).toEqual(['check other-goal 1', 'check other-goal 1']));
  it('18: defaults: no unit asked once for the file, a past stage asked, a plan that ends before it starts', () => expect(kinds('18-defaults.csv')).toEqual(['must plan-order 1', 'check no-unit 2', 'check past-stage 1']));
});
