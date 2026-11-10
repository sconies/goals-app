/* Bulk changes: the one way in for a spreadsheet, set-up from a spreadsheet, the bulk check-in grid, table actions, the
   data tables and the AI assistant's bulk_change. parse → validate → preview → apply → log. Every row is checked with the
   same rules as the app's own forms (validateGoal, buildGoal, evaluate, toCheckIn, personProblems, and domain/removal for
   a row's Action), and nothing is saved until the whole set is valid.

   The columns are the one format's (domain/columns.ts). Rows find their record by a goal's key, then its ID; a person
   by their email, then (when only one person has it) their name; a team by its name. Columns a row leaves out keep what
   the record says, and worked-out columns are never read. Every column that can be changed counts: a change to any of
   them is applied, or said to be a problem, never quietly dropped. Set-up uses the same engine in "create" mode: an
   empty workspace, and every row is new. */
import type { Commit } from './commit';
import type { ActionContext } from './actions';
import { NotAllowed } from './actions';
import { goalChange, checkInChange, type Lookup } from './changes';
import { evaluate, MIN_REASON, MISSING_TEXT, parseNumber, toCheckIn, VALUE_CODES, valueProblem, type Draft, type Missing } from './checkin';
import {
  BOUND_WORDS, CALL_WORDS, CAUSE_WORDS, codeOf, GOAL_ACTION_WORDS, LEVEL_WORDS, oneOf, PERSON_ACTION_WORDS, RECOVERY_WORDS, SHAPE_WORDS, TYPE_WORDS, unknownWord, YES_WORDS,
  type Words,
} from './columns';
import { blankGoal, buildGoal, draftOf, goalAsOf, planChanged, planHint, planQuestion, replanned, validateGoal, type GoalDraft } from './goal';
import { notNumberText, precisionProblem, typedDecimals } from './numbers';
import { findGoal, formatKey, isKey, lastKey, normalKey } from './goalKey';
import { isEmail, normalEmail, personChange, personProblems, sameNameNote, sameTitleNote } from './people';
import { planAt, planEnd, weekDate } from './plan';
import { checkInsFor } from './status';
import { makesLoop } from './tree';
import { asksOf, requestsAfterCheckIn } from './asks';
import { deleteGoal, markPersonLeft, stopGoal } from './removal';
import { recordsOf, parseDelimited, type Rec, type Tables } from './sheets';
import type { Ask, Change, CheckIn, Cycle, Diff, Goal, MetricGoal, MetricPlan, Person, Review, Snapshot, StageUpdate, Status, Team } from './types';
import { FLAG, LEFT, lower, STOPPED } from './vocabulary';

export type { Rec, Tables } from './sheets';
export type Via = 'spreadsheet' | 'bulk' | 'mcp' | 'table' | 'setup';
export const VIA_LABEL: Record<Via, string> = { spreadsheet: 'Spreadsheet', bulk: 'Bulk edit', mcp: 'MCP', table: 'Data tables', setup: 'Set-up' };
/** What changes through MCP were marked before backlog 10a (9 Nov): still read as MCP, never written. */
export const VIA_MCP_BEFORE = 'AI assistant (MCP)';
/** The Via mark every change through MCP carries ("via MCP"), on top of its own diffs. */
export const VIA_MCP = { field: 'Via', from: '—', to: VIA_LABEL.mcp } as const;

export type Sheet = 'Goals' | 'Plan' | 'Check-ins' | 'People';
/** A problem to fix (error), something to check (warning), or how a row was read (note: an owner matched by name). */
export interface Issue { sheet: Sheet; row: number; goal: string; message: string; severity: 'error' | 'warning' | 'note' }
export type ItemKind = 'new goal' | 'goal' | 'plan' | 'check-in' | 'replaces check-in' | 'person' | 'new person' | 'team' | 'stop goal' | 'delete goal' | 'person left';
export interface Item {
  sheet: Sheet;
  row: number;
  goalId: string;
  /** What the change is to: a goal's name, or a person's or team's. */
  goal: string;
  kind: ItemKind;
  summary: string;
  diffs: Diff[];
  backfilled?: boolean;
  /** A plan change after check-ins started: it needs a reason. */
  needsReason?: boolean;
  /** A plan change that must be confirmed before it's saved (goal planQuestion): what it asks, and the yes. */
  question?: { text: string; confirm: string };
}
export interface ChangeSet {
  items: Item[];
  unchanged: number;
  issues: Issue[];
  /** Some plan changes need a reason and none was given. */
  needsReason: boolean;
  /** Some plan changes ask a question (a direction flip, a number far outside the old plan) and weren't confirmed. */
  needsConfirm: boolean;
  /** Ready to save: null while there are errors or a reason is missing. */
  commit: Commit | null;
  counts: { newGoals: number; goals: number; plans: number; checkIns: number; backfilled: number; replaced: number; people: number; newPeople: number; teams: number; stopped: number; deleted: number; left: number };
  /** Create mode: everything the new workspace starts with (set-up reads it). */
  created?: Pick<Snapshot, 'people' | 'teams' | 'goals' | 'checkIns' | 'requests' | 'keysIssued'>;
}

export interface ChangeInput {
  tables: Tables;
  snapshot: Snapshot;
  cycle: Cycle;
  week: number;
  /** Who is making the change. In create mode, the first person in the file (whoever is setting up) acts. */
  actor: Person;
  /** Now, as an ISO timestamp. */
  now: string;
  /** A new ID. The hint (a name or title) lets set-up make readable ones. */
  newId: (prefix: string, hint?: string) => string;
  via: Via;
  /** One reason for every plan change that needs one (a row's own Reason column wins). */
  reason?: string;
  /** Yes to every plan question (goal planQuestion) the change asks, once the person has seen them. */
  confirm?: boolean;
  /** "update" (the default): change the workspace. "create": set one up from nothing, every row new. */
  mode?: 'update' | 'create';
  /** The whole workspace, for what a row's Action reaches past this cycle (domain/removal). */
  full?: Snapshot;
}

/* ---------- reading files ---------- */

/** Delimited text (a CSV, a paste) as records keyed by lower-case header, with the sheet's row number. */
export const records = (text: string): Rec[] => recordsOf(parseDelimited(text));

/* ---------- helpers ---------- */

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const has = (r: Rec, k: string) => Object.prototype.hasOwnProperty.call(r, k);
const val = (r: Rec, k: string) => (r[k] ?? '').trim();
/** A reference cell (a team, an owner, what it feeds): a dash on its own means none. */
const ref = (r: Rec, k: string) => { const v = val(r, k); return /^[—–-]$/.test(v) ? '' : v; };
const rowOf = (r: Rec, i: number) => Number(r.__row ?? i + 2);
const blankRow = (r: Rec) => Object.entries(r).every(([k, v]) => k === '__row' || !String(v).trim());
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** "4 new goals, 2 goals changed, 38 check-ins (36 for past weeks), 1 goal stopped" */
export function describe(cs: ChangeSet): string {
  const c = cs.counts;
  const parts = [
    c.newPeople && plural(c.newPeople, 'new person', 'new people'),
    c.people && `${plural(c.people, 'person', 'people')} changed`,
    c.teams && `${plural(c.teams, 'team')} changed`,
    c.newGoals && plural(c.newGoals, 'new goal'),
    c.goals && `${plural(c.goals, 'goal')} changed`,
    c.plans && `${plural(c.plans, 'plan')} changed`,
    c.checkIns && `${plural(c.checkIns, 'check-in')}${c.backfilled ? ` (${c.backfilled} for past weeks)` : ''}`,
    c.replaced && `${c.replaced} replaced`,
    c.stopped && `${plural(c.stopped, 'goal')} ${lower({ label: STOPPED })}`,
    c.deleted && `${plural(c.deleted, 'goal')} deleted`,
    c.left && `${plural(c.left, 'person', 'people')} ${lower({ label: LEFT })}`,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'No changes';
}

/** A word cell read with its column's words: the code, null for empty, or a problem for a word it doesn't know. */
function word<C extends string>(w: Words<C>, raw: string): { code: C | null; problem?: string } {
  const c = codeOf(w, raw);
  return c === undefined ? { code: null, problem: unknownWord(w, raw) } : { code: c };
}

/* ---------- the change set ---------- */

export function planChanges(input: ChangeInput): ChangeSet {
  const { snapshot: s, cycle, week, now, newId, via } = input;
  const create = input.mode === 'create';
  const issues: Issue[] = [];
  const items: Item[] = [];
  let unchanged = 0;
  const err = (sheet: Sheet, row: number, goal: string, message: string) => issues.push({ sheet, row, goal, message, severity: 'error' });
  const warn = (sheet: Sheet, row: number, goal: string, message: string) => issues.push({ sheet, row, goal, message, severity: 'warning' });
  const note = (sheet: Sheet, row: number, goal: string, message: string) => issues.push({ sheet, row, goal, message, severity: 'note' });
  const changes: Change[] = [];

  /* ---------- people and teams first, so a goal row can name someone this same file adds ---------- */
  const people = new Map<string, Person>(s.people.map((p) => [p.id, p]));
  const teams = new Map<string, Team>(s.teams.map((t) => [t.id, t]));
  const teamNamed = (name: string) => [...teams.values()].find((t) => norm(t.name) === norm(name));
  const byEmail = (e: string) => [...people.values()].find((p) => normalEmail(p.email) === e);
  const named = (n: string) => [...people.values()].filter((p) => norm(p.name) === norm(n));
  const peopleTouched = new Map<string, { before: Person | null; row: number }>();
  const teamsTouched = new Map<string, { before: Team | null; row: number }>();
  // In create mode the first person in the file is whoever is setting up: the workspace's first admin, and the actor.
  let actor = input.actor;
  const admin = () => create || actor.admin;

  /** Who a person-cell names: an email, an ID, or a name only one person has. */
  const personFrom = (kind: 'email' | 'id' | 'name', v: string): { p?: Person; problem?: string; byName?: boolean } => {
    if (kind === 'email' || (kind === 'name' && v.includes('@'))) {
      const e = normalEmail(v);
      if (!isEmail(e)) return { problem: `“${v}” isn’t an email.` };
      const p = byEmail(e);
      return p ? { p } : { problem: `No one here has the email ${e}. Add them on the People sheet or under Workspace first, or check it.` };
    }
    if (kind === 'id') { const p = people.get(v); return p ? { p } : { problem: `There’s no person with ID ${v}.` }; }
    const list = named(v);
    if (list.length > 1) return { problem: `${list.length} people are called “${list[0]!.name}”. Use their email instead (${list.map((p) => p.email || p.id).join(' or ')}).` };
    if (list.length) return { p: list[0]!, byName: true };
    const p = people.get(v);
    return p ? { p } : { problem: `“${v}” isn’t in this workspace. Add them under Workspace first, or check the spelling.` };
  };
  /**
   * The person a row's columns name (an email, an ID, a name), against who it is now. Only the columns that say someone
   * else count, so a name edited beside an email left as it was is the change; two that name different people are a
   * problem. Undefined: nothing says anything new.
   */
  const pickPerson = (r: Rec, cols: { email?: string; id?: string; name?: string }, current: Person | null, what: string): { person?: Person; problem?: string; byName?: string } => {
    const given = (Object.entries(cols) as ['email' | 'id' | 'name', string][]).filter(([, c]) => has(r, c) && ref(r, c)).map(([k, c]) => [k, ref(r, c)] as const);
    const says = (k: 'email' | 'id' | 'name', v: string) => !!current && (k === 'email' ? normalEmail(current.email) === normalEmail(v) : k === 'id' ? current.id === v : norm(current.name) === norm(v) || current.id === v || (v.includes('@') && normalEmail(current.email) === normalEmail(v)));
    let changed = given.filter(([k, v]) => !says(k, v));
    if (!changed.length) return {};
    // An email or ID is exact: a name beside it that's theirs agrees with it, even when others share that name.
    const exact = changed.filter(([k]) => k !== 'name').map(([k, v]) => personFrom(k, v).p).find(Boolean);
    if (exact) changed = changed.filter(([k, v]) => k !== 'name' || norm(v) !== norm(exact.name));
    const found = changed.map(([k, v]) => ({ k, v, ...personFrom(k, v) }));
    const bad = found.find((x) => x.problem);
    if (bad) return { problem: bad.problem };
    const ids = new Set(found.map((x) => x.p!.id));
    if (ids.size > 1) return { problem: `${what} and ${what} email name different people (${found.map((x) => x.p!.name).join(' and ')}). Change just one of them.` };
    const byName = found.every((x) => x.byName) ? found[0]!.v : undefined;
    return { person: found[0]!.p!, byName };
  };
  const matchedByName = new Set<string>();
  const sayByName = (sheet: Sheet, row: number, goal: string, name: string, p: Person) => {
    if (matchedByName.has(p.id)) return;
    matchedByName.add(p.id);
    note(sheet, row, goal, `“${name}” matched by name: ${p.name}${p.email ? ` (${p.email})` : ''}. An email column is exact.`);
  };

  const leaving: { person: Person; row: number; to: Person }[] = [];
  (input.tables.people ?? []).forEach((r, i) => {
    const row = rowOf(r, i);
    if (blankRow(r)) return;
    const name = val(r, 'name');
    const email = normalEmail(val(r, 'email'));
    const action = word(PERSON_ACTION_WORDS, val(r, 'action'));
    if (action.problem) return err('People', row, name || email, action.problem);
    // Which person: their ID; else their email; else a name only one person has. In create mode, everyone is new.
    const id = create ? '' : val(r, 'id');
    let before: Person | undefined;
    // How the row found them: by ID or by a name, its Email column can give them a new (or a first) email.
    let emailSets = false;
    if (id) { before = people.get(id); emailSets = true; if (!before) return err('People', row, name || email, `There’s no person with ID ${id}. Leave ID empty to add someone.`); }
    else if (!create) {
      before = email ? byEmail(email) : undefined;
      if (!before && name) {
        // Someone added before emails existed is found by their name (when only they have it), and given this email.
        const list = named(name).filter((p) => !email || !p.email);
        if (list.length > 1) return err('People', row, name, `${list.length} people are called “${name}”. Add their email or ID to say which.`);
        before = list[0];
        emailSets = !!before;
      }
    }
    if (before && peopleTouched.has(before.id)) return err('People', row, before.name, `${before.name} has another row in this file. Give each person one row.`);
    if (create && email && byEmail(email)) return err('People', row, name, `${byEmail(email)!.name} already has the email ${email}: each person needs their own.`);

    const teamName = has(r, 'team') ? ref(r, 'team') : null;
    let tm = teamName ? teamNamed(teamName) : undefined;
    if (teamName && !tm) {
      if (!create) return err('People', row, name || before?.name || '', `There’s no team called “${teamName}”. Add it under Workspace first, or check the spelling.`);
      tm = { id: newId('team', teamName), name: teamName, leadId: '', objective: '' };
      teams.set(tm.id, tm);
      teamsTouched.set(tm.id, { before: null, row });
    }
    const adminWord = has(r, 'admin') ? word(YES_WORDS, val(r, 'admin')) : null;
    if (adminWord?.problem) return err('People', row, name || before?.name || '', `Admin should be yes or no, not “${val(r, 'admin')}”.`);

    if (action.code === 'left') {
      if (!before) return err('People', row, name || email, `${LEFT} needs someone already here: their email or ID.`);
      if (!admin()) return err('People', row, before.name, 'Only an admin can mark someone as left.');
      const to = pickPerson(r, { email: 'takes over' }, null, 'Takes over');
      if (to.problem) return err('People', row, before.name, `Takes over: ${to.problem}`);
      leaving.push({ person: before, row, to: to.person ?? before });
      return;
    }
    if (!before) {
      // Someone new: an admin adds them, with a name, an email and a team.
      if (!admin()) return err('People', row, name, 'Only an admin can add people.');
      if (!name) return err('People', row, email, 'Add their name.');
      // A name someone here (or an earlier row) already has: allowed, as the email is who someone is (backlog N), and said,
      // so a second row for one person is noticed. Said before the email is asked for, so it's on the row from the start.
      { const same = sameNameNote({ id: '', name }, [...people.values()], (tid) => teams.get(tid)?.name ?? ''); if (same) note('People', row, name, same); }
      if (!email) return err('People', row, name, `Add ${name}’s email: everyone new needs one.`);
      const p: Person = { id: newId('p', name), name, role: val(r, 'job title'), initials: initialsOf(name), teamId: tm?.id ?? null, admin: adminWord?.code === 'yes', email };
      if (create && !people.size) { p.admin = true; actor = p; }
      if (!p.teamId && create) return err('People', row, name, `${name} has no team.`);
      people.set(p.id, p);
      peopleTouched.set(p.id, { before: null, row });
      // A new team's first person leads it, except at set-up, which never asks who leads a team: Workspace said "Led by"
      // someone nobody chose (deep review U7). There a team has no lead until an admin picks one under Teams.
      if (tm && !tm.leadId && via !== 'setup') teams.set(tm.id, { ...teams.get(tm.id)!, leadId: p.id });
      objective(r, row, p);
      return;
    }
    const nextName = has(r, 'name') && name ? name : before.name;
    const after: Person = {
      ...before, name: nextName, initials: nextName === before.name ? before.initials : initialsOf(nextName),
      role: has(r, 'job title') ? val(r, 'job title') : before.role,
      teamId: teamName == null ? before.teamId : tm?.id ?? null,
      admin: adminWord == null ? before.admin : adminWord.code === 'yes',
      // Matched by ID or name, the Email column can change their email; matched by email, it is that email.
      ...(emailSets && has(r, 'email') && email ? { email } : {}),
    };
    if (emailSets && has(r, 'email') && !email && before.email) return err('People', row, before.name, 'Their email can be changed, not taken away. Type it back in.');
    objective(r, row, after);
    if (JSON.stringify(after) === JSON.stringify(before)) { unchanged++; return; }
    if (!admin()) return err('People', row, before.name, 'Only an admin can change people.');
    people.set(before.id, after);
    peopleTouched.set(before.id, { before, row });
  });
  /** A Team objective cell: the team's objective, said on its lead's row (where empty clears it); any other row may set it. */
  function objective(r: Rec, row: number, p: Person) {
    if (!has(r, 'team objective') || !p.teamId) return;
    const t = teams.get(p.teamId);
    const v = val(r, 'team objective');
    if (!t || (t.leadId !== p.id && !v) || t.objective === v) return;
    if (!admin()) { err('People', row, p.name, 'Only an admin can change a team’s objective.'); return; }
    if (!teamsTouched.has(t.id)) teamsTouched.set(t.id, { before: t, row });
    teams.set(t.id, { ...t, objective: v });
  }
  for (const [id, t] of peopleTouched) {
    const after = people.get(id)!;
    const problems = personProblems(after, [...people.values()], t.before);
    if (problems.length) err('People', t.row, t.before?.name ?? after.name, problems.join(' '));
    // Renamed to a name someone else has: allowed (the email is who someone is, backlog N), and said. (A new person with
    // one is said where their row is read.)
    if (t.before && norm(t.before.name) !== norm(after.name)) {
      const same = sameNameNote(after, [...people.values()], (tid) => teams.get(tid)?.name ?? '');
      if (same) note('People', t.row, after.name, same);
    }
  }
  if (create && !people.size && (input.tables.people ?? []).length && !issues.length) err('People', 1, '', 'Add at least one person.');

  /* ---------- goals ---------- */
  const team = (name: string) => teamNamed(name);
  // The working set: goals as they will be after this change, by id. Wherever a goal's ID is asked for, its key will do.
  const work = new Map<string, Goal>(s.goals.map((g) => [g.id, g]));
  // Set-up from another workspace's export: its IDs are that workspace's, so they're mapped to the new goals' IDs.
  const fileIds = new Map<string, string>();
  const goalByRef = (r: string) => (r ? work.get(fileIds.get(r) ?? r) ?? findGoal([...work.values()], r) : undefined);
  /** The goal a row says: its key first (a goal carried into this cycle keeps its key, not its ID), then its ID. */
  const goalOf = (keyRef: string, id: string) => goalOfRow(keyRef, id).g;
  /** The same, with a problem when the key and the ID name different goals (an ID from another cycle is just passed over). */
  const goalOfRow = (keyRef: string, id: string): { g?: Goal; problem?: string } => {
    const byKey = keyRef ? goalByRef(normalKey(keyRef) ?? keyRef) : undefined;
    const byId = id ? goalByRef(id) : undefined;
    if (byId && keyRef && byKey?.id !== byId.id) return { problem: `Key ${normalKey(keyRef) ?? keyRef} isn’t this goal’s key (${byId.key ?? 'none'}). A goal’s key never changes.` };
    return { g: byKey ?? byId };
  };
  // A stopped goal (domain/removal) is in a whole-cycle export, marked Stopped; loaded back, its rows are left alone.
  const stoppedByRef = (r: string) => (r && !goalByRef(r) ? findGoal(s.archive?.goals ?? [], r) : undefined);
  const warnedStopped = new Set<string>();
  const leftAlone = (sheet: Sheet, row: number, g: Goal) => {
    unchanged++;
    if (!warnedStopped.has(g.id)) { warnedStopped.add(g.id); warn(sheet, row, g.title, `“${g.title}” is ${lower({ label: STOPPED })}, so its rows are left as they are.`); }
  };
  // New goals take the next keys, in the order of their rows; no key is used twice in a workspace. In create mode a
  // goal keeps the key the file gives it, so the new workspace's keys match the file.
  const fileKeys = create ? (input.tables.goals ?? []).map((r) => normalKey(val(r, 'key'))).filter((k): k is string => !!k) : [];
  let lastKeyGiven = Math.max(lastKey(s.goals, s.keysIssued), ...fileKeys.map((k) => Number(k.replace(/\D/g, ''))), 0);
  const touched = new Map<string, { before: Goal | null; row: number; sheet: Sheet; reason: string; plan: boolean }>();
  const started = (id: string) => s.checkIns.some((c) => c.goalId === id);
  const canChange = (g: Goal) => admin() || g.ownerId === actor.id;
  const notYours = (g: Goal) => `Only ${people.get(g.ownerId)?.name ?? 'its owner'} (its owner) or an admin can change “${g.title}”.`;
  const parentLinks: { id: string; row: number; r: Rec }[] = [];
  const removals: { g: Goal; how: 'stop' | 'delete'; reason: string; row: number }[] = [];
  const keysSeen = new Set<string>();

  (input.tables.goals ?? []).forEach((r, i) => {
    const row = rowOf(r, i);
    if (blankRow(r)) return;
    const id = val(r, 'id');
    const keyRef = val(r, 'key');
    const title = val(r, 'goal');
    const action = word(GOAL_ACTION_WORDS, val(r, 'action'));
    if (action.problem) return err('Goals', row, title || keyRef || id, action.problem);
    if (keyRef && !isKey(keyRef)) return err('Goals', row, title || keyRef, `Key “${keyRef}” should look like G-12.`);
    let existing: Goal | null = null;
    if (create) {
      if (action.code) return err('Goals', row, title, `${GOAL_ACTION_WORDS.word[action.code]} is for a goal already in a workspace; leave Action empty when setting one up.`);
      const k = normalKey(keyRef);
      if (k && keysSeen.has(k)) return err('Goals', row, title, `Key ${k} is on two rows. Each goal has its own key.`);
      if (k) keysSeen.add(k);
    } else {
      const stopped = stoppedByRef(keyRef) ?? stoppedByRef(id);
      if (stopped && !goalOf(keyRef, id)) return leftAlone('Goals', row, stopped);
      const found = goalOfRow(keyRef, id);
      if (found.problem) return err('Goals', row, title || keyRef, found.problem);
      existing = found.g ?? null;
      if (keyRef && !existing) return err('Goals', row, title || keyRef, `There’s no goal with key ${normalKey(keyRef)} in ${cycle.name}. Leave Key and ID empty to add a new goal.`);
      if (id && !existing) return err('Goals', row, title || id, `There’s no goal with ID ${id} in ${cycle.name}. Leave ID empty to add a new goal.`);
      if (existing && touched.has(existing.id)) return err('Goals', row, existing.title, `“${existing.title}” has another row in this file. Give each goal one row.`);
    }
    if (!existing) {
      if (!title) return err('Goals', row, '', 'Name the goal in the Goal column.');
      const same = [...work.values()].find((g) => norm(g.title) === norm(title));
      // Two teams can both have "Reduce latency" (backlog N): a new row for another team is a new goal, noted below. The same
      // title for the same team (or no team) is far more often the same goal again without its key, so that's asked.
      const rowTeam = ref(r, 'team') ? teamNamed(ref(r, 'team')) : undefined;
      if (same && (!rowTeam || rowTeam.id === same.teamId)) return err('Goals', row, title, `A goal called “${same.title}” already exists${rowTeam ? ' in ' + rowTeam.name : ''}. Put its key in the Key column to change it, give this one another name, or name another team in Team.`);
    }
    const label = title || existing?.title || '';
    const currentOwner = existing ? people.get(existing.ownerId) ?? null : null;
    const own = pickPerson(r, { email: 'owner email', id: 'owner id', name: 'owner' }, currentOwner, 'Owner');
    if (own.problem) return err('Goals', row, label, own.problem);
    const owner = own.person ?? currentOwner;
    if (own.person && own.byName) sayByName('Goals', row, label, own.byName, own.person);
    if (!existing && !owner) return err('Goals', row, title, 'A new goal needs an owner: Owner email, or Owner.');
    if (!existing && owner && !admin() && owner.id !== actor.id) return err('Goals', row, title, 'You can add goals you own. Ask an admin to add goals for other people.');
    const teamName = ref(r, 'team');
    const tm = teamName ? team(teamName) : null;
    if (teamName && !tm) return err('Goals', row, label, `There’s no team called “${teamName}”.`);

    const d: GoalDraft = existing ? draftOf(existing) : blankGoal(tm?.id ?? owner?.teamId ?? [...teams.values()][0]?.id ?? '', owner!.id, '');
    if (title) d.title = title;
    if (owner) d.ownerId = owner.id;
    if (tm) d.teamId = tm.id;
    const lvl = word(LEVEL_WORDS, val(r, 'level'));
    if (lvl.problem) return err('Goals', row, label, lvl.problem);
    if (lvl.code) d.level = lvl.code;
    const kind = word(TYPE_WORDS, val(r, 'type'));
    if (kind.problem) return err('Goals', row, label, kind.problem);
    if (kind.code) {
      if (existing && kind.code !== existing.kind) return err('Goals', row, d.title, 'A goal’s type can’t change. Add a new goal instead.');
      d.kind = kind.code;
    }
    if (!existing && !kind.code) d.kind = 'metric';
    if (has(r, 'unit') && d.kind !== 'milestone') d.unit = val(r, 'unit');
    if (val(r, 'decimals')) d.decimals = val(r, 'decimals');
    else if (!existing && d.kind !== 'milestone') d.decimals = String(Math.min(3, Math.max(0, ...['start', 'target', 'limit'].map((k) => typedDecimals(val(r, k))))));
    if (val(r, 'start')) d.start = val(r, 'start');
    if (val(r, 'target')) d.target = val(r, 'target');
    const shape = word(SHAPE_WORDS, val(r, 'plan'));
    if (shape.problem) return err('Goals', row, d.title, shape.problem);
    if (shape.code && shape.code !== d.shape) { d.shape = shape.code; d.points = {}; }
    if (has(r, 'plan from week') && d.kind === 'metric' && val(r, 'plan from week')) {
      const n = parseNumber(val(r, 'plan from week'));
      if (n == null || !Number.isInteger(n) || n < -104 || n > 104) return err('Goals', row, d.title, 'Plan from week should be a whole number of weeks from the cycle start.');
      const cur = existing?.kind === 'metric' ? existing.plan.fromWeek ?? 0 : null;
      if (cur == null || n !== cur) d.fromWeek = String(n);
    }
    if (has(r, 'due week') && d.kind === 'metric') {
      const w = val(r, 'due week');
      const n = parseNumber(w);
      if (w && (n == null || !Number.isInteger(n) || n < 1 || n > 104)) return err('Goals', row, d.title, 'Due week should be a whole number of weeks from the cycle start, up to 104.');
      d.endWeek = w && n !== cycle.weeks ? String(n) : '';
    }
    if (d.fromWeek != null && d.kind === 'metric') {
      const end = parseNumber(d.endWeek) ?? cycle.weeks;
      if (Number(d.fromWeek) >= end) return err('Goals', row, d.title, `Plan from week (${d.fromWeek}) has to come before the due week (${end}).`);
    }
    if (val(r, 'limit')) d.limit = val(r, 'limit');
    const bound = word(BOUND_WORDS, val(r, 'must stay'));
    if (bound.problem) return err('Goals', row, d.title, bound.problem);
    if (bound.code) d.bound = bound.code;
    if (val(r, 'margin')) d.margin = val(r, 'margin');
    if (val(r, 'stages')) {
      d.stages = val(r, 'stages').split(/;|\n/).map((x) => x.trim()).filter(Boolean).map((x, k) => {
        const m = /^(.*?)\s*@\s*(?:wk|week)?\s*(\d+)\s*$/i.exec(x);
        const name = m ? m[1]!.trim() : x;
        const old = existing?.kind === 'milestone' ? existing.stages.find((st) => norm(st.name) === norm(name)) : undefined;
        return { id: old?.id ?? 's' + (k + 1) + '-' + newId('st').slice(-4), name, dueWeek: m ? m[2]! : '' };
      });
    }
    if (has(r, 'why it helps')) d.whyHelps = val(r, 'why it helps');
    if (has(r, 'effect')) d.effect = val(r, 'effect');
    if (has(r, 'source')) d.source = val(r, 'source');
    if (has(r, 'definition')) d.definition = val(r, 'definition');
    const errs = Object.values(validateGoal(d, cycle, existing));
    if (errs.length) return err('Goals', row, d.title, errs.join(' '));
    const hint = planHint(d);
    // Two goals may share a title (two teams can both "Reduce latency"): a new one that does is noted, never refused.
    if (!existing) {
      const twin = sameTitleNote(d.title, null, s.goals.filter((g) => g.cycleId === cycle.id && !g.removedAt), (t) => teams.get(t)?.name ?? '');
      if (twin) note('Goals', row, d.title, twin);
    }
    // Asked, never refused; and only once: a goal already set up this way isn't asked again on every import.
    if (hint && (!existing || planHint(draftOf(existing)) !== hint)) note('Goals', row, d.title, hint);

    const gid = existing?.id ?? newId('goal', d.title);
    if (create && id) fileIds.set(id, gid);
    const key = existing ? existing.key : (create && normalKey(keyRef)) || formatKey(++lastKeyGiven);
    parentLinks.push({ id: gid, row, r });
    let built = buildGoal({ ...d, parentId: existing?.parentId ?? '' }, cycle, { id: gid, createdAt: existing?.createdAt ?? new Date(Date.parse(now) + i).toISOString() }, existing, started(gid), week);
    if (existing) built = { ...existing, ...built } as Goal;
    if (key) built = { ...built, key };
    if (existing && d.whyHelps === '' && 'whyHelps' in built) delete (built as { whyHelps?: string }).whyHelps;
    // A row that stops or deletes a goal says only that: its other columns must say what the goal says now.
    if (action.code) {
      if (existing && goalChange(existing, built, lookupNow(), actor.id, now, 'x')) return err('Goals', row, existing.title, `A row that says ${GOAL_ACTION_WORDS.word[action.code]} can’t also change the goal. Make the change, or the ${GOAL_ACTION_WORDS.word[action.code].toLowerCase()}, on its own.`);
      parentLinks.pop();
      removals.push({ g: existing!, how: action.code, reason: val(r, 'reason'), row });
      return;
    }
    work.set(gid, built);
    touched.set(gid, { before: existing, row, sheet: 'Goals', reason: val(r, 'reason') || val(r, 'reason for change'), plan: !!existing && planChanged(existing, built) });
  });
  function lookupNow(): Lookup {
    return { person: (pid) => people.get(pid), goal: (gid) => work.get(gid), teamName: (tid) => teams.get(tid)?.name ?? tid };
  }

  // What each goal feeds, once every goal in the file exists: Feeds into key, Feeds into ID or Feeds into (a name). Only
  // the columns that say something new count, so an edited name beside a key left as it was is the change.
  for (const l of parentLinks) {
    const g = work.get(l.id)!;
    const before = touched.get(l.id)?.before ?? null;
    const current = before?.parentId ? work.get(before.parentId) ?? null : null;
    const cols = (['feeds into key', 'feeds into id', 'feeds into'] as const).filter((c) => has(l.r, c));
    const says = (c: string, v: string) => (!current ? v === '' : c === 'feeds into key' ? normalKey(v) === current.key : c === 'feeds into id' ? v === current.id || fileIds.get(v) === current.id : norm(v) === norm(current.title));
    const changed = cols.map((c) => [c, ref(l.r, c)] as const).filter(([c, v]) => !(before && says(c, v)) && (before || v));
    if (!changed.length) continue;
    const found = changed.map(([c, v]) => {
      if (!v) return { c, p: null as Goal | null };
      if (c === 'feeds into') {
        const list = [...work.values()].filter((x) => norm(x.title) === norm(v) && x.id !== l.id);
        if (list.length > 1) return { c, problem: `Several goals are called “${v}”. Use Feeds into key to say which.` };
        return list[0] ? { c, p: list[0] } : { c, problem: `“${g.title}” feeds into “${v}”, which isn’t a goal in ${cycle.name}.` };
      }
      const p = goalByRef(c === 'feeds into key' ? normalKey(v) ?? v : v);
      return p ? { c, p } : { c, problem: `${c === 'feeds into key' ? 'Feeds into key' : 'Feeds into ID'} ${v} isn’t a goal in ${cycle.name}.` };
    });
    const bad = found.find((x) => 'problem' in x && x.problem);
    if (bad && 'problem' in bad) { err('Goals', l.row, g.title, bad.problem!); continue; }
    const ids = new Set(found.map((x) => ('p' in x ? x.p?.id ?? '' : '')));
    if (ids.size > 1) { err('Goals', l.row, g.title, 'Feeds into and Feeds into key name different goals. Change just one of them.'); continue; }
    const parentId = [...ids][0] || null;
    if (parentId === l.id) { err('Goals', l.row, g.title, 'A goal can’t feed into itself.'); continue; }
    if (parentId && makesLoop(l.id, parentId, [...work.values()])) { err('Goals', l.row, g.title, 'That link would make a loop: the goal it feeds already feeds into it.'); continue; }
    const next = { ...g, parentId } as Goal;
    if (!parentId) { next.effect = null; delete next.whyHelps; }
    else {
      // Why it helps and the effect belong to the link: a goal given one now takes them from its row.
      const why = has(l.r, 'why it helps') ? val(l.r, 'why it helps') : g.whyHelps ?? '';
      if (why) next.whyHelps = why; else delete next.whyHelps;
      if (has(l.r, 'effect')) next.effect = parseNumber(val(l.r, 'effect'));
    }
    work.set(l.id, next);
  }

  /* ---------- plan numbers ---------- */
  (input.tables.plan ?? []).forEach((r, i) => {
    const row = rowOf(r, i);
    if (blankRow(r)) return;
    const keyRef = val(r, 'key'), idRef = val(r, 'id');
    if (!keyRef && !idRef) { if (val(r, 'goal')) err('Plan', row, val(r, 'goal'), 'Add the goal’s key or ID so the plan can be matched to it.'); return; }
    const found = goalOfRow(keyRef, idRef);
    if (found.problem) return err('Plan', row, val(r, 'goal') || keyRef, found.problem);
    const g = found.g;
    if (!g) {
      const stopped = stoppedByRef(keyRef) ?? stoppedByRef(idRef);
      if (stopped) return leftAlone('Plan', row, stopped);
      return err('Plan', row, val(r, 'goal') || keyRef || idRef, keyRef ? `There’s no goal with key ${normalKey(keyRef) ?? keyRef}.` : `There’s no goal with ID ${idRef}.`);
    }
    const id = g.id;
    if (g.kind !== 'metric') return err('Plan', row, g.title, 'Only number goals have plan numbers.');
    // Compared with the plan as it was before this file, so a Goals row's new target isn't undone by the Plan sheet's
    // old numbers: only the weeks typed differently from the plan before count.
    const orig = (touched.get(id)?.before ?? s.goals.find((x) => x.id === id) ?? g) as MetricGoal;
    const origEnd = planEnd(orig.plan, cycle.weeks);
    const tol = 0.5 * 10 ** -g.decimals;
    const startTyped = val(r, 'start') ? parseNumber(val(r, 'start')) : null;
    if (val(r, 'start') && startTyped == null) return err('Plan', row, g.title, `Start: ${notNumberText(val(r, 'start'), g.decimals)}`);
    const startPrecise = val(r, 'start') ? precisionProblem(val(r, 'start'), startTyped, g.decimals) : null;
    if (startPrecise) return err('Plan', row, g.title, `Start: ${startPrecise}`);
    const typed = new Map<number, number>();
    for (const [k, v] of Object.entries(r)) {
      const m = /^week (\d+)$/.exec(k);
      if (!m || !String(v).trim()) continue;
      const n = parseNumber(String(v));
      if (n == null) return err('Plan', row, g.title, `Week ${m[1]}: ${notNumberText(String(v), g.decimals)}`);
      const precise = precisionProblem(String(v), n, g.decimals);
      if (precise) return err('Plan', row, g.title, `Week ${m[1]}: ${precise}`);
      const w = Number(m[1]);
      const was = w <= (orig.plan.fromWeek ?? 0) || w > origEnd ? null : w === origEnd ? orig.plan.target : planAt(orig.plan, w, cycle.weeks);
      if (was == null || Math.abs(n - was) > tol) typed.set(w, n);
    }
    const startChanged = startTyped != null && Math.abs(startTyped - orig.plan.start) > tol;
    if (!typed.size && !startChanged) { if (!touched.has(id)) unchanged++; return; }
    if (removals.some((x) => x.g.id === id)) return err('Plan', row, g.title, `This file also stops or deletes “${g.title}”, so its plan can’t change in it.`);
    if (!create && !canChange(g)) return err('Plan', row, g.title, notYours(g));
    const from = g.plan.fromWeek ?? 0, end = planEnd(g.plan, cycle.weeks);
    const outside = [...typed.keys()].filter((w) => w <= from || w > end);
    if (outside.length) return err('Plan', row, g.title, `Week ${outside[0]} is outside the plan, which runs from week ${from + 1} to week ${end}. Change Plan from week or Due week on Goals first.`);
    const start = startChanged ? startTyped! : g.plan.start;
    const target = typed.get(end) ?? g.plan.target;
    if (target === start) return err('Plan', row, g.title, 'The target has to differ from the start.');
    const kept = new Map((g.plan.points ?? []).map((p) => [p.week, p.value]));
    for (const [w, v] of typed) if (w < end) kept.set(w, v);
    // Hand-set weeks are stored with every checkpoint, the rest at the plan's own numbers, as the plan editor does.
    const points = typed.size ? [...new Set([...kept.keys(), ...Array.from({ length: end - from - 1 }, (_, k) => from + 1 + k)])].filter((w) => w > from && w < end).sort((a, b) => a - b)
      .map((w) => ({ week: w, value: kept.get(w) ?? Number(planAt(g.plan, w, cycle.weeks).toFixed(g.decimals + 2)) })) : g.plan.points ?? [];
    const plan: MetricPlan = { ...g.plan, start, target, ...(points.length ? { points } : {}) };
    const before = touched.get(id)?.before ?? s.goals.find((x) => x.id === id) ?? null;
    const next: MetricGoal = { ...g, plan, ...(before?.kind === 'metric' ? replanned(before, plan, started(id), week) : {}) };
    work.set(id, next);
    const t = touched.get(id);
    touched.set(id, { before, row: t?.row ?? row, sheet: t?.sheet ?? 'Plan', reason: t?.reason || val(r, 'reason'), plan: !!before });
  });

  /* ---------- goals: what changed, and the reasons plan changes need ---------- */
  const lookup = lookupNow();
  const goalOut = new Map<string, Goal>();
  let needsReason = false;
  let needsConfirm = false;
  for (const [id, t] of touched) {
    const after = work.get(id)!;
    const ch = goalChange(t.before, after, lookup, actor.id, now, newId('chg'));
    if (!ch) { unchanged++; continue; }
    // Rows for other people's goals are fine as long as they don't change anything (a full workbook carries them all).
    if (t.before && !canChange(t.before)) { err(t.sheet, t.row, t.before.title, notYours(t.before)); continue; }
    const needs = !!t.before && t.plan && planChanged(t.before, after) && started(id);
    const reason = t.reason || input.reason?.trim() || '';
    if (needs && !reason) needsReason = true;
    if (needs && reason) ch.diffs.push({ field: 'Why', from: '—', to: reason });
    // A direction flip or a number far outside the old plan is confirmed, never saved silently (goal planQuestion).
    const q = planQuestion(t.before, after);
    if (q && !input.confirm) needsConfirm = true;
    goalOut.set(id, after);
    changes.push(ch);
    items.push({ sheet: t.sheet, row: t.row, goalId: id, goal: after.title, kind: !t.before ? 'new goal' : needs || (t.plan && planChanged(t.before, after)) ? 'plan' : 'goal', summary: ch.summary, diffs: ch.diffs, needsReason: needs, ...(q ? { question: { text: q.text, confirm: q.confirm } } : {}) });
  }

  /* ---------- check-ins ---------- */
  const ciOut: CheckIn[] = [];
  // What each check-in written replaced (null: it's new), so the import can be undone (domain/removal undoImport).
  const ciBefore = new Map<string, CheckIn | null>();
  const seen = new Set<string>();
  const rows = (input.tables.checkIns ?? []).map((r, i) => ({ r, row: rowOf(r, i) }));
  const byTitle = (t: string) => { const l = [...work.values()].filter((g) => norm(g.title) === norm(t)); return l.length === 1 ? l[0] : undefined; };
  const goalFor = (r: Rec) => (val(r, 'goal key') || val(r, 'goal id') ? goalOf(val(r, 'goal key'), val(r, 'goal id')) : byTitle(val(r, 'goal')));
  // This file's check-ins so far, by goal: later weeks are judged with the earlier ones.
  const imported = new Map<string, CheckIn[]>();
  // Oldest first, so each week is judged with the weeks before it.
  rows.sort((a, b) => (goalFor(a.r)?.id ?? '').localeCompare(goalFor(b.r)?.id ?? '') || (parseNumber(val(a.r, 'week')) ?? 0) - (parseNumber(val(b.r, 'week')) ?? 0));
  for (const { r, row } of rows) {
    if (blankRow(r)) continue;
    const g = goalFor(r);
    const refText = val(r, 'goal key') || val(r, 'goal id');
    const clash = refText ? goalOfRow(val(r, 'goal key'), val(r, 'goal id')).problem : undefined;
    if (clash) { err('Check-ins', row, val(r, 'goal') || refText, clash.replace(/^Key/, 'Goal key')); continue; }
    const name = val(r, 'goal') || refText;
    const stopped = !g ? (stoppedByRef(val(r, 'goal key')) ?? stoppedByRef(val(r, 'goal id')) ?? (s.archive?.goals ?? []).find((x) => norm(x.title) === norm(val(r, 'goal')))) : undefined;
    if (stopped) { leftAlone('Check-ins', row, stopped); continue; }
    if (!g) { err('Check-ins', row, name, refText ? `There’s no goal with ${val(r, 'goal key') ? `key ${val(r, 'goal key')}` : `ID ${refText}`}.` : `There’s no goal called “${val(r, 'goal')}”${[...work.values()].filter((x) => norm(x.title) === norm(val(r, 'goal'))).length > 1 ? ' that only one goal has' : ''}. Add the Goal key column to be exact.`); continue; }
    const w = parseNumber(val(r, 'week'));
    if (w == null || !Number.isInteger(w) || w < 1) { err('Check-ins', row, g.title, w === 0 ? 'Check-ins start in week 1; week 0 is the start of the year.' : 'Week should be a whole number from 1, counted from the start of the year.'); continue; }
    if (w > week) { err('Check-ins', row, g.title, `Week ${w} hasn’t happened yet; it’s week ${week}.`); continue; }
    // The check-in's own ID, when the row has one, says exactly which check-in it is: it never changes, nor does its goal
    // or week. Set-up starts afresh: another workspace's IDs mean nothing here.
    const cid = create ? '' : val(r, 'id');
    const byId = cid ? s.checkIns.find((c) => c.id === cid) : undefined;
    if (cid && (!byId || byId.goalId !== g.id)) { err('Check-ins', row, g.title, `There’s no check-in with ID ${cid} on this goal. Leave ID empty to add a check-in.`); continue; }
    if (byId && byId.week !== w) { err('Check-ins', row, g.title, `Check-in ${cid} is for week ${byId.week}; a check-in’s week can’t change.`); continue; }
    const key = cid || g.id + ':' + w;
    if (seen.has(key)) { err('Check-ins', row, g.title, cid ? `Check-in ${cid} appears twice.` : `Week ${w} appears twice for this goal.`); continue; }
    seen.add(key);

    // A row for a week corrects that week's latest check-in (a spreadsheet has one row per goal and week). Columns the
    // row leaves out (a table showing only some) keep what that check-in says.
    const existing = byId ?? checkInsFor(g, s.checkIns).filter((c) => c.week === w).pop() ?? null;
    const ctx = [...checkInsFor(g, s.checkIns).filter((c) => c.week !== w), ...(imported.get(g.id) ?? [])];
    const prev = checkInsFor(g, ctx).filter((c) => c.week < w).pop() ?? null;
    let stages: StageUpdate[] = [];
    if (g.kind === 'milestone') {
      stages = has(r, 'stages') || !existing?.stages
        ? g.stages.map((st) => prev?.stages?.find((u) => u.stageId === st.id) ?? { stageId: st.id, doneWeek: null, forecastWeek: null })
        : existing.stages;
      let bad = '';
      for (const part of (has(r, 'stages') ? val(r, 'stages') : '').split(/;|\n/).map((x) => x.trim()).filter(Boolean)) {
        const m = /^(.*?):\s*(done|expected|due)\s*(?:week|wk)?\s*(\d+)$/i.exec(part);
        const st = m && g.stages.find((x) => norm(x.name) === norm(m[1]!));
        if (!m || !st) { bad = part; break; }
        const n = Number(m[3]);
        stages = stages.map((u) => (u.stageId !== st.id ? u : m[2]!.toLowerCase() === 'done' ? { ...u, doneWeek: n, forecastWeek: null } : m[2]!.toLowerCase() === 'expected' ? { ...u, doneWeek: null, forecastWeek: n } : { ...u, doneWeek: null, forecastWeek: null }));
      }
      if (bad) { err('Check-ins', row, g.title, `Stages: “${bad}” should look like “Pilot: done week 6” or “Pilot: expected week 8”, using the stage’s name.`); continue; }
    }
    const callW = word(CALL_WORDS, val(r, 'call'));
    if (callW.problem) { err('Check-ins', row, g.title, `${callW.problem} Or leave it empty to let the rules decide.`); continue; }
    const call: Status | null = callW.code;
    const causeW = has(r, 'cause') ? word(CAUSE_WORDS, val(r, 'cause')) : { code: existing?.cause ?? null };
    if (causeW.problem) { err('Check-ins', row, g.title, causeW.problem); continue; }
    const recW = has(r, 'recovery') ? word(RECOVERY_WORDS, val(r, 'recovery')) : { code: existing?.pathToGreen?.state ?? null };
    if (recW.problem) { err('Check-ins', row, g.title, recW.problem); continue; }
    const pick = (col: string, was: string | null | undefined) => (has(r, col) ? val(r, col) : (was ?? '').trim());
    const byRaw = has(r, 'back on plan by week') ? val(r, 'back on plan by week') : '';
    const by = has(r, 'back on plan by week') ? parseNumber(byRaw) : existing?.pathToGreen?.byWeek ?? null;
    if (byRaw && by == null) { err('Check-ins', row, g.title, `Back on plan by week: “${byRaw}” isn’t a week.`); continue; }
    const valueRaw = g.kind === 'milestone' ? '' : has(r, 'value') ? val(r, 'value') : existing?.value != null ? String(existing.value) : '';
    const draft: Draft = {
      value: valueRaw,
      stages, status: call, cause: causeW.code ?? null,
      why: pick('why', existing?.why), greenerWhy: pick('why greener', existing?.greenerWhy), proposeTarget: '',
      ptgWhat: pick('path to green', existing?.pathToGreen?.what), ptgBy: by, ptgState: recW.code ?? 'plan', needs: pick('needs', existing?.pathToGreen?.needs),
      next: has(r, 'next step') ? val(r, 'next step') : has(r, 'next') ? val(r, 'next') : (existing?.next ?? '').trim(), dataFlagged: false,
    };
    // A row that says what's already there is left alone: history that hasn't changed isn't judged again. Every column
    // that can be changed is compared, so a change to any of them counts.
    if (existing && sameCheckIn(existing, draft, g)) { unchanged++; imported.set(g.id, [...(imported.get(g.id) ?? []), existing]); continue; }
    // A goal this file stops or deletes keeps its check-ins as they are: a whole workbook carries them unchanged.
    const removing = removals.find((x) => x.g.id === g.id);
    if (removing) { err('Check-ins', row, g.title, `This file also says ${GOAL_ACTION_WORDS.word[removing.how]} for “${g.title}”, so its check-ins can’t change in it. Make the change, or the ${GOAL_ACTION_WORDS.word[removing.how].toLowerCase()}, on its own.`); continue; }
    if (!create && !canChange(g)) { err('Check-ins', row, g.title, notYours(g)); continue; }
    // A week before the plan was changed is judged against the plan that applied then.
    const asOf: Goal = goalAsOf(g, w);
    const e = evaluate(asOf, cycle, w, draft, ctx);
    // Setting up from another workspace's export, its history is a record: a past week whose account the new plan would
    // ask more of (a cause and a why) is taken as it was written, as long as it says what every check-in must (a path
    // back when the call is behind, a reason when the call is better than the numbers). Its number has to be a number.
    const recorded = create && w < week && !e.canPost && e.codes.every((c) => c === 'reason-behind' || c === 'reason-ahead' || c === 'target' || c === 'path' || c === 'greener-why')
      ? asWritten(asOf, w, draft, e, actor.id, now, 'probe') : null;
    const asRecorded = !!recorded && keepsTheRules(recorded);
    if (asRecorded) note('Check-ins', row, g.title, `Week ${w} is taken as it was recorded.`);
    if (!e.canPost && !asRecorded) {
      // The same codes the check-in screens read, said in the spreadsheet's own column names.
      const hint: Record<Missing, string> = {
        value: 'a Value', 'value-not-number': 'a number in Value', 'value-precision': 'a Value at the goal’s decimal places', 'value-impossible': 'a possible Value',
        'greener-why': `Why greener (the call is ${lower(FLAG.greener)})`,
        'reason-behind': `a Cause and a Why of ${MIN_REASON} characters or more (it’s behind plan)`, 'reason-ahead': `a Cause and a Why of ${MIN_REASON} characters or more (it’s ahead of plan)`,
        path: `a Path to green and, if it’s a plan, Back on plan by week (after week ${w}, by week ${cycle.weeks})`,
        'story-unchanged': MISSING_TEXT['story-unchanged'],
        target: MISSING_TEXT.target,
      };
      // A number that isn't one, or has more decimal places than the goal keeps, gets the same words as on screen.
      // A number that can't be used gets the same words as on screen: the one number check (deep review U10).
      const typedValue = g.kind !== 'milestone' && e.codes[0] && e.codes[0] !== 'value' && VALUE_CODES.includes(e.codes[0]) ? valueProblem(draft.value, null, g.unit, g)?.text ?? null : null;
      err('Check-ins', row, g.title, typedValue ? `Week ${w}: ${typedValue}` : `Week ${w} needs ${e.codes.map((c) => hint[c]).join('; ')}.`);
      continue;
    }
    const backfilled = w < week;
    const due = new Date(Date.parse(weekDate(cycle, w) + 'T09:00:00Z') + cycle.reviewDay * 86_400_000);
    const at = backfilled && due.toISOString() < now ? due : new Date(now);
    const made = asRecorded ? asWritten(asOf, w, draft, e, actor.id, at.toISOString(), existing?.id ?? newId('ci')) : toCheckIn(asOf, cycle, w, draft, ctx, actor.id, at, existing?.id ?? newId('ci'));
    const c: CheckIn = { ...made, ...(backfilled ? { backfilled: true } : {}) };
    const ch = checkInChange(existing, c, g, actor.id, newId('chg'));
    if (!ch) { unchanged++; continue; }
    if (existing && existing.authorId !== actor.id) warn('Check-ins', row, g.title, `Replaces ${people.get(existing.authorId)?.name ?? 'someone'}’s check-in for week ${w}.`);
    ch.at = now;
    if (backfilled) ch.summary += ' (loaded later)';
    ciBefore.set(c.id, existing);
    ciOut.push(c);
    imported.set(g.id, [...(imported.get(g.id) ?? []), c]);
    changes.push(ch);
    items.push({ sheet: 'Check-ins', row, goalId: g.id, goal: g.title, kind: existing ? 'replaces check-in' : 'check-in', summary: ch.summary, diffs: ch.diffs, backfilled });
  }

  /* ---------- asks: a goal's latest check-in raises, continues or withdraws its ask, as in the app (domain/asks) ---------- */
  const reqOut = new Map<string, Ask>();
  const requestsNow = () => [...(s.requests ?? []).filter((x) => !reqOut.has(x.id)), ...reqOut.values()];
  for (const c of ciOut) {
    const later = s.checkIns.some((x) => x.goalId === c.goalId && x.week > c.week) || ciOut.some((x) => x.goalId === c.goalId && x.week > c.week);
    const g = work.get(c.goalId);
    if (later || !g) continue;
    const r = requestsAfterCheckIn(g, c, { ...s, people: [...people.values()], requests: requestsNow() }, actor.id, now, newId);
    for (const x of r.requests) reqOut.set(x.id, x);
    changes.push(...r.changes);
  }

  /* ---------- people and teams: what changed ---------- */
  const peopleOut = new Map<string, Person>();
  const teamName = (tid: string) => teams.get(tid)?.name ?? '';
  for (const [id, t] of peopleTouched) {
    const after = people.get(id)!;
    const ch = personChange(t.before, after, teamName, actor.id, now, newId('chg'));
    if (!ch) continue;
    peopleOut.set(id, after);
    changes.push(ch);
    items.push({ sheet: 'People', row: t.row, goalId: '', goal: after.name, kind: t.before ? 'person' : 'new person', summary: ch.summary, diffs: ch.diffs });
  }
  const teamsOut = new Map<string, Team>();
  for (const [id, t] of teamsTouched) {
    const after = teams.get(id)!;
    teamsOut.set(id, after);
    if (create) continue;
    const diffs = [{ field: 'Team objective', from: t.before?.objective || '—', to: after.objective || '—' }];
    changes.push({ id: newId('chg'), at: now, actorId: actor.id, goalId: null, entity: 'workspace', entityId: id, action: 'edited', summary: `Changed the objective of the team “${after.name}”`, diffs });
    items.push({ sheet: 'People', row: t.row, goalId: '', goal: after.name, kind: 'team', summary: `Changed the objective of the team “${after.name}”`, diffs });
  }

  /* ---------- a row's Action: stop or delete a goal, mark someone as left, with the app's own rules ---------- */
  const reviewsOut = new Map<string, Review>();
  const reviewsBefore = new Map<string, Review>();
  if ((removals.length || leaving.length) && !issues.some((x) => x.severity === 'error')) {
    const xOf = (): ActionContext => ({
      snapshot: { ...s, people: [...people.values()], teams: [...teams.values()], goals: [...work.values()], checkIns: [...s.checkIns.filter((c) => !ciOut.some((o) => o.id === c.id)), ...ciOut], requests: requestsNow(), reviews: s.reviews.map((v) => reviewsOut.get(v.id) ?? v) },
      cycle, week, actor, now, newId, ...(input.full ? { full: input.full, allGoals: input.full.goals } : {}),
    });
    const merge = (c: Commit) => {
      for (const g of c.goals ?? []) {
        if (!touched.has(g.id)) touched.set(g.id, { before: s.goals.find((x) => x.id === g.id) ?? null, row: 0, sheet: 'Goals', reason: '', plan: false });
        work.set(g.id, g);
        goalOut.set(g.id, g);
      }
      for (const r of c.requests ?? []) reqOut.set(r.id, r);
      for (const p of c.people ?? []) { if (!peopleTouched.has(p.id)) peopleTouched.set(p.id, { before: s.people.find((x) => x.id === p.id) ?? null, row: 0 }); people.set(p.id, p); peopleOut.set(p.id, p); }
      for (const v of c.reviews ?? []) { if (!reviewsBefore.has(v.id)) reviewsBefore.set(v.id, s.reviews.find((x) => x.id === v.id)!); reviewsOut.set(v.id, v); }
      for (const t of c.teams ?? []) { if (!teamsTouched.has(t.id)) teamsTouched.set(t.id, { before: s.teams.find((x) => x.id === t.id) ?? null, row: 0 }); teams.set(t.id, t); teamsOut.set(t.id, t); }
      changes.push(...c.changes);
    };
    for (const x of removals) {
      try {
        const c = x.how === 'stop' ? stopGoal(xOf(), x.g.id, x.reason) : deleteGoal(xOf(), x.g.id);
        merge(c);
        items.push({ sheet: 'Goals', row: x.row, goalId: x.g.id, goal: x.g.title, kind: x.how === 'stop' ? 'stop goal' : 'delete goal', summary: c.changes[0]!.summary, diffs: c.changes[0]!.diffs });
      } catch (e) {
        if (!(e instanceof NotAllowed)) throw e;
        err('Goals', x.row, x.g.title, e.message);
      }
    }
    for (const l of leaving) {
      try {
        const c = markPersonLeft(xOf(), l.person.id, { goalsTo: l.to.id === l.person.id ? null : l.to.id, asksTo: l.to.id === l.person.id ? null : l.to.id });
        merge(c);
        items.push({ sheet: 'People', row: l.row, goalId: '', goal: l.person.name, kind: 'person left', summary: c.changes[0]!.summary, diffs: c.changes[0]!.diffs });
      } catch (e) {
        if (!(e instanceof NotAllowed)) throw e;
        err('People', l.row, l.person.name, e.message.replace(/choose who takes (them|it) over/, 'say who takes them over in Takes over'));
      }
    }
  }

  for (const ch of changes) ch.diffs.push({ field: 'Via', from: '—', to: VIA_LABEL[via] });
  const counts = {
    newGoals: items.filter((x) => x.kind === 'new goal').length,
    goals: items.filter((x) => x.kind === 'goal').length,
    plans: items.filter((x) => x.kind === 'plan').length,
    checkIns: items.filter((x) => x.kind === 'check-in' || x.kind === 'replaces check-in').length,
    backfilled: items.filter((x) => x.backfilled).length,
    replaced: items.filter((x) => x.kind === 'replaces check-in').length,
    people: items.filter((x) => x.kind === 'person').length,
    newPeople: items.filter((x) => x.kind === 'new person').length,
    teams: items.filter((x) => x.kind === 'team').length,
    stopped: items.filter((x) => x.kind === 'stop goal').length,
    deleted: items.filter((x) => x.kind === 'delete goal').length,
    left: items.filter((x) => x.kind === 'person left').length,
  };
  const ok = !issues.some((x) => x.severity === 'error') && !needsReason && !needsConfirm && items.length > 0;
  const result: ChangeSet = { items, unchanged, issues, needsReason, needsConfirm, commit: null, counts };
  // New goals before the goals that feed into them, so each link points at a goal that's already saved.
  const ordered: Goal[] = [];
  const pending = [...goalOut.values()];
  while (pending.length) {
    const i = pending.findIndex((g) => !g.parentId || !pending.some((x) => x.id === g.parentId));
    ordered.push(...pending.splice(i < 0 ? 0 : i, 1));
  }
  if (create) {
    result.created = { people: [...people.values()], teams: [...teams.values()], goals: ordered, checkIns: ciOut, requests: [...reqOut.values()], keysIssued: lastKeyGiven };
    return result;
  }
  if (ok) {
    const sumId = newId('chg');
    const importId = newId('imp');
    // Every row's change carries the import's id, and the summary keeps what each record was before, so "Undo this
    // import" can put every row back (domain/removal undoImport).
    for (const ch of changes) ch.importId = importId;
    const requestsBefore = asksOf(s);
    const summary: Change = {
      id: sumId, at: now, actorId: actor.id, goalId: null, entity: 'workspace', entityId: importId, action: 'imported', importId,
      summary: `${via === 'spreadsheet' ? 'Loaded a spreadsheet' : via === 'mcp' ? 'Changes via MCP' : via === 'table' ? 'Edited the data tables' : 'Bulk edit'}: ${describe(result).toLowerCase()}`, diffs: [{ field: 'Via', from: '—', to: VIA_LABEL[via] }],
      undo: {
        goals: ordered.map((g) => ({ id: g.id, before: touched.get(g.id)?.before ?? null })),
        checkIns: ciOut.map((c) => ({ id: c.id, before: ciBefore.get(c.id) ?? null })),
        people: [...peopleOut.values()].map((p) => ({ id: p.id, before: s.people.find((x) => x.id === p.id) ?? null })),
        requests: [...reqOut.values()].map((r) => ({ id: r.id, before: requestsBefore.find((x) => x.id === r.id) ?? null })),
        ...(reviewsOut.size ? { reviews: [...reviewsOut.keys()].map((id) => ({ id, before: reviewsBefore.get(id) ?? null })) } : {}),
        ...(teamsOut.size ? { teams: [...teamsOut.keys()].map((id) => ({ id, before: s.teams.find((x) => x.id === id) ?? null })) } : {}),
      },
    };
    result.commit = {
      ...(peopleOut.size ? { people: [...peopleOut.values()] } : {}),
      ...(teamsOut.size ? { teams: [...teamsOut.values()] } : {}),
      goals: ordered, checkIns: ciOut,
      ...(reqOut.size ? { requests: [...reqOut.values()] } : {}),
      ...(reviewsOut.size ? { reviews: [...reviewsOut.values()] } : {}),
      changes: [...changes, summary],
    };
  }
  return result;
}

/** Whether a row says what a check-in already says, in every column that can be changed. */
function sameCheckIn(c: CheckIn, d: Draft, g: Goal): boolean {
  const t = (s: string | null | undefined) => (s ?? '').trim();
  const p = c.pathToGreen;
  return (!d.status || c.status === d.status)
    && (g.kind === 'milestone' ? JSON.stringify(c.stages ?? []) === JSON.stringify(d.stages) : c.value === parseNumber(d.value))
    && (c.cause ?? null) === (d.cause ?? null)
    && t(c.why) === t(d.why) && t(c.greenerWhy) === t(d.greenerWhy)
    && t(p?.what) === t(d.ptgWhat) && (p?.byWeek ?? null) === (d.ptgBy ?? null) && t(p?.needs) === t(d.needs)
    && (!t(d.ptgWhat) || (p?.state ?? 'plan') === d.ptgState)
    && t(c.next) === t(d.next);
}

/** A past week's check-in exactly as its row wrote it (set-up from an export): the rules' status and calculation, and
    the owner's own cause, reasons and path back, whether or not the new plan would ask for them. */
function asWritten(g: Goal, week: number, d: Draft, e: ReturnType<typeof evaluate>, authorId: string, at: string, id: string): CheckIn {
  // The workspace it came from judged that week against the plan of its day, which a copy doesn't carry: a call the new
  // plan would call greener, with no reason given, stands as the week's calculation too.
  const rank = (s: Status) => (s === 'off' ? 3 : s === 'risk' ? 2 : 1);
  const calculated = rank(e.status) < rank(e.calc) && !d.greenerWhy.trim() ? e.status : e.calc;
  return {
    id, goalId: g.id, authorId, week, postedAt: at,
    value: g.kind === 'milestone' ? null : parseNumber(d.value), stages: g.kind === 'milestone' ? d.stages : null,
    status: e.status, calculated, cause: d.cause ?? null, why: d.why.trim(), greenerWhy: d.greenerWhy.trim(), proposeTarget: null,
    pathToGreen: d.ptgWhat.trim() ? { what: d.ptgWhat.trim(), byWeek: (d.ptgState ?? 'plan') === 'plan' ? d.ptgBy : null, needs: d.needs.trim(), state: d.ptgState ?? 'plan' } : null,
    next: d.next.trim(), dataFlagged: false,
  };
}

/** What every stored check-in says, whatever the plan (the database checks it too, migrations 0001 and 0007): a path
    back when the call is behind, and a reason when the call is better than the numbers. */
function keepsTheRules(c: CheckIn): boolean {
  const rank = (s: Status) => (s === 'off' ? 3 : s === 'risk' ? 2 : 1);
  const p = c.pathToGreen;
  const wayBack = !['risk', 'off'].includes(c.status) || (!!p && p.what.trim().length >= 8 && ((p.state ?? 'plan') !== 'plan' || (p.byWeek ?? 0) > c.week));
  const greener = rank(c.status) >= rank(c.calculated) || c.greenerWhy.trim().length >= 10;
  return wayBack && greener;
}

/** Initials from a name, as Workspace makes them. */
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).slice(0, 2).join('') || '?';

/** The words a check-in's columns take, for a tool's or a sheet's description. */
export const CALL_CHOICES = oneOf(Object.values(CALL_WORDS.word));
