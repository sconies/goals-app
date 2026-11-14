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
import { Avatar, Sheet } from '../ui/bits';
import { adminsLine, cycleLine, NEEDS_SHOWN, workspaceName, workspaceNeeds, yearLine } from '../domain/workspaceAttention';
import { canRestore, canUndoStart, cycleStanding, startOf } from '../domain/removal';
import { AccessTokens } from '../ui/AiAssistants';
import { RemoveAdmin, useSetAdmin } from '../ui/AdminControls';
import { PickOne } from '../ui/Pick';
import { Icon } from '../ui/Icon';
import { RecentlyRemoved } from '../ui/RecentlyRemoved';
import type { Cycle } from '../domain/types';
import { canStartNext, cycleDates, dayWithYear, laterCycle, nextCycleShape, wrapUpCycle, wrapUpOpenOn } from '../domain/cycle';
import { WarnMark } from '../ui/bits';
import { useWidth } from '../ui/useWidth';
import { CORE_SECTION_LABELS } from './workspaceSections';
import { movedTo } from '../domain/directory';
import { STATUS, WORKSPACE_MEANS } from '../domain/vocabulary';
import { reviewsOn } from '../app/reads';
import { switchOffLines, switchOffReadBack } from '../domain/reviewsOff';
import { dueWords } from '../domain/progress';
import { asksOf } from '../domain/asks';
import { rhythmAbout, rhythmChoiceOf, rhythmFact, rhythmLine, rhythmReadBack, rhythmReadBackLines, rhythmToast, type RhythmChoice } from '../domain/rhythm';
import { WEEKDAY } from '../domain/progress';

/** Below this width, Workspace is About and then its other sections as a list, one section at a time (a phone). */
const NARROW = 720;

/** The core's sections, in menu order. A module's sections follow the one they name in `after`, or come last. The
    landing section keeps the id `overview` (old links and modules name it); people read it as About (WR2). */
const CORE: WorkspaceSection[] = [
  { id: 'overview', label: CORE_SECTION_LABELS.overview, summary: 'What needs sorting out, then the facts about this workspace.', element: <AboutSection /> },
  { id: 'cycles', label: CORE_SECTION_LABELS.cycles, summary: 'The workspace’s goal years: their dates, which one is running, and what can be done with each.', element: <CyclesSection /> },
  { id: 'access', label: CORE_SECTION_LABELS.access, summary: 'Who the admins are, and MCP access: the tokens that let Claude or another AI tool act as someone here.', admins: true, element: <AccessSection /> },
  { id: 'features', label: CORE_SECTION_LABELS.features, summary: 'How this workspace works, and the optional parts of Faro.', admins: true, element: <FeaturesSection /> },
  // Everyone can read what is recorded about them; only admins switch it (re-review, 8 Nov, backlog T).
  { id: 'privacy', label: CORE_SECTION_LABELS.privacy, summary: 'What the app records about how it’s used here. Admins switch it on or off.', element: <PrivacySection /> },
  { id: 'removed', label: CORE_SECTION_LABELS.removed, summary: 'Anything removed in the last 30 days, with Restore. Anyone who isn’t an admin sees what they removed.', element: <RemovedSection /> },
];

/** Old anchors on the one-page Workspace, and the section each now is. */
const ANCHORS: Record<string, string> = { cycles: 'cycles', ai: 'access', tokens: 'access', access: 'access', features: 'features', recording: 'privacy', privacy: 'privacy', removed: 'removed' };

/** The sections someone sees, in order (rule 7, src/core/module.ts sectionsFor). */
export function useSections(): WorkspaceSection[] {
  const app = useApp();
  const { screens } = useModules();
  return sectionsFor(app.viewer, CORE, screens.flatMap((m) => m.sections ?? []));
}

/** Every section's name, whoever is looking (a page's name, navigation rule 2): the core's, then the modules'. */
export { useSectionNames } from './workspaceSections';

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
  const { installed, on, screens } = useModules();
  const [all, setAll] = useState(false);
  const admin = app.viewer.admin;
  const ws = workspaceName(app.ws, app.mode);
  // What an admin has to sort out (rule 3), then each module section's own, then what a module with no section raises
  // (AR2: toSortOut).
  const needs = [...workspaceNeeds(app.snapshot, app.cycle, admin, { reviews: reviewsOn(on) }), ...sections.flatMap((s) => s.needs?.(app.snapshot, app.viewer) ?? []), ...screens.flatMap((m) => m.toSortOut?.(app.snapshot, app.viewer) ?? [])];
  const shownNeeds = all ? needs : needs.slice(0, NEEDS_SHOWN);
  const left = app.snapshot.goals.filter((g) => !app.snapshot.retros.some((r) => r.goalId === g.id)).length;
  const admins = adminsLine(app.snapshot.people);
  const named = (ids: string[]) => ids.map((id) => installed.find((m) => m.id === id)?.name ?? id);
  // How you work (Reviews) first, then the tools, as Features lists them.
  const listed = [...installed].sort((a, b) => Number(reviewsOn(new Set([b.id]))) - Number(reviewsOn(new Set([a.id]))));
  const modOn = named(listed.filter((m) => on.has(m.id)).map((m) => m.id));
  const modOff = named(listed.filter((m) => !on.has(m.id)).map((m) => m.id));
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
          {/* What a workspace is, in one sentence, beside its name (outside review, 12 Nov). */}
          {fact('What it is', <span className="ws-means">{WORKSPACE_MEANS}</span>)}
          {fact('People', <Link to="/people">{app.snapshot.people.length} {app.snapshot.people.length === 1 ? 'person' : 'people'} in {teams} {teams === 1 ? 'team' : 'teams'}</Link>)}
          {fact('Year', <>{yearLine(app.cycle, app.week, app.today, left)} <Link to="/workspace/cycles">Cycles</Link></>)}
          {fact('Admins', <>{admins}. {admin ? <Link to="/workspace/access">Access</Link> : 'Ask one of them to add someone, change a team or change a setting.'}</>)}
          {fact('Features', <>{rhythmAbout(app.cycle)}{installed.length > 0 && <> {featuresSentence(modOn, modOff)}</>}{admin && <> <Link to="/workspace/features">Features</Link></>}</>)}
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

/** The workspace's cycles (goal years), newest first (WR4): each says where it stands in a word, its week and dates,
    its goals and check-ins, and its one action: the running one's wrap-up (or, for admins once every goal is wrapped
    up, the next cycle); deleting one nobody has checked in to is an admin's, asked first. */
function CyclesSection() {
  const app = useApp();
  const admin = app.viewer.admin;
  const [asking, setAsking] = useState<string | null>(null);
  const cycles = app.full.cycles.filter((c) => !c.removedAt).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const left = app.snapshot.goals.filter((g) => !app.snapshot.retros.some((r) => r.goalId === g.id)).length;
  const anyCheckIn = app.snapshot.checkIns.length > 0;
  // A next year set up from the wrap-up (cycle-end 2.4, 2.5): ready, opening on its week 1's Monday, undoable until used.
  const later = laterCycle(app.full.cycles, app.cycle);
  const undo = later && startOf(app.full, later.id) ? canUndoStart(app.full, later.id) : null;
  const [undoing, setUndoing] = useState(false);
  const undoStart = async (c: Cycle | undefined = later) => {
    if (!c) return;
    const before = app.full.cycles.filter((x) => !x.removedAt && x.startDate < c.startDate).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    setUndoing(true);
    try { await app.undoStart(c.id); app.toast(`${c.name} was undone. ${before?.name ?? 'The year before'} is as it was.`, 'success'); } catch { /* said by the toast */ } finally { setUndoing(false); }
  };
  return (
    <>
      <SectionHead id="cycles">A cycle is a goal year: its goals, plans and check-ins.</SectionHead>
      {later && undo?.ok && (
        <section className="block note-card cycle-ready" aria-label={`${later.name} is ready`}>
          <span className="small"><WarnMark /> <strong>{later.name} is ready.</strong> {cycleStanding(app.full, later.id).goals.toLocaleString('en-GB')} goals are set up. It opens for everyone on <strong>{dayWithYear(cycleDates(later).firstDay)}</strong>. Until then this is still {app.cycle.name}, week {Math.max(1, app.week)}.</span>
          {admin && <button type="button" className="btn sm" disabled={undoing} onClick={() => void undoStart(later)}>Undo</button>}
        </section>
      )}
      <section className="block cycles-block" aria-label="Cycles">
        <ul className="removed-list" aria-label="Cycles">
          {cycles.map((c) => {
            const st = cycleStanding(app.full, c.id);
            const current = c.id === app.cycle.id;
            const line = cycleLine(c, current, app.week, app.today, st);
            // An earlier year's wrap-up stays open after the next year is current, until the day it closes (cycle-end rule 3).
            const open = wrapUpOpenOn(c, app.today) && (current || wrapUpCycle(app.full.cycles, app.today)?.id === c.id);
            const start = startOf(app.full, c.id);
            const can = start ? canUndoStart(app.full, c.id) : null;
            const next = nextCycleShape(c).name;
            // Starting the next year isn't part of the wrap-up's weeks: it's offered from the day the wrap-up opens for as
            // long as no later year exists, even once the wrap-up has closed (build review, 11 Nov).
            const canStart = current && admin && canStartNext(app.full.cycles, c, app.today);
            const startLink = canStart ? <Link className="btn sm primary" to="/workspace/cycles/next">Start {next}</Link> : null;
            // Undo stays on a started year's own row once it's current, while nobody has used it (cycle-end rule 9).
            const undoHere = admin && can?.ok && c.id !== later?.id ? <button type="button" className="btn sm" disabled={undoing} onClick={() => void undoStart(c)}>Undo</button> : null;
            const action = !current ? (open ? <Link className="btn sm" to="/retro">Open the wrap-up</Link> : null)
              : open ? <><Link className="btn sm" to="/retro">Open the wrap-up</Link>{startLink}{undoHere}</>
              : <>{anyCheckIn && <Link className="btn sm" to="/retro">See the wrap-up</Link>}{startLink}{undoHere}</>;
            return (
              <li key={c.id} className="removed-row cycle-row">
                <span className="removed-text cycle-when">
                  <span className="removed-name">{line.title}</span>
                  <span className="small">{line.when}</span>
                  <span className="hint">{line.counts}</span>
                  {current && <span className="hint">{yearLine(c, app.week, app.today, left).replace(/^.*?\.\s/, '')}</span>}
                  {current && <span className="hint rhythm-fact">{rhythmFact(c)}{admin && <> <Link to="/workspace/features">Change</Link></>}</span>}
                  {start && <span className="hint">Started by {app.person(start.actorId)?.name ?? 'an admin'} on {dayWithYear(start.at.slice(0, 10))}. {can?.ok ? 'It can be undone until someone checks in or changes a goal in it.' : `It can’t be undone now: ${can && !can.ok ? can.why : ''}.`}</span>}
                </span>
                <span className="team-actions">
                  {action}
                  {admin && st.deletable && !start && asking !== c.id && <button type="button" className="btn sm ghost" onClick={() => setAsking(c.id)} aria-label={`Delete the cycle ${c.name}`}>Delete…</button>}
                </span>
                {asking === c.id && (
                  <span className="admin-confirm" role="group" aria-label={`Delete the cycle ${c.name}`}>
                    <span className="small">Delete {c.name} and its {st.goals} {st.goals === 1 ? 'goal' : 'goals'}? Nobody has checked in to it.</span>
                    <span className="row" style={{ gap: 'var(--s2)' }}>
                      <button type="button" className="btn sm danger" onClick={() => { setAsking(null); void app.deleteCycle(c.id).catch(() => undefined); }}>Yes, delete it</button>
                      <button type="button" className="btn sm ghost" onClick={() => setAsking(null)}>Cancel</button>
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {!admin && <p className="hint">Admins start the next cycle and delete an empty one.</p>}
      </section>
    </>
  );
}

/** Access (admins, WR3): the admins, where they are made and taken back, then every MCP token. */
function AccessSection() {
  const app = useApp();
  const [adding, setAdding] = useState(false);
  const setAdmin = useSetAdmin();
  const admins = app.snapshot.people.filter((p) => p.admin).sort((a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }));
  return (
    <>
      <SectionHead id="access">Who the admins are, and the MCP tokens that let an AI tool act as someone here.</SectionHead>
      <section className="stack admins-block" style={{ gap: 'var(--s2)' }} aria-labelledby="ws-admins">
        <div className="row between">
          <h3 className="block-title" id="ws-admins">Admins · {admins.length}</h3>
          <button type="button" className="btn primary" onClick={() => setAdding(true)}>Add an admin</button>
        </div>
        <p className="hint">Admins add people, change teams and settings, and make MCP tokens. There is always at least one.</p>
        <ul className="admin-list" aria-label="Admins">
          {admins.map((p) => (
            <li key={p.id} className="admin-row">
              <Avatar p={p} size="sm" />
              <span className="person-text"><span><Link className="person-name" to={`/people/${encodeURIComponent(p.id)}`}>{p.name}</Link>{p.id === app.viewer.id && <span className="hint"> · you</span>}</span>{p.role && <span className="hint">{p.role}</span>}</span>
              <RemoveAdmin p={p} setAdmin={setAdmin} />
            </li>
          ))}
        </ul>
      </section>
      <AccessTokens />
      {adding && <AddAdminSheet setAdmin={setAdmin} onClose={() => setAdding(false)} />}
    </>
  );
}

/** "Add an admin": find a person (FS1's find-and-pick; anyone already an admin is refused, saying so), then make them one. */
function AddAdminSheet({ onClose, setAdmin }: { onClose: () => void; setAdmin: ReturnType<typeof useSetAdmin> }) {
  const app = useApp();
  const [pick, setPick] = useState<string | null>(null);
  const chosen = pick ? app.person(pick) : undefined;
  return (
    <Sheet open onClose={onClose} title="Add an admin">
      <div className="stack" style={{ gap: 'var(--s4)' }}>
        <PickOne kind="person" label="Who" value={pick} onChange={setPick} refuse={(row) => (app.person(row.id)?.admin ? 'Already an admin' : null)} />
        <div className="foot-row">
          <button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary big-btn" disabled={!chosen} onClick={() => { if (chosen) { onClose(); void setAdmin(chosen, true); } }}>{chosen ? `Make ${chosen.name.split(/\s+/)[0]} an admin` : 'Make them an admin'}</button>
        </div>
      </div>
    </Sheet>
  );
}

function FeaturesSection() {
  const app = useApp();
  return (
    <>
      <SectionHead id="features">How {workspaceName(app.ws, app.mode).name} works, and the optional parts of Faro. They apply to everyone here.</SectionHead>
      <Features />
    </>
  );
}

function PrivacySection() {
  const app = useApp();
  return (
    <>
      <SectionHead id="privacy">What Faro records about how the app is used in {workspaceName(app.ws, app.mode).name}.</SectionHead>
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
      <label className="switch-row record-check">
        <span className="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}>
          <span>Record how the app is used here</span>
          <span className="hint">Pages opened, buttons pressed, errors and slow pages. Never anything anyone types. Kept 90 days, then daily totals. Only the people who build Faro can read it.</span>
        </span>
        <span className="switch-word">{on ? 'On' : 'Off'}</span>
        {app.viewer.admin && <input type="checkbox" className="switch" checked={on} disabled={busy} onChange={(e) => void flip(e.target.checked)} aria-label="Record how the app is used here" />}
      </label>
      {!app.viewer.admin && <p className="hint">Admins change it{admins.length ? `: ${admins.join(', ')}` : ''}.</p>}
      {app.viewer.admin && asking ? (
        <div className="reset-confirm" role="group" aria-label="Turn recording on">
          <span className="small">Record how everyone in {app.ws.name} uses the app, from now on? Nothing anyone types is recorded.</span>
          <span className="row" style={{ gap: 'var(--s2)' }}>
            <button type="button" className="btn" onClick={() => void flip(true)}>Yes, turn it on</button>
            <button type="button" className="btn ghost" onClick={() => setAsking(false)}>Cancel</button>
          </span>
        </div>
      ) : null}
      <p className="hint"><Link to="/help/recording">What’s recorded, exactly</Link></p>
    </section>
  );
}

/**
 * For admins: the feature modules this workspace uses (docs/architecture.md), each switched on or off for everyone. How
 * you work (Reviews, FT2) comes first, then the tools. Switching Reviews off first says what will change and what stays
 * (the read-back, spec 4.2); switching anything on, or a tool off, acts at once. Every switch says what it did, with Undo.
 */
function Features() {
  const app = useApp();
  const { installed, on, off } = useModules();
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [rhythm, setRhythm] = useState(false);
  const nameOf = (id: string) => installed.find((m) => m.id === id)?.name ?? id;
  const isReviews = (id: string) => reviewsOn(new Set([id]));
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
  const live = app.snapshot.reviews.filter((r) => !r.removedAt && !r.endedAt).length;
  const row = (m: (typeof installed)[number]) => {
    const why = off.get(m.id);
    const switched = (app.ws.modulesOff ?? []).includes(m.id);
    return (
      <label key={m.id} className="switch-row feature-check">
        <span className="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}>
          <span>{m.name}</span>
          <span className="hint">{m.summary}</span>
          {isReviews(m.id) && on.has(m.id) && live > 0 && <span className="hint">{live} {live === 1 ? 'review is' : 'reviews are'} set up.</span>}
          {!switched && why?.kind === 'needs' && <span className="hint">Off until {why.missing.map(nameOf).join(' and ')} is on.</span>}
        </span>
        {/* The state in a word beside the switch, never only its position (WR4, P6). */}
        <span className="switch-word" aria-hidden="true">{on.has(m.id) ? 'On' : 'Off'}</span>
        <input type="checkbox" className="switch" checked={!switched} disabled={!!busy} aria-label={m.name}
          onChange={(e) => { if (!e.target.checked && isReviews(m.id)) setAsking(m.id); else void flip(m.id, e.target.checked); }} />
      </label>
    );
  };
  const how = installed.filter((m) => isReviews(m.id));
  const tools = installed.filter((m) => !isReviews(m.id));
  return (
    <section className="block features-block" aria-label="Features">
      <div className="stack features-group" aria-labelledby="features-how">
        <h2 className="label" id="features-how">How you work</h2>
        {/* The check-in rhythm (FT1): not a module, a setting of the running year; Change opens its sheet. */}
        <div className="switch-row feature-check rhythm-row">
          <span className="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}>
            <span>Check-in rhythm</span>
            <span className="hint">{rhythmLine(app.cycle)}</span>
          </span>
          <button type="button" className="btn sm" onClick={() => setRhythm(true)}>Change</button>
        </div>
        {how.map(row)}
      </div>
      {tools.length > 0 && (
        <div className="stack features-group" aria-labelledby="features-tools">
          <h2 className="label" id="features-tools">Tools</h2>
          {tools.map(row)}
        </div>
      )}
      <p className="hint">Switching one off hides it and keeps what it saved. <Link to="/help/features">About features</Link></p>
      {rhythm && <RhythmSheet onClose={() => setRhythm(false)} />}
      {asking && <ReviewsOffSheet onClose={() => setAsking(null)} onSwitch={() => { const id = asking; setAsking(null); void flip(id, false); }} />}
    </section>
  );
}

/** The check-in rhythm's sheet (FT1, spec 4.2): every week by a day, or no set rhythm; what changes for everyone, counted
    by rhythmReadBack, once the choice differs from what is saved; Save, with Undo on the toast. */
function RhythmSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const saved = rhythmChoiceOf(app.cycle);
  const [to, setTo] = useState<RhythmChoice>(saved);
  const [busy, setBusy] = useState(false);
  const counts = rhythmReadBack(app.snapshot.goals, app.snapshot.checkIns, app.cycle, to, app.today);
  const lines = rhythmReadBackLines(app.cycle, to, counts, app.today);
  const before = { weeks: saved.weeks, dueDay: saved.dueDay, from: app.cycle.rhythmFrom ?? null };
  const save = async () => {
    setBusy(true);
    try {
      const said = rhythmToast(app.cycle, to);
      await app.setRhythm({ weeks: to.weeks, dueDay: to.dueDay });
      onClose();
      app.toast(said, 'success', { label: 'Undo', run: () => { void app.setRhythm(before).then(() => app.toast('The check-in rhythm is as it was.')).catch(() => undefined); } });
    } catch { setBusy(false); }
  };
  const opt = (weeks: number, label: string, line: string) => (
    <button type="button" role="radio" aria-checked={to.weeks === weeks} className="opt rhythm-opt" onClick={() => setTo({ ...to, weeks })}>
      <span className="stack" style={{ gap: 0 }}><span>{label}</span><span className="hint" style={{ fontWeight: 400 }}>{line}</span></span>
    </button>
  );
  return (
    <Sheet open onClose={onClose} title="Check-in rhythm">
      <div className="stack readback" style={{ gap: 'var(--s3)' }}>
        <div className="optlist" role="radiogroup" aria-label="Check-in rhythm">
          {opt(1, 'Every week', `Check-ins are due by a day you choose. A goal with none for 14 days reads “${STATUS.stale.label}”.`)}
          {opt(0, 'No set rhythm', 'Owners check in when there’s news. Nothing is due or late for want of a check-in.')}
        </div>
        {to.weeks === 1 && (
          <label className="field">
            <span className="label">Due by</span>
            <select value={to.dueDay} onChange={(e) => setTo({ ...to, dueDay: Number(e.target.value) })}>
              {WEEKDAY.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </label>
        )}
        {lines.length > 0 && (
          <section aria-labelledby="rhythm-changes">
            <h2 className="small strong" id="rhythm-changes">What changes for everyone here</h2>
            <ul className="readback-lines">
              {lines.map((l) => <li key={l.strong + l.rest}>{l.strong && <strong>{l.strong}</strong>}{l.rest}</li>)}
            </ul>
          </section>
        )}
        <div className="foot-row">
          <button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary big-btn" disabled={busy || !lines.length} onClick={() => void save()}>Save</button>
        </div>
      </div>
    </Sheet>
  );
}

/** The read-back before switching Reviews off (FT2, spec 4.2): what leaves, and what stays, counted by the rule. */
function ReviewsOffSheet({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
  const app = useApp();
  const ws = workspaceName(app.ws, app.mode).name;
  const r = switchOffReadBack({ people: app.snapshot.people, reviews: app.snapshot.reviews, changes: app.snapshot.changes, asks: asksOf(app.snapshot), decisions: app.snapshot.decisions, goals: app.snapshot.goals, dueDay: dueWords(false, app.cycle, app.week).day });
  return (
    <Sheet open onClose={onClose} title={`Switch off Reviews in ${ws}?`}>
      <div className="stack readback" style={{ gap: 'var(--s3)' }}>
        <p>For all {r.people} {r.people === 1 ? 'person' : 'people'} here:</p>
        <ul className="readback-lines">
          {switchOffLines(r).map((l) => <li key={l.strong + l.rest}>{l.strong && <strong>{l.strong}</strong>}{l.rest}</li>)}
        </ul>
        <div className="foot-row">
          <button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary big-btn" onClick={onSwitch}>Switch off Reviews</button>
        </div>
      </div>
    </Sheet>
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
