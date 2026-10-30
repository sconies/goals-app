import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { goalDraftKey, useDraft } from '../app/drafts';
import { MIN_REASON } from '../domain/checkin';
import { pendingSummary } from '../domain/attention';
import { buildGoal, draftOf, planChanged, validateGoal, withPlanOf, type GoalDraft, type GoalErrors } from '../domain/goal';
import type { Goal, PlanShape } from '../domain/types';
import { newId } from '../data/store';
import { Empty } from '../ui/bits';

const SHAPES: [PlanShape, string][] = [['straight', 'Steady'], ['back', 'Back-loaded'], ['stepped', 'In steps']];

/** Editing an existing goal: one short screen. Once check-ins have started, a plan change goes to the sponsor. */
export function GoalEdit() {
  const app = useApp();
  const { goalId } = useParams();
  const goal = goalId ? app.goal(goalId) : undefined;
  if (!goal) return <div className="page narrow"><Empty title="This goal doesn’t exist"><Link className="btn" to="/goals">All goals</Link></Empty></div>;
  return <EditSheet key={goal.id} goal={goal} />;
}

function EditSheet({ goal }: { goal: Goal }) {
  const app = useApp();
  const nav = useNavigate();
  const { cycle, week } = app;
  const started = app.checkInsOf(goal).length > 0;
  const sponsor = app.snapshot.people.find((p) => p.profile === 'sponsor');
  const [d, set, clear, restored] = useDraft<GoalDraft & { reason: string }>(goalDraftKey(app.ws.id, goal.id) + ':edit', () => ({ ...draftOf(goal), reason: '' }));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = validateGoal(d, cycle);
  const err = (k: keyof GoalErrors) => tried && errors[k] ? <span className="tiny tone-off" role="alert">{errors[k]}</span> : null;
  const valid = Object.keys(errors).length === 0;
  const built = valid ? buildGoal(d, cycle, { id: goal.id, createdAt: goal.createdAt }, goal, false, week) : null;
  const proposing = !!built && started && planChanged(goal, built);
  const reasonOk = d.reason.trim().length >= MIN_REASON;
  const parents = app.snapshot.goals.filter((g) => g.id !== goal.id && (g.headline || !g.parentId));
  const parent = app.goal(d.parentId);
  const back = () => nav('/goals/' + goal.id);

  const save = async () => {
    setTried(true);
    if (!built || saving || (proposing && !reasonOk)) return;
    setSaving(true);
    try {
      const basics: Goal = { ...withPlanOf(built, goal), pending: goal.pending ?? null };
      const basicsChanged = JSON.stringify(basics) !== JSON.stringify({ ...goal, pending: goal.pending ?? null });
      if (basicsChanged) await app.saveGoal(basics, goal);
      if (proposing) {
        await app.proposeChange(basics, withPlanOf(basics, built), d.reason);
        app.toast(`Proposed. ${sponsor ? sponsor.name.split(' ')[0] : 'The sponsor'} sees it in the weekly review.`);
      } else app.toast(basicsChanged ? 'Saved. The change is in the goal’s activity.' : 'Nothing changed.');
      clear();
      back();
    } catch {
      setSaving(false);
    }
  };

  const label = saving ? 'Saving…' : !valid && tried ? 'Fix the highlighted fields' : proposing ? 'Propose change' : 'Save changes';

  return (
    <div className="focus">
      <div className="focus-top">
        <span className="field-label">Edit goal</span>
        <span />
        <button className="iconbtn" onClick={back} aria-label="Close and keep the draft">✕</button>
      </div>
      <form className="focus-body" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        {restored && <div className="restored small">Restored your unsaved edits. <button type="button" className="linkish" onClick={() => { clear(); window.location.reload(); }}>Discard them</button></div>}
        {goal.pending && (
          <div className="pending-note" role="status">
            <span className="grow">
              <strong>{pendingSummary(goal)}</strong>
              <span className="hint">Proposed, waiting for {sponsor?.name.split(' ')[0] ?? 'the sponsor'}. Proposing again replaces it.</span>
            </span>
            <button type="button" className="linkish tap" onClick={() => void app.withdrawChange(goal).then(() => app.toast('Proposal withdrawn.'))}>Withdraw</button>
          </div>
        )}

        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={tried && !!errors.title} />
          {err('title')}
        </label>

        <section className="stack" style={{ gap: 'var(--s4)' }} aria-labelledby="plan-h">
          <div className="stack" style={{ gap: 'var(--s1)' }}>
            <h2 className="block-title" id="plan-h">{goal.kind === 'metric' ? 'Plan' : goal.kind === 'range' ? 'Limit' : 'Stages'}</h2>
            {started && <span className="hint">Check-ins have started, so a change here goes to {sponsor?.name.split(' ')[0] ?? 'the sponsor'} to approve.</span>}
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
          {proposing && (
            <label className="field">
              <span className="field-label">Why change it?</span>
              <textarea className={'input' + (tried && !reasonOk ? ' invalid' : '')} rows={2} value={d.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="One sentence the sponsor can decide on" aria-label="Why change it?" />
              {tried && !reasonOk ? <span className="hint tone-off" role="alert">Say why, in a sentence, so the sponsor can decide.</span> : <span className="hint">The current plan stays until it’s approved.</span>}
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
          {!d.headline && (
            <label className="field"><span className="field-label">Feeds into</span>
              <select className="input" value={d.parentId} onChange={(e) => set({ parentId: e.target.value })}>
                <option value="">Nothing (stands alone)</option>
                {parents.map((g) => <option key={g.id} value={g.id}>{g.title}{g.headline ? ' · headline' : ''}</option>)}
              </select>
            </label>
          )}
          <details className="disclose"><summary>More details</summary>
            {!d.headline && d.parentId && (
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
          <button className="btn primary big-btn" type="submit" aria-disabled={saving || (tried && (!valid || (proposing && !reasonOk)))}>{label}</button>
        </div>
      </form>
    </div>
  );
}
