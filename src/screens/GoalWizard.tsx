import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { dueOptions, isYear } from '../domain/year';
import { goalDraftKey, useDraft } from '../app/drafts';
import { parseNumber } from '../domain/checkin';
import { blankGoal, buildGoal, draftOf, validateGoal, withPoints, type GoalDraft, type GoalErrors } from '../domain/goal';
import { fmt, LEVEL_LABEL } from '../domain/format';
import type { Goal, GoalKind, Level, MetricGoal, PlanShape } from '../domain/types';

const LEVEL_ORDER: Level[] = ['team', 'svp', 'north-star'];
const LEVEL_RANK: Record<Level, number> = { 'north-star': 0, svp: 1, team: 2 };
import { newId } from '../data/store';
import { Empty, Steps } from '../ui/bits';
import { MetricChart } from '../ui/charts';
import { PlanTable } from '../ui/PlanTable';
import { weekDates, yearEndWeek } from '../domain/plan';

const KINDS: [GoalKind, string, string, string][] = [
  ['metric', 'Move a number', 'From where it is to where it should be', 'e.g. Lead time from 4.2 to 2 days'],
  ['range', 'Keep a number in range', 'A guardrail that mustn’t cross a line', 'e.g. Change failure rate at most 12%'],
  ['milestone', 'Hit dated stages', 'Work that is done or not, by a week', 'e.g. Threat model, build, approval'],
];
const SHAPES: [PlanShape, string, string][] = [
  ['straight', 'Steady', 'The same progress every week'],
  ['back', 'Back-loaded', 'Slow start, faster once work lands'],
  ['stepped', 'In steps', 'Jumps as each release ships'],
];
const STEP_FIELDS: (keyof GoalErrors)[][] = [['title'], ['start', 'target', 'limit', 'margin', 'decimals', 'stages', 'points'], ['teamId', 'ownerId', 'effect'], []];
const STEP_LABELS = ['What', 'Measure', 'Where it fits', 'Check and publish'];

export function GoalWizard() {
  const app = useApp();
  const { goalId } = useParams();
  const existing = goalId ? app.goal(goalId) ?? null : null;
  if (goalId && !existing) return <div className="page narrow"><Empty title="This goal doesn’t exist"><Link className="btn" to="/goals">All goals</Link></Empty></div>;
  return <Wizard key={goalId ?? 'new'} existing={existing} />;
}

function Wizard({ existing }: { existing: Goal | null }) {
  const app = useApp();
  const nav = useNavigate();
  const { cycle, week } = app;
  const started = existing ? app.checkInsOf(existing).length > 0 : false;
  // When the target is due: the end of the cycle, or the end of the year (a year goal carries across cycles).
  const yearEnd = yearEndWeek(cycle);
  const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const defaultParent = app.goal(params.get('parent') ?? '')?.id ?? '';
  const defaultTeam = app.viewer.teamId ?? app.snapshot.teams[0]?.id ?? '';
  const defaultOwner = app.viewer.id;
  const [d, set, clear, restored] = useDraft<GoalDraft & { step: number }>(goalDraftKey(app.ws.id, existing?.id ?? null), () => ({ ...(existing ? draftOf(existing) : blankGoal(defaultTeam, defaultOwner, defaultParent)), step: 0 }));
  const [tried, setTried] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const step = d.step;
  const endOptions = dueOptions(cycle, week, yearEnd);
  const endChoice = parseNumber(d.endWeek) ?? cycle.weeks;
  const errors = validateGoal(d, cycle);
  const stepErrors = (i: number) => STEP_FIELDS[i]!.filter((k) => errors[k]);
  const showErr = (k: keyof GoalErrors) => tried.includes(step) && errors[k] ? <span className="tiny tone-off" role="alert">{errors[k]}</span> : null;
  const top = useRef<HTMLDivElement>(null);
  // After “Change …” on the summary, Continue comes straight back to it.
  const [fromSummary, setFromSummary] = useState(false);
  useEffect(() => { top.current?.querySelector<HTMLElement>('input, select, textarea, button.kindcard')?.focus(); }, [step]);

  const go = (to: number) => {
    if (to > step) {
      for (let i = step; i < to; i++) if (stepErrors(i).length) { setTried((t) => [...t, i]); set({ step: i }); return; }
    }
    set({ step: to });
  };

  const publish = async () => {
    const bad = [0, 1, 2].find((i) => stepErrors(i).length);
    if (bad != null) { setTried([0, 1, 2]); set({ step: bad }); return; }
    setSaving(true);
    const g = buildGoal(d, cycle, { id: existing?.id ?? newId('goal'), createdAt: existing?.createdAt ?? app.stamp() }, existing, started, week);
    try {
      await app.saveGoal(g, existing);
      clear();
      app.toast(existing ? 'Saved. The change is in the goal’s activity.' : `Published “${g.title}”`);
      nav('/goals/' + g.id);
    } catch {
      setSaving(false);
    }
  };

  const preview: MetricGoal | null = (() => {
    const s = parseNumber(d.start), t = parseNumber(d.target);
    if (d.kind !== 'metric' || s == null || t == null || s === t) return null;
    const prev = existing?.kind === 'metric' ? existing : null;
    const changed = prev && (prev.plan.start !== s || prev.plan.target !== t || prev.plan.shape !== d.shape);
    return {
      id: 'preview', cycleId: cycle.id, teamId: d.teamId, ownerId: d.ownerId, title: d.title || 'New goal', io: d.io, level: d.level, guardrail: d.guardrail,
      parentId: null, effect: null, source: '', definition: '', createdAt: '', kind: 'metric', unit: d.unit, decimals: parseNumber(d.decimals) ?? 0,
      plan: { start: s, target: t, shape: d.shape, ...(prev ? (prev.plan.fromWeek ? { fromWeek: prev.plan.fromWeek } : {}) : week > 0 ? { fromWeek: week } : {}), ...(endChoice !== cycle.weeks ? { endWeek: endChoice } : {}) },
      originalPlan: prev && started && changed ? prev.originalPlan ?? prev.plan : prev?.originalPlan ?? null, rebaselinedWeek: null,
    };
  })();
  const rebaseline = existing?.kind === 'metric' && started && preview && (existing.plan.start !== preview.plan.start || existing.plan.target !== preview.plan.target || existing.plan.shape !== preview.plan.shape);
  const parents = app.snapshot.goals.filter((g) => g.id !== existing?.id).sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.title.localeCompare(b.title));
  const owner = app.person(d.ownerId);
  const parent = app.goal(d.parentId);
  const unitFmt = { unit: d.unit, decimals: parseNumber(d.decimals) ?? 0 };

  return (
    <div className="focus" ref={top}>
      <div className="focus-top">
        <span className="small strong">{existing ? 'Edit goal' : 'New goal'}</span>
        <Steps at={step + 1} of={4} label={STEP_LABELS[step]} />
        <button className="iconbtn" onClick={() => nav(existing ? '/goals/' + existing.id : '/goals')} aria-label="Close and keep the draft">✕</button>
      </div>
      <form className="focus-body" onSubmit={(e) => { e.preventDefault(); if (step < 3) go(fromSummary ? 3 : step + 1); else void publish(); }} noValidate>
        {restored && <div className="restored small">Restored your unsaved draft. <button type="button" className="linkish" onClick={() => { clear(); window.location.reload(); }}>Start over</button></div>}

        {step === 0 && (
          <>
            <h1 className="qtitle big">What do you want to achieve?</h1>
            <label className="field">
              <span className="small strong">Name it the way your team would say it</span>
              <input className="input big-input" value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Requests triaged within 2 days" aria-invalid={tried.includes(0) && !!errors.title} />
              {showErr('title')}
            </label>
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
              <legend className="small strong" style={{ marginBottom: 8 }}>How will you know it worked?</legend>
              <div className="kindcards">
                {KINDS.map(([k, l, help, ex]) => (
                  <button key={k} type="button" className="kindcard" aria-pressed={d.kind === k} disabled={started && existing?.kind !== k} onClick={() => set({ kind: k })}>
                    <span className="strong">{l}</span><span className="small">{help}</span><span className="tiny muted">{ex}</span>
                  </button>
                ))}
              </div>
              {started && <span className="tiny muted">The type can’t change once check-ins have started.</span>}
              {d.kind === 'milestone' && <span className="tiny muted">Tip: if you can count progress, a number usually tells you more than stages do.</span>}
            </fieldset>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="qtitle big">{d.kind === 'metric' ? 'Where does it start, and where should it end?' : d.kind === 'range' ? 'Where is the line it mustn’t cross?' : 'What are the stages, and when is each due?'}</h1>
            {d.kind !== 'milestone' && (
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <label className="field" style={{ flex: '0 1 150px' }}><span className="small strong">Unit</span><input className="input" value={d.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="%, days, ms" /></label>
                <label className="field" style={{ flex: '0 1 110px' }}><span className="small strong">Decimals</span><input className="input" inputMode="numeric" value={d.decimals} onChange={(e) => set({ decimals: e.target.value })} />{showErr('decimals')}</label>
              </div>
            )}
            {d.kind === 'metric' && (
              <>
                <div className="field"><span className="small strong" id="end-l">By when?</span>
                  <div className="seg full" role="group" aria-labelledby="end-l">
                    {endOptions.map(([w, l]) => <button key={w} type="button" aria-pressed={endChoice === w} onClick={() => set({ endWeek: w === cycle.weeks ? '' : String(w), points: {} })}>{l}</button>)}
                  </div>
                  <span className="hint">Due week {endChoice}, {weekDates(cycle, endChoice)}.{endChoice > cycle.weeks ? ` It carries into next ${isYear(cycle) ? 'year' : 'cycle'} with this plan.` : ''}</span>
                </div>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <label className="field" style={{ flex: '1 1 140px' }}><span className="small strong">Today (week {existing?.kind === 'metric' ? existing.plan.fromWeek ?? 0 : Math.max(0, week)})</span><input className="input big-input" inputMode="decimal" value={d.start} onChange={(e) => set({ start: e.target.value })} aria-invalid={tried.includes(1) && !!errors.start} />{showErr('start')}</label>
                  <span className="arrow" aria-hidden="true">→</span>
                  <label className="field" style={{ flex: '1 1 140px' }}><span className="small strong">Target (week {endChoice})</span><input className="input big-input" inputMode="decimal" value={d.target} onChange={(e) => set({ target: e.target.value })} aria-invalid={tried.includes(1) && !!errors.target} />{showErr('target')}</label>
                </div>
                <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
                  <legend className="small strong" style={{ marginBottom: 8 }}>How will progress come?</legend>
                  <div className="kindcards three">
                    {SHAPES.map(([k, l, help]) => <button key={k} type="button" className="kindcard small-card" aria-pressed={d.shape === k} onClick={() => set({ shape: k })}><span className="strong">{l}</span><span className="tiny muted">{help}</span></button>)}
                  </div>
                </fieldset>
                {preview ? (
                  <figure className="card" style={{ margin: 0 }} aria-label="Plan preview">
                    <MetricChart goal={{ ...preview, plan: withPoints(preview.plan, d.points, cycle.weeks) }} weeks={cycle.weeks} week={week} series={existing ? app.checkInsOf(existing).filter((c) => c.value != null).map((c) => ({ week: c.week, value: c.value as number })) : []} forecast={null} height={170} />
                    <figcaption className="tiny muted">The blue line is the weekly plan that status is judged against.</figcaption>
                  </figure>
                ) : <p className="small muted">Enter both numbers to see the plan.</p>}
                {preview && <PlanTable plan={preview.plan} unit={unitFmt} typed={d.points} onType={(w, v) => set({ points: { ...d.points, [String(w)]: v } })} onReset={() => set({ points: {} })} />}
                {showErr('points')}
                {rebaseline && <div className="card warn small">Check-ins have started, so this re-baselines the plan from week {week}. The original stays on the chart, dotted, and the change is logged.</div>}
              </>
            )}
            {d.kind === 'range' && (
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div className="field"><span className="small strong" id="bound">Must stay</span>
                  <div className="seg" role="group" aria-labelledby="bound">
                    <button type="button" aria-pressed={d.bound === 'atMost'} onClick={() => set({ bound: 'atMost' })}>At most</button>
                    <button type="button" aria-pressed={d.bound === 'atLeast'} onClick={() => set({ bound: 'atLeast' })}>At least</button>
                  </div>
                </div>
                <label className="field" style={{ flex: '1 1 130px' }}><span className="small strong">Limit</span><input className="input big-input" inputMode="decimal" value={d.limit} onChange={(e) => set({ limit: e.target.value })} aria-invalid={tried.includes(1) && !!errors.limit} />{showErr('limit')}</label>
                <label className="field" style={{ flex: '1 1 130px' }}><span className="small strong">Warn this close</span><input className="input" inputMode="decimal" value={d.margin} onChange={(e) => set({ margin: e.target.value })} />{showErr('margin')}</label>
              </div>
            )}
            {d.kind === 'milestone' && (
              <div className="stack">
                {d.stages.map((s, i) => (
                  <div key={s.id} className="row nowrap" style={{ alignItems: 'flex-end' }}>
                    <label className="field" style={{ flex: '3 1 200px' }}><span className="small strong">Stage {i + 1}</span><input className="input" value={s.name} onChange={(e) => set({ stages: d.stages.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) })} placeholder="e.g. Threat model" /></label>
                    <label className="field" style={{ flex: '0 0 96px' }}><span className="small strong" aria-hidden="true">Week</span><input className="input" inputMode="numeric" aria-label={`Stage ${i + 1}: due week`} value={s.dueWeek} onChange={(e) => set({ stages: d.stages.map((x) => (x.id === s.id ? { ...x, dueWeek: e.target.value } : x)) })} /></label>
                    {d.stages.length > 1 && <button type="button" className="iconbtn" onClick={() => set({ stages: d.stages.filter((x) => x.id !== s.id) })} aria-label={'Remove stage ' + (i + 1)}>✕</button>}
                  </div>
                ))}
                <div><button type="button" className="btn sm" onClick={() => set({ stages: [...d.stages, { id: newId('st'), name: '', dueWeek: '' }] })}>+ Add a stage</button></div>
                {showErr('stages')}
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="qtitle big">Where does it fit?</h1>
            <label className="field"><span className="small strong">Feeds into</span>
              <select className="input" value={d.parentId} onChange={(e) => set({ parentId: e.target.value })}>
                <option value="">Nothing (top of its own tree)</option>
                {parents.map((g) => <option key={g.id} value={g.id}>{g.title}{g.level !== 'team' ? ` · ${LEVEL_LABEL[g.level]}` : ''}</option>)}
              </select>
              {!d.parentId && parents.length > 0 && <span className="hint">Goals that feed nothing and have nothing feeding them show as not linked.</span>}
            </label>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <label className="field" style={{ flex: '1 1 200px' }}><span className="small strong">Team</span>
                <select className="input" value={d.teamId} onChange={(e) => set({ teamId: e.target.value })}>{app.snapshot.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </label>
              <label className="field" style={{ flex: '1 1 200px' }}><span className="small strong">Owner · checks in weekly</span>
                <select className="input" value={d.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>{app.snapshot.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </label>
            </div>
            {d.parentId && (
              <label className="field" style={{ maxWidth: 300 }}><span className="small strong">How much will it move “{parent?.title}”? <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span>
                <input className="input" inputMode="decimal" value={d.effect} onChange={(e) => set({ effect: e.target.value })} placeholder={parent && parent.kind !== 'milestone' ? `In ${parent.unit || 'its unit'}, e.g. 3` : 'e.g. 3'} />{showErr('effect')}
              </label>
            )}
            {d.parentId && (
              <label className="field"><span className="small strong">Why do we expect it to help? <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span>
                <textarea className="input" rows={2} value={d.whyHelps} onChange={(e) => set({ whyHelps: e.target.value })} placeholder={`e.g. Faster triage means requests start sooner, which should cut “${parent?.title ?? 'its'}” time`} />
              </label>
            )}
            <div className="field"><span className="small strong" id="level-l">Level</span>
              <div className="seg full" role="group" aria-labelledby="level-l">
                {LEVEL_ORDER.map((l) => <button key={l} type="button" aria-pressed={d.level === l} onClick={() => set({ level: l })}>{LEVEL_LABEL[l]}</button>)}
              </div>
              <span className="hint">{d.level === 'team' ? 'Most goals. Flag SVP or North star only for goals reported at major reviews.' : d.level === 'svp' ? 'Reported at SVP reviews.' : 'Reported at the top. You can have several.'}</span>
            </div>
            <label className="check"><input type="checkbox" checked={d.guardrail} onChange={(e) => set({ guardrail: e.target.checked })} /><span>It’s a guardrail: protects quality while the rest moves</span></label>
            <details className="disclose"><summary>Data source and definition (optional)</summary>
              <label className="field"><span className="small strong">Data source</span><input className="input" value={d.source} onChange={(e) => set({ source: e.target.value })} placeholder="e.g. Jira intake board" /></label>
              <label className="field"><span className="small strong">Definition</span><textarea className="input" rows={2} value={d.definition} onChange={(e) => set({ definition: e.target.value })} placeholder="Exactly what is counted, so everyone reads it the same way" /></label>
            </details>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="qtitle big">Does this read right?</h1>
            <div className="summary-card">
              <span className="h3">{d.title || 'Untitled goal'}</span>
              <p>
                <strong>{owner?.name ?? 'Someone'}</strong> owns it and checks in weekly. {d.kind === 'metric' && parseNumber(d.start) != null && parseNumber(d.target) != null
                  ? <>It moves from <strong>{fmt(parseNumber(d.start)!, unitFmt)}</strong> to <strong>{fmt(parseNumber(d.target)!, unitFmt)}</strong> by week {endChoice} ({weekDates(cycle, endChoice)}), {Object.values(d.points).some((v) => v.trim()) ? 'with plan numbers set by hand' : SHAPES.find((s) => s[0] === d.shape)?.[1].toLowerCase()}.</>
                  : d.kind === 'range' && parseNumber(d.limit) != null ? <>It stays {d.bound === 'atMost' ? 'at or under' : 'at or above'} <strong>{fmt(parseNumber(d.limit)!, unitFmt)}</strong>, with a warning within {d.margin || 0}.</>
                    : d.kind === 'milestone' ? <>{d.stages.filter((s) => s.name).length} stages, the last due week {Math.max(0, ...d.stages.map((s) => parseNumber(s.dueWeek) ?? 0))}.</> : null}
              </p>
              <p className="small muted">{d.level !== 'team' ? `${LEVEL_LABEL[d.level]} level. ` : ''}{parent ? `It feeds “${parent.title}”${d.effect ? `, by about ${d.effect}${parent.kind !== 'milestone' && parent.unit ? ' ' + parent.unit : ''}` : ''}.` : 'It’s at the top of its own tree.'}{d.guardrail ? ' Guardrail.' : ''}</p>
              <div className="row">{[0, 1, 2].map((i) => <button key={i} type="button" className="linkish small" onClick={() => { setFromSummary(true); go(i); }}>Change {STEP_LABELS[i]!.toLowerCase()}</button>)}</div>
            </div>
            {[0, 1, 2].some((i) => stepErrors(i).length) && <div className="note-bad small">Something still needs fixing; publishing takes you to it.</div>}
          </>
        )}

        <div className="focus-foot">
          {step > 0 && <button type="button" className="btn" onClick={() => set({ step: step - 1 })}>Back</button>}
          <span style={{ flex: 1 }} />
          {existing && step < 3 && <button type="button" className="btn" onClick={() => void publish()} disabled={saving}>Save now</button>}
          <button className="btn primary big-btn" type="submit" disabled={saving}>{saving ? 'Saving…' : step < 3 ? 'Continue →' : existing ? 'Save changes' : 'Publish goal'}</button>
        </div>
      </form>
    </div>
  );
}
