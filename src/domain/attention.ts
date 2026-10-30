/* What needs someone's attention, and why. One list drives the homes, the goals list and the review. */
import { assessMetric, assessMilestone, assessRange, checkInsFor, goalStatus, LABEL, type GoalStatus } from './status';
import { fmt, weekLabel } from './format';
import type { CheckIn, Cycle, Decision, Goal, Snapshot } from './types';

export type FlagKind = 'off' | 'missed-path' | 'stale' | 'no-path' | 'risk' | 'trend' | 'proposal' | 'greener' | 'due';

export interface Flag {
  kind: FlagKind;
  /** Short label for a chip. */
  label: string;
  /** One sentence: what is wrong, in numbers where there are numbers. */
  detail: string;
  tone: 'off' | 'risk' | 'stale' | 'info';
}

export interface GoalAttention {
  goal: Goal;
  status: GoalStatus;
  flags: Flag[];
  /** Higher needs attention sooner. */
  weight: number;
}

const WEIGHT: Record<FlagKind, number> = { off: 100, 'missed-path': 90, stale: 80, 'no-path': 70, risk: 60, trend: 50, proposal: 45, greener: 30, due: 10 };

/** The latest check-in's proposal that no decision has answered yet. */
export function openProposal(goal: Goal, checkIns: CheckIn[], decisions: Decision[]): CheckIn | null {
  const own = checkInsFor(goal, checkIns).filter((c) => c.proposeTarget != null);
  const last = own[own.length - 1];
  if (!last) return null;
  const answered = decisions.some((d) => d.checkInId === last.id && (d.kind === 'approve-target' || d.kind === 'decline-target'));
  return answered ? null : last;
}

/**
 * A worsening trend the status may not show yet: progress against plan has fallen at the
 * last two check-ins, a range value has moved towards its limit twice running, or a
 * milestone stage's expected week has slipped since the previous check-in.
 */
export function worseningTrend(goal: Goal, cycle: Cycle, checkIns: CheckIn[]): string | null {
  const own = checkInsFor(goal, checkIns);
  if (goal.kind === 'metric') {
    const pts = own.filter((c) => c.value != null).map((c) => ({ week: c.week, value: c.value as number }));
    if (pts.length < 3) return null;
    const ratios = pts.slice(-3).map((p, i, arr) => assessMetric(goal, cycle.weeks, p.week, p.value, pts.slice(0, pts.length - arr.length + i)).ratio);
    const [a, b, c] = ratios;
    if (a == null || b == null || c == null) return null;
    if (c < b && b < a && c < 1) return `Progress against plan has fallen two check-ins running: ${Math.round(a * 100)}% → ${Math.round(b * 100)}% → ${Math.round(c * 100)}%.`;
    const last = assessMetric(goal, cycle.weeks, pts[pts.length - 1]!.week, pts[pts.length - 1]!.value, pts.slice(0, -1));
    if (last.forecastMisses && last.forecast != null && last.calc === 'on') return `On track today, but the last three weeks’ trend lands at ${fmt(last.forecast, goal)} against a target of ${fmt(goal.plan.target, goal)}.`;
    return null;
  }
  if (goal.kind === 'range') {
    const v = own.filter((c) => c.value != null).map((c) => c.value as number).slice(-3);
    if (v.length < 3) return null;
    const toward = goal.range.bound === 'atMost' ? (x: number, y: number) => y > x : (x: number, y: number) => y < x;
    if (toward(v[0]!, v[1]!) && toward(v[1]!, v[2]!) && !assessRange(goal, 1, v[2]!, v[1]!).out) {
      return `Moving towards the limit two weeks running: ${v.map((x) => fmt(x, goal)).join(' → ')} (limit ${fmt(goal.range.limit, goal)}).`;
    }
    return null;
  }
  const withStages = own.filter((c) => c.stages);
  if (withStages.length < 2) return null;
  const prev = withStages[withStages.length - 2]!, last = withStages[withStages.length - 1]!;
  const before = assessMilestone(goal, prev.week, prev.stages), now = assessMilestone(goal, last.week, last.stages);
  const slipped = now.stages.find((s, i) => s.kind !== 'done' && s.expectedWeek > (before.stages[i]?.expectedWeek ?? s.expectedWeek));
  return slipped ? `${slipped.name} slipped to ${weekLabel(slipped.expectedWeek, cycle.weeks)} at the last check-in.` : null;
}

export function attentionFor(goal: Goal, s: Snapshot, cycle: Cycle, today: Date): GoalAttention {
  const status = goalStatus(goal, cycle, s.checkIns, today);
  const { latest, week } = status;
  const flags: Flag[] = [];
  const add = (kind: FlagKind, label: string, detail: string, tone: Flag['tone']) => flags.push({ kind, label, detail, tone });
  const ptg = latest?.pathToGreen ?? null;
  const behind = status.status === 'off' || status.status === 'risk';

  if (status.status === 'off') add('off', 'Off track', latest?.why && latest.why !== 'On plan.' ? latest.why : 'The owner called it off track.', 'off');
  if (status.status === 'stale') {
    add('stale', 'Stale', latest ? `No check-in for ${status.daysSinceCheckIn} days; the last was week ${latest.week} (${LABEL[latest.status].toLowerCase()}).` : 'No check-in yet this cycle.', 'stale');
  }
  if (behind && ptg && ptg.byWeek < week) add('missed-path', 'Missed path to green', `Was due back on plan by week ${ptg.byWeek}: ${ptg.what}`, 'off');
  if (behind && !ptg) add('no-path', 'No path to green', 'It is behind and the owner has not said how it gets back.', 'off');
  if (status.status === 'risk') add('risk', 'At risk', latest?.why && latest.why !== 'On plan.' ? latest.why : 'The owner called it at risk.', 'risk');
  const trend = status.status === 'done' ? null : worseningTrend(goal, cycle, s.checkIns);
  if (trend) add('trend', 'Worsening trend', trend, 'risk');
  const proposal = openProposal(goal, s.checkIns, s.decisions);
  if (proposal && goal.kind === 'metric') add('proposal', 'Target change proposed', `${fmt(goal.plan.target, goal)} → ${fmt(proposal.proposeTarget as number, goal)}, waiting for the sponsor.`, 'info');
  if (status.greener && latest && status.status !== 'stale') add('greener', 'Greener than calculated', `Called ${LABEL[latest.status].toLowerCase()}; the numbers say ${LABEL[latest.calculated].toLowerCase()}. ${latest.greenerWhy}`, 'risk');
  if (week >= 1 && status.status !== 'done' && !checkInsFor(goal, s.checkIns).some((c) => c.week === week)) add('due', 'Check-in due', `Due before the review in week ${week}.`, 'info');

  flags.sort((a, b) => WEIGHT[b.kind] - WEIGHT[a.kind]);
  return { goal, status, flags, weight: flags.reduce((m, f) => Math.max(m, WEIGHT[f.kind]), 0) };
}

/** Everything that needs attention, worst first. Goals with only a due check-in are left out unless asked. */
export function attentionList(s: Snapshot, cycle: Cycle, today: Date, opts: { includeDue?: boolean; goals?: Goal[] } = {}): GoalAttention[] {
  return (opts.goals ?? s.goals)
    .map((g) => attentionFor(g, s, cycle, today))
    .filter((a) => a.flags.some((f) => opts.includeDue || f.kind !== 'due'))
    .sort((a, b) => b.weight - a.weight || a.goal.title.localeCompare(b.goal.title));
}
