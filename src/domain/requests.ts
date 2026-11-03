/* Requests for a decision or help (product review, 3 Nov). An owner raises one in a check-in ("Elena Ruiz: approve an
   interim read-only scope"); it stays open from check-in to check-in until the person asked answers it or the owner
   withdraws it. Another owner can link their goal to it when they're waiting on the same decision, and one answer then
   applies to every linked goal. These are the only rules for requests: the check-in, the bulk-change engine (import,
   data tables, the AI assistant), Home, the goal page and the review all use them. */
import { checkInsFor } from './status';
import type { Change, CheckIn, Goal, HelpRequest, Person, Snapshot } from './types';

const norm = (s: string) => s.trim().toLowerCase();

/** "Elena Ruiz: approve the interim scope" → Elena, and the ask itself. Without a name it's for anyone. */
export function parseAsk(needs: string, people: Person[]): { recipientId: string | null; ask: string } {
  const t = needs.trim();
  const i = t.indexOf(':');
  if (i > 0) {
    const who = people.find((p) => norm(p.name) === norm(t.slice(0, i)));
    if (who) return { recipientId: who.id, ask: t.slice(i + 1).trim() };
  }
  return { recipientId: null, ask: t };
}

/** "Elena Ruiz: approve the interim scope", as a check-in and the story put it. */
export function askText(r: HelpRequest, people: Person[]): string {
  const who = r.recipientId ? people.find((p) => p.id === r.recipientId)?.name : null;
  return who ? `${who}: ${r.ask}` : r.ask;
}

// Data from before requests were stored: each goal's open request is read from its latest check-in.
const all = (s: Pick<Snapshot, 'requests'> & Partial<Snapshot>) => s.requests ?? (s.goals && s.checkIns ? requestsFromCheckIns(s as Snapshot, (g) => checkInsFor(g, s.checkIns!).at(-1) ?? null) : []);
/** Every request in a workspace (read from check-ins for data from before requests were stored). */
export const requestsOf = (s: Pick<Snapshot, 'requests'> & Partial<Snapshot>) => all(s);
/** Open requests a goal is waiting on: its own, and any it's linked to. */
export const openFor = (goalId: string, s: Pick<Snapshot, 'requests'> & Partial<Snapshot>) => all(s).filter((r) => r.status === 'open' && r.goalIds.includes(goalId));
/** Open requests waiting on a person. */
export const openForPerson = (personId: string, s: Pick<Snapshot, 'requests'> & Partial<Snapshot>) => all(s).filter((r) => r.status === 'open' && r.recipientId === personId);
/** The latest answer a goal has had since its latest check-in, if any: what the next review should know. */
export function answeredSince(goalId: string, since: string | null, s: Pick<Snapshot, 'requests'> & Partial<Snapshot>): HelpRequest | null {
  return all(s).filter((r) => r.status === 'answered' && r.goalIds.includes(goalId) && (!since || (r.answeredAt ?? '') > since)).sort((a, b) => (a.answeredAt ?? '').localeCompare(b.answeredAt ?? '')).pop() ?? null;
}

const change = (r: HelpRequest, goalId: string, actorId: string, at: string, id: string, action: Change['action'], summary: string, diffs: Change['diffs']): Change =>
  ({ id, at, actorId, goalId, entity: 'request', entityId: r.id, action, summary, diffs });

/**
 * What a check-in does to requests. Only the goal's latest check-in counts (a past week loaded later doesn't).
 * With an ask: the same request carries on (its words updated if the owner changed them), or a new one is raised.
 * Without one: the goal's own open request is withdrawn, and a link to someone else's request is dropped.
 */
export function requestsAfterCheckIn(goal: Goal, c: CheckIn, s: Snapshot, actorId: string, now: string, newId: (p: string) => string): { requests: HelpRequest[]; changes: Change[] } {
  const out: HelpRequest[] = [];
  const changes: Change[] = [];
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
      const r: HelpRequest = { id: newId('req'), goalIds: [goal.id], askedBy: actorId, recipientId, ask, status: 'open', checkInId: c.id, createdAt: now, updatedAt: now, answer: null, answeredBy: null, answeredAt: null };
      out.push(r);
      const who = recipientId ? s.people.find((p) => p.id === recipientId)?.name ?? 'someone' : 'anyone';
      changes.push(change(r, goal.id, actorId, now, newId('chg'), 'asked', `Asked ${who} for a decision or help`, [{ field: 'Request', from: '—', to: ask }]));
    }
    // A different ask replaces the goal's own earlier one to someone else.
    for (const r of open.filter((x) => x.goalIds[0] === goal.id && x.recipientId !== recipientId)) {
      out.push({ ...r, status: 'withdrawn', updatedAt: now });
      changes.push(change(r, goal.id, actorId, now, newId('chg'), 'withdrawn', 'Withdrew the request', [{ field: 'Request', from: r.ask, to: 'Withdrawn: replaced by a new request' }]));
    }
    return { requests: out, changes };
  }
  for (const r of open) {
    if (r.goalIds[0] === goal.id) {
      out.push({ ...r, status: 'withdrawn', updatedAt: now });
      changes.push(change(r, goal.id, actorId, now, newId('chg'), 'withdrawn', 'Withdrew the request', [{ field: 'Request', from: r.ask, to: 'Withdrawn: not needed any more' }]));
    } else {
      out.push({ ...r, goalIds: r.goalIds.filter((g) => g !== goal.id), updatedAt: now });
      changes.push(change(r, goal.id, actorId, now, newId('chg'), 'withdrawn', 'No longer waiting on this request', [{ field: 'Waiting on', from: r.ask, to: '—' }]));
    }
  }
  return { requests: out, changes };
}

/** The person asked (or an admin) answers: one answer for every goal the request applies to. */
export function answerRequest(r: HelpRequest, answer: string, by: string, now: string, newId: (p: string) => string): { request: HelpRequest; changes: Change[] } {
  const request: HelpRequest = { ...r, status: 'answered', answer: answer.trim(), answeredBy: by, answeredAt: now, updatedAt: now };
  return { request, changes: r.goalIds.map((g) => change(r, g, by, now, newId('chg'), 'answered', 'Answered the request', [{ field: 'Request', from: '—', to: r.ask }, { field: 'Answer', from: '—', to: answer.trim() }])) };
}

/**
 * An owner links their goal to a request already raised for another goal: they're waiting on the same decision.
 * Their own open request to the same person is withdrawn, so the person asked sees it once.
 */
export function linkRequest(r: HelpRequest, goal: Goal, s: Snapshot, by: string, now: string, newId: (p: string) => string): { requests: HelpRequest[]; changes: Change[] } {
  const linked: HelpRequest = { ...r, goalIds: [...r.goalIds.filter((g) => g !== goal.id), goal.id], updatedAt: now };
  const changes: Change[] = [change(r, goal.id, by, now, newId('chg'), 'linked', 'Waiting on the same request as another goal', [{ field: 'Waiting on', from: '—', to: askText(r, s.people) }])];
  const own = openFor(goal.id, s).filter((x) => x.id !== r.id && x.goalIds[0] === goal.id && x.recipientId === r.recipientId);
  const withdrawn = own.map((x) => ({ ...x, status: 'withdrawn' as const, updatedAt: now }));
  for (const x of own) changes.push(change(x, goal.id, by, now, newId('chg'), 'withdrawn', 'Withdrew the request', [{ field: 'Request', from: x.ask, to: 'Withdrawn: linked to the same request on another goal' }]));
  return { requests: [linked, ...withdrawn], changes };
}

/** Who may answer: the person asked, or an admin; anyone for a request to anyone. */
export const canAnswer = (r: HelpRequest, p: Person) => !r.recipientId || r.recipientId === p.id || p.admin;

/** The requests a workspace starts with, read from each goal's latest check-in (for data from before requests existed). */
export function requestsFromCheckIns(s: Snapshot, latestOf: (g: Goal) => CheckIn | null): HelpRequest[] {
  const out: HelpRequest[] = [];
  for (const g of s.goals) {
    const c = latestOf(g);
    const needs = c?.pathToGreen?.needs?.trim();
    if (!c || !needs) continue;
    const { recipientId, ask } = parseAsk(needs, s.people);
    out.push({ id: `req_${c.id}`, goalIds: [g.id], askedBy: c.authorId, recipientId, ask, status: 'open', checkInId: c.id, createdAt: c.postedAt, updatedAt: c.postedAt, answer: null, answeredBy: null, answeredAt: null });
  }
  return out;
}
