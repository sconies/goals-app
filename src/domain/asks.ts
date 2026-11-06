/* One way to ask (consolidation 4, approved 5 Nov). Every ask that puts an obligation on someone is one record (Ask):
   a decision or help an owner needs, an update asked of a quiet goal's owner, a question for an owner, or an action
   someone agreed to do. Each says who asked, who must respond, by when (optional) and which goals it's about, and it
   stays open until it's answered (an action: marked done) or withdrawn, each said explicitly. Comments are free
   conversation and never answer or close an ask.

   These are the only rules for asks: who may answer, mark done and withdraw; what a check-in does to them; what they
   look like in the change log. The check-in, the bulk-change engine (import, Data, the AI assistant), the shared
   actions (actions.ts), Home, the goal page and the review all use them. */
import { checkInsFor } from './status';
import type { Ask, AskKind, AskStatus, Change, CheckIn, Decision, Goal, Person, Snapshot } from './types';

const norm = (s: string) => s.trim().toLowerCase();
type Asks = Pick<Snapshot, 'requests'> & Partial<Snapshot>;

/** How each kind is named where people read it. */
export const ASK_KIND_LABEL: Record<AskKind, string> = { decision: 'Decision or help', update: 'Update', question: 'Question', action: 'Action' };
/** …and each state. */
export const ASK_STATUS_LABEL: Record<AskStatus, string> = { open: 'Open', answered: 'Answered', done: 'Done', withdrawn: 'Withdrawn' };

/* ---------- reading ---------- */

/** "Amara Nwosu: approve the runner budget" → Amara, and the ask itself. Without a name it's for anyone. */
export function parseAsk(needs: string, people: Person[]): { recipientId: string | null; ask: string } {
  const t = needs.trim();
  const i = t.indexOf(':');
  if (i > 0) {
    const who = people.find((p) => norm(p.name) === norm(t.slice(0, i)));
    if (who) return { recipientId: who.id, ask: t.slice(i + 1).trim() };
  }
  return { recipientId: null, ask: t };
}

/** "Amara Nwosu: approve the runner budget", as a check-in and the story put a decision or help. */
export function askText(r: Ask, people: Person[]): string {
  const who = r.recipientId ? people.find((p) => p.id === r.recipientId)?.name : null;
  return who ? `${who}: ${r.ask}` : r.ask;
}

/** Every ask in a workspace (decisions or help read from check-ins for data from before asks were stored). */
export const asksOf = (s: Asks): Ask[] => s.requests ?? (s.goals && s.checkIns ? requestsFromCheckIns(s as Snapshot, (g) => checkInsFor(g, s.checkIns!).at(-1) ?? null) : []);
/** Open asks on a goal, of every kind or the kinds given. */
export const openAsksFor = (goalId: string, s: Asks, kinds?: AskKind[]) => asksOf(s).filter((r) => r.status === 'open' && r.goalIds.includes(goalId) && (!kinds || kinds.includes(r.kind)));
/** Open decisions or help a goal is waiting on: its own, and any it's linked to. */
export const openFor = (goalId: string, s: Asks) => openAsksFor(goalId, s, ['decision']);
/** Every open ask a person must respond to: addressed to them, or (a decision or help) to anyone they could answer. */
export const openForPerson = (personId: string, s: Asks) => asksOf(s).filter((r) => r.status === 'open' && r.recipientId === personId);
/** The open ask for an update on a goal, if there is one. */
export const openUpdateAsk = (goalId: string, s: Asks) => openAsksFor(goalId, s, ['update']).at(-1) ?? null;
/** The latest answer a goal's decision or help has had since its latest check-in, if any: what the next review should know. */
export function answeredSince(goalId: string, since: string | null, s: Asks): Ask | null {
  return asksOf(s).filter((r) => r.kind === 'decision' && r.status === 'answered' && r.goalIds.includes(goalId) && (!since || (r.answeredAt ?? '') > since)).sort((a, b) => (a.answeredAt ?? '').localeCompare(b.answeredAt ?? '')).pop() ?? null;
}
/** An open ask past the week it was due by. */
export const isOverdue = (r: Ask, week: number) => r.status === 'open' && r.dueWeek != null && r.dueWeek < week;
/** Closed by the person asked: answered, or an action marked done. */
export const isResolved = (r: Ask) => r.status === 'answered' || r.status === 'done';

/* ---------- who may do what ---------- */

/** Who must respond to it: the person asked (a decision or help, an action), or the goal's owner (an update, a question). */
export const mustRespond = (r: Ask, p: Pick<Person, 'id'>) => r.status === 'open' && r.recipientId === p.id;
/** Who may answer a decision, an update or a question: the person asked, or an admin; anyone, for an ask to anyone. */
export const canAnswer = (r: Ask, p: Person) => r.kind !== 'action' && (!r.recipientId || r.recipientId === p.id || p.admin);
/** Who may mark an action done: whoever does it, whoever asked for it, or an admin. */
export const canMarkDone = (r: Ask, p: Person) => r.kind === 'action' && (r.recipientId === p.id || r.askedBy === p.id || p.admin);
/**
 * Who may withdraw it: whoever asked, or an admin. A decision or help belongs to the goal it was raised on, so that
 * goal's owner may withdraw it too, and the owner of a goal linked to it may stop waiting on it.
 */
export function canWithdraw(r: Ask, p: Person, goal: Goal | undefined): boolean {
  if (r.askedBy === p.id || p.admin) return true;
  return r.kind === 'decision' && !!goal && goal.ownerId === p.id && r.goalIds.includes(goal.id);
}

/* ---------- the change log ---------- */

const change = (r: Ask, goalId: string, actorId: string, at: string, id: string, action: Change['action'], summary: string, diffs: Change['diffs']): Change =>
  ({ id, at, actorId, goalId, entity: 'request', entityId: r.id, action, summary, diffs });
const FIELD: Record<AskKind, string> = { decision: 'Request', update: 'Update asked for', question: 'Question', action: 'Action' };
/** How an ask for an update is logged. */
export const UPDATE_ASK = 'Asked for an update';

/** A new ask's record and its log entry. */
export function raiseAsk(v: { kind: AskKind; goalIds: string[]; askedBy: string; recipientId: string | null; ask: string; dueWeek?: number | null; reviewId?: string | null; week?: number | null; checkInId?: string | null; summary: string }, now: string, newId: (p: string) => string): { ask: Ask; change: Change } {
  const a: Ask = {
    id: newId(v.kind === 'decision' ? 'req' : 'ask'), kind: v.kind, goalIds: v.goalIds, askedBy: v.askedBy, recipientId: v.recipientId, ask: v.ask.trim(), status: 'open',
    dueWeek: v.dueWeek ?? null, reviewId: v.reviewId ?? null, week: v.week ?? null, checkInId: v.checkInId ?? null, createdAt: now, updatedAt: now, answer: null, answeredBy: null, answeredAt: null,
  };
  return { ask: a, change: change(a, a.goalIds[0]!, v.askedBy, now, newId('chg'), 'asked', v.summary, [{ field: FIELD[v.kind], from: '—', to: a.ask }, ...(v.dueWeek ? [{ field: 'Due', from: '—', to: `week ${v.dueWeek}` }] : [])]) };
}

/** Answer it: one answer for every goal it applies to. */
export function answerAsk(r: Ask, answer: string, by: string, now: string, newId: (p: string) => string): { request: Ask; changes: Change[] } {
  const request: Ask = { ...r, status: 'answered', answer: answer.trim(), answeredBy: by, answeredAt: now, updatedAt: now };
  const summary = r.kind === 'question' ? 'Answered the question' : r.kind === 'update' ? 'Answered the ask for an update' : 'Answered the request';
  return { request, changes: r.goalIds.map((g) => change(r, g, by, now, newId('chg'), 'answered', summary, [{ field: FIELD[r.kind], from: '—', to: r.ask }, { field: 'Answer', from: '—', to: answer.trim() }])) };
}

/** Mark an action done, with an optional note. */
export function markDone(r: Ask, note: string, by: string, now: string, newId: (p: string) => string): { request: Ask; changes: Change[] } {
  const request: Ask = { ...r, status: 'done', answer: note.trim(), answeredBy: by, answeredAt: now, updatedAt: now };
  return { request, changes: r.goalIds.map((g) => change(r, g, by, now, newId('chg'), 'done', 'Marked the action done', [{ field: 'Action', from: 'Open', to: 'Done' }, ...(note.trim() ? [{ field: 'Note', from: '—', to: note.trim() }] : [])])) };
}

/** Withdraw it; or, for a goal linked to someone else's decision or help, stop waiting on it. */
export function withdrawAsk(r: Ask, goalId: string, by: string, now: string, newId: (p: string) => string, why = 'Withdrawn'): { request: Ask; changes: Change[] } {
  const own = r.goalIds[0] === goalId || r.kind !== 'decision';
  const request: Ask = own ? { ...r, status: 'withdrawn', updatedAt: now } : { ...r, goalIds: r.goalIds.filter((g) => g !== goalId), updatedAt: now };
  const summary = !own ? 'No longer waiting on this request' : r.kind === 'update' ? 'Withdrew the ask for an update' : r.kind === 'question' ? 'Withdrew the question' : r.kind === 'action' ? 'Withdrew the action' : 'Withdrew the request';
  return { request, changes: [change(r, goalId, by, now, newId('chg'), 'withdrawn', summary, own ? [{ field: FIELD[r.kind], from: r.ask, to: why }] : [{ field: 'Waiting on', from: r.ask, to: '—' }])] };
}

/** Correct what was asked (and, for an action, who does it and by when). Null when nothing changed. */
export function editAsk(r: Ask, v: { ask: string; recipientId?: string | null; dueWeek?: number | null }, people: Person[], by: string, now: string, newId: (p: string) => string): { request: Ask; changes: Change[] } | null {
  const after: Ask = { ...r, ask: v.ask.trim(), ...(r.kind === 'action' ? { recipientId: v.recipientId === undefined ? r.recipientId : v.recipientId, dueWeek: v.dueWeek === undefined ? r.dueWeek : v.dueWeek } : {}), updatedAt: now };
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? '—';
  const diffs = [
    ...(after.ask !== r.ask ? [{ field: FIELD[r.kind], from: r.ask, to: after.ask }] : []),
    ...(after.recipientId !== r.recipientId ? [{ field: 'Who', from: name(r.recipientId), to: name(after.recipientId) }] : []),
    ...(after.dueWeek !== r.dueWeek ? [{ field: 'Due', from: r.dueWeek ? `week ${r.dueWeek}` : '—', to: after.dueWeek ? `week ${after.dueWeek}` : '—' }] : []),
  ];
  if (!diffs.length) return null;
  return { request: after, changes: [change(r, r.goalIds[0]!, by, now, newId('chg'), 'edited', `Corrected ${r.kind === 'question' ? 'a question' : r.kind === 'action' ? 'an action' : 'the request'}`, diffs)] };
}

/* ---------- what a check-in does ---------- */

/**
 * What a check-in does to asks. Only the goal's latest check-in counts (a past week loaded later doesn't).
 * A decision or help: with an ask in the check-in, the same one carries on (its words updated if the owner changed them),
 * or a new one is raised; without one, the goal's own open one is withdrawn and a link to someone else's is dropped.
 * An update asked for is answered by the check-in itself: that's what was asked.
 */
export function requestsAfterCheckIn(goal: Goal, c: CheckIn, s: Snapshot, actorId: string, now: string, newId: (p: string) => string): { requests: Ask[]; changes: Change[] } {
  const out: Ask[] = [];
  const changes: Change[] = [];
  for (const u of openAsksFor(goal.id, s, ['update'])) {
    const { request, changes: ch } = answerAsk(u, `Checked in for week ${c.week}`, actorId, now, newId);
    out.push(request);
    changes.push(...ch);
  }
  const needs = c.pathToGreen?.needs?.trim() ?? '';
  const open = openFor(goal.id, s);
  if (needs) {
    const { recipientId, ask } = parseAsk(needs, s.people);
    const same = open.find((r) => r.recipientId === recipientId);
    if (same) {
      if (same.goalIds[0] === goal.id && norm(same.ask) !== norm(ask)) {
        const next = { ...same, ask, checkInId: c.id, updatedAt: now };
        out.push(next);
        changes.push(change(next, goal.id, actorId, now, newId('chg'), 'edited', 'Changed the request', [{ field: 'Request', from: same.ask, to: ask }]));
      }
    } else {
      const who = recipientId ? s.people.find((p) => p.id === recipientId)?.name ?? 'someone' : 'anyone';
      const raised = raiseAsk({ kind: 'decision', goalIds: [goal.id], askedBy: actorId, recipientId, ask, checkInId: c.id, summary: `Asked ${who} for a decision or help` }, now, newId);
      out.push(raised.ask);
      changes.push(raised.change);
    }
    // A different ask replaces the goal's own earlier one to someone else.
    for (const r of open.filter((x) => x.goalIds[0] === goal.id && x.recipientId !== recipientId)) {
      const w = withdrawAsk(r, goal.id, actorId, now, newId, 'Withdrawn: replaced by a new request');
      out.push(w.request);
      changes.push(...w.changes);
    }
    return { requests: out, changes };
  }
  for (const r of open) {
    const w = withdrawAsk(r, goal.id, actorId, now, newId, 'Withdrawn: not needed any more');
    out.push(w.request);
    changes.push(...w.changes);
  }
  return { requests: out, changes };
}

/**
 * An owner links their goal to a decision or help already raised for another goal: they're waiting on the same
 * decision. Their own open one to the same person is withdrawn, so the person asked sees it once.
 */
export function linkRequest(r: Ask, goal: Goal, s: Snapshot, by: string, now: string, newId: (p: string) => string): { requests: Ask[]; changes: Change[] } {
  const linked: Ask = { ...r, goalIds: [...r.goalIds.filter((g) => g !== goal.id), goal.id], updatedAt: now };
  const changes: Change[] = [change(r, goal.id, by, now, newId('chg'), 'linked', 'Waiting on the same request as another goal', [{ field: 'Waiting on', from: '—', to: askText(r, s.people) }])];
  const own = openFor(goal.id, s).filter((x) => x.id !== r.id && x.goalIds[0] === goal.id && x.recipientId === r.recipientId);
  const withdrawn = own.map((x) => withdrawAsk(x, goal.id, by, now, newId, 'Withdrawn: linked to the same request on another goal'));
  return { requests: [linked, ...withdrawn.map((w) => w.request)], changes: [...changes, ...withdrawn.flatMap((w) => w.changes)] };
}

/* ---------- data from before ---------- */

/** The decisions or help a workspace starts with, read from each goal's latest check-in (data from before asks were stored). */
export function requestsFromCheckIns(s: Snapshot, latestOf: (g: Goal) => CheckIn | null): Ask[] {
  const out: Ask[] = [];
  for (const g of s.goals) {
    const c = latestOf(g);
    const needs = c?.pathToGreen?.needs?.trim();
    if (!c || !needs) continue;
    const { recipientId, ask } = parseAsk(needs, s.people);
    out.push({ id: `req_${c.id}`, kind: 'decision', goalIds: [g.id], askedBy: c.authorId, recipientId, ask, status: 'open', dueWeek: null, reviewId: null, week: null, checkInId: c.id, createdAt: c.postedAt, updatedAt: c.postedAt, answer: null, answeredBy: null, answeredAt: null });
  }
  return out;
}

/** A stored ask from before kinds (a request for a decision or help), with every field filled. */
export const normaliseAsk = (r: Partial<Ask> & Pick<Ask, 'id' | 'goalIds' | 'askedBy' | 'ask' | 'status' | 'createdAt'>): Ask => ({
  kind: 'decision', recipientId: null, dueWeek: null, reviewId: null, week: null, checkInId: null, updatedAt: r.createdAt, answer: null, answeredBy: null, answeredAt: null, ...r,
} as Ask);

/** An ask for an update from before one ask model: a comment, recognised by its summary or its words. */
const isLegacyUpdateAsk = (c: Change) => c.entity === 'note' && c.action === 'noted' && (c.summary === UPDATE_ASK || (c.diffs[0]?.to ?? '').includes('could you post an update'));

/**
 * Data from before one ask model, read as asks (migration 0023 does the same in the database). A review's question or
 * action (a decision of kind ask or action) becomes an ask of that kind: a question is answered if its owner commented
 * or checked in after it (the old rule, kept for what it already said), an action is open. An ask for an update (a
 * comment) becomes an update ask: withdrawn if it was undone, answered if the owner has checked in since, otherwise
 * open; its log entries become the ask's. Data already in the new shape comes back as it is.
 */
export function upgradeAsks(s: Snapshot): Snapshot {
  const legacyCalls = s.decisions.filter((d) => d.kind === 'ask' || d.kind === 'action');
  const legacyUpdates = s.changes.filter(isLegacyUpdateAsk);
  const unkinded = (s.requests ?? []).some((r) => !(r as Partial<Ask>).kind || (r as Partial<Ask>).dueWeek === undefined);
  if (s.requests && !legacyCalls.length && !legacyUpdates.length && !unkinded) return s;
  const asks = asksOf(s).map(normaliseAsk);
  const ownerOf = (goalId: string) => s.goals.find((g) => g.id === goalId)?.ownerId ?? null;
  for (const d of legacyCalls) {
    const owner = ownerOf(d.goalId);
    if (d.kind === 'ask') {
      const ans = legacyAnswer(d, s);
      asks.push({ id: d.id, kind: 'question', goalIds: [d.goalId], askedBy: d.byId, recipientId: owner, ask: d.note, status: ans ? 'answered' : 'open', dueWeek: null, reviewId: d.reviewId, week: d.week, checkInId: null, createdAt: d.at, updatedAt: ans?.at ?? d.at, answer: ans?.text ?? null, answeredBy: ans?.byId ?? null, answeredAt: ans?.at ?? null });
    } else {
      asks.push({ id: d.id, kind: 'action', goalIds: [d.goalId], askedBy: d.byId, recipientId: d.assigneeId ?? owner, ask: d.note, status: 'open', dueWeek: d.dueWeek ?? null, reviewId: d.reviewId, week: d.week, checkInId: null, createdAt: d.at, updatedAt: d.at, answer: null, answeredBy: null, answeredAt: null });
    }
  }
  const undone = new Set(s.changes.filter((c) => c.entity === 'note' && c.action === 'withdrawn').map((c) => c.entityId));
  for (const c of legacyUpdates) {
    if (!c.goalId) continue;
    const goal = s.goals.find((g) => g.id === c.goalId);
    const after = goal ? checkInsFor(goal, s.checkIns).find((x) => x.postedAt > c.at) : undefined;
    const withdrawn = undone.has(c.entityId);
    asks.push({
      id: c.entityId, kind: 'update', goalIds: [c.goalId], askedBy: c.actorId, recipientId: ownerOf(c.goalId), ask: c.diffs[0]?.to ?? UPDATE_ASK,
      status: withdrawn ? 'withdrawn' : after ? 'answered' : 'open', dueWeek: null, reviewId: null, week: null, checkInId: null, createdAt: c.at, updatedAt: after?.postedAt ?? c.at,
      answer: !withdrawn && after ? `Checked in for week ${after.week}` : null, answeredBy: !withdrawn && after ? after.authorId : null, answeredAt: !withdrawn && after ? after.postedAt : null,
    });
  }
  const updateIds = new Set(legacyUpdates.map((c) => c.entityId));
  return {
    ...s,
    decisions: s.decisions.filter((d) => d.kind !== 'ask' && d.kind !== 'action'),
    // The ask's own log: asking, and taking it back, are the ask's entries now, not comments.
    changes: s.changes.map((c) => (c.entity === 'note' && updateIds.has(c.entityId) ? { ...c, entity: 'request' as const, action: c.action === 'noted' ? 'asked' as const : c.action, summary: c.action === 'noted' ? UPDATE_ASK : 'Withdrew the ask for an update' } : c)),
    requests: asks,
  };
}

/** The old rule for a review question's answer: its owner's first comment or check-in on the goal after it was asked. */
function legacyAnswer(d: Decision, s: Snapshot): { text: string; at: string; byId: string } | null {
  const goal = s.goals.find((g) => g.id === d.goalId);
  if (!goal) return null;
  const c = s.changes.find((x) => x.goalId === goal.id && x.actorId === goal.ownerId && x.at > d.at && (x.entity === 'note' || x.entity === 'check-in'));
  if (!c) return null;
  const said = c.diffs.find((x) => x.field === 'Comment' || x.field === 'Note' || x.field === 'Why' || x.field === 'Reason');
  return { text: said?.to ?? c.summary, at: c.at, byId: c.actorId };
}

/** Every comment ever written and not taken back, removed ones included. (Before one ask model, an ask for an update was a comment; those are asks now.) */
export function writtenNotes(changes: Change[]): Change[] {
  const gone = new Set(changes.filter((c) => c.entity === 'note' && c.action === 'withdrawn').map((c) => c.entityId));
  return changes.filter((c) => c.entity === 'note' && c.action === 'noted' && !gone.has(c.entityId) && !isLegacyUpdateAsk(c));
}

/** Comments that stand: written, not taken back, and not removed now (a later 'removed' entry with no 'restored' after it). */
export function liveNotes(changes: Change[]): Change[] {
  const removed = new Set<string>();
  for (const c of changes) {
    if (c.entity !== 'note') continue;
    if (c.action === 'removed') removed.add(c.entityId);
    else if (c.action === 'restored') removed.delete(c.entityId);
  }
  return writtenNotes(changes).filter((c) => !removed.has(c.entityId));
}

/** The words of an ask for an update. */
export const updateAskText = (ownerFirstName: string | undefined, lastWeek: number | null) =>
  `${ownerFirstName ?? 'Hi'}, could you post an update? ${lastWeek != null ? `The last check-in was week ${lastWeek}.` : 'There’s no check-in yet.'}`;
