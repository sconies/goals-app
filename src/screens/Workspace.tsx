/* Workspace, in sections (backlog W, Lane, 8 Nov: "The workspace is too busy. It needs sections so you can actually
   manage it."). Each section has its own address, /workspace/<section>, and one main action; a side menu on a
   computer, a list on a phone:
     Overview          the name, switching workspaces, counts that lead to each section, and deleting it (admins)
     People            the directory: find someone, add a person (admins), people without an email (admins)
     Teams             find a team, with its lead and counts; add, rename and remove (admins)
     Inbox             markups and feedback, open to anyone, worked like an inbox (src/markup/Inbox.tsx)
     Privacy (what the app records): everyone reads it; only admins switch it.
     Cycles, Access (admins and AI tokens), Features, Recently removed: admins only.
   People who aren't admins see Overview, People, Teams, Inbox and Privacy. Sections are the settings extension point: a module
   adds its own (AppModule `sections`, src/core/app.tsx). Old addresses (/workspace?inbox=1&markup=…, #people) lead to
   the section they meant. */
import { nameLength, nameProblem } from '../domain/thresholds';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';
import { useSwitchWorkspace } from '../ui/WorkspaceSwitch';
import { useApp } from '../app/state';
import { useModules, type WorkspaceSection } from '../core/app';
import { placeSections } from '../core/module';
import { initials } from '../domain/importer';
import { normalEmail, personProblems, sameNameNote } from '../domain/people';
import type { Person, Team } from '../domain/types';
import { teamMembers, teamPeople } from '../domain/actions';
import { newId } from '../data/store';
import { useInboxData, type InboxData } from '../markup/inboxData';
import { Avatar, Sheet } from '../ui/bits';
import { AiAssistants } from '../ui/AiAssistants';
import { Icon } from '../ui/Icon';
import { LeaveSheet, leaveLabel, LeaveWorkspaceSheet } from '../ui/RemoveSheets';
import { CycleList, RecentlyRemoved } from '../ui/RecentlyRemoved';
import { useWidth } from '../ui/useWidth';

/** Below this width, Workspace is a list of sections and one section at a time (a phone). */
const NARROW = 720;

/** The core's sections, in menu order. A module's sections follow the one they name in `after`, or come last. */
const CORE: WorkspaceSection[] = [
  { id: 'overview', label: 'Overview', summary: 'The workspace’s name, what’s in it, and switching to another.', element: <OverviewSection /> },
  { id: 'people', label: 'People', summary: 'Everyone in the workspace: find someone, or add a person.', element: <PeopleSection /> },
  { id: 'teams', label: 'Teams', summary: 'The teams, with their leads and how many people and goals each has.', element: <TeamsSection /> },
  { id: 'cycles', label: 'Cycles', summary: 'The workspace’s cycles. One nobody has checked in to can be deleted.', admins: true, element: <CyclesSection /> },
  { id: 'access', label: 'Access', summary: 'Who the admins are, and the tokens AI assistants use.', admins: true, element: <AccessSection /> },
  { id: 'features', label: 'Features', summary: 'Parts of Faro this workspace uses, each switched on or off for everyone.', admins: true, element: <FeaturesSection /> },
  // Everyone can read what is recorded about them; only admins switch it (re-review, 8 Nov, backlog T).
  { id: 'privacy', label: 'Privacy', summary: 'What the app records about how it’s used here. Admins switch it on or off.', element: <PrivacySection /> },
  { id: 'removed', label: 'Recently removed', summary: 'Anything removed in the last 30 days, with Restore.', admins: true, element: <RemovedSection /> },
];

/** Old anchors on the one-page Workspace, and the section each now is. */
const ANCHORS: Record<string, string> = { people: 'people', teams: 'teams', cycles: 'cycles', ai: 'access', tokens: 'access', access: 'access', features: 'features', recording: 'privacy', privacy: 'privacy', removed: 'removed' };

/** The sections someone sees, in order: the core's and the modules' that are on; admins-only ones for admins. */
export function useSections(): WorkspaceSection[] {
  const app = useApp();
  const { screens } = useModules();
  return placeSections(CORE, screens.flatMap((m) => m.sections ?? [])).filter((s) => !s.admins || app.viewer.admin);
}

interface Ctx { inbox: InboxData; narrow: boolean; sections: WorkspaceSection[]; all: WorkspaceSection[] }
const WsCtx = createContext<Ctx | null>(null);
const useWs = () => useContext(WsCtx)!;

export function WorkspaceHome({ section }: { section?: string }) {
  const app = useApp();
  const { search, hash } = useLocation();
  const [ref, width] = useWidth<HTMLDivElement>();
  const inbox = useInboxData();
  const sections = useSections();
  const { screens } = useModules();
  const all = [...CORE, ...screens.flatMap((m) => m.sections ?? [])];
  const narrow = width > 0 && width < NARROW;
  // Old addresses: the inbox's (from a GitHub issue) and the one-page Workspace's anchors.
  if (!section) {
    const q = new URLSearchParams(search);
    const markup = q.get('markup');
    if (q.get('inbox') || markup || hash === '#inbox') return <Navigate to={`/feedback${markup ? `?markup=${encodeURIComponent(markup)}` : ''}`} replace />;
    const anchor = ANCHORS[hash.replace('#', '')];
    if (anchor) return <Navigate to={`/workspace/${anchor}`} replace />;
  }
  const id = section ?? 'overview';
  const here = all.find((s) => s.id === id);
  const shown = sections.find((s) => s.id === id);
  const body = !here ? null : shown ? here.element : <AdminsOnly label={here.label} />;
  const ctx: Ctx = { inbox, narrow, sections, all };
  return (
    <WsCtx.Provider value={ctx}>
      <div className={'page workspace ws-' + id + (narrow ? ' ws-narrow' : '')} ref={ref}>
        {narrow && section ? (
          <div className="page-head wsp-head">
            <Link className="backlink" to="/workspace"><Icon name="chevron-left" /><span className="ellipsis">Workspace</span></Link>
            <h1 className="title-xl">{here?.label ?? 'Workspace'}</h1>
          </div>
        ) : (
          <div className="page-head wsp-head">
            <h1 className="title-xl">Workspace</h1>
            <span className="hint">{app.mode === 'demo' ? 'The example, and any you set up here to try it. All of it stays in this browser.' : 'Each workspace has its own people, teams, goals, cycle and change log.'}</span>
          </div>
        )}
        {narrow && !section ? <SectionList /> : narrow ? <div className="ws-body">{body}</div> : (
          <div className="ws-layout">
            <nav className="ws-menu" aria-label="Workspace sections"><SectionLinks current={id} /></nav>
            <div className="ws-body">{body}</div>
          </div>
        )}
      </div>
    </WsCtx.Provider>
  );
}

/** What a section's entry says beside its name, as plain text: how many people and teams, how many new in the inbox. */
function useNotes(): Record<string, string> {
  const app = useApp();
  return {
    people: String(app.snapshot.people.length),
    teams: String(app.snapshot.teams.length),
  };
}

/** What each section's row on the overview says: one true line each, for every section this person sees (backlog WS). */
function useSays(): Record<string, string> {
  const app = useApp();
  const { installed, on } = useModules();
  const admin = app.viewer.admin;
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const noEmail = app.snapshot.people.filter((p) => !p.email).length;
  const removed = admin ? app.recentlyRemoved().length : 0;
  const cycles = app.full.cycles.filter((c) => !c.removedAt).length;
  const admins = app.snapshot.people.filter((p) => p.admin).length;
  // Counted from the list the Features section shows, so the two always agree.
  const featuresOn = installed.filter((m) => on.has(m.id)).length;
  const tokens = (app.snapshot.tokens ?? []).filter((t) => !t.revokedAt).length;
  return {
    overview: 'What needs attention here',
    people: n(app.snapshot.people.length, 'person', 'people') + (admin && noEmail ? `, ${noEmail} without an email` : ''),
    teams: n(app.snapshot.teams.length, 'team', 'teams'),
    cycles: `${app.cycle.name} is open${cycles > 1 ? `, of ${cycles}` : ''}`,
    access: n(admins, 'admin', 'admins') + `, ${n(tokens, 'token', 'tokens')}`,
    features: `${featuresOn} of ${installed.length} optional ${installed.length === 1 ? 'feature' : 'features'} on`,
    privacy: app.ws.recording !== false ? 'Recording how the app is used' : 'Recording is off',
    removed: removed ? `${removed} in the last 30 days` : 'Nothing',
  };
}

const sectionPath = (id: string) => (id === 'overview' ? '/workspace' : `/workspace/${id}`);

/** The side menu on a computer. */
function SectionLinks({ current }: { current: string }) {
  const { sections } = useWs();
  const notes = useNotes();
  return (
    <ul className="ws-menu-list">
      {sections.map((s) => (
        <li key={s.id}>
          <Link className="ws-menu-item" to={sectionPath(s.id)} aria-current={s.id === current ? 'page' : undefined}>
            <span className="ws-menu-label">{s.label}</span>
            {notes[s.id] && <span className="ws-menu-note">{notes[s.id]}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The list of sections on a phone: each with what it's for, and its count. */
function SectionList() {
  const { sections } = useWs();
  const notes = useNotes();
  return (
    <ul className="ws-list" aria-label="Workspace sections">
      {sections.map((s) => (
        <li key={s.id}>
          <Link className="ws-list-item" to={`/workspace/${s.id}`}>
            <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
              <span className="ws-list-label">{s.label}{notes[s.id] && <span className="ws-menu-note"> · {notes[s.id]}</span>}</span>
              <span className="hint">{s.summary}</span>
            </span>
            <Icon name="chevron-right" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A section's heading, what it's for, and its main action. On a phone the page's own heading names it. */
function SectionHead({ id, action, children }: { id: string; action?: ReactNode; children?: ReactNode }) {
  const { all, narrow } = useWs();
  const s = all.find((x) => x.id === id);
  return (
    <div className="ws-section-head">
      <div className="row between ws-section-title">
        {!narrow ? <h2 className="block-title">{s?.label}</h2> : <span />}
        {action}
      </div>
      <p className="hint">{children ?? s?.summary}</p>
    </div>
  );
}

/** A section for admins, opened by someone who isn't one. */
function AdminsOnly({ label }: { label: string }) {
  const app = useApp();
  const admins = app.snapshot.people.filter((p) => p.admin).map((p) => p.name);
  return (
    <div className="stack" style={{ gap: 'var(--s2)' }}>
      <p>{label} is for the workspace’s admins.</p>
      <p className="hint">{admins.length ? `Admins here: ${admins.join(', ')}.` : 'There are no admins yet.'} <Link to="/workspace">Back to the overview</Link></p>
    </div>
  );
}

/* ---------- Overview ---------- */

function OverviewSection() {
  const app = useApp();
  const { sections } = useWs();
  const says = useSays();
  const switchTo = useSwitchWorkspace();
  const [confirming, setConfirming] = useState(false);
  const admin = app.viewer.admin;
  // Most people are in one workspace: then there's nothing to switch between, only this one's name.
  const several = app.workspaces.length > 1;
  // Every section this person sees, each with one true line (backlog WS: Access and Privacy were missing).
  const counts: [string, string, string][] = sections.filter((s) => s.id !== 'overview').map((s) => [s.id, s.label, says[s.id] ?? s.summary]);
  return (
    <>
      <SectionHead id="overview" />
      <section className="block ws-name-block">
        <WorkspaceName several={several} />
        {several && (
          <div className="glist">
            {app.workspaces.map((w) => (
              <button key={w.id} className="gline ws-line" aria-current={w.id === app.ws.id ? 'true' : undefined} onClick={() => switchTo(w.id, '/workspace')}>
                <span className={'wsmark' + (w.kind === 'example' ? ' example' : '')} aria-hidden="true">{w.name.replace(/^example:\s*/i, '').slice(0, 1).toUpperCase()}</span>
                <span className="gline-title">{w.name}</span>
                <span className="gline-now">{w.id === app.ws.id ? 'Open now' : w.kind === 'example' ? 'Demo data' : 'Your data'}</span>
              </button>
            ))}
          </div>
        )}
        <div className="row">
          <Link className="btn" to="/workspace/new">{app.mode === 'demo' ? 'Try setting up your own' : 'New workspace'}</Link>
          {app.mode === 'live' && <a className="btn" href="/demo">Try the demo</a>}
          {/* Resetting a shared workspace is for admins (Lane, 9 Nov); the demo's Start over, in Demo controls, stays for everyone. */}
          {app.mode === 'demo' && app.ws.kind === 'example' && admin && <button className="btn" aria-expanded={confirming} onClick={() => setConfirming(true)}>Reset the example</button>}
        </div>
        {app.mode === 'demo' && app.ws.kind === 'example' && !admin && <p className="hint">To put the example back as it was, use Start over in Demo controls. It only touches this browser.</p>}
        {app.mode === 'demo' && app.ws.kind === 'example' && admin && confirming && (
          <div className="reset-confirm" role="group" aria-label="Reset the example">
            <span className="small">Undo every change in the example, and clear its drafts and what you’ve seen here? It only touches this browser: nobody else’s copy changes.</span>
            <span className="row" style={{ gap: 'var(--s2)' }}>
              <button className="btn" onClick={async () => { await app.resetExample(); setConfirming(false); }}>Yes, reset it</button>
              <button className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button>
            </span>
          </div>
        )}
      </section>
      <ul className="ws-counts" aria-label="In this workspace">
        {counts.map(([id, label, says]) => (
          <li key={id}><Link className="ws-count" to={`/workspace/${id}`}><span className="ws-count-label">{label}</span><span className="ws-count-says">{says}</span><Icon name="chevron-right" /></Link></li>
        ))}
      </ul>
      <LeaveWorkspace />
      {admin && app.ws.kind === 'own' && <DeleteWorkspace />}
    </>
  );
}

/* ---------- People ---------- */

function PeopleSection() {
  const app = useApp();
  const [editing, setEditing] = useState<Person | 'new' | null>(null);
  // Marking someone as left (or deleting someone with no history) opens from their sheet (ui/RemoveSheets).
  const [leaving, setLeaving] = useState<Person | null>(null);
  const admin = app.viewer.admin;
  // A directory that works for a whole company: find by name, role or team, filter by team, and show a page at a time.
  const [q, setQ] = useState('');
  // ?team=<id> opens on one team's people: a row in Teams leads here (backlog WS).
  const [params, setParams] = useSearchParams();
  const teamId = params.get('team') ?? '';
  const setTeamId = (id: string) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('team', id); else n.delete('team'); return n; }, { replace: true });
  const [limit, setLimit] = useState(60);
  const needle = q.trim().toLowerCase();
  const leadOf = teamId && teamId !== '-' ? app.team(teamId)?.leadId : null;
  const match = (x: Person) => (!teamId || (teamId === '-' ? !x.teamId || !app.team(x.teamId) : x.teamId === teamId || x.id === leadOf))
    && (!needle || [x.name, x.role ?? '', app.team(x.teamId ?? '')?.name ?? ''].some((v) => v.toLowerCase().includes(needle)));
  const found = app.snapshot.people.filter(match);
  const shown = new Set(found.slice(0, limit).map((x) => x.id));
  const groups = teamId && teamId !== '-' ? [[app.team(teamId)?.name ?? 'Team', found.filter((x) => shown.has(x.id))] as const] : [...app.snapshot.teams.map((t) => [t.name, found.filter((x) => x.teamId === t.id && shown.has(x.id))] as const), ['No team', found.filter((x) => (!x.teamId || !app.team(x.teamId)) && shown.has(x.id))] as const].filter(([, l]) => l.length);
  const admins = app.snapshot.people.filter((p) => p.admin);
  return (
    <>
      <SectionHead id="people" action={admin && <button className="btn primary" onClick={() => setEditing('new')}>Add a person</button>}>
        {`${app.snapshot.people.length} ${app.snapshot.people.length === 1 ? 'person' : 'people'} in ${app.ws.name}. `}
        {admin ? 'You’re an admin: you can add people, change their details and make others admins.' : `Admins can add people: ${admins.map((p) => p.name).join(', ') || 'no one yet'}.`}
      </SectionHead>
      <section className="block people-block" aria-label={`People in ${app.ws.name}`}>
        {admin && <MissingEmails />}
        <div className="row directory-find">
          <label className="field" style={{ flex: '2 1 220px' }}><span className="sr">Find a person</span><input className="input" type="search" placeholder="Find by name, role or team" value={q} onChange={(e) => { setQ(e.target.value); setLimit(60); }} /></label>
          <label className="field" style={{ flex: '1 1 160px' }}><span className="sr">Team</span>
            <select className="input" value={teamId} onChange={(e) => { setTeamId(e.target.value); setLimit(60); }}>
              <option value="">Every team</option>
              {app.snapshot.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              <option value="-">No team</option>
            </select>
          </label>
        </div>
        {(needle || teamId) && <p className="hint" role="status">{found.length === 0 ? 'No one matches.' : `${found.length} ${found.length === 1 ? 'person matches' : 'people match'}.`}</p>}
        {groups.map(([team, list]) => (
          <div key={team} className="stack" style={{ gap: 'var(--s1)', marginTop: 'var(--s3)' }}>
            <span className="label">{team} · {list.length}</span>
            <div className="optlist">
              {list.map((x) => {
                const body = <><Avatar p={x} size="sm" /><span className="person-text"><span className="person-name">{app.personName(x.id)}</span>{x.role && <span className="hint">{x.role}</span>}</span>{x.admin && <span className="chip tag">Admin</span>}</>;
                return admin
                  ? <button key={x.id} className="opt person-opt" onClick={() => setEditing(x)}>{body}</button>
                  : <div key={x.id} className="opt static person-opt">{body}</div>;
              })}
            </div>
          </div>
        ))}
        {found.length > limit && <button type="button" className="btn" onClick={() => setLimit((n) => n + 60)}>Show {Math.min(60, found.length - limit)} more of {found.length - limit}</button>}
      </section>
      {editing && <PersonSheet person={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onLeave={(p) => { setEditing(null); setLeaving(p); }} />}
      {leaving && <LeaveSheet person={leaving} onClose={() => setLeaving(null)} />}
    </>
  );
}

/* ---------- the admins' sections ---------- */

function CyclesSection() {
  return (
    <>
      <SectionHead id="cycles">A cycle is a goal year. One nobody has checked in to yet can be deleted with its goals; one with check-ins stays. The next one starts from the <Link to="/retro">wrap-up</Link> at the end of this one.</SectionHead>
      <CycleList bare />
    </>
  );
}

function AccessSection() {
  const app = useApp();
  const admins = app.snapshot.people.filter((p) => p.admin);
  return (
    <>
      <SectionHead id="access" />
      <section className="block admins-block" aria-labelledby="ws-admins">
        <h3 className="label" id="ws-admins">Admins · {admins.length}</h3>
        <ul className="optlist" aria-label="Admins">
          {admins.map((p) => <li key={p.id} className="opt static person-opt"><Avatar p={p} size="sm" /><span className="person-text"><span className="person-name">{p.name}</span>{p.role && <span className="hint">{p.role}</span>}</span></li>)}
        </ul>
        <p className="hint">Make someone an admin, or stop them being one, from their entry in <Link to="/workspace/people">People</Link>. There is always at least one.</p>
      </section>
      <AiAssistants />
    </>
  );
}

function FeaturesSection() {
  return (
    <>
      <SectionHead id="features" />
      <Features />
    </>
  );
}

function PrivacySection() {
  return (
    <>
      <SectionHead id="privacy" />
      <Recording />
    </>
  );
}

function RemovedSection() {
  return (
    <>
      <SectionHead id="removed" />
      <RecentlyRemoved bare />
    </>
  );
}

/** The workspace's name, and for admins a way to change it, in place. */
function WorkspaceName({ several }: { several: boolean }) {
  const app = useApp();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const save = async () => {
    setTried(true);
    if (name === null || nameProblem(name, 'workspace') || busy) return;
    setBusy(true);
    try {
      const same = name.trim().replace(/\s+/g, ' ') === app.ws.name;
      await app.renameWorkspace(name);
      app.toast(same ? 'Nothing changed.' : 'Renamed the workspace');
      setName(null); setTried(false);
    } catch { /* the rule's message is shown */ }
    setBusy(false);
  };
  if (name !== null) {
    return (
      <form className="stack ws-rename" style={{ gap: 'var(--s3)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <div className="field">
          <label className="field"><span className="field-label">Workspace name</span>
            <input className={'input' + (tried && nameProblem(name, 'workspace') ? ' invalid' : '')} aria-invalid={tried && nameProblem(name, 'workspace') ? true : undefined} aria-describedby="ws-name-length" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {/* The limit is said while typing, never applied by cutting the name short (backlog WS). */}
          <span id="ws-name-length" className={'hint' + (nameProblem(name, 'workspace')?.startsWith('Keep') ? ' tone-off' : '')} role="status">{nameLength(name) ?? ''}</span>
          {tried && nameProblem(name, 'workspace') && <span className="hint tone-off" role="alert">{nameProblem(name, 'workspace')}</span>}
        </div>
        <span className="ws-rename-buttons"><button type="submit" className="btn">{busy ? 'Saving…' : 'Save the name'}</button><button type="button" className="btn ghost" onClick={() => { setName(null); setTried(false); }}>Cancel</button></span>
      </form>
    );
  }
  const rename = app.viewer.admin && <button type="button" className="btn sm" onClick={() => setName(app.ws.name)} aria-label={`Rename ${app.ws.name}`} title={several ? `Rename the one that’s open: ${app.ws.name}` : undefined}>Rename</button>;
  // With several, the list below names them all (this one is "Open now"): a heading for it, and Rename for the open one.
  if (several) return <div className="ws-title-row ws-list-head"><span className="label">Your workspaces · {app.workspaces.length}</span>{rename}</div>;
  return (
    <div className="ws-title-row">
      <span className={'wsmark' + (app.ws.kind === 'example' ? ' example' : '')} aria-hidden="true">{app.ws.name.replace(/^example:\s*/i, '').slice(0, 1).toUpperCase()}</span>
      <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
        <h2 className="block-title ws-title">{app.ws.name}</h2>
        <span className="hint">{app.snapshot.people.length} people · {app.snapshot.teams.length} {app.snapshot.teams.length === 1 ? 'team' : 'teams'} · {app.cycle.name}</span>
      </span>
      {rename}
    </div>
  );
}

/** Teams: find one by name or lead, each with its lead and how many people and goals it has. Admins add, rename and
    remove them; Add a team is the section's main action. */
function TeamsSection() {
  const app = useApp();
  const [editing, setEditing] = useState<Team | 'new' | null>(null);
  const [removing, setRemoving] = useState<Team | null>(null);
  const [q, setQ] = useState('');
  const admin = app.viewer.admin;
  const ctx = { snapshot: app.snapshot, allGoals: app.allGoals };
  const needle = q.trim().toLowerCase();
  const found = app.snapshot.teams.filter((t) => !needle || [t.name, app.person(t.leadId)?.name ?? ''].some((v) => v.toLowerCase().includes(needle)));
  return (
    <>
      <SectionHead id="teams" action={admin && <button className="btn primary" onClick={() => setEditing('new')}>Add a team</button>} />
      {app.snapshot.teams.length > 6 && (
        <label className="field ws-find"><span className="sr">Find a team</span><input className="input" type="search" placeholder="Find a team or its lead" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      )}
      {needle && <p className="hint" role="status">{found.length === 0 ? 'No team matches.' : `${found.length} ${found.length === 1 ? 'team matches' : 'teams match'}.`}</p>}
      {!app.snapshot.teams.length ? <p className="hint">No teams yet.</p> : (
        <ul className="optlist team-list" aria-label="Teams">
          {found.map((t) => {
            const m = teamMembers(ctx, t.id);
            // The lead counts as one of the team's people, wherever their own team is (backlog WS).
            const people = teamPeople(ctx, t.id).length;
            const lead = app.person(t.leadId);
            return (
              <li key={t.id} className="opt static team-opt">
                {/* The row opens the team's people in the directory. */}
                <Link className="person-text team-open" to={`/workspace/people?team=${encodeURIComponent(t.id)}`} aria-label={`${t.name}: see its ${people} ${people === 1 ? 'person' : 'people'}`}>
                  <span className="person-name">{t.name}</span>
                  <span className="hint">{[lead ? `Led by ${lead.name}` : 'No lead', `${people} ${people === 1 ? 'person' : 'people'}`, `${m.current.length} ${m.current.length === 1 ? 'goal' : 'goals'}`].join(' · ')}</span>
                </Link>
                {admin && (
                  <span className="team-actions">
                    <button type="button" className="btn sm" onClick={() => setEditing(t)} aria-label={`Rename ${t.name}`}>Rename</button>
                    <button type="button" className="btn sm" onClick={() => setRemoving(t)} aria-label={`Remove ${t.name}`}>Remove</button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editing && <TeamSheet team={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {removing && <RemoveTeamSheet team={removing} onClose={() => setRemoving(null)} />}
    </>
  );
}

function TeamSheet({ team, onClose }: { team: Team | null; onClose: () => void }) {
  const app = useApp();
  const [name, setName] = useState(team?.name ?? '');
  const [leadId, setLeadId] = useState(team?.leadId ?? '');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const clean = name.trim().replace(/\s+/g, ' ');
  const dup = app.snapshot.teams.find((t) => t.id !== team?.id && !!clean && t.name.trim().toLowerCase() === clean.toLowerCase());
  const save = async () => {
    setTried(true);
    if (!clean || dup || busy) return;
    setBusy(true);
    try {
      await app.saveTeam({ id: team?.id, name, leadId: leadId || null });
      app.toast(team ? (team.name !== clean ? `Renamed to ${clean}` : 'Saved') : `Added ${clean}`);
      onClose();
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
        <label className="field"><span className="field-label">Team lead <span className="hint">optional</span></span>
          <select className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">No lead</option>
            {app.snapshot.people.map((p) => <option key={p.id} value={p.id}>{app.personName(p.id)}</option>)}
          </select>
        </label>
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary big-btn" type="submit">{busy ? 'Saving…' : team ? 'Save' : 'Add the team'}</button></div>
      </form>
    </Sheet>
  );
}

/** Removing a team: an empty one goes at once; one with people or goals moves them to another team in the same save. */
function RemoveTeamSheet({ team, onClose }: { team: Team; onClose: () => void }) {
  const app = useApp();
  const m = teamMembers({ snapshot: app.snapshot, allGoals: app.allGoals }, team.id);
  const others = app.snapshot.teams.filter((t) => t.id !== team.id);
  const [to, setTo] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const has = [m.people.length ? `${m.people.length} ${m.people.length === 1 ? 'person' : 'people'}` : '', m.goals.length ? `${m.goals.length} ${m.goals.length === 1 ? 'goal' : 'goals'}` : ''].filter(Boolean).join(' and ');
  const go = async () => {
    setTried(true);
    if ((has && !to) || busy) return;
    setBusy(true);
    try {
      const dest = app.team(to)?.name;
      await app.removeTeam(team.id, to || null);
      app.toast(has ? `Removed ${team.name}, and moved ${has} to ${dest}` : `Removed ${team.name}`);
      onClose();
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
              <label className="field"><span className="field-label">Move them to</span>
                <select className={'input' + (tried && !to ? ' invalid' : '')} aria-invalid={tried && !to ? true : undefined} value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">Choose a team</option>
                  {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
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
 * app, in a spreadsheet and for the AI assistant. Typed here and saved together, through the bulk-change engine.
 */
function MissingEmails() {
  const app = useApp();
  const missing = app.snapshot.people.filter((p) => !p.email);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(20);
  if (!missing.length) return null;
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
    <section className="missing-emails stack" aria-labelledby="missing-emails" style={{ gap: 'var(--s2)', marginTop: 'var(--s3)' }}>
      <h3 id="missing-emails" className="label">People without an email · {missing.length}</h3>
      <p className="hint">An email tells two people with the same name apart, in the app, in spreadsheets and for the AI assistant. Everyone added now has one; add these when you can.</p>
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

function PersonSheet({ person, onClose, onLeave }: { person: Person | null; onClose: () => void; onLeave: (p: Person) => void }) {
  const app = useApp();
  const [p, setP] = useState<Person>(person ?? { id: newId('p'), name: '', role: '', initials: '', teamId: app.viewer.teamId ?? app.snapshot.teams[0]?.id ?? null, admin: false, email: '' });
  const [tried, setTried] = useState(false);
  const self = person?.id === app.viewer.id;
  // A shared name is allowed (the email is who someone is), and said, so a second record for one person is noticed.
  const twin = sameNameNote(p, app.snapshot.people, (id) => app.team(id)?.name ?? '');
  const lastAdmin = !!person?.admin && app.snapshot.people.filter((x) => x.admin).length === 1;
  // An email is needed for anyone new; someone added before emails existed can be saved without one until it's known.
  const clean: Person = { ...p, name: p.name.trim(), role: p.role.trim(), initials: initials(p.name.trim()), ...(normalEmail(p.email) ? { email: normalEmail(p.email) } : person?.email ? {} : { email: undefined }) };
  const emailProblem = personProblems(clean, app.snapshot.people, person).find((x) => /email/i.test(x));
  const save = async () => {
    setTried(true);
    if (personProblems(clean, app.snapshot.people, person).length) return;
    await app.savePerson(clean, person);
    app.toast(person ? 'Saved' : `Added ${p.name.trim()}`);
    onClose();
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
        <label className="field"><span className="field-label">Team</span>
          <select className="input" value={p.teamId ?? ''} onChange={(e) => setP({ ...p, teamId: e.target.value || null })}>
            {app.snapshot.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            <option value="">No team</option>
          </select>
        </label>
        <label className="check admin-check">
          <input type="checkbox" checked={p.admin} disabled={lastAdmin} onChange={(e) => setP({ ...p, admin: e.target.checked })} />
          <span className="stack" style={{ gap: 0 }}><span className="admin-word">Admin</span><span className="hint">{lastAdmin ? (self ? 'You’re the only admin, so you stay one.' : 'The only admin stays one.') : 'Can add people, change settings and make others admins.'}</span></span>
        </label>
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary big-btn" type="submit">{person ? 'Save' : 'Add'}</button></div>
        {person && <div className="person-leave"><button type="button" className="btn ghost" onClick={() => onLeave(person)}>{leaveLabel(app, person)}…</button></div>}
      </form>
    </Sheet>
  );
}

/** The workspace's recording: what is recorded, for everyone to read, and for admins the switch. On for everyone by
    default; off, nothing is recorded or sent from it. */
function Recording() {
  const app = useApp();
  const on = app.ws.recording !== false;
  const admins = app.snapshot.people.filter((p) => p.admin).map((p) => p.name);
  const [busy, setBusy] = useState(false);
  // Turning recording on asks first (Lane, 9 Nov): it's off unless chosen, at set-up or here.
  const [asking, setAsking] = useState(false);
  const flip = async (next: boolean) => {
    if (busy) return;
    if (next && !asking) { setAsking(true); return; }
    setAsking(false);
    setBusy(true);
    try {
      await app.setRecording(next);
      app.toast(next ? `Recording is on in ${app.ws.name}.` : `Recording is off in ${app.ws.name}. Nothing more is sent.`);
    } catch { /* the rule's message is shown */ }
    setBusy(false);
  };
  return (
    <section className="block recording-block" aria-label="What the app records">
      <p className="hint">How people use the app here: the pages they open, the buttons they press, where they stop in a task, errors and slow pages. Never anything anyone types. Kept for 90 days, then only daily totals; only the people who build the app can read it.</p>
      {app.viewer.admin ? (
        <label className="check record-check">
          <input type="checkbox" checked={on} disabled={busy} onChange={(e) => void flip(e.target.checked)} />
          <span className="stack" style={{ gap: 0 }}>
            <span>Record how the app is used in {app.ws.name}</span>
            <span className="hint">{on ? 'On for everyone here. Turn it off and nothing more is sent.' : 'Off: nothing is recorded or sent from this workspace.'}</span>
          </span>
        </label>
      ) : null}
      {app.viewer.admin && asking ? (
        <div className="reset-confirm" role="group" aria-label="Turn recording on">
          <span className="small">Record how everyone in {app.ws.name} uses the app, from now on? Nothing anyone types is recorded.</span>
          <span className="row" style={{ gap: 'var(--s2)' }}>
            <button type="button" className="btn" onClick={() => void flip(true)}>Yes, turn it on</button>
            <button type="button" className="btn ghost" onClick={() => setAsking(false)}>Cancel</button>
          </span>
        </div>
      ) : null}
      {app.viewer.admin ? null : (
        <p className="record-state">
          <span className="strong">{on ? `Recording is on in ${app.ws.name}.` : `Recording is off in ${app.ws.name}: nothing is recorded or sent.`}</span>{' '}
          <span className="hint">Only admins change it{admins.length ? `: ${admins.join(', ')}` : ''}.</span>
        </p>
      )}
      <p className="hint"><Link to="/help/recording">What’s recorded, exactly</Link></p>
    </section>
  );
}

/** For admins: the feature modules this workspace uses (docs/architecture.md), each switched on or off for everyone. */
function Features() {
  const app = useApp();
  const { installed, on, off } = useModules();
  const [busy, setBusy] = useState<string | null>(null);
  if (!installed.length) return null;
  const nameOf = (id: string) => installed.find((m) => m.id === id)?.name ?? id;
  const flip = async (id: string, next: boolean) => {
    if (busy) return;
    setBusy(id);
    try {
      await app.setModule(id, next);
      app.toast(next ? `${nameOf(id)} is on in ${app.ws.name}.` : `${nameOf(id)} is off in ${app.ws.name}. Nothing it saved is lost.`);
    } catch { /* the rule's message is shown */ }
    setBusy(null);
  };
  return (
    <section className="block features-block" aria-label="Features">
      <p className="hint">Switch one off and it leaves every screen here, for everyone; nothing it saved is lost, and switching it back on brings it all back.</p>
      {installed.map((m) => {
        const why = off.get(m.id);
        const switched = (app.ws.modulesOff ?? []).includes(m.id);
        return (
          <label key={m.id} className="check feature-check">
            <input type="checkbox" checked={!switched} disabled={!!busy} onChange={(e) => void flip(m.id, e.target.checked)} />
            <span className="stack" style={{ gap: 0 }}>
              <span>{m.name}</span>
              <span className="hint">{m.summary}</span>
              {!switched && why?.kind === 'needs' && <span className="hint">Off until {why.missing.map(nameOf).join(' and ')} is on: it needs {why.missing.length === 1 ? 'it' : 'them'}.</span>}
              {on.has(m.id) && m.needs.length > 0 && <span className="hint">Needs {m.needs.map(nameOf).join(' and ')}.</span>}
            </span>
          </label>
        );
      })}
      <p className="hint"><Link to="/help/features">About features</Link></p>
    </section>
  );
}

/** Anyone: leave this workspace, with a confirm that first asks who takes over your goals (Lane, 9 Nov). The only admin is told why not. */
function LeaveWorkspace() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  return (
    <section className="block leave-zone">
      <h2 className="block-title">Leave this workspace</h2>
      <p className="hint">Take yourself out of {app.ws.name}{app.mode === 'demo' ? ' (in this browser)' : ''}: someone takes over your goals and open asks, and your history stays. An admin can bring you back for 30 days.</p>
      <div><button type="button" className="btn" onClick={() => setOpen(true)}>Leave this workspace…</button></div>
      {open && <LeaveWorkspaceSheet onClose={() => setOpen(false)} />}
    </section>
  );
}

/** For admins: delete this workspace and everything in it. Typing its name confirms, because it can't be undone. */
function DeleteWorkspace() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const match = typed.trim() === app.ws.name.trim();
  const go = async () => {
    if (!match || busy) return;
    setBusy(true);
    try { await app.deleteWorkspace(); } catch (e) { app.toast(e instanceof Error ? e.message : String(e), 'error'); setBusy(false); }
  };
  return (
    <section className="block danger-zone">
      <h2 className="block-title">Delete this workspace</h2>
      <p className="hint">Removes {app.ws.name}: its people, goals, check-ins, reviews and history{app.mode === 'demo' ? ' (in this browser)' : ', for everyone'}. This can’t be undone.</p>
      {!open ? <div><button className="btn danger" onClick={() => setOpen(true)}>Delete this workspace…</button></div> : (
        <form className="stack" style={{ gap: 'var(--s3)', maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); void go(); }}>
          <label className="field"><span className="field-label">Type <strong>{app.ws.name}</strong> to confirm</span>
            <input className="input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={`Type ${app.ws.name} to confirm`} />
          </label>
          <div className="foot-row"><button type="button" className="btn ghost" onClick={() => { setOpen(false); setTyped(''); }}>Cancel</button><button type="submit" className="btn danger" disabled={!match || busy}>{busy ? 'Deleting…' : 'Delete it for good'}</button></div>
        </form>
      )}
    </section>
  );
}
