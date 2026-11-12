/* Removing, archiving and undoing (release 1b): every kind of record that can be made can be taken away again, and
   brought back. These are the only rules for it: who may remove what, what happens to whatever depended on it, what the
   change log says, how a removal is undone in the moment (the Undo on its message), and how an admin restores it later
   (Recently removed). The app (app/state.tsx), the bulk-change engine (an import's undo) and the AI assistants' MCP
   server (mcp/removeTools.ts) all call these, so a person and their assistant meet the same rules.

   One convention: nothing is deleted from the database. A removed record keeps its row and says when and by whom
   (removedAt/removedBy; leftAt for a person who left, stoppedAt and a reason for a stopped goal, endedAt for an ended
   review, deletedAt for a saved view). domain/cycle's scopeToCycle is the one place they leave every list. */
import { mayChangeGoal, mayPostCheckIn } from './goalRights';
import { withdrawnSummary, withProposed } from './proposed';
import type { Commit } from './commit';
import { byRecarry } from './copies';
import { NotAllowed, type ActionContext } from './actions';
import { asksOf, liveNotes, openAsksFor, withdrawAsk, writtenNotes } from './asks';
import { checkInsFor } from './status';
import { isTableView } from './tableLayout';
import { VIA_LABEL, type Via } from './via';
import { COMMENT_REMOVED, ENDED, LEFT, MIN_STOP_REASON, RESTORE_DAYS, STOPPED } from './vocabulary';
import type { Ask, Change, CheckIn, Comment, Cycle, Decision, Goal, Person, Review, Snapshot } from './types';
import { asBefore, hasModuleRows, moduleRowsBefore, removedModuleRows, restorableModuleRow, rowsLeaving, rowsUndone, applyModuleRows, type ModuleRecords } from './records';

const no = (msg: string): never => { throw new NotAllowed(msg); };
/** The whole workspace, every cycle and every removed record: what restoring reads. */
const fullOf = (x: ActionContext): Snapshot => x.full ?? x.snapshot;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** R1's row for changing a goal, stated once (domain/goalRights). */
const ownsOrAdmin = (x: ActionContext, g: Goal) => mayChangeGoal(x.actor, g);
type LogEntry = Pick<Change, 'entity' | 'entityId' | 'action' | 'summary'> & Partial<Change>;
const log = (x: ActionContext, v: LogEntry): Change => ({ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, diffs: [], ...v });
const nameIn = (s: Snapshot, id: string | null | undefined) => s.people.find((p) => p.id === id)?.name ?? '—';

/* ---------- comments: written, edited, removed and restored, all in the change log ---------- */

/**
 * Every comment as it reads now, by id. A comment is its 'noted' entry; later entries for the same comment (entity
 * 'note', the same entityId) edit it, remove it or restore it. Old comments, written before they could change, read as
 * they always did.
 */
export function commentsOf(changes: Change[]): Map<string, Comment> {
  const out = new Map<string, Comment>();
  const written = new Set(writtenNotes(changes).map((c) => c.id));
  for (const c of changes) {
    if (c.entity !== 'note') continue;
    if (c.action === 'noted' && written.has(c.id) && c.goalId) {
      out.set(c.entityId, { id: c.entityId, goalId: c.goalId, authorId: c.actorId, text: c.diffs.find((d) => d.field === 'Comment')?.to ?? c.diffs[0]?.to ?? '', at: c.at, editedAt: null, removedAt: null, removedBy: null });
      continue;
    }
    const k = out.get(c.entityId);
    if (!k) continue;
    if (c.action === 'edited') out.set(k.id, { ...k, text: c.diffs[0]?.to ?? k.text, editedAt: c.at });
    else if (c.action === 'removed') out.set(k.id, { ...k, removedAt: c.at, removedBy: c.actorId });
    else if (c.action === 'restored') out.set(k.id, { ...k, removedAt: null, removedBy: null });
  }
  return out;
}

/** What a comment's place in a thread says: its words, or "Comment removed". */
export const commentText = (k: Comment | undefined, fallback: string) => (!k ? fallback : k.removedAt ? COMMENT_REMOVED : k.text);

const commentOf = (x: ActionContext, id: string) => {
  const k = commentsOf(fullOf(x).changes).get(id);
  if (!k) no('There’s no comment with that ID.');
  return k!;
};

/** Correct a comment: only whoever wrote it. It then shows as edited. Null when the words are the same. */
export function editComment(x: ActionContext, id: string, text: string): Commit | null {
  const k = commentOf(x, id);
  if (k.removedAt) no('That comment has been removed.');
  if (k.authorId !== x.actor.id) no('Only whoever wrote a comment can edit it.');
  const t = text.trim();
  if (t.length < 2) no('Write the comment.');
  if (t === k.text) return null;
  return { changes: [log(x, { entity: 'note', entityId: k.id, goalId: k.goalId, action: 'edited', summary: 'Edited a comment', diffs: [{ field: 'Comment', from: k.text, to: t }] })] };
}

/** Remove a comment: whoever wrote it, or an admin. Its place in the thread says "Comment removed". */
export function deleteComment(x: ActionContext, id: string): Commit {
  const k = commentOf(x, id);
  if (k.removedAt) no('That comment has already been removed.');
  if (k.authorId !== x.actor.id && !x.actor.admin) no('Only whoever wrote a comment, or an admin, can remove it.');
  return { changes: [log(x, { entity: 'note', entityId: k.id, goalId: k.goalId, action: 'removed', summary: 'Removed a comment' })] };
}

/** Remove a note said in a review: whoever said it, or an admin. The review's record says "Note removed" in its place. */
export function deleteNote(x: ActionContext, id: string): Commit {
  const d = x.snapshot.decisions.find((v) => v.id === id) ?? fullOf(x).decisions.find((v) => v.id === id && !v.removedAt);
  if (!d || d.removedAt) no('There’s no note with that ID.');
  if (d!.kind !== 'note') no('Only a note can be removed; a question or an action is withdrawn.');
  if (d!.byId !== x.actor.id && !x.actor.admin) no('Only whoever said it, or an admin, can remove it.');
  const after: Decision = { ...d!, removedAt: x.now, removedBy: x.actor.id };
  return { decisions: [after], changes: [log(x, { entity: 'decision', entityId: d!.id, goalId: d!.goalId, action: 'removed', summary: 'Removed a note', diffs: [{ field: 'Note', from: d!.note, to: '—' }] })] };
}

/**
 * Undo marking goals reviewed in a session (deep review T3): those "reviewed" marks are set aside, kept and logged, and
 * the goals are back on the agenda. Whoever marked them, or an admin.
 */
export function unmarkReviewed(x: ActionContext, made: Decision[]): Commit {
  // The marks as they were saved: Undo can run before the page has the new ones.
  const marks = made.filter((d) => d.kind === 'acknowledge' && !d.removedAt);
  if (!marks.length) no('Those goals are no longer marked reviewed.');
  if (marks.some((d) => d.byId !== x.actor.id) && !x.actor.admin) no('Only whoever marked them, or an admin, can undo it.');
  const after = marks.map((d): Decision => ({ ...d, removedAt: x.now, removedBy: x.actor.id }));
  return { decisions: after, changes: after.map((d) => log(x, { entity: 'decision', entityId: d.id, goalId: d.goalId, action: 'undone', summary: 'Undid marking it reviewed' })) };
}

/* ---------- people ---------- */

/** What a person has left a mark on: goals they owned (in any cycle), check-ins, notes and comments, and asks. */
export function personHistory(s: Snapshot, id: string) {
  return {
    goals: s.goals.filter((g) => g.ownerId === id && !g.removedAt).length,
    checkIns: s.checkIns.filter((c) => c.authorId === id).length,
    notes: s.decisions.filter((d) => d.byId === id).length + liveNotes(s.changes).filter((c) => c.actorId === id).length,
    asks: asksOf(s).filter((r) => r.askedBy === id || r.recipientId === id || r.answeredBy === id).length,
  };
}
export const hasHistory = (h: ReturnType<typeof personHistory>) => h.goals + h.checkIns + h.notes + h.asks > 0;

/**
 * What marking someone as left hands over: the goals they own in this cycle (and any later one), the open asks they
 * raised and the open asks waiting on them, the reviews they're in, and the teams they lead.
 */
export function leaving(x: Pick<ActionContext, 'snapshot' | 'cycle' | 'full'>, id: string) {
  const full = x.full ?? x.snapshot;
  const later = new Set(full.cycles.filter((c) => !c.removedAt && c.startDate > x.cycle.startDate).map((c) => c.id));
  const goals = [...x.snapshot.goals.filter((g) => g.ownerId === id), ...full.goals.filter((g) => later.has(g.cycleId) && g.ownerId === id && !g.removedAt && !g.stoppedAt)];
  const open = asksOf(x.snapshot).filter((r) => r.status === 'open');
  return {
    goals,
    asked: open.filter((r) => r.askedBy === id),
    asking: open.filter((r) => r.recipientId === id),
    reviews: x.snapshot.reviews.filter((r) => r.people.includes(id)),
    leads: x.snapshot.teams.filter((t) => t.leadId === id),
  };
}

const livePerson = (x: ActionContext, id: string) => {
  const p = x.snapshot.people.find((v) => v.id === id);
  if (!p) no('There’s no one with that ID in this workspace.');
  return p!;
};
const notSelfOrLastAdmin = (x: ActionContext, p: Person, what: string) => {
  if (p.id === x.actor.id) no(`You can’t ${what} yourself. Ask another admin.`);
  if (p.admin && !x.snapshot.people.some((v) => v.admin && v.id !== p.id)) no('They’re the only admin: make someone else an admin first.');
};

/**
 * Admins: mark someone as left. Their goals (this cycle's, and any later one's) go to `goalsTo`, the open asks they
 * raised or must answer go to `asksTo`, they leave the reviews they were in, and the teams they led pass to `goalsTo`.
 * They're gone from pickers, counts, reviews and Home; history keeps their name, as "Name (left)".
 */
export function markPersonLeft(x: ActionContext, id: string, to: { goalsTo?: string | null; asksTo?: string | null } = {}): Commit {
  if (!x.actor.admin) no('Only admins can mark someone as left.');
  const p = livePerson(x, id);
  notSelfOrLastAdmin(x, p, 'mark');
  return departs(x, p, to, `Marked ${p.name} as left`);
}

/**
 * Anyone: leave this workspace yourself (backlog WS, Lane 9 Nov: members get "Leave this workspace"). The same as an
 * admin marking you as left: whoever takes over your goals and open asks is chosen first, you leave the reviews you
 * were in, and history keeps your name as "Name (left)". The only admin can't leave until someone else is one. An
 * admin can restore you from Recently removed for 30 days.
 */
export function leaveWorkspace(x: ActionContext, to: { goalsTo?: string | null; asksTo?: string | null } = {}): Commit {
  const p = livePerson(x, x.actor.id);
  if (p.admin && !x.snapshot.people.some((v) => v.admin && v.id !== p.id)) no('You’re the only admin here: make someone else an admin before you leave.');
  return departs(x, p, to, `${p.name} left the workspace`);
}

/** Someone leaving, however it's decided: hand over their goals and open asks, take them out of reviews and team leads. */
function departs(x: ActionContext, p: Person, to: { goalsTo?: string | null; asksTo?: string | null }, summary: string): Commit {
  const id = p.id;
  const l = leaving(x, id);
  const handTo = (ref: string | null | undefined, what: string) => {
    if (!ref) return null;
    if (ref === id) no(`Choose someone else to take over their ${what}.`);
    return livePerson(x, ref);
  };
  const goalsTo = handTo(to.goalsTo, 'goals');
  const asksTo = handTo(to.asksTo, 'asks');
  if (l.goals.length && !goalsTo) no(`${p.name} owns ${plural(l.goals.length, 'goal', 'goals')}: choose who takes them over.`);
  if ((l.asked.length || l.asking.length) && !asksTo) no(`${p.name} has ${plural(new Set([...l.asked, ...l.asking]).size, 'open ask', 'open asks')}: choose who takes them over.`);
  const goals = l.goals.map((g) => ({ ...g, ownerId: goalsTo!.id }));
  const asks = new Map<string, Ask>();
  for (const r of [...l.asked, ...l.asking]) {
    const cur = asks.get(r.id) ?? r;
    asks.set(r.id, { ...cur, ...(cur.askedBy === id ? { askedBy: asksTo!.id } : {}), ...(cur.recipientId === id ? { recipientId: asksTo!.id } : {}), updatedAt: x.now });
  }
  const reviews = l.reviews.map((r) => {
    const people = r.people.filter((v) => v !== id);
    return { ...r, people: people.length ? people : [goalsTo?.id ?? asksTo?.id ?? x.actor.id] };
  });
  const teams = l.leads.map((t) => ({ ...t, leadId: goalsTo?.id ?? '' }));
  const changes: Change[] = [
    log(x, {
      entity: 'person', entityId: id, action: 'left', summary,
      diffs: [
        { field: 'Status', from: '—', to: LEFT },
        ...(goals.length ? [{ field: 'Goals handed over', from: plural(goals.length, 'goal', 'goals'), to: goalsTo!.name }] : []),
        ...(asks.size ? [{ field: 'Open asks handed over', from: plural(asks.size, 'ask', 'asks'), to: asksTo!.name }] : []),
        ...(reviews.length ? [{ field: 'Reviews left', from: reviews.map((r) => r.name).join(', '), to: '—' }] : []),
        ...(teams.length ? [{ field: 'Team lead', from: teams.map((t) => t.name).join(', '), to: goalsTo?.name ?? '—' }] : []),
      ],
    }),
    ...l.goals.map((g) => log(x, { entity: 'goal', entityId: g.id, goalId: g.id, action: 'edited', summary: `Handed over to ${goalsTo!.name}, as ${p.name} left`, diffs: [{ field: 'Owner', from: p.name, to: goalsTo!.name }] })),
    ...[...asks.values()].map((r) => log(x, { entity: 'request', entityId: r.id, goalId: r.goalIds[0] ?? null, action: 'edited', summary: `Handed over to ${asksTo!.name}, as ${p.name} left`, diffs: [{ field: r.recipientId === asksTo!.id && l.asking.some((a) => a.id === r.id) ? 'Asked of' : 'Asked by', from: p.name, to: asksTo!.name }] })),
  ];
  return {
    people: [{ ...p, leftAt: x.now, leftBy: x.actor.id }],
    ...(goals.length ? { goals } : {}),
    ...(asks.size ? { requests: [...asks.values()] } : {}),
    ...(reviews.length ? { reviews } : {}),
    ...(teams.length ? { teams } : {}),
    changes,
  };
}

/** Admins: delete someone with no history at all (no goals, check-ins, notes or asks), say someone added by mistake. */
export function deletePerson(x: ActionContext, id: string): Commit {
  if (!x.actor.admin) no('Only admins can delete people.');
  const p = livePerson(x, id);
  notSelfOrLastAdmin(x, p, 'delete');
  if (hasHistory(personHistory(fullOf(x), id))) no(`${p.name} has history here (goals, check-ins, notes or asks): mark them as left instead, so it keeps their name.`);
  const reviews = x.snapshot.reviews.filter((r) => r.people.includes(id)).map((r) => ({ ...r, people: r.people.filter((v) => v !== id).length ? r.people.filter((v) => v !== id) : [x.actor.id] }));
  const teams = x.snapshot.teams.filter((t) => t.leadId === id).map((t) => ({ ...t, leadId: '' }));
  return {
    people: [{ ...p, removedAt: x.now, removedBy: x.actor.id }],
    ...(reviews.length ? { reviews } : {}),
    ...(teams.length ? { teams } : {}),
    changes: [log(x, { entity: 'person', entityId: id, action: 'removed', summary: `Deleted ${p.name}`, diffs: [{ field: 'Person', from: p.name, to: '—' }] })],
  };
}

/* ---------- goals ---------- */

const liveGoal = (x: ActionContext, id: string) => {
  const g = withProposed(x.snapshot).find((v) => v.id === id || v.key === id);
  if (!g) no('There’s no goal with that ID in this cycle.');
  return g!;
};
/** Whether a goal has history: any check-in. With none it's deleted; with some it's stopped, with a reason. */
export const goalHasCheckIns = (s: Pick<Snapshot, 'checkIns'>, goalId: string) => s.checkIns.some((c) => c.goalId === goalId && !c.removedAt);

/** What leaving the tree takes: the goals feeding it move up to what it fed, other goals stop listing it, its open asks are withdrawn. */
function detach(x: ActionContext, g: Goal, how: 'stopped' | 'deleted') {
  const parent = g.parentId ? withProposed(x.snapshot).find((v) => v.id === g.parentId) : undefined;
  const goals: Goal[] = [];
  const changes: Change[] = [];
  for (const c of withProposed(x.snapshot)) {
    if (c.id === g.id) continue;
    const child = c.parentId === g.id;
    const helps = c.alsoHelps?.includes(g.id);
    if (!child && !helps) continue;
    let next: Goal = { ...c };
    if (child) {
      next.parentId = parent?.id ?? null;
      if (!parent) { next.effect = null; delete next.whyHelps; }
    }
    if (helps) next.alsoHelps = c.alsoHelps!.filter((v) => v !== g.id);
    if (next.alsoHelps && !next.alsoHelps.length) delete next.alsoHelps;
    goals.push(next);
    changes.push(log(x, { entity: 'goal', entityId: c.id, goalId: c.id, action: 'edited', summary: child ? `Now feeds ${parent ? parent.title : 'nothing'}, as ${g.title} was ${how}` : `No longer also helps ${g.title}, as it was ${how}`, diffs: child ? [{ field: 'Feeds into', from: g.title, to: parent?.title ?? '—' }] : [{ field: 'Also helps', from: g.title, to: '—' }] }));
  }
  const requests: Ask[] = [];
  for (const r of openAsksFor(g.id, x.snapshot)) {
    const w = withdrawAsk(r, g.id, x.actor.id, x.now, x.newId, `Withdrawn: the goal was ${how}`);
    requests.push(w.request);
    changes.push(...w.changes);
  }
  return { goals, requests, changes };
}

/**
 * Stop a goal with history mid-cycle: its owner or an admin, with a reason. It leaves stats, reviews, Home, Watching and
 * attention lists, but stays in its history, on its own page (marked Stopped), in exports and in Activity. The goals
 * feeding it move up to what it fed, and its open asks are withdrawn with a note.
 */
export function stopGoal(x: ActionContext, goalId: string, reason: string): Commit {
  const g = liveGoal(x, goalId);
  if (!ownsOrAdmin(x, g)) no('Only the goal’s owner or an admin can stop it.');
  if (!goalHasCheckIns(x.snapshot, g.id)) no('It has no check-ins yet: delete it instead.');
  const why = reason.trim();
  if (why.length < MIN_STOP_REASON) no(`Say why it’s stopping, in a sentence (${MIN_STOP_REASON} characters or more).`);
  const d = detach(x, g, 'stopped');
  return {
    goals: [{ ...g, stoppedAt: x.now, stoppedBy: x.actor.id, stopReason: why }, ...d.goals],
    ...(d.requests.length ? { requests: d.requests } : {}),
    changes: [log(x, { entity: 'goal', entityId: g.id, goalId: g.id, action: 'stopped', summary: `Stopped ${g.title}`, diffs: [{ field: 'Status', from: '—', to: STOPPED }, { field: 'Why', from: '—', to: why }] }), ...d.changes],
  };
}

/** Delete a goal with no check-ins (set up by mistake): its owner or an admin. What fed it moves up; its open asks are withdrawn. */
export function deleteGoal(x: ActionContext, goalId: string): Commit {
  const g = liveGoal(x, goalId);
  if (!ownsOrAdmin(x, g)) no('Only the goal’s owner or an admin can delete it.');
  if (goalHasCheckIns(x.snapshot, g.id)) no('It has check-ins: stop it instead, with a reason, so its history stays.');
  const d = detach(x, g, 'deleted');
  return {
    goals: [{ ...g, removedAt: x.now, removedBy: x.actor.id }, ...d.goals],
    ...(d.requests.length ? { requests: d.requests } : {}),
    changes: [log(x, { entity: 'goal', entityId: g.id, goalId: g.id, action: 'removed', summary: g.proposedAt ? withdrawnSummary(g.title) : `Deleted ${g.title}`, diffs: [{ field: 'Goal', from: g.title, to: '—' }] }), ...d.changes],
  };
}

/* ---------- check-ins ---------- */

/**
 * Whether a check-in can still be deleted: by the goal's owner, as check-ins are theirs (R1; goalRights mayPostCheckIn,
 * the form's door), whoever posted it; and only the goal's latest. Once a newer one is posted it can only be corrected.
 */
export function canDeleteCheckIn(s: Pick<Snapshot, 'checkIns'>, goal: Goal, c: CheckIn, actor: Pick<Person, 'id' | 'admin'>) {
  return mayPostCheckIn(actor, goal, 'form') && checkInsFor(goal, s.checkIns).at(-1)?.id === c.id;
}
/** Why a check-in can't be deleted, or an import's check-ins put back, by anyone but the goal's owner. */
const ownersCheckIns = (x: ActionContext, g: Goal, what: 'delete' | 'change') => `Only ${x.snapshot.people.find((p) => p.id === g.ownerId)?.name ?? 'its owner'} (its owner) can ${what} its check-ins.`;

/**
 * Delete a check-in: the goal's owner (R1), until a newer check-in exists on the goal (then it can only be corrected).
 * The goal's status is worked out again from the one before. An open ask it raised is withdrawn.
 */
export function deleteCheckIn(x: ActionContext, id: string): Commit {
  const c = x.snapshot.checkIns.find((v) => v.id === id);
  if (!c) no('There’s no check-in with that ID in this cycle.');
  const g = x.snapshot.goals.find((v) => v.id === c!.goalId);
  if (!g) no('That check-in’s goal isn’t live in this cycle.');
  if (!mayPostCheckIn(x.actor, g!, 'form')) no(ownersCheckIns(x, g!, 'delete'));
  if (checkInsFor(g!, x.snapshot.checkIns).at(-1)?.id !== c!.id) no('A newer check-in has been posted since, so this one can only be corrected.');
  const requests: Ask[] = [];
  const changes: Change[] = [log(x, { entity: 'check-in', entityId: c!.id, goalId: g!.id, action: 'removed', summary: `Deleted the check-in for week ${c!.week}`, diffs: [{ field: 'Check-in', from: `Week ${c!.week}`, to: '—' }] })];
  for (const r of asksOf(x.snapshot).filter((v) => v.checkInId === c!.id && v.status === 'open')) {
    const w = withdrawAsk(r, g!.id, x.actor.id, x.now, x.newId, 'Withdrawn: the check-in that raised it was deleted');
    requests.push(w.request);
    changes.push(...w.changes);
  }
  return { checkIns: [{ ...c!, removedAt: x.now, removedBy: x.actor.id }], ...(requests.length ? { requests } : {}), changes };
}

/* ---------- reviews ---------- */

/** Whether a review has ever been held: anything said or asked in it, in any cycle. */
export function reviewHeld(s: Snapshot, reviewId: string) {
  return s.decisions.some((d) => d.reviewId === reviewId) || asksOf(s).some((a) => a.reviewId === reviewId);
}
const liveReview = (x: ActionContext, id: string) => {
  const r = x.snapshot.reviews.find((v) => v.id === id);
  if (!r) no('There’s no review with that ID.');
  if (r!.createdBy !== x.actor.id && !x.actor.admin) no('Only whoever set up the review, or an admin, can end it.');
  return r!;
};

/**
 * End a review: whoever set it up, or an admin. It keeps its notes and actions and stops showing as due. A review that
 * was never held is deleted instead (`deleted` says which happened).
 */
export function endReview(x: ActionContext, id: string): { commit: Commit; deleted: boolean } {
  const r = liveReview(x, id);
  if (!reviewHeld(fullOf(x), r.id)) return { commit: deleteReview(x, id), deleted: true };
  return { deleted: false, commit: { reviews: [{ ...r, endedAt: x.now, endedBy: x.actor.id }], changes: [log(x, { entity: 'review', entityId: r.id, action: 'ended', summary: `Ended the review “${r.name}”`, diffs: [{ field: 'Review', from: r.name, to: ENDED }] })] } };
}

/** Delete a review that was never held: whoever set it up, or an admin. One that has been held is ended instead. */
export function deleteReview(x: ActionContext, id: string): Commit {
  const r = liveReview(x, id);
  if (reviewHeld(fullOf(x), r.id)) no('It’s been held: end it instead, so its notes and actions stay.');
  return { reviews: [{ ...r, removedAt: x.now, removedBy: x.actor.id }], changes: [log(x, { entity: 'review', entityId: r.id, action: 'removed', summary: `Deleted the review “${r.name}”`, diffs: [{ field: 'Review', from: r.name, to: '—' }] })] };
}

/* ---------- cycles ---------- */

/** Whether a cycle can be deleted: no check-in has been posted on any of its goals, and it isn't the only one. */
export function cycleDeletable(s: Snapshot, cycleId: string) {
  return cycleStanding(s, cycleId).deletable;
}

/**
 * Where a cycle stands, in words that are true (backlog WS: a new workspace with no goals said "Has check-ins"): how many
 * goals and check-ins it has, whether it's the only one, and so whether it can be deleted, and why not.
 */
export function cycleStanding(s: Snapshot, cycleId: string): { goals: number; checkIns: number; only: boolean; deletable: boolean; says: string } {
  const ids = new Set(s.goals.filter((g) => g.cycleId === cycleId && !g.removedAt).map((g) => g.id));
  const checkIns = s.checkIns.filter((c) => ids.has(c.goalId) && !c.removedAt).length;
  const only = !s.cycles.some((c) => c.id !== cycleId && !c.removedAt);
  const goals = `${ids.size.toLocaleString('en-GB')} ${ids.size === 1 ? 'goal' : 'goals'}`;
  const says = checkIns
    ? `${goals}, ${checkIns.toLocaleString('en-GB')} ${checkIns === 1 ? 'check-in' : 'check-ins'}: it stays`
    : only ? `${ids.size ? goals + ', no' : 'No goals and no'} check-ins yet; it’s the only cycle, so it stays`
    : `${ids.size ? goals + ', no' : 'No goals and no'} check-ins yet: it can be deleted`;
  return { goals: ids.size, checkIns, only, deletable: !checkIns && !only, says };
}

/** Admins: delete a cycle no one has checked in to yet (started by mistake, say). Its goals go with it, and come back with it. */
export function deleteCycle(x: ActionContext, id: string): Commit {
  if (!x.actor.admin) no('Only admins can delete a cycle.');
  const full = fullOf(x);
  const c = full.cycles.find((v) => v.id === id && !v.removedAt);
  if (!c) no('There’s no cycle with that ID.');
  if (!full.cycles.some((v) => v.id !== id && !v.removedAt)) no('It’s the only cycle, so it stays.');
  if (startOf(full, id)) no('Use Undo on Cycles: it also puts back what moved with the goals.');
  if (!cycleDeletable(full, id)) no('Check-ins have been posted in it, so it stays.');
  return { cycles: [{ ...c!, removedAt: x.now, removedBy: x.actor.id }], changes: [log(x, { entity: 'cycle', entityId: c!.id, action: 'removed', summary: `Deleted the cycle ${c!.name}`, diffs: [{ field: 'Cycle', from: c!.name, to: '—' }] })] };
}

/** The change that started a cycle from the wrap-up (it keeps what it added), if this cycle was made that way and not undone. */
export function startOf(s: { changes: Change[] }, cycleId: string): Change | undefined {
  if (s.changes.some((c) => c.entity === 'cycle' && c.entityId === cycleId && c.action === 'undone')) return undefined;
  return s.changes.find((c) => c.entity === 'cycle' && c.entityId === cycleId && c.action === 'created' && !!c.undo);
}

/**
 * Whether starting a cycle can still be undone (cycle-end rule 9): it was started from the wrap-up, and nobody has used
 * it yet: no check-in in it, no goal in it changed or added by a person, and no later cycle.
 */
export function canUndoStart(full: { cycles: Pick<Cycle, 'id' | 'startDate' | 'removedAt'>[]; goals: Pick<Goal, 'id' | 'cycleId' | 'removedAt'>[]; checkIns: Pick<CheckIn, 'goalId' | 'removedAt'>[]; changes: Change[] }, cycleId: string): { ok: true } | { ok: false; why: string } {
  const c = full.cycles.find((v) => v.id === cycleId && !v.removedAt);
  const start = startOf(full, cycleId);
  if (!c || !start) return { ok: false, why: 'it wasn’t started from the wrap-up' };
  const ids = new Set(full.goals.filter((g) => g.cycleId === cycleId && !g.removedAt).map((g) => g.id));
  const checkIns = full.checkIns.filter((ci) => ids.has(ci.goalId) && !ci.removedAt).length;
  if (checkIns) return { ok: false, why: `${plural(checkIns, 'check-in is', 'check-ins are')} in it` };
  const made = new Set((start.undo?.goals ?? []).map((g) => g.id));
  // A copy recarry added later (the goal carried on after all) was made by the start's rules, not by a person.
  const changed = new Set([...ids].filter((id) => !made.has(id) && !full.changes.some((ch) => ch.goalId === id && /carries on into /.test(ch.summary))));
  for (const ch of full.changes) if (ch.at >= start.at && ch.id !== start.id && ch.goalId && ids.has(ch.goalId) && !byRecarry(ch.summary)) changed.add(ch.goalId);
  if (changed.size) return { ok: false, why: `${plural(changed.size, 'goal in it has', 'goals in it have')} been changed` };
  if (full.cycles.some((v) => !v.removedAt && v.startDate > c.startDate)) return { ok: false, why: 'a later cycle has been started' };
  return { ok: true };
}

/**
 * Admins: undo starting a cycle (cycle-end rule 9). The cycle is removed as a deleted one is (listed in Recently
 * removed for 30 days); the year before is as it was. Starting again makes a new cycle, and then the removed one
 * can never come back (restore refuses a second cycle with the same start).
 */
export function undoStart(x: ActionContext, cycleId: string): Commit {
  if (!x.actor.admin) no('Only admins can undo the start of a cycle.');
  const full = fullOf(x);
  const c = full.cycles.find((v) => v.id === cycleId && !v.removedAt);
  if (!c) no('There’s no cycle with that ID.');
  const can = canUndoStart(full, cycleId);
  if (!can.ok) no(`${c!.name} can’t be undone now: ${can.why}.`);
  // What came with the goals goes back as it was: added watches and modules' rows (a metric link) are removed, asks and
  // reviews restored.
  const u = startOf(full, cycleId)!.undo!;
  const gone = { removedAt: x.now, removedBy: x.actor.id };
  // Everything in the cycle goes, the start's copies and any recarry added later, with what came with them.
  const added = new Set([...u.goals.map((g) => g.id), ...full.goals.filter((g) => g.cycleId === cycleId).map((g) => g.id)]);
  const watches = (full.watches ?? []).filter((w) => ((u.watches ?? []).includes(w.id) || added.has(w.ref)) && !w.removedAt).map((w) => ({ ...w, ...gone }));
  const modules = applyModuleRows(rowsUndone(full.modules, u.modules ?? [], gone), rowsLeaving(full.modules, added, x.records ?? [], gone)) ?? {};
  const asks = new Map(u.requests.map((r) => r.before).filter((r): r is Ask => !!r).map((r) => [r.id, r]));
  for (const r of full.requests ?? []) if (r.goalIds.some((id) => added.has(id)) && !asks.has(r.id)) asks.set(r.id, r);
  const requests = [...asks.values()].map((r) => { const now = (full.requests ?? []).find((v) => v.id === r.id); return now ? { ...now, goalIds: now.goalIds.filter((id) => !added.has(id)) } : r; });
  const reviews = (u.reviews ?? []).map((r) => r.before).filter((r): r is Review => !!r).map((r) => { const now = (full.reviews ?? []).find((v) => v.id === r.id) ?? r; return { ...now, scope: { ...now.scope, goals: now.scope.goals.filter((id) => !added.has(id)), trees: now.scope.trees.filter((id) => !added.has(id)) } }; });
  return { cycles: [{ ...c!, removedAt: x.now, removedBy: x.actor.id }], watches, ...(hasModuleRows(modules) ? { modules } : {}), requests, reviews, changes: [log(x, { entity: 'cycle', entityId: c!.id, action: 'undone', summary: `Undid the start of ${c!.name}`, diffs: [{ field: 'Cycle', from: c!.name, to: '—' }] })] };
}

/* ---------- imports and bulk edits ---------- */

/** An import's (or bulk edit's) summary entry, by its import id. */
export const importEntry = (s: Pick<Snapshot, 'changes'>, importId: string) => s.changes.find((c) => c.action === 'imported' && c.entityId === importId);
/** Whether an import has been undone. */
export const importUndone = (s: Pick<Snapshot, 'changes'>, importId: string) => s.changes.some((c) => c.action === 'undone' && c.entityId === importId);
/** Whether this person may undo an import now: one that can be undone, not undone yet, and theirs (or they're an admin). */
export const canUndoImport = (s: Pick<Snapshot, 'changes'>, entry: Change, actor: Person) => !!entry.undo && !importUndone(s, entry.entityId) && (entry.actorId === actor.id || actor.admin);

const onDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Why a row changed since, from the latest change that touched it (spec 2.6's sentences). */
function keptReason(rows: { people: readonly Person[]; checkIns: readonly CheckIn[] }, c: Change, of: 'goal' | 'check-in' | 'person' | 'other'): string {
  const who = rows.people.find((p) => p.id === c.actorId)?.name ?? 'Someone';
  const on = onDay(c.at);
  if (c.entity === 'check-in' && (c.action === 'posted' || c.action === 'created')) {
    const week = rows.checkIns.find((v) => v.id === c.entityId)?.week;
    return `${who} posted a check-in${week != null ? ` for week ${week}` : ''} on ${on}`;
  }
  if (of === 'check-in') return c.action === 'removed' ? `The check-in was deleted on ${on}` : `The check-in was corrected on ${on}`;
  const field = c.diffs.find((d) => d.field !== 'Via')?.field;
  return field ? `Its ${field.toLowerCase()} was changed on ${on}` : `It was changed on ${on}`;
}

/** What undoing an import would do, worked out once for undoImport and undoPreview. */
function undoPlan(x: ActionContext, importId: string): { commit: Commit; restored: number; skipped: KeptRow[] } {
  const full = fullOf(x);
  const entry = importEntry(full, importId);
  if (!entry) no('There’s no import with that ID.');
  if (!entry!.undo) no('That import was saved before imports could be undone.');
  if (importUndone(full, importId)) no('That import has already been undone.');
  if (entry!.actorId !== x.actor.id && !x.actor.admin) no('Only whoever made the import, or an admin, can undo it.');
  const u = entry!.undo!;
  const own = new Set(full.changes.filter((c) => c.importId === importId).map((c) => c.id));
  const since = full.changes.filter((c) => c.at > entry!.at && !own.has(c.id) && c.id !== entry!.id);
  const latest = (f: (c: Change) => boolean) => { for (let i = since.length - 1; i >= 0; i--) if (f(since[i]!)) return since[i]; return undefined; };
  const touchedBy = (entity: Change['entity'], id: string) => latest((c) => c.entity === entity && c.entityId === id);
  const skipped: KeptRow[] = [];
  const keep = (name: string, c: Change, of: 'goal' | 'check-in' | 'person' | 'other', reason?: string) => skipped.push({ name, reason: reason ?? keptReason(full, c, of), at: c.at, by: c.actorId });
  const goals: Goal[] = [], checkIns: CheckIn[] = [], people: Person[] = [], requests: Ask[] = [];
  const changes: Change[] = [];
  for (const { id, before } of u.goals) {
    const cur = full.goals.find((g) => g.id === id);
    // A goal the import deleted (an Action row) comes back; one deleted some other way since is left alone.
    if (!cur || (cur.removedAt && (!before || before.removedAt))) continue;
    const by = touchedBy('goal', id) ?? (!before ? latest((c) => c.goalId === id) : undefined);
    if (by) { keep(cur.title, by, 'goal'); continue; }
    goals.push(before ? ({ ...asBefore(cur, before), ...(cur.key ? { key: cur.key } : {}) } as Goal) : { ...cur, removedAt: x.now, removedBy: x.actor.id });
    changes.push(log(x, { entity: 'goal', entityId: id, goalId: id, action: before ? 'edited' : 'removed', summary: before ? 'Put back as it was before an import' : `Deleted ${cur.title}: an import that added it was undone`, importId }));
  }
  // Putting a check-in back is changing it, so it asks R1 through the door the import came in by: an admin may undo a
  // workbook, but not an owner's own correction; a goal handed on since is its new owner's.
  const via = viaOf(entry!);
  const goingGoals = new Set(u.goals.filter((v) => !v.before).map((v) => v.id));
  for (const { id, before } of u.checkIns) {
    const cur = full.checkIns.find((c) => c.id === id);
    if (!cur || cur.removedAt) continue;
    const goal = full.goals.find((g) => g.id === cur.goalId);
    const by = touchedBy('check-in', id);
    if (by) { keep(`${goal?.title ?? 'A goal'}, week ${cur.week}`, by, 'check-in'); continue; }
    if (goal && !goingGoals.has(goal.id) && !mayPostCheckIn(x.actor, goal, via)) { keep(`${goal.title}, week ${cur.week}`, entry!, 'check-in', ownersCheckIns(x, goal, 'change')); continue; }
    checkIns.push(before ? asBefore(cur, before) : { ...cur, removedAt: x.now, removedBy: x.actor.id });
    changes.push(log(x, { entity: 'check-in', entityId: id, goalId: cur.goalId, action: before ? 'edited' : 'removed', summary: before ? `Put the check-in for week ${cur.week} back as it was before an import` : `Deleted the check-in for week ${cur.week}: an import that added it was undone`, importId }));
  }
  // A goal Undo deletes leaves the tree as deleteGoal's does: what fed it moves up to what it fed (past any goal Undo
  // also deletes), other goals stop listing it, and its open asks are withdrawn. A goal fed by one changed since stays.
  const goalsBack = goals.length;
  const removing = new Map(goals.filter((g) => g.removedAt).map((g) => [g.id, g]));
  const goalNow = (id: string) => goals.find((g) => g.id === id) ?? full.goals.find((g) => g.id === id);
  for (const g of full.goals) {
    if (g.removedAt || removing.has(g.id)) continue;
    const cur = goalNow(g.id)!;
    const fed = cur.parentId ? removing.get(cur.parentId) : undefined;
    const helps = (cur.alsoHelps ?? []).filter((id) => removing.has(id));
    if (!fed && !helps.length) continue;
    const next: Goal = { ...cur };
    let to: Goal | undefined;
    if (fed) {
      let up = fed.parentId;
      while (up && removing.has(up)) up = removing.get(up)!.parentId;
      to = up ? goalNow(up) : undefined;
      if (to && (to.removedAt || to.stoppedAt)) to = undefined;
      next.parentId = to?.id ?? null;
      if (!to) { next.effect = null; delete next.whyHelps; }
    }
    if (helps.length) next.alsoHelps = cur.alsoHelps!.filter((id) => !removing.has(id));
    if (next.alsoHelps && !next.alsoHelps.length) delete next.alsoHelps;
    const i = goals.findIndex((v) => v.id === g.id);
    if (i >= 0) goals[i] = next; else goals.push(next);
    if (fed) changes.push(log(x, { entity: 'goal', entityId: g.id, goalId: g.id, action: 'edited', summary: `Now feeds ${to ? to.title : 'nothing'}, as ${fed.title} was deleted by undoing an import`, diffs: [{ field: 'Feeds into', from: fed.title, to: to?.title ?? '—' }], importId }));
    for (const id of helps) changes.push(log(x, { entity: 'goal', entityId: g.id, goalId: g.id, action: 'edited', summary: `No longer also helps ${removing.get(id)!.title}, as it was deleted by undoing an import`, diffs: [{ field: 'Also helps', from: removing.get(id)!.title, to: '—' }], importId }));
  }
  const ownAsks = new Set(u.requests.map((r) => r.id));
  for (const g of removing.values()) {
    for (const r of openAsksFor(g.id, full)) {
      if (ownAsks.has(r.id) || requests.some((v) => v.id === r.id)) continue;
      const w = withdrawAsk(r, g.id, x.actor.id, x.now, x.newId, 'Withdrawn: the goal was deleted by undoing an import');
      requests.push(w.request);
      changes.push(...w.changes.map((c) => ({ ...c, importId })));
    }
  }
  // Someone the import added goes again, unless they're in use since: they've done something, own a goal, lead a team,
  // sit in a review, or an ask is theirs. Then they're skipped, like any row changed since.
  const added = (gid: string) => u.goals.some((v) => v.id === gid && !v.before);
  const addedTeams = new Set((u.teams ?? []).filter((t) => !t.before).map((t) => t.id));
  const teamBefore = new Map((u.teams ?? []).filter((t) => t.before).map((t) => [t.id, t.before!]));
  const going = new Map<string, Person>();
  for (const { id, before } of u.people) {
    const cur = full.people.find((p) => p.id === id);
    if (!cur || cur.removedAt) continue;
    const by = touchedBy('person', id);
    if (by) { keep(cur.name, by, 'person'); continue; }
    if (!before) {
      const acted = latest((c) => c.actorId === id);
      const owns = full.goals.some((g) => g.ownerId === id && !g.removedAt && !added(g.id));
      const inReview = (full.reviews ?? []).some((r) => r.people.includes(id) && !r.removedAt && !(u.reviews ?? []).some((v) => v.id === r.id));
      const asked = asksOf(full).some((r) => !ownAsks.has(r.id) && (r.askedBy === id || r.recipientId === id || r.answeredBy === id));
      const why = acted || owns ? 'has made changes since' : inReview ? 'is in a review since' : asked ? 'has an ask since' : '';
      if (why) { skipped.push({ name: cur.name, reason: `${cur.name} ${why}`, at: acted?.at ?? entry!.at, by: id }); continue; }
      going.set(id, cur);
      continue;
    }
    people.push(asBefore(cur, before));
    changes.push(log(x, { entity: 'person', entityId: id, action: 'edited', summary: `Put ${before.name} back as they were before an import`, importId }));
  }
  // What marking someone as left changed besides: the reviews they left and the teams they led.
  const reviews: Review[] = [];
  for (const { id, before } of u.reviews ?? []) {
    const cur = (full.reviews ?? []).find((r) => r.id === id);
    if (!cur || !before) continue;
    const by = touchedBy('review', id);
    if (by) { keep(`The review “${cur.name}”`, by, 'other'); continue; }
    reviews.push({ ...asBefore(cur, before), version: cur.version });
  }
  const teams = (u.teams ?? []).flatMap(({ id, before }) => (before && full.teams.some((t) => t.id === id) ? [before] : []));
  // A team the import added goes again, once nothing left in the workspace sits in it: its goals and people go back above.
  // Someone the import added who leads a team that stays, stays too; that can keep their own team, so this runs until
  // nothing more changes.
  const goneGoals = new Set(removing.keys());
  let removeTeams: string[] = [];
  for (;;) {
    removeTeams = [...addedTeams].filter((id) => full.teams.some((t) => t.id === id)
      && !full.goals.some((g) => g.teamId === id && !g.removedAt && !goneGoals.has(g.id))
      && !full.people.some((p) => p.teamId === id && !p.removedAt && !p.leftAt && !going.has(p.id)));
    const leads = [...going.values()].filter((p) => full.teams.some((t) => t.leadId === p.id && !removeTeams.includes(t.id) && (teamBefore.get(t.id)?.leadId ?? p.id) === p.id));
    if (!leads.length) break;
    for (const p of leads) {
      going.delete(p.id);
      skipped.push({ name: p.name, reason: `${p.name} leads the team ${full.teams.find((t) => t.leadId === p.id)!.name}`, at: entry!.at, by: p.id });
    }
  }
  for (const p of going.values()) {
    people.push({ ...p, removedAt: x.now, removedBy: x.actor.id });
    changes.push(log(x, { entity: 'person', entityId: p.id, action: 'removed', summary: `Deleted ${p.name}: an import that added them was undone`, importId }));
  }
  for (const id of removeTeams) changes.push(log(x, { entity: 'workspace', entityId: id, action: 'removed', summary: `Removed the team “${full.teams.find((t) => t.id === id)!.name}”: an import that added it was undone`, diffs: [{ field: 'Team', from: full.teams.find((t) => t.id === id)!.name, to: '—' }], importId }));
  // What the import added and Undo removes keeps a team that exists, so restoring it later finds one.
  const home = full.teams.find((t) => !removeTeams.includes(t.id))?.id;
  if (home) for (const list of [goals, people] as { teamId: string | null }[][]) for (const r of list) if (r.teamId && removeTeams.includes(r.teamId)) r.teamId = home;
  for (const { id, before } of u.teams ?? []) if (!before && !removeTeams.includes(id) && full.teams.some((t) => t.id === id)) skipped.push({ name: `The team ${full.teams.find((t) => t.id === id)!.name}`, reason: 'It has goals or people since', at: entry!.at, by: entry!.actorId });
  for (const { id, before } of u.requests) {
    const cur = asksOf(full).find((r) => r.id === id);
    if (!cur) continue;
    const by = touchedBy('request', id);
    if (by) { keep(`An ask on ${full.goals.find((g) => g.id === cur.goalIds[0])?.title ?? 'a goal'}`, by, 'other'); continue; }
    const back = before ?? (cur.status === 'open' ? { ...cur, status: 'withdrawn' as const, updatedAt: x.now } : null);
    if (back) requests.push(back);
  }
  // Every row put back, of every kind; a goal moved up because what it fed was deleted is no row of the import's.
  const restored = goalsBack + checkIns.length + people.length + reviews.length + teams.length + removeTeams.length
    + requests.filter((r) => ownAsks.has(r.id)).length;
  changes.unshift(log(x, {
    entity: 'workspace', entityId: importId, action: 'undone', importId,
    summary: `Undid ${/^Corrected a check-in\b/.test(entry!.summary) ? 'a correction' : entry!.summary.replace(/:.*$/, '').toLowerCase()}: ${plural(restored, 'row', 'rows')} put back${skipped.length ? `, ${skipped.length} skipped as changed since` : ''}`,
    diffs: [{ field: 'Import', from: entry!.summary, to: 'Undone' }, ...(skipped.length ? [{ field: 'Skipped', from: '—', to: skipped.map(keptText).join('; ') }] : [])],
  }));
  return { restored, skipped, commit: { ...(goals.length ? { goals } : {}), ...(checkIns.length ? { checkIns } : {}), ...(people.length ? { people } : {}), ...(requests.length ? { requests } : {}), ...(reviews.length ? { reviews } : {}), ...(teams.length ? { teams } : {}), ...(removeTeams.length ? { removeTeams } : {}), changes } };
}

/** A row Undo leaves as it is, because it changed after the import (rule 9): the row, why, when and by whom. */
export interface KeptRow { name: string; reason: string; at: string; by: string }
/** "Q4 revenue: Rhea Kapoor posted a check-in for week 6 on 12 Nov": a kept row as one line (the log, MCP's text). */
export const keptText = (k: KeptRow) => `${k.name}: ${k.reason}`;

/**
 * Undo an import or bulk edit: whoever made it, or an admin. Every row it wrote is put back as it was: a goal or
 * check-in it added is deleted, one it changed gets its earlier version back, as do people and asks. A row changed by
 * anything since is left alone and listed in `skipped`, with why, when and by whom (rule 9).
 */
export function undoImport(x: ActionContext, importId: string): { commit: Commit; restored: number; skipped: KeptRow[] } {
  const out = undoPlan(x, importId);
  // Nothing to put back: it isn't marked undone, so it says the same tomorrow (MCP's dry run said so first).
  if (!out.restored) no(nothingToUndo(out.skipped.length));
  return out;
}

/** Rule 9: what Undo would do, saving nothing: how many rows go back, and which stay as they are, and why. */
export function undoPreview(x: ActionContext, importId: string): { restores: number; skipped: KeptRow[] } {
  const out = undoPlan(x, importId);
  return { restores: out.restored, skipped: out.skipped };
}

/** The door an import came in by, from its Via mark: a check-in corrected on its own screen carries none (CK1). */
function viaOf(entry: Change): Via {
  const label = entry.diffs.find((d) => d.field === 'Via')?.to;
  const via = (Object.keys(VIA_LABEL) as Via[]).find((k) => VIA_LABEL[k] === label);
  return via ?? (/^Corrected a check-in\b/.test(entry.summary) ? 'form' : 'spreadsheet');
}

/** An import's name, as Past imports and Activity say it (spec 2.7): the file's, or where the bulk change was made. */
export function importName(entry: Change): string {
  const file = entry.diffs.find((d) => d.field === 'File')?.to;
  if (file) return file;
  const via = entry.diffs.find((d) => d.field === 'Via')?.to;
  // A check-in corrected on its own screen carries no Via mark (CK1): its summary says so.
  // Past imports names the goal, the week and the numbers where the entry has them (review of #225, lows).
  if (via === VIA_LABEL.form || (!via && /^Corrected a check-in\b/.test(entry.summary))) return entry.summary.includes(' · ') ? `A corrected check-in: ${entry.summary.replace(/^Corrected a check-in: /, '')}` : 'A corrected check-in';
  if (via === VIA_LABEL.bulk) {
    // Bulk edits are made on Goals, People (emails) and the quick check-in: named by what they wrote.
    const u = entry.undo;
    if (u && !u.goals.length && u.people.length) return 'Bulk edit on People';
    if (u && !u.goals.length && !u.people.length && u.checkIns.length) return 'Quick check-in';
    return 'Bulk edit on Goals';
  }
  return via === VIA_LABEL.table ? 'Bulk edit on Data' : via === VIA_LABEL.mcp ? 'Changes through MCP' : 'A spreadsheet';
}

/** "Nothing to undo: it changed no rows." or "Nothing left to undo: all 3 rows have changed since.": rule 9's line when Undo would put back nothing. */
export function nothingToUndo(skipped: number): string {
  return skipped ? `Nothing left to undo: ${skipped === 1 ? 'its one row has' : `all ${plural(skipped, 'row', 'rows')} have`} changed since.` : 'Nothing to undo: it changed no rows.';
}
/** What an import changed, in words: its summary after the colon ("3 goals changed, 2 check-ins added"). */
export const importCounts = (entry: Change) => entry.summary.replace(/^[^:]*:\s*/, '');

/** An import's (or bulk edit's) line on Past imports (spec 2.7): its summary entry, and when and by whom it was undone. */
export interface PastImport { entry: Change; undone: Change | null }

/** Rule 9: every import, bulk edit and change through MCP in the change log, newest first, each with whether it is undone. */
export function pastImports(changes: readonly Change[]): PastImport[] {
  const undone = new Map(changes.filter((c) => c.action === 'undone' && c.entity === 'workspace').map((c) => [c.entityId, c]));
  return changes.filter((c) => c.action === 'imported' && c.entity === 'workspace').map((entry) => ({ entry, undone: undone.get(entry.entityId) ?? null })).sort((a, b) => (a.entry.at < b.entry.at ? 1 : a.entry.at > b.entry.at ? -1 : 0));
}

/* ---------- recently removed, and restoring ---------- */

/** The core's kinds of removed thing. A feature module's removable record adds its own kind: the record's name (domain/records). */
export type CoreRemovedKind = 'left' | 'person' | 'goal' | 'stopped' | 'check-in' | 'review' | 'ended' | 'comment' | 'note' | 'view' | 'watch' | 'cycle';
export type RemovedKind = CoreRemovedKind | (string & {});
/** How each of the core's kinds is named on Recently removed (a module's record names its own: Removed.label). */
export const REMOVED_LABEL: Record<CoreRemovedKind, string> = {
  left: 'Person who left', person: 'Person', goal: 'Goal', stopped: 'Stopped goal', 'check-in': 'Check-in', review: 'Review', ended: 'Ended review',
  comment: 'Comment', note: 'Review note', view: 'Saved view', watch: 'Watch', cycle: 'Cycle',
};
/** Every kind restore_removed takes: the core's, then each module's removable records. */
export const removedKinds = (records: readonly ModuleRecords[] = []): string[] => [...Object.keys(REMOVED_LABEL), ...records.flatMap((m) => m.records.filter((r) => r.removable && r.removed).map((r) => r.name))];
export interface Removed {
  kind: RemovedKind;
  /** How its kind reads: "Goal", "Check-in", a module's "Metric". */
  label: string;
  id: string;
  /** What it was: a person's or goal's name, a check-in's goal and week, the start of a comment. */
  name: string;
  /** Who removed it, and when. */
  by: string | null;
  at: string;
}

const excerpt = (t: string, n = 60) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);

/** Everything removed, stopped, ended or marked as left in the last 30 days, newest first. After that it drops off this list; the row stays. */
export function recentlyRemoved(full: Snapshot, now: Date, days = RESTORE_DAYS, records: readonly ModuleRecords[] = []): Removed[] {
  const since = Number.isFinite(days) ? new Date(now.getTime() - days * 86_400_000).toISOString() : '';
  const goalTitle = (id: string) => full.goals.find((g) => g.id === id)?.title ?? 'A goal';
  const out: Removed[] = [];
  const add = (kind: RemovedKind, id: string, name: string, by: string | null | undefined, at: string | null | undefined, label = REMOVED_LABEL[kind as CoreRemovedKind]) => { if (at && at >= since) out.push({ kind, label, id, name, by: by ?? null, at }); };
  for (const p of full.people) { if (p.removedAt) add('person', p.id, p.name, p.removedBy, p.removedAt); else if (p.leftAt) add('left', p.id, p.name, p.leftBy, p.leftAt); }
  for (const g of full.goals) { if (g.removedAt) add('goal', g.id, g.title, g.removedBy, g.removedAt); else if (g.stoppedAt) add('stopped', g.id, g.title, g.stoppedBy, g.stoppedAt); }
  for (const c of full.checkIns) if (c.removedAt) add('check-in', c.id, `${goalTitle(c.goalId)}, week ${c.week}`, c.removedBy, c.removedAt);
  for (const r of full.reviews ?? []) { if (r.removedAt) add('review', r.id, r.name, r.removedBy, r.removedAt); else if (r.endedAt) add('ended', r.id, r.name, r.endedBy, r.endedAt); }
  for (const k of commentsOf(full.changes).values()) if (k.removedAt) add('comment', k.id, `${goalTitle(k.goalId)}: “${excerpt(k.text)}”`, k.removedBy, k.removedAt);
  for (const d of full.decisions) if (d.removedAt && d.kind === 'note') add('note', d.id, `${goalTitle(d.goalId)}: “${excerpt(d.note)}”`, d.removedBy, d.removedAt);
  for (const v of full.views ?? []) if (v.deletedAt) add('view', v.id, isTableView(v) ? `${v.name} (a saved layout in Data)` : v.name, v.deletedBy, v.deletedAt);
  for (const w of full.watches ?? []) if (w.removedAt) add('watch', w.id, `${nameIn(full, w.personId)} on ${w.kind === 'level' ? `every ${w.ref} goal` : goalTitle(w.ref)}`, w.removedBy, w.removedAt);
  for (const c of full.cycles) if (c.removedAt) add('cycle', c.id, c.name, c.removedBy, c.removedAt);
  // Each feature module's removable records (domain/records), under the record's own name.
  for (const r of removedModuleRows(full, records)) add(r.kind, r.id, r.name, r.by, r.at, r.label);
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** Who may bring something back, and so who sees it on Recently removed: an admin sees everything, anyone else what they removed (8 Nov). */
export const canRestore = (actor: { id: string; admin?: boolean }, item: Pick<Removed, 'by'>): boolean => !!actor.admin || item.by === actor.id;

/**
 * Bring back something removed: an admin, or whoever removed it. It comes back as it was; whatever was handed over or
 * moved when it went stays where it is now (Undo, straight after removing, puts that back too). A goal whose parent has
 * gone comes back at the top of its tree.
 */
export function restoreRemoved(x: ActionContext, kind: RemovedKind, id: string, records: readonly ModuleRecords[] = []): Commit {
  const full = fullOf(x);
  const item = recentlyRemoved(full, new Date(x.now), Number.POSITIVE_INFINITY, records).find((r) => r.kind === kind && r.id === id);
  if (!item) no('There’s nothing removed with that ID.');
  if (!canRestore(x.actor, item!)) no('Only an admin, or whoever removed it, can restore it.');
  const restored = (entity: Change['entity'], summary: string, goalId: string | null = null, diffs: Change['diffs'] = []) => log(x, { entity, entityId: id, goalId, action: 'restored', summary, diffs });
  const liveParent = (g: Goal) => (g.parentId && full.goals.some((v) => v.id === g.parentId && !v.removedAt && !v.stoppedAt) ? g.parentId : null);
  switch (kind) {
    case 'left': case 'person': {
      const p = full.people.find((v) => v.id === id)!;
      if (x.snapshot.people.some((v) => v.id !== id && v.name.trim().toLowerCase() === p.name.trim().toLowerCase())) no(`Someone called ${p.name} is already here. Rename them first.`);
      return { people: [{ ...p, leftAt: null, leftBy: null, removedAt: null, removedBy: null }], changes: [restored('person', `Restored ${p.name}`, null, [{ field: 'Status', from: kind === 'left' ? LEFT : 'Deleted', to: 'In the workspace' }])] };
    }
    case 'goal': case 'stopped': {
      const g = full.goals.find((v) => v.id === id)!;
      const parentId = liveParent(g);
      const back = { ...g, removedAt: null, removedBy: null, stoppedAt: null, stoppedBy: null, stopReason: null, parentId, ...(parentId ? {} : { effect: null }) } as Goal;
      return { goals: [back], changes: [restored('goal', kind === 'stopped' ? `Restarted ${g.title}` : `Restored ${g.title}`, g.id, [{ field: 'Status', from: kind === 'stopped' ? STOPPED : 'Deleted', to: 'Live' }])] };
    }
    case 'check-in': {
      const c = full.checkIns.find((v) => v.id === id)!;
      return { checkIns: [{ ...c, removedAt: null, removedBy: null }], changes: [restored('check-in', `Restored the check-in for week ${c.week}`, c.goalId)] };
    }
    case 'review': case 'ended': {
      const r = (full.reviews ?? []).find((v) => v.id === id)!;
      const back: Review = { ...r, removedAt: null, removedBy: null, endedAt: null, endedBy: null };
      return { reviews: [back], changes: [restored('review', kind === 'ended' ? `Reopened the review “${r.name}”` : `Restored the review “${r.name}”`)] };
    }
    case 'comment': {
      const k = commentsOf(full.changes).get(id)!;
      return { changes: [restored('note', 'Restored a comment', k.goalId)] };
    }
    case 'note': {
      const d = full.decisions.find((v) => v.id === id)!;
      return { decisions: [{ ...d, removedAt: null, removedBy: null }], changes: [restored('decision', 'Restored a note', d.goalId)] };
    }
    case 'view': {
      const v = (full.views ?? []).find((y) => y.id === id)!;
      return { views: [{ ...v, deletedAt: null, deletedBy: null, updatedAt: x.now }], changes: [restored('view', `Restored the view “${v.name}”`)] };
    }
    case 'watch': {
      const w = (full.watches ?? []).find((y) => y.id === id)!;
      if ((full.watches ?? []).some((y) => y.id !== id && !y.removedAt && y.personId === w.personId && y.kind === w.kind && y.ref === w.ref)) no('They already watch it again.');
      return { watches: [{ ...w, removedAt: null, removedBy: null }], changes: [restored('watch', `Restored ${item!.name}`)] };
    }
    case 'cycle': {
      const c = full.cycles.find((v) => v.id === id)!;
      if (full.cycles.some((v) => v.id !== id && !v.removedAt && v.startDate === c.startDate)) no(`Another cycle starting ${c.startDate} has been set up since, so this one can’t come back.`);
      return { cycles: [{ ...c, removedAt: null, removedBy: null }], changes: [restored('cycle', `Restored the cycle ${c.name}`)] };
    }
    default: {
      // A feature module's record: it says how one comes back (domain/records).
      const found = restorableModuleRow(full, records, kind, id)!;
      return found.restore(x, found.row);
    }
  }
}

/**
 * Undo a removal straight after it (the Undo on its message): every record it changed goes back to how it was just
 * before, the people and asks it handed over and the goals it moved included, and a removed comment comes back. Logged
 * as restored. `before` is the whole workspace as it was just before the removal was saved.
 */
export function undoRemoval(x: ActionContext, removal: Commit, before: Snapshot): Commit {
  const back = <T extends { id: string }>(list: T[] | undefined, from: T[] | undefined): T[] => (list ?? []).flatMap((r) => { const b = (from ?? []).find((v) => v.id === r.id); return b ? [asBefore(r, b)] : []; });
  const out: Commit = {
    people: back(removal.people, before.people),
    goals: back(removal.goals, before.goals),
    checkIns: back(removal.checkIns, before.checkIns),
    decisions: back(removal.decisions, before.decisions),
    reviews: back(removal.reviews, before.reviews),
    requests: back(removal.requests, asksOf(before)),
    watches: back(removal.watches, before.watches),
    views: back(removal.views, before.views),
    cycles: back(removal.cycles, before.cycles),
    teams: back(removal.teams, before.teams),
    changes: [],
  };
  for (const k of Object.keys(out) as (keyof Commit)[]) if (Array.isArray(out[k]) && !(out[k] as unknown[]).length && k !== 'changes') delete out[k];
  // Every feature module's rows the removal changed (domain/records), as they were.
  const modules = moduleRowsBefore(removal.modules, before);
  if (modules) out.modules = modules;
  const main = removal.changes[0];
  for (const c of removal.changes.filter((v) => v.entity === 'note' && v.action === 'removed')) out.changes.push(log(x, { entity: 'note', entityId: c.entityId, goalId: c.goalId, action: 'restored', summary: 'Restored a comment' }));
  if (main && !(main.entity === 'note' && main.action === 'removed')) out.changes.push(log(x, { entity: main.entity, entityId: main.entityId, goalId: main.goalId, action: 'restored', summary: `Undid: ${main.summary.charAt(0).toLowerCase()}${main.summary.slice(1)}` }));
  return out;
}

