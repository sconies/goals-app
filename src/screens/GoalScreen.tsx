/* A goal's page: the app's flagship (approved by Lane, 5 Nov). It answers, in order: what is this goal and who owns
   it; how is it doing; if badly, why; what is being done and how those actions are going; where it's heading; what has
   happened, and what was said the last time it was discussed. Each fact has one home (Lane, 5 Nov, on a phone: "the
   target four times, the trend three times"): the bar carries the status, the number and the scorecard (vs plan, vs
   last week, to target, will it hit); the chart marks those numbers where they are; Why opens with the owner's reason;
   What feeds it opens with how the goals feeding it stand; and every section says in one line what it answers.
   The words come from the domain (domain/goalPage and the modules it asks); this file lays them out. */
import { Place } from '../core/app';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { useSeen } from '../app/goalSeen';
import { saveFile } from '../app/files';
import { causeLabel } from '../domain/checkin';
import { directionLabel, fmt, LEVEL_LABEL } from '../domain/format';
import { planHistoryOf, valueSeries, weekDates } from '../domain/plan';
import { assessMilestone, assessPosted, LABEL } from '../domain/status';
import { goalScorecard, projects, type ScoreCell, type Scorecard } from '../domain/scorecard';
import { criticalPath } from '../domain/map';
import { isYear, quarterOf, quarterResults } from '../domain/year';
import { ASK_KIND_LABEL, asksOf, canMarkDone, canWithdraw, openUpdateAsk } from '../domain/asks';
import { dayText, goalsIn, watchOf, watchScope } from '../domain/review';
import { reviewDate } from '../domain/progress';
import { NextStepSheet } from '../ui/NextStepSheet';
import {
  actionList, activityStream, askedOf, barFigures, feedingOrder, feedsLine, firstLook, lastTalked, pathCheck, planFor, postedLine,
  primaryAction, sameReasonText, sinceLooked, updatedLine, streamMatches, whyLine, type ActionItem, type AskedItem, type StreamFilter, type StreamItem,
} from '../domain/goalPage';
import type { Ask, CheckIn, DisplayStatus, Goal, MetricGoal } from '../domain/types';
import { Avatar, Chip, Empty, LevelTag, StatusShape, timeAgo, WarnMark } from '../ui/bits';
import { MetricChart, QuarterMark, quarterWords, RangeChart, StageList, type Scrub } from '../ui/charts';
import { PlanTable } from '../ui/PlanTable';
import { ReviewBar, ReviewCallBar, useReview } from './Inspect';
import { GoalRow, WatchButton } from '../ui/goalRows';
import { ChangeItem, whenText } from '../ui/ChangeItem';
import { RespondForm } from './Respond';
import { Icon } from '../ui/Icon';
import { GoalBack } from '../ui/BackLink';
import { CountNumber } from '../ui/Count';
import { MenuButton } from '../ui/MenuButton';
import { useShellTop } from '../ui/shellTop';
import { useWidth } from '../ui/useWidth';
import { MOTION_MS, reducedMotion, STORY_MS } from '../ui/motion';
import { effectOn, landedMoment, openMotionLab, storyOn, storyPace } from '../app/appearance';
import { shareCardPng, type ShareCard } from '../ui/shareCard';
import { ArchivedGoalScope } from '../app/state';
import { canDeleteCheckIn } from '../domain/removal';
import { DeleteCheckIn, StoppedNote } from '../ui/RemoveControls';
import { goalRemoveLabel, RemoveGoalSheet } from '../ui/RemoveSheets';
import { LifeMark } from '../ui/LifeMark';
import { NO_REASON } from '../domain/checkin';
import { ASK_KIND, ASK_STATUS, GAP, LABEL as WORD_OF, lower, QUARTER, STATUS } from '../domain/vocabulary';

export function GoalScreen() {
  const app = useApp();
  const { goalId } = useParams();
  const goal = goalId ? app.goal(goalId) : undefined;
  // The Motion lab's "Replay this page" plays the story again by mounting the page afresh.
  const [replay, setReplay] = useState(0);
  useEffect(() => { const on = () => setReplay((n) => n + 1); window.addEventListener('goals-replay', on); return () => window.removeEventListener('goals-replay', on); }, []);
  if (!goal) return <div className="page narrow"><Empty title="This goal doesn’t exist"><Link className="btn sm" to="/goals">All goals</Link></Empty></div>;
  // A stopped goal keeps its page, as it stood, marked Stopped (domain/removal). Always inside the scope, so stopping
  // the goal or undoing it carries on with the same page rather than mounting a new one.
  return <ArchivedGoalScope goalId={goal.id}><GoalView key={goal.id + ':' + app.viewer.id + ':' + replay} goal={goal} /></ArchivedGoalScope>;
}

/** Where the page's two columns start: as the shared side-column layout does (styles.css, `.split`). */
const WIDE = 960;

/** Five quick taps on a goal's status open the Motion lab (an Easter egg). */
const taps: number[] = [];
function secretTap() {
  const now = Date.now();
  taps.push(now);
  while (taps.length && now - taps[0]! > 2000) taps.shift();
  if (taps.length >= 5) { taps.length = 0; openMotionLab(); }
}

function GoalView({ goal }: { goal: Goal }) {
  const app = useApp();
  const { cycle, week } = app;
  const att = app.attentionOf(goal);
  const st = att.status;
  const status = st.status;
  const stale = status === 'stale';
  const own = app.checkInsOf(goal);
  const owner = app.person(goal.ownerId);
  const ownerFirst = owner?.name.split(' ')[0] ?? 'the owner';
  const isOwner = app.viewer.id === goal.ownerId;
  const canEdit = isOwner || app.viewer.admin;
  const rv = useReview(goal.id);
  const review = rv.active;
  const [params, setParams] = useSearchParams();
  const [page, width] = useWidth<HTMLDivElement>();
  const wide = width >= WIDE;

  // How the person arrived: to answer something (?respond=<id>, or the older ?tab=comments), just after posting a
  // check-in (?posted=1), just after publishing (?published=1), or to look.
  const respondId = params.get('respond');
  const tabComments = params.get('tab') === 'comments';
  const [posted] = useState(() => params.get('posted') === '1');
  const published = params.get('published') === '1' && own.length === 0;
  const seen = useSeen(app.ws.id, app.viewer.id, goal.id, status, app.stamp);
  const firstVisit = !seen;

  const asked = askedOf(goal, app.snapshot, app.viewer, respondId);
  // ?tab=comments was Home's old Answer link: an owner's open question is what it meant; otherwise the comment box.
  const alias = tabComments && !respondId ? asked.find((x) => x.kind === 'question')?.id ?? null : null;
  const target = respondId && asked.some((x) => x.id === respondId) ? respondId : alias;
  const [openAsk, setOpenAsk] = useState<string | null>(target);
  const [focusAsk, setFocusAsk] = useState(!!target);
  const askedRef = useRef<HTMLElement>(null);
  const done = (id: string) => {
    setOpenAsk((x) => (x === id ? null : x));
    if (respondId === id) setParams((p) => { p.delete('respond'); return p; }, { replace: true });
  };

  const children = app.snapshot.goals.filter((g) => g.parentId === goal.id);
  const updateAsk = openUpdateAsk(goal.id, app.snapshot);
  const due = att.flags.some((f) => f.kind === 'due');
  const watching = !isOwner && watchOf(app.viewer.id, goal, app.snapshot) !== null;
  const primary = primaryAction({ goal, viewer: app.viewer, owner, status, due, week, asked, updateAsked: !!updateAsk, watching });

  const figures = barFigures(goal, app.snapshot, cycle, week, stale);
  const card = goalScorecard(goal, cycle, app.snapshot.checkIns, week, stale);
  const why = whyLine(goal, app.snapshot, att);
  const feeds = feedsLine(children, (g) => app.statusOf(g).status);
  const a = assessPosted(goal, cycle, app.snapshot.checkIns, week);
  const hit = goal.kind === 'metric' && a.kind === 'metric' && a.actual != null && !stale && (a.actual - goal.plan.target) * (Math.sign(goal.plan.target - goal.plan.start) || 1) >= 0;

  // The context line: just posted, or what's new since the last look, or (first time) what the number is.
  const postedText = posted ? postedLine(goal, app.snapshot, cycle, week) : null;
  // Since you looked: only when something has changed; nothing new says nothing (Lane, 5 Nov).
  const looked = !posted && seen ? sinceLooked(goal, app.snapshot, seen, status, app.today) : null;
  const since = looked && (looked.checkIns + looked.comments + looked.changes > 0 || looked.statusFrom) ? looked : null;
  const statusMoved = !!since?.statusFrom || (!!postedText?.from && postedText.from !== postedText.to);

  // Asking a quiet goal's owner for an update stays visible ("Asked 2 hours ago") until the next check-in; whoever asked
  // can undo it (Senior UX review, finding 9).
  const [asking, setAsking] = useState(false);
  const [undone, setUndone] = useState(false);
  const askForUpdate = async () => {
    if (asking) return;
    setAsking(true); setUndone(false);
    try { await app.askForUpdate(goal); } catch { /* the save already said what went wrong */ } finally { setAsking(false); }
  };
  const undoAsk = async () => {
    if (asking) return;
    setAsking(true);
    try { await app.undoUpdateAsk(goal); setUndone(true); } catch { /* the save already said what went wrong */ } finally { setAsking(false); }
  };

  const openAskedItem = (id: string | null) => {
    setOpenAsk(id); setFocusAsk(true);
    requestAnimationFrame(() => askedRef.current?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }));
  };

  /* ---------- the bar's one main action, Watch beside it, and the "…" menu ---------- */
  const stopped = !!goal.stoppedAt;
  const [removing, setRemoving] = useState(false);
  const [aboutOpen, setAboutOpen] = useState<boolean | null>(null);
  const aboutRef = useRef<HTMLDetailsElement>(null);
  const share = useShare(goal, figures.now, figures.against, why.text ?? '', status);
  const changeThis = () => { setAboutOpen(true); requestAnimationFrame(() => document.getElementById('change-goal')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })); };
  const menu = (
    <MenuButton label="More about this goal" className="bar-menu" icon={<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" fill="currentColor" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /><circle cx="12.5" cy="8" r="1.4" fill="currentColor" /></svg>}
      items={[
        { label: 'Share image', onClick: () => void share.image() },
        { label: 'Copy link', onClick: () => void share.link() },
        { label: 'Print or save as PDF', to: `/goals/${goal.id}/print` },
        ...(!stopped && isOwner && week > 0 && primary.kind !== 'check-in' ? [{ label: due ? `Check in for week ${week}` : 'Check in again', to: '/check-in/' + goal.id }] : []),
        ...(!stopped && canEdit ? [{ label: 'Change this goal', onClick: changeThis }] : []),
        // Stop a goal with history (with a reason), or delete one set up by mistake: its owner or an admin.
        ...(!stopped && canEdit ? [{ label: goalRemoveLabel(own.length > 0), onClick: () => setRemoving(true) }] : []),
      ]} />
  );
  const showPrimary = !stopped && !review && !published && !(primary.targetId && openAsk === primary.targetId);
  const mainAction: ReactNode = !showPrimary || !primary.kind ? null
    : primary.kind === 'check-in' ? <Link className="btn primary" to={'/check-in/' + goal.id}>{primary.label}</Link>
    : primary.kind === 'watch' ? <WatchButton goal={goal} primary />
    : primary.kind === 'ask-update' ? <button type="button" className="btn primary" disabled={asking} onClick={() => void askForUpdate()}>{primary.label}</button>
    : <button type="button" className="btn primary" onClick={() => openAskedItem(primary.targetId)}>{primary.label}</button>;
  const actions = review ? null : (
    <>
      {mainAction}
      {!stopped && !isOwner && primary.kind !== 'watch' && <WatchButton goal={goal} />}
      {menu}
    </>
  );
  const askedLine = stopped ? <StoppedNote goal={goal} /> : !isOwner && stale && !review && (updateAsk
    ? <span className="small asked-line" role="status"><span className="strong">Asked {ownerFirst} for an update {timeAgo(updateAsk.createdAt, app.today)}{updateAsk.askedBy !== app.viewer.id ? ` (${app.person(updateAsk.askedBy)?.name.split(' ')[0] ?? 'someone'})` : ''}.</span> It’s open on their Home until they check in or answer it.{canWithdraw(updateAsk, app.viewer, goal) && <> <button type="button" className="linkish" disabled={asking} onClick={() => void undoAsk()}>Undo</button></>}</span>
    : undone ? <span className="small" role="status">Withdrawn. It’s off their Home.</span> : null);

  /* ---------- the parts of the page ---------- */
  const askedSection = asked.length > 0 && (
    <AskedOfYou key="asked" sectionRef={askedRef} goal={goal} items={asked} open={openAsk} focus={focusAsk} onOpen={(id) => { setOpenAsk(id); setFocusAsk(true); }} onDone={done} />
  );
  const contextLine = (postedText || since || firstVisit) && !review && (
    <p key="context" className={'context-line' + (postedText ? ' posted' : '')} role={postedText ? 'status' : undefined}>
      {postedText ? <>
        {postedText.text.replace(/ · \d+ weeks on time$/, '')}
        {postedText.streak >= 2 && <> · <CountNumber value={postedText.streak} from={postedText.streak - 1} format={(n) => `${Math.round(n)} weeks on time`} className="streak-count" duration={600} /></>}
      </> : since ? <>{since.text}{(since.checkIns + since.comments + since.changes) > 0 && <> <a className="linkish" href="#activity">See them</a></>}</> : firstLook(goal)}
    </p>
  );
 // How it's measured, asked for where the owner sees it, not only in the folded About section (setup review, 8 Nov).
  const measurePrompt = !review && !stopped && canEdit && goal.kind !== 'milestone' && !goal.definition?.trim() && (
    <p key="measure" className="context-line measure-prompt" data-part="How it’s measured">
      How it’s measured isn’t described yet, so others can’t tell exactly what’s counted. <Link className="linkish" to={`/goals/${goal.id}/edit?part=definition`}>Describe how it’s measured</Link>
    </p>
  );
  const chart = <GoalChart key="chart" goal={goal} status={status} landed={posted} hit={hit} card={card} />;
  const whySection = !review && <WhySection key="why" goal={goal} why={why} />;
  const doing = !review && <DoingSection key="doing" goal={goal} withActions={!wide} asked={asked} />;
  const actionsSide = !review && wide && <ActionsSection key="actions" goal={goal} asked={asked} />;
  const talked = <TalkedSection key="talked" goal={goal} />;
  const feeding = !review && children.length > 0 && <FeedsSection key="feeds" feeding={children} feeds={feeds} />;
  const quarters = !review && isYear(cycle) && <QuarterStrip key="quarters" goal={goal} />;
  const activity = !review && <ActivitySection key="activity" goal={goal} focusComposer={tabComments && !alias} />;
  // Modules' sections (the goal.sections place), before Activity.
  const modules = !review && <Place key="modules" name="goal.sections" goal={goal} />;
  const about = !review && <AboutSection key="about" goal={goal} detailsRef={aboutRef} open={aboutOpen ?? firstVisit} onToggle={setAboutOpen} />;
  const evidence = review && (
    <section key="evidence" className="block review-evidence" aria-labelledby="g-chart" data-part="Chart and recent check-ins"><h2 className="block-title" id="g-chart">Chart and recent check-ins</h2>{chart}<CheckInRows goal={goal} limit={4} /></section>
  );

  const main = review ? [evidence] : [chart, whySection, doing, feeding, quarters, modules, activity, about];
  const side = review ? [askedSection, talked] : [askedSection, contextLine, measurePrompt, actionsSide, talked];
  // On a phone the chart comes first in the first screen: a first look's line on what the number measures waits under it.
  const firstOnly = !postedText && !since;
  const phone = review ? [askedSection, evidence, talked] : [askedSection, firstOnly ? null : contextLine, chart, firstOnly ? contextLine : null, measurePrompt, whySection, doing, talked, feeding, quarters, modules, activity, about];

  return (
    <div className={'page goal-page' + (review ? ' in-review' : '')} ref={page} data-part="Goal page">
      <ReviewBar goalId={goal.id} />
      <GoalBack />
      <GoalBar goal={goal} status={status} figures={figures} card={card} actions={actions} askedLine={askedLine}
        statusMoved={statusMoved} hit={hit} countFrom={effectOn('count') ? own.filter((c) => c.value != null).at(-2)?.value ?? null : null} />

      {published && (
        <section className="first-checkin" aria-label="First check-in">
          <span className="strong">“{goal.title}” is published.</span>
          {week < 1
            ? <span>Its first check-in is due in week 1, when the year starts.</span>
            : isOwner
              ? <><span>Post its first check-in now, so everyone can see where it stands from today.</span>
                  <span className="row"><Link className="btn primary" to={'/check-in/' + goal.id}>Post the first check-in</Link><button type="button" className="btn ghost" onClick={() => setParams({}, { replace: true })}>Later</button></span></>
              : <><span>{ownerFirst} posts its check-ins. Ask for the first one now?</span>
                  <span className="row"><button type="button" className="btn" disabled={asking} onClick={() => void askForUpdate().then(() => { app.toast(`Asked ${ownerFirst}. It’s on their Home until they check in.`); setParams({}, { replace: true }); })}>Ask {ownerFirst}</button><button type="button" className="btn ghost" onClick={() => setParams({}, { replace: true })}>Later</button></span></>}
        </section>
      )}

      {wide
        ? <div className="goal-grid split"><div className="split-a goal-main">{main}</div><aside className="split-side goal-side" aria-label="For you">{side}</aside></div>
        : <div className="goal-col">{phone}</div>}
      {review && <ReviewCallBar goal={goal} />}
      {removing && <RemoveGoalSheet goal={goal} onClose={() => setRemoving(false)} />}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------------- the bar */

/**
 * The summary bar: a two-second read. The goal and its owner; its status and the number; then the scorecard, four
 * labelled cells that answer how it stands against plan, what changed since last week, what's left to the target and
 * whether it will get there (domain/scorecard). The reason and the goals feeding it have their own sections below, said
 * once there. Once the bar scrolls away it shrinks to one line at the top, a solid panel with a rule under it: status,
 * number and the gap to plan, and the "…" menu (the same element, not a copy). On a phone it is the page's header, with
 * the app header's Demo tag and person button at its right.
 */
function GoalBar({ goal, status, figures, card, actions, askedLine, statusMoved, hit, countFrom }: {
  goal: Goal; status: DisplayStatus; figures: ReturnType<typeof barFigures>; card: Scorecard;
  actions: ReactNode; askedLine: ReactNode; statusMoved: boolean; hit: boolean; countFrom: number | null;
}) {
  const app = useApp();
  const owner = app.person(goal.ownerId);
  const team = app.team(goal.teamId);
  const me = useShellTop();
  const slot = useRef<HTMLDivElement>(null);
  const c = useCompact(slot);
  // When it was last updated: the latest check-in's date, beside its week.
  const updated = updatedLine(goal, app.snapshot);
  const num = figures.nowValue != null && goal.kind !== 'milestone'
    ? <CountNumber value={figures.nowValue} from={countFrom} format={(n) => fmt(n, goal)} memo={'goal:' + goal.id} duration={storyOn() ? STORY_MS * storyPace() : MOTION_MS} onLanded={storyOn() ? landedMoment : undefined} land={storyOn()} />
    : figures.now;
  return (
    <div className="goal-bar-slot" ref={slot} style={c.on ? { height: c.height } : undefined}>
      <header className={'goal-bar' + (c.on ? ' compact' : '') + (hit ? ' hit' : '') + (goal.stoppedAt ? ' stopped' : '')} data-part="Summary bar" data-tone={goal.stoppedAt ? 'stopped' : status} style={c.on ? { position: 'fixed', top: c.top, left: c.left, width: c.width } : undefined} aria-label="This goal">
        <div className="bar-1">
          <h1 className="bar-title">{goal.title}</h1>
          {me && <span className="bar-me">{me}</span>}
        </div>
        <div className="bar-who">
          <Avatar p={owner ?? { name: '?', initials: '?' }} size="sm" /><span>{owner?.name ?? 'No owner'}{team ? `, ${team.name}` : ''}</span>
          <LevelTag level={goal.level} />
          {goal.key && <span className="gkey" title={`This goal’s key: it never changes, and /goals/${goal.key} opens it`}>{goal.key}</span>}
          {updated && <span className="bar-updated hint">{updated}</span>}
        </div>
        <div className="bar-2">
          {goal.stoppedAt ? <LifeMark k="stopped" className="bar-status bar-life" /> : <span className="bar-status-tap" onClick={secretTap}><Chip k={status} className={'bar-status' + (statusMoved ? ' moved' : '')} /></span>}
          <span className="bar-dot" aria-hidden="true">·</span>
          <span className="bar-now">{num}</span>
          {/* Only in the one-line bar: the gap to plan, which the scorecard says in full. */}
          {card.gap && <span className="bar-gap"><span aria-hidden="true">· </span>{card.gap}</span>}
        </div>
        {card.cells.length > 0 && <ScoreGrid cells={card.cells} />}
        {askedLine && <div className="bar-note">{askedLine}</div>}
        {actions && <div className="bar-actions">{actions}</div>}
      </header>
    </div>
  );
}

/** The scorecard: a label, a value and one muted line per cell; two by two on a phone, in a row on a wider screen. */
function ScoreGrid({ cells }: { cells: ScoreCell[] }) {
  return (
    <dl className={'scorecard cells-' + cells.length} aria-label="Scorecard" data-part="Scorecard">
      {cells.map((c) => (
        <div key={c.key} className={'sc-cell sc-' + c.key} data-part={c.label}>
          <dt className="sc-label">{c.label}</dt>
          <dd className={'sc-value tone-' + c.tone}>{c.move && <MoveMark up={c.move === 'up'} />}{c.value}</dd>
          <dd className="sc-sub">{c.sub}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Which way the number moved: a small drawn triangle (the app's own shape, not a glyph). */
const MoveMark = ({ up }: { up: boolean }) => (
  <svg className="sc-move" viewBox="0 0 10 10" aria-hidden="true"><path d={up ? 'M5 1.5 9 8.5H1z' : 'M1 1.5h8L5 8.5z'} fill="currentColor" /></svg>
);

/** A section's heading and one muted line saying what it answers (Lane, 5 Nov: "say what each part is for"). */
function SectionHead({ id, title, purpose, children }: { id?: string; title: string; purpose: ReactNode; children?: ReactNode }) {
  return (
    <div className="section-head">
      <h2 className="block-title" id={id}>{title}</h2>
      <p className="section-purpose">{purpose}</p>
      {children}
    </div>
  );
}

/** Whether the bar has scrolled away, and where its one-line form sits: under anything already stuck to the top. */
function useCompact(slot: RefObject<HTMLDivElement | null>) {
  const [s, setS] = useState({ on: false, top: 0, left: 0, width: 0, height: 0 });
  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const above = () => {
      let y = 0;
      for (const e of document.querySelectorAll<HTMLElement>('.mtop, .goal-page > .reviewbar')) {
        if (!e.getClientRects().length) continue;
        const pos = getComputedStyle(e).position;
        if (pos === 'sticky' || pos === 'fixed') y = Math.max(y, Math.round(e.getBoundingClientRect().bottom));
      }
      return y;
    };
    let full = el.offsetHeight;
    const check = () => {
      const t = above();
      const r = el.getBoundingClientRect();
      const on = r.bottom < t + 4;
      setS((p) => {
        if (!p.on) full = el.offsetHeight;
        const next = { on, top: t, left: Math.round(r.left), width: Math.round(r.width), height: full };
        return p.on === next.on && p.top === next.top && p.left === next.left && p.width === next.width && p.height === next.height ? p : next;
      });
    };
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [slot]);
  return s;
}

/** Share: a PNG of the summary bar and a small chart, with the goal's link; or the link alone. */
function useShare(goal: Goal, now: string, against: string[], why: string, status: DisplayStatus) {
  const app = useApp();
  const link = () => `${window.location.origin}${app.mode === 'demo' ? '/demo' : ''}/goals/${goal.key ?? goal.id}`;
  const copyText = async (text: string) => { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } };
  return {
    link: async () => { const ok = await copyText(link()); app.toast(ok ? 'Link copied' : `Couldn’t copy. The link is ${link()}`, ok ? undefined : 'error'); },
    image: async () => {
      const owner = app.person(goal.ownerId);
      const series = valueSeries(app.checkInsOf(goal));
      const a = assessPosted(goal, app.cycle, app.snapshot.checkIns, app.week);
      const card: ShareCard = {
        workspace: app.ws.name.replace(/^Example:\s*/, ''), title: goal.title, owner: owner?.name ?? '',
        meta: [goal.level !== 'team' ? LEVEL_LABEL[goal.level] : '', goal.key ?? ''].filter(Boolean).join(' · '),
        status, statusWord: LABEL[status], now, against: against.join(' · '), why,
        when: `Week ${app.week} · ${app.today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        link: link(),
        chart: goal.kind === 'metric' && a.kind === 'metric' ? { goal: goal as MetricGoal, weeks: app.cycle.weeks, week: app.week, series, projection: projects(goal, status) ? a.projection : null } : null,
      };
      try {
        const png = await shareCardPng(card);
        const url = link();
        let copied = false;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const CI = (window as any).ClipboardItem as typeof ClipboardItem | undefined;
          if (CI && navigator.clipboard?.write) {
            await navigator.clipboard.write([new CI({ 'image/png': png, 'text/plain': new Blob([url], { type: 'text/plain' }) })]);
            copied = true;
          }
        } catch { copied = false; }
        if (copied) app.toast('Copied an image of this goal, with its link');
        else {
          await saveFile({ workspace: app.ws.name, what: 'goal', scope: goal.key ?? goal.title, date: app.today }, { kind: 'png', blob: png });
          app.toast(await copyText(url) ? 'Saved an image of this goal, and copied its link' : `Saved an image of this goal. Its link is ${url}`);
        }
      } catch (e) {
        app.toast('Couldn’t make the image: ' + (e instanceof Error ? e.message : String(e)), 'error');
      }
    },
  };
}

/* ---------------------------------------------------------------------------------------------------- asked of you */

function AskedOfYou({ goal, items, open, focus, onOpen, onDone, sectionRef }: { goal: Goal; items: AskedItem[]; open: string | null; focus: boolean; onOpen: (id: string) => void; onDone: (id: string) => void; sectionRef: RefObject<HTMLElement | null> }) {
  const app = useApp();
  const askOf = (id: string) => asksOf(app.snapshot).find((r) => r.id === id);
  const what = (x: AskedItem) => x.kind === 'decision' ? `${ASK_KIND.decision.label}, from ${x.fromFirst}`
    : x.kind === 'question' ? `Question from ${x.fromFirst}${x.where ? ` in ${x.where}` : ''}`
    : x.kind === 'update' ? `${x.fromFirst} asked for an update`
    : x.kind === 'action' ? `Action${x.where ? ` from ${x.where}` : ` from ${x.fromFirst}`}${x.due ? `, due week ${x.due}` : ''}`
    : `${x.fromFirst} commented`;
  return (
    <section className="block asked" aria-labelledby="g-asked" ref={sectionRef} data-part="Asks">
      <SectionHead id="g-asked" title="Asked of you" purpose="Waiting on you: answer it here." />
      <ul className="asked-list">
        {items.map((x) => {
          const isOpen = open === x.id;
          const r = x.kind !== 'comment' ? askOf(x.id) : undefined;
          return (
            <li key={x.id} className={'asked-item' + (isOpen ? ' is-open' : '')}>
              <section aria-label={what(x)}>
                <span className="field-label">{what(x)} <span className="hint">· {timeAgo(x.at, app.today)}</span></span>
                <p className="asked-text">{cap(x.text)}</p>
                {/* One Respond panel for every kind of ask; a comment gets a reply box, since it asks nothing. */}
                {isOpen
                  ? (r ? <section aria-label="Respond"><RespondForm ask={r} focus={focus} onClose={() => onDone(x.id)} /></section>
                    : <ReplyBox goal={goal} item={x} focus={focus} onDone={() => onDone(x.id)} />)
                  : <button type="button" className="btn sm" onClick={() => onOpen(x.id)}>{RESPOND_LABEL[x.kind]}</button>}
              </section>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const RESPOND_LABEL: Record<AskedItem['kind'], string> = { decision: 'Respond', question: 'Answer', update: 'Respond', action: 'Respond', comment: 'Reply' };

/** Replying to a comment, in place: a comment of your own. It answers nothing, because a comment asks nothing. */
function ReplyBox({ goal, item, focus, onDone }: { goal: Goal; item: AskedItem; focus: boolean; onDone: () => void }) {
  const app = useApp();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!focus) return;
    box.current?.focus({ preventScroll: true });
    // After the page has settled at the top (the shell scrolls a new page there once it's drawn).
    const t = setTimeout(() => form.current?.scrollIntoView?.({ block: 'nearest' }), 80);
    return () => clearTimeout(t);
  }, [focus]);
  const post = async () => {
    setTried(true);
    if (text.trim().length < 2 || busy) return;
    setBusy(true);
    try {
      await app.addNote(goal, text);
      app.toast(`Reply posted for ${item.fromFirst}`);
      onDone();
    } catch { setBusy(false); }
  };
  return (
    <form ref={form} className="stack reply-form" style={{ gap: 'var(--s2)' }} onSubmit={(e) => { e.preventDefault(); void post(); }} noValidate>
      <label className="field"><span className="field-label">Your reply</span>
        <textarea ref={box} className={'input' + (tried && text.trim().length < 2 ? ' invalid' : '')} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <span className="field-msg" role="alert">{tried && text.trim().length < 2 && <><Icon name="alert" size={16} />Write a few words.</>}</span>
      </label>
      <div className="sheet-foot respond-foot">
        <button type="button" className="linkish small" onClick={onDone}>Not now</button>
        <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Posting…' : 'Post your reply'}</button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------------------------------------------- the chart */

function GoalChart({ goal, status, landed, hit, card }: { goal: Goal; status: DisplayStatus; landed: boolean; hit: boolean; card: Scorecard }) {
  const stale = status === 'stale';
  const app = useApp();
  const { cycle, week } = app;
  const own = app.checkInsOf(goal);
  const series = valueSeries(own);
  const a = assessPosted(goal, cycle, app.snapshot.checkIns, week);
  const latest = own[own.length - 1] ?? null;
  const ptg = latest?.pathToGreen ?? null;
  // The chart is drawn in its final state at once; it draws itself in only when the story is switched on (Motion lab).
  const draw = !reducedMotion() && storyOn();
  // Drag along the chart to read any week: its number, the plan that week, and the reason given.
  const scrub: Scrub = {
    read: (w) => {
      const c = [...own].reverse().find((x) => x.week === w);
      const plan = planFor(goal, cycle, w);
      const parts = [`Week ${w} (${weekDates(cycle, w)})`];
      if (c && c.value != null && goal.kind !== 'milestone') parts.push(fmt(c.value, goal));
      else if (!c) parts.push('no check-in');
      if (plan != null && goal.kind === 'metric') parts.push(`plan ${fmt(plan, goal)}`);
      if (c) parts.push(LABEL[c.status].toLowerCase());
      return parts.join(' · ') + (c && c.why && c.why !== NO_REASON ? `. ${c.cause ? causeLabel(c.cause) + ': ' : ''}${c.why}` : '');
    },
  };
  // Under the chart, one small footnote: where the likely end comes from. The numbers are the scorecard's, marked on the chart.
  const projected = card.cells.some((c) => c.key === 'hit' && c.likelihood);
  // A stopped goal makes no forecast, and says nothing about one.
  const ahead = projects(goal, status);
  const foot = goal.stoppedAt || status === 'done' ? null : stale ? 'No projection: the last check-in is too old to project from.'
    : projected ? (goal.kind === 'metric' ? 'Likely end projected from the last eight weeks, not the owner’s date.' : 'Likely end projected from the last eight weeks.')
    : null;
  const caption = foot ? <span className="chart-say chart-foot">{foot}</span> : null;
  return (
    <section className="block goal-chart-block" aria-label="Chart" data-part="Chart">
      {goal.kind === 'metric' && a.kind === 'metric' && (
        <figure className="card goal-chart" style={{ margin: 0 }}>
          <MetricChart goal={goal} weeks={cycle.weeks} week={week} series={series} forecast={ahead ? a.forecast : null} projection={ahead ? a.projection : null} ptgBy={ahead ? ptg?.byWeek ?? null : null} scrub={scrub} draw={draw} landed={landed && !reducedMotion()} hit={hit} marks={stale ? null : card.marks} />
          {(caption || goal.originalPlan) && <figcaption className="small">{caption}{goal.originalPlan ? <PlanChanges goal={goal} /> : null}</figcaption>}
        </figure>
      )}
      {goal.kind === 'range' && (
        <figure className="card goal-chart" style={{ margin: 0 }}>
          <RangeChart goal={goal} weeks={cycle.weeks} week={week} series={series} scrub={scrub} draw={draw} landed={landed && !reducedMotion()} />
          {caption && <figcaption className="small">{caption}</figcaption>}
        </figure>
      )}
      {a.kind === 'milestone' && <div className="card"><StageList a={a} /></div>}
    </section>
  );
}

/** Under the chart: the latest plan change, and where the target started if it has changed more than once. */
function PlanChanges({ goal }: { goal: MetricGoal }) {
  const history = planHistoryOf(goal);
  const last = history.at(-1);
  if (!last) return null;
  const what = last.plan.target !== goal.plan.target ? `Target changed in week ${last.untilWeek}: ${fmt(last.plan.target, goal)} → ${fmt(goal.plan.target, goal)}.` : `Plan changed in week ${last.untilWeek}.`;
  const first = history.length > 1 ? ` It was first set at ${fmt(history[0]!.plan.target, goal)}, and has changed ${history.length} times.` : '';
  return <span className="muted plan-changes">{what}{first} The original plan is dotted; earlier weeks and closed quarters are judged against the plan of their day.</span>;
}

/* ---------------------------------------------------------------------------------------------------- why */

/**
 * Why: the owner's reason opens it, then whether anyone is on it, where the reason came from and since when, and
 * anything the numbers would otherwise hide, as small tags. The trend is the scorecard's (vs last week), not a tag here.
 * On plan, the same place carries the owner's latest word; gone quiet, how long since anyone said anything.
 */
function WhySection({ goal, why }: { goal: Goal; why: ReturnType<typeof whyLine> }) {
  const app = useApp();
  const att = app.attentionOf(goal);
  const latest = att.status.latest;
  const status = att.status.status;
  const behind = status === 'off' || status === 'risk';
  const stale = status === 'stale';
  // What else flags it, in full: Home and Watching show a flag's reason in two lines on a phone, and the whole of it is
  // here, a tap away. The status's own reason is the text above; a worsening trend is said here only while the status
  // doesn't already say it's behind. A missed or missing path to green is said in full under What's being done.
  const signals = att.flags.filter((f) => !['due', 'off', 'risk', 'stale'].includes(f.kind) && !(f.kind === 'trend' && (behind || stale)));
  const reason = !!latest && !!latest.why && latest.why !== NO_REASON;
  // On plan with nothing said, there's nothing to explain.
  if (!behind && !stale && !reason && !latest?.next && !signals.length) return null;
  const onlySignals = !behind && !stale && !reason && !latest?.next;
  const own = app.checkInsOf(goal);
  let k = own.length - 1;
  while (k > 0 && latest && own[k - 1]!.why === latest.why && own[k - 1]!.cause === latest.cause) k--;
  const runFrom = own[k]?.week;
  const by = latest ? app.person(latest.authorId)?.name.split(' ')[0] ?? 'The owner' : null;
  const when = latest ? (latest.week === app.week ? 'this week’s check-in' : `the week ${latest.week} check-in`) : null;
  const [title, purpose] = stale ? [`Why it has ${lower(STATUS.stale)}`, 'When the owner last said where it stands.']
    : behind ? [`Why it ${STATUS[status].short}`, `The owner’s reason, from ${when ?? 'their check-in'}.`]
    : onlySignals ? ['Worth knowing', 'What the numbers flag that the status doesn’t say.']
    : ['The latest word', when ? `What the owner said in ${when}.` : 'What the owner has said so far.'];
  return (
    <section className="block why-block goal-section" aria-labelledby="g-why" data-part="Why">
      <SectionHead id="g-why" title={title} purpose={purpose} />
      {why.text && (behind || stale || reason || !!latest?.next) && <p className="why-text">{why.text}{stale ? '. Without a newer check-in, the status and any projection can’t be trusted.' : ''}</p>}
      {why.handledText && <p className={'why-handled ' + (why.handled === 'handled' ? 'is-handled' : 'not-handled')}>{cap(why.handledText)}.</p>}
      {behind && latest && reason && (
        <p className="why-by">
          {latest.cause ? <><strong>{causeLabel(latest.cause)}</strong>, from </> : 'From '}{by}’s check-in in week {latest.week}{runFrom != null && runFrom < latest.week ? `; the same reason since week ${runFrom}` : ''}.
        </p>
      )}
      {signals.length > 0 && (
        <ul className="signal-tags" aria-label="Also worth knowing">
          {signals.map((f) => (
            <li key={f.kind} className="signal-tag">
              <WarnMark /><span><span className="signal-label">{f.label}</span>{/path/.test(f.kind) ? null : <>: <span className="signal-detail">{f.detail}</span></>}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------------------------------- being done */

function DoingSection({ goal, withActions, asked }: { goal: Goal; withActions: boolean; asked: AskedItem[] }) {
  const app = useApp();
  const att = app.attentionOf(goal);
  const status = att.status.status;
  const latest = att.status.latest;
  const behind = status === 'off' || status === 'risk';
  const path = behind ? pathCheck(goal, app.snapshot, app.cycle, app.week, latest) : null;
  // What's asked of you is answered in "Asked of you"; it isn't listed twice.
  const items = actionList(goal, app.snapshot, app.week, status, latest, app.cycle).filter((x) => x.kind !== 'path' && !asked.some((a) => a.id === x.id));
  const owner = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'The owner';
  const isOwner = app.viewer.id === goal.ownerId;
  const state = latest?.pathToGreen?.state ?? 'plan';
  // Every goal still running has somewhere to add a next step (backlog GD(1)); on a wide screen it's in the side column.
  if (!behind && !(withActions && (items.length || status !== 'done'))) return null;
  return (
    <section className="block doing goal-section" aria-labelledby="g-doing" data-part="Path to green">
      <SectionHead id="g-doing" title="What’s being done" purpose={behind ? 'The owner’s plan to get back on track, and who’s doing what.' : 'Who’s doing what about it, and how each ask stands.'} />
      {behind && (path ? (
        <div className="ptg">
          <span className="field-label">Path to green</span>
          <p className="ptg-what">{path.what}</p>
          <p className="small ptg-when">
            {path.byWeek != null ? <>Owner’s date: back on plan by week {path.byWeek} ({weekDates(app.cycle, path.byWeek)}){state === 'help' ? ', once the decision or help arrives' : ''}. </> : state === 'investigating' ? 'No date yet: still working out what’s wrong. ' : state === 'help' ? 'No date until the decision or help arrives. ' : state === 'target' ? 'The owner says the target should change. ' : ''}
            {path.check && <span className={path.reaches === false || path.missed ? 'tone-risk' : 'muted'}>{path.check}</span>}
          </p>
        </div>
      ) : <p className="muted ptg-none">{isOwner ? 'You haven’t said how it gets back on plan yet. Say so in your next check-in.' : `${owner} hasn’t said how it gets back on plan yet.`}</p>)}
      {withActions && items.length > 0 && <ActionRows goal={goal} items={items} />}
      {withActions && status !== 'done' && <AddNextStep goal={goal} />}
    </section>
  );
}

/** Add a next step: what, who and by when (ui/NextStepSheet). */
function AddNextStep({ goal }: { goal: Goal }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn add-next-step" onClick={() => setOpen(true)}>Add a next step</button>
      {open && <NextStepSheet goal={goal} onClose={() => setOpen(false)} />}
    </>
  );
}

/** On a wide screen the action list sits in the side column, beside what's being done. */
function ActionsSection({ goal, asked }: { goal: Goal; asked: AskedItem[] }) {
  const app = useApp();
  const att = app.attentionOf(goal);
  const items = actionList(goal, app.snapshot, app.week, att.status.status, att.status.latest, app.cycle).filter((x) => x.kind !== 'path' && !asked.some((a) => a.id === x.id));
  const running = att.status.status !== 'done';
  if (!items.length && !running) return null;
  return (
    <section className="block side-actions" aria-labelledby="g-actions" data-part="Actions">
      <SectionHead id="g-actions" title="Actions" purpose="The asks on this goal: who, by when, and how each stands." />
      {items.length > 0 ? <ActionRows goal={goal} items={items} /> : <p className="muted small">No next step yet.</p>}
      {running && <AddNextStep goal={goal} />}
    </section>
  );
}

/** A request typed after "Elena:" starts in lower case; it leads its own line here. */
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const STATE_WORD = { open: ASK_STATUS.open.label, done: ASK_STATUS.done.label, overdue: ASK_STATUS.overdue.label } as const;

function ActionRows({ goal, items }: { goal: Goal; items: ActionItem[] }) {
  const app = useApp();
  const first = (id: string | null) => (id ? app.person(id)?.name.split(' ')[0] ?? 'someone' : 'anyone');
  const askOf = (id: string) => asksOf(app.snapshot).find((x) => x.id === id);
  // Whoever asked (or an admin) can withdraw an open ask; the owner of a goal waiting on another goal's request can stop waiting.
  const withdraw = (r: Ask) => {
    const linked = r.kind === 'decision' && r.goalIds[0] !== goal.id;
    void app.withdrawRequest(r, goal).then(() => app.toast(linked ? 'No longer waiting on that request' : `${ASK_KIND_LABEL[r.kind]} withdrawn`)).catch(() => { /* the save already said what went wrong */ });
  };
  const done = (r: Ask) => { void app.markActionDone(r).then(() => app.toast('Marked done')).catch(() => { /* the save already said what went wrong */ }); };
  const [changing, setChanging] = useState<Ask | null>(null);
  // An action's words, who and when can be changed here by whoever agreed it, or an admin (actions.editCall).
  const canChange = (r: Ask) => r.kind === 'action' && r.status === 'open' && (r.askedBy === app.viewer.id || app.viewer.admin);
  return (
    <>
    {changing && <NextStepSheet goal={goal} existing={changing} onClose={() => setChanging(null)} />}
    <ul className="action-list">
      {items.map((x) => {
        const r = x.kind !== 'path' ? askOf(x.id) : undefined;
        const open = r?.status === 'open';
        return (
          <li key={x.id} className={'action-row state-' + x.state}>
            <span className={'action-state state-' + x.state}>{x.state === 'done' ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.5 3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : x.state === 'overdue' ? <WarnMark /> : <span className="open-mark" aria-hidden="true" />}{STATE_WORD[x.state]}</span>
            <span className="action-body">
              <span className="action-what">{cap(x.what)}</span>
              <span className="hint">{x.kind !== 'path' ? `${ASK_KIND_LABEL[x.kind]} · ` : ''}{first(x.who)}{x.due != null ? `, by week ${x.due} (${dayText(reviewDate(app.cycle, x.due))})` : ''} · {x.note}</span>
              {r && open && (canMarkDone(r, app.viewer) || canWithdraw(r, app.viewer, goal) || canChange(r)) && (
                <span className="row action-do" style={{ gap: 'var(--s3)' }}>
                  {canMarkDone(r, app.viewer) && <button type="button" className="linkish small" onClick={() => done(r)}>Mark done</button>}
                  {canChange(r) && <button type="button" className="linkish small" onClick={() => setChanging(r)}>Change</button>}
                  {canWithdraw(r, app.viewer, goal) && <button type="button" className="linkish small action-withdraw" onClick={() => withdraw(r)}>{r.kind === 'decision' && r.goalIds[0] !== goal.id ? 'Not waiting on it any more' : 'Withdraw'}</button>}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
    </>
  );
}

/* ---------------------------------------------------------------------------------------------------- last time we talked */

const dayOf = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function TalkedSection({ goal }: { goal: Goal }) {
  const app = useApp();
  const t = lastTalked(goal, app.snapshot, app.cycle, app.week, app.today);
  // A stopped goal isn't in any review now.
  const nextText = t.next && !goal.stoppedAt ? `${t.next.review}, ${t.next.date === app.today.toISOString().slice(0, 10) ? 'today' : `${t.next.weekday} ${dayOf(t.next.date).replace(/^\w+ /, '')}`}` : null;
  const owner = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'the owner';
  return (
    <section className="block talked goal-section" aria-labelledby="g-talked" data-part="Review notes">
      <SectionHead id="g-talked" title="Last time we talked" purpose="What the last review said about it." />
      {t.held ? (
        <>
          <p className="small"><span className="strong">{t.held.review}</span>, {dayOf(t.held.on)} (week {t.held.week}){t.held.said.length ? '' : ': reviewed, nothing added.'}</p>
          {t.held.said.length > 0 && (
            <ul className="talked-list">
              {t.held.said.map((d) => (
                <li key={d.id}>
                  <span className="field-label">{d.kind === 'ask' ? `${d.by} asked ${owner}` : d.kind === 'action' ? `Agreed: ${app.person(d.who ?? '')?.name.split(' ')[0] ?? owner}${d.due ? `, by week ${d.due}` : ''}` : `${d.by} noted`}{d.state && <span className={'action-state state-' + d.state}> · {d.kind === 'ask' ? (d.state === 'done' ? ASK_STATUS.answered.label : 'Not answered yet') : STATE_WORD[d.state]}</span>}</span>
                  <span className="small">{d.note}</span>
                </li>
              ))}
            </ul>
          )}
          {nextText && <p className="hint">Next: {nextText}.</p>}
        </>
      ) : <p className="small">Not discussed yet.{nextText ? ` Next review: ${nextText}.` : ' It isn’t in a review.'}</p>}
    </section>
  );
}

/* ---------------------------------------------------------------------------------------------------- what feeds it */

function FeedsSection({ feeding, feeds }: { feeding: Goal[]; feeds: ReturnType<typeof feedsLine> }) {
  const app = useApp();
  const [all, setAll] = useState(false);
  const onPath = criticalPath(app.snapshot.goals, (g) => app.statusOf(g).status);
  const { pinned, rest } = feedingOrder(feeding, (g) => app.attentionOf(g), onPath);
  const shown = all ? rest : rest.slice(0, pinned ? 2 : 3);
  return (
    <section className="block feeds goal-section" id="feeds" aria-labelledby="g-feeds" data-part="What feeds it">
      <SectionHead id="g-feeds" title="What feeds it" purpose="The goals that move this number, worst first.">
        {/* How they stand, said once: "Directly feeding it (four goals): 2 off track, 1 at risk". */}
        {feeds && (
          <p className="feeds-sum">
            {feeds.head}{feeds.counts.length > 0 ? <>: {feeds.counts.map((x, i) => <span key={x.status} className={'feeds-count tone-' + x.status}>{i ? ', ' : ''}<StatusShape k={x.status} />{x.n} {LABEL[x.status].toLowerCase()}</span>)}</> : ', none behind'}
          </p>
        )}
      </SectionHead>
      <ul className="tree">
        {pinned && <li className="pinned"><GoalRow g={pinned.goal} /><span className="hint pinned-why"><span className="strong">Most likely to make it miss:</span> {pinned.why}</span></li>}
        {shown.map((g) => <li key={g.id}><GoalRow g={g} /></li>)}
      </ul>
      {rest.length > shown.length && <button type="button" className="linkish small show-all" onClick={() => setAll(true)}>Show the other {rest.length - shown.length}</button>}
    </section>
  );
}

/* ---------------------------------------------------------------------------------------------------- quarters */

/** The year by quarter: each quarter's plan for this goal, and whether it was met. The tiles fill in turn. */
function QuarterStrip({ goal }: { goal: Goal }) {
  const app = useApp();
  const now = quarterOf(app.cycle, app.week).n;
  const rs = quarterResults(goal, app.cycle, app.snapshot.checkIns, app.week);
  if (rs.every((r) => r.kind === 'none')) return null;
  return (
    <section className="block goal-section" aria-labelledby="g-quarters" data-part="Quarters">
      <SectionHead id="g-quarters" title="This year by quarter" purpose="Whether each quarter met its plan." />
      <ol className="quarters">
        {rs.map((r) => (
          <li key={r.quarter.n} className={'q-' + r.kind + (r.quarter.n === now ? ' q-now' : '')}>
            <span className="q-head"><span className="strong">{r.quarter.label} <span className="hint nowrap">{r.quarter.months}</span></span>
              <span className="q-result"><QuarterMark kind={r.kind} done={r.quarter.n === now ? (app.week - r.quarter.from + 1) / (r.quarter.to - r.quarter.from + 1) : 0} />{r.kind === 'met' || r.kind === 'missed' ? QUARTER[r.kind].label : r.kind === 'open' ? (r.quarter.n === now ? QUARTER.open.label : 'To come') : 'None due'}</span></span>
            {r.kind !== 'none' ? <span className="small">{quarterWords(r.text)}</span> : r.doneWeek != null && <span className="small">{STATUS.done.label} in week {r.doneWeek}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------------------------------------------------------------------------------------------------- activity */

const FILTERS: [StreamFilter, string][] = [['all', 'All'], ['checkins', 'Check-ins'], ['comments', 'Comments'], ['changes', 'Changes']];

function ActivitySection({ goal, focusComposer }: { goal: Goal; focusComposer: boolean }) {
  const app = useApp();
  const [filter, setFilter] = useState<StreamFilter>('all');
  const [all, setAll] = useState(false);
  const stream = activityStream(goal, app.snapshot).filter(streamMatches(filter));
  const shown = all ? stream : stream.slice(0, 8);
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => { if (focusComposer) { ref.current?.scrollIntoView({ block: 'start' }); document.getElementById('note-' + goal.id)?.focus({ preventScroll: true }); } }, [focusComposer, goal.id]);
  return (
    <section className="block activity goal-section" id="activity" aria-labelledby="g-activity" ref={ref} data-part="Activity">
      <SectionHead id="g-activity" title="Activity" purpose="Check-ins, comments and changes, newest first." />
      <NoteComposer goal={goal} />
      <div className="seg activity-filter" role="group" aria-label="Show">
        {FILTERS.map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => { setFilter(k); setAll(false); }}>{l}</button>)}
      </div>
      {shown.length ? (
        <ol className="stream">
          {shown.map((x) => <StreamRow key={x.kind === 'checkin' ? x.checkIn.id : x.kind === 'checkins' ? 'g-' + x.checkIns[0]!.id : x.change.id} goal={goal} x={x} />)}
        </ol>
      ) : <p className="small muted">Nothing here yet.</p>}
      {stream.length > shown.length && <button type="button" className="linkish small show-all" onClick={() => setAll(true)}>Show all {stream.length}</button>}
    </section>
  );
}

function StreamRow({ goal, x }: { goal: Goal; x: StreamItem }) {
  const [open, setOpen] = useState(false);
  if (x.kind === 'comment') return <ChangeItem c={x.change} manage />;
  if (x.kind === 'change') return <ChangeItem c={x.change} />;
  if (x.kind === 'checkin') return <li className="stream-ci"><ol className="cilist ci-open"><CheckInRow goal={goal} c={x.checkIn} sameAs={x.sameAs} sameAsWhere={x.sameAsWhere} /></ol></li>;
  return (
    <li className="stream-group">
      <button type="button" className="group-row" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="strong">Weeks {x.from}–{x.to}</span>
        <span className="small group-why">{x.sameAs != null ? <span className="muted">{sameReasonText(x.sameAs, x.sameAsWhere)}</span> : x.why}</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} className="muted ci-chev" />
      </button>
      {open && <ol className="cilist ci-open">{x.checkIns.map((c) => <CheckInRow key={c.id} goal={goal} c={c} quiet />)}</ol>}
    </li>
  );
}

/**
 * A comment: why something changed, anything worth knowing that isn't a check-in. Anyone can comment; it's logged and asks
 * nothing of anyone. Someone who needs the owner to respond asks a question instead: the same words, as an ask that stays
 * open on the owner's Home until they answer it (one way to ask).
 */
function NoteComposer({ goal }: { goal: Goal }) {
  const app = useApp();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const isOwner = app.viewer.id === goal.ownerId;
  const ownerFirst = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'the owner';
  const post = async (as: 'comment' | 'question') => {
    if (text.trim().length < 2 || saving) return;
    setSaving(true);
    try {
      if (as === 'question') { await app.askQuestion(goal, text); app.toast(`Asked ${ownerFirst}. It’s open on their Home until they answer.`); }
      else { await app.addNote(goal, text); app.toast('Comment posted'); }
      setText('');
    } catch { /* the save already said what went wrong */ } finally {
      setSaving(false);
    }
  };
  return (
    <form className="note-compose" onSubmit={(e) => { e.preventDefault(); void post('comment'); }}>
      <label className="field"><span className="sr">Add a comment</span>
        <textarea id={'note-' + goal.id} className="input" rows={text ? 2 : 1} value={text} onChange={(e) => setText(e.target.value)} placeholder={isOwner ? 'Say why something changed' : 'Add a comment'} aria-label="Add a comment" />
      </label>
      {text.trim() && (
        <span className="row note-compose-actions" style={{ gap: 'var(--s2)' }}>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Posting…' : 'Post comment'}</button>
          {!isOwner && <button className="btn ghost" type="button" disabled={saving} onClick={() => void post('question')} title={`Ask ${ownerFirst}: it stays open on their Home until they answer`}>Ask as a question</button>}
        </span>
      )}
    </form>
  );
}

/** One check-in as a row (week, number, the call, the reason) that opens to the whole check-in. `quiet` leaves the
 *  reason out, inside a group that says it once; `sameAs` points to the newer week that already said it. */
function CheckInRow({ goal, c, quiet, sameAs, sameAsWhere }: { goal: Goal; c: CheckIn; quiet?: boolean; sameAs?: number; sameAsWhere?: 'above' | 'below' }) {
  const [isOpen, setOpen] = useState(false);
  return (
    <li className={isOpen ? 'is-open' : undefined}>
      <button type="button" className="ci-row" aria-expanded={isOpen} aria-controls={'ci-' + c.id} onClick={() => setOpen(!isOpen)}>
        <span className="strong ci-week"><span className="nowrap">Week {c.week}</span></span>
        <span className="ci-value num">{goal.kind === 'milestone' ? `${assessMilestone(goal, c.week, c.stages).doneCount} of ${goal.stages.length} stages` : c.value == null ? '—' : fmt(c.value, goal)}</span>
        <Chip k={c.status} />
        <span className="ci-tail">{quiet ? <span className="small muted cilist-why">Same reason</span> : sameAs != null ? <span className="small muted cilist-why">{sameReasonText(sameAs, sameAsWhere)}</span> : c.why && c.why !== NO_REASON ? <span className="small cilist-why">{c.why}</span> : <span className="small muted cilist-why">{GAP['on-plan'].label}</span>}<Icon name={isOpen ? 'chevron-up' : 'chevron-down'} className="muted ci-chev" /></span>
      </button>
      {isOpen && <CheckInFull goal={goal} c={c} id={'ci-' + c.id} />}
    </li>
  );
}

/** The goal's latest check-ins, newest first, each opening to the whole check-in: open in a review. */
function CheckInRows({ goal, limit }: { goal: Goal; limit: number }) {
  const app = useApp();
  const own = app.checkInsOf(goal);
  const [all, setAll] = useState(false);
  if (!own.length) return <p className="small muted">No check-ins yet.</p>;
  return (
    <>
      <ol className="cilist ci-open">{[...own].reverse().slice(0, all ? undefined : limit).map((c, i, list) => {
        // A reason the newer week already gave is pointed to, not said again.
        const newer = c.why && c.why !== NO_REASON ? list.slice(0, i).reverse().find((x) => x.why === c.why) : undefined;
        return <CheckInRow key={c.id} goal={goal} c={c} sameAs={newer ? list.slice(0, i).find((x) => x.why === c.why)!.week : undefined} />;
      })}</ol>
      {own.length > limit && !all && <button type="button" className="linkish small show-all" onClick={() => setAll(true)}>Show all {own.length} check-ins</button>}
    </>
  );
}

/** One check-in in full: the call and what the rules calculated, the cause and why, the path to green, needs, next step, who and when. */
function CheckInFull({ goal, c, id }: { goal: Goal; c: CheckIn; id: string }) {
  const app = useApp();
  const who = app.person(c.authorId);
  const ptg = c.pathToGreen;
  const m = goal.kind === 'milestone' ? assessMilestone(goal, c.week, c.stages) : null;
  return (
    <dl className="ci-full" id={id}>
      <dt>Call</dt>
      <dd>{c.status === c.calculated ? <>{LABEL[c.status]}, as the numbers say</> : <>Called {LABEL[c.status].toLowerCase()}; the numbers said {LABEL[c.calculated].toLowerCase()}</>}</dd>
      {m && <><dt>Stages</dt><dd><ul className="ci-stages">{m.stages.map((s) => <li key={s.id}>{s.name}: {s.kind === 'done' ? `done week ${s.doneWeek}` : `due week ${s.dueWeek}${s.expectedWeek > s.dueWeek ? `, expected week ${s.expectedWeek}` : ''}`}</li>)}</ul></dd></>}
      {c.cause && <><dt>Cause</dt><dd>{causeLabel(c.cause)}</dd></>}
      {c.why && <><dt>Why</dt><dd>{c.why}</dd></>}
      {c.greenerWhy && <><dt>Why greener</dt><dd>{c.greenerWhy}</dd></>}
      {ptg && <><dt>Path to green</dt><dd>{ptg.what}{ptg.byWeek != null ? <span className="muted"> · back on plan by week {ptg.byWeek}</span> : ptg.state === 'investigating' ? <span className="muted"> · still investigating</span> : null}</dd></>}
      {ptg?.needs && <><dt>Needs</dt><dd>{ptg.needs}</dd></>}
      {c.proposeTarget != null && goal.kind !== 'milestone' && <><dt>Proposed target</dt><dd>{fmt(c.proposeTarget, goal)}</dd></>}
      {c.next && <><dt>Next step</dt><dd>{c.next}</dd></>}
      <dt>Checked in</dt>
      <dd>{who?.name ?? 'Someone'}, {whenText(c.postedAt, app.today)}{c.backfilled ? ' (loaded later)' : ''}</dd>
      {!goal.stoppedAt && canDeleteCheckIn(app.snapshot, goal, c, app.viewer) && <dd className="ci-remove"><DeleteCheckIn c={c} /></dd>}
    </dl>
  );
}

/* ---------------------------------------------------------------------------------------------------- about */

/** About this goal: open on a first visit, folded after. The definition and changing the goal live here, one step away. */
function AboutSection({ goal, open, onToggle, detailsRef }: { goal: Goal; open: boolean; onToggle: (open: boolean) => void; detailsRef: RefObject<HTMLDetailsElement | null> }) {
  const app = useApp();
  const { cycle } = app;
  const parent = goal.parentId ? app.goal(goal.parentId) : undefined;
  const team = app.team(goal.teamId);
  const fed = app.snapshot.goals.filter((g) => g.parentId === goal.id).length;
  const canEdit = goal.ownerId === app.viewer.id || app.viewer.admin;
  const watchers = app.snapshot.people.filter((p) => p.id !== goal.ownerId && goalsIn(watchScope(p.id, app.snapshot.watches), app.snapshot.goals).some((g) => g.id === goal.id));
  const history = goal.kind === 'metric' ? planHistoryOf(goal) : [];
  const own = app.checkInsOf(goal);
  return (
    <details className="block about goal-section" data-part="About this goal" ref={detailsRef} open={open} onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}>
      <summary><span className="section-head"><h2 className="block-title">About this goal</h2><span className="section-purpose">How it’s measured, its plan week by week, and who watches it.</span></span></summary>
      <dl className="details">
        {goal.kind !== 'milestone' && <><dt>How it’s measured</dt><dd>{goal.definition || <span className="muted">Not described yet.</span>}{goal.source ? <span className="muted"> Source: {goal.source}.</span> : null}</dd></>}
        {goal.kind === 'metric' && <><dt>Measure</dt><dd>{fmt(goal.plan.start, goal)} → {fmt(goal.plan.target, goal)} by week {goal.plan.endWeek ?? cycle.weeks} ({weekDates(cycle, goal.plan.endWeek ?? cycle.weeks)}){(goal.plan.endWeek ?? 0) > cycle.weeks ? ', past this cycle' : ''}, {directionLabel(goal)}</dd></>}
        {goal.kind === 'range' && <><dt>Measure</dt><dd>{directionLabel(goal)}, warning margin {fmt(goal.range.margin, goal)}{goal.source ? '' : ''}</dd></>}
        {goal.kind === 'milestone' && <><dt>Stages</dt><dd>{goal.stages.map((s) => `${s.name} (week ${s.dueWeek})`).join(', ')}{goal.source ? <span className="muted">. Source: {goal.source}.</span> : null}</dd></>}
        <dt>Level</dt><dd>{LEVEL_LABEL[goal.level]}{goal.level !== 'team' ? ', reported at major reviews' : ''}</dd>
        <dt>Team</dt><dd>{team?.name ?? '—'}</dd>
        <dt>Feeds into</dt><dd>{parent ? <><Link className="linkish" to={'/goals/' + parent.id}>{parent.title}</Link>{goal.whyHelps ? <span className="muted">. {goal.whyHelps}</span> : null}</> : fed ? 'Nothing: it sits at the top of its tree' : 'Nothing yet (not linked)'}</dd>
        {fed > 0 && <><dt>Fed by</dt><dd><Link className="linkish" to={`/goals?feeds=${goal.id}`}>{fed === 1 ? '1 goal' : `${fed} goals`}</Link></dd></>}
        <dt>Watched by</dt><dd>{watchers.length ? watchers.map((p) => p.name).join(', ') : 'Nobody yet'}</dd>
        {goal.key && <><dt>Key</dt><dd><span className="gkey-plain">{goal.key}</span> <span className="muted">· it never changes, and /goals/{goal.key} opens it</span></dd></>}
        {history.length > 0 && goal.kind === 'metric' && <><dt>Plan changes</dt><dd><ul className="plan-history">{history.map((v, i) => <li key={i}>Until week {v.untilWeek}: {fmt(v.plan.start, goal)} → {fmt(v.plan.target, goal)}</li>)}<li>Since: {fmt(goal.plan.start, goal)} → {fmt(goal.plan.target, goal)}</li></ul></dd></>}
      </dl>
      {goal.kind === 'metric' && <PlanTable plan={goal.plan} unit={goal} actuals={own} label="Plan and actual by week" />}
      <p className="small">How the status is worked out: <Link className="linkish" to="/help/status">{WORD_OF.on}, {lower(STATUS.risk)} and {lower(STATUS.off)}, explained</Link>.</p>
      {canEdit && (
        <div className="about-change" id="change-goal">
          <h3 className="field-label">Change this goal</h3>
          <p className="hint">Each change asks why, and the reason goes in the activity for everyone watching.</p>
          <ul className="change-list">
            <li><Link className="linkish" to={`/goals/${goal.id}/edit?part=definition`}>Improve the definition</Link></li>
            <li><Link className="linkish" to={`/goals/${goal.id}/edit?part=plan`}>Change the {goal.kind === 'metric' ? 'plan or target' : goal.kind === 'range' ? 'limit' : 'stages'}</Link></li>
            <li><Link className="linkish" to={`/goals/${goal.id}/edit?part=owner`}>Change the owner or level</Link></li>
          </ul>
        </div>
      )}
    </details>
  );
}
