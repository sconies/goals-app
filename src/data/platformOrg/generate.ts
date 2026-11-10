/* Builds the Platform Engineering example from its description (people.ts, goals.ts, conversation.ts): a year of
   weekly check-ins up to today, the requests they raise, comments, asks for an update, reviews and what was said in
   them, watches, saved views and the change log for all of it.

   It plays the year forward a week at a time and does everything the way the app does: each check-in is a draft
   judged by the check-in rules (evaluate, toCheckIn), requests follow the request rules, a spreadsheet goes through
   the bulk-change engine, and comments, reviews, watches and views go through the shared actions. Nothing here
   restates a rule. Randomness comes from a seeded generator, so the same day always gives the same workspace. */
import * as A from '../../domain/actions';
import * as M from '../../domain/metrics';
import { checkInChange, goalChange, type Lookup } from '../../domain/changes';
import { planChanges, type Rec } from '../../domain/changeset';
import { emptyDraft, evaluate, isShare, toCheckIn, type Draft, type Evaluation } from '../../domain/checkin';
import { replanned } from '../../domain/goal';
import { withKeys } from '../../domain/goalKey';
import { goalAsOf, planAt } from '../../domain/plan';
import { requestsAfterCheckIn } from '../../domain/asks';
import type { Ask, Change, CheckIn, Cycle, Decision, Goal, MetricGoal, Review, SavedView, Snapshot, StageUpdate, Watch } from '../../domain/types';
import { demoYear, yearName } from './year';
import { CLOSED, COMMENTS, HELD, REVIEWS, SAID, UNDER_WAY, UPDATE_ASKS, VIEWS, WATCHES } from './conversation';
import { GOALS, type GoalSpec, type Phase } from './goals';
import { METRICS } from './metrics';
import { PEOPLE, TEAMS } from './people';
import { AHEAD, BEHIND, fill, MORE, PATHS, STEADY, type Said, type Theme } from './stories';

const DAY = 86_400_000;
const HOUR = 3_600_000;
/** The week the description is written for. */
const WRITTEN_FOR = 45;

/** A small seeded generator (mulberry32), so the workspace is the same every time it's built for the same day. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  const next = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, normal: () => { const u = Math.max(next(), 1e-9), v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }, pick: <T,>(xs: T[]) => xs[Math.floor(next() * xs.length)]! };
}

const BEHIND_THEMES = Object.keys(BEHIND) as (keyof typeof BEHIND)[];
const isBehindTheme = (t: Theme | undefined): t is keyof typeof BEHIND => !!t && (BEHIND_THEMES as string[]).includes(t);

/** The band a share of planned progress falls in, as the status rules read it. */
const band = (ratio: number | null) => (ratio == null ? 'on' : ratio >= 1.2 ? 'ahead' : ratio >= 0.95 ? 'on' : ratio >= 0.8 ? 'risk' : 'off');

export function buildPlatformOrg(today: Date): Snapshot {
  const year = demoYear(today);
  const NOW = year.week, WEEKS = year.weeks;
  const shift = NOW - WRITTEN_FOR;
  /** A week as written (for week 45) in this year: the story from week 20 on moves with today. */
  const T = (w: number) => Math.max(1, Math.min(WEEKS, w >= 20 ? w + shift : w));
  const startMs = Date.parse(year.startDate + 'T00:00:00Z');
  const cycle: Cycle = { id: 'cycle', name: yearName(year.startDate, WEEKS), startDate: year.startDate, weeks: WEEKS, reviewDay: 3 };
  const at = (week: number, day: number, hours: number) => new Date(startMs + week * 7 * DAY + day * DAY + hours * HOUR);
  const nowMs = today.getTime();
  const happened = (d: Date) => d.getTime() < nowMs - 60_000;
  const R = rng('platform-org');
  let n = 0;
  const newId = (prefix: string) => `${prefix}_po${++n}`;
  const person = (id: string) => PEOPLE.find((p) => p.id === id)!;

  /* ---------- Goals: as they are now, and as they were set up ---------- */
  const created: Record<string, Goal> = {};
  const goals: Goal[] = GOALS.map((s, i) => {
    const cw = s.created != null ? T(s.created) : 0;
    const base = {
      id: s.id, cycleId: cycle.id, teamId: s.team, ownerId: s.owner, title: s.title, source: s.source, definition: s.definition ?? '',
      io: (s.parent ? 'input' : 'output') as Goal['io'], level: s.level ?? 'team', guardrail: !!s.guardrail, parentId: s.parent ?? null,
      effect: s.effect ?? null, ...(s.whyHelps ? { whyHelps: s.whyHelps } : {}), ...(s.also ? { alsoHelps: s.also } : {}),
      createdAt: (cw ? at(cw, 0, 10 + (i % 6)) : new Date(startMs - 5 * DAY + i * 1000)).toISOString(),
    };
    let g: Goal;
    if (s.metric) {
      const [unit, decimals, start, target, shape] = s.metric;
      g = { ...base, kind: 'metric', unit, decimals, plan: { start, target, shape: shape ?? 'straight', ...(cw ? { fromWeek: cw } : {}) }, originalPlan: null, rebaselinedWeek: null };
    } else if (s.range) {
      const [unit, decimals, bound, limit, margin] = s.range;
      g = { ...base, kind: 'range', unit, decimals, range: { bound, limit, margin } };
    } else {
      g = { ...base, kind: 'milestone', stages: (s.stages ?? []).map(([name, due], k) => ({ id: `${s.id}_s${k + 1}`, name, dueWeek: T(due) })) };
    }
    created[s.id] = g;
    if (s.replan && g.kind === 'metric') {
      const plan = { ...g.plan, target: s.replan.target };
      g = { ...g, plan, ...replanned(g, plan, true, T(s.replan.week)) };
    }
    if (s.reowner) g = { ...g, ownerId: s.reowner.to };
    return g;
  });
  const keyed = withKeys(goals);
  const goalOf = (id: string) => keyed.find((g) => g.id === id)!;

  /* ---------- The workspace as it builds up ---------- */
  const S: Snapshot = { people: PEOPLE, teams: TEAMS, cycles: [cycle], goals: keyed, checkIns: [], decisions: [], changes: [], watches: [], reviews: [], retros: [], views: [], requests: [], tokens: [] };
  const lookup: Lookup = { person: (id) => PEOPLE.find((p) => p.id === id), goal: (id) => keyed.find((g) => g.id === id) ?? created[id], teamName: (id) => TEAMS.find((t) => t.id === id)?.name ?? id };
  const own = new Map<string, CheckIn[]>(keyed.map((g) => [g.id, []]));
  const ctx = (by: string, when: Date): A.ActionContext => ({ snapshot: S, cycle, week: Math.min(NOW, Math.max(0, Math.floor((when.getTime() - startMs) / (7 * DAY)))), actor: person(by), now: when.toISOString(), newId });
  /** Save what an action returns, as the store would. */
  const save = (c: { changes: Change[]; decisions?: Decision[]; requests?: Ask[]; watches?: Watch[]; views?: SavedView[]; reviews?: Review[]; checkIns?: CheckIn[]; tokens?: Snapshot['tokens'] } | null) => {
    if (!c) return;
    const upsert = <T extends { id: string }>(list: T[], items: T[] = []) => { for (const x of items) { const i = list.findIndex((y) => y.id === x.id); if (i < 0) list.push(x); else list[i] = x; } };
    S.changes.push(...c.changes);
    upsert(S.decisions, c.decisions);
    upsert(S.requests!, c.requests);
    upsert(S.watches, c.watches);
    upsert(S.views!, c.views);
    upsert(S.reviews, c.reviews);
    upsert(S.tokens!, c.tokens);
    for (const ci of c.checkIns ?? []) { S.checkIns.push(ci); own.get(ci.goalId)!.push(ci); }
  };

  // Every goal as it was first set up, before the year starts or in the week it was added.
  for (const g of keyed) {
    const first = { ...created[g.id]!, key: g.key };
    S.changes.push(goalChange(null, first, lookup, first.ownerId, first.createdAt, 'chg_goal_' + g.id)!);
  }
  // The reviews, set up the week before the year starts.
  for (const r of REVIEWS) {
    const when = new Date(startMs - 4 * DAY + REVIEWS.indexOf(r) * HOUR);
    save(A.saveReview(ctx(r.createdBy, when), { ...r, createdAt: when.toISOString() }, null));
  }

  /* ---------- What each goal reports in a week ---------- */
  const rAt = (s: GoalSpec, w: number): { r: number; phase: Phase } => {
    let prevTo = 0, prevR = s.arc[0]!.r;
    for (const p of s.arc) {
      // A phase that runs to the end of the year has reached its level by today: the story ends now.
      const to = p.to >= WRITTEN_FOR ? NOW : T(p.to);
      if (w <= to) return { r: prevR + (p.r - prevR) * (to === prevTo ? 1 : (w - prevTo) / (to - prevTo)), phase: p };
      prevTo = to; prevR = p.r;
    }
    const last = s.arc[s.arc.length - 1]!;
    return { r: last.r, phase: last };
  };
  // What each goal said in its last few check-ins, and the stock phrasings already used by some goal in each week, so a
  // goal never repeats itself within three weeks and two goals don't give the same stock line in the same week (demo
  // review, 8 Nov, item 10). Only which phrasing is taken changes: the one random draw per reason stays, so the year's
  // random stream (numbers, skipped and late weeks) and the story the demo tells don't move.
  const recentSaid = new Map<string, string[]>();
  const usedInWeek = new Map<number, Map<string, number>>();
  const say = (s: GoalSpec, phase: Phase, kind: 'ahead' | 'behind', w: number): Said => {
    const words = { thing: s.thing, dep: s.dep, vendor: s.vendor };
    let pool: Said[];
    if (kind === 'ahead') pool = AHEAD[(['early', 'cautious', 'oneoff', 'tailwind'] as const).find((t) => t === phase.theme) ?? 'oneoff'];
    else pool = BEHIND[isBehindTheme(phase.theme) ? phase.theme : 'slower'];
    const own = kind === 'behind' && phase.why ? phase.why.map((why) => ({ cause: pool[0]!.cause, why })) : [];
    // The owner's own words for this phase first, then the usual phrasings.
    const all = [...own, ...own, ...pool];
    const recent = recentSaid.get(s.id) ?? [];
    const week = usedInWeek.get(w) ?? new Map<string, number>();
    // From where the draw lands, the cheapest phrasing (below).
    const start = Math.floor(R.next() * all.length);
    let x = all[start]!;
    if (own.length) {
      // A phase with the owner's own words is a hand-written story: chosen as it always was, never the same words two
      // weeks running, so the goals the walkthroughs and checks follow tell the same story.
      for (let i = 0; x.why === recent.at(-1) && i < 5; i++) x = all[(all.indexOf(x) + 1 + i) % all.length]!;
    } else {
      // Stock phrasings only: from where the draw lands, the one used least by other goals this week and not said by
      // this goal in its last three check-ins.
      const uses = (y: Said) => week.get(y.why) ?? 0;
      const theme = kind === 'ahead' ? (['early', 'cautious', 'oneoff', 'tailwind'] as const).find((t) => t === phase.theme) ?? 'oneoff' : isBehindTheme(phase.theme) ? phase.theme : 'slower';
      const wider = [...all, ...(MORE[theme] ?? [])];
      const from = Math.floor((start / all.length) * wider.length);
      let best = Infinity;
      for (let i = 0; i < wider.length; i++) {
        const y = wider[(from + i) % wider.length]!;
        const cost = uses(y) * 2 + (recent.includes(y.why) ? 3 : 0);
        if (cost < best) { best = cost; x = y; }
      }
    }
    recentSaid.set(s.id, [...recent, x.why].slice(-3));
    if (!own.length) { week.set(x.why, (week.get(x.why) ?? 0) + 1); usedInWeek.set(w, week); }
    return { cause: x.cause, why: fill(x.why, words) };
  };

  /** An on-plan note: one random draw as before, then the first phrasing no other goal has used this week. */
  const steadyInWeek = new Map<number, Set<string>>();
  const steady = (s: GoalSpec, w: number): string => {
    const start = Math.floor(R.next() * STEADY.length);
    const used = steadyInWeek.get(w) ?? new Set<string>();
    let t = STEADY[start]!;
    for (let i = 0; i < STEADY.length; i++) { const x = STEADY[(start + i) % STEADY.length]!; if (!used.has(x)) { t = x; break; } }
    used.add(t); steadyInWeek.set(w, used);
    return fill(t, { thing: s.thing, dep: s.dep, vendor: s.vendor });
  };

  const stagesAt = (s: GoalSpec, g: Goal, w: number): StageUpdate[] => g.kind !== 'milestone' ? [] : g.stages.map((st, k) => {
    const [, , done, slips] = s.stages![k]!;
    const d = done == null ? null : T(done);
    if (d != null && d <= w) return { stageId: st.id, doneWeek: d, forecastWeek: null };
    const known = (slips ?? []).filter(([from]) => T(from) <= w).pop();
    return { stageId: st.id, doneWeek: null, forecastWeek: known ? T(known[1]) : null };
  });

  /** The value a number goal reports: the arc's share of the plan, with some noise, kept in the arc's band. */
  const valueAt = (s: GoalSpec, g: Goal, w: number, r: number, history: CheckIn[]): string => {
    if (g.kind === 'milestone') return '';
    const unit = 10 ** -g.decimals;
    const round = (v: number) => {
      let x = Number(v.toFixed(g.decimals));
      if (x < 0) x = 0;
      if (isShare(g) && x > 100) x = 100;
      return x;
    };
    const noise = R.normal() * (s.noise ?? 0.025);
    if (g.kind === 'range') {
      const span = g.range.margin * 3;
      const q = r + noise;
      return String(round(g.range.bound === 'atMost' ? g.range.limit - span * (1 - q) : g.range.limit + span * (1 - q)));
    }
    const asOf = goalAsOf(g, w) as MetricGoal;
    if (s.done && w === T(s.done.week)) return String(asOf.plan.target);
    const planned = planAt(asOf.plan, w, WEEKS) - asOf.plan.start;
    const first = round(asOf.plan.start + planned * (r + noise));
    // Rounding early in the year can throw a number into another band than its story; nudge it back, a unit at a time.
    const want = band(r);
    const draft = emptyDraft(asOf, null);
    const bandOf = (v: number) => { const e = evaluate(asOf, cycle, w, { ...draft, value: String(v) }, history); return e.assessment.kind === 'metric' ? band(e.assessment.ratio) : 'on'; };
    if (bandOf(first) === want) return String(first);
    const dir = Math.sign(asOf.plan.target - asOf.plan.start) || 1;
    const towards = ['off', 'risk', 'on', 'ahead'].indexOf(want) > ['off', 'risk', 'on', 'ahead'].indexOf(bandOf(first)) ? dir : -dir;
    for (let k = 1; k <= 8; k++) { const v = round(first + towards * k * unit); if (bandOf(v) === want) return String(v); }
    return String(first);
  };

  /** The check-in a goal's owner posts for a week, judged by the check-in rules. */
  const checkInFor = (s: GoalSpec, g: Goal, w: number, history: CheckIn[], authorId: string, postedAt: Date): CheckIn => {
    const asOf = goalAsOf(g, w);
    const { r, phase } = rAt(s, w);
    const draft: Draft = { ...emptyDraft(asOf, history.at(-1) ?? null), value: valueAt(s, g, w, r, history), stages: stagesAt(s, g, w) };
    if (s.call && w >= T(s.call.from) && w <= T(s.call.to)) draft.status = s.call.status;
    if (s.done && w === T(s.done.week)) { draft.status = 'done'; draft.greenerWhy = s.done.why; }
    let e: Evaluation = evaluate(asOf, cycle, w, draft, history);
    if (e.greener && !draft.greenerWhy) draft.greenerWhy = s.call?.why ?? 'The owner’s call.';
    const a = e.assessment;
    if (e.reason) Object.assign(draft, say(s, phase, e.reason, w));
    // On plan only as written at the goal's decimals (a first week whose plan moved less than they show): nothing to
    // explain, so the owner says nothing. The reason it would have read as before is still drawn, so the year's one
    // random stream (noise, skipped and late weeks) runs as it did and the story the demo tells doesn't move.
    else if (a.kind === 'metric' && a.asWritten != null) { say(s, phase, a.asWritten < 1 ? 'behind' : 'ahead', w); draft.why = ''; }
    else draft.why = R.next() < 0.75 ? steady(s, w) : '';
    if (phase.theme === 'data' && e.reason) draft.dataFlagged = true;
    e = evaluate(asOf, cycle, w, draft, history);
    if (e.needsPath) {
      const words = { thing: s.thing, dep: s.dep, vendor: s.vendor };
      const p = phase.path ?? (() => { const pool = PATHS[isBehindTheme(phase.theme) ? phase.theme : 'slower']; return pool[Math.floor(w / 3) % pool.length]!; })();
      const state = p.state ?? 'plan';
      const asking = 'needs' in p && p.needs && (!p.answer || w <= T(p.answer.week)) ? p.needs : '';
      Object.assign(draft, { ptgWhat: fill(p.what, words), ptgState: state, ptgBy: state === 'plan' ? Math.min(WEEKS, w + (p.in ?? 4)) : null, needs: asking });
    }
    return toCheckIn(asOf, cycle, w, draft, history, authorId, postedAt, `ci_${g.id}_${w}`);
  };

  /** A check-in's requests, as the app works them out after a post. */
  const followRequests = (g: Goal, c: CheckIn) => {
    const r = requestsAfterCheckIn(g, c, S, c.authorId, c.postedAt, newId);
    save({ requests: r.requests, changes: r.changes });
  };

  /* ---------- The year, a week at a time ---------- */
  const firstWeek = (s: GoalSpec) => (s.created != null ? T(s.created) + 2 : 1);
  const lastWeek = (s: GoalSpec) => Math.min(NOW, s.last != null ? T(s.last) : NOW, s.done ? T(s.done.week) : NOW);
  const finished = new Set<string>();
  // Answers and links change requests mid-week, so the goals involved post on time that week.
  const onTime = new Set<string>();
  for (const s of GOALS) {
    for (const p of s.arc) if (p.path?.answer) onTime.add(s.id + ':' + T(p.path.answer.week));
    if (s.link) { onTime.add(s.id + ':' + T(s.link.week)); onTime.add(s.link.goal + ':' + T(s.link.week)); }
  }

  for (let w = 1; w <= NOW; w++) {
    // Monday: plan and owner changes take effect before anyone checks in.
    for (const s of GOALS) {
      const g = goalOf(s.id);
      if (s.replan && T(s.replan.week) === w) {
        const before = { ...created[s.id]!, key: g.key, ownerId: g.ownerId };
        const ch = goalChange(before, { ...before, ...(g.kind === 'metric' ? { plan: g.plan, originalPlan: g.originalPlan, rebaselinedWeek: g.rebaselinedWeek, planHistory: g.planHistory } : {}) } as Goal, lookup, s.replan.by, at(w, 0, 9).toISOString(), newId('chg'));
        if (ch) { ch.diffs.push({ field: 'Why', from: '—', to: s.replan.why }); S.changes.push(ch); }
      }
      if (s.reowner && T(s.reowner.week) === w) {
        const before = { ...g, ownerId: s.owner };
        const ch = goalChange(before, g, lookup, s.reowner.by, at(w, 0, 10).toISOString(), newId('chg'));
        if (ch) S.changes.push(ch);
      }
    }
    // A spreadsheet of past weeks, loaded the week after (through the bulk-change engine, as the Import screen does).
    for (const owner of [...new Set(GOALS.filter((s) => s.imported != null && T(s.imported) + 1 === w).map((s) => s.owner))]) {
      const specs = GOALS.filter((s) => s.owner === owner && s.imported != null && T(s.imported) + 1 === w);
      const rows: Rec[] = [];
      for (const s of specs) {
        const g = goalOf(s.id);
        const scratch: CheckIn[] = [];
        for (let pw = 1; pw < w; pw++) {
          const c = checkInFor(s, g, pw, scratch, owner, at(pw, 3, 9));
          scratch.push(c);
          rows.push({
            'goal id': g.id, week: String(pw), value: c.value == null ? '' : String(c.value), cause: c.cause ?? '', why: c.why,
            'path to green': c.pathToGreen?.what ?? '', 'back on plan by week': c.pathToGreen?.byWeek == null ? '' : String(c.pathToGreen.byWeek),
            recovery: c.pathToGreen?.state ?? '', needs: c.pathToGreen?.needs ?? '', 'why greener': c.greenerWhy, call: '',
          });
        }
      }
      const cs = planChanges({ tables: { checkIns: rows }, snapshot: S, cycle, week: w, actor: person(owner), now: at(w, 0, 11).toISOString(), newId, via: 'spreadsheet' });
      if (!cs.commit) throw new Error(`Platform example: the import for ${owner} didn’t pass: ${cs.issues.map((x) => x.message).join('; ')}`);
      save(cs.commit);
    }
    // Check-ins: most on Tuesday or Wednesday, some late, a few weeks missed.
    for (const s of GOALS) {
      const g = goalOf(s.id);
      if (finished.has(s.id) || w < firstWeek(s) || w > lastWeek(s)) continue;
      if (s.imported != null && w <= T(s.imported)) continue;
      const fixed = onTime.has(s.id + ':' + w);
      const story = s.arc.some((p) => p.path && w >= T(p.to) - 8);
      if (!fixed && w > 2 && w < NOW && R.next() < (s.skip ?? (story ? 0.015 : 0.04))) continue;
      const late = !fixed && R.next() < 0.1;
      // Late is after the review but still within its own week (Friday): a check-in "for week 45" is never dated in week
      // 46 (deep review, 10 Nov, U26). The draw that once picked the day stays, so the random stream doesn't move.
      const posted = late ? (R.next(), at(w, 4, 9 + R.next() * 8)) : at(w, 1 + Math.floor(R.next() * 2), 9 + R.next() * 8);
      if (!happened(posted)) continue;
      const author = s.reowner && w >= T(s.reowner.week) ? s.reowner.to : s.owner;
      const history = own.get(s.id)!;
      const c = checkInFor(s, g, w, history, author, posted);
      save({ checkIns: [c], changes: [checkInChange(null, c, g, author, 'chg_' + c.id)!] });
      followRequests(g, c);
      if (c.status === 'done') finished.add(s.id);
    }
    // Answers to requests, and goals that wait on another goal's request.
    for (const s of GOALS) {
      for (const p of s.arc) {
        if (!p.path?.answer || T(p.path.answer.week) !== w) continue;
        const r = S.requests!.find((x) => x.status === 'open' && x.goalIds[0] === s.id);
        const when = at(w, 4, 11);
        if (r && happened(when)) save(A.answerRequest(ctx(p.path.answer.by, when), r, p.path.answer.text));
      }
      if (s.link && T(s.link.week) === w) {
        const r = S.requests!.find((x) => x.status === 'open' && x.goalIds[0] === s.link!.goal);
        const when = at(w, 3, 17);
        if (r && happened(when)) save(A.linkRequest(ctx(goalOf(s.id).ownerId, when), r, goalOf(s.id)));
      }
    }
    // Comments.
    for (const [cw, day, goalId, by, text] of COMMENTS) {
      if (T(cw) !== w) continue;
      const when = at(w, day, 10 + (COMMENTS.findIndex((c) => c[2] === goalId && c[4] === text) % 7));
      if (happened(when)) save(A.addNote(ctx(by, when), goalOf(goalId), text));
    }
    // Asks for an update (and one undone the same afternoon).
    for (const [aw, day, goalId, by, undo] of UPDATE_ASKS) {
      if (T(aw) !== w) continue;
      const when = at(w, day, 11);
      if (!happened(when)) continue;
      save(A.askForUpdate(ctx(by, when), goalOf(goalId)));
      const later = at(w, day, 15);
      if (undo && happened(later)) save(A.undoUpdateAsk(ctx(by, later), goalOf(goalId)));
    }
    // Reviews: what was said, and the sessions where every goal was marked reviewed.
    for (const review of S.reviews) {
      const said = SAID.filter(([rid, sw]) => rid === review.id && T(sw) === w);
      const held = (HELD[review.id] ?? []).some((hw) => T(hw) === w);
      const underWay = w === NOW ? UNDER_WAY[review.id] : undefined;
      if (!said.length && !held && !underWay) continue;
      const session = at(w, review.weekday, 14);
      let minute = 0;
      const when = () => new Date(session.getTime() + (minute++) * 2 * 60_000);
      for (const [, , goalId, kind, by, text, assignee, due] of said) {
        const t = when();
        if (happened(t)) save(A.reviewCall(ctx(by, t), goalOf(goalId), review, kind, text, { week: w, ...(kind === 'action' ? { assigneeId: assignee ?? null, dueWeek: due != null ? T(due) : null } : {}) }));
      }
      if (held || underWay) {
        const inScope = keyed.filter((g) => review.scope.levels.includes(g.level) || review.scope.goals.includes(g.id) || review.scope.trees.some((t) => inTree(t, g.id)));
        for (const g of inScope.slice(0, held ? inScope.length : underWay)) {
          const t = when();
          if (happened(t)) save(A.reviewCall(ctx(review.createdBy, t), g, review, 'acknowledge', '', { week: w }));
        }
      }
    }
    // Questions answered and actions marked done, by whoever must respond, the afternoon after they were asked at the
    // earliest. Nothing else closes them: a comment or a check-in doesn't.
    for (const [goalId, start, cw, text] of CLOSED) {
      if (T(cw) !== w) continue;
      const a = S.requests!.find((x) => x.status === 'open' && x.goalIds[0] === goalId && x.ask.startsWith(start) && (x.kind === 'question' || x.kind === 'action'));
      if (!a || !a.recipientId) continue;
      const when = new Date(Math.max(at(w, 1, 15).getTime(), Date.parse(a.createdAt) + 20 * HOUR));
      if (!happened(when)) continue;
      const x = ctx(a.recipientId, when);
      save(a.kind === 'action' ? A.markActionDone(x, a, text) : A.answerRequest(x, a, text));
    }
  }

  function inTree(rootId: string, id: string): boolean {
    for (let g: Goal | undefined = goalOf(id); g; g = g.parentId ? goalOf(g.parentId) : undefined) if (g.id === rootId) return true;
    return false;
  }

  /* ---------- Watches, saved views and an assistant token ---------- */
  WATCHES.forEach(([by, kind, ref], i) => save(A.watch(ctx(by, at(T(2 + (i % 18)), 1, 12)), kind, ref)));
  // People keep an eye on a goal or two from their own team.
  for (const p of PEOPLE.filter((x) => !x.admin && !S.watches.some((w) => w.personId === x.id))) {
    if (R.next() < 0.45) continue;
    const mine = keyed.filter((g) => g.teamId === p.teamId && g.ownerId !== p.id);
    if (mine.length) save(A.watch(ctx(p.id, at(T(4 + Math.floor(R.next() * 30)), 2, 12)), 'goal', R.pick(mine).id));
  }
  for (const [by, name, params, pinned] of VIEWS) {
    const when = at(T(10 + VIEWS.findIndex((v) => v[1] === name)), 2, 15);
    const { commit, id } = A.saveView(ctx(by, when), { name, params });
    save(commit);
    if (pinned) save(A.pinView(ctx(by, new Date(when.getTime() + HOUR)), id, true));
  }
  {
    // One view saved and later deleted.
    const { commit, id } = A.saveView(ctx('rhea', at(T(22), 1, 16)), { name: 'Old CI view', params: 'team=cicd' });
    save(commit);
    save(A.deleteView(ctx('rhea', at(T(30), 1, 16)), id));
  }
  save(A.createToken(ctx('grace', at(T(36), 1, 10)), 'mateo', 'Claude on my laptop'));
  {
    const c = A.createToken(ctx('grace', at(T(20), 1, 10)), 'lucia', 'Weekly metrics notebook');
    save(c);
    save(A.revokeToken(ctx('grace', at(T(38), 3, 16)), c.tokens![0]!.id));
  }

  /* ---------- The metric library: set up the week before the year starts, each goal linked as it's created ---------- */
  // Fixed ids of their own, so nothing else's id moves; linking changes no goal, so no number, status or date moves.
  S.metrics = [];
  S.metricLinks = [];
  METRICS.forEach((m, i) => {
    let k = 0;
    const mid = (p: string) => (p === 'metric' ? `metric_${m.slug}` : `${p}_metric_${m.slug}_${++k}`);
    const when = new Date(startMs - 3 * DAY + i * HOUR);
    const { commit } = M.saveMetric({ ...ctx(m.ownerId, when), newId: mid }, m);
    S.metrics!.push(...commit!.metrics!);
    S.changes.push(...commit!.changes);
    for (const [goalId, teamId] of m.measures) {
      const g = goalOf(goalId);
      const linkedAt = new Date(Math.max(when.getTime(), Date.parse(created[goalId]!.createdAt)) + HOUR);
      const c = M.linkGoalMetric({ ...ctx(g.ownerId, linkedAt), newId: mid }, g, `metric_${m.slug}`, teamId)!;
      S.metricLinks!.push(...c.metricLinks!);
      S.changes.push(...c.changes);
    }
  });

  S.changes.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  return S;
}

/** The people who play each part in the walkthroughs and evals, by the part the main example's people play. */
export const PERSONAS: Record<string, { id: string; why: string }> = {
  elena: { id: 'amara', why: 'VP who runs the leadership review and watches the north stars; admin; owns no goals' },
  maya: { id: 'rhea', why: 'Owns a north star off track (lead time) and eight goals in all, several behind; watches a tree with a goal gone quiet' },
  tom: { id: 'oskar', why: 'Engineer who watches three goals and owns none' },
  sam: { id: 'tariq', why: 'Raised a too-easy target (AI-assisted review, 60% to 80%) after check-ins began' },
  kofi: { id: 'mateo', why: 'Loaded his first nine weeks of numbers from a spreadsheet (backfilled check-ins)' },
  priya: { id: 'grace', why: 'Engineering operations admin: pinned views, tokens, people and settings' },
  jonas: { id: 'bjorn', why: 'Owns the cost north star (re-planned with a reason) and watches a goal behind on another team' },
  aisha: { id: 'farah', why: 'Security director who runs the security monthly review' },
  leo: { id: 'jun', why: 'Owns dated-stage goals (the lakehouse) and the data freshness north star' },
};
/** For the walkthroughs: the goal that went quiet in a tree the owner persona watches. */
export const QUIET_GOAL = 'env-search';
/** The person standing in for the main example's people, for code that picks people by id. */
export const personaId = (oldId: string) => PERSONAS[oldId]?.id ?? oldId;
