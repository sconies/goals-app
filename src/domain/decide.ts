/* Deciding in a review (deep review P2; backlog GD(1), L(2), LP; Lane, 10 Nov). Every goal that is off track or at risk
   leaves a review's walk with a decision: a next step (an action with an owner and the week it's due by) or "We accept
   the risk", with a reason. The next session opens with what the last one agreed, and finishing a session says what was
   decided and who owns what. The records are the ones that already exist: a next step is an action ask (asks.ts), the
   same record "Being handled" reads (attention.ts); accepting the risk is a note said in the review whose words start
   with DECIDED['accept-risk'].label. The app, the import and the AI assistant all ask here. */
import { asksOf, isOverdue } from './asks';
import { lastHeld, saidIn, type ReviewSession, type Said } from './review';
import { goalStatus } from './status';
import { DECIDED } from './vocabulary';
import type { Ask, Cycle, Goal, Review, Snapshot } from './types';

/** A goal that has to leave a review with a decision: it is off track or at risk. */
export const needsDecision = (status: string) => status === 'off' || status === 'risk';

/** The words a note is saved with when the review accepts the risk: "We accept the risk: <reason>". */
const ACCEPT = `${DECIDED['accept-risk'].label}: `;
export const acceptNote = (reason: string) => ACCEPT + reason.trim();
/** The reason, when a note said in a review is the review accepting the risk; null for any other note. */
export const acceptedReason = (note: string): string | null => (note.startsWith(ACCEPT) ? note.slice(ACCEPT.length) : null);
/** The shortest reason that says something. */
export const MIN_ACCEPT_REASON = 5;

export type Decided =
  | { kind: 'next-step'; id: string; text: string; who: string; dueWeek: number; inSession: boolean }
  | { kind: 'accept-risk'; id: string; reason: string; inSession: true };

/**
 * What has been decided about a goal in this session, or null when nothing has. A next step said in the session (an
 * action with an owner and a due week, open or done), or the review accepting the risk, counts; so does an open action
 * with an owner and a due week agreed since the goal's latest check-in, wherever it was agreed (on the goal's page, say),
 * as long as its week hasn't passed. The latest decision in the session wins.
 */
export function decisionFor(goal: Goal, session: Pick<ReviewSession, 'said'>, s: Snapshot, cycle: Cycle, week: number, today: Date): Decided | null {
  const here = session.said.filter((d) => d.goalId === goal.id).sort((a, b) => b.at.localeCompare(a.at));
  for (const d of here) {
    if (d.kind === 'action' && d.assigneeId && d.dueWeek != null) return { kind: 'next-step', id: d.id, text: d.note, who: d.assigneeId, dueWeek: d.dueWeek, inSession: true };
    const reason = d.kind === 'note' ? acceptedReason(d.note) : null;
    if (reason != null) return { kind: 'accept-risk', id: d.id, reason, inSession: true };
  }
  const since = goalStatus(goal, cycle, s.checkIns, today).latest?.postedAt ?? '';
  const open = asksOf(s).filter((a) => a.kind === 'action' && a.status === 'open' && a.goalIds.includes(goal.id) && a.recipientId && a.dueWeek != null && !isOverdue(a, week) && a.createdAt > since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return open ? { kind: 'next-step', id: open.id, text: open.ask, who: open.recipientId!, dueWeek: open.dueWeek!, inSession: false } : null;
}

/** A next step agreed in an earlier session, as it stands now. */
export interface CarriedAction { ask: Ask; goalId: string; who: string; dueWeek: number | null; state: 'open' | 'done' | 'overdue' }

/**
 * "Last time": the actions the previous session of a review agreed (the latest earlier week anything was said in it),
 * and how each stands now, open ones first. Null when there was no earlier session or it agreed no action.
 */
export function lastTime(r: Review, s: Snapshot, sessionWeek: number, week: number): { week: number; on: string; actions: CarriedAction[] } | null {
  const held = lastHeld(r, s, sessionWeek);
  if (!held) return null;
  const actions = saidIn(s).filter((d): d is Said & { ask: Ask } => d.reviewId === r.id && d.week === held.week && d.kind === 'action' && !!d.ask)
    .map((d): CarriedAction => ({ ask: d.ask, goalId: d.goalId, who: d.ask.recipientId ?? d.assigneeId ?? '', dueWeek: d.ask.dueWeek, state: d.ask.status === 'done' ? 'done' : isOverdue(d.ask, week) ? 'overdue' : 'open' }))
    .sort((a, b) => Number(a.state === 'done') - Number(b.state === 'done') || (a.dueWeek ?? 99) - (b.dueWeek ?? 99));
  return actions.length ? { week: held.week, on: held.on, actions } : null;
}

/** What a session decided, for its Finish summary: the next steps by who owns them, the risks accepted, and the questions asked. */
export function sessionDecisions(session: ReviewSession): { byOwner: { who: string; steps: Said[] }[]; accepted: { goalId: string; reason: string }[]; questions: Said[] } {
  const steps = session.said.filter((d) => d.kind === 'action');
  const owners = [...new Set(steps.map((d) => d.assigneeId ?? d.ask?.recipientId ?? ''))];
  return {
    byOwner: owners.map((who) => ({ who, steps: steps.filter((d) => (d.assigneeId ?? d.ask?.recipientId ?? '') === who) })),
    accepted: session.said.flatMap((d) => { const reason = d.kind === 'note' ? acceptedReason(d.note) : null; return reason != null ? [{ goalId: d.goalId, reason }] : []; }),
    questions: session.said.filter((d) => d.kind === 'ask'),
  };
}
