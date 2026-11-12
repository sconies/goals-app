/* The conformance data (backlog 8b): what the core rules give for every goal in every week of the demo workspace, as
   plain CSV files under spec/conformance/, made by the real rules. A rebuild proves its rules by reading the same
   workspace (spec/conformance/workspace.json) and matching every row. src/spec/conformance.test.ts recomputes them
   from workspace.json and fails on any difference. Pure: no files are read or written here. */
import { attentionFor, attentionGroup, needsAttention } from '../domain/attention';
import { draftFrom, emptyDraft, evaluate } from '../domain/checkin';
import { currentWeek, goalAsOf, projectionFor, valueSeries, weekDate } from '../domain/plan';
import { goalScorecard } from '../domain/scorecard';
import { assessPosted, checkInsFor, daysWithoutUpdate, goalStatus } from '../domain/status';
import type { Ask, CheckIn, Cycle, Decision, Goal, Person, Review, Snapshot, Team } from '../domain/types';
import { search } from '../domain/find';
import { goalRows, personRows, teamRows } from '../app/reads';
import { litItem, menuGroups, pageName, phoneTabs, type PlaceNames } from '../domain/navigation';
import { planChanges } from '../domain/changeset';
import type { ModuleRows } from '../domain/records';
import MODULE_CONFORMANCE from 'virtual:faro-modules/conformance';

/** The moment the demo workspace is built for: Thursday 5 November 2026, noon UTC (week 45), as the evals pin it. */
export const CHECK_IN_MOMENT = '2026-11-05T12:00:00.000Z';

/** The records the core rules read: what spec/conformance/workspace.json holds. */
export interface ConformanceWorkspace {
  about: string;
  /** The moment the workspace was built for. Every record is as it stood then. */
  builtFor: string;
  cycle: Cycle;
  people: Pick<Person, 'id' | 'name' | 'teamId' | 'admin'>[];
  teams: Team[];
  goals: Goal[];
  checkIns: CheckIn[];
  decisions: Decision[];
  requests: Ask[];
  reviews: Pick<Review, 'id' | 'name'>[];
  /** Feature modules' own records (domain/records), by module and record, for the rows a module adds (ModuleConformance). */
  modules?: ModuleRows;
}

/**
 * A feature module's rows in the conformance data (its conformance.ts, through the module registry): one CSV file of
 * what its rules give in the demo workspace as it stood at `builtFor`. Not part of stage 1: the drill scores it when
 * asked (`"also"` in drill.json). `rows` is given `asOf`, so a module needs nothing else from here.
 */
export interface ModuleConformance {
  /** The file's name, without .csv. */
  file: string;
  header: string[];
  /** The columns that name a row (the drill matches rows by them). */
  keys: string[];
  /** What the file holds, for the conformance README: Markdown, one paragraph. */
  about: string;
  rows(w: ConformanceWorkspace, kit: { asOf: typeof asOf }): string[][];
}
/** The modules' conformance files in this build. */
export const MODULE_FILES: (ModuleConformance & { module: string })[] = MODULE_CONFORMANCE.flatMap((m) => m.part.map((c) => ({ ...c, module: m.id })));

/** The demo's records, trimmed to what the rules read, as workspace.json holds them. */
export function conformanceWorkspace(s: Snapshot): ConformanceWorkspace {
  const live = <T extends { removedAt?: string | null }>(xs: T[]) => xs.filter((x) => !x.removedAt);
  return {
    about: 'The demo workspace (Platform Engineering, src/data/platformOrg) as built for the moment below: the records the core rules read. See spec/conformance/README.md.',
    builtFor: CHECK_IN_MOMENT,
    cycle: s.cycles[0]!,
    people: live(s.people).map((p) => ({ id: p.id, name: p.name, teamId: p.teamId, admin: p.admin })),
    teams: s.teams,
    goals: live(s.goals),
    checkIns: live(s.checkIns),
    decisions: live(s.decisions),
    requests: s.requests ?? [],
    reviews: live(s.reviews).map((r) => ({ id: r.id, name: r.name })),
    ...(MODULE_FILES.length && s.modules ? { modules: Object.fromEntries(Object.entries(s.modules).filter(([id]) => MODULE_FILES.some((f) => f.module === id))) } : {}),
  };
}

/** The moment each week is judged at: its review day (the cycle's reviewDay, 0 = Monday) at noon UTC. */
export const weekMoment = (cycle: Cycle, week: number) => new Date(Date.parse(weekDate(cycle, week) + 'T12:00:00Z') + cycle.reviewDay * 86_400_000);

/**
 * The workspace as it stood at a moment: goals added by then and not stopped; check-ins posted by then; review notes
 * and marks made by then; asks raised by then, open again if they were answered, done or withdrawn later.
 */
export function asOf(w: ConformanceWorkspace, moment: Date): Snapshot {
  const t = moment.toISOString();
  const by = (iso: string | null | undefined) => !!iso && iso <= t;
  const requests = w.requests.filter((r) => by(r.createdAt)).map((r): Ask => {
    const closedAt = r.status === 'answered' || r.status === 'done' ? r.answeredAt : r.status === 'withdrawn' ? r.updatedAt : null;
    return r.status !== 'open' && !by(closedAt) ? { ...r, status: 'open', answer: null, answeredBy: null, answeredAt: null } : r;
  });
  return {
    people: w.people.map((p) => ({ ...p, role: '', initials: '' })),
    teams: w.teams,
    cycles: [w.cycle],
    goals: w.goals.filter((g) => by(g.createdAt) && !by(g.stoppedAt)),
    checkIns: w.checkIns.filter((c) => by(c.postedAt)),
    decisions: w.decisions.filter((d) => by(d.at)),
    changes: [], watches: [], retros: [],
    reviews: w.reviews.map((r) => ({ ...r, everyWeeks: 1, weekday: 0, scope: { goals: [], trees: [], levels: [] }, people: [], createdBy: '', createdAt: '' })),
    requests,
    ...(w.modules ? { modules: w.modules } : {}),
  };
}

/* ---------- the rows ---------- */

export interface ConformanceTables { status: string[][]; flags: string[][]; projection: string[][]; scorecard: string[][]; 'scorecard-words': string[][]; checkin: string[][] }

export const HEADERS: Record<keyof ConformanceTables, string[]> = {
  status: ['week', 'goal', 'kind', 'status', 'calculated', 'greener', 'latest_week', 'days_without_update'],
  flags: ['week', 'goal', 'flags', 'handled', 'needs_attention', 'attention_group'],
  projection: ['week', 'goal', 'kind', 'to_week', 'value', 'low', 'high', 'slope', 'first_week', 'last_week', 'forecast_misses'],
  // The scorecard's codes are scored; its words are a file of their own, so a rebuild in other words still scores (AS part 3; deep review A5).
  scorecard: ['week', 'goal', 'cell', 'tone', 'likelihood'],
  'scorecard-words': ['week', 'goal', 'cell', 'value', 'label', 'sub'],
  checkin: ['checkin', 'week', 'goal', 'calculated', 'reason', 'asks_target', 'needs_path', 'missing', 'call', 'greener', 'call_missing'],
};

/** A number as the files write it: up to 6 decimal places, no trailing zeros. */
const num = (v: number | null | undefined) => (v == null ? '' : String(Number(v.toFixed(6))));
const yes = (b: boolean) => (b ? 'yes' : 'no');
const keyOf = (g: Goal) => g.key ?? g.id;

/** Every row, for every week from 0 to the week the workspace was built for, and every goal there that week. */
export function conformanceTables(w: ConformanceWorkspace): ConformanceTables {
  const cycle = w.cycle;
  const last = currentWeek(cycle, new Date(w.builtFor));
  const out: ConformanceTables = { status: [], flags: [], projection: [], scorecard: [], 'scorecard-words': [], checkin: [] };
  for (let week = 0; week <= last; week++) {
    const moment = weekMoment(cycle, week);
    const s = asOf(w, moment);
    for (const goal of [...s.goals].sort((a, b) => keyOf(a).localeCompare(keyOf(b), 'en', { numeric: true }))) {
      const k = keyOf(goal), W = String(week);
      const st = goalStatus(goal, cycle, s.checkIns, moment);
      const latest = st.latest;
      out.status.push([W, k, goal.kind, st.status, st.calc, yes(st.greener), latest ? String(latest.week) : '', String(daysWithoutUpdate(goal, cycle, latest, moment))]);

      const a = attentionFor(goal, s, cycle, moment);
      out.flags.push([W, k, a.status.status === st.status ? a.flags.map((f) => f.kind).join(' ') : 'MISMATCH', a.handled?.kind ?? '', yes(needsAttention(a)), attentionGroup(a) ?? '']);

      if (goal.kind !== 'milestone') {
        let p = null as ReturnType<typeof projectionFor>, misses = '';
        if (goal.kind === 'metric') {
          const m = assessPosted(goal, cycle, s.checkIns, week);
          if (m.kind === 'metric') { p = m.projection; misses = p ? yes(m.forecastMisses) : ''; }
        } else {
          p = projectionFor(goal, valueSeries(checkInsFor(goal, s.checkIns).filter((c) => c.week <= week)), cycle.weeks);
        }
        out.projection.push([W, k, goal.kind, p ? String(p.week) : '', num(p?.value), num(p?.low), num(p?.high), num(p?.slope), p ? String(p.from) : '', p ? String(p.to) : '', misses]);
      }

      for (const c of goalScorecard(goal, cycle, s.checkIns, week, st.status === 'stale').cells) {
        out.scorecard.push([W, k, c.key, c.tone, c.likelihood ?? '']);
        out['scorecard-words'].push([W, k, c.key, c.value, c.label, c.sub]);
      }
    }
  }
  out.checkin = checkInRows(w);
  return out;
}

/**
 * What a check-in must say (rules/check-in.md), for every check-in in the workspace: the check-in judged again as a
 * draft, in its own week, against the plan of that week, with every check-in for an earlier week in the workspace.
 * First the bare draft (its number, or its stage updates, and nothing else: the owner's call left to the calculation),
 * then the same with the owner's call as posted. `missing` and `call_missing` are the codes still missing, in order.
 */
export function checkInRows(w: ConformanceWorkspace): string[][] {
  const goals = new Map(w.goals.map((g) => [g.id, g]));
  const rows: string[][] = [];
  for (const c of w.checkIns) {
    const goal = goals.get(c.goalId);
    if (!goal) continue;
    const g = goalAsOf(goal, c.week);
    const posted = draftFrom(c);
    const bare = { ...emptyDraft(g, null), value: posted.value, stages: posted.stages };
    const e = evaluate(g, w.cycle, c.week, bare, w.checkIns);
    const called = evaluate(g, w.cycle, c.week, { ...bare, status: c.status }, w.checkIns);
    rows.push([c.id, String(c.week), keyOf(goal), e.calc, e.reason ?? '', yes(e.asksTarget), yes(e.needsPath), e.codes.join(' '), c.status, yes(called.greener), called.codes.join(' ')]);
  }
  return rows.sort((a, b) => Number(a[1]) - Number(b[1]) || a[2]!.localeCompare(b[2]!, 'en', { numeric: true }) || a[0]!.localeCompare(b[0]!));
}

/* ---------- finding things ---------- */

/** The searches find.csv answers: the find rules' worked examples (docs/design/find/spec.md, rules 1, 5 and 7). */
export const FIND_SEARCHES: [kind: 'goal' | 'person' | 'team', q: string][] = [
  ['goal', 'G-48'], ['goal', 'g48'], ['goal', '48'], ['goal', 'G-4'], ['goal', 'tunde'], ['goal', 'one click roll'], ['goal', 'off track'],
  ['goal', 'back'], ['goal', 'rollback'], ['goal', 'rolback'], ['goal', 'kafak'], ['goal', 'qeue wait'], ['goal', 'piplin'], ['goal', 'zzzz'], ['goal', ''],
  ['person', 'tunde'], ['person', 'rhea'], ['person', 'LUCIA'], ['person', 'kapor'], ['person', ''],
  ['team', 'ci'], ['team', 'rhea'], ['team', ''],
];
export const FIND_HEADER = ['kind', 'q', 'total', 'near', 'ids'];

/** What each search finds in the workspace as it was built for: how many, the near miss if any, and every id in order. */
export function findRowsOf(w: ConformanceWorkspace): string[][] {
  const moment = new Date(w.builtFor);
  const s = asOf(w, moment);
  const week = currentWeek(w.cycle, moment);
  const rows = { goal: goalRows(s, w.cycle, moment, week), person: personRows(s), team: teamRows(s) };
  return FIND_SEARCHES.map(([kind, q]) => {
    const a = search(rows[kind], { q, size: 200 });
    return [kind, q, String(a.total), a.near ?? '', a.rows.map((r) => r.id).join(' ')];
  });
}

/* ---------- navigation ---------- */

/** The addresses navigation.csv answers for each viewer (the navigation rules, AR2). */
export const NAV_ADDRESSES = ['/', '/check-in', '/check-in/lead-mq', '/quick-check-in', '/goals', '/goals?scope=mine', '/watching', '/goals/new', '/goals/lead-mq', '/goals/lead-mq/edit', '/goals/lead-mq?review=weekly', '/goals/nowhere', '/reviews/weekly', '/people/rhea', '/teams/cicd', '/activity', '/data', '/workspace/people', '/settings', '/help/check-in', '/whats-new', '/retro', '/retro/x', '/research', '/nowhere'];
/** A module's menu item, as a module's app.tsx gives it, for the rows that show where one goes. */
export const NAV_MODULE = { id: 'example', to: '/example', label: 'Example', group: 'lookup' as const };
/** Two viewers: one who owns goals, one who owns none. */
export const NAV_VIEWERS = ['rhea', 'oskar'];
export const NAV_HEADER = ['viewer', 'owns_goals', 'address', 'menu', 'tabs', 'lit', 'page'];

/** The menu, the phone's tabs, the lit item and the page's name, for each viewer at each address. */
export function navigationRowsOf(w: ConformanceWorkspace): string[][] {
  const rows: string[][] = [];
  for (const viewer of NAV_VIEWERS) {
    // Check-in for someone with a goal to check in on: one of theirs not stopped or done by then.
    const moment = new Date(w.builtFor);
    const s = asOf(w, moment);
    const owns = s.goals.some((g) => g.ownerId === viewer && goalStatus(g, w.cycle, s.checkIns, moment).status !== 'done');
    const g = menuGroups(owns, []);
    const side = [...g.work, ...g.lookup, ...g.make, ...g.you];
    const tabs = phoneTabs(owns);
    // A page's name reads goals' titles and reviews' names from the workspace; Help's articles aren't in it.
    const names: PlaceNames = { goal: (id) => s.goals.find((x) => x.id === id)?.title ?? null, review: (id) => s.reviews.find((x) => x.id === id)?.name ?? null, view: () => null, article: () => null, person: (id) => s.people.find((x) => x.id === id)?.name ?? null, team: (id) => s.teams.find((x) => x.id === id)?.name ?? null };
    for (const address of NAV_ADDRESSES) {
      const [path = '/', q = ''] = address.split('?');
      rows.push([viewer, yes(owns), address, (['work', 'lookup', 'make', 'you'] as const).map((k) => g[k].join(' ')).join(' | '), tabs.join(' '), litItem(path, q, side) ?? '', pageName(path, q, names)]);
    }
    // A module's item (AR2): placed in its group by the same rule, and lit on its own pages; it names its own page.
    const mg = menuGroups(owns, [NAV_MODULE]);
    const mside = [...mg.work, ...mg.lookup, ...mg.make, ...mg.you];
    for (const address of [NAV_MODULE.to, NAV_MODULE.to + '/one']) {
      rows.push([viewer, yes(owns), address, (['work', 'lookup', 'make', 'you'] as const).map((k) => mg[k].join(' ')).join(' | '), tabs.join(' '), litItem(address, '', mside, [NAV_MODULE]) ?? '', pageName(address, '', { ...names, module: (p) => (p === NAV_MODULE.to || p.startsWith(NAV_MODULE.to + '/') ? NAV_MODULE.label : null) })]);
    }
  }
  return rows;
}

/* ---------- kinds, levels and near misses (backlog IM2) ---------- */

/**
 * One case per kind of problem the change engine raises (docs/design/import/spec.md, section 4), run on the workspace
 * as it stood at `builtFor`: who loads it, which sheet, its rows (column → cell), and any answers by group id. People in
 * workspace.json have no email, so rows name people by name or ID. Cells that depend on the workspace (a target turned
 * round, check-ins someone else posted) are worked out from it here and written into the file, so the file says it all.
 */
export interface ImportCase { case: string; actor: string; sheet: 'goals' | 'plan' | 'checkIns' | 'people'; rows: Record<string, string>[]; answers?: Record<string, string> }
export function importCases(w: ConformanceWorkspace): ImportCase[] {
  const s = asOf(w, new Date(w.builtFor));
  const week = currentWeek(w.cycle, new Date(w.builtFor));
  const g = (k: string) => s.goals.find((x) => x.key === k)!;
  const g1 = g('G-1') as Extract<Goal, { kind: 'metric' }>;
  const fresh = (o: Record<string, string>) => ({ Goal: 'A new goal', Owner: 'Rhea Kapoor', Unit: '%', Start: '10', Target: '50', ...o });
  const theirs = s.checkIns.filter((c) => c.authorId === 'rhea' && c.week < week - 2).slice(-10);
  const rheas = s.goals.filter((x) => x.ownerId === 'rhea').slice(0, 5);
  return [
    { case: 'required-empty', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'No owner', Unit: '%', Start: '1', Target: '2' }] },
    { case: 'required-empty-start', actor: 'amara', sheet: 'goals', rows: [fresh({ Start: '' })] },
    { case: 'not-a-number', actor: 'amara', sheet: 'checkIns', rows: [{ 'Goal key': 'G-14', Week: String(week), Value: 'six' }] },
    { case: 'formula', actor: 'amara', sheet: 'goals', rows: [fresh({ Target: '=20+2' })] },
    { case: 'precision', actor: 'amara', sheet: 'checkIns', rows: [{ 'Goal key': 'G-14', Week: String(week), Value: '6.25' }] },
    { case: 'impossible-number', actor: 'amara', sheet: 'checkIns', rows: [{ 'Goal key': 'G-31', Week: String(week), Value: '-4' }] },
    { case: 'unknown-word', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-1', Level: 'vp' }] },
    { case: 'unknown-ref', actor: 'amara', sheet: 'goals', rows: [fresh({ Team: 'Infra Guild' })] },
    { case: 'conflicting-refs', actor: 'amara', sheet: 'goals', rows: [fresh({ 'Owner ID': 'tunde' })] },
    { case: 'bad-key', actor: 'amara', sheet: 'goals', rows: [{ Key: '12', Goal: 'x' }] },
    { case: 'bad-key-none', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-999', Goal: 'x' }] },
    { case: 'duplicate', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-1', Target: String(g1.plan.target) }, { Key: 'G-1', Target: String(g1.plan.target) }] },
    { case: 'type-unclear', actor: 'amara', sheet: 'goals', rows: [fresh({ Stages: 'Design@50' })] },
    { case: 'plan-order', actor: 'amara', sheet: 'goals', rows: [fresh({ 'Due week': '10' })] },
    { case: 'stage-format', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'Stages goal', Owner: 'Rhea Kapoor', Type: 'milestone', Stages: 'Design; Pilot@50' }] },
    { case: 'week-wrong', actor: 'amara', sheet: 'checkIns', rows: [{ 'Goal key': 'G-14', Week: String(week + 4), Value: '6' }] },
    { case: 'checkin-incomplete', actor: 'amara', sheet: 'checkIns', rows: [{ 'Goal key': 'G-14', Week: String(week), Call: 'Off track', 'Path to green': '' }] },
    { case: 'cant-change', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-1', Type: 'milestone' }] },
    { case: 'not-allowed', actor: 'tunde', sheet: 'goals', rows: [{ Key: 'G-1', Target: String(g1.plan.target - 1), Reason: 'Agreed at the review' }] },
    // Goal entry's rule 2 (GE1): the same Must fix and words as New goal; anyone may add a goal for anyone, at any level.
    { case: 'has-words', actor: 'amara', sheet: 'goals', rows: [fresh({ Start: '12 days' })] },
    { case: 'same-as-start', actor: 'amara', sheet: 'goals', rows: [fresh({ Target: '10' })] },
    { case: 'stage-twice', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'Stages goal', Owner: 'Rhea Kapoor', Type: 'milestone', Stages: 'Design@50; design@51' }] },
    { case: 'for-someone-else', actor: 'tunde', sheet: 'goals', rows: [fresh({ Goal: 'A north star for Rhea', Level: 'north star' })] },
    // Goal entry's rule 3 (GE2): the same questions and words as New goal, each that applies, one answer per question.
    { case: 'over-100-and-hundredfold', actor: 'amara', sheet: 'goals', rows: [fresh({ Start: '10', Target: '1500' })] },
    { case: 'over-100-answered', actor: 'amara', sheet: 'goals', rows: [fresh({ Start: '50', Target: '150' })], answers: { 'odd-number:goals:target:over-100': 'right' } },
    { case: 'margin-wide', actor: 'amara', sheet: 'goals', rows: [fresh({ Type: 'range', Start: '', Target: '', Limit: '12', Margin: '20' })] },
    { case: 'feeds-lower', actor: 'amara', sheet: 'goals', rows: [fresh({ Level: 'north star', 'Feeds into key': 'G-14' })] },
    { case: 'removal-refused', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-14', Action: 'Stop' }] },
    { case: 'loop', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-1', 'Feeds into key': 'G-1' }] },
    { case: 'near-ref', actor: 'amara', sheet: 'goals', rows: [fresh({ Team: 'CI/DC' })] },
    { case: 'near-ref-answered', actor: 'amara', sheet: 'goals', rows: [fresh({ Team: 'CI/DC' })], answers: { 'near-ref:goals:team:ci-dc': 'use' } },
    { case: 'near-ref-person', actor: 'amara', sheet: 'goals', rows: [fresh({ Owner: 'Rhea Kapor' })] },
    { case: 'near-word', actor: 'amara', sheet: 'goals', rows: [fresh({ Type: 'numbr' })] },
    { case: 'same-person', actor: 'amara', sheet: 'people', rows: [{ Name: 'Rhea Kapor', Email: 'rhea.k@example.com', Team: 'CI/CD' }] },
    { case: 'same-goal', actor: 'amara', sheet: 'goals', rows: [fresh({ Goal: g('G-14').title, Team: 'CI/CD' })] },
    { case: 'other-goal', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-1', Goal: 'Net revenue retention', Target: '110' }] },
    { case: 'past-stage', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'P1 stages in the past', Owner: 'Rhea Kapoor', Type: 'milestone', Stages: 'Design@2; Pilot@6; All services@10' }] },
    { case: 'past-plan', actor: 'amara', sheet: 'goals', rows: [fresh({ 'Plan from week': '1', 'Due week': '10' })] },
    { case: 'odd-number', actor: 'amara', sheet: 'goals', rows: [fresh({ Unit: 'ms', Start: '3', Target: '3000' })] },
    { case: 'plan-question', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-1', Target: String(2 * g1.plan.start - g1.plan.target), Reason: 'Measured the other way round' }] },
    { case: 'no-unit', actor: 'amara', sheet: 'goals', rows: [fresh({ Unit: '' })] },
    { case: 'decimal-comma', actor: 'amara', sheet: 'goals', rows: [fresh({ Start: '1,5' })] },
    { case: 'replaces-others', actor: 'amara', sheet: 'checkIns', rows: theirs.map((c, k) => ({ ID: c.id, 'Goal ID': c.goalId, Week: String(c.week), 'Next step': `Next step number ${k}` })) },
    { case: 'many-admins', actor: 'amara', sheet: 'people', rows: ['rhea', 'tunde', 'samir'].map((id) => ({ ID: id, Admin: 'yes' })) },
    { case: 'totals-row', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'TOTAL', Start: '10', Target: '550' }] },
    { case: 'big-removal', actor: 'amara', sheet: 'goals', rows: rheas.map((x) => ({ ID: x.id, Action: 'Stop', Reason: 'No longer needed this year.' })) },
  ];
}
export const IMPORT_HEADER = ['case', 'actor', 'sheet', 'rows', 'answers', 'kind', 'level', 'group', 'message', 'must', 'questions', 'saves'];

/**
 * What the change engine says for each case: the first problem or question (its kind, level, group id and sentence; a
 * note isn't one), how many Must-fix groups and Check groups there are, and whether it would save.
 */
export function importRowsOf(w: ConformanceWorkspace): string[][] {
  const at = new Date(w.builtFor);
  const base = asOf(w, at);
  const snapshot: Snapshot = { ...base, people: base.people.map((p) => ({ ...p, email: p.email ?? '' })) };
  const week = currentWeek(w.cycle, at);
  return importCases(w).map((c) => {
    let k = 0;
    const tables = { [c.sheet]: c.rows.map((r, i) => ({ __row: String(i + 2), ...Object.fromEntries(Object.entries(r).map(([h, v]) => [h.toLowerCase(), v])) })) };
    const cs = planChanges({ tables, snapshot, cycle: w.cycle, week, actor: snapshot.people.find((p) => p.id === c.actor)!, now: w.builtFor, newId: (p) => `${p}_c${++k}`, via: 'spreadsheet', answers: Object.fromEntries(Object.entries(c.answers ?? {}).map(([id, choice]) => [id, { choice }])) });
    const first = cs.issues.find((i) => i.level !== 'note');
    return [c.case, c.actor, c.sheet, JSON.stringify(c.rows), c.answers ? JSON.stringify(c.answers) : '', first?.kind ?? '', first?.level ?? '', first?.group ?? '', first?.message ?? '',
      String(cs.groups.filter((x) => x.level === 'must').length), String(cs.groups.filter((x) => x.level === 'check').length), yes(!!cs.commit)];
  });
}

/* ---------- CSV ---------- */

const field = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (head: string[], rows: string[][]) => [head, ...rows].map((r) => r.map(field).join(',')).join('\n') + '\n';

/** The CSV files, by name. */
export function conformanceFiles(w: ConformanceWorkspace): Record<string, string> {
  const t = conformanceTables(w);
  return {
    ...Object.fromEntries((Object.keys(HEADERS) as (keyof ConformanceTables)[]).map((k) => [`${k}.csv`, toCsv(HEADERS[k], t[k])])), 'find.csv': toCsv(FIND_HEADER, findRowsOf(w)), 'navigation.csv': toCsv(NAV_HEADER, navigationRowsOf(w)), 'import.csv': toCsv(IMPORT_HEADER, importRowsOf(w)),
    ...Object.fromEntries(MODULE_FILES.map((f) => [`${f.file}.csv`, toCsv(f.header, f.rows(w, { asOf }))])),
  };
}
