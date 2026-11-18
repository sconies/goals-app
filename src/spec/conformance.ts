/* The conformance data (backlog 8b): what the core rules give for every goal in every week of the demo workspace, as
   plain CSV files under spec/conformance/, made by the real rules. A rebuild proves its rules by reading the same
   workspace (spec/conformance/workspace.json) and matching every row. src/spec/conformance.test.ts recomputes them
   from workspace.json and fails on any difference. Pure: no files are read or written here. */
import { checkInNext, checkInPostSays, closeWords, DRAFT_KEPT, draftFromDay, fixSummary, importSays, metricSays, postCheckIns, primarySays, PROPOSE_SAYS, publishSays, REPLAN_SAYS, tableSays } from '../domain/formFooter';
import { guardBreaches } from '../domain/guards';
import { ZONE_CASE, ZONE_HEADER, zoneRowsOf, type ZoneCase } from './zones';
import { attentionFor, attentionGroup, needsAttention } from '../domain/attention';
import { rowParts, type RowPlace } from '../domain/goalRow';
import { draftFrom, emptyDraft, evaluate } from '../domain/checkin';
import { currentWeek, goalAsOf, projectionFor, valueSeries, weekDate } from '../domain/plan';
import { cycleDates } from '../domain/cycle';
import { goalScorecard } from '../domain/scorecard';
import { assessPosted, checkInsFor, daysWithoutUpdate, goalStatus } from '../domain/status';
import type { Ask, CheckIn, Cycle, Decision, Goal, Person, Review, Snapshot, Team, Watch } from '../domain/types';
import { search } from '../domain/find';
import { goalRows, homeFacts, personRows, teamRows } from '../app/reads';
import { homeFor } from '../domain/home';
import { moment } from '../domain/habit';
import { forgivenWeek, onTimeStreak } from '../domain/progress';
import { localGoals } from '../adapters/localGoals';
import { allGoalsNow } from '../ports/goals';
import { parseQuery } from '../domain/query';
import { STATUS_ORDER } from '../domain/vocabulary';
import { litItem, menuGroups, pageName, phoneTabs, type PlaceNames } from '../domain/navigation';
import { pageKind, phoneTitleShown, topBarSays } from '../domain/pageHeader';
import { planChanges, type ChangeSet } from '../domain/changeset';
import { blankGoal, type GoalDraft } from '../domain/goal';
import { goalChecks } from '../domain/goalEntry';
import { startLevel } from '../domain/newGoal';
import { readBack, reviewsJoining } from '../domain/readBack';
import type { ModuleRows } from '../domain/records';
import MODULE_CONFORMANCE from 'virtual:faro-modules/conformance';

/** The moment the demo workspace is built for: Thursday 5 November 2026, noon UTC (week 45), as the evals pin it. */
export const CHECK_IN_MOMENT = '2026-11-05T12:00:00.000Z';

/** The records the core rules read: what spec/conformance/workspace.json holds. */
export interface ConformanceWorkspace {
  about: string;
  /** The moment the workspace was built for. Every record is as it stood then. */
  builtFor: string;
  /** The edge-case workspace (src/spec/edge.ts, spec/conformance/edge): only stage 1's files are made from it. */
  edge?: boolean;
  /** The feature modules switched off in the workspace (Workspace.modulesOff): stage 3's rows follow it (the core alone,
      spec/conformance/core-only, has every one off). Missing: every module on. */
  modulesOff?: string[];
  cycle: Cycle;
  people: Pick<Person, 'id' | 'name' | 'teamId' | 'admin'>[];
  teams: Team[];
  goals: Goal[];
  checkIns: CheckIn[];
  decisions: Decision[];
  requests: Ask[];
  /** Each review's picks (`scope`) too, for the reviews a new goal joins (readback.csv); its rhythm and people for home.csv. */
  reviews: Pick<Review, 'id' | 'name' | 'everyWeeks' | 'weekday' | 'scope' | 'people'>[];
  /** Who watches what (home.csv reads it). Watches carry no date: they are taken as they are now in every week. */
  watches: Pick<Watch, 'id' | 'personId' | 'kind' | 'ref'>[];
  /** R3's home-zone case, scored in zone.csv (src/spec/zones.ts): separate from the records above, which are judged in UTC. */
  zone?: ZoneCase;
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
  /** Each case's inputs as data (drill 11, M-1, T-1: they were only in the expected rows), written to
      module-cases.json under the file's name, which the harness copies beside workspace.json. */
  cases?(w: ConformanceWorkspace, kit: { asOf: typeof asOf }): unknown;
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
    reviews: live(s.reviews).filter((r) => !r.endedAt).map((r) => ({ id: r.id, name: r.name, everyWeeks: r.everyWeeks, weekday: r.weekday, scope: r.scope, people: r.people })),
    watches: live(s.watches).map((x) => ({ id: x.id, personId: x.personId, kind: x.kind, ref: x.ref })),
    zone: ZONE_CASE,
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
    changes: [], watches: w.watches ?? [], retros: [],
    reviews: w.reviews.map((r) => ({ ...r, createdBy: '', createdAt: '' })),
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
  checkin: ['checkin', 'week', 'goal', 'calculated', 'reason', 'asks_target', 'needs_path', 'missing', 'call', 'greener', 'call_missing', 'moment'],
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
    // Its guards past their limit that week (GR) count, as they do at the check-in.
    const breaches = guardBreaches(g, w.goals, w.cycle, w.checkIns, c.week);
    const e = evaluate(g, w.cycle, c.week, bare, w.checkIns, breaches);
    const called = evaluate(g, w.cycle, c.week, { ...bare, status: c.status }, w.checkIns, breaches);
    // The habit's moment (rule 3): what this check-in made; the rule itself reads only what was posted before it.
    const m = moment(w.checkIns, c, goal);
    rows.push([c.id, String(c.week), keyOf(goal), e.calc, e.reason ?? '', yes(e.asksTarget), yes(e.needsPath), e.codes.join(' '), c.status, yes(called.greener), called.codes.join(' '), m ? `${m.kind}${m.kind === 'back' ? ` ${m.behind}` : ''}` : '']);
  }
  return rows.sort((a, b) => Number(a[1]) - Number(b[1]) || a[2]!.localeCompare(b[2]!, 'en', { numeric: true }) || a[0]!.localeCompare(b[0]!));
}

/* ---------- finding things ---------- */

/** The searches find.csv answers: the find rules' worked examples (docs/design/find/spec.md, rules 1, 5 and 7). */
const FIND_SEARCHES: [kind: 'goal' | 'person' | 'team', q: string][] = [
  ['goal', 'G-48'], ['goal', 'g48'], ['goal', '48'], ['goal', 'G-4'], ['goal', 'tunde'], ['goal', 'one click roll'], ['goal', 'off track'],
  ['goal', 'back'], ['goal', 'rollback'], ['goal', 'rolback'], ['goal', 'kafak'], ['goal', 'qeue wait'], ['goal', 'piplin'], ['goal', 'zzzz'], ['goal', ''],
  ['person', 'tunde'], ['person', 'rhea'], ['person', 'LUCIA'], ['person', 'kapor'], ['person', ''],
  ['team', 'ci'], ['team', 'rhea'], ['team', ''],
];
export const FIND_HEADER = ['kind', 'q', 'total', 'near', 'ids'];

/** What each search finds in the workspace as it was built for: how many, the near miss if any, and every id in order. */
export function findRowsOf(w: ConformanceWorkspace, searches: ScreenCases['find'] = FIND_SEARCHES.map(([kind, q]) => ({ kind, q }))): string[][] {
  const moment = new Date(w.builtFor);
  const s = asOf(w, moment);
  const week = currentWeek(w.cycle, moment);
  const rows = { goal: goalRows(s, w.cycle, moment, week), person: personRows(s), team: teamRows(s) };
  return searches.map(({ kind, q }) => {
    const a = search(rows[kind], { q, size: 200 });
    return [kind, q, String(a.total), a.near ?? '', a.rows.map((r) => r.id).join(' ')];
  });
}

/* ---------- the query port ---------- */

/** The Goals queries goals.csv answers through the query port (AX5): each as a Goals link's parameters. */
export const GOAL_QUERIES = [
  '', 'status=off', 'status=off,risk', 'attention=1', 'attention=1&needs=stale', 'team=cicd', 'owner=rhea', 'level=north-star',
  'kind=milestone', 'q=tunde', 'q=rolback', 'q=zzzz', 'quiet=2', 'feeds=ns-lead', 'sort=title', 'sort=last', 'sort=due.desc', 'status=on&sort=gap',
  'checkedin=no', 'checkedin=asked', 'inreview=devprod', 'inreview=devprod&checkedin=no', 'inreview=nope',
];
export const GOALS_HEADER = ['query', 'total', 'near', ...STATUS_ORDER, 'attention', 'ids'];

/** What the query port's goals() and counts() give for each query, on the workspace as it was built for. */
export function goalsQueryRowsOf(w: ConformanceWorkspace): string[][] {
  const moment = new Date(w.builtFor);
  const rows = goalRows(asOf(w, moment), w.cycle, moment, currentWeek(w.cycle, moment));
  const port = localGoals(() => rows);
  return GOAL_QUERIES.map((q) => {
    const query = parseQuery(new URLSearchParams(q));
    const page = allGoalsNow(port.now!, { query });
    const c = port.now!.counts({ query });
    return [q, String(page.total), page.near ?? '', ...STATUS_ORDER.map((k) => String(c.status[k])), String(c.attention), page.rows.map((r) => r.goal.id).join(' ')];
  });
}

/* ---------- one goal row (GOAL-ROW) ---------- */

/** The places goal-row.csv lists every live goal in, and who is looking. */
export const ROW_CSV_PLACES: RowPlace[] = ['goals-list', 'watching-needs', 'watching-handled', 'checkin-queue', 'agenda', 'home-mine'];
const ROW_VIEWER = 'amara';
export const GOAL_ROW_HEADER = ['goal', 'place', 'viewer', 'status', 'value', 'gap', 'as_of', 'result', 'reason', 'reason_flag', 'context', 'context_flag', 'action'];

/** What rowParts gives for every live goal in each place, as amara, on the workspace as it was built for. */
export function goalRowRowsOf(w: ConformanceWorkspace): string[][] {
  const moment = new Date(w.builtFor);
  const s = asOf(w, moment);
  const week = currentWeek(w.cycle, moment);
  return s.goals.filter((g) => !g.stoppedAt).flatMap((g) => {
    const att = attentionFor(g, s, w.cycle, moment);
    return ROW_CSV_PLACES.map((place) => {
      const p = rowParts(g, att, place, { checkIns: s.checkIns, people: s.people, asks: s.requests ?? [], cycle: w.cycle, today: moment, week, viewerId: ROW_VIEWER });
      return [g.id, place, ROW_VIEWER, p.status, p.value, p.gap?.text ?? '', p.asOf ?? '', p.result?.text ?? '', p.reason ?? '', p.reasonIsFlag ? '1' : '', p.context ?? '', p.contextIsFlag ? '1' : '', p.action ?? ''];
    });
  });
}

/* ---------- one page header (PAGE-HEADER) ---------- */

export const PAGE_HEADER_HEADER = ['address', 'kind', 'page', 'top_bar_title_in_view', 'top_bar_title_gone'];

/** For each address navigation.csv answers: its kind of page, its name, and what the phone's top bar says with the
    title in view and once it has scrolled away ("the workspace" stands for the workspace's name). */
export function pageHeaderRowsOf(w: ConformanceWorkspace, c: ScreenCases['navigation'] = navigationCases()): string[][] {
  const s = asOf(w, new Date(w.builtFor));
  const names: PlaceNames = { goal: (id) => s.goals.find((x) => x.id === id)?.title ?? null, review: (id) => s.reviews.find((x) => x.id === id)?.name ?? null, view: () => null, article: () => null, person: (id) => s.people.find((x) => x.id === id)?.name ?? null, team: (id) => s.teams.find((x) => x.id === id)?.name ?? null };
  return c.addresses.map((address) => {
    const [path = '/', q = ''] = address.split('?');
    const kind = pageKind(path, q);
    const page = pageName(path, q, names).split(' · ')[0] ?? '';
    return [address, kind, page, topBarSays(kind, page, 'the workspace', phoneTitleShown(path)) ?? '', topBarSays(kind, page, 'the workspace', false) ?? ''];
  });
}

/* ---------- the form footer ---------- */

/** form-footer.csv: the words a form's footer and its one exit say (FORM-FOOTER; patterns spec 3), one row per case. */
export const FORM_FOOTER_HEADER = ['case', 'given', 'says'];
export function formFooterRows(): string[][] {
  const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9).getTime();
  const now = new Date(2026, 10, 18, 12).getTime();
  return [
    ['close', 'keeps drafts, nothing typed', closeWords(true, false)],
    ['close', 'keeps drafts, something typed', closeWords(true, true)],
    ['close', 'keeps nothing', closeWords(false, true)],
    ['next', 'check-in, carried words', checkInNext('carry', { why: false, milestone: false })],
    ['next', 'check-in, behind plan', checkInNext('account', { why: true, reason: 'behind', milestone: false })],
    ['next', 'check-in, ahead of plan', checkInNext('account', { why: true, reason: 'ahead', milestone: false })],
    ['next', 'check-in, a stage late', checkInNext('account', { why: true, reason: 'behind', milestone: true })],
    ['next', 'check-in, on plan', checkInNext('account', { why: false, milestone: false })],
    ['status', 'check-in last step, week 46, 3 watching', checkInPostSays(46, 3)],
    ['status', 'check-in last step, week 46, 1 watching', checkInPostSays(46, 1)],
    ['status', 'check-in last step, week 46, nobody watching', checkInPostSays(46, 0)],
    ['primary', 'table check-in, 5 ready', postCheckIns(5)],
    ['primary', 'table check-in, none ready', postCheckIns(0)],
    ['status', 'table check-in, 5 ready, 2 need a reason', tableSays(5, 2)],
    ['status', 'table check-in, 1 ready, 1 needs a reason', tableSays(1, 1)],
    ['status', 'New goal last step, publishing in Platform Engineering', publishSays('Platform Engineering')],
    ['status', 'New goal last step, proposing', PROPOSE_SAYS],
    ['status', 'Change a goal, check-ins started, plan changed', REPLAN_SAYS],
    ['status', 'a metric form, every part filled in', metricSays(0)],
    ['status', 'a metric form, 2 parts missing', metricSays(2)],
    ['status', 'Import, 12 goals change', importSays(12)],
    ['status', 'the first step after a draft is first kept', DRAFT_KEPT],
    ['fix', 'two fields in error: Target, Owner', fixSummary(['Target', 'Owner']) ?? ''],
    ['fix', 'one field in error, in view', fixSummary(['Target']) ?? ''],
    ['fix', 'one field in error, out of view', fixSummary(['Target'], false) ?? ''],
    ['draft', 'resumed, kept today', draftFromDay(day(2026, 11, 18), now)],
    ['draft', 'resumed, kept yesterday', draftFromDay(day(2026, 11, 17), now)],
    ['draft', 'resumed, kept three days ago', draftFromDay(day(2026, 11, 15), now)],
    ['draft', 'resumed, kept 16 days ago', draftFromDay(day(2026, 11, 2), now)],
    ['primary-ok', 'Continue', primarySays('Continue') ? 'yes' : 'no'],
    ['primary-ok', 'Save', primarySays('Save') ? 'yes' : 'no'],
    ['primary-ok', 'Save changes', primarySays('Save changes') ? 'yes' : 'no'],
  ];
}

/** Whether a module is on in the conformance workspace: not in its modulesOff. */
const on = (w: ConformanceWorkspace, id: string) => !(w.modulesOff ?? []).includes(id);

/* ---------- navigation ---------- */

/** The addresses navigation.csv answers for each viewer (the navigation rules, AR2). */
const NAV_ADDRESSES = ['/', '/check-in', '/check-in/lead-mq', '/quick-check-in', '/goals', '/goals?scope=mine', '/watching', '/goals/new', '/goals/lead-mq', '/goals/lead-mq/edit', '/goals/lead-mq?review=weekly', '/goals/nowhere', '/reviews/weekly', '/people/rhea', '/teams/cicd', '/activity', '/data', '/workspace/people', '/settings', '/help/check-in', '/whats-new', '/retro', '/retro/x', '/research', '/nowhere'];
/** A module's menu item, as a module's app.tsx gives it, for the rows that show where one goes. */
const NAV_MODULE = { id: 'example', to: '/example', label: 'Example', group: 'lookup' as const };
/** Home with features switched off (Workspace, Features), each address marked so: Reviews off (FT2), Feedback off
    (SW1), and every optional feature off. */
const NAV_SWITCHED_OFF: ScreenCases['navigation']['switchedOff'] = [
  { address: '/ (Reviews off)', off: ['reviews'] },
  { address: '/ (Feedback off)', off: ['feedback'] },
  { address: '/ (every feature off)', off: 'all' },
];
/** Two viewers: one who owns goals, one who owns none. */
const NAV_VIEWERS = ['rhea', 'oskar'];
export const NAV_HEADER = ['viewer', 'owns_goals', 'address', 'menu', 'tabs', 'lit', 'page'];

/** The menu, the phone's tabs, the lit item and the page's name, for each viewer at each address. */
export function navigationRowsOf(w: ConformanceWorkspace, c: ScreenCases['navigation'] = navigationCases()): string[][] {
  const rows: string[][] = [];
  const NAV_MODULE = c.module;
  for (const viewer of c.viewers) {
    // Check-in for someone with a goal to check in on: one of theirs not stopped or done by then.
    const moment = new Date(w.builtFor);
    const s = asOf(w, moment);
    const owns = s.goals.some((g) => g.ownerId === viewer && goalStatus(g, w.cycle, s.checkIns, moment).status !== 'done');
    const g = menuGroups(owns, [], on(w, 'reviews'), on(w, 'feedback'));
    const side = [...g.work, ...g.lookup, ...g.make, ...g.you];
    const tabs = phoneTabs(owns, on(w, 'reviews'));
    // A page's name reads goals' titles and reviews' names from the workspace; Help's articles aren't in it.
    const names: PlaceNames = { goal: (id) => s.goals.find((x) => x.id === id)?.title ?? null, review: (id) => s.reviews.find((x) => x.id === id)?.name ?? null, view: () => null, article: () => null, person: (id) => s.people.find((x) => x.id === id)?.name ?? null, team: (id) => s.teams.find((x) => x.id === id)?.name ?? null };
    for (const address of c.addresses) {
      const [path = '/', q = ''] = address.split('?');
      rows.push([viewer, yes(owns), address, (['work', 'lookup', 'make', 'you'] as const).map((k) => g[k].join(' ')).join(' | '), tabs.join(' '), litItem(path, q, side) ?? '', pageName(path, q, names)]);
    }
    // A module's item (AR2): placed in its group by the same rule, and lit on its own pages; it names its own page.
    const mg = menuGroups(owns, [NAV_MODULE], on(w, 'reviews'), on(w, 'feedback'));
    const mside = [...mg.work, ...mg.lookup, ...mg.make, ...mg.you];
    for (const address of c.moduleAddresses) {
      rows.push([viewer, yes(owns), address, (['work', 'lookup', 'make', 'you'] as const).map((k) => mg[k].join(' ')).join(' | '), tabs.join(' '), litItem(address, '', mside, [NAV_MODULE]) ?? '', pageName(address, '', { ...names, module: (p) => (p === NAV_MODULE.to || p.startsWith(NAV_MODULE.to + '/') ? NAV_MODULE.label : null) })]);
    }
  }
  // Home with features switched off (FT2, SW1), for each viewer: Reviews off (the menu and tabs without Reviews),
  // Feedback off (the menu's last group is Workspace, Settings, Help), and every optional feature off.
  for (const viewer of c.viewers) {
    const s = asOf(w, new Date(w.builtFor));
    const owns = s.goals.some((g) => g.ownerId === viewer && goalStatus(g, w.cycle, s.checkIns, new Date(w.builtFor)).status !== 'done');
    for (const x of c.switchedOff) {
      const reviews = on(w, 'reviews') && x.off !== 'all' && !x.off.includes('reviews'), feedback = on(w, 'feedback') && x.off !== 'all' && !x.off.includes('feedback');
      const f = menuGroups(owns, [], reviews, feedback);
      rows.push([viewer, yes(owns), x.address, (['work', 'lookup', 'make', 'you'] as const).map((k) => f[k].join(' ')).join(' | '), phoneTabs(owns, reviews).join(' '), litItem('/', '', [...f.work, ...f.lookup, ...f.make, ...f.you]) ?? '', pageName('/', '', { goal: () => null, review: () => null, view: () => null, article: () => null, person: () => null, team: () => null })]);
    }
  }
  return rows;
}

/* ---------- home ---------- */

/** Home's viewers (docs/design/home/spec.md): an owner, a manager in a review, a leader who owns none, someone who only watches. */
const HOME_VIEWERS = ['tunde', 'rhea', 'amara', 'oskar'];
export const HOME_HEADER = ['viewer', 'day', 'lead', 'title', 'quiet', 'run', 'forgiven'];
/** The fourteen days up to the moment the workspace is built for, each at noon UTC. */
export const homeDays = (w: ConformanceWorkspace) => Array.from({ length: 14 }, (_, i) => new Date(Date.parse(w.builtFor) - (13 - i) * 86_400_000));

/** For each viewer on each day: the lead's kind and title (none: empty), or the quiet sentence and its line. No draft is kept. */
export function homeRowsOf(w: ConformanceWorkspace, c: ScreenCases['home'] = { viewers: HOME_VIEWERS, days: homeDays(w).map((d) => d.toISOString()) }): string[][] {
  return inUtc(() => homeRows(w, c));
}

/**
 * Runs `f` with the process's zone set to UTC, then puts it back. The records here are judged in UTC (R3's home-zone
 * case is zone.csv's), but a check-in's day is read on the machine's clock (`postedDay`), as a person's own day is, so
 * without this home.csv changed with the zone it was made in (Pacific/Auckland: drill, 15 Nov). Synchronous, so
 * nothing else runs in between.
 */
export function inUtc<T>(f: () => T): T {
  if (typeof process === 'undefined') return f();
  const was = process.env.TZ;
  process.env.TZ = 'UTC';
  try { return f(); } finally { if (was === undefined) delete process.env.TZ; else process.env.TZ = was; }
}

function homeRows(w: ConformanceWorkspace, c: ScreenCases['home']): string[][] {
  const rows: string[][] = [];
  for (const viewer of c.viewers) for (const day of c.days.map((d) => new Date(d))) {
    const s = asOf(w, day);
    const plan = homeFor(homeFacts(viewer, s, w.cycle, currentWeek(w.cycle, day), day, { workspace: WORKSPACE_NAME, draft: false, reviews: on(w, 'reviews'), watching: on(w, 'watching'), wrapUp: on(w, 'wrap-up') }));
    // The habit's run (rule 5) on that day: its weeks, and the forgiven week inside it with whether it was late or missed.
    const week = currentWeek(w.cycle, day);
    const f = forgivenWeek(viewer, s.goals, s.checkIns, w.cycle, week);
    rows.push([viewer, day.toISOString().slice(0, 10), plan.lead?.kind ?? '', plan.lead?.title ?? '', plan.quiet ? [plan.quiet.sentence, plan.quiet.line].filter(Boolean).join(' ') : '', String(onTimeStreak(viewer, s, w.cycle, week)), f ? `${f.week} ${f.missed ? 'missed' : 'late'}` : '']);
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
type CaseSheet = 'goals' | 'plan' | 'checkIns' | 'people';
/**
 * What a case starts from beyond the workspace at `builtFor`: set-up from nothing (`mode: "create"`, every row new), goals
 * stopped before it (`stopped`, by key: in the archive, as a whole-cycle export carries them), the rows of other
 * sheets loaded in the same file (`sheets`), and a later moment the file is loaded at (`at`; the workspace is still as it
 * stood at `builtFor`), and the change's reason (`reason`, as the import's reason box gives it).
 */
export interface CaseGiven { mode?: 'create'; stopped?: string[]; sheets?: Partial<Record<CaseSheet, Record<string, string>[]>>; at?: string; reason?: string }
export interface ImportCase { case: string; actor: string; sheet: CaseSheet; rows: Record<string, string>[]; answers?: Record<string, string>; given?: CaseGiven }
export function importCases(w: ConformanceWorkspace): ImportCase[] {
  const s = asOf(w, new Date(w.builtFor));
  const week = currentWeek(w.cycle, new Date(w.builtFor));
  const g = (k: string) => s.goals.find((x) => x.key === k)!;
  const g1 = g('G-1') as Extract<Goal, { kind: 'metric' }>;
  const fresh = (o: Record<string, string>) => ({ Goal: 'A new goal', Owner: 'Rhea Kapoor', Unit: '%', Start: '10', Target: '50', ...o });
  const theirs = s.checkIns.filter((c) => c.authorId === 'rhea' && c.week < week - 2).slice(-10);
  const rheas = s.goals.filter((x) => x.ownerId === 'rhea').slice(0, 5);
  const lastOf = theirs[theirs.length - 1]!;
  const personName = (id: string) => s.people.find((p) => p.id === id)?.name ?? id;
  const teamName = (id: string | null | undefined) => s.teams.find((t) => t.id === id)?.name ?? '';
  const afterWrapUp = new Date(Date.parse(cycleDates(w.cycle).wrapUpCloses) + 2 * 86_400_000).toISOString();
  return [
    { case: 'required-empty', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'No owner', Unit: '%', Start: '1', Target: '2' }] },
    { case: 'required-empty-start', actor: 'amara', sheet: 'goals', rows: [fresh({ Start: '' })] },
    // BL: a baseline of its own, a period too long for it, and a word Baseline is doesn't know.
    { case: 'baseline-provisional', actor: 'amara', sheet: 'goals', rows: [fresh({ 'Baseline period': 'June to September 2026', 'Baseline is': 'provisional' })] },
    { case: 'baseline-period-long', actor: 'amara', sheet: 'goals', rows: [fresh({ 'Baseline period': 'The whole of the summer quarter and most of the autumn one, 2026' })] },
    { case: 'baseline-is-unknown', actor: 'amara', sheet: 'goals', rows: [fresh({ 'Baseline period': 'Q3 2026', 'Baseline is': 'maybe' })] },
    // GB: a proposed goal with a Baseline and no Target loads; an active one, or a Target with no Baseline, is a Must fix.
    { case: 'proposed-target-not-set', actor: 'amara', sheet: 'goals', rows: [fresh({ Target: '', State: 'proposed' })] },
    { case: 'active-target-empty', actor: 'amara', sheet: 'goals', rows: [fresh({ Target: '', State: 'active' })] },
    { case: 'proposed-start-empty', actor: 'amara', sheet: 'goals', rows: [fresh({ Start: '', State: 'proposed' })] },
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
    { case: 'effect-not-number', actor: 'amara', sheet: 'goals', rows: [fresh({ 'Feeds into key': 'G-14', Effect: 'lots' })] },
    { case: 'for-someone-else', actor: 'tunde', sheet: 'goals', rows: [fresh({ Goal: 'A north star for Rhea', Level: 'north star' })] },
    // Goal entry's rule 3 (GE2): the same questions and words as New goal, each that applies, one answer per question.
    { case: 'over-100-and-hundredfold', actor: 'amara', sheet: 'goals', rows: [fresh({ Start: '10', Target: '1500' })] },
    { case: 'over-100-answered', actor: 'amara', sheet: 'goals', rows: [fresh({ Start: '50', Target: '150' })], answers: { 'odd-number:goals:target:over-100': 'right' } },
    { case: 'margin-wide', actor: 'amara', sheet: 'goals', rows: [fresh({ Type: 'range', Start: '', Target: '', Limit: '12', Margin: '20' })] },
    { case: 'no-unit-cleared', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-1', Unit: '' }] },
    { case: 'feeds-lower', actor: 'amara', sheet: 'goals', rows: [fresh({ Level: 'north star', 'Feeds into key': 'G-14' })] },
    // Years and weeks (rule 13; GE9): From and To as a goal year's week, beside the old columns, read as Owner and Owner email are.
    { case: 'to-before-from', actor: 'amara', sheet: 'goals', rows: [fresh({ From: '2026-W46', To: '2026-W40' })] },
    { case: 'week-unknown', actor: 'amara', sheet: 'goals', rows: [fresh({ To: '2027-W53' })] },
    { case: 'from-pair-disagrees', actor: 'amara', sheet: 'goals', rows: [fresh({ From: '2026-W46', 'Plan from week': '40' })] },
    { case: 'to-next-year', actor: 'amara', sheet: 'goals', rows: [fresh({ From: '2026-W46', To: '2027-W13' })] },
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
    // A batch names its own rows (backlog BT): a Ref on two rows, and a Feeds into ref that names no row.
    { case: 'ref-twice', actor: 'amara', sheet: 'goals', rows: [fresh({ Ref: 'top', Goal: 'Register top' }), fresh({ Ref: 'top', Goal: 'Register part' })] },
    { case: 'ref-unknown', actor: 'amara', sheet: 'goals', rows: [fresh({ Ref: 'part', 'Feeds into ref': 'top' })] },
    // Every kind the engine raises has a case (src/domain/issueKinds.ts; KT gap 2).
    { case: 'ambiguous-ref', actor: 'amara', sheet: 'goals', rows: [fresh({ Goal: 'Shared name', Team: 'CI/CD' }), fresh({ Goal: 'Shared name', Team: 'Observability' }), fresh({ Goal: 'Feeds the shared name', 'Feeds into': 'Shared name' })] },
    { case: 'near-header', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'A new goal', Owner: 'Rhea Kapoor', Unit: '%', Start: '10', Targett: '50' }] },
    { case: 'two-columns', actor: 'amara', sheet: 'goals', rows: [fresh({ 'Goal name': 'Another name' })] },
    { case: 'date-as-week', actor: 'amara', sheet: 'checkIns', rows: [{ 'Goal key': 'G-14', Week: '2026-11-04', Value: '6' }] },
    { case: 'left-alone', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-14', Target: '1' }], given: { stopped: ['G-14'] } },
    // Set-up's upload through the preview (IM8): an owner the People sheet lacks offers "Add {name}"; a new goal's stages
    // already due are asked with "Count them from this week" first, and answered so they move.
    { case: 'unknown-owner-setup', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'Night shift rota', 'Owner email': 'nia@example.com', Owner: 'Nia Okoro', Team: 'CI/CD', Unit: '%', Start: '10', Target: '50' }], given: { mode: 'create', sheets: { people: [{ Name: 'Ines Novak', Email: 'ines@example.com', Team: 'CI/CD' }] } } },
    { case: 'past-stage-setup', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'Rota agreed', 'Owner email': 'ines@example.com', Team: 'CI/CD', Type: 'milestone', Stages: 'Draft@2; Agreed@6; Live@50' }], given: { mode: 'create', sheets: { people: [{ Name: 'Ines Novak', Email: 'ines@example.com', Team: 'CI/CD' }] } } },
    { case: 'past-stage-setup-answered', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'Rota agreed', 'Owner email': 'ines@example.com', Team: 'CI/CD', Type: 'milestone', Stages: 'Draft@2; Agreed@6; Live@50' }], given: { mode: 'create', sheets: { people: [{ Name: 'Ines Novak', Email: 'ines@example.com', Team: 'CI/CD' }] } }, answers: { 'past-stage:goals:stages:': 'from-now' } },
    // A cycle that has ended can't be corrected by any door (review of #326): a changed number for a past week is refused.
    { case: 'ended-cycle', actor: 'amara', sheet: 'checkIns', rows: [{ ID: lastOf.id, 'Goal ID': lastOf.goalId, Week: String(lastOf.week), 'Next step': 'Corrected after the year closed' }], given: { at: afterWrapUp } },
    // A workbook loaded back as it was exported (drill 11, stage 9: M9-3): a whole Goals row that says Stop is a change
    // only where a cell differs from the goal; an unchanged People sheet from someone who isn't an admin changes no one;
    // example rows are left out, never read as new; a name over 80 characters that wasn't edited is not asked about.
    { case: 'stop-whole-row', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-14', Goal: g('G-14').title, Owner: personName(g('G-14').ownerId), Team: teamName(g('G-14').teamId), Action: 'Stop', Reason: 'No longer needed this year.' }] },
    { case: 'stop-row-changed', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-14', Goal: 'A different name', Action: 'Stop', Reason: 'No longer needed this year.' }] },
    { case: 'people-unchanged-not-admin', actor: 'tunde', sheet: 'people', rows: s.people.filter((p) => !p.leftAt).slice(0, 3).map((p) => ({ ID: p.id, Name: p.name, Team: teamName(p.teamId), Admin: p.admin ? 'yes' : 'no' })) },
    { case: 'people-one-changed-not-admin', actor: 'tunde', sheet: 'people', rows: s.people.filter((p) => !p.leftAt).slice(0, 3).map((p, k) => ({ ID: p.id, Name: k === 1 ? `${p.name} Jr` : p.name, Team: teamName(p.teamId), Admin: p.admin ? 'yes' : 'no' })) },
    { case: 'example-row', actor: 'amara', sheet: 'goals', rows: [{ Action: 'Example', Goal: 'An example goal', Owner: 'Rhea Kapoor', Unit: '%', Start: '10', Target: '50' }, fresh({})] },
    { case: 'long-name-unedited', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-48', Goal: g('G-48').title }] },
    { case: 'long-name-edited', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-48', Goal: `${g('G-48').title}, and the weekend` }] },
    { case: 'as-recorded', actor: 'amara', sheet: 'checkIns', rows: [{ Goal: 'Cache hit rate', Week: '20', Value: '12', Call: 'On track' }], given: { mode: 'create', sheets: { goals: [{ Goal: 'Cache hit rate', 'Owner email': 'ines@example.com', Team: 'CI/CD', Unit: '%', Start: '10', Target: '50', 'Plan from week': '1', 'Due week': '40' }], people: [{ Name: 'Ines Novak', Email: 'ines@example.com', Team: 'CI/CD' }] } } },
  ];
}
export const IMPORT_HEADER = ['case', 'actor', 'sheet', 'rows', 'answers', 'given', 'kind', 'level', 'group', 'message', 'must', 'questions', 'saves', 'kinds'];

/**
 * What the change engine says for each case: the first problem or question (its kind, level, group id and sentence; a
 * note isn't one), how many Must-fix groups and Check groups there are, whether it would save, and every kind it raised
 * (notes too), each once, in the order first raised.
 */
export function importRowsOf(w: ConformanceWorkspace): string[][] {
  return importCases(w).map((c) => {
    const cs = runCase(w, c);
    const first = cs.issues.find((i) => i.level !== 'note');
    return [c.case, c.actor, c.sheet, JSON.stringify(c.rows), c.answers ? JSON.stringify(c.answers) : '', c.given ? JSON.stringify(c.given) : '', first?.kind ?? '', first?.level ?? '', first?.group ?? '', first?.message ?? '',
      String(cs.groups.filter((x) => x.level === 'must').length), String(cs.groups.filter((x) => x.level === 'check').length), yes(!!cs.commit), [...new Set(cs.issues.map((i) => i.kind))].join(' ')];
  });
}

/**
 * Runs one case through the change engine at `builtFor`, as a spreadsheet load by `actor`: rows are read as a sheet's
 * (headings in any case), numbered from line 2, and new IDs are `<prefix>_c1`, `<prefix>_c2`… in the order asked for.
 */
export function runCase(w: ConformanceWorkspace, c: ImportCase): ChangeSet {
  const at = new Date(w.builtFor);
  const base = asOf(w, at);
  const stopped = new Set(c.given?.stopped ?? []);
  const gone = base.goals.filter((g) => g.key != null && stopped.has(g.key)).map((g) => ({ ...g, stoppedAt: w.builtFor }));
  const people = base.people.map((p) => ({ ...p, email: p.email ?? '' }));
  const snapshot: Snapshot = { ...base, people, ...(gone.length ? { goals: base.goals.filter((g) => !gone.some((x) => x.id === g.id)), archive: { goals: gone, checkIns: [], decisions: [], people: [], reviews: [] } } : {}) };
  const week = currentWeek(w.cycle, at);
  let k = 0;
  const sheet = (rows: Record<string, string>[]) => rows.map((r, i) => ({ __row: String(i + 2), ...Object.fromEntries(Object.entries(r).map(([h, v]) => [h.toLowerCase(), v])) }));
  const tables = { ...Object.fromEntries(Object.entries(c.given?.sheets ?? {}).map(([name, rows]) => [name, sheet(rows ?? [])])), [c.sheet]: sheet(c.rows) };
  return planChanges({ tables, snapshot, cycle: w.cycle, week, actor: people.find((p) => p.id === c.actor)!, now: c.given?.at ?? w.builtFor, newId: (p) => `${p}_c${++k}`, via: 'spreadsheet', ...(c.given?.mode ? { mode: c.given.mode } : {}), ...(c.given?.reason ? { reason: c.given.reason } : {}), answers: Object.fromEntries(Object.entries(c.answers ?? {}).map(([id, choice]) => [id, { choice }])) });
}

/* ---------- what a change set saves (stage 2; KT gap 1) ---------- */

/**
 * The cases changes.csv runs: every import case, and five that save: a check-in, a plan change with its reason, a new
 * goal, a change to a person, and a goal stopped.
 */
export function changeCases(w: ConformanceWorkspace): ImportCase[] {
  const s = asOf(w, new Date(w.builtFor));
  const week = currentWeek(w.cycle, new Date(w.builtFor));
  const g1 = s.goals.find((x) => x.key === 'G-1') as Extract<Goal, { kind: 'metric' }>;
  const ownersThisWeek = s.checkIns.find((c) => c.week === week && c.authorId !== 'amara')!;
  return [
    ...importCases(w),
    // An admin's row replacing this week's check-in on a goal someone else owns corrects it, with a reason, and the check-in stays
    // its author's (Lane, 14 Nov): the item's author is who checked in, not the admin.
    { case: 'corrects-keeps-author', actor: 'amara', sheet: 'checkIns', rows: [{ ID: ownersThisWeek.id, 'Goal ID': ownersThisWeek.goalId, Week: String(week), 'Next step': 'Corrected from the source data' }], given: { reason: 'The tracker had last week’s number in it' } },
    // This week's check-in is the owner's to load (backlog AD: an admin's workbook brings in past weeks).
    { case: 'saves-check-in', actor: s.goals.find((x) => x.key === 'G-22')!.ownerId, sheet: 'checkIns', rows: [{ 'Goal key': 'G-22', Week: String(week), Value: '85', 'Next step': 'Roll the runner image out to the last two teams' }] },
    { case: 'saves-plan-with-reason', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-1', Target: String(g1.plan.target + (g1.plan.target >= g1.plan.start ? 1 : -1)), Reason: 'Agreed at the quarterly review' }] },
    { case: 'saves-new-goal', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'Runbooks for every paging service', Owner: 'Rhea Kapoor', Team: 'CI/CD', Unit: '%', Start: '40', Target: '90' }] },
    { case: 'saves-person', actor: 'amara', sheet: 'people', rows: [{ ID: 'rhea', Team: 'Build & Release' }] },
    { case: 'saves-stop', actor: 'amara', sheet: 'goals', rows: [{ Key: 'G-14', Action: 'Stop', Reason: 'Folded into the platform goal this quarter.' }] },
    // A whole tree in one batch (backlog BT): each row's Ref names the goal it adds, so the next row can feed into it.
    { case: 'saves-tree-by-ref', actor: 'amara', sheet: 'goals', rows: [
      { Ref: 'top', Goal: 'Register: incidents closed in time', Owner: 'Rhea Kapoor', Team: 'CI/CD', Unit: '%', Start: '60', Target: '90' },
      { Ref: 'mid', Goal: 'Register: runbooks reviewed', Owner: 'Rhea Kapoor', Team: 'CI/CD', Unit: '%', Start: '40', Target: '80', 'Feeds into ref': 'top' },
      { Ref: 'leaf', Goal: 'Register: alerts with an owner', Owner: 'Rhea Kapoor', Team: 'CI/CD', Unit: '%', Start: '50', Target: '95', 'Feeds into ref': 'mid' },
    ] },
  ];
}
export const CHANGES_HEADER = ['case', 'row', 'actor', 'sheet', 'line', 'rows', 'answers', 'given', 'target', 'name', 'kind', 'diffs', 'counts', 'unchanged', 'needs_reason', 'saves', 'author'];

/**
 * What the change engine would save for each case. Row 0 is the case: its input, the counts (`key=n`, space-separated,
 * every count that isn't 0, in the engine's order), the unchanged rows, whether a reason is missing and whether it saves.
 * Rows 1… are its items in the engine's order: the sheet and line they came from, the goal changed (`target`, its ID;
 * empty for a person or team), the name of what changed, the kind of change,
 * every field changed as `field: from → to`, joined by ` | `, and a check-in's author once saved (replacing one keeps who
 * checked in).
 */
export function changeRowsOf(w: ConformanceWorkspace): string[][] {
  const rows: string[][] = [];
  for (const c of changeCases(w)) {
    const cs = runCase(w, c);
    const counts = Object.entries(cs.counts).filter(([, n]) => n).map(([key, n]) => `${key}=${n}`).join(' ');
    rows.push([c.case, '0', c.actor, c.sheet, '', JSON.stringify(c.rows), c.answers ? JSON.stringify(c.answers) : '', c.given ? JSON.stringify(c.given) : '', '', '', '', '', counts, String(cs.unchanged), yes(cs.needsReason), yes(!!cs.commit), '']);
    cs.items.forEach((it, i) => rows.push([c.case, String(i + 1), '', it.sheet, String(it.row), '', '', '', it.goalId, it.goal, it.kind, it.diffs.map((d) => `${d.field}: ${d.from} → ${d.to}`).join(' | '), '', '', yes(!!it.needsReason), '', it.author ?? '']));
  }
  return rows;
}

/* ---------- the read-back (goal entry, rule 5; GE3) ---------- */

/** The drafts readback.csv reads back: New goal's last step, by `viewer`, at `builtFor`. */
const READBACK_CASES: { case: string; viewer: string; draft: Partial<GoalDraft> }[] = [
  { case: 'number-own', viewer: 'tunde', draft: { ownerId: 'tunde', teamId: 'build', parentId: 'ns-mttr', title: 'Signed artifacts in staging', unit: '%', start: '40', target: '90' } },
  { case: 'number-for-someone-else', viewer: 'tunde', draft: { ownerId: 'amara', teamId: 'build', title: 'Signed artifacts in staging', unit: '%', start: '40', target: '90' } },
  { case: 'number-answered', viewer: 'tunde', draft: { ownerId: 'tunde', teamId: 'build', title: 'Runbook coverage', unit: '%', start: '50', target: '150', decimals: '0', fromWeek: '40', endWeek: '66', shape: 'back' } },
  { case: 'range', viewer: 'tunde', draft: { ownerId: 'tunde', teamId: 'build', kind: 'range', title: 'Change failure rate', unit: '%', limit: '12' } },
  { case: 'stages', viewer: 'tunde', draft: { ownerId: 'tunde', teamId: 'build', kind: 'milestone', title: 'Signing rolled out', stages: [{ id: 's1', name: 'Pilot', dueWeek: '50' }] } },
  { case: 'north-star', viewer: 'amara', draft: { ownerId: 'amara', teamId: 'office', level: 'north-star', title: 'Developer happiness', unit: 'pts', start: '30', target: '40', guardrail: true, alsoHelps: ['ns-mttr'] } },
];
export const READBACK_HEADER = ['case', 'viewer', 'draft', 'rows', 'after'];

/**
 * What New goal's last step says for each case: its rows (`label: sentence`, separated by ` | `) and its "After you
 * publish" lines (separated by ` | `), with the weekly rhythm and Reviews on. Every question asked is taken as answered.
 */
export function readBackRowsOf(w: ConformanceWorkspace, cases: ScreenCases['readback']['cases'] = READBACK_CASES): string[][] {
  const at = new Date(w.builtFor);
  const s = asOf(w, at);
  const week = currentWeek(w.cycle, at);
  return cases.map((x) => {
    const d: GoalDraft = { ...blankGoal('', '', ''), ...x.draft };
    const parent = s.goals.find((g) => g.id === d.parentId) ?? null;
    const owner = s.people.find((p) => p.id === d.ownerId) ?? null;
    const level = x.draft.level ?? startLevel(w.cycle, d.ownerId, s.teams, s.goals, parent);
    const answers = goalChecks({ ...d, level: level ?? d.level }, { week, cycleWeeks: w.cycle.weeks, existing: null, door: 'form', startDate: w.cycle.startDate }).filter((c) => c.id !== 'stage-past' && c.readBack).map((c) => c.readBack);
    const rb = readBack(d, {
      cycle: w.cycle, week, today: at, level, owner: owner ? { name: owner.name, isViewer: owner.id === x.viewer } : null, teamName: s.teams.find((t) => t.id === d.teamId)?.name ?? '',
      parent: parent ? { title: parent.title, key: parent.key } : null, alsoHelps: d.alsoHelps.map((id) => s.goals.find((g) => g.id === id)?.title ?? id), metric: null, answers, rhythm: 'weekly', reviewsOn: on(w, 'reviews'),
      reviewsJoined: level ? reviewsJoining({ id: 'new-goal', level, parentId: d.parentId || null, title: d.title }, w.reviews as Review[], s.goals, w.cycle) : [], wsName: WORKSPACE_NAME,
    });
    return [x.case, x.viewer, JSON.stringify(x.draft), rb.rows.map((r) => `${r.label}: ${r.text}`).join(' | '), rb.after.join(' | ')];
  });
}

/* ---------- stage 3's inputs (drill 11, gap S3-1) ---------- */

/** The workspace's name as the screens say it: Home's lead and quiet line, and the read-back's "After you publish". */
export const WORKSPACE_NAME = 'Platform Engineering';

/**
 * Stage 3's inputs, the screens' cases: what navigation.csv, find.csv, readback.csv and home.csv are made from, beyond
 * workspace.json. Written to spec/conformance/screen-cases.json, which the harness puts beside the workspace it hands a
 * stage 3 command, so a rebuild reads its cases from there and never from the expected files (as change-cases.json does
 * for stage 2). Faro's own drill (scripts/drill-faro) reads them back from that copy.
 */
export interface ScreenCases {
  /** The workspace's name, as the screens say it. */
  workspaceName: string;
  navigation: {
    /** Each viewer, by person id: every address below is answered for each. */
    viewers: string[];
    /** The core's addresses, with no module adding a menu item. */
    addresses: string[];
    /** A module's menu item, as a module gives it (its id, its address, its label, its menu group), for the rows after the core's. */
    module: { id: string; to: string; label: string; group: 'work' | 'lookup' };
    /** The addresses answered with that module's item in the menu: its page and a page under it. */
    moduleAddresses: string[];
    /** Home in a workspace with features switched off, each a row per viewer: `address` is the marked address the row
        carries, `off` the module ids switched off, or `all` for every optional feature. */
    switchedOff: { address: string; off: string[] | 'all' }[];
  };
  /** One search per row, in order: the kind (`goal`, `person` or `team`) and what is typed. */
  find: { kind: 'goal' | 'person' | 'team'; q: string }[];
  readback: {
    /** A blank goal, every field of New goal's draft as the form starts it: each case's `draft` is set over it. Numbers
        and weeks are text, as typed; weeks count from the cycle's start (`fromWeek`, `endWeek`, a stage's `dueWeek`);
        `alsoHelps` holds goal ids. */
    blank: GoalDraft;
    /** Each draft, by case: who is looking, and the fields set over the blank goal. */
    cases: { case: string; viewer: string; draft: Partial<GoalDraft> }[];
  };
  home: {
    /** Each viewer, by person id. */
    viewers: string[];
    /** Each moment Home is asked about, as an ISO time (noon UTC on each of the fourteen days up to builtFor). */
    days: string[];
  };
}

const navigationCases = (): ScreenCases['navigation'] => ({ viewers: NAV_VIEWERS, addresses: NAV_ADDRESSES, module: NAV_MODULE, moduleAddresses: [NAV_MODULE.to, NAV_MODULE.to + '/one'], switchedOff: NAV_SWITCHED_OFF });

/** Stage 3's cases for this workspace (screen-cases.json). */
export function screenCases(w: ConformanceWorkspace): ScreenCases {
  return {
    workspaceName: WORKSPACE_NAME,
    navigation: navigationCases(),
    find: FIND_SEARCHES.map(([kind, q]) => ({ kind, q })),
    readback: { blank: blankGoal('', '', ''), cases: READBACK_CASES },
    home: { viewers: HOME_VIEWERS, days: homeDays(w).map((d) => d.toISOString()) },
  };
}

/* ---------- CSV ---------- */

const field = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (head: string[], rows: string[][]) => [head, ...rows].map((r) => r.map(field).join(',')).join('\n') + '\n';

/** Stage 1's files and scorecard-words.csv: all that is made from the edge-case workspace (src/spec/edge.ts). */
export const EDGE_FILES = ['status', 'flags', 'projection', 'scorecard', 'scorecard-words', 'checkin'] as const;
export function edgeFiles(w: ConformanceWorkspace): Record<string, string> {
  const t = conformanceTables(w);
  return Object.fromEntries(EDGE_FILES.map((k) => [`${k}.csv`, toCsv(HEADERS[k], t[k])]));
}

/** The CSV files, by name: from the edge-case workspace, only stage 1's (edgeFiles). */
export function conformanceFiles(w: ConformanceWorkspace, cases: ScreenCases = screenCases(w)): Record<string, string> {
  if (w.edge) return edgeFiles(w);
  const t = conformanceTables(w);
  return {
    ...Object.fromEntries((Object.keys(HEADERS) as (keyof ConformanceTables)[]).map((k) => [`${k}.csv`, toCsv(HEADERS[k], t[k])])), 'find.csv': toCsv(FIND_HEADER, findRowsOf(w, cases.find)), 'goals.csv': toCsv(GOALS_HEADER, goalsQueryRowsOf(w)), 'goal-row.csv': toCsv(GOAL_ROW_HEADER, goalRowRowsOf(w)), 'page-header.csv': toCsv(PAGE_HEADER_HEADER, pageHeaderRowsOf(w, cases.navigation)), 'form-footer.csv': toCsv(FORM_FOOTER_HEADER, formFooterRows()), 'navigation.csv': toCsv(NAV_HEADER, navigationRowsOf(w, cases.navigation)), 'import.csv': toCsv(IMPORT_HEADER, importRowsOf(w)), 'changes.csv': toCsv(CHANGES_HEADER, changeRowsOf(w)), 'readback.csv': toCsv(READBACK_HEADER, readBackRowsOf(w, cases.readback.cases)), 'home.csv': toCsv(HOME_HEADER, homeRowsOf(w, cases.home)), 'zone.csv': toCsv(ZONE_HEADER, zoneRowsOf(w.zone)),
    ...Object.fromEntries(MODULE_FILES.map((f) => [`${f.file}.csv`, toCsv(f.header, f.rows(w, { asOf }))])),
  };
}
