/* Day one (app redesign OB3, docs/design/onboarding/spec.md rules 6 and 7): set-up's steps for the starting point
   chosen, and "Getting started" on Home: for each person in a workspace's first weeks, what is true and what to do
   first, the second person included. Pure: what a person has done is passed in as `facts`, kept per person and
   workspace behind the Prefs port (src/ports/prefs.ts). */
import type { Snapshot } from './types';

/** Set-up's steps, by the screen's id. */
export type SetupStep = 'workspace' | 'you' | 'team' | 'start' | 'outcome' | 'goals' | 'check';
const ALL: SetupStep[] = ['workspace', 'you', 'team', 'start', 'outcome', 'goals', 'check'];

/**
 * Rule 6. The steps for the starting point chosen: a template or "Start blank", all seven; "Set goals up later" or a
 * spreadsheet, five (no outcome and no goals: Check is "Step 5 of 5"). Before a choice, null: steps say "Step {n}".
 */
export function setupSteps(choice: string): SetupStep[] | null {
  if (!choice) return null;
  return choice === 'later' || choice === 'file' ? ALL.filter((s) => s !== 'outcome' && s !== 'goals') : ALL;
}

/** The counter for a step: "Step 5 of 5", or "Step 2" before the starting point is chosen. */
export function stepCounter(step: SetupStep, choice: string): string {
  const steps = setupSteps(choice);
  if (!steps) return `Step ${ALL.indexOf(step) + 1}`;
  return `Step ${steps.indexOf(step) + 1} of ${steps.length}`;
}

/** What a person has done in a workspace, kept per person and workspace (the Prefs port). */
export interface DayOneFacts {
  /** When they first opened this workspace. */
  firstSeenAt: string | null;
  /** "Hide this": the block doesn't come back. */
  hidden?: boolean;
  /** They copied the invitation link. */
  inviteCopied?: boolean;
  /** They opened the goals from "See the goals". */
  sawGoals?: boolean;
  /** Goals set-up made with no owner chosen (owned by whoever set up until one is). Kept for the person who set up. */
  unowned?: string[];
}

export interface DayOneRow {
  id: 'first-check-in' | 'assign' | 'invite' | 'add-people' | 'first-goal' | 'welcome' | 'see-goals' | 'watch' | 'own-goal';
  says: string;
  /** The button's words, and where it leads (none for welcome; the invite copies a link). */
  action?: string;
  to?: string;
}

/** The block shows for this long after a person's first visit. */
export const DAY_ONE_DAYS = 14;
/** A workspace older than this shows the block only to someone who arrived after it. */
export const NEW_WORKSPACE_DAYS = 28;

const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

/** Who set a workspace up: whoever its "Created …" change names, else its first admin. */
export function creatorOf(s: Pick<Snapshot, 'changes' | 'people'>): string | null {
  const made = s.changes.find((c) => c.entity === 'workspace' && c.action === 'created' && c.summary.startsWith('Created'));
  return made?.actorId ?? s.people.find((p) => p.admin)?.id ?? null;
}

/**
 * Rule 7. "Getting started" for one person: the rows that apply and aren't done, in order; nothing when they hid it,
 * 14 days after their first visit, in the example, or in a workspace more than 28 days old they didn't just join.
 * `ws` is the workspace's name, kind and when it was made; `due` the weekday the first check-ins are due by.
 */
export function gettingStarted(viewerId: string, s: Pick<Snapshot, 'people' | 'goals' | 'checkIns' | 'watches' | 'changes'>, ws: { name: string; kind: string; createdAt: string }, facts: DayOneFacts, now: Date, due: string): DayOneRow[] {
  if (ws.kind === 'example' || facts.hidden || !facts.firstSeenAt) return [];
  const t = now.getTime();
  if (t - Date.parse(facts.firstSeenAt) > DAY_ONE_DAYS * DAY) return [];
  const joinedLate = Date.parse(facts.firstSeenAt) - Date.parse(ws.createdAt) > NEW_WORKSPACE_DAYS * DAY;
  if (t - Date.parse(ws.createdAt) > NEW_WORKSPACE_DAYS * DAY && !joinedLate) return [];
  const creator = creatorOf(s);
  const mine = s.goals.filter((g) => g.ownerId === viewerId && !g.removedAt && !g.stoppedAt);
  const noCheckIn = mine.filter((g) => !s.checkIns.some((c) => c.goalId === g.id && !c.removedAt));
  const rows: DayOneRow[] = [];
  const firstCheckIn = (): DayOneRow => ({ id: 'first-check-in', says: noCheckIn.length === 1 ? `Post your first check-in. It’s due by ${due}.` : `Post your first check-ins. They’re due by ${due}.`, action: 'Start check-in', to: '/check-in' });
  if (viewerId === creator) {
    if (noCheckIn.length) rows.push(firstCheckIn());
    const unowned = (facts.unowned ?? []).filter((id) => s.goals.some((g) => g.id === id && g.ownerId === viewerId && !g.removedAt && !g.stoppedAt));
    if (unowned.length) rows.push({ id: 'assign', says: `Give ${n(unowned.length, 'goal', 'goals')} an owner.`, action: 'Choose owners', to: '/goals?show=mine&view=table' });
    const alone = s.people.filter((p) => !p.leftAt && !p.removedAt).length < 2;
    if (alone) rows.push({ id: 'add-people', says: 'Add the people who own goals.', action: 'Add people', to: '/people' });
    else if (!facts.inviteCopied) rows.push({ id: 'invite', says: `Send your team the link to ${ws.name}.`, action: 'Copy the link' });
    if (!s.goals.some((g) => !g.removedAt && !g.stoppedAt)) rows.push({ id: 'first-goal', says: 'Set up the first goal.', action: 'New goal', to: '/goals/new' });
    return rows;
  }
  // Someone added by someone else: who set it up and what's theirs, then what to do first.
  const setter = s.people.find((p) => p.id === creator)?.name;
  if (setter) rows.push({ id: 'welcome', says: `${setter} set up ${ws.name} on ${shortDate(ws.createdAt)}${mine.length ? ` and gave you ${n(mine.length, 'goal', 'goals')}` : ''}.` });
  if (noCheckIn.length) rows.push(firstCheckIn());
  if (!mine.length) {
    if (!facts.sawGoals) rows.push({ id: 'see-goals', says: `See what ${ws.name} is working towards.`, action: 'See the goals', to: '/goals' });
    if (!(s.watches ?? []).some((w) => w.personId === viewerId && !w.removedAt)) rows.push({ id: 'watch', says: 'Watch the goals you care about, and they’ll show here.', action: 'Find goals to watch', to: '/goals' });
    rows.push({ id: 'own-goal', says: 'Set up a goal of your own, in about 3 minutes.', action: 'New goal', to: '/goals/new' });
  }
  return rows;
}
