/* A goal's level, read from one place (round 3's workspace settings, CF1). Today every workspace has the same three,
   North star, SVP and Team; CF2 lets a workspace set their names, number and order on its cycle. Every rule, screen,
   export and tool asks here: which levels there are, top first, what one is called, which is the everyday one (left
   untagged), which is the top, and where one sorts. Nothing else names a level. Pure. */
import type { Cycle, Level, LevelDef } from './types';
import type { Words } from './columns';

export type { LevelDef };

/** Faro's three levels, top first: what a cycle has until it sets its own. */
export const DEFAULT_LEVELS: LevelDef[] = [
  { id: 'north-star', name: 'North star', hint: 'Reported at the top. You can have several.' },
  { id: 'svp', name: 'SVP', hint: 'Reported at SVP reviews.' },
  { id: 'team', name: 'Team', hint: 'Most goals. Flag SVP or North star only for goals reported at major reviews.' },
];

/** Whatever holds the levels: a cycle, or nothing (the defaults). */
export type LevelsOf = Pick<Cycle, 'levels'> | null | undefined;

const all = (c: LevelsOf): LevelDef[] => (c?.levels?.length ? c.levels : DEFAULT_LEVELS);

/** The live levels, top first. */
export const levelsOf = (c: LevelsOf): LevelDef[] => all(c).filter((l) => !l.removedAt);
/** The live levels' ids, top first. */
export const levelIds = (c: LevelsOf): Level[] => levelsOf(c).map((l) => l.id);
/** A level, live or removed, or null. */
export const levelDef = (c: LevelsOf, id: Level): LevelDef | null => all(c).find((l) => l.id === id) ?? null;
/** Whether an id is one of the live levels. */
export const isLevel = (c: LevelsOf, id: string): id is Level => levelsOf(c).some((l) => l.id === id);
/** What a level is called: its name (a removed level's too), or the id itself when it isn't known. */
export const levelName = (c: LevelsOf, id: Level): string => levelDef(c, id)?.name ?? id;
/** The everyday level: the last live one. Goals at it aren't tagged. */
export const everydayLevel = (c: LevelsOf): Level => levelIds(c).at(-1) ?? 'team';
export const isEveryday = (c: LevelsOf, id: Level): boolean => id === everydayLevel(c);
/** The top level, when there are two or more. */
export const isTop = (c: LevelsOf, id: Level): boolean => hasLevels(c) && levelIds(c)[0] === id;
/** Where a level sorts: its place, top first; removed or unknown levels after every live one. */
export const levelRank = (c: LevelsOf, id: Level): number => { const i = levelIds(c).indexOf(id); return i < 0 ? levelIds(c).length : i; };
/** Two or more live levels: with one, nothing is tagged or grouped by level. */
export const hasLevels = (c: LevelsOf): boolean => levelsOf(c).length >= 2;

/** The words a spreadsheet or a tool may use for each of Faro's three levels (the import reads them; CF2 makes them the workspace's names). */
export const LEVEL_WORDS: Words<Level> = { what: 'Level', word: { 'north-star': 'north star', svp: 'svp', team: 'team' }, also: { 'north-star': ['northstar', 'headline', 'north star goal'], svp: ['senior vp', 'senior'] }, prefix: { 'north-star': ['north'] } };

/** The everyday level's word in a spreadsheet: what an empty Level column means. */
export const EVERYDAY_WORD: string = LEVEL_WORDS.word[everydayLevel(null)] ?? everydayLevel(null);
