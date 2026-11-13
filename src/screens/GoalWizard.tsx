/* New goal (onboarding spec, 2.1 to 2.5; OB1): what, then who and where, then how it's measured, then check. Each step
   is an address (/goals/new/<step>), so the browser's Back steps back and a reload stays put; the draft is kept on every
   change and picked up where it stopped. People, teams and goals are found by typing (find-and-pick), never chosen from
   a list of everything. The level, the suggestions for "Feeds into" and the plan's note are rules (src/domain/newGoal). */
import '../styles/notes/proposed.css';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { clearDraft, goalDraftKey, peekDraft, useDraft } from '../app/drafts';
import { parseNumber } from '../domain/checkin';
import { blankGoal, GOAL_KINDS, withPoints, type GoalDraft } from '../domain/goal';
import { checksContext, decimalsFor, formNeed, goalChecks, goalMustFix, planSpanOf, proposedMustFix, unsaidDraft, sameNamedIn, STEP_SAYS, stepFields, stepSays, stepState, unanswered, type GoalAnswers, type GoalCheck, type GoalField, type MustFix } from '../domain/goalEntry';
import { FixLine } from '../ui/Levels';
import { focusQuestion } from '../ui/questionInView';
import { fmt } from '../domain/format';
import { placesText } from '../domain/numbers';
import { isTop, levelName } from '../domain/levels';
import { sameTitleGoals } from '../domain/people';
import { NEW_GOAL_STEPS, parentSuggestions, startLevel, stepIndex } from '../domain/newGoal';
import { readBack, reviewsJoining, underWay } from '../domain/readBack';
import { measureEmpty } from '../domain/proposed';

/** The fields that say how a goal is measured: optional, all together, while it is proposed (rule 14). */
const MEASURE_FIELDS: string[] = ['start', 'target', 'limit', 'stages'];
import { worstFirst } from '../domain/order';
import type { Level, MetricGoal, PlanShape } from '../domain/types';
import { newId } from '../data/store';
import { Steps } from '../ui/bits';
import { MetricChart } from '../ui/charts';
import { PlanTable } from '../ui/PlanTable';
import { DecimalsLine, FieldError, LevelField, Questions, StageFields, stageErrors } from '../ui/GoalFields';
import { WeekPick } from '../ui/WeekPick';
import { datesOf, defaultTo, weekSays } from '../domain/weeks';
import { rangeSays, spanSays } from '../domain/weekChoices';
import { FormClose } from '../ui/FormClose';
import type { Mark } from '../help/flows';
import { useMark } from '../telemetry/react';
import { Place, useFilled, type MeasurePick } from '../core/app';
import { BaselineFields } from '../ui/BaselineFields';
import { Pick, PickOne } from '../ui/Pick';
import { recentsOf, usePrefs } from '../app/search';

const KINDS = GOAL_KINDS;
const SHAPES: [PlanShape, string, string][] = [
  ['straight', 'Steady', 'The same progress every week'],
  ['back', 'Back-loaded', 'Slow start, faster once work lands'],
  ['stepped', 'In steps', 'Jumps as each release ships'],
];
/** Each step after the first, for the named flow (src/help/flows.ts). */
const STEP_MARKS: (Mark | null)[] = [null, 'newGoal.step-2', 'newGoal.step-3', 'newGoal.step-4'];

/** What New goal keeps in its draft beyond the goal: where it stopped, and what was chosen by hand rather than followed. */
type WizardDraft = GoalDraft & { step: number; teamByHand?: boolean; levelByHand?: boolean; answers?: GoalAnswers; measureKept?: string; state?: 'active' | 'proposed' };

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

/** The goal's page (lazy, as in App): fetched early so Publish opens it at once. A failed fetch is left to the route. */
const loadGoalPage = () => import('./GoalScreen').then(() => undefined, () => undefined);

/** The form's own unit and decimals, before anyone types: a metric chosen then fills them (rule 5). */
const BLANK = blankGoal('', '', '');

function Wizard({ onFresh }: { onFresh: () => void }) {
  const app = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const prefs = usePrefs();
  const { cycle, week } = app;
  const step = stepIndex(useParams().step) ?? 0;
  const params = new URLSearchParams(loc.search);
  const defaultParent = app.goal(params.get('parent') ?? '')?.id ?? '';
  const viewerTeam = app.viewer.teamId ?? '';
  const [d, set, clear, restored] = useDraft<WizardDraft>(goalDraftKey(app.ws.id, null), () => ({ ...blankGoal(viewerTeam, app.viewer.id, defaultParent), step: 0 }));
  const [tried, setTried] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  // The baseline's period (BL) starts folded into one link on the plan's line, so the step still fits two phone screens.
  const [baselineOpen, setBaselineOpen] = useState(false);
  // The goal this draft was published as: from then on nothing here asks again or says what's missing; the goal's page
  // opens with the toast (the wizard stays drawn while that page loads).
  const [published, setPublished] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  useMark(STEP_MARKS[step] ?? null);
  // From and To (rule 13): picked weeks, from this week to the year's end until chosen.
  const span = planSpanOf(d, { week, cycleWeeks: cycle.weeks, existing: null, startDate: cycle.startDate });
  const endChoice = span.to;
  const setFrom = (n: number) => set({ fromWeek: String(n), points: {}, ...(span.to <= n ? { endWeek: String(defaultTo(cycle, n)) } : {}) });
  const setTo = (n: number) => set({ endWeek: n === cycle.weeks ? '' : String(n), points: {} });
  const top = useRef<HTMLDivElement>(null);
  // What measures the goal, when a module offers it (the goal.measure place): saved after the goal, said on Check. The
  // choice itself lives in the draft (measureKept); the place says what it means for the draft as it is now, on the
  // measure step and, drawing nothing, on Check. A pick said on another step or for another team (Change on Who and
  // where), or not yet said after a reload, is never the one published (build review of #202, findings 2 and 3).
  const [measured, setMeasured] = useState<{ pick: MeasurePick | undefined; at: string } | null>(null);
  const measure = measured?.pick;
  // A metric chosen on a goal whose unit and decimals nobody typed fills them, and they're said in one line (metrics, rule 5).
  const [filled, setFilled] = useState(false);
  // With a module offering "Measured by", the form's own words for how it's measured wait until "No metric" is chosen (metrics spec, 2.4).
  const measurePlace = useFilled('goal.measure');
  const measureAt = [step, d.kind, d.unit, d.decimals, d.teamId, d.measureKept ?? ''].join('|');
  const setMeasure = (pick: MeasurePick | undefined) => setMeasured({ pick, at: measureAt });
  const measureSaid = !measurePlace || d.kind === 'milestone' || measured?.at === measureAt;
  const [saidNone, setSaidNone] = useState(false);

  // A parent chosen in the draft that has gone since: said once, and "Feeds into" is empty again (2.5).
  const [gone] = useState(() => (d.parentId && !app.goal(d.parentId) ? d.parentId : ''));
  useEffect(() => { if (gone) set({ parentId: '', effect: '', whyHelps: '' }); }, [gone, set]);
  const parent = app.goal(d.parentId);

  // The level: chosen by hand, or rule 1 (one below the parent; Team; or none when the owner leads a team above Team).
  const level: Level | null = d.levelByHand ? d.level : startLevel(cycle, d.ownerId, app.snapshot.teams, app.snapshot.goals, parent ?? null);
  const goal: WizardDraft = { ...d, level: level ?? d.level };
  // What can't be saved (goal entry, rule 2): the same rule and words as the edit page, set-up, a file and the AI tools.
  const ownerP = app.person(d.ownerId);
  // "Is it under way?" (GE10): chosen on Check; until then a goal for someone else starts on "Not yet" (decision 16).
  const state = d.state ?? (d.ownerId && d.ownerId !== app.viewer.id ? 'proposed' : 'active');
  const proposing = state === 'proposed';
  const fix: MustFix[] = (proposing ? proposedMustFix : goalMustFix)({ ...goal, level: (level ?? '') as Level }, { cycleWeeks: cycle.weeks, week, existing: null, door: 'form', startDate: cycle.startDate, owner: ownerP ? { name: ownerP.name, teamId: ownerP.teamId ?? null } : null, parent: parent ? { title: parent.title } : null });
  // What is asked (goal entry, rule 3): possible but unlikely, each under its field, answered once for the values it is about.
  const answers: GoalAnswers = d.answers ?? {};
  const metric = d.kind === 'metric' ? measure?.metric ?? null : null;
  // Proposed with nothing measured yet (rule 14): nothing about its numbers is asked.
  const asked = proposing && measureEmpty(goal) ? { ...goal, ...unsaidDraft(goal) } : goal;
  const live: GoalCheck[] = goalChecks({ ...asked, level: (level ?? '') as Level }, checksContext(asked, {
    person: (id) => app.person(id), team: (id) => app.team(id), goal: (id) => app.goal(id), sameNamed: sameNamedIn(app.snapshot.goals),
  }, { week, cycleWeeks: cycle.weeks, existing: null, door: 'form', proposing, levels: cycle, startDate: cycle.startDate, mustFix: fix, metric, savedAs: published, actor: app.viewer }));
  // Pressing Publish freezes the questions as they were: the save puts the new goal among the team's goals before it
  // returns, and nothing it changes may ask again (or say a question is open) while the goal's page opens.
  const frozen = useRef<GoalCheck[] | null>(null);
  const checks = frozen.current ?? live;
  // What measures it can stop step 3 too (a metric in another unit): the module says why, under its own field.
  const measureBlock = d.kind !== 'milestone' ? measure?.blocks : undefined;
  const stepErrors = (i: number) => [...fix.filter((f) => stepFields(i, d.kind).includes(f.field)), ...(i === 2 && measureBlock ? [{ field: 'measure', id: 'measure', text: measureBlock } as unknown as MustFix] : [])];
  const stepOpen = (i: number) => unanswered(checks.filter((c) => stepFields(i, d.kind).includes(c.field)), answers);
  const shown = tried.includes(step);
  // A Must fix shows under its field once the field has been changed and left, and for every field on Continue; never while typing.
  const [left, setLeft] = useState<GoalField[]>([]);
  // Not when the field is left by pressing a button (Continue, Add a stage): showing it then would move the button from
  // under the pointer before the press lands; Continue shows every Must fix on the step anyway.
  const pressing = useRef(false);
  const leave = (f: GoalField) => () => { if (!pressing.current && !left.includes(f)) setLeft((l) => [...l, f]); };
  const showsFor = (f: GoalField) => shown || left.includes(f);
  const errorOf = (f: GoalField) => (showsFor(f) ? fix.find((x) => x.field === f) : undefined);
  const showErr = (f: GoalField) => { const e = errorOf(f); return e ? <FieldError id={`${f}-fix`}>{e.text}</FieldError> : null; };
  const invalid = (f: GoalField) => !!errorOf(f);
  // Proposed, how it's measured may wait: the type's own required fields read optional (rule 14).
  const optional = (f: GoalField) => (formNeed(f, d.kind) === 'optional' || (proposing && MEASURE_FIELDS.includes(f)) ? <span className="muted" style={{ fontWeight: 400 }}> · optional</span> : null);
  const gate = stepState(step, stepErrors(step), checks, answers);
  // Answering: yes keeps what was typed; no changes it, at once where the answer says how, or is an answer too (a stage
  // overdue), or leaves it to the person, at the field. Change asks an answered question again.
  const answer = (c: GoalCheck, extra: Partial<WizardDraft> = {}) => set({ ...extra, answers: { ...answers, [c.slot]: c.key } });
  const stageDone = (c: GoalCheck, done: '' | 'yes' | 'no') => ({ stages: d.stages.map((st, i) => (i === c.row ? { ...st, done } : st)) });
  const onYes = (c: GoalCheck) => answer(c, c.id === 'stage-past' ? stageDone(c, 'yes') : {});
  const onNo = (c: GoalCheck) => {
    if (c.opens) { nav('/goals/' + c.opens); return; }
    if (c.noAnswers) { answer(c, c.id === 'stage-past' ? stageDone(c, 'no') : {}); return; }
    if (c.noDoes) { set({ ...c.noDoes, ...(c.noDoes.teamId != null ? { teamByHand: true } : {}) }); return; }
    focusField(c.field);
  };
  const ask = (c: GoalCheck) => { const { [c.slot]: _gone, ...rest } = answers; set({ answers: rest, ...(c.id === 'stage-past' ? stageDone(c, '') : {}) }); };
  const questions = (f: GoalField, row?: number) => (
    <Questions checks={checks.filter((c) => c.field === f && (row == null || c.row === row))} answers={answers} onAnswer={onYes} onNo={onNo} onChange={ask} alertSlot={shown ? gate.check : null} />
  );
  // The decimal places kept: chosen, or worked out from what is typed (rule 2's decimalsFor).
  const places = decimalsFor(d) ?? 0;
  // A target the same as today offers the way out: a number to keep in range, at that value (section 4, same-as-start).
  const hold = errorOf('target')?.id === 'same-as-start' ? errorOf('target')!.hold : undefined;
  const holdAt = (bound: 'atMost' | 'atLeast') => set({ kind: 'range', bound, limit: d.start, target: '' });
  const holdOffer = hold != null ? (
    <span className="row hold-offer">
      <button type="button" className="btn sm" onClick={() => holdAt('atMost')}>Keep it at {fmt(hold, { unit: d.unit, decimals: places })} or under</button>
      <button type="button" className="btn sm" onClick={() => holdAt('atLeast')}>Keep it at {fmt(hold, { unit: d.unit, decimals: places })} or over</button>
    </span>
  ) : null;
  // Decimals are worked out from what is typed and said in one line, with Change (2.4, item 4); shown once a number is valid.
  const anyNumber = (d.kind === 'metric' ? [d.start, d.target] : [d.limit, ...(d.bound === 'between' ? [d.lower] : [])]).some((v) => parseNumber(v) != null);
  const decimalsLine = anyNumber || d.decimals.trim() ? <>{<DecimalsLine places={places} chosen={d.decimals} onChoose={(v) => set({ decimals: v })} />}{showErr('decimals')}</> : null;
  // A number with more places than the goal keeps offers to keep them (section 4, too-precise).
  const keepOffer = (f: GoalField) => { const e = errorOf(f); return e?.id === 'too-precise' && e.keep != null ? <button type="button" className="linkish keep-places" onClick={() => set({ decimals: String(e.keep) })}>Keep {placesText(e.keep)}</button> : null; };

  // A later step opened with an earlier one unfilled goes to the first unfilled one, its errors not yet shown.
  const firstBad = [0, 1, 2].find((i) => i < step && stepErrors(i).length);
  useEffect(() => { if (firstBad == null && d.step !== step) set({ step }); }, [firstBad, step, d.step, set]);
  // The goal's page loads while Check is read, so Publish opens it at once.
  useEffect(() => { if (step === 3) void loadGoalPage(); }, [step]);
  useEffect(() => { top.current?.querySelector<HTMLElement>('.focus-body input, .focus-body select, .focus-body textarea, .focus-body button.kindcard, .focus-body .pick button')?.focus(); }, [step]);

  const atStep = (i: number) => `/goals/new/${NEW_GOAL_STEPS[i]!.slug}`;
  const focusField = (f: GoalField | null) => {
    if (!f) return;
    // At once when it is drawn (this step), so focus has moved by the time the line above the button shows; else once it is.
    const find = () => top.current?.querySelector<HTMLElement>(`[data-field="${f}"] input, [data-field="${f}"] button, input[data-field="${f}"], textarea[data-field="${f}"]`);
    const now = find();
    if (now) now.focus(); else setTimeout(() => find()?.focus(), 0);
  };
  const focusCheck = (slot: string | null) => focusQuestion(top.current, slot);
  // After "Change" on Check, Continue comes straight back to it: said in the history entry Change made, so it holds for
  // that entry only (the browser's Back to another step doesn't carry it).
  const fromCheck = step < 3 && !!(loc.state as { fromCheck?: boolean } | null)?.fromCheck;
  const go = (to: number) => {
    // "Continue" is never disabled: pressed with a Must fix, every field on the step says its own, and focus goes to the
    // first; with none but a question open, focus goes to the first question (rule 4). A later step the change has made
    // unfinished (Change on What, then another type) is opened at its first fault, still on the way back to Check (build
    // review of #129, finding 1: Continue went dead).
    if (to > step) for (let i = step; i < to; i++) {
      const at = stepState(i, stepErrors(i), checks, answers);
      if (!at.go) {
        setTried((t) => [...t, i]);
        if (i !== step) nav(atStep(i), { state: { from: step, fromCheck } });
        if (at.check) focusCheck(at.check); else focusField(at.focus);
        return;
      }
    }
    // Each Continue is one history entry, so the browser's Back steps back a step.
    nav(atStep(to), { state: { from: step } });
  };
  const back = () => {
    // Back after a Continue is the browser's Back; arriving some other way, it replaces this step with the one before.
    if ((loc.state as { from?: number } | null)?.from === step - 1) nav(-1);
    else nav(atStep(step - 1), { replace: true });
  };

  // Publish pressed before Check's place has said what measures it (its code still loading after a reload): it saves
  // once it has.
  const waiting = useRef(false);
  const publish = async () => {
    if (!measureSaid) { waiting.current = true; setSaving(true); return; }
    waiting.current = false;
    const bad = [0, 1, 2].find((i) => stepErrors(i).length || stepOpen(i).length);
    if (bad != null) { setSaving(false); setTried([0, 1, 2]); nav(atStep(bad)); return; }
    frozen.current = checks;
    setSaving(true);
    try {
      // Saved through the saveGoal action (goal entry, rule 7): the same rights, Must fix and questions as every other door.
      // The answers ride with it, kept in History as "Checked"; stages said to be already done are recorded done in their
      // own weeks, in the same save, so the goal isn't born late (OB2's rule 3). What measures it (the goal.measure place)
      // is saved in the same commit, so the link sees the new goal.
      const { step: _step, teamByHand: _t, levelByHand: _l, answers: _a, ...draft } = goal;
      const { state: _s, ...rest } = draft;
      const g = await app.saveGoal(rest, null, { answers, metric, state, ...(measure && d.kind !== 'milestone' ? { also: measure } : {}) });
      clear();
      setPublished(g.id);
      // The page and the toast together: the page's code is (almost always) here already.
      await loadGoalPage();
      nav('/goals/' + g.id + '?published=1', { replace: true });
      app.toast(proposing ? `Proposed “${g.title}”` : `Published “${g.title}”`);
    } catch {
      frozen.current = null;
      setSaving(false);
    }
  };

  useEffect(() => { if (waiting.current && measureSaid) void publish(); });

  const preview: MetricGoal | null = (() => {
    const s = parseNumber(d.start), t = parseNumber(d.target);
    if (d.kind !== 'metric' || s == null || t == null || s === t) return null;
    return {
      id: 'preview', cycleId: cycle.id, teamId: d.teamId, ownerId: d.ownerId, title: d.title || 'New goal', io: d.io, level: goal.level, guardrail: d.guardrail,
      parentId: null, effect: null, source: '', definition: '', createdAt: '', kind: 'metric', unit: d.unit, decimals: places,
      plan: { start: s, target: t, shape: d.shape, ...(span.from ? { fromWeek: span.from } : {}), ...(endChoice !== cycle.weeks ? { endWeek: endChoice } : {}) },
      originalPlan: null, rebaselinedWeek: null,
    };
  })();
  const owner = app.person(d.ownerId);
  const teamName = (id: string) => app.team(id)?.name ?? '';
  const unitFmt = { unit: d.unit, decimals: places };
  const suggestions = useMemo(
    () => (level ? parentSuggestions(cycle, level, d.teamId, app.viewer.id, app.snapshot.goals, worstFirst(app), recentsOf(prefs, app.ws.id, app.viewer.id).filter((r) => r.kind === 'goal').map((r) => r.id)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level, d.teamId, app.snapshot],
  );
  const twins = sameTitleGoals(d.title, null, app.snapshot.goals.filter((g) => !g.removedAt));
  const alsoHelps = (d.alsoHelps ?? []).map((id) => app.goal(id)).filter((g): g is NonNullable<typeof g> => !!g);
  const number = d.kind !== 'milestone';
  const noMetric = !measure;

  // The read-back (goal entry, rule 5): the goal in sentences, each row with Change to its step, then what happens after
  // it is published. The rhythm and Reviews switches (FT) aren't built yet: weekly, and Reviews on (spec, 11).
  const said = checks.filter((c) => c.id !== 'stage-past' && c.readBack && answers[c.slot] === c.key).map((c) => c.readBack);
  const read = step === 3 ? readBack(goal, {
    cycle, week, today: app.today, level, owner: owner ? { name: owner.name, isViewer: owner.id === app.viewer.id } : null, teamName: teamName(d.teamId),
    parent: parent ? { title: parent.title, key: parent.key } : null, alsoHelps: alsoHelps.map((g) => g.title),
    metric: measure && number ? measure.says ?? 'The metric chosen on step 3.' : null, answers: said, rhythm: 'weekly', reviewsOn: true,
    reviewsJoined: level ? reviewsJoining({ id: 'new-goal', level, parentId: d.parentId || null, title: d.title }, app.snapshot.reviews, app.snapshot.goals, cycle) : [],
    wsName: app.ws.name, state,
  }) : null;
  const choices = underWay({ owner: owner ? { name: owner.name, isViewer: owner.id === app.viewer.id } : null, rhythm: 'weekly', week, from: d.kind === 'metric' ? span.from : undefined });

  return (
    <div className="focus goal-form" ref={top}>
      <div className="focus-top wiz-top">
        <span className="small strong">New goal</span>
        <Steps at={step + 1} of={4} label={NEW_GOAL_STEPS[step]!.name} />
        <FormClose keeps onClose={() => nav('/goals')} />
      </div>
      {firstBad != null && <Navigate replace to={atStep(firstBad)} />}
      <form className="focus-body" onPointerDownCapture={(e) => { pressing.current = !!(e.target as Element).closest('button'); }} onPointerUpCapture={() => { setTimeout(() => { pressing.current = false; }, 0); }} onSubmit={(e) => { e.preventDefault(); if (step < 3) go(fromCheck ? 3 : step + 1); else void publish(); }} noValidate>
        {restored && !asking && (
          <div className="restored small" role="status">Picked up the goal you hadn’t published. <button type="button" className="linkish" onClick={() => setAsking(true)}>Start a new one</button></div>
        )}
        {asking && (
          <div className="restored small" role="alertdialog" aria-label="Discard the draft">
            <span>Discard the draft of “{d.title.trim() || 'Untitled goal'}”?</span>{' '}
            <button type="button" className="btn sm" onClick={() => { onFresh(); nav(atStep(0), { replace: true }); }}>Discard it</button>{' '}
            <button type="button" className="linkish" onClick={() => setAsking(false)}>Keep it</button>
          </div>
        )}

        {step === 0 && (
          <>
            <h1 className="qtitle big">What do you want to achieve?</h1>
            <label className="field">
              <span className="small strong">Name it the way your team would say it</span>
              <input className="input big-input" data-field="title" value={d.title} onChange={(e) => set({ title: e.target.value })} onBlur={leave('title')} placeholder="e.g. Requests triaged within 2 days" aria-invalid={invalid('title')} aria-describedby={invalid('title') ? 'title-fix' : undefined} />
              {showErr('title')}
            </label>
            {!fix.some((f) => f.field === 'title') && twins.length > 0 && (
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
            {stepSays(stepFields(1, d.kind), d.kind) && <p className="small muted step-says">{STEP_SAYS}</p>}
            {gone && <p className="small" role="status">The goal it fed isn’t here any more, so “Feeds into” is empty again.</p>}
            <div className="fit-pair">
              <div className="stack" style={{ gap: 4 }} data-field="ownerId">
                <PickOne kind="person" label="Owner · checks in weekly" value={d.ownerId || null} invalid={invalid('ownerId')}
                  onChange={(id) => { const p = id ? app.person(id) : undefined; set({ ownerId: id ?? '', ...(d.teamByHand || !p ? {} : { teamId: p.teamId ?? '' }) }); }} />
                {showErr('ownerId')}
                {/* Anyone may choose anyone (Lane, 11 Nov): said, so nobody is surprised who can change it afterwards. */}
                {ownerP && ownerP.id !== app.viewer.id && (() => { const first = ownerP.name.split(' ')[0]; return <p className="hint owner-said" role="status">{first} will own it. After it is published, only {first} or an admin can change it.</p>; })()}
              </div>
              <div className="stack" style={{ gap: 4 }} data-field="teamId">
                <PickOne kind="team" label="Team" value={d.teamId || null} invalid={invalid('teamId')} hint={app.snapshot.teams.length ? undefined : 'No teams yet.'}
                  onChange={(id) => set({ teamId: id ?? '', teamByHand: true })} />
                {showErr('teamId')}
              </div>
            </div>
            {questions('teamId')}
            <LevelField level={level ?? (null as unknown as Level)} onChange={(l) => set({ level: l, levelByHand: true })} labelClass="small strong" />
            {showErr('level')}
            <PickOne kind="goal" label="Feeds into · optional" none="Nothing: top of its own tree" value={d.parentId || null}
              first={suggestions.map((g) => ({ id: g.id, note: levelName(cycle, g.level) }))}
              hint={level && isTop(cycle, level) ? `${levelName(cycle, level)} goals are the top of their tree.` : !d.parentId ? 'Goals that feed nothing and have nothing feeding them show as not linked.' : undefined}
              onChange={(id) => set({ parentId: id ?? '', alsoHelps: (d.alsoHelps ?? []).filter((x) => x !== id) })} />
            {questions('parentId')}
            {d.parentId && (
              <label className="field" style={{ maxWidth: 300 }}><span className="small strong">How much will it move “{parent?.title}”? <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span>
                <input className="input" inputMode="decimal" data-field="effect" value={d.effect} onChange={(e) => set({ effect: e.target.value })} onBlur={leave('effect')} aria-invalid={invalid('effect')} placeholder={parent && parent.kind !== 'milestone' ? `In ${parent.unit || 'its unit'}, e.g. 3` : 'e.g. 3'} />{showErr('effect')}
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
            {stepSays(stepFields(2, d.kind).filter((f) => noMetric || (f !== 'definition' && f !== 'source')), d.kind) && <p className="small muted step-says">{STEP_SAYS}</p>}
            {/* What measures it (the goal.measure place), first on the step, for the owner's team; empty unless a module fills it. */}
            {number && <Place name="goal.measure" goal={null} kind={d.kind} unit={d.unit} decimals={d.decimals} teamId={d.teamId} onChange={setMeasure} kept={d.measureKept} onKeep={(k) => set({ measureKept: k })}
              untouched={d.unit === BLANK.unit && d.decimals === BLANK.decimals} fill={(f) => { set({ unit: f.unit, decimals: f.decimals }); setFilled(f.hidden); }} onNone={setSaidNone} />}
            {number && !filled && (
              <label className="field" style={{ maxWidth: 300 }}><span className="small strong">Unit{optional('unit')}</span>
                <input className="input" data-field="unit" value={d.unit} onChange={(e) => set({ unit: e.target.value })} onBlur={leave('unit')} placeholder="%, days, hours, incidents" aria-invalid={invalid('unit')} />{showErr('unit')}
              </label>
            )}
            {/* No unit is asked once there is a number to count, or on Continue: not before anything is typed. */}
            {number && (anyNumber || shown) && questions('unit')}
            {d.kind === 'metric' && (
              <>
                {/* Baseline with From, then Target with To (2.4, item 3): each a number and a week, picked (2.13). */}
                <div className="week-rows">
                  <div className="field">
                    <label className="stack" style={{ gap: 4 }}><span className="small strong">Baseline</span><input className="input big-input" inputMode="decimal" data-field="start" value={d.start} onChange={(e) => set({ start: e.target.value })} onBlur={leave('start')} aria-invalid={invalid('start')} aria-describedby={invalid('start') ? 'start-fix' : 'start-hint'} /></label>
                    {showErr('start')}{keepOffer('start')}
                  </div>
                  <div onBlur={leave('fromWeek')}>
                    <WeekPick cycle={cycle} week={week} field="from" label="From" labelClass="small strong" value={span.from} onChange={setFrom} invalid={invalid('fromWeek')} dataField="fromWeek" />
                    {showErr('fromWeek')}{questions('fromWeek')}
                  </div>
                  {!invalid('start') && <span className="hint week-rows-hint" id="start-hint">The number in the week the plan runs from.</span>}
                  <div className="field">
                    <label className="stack" style={{ gap: 4 }}><span className="small strong">Target</span><input className="input big-input" inputMode="decimal" data-field="target" value={d.target} onChange={(e) => set({ target: e.target.value })} onBlur={leave('target')} aria-invalid={invalid('target')} aria-describedby={invalid('target') ? 'target-fix' : undefined} /></label>
                    {showErr('target')}{keepOffer('target')}{holdOffer}
                  </div>
                  <div onBlur={leave('endWeek')}>
                    <WeekPick cycle={cycle} week={week} field="to" from={span.from} label="To" labelClass="small strong" value={endChoice} onChange={setTo} invalid={invalid('endWeek')} dataField="endWeek" />
                    {showErr('endWeek')}{questions('endWeek')}
                  </div>
                </div>
                <p className="small muted span-says" role="status">{spanSays(cycle, span.from, endChoice, week)}{!(baselineOpen || d.baselinePeriod) && <> <button type="button" className="linkish baseline-open" onClick={() => setBaselineOpen(true)}>Baseline known for a period?</button></>}</p>
                {(baselineOpen || !!d.baselinePeriod) && <BaselineFields period={d.baselinePeriod ?? ''} provisional={!!d.baselineProvisional} onChange={set} invalid={invalid('start')} focus={baselineOpen && !d.baselinePeriod} />}
                {questions('start')}
                {questions('target')}
                {decimalsLine}
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
                  <details className="disclose" open={Object.values(d.points).some((v) => v.trim()) || !!errorOf('points') || undefined}>
                    <summary>Adjust the plan week by week</summary>
                    <PlanTable plan={preview.plan} unit={unitFmt} typed={d.points} onType={(w, v) => set({ points: { ...d.points, [String(w)]: v } })} onReset={() => set({ points: {} })} />
                  </details>
                )}
                {showErr('points')}
                {questions('points')}
              </>
            )}
            {d.kind === 'range' && (
              <div className={'limits' + (d.bound === 'between' ? ' between' : '')}>
                <div className="field limits-bound"><span className="small strong" id="bound">Must stay</span>
                  <div className="seg full" role="group" aria-labelledby="bound">
                    <button type="button" aria-pressed={d.bound === 'atMost'} onClick={() => set({ bound: 'atMost' })}>At most</button>
                    <button type="button" aria-pressed={d.bound === 'atLeast'} onClick={() => set({ bound: 'atLeast' })}>At least</button>
                    <button type="button" aria-pressed={d.bound === 'between'} onClick={() => set({ bound: 'between' })}>Between</button>
                  </div>
                </div>
                {d.bound === 'between' && <label className="field"><span className="small strong">Lower limit</span><input className="input" inputMode="decimal" data-field="lower" value={d.lower} onChange={(e) => set({ lower: e.target.value })} onBlur={leave('lower')} aria-invalid={invalid('lower')} />{showErr('lower')}{keepOffer('lower')}</label>}
                <label className="field"><span className="small strong">{d.bound === 'between' ? 'Upper limit' : 'Limit'}</span><input className="input" inputMode="decimal" data-field="limit" value={d.limit} onChange={(e) => set({ limit: e.target.value })} onBlur={leave('limit')} aria-invalid={invalid('limit')} />{showErr('limit')}{keepOffer('limit')}</label>
                <label className="field"><span className="small strong">Warn this close{optional('margin')}</span><input className="input" inputMode="decimal" data-field="margin" value={d.margin} onChange={(e) => set({ margin: e.target.value })} onBlur={leave('margin')} aria-invalid={invalid('margin')} />{showErr('margin')}{keepOffer('margin')}
                  {!errorOf('margin') && <span className="hint">How near the limit counts as at risk{d.unit.trim() ? `, in ${d.unit.trim()}` : ''}. Left empty, it warns only once the limit is crossed.</span>}</label>
              </div>
            )}
            {d.kind === 'range' && <>{questions('lower')}{questions('limit')}{questions('margin')}</>}
            {d.kind === 'range' && decimalsLine}
            {d.kind === 'range' && <p className="small muted">{rangeSays(cycle, week)}</p>}
            {d.kind === 'milestone' && <p className="small muted">At least one stage, each with a name and the week it’s due. This is {weekSays(cycle, Math.max(0, week), 'short')}, {datesOf(cycle, Math.max(0, week))}.</p>}
            {d.kind === 'milestone' && (
              <StageFields stages={d.stages} cycle={cycle} week={week} labelClass="small strong" error={null} rowErrors={showsFor('stages') ? stageErrors(fix) : []} onLeave={leave('stages')} below={(i) => questions('stages', i)}
                onChange={(stages) => set({ stages })} onAdd={() => set({ stages: [...d.stages, { id: newId('st'), name: '', dueWeek: '' }] })} />
            )}
            {/* With no metric chosen: said in words, so the goal's page doesn't open on "not described yet". */}
            {((noMetric && (!measurePlace || saidNone || !!d.definition.trim() || !!d.source.trim())) || d.kind === 'milestone') && (
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

        {step === 3 && read && (
          <>
            <h1 className="qtitle big">Does this read right?</h1>
            <p className="small muted">Nothing is saved until you publish.</p>
            <h2 className="h3 goal-read-back-name">{d.title.trim() || 'Untitled goal'}</h2>
            {/* Each row wraps: a sentence is never cut to one line (build review of #129, finding 6). */}
            {/* What measures it, worked out from the draft for its team now; draws nothing. */}
            {number && <Place name="goal.measure" goal={null} kind={d.kind} unit={d.unit} decimals={d.decimals} teamId={d.teamId} onChange={setMeasure} kept={d.measureKept} quiet />}
            {/* Its own class: .read-back is Start next year's grid of counts (build review of #202, finding 1). */}
            <ul className="review-rows goal-read-back" aria-label="Read back">
              {read.rows.map((r) => (
                <li key={r.id} data-row={r.id}>
                  <span className="small strong rr-label">{r.label}</span>
                  <span className="rr-value">{r.text}</span>
                  {r.step != null && <button type="button" className="linkish" aria-label={'Change ' + r.label.toLowerCase()} onClick={() => nav(atStep(r.step!), { state: { from: 3, fromCheck: true } })}>Change</button>}
                </li>
              ))}
            </ul>
            {/* Is it under way? (GE10): published as active, or proposed: seen by everyone, nothing due, no status. */}
            <fieldset className="under-way" aria-labelledby="under-way">
              <legend className="small strong" id="under-way">Is it under way?</legend>
              {(['active', 'proposed'] as const).map((k) => (
                <label key={k} className="check under-way-choice">
                  <input type="radio" name="under-way" checked={state === k} onChange={() => set({ state: k })} />
                  <span className="menu-text"><span className="strong">{choices[k].label}</span><span className="small muted">{choices[k].line}</span></span>
                </label>
              ))}
            </fieldset>
            <section className="after-publish" aria-labelledby="after-publish">
              <h2 className="small strong" id="after-publish">{proposing ? 'After you propose it' : 'After you publish'}</h2>
              {read.after.map((t) => <p key={t} className="small">{t}</p>)}
              {read.hint && <p className="hint">{read.hint}</p>}
            </section>
            {saving || published ? null : [0, 1, 2].some((i) => stepErrors(i).length) ? <div className="note-bad small">Something still needs fixing; {proposing ? 'proposing' : 'publishing'} takes you to it.</div>
              : [0, 1, 2].some((i) => stepOpen(i).length) ? <div className="note-bad small">A question is still to answer; publishing takes you to it.</div> : null}
          </>
        )}

        {shown && !gate.go && step < 3 && <FixLine>{gate.says}</FixLine>}
        <div className="focus-foot nav-foot">
          {step > 0 && <button type="button" className="btn" onClick={back}>Back</button>}
          <span style={{ flex: 1 }} />
          {/* Proposed, how it's measured can be said later: straight from Who and where to Check (2.15, item 4). */}
          {step === 1 && proposing && <button type="button" className="linkish skip-measure" onClick={() => go(3)}>Skip: say how it’s measured later</button>}
          <button className="btn primary big-btn" type="submit" disabled={saving}>{published ? (proposing ? 'Proposed' : 'Published') : saving ? 'Saving…' : step < 3 ? 'Continue' : proposing ? 'Propose goal' : 'Publish goal'}</button>
        </div>
      </form>
    </div>
  );
}
