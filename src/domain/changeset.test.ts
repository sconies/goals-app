// @vitest-environment node
import { applyCommit } from '../data/store';
import { planChanges, records, type ChangeInput, type Rec } from './changeset';
import { sheetKindOf } from './columns';
import { toCsv, workbook } from './export';
import { parseTable } from './importer';
import { currentWeek, planAt } from './plan';
import { cycleDates } from './cycle';
import { goalStatus } from './status';
import { buildPlatformOrg } from '../data/platformOrg';
import type { MetricGoal } from './types';
import type { ModuleRecords } from './records';
import { blankGoal } from './goal';
import { goalMustFix } from './goalEntry';

const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const person = (id: string) => s.people.find((p) => p.id === id)!;
let n = 0;
const base = (actor: string, tables: ChangeInput['tables'], extra: Partial<ChangeInput> = {}): ChangeInput => ({
  tables, snapshot: s, cycle, week, actor: person(actor), now: today.toISOString(), newId: (p) => `${p}_t${++n}`, via: 'spreadsheet', ...extra,
});
const rec = (o: Record<string, string>): Rec => ({ __row: '2', ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v])) });
/** Problems and things to check: how a row was read (an owner found by name) is a note, not either. */
const real = (cs: ReturnType<typeof planChanges>) => cs.issues.filter((i) => i.severity !== 'note');
const tsvOf = (rows: (string | number | null)[][]) => rows.map((r) => r.map((c) => (c == null ? '' : String(c))).join('\t')).join('\n');

describe('bulk changes', () => {
  it('loads an unedited export back as no changes', () => {
    const wb = workbook({ ws: { id: 'ws', name: 'P' }, snapshot: s, cycle, week, today });
    const cs = planChanges(base('amara', { goals: records(tsvOf(wb[1]!.rows)), plan: records(tsvOf(wb[2]!.rows)), checkIns: records(tsvOf(wb[3]!.rows)) }));
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(cs.items).toEqual([]);
    expect(cs.commit).toBeNull();
  });

  it('lets an owner load the whole workbook back after changing only their own goal (research round 1)', () => {
    // Mateo isn't an admin. Rows for other people's goals that he didn't touch must not block his own changes.
    expect(person('mateo').admin).toBeFalsy();
    const wb = workbook({ ws: { id: 'ws', name: 'P' }, snapshot: s, cycle, week, today });
    const ci = records(tsvOf(wb[3]!.rows));
    const weeks = ci.filter((r) => r['goal id'] === 'mttr-pir').map((r) => r['week']!).slice(20, 23);
    const own = ci.filter((r) => r['goal id'] === 'mttr-pir' && weeks.includes(r['week']!));
    expect(own.length).toBe(3);
    for (const r of own) r['value'] = String(Number(r['value']) + 1);
    const cs = planChanges(base('mateo', { goals: records(tsvOf(wb[1]!.rows)), plan: records(tsvOf(wb[2]!.rows)), checkIns: ci }));
    expect(cs.issues.filter((i) => i.severity === 'error').map((i) => i.message)).toEqual([]);
    expect(cs.counts.checkIns).toBe(3);
    expect(cs.commit).not.toBeNull();
    // A change he did make to someone else's goal is still refused.
    const goals = records(tsvOf(wb[1]!.rows));
    goals.find((r) => r['id'] === 'ns-ai')!['target'] = '90';
    const refused = planChanges(base('mateo', { goals }));
    expect(refused.issues.map((i) => i.message)).toEqual([expect.stringMatching(/Only Tariq Haddad \(its owner\) or an admin/)]);
  });

  it('tells which sheet is which from its header alone', () => {
    expect(sheetKindOf(['Goal ID', 'Week', 'Value'])).toBe('checkIns');
    expect(sheetKindOf(['ID', 'Goal', 'Unit', 'Start', 'Week 1', 'Week 2'])).toBe('plan');
    expect(sheetKindOf(['ID', 'Goal', 'Owner'])).toBe('goals');
    expect(sheetKindOf(['Email', 'ID', 'Name', 'Job title', 'Team', 'Admin'])).toBe('people');
    expect(sheetKindOf(['ID', 'Kind', 'Ask', 'Goals', 'Asked by'])).toBe('asks');
  });

  it('adds a new goal and changes an existing one, logging both', () => {
    const cs = planChanges(base('amara', { goals: [
      rec({ Goal: 'Runbooks with an owner', Owner: 'Mateo Fernández', Type: 'metric', Unit: '%', Start: '20', Target: '90', 'Feeds into': 'Change failure rate' }),
      { ...rec({ ID: 'ns-ai', Level: 'svp' }), __row: '3' },
    ] }));
    expect(real(cs)).toEqual([]);
    // Matched by a name only one person has, and said so.
    expect(cs.issues).toEqual([expect.objectContaining({ severity: 'note', message: expect.stringMatching(/“Mateo Fernández” matched by name/) }), expect.objectContaining({ kind: 'default', message: expect.stringMatching(/the owner’s team; the row gave none/) })]);
    expect(cs.counts).toEqual(expect.objectContaining({ newGoals: 1, goals: 1 }));
    const after = applyCommit(s, cs.commit!);
    const fresh = after.goals.find((g) => g.title === 'Runbooks with an owner')!;
    expect(fresh.parentId).toBe('ns-cfr');
    expect(after.goals.find((g) => g.id === 'ns-ai')!.level).toBe('svp');
    expect(cs.commit!.changes.every((c) => c.diffs.some((d) => d.field === 'Via' && d.to === 'Spreadsheet'))).toBe(true);
    expect(cs.commit!.changes.at(-1)!.entity).toBe('workspace');
  });

  it('refuses an Effect that isn’t a number on a new goal’s row, in the form’s words, though its parent is read later', () => {
    const row = (o: Record<string, string>) => rec({ Goal: 'Runbooks with an owner', Owner: 'Mateo Fernández', Type: 'metric', Unit: '%', Start: '20', Target: '90', Effect: 'lots', ...o });
    const form = goalMustFix({ ...blankGoal('cicd', 'mateo', ''), title: 'Runbooks with an owner', parentId: 'ns-lead', effect: 'lots' }, { cycleWeeks: cycle.weeks, week, existing: null, door: 'form' }).find((f) => f.field === 'effect')!.text;
    const cs = planChanges(base('mateo', { goals: [row({ 'Feeds into ID': 'ns-lead' })] }));
    expect(real(cs)).toContainEqual(expect.objectContaining({ kind: 'not-a-number', column: 'Effect', message: form }));
    expect(cs.commit).toBeNull();
    // With nothing to feed, an Effect says nothing, as on the form: it isn't kept, and isn't judged.
    expect(real(planChanges(base('mateo', { goals: [row({})] }))).filter((i) => i.column === 'Effect')).toEqual([]);
  });

  it('asks about a target on the worse side of the metric that measures the goal (wrong-side), from a module’s records', () => {
    const g = s.goals.find((x): x is MetricGoal => x.id === 'ns-lead')!;
    const records: ModuleRecords[] = [{ module: 'test', records: [], measures: (_s, id) => (id === 'ns-lead' ? { name: 'Lead time for changes', direction: 'lower' } : null) }];
    const row = [rec({ ID: 'ns-lead', Start: String(g.plan.target - 2), Target: String(g.plan.target - 1) })];
    const wrong = (cs: ReturnType<typeof planChanges>) => cs.issues.filter((i) => i.found === 'wrong-side');
    expect(wrong(planChanges(base('rhea', { goals: row }, { reason: 'Re-based on the new dashboard' })))).toEqual([]);
    const cs = planChanges(base('rhea', { goals: row }, { reason: 'Re-based on the new dashboard', records }));
    expect(wrong(cs)).toEqual([expect.objectContaining({ kind: 'odd-number', column: 'Target', message: expect.stringMatching(/^“Lead time for changes” is better lower, but the target/) })]);
    expect(cs.commit).toBeNull();
  });

  it('asks about a unit a row clears, as the form does (no-unit)', () => {
    const g = s.goals.find((x) => x.id === 'ns-lead')!;
    const cs = planChanges(base('rhea', { goals: [rec({ ID: g.id, Unit: '' })] }));
    expect(cs.issues).toEqual([expect.objectContaining({ kind: 'no-unit', column: 'Unit', message: 'This number has no unit. Is it a plain count?' })]);
    expect(real(planChanges(base('rhea', { goals: [rec({ ID: g.id, Unit: 'hours' })] })))).toEqual([]);
  });

  it('only lets owners change their own goals; admins can change any; anyone may add a goal for anyone', () => {
    const row = [rec({ ID: 'ns-ai', Target: '90' })];
    const tariq = planChanges(base('tariq', { goals: row }, { reason: 'Faster than expected' }));
    expect(tariq.issues).toEqual([]);
    const mateo = planChanges(base('mateo', { goals: row }));
    expect(mateo.issues[0]!.message).toMatch(/Only Tariq Haddad \(its owner\) or an admin/);
    expect(mateo.commit).toBeNull();
    // Lane, 11 Nov: anyone may add a goal for anyone, at any level, at every door (domain/goalRights mayAddGoal).
    // For someone else, with no State, it is asked once whether it starts active (GE10, decision 16); answered, it saves.
    const forTariq = { goals: [rec({ Goal: 'Something new', Owner: 'Tariq Haddad', Unit: 'days', Start: '1', Target: '2' })] };
    expect(real(planChanges(base('mateo', forTariq))).map((i) => i.kind)).toEqual(['for-someone-else']);
    const proposedFor = planChanges(base('mateo', forTariq, { answers: { 'for-someone-else:goals:state:for-someone-else': { choice: 'proposed' } } }));
    expect(real(proposedFor)).toEqual([]);
    expect(proposedFor.commit!.goals![0]).toMatchObject({ ownerId: 'tariq', proposedBy: 'mateo' });
    expect(real(planChanges(base('mateo', { goals: [rec({ ...forTariq.goals[0]!, state: 'active' })] })))).toEqual([]);
  });

  it('asks for a reason when a plan changes after check-ins started', () => {
    const row = [rec({ ID: 'ns-ai', Target: '90' })];
    const without = planChanges(base('tariq', { goals: row }));
    expect(without.needsReason).toBe(true);
    expect(without.commit).toBeNull();
    const withReason = planChanges(base('tariq', { goals: row }, { reason: 'Moved faster than planned' }));
    expect(withReason.commit!.changes[0]!.diffs).toEqual(expect.arrayContaining([{ field: 'Why', from: '—', to: 'Moved faster than planned' }]));
    const g = withReason.commit!.goals![0] as MetricGoal;
    expect(g.originalPlan).not.toBeNull();
    expect(g.rebaselinedWeek).toBe(week);
  });

  it('sets plan numbers by hand from the Plan sheet', () => {
    const g = s.goals.find((x) => x.id === 'mttr-pir') as MetricGoal;
    const r = rec({ ID: 'mttr-pir', 'Week 5': '45' });
    const cs = planChanges(base('mateo', { plan: [r] }, { reason: 'Rollout landed early' }));
    expect(cs.issues).toEqual([]);
    const after = cs.commit!.goals![0] as MetricGoal;
    expect(planAt(after.plan, 5, cycle.weeks)).toBe(45);
    expect(planAt(after.plan, 5, cycle.weeks)).not.toBe(planAt(g.plan, 5, cycle.weeks));
  });

  it('loads past weeks as backfilled check-ins, judged by the same rules', () => {
    const fresh = { ...s, checkIns: s.checkIns.filter((c) => c.goalId !== 'ns-ai') };
    const rows = [1, 2, 3].map((w) => ({ ...rec({ 'Goal ID': 'ns-ai', Week: String(w), Value: String(Math.round(planAt((s.goals.find((g) => g.id === 'ns-ai') as MetricGoal).planHistory?.[0]?.plan ?? (s.goals.find((g) => g.id === 'ns-ai') as MetricGoal).plan, w, cycle.weeks))) }), __row: String(w + 1) }));
    const cs = planChanges(base('tariq', { checkIns: rows }, { snapshot: fresh }));
    expect(cs.issues).toEqual([]);
    expect(cs.counts.backfilled).toBe(3);
    const cis = cs.commit!.checkIns!;
    expect(cis.every((c) => c.backfilled && c.authorId === 'tariq')).toBe(true);
    // Dated in their own week, so loading history doesn't make the goal look freshly checked in.
    expect(cis.every((c) => c.postedAt < today.toISOString())).toBe(true);
    expect(goalStatus(s.goals.find((g) => g.id === 'ns-ai')!, cycle, applyCommit(fresh, cs.commit!).checkIns, today).status).toBe('stale');
    expect(cs.commit!.changes[0]!.summary).toMatch(/loaded later/);
  });

  it('refuses a week behind plan without a reason, or a week in the future', () => {
    const fresh = { ...s, checkIns: s.checkIns.filter((c) => c.goalId !== 'mttr-pir') };
    const behind = planChanges(base('mateo', { checkIns: [rec({ 'Goal ID': 'mttr-pir', Week: '4', Value: '21' })] }, { snapshot: fresh }));
    expect(behind.issues[0]!.message).toMatch(/Week 4 needs a Cause and a Why/);
    expect(behind.issues[0]!.message).toMatch(/Path to green/);
    const fixed = planChanges(base('mateo', { checkIns: [rec({ 'Goal ID': 'mttr-pir', Week: '4', Value: '21', Cause: 'Delivery slower', Why: 'The incident tracker export slipped two weeks', 'Path to green': 'Close the actions by hand', 'Back on plan by week': '8' })] }, { snapshot: fresh }));
    expect(fixed.issues).toEqual([]);
    expect(fixed.commit!.checkIns![0]!.status).toBe('off');
    const future = planChanges(base('mateo', { checkIns: [rec({ 'Goal ID': 'mttr-pir', Week: String(week + 1), Value: '50' })] }));
    expect(future.issues[0]!.message).toMatch(/hasn’t happened yet/);
  });

  it('replaces a week already posted, and says whose it was', () => {
    const g = s.goals.find((x) => x.id === 'ns-ai') as MetricGoal;
    // At the goal's own decimal places (whole numbers): a number with more is refused, never rounded (backlog N).
    const v = String(Math.ceil(planAt(g.planHistory?.[0]?.plan ?? g.plan, 6, cycle.weeks)));
    const cs = planChanges(base('amara', { checkIns: [rec({ 'Goal ID': 'ns-ai', Week: '6', Value: v, Call: 'On track', Why: 'Recounted from the review tool.' })] }));
    expect(cs.counts.replaced).toBe(1);
    // Fine, and said on the change (C18): one row replacing someone else's check-in isn't a question.
    expect(cs.issues.find((i) => i.kind === 'replaces')).toMatchObject({ level: 'note', message: expect.stringMatching(/Replaces Tariq Haddad’s check-in for week 6/) });
    expect(cs.commit).not.toBeNull();
  });

  it('refuses to replace a check-in once the cycle has ended, through every door (review of #326)', () => {
    const g = s.goals.find((x) => x.id === 'ns-ai') as MetricGoal;
    const v = String(Math.ceil(planAt(g.planHistory?.[0]?.plan ?? g.plan, 6, cycle.weeks)));
    const row = rec({ 'Goal ID': 'ns-ai', Week: '6', Value: v, Call: 'On track', Why: 'Recounted from the review tool.' });
    const { lastDay, wrapUpCloses } = cycleDates(cycle);
    const ended = new Date(Date.parse(lastDay) + 2 * 86_400_000).toISOString();
    const closed = new Date(Date.parse(wrapUpCloses) + 2 * 86_400_000).toISOString();
    const why = 'Recounted from the review tool.';
    // Tariq owns the goal, so every door lets him check in on it.
    for (const via of ['spreadsheet', 'table', 'mcp', 'bulk'] as const) {
      // While the cycle runs, the same row replaces week 6.
      expect(planChanges(base('tariq', { checkIns: [row] }, { via, reason: why })).counts.replaced).toBe(1);
      for (const now of [ended, closed]) {
        const cs = planChanges(base('tariq', { checkIns: [row] }, { via, now, reason: why }));
        expect(cs.counts.replaced).toBe(0);
        expect(cs.issues.find((i) => i.severity === 'error')).toMatchObject({ kind: 'cant-change', message: `${cycle.name} has ended, so its check-ins can’t be corrected.` });
        expect(cs.commit).toBeNull();
      }
    }
    // A workbook loaded later that carries the ended cycle's check-ins unchanged is fine: nothing is replaced.
    const wb = workbook({ ws: { id: 'ws', name: 'P' }, snapshot: s, cycle, week, today });
    const same = planChanges(base('amara', { goals: records(tsvOf(wb[1]!.rows)), plan: records(tsvOf(wb[2]!.rows)), checkIns: records(tsvOf(wb[3]!.rows)) }, { now: closed }));
    expect(same.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('reads milestone stages in words', () => {
    const cs = planChanges(base('jun', { checkIns: [rec({ 'Goal ID': 'fresh-lakehouse', Week: String(week), Stages: 'Data model v1: done week 10; Private preview with three teams: done week 27', Cause: 'Delivery slower', Why: 'The top tables need more hand migration than planned.', 'Path to green': 'Migrate the rest in pairs', 'Back on plan by week': '50' })] }));
    expect(cs.issues.filter((i) => i.severity === 'error').map((i) => i.message)).toEqual([]);
    const st = cs.commit!.checkIns![0]!.stages!;
    expect(st.find((u) => u.stageId === 'fresh-lakehouse_s2')!.doneWeek).toBe(27);
  });

  it('round-trips through CSV', () => {
    const wb = workbook({ ws: { id: 'ws', name: 'P' }, snapshot: s, cycle, week, today });
    const rows = parseTable(toCsv(wb[1]!.rows));
    expect(rows[0]!.slice(0, 2)).toEqual(['Key', 'ID']);
    expect(rows.length).toBe(wb[1]!.rows.length);
  });
});

describe('changing a goal’s owner', () => {
  // Two people with the same name: a second Rhea Kapoor in another team.
  const rhea = person('rhea');
  const twin = { ...rhea, id: 'rhea2', teamId: s.teams.find((t) => t.id !== rhea.teamId)!.id };
  const withTwin = { ...s, people: [...s.people, twin] };
  const goal = s.goals.find((g) => g.ownerId !== 'rhea')!;
  const ownerAfter = (cs: ReturnType<typeof planChanges>) => cs.commit?.goals?.find((g) => g.id === goal.id)?.ownerId;

  it('goes by the person’s ID, so two people with the same name are never confused', () => {
    const cs = planChanges(base('amara', { goals: [rec({ id: goal.id, 'owner id': 'rhea2' })] }, { snapshot: withTwin, via: 'bulk' }));
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(ownerAfter(cs)).toBe('rhea2');
    expect(ownerAfter(planChanges(base('amara', { goals: [rec({ id: goal.id, 'owner id': 'rhea' })] }, { snapshot: withTwin, via: 'bulk' })))).toBe('rhea');
  });

  it('refuses a name two people share, rather than guessing, and says to use their email', () => {
    const twinMail = { ...withTwin, people: withTwin.people.map((p) => (p.id === 'rhea2' ? { ...p, email: 'rhea.kapoor2@example.com' } : p)) };
    const cs = planChanges(base('amara', { goals: [rec({ id: goal.id, owner: 'Rhea Kapoor' })] }, { snapshot: twinMail }));
    expect(cs.commit).toBeNull();
    expect(cs.issues[0]?.message).toMatch(/2 people are called “Rhea Kapoor”. Use their email instead \(rhea.kapoor@example.com or rhea.kapoor2@example.com\)/);
    // By email, there's no doubt.
    const byEmail = planChanges(base('amara', { goals: [rec({ id: goal.id, owner: 'Rhea Kapoor', 'owner email': 'rhea.kapoor2@example.com' })] }, { snapshot: twinMail }));
    expect(ownerAfter(byEmail)).toBe('rhea2');
  });

  it('still takes a name only one person has, or an ID typed in Owner', () => {
    expect(ownerAfter(planChanges(base('amara', { goals: [rec({ id: goal.id, owner: 'Rhea Kapoor' })] })))).toBe('rhea');
    expect(ownerAfter(planChanges(base('amara', { goals: [rec({ id: goal.id, owner: 'rhea2' })] }, { snapshot: withTwin })))).toBe('rhea2');
  });

  it('says so when an Owner ID matches no one', () => {
    const cs = planChanges(base('amara', { goals: [rec({ id: goal.id, 'owner id': 'nobody' })] }));
    expect(cs.commit).toBeNull();
    expect(cs.issues[0]?.message).toBe('There’s no person with ID nobody.');
  });
});

describe('People columns do what the field table says (review of #130)', () => {
  const admin = s.people.find((p) => p.admin && p.id !== 'amara' && p.email)!;
  const plain = s.people.find((p) => !p.admin && p.email && !p.leftAt)!;

  it('an empty Admin cell keeps what is there; yes and no change it', () => {
    const blank = planChanges(base('amara', { people: [rec({ email: admin.email!, admin: '' })] }));
    expect(blank.items).toEqual([]);
    expect(blank.issues.filter((i) => i.level !== 'note')).toEqual([]);
    const no = planChanges(base('amara', { people: [rec({ email: admin.email!, admin: 'no' })] }));
    expect(no.items[0]?.diffs.some((d) => d.field === 'Admin')).toBe(true);
    const yes = planChanges(base('amara', { people: [rec({ email: plain.email!, admin: 'yes' })] }));
    expect(yes.items).toHaveLength(1);
    // Someone new with Admin empty is not an admin.
    const added = planChanges(base('amara', { people: [rec({ email: 'new.person@example.com', name: 'New Person', team: 'CI/CD', admin: '' })] }));
    expect(added.commit?.people?.find((p) => p.email === 'new.person@example.com')?.admin).toBe(false);
  });

  it('Takes over accepts an email, or a name only one person has, and asks about one one letter out', () => {
    const leaver = s.people.find((p) => p.id !== 'amara' && !p.leftAt && s.goals.some((g) => g.ownerId === p.id))!;
    const heir = s.people.find((p) => p.id !== leaver.id && p.id !== 'amara' && !p.leftAt && s.people.filter((q) => q.name === p.name).length === 1)!;
    const byEmail = planChanges(base('amara', { people: [rec({ email: leaver.email!, action: 'Left', 'takes over': heir.email! })] }));
    expect(byEmail.issues.filter((i) => i.level !== 'note')).toEqual([]);
    expect(byEmail.items.map((x) => x.kind)).toEqual(['person left']);
    const byName = planChanges(base('amara', { people: [rec({ email: leaver.email!, action: 'Left', 'takes over': heir.name })] }));
    expect(byName.issues.filter((i) => i.level !== 'note')).toEqual([]);
    expect(byName.items.map((x) => x.kind)).toEqual(['person left']);
    expect(byName.issues.find((i) => i.kind === 'by-name')?.message).toContain(`matched by name: ${heir.name}`);
    // One letter out is a question (IM2's near-miss rule), never "isn't an email".
    const typo = heir.name.slice(0, -1) + (heir.name.endsWith('a') ? 'e' : 'a');
    const near = planChanges(base('amara', { people: [rec({ email: leaver.email!, action: 'Left', 'takes over': typo })] }));
    const asked = near.issues.find((i) => i.column === 'Takes over');
    expect(asked?.kind).toBe('near-ref');
    expect(asked?.message).toBe(`Takes over: “${typo}” isn’t here. Did you mean ${heir.name}?`);
    expect(near.commit).toBeNull();
  });
});

describe('From and To in a file (rule 13; GE9 review)', () => {
  const email = person('amara').email ?? '';
  const row = (o: Record<string, string>) => rec({ Goal: 'Faster restores', 'Owner email': email, Type: 'Move a number', Unit: 'min', Start: '40', Target: '20', ...o });
  const errors = (cs: ReturnType<typeof planChanges>) => cs.issues.filter((i) => i.severity === 'error').map((i) => i.message);
  it('reads a new goal’s To when Due week is left blank, as every export has both', () => {
    const cs = planChanges(base('amara', { goals: [row({ From: '2026-W46', To: '2027-W13', 'Due week': '' })] }, { confirm: true }));
    expect(errors(cs)).toEqual([]);
    const g = cs.commit!.goals!.find((x) => x.title === 'Faster restores') as MetricGoal;
    expect([g.plan.fromWeek, g.plan.endWeek]).toEqual([46, 66]);
  });
  it('says a To before From in its own words, with Due week blank', () => {
    const cs = planChanges(base('amara', { goals: [row({ From: '2026-W46', To: '2026-W40', 'Due week': '' })] }, { confirm: true }));
    expect(errors(cs)).toEqual([expect.stringMatching(/^To \(week 40, 28 Sep–4 Oct 2026\) isn’t after From/)]);
  });
  it('still refuses To and Due week that disagree', () => {
    const cs = planChanges(base('amara', { goals: [row({ To: '2027-W13', 'Due week': '50' })] }, { confirm: true }));
    expect(errors(cs)).toEqual(['To says 2027-W13 and Due week says 50. Change just one of them.']);
  });
  it('asks which a bare number under From is, in a file with no Start column', () => {
    // The export with its Start heading renamed From: 52 is where the goal starts, or week 52?
    const cs = planChanges(base('amara', { goals: [rec({ ID: 'mttr-pir', From: '52' })] }, { confirm: true }));
    expect(errors(cs)).toEqual(['From says “52”: a starting number, or a week? Put a starting number under Start, or write the week as a year and a week, like 2026-W45.']);
    expect(cs.commit).toBeNull();
    // With a Start column, From is a week; and a year and a week is never in doubt.
    expect(errors(planChanges(base('amara', { goals: [rec({ ID: 'mttr-pir', Start: '', From: '40' })] }, { confirm: true })))).toEqual([]);
    expect(errors(planChanges(base('amara', { goals: [rec({ ID: 'mttr-pir', From: '2026-W40' })] }, { confirm: true })))).toEqual([]);
  });
});
