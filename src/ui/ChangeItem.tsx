/* One logged change, as the goal page, Activity and Watching's "What changed" list it: who, what, when, and the
   before and after on request. The same component at three scopes. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { LABEL } from '../domain/status';
import type { Change } from '../domain/types';
import { Avatar, StatusShape, timeAgo } from './bits';

/** "3 h ago (30 Oct, 18:02)" for recent changes; just the date and time for older ones. */
export function whenText(iso: string, now: Date) {
  const abs = new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const rel = timeAgo(iso, now);
  return /ago|now|yesterday/.test(rel) ? `${rel} (${abs})` : abs;
}

export function ChangeItem({ c, showGoal }: { c: Change; showGoal?: boolean }) {
  const app = useApp();
  const who = app.person(c.actorId);
  const [open, setOpen] = useState(false);
  const goal = c.goalId ? app.goal(c.goalId) : undefined;
  const diffs = c.diffs.filter((d) => d.field !== 'Note' || c.entity === 'decision');
  return (
    <li className={'change change-' + c.entity}>
      <Avatar p={who ?? { name: c.actorId, initials: '?' }} size="sm" />
      <div className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
        <span className="small"><strong>{who?.name ?? c.actorId}</strong> {c.summary.charAt(0).toLowerCase() + c.summary.slice(1)}{showGoal && goal ? <> on <Link className="linkish" to={'/goals/' + goal.id}>{goal.title}</Link></> : null}</span>
        {c.entity === 'note' && <p className="note-text">{c.diffs[0]?.to}</p>}
        {/* What was said in a review, said in place: the action, question or note, with who and by when (visual review 2). */}
        {c.entity === 'decision' && (() => {
          const said = c.diffs.find((d) => d.field === 'Action' || d.field === 'Question' || d.field === 'Note')?.to;
          const who = c.diffs.find((d) => d.field === 'Who')?.to;
          const due = c.diffs.find((d) => d.field === 'Due')?.to;
          return said ? <p className="note-text">{said}{who ? <span className="hint"> · {who}{due ? `, by ${due}` : ''}</span> : null}</p> : null;
        })()}
        <span className="tiny muted">{whenText(c.at, app.today)}</span>
        {diffs.length > 0 && c.entity !== 'note' && (
          <>
            <button className="linkish tiny" style={{ alignSelf: 'flex-start' }} aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide changes' : `Show ${diffs.length === 1 ? 'the change' : diffs.length + ' changes'}`}</button>
            {open && (
              <dl className="diffs">
                {diffs.map((d) => (
                  <div key={d.field} className="diff">
                    <dt>{d.field}</dt>
                    <dd>{d.from !== '—' && <del>{d.from}</del>}{d.from !== '—' && <span aria-hidden="true"> → </span>}{(() => {
                      // A status call is a status: its shape and word, in its own colour (design rules).
                      const k = d.field === 'Status call' ? (Object.keys(LABEL) as (keyof typeof LABEL)[]).find((x) => LABEL[x] === d.to) : undefined;
                      return k ? <ins className={'diff-status tone-' + k}><StatusShape k={k} />{d.to}</ins> : <ins>{d.to}</ins>;
                    })()}</dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}
      </div>
    </li>
  );
}
