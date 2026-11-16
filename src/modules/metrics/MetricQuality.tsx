/* A metric's quality on its page (MQ2 sketches 2, 6, 8 and 10): the top line (stage · refresh · window · direction), the
   boxes that ask for something (no longer Verified, couldn't reproduce, a new owner or a rewording to confirm), the
   calculation's parts, the source, baselines per slice with History, and the verification record. Every rule is
   rulesQuality.ts's; this file only lays them out. Loaded with the metric screens, never in the first download. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../../app/state';
import { useWidth } from '../../ui/useWidth';
import { StageMark } from './stageMark';
import { calcWords, differenceWords, liveBaselines, onDay, refreshWords, stageOf, whyCantVerify, windowWords, type Stage } from './rulesQuality';
import { sourceOwnerName } from './rulesVerify';
import { directionWords, metricPath, ownerName } from './rulesLibrary';
import { canEditMetric, type Metric } from './rules';
import type { MetricBaseline, MetricPart } from './types';

/* The forms these sections lead to (verify, add a baseline) come in the next part of MQ2's screens. */
export const FORMS = { verify: false, baseline: false };

/** Below this width the page's tables become label and value pairs (sketch 8). */
const NARROW = 560;

type App = ReturnType<typeof useApp>;
/** The stage of a metric as the open workspace reads it. */
export function stageFor(app: App, m: Metric): Stage {
  return stageOf(m, { now: app.stamp(), ownerIsHere: !!ownerName(app.snapshot.people, m), nameOf: (id) => app.person(id)?.name ?? 'someone who has left' });
}

/** Whether the viewer may verify the metric now, and if not, why (null: they may). */
export function refusalFor(app: App, m: Metric, st: Stage): string | null {
  return whyCantVerify(m, app.viewer, { stage: st.stage, teams: app.snapshot.teams, sourceOwnerName: sourceOwnerName(app.snapshot, m) });
}

/** The line under a metric's name: its stage, refresh, window, and unit with which way is better (sketch 2). */
export function QualityTop({ metric: m, st }: { metric: Metric; st: Stage }) {
  return (
    <p className="metric-top small" data-part="Stage">
      <StageMark k={st.stage} />
      <span className="metric-top-sep" aria-hidden="true">·</span><span>{refreshWords({ refresh: m.refresh, refreshNote: '' })}</span>
      <span className="metric-top-sep" aria-hidden="true">·</span><span>{windowWords(m.timeWindow)}</span>
      <span className="metric-top-sep" aria-hidden="true">·</span><span>{m.unit}, {directionWords(m.direction)}</span>
    </p>
  );
}

const nameOf = (app: ReturnType<typeof useApp>, id: string | null | undefined) => (id ? app.person(id)?.name ?? 'someone who has left' : 'someone');

/** The boxes that ask for something: each a whole-surface box with a full outline, never a side stripe. */
export function QualityNotices({ metric: m, st }: { metric: Metric; st: Stage }) {
  const app = useApp();
  const [answering, setAnswering] = useState(false);
  const [note, setNote] = useState('');
  const edit = canEditMetric(app.viewer, m);
  const refusal = refusalFor(app, m, st);
  const owner = nameOf(app, m.ownerId);
  const run = async (name: string, input: object) => { try { await app.run(name, input); return true; } catch { return false; } };
  const attempt = (m.verifyAttempts ?? []).filter((a) => !a.answered).slice(-1)[0];
  const l = st.lapsed;
  return (
    <>
      {l && (
        <section className="metric-box stack" role="note" aria-labelledby="metric-lapse" data-part="No longer Verified">
          <h2 className="metric-box-head" id="metric-lapse">{l.kind === 'age' ? 'No longer Verified: 12 months since it was verified' : `No longer Verified: ${l.what.join(', ')} changed`}</h2>
          {l.kind === 'change' && m.lapse && <p>On {onDay(l.at)} {nameOf(app, l.by)} changed {l.what.join(', ')}. It was verified by {nameOf(app, m.lapse.was.by)} on {onDay(m.lapse.was.at)}{l.what.some((w) => /source/.test(w)) ? ', against the old source' : ''}.</p>}
          {l.kind === 'change' && l.why && <p>{firstName(nameOf(app, l.by))}’s reason: “{l.why}”</p>}
          <p className="small">{owner} (owner) was told.{l.kind === 'change' && l.by ? ` ${nameOf(app, l.by)} can’t verify it: they made the change.` : ''}</p>
          <div className="row">
            {!refusal && FORMS.verify && <Link className="btn" to={`${metricPath(m)}/verify`}>Verify again</Link>}
            <a className="btn ghost" href="#history">See what changed</a>
          </div>
        </section>
      )}
      {attempt && (
        <section className="metric-box stack" role="note" aria-labelledby="metric-attempt" data-part="Couldn't reproduce">
          <h2 className="metric-box-head" id="metric-attempt">Couldn’t reproduce · {nameOf(app, attempt.by)}, {onDay(attempt.at)}</h2>
          <p>For {attempt.period}, from the source link. {differenceWords(attempt.figure, attempt.stored, m.unit, m.decimals).replace(/^Your /, 'Got ').replace(/ stored/, ' in Faro')}</p>
          <p>{firstName(nameOf(app, attempt.by))}’s note: “{attempt.note}”</p>
          <p className="small">{owner} (owner) was told. The next verifier sees this first.</p>
          {edit && !answering && (
            <div className="row">
              <Link className="btn" to={`${metricPath(m)}/edit`}>Edit the definition</Link>
              <button type="button" className="btn ghost" onClick={() => setAnswering(true)}>Reply to {firstName(nameOf(app, attempt.by))}</button>
            </div>
          )}
          {edit && answering && (
            <form className="stack" style={{ gap: 'var(--s2)' }} onSubmit={(e) => { e.preventDefault(); void run('answerMetricAttempt', { metricId: m.id, note }).then((ok) => { if (ok) { setAnswering(false); setNote(''); } }); }}>
              <label className="field"><span className="field-label">Your reply</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
              <div className="row"><button type="submit" className="btn" disabled={!note.trim()}>Send reply</button><button type="button" className="btn ghost" onClick={() => setAnswering(false)}>Cancel</button></div>
            </form>
          )}
        </section>
      )}
      {m.handover && (
        <section className="metric-box stack" role="note" aria-labelledby="metric-handover" data-part="New owner">
          <h2 className="metric-box-head" id="metric-handover">New owner, please confirm</h2>
          <p>{nameOf(app, m.handover.from)} left on {onDay(m.handover.at)}; the metric passed to {owner}. Its stage didn’t change.</p>
          {app.viewer.id === m.ownerId
            ? <div className="row"><button type="button" className="btn" onClick={() => void run('confirmMetricOwner', { metricId: m.id })}>I own this metric</button><Link className="btn ghost" to={`${metricPath(m)}/edit?field=owner`}>Name another owner</Link></div>
            : <p className="small">Waiting for {owner} to confirm.</p>}
        </section>
      )}
      {m.toConfirm && (
        <section className="metric-box stack" role="note" aria-labelledby="metric-reword" data-part="Rewording to confirm">
          <h2 className="metric-box-head" id="metric-reword">The {m.toConfirm.what.join(' and ')} {m.toConfirm.what.length > 1 ? 'were' : 'was'} reworded</h2>
          <p>{nameOf(app, m.toConfirm.by)} reworded them on {onDay(m.toConfirm.at)}. It stays Verified; {nameOf(app, m.toConfirm.verifier)}, who verified it, is asked to confirm the new words mean the same.</p>
          {app.viewer.id === m.toConfirm.verifier && app.viewer.id !== m.toConfirm.by && <div className="row"><button type="button" className="btn" onClick={() => void run('confirmMetricReword', { metricId: m.id })}>They mean the same</button></div>}
        </section>
      )}
    </>
  );
}

const firstName = (n: string) => n.split(/\s+/)[0] ?? n;

function PartFacts({ title, p }: { title?: string; p: MetricPart }) {
  return (
    <div className="metric-part">
      {title && <p className="label">{title}</p>}
      {p.name && <p className="metric-part-name">{p.name}</p>}
      <dl className="metric-part-facts">
        <dt>Counts</dt><dd>{p.counts || 'Not said'}</dd>
        <dt>Filters</dt><dd>{p.filters || 'Not said'}</dd>
        <dt>Leaves out</dt><dd>{p.excludes || 'Not said'}</dd>
      </dl>
    </div>
  );
}

/** What is measured and its parts: a ratio's numerator over its denominator, side by side (stacked with ÷ on a phone). */
export function Calculation({ metric: m }: { metric: Metric }) {
  const c = m.calculation;
  const edit = canEditMetric(useApp().viewer, m);
  return (
    <section className="stack metric-calc" style={{ gap: 'var(--s2)' }} aria-labelledby="metric-calc" data-part="Calculation">
      <h2 className="label" id="metric-calc">Calculation · {calcWords(c)}</h2>
      {!c && <p className="hint">Not said yet.{edit && <> <Link to={`${metricPath(m)}/edit?field=calculation`}>Say what is measured</Link></>}</p>}
      {c?.measure === 'ratio' && (
        <>
          <div className="metric-ratio">
            {c.numerator ? <PartFacts title="Numerator" p={c.numerator} /> : <p className="hint">No numerator yet.</p>}
            <span className="metric-over" aria-hidden="true">÷</span>
            {c.denominator ? <PartFacts title="Denominator" p={c.denominator} /> : <p className="hint">No denominator yet.</p>}
          </div>
          <p className="small hint">Numerator ÷ denominator{m.unit === '%' ? ' × 100' : ''}, over the window.</p>
        </>
      )}
      {c?.measure === 'other' && <p className="metric-prose">{c.formula || 'No formula yet.'}</p>}
      {c && c.measure !== 'ratio' && c.measure !== 'other' && (c.part ? <PartFacts p={c.part} /> : <p className="hint">What it counts isn’t said yet.</p>)}
    </section>
  );
}

/** Where the number comes from: the system, the link to the exact report, the source's owner, the refresh, the query. */
export function Source({ metric: m }: { metric: Metric }) {
  const app = useApp();
  const owner = app.person(m.ownerId);
  const srcOwner = m.sourceOwnerId ? sourceOwnerName(app.snapshot, m) : m.sourceOwner;
  return (
    <section className="stack" style={{ gap: 'var(--s2)' }} aria-labelledby="metric-source" data-part="Source">
      <h2 className="label" id="metric-source">Source</h2>
      <dl className="metric-src">
        <dt>System</dt><dd>{m.source || 'Not said'}</dd>
        <dt>Report</dt><dd>{m.sourceLink ? <a href={m.sourceLink} target="_blank" rel="noreferrer noopener">{reportWords(m.sourceLink)}</a> : 'No link yet'}</dd>
        <dt>Source owner</dt><dd>{srcOwner || 'Not said'}</dd>
        <dt>Refresh</dt><dd>{refreshWords(m).replace(/^Refreshed /, '').replace(/^./, (x) => x.toUpperCase())}</dd>
        {m.sourceQuery && <><dt>Query</dt><dd><details><summary>Show the query</summary><pre className="metric-query">{m.sourceQuery}</pre></details></dd></>}
        <dt>Metric owner</dt><dd>{owner ? <Link to={`/people/${encodeURIComponent(owner.id)}`}>{owner.name}</Link> : 'No owner'}</dd>
      </dl>
    </section>
  );
}

const reportWords = (link: string) => { try { const u = new URL(link); return `${u.host}${u.pathname.length > 1 ? u.pathname : ''}`; } catch { return link; } };

/** Baselines per slice: a table on a computer, label and value pairs on a phone; old ones under History. */
export function Baselines({ metric: m }: { metric: Metric }) {
  const app = useApp();
  const [ref, width] = useWidth<HTMLElement>();
  const narrow = width > 0 && width < NARROW;
  const live = liveBaselines(m);
  const old = (m.baselines ?? []).filter((b) => !!b.replacedAt);
  const edit = canEditMetric(app.viewer, m);
  const slice = (b: Pick<MetricBaseline, 'teamId' | 'part'>) => `${b.teamId ? app.team(b.teamId)?.name ?? 'a removed team' : 'Company'}${b.part ? ` · ${b.part}` : ''}`;
  const value = (b: MetricBaseline) => `${b.value}${m.unit === '%' ? '%' : ` ${m.unit}`}`;
  const how = (b: MetricBaseline) => (b.oldSource ? 'The old source' : b.how);
  return (
    <section className="stack metric-baselines" ref={ref} style={{ gap: 'var(--s2)' }} aria-labelledby="metric-baselines" data-part="Baselines">
      <h2 className="label" id="metric-baselines">Baselines</h2>
      {!live.length && <p className="hint">No baseline yet. A baseline is a reading for a slice: the company, or one team. It never changes the stage.</p>}
      {live.length > 0 && !narrow && (
        <table className="metric-table small">
          <thead><tr><th scope="col">Slice</th><th scope="col">Value</th><th scope="col">Covers</th><th scope="col">Taken</th><th scope="col">How</th></tr></thead>
          <tbody>{live.map((b) => <tr key={b.id}><th scope="row">{slice(b)}</th><td>{value(b)}</td><td>{b.period}</td><td>{onDay(b.takenOn)}</td><td>{how(b)}{b.oldSource && <span className="metric-retake"> · retake from the new source</span>}</td></tr>)}</tbody>
        </table>
      )}
      {live.length > 0 && narrow && (
        <dl className="metric-pairs">
          {live.map((b) => <div key={b.id}><dt>{slice(b)}</dt><dd>{value(b)} · {b.period}<br /><span className="hint">Taken {onDay(b.takenOn)} · {how(b)}{b.oldSource ? ' · retake' : ''}</span></dd></div>)}
        </dl>
      )}
      {old.length > 0 && (
        <details className="metric-history-old">
          <summary className="small">History: {old.length} old {old.length === 1 ? 'baseline' : 'baselines'}</summary>
          <ul className="small">{old.map((b) => <li key={b.id}>{slice(b)}: {value(b)} for {b.period}, taken {onDay(b.takenOn)}. Replaced {onDay(b.replacedAt!)}{b.replacedWhy ? `: ${b.replacedWhy}` : ''}.</li>)}</ul>
        </details>
      )}
      {edit && !m.retiredAt && FORMS.baseline && <p className="small"><Link to={`${metricPath(m)}/baseline`}>{live.length ? 'Add a baseline for a team' : 'Add a baseline'}</Link></p>}
    </section>
  );
}

/** The verification record: who and when, the figure reproduced against the stored one, the note, when it is due again. */
export function Verification({ metric: m, st }: { metric: Metric; st: Stage }) {
  const app = useApp();
  const [ref, width] = useWidth<HTMLElement>();
  const narrow = width > 0 && width < NARROW;
  const v = m.verification && m.verification.outcome === 'verified' ? m.verification : null;
  const refusal = refusalFor(app, m, st);
  const mayVerify = !refusal && st.stage !== 'draft' && !m.retiredAt && !st.lapsed;
  if (!v && st.stage === 'draft') return null;
  return (
    <section className="stack" ref={ref} style={{ gap: 'var(--s2)' }} aria-labelledby="metric-verification" data-part="Verification">
      <h2 className="label" id="metric-verification">Verification</h2>
      {v ? (
        <>
          <p>{st.stage === 'verified' ? 'Verified' : 'Was verified'} by {nameOf(app, v.by)}, {onDay(v.at)}.{st.dueBy && st.stage === 'verified' ? ` Re-verify by ${onDay(st.dueBy)}.` : ''}</p>
          <p className="small">Opened the link and reproduced the figure for {v.period}. {differenceWords(v.figure, v.stored, m.unit, m.decimals)}</p>
          {narrow ? <details><summary className="small">Read the note</summary><p className="small">{v.note}</p></details> : <p className="small"><span className="label">{firstName(nameOf(app, v.by))}’s note</span> {v.note}</p>}
        </>
      ) : <p className="hint">Not verified yet. Someone other than its owner, and other than whoever last changed its calculation, opens the source link and reproduces the figure.</p>}
      {FORMS.verify && mayVerify && (st.stage === 'defined' || st.toVerify) && <p className="small"><Link to={`${metricPath(m)}/verify`}>Verify this metric</Link></p>}
    </section>
  );
}
