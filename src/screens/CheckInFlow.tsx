import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { checkInDraftKey, useDraft } from '../app/drafts';
import { CAUSES_AHEAD, CAUSES_BEHIND, draftFrom, emptyDraft, evaluate, MIN_PATH, MIN_REASON, type Draft, type Evaluation } from '../domain/checkin';
import { fmt, gapText, targetText, weekLabel } from '../domain/format';
import { onTimeStreak, weekProgress } from '../domain/progress';
import { LABEL } from '../domain/status';
import type { CheckIn, Goal, MilestoneGoal, Status } from '../domain/types';
import { Chip, Empty, ProgressRing, StatusShape } from '../ui/bits';
import { MetricChart, RangeChart, StageList } from '../ui/charts';

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
        <span className="small strong">Check-in{queue.length > 1 ? ` · ${Math.min(index + 1, queue.length)} of ${queue.length}` : ''}</span>
        {queue.length > 1 && <div className="dots" aria-hidden="true">{queue.map((id, i) => <i key={id} className={i < index ? 'done' : i === index ? 'now' : ''} />)}</div>}
        <button className="iconbtn" onClick={() => nav('/')} aria-label="Close and save the draft">✕</button>
      </div>
      {justPosted ? (
        <Posted goal={goal} c={justPosted} left={queue.length - index - 1} nextTitle={app.goal(queue[index + 1] ?? '')?.title} onNext={next} />
      ) : (
        <GoalCheckIn key={goal.id} goal={goal} onPosted={(c) => setJustPosted(c)} />
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
        <p className="muted">{p.goals.length ? `All ${p.goals.length} of your goals are checked in. They go into the review as you wrote them.` : 'You don’t own any goals this cycle.'}</p>
        {streak >= 2 && <p className="streak big">{streak} weeks in a row on time</p>}
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link ref={ref} className="btn primary big-btn" to="/">Back to home</Link>
          <Link className="btn" to="/goals">See all goals</Link>
        </div>
      </div>
    </div>
  );
}

function Posted({ goal, c, left, nextTitle, onNext }: { goal: Goal; c: CheckIn; left: number; nextTitle?: string; onNext: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus(), []);
  return (
    <div className="celebrate" role="status">
      <span className="tick" aria-hidden="true"><svg viewBox="0 0 48 48" width="64" height="64"><circle cx="24" cy="24" r="22" /><path d="m14 25 7 7 13-15" /></svg></span>
      <h1 className="title-xl">Posted</h1>
      <p className="muted">{goal.title} · {goal.kind !== 'milestone' && c.value != null ? fmt(c.value, goal) + ' · ' : ''}{LABEL[c.status]}</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button ref={btn} className="btn primary big-btn" onClick={onNext}>{left ? `Next: ${nextTitle} →` : 'Finish →'}</button>
      </div>
      {left > 0 && <p className="tiny muted">{left} to go</p>}
    </div>
  );
}

function GoalCheckIn({ goal, onPosted }: { goal: Goal; onPosted: (c: CheckIn) => void }) {
  const app = useApp();
  const { week, cycle } = app;
  const own = app.checkInsOf(goal);
  const existing = own.find((c) => c.week === week) ?? null;
  const previous = [...own].reverse().find((c) => c.week < week) ?? null;
  const [editing, setEditing] = useState(!existing);
  const [draft, set, clear, restored] = useDraft<Draft>(checkInDraftKey(app.ws.id, goal.id, week), () => (existing ? draftFrom(existing) : emptyDraft(goal, previous)));
  const [raise, setRaise] = useState(draft.proposeTarget !== '');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNext, setShowNext] = useState(!!draft.next);
  const e = evaluate(goal, cycle, week, draft, app.snapshot.checkIns);
  const team = app.team(goal.teamId);

  if (existing && !editing) {
    return (
      <div className="focus-body">
        <GoalHead goal={goal} previous={null} />
        <div className="note-good"><strong>Checked in for week {week} · {LABEL[existing.status]}.</strong> {existing.why !== 'On plan.' ? existing.why : ''}</div>
        <div className="row"><button className="btn primary" onClick={() => setEditing(true)}>Edit this check-in</button><Link className="btn" to={'/goals/' + goal.id}>Open the goal</Link></div>
      </div>
    );
  }

  const hasValue = goal.kind === 'milestone' || draft.value.trim() !== '' && !e.missing.some((m) => m.includes('value'));
  const steps = [
    { label: goal.kind === 'milestone' ? 'Stages' : 'Number', done: hasValue },
    { label: 'Your call', done: hasValue },
    ...(e.reason || e.needsPath ? [{ label: e.needsPath ? 'Why & path back' : 'Why', done: hasValue && !e.missing.some((m) => /why|path|target/.test(m)) }] : []),
  ];

  const post = async () => {
    setTried(true);
    if (!e.canPost || saving) return;
    setSaving(true);
    try {
      const c = await app.postCheckIn(goal, raise ? draft : { ...draft, proposeTarget: '' }, existing);
      clear();
      onPosted(c);
    } catch {
      setSaving(false);
    }
  };

  return (
    <form className="focus-body" onSubmit={(ev) => { ev.preventDefault(); void post(); }} noValidate>
      <GoalHead goal={goal} previous={previous} teamLine={goal.headline ? 'Headline goal' : team?.name} />
      {restored && <div className="restored small">Restored your unsaved answers.</div>}

      <Section n={1} title={goal.kind === 'milestone' ? 'Where does each stage stand?' : 'What’s the number this week?'} done={hasValue}>
        {goal.kind === 'milestone' ? <StageEditor goal={goal} draft={draft} set={set} /> : (
          <label className="bignum">
            <span className="sr">This week’s value</span>
            <input inputMode="decimal" autoComplete="off" autoFocus value={draft.value} onChange={(ev) => set({ value: ev.target.value })}
              placeholder={previous?.value != null ? String(previous.value) : '0'} aria-describedby="value-hint" aria-label="This week’s value" />
            {goal.unit && <span className="bignum-unit">{goal.unit}</span>}
          </label>
        )}
        {goal.kind !== 'milestone' && <span id="value-hint" className="small muted">{previous?.value != null ? `Last week ${fmt(previous.value, goal)}` : 'First check-in'} · {goal.source ? 'from ' + goal.source : 'enter the latest reading'}</span>}
        {hasValue && <Verdict goal={goal} e={e} />}
      </Section>

      {hasValue && (
        <Section n={2} title="Your call" done={hasValue}>
          <div className="row nowrap" role="group" aria-label="Your status call">
            {(e.calc === 'done' ? ['done', 'on', 'risk', 'off'] as Status[] : ['on', 'risk', 'off'] as Status[]).map((k) => (
              <button key={k} type="button" className={'callbtn ' + k} aria-pressed={e.status === k} onClick={() => set({ status: k })}>
                <StatusShape k={k} />{LABEL[k]}
              </button>
            ))}
          </div>
          <span className="small muted">{e.status === e.calc ? `Matches the numbers. Your call is the official status.` : e.greener ? `Greener than the numbers (${LABEL[e.calc]}), so say why.` : `Redder than the numbers (${LABEL[e.calc]}). That’s fine: you know more.`}</span>
          {e.greener && (
            <label className="field">
              <span className="small strong">Why is it greener than the numbers?</span>
              <input className={'input' + (tried && draft.greenerWhy.trim().length < MIN_REASON ? ' invalid' : '')} value={draft.greenerWhy} onChange={(ev) => set({ greenerWhy: ev.target.value })} placeholder="e.g. The fix ships Monday and closes the gap" />
            </label>
          )}
        </Section>
      )}

      {hasValue && (e.reason || e.needsPath) && (
        <Section n={3} title={e.reason === 'ahead' ? 'Why is it so far ahead?' : e.needsPath && !e.reason ? 'How does it get back on track?' : goal.kind === 'milestone' ? 'Why is it late, and what’s the way back?' : 'Why is it behind, and what’s the way back?'} done={steps[2]?.done ?? false}>
          {e.reason && (
            <>
              <div className="row" role="group" aria-label="Main cause">
                {(e.reason === 'ahead' ? CAUSES_AHEAD : CAUSES_BEHIND).map(([k, l]) => <button key={k} type="button" className="pill" aria-pressed={draft.cause === k} onClick={() => set({ cause: k })}>{l}</button>)}
              </div>
              <label className="field">
                <span className="sr">What happened</span>
                <textarea className={'input' + (tried && draft.why.trim().length < MIN_REASON ? ' invalid' : '')} rows={2} value={draft.why} onChange={(ev) => set({ why: ev.target.value })} aria-label="What happened"
                  placeholder={e.reason === 'ahead' ? 'One sentence: what happened, and will it last?' : 'One sentence: what is causing the gap?'} />
              </label>
            </>
          )}
          {e.asksTarget && goal.kind === 'metric' && (
            <div className="subtle stack" style={{ gap: 8 }}>
              <span className="small strong">Should the target change?</span>
              <div className="row" role="group" aria-label="Target">
                <button type="button" className="pill" aria-pressed={!raise} onClick={() => { setRaise(false); set({ proposeTarget: '' }); }}>Keep {fmt(goal.plan.target, goal)}</button>
                <button type="button" className="pill" aria-pressed={raise} onClick={() => setRaise(true)}>Propose a new target</button>
              </div>
              {raise && (
                <label className="field" style={{ maxWidth: 240 }}>
                  <span className="small">Proposed target</span>
                  <span className="row nowrap"><input className="input" inputMode="decimal" value={draft.proposeTarget} onChange={(ev) => set({ proposeTarget: ev.target.value })} aria-label="Proposed target" />{goal.unit && <span className="muted">{goal.unit}</span>}</span>
                  <span className="tiny muted">The sponsor approves it in the review.</span>
                </label>
              )}
            </div>
          )}
          {e.needsPath && (
            <div className="subtle stack" style={{ gap: 10 }}>
              <span className="small strong">Path to green</span>
              <label className="field"><span className="small">What changes</span>
                <input className={'input' + (tried && draft.ptgWhat.trim().length < MIN_PATH ? ' invalid' : '')} value={draft.ptgWhat} onChange={(ev) => set({ ptgWhat: ev.target.value })} placeholder="The one or two things that close the gap" />
              </label>
              <div className="field"><span className="small" id="ptg-by">Back on plan by</span>
                <div className="row" role="group" aria-labelledby="ptg-by">
                  {Array.from({ length: Math.max(0, cycle.weeks - week) }, (_, i) => week + 1 + i).filter((w, i, arr) => i < 4 || w === arr[arr.length - 1]).map((w) => (
                    <button key={w} type="button" className="pill" aria-pressed={draft.ptgBy === w} onClick={() => set({ ptgBy: w })}>{w === cycle.weeks ? 'Cycle end' : 'Week ' + w}</button>
                  ))}
                </div>
              </div>
              <label className="field"><span className="small">Needs a decision or help? <span className="muted">Optional · goes to the review</span></span>
                <input className="input" value={draft.needs} onChange={(ev) => set({ needs: ev.target.value })} placeholder="e.g. Elena: approve an interim scope" />
              </label>
            </div>
          )}
        </Section>
      )}

      {hasValue && (showNext
        ? <label className="field"><span className="small strong">Next step before next week <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span><input className="input" value={draft.next} onChange={(ev) => set({ next: ev.target.value })} placeholder="One thing that will move this" /></label>
        : <button type="button" className="linkish small" style={{ alignSelf: 'flex-start' }} onClick={() => setShowNext(true)}>+ Add a next step (optional)</button>)}

      <div className="focus-foot">
        <ul className="checklist" aria-label="What’s needed">
          {steps.map((s) => <li key={s.label} className={s.done ? 'done' : tried ? 'missing' : ''}><span aria-hidden="true">{s.done ? '✓' : '○'}</span>{s.label}</li>)}
        </ul>
        <button className="btn primary big-btn" type="submit" aria-disabled={!e.canPost || saving}>
          {saving ? 'Posting…' : !hasValue ? 'Enter the number' : e.canPost ? (existing ? 'Update check-in' : 'Post check-in') : 'Finish the last step'}
        </button>
        {tried && e.missing.length > 0 && <span className="small tone-off" role="alert">Still needed: {e.missing.join(', ')}</span>}
      </div>
    </form>
  );
}

function Section({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className={'qsection' + (done ? ' done' : '')} aria-label={title}>
      <h2 className="qtitle"><span className="qnum" aria-hidden="true">{done ? '✓' : n}</span>{title}</h2>
      <div className="stack" style={{ gap: 10 }}>{children}</div>
    </section>
  );
}

function GoalHead({ goal, previous, teamLine }: { goal: Goal; previous: CheckIn | null; teamLine?: string }) {
  const app = useApp();
  return (
    <div className="stack" style={{ gap: 4 }}>
      {teamLine && <span className="small muted">{teamLine}</span>}
      <h1 className="title-xl">{goal.title}</h1>
      {previous && <span className="small muted">Last check-in: week {previous.week} · <Chip k={previous.status} /></span>}
      {!previous && app.week > 1 && <span className="small muted">No check-in yet this cycle</span>}
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
  const sentence = a.kind === 'metric' && goal.kind === 'metric'
    ? `${gap.long}. The plan for this week is ${fmt(a.plan, goal)}.` + (a.forecastMisses && a.forecast != null ? ` At this pace it ends near ${fmt(a.forecast, goal)}, short of ${fmt(goal.plan.target, goal)}.` : '')
    : a.kind === 'range' && goal.kind === 'range' ? `${gap.long}. The limit is ${targetText(goal)}.` : gap.long + '.';
  return (
    <div className={'verdict tone-edge-' + (gap.tone === 'ahead' ? 'info' : gap.tone)} role="status">
      <div className="row between nowrap">
        <span className={'strong tone-' + gap.tone}>{gap.short}</span>
        <Chip k={e.calc} label={'Numbers say: ' + LABEL[e.calc]} />
      </div>
      <span className="small">{sentence}</span>
      {a.kind === 'metric' && goal.kind === 'metric' && <MetricChart goal={goal} weeks={app.cycle.weeks} week={app.week} series={series} forecast={a.forecast} height={150} />}
      {a.kind === 'range' && goal.kind === 'range' && <RangeChart goal={goal} weeks={app.cycle.weeks} week={app.week} series={series} height={140} />}
      {a.kind === 'milestone' && <StageList a={a} />}
    </div>
  );
}

type StageMode = 'planned' | 'done' | 'late';

function StageEditor({ goal, draft, set }: { goal: MilestoneGoal; draft: Draft; set: (p: Partial<Draft>) => void }) {
  const { week, cycle } = useApp();
  const update = (stageId: string, doneWeek: number | null, forecastWeek: number | null) =>
    set({ stages: goal.stages.map((s) => (s.id === stageId ? { stageId, doneWeek, forecastWeek } : draft.stages.find((u) => u.stageId === s.id) ?? { stageId: s.id, doneWeek: null, forecastWeek: null })) });
  return (
    <div className="stack" style={{ gap: 0 }}>
      {goal.stages.map((s) => {
        const u = draft.stages.find((x) => x.stageId === s.id);
        const mode: StageMode = u?.doneWeek != null ? 'done' : u?.forecastWeek != null && u.forecastWeek > s.dueWeek ? 'late' : 'planned';
        const lateFrom = Math.min(cycle.weeks, Math.max(s.dueWeek + 1, week));
        return (
          <div key={s.id} className="stagerow">
            <span className="stack" style={{ gap: 0, flex: '1 1 160px' }}><span className="strong">{s.name}</span><span className="tiny muted">Due {weekLabel(s.dueWeek, cycle.weeks)}</span></span>
            <div className="seg" role="group" aria-label={s.name}>
              <button type="button" aria-pressed={mode === 'planned'} onClick={() => update(s.id, null, null)}>{s.dueWeek < week ? 'Not done' : 'On schedule'}</button>
              <button type="button" aria-pressed={mode === 'done'} onClick={() => update(s.id, Math.min(week, Math.max(1, u?.doneWeek ?? week)), null)}>Done</button>
              {s.dueWeek < cycle.weeks && <button type="button" aria-pressed={mode === 'late'} onClick={() => update(s.id, null, u?.forecastWeek && u.forecastWeek > s.dueWeek ? u.forecastWeek : lateFrom)}>Late</button>}
            </div>
            {mode === 'late' && (
              <label className="inline-select"><span className="sr">{s.name}: now expected</span>
                <select className="input" value={u?.forecastWeek ?? lateFrom} onChange={(ev) => update(s.id, null, Number(ev.target.value))} aria-label={s.name + ': now expected'}>
                  {Array.from({ length: cycle.weeks - lateFrom + 1 }, (_, i) => lateFrom + i).map((w) => <option key={w} value={w}>Expected week {w}</option>)}
                </select>
              </label>
            )}
            {mode === 'done' && week > 1 && (
              <label className="inline-select"><span className="sr">{s.name}: done in week</span>
                <select className="input" value={u?.doneWeek ?? week} onChange={(ev) => update(s.id, Number(ev.target.value), null)} aria-label={s.name + ': done in week'}>
                  {Array.from({ length: week }, (_, i) => i + 1).map((w) => <option key={w} value={w}>Done week {w}</option>)}
                </select>
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}

