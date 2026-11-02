/* One goal in a line of facts: what every view and every export shows about it, worked out once.
   The table, board, cards, history grid, spreadsheet, JSON and AI brief all read from here, so they can't disagree. */
import { causeLabel } from './checkin';
import { fmt, gapText, kindLabel, LEVEL_LABEL, targetText } from './format';
import { planAt, planEnd, valueSeries, weekDate, type Point } from './plan';
import { assessPosted, checkInsFor, goalStatus, LABEL, RANK } from './status';
import { forecastText } from './tree';
import { storyOf, type Story } from './story';
import type { CheckIn, Cycle, DisplayStatus, Goal, Snapshot } from './types';

export interface GoalSummary {
  goal: Goal;
  owner: string;
  team: string;
  level: string;
  type: string;
  status: DisplayStatus;
  statusLabel: string;
  /** The latest number (or stages done), formatted. */
  now: string;
  nowValue: number | null;
  /** This week's plan, for number goals. */
  planNow: number | null;
  planNowText: string;
  /** The plan in the week of the latest number, which is what the gap compares against: "82% in week 42". */
  planThen: string | null;
  target: string;
  dueWeek: number;
  gap: string;
  gapTone: 'on' | 'risk' | 'off' | 'ahead' | 'stale';
  lastWeek: number | null;
  lastPostedAt: string | null;
  forecast: string | null;
  feedsInto: string | null;
  /** The owner's latest reason, path to green and what they need, when behind. */
  why: string;
  pathToGreen: string;
  needs: string;
  series: Point[];
  checkIns: CheckIn[];
  /** Why it's off, what the owner will do, by when, what they need, and what the numbers would hide. */
  story: Story;
}

export function summarise(goal: Goal, s: Snapshot, cycle: Cycle, today: Date, week: number): GoalSummary {
  const st = goalStatus(goal, cycle, s.checkIns, today);
  const a = assessPosted(goal, cycle, s.checkIns, week);
  const gap = gapText(goal, a);
  const own = checkInsFor(goal, s.checkIns);
  const last = own[own.length - 1] ?? null;
  const owner = s.people.find((p) => p.id === goal.ownerId)?.name ?? '—';
  const team = s.teams.find((t) => t.id === goal.teamId)?.name ?? '—';
  const nowValue = a.kind === 'milestone' ? null : a.actual;
  const now = a.kind === 'milestone' ? `${a.doneCount} of ${a.stages.length} stages` : a.actual == null || goal.kind === 'milestone' ? '—' : fmt(a.actual, goal);
  const planNow = goal.kind === 'metric' ? planAt(goal.plan, week, cycle.weeks) : null;
  const ptg = last?.pathToGreen;
  const behind = st.status === 'off' || st.status === 'risk';
  return {
    goal, owner, team,
    level: LEVEL_LABEL[goal.level],
    type: kindLabel(goal),
    status: st.status,
    statusLabel: LABEL[st.status],
    now, nowValue,
    planNow,
    planNowText: planNow != null && goal.kind === 'metric' ? fmt(planNow, goal) : '—',
    planThen: a.kind === 'metric' && a.actual != null && goal.kind === 'metric' ? `${fmt(a.plan, goal)} in week ${a.week}` : null,
    target: targetText(goal),
    dueWeek: goal.kind === 'metric' ? planEnd(goal.plan, cycle.weeks) : goal.kind === 'milestone' ? Math.max(0, ...goal.stages.map((x) => x.dueWeek)) : cycle.weeks,
    gap: st.status === 'stale' ? 'No recent check-in' : gap.short,
    gapTone: st.status === 'stale' ? 'stale' : gap.tone,
    lastWeek: last?.week ?? null,
    lastPostedAt: last?.postedAt ?? null,
    forecast: st.status === 'stale' ? null : forecastText(goal, a, cycle.weeks)?.text ?? null,
    feedsInto: goal.parentId ? s.goals.find((g) => g.id === goal.parentId)?.title ?? null : null,
    why: behind && last ? [last.cause ? causeLabel(last.cause) : '', last.why].filter((x) => x && x !== 'On plan.').join(': ') : '',
    pathToGreen: behind && ptg ? ptg.what + (ptg.byWeek != null ? ` (back on plan by week ${ptg.byWeek})` : '') : '',
    needs: behind ? ptg?.needs ?? '' : '',
    series: valueSeries(own),
    checkIns: own,
    story: storyOf(goal, s, cycle, week, today),
  };
}

export function summariseAll(goals: Goal[], s: Snapshot, cycle: Cycle, today: Date, week: number): GoalSummary[] {
  return goals.map((g) => summarise(g, s, cycle, today, week));
}

/** The owner's call for each week, for the history grid: the latest check-in posted for that week. */
export function weeklyCalls(checkIns: CheckIn[]): Map<number, CheckIn> {
  const m = new Map<number, CheckIn>();
  for (const c of checkIns) { const p = m.get(c.week); if (!p || p.postedAt <= c.postedAt) m.set(c.week, c); }
  return m;
}

export const STATUS_ORDER: DisplayStatus[] = ['off', 'risk', 'stale', 'none', 'on', 'planned', 'done'];
export const byStatus = (a: GoalSummary, b: GoalSummary) => RANK[b.status] - RANK[a.status] || a.goal.title.localeCompare(b.goal.title);
export const weekStarting = (cycle: Cycle, week: number) => weekDate(cycle, week);
