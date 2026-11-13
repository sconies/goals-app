/* Goals with the State filter on Stopped (goal entry 2.15, GE10: "State: Active · Proposed · Stopped"): the stopped goals
   in the scope, most recently stopped first, each with Stopped where a status would be (its own life shape and the word, ui/LifeMark),
   its key line with who stopped it and when, and the reason at the right. Stopped goals are on no Board or Map, so every
   layout lists them. Loaded only when the filter is on. */
import '../styles/notes/proposed.css';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import type { Goal } from '../domain/types';
import { LifeMark } from '../ui/LifeMark';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "stopped 4 Nov by Tunde". */
export function stoppedWhen(g: Pick<Goal, 'stoppedAt'>, by: string | null): string {
  const d = g.stoppedAt ? new Date(g.stoppedAt) : null;
  return `stopped${d ? ` ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` : ''}${by ? ` by ${by}` : ''}`;
}

/** The filter line, the count line and the rows. */
export function StoppedList({ goals, onRemove }: { goals: Goal[]; onRemove: () => void }) {
  const app = useApp();
  const list = [...goals].sort((a, b) => (b.stoppedAt ?? '').localeCompare(a.stoppedAt ?? ''));
  return (
    <>
      <p className="small filter-line" role="status">Filtered by: Stopped (<button type="button" className="linkish" onClick={onRemove}>Remove</button>)</p>
      <p className="small goals-line">{list.length ? `${list.length === 1 ? '1 stopped goal' : `${list.length} stopped goals`}, most recently stopped first.` : 'No stopped goals here.'}</p>
      {list.length > 0 && (
        <ul className="tree proposed-rows" data-part="Stopped goals">
          {list.map((g) => (
            <li key={g.id}>
              <Link className="grow proposed-row" to={'/goals/' + g.id}>
                <LifeMark k="stopped" />
                <span className="proposed-main">
                  <span className="strong">{g.title}</span>
                  <span className="small muted">{[g.key, app.person(g.ownerId)?.name, app.team(g.teamId)?.name, stoppedWhen(g, g.stoppedBy ? app.person(g.stoppedBy)?.name.split(' ')[0] ?? null : null)].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="small proposed-would">{g.stopReason ?? ''}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
