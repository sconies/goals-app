/* Connect Claude (backlog -2): one obvious place, at the top of the builder inbox, to let Claude read and triage it.
   A signed-in builder makes a builder token here, copies the exact set-up for a Claude cloud session (the host, and
   where the token goes) or for Claude Code, sees whether the server can send pictures (it needs the Supabase service
   role key on Vercel; if not, it says what to add where), and lists and revokes their builder tokens. Moves to the
   builders' area with backlog 0a. */
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../app/state';
import { timeAgo } from '../ui/bits';
import { builderTokens, makeBuilderToken, mcpAddress, revokeBuilderToken, serverCheck, type BuilderTokenRow } from './backend';

/** Who is looking: a builder signed in by email (who can make and revoke tokens), someone reading with a builder
    token, or a laptop with no database. */
export type ConnectAs = 'signed-in' | 'token' | 'local';

const PLACEHOLDER = 'gk_…';

export function ConnectClaude({ as }: { as: ConnectAs }) {
  const app = useApp();
  const [tokens, setTokens] = useState<BuilderTokenRow[] | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const [check, setCheck] = useState<Awaited<ReturnType<typeof serverCheck>>>(null);
  const load = useCallback(async () => {
    if (as !== 'signed-in') return;
    try { setTokens(await builderTokens()); } catch { setTokens([]); }
  }, [as]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { let live = true; void serverCheck().then((c) => { if (live) setCheck(c); }); return () => { live = false; }; }, []);
  const token = made ?? PLACEHOLDER;
  const canMake = as === 'signed-in' && app.mode === 'live';
  return (
    <section className="connect" aria-labelledby="connect-title">
      <h3 className="connect-title" id="connect-title">Connect Claude</h3>
      <p className="hint">So Claude can read this inbox, pictures included, and triage it with the same rules, through Faro’s MCP server. It needs a builder token.</p>
      {canMake && <MakeToken first={tokens !== null && !tokens.length} onMade={(t) => { setMade(t); void load(); }} />}
      {as === 'signed-in' && app.mode !== 'live' && <p className="hint">A builder token acts as you in a real workspace, so make one in the app’s inbox, not the demo’s. It reads the demo’s markups too.</p>}
      {as === 'token' && <p className="hint">You’re reading the inbox with a builder token. Sign in with your email to make or revoke tokens.</p>}
      {as === 'local' && <p className="hint">No database is set up here, so there are no builder tokens. This is what the set-up looks like.</p>}
      {made && <p className="hint tone-risk" role="status">Copy it now: it isn’t shown again. It acts as {app.viewer.name} in {app.ws.name} and can read and triage every markup and piece of feedback.</p>}
      {made && <Copyable label="Builder token" value={made} />}
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
        ? <p className="small connect-check" role="status">Pictures for Claude: ready. The server reads them itself.</p>
        : <p className="small connect-check tone-off" role="alert">Pictures for Claude: not yet. {check.problems.join(' ')}</p>)}
      {as === 'signed-in' && tokens && tokens.length > 0 && (
        <div className="stack" style={{ gap: 'var(--s2)' }}>
          <h4 className="field-label">Your builder tokens</h4>
          <div className="optlist">
            {tokens.map((t) => (
              <div key={t.id} className="opt static">
                <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                  <span>{t.name}</span>
                  <span className="hint">As {t.personName} in {t.workspaceName} · made {timeAgo(t.createdAt, app.today)} · {t.lastUsedAt ? `last used ${timeAgo(t.lastUsedAt, app.today)}` : 'not used yet'}</span>
                </span>
                <button type="button" className="btn sm" aria-label={`Revoke ${t.name}`} onClick={async () => {
                  try { await revokeBuilderToken(t.id); app.toast(`Revoked “${t.name}”`); void load(); } catch (e) { app.toast(e instanceof Error ? e.message : String(e), 'error'); }
                }}>Revoke</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MakeToken({ first, onMade }: { first: boolean; onMade: (token: string) => void }) {
  const app = useApp();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="row connect-make" onSubmit={async (e) => {
      e.preventDefault();
      if (name.trim().length < 2 || busy) return;
      setBusy(true);
      try { onMade(await makeBuilderToken(app.ws.id, app.viewer.id, name)); setName(''); } catch (err) { app.toast(err instanceof Error ? err.message : String(err), 'error'); }
      setBusy(false);
    }}>
      <label className="field" style={{ flex: 1 }}><span className="field-label">What the token is for</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude, reviewing markups" /></label>
      <button type="submit" className={'btn' + (first ? ' primary' : '')} disabled={name.trim().length < 2 || busy}>{busy ? 'Making…' : 'Make a builder token'}</button>
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
