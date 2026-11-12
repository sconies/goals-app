/* Set-up from a spreadsheet: people, teams, goals, their plans and past check-ins, pasted from a spreadsheet, typed into
   the set-up steps, or read from a file (the set-up template, or a whole workbook exported from another workspace).
   It is the bulk-change engine in "create" mode (domain/changeset): the same columns, the same rules and the same
   problems as the Import screen, with every row new. Nothing is saved until every row is right. */
import { levelIds } from './levels';
import { planChanges, type Tables } from './changeset';
import { GOALS, PEOPLE } from './columns';
import { currentWeek } from './plan';
import { parseDelimited, recordsOf } from './sheets';
import { yearWeeks } from './year';
import { yearName } from './yearName';
import { LABEL } from './vocabulary';
import type { Change, Cycle, Person, Review, SavedView, Snapshot } from './types';

export interface ImportIssue {
  table: 'People' | 'Goals' | 'Plan' | 'Check-ins';
  row: number;
  message: string;
}

export interface ImportResult {
  snapshot: Snapshot;
  issues: ImportIssue[];
  /** Said on the row, never blocking: a shared name, a number worth checking (backlog N). */
  notes?: ImportIssue[];
}

/** The set-up template's columns: the one format's, the ones a new workspace needs (domain/columns). */
const pick = (all: string[], want: string[]) => want.filter((c) => all.includes(c));
export const PEOPLE_COLUMNS = pick(PEOPLE.columns.map((c) => c.header), ['Name', 'Email', 'Job title', 'Team', 'Admin', 'Team objective']);
export const GOAL_COLUMNS = pick(GOALS.columns.map((c) => c.header), ['Key', 'Goal', 'Level', 'Team', 'Owner email', 'Owner', 'Type', 'Unit', 'Start', 'Target', 'Plan', 'Due week', 'Limit', 'Must stay', 'Margin', 'Stages', 'Feeds into', 'Why it helps', 'Effect', 'Source', 'Definition']);

const tsv = (rows: string[][]) => rows.map((r) => r.join('\t')).join('\n');
const byHeader = (cols: string[], o: Record<string, string | undefined>) => cols.map((c) => o[c] ?? '');

export const PEOPLE_TEMPLATE = tsv([
  PEOPLE_COLUMNS,
  ...[
    { Name: 'Ana Silva', Email: 'ana.silva@example.com', 'Job title': 'VP Engineering', Team: 'Leadership', Admin: 'yes' },
    { Name: 'Ben Ortiz', Email: 'ben.ortiz@example.com', 'Job title': 'Platform lead', Team: 'Platform', 'Team objective': 'Make every deploy safe and fast' },
    { Name: 'Chloe Wu', Email: 'chloe.wu@example.com', 'Job title': 'Engineering manager', Team: 'Platform' },
    { Name: 'Dev Patel', Email: 'dev.patel@example.com', 'Job title': 'Engineer', Team: 'Platform' },
  ].map((o) => byHeader(PEOPLE_COLUMNS, o)),
]);

export const GOALS_TEMPLATE = tsv([
  GOAL_COLUMNS,
  ...[
    { Goal: 'Deploy lead time', Level: 'north star', Team: 'Platform', 'Owner email': 'ben.ortiz@example.com', Owner: 'Ben Ortiz', Type: 'metric', Unit: 'days', Start: '5', Target: '1', Plan: 'back-loaded', Source: 'CI dashboard' },
    { Goal: 'Deploys rolled back', Level: 'team', Team: 'Platform', 'Owner email': 'ben.ortiz@example.com', Owner: 'Ben Ortiz', Type: 'range', Unit: '%', Limit: '5', 'Must stay': 'at most', Margin: '1', 'Feeds into': 'Deploy lead time', Source: 'CI dashboard' },
    { Goal: 'Canary releases live', Level: 'team', Team: 'Platform', 'Owner email': 'ben.ortiz@example.com', Owner: 'Ben Ortiz', Type: 'milestone', Stages: 'Design@2; Pilot@6; All services@10', 'Feeds into': 'Deploy lead time', Effect: '1', Source: 'Jira PLAT epics' },
  ].map((o) => byHeader(GOAL_COLUMNS, o)),
]);

/** CSV or tab-separated text as rows: the one reader (domain/sheets), kept under its old name for the set-up screens. */
export const parseTable = (text: string): string[][] => parseDelimited(text).map((r) => r.map((c) => c.trim()));

/** Initials from a name: the first letters of its first two words. */
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).slice(0, 2).join('') || '?';

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';
const SHORT: Record<string, string> = { p: 'p', team: 't', goal: 'g' };

/**
 * A new workspace from people and goals (tab-separated or CSV text), or from a file's sheets (`tables`: its Goals, Plan
 * and Check-ins; its people come in `people`, as the set-up steps show them). The person on the first row is whoever is
 * setting up: its first admin.
 */
/** The weekly review set-up promises (setup review, 8 Nov): everyone, every goal at every level, on the review day. */
export const WEEKLY_REVIEW = 'Weekly review';
/** The views every new workspace starts with, pinned for everyone by the person who set it up: the same questions the
    demo's pinned views answer, in words that fit any workspace. */
export const DEFAULT_VIEWS: [string, string][] = [
  ['Everything at a glance', 'show=levels&view=table'],
  [`${LABEL.off} or ${LABEL.risk.toLowerCase()}`, 'status=off,risk&sort=worst'],
  ['No update for 2 weeks or more', 'quiet=2&sort=last'],
];

export function buildWorkspace(input: { name: string; startDate: string; people: string; goals: string; tables?: Tables; now: Date; idSuffix: string; reviewDay?: number; weeks?: number }): ImportResult {
  const weeks = input.weeks ?? yearWeeks(input.startDate);
  const cycle: Cycle = { id: 'cycle-' + input.idSuffix, name: weeks >= 48 ? yearName(input.startDate, weeks) : input.name.trim() || 'My cycle', startDate: input.startDate, weeks, reviewDay: input.reviewDay ?? 3 };
  const people = recordsOf(parseDelimited(input.people));
  const issues: ImportIssue[] = [];
  const head = (parseDelimited(input.people)[0] ?? []).map((h) => h.trim().toLowerCase());
  if (!head.includes('name') || !head.includes('team')) issues.push({ table: 'People', row: 1, message: 'The header row needs at least “Name”, “Email” and “Team”.' });
  const goals = input.tables?.goals ?? (input.goals.trim() ? recordsOf(parseDelimited(input.goals)) : []);
  const goalHead = input.tables?.goals ? Object.keys(input.tables.goals[0] ?? {}) : (parseDelimited(input.goals)[0] ?? []).map((h) => h.trim().toLowerCase());
  if (goals.length && (!goalHead.includes('goal') || !(goalHead.includes('owner') || goalHead.includes('owner email')))) issues.push({ table: 'Goals', row: 1, message: 'The header row needs at least “Goal”, “Team” and “Owner email” (or “Owner”).' });

  // Readable IDs, unique within the workspace and long enough that two workspaces never share one.
  const ids = new Set<string>();
  let n = 0;
  const newId = (prefix: string, hint?: string) => {
    const base = hint ? `${SHORT[prefix] ?? prefix}-${slug(hint)}` : `${prefix}-${++n}`;
    let id = `${base}-${input.idSuffix}`, k = 2;
    while (ids.has(id)) id = `${base}-${k++}-${input.idSuffix}`;
    ids.add(id);
    return id;
  };
  const empty: Snapshot = { people: [], teams: [], cycles: [cycle], goals: [], checkIns: [], decisions: [], changes: [], watches: [], reviews: [], retros: [], requests: [] };
  const setter: Person = { id: 'setting-up', name: '', role: '', initials: '', teamId: null, admin: true };
  const cs = planChanges({
    tables: { people, goals, ...(input.tables?.plan ? { plan: input.tables.plan } : {}), ...(input.tables?.checkIns ? { checkIns: input.tables.checkIns } : {}) },
    snapshot: empty, cycle, week: Math.max(0, currentWeek(cycle, input.now)), actor: setter, now: input.now.toISOString(), newId, via: 'setup', mode: 'create',
  });
  const notes: ImportIssue[] = [];
  // Must fix blocks set-up. A Check is a question set-up's own steps don't ask yet (IM8 brings it the import's preview):
  // one that stopped its row from being built blocks set-up too, so no row is ever quietly left out; one the row was read
  // past, and how a row was read, are said beside the row.
  // (A row a Must fix already stops says that first, and only that.)
  const rowOf = (i: { sheet: string; row: number }) => `${i.sheet}\t${i.row}`;
  const built = new Set(cs.items.map(rowOf));
  const mustRows = new Set(cs.issues.filter((i) => i.level === 'must').map(rowOf));
  const blocks = (i: (typeof cs.issues)[number]) => i.level === 'must' || (i.level === 'check' && !built.has(rowOf(i)) && !mustRows.has(rowOf(i)));
  for (const i of cs.issues) (blocks(i) ? issues : notes).push({ table: i.sheet, row: i.row, message: i.name && !i.message.includes(i.name) ? `“${i.name}”: ${i.message}` : i.message });
  if (!people.length && !issues.length) issues.push({ table: 'People', row: 1, message: 'Add at least one person.' });
  const c = cs.created!;
  // The weekly review and the pinned views, set up by the first person (you).
  const at = input.now.toISOString(), by = c.people[0]?.id ?? 'setting-up';
  const review: Review = { id: newId('rev', 'weekly'), name: WEEKLY_REVIEW, everyWeeks: 1, weekday: cycle.reviewDay, scope: { goals: [], trees: [], levels: levelIds(cycle) }, people: c.people.map((p) => p.id), createdBy: by, createdAt: at };
  const views: SavedView[] = DEFAULT_VIEWS.map(([name, params]) => ({ id: newId('view', name), personId: by, name, params, pinned: true, createdAt: at, updatedAt: at, deletedAt: null }));
  const logged: Change = { id: newId('chg', 'weekly review'), at, actorId: by, goalId: null, entity: 'review', entityId: review.id, action: 'created', summary: `Set up a review: “${review.name}”`, diffs: [{ field: 'Review', from: '—', to: review.name }] };
  return { snapshot: { ...empty, people: c.people, teams: c.teams, goals: c.goals, checkIns: c.checkIns, requests: c.requests, reviews: [review], views, changes: [logged], ...(c.keysIssued ? { keysIssued: c.keysIssued } : {}) }, issues, ...(notes.length ? { notes } : {}) };
}

/** Today's Monday, as an ISO date: the default start of a new cycle. */
export function thisMonday(today: Date): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
