/* A goal's page: the app's flagship (approved by Lane, 5 Nov). It answers, in order: what is this goal and who owns
   it; how is it doing; if badly, why; what is being done and how those actions are going; where it's heading; what has
   happened, and what was said the last time it was discussed. Each fact has one home: the summary bar carries status,
   number and gap; the chart carries direction and the projection; Why carries the evidence; and so on down.
   The words come from the domain (domain/goalPage and the modules it asks); this file lays them out. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { useSeen } from '../app/goalSeen';
import { saveFile } from '../app/files';
import { causeLabel } from '../domain/checkin';
import { directionLabel, fmt, LEVEL_LABEL } from '../domain/format';
import { planHistoryOf, valueSeries, weekDates } from '../domain/plan';
import { assessMilestone, assessPosted, LABEL } from '../domain/status';
import { summaryFacts } from '../domain/summaryFacts';
import { forecastText } from '../domain/tree';
import { criticalPath } from '../domain/map';
import { isYear, quarterOf, quarterResults } from '../domain/year';
import { ASK_KIND_LABEL, asksOf, canMarkDone, canWithdraw, openUpdateAsk } from '../domain/asks';
import { goalsIn, watchOf, watchScope } from '../domain/review';
import {
  actionList, activityStream, askedOf, barFigures, feedingOrder, feedsLine, firstLook, lastTalked, pathCheck, planFor, postedLine,
  primaryAction, sinceLooked, streamMatches, whyLine, type ActionItem, type AskedItem, type StreamFilter, type StreamItem,
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
import { reducedMotion } from '../ui/motion';
import { shareCardPng, type ShareCard } from '../ui/shareCard';

export function GoalScreen() {
  const app = useApp();
  const { goalId } = useParams();
  const goal = goalId ? app.goal(goalId) : undefined;
  if (!goal) return <div className="page narrow"><Empty title="This goal doesn’t exist"><Link className="btn sm" to="/goals">All goals</Link></Empty></div>;
  return <GoalView key={goal.id + ':' + app.viewer.id} goal={goal} />;
}

/** Where the page's two columns start: as the shared side-column layout does (styles.css, `.split`). */
const WIDE = 960;

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
  const why = whyLine(goal, app.snapshot, att);
  const feeds = feedsLine(children, (g) => app.statusOf(g).status);
  const a = assessPosted(goal, cycle, app.snapshot.checkIns, week);
  const hit = goal.kind === 'metric' && a.kind === 'metric' && a.actual != null && !stale && (a.actual - goal.plan.target) * (Math.sign(goal.plan.target - goal.plan.start) || 1) >= 0;

  // The context line: just posted, or what's new since the last look, or (first time) what the number is.
  const postedText = posted ? postedLine(goal, app.snapshot, cycle, week) : null;
  const since = !posted && seen ? sinceLooked(goal, app.snapshot, seen, status, app.today) : null;
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
        ...(isOwner && week > 0 && primary.kind !== 'check-in' ? [{ label: due ? `Check in for week ${week}` : 'Check in again', to: '/check-in/' + goal.id }] : []),
        ...(canEdit ? [{ label: 'Change this goal', onClick: changeThis }] : []),
      ]} />
  );
  const showPrimary = !review && !published && !(primary.targetId && openAsk === primary.targetId);
  const mainAction: ReactNode = !showPrimary || !primary.kind ? null
    : primary.kind === 'check-in' ? <Link className="btn primary" to={'/check-in/' + goal.id}>{primary.label}</Link>
    : primary.kind === 'watch' ? <WatchButton goal={goal} primary />
    : primary.kind === 'ask-update' ? <button type="button" className="btn primary" disabled={asking} onClick={() => void askForUpdate()}>{primary.label}</button>
    : <button type="button" className="btn primary" onClick={() => openAskedItem(primary.targetId)}>{primary.label}</button>;
  const actions = review ? null : (
    <>
      {mainAction}
      {!isOwner && primary.kind !== 'watch' && <WatchButton goal={goal} />}
      {menu}
    </>
  );
  const askedLine = !isOwner && stale && !review && (updateAsk
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
        {postedText.streak >= 2 && <> · <CountNumber value={postedText.streak} from={postedText.streak - 1} format={(n) => `${Math.round(n)} weeks on time`} className="streak-count" /></>}
      </> : since ? <>{since.text}{(since.checkIns + since.comments + since.changes) > 0 && <> <a className="linkish" href="#activity">See them</a></>}</> : firstLook(goal)}
    </p>
  );
  const chart = <GoalChart key="chart" goal={goal} stale={stale} landed={posted} hit={hit} />;
  const whySection = !review && <WhySection key="why" goal={goal} />;
  const doing = !review && <DoingSection key="doing" goal={goal} withActions={!wide} asked={asked} />;
  const actionsSide = !review && wide && <ActionsSection key="actions" goal={goal} asked={asked} />;
  const talked = <TalkedSection key="talked" goal={goal} />;
  const feeding = !review && children.length > 0 && <FeedsSection key="feeds" feeding={children} />;
  const quarters = !review && isYear(cycle) && <QuarterStrip key="quarters" goal={goal} />;
  const activity = !review && <ActivitySection key="activity" goal={goal} focusComposer={tabComments && !alias} />;
  const about = !review && <AboutSection key="about" goal={goal} detailsRef={aboutRef} open={aboutOpen ?? firstVisit} onToggle={setAboutOpen} />;
  const evidence = review && (
    <section key="evidence" className="block review-evidence" aria-labelledby="g-chart"><h2 className="block-title" id="g-chart">Chart and recent check-ins</h2>{chart}<CheckInRows goal={goal} limit={4} /></section>
  );

  const main = review ? [evidence] : [chart, whySection, doing, feeding, quarters, activity, about];
  const side = review ? [askedSection, talked] : [askedSection, contextLine, actionsSide, talked];
  const phone = review ? [askedSection, evidence, talked] : [askedSection, contextLine, chart, whySection, doing, talked, feeding, quarters, activity, about];

  return (
    <div className={'page goal-page' + (review ? ' in-review' : '')} ref={page}>
      <ReviewBar goalId={goal.id} />
      <GoalBack />
      <GoalBar goal={goal} status={status} figures={figures} why={why} feeds={feeds} stale={stale} actions={actions} askedLine={askedLine}
        statusMoved={statusMoved} hit={hit} countFrom={own.at(-2)?.value ?? null} />

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
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------------- the bar */

/**
 * The summary bar: a two-second read. Line 1: the goal and its owner. Line 2: status, the number against plan and
 * target, which way it's heading. Line 3: why, and whether anyone's on it. Once it scrolls away it shrinks to one line
 * that stays at the top (title, status, number, the main action): the same element, not a copy. On a phone it is the
 * page's header, with the app header's Demo tag and person button at its right.
 */
function GoalBar({ goal, status, figures, why, feeds, stale, actions, askedLine, statusMoved, hit, countFrom }: {
  goal: Goal; status: DisplayStatus; figures: ReturnType<typeof barFigures>; why: ReturnType<typeof whyLine>; feeds: ReturnType<typeof feedsLine>;
  stale: boolean; actions: ReactNode; askedLine: ReactNode; statusMoved: boolean; hit: boolean; countFrom: number | null;
}) {
  const app = useApp();
  const owner = app.person(goal.ownerId);
  const team = app.team(goal.teamId);
  const me = useShellTop();
  const slot = useRef<HTMLDivElement>(null);
  const c = useCompact(slot);
  const num = figures.nowValue != null && goal.kind !== 'milestone'
    ? <CountNumber value={figures.nowValue} from={countFrom} format={(n) => fmt(n, goal)} memo={'goal:' + goal.id} />
    : figures.now;
  const arrow = figures.direction && (
    <span className={'bar-dir dir-' + figures.direction} title={figures.directionText ?? undefined} aria-label={figures.directionText ? `Heading: ${figures.directionText}` : undefined}>
      <Icon name={figures.direction === 'worsening' ? 'trend-down' : figures.direction === 'recovering' ? 'arrow-up' : 'arrow-right'} size={14} />
      {figures.direction}
    </span>
  );
  return (
    <div className="goal-bar-slot" ref={slot} style={c.on ? { height: c.height } : undefined}>
      <header className={'goal-bar' + (c.on ? ' compact' : '') + (hit ? ' hit' : '')} data-tone={status} style={c.on ? { position: 'fixed', top: c.top, left: c.left, width: c.width } : undefined} aria-label="This goal">
        <div className="bar-1">
          <h1 className="bar-title">{goal.title}</h1>
          {me && <span className="bar-me">{me}</span>}
        </div>
        <div className="bar-who">
          <Avatar p={owner ?? { name: '?', initials: '?' }} size="sm" /><span>{owner?.name ?? 'No owner'}{team ? `, ${team.name}` : ''}</span>
          <LevelTag level={goal.level} />
          {goal.key && <span className="gkey" title={`This goal’s key: it never changes, and /goals/${goal.key} opens it`}>{goal.key}</span>}
        </div>
        <div className="bar-2">
          <Chip k={status} className={'bar-status' + (statusMoved ? ' moved' : '')} />
          <span className="bar-now">{num}</span>
          {figures.against.map((x) => <span key={x} className="bar-against"><span aria-hidden="true">· </span>{x}</span>)}
          {!stale && arrow}
        </div>
        {(why.text || why.handledText || askedLine || feeds) && (
          <div className="bar-3">
            {why.text && <span className="bar-why">{why.text}{stale ? '. Without a newer check-in, the status and any projection can’t be trusted.' : ''}</span>}
            {why.handledText && <span className={'bar-handled ' + (why.handled === 'handled' ? 'is-handled' : 'not-handled')}><span aria-hidden="true">· </span>{why.handledText}</span>}
            {askedLine}
            {feeds && (
              <span className="bar-feeds"><a href="#feeds" className="linkish">{feeds.text.split(':')[0]}</a>{feeds.counts.length > 0 && <>: {feeds.counts.map((x, i) => <span key={x.status} className={'feeds-count tone-' + x.status}>{i ? ', ' : ''}<StatusShape k={x.status} />{x.n} {LABEL[x.status].toLowerCase()}</span>)}</>}{!feeds.counts.length && ', none behind'}</span>
            )}
          </div>
        )}
        {actions && <div className="bar-actions">{actions}</div>}
      </header>
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
        chart: goal.kind === 'metric' && a.kind === 'metric' ? { goal: goal as MetricGoal, weeks: app.cycle.weeks, week: app.week, series, projection: status === 'stale' ? null : a.projection } : null,
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
  const what = (x: AskedItem) => x.kind === 'decision' ? `Decision or help, from ${x.fromFirst}`
    : x.kind === 'question' ? `Question from ${x.fromFirst}${x.where ? ` in ${x.where}` : ''}`
    : x.kind === 'update' ? `${x.fromFirst} asked for an update`
    : x.kind === 'action' ? `Action${x.where ? ` from ${x.where}` : ` from ${x.fromFirst}`}${x.due ? `, due week ${x.due}` : ''}`
    : `${x.fromFirst} commented`;
  return (
    <section className="block asked" aria-labelledby="g-asked" ref={sectionRef}>
      <h2 className="block-title" id="g-asked">Asked of you</h2>
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

function GoalChart({ goal, stale, landed, hit }: { goal: Goal; stale: boolean; landed: boolean; hit: boolean }) {
  const app = useApp();
  const { cycle, week } = app;
  const own = app.checkInsOf(goal);
  const series = valueSeries(own);
  const a = assessPosted(goal, cycle, app.snapshot.checkIns, week);
  const latest = own[own.length - 1] ?? null;
  const ptg = latest?.pathToGreen ?? null;
  const draw = !reducedMotion();
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
      return parts.join(' · ') + (c && c.why && c.why !== 'On plan.' ? `. ${c.cause ? causeLabel(c.cause) + ': ' : ''}${c.why}` : '');
    },
  };
  const fc = !stale ? forecastText(goal, a, cycle.weeks) : null;
  const facts = summaryFacts(goal, cycle, app.snapshot.checkIns, week, stale).facts;
  const rangeProj = goal.kind === 'range' ? facts.find((f) => f.key === 'projection' && f.projection) : undefined;
  const trend = facts.find((f) => f.key === 'trend');
  // Direction and the projection have their one home here, in words under the lines.
  const caption = [trend && trend.value !== 'Not enough check-ins yet' && !stale ? `${trend.value}: ${trend.detail?.charAt(0).toLowerCase()}${trend.detail?.slice(1)}.` : '', fc?.text ?? '', rangeProj ? `Heading for ${rangeProj.value}. ${rangeProj.detail}.` : '', stale ? 'No projection: the last check-in is too old to project from.' : ''].filter(Boolean).join(' ');
  return (
    <section className="block goal-chart-block" aria-label="Chart">
      {goal.kind === 'metric' && a.kind === 'metric' && (
        <figure className="card goal-chart" style={{ margin: 0 }}>
          <MetricChart goal={goal} weeks={cycle.weeks} week={week} series={series} forecast={stale ? null : a.forecast} projection={stale ? null : a.projection} ptgBy={stale ? null : ptg?.byWeek ?? null} scrub={scrub} draw={draw} landed={landed && draw} hit={hit} />
          {(caption || goal.originalPlan) && <figcaption className="small chart-say">{caption}{goal.originalPlan ? <> <PlanChanges goal={goal} /></> : null}</figcaption>}
        </figure>
      )}
      {goal.kind === 'range' && (
        <figure className="card goal-chart" style={{ margin: 0 }}>
          <RangeChart goal={goal} weeks={cycle.weeks} week={week} series={series} scrub={scrub} draw={draw} landed={landed && draw} />
          {caption && <figcaption className="small chart-say">{caption}</figcaption>}
        </figure>
      )}
      {a.kind === 'milestone' && <div className="card"><StageList a={a} />{caption && <p className="small chart-say">{caption}</p>}</div>}
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
  return <span className="muted">{what}{first} The original plan is dotted; earlier weeks and closed quarters are judged against the plan of their day.</span>;
}

/* ---------------------------------------------------------------------------------------------------- why */

/** Why: who gave the reason and since when, its cause, and the signals as small tags. The reason itself is in the bar. */
function WhySection({ goal }: { goal: Goal }) {
  const app = useApp();
  const att = app.attentionOf(goal);
  const latest = att.status.latest;
  const status = att.status.status;
  const facts = summaryFacts(goal, app.cycle, app.snapshot.checkIns, app.week, status === 'stale').facts;
  const trend = facts.find((f) => f.key === 'trend');
  const signals = att.flags.filter((f) => !['due', 'off', 'risk', 'stale'].includes(f.kind));
  const behind = status === 'off' || status === 'risk';
  if (!behind && !signals.length) return null;
  const own = app.checkInsOf(goal);
  let k = own.length - 1;
  while (k > 0 && latest && own[k - 1]!.why === latest.why && own[k - 1]!.cause === latest.cause) k--;
  const runFrom = own[k]?.week;
  const by = latest ? app.person(latest.authorId)?.name.split(' ')[0] ?? 'The owner' : null;
  const reason = latest && latest.why && latest.why !== 'On plan.';
  const flat = trend?.detail && /^Flat at /.test(trend.detail) ? trend.detail : null;
  return (
    <section className="block why-block" aria-labelledby="g-why">
      <h2 className="block-title" id="g-why">Why</h2>
      {latest && reason && (
        <p className="why-by">
          {latest.cause ? <><strong>{causeLabel(latest.cause)}</strong>, from </> : 'From '}{by}’s check-in in week {latest.week}{runFrom != null && runFrom < latest.week ? `; the same reason since week ${runFrom}` : ''}.
        </p>
      )}
      {flat && <p className="why-flat">{flat}.</p>}
      {signals.length > 0 && (
        <ul className="signal-tags" aria-label="Signals">
          {signals.map((f) => <li key={f.kind} className="signal-tag" title={f.detail}><WarnMark />{f.label}</li>)}
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
  if (!behind && !(withActions && items.length)) return null;
  return (
    <section className="block doing" aria-labelledby="g-doing">
      <h2 className="block-title" id="g-doing">What’s being done</h2>
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
    </section>
  );
}

/** On a wide screen the action list sits in the side column, beside what's being done. */
function ActionsSection({ goal, asked }: { goal: Goal; asked: AskedItem[] }) {
  const app = useApp();
  const att = app.attentionOf(goal);
  const items = actionList(goal, app.snapshot, app.week, att.status.status, att.status.latest, app.cycle).filter((x) => x.kind !== 'path' && !asked.some((a) => a.id === x.id));
  if (!items.length) return null;
  return (
    <section className="block side-actions" aria-labelledby="g-actions">
      <h2 className="block-title" id="g-actions">Actions</h2>
      <ActionRows goal={goal} items={items} />
    </section>
  );
}

/** A request typed after "Elena:" starts in lower case; it leads its own line here. */
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const STATE_WORD = { open: 'Open', done: 'Done', overdue: 'Overdue' } as const;

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
  return (
    <ul className="action-list">
      {items.map((x) => {
        const r = x.kind !== 'path' ? askOf(x.id) : undefined;
        const open = r?.status === 'open';
        return (
          <li key={x.id} className={'action-row state-' + x.state}>
            <span className={'action-state state-' + x.state}>{x.state === 'done' ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.5 3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : x.state === 'overdue' ? <WarnMark /> : <span className="open-mark" aria-hidden="true" />}{STATE_WORD[x.state]}</span>
            <span className="action-body">
              <span className="action-what">{cap(x.what)}</span>
              <span className="hint">{x.kind !== 'path' ? `${ASK_KIND_LABEL[x.kind]} · ` : ''}{first(x.who)}{x.due != null ? `, by week ${x.due}` : ''} · {x.note}</span>
              {r && open && (canMarkDone(r, app.viewer) || canWithdraw(r, app.viewer, goal)) && (
                <span className="row action-do" style={{ gap: 'var(--s3)' }}>
                  {canMarkDone(r, app.viewer) && <button type="button" className="linkish small" onClick={() => done(r)}>Mark done</button>}
                  {canWithdraw(r, app.viewer, goal) && <button type="button" className="linkish small action-withdraw" onClick={() => withdraw(r)}>{r.kind === 'decision' && r.goalIds[0] !== goal.id ? 'Not waiting on it any more' : 'Withdraw'}</button>}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------------------------------------------- last time we talked */

const dayOf = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function TalkedSection({ goal }: { goal: Goal }) {
  const app = useApp();
  const t = lastTalked(goal, app.snapshot, app.cycle, app.week, app.today);
  const nextText = t.next ? `${t.next.review}, ${t.next.date === app.today.toISOString().slice(0, 10) ? 'today' : `${t.next.weekday} ${dayOf(t.next.date).replace(/^\w+ /, '')}`}` : null;
  const owner = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'the owner';
  return (
    <section className="block talked" aria-labelledby="g-talked">
      <h2 className="block-title" id="g-talked">Last time we talked</h2>
      {t.held ? (
        <>
          <p className="small"><span className="strong">{t.held.review}</span>, {dayOf(t.held.on)} (week {t.held.week}){t.held.said.length ? '' : ': reviewed, nothing added.'}</p>
          {t.held.said.length > 0 && (
            <ul className="talked-list">
              {t.held.said.map((d) => (
                <li key={d.id}>
                  <span className="field-label">{d.kind === 'ask' ? `${d.by} asked ${owner}` : d.kind === 'action' ? `Agreed: ${app.person(d.who ?? '')?.name.split(' ')[0] ?? owner}${d.due ? `, by week ${d.due}` : ''}` : `${d.by} noted`}{d.state && <span className={'action-state state-' + d.state}> · {d.kind === 'ask' ? (d.state === 'done' ? 'Answered' : 'Not answered yet') : STATE_WORD[d.state]}</span>}</span>
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

function FeedsSection({ feeding }: { feeding: Goal[] }) {
  const app = useApp();
  const [all, setAll] = useState(false);
  const onPath = criticalPath(app.snapshot.goals, (g) => app.statusOf(g).status);
  const { pinned, rest } = feedingOrder(feeding, (g) => app.attentionOf(g), onPath);
  const shown = all ? rest : rest.slice(0, pinned ? 2 : 3);
  return (
    <section className="block feeds" id="feeds" aria-labelledby="g-feeds">
      <h2 className="block-title" id="g-feeds">What feeds it</h2>
      <ul className="tree">
        {pinned && <li className="pinned"><GoalRow g={pinned.goal} /><span className="hint pinned-why">Most likely to make it miss: {pinned.why}</span></li>}
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
    <section className="block" aria-label="This year by quarter">
      <h2 className="block-title">This year by quarter</h2>
      <ol className="quarters">
        {rs.map((r) => (
          <li key={r.quarter.n} className={'q-' + r.kind + (r.quarter.n === now ? ' q-now' : '')}>
            <span className="q-head"><span className="strong">{r.quarter.label} <span className="hint nowrap">{r.quarter.months}</span></span>
              <span className="q-result"><QuarterMark kind={r.kind} done={r.quarter.n === now ? (app.week - r.quarter.from + 1) / (r.quarter.to - r.quarter.from + 1) : 0} />{r.kind === 'met' ? 'Met' : r.kind === 'missed' ? 'Missed' : r.kind === 'open' ? (r.quarter.n === now ? 'Now' : 'To come') : 'None due'}</span></span>
            {r.kind !== 'none' && <span className="small">{quarterWords(r.text)}</span>}
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
    <section className="block activity" id="activity" aria-labelledby="g-activity" ref={ref}>
      <h2 className="block-title" id="g-activity">Activity</h2>
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
  if (x.kind === 'comment' || x.kind === 'change') return <ChangeItem c={x.change} />;
  if (x.kind === 'checkin') return <li className="stream-ci"><ol className="cilist ci-open"><CheckInRow goal={goal} c={x.checkIn} sameAs={x.sameAs} /></ol></li>;
  return (
    <li className="stream-group">
      <button type="button" className="group-row" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="strong">Weeks {x.from}–{x.to}</span>
        <span className="small group-why">{x.sameAs != null ? <span className="muted">The same reason as week {x.sameAs}</span> : x.why}</span>
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
function CheckInRow({ goal, c, quiet, sameAs }: { goal: Goal; c: CheckIn; quiet?: boolean; sameAs?: number }) {
  const [isOpen, setOpen] = useState(false);
  return (
    <li className={isOpen ? 'is-open' : undefined}>
      <button type="button" className="ci-row" aria-expanded={isOpen} aria-controls={'ci-' + c.id} onClick={() => setOpen(!isOpen)}>
        <span className="strong ci-week"><span className="nowrap">Week {c.week}</span></span>
        <span className="ci-value num">{goal.kind === 'milestone' ? `${assessMilestone(goal, c.week, c.stages).doneCount} of ${goal.stages.length} stages` : c.value == null ? '—' : fmt(c.value, goal)}</span>
        <Chip k={c.status} />
        <span className="ci-tail">{quiet ? <span className="small muted cilist-why">Same reason</span> : sameAs != null ? <span className="small muted cilist-why">The same reason as week {sameAs}</span> : c.why && c.why !== 'On plan.' ? <span className="small cilist-why">{c.why}</span> : <span className="small muted cilist-why">On plan</span>}<Icon name={isOpen ? 'chevron-up' : 'chevron-down'} className="muted ci-chev" /></span>
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
        const newer = c.why && c.why !== 'On plan.' ? list.slice(0, i).reverse().find((x) => x.why === c.why) : undefined;
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
    <details className="block about" ref={detailsRef} open={open} onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}>
      <summary><h2 className="block-title">About this goal</h2></summary>
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
      <p className="small">How the status is worked out: <Link className="linkish" to="/help/status">On track, at risk and off track, explained</Link>.</p>
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
