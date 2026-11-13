import { Place, useModules } from '../core/app';
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { usePrefs } from '../app/search';
import { proposalSeen, putOff } from '../app/proposalSeen';
import { proposalAsks, type ProposalAsk } from '../domain/proposed';
const ProposalRows = lazy(() => import('../ui/HomeProposals').then((m) => ({ default: m.ProposalRows })));
import { useGoalCounts, useGoalList } from '../app/goals';
import { EMPTY_QUERY } from '../domain/query';
import { countList } from '../domain/order';
import { gettingStarted, inviteLink, type DayOneFacts } from '../domain/dayOne';
import { workspaceName } from '../domain/workspaceAttention';
import { dayOneRows, homeFacts, reviewName, reviewsOn, watchingOn, wrapUpOn, wrapUpScope } from '../app/reads';
import { useApp } from '../app/state';
import { checkInDraftKey, hasDraft } from '../app/drafts';
import { attentionList, attentionOrder, splitAttention } from '../domain/attention';
import { dashboard, groupWatched, homeFor, type Dashboard, type HomePlan, type Waiting } from '../domain/home';
import { weekProgress, WEEKDAY } from '../domain/progress';
import { dayText, pastText, watchedGoals } from '../domain/review';
import { cycleDates, dayWithYear, laterCycle, nextCycleShape, placeLine, wrapUpOpenOn } from '../domain/cycle';
import { hasEnded } from '../domain/plan';
import { periodWord } from '../domain/year';
import { ATTENTION, LABEL } from '../domain/vocabulary';
import { statusChange } from '../domain/tree';
import { statusCounts } from '../domain/order';
import { goalStatus } from '../domain/status';
import type { AskKind } from '../domain/types';
import { AttentionCard, Avatar, ProgressRing, StatusShape, WarnMark } from '../ui/bits';
import { GoalRow } from '../ui/goalRows';
import { HandledGroup } from '../ui/HandledGroup';
import { HomeNews } from '../ui/HelpLinks';

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/**
 * The lead (docs/design/home/spec.md rule 2): what is asked of you today and the page's one primary action, or the quiet
 * line when nothing is. Words and addresses come from homeFor; this only draws them.
 */
function LeadOrQuiet({ plan }: { plan: HomePlan }) {
  const { lead, quiet } = plan;
  if (lead) {
    return (
      <section className="hero home-hero split-a" data-part="This week’s main action" data-lead={lead.kind}>
        {lead.ring && <ProgressRing done={lead.ring.done} total={lead.ring.total} size={64} counts={lead.ring.counts} label={`${lead.ring.done} of ${lead.ring.total} ${lead.ring.counts === 'check-ins' ? 'check-ins done this week' : lead.ring.counts === 'reviewed' ? 'goals reviewed' : 'goals wrapped up'}`} />}
        <div className="hero-body">
          <span className="eyebrow">{lead.warn && <WarnMark />}{lead.eyebrow}</span>
          <h2 className="hero-title">{lead.title}</h2>
          {lead.line && <span className="muted">{lead.line}</span>}
          <div className="row"><Link className="btn primary big-btn" to={lead.action.to}>{lead.action.label}</Link></div>
          {lead.also && <Link className="linkish small" to={lead.also.to}>{lead.also.label}</Link>}
        </div>
      </section>
    );
  }
  if (!quiet) return null;
  return (
    <section className="hero home-hero home-quiet split-a" data-part="This week’s main action" data-lead="none">
      <div className="hero-body">
        <h2 className="hero-title">{quiet.sentence}</h2>
        {quiet.line && <span className="muted">{quiet.line}</span>}
        {quiet.buttons.length > 0 && <div className="row">{quiet.buttons.map((b) => <Link key={b.to} className="btn" to={b.to}>{b.label}</Link>)}</div>}
      </div>
    </section>
  );
}

/**
 * Your goals (section 2.1, part 6): counted once, here. Each status's count opens exactly those goals; then what needs
 * attention, what's being handled (folded) and the rest, five at a time. A row is a link to its goal; its one button
 * is "Check in" while one is due, never "Open".
 */
function YourGoals({ news }: { news?: ReactNode }) {
  const app = useApp();
  const [all, setAll] = useState(false);
  // Your goals through the query port (AX5), worst first.
  const mine = useGoalList(useMineAsk(app.viewer.id))?.rows.map((r) => r.goal) ?? [];
  if (!mine.length) return null;
  const att = attentionList(app.snapshot, app.cycle, app.today, { goals: mine });
  const { needs, handled } = splitAttention(att);
  const rest = mine.filter((g) => !att.some((a) => a.goal.id === g.id));
  const counts = statusCounts(mine.map((g) => goalStatus(g, app.cycle, app.snapshot.checkIns, app.today).status));
  const shown = all ? rest : rest.slice(0, 5);
  return (
    <section className="block home-mine" data-part="Your goals">
      <div className="row between">
        <h2 className="block-title">Your goals <span className="count-pill">· {mine.length}</span></h2>
        <Link className="small linkish" to="/goals?scope=mine">See them in Goals</Link>
      </div>
      <p className="home-counts">
        {counts.map((c) => (
          <Link key={c.status} className={'dash-count tone-' + c.status} to={`/goals?scope=mine&status=${c.status}`} aria-label={`${c.n} ${LABEL[c.status].toLowerCase()}: show ${c.n === 1 ? 'it' : 'them'}`}>
            <StatusShape k={c.status} />{c.n} {LABEL[c.status].toLowerCase()}
          </Link>
        ))}
      </p>
      {needs.length > 0 && (
        <div className="home-sub">
          <Link className="need-group-title linkish" to="/goals?scope=mine&attention=1">{needs.length} need{needs.length === 1 ? 's' : ''} attention</Link>
          <AttentionList list={needs} />
        </div>
      )}
      {/* What's new on a phone: after the goals that need you, so the first screen stays the week's work (U2). */}
      {news}
      <HandledGroup list={handled} folded />
      {rest.length > 0 && (
        <div className="home-sub">
          <div className="glist">{shown.map((g) => <GoalRow key={g.id} g={g} density="line" />)}</div>
          {rest.length > shown.length && <button type="button" className="linkish small" onClick={() => setAll(true)}>Show the {rest.length - shown.length} with nothing flagged</button>}
        </div>
      )}
    </section>
  );
}

/** Each kind of ask is named once, in its group's heading, so every item leads with the goal it's about. */
const ASK_GROUP: Record<AskKind, string> = { question: 'Questions for you', decision: 'Decisions or help needed', update: 'Updates asked for', action: 'Actions for you' };
const ASK_BUTTON: Record<AskKind, string> = { question: 'Answer', decision: 'Respond', update: 'Check in', action: 'Mark done' };
const GROUP_ORDER: AskKind[] = ['decision', 'question', 'update', 'action'];

/**
 * Needs your response (part 3): every open ask waiting on you but the one the lead says, in rule 3's order, grouped by
 * kind. Each says what it's about, what was asked, who asked, where and when, and how long it has waited or when it is
 * due (rule 3's line; a late one with the warning mark, first). Five, then "Show all {n}". One button each.
 */
function NeedsYou({ asks, also, leadAbout }: { asks: Waiting[]; also: boolean; leadAbout: string | null }) {
  const app = useApp();
  const prefs = usePrefs();
  const [all, setAll] = useState(false);
  // Proposals (goal entry rule 14): one proposed for you by someone else, not yet opened, and one waiting 8 weeks or more.
  const [seen, setSeen] = useState(() => proposalSeen(prefs, app.ws.id, app.viewer.id));
  // With Reviews switched off (FT2) no proposal says which review it came from.
  const reviewsHere = reviewsOn(useModules().on);
  // The one the lead says (a goal proposed for you a week or more ago) isn't listed again.
  const proposals = proposalAsks(app.snapshot.proposed ?? [], app.viewer, app.today, seen, (id) => app.person(id)?.name ?? id, (id) => (reviewsHere ? reviewName(app.snapshot, id) : null)).filter((p) => p.goal.id !== leadAbout);
  const notYet = (p: ProposalAsk) => { putOff(prefs, app.ws.id, app.viewer.id, p.goal.id, app.today); setSeen(proposalSeen(prefs, app.ws.id, app.viewer.id)); };
  if (!asks.length && !proposals.length) return null;
  const shown = all ? asks : asks.slice(0, 5);
  const groups = GROUP_ORDER.map((k) => [k, shown.filter((x) => x.kind === k)] as const).filter(([, l]) => l.length);
  const said = (w: Waiting) => {
    const who = w.by ? `${w.by} ${w.kind === 'action' ? 'agreed it' : 'asked'}` : 'You agreed it';
    // "Waiting since 28 Jul, 14 weeks" already says the day it was asked: it isn't said twice (F1, one line in the side column).
    // "Asked yesterday" says it too, so the day goes only with a due date's line (#310's lows).
    const since = /^(Waiting since|Asked )/.test(w.line);
    const asked = `${who}${w.where ? ` in ${w.where}` : ''}${since ? '' : ` on ${dayText(w.askedOn).replace(/^\w+ /, '')}`}`;
    // The wait comes first, so a phone's one line, cut short, still says it (build review of #310). The handover comes
    // second, not last, so it survives the cut where the new owner first meets the ask (review of #369, medium 1).
    const handed = w.was ? ` · Asked of ${w.was.split(' ')[0]}, now yours` : '';
    return `${w.line}${handed} · ${asked}.`;
  };
  return (
    <section className="block needs-you" data-part="Needs your response">
      {/* One kind only: its heading sits on the title's line, not above the list, so the first of your goals that needs
          attention still starts on a phone's first screen (build review of #305). */}
      <div className="row between need-head">
        <h2 className="block-title">{also ? 'Also needs your response' : 'Needs your response'} <span className="count-pill">· {asks.length + proposals.length}</span></h2>
        {groups.length === 1 && <h3 className="need-group-title">{ASK_GROUP[groups[0]![0]]}</h3>}
      </div>
      {groups.map(([k, list]) => (
        <div key={k} className="need-group">
          {groups.length > 1 && <h3 className="need-group-title">{ASK_GROUP[k]} <span className="count-pill">· {list.length}</span></h3>}
          <ul className="needs-list">
            {list.map((w) => {
              const askedBy = app.snapshot.requests?.find((r) => r.id === w.askId)?.askedBy ?? '';
              return (
                <li key={w.askId} className="need">
                  <Avatar p={app.person(askedBy) ?? { name: '?', initials: '?' }} size="sm" />
                  <span className="need-body">
                    <span className="need-what">{w.goals.length > 1 ? `${w.goals[0]!.title}, and ${w.goals.length - 1} more ${w.goals.length === 2 ? 'goal' : 'goals'} waiting on it` : w.goals[0]!.title}</span>
                    {w.said && <span className="need-quote">“{w.said}”</span>}
                    <span className="need-meta">{w.warn && <><WarnMark />{' '}</>}{said(w)}</span>
                    <span className="need-action">
                      {/* Each opens the goal with this ask open and its box ready (the flagship goal page, 5 Nov). */}
                      <Link className="btn sm" to={w.to}>{ASK_BUTTON[w.kind]}</Link>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {asks.length > shown.length && <button type="button" className="linkish small" onClick={() => setAll(true)}>Show all {asks.length}</button>}
      {/* Loaded once there is a proposal to show (the first download stays as it was). */}
      {proposals.length > 0 && <Suspense fallback={null}><ProposalRows proposals={proposals} notYet={notYet} /></Suspense>}
    </section>
  );
}

/**
 * The goals you watch and don't own: what needs attention first (with what got worse this week), then what has gone
 * quiet; what's being handled is folded away; the rest is a count with a way to Watching.
 */
function WatchedGoals() {
  const app = useApp();
  const watched = watchedGoals(app.viewer.id, app.snapshot).filter((g) => g.ownerId !== app.viewer.id);
  if (!watched.length) return null;
  const groups = groupWatched(watched.map((g) => app.attentionOf(g)).sort(attentionOrder));
  const exceptions = groups.needs;
  const worse = exceptions.filter((a) => { const moved = statusChange(a.goal, app.snapshot.checkIns); return moved?.worse && moved.week >= app.week - 1; }).length;
  // Nothing new needs attention: the first few you watch, with how fresh they are, so Home still shows them.
  const shown = exceptions.length ? exceptions.slice(0, 4) : groups.fine.slice(0, 3);
  const parts = [
    groups.needs.length ? `${groups.needs.length} need${groups.needs.length === 1 ? 's' : ''} attention${groups.quiet.length ? ` (${groups.quiet.length} with ${LABEL.stale.toLowerCase()})` : ''}` : 'Nothing new needs attention',
    groups.handled.length ? `${groups.handled.length} ${ATTENTION.handled.label.toLowerCase()}` : '',
    groups.fine.length ? `${groups.fine.length} with nothing flagged` : '',
  ].filter(Boolean);
  return (
    <section className="block home-watch" data-part="Goals you watch">
      <div className="row between">
        <h2 className="block-title">Goals you watch <span className="count-pill">{watched.length}</span></h2>
        <Link className="small linkish" to="/goals?scope=watching">See them in Goals</Link>
      </div>
      <p className="hint">{parts.join(' · ')}.{worse ? ` ${worse} got worse this week.` : ''}</p>
      {shown.length > 0 && (
        <ul className="tree">
          {/* Each row says itself when it got worse ("Was on track in week 43") or went quiet. */}
          {shown.map((a) => <li key={a.goal.id}><GoalRow g={a.goal} /></li>)}
        </ul>
      )}
      {exceptions.length > shown.length && <Link className="small linkish" to="/goals?scope=watching&attention=1">{exceptions.length - shown.length} more need attention</Link>}
      <HandledGroup list={groups.handled} folded />
    </section>
  );
}

/** Your goals that need attention: each row is a link to its goal, with "Check in" when that's what it needs (never "Open"). */
function AttentionList({ list }: { list: ReturnType<typeof attentionList> }) {
  const app = useApp();
  return (
    <div className="alist">
      {list.map((a) => (
        <AttentionCard key={a.goal.id} a={a} to={'/goals/' + a.goal.id}
          action={a.goal.ownerId === app.viewer.id && a.flags.some((f) => f.kind === 'due' || f.kind === 'stale' || f.kind === 'no-path' || f.kind === 'missed-path')
            ? <Link className="btn sm" to={'/check-in/' + a.goal.id}>Check in</Link>
            : undefined} />
      ))}
    </div>
  );
}

/**
 * This week (part 4): a review you're in, as one cell. Left out when the lead is about that review, and absent when
 * there is none: Home never says "None you’re in". Your goals' counts are in "Your goals", once.
 */
function ThisWeek({ d, leadAbout }: { d: Dashboard; leadAbout: string | null }) {
  const missed = d.missed.filter((m) => m.id !== leadAbout);
  // The first review not already in the lead or missed: with two on one day, the lead takes one and the cell the other.
  const left = d.upcoming.filter((r) => r.id !== leadAbout && !d.missed.some((m) => m.id === r.id));
  const next = left[0] ?? null;
  const sameDay = next ? left.filter((r) => r.date === next.date).length : 0;
  if (!missed[0] && !next) return null;
  const when = next ? (next.days === 0 ? 'today' : next.days === 1 ? 'tomorrow' : `in ${next.days} days`) : '';
  return (
    <section className="dash" aria-label="This week" data-part="This week">
      {missed[0] ? (
        // A session past its date and not held comes first: the next one mustn't hide it (re-review, 8 Nov, backlog T).
        <Link className="dash-cell dash-review dash-missed" to={`/reviews/${missed[0].id}`}>
          <span className="dash-label"><WarnMark />Not held yet · {dayText(missed[0].date)}{missed.length > 1 ? ` · ${missed.length} reviews` : ''}</span>
          <span className="dash-value" title={`${missed[0].name}, ${dayText(missed[0].date)}, ${pastText(missed[0].daysPast)}`}>{missed[0].name}</span>
          <span className="dash-sub">{pastText(missed[0].daysPast)}</span>
        </Link>
      ) : next && (
        <Link className="dash-cell dash-review" to={`/reviews/${next.id}`}>
          <span className="dash-label">{next.days === 0 ? 'Review today' : next.days === 1 ? `Review tomorrow, ${dayText(next.date)}` : `Review on ${dayText(next.date)}`}{sameDay > 1 ? ` · ${sameDay} reviews` : ''}</span>
          <span className="dash-value" title={`${next.name}, ${next.weekday} ${when}`}>{next.name}</span>
          <span className="dash-sub">{next.weekday} · {when}</span>
        </Link>
      )}
    </section>
  );
}

/** For admins: the year is ending or has ended, and the next one to start (HM1 review: HM1 had dropped it before HM7). */
function AdminCard() {
  const app = useApp();
  const wrapUpHere = wrapUpOn(useModules().on);
  if (!app.viewer.admin) return null;
  const later = laterCycle(app.full.cycles, app.cycle);
  const over = hasEnded(app.cycle, app.today);
  // With the Wrap-up off (SW1) the card still says the year is ending and offers the next, without the wrap-up's words.
  const wrapping = wrapUpHere && wrapUpOpenOn(app.cycle, app.today);
  if (wrapUpOpenOn(app.cycle, app.today) || (over && !later)) {
    const left = app.snapshot.goals.filter((g) => !app.snapshot.retros.some((r) => r.goalId === g.id)).length;
    const next = later?.name ?? nextCycleShape(app.cycle).name;
    const lastDay = dayWithYear(cycleDates(app.cycle).lastDay);
    // The next year is prepared, not moved into: it opens for everyone on its week 1's Monday (cycle-end 2.9).
    const nextLine = later ? `${next} is ready. It opens for everyone on ${dayWithYear(cycleDates(later).firstDay)}.`
      : over ? `Start ${next}: it opens for everyone as soon as you start it.`
      : `${next} isn’t set up yet. It can be started now; everyone stays in ${app.cycle.name} until ${lastDay}.`;
    return (
      <section className="block note-card">
        <span className="stack" style={{ gap: 'var(--s1)' }}><strong>{over ? `${app.cycle.name} ended on ${lastDay}` : `The ${periodWord(app.cycle)} is ending`}</strong><span className="hint">{wrapping ? (left ? `${left} ${left === 1 ? 'goal' : 'goals'} still to wrap up. ` : 'Every goal is wrapped up. ') : ''}{nextLine}</span></span>
        <span className="row" style={{ gap: 'var(--s2)' }}>
          {wrapping && <Link className="btn" to="/retro">See the wrap-up</Link>}
          <Link className="btn" to={later ? '/workspace/cycles' : '/workspace/cycles/next'}>{later ? 'See Cycles' : `Start ${next}`}</Link>
        </span>
      </section>
    );
  }
  // Adding people is Getting started's row now, said only while it's true (OB3).
  return null;
}

/** Your goals that need attention, each with its one action: check in when that's what it needs, otherwise open it. */

/** Your goals, as the query port is asked for them: every goal you own. */
/** Your goals, worst first (as What's new and Help say), then by title. */
function useMineAsk(viewerId: string) { return useMemo(() => ({ query: { ...EMPTY_QUERY, owner: [viewerId], sort: 'worst' as const } }), [viewerId]); }

/** The week at a glance, its goal counts from the query port (AX5): yours, or every goal when you own none. */
function useDashboard(): Dashboard {
  const app = useApp();
  const mine = useGoalCounts(useMineAsk(app.viewer.id));
  const all = useGoalCounts(mine && !mine.total ? { query: EMPTY_QUERY } : null);
  const on = useModules().on;
  const d = dashboard(app.viewer.id, app.snapshot, app.cycle, app.week, app.today, { reviews: reviewsOn(on), watching: watchingOn(on) });
  const counted = mine?.total ? mine : all;
  return counted ? { ...d, scope: mine?.total ? 'mine' : 'all', counts: countList(counted.status), total: counted.total } : d;
}

export function Home() {
  const app = useApp();
  const first = app.viewer.name.split(' ')[0];
  const draft = weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today).due.some((g) => hasDraft(checkInDraftKey(app.ws.id, g.id, app.week)));
  const prefs = usePrefs();
  const { opened, putOff: later } = proposalSeen(prefs, app.ws.id, app.viewer.id);
  const on = useModules().on;
  const plan = homeFor(homeFacts(app.viewer.id, app.snapshot, app.cycle, app.week, app.today, { workspace: workspaceName(app.ws, app.mode).name, draft, wrap: wrapUpScope(app.full, app.cycle, app.snapshot, app.week, app.today), opened, putOff: later, reviews: reviewsOn(on), watching: watchingOn(on), wrapUp: wrapUpOn(on) }));
  return (
    <div className="page home" data-part="Home">
      <div className="page-head">
        <h1 className="title-xl">{greeting(app.today)}, {first}</h1>
        <span className="muted small home-where">{app.ws.name} · {placeLine(app.cycle, app.today)}</span>
      </div>
      <GettingStarted />
      <ThisWeek d={useDashboard()} leadAbout={plan.lead?.about ?? null} />
      <div className="home-grid split">
        <LeadOrQuiet plan={plan} />
        <aside className="home-side split-side" aria-label="For you"><NeedsYou asks={plan.asks} also={plan.lead?.kind === 'ask'} leadAbout={plan.lead?.about ?? null} /><AdminCard /></aside>
        <div className="home-main split-b">
          <YourGoals />
          {/* Only while Watching is on (SW1). */}
          {watchingOn(on) && <WatchedGoals />}
          {/* Modules' blocks (the home.blocks place). */}
          <Place name="home.blocks" />
          {/* New in Faro: one line at the foot, on every width (section 2.1, part 11). */}
          <HomeNews at="foot" />
        </div>
      </div>
    </div>
  );
}

/**
 * Day one (OB3, docs/design/onboarding/spec.md 2.9): for the first two weeks a person is in a workspace, what is true
 * and what to do first, the second person included. The rows are rule 7's (src/domain/dayOne.ts); what each person
 * has done is kept per person and workspace behind the Prefs port. Every button is a plain one: Home keeps its one
 * main action.
 */
function GettingStarted() {
  const app = useApp();
  const prefs = usePrefs();
  const key = [app.ws.id, app.viewer.id, 'day-one'] as const;
  const [facts, setFacts] = useState<DayOneFacts>(() => prefs.get<DayOneFacts>(...key) ?? { firstSeenAt: null });
  // The first visit starts the two weeks.
  useEffect(() => {
    if (facts.firstSeenAt || app.ws.kind === 'example') return;
    const next = { ...facts, firstSeenAt: app.today.toISOString() };
    prefs.set(...key, next); setFacts(next);
  }, [facts, app.ws.kind, app.today]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (p: Partial<DayOneFacts>) => { const next = { ...facts, ...p }; prefs.set(...key, next); setFacts(next); };
  const watching = watchingOn(useModules().on);
  const rows = gettingStarted(app.viewer.id, { ...dayOneRows(app.snapshot), ended: hasEnded(app.cycle, app.today), watching }, { name: workspaceName(app.ws, app.mode).name, kind: app.ws.kind, createdAt: app.ws.createdAt }, facts, app.today, WEEKDAY[app.cycle.reviewDay] ?? 'the review');
  if (!rows.length) return null;
  const invite = inviteLink(location.origin, app.mode, app.ws.id);
  return (
    <section className="block getting-started" aria-labelledby="getting-started" data-part="Getting started">
      <h2 className="block-title" id="getting-started">Getting started</h2>
      <ul className="gs-list">
        {rows.map((r) => (
          <li key={r.id} className="gs-row" data-row={r.id}>
            <span className="gs-says">{r.says}</span>
            {r.id === 'invite'
              ? <button type="button" className="btn sm" onClick={() => { void navigator.clipboard?.writeText(invite).then(() => app.toast('Link copied'), () => undefined); save({ inviteCopied: true }); }}>{r.action}</button>
              : r.to && <Link className="btn sm" to={r.to} onClick={() => { if (r.id === 'see-goals') save({ sawGoals: true }); }}>{r.action}</Link>}
          </li>
        ))}
      </ul>
      <button type="button" className="linkish small gs-hide" onClick={() => save({ hidden: true })}>Hide this</button>
    </section>
  );
}

