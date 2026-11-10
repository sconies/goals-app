/* Settings: one person's own choices (review notes, 5 Nov). How the app looks (light, dark or the system's, and an
   accent colour), the sidebar, who you are, what the app records, and your MCP access. The look and the sidebar are
   kept in this browser. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { ACCENTS, LANDINGS, SIDEBARS, THEMES, impactWords, openMotionLab, paceWords, setAppearance, useAppearance } from '../app/appearance';
import { Avatar } from '../ui/bits';
import { BackLink } from '../ui/BackLink';
import { ProfileSheet } from '../ui/ProfileSheet';
import { MyTokens } from '../ui/AiAssistants';
import { LeaveWorkspaceSheet } from '../ui/RemoveSheets';
import { adminsLine, workspaceName } from '../domain/workspaceAttention';

export function Settings() {
  const app = useApp();
  const look = useAppearance();
  const [who, setWho] = useState(false);
  const team = app.team(app.viewer.teamId ?? '');
  const ws = workspaceName(app.ws, app.mode).name;
  return (
    <div className="page narrow settings-page">
      <BackLink to="/" label="Home" />
      <div className="page-head">
        <h1 className="title-xl">Settings</h1>
        <span className="hint">Your own choices. Nobody else sees them.</span>
      </div>

      <section className="block settings-block" aria-labelledby="set-you">
        <h2 className="block-title" id="set-you">You</h2>
        <div className="row settings-you">
          <Avatar p={app.viewer} />
          <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
            <span className="strong">{app.viewer.name}</span>
            <span className="hint">{[app.viewer.role, team?.name, `${app.viewer.admin ? 'admin' : 'member'} of ${ws}`].filter(Boolean).join(' · ')}</span>
          </span>
          <Link className="btn" to={`/people/${encodeURIComponent(app.viewer.id)}`}>Your page</Link>
          <button type="button" className="btn" onClick={() => setWho(true)}>{app.mode === 'demo' ? 'Switch person' : 'Not you?'}</button>
        </div>
        {!app.viewer.admin && <p className="hint">An admin changes your name, job title or team: {adminsLine(app.snapshot.people)}.</p>}
      </section>

      <section className="block settings-block" aria-labelledby="set-look">
        <h2 className="block-title" id="set-look">Appearance</h2>
        <div className="field">
          <span className="field-label" id="set-theme">Light or dark</span>
          <div className="seg" role="group" aria-labelledby="set-theme">
            {THEMES.map(([k, l]) => <button key={k} type="button" aria-pressed={look.theme === k} onClick={() => setAppearance({ theme: k })}>{l}</button>)}
          </div>
          <span className="hint">{look.theme === 'system' ? 'Follows your device: light by day, dark at night if it switches.' : `Always ${look.theme}, whatever your device does.`}</span>
        </div>
        <div className="field">
          <span className="field-label" id="set-accent">Accent colour</span>
          <div className="accent-list" role="radiogroup" aria-labelledby="set-accent">
            {ACCENTS.map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={look.accent === k} className="accent-opt" data-accent-choice={k} onClick={() => setAppearance({ accent: k })}>
                <span className="accent-swatch" aria-hidden="true" />
                <span>{l}</span>
              </button>
            ))}
          </div>
          <span className="hint">Faro’s teal is the default; the others are the earlier colours. The accent is for links and what’s selected. Status colours stay the same, so on track, at risk and off track always look alike.</span>
        </div>
        <p className="hint">Kept in this browser: on another device or browser, choose again.</p>
      </section>

      <section className="block settings-block" aria-labelledby="set-nav">
        <h2 className="block-title" id="set-nav">Navigation</h2>
        <div className="field">
          <span className="field-label" id="set-side">Sidebar</span>
          <div className="seg" role="group" aria-labelledby="set-side">
            {SIDEBARS.map(([k, l]) => <button key={k} type="button" aria-pressed={look.sidebar === k} onClick={() => setAppearance({ sidebar: k })}>{l}</button>)}
          </div>
          <span className="hint">Icons only gives the page more room; each icon names itself when you point at it. On a tablet the sidebar is always icons, and on a phone the tabs are along the bottom.</span>
        </div>
      </section>


      <MyTokens />

      <WhatIsRecorded />
      <ProfileSheet open={who} onClose={() => setWho(false)} />

      <section className="block settings-block motion-lab-entry" aria-labelledby="set-motion">
        <h2 className="block-title" id="set-motion">Motion lab</h2>
        <p className="hint" style={{ marginTop: 0 }}>For the moment a goal’s number lands. Off by default, so a goal’s page is readable the moment it opens. Switch the story on to watch the chart draw in and the number land; slow it down, make it hit harder, give it a wobble or a bounce. Purely for fun; nobody else sees your choice.</p>
        <span className="row" style={{ gap: 'var(--s3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn sm" onClick={openMotionLab}>Open the Motion lab</button>
          <span className="small muted">{look.story ? <>Story on · {paceWords(look.pace)} · {impactWords(look.impact)} impact · {LANDINGS.find(([k]) => k === look.landing)?.[1]}</> : 'Story off: goal pages show their chart and number at once'}</span>
        </span>
      </section>
      <LeaveWorkspace />
    </div>
  );
}

/** Leaving the open workspace, last on Settings (app redesign WR2: it moved from Workspace, which is about the
    workspace, to here, which is about you). It first asks who takes over your goals; the only admin is told why not. */
function LeaveWorkspace() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const ws = workspaceName(app.ws, app.mode).name;
  const only = app.viewer.admin && app.snapshot.people.filter((p) => p.admin).length === 1;
  return (
    <section className="block settings-block leave-zone" aria-labelledby="set-leave">
      <h2 className="block-title" id="set-leave">Leave {ws}</h2>
      <p className="hint" style={{ marginTop: 0 }}>Someone takes over your goals and open asks, and your history stays. An admin can bring you back for 30 days.</p>
      <div><button type="button" className="btn" disabled={only} aria-describedby={only ? 'leave-only' : undefined} onClick={() => setOpen(true)}>Leave this workspace…</button></div>
      {only && <p className="hint" id="leave-only">You’re the only admin. Make someone else an admin first, on <Link to="/workspace/access">Workspace, Access</Link>.</p>}
      {open && <LeaveWorkspaceSheet onClose={() => setOpen(false)} />}
    </section>
  );
}

/** What the app records about how it's used, in plain words: what is and isn't, how long, who can see it, and whether
    it's on here. The rules behind it are src/telemetry (the allow-list) and migration 0022 (90 days, then totals). */
function WhatIsRecorded() {
  const app = useApp();
  const ws = workspaceName(app.ws, app.mode).name;
  return (
    <section className="block settings-block" aria-labelledby="set-rec">
      <h2 className="block-title" id="set-rec">Recording</h2>
      <p className="small" style={{ marginTop: 0 }}>{app.ws.recording !== false ? <>Recording is on in {ws}. <Link to="/workspace/privacy">What’s recorded</Link></> : <>Recording is off in {ws}. <Link to="/workspace/privacy">Privacy</Link></>}</p>
    </section>
  );
}
