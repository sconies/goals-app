/* MQ2's AI tools and what the library's tools add for metric quality (docs/design/mq2 sketch 13): every journey works
   from an AI tool through the same rules as the screens (rulesQuality.ts, rulesVerify.ts). The two new tools are
   save_baselines and verify_metric; list_metrics, get_metric and save_metric take and return the quality fields
   through `qualityData`, `qualityInput` and `QUALITY_FIELDS`. With Metrics switched off, the server refuses them all
   with the module-off sentence, as it does every tool of the module. */
import './qualityHooks';
import { NotAllowed, type ActionContext } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import type { McpContext, ToolDef, ToolResult } from '../../mcp/tools';
import { VIA_MCP } from '../../domain/via';
import * as M from './rules';
import * as Q from './rulesQuality';
import * as V from './rulesVerify';
import { toolSources } from './readingTool';
import type { Metric } from './types';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const ax = (ctx: McpContext): ActionContext => ({ snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, actor: ctx.actor, now: ctx.now, newId: ctx.newId, ...(ctx.allGoals ? { allGoals: ctx.allGoals } : {}), ...(ctx.full ? { full: ctx.full } : {}) });
const save = (ctx: McpContext, c: Commit) => ctx.save({ ...c, changes: c.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA_MCP] })) });
async function ruled(run: () => Promise<ToolResult>): Promise<ToolResult> {
  try { return await run(); } catch (e) { if (e instanceof NotAllowed) return { isError: true, text: e.message }; throw e; }
}
const metricOf = (ctx: McpContext, ref: unknown) => {
  const m = M.findMetric(ctx.snapshot, String(ref ?? ''));
  if (!m) throw new NotAllowed(`There’s no metric called or with the ID ${String(ref)}. Use list_metrics.`);
  return m;
};
const nameOf = (ctx: McpContext, id: string | null | undefined) => ctx.snapshot.people.find((p) => p.id === id)?.name ?? (id ? 'someone who has left' : null);
const sliceName = (ctx: McpContext, b: { teamId: string | null; part?: string }) => `${M.sliceName(ctx.snapshot, b.teamId)}${b.part ? ` · ${b.part}` : ''}`;
/** A team by ID or name, or the whole company (left out, empty, null or "company"). */
const teamOf = (ctx: McpContext, ref: unknown): string | null => {
  if (ref == null || ref === '' || /^(the )?(whole )?company$/i.test(String(ref).trim())) return null;
  const t = String(ref).trim().toLowerCase();
  const team = ctx.snapshot.teams.find((x) => x.id === ref || x.name.toLowerCase() === t);
  if (!team) throw new NotAllowed(`There’s no team called ${String(ref)}. Leave team out for the whole company.`);
  return team.id;
};
/** A team or a person here, by ID or name (a source's owner). */
const ownerRef = (ctx: McpContext, ref: unknown): string | null => {
  if (ref == null || ref === '') return null;
  const t = String(ref).trim().toLowerCase();
  const hit = ctx.snapshot.teams.find((x) => x.id === ref || x.name.toLowerCase() === t)?.id ?? ctx.snapshot.people.find((x) => x.id === ref || x.name.toLowerCase() === t || (x.email ?? '').toLowerCase() === t)?.id;
  if (!hit) throw new NotAllowed(`There’s no team or person called ${String(ref)} here. Leave source_owner_in_faro out, and say the owner in source_owner as text.`);
  return hit;
};

/** A metric's stage, why, and everything MQ2 adds, as get_metric and list_metrics return it. */
export function qualityData(ctx: McpContext, m: Metric) {
  const st = V.stageNow(ax(ctx), m);
  const n = (id: string | null | undefined) => nameOf(ctx, id);
  const base = (b: NonNullable<Metric['baselines']>[number]) => ({ id: b.id, slice: sliceName(ctx, b), teamId: b.teamId, part: b.part ?? '', value: b.value, period: b.period, takenOn: b.takenOn, how: b.how, by: n(b.by), oldSource: !!b.oldSource, ...(b.replacedAt ? { replacedAt: b.replacedAt, replacedBy: n(b.replacedBy), replacedWhy: b.replacedWhy ?? '' } : {}) });
  const ver = (v: NonNullable<Metric['verification']>) => ({ outcome: v.outcome, by: n(v.by), at: v.at, period: v.period, figure: v.figure, stored: v.stored, storedFrom: v.storedFrom, note: v.note, difference: Q.differenceWords(v.figure, v.stored, m.unit, m.decimals), ...(v.answered ? { answered: { by: n(v.answered.by), at: v.answered.at, note: v.answered.note } } : {}) });
  return {
    stage: st.stage, stageLabel: Q.STAGE_LABEL[st.stage], stageWhy: st.why,
    missing: st.missing.map((x) => ({ part: x.part, words: x.words, why: x.why })), missingLine: Q.missingLine(st.missing),
    toVerify: st.toVerify, dueBy: st.dueBy,
    lapsed: st.lapsed ? { kind: st.lapsed.kind, at: st.lapsed.at, what: st.lapsed.what, why: st.lapsed.why, by: n(st.lapsed.by) } : null,
    calculation: m.calculation ?? null, calculationWords: Q.calcWords(m.calculation),
    window: m.timeWindow ?? null, windowWords: Q.windowWords(m.timeWindow), refreshWords: Q.refreshWords(m), refreshNote: m.refreshNote ?? '',
    sourceLink: m.sourceLink ?? '', sourceQuery: m.sourceQuery ?? '', sourceOwnerInFaro: m.sourceOwnerId ? V.sourceOwnerName(ctx.snapshot, m) : null,
    baselines: Q.liveBaselines(m).map(base), baselineHistory: (m.baselines ?? []).filter((b) => !!b.replacedAt).map(base),
    verification: m.verification ? ver(m.verification) : null, failedAttempts: (m.verifyAttempts ?? []).map(ver),
    verifiers: (m.verifiers ?? []).map((v) => n(v)), lastCalculationChange: m.calcChangedBy ? { by: n(m.calcChangedBy), at: m.calcChangedAt ?? null } : null,
    handover: m.handover ? { from: n(m.handover.from), at: m.handover.at, why: m.handover.why } : null,
    toConfirm: m.toConfirm ? { verifier: n(m.toConfirm.verifier), by: n(m.toConfirm.by), at: m.toConfirm.at, what: m.toConfirm.what } : null,
    sortOut: Q.sortOutOf(m, { stage: st, nameOf: (id) => n(id) ?? id }).map((s) => ({ kind: s.kind, words: s.words, who: n(s.who) })),
  };
}

/** The lines get_metric adds for MQ2. */
export function qualityLines(d: ReturnType<typeof qualityData>): string[] {
  return [
    `Stage: ${d.stageLabel} · ${d.stageWhy}`,
    `Calculation: ${d.calculationWords} · window: ${d.windowWords} · ${d.refreshWords}`,
    ...(d.sourceLink ? [`Source link: ${d.sourceLink}`] : []),
    ...(d.baselines.length ? [`Baselines: ${d.baselines.map((b) => `${b.slice} ${b.value} for ${b.period} (taken ${b.takenOn}: ${b.how})${b.oldSource ? ', from the old source: retake' : ''}`).join('; ')}`] : ['Baselines: none yet']),
    ...(d.verification ? [`Verification: ${d.verification.by}, ${d.verification.at.slice(0, 10)}, for ${d.verification.period}. ${d.verification.difference} Note: ${d.verification.note}`] : []),
    ...d.failedAttempts.filter((a) => !a.answered).map((a) => `Couldn’t reproduce: ${a.by}, ${a.at.slice(0, 10)}, for ${a.period}. ${a.difference} Note: ${a.note}`),
    ...(d.sortOut.length ? [`To sort out (quality): ${d.sortOut.map((s) => `${s.words}${s.who ? ` (${s.who})` : ''}`).join('; ')}`] : []),
  ];
}

const PART = { type: 'object', additionalProperties: false, properties: { name: str('What this part is called (“Failed changes”).'), counts: str('What it counts.'), filters: str('Its filters (what is in).'), excludes: str('What it leaves out (“None” if nothing).') } };
/** The structured fields save_metric takes for MQ2. */
export const QUALITY_FIELDS = {
  calculation: { type: 'object', additionalProperties: false, description: 'The calculation, two fields plus its parts. measure: count, sum, value, duration, ratio or other. aggregate: total, mean, median, pXX (a percentile, e.g. p90) or latest (not for a ratio). A ratio gives numerator and denominator; other gives formula (in words); the rest give counts, filters and excludes. Each part’s filters and exclusions must be said for Defined (“None” is an answer).', properties: { measure: str('What is measured.', { enum: [...Q.MEASURES] }), aggregate: str('How it is aggregated: total, mean, median, p50…p99, latest.'), per: str('For a mean of a count: per what (“day”).'), counts: str('What it counts.'), filters: str('Its filters.'), excludes: str('What it leaves out.'), numerator: PART, denominator: PART, formula: str('For other or composite: the formula in words.') } },
  window: str('The window: “point in time”, “rolling N days”, “per week”, “per month”, “per quarter” or “cumulative since yyyy-mm-dd”. Empty for not said.'),
  source_link: str('A link (https://…) to the exact report or query. Without one the metric stays Draft.'),
  source_query: str('The query text, optional.'),
  source_owner_in_faro: str('The team or person here who owns the source, by ID or name: their people may verify it. Empty for none.'),
  refresh_note: str('When in the period it refreshes (“Mondays”).'),
  verifiers: { type: 'array', items: { type: 'string' }, description: 'Admins only: the people (ID, email or name) who may verify it besides admins and the source’s owner.' },
  confirm_owner: { type: 'boolean', description: 'You are the new owner of a metric passed to you when its owner left: confirm you own it.' },
  answer_attempt: str('Its owner’s answer to the latest “Couldn’t reproduce” (what changed, or why the figures differ).'),
};
const people = (ctx: McpContext, v: unknown) => (Array.isArray(v) ? v : []).map((r) => {
  const t = String(r ?? '').trim().toLowerCase();
  const p = ctx.snapshot.people.find((x) => x.id === r || x.name.toLowerCase() === t || (x.email ?? '').toLowerCase() === t);
  if (!p) throw new NotAllowed(`There’s no one called ${String(r)} in this workspace. Use list_people.`);
  return p.id;
});

/** save_metric's MQ2 fields as a MetricInput. Verifiers are an admin's to name. */
export function qualityInput(ctx: McpContext, a: Record<string, unknown>): Partial<M.MetricInput> {
  if (a.verifiers !== undefined && !ctx.actor.admin) throw new NotAllowed('Only an admin can name a metric’s verifiers.');
  return {
    ...(a.calculation !== undefined ? { calculation: Q.calcFrom(a.calculation) } : {}),
    ...(a.window !== undefined ? { timeWindow: Q.windowFrom(a.window) } : {}),
    ...(a.source_link !== undefined ? { sourceLink: String(a.source_link ?? '') } : {}),
    ...(a.source_query !== undefined ? { sourceQuery: String(a.source_query ?? '') } : {}),
    ...(a.source_owner_in_faro !== undefined ? { sourceOwnerId: ownerRef(ctx, a.source_owner_in_faro) } : {}),
    ...(a.refresh_note !== undefined ? { refreshNote: String(a.refresh_note ?? '') } : {}),
    ...(a.verifiers !== undefined ? { verifiers: people(ctx, a.verifiers) } : {}),
  };
}

/** save_metric's two MQ2 acts that aren't a change of definition: confirming a handover, answering a failed attempt.
    Null when neither was asked. */
export async function qualityActs(ctx: McpContext, a: Record<string, unknown>): Promise<ToolResult | null> {
  if (a.confirm_owner !== true && a.answer_attempt === undefined) return null;
  const m = metricOf(ctx, a.id);
  const out: string[] = [];
  if (a.confirm_owner === true) { const c = V.confirmOwner(ax(ctx), m.id); await save(ctx, c); out.push(c.changes[0]!.summary); }
  if (a.answer_attempt !== undefined) { const c = V.answerAttempt(ax(ctx), m.id, String(a.answer_attempt ?? '')); await save(ctx, c); out.push(c.changes[0]!.summary); }
  return { data: { saved: true, id: m.id }, text: `${out.join('. ')} (as ${ctx.actor.name}).` };
}

/** The stage before and after a save, in words, for save_metric's result. */
export function stageMove(ctx: McpContext, before: Metric | undefined, after: Metric): { stageBefore: string | null; stageAfter: string; missing: string[]; line: string } {
  const b = before ? V.stageNow(ax(ctx), before) : null;
  const a = V.stageNow(ax(ctx), after);
  const lab = (s: Q.MetricStage) => Q.STAGE_LABEL[s];
  const line = b && b.stage !== a.stage ? `${lab(b.stage)} → ${lab(a.stage)}.` : `${lab(a.stage)}.`;
  return { stageBefore: b ? b.stage : null, stageAfter: a.stage, missing: a.missing.map((x) => x.words), line: `${line}${a.missing.length ? ` To reach Defined, still needed: ${a.missing.map((x) => x.words).join('; ')}.` : ''}` };
}

/** The latest reading of a metric for the whole company, from its source, if one reads it (for verify_metric's comparison). */
async function latestReading(ctx: McpContext, m: Metric): Promise<number | null> {
  const src = toolSources(ctx).find((s) => s.name === m.source && s.reads(m, { teamId: null, part: '' }));
  if (!src) return null;
  try { return (await src.read(m, new Date(ctx.now), { teamId: null, part: '' }))?.value ?? null; } catch { return null; }
}

const tools: ToolDef[] = [
  {
    name: 'save_baselines',
    title: 'Set a metric’s baselines',
    description: 'Set one or many baselines of a metric (its owner or an admin), each for a slice: the whole company or a team, and optionally one part. Each needs its value, the period it covers (“Jul–Sep 2026”), the day taken and how it was taken; the old one for that slice moves to History. A new figure for a period already stored, or a figure changed from one read (read), needs a reason. Baselines never change the metric’s stage. from_readings: true fills, for every slice its goals use and the company, last quarter’s figure from the source for the person to confirm, and saves nothing. The result lists any baselines taken from an old source, to retake.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['metric'], properties: {
      metric: str('The metric’s ID or name.'),
      from_readings: { type: 'boolean', description: 'Fill last quarter’s baselines from the source for confirming; nothing is saved.' },
      baselines: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['value', 'period', 'taken_on', 'how'], properties: {
        team: str('The team (ID or name); left out for the whole company.'), part: str('One part of the number (“tier-1 services”); left out for all of it.'),
        value: { type: 'number' }, period: str('The period it covers.'), taken_on: str('The day it was taken, yyyy-mm-dd.'), how: str('How it was taken: the query, report or filter.'),
        read: { type: 'number', description: 'The figure the source gave, when you changed it (from_readings).' }, reason: str('Why the figure changed (required for a changed figure).'),
      } } },
    } },
    annotations: WRITE,
    async run(a, ctx) {
      return ruled(async () => {
        const m = metricOf(ctx, a.metric);
        if (a.from_readings === true) {
          const q = Q.lastQuarter(ctx.now);
          const slices = [{ teamId: null as string | null, part: '' }, ...M.linksOf(ctx.snapshot).filter((l) => l.metricId === m.id && !l.removedAt).map((l) => ({ teamId: l.teamId, part: l.part ?? '' }))]
            .filter((s, i, all) => all.findIndex((o) => Q.sameSlice(o, s)) === i);
          const filled = await Promise.all(slices.map(async (s) => {
            const src = toolSources(ctx).find((x) => x.name === m.source && x.reads(m, s));
            let value: number | null = null;
            try { value = src ? (await src.read(m, new Date(q.end), s))?.value ?? null : null; } catch { value = null; }
            return { slice: sliceName(ctx, s), team: s.teamId, part: s.part, value, period: q.words, taken_on: ctx.now.slice(0, 10), how: src ? `Read from ${m.source}, ${ctx.now.slice(0, 10)}` : '' };
          }));
          const gap = m.measurement === 'gap';
          const rows = gap ? [] : filled.filter((f) => f.value != null);
          return { data: { saved: false, period: q.words, baselines: rows, skipped: filled.filter((f) => gap || f.value == null).map((f) => ({ slice: f.slice, why: gap ? 'Gap: not measured yet' : 'No reading' })) }, text: `Nothing saved. ${rows.length ? `From ${m.source} for ${q.words}: ${rows.map((r) => `${r.slice} ${r.value}`).join('; ')}. Ask the person to confirm, then call again with baselines (give read and a reason for any figure they change).` : `No reading for ${q.words}${gap ? ': the metric isn’t measured yet' : ''}.`}` };
        }
        const raw = Array.isArray(a.baselines) ? (a.baselines as Record<string, unknown>[]) : [];
        const entries: Q.BaselineInput[] = raw.map((b) => ({
          teamId: teamOf(ctx, b.team), part: String(b.part ?? ''), value: Number(b.value), period: String(b.period ?? ''), takenOn: String(b.taken_on ?? ''), how: String(b.how ?? ''),
          ...(typeof b.read === 'number' ? { read: b.read } : {}), ...(b.reason !== undefined ? { reason: String(b.reason) } : {}),
        }));
        const r = V.saveBaselines(ax(ctx), m.id, entries);
        await save(ctx, r.commit);
        const old = Q.liveBaselines(r.metric).filter((b) => b.oldSource).map((b) => sliceName(ctx, b));
        return { data: { saved: true, baselines: Q.liveBaselines(r.metric).map((b) => ({ slice: sliceName(ctx, b), value: b.value, period: b.period })), oldSource: old, stage: V.stageNow(ax(ctx), r.metric).stage }, text: `${r.said} (as ${ctx.actor.name}). The stage doesn’t change.${old.length ? ` Still taken from the old source, to retake: ${old.join(', ')}.` : ''}` };
      });
    },
  },
  {
    name: 'verify_metric',
    title: 'Verify a metric',
    description: 'Verify a metric (anyone but its owner and whoever last changed its calculation, window or source; and then an admin, someone in the source’s owner, or a verifier an admin named). Open its source link first: opened_link must be true. Give the period, the figure you got from the link, a note, and the outcome: verified (Verified for 12 months) or couldnt_reproduce (the attempt is kept, the stage doesn’t change, and the owner sees it under To sort out). The result compares your figure with the one Faro has for that period (a baseline, else the latest reading), with no fixed tolerance. confirm_reword: true instead confirms, as its last verifier, that a reworded filter or exclusion still means the same.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['metric'], properties: {
      metric: str('The metric’s ID or name.'),
      period: str('The period the figure covers (“Aug–Oct 2026”).'), figure: { type: 'number', description: 'The figure you got from the source link.' },
      note: str('What you checked it against, or what differs.'), opened_link: { type: 'boolean', description: 'You opened the source link and it shows this metric, for this window.' },
      outcome: str('verified, or couldnt_reproduce.', { enum: ['verified', 'couldnt_reproduce'] }),
      confirm_reword: { type: 'boolean', description: 'Confirm a reworded filter or exclusion (as its last verifier); nothing else is read.' },
    } },
    annotations: WRITE,
    async run(a, ctx) {
      return ruled(async () => {
        const m = metricOf(ctx, a.metric);
        if (a.confirm_reword === true) { const c = V.confirmReword(ax(ctx), m.id); await save(ctx, c); return { data: { saved: true, stage: 'verified' }, text: `${c.changes[0]!.summary} (as ${ctx.actor.name}).` }; }
        const reading = await latestReading(ctx, m);
        const r = V.verifyMetric(ax(ctx), m.id, { period: String(a.period ?? ''), figure: typeof a.figure === 'number' ? a.figure : NaN, note: String(a.note ?? ''), openedLink: a.opened_link === true, outcome: a.outcome === 'couldnt_reproduce' ? 'couldnt_reproduce' : a.outcome === 'verified' ? 'verified' : (String(a.outcome) as 'verified'), reading });
        await save(ctx, r.commit);
        const v = a.outcome === 'verified' ? r.metric.verification! : r.metric.verifyAttempts!.at(-1)!;
        return { data: { saved: true, outcome: v.outcome, stage: V.stageNow(ax(ctx), r.metric).stage, figure: v.figure, stored: v.stored, storedFrom: v.storedFrom, difference: Q.differenceWords(v.figure, v.stored, m.unit, m.decimals) }, text: r.said };
      });
    },
  },
];

export default tools;
