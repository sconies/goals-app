import { sameTitleNote } from '../domain/people';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { goalDraftKey, useDraft } from '../app/drafts';
import { MIN_REASON } from '../domain/checkin';
import { buildGoal, draftFor, planChanged, type GoalDraft } from '../domain/goal';
import { checksContext, goalChecks, goalMustFix, planSpanOf, REASON_EMPTY, sameNamedIn, unanswered, type GoalAnswers, type GoalCheck, type GoalField } from '../domain/goalEntry';
import { mayChangeGoal } from '../domain/goalRights';
import { makesLoop } from '../domain/tree';
import type { Goal, PlanShape } from '../domain/types';
import { newId } from '../data/store';
import { Empty } from '../ui/bits';
import { PlanTable } from '../ui/PlanTable';
import { FieldError, LevelField, Questions, StageFields, stageErrors } from '../ui/GoalFields';
import { WeekPick } from '../ui/WeekPick';
import { lastWeekOffered } from '../domain/weeks';
import { spanSays } from '../domain/weekChoices';
import { parseNumber } from '../domain/checkin';
import { FormClose } from '../ui/FormClose';
import { Place, type MeasurePick } from '../core/app';
import { Pick, PickOne } from '../ui/Pick';

/** The page's sections that an address can open at. */
const SECTIONS = ['definition', 'plan', 'owner', 'more'];

const SHAPES: [PlanShape, string][] = [['straight', 'Steady'], ['back', 'Back-loaded'], ['stepped', 'In steps']];

/**
 * Change a goal (goal spec 2.7): one page in focus mode, for its owner or an admin, in four sections with anchors:
 * "What it is" (`#definition`), "Plan and target" (`#plan`), "Who and where" (`#owner`) and "More details". One way out,
 * "Close and keep the draft" (navigation spec 2.5), and "Save changes" held at the foot of the window. Once check-ins
 * have started, a plan change needs a reason and is flagged. An old `?part=definition|plan|owner` link lands on the
 * matching section.
 */
export function GoalEdit() {
  const app = useApp();
  const { goalId } = useParams();
  const goal = goalId ? app.goal(goalId) : undefined;
  if (!goal) return <div className="page narrow"><Empty title="This goal doesn’t exist"><Link className="btn" to="/goals">All goals</Link></Empty></div>;
  if (!mayChangeGoal(app.viewer, goal)) {
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
  const [d, set, clear, restored] = useDraft<GoalDraft & { reason: string; answers?: GoalAnswers }>(goalDraftKey(app.ws.id, goal.id) + ':edit', () => ({ ...draftFor(goal), reason: '' }));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const loc = useLocation();
  // Old links opened one part of the form (`?part=plan`): they land on that section of the whole page (goal spec 1).
  const oldPart = new URLSearchParams(loc.search).get('part');
  useEffect(() => {
    if (!oldPart) return;
    const rest = new URLSearchParams(loc.search); rest.delete('part');
    const q = rest.toString();
    nav({ pathname: loc.pathname, search: q ? '?' + q : '', hash: SECTIONS.includes(oldPart) ? '#' + oldPart : '' }, { replace: true });
  }, [oldPart, loc.pathname, loc.search, nav]);
  // Opened at a section (`#plan`): scrolled there once it's drawn, and again after the shell has put the page at its top.
  useEffect(() => {
    const id = loc.hash.slice(1);
    if (!SECTIONS.includes(id)) return;
    const go = () => document.getElementById(id)?.scrollIntoView({ block: 'start' });
    const t = [60, 400].map((ms) => setTimeout(go, ms));
    return () => t.forEach(clearTimeout);
  }, [loc.hash]);
  // What can't be saved (goal entry, rule 2): the same rule and words as New goal, set-up, a file and the AI tools.
  const ownerP = app.person(d.ownerId);
  const parentG = app.goal(d.parentId);
  const fix = goalMustFix(d, { cycleWeeks: cycle.weeks, week, existing: goal, checkIns: app.checkInsOf(goal), door: 'form', startDate: cycle.startDate, owner: ownerP ? { name: ownerP.name, teamId: ownerP.teamId ?? null } : null, parent: parentG ? { title: parentG.title } : null, loops: !!parentG && makesLoop(goal.id, parentG.id, app.snapshot.goals) });
  const errors: Partial<Record<GoalField, string>> = {};
  for (const f of fix) errors[f.field] ??= f.text;
  const err = (k: GoalField) => tried && errors[k] ? <FieldError>{errors[k]}</FieldError> : null;
  const valid = fix.length === 0;
  const built = valid ? buildGoal(d, cycle, { id: goal.id, createdAt: goal.createdAt }, goal, started, week) : null;
  const replanning = !!built && started && planChanged(goal, built);
  // What is asked (goal entry, rule 3): the same questions as New goal, under the field each is about, and only what this
  // change makes new (a target that flips which way is better, a number far outside the old plan, an unlikely number, a
  // link to a lower level, an owner in another team). An answer holds for the values it was about.
  // What measures the goal, when a module offers it (the goal.measure place): saved with the goal.
  const [measure, setMeasure] = useState<MeasurePick | undefined>(undefined);
  const answers: GoalAnswers = d.answers ?? {};
  const checks = goalChecks(d, checksContext(d, { person: (id) => app.person(id), team: (id) => app.team(id), goal: (id) => app.goal(id), sameNamed: sameNamedIn(app.snapshot.goals) },
    { week, cycleWeeks: cycle.weeks, existing: goal, door: 'form', levels: cycle, startDate: cycle.startDate, mustFix: fix, metric: goal.kind === 'metric' ? measure?.metric ?? null : null }));
  const open = unanswered(checks, answers);
  const confirmed = open.length === 0;
  const onNo = (c: GoalCheck) => { if (c.opens) nav('/goals/' + c.opens); else if (c.noDoes) set(c.noDoes); };
  const questions = (f: GoalField) => (
    <Questions checks={checks.filter((c) => c.field === f)} answers={answers} onAnswer={(c) => set({ answers: { ...answers, [c.slot]: c.key } })} onNo={onNo}
      onChange={(c) => { const { [c.slot]: _gone, ...rest } = answers; set({ answers: rest }); }} alertSlot={tried ? open[0]?.slot ?? null : null} />
  );
  // From and To (rule 13), picked; and the plan from the shape (before any numbers typed by hand), for the plan table.
  const span = planSpanOf(d, { week, cycleWeeks: cycle.weeks, existing: goal });
  const endChoice = span.to;
  const setFrom = (n: number) => set({ fromWeek: String(n), points: {}, ...(span.to <= n ? { endWeek: String(n < cycle.weeks ? cycle.weeks : lastWeekOffered(cycle)) } : {}) });
  const shapedPlan = goal.kind === 'metric' && parseNumber(d.start) != null && parseNumber(d.target) != null && parseNumber(d.start) !== parseNumber(d.target)
    ? { start: parseNumber(d.start) as number, target: parseNumber(d.target) as number, shape: d.shape, ...(span.from ? { fromWeek: span.from } : {}), ...(endChoice !== cycle.weeks ? { endWeek: endChoice } : {}) }
    : null;
  const reasonOk = d.reason.trim().length >= MIN_REASON;
  const below = new Set<string>();
  const walk = (id: string) => { for (const c of app.snapshot.goals.filter((g) => g.parentId === id)) { if (below.has(c.id) || c.id === goal.id) continue; below.add(c.id); walk(c.id); } };
  walk(goal.id);
  const parent = app.goal(d.parentId);
  const back = () => nav('/goals/' + goal.id);

  const save = async () => {
    setTried(true);
    if (!built || saving || (replanning && !reasonOk) || !confirmed || measure?.blocks) return;
    setSaving(true);
    try {
      const after: Goal = { ...built, pending: null };
      const changed = JSON.stringify(after) !== JSON.stringify({ ...goal, pending: null });
      // Saved through the saveGoal action (goal entry, rule 7): the rights, Must fix, question and reason are the rule's.
      const { reason, answers: _a, ...draft } = d;
      // A changed goal and what measures it are one save, so the link is judged against the goal as changed.
      if (changed) await app.saveGoal(draft, goal, { ...(replanning ? { reason: reason.trim() } : {}), answers, ...(measure ? { also: measure } : {}) });
      else if (measure) await app.run(measure.action, measure.input(after));
      app.toast(!changed && measure === undefined ? 'Nothing changed.' : replanning ? 'Saved. The plan change and your reason are in the goal’s history.' : 'Saved.');
      clear();
      back();
    } catch {
      setSaving(false);
    }
  };

  const label = saving ? 'Saving…' : !valid && tried ? 'Fix the highlighted fields' : 'Save changes';
  // Asked right under what changed (the numbers), not at the bottom of the section.
  const reasonField = replanning && (
    <label className="field reason-field">
      <span className="field-label">Why change it?</span>
      <textarea className={'input' + (tried && !reasonOk ? ' invalid' : '')} rows={2} value={d.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. The vendor contract moved the start to week 6" aria-label="Why change it?" />
      {tried && !reasonOk ? <FieldError>{REASON_EMPTY}</FieldError> : <span className="hint">The original plan stays on the chart, dotted.</span>}
    </label>
  );

  return (
    <div className="focus goal-form goal-edit">
      <div className="focus-top">
        <FormClose keeps onClose={back} />
      </div>
      <form className="focus-body" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <h1 className="qtitle big">Change {goal.title}</h1>
        {restored && <div className="restored small">Restored your unsaved edits. <button type="button" className="linkish" onClick={() => { clear(); window.location.reload(); }}>Discard them</button></div>}

        <section className="stack edit-part" id="definition" aria-labelledby="definition-h">
          <h2 className="block-title" id="definition-h">What it is</h2>
          <label className="field">
            <span className="field-label">Name</span>
            <input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={tried && !!errors.title} />
            {err('title')}
            {!errors.title && d.title.trim() !== goal.title && (() => { const twin = sameTitleNote(d.title, goal.id, app.snapshot.goals, (id) => app.team(id)?.name ?? ''); return twin ? <span className="hint tone-risk" role="status">{twin}</span> : null; })()}
          </label>
          {goal.kind !== 'milestone' && (
            <label className="field"><span className="field-label">What it measures</span><textarea className="input" rows={3} value={d.definition} onChange={(e) => set({ definition: e.target.value })} placeholder="What counts, over what period, and anything left out" /></label>
          )}
          <Place name="goal.measure" goal={goal} kind={goal.kind} unit={d.unit} decimals={d.decimals} teamId={d.teamId} onChange={setMeasure} />
        </section>

        <section className="stack edit-part" id="plan" aria-labelledby="plan-h">
          <div className="stack" style={{ gap: 'var(--s1)' }}>
            <h2 className="block-title" id="plan-h">{goal.kind === 'metric' ? 'Plan and target' : goal.kind === 'range' ? 'The limit' : 'Stages'}</h2>
            {started && <span className="hint">Check-ins have started, so a change here needs a reason. Watchers see it flagged.</span>}
          </div>
          {goal.kind === 'metric' && (
            <>
              {/* Baseline with From, then Target with To: each a number and a week, picked (2.6, item 2; 2.13). */}
              <div className="week-rows">
                <label className="field"><span className="field-label">Baseline{d.unit ? ` (${d.unit})` : ''}</span><input className="input" inputMode="decimal" value={d.start} onChange={(e) => set({ start: e.target.value })} aria-invalid={tried && !!errors.start} />{err('start')}</label>
                <div><WeekPick cycle={cycle} week={week} field="from" label="From" value={span.from} onChange={setFrom} invalid={tried && !!errors.fromWeek} dataField="fromWeek" />{err('fromWeek')}</div>
                <label className="field"><span className="field-label">Target{d.unit ? ` (${d.unit})` : ''}</span><input className="input" inputMode="decimal" value={d.target} onChange={(e) => set({ target: e.target.value })} aria-invalid={tried && !!errors.target} />{err('target')}</label>
                <div><WeekPick cycle={cycle} week={week} field="to" from={span.from} label="To" value={endChoice} onChange={(n) => set({ endWeek: n === cycle.weeks ? '' : String(n), points: {} })} invalid={tried && !!errors.endWeek} dataField="endWeek" />{err('endWeek')}</div>
              </div>
              <p className="hint">{spanSays(cycle, span.from, endChoice, week)}</p>
              {questions('unit')}
              {questions('start')}
              {questions('fromWeek')}
              {questions('target')}
              {questions('endWeek')}
              {reasonField}
              <div className="field"><span className="field-label" id="shape-l">How progress comes</span>
                <div className="seg full" role="group" aria-labelledby="shape-l">
                  {SHAPES.map(([k, l]) => <button key={k} type="button" aria-pressed={d.shape === k} onClick={() => set({ shape: k })}>{l}</button>)}
                </div>
              </div>
              {/* The week-by-week numbers are for the few who set them by hand; a rename or a new owner shouldn't wade through them. */}
              {shapedPlan && (
                <details className="disclose" open={Object.values(d.points ?? {}).some((v) => String(v).trim() !== '')}>
                  <summary>Plan by week <span className="hint">· see or set each week’s number</span></summary>
                  <PlanTable plan={shapedPlan} unit={{ unit: d.unit, decimals: parseNumber(d.decimals) ?? 0 }} typed={d.points} onType={(w, v) => set({ points: { ...d.points, [String(w)]: v } })} onReset={() => set({ points: {} })} />
                </details>
              )}
              {err('points')}
              {questions('points')}
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
              <label className="field"><span className="field-label">Limit</span><input className="input" inputMode="decimal" value={d.limit} onChange={(e) => set({ limit: e.target.value })} aria-invalid={tried && !!errors.limit} />{err('limit')}</label>
              <label className="field"><span className="field-label">Warn this close</span><input className="input" inputMode="decimal" value={d.margin} onChange={(e) => set({ margin: e.target.value })} aria-invalid={tried && !!errors.margin} />{err('margin')}</label>
            </div>
          )}
          {goal.kind === 'range' && <>{questions('unit')}{questions('limit')}{questions('margin')}</>}
          {goal.kind === 'milestone' && (
            <StageFields stages={d.stages} cycle={cycle} week={week} labelClass="field-label" error={null} rowErrors={tried ? stageErrors(fix) : []}
              onChange={(stages) => set({ stages })} onAdd={() => set({ stages: [...d.stages, { id: newId('st'), name: '', dueWeek: '' }] })} />
          )}
          {goal.kind !== 'metric' && reasonField}
        </section>

        <section className="stack edit-part" id="owner" aria-labelledby="owner-h">
          <h2 className="block-title" id="owner-h">Who and where</h2>
          <div className="pair">
            <PickOne kind="person" label="Owner" value={d.ownerId || null} onChange={(id) => id && set({ ownerId: id })} />
            <PickOne kind="team" label="Team" value={d.teamId || null} onChange={(id) => id && set({ teamId: id })} />
          </div>
          {questions('teamId')}
          <LevelField level={d.level} onChange={(level) => set({ level })} labelClass="field-label" />
          <PickOne kind="goal" label="Feeds into" none="Nothing: top of its own tree" value={d.parentId || null} onChange={(id) => set({ parentId: id ?? '', alsoHelps: (d.alsoHelps ?? []).filter((x) => x !== id) })}
            hide={[goal.id]} refuse={(row) => (below.has(row.id) ? 'Feeds this goal already' : null)} />
          {questions('parentId')}
          <Pick kind="goal" several label="Also helps" hint="optional · a dotted line on the map" value={d.alsoHelps ?? []} onChange={(alsoHelps) => set({ alsoHelps })}
            hide={[goal.id]} refuse={(row) => (row.id === d.parentId ? 'It feeds this one already' : null)} />
          {d.parentId && (
            <label className="field"><span className="field-label">Why do we expect it to help? <span className="hint">optional</span></span>
              <textarea className="input" rows={2} value={d.whyHelps} onChange={(e) => set({ whyHelps: e.target.value })} placeholder="What should change in the goal it feeds, and why" />
            </label>
          )}
        </section>

        <details className="disclose edit-part" id="more" open={loc.hash === '#more' || (tried && !!errors.effect) || undefined}>
          <summary>More details</summary>
          <div className="stack">
            {d.parentId && (
              <label className="field" style={{ maxWidth: 300 }}><span className="field-label">How much it moves “{parent?.title}”</span>
                <input className="input" inputMode="decimal" value={d.effect} onChange={(e) => set({ effect: e.target.value })} />{err('effect')}
              </label>
            )}
            <label className="check"><input type="checkbox" checked={d.guardrail} onChange={(e) => set({ guardrail: e.target.checked })} /><span>It’s a guardrail</span></label>
            <label className="field"><span className="field-label">Data source</span><input className="input" value={d.source} onChange={(e) => set({ source: e.target.value })} placeholder="Where the number comes from" /></label>
          </div>
        </details>

        <div className="focus-foot">
          <button className="btn primary big-btn" type="submit" aria-disabled={saving || (tried && (!valid || (replanning && !reasonOk) || !confirmed))}>{label}</button>
        </div>
      </form>
    </div>
  );
}
