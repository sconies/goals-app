/* Your team, Goals you watch, and teams worst first (docs/design/home/spec.md 2.1 parts 7 and 7b, "Teams, worst first";
   rule 4). Loaded after Home's first download (they sit below the lead), so it stays within its budget. The sets are the Goals scopes (domain/homeSets.ts),
   worked out from the facts the Goals tabs read (app/reads scopeFacts). No person's name is in the teams table: teams
   and goals are ranked, never people. Its "Since" column is rule 5's (HM4), as is "Changed since" (part 8, the side
   column), which is here too so that its code also loads after the first download. */
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useModules } from '../core/app';
import { heldForGoals, liveGoals, reviewsOn, scopeFacts, standingIn, watchingOn } from '../app/reads';
import { movesSince } from '../app/moved';
import { byWeekTo, habit, habitCell, habitShown } from '../domain/habit';
import { dueIn } from '../domain/standing';
import { goalsIn } from '../domain/watch';
import type { Goal } from '../domain/types';
import { reviewDate } from '../domain/progress';
import { useApp } from '../app/state';
import { homeSince, markHomeSeen } from '../app/homeSeen';
import { scopesFor, type ScopeTab } from '../domain/goalsPage';
import { changedHeading, changedSet, changedSince, mondayOf, movesByTeam, MOVED_WORDS, type Changed, type MoveKind, type ThenNow } from '../domain/changed';
import { dayText } from '../domain/format';
import { longDay } from '../domain/home';
import { attentionOrder } from '../domain/attention';
import { groupWatched, theOneTeam } from '../domain/home';
import { asTeams, homeSets, standingOver, standingSet, standingWords, type SetFacts, type Sets, type TeamRow } from '../domain/homeSets';
import { watchedGoals } from '../domain/review';
import { statusChange } from '../domain/tree';
import { ATTENTION, LABEL } from '../domain/vocabulary';
import { AttentionCard, StatusShape } from './bits';
import { GoalRow } from './goalRows';
import { HandledGroup } from './HandledGroup';

/** Five teams, then "{k} more teams, {j} need attention" to the scope by team. */
export const TEAMS_SHOWN = 5;

/** The Goals scopes for the viewer, drawn as tabs or not (Watching only while it is on): what Home's sets and "Changed since" read. */
function useTabs(): ScopeTab[] {
  const { snapshot, viewer } = useApp();
  const watching = watchingOn(useModules().on);
  // Every scope, drawn as a tab or not (as find_goals reads them): in a one-team workspace My team waits on Goals, being
  // the same list as All, but its goals still belong on Home (review of #468, medium; #492).
  return useMemo(() => scopesFor(scopeFacts(snapshot, viewer), null, { watching }).every, [snapshot, viewer, watching]);
}

/** Home's sets (rule 4): exactly the Goals scopes, so each block's total is its tab's count. */
function useHomeSets(): Sets {
  const { snapshot, viewer, attentionOf } = useApp();
  const tabs = useTabs();
  return useMemo(() => {
    const ids = new Set(tabs.filter((t) => t.id !== 'all').flatMap((t) => t.ids));
    const attention = snapshot.goals.filter((g) => ids.has(g.id)).map((g) => attentionOf(g));
    return homeSets({ id: viewer.id, teams: scopeFacts(snapshot, viewer).teams }, tabs, attention, snapshot.teams);
  }, [snapshot, viewer, attentionOf, tabs]);
}

/**
 * Rule 5: the day "Changed since" counts from (`sinceFor` over `home-seen`; null when Home was never opened), the date
 * its links carry (that day, or this week's Monday), and what each goal did since: the status rule on that day, with the
 * check-ins posted before it, and now.
 */
function useSince() {
  const app = useApp();
  const today = app.today.toISOString().slice(0, 10);
  const since = homeSince(app.ws.id, app.viewer.id, today);
  const moves = useMemo(() => movesSince(app.snapshot, app.cycle, app.today), [app.snapshot, app.cycle, app.today]);
  return { since, from: since ?? mondayOf(today), today, moves };
}

/** What moved in a list of goals (by id) since `from`: rule 5's counts and rows. */
function movedIn(ids: readonly string[], sets: Map<string, Pick<ThenNow, 'set' | 'setName'>> | null, s: ReturnType<typeof useSince>, goals: ReturnType<typeof useApp>['snapshot']['goals']): Changed {
  const byId = new Map(goals.map((g) => [g.id, g]));
  const list = ids.flatMap((id) => {
    const g = byId.get(id);
    if (!g) return [];
    const set = sets?.get(id) ?? { set: 'watching' as const, setName: '' };
    return [{ id, title: g.title, teamId: g.teamId, ...set, was: s.moves.was(g, s.from), now: s.moves.now(g) }];
  });
  return changedSince(list, s.since);
}

/** A table's teams with their "Since" column (rule 4's TeamRow.moved): what moved in each, in the set's goals. */
function useTeamsMoved(teams: TeamRow[], scope: 'team' | 'watching'): { teams: TeamRow[]; from: string } {
  const app = useApp();
  const tabs = useTabs();
  const s = useSince();
  return useMemo(() => {
    const ids = tabs.find((t) => t.id === scope)?.ids ?? [];
    const by = movesByTeam(movedIn(ids, null, s, app.snapshot.goals).rows);
    return { teams: teams.map((t) => ({ ...t, moved: by.get(t.teamId) ?? { worse: 0, better: 0, quiet: 0 } })), from: s.from };
  }, [teams, scope, tabs, s.from, s.moves, app.snapshot.goals]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** A set's counts by status, worst first, each a shape and a word, and each a link to exactly those goals. */
function SetCounts({ set, scope }: { set: Pick<SetFacts, 'byStatus'>; scope: 'team' | 'watching' }) {
  return (
    <p className="home-counts">
      {set.byStatus.map((c) => (
        <Link key={c.status} className={'dash-count tone-' + c.status} to={`/goals?scope=${scope}&status=${c.status}`} aria-label={`${c.n} ${LABEL[c.status].toLowerCase()}: show ${c.n === 1 ? 'it' : 'them'}`}>
          <StatusShape k={c.status} />{c.n} {LABEL[c.status].toLowerCase()}
        </Link>
      ))}
    </p>
  );
}

/**
 * Your team (part 7): the Goals page's My team scope, when it holds a goal you don't own, and not with one team in the
 * workspace (SM1h). Its counts open exactly those
 * goals; then the goals that need attention and aren't yours (up to four, each with its owner's name first, no button),
 * or the teams worst first when the scope spans three or more.
 */
export function YourTeam() {
  const app = useApp();
  const set = useHomeSets().team;
  // With one team in the workspace its goals are Home's first section, "The team's goals" (SM1h).
  if (!set || theOneTeam(app.snapshot.teams, app.viewer)) return null;
  const several = set.names.length > 1;
  const k = set.rows.length;
  return (
    <section className="block home-team" data-part="Your team">
      <div className="row between">
        <h2 className="block-title">{several ? 'Your teams' : 'Your team'} <span className="count-pill">· {several ? `${set.total} goals in ${set.names.length} teams` : `${set.names[0]} · ${set.total} ${set.total === 1 ? 'goal' : 'goals'}`}</span></h2>
        <Link className="small linkish" to="/goals?scope=team">See them in Goals</Link>
      </div>
      <SetCounts set={set} scope="team" />
      {k > 0
        ? <Link className="need-group-title linkish home-team-needs" to="/goals?scope=team&attention=1&owner=-me">{k} need{k === 1 ? 's' : ''} attention that {k === 1 ? 'isn’t' : 'aren’t'} yours</Link>
        : <p className="hint">{set.needs.length ? 'Nothing that isn’t yours needs attention.' : 'Nothing in it needs attention.'}</p>}
      {set.teams
        ? <MovedTeamsTable teams={set.teams} scope="team" goalsWord="Its goals in your teams" />
        : k > 0 && <div className="alist">{set.rows.slice(0, 4).map((a) => <AttentionCard key={a.goal.id} a={a} to={'/goals/' + a.goal.id} who={app.person(a.goal.ownerId)?.name ?? undefined} />)}</div>}
    </section>
  );
}

/**
 * Goals you watch, drawn as teams (part 7b): "Goals you watch · {n} goals in {k} teams", "{k} need attention" (the
 * Watching scope with the switch on), its counts by status, the teams worst first, and what is being handled, folded.
 */
export function WatchTeams() {
  const set = useHomeSets().watching;
  if (!set?.teams) return null;
  const k = set.needs.length;
  return (
    <section className="block home-watch" data-part="Goals you watch">
      <div className="row between">
        <h2 className="block-title">Goals you watch <span className="count-pill">· {set.total} goals in {set.teams.length} teams</span></h2>
        <Link className="small linkish" to="/goals?scope=watching">See them in Goals</Link>
      </div>
      {k > 0 ? <Link className="need-group-title linkish home-team-needs" to="/goals?scope=watching&attention=1">{k} need{k === 1 ? 's' : ''} attention</Link> : <p className="hint">Nothing in it needs attention.</p>}
      <SetCounts set={set} scope="watching" />
      <MovedTeamsTable teams={set.teams} scope="watching" goalsWord="Its goals you watch" />
      <HandledGroup list={set.handled} folded />
    </section>
  );
}

/** The teams table with its "Since {Thu 5 Nov}" column (rule 5). */
function MovedTeamsTable(p: { teams: TeamRow[]; scope: 'team' | 'watching'; goalsWord: string }) {
  const { teams, from } = useTeamsMoved(p.teams, p.scope);
  return <TeamsTable {...p} teams={teams} since={from} />;
}

const MOVED_ORDER: Exclude<MoveKind, 'done'>[] = ['worse', 'quiet', 'better'];

export function TeamsTable({ teams, scope, goalsWord, since }: { teams: TeamRow[]; scope: 'team' | 'watching'; goalsWord: string; since?: string }) {
  const shown = teams.slice(0, TEAMS_SHOWN);
  const more = teams.slice(TEAMS_SHOWN);
  const at = (t: TeamRow, extra = '') => `/goals?scope=${scope}&team=${encodeURIComponent(t.teamId)}${extra}`;
  const moreNeeds = more.reduce((n, t) => n + t.needs, 0);
  return (
    <div className="home-teams">
      <table className="teams-table">
        <thead>
          <tr><th scope="col">Team</th><th scope="col">{ATTENTION.needs.label}</th><th scope="col">{goalsWord}</th>{since && <th scope="col">Since {dayText(since)}</th>}</tr>
        </thead>
        <tbody>
          {shown.map((t) => (
            <tr key={t.teamId} className="teams-row" data-team={t.teamId}>
              <th scope="row" className="teams-name"><Link className="linkish" to={at(t)}>{t.name}</Link></th>
              <td className="teams-needs">
                <span className="teams-label" aria-hidden="true">{ATTENTION.needs.label}</span>
                {t.needs ? <Link className="linkish" to={at(t, '&attention=1')}>{t.needs} need{t.needs === 1 ? 's' : ''} attention</Link> : <span className="muted">None</span>}
              </td>
              <td className="teams-counts">
                <span className="teams-label" aria-hidden="true">{goalsWord}</span>
                <span className="home-counts">
                  {t.byStatus.map((c) => (
                    <Link key={c.status} className={'dash-count tone-' + c.status} to={at(t, `&status=${c.status}`)} aria-label={`${t.name}: ${c.n} ${LABEL[c.status].toLowerCase()}`}>
                      <StatusShape k={c.status} />{c.n} {LABEL[c.status].toLowerCase()}
                    </Link>
                  ))}
                </span>
              </td>
              {since && (
                <td className="teams-moved">
                  <span className="teams-label" aria-hidden="true">Since {dayText(since)}</span>
                  {MOVED_ORDER.some((k) => t.moved?.[k])
                    ? <span className="home-counts">{MOVED_ORDER.filter((k) => t.moved?.[k]).map((k) => (
                        <Link key={k} className="dash-count" to={at(t, `&moved=${k}&since=${since}`)} aria-label={`${t.name}: ${t.moved![k]} ${MOVED_WORDS[k]} since ${dayText(since)}`}>{t.moved![k]} {MOVED_WORDS[k]}</Link>
                      ))}</span>
                    : <span className="muted">No change</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {more.length > 0 && (
        <Link className="small linkish teams-more" to={`/goals?scope=${scope}&group=team`}>
          {more.length} more {more.length === 1 ? 'team' : 'teams'}, {moreNeeds ? `${moreNeeds} need${moreNeeds === 1 ? 's' : ''} attention` : 'none needs attention'}
        </Link>
      )}
    </div>
  );
}

/**
 * The goals you watch and don't own: what needs attention first (with what got worse this week), then what has gone
 * quiet; what's being handled is folded away; the rest is a count with a way to Watching.
 */
export function WatchedGoals() {
  const app = useApp();
  // The Watching scope (rule 4): every goal watched; the rows below leave out your own. More than twelve goals in two or more teams,
  // it is the teams, worst first, in place of the goal rows (loaded when drawn).
  const scope = watchedGoals(app.viewer.id, app.snapshot);
  const watched = scope.filter((g) => g.ownerId !== app.viewer.id);
  if (!watched.length) return null;
  if (asTeams(scope)) return <WatchTeams />;
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

/**
 * How the week's check-ins stand (rule 6, cell 3; HM7): for someone with a set drawn as teams, over that set; for an admin
 * with none, over every goal. "Checked in for week {w}" · "{a} of {b} goals" · when they are due, or after that how many
 * came in late; it opens the set's goals with no check-in yet. Goals, never people. Alone, it is This week's only cell.
 */
export function StandingCell({ alone }: { alone: boolean }) {
  const app = useApp();
  const sets = useHomeSets();
  const which = standingSet(sets, app.viewer.admin);
  const reviewsHere = reviewsOn(useModules().on);
  const { facts, habitNow } = useMemo(() => {
    if (!which) return { facts: null, habitNow: null };
    const ids = which === 'all' ? null : new Set(sets[which]!.ids);
    const goals = liveGoals(app.snapshot).filter((g) => !ids || ids.has(g.id));
    return { facts: standingOver(which, goals, standingIn(app.snapshot, app.cycle, app.week)), habitNow: leaderHabit(which, goals, app, reviewsHere) };
  }, [which, sets, app, reviewsHere]);
  if (!facts) return null;
  const w = standingWords(facts, app.week, reviewDate(app.cycle, app.week), app.today.toISOString().slice(0, 10));
  const cell = (
    <Link className="dash-cell dash-standing" to={w.to} data-part="How the week’s check-ins stand">
      <span className="dash-label">{w.label}</span>
      <span className="dash-value">{w.value}</span>
      <span className="dash-sub">{w.sub}</span>
    </Link>
  );
  // HB3: rule 2's measure for the same set, beside it (habit spec 2.4).
  const habitCellNode = habitNow && (
    <div className="dash-cell dash-habit" data-part="Without being asked">
      <span className="dash-label">{habitNow.label}</span>
      <span className="dash-value">{habitNow.value}</span>
      <span className="dash-sub">{habitNow.sub ? `${habitNow.sub} · ` : ''}<Link className="linkish" to={habitNow.to}>By week</Link></span>
    </div>
  );
  return alone ? <section className="dash" aria-label="This week" data-part="This week">{cell}{habitCellNode}</section> : <>{cell}{habitCellNode}</>;
}

/** HB3: the habit cell's facts for a leader's set this week, or null (nothing due; fewer than three owners, rule 4). */
function leaderHabit(set: string, goals: Goal[], app: ReturnType<typeof useApp>, reviewsHere: boolean) {
  const { snapshot: s, cycle, week, today } = app;
  if (week < 1) return null;
  const rows = { checkIns: s.checkIns, asks: s.requests ?? [] };
  const isDue = dueIn(cycle, s.checkIns);
  const dueGoals = goals.filter((g) => isDue(g, week));
  if (!habitShown(dueGoals, app.viewer.id)) return null;
  const dueDay = reviewDate(cycle, week);
  const now = habit(goals, week, rows, dueDay, isDue);
  const before = week > 1 ? habit(goals, week - 1, rows, reviewDate(cycle, week - 1), isDue) : null;
  const cell = habitCell(now, before, today.toISOString().slice(0, 10) > dueDay, week, heldForGoals(reviewsHere, s, cycle, week, dueGoals));
  const reviews = reviewsHere ? s.reviews.filter((r) => !r.removedAt).map((r) => ({ id: r.id, goals: goalsIn(r.scope, goals).map((g) => g.id) })) : [];
  return cell && { ...cell, to: byWeekTo(set, dueGoals.map((g) => g.id), reviews) };
}

/** The counts line's kinds, in its order; "went quiet" is weekly only (every cycle is weekly today). */
const COUNT_ORDER: MoveKind[] = ['worse', 'better', 'quiet', 'done'];

/**
 * Changed since {Friday 6 Nov} (part 8, rule 5), in the side column: a line of counts, each a link to exactly those goals
 * in Goals, then up to four goals, worse first, each with its status now (shape and word), what it was and which set it
 * is in. More than four: "All {n} in Goals". Nothing moved: absent. Never opened before: "Changed this week".
 */
export function ChangedSince() {
  const app = useApp();
  const tabs = useTabs();
  const s = useSince();
  // Opening Home on a new day keeps it as the last look (`home-seen`): the day counted from stays the one before. Here,
  // not in Home's first download; this part is drawn (or is nothing) on every Home.
  useEffect(() => { markHomeSeen(app.ws.id, app.viewer.id, s.today); }, [app.ws.id, app.viewer.id, s.today]);
  const changed = useMemo(() => {
    const set = changedSet(tabs, app.viewer.id, app.snapshot.goals, (id) => app.team(id)?.name ?? '', asTeams);
    if (!set) return null;
    return { scope: set.scope, ...movedIn(set.goals.map((g) => g.id), new Map(set.goals.map((g) => [g.id, g])), s, app.snapshot.goals) };
  }, [tabs, app.viewer.id, app.snapshot.goals, s.from, s.moves]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!changed?.rows.length) return null;
  const to = (k: MoveKind | 'any') => `/goals?scope=${changed.scope}&moved=${k}&since=${s.from}`;
  const n = changed.rows.length;
  return (
    <section className="block home-changed" data-part="Changed since" data-since={s.from}>
      <h2 className="block-title">{changedHeading(s.since, s.today, longDay)}</h2>
      <p className="home-counts changed-counts">
        {COUNT_ORDER.filter((k) => changed.counts[k]).map((k) => (
          <Link key={k} className="dash-count" data-moved={k} to={to(k)}>{changed.counts[k]} {MOVED_WORDS[k]}</Link>
        ))}
      </p>
      <ul className="changed-list">
        {changed.rows.slice(0, 4).map((r) => (
          <li key={r.id} className="changed-row" data-moved={r.kind}>
            <Link className="changed-title linkish" to={'/goals/' + r.id}>{r.title}</Link>
            <span className="changed-meta small">
              <span className={'changed-now tone-' + r.now}><StatusShape k={r.now} />{LABEL[r.now]}</span>
              <span className="muted"> · was {LABEL[r.was].toLowerCase()} · {r.setName}{r.early ? ' · called early by its owner' : ''}</span>
            </span>
          </li>
        ))}
      </ul>
      {n > 4 && <Link className="small linkish changed-all" to={to('any')}>All {n} in Goals</Link>}
    </section>
  );
}

/** What Home loads after its first download: Your team, Goals you watch, Changed since, or how the week's check-ins stand. */
export default function HomeSet({ set, alone = false }: { set: 'team' | 'watching' | 'changed' | 'standing'; alone?: boolean }) {
  return set === 'team' ? <YourTeam /> : set === 'watching' ? <WatchedGoals /> : set === 'changed' ? <ChangedSince /> : <StandingCell alone={alone} />;
}
