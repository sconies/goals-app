/* Demo data: an AI-native developer platform, seven weeks into a 13-week cycle.
   Dates are relative to today so the cycle is always live. All numbers are invented. */
import { emptyDraft, evaluate, toCheckIn, type Draft } from '../domain/checkin';
import type { Cause, CheckIn, Cycle, Goal, MetricGoal, MilestoneGoal, Person, RangeGoal, Snapshot, StageUpdate, Team } from '../domain/types';

const DAY = 86_400_000;
export const SEED_WEEK = 7;

const people: Person[] = [
  { id: 'elena', name: 'Elena Ruiz', role: 'VP Engineering', initials: 'ER', teamId: null },
  { id: 'maya', name: 'Maya Chen', role: 'Product lead, Developer Platform', initials: 'MC', teamId: 'pm' },
  { id: 'sam', name: 'Sam Patel', role: 'DevEx lead', initials: 'SP', teamId: 'devex' },
  { id: 'kofi', name: 'Kofi Boateng', role: 'SRE / AIOps lead', initials: 'KB', teamId: 'sre' },
  { id: 'jonas', name: 'Jonas Berg', role: 'Infrastructure lead', initials: 'JB', teamId: 'infra' },
  { id: 'aisha', name: 'Aisha Rahman', role: 'Security lead', initials: 'AR', teamId: 'sec' },
  { id: 'leo', name: 'Leo Park', role: 'Engineering Brain lead', initials: 'LP', teamId: 'brain' },
  { id: 'tom', name: 'Tom Reid', role: 'Engineer, DevEx', initials: 'TR', teamId: 'devex' },
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
  id, cycleId: 'cycle', teamId, ownerId, title, source, io: 'input' as const, headline: false, guardrail: false,
  parentId: 'head' as string | null, effect: null as number | null, definition: '', createdAt: '',
});

const metric = (c: ReturnType<typeof common>, unit: string, decimals: number, start: number, target: number, extra: Partial<MetricGoal> = {}): MetricGoal =>
  ({ ...c, kind: 'metric', unit, decimals, plan: { start, target, shape: 'straight' }, originalPlan: null, rebaselinedWeek: null, ...extra });

const head = metric(common('head', 'pm', 'maya', 'Intake-to-delivery time', 'Jira intake board + release dates'), 'days', 1, 34, 18, {
  io: 'output', headline: true, parentId: null, plan: { start: 34, target: 18, shape: 'back' },
  definition: 'Median days from a request being accepted at intake to it being live in production',
});
const reviewOriginal = { start: 30, target: 75, shape: 'straight' as const };

const goals: Goal[] = [
  head,
  metric({ ...common('triage', 'pm', 'maya', 'Requests triaged within 2 days', 'Jira intake board'), effect: 5 }, '%', 0, 40, 85),
  metric({ ...common('review', 'devex', 'sam', 'PRs with AI code review', 'GitHub pull request data'), effect: 4 }, '%', 0, 30, 95, { originalPlan: reviewOriginal, rebaselinedWeek: 4 }),
  metric({ ...common('lead', 'devex', 'sam', 'Lead time for changes', 'DORA dashboard'), effect: 2 }, 'days', 1, 4.2, 2.0),
  metric({ ...common('alerts', 'sre', 'kofi', 'Alerts auto-triaged by AIOps', 'Alerting + AIOps pipeline'), effect: 1 }, '%', 0, 20, 60),
  { ...common('cfr', 'sre', 'kofi', 'Change failure rate', 'DORA dashboard'), io: 'output', guardrail: true, kind: 'range', unit: '%', decimals: 1, range: { bound: 'atMost', limit: 12, margin: 1 } } satisfies RangeGoal,
  metric({ ...common('env', 'infra', 'jonas', 'Self-service environments in under 1 hour', 'Platform API'), effect: 3 }, '%', 0, 35, 80),
  metric({ ...common('scan', 'sec', 'aisha', 'AI-generated code scanned before merge', 'Code scanning'), guardrail: true }, '%', 0, 50, 100),
  { ...common('access', 'sec', 'aisha', 'Repo-access controls for the Brain', 'Jira SEC-88'), kind: 'milestone',
    stages: [{ id: 'tm', name: 'Threat model', dueWeek: 2 }, { id: 'dc', name: 'Data classification', dueWeek: 4 }, { id: 'ac', name: 'Access controls built', dueWeek: 6 }, { id: 'ap', name: 'Approval granted', dueWeek: 6 }] } satisfies MilestoneGoal,
  { ...common('brain', 'brain', 'leo', 'Brain data model and AI infrastructure live', 'Jira BRN epics'), effect: 1, kind: 'milestone',
    stages: [{ id: 'dm', name: 'Data model v1', dueWeek: 3 }, { id: 'pr', name: 'Private repo indexing', dueWeek: 7 }, { id: 'gi', name: 'AI infrastructure GA', dueWeek: 9 }, { id: 'ap', name: 'Assistant pilot', dueWeek: 12 }] } satisfies MilestoneGoal,
];

/** Weekly values, weeks 1.. as posted. */
const values: Record<string, number[]> = {
  head: [33.5, 32.9, 32.1, 31.2, 30.3, 29.4],
  triage: [43, 47, 51, 55, 58, 61, 63],
  review: [36, 44, 51, 58, 62, 66],
  lead: [4.1, 3.9, 3.7, 3.5, 3.3, 3.1],
  alerts: [22, 25, 29, 33, 36, 40],
  cfr: [10.8, 11.0, 10.6, 10.9, 11.2, 12.6],
  env: [38, 42, 46, 50],
  scan: [54, 58, 62, 66, 70, 74, 78],
};

/** Stage updates by week for the milestones. */
const stageUpdates: Record<string, Record<number, Record<string, [number | null, number | null]>>> = {
  access: {
    1: {}, 2: { tm: [2, null] }, 3: { tm: [2, null] }, 4: { tm: [2, null], dc: [4, null] }, 5: { tm: [2, null], dc: [4, null] },
    6: { tm: [2, null], dc: [4, null], ac: [null, 9], ap: [null, 9] },
  },
  brain: { 1: {}, 2: {}, 3: { dm: [3, null] }, 4: { dm: [3, null] }, 5: { dm: [3, null] }, 6: { dm: [3, null] } },
};

interface Note { cause: Cause; why: string }
/** What each owner said when a check-in needed a reason, and their path to green. */
const notes: Record<string, { ahead?: Note; behind?: Note; path?: { what: string; in: number; needs?: string } }> = {
  head: {
    ahead: { cause: 'early', why: 'AI intake triage went live in week 1, so the first requests moved faster than the back-loaded plan expected.' },
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
  access: {
    behind: { cause: 'external', why: 'The access-review tooling vendor delivered late, so SEC-88 moved from week 6 to week 9.' },
    path: { what: 'Interim read-only scope if Elena approves; full controls in week 9.', in: 3, needs: 'Elena Ruiz: approve an interim read-only scope' },
  },
};

const lastWeek: Record<string, number> = { env: 4 };

function mondayOf(d: Date): number {
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = (new Date(day).getUTCDay() + 6) % 7; // Monday = 0
  return day - dow * DAY;
}

export function seed(today: Date): Snapshot {
  const start = mondayOf(today) - SEED_WEEK * 7 * DAY;
  const startDate = new Date(start).toISOString().slice(0, 10);
  const label = new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const cycle: Cycle = { id: 'cycle', name: 'Platform cycle from ' + label, startDate, weeks: 13 };
  // Distinct creation times keep the goals in this order wherever they are stored.
  const allGoals = goals.map((g, i) => ({ ...g, createdAt: new Date(start - 5 * DAY + i * 1000).toISOString() }));

  const postedAt = (week: number) => {
    const planned = start + week * 7 * DAY + 2 * DAY + 10 * 3_600_000;
    return new Date(Math.max(start + week * 7 * DAY, Math.min(planned, today.getTime() - 60_000)));
  };

  const checkIns: CheckIn[] = [];
  for (const g of allGoals) {
    const weeks = g.kind === 'milestone' ? Object.keys(stageUpdates[g.id] ?? {}).map(Number) : (values[g.id] ?? []).map((_, i) => i + 1);
    for (const week of weeks) {
      if (week > (lastWeek[g.id] ?? SEED_WEEK)) continue;
      // The review goal was re-baselined in week 4: earlier check-ins were judged against the original plan.
      const asOf: Goal = g.id === 'review' && week <= 4 && g.kind === 'metric' ? { ...g, plan: reviewOriginal, originalPlan: null, rebaselinedWeek: null } : g;
      const draft: Draft = emptyDraft(asOf, null);
      if (g.kind === 'milestone') {
        const u = stageUpdates[g.id]?.[week] ?? {};
        draft.stages = g.stages.map((s): StageUpdate => ({ stageId: s.id, doneWeek: u[s.id]?.[0] ?? null, forecastWeek: u[s.id]?.[1] ?? null }));
      } else {
        draft.value = String(values[g.id]?.[week - 1]);
      }
      const e = evaluate(asOf, cycle, week, draft, checkIns);
      const n = notes[g.id] ?? {};
      const note = e.reason === 'ahead' ? n.ahead : e.reason === 'behind' ? n.behind : undefined;
      if (e.reason && !note) throw new Error(`Seed: ${g.id} week ${week} needs a ${e.reason} note`);
      if (note) Object.assign(draft, { cause: note.cause, why: note.why });
      if (e.needsPath) {
        if (!n.path) throw new Error(`Seed: ${g.id} week ${week} needs a path to green`);
        Object.assign(draft, { ptgWhat: n.path.what, ptgBy: Math.min(cycle.weeks, week + n.path.in), needs: n.path.needs ?? '' });
      }
      if (g.id === 'review' && week === 4) draft.proposeTarget = '95';
      if (!e.reason && !draft.why) draft.why = 'On plan.';
      checkIns.push(toCheckIn(asOf, cycle, week, draft, checkIns, g.ownerId, postedAt(week), `ci_${g.id}_${week}`));
    }
  }
  return { people, teams, cycles: [cycle], goals: allGoals, checkIns };
}
