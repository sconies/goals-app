/* Your team, Goals you watch, and teams worst first (docs/design/home/spec.md 2.1 parts 7 and 7b, "Teams, worst first";
   rule 4). Loaded after Home's first download (they sit below the lead), so it stays within its budget. The sets are the Goals scopes (domain/homeSets.ts),
   worked out from the facts the Goals tabs read (app/reads scopeFacts). No person's name is in the teams table: teams
   and goals are ranked, never people. Its "Since" column comes with "Changed since" (rule 5, HM4); until then the table
   has three columns. */
import { useMemo } from 'react';
import { Link } from 'react-router';
import { useModules } from '../core/app';
import { scopeFacts, watchingOn } from '../app/reads';
import { useApp } from '../app/state';
import { scopesFor } from '../domain/goalsPage';
import { attentionOrder } from '../domain/attention';
import { asTeams, groupWatched } from '../domain/home';
import { homeSets, type SetFacts, type Sets, type TeamRow } from '../domain/homeSets';
import { watchedGoals } from '../domain/review';
import { statusChange } from '../domain/tree';
import { ATTENTION, LABEL } from '../domain/vocabulary';
import { AttentionCard, StatusShape } from './bits';
import { GoalRow } from './goalRows';
import { HandledGroup } from './HandledGroup';

/** Five teams, then "{k} more teams, {j} need attention" to the scope by team. */
export const TEAMS_SHOWN = 5;

/** Home's sets (rule 4): exactly the Goals scopes, so each block's total is its tab's count. */
function useHomeSets(): Sets {
  const { snapshot, viewer, attentionOf } = useApp();
  const watching = watchingOn(useModules().on);
  return useMemo(() => {
    const facts = scopeFacts(snapshot, viewer);
    // Every scope, drawn as a tab or not (as find_goals reads them): in a one-team workspace My team waits on Goals,
    // being the same list as All, but its goals that need attention still belong on Home (review of #468, medium).
    const { every } = scopesFor(facts, null, { watching });
    const ids = new Set(every.filter((t) => t.id !== 'all').flatMap((t) => t.ids));
    const attention = snapshot.goals.filter((g) => ids.has(g.id)).map((g) => attentionOf(g));
    return homeSets({ id: viewer.id, teams: facts.teams }, every, attention, snapshot.teams);
  }, [snapshot, viewer, attentionOf, watching]);
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
 * Your team (part 7): the Goals page's My team scope, when it holds a goal you don't own. Its counts open exactly those
 * goals; then the goals that need attention and aren't yours (up to four, each with its owner's name first, no button),
 * or the teams worst first when the scope spans three or more.
 */
export function YourTeam() {
  const app = useApp();
  const set = useHomeSets().team;
  if (!set) return null;
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
        ? <TeamsTable teams={set.teams} scope="team" goalsWord="Its goals in your teams" />
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
      <TeamsTable teams={set.teams} scope="watching" goalsWord="Its goals you watch" />
      <HandledGroup list={set.handled} folded />
    </section>
  );
}

export function TeamsTable({ teams, scope, goalsWord }: { teams: TeamRow[]; scope: 'team' | 'watching'; goalsWord: string }) {
  const shown = teams.slice(0, TEAMS_SHOWN);
  const more = teams.slice(TEAMS_SHOWN);
  const at = (t: TeamRow, extra = '') => `/goals?scope=${scope}&team=${encodeURIComponent(t.teamId)}${extra}`;
  const moreNeeds = more.reduce((n, t) => n + t.needs, 0);
  return (
    <div className="home-teams">
      <table className="teams-table">
        <thead>
          <tr><th scope="col">Team</th><th scope="col">{ATTENTION.needs.label}</th><th scope="col">{goalsWord}</th></tr>
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

/** What Home loads after its first download: Your team, or Goals you watch. */
export default function HomeSet({ set }: { set: 'team' | 'watching' }) {
  return set === 'team' ? <YourTeam /> : <WatchedGoals />;
}
