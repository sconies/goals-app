/* A proposed goal's page (goal entry 2.15, GE10): "Proposed" as a word above the title (no shape, no capsule: a state
   that isn't a status is a word), the key line, what the viewer may do, and one block in place of the summary, the
   scorecard and the chart. Its owner or an admin makes it active ("Make it active", a block in place; a sheet on a
   phone); whoever proposed it may change or withdraw it; anyone may comment, ask and watch. Loaded with the goal's
   page, only when a proposed goal is opened. The words are the domain's (domain/proposed, domain/readBack). */
import '../styles/notes/proposed.css';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AppStateProvider, useApp } from '../app/state';
import { usePrefs } from '../app/search';
import { markOpened } from '../app/proposalSeen';
import { activeReadBack } from '../domain/readBack';
import { MEASURE_UNSAID, measureUnsaid } from '../domain/proposedSummary';
import { mayActivate, readyToActivate } from '../domain/proposedActions';
import { mayChangeGoal } from '../domain/goalRights';
import { fmt, staysText, targetText } from '../domain/format';
import { levelName } from '../domain/levels';
import { planEnd } from '../domain/plan';
import { weekSays } from '../domain/weeks';
import type { Goal } from '../domain/types';
import { GoalBack } from '../ui/BackLink';
import { ChangeItem } from '../ui/ChangeItem';
import { WatchButton } from '../ui/goalRows';
import { Sheet } from '../ui/bits';
import { WeekPick } from '../ui/WeekPick';
import { AskQuestionSheet, NoteComposer } from './GoalScreen';

const DAY = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`; };
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : one + 's'}`;

/** What it would measure, in one sentence (2.15, item 3). */
export function wouldSay(goal: Goal, parent: Goal | undefined, weeks: number): string {
  if (measureUnsaid(goal)) return MEASURE_UNSAID;
  const feeds = parent ? `, and feed “${parent.title}”${parent.key ? ` (${parent.key})` : ''}` : '';
  const what = goal.kind === 'metric'
    ? `move from ${fmt(goal.plan.start, goal)} to ${fmt(goal.plan.target, goal)} over ${plural(planEnd(goal.plan, weeks) - (goal.plan.fromWeek ?? 0), 'week')}`
    : goal.kind === 'range' ? (goal.range.bound === 'between' ? `stay ${staysText(goal)}` : `stay at or ${goal.range.bound === 'atMost' ? 'under' : 'over'} ${fmt(goal.range.limit, goal)}`) : `hit ${plural(goal.stages.length, 'stage')}`;
  return `It would ${what}${feeds}.`;
}

/**
 * The page, with the workspace as it would be with this one goal among its goals, so what it shares with any goal's
 * page (watching, comments, asks) finds it. Nothing here judges it: the page draws no status for it.
 */
export function ProposedGoal({ goal }: { goal: Goal }) {
  const app = useApp();
  const prefs = usePrefs();
  // Its owner has seen it: Home's "{Name} proposed a goal for you" row goes (rule 14).
  useEffect(() => { if (goal.ownerId === app.viewer.id) markOpened(prefs, app.ws.id, app.viewer.id, goal.id); }, [prefs, app.ws.id, app.viewer.id, goal.id, goal.ownerId]);
  const value = useMemo(() => (app.snapshot.goals.some((g) => g.id === goal.id) ? app : { ...app, snapshot: { ...app.snapshot, goals: [...app.snapshot.goals, goal] } }), [app, goal]);
  return <AppStateProvider value={value}><ProposedPage goal={goal} /></AppStateProvider>;
}

function ProposedPage({ goal }: { goal: Goal }) {
  const app = useApp();
  const nav = useNavigate();
  const owner = app.person(goal.ownerId);
  const proposer = goal.proposedBy ? app.person(goal.proposedBy) : undefined;
  const team = app.team(goal.teamId);
  const parent = goal.parentId ? app.goal(goal.parentId) : undefined;
  const canActivate = mayActivate(app.viewer, goal);
  const canChange = mayChangeGoal(app.viewer, goal);
  const missing = canActivate ? readyToActivate(goal, { cycleWeeks: app.cycle.weeks, week: app.week, startDate: app.cycle.startDate }) : [];
  const [activating, setActivating] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [asking, setAsking] = useState(false);
  const ownerFirst = owner?.name.split(' ')[0] ?? 'the owner';
  const whoMay = `${owner?.name ?? 'Its owner'} or an admin can make this active.`;
  const changes = app.snapshot.changes.filter((c) => c.goalId === goal.id).slice().sort((a, b) => b.at.localeCompare(a.at));
  const edit = `/goals/${goal.key ?? goal.id}/edit`;
  const withdraw = async () => {
    try { await app.deleteGoal(goal); nav('/goals', { replace: true }); } catch { setWithdrawing(false); }
  };
  return (
    <div className="page narrow goal-proposed" data-part="Proposed goal">
      <GoalBack />
      <p className="proposed-word" data-state="proposed">Proposed</p>
      <h1 className="title-xl">{goal.title}</h1>
      <p className="small muted proposed-key">
        {[goal.key, `${owner?.name ?? '—'}${team ? `, ${team.name}` : ''}`, proposer && goal.proposedAt ? `proposed by ${proposer.name.split(' ')[0]} on ${DAY(goal.proposedAt)}` : null].filter(Boolean).join(' · ')}
      </p>

      {/* One primary at most: Make it active (or Finish it) for its owner or an admin; then Change it and Withdraw it. */}
      {canActivate ? (
        <div className="row proposed-actions" data-part="Actions">
          {missing.length
            ? <Link className="btn primary" to={edit + '#definition'}>Finish it</Link>
            : <button type="button" className="btn primary" aria-expanded={activating} onClick={() => setActivating(true)}>Make it active</button>}
          <Link className="btn" to={edit}>Change it</Link>
          <button type="button" className="linkish" onClick={() => setWithdrawing(true)}>Withdraw it</button>
        </div>
      ) : canChange ? (
        <>
          <p className="small">{whoMay}</p>
          <div className="row proposed-actions" data-part="Actions">
            <Link className="btn" to={edit}>Change it</Link>
            <button type="button" className="linkish" onClick={() => setWithdrawing(true)}>Withdraw it</button>
          </div>
        </>
      ) : (
        <>
          <p className="small">{whoMay}</p>
          <div className="row proposed-actions" data-part="Actions">
            <button type="button" className="btn" onClick={() => document.querySelector<HTMLButtonElement>('.note-open')?.click()}>Add a comment</button>
            {goal.ownerId !== app.viewer.id && <button type="button" className="btn" onClick={() => setAsking(true)}>Ask {ownerFirst} a question</button>}
            <WatchButton goal={goal} />
          </div>
        </>
      )}
      {missing.length > 0 && <p className="hint">Before it can be made active: {missing.map((f) => f.text).join(' ')}</p>}

      {withdrawing && (
        <div className="confirm-row" role="alertdialog" aria-label="Withdraw the proposal">
          <p className="small">Withdraw “{goal.title}”? It goes to Recently removed for 30 days.</p>
          <span className="row"><button type="button" className="btn" onClick={() => void withdraw()}>Withdraw it</button><button type="button" className="linkish" onClick={() => setWithdrawing(false)}>Keep it</button></span>
        </div>
      )}

      {/* In place of the summary, the scorecard and the chart. */}
      <section className="block proposed-block" data-part="Proposed" aria-label="Proposed, not yet active">
        <p>Proposed, not yet active. Nothing is due and it has no status. {wouldSay(goal, parent, app.cycle.weeks)}</p>
        <p className="hint">The scorecard, the chart and History’s weeks start when it is made active.</p>
      </section>

      {activating && <MakeActive goal={goal} onClose={() => setActivating(false)} />}
      {asking && <AskQuestionSheet goal={goal} onClose={() => setAsking(false)} />}

      <section className="block" aria-labelledby="p-about" data-part="About this goal">
        <h2 className="block-title" id="p-about">About this goal</h2>
        <dl className="details">
          <dt>Level</dt><dd>{levelName(app.cycle, goal.level)}</dd>
          <dt>Feeds into</dt><dd>{parent ? <Link to={'/goals/' + parent.id}>{parent.title}</Link> : 'Nothing: the top of its own tree'}</dd>
          {!measureUnsaid(goal) && <><dt>Target</dt><dd>{targetText(goal)}</dd></>}
          {goal.definition && <><dt>What it measures</dt><dd>{goal.definition}</dd></>}
        </dl>
      </section>

      {/* History: changes and comments, with no week rows. */}
      <section className="block activity history" id="history" aria-labelledby="p-history" data-part="History">
        <h2 className="block-title" id="p-history">History</h2>
        <NoteComposer goal={goal} />
        {changes.length ? <ol className="stream">{changes.map((c) => <ChangeItem key={c.id} c={c} manage={c.entity === 'note'} />)}</ol> : <p className="small muted">Nothing here yet.</p>}
      </section>
    </div>
  );
}

/**
 * "Make it active" (2.15): a block in place on a wide screen, a full sheet on a phone. A number goal's From starts as this
 * week whatever was typed when it was proposed; the read-back says the plan from then and when the first check-in is due.
 */
function MakeActive({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const app = useApp();
  const phone = typeof window !== 'undefined' && window.innerWidth < 600;
  const [from, setFrom] = useState(Math.max(0, app.week));
  const [busy, setBusy] = useState(false);
  const [past, setPast] = useState<'' | 'yes'>('');
  const proposer = goal.proposedBy && goal.proposedBy !== app.viewer.id ? app.person(goal.proposedBy)?.name ?? null : null;
  const watchers = (app.snapshot.watches ?? []).filter((w) => w.kind === 'goal' && w.ref === goal.id).length;
  const says = activeReadBack(goal, { cycle: app.cycle, week: app.week, today: app.today, rhythm: 'weekly', fromWeek: from, proposer, watchers });
  // From before this week (from-past): asked, never assumed.
  const before = goal.kind === 'metric' && from < app.week;
  const ago = app.week - from;
  const go = async () => {
    if (before && past !== 'yes') return;
    setBusy(true);
    try { await app.run('activate', { goalId: goal.id, ...(goal.kind === 'metric' ? { fromWeek: from, confirm: past === 'yes' } : {}) }); onClose(); } catch { setBusy(false); }
  };
  const body = (
    <div className="stack make-active" data-part="Make it active">
      {goal.kind === 'metric' && (
        <div className="week-rows">
          <div className="field"><span className="small strong">Baseline</span><span>{fmt(goal.plan.start, goal)}</span></div>
          <WeekPick cycle={app.cycle} week={app.week} field="from" label="From" labelClass="small strong" value={from} onChange={(n) => { setFrom(n); setPast(''); }} />
        </div>
      )}
      {goal.kind === 'milestone' && <ul className="small">{goal.stages.map((s) => <li key={s.id}>{s.name}: due {weekSays(app.cycle, s.dueWeek, 'sentence')}</li>)}</ul>}
      {before && (
        <div className="check-block" role="group" aria-label="Has this been running since then?">
          <p className="small">Week {from} was {plural(ago, 'week')} ago. Has this been running since then?</p>
          <label className="check"><input type="radio" name="from-past" checked={past === 'yes'} onChange={() => setPast('yes')} /> Yes, it was {fmt(goal.kind === 'metric' ? goal.plan.start : 0, goal)} in week {from}</label>
          <label className="check"><input type="radio" name="from-past" checked={false} onChange={() => { setFrom(app.week); setPast(''); }} /> No, start from this week</label>
        </div>
      )}
      <p className="small make-active-says" role="status">{says}</p>
      <div className="row">
        <button type="button" className="btn primary" disabled={busy || (before && past !== 'yes')} onClick={() => void go()}>Make it active</button>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
  if (phone) return <Sheet open onClose={onClose} title="Make it active">{body}</Sheet>;
  return <section className="block make-active-block" aria-label="Make it active"><h2 className="block-title">Make it active</h2>{body}</section>;
}
