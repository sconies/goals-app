/* Settings: one person's own choices (review notes, 5 Nov). How the app looks (light, dark or the system's, and an
   accent colour), the sidebar, who you are, and your AI assistants. The look and the sidebar are kept in this browser. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { ACCENTS, SIDEBARS, THEMES, setAppearance, useAppearance } from '../app/appearance';
import { Avatar } from '../ui/bits';
import { BackLink } from '../ui/BackLink';
import { ProfileSheet } from '../ui/ProfileSheet';
import { AiAssistants } from '../ui/AiAssistants';

export function Settings() {
  const app = useApp();
  const look = useAppearance();
  const [who, setWho] = useState(false);
  const team = app.team(app.viewer.teamId ?? '');
  return (
    <div className="page narrow settings-page">
      <BackLink to="/" label="Home" />
      <div className="page-head">
        <h1 className="title-xl">Settings</h1>
        <span className="hint">Your own choices. How the app looks and the sidebar are kept in this browser only: on another device or browser, choose again.</span>
      </div>

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
          <span className="hint">For links, buttons and what’s selected. Status colours stay the same, so on track, at risk and off track always look alike.</span>
        </div>
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

      <section className="block settings-block" aria-labelledby="set-you">
        <h2 className="block-title" id="set-you">You</h2>
        <div className="row settings-you">
          <Avatar p={app.viewer} />
          <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
            <span className="strong">{app.viewer.name}</span>
            <span className="hint">{[app.viewer.role, team?.name, app.viewer.admin ? 'admin' : ''].filter(Boolean).join(' · ') || 'No team'}</span>
          </span>
          <button type="button" className="btn" onClick={() => setWho(true)}>{app.mode === 'demo' ? 'Switch person' : 'Not you?'}</button>
        </div>
        <p className="hint">{app.viewer.admin ? <>Names, job titles and teams are changed on <Link to="/workspace">Workspace</Link>.</> : 'An admin changes your name, job title or team.'} You’re in {app.ws.name}.</p>
      </section>

      <AiAssistants mine />
      <ProfileSheet open={who} onClose={() => setWho(false)} />
    </div>
  );
}
