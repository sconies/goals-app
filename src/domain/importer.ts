/* Load your own data: people and goals pasted from a spreadsheet (tab-separated) or a CSV file.
   Every row is checked with the same rules as the app's own forms before anything is saved. */
import { blankGoal, buildGoal, validateGoal, type GoalDraft } from './goal';
import type { Cycle, Goal, Level, Person, PlanShape, Snapshot, Team } from './types';

export interface ImportIssue {
  table: 'People' | 'Goals';
  row: number;
  message: string;
}

export interface ImportResult {
  snapshot: Snapshot;
  issues: ImportIssue[];
}

export const PEOPLE_COLUMNS = ['Name', 'Job title', 'Team', 'Admin', 'Team objective'] as const;
export const GOAL_COLUMNS = ['Goal', 'Team', 'Owner', 'Type', 'Unit', 'Start', 'Target', 'Plan', 'Limit', 'Must stay', 'Margin', 'Stages', 'Feeds into', 'Level', 'Effect', 'Source'] as const;

export const PEOPLE_TEMPLATE = [
  PEOPLE_COLUMNS.join('\t'),
  'Ana Silva\tVP Engineering\tLeadership\tyes\t',
  'Ben Ortiz\tPlatform lead\tPlatform\t\tMake every deploy safe and fast',
  'Chloe Wu\tEngineering manager\tPlatform\t\t',
  'Dev Patel\tEngineer\tPlatform\t\t',
].join('\n');

export const GOALS_TEMPLATE = [
  GOAL_COLUMNS.join('\t'),
  'Deploy lead time\tPlatform\tBen Ortiz\tmetric\tdays\t5\t1\tback-loaded\t\t\t\t\t\tnorth star\t\tCI dashboard',
  'Deploys rolled back\tPlatform\tBen Ortiz\trange\t%\t\t\t\t5\tat most\t1\t\tDeploy lead time\t\t\tCI dashboard',
  'Canary releases live\tPlatform\tBen Ortiz\tmilestone\t\t\t\t\t\t\t\tDesign@2; Pilot@6; All services@10\tDeploy lead time\t\t1\tJira PLAT epics',
].join('\n');

/** Split CSV or tab-separated text into rows, honouring quoted cells. */
export function parseTable(text: string): string[][] {
  const t = text.replace(/\r\n?/g, '\n').trim();
  if (!t) return [];
  const sep = t.split('\n')[0]!.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell.trim());
  rows.push(row);
  return rows.filter((r) => r.some((c) => c !== ''));
}

/** Rows as objects keyed by lower-case header. */
function records(text: string): { header: string[]; rows: Record<string, string>[] } {
  const [head, ...body] = parseTable(text);
  const header = (head ?? []).map((h) => h.toLowerCase());
  return { header, rows: body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))) };
}

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).slice(0, 2).join('') || '?';
/** Old spreadsheets had a Profile column; sponsors and coaches there become admins. */
const OLD_ADMIN_PROFILES = ['sponsor', 'coach', 'goals coach'];

export function levelOf(r: Record<string, string>): Level {
  const v = (r['level'] ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (v.startsWith('north') || yes(r['headline'] ?? '')) return 'north-star';
  if (v === 'svp' || v.startsWith('senior')) return 'svp';
  return 'team';
}
export const yes = (s: string) => /^(y|yes|true|1|x)$/i.test(s.trim());

export function shapeOf(s: string): PlanShape | null {
  const v = s.trim().toLowerCase();
  if (!v || v.startsWith('straight') || v === 'linear') return 'straight';
  if (v.startsWith('back')) return 'back';
  if (v.startsWith('step')) return 'stepped';
  return null;
}

export function buildWorkspace(input: { name: string; startDate: string; people: string; goals: string; now: Date; idSuffix: string; reviewDay?: number }): ImportResult {
  const issues: ImportIssue[] = [];
  const cycle: Cycle = { id: 'cycle-' + input.idSuffix, name: input.name.trim() || 'My cycle', startDate: input.startDate, weeks: 13, reviewDay: input.reviewDay ?? 3 };

  // People and teams
  const p = records(input.people);
  if (!p.header.includes('name') || !p.header.includes('team')) issues.push({ table: 'People', row: 1, message: 'The header row needs at least “Name” and “Team”.' });
  const people: Person[] = [], teams: Team[] = [];
  const ids = new Set<string>();
  const unique = (base: string) => { let id = `${base}-${input.idSuffix}`, n = 2; while (ids.has(id)) id = `${base}-${n++}-${input.idSuffix}`; ids.add(id); return id; };
  p.rows.forEach((r, i) => {
    const row = i + 2;
    const name = r['name'] ?? '', teamName = r['team'] ?? '';
    if (!name) return issues.push({ table: 'People', row, message: 'Name is empty.' });
    if (!teamName) return issues.push({ table: 'People', row, message: `${name} has no team.` });
    const admin = yes(r['admin'] ?? '') || OLD_ADMIN_PROFILES.includes((r['profile'] ?? '').toLowerCase());
    let team = teams.find((t) => t.name.toLowerCase() === teamName.toLowerCase());
    if (!team) { team = { id: unique('t-' + slug(teamName)), name: teamName, leadId: '', objective: '' }; teams.push(team); }
    if (!team.objective && r['team objective']) team.objective = r['team objective'];
    const person: Person = { id: unique('p-' + slug(name)), name, role: r['job title'] || '', initials: initials(name), teamId: team.id, admin };
    if (people.some((x) => x.name.toLowerCase() === name.toLowerCase())) issues.push({ table: 'People', row, message: `${name} appears twice; owners are matched by name, so names must be unique.` });
    people.push(person);
  });
  for (const t of teams) if (!t.leadId) t.leadId = people.find((x) => x.teamId === t.id)?.id ?? '';
  if (!people.length && !issues.length) issues.push({ table: 'People', row: 1, message: 'Add at least one person.' });

  // Goals
  const g = records(input.goals);
  const goals: Goal[] = [];
  const parentOf = new Map<string, { title: string; row: number }>();
  if (input.goals.trim() && (!g.header.includes('goal') || !g.header.includes('owner'))) issues.push({ table: 'Goals', row: 1, message: 'The header row needs at least “Goal”, “Team” and “Owner”.' });
  g.rows.forEach((r, i) => {
    const row = i + 2;
    const title = r['goal'] ?? '';
    const owner = people.find((x) => x.name.toLowerCase() === (r['owner'] ?? '').toLowerCase());
    const team = teams.find((t) => t.name.toLowerCase() === (r['team'] ?? '').toLowerCase()) ?? teams.find((t) => t.id === owner?.teamId);
    if (!owner) return issues.push({ table: 'Goals', row, message: `Owner “${r['owner'] ?? ''}” isn’t in the people list.` });
    if (!team) return issues.push({ table: 'Goals', row, message: `Team “${r['team'] ?? ''}” isn’t in the people list.` });
    const kindRaw = (r['type'] || 'metric').toLowerCase();
    const kind = kindRaw.startsWith('mile') ? 'milestone' : kindRaw.startsWith('range') || kindRaw.startsWith('keep') ? 'range' : kindRaw.startsWith('metric') || kindRaw.startsWith('move') ? 'metric' : null;
    if (!kind) return issues.push({ table: 'Goals', row, message: `Type “${r['type']}” should be metric, range or milestone.` });
    const shape = shapeOf(r['plan'] ?? '');
    if (!shape) issues.push({ table: 'Goals', row, message: `Plan “${r['plan']}” should be straight, back-loaded or stepped; using straight.` });
    const stages = (r['stages'] ?? '').split(/;|\n/).map((x) => x.trim()).filter(Boolean).map((x, k) => {
      const m = /^(.*?)\s*@\s*(?:wk|week)?\s*(\d+)\s*$/i.exec(x);
      return { id: 's' + (k + 1), name: m ? m[1]!.trim() : x, dueWeek: m ? m[2]! : '' };
    });
    const unit = (r['unit'] ?? '').trim();
    const d: GoalDraft = {
      ...blankGoal(team.id, owner.id, ''),
      kind, title, level: levelOf(r), io: levelOf(r) === 'north-star' ? 'output' : 'input',
      effect: r['effect'] ?? '', source: r['source'] ?? '', definition: '',
      unit: kind === 'milestone' ? '' : unit, decimals: String(Math.min(3, Math.max(0, ...[r['start'], r['target'], r['limit']].map((v) => ((v ?? '').split('.')[1] ?? '').length)))),
      start: r['start'] ?? '', target: r['target'] ?? '', shape: shape ?? 'straight',
      bound: /least|min|≥|>=/i.test(r['must stay'] ?? '') ? 'atLeast' : 'atMost', limit: r['limit'] ?? '', margin: r['margin'] || '0',
      stages: stages.length ? stages : [{ id: 's1', name: '', dueWeek: '' }],
    };
    const errs = validateGoal(d, cycle);
    const msgs = Object.values(errs);
    if (msgs.length) return issues.push({ table: 'Goals', row, message: `“${title || 'Untitled'}”: ${msgs.join(' ')}` });
    const id = unique('g-' + slug(title));
    goals.push(buildGoal(d, cycle, { id, createdAt: new Date(input.now.getTime() + i).toISOString() }, null, false, 0));
    if (r['feeds into']) parentOf.set(id, { title: r['feeds into'], row });
  });
  for (const [id, { title, row }] of parentOf) {
    const parent = goals.find((x) => x.title.toLowerCase() === title.toLowerCase());
    const goal = goals.find((x) => x.id === id)!;
    if (!parent) issues.push({ table: 'Goals', row, message: `“${goal.title}” feeds into “${title}”, which isn’t in the goals list.` });
    else if (parent.id === id) issues.push({ table: 'Goals', row, message: `“${goal.title}” can’t feed into itself.` });
    else goal.parentId = parent.id;
  }

  return { snapshot: { people, teams, cycles: [cycle], goals, checkIns: [], decisions: [], changes: [], watches: [], reviews: [], retros: [] }, issues };
}

/** Today's Monday, as an ISO date: the default start of a new cycle. */
export function thisMonday(today: Date): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

