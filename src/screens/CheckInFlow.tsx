import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { periodWord, quarterOf, isYear } from '../domain/year';
import { checkInDraftKey, useDraft } from '../app/drafts';
import { CAUSES_AHEAD, CAUSES_BEHIND, causeLabel, emptyDraft, evaluate, MIN_PATH, MIN_REASON, parseNumber, REASON_CODES, VALUE_CODES, valueProblem, type Draft, type Evaluation } from '../domain/checkin';
import { answeredSince, askText, openFor } from '../domain/requests';
import { forecastText } from '../domain/tree';
import { weekDates } from '../domain/plan';
import { fmt, gapText, LEVEL_LABEL, targetText, weekLabel } from '../domain/format';
import { daysToReview, onTimeStreak, weekProgress } from '../domain/progress';
import type { CheckIn, Goal, HelpRequest, MilestoneGoal, Status, RecoveryState } from '../domain/types';
import { Chip, Empty, ProgressRing, Sheet } from '../ui/bits';
import { MetricChart, RangeChart } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { useMark } from '../telemetry/react';

/** The focused weekly check-in: every due goal, one at a time, then done. */
export function CheckInFlow() {
  // A fresh flow for each goal (or the whole week): moving from /check-in to /check-in/:goal must not keep the old queue.
  const { goalId } = useParams();
  return <Flow key={goalId ?? 'week'} goalId={goalId} />;
}

function Flow({ goalId }: { goalId?: string }) {
  const app = useApp();
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
    <div className="focus ci">
      <div className="focus-top">
        {/* The goal counter is words; the dots under the title are this goal's steps, so the two never look alike. */}
        <span className="small strong">Check-in{queue.length > 1 ? ` ${Math.min(index + 1, queue.length)} of ${queue.length}` : ''}</span>
        <button className="iconbtn" onClick={() => nav('/')} aria-label="Close and save the draft"><Icon name="close" /></button>
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
    <div className="focus ci">
      <div className="celebrate" role="status">
        <ProgressRing done={p.done.length} total={Math.max(1, p.goals.length)} size={96} />
        <h1 className="title-xl">{!p.goals.length || (first && !p.done.length) ? 'Nothing to check in' : p.due.length ? `${p.done.length} of ${p.goals.length} checked in` : `Week ${app.week} is done`}</h1>
        <p className="muted">{!p.goals.length ? `You don’t own any goals this ${periodWord(app.cycle)}.` : p.due.length ? `Still to do: ${p.due.map((g) => g.title).join(', ')}.` : p.goals.length === 1 ? 'Your goal is checked in for the review.' : p.goals.length === 2 ? 'Both your goals are checked in for the review.' : `All ${p.goals.length} of your goals are checked in for the review.`}</p>
        {streak >= 2 && !p.due.length && <p className="streak big">{streak} weeks in a row on time</p>}
        <div className="row done-actions">
          {p.due.length > 0 && <Link className="btn primary big-btn" to={`/check-in/${p.due[0]!.id}`}>Check in on {p.due[0]!.title}</Link>}
          <Link ref={ref} className={'btn big-btn' + (p.due.length ? '' : ' primary')} to="/">Back to home</Link>
        </div>
        {p.due.filter((g) => g.kind !== 'milestone').length >= 2 && <Link className="linkish small" to="/quick-check-in">Or type all your numbers in one table</Link>}
        {!p.due.length && p.goals.length > 0 && (
          <p className="small again-links">Something changed since? Check in again on{' '}
            {p.goals.map((g, i) => <span key={g.id}>{i > 0 ? (i === p.goals.length - 1 ? ' or ' : ', ') : ''}<Link className="linkish" to={`/check-in/${g.id}`}>{g.title}</Link></span>)}.
          </p>
        )}
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
      <h1 className="title-xl">Check-in saved</h1>{updated && <p className="muted">Kept alongside your earlier check-in this week; this one is now the week’s status.</p>}
      <p className="muted">{goal.title}{goal.kind !== 'milestone' && c.value != null ? `: ${fmt(c.value, goal)}` : ''}. Its status <span className="nobr">is <Chip k={c.status} /></span></p>
      {c.pathToGreen?.needs && <p className="small">Asked for: {c.pathToGreen.needs}. It shows on the goal and on their Home.</p>}
      {!left && <p className="muted">{p.due.length ? `Still due this week: ${p.due.map((g) => g.title).join(', ')}.` : `All ${p.goals.length === 1 ? 'your goal is' : `${p.goals.length} of your goals are`} checked in for week ${app.week}${late ? ', after the review day' : ''}.`}</p>}
      <div className="row done-actions">
        {left
          ? <button ref={btn} className="btn primary big-btn" onClick={onNext}>Next: {nextTitle}</button>
          : <Link ref={btn} className="btn primary big-btn" to="/">Back to home</Link>}
        {/* The goal page shows it landing: the new point drops onto the chart, and the call and the streak with it. */}
        <Link className="btn big-btn" to={`/goals/${goal.id}?posted=1`}>View the goal</Link>
      </div>
      {left > 0 && <p className="tiny muted">{left} to go</p>}
      {/* A mistake is cheap to fix: check in again and the newer one becomes the week's status; both are kept. */}
      <p className="small muted">Got something wrong? <Link className="linkish" to={`/check-in/${goal.id}`}>Correct this check-in</Link></p>
    </div>
  );
}

type Step = 'measure' | 'carry' | 'account';

/**
 * One goal's check-in: the number first; then last week's note if it still applies ("Still true" posts it); then, when
 * something changed, one short account on one screen: what changed, what happens next, by when (Senior UX review,
 * finding 11). An on-plan goal is just the number. The button says Continue until the step that posts.
 */
function GoalCheckIn({ goal, onPosted, onSkip }: { goal: Goal; onPosted: (c: CheckIn, updated: boolean) => void; onSkip?: () => void }) {
  const app = useApp();
  const { week, cycle } = app;
  const own = app.checkInsOf(goal);
  // Already checked in this week? This one is added alongside it (ad hoc), starting from where the last one left off.
  const existing = [...own].reverse().find((c) => c.week === week) ?? null;
  const previous = own[own.length - 1] ?? null;
  const [draft, set, clear, restored] = useDraft<Draft>(checkInDraftKey(app.ws.id, goal.id, week), () => emptyDraft(goal, previous));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNext, setShowNext] = useState(!!draft.next);
  const [showNeedsOpen, setShowNeeds] = useState(!!draft.needs);
  const showNeeds = showNeedsOpen || !!draft.needs.trim();
  const [statusOpen, setStatusOpen] = useState(false);
  // Waiting on a decision already asked for another goal: linked here, in the check-in, where the owner says what's
  // needed (moved from the goal page, 5 Nov). One answer then covers both goals.
  const [linking, setLinking] = useState(false);
  const othersAsked = (app.snapshot.requests ?? []).filter((r) => r.status === 'open' && !r.goalIds.includes(goal.id));
  // Who a help request goes to, when the owner says they need a decision or help.
  const [helpFrom, setHelpFrom] = useState(() => app.snapshot.people.find((p) => draft.needs.startsWith(p.name + ':'))?.id ?? '');
  // The step is saved with the draft, so "pick up where you left off" returns to it.
  const stepKey = checkInDraftKey(app.ws.id, goal.id, week) + ':step';
  const [step, setStepState] = useState<Step>(() => {
    if (!restored) return 'measure';
    try {
      const saved = localStorage.getItem(stepKey);
      // A draft saved when the account was two screens comes back on the one.
      return saved === 'why' || saved === 'way' ? 'account' : (saved as Step | null) ?? 'measure';
    } catch { return 'measure'; }
  });
  const setStep = (to: Step) => { setStepState(to); try { if (to === 'measure') localStorage.removeItem(stepKey); else localStorage.setItem(stepKey, to); } catch { /* private mode */ } };
  const [trail, setTrail] = useState<Step[]>([]);
  // Where this check-in is, for the named flow (src/help/flows.ts): opened, then saying why or carrying last week's over.
  useMark('checkIn.open');
  useMark(step === 'account' ? 'checkIn.account' : step === 'carry' ? 'checkIn.carry' : null);
  const e = evaluate(goal, cycle, week, draft, app.snapshot.checkIns);
  const team = app.team(goal.teamId);

  const valueOk = goal.kind === 'milestone' || !e.codes.some((c) => VALUE_CODES.includes(c));
  const needsWhy = valueOk && !!e.reason;
  const needsWay = valueOk && e.needsPath;
  // Last week's story, offered back when this week still needs a reason or a path.
  const priorCauseOk = !!previous?.cause && (e.reason === 'ahead' ? CAUSES_AHEAD : CAUSES_BEHIND).some(([k]) => k === previous.cause);
  const priorWhy = needsWhy && priorCauseOk && !!previous?.why && previous.why !== 'On plan.';
  const priorWay = needsWay && !!previous?.pathToGreen;
  // Once the owner has written their own reason or path, last week's is no longer offered (or pasted over it).
  const edited = (!!draft.why.trim() && draft.why !== previous?.why) || (!!draft.ptgWhat.trim() && draft.ptgWhat !== previous?.pathToGreen?.what) || (!!draft.cause && draft.cause !== previous?.cause);
  const canCarry = !edited && !!previous && (needsWhy || needsWay) && (!needsWhy || priorWhy) && (!needsWay || priorWay);
  // The ask carried forward is the goal's own request while it's still open; once answered or withdrawn it isn't raised again.
  const ownOpen = openFor(goal.id, app.snapshot).find((r) => r.goalIds[0] === goal.id) ?? null;
  const carriedAsk = ownOpen ? askText(ownOpen, app.snapshot.people) : '';
  const answer = answeredSince(goal.id, previous?.postedAt ?? null, app.snapshot);
  const lastState = previous?.pathToGreen?.state ?? 'plan';
  const fromLast = (): Partial<Draft> => ({
    ...(priorWhy ? { cause: previous!.cause, why: previous!.why } : {}),
    ...(priorWay ? { ptgWhat: previous!.pathToGreen!.what, ptgBy: (previous!.pathToGreen!.byWeek ?? 0) > week ? previous!.pathToGreen!.byWeek : null, ptgState: lastState === 'help' && !carriedAsk ? ((previous!.pathToGreen!.byWeek ?? 0) > week ? 'plan' : 'investigating') : lastState, needs: carriedAsk } : {}),
  });
  // With last week's note on offer, "Still true" can finish at step two; the account counts once it's needed.
  const needsAccount = needsWhy || needsWay;
  const detailed = !canCarry || step === 'account';
  const plan: Step[] = ['measure', ...(canCarry ? ['carry' as const] : []), ...(detailed && needsAccount ? ['account' as const] : [])];
  const last = plan[plan.length - 1] === step;

  const go = (to: Step) => { setTrail((t) => [...t, step]); setStep(to); setTried(false); };
  const back = () => { setStep(trail[trail.length - 1] ?? 'measure'); setTrail((t) => t.slice(0, -1)); setTried(false); };

  // A second press, Enter then a click, or a double tap mustn't post twice: state updates too late to stop it, a ref doesn't.
  const inFlight = useRef(false);
  const post = async (d: Draft = draft) => {
    const check = evaluate(goal, cycle, week, d, app.snapshot.checkIns);
    if (!check.canPost || saving || inFlight.current) { if (!inFlight.current) setTried(true); return; }
    inFlight.current = true;
    setSaving(true);
    try {
      const from = d.ptgState === 'help' ? app.person(helpFrom) : undefined;
      // The app names who it's for, so a "Elena:" typed at the start isn't doubled ("Elena Ruiz: Elena: ...").
      const ask = from ? d.ptgWhat.trim().replace(new RegExp(`^(${[from.name, from.name.split(' ')[0]!].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*[:,–-]\\s*`, 'i'), '') : '';
      const c = await app.postCheckIn(goal, { ...d, proposeTarget: '', ...(from ? { ptgWhat: ask, needs: `${from.name}: ${ask}` } : {}) }, null);
      clear();
      onPosted(c, !!existing);
    } catch {
      inFlight.current = false;
      setSaving(false);
    }
  };

  // What the current step still needs, in plain words, shown under the field once they've tried.
  // Read from the rules' own codes, so the screen never asks for less (or more) than posting needs.
  const whyOk = !needsWhy || !e.codes.some((c) => REASON_CODES.includes(c));
  const targetOk = !e.codes.includes('target');
  const planned = (draft.ptgState ?? 'plan') === 'plan';
  const wayOk = !needsWay || (!e.codes.includes('path') && (draft.ptgState !== 'help' || !!helpFrom));
  const primary = () => {
    if (step === 'measure') {
      if (!valueOk || e.codes.includes('greener-why')) { setTried(true); return; }
      if (needsAccount) go(canCarry ? 'carry' : 'account');
      else void post();
    } else if (step === 'account') {
      if (!whyOk || !targetOk || !wayOk) { setTried(true); return; }
      void post();
    }
  };
  // Last week's request for a decision or help is carried only if the owner keeps it (product review, 3 Nov):
  // the diagnosis can be unchanged while the ask has been answered or isn't needed any more.
  const priorAsk = priorWay ? carriedAsk : '';
  const [keepAsk, setKeepAsk] = useState(true);
  const stillTrue = () => {
    const last = fromLast();
    const dropped = priorAsk && !keepAsk;
    const carried: Partial<Draft> = dropped ? { ...last, needs: '', ptgState: last.ptgState === 'help' ? (last.ptgBy ? 'plan' : 'investigating') : last.ptgState } : last;
    const d = { ...draft, ...carried };
    set(carried);
    const check = evaluate(goal, cycle, week, d, app.snapshot.checkIns);
    if (check.canPost) void post(d);
    else go('account');
  };
  const linkTo = async (r: HelpRequest) => {
    try {
      await app.linkRequest(r, goal);
      setLinking(false);
      app.toast('Linked: one answer will cover both goals');
      // The check-in carries the same ask, so posting keeps the link (requests.ts drops a link the check-in doesn't name).
      set({ ptgState: 'help', ptgWhat: r.ask, needs: askText(r, app.snapshot.people) });
      setHelpFrom(r.recipientId ?? '');
      if (step !== 'account') { setTrail((t) => [...t, step]); setStep('account'); }
    } catch { /* the save already said what went wrong */ }
  };
  const linkOffer = othersAsked.length > 0 && (
    <button type="button" className="linkish tap small link-request" onClick={() => setLinking(true)}>Waiting on a decision already asked for another goal?</button>
  );
  const somethingChanged = () => {
    // Start from last week's words so they can be edited, the open request included: removing it there withdraws it.
    const f = fromLast();
    set(f);
    go('account');
  };

  // Continue until the step that posts; before a number is typed, the number's step isn't known to be the last.
  const label = saving ? 'Posting…' : last && (step !== 'measure' || valueOk) ? 'Post check-in' : 'Continue';
  // Count every step this check-in could need, so the total never grows partway through; "Still true" just finishes early.
  const carryOffered = useRef(false);
  if (canCarry) carryOffered.current = true;
  const full: Step[] = ['measure', ...(carryOffered.current ? ['carry' as const] : []), ...(needsAccount ? ['account' as const] : [])];
  const stepNo = Math.max(1, full.indexOf(step) + 1);
  // Every first step shows its dots. Before the number is typed the count is the most it could take (last week's
  // note offered back, then an account), so it can only shrink once the number shows it's on plan.
  const mayCarry = !!previous && ((!!previous.why && previous.why !== 'On plan.') || !!previous.pathToGreen);
  const stepsOf = goal.kind === 'milestone' || valueOk ? full.length : 2 + (mayCarry || carryOffered.current ? 1 : 0);

  return (
    <form className="focus-body" onSubmit={(ev) => { ev.preventDefault(); primary(); }} noValidate>
      {linking && (
        <Sheet open onClose={() => setLinking(false)} title="Waiting on the same decision">
          <div className="stack" style={{ gap: 'var(--s3)' }}>
            <span className="hint">Link {goal.title} to a request already raised, so it’s asked and answered once. Any open request of yours to the same person is withdrawn.</span>
            <div className="optlist">{othersAsked.map((r) => (
              <button key={r.id} type="button" className="opt" onClick={() => void linkTo(r)}>
                <span className="stack" style={{ gap: 2 }}><span className="strong">{askText(r, app.snapshot.people)}</span><span className="hint">For {r.goalIds.map((id) => app.goal(id)?.title).filter(Boolean).join(', ')} · asked by {app.person(r.askedBy)?.name.split(' ')[0] ?? 'someone'}</span></span>
              </button>
            ))}</div>
          </div>
        </Sheet>
      )}
      <GoalHead goal={goal} previous={existing ?? previous} compact={step !== 'measure'} teamLine={goal.level !== 'team' ? `${LEVEL_LABEL[goal.level]} · ${team?.name ?? ''}` : team?.name} steps={{ at: stepNo, of: stepsOf }} />
      {existing && step === 'measure' && <p className="hint">You checked in for week {week} already. This adds another check-in: both stay in the history, and the latest is this week’s status.</p>}
      {restored && step === 'measure' && <p className="hint">Picked up where you left off.</p>}

      {step === 'measure' && (
        <section className="qsection" aria-label="This week">
          <div className="stack" style={{ gap: 'var(--s1)' }}>
            <h2 className="qtitle">{goal.kind === 'milestone' ? 'Where does each stage stand?' : 'What’s the number this week?'}</h2>
            {goal.kind !== 'milestone' && goal.definition && <span className="small">{goal.definition}{goal.unit ? ` (${goal.unit}, ${goal.kind === 'metric' ? (goal.plan.target < goal.plan.start ? 'lower is better' : 'higher is better') : goal.range.bound === 'atMost' ? 'stay at or under the limit' : 'stay at or above the limit'})` : ''}</span>}
            {goal.source && <span className="hint">Where to get it: {goal.source}. Typed in by hand.</span>}
          </div>
          {goal.kind === 'milestone' ? <StageEditor goal={goal} draft={draft} set={set} /> : (() => {
            // A problem with the number goes 8px under the field; last week's number and "Measured again" stay put.
            const pr = valueProblem(draft.value, previous?.value ?? null, goal.unit, goal);
            const shown = pr && (tried || (!pr.block && draft.value.trim()) || (pr.block && draft.value.trim() && parseNumber(draft.value) != null)) ? pr : null;
            const empty = !shown && tried && !valueOk;
            const invalid = !!shown?.block || (tried && !valueOk);
            return (
            <div className="stack">
              <label className={'bignum' + (invalid ? ' invalid' : '')}>
                <span className="sr">This week’s value</span>
                <input inputMode="decimal" enterKeyHint="next" autoComplete="off" autoFocus value={draft.value} onChange={(ev) => set({ value: ev.target.value })}
                  placeholder="Type it here" aria-describedby={(shown || empty ? 'value-msg ' : '') + 'value-hint'} aria-label="This week’s value" aria-invalid={invalid} />
                {goal.unit && <span className="bignum-unit">{goal.unit}</span>}
              </label>
              {shown && <span id="value-msg" className={'hint ' + (shown.block ? 'tone-off' : 'tone-risk')} role={shown.block ? 'alert' : 'status'}>{shown.text}</span>}
              {empty && <span id="value-msg" className="hint tone-off" role="alert">Type this week’s number.</span>}
              <span id="value-hint" className="valuehint hint">
                <span>{previous?.value != null ? `Week ${previous.week}: ${fmt(previous.value, goal)}` : 'First check-in'}</span>
                {previous?.value != null && !draft.value && <button type="button" className="linkish tap" onClick={() => set({ value: String(previous.value) })}>Measured again: unchanged</button>}
              </span>
              {previous?.value != null && draft.value.trim() !== '' && parseNumber(draft.value) === previous.value && <span className="hint">Same as week {previous.week}. Post it only if you measured it again this week.</span>}
              {!draft.value.trim() && onSkip && <button type="button" className="linkish tap small" style={{ alignSelf: 'flex-start' }} onClick={onSkip}>No new number this week</button>}
            </div>
            );
          })()}
          {valueOk && (goal.kind !== 'milestone' || draft.stages.length > 0) && (
            <>
              {goal.kind !== 'milestone' && <Verdict goal={goal} e={e} />}
              <div className="callline">
                <span className="muted">Status</span><Chip k={e.status} />
                <span className="muted">{e.status === e.calc ? 'from the numbers' : 'your call'}</span>
                <button type="button" className="linkish tap" onClick={() => setStatusOpen(true)}>Change</button>
              </div>
              {tried && e.codes.includes('greener-why') && <span className="hint tone-off" role="alert">Say why it’s better than the numbers: tap Change.</span>}
              {last && <NextStepField draft={draft} set={set} open={showNext} onOpen={() => setShowNext(true)} />}
            </>
          )}
          <StatusSheet open={statusOpen} onClose={() => setStatusOpen(false)} e={e} draft={draft} set={set} milestoneDone={goal.kind === 'milestone' && e.calc === 'done'} />
        </section>
      )}

      {step === 'carry' && previous && (
        <section className="qsection" aria-label="What you said last week">
          <h2 className="qtitle">Is what you said last week still true?</h2>
          <blockquote className="quote">
            {priorWhy && <p><strong>{causeLabel(previous.cause)}.</strong> {previous.why}</p>}
            {priorWay && <p><strong>{previous.pathToGreen!.byWeek != null ? `Back on plan by ${weekLabel(previous.pathToGreen!.byWeek, cycle.weeks)}.` : `${RECOVERY[previous.pathToGreen!.state ?? 'plan'].label}.`}</strong> {previous.pathToGreen!.what}</p>}
          </blockquote>
          {answer && (
            <div className="carry-ask">
              <span className="small"><strong>Answered by {app.person(answer.answeredBy ?? '')?.name ?? 'someone'}:</strong> {answer.answer}</span>
              <span className="hint">If it changes your plan or date, choose Something changed.</span>
            </div>
          )}
          {priorAsk && (
            <div className="carry-ask">
              <span className="small"><strong>Still asking:</strong> {priorAsk}</span>
              <label className="check small"><input type="checkbox" checked={keepAsk} onChange={(e) => setKeepAsk(e.target.checked)} /> Keep this request open on their Home</label>
            </div>
          )}
          {priorWay && previous.pathToGreen!.byWeek != null && previous.pathToGreen!.byWeek <= week && <span className="hint">The week you gave has passed, so you’ll pick a new one.</span>}
          {needsWay && linkOffer}
        </section>
      )}

      {step === 'account' && (
        <section className="qsection account" aria-label="What changed, and what happens next">
          {needsWhy && (
            <div className="stack account-part">
          <h3 className="qtitle sm">{e.reason === 'ahead' ? 'Why is it ahead?' : goal.kind === 'milestone' ? 'Why is it late?' : 'Why is it behind?'}</h3>
          <div className="row" role="group" aria-label="Main cause">
            {(e.reason === 'ahead' ? CAUSES_AHEAD : CAUSES_BEHIND).map(([k, l]) => <button key={k} type="button" className="pill" aria-pressed={draft.cause === k} onClick={() => set({ cause: k })}>{l}</button>)}
          </div>
          <label className="field">
            <span className="sr">What happened</span>
            <textarea className={'input' + (tried && draft.why.trim().length < MIN_REASON ? ' invalid' : '')} rows={3} value={draft.why} onChange={(ev) => set({ why: ev.target.value })} aria-label="What happened"
              placeholder={draft.cause === 'other' ? 'Say what’s going on, in your own words.' : e.reason === 'ahead' ? 'What happened, and will it last?' : 'What is causing the gap?'} />
          </label>
          {tried && !whyOk && <span className="hint tone-off" role="alert">{!draft.cause ? 'Pick a cause, then write a sentence.' : 'Write a sentence about what happened.'}</span>}
          {e.asksTarget && goal.kind === 'metric' && app.viewer.id === goal.ownerId && (
            <p className="hint">Well ahead of plan. If the target should move, <Link className="linkish" to={`/goals/${goal.id}/edit`}>change it</Link> after posting; watchers see the change and your reason.</p>
          )}
            </div>
          )}
          {needsWay && (
            <div className="stack account-part">
          <h3 className="qtitle sm">{needsWhy ? 'What happens next?' : 'Where are you with getting it back on plan?'}</h3>
          <div className="optlist ci-opts" role="radiogroup" aria-label="Where you are">
            {(Object.keys(RECOVERY) as RecoveryState[]).map((k) => (
              <button key={k} type="button" role="radio" className="opt" aria-checked={(draft.ptgState ?? 'plan') === k} onClick={() => set({ ptgState: k, ...(k !== 'plan' && k !== 'help' ? { ptgBy: null } : {}) })}>
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
          ) : null}
          {needsWay && linkOffer}
          {draft.ptgState === 'help' ? (
            // A decision and a date can go together: the date it's back on plan once the decision or help arrives.
            <div className="field"><span className="field-label" id="ptg-by-if">If it comes, back on plan by <span className="muted" style={{ fontWeight: 400 }}>optional</span></span>
              <WeekPicks week={week} weeks={cycle.weeks} value={draft.ptgBy} labelledBy="ptg-by-if" onPick={(w) => set({ ptgBy: draft.ptgBy === w ? null : w })} />
            </div>
          ) : showNeeds
            ? <label className="field"><span className="field-label">Also need a decision or help? <span className="muted" style={{ fontWeight: 400 }}>Optional; shown at the top of the goal and in reviews</span></span><input className="input" value={draft.needs} onChange={(ev) => set({ needs: ev.target.value })} placeholder="e.g. Elena: approve an interim scope" /></label>
            : <div><button type="button" className="linkish tap" onClick={() => setShowNeeds(true)}>Also need a decision or help?</button></div>}
            </div>
          )}
          <NextStepField draft={draft} set={set} open={showNext} onOpen={() => setShowNext(true)} />
        </section>
      )}

      {step !== 'carry' ? (
        <div className="focus-foot" key="foot">
          <div className="foot-row">
            {trail.length > 0 && <button type="button" className="btn ghost" onClick={back}>Back</button>}
            <button className="btn primary big-btn" type="submit" disabled={saving}>{label}</button>
          </div>
        </div>
      ) : (
        // Both answers live in the footer, so neither can load out of sight under it: the primary on the right. Its own
        // key, so React never turns "Something changed" into the next step's submit button mid-click.
        <div className="focus-foot" key="carry-foot">
          <div className="foot-row carry-foot">
            <button type="button" className="btn ghost" onClick={back}>Back</button>
            <button type="button" className="btn big-btn" onClick={somethingChanged}>Something changed</button>
            <button type="button" className="btn primary big-btn" disabled={saving} onClick={stillTrue}>{saving ? 'Posting…' : 'Still true: post check-in'}</button>
          </div>
        </div>
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
        <div className="optlist ci-opts" role="radiogroup" aria-label="Status">
          {opts.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={e.status === k} className="opt" onClick={() => set({ status: k === e.calc ? null : k })}>
              <Chip k={k} /><span className="hint">{k === e.calc ? 'from the numbers' : ''}</span>
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

/** The weeks to pick from, one pill each: the next four, the quarter's end and the year's (or cycle's) end. Used for
    "back on plan by" and for a late stage, so both look and read the same. */
function WeekPicks({ week, weeks, value, onPick, from = week + 1, labelledBy = 'ptg-by' }: { week: number; weeks: number; value: number | null; onPick: (w: number) => void; from?: number; labelledBy?: string }) {
  const { cycle } = useApp();
  return (
    <div className="row weekpicks" role="group" aria-labelledby={labelledBy}>
      {Array.from({ length: Math.max(0, weeks - from + 1) }, (_, i) => from + i).filter((w, i, arr) => i < 4 || w === arr[arr.length - 1] || (isYear(cycle) && w === quarterOf(cycle, week).to)).map((w) => {
        const name = w === weeks ? (isYear(cycle) ? 'Year end' : 'Cycle end') : isYear(cycle) && w === quarterOf(cycle, week).to && w > week + 4 ? `End of ${quarterOf(cycle, week).label}` : 'Week ' + w;
        // The name read out is the words on the button, so what you see is what a screen reader says.
        return <button key={w} type="button" className="pill" aria-pressed={value === w} onClick={() => onPick(w)}>{name}<span className="sr">{name.startsWith('Week') ? '' : `, week ${w}`}, </span><span className="pill-sub">{weekDates(cycle, w)}</span></button>;
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
    line = `${fmt(a.actual, goal)} against ${fmt(a.plan, goal)} planned for week ${app.week}.`;
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
      {forecast && (forecast.warn ? <span className="forecast"><Icon name="trend-down" />{forecast.text}</span> : <span className="muted">{forecast.text}</span>)}
      {chart && <div className="chartwrap">
        {a.kind === 'metric' && goal.kind === 'metric' && <MetricChart goal={goal} weeks={app.cycle.weeks} week={app.week} series={series} forecast={a.forecast} projection={a.projection} height={150} />}
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
                <Chip k={st.tone} label={st.text} className="stagepick-state" />
                <Icon name="chevron-right" className="chev" /><span className="sr">Change</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Sheet open={!!current} onClose={() => setEditing(null)} title={current?.name ?? ''}>
        {current && (
          <div className="stack" style={{ gap: 'var(--s4)' }}>
            <span className="hint">Due {weekLabel(current.dueWeek, cycle.weeks)}</span>
            {/* One pill for every answer, the same as "back on plan by": done, on schedule, or the week it's now expected. */}
            <div className="field"><span className="field-label" id="stage-now">Where it stands</span>
              <div className="row weekpicks" role="group" aria-labelledby="stage-now">
                <button type="button" className="pill" aria-pressed={upd(current.id)?.doneWeek != null} onClick={() => { update(current.id, week, null); setEditing(null); }}>Done</button>
                {current.dueWeek >= week && <button type="button" className="pill" aria-pressed={state(current).tone === 'on'} onClick={() => { update(current.id, null, null); setEditing(null); }}>On schedule</button>}
              </div>
            </div>
            {current.dueWeek < cycle.weeks && (
              <div className="field"><span className="field-label" id="late-l">Late: now expected in</span>
                <WeekPicks week={week} weeks={cycle.weeks} from={lateFrom} labelledBy="late-l" value={upd(current.id)?.doneWeek == null ? upd(current.id)?.forecastWeek ?? null : null} onPick={(w) => { update(current.id, null, w); setEditing(null); }} />
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
