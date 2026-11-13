/* One logged change, as the goal page, Activity and Watching's "What changed" list it: who, what, when, and the
   before and after on request. The same component at three scopes. */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { LABEL } from '../domain/status';
import { COMMENT_REMOVED, EDITED, NOTE_REMOVED } from '../domain/vocabulary';
import type { Change } from '../domain/types';
import { Avatar, StatusShape, timeAgo } from './bits';
import { CommentTools } from './RemoveControls';
import { importCounts } from '../domain/removal';
import { UndoImport } from './UndoImport';

/** "3 h ago (30 Oct, 18:02)" for recent changes; just the date and time for older ones. */
export function whenText(iso: string, now: Date) {
  const abs = new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const rel = timeAgo(iso, now);
  return /ago|now|yesterday/.test(rel) ? `${rel} (${abs})` : abs;
}

/**
 * `manage`: on a goal's page, a comment's author can edit it and its author or an admin can remove it, in place.
 * `rows`: on an import's summary in Activity, the row entries folded under it (import spec 2.7), shown on request.
 */
export function ChangeItem({ c, showGoal, manage, rows }: { c: Change; showGoal?: boolean; manage?: boolean; rows?: Change[] }) {
  const app = useApp();
  const who = app.person(c.actorId);
  const [open, setOpen] = useState(false);
  const [rowsOpen, setRowsOpen] = useState(false);
  const file = c.action === 'imported' ? c.diffs.find((d) => d.field === 'File')?.to : undefined;
  // A summary that starts with its actor's own name (an arrival: "Ben Carter opened …") isn't given the name twice.
  const own = who && c.summary.startsWith(who.name + ' ') ? c.summary.slice(who.name.length + 1) : null;
  const said = file ? `imported ${file}: ${importCounts(c)}` : own ?? c.summary.charAt(0).toLowerCase() + c.summary.slice(1);
  const goal = c.goalId ? app.goal(c.goalId) : undefined;
  const diffs = c.diffs.filter((d) => d.field !== 'Note' || c.entity === 'decision');
  // A comment reads as it is now: its latest words (marked edited), or only its place, once removed.
  const comment = c.entity === 'note' && c.action === 'noted' ? app.comment(c.entityId) : undefined;
  const commentBody: ReactNode = c.entity === 'note' && c.action === 'noted' && (comment?.removedAt
    ? <p className="note-text comment-removed">{COMMENT_REMOVED}</p>
    : <p className="note-text">{comment?.text ?? c.diffs[0]?.to}{comment?.editedAt && <span className="hint edited-mark"> · {EDITED}</span>}</p>);
  return (
    <li className={'change change-' + c.entity}>
      <Avatar p={who ?? { name: c.actorId, initials: '?' }} size="sm" />
      <div className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
        <span className="small"><strong>{who?.name ?? c.actorId}</strong> {said}{showGoal && goal ? <> on <Link className="linkish" to={'/goals/' + goal.id}>{goal.title}</Link></> : null}</span>
        {manage && comment && !comment.removedAt ? <CommentTools comment={comment} body={commentBody} /> : commentBody}
        {(c.action === 'imported' && c.undo) || rows?.length ? (
          <span className="import-entry-tools">
            {c.action === 'imported' && c.undo && <UndoImport entry={c} className="linkish small tap" />}
            {rows?.length ? <button type="button" className="linkish small tap" aria-expanded={rowsOpen} onClick={() => setRowsOpen((o) => !o)}>{rowsOpen ? 'Hide the changes' : `Show the ${rows.length === 1 ? 'change' : rows.length + ' changes'}`}</button> : null}
          </span>
        ) : null}
        {rowsOpen && rows?.length ? <ol className="changes">{rows.map((r) => <ChangeItem key={r.id} c={r} showGoal />)}</ol> : null}
        {/* What was said in a review, said in place: the action, question or note, with who and by when (visual review 2). */}
        {c.entity === 'decision' && (() => {
          // A review note reads as it is now: removed (only its place), or its latest words, marked edited.
          const note = c.diffs.some((d) => d.field === 'Note') ? app.full.decisions.find((d) => d.id === c.entityId) : undefined;
          if (note?.removedAt) return c.action === 'removed' ? null : <p className="note-text comment-removed">{NOTE_REMOVED}</p>;
          if (note && c.action === 'noted') return <p className="note-text">{note.note}{note.editedAt && <span className="hint edited-mark"> · {EDITED}</span>}</p>;
          const said = c.diffs.find((d) => d.field === 'Action' || d.field === 'Question' || d.field === 'Note')?.to;
          const who = c.diffs.find((d) => d.field === 'Who')?.to;
          const due = c.diffs.find((d) => d.field === 'Due')?.to;
          return said ? <p className="note-text">{said}{who ? <span className="hint"> · {who}{due ? `, by ${due}` : ''}</span> : null}</p> : null;
        })()}
        <span className="tiny muted">{whenText(c.at, app.today)}</span>
        {diffs.length > 0 && c.entity !== 'note' && !rows?.length && (
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
