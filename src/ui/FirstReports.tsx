/* While goals are still waiting for their first check-in, on Home and Goals. */
import { useState } from 'react';
import { useApp } from '../app/state';
import { firstReports } from '../domain/progress';

/**
 * While goals are still waiting for their first check-in: how many are in, and who hasn't reported yet. With `among`
 * (Home: your goals and the ones you watch), only while one of those is still waiting, as only then does it qualify what
 * the page lists. Goals says it whenever any goal is waiting.
 */
export function FirstReports({ among }: { among?: readonly string[] }) {
  const app = useApp();
  const [why, setWhy] = useState(false);
  const f = firstReports(app.snapshot, app.cycle, app.week);
  if (!f || (among && !f.silent.some((id) => among.includes(id)))) return null;
  const names = f.waiting.map((w) => app.person(w.ownerId)?.name.split(' ')[0] ?? 'someone');
  const date = new Date(f.due + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    // On a Goals phone screen it's one line until Why? is pressed (backlog G): the rest is below the goals' first screen.
    <p className="first-reports small" role="status" data-why={why || undefined}>
      <strong className="first-reports-full">{f.reported} of {f.total} goals have had their first check-in.</strong>
      <strong className="first-reports-short">First check-ins: {f.reported} of {f.total} goals.</strong>
      <span className="first-reports-more"> Until they have, “nothing needs attention” only means nobody has reported.
      {' '}Waiting on {names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(names.length === 2 ? ' and ' : ', ')}; this week’s are due {date}.</span>
      {' '}<button type="button" className="linkish first-reports-why" aria-expanded={why} onClick={() => setWhy(!why)}>{why ? 'Less' : 'Why?'}</button>
    </p>
  );
}
