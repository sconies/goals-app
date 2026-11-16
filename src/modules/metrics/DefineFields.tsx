/* Defining a metric on its form (MQ2 sketch 3): the calculation as two fields (what is measured, how it is aggregated)
   with its parts, a structured window, the source link, and the box that counts what is still needed to reach Defined.
   The rules are rulesQuality.ts's (definedMissing, calcWords, windowWords); this file lays them out. Loaded with the
   metric form, never in the first download. */
import type { ReactNode } from 'react';
import { AGGREGATE_LABEL, AGGREGATES, DEFINED_PARTS, definedMissing, MEASURE_LABEL, MEASURES, PERIODS, QUALITY_LIMITS } from './rulesQuality';
import type { Metric } from './rules';
import type { MetricAggregate, MetricCalc, MetricMeasure, MetricPart, MetricWindow } from './types';

const MEASURE_HINT: Record<MetricMeasure, string> = { count: 'How many things', sum: 'Adds an amount up', value: 'A score or reading', duration: 'Time between two events', ratio: 'One over another', other: 'A formula in words' };
const WINDOW_LABEL: Record<MetricWindow['kind'], string> = { point: 'Point in time', rolling: 'Rolling', period: 'Per period', cumulative: 'Cumulative since a date' };
const empty: MetricPart = { counts: '', filters: '', excludes: '' };
/** A mean's "per": each event, or per day, week or month (and one stored another way, kept as it is). */
const PER_CHOICES = (per?: string): [string, string][] => [['', 'Each event'], ...[...new Set(['day', 'week', 'month', ...(per ? [per] : [])])].map((p): [string, string] => [p, `Per ${p}`])];

/** The calculation's two fields and its parts. */
export function CalcFields({ calc, onChange }: { calc: MetricCalc | null | undefined; onChange: (c: MetricCalc | null) => void }) {
  const c = calc ?? null;
  const pick = (measure: MetricMeasure) => {
    if (c?.measure === measure) return;
    const base = { measure, aggregate: measure === 'ratio' || measure === 'other' ? null : c?.aggregate ?? null };
    if (measure === 'ratio') onChange({ ...base, numerator: c?.numerator ?? (c?.part ? { ...c.part } : { ...empty }), denominator: c?.denominator ?? { ...empty } });
    else if (measure === 'other') onChange({ ...base, formula: c?.formula ?? '' });
    else onChange({ ...base, ...(c?.percentile ? { percentile: c.percentile } : {}), part: c?.part ?? (c?.numerator ? { ...c.numerator } : { ...empty }) });
  };
  const set = (patch: Partial<MetricCalc>) => c && onChange({ ...c, ...patch });
  // A new aggregate keeps nothing of the old one's (#574 review): a percentile only for Percentile, "per" only for Mean.
  const aggregateTo = (k: MetricAggregate) => {
    if (!c) return;
    const { percentile: _p, per: _per, ...rest } = c;
    onChange({ ...rest, aggregate: k, ...(k === 'percentile' ? { percentile: c.percentile ?? 90 } : {}), ...(k === 'mean' && c.per ? { per: c.per } : {}) });
  };
  return (
    <div className="stack metric-define" style={{ gap: 'var(--s3)' }} id="metric-calculation">
      <div className="field"><span className="field-label" id="metric-measure-l">What is measured</span>
        <div className="metric-measures" role="group" aria-labelledby="metric-measure-l">
          {MEASURES.map((k) => (
            <button key={k} type="button" className="metric-measure" aria-pressed={c?.measure === k} onClick={() => pick(k)}>
              <span className="metric-measure-word">{MEASURE_LABEL[k]}</span><span className="hint">{MEASURE_HINT[k]}</span>
            </button>
          ))}
        </div>
      </div>
      {c && c.measure !== 'ratio' && c.measure !== 'other' && (
        <div className="field"><span className="field-label" id="metric-agg-l">How it is aggregated</span>
          <div className="seg metric-seg" role="group" aria-labelledby="metric-agg-l">
            {AGGREGATES.map((k) => <button key={k} type="button" aria-pressed={c.aggregate === k} onClick={() => aggregateTo(k as MetricAggregate)}>{k === 'percentile' ? 'Percentile (pXX)' : cap(AGGREGATE_LABEL[k])}</button>)}
          </div>
          {c.aggregate === 'mean' && (
            <div className="field metric-per"><span className="field-label" id="metric-per-l">Per</span>
              <div className="seg metric-seg" role="group" aria-labelledby="metric-per-l">
                {PER_CHOICES(c.per).map(([v, label]) => <button key={v} type="button" aria-pressed={(c.per ?? '') === v} onClick={() => onChange(v ? { ...c, per: v } : (({ per: _x, ...r }) => r)(c))}>{label}</button>)}
              </div>
            </div>
          )}
          {c.aggregate === 'percentile' && (
            <label className="field metric-pct"><span className="field-label">Percentile</span>
              <input className="input" type="number" min={1} max={99} value={c.percentile ?? ''} onChange={(e) => set({ percentile: Number(e.target.value) || undefined })} />
            </label>
          )}
        </div>
      )}
      {c?.measure === 'ratio' && <p className="hint small">For a ratio: the numerator’s total over the denominator’s total, across the window.</p>}
      {c?.measure === 'ratio' && (
        <div className="metric-define-parts">
          <PartFields title="Numerator" p={c.numerator ?? empty} onChange={(p) => set({ numerator: p })} named />
          <PartFields title="Denominator" p={c.denominator ?? empty} onChange={(p) => set({ denominator: p })} named />
        </div>
      )}
      {c?.measure === 'other' && (
        <label className="field"><span className="field-label">The formula, in words</span>
          <textarea className="input" rows={2} maxLength={QUALITY_LIMITS.formula} value={c.formula ?? ''} onChange={(e) => set({ formula: e.target.value })} placeholder="Promoters minus detractors, as a share of everyone who answered" />
        </label>
      )}
      {c && c.measure !== 'ratio' && c.measure !== 'other' && <PartFields p={c.part ?? empty} onChange={(p) => set({ part: p })} />}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function PartFields({ title, p, onChange, named }: { title?: string; p: MetricPart; onChange: (p: MetricPart) => void; named?: boolean }) {
  const row = (k: 'counts' | 'filters' | 'excludes', label: string, hint: string) => (
    <label className="field"><span className="field-label">{label}</span>
      <input className="input" maxLength={QUALITY_LIMITS.part} value={p[k]} placeholder={hint} onChange={(e) => onChange({ ...p, [k]: e.target.value })} aria-label={title ? `${title}: ${label}` : label} />
    </label>
  );
  return (
    <fieldset className="metric-part stack" style={{ gap: 'var(--s2)' }}>
      {title && <legend className="label">{title}</legend>}
      {named && <label className="field"><span className="field-label">Called</span><input className="input" maxLength={QUALITY_LIMITS.part} value={p.name ?? ''} placeholder="A short name" onChange={(e) => onChange({ ...p, name: e.target.value })} aria-label={`${title}: called`} /></label>}
      {row('counts', 'Counts', 'What is counted')}
      {row('filters', 'Filters', 'What is in: “Branch is main; CI runs only”')}
      {row('excludes', 'Leaves out', 'What is left out, or “None”')}
    </fieldset>
  );
}

/** The window: a point in time, rolling N days, per period, or cumulative since a date. No free text. */
export function WindowField({ w, onChange }: { w: MetricWindow | null | undefined; onChange: (w: MetricWindow | null) => void }) {
  const kind = w?.kind;
  const to = (k: MetricWindow['kind']): MetricWindow => (k === 'point' ? { kind: 'point' } : k === 'rolling' ? { kind: 'rolling', days: w?.kind === 'rolling' ? w.days : 28 } : k === 'period' ? { kind: 'period', period: w?.kind === 'period' ? w.period : 'month' } : { kind: 'cumulative', since: w?.kind === 'cumulative' ? w.since : '' });
  return (
    <div className="field" id="metric-window"><span className="field-label" id="metric-window-l">Window</span>
      <div className="seg metric-seg" role="group" aria-labelledby="metric-window-l">
        {(['point', 'rolling', 'period', 'cumulative'] as const).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => onChange(kind === k ? null : to(k))}>{WINDOW_LABEL[k]}</button>)}
      </div>
      {w?.kind === 'rolling' && <label className="field metric-days"><span className="field-label">Days</span><input className="input" type="number" min={1} max={3660} value={w.days || ''} onChange={(e) => onChange({ kind: 'rolling', days: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} /></label>}
      {w?.kind === 'period' && (
        <label className="field metric-days"><span className="field-label">Each</span>
          <select className="input" value={w.period} onChange={(e) => onChange({ kind: 'period', period: e.target.value as 'week' | 'month' | 'quarter' })}>{PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        </label>
      )}
      {w?.kind === 'cumulative' && <label className="field metric-days"><span className="field-label">Since</span><input className="input" type="date" value={w.since} onChange={(e) => onChange({ kind: 'cumulative', since: e.target.value })} /></label>}
    </div>
  );
}

/** "To reach Defined, still needed: n of 10", each with why it matters, then what is done. Saving is always allowed. */
export function StillNeeded({ metric, ownerIsHere, children }: { metric: Metric; ownerIsHere: boolean; children?: ReactNode }) {
  const missing = definedMissing(metric, ownerIsHere);
  const done = DEFINED_PARTS.filter((d) => !missing.some((x) => x.part === d.part));
  const short: Record<string, string> = { meaning: 'meaning', calculation: 'type and parts', scope: 'inclusions and exclusions', unit: 'unit', direction: 'direction', window: 'window', source: 'source link', sourceOwner: 'source owner', refresh: 'refresh', owner: 'metric owner' };
  return (
    <section className="metric-box metric-still-box stack" aria-labelledby="metric-still-h" data-part="Still needed">
      <h2 className="metric-box-head" id="metric-still-h">{missing.length ? `To reach Defined, still needed: ${missing.length} of ${DEFINED_PARTS.length}` : `All ${DEFINED_PARTS.length} parts are said: it is Defined`}</h2>
      {missing.length > 0 && <ul className="small">{missing.map((x) => <li key={x.part}>{cap(x.words)} ({x.why})</li>)}</ul>}
      {done.length > 0 && missing.length > 0 && <p className="small hint">Done: {done.map((d) => short[d.part]).join(', ')}.</p>}
      {children}
    </section>
  );
}
