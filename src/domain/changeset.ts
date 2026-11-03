/* Bulk changes: the one way in for a spreadsheet, the bulk check-in grid, table actions and the MCP.
   parse → validate → preview → apply → log. Every row is checked with the same rules as the app's own forms
   (validateGoal, buildGoal, evaluate, toCheckIn), and nothing is saved until the whole set is valid. */
import type { Commit } from '../data/store';
import { goalChange, checkInChange, type Lookup } from './changes';
import { CAUSES_AHEAD, CAUSES_BEHIND, evaluate, parseNumber, toCheckIn, type Draft } from './checkin';
import { blankGoal, buildGoal, draftOf, goalAsOf, planChanged, replanned, validateGoal, type GoalDraft } from './goal';
import { levelOf, parseTable, shapeOf } from './importer';
import { planAt, planEnd, weekDate } from './plan';
import { checkInsFor } from './status';
import { makesLoop } from './tree';
import { personChange, personProblems } from './people';
import { requestsAfterCheckIn } from './requests';
import { initials } from './importer';
import type { Change, CheckIn, Cycle, Diff, Goal, HelpRequest, MetricGoal, MetricPlan, Person, RecoveryState, Snapshot, StageUpdate, Status } from './types';

/** A row as a header → value map (lower-case headers), and its row number in the sheet. */
export type Rec = Record<string, string> & { __row?: string };
export interface Tables { goals?: Rec[]; plan?: Rec[]; checkIns?: Rec[]; people?: Rec[] }
export type Via = 'spreadsheet' | 'bulk' | 'mcp' | 'table';
export const VIA_LABEL: Record<Via, string> = { spreadsheet: 'Spreadsheet', bulk: 'Bulk edit', mcp: 'AI assistant (MCP)', table: 'Data tables' };

export interface Issue { sheet: 'Goals' | 'Plan' | 'Check-ins' | 'People'; row: number; goal: string; message: string; severity: 'error' | 'warning' }
export interface Item {
  sheet: Issue['sheet'];
  row: number;
  goalId: string;
  goal: string;
  kind: 'new goal' | 'goal' | 'plan' | 'check-in' | 'replaces check-in' | 'person';
  summary: string;
  diffs: Diff[];
  backfilled?: boolean;
  /** A plan change after check-ins started: it needs a reason. */
  needsReason?: boolean;
}
export interface ChangeSet {
  items: Item[];
  unchanged: number;
  issues: Issue[];
  /** Some plan changes need a reason and none was given. */
  needsReason: boolean;
  /** Ready to save: null while there are errors or a reason is missing. */
  commit: Commit | null;
  counts: { newGoals: number; goals: number; plans: number; checkIns: number; backfilled: number; replaced: number; people: number };
}

export interface ChangeInput {
  tables: Tables;
  snapshot: Snapshot;
  cycle: Cycle;
  week: number;
  actor: Person;
  /** Now, as an ISO timestamp. */
  now: string;
  newId: (prefix: string) => string;
  via: Via;
  /** One reason for every plan change that needs one (a row's own Reason column wins). */
  reason?: string;
}

/* ---------- reading files ---------- */

/** Rows as records keyed by lower-case header, with the sheet's row number. */
export function records(tsv: string): Rec[] {
  const [head, ...body] = parseTable(tsv);
  const header = (head ?? []).map((h) => h.trim().toLowerCase());
  return body.map((r, i) => {
    const rec: Rec = { __row: String(i + 2) };
    header.forEach((h, k) => { if (h) rec[h] = (r[k] ?? '').trim(); });
    return rec;
  });
}

/** Which sheet a table is, from its name or its header. */
export function sheetKind(name: string, tsv: string): keyof Tables | null {
  const n = name.toLowerCase();
  const head = (tsv.split('\n')[0] ?? '').toLowerCase().split('\t').map((x) => x.trim());
  if (/check/.test(n) || (head.includes('week') && (head.includes('goal id') || head.includes('value') || head.includes('call')))) return 'checkIns';
  if (/plan/.test(n) || head.some((h) => /^week \d+$/.test(h))) return 'plan';
  if (/goal/.test(n) || head.includes('goal')) return 'goals';
  return null;
}

/* ---------- helpers ---------- */

const norm = (s: string) => s.trim().toLowerCase();
const has = (r: Rec, k: string) => Object.prototype.hasOwnProperty.call(r, k);
const val = (r: Rec, k: string) => (r[k] ?? '').trim();
const rowOf = (r: Rec, i: number) => Number(r.__row ?? i + 2);

const CALLS: Record<string, Status> = { 'on track': 'on', on: 'on', green: 'on', 'at risk': 'risk', risk: 'risk', amber: 'risk', 'off track': 'off', off: 'off', red: 'off', done: 'done' };
const RECOVERY: Record<string, RecoveryState> = { plan: 'plan', 'still investigating': 'investigating', investigating: 'investigating', 'needs a decision or help': 'help', help: 'help', 'target should change': 'target', target: 'target' };
const causeOf = (s: string) => {
  const v = norm(s);
  if (!v) return null;
  return [...CAUSES_BEHIND, ...CAUSES_AHEAD].find(([k, l]) => k === v || norm(l) === v)?.[0] ?? undefined;
};

/** "4 new goals, 2 goals changed, 38 check-ins (36 loaded later)" */
export function describe(cs: ChangeSet): string {
  const c = cs.counts;
  const parts = [
    c.newGoals && `${c.newGoals} new ${c.newGoals === 1 ? 'goal' : 'goals'}`,
    c.goals && `${c.goals} ${c.goals === 1 ? 'goal' : 'goals'} changed`,
    c.plans && `${c.plans} ${c.plans === 1 ? 'plan' : 'plans'} changed`,
    c.checkIns && `${c.checkIns} ${c.checkIns === 1 ? 'check-in' : 'check-ins'}${c.backfilled ? ` (${c.backfilled} for past weeks)` : ''}`,
    c.replaced && `${c.replaced} replaced`,
    c.people && `${c.people} ${c.people === 1 ? 'person' : 'people'} changed`,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'No changes';
}

/* ---------- the change set ---------- */

export function planChanges(input: ChangeInput): ChangeSet {
  const { snapshot: s, cycle, week, actor, now, newId, via } = input;
  const issues: Issue[] = [];
  const items: Item[] = [];
  let unchanged = 0;
  const err = (sheet: Issue['sheet'], row: number, goal: string, message: string) => issues.push({ sheet, row, goal, message, severity: 'error' });
  const warn = (sheet: Issue['sheet'], row: number, goal: string, message: string) => issues.push({ sheet, row, goal, message, severity: 'warning' });
  // People first, so a goal row can name someone by the name this same change gives them.
  const people = new Map<string, Person>(s.people.map((p) => [p.id, p]));
  const peopleTouched: { before: Person; row: number }[] = [];
  (input.tables.people ?? []).forEach((r, i) => {
    const row = rowOf(r, i);
    const id = val(r, 'id');
    if (Object.entries(r).every(([k, v]) => k === '__row' || !v)) return;
    const before = id ? s.people.find((p) => p.id === id) : undefined;
    if (!before) return err('People', row, val(r, 'name'), id ? `There’s no person with ID ${id}.` : 'Add new people under Workspace; here you change the people already in it.');
    const teamName = has(r, 'team') ? val(r, 'team') : null;
    const tm = teamName ? s.teams.find((t) => norm(t.name) === norm(teamName)) : null;
    if (teamName && !tm) return err('People', row, before.name, `There’s no team called “${teamName}”.`);
    const adminRaw = has(r, 'admin') ? norm(val(r, 'admin')) : null;
    if (adminRaw != null && !['', 'yes', 'no', 'true', 'false', 'y', 'n'].includes(adminRaw)) return err('People', row, before.name, `Admin should be yes or no, not “${val(r, 'admin')}”.`);
    const name = has(r, 'name') ? val(r, 'name') : before.name;
    const after: Person = {
      ...before, name, initials: name === before.name ? before.initials : initials(name),
      role: has(r, 'job title') ? val(r, 'job title') : before.role,
      teamId: teamName == null ? before.teamId : tm?.id ?? null,
      admin: adminRaw == null ? before.admin : ['yes', 'true', 'y'].includes(adminRaw),
    };
    if (JSON.stringify(after) === JSON.stringify(before)) { unchanged++; return; }
    if (!actor.admin) return err('People', row, before.name, 'Only an admin can change people.');
    people.set(id, after);
    peopleTouched.push({ before, row });
  });
  for (const t of peopleTouched) {
    const after = people.get(t.before.id)!;
    const problems = personProblems(after, [...people.values()], t.before);
    if (problems.length) err('People', t.row, t.before.name, problems.join(' '));
  }
  const person = (name: string) => [...people.values()].find((p) => norm(p.name) === norm(name));
  const team = (name: string) => s.teams.find((t) => norm(t.name) === norm(name));

  // The working set: goals as they will be after this change, by id.
  const work = new Map<string, Goal>(s.goals.map((g) => [g.id, g]));
  const touched = new Map<string, { before: Goal | null; row: number; sheet: Issue['sheet']; reason: string; plan: boolean }>();
  const started = (id: string) => s.checkIns.some((c) => c.goalId === id);
  const canChange = (g: Goal) => actor.admin || g.ownerId === actor.id;
  const notYours = (g: Goal) => `Only ${s.people.find((p) => p.id === g.ownerId)?.name ?? 'its owner'} (its owner) or an admin can change “${g.title}”.`;
  const parentLinks: { id: string; row: number; byId: string; byTitle: string }[] = [];

  /* Goals */
  (input.tables.goals ?? []).forEach((r, i) => {
    const row = rowOf(r, i);
    const id = val(r, 'id');
    const title = val(r, 'goal');
    if (!id && !title && Object.entries(r).every(([k, v]) => k === '__row' || !v)) return;
    const existing = id ? work.get(id) ?? null : null;
    if (id && !existing) return err('Goals', row, title || id, `There’s no goal with ID ${id} in ${cycle.name}. Leave ID empty to add a new goal.`);
    if (!existing) {
      if (!title) return err('Goals', row, '', 'Name the goal in the Goal column.');
      const same = [...work.values()].find((g) => norm(g.title) === norm(title));
      if (same) return err('Goals', row, title, `A goal called “${same.title}” already exists. Put its ID in the ID column to change it, or give this one another name.`);
    }
    const ownerName = val(r, 'owner');
    const owner = ownerName ? person(ownerName) : null;
    if (ownerName && !owner) return err('Goals', row, title || existing?.title || '', `“${ownerName}” isn’t in this workspace. Add them under Workspace first, or check the spelling.`);
    if (!existing && !owner) return err('Goals', row, title, 'A new goal needs an Owner.');
    if (!existing && owner && !actor.admin && owner.id !== actor.id) return err('Goals', row, title, 'You can add goals you own. Ask an admin to add goals for other people.');
    const teamName = val(r, 'team');
    const tm = teamName ? team(teamName) : null;
    if (teamName && !tm) return err('Goals', row, title || existing?.title || '', `There’s no team called “${teamName}”.`);

    const d: GoalDraft = existing ? draftOf(existing) : blankGoal(tm?.id ?? owner?.teamId ?? s.teams[0]?.id ?? '', owner!.id, '');
    if (title) d.title = title;
    if (owner) d.ownerId = owner.id;
    if (tm) d.teamId = tm.id;
    if (val(r, 'level')) d.level = levelOf({ level: val(r, 'level') });
    const typeRaw = norm(val(r, 'type'));
    if (typeRaw) {
      const kind = typeRaw.startsWith('mile') || typeRaw.startsWith('hit') ? 'milestone' : typeRaw.startsWith('range') || typeRaw.startsWith('keep') ? 'range' : typeRaw.startsWith('metric') || typeRaw.startsWith('move') ? 'metric' : null;
      if (!kind) return err('Goals', row, d.title, `Type “${val(r, 'type')}” should be metric, range or milestone.`);
      if (existing && kind !== existing.kind) return err('Goals', row, d.title, 'A goal’s type can’t change. Add a new goal instead.');
      d.kind = kind;
    }
    if (!existing && !typeRaw) d.kind = 'metric';
    if (has(r, 'unit') && d.kind !== 'milestone') d.unit = val(r, 'unit');
    if (val(r, 'decimals')) d.decimals = val(r, 'decimals');
    else if (!existing && d.kind !== 'milestone') d.decimals = String(Math.min(3, Math.max(0, ...['start', 'target', 'limit'].map((k) => (val(r, k).split('.')[1] ?? '').length))));
    if (val(r, 'start')) d.start = val(r, 'start');
    if (val(r, 'target')) d.target = val(r, 'target');
    if (val(r, 'plan')) {
      const sh = shapeOf(val(r, 'plan'));
      if (!sh) return err('Goals', row, d.title, `Plan “${val(r, 'plan')}” should be straight, back-loaded or stepped.`);
      if (sh !== d.shape) { d.shape = sh; d.points = {}; }
    }
    if (has(r, 'due week') && d.kind === 'metric') {
      const w = val(r, 'due week');
      const n = parseNumber(w);
      if (w && (n == null || !Number.isInteger(n) || n < 1 || n > 104)) return err('Goals', row, d.title, 'Due week should be a whole number of weeks from the cycle start, up to 104.');
      d.endWeek = w && n !== cycle.weeks ? String(n) : '';
    }
    if (val(r, 'limit')) d.limit = val(r, 'limit');
    if (val(r, 'must stay')) d.bound = /least|min|≥|>=/i.test(val(r, 'must stay')) ? 'atLeast' : 'atMost';
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
    const errs = Object.values(validateGoal(d, cycle));
    if (errs.length) return err('Goals', row, d.title, errs.join(' '));

    const gid = existing?.id ?? newId('goal');
    if (has(r, 'feeds into id') || has(r, 'feeds into')) parentLinks.push({ id: gid, row, byId: val(r, 'feeds into id'), byTitle: val(r, 'feeds into') });
    let built = buildGoal({ ...d, parentId: existing?.parentId ?? '' }, cycle, { id: gid, createdAt: existing?.createdAt ?? now }, existing, started(gid), week);
    if (existing) built = { ...existing, ...built } as Goal;
    if (existing && d.whyHelps === '' && 'whyHelps' in built) delete (built as { whyHelps?: string }).whyHelps;
    work.set(gid, built);
    touched.set(gid, { before: existing, row, sheet: 'Goals', reason: val(r, 'reason') || val(r, 'reason for change'), plan: !!existing && planChanged(existing, built) });
  });

  // Links, once every goal in the file exists: by ID, else by name.
  for (const l of parentLinks) {
    const g = work.get(l.id)!;
    let parentId: string | null = null;
    if (l.byId) {
      if (!work.has(l.byId)) { err('Goals', l.row, g.title, `Feeds into ID ${l.byId} isn’t a goal in ${cycle.name}.`); continue; }
      parentId = l.byId;
    } else if (l.byTitle) {
      const p = [...work.values()].find((x) => norm(x.title) === norm(l.byTitle));
      if (!p) { err('Goals', l.row, g.title, `“${g.title}” feeds into “${l.byTitle}”, which isn’t a goal in ${cycle.name}.`); continue; }
      parentId = p.id;
    }
    if (parentId === l.id) { err('Goals', l.row, g.title, 'A goal can’t feed into itself.'); continue; }
    if (parentId && makesLoop(l.id, parentId, [...work.values()])) { err('Goals', l.row, g.title, 'That link would make a loop: the goal it feeds already feeds into it.'); continue; }
    const next = { ...g, parentId } as Goal;
    if (!parentId) { next.effect = null; delete next.whyHelps; }
    work.set(l.id, next);
  }

  /* Plan numbers */
  (input.tables.plan ?? []).forEach((r, i) => {
    const row = rowOf(r, i);
    const id = val(r, 'id');
    if (!id) { if (val(r, 'goal')) err('Plan', row, val(r, 'goal'), 'Add the goal’s ID so the plan can be matched to it.'); return; }
    const g = work.get(id);
    if (!g) return err('Plan', row, val(r, 'goal') || id, `There’s no goal with ID ${id}.`);
    if (g.kind !== 'metric') return err('Plan', row, g.title, 'Only number goals have plan numbers.');
    const from = g.plan.fromWeek ?? 0, end = planEnd(g.plan, cycle.weeks);
    const typed = new Map<number, number>();
    for (const [k, v] of Object.entries(r)) {
      const m = /^week (\d+)$/.exec(k);
      if (!m || !v) continue;
      const n = parseNumber(v);
      if (n == null) return err('Plan', row, g.title, `Week ${m[1]}: “${v}” isn’t a number.`);
      typed.set(Number(m[1]), n);
    }
    const tol = 0.5 * 10 ** -g.decimals;
    const changed = [...typed].some(([w, v]) => w > from && w <= end && Math.abs(v - (w === end ? g.plan.target : planAt(g.plan, w, cycle.weeks))) > tol);
    if (!changed) { if (!touched.has(id)) unchanged++; return; }
    if (!canChange(g)) return err('Plan', row, g.title, notYours(g));
    const target = typed.get(end) ?? g.plan.target;
    if (target === g.plan.start) return err('Plan', row, g.title, 'The target has to differ from the start.');
    const points = [...typed].filter(([w]) => w > from && w < end).sort((a, b) => a[0] - b[0]).map(([week, value]) => ({ week, value }));
    const plan: MetricPlan = { ...g.plan, target, ...(points.length ? { points } : {}) };
    const before = touched.get(id)?.before ?? s.goals.find((x) => x.id === id)!;
    const original = before as MetricGoal;
    const next: MetricGoal = { ...g, plan, ...replanned(original, plan, started(id), week) };
    work.set(id, next);
    const t = touched.get(id);
    touched.set(id, { before, row: t?.row ?? row, sheet: t?.sheet ?? 'Plan', reason: t?.reason || val(r, 'reason'), plan: true });
  });

  /* Goals: what changed, and the reasons plan changes need */
  const lookup: Lookup = {
    person: (pid) => s.people.find((p) => p.id === pid),
    goal: (gid) => work.get(gid),
    teamName: (tid) => s.teams.find((t) => t.id === tid)?.name ?? tid,
  };
  const goalOut: Goal[] = [];
  const changes: Change[] = [];
  let needsReason = false;
  for (const [id, t] of touched) {
    const after = work.get(id)!;
    const ch = goalChange(t.before, after, lookup, actor.id, now, newId('chg'));
    if (!ch) { unchanged++; continue; }
    // Rows for other people's goals are fine as long as they don't change anything (a full workbook carries them all).
    if (t.before && !canChange(t.before)) { err(t.sheet, t.row, t.before.title, notYours(t.before)); continue; }
    const needs = !!t.before && t.plan && started(id);
    const reason = t.reason || input.reason?.trim() || '';
    if (needs && !reason) needsReason = true;
    if (needs && reason) ch.diffs.push({ field: 'Why', from: '—', to: reason });
    goalOut.push(after);
    changes.push(ch);
    items.push({ sheet: t.sheet, row: t.row, goalId: id, goal: after.title, kind: !t.before ? 'new goal' : t.plan ? 'plan' : 'goal', summary: ch.summary, diffs: ch.diffs, needsReason: needs });
  }

  /* Check-ins */
  const ciOut: CheckIn[] = [];
  const seen = new Set<string>();
  const rows = (input.tables.checkIns ?? []).map((r, i) => ({ r, row: rowOf(r, i) }));
  const byTitle = new Map([...work.values()].map((g) => [norm(g.title), g]));
  const goalFor = (r: Rec) => (val(r, 'goal id') ? work.get(val(r, 'goal id')) : byTitle.get(norm(val(r, 'goal'))));
  // This file's check-ins so far, by goal: later weeks are judged with the earlier ones.
  const imported = new Map<string, CheckIn[]>();
  // Oldest first, so each week is judged with the weeks before it.
  rows.sort((a, b) => (goalFor(a.r)?.id ?? '').localeCompare(goalFor(b.r)?.id ?? '') || (parseNumber(val(a.r, 'week')) ?? 0) - (parseNumber(val(b.r, 'week')) ?? 0));
  for (const { r, row } of rows) {
    if (Object.entries(r).every(([k, v]) => k === '__row' || !v)) continue;
    const g = goalFor(r);
    const name = val(r, 'goal') || val(r, 'goal id');
    if (!g) { err('Check-ins', row, name, val(r, 'goal id') ? `There’s no goal with ID ${val(r, 'goal id')}.` : `There’s no goal called “${val(r, 'goal')}”. Add the Goal ID column to be exact.`); continue; }
    const w = parseNumber(val(r, 'week'));
    if (w == null || !Number.isInteger(w) || w < 1) { err('Check-ins', row, g.title, w === 0 ? 'Check-ins start in week 1; week 0 is the start of the year.' : 'Week should be a whole number from 1, counted from the start of the year.'); continue; }
    if (w > week) { err('Check-ins', row, g.title, `Week ${w} hasn’t happened yet; it’s week ${week}.`); continue; }
    // The check-in's own ID, when the row has one, says exactly which check-in it is: it never changes, nor does its goal or week.
    const cid = val(r, 'id');
    const byId = cid ? s.checkIns.find((c) => c.id === cid) : undefined;
    if (cid && (!byId || byId.goalId !== g.id)) { err('Check-ins', row, g.title, `There’s no check-in with ID ${cid} on this goal. Leave ID empty to add a check-in.`); continue; }
    if (byId && byId.week !== w) { err('Check-ins', row, g.title, `Check-in ${cid} is for week ${byId.week}; a check-in’s week can’t change.`); continue; }
    const key = cid || g.id + ':' + w;
    if (seen.has(key)) { err('Check-ins', row, g.title, cid ? `Check-in ${cid} appears twice.` : `Week ${w} appears twice for this goal.`); continue; }
    seen.add(key);

    const ctx = [...checkInsFor(g, s.checkIns).filter((c) => c.week !== w), ...(imported.get(g.id) ?? [])];
    const prev = checkInsFor(g, ctx).filter((c) => c.week < w).pop() ?? null;
    let stages: StageUpdate[] = [];
    if (g.kind === 'milestone') {
      stages = g.stages.map((st) => prev?.stages?.find((u) => u.stageId === st.id) ?? { stageId: st.id, doneWeek: null, forecastWeek: null });
      const text = val(r, 'stages');
      let bad = '';
      for (const part of text.split(';').map((x) => x.trim()).filter(Boolean)) {
        const m = /^(.*?):\s*(done|expected|due)\s*(?:week|wk)?\s*(\d+)$/i.exec(part);
        const st = m && g.stages.find((x) => norm(x.name) === norm(m[1]!));
        if (!m || !st) { bad = part; break; }
        const n = Number(m[3]);
        stages = stages.map((u) => (u.stageId !== st.id ? u : m[2]!.toLowerCase() === 'done' ? { ...u, doneWeek: n, forecastWeek: null } : m[2]!.toLowerCase() === 'expected' ? { ...u, doneWeek: null, forecastWeek: n } : { ...u, doneWeek: null, forecastWeek: null }));
      }
      if (bad) { err('Check-ins', row, g.title, `Stages: “${bad}” should look like “Pilot: done week 6” or “Pilot: expected week 8”, using the stage’s name.`); continue; }
    }
    const callRaw = norm(val(r, 'call'));
    const call = callRaw ? CALLS[callRaw] : null;
    if (callRaw && !call) { err('Check-ins', row, g.title, `Call “${val(r, 'call')}” should be On track, At risk, Off track or Done, or empty to let the rules decide.`); continue; }
    // A row that says what's already there is left alone: history that hasn't changed isn't judged again.
    // A row for a week corrects that week's latest check-in (a spreadsheet has one row per goal and week).
    const existing = byId ?? checkInsFor(g, s.checkIns).filter((c) => c.week === w).pop() ?? null;
    if (existing && (!call || existing.status === call)
      && (g.kind === 'milestone' ? JSON.stringify(existing.stages ?? []) === JSON.stringify(stages) : existing.value === parseNumber(val(r, 'value')))
      && (!has(r, 'why') || val(r, 'why') === existing.why)) { unchanged++; imported.set(g.id, [...(imported.get(g.id) ?? []), existing]); continue; }
    if (!canChange(g)) { err('Check-ins', row, g.title, notYours(g)); continue; }
    // A week before the plan was changed is judged against the plan that applied then.
    const asOf: Goal = goalAsOf(g, w);
    const cause = causeOf(val(r, 'cause'));
    if (cause === undefined) { err('Check-ins', row, g.title, `Cause “${val(r, 'cause')}” isn’t one of: ${[...new Set([...CAUSES_BEHIND, ...CAUSES_AHEAD].map(([, l]) => l))].join(', ')}.`); continue; }
    const recRaw = norm(val(r, 'recovery'));
    const by = parseNumber(val(r, 'back on plan by week'));
    const draft: Draft = {
      value: g.kind === 'milestone' ? '' : val(r, 'value'),
      stages, status: call ?? null, cause: cause ?? null,
      why: val(r, 'why'), greenerWhy: val(r, 'why greener'), proposeTarget: '',
      ptgWhat: val(r, 'path to green'), ptgBy: by, ptgState: (recRaw && RECOVERY[recRaw]) || 'plan', needs: val(r, 'needs'),
      next: val(r, 'next step') || val(r, 'next'), dataFlagged: false,
    };
    const e = evaluate(asOf, cycle, w, draft, ctx);
    if (!e.canPost) {
      const hint: Record<string, string> = {
        'this week’s value': 'a Value', 'a number for this week’s value': 'a number in Value', 'a possible value': 'a possible Value',
        'why your call is greener': 'Why greener (the call is greener than the numbers)',
        'why it’s behind': 'a Cause and a Why of 10 characters or more (it’s behind plan)', 'why it’s ahead': 'a Cause and a Why of 10 characters or more (it’s ahead of plan)',
        'path to green': `a Path to green and, if it’s a plan, Back on plan by week (after week ${w}, by week ${cycle.weeks})`,
      };
      err('Check-ins', row, g.title, `Week ${w} needs ${e.missing.map((m) => hint[m] ?? m).join('; ')}.`);
      continue;
    }
    const backfilled = w < week;
    const due = new Date(Date.parse(weekDate(cycle, w) + 'T09:00:00Z') + cycle.reviewDay * 86_400_000);
    const at = backfilled && due.toISOString() < now ? due : new Date(now);
    const c: CheckIn = { ...toCheckIn(asOf, cycle, w, draft, ctx, actor.id, at, existing?.id ?? newId('ci')), ...(backfilled ? { backfilled: true } : {}) };
    if (existing && existing.authorId !== actor.id) warn('Check-ins', row, g.title, `Replaces ${s.people.find((p) => p.id === existing.authorId)?.name ?? 'someone'}’s check-in for week ${w}.`);
    const ch = checkInChange(existing, c, g, actor.id, newId('chg'));
    if (!ch) { unchanged++; continue; }
    ch.at = now;
    if (backfilled) ch.summary += ' (loaded later)';
    ciOut.push(c);
    imported.set(g.id, [...(imported.get(g.id) ?? []), c]);
    changes.push(ch);
    items.push({ sheet: 'Check-ins', row, goalId: g.id, goal: g.title, kind: existing ? 'replaces check-in' : 'check-in', summary: ch.summary, diffs: ch.diffs, backfilled });
  }

  /* Requests: a goal's latest check-in raises, continues or withdraws its request, as in the app (domain/requests). */
  const reqOut = new Map<string, HelpRequest>();
  for (const c of ciOut) {
    const later = s.checkIns.some((x) => x.goalId === c.goalId && x.week > c.week) || ciOut.some((x) => x.goalId === c.goalId && x.week > c.week);
    const g = work.get(c.goalId);
    if (later || !g) continue;
    const r = requestsAfterCheckIn(g, c, { ...s, requests: [...(s.requests ?? []).filter((x) => !reqOut.has(x.id)), ...reqOut.values()] }, actor.id, now, newId);
    for (const x of r.requests) reqOut.set(x.id, x);
    changes.push(...r.changes);
  }

  /* People: what changed */
  const peopleOut: Person[] = [];
  for (const t of peopleTouched) {
    const after = people.get(t.before.id)!;
    const ch = personChange(t.before, after, (tid) => s.teams.find((x) => x.id === tid)?.name ?? '', actor.id, now, newId('chg'));
    if (!ch) continue;
    peopleOut.push(after);
    changes.push(ch);
    items.push({ sheet: 'People', row: t.row, goalId: '', goal: after.name, kind: 'person', summary: ch.summary, diffs: ch.diffs });
  }

  for (const ch of changes) ch.diffs.push({ field: 'Via', from: '—', to: VIA_LABEL[via] });
  const posted = ciOut;
  const counts = {
    newGoals: items.filter((x) => x.kind === 'new goal').length,
    goals: items.filter((x) => x.kind === 'goal').length,
    plans: items.filter((x) => x.kind === 'plan').length,
    checkIns: items.filter((x) => x.kind === 'check-in' || x.kind === 'replaces check-in').length,
    backfilled: items.filter((x) => x.backfilled).length,
    replaced: items.filter((x) => x.kind === 'replaces check-in').length,
    people: items.filter((x) => x.kind === 'person').length,
  };
  const ok = !issues.some((x) => x.severity === 'error') && !needsReason && items.length > 0;
  const result: ChangeSet = { items, unchanged, issues, needsReason, commit: null, counts };
  if (ok) {
    const summary: Change = {
      id: newId('chg'), at: now, actorId: actor.id, goalId: null, entity: 'workspace', entityId: newId('imp'), action: 'imported',
      summary: `${via === 'spreadsheet' ? 'Loaded a spreadsheet' : via === 'mcp' ? 'Changes from an AI assistant' : via === 'table' ? 'Edited the data tables' : 'Bulk edit'}: ${describe(result).toLowerCase()}`, diffs: [{ field: 'Via', from: '—', to: VIA_LABEL[via] }],
    };
    // New goals before the goals that feed into them, so each link points at a goal that's already saved.
    const ordered: Goal[] = [];
    const pending = [...goalOut];
    while (pending.length) {
      const i = pending.findIndex((g) => !g.parentId || !pending.some((x) => x.id === g.parentId));
      ordered.push(...pending.splice(i < 0 ? 0 : i, 1));
    }
    result.commit = { ...(peopleOut.length ? { people: peopleOut } : {}), goals: ordered, checkIns: posted, ...(reqOut.size ? { requests: [...reqOut.values()] } : {}), changes: [...changes, summary] };
  }
  return result;
}
