/* While goals are still waiting for their first check-in, on Home and Goals. */
import { useApp } from '../app/state';
import { firstReports } from '../domain/progress';

/** While goals are still waiting for their first check-in: how many are in, and who hasn't reported yet. */
export function FirstReports() {
  const app = useApp();
  const f = firstReports(app.snapshot, app.cycle, app.week);
  if (!f) return null;
  const names = f.waiting.map((w) => app.person(w.ownerId)?.name.split(' ')[0] ?? 'someone');
  const date = new Date(f.due + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <p className="first-reports small" role="status">
      <strong>{f.reported} of {f.total} goals have had their first check-in.</strong> Until they have, “nothing needs attention” only means nobody has reported.
      {' '}Waiting on {names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(names.length === 2 ? ' and ' : ', ')}; this week’s are due {date}.
    </p>
  );
}
