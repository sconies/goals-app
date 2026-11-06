/* Small in-place controls for removing and undoing: a comment's Edit and Remove, a check-in's Delete, a stopped goal's
   note, and "Undo this import" on an import's Activity entry. The rules are domain/removal's; removals end with a
   message that has Undo (app/state). */
import { useState, type ReactNode } from 'react';
import { useApp } from '../app/state';
import { Link } from 'react-router';
import { canUndoImport, importUndone, reviewHeld } from '../domain/removal';
import type { Change, CheckIn, Comment, Goal, Review } from '../domain/types';
import { whenText } from './ChangeItem';
import { LifeMark } from './LifeMark';

/** At the foot of a review's page, for whoever set it up or an admin: End this review (Delete, if it was never held). */
export function EndReview({ review }: { review: Review }) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  if (review.createdBy !== app.viewer.id && !app.viewer.admin) return null;
  const held = reviewHeld(app.full, review.id);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    try { await app.endReview(review.id); } catch { setBusy(false); }
  };
  return (
    <section className="block end-review" aria-labelledby="end-review">
      <h2 className="block-title" id="end-review">{held ? 'End this review' : 'Delete this review'}</h2>
      <p className="hint">{held ? 'It stops showing as due. What was said in it, its notes and its actions, stays on each goal and in exports.' : 'It has never been held, so it’s deleted rather than ended.'} You can undo it straight away, and an admin can restore it for 30 days.</p>
      <div><button type="button" className="btn" disabled={busy} onClick={() => void go()}>{busy ? 'Saving…' : held ? 'End this review' : 'Delete this review'}</button></div>
    </section>
  );
}

/** An ended review's page: its name, Ended, who ended it and when; Reopen for whoever ended it or an admin. */
export function EndedReview({ review }: { review: Review }) {
  const app = useApp();
  const who = app.person(review.endedBy ?? '')?.name ?? 'Someone';
  const can = app.viewer.admin || review.endedBy === app.viewer.id;
  return (
    <div className="page narrow review-home">
      <nav aria-label="Breadcrumb" className="crumbs"><Link to="/reviews">Reviews</Link></nav>
      <section className="hero">
        <div className="hero-body">
          <h1 className="title-xl">{review.name}</h1>
          <LifeMark k="ended" className="review-life" />
          <span className="muted review-line">Ended by {who}, {whenText(review.endedAt!, app.today)}. What was said in it stays on each goal’s page and in exports.</span>
          {can && <div className="actions" style={{ marginTop: 'var(--s2)' }}><button type="button" className="btn" onClick={() => void app.restoreRemoved('ended', review.id).then(() => app.toast(`Reopened ${review.name}`)).catch(() => undefined)}>Reopen the review</button></div>}
        </div>
      </section>
    </div>
  );
}

/** A comment with its author's Edit, and Remove for its author or an admin. Editing happens in place. */
export function CommentTools({ comment, body }: { comment: Comment; body: ReactNode }) {
  const app = useApp();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.text);
  const [busy, setBusy] = useState(false);
  const mine = comment.authorId === app.viewer.id;
  const canRemove = mine || app.viewer.admin;
  if (!mine && !canRemove) return <>{body}</>;
  const save = async () => {
    if (busy || text.trim().length < 2) return;
    setBusy(true);
    try { await app.editComment(comment.id, text); setEditing(false); app.toast('Comment edited'); } catch { /* the rule's message is shown */ }
    setBusy(false);
  };
  if (editing) {
    return (
      <form className="comment-edit" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label className="field"><span className="sr">Edit your comment</span>
          <textarea className="input" rows={2} autoFocus value={text} onChange={(e) => setText(e.target.value)} aria-label="Edit your comment" />
        </label>
        <span className="row" style={{ gap: 'var(--s2)' }}>
          <button type="submit" className="btn sm" disabled={busy || text.trim().length < 2}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" className="btn ghost sm" onClick={() => { setEditing(false); setText(comment.text); }}>Cancel</button>
        </span>
      </form>
    );
  }
  return (
    <>
      {body}
      <span className="comment-tools">
        {mine && <button type="button" className="linkish tiny" onClick={() => setEditing(true)}>Edit<span className="sr"> your comment</span></button>}
        {canRemove && <button type="button" className="linkish tiny" onClick={() => void app.deleteComment(comment.id).catch(() => undefined)}>Remove<span className="sr"> the comment</span></button>}
      </span>
    </>
  );
}

/** Delete a goal's latest check-in (its author or an admin); after a newer one it can only be corrected. */
export function DeleteCheckIn({ c }: { c: CheckIn }) {
  const app = useApp();
  return <button type="button" className="linkish small" onClick={() => void app.deleteCheckIn(c).catch(() => undefined)}>Delete this check-in</button>;
}

/** A stopped goal's line in its bar: who stopped it, when and why; and, for an admin or whoever stopped it, Restart. */
export function StoppedNote({ goal }: { goal: Goal }) {
  const app = useApp();
  const who = app.person(goal.stoppedBy ?? '')?.name ?? 'Someone';
  const can = app.viewer.admin || goal.stoppedBy === app.viewer.id;
  return (
    <span className="small stopped-note" role="note">
      <span className="strong">Stopped by {who}, {whenText(goal.stoppedAt!, app.today)}.</span> {goal.stopReason}
      {' '}It’s out of every list and the numbers; its history stays here.
      {can && <> <button type="button" className="linkish" onClick={() => void app.restoreRemoved('stopped', goal.id).then(() => app.toast(`Restarted ${goal.title}`)).catch(() => undefined)}>Restart it</button></>}
    </span>
  );
}

/** On an import's (or bulk edit's) Activity entry: Undo this import, for whoever made it or an admin; or that it's been undone. */
export function ImportUndo({ entry }: { entry: Change }) {
  const app = useApp();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (importUndone(app.snapshot, entry.entityId)) return <span className="tiny muted import-undone">Undone</span>;
  if (!canUndoImport(app.snapshot, entry, app.viewer)) return null;
  const go = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await app.undoImport(entry.entityId);
      app.toast(`Undid the import: ${out.restored} ${out.restored === 1 ? 'row' : 'rows'} put back${out.skipped.length ? `; ${out.skipped.length} skipped, changed since` : ''}`);
    } catch { setBusy(false); }
  };
  if (!asking) return <button type="button" className="btn sm import-undo" onClick={() => setAsking(true)}>Undo this import</button>;
  return (
    <span className="import-undo-ask" role="group" aria-label="Undo this import">
      <span className="small">Put every row it wrote back as it was? Rows changed since are skipped and listed.</span>
      <span className="row" style={{ gap: 'var(--s2)' }}>
        <button type="button" className="btn danger sm" disabled={busy} onClick={() => void go()}>{busy ? 'Undoing…' : 'Undo the import'}</button>
        <button type="button" className="btn ghost sm" onClick={() => setAsking(false)}>Cancel</button>
      </span>
    </span>
  );
}
