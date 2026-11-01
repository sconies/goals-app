import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { checkInDraftKey, useDraft } from '../app/drafts';
import { CAUSES_AHEAD, CAUSES_BEHIND, causeLabel, draftFrom, emptyDraft, evaluate, MIN_PATH, MIN_REASON, type Draft, type Evaluation } from '../domain/checkin';
import { fmt, gapText, LEVEL_LABEL, targetText, weekLabel } from '../domain/format';
import { onTimeStreak, weekProgress } from '../domain/progress';
import type { CheckIn, Goal, MilestoneGoal, Status } from '../domain/types';
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
  const goal = queue[index] ? app.goal(queue[index]) : undefined;

  if (app.week < 1) {
    return <div className="page narrow"><Empty title="Check-ins start in week 1"><span className="muted">The cycle has just begun. Your first check-in is due next week.</span></Empty></div>;
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
    <div className="focus">
      <div className="focus-top">
        <span className="small strong">Check-in{queue.length > 1 ? ` ${Math.min(index + 1, queue.length)} of ${queue.length}` : ''}</span>
        {queue.length > 1 && <div className="dots" aria-hidden="true">{queue.map((id, i) => <i key={id} className={i < index ? 'done' : i === index ? 'now' : ''} />)}</div>}
        <button className="iconbtn" onClick={() => nav('/')} aria-label="Close and save the draft">✕</button>
      </div>
      {justPosted ? (
        <Posted goal={goal} c={justPosted} updated={updated} left={queue.length - index - 1} nextTitle={app.goal(queue[index + 1] ?? '')?.title} onNext={next} />
      ) : (
        <GoalCheckIn key={goal.id} goal={goal} onPosted={(c, updated) => { setUpdated(updated); setJustPosted(c); }} />
      )}
    </div>
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
        <h1 className="title-xl">{first && !p.done.length ? 'Nothing to check in' : `Week ${app.week} is done`}</h1>
        <p className="muted">{!p.goals.length ? 'You don’t own any goals this cycle.' : p.goals.length === 1 ? 'Your goal is checked in for the review.' : p.goals.length === 2 ? 'Both your goals are checked in for the review.' : `All ${p.goals.length} of your goals are checked in for the review.`}</p>
        {streak >= 2 && <p className="streak big">{streak} weeks in a row on time</p>}
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link ref={ref} className="btn primary big-btn" to="/">Back to home</Link>
        </div>
      </div>
    </div>
  );
}

function Posted({ goal, c, updated, left, nextTitle, onNext }: { goal: Goal; c: CheckIn; updated: boolean; left: number; nextTitle?: string; onNext: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus(), []);
  return (
    <div className="celebrate" role="status">
      <span className="tick" aria-hidden="true"><svg viewBox="0 0 48 48" width="64" height="64"><circle cx="24" cy="24" r="22" /><path d="m14 25 7 7 13-15" /></svg></span>
      <h1 className="title-xl">{updated ? 'Update posted' : 'Posted'}</h1>
      <p className="row muted" style={{ justifyContent: 'center', gap: 'var(--s2)' }}>{goal.title}{goal.kind !== 'milestone' && c.value != null ? `: ${fmt(c.value, goal)}` : ''}<Chip k={c.status} /></p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button ref={btn} className="btn primary big-btn" onClick={onNext}>{left ? `Next: ${nextTitle}` : 'Finish'}</button>
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
function GoalCheckIn({ goal, onPosted }: { goal: Goal; onPosted: (c: CheckIn, updated: boolean) => void }) {
  const app = useApp();
  const { week, cycle } = app;
  const own = app.checkInsOf(goal);
  const existing = own.find((c) => c.week === week) ?? null;
  const previous = [...own].reverse().find((c) => c.week < week) ?? null;
  const [draft, set, clear, restored] = useDraft<Draft>(checkInDraftKey(app.ws.id, goal.id, week), () => (existing ? draftFrom(existing) : emptyDraft(goal, previous)));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNext, setShowNext] = useState(!!draft.next);
  const [showNeeds, setShowNeeds] = useState(!!draft.needs);
  const [statusOpen, setStatusOpen] = useState(false);
  const [step, setStep] = useState<Step>('measure');
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
  const canCarry = !existing && !!previous && (needsWhy || needsWay) && (!needsWhy || priorWhy) && (!needsWay || priorWay);
  const fromLast = (): Partial<Draft> => ({
    ...(priorWhy ? { cause: previous!.cause, why: previous!.why } : {}),
    ...(priorWay ? { ptgWhat: previous!.pathToGreen!.what, ptgBy: previous!.pathToGreen!.byWeek > week ? previous!.pathToGreen!.byWeek : null, needs: previous!.pathToGreen!.needs } : {}),
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
      const c = await app.postCheckIn(goal, { ...d, proposeTarget: '' }, existing);
      clear();
      onPosted(c, !!existing);
    } catch {
      setSaving(false);
    }
  };

  // What the current step still needs, in plain words, shown under the field once they've tried.
  const whyOk = !needsWhy || (!!draft.cause && draft.why.trim().length >= MIN_REASON);
  const targetOk = !e.missing.some((m) => m.includes('target'));
  const wayOk = !needsWay || (draft.ptgWhat.trim().length >= MIN_PATH && draft.ptgBy != null && draft.ptgBy > week);
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
  const somethingChanged = () => { set(fromLast()); go(needsWhy ? 'why' : 'way'); };

  const label = saving ? 'Posting…' : last ? (existing ? 'Post update' : 'Post check-in') : 'Next';
  const stepNo = plan.indexOf(step) + 1;

  return (
    <form className="focus-body" onSubmit={(ev) => { ev.preventDefault(); primary(); }} noValidate>
      <GoalHead goal={goal} previous={existing ?? previous} compact={step !== 'measure'} teamLine={goal.level !== 'team' ? `${LEVEL_LABEL[goal.level]} · ${team?.name ?? ''}` : team?.name} steps={plan.length > 1 ? { at: stepNo, of: plan.length } : undefined} />
      {existing && step === 'measure' && <p className="hint">You checked in for week {week} already. This replaces it; the change log keeps both.</p>}
      {restored && step === 'measure' && <p className="hint">Picked up where you left off.</p>}

      {step === 'measure' && (
        <section className="qsection" aria-label="This week">
          <div className="stack" style={{ gap: 'var(--s1)' }}>
            <h2 className="qtitle">{goal.kind === 'milestone' ? 'Where does each stage stand?' : 'What’s the number this week?'}</h2>
            {goal.source && <span className="hint">From {goal.source}</span>}
          </div>
          {goal.kind === 'milestone' ? <StageEditor goal={goal} draft={draft} set={set} /> : (
            <div className="stack">
              <label className="bignum">
                <span className="sr">This week’s value</span>
                <input inputMode="decimal" autoComplete="off" autoFocus value={draft.value} onChange={(ev) => set({ value: ev.target.value })}
                  placeholder="Type it here" aria-describedby="value-hint" aria-label="This week’s value" aria-invalid={tried && !valueOk} />
                {goal.unit && <span className="bignum-unit">{goal.unit}</span>}
              </label>
              {tried && !valueOk
                ? <span className="hint tone-off" role="alert">Type this week’s number.</span>
                : <span id="value-hint" className="valuehint hint">
                    <span>{previous?.value != null ? `Last week ${fmt(previous.value, goal)}` : 'First check-in this cycle'}</span>
                    {previous?.value != null && !draft.value && <button type="button" className="linkish tap" onClick={() => set({ value: String(previous.value) })}>Use {fmt(previous.value, goal)}</button>}
                  </span>}
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
            {priorWay && <p><strong>Back on plan by {weekLabel(previous.pathToGreen!.byWeek, cycle.weeks)}.</strong> {previous.pathToGreen!.what}</p>}
          </blockquote>
          <div className="choice">
            <button type="button" className="btn primary big-btn" disabled={saving} onClick={stillTrue}>{saving ? 'Posting…' : 'Still true'}</button>
            <button type="button" className="btn big-btn" onClick={somethingChanged}>Something changed</button>
          </div>
          {priorWay && previous.pathToGreen!.byWeek <= week && <span className="hint">The week you gave has passed, so you’ll pick a new one.</span>}
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
          <h2 className="qtitle">How does it get back on plan?</h2>
          <label className="field">
            <span className="sr">What changes</span>
            <textarea className={'input' + (tried && draft.ptgWhat.trim().length < MIN_PATH ? ' invalid' : '')} rows={2} value={draft.ptgWhat} onChange={(ev) => set({ ptgWhat: ev.target.value })} placeholder="The one or two things that close the gap" aria-label="What changes" />
          </label>
          <div className="field"><span className="field-label" id="ptg-by">Back on plan by</span>
            <WeekPicks week={week} weeks={cycle.weeks} value={draft.ptgBy} onPick={(w) => set({ ptgBy: w })} />
          </div>
          {tried && !wayOk && <span className="hint tone-off" role="alert">{draft.ptgWhat.trim().length < MIN_PATH ? 'Say what changes, in a few words.' : 'Pick the week it’s back on plan.'}</span>}
          {showNeeds
            ? <label className="field"><span className="field-label">Need a decision or help? <span className="muted" style={{ fontWeight: 400 }}>Goes to the review</span></span><input className="input" value={draft.needs} onChange={(ev) => set({ needs: ev.target.value })} placeholder="e.g. Elena: approve an interim scope" /></label>
            : <div><button type="button" className="linkish tap" onClick={() => setShowNeeds(true)}>Ask for a decision or help</button></div>}
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
            {tried && !okWhy && <span className="hint tone-off" role="alert">Write a sentence so the sponsor knows why.</span>}
          </label>
        )}
        <button type="button" className="btn primary big-btn" onClick={() => { if (!okWhy) { setTried(true); return; } onClose(); }}>Done</button>
      </div>
    </Sheet>
  );
}

function WeekPicks({ week, weeks, value, onPick }: { week: number; weeks: number; value: number | null; onPick: (w: number) => void }) {
  return (
    <div className="row" role="group" aria-labelledby="ptg-by">
      {Array.from({ length: Math.max(0, weeks - week) }, (_, i) => week + 1 + i).filter((w, i, arr) => i < 4 || w === arr[arr.length - 1]).map((w) => (
        <button key={w} type="button" className="pill" aria-pressed={value === w} onClick={() => onPick(w)}>{w === weeks ? 'Cycle end' : 'Week ' + w}</button>
      ))}
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
      {!compact && !previous && app.week > 1 && <span className="hint">No check-in yet this cycle</span>}
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
    title = a.ratio >= 1 ? 'Ahead of plan' : 'Behind plan';
    line = `${fmt(a.actual, goal)} against ${fmt(a.plan, goal)} planned for week ${app.week}.`;
    if (a.forecast != null) forecast = a.forecastMisses
      ? { text: `At this pace it ends near ${fmt(a.forecast, goal)}, short of the ${fmt(goal.plan.target, goal)} target.`, warn: true }
      : { text: `At this pace it reaches the ${fmt(goal.plan.target, goal)} target.`, warn: false };
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
