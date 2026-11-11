/* Starting the next year, in words (cycle-end spec 2.4 and rule 7): what the start page, Cycles and the AI tools say
   before and after an admin sets the next year up. The counts come from domain/carry's read-back, so what is said is
   what the start makes. Pure. */
import { carries, carryCopy, carryExtras, carryKind, startReadBack, type ReadBack } from './carry';
import type { Commit } from './commit';
import { cycleDates, cycleState, dayWithYear, laterCycle, nextCycleShape } from './cycle';
import { reviewDate } from './progress';
import type { Ask, Change, CheckIn, Cycle, Goal, MetricLink, Retro, Review, Watch } from './types';

/** The rows recarry reads: the cycles, goals, check-ins, change log and wrap-ups, and what comes with a goal. */
export interface CarryRows { cycles: Cycle[]; goals: Goal[]; checkIns: CheckIn[]; changes: Change[]; retros?: Retro[]; watches?: Watch[]; requests?: Ask[]; reviews?: Review[]; metricLinks?: MetricLink[] }

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
export interface StartRows { cycles: Cycle[]; goals: Goal[]; checkIns: CheckIn[]; retros?: Retro[]; requests?: Ask[]; watches?: Watch[]; reviews?: Review[]; metricLinks?: MetricLink[] }

export function startPage(s: StartRows, cycle: Cycle, today: Date): StartPage {
  const shape = nextCycleShape(cycle);
  const next = { ...cycle, ...shape };
  const nd = cycleDates(next), d = cycleDates(cycle);
  const state = cycleState(cycle, today);
  const later = laterCycle(s.cycles, cycle);
  const ended = state === 'ended' || state === 'closed';
  const line = `${shape.name} runs from ${dayWithYear(nd.firstDay)} to ${dayWithYear(nd.lastDay)}: ${shape.weeks} weeks. ${ended ? 'It opens for everyone as soon as you start it.' : `Everyone stays in ${cycle.name} until ${dayWithYear(d.lastDay)}, so the last check-ins and the wrap-up carry on.`}`;
  if (state === 'before' || state === 'running') {
    return { next: shape.name, canStart: false, whyNot: `${shape.name} can be started from ${dayWithYear(d.wrapUpOpens)}, when ${cycle.name}’s wrap-up opens.`, line, counts: [], startsWith: [], readBack: null };
  }
  const goals = s.goals.filter((g) => g.cycleId === cycle.id && !g.removedAt && !g.stoppedAt);
  const rb = startReadBack({ cycle, next: { name: shape.name, firstDay: nd.firstDay, weeks: shape.weeks }, goals, checkIns: s.checkIns, retros: s.retros ?? [] });
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
    ...(rb.carried ? [{ bold: n(rb.carried, 'goal', 'goals'), rest: `, each with its key, owner, team, level and metric. A number goal starts from its final number, from week 1; its target is unchanged and due at the end of ${shape.name}.` }] : []),
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

/**
 * Keeps a carried copy true after the start (cycle-end rule 6): when a goal of a year that has a later cycle gets a
 * check-in or a wrap-up, its kind is worked out again and, **only while its copy is untouched** (no check-in in it, no
 * change to it by a person since the start), the copy's plan or stages are replaced, the copy and what came with it are
 * removed (it now finishes or stops), or a copy is added with what comes with it (it now carries on). Nothing when the
 * copy has been used, or there is no later cycle. `extra` is what the change is about to save.
 */
export function recarry(goal: Goal, full: CarryRows, extra: { checkIns?: CheckIn[]; retro?: Retro | null }, x: { now: string; actorId: string; newId: (p: string) => string }): Commit | null {
  const cycle = full.cycles.find((c) => c.id === goal.cycleId);
  const later = cycle && laterCycle(full.cycles, cycle);
  if (!cycle || !later || !goal.key) return null;
  const copy = full.goals.find((g) => g.cycleId === later.id && g.key === goal.key && !g.removedAt);
  if (copy && !copyUntouched(copy, full)) return null;
  const checkIns = [...full.checkIns.filter((c) => !c.removedAt && !(extra.checkIns ?? []).some((e) => e.id === c.id)), ...(extra.checkIns ?? [])];
  const retro = extra.retro !== undefined ? extra.retro : (full.retros ?? []).find((r) => r.goalId === goal.id && r.cycleId === cycle.id) ?? null;
  const kind = carryKind(goal, { cycle, checkIns, retro }).kind;
  const log = (summary: string, id: string) => ({ id: x.newId('chg'), at: x.now, actorId: x.actorId, goalId: id, entity: 'goal' as const, entityId: id, action: 'edited' as const, summary, diffs: [] });
  if (carries(kind)) {
    const parentCopy = goal.parentId ? full.goals.find((g) => g.cycleId === later.id && !g.removedAt && g.key && g.key === full.goals.find((p) => p.id === goal.parentId)?.key) : undefined;
    const id = copy?.id ?? x.newId('goal');
    const made = carryCopy(goal, { old: cycle, next: later, checkIns, id, parentId: copy ? copy.parentId : parentCopy?.id ?? null, now: copy?.createdAt ?? x.now });
    if (copy) {
      if (JSON.stringify(sansVersion(made)) === JSON.stringify(sansVersion(copy))) return null;
      return { goals: [{ ...made, version: copy.version }], changes: [log(`${goal.title} in ${later.name} now starts from ${cycle.name}’s final number`, id)] };
    }
    const extras = carryExtras(new Map([[goal.id, id]]), full, x.newId);
    return { goals: [made], metricLinks: extras.metricLinks, watches: extras.watches, requests: extras.requests, reviews: extras.reviews, changes: [log(`${goal.title} carries on into ${later.name}`, id)] };
  }
  if (!copy) return null;
  const gone = { removedAt: x.now, removedBy: x.actorId };
  return {
    goals: [{ ...copy, ...gone }],
    watches: (full.watches ?? []).filter((w) => w.ref === copy.id && !w.removedAt).map((w) => ({ ...w, ...gone })),
    metricLinks: (full.metricLinks ?? []).filter((l) => l.goalId === copy.id && !l.removedAt).map((l) => ({ ...l, ...gone })),
    requests: (full.requests ?? []).filter((r) => r.goalIds.includes(copy.id)).map((r) => ({ ...r, goalIds: r.goalIds.filter((g) => g !== copy.id) })),
    reviews: (full.reviews ?? []).filter((r) => r.scope.goals.includes(copy.id) || r.scope.trees.includes(copy.id)).map((r) => ({ ...r, scope: { ...r.scope, goals: r.scope.goals.filter((g) => g !== copy.id), trees: r.scope.trees.filter((g) => g !== copy.id) } })),
    changes: [log(`${goal.title} ${kind === 'stop' ? 'stops' : 'finishes'} in ${cycle.name}, so it left ${later.name}`, copy.id)],
  };
}

/** A change recarry made on its own (not a person's), so it doesn't count as using the copy. */
export const byRecarry = (summary: string) => /now starts from .*’s final number$|carries on into /.test(summary);

const sansVersion = (g: Goal) => ({ ...g, version: undefined, createdAt: undefined });

/** Whether a carried copy is as the start made it: no check-in in it and no change to it by a person since. */
export function copyUntouched(copy: Goal, full: { checkIns: Pick<CheckIn, 'goalId' | 'removedAt'>[]; changes: Pick<Change, 'goalId' | 'at' | 'summary'>[] }): boolean {
  if (full.checkIns.some((c) => c.goalId === copy.id && !c.removedAt)) return false;
  return !full.changes.some((c) => c.goalId === copy.id && c.at > copy.createdAt && !byRecarry(c.summary));
}
