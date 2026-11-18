/* Baselines on screen (MQ2 sketches 4 and 9): adding one for a slice, taking this quarter's for all of someone's metrics
   from their sources' readings, and the line on Home in a quarter's first fortnight. A baseline is a reading, never part
   of the definition: none of these changes a stage. The rules are rulesQuality.ts's and rulesVerify.ts's
   (`saveBaselines`); this file lays them out. Loaded only when shown. */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useApp } from '../../app/state';
import { TaskHeader } from '../../ui/PageHeader';
import { WarnMark } from '../../ui/bits';
import { FormFooter } from '../../ui/FormFooter';
import { PickOne } from '../../ui/Pick';
import { baselineFor, lastQuarter, onDay, QUALITY_LIMITS, refreshWords, sameSlice, windowWords, calcWords, type BaselineInput } from './rulesQuality';
import { canEditMetric, linksOf, metricsOf, type Metric } from './rules';
import { metricAt, metricPath } from './rulesLibrary';
import { demoBehindWeeks, sourcesFrom } from './sources';
import type { NumberSource } from './source';
import './metrics.css';

type App = ReturnType<typeof useApp>;
type Slice = { teamId: string | null; part: string };
const sliceWords = (app: App, s: Slice) => `${s.teamId ? app.team(s.teamId)?.name ?? 'a removed team' : 'Company'}${s.part ? ` · ${s.part}` : ''}`;
const fig = (v: number, unit: string) => `${v}${unit === '%' ? '%' : ` ${unit}`}`;
const today = (app: App) => app.stamp().slice(0, 10);

/** The slices a metric is read for: the company, then each live link's team and part. */
function slicesOf(app: App, m: Metric): Slice[] {
  const links = linksOf(app.snapshot).filter((l) => l.metricId === m.id && !l.removedAt).map((l) => ({ teamId: l.teamId, part: l.part ?? '' }));
  return [{ teamId: null, part: '' }, ...links].filter((s, i, all) => all.findIndex((o) => sameSlice(o, s)) === i);
}

/** Problems from a refused save, shown above the button. */
function Fix({ text }: { text: string }) {
  return <div className="level-block level-fix" role="alert"><span className="level-head"><WarnMark /><span className="level-word">Must fix</span></span><span>{text}</span></div>;
}

/* ---------- add a baseline for a slice (/metrics/<id>/baseline) ---------- */

export function AddBaseline() {
  const app = useApp();
  const nav = useNavigate();
  const { metricId = '' } = useParams();
  const m = metricAt(metricsOf(app.snapshot), metricId);
  const q = lastQuarter(app.stamp());
  const [teamId, setTeamId] = useState<string>('');
  const [part, setPart] = useState('');
  const [value, setValue] = useState('');
  const [period, setPeriod] = useState(q.words);
  const [takenOn, setTakenOn] = useState(today(app));
  const [how, setHow] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!m || m.removedAt) return <Navigate to="/metrics" replace />;
  const back = () => void nav(metricPath(m));
  if (!canEditMetric(app.viewer, m)) {
    return (
      <div className="focus metric-form">
        <TaskHeader name="Add a baseline" close={{ keeps: false, onClose: back }} />
        <div className="focus-body"><h1 className="qtitle big">Add a baseline</h1><p>Only {app.person(m.ownerId)?.name ?? 'its owner'} or an admin can set this metric’s baselines.</p></div>
      </div>
    );
  }
  const slice: Slice = { teamId: teamId || null, part: part.trim() };
  const had = baselineFor(m, slice);
  const company = baselineFor(m, { teamId: null, part: '' });
  const goals = linksOf(app.snapshot).filter((l) => l.metricId === m.id && !l.removedAt && sameSlice({ teamId: l.teamId, part: l.part ?? '' }, slice)).map((l) => app.goal(l.goalId)).filter((g) => !!g);
  const save = async () => {
    setError('');
    const n = Number(value.replace(',', '.'));
    if (!value.trim() || !Number.isFinite(n)) { setError('Give the value as a number.'); return; }
    const entry: BaselineInput = { teamId: slice.teamId, part: slice.part, value: n, period: period.trim(), takenOn, how: how.trim(), ...(reason.trim() ? { reason: reason.trim() } : {}) };
    setBusy(true);
    try { await app.run('saveBaselines', { metricId: m.id, baselines: [entry] }); back(); } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  return (
    <div className="focus metric-form">
      <TaskHeader name="Add a baseline" close={{ keeps: false, onClose: back }} />
      <form className="focus-body stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <div className="stack" style={{ gap: 4 }}>
          <h1 className="qtitle big">{company && !had ? 'Add a baseline for a team' : 'Add a baseline'}</h1>
          <p className="hint">{m.name} · {calcWords(m.calculation)} · {windowWords(m.timeWindow)} · {refreshWords({ refresh: m.refresh, refreshNote: '' })}</p>
        </div>
        <div className="metric-unit-row">
          <div className="field" id="metric-bl-slice"><PickOne kind="team" label="Slice" none="The whole company" value={teamId || null} onChange={(id) => setTeamId(id ?? '')} /></div>
          <label className="field"><span className="field-label">Part <span className="hint">optional</span></span><input className="input" maxLength={60} value={part} placeholder="tier-1 services" onChange={(e) => setPart(e.target.value)} /></label>
        </div>
        <p className="small hint" role="status">{had ? `${sliceWords(app, slice)} already has one (${fig(had.value, m.unit)}, ${had.period}). Saving moves it to History.` : company && slice.teamId ? `The company already has one (${fig(company.value, m.unit)}, ${company.period}).` : `${sliceWords(app, slice)} has no baseline yet.`}</p>
        <label className="field"><span className="field-label">Value</span>
          <span className="metric-value-row"><input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} aria-describedby="metric-bl-unit" /><span id="metric-bl-unit" className="hint">{m.unit}</span></span>
        </label>
        <div className="metric-unit-row">
          <label className="field"><span className="field-label">Period it covers</span><input className="input" maxLength={QUALITY_LIMITS.period} value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Aug–Oct 2026" /></label>
          <label className="field"><span className="field-label">Date taken</span><input className="input" type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} /></label>
        </div>
        <label className="field"><span className="field-label">How it was taken</span>
          <textarea className="input" rows={2} maxLength={QUALITY_LIMITS.how} value={how} onChange={(e) => setHow(e.target.value)} placeholder="The query, filtered to the team’s services" />
        </label>
        {had && <label className="field"><span className="field-label">Why it changed <span className="hint">needed for a new figure for the same period</span></span><input className="input" maxLength={QUALITY_LIMITS.reason} value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
        <section className="metric-box stack" aria-label="Goals it starts">
          {goals.length
            ? <p className="small">{goals.length === 1 ? 'One goal is' : `${goals.length} goals are`} measured by it for {sliceWords(app, slice)}: {goals.map((g) => g!.title).join(', ')}. Goals already running keep their start values; a goal set from now on starts from this baseline.</p>
            : <p className="small">No goal is measured by it for {sliceWords(app, slice)} yet. A goal measured by this metric for {sliceWords(app, slice)} will start from this baseline.</p>}
          <p className="small hint">A baseline is a reading, not the definition: adding one never changes the stage.</p>
        </section>
        {error && <Fix text={error} />}
        <FormFooter><button className="btn primary big-btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add baseline'}</button></FormFooter>
      </form>
    </div>
  );
}

/* ---------- take this quarter's baselines (/metrics/baselines) ---------- */

type Row = { key: string; metric: Metric; slice: Slice; read: number | null; value: string; reason: string; how: string; skip: string };

/** The viewer's metrics that need this quarter's baselines: theirs, live, measured, and with no company baseline for
    the quarter just ended. */
export function baselinesDue(app: App): Metric[] {
  const q = lastQuarter(app.stamp());
  return metricsOf(app.snapshot).filter((m) => !m.removedAt && !m.retiredAt && m.ownerId === app.viewer.id && m.measurement !== 'gap' && baselineFor(m, { teamId: null, part: '' })?.period !== q.words);
}

export function TakeBaselines() {
  const app = useApp();
  const nav = useNavigate();
  const q = lastQuarter(app.stamp());
  const mine = useMemo(() => metricsOf(app.snapshot).filter((m) => !m.removedAt && !m.retiredAt && m.ownerId === app.viewer.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app.snapshot, app.viewer.id]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void app.exampleSeed().catch(() => null).then(async (seed) => {
      const sources: NumberSource[] = sourcesFrom(seed, app.cycle, demoBehindWeeks());
      const out: Row[] = [];
      for (const m of mine) {
        for (const s of slicesOf(app, m)) {
          const src = sources.find((x) => x.name === m.source && x.reads(m, s));
          let read: number | null = null;
          if (m.measurement !== 'gap' && src) { try { read = (await src.read(m, new Date(q.end), s))?.value ?? null; } catch { read = null; } }
          const had = baselineFor(m, s);
          if (!src && !had && s.teamId) continue;
          const skip = m.measurement === 'gap' ? 'Gap: not measured yet, skipped' : read == null ? `No reading from the source: type the figure, or leave it${had ? ` (now ${fig(had.value, m.unit)}, ${had.period})` : ''}` : '';
          out.push({ key: `${m.id}:${s.teamId ?? ''}:${s.part}`, metric: m, slice: s, read, value: read != null ? String(read) : '', reason: '', how: src ? `Read from ${m.source}, ${onDay(app.stamp())}` : '', skip });
        }
      }
      if (live) setRows(out);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine]);
  const set = (key: string, patch: Partial<Row>) => setRows((rs) => (rs ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const taken = (rows ?? []).filter((r) => r.metric.measurement !== 'gap' && r.value.trim() !== '');
  const changed = (r: Row) => r.read != null && Number(r.value.replace(',', '.')) !== r.read;
  const missingReason = taken.filter((r) => changed(r) && !r.reason.trim());
  const confirm = async () => {
    setTried(true); setError('');
    if (missingReason.length || !taken.length) return;
    setBusy(true);
    try {
      for (const id of [...new Set(taken.map((r) => r.metric.id))]) {
        const entries: BaselineInput[] = taken.filter((r) => r.metric.id === id).map((r) => ({ teamId: r.slice.teamId, part: r.slice.part, value: Number(r.value.replace(',', '.')), period: q.words, takenOn: today(app), how: changed(r) ? `${r.how || 'Typed in'}; ${r.reason.trim()}` : r.how || 'Typed in', ...(r.read != null ? { read: r.read } : {}), ...(changed(r) ? { reason: r.reason.trim() } : {}) }));
        await app.run('saveBaselines', { metricId: id, baselines: entries });
      }
      app.toast(`Saved ${taken.length} ${taken.length === 1 ? 'baseline' : 'baselines'} for ${q.words}`);
      void nav('/metrics');
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  const back = () => void nav('/metrics');
  return (
    <div className="focus metric-form metric-take">
      <TaskHeader name="Take this quarter’s baselines" close={{ keeps: false, onClose: back }} />
      <div className="focus-body stack" style={{ gap: 'var(--s4)' }}>
        <div className="stack" style={{ gap: 4 }}>
          <h1 className="qtitle big">Take this quarter’s baselines</h1>
          <p className="hint">{app.viewer.name} · {mine.length} {mine.length === 1 ? 'metric' : 'metrics'}{rows ? `, ${rows.length} ${rows.length === 1 ? 'slice' : 'slices'}` : ''} · filled from each source’s readings for {q.words}</p>
        </div>
        {!mine.length && <p>You own no metrics, so there are no baselines for you to take.</p>}
        {mine.length > 0 && !rows && <p className="hint" role="status">Reading the sources…</p>}
        {rows && rows.length > 0 && (
          <ul className="metric-take-list" aria-label="Baselines">
            {rows.map((r) => (
              <li key={r.key} className="metric-take-row" data-metric={r.metric.name}>
                <div className="metric-take-what"><strong>{r.metric.name}</strong><span className="hint">{sliceWords(app, r.slice)} · covers {q.words}</span></div>
                {r.metric.measurement === 'gap' ? <p className="small hint">{r.skip}</p> : (
                  <div className="metric-take-fields">
                    <label className="field"><span className="field-label">Value</span>
                      <span className="metric-value-row"><input className="input" inputMode="decimal" value={r.value} onChange={(e) => set(r.key, { value: e.target.value })} aria-label={`${r.metric.name}, ${sliceWords(app, r.slice)}: value`} /><span className="hint">{r.metric.unit}</span></span>
                    </label>
                    <span className="small hint">{r.read != null ? (changed(r) ? `Read ${fig(r.read, r.metric.unit)} · corrected` : r.how) : r.skip}</span>
                    {changed(r) && (
                      <label className="field"><span className="field-label">Why it differs from the reading</span>
                        <input className="input" maxLength={QUALITY_LIMITS.reason} value={r.reason} onChange={(e) => set(r.key, { reason: e.target.value })} aria-invalid={tried && !r.reason.trim() ? true : undefined} />
                        {tried && !r.reason.trim() && <span className="small metric-retake">Say why you changed the figure.</span>}
                      </label>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {rows && <p className="small hint">The baselines they replace move to History. No metric changes stage. Goals already running keep their start values.</p>}
        {error && <Fix text={error} />}
        {rows && (
          <FormFooter>
            <button type="button" className="btn ghost big-btn" onClick={back}>Not now</button>
            <button type="button" className="btn primary big-btn" disabled={busy || !taken.length} onClick={() => void confirm()}>{busy ? 'Saving…' : `Confirm ${taken.length} ${taken.length === 1 ? 'baseline' : 'baselines'}`}</button>
          </FormFooter>
        )}
        {tried && missingReason.length > 0 && <p className="small metric-retake" role="alert">Say why for each corrected figure first.</p>}
      </div>
    </div>
  );
}

/* ---------- Home, in a quarter's first fortnight ---------- */

/** "4 of your metrics have no baseline for Oct–Dec", with Take this quarter's baselines. Nothing when none. */
export function HomeBaselines() {
  const app = useApp();
  const due = baselinesDue(app);
  if (!due.length) return null;
  const q = lastQuarter(app.stamp());
  const next = q.next.replace(/ \d{4}$/, '');
  return (
    <section className="home-block metric-home-baselines stack" aria-labelledby="metric-home-bl" data-part="Baselines due">
      <h2 className="label" id="metric-home-bl">Your metrics</h2>
      <p>{due.length} of your metrics {due.length === 1 ? 'has' : 'have'} no baseline for {next}.</p>
      <p><Link className="btn" to="/metrics/baselines">Take this quarter’s baselines</Link></p>
    </section>
  );
}

