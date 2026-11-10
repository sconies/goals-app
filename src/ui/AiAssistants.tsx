/* MCP access (backlog 10a; it was “AI assistants”): the personal MCP tokens Claude or another AI tool uses to act as one
   person through MCP. Faro has no AI built in: this is the door other AI tools use. On Settings (your own) and
   Workspace (everyone's, for admins). */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { Sheet, timeAgo } from './bits';

/** Personal MCP tokens: admins make them; the AI tool using one acts as that person. In Settings (`mine`),
    your own tokens; on Workspace, an admin sees and manages everyone's. */
export function AiAssistants({ mine = false }: { mine?: boolean }) {
  const app = useApp();
  const [making, setMaking] = useState(false);
  const live = (app.snapshot.tokens ?? []).filter((t) => !t.revokedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shown = app.viewer.admin && !mine ? live : live.filter((t) => t.personId === app.viewer.id);
  const admins = app.snapshot.people.filter((p) => p.admin).map((p) => p.name);
  return (
    <section className="block ai-block" aria-labelledby={mine ? 'ai-mine' : 'ai-all'}>
      <div className="row between">
        <h2 className="block-title" id={mine ? 'ai-mine' : 'ai-all'}>{mine ? 'Your MCP access' : 'MCP access'}</h2>
        {app.viewer.admin && app.mode === 'live' && <button className="btn" onClick={() => setMaking(true)}>Make an MCP token</button>}
      </div>
      <p className="hint">Connect Claude or another AI tool to Faro through MCP. With an MCP token it reads these goals and posts check-ins or changes as one person: the same rights and rules, and every change is logged as theirs, marked “via MCP”.{mine ? ' These are the MCP tokens that act as you.' : ''}</p>
      {app.mode === 'demo'
        ? <p className="hint">This works in the real app. In the demo, data stays in your browser, where an AI tool can’t reach it.</p>
        : !shown.length
          ? <p className="hint">{app.viewer.admin ? (mine ? 'No MCP tokens act as you yet.' : 'No MCP tokens yet.') : `Ask an admin to make you an MCP token${admins.length ? `: ${admins.join(', ')}` : ''}.`}</p>
          : (
            <div className="optlist">
              {shown.map((t) => (
                <div key={t.id} className="opt static">
                  <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                    <span>{t.name}{t.builder && <span className="hint"> · builder token</span>}</span>
                    <span className="hint">{mine ? '' : `${app.person(t.personId)?.name ?? 'Someone'} · `}made {timeAgo(t.createdAt, app.today)} · {t.lastUsedAt ? `last used ${timeAgo(t.lastUsedAt, app.today)}` : 'not used yet'}{t.builder ? ' · made as a builder token before the inbox opened to everyone; it works as an ordinary one' : ''}</span>
                  </span>
                  <button className="btn sm" onClick={async () => { await app.revokeToken(t.id); app.toast(`Revoked “${t.name}”`); }} aria-label={`Revoke ${t.name}`}>Revoke</button>
                </div>
              ))}
            </div>
          )}
      {mine && app.viewer.admin && <p className="hint">As an admin, you see everyone’s tokens and make them for others on <Link to="/workspace/access">Workspace, Access</Link>.</p>}
      {making && <TokenSheet onClose={() => setMaking(false)} />}
    </section>
  );
}

function TokenSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [personId, setPersonId] = useState(app.viewer.id);
  const [name, setName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = `${location.origin}/api/mcp`;
  const make = async () => {
    if (name.trim().length < 2 || busy) return;
    setBusy(true);
    try { setToken(await app.createToken(personId, name)); } catch (e) { app.toast(e instanceof Error ? e.message : String(e), 'error'); }
    setBusy(false);
  };
  const copy = (text: string, what: string) => { void navigator.clipboard?.writeText(text).then(() => app.toast(`${what} copied`), () => undefined); };
  const who = app.person(personId)?.name ?? '';
  if (token) {
    const cmd = `claude mcp add --transport http goals ${url} --header "Authorization: Bearer ${token}"`;
    return (
      <Sheet open onClose={onClose} title={`Token for ${who}`}>
        <div className="stack" style={{ gap: 'var(--s4)' }}>
          <p className="hint tone-risk" role="status">Copy it now: it isn’t shown again. Anyone with it can act as {who.split(' ')[0]}, so keep it private.</p>
          <label className="field"><span className="field-label">Token</span>
            <span className="row nowrap" style={{ gap: 'var(--s2)' }}><input className="input mono" readOnly value={token} onFocus={(e) => e.target.select()} /><button type="button" className="btn" onClick={() => copy(token, 'Token')}>Copy</button></span>
          </label>
          <div className="field"><span className="field-label">Connect it</span>
            <span className="hint">Server: <code>{url}</code>, with the header <code>Authorization: Bearer</code> and the token. For Claude Code:</span>
            <span className="row nowrap" style={{ gap: 'var(--s2)' }}><input className="input mono" readOnly value={cmd} onFocus={(e) => e.target.select()} aria-label="Claude Code command" /><button type="button" className="btn" onClick={() => copy(cmd, 'Command')}>Copy</button></span>
            <span className="hint">An assistant that only takes a web address can use <code>{url}?token=</code> followed by the token.</span>
          </div>
          <div className="foot-row"><button type="button" className="btn primary big-btn" onClick={onClose}>Done</button></div>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet open onClose={onClose} title="Make an MCP token">
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void make(); }}>
        <label className="field"><span className="field-label">Who it acts as</span>
          <select className="input" value={personId} onChange={(e) => setPersonId(e.target.value)}>{app.snapshot.people.map((p) => <option key={p.id} value={p.id}>{app.personName(p.id)}</option>)}</select>
          <span className="hint">The assistant can do anything this person can in the app, with the same rights: check in, change their own goals{app.person(personId)?.admin ? ' (and any goal, as they’re an admin)' : ''}, answer requests, take part in reviews and more.</span>
        </label>
        <label className="field"><span className="field-label">What it’s for</span>
          <input className="input" value={name} placeholder="e.g. Claude on my laptop" onChange={(e) => setName(e.target.value)} />
        </label>
        <p className="hint">Until company sign-in arrives, the app itself doesn’t check who people are. A token makes clear who an assistant acts for, and you can switch it off here at any time.</p>
        <div className="foot-row"><button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary big-btn" disabled={name.trim().length < 2 || busy}>{busy ? 'Making…' : 'Make the token'}</button></div>
      </form>
    </Sheet>
  );
}
