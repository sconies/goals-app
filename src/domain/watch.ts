/* Watching: which goals a set of picks covers (a goal, a goal and everything feeding it, a whole level), and which goals
   a person watches. A review uses the same picks for its scope; these were review.ts's until Reviews became a feature
   that can be switched off (FT2), since Watching never needs a review. */
import type { Goal, Level, Watch } from './types';

/** What Watching's rules read: the watches and the goals, never the whole workspace (AR4). */
export interface WatchRows { watches: readonly Watch[]; goals: Goal[] }

/** A goal and every goal feeding it, at any depth. */
export function treeOf(rootId: string, goals: Goal[]): Goal[] {
  const out: Goal[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    const g = goals.find((x) => x.id === id);
    if (!g || seen.has(id)) return;
    seen.add(id);
    out.push(g);
    for (const c of goals.filter((x) => x.parentId === id)) walk(c.id);
  };
  walk(rootId);
  return out;
}

/** The goals a set of picks covers: single goals, whole trees and whole levels, each once. */
export function goalsIn(scope: { goals: string[]; trees: string[]; levels: Level[] }, goals: Goal[]): Goal[] {
  const ids = new Set<string>([...scope.goals, ...scope.trees.flatMap((t) => treeOf(t, goals).map((g) => g.id))]);
  for (const g of goals) if (scope.levels.includes(g.level)) ids.add(g.id);
  return goals.filter((g) => ids.has(g.id));
}

/** What a person watches, as the same kind of scope a review uses. */
export function watchScope(personId: string, watches: readonly Watch[]) {
  const mine = watches.filter((w) => w.personId === personId);
  return {
    goals: mine.filter((w) => w.kind === 'goal').map((w) => w.ref),
    trees: mine.filter((w) => w.kind === 'tree').map((w) => w.ref),
    levels: mine.filter((w) => w.kind === 'level').map((w) => w.ref as Level),
  };
}

export function watchedGoals(personId: string, s: WatchRows): Goal[] {
  return goalsIn(watchScope(personId, s.watches), s.goals);
}

/** How a person is watching a goal, if they are: directly, through a tree, or through its level. */
export function watchOf(personId: string, goal: Goal, s: WatchRows): Watch | 'via' | null {
  const mine = s.watches.filter((w) => w.personId === personId);
  const direct = mine.find((w) => (w.kind === 'goal' || w.kind === 'tree') && w.ref === goal.id);
  if (direct) return direct;
  return goalsIn(watchScope(personId, s.watches), s.goals).some((g) => g.id === goal.id) ? 'via' : null;
}

/** The tree and level watches that cover a goal for a person, not counting a watch on the goal itself. */
export function coveringWatches(personId: string, goal: Goal, s: WatchRows): Watch[] {
  return s.watches.filter((w) => w.personId === personId && (
    (w.kind === 'level' && w.ref === goal.level) ||
    (w.kind === 'tree' && w.ref !== goal.id && treeOf(w.ref, s.goals).some((g) => g.id === goal.id))));
}
