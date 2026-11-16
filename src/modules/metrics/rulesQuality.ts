/* Metric quality (backlog MQ2; docs/design/mq2): a metric's stage (Draft → Defined → Verified), what it still needs to
   reach Defined, what lapses Verified, who may verify, baselines per slice, a goal's rhythm from the refresh, and the
   "To sort out" reasons. Rules live once: the screens, the import and the MCP tools all call these. As pure as
   src/domain: no clock (`now` is passed in), browser, network or database.

   How the stage sits beside the library's other two marks (decided at build, 15 Nov):
   - MS's measurement (Measured, Partly, Gap) says whether the number exists today; the stage says whether its
     definition is complete and someone else has reproduced it. A Gap metric can be Draft or Defined, never Verified:
     there is nothing to reproduce. Gap goals stay held to no number, as before.
   - MQ's `confidence` is the owner's own word on how far to trust the number. It stays, shown under Structure as "the
     owner's confidence", never beside the stage: the stage is the evidence, confidence an opinion. */
import type { Id, Person, Team } from '../../domain/types';
import { AGGREGATE_LABEL, AGGREGATES, MEASURE_LABEL, MEASURES } from './qualityWords';
import type { Metric, MetricAggregate, MetricBaseline, MetricCalc, MetricMeasure, MetricPart, MetricVerification, MetricWindow } from './types';

export type MetricStage = 'draft' | 'defined' | 'verified';
export const STAGES: readonly MetricStage[] = ['draft', 'defined', 'verified'];
export const STAGE_LABEL: Record<MetricStage, string> = { draft: 'Draft', defined: 'Defined', verified: 'Verified' };
export { AGGREGATES, AGGREGATE_LABEL, MEASURES, MEASURE_LABEL } from './qualityWords';
export const WINDOW_KINDS = ['point', 'rolling', 'period', 'cumulative'] as const;
export const PERIODS = ['week', 'month', 'quarter'] as const;
/** Verified lasts this many months; "To verify" lists a metric this many days before it is up. */
export const VERIFIED_MONTHS = 12;
export const DUE_SOON_DAYS = 30;
export const QUALITY_LIMITS = { part: 500, formula: 1000, link: 500, query: 4000, refreshNote: 60, period: 60, how: 300, note: 1000, reason: 300, attempts: 20, verifiers: 20, baselines: 400 } as const;

/* ---------- the calculation and the window, in words ---------- */

const t = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const said = (v: string | undefined | null) => !!(v ?? '').trim();

/** "Duration, p90", "Count, mean per day", "Ratio", "Other or composite": the calculation's two fields in a few words. */
export function calcWords(c: MetricCalc | null | undefined): string {
  if (!c) return 'No type yet';
  const head = MEASURE_LABEL[c.measure];
  if (c.measure === 'ratio' || c.measure === 'other' || !c.aggregate) return head;
  const agg = c.aggregate === 'percentile' ? `p${c.percentile ?? '?'}` : AGGREGATE_LABEL[c.aggregate];
  return `${head}, ${agg}${c.aggregate === 'mean' && c.per ? ` per ${c.per}` : ''}`;
}

/** "Rolling 28 days", "Per month", "Point in time", "Cumulative since 1 Jan 2026", or "Not said". */
export function windowWords(w: MetricWindow | null | undefined): string {
  if (!w) return 'Not said';
  if (w.kind === 'point') return 'Point in time';
  if (w.kind === 'rolling') return `Rolling ${w.days} ${w.days === 1 ? 'day' : 'days'}`;
  if (w.kind === 'period') return `Per ${w.period}`;
  const d = new Date(`${w.since}T00:00:00Z`);
  return `Cumulative since ${isNaN(d.getTime()) ? w.since : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
}

/** "Refreshed weekly", with its note: "Refreshed weekly, Mondays"; "Refresh not said". */
export function refreshWords(m: Pick<Metric, 'refresh' | 'refreshNote'>): string {
  if (!m.refresh) return 'Refresh not said';
  const w = m.refresh === 'live' ? 'live' : m.refresh;
  return `Refreshed ${w}${m.refreshNote ? `, ${m.refreshNote}` : ''}`;
}

/* ---------- reading what someone typed or sent ---------- */

const partFrom = (v: unknown): MetricPart | undefined => {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const p: MetricPart = { counts: t(o.counts), filters: t(o.filters), excludes: t(o.excludes ?? o.leaves_out ?? o.leavesOut) };
  if (t(o.name)) p.name = t(o.name);
  return p.counts || p.filters || p.excludes || p.name ? p : undefined;
};

/** A calculation from a form or a tool's input (snake or camel case); null for "not said". Unknown values are kept so
    `qualityProblems` can say what is wrong with them. */
export function calcFrom(v: unknown): MetricCalc | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'object') return { measure: String(v) as MetricMeasure, aggregate: null };
  const o = v as Record<string, unknown>;
  const measure = t(o.measure ?? o.what) as MetricMeasure;
  let aggregate = (t(o.aggregate ?? o.how) || null) as MetricAggregate | null;
  let percentile = o.percentile == null || o.percentile === '' ? undefined : Number(o.percentile);
  const p = aggregate ? /^p(\d{1,2})$/i.exec(aggregate) : null;
  if (p) { aggregate = 'percentile'; percentile = Number(p[1]); }
  const c: MetricCalc = { measure, aggregate };
  if (aggregate === 'percentile' && percentile !== undefined) c.percentile = percentile;
  if (t(o.per)) c.per = t(o.per);
  const part = partFrom(o.part ?? (o.counts !== undefined || o.filters !== undefined || o.excludes !== undefined ? o : undefined));
  if (part && measure !== 'ratio') { const { name: _n, ...rest } = part; c.part = rest; }
  const num = partFrom(o.numerator);
  const den = partFrom(o.denominator);
  if (num) c.numerator = num;
  if (den) c.denominator = den;
  if (t(o.formula)) c.formula = t(o.formula);
  return c;
}

/** A window from a form or a tool's input: an object, or words ("rolling 28 days", "per month", "point in time",
    "cumulative since 2026-01-01"); null for "not said". Unknown kinds are kept for `qualityProblems` to name. */
export function windowFrom(v: unknown): MetricWindow | null {
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    let m: RegExpExecArray | null;
    if ((m = /^rolling\s+(\d+)\s*(d|days?)?$/.exec(s))) return { kind: 'rolling', days: Number(m[1]) };
    if ((m = /^(?:per|each|every)\s+(week|month|quarter)$/.exec(s))) return { kind: 'period', period: m[1] as 'week' };
    if (/^point( in time)?$/.test(s)) return { kind: 'point' };
    if ((m = /^cumulative(?: since)?\s+(\d{4}-\d{2}-\d{2})$/.exec(s))) return { kind: 'cumulative', since: m[1]! };
    return { kind: s as 'point' };
  }
  if (typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const kind = t(o.kind) as MetricWindow['kind'];
  if (kind === 'rolling') return { kind, days: Number(o.days) };
  if (kind === 'period') return { kind, period: t(o.period) as 'week' };
  if (kind === 'cumulative') return { kind, since: t(o.since) };
  return { kind } as MetricWindow;
}

/** What is wrong with the quality fields as typed, in words; empty when they can be saved. None of them is required:
    an incomplete definition saves as Draft. */
export function qualityProblems(m: Metric, people: readonly Pick<Person, 'id'>[]): string[] {
  const out: string[] = [];
  const c = m.calculation;
  if (c) {
    if (!MEASURES.includes(c.measure)) out.push(`What is measured is one of ${MEASURES.join(', ')}.`);
    if (c.aggregate != null && !AGGREGATES.includes(c.aggregate)) out.push(`How it is aggregated is one of total, mean, median, pXX (a percentile, e.g. p90) or latest.`);
    if (c.aggregate === 'percentile' && !(Number.isInteger(c.percentile) && c.percentile! >= 1 && c.percentile! <= 99)) out.push('Say which percentile, from p1 to p99.');
    for (const p of [c.part, c.numerator, c.denominator]) if (p && [p.counts, p.filters, p.excludes, p.name ?? ''].some((x) => x.length > QUALITY_LIMITS.part)) out.push(`Keep each part’s counts, filters and exclusions to ${QUALITY_LIMITS.part} characters or fewer.`);
    if ((c.formula ?? '').length > QUALITY_LIMITS.formula) out.push(`Keep the formula to ${QUALITY_LIMITS.formula.toLocaleString('en-GB')} characters or fewer.`);
  }
  const w = m.timeWindow;
  if (w) {
    if (!WINDOW_KINDS.includes(w.kind)) out.push('The window is a point in time, rolling N days, per period (week, month, quarter) or cumulative since a date.');
    else if (w.kind === 'rolling' && !(Number.isInteger(w.days) && w.days >= 1 && w.days <= 730)) out.push('A rolling window is 1 to 730 days.');
    else if (w.kind === 'period' && !PERIODS.includes(w.period)) out.push('A window per period is per week, per month or per quarter.');
    else if (w.kind === 'cumulative' && !/^\d{4}-\d{2}-\d{2}$/.test(w.since)) out.push('A cumulative window says the day it counts from (yyyy-mm-dd).');
  }
  if (m.sourceLink && (!/^https?:\/\/\S+$/i.test(m.sourceLink) || m.sourceLink.length > QUALITY_LIMITS.link)) out.push(`The source link is a web address starting with https:// (up to ${QUALITY_LIMITS.link} characters).`);
  if ((m.sourceQuery ?? '').length > QUALITY_LIMITS.query) out.push(`Keep the query to ${QUALITY_LIMITS.query.toLocaleString('en-GB')} characters or fewer.`);
  if ((m.refreshNote ?? '').length > QUALITY_LIMITS.refreshNote) out.push(`Keep when it refreshes to ${QUALITY_LIMITS.refreshNote} characters or fewer.`);
  if ((m.verifiers ?? []).length > QUALITY_LIMITS.verifiers) out.push(`Name at most ${QUALITY_LIMITS.verifiers} verifiers.`);
  if ((m.verifiers ?? []).some((v) => !people.some((p) => p.id === v))) out.push('Each verifier is someone in this workspace.');
  return out;
}

/* ---------- Defined: the ten parts ---------- */

export type DefinedPart = 'meaning' | 'calculation' | 'scope' | 'unit' | 'direction' | 'window' | 'source' | 'sourceOwner' | 'refresh' | 'owner';
/** The ten parts of a full definition, in the order they are said, with what each is called and why it matters. */
export const DEFINED_PARTS: readonly { part: DefinedPart; words: string; why: string }[] = [
  { part: 'meaning', words: 'what it means, in plain words', why: 'so everyone reads the number the same way' },
  { part: 'calculation', words: 'what is measured, how it is aggregated and its parts', why: 'so two people get the same figure from the same data' },
  { part: 'scope', words: 'its filters and what it leaves out', why: 'so nobody counts what it doesn’t' },
  { part: 'unit', words: 'its unit', why: 'so a goal can’t be set in a different scale' },
  { part: 'direction', words: 'which way is better', why: 'so a goal aims the right way' },
  { part: 'window', words: 'its window', why: 'so a figure is read over the same span each time' },
  { part: 'source', words: 'a link to the report or query', why: 'without it the number can’t be checked' },
  { part: 'sourceOwner', words: 'who owns the source', why: 'so someone answers when it breaks' },
  { part: 'refresh', words: 'how often it refreshes', why: 'so a goal’s check-ins follow it' },
  { part: 'owner', words: 'a metric owner who is here', why: 'so someone answers for the definition' },
];

const partHas = (p: MetricPart | undefined, k: 'counts' | 'scope') => !!p && (k === 'counts' ? said(p.counts) : said(p.filters) && said(p.excludes));

/** Whether each of the ten parts is said. Exclusions may be "None", but must be said. */
export function partSaid(m: Metric, part: DefinedPart, ownerIsHere: boolean): boolean {
  const c = m.calculation;
  switch (part) {
    case 'meaning': return said(m.meaning);
    case 'calculation':
      if (!c || !MEASURES.includes(c.measure)) return false;
      if (c.measure === 'ratio') return partHas(c.numerator, 'counts') && partHas(c.denominator, 'counts');
      if (c.measure === 'other') return said(c.formula);
      return !!c.aggregate && (c.aggregate !== 'percentile' || !!c.percentile) && partHas(c.part, 'counts');
    case 'scope':
      if (!c) return false;
      return c.measure === 'ratio' ? partHas(c.numerator, 'scope') && partHas(c.denominator, 'scope') : partHas(c.part, 'scope');
    case 'unit': return said(m.unit);
    case 'direction': return m.direction === 'higher' || m.direction === 'lower';
    case 'window': return !!m.timeWindow && WINDOW_KINDS.includes(m.timeWindow.kind);
    case 'source': return said(m.source) && said(m.sourceLink);
    case 'sourceOwner': return said(m.sourceOwner);
    case 'refresh': return m.refresh != null;
    case 'owner': return ownerIsHere;
  }
}

/** What a metric still needs to reach Defined, in order (empty: it is Defined). The source part says "a source" when no
    system is named either. */
export function definedMissing(m: Metric, ownerIsHere: boolean): { part: DefinedPart; words: string; why: string }[] {
  return DEFINED_PARTS.filter((d) => !partSaid(m, d.part, ownerIsHere)).map((d) => (d.part === 'source' && !said(m.source) ? { ...d, words: 'its source, with a link to the report or query' } : d));
}

/** "needs a source link", "needs a window and exclusions": a Draft's line under its name in the library. */
export function missingLine(missing: readonly { part: DefinedPart }[]): string {
  if (!missing.length) return '';
  const short: Record<DefinedPart, string> = { meaning: 'a meaning', calculation: 'a type and its parts', scope: 'filters and exclusions', unit: 'a unit', direction: 'a direction', window: 'a window', source: 'a source link', sourceOwner: 'a source owner', refresh: 'a refresh', owner: 'an owner' };
  const w = missing.map((x) => short[x.part]);
  return `needs ${w.length === 1 ? w[0] : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`}`;
}

/** The warning a goal on a Draft metric shows (sketch 7), and link_goal_metric returns: a heading and a sentence. Never
    a status: the goal keeps working. Null for a Defined or Verified metric. */
export function draftWarning(_m: Pick<Metric, 'name'>, missing: readonly { part: DefinedPart }[], ownerName: string | null): { heading: string; words: string } | null {
  if (!missing.length) return null;
  const its: Record<DefinedPart, string> = { meaning: 'meaning', calculation: 'calculation', scope: 'filters and exclusions', unit: 'unit', direction: 'direction', window: 'window', source: 'source link', sourceOwner: 'source owner', refresh: 'refresh', owner: 'owner' };
  const w = missing.map((x) => its[x.part]);
  const list = w.length === 1 ? w[0]! : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`;
  const are = w.length > 1 || / and /.test(list) ? 'aren’t' : 'isn’t';
  return { heading: 'Measured by a Draft metric', words: `Its ${list} ${are} set, so this number may not mean the same to everyone. The goal keeps working.${ownerName ? ` ${ownerName} owns the metric.` : ''}` };
}

/* ---------- the stage ---------- */

const addMonths = (iso: string, n: number) => { const d = new Date(iso); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString(); };
const days = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
export const onDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export interface Stage {
  stage: MetricStage;
  /** What it still needs to reach Defined (empty once Defined). */
  missing: { part: DefinedPart; words: string; why: string }[];
  /** Verified: when it is due again (12 months after verifying). */
  dueBy: string | null;
  /** Lapsed from Verified: by a change (the stored lapse), or by age (12 months up). */
  lapsed: { kind: 'change' | 'age'; at: string; what: string[]; why: string; by: Id | null } | null;
  /** Listed under "To verify": Defined (never verified, or lapsed), or Verified within 30 days of its year being up. */
  toVerify: boolean;
  /** The reason in words: "Verified by Amara Nwosu, 3 Nov 2026", "Still needs: …", "Source changed on 12 Nov 2026". */
  why: string;
}

/** The stage of a metric (MQ2), worked out, never stored. `now` is an ISO time; names says who someone is. */
export function stageOf(m: Metric, o: { now: string; ownerIsHere: boolean; nameOf?: (id: string) => string }): Stage {
  const nameOf = o.nameOf ?? ((id: string) => id);
  const missing = definedMissing(m, o.ownerIsHere);
  if (missing.length) return { stage: 'draft', missing, dueBy: null, lapsed: null, toVerify: false, why: `Still needs ${missing.map((x) => x.words).join(', ')}.` };
  const v = m.verification && m.verification.outcome === 'verified' ? m.verification : null;
  const gap = m.measurement === 'gap';
  if (v && !gap) {
    const dueBy = addMonths(v.at, VERIFIED_MONTHS);
    if (o.now < dueBy) {
      const soon = days(o.now, dueBy) <= DUE_SOON_DAYS;
      return { stage: 'verified', missing: [], dueBy, lapsed: null, toVerify: soon, why: `Verified by ${nameOf(v.by)}, ${onDay(v.at)}. Due again by ${onDay(dueBy)}.` };
    }
    return { stage: 'defined', missing: [], dueBy, lapsed: { kind: 'age', at: dueBy, what: [], why: '', by: null }, toVerify: true, why: `Its verification ran out on ${onDay(dueBy)}, 12 months after ${nameOf(v.by)} verified it.` };
  }
  const l = m.lapse ?? null;
  const lapsed = l ? { kind: l.kind, at: l.at, what: l.what, why: l.why, by: l.by } : null;
  const why = gap ? 'Defined. Not measured yet, so it can’t be verified.' : l ? `No longer Verified: ${l.what.join(', ')} changed on ${onDay(l.at)}${l.by ? ` (${nameOf(l.by)})` : ''}.` : 'Defined. Not verified yet.';
  return { stage: 'defined', missing: [], dueBy: null, lapsed, toVerify: !gap, why };
}

/* ---------- what lapses Verified, and what asks to confirm ---------- */

const norm = (v: string | undefined | null) => (v ?? '').trim().replace(/\s+/g, ' ');
const sameParts = (a: MetricPart | undefined, b: MetricPart | undefined, k: 'counts' | 'filters' | 'excludes') => norm(a?.[k]) === norm(b?.[k]);
const sameWindow = (a: MetricWindow | null | undefined, b: MetricWindow | null | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * What a save changes that matters to Verified (MQ2): `lapses` are the calculation parts (what is measured, how it is
 * aggregated, what each part counts, the formula), the window, the source or its link, and the direction; `confirm` are
 * reworded filters and exclusions, which ask the last verifier to confirm instead. Baselines, the meaning's wording,
 * the owner and caveats change neither. `calcChanged` is true when any of these change (whoever changes them may not
 * verify it).
 */
export function qualityChanges(before: Metric, after: Metric): { lapses: string[]; confirm: string[]; calcChanged: boolean; sourceChanged: boolean } {
  const a = before.calculation ?? null;
  const b = after.calculation ?? null;
  const lapses: string[] = [];
  const confirm: string[] = [];
  const calcHead = (c: MetricCalc | null) => JSON.stringify(c ? [c.measure, c.aggregate, c.percentile ?? null, norm(c.per), norm(c.formula)] : null);
  const counts = (c: MetricCalc | null) => JSON.stringify(c ? [norm(c.part?.counts), norm(c.numerator?.counts), norm(c.denominator?.counts)] : null);
  if (calcHead(a) !== calcHead(b) || counts(a) !== counts(b)) lapses.push('the calculation');
  if (!sameWindow(before.timeWindow, after.timeWindow)) lapses.push('the window');
  const sourceChanged = norm(before.source) !== norm(after.source) || norm(before.sourceLink) !== norm(after.sourceLink);
  if (sourceChanged) lapses.push('the source');
  if (before.direction !== after.direction) lapses.push('the direction');
  for (const k of ['filters', 'excludes'] as const) {
    const parts = [[a?.part, b?.part], [a?.numerator, b?.numerator], [a?.denominator, b?.denominator]] as const;
    if (parts.some(([x, y]) => !sameParts(x, y, k))) confirm.push(k === 'filters' ? 'the filters' : 'the exclusions');
  }
  return { lapses, confirm, calcChanged: lapses.length > 0 || confirm.length > 0, sourceChanged };
}

/* ---------- who may verify ---------- */

/** Whether someone is in the source's owner: the person named, or a member or the lead of the team named. */
export const inSourceOwner = (m: Pick<Metric, 'sourceOwnerId'>, p: Pick<Person, 'id' | 'teamId'>, teams: readonly Pick<Team, 'id' | 'leadId'>[]) =>
  !!m.sourceOwnerId && (m.sourceOwnerId === p.id || p.teamId === m.sourceOwnerId || teams.some((t) => t.id === m.sourceOwnerId && t.leadId === p.id));

/**
 * Who may verify (MQ2): anyone but the metric's owner and whoever last changed its calculation, window or source; and
 * then an admin, someone in the source's owner, or a verifier an admin named. Null when they may; otherwise why not, in
 * words that say who can instead. A Draft can't be verified (it isn't fully defined), nor a Gap (nothing to reproduce).
 */
export function whyCantVerify(m: Metric, actor: Pick<Person, 'id' | 'teamId' | 'admin'>, o: { stage: MetricStage; teams: readonly Pick<Team, 'id' | 'leadId' | 'name'>[]; sourceOwnerName: string }): string | null {
  const instead = `Ask an admin${o.sourceOwnerName ? `, someone in ${o.sourceOwnerName} (the source owner)` : ''} or a named verifier.`;
  if (m.ownerId === actor.id) return `You own this metric, so someone else must verify it. ${instead}`;
  if (m.calcChangedBy === actor.id) return `You last changed its calculation, window or source, so someone else must verify it. ${instead}`;
  if (o.stage === 'draft') return 'It isn’t fully defined yet, so there is nothing agreed to verify. Its owner finishes the definition first.';
  if (m.measurement === 'gap') return 'It isn’t measured yet, so there is no figure to reproduce.';
  if (actor.admin || inSourceOwner(m, actor, o.teams) || (m.verifiers ?? []).includes(actor.id)) return null;
  return `Only an admin, someone in the source’s owner or a verifier an admin named can verify it. ${instead}`;
}

/** The figure Faro has for a period: the slice's live baseline for that period (company, all of it), else the latest
    reading, else nothing. */
export function storedFigure(m: Metric, period: string, reading: number | null | undefined): { value: number | null; from: MetricVerification['storedFrom'] } {
  const b = liveBaselines(m).find((x) => x.teamId == null && !x.part && norm(x.period).toLowerCase() === norm(period).toLowerCase());
  if (b) return { value: b.value, from: 'baseline' };
  if (reading != null && Number.isFinite(reading)) return { value: reading, from: 'reading' };
  return { value: null, from: null };
}

/** "Your 21 min against 22 min stored (1 min lower)", "the same as stored", or "No stored figure to compare with". */
export function differenceWords(figure: number, stored: number | null, unit: string, decimals: number): string {
  const n = (v: number) => `${v.toLocaleString('en-GB', { maximumFractionDigits: Math.max(decimals, 2) })}${unit === '%' ? '%' : ` ${unit}`}`;
  if (stored == null) return `${n(figure)}. No stored figure to compare with.`;
  const d = Math.round((figure - stored) * 1e6) / 1e6;
  if (d === 0) return `Your ${n(figure)}, the same as stored.`;
  return `Your ${n(figure)} against ${n(stored)} stored (${n(Math.abs(d))} ${d < 0 ? 'lower' : 'higher'}).`;
}

/* ---------- baselines per slice ---------- */

export const sameSlice = (a: { teamId: Id | null; part?: string }, b: { teamId: Id | null; part?: string }) => (a.teamId ?? null) === (b.teamId ?? null) && norm(a.part).toLowerCase() === norm(b.part).toLowerCase();
/** The baselines in force (not replaced), one per slice. */
export const liveBaselines = (m: Pick<Metric, 'baselines'>): MetricBaseline[] => (m.baselines ?? []).filter((b) => !b.replacedAt);
/** A slice's baseline in force, if it has one. */
export const baselineFor = (m: Pick<Metric, 'baselines'>, slice: { teamId: Id | null; part?: string }) => liveBaselines(m).find((b) => sameSlice(b, slice)) ?? null;

export interface BaselineInput { teamId: Id | null; part?: string; value: number; period: string; takenOn: string; how: string; reason?: string; read?: number | null }

/** What is wrong with a baseline as typed; empty when it can be saved. All four are required: the value, the period it
    covers, the day taken and how. A figure changed from the one read, or a new figure for the same period, needs a reason. */
export function baselineProblems(b: BaselineInput, m: Metric): string[] {
  const out: string[] = [];
  if (!Number.isFinite(b.value)) out.push('Give the baseline’s value as a number.');
  if (!norm(b.period)) out.push('Say the period it covers (“Jul–Sep 2026”).');
  else if (b.period.length > QUALITY_LIMITS.period) out.push(`Keep the period to ${QUALITY_LIMITS.period} characters or fewer.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.takenOn ?? '')) out.push('Say the day it was taken (yyyy-mm-dd).');
  if (!norm(b.how)) out.push('Say how it was taken: the query, report or filter.');
  else if (b.how.length > QUALITY_LIMITS.how) out.push(`Keep how it was taken to ${QUALITY_LIMITS.how} characters or fewer.`);
  const was = baselineFor(m, b);
  const changedRead = b.read != null && Number.isFinite(b.value) && b.read !== b.value;
  const samePeriodNewFigure = !!was && norm(was.period).toLowerCase() === norm(b.period).toLowerCase() && was.value !== b.value && !was.oldSource;
  if ((changedRead || samePeriodNewFigure) && !norm(b.reason)) out.push(changedRead ? `Say why you changed the figure read (${b.read}).` : `Say why the figure for ${was!.period} changes from ${was!.value}.`);
  if ((b.reason ?? '').length > QUALITY_LIMITS.reason) out.push(`Keep the reason to ${QUALITY_LIMITS.reason} characters or fewer.`);
  return out;
}

/** The baselines once these are saved: each slice's old one moves to History, "replaced by {period}" (or the reason).
    Adding or renewing a baseline never changes the stage. */
export function withBaselines(m: Metric, input: readonly BaselineInput[], x: { actor: Id; now: string; newId: (p: string) => string }): MetricBaseline[] {
  let out = [...(m.baselines ?? [])];
  for (const b of input) {
    const reason = norm(b.reason);
    out = out.map((o) => (!o.replacedAt && sameSlice(o, b) ? { ...o, replacedAt: x.now, replacedBy: x.actor, replacedWhy: reason || `Replaced by ${norm(b.period)}` } : o));
    const how = b.read != null && b.read !== b.value && reason ? `${norm(b.how)}; ${reason}` : norm(b.how);
    out.push({ id: x.newId('base'), teamId: b.teamId ?? null, ...(norm(b.part) ? { part: norm(b.part) } : {}), value: b.value, period: norm(b.period), takenOn: b.takenOn, how, by: x.actor, at: x.now });
  }
  // The oldest History goes first once the list is full.
  while (out.length > QUALITY_LIMITS.baselines) { const i = out.findIndex((o) => !!o.replacedAt); if (i < 0) break; out.splice(i, 1); }
  return out;
}

/** After a source change, every baseline in force is flagged "taken from the old source", to retake. */
export const flagOldSource = (bs: readonly MetricBaseline[]): MetricBaseline[] => bs.map((b) => (b.replacedAt ? b : { ...b, oldSource: true }));

/** The quarter before the one `now` is in: its words ("Jul–Sep 2026") and its last day, for "Take this quarter's
    baselines". */
export function lastQuarter(now: string): { words: string; end: string; next: string } {
  const d = new Date(now);
  const q = Math.floor(d.getUTCMonth() / 3);
  const y = q === 0 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
  const pq = (q + 3) % 4;
  // Fixed three-letter months: browsers differ on en-GB's September (“Sep” or “Sept”), and stored periods must match.
  const mon = (i: number) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i % 12]!;
  const end = new Date(Date.UTC(y, pq * 3 + 3, 0, 23, 59, 59)).toISOString();
  return { words: `${mon(pq * 3)}–${mon(pq * 3 + 2)} ${y}`, end, next: `${mon(q * 3)}–${mon(q * 3 + 2)} ${d.getUTCFullYear()}` };
}

/* ---------- a goal's rhythm follows its metric's refresh ---------- */

/** The core's (domain/goalRhythm): the library only says which its metric's refresh gives. */
export type { GoalRhythm } from '../../domain/goalRhythm';
import type { GoalRhythm } from '../../domain/goalRhythm';
export { rhythmFor } from './qualityWords';
export const RHYTHM_WORDS: Record<GoalRhythm, string> = { monthly: 'Check-ins monthly, after each refresh', quarterly: 'Check-ins quarterly, after each refresh' };

/* ---------- "To sort out" ---------- */

export type SortOutKind = 'draft' | 'gap' | 'oldSource' | 'couldntReproduce' | 'newOwner' | 'confirmReword' | 'lapsed';
export interface SortOut { kind: SortOutKind; words: string; who: Id | null }

/**
 * Every loose end on a metric (MQ2 sketch 11), each with the one thing to do and who should do it: a Draft's missing
 * part, a Gap, baselines from an old source, an unanswered "Couldn't reproduce", a new owner to confirm, a rewording the
 * last verifier should confirm. Lapsed metrics are on "To verify", not here.
 */
export function sortOutOf(m: Metric, o: { stage: Stage; nameOf: (id: string) => string; leadOf?: (id: string) => Id | null }): SortOut[] {
  const out: SortOut[] = [];
  if (m.handover) out.push({ kind: 'newOwner', words: `New owner, please confirm: ${o.nameOf(m.handover.from)} left on ${onDay(m.handover.at)}; passed to ${o.nameOf(m.ownerId)}`, who: m.ownerId });
  const old = liveBaselines(m).filter((b) => b.oldSource).length;
  if (old) out.push({ kind: 'oldSource', words: `Retake ${old} ${old === 1 ? 'baseline' : 'baselines'} from the new source`, who: m.ownerId });
  const open = (m.verifyAttempts ?? []).filter((a) => !a.answered).slice(-1)[0];
  if (open) out.push({ kind: 'couldntReproduce', words: `Couldn’t reproduce: answer ${o.nameOf(open.by)}’s note`, who: m.ownerId });
  if (m.toConfirm) out.push({ kind: 'confirmReword', words: `Confirm the reworded ${m.toConfirm.what.join(' and ')}`, who: m.toConfirm.verifier });
  if (m.measurement === 'gap') out.push({ kind: 'gap', words: `Not measured yet${o.stage.missing.length ? `; ${missingLine(o.stage.missing).replace(/^needs /, 'set ')}` : ''}`, who: m.ownerId });
  else if (o.stage.stage === 'draft') out.push({ kind: 'draft', words: `Add ${o.stage.missing.map((x) => x.words).join(', ')}`, who: m.ownerId });
  return out;
}

/* ---------- adding a metric: similar ones first ---------- */

const words = (s: string) => new Set(norm(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
const STOP = new Set(['the', 'and', 'for', 'per', 'with', 'from', 'over', 'last', 'that', 'which', 'are', 'not', 'its', 'all', 'each', 'every', 'days', 'day']);
const overlap = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let n = 0; for (const w of a) if (b.has(w)) n++; return n / Math.min(a.size, b.size); };

/**
 * Metrics like one being added (MQ2 sketch 12): matched on name, source and meaning, best first. A metric is similar
 * when the names share most of their words, or the source is the same and the meanings share most of theirs. The same
 * check runs on the form, the import and save_metric.
 */
export function similarMetrics(m: Pick<Metric, 'id' | 'name' | 'source' | 'meaning'>, all: readonly Metric[]): Metric[] {
  const n = words(m.name);
  const mean = words(m.meaning);
  const scored = all.filter((x) => x.id !== m.id && !x.removedAt && !x.retiredAt).map((x) => {
    const byName = overlap(n, words(x.name));
    const sameSource = !!norm(m.source) && norm(m.source).toLowerCase() === norm(x.source).toLowerCase();
    const byMeaning = overlap(mean, words(x.meaning));
    const score = byName >= 0.6 ? 2 + byName : sameSource && byMeaning >= 0.5 ? 1 + byMeaning : 0;
    return { x, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.x.name.localeCompare(b.x.name)).map((s) => s.x);
}
