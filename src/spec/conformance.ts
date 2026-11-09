/* The conformance data (backlog 8b): what the core rules give for every goal in every week of the demo workspace, as
   plain CSV files under spec/conformance/, made by the real rules. A rebuild proves its rules by reading the same
   workspace (spec/conformance/workspace.json) and matching every row. src/spec/conformance.test.ts recomputes them
   from workspace.json and fails on any difference. Pure: no files are read or written here. */
import { attentionFor, attentionGroup, needsAttention } from '../domain/attention';
import { currentWeek, projectionFor, valueSeries, weekDate } from '../domain/plan';
import { goalScorecard } from '../domain/scorecard';
import { assessPosted, checkInsFor, daysWithoutUpdate, goalStatus } from '../domain/status';
import type { Ask, CheckIn, Cycle, Decision, Goal, Person, Review, Snapshot, Team } from '../domain/types';

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
}

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
  };
}

/* ---------- the rows ---------- */

export interface ConformanceTables { status: string[][]; flags: string[][]; projection: string[][]; scorecard: string[][] }

export const HEADERS: Record<keyof ConformanceTables, string[]> = {
  status: ['week', 'goal', 'kind', 'status', 'calculated', 'greener', 'latest_week', 'days_without_update'],
  flags: ['week', 'goal', 'flags', 'handled', 'needs_attention', 'attention_group'],
  projection: ['week', 'goal', 'kind', 'to_week', 'value', 'low', 'high', 'slope', 'first_week', 'last_week', 'forecast_misses'],
  scorecard: ['week', 'goal', 'cell', 'value', 'tone', 'likelihood', 'label', 'sub'],
};

/** A number as the files write it: up to 6 decimal places, no trailing zeros. */
const num = (v: number | null | undefined) => (v == null ? '' : String(Number(v.toFixed(6))));
const yes = (b: boolean) => (b ? 'yes' : 'no');
const keyOf = (g: Goal) => g.key ?? g.id;

/** Every row, for every week from 0 to the week the workspace was built for, and every goal there that week. */
export function conformanceTables(w: ConformanceWorkspace): ConformanceTables {
  const cycle = w.cycle;
  const last = currentWeek(cycle, new Date(w.builtFor));
  const out: ConformanceTables = { status: [], flags: [], projection: [], scorecard: [] };
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
        out.scorecard.push([W, k, c.key, c.value, c.tone, c.likelihood ?? '', c.label, c.sub]);
      }
    }
  }
  return out;
}

/* ---------- CSV ---------- */

const field = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (head: string[], rows: string[][]) => [head, ...rows].map((r) => r.map(field).join(',')).join('\n') + '\n';

/** The CSV files, by name. */
export function conformanceFiles(w: ConformanceWorkspace): Record<string, string> {
  const t = conformanceTables(w);
  return Object.fromEntries((Object.keys(HEADERS) as (keyof ConformanceTables)[]).map((k) => [`${k}.csv`, toCsv(HEADERS[k], t[k])]));
}
