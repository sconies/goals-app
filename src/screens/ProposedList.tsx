/* Goals with the State filter on Proposed (goal entry 2.15, GE10): the proposed goals in the scope, newest first, each
   with the word "Proposed" where a status would be (muted text, no shape, no capsule), its key line and, at the right,
   what it would measure. Loaded only when the filter is on, so a first visit doesn't carry it. */
import '../styles/notes/proposed.css';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { fmt, staysText } from '../domain/format';
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
  if (g.kind === 'metric') return g.targetUnset ? `${fmt(g.plan.start, g)} now, target not set` : `${fmt(g.plan.start, g)} to ${fmt(g.plan.target, g)}`;
  if (g.kind === 'range') { const s = staysText(g); return s[0]!.toUpperCase() + s.slice(1); }
  return `${g.stages.length} ${g.stages.length === 1 ? 'stage' : 'stages'}`;
}

const newestFirst = (goals: Goal[]) => [...goals].sort((a, b) => (b.proposedAt ?? '').localeCompare(a.proposedAt ?? ''));

/** The filter line and the count line, the same on the List, the Board and the Map. */
export function ProposedHead({ goals, onRemove }: { goals: Goal[]; onRemove: () => void }) {
  return (
    <>
      <p className="small filter-line" role="status">Filtered by: Proposed (<button type="button" className="linkish" onClick={onRemove}>Remove</button>)</p>
      <p className="small goals-line">{goals.length ? `${goals.length === 1 ? '1 proposed goal' : `${goals.length} proposed goals`}, newest first.` : 'No proposed goals here.'}</p>
    </>
  );
}

/** The Board with the filter on: one column, "Proposed", newest first; each card the word, its title, who and what it would measure. */
export function ProposedBoard({ goals }: { goals: Goal[] }) {
  const app = useApp();
  const list = newestFirst(goals);
  if (!list.length) return null;
  return (
    <div className="board" data-part="Proposed goals">
      <section className="board-col" aria-label={`Proposed, ${list.length}`}>
        <h2 className="board-head">Proposed<span className="board-count tnum">{list.length}</span></h2>
        <span className="hint board-meaning">Not yet active: nothing is due and it has no status</span>
        {list.map((g) => (
          <Link key={g.id} to={'/goals/' + g.id} className="board-card proposed">
            <span className="board-top"><span className="proposed-word">Proposed</span></span>
            <span className="board-title">{g.title}</span>
            <span className="hint ellipsis">{[app.person(g.ownerId)?.name, app.team(g.teamId)?.name].filter(Boolean).join(' · ')}</span>
            <span className="small muted">{wouldMeasure(g)}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}

/** With the filter on, in the layout chosen: the Board's one column, the Map (`map`, drawn by the Goals screen), else the list. */
export function ProposedList({ goals, onRemove, layout = 'list', map = null }: { goals: Goal[]; onRemove: () => void; layout?: string; map?: ReactNode }) {
  const app = useApp();
  const list = newestFirst(goals);
  return (
    <>
      <ProposedHead goals={list} onRemove={onRemove} />
      {layout === 'board' && <ProposedBoard goals={list} />}
      {layout === 'map' && list.length > 0 && map}
      {layout !== 'board' && layout !== 'map' && list.length > 0 && (
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
