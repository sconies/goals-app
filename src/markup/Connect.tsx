/* Connect Claude (backlog -2, opened up by backlog O): one obvious place, at the top of the inbox, to let Claude read
   and triage it. Any Faro token works (an ordinary one, made by an admin; there are no builder tokens any more): an
   admin makes one for themselves here, anyone else is told who can. Then the exact set-up for a Claude cloud session
   (the host, and where the token goes) or for Claude Code, and whether the server can send Claude the pictures. Tokens
   are listed and revoked where they always are: Workspace, AI assistants (and Settings, for your own). */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { mcpAddress, serverCheck } from './backend';

const PLACEHOLDER = 'gk_…';

/** `local`: a laptop with no database, where there are no tokens to make. */
export function ConnectClaude({ local = false }: { local?: boolean }) {
  const app = useApp();
  const [made, setMade] = useState<string | null>(null);
  const [check, setCheck] = useState<Awaited<ReturnType<typeof serverCheck>>>(null);
  useEffect(() => { let live = true; void serverCheck().then((c) => { if (live) setCheck(c); }); return () => { live = false; }; }, []);
  const token = made ?? PLACEHOLDER;
  const canMake = !local && app.mode === 'live' && app.viewer.admin;
  const admins = app.snapshot.people.filter((p) => p.admin && !p.leftAt && !p.removedAt).map((p) => p.name);
  return (
    <section className="connect" aria-labelledby="connect-title">
      <h3 className="connect-title" id="connect-title">Connect Claude</h3>
      <p className="hint">So Claude can read this inbox, pictures included, and triage it with the same rules, through Faro’s MCP server. Any Faro token works: the one an AI assistant already uses, or a new one.</p>
      {canMake && !made && <MakeToken onMade={setMade} />}
      {!local && app.mode === 'live' && !app.viewer.admin && <p className="hint">Only admins make tokens. Ask {admins.length ? admins.join(', ') : 'an admin'} to make you one on Workspace, under Access, or use one you have (<Link to="/settings">Settings</Link> lists yours).</p>}
      {!local && app.mode !== 'live' && <p className="hint">Tokens are made in the real app, not the demo: any token from it reads the demo’s markups too.</p>}
      {local && <p className="hint">No database is set up here, so there are no tokens. This is what the set-up looks like.</p>}
      {made && <p className="hint tone-risk" role="status">Copy it now: it isn’t shown again. It acts as {app.viewer.name} in {app.ws.name}, like any token, and reads and triages the inbox. Revoke it on Workspace, under Access.</p>}
      {made && <Copyable label="Token" value={made} />}
      <div className="connect-setup">
        <div className="stack connect-way">
          <h4 className="field-label">A Claude cloud session (claude.ai/code)</h4>
          <ol className="connect-steps">
            <li>Host: <Copyable label="Host" value={location.host} inline /></li>
            <li>When Claude asks for a key for this host, paste the token into the secure form it shows. Or add it yourself, in the environment’s settings under network secrets: this host, the header <code>Authorization</code>, and <code>Bearer</code> followed by the token.</li>
            <li>Then ask Claude: <Copyable label="What to ask Claude" value={`Review Faro’s inbox: call the review_inbox tool on the MCP server at ${mcpAddress()} (JSON-RPC over POST; the network secret adds the token).`} /></li>
          </ol>
        </div>
        <div className="stack connect-way">
          <h4 className="field-label">Claude Code</h4>
          <Copyable label="Claude Code command" value={`claude mcp add --transport http faro ${mcpAddress()} --header "Authorization: Bearer ${token}"`} />
          <span className="hint">Then run <code>/mcp__faro__review_inbox</code>, or ask Claude to review Faro’s inbox.</span>
        </div>
      </div>
      {check && (check.pictures
        ? <p className="small connect-check" role="status">Pictures for Claude: ready.</p>
        : <p className="small connect-check tone-off" role="alert">Pictures for Claude: not yet. {check.problems.join(' ')}</p>)}
    </section>
  );
}

/** An admin makes an ordinary token for themselves, through the same action as Workspace's AI assistants. */
function MakeToken({ onMade }: { onMade: (token: string) => void }) {
  const app = useApp();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="row connect-make" onSubmit={async (e) => {
      e.preventDefault();
      if (name.trim().length < 2 || busy) return;
      setBusy(true);
      try { onMade(await app.createToken(app.viewer.id, name)); setName(''); } catch (err) { app.toast(err instanceof Error ? err.message : String(err), 'error'); }
      setBusy(false);
    }}>
      <label className="field" style={{ flex: 1 }}><span className="field-label">What the token is for</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude, reviewing markups" /></label>
      <button type="submit" className="btn" disabled={name.trim().length < 2 || busy}>{busy ? 'Making…' : 'Make a token'}</button>
    </form>
  );
}

/** A value with a Copy button: the exact text to paste somewhere else. */
function Copyable({ label, value, inline = false }: { label: string; value: string; inline?: boolean }) {
  const app = useApp();
  const copy = () => { void navigator.clipboard?.writeText(value).then(() => app.toast(`${label} copied`), () => app.toast('Couldn’t copy: select it and copy it yourself.', 'error')); };
  return (
    <span className={'row nowrap connect-copy' + (inline ? ' inline' : '')}>
      <input className="input mono" readOnly value={value} aria-label={label} onFocus={(e) => e.target.select()} />
      <button type="button" className="btn sm" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>Copy</button>
    </span>
  );
}
