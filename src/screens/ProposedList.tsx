/* Goals with the State filter on Proposed (goal entry 2.15, GE10): the proposed goals in the scope, newest first, each
   with the word "Proposed" where a status would be (muted text, no shape, no capsule), its key line and, at the right,
   what it would measure. Loaded only when the filter is on, so a first visit doesn't carry it. */
import '../styles/notes/proposed.css';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { fmt } from '../domain/format';
import { measureUnsaid } from '../domain/proposedSummary';
import { weeksProposed } from '../domain/proposedActions';
import type { Goal } from '../domain/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "proposed 11 Nov by Amara", or "proposed 9 weeks ago" once it has waited a while. */
function proposedWhen(g: Goal, today: Date, by: string | null): string {
  const n = weeksProposed(g, today);
  const d = g.proposedAt ? new Date(g.proposedAt) : today;
  return `proposed ${n >= 2 ? `${n} weeks ago` : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`}${by ? ` by ${by}` : ''}`;
}

/** At the right of a row: what it would measure, briefly ("40% to 90%"), or "Not said yet". */
export function wouldMeasure(g: Goal): string {
  if (measureUnsaid(g)) return 'Not said yet';
  if (g.kind === 'metric') return `${fmt(g.plan.start, g)} to ${fmt(g.plan.target, g)}`;
  if (g.kind === 'range') return `At ${g.range.bound === 'atMost' ? 'most' : 'least'} ${fmt(g.range.limit, g)}`;
  return `${g.stages.length} ${g.stages.length === 1 ? 'stage' : 'stages'}`;
}

export function ProposedList({ goals, onRemove }: { goals: Goal[]; onRemove: () => void }) {
  const app = useApp();
  const list = [...goals].sort((a, b) => (b.proposedAt ?? '').localeCompare(a.proposedAt ?? ''));
  return (
    <>
      <p className="small filter-line" role="status">Filtered by: Proposed (<button type="button" className="linkish" onClick={onRemove}>Remove</button>)</p>
      <p className="small goals-line">{list.length ? `${list.length === 1 ? '1 proposed goal' : `${list.length} proposed goals`}, newest first.` : 'No proposed goals here.'}</p>
      {list.length > 0 && (
        <ul className="tree proposed-rows" data-part="Proposed goals">
          {list.map((g) => {
            const by = g.proposedBy && g.proposedBy !== g.ownerId ? app.person(g.proposedBy)?.name.split(' ')[0] ?? null : null;
            return (
              <li key={g.id}>
                <Link className="grow proposed-row" to={'/goals/' + g.id}>
                  <span className="proposed-word">Proposed</span>
                  <span className="proposed-main">
                    <span className="strong">{g.title}</span>
                    <span className="small muted">{[g.key, app.person(g.ownerId)?.name, app.team(g.teamId)?.name, proposedWhen(g, app.today, by)].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="small proposed-would">{wouldMeasure(g)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
