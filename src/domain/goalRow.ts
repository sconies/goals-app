/* One goal row (UX2a; docs/design/patterns/spec.md section 1; requirement GOAL-ROW). Every list of goals says the same
   slots in the same order: status, value, name, then why it is in this list, an optional second line, and an action
   where the list is something to do. Each place chooses what fills the reason, the context and the action; no place
   chooses where the slots go. This function only picks and formats parts of the shared rules (attention, nowText,
   gapBeside, statusChange, goalResult, the vocabulary): it writes no sentence of its own, so the screens, the import
   and the MCP server say the same reason for the same goal. Pure: it reads only what it is given. */
import type { GoalAttention, Flag } from './attention';
import { askText, openFor } from './asks';
import { NO_REASON } from './checkin';
import { gapBeside, nowText } from './format';
import { daysSince, notStarted, resultWeek } from './plan';
import { assessPosted, checkInsFor } from './status';
import { goalResult } from './story';
import { rhythmOf } from './thresholds';
import { statusChange } from './tree';
import { LABEL, RESULT_TEXT, type ResultKind } from './vocabulary';
import { startsSays } from './weeks';
import type { Ask, CheckIn, Cycle, DisplayStatus, Goal, Person } from './types';

/** The eight places a goal row is listed (spec 1.4). */
export type RowPlace = 'home-mine' | 'home-watching' | 'watching-needs' | 'watching-handled' | 'watching-rest' | 'goals-list' | 'checkin-queue' | 'agenda';
export const ROW_PLACES: RowPlace[] = ['home-mine', 'home-watching', 'watching-needs', 'watching-handled', 'watching-rest', 'goals-list', 'checkin-queue', 'agenda'];

/** The one button a row in a task list has. */
export type RowAction = 'Check in' | 'Carry on' | 'Correct it';

export interface RowFacts {
  /** The workspace's check-ins, people and asks: only the rows the row reads. */
  checkIns: CheckIn[];
  people: Person[];
  asks: Ask[];
  cycle: Cycle;
  today: Date;
  week: number;
  /** Who is looking: an ask addressed to them reads "Waiting on you". */
  viewerId: string;
  /** What tells this goal from another of the same title (`goalTell`), when one could be on screen. */
  tell?: string | null;
  /** Lists of other people's goals name the owner in the reason; a list of your own doesn't. */
  showOwner?: boolean;
  /** Say whose goal it is first in the reason, on a goal that isn't the viewer's (a lead's lists on Home). */
  sayOwner?: boolean;
  /** The check-in queue: a draft is kept, or this week's check-in is already posted (and the day it was). */
  queue?: { draft?: boolean; done?: boolean; postedDay?: string };
}

export interface RowParts {
  status: DisplayStatus;
  /** The status's word, from the vocabulary. */
  statusWord: string;
  /** The number now ("36 hours", "2 of 5 stages", "No value yet"). */
  value: string;
  /** How it stands against the plan, in its tone ("12 behind plan"), or null when the value already says it. */
  gap: { text: string; tone: string } | null;
  /** Which week a number not from this week is from: "as of week 9". */
  asOf: string | null;
  /** A finished goal's result, in the vocabulary's words ("Completed late"). */
  result: { kind: ResultKind; text: string } | null;
  title: string;
  tell: string | null;
  /** Why it is in this list: one sentence, from the place's rule. */
  reason: string | null;
  /** The reason is a flag that isn't the status itself: it takes the warning mark. */
  reasonIsFlag: boolean;
  /** The owner said first in the reason ("Yasmin El-Amin. …"), when the place asks for it; the reason's own words follow. */
  reasonOwner?: string;
  /** An optional second line that changes what the reader decides: an open ask, or a draft kept. */
  context: string | null;
  /** The context is an ask still waiting: it takes the warning mark. */
  contextIsFlag: boolean;
  action: RowAction | null;
}

/** The flags that are a status: the status shape already says them, so their detail carries no mark (spec 1.5). */
const STATUS_FLAGS = new Set<Flag['kind']>(['off', 'risk', 'stale']);

/** A flag as the reason: a status flag says its detail; any other says its word first ("Getting worse: …"). */
export function flagReason(f: Flag): { text: string; isFlag: boolean } {
  return STATUS_FLAGS.has(f.kind) ? { text: f.detail, isFlag: false } : { text: `${f.label}: ${f.detail}`, isFlag: true };
}

/** "Checked in 2 days ago", "No check-in for 24 days", "No check-in yet", "No check-in yet · starts week 50". */
export function freshnessOf(g: Goal, status: DisplayStatus, checkIns: CheckIn[], cycle: Cycle, today: Date, week: number): { text: string; stale: boolean } {
  const last = checkInsFor(g, checkIns).at(-1);
  // A plan whose From is still to come says when it starts (goal entry, rule 13), and isn't late.
  if (!last) return notStarted(g, week) && g.kind === 'metric' ? { text: `${LABEL.none} · ${startsSays(cycle, g.plan.fromWeek!)}`, stale: false } : { text: LABEL.none, stale: week > 1 };
  const d = daysSince(last.postedAt, today);
  const stale = status === 'stale';
  return { text: stale ? `No check-in for ${d} days` : d < 1 ? 'Checked in today' : d === 1 ? 'Checked in yesterday' : `Checked in ${d} days ago`, stale };
}

/** The parts of one goal's row in one place (spec 1.2 to 1.5). */
export function rowParts(goal: Goal, att: GoalAttention, place: RowPlace, f: RowFacts): RowParts {
  const { checkIns, people, cycle, today, week } = f;
  const st = att.status;
  const a = assessPosted(goal, cycle, checkIns, week);
  const gap = gapBeside(goal, a);
  const stale = st.status === 'stale';
  // With no set rhythm (FT1) a status not from this week says which week it is from, beside the number.
  const asOf = stale && st.latest ? `as of week ${st.latest.week}` : !rhythmOf(cycle) && st.asOfWeek != null && st.status !== 'done' ? `as of week ${st.asOfWeek}` : null;
  const res = goalResult(goal, cycle, checkIns, resultWeek(cycle, today));

  const top = att.flags.find((x) => x.kind !== 'due') ?? null;
  const due = att.flags.find((x) => x.kind === 'due') ?? null;
  const owner = people.find((p) => p.id === goal.ownerId)?.name ?? null;
  const fresh = () => freshnessOf(goal, st.status, checkIns, cycle, today, week).text;
  const ownerFresh = () => `${f.showOwner !== false && owner ? owner + '. ' : ''}${fresh()}.`;

  // An open ask the goal waits on, when it isn't already the reason: it changes what the reader does (spec 1.5).
  const askLine = (): string | null => {
    if (!top || top.kind === 'decision' || st.status === 'done') return null;
    const asks = openFor(goal.id, { requests: f.asks });
    if (!asks.length) return null;
    return `Waiting on ${asks.map((r) => (r.recipientId === f.viewerId ? `you: ${r.ask}` : askText(r, people))).join('; ')}.`;
  };

  let reason: string | null = null, isFlag = false, context: string | null = null, contextIsFlag = false, action: RowAction | null = null;
  const useFlag = (x: Flag) => { const r = flagReason(x); reason = r.text; isFlag = r.isFlag; };
  const useAsk = () => { context = askLine(); contextIsFlag = context != null; };

  switch (place) {
    case 'home-mine':
      if (top) { useFlag(top); useAsk(); } else reason = due ? due.detail : `${fresh()}.`;
      // Only the owner checks in, so only the owner's row offers it (review of #593).
      if (due && goal.ownerId === f.viewerId) action = 'Check in';
      break;
    case 'watching-needs':
      if (top) { useFlag(top); useAsk(); }
      break;
    case 'watching-handled': {
      const h = att.handled;
      const said = h?.said || top?.detail || '';
      reason = h ? `${h.text}${said ? ' · ' + said : ''}` : top ? flagReason(top).text : null;
      break;
    }
    case 'home-watching':
    case 'watching-rest': {
      const moved = statusChange(goal, checkIns);
      if (top) useFlag(top);
      else if (moved) reason = `Was ${LABEL[moved.from].toLowerCase()} in week ${moved.week}. ${fresh()}.`;
      else reason = ownerFresh();
      break;
    }
    case 'goals-list':
      if (top) useFlag(top); else reason = ownerFresh();
      break;
    case 'checkin-queue': {
      const q = f.queue ?? {};
      if (q.done) { reason = q.postedDay ? `Checked in ${q.postedDay}.` : null; action = 'Correct it'; break; }
      // What last week's check-in said that the value doesn't: the owner's reason (spec 1.4).
      const last = checkInsFor(goal, checkIns).filter((c) => c.week < week).at(-1);
      const why = last?.why && last.why !== NO_REASON ? last.why : null;
      if (why) reason = `${last!.week === week - 1 ? 'Last week' : `Week ${last!.week}`}: ${why}`;
      if (q.draft) context = 'Draft kept';
      action = q.draft ? 'Carry on' : 'Check in';
      break;
    }
    case 'agenda':
      // What is in hand, else the top flag. The reviews spec's agendaReason (rule 1) takes this slot once it is built.
      if (att.handled) reason = att.handled.text + '.';
      else if (top) useFlag(top);
      break;
  }

  // Whose it is, first, where the place asks and the goal isn't the viewer's: "Yasmin El-Amin. {reason}".
  let reasonOwner: string | undefined;
  if (f.sayOwner && owner && goal.ownerId !== f.viewerId && reason && !(reason as string).startsWith(owner)) { reason = `${owner}. ${reason}`; reasonOwner = owner; }
  return {
    status: st.status, statusWord: LABEL[st.status],
    value: nowText(goal, a),
    gap: stale || !gap ? null : { text: gap.short, tone: gap.tone },
    asOf,
    result: res ? { kind: res.kind, text: RESULT_TEXT[res.kind] } : null,
    title: goal.title, tell: f.tell ?? null,
    reason, reasonIsFlag: isFlag, ...(reasonOwner ? { reasonOwner } : {}), context, contextIsFlag, action,
  };
}
