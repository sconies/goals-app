/* The words people use in the Platform Engineering example: the reasons they give when a goal is ahead of or behind
   plan, and the recovery plans they write, by the kind of week they're having (an incident, a hiring gap, a vendor
   delay, a migration's long tail, the summer holidays, a recovery). Each has several phrasings, so a goal that stays
   behind for weeks doesn't repeat itself. {thing}, {Thing}, {dep} and {vendor} are filled from the goal. */
import type { Cause, RecoveryState } from '../../domain/types';

export type Theme =
  | 'incident' | 'hiring' | 'vendor' | 'migration' | 'holiday' | 'blocked' | 'data' | 'aggressive' | 'slower' | 'recovery'
  | 'early' | 'cautious' | 'oneoff' | 'tailwind';

export interface Said { cause: Cause; why: string }
export interface PathWords { what: string; in: number; state?: RecoveryState }

/** Reasons a goal is behind, by theme. */
export const BEHIND: Record<Exclude<Theme, 'early' | 'cautious' | 'oneoff' | 'tailwind'>, Said[]> = {
  incident: [
    { cause: 'external', why: 'The {dep} incident on Tuesday took most of the team for three days, so {thing} stood still.' },
    { cause: 'slower', why: 'Still clearing up after the incident: two engineers are on the post-incident actions instead of {thing}.' },
    { cause: 'external', why: 'An outage in {dep} pushed the number the wrong way this week; it had recovered by Friday.' },
    { cause: 'slower', why: 'We paused {thing} during the incident change freeze. The freeze lifted on Thursday afternoon.' },
    { cause: 'other', why: 'Two P1s in one week. The number reflects the restore times, not a change in how we work.' },
  ],
  hiring: [
    { cause: 'slower', why: 'Down two engineers: one left in the spring and one is on parental leave. The backfill starts in three weeks.' },
    { cause: 'slower', why: 'The new starters are still onboarding, so {thing} is moving at about half pace.' },
    { cause: 'slower', why: 'The open senior role is still unfilled. We have borrowed one engineer from {dep} for a month.' },
    { cause: 'aggressive', why: 'The plan assumed a full team from April. We have had four of six people for most of the year.' },
  ],
  vendor: [
    { cause: 'external', why: '{vendor} moved their delivery again. Nothing we can do on our side until it lands.' },
    { cause: 'blocked', why: 'Still waiting on {vendor} for the API change we need. The support case is open and escalated.' },
    { cause: 'external', why: 'Procurement for {vendor} took four weeks longer than planned, and the work couldn’t start without it.' },
    { cause: 'blocked', why: '{vendor} found a bug in their side of {thing} during our pilot; their fix is due in two weeks.' },
  ],
  migration: [
    { cause: 'aggressive', why: '{Thing} has hit a long tail: the last 15% of services all need hand-holding.' },
    { cause: 'slower', why: 'Two teams asked to defer their move until after their own launch, and we agreed.' },
    { cause: 'slower', why: 'Found an incompatibility with the old {dep} set-up that we hadn’t planned for; working round it.' },
    { cause: 'aggressive', why: 'Each remaining service needs a manual change before {thing} works for it, about a day each.' },
  ],
  holiday: [
    { cause: 'external', why: 'Summer holidays: half the team was away for two weeks, so the number barely moved.' },
    { cause: 'external', why: 'August is quiet across the division. Fewer changes landed than the straight-line plan assumes.' },
    { cause: 'external', why: 'Holiday week, and the teams we depend on were short-staffed too.' },
  ],
  blocked: [
    { cause: 'blocked', why: 'Blocked on {dep}: we need their change before we can switch {thing} on.' },
    { cause: 'blocked', why: '{dep} reprioritised, and our dependency moved to their next sprint.' },
    { cause: 'blocked', why: 'Waiting on {dep} to sign off the design before the rollout can go wider.' },
  ],
  data: [
    { cause: 'data', why: 'The dashboard double-counted retries this week; the real number is closer to plan.' },
    { cause: 'data', why: 'A pipeline delay meant this week’s number covers four days, not seven.' },
    { cause: 'data', why: 'The source changed its definition mid-week. Reconciling it with Lucía before we trust the number.' },
  ],
  aggressive: [
    { cause: 'aggressive', why: 'The plan assumed every team would adopt at the same pace; the larger teams are slower.' },
    { cause: 'aggressive', why: 'We under-estimated how many services need manual changes before {thing} works.' },
    { cause: 'aggressive', why: 'The target was set before we knew the size of the estate. It looks a quarter too early.' },
  ],
  slower: [
    { cause: 'slower', why: 'Progress is real but slower than planned: each change needs more review than we expected.' },
    { cause: 'slower', why: 'Fewer changes landed this week than planned; two were reverted and redone.' },
    { cause: 'slower', why: 'A little behind: two pull requests for {thing} slipped to Monday.' },
    { cause: 'slower', why: 'Steady, but under the planned pace. Nothing is blocked; it’s just taking longer.' },
  ],
  recovery: [
    { cause: 'slower', why: 'Recovering: back to the planned pace for three weeks, though the earlier gap hasn’t closed yet.' },
    { cause: 'slower', why: 'The fix for {thing} landed and the number is moving again. Expect it back on plan in a few weeks.' },
    { cause: 'other', why: 'Closing the gap a little each week. The trend is right; the total isn’t there yet.' },
  ],
};

/** Reasons a goal is well ahead of plan. */
export const AHEAD: Record<'early' | 'cautious' | 'oneoff' | 'tailwind', Said[]> = {
  early: [
    { cause: 'early', why: '{Thing} landed earlier than planned, so the number jumped ahead.' },
    { cause: 'early', why: 'The rollout finished two weeks early once the last team moved over.' },
  ],
  cautious: [
    { cause: 'cautious', why: 'The plan was cautious: teams adopted faster than we expected once they saw the results.' },
    { cause: 'cautious', why: 'Still ahead. We planned for resistance that didn’t come.' },
    { cause: 'cautious', why: 'Ahead again this week. Worth raising the target at the next plan review.' },
  ],
  oneoff: [
    { cause: 'oneoff', why: 'A one-off: a large batch landed this week. Expect the pace to settle.' },
    { cause: 'oneoff', why: 'A quiet week for changes flattered the number; it won’t last.' },
  ],
  tailwind: [
    { cause: 'external', why: 'A tailwind from {dep}: their launch pulled adoption forward.' },
    { cause: 'external', why: 'The new laptops shipped with the tooling pre-installed, which helped more than expected.' },
  ],
};

/** Recovery plans, by theme. `in` is how many weeks until it's back on plan. */
export const PATHS: Record<keyof typeof BEHIND, PathWords[]> = {
  incident: [
    { what: 'Finish the post-incident actions, then put the team back on {thing}.', in: 3 },
    { what: 'Looking into whether the incident changed the baseline before re-planning.', in: 3, state: 'investigating' },
  ],
  hiring: [
    { what: 'Borrow an engineer from {dep} until the new starter is productive.', in: 6 },
    { what: 'Narrow {thing} to the tier-1 services until the team is back to strength.', in: 5 },
  ],
  vendor: [
    { what: 'Escalate with {vendor} and run the interim workaround in the meantime.', in: 5 },
    { what: 'Agree a fallback with {vendor}: if the fix isn’t in by then, we build the workaround ourselves.', in: 4 },
  ],
  migration: [
    { what: 'Pair with the remaining teams one by one, two a week.', in: 5 },
    { what: 'Automate the manual step so the remaining services can move without us.', in: 6 },
  ],
  holiday: [
    { what: 'Normal pace resumes when the team is back; no change to the plan.', in: 3 },
  ],
  blocked: [
    { what: 'Agree a date with {dep} and pick up the parts that don’t depend on them.', in: 4 },
    { what: 'Take the dependency on ourselves if {dep} can’t commit to a date this week.', in: 5 },
  ],
  data: [
    { what: 'Fix the query and re-run the past weeks.', in: 2 },
  ],
  aggressive: [
    { what: 'Re-plan the rollout around the large teams, starting with the two biggest.', in: 6 },
    { what: 'The target should move; proposing a new one at the next leadership review.', in: 6, state: 'target' },
  ],
  slower: [
    { what: 'Narrow the scope to the tier-1 services first.', in: 4 },
    { what: 'Pair on the reviews so changes land the week they’re ready.', in: 3 },
  ],
  recovery: [
    { what: 'Keep the current pace; the gap closes at about a point a week.', in: 4 },
    { what: 'Hold the extra review capacity until the number is back on plan.', in: 3 },
  ],
};

/** What owners say in a week where nothing needs explaining. */
export const STEADY = [
  'On plan.',
  'On plan. Nothing to add this week.',
  'Steady week.',
  'Another team moved over this week.',
  'On plan; next week is the bigger batch.',
  'No surprises this week.',
  'Moving as planned.',
];

/** Fill a template with the goal's words. */
export function fill(t: string, words: { thing: string; dep?: string; vendor?: string }): string {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return t
    .replace(/\{Thing\}/g, cap(words.thing))
    .replace(/\{thing\}/g, words.thing)
    .replace(/\{dep\}/g, words.dep ?? 'the platform team')
    .replace(/\{vendor\}/g, words.vendor ?? 'The vendor');
}
