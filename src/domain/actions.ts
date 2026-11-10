/* What a person can do in a workspace, and who may do it: each action checks the rules, then returns the records to
   save and the change-log entries. The app (app/state.tsx) and the AI assistants' MCP server (mcp/tools.ts) both call
   these, so a person and their assistant can do the same things, under the same rules. Check-ins, goal edits, plans
   and spreadsheet rows go through the bulk-change engine (domain/changeset.ts) instead. */
import { acceptNote, MIN_ACCEPT_REASON } from './decide';
import { nameProblem } from './thresholds';
import type { Commit } from './commit';
import type { Lookup } from './changes';
import { nextCycle, RESULT_LABEL, wrapUpOpen } from './cycle';
import { personChange, personProblems } from './people';
import { stagesDoneAtSetUp } from './goal';
import { checkInChange } from './changes';
import { answerAsk, asksOf, canAnswer, canMarkDone, canWithdraw, editAsk, linkRequest as linked, markDone, openUpdateAsk, raiseAsk, UPDATE_ASK, updateAskText, withdrawAsk } from './asks';
import { sessionWeek } from './review';
import { checkInsFor } from './status';
import { clampWidth, isTableView, layoutParams, layoutProblems, parseLayout, type TableLayout } from './tableLayout';
import type { ApiToken, Ask, Cycle, Decision, Goal, Level, Person, Retro, Review, SavedView, Snapshot, Watch } from './types';

export interface ActionContext {
  /** The open workspace, scoped to the current cycle (views, tokens and feedback are the workspace's). */
  snapshot: Snapshot;
  cycle: Cycle;
  week: number;
  /** Who is acting: the person using the app, or the person an assistant's token belongs to. */
  actor: Person;
  /** Now, as an ISO timestamp. */
  now: string;
  newId: (prefix: string) => string;
  /** Every goal in the workspace, in every cycle: for the rules that reach past this cycle (removing a team). */
  allGoals?: Goal[];
  /** The whole workspace, unscoped: every cycle and every removed record, for restoring (domain/removal). */
  full?: Snapshot;
}

/** A rule says no: the message says why, in words the person (or their assistant) can act on. */
export class NotAllowed extends Error {}
const no = (msg: string): never => { throw new NotAllowed(msg); };

const lookupOf = (s: Snapshot): Lookup => ({
  person: (id) => s.people.find((p) => p.id === id),
  goal: (id) => s.goals.find((g) => g.id === id),
  teamName: (id) => s.teams.find((t) => t.id === id)?.name ?? id,
});
const ownsOrAdmin = (x: ActionContext, g: Goal) => x.actor.admin || g.ownerId === x.actor.id;
const latestOf = (x: ActionContext, g: Goal) => checkInsFor(g, x.snapshot.checkIns).at(-1) ?? null;

/* ---------- Comments ---------- */

/** A logged comment on a goal. Anyone can comment; it doesn't change the status, and it isn't an ask: it asks nothing of anyone. */
export function addNote(x: ActionContext, goal: Goal, text: string): Commit {
  const t = text.trim();
  if (t.length < 2) no('Write the comment.');
  return { changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: goal.id, entity: 'note', entityId: x.newId('note'), action: 'noted', summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: t }] }] };
}

/* ---------- Asks: one way to ask (asks.ts has the rules) ---------- */

const askById = (x: ActionContext, id: string) => asksOf(x.snapshot).find((r) => r.id === id);
const nameOf = (x: ActionContext, id: string | null | undefined) => x.snapshot.people.find((p) => p.id === id)?.name;

/** Ask a goal's owner for an update: open on their Home until they check in (or answer it), or it's withdrawn. Null when it's already asked. */
export function askForUpdate(x: ActionContext, goal: Goal): Commit | null {
  if (goal.ownerId === x.actor.id) no('It’s your own goal: post a check-in instead.');
  if (openUpdateAsk(goal.id, x.snapshot)) return null;
  const latest = latestOf(x, goal);
  const { ask, change } = raiseAsk({ kind: 'update', goalIds: [goal.id], askedBy: x.actor.id, recipientId: goal.ownerId, ask: updateAskText(nameOf(x, goal.ownerId)?.split(' ')[0], latest?.week ?? null), summary: UPDATE_ASK }, x.now, x.newId);
  return { requests: [ask], changes: [change] };
}

/** Take back an ask for an update: whoever asked, or an admin. Null when there's no open ask. */
export function undoUpdateAsk(x: ActionContext, goal: Goal): Commit | null {
  const ask = openUpdateAsk(goal.id, x.snapshot);
  if (!ask) return null;
  if (ask.askedBy !== x.actor.id && !x.actor.admin) no('Only whoever asked, or an admin, can undo the ask.');
  const w = withdrawAsk(ask, goal.id, x.actor.id, x.now, x.newId);
  return { requests: [w.request], changes: w.changes };
}

/** Ask a goal's owner a question, outside a review (a review's questions come through reviewCall). Open until they answer it. */
export function askQuestion(x: ActionContext, goal: Goal, text: string, opts: { reviewId?: string | null; week?: number | null } = {}): Commit {
  const t = text.trim();
  if (t.length < 2) no('Write the question.');
  if (goal.ownerId === x.actor.id) no('It’s your own goal: there’s no one to ask. Comment instead.');
  const review = opts.reviewId ? x.snapshot.reviews.find((r) => r.id === opts.reviewId) : undefined;
  const { ask, change } = raiseAsk({ kind: 'question', goalIds: [goal.id], askedBy: x.actor.id, recipientId: goal.ownerId, ask: t, reviewId: review?.id ?? null, week: opts.week ?? null, summary: review ? `Asked the owner a question in ${review.name}` : `Asked ${nameOf(x, goal.ownerId) ?? 'the owner'} a question` }, x.now, x.newId);
  return { requests: [ask], changes: [change] };
}

/** Agree an action on a goal: someone (the owner, unless named) does it, by a week if one is given. */
export function addAction(x: ActionContext, goal: Goal, text: string, opts: { assigneeId?: string | null; dueWeek?: number | null; reviewId?: string | null; week?: number | null } = {}): Commit {
  const t = text.trim();
  if (t.length < 2) no('Write the action.');
  const who = opts.assigneeId ?? goal.ownerId;
  if (!x.snapshot.people.some((p) => p.id === who)) no('The person for the action isn’t in this workspace.');
  if (opts.dueWeek != null && !(opts.dueWeek >= 1 && opts.dueWeek <= x.cycle.weeks)) no(`The due week is between 1 and ${x.cycle.weeks}.`);
  const review = opts.reviewId ? x.snapshot.reviews.find((r) => r.id === opts.reviewId) : undefined;
  const { ask, change } = raiseAsk({ kind: 'action', goalIds: [goal.id], askedBy: x.actor.id, recipientId: who, ask: t, dueWeek: opts.dueWeek ?? null, reviewId: review?.id ?? null, week: opts.week ?? null, summary: review ? `Agreed an action in ${review.name}` : 'Agreed an action' }, x.now, x.newId);
  change.diffs.splice(1, 0, { field: 'Who', from: '—', to: nameOf(x, who) ?? '—' });
  return { requests: [ask], changes: [change] };
}

/** Answer a decision or help, an ask for an update or a question: the person asked, or an admin (anyone, for an ask to no one in particular). */
export function answerRequest(x: ActionContext, r: Ask, answer: string): Commit {
  if (r.status !== 'open') no('That ask isn’t open any more.');
  if (r.kind === 'action') no('An action is marked done, not answered.');
  if (!canAnswer(r, x.actor)) no(`Only ${nameOf(x, r.recipientId) ?? 'the person asked'} or an admin can answer it.`);
  if (answer.trim().length < 2) no('Write the answer.');
  const { request, changes } = answerAsk(r, answer, x.actor.id, x.now, x.newId);
  return { requests: [request], changes };
}

/** Mark an action done, with an optional note: whoever does it, whoever asked for it, or an admin. */
export function markActionDone(x: ActionContext, r: Ask, note = ''): Commit {
  if (r.status !== 'open') no('That action isn’t open any more.');
  if (r.kind !== 'action') no('Only an action is marked done; answer the others.');
  if (!canMarkDone(r, x.actor)) no(`Only ${nameOf(x, r.recipientId) ?? 'whoever does it'}, whoever asked for it, or an admin can mark it done.`);
  const { request, changes } = markDone(r, note, x.actor.id, x.now, x.newId);
  return { requests: [request], changes };
}

/** A goal's owner (or an admin) says the goal waits on a decision or help raised for another goal. */
export function linkRequest(x: ActionContext, r: Ask, goal: Goal): Commit {
  if (r.status !== 'open') no('That request isn’t open any more.');
  if (r.kind !== 'decision') no('Only a decision or help can be shared by several goals.');
  if (!ownsOrAdmin(x, goal)) no('Only the goal’s owner or an admin can link it to a request.');
  if (r.goalIds.includes(goal.id)) no('That goal is already waiting on this request.');
  const { requests, changes } = linked(r, goal, x.snapshot, x.actor.id, x.now, x.newId);
  return { requests, changes };
}

/**
 * Withdraw an ask: whoever asked, or an admin; for a decision or help, also the owner of the goal it was raised on. On a
 * goal linked to someone else's decision or help, its owner stops waiting on it (the ask stays open for the others).
 */
export function withdrawRequest(x: ActionContext, r: Ask, goal?: Goal): Commit {
  if (r.status !== 'open') no('That ask isn’t open any more.');
  const g = goal ?? x.snapshot.goals.find((v) => v.id === r.goalIds[0]);
  if (!g || !r.goalIds.includes(g.id)) no('That goal isn’t waiting on this ask.');
  if (!canWithdraw(r, x.actor, g)) no(r.kind === 'decision' ? 'Only the goal’s owner, whoever asked, or an admin can withdraw it.' : 'Only whoever asked, or an admin, can withdraw it.');
  const { request, changes } = withdrawAsk(r, g!.id, x.actor.id, x.now, x.newId);
  return { requests: [request], changes };
}

/** The ask with this id, for the tools that take one. */
export const findAsk = (x: ActionContext, id: string) => askById(x, id);

/* ---------- Reviews ---------- */

export type CallKind = 'acknowledge' | 'note' | 'ask' | 'action';

/**
 * What someone says about a goal in a review: seen, a note, a question for the owner, or an action. Seen and a note are
 * the review's record (decisions); a question and an action are asks, raised in the review's session, so they're open
 * until answered or done like any other ask.
 */
export function reviewCall(x: ActionContext, goal: Goal, review: Review, kind: CallKind, note: string, extra: { week?: number; assigneeId?: string | null; dueWeek?: number | null } = {}): Commit {
  const text = note.trim();
  const week = extra.week ?? sessionWeek(review, x.week, x.cycle);
  if (kind === 'ask') {
    if (goal.ownerId === x.actor.id) no('It’s your own goal: add a note instead.');
    return askQuestion(x, goal, text, { reviewId: review.id, week });
  }
  if (kind === 'action') return addAction(x, goal, text, { assigneeId: extra.assigneeId, dueWeek: extra.dueWeek, reviewId: review.id, week });
  if (kind === 'note' && text.length < 2) no('Write the note.');
  const d: Decision = { id: x.newId('dec'), goalId: goal.id, checkInId: null, reviewId: review.id, week, kind, byId: x.actor.id, at: x.now, note: text };
  return {
    decisions: [d],
    changes: [{ id: x.newId('chg'), at: d.at, actorId: x.actor.id, goalId: goal.id, entity: 'decision', entityId: d.id, action: kind === 'note' ? 'noted' : 'acknowledged', summary: `${kind === 'note' ? 'Added a note' : 'Looked at it'} in ${review.name}`, diffs: text ? [{ field: 'Note', from: '—', to: text }] : [] }],
  };
}

/**
 * The review accepts the risk on a goal behind (deep review P2): no action for now, with a reason, said in the session
 * as a note whose words start "We accept the risk:" (decide.ts reads it back). Anyone in the review.
 */
export function acceptRisk(x: ActionContext, goal: Goal, review: Review, reason: string, week: number): Commit {
  if (reason.trim().length < MIN_ACCEPT_REASON) no('Say why the review accepts the risk.');
  return reviewCall(x, goal, review, 'note', acceptNote(reason), { week });
}

/**
 * Mark several goals reviewed in one go: the goals with nothing flagged, together (deep review T3). One "reviewed" per
 * goal, as if each were marked on its own, saved at once so Undo (removal.unmarkReviewed) takes them all back.
 */
export function markReviewed(x: ActionContext, goals: Goal[], review: Review, week: number): Commit {
  if (!goals.length) no('There’s nothing left to mark reviewed.');
  const out: Commit = { decisions: [], changes: [] };
  for (const g of goals) {
    const c = reviewCall(x, g, review, 'acknowledge', '', { week });
    out.decisions!.push(...(c.decisions ?? []));
    out.changes.push(...c.changes);
  }
  return out;
}

/**
 * Correct a note, question or action said in a review (or any ask's words): whoever said it, or an admin. An answered or
 * done ask stays as it was answered. Null when nothing changed.
 */
export function editCall(x: ActionContext, d: Decision | Ask, note: string, extra?: { assigneeId?: string | null; dueWeek?: number | null }): Commit | null {
  const ask = 'goalIds' in d ? d : askById(x, d.id);
  if (ask) {
    if (ask.askedBy !== x.actor.id && !x.actor.admin) no('Only whoever asked, or an admin, can correct it.');
    if (ask.status !== 'open') no('It’s been answered or closed: comment instead.');
    if (note.trim().length < 2) no('Write the new wording.');
    if (extra?.assigneeId && !x.snapshot.people.some((p) => p.id === extra.assigneeId)) no('The person for the action isn’t in this workspace.');
    const out = editAsk(ask, { ask: note, ...(ask.kind === 'action' && extra ? { recipientId: extra.assigneeId ?? ask.recipientId, dueWeek: extra.dueWeek ?? null } : {}) }, x.snapshot.people, x.actor.id, x.now, x.newId);
    return out && { requests: [out.request], changes: out.changes };
  }
  const dec = d as Decision;
  if (dec.byId !== x.actor.id && !x.actor.admin) no('Only whoever said it, or an admin, can correct it.');
  if (dec.kind !== 'acknowledge' && note.trim().length < 2) no('Write the new wording.');
  const after: Decision = { ...dec, note: note.trim(), editedAt: x.now };
  if (after.note === dec.note) return null;
  return { decisions: [after], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: dec.goalId, entity: 'decision', entityId: dec.id, action: 'edited', summary: 'Corrected a note', diffs: [{ field: 'Note', from: dec.note, to: after.note }] }] };
}

/** Set up a review (anyone), or change one (someone in it, whoever set it up, or an admin). */
export function saveReview(x: ActionContext, review: Review, before: Review | null): Commit {
  if (!review.name.trim()) no('Give the review a name.');
  if (!(review.everyWeeks >= 1 && review.everyWeeks <= 13)) no('Hold it every 1 to 13 weeks.');
  if (!(review.weekday >= 0 && review.weekday <= 4)) no('Pick a weekday, Monday to Friday.');
  if (!review.scope.goals.length && !review.scope.trees.length && !review.scope.levels.length) no('Pick the goals it walks: goals, a goal and what feeds it, or a level.');
  const ids = new Set(x.snapshot.goals.map((g) => g.id));
  if ([...review.scope.goals, ...review.scope.trees].some((g) => !ids.has(g))) no('One of the goals isn’t in this cycle.');
  if (review.people.some((p) => !x.snapshot.people.some((q) => q.id === p))) no('One of the people isn’t in this workspace.');
  if (before && !x.actor.admin && !before.people.includes(x.actor.id) && before.createdBy !== x.actor.id) no('Only someone in the review, whoever set it up, or an admin can change it.');
  const diffs = before ? [
    ...(before.name !== review.name ? [{ field: 'Name', from: before.name, to: review.name }] : []),
    ...(before.everyWeeks !== review.everyWeeks || before.weekday !== review.weekday ? [{ field: 'When', from: `every ${before.everyWeeks} wk`, to: `every ${review.everyWeeks} wk` }] : []),
    ...(JSON.stringify(before.scope) !== JSON.stringify(review.scope) ? [{ field: 'Goals', from: 'changed', to: 'changed' }] : []),
    ...(JSON.stringify(before.people) !== JSON.stringify(review.people) ? [{ field: 'People', from: String(before.people.length), to: String(review.people.length) }] : []),
  ] : [{ field: 'Review', from: '—', to: review.name }];
  return { reviews: [review], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'review', entityId: review.id, action: before ? 'edited' : 'created', summary: before ? `Changed the review “${review.name}”` : `Set up a review: “${review.name}”`, diffs }] };
}

/** A new review's record, from what the person chose. */
export function newReview(x: ActionContext, v: { name: string; everyWeeks: number; weekday: number; goals?: string[]; trees?: string[]; levels?: Level[]; people?: string[] }): Review {
  return { id: x.newId('rev'), name: v.name.trim(), everyWeeks: v.everyWeeks, weekday: v.weekday, scope: { goals: v.goals ?? [], trees: v.trees ?? [], levels: v.levels ?? [] }, people: v.people?.length ? v.people : [x.actor.id], createdBy: x.actor.id, createdAt: x.now };
}

/* ---------- Watching ---------- */

/** Watch a goal, a goal and everything feeding it, or a whole level. Null when already watched. Watching again what
    you stopped watching brings the same watch back (one watch per person and thing). */
export function watch(x: ActionContext, kind: Watch['kind'], ref: string): Commit | null {
  if (kind === 'level' ? !['north-star', 'svp', 'team'].includes(ref) : !x.snapshot.goals.some((g) => g.id === ref)) no(kind === 'level' ? 'Levels are north-star, svp and team.' : 'There’s no goal with that ID in this cycle.');
  if (x.snapshot.watches.some((w) => w.personId === x.actor.id && w.kind === kind && w.ref === ref)) return null;
  const old = (x.full?.watches ?? []).find((w) => w.personId === x.actor.id && w.kind === kind && w.ref === ref && w.removedAt);
  return { watches: [old ? { ...old, removedAt: null, removedBy: null } : { id: x.newId('w'), personId: x.actor.id, kind, ref }], changes: [] };
}

/** What a watch is on, in words: a goal's name, "Billing and what feeds it", or "every north star goal". */
const watchWhat = (x: ActionContext, w: Watch) => {
  const title = (x.full ?? x.snapshot).goals.find((g) => g.id === w.ref)?.title ?? 'a goal';
  return w.kind === 'level' ? `every ${w.ref.replace('-', ' ')} goal` : w.kind === 'tree' ? `${title} and what feeds it` : title;
};

/** Stop watching: your own watches only. Kept, and logged, so it can be undone. */
export function unwatch(x: ActionContext, watchId: string): Commit {
  const w = x.snapshot.watches.find((v) => v.id === watchId);
  if (!w) no('There’s no watch with that ID.');
  if (w!.personId !== x.actor.id) no('That’s someone else’s watch.');
  return { watches: [{ ...w!, removedAt: x.now, removedBy: x.actor.id }], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'watch', entityId: w!.id, action: 'removed', summary: `Stopped watching ${watchWhat(x, w!)}`, diffs: [{ field: 'Watching', from: watchWhat(x, w!), to: '—' }] }] };
}

/* ---------- People ---------- */

/** Admins: add someone, or change their name, job title, team or admin rights. Null when nothing changed. */
export function savePerson(x: ActionContext, p: Person, before: Person | null): Commit | null {
  if (!x.actor.admin) no('Only admins can add people or change them.');
  if (p.teamId && !x.snapshot.teams.some((t) => t.id === p.teamId)) no('There’s no team with that ID.');
  const problems = personProblems(p, x.snapshot.people, before);
  if (problems.length) no(problems.join(' '));
  const ch = personChange(before, p, lookupOf(x.snapshot).teamName, x.actor.id, x.now, x.newId('chg'));
  if (before && !ch) return null;
  return { people: [p], changes: ch ? [ch] : [] };
}

/** Initials from a name: the first letters of the first and last words. */
export const initialsOf = (name: string) => { const w = name.trim().split(/\s+/); return ((w[0]?.[0] ?? '') + (w.length > 1 ? w[w.length - 1]![0] : '')).toUpperCase(); };

/* ---------- The end of a cycle ---------- */

/** What was learned is at least a sentence. */
export const MIN_LEARNED = 10;

/** An owner's (or an admin's) wrap-up of a goal, in the last two weeks of the cycle. */
export function saveRetro(x: ActionContext, goal: Goal, v: { result: Retro['result']; learned: string; next: Retro['next'] }): Commit {
  if (!ownsOrAdmin(x, goal)) no('Only the goal’s owner or an admin can wrap it up.');
  if (!wrapUpOpen(x.cycle, x.week)) no(`Wrap-ups open in the last two weeks of the cycle (from week ${x.cycle.weeks - 1}).`);
  if (v.learned.trim().length < MIN_LEARNED) no('Say what was learned, in a sentence (10 characters or more).');
  const before = (x.snapshot.retros ?? []).find((r) => r.goalId === goal.id && r.cycleId === x.cycle.id) ?? null;
  const retro: Retro = { id: before?.id ?? x.newId('retro'), goalId: goal.id, cycleId: x.cycle.id, result: v.result, learned: v.learned.trim(), next: v.next, byId: x.actor.id, at: x.now };
  const diffs = [
    ...(!before || before.result !== retro.result ? [{ field: 'Result', from: before ? RESULT_LABEL[before.result] : '—', to: RESULT_LABEL[retro.result] }] : []),
    ...(!before || before.learned !== retro.learned ? [{ field: 'Learned', from: before?.learned ?? '—', to: retro.learned }] : []),
    ...(!before || before.next !== retro.next ? [{ field: 'Next cycle', from: before ? (before.next === 'carry' ? 'Carry on' : 'Stop') : '—', to: retro.next === 'carry' ? 'Carry on' : 'Stop' }] : []),
  ];
  return { retros: [retro], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: goal.id, entity: 'retro', entityId: retro.id, action: before ? 'edited' : 'posted', summary: `Wrapped up ${goal.title}: ${RESULT_LABEL[retro.result].toLowerCase()}`, diffs }] };
}

/** Admins: start the next cycle with the goals that carry on. */
export function startNextCycle(x: ActionContext): { commit: Commit; name: string } {
  if (!x.actor.admin) no('Only admins can start the next cycle.');
  if (!wrapUpOpen(x.cycle, x.week)) no(`The next cycle can start in the last two weeks of this one (from week ${x.cycle.weeks - 1}).`);
  const next = nextCycle(x.cycle, x.snapshot.goals, x.snapshot.checkIns, x.snapshot.retros ?? [], { cycle: x.newId('cycle'), goal: () => x.newId('goal') }, x.now);
  const stopped = x.snapshot.goals.length - next.goals.length;
  return {
    name: next.cycle.name,
    commit: { cycles: [next.cycle], goals: next.goals, changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'cycle', entityId: next.cycle.id, action: 'created', summary: `Started ${next.cycle.name}: ${next.goals.length} ${next.goals.length === 1 ? 'goal carries' : 'goals carry'} on${stopped ? `, ${stopped} stopped` : ''}`, diffs: [{ field: 'Cycle', from: x.cycle.name, to: next.cycle.name }] }] },
  };
}

/* ---------- Saved views ---------- */

const liveView = (x: ActionContext, id: string) => (x.snapshot.views ?? []).find((v) => v.id === id && !v.deletedAt);

/** Save a view of the goals: a new one, or one of yours (an admin: any) renamed or changed. */
export function saveView(x: ActionContext, v: { id?: string; name: string; params: string }): { commit: Commit; id: string } {
  const clean = v.name.trim().slice(0, 80);
  if (!clean) no('Give the view a name.');
  const old = v.id ? liveView(x, v.id) : undefined;
  if (v.id && !old) no('There’s no view with that ID.');
  // A view of a data table stays one, and a view of the Goals screen stays one.
  if (isTableView(v)) { const problems = layoutProblems(parseLayout(v.params)); if (problems.length) no(problems.join(' ')); }
  if (old && isTableView(old) !== isTableView(v)) no(isTableView(old) ? 'That view is of a data table; save a table layout to it.' : 'That view is of the Goals screen, not a data table.');
  if (old && old.personId !== x.actor.id && !x.actor.admin) no('Only its owner or an admin can change this view.');
  const view: SavedView = old ? { ...old, name: clean, params: v.params, updatedAt: x.now } : { id: x.newId('view'), personId: x.actor.id, name: clean, params: v.params, pinned: false, createdAt: x.now, updatedAt: x.now, deletedAt: null };
  // A personal view changes no goal, so it isn't logged; a pinned one changes what everyone sees, so it is.
  return { id: view.id, commit: { views: [view], changes: old?.pinned ? [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'workspace', entityId: view.id, action: 'edited', summary: `Changed the pinned view “${clean}”`, diffs: [{ field: 'Pinned view', from: old.name, to: clean }] }] : [] } };
}

/**
 * Save the layout of a data table (its columns in order, their widths, and its search, filters and sort) as a named
 * table view, or change one of yours. Given the table's columns, a column it doesn't have is refused. It's a saved view
 * like any other: yours, an admin can pin it for everyone, and it's deleted the same way.
 */
export function saveTableView(x: ActionContext, v: { id?: string; name: string; layout: TableLayout }, head?: readonly string[]): { commit: Commit; id: string } {
  const problems = layoutProblems(v.layout, head);
  if (problems.length) no(problems.join(' '));
  if (v.layout.cols && !v.layout.cols.length) no('Show at least one column.');
  const widths = Object.fromEntries(Object.entries(v.layout.widths).map(([c, w]) => [c, clampWidth(v.layout.table, c, w)]));
  return saveView(x, { id: v.id, name: v.name, params: layoutParams({ ...v.layout, widths }) });
}

/** Delete one of your views; an admin can delete anyone's (pinned or not). Kept, and logged, so it can be undone. Null when it's already gone. */
export function deleteView(x: ActionContext, id: string): Commit | null {
  const v = liveView(x, id);
  if (!v) return null;
  if (v.personId !== x.actor.id && !x.actor.admin) no('Only its owner, or an admin, can delete this view.');
  // A data table's is a saved layout; a Goals one is a view (docs/glossary.md).
  const what = isTableView(v) ? 'saved layout' : v.pinned ? 'pinned view' : 'view';
  return { views: [{ ...v, deletedAt: x.now, deletedBy: x.actor.id, updatedAt: x.now }], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'view', entityId: v.id, action: 'removed', summary: v.pinned && !isTableView(v) ? `Removed the pinned view “${v.name}”` : `Deleted the ${what} “${v.name}”`, diffs: [{ field: what.charAt(0).toUpperCase() + what.slice(1), from: v.name, to: '—' }] }] };
}

/** Admins: show a view to everyone in the workspace, or stop. Null when it already is. */
export function pinView(x: ActionContext, id: string, pinned: boolean): Commit | null {
  if (!x.actor.admin) no('Only admins can pin a view for everyone.');
  const v = liveView(x, id);
  if (!v) no('There’s no view with that ID.');
  if (v!.pinned === pinned) return null;
  return { views: [{ ...v!, pinned, updatedAt: x.now }], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'workspace', entityId: v!.id, action: 'edited', summary: pinned ? `Pinned the view “${v!.name}” for everyone` : `Unpinned the view “${v!.name}”`, diffs: [{ field: 'Pinned view', from: pinned ? '—' : v!.name, to: pinned ? v!.name : '—' }] }] };
}

/* ---------- AI assistant tokens ---------- */

/** Admins: a personal token for an assistant to act as someone. The store makes the secret and keeps only its hash
    (Store.issueToken): in the shared database, the database does. */
export function createToken(x: ActionContext, personId: string, name: string): Commit {
  if (!x.actor.admin) no('Only admins can make tokens.');
  const who = x.snapshot.people.find((p) => p.id === personId);
  if (!who) no('There’s no one with that ID in this workspace.');
  if (!name.trim()) no('Say what the token is for, e.g. “Claude on my laptop”.');
  if (name.trim().length > 120) no('Keep what it’s for to 120 characters.');
  const t: ApiToken = { id: x.newId('tok'), personId, name: name.trim(), createdBy: x.actor.id, createdAt: x.now, lastUsedAt: null, revokedAt: null };
  return { tokens: [t], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'person', entityId: personId, action: 'created', summary: `Gave ${who!.name} an MCP token: “${t.name}”`, diffs: [{ field: 'MCP token', from: '—', to: t.name }] }] };
}

/** Stop a token working: an admin, or the token's person. Null when it's already revoked. */
export function revokeToken(x: ActionContext, id: string): Commit | null {
  const t = (x.snapshot.tokens ?? []).find((v) => v.id === id);
  if (!t) no('There’s no token with that ID.');
  if (t!.revokedAt) return null;
  if (!x.actor.admin && t!.personId !== x.actor.id) no('Only an admin or the token’s person can revoke it.');
  return { tokens: [{ ...t!, revokedAt: x.now }], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'person', entityId: t!.personId, action: 'edited', summary: `Revoked the MCP token “${t!.name}”`, diffs: [{ field: 'MCP token', from: t!.name, to: 'Revoked' }] }] };
}

/* ---------- Feedback about the app ---------- */

export function sendFeedback(x: ActionContext, mood: 'good' | 'meh' | 'bad', text: string, path: string): Commit {
  if (!['good', 'meh', 'bad'].includes(mood)) no('Mood is good, meh or bad.');
  return { feedback: [{ id: x.newId('fb'), personId: x.actor.id, path, mood, text: text.trim(), at: x.now }], changes: [] };
}

/* ---------- The workspace and its teams ---------- */

/** Admins: give the workspace a new name. Null when it already has that name. */
export function renameWorkspace(x: ActionContext, ws: { id: string; name: string }, name: string): Commit | null {
  if (!x.actor.admin) no('Only admins can rename the workspace.');
  const clean = name.trim().replace(/\s+/g, ' ');
  const named = nameProblem(clean, 'workspace');
  if (named) no(named);
  if (clean === ws.name) return null;
  return { workspace: { name: clean }, changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'workspace', entityId: ws.id, action: 'edited', summary: `Renamed the workspace to “${clean}”`, diffs: [{ field: 'Workspace name', from: ws.name, to: clean }] }] };
}

/**
 * Admins: turn on or off recording of how the app is used in this workspace (src/telemetry; what it records is in the
 * guide's "What the app records"). Off, nothing is recorded or sent for the workspace. Null when it already is.
 */
export function setRecording(x: ActionContext, ws: { id: string; recording?: boolean }, on: boolean): Commit | null {
  if (!x.actor.admin) no('Only admins can turn recording on or off.');
  if (typeof on !== 'boolean') no('Say whether to record: on or off.');
  const was = ws.recording !== false;
  if (was === on) return null;
  return { recording: on, changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'workspace', entityId: ws.id, action: 'edited', summary: on ? 'Turned recording back on' : 'Turned recording off', diffs: [{ field: 'Recording', from: was ? 'On' : 'Off', to: on ? 'On' : 'Off' }] }] };
}

/**
 * Admins: switch a feature module on or off in this workspace (docs/architecture.md). `modules` is every module this
 * build has, so a module that needs this one can be named in the log as going off with it. Null when it already is.
 */
export function setModule(x: ActionContext, ws: { id: string; modulesOff?: string[] }, modules: readonly { id: string; name: string; needs: string[] }[], id: string, on: boolean): Commit | null {
  if (!x.actor.admin) no('Only admins can switch features on or off.');
  const m = modules.find((k) => k.id === id);
  if (!m) no(`There’s no feature called ${id}.`);
  const was = ws.modulesOff ?? [];
  if (was.includes(id) === !on) return null;
  const off = on ? was.filter((k) => k !== id) : [...was, id].sort();
  // What needs it goes off with it (and comes back with it), however deep: said in the log, so nobody wonders why.
  const needing = (root: string): string[] => modules.filter((k) => k.needs.includes(root)).flatMap((k) => [k.name, ...needing(k.id)]);
  const also = [...new Set(needing(id))];
  const name = m!.name;
  return {
    modulesOff: off,
    changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'workspace', entityId: ws.id, action: 'edited',
      summary: `${on ? 'Switched on' : 'Switched off'} ${name}${also.length ? `, and with it ${also.join(', ')}` : ''}`,
      diffs: [{ field: name, from: on ? 'Off' : 'On', to: on ? 'On' : 'Off' }] }],
  };
}

/** Admins: add a team, or rename one or change its lead. Null commit when nothing changed. */
export function saveTeam(x: ActionContext, t: { id?: string; name: string; leadId?: string | null; objective?: string }): { commit: Commit | null; id: string } {
  if (!x.actor.admin) no('Only admins can add or change teams.');
  const clean = t.name.trim().replace(/\s+/g, ' ');
  if (!clean) no('Give the team a name.');
  if (clean.length > 60) no('Keep the team’s name to 60 characters or fewer.');
  const before = t.id ? x.snapshot.teams.find((v) => v.id === t.id) : undefined;
  if (t.id && !before) no('There’s no team with that ID.');
  const same = x.snapshot.teams.find((v) => v.id !== before?.id && v.name.trim().toLowerCase() === clean.toLowerCase());
  if (same) no(`There’s already a team called ${same.name}.`);
  const leadId = t.leadId === undefined ? before?.leadId ?? '' : t.leadId ?? '';
  if (leadId && !x.snapshot.people.some((p) => p.id === leadId)) no('The team lead isn’t in this workspace.');
  // What the team is here to do (People's team page, WR1): optional, one or two sentences.
  const objective = t.objective === undefined ? before?.objective ?? '' : t.objective.trim().replace(/\s+/g, ' ');
  if (objective.length > 280) no('Keep what the team is here to do to 280 characters or fewer.');
  const team = { id: before?.id ?? x.newId('team'), name: clean, leadId, objective };
  const name = (id: string) => x.snapshot.people.find((p) => p.id === id)?.name ?? '—';
  const diffs = before
    ? [...(before.name !== team.name ? [{ field: 'Team name', from: before.name, to: team.name }] : []), ...((before.leadId || '') !== leadId ? [{ field: 'Team lead', from: name(before.leadId), to: name(leadId) }] : []), ...((before.objective || '') !== objective ? [{ field: 'What it is here to do', from: before.objective || '—', to: objective || '—' }] : [])]
    : [{ field: 'Team', from: '—', to: team.name }];
  if (before && !diffs.length) return { commit: null, id: team.id };
  return { id: team.id, commit: { teams: [team], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'workspace', entityId: team.id, action: before ? 'edited' : 'created', summary: before ? (before.name !== team.name ? `Renamed the team “${before.name}” to “${team.name}”` : `Changed the team “${team.name}”`) : `Added the team “${team.name}”`, diffs }] } };
}

/**
 * What still belongs to a team: its people; its goals in every cycle, not counting removed ones (`goals`); the goals the
 * Board shows for it now, this cycle's that are neither removed nor stopped (`current`, what its card counts); and every goal
 * that names it, removed ones too (`named`, what moves when the team is removed, so nothing points at a team that's gone).
 */
export function teamMembers(x: Pick<ActionContext, 'snapshot' | 'allGoals'>, teamId: string) {
  const named = (x.allGoals ?? x.snapshot.goals).filter((g) => g.teamId === teamId);
  return {
    people: x.snapshot.people.filter((p) => p.teamId === teamId),
    goals: named.filter((g) => !g.removedAt),
    current: x.snapshot.goals.filter((g) => g.teamId === teamId && !g.removedAt && !g.stoppedAt),
    named,
  };
}

/** A team's people as the directory counts them: everyone in it, and its lead wherever their own team is (backlog WS). */
export function teamPeople(x: Pick<ActionContext, 'snapshot'>, teamId: string) {
  const lead = x.snapshot.teams.find((t) => t.id === teamId)?.leadId;
  return x.snapshot.people.filter((p) => p.teamId === teamId || p.id === lead);
}

/** Admins: remove a team. One with people or goals is emptied first: give `moveTo`, another team, and they move there. */
export function removeTeam(x: ActionContext, id: string, moveTo?: string | null): Commit {
  if (!x.actor.admin) no('Only admins can remove teams.');
  const team = x.snapshot.teams.find((t) => t.id === id);
  if (!team) no('There’s no team with that ID.');
  const { people, goals, named } = teamMembers(x, id);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const what = [people.length ? plural(people.length, 'person', 'people') : '', goals.length ? plural(goals.length, 'goal', 'goals') : ''].filter(Boolean).join(' and ');
  const to = moveTo ? x.snapshot.teams.find((t) => t.id === moveTo) : undefined;
  if (moveTo && (!to || moveTo === id)) no('Move them to another team that’s in this workspace.');
  if (what && !to) no(`${team!.name} still has ${what}. Move them to another team first.`);
  const movedPeople = people.map((p) => ({ ...p, teamId: to!.id }));
  // Removed goals move too, quietly (to the team chosen, or else the first other team): they aren't counted or logged, but
  // one restored later still belongs to a team that exists.
  const home = to ?? x.snapshot.teams.find((t) => t.id !== id);
  const movedGoals = [...goals.map((g) => ({ ...g, teamId: to!.id })), ...(home ? named.filter((g) => g.removedAt).map((g) => ({ ...g, teamId: home.id })) : [])];
  const l = lookupOf(x.snapshot);
  const goalChanges = goals.map((g) => ({ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: g.id, entity: 'goal' as const, entityId: g.id, action: 'edited' as const, summary: `Moved to ${to!.name}, as ${team!.name} was removed`, diffs: [{ field: 'Team', from: team!.name, to: l.teamName(to!.id) }] }));
  return {
    ...(movedPeople.length ? { people: movedPeople } : {}),
    ...(movedGoals.length ? { goals: movedGoals } : {}),
    removeTeams: [id],
    changes: [
      { id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'workspace', entityId: id, action: 'removed', summary: what ? `Removed the team “${team!.name}”, moving ${what} to ${to!.name}` : `Removed the team “${team!.name}”`, diffs: [{ field: 'Team', from: team!.name, to: '—' }, ...(people.length ? [{ field: 'People moved', from: team!.name, to: `${to!.name}: ${people.map((p) => p.name).join(', ')}` }] : [])] },
      ...goalChanges,
    ],
  };
}

/** Admins only can delete a workspace; it has to be one of the workspace's own (not an example). */
export function canDeleteWorkspace(actor: Person, kind: 'own' | 'example', name: string, confirmName: string) {
  if (!actor.admin) no('Only admins can delete the workspace.');
  if (kind === 'example') no('Examples can be reset, not deleted.');
  if (confirmName.trim() !== name) no(`To confirm, give the workspace’s name exactly: “${name}”.`);
}

/* ---------- a goal set up with stages already done (onboarding spec, rule 3; OB2) ---------- */

/**
 * Record the stages said to be already done when a goal was set up: one check-in, in the week of the latest of them,
 * each stage done in its own due week. The goal's owner or an admin, and only before its first check-in.
 */
export function recordStagesDone(x: ActionContext, goal: Goal, stageIds: string[]): Commit | null {
  if (!ownsOrAdmin(x, goal)) no('Only the goal’s owner or an admin can say which stages are done.');
  if (checkInsFor(goal, x.snapshot.checkIns).length) no('This goal has check-ins already: say a stage is done in a check-in.');
  const c = stagesDoneAtSetUp(goal, stageIds, x.actor.id, x.now, x.newId('ci'));
  if (!c) return null;
  const change = checkInChange(null, c, goal, x.actor.id, x.newId('chg'));
  return { checkIns: [c], changes: change ? [change] : [] };
}
