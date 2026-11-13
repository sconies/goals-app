/* People: a place for everyone (app redesign WR1, docs/design/workspace/spec.md 2.1 to 2.4). Reading is open to anyone
   in the workspace; the controls that change people and teams are shown only to admins, and the shared actions
   (savePerson, markPersonLeft, saveTeam, removeTeam) still decide.
     /people           the directory: find someone, filter by team or admins, 50 a page; admins add a person
     /people/<id>      a person: who they are, their goals by status, their reviews; admins change them
     /teams            the teams, with their leads, people and goals by status; admins add a team
     /teams/<id>       a team: its purpose, goals by status and people; admins change or remove it
   Who is listed, in what order, and the lines and counts beside each come from src/domain/directory.ts. */
// The change engine, for this screen's previews (src/app/engineReady.ts).
import '../app/engineReady';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { Place, useModules } from '../core/app';
import { reviewsOn } from '../app/reads';
import { DIRECTORY_PAGE, personLine, teamSummary } from '../domain/directory';
import { useFound } from '../app/search';
import { historyStep } from '../domain/find';
import { initials } from '../domain/via';
import { normalEmail, personProblems, sameNameNote } from '../domain/people';
import { teamMembers } from '../domain/actions';
import { LABEL, leftName } from '../domain/vocabulary';
import { statusCounts } from '../domain/order';
import type { DisplayStatus, Person, Team } from '../domain/types';
import { newId } from '../data/store';
import { Avatar, Sheet, StatusShape } from '../ui/bits';
import { BackLink } from '../ui/BackLink';
import { LeaveSheet, leaveLabel } from '../ui/RemoveSheets';
import { RemoveAdmin, useSetAdmin } from '../ui/AdminControls';
import { TokenSheet } from '../ui/AiAssistants';
import { useWidth } from '../ui/useWidth';
import { PickOne } from '../ui/Pick';
import { CountLine, FilterLine, ListBar, ListSearch, NoneFound } from '../ui/ListBar';
import type { FilterPart } from '../domain/find';

const PEOPLE = { thing: 'person', things: 'people' };
const TEAMS = { thing: 'team', things: 'teams' };

/** Below this width the filters fold into one Filter button (a phone). */
const NARROW = 620;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const firstOf = (name: string) => name.split(/\s+/)[0] ?? name;
/** The workspace's name as people read it: the example's without its "Example: " (the switcher does the same). */
const wsName = (ws: { name: string; kind?: string }) => (ws.kind === 'example' ? ws.name.replace(/^Example:\s*/, '') : ws.name);
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The title, the line under it, the one action, and the two tabs: the same on People and Teams. */
function PlaceHead({ tab, action }: { tab: 'people' | 'teams'; action?: ReactNode }) {
  const app = useApp();
  return (
    <>
      <div className="page-head row between people-head">
        <div className="stack" style={{ gap: 4 }}>
          <h1 className="title-xl">People</h1>
          <span className="hint">Everyone in {wsName(app.ws)}, and the teams they are in.</span>
        </div>
        {action}
      </div>
      <nav className="people-tabs" aria-label="People and teams">
        <Link to="/people" aria-current={tab === 'people' ? 'page' : undefined}>People · {app.snapshot.people.length}</Link>
        <Link to="/teams" aria-current={tab === 'teams' ? 'page' : undefined}>Teams · {app.snapshot.teams.length}</Link>
      </nav>
    </>
  );
}

/** A status count, shape and word, as Goals counts them: a link to those goals when there's somewhere to go. */
function Counts({ counts, to, label }: { counts: { status: DisplayStatus; n: number }[]; to?: (s: DisplayStatus) => string; label: string }) {
  return (
    <span className="team-counts people-counts" aria-label={`${label}: ${counts.map((c) => `${c.n} ${LABEL[c.status].toLowerCase()}`).join(', ')}`}>
      {counts.map((c) => {
        const body = <><StatusShape k={c.status} />{c.n} {LABEL[c.status].toLowerCase()}</>;
        return to ? <Link key={c.status} className={'team-count tone-' + c.status} to={to(c.status)}>{body}</Link> : <span key={c.status} className={'team-count tone-' + c.status}>{body}</span>;
      })}
    </span>
  );
}

/* ---------- People (/people) ---------- */

export function PeopleList() {
  const app = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [ref, width] = useWidth<HTMLDivElement>();
  const narrow = width > 0 && width < NARROW;
  const [adding, setAdding] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const admin = app.viewer.admin;
  const q = params.get('q') ?? '';
  const asked = params.get('team') ?? '';
  // A link naming a team that's gone: the filter is dropped, and said (2.1).
  const gone = !!asked && asked !== '-' && !app.team(asked);
  const teamId = gone ? '' : asked;
  const admins = params.get('admins') === '1';
  const page = Number(params.get('page') ?? 1) || 1;
  // The Search port finds them (one search and one order for People, every person picker and Find), a page at a time.
  const answer = useFound('person', { q, filters: { ...(teamId ? { team: teamId } : {}), ...(admins ? { admins: '1' } : {}) }, after: String((page - 1) * DIRECTORY_PAGE), size: DIRECTORY_PAGE });
  const found = paged(answer, page, DIRECTORY_PAGE, (id) => app.person(id));
  // A page past the end is the last page: the address follows (replacing).
  useEffect(() => { if (answer && found.page !== page && page !== 1) set({ page: found.page > 1 ? String(found.page) : null }, true); });
  const noEmail = app.snapshot.people.filter((p) => !p.email).length;
  const [emails, setEmails] = useState(params.get('emails') === '1');
  /** One history entry per choice; typing in the search replaces the entry as it goes. */
  const set = (changes: Record<string, string | null>, replace = false) => setParams((p) => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(changes)) { if (v) n.set(k, v); else n.delete(k); }
    if (!('page' in changes)) n.delete('page');
    return n;
  }, { replace });
  const filtered = !!q.trim() || !!teamId || admins;
  const teamName = teamId === '-' ? '' : app.team(teamId)?.name ?? '';
  // The filters in words, with Remove (FS2's filter line).
  const parts: FilterPart[] = [...(teamId ? [{ key: 'team', label: 'Team', values: [teamId === '-' ? 'none' : teamName] }] : []), ...(admins ? [{ key: 'admins', label: 'Admins', values: ['only'] }] : [])];
  const filters = (
    <>
      {/* The team, found by typing (FS1's find-and-pick); "no team" comes from a link (About's "in no team") and says so. */}
      {teamId === '-'
        ? <p className="field people-team small">Team: no team <button type="button" className="linkish" onClick={() => set({ team: null })}>Remove</button></p>
        : <div className="people-team"><PickOne kind="team" label="Team" none="Every team" value={teamId || null} onChange={(id) => { set({ team: id }); setFiltering(false); }} /></div>}
      <label className="check people-admins">
        <input type="checkbox" checked={admins} onChange={(e) => { set({ admins: e.target.checked ? '1' : null }); setFiltering(false); }} />
        <span>Admins only</span>
      </label>
    </>
  );
  return (
    <div className="page people-page" ref={ref}>
      <PlaceHead tab="people" action={admin && <button type="button" className="btn primary" onClick={() => setAdding(true)}>Add a person</button>} />
      {/* The list bar (FS2): the search, the filters (one Filter button on a phone), then the count and filter lines. */}
      <ListBar search={<ListSearch value={q} onSearch={(t, change) => set({ q: t || null }, historyStep(change) === 'replace')} label="Find a person" placeholder="Find by name, job title or team" autoFocus />}>
        {narrow
          ? <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setFiltering(true)}>Filter{parts.length ? ` · ${parts.length}` : ''}</button>
          : filters}
      </ListBar>
      {gone && <p className="hint" role="note">That team isn’t here any more.</p>}
      {admin && noEmail > 0 && (
        <p className="people-emails small">{plural(noEmail, 'person has', 'people have')} no email yet. <button type="button" className="linkish" onClick={() => setEmails(true)}>Add them</button></p>
      )}
      {answer && !answer.stale && <CountLine things={PEOPLE} n={found.total} narrowed={filtered} order="A to Z" shown={found.total > DIRECTORY_PAGE ? { from: found.from, to: found.to } : null} />}
      <FilterLine parts={parts} onRemove={(key) => set({ [key]: null })} onClear={() => set({ team: null, admins: null })} />
      {answer && !answer.stale && !found.total && <NoneFound things={PEOPLE} q={q} filtered={!!teamId || admins} onClearSearch={() => set({ q: null })} onClearFilters={() => set({ team: null, admins: null })} />}
      {found.total > 0 && (
        <ul className="people-list" aria-label="People">
          {found.rows.map((p) => <li key={p.id}><PersonRow p={p} /></li>)}
        </ul>
      )}
      {found.pages > 1 && (
        <nav className="people-pages row" aria-label="Pages">
          <span className="hint">{found.from} to {found.to} of {found.total}</span>
          {found.page > 1 && <Link className="btn sm" to={`?${pageParams(params, found.page - 1)}`}>Previous {DIRECTORY_PAGE}</Link>}
          {found.page < found.pages && <Link className="btn sm" to={`?${pageParams(params, found.page + 1)}`}>Next {Math.min(DIRECTORY_PAGE, found.total - found.to)}</Link>}
        </nav>
      )}
      <Sheet open={filtering} onClose={() => setFiltering(false)} title="Filter">
        <div className="stack" style={{ gap: 'var(--s4)' }}>{filters}</div>
      </Sheet>
      {emails && <Sheet open onClose={() => { setEmails(false); if (params.get('emails')) set({ emails: null }, true); }} title="Add missing emails"><MissingEmails /></Sheet>}
      {adding && <PersonSheet person={null} onClose={() => setAdding(false)} onSaved={(id) => void nav(`/people/${encodeURIComponent(id)}`)} />}
    </div>
  );
}

/** A page of the Search port's answer as a list draws it: the things themselves, where it is, and how many pages. */
function paged<T>(a: { total: number; rows: { id: string }[] } | null, page: number, size: number, thing: (id: string) => T | undefined) {
  const total = a?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const at = Math.min(Math.max(1, page), pages);
  const rows = (a?.rows ?? []).map((r) => thing(r.id)).filter((x): x is T => !!x);
  const from = rows.length ? (at - 1) * size + 1 : 0;
  return { total, page: at, pages, from, to: from ? from + rows.length - 1 : 0, rows };
}

/* Held at company size (N12): a row reads only its own person's or team's goals and people, grouped once per workspace
   as loaded, not by scanning every goal for every row. The rules (personLine, teamSummary) are unchanged. */
type Snap = ReturnType<typeof useApp>['snapshot'];
const indexes = new WeakMap<Snap, { byOwner: Map<string, Snap['goals']>; byTeam: Map<string, Snap['goals']>; peopleIn: Map<string, Snap['people']> }>();
function indexOf(s: Snap) {
  let x = indexes.get(s);
  if (!x) {
    const group = <T,>(xs: T[], key: (v: T) => string | null | undefined) => { const m = new Map<string, T[]>(); for (const v of xs) { const k = key(v); if (k) { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); } } return m; };
    x = { byOwner: group(s.goals, (g) => g.ownerId), byTeam: group(s.goals, (g) => g.teamId), peopleIn: group(s.people, (p) => p.teamId) };
    indexes.set(s, x);
  }
  return x;
}
/** A team's summary context cut to that team: its goals, its people and its lead. */
function slice<C extends { snapshot: Snap }>(ctx: C, teamId: string): C {
  const ix = indexOf(ctx.snapshot);
  const team = ctx.snapshot.teams.find((t) => t.id === teamId);
  const lead = team ? ctx.snapshot.people.find((p) => p.id === team.leadId) : undefined;
  const people = ix.peopleIn.get(teamId) ?? [];
  return { ...ctx, snapshot: { ...ctx.snapshot, teams: team ? [team] : [], goals: ix.byTeam.get(teamId) ?? [], people: lead && !people.includes(lead) ? [...people, lead] : people } };
}

const pageParams = (params: URLSearchParams, page: number) => { const n = new URLSearchParams(params); if (page > 1) n.set('page', String(page)); else n.delete('page'); return n.toString(); };

/** A person in a list: a link to them, with their job title and team, and their line (rule 5). */
function PersonRow({ p }: { p: Person }) {
  const app = useApp();
  const team = p.teamId ? app.team(p.teamId)?.name : '';
  return (
    <Link className="people-row" to={`/people/${encodeURIComponent(p.id)}`}>
      <Avatar p={p} size="sm" />
      <span className="person-text">
        <span className="person-name">{app.personName(p.id)}</span>
        <span className="hint">{[p.role, team || 'No team'].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="people-line small">{personLine({ snapshot: { ...app.snapshot, people: [p], goals: indexOf(app.snapshot).byOwner.get(p.id) ?? [] } }, p.id)}</span>
    </Link>
  );
}

/* ---------- A person (/people/<id>) ---------- */

export function PersonPage() {
  const app = useApp();
  const reviewsHere = reviewsOn(useModules().on);
  const { personId = '' } = useParams();
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [token, setToken] = useState(false);
  const setAdmin = useSetAdmin();
  const p = app.person(personId);
  if (!p || p.removedAt) {
    return (
      <div className="page narrow person-page">
        <BackLink to="/people" label="People" />
        <h1 className="title-xl">That person isn’t in {wsName(app.ws)}.</h1>
        <p><Link to="/people">See everyone</Link></p>
      </div>
    );
  }
  const left = !!p.leftAt;
  const you = p.id === app.viewer.id;
  const first = firstOf(p.name);
  const goals = app.snapshot.goals.filter((g) => g.ownerId === p.id);
  const counts = statusCounts(goals.map((g) => app.statusOf(g).status));
  const team = p.teamId ? app.team(p.teamId) : undefined;
  const leads = app.snapshot.teams.filter((t) => t.leadId === p.id && t.id !== p.teamId).sort((a, b) => a.name.localeCompare(b.name));
  // A person's reviews only while Reviews is on (FT2).
  const reviews = reviewsHere ? app.snapshot.reviews.filter((r) => !r.endedAt) : [];
  const runs = reviews.filter((r) => r.createdBy === p.id);
  const inThem = reviews.filter((r) => r.createdBy !== p.id && r.people.includes(p.id));
  const reviewLink = (r: { id: string; name: string }) => <Link key={r.id} to={`/reviews/${encodeURIComponent(r.id)}`}>{r.name}</Link>;
  const joined = (xs: ReactNode[]) => xs.flatMap((x, i) => (i === 0 ? [x] : [i === xs.length - 1 ? ' and ' : ', ', x]));
  const see = goals.length === 0 ? null : you ? (goals.length === 1 ? 'See your goal' : `See your ${goals.length} goals`) : goals.length === 1 ? `See ${first}’s goal` : `See ${first}’s ${goals.length} goals`;
  return (
    <div className="page narrow person-page">
      <BackLink to="/people" label="People" />
      <div className="page-head row between person-head">
        <div className="row person-who">
          <Avatar p={p} size="lg" />
          <span className="stack" style={{ gap: 2, minWidth: 0 }}>
            <h1 className="title-xl">{left && !p.name.endsWith(leftName('')) ? leftName(p.name) : p.name}</h1>
            {left ? <span className="hint">Left {wsName(app.ws)} on {dateOf(p.leftAt!)}. Their history stays.</span> : p.role ? <span className="hint">{p.role}</span> : null}
          </span>
        </div>
        {see && !left && <Link className="btn primary" to={`/goals?owner=${encodeURIComponent(p.id)}`}>{see}</Link>}
      </div>
      {!left && (
        <dl className="facts person-facts">
          <dt>Team</dt>
          <dd>{team ? <><Link to={`/teams/${encodeURIComponent(team.id)}`}>{team.name}</Link>{team.leadId === p.id ? `, which ${you ? 'you lead' : `${first} leads`}` : ''}</> : 'No team.'}{leads.length > 0 && <> Also leads {joined(leads.map((t) => <Link key={t.id} to={`/teams/${encodeURIComponent(t.id)}`}>{t.name}</Link>))}.</>}</dd>
          <dt>Email</dt>
          <dd>{p.email || 'Not added yet.'}</dd>
          <dt>Role here</dt>
          <dd>{p.admin ? 'Admin.' : 'Member.'} Admins change people, teams and settings.</dd>
          <dt>Goals</dt>
          <dd>{counts.length ? <Counts counts={counts} label={`${p.name}’s goals`} to={(s) => `/goals?owner=${encodeURIComponent(p.id)}&status=${s}`} /> : 'Owns no goals this year.'}</dd>
          {(runs.length > 0 || inThem.length > 0) && <>
            <dt>Reviews</dt>
            <dd>{runs.length > 0 && <>Runs the {joined(runs.map(reviewLink))}</>}{runs.length > 0 && inThem.length > 0 && '; in the '}{runs.length === 0 && inThem.length > 0 && 'In the '}{joined(inThem.map(reviewLink))}.</dd>
          </>}
        </dl>
      )}
      <Place name="people.person" person={p} />
      {app.viewer.admin && !left && (
        <section className="people-admin stack" aria-labelledby="person-admin">
          <h2 className="label" id="person-admin">For admins</h2>
          <div className="row people-admin-actions">
            <button type="button" className="btn" onClick={() => setEditing(true)}>Change details</button>
            {p.admin ? <RemoveAdmin p={p} quiet={false} setAdmin={setAdmin} /> : <button type="button" className="btn" onClick={() => void setAdmin(p, true)}>Make an admin</button>}
            {app.mode === 'live' && <button type="button" className="btn" onClick={() => setToken(true)}>Make an MCP token</button>}
          </div>
          {you ? <p className="hint">To leave, use <Link to="/settings">Settings</Link>.</p> : <div className="people-admin-quiet"><button type="button" className="btn ghost" onClick={() => setLeaving(true)}>{leaveLabel(app, p)}…</button></div>}
        </section>
      )}
      {editing && <PersonSheet person={p} onClose={() => setEditing(false)} />}
      {leaving && <LeaveSheet person={p} onClose={() => setLeaving(false)} />}
      {token && <TokenSheet personId={p.id} onClose={() => setToken(false)} />}
    </div>
  );
}

/* ---------- Teams (/teams) ---------- */

export function TeamsList() {
  const app = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1) || 1;
  const answer = useFound('team', { q, after: String((page - 1) * DIRECTORY_PAGE), size: DIRECTORY_PAGE });
  const shown = paged(answer, page, DIRECTORY_PAGE, (id) => app.team(id));
  const found = shown.rows;
  useEffect(() => { if (answer && shown.page !== page && page !== 1) setParams((p) => { const n = new URLSearchParams(p); if (shown.page > 1) n.set('page', String(shown.page)); else n.delete('page'); return n; }, { replace: true }); });
  const ctx = { snapshot: app.snapshot, statusOf: (g: Parameters<typeof app.statusOf>[0]) => app.statusOf(g).status };
  return (
    <div className="page people-page">
      <PlaceHead tab="teams" action={app.viewer.admin && <button type="button" className="btn primary" onClick={() => setAdding(true)}>Add a team</button>} />
      <ListBar search={<ListSearch value={q} onSearch={(t, change) => setParams((p) => { const n = new URLSearchParams(p); if (t) n.set('q', t); else n.delete('q'); n.delete('page'); return n; }, { replace: historyStep(change) === 'replace' })} label="Find a team" placeholder="Find a team or its lead" />} />
      {!app.snapshot.teams.length ? <p className="hint" role="status">No teams yet.</p> : answer && !answer.stale && <CountLine things={TEAMS} n={shown.total} narrowed={!!q.trim()} order="A to Z" shown={shown.total > DIRECTORY_PAGE ? { from: shown.from, to: shown.to } : null} />}
      {!!app.snapshot.teams.length && answer && !answer.stale && !shown.total && <NoneFound things={TEAMS} q={q} filtered={false} onClearSearch={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('q'); return n; })} onClearFilters={() => undefined} />}
      {found.length > 0 && (
        <ul className="people-list team-list" aria-label="Teams">
          {found.map((t) => {
            const s = teamSummary(slice(ctx, t.id), t.id);
            return (
              <li key={t.id}>
                <Link className="people-row team-row" to={`/teams/${encodeURIComponent(t.id)}`}>
                  <span className="person-text">
                    <span className="person-name">{t.name}</span>
                    <span className="hint">{[s.lead ? `Led by ${s.lead.name}` : 'No lead', plural(s.people.length, 'person', 'people')].join(' · ')}</span>
                  </span>
                  {s.byStatus.length ? <Counts counts={s.byStatus} label={`${t.name}’s goals`} /> : <span className="people-line small">No goals this year.</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {shown.pages > 1 && (
        <nav className="people-pages row" aria-label="Pages">
          <span className="hint">{shown.from} to {shown.to} of {shown.total}</span>
          {shown.page > 1 && <Link className="btn sm" to={`?${pageParams(params, shown.page - 1)}`}>Previous {DIRECTORY_PAGE}</Link>}
          {shown.page < shown.pages && <Link className="btn sm" to={`?${pageParams(params, shown.page + 1)}`}>Next {Math.min(DIRECTORY_PAGE, shown.total - shown.to)}</Link>}
        </nav>
      )}
      {adding && <TeamSheet team={null} onClose={() => setAdding(false)} onSaved={(id) => void nav(`/teams/${encodeURIComponent(id)}`)} />}
    </div>
  );
}

/* ---------- A team (/teams/<id>) ---------- */

/** How many of a team's people its page shows before "Show all". */
const TEAM_PEOPLE = 8;

export function TeamPage() {
  const app = useApp();
  const { teamId = '' } = useParams();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const t = app.team(teamId);
  if (!t) {
    return (
      <div className="page narrow person-page">
        <BackLink to="/teams" label="Teams" />
        <h1 className="title-xl">That team isn’t in {wsName(app.ws)}.</h1>
        <p><Link to="/teams">See every team</Link></p>
      </div>
    );
  }
  const admin = app.viewer.admin;
  const s = teamSummary({ snapshot: app.snapshot, statusOf: (g) => app.statusOf(g).status }, t.id);
  const people = [...s.people].sort((a, b) => Number(b.id === t.leadId) - Number(a.id === t.leadId) || a.name.localeCompare(b.name));
  return (
    <div className="page narrow person-page team-page">
      <BackLink to="/teams" label="Teams" />
      <div className="page-head row between person-head">
        <span className="stack" style={{ gap: 2, minWidth: 0 }}>
          <h1 className="title-xl">{t.name}</h1>
          <span className="hint">{s.lead ? <>Led by <Link to={`/people/${encodeURIComponent(s.lead.id)}`}>{s.lead.name}</Link></> : 'No lead'} · {plural(s.people.length, 'person', 'people')} · {plural(s.goals.length, 'goal', 'goals')} this year</span>
        </span>
        {s.goals.length > 0 && <Link className="btn primary" to={`/goals?team=${encodeURIComponent(t.id)}`}>{s.goals.length === 1 ? 'See its goal' : `See its ${s.goals.length} goals`}</Link>}
      </div>
      {(t.objective || admin) && (
        <section className="stack team-purpose" style={{ gap: 4 }} aria-labelledby="team-purpose">
          <h2 className="label" id="team-purpose">What it is here to do</h2>
          {t.objective ? <p>{t.objective}</p> : <p className="hint">Not said yet. <button type="button" className="linkish" onClick={() => setEditing(true)}>Add it</button></p>}
        </section>
      )}
      <section className="stack" style={{ gap: 4 }} aria-labelledby="team-goals">
        <h2 className="label" id="team-goals">Goals</h2>
        {s.byStatus.length ? <Counts counts={s.byStatus} label={`${t.name}’s goals`} to={(k) => `/goals?team=${encodeURIComponent(t.id)}&status=${k}`} /> : <p className="hint">No goals this year.</p>}
      </section>
      <section className="stack" style={{ gap: 'var(--s2)' }} aria-labelledby="team-people">
        <h2 className="label" id="team-people">People · {people.length}</h2>
        {!people.length ? <p className="hint">No one is in {t.name} yet.</p> : (
          <ul className="people-list" aria-label={`${t.name}’s people`}>
            {people.slice(0, TEAM_PEOPLE).map((p) => <li key={p.id}><PersonRow p={p} /></li>)}
          </ul>
        )}
        {people.length > TEAM_PEOPLE && <p><Link to={`/people?team=${encodeURIComponent(t.id)}`}>Show all {people.length}</Link></p>}
      </section>
      <Place name="people.team" team={t} />
      {admin && (
        <section className="people-admin stack" aria-labelledby="team-admin">
          <h2 className="label" id="team-admin">For admins</h2>
          <div className="row"><button type="button" className="btn" onClick={() => setEditing(true)}>Change its name, lead or purpose</button></div>
          <div className="people-admin-quiet"><button type="button" className="btn ghost" onClick={() => setRemoving(true)}>Remove this team…</button></div>
        </section>
      )}
      {editing && <TeamSheet team={t} onClose={() => setEditing(false)} />}
      {removing && <RemoveTeamSheet team={t} onClose={() => setRemoving(false)} />}
    </div>
  );
}

/* ---------- the sheets admins change people and teams with ---------- */

export function TeamSheet({ team, onClose, onSaved }: { team: Team | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const app = useApp();
  const [name, setName] = useState(team?.name ?? '');
  const [leadId, setLeadId] = useState(team?.leadId ?? '');
  const [objective, setObjective] = useState(team?.objective ?? '');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const clean = name.trim().replace(/\s+/g, ' ');
  const dup = app.snapshot.teams.find((t) => t.id !== team?.id && !!clean && t.name.trim().toLowerCase() === clean.toLowerCase());
  const save = async () => {
    setTried(true);
    if (!clean || dup || busy) return;
    setBusy(true);
    try {
      const id = await app.saveTeam({ id: team?.id, name, leadId: leadId || null, objective });
      app.toast(team ? (team.name !== clean ? `Renamed to ${clean}` : 'Saved') : `Added ${clean}`);
      onClose();
      onSaved?.(id);
    } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={team ? `Change ${team.name}` : 'Add a team'}>
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <div className="field">
          <label className="field"><span className="field-label">Team name</span>
            <input className={'input' + (tried && (!clean || dup) ? ' invalid' : '')} aria-invalid={tried && (!clean || !!dup) ? true : undefined} autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {tried && !clean && <span className="hint tone-off" role="alert">Give the team a name.</span>}
          {tried && dup && <span className="hint tone-off" role="alert">There’s already a team called {dup.name}.</span>}
        </div>
        <PickOne kind="person" label="Team lead (optional)" none="No lead" value={leadId || null} onChange={(id) => setLeadId(id ?? '')} />
        <label className="field"><span className="field-label">What it is here to do <span className="hint">optional</span></span>
          <textarea className="input" rows={2} maxLength={280} value={objective} onChange={(e) => setObjective(e.target.value)} />
        </label>
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary big-btn" type="submit">{busy ? 'Saving…' : team ? 'Save' : 'Add the team'}</button></div>
      </form>
    </Sheet>
  );
}

/** Removing a team: an empty one goes at once; one with people or goals moves them to another team in the same save. */
function RemoveTeamSheet({ team, onClose }: { team: Team; onClose: () => void }) {
  const app = useApp();
  const nav = useNavigate();
  const m = teamMembers({ snapshot: app.snapshot, allGoals: app.allGoals }, team.id);
  const others = app.snapshot.teams.filter((t) => t.id !== team.id);
  const [to, setTo] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const has = [m.people.length ? plural(m.people.length, 'person', 'people') : '', m.goals.length ? plural(m.goals.length, 'goal', 'goals') : ''].filter(Boolean).join(' and ');
  const go = async () => {
    setTried(true);
    if ((has && !to) || busy) return;
    setBusy(true);
    try {
      const dest = app.team(to)?.name;
      await app.removeTeam(team.id, to || null);
      app.toast(has ? `Removed ${team.name}, and moved ${has} to ${dest}` : `Removed ${team.name}`);
      onClose();
      void nav('/teams');
    } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={`Remove ${team.name}`}>
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void go(); }} noValidate>
        {!has ? <p className="small">No one is in {team.name} and it has no goals, so it can go. The change log keeps a note of it.</p> : !others.length ? (
          <p className="small">{team.name} has {has}. Add another team to move them to first: every goal belongs to a team.</p>
        ) : (
          <>
            <p className="small">{team.name} has {has}{m.goals.some((g) => g.cycleId !== app.cycle.id) ? ', some in earlier cycles' : ''}. They move to another team first, in the same step, and each goal’s history says so.</p>
            <div className="field">
              <PickOne kind="team" label="Move them to" value={to || null} onChange={(id) => setTo(id ?? '')} hide={[team.id]} invalid={tried && !to} />
              {tried && !to && <span className="hint tone-off" role="alert">Choose where they go.</span>}
            </div>
          </>
        )}
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button>{(!has || others.length > 0) && <button className="btn danger big-btn" type="submit">{busy ? 'Removing…' : has ? 'Move them and remove' : 'Remove the team'}</button>}</div>
      </form>
    </Sheet>
  );
}

/**
 * For admins: the people added before everyone had an email. An email tells two people with the same name apart, in the
 * app, in a spreadsheet and through MCP. Typed here and saved together, through the bulk-change engine.
 */
function MissingEmails() {
  const app = useApp();
  const missing = app.snapshot.people.filter((p) => !p.email);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(20);
  if (!missing.length) return <p className="hint">Everyone here has an email.</p>;
  const filled = missing.filter((p) => (typed[p.id] ?? '').trim());
  const save = async () => {
    if (!filled.length) { setProblems({ '': 'Type at least one email first.' }); return; }
    const rows = filled.map((p, i) => ({ __row: String(i + 2), id: p.id, email: typed[p.id]!.trim() }));
    const cs = app.previewChanges({ people: rows }, 'bulk');
    const errs = cs.issues.filter((x) => x.severity === 'error');
    if (errs.length) { setProblems(Object.fromEntries(errs.map((x) => [filled[x.row - 2]?.id ?? '', x.message]))); return; }
    setBusy(true);
    try {
      await app.applyChanges(cs);
      app.toast(`Saved ${filled.length} ${filled.length === 1 ? 'email' : 'emails'}`);
      setTyped({});
      setProblems({});
    } catch { /* the save already said what went wrong */ }
    setBusy(false);
  };
  return (
    <section className="missing-emails stack" aria-labelledby="missing-emails" style={{ gap: 'var(--s2)' }}>
      <h3 id="missing-emails" className="label">People without an email · {missing.length}</h3>
      <p className="hint">An email tells two people with the same name apart, in the app, in spreadsheets and through MCP. Everyone added now has one; add these when you can.</p>
      <ul className="record email-list">
        {missing.slice(0, limit).map((p) => (
          <li key={p.id} className="email-row">
            <label className="field">
              <span className="small"><span className="strong">{p.name}</span>{p.role ? <span className="muted"> · {p.role}</span> : null}</span>
              <input className={'input' + (problems[p.id] ? ' invalid' : '')} aria-invalid={problems[p.id] ? true : undefined} type="email" autoComplete="off" aria-label={`${p.name}: email`} placeholder="name@company.com" value={typed[p.id] ?? ''} onChange={(e) => setTyped({ ...typed, [p.id]: e.target.value })} />
            </label>
            {problems[p.id] && <span className="hint tone-off" role="alert">{problems[p.id]}</span>}
          </li>
        ))}
      </ul>
      {missing.length > limit && <button type="button" className="linkish small" onClick={() => setLimit((n) => n + 20)}>Show {Math.min(20, missing.length - limit)} more</button>}
      {problems[''] && <span className="hint tone-off" role="alert">{problems['']}</span>}
      <div><button type="button" className="btn" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : filled.length ? `Save ${filled.length} ${filled.length === 1 ? 'email' : 'emails'}` : 'Save emails'}</button></div>
    </section>
  );
}

/** Adding a person, or changing one (admins): name, email, job title and team. Making them an admin is on their page
    and on Workspace, Access (WR3); marking someone as left is on their page. */
export function PersonSheet({ person, onClose, onSaved }: { person: Person | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const app = useApp();
  const [p, setP] = useState<Person>(person ?? { id: newId('p'), name: '', role: '', initials: '', teamId: app.viewer.teamId ?? app.snapshot.teams[0]?.id ?? null, admin: false, email: '' });
  const [tried, setTried] = useState(false);
  // A shared name is allowed (the email is who someone is), and said, so a second record for one person is noticed.
  const twin = sameNameNote(p, app.snapshot.people, (id) => app.team(id)?.name ?? '');
  // An email is needed for anyone new; someone added before emails existed can be saved without one until it's known.
  const clean: Person = { ...p, name: p.name.trim(), role: p.role.trim(), initials: initials(p.name.trim()), ...(normalEmail(p.email) ? { email: normalEmail(p.email) } : person?.email ? {} : { email: undefined }) };
  const emailProblem = personProblems(clean, app.snapshot.people, person).find((x) => /email/i.test(x));
  const save = async () => {
    setTried(true);
    if (personProblems(clean, app.snapshot.people, person).length) return;
    await app.savePerson(clean, person);
    app.toast(person ? 'Saved' : `Added ${p.name.trim()}`);
    onClose();
    onSaved?.(clean.id);
  };
  return (
    <Sheet open onClose={onClose} title={person ? `Change ${person.name}` : 'Add a person'}>
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <div className="field">
          <label className="field"><span className="field-label">Name</span>
            <input className={'input' + (tried && !p.name.trim() ? ' invalid' : '')} aria-invalid={tried && !p.name.trim() ? true : undefined} autoFocus={!person} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          </label>
          {tried && !p.name.trim() && <span className="hint tone-off" role="alert">Add a name.</span>}
          {twin && <span className="hint tone-risk" role="status">{twin}</span>}
        </div>
        <div className="field">
          <label className="field"><span className="field-label">Email{person && !person.email ? <span className="hint"> not added yet</span> : null}</span>
            <input className={'input' + (tried && emailProblem ? ' invalid' : '')} aria-invalid={tried && emailProblem ? true : undefined} type="email" autoComplete="off" value={p.email ?? ''} onChange={(e) => setP({ ...p, email: e.target.value })} placeholder="name@company.com" />
          </label>
          {tried && emailProblem && <span className="hint tone-off" role="alert">{emailProblem}</span>}
        </div>
        <label className="field"><span className="field-label">Job title <span className="hint">optional</span></span>
          <input className="input" value={p.role} onChange={(e) => setP({ ...p, role: e.target.value })} />
        </label>
        <PickOne kind="team" label="Team" none="No team" value={p.teamId} onChange={(id) => setP({ ...p, teamId: id })} />
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary big-btn" type="submit">{person ? 'Save' : 'Add'}</button></div>
      </form>
    </Sheet>
  );
}
