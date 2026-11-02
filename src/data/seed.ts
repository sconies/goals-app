/* Demo data: an AI-native developer platform, in week 43 of its 52-week goal year.
   Dates are relative to today so the year is always live. All numbers are invented. The story of the last
   seven weeks is written below in story weeks 1–7 and placed at the end of the year by yearStory.ts. */
import { emptyDraft, evaluate, toCheckIn, type Draft } from '../domain/checkin';
import { checkInChange, goalChange } from '../domain/changes';
import type { Cause, Change, CheckIn, Cycle, Decision, Goal, Level, MetricGoal, MilestoneGoal, Person, RangeGoal, Review, Snapshot, StageUpdate, Team, Watch } from '../domain/types';

import { SEED_WEEK, STORY_OFFSET, steadyDraft, storyValue, toYear, YEAR_WEEKS, yearName } from './yearStory';

const DAY = 86_400_000;
export { SEED_WEEK };

const people: Person[] = [
  { id: 'elena', name: 'Elena Ruiz', role: 'VP Engineering', initials: 'ER', teamId: null, admin: true },
  { id: 'maya', name: 'Maya Chen', role: 'Product lead, Developer Platform', initials: 'MC', teamId: 'pm', admin: false },
  { id: 'sam', name: 'Sam Patel', role: 'DevEx lead', initials: 'SP', teamId: 'devex', admin: false },
  { id: 'kofi', name: 'Kofi Boateng', role: 'SRE / AIOps lead', initials: 'KB', teamId: 'sre', admin: false },
  { id: 'jonas', name: 'Jonas Berg', role: 'Infrastructure lead', initials: 'JB', teamId: 'infra', admin: false },
  { id: 'aisha', name: 'Aisha Rahman', role: 'Security lead', initials: 'AR', teamId: 'sec', admin: false },
  { id: 'leo', name: 'Leo Park', role: 'Engineering Brain lead', initials: 'LP', teamId: 'brain', admin: false },
  { id: 'tom', name: 'Tom Reid', role: 'Engineer, DevEx', initials: 'TR', teamId: 'devex', admin: false },
  { id: 'priya', name: 'Priya Nair', role: 'Engineering operations', initials: 'PN', teamId: null, admin: true },
];

const teams: Team[] = [
  { id: 'pm', name: 'Product', leadId: 'maya', objective: 'Get every request triaged and moving within two days' },
  { id: 'devex', name: 'DevEx', leadId: 'sam', objective: 'Make AI review and fast merges the default path' },
  { id: 'sre', name: 'SRE / AIOps', leadId: 'kofi', objective: 'Let AIOps take first response' },
  { id: 'infra', name: 'Infrastructure', leadId: 'jonas', objective: 'Self-service environments in minutes, not days' },
  { id: 'sec', name: 'Security', leadId: 'aisha', objective: 'Secure AI-generated code and the Brain’s data' },
  { id: 'brain', name: 'Engineering Brain', leadId: 'leo', objective: 'Lay the data and AI foundations for the engineering brain' },
];

const common = (id: string, teamId: string, ownerId: string, title: string, source: string) => ({
  id, cycleId: 'cycle', teamId, ownerId, title, source, io: 'input' as const, level: 'team' as Level, guardrail: false,
  parentId: 'head' as string | null, effect: null as number | null, definition: '', createdAt: '',
});

const metric = (c: ReturnType<typeof common>, unit: string, decimals: number, start: number, target: number, extra: Partial<MetricGoal> = {}): MetricGoal =>
  ({ ...c, kind: 'metric', unit, decimals, plan: { start, target, shape: 'straight' }, originalPlan: null, rebaselinedWeek: null, ...extra });

const head = metric(common('head', 'pm', 'maya', 'Intake-to-delivery time', 'Jira intake board + release dates'), 'days', 1, 34, 18, {
  io: 'output', level: 'north-star', parentId: null, plan: { start: 34, target: 18, shape: 'back' },
  definition: 'Median days from a request being accepted at intake to it being live in production',
});
const reviewOriginal = { start: 30, target: 75, shape: 'straight' as const };
// A second outcome, so the leader view shows more than one tree.
const cost = metric(common('cost', 'infra', 'jonas', 'Cloud spend per developer', 'FinOps dashboard'), 'USD', 0, 410, 330, {
  io: 'output', level: 'north-star', parentId: null,
  definition: 'Monthly cloud bill for developer environments and CI, divided by active developers',
});

const goals: Goal[] = [
  head,
  metric({ ...common('triage', 'pm', 'maya', 'Requests triaged within 2 days', 'Jira intake board'), effect: 5, level: 'svp' }, '%', 0, 40, 85),
  metric({ ...common('review', 'devex', 'sam', 'PRs with AI code review', 'GitHub pull request data'), effect: 4, level: 'svp' }, '%', 0, 30, 95, { originalPlan: reviewOriginal, rebaselinedWeek: toYear(4) }),
  metric({ ...common('lead', 'devex', 'sam', 'Lead time for changes', 'DORA dashboard'), effect: 2 }, 'days', 1, 4.2, 2.0),
  metric({ ...common('alerts', 'sre', 'kofi', 'Alerts auto-triaged by AIOps', 'Alerting + AIOps pipeline'), effect: 1 }, '%', 0, 20, 60),
  { ...common('cfr', 'sre', 'kofi', 'Change failure rate', 'DORA dashboard'), io: 'output', guardrail: true, kind: 'range', unit: '%', decimals: 1, range: { bound: 'atMost', limit: 12, margin: 1 } } satisfies RangeGoal,
  metric({ ...common('env', 'infra', 'jonas', 'Self-service environments in under 1 hour', 'Platform API'), effect: 3 }, '%', 0, 35, 80),
  metric({ ...common('scan', 'sec', 'aisha', 'AI-generated code scanned before merge', 'Code scanning'), guardrail: true }, '%', 0, 50, 100),
  { ...common('access', 'sec', 'aisha', 'Repo-access controls for the Brain', 'Jira SEC-88'), level: 'svp', kind: 'milestone',
    stages: [{ id: 'tm', name: 'Threat model', dueWeek: toYear(2) }, { id: 'dc', name: 'Data classification', dueWeek: toYear(4) }, { id: 'ac', name: 'Access controls built', dueWeek: toYear(6) }, { id: 'ap', name: 'Approval granted', dueWeek: toYear(6) }] } satisfies MilestoneGoal,
  { ...common('brain', 'brain', 'leo', 'Brain data model and AI infrastructure live', 'Jira BRN epics'), effect: 1, kind: 'milestone',
    stages: [{ id: 'dm', name: 'Data model v1', dueWeek: toYear(3) }, { id: 'pr', name: 'Private repo indexing', dueWeek: toYear(7) }, { id: 'gi', name: 'AI infrastructure GA', dueWeek: toYear(9) }, { id: 'ap', name: 'Assistant pilot', dueWeek: toYear(12) }] } satisfies MilestoneGoal,
  cost,
  metric({ ...common('idle', 'infra', 'jonas', 'Idle environments shut down within 2 hours', 'Platform API'), parentId: 'cost', effect: 40 }, '%', 0, 30, 90),
  metric({ ...common('cache', 'sre', 'kofi', 'Build cache hit rate', 'CI telemetry'), parentId: 'cost', effect: 25 }, '%', 0, 50, 76),
];

/** Weekly values, weeks 1.. as posted. */
const values: Record<string, number[]> = {
  head: [33.5, 32.9, 32.1, 31.2, 30.3, 29.4],
  triage: [43, 47, 51, 55, 58, 61, 63],
  review: [36, 44, 51, 58, 62, 66],
  lead: [4.1, 3.9, 3.7, 3.5, 3.3, 3.1],
  alerts: [22, 25, 29, 33, 35, 36],
  cfr: [10.8, 11.0, 10.6, 10.9, 11.2, 12.6],
  env: [38, 42, 46, 50],
  scan: [54, 58, 62, 66, 70, 74, 78],
  cost: [404, 398, 391, 385, 379, 373, 366],
  idle: [35, 39, 44, 48, 52, 55, 57],
  cache: [52, 54, 56, 58, 60, 62, 65],
};

/** Stage updates by story week for the milestones: [done week, forecast week], in year weeks. */
const stageUpdates: Record<string, Record<number, Record<string, [number | null, number | null]>>> = {
  access: {
    1: {}, 2: { tm: [toYear(2), null] }, 3: { tm: [toYear(2), null] }, 4: { tm: [toYear(2), null], dc: [toYear(4), null] }, 5: { tm: [toYear(2), null], dc: [toYear(4), null] },
    6: { tm: [toYear(2), null], dc: [toYear(4), null], ac: [null, toYear(9)], ap: [null, toYear(9)] },
  },
  brain: { 1: {}, 2: {}, 3: { dm: [toYear(3), null] }, 4: { dm: [toYear(3), null] }, 5: { dm: [toYear(3), null] }, 6: { dm: [toYear(3), null] } },
};

interface Note { cause: Cause; why: string }
/** What each owner said when a check-in needed a reason, and their path to green. */
const notes: Record<string, { ahead?: Note; behind?: Note; path?: { what: string; in: number; needs?: string } }> = {
  head: {
    ahead: { cause: 'early', why: 'AI intake triage went live early, so requests moved faster than the back-loaded plan expected.' },
    behind: { cause: 'blocked', why: 'Intake triage and AI review are ahead, but the Brain is waiting on Security’s repo access and environments are waiting on GPU quota.' },
    path: { what: 'Brain interim scope and Infrastructure’s CPU golden path.', in: 3, needs: 'Elena Ruiz: approve an interim read-only scope for the Brain' },
  },
  triage: {
    behind: { cause: 'slower', why: 'The triage model still covers only some of the intake forms, so the rest wait for a person.' },
    path: { what: 'Roll the model out to the remaining intake forms.', in: 2 },
  },
  review: { ahead: { cause: 'early', why: 'The AI review bot reached GA two weeks early and became the default for every repo once Security approved it.' } },
  lead: {
    behind: { cause: 'slower', why: 'The merge queue rollout started a week late because of flaky tests in the monorepo.' },
    path: { what: 'Quarantine the flaky tests and switch the monorepo to the merge queue.', in: 2 },
  },
  alerts: {
    behind: { cause: 'aggressive', why: 'The triage model needed two weeks of labelled alerts before it could take first response.' },
    path: { what: 'Labelling finished; turn auto-triage on for the paging alerts first.', in: 2 },
  },
  cfr: {
    behind: { cause: 'oneoff', why: 'One bad deploy of the merge queue pushed the rate up; it was rolled back the same day.' },
    path: { what: 'Canary the merge queue for a week before full rollout.', in: 2 },
  },
  env: {
    behind: { cause: 'slower', why: 'The golden path template needed a second review from Security before launch.' },
    path: { what: 'Ship the template once Security signs off this week.', in: 1 },
  },
  idle: {
    behind: { cause: 'slower', why: 'The shutdown job skips environments with an open debug session, and most have one by Friday.' },
    path: { what: 'Close idle debug sessions after 30 minutes, then rerun the shutdown job.', in: 3 },
  },
  access: {
    behind: { cause: 'external', why: `The access-review tooling vendor delivered late, so SEC-88 moved from week ${toYear(6)} to week ${toYear(9)}.` },
    path: { what: `Interim read-only scope if Elena approves; full controls in week ${toYear(9)}.`, in: 3, needs: 'Elena Ruiz: approve an interim read-only scope' },
  },
};

/** The last story week checked in, for a goal that went quiet. */
const lastWeek: Record<string, number> = { env: 4 };

function mondayOf(d: Date): number {
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = (new Date(day).getUTCDay() + 6) % 7; // Monday = 0
  return day - dow * DAY;
}

export function seed(today: Date): Snapshot {
  const start = mondayOf(today) - SEED_WEEK * 7 * DAY;
  const startDate = new Date(start).toISOString().slice(0, 10);
  const cycle: Cycle = { id: 'cycle', name: yearName(startDate, YEAR_WEEKS), startDate, weeks: YEAR_WEEKS, reviewDay: 3 };
  // Distinct creation times keep the goals in this order wherever they are stored.
  // Two links carry the reasoning behind them: a hypothesis about why the work should move the outcome.
  const WHY: Record<string, string> = {
    triage: 'Requests that are triaged within two days start sooner, which should take days off intake-to-delivery.',
    review: 'AI review catches problems before a human reviewer does, so pull requests merge faster.',
  };
  const allGoals = goals.map((g, i) => ({ ...g, createdAt: new Date(start - 5 * DAY + i * 1000).toISOString(), ...(WHY[g.id] ? { whyHelps: WHY[g.id] } : {}) }));

  const postedAt = (week: number) => {
    const planned = start + week * 7 * DAY + 2 * DAY + 10 * 3_600_000;
    return new Date(Math.max(start + week * 7 * DAY, Math.min(planned, today.getTime() - 60_000)));
  };

  const checkIns: CheckIn[] = [];
  for (const g of allGoals) {
    const story = g.kind === 'milestone' ? Object.keys(stageUpdates[g.id] ?? {}).length : (values[g.id] ?? []).length;
    const last = STORY_OFFSET + Math.min(story, lastWeek[g.id] ?? 7);
    for (let week = 1; week <= Math.min(last, SEED_WEEK); week++) {
      const sw = week - STORY_OFFSET; // the story week, or below 1 before the story starts
      // The review goal was re-baselined in story week 4: earlier check-ins were judged against the original plan.
      const asOf: Goal = g.id === 'review' && week <= toYear(4) && g.kind === 'metric' ? { ...g, plan: reviewOriginal, originalPlan: null, rebaselinedWeek: null } : g;
      let draft: Draft = emptyDraft(asOf, null);
      if (g.kind === 'milestone') {
        const u = sw >= 1 ? stageUpdates[g.id]?.[sw] ?? {} : {};
        draft.stages = g.stages.map((s): StageUpdate => ({ stageId: s.id, doneWeek: u[s.id]?.[0] ?? null, forecastWeek: u[s.id]?.[1] ?? null }));
      } else if (sw >= 1) {
        const v = values[g.id]![sw - 1]!;
        draft.value = String(asOf.kind === 'metric' ? storyValue(asOf.plan, asOf.decimals, sw, v) : v);
      } else {
        draft = steadyDraft(asOf, cycle, week, draft, checkIns, values[g.id]?.[0]);
      }
      const e = evaluate(asOf, cycle, week, draft, checkIns);
      const n = notes[g.id] ?? {};
      let note = e.reason === 'ahead' ? n.ahead : e.reason === 'behind' ? n.behind : undefined;
      if (e.reason && !note && sw >= 1) throw new Error(`Seed: ${g.id} week ${week} needs a ${e.reason} note`);
      if (e.reason && !note) note = e.reason === 'ahead' ? { cause: 'early', why: 'A little ahead of a plan that barely moves this early in the year.' } : { cause: 'slower', why: 'A little behind plan this week.' };
      if (note) Object.assign(draft, { cause: note.cause, why: note.why });
      if (e.needsPath) {
        if (!n.path) throw new Error(`Seed: ${g.id} week ${week} needs a path to green`);
        Object.assign(draft, { ptgWhat: n.path.what, ptgBy: Math.min(cycle.weeks, week + n.path.in), needs: n.path.needs ?? '' });
      }
      if (!e.reason && !draft.why) draft.why = 'On plan.';
      checkIns.push(toCheckIn(asOf, cycle, week, draft, checkIns, g.ownerId, postedAt(week), `ci_${g.id}_${week}`));
    }
  }
  // The change log the demo starts with: every goal's creation, every check-in, and the week-4 target approval.
  const lookup = {
    person: (id: string) => people.find((x) => x.id === id),
    goal: (id: string) => allGoals.find((x) => x.id === id),
    teamName: (id: string) => teams.find((t) => t.id === id)?.name ?? id,
  };
  const changes: Change[] = [];
  const asCreated = (g: Goal): Goal => (g.id === 'review' && g.kind === 'metric' ? { ...g, plan: reviewOriginal, originalPlan: null, rebaselinedWeek: null } : g);
  for (const g of allGoals) changes.push(goalChange(null, asCreated(g), lookup, g.ownerId, g.createdAt, 'chg_goal_' + g.id)!);
  for (const c of checkIns) changes.push(checkInChange(null, c, allGoals.find((g) => g.id === c.goalId)!, c.authorId, 'chg_' + c.id)!);
  // In story week 4 Sam raised the AI review target from 75% to 95%; the first plan stays on the chart.
  const raisedAt = new Date(Date.parse(checkIns.find((c) => c.id === `ci_review_${toYear(4)}`)!.postedAt) + 3_600_000).toISOString();
  changes.push({
    id: 'chg_review_target_4', at: raisedAt, actorId: 'sam', goalId: 'review', entity: 'goal', entityId: 'review', action: 'edited',
    summary: 'Changed the target: 75% → 95%', diffs: [{ field: 'Target', from: '75%', to: '95%' }, { field: 'Why', from: '—', to: 'The AI review bot is the default for every repo now, so 75% was too easy.' }],
  });
  // People keep an eye on what matters to them, and one review walks the platform's goals every week.
  const watches: Watch[] = [
    { id: 'w_elena_ns', personId: 'elena', kind: 'level', ref: 'north-star' },
    { id: 'w_elena_svp', personId: 'elena', kind: 'level', ref: 'svp' },
    { id: 'w_tom_review', personId: 'tom', kind: 'goal', ref: 'review' },
    { id: 'w_tom_lead', personId: 'tom', kind: 'goal', ref: 'lead' },
    { id: 'w_maya_head', personId: 'maya', kind: 'tree', ref: 'head' },
    { id: 'w_priya_ns', personId: 'priya', kind: 'level', ref: 'north-star' },
  ];
  const reviews: Review[] = [
    { id: 'weekly', name: 'Platform weekly review', everyWeeks: 1, weekday: 3, scope: { goals: [], trees: ['head', 'cost'], levels: [] }, people: ['elena', 'maya', 'sam', 'kofi', 'jonas', 'aisha', 'leo'], createdBy: 'elena', createdAt: new Date(start - 4 * DAY).toISOString() },
    { id: 'security', name: 'Security monthly', everyWeeks: 4, weekday: 1, scope: { goals: ['scan', 'access'], trees: [], levels: [] }, people: ['aisha', 'elena'], createdBy: 'aisha', createdAt: new Date(start - 4 * DAY).toISOString() },
  ];
  // Last week's review: a note on the north star from Elena.
  const noteAt = new Date(postedAt(SEED_WEEK - 1).getTime() + DAY).toISOString();
  const decisions: Decision[] = [{ id: 'dec_weekly_6', goalId: 'head', checkInId: null, reviewId: 'weekly', week: SEED_WEEK - 1, kind: 'note', byId: 'elena', at: noteAt, note: 'Brain and GPU quota are the two blockers; Leo and Jonas to pair on the interim scope.' }];
  changes.push({
    id: 'chg_dec_weekly_6', at: noteAt, actorId: 'elena', goalId: 'head', entity: 'decision', entityId: 'dec_weekly_6', action: 'noted',
    summary: 'Added a note in Platform weekly review', diffs: [{ field: 'Note', from: '—', to: decisions[0]!.note }],
  });
  changes.sort((a, b) => a.at.localeCompare(b.at));
  return { people, teams, cycles: [cycle], goals: allGoals, checkIns, decisions, changes, watches, reviews, retros: [] };
}
