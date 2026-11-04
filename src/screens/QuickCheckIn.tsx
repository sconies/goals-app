/* Type every number for the week in one table. Each row is judged as you type with the same rules as the
   check-in; a row that's behind or ahead opens just the fields it needs. Saved together through the bulk-change engine. */
import { useMemo, useRef, useState, type SelectHTMLAttributes } from 'react';
import { useDraft } from '../app/drafts';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../app/state';
import { describe, type Rec } from '../domain/changeset';
import { CAUSES_AHEAD, CAUSES_BEHIND, causeLabel, emptyDraft, evaluate, MIN_PATH, MIN_REASON, valueProblem, type Draft } from '../domain/checkin';
import { fmt } from '../domain/format';
import { planAt, weekDates } from '../domain/plan';
import { checkInsFor } from '../domain/status';
import type { Cause, Goal, MetricGoal, RangeGoal } from '../domain/types';
import { Chip, Empty } from '../ui/bits';
import { Icon } from '../ui/Icon';

/** A select with the app's own chevron, so its text sits where an input's does. */
function Select({ invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <span className="qselect">
      <select className={'input' + (invalid ? ' invalid' : '')} aria-invalid={invalid || undefined} {...rest}>{children}</select>
      <Icon name="chevron-down" className="qselect-chev" />
    </span>
  );
}

/** The words a missing item is shown with here: the same words as the field it points at. */
const missingWords = (m: string) => (m === 'path to green' ? 'how it gets back on plan' : m);

type Row = { value: string; cause: Cause | null; why: string; path: string; by: number | null };
const blank: Row = { value: '', cause: null, why: '', path: '', by: null };

export function QuickCheckIn() {
  const app = useApp();
  const nav = useNavigate();
  const goals = app.snapshot.goals.filter((g): g is MetricGoal | RangeGoal => g.ownerId === app.viewer.id && g.kind !== 'milestone' && app.statusOf(g).status !== 'done');
  const milestones = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id && g.kind === 'milestone' && app.statusOf(g).status !== 'done');
  // Kept as you type, like a single check-in's draft, so a refresh or a wrong turn doesn't lose the numbers (round 3 review).
  const [rows, patchRows, clearRows, restored] = useDraft<Record<string, Row>>(`${app.ws.id}:bulk:${app.viewer.id}:${app.week}`, () => ({}));
  const setRows = (f: (r: Record<string, Row>) => Record<string, Row>) => patchRows(f(rows));
  const hasDraft = restored && Object.values(rows).some((r) => r.value.trim());
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...blank, ...r[id], ...patch } }));

  const judged = useMemo(() => goals.map((g) => {
    const r = rows[g.id] ?? blank;
    const posted = app.snapshot.checkIns.find((c) => c.goalId === g.id && c.week === app.week) ?? null;
    if (!r.value.trim()) return { g, r, posted, e: null, problem: null };
    // The number itself comes first: until it's a possible value there's no status to show or reason to ask for.
    const last = checkInsFor(g, app.snapshot.checkIns).filter((c) => c.value != null).pop()?.value ?? null;
    const problem = valueProblem(r.value, last, g.unit, g);
    const d: Draft = { ...emptyDraft(g, null), value: r.value, cause: r.cause, why: r.why, ptgWhat: r.path, ptgBy: r.by, ptgState: 'plan' };
    return { g, r, posted, e: evaluate(g, app.cycle, app.week, d, app.snapshot.checkIns), problem };
  }), [goals, rows, app.snapshot.checkIns, app.cycle, app.week]);

  const filled = judged.filter((x) => x.e);
  const ready = filled.filter((x) => x.e!.canPost);
  const badNumbers = filled.filter((x) => x.problem?.block).length;
  const needReasons = filled.length - ready.length - badNumbers;
  // A second press while saving does nothing (a ref, because state updates too late to stop a quick double tap).
  const inFlight = useRef(false);
  const save = async () => {
    if (inFlight.current) return;
    setTried(true);
    if (!filled.length || ready.length < filled.length) return;
    const recs: Rec[] = filled.map(({ g, r }, i) => ({
      __row: String(i + 2), 'goal id': g.id, week: String(app.week), value: r.value, cause: r.cause ? causeLabel(r.cause) : '', why: r.why, 'path to green': r.path, 'back on plan by week': r.by == null ? '' : String(r.by),
    }));
    const cs = app.previewChanges({ checkIns: recs }, 'bulk');
    if (!cs.commit) { app.toast(cs.issues[0]?.message ?? 'Nothing to save', 'error'); return; }
    inFlight.current = true;
    setBusy(true);
    try {
      await app.applyChanges(cs);
      clearRows();
      app.toast(`Saved: ${describe(cs).toLowerCase()}`);
      nav('/');
    } catch { inFlight.current = false; setBusy(false); }
  };
  const weeks = Array.from({ length: Math.max(0, app.cycle.weeks - app.week) }, (_, k) => app.week + 1 + k);

  const summary = tried && !filled.length
    ? 'Type at least one number.'
    : tried && filled.length > ready.length
      ? [badNumbers ? `${badNumbers} ${badNumbers === 1 ? 'row needs' : 'rows need'} a possible number` : '', needReasons ? `${needReasons} ${needReasons === 1 ? 'row needs' : 'rows need'} a reason or a path to green` : ''].filter(Boolean).join('; ') + '.'
      : '';

  return (
    <div className="page narrow quick">
      <div className="page-head">
        <h1 className="title-xl">Type this week’s numbers</h1>
        <span className="hint">Week {app.week}, {weekDates(app.cycle, app.week)}. Leave a row empty to skip it. A row that’s off plan asks why.</span>
      </div>
      {!goals.length && <Empty title="No number goals to update"><Link className="btn" to="/check-in">Use the normal check-in</Link></Empty>}
      {goals.length > 0 && (
        <form className="stack" style={{ gap: 'var(--s3)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
          {hasDraft && <p className="restored small">Picked up the numbers you hadn’t posted yet. <button type="button" className="linkish" onClick={() => { clearRows(); window.location.reload(); }}>Start over</button></p>}
          <div className="glist qgrid">
            {judged.map(({ g, r, posted, e: judgedE, problem }) => {
              const invalidNumber = !!problem?.block;
              const e = invalidNumber ? null : judgedE;
              const last = checkInsFor(g, app.snapshot.checkIns).filter((c) => c.value != null).pop();
              const plan = g.kind === 'metric' ? fmt(planAt(g.plan, app.week, app.cycle.weeks), g) : (g.range.bound === 'atMost' ? '≤ ' : '≥ ') + fmt(g.range.limit, g);
              const behind = e?.reason === 'behind';
              const showWhy = !!e?.reason;
              const showPath = !!e?.needsPath;
              // Once they've pressed Post, outline exactly the fields the row still needs, the empty selects included.
              const missWhy = tried && !!e && e.missing.some((m) => m.startsWith('why it’s'));
              const missPath = tried && !!e && e.missing.includes('path to green');
              const bad = invalidNumber || (tried && !!e && !e.canPost);
              return (
                <div key={g.id} className={'qrow' + (bad ? ' invalid' : '')}>
                  <div className="qrow-main">
                    <span className="qname">
                      <Link className="qlink strong" to={'/goals/' + g.id}>{g.title}</Link>
                      {/* Each part keeps its words together, and a line never ends on a separator. */}
                      <span className="hint">
                        <span className="nobr">Plan {plan}</span>
                        {last && <> <span className="nobr">· last {fmt(last.value!, g)} (week&nbsp;{last.week})</span></>}
                        {posted && <> <span className="nobr">· {posted.value != null ? `${fmt(posted.value, g)} posted this week` : 'already posted this week'}</span></>}
                      </span>
                    </span>
                    {/* The unit stays beside the number once it's typed; the field is empty until you type. */}
                    <label className={'qvalue input' + (invalidNumber ? ' invalid' : '')}>
                      <span className="sr">{g.title}: this week’s number{g.unit ? ` in ${g.unit}` : ''}</span>
                      <input inputMode="decimal" autoComplete="off" value={r.value} onChange={(ev) => set(g.id, { value: ev.target.value })} aria-invalid={invalidNumber || undefined} aria-describedby={problem ? `q-${g.id}-problem` : undefined} />
                      {g.unit && <span className="qunit" aria-hidden="true">{g.unit}</span>}
                    </label>
                    {problem && <span id={`q-${g.id}-problem`} className={'qproblem hint' + (problem.block ? ' tone-off' : '')} role={problem.block ? 'alert' : undefined}>{problem.text}</span>}
                    <span className={'qstatus' + (e ? '' : ' empty')}>{e ? <Chip k={e.status} /> : <span className="hint">—</span>}</span>
                  </div>
                  {(showWhy || showPath) && (
                    <div className="qrow-more">
                      {showWhy && (
                        <div className="pair">
                          <label className="field"><span className="field-label">{behind ? 'Why it’s behind' : 'Why it’s ahead'}</span>
                            <Select invalid={missWhy && !r.cause} value={r.cause ?? ''} onChange={(ev) => set(g.id, { cause: (ev.target.value || null) as Cause | null })}>
                              <option value="">Choose a cause</option>
                              {(behind ? CAUSES_BEHIND : CAUSES_AHEAD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                            </Select>
                          </label>
                          <label className="field"><span className="field-label">In a sentence</span>
                            <textarea className={'input qtext' + (missWhy && r.why.trim().length < MIN_REASON ? ' invalid' : '')} rows={2} value={r.why} onChange={(ev) => set(g.id, { why: ev.target.value })} />
                          </label>
                        </div>
                      )}
                      {showPath && (
                        <div className="pair">
                          <label className="field"><span className="field-label">How it gets back on plan</span>
                            <textarea className={'input qtext' + (missPath && r.path.trim().length < MIN_PATH ? ' invalid' : '')} rows={2} value={r.path} onChange={(ev) => set(g.id, { path: ev.target.value })} />
                          </label>
                          <label className="field"><span className="field-label">Back on plan by</span>
                            <Select invalid={missPath && r.by == null} value={r.by ?? ''} onChange={(ev) => set(g.id, { by: ev.target.value ? Number(ev.target.value) : null })}>
                              <option value="">Choose a week</option>
                              {weeks.map((w) => <option key={w} value={w}>Week {w} · {weekDates(app.cycle, w)}</option>)}
                            </Select>
                          </label>
                        </div>
                      )}
                      {bad && e && <span className="hint tone-off" role="alert">Still needed: {e.missing.map(missingWords).join(', ')}.</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {milestones.length > 0 && <p className="hint">Stage goals ({milestones.map((g: Goal) => g.title).join(', ')}) use the <Link to="/check-in">normal check-in</Link>.</p>}
          {/* Post stays in sight however long the table gets; what's still wrong is said just above it. */}
          <div className="qfoot">
            {summary && <p className="qsummary" role="alert">{summary}</p>}
            <div className="foot-row">
              <Link className="btn ghost big-btn" to="/">Cancel</Link>
              <button type="submit" className="btn primary big-btn" disabled={busy}>{busy ? 'Saving…' : filled.length ? `Post ${filled.length} ${filled.length === 1 ? 'check-in' : 'check-ins'}` : 'Post check-ins'}</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
