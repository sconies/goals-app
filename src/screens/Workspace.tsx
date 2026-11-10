/* Workspace, in sections (backlog W, Lane, 8 Nov: "The workspace is too busy. It needs sections so you can actually
   manage it."). Each section has its own address, /workspace/<section>, and one main action; a side menu on a
   computer, a list on a phone:
     Overview          the name, switching workspaces, counts that lead to each section, and deleting it (admins)
     Privacy (what the app records): everyone reads it; only admins switch it.
     Cycles: everyone reads it; only admins delete one.
     Recently removed: admins see everything; anyone else what they removed, which they can restore (8 Nov).
     Access (admins and MCP tokens), Features: admins only.
   People who aren't admins see Overview, Cycles, Privacy and Recently removed. People and Teams moved out to places of
   their own (src/screens/People.tsx, app redesign WR1), and so did the inbox (Feedback). Sections are the settings
   extension point: a module adds its own (AppModule `sections`, src/core/app.tsx). Old addresses
   (/workspace?inbox=1&markup=…, #people) lead to where they meant. */
import { nameLength, nameProblem } from '../domain/thresholds';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useApp } from '../app/state';
import { useModules, type WorkspaceSection } from '../core/app';
import { sectionsFor } from '../core/module';
import { Avatar } from '../ui/bits';
import { adminsLine, cycleWhen, NEEDS_SHOWN, workspaceName, workspaceNeeds, yearLine } from '../domain/workspaceAttention';
import { canRestore, cycleStanding } from '../domain/removal';
import { AiAssistants } from '../ui/AiAssistants';
import { Icon } from '../ui/Icon';
import { RecentlyRemoved } from '../ui/RecentlyRemoved';
import { wrapUpOpen } from '../domain/cycle';
import { useWidth } from '../ui/useWidth';
import { movedTo } from '../domain/directory';

/** Below this width, Workspace is About and then its other sections as a list, one section at a time (a phone). */
const NARROW = 720;

/** The core's sections, in menu order. A module's sections follow the one they name in `after`, or come last. The
    landing section keeps the id `overview` (old links and modules name it); people read it as About (WR2). */
const CORE: WorkspaceSection[] = [
  { id: 'overview', label: 'About', summary: 'What needs sorting out, then the facts about this workspace.', element: <AboutSection /> },
  { id: 'cycles', label: 'Cycles', summary: 'The workspace’s goal years: their dates, which one is running, and what can be done with each.', element: <CyclesSection /> },
  { id: 'access', label: 'Access', summary: 'Who the admins are, and MCP access: the tokens that let Claude or another AI tool act as someone here.', admins: true, element: <AccessSection /> },
  { id: 'features', label: 'Features', summary: 'The optional parts of Faro, each switched on or off for everyone here. Goals, check-ins, reviews and people are always on.', admins: true, element: <FeaturesSection /> },
  // Everyone can read what is recorded about them; only admins switch it (re-review, 8 Nov, backlog T).
  { id: 'privacy', label: 'Privacy', summary: 'What the app records about how it’s used here. Admins switch it on or off.', element: <PrivacySection /> },
  { id: 'removed', label: 'Recently removed', summary: 'Anything removed in the last 30 days, with Restore. Anyone who isn’t an admin sees what they removed.', element: <RemovedSection /> },
];

/** Old anchors on the one-page Workspace, and the section each now is. */
const ANCHORS: Record<string, string> = { cycles: 'cycles', ai: 'access', tokens: 'access', access: 'access', features: 'features', recording: 'privacy', privacy: 'privacy', removed: 'removed' };

/** The sections someone sees, in order (rule 7, src/core/module.ts sectionsFor). */
export function useSections(): WorkspaceSection[] {
  const app = useApp();
  const { screens } = useModules();
  return sectionsFor(app.viewer, CORE, screens.flatMap((m) => m.sections ?? []));
}

interface Ctx { narrow: boolean; sections: WorkspaceSection[]; all: WorkspaceSection[] }
const WsCtx = createContext<Ctx | null>(null);
const useWs = () => useContext(WsCtx)!;

export function WorkspaceHome({ section }: { section?: string }) {
  const app = useApp();
  const { search, hash } = useLocation();
  const [ref, width] = useWidth<HTMLDivElement>();
  const sections = useSections();
  const { screens } = useModules();
  const all = [...CORE, ...screens.flatMap((m) => m.sections ?? [])];
  const narrow = width > 0 && width < NARROW;
  // Old addresses: the inbox's (from a GitHub issue) and the one-page Workspace's anchors.
  if (!section) {
    const q = new URLSearchParams(search);
    const markup = q.get('markup');
    if (q.get('inbox') || markup || hash === '#inbox') return <Navigate to={`/feedback${markup ? `?markup=${encodeURIComponent(markup)}` : ''}`} replace />;
    // People and Teams have places of their own (WR1): /workspace#people leads to /people.
    const moved = movedTo('/workspace', search, hash);
    if (moved) return <Navigate to={moved} replace />;
    const anchor = ANCHORS[hash.replace('#', '')];
    if (anchor) return <Navigate to={`/workspace/${anchor}`} replace />;
  }
  const id = section ?? 'overview';
  const here = all.find((s) => s.id === id);
  const shown = sections.find((s) => s.id === id);
  const body = !here ? null : shown ? here.element : <AdminsOnly label={here.label} />;
  const ctx: Ctx = { narrow, sections, all };
  const ws = workspaceName(app.ws, app.mode);
  // A phone opens a section on its own page, named by it, with Workspace to go back to; /workspace is About.
  const sub = narrow && id !== 'overview';
  return (
    <WsCtx.Provider value={ctx}>
      <div className={'page workspace ws-' + id + (narrow ? ' ws-narrow' : '')} ref={ref}>
        <div className="page-head wsp-head">
          {sub && <Link className="backlink" to="/workspace"><Icon name="chevron-left" /><span className="ellipsis">Workspace</span></Link>}
          <h1 className="title-xl">{sub ? here?.label ?? 'Workspace' : 'Workspace'}</h1>
          {/* One line: whose workspace, and your part in it (WR2). Nothing else. */}
          {!sub && <span className="hint ws-role-line" data-role={app.viewer.admin ? 'admin' : 'member'}>{ws.name} · you’re {app.viewer.admin ? 'an admin' : 'a member'} here</span>}
        </div>
        {narrow ? <div className="ws-body">{body}</div> : (
          <div className="ws-layout">
            <nav className="ws-menu" aria-label="Workspace sections"><SectionLinks current={id} /></nav>
            <div className="ws-body">{body}</div>
          </div>
        )}
      </div>
    </WsCtx.Provider>
  );
}

/** What each core section says in a line, under its name in the phone's "More in Workspace" (a module's says its own). */
function useSays(): Record<string, string> {
  const app = useApp();
  const { installed, on } = useModules();
  const admin = app.viewer.admin;
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const removed = app.recentlyRemoved().filter((r) => canRestore(app.viewer, r)).length;
  const cycles = app.full.cycles.filter((c) => !c.removedAt).length;
  const admins = app.snapshot.people.filter((p) => p.admin).length;
  // Counted from the list the Features section shows, so the two always agree.
  const featuresOn = installed.filter((m) => on.has(m.id)).length;
  const tokens = (app.snapshot.tokens ?? []).filter((t) => !t.revokedAt).length;
  return {
    cycles: `${app.cycle.name} is running${cycles > 1 ? `, of ${cycles}` : ''}`,
    // Tokens exist only in the real app: the demo's data stays in the browser, where an assistant can't reach it.
    access: n(admins, 'admin', 'admins') + (app.mode === 'demo' ? '; MCP tokens are for the real app' : `, ${n(tokens, 'MCP token', 'MCP tokens')}`),
    features: `${featuresOn} of ${installed.length} optional ${installed.length === 1 ? 'feature' : 'features'} on`,
    privacy: app.ws.recording !== false ? 'Recording how the app is used' : 'Recording is off',
    removed: removed ? `${removed} in the last 30 days` : admin ? 'Nothing' : 'Nothing of yours',
  };
}

const sectionPath = (id: string) => (id === 'overview' ? '/workspace' : `/workspace/${id}`);

/** The side menu on a computer: the sections' names, no counts. */
function SectionLinks({ current }: { current: string }) {
  const { sections } = useWs();
  return (
    <ul className="ws-menu-list">
      {sections.map((s) => (
        <li key={s.id}>
          <Link className="ws-menu-item" to={sectionPath(s.id)} aria-current={s.id === current ? 'page' : undefined}>
            <span className="ws-menu-label">{s.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** On a phone, under About: the other sections, each with its one line. */
function MoreSections() {
  const app = useApp();
  const { sections } = useWs();
  const says = useSays();
  return (
    <section className="stack ws-more" style={{ gap: 'var(--s2)' }} aria-labelledby="ws-more-title">
      <h2 className="label" id="ws-more-title">More in Workspace</h2>
      <ul className="ws-list" aria-label="Workspace sections">
        {sections.filter((s) => s.id !== 'overview').map((s) => (
          <li key={s.id}>
            <Link className="ws-list-item" to={`/workspace/${s.id}`}>
              <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                <span className="ws-list-label">{s.label}</span>
                <span className="hint">{s.says?.(app) ?? says[s.id] ?? s.summary}</span>
              </span>
              <Icon name="chevron-right" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
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

/** A section for admins, opened by someone who isn't one: who the admins are, and the way back. */
function AdminsOnly({ label }: { label: string }) {
  const app = useApp();
  return (
    <div className="stack ws-admins-only" style={{ gap: 'var(--s2)' }}>
      <p>{label} is for admins. The admins here are {adminsLine(app.snapshot.people) || 'not set yet'}.</p>
      <p><Link to="/workspace">Back to Workspace</Link></p>
    </div>
  );
}

/* ---------- About (WR2) ---------- */

/** Who is on and off among a workspace's optional features, as one sentence. */
const featuresSentence = (on: string[], off: string[]) => {
  const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  if (!on.length) return 'No optional features are on.';
  return `${and(on)} ${on.length === 1 ? 'is' : 'are'} on${off.length ? `; ${and(off)} ${off.length === 1 ? 'is' : 'are'} off` : ''}.`;
};

function AboutSection() {
  const app = useApp();
  const { narrow, sections } = useWs();
  const { installed, on } = useModules();
  const [all, setAll] = useState(false);
  const admin = app.viewer.admin;
  const ws = workspaceName(app.ws, app.mode);
  // What an admin has to sort out (rule 3), then each module section's own.
  const needs = [...workspaceNeeds(app.snapshot, app.cycle, admin), ...sections.flatMap((s) => s.needs?.(app.snapshot, app.viewer) ?? [])];
  const shownNeeds = all ? needs : needs.slice(0, NEEDS_SHOWN);
  const left = app.snapshot.goals.filter((g) => !app.snapshot.retros.some((r) => r.goalId === g.id)).length;
  const admins = adminsLine(app.snapshot.people);
  const named = (ids: string[]) => ids.map((id) => installed.find((m) => m.id === id)?.name ?? id);
  const modOn = named(installed.filter((m) => on.has(m.id)).map((m) => m.id));
  const modOff = named(installed.filter((m) => !on.has(m.id)).map((m) => m.id));
  const teams = app.snapshot.teams.length;
  const fact = (label: string, body: ReactNode) => <><dt>{label}</dt><dd>{body}</dd></>;
  return (
    <>
      {needs.length > 0 && (
        <section className="stack ws-needs-block" style={{ gap: 'var(--s2)' }} aria-labelledby="ws-needs-title">
          <h2 className="label" id="ws-needs-title">To sort out · {needs.length}</h2>
          <ul className="ws-sort" aria-label="To sort out">
            {shownNeeds.map((x) => (
              <li key={x.id} className="ws-sort-row" data-need={x.id}>
                <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}><strong>{x.says}</strong><span className="hint">{x.why}</span></span>
                <Link className="btn sm" to={x.to}>{x.action}</Link>
              </li>
            ))}
          </ul>
          {needs.length > NEEDS_SHOWN && !all && <div><button type="button" className="linkish" onClick={() => setAll(true)}>and {needs.length - NEEDS_SHOWN} more</button></div>}
        </section>
      )}
      <section className="stack ws-about" style={{ gap: 'var(--s3)' }} aria-labelledby="ws-about-title">
        <WorkspaceName />
        <dl className="facts ws-facts">
          {fact('Name', <>{ws.name}{ws.kind && <span className="hint"> · {ws.kind}</span>}</>)}
          {fact('People', <Link to="/people">{app.snapshot.people.length} {app.snapshot.people.length === 1 ? 'person' : 'people'} in {teams} {teams === 1 ? 'team' : 'teams'}</Link>)}
          {fact('Year', <>{yearLine(app.cycle, app.week, app.today, left)} <Link to="/workspace/cycles">Cycles</Link></>)}
          {fact('Admins', <>{admins}. {admin ? <Link to="/workspace/access">Access</Link> : 'Ask one of them to add someone, change a team or change a setting.'}</>)}
          {installed.length > 0 && fact('Features', <>{featuresSentence(modOn, modOff)}{admin && <> <Link to="/workspace/features">Features</Link></>}</>)}
          {fact('Recording', <>{app.ws.recording !== false ? 'Faro records how the app is used here, never what anyone types.' : 'Nothing about how the app is used here is recorded.'} <Link to="/workspace/privacy">Privacy</Link></>)}
          {sections.filter((s) => s.says).map((s) => <span key={s.id} style={{ display: 'contents' }}>{fact(s.label, <>{s.says!(app)} <Link to={`/workspace/${s.id}`}>{s.label}</Link></>)}</span>)}
        </dl>
      </section>
      {narrow && <MoreSections />}
      {admin && app.ws.kind === 'own' && <DeleteWorkspace />}
    </>
  );
}

/* ---------- the admins' sections ---------- */

/** The workspace's cycles (goal years), newest first: their dates, which is running and how far in, their goals and
    check-ins, and what can be done with each: the running one's wrap-up, and deleting one nobody has checked in to. */
function CyclesSection() {
  const app = useApp();
  // Everyone reads the cycles; only admins delete one (8 Nov). The wrap-up is open to everyone, for their own goals.
  const admin = app.viewer.admin;
  const admins = app.snapshot.people.filter((p) => p.admin).map((p) => p.name);
  const cycles = app.full.cycles.filter((c) => !c.removedAt).sort((a, b) => b.startDate.localeCompare(a.startDate));
  return (
    <>
      <SectionHead id="cycles">A cycle is a goal year. One nobody has checked in to yet can be deleted with its goals; one with check-ins stays. The next one starts from the wrap-up at the end of the running one.{admin ? '' : ` Only admins delete a cycle or start the next${admins.length ? `: ${admins.join(', ')}` : ''}.`}</SectionHead>
      <section className="block cycles-block" aria-label="Cycles">
        <ul className="removed-list" aria-label="Cycles">
          {cycles.map((c) => {
            const st = cycleStanding(app.full, c.id);
            const current = c.id === app.cycle.id;
            const when = cycleWhen(c, current, app.week, app.today);
            return (
              <li key={c.id} className="removed-row">
                <span className="removed-text cycle-when">
                  <span className="removed-name">{c.name}</span>
                  <span className="small">{when.now} · {when.dates}</span>
                  <span className="hint">{st.says}</span>
                </span>
                <span className="team-actions">
                  {current && <Link className="btn sm" to="/retro">{wrapUpOpen(c, app.week) ? 'Wrap it up' : 'See the wrap-up'}</Link>}
                  {admin && st.deletable && <button type="button" className="btn sm" onClick={() => void app.deleteCycle(c.id).catch(() => undefined)} aria-label={`Delete the cycle ${c.name}`}>Delete</button>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
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
        <p className="hint">Make someone an admin, or stop them being one, from their page in <Link to="/people">People</Link> (Change details). There is always at least one.</p>
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
function WorkspaceName() {
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
            <input className={'input' + (tried && nameProblem(name, 'workspace') ? ' invalid' : '')} aria-invalid={tried && nameProblem(name, 'workspace') ? true : undefined} aria-describedby={nameLength(name) ? 'ws-name-length' : undefined} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {/* The limit is said while typing, never applied by cutting the name short (backlog WS). */}
          {nameLength(name) && <span id="ws-name-length" className={'hint' + (nameProblem(name, 'workspace')?.startsWith('Keep') ? ' tone-off' : '')} role="status">{nameLength(name)}</span>}
          {tried && nameProblem(name, 'workspace') && <span className="hint tone-off" role="alert">{nameProblem(name, 'workspace')}</span>}
        </div>
        <span className="ws-rename-buttons"><button type="submit" className="btn">{busy ? 'Saving…' : 'Save the name'}</button><button type="button" className="btn ghost" onClick={() => { setName(null); setTried(false); }}>Cancel</button></span>
      </form>
    );
  }
  const rename = app.viewer.admin && <button type="button" className="btn sm" onClick={() => setName(app.ws.name)} aria-label={`Rename ${app.ws.name}`}>Rename</button>;
  return (
    <div className="ws-title-row">
      <h2 className="block-title ws-title" id="ws-about-title">About this workspace</h2>
      {rename}
    </div>
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
  // Turning it on asks first; turning it off happens at once, with Undo (8 Nov). Undo puts back what was there.
  const flip = async (next: boolean, undoing = false) => {
    if (busy) return;
    if (next && !asking && !undoing) { setAsking(true); return; }
    setAsking(false);
    setBusy(true);
    try {
      await app.setRecording(next);
      const said = next ? `Recording is on in ${app.ws.name}.` : `Recording is off in ${app.ws.name}. Nothing more is sent.`;
      if (undoing) app.toast(said);
      else app.toast(said, 'success', { label: 'Undo', run: () => { void app.setRecording(!next).then(() => app.toast(next ? `Recording is off again in ${app.ws.name}.` : `Recording is on again in ${app.ws.name}.`)).catch(() => undefined); } });
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
      // Every switch says what it did, with Undo (8 Nov): a feature leaves or comes back for everyone at once.
      app.toast(next ? `${nameOf(id)} is on in ${app.ws.name}.` : `${nameOf(id)} is off in ${app.ws.name}. Nothing it saved is lost.`, 'success', {
        label: 'Undo',
        run: () => { void app.setModule(id, !next).then(() => app.toast(next ? `${nameOf(id)} is off again.` : `${nameOf(id)} is back on.`)).catch(() => undefined); },
      });
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
    <section className="danger-zone ws-delete" aria-labelledby="ws-delete-title">
      <h2 className="label" id="ws-delete-title">Delete</h2>
      <p className="hint">Deleting removes its people, goals, check-ins, reviews and history{app.mode === 'demo' ? ', from this browser' : ', for everyone'}. It can’t be undone.</p>
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
