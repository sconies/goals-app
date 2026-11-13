/* The workspace switcher's panel (backlog WS; small workspaces SM4): every workspace you can open, this one marked
   "Open now" with your role, then About and setting one up. Loaded on first open, so the shell's first download carries
   only the button (small-workspaces spec, section 8). */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../app/state';
import { workspaceName } from '../domain/workspaceAttention';
import { Sheet } from './bits';
import { useSwitchWorkspace } from './WorkspaceSwitch';

export function WorkspacePanel({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const switchTo = useSwitchWorkspace();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const name = workspaceName(app.opening ?? app.ws, app.mode).name;
  const go = (to: string) => { onClose(); nav(to); };
  return (
    <Sheet open onClose={onClose} title="Workspaces">
      <div className="stack ws-switcher" style={{ gap: 'var(--s4)' }}>
        {app.workspaces.length >= 6 && (
          <label className="field"><span className="sr">Find a workspace</span>
            <input className="input" type="search" placeholder="Find a workspace" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        )}
        <div className="stack" style={{ gap: 4 }} role="group" aria-label="Your workspaces">
          {app.workspaces.filter((w) => !q.trim() || w.name.toLowerCase().includes(q.trim().toLowerCase())).map((w) => {
            const here = w.id === app.ws.id;
            const named = workspaceName(w, app.mode);
            // Your role is known for the open one; the others say what kind they are.
            const role = here ? `you’re ${app.viewer.admin ? 'an admin' : 'a member'}` : '';
            const line = [named.kind ? named.kind.charAt(0).toUpperCase() + named.kind.slice(1) : '', role].filter(Boolean).join(' · ');
            const body = (
              <span className="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}>
                <span className="strong ws-pick-name">{named.name}</span>
                {line && <span className="tiny muted">{line.charAt(0).toUpperCase() + line.slice(1)}</span>}
              </span>
            );
            return here
              ? <div key={w.id} className="menuitem ws-pick" aria-current="true">{body}<span className="tiny strong" style={{ color: 'var(--accent-text)' }}>Open now</span></div>
              : <button key={w.id} type="button" className="menuitem ws-pick" onClick={() => { onClose(); switchTo(w.id); }}>{body}</button>;
          })}
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <button type="button" className="menuitem ws-about-link" onClick={() => go('/workspace')}>
            <span className="strong">About {name}</span>
          </button>
          <button type="button" className="menuitem ws-new" onClick={() => go('/workspace/new')}>
            <span className="strong">Set up a new workspace</span>
          </button>
        </div>
      </div>
    </Sheet>
  );
}
