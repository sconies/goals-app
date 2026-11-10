/* The health of the goals on screen, in one line (backlog GP, 9 Nov): how many off track, at risk, on track and so on,
   each a shape and a word, as Home's "Your goals" strip counts them. It counts the goals the page shows, so a filter or
   a tab changes it, and it agrees with the Board's lanes. */
import { useApp } from '../app/state';
import { LABEL } from '../domain/status';
import { STATUS_ORDER } from '../domain/vocabulary';
import type { DisplayStatus, Goal } from '../domain/types';
import { StatusShape } from './bits';

/** Each status the goals have, worst first, with how many: the words Home's strip uses. */
export function healthCounts(statuses: DisplayStatus[]): { status: DisplayStatus; n: number }[] {
  const by = new Map<DisplayStatus, number>();
  for (const k of statuses) by.set(k, (by.get(k) ?? 0) + 1);
  return STATUS_ORDER.filter((k) => by.get(k)).map((k) => ({ status: k, n: by.get(k)! }));
}

export function HealthLine({ goals }: { goals: Goal[] }) {
  const app = useApp();
  const counts = healthCounts(goals.map((g) => app.statusOf(g).status));
  if (!counts.length) return null;
  return (
    <div className="health-line" role="group" aria-label={`Health of these ${goals.length} goals`} data-part="Health">
      {counts.map((c) => <span key={c.status} className={'health-count tone-' + c.status}><StatusShape k={c.status} />{c.n} {LABEL[c.status].toLowerCase()}</span>)}
    </div>
  );
}
