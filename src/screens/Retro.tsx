/* Closing the cycle: each owner wraps up their goals (how it landed, what we learned, carry on or stop),
   everyone sees the summary, and an admin starts the next cycle with the goals that carry on. */
import { OWNER_VIEW_LABEL } from '../domain/vocabulary';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { periodLabel, periodWord } from '../domain/year';
import { RESULT_LABEL, suggestedResult, wrapUpOpen } from '../domain/cycle';
import { MIN_LEARNED } from '../domain/actions';
import { fmt, gapBeside, NO_VALUE } from '../domain/format';
import { assessPosted } from '../domain/status';
import type { Goal, Retro } from '../domain/types';
import { newId } from '../data/store';
import { Chip, Empty, LevelTag, ProgressRing, Sheet } from '../ui/bits';
import { FormClose } from '../ui/FormClose';

const RESULTS: Retro['result'][] = ['hit', 'partly', 'missed'];

function nowText(g: Goal, app: ReturnType<typeof useApp>) {
  const a = assessPosted(g, app.cycle, app.snapshot.checkIns, app.week);
  return a.kind === 'milestone' ? `${a.doneCount} of ${a.stages.length} stages` : a.actual == null || g.kind === 'milestone' ? NO_VALUE : `${fmt(a.actual, g)}${g.kind === 'metric' ? ` of ${fmt(g.plan.target, g)}` : ''}`;
}

export function WrapUp() {
  const app = useApp();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const open = wrapUpOpen(app.cycle, app.week);
  const w = periodWord(app.cycle);
  const retroOf = (g: Goal) => app.snapshot.retros.find((r) => r.goalId === g.id);
  const mine = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id);
  const myLeft = mine.filter((g) => !retroOf(g));
  const all = app.snapshot.goals;
  const done = all.filter((g) => retroOf(g));
  const left = all.filter((g) => !retroOf(g));
  const carry = all.filter((g) => (retroOf(g)?.next ?? 'carry') === 'carry');

  const start = async () => {
    setBusy(true);
    try {
      const name = await app.startNextCycle();
      app.toast(`${name} has started`);
      nav('/');
    } catch { setBusy(false); }
  };

  return (
    <div className="page narrow">
      <div className="page-head">
        <span className="eyebrow">{periodLabel(app.cycle, app.week)}</span>
        <h1 className="title-xl">Wrap up the {w}</h1>
        <span className="hint">Each owner says how their goals landed and what they learned. Then next {w}’s goals start with the ones that carry on.</span>
      </div>
      {!open && (
        <div className="calm">The wrap-up opens in week {app.cycle.weeks - 1}. {app.cycle.weeks - 1 - app.week === 1 ? 'That’s next week.' : `That’s in ${app.cycle.weeks - 1 - app.week} weeks.`}</div>
      )}

      {open && mine.length > 0 && (
        <section className="hero">
          <ProgressRing done={mine.length - myLeft.length} total={mine.length} size={56} label={`${mine.length - myLeft.length} of ${mine.length} of your goals wrapped up`} />
          <div className="hero-body">
            <h2 className="hero-title">{myLeft.length ? (myLeft.length === 1 ? '1 goal to wrap up' : `${myLeft.length} goals to wrap up`) : 'Your goals are wrapped up'}</h2>
            <span className="muted">{myLeft.length ? 'About a minute each: how it landed, one thing you learned, carry on or stop.' : `You can still change what you wrote until next ${w} starts.`}</span>
            {myLeft.length > 0 && <div className="row" style={{ marginTop: 'var(--s2)' }}><Link className="btn primary big-btn" to={`/retro/${myLeft[0]!.id}`}>Wrap up {myLeft[0]!.title}</Link></div>}
          </div>
        </section>
      )}

      <section className="block">
        <div className="row between">
          <h2 className="block-title">How the {w} landed</h2>
          <span className="hint">{done.length} of {all.length} wrapped up</span>
        </div>
        {done.length > 0 && (
          <p className="lede">{OWNER_VIEW_LABEL}: {RESULTS.map((r) => [r, done.filter((g) => retroOf(g)!.result === r).length] as const).filter(([, n]) => n).map(([r, n]) => `${n} ${RESULT_LABEL[r].toLowerCase()}`).join(' · ')}</p>
        )}
        <ul className="retro-list">
          {[...done, ...left].map((g) => {
            const r = retroOf(g);
            const owner = app.person(g.ownerId);
            const canWrite = open && (g.ownerId === app.viewer.id || app.viewer.admin);
            return (
              <li key={g.id} className="retro-row" data-result={r?.result ?? 'none'}>
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <span className="strong">{g.title}<LevelTag level={g.level} /></span>
                  <span className="hint">{owner?.name} · {nowText(g, app)}</span>
                  {r ? <span className="small">{r.learned}</span> : <span className="hint">Not wrapped up yet.</span>}
                </span>
                <span className="stack" style={{ gap: 'var(--s1)', alignItems: 'flex-end' }}>
                  {/* The owner's own words, labelled as theirs, so they're never read as the goal's result (Met, Not met). */}
                  {r ? <span className="stack" style={{ gap: 0, alignItems: 'flex-end' }}><span className="hint">{OWNER_VIEW_LABEL}</span><span className={'result-tag result-' + r.result}>{RESULT_LABEL[r.result]}</span></span> : <Chip k={app.statusOf(g).status} />}
                  {r && <span className="hint">{r.next === 'carry' ? 'Carries on' : 'Stops'}</span>}
                  {canWrite && <Link className="linkish small" to={`/retro/${g.id}`}>{r ? 'Change' : 'Wrap up'}</Link>}
                </span>
              </li>
            );
          })}
        </ul>
        {!all.length && <Empty title={`No goals this ${w}`} />}
      </section>

      {app.viewer.admin && open && (
        <section className="block note-card">
          <span className="stack" style={{ gap: 'var(--s1)' }}>
            <strong>Start next {w}</strong>
            <span className="hint">{carry.length} {carry.length === 1 ? 'goal carries' : 'goals carry'} on{all.length - carry.length ? `, ${all.length - carry.length} stop` : ''}.{left.length ? ` ${left.length} not wrapped up yet; they carry on unless their owner says stop.` : ''}</span>
          </span>
          <button className="btn" onClick={() => setConfirming(true)}>Start it</button>
        </section>
      )}
      <Sheet open={confirming} onClose={() => setConfirming(false)} title={`Start next ${w}?`}>
        <div className="stack" style={{ gap: 'var(--s4)' }}>
          <p>{carry.length} {carry.length === 1 ? 'goal moves' : 'goals move'} into next {w}, starting from where {carry.length === 1 ? 'it' : 'they'} ended. Owners can change targets in the first week. This {w} and its retros stay in the change log.</p>
          {left.length > 0 && <p className="hint tone-risk">{left.length} {left.length === 1 ? 'goal hasn’t' : 'goals haven’t'} been wrapped up.</p>}
          <div className="foot-row"><button className="btn ghost big-btn" onClick={() => setConfirming(false)}>Not yet</button><button className="btn primary big-btn" disabled={busy} onClick={() => void start()}>{busy ? 'Starting…' : `Start next ${w}`}</button></div>
        </div>
      </Sheet>
    </div>
  );
}

/** One goal's retro, on one screen. */
export function RetroGoal() {
  const app = useApp();
  const { goalId } = useParams();
  const goal = goalId ? app.goal(goalId) : undefined;
  if (!goal) return <div className="page narrow"><Empty title={`This goal isn’t in this ${periodWord(app.cycle)}`}><Link className="btn" to="/retro">Back to the wrap-up</Link></Empty></div>;
  if (goal.ownerId !== app.viewer.id && !app.viewer.admin) return <div className="page narrow"><Empty title="Only its owner wraps up this goal"><Link className="btn" to="/retro">Back to the wrap-up</Link></Empty></div>;
  return <RetroForm key={goal.id} goal={goal} />;
}

function RetroForm({ goal }: { goal: Goal }) {
  const app = useApp();
  const nav = useNavigate();
  const before = app.snapshot.retros.find((r) => r.goalId === goal.id) ?? null;
  const [result, setResult] = useState<Retro['result']>(before?.result ?? suggestedResult(goal, app.cycle, app.snapshot.checkIns, app.today));
  const [learned, setLearned] = useState(before?.learned ?? '');
  const [next, setNext] = useState<Retro['next']>(before?.next ?? 'carry');
  // Something typed or chosen since it opened: closing asks first (navigation spec 2.5).
  const [start] = useState(() => JSON.stringify([result, learned, next]));
  const dirty = JSON.stringify([result, learned, next]) !== start;
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const st = app.statusOf(goal);
  const a = assessPosted(goal, app.cycle, app.snapshot.checkIns, app.week);
  const gap = gapBeside(goal, a);
  const ok = learned.trim().length >= MIN_LEARNED;
  const mineLeft = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id && g.id !== goal.id && !app.snapshot.retros.some((r) => r.goalId === g.id));
  const save = async () => {
    setTried(true);
    if (!ok || busy) return;
    setBusy(true);
    try {
      await app.saveRetro(goal, { id: before?.id ?? newId('retro'), goalId: goal.id, cycleId: app.cycle.id, result, learned: learned.trim(), next, byId: app.viewer.id, at: app.stamp() }, before);
      app.toast(`Wrapped up ${goal.title}`);
      nav(mineLeft.length && !before ? `/retro/${mineLeft[0]!.id}` : '/retro');
    } catch { setBusy(false); }
  };
  return (
    <div className="focus">
      <div className="focus-top">
        <span className="small strong">Wrap up</span>
        <span className="hint">{mineLeft.length && !before ? `${mineLeft.length} more after this` : ''}</span>
        <FormClose keeps={false} dirty={dirty} onClose={() => nav('/retro')} />
      </div>
      <form className="focus-body" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <div className="stack" style={{ gap: 'var(--s2)' }}>
          <h1 className="qtitle big">{goal.title}</h1>
          <span className="row" style={{ gap: 'var(--s2)' }}><Chip k={st.status} /><span className="strong">{nowText(goal, app)}</span>{st.status !== 'stale' && gap && <span className={'small tone-' + gap.tone}>{gap.short}</span>}</span>
        </div>
        <div className="field"><span className="field-label" id="res-l">How did it land? ({OWNER_VIEW_LABEL.toLowerCase().replace(/^owner’s/, 'your')})</span>
          <div className="seg full" role="group" aria-labelledby="res-l">{RESULTS.map((r) => <button key={r} type="button" aria-pressed={result === r} onClick={() => setResult(r)}>{RESULT_LABEL[r]}</button>)}</div>
          {!before && <span className="hint">Picked from where it ended. Change it if the numbers don’t tell the whole story.</span>}
        </div>
        <label className="field"><span className="field-label">What did you learn?</span>
          <textarea className={'input' + (tried && !ok ? ' invalid' : '')} rows={3} value={learned} onChange={(e) => setLearned(e.target.value)} placeholder="One thing worth knowing next time" aria-label="What did you learn?" />
          {tried && !ok && <span className="hint tone-off" role="alert">Write a sentence about what you learned.</span>}
        </label>
        <div className="field"><span className="field-label" id="next-l">Next {periodWord(app.cycle)}</span>
          <div className="seg full" role="group" aria-labelledby="next-l">
            <button type="button" aria-pressed={next === 'carry'} onClick={() => setNext('carry')}>Carry it on</button>
            <button type="button" aria-pressed={next === 'stop'} onClick={() => setNext('stop')}>Stop it here</button>
          </div>
          <span className="hint">{next === 'carry' ? (goal.kind === 'metric' ? `It starts next ${periodWord(app.cycle)} from where it ended; you can change the target then.` : `It starts next ${periodWord(app.cycle)} with what’s left.`) : `It stays in this ${periodWord(app.cycle)}’s history.`}</span>
        </div>
        <div className="focus-foot"><div className="foot-row"><button className="btn primary big-btn" type="submit" disabled={busy}>{busy ? 'Saving…' : before ? 'Save changes' : 'Save and continue'}</button></div></div>
      </form>
    </div>
  );
}
