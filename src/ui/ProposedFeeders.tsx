/* What feeds it, for the goals proposed to feed this one (goal entry 2.15's table, GE10): "Proposed · {n}" and a row for
   each, with the word and no status. They count in nothing: the health line above is the active goals' alone. Loaded
   only when a goal has one. */
import { Link } from 'react-router';
import { useApp } from '../app/state';
import type { Goal } from '../domain/types';
import '../styles/notes/proposed.css';

export function ProposedFeeders({ goals }: { goals: Goal[] }) {
  const app = useApp();
  const list = [...goals].sort((a, b) => (b.proposedAt ?? '').localeCompare(a.proposedAt ?? '') || a.title.localeCompare(b.title));
  return (
    <div className="proposed-feeders" data-part="Proposed feeders">
      <h3 className="field-label">Proposed · {list.length}</h3>
      <ul className="tree proposed-rows">
        {list.map((g) => (
          <li key={g.id}>
            <Link className="grow proposed-row" to={'/goals/' + g.id}>
              <span className="proposed-word">Proposed</span>
              <span className="proposed-main">
                <span className="strong">{g.title}</span>
                <span className="small muted">{[g.key, app.person(g.ownerId)?.name, app.team(g.teamId)?.name].filter(Boolean).join(' · ')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
