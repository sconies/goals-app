/* Starting the next year, in words (cycle-end spec 2.4 and rule 7): what the start page, Cycles and the AI tools say
   before and after an admin sets the next year up. The counts come from domain/carry's read-back, so what is said is
   what the start makes. Pure. */
import { carries, startReadBack, type ReadBack } from './carry';
import { cycleDates, cycleState, dayWithYear, laterCycle, nextCycleShape, startFromLine } from './cycle';
import { reviewDate } from './progress';
import type { Ask, CheckIn, Cycle, Goal, Retro, Review, Watch } from './types';


const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

export interface StartPage {
  /** The next year's name. */
  next: string;
  /** Whether it can be started now (the wrap-up is open, or the year has ended, and no later year exists). */
  canStart: boolean;
  /** Why not, when it can't. */
  whyNot: string | null;
  /** "2027 runs from Mon 4 Jan 2027 to Sun 2 Jan 2028: 52 weeks. Everyone stays in 2026 until …". */
  line: string;
  /** The four counts, each a number, its words and a second line; left out before the wrap-up opens. */
  counts: { n: number; says: string; sub: string }[];
  /** "What 2027 starts with": sentences, each with its bold part first. */
  startsWith: { bold: string; rest: string }[];
  readBack: ReadBack | null;
}

/** The start page (2.4) for a year, on a day: everything it says, worked out once. */
/** The rows the start page reads: the cycles; the goals, check-ins and wrap-ups; and what comes with a goal. */
export interface StartRows { cycles: Cycle[]; goals: Goal[]; checkIns: CheckIn[]; retros?: Retro[]; requests?: Ask[]; watches?: Watch[]; reviews?: Review[] }

export function startPage(s: StartRows, cycle: Cycle, today: Date): StartPage {
  const shape = nextCycleShape(cycle);
  const next = { ...cycle, ...shape };
  const nd = cycleDates(next), d = cycleDates(cycle);
  const state = cycleState(cycle, today);
  const later = laterCycle(s.cycles, cycle);
  const ended = state === 'ended' || state === 'closed';
  const line = `${shape.name} runs from ${dayWithYear(nd.firstDay)} to ${dayWithYear(nd.lastDay)}: ${shape.weeks} weeks. ${ended ? `It opens for everyone as soon as you start it.${state === 'ended' ? ` ${cycle.name}’s wrap-up stays open until ${dayWithYear(d.wrapUpCloses)}.` : ''}` : `Everyone stays in ${cycle.name} until ${dayWithYear(d.lastDay)}, so the last check-ins and the wrap-up carry on.`}`;
  if (state === 'before' || state === 'running') {
    return { next: shape.name, canStart: false, whyNot: startFromLine(cycle), line, counts: [], startsWith: [], readBack: null };
  }
  const goals = s.goals.filter((g) => g.cycleId === cycle.id && !g.removedAt && !g.stoppedAt);
  const rb = startReadBack({ cycle, next: { name: shape.name, firstDay: nd.firstDay, weeks: shape.weeks }, goals, checkIns: s.checkIns.filter((c) => !c.removedAt), retros: s.retros ?? [] });
  // What comes with the goals that carry on (rule 6), counted as carryExtras will make it.
  const going = new Set(goals.filter((g) => carries(rb.kinds.get(g.id)!)).map((g) => g.id));
  const openAsks = (s.requests ?? []).filter((r) => r.status === 'open' && r.goalIds.some((id) => goals.some((g) => g.id === id)));
  const extras = {
    asks: openAsks.filter((r) => r.goalIds.some((id) => going.has(id))).length,
    staying: openAsks.filter((r) => !r.goalIds.some((id) => going.has(id))).length,
    watches: (s.watches ?? []).filter((w) => !w.removedAt && (w.kind === 'goal' || w.kind === 'tree') && going.has(w.ref)).length,
    reviews: (s.reviews ?? []).filter((r) => !r.endedAt && !r.removedAt && [...r.scope.goals, ...r.scope.trees].some((id) => going.has(id))).length,
  };
  const counts = [
    { n: rb.carry, says: 'carry on', sub: rb.keep ? `${rb.keep} keep their plan and dates` : '' },
    { n: rb.finish, says: 'finish', sub: 'they met their target' },
    { n: rb.stop, says: 'stop', sub: 'their owners said so' },
    { n: rb.open, says: 'not wrapped up yet', sub: `${rb.openCarry} carry on as they are, ${rb.openFinish} finish` },
  ];
  const startsWith = [
    ...(rb.carried - rb.proposed ? [{ bold: n(rb.carried - rb.proposed, 'goal', 'goals'), rest: `, each with its key, owner, team, level and metric. A number goal starts from its final number, from week 1; its target is unchanged and due at the end of ${shape.name}.` }] : []),
    ...(rb.proposed ? [{ bold: `${n(rb.proposed, 'proposed goal carries', 'proposed goals carry')} as proposed`, rest: `, with nothing due until ${rb.proposed === 1 ? 'its owner makes it' : 'their owners make them'} active.` }] : []),
    ...(rb.stageGoals ? [{ bold: n(rb.stageGoals, 'goal with stages', 'goals with stages'), rest: ` carry the ${n(rb.stagesLeft, 'stage', 'stages')} not done, spread evenly over ${shape.name}. Their owners are asked to check the dates.` }] : []),
    ...(rb.loseParent ? [{ bold: `${n(rb.loseParent, 'goal loses its', 'goals lose their')} “Feeds into”`, rest: ', because the goal above finishes or stops.' }] : []),
    ...(extras.asks ? [{ bold: `${n(extras.asks, 'open next step or ask moves', 'open next steps and asks move')} with ${extras.asks === 1 ? 'its goal' : 'their goals'}.`, rest: extras.staying ? ` ${extras.staying} stay in ${cycle.name}, on goals that finish or stop.` : '' }] : []),
    ...(extras.watches ? [{ bold: `${n(extras.watches, 'watch follows', 'watches follow')} ${extras.watches === 1 ? 'its goal' : 'their goals'}`, rest: ', for the same people.' }] : []),
    ...(rb.handSet ? [{ bold: `${n(rb.handSet, 'goal sets its', 'goals set their')} weekly plan numbers by hand.`, rest: ` Those numbers were for ${cycle.name}; in ${shape.name} the plan is a straight line until the owner sets them again.` }] : []),
    ...(extras.reviews ? [{ bold: `${n(extras.reviews, 'review carries', 'reviews carry')} on`, rest: ` with the same people and days, on ${shape.name}’s goals.` }] : []),
    { bold: `Check-ins every week, due by ${WEEKDAYS[cycle.reviewDay]}`, rest: `, as in ${cycle.name}. The first are due ${dayWithYear(reviewDate(next as Cycle, 1))}.` },
  ];
  const whyNot = later ? `${later.name} has already been started.` : null;
  return { next: shape.name, canStart: !later, whyNot, line, counts: goals.length ? counts : [], startsWith: goals.length ? startsWith : [{ bold: `${shape.name} starts empty.`, rest: '' }], readBack: rb };
}

/** The read-back as text, for the AI tools: the line, the counts, and what the next year starts with. */
export function startPageText(p: StartPage): string {
  if (!p.readBack) return `${p.whyNot ?? ''} ${p.line}`.trim();
  const counts = p.counts.map((c) => `${c.n} ${c.says} (${c.sub})`).join('; ');
  return [p.line, counts ? `${counts}.` : '', `What ${p.next} starts with: ${p.startsWith.map((x) => x.bold + x.rest).join(' ')}`, p.whyNot ?? ''].filter(Boolean).join('\n');
}
