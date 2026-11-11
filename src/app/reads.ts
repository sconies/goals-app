/* Reads (docs/design/architecture.md, 4.4: AR4): the one place that turns the loaded workspace into what each rule
   reads. New rules in src/domain take only these rows, never the whole workspace (the layers lint checks it), so the
   internal app can hand them the same shapes from its query port instead of a loaded workspace. */
import type { GoalRows, PersonRows, TeamRows } from '../domain/find';
import { creatorOf, type DayOneRows } from '../domain/dayOne';
import { summariseAll } from '../domain/summary';
import type { Cycle, Snapshot } from '../domain/types';
import type { LocalRows } from '../adapters/localSearch';

const live = <T extends { removedAt?: string | null }>(xs: T[]) => xs.filter((x) => !x.removedAt);

/** Every goal's summary row, with what the Goals filters need beyond it. */
export function goalRows(s: Snapshot, cycle: Cycle, today: Date, week: number): GoalRows {
  const goals = live(s.goals).filter((g) => !g.stoppedAt);
  return { kind: 'goal', summaries: summariseAll(goals, s, cycle, today, week), ctx: { goals, cycle, week } };
}

export function personRows(s: Snapshot): PersonRows {
  const teams = new Map(s.teams.map((t) => [t.id, t.name]));
  return { kind: 'person', people: live(s.people), teamName: (id) => teams.get(id) ?? '' };
}

export function teamRows(s: Snapshot): TeamRows {
  return { kind: 'team', teams: s.teams, people: live(s.people) };
}

/** The rows the browser's Search answers from, each made once per workspace as loaded and only when first asked. */
export function searchRows(s: Snapshot, cycle: Cycle, today: Date, week: number): LocalRows {
  const once = <T,>(f: () => T) => { let v: T | undefined; return () => (v ??= f()); };
  return { goal: once(() => goalRows(s, cycle, today, week)), person: once(() => personRows(s)), team: once(() => teamRows(s)) };
}

/** What Home's "Getting started" reads (domain/dayOne.ts): who set it up, people, goals, which goals have a check-in
    and who watches anything. */
export function dayOneRows(s: Pick<Snapshot, 'people' | 'goals' | 'checkIns' | 'watches' | 'changes'>): DayOneRows {
  return {
    creatorId: creatorOf(s.changes, s.people),
    people: s.people,
    goals: s.goals,
    checkedIn: new Set(live(s.checkIns).map((c) => c.goalId)),
    watchers: new Set(live(s.watches ?? []).map((w) => w.personId)),
  };
}
