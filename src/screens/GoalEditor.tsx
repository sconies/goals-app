import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { parseNumber } from '../domain/checkin';
import { blankGoal, buildGoal, draftOf, validateGoal, type GoalDraft, type GoalErrors } from '../domain/goal';
import type { Goal, GoalKind, MetricGoal, PlanShape } from '../domain/types';
import { newId } from '../data/store';
import { Header } from '../ui/bits';
import { MetricChart } from '../ui/charts';

const KINDS: [GoalKind, string, string][] = [
  ['metric', 'Move a metric', 'A number goes from a start to a target, along a plan'],
  ['range', 'Keep within a range', 'A guardrail that must stay under or over a limit'],
  ['milestone', 'Milestone', 'Dated stages that get done'],
];
const SHAPES: [PlanShape, string][] = [['straight', 'Straight line'], ['back', 'Back-loaded'], ['stepped', 'Three steps']];

export function GoalEditor() {
  const app = useApp();
  const { goalId } = useParams();
  const existing = goalId ? app.goal(goalId) : undefined;
  if (goalId && !existing) return <Header title="Goal not found" />;
  return <Editor key={goalId ?? 'new'} existing={existing ?? null} />;
}

function Editor({ existing }: { existing: Goal | null }) {
  const app = useApp();
  const nav = useNavigate();
  const { cycle, week } = app;
  const started = existing ? app.checkInsOf(existing).length > 0 : false;
  const headline = app.snapshot.goals.find((g) => g.headline && g.id !== existing?.id);
  const [d, setD] = useState<GoalDraft>(() => existing ? draftOf(existing) : blankGoal(app.viewer.teamId ?? app.snapshot.teams[0]?.id ?? '', app.viewer.id, headline?.id ?? ''));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<GoalDraft>) => setD((x) => ({ ...x, ...p }));
  const errors: GoalErrors = validateGoal(d, cycle);
  const err = (k: keyof GoalErrors) => (tried && errors[k] ? <span className="tiny tone-off" role="alert">{errors[k]}</span> : null);
  const parents = app.snapshot.goals.filter((g) => g.id !== existing?.id && (g.headline || !g.parentId));

  const preview: MetricGoal | null = (() => {
    const s = parseNumber(d.start), t = parseNumber(d.target), dp = parseNumber(d.decimals);
    if (d.kind !== 'metric' || s == null || t == null || s === t) return null;
    const prev = existing?.kind === 'metric' ? existing : null;
    const changed = prev && (prev.plan.start !== s || prev.plan.target !== t || prev.plan.shape !== d.shape);
    return {
      id: 'preview', cycleId: cycle.id, teamId: d.teamId, ownerId: d.ownerId, title: d.title || 'New goal', io: d.io, headline: d.headline, guardrail: d.guardrail,
      parentId: null, effect: null, source: '', definition: '', createdAt: '', kind: 'metric', unit: d.unit, decimals: dp ?? 0,
      plan: { start: s, target: t, shape: d.shape },
      originalPlan: prev && started && changed ? prev.originalPlan ?? prev.plan : prev?.originalPlan ?? null, rebaselinedWeek: null,
    };
  })();
  const rebaseline = existing?.kind === 'metric' && started && preview && (existing.plan.start !== preview.plan.start || existing.plan.target !== preview.plan.target || existing.plan.shape !== preview.plan.shape);

  const save = async () => {
    setTried(true);
    if (Object.keys(errors).length || saving) return;
    setSaving(true);
    const g = buildGoal(d, cycle, { id: existing?.id ?? newId('goal'), createdAt: existing?.createdAt ?? new Date().toISOString() }, existing, started, week);
    await app.saveGoal(g);
    nav('/goals/' + g.id);
  };

  return (
    <>
      <Header eyebrow={cycle.name} title={existing ? 'Edit goal' : 'New goal'} actions={<Link className="btn" to={existing ? '/goals/' + existing.id : '/goals'}>Cancel</Link>} />
      <form className="split" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <div className="main" style={{ maxWidth: 860 }}>
          <section className="stack" style={{ gap: 14 }}>
            <h2 className="h2">What the goal is</h2>
            <label className="field">
              <span>Name</span>
              <input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Requests triaged within 2 days" aria-invalid={tried && !!errors.title} />
              {err('title')}
            </label>
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="strong" style={{ padding: 0, marginBottom: 8 }}>Type</legend>
              <div className="grid wide">
                {KINDS.map(([k, l, help]) => (
                  <button key={k} type="button" className="inputcard" aria-pressed={d.kind === k} disabled={started && existing?.kind !== k} onClick={() => set({ kind: k, unit: k === 'range' && d.unit === '%' ? '%' : d.unit })}>
                    <span className="strong">{l}</span><span className="small muted">{help}</span>
                  </button>
                ))}
              </div>
              {started && <span className="tiny muted">The type can’t change once check-ins have started.</span>}
            </fieldset>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <label className="field" style={{ flex: '1 1 200px' }}>
                <span>Team</span>
                <select className="input" value={d.teamId} onChange={(e) => set({ teamId: e.target.value })}>
                  {app.snapshot.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label className="field" style={{ flex: '1 1 200px' }}>
                <span>Owner</span>
                <select className="input" value={d.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>
                  {app.snapshot.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <span className="tiny muted">One owner, who checks in weekly.</span>
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={d.headline} onChange={(e) => set({ headline: e.target.checked })} />
              <span>This is the cycle’s headline goal (the output everything else feeds)</span>
            </label>
            {!d.headline && (
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <label className="field" style={{ flex: '2 1 260px' }}>
                  <span>Feeds into</span>
                  <select className="input" value={d.parentId} onChange={(e) => set({ parentId: e.target.value })}>
                    <option value="">Nothing (stands alone)</option>
                    {parents.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </label>
                <label className="field" style={{ flex: '1 1 160px' }}>
                  <span>Estimated effect <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span>
                  <input className="input" inputMode="decimal" value={d.effect} onChange={(e) => set({ effect: e.target.value })} placeholder="e.g. 3" />
                  <span className="tiny muted">In the parent’s unit, e.g. days off.</span>
                  {err('effect')}
                </label>
                <fieldset className="field" style={{ border: 0, padding: 0, margin: 0, flex: '1 1 200px' }}>
                  <legend className="strong" style={{ padding: 0, marginBottom: 6 }}>Role</legend>
                  <div className="seg" role="group">
                    <button type="button" aria-pressed={d.io === 'input'} onClick={() => set({ io: 'input' })}>Input</button>
                    <button type="button" aria-pressed={d.io === 'output'} onClick={() => set({ io: 'output' })}>Output</button>
                  </div>
                  <label className="check"><input type="checkbox" checked={d.guardrail} onChange={(e) => set({ guardrail: e.target.checked })} /><span>Guardrail</span></label>
                </fieldset>
              </div>
            )}
          </section>

          <section className="stack" style={{ gap: 14 }}>
            <h2 className="h2">{d.kind === 'milestone' ? 'Stages' : d.kind === 'range' ? 'The range' : 'The plan'}</h2>
            {d.kind !== 'milestone' && (
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <label className="field" style={{ flex: '0 1 140px' }}>
                  <span>Unit</span>
                  <input className="input" value={d.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="%, days, ms" />
                </label>
                <label className="field" style={{ flex: '0 1 120px' }}>
                  <span>Decimals</span>
                  <input className="input" inputMode="numeric" value={d.decimals} onChange={(e) => set({ decimals: e.target.value })} />
                  {err('decimals')}
                </label>
              </div>
            )}
            {d.kind === 'metric' && (
              <>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <label className="field" style={{ flex: '1 1 160px' }}>
                    <span>Start (week 0)</span>
                    <input className="input" inputMode="decimal" value={d.start} onChange={(e) => set({ start: e.target.value })} aria-invalid={tried && !!errors.start} />
                    {err('start')}
                  </label>
                  <label className="field" style={{ flex: '1 1 160px' }}>
                    <span>Target (week {cycle.weeks})</span>
                    <input className="input" inputMode="decimal" value={d.target} onChange={(e) => set({ target: e.target.value })} aria-invalid={tried && !!errors.target} />
                    {err('target')}
                  </label>
                </div>
                <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="strong" style={{ padding: 0, marginBottom: 8 }}>Plan shape</legend>
                  <div className="seg" role="group">
                    {SHAPES.map(([k, l]) => <button key={k} type="button" aria-pressed={d.shape === k} onClick={() => set({ shape: k })}>{l}</button>)}
                  </div>
                  <span className="tiny muted">The plan sets the weekly checkpoints that status is judged against. Back-loaded suits work that lands mid-cycle.</span>
                </fieldset>
                {preview ? (
                  <figure className="card" style={{ margin: 0, padding: 12 }} aria-label="Plan preview">
                    <MetricChart goal={preview} weeks={cycle.weeks} week={week} series={existing ? app.checkInsOf(existing).filter((c) => c.value != null).map((c) => ({ week: c.week, value: c.value as number })) : []} forecast={null} height={200} />
                  </figure>
                ) : <p className="small muted">Enter a start and a target to see the plan.</p>}
                {rebaseline && <div className="card warn small">Check-ins have started, so saving re-baselines the plan from week {week}. The original plan stays on the goal page, dotted.</div>}
              </>
            )}
            {d.kind === 'range' && (
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="strong" style={{ padding: 0, marginBottom: 6 }}>Must stay</legend>
                  <div className="seg" role="group">
                    <button type="button" aria-pressed={d.bound === 'atMost'} onClick={() => set({ bound: 'atMost' })}>At most</button>
                    <button type="button" aria-pressed={d.bound === 'atLeast'} onClick={() => set({ bound: 'atLeast' })}>At least</button>
                  </div>
                </fieldset>
                <label className="field" style={{ flex: '1 1 140px' }}>
                  <span>Limit</span>
                  <input className="input" inputMode="decimal" value={d.limit} onChange={(e) => set({ limit: e.target.value })} aria-invalid={tried && !!errors.limit} />
                  {err('limit')}
                </label>
                <label className="field" style={{ flex: '1 1 140px' }}>
                  <span>Warning margin</span>
                  <input className="input" inputMode="decimal" value={d.margin} onChange={(e) => set({ margin: e.target.value })} />
                  <span className="tiny muted">This close to the limit counts as at risk.</span>
                  {err('margin')}
                </label>
              </div>
            )}
            {d.kind === 'milestone' && (
              <div className="stack">
                {d.stages.map((s, i) => (
                  <div key={s.id} className="row" style={{ alignItems: 'flex-end' }}>
                    <label className="field" style={{ flex: '3 1 220px' }}>
                      <span className="small">Stage {i + 1}</span>
                      <input className="input" value={s.name} onChange={(e) => set({ stages: d.stages.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) })} placeholder="e.g. Threat model" />
                    </label>
                    <label className="field" style={{ flex: '1 1 110px' }}>
                      <span className="small">Due week</span>
                      <input className="input" inputMode="numeric" value={s.dueWeek} onChange={(e) => set({ stages: d.stages.map((x) => (x.id === s.id ? { ...x, dueWeek: e.target.value } : x)) })} />
                    </label>
                    {d.stages.length > 1 && (!started || !existing || existing.kind !== 'milestone' || !existing.stages.some((x) => x.id === s.id)) && (
                      <button type="button" className="btn sm" onClick={() => set({ stages: d.stages.filter((x) => x.id !== s.id) })} aria-label={'Remove stage ' + (i + 1)}>Remove</button>
                    )}
                  </div>
                ))}
                <div><button type="button" className="btn sm" onClick={() => set({ stages: [...d.stages, { id: newId('st'), name: '', dueWeek: '' }] })}>Add a stage</button></div>
                {err('stages')}
              </div>
            )}
          </section>

          <section className="stack" style={{ gap: 14 }}>
            <h2 className="h2">Where the number comes from</h2>
            <label className="field">
              <span>Data source <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span>
              <input className="input" value={d.source} onChange={(e) => set({ source: e.target.value })} placeholder="e.g. Jira intake board" />
            </label>
            <label className="field">
              <span>Definition <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span>
              <textarea className="input" rows={2} value={d.definition} onChange={(e) => set({ definition: e.target.value })} placeholder="Exactly what is counted, so everyone reads it the same way" />
            </label>
          </section>

          <div className="row between" style={{ paddingTop: 12, borderTop: '1px solid var(--line-2)' }}>
            <span className={'small strong ' + (tried && Object.keys(errors).length ? 'tone-off' : 'muted')} role="status">
              {tried && Object.keys(errors).length ? 'Fix the highlighted fields to save.' : existing ? 'Changes apply straight away.' : 'Publishing makes it visible to everyone.'}
            </span>
            <button className="btn primary" type="submit" aria-disabled={saving}>{saving ? 'Saving…' : existing ? 'Save goal' : 'Publish goal'}</button>
          </div>
        </div>
      </form>
    </>
  );
}
