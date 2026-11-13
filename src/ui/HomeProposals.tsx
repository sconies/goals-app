/* Home's "Proposed goals" rows (goal entry rule 14, `proposalAsks`), under Needs your response: loaded only when there is one. */
import { Link } from 'react-router';
import { useApp } from '../app/state';
import type { ProposalAsk } from '../domain/proposed';
import { Avatar } from './bits';

export function ProposalRows({ proposals, notYet }: { proposals: ProposalAsk[]; notYet: (p: ProposalAsk) => void }) {
  const app = useApp();
  return (
    <div className="need-group" data-group="proposals">
      <h3 className="need-group-title">Proposed goals <span className="count-pill">· {proposals.length}</span></h3>
      <ul className="needs-list">
        {proposals.map((p) => (
          <li key={p.goal.id} className="need" data-proposal={p.kind}>
            <Avatar p={app.person(p.kind === 'for-you' ? p.goal.proposedBy ?? '' : p.goal.ownerId) ?? { name: '?', initials: '?' }} size="sm" />
            <span className="need-body">
              <span className="need-what">{p.goal.title}</span>
              <span className="need-meta">{p.says}</span>
              <span className="need-action">
                <Link className="btn sm" to={'/goals/' + p.goal.id}>Open it</Link>
                {p.kind === 'stale' && <button type="button" className="linkish tap" onClick={() => notYet(p)}>Not yet</button>}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
