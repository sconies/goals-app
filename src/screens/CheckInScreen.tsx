import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useApp, type AppState } from '../app/state';
import { CAUSES_AHEAD, CAUSES_BEHIND, causeLabel, draftFrom, emptyDraft, evaluate, toCheckIn, type Draft, type Evaluation } from '../domain/checkin';
import { fmt, gapText, kindLabel, directionLabel, targetText, weekLabel } from '../domain/format';
import { LABEL } from '../domain/status';
import type { CheckIn, Goal, Status } from '../domain/types';
import { newId } from '../data/store';
import { Chip, Empty, Header, Stat, StatusShape } from '../ui/bits';
import { MetricChart, RangeChart, StageList } from '../ui/charts';

/** The viewer's goals still waiting for this week's check-in. */
export function dueCheckIns(app: AppState): Goal[] {
  if (app.week < 1) return [];
  return app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id && app.statusOf(g).status !== 'done' && !app.checkInsOf(g).some((c) => c.week === app.week));
}

export function CheckInScreen() {
  const app = useApp();
  const { goalId } = useParams();
  const { week, cycle, viewer } = app;
  const header = <Header eyebrow={`Week ${week} of ${cycle.weeks} · ${cycle.name}`} title="Weekly check-in" actions={<Link className="btn" to="/goals">All goals</Link>} />;
  const mine = app.snapshot.goals.filter((g) => g.ownerId === viewer.id);

  if (!mine.length) {
    return (
      <>
        {header}
        <div className="split"><div className="main">
          <Empty title="Nothing to check in">
            <span className="muted">{viewer.name} doesn’t own any goals this cycle. Owners check in weekly; everyone else follows the goals they care about.</span>
            <div className="row"><Link className="btn primary sm" to="/goals">See all goals</Link><Link className="btn sm" to="/goals/new">Create a goal</Link></div>
          </Empty>
        </div></div>
      </>
    );
  }
  if (week < 1) {
    return (
      <>
        {header}
        <div className="split"><div className="main">
          <Empty title="Check-ins start in week 1"><span className="muted">The cycle has just started. Your first check-in is due next week.</span></Empty>
        </div></div>
      </>
    );
  }

  const due = dueCheckIns(app);
  const done = mine.filter((g) => !due.includes(g));
  const selected = mine.find((g) => g.id === goalId) ?? due[0] ?? mine[0]!;

  const item = (g: Goal, isDue: boolean) => {
    const st = app.statusOf(g);
    const latest = st.latest;
    return (
      <Link key={g.id} className="item" to={'/check-in/' + g.id} aria-current={g.id === selected.id ? 'true' : undefined}>
        <span className="row between" style={{ width: '100%', flexWrap: 'nowrap' }}>
          <span className="strong" style={isDue ? undefined : { color: 'var(--fg-2)' }}>{g.title}</span>
          <Chip k={st.status} />
        </span>
        <span className="small muted">
          {isDue ? (latest ? `Last check-in week ${latest.week}` : 'No check-ins yet') : `Checked in · ${LABEL[st.status]}`}
        </span>
      </Link>
    );
  };

  return (
    <>
      {header}
      <div className="split">
        <section className={'list' + (goalId ? ' hide-phone' : '')} aria-label="Your goals">
          <span className="label" style={{ margin: '4px 12px 8px' }}>Due this week · {due.length}</span>
          {due.map((g) => item(g, true))}
          {!due.length && <span className="small muted" style={{ padding: '0 12px' }}>All checked in. Nice.</span>}
          <span className="label" style={{ margin: '16px 12px 8px' }}>Done this week · {done.length}</span>
          {done.map((g) => item(g, false))}
        </section>
        <section className="panel" aria-label="Check-in">
          <CheckInPanel key={selected.id + '@' + week} goal={selected} />
        </section>
      </div>
    </>
  );
}

function stageWeeks(from: number, to: number) {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}

function CheckInPanel({ goal }: { goal: Goal }) {
  const app = useApp();
  const { week, cycle } = app;
  const own = app.checkInsOf(goal);
  const existing = own.find((c) => c.week === week) ?? null;
  const previous = [...own].reverse().find((c) => c.week < week) ?? null;
  const [editing, setEditing] = useState(!existing);
  const [draft, setDraft] = useState<Draft>(() => (existing ? draftFrom(existing) : emptyDraft(goal, previous)));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [raise, setRaise] = useState(draft.proposeTarget !== '');
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const e = evaluate(goal, cycle, week, draft, app.snapshot.checkIns);
  const team = app.team(goal.teamId);
  const owner = app.person(goal.ownerId);
  const isOwner = app.viewer.id === goal.ownerId;

  const intro = (
    <>
      <div className="phone-only"><Link className="btn sm" to="/">← All my goals</Link></div>
      <div className="stack" style={{ gap: 4 }}>
        <span className="small muted">{goal.headline ? 'Headline goal' : `${team?.name} · ${team?.objective}`}</span>
        <h2 className="title-xl">{goal.title}</h2>
        <span className="small muted">{kindLabel(goal)} · {goal.io} · {directionLabel(goal)} · owner {owner?.name}</span>
      </div>
    </>
  );

  if (existing && !editing) return <Posted goal={goal} c={existing} intro={intro} onEdit={() => setEditing(true)} canEdit={isOwner} />;

  const post = async () => {
    setTried(true);
    if (!e.canPost || saving) return;
    setSaving(true);
    try {
      const d = raise ? draft : { ...draft, proposeTarget: '' };
      await app.saveCheckIn(toCheckIn(goal, cycle, week, d, app.snapshot.checkIns, app.viewer.id, new Date(), existing?.id ?? newId('ci')));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {intro}
      {!isOwner && <div className="card warn small">You’re viewing {owner?.name}’s goal. Only the owner posts its check-in.</div>}
      {goal.kind !== 'milestone' && (
        <label className="field" style={{ maxWidth: 320 }}>
          <span>This week’s value</span>
          <span className="row" style={{ flexWrap: 'nowrap' }}>
            <input className="input" style={{ flex: 1, minWidth: 0 }} inputMode="decimal" autoComplete="off" value={draft.value} onChange={(ev) => set({ value: ev.target.value })} placeholder={previous?.value != null ? 'Last week ' + fmt(previous.value, goal) : 'e.g. 42'} aria-describedby="value-hint" />
            {goal.unit && <span className="muted">{goal.unit}</span>}
          </span>
          <span id="value-hint" className="tiny muted">{goal.source ? 'From ' + goal.source : 'Enter the latest reading'}</span>
        </label>
      )}
      {goal.kind === 'milestone' && <StageEditor goal={goal} draft={draft} set={set} />}
      <Numbers goal={goal} e={e} />
      <StatusCall e={e} draft={draft} set={set} tried={tried} />
      {e.reason && <ReasonSection goal={goal} e={e} draft={draft} set={set} raise={raise} setRaise={setRaise} tried={tried} />}
      {e.needsPath && <PathSection week={week} weeks={cycle.weeks} draft={draft} set={set} tried={tried} />}
      <label className="field">
        <span>Next step before the next check-in <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span>
        <input className="input" value={draft.next} onChange={(ev) => set({ next: ev.target.value })} placeholder="One thing that will move this before next week" />
      </label>
      <div className="row between" style={{ paddingTop: 12, borderTop: '1px solid var(--line-2)' }}>
        <span className={'small strong ' + (e.missing.length ? (tried ? 'tone-off' : 'muted') : 'tone-on')} role="status">
          {e.missing.length ? 'Still needed: ' + e.missing.join(', ') : 'Ready to post.'}
        </span>
        <span className="row">
          {existing && <button className="btn" onClick={() => { setDraft(draftFrom(existing)); setEditing(false); }}>Cancel</button>}
          <button className="btn primary" onClick={post} aria-disabled={!e.canPost || !isOwner || saving} disabled={!isOwner}>
            {saving ? 'Posting…' : existing ? 'Update check-in' : 'Post check-in'}
          </button>
        </span>
      </div>
    </>
  );
}

function Numbers({ goal, e }: { goal: Goal; e: Evaluation }) {
  const app = useApp();
  const { week, cycle } = app;
  const a = e.assessment;
  const gap = a.calc === 'none' ? { short: 'Enter a value', long: 'Status calculates as you type', tone: 'stale' as const } : gapText(goal, a);
  const history = app.checkInsOf(goal).filter((c) => c.week < week && c.value != null).map((c) => ({ week: c.week, value: c.value as number }));
  const series = a.kind !== 'milestone' && a.actual != null ? [...history, { week, value: a.actual }] : history;
  const statTone = gap.tone === 'ahead' ? 'ahead' : gap.tone === 'on' ? 'on' : gap.tone === 'stale' ? '' : 'off';

  let stats, figure, why;
  if (a.kind === 'metric' && goal.kind === 'metric') {
    stats = (
      <div className="grid">
        <Stat label="Actual now" value={a.actual == null ? '—' : fmt(a.actual, goal)} note={'Week ' + week} />
        <Stat label="Plan for this week" value={fmt(a.plan, goal)} note={'Week ' + week + ' checkpoint'} />
        <Stat label="Against plan" value={gap.short} note={gap.long} tone={statTone} />
        <Stat label={`Forecast at week ${cycle.weeks}`} value={a.forecast == null ? '—' : fmt(a.forecast, goal)} note={a.forecast == null ? 'Needs 4 weeks of values' : 'Target ' + fmt(a.target, goal)} tone={a.forecastMisses ? 'off' : ''} />
      </div>
    );
    figure = <MetricChart goal={goal} weeks={cycle.weeks} week={week} series={series} forecast={a.forecast} height={180} />;
    why = a.actual == null ? 'Enter this week’s value to see where it stands against the plan.' : a.ratio == null ? 'Nothing is planned to have changed yet, so it is on track unless it went backwards.'
      : `${Math.round(a.ratio * 100)}% of the progress planned by week ${week}. On track at 95% or more, at risk from 80%.` + (a.forecastMisses ? ' On the last three weeks’ trend it misses the target.' : '');
  } else if (a.kind === 'range' && goal.kind === 'range') {
    stats = (
      <div className="grid">
        <Stat label="This week" value={a.actual == null ? '—' : fmt(a.actual, goal)} />
        <Stat label="Limit" value={targetText(goal)} note={'Warning margin ' + fmt(goal.range.margin, goal)} />
        <Stat label="Against the limit" value={gap.short} note={gap.long} tone={statTone} />
        <Stat label="Last week" value={a.previous == null ? '—' : fmt(a.previous, goal)} />
      </div>
    );
    figure = <RangeChart goal={goal} weeks={cycle.weeks} week={week} series={series} height={180} />;
    why = a.actual == null ? 'Enter this week’s value to see where it stands against the limit.' : 'At risk inside the warning margin or after one breach; off track after two weeks out of range.';
  } else if (a.kind === 'milestone') {
    stats = (
      <div className="grid">
        <Stat label="Stages done" value={`${a.doneCount} of ${a.stages.length}`} />
        <Stat label="Due by now" value={`${a.dueCount} of ${a.stages.length}`} note={'Week ' + week} />
        <Stat label="Against plan" value={gap.short} note={gap.long} tone={statTone} />
        <Stat label="Target" value={targetText(goal)} />
      </div>
    );
    figure = <StageList a={a} />;
    why = 'Based on the latest stage: up to 2 weeks late is at risk, more is off track.';
  }
  return (
    <>
      {stats}
      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <figure className="card" style={{ flex: '1 1 320px', margin: 0, padding: a.kind === 'milestone' ? '4px 12px' : 10 }}>{figure}</figure>
        <div className="stack" style={{ flex: '1 1 200px' }}>
          <span className="label">Calculated status</span>
          <Chip k={a.calc === 'none' || a.calc === 'planned' ? 'none' : a.calc} label={a.calc === 'none' ? 'Waiting for a value' : undefined} />
          <span className="small" style={{ color: 'var(--fg-2)' }}>{why}</span>
        </div>
      </div>
    </>
  );
}

function StatusCall({ e, draft, set, tried }: { e: Evaluation; draft: Draft; set: (p: Partial<Draft>) => void; tried: boolean }) {
  const options: Status[] = e.calc === 'done' ? ['done', 'on', 'risk', 'off'] : ['on', 'risk', 'off'];
  const short = e.greener && draft.greenerWhy.trim().length < 10;
  return (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="strong" style={{ padding: 0, marginBottom: 8 }}>Your status call <span className="muted" style={{ fontWeight: 400 }}>· official, shown everywhere</span></legend>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        {options.map((k) => (
          <button key={k} type="button" className={'callbtn ' + k} aria-pressed={e.status === k} onClick={() => set({ status: k })}>
            <StatusShape k={k} />{LABEL[k]}
          </button>
        ))}
      </div>
      {e.greener && (
        <label className="field">
          <span className={'small ' + (tried && short ? 'tone-off' : 'tone-risk')}>Your call is greener than the calculation ({LABEL[e.calc]}). Why? <span style={{ fontWeight: 400 }}>Required, shown with the goal</span></span>
          <input className="input" value={draft.greenerWhy} onChange={(ev) => set({ greenerWhy: ev.target.value })} placeholder="e.g. The fix ships next week; expect the gap to close by week 9" />
        </label>
      )}
    </fieldset>
  );
}

function ReasonSection({ goal, e, draft, set, raise, setRaise, tried }: {
  goal: Goal; e: Evaluation; draft: Draft; set: (p: Partial<Draft>) => void; raise: boolean; setRaise: (b: boolean) => void; tried: boolean;
}) {
  const ahead = e.reason === 'ahead';
  const causes = ahead ? CAUSES_AHEAD : CAUSES_BEHIND;
  const title = ahead ? 'Why is it well ahead of plan?' : goal.kind === 'milestone' ? 'Why is it late?' : goal.kind === 'range' ? 'Why is it near or over the limit?' : 'Why is it behind plan?';
  const missing = !draft.cause || draft.why.trim().length < 10;
  return (
    <section className={'card stack' + (tried && missing ? ' bad' : '')} style={{ gap: 10 }} aria-label={title}>
      <h3 className="h3">{title} <span className="muted" style={{ fontWeight: 400 }}>· required</span></h3>
      <div className="row" role="group" aria-label="Main cause">
        {causes.map(([k, l]) => <button key={k} type="button" className="pill" aria-pressed={draft.cause === k} onClick={() => set({ cause: k })}>{l}</button>)}
      </div>
      <label className="sr" htmlFor="why">Explanation</label>
      <textarea id="why" className="input" rows={3} value={draft.why} onChange={(ev) => set({ why: ev.target.value })} placeholder={ahead ? 'What happened, and will it last?' : 'What is causing the gap?'} />
      {e.asksTarget && goal.kind === 'metric' && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="row" role="group" aria-label="Target">
            <span className="small strong">Should the target change?</span>
            <button type="button" className="pill" aria-pressed={!raise} onClick={() => { setRaise(false); set({ proposeTarget: '' }); }}>Keep {fmt(goal.plan.target, goal)}</button>
            <button type="button" className="pill" aria-pressed={raise} onClick={() => setRaise(true)}>Propose a new target</button>
          </div>
          {raise && (
            <label className="field" style={{ maxWidth: 260 }}>
              <span className="small">Proposed target</span>
              <span className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" style={{ flex: 1, minWidth: 0 }} inputMode="decimal" value={draft.proposeTarget} onChange={(ev) => set({ proposeTarget: ev.target.value })} />
                {goal.unit && <span className="muted">{goal.unit}</span>}
              </span>
              <span className="tiny muted">Goes to the review for the sponsor to approve. The plan doesn’t change until then.</span>
            </label>
          )}
        </div>
      )}
    </section>
  );
}

function PathSection({ week, weeks, draft, set, tried }: { week: number; weeks: number; draft: Draft; set: (p: Partial<Draft>) => void; tried: boolean }) {
  const options = stageWeeks(week + 1, weeks);
  const missing = draft.ptgWhat.trim().length < 8 || draft.ptgBy == null;
  return (
    <section className={'card accent stack' + (tried && missing ? ' bad' : '')} style={{ gap: 10 }} aria-label="Path to green">
      <h3 className="h3">Path to green <span className="muted" style={{ fontWeight: 400 }}>· required for At risk and Off track</span></h3>
      <label className="field">
        <span className="small">What changes</span>
        <input className="input" value={draft.ptgWhat} onChange={(ev) => set({ ptgWhat: ev.target.value })} placeholder="The one or two things that will close the gap" />
      </label>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field">
          <span className="small">Back on plan by</span>
          <select className="input" value={draft.ptgBy ?? ''} onChange={(ev) => set({ ptgBy: ev.target.value ? Number(ev.target.value) : null })}>
            <option value="">Choose a checkpoint</option>
            {options.map((w) => <option key={w} value={w}>{w === weeks ? 'Cycle end' : 'Week ' + w}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: '1 1 260px' }}>
          <span className="small">Needs a decision or help <span className="muted" style={{ fontWeight: 400 }}>· optional, goes to the review</span></span>
          <input className="input" value={draft.needs} onChange={(ev) => set({ needs: ev.target.value })} placeholder="e.g. Elena: approve an interim scope" />
        </label>
      </div>
    </section>
  );
}

type StageMode = 'planned' | 'done' | 'late';

function StageEditor({ goal, draft, set }: { goal: Extract<Goal, { kind: 'milestone' }>; draft: Draft; set: (p: Partial<Draft>) => void }) {
  const { week, cycle } = useApp();
  const update = (stageId: string, doneWeek: number | null, forecastWeek: number | null) =>
    set({ stages: goal.stages.map((s) => (s.id === stageId ? { stageId, doneWeek, forecastWeek } : draft.stages.find((u) => u.stageId === s.id) ?? { stageId: s.id, doneWeek: null, forecastWeek: null })) });
  return (
    <section className="stack" aria-label="Stages">
      <span className="strong">Where each stage stands</span>
      <div className="card" style={{ padding: '4px 12px' }}>
        {goal.stages.map((s, i) => {
          const u = draft.stages.find((x) => x.stageId === s.id);
          const mode: StageMode = u?.doneWeek != null ? 'done' : u?.forecastWeek != null && u.forecastWeek > s.dueWeek ? 'late' : 'planned';
          const lateFrom = Math.max(s.dueWeek + 1, week);
          return (
            <div key={s.id} className="row" style={{ padding: '8px 0', borderTop: i ? '1px solid var(--line-2)' : 0 }}>
              <span className="strong" style={{ flex: '1 1 180px' }}>{s.name}</span>
              <span className="small muted" style={{ flex: '0 0 84px' }}>Due week {s.dueWeek}</span>
              <label className="sr" htmlFor={'st-' + s.id}>{s.name}: state</label>
              <select id={'st-' + s.id} className="input" value={mode} onChange={(ev) => {
                const m = ev.target.value as StageMode;
                if (m === 'done') update(s.id, week, null);
                else if (m === 'late') update(s.id, null, Math.min(cycle.weeks, Math.max(lateFrom, s.dueWeek + 1)));
                else update(s.id, null, null);
              }}>
                <option value="planned">{s.dueWeek < week ? 'Not done' : 'On schedule'}</option>
                <option value="done">Done</option>
                {s.dueWeek < cycle.weeks && <option value="late">Will be late</option>}
              </select>
              {mode === 'done' && (
                <>
                  <label className="sr" htmlFor={'dw-' + s.id}>{s.name}: done in week</label>
                  <select id={'dw-' + s.id} className="input" value={u?.doneWeek ?? week} onChange={(ev) => update(s.id, Number(ev.target.value), null)}>
                    {stageWeeks(1, week).map((w) => <option key={w} value={w}>Week {w}</option>)}
                  </select>
                </>
              )}
              {mode === 'late' && (
                <>
                  <label className="sr" htmlFor={'fw-' + s.id}>{s.name}: now expected</label>
                  <select id={'fw-' + s.id} className="input" value={u?.forecastWeek ?? lateFrom} onChange={(ev) => update(s.id, null, Number(ev.target.value))}>
                    {stageWeeks(Math.min(lateFrom, cycle.weeks), cycle.weeks).map((w) => <option key={w} value={w}>Expected week {w}</option>)}
                  </select>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Posted({ goal, c, intro, onEdit, canEdit }: { goal: Goal; c: CheckIn; intro: ReactNode; onEdit: () => void; canEdit: boolean }) {
  const app = useApp();
  const target = goal.kind === 'metric' && c.proposeTarget != null ? `${fmt(goal.plan.target, goal)} → ${fmt(c.proposeTarget, goal)}` : null;
  return (
    <>
      {intro}
      <div className="note-good" role="status">
        <strong>Checked in for week {c.week} · {LABEL[c.status]}.</strong>{' '}
        {goal.kind !== 'milestone' && c.value != null && <>Value {fmt(c.value, goal)}. </>}
        {c.why && c.why !== 'On plan.' ? c.why : ''}
      </div>
      {c.cause && <div className="row"><span className="small muted">Cause</span><span className="chip planned">{causeLabel(c.cause)}</span></div>}
      {c.greenerWhy && <div className="note-bad"><strong>Greener than calculated ({LABEL[c.calculated]}).</strong> {c.greenerWhy}</div>}
      {c.pathToGreen && (
        <section className="card focus stack" style={{ gap: 6 }}>
          <div className="row between"><h3 className="h3">Path to green</h3><span className="tiny strong" style={{ color: 'var(--accent-text)' }}>Back on plan by {weekLabel(c.pathToGreen.byWeek, app.cycle.weeks)}</span></div>
          <p>{c.pathToGreen.what}</p>
          {c.pathToGreen.needs && <span className="small"><strong>Needs:</strong> {c.pathToGreen.needs}</span>}
        </section>
      )}
      {target && <div className="card warn"><strong>Target change proposed:</strong> {target}. Waiting for the sponsor to approve it in the review.</div>}
      {c.next && <p className="small"><strong>Next step:</strong> {c.next}</p>}
      <div className="row">
        {canEdit && <button className="btn sm" onClick={onEdit}>Edit check-in</button>}
        <Link className="btn sm" to={'/goals/' + goal.id}>Open goal page</Link>
      </div>
    </>
  );
}

