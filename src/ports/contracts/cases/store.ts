/* The goals store's contract (the Store port, src/ports/store.ts; backlog 8c, AX5 part 2) as data (gap 1(b)). Every
   commit a case saves is worked out here, when the cases are made, from the fixed workspace and a fixed id counter:
   a store gives back what it was given, so what the rules would work out from a load (Undo, an import's undoing, a
   token) comes out the same from this simulation (applyCommit, the browser store's own). `npm run spec` writes them to
   spec/conformance/contracts/store.json; src/ports/contracts/store.ts runs them on Faro's three stores. */
import { createToken, revokeToken, type ActionContext } from '../../../domain/actions';
import { deleteGoal, markPersonLeft, undoImport, undoRemoval } from '../../../domain/removal';
import { buildWorkspace, GOALS_TEMPLATE, PEOPLE_TEMPLATE } from '../../../domain/importer';
import type { Change, CheckIn, Cycle, Goal, Snapshot, Workspace } from '../../../domain/types';
import type { DbRow, ModuleRecords, RecordDef } from '../../../domain/records';
import { applyCommit, withExpectations, type Commit } from '../../../data/store';
import { newestFirst } from '../../window';
import type { Case, Contract, Step, Then } from './format';

const NOW = new Date('2026-10-30T12:00:00Z');
const AT = NOW.toISOString();

/** A small workspace (the import's templates), with an admin, for each store to keep. */
export function contractWorkspace(suffix: string): Snapshot {
  const built = buildWorkspace({ name: 'Contract', startDate: '2025-12-29', people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now: NOW, idSuffix: suffix });
  if (built.issues.length) throw new Error(built.issues.join('; '));
  const s = built.snapshot;
  return s.people.some((p) => p.admin) ? s : { ...s, people: s.people.map((p, i) => (i === 0 ? { ...p, admin: true } : p)) };
}

/* ---------- a small module with records of its own, for the contract ---------- */

/** A mark someone puts on a goal: the contract module's one record. */
export interface Mark { id: string; goalId: string; text: string; at: string; removedAt?: string | null; removedBy?: string | null }
const mark: RecordDef<Mark> = {
  name: 'mark', key: 'marks', table: 'okr_contract_marks', removable: true,
  toRow: (ws, m): DbRow => ({ workspace_id: ws, id: m.id, goal_id: m.goalId, text: m.text, at: m.at, ...(m.removedAt !== undefined ? { removed_at: m.removedAt, removed_by: m.removedBy ?? null } : {}) }),
  fromRow: (r) => ({ id: r.id, goalId: String(r.goal_id), text: String(r.text), at: new Date(String(r.at)).toISOString(), ...(r.removed_at ? { removedAt: new Date(String(r.removed_at)).toISOString(), removedBy: String(r.removed_by) } : {}) }),
};
/** The contract's module: one record, pointing to a goal. */
export const CONTRACT_MODULE: ModuleRecords = { module: 'contract', records: [mark] };
/** Its table, as its migration would make it, in Faro's schema, and on the allowed list okr_write takes (migration 0039). */
export const CONTRACT_MODULE_SQL = `
  create table if not exists faro.okr_contract_marks (id text primary key, workspace_id text not null references faro.okr_workspaces (id), goal_id text not null references faro.okr_goals (id), text text not null, at timestamptz not null, removed_at timestamptz, removed_by text);
  grant select, insert, update on faro.okr_contract_marks to anon;
  insert into faro.module_tables (table_name, module, position) values ('okr_contract_marks', 'contract', 100) on conflict (table_name) do nothing;
  create or replace view public.okr_contract_marks with (security_invoker = on) as select * from faro.okr_contract_marks;
`;

/** What a case starts from: a fresh store holding these workspaces, each made with createWorkspace. */
export interface StoreGiven { workspaces: { workspace: Workspace; snapshot: Snapshot }[] }

/** The workspace every case starts with. */
export const STORE_WS = 'ws_contract';
/** Where the windowed load in the contract starts: well into the contract workspace's year, months after its earlier cycle ended. */
export const FROM = '2026-06-01T00:00:00.000Z';

const wsRow = (id: string, name: string): Workspace => ({ id, name, kind: 'own', createdAt: AT });
const op = (name: string, ...args: unknown[]): Step['when'] => ({ op: name, args });
const step = (when: Step['when'], then: Then = {}): Step => ({ when, then });
const load = (window?: { from: string }) => op('load', ...(window ? [STORE_WS, window] : [STORE_WS]));
const commit = (c: Commit, ws = STORE_WS) => op('commit', ws, c);
/** A set of ids, in any order. */
const sameSet = (select: string, ids: string[]): Then => ({ select, length: ids.length, includes: ids });
const absent = (select: string): Then => ({ select, absent: true });
/** The records with these ids are there (so that an `absent` on one of their fields can't pass by missing them). */
const there = (list: string, ...ids: string[]): Then => ({ select: `${list}[].id`, includes: ids });
const all = (...t: Then[]): Then => ({ all: t });
const isTime = (select: string): Then => ({ select, matches: '^\\d{4}-\\d\\d-\\d\\dT' });

export function makeStoreContract(): Contract {
  let n = 0;
  const ids = (p: string) => `${p}_c${String(++n).padStart(4, '0')}`;
  const ctx = (s: Snapshot): ActionContext => ({ snapshot: s, full: s, allGoals: s.goals, cycle: s.cycles[0]!, week: 1, actor: s.people.find((p) => p.admin)!, now: AT, newId: ids } as unknown as ActionContext);
  const note = (s: Snapshot, text: string, goalId = s.goals[0]!.id, at = AT): Change[] => [
    { id: ids('chg'), at, actorId: s.people[0]!.id, goalId, entity: 'note', entityId: ids('note'), action: 'noted', summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: text }] },
  ];
  const start = contractWorkspace('c');
  const given: StoreGiven = { workspaces: [{ workspace: wsRow(STORE_WS, 'Contract'), snapshot: start }] };
  const goal = (id: string, field: string) => `goals[id=${id}].${field}`;
  const comments: Then['select'] = 'changes[].diffs[0].to';
  const MARKS = 'modules.contract.marks';

  const cases: Case[] = [];

  /* Keeps a new workspace whole. */
  {
    const g = start.goals[0]!;
    cases.push({
      name: 'keeps a new workspace whole, and lists it',
      steps: [
        step(op('workspaces'), { select: '[].id', includes: [STORE_WS] }),
        step(load(), all(
          sameSet('goals[].id', start.goals.map((x) => x.id)),
          sameSet('people[].id', start.people.map((x) => x.id)),
          sameSet('teams[].id', start.teams.map((x) => x.id)),
          { select: 'cycles[].id', equals: start.cycles.map((c) => c.id) },
          { select: `goals[id=${g.id}]`, has: { title: g.title, kind: g.kind, ownerId: g.ownerId } },
        )),
      ],
    });
  }

  cases.push({
    name: 'saves a change-log entry and gives it back',
    steps: [step(commit({ changes: note(start, 'Kept by the store') })), step(load(), { select: comments, includes: ['Kept by the store'] })],
  });

  /* Versions. */
  {
    const g = start.goals[0]!;
    const edit = (title: string): Commit => withExpectations({ goals: [{ ...g, title }], changes: note(start, title) }, start);
    cases.push({
      name: 'saves a goal one version on, and refuses a save based on the version before it as stale',
      steps: [
        step(commit(edit('Renamed once'))),
        step(load(), all({ select: goal(g.id, 'title'), equals: 'Renamed once' }, { select: goal(g.id, 'version'), equals: (g.version ?? 0) + 1 })),
        step(commit(edit('Renamed from an old screen')), { throws: true }),
        step(load(), { select: goal(g.id, 'title'), equals: 'Renamed once' }),
      ],
    });
  }

  /* Another workspace's records. */
  {
    const other = 'ws_neighbour';
    const theirs = contractWorkspace('o');
    const person = theirs.people[0]!;
    const milestone = theirs.goals.find((g) => g.kind === 'milestone')!;
    if (milestone.kind !== 'milestone' || !milestone.stages.length) throw new Error('The contract workspace needs a milestone with stages.');
    cases.push({
      name: 'never lets a save to one workspace change another’s records',
      steps: [
        step(op('createWorkspace', wsRow(other, 'Neighbour'), theirs)),
        // A store that keeps every workspace's records in one table (a database) refuses such a save outright; one that
        // keeps each workspace apart (the browser) may keep the copy as this workspace's own. Neither touches the other.
        step(commit({ people: [{ ...person, name: 'Moved across' }], changes: [] }), { anyOf: [{}, { throws: true }] }),
        step(commit({ goals: [{ ...milestone, title: 'Taken over', stages: [] }], changes: [] }), { anyOf: [{}, { throws: true }] }),
        step(op('load', other), all(
          { select: `people[id=${person.id}].name`, equals: person.name },
          { select: goal(milestone.id, 'title'), equals: milestone.title },
          { select: goal(milestone.id, 'stages[].id'), equals: milestone.stages.map((s) => s.id) },
        )),
      ],
    });
  }

  /* A module's records. */
  {
    const g = start.goals.at(-1)!;
    const by = start.people[0]!.id;
    const m: Mark = { id: ids('mark'), goalId: g.id, text: 'Kept as it was given, line\nbreaks and “quotes” too', at: AT };
    const removed = { ...m, removedAt: AT, removedBy: by };
    cases.push({
      name: 'keeps a module’s records whole, saves them with a commit, and removes and restores them with what they point to',
      steps: [
        // Saved with the rest of one commit: the mark and its change-log entry together.
        step(commit({ modules: { contract: { marks: [m] } }, changes: note(start, 'Marked') }), {}),
        step(load(), all({ select: MARKS, equals: [m] }, { select: comments, includes: ['Marked'] })),
        // A save of anything else leaves it as it is.
        step(commit({ changes: note(start, 'Something else') })),
        step(load(), { select: MARKS, equals: [m] }),
        // Removed with the goal it points to, in one save; restored with it.
        step(commit({ goals: [{ ...g, removedAt: AT, removedBy: by }], modules: { contract: { marks: [removed] } }, changes: [] })),
        step(load(), all(isTime(goal(g.id, 'removedAt')), { select: MARKS, equals: [removed] })),
        step(commit({ goals: [{ ...g, version: (g.version ?? 0) + 1, removedAt: null, removedBy: null }], modules: { contract: { marks: [{ ...m, removedAt: null, removedBy: null }] } }, changes: [] })),
        step(load(), all(there('goals', g.id), absent(goal(g.id, 'removedAt')), { select: MARKS, has: [{ id: m.id, goalId: m.goalId, text: m.text, at: m.at }] }, absent(`${MARKS}[0].removedAt`), absent(`${MARKS}[0].removedBy`))),
      ],
    });
  }

  /* Undo. A record loaded live has no removedAt at all, and Undo saves it back as it was loaded: the store must still
     clear the removal's time (build review: on the database stores the record came back, then went again on reload). */
  {
    let s = start;
    const steps: Step[] = [];
    const save = (c: Commit) => { steps.push(step(commit(c))); s = applyCommit(s, c); };
    const undone = (remove: (x: ActionContext) => Commit) => {
      const before = s;
      const removal = remove(ctx(before));
      save(removal);
      save(undoRemoval(ctx(s), removal, before));
    };
    const g = s.goals.find((x) => !x.removedAt && !s.goals.some((c) => c.parentId === x.id) && !s.checkIns.some((c) => c.goalId === x.id))!;
    undone((x) => deleteGoal(x, g.id));
    steps.push(step(load(), all(there('goals', g.id), absent(goal(g.id, 'removedAt')))));
    const p = s.people.find((x) => !x.admin && !x.leftAt && !x.removedAt)!;
    undone((x) => markPersonLeft(x, p.id, { goalsTo: x.actor.id, asksTo: x.actor.id }));
    steps.push(step(load(), all(there('people', p.id), absent(`people[id=${p.id}].leftAt`))));
    // A module's row, which its toRow also writes only when it has a removal time.
    const m: Mark = { id: ids('mark'), goalId: g.id, text: 'Undone', at: AT };
    save({ modules: { contract: { marks: [m] } }, changes: [] });
    undone((x) => ({ modules: { contract: { marks: [{ ...m, removedAt: x.now, removedBy: x.actor.id }] } }, changes: note(x.snapshot, 'Removed a mark') }));
    steps.push(step(load(), all({ select: `${MARKS}[].id`, includes: [m.id] }, absent(`${MARKS}[id=${m.id}].removedAt`))));
    cases.push({ name: 'brings back what Undo restores, as loaded, and it stays back after the next load', steps });
  }

  /* An import's undoing. Its log entry keeps each row as it was, and a live row has no removal fields at all (build
     review of #175). */
  {
    const free = start.goals.filter((x) => !x.removedAt && !x.stoppedAt && !start.goals.some((c) => c.parentId === x.id));
    const [a, b] = [free.at(-1)!, free.at(-2)!];
    const p = [...start.people].reverse().find((x) => !x.admin && !x.leftAt && !x.removedAt)!;
    const admin = start.people.find((x) => x.admin)!.id, importId = ids('imp');
    const imported: Commit = {
      goals: [{ ...a, removedAt: AT, removedBy: admin }, { ...b, stoppedAt: AT, stoppedBy: admin, stopReason: 'Stopped by a row’s Action' }],
      people: [{ ...p, leftAt: AT, leftBy: admin, email: p.email ?? 'left@example.org' }],
      changes: [{ id: ids('chg'), at: AT, actorId: admin, goalId: null, entity: 'workspace', entityId: importId, action: 'imported', summary: 'Imported a spreadsheet: 3 rows', diffs: [], importId,
        undo: { goals: [{ id: a.id, before: a }, { id: b.id, before: b }], checkIns: [], people: [{ id: p.id, before: p }], requests: [] } }],
    };
    const undo = undoImport(ctx(applyCommit(start, imported)), importId).commit;
    cases.push({
      name: 'puts back what an import deleted, stopped or marked as left when the import is undone, and it stays back',
      steps: [
        step(commit(imported)),
        step(commit(undo)),
        step(load(), all(
          there('goals', a.id, b.id), there('people', p.id),
          absent(goal(a.id, 'removedAt')), absent(goal(b.id, 'stoppedAt')), absent(goal(b.id, 'stopReason')),
          absent(`people[id=${p.id}].leftAt`),
          p.email ? { select: `people[id=${p.id}].email`, equals: p.email } : absent(`people[id=${p.id}].email`),
        )),
      ],
    });
  }

  /* Tokens. */
  {
    const c = createToken(ctx(start), start.people[1]!.id, 'Claude on a laptop');
    const t = c.tokens![0]!;
    const revoke = revokeToken(ctx(applyCommit(start, c)), t.id)!;
    cases.push({
      name: 'issues an AI assistant token once, never keeps its secret, and revokes it',
      steps: [
        step(op('issueToken', STORE_WS, c), { matches: '^\\S{20,}$' }),
        step(load(), all({ select: 'tokens[].id', equals: [t.id] }, absent('tokens[0].secret'), absent('tokens[0].token'))),
        step(commit(revoke)),
        step(load(), isTime(`tokens[id=${t.id}].revokedAt`)),
      ],
    });
  }

  cases.push({
    name: 'deletes a workspace and everything in it',
    steps: [
      step(op('createWorkspace', wsRow('ws_short', 'Short-lived'), contractWorkspace('d'))),
      step(op('workspaces'), { select: '[].id', includes: ['ws_short', STORE_WS] }),
      step(op('deleteWorkspace', 'ws_short')),
      step(op('workspaces'), all({ select: '[].id', excludes: ['ws_short'] }, { select: '[].id', includes: [STORE_WS] })),
    ],
  });

  /* The narrower load (AX5 part 2): a quarter before the workspace's year (ended 13 April 2025), a goal in each with a
     check-in, and change-log entries from before FROM of every kind the window treats differently: a plain edit (two at
     the same moment, so paging meets a tie), a comment, the earlier cycle's own entry and an import's summary. */
  const s = start;
  const actor = s.people[0]!.id;
  const earlier: Cycle = { id: ids('cycle'), name: 'Jan–Mar 2025', startDate: '2025-01-06', weeks: 13, reviewDay: 3 };
  // A next year with nothing in it yet: a window always keeps the newest two cycles (domain/leftOut keptCycles), so with
  // it the earlier quarter is outside the window.
  const next: Cycle = { id: ids('cycle'), name: '2027', startDate: '2027-01-04', weeks: 52, reviewDay: 3 };
  const like = s.goals.find((g) => g.kind !== 'milestone')!;
  const oldGoal = { ...like, id: ids('goal'), cycleId: earlier.id, parentId: null, alsoHelps: [], version: undefined } as Goal;
  const checkIn = (goalId: string, week: number, postedAt: string): CheckIn => ({
    id: ids('ci'), goalId, authorId: actor, week, postedAt, value: null, stages: null, status: 'on', calculated: 'on', cause: null,
    why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false,
  });
  const entry = (at: string, x: Partial<Change>): Change => ({ id: ids('chg'), at, actorId: actor, goalId: oldGoal.id, entity: 'goal', entityId: oldGoal.id, action: 'edited', summary: 'Edited', diffs: [], ...x });
  const old = {
    cycle: entry('2025-01-06T08:00:00.000Z', { goalId: null, entity: 'cycle', entityId: earlier.id, action: 'created', summary: 'Started a cycle' }),
    imported: entry('2025-02-01T10:00:00.000Z', { goalId: null, entity: 'workspace', entityId: ids('imp'), action: 'imported', summary: 'Imported a spreadsheet: 0 rows', undo: { goals: [], checkIns: [], people: [], requests: [] } }),
    plain: entry('2025-03-01T10:00:00.000Z', {}),
    note: entry('2025-03-02T10:00:00.000Z', { entity: 'note', entityId: ids('note'), action: 'noted', summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: 'An old comment' }] }),
    tie: [entry('2025-03-03T10:00:00.000Z', {}), entry('2025-03-03T10:00:00.000Z', {})],
  };
  const oldCheckIn = checkIn(oldGoal.id, 2, '2025-01-20T09:00:00.000Z');
  // This year's, posted before FROM: kept, because its cycle overlaps the window.
  const thisYear = checkIn(like.id, 2, '2026-01-12T09:00:00.000Z');
  const recent = note(s, 'A recent comment');
  const setup: Commit[] = [
    { cycles: [earlier, next], changes: [old.cycle] },
    { goals: [oldGoal], changes: [old.imported] },
    { checkIns: [oldCheckIn, thisYear], changes: [old.plain, old.note, ...old.tie] },
    { changes: recent },
  ];
  const withHistory = setup.reduce(applyCommit, s);
  const history = setup.map((c) => step(commit(c)));
  const newest = [...withHistory.changes].sort(newestFirst);

  cases.push({
    name: 'narrows a load to a window: check-ins of cycles that overlap it, and entries from its start plus the anchors of any age',
    steps: [...history, step(load({ from: FROM }), all(
      { select: 'checkIns[].id', includes: [thisYear.id], excludes: [oldCheckIn.id] },
      { select: 'changes[].id', excludes: [old.plain.id, ...old.tie.map((t) => t.id)], includes: [old.note.id, old.cycle.id, old.imported.id] },
      { select: `changes[id=${old.imported.id}].undo`, equals: old.imported.undo },
      // Entries from the window's start on are all there.
      { select: 'changes[].id', includes: withHistory.changes.filter((c) => c.at >= FROM).map((c) => c.id) },
      // Everything else is whole: every cycle, and the earlier cycle's goal.
      sameSet('cycles[].id', [s.cycles[0]!.id, earlier.id, next.id]),
      { select: 'goals[].id', includes: [oldGoal.id] },
      { select: 'history', equals: { from: FROM, checkInCycles: [s.cycles[0]!.id, earlier.id].sort() } },
    ))],
  });

  cases.push({
    name: 'keeps the newest two cycles’ check-ins however far back the window starts (the year in use never falls out)',
    steps: [...history, step(load({ from: '2031-01-01T00:00:00.000Z' }), all(
      { select: 'checkIns[].id', includes: [thisYear.id], excludes: [oldCheckIn.id] },
    ))],
  });

  cases.push({
    name: 'pages back through the change log newest first, with no skips or repeats, and narrows it to a goal',
    steps: [
      ...history,
      { when: op('history', STORE_WS, { size: 2 }), pages: { arg: 1, max: 100, key: 'before', rows: 'changes', each: { select: 'changes', maxLength: 2 } },
        then: { select: 'rows[].id', equals: newest.map((c) => c.id), distinct: true } },
      // One goal's entries, and a page is never more than 100.
      step(op('history', STORE_WS, { goalId: oldGoal.id, size: 500 }), all(
        { select: 'changes[].id', equals: newest.filter((c) => c.goalId === oldGoal.id).map((c) => c.id) },
        absent('next'),
      )),
      step(op('history', STORE_WS, { size: 500 }), { select: 'changes', length: Math.min(newest.length, 100) }),
    ],
  });

  cases.push({
    name: 'loads the whole workspace when no window is asked for, and says nothing was left out',
    steps: [...history, step(load(), all(
      { select: 'checkIns[].id', includes: [oldCheckIn.id, thisYear.id] },
      { select: 'changes[].id', includes: [old.plain.id, ...old.tie.map((t) => t.id), old.note.id] },
      absent('history'),
    ))],
  });

  return {
    port: 'store',
    about: `The goals store (\`Store\`): where a workspace’s records are kept, whatever keeps them. \`given\` is \`{ workspaces: [{ workspace, snapshot }] }\`: start a fresh, empty store and make each workspace in it with \`createWorkspace\`. A snapshot is a workspace’s records by kind (\`goals\`, \`people\`, \`teams\`, \`cycles\`, \`checkIns\`, \`changes\`, \`tokens\`, \`modules\` and the rest; [the records](../../core/types.md)); a commit is one save: the records it adds or replaces by kind, change-log entries to add, and \`expect\`, the versions it was based on. A store must keep a feature module’s records it knows nothing about: \`modules.<module>.<key>\`, each row whole, saved with the rest of its commit. The contract’s module is \`contract\`, whose one record is a mark on a goal (\`modules.contract.marks\`); a database store gets its table first, as the module’s migration would make it:\n\n\`\`\`sql${CONTRACT_MODULE_SQL.replace(/\n {2}/g, '\n').trimEnd()}\n\`\`\``,
    ops: {
      given: 'Start a fresh store holding these workspaces. Answers null.',
      workspaces: 'The workspaces kept: `[{ id, name, kind, createdAt }]`.',
      createWorkspace: '(workspace, snapshot) Keep a new workspace and all its records. Answers null.',
      load: '(workspaceId, window?) The workspace’s records. With `window` (`{ from }`): only the check-ins of cycles whose last day is on or after `from`’s day, and only the change-log entries from `from` on plus the anchors of any age (comments, asks, a cycle’s entries, an import’s summary or undoing, or any entry carrying `undo`), and `history: { from, checkInCycles }` (every cycle with a check-in, sorted); without one, everything, and no `history`.',
      commit: '(workspaceId, commit) Save it whole or not at all: a saved goal or review is one version on; refuse it as stale when a goal or review it `expect`s has moved on. Never changes another workspace’s records. Answers null.',
      issueToken: '(workspaceId, commit) Keep the commit’s new AI assistant token and answer its secret (at least 20 characters, no spaces), which is never kept or given back.',
      deleteWorkspace: '(workspaceId) Remove the workspace and everything in it. Answers null.',
      history: '(workspaceId, { before?, goalId?, size? }) Change-log entries a page at a time, newest first (by `at`, then `id`, both descending): `{ changes, next }`, those strictly older than `before` (`{ at, id }`), only one goal’s when `goalId` is given, 50 unless `size` says otherwise and never more than 100; `next` is the last entry’s `{ at, id }` when there are more, else null.',
    },
    given,
    cases,
  };
}

/** The store contract, made once. */
export const STORE_CONTRACT: Contract = makeStoreContract();
