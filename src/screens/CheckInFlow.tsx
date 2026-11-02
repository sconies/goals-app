import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { periodWord, quarterOf, isYear } from '../domain/year';
import { checkInDraftKey, useDraft } from '../app/drafts';
import { CAUSES_AHEAD, CAUSES_BEHIND, causeLabel, draftFrom, emptyDraft, evaluate, MIN_PATH, MIN_REASON, parseNumber, valueProblem, type Draft, type Evaluation } from '../domain/checkin';
import { forecastText } from '../domain/tree';
import { weekDates } from '../domain/plan';
import { fmt, gapText, LEVEL_LABEL, targetText, weekLabel } from '../domain/format';
import { daysToReview, onTimeStreak, weekProgress } from '../domain/progress';
import type { CheckIn, Goal, MilestoneGoal, Status, RecoveryState } from '../domain/types';
import { Chip, Empty, ProgressRing, Sheet } from '../ui/bits';
import { MetricChart, RangeChart } from '../ui/charts';

/** The focused weekly check-in: every due goal, one at a time, then done. */
export function CheckInFlow() {
  const app = useApp();
  const { goalId } = useParams();
  const nav = useNavigate();
  // The queue is fixed when the flow opens, so posting doesn't reshuffle it.
  const [queue] = useState<string[]>(() => {
    if (goalId) return [goalId];
    return weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today).due.map((g) => g.id);
  });
  const [index, setIndex] = useState(0);
  const [justPosted, setJustPosted] = useState<CheckIn | null>(null);
  const [updated, setUpdated] = useState(false);
  const [noData, setNoData] = useState(false);
  const goal = queue[index] ? app.goal(queue[index]) : undefined;

  if (app.week < 1) {
    return <div className="page narrow"><Empty title="Check-ins start in week 1"><span className="muted">The goals have just started. Your first check-in is due next week.</span></Empty></div>;
  }
  if (!queue.length) return <AllDone first />;
  if (index >= queue.length) return <AllDone />;
  if (!goal) return <div className="page narrow"><Empty title="That goal doesn’t exist"><Link className="btn" to="/">Home</Link></Empty></div>;
  if (goal.ownerId !== app.viewer.id) {
    const owner = app.person(goal.ownerId);
    return (
      <div className="page narrow">
        <Empty title={`Only ${owner?.name ?? 'the owner'} checks in on this goal`}>
          <span className="muted">The owner’s call is the official status, so it comes from them. You can follow it on the goal page.</span>
          <div className="row"><Link className="btn primary" to={'/goals/' + goal.id}>Open the goal</Link><Link className="btn" to="/">Home</Link></div>
        </Empty>
      </div>
    );
  }

  const next = () => { setJustPosted(null); setIndex((i) => i + 1); };
  return (
    <>
    {noData && <NoDataSheet goal={goal} onClose={() => setNoData(false)} onDone={() => { setNoData(false); next(); }} />}
    <div className="focus">
      <div className="focus-top">
        <span className="small strong">Check-in{queue.length > 1 ? ` ${Math.min(index + 1, queue.length)} of ${queue.length}` : ''}</span>
        {queue.length > 1 && <div className="dots" aria-hidden="true">{queue.map((id, i) => <i key={id} className={i < index ? 'done' : i === index ? 'now' : ''} />)}</div>}
        <button className="iconbtn" onClick={() => nav('/')} aria-label="Close and save the draft">✕</button>
      </div>
      {justPosted ? (
        <Posted goal={goal} c={justPosted} updated={updated} left={queue.length - index - 1} nextTitle={app.goal(queue[index + 1] ?? '')?.title} onNext={next} />
      ) : (
        <GoalCheckIn key={goal.id} goal={goal} onPosted={(c, updated) => { setUpdated(updated); setJustPosted(c); }} onSkip={goal.kind !== 'milestone' ? () => setNoData(true) : undefined} />
      )}
    </div>
    </>
  );
}

/** No new number this week: say so instead of re-posting last week's. The goal stays due, and its last number stays dated. */
function NoDataSheet({ goal, onClose, onDone }: { goal: Goal; onClose: () => void; onDone: () => void }) {
  const app = useApp();
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await app.addNote(goal, `No new number for week ${app.week}${why.trim() ? `: ${why.trim()}` : '.'}`);
      app.toast(`Noted on ${goal.title}. It stays due until there’s a number.`);
      onDone();
    } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={`No new number: ${goal.title}`}>
      <form className="stack" style={{ gap: 'var(--s3)' }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="hint">Watchers will see that there’s no current data, rather than last week’s number as if it were new. The check-in stays due.</p>
        <label className="field"><span className="field-label">Why? <span className="hint">optional</span></span>
          <textarea className="input" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. The dashboard is down until Tuesday" />
        </label>
        <div className="foot-row"><button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary big-btn" disabled={busy}>Save and skip</button></div>
      </form>
    </Sheet>
  );
}

function AllDone({ first }: { first?: boolean }) {
  const app = useApp();
  const p = weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today);
  const streak = onTimeStreak(app.viewer.id, app.snapshot, app.cycle, app.week);
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="focus">
      <div className="celebrate" role="status">
        <ProgressRing done={p.done.length} total={Math.max(1, p.goals.length)} size={96} />
        <h1 className="title-xl">{!p.goals.length || (first && !p.done.length) ? 'Nothing to check in' : p.due.length ? `${p.done.length} of ${p.goals.length} checked in` : `Week ${app.week} is done`}</h1>
        <p className="muted">{!p.goals.length ? `You don’t own any goals this ${periodWord(app.cycle)}.` : p.due.length ? `Still to do: ${p.due.map((g) => g.title).join(', ')}.` : p.goals.length === 1 ? 'Your goal is checked in for the review.' : p.goals.length === 2 ? 'Both your goals are checked in for the review.' : `All ${p.goals.length} of your goals are checked in for the review.`}</p>
        {streak >= 2 && !p.due.length && <p className="streak big">{streak} weeks in a row on time</p>}
        <div className="row" style={{ justifyContent: 'center' }}>
          {p.due.length > 0 && <Link className="btn primary big-btn" to={`/check-in/${p.due[0]!.id}`}>Check in on {p.due[0]!.title}</Link>}
          <Link ref={ref} className={'btn big-btn' + (p.due.length ? '' : ' primary')} to="/">Back to home</Link>
        </div>
        {p.due.filter((g) => g.kind !== 'milestone').length >= 2 && <Link className="linkish small" to="/quick-check-in">Or type all your numbers in one table</Link>}
      </div>
    </div>
  );
}

/** After posting: what was saved, and the one next thing. The last post of the week is the only confirmation; there's no second "done" screen. */
function Posted({ goal, c, updated, left, nextTitle, onNext }: { goal: Goal; c: CheckIn; updated: boolean; left: number; nextTitle?: string; onNext: () => void }) {
  const app = useApp();
  const btn = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  useEffect(() => btn.current?.focus(), []);
  const p = weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today);
  const late = daysToReview(app.cycle, app.week, app.today) < 0;
  return (
    <div className="celebrate" role="status">
      <span className="tick" aria-hidden="true"><svg viewBox="0 0 48 48" width="64" height="64"><circle cx="24" cy="24" r="22" /><path d="m14 25 7 7 13-15" /></svg></span>
      <h1 className="title-xl">{updated ? 'Update saved' : 'Check-in saved'}</h1>
      <p className="muted">{goal.title}{goal.kind !== 'milestone' && c.value != null ? `: ${fmt(c.value, goal)}` : ''}. Its status is <Chip k={c.status} /></p>
      {!left && <p className="muted">{p.due.length ? `Still due this week: ${p.due.map((g) => g.title).join(', ')}.` : `All ${p.goals.length === 1 ? 'your goal is' : `${p.goals.length} of your goals are`} checked in for week ${app.week}${late ? ', after the review day' : ''}.`}</p>}
      <div className="row" style={{ justifyContent: 'center' }}>
        {left
          ? <button ref={btn} className="btn primary big-btn" onClick={onNext}>Next: {nextTitle}</button>
          : <Link ref={btn} className="btn primary big-btn" to="/">Back to home</Link>}
        <Link className="btn big-btn" to={'/goals/' + goal.id}>View the goal</Link>
      </div>
      {left > 0 && <p className="tiny muted">{left} to go</p>}
    </div>
  );
}

type Step = 'measure' | 'carry' | 'why' | 'way';

/**
 * One goal's check-in, one question per screen: the number; last week's note if it still applies;
 * why; the way back. An on-plan goal is just the number. The button always names the next step.
 */
function GoalCheckIn({ goal, onPosted, onSkip }: { goal: Goal; onPosted: (c: CheckIn, updated: boolean) => void; onSkip?: () => void }) {
  const app = useApp();
  const { week, cycle } = app;
  const own = app.checkInsOf(goal);
  const existing = own.find((c) => c.week === week) ?? null;
  const previous = [...own].reverse().find((c) => c.week < week) ?? null;
  const [draft, set, clear, restored] = useDraft<Draft>(checkInDraftKey(app.ws.id, goal.id, week), () => (existing ? draftFrom(existing) : emptyDraft(goal, previous)));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNext, setShowNext] = useState(!!draft.next);
  const [showNeedsOpen, setShowNeeds] = useState(!!draft.needs);
  const showNeeds = showNeedsOpen || !!draft.needs.trim();
  const [statusOpen, setStatusOpen] = useState(false);
  // Who a help request goes to, when the owner says they need a decision or help.
  const [helpFrom, setHelpFrom] = useState(() => app.snapshot.people.find((p) => draft.needs.startsWith(p.name + ':'))?.id ?? '');
  // The step is saved with the draft, so "pick up where you left off" returns to it.
  const stepKey = checkInDraftKey(app.ws.id, goal.id, week) + ':step';
  const [step, setStepState] = useState<Step>(() => {
    if (!restored) return 'measure';
    try { return (localStorage.getItem(stepKey) as Step | null) ?? 'measure'; } catch { return 'measure'; }
  });
  const setStep = (to: Step) => { setStepState(to); try { if (to === 'measure') localStorage.removeItem(stepKey); else localStorage.setItem(stepKey, to); } catch { /* private mode */ } };
  const [trail, setTrail] = useState<Step[]>([]);
  const e = evaluate(goal, cycle, week, draft, app.snapshot.checkIns);
  const team = app.team(goal.teamId);

  const valueOk = goal.kind === 'milestone' || !e.missing.some((m) => m.includes('value'));
  const needsWhy = valueOk && !!e.reason;
  const needsWay = valueOk && e.needsPath;
  // Last week's story, offered back when this week still needs a reason or a path.
  const priorCauseOk = !!previous?.cause && (e.reason === 'ahead' ? CAUSES_AHEAD : CAUSES_BEHIND).some(([k]) => k === previous.cause);
  const priorWhy = needsWhy && priorCauseOk && !!previous?.why && previous.why !== 'On plan.';
  const priorWay = needsWay && !!previous?.pathToGreen;
  // Once the owner has written their own reason or path, last week's is no longer offered (or pasted over it).
  const edited = (!!draft.why.trim() && draft.why !== previous?.why) || (!!draft.ptgWhat.trim() && draft.ptgWhat !== previous?.pathToGreen?.what) || (!!draft.cause && draft.cause !== previous?.cause);
  const canCarry = !existing && !edited && !!previous && (needsWhy || needsWay) && (!needsWhy || priorWhy) && (!needsWay || priorWay);
  const fromLast = (): Partial<Draft> => ({
    ...(priorWhy ? { cause: previous!.cause, why: previous!.why } : {}),
    ...(priorWay ? { ptgWhat: previous!.pathToGreen!.what, ptgBy: (previous!.pathToGreen!.byWeek ?? 0) > week ? previous!.pathToGreen!.byWeek : null, ptgState: previous!.pathToGreen!.state ?? 'plan', needs: previous!.pathToGreen!.needs } : {}),
  });
  // With last week's note on offer, "Still true" can finish at step two; the why and way steps count once they're needed.
  const detailed = !canCarry || step === 'why' || step === 'way';
  const plan: Step[] = ['measure', ...(canCarry ? ['carry' as const] : []), ...(detailed && needsWhy ? ['why' as const] : []), ...(detailed && needsWay ? ['way' as const] : [])];
  const last = plan[plan.length - 1] === step || (step === 'why' && !needsWay);

  const go = (to: Step) => { setTrail((t) => [...t, step]); setStep(to); setTried(false); };
  const back = () => { setStep(trail[trail.length - 1] ?? 'measure'); setTrail((t) => t.slice(0, -1)); setTried(false); };

  const post = async (d: Draft = draft) => {
    const check = evaluate(goal, cycle, week, d, app.snapshot.checkIns);
    if (!check.canPost || saving) { setTried(true); return; }
    setSaving(true);
    try {
      const from = d.ptgState === 'help' ? app.person(helpFrom) : undefined;
      const c = await app.postCheckIn(goal, { ...d, proposeTarget: '', ...(from ? { needs: `${from.name}: ${d.ptgWhat.trim()}` } : {}) }, existing);
      clear();
      onPosted(c, !!existing);
    } catch {
      setSaving(false);
    }
  };

  // What the current step still needs, in plain words, shown under the field once they've tried.
  const whyOk = !needsWhy || (!!draft.cause && draft.why.trim().length >= MIN_REASON);
  const targetOk = !e.missing.some((m) => m.includes('target'));
  const planned = (draft.ptgState ?? 'plan') === 'plan';
  const wayOk = !needsWay || (draft.ptgWhat.trim().length >= MIN_PATH && (!planned || (draft.ptgBy != null && draft.ptgBy > week)) && (draft.ptgState !== 'help' || !!helpFrom));
  const primary = () => {
    if (step === 'measure') {
      if (!valueOk || e.missing.some((m) => m.startsWith('why your call'))) { setTried(true); return; }
      if (needsWhy || needsWay) go(canCarry && !existing ? 'carry' : needsWhy ? 'why' : 'way');
      else void post();
    } else if (step === 'why') {
      if (!whyOk || !targetOk) { setTried(true); return; }
      if (needsWay) go('way'); else void post();
    } else if (step === 'way') {
      if (!wayOk) { setTried(true); return; }
      void post();
    }
  };
  const stillTrue = () => {
    const d = { ...draft, ...fromLast() };
    set(fromLast());
    const check = evaluate(goal, cycle, week, d, app.snapshot.checkIns);
    if (check.canPost) void post(d);
    else go(check.missing.some((m) => m.startsWith('why it’s')) ? 'why' : 'way');
  };
  const somethingChanged = () => {
    // Start from last week's words so they can be edited; the help request only if they open it again.
    const f = fromLast();
    set({ ...f, needs: '' });
    go(needsWhy ? 'why' : 'way');
  };

  const label = saving ? 'Posting…' : last ? (existing ? 'Post update' : 'Post check-in') : 'Next';
  // Count every step this check-in could need, so the total never grows partway through; "Still true" just finishes early.
  const carryOffered = useRef(false);
  if (canCarry) carryOffered.current = true;
  const full: Step[] = ['measure', ...(carryOffered.current ? ['carry' as const] : []), ...(needsWhy ? ['why' as const] : []), ...(needsWay ? ['way' as const] : [])];
  const stepNo = Math.max(1, full.indexOf(step) + 1);

  return (
    <form className="focus-body" onSubmit={(ev) => { ev.preventDefault(); primary(); }} noValidate>
      <GoalHead goal={goal} previous={existing ?? previous} compact={step !== 'measure'} teamLine={goal.level !== 'team' ? `${LEVEL_LABEL[goal.level]} · ${team?.name ?? ''}` : team?.name} steps={full.length > 1 ? { at: stepNo, of: full.length } : undefined} />
      {existing && step === 'measure' && <p className="hint">You checked in for week {week} already. This replaces it; the change log keeps both.</p>}
      {restored && step === 'measure' && <p className="hint">Picked up where you left off.</p>}

      {step === 'measure' && (
        <section className="qsection" aria-label="This week">
          <div className="stack" style={{ gap: 'var(--s1)' }}>
            <h2 className="qtitle">{goal.kind === 'milestone' ? 'Where does each stage stand?' : 'What’s the number this week?'}</h2>
            {goal.kind !== 'milestone' && goal.definition && <span className="small">{goal.definition}{goal.unit ? ` (${goal.unit}, ${goal.kind === 'metric' ? (goal.plan.target < goal.plan.start ? 'lower is better' : 'higher is better') : goal.range.bound === 'atMost' ? 'stay at or under the limit' : 'stay at or above the limit'})` : ''}</span>}
            {goal.source && <span className="hint">Where to get it: {goal.source}. Typed in by hand.</span>}
          </div>
          {goal.kind === 'milestone' ? <StageEditor goal={goal} draft={draft} set={set} /> : (
            <div className="stack">
              <label className="bignum">
                <span className="sr">This week’s value</span>
                <input inputMode="decimal" enterKeyHint="next" autoComplete="off" autoFocus value={draft.value} onChange={(ev) => set({ value: ev.target.value })}
                  placeholder="Type it here" aria-describedby="value-hint" aria-label="This week’s value" aria-invalid={tried && !valueOk} />
                {goal.unit && <span className="bignum-unit">{goal.unit}</span>}
              </label>
              {(() => {
                const pr = valueProblem(draft.value, previous?.value ?? null, goal.unit);
                if (pr && (tried || (!pr.block && draft.value.trim()) || (pr.block && draft.value.trim() && parseNumber(draft.value) != null))) return <span className={'hint ' + (pr.block ? 'tone-off' : 'tone-risk')} role={pr.block ? 'alert' : 'status'}>{pr.text}</span>;
                return null;
              })() ?? (tried && !valueOk
                ? <span className="hint tone-off" role="alert">Type this week’s number.</span>
                : <span id="value-hint" className="valuehint hint">
                    <span>{previous?.value != null ? `Week ${previous.week}: ${fmt(previous.value, goal)}` : 'First check-in'}</span>
                    {previous?.value != null && !draft.value && <button type="button" className="linkish tap" onClick={() => set({ value: String(previous.value) })}>Measured again: unchanged</button>}
                  </span>)}
              {previous?.value != null && draft.value.trim() !== '' && parseNumber(draft.value) === previous.value && <span className="hint">Same as week {previous.week}. Post it only if you measured it again this week.</span>}
              {!draft.value.trim() && onSkip && <button type="button" className="linkish tap small" style={{ alignSelf: 'flex-start' }} onClick={onSkip}>No new number this week</button>}
            </div>
          )}
          {valueOk && (goal.kind !== 'milestone' || draft.stages.length > 0) && (
            <>
              {goal.kind !== 'milestone' && <Verdict goal={goal} e={e} />}
              <div className="callline">
                <span className="muted">Status</span><Chip k={e.status} />
                <span className="muted">{e.status === e.calc ? 'from the numbers' : 'your call'}</span>
                <button type="button" className="linkish tap" onClick={() => setStatusOpen(true)}>Change</button>
              </div>
              {tried && e.missing.some((m) => m.startsWith('why your call')) && <span className="hint tone-off" role="alert">Say why it’s better than the numbers: tap Change.</span>}
              {last && <NextStepField draft={draft} set={set} open={showNext} onOpen={() => setShowNext(true)} />}
            </>
          )}
          <StatusSheet open={statusOpen} onClose={() => setStatusOpen(false)} e={e} draft={draft} set={set} milestoneDone={goal.kind === 'milestone' && e.calc === 'done'} />
        </section>
      )}

      {step === 'carry' && previous && (
        <section className="qsection" aria-label="Last week’s note">
          <h2 className="qtitle">Is last week’s note still true?</h2>
          <blockquote className="quote">
            {priorWhy && <p><strong>{causeLabel(previous.cause)}.</strong> {previous.why}</p>}
            {priorWay && <p><strong>{previous.pathToGreen!.byWeek != null ? `Back on plan by ${weekLabel(previous.pathToGreen!.byWeek, cycle.weeks)}.` : `${RECOVERY[previous.pathToGreen!.state ?? 'plan'].label}.`}</strong> {previous.pathToGreen!.what}</p>}
          </blockquote>
          <div className="choice">
            <button type="button" className="btn primary big-btn" disabled={saving} onClick={stillTrue}>{saving ? 'Posting…' : 'Still true: post check-in'}</button>
            <button type="button" className="btn big-btn" onClick={somethingChanged}>Something changed</button>
          </div>
          {priorWay && previous.pathToGreen!.byWeek != null && previous.pathToGreen!.byWeek <= week && <span className="hint">The week you gave has passed, so you’ll pick a new one.</span>}
        </section>
      )}

      {step === 'why' && (
        <section className="qsection" aria-label="Why">
          <h2 className="qtitle">{e.reason === 'ahead' ? 'Why is it ahead?' : goal.kind === 'milestone' ? 'Why is it late?' : 'Why is it behind?'}</h2>
          <div className="row" role="group" aria-label="Main cause">
            {(e.reason === 'ahead' ? CAUSES_AHEAD : CAUSES_BEHIND).map(([k, l]) => <button key={k} type="button" className="pill" aria-pressed={draft.cause === k} onClick={() => set({ cause: k })}>{l}</button>)}
          </div>
          <label className="field">
            <span className="sr">What happened</span>
            <textarea className={'input' + (tried && draft.why.trim().length < MIN_REASON ? ' invalid' : '')} rows={3} value={draft.why} onChange={(ev) => set({ why: ev.target.value })} aria-label="What happened"
              placeholder={e.reason === 'ahead' ? 'What happened, and will it last?' : 'What is causing the gap?'} />
          </label>
          {tried && !whyOk && <span className="hint tone-off" role="alert">{!draft.cause ? 'Pick a cause, then write a sentence.' : 'Write a sentence about what happened.'}</span>}
          {e.asksTarget && goal.kind === 'metric' && app.viewer.id === goal.ownerId && (
            <p className="hint">Well ahead of plan. If the target should move, <Link className="linkish" to={`/goals/${goal.id}/edit`}>change it</Link> after posting; watchers see the change and your reason.</p>
          )}
          {last && <NextStepField draft={draft} set={set} open={showNext} onOpen={() => setShowNext(true)} />}
        </section>
      )}

      {step === 'way' && (
        <section className="qsection" aria-label="The way back">
          <h2 className="qtitle">Where are you with getting it back on plan?</h2>
          <div className="optlist" role="radiogroup" aria-label="Where you are">
            {(Object.keys(RECOVERY) as RecoveryState[]).map((k) => (
              <button key={k} type="button" role="radio" className="opt" aria-checked={(draft.ptgState ?? 'plan') === k} onClick={() => set({ ptgState: k, ...(k !== 'plan' ? { ptgBy: null } : {}) })}>
                <span>{RECOVERY[k].label}</span><span className="hint">{RECOVERY[k].hint}</span>
              </button>
            ))}
          </div>
          <label className="field">
            <span className="field-label">{RECOVERY[draft.ptgState ?? 'plan'].ask}</span>
            <textarea className={'input' + (tried && draft.ptgWhat.trim().length < MIN_PATH ? ' invalid' : '')} rows={2} value={draft.ptgWhat} onChange={(ev) => set({ ptgWhat: ev.target.value })} aria-label={RECOVERY[draft.ptgState ?? 'plan'].ask} />
          </label>
          {planned && (
            <div className="field"><span className="field-label" id="ptg-by">Back on plan by</span>
              <WeekPicks week={week} weeks={cycle.weeks} value={draft.ptgBy} onPick={(w) => set({ ptgBy: w })} />
            </div>
          )}
          {tried && !wayOk && <span className="hint tone-off" role="alert">{draft.ptgWhat.trim().length < MIN_PATH ? 'Say a few words about it.' : 'Pick the week it’s back on plan, or choose another option if you don’t know yet.'}</span>}
          {draft.ptgState === 'help' ? (
            // One request: what's needed (above) and who from. Saved as the goal's "decision or help needed".
            <label className="field"><span className="field-label">Who can decide or help?</span>
              <select className="input" value={helpFrom} onChange={(ev) => setHelpFrom(ev.target.value)}>
                <option value="">Pick someone</option>
                {app.snapshot.people.filter((p) => p.id !== app.viewer.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {tried && !helpFrom && <span className="hint tone-off" role="alert">Pick who it goes to.</span>}
            </label>
          ) : showNeeds
            ? <label className="field"><span className="field-label">Also need a decision or help? <span className="muted" style={{ fontWeight: 400 }}>Optional; shown at the top of the goal and in reviews</span></span><input className="input" value={draft.needs} onChange={(ev) => set({ needs: ev.target.value })} placeholder="e.g. Elena: approve an interim scope" /></label>
            : <div><button type="button" className="linkish tap" onClick={() => setShowNeeds(true)}>Also need a decision or help?</button></div>}
          <NextStepField draft={draft} set={set} open={showNext} onOpen={() => setShowNext(true)} />
        </section>
      )}

      {step !== 'carry' ? (
        <div className="focus-foot">
          <div className="foot-row">
            {trail.length > 0 && <button type="button" className="btn ghost" onClick={back}>Back</button>}
            <button className="btn primary big-btn" type="submit" disabled={saving}>{label}</button>
          </div>
        </div>
      ) : (
        <div className="focus-foot"><div className="foot-row"><button type="button" className="btn ghost" onClick={back}>Back</button></div></div>
      )}
    </form>
  );
}

/** The honest answers to "how does it get back on plan?": only a plan has a date. */
const RECOVERY: Record<RecoveryState, { label: string; hint: string; ask: string }> = {
  plan: { label: 'I have a plan', hint: 'And a week it’s back on plan', ask: 'What changes?' },
  investigating: { label: 'Still investigating', hint: 'No date yet', ask: 'What are you looking into?' },
  help: { label: 'Need a decision or help', hint: 'Someone else has to act', ask: 'What’s needed, and from whom?' },
  target: { label: 'The target should change', hint: 'The plan no longer fits', ask: 'Why, and to what?' },
};

function NextStepField({ draft, set, open, onOpen }: { draft: Draft; set: (p: Partial<Draft>) => void; open: boolean; onOpen: () => void }) {
  return open
    ? <label className="field"><span className="field-label">Next step <span className="muted" style={{ fontWeight: 400 }}>Optional</span></span><input className="input" value={draft.next} onChange={(ev) => set({ next: ev.target.value })} placeholder="One thing that will move this before next week" /></label>
    : <div><button type="button" className="linkish tap" onClick={onOpen}>Add a next step</button></div>;
}

/** The owner's call: the numbers' status by default; another one needs a reason if it's better. */
function StatusSheet({ open, onClose, e, draft, set, milestoneDone }: { open: boolean; onClose: () => void; e: Evaluation; draft: Draft; set: (p: Partial<Draft>) => void; milestoneDone: boolean }) {
  const [tried, setTried] = useState(false);
  const opts: Status[] = milestoneDone ? ['done', 'on', 'risk', 'off'] : ['on', 'risk', 'off'];
  const okWhy = !e.greener || draft.greenerWhy.trim().length >= MIN_REASON;
  return (
    <Sheet open={open} onClose={onClose} title="Status">
      <div className="stack" style={{ gap: 'var(--s3)' }}>
        <div className="optlist" role="radiogroup" aria-label="Status">
          {opts.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={e.status === k} className="opt" onClick={() => set({ status: k === e.calc ? null : k })}>
              <Chip k={k} /><span className="hint">{k === e.calc ? 'From the numbers' : ''}</span>
            </button>
          ))}
        </div>
        {e.greener && (
          <label className="field">
            <span className="field-label">Why is it better than the numbers?</span>
            <input className={'input' + (tried && !okWhy ? ' invalid' : '')} autoFocus value={draft.greenerWhy} onChange={(ev) => set({ greenerWhy: ev.target.value })} placeholder="e.g. The fix ships Monday and closes the gap" />
            {tried && !okWhy && <span className="hint tone-off" role="alert">Write a sentence so people watching know why.</span>}
          </label>
        )}
        <button type="button" className="btn primary big-btn" onClick={() => { if (!okWhy) { setTried(true); return; } onClose(); }}>Done</button>
      </div>
    </Sheet>
  );
}

function WeekPicks({ week, weeks, value, onPick }: { week: number; weeks: number; value: number | null; onPick: (w: number) => void }) {
  const { cycle } = useApp();
  return (
    <div className="row" role="group" aria-labelledby="ptg-by">
      {Array.from({ length: Math.max(0, weeks - week) }, (_, i) => week + 1 + i).filter((w, i, arr) => i < 4 || w === arr[arr.length - 1] || (isYear(cycle) && w === quarterOf(cycle, week).to)).map((w) => {
        const name = w === weeks ? (isYear(cycle) ? 'Year end' : 'Cycle end') : isYear(cycle) && w === quarterOf(cycle, week).to && w > week + 4 ? `End of ${quarterOf(cycle, week).label}` : 'Week ' + w;
        return <button key={w} type="button" className="pill" aria-pressed={value === w} onClick={() => onPick(w)} aria-label={`${name}${name.startsWith('Week') ? '' : ', week ' + w}, ${weekDates(cycle, w)}`}>{name}<span className="pill-sub">{weekDates(cycle, w)}</span></button>;
      })}
    </div>
  );
}

function GoalHead({ goal, previous, teamLine, compact, steps }: { goal: Goal; previous: CheckIn | null; teamLine?: string; compact?: boolean; steps?: { at: number; of: number } }) {
  const app = useApp();
  return (
    <div className="goalhead">
      <div className="row between nowrap">
        {teamLine ? <span className="eyebrow">{teamLine}</span> : <span />}
        {steps && <span className="dots" role="img" aria-label={`Step ${steps.at} of ${steps.of}`}>{Array.from({ length: steps.of }, (_, k) => <i key={k} className={k + 1 < steps.at ? 'done' : k + 1 === steps.at ? 'now' : ''} />)}</span>}
      </div>
      <h1 className="title-xl">{goal.title}</h1>
      {!compact && previous && <span className="row hint" style={{ gap: 'var(--s2)' }}><Chip k={previous.status} />at the week {previous.week} check-in</span>}
      {!compact && !previous && app.week > 1 && <span className="hint">No check-in yet</span>}
    </div>
  );
}

/** What the number means, the moment it's typed: one sentence and a chart. */
function Verdict({ goal, e }: { goal: Goal; e: Evaluation }) {
  const app = useApp();
  const a = e.assessment;
  const gap = gapText(goal, a);
  const history = app.checkInsOf(goal).filter((c) => c.week < app.week && c.value != null).map((c) => ({ week: c.week, value: c.value as number }));
  const series = a.kind !== 'milestone' && a.actual != null ? [...history, { week: app.week, value: a.actual }] : history;
  const [chart, setChart] = useState(false);
  // Number first, then one plain sentence; a forecast line only when it tells you something.
  let title = gap.short, line = gap.long + '.', forecast: { text: string; warn: boolean } | null = null;
  if (a.kind === 'metric' && goal.kind === 'metric' && a.ratio != null && a.actual != null) {
    // Two different questions, kept apart: where it is against this week's plan, and where the recent trend ends up.
    title = `This week: ${gap.short}`;
    line = `${fmt(a.actual, goal)} against ${fmt(a.plan, goal)} planned for week ${app.week}.`;
    const fc = forecastText(goal, a, app.cycle.weeks);
    if (fc) forecast = { text: (fc.warn ? 'By the due date: ' : '') + fc.text + (fc.warn && a.ratio >= 1 ? ' The plan expects a faster pace later, so the two can disagree.' : ''), warn: fc.warn };
  } else if (a.kind === 'range' && goal.kind === 'range') line = `${gap.long}. The limit is ${targetText(goal)}.`;
  const hasChart = a.kind !== 'milestone';
  return (
    <div className="verdict" data-tone={gap.tone} role="status">
      <div className="verdict-head">
        <span className={'tone-' + gap.tone}>{title}</span>
        {hasChart && <button type="button" className="linkish tap small" aria-expanded={chart} onClick={() => setChart(!chart)}>{chart ? 'Hide chart' : 'Show chart'}</button>}
      </div>
      <span>{line}</span>
      {forecast && (forecast.warn ? <span className="forecast"><span aria-hidden="true">↘</span>{forecast.text}</span> : <span className="muted">{forecast.text}</span>)}
      {chart && <div className="chartwrap">
        {a.kind === 'metric' && goal.kind === 'metric' && <MetricChart goal={goal} weeks={app.cycle.weeks} week={app.week} series={series} forecast={a.forecast} height={150} />}
        {a.kind === 'range' && goal.kind === 'range' && <RangeChart goal={goal} weeks={app.cycle.weeks} week={app.week} series={series} height={140} />}
      </div>}
    </div>
  );
}

/** Stages as rows: finished ones fold into one line; tap an open stage to say where it stands. */
function StageEditor({ goal, draft, set }: { goal: MilestoneGoal; draft: Draft; set: (p: Partial<Draft>) => void }) {
  const { week, cycle } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const upd = (stageId: string) => draft.stages.find((u) => u.stageId === stageId);
  const update = (stageId: string, doneWeek: number | null, forecastWeek: number | null) =>
    set({ stages: goal.stages.map((s) => (s.id === stageId ? { stageId, doneWeek, forecastWeek } : upd(s.id) ?? { stageId: s.id, doneWeek: null, forecastWeek: null })) });
  const done = goal.stages.filter((s) => upd(s.id)?.doneWeek != null);
  const open = goal.stages.filter((s) => upd(s.id)?.doneWeek == null || showDone);
  const state = (s: MilestoneGoal['stages'][number]) => {
    const u = upd(s.id);
    if (u?.doneWeek != null) return { text: `Done in week ${u.doneWeek}`, tone: 'done' as const };
    const exp = u?.forecastWeek ?? Math.max(s.dueWeek, week);
    if (exp > s.dueWeek) return { text: `Late, now week ${exp}`, tone: exp - s.dueWeek > 2 ? 'off' as const : 'risk' as const };
    return { text: 'On schedule', tone: 'on' as const };
  };
  const current = goal.stages.find((s) => s.id === editing);
  const lateFrom = current ? Math.min(cycle.weeks, Math.max(current.dueWeek + 1, week)) : week;
  return (
    <div className="stack">
      {done.length > 0 && !showDone && (
        <div className="row hint" style={{ gap: 'var(--s2)' }}><Chip k="done" label={`${done.length} done`} /><span className="ellipsis" style={{ flex: 1, minWidth: 0 }}>{done.map((s) => s.name).join(', ')}</span><button type="button" className="linkish tap" onClick={() => setShowDone(true)}>Show</button></div>
      )}
      <ul className="stagepick">
        {open.map((s) => {
          const st = state(s);
          return (
            <li key={s.id}>
              <button type="button" className="stagepick-row" onClick={() => setEditing(s.id)}>
                <span className="stack" style={{ gap: 0, minWidth: 0 }}><span className="strong">{s.name}</span><span className="hint">Due {weekLabel(s.dueWeek, cycle.weeks)}</span></span>
                <span className={'stagepick-state tone-' + st.tone}>{st.text}</span>
                <span className="chev" aria-hidden="true">›</span><span className="sr">Change</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Sheet open={!!current} onClose={() => setEditing(null)} title={current?.name ?? ''}>
        {current && (
          <div className="stack" style={{ gap: 'var(--s4)' }}>
            <span className="hint">Due {weekLabel(current.dueWeek, cycle.weeks)}</span>
            <div className="optlist" role="radiogroup" aria-label={current.name}>
              <button type="button" role="radio" className="opt" aria-checked={upd(current.id)?.doneWeek != null} onClick={() => { update(current.id, week, null); setEditing(null); }}>Done</button>
              {current.dueWeek >= week && <button type="button" role="radio" className="opt" aria-checked={state(current).tone === 'on'} onClick={() => { update(current.id, null, null); setEditing(null); }}>On schedule</button>}
            </div>
            {current.dueWeek < cycle.weeks && (
              <div className="field"><span className="field-label" id="late-l">Late: now expected in</span>
                <div className="row" role="group" aria-labelledby="late-l">
                  {Array.from({ length: cycle.weeks - lateFrom + 1 }, (_, k) => lateFrom + k).filter((w, k, arr) => k < 4 || w === arr[arr.length - 1]).map((w) => (
                    <button key={w} type="button" className="pill" aria-pressed={upd(current.id)?.doneWeek == null && upd(current.id)?.forecastWeek === w} onClick={() => { update(current.id, null, w); setEditing(null); }}>{w === cycle.weeks ? 'Cycle end' : 'Week ' + w}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
