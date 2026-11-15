/* Installs MQ2's rules into the library's save (rules.ts `setQualityHooks`), so rulesQuality.ts stays out of the first
   download. Imported, for its effect, by every door that saves a metric. */
import type { ActionContext } from '../../domain/actions';
import { setQualityHooks, standsVerified, type Metric, type MetricInput } from './rules';
import { calcWords, flagOldSource, qualityChanges, qualityProblems, windowWords } from './rulesQuality';
import type { MetricCalc } from './types';

/** A calculation in full, for the change log: its two fields and each part's counts, filters and exclusions. */
export const calcText = (c: MetricCalc): string => {
  const part = (label: string, p?: { counts: string; filters: string; excludes: string }) => (p ? `${label}: counts ${p.counts || '—'}; filters ${p.filters || '—'}; leaves out ${p.excludes || '—'}` : '');
  return [calcWords(c), part('Counts', c.part), part('Numerator', c.numerator), part('Denominator', c.denominator), c.formula ? `Formula: ${c.formula}` : ''].filter(Boolean).join('. ');
};

const clean = (v: string | undefined | null) => (v ?? '').trim().replace(/[ \t]+/g, ' ');

/**
 * What a save does to Verified (rulesQuality.ts qualityChanges): whoever changes the calculation, window or source may
 * not verify it; a lapsing change takes Verified back to Defined, with the reason kept; a reworded filter or exclusion
 * asks the last verifier to confirm; a new source flags the baselines taken from the old one.
 */
function effects(input: MetricInput & { reason?: string }, before: Metric | null, q: Partial<Metric>, x: Pick<ActionContext, 'actor' | 'now'>): void {
  if (!before) {
    if (q.calculation || q.timeWindow || q.sourceLink) { q.calcChangedBy = x.actor.id; q.calcChangedAt = x.now; }
    return;
  }
  const after = { ...before, ...q, direction: (input.direction ?? before.direction) as Metric['direction'], source: clean(input.source !== undefined ? input.source : before.source) } as Metric;
  const ch = qualityChanges(before, after);
  if (ch.calcChanged) { q.calcChangedBy = x.actor.id; q.calcChangedAt = x.now; }
  const v = before.verification;
  if (v && ch.lapses.length && standsVerified(before, x.now)) {
    delete q.verification;
    delete q.toConfirm;
    q.lapse = { at: x.now, by: x.actor.id, kind: 'change', what: ch.lapses, why: (input.reason ?? '').trim(), was: { by: v.by, at: v.at } };
  } else if (v && ch.confirm.length && standsVerified(before, x.now)) {
    q.toConfirm = { verifier: v.by, by: x.actor.id, at: x.now, what: ch.confirm };
  }
  if (ch.sourceChanged && q.baselines?.length) q.baselines = flagOldSource(q.baselines);
}

setQualityHooks({ effects, problems: qualityProblems, words: (m) => ({ calculation: m.calculation ? calcText(m.calculation) : '—', window: windowWords(m.timeWindow) }) });

export const QUALITY_READY = true;
