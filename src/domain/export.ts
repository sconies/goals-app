/* Exports: the goals as a workbook (for Excel), a zipped set of CSVs, one CSV, JSON (for scripts and AIs) and a short
   brief in Markdown (to paste into any AI chat). Pure functions; the app turns them into files.
   The workbook and the CSVs are the one spreadsheet format (domain/columns.ts): every sheet and column is defined there
   once, so whatever is exported can be edited and loaded back, and loads back unedited as no change at all. */
import { planHistoryOf } from './goal';
import { asksOf, isOverdue } from './asks';
import { LEVEL_LABEL } from './format';
import { planAsOf, planAt, planCheckpoints, planEnd, weekDate, weekDates } from './plan';
import { isYear, periodLabel, quarterOf, quarters } from './year';
import { answerOf, saidIn } from './review';
import { needsAttention, type Handled } from './attention';
import { summariseAll, type GoalSummary } from './summary';
import {
  ASK_STATUS, ATTENTION, FLAG, GROUPS, LABEL, lower, MEANING, QUARTER, RESULT_MEANING, RESULT_TEXT, STATUS, STOPPED, withCode, type GroupKey, type Term,
} from './vocabulary';
import {
  ASKS, asksFor, CHECK_INS, contextOf, GOALS, isWorkedOut, METRICS, metricsFor, NOTES, notesFor, PEOPLE, PLAN, planWeekValue, RESULTS, roleLoaded, ROLE_WORD, rowsOf, SHEETS, WEEK_COLUMN,
  type Cell, type Ctx, type ExportInput, type SheetKind,
} from './columns';
import type { Goal, Snapshot } from './types';
import { NO_REASON } from './checkin';

export type { Cell, ExportInput } from './columns';
/** A sheet: its name, its rows (the header first), and the columns set apart in grey: worked out, or only for reading. */
export interface Table { name: string; rows: Cell[][]; muted?: string[] }

export const EXPORT_FORMAT = 'goals-app.export';
export const EXPORT_VERSION = 1;

/** The Goals sheet's columns that describe the goal, and those the app works out (domain/columns). */
export const GOAL_EXPORT_COLUMNS = GOALS.columns.filter((c) => c.role !== 'worked').map((c) => c.header);
export const GOAL_DERIVED_COLUMNS = GOALS.columns.filter((c) => c.role === 'worked').map((c) => c.header);
export const CHECKIN_EXPORT_COLUMNS = CHECK_INS.columns.map((c) => c.header);

/**
 * The goals an export carries and their summaries. A whole-cycle export (the workbook, CSV, JSON) keeps stopped goals,
 * with their check-ins, marked Stopped (domain/removal); the brief, like every list, leaves them out.
 */
function prepare(x: ExportInput, withStopped = false) {
  const a = withStopped && !x.goals ? x.snapshot.archive : undefined;
  const s: Snapshot = a?.goals.length ? { ...x.snapshot, goals: [...x.snapshot.goals, ...a.goals], checkIns: [...x.snapshot.checkIns, ...a.checkIns], decisions: [...x.snapshot.decisions, ...a.decisions] } : x.snapshot;
  const goals = x.goals ?? s.goals;
  const sums = summariseAll(goals, s, x.cycle, x.today, x.week);
  const c = contextOf(x, s);
  return { goals, sums, name: c.name, s, c };
}

/* ---------- workbook ---------- */

const STATUS_WORDS = ['on', 'risk', 'off', 'stale', 'none', 'planned', 'done'] as const;
/** The groups of words a workbook defines, in order. */
const DEFINED: GroupKey[] = ['status', 'flag', 'attention', 'warning', 'trend', 'gap', 'result', 'quarter', 'stage', 'askStatus'];

/** Every word an export uses for a state, defined: read from the vocabulary (domain/vocabulary.ts), never restated. */
export function definitions(): Cell[][] {
  return DEFINED.flatMap((k) => Object.values(GROUPS[k].terms as Record<string, Term>).filter((t) => t.where.includes('exports') && !t.same?.startsWith('status.')).map((t) => ['Words', t.label, t.long, GROUPS[k].title]));
}

/** The README: every sheet and every column, what it means and what loading it back does, made from domain/columns. */
export function readme(x: Pick<ExportInput, 'ws' | 'cycle' | 'week' | 'today'>): Cell[][] {
  const rows: Cell[][] = [
    [`${x.ws.name}, ${x.cycle.name}. Exported ${x.today.toISOString().slice(0, 10)}, week ${x.week} of ${x.cycle.weeks}. Week 0 starts ${x.cycle.startDate}.`],
    ['Change any column marked “You can change it”, add rows, and load the file back on Import: you see every change before anything is saved. Worked-out columns are set in grey and ignored. Each sheet is recognised by its header row, so keep the headers as they are.'],
    [],
    ['Sheet', 'Column', 'Kind', 'What it means', 'When loaded back'],
  ];
  for (const sheet of SHEETS) {
    rows.push([sheet.name, null, null, `One row per ${sheet.rowIs}. ${sheet.about}`, sheet.loaded ? 'Loaded back' : 'Not loaded back']);
    for (const col of sheet.columns) rows.push([sheet.name, col.header, ROLE_WORD[col.role], col.means, sheet.loaded ? roleLoaded(col) : 'Not loaded back']);
    if (sheet.kind === 'plan') rows.push([sheet.name, WEEK_COLUMN.header, ROLE_WORD[WEEK_COLUMN.role], WEEK_COLUMN.means, WEEK_COLUMN.loaded]);
  }
  return [...rows, [], ['Words', 'Word', 'What it means', 'Kind'], ...definitions()];
}

const muted = (kind: SheetKind, head: Cell[]) => head.map(String).filter((h) => isWorkedOut(kind, h));

/** The plan as numbers, one row per number goal and one column per week (every week to its due week). */
function planRows(x: ExportInput, sums: GoalSummary[], c: Ctx): Cell[][] {
  const metric = sums.map((s) => s.goal).filter((g): g is Extract<Goal, { kind: 'metric' }> => g.kind === 'metric');
  const last = Math.max(x.cycle.weeks, ...metric.map((g) => planEnd(g.plan, x.cycle.weeks)));
  const weeks = Array.from({ length: last }, (_, i) => i + 1);
  const [head, ...body] = rowsOf(PLAN, metric.map((g) => ({ c, g })));
  return [[...head!, ...weeks.map((w) => `Week ${w}`)], ...body.map((r, i) => [...r, ...weeks.map((w) => planWeekValue({ c, g: metric[i]! }, w))])];
}

/** Every sheet of the one format, in order: Goals, Plan, Check-ins, People, Results, Asks, Notes, Metrics and the README. */
export function workbook(x: ExportInput): Table[] {
  const { goals, sums, s, c } = prepare(x, true);
  const ids = new Set(goals.map((g) => g.id));
  const goalRows = sums.map((v) => ({ c, s: v, g: v.goal }));
  // By goal, then week, then when it was posted.
  const checkIns = sums.flatMap((v) => v.checkIns.map((ci) => ({ c, g: v.goal, ci })))
    .sort((a, b) => a.g.title.localeCompare(b.g.title) || a.ci.week - b.ci.week || a.ci.postedAt.localeCompare(b.ci.postedAt));
  const book: [SheetKind, Cell[][]][] = [
    ['goals', rowsOf(GOALS, goalRows)],
    ['plan', planRows(x, sums, c)],
    ['checkIns', rowsOf(CHECK_INS, checkIns)],
    ['people', rowsOf(PEOPLE, x.snapshot.people.map((p) => ({ c, p })))],
    ['results', rowsOf(RESULTS, goalRows)],
    ['asks', rowsOf(ASKS, asksFor(x.snapshot, ids).map((a) => ({ c, a })))],
    ['notes', rowsOf(NOTES, notesFor(s, ids).map((d) => ({ c, d })))],
    ['metrics', rowsOf(METRICS, metricsFor(x.snapshot, ids).map((v) => ({ c, ...v })))],
  ];
  return [
    ...book.map(([kind, rows]) => ({ name: SHEETS.find((v) => v.kind === kind)!.name, rows, muted: muted(kind, rows[0] ?? []) })),
    { name: 'README', rows: readme(x) },
  ];
}

/**
 * The blank template: the same workbook with every sheet's headers, its worked-out columns greyed and the README, and
 * no rows. Filled in and loaded back, it adds what it says, as any workbook would.
 */
export function blankWorkbook(x: ExportInput): Table[] {
  const none = { ...x.snapshot, people: [], goals: [], checkIns: [], decisions: [], changes: [], requests: [], retros: [], reviews: [], watches: [], metrics: [], metricLinks: [] };
  return workbook({ ...x, snapshot: none, goals: undefined });
}

/** One sheet of a workbook, by name (Goals, Plan, Check-ins…). */
export const sheetNamed = (book: Table[], name: string): Table => book.find((t) => t.name === name) ?? { name, rows: [] };

/* ---------- CSV ---------- */

/**
 * RFC 4180 CSV. A text cell starting with =, +, -, @, a tab or a carriage return gets an apostrophe in front, so a
 * spreadsheet won't run it as a formula; the import takes it off again (domain/sheets unguard).
 */
export function toCsv(rows: Cell[][]): string {
  const cell = (v: Cell) => {
    if (v == null) return '';
    let t = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) t = "'" + t;
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** The workbook as CSVs, one file per sheet with the same headers, named after it: what the zipped export holds. */
export const csvFiles = (book: Table[]) => book.map((t) => ({ name: `${t.name}.csv`, text: toCsv(t.rows) }));

/* ---------- JSON ---------- */

export function toJson(x: ExportInput) {
  const { sums, name, c } = prepare(x, true);
  const team = (id: string | null) => x.snapshot.teams.find((t) => t.id === id)?.name ?? null;
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: x.today.toISOString(),
    about: `Goals, their status and the owner’s account of it, plans and weekly check-ins. Every state is a code with the words people read beside it: "status" is a code (${STATUS_WORDS.map((k) => withCode(STATUS[k])).join(', ')}) and "statusLabel" its words; "words" defines every code and word. "story" says why a goal is off, what the owner will do and by when; "needsAttention" is the one rule Home, reviews and the AI use. "result" is set once a goal is due. Weeks count from the cycle start (week 0).`,
    words: Object.fromEntries(DEFINED.map((k) => [k, Object.fromEntries(Object.values(GROUPS[k].terms as Record<string, Term>).map((t) => [t.code, { label: t.label, meaning: t.meaning }]))])),
    workspace: { id: x.ws.id, name: x.ws.name },
    cycle: { id: x.cycle.id, name: x.cycle.name, startDate: x.cycle.startDate, weeks: x.cycle.weeks, currentWeek: x.week, ...(isYear(x.cycle) ? { quarter: quarterOf(x.cycle, x.week).label, quarters: quarters(x.cycle).map((q) => ({ label: q.label, months: q.months, from: q.from, to: q.to })) } : {}) },
    people: x.snapshot.people.map((p) => ({ id: p.id, name: p.name, email: p.email || null, jobTitle: p.role || null, team: team(p.teamId), admin: p.admin })),
    teams: x.snapshot.teams.map((t) => ({ id: t.id, name: t.name, objective: t.objective || null })),
    goals: sums.map((s) => {
      const g = s.goal;
      return {
        id: g.id, key: g.key ?? null, title: g.title, level: g.level, type: g.kind, team: c.team(g.teamId), owner: c.name(g.ownerId) || null, ownerId: g.ownerId, ownerEmail: c.email(g.ownerId),
        feedsIntoId: g.parentId, whyItHelps: g.whyHelps || null, source: g.source || null, definition: g.definition || null,
        ...(g.kind === 'metric' ? {
          unit: g.unit, decimals: g.decimals,
          plan: { start: g.plan.start, target: g.plan.target, shape: g.plan.shape, fromWeek: g.plan.fromWeek ?? 0, dueWeek: planEnd(g.plan, x.cycle.weeks), setByHand: !!g.plan.points?.length,
            byWeek: planCheckpoints(g.plan.fromWeek ?? 0, planEnd(g.plan, x.cycle.weeks)).map((w) => ({ week: w, value: Number(planAt(g.plan, w, x.cycle.weeks).toFixed(g.decimals)) })) },
          earlierPlans: planHistoryOf(g).map((v) => ({ untilWeek: v.untilWeek, start: v.plan.start, target: v.plan.target, shape: v.plan.shape })),
        } : {}),
        ...(g.kind === 'range' ? { unit: g.unit, decimals: g.decimals, range: { mustStay: g.range.bound === 'atMost' ? 'atMost' : 'atLeast', limit: g.range.limit, margin: g.range.margin } } : {}),
        ...(g.kind === 'milestone' ? { stages: g.stages.map((st) => ({ id: st.id, name: st.name, dueWeek: st.dueWeek })) } : {}),
        ...(g.stoppedAt ? { stopped: { at: g.stoppedAt, by: name(g.stoppedBy ?? '') || null, reason: g.stopReason ?? null } } : {}),
        now: { status: s.status, statusLabel: g.stoppedAt ? STOPPED : s.statusLabel, statusMeaning: MEANING[s.status], value: s.nowValue, text: s.now, planThisWeek: s.planNow, gap: s.gap, lastCheckInWeek: s.lastWeek, forecast: s.forecast,
          projection: s.projection && g.kind === 'metric' ? { likeliest: Number(s.projection.value.toFixed(g.decimals)), low: Number(s.projection.low.toFixed(g.decimals)), high: Number(s.projection.high.toFixed(g.decimals)), byWeek: s.projection.week, fittedWeeks: [s.projection.from, s.projection.to] } : null },
        story: { since: s.story.since, where: s.story.where, outlook: s.story.outlook, whyItsOff: s.story.why, recoveryPlan: s.story.doing, byWhen: s.story.byWhen, needs: s.story.needs, nextStep: s.story.next, warnings: s.story.warnings, warningKinds: s.story.flags, feeds: s.story.feeds },
        needsAttention: { needs: needsAttention(s.attention), beingHandled: s.attention.handled?.text ?? null, flags: s.attention.flags.filter((f) => f.kind !== 'due').map((f) => ({ kind: f.kind, label: f.label, detail: f.detail })) },
        quarters: s.story.quarters.filter((q) => q.kind !== 'none').map((q) => ({ quarter: q.quarter.label, months: q.quarter.months, weeks: [q.quarter.from, q.quarter.to], result: q.kind, resultLabel: q.kind === 'none' ? null : QUARTER[q.kind].label, text: q.text })),
        result: s.story.result ? { kind: s.story.result.kind, label: RESULT_TEXT[s.story.result.kind], dueWeek: s.story.result.dueWeek, week: s.story.result.week } : null,
        checkIns: s.checkIns.map((c) => ({
          id: c.id, week: c.week, weekStarting: weekDate(x.cycle, c.week), value: c.value, stages: c.stages,
          planThatWeek: g.kind === 'metric' ? Number(planAt(planAsOf(g, c.week), c.week, x.cycle.weeks).toFixed(g.decimals)) : null,
          call: c.status, callLabel: LABEL[c.status], calculated: c.calculated, calculatedLabel: LABEL[c.calculated], cause: c.cause, why: c.why || null, whyGreener: c.greenerWhy || null,
          pathToGreen: c.pathToGreen ? { what: c.pathToGreen.what, byWeek: c.pathToGreen.byWeek, needs: c.pathToGreen.needs || null, state: c.pathToGreen.state ?? 'plan' } : null,
          next: c.next || null, postedAt: c.postedAt, postedBy: name(c.authorId) || null, backfilled: !!c.backfilled,
        })),
      };
    }),
    notes: saidIn(x.snapshot).filter((d) => sums.some((s) => s.goal.id === d.goalId) && ['note', 'ask', 'action'].includes(d.kind)).map((d) => ({
      goalId: d.goalId, goalKey: sums.find((s) => s.goal.id === d.goalId)?.goal.key ?? null, week: d.week, kind: d.kind === 'ask' ? 'question' : d.kind, by: name(d.byId), text: d.note,
      ...(d.kind === 'action' ? { who: name(d.assigneeId ?? '') || null, dueWeek: d.dueWeek ?? null } : {}),
      ...(d.ask ? { status: d.ask.status, statusLabel: ASK_STATUS[d.ask.status].label, answer: answerOf(d)?.text ?? null } : {}),
      at: d.at,
    })),
  };
}

/* ---------- the brief ---------- */

/** One goal's story, given room: why it's off, the recovery plan, by when, what's needed. */
function storyBlock(sm: GoalSummary, cycleWeeks: number, handled?: Handled): string[] {
  const st = sm.story;
  const g = sm.goal;
  const out: string[] = [];
  const tags = [st.since, st.result ? st.result.text : null].filter(Boolean).join(' · ');
  out.push(`### ${g.title}${g.key ? ` (${g.key})` : ''}`);
  out.push(`**${LABEL[sm.status]}**${tags ? ` · ${tags}` : ''} · ${sm.owner}, ${sm.team}${st.feeds ? ` · ${st.feeds}` : ''}`);
  out.push('');
  if (handled) out.push(`- **${ATTENTION.handled.label}:** ${handled.text}${handled.said ? `: ${handled.said}` : '.'}`);
  out.push(`- **Where it is:** ${st.where}`);
  if (st.outlook) out.push(`- **Where it’s heading:** ${st.outlook}`);
  if (sm.status === 'stale') {
    out.push(`- **What we know:** nothing new. ${st.warnings.join(' ')}`);
    return [...out, ''];
  }
  if (sm.status === 'off' || sm.status === 'risk') out.push(`- **Why it’s ${lower(STATUS[sm.status])}:** ${st.why ?? 'Not given.'}`);
  else {
    // Needs attention for something other than being behind: what was flagged, in the flag's words.
    for (const f of sm.attention.flags.filter((x) => x.kind !== 'due')) out.push(`- **${f.label}:** ${f.detail}`);
    return [...out, ''];
  }
  out.push(`- **Recovery plan:** ${st.doing ?? 'Not given.'}`);
  out.push(`- **Owner’s date:** ${st.byWhen?.replace(/^Owner’s date: b/, 'B') ?? 'No date given.'}`);
  if (st.needs) out.push(`- **Needs:** ${st.needs}`);
  if (st.next) out.push(`- **Next step:** ${st.next}`);
  for (const w of st.warnings) out.push(`- **Watch out:** ${w}`);
  void cycleWeeks;
  return [...out, ''];
}

/** A report a leader can read top to bottom: the decisions waiting on people, then every goal that needs attention told in full, what's being handled, results, then the rest. */
export function aiBrief(x: ExportInput): string {
  const { goals, sums } = prepare(x);
  const by = new Map(sums.map((s) => [s.goal.id, s]));
  const count = (k: string) => sums.filter((s) => s.status === k).length;
  const out: string[] = [];
  // Needs attention is the one rule (domain/attention.ts), as on Home and in reviews. Behind but already in hand (someone
  // looked since the latest check-in, and nothing new since) is listed apart, so what's left above it is the news.
  const needs = sums.filter((s) => needsAttention(s.attention));
  const handled = new Map<string, Handled>(sums.filter((s) => s.attention.handled).map((s) => [s.goal.id, s.attention.handled!]));
  const off = needs.filter((s) => s.status === 'off'), risk = needs.filter((s) => s.status === 'risk'), quiet = needs.filter((s) => s.status === 'stale');
  const others = needs.filter((s) => !['off', 'risk', 'stale'].includes(s.status));
  const inHand = sums.filter((s) => handled.has(s.goal.id));
  const results = sums.filter((s) => s.story.result);
  const asks = sums.filter((s) => s.attention.flags.some((f) => f.kind === 'decision') && s.story.needs);
  const flagged = sums.filter((s) => s.story.warnings.length && s.status !== 'stale');

  out.push(`# Goals: ${x.ws.name}`);
  out.push('');
  out.push(`${periodLabel(x.cycle, x.week)} (${weekDates(x.cycle, x.week)}). Exported ${x.today.toISOString().slice(0, 10)}.`);
  out.push('');
  const lead = [
    `${sums.length} goals`,
    needs.length ? `${needs.length} ${needs.length === 1 ? 'needs' : 'need'} attention` : '',
    ...(['off', 'risk', 'stale'] as const).map((k) => { const n = needs.filter((s) => s.status === k).length; return n ? `${n} ${k === 'stale' ? 'with ' : ''}${lower(STATUS[k])}` : ''; }),
    inHand.length ? `${inHand.length} behind and ${lower(ATTENTION.handled)}` : '',
    count('on') ? `${count('on')} ${lower(STATUS.on)}` : '', count('done') ? `${count('done')} ${lower(STATUS.done)}` : '',
  ].filter(Boolean);
  out.push(`**${lead.join(', ')}.**${asks.length ? ` ${asks.length} ${asks.length === 1 ? 'owner needs' : 'owners need'} a decision or help.` : ''}${flagged.length ? ` ${flagged.length} ${flagged.length === 1 ? 'goal has' : 'goals have'} a warning below.` : ''}`);
  out.push('');

  out.push('## How to read the status');
  out.push(`The status is the owner’s call each week, checked against the numbers; a call ${lower(FLAG.greener)} says so.`);
  for (const k of ['on', 'risk', 'off', 'stale'] as const) out.push(`- **${LABEL[k]}:** ${MEANING[k]}`);
  out.push(`- **${ATTENTION.needs.label}:** ${ATTENTION.needs.long}`);
  for (const k of ['completed', 'late', 'missed'] as const) out.push(`- **${RESULT_TEXT[k]}:** ${RESULT_MEANING[k]}`);
  out.push('');

  if (asks.length) {
    out.push(`## ${FLAG.decision.label}`);
    for (const s of asks) out.push(`- **${s.story.needs}** · for ${s.goal.title} (${s.owner}, ${LABEL[s.status].toLowerCase()})`);
    out.push('');
  }
  const section = (k: 'off' | 'risk' | 'stale', list: GoalSummary[]) => {
    if (!list.length) return;
    out.push(`## ${STATUS[k].label}: ${STATUS[k].short}`);
    out.push('');
    for (const s of list) out.push(...storyBlock(s, x.cycle.weeks));
  };
  section('off', off);
  section('risk', risk);
  if (others.length) {
    out.push(`## Also ${lower(ATTENTION.needs)}`);
    out.push('');
    for (const s of others) out.push(...storyBlock(s, x.cycle.weeks));
  }
  if (inHand.length) {
    out.push(`## ${ATTENTION.handled.label}: behind, but someone has looked since the latest check-in`);
    out.push('Nothing new since: no new check-in and no new flag. They need attention again when either comes.');
    out.push('');
    for (const s of inHand) out.push(...storyBlock(s, x.cycle.weeks, handled.get(s.goal.id)));
  }
  section('stale', quiet);
  const otherWarnings = sums.filter((s) => !needs.includes(s) && !handled.has(s.goal.id) && s.story.warnings.length);
  if (otherWarnings.length) {
    out.push('## Worth a look');
    for (const s of otherWarnings) out.push(`- **${s.goal.title}** (${s.owner}): ${s.story.warnings.join(' ')}`);
    out.push('');
  }
  if (results.length) {
    out.push('## Results');
    for (const k of ['missed', 'late', 'completed'] as const) {
      const list = results.filter((s) => s.story.result!.kind === k);
      if (!list.length) continue;
      out.push(`**${RESULT_TEXT[k]}** (${list.length})`);
      for (const s of list) out.push(`- ${s.goal.title} (${s.owner}): ${s.story.result!.text}. ${s.story.where}`);
    }
    out.push('');
  }

  if (isYear(x.cycle)) {
    const ended = quarters(x.cycle).filter((q) => x.week > q.to);
    if (ended.length) {
      out.push('## Quarters so far');
      out.push('Each quarter’s target is read off the owner’s own plan: where the plan said the goal would be at the quarter’s end.');
      for (const q of ended) {
        const rs = sums.map((s) => ({ s, r: s.story.quarters.find((y) => y.quarter.n === q.n)! })).filter((y) => y.r && (y.r.kind === 'met' || y.r.kind === 'missed'));
        const missed = rs.filter((y) => y.r.kind === 'missed');
        out.push(`- **${q.label} (${q.months}):** ${QUARTER.met.label} ${rs.length - missed.length} of ${rs.length}.${missed.length ? ` ${QUARTER.missed.label}: ${missed.map((y) => `${y.s.goal.title} (${y.r.text.replace(/^Q\d: /, '')})`).join('; ')}.` : ''}`);
      }
      const now = quarterOf(x.cycle, x.week);
      out.push(`- **${now.label} (${now.months}):** ${lower(QUARTER.open)}, week ${x.week - now.from + 1} of ${now.to - now.from + 1}.`);
      out.push('');
    }
  }

  out.push('## Every goal, by what it feeds');
  const line = (s: GoalSummary, depth: number) => {
    const lvl = s.goal.level !== 'team' ? ` [${LEVEL_LABEL[s.goal.level]}]` : '';
    out.push(`${'  '.repeat(depth)}- **${s.goal.title}**${s.goal.key ? ` (${s.goal.key})` : ''}${lvl}: ${s.story.label}. Now ${s.now}, target ${s.target}${s.dueWeek !== x.cycle.weeks && !/by week \d+$/.test(s.target) ? ` by week ${s.dueWeek}` : ''}; ${s.gap}. Owner ${s.owner}.${s.forecast ? ' ' + s.forecast : ''}`);
  };
  const seen = new Set<string>();
  const walk = (g: Goal, depth: number) => {
    if (seen.has(g.id)) return;
    seen.add(g.id);
    line(by.get(g.id)!, depth);
    goals.filter((c) => c.parentId === g.id).forEach((c) => walk(c, depth + 1));
  };
  goals.filter((g) => !g.parentId || !by.has(g.parentId)).forEach((g) => walk(g, 0));
  goals.forEach((g) => walk(g, 0)); // anything left in a loop
  out.push('');

  const ids = new Set(goals.map((g) => g.id));
  const open = asksOf(x.snapshot).filter((a) => a.status === 'open' && (a.kind === 'question' || a.kind === 'action') && ids.has(a.goalIds[0]!));
  if (open.length) {
    out.push('## Open questions and actions');
    const name = (id: string | null) => x.snapshot.people.find((p) => p.id === id)?.name ?? 'someone';
    for (const a of open) {
      const g = goals.find((y) => y.id === a.goalIds[0])!;
      out.push(a.kind === 'question'
        ? `- Question for ${name(a.recipientId)} on ${g.title}${a.week ? ` (week ${a.week})` : ''}, not answered yet: ${a.ask}`
        : `- Action for ${name(a.recipientId)}${a.dueWeek ? ` by week ${a.dueWeek}${isOverdue(a, x.week) ? `, ${lower(ASK_STATUS.overdue)}` : ''}` : ''} on ${g.title}: ${a.ask}`);
    }
    out.push('');
  }

  const withHistory = sums.filter((s) => s.checkIns.length);
  if (withHistory.length) {
    out.push('## Weekly history');
    out.push('Week: number [plan that week] (owner’s call), and the reason when it was behind.');
    for (const s of withHistory) {
      const g = s.goal;
      out.push(`- **${g.title}**${g.kind !== 'milestone' && g.unit ? ` (${g.unit})` : ''}`);
      for (const c of s.checkIns) {
        const v = g.kind === 'milestone' ? `${(c.stages ?? []).filter((u) => u.doneWeek != null).length}/${g.stages.length} stages` : c.value == null ? '—' : String(c.value);
        // The plan that applied in that week, as the goal page and quarter results judge it, not today's plan.
        const plan = g.kind === 'metric' ? ` [${Number(planAt(planAsOf(g, c.week), c.week, x.cycle.weeks).toFixed(g.decimals))}]` : '';
        const said = ['off', 'risk'].includes(c.status) && c.why && c.why !== NO_REASON ? `: ${c.why}` : '';
        out.push(`  - w${c.week} ${v}${plan} (${LABEL[c.status].toLowerCase()})${said}${c.backfilled ? ' (loaded later)' : ''}`);
      }
    }
    out.push('');
  }
  return out.join('\n');
}
