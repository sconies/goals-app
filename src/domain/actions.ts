/* What a person can do in a workspace, and who may do it: each action checks the rules, then returns the records to
   save and the change-log entries. The app (app/state.tsx) and the AI assistants' MCP server (mcp/tools.ts) both call
   these, so a person and their assistant can do the same things, under the same rules. Check-ins, goal edits, plans
   and spreadsheet rows go through the bulk-change engine (domain/changeset.ts) instead. */
import type { Commit } from '../data/store';
import type { Lookup } from './changes';
import { nextCycle, RESULT_LABEL, wrapUpOpen } from './cycle';
import { personChange, personProblems } from './people';
import { answerRequest as answered, canAnswer, linkRequest as linked } from './requests';
import { sessionWeek } from './review';
import { checkInsFor } from './status';
import { clampWidth, isTableView, layoutParams, layoutProblems, parseLayout, type TableLayout } from './tableLayout';
import type { ApiToken, Cycle, Decision, Goal, HelpRequest, Level, Person, Retro, Review, SavedView, Snapshot, Watch } from './types';
import { askChange, openUpdateAsk, undoAskChange, updateAskText } from './updateAsks';

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

/* ---------- Comments and asks for an update ---------- */

/** A logged comment on a goal. Anyone can comment; it doesn't change the status. */
export function addNote(x: ActionContext, goal: Goal, text: string): Commit {
  const t = text.trim();
  if (t.length < 2) no('Write the comment.');
  return { changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: goal.id, entity: 'note', entityId: x.newId('note'), action: 'noted', summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: t }] }] };
}

/** Ask a goal's owner for an update: on their Home until they check in. Null when it's already asked. */
export function askForUpdate(x: ActionContext, goal: Goal): Commit | null {
  if (goal.ownerId === x.actor.id) no('It’s your own goal: post a check-in instead.');
  const latest = latestOf(x, goal);
  if (openUpdateAsk(goal.id, x.snapshot, latest?.postedAt ?? null)) return null;
  const owner = x.snapshot.people.find((p) => p.id === goal.ownerId);
  return { changes: [askChange(goal.id, updateAskText(owner?.name.split(' ')[0], latest?.week ?? null), x.actor.id, x.now, { change: x.newId('chg'), note: x.newId('note') })] };
}

/** Undo an ask for an update: whoever asked, or an admin. Null when there's no open ask. */
export function undoUpdateAsk(x: ActionContext, goal: Goal): Commit | null {
  const ask = openUpdateAsk(goal.id, x.snapshot, latestOf(x, goal)?.postedAt ?? null);
  if (!ask) return null;
  if (ask.actorId !== x.actor.id && !x.actor.admin) no('Only whoever asked, or an admin, can undo the ask.');
  return { changes: [undoAskChange(ask, x.actor.id, x.now, x.newId('chg'))] };
}

/* ---------- Requests for a decision or help ---------- */

/** Answer a request: the person asked, or an admin (anyone, for a request to no one in particular). */
export function answerRequest(x: ActionContext, r: HelpRequest, answer: string): Commit {
  if (r.status !== 'open') no('That request isn’t open any more.');
  if (!canAnswer(r, x.actor)) no(`Only ${x.snapshot.people.find((p) => p.id === r.recipientId)?.name ?? 'the person asked'} or an admin can answer it.`);
  if (answer.trim().length < 2) no('Write the answer.');
  const { request, changes } = answered(r, answer, x.actor.id, x.now, x.newId);
  return { requests: [request], changes };
}

/** A goal's owner (or an admin) says the goal waits on a request raised for another goal. */
export function linkRequest(x: ActionContext, r: HelpRequest, goal: Goal): Commit {
  if (r.status !== 'open') no('That request isn’t open any more.');
  if (!ownsOrAdmin(x, goal)) no('Only the goal’s owner or an admin can link it to a request.');
  if (r.goalIds.includes(goal.id)) no('That goal is already waiting on this request.');
  const { requests, changes } = linked(r, goal, x.snapshot, x.actor.id, x.now, x.newId);
  return { requests, changes };
}

/** The goal's owner (or an admin) withdraws its request, or stops waiting on one raised for another goal. */
export function withdrawRequest(x: ActionContext, r: HelpRequest, goal: Goal): Commit {
  if (r.status !== 'open') no('That request isn’t open any more.');
  if (!r.goalIds.includes(goal.id)) no('That goal isn’t waiting on this request.');
  if (!ownsOrAdmin(x, goal)) no('Only the goal’s owner or an admin can withdraw its request.');
  const own = r.goalIds[0] === goal.id;
  const next: HelpRequest = own ? { ...r, status: 'withdrawn', updatedAt: x.now } : { ...r, goalIds: r.goalIds.filter((g) => g !== goal.id), updatedAt: x.now };
  return { requests: [next], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: goal.id, entity: 'request', entityId: r.id, action: 'withdrawn', summary: own ? 'Withdrew the request' : 'No longer waiting on this request', diffs: [{ field: 'Request', from: r.ask, to: 'Withdrawn' }] }] };
}

/* ---------- Reviews ---------- */

export type CallKind = 'acknowledge' | 'note' | 'ask' | 'action';
const CALL_FIELD = { acknowledge: 'Note', note: 'Note', ask: 'Question', action: 'Action' } as const;

/** What someone says about a goal in a review: seen, a note, a question for the owner, or an action. */
export function reviewCall(x: ActionContext, goal: Goal, review: Review, kind: CallKind, note: string, extra: { week?: number; assigneeId?: string | null; dueWeek?: number | null } = {}): Commit {
  const text = note.trim();
  if (kind !== 'acknowledge' && text.length < 2) no(kind === 'ask' ? 'Write the question.' : kind === 'action' ? 'Write the action.' : 'Write the note.');
  if (kind === 'action' && extra.assigneeId && !x.snapshot.people.some((p) => p.id === extra.assigneeId)) no('The person for the action isn’t in this workspace.');
  const d: Decision = { id: x.newId('dec'), goalId: goal.id, checkInId: null, reviewId: review.id, week: extra.week ?? sessionWeek(review, x.week), kind, byId: x.actor.id, at: x.now, note: text, ...(kind === 'action' ? { assigneeId: extra.assigneeId ?? goal.ownerId, dueWeek: extra.dueWeek ?? null } : {}) };
  const action = ({ acknowledge: 'acknowledged', note: 'noted', ask: 'asked', action: 'actioned' } as const)[kind];
  const what = ({ acknowledge: 'Looked at it', note: 'Added a note', ask: 'Asked the owner a question', action: 'Agreed an action' } as const)[kind];
  const name = (id: string | null | undefined) => x.snapshot.people.find((p) => p.id === id)?.name ?? '—';
  return {
    decisions: [d],
    changes: [{ id: x.newId('chg'), at: d.at, actorId: x.actor.id, goalId: goal.id, entity: 'decision', entityId: d.id, action, summary: `${what} in ${review.name}`, diffs: text ? [{ field: CALL_FIELD[kind], from: '—', to: text }, ...(kind === 'action' ? [{ field: 'Who', from: '—', to: name(d.assigneeId) }, ...(d.dueWeek ? [{ field: 'Due', from: '—', to: `week ${d.dueWeek}` }] : [])] : [])] : [] }],
  };
}

/** Correct a note, question or action: whoever said it, or an admin. Null when nothing changed. */
export function editCall(x: ActionContext, d: Decision, note: string, extra?: { assigneeId?: string | null; dueWeek?: number | null }): Commit | null {
  if (d.byId !== x.actor.id && !x.actor.admin) no('Only whoever said it, or an admin, can correct it.');
  if (d.kind !== 'acknowledge' && note.trim().length < 2) no('Write the new wording.');
  const after: Decision = { ...d, note: note.trim(), ...(d.kind === 'action' && extra ? { assigneeId: extra.assigneeId ?? d.assigneeId ?? null, dueWeek: extra.dueWeek ?? null } : {}) };
  const name = (id: string | null | undefined) => x.snapshot.people.find((p) => p.id === id)?.name ?? '—';
  const field = d.kind === 'ask' ? 'Question' : d.kind === 'action' ? 'Action' : 'Note';
  const diffs = [
    ...(after.note !== d.note ? [{ field, from: d.note, to: after.note }] : []),
    ...(after.assigneeId !== d.assigneeId ? [{ field: 'Who', from: name(d.assigneeId), to: name(after.assigneeId) }] : []),
    ...(after.dueWeek !== d.dueWeek ? [{ field: 'Due', from: d.dueWeek ? `week ${d.dueWeek}` : '—', to: after.dueWeek ? `week ${after.dueWeek}` : '—' }] : []),
  ];
  if (!diffs.length) return null;
  return { decisions: [after], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: d.goalId, entity: 'decision', entityId: d.id, action: 'edited', summary: `Corrected ${d.kind === 'ask' ? 'a question' : d.kind === 'action' ? 'an action' : 'a note'}`, diffs }] };
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

/** Watch a goal, a goal and everything feeding it, or a whole level. Null when already watched. */
export function watch(x: ActionContext, kind: Watch['kind'], ref: string): Commit | null {
  if (kind === 'level' ? !['north-star', 'svp', 'team'].includes(ref) : !x.snapshot.goals.some((g) => g.id === ref)) no(kind === 'level' ? 'Levels are north-star, svp and team.' : 'There’s no goal with that ID in this cycle.');
  if (x.snapshot.watches.some((w) => w.personId === x.actor.id && w.kind === kind && w.ref === ref)) return null;
  return { watches: [{ id: x.newId('w'), personId: x.actor.id, kind, ref }], changes: [] };
}

/** Stop watching: your own watches only. */
export function unwatch(x: ActionContext, watchId: string): Commit {
  const w = x.snapshot.watches.find((v) => v.id === watchId);
  if (!w) no('There’s no watch with that ID.');
  if (w!.personId !== x.actor.id) no('That’s someone else’s watch.');
  return { unwatch: [watchId], changes: [] };
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

/** Delete one of your views; an admin can also delete a pinned one. Null when it's already gone. */
export function deleteView(x: ActionContext, id: string): Commit | null {
  const v = liveView(x, id);
  if (!v) return null;
  if (v.personId !== x.actor.id && !(x.actor.admin && v.pinned)) no('Only its owner, or an admin for a pinned view, can delete this view.');
  return { views: [{ ...v, deletedAt: x.now, updatedAt: x.now }], changes: v.pinned ? [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'workspace', entityId: v.id, action: 'edited', summary: `Removed the pinned view “${v.name}”`, diffs: [{ field: 'Pinned view', from: v.name, to: '—' }] }] : [] };
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

/** Admins: a personal token for an assistant to act as someone. Only the token's hash is kept; the caller makes both. */
export function createToken(x: ActionContext, personId: string, name: string, tokenHash: string): Commit {
  if (!x.actor.admin) no('Only admins can make tokens.');
  const who = x.snapshot.people.find((p) => p.id === personId);
  if (!who) no('There’s no one with that ID in this workspace.');
  if (!name.trim()) no('Say what the token is for, e.g. “Claude on my laptop”.');
  const t: ApiToken = { id: x.newId('tok'), personId, name: name.trim(), tokenHash, createdBy: x.actor.id, createdAt: x.now, lastUsedAt: null, revokedAt: null };
  return { tokens: [t], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'person', entityId: personId, action: 'created', summary: `Gave ${who!.name} an AI assistant token: “${t.name}”`, diffs: [{ field: 'AI assistant token', from: '—', to: t.name }] }] };
}

/** Stop a token working: an admin, or the token's person. Null when it's already revoked. */
export function revokeToken(x: ActionContext, id: string): Commit | null {
  const t = (x.snapshot.tokens ?? []).find((v) => v.id === id);
  if (!t) no('There’s no token with that ID.');
  if (t!.revokedAt) return null;
  if (!x.actor.admin && t!.personId !== x.actor.id) no('Only an admin or the token’s person can revoke it.');
  return { tokens: [{ ...t!, revokedAt: x.now }], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'person', entityId: t!.personId, action: 'edited', summary: `Revoked the AI assistant token “${t!.name}”`, diffs: [{ field: 'AI assistant token', from: t!.name, to: 'Revoked' }] }] };
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
  if (!clean) no('Give the workspace a name.');
  if (clean.length > 80) no('Keep the name to 80 characters or fewer.');
  if (clean === ws.name) return null;
  return { workspace: { name: clean }, changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'workspace', entityId: ws.id, action: 'edited', summary: `Renamed the workspace to “${clean}”`, diffs: [{ field: 'Workspace name', from: ws.name, to: clean }] }] };
}

/** Admins: add a team, or rename one or change its lead. Null commit when nothing changed. */
export function saveTeam(x: ActionContext, t: { id?: string; name: string; leadId?: string | null }): { commit: Commit | null; id: string } {
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
  const team = { id: before?.id ?? x.newId('team'), name: clean, leadId, objective: before?.objective ?? '' };
  const name = (id: string) => x.snapshot.people.find((p) => p.id === id)?.name ?? '—';
  const diffs = before
    ? [...(before.name !== team.name ? [{ field: 'Team name', from: before.name, to: team.name }] : []), ...((before.leadId || '') !== leadId ? [{ field: 'Team lead', from: name(before.leadId), to: name(leadId) }] : [])]
    : [{ field: 'Team', from: '—', to: team.name }];
  if (before && !diffs.length) return { commit: null, id: team.id };
  return { id: team.id, commit: { teams: [team], changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'workspace', entityId: team.id, action: before ? 'edited' : 'created', summary: before ? (before.name !== team.name ? `Renamed the team “${before.name}” to “${team.name}”` : `Changed the team “${team.name}”`) : `Added the team “${team.name}”`, diffs }] } };
}

/** What still belongs to a team: its people, and its goals in every cycle (the workspace's goals when known). */
export function teamMembers(x: Pick<ActionContext, 'snapshot' | 'allGoals'>, teamId: string) {
  return { people: x.snapshot.people.filter((p) => p.teamId === teamId), goals: (x.allGoals ?? x.snapshot.goals).filter((g) => g.teamId === teamId) };
}

/** Admins: remove a team. One with people or goals is emptied first: give `moveTo`, another team, and they move there. */
export function removeTeam(x: ActionContext, id: string, moveTo?: string | null): Commit {
  if (!x.actor.admin) no('Only admins can remove teams.');
  const team = x.snapshot.teams.find((t) => t.id === id);
  if (!team) no('There’s no team with that ID.');
  const { people, goals } = teamMembers(x, id);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const what = [people.length ? plural(people.length, 'person', 'people') : '', goals.length ? plural(goals.length, 'goal', 'goals') : ''].filter(Boolean).join(' and ');
  const to = moveTo ? x.snapshot.teams.find((t) => t.id === moveTo) : undefined;
  if (moveTo && (!to || moveTo === id)) no('Move them to another team that’s in this workspace.');
  if (what && !to) no(`${team!.name} still has ${what}. Move them to another team first.`);
  const movedPeople = people.map((p) => ({ ...p, teamId: to!.id }));
  const movedGoals = goals.map((g) => ({ ...g, teamId: to!.id }));
  const l = lookupOf(x.snapshot);
  const goalChanges = goals.map((g, i) => ({ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: g.id, entity: 'goal' as const, entityId: g.id, action: 'edited' as const, summary: `Moved to ${to!.name}, as ${team!.name} was removed`, diffs: [{ field: 'Team', from: team!.name, to: l.teamName(movedGoals[i]!.teamId) }] }));
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
