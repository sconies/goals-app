/* Day one (app redesign OB3, docs/design/onboarding/spec.md rule 7; set-up spec rule S1): set-up's four steps, and "Getting started" on Home: for each person in a workspace's first weeks, what is true and what to do
   first, the second person included. Pure: what a person has done is passed in as `facts`, kept per person and
   workspace behind the Prefs port (src/ports/prefs.ts). */
import type { Change, Goal, Person } from './types';

/** Set-up's steps, by their address under /workspace/new/ (set-up spec rule S1, small workspaces rule 3). */
export type SetupStep = 'workspace' | 'people' | 'goals' | 'check';
/** Always these four: "how you'll work" is a sheet on the first step and on Check, not a step. */
export const SETUP_STEPS: readonly SetupStep[] = ['workspace', 'people', 'goals', 'check'];
export const isSetupStep = (s: string | undefined): s is SetupStep => !!s && (SETUP_STEPS as readonly string[]).includes(s);

/** The counter for a step: "Step 4 of 4" on Check, whatever way to start was chosen. */
export function stepCounter(step: SetupStep): string {
  return `Step ${SETUP_STEPS.indexOf(step) + 1} of ${SETUP_STEPS.length}`;
}

/** How a workspace's goals start, chosen on the Goals step: added here, from a spreadsheet, or by each owner later. */
export type SetupStart = 'own' | 'file' | 'later';
/** The choice a draft holds; a draft from before (a template's id, or "blank") counts as "Add your own". */
export const startOf = (choice: string | undefined): SetupStart => (choice === 'file' || choice === 'later' ? choice : 'own');

/** What `firstUnfilled` reads from a draft. */
export interface SetupAnswers { name: string; me: { name: string; email: string; team: string }; start: string | undefined; goals: number; file: boolean }

/**
 * Rule S1. The first step whose required answers are missing: `workspace` (a name, and you), else `goals` (no goal
 * added, or "Import a spreadsheet" with no file read; "Later" needs nothing), else null. A later step's address opened
 * before then goes to it.
 */
export function firstUnfilled(a: SetupAnswers): SetupStep | null {
  if (!a.name.trim() || !a.me.name.trim() || !a.me.email.trim() || !a.me.team.trim()) return 'workspace';
  const start = startOf(a.start);
  if ((start === 'own' && !a.goals) || (start === 'file' && !a.file)) return 'goals';
  return null;
}

/** A draft's step. One kept from before set-up had four steps (seven, numbered from 0) opens at the step its answers moved to. */
const OLD_STEPS: SetupStep[] = ['workspace', 'workspace', 'people', 'goals', 'goals', 'goals', 'check'];
export function draftStep(d: { step?: number; v?: number }): SetupStep {
  const list = d.v === 2 ? SETUP_STEPS : OLD_STEPS;
  return list[Math.min(Math.max(d.step ?? 0, 0), list.length - 1)]!;
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

/**
 * Who set a workspace up: whoever its "Created …" change names, else its first admin. Set-up writes that change as
 * `imported` (`createWorkspace`, src/app/state.tsx); `created` is read too, for a log written by another tool.
 */
export function creatorOf(changes: Pick<Change, 'entity' | 'action' | 'summary' | 'actorId'>[], people: Pick<Person, 'id' | 'admin'>[]): string | null {
  const made = changes.find((c) => c.entity === 'workspace' && (c.action === 'imported' || c.action === 'created') && c.summary.startsWith('Created'));
  return made?.actorId ?? people.find((p) => p.admin)?.id ?? null;
}

/** What "Getting started" reads (AR4): made from the loaded workspace by src/app/reads.ts (`dayOneRows`). */
export interface DayOneRows {
  /** Who set the workspace up (`creatorOf`). */
  creatorId: string | null;
  people: Pick<Person, 'id' | 'name' | 'leftAt' | 'removedAt'>[];
  goals: Pick<Goal, 'id' | 'ownerId' | 'removedAt' | 'stoppedAt'>[];
  /** The goals with a check-in not removed. */
  checkedIn: ReadonlySet<string>;
  /** The people watching a goal (a watch not removed). */
  watchers: ReadonlySet<string>;
  /** The cycle's last day is past (cycle-end rule 2): nothing is due, so no first check-in is asked for. */
  ended?: boolean;
  /** Watching is switched off (SW1): no row asks anyone to watch goals. */
  watching?: boolean;
}

/**
 * Rule 7. "Getting started" for one person: the rows that apply and aren't done, in order; nothing when they hid it,
 * 14 days after their first visit, in the example, or in a workspace more than 28 days old they didn't just join.
 * `ws` is the workspace's name, kind and when it was made; `due` the weekday the first check-ins are due by (null with
 * no set rhythm: then nothing is due).
 */
export function gettingStarted(viewerId: string, s: DayOneRows, ws: { name: string; kind: string; createdAt: string }, facts: DayOneFacts, now: Date, due: string | null): DayOneRow[] {
  if (ws.kind === 'example' || facts.hidden || !facts.firstSeenAt) return [];
  const t = now.getTime();
  if (t - Date.parse(facts.firstSeenAt) > DAY_ONE_DAYS * DAY) return [];
  const joinedLate = Date.parse(facts.firstSeenAt) - Date.parse(ws.createdAt) > NEW_WORKSPACE_DAYS * DAY;
  if (t - Date.parse(ws.createdAt) > NEW_WORKSPACE_DAYS * DAY && !joinedLate) return [];
  const creator = s.creatorId;
  const mine = s.goals.filter((g) => g.ownerId === viewerId && !g.removedAt && !g.stoppedAt);
  const noCheckIn = s.ended ? [] : mine.filter((g) => !s.checkedIn.has(g.id));
  const rows: DayOneRow[] = [];
  const firstCheckIn = (): DayOneRow => ({ id: 'first-check-in', says: due == null
    // No set rhythm (FT1): nothing is due, so the row says what the first check-in is for.
    ? (noCheckIn.length === 1 ? 'Post your first check-in, so everyone can see where it starts.' : 'Post your first check-ins, so everyone can see where each starts.')
    : noCheckIn.length === 1 ? `Post your first check-in. It’s due by ${due}.` : `Post your first check-ins. They’re due by ${due}.`, action: 'Start check-in', to: '/check-in' });
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
    if (s.watching !== false && !s.watchers.has(viewerId)) rows.push({ id: 'watch', says: 'Watch the goals you care about, and they’ll show here.', action: 'Find goals to watch', to: '/goals' });
    rows.push({ id: 'own-goal', says: 'Set up a goal of your own, in about 3 minutes.', action: 'New goal', to: '/goals/new' });
  }
  return rows;
}

/* ---------- Welcome and the arrival (set-up spec ST1: 2.1, 2.8, rules S4 and S9) ---------- */

/**
 * Rule S4's `arrived`: a person has arrived when the log has their arrival (a change on the person, `acknowledged`,
 * written once when they first choose their name on the arrival screen). Whoever set the workspace up has arrived.
 * It reads the log as it is: no column and no new action word, so no migration.
 */
export function arrived(personId: string, changes: Pick<Change, 'entity' | 'action' | 'entityId' | 'summary' | 'actorId'>[], people: Pick<Person, 'id' | 'admin'>[]): boolean {
  return creatorOf(changes, people) === personId || changes.some((c) => c.entity === 'person' && c.action === 'acknowledged' && c.entityId === personId);
}

/** The arrival's entry in the log, as rule S4 words it. */
export const arrivalSummary = (name: string, ws: string) => `${name} opened ${ws} for the first time`;

/** Rule S9's link: the address an invitation opens, `{origin}{/demo}/join/{id}`. */
export const inviteLink = (origin: string, mode: string, wsId: string) => `${origin}${mode === 'demo' ? '/demo' : ''}/join/${encodeURIComponent(wsId)}`;

/**
 * The workspace an address invites someone to, if any: `/join/<id>` (under `/demo` in the demo), or the link `/ready`
 * copied before, `/?workspace=<id>`, which now leads to `/join/<id>`.
 */
export function invitedTo(pathname: string, search: string): string | null {
  const m = /^(?:\/demo)?\/join\/([^/?#]+)\/?$/.exec(pathname);
  if (m) { try { return decodeURIComponent(m[1]!); } catch { return m[1]!; } }
  const q = new URLSearchParams(search).get('workspace');
  return q || null;
}
