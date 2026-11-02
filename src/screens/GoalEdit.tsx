import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { dueOptions } from '../domain/year';
import { goalDraftKey, useDraft } from '../app/drafts';
import { MIN_REASON } from '../domain/checkin';
import { LEVEL_LABEL } from '../domain/format';
import { buildGoal, draftOf, planChanged, validateGoal, type GoalDraft, type GoalErrors } from '../domain/goal';
import type { Goal, Level, PlanShape } from '../domain/types';
import { newId } from '../data/store';
import { Empty } from '../ui/bits';
import { PlanTable } from '../ui/PlanTable';
import { weekDates, yearEndWeek } from '../domain/plan';
import { parseNumber } from '../domain/checkin';

const SHAPES: [PlanShape, string][] = [['straight', 'Steady'], ['back', 'Back-loaded'], ['stepped', 'In steps']];
const LEVELS: [Level, string][] = [['team', 'Most goals'], ['svp', 'Reported at SVP reviews'], ['north-star', 'Reported at the top']];

/** Editing an existing goal: one short screen, for its owner or an admin. Once check-ins have started, a plan change needs a reason and is flagged. */
export function GoalEdit() {
  const app = useApp();
  const { goalId } = useParams();
  const goal = goalId ? app.goal(goalId) : undefined;
  if (!goal) return <div className="page narrow"><Empty title="This goal doesn’t exist"><Link className="btn" to="/goals">All goals</Link></Empty></div>;
  if (goal.ownerId !== app.viewer.id && !app.viewer.admin) {
    const owner = app.person(goal.ownerId);
    return <div className="page narrow"><Empty title="Only its owner can change this goal"><span className="muted">{owner ? `${owner.name} owns it.` : ''} You can watch it and comment.</span><Link className="btn" to={'/goals/' + goal.id}>Back to the goal</Link></Empty></div>;
  }
  return <EditSheet key={goal.id} goal={goal} />;
}

function EditSheet({ goal }: { goal: Goal }) {
  const app = useApp();
  const nav = useNavigate();
  const { cycle, week } = app;
  const started = app.checkInsOf(goal).length > 0;
  const [d, set, clear, restored] = useDraft<GoalDraft & { reason: string }>(goalDraftKey(app.ws.id, goal.id) + ':edit', () => ({ ...draftOf(goal), reason: '' }));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = validateGoal(d, cycle);
  const err = (k: keyof GoalErrors) => tried && errors[k] ? <span className="tiny tone-off" role="alert">{errors[k]}</span> : null;
  const valid = Object.keys(errors).length === 0;
  const built = valid ? buildGoal(d, cycle, { id: goal.id, createdAt: goal.createdAt }, goal, started, week) : null;
  const replanning = !!built && started && planChanged(goal, built);
  // When the target is due, and the plan from the shape (before any numbers typed by hand), for the plan table.
  const yearEnd = yearEndWeek(cycle);
  const endOptions = dueOptions(cycle, week, yearEnd);
  const endChoice = parseNumber(d.endWeek) ?? cycle.weeks;
  const shapedPlan = goal.kind === 'metric' && parseNumber(d.start) != null && parseNumber(d.target) != null && parseNumber(d.start) !== parseNumber(d.target)
    ? { start: parseNumber(d.start) as number, target: parseNumber(d.target) as number, shape: d.shape, ...(goal.plan.fromWeek ? { fromWeek: goal.plan.fromWeek } : {}), ...(endChoice !== cycle.weeks ? { endWeek: endChoice } : {}) }
    : null;
  const reasonOk = d.reason.trim().length >= MIN_REASON;
  const below = new Set<string>();
  const walk = (id: string) => { for (const c of app.snapshot.goals.filter((g) => g.parentId === id)) { if (below.has(c.id) || c.id === goal.id) continue; below.add(c.id); walk(c.id); } };
  walk(goal.id);
  const parents = app.snapshot.goals.filter((g) => g.id !== goal.id && !below.has(g.id));
  const parent = app.goal(d.parentId);
  const back = () => nav('/goals/' + goal.id);

  const save = async () => {
    setTried(true);
    if (!built || saving || (replanning && !reasonOk)) return;
    setSaving(true);
    try {
      const after: Goal = { ...built, pending: null };
      const changed = JSON.stringify(after) !== JSON.stringify({ ...goal, pending: null });
      if (changed) await app.saveGoal(after, goal, replanning ? d.reason.trim() : undefined);
      app.toast(!changed ? 'Nothing changed.' : replanning ? 'Saved. The plan change and your reason are in the goal’s activity.' : 'Saved.');
      clear();
      back();
    } catch {
      setSaving(false);
    }
  };

  const label = saving ? 'Saving…' : !valid && tried ? 'Fix the highlighted fields' : 'Save changes';

  return (
    <div className="focus">
      <div className="focus-top">
        <span className="field-label">Edit goal</span>
        <span />
        <button className="iconbtn" onClick={back} aria-label="Close and keep the draft">✕</button>
      </div>
      <form className="focus-body" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        {restored && <div className="restored small">Restored your unsaved edits. <button type="button" className="linkish" onClick={() => { clear(); window.location.reload(); }}>Discard them</button></div>}
        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={tried && !!errors.title} />
          {err('title')}
        </label>

        <section className="stack" style={{ gap: 'var(--s4)' }} aria-labelledby="plan-h">
          <div className="stack" style={{ gap: 'var(--s1)' }}>
            <h2 className="block-title" id="plan-h">{goal.kind === 'metric' ? 'Plan' : goal.kind === 'range' ? 'Limit' : 'Stages'}</h2>
            {started && <span className="hint">Check-ins have started, so a change here needs a reason. Watchers see it flagged.</span>}
          </div>
          {goal.kind === 'metric' && (
            <>
              <div className="pair">
                <label className="field"><span className="field-label">Start{d.unit ? ` (${d.unit})` : ''}</span><input className="input" inputMode="decimal" value={d.start} onChange={(e) => set({ start: e.target.value })} aria-invalid={tried && !!errors.start} />{err('start')}</label>
                <label className="field"><span className="field-label">Target{d.unit ? ` (${d.unit})` : ''}</span><input className="input" inputMode="decimal" value={d.target} onChange={(e) => set({ target: e.target.value })} aria-invalid={tried && !!errors.target} />{err('target')}</label>
              </div>
              <div className="field"><span className="field-label" id="shape-l">How progress comes</span>
                <div className="seg full" role="group" aria-labelledby="shape-l">
                  {SHAPES.map(([k, l]) => <button key={k} type="button" aria-pressed={d.shape === k} onClick={() => set({ shape: k })}>{l}</button>)}
                </div>
              </div>
              <div className="field"><span className="field-label" id="end-l">When it’s due</span>
                <div className="seg full" role="group" aria-labelledby="end-l">
                  {endOptions.map(([w, l]) => <button key={w} type="button" aria-pressed={endChoice === w} onClick={() => set({ endWeek: w === cycle.weeks ? '' : String(w), points: {} })}>{l}</button>)}
                </div>
                <span className="hint">Week {endChoice}, {weekDates(cycle, endChoice)}.</span>
              </div>
              {shapedPlan && <PlanTable plan={shapedPlan} unit={{ unit: d.unit, decimals: parseNumber(d.decimals) ?? 0 }} typed={d.points} onType={(w, v) => set({ points: { ...d.points, [String(w)]: v } })} onReset={() => set({ points: {} })} />}
              {err('points')}
            </>
          )}
          {goal.kind === 'range' && (
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="field"><span className="field-label" id="bound">Must stay</span>
                <div className="seg" role="group" aria-labelledby="bound">
                  <button type="button" aria-pressed={d.bound === 'atMost'} onClick={() => set({ bound: 'atMost' })}>At most</button>
                  <button type="button" aria-pressed={d.bound === 'atLeast'} onClick={() => set({ bound: 'atLeast' })}>At least</button>
                </div>
              </div>
              <label className="field" style={{ flex: '1 1 110px' }}><span className="field-label">Limit</span><input className="input" inputMode="decimal" value={d.limit} onChange={(e) => set({ limit: e.target.value })} aria-invalid={tried && !!errors.limit} />{err('limit')}</label>
              <label className="field" style={{ flex: '1 1 110px' }}><span className="field-label">Warn this close</span><input className="input" inputMode="decimal" value={d.margin} onChange={(e) => set({ margin: e.target.value })} />{err('margin')}</label>
            </div>
          )}
          {goal.kind === 'milestone' && (
            <div className="stack" style={{ gap: 8 }}>
              {d.stages.map((s, i) => (
                <div key={s.id} className="row nowrap" style={{ alignItems: 'flex-end' }}>
                  <label className="field" style={{ flex: '3 1 180px' }}><span className="sr">Stage {i + 1}</span><input className="input" value={s.name} aria-label={'Stage ' + (i + 1)} onChange={(e) => set({ stages: d.stages.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) })} placeholder="Stage name" /></label>
                  <label className="field" style={{ flex: '0 0 84px' }}><span className="sr">Due week</span><input className="input" inputMode="numeric" aria-label={'Stage ' + (i + 1) + ' due week'} value={s.dueWeek} onChange={(e) => set({ stages: d.stages.map((x) => (x.id === s.id ? { ...x, dueWeek: e.target.value } : x)) })} placeholder="Week" /></label>
                  {d.stages.length > 1 && <button type="button" className="iconbtn" onClick={() => set({ stages: d.stages.filter((x) => x.id !== s.id) })} aria-label={'Remove stage ' + (i + 1)}>✕</button>}
                </div>
              ))}
              <div><button type="button" className="btn sm" onClick={() => set({ stages: [...d.stages, { id: newId('st'), name: '', dueWeek: '' }] })}>+ Add a stage</button></div>
              {err('stages')}
            </div>
          )}
          {replanning && (
            <label className="field">
              <span className="field-label">Why change it?</span>
              <textarea className={'input' + (tried && !reasonOk ? ' invalid' : '')} rows={2} value={d.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. The vendor contract moved the start to week 6" aria-label="Why change it?" />
              {tried && !reasonOk ? <span className="hint tone-off" role="alert">Say why, in a sentence. People watching this goal will see it.</span> : <span className="hint">The original plan stays on the chart, dotted.</span>}
            </label>
          )}
        </section>

        <section className="stack" style={{ gap: 'var(--s4)' }} aria-labelledby="fit-h">
          <h2 className="block-title" id="fit-h">Owner and links</h2>
          <div className="pair">
            <label className="field"><span className="field-label">Owner</span>
              <select className="input" value={d.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>{app.snapshot.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
            <label className="field"><span className="field-label">Team</span>
              <select className="input" value={d.teamId} onChange={(e) => set({ teamId: e.target.value })}>{app.snapshot.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </label>
          </div>
          <div className="field"><span className="field-label" id="level-l">Level</span>
            <div className="optlist" role="radiogroup" aria-labelledby="level-l">
              {LEVELS.map(([l, hint]) => <button key={l} type="button" role="radio" className="opt" aria-checked={d.level === l} onClick={() => set({ level: l })}><span>{LEVEL_LABEL[l]}</span><span className="hint">{hint}</span></button>)}
            </div>
          </div>
          {(
            <label className="field"><span className="field-label">Feeds into</span>
              <select className="input" value={d.parentId} onChange={(e) => set({ parentId: e.target.value })}>
                <option value="">Nothing (top of its tree, or not linked yet)</option>
                {parents.map((g) => <option key={g.id} value={g.id}>{g.title}{g.level !== 'team' ? ` · ${LEVEL_LABEL[g.level]}` : ''}</option>)}
              </select>
            </label>
          )}
          <div className="field"><span className="field-label">Also helps <span className="hint">optional · a dotted line on the map</span></span>
            {(d.alsoHelps ?? []).length > 0 && (
              <span className="row" style={{ gap: 'var(--s2)' }}>{(d.alsoHelps ?? []).map((id) => (
                <span key={id} className="chip tag">{app.goal(id)?.title ?? id} <button type="button" className="linkish small" aria-label={`Remove ${app.goal(id)?.title ?? id}`} onClick={() => set({ alsoHelps: (d.alsoHelps ?? []).filter((x) => x !== id) })}>✕</button></span>
              ))}</span>
            )}
            <select className="input" value="" aria-label="Add a goal it also helps" onChange={(e) => e.target.value && set({ alsoHelps: [...(d.alsoHelps ?? []), e.target.value] })}>
              <option value="">Add a goal it also helps…</option>
              {app.snapshot.goals.filter((g) => g.id !== goal.id && g.id !== d.parentId && !(d.alsoHelps ?? []).includes(g.id)).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
          {d.parentId && (
            <label className="field"><span className="field-label">Why do we expect it to help? <span className="hint">optional</span></span>
              <textarea className="input" rows={2} value={d.whyHelps} onChange={(e) => set({ whyHelps: e.target.value })} placeholder="What should change in the goal it feeds, and why" />
            </label>
          )}
          <details className="disclose"><summary>More details</summary>
            {d.parentId && (
              <label className="field" style={{ maxWidth: 300 }}><span className="field-label">How much it moves “{parent?.title}”</span>
                <input className="input" inputMode="decimal" value={d.effect} onChange={(e) => set({ effect: e.target.value })} />{err('effect')}
              </label>
            )}
            <label className="check"><input type="checkbox" checked={d.guardrail} onChange={(e) => set({ guardrail: e.target.checked })} /><span>It’s a guardrail</span></label>
            <label className="field"><span className="field-label">Data source</span><input className="input" value={d.source} onChange={(e) => set({ source: e.target.value })} /></label>
            <label className="field"><span className="field-label">Definition</span><textarea className="input" rows={2} value={d.definition} onChange={(e) => set({ definition: e.target.value })} /></label>
          </details>
        </section>

        <div className="focus-foot">
          <button className="btn primary big-btn" type="submit" aria-disabled={saving || (tried && (!valid || (replanning && !reasonOk)))}>{label}</button>
        </div>
      </form>
    </div>
  );
}
