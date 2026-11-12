import { sameTitleNote } from '../domain/people';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { dueOptions } from '../domain/year';
import { goalDraftKey, useDraft } from '../app/drafts';
import { MIN_REASON } from '../domain/checkin';
import { buildGoal, draftOf, planHint, planChanged, planQuestion, validateGoal, type GoalDraft, type GoalErrors } from '../domain/goal';
import type { Goal, PlanShape } from '../domain/types';
import { newId } from '../data/store';
import { Empty } from '../ui/bits';
import { PlanTable } from '../ui/PlanTable';
import { DueField, FieldError, LevelField, StageFields } from '../ui/GoalFields';
import { weekDates, yearEndWeek } from '../domain/plan';
import { parseNumber } from '../domain/checkin';
import { Icon } from '../ui/Icon';
import { goalChange } from '../domain/changes';
import { BackLink } from '../ui/BackLink';
import { Place, type MeasurePick } from '../core/app';
import { Pick, PickOne } from '../ui/Pick';

const SHAPES: [PlanShape, string][] = [['straight', 'Steady'], ['back', 'Back-loaded'], ['stepped', 'In steps']];

/**
 * Editing an existing goal: one short screen, for its owner or an admin. Once check-ins have started, a plan change needs
 * a reason and is flagged. The goal page's "Change this goal" opens one part of it (`?part=definition`, `plan` or
 * `owner`), and a change made there always asks why: the reason goes in the goal's activity for everyone watching.
 */
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
  const [params] = useSearchParams();
  const partParam = params.get('part');
  const part = partParam === 'definition' || partParam === 'plan' || partParam === 'owner' ? partParam : null;
  const show = (p: 'definition' | 'plan' | 'owner') => !part || part === p;
  const errors = validateGoal(d, cycle, goal);
  const err = (k: keyof GoalErrors) => tried && errors[k] ? <FieldError>{errors[k]}</FieldError> : null;
  const valid = Object.keys(errors).length === 0;
  const built = valid ? buildGoal(d, cycle, { id: goal.id, createdAt: goal.createdAt }, goal, started, week) : null;
  const replanning = !!built && started && planChanged(goal, built);
  // Something people would see changed: what the change log would record (changes.ts), not every field the form rebuilds.
  const edited = !!built && goalChange(goal, built, app.lookup, app.viewer.id, '', '') != null;
  // A change made from one part of "Change this goal" says why, whatever it changes.
  const needReason = replanning || (!!part && edited);
  // A target that flips which way is better, or a number far outside the plan, is confirmed before it's saved (domain/goal
  // planQuestion). The yes answers that question only: change the numbers again and it's asked again.
  const question = built ? planQuestion(goal, built) : null;
  const [yesTo, setYesTo] = useState('');
  const confirmed = !question || yesTo === question.text;
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
  const parent = app.goal(d.parentId);
  const back = () => nav('/goals/' + goal.id);

  // What measures the goal, when a module offers it (the goal.measure place): saved after the goal.
  const [measure, setMeasure] = useState<MeasurePick | undefined>(undefined);
  const save = async () => {
    setTried(true);
    if (!built || saving || (needReason && !reasonOk) || !confirmed || measure?.blocks) return;
    setSaving(true);
    try {
      const after: Goal = { ...built, pending: null };
      const changed = JSON.stringify(after) !== JSON.stringify({ ...goal, pending: null });
      if (changed) await app.saveGoal(after, goal, needReason ? d.reason.trim() : undefined);
      if (measure) await app.run(measure.action, measure.input(after));
      app.toast(!changed && measure === undefined ? 'Nothing changed.' : replanning ? 'Saved. The plan change and your reason are in the goal’s activity.' : needReason ? 'Saved. The change and your reason are in the goal’s activity.' : 'Saved.');
      clear();
      back();
    } catch {
      setSaving(false);
    }
  };

  const label = saving ? 'Saving…' : !valid && tried ? 'Fix the highlighted fields' : 'Save changes';
  // Asked right under what changed (the numbers), not at the bottom of the section.
  const reasonField = needReason && (
    <label className="field reason-field">
      <span className="field-label">Why change it?</span>
      <textarea className={'input' + (tried && !reasonOk ? ' invalid' : '')} rows={2} value={d.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. The vendor contract moved the start to week 6" aria-label="Why change it?" />
      {tried && !reasonOk ? <FieldError>Say why, in a sentence. People watching this goal will see it.</FieldError> : <span className="hint">{replanning ? 'The original plan stays on the chart, dotted.' : 'It goes in the goal’s activity for everyone watching.'}</span>}
    </label>
  );

  return (
    <div className="focus goal-form goal-edit">
      <div className="focus-top">
        <BackLink to={'/goals/' + goal.id} label={goal.title} />
        <span />
        <button className="iconbtn" onClick={back} aria-label="Close and keep the draft"><Icon name="close" /></button>
      </div>
      <form className="focus-body" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <h1 className="qtitle big">{part === 'definition' ? `Improve the definition: ${goal.title}` : part === 'plan' ? `Change the ${goal.kind === 'metric' ? 'plan or target' : goal.kind === 'range' ? 'limit' : 'stages'}: ${goal.title}` : part === 'owner' ? `Change the owner or level: ${goal.title}` : `Edit ${goal.title}`}</h1>
        {restored && <div className="restored small">Restored your unsaved edits. <button type="button" className="linkish" onClick={() => { clear(); window.location.reload(); }}>Discard them</button></div>}
        {show('definition') && (
        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={tried && !!errors.title} />
          {err('title')}
          {!errors.title && d.title.trim() !== goal.title && (() => { const twin = sameTitleNote(d.title, goal.id, app.snapshot.goals, (id) => app.team(id)?.name ?? ''); return twin ? <span className="hint tone-risk" role="status">{twin}</span> : null; })()}
        </label>
        )}
        {show('definition') && <Place name="goal.measure" goal={goal} kind={goal.kind} unit={d.unit} decimals={d.decimals} teamId={d.teamId} onChange={setMeasure} />}
        {part === 'definition' && (
          <>
            <label className="field"><span className="field-label">How it’s measured</span><textarea className="input" rows={3} value={d.definition} onChange={(e) => set({ definition: e.target.value })} placeholder="What counts, over what period, and anything left out" /></label>
            <label className="field"><span className="field-label">Where the number comes from</span><input className="input" value={d.source} onChange={(e) => set({ source: e.target.value })} /></label>
            {reasonField}
          </>
        )}

        {show('plan') && <section className="stack" style={{ gap: 'var(--s4)' }} aria-labelledby="plan-h">
          <div className="stack" style={{ gap: 'var(--s1)' }}>
            <h2 className="block-title" id="plan-h">{goal.kind === 'metric' ? 'Plan' : goal.kind === 'range' ? 'Limit' : 'Stages'}</h2>
            {started && <span className="hint">Check-ins have started, so a change here needs a reason. Watchers see it flagged.</span>}
          </div>
          {goal.kind === 'metric' && (
            <>
              <div className="pair">
                <label className="field"><span className="field-label">Start{d.unit ? ` (${d.unit})` : ''}</span><input className="input" inputMode="decimal" value={d.start} onChange={(e) => set({ start: e.target.value })} aria-invalid={tried && !!errors.start} />{err('start')}</label>
                <label className="field"><span className="field-label">Target{d.unit ? ` (${d.unit})` : ''}</span><input className="input" inputMode="decimal" value={d.target} onChange={(e) => set({ target: e.target.value })} aria-invalid={tried && !!errors.target} />{err('target')}{planHint(d) && <span className="hint tone-risk" role="status">{planHint(d)}</span>}</label>
              </div>
              {question && (
                <div className={'field plan-question' + (tried && !confirmed ? ' invalid' : '')} role={tried && !confirmed ? 'alert' : 'status'}>
                  <span className="hint tone-risk">{question.text}</span>
                  <label className="check"><input type="checkbox" checked={yesTo === question.text} onChange={(e) => setYesTo(e.target.checked ? question.text : '')} /><span>{question.confirm}</span></label>
                  {tried && !confirmed && <FieldError>Confirm this to save, or change the numbers.</FieldError>}
                </div>
              )}
              {reasonField}
              <div className="field"><span className="field-label" id="shape-l">How progress comes</span>
                <div className="seg full" role="group" aria-labelledby="shape-l">
                  {SHAPES.map(([k, l]) => <button key={k} type="button" aria-pressed={d.shape === k} onClick={() => set({ shape: k })}>{l}</button>)}
                </div>
              </div>
              <DueField label="When it’s due" labelClass="field-label" options={endOptions} choice={endChoice} onChoose={(w) => set({ endWeek: w === cycle.weeks ? '' : String(w), points: {} })} dates={weekDates(cycle, endChoice)} />
              {/* The week-by-week numbers are for the few who set them by hand; a rename or a new owner shouldn't wade through them. */}
              {shapedPlan && (
                <details className="disclose" open={Object.values(d.points ?? {}).some((v) => String(v).trim() !== '')}>
                  <summary>Plan by week <span className="hint">· see or set each week’s number</span></summary>
                  <PlanTable plan={shapedPlan} unit={{ unit: d.unit, decimals: parseNumber(d.decimals) ?? 0 }} typed={d.points} onType={(w, v) => set({ points: { ...d.points, [String(w)]: v } })} onReset={() => set({ points: {} })} />
                </details>
              )}
              {err('points')}
            </>
          )}
          {goal.kind === 'range' && (
            <div className="limits">
              <div className="field limits-bound"><span className="field-label" id="bound">Must stay</span>
                <div className="seg full" role="group" aria-labelledby="bound">
                  <button type="button" aria-pressed={d.bound === 'atMost'} onClick={() => set({ bound: 'atMost' })}>At most</button>
                  <button type="button" aria-pressed={d.bound === 'atLeast'} onClick={() => set({ bound: 'atLeast' })}>At least</button>
                </div>
              </div>
              <label className="field"><span className="field-label">Limit</span><input className="input" inputMode="decimal" value={d.limit} onChange={(e) => set({ limit: e.target.value })} aria-invalid={tried && !!errors.limit} />{err('limit')}{planHint(d) && <span className="hint tone-risk" role="status">{planHint(d)}</span>}</label>
              <label className="field"><span className="field-label">Warn this close</span><input className="input" inputMode="decimal" value={d.margin} onChange={(e) => set({ margin: e.target.value })} aria-invalid={tried && !!errors.margin} />{err('margin')}</label>
            </div>
          )}
          {goal.kind === 'milestone' && (
            <StageFields stages={d.stages} weeks={cycle.weeks} labelClass="field-label" error={tried ? errors.stages ?? null : null}
              onChange={(stages) => set({ stages })} onAdd={() => set({ stages: [...d.stages, { id: newId('st'), name: '', dueWeek: '' }] })} />
          )}
          {goal.kind !== 'metric' && reasonField}
          {part === 'plan' && goal.kind === 'metric' && !replanning && reasonField}
        </section>}

        {show('owner') && <section className="stack" style={{ gap: 'var(--s4)' }} aria-labelledby="fit-h">
          <h2 className="block-title" id="fit-h">Owner and links</h2>
          <div className="pair">
            <PickOne kind="person" label="Owner" value={d.ownerId || null} onChange={(id) => id && set({ ownerId: id })} />
            <PickOne kind="team" label="Team" value={d.teamId || null} onChange={(id) => id && set({ teamId: id })} />
          </div>
          <LevelField level={d.level} onChange={(level) => set({ level })} labelClass="field-label" />
          <PickOne kind="goal" label="Feeds into" none="Nothing: top of its own tree" value={d.parentId || null} onChange={(id) => set({ parentId: id ?? '', alsoHelps: (d.alsoHelps ?? []).filter((x) => x !== id) })}
            hide={[goal.id]} refuse={(row) => (below.has(row.id) ? 'Feeds this goal already' : null)} />
          <Pick kind="goal" several label="Also helps" hint="optional · a dotted line on the map" value={d.alsoHelps ?? []} onChange={(alsoHelps) => set({ alsoHelps })}
            hide={[goal.id]} refuse={(row) => (row.id === d.parentId ? 'It feeds this one already' : null)} />
          {d.parentId && (
            <label className="field"><span className="field-label">Why do we expect it to help? <span className="hint">optional</span></span>
              <textarea className="input" rows={2} value={d.whyHelps} onChange={(e) => set({ whyHelps: e.target.value })} placeholder="What should change in the goal it feeds, and why" />
            </label>
          )}
          {part === 'owner' && reasonField}
          {!part && <details className="disclose"><summary>More details</summary>
            {d.parentId && (
              <label className="field" style={{ maxWidth: 300 }}><span className="field-label">How much it moves “{parent?.title}”</span>
                <input className="input" inputMode="decimal" value={d.effect} onChange={(e) => set({ effect: e.target.value })} />{err('effect')}
              </label>
            )}
            <label className="check"><input type="checkbox" checked={d.guardrail} onChange={(e) => set({ guardrail: e.target.checked })} /><span>It’s a guardrail</span></label>
            <label className="field"><span className="field-label">Data source</span><input className="input" value={d.source} onChange={(e) => set({ source: e.target.value })} /></label>
            <label className="field"><span className="field-label">Definition</span><textarea className="input" rows={2} value={d.definition} onChange={(e) => set({ definition: e.target.value })} /></label>
          </details>}
        </section>}

        <div className="focus-foot">
          <button className="btn primary big-btn" type="submit" aria-disabled={saving || (tried && (!valid || (needReason && !reasonOk) || !confirmed))}>{label}</button>
        </div>
      </form>
    </div>
  );
}
