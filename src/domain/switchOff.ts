/* Switching off a feature that owns records (SW1: docs/design/feature-switches/spec.md 2.5 and 4.2): what the read-back
   an admin sees first counts and says, for Watching (its watches) and the Wrap-up (its wrap-ups). Counts only: nothing
   here changes anything, and every count is of what stays. Reviews' is src/domain/reviewsOff.ts. Its own file, read only
   by Workspace, which loads when it is opened (the first download). Each moves into its module's folder with SW6 and
   SW8. */
import type { Retro, Watch } from './types';

/** What switching Watching off keeps. */
export interface WatchingReadBack {
  /** People here with a live watch: their watches are kept. */
  people: number;
  /** Live watches (not stopped). */
  watches: number;
  /** Of those people, the ones who own no live goal: they see Home through what they watch. */
  seeThrough: number;
}

/**
 * Rule (SW1, spec 2.5). People with a live watch, the live watches, and of those people the ones who own no goal that
 * isn't removed or stopped. A watch on a goal since removed still counts: it is kept like any other.
 */
export function watchingOffReadBack(reads: {
  people: readonly { id: string; removedAt?: string | null; leftAt?: string | null }[];
  watches: readonly Pick<Watch, 'personId' | 'removedAt'>[];
  goals: readonly { ownerId: string; removedAt?: string | null; stoppedAt?: string | null }[];
}): WatchingReadBack {
  const here = new Set(reads.people.filter((p) => !p.removedAt && !p.leftAt).map((p) => p.id));
  const live = reads.watches.filter((w) => !w.removedAt && here.has(w.personId));
  const people = new Set(live.map((w) => w.personId));
  const owners = new Set(reads.goals.filter((g) => !g.removedAt && !g.stoppedAt).map((g) => g.ownerId));
  return { people: people.size, watches: live.length, seeThrough: [...people].filter((id) => !owners.has(id)).length };
}

const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

/** The read-back's lines (spec 4.2), each with a lead in bold: the first, fourth and last always; the people who own no
    goal only when there are any. `reviews` says whether Reviews is on ("and in its reviews"). */
export function watchingOffLines(r: WatchingReadBack, reviews: boolean): { strong: string; rest: string }[] {
  return [
    { strong: 'Watching leaves Goals, Home and every goal’s page', rest: ': the Watching tab, “Goals you watch” and the Watch button.' },
    { strong: `${r.people === 1 ? '1 person’s' : `${r.people} people’s`} ${n(r.watches, 'watch is', 'watches are')} kept.`, rest: ' Nobody is shown as watching while it is off.' },
    ...(r.seeThrough ? [{ strong: r.seeThrough === 1 ? '1 person owns no goal and sees Home through what they watch.' : `${r.seeThrough} people own no goal and see Home through what they watch.`, rest: ' Their Home will show every goal that needs attention instead.' }] : []),
    { strong: 'Goals don’t change.', rest: ` Each is still on its owner’s Home, in Goals${reviews ? ' and in its reviews' : ''}.` },
    { strong: '', rest: 'Nothing is deleted. Switch Watching back on and each person watches what they did.' },
  ];
}

/** Whether switching Watching off asks first: only when there is a watch to keep (spec 4.2). */
export const watchingAsks = (r: WatchingReadBack) => r.watches > 0;

/** What switching the Wrap-up off keeps. */
export interface WrapUpReadBack {
  /** Wrap-ups written in the running year, for goals not removed: they stay in each goal's History. */
  written: number;
  /** Of those, the ones that said stop. */
  stops: number;
  /** Whether the wrap-up is open now (cycle-end rule 1). */
  open: boolean;
  /** While it is open: the goals not wrapped up yet, which won't be asked for. */
  left: number;
  /** The next year's name ("2027"). */
  next: string;
}

/** Rule (SW1, spec 2.5). The running year's wrap-ups on goals not removed, those saying stop, and while it is open, the
    goals not removed or stopped with no wrap-up yet. */
export function wrapUpOffReadBack(reads: {
  retros: readonly Pick<Retro, 'goalId' | 'next'>[];
  goals: readonly { id: string; removedAt?: string | null; stoppedAt?: string | null }[];
  open: boolean;
  next: string;
}): WrapUpReadBack {
  const live = reads.goals.filter((g) => !g.removedAt);
  const ids = new Set(live.map((g) => g.id));
  const written = reads.retros.filter((r) => ids.has(r.goalId));
  const done = new Set(written.map((r) => r.goalId));
  return { written: written.length, stops: written.filter((r) => r.next === 'stop').length, open: reads.open, left: reads.open ? live.filter((g) => !g.stoppedAt && !done.has(g.id)).length : 0, next: reads.next };
}

/** The read-back's lines (spec 4.2): what leaves, what stays, and that the year still ends. */
export function wrapUpOffLines(r: WrapUpReadBack): { strong: string; rest: string }[] {
  return [
    { strong: 'The wrap-up leaves Home, Goals and Cycles.', rest: ` Owners aren’t asked how their goals landed.${r.open && r.left ? ` ${n(r.left, 'goal is', 'goals are')} not wrapped up yet and won’t be asked for.` : ''}` },
    ...(r.written ? [{ strong: `${n(r.written, 'wrap-up', 'wrap-ups')} already written ${r.written === 1 ? 'stays' : 'stay'}`, rest: ' in each goal’s History.' }] : []),
    ...(r.stops ? [{ strong: `${n(r.stops, 'goal was', 'goals were')} marked “Stop” at ${r.stops === 1 ? 'its' : 'their'} wrap-up`, rest: `, and ${r.stops === 1 ? 'it stops' : 'they stop'} when ${r.next} starts.` }] : []),
    { strong: 'The year still ends.', rest: ` Results are worked out as before, and an admin starts ${r.next} from Cycles.` },
  ];
}

/** Whether switching the Wrap-up off asks first: only with a wrap-up written, or while it is open (spec 4.2). */
export const wrapUpAsks = (r: WrapUpReadBack) => r.written > 0 || r.open;
