/* New goal (onboarding spec, 2.1 to 2.5; OB1): what, then who and where, then how it's measured, then check. Each step
   is an address (/goals/new/<step>), so the browser's Back steps back and a reload stays put; the draft is kept on every
   change and picked up where it stopped. People, teams and goals are found by typing (find-and-pick), never chosen from
   a list of everything. The level, the suggestions for "Feeds into" and the plan's note are rules (src/domain/newGoal). */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { dueOptions, isYear } from '../domain/year';
import { clearDraft, goalDraftKey, peekDraft, useDraft } from '../app/drafts';
import { parseNumber } from '../domain/checkin';
import { blankGoal, buildGoal, planHint, validateGoal, withPoints, type GoalDraft, type GoalErrors } from '../domain/goal';
import { fmt } from '../domain/format';
import { isTop, levelName } from '../domain/levels';
import { sameTitleGoals } from '../domain/people';
import { feedRefusal, NEW_GOAL_STEPS, parentSuggestions, startLevel, stepIndex } from '../domain/newGoal';
import { worstFirst } from '../domain/order';
import type { GoalKind, Level, MetricGoal, PlanShape } from '../domain/types';
import { newId } from '../data/store';
import { Steps } from '../ui/bits';
import { MetricChart } from '../ui/charts';
import { PlanTable } from '../ui/PlanTable';
import { DateRange, DueField, FieldError, LevelField, StageFields } from '../ui/GoalFields';
import { weekDates, yearEndWeek } from '../domain/plan';
import { Icon } from '../ui/Icon';
import type { Mark } from '../help/flows';
import { useMark } from '../telemetry/react';
import { Place, type MeasurePick } from '../core/app';
import { Pick, PickOne } from '../ui/Pick';
import { recentsOf, usePrefs } from '../app/search';

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
type StepError = keyof GoalErrors | 'level';
/** The fields each step asks, in the order of NEW_GOAL_STEPS. */
const STEP_FIELDS: StepError[][] = [['title'], ['ownerId', 'teamId', 'level', 'effect'], ['start', 'target', 'limit', 'margin', 'decimals', 'stages', 'points'], []];
/** Each step after the first, for the named flow (src/help/flows.ts). */
const STEP_MARKS: (Mark | null)[] = [null, 'newGoal.step-2', 'newGoal.step-3', 'newGoal.step-4'];

/** What New goal keeps in its draft beyond the goal: where it stopped, and what was chosen by hand rather than followed. */
type WizardDraft = GoalDraft & { step: number; teamByHand?: boolean; levelByHand?: boolean };

/** /goals/new (and /goals/new/<step>): a draft's step, or the first. */
export function GoalWizard() {
  const app = useApp();
  const { step } = useParams();
  const { search } = useLocation();
  const key = goalDraftKey(app.ws.id, null);
  // "Start a new one" throws the draft away and starts again on step 1, under a new key so nothing old lingers.
  const [round, setRound] = useState(0);
  if (stepIndex(step) == null) {
    const at = Math.min(3, Math.max(0, peekDraft<WizardDraft>(key)?.step ?? 0));
    return <Navigate replace to={`/goals/new/${NEW_GOAL_STEPS[at]!.slug}${search}`} />;
  }
  return <Wizard key={round} onFresh={() => { clearDraft(key); setRound((r) => r + 1); }} />;
}

function Wizard({ onFresh }: { onFresh: () => void }) {
  const app = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const prefs = usePrefs();
  const { cycle, week } = app;
  const step = stepIndex(useParams().step) ?? 0;
  // When the target is due: the end of the cycle, or the end of the year (a year goal carries across cycles).
  const yearEnd = yearEndWeek(cycle);
  const params = new URLSearchParams(loc.search);
  const defaultParent = app.goal(params.get('parent') ?? '')?.id ?? '';
  const viewerTeam = app.viewer.teamId ?? '';
  const [d, set, clear, restored] = useDraft<WizardDraft>(goalDraftKey(app.ws.id, null), () => ({ ...blankGoal(viewerTeam, app.viewer.id, defaultParent), step: 0 }));
  const [tried, setTried] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  useMark(STEP_MARKS[step] ?? null);
  const endOptions = dueOptions(cycle, week, yearEnd);
  const endChoice = parseNumber(d.endWeek) ?? cycle.weeks;
  const top = useRef<HTMLDivElement>(null);
  // What measures the goal, when a module offers it (the goal.measure place): saved after the goal, said on Check.
  const [measure, setMeasure] = useState<MeasurePick | undefined>(undefined);

  // A parent chosen in the draft that has gone since: said once, and "Feeds into" is empty again (2.5).
  const [gone] = useState(() => (d.parentId && !app.goal(d.parentId) ? d.parentId : ''));
  useEffect(() => { if (gone) set({ parentId: '', effect: '', whyHelps: '' }); }, [gone, set]);
  const parent = app.goal(d.parentId);

  // The level: chosen by hand, or rule 1 (one below the parent; Team; or none when the owner leads a team above Team).
  const level: Level | null = d.levelByHand ? d.level : startLevel(cycle, d.ownerId, app.snapshot.teams, app.snapshot.goals, parent ?? null);
  const goal: WizardDraft = { ...d, level: level ?? d.level };
  const errors: Partial<Record<StepError, string>> = { ...validateGoal(goal, cycle, null, week), ...(level ? {} : { level: 'Choose a level.' }) };
  if (!d.ownerId) errors.ownerId = 'Choose who owns it.';
  if (d.parentId && parent && level && feedRefusal(cycle, level, parent)) errors.level = feedRefusal(cycle, level, parent)!;
  const stepErrors = (i: number) => STEP_FIELDS[i]!.filter((k) => errors[k]);
  const shown = tried.includes(step);
  const showErr = (k: StepError) => (shown && errors[k] ? <FieldError>{errors[k]}</FieldError> : null);

  // A later step opened with an earlier one unfilled goes to the first unfilled one, its errors not yet shown.
  const firstBad = [0, 1, 2].find((i) => i < step && stepErrors(i).length);
  useEffect(() => { if (firstBad == null && d.step !== step) set({ step }); }, [firstBad, step, d.step, set]);
  useEffect(() => { top.current?.querySelector<HTMLElement>('.focus-body input, .focus-body select, .focus-body textarea, .focus-body button.kindcard, .focus-body .pick button')?.focus(); }, [step]);

  const at = (i: number) => `/goals/new/${NEW_GOAL_STEPS[i]!.slug}`;
  const go = (to: number) => {
    if (to > step) for (let i = step; i < to; i++) if (stepErrors(i).length) { setTried((t) => [...t, i]); return; }
    // Each Continue is one history entry, so the browser's Back steps back a step.
    nav(at(to), { state: { from: step } });
  };
  const back = () => {
    // Back after a Continue is the browser's Back; arriving some other way, it replaces this step with the one before.
    if ((loc.state as { from?: number } | null)?.from === step - 1) nav(-1);
    else nav(at(step - 1), { replace: true });
  };
  // After "Change" on Check, Continue comes straight back to it.
  const [fromCheck, setFromCheck] = useState(false);

  const publish = async () => {
    const bad = [0, 1, 2].find((i) => stepErrors(i).length);
    if (bad != null) { setTried([0, 1, 2]); nav(at(bad)); return; }
    setSaving(true);
    const g = buildGoal(goal, cycle, { id: newId('goal'), createdAt: app.stamp() }, null, false, week);
    try {
      // Stages said to be already done are recorded done in their own weeks, in the same save, so the goal isn't born late (rule 3).
      const done = g.kind === 'milestone' ? d.stages.filter((s) => s.done === 'yes').map((s) => s.id) : [];
      await app.saveGoal(g, null, undefined, done.length ? { stagesDone: done } : undefined);
      if (measure) await app.run(measure.action, measure.input(g));
      clear();
      app.toast(`Published “${g.title}”`);
      nav('/goals/' + g.id + '?published=1', { replace: true });
    } catch {
      setSaving(false);
    }
  };

  const preview: MetricGoal | null = (() => {
    const s = parseNumber(d.start), t = parseNumber(d.target);
    if (d.kind !== 'metric' || s == null || t == null || s === t) return null;
    return {
      id: 'preview', cycleId: cycle.id, teamId: d.teamId, ownerId: d.ownerId, title: d.title || 'New goal', io: d.io, level: goal.level, guardrail: d.guardrail,
      parentId: null, effect: null, source: '', definition: '', createdAt: '', kind: 'metric', unit: d.unit, decimals: parseNumber(d.decimals) ?? 0,
      plan: { start: s, target: t, shape: d.shape, ...(week > 0 ? { fromWeek: week } : {}), ...(endChoice !== cycle.weeks ? { endWeek: endChoice } : {}) },
      originalPlan: null, rebaselinedWeek: null,
    };
  })();
  const owner = app.person(d.ownerId);
  const teamName = (id: string) => app.team(id)?.name ?? '';
  const unitFmt = { unit: d.unit, decimals: parseNumber(d.decimals) ?? 0 };
  const num = (s: string) => { const n = parseNumber(s); return n == null ? '' : fmt(n, unitFmt); };
  const suggestions = useMemo(
    () => (level ? parentSuggestions(cycle, level, d.teamId, app.viewer.id, app.snapshot.goals, worstFirst(app), recentsOf(prefs, app.ws.id, app.viewer.id).filter((r) => r.kind === 'goal').map((r) => r.id)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level, d.teamId, app.snapshot],
  );
  const twins = sameTitleGoals(d.title, null, app.snapshot.goals.filter((g) => !g.removedAt));
  const named = d.stages.filter((s) => s.name.trim());
  const lastDue = Math.max(0, ...named.map((s) => parseNumber(s.dueWeek) ?? 0));
  const alsoHelps = (d.alsoHelps ?? []).map((id) => app.goal(id)).filter((g): g is NonNullable<typeof g> => !!g);
  const number = d.kind !== 'milestone';
  const noMetric = !measure;

  // The words for each step on Check, beside its Change.
  const checkRows: { step: number; label: string; value: string }[] = [
    { step: 0, label: 'What', value: [d.title.trim() || 'Untitled goal', KINDS.find(([k]) => k === d.kind)?.[1] ?? ''].join(' · ') },
    { step: 1, label: 'Owner', value: [owner?.name ?? 'No one yet', teamName(d.teamId) ? `${teamName(d.teamId)} team` : ''].filter(Boolean).join(' · ') },
    {
      step: 1, label: 'Where it fits', value: [
        level ? `${levelName(cycle, level)} level` : 'No level yet',
        parent ? `feeds “${parent.title}”${d.effect ? `, by about ${d.effect}${parent.kind !== 'milestone' && parent.unit ? ' ' + parent.unit : ''}` : ''}` : 'top of its own tree',
        ...(alsoHelps.length ? [`also helps ${alsoHelps.map((g) => `“${g.title}”`).join(', ')}`] : []),
        ...(d.guardrail ? ['a guardrail'] : []),
      ].join(', ') + '.',
    },
    ...(number ? [{ step: 2, label: 'Measured by', value: measure ? 'The metric chosen on step 3.' : `No metric: ${d.definition.trim() || 'not described yet'}.` }] : []),
    {
      step: 2, label: d.kind === 'milestone' ? 'Stages' : 'Numbers', value: d.kind === 'metric' ? (num(d.start) && num(d.target) ? `${num(d.start)} to ${num(d.target)} by week ${endChoice}` : 'Not set yet')
        : d.kind === 'range' ? (num(d.limit) ? `${d.bound === 'atMost' ? 'At most' : 'At least'} ${num(d.limit)}` : 'Not set yet')
          : named.length === 1 ? '1 stage' : `${named.length} stages, the last due week ${lastDue}`,
    },
  ];

  return (
    <div className="focus goal-form" ref={top}>
      <div className="focus-top wiz-top">
        <span className="small strong">New goal</span>
        <Steps at={step + 1} of={4} label={NEW_GOAL_STEPS[step]!.name} />
        <button className="iconbtn" onClick={() => nav('/goals')} aria-label="Close and keep the draft"><Icon name="close" /></button>
      </div>
      {firstBad != null && <Navigate replace to={at(firstBad)} />}
      <form className="focus-body" onSubmit={(e) => { e.preventDefault(); if (step < 3) go(fromCheck ? 3 : step + 1); else void publish(); }} noValidate>
        {restored && !asking && (
          <div className="restored small" role="status">Picked up the goal you hadn’t published. <button type="button" className="linkish" onClick={() => setAsking(true)}>Start a new one</button></div>
        )}
        {asking && (
          <div className="restored small" role="alertdialog" aria-label="Discard the draft">
            <span>Discard the draft of “{d.title.trim() || 'Untitled goal'}”?</span>{' '}
            <button type="button" className="btn sm" onClick={() => { onFresh(); nav(at(0), { replace: true }); }}>Discard it</button>{' '}
            <button type="button" className="linkish" onClick={() => setAsking(false)}>Keep it</button>
          </div>
        )}

        {step === 0 && (
          <>
            <h1 className="qtitle big">What do you want to achieve?</h1>
            <label className="field">
              <span className="small strong">Name it the way your team would say it</span>
              <input className="input big-input" value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Requests triaged within 2 days" aria-invalid={shown && !!errors.title} />
              {showErr('title')}
            </label>
            {!errors.title && twins.length > 0 && (
              <p className="hint tone-risk" role="status">
                {twins.slice(0, 2).map((g, i) => (
                  <Fragment key={g.id}>{i > 0 ? ' ' : ''}Another goal is called <Link to={'/goals/' + g.id}>“{g.title}”</Link>: {[g.key, teamName(g.teamId), `owned by ${app.person(g.ownerId)?.name ?? 'no one'}`].filter(Boolean).join(', ')}.</Fragment>
                ))}
                {twins.length > 2 ? ` And ${twins.length - 2} more.` : ''} That’s allowed; Faro shows each one’s key beside its title.
              </p>
            )}
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
              <legend className="small strong" style={{ marginBottom: 8 }}>How will you know it worked?</legend>
              <div className="kindcards">
                {KINDS.map(([k, l, help, ex]) => (
                  <button key={k} type="button" className="kindcard" aria-pressed={d.kind === k} onClick={() => set({ kind: k })}>
                    <span className="strong">{l}</span><span className="small">{help}</span><span className="tiny muted">{ex}</span>
                  </button>
                ))}
              </div>
              {d.kind === 'milestone' && <span className="tiny muted">Tip: if you can count progress, a number usually tells you more than stages do.</span>}
            </fieldset>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="qtitle big">Whose is it, and where does it fit?</h1>
            {gone && <p className="small" role="status">The goal it fed isn’t here any more, so “Feeds into” is empty again.</p>}
            <div className="fit-pair">
              <div className="stack" style={{ gap: 4 }}>
                <PickOne kind="person" label="Owner · checks in weekly" value={d.ownerId || null} invalid={shown && !!errors.ownerId}
                  onChange={(id) => { const p = id ? app.person(id) : undefined; set({ ownerId: id ?? '', ...(d.teamByHand || !p ? {} : { teamId: p.teamId ?? '' }) }); }} />
                {showErr('ownerId')}
              </div>
              <div className="stack" style={{ gap: 4 }}>
                <PickOne kind="team" label="Team" value={d.teamId || null} invalid={shown && !!errors.teamId} hint={app.snapshot.teams.length ? undefined : 'No teams yet.'}
                  onChange={(id) => set({ teamId: id ?? '', teamByHand: true })} />
                {showErr('teamId')}
              </div>
            </div>
            <LevelField level={level ?? (null as unknown as Level)} onChange={(l) => set({ level: l, levelByHand: true })} labelClass="small strong" />
            {showErr('level')}
            <PickOne kind="goal" label="Feeds into · optional" none="Nothing: top of its own tree" value={d.parentId || null}
              first={suggestions.map((g) => ({ id: g.id, note: levelName(cycle, g.level) }))}
              refuse={(row) => { const g = app.goal(row.id); return g && level ? feedRefusal(cycle, level, g) : null; }}
              hint={level && isTop(cycle, level) ? `${levelName(cycle, level)} goals are the top of their tree.` : !d.parentId ? 'Goals that feed nothing and have nothing feeding them show as not linked.' : undefined}
              onChange={(id) => set({ parentId: id ?? '', alsoHelps: (d.alsoHelps ?? []).filter((x) => x !== id) })} />
            {d.parentId && (
              <label className="field" style={{ maxWidth: 300 }}><span className="small strong">How much will it move “{parent?.title}”? <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span>
                <input className="input" inputMode="decimal" value={d.effect} onChange={(e) => set({ effect: e.target.value })} placeholder={parent && parent.kind !== 'milestone' ? `In ${parent.unit || 'its unit'}, e.g. 3` : 'e.g. 3'} />{showErr('effect')}
              </label>
            )}
            {d.parentId && (
              <label className="field"><span className="small strong">Why do we expect it to help? <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span>
                <textarea className="input" rows={2} value={d.whyHelps} onChange={(e) => set({ whyHelps: e.target.value })} placeholder={`What changes for “${parent?.title ?? 'it'}” when this goal is met?`} />
              </label>
            )}
            <Pick kind="goal" several label="Also helps · optional" value={d.alsoHelps ?? []} onChange={(ids) => set({ alsoHelps: ids })}
              refuse={(row) => (row.id === d.parentId ? 'It already feeds this.' : null)} />
            <label className="check"><input type="checkbox" checked={d.guardrail} onChange={(e) => set({ guardrail: e.target.checked })} /><span>It’s a guardrail: protects quality while the rest moves</span></label>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="qtitle big">{d.kind === 'metric' ? 'Where does it start, and where should it end?' : d.kind === 'range' ? 'Where is the line it mustn’t cross?' : 'What are the stages, and when is each due?'}</h1>
            {/* What measures it (the goal.measure place), first on the step, for the owner's team; empty unless a module fills it. */}
            {number && <Place name="goal.measure" goal={null} kind={d.kind} unit={d.unit} teamId={d.teamId} onChange={setMeasure} />}
            {number && (
              <div className="num-pair">
                <label className="field"><span className="small strong">Unit</span><input className="input" value={d.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="%, days, ms" /></label>
                <label className="field"><span className="small strong">Decimals</span><input className="input" inputMode="numeric" value={d.decimals} onChange={(e) => set({ decimals: e.target.value })} aria-invalid={shown && !!errors.decimals} />{showErr('decimals')}</label>
              </div>
            )}
            {d.kind === 'metric' && (
              <>
                <div className="num-pair with-arrow">
                  <label className="field"><span className="small strong">Today (week {Math.max(0, week)})</span><input className="input big-input" inputMode="decimal" value={d.start} onChange={(e) => set({ start: e.target.value })} aria-invalid={shown && !!errors.start} />{showErr('start')}</label>
                  <span className="arrow"><Icon name="arrow-right" /></span>
                  <label className="field"><span className="small strong">Target (week {endChoice})</span><input className="input big-input" inputMode="decimal" value={d.target} onChange={(e) => set({ target: e.target.value })} aria-invalid={shown && !!errors.target} />{showErr('target')}{planHint(d) && <span className="hint tone-risk" role="status">{planHint(d)}</span>}</label>
                </div>
                <DueField label="By when?" labelClass="small strong" options={endOptions} choice={endChoice} onChoose={(w) => set({ endWeek: w === cycle.weeks ? '' : String(w), points: {} })} dates={weekDates(cycle, endChoice)}
                  after={endChoice > cycle.weeks ? `It carries into next ${isYear(cycle) ? 'year' : 'cycle'} with this plan.` : undefined} />
                <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
                  <legend className="small strong" style={{ marginBottom: 8 }}>How will progress come?</legend>
                  <div className="seg full" role="group" aria-label="How will progress come?">
                    {SHAPES.map(([k, l]) => <button key={k} type="button" aria-pressed={d.shape === k} onClick={() => set({ shape: k })}>{l}</button>)}
                  </div>
                  <span className="hint">{SHAPES.find(([k]) => k === d.shape)?.[2]}.</span>
                </fieldset>
                {preview ? (
                  <figure className="card" style={{ margin: 0 }} aria-label="Plan preview">
                    <MetricChart goal={{ ...preview, plan: withPoints(preview.plan, d.points, cycle.weeks) }} weeks={cycle.weeks} week={week} series={[]} forecast={null} height={170} fromWeek={preview.plan.fromWeek || undefined} />
                    <figcaption className="tiny muted">The blue line is the weekly plan that status is judged against.</figcaption>
                  </figure>
                ) : <p className="small muted">Enter both numbers to see the plan.</p>}
                {preview && (
                  <details className="disclose" open={Object.values(d.points).some((v) => v.trim()) || (shown && !!errors.points) || undefined}>
                    <summary>Adjust the plan week by week</summary>
                    <PlanTable plan={preview.plan} unit={unitFmt} typed={d.points} onType={(w, v) => set({ points: { ...d.points, [String(w)]: v } })} onReset={() => set({ points: {} })} />
                  </details>
                )}
                {showErr('points')}
              </>
            )}
            {d.kind === 'range' && (
              <div className="limits">
                <div className="field limits-bound"><span className="small strong" id="bound">Must stay</span>
                  <div className="seg full" role="group" aria-labelledby="bound">
                    <button type="button" aria-pressed={d.bound === 'atMost'} onClick={() => set({ bound: 'atMost' })}>At most</button>
                    <button type="button" aria-pressed={d.bound === 'atLeast'} onClick={() => set({ bound: 'atLeast' })}>At least</button>
                  </div>
                </div>
                <label className="field"><span className="small strong">Limit</span><input className="input" inputMode="decimal" value={d.limit} onChange={(e) => set({ limit: e.target.value })} aria-invalid={shown && !!errors.limit} />{showErr('limit')}{planHint(d) && <span className="hint tone-risk" role="status">{planHint(d)}</span>}</label>
                <label className="field"><span className="small strong">Warn this close</span><input className="input" inputMode="decimal" value={d.margin} onChange={(e) => set({ margin: e.target.value })} aria-invalid={shown && !!errors.margin} />{showErr('margin')}</label>
              </div>
            )}
            {d.kind === 'milestone' && (
              <StageFields stages={d.stages} weeks={cycle.weeks} week={week} labelClass="small strong" error={shown ? errors.stages ?? null : null}
                onChange={(stages) => set({ stages })} onAdd={() => set({ stages: [...d.stages, { id: newId('st'), name: '', dueWeek: '' }] })} />
            )}
            {/* With no metric chosen: said in words, so the goal's page doesn't open on "not described yet". */}
            {(noMetric || d.kind === 'milestone') && (
              <>
                <label className="field"><span className="small strong">How it’s measured <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span>
                  <textarea className="input" rows={2} value={d.definition} onChange={(e) => set({ definition: e.target.value })} placeholder="Exactly what is counted, so everyone reads it the same way, e.g. Median hours to the first reply, from the help desk" />
                </label>
                <label className="field"><span className="small strong">Where the number comes from <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span>
                  <input className="input" value={d.source} onChange={(e) => set({ source: e.target.value })} placeholder="e.g. Jira intake board" />
                </label>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="qtitle big">Does this read right?</h1>
            <div className="summary-card">
              <span className="h3">{d.title || 'Untitled goal'}</span>
              <p>
                <strong>{owner?.name ?? 'Someone'}</strong> owns it and checks in weekly. {d.kind === 'metric' && parseNumber(d.start) != null && parseNumber(d.target) != null
                  ? <>It moves from <strong>{fmt(parseNumber(d.start)!, unitFmt)}</strong> to <strong>{fmt(parseNumber(d.target)!, unitFmt)}</strong> by week {endChoice} <DateRange>({weekDates(cycle, endChoice)})</DateRange>, {Object.values(d.points).some((v) => v.trim()) ? 'with plan numbers set by hand' : SHAPES.find((s) => s[0] === d.shape)?.[1].toLowerCase()}.</>
                  : d.kind === 'range' && parseNumber(d.limit) != null ? <>It stays {d.bound === 'atMost' ? 'at or under' : 'at or above'} <strong>{fmt(parseNumber(d.limit)!, unitFmt)}</strong>, with a warning within {d.margin || 0}.</>
                    : d.kind === 'milestone' ? <>{named.length === 1 ? '1 stage' : `${named.length} stages, the last due week ${lastDue}`}.{(['yes', 'no'] as const).map((k) => { const n = named.filter((s) => s.done === k).length; return n ? ` ${n} ${n === 1 ? 'stage is' : 'stages are'} already ${k === 'yes' ? 'done' : 'overdue'}.` : ''; }).join('')}</> : null}
              </p>
            </div>
            <ul className="review-rows" aria-label="Change a step">
              {checkRows.map((r) => (
                <li key={r.label}>
                  <span className="strong">{r.label}</span>
                  <span className="muted rr-value">{r.value}</span>
                  <button type="button" className="linkish" aria-label={'Change ' + r.label.toLowerCase()} onClick={() => { setFromCheck(true); go(r.step); }}>Change</button>
                </li>
              ))}
            </ul>
            {[0, 1, 2].some((i) => stepErrors(i).length) && <div className="note-bad small">Something still needs fixing; publishing takes you to it.</div>}
          </>
        )}

        <div className="focus-foot nav-foot">
          {step > 0 && <button type="button" className="btn" onClick={back}>Back</button>}
          <span style={{ flex: 1 }} />
          <button className="btn primary big-btn" type="submit" disabled={saving}>{saving ? 'Saving…' : step < 3 ? 'Continue' : 'Publish goal'}</button>
        </div>
      </form>
    </div>
  );
}
