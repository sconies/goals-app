/* Verifying a metric (MQ2 sketch 5, journeys 3 and 4): one check ("I opened the link"), one figure, a note, and the
   difference from the stored figure shown in the metric's own unit, never judged. Mark as Verified, or Couldn't
   reproduce. Who may is `whyCantVerify`'s, the record `verifyMetric`'s (rulesVerify.ts). Loaded only when shown. */
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useApp } from '../../app/state';
import { TaskHeader } from '../../ui/PageHeader';
import { FormFooter } from '../../ui/FormFooter';
import { WarnMark } from '../../ui/bits';
import { StageMark } from './stageMark';
import { refusalFor, stageFor } from './MetricQuality';
import { baselineFor, calcWords, differenceWords, lastQuarter, QUALITY_LIMITS, refreshWords, storedFigure, windowWords } from './rulesQuality';
import { sourceOwnerName } from './rulesVerify';
import { metricsOf } from './rules';
import { metricAt, metricPath } from './rulesLibrary';
import { demoBehindWeeks, sourcesFrom } from './sources';
import './metrics.css';

export function VerifyForm() {
  const app = useApp();
  const nav = useNavigate();
  const { metricId = '' } = useParams();
  const m = metricAt(metricsOf(app.snapshot), metricId);
  const company = m ? baselineFor(m, { teamId: null, part: '' }) : null;
  const [opened, setOpened] = useState(false);
  const [period, setPeriod] = useState(company?.period ?? lastQuarter(app.stamp()).words);
  const [figure, setFigure] = useState('');
  const [note, setNote] = useState('');
  const [reading, setReading] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // With no stored baseline for the period, the latest reading from the source is what the figure is compared with.
  useEffect(() => {
    if (!m) return;
    let live = true;
    void app.exampleSeed().catch(() => null).then(async (seed) => {
      const src = sourcesFrom(seed, app.cycle, demoBehindWeeks()).find((x) => x.name === m.source && x.reads(m, { teamId: null, part: '' }));
      let v: number | null = null;
      try { v = src ? (await src.read(m, new Date(app.stamp()), { teamId: null, part: '' }))?.value ?? null : null; } catch { v = null; }
      if (live) setReading(v);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id]);
  if (!m || m.removedAt) return <Navigate to="/metrics" replace />;
  const back = () => void nav(metricPath(m));
  const st = stageFor(app, m);
  const refusal = refusalFor(app, m, st);
  const n = Number(figure.replace(',', '.'));
  const has = figure.trim() !== '' && Number.isFinite(n);
  const stored = storedFigure(m, period.trim(), reading);
  const owner = app.person(m.ownerId)?.name ?? 'its owner';
  const run = async (outcome: 'verified' | 'couldnt_reproduce') => {
    setTried(true); setError('');
    if (!opened || !has || !period.trim() || !note.trim()) return;
    setBusy(true);
    try {
      await app.run('verifyMetric', { metricId: m.id, period: period.trim(), figure: n, note: note.trim(), openedLink: true, outcome, reading });
      back();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  return (
    <div className="focus metric-form">
      <TaskHeader name="Verify a metric" close={{ keeps: false, onClose: back }} />
      <div className="focus-body stack" style={{ gap: 'var(--s4)' }}>
        <div className="stack" style={{ gap: 4 }}>
          <h1 className="qtitle big">Verify {m.name}</h1>
          <p className="metric-top small"><StageMark k={st.stage} /><span className="metric-top-sep" aria-hidden="true">·</span><span>{calcWords(m.calculation)} · {m.unit}</span><span className="metric-top-sep" aria-hidden="true">·</span><span>{windowWords(m.timeWindow)}</span><span className="metric-top-sep" aria-hidden="true">·</span><span>{refreshWords({ refresh: m.refresh, refreshNote: '' })}</span></p>
        </div>
        {m.meaning && <p className="metric-prose">{m.meaning}</p>}
        <p className="small">Source: {m.source || 'not said'}{m.sourceLink && <> · <a href={m.sourceLink} target="_blank" rel="noreferrer noopener">open the report</a></>}{m.sourceOwnerId || m.sourceOwner ? ` · owned by ${m.sourceOwnerId ? sourceOwnerName(app.snapshot, m) : m.sourceOwner}` : ''}</p>
        {refusal ? (
          <div className="metric-box" role="note"><p>{refusal}</p></div>
        ) : (
          <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void run('verified'); }} noValidate>
            {(m.verifyAttempts ?? []).filter((a) => !a.answered).slice(-1).map((a) => (
              <div key={a.at} className="metric-box" role="note"><p className="small">Read first: {app.person(a.by)?.name ?? 'someone'} couldn’t reproduce it for {a.period}: “{a.note}”</p></div>
            ))}
            <label className="check"><input type="checkbox" checked={opened} onChange={(e) => setOpened(e.target.checked)} /><span>I opened the link and it shows this metric, for this window</span></label>
            {tried && !opened && <span className="small metric-retake">Open the link first, and tick this.</span>}
            <div className="metric-unit-row">
              <label className="field"><span className="field-label">Period</span><input className="input" maxLength={QUALITY_LIMITS.period} value={period} onChange={(e) => setPeriod(e.target.value)} /></label>
              <label className="field"><span className="field-label">The figure you got from the link</span>
                <span className="metric-value-row"><input className="input" inputMode="decimal" value={figure} onChange={(e) => setFigure(e.target.value)} aria-invalid={tried && !has ? true : undefined} /><span className="hint">{m.unit}</span></span>
              </label>
            </div>
            {has && (
              <p className="small" role="status" data-part="Difference">
                {stored.value != null ? `Faro stores ${stored.value}${m.unit === '%' ? '%' : ` ${m.unit}`} ${stored.from === 'baseline' ? `for ${period.trim()}` : 'as the latest reading'}. ` : ''}{differenceWords(n, stored.value, m.unit, m.decimals)}{stored.value != null && stored.value !== n ? ' Say why in the note, or check the window.' : ''}
              </p>
            )}
            <label className="field"><span className="field-label">Note</span>
              <textarea className="input" rows={3} maxLength={QUALITY_LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={tried && !note.trim() ? true : undefined} placeholder="What you checked it against, or what differs" />
            </label>
            <p className="small hint">Recorded as {app.viewer.name}, today. Due again in 12 months. {owner} is told.</p>
            {error && <div className="level-block level-fix" role="alert"><span className="level-head"><WarnMark /><span className="level-word">Must fix</span></span><span>{error}</span></div>}
            {tried && (!has || !note.trim() || !period.trim()) && <p className="small metric-retake" role="alert">Give the period, the figure from the link and a note.</p>}
            <FormFooter>
              <button type="button" className="btn ghost big-btn" disabled={busy} onClick={() => void run('couldnt_reproduce')}>Couldn’t reproduce</button>
              <button type="submit" className="btn primary big-btn" disabled={busy}>{busy ? 'Saving…' : 'Mark as Verified'}</button>
            </FormFooter>
          </form>
        )}
      </div>
    </div>
  );
}
