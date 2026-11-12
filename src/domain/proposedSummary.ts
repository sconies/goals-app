/* A proposed goal's line (goal entry GE10, rule 14): its words and where it fits, and no status, gap, forecast or story.
   The status rules are never run on it. Apart from domain/summary so the first download doesn't carry it: the export,
   the AI tools and the screens that list proposed goals load it. Pure. */
import { kindLabel, targetText } from './format';
import { levelName } from './levels';
import { planEnd } from './plan';
import { isProposed, judged, PROPOSED, withProposed } from './proposed';
import type { GoalSummary } from './summary';
import type { Story } from './story';
import type { Cycle, Goal, Person, Team } from './types';

/** A proposed goal's line (rule 14): its words and where it fits, and no status, gap, forecast or story. `goalStatus` isn't run. */
/** What a proposed goal says when it has no measure yet. */
export const MEASURE_UNSAID = 'How it’s measured isn’t said yet.';
/** A proposed goal stored with nothing measured: dated stages with no stages (no column says a type is unknown). */
export const measureUnsaid = (g: Goal): boolean => isProposed(g) && g.kind === 'milestone' && g.stages.length === 0;

/** How many goals are active and how many proposed, counted apart (they never mix). Removed goals count in neither. */
export function goalCounts(goals: readonly Pick<Goal, 'proposedAt' | 'stoppedAt' | 'removedAt'>[]): { active: number; proposed: number } {
  const live = goals.filter((g) => !g.removedAt);
  return { active: judged(live).length, proposed: live.filter(isProposed).length };
}

/** A count line with its proposed goals said apart: "2 goals, worst first. 1 proposed". */
export const withProposedCount = (line: string, proposed: number): string => (proposed > 0 ? `${line}${line ? ' ' : ''}${proposed} proposed` : line);

export function proposedSummary(goal: Goal, s: { people: Person[]; teams: Team[]; goals: Goal[]; proposed?: Goal[] }, cycle: Cycle, week: number): GoalSummary {
  const owner = s.people.find((p) => p.id === goal.ownerId)?.name ?? '—';
  const team = s.teams.find((t) => t.id === goal.teamId)?.name ?? '—';
  const unsaid = measureUnsaid(goal);
  const target = unsaid ? 'Not said yet' : targetText(goal);
  const none = 'none' as const;
  const story: Story = { status: none, since: null, where: '', outlook: null, why: null, doing: null, byWhen: null, needs: null, answered: null, next: null, warnings: [], flags: [], feeds: null, result: null, quarters: [], label: PROPOSED };
  return {
    goal, owner, team, state: 'proposed',
    level: levelName(cycle, goal.level), type: unsaid ? 'Not said yet' : kindLabel(goal),
    status: none, statusLabel: PROPOSED, now: '', nowValue: null, planNow: null, planNowText: '—', planThen: null, target,
    dueWeek: goal.kind === 'metric' ? planEnd(goal.plan, cycle.weeks) : goal.kind === 'milestone' ? Math.max(0, ...goal.stages.map((x) => x.dueWeek)) : cycle.weeks,
    gap: '', gapTone: 'on', lastWeek: null, lastPostedAt: null, quietDays: 0,
    attention: { goal, status: { status: none, calc: none, latest: null, greener: false, daysSinceCheckIn: null, week }, flags: [], weight: 0, handled: null, lookedAt: null },
    forecast: null, projection: null,
    feedsInto: goal.parentId ? withProposed(s).find((g) => g.id === goal.parentId)?.title ?? null : null,
    why: '', pathToGreen: '', needs: '', series: [], checkIns: [], story,
  };
}

