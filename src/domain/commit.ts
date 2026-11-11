/* One save: the records that leave draft, and the change-log entries that describe them. The rules (src/domain) make
   them and the stores (src/data) keep them, so the type lives with the rules: the rules layer never reaches into the
   data layer (scripts/check-layers.mjs). */
import type { ApiToken, Ask, SavedView, Change, CheckIn, Cycle, Decision, Feedback, Goal, Metric, MetricLink, Person, Retro, Review, Team, Watch } from './types';

/** One save: the records that leave draft, and the change-log entries that describe them. */
export interface Commit {
  people?: Person[];
  goals?: Goal[];
  checkIns?: CheckIn[];
  decisions?: Decision[];
  reviews?: Review[];
  retros?: Retro[];
  cycles?: Cycle[];
  feedback?: Feedback[];
  watches?: Watch[];
  /** Ids of watches to remove. */
  unwatch?: string[];
  tokens?: ApiToken[];
  views?: SavedView[];
  requests?: Ask[];
  /** Metrics added, changed or removed (domain/metrics). */
  metrics?: Metric[];
  /** Goals linked to a metric, relinked or unlinked (domain/metrics). */
  metricLinks?: MetricLink[];
  /** Teams added or changed. */
  teams?: Team[];
  /** Ids of teams to remove: emptied first, by the same save (domain/actions removeTeam). */
  removeTeams?: string[];
  /** The workspace's new name. */
  workspace?: { name: string };
  /** The workspace's recording switch (domain/actions setRecording): whether the app records how it is used there. */
  recording?: boolean;
  /** The feature modules switched off in the workspace, all of them (domain/actions setModules); the rest are on. */
  modulesOff?: string[];
  changes: Change[];
  /** What the save was based on; filled in by withExpectations. A save is refused if any of it has changed since. */
  expect?: Expectations;
}

export interface Expectations {
  goals: { id: string; version: number }[];
  reviews: { id: string; version: number }[];
  /** For each check-in written: the check-in that was there for that goal and week (null: none). */
  checkIns: { goalId: string; week: number; id: string | null }[];
}

