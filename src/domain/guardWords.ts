/* Guardrails' words and the picker's rules (GR; the rule itself is guards.ts): only the screens and the tests read these,
   so they stay out of the first download. */
import { fmt, fmtDiff } from './format';
import { MAX_GUARDS, type GoalGuard, type GuardBreach } from './guards';
import type { Goal, Id } from './types';

/** Why a goal can't guard `goal`, in words; null when it can. */
export function guardRefusal(goal: Pick<Goal, 'id' | 'cycleId'>, other: Goal): string | null {
  if (other.id === goal.id) return 'A goal can’t guard itself';
  if (other.kind !== 'range') return 'Only a goal kept in a range can guard';
  if (other.removedAt || other.stoppedAt) return 'It’s no longer running';
  if (other.cycleId !== goal.cycleId) return 'It’s in another year';
  return null;
}

/** The guards as they are kept: known range goals, each once, never the goal itself, at most MAX_GUARDS. */
export function cleanGuards(goal: Pick<Goal, 'id' | 'cycleId'>, ids: readonly Id[], goals: readonly Goal[]): GoalGuard[] {
  const byId = new Map(goals.map((g) => [g.id, g]));
  const out: GoalGuard[] = [];
  for (const id of ids) {
    const g = byId.get(id);
    if (!g || guardRefusal(goal, g) || out.some((x) => x.goal === id)) continue;
    out.push({ goal: id });
  }
  return out.slice(0, MAX_GUARDS);
}

/** One breach in words: “Guardrail “Change failure rate” (G-41) is over its 12.0% limit: 14.0% in week 44, 2.0 pts over,
    2 weeks running.” */
export function breachWords(b: GuardBreach): string {
  const name = `“${b.guard.title}”${b.guard.key ? ` (${b.guard.key})` : ''}`;
  const side = b.bound === 'atMost' ? 'over' : 'under';
  const running = b.status === 'off' ? ', 2 weeks running' : '';
  return `Guardrail ${name} is ${side} its ${fmt(b.limit, b.guard)} limit: ${fmt(b.value, b.guard)} in week ${b.week}, ${fmtDiff(b.by, b.guard)} ${side}${running}.`;
}
