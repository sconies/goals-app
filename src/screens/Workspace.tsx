import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import type { Profile } from '../domain/types';
import { Avatar, PROFILE_LABEL } from '../ui/bits';

export function WorkspaceHome() {
  const app = useApp();
  const [confirming, setConfirming] = useState(false);
  const people = (['lead', 'sponsor', 'coach', 'contributor'] as Profile[]).map((p) => [p, app.snapshot.people.filter((x) => x.profile === p)] as const).filter(([, l]) => l.length);
  return (
    <div className="page narrow">
      <div className="page-head">
        <h1 className="title-xl">Workspace</h1>
        <span className="hint">{app.mode === 'demo' ? 'The example, and any you set up here to try it. All of it stays in this browser.' : 'Each workspace has its own people, goals, cycle and change log.'}</span>
      </div>
      <section className="block">
        <div className="glist">
          {app.workspaces.map((w) => (
            <button key={w.id} className="gline ws-line" aria-current={w.id === app.ws.id ? 'true' : undefined} onClick={() => app.switchWorkspace(w.id)}>
              <span className={'wsmark' + (w.kind === 'example' ? ' example' : '')} aria-hidden="true">{w.name.slice(0, 1).toUpperCase()}</span>
              <span className="gline-title">{w.name}</span>
              <span className="gline-now">{w.id === app.ws.id ? 'Open now' : w.kind === 'example' ? 'Demo data' : 'Your data'}</span>
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <Link className="btn primary" to="/workspace/new">{app.mode === 'demo' ? 'Try setting up your own' : 'New workspace'}</Link>
          {app.mode === 'live' && <a className="btn" href="/demo">Try the demo</a>}
          {app.mode === 'demo' && app.ws.kind === 'example' && (confirming
            ? <><span className="small">Undo every change in the example?</span><button className="btn" onClick={async () => { await app.resetExample(); setConfirming(false); }}>Yes, reset it</button><button className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button></>
            : <button className="btn" onClick={() => setConfirming(true)}>Reset the example</button>)}
        </div>
      </section>
      <section className="block">
        <h2 className="block-title">People in {app.ws.name}</h2>
        {people.map(([p, list]) => (
          <div key={p} className="stack" style={{ gap: 4, marginBottom: 10 }}>
            <span className="label">{PROFILE_LABEL[p]} · {list.length}</span>
            <div className="people">{list.map((x) => <span key={x.id} className="person"><Avatar p={x} size="sm" />{x.name}</span>)}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
