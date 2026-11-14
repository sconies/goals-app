/* MCP access (backlog 10a; it was “AI assistants”): the personal MCP tokens Claude or another AI tool uses to act as one
   person through MCP. Faro has no AI built in: this is the door other AI tools use. Admins see, make and revoke every
   token on Workspace, AI access (AccessTokens; SW2); anyone sees and revokes their own in Settings (MyTokens). Tokens are
   made only there or from a person's page (app redesign WR3). With AI access switched off none of this is shown, but for
   the list Features opens from its read-back (TokenListSheet), where each can still be revoked. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import type { ApiToken } from '../domain/types';
import { Sheet, timeAgo } from './bits';
import { PersonPick } from './PersonPick';

/** In the demo, in place of the tokens: why there are none. */
const DEMO_LINE = 'Tokens work in the real app. The demo’s data stays in this browser, where an AI tool can’t reach it.';

const useLiveTokens = () => {
  const app = useApp();
  return (app.snapshot.tokens ?? []).filter((t) => !t.revokedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/** One token: what it's for, whom it acts as (unless they're yours), when it was made and last used, and Revoke. */
function TokenRow({ t, mine }: { t: ApiToken; mine: boolean }) {
  const app = useApp();
  return (
    <li className="token-row">
      <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
        <span>{t.name}{t.builder && <span className="hint"> · builder token</span>}</span>
        <span className="hint">{mine ? '' : `Acts as ${app.person(t.personId)?.name ?? 'someone'} · `}made {timeAgo(t.createdAt, app.today)} · {t.lastUsedAt ? `last used ${timeAgo(t.lastUsedAt, app.today)}` : 'not used yet'}</span>
      </span>
      <button type="button" className="btn sm" onClick={async () => { await app.revokeToken(t.id); app.toast(`Revoked “${t.name}”`); }} aria-label={`Revoke ${t.name}`}>Revoke</button>
    </li>
  );
}

/** Workspace, AI access (admins): every token, newest first, and Make a token (the real app only). */
export function AccessTokens() {
  const app = useApp();
  const [making, setMaking] = useState(false);
  const live = useLiveTokens();
  return (
    <section className="stack access-tokens" style={{ gap: 'var(--s2)' }} aria-labelledby="ws-tokens">
      <div className="row between">
        <h3 className="block-title" id="ws-tokens">MCP tokens · {app.mode === 'demo' ? 0 : live.length}</h3>
        {app.mode === 'live' && <button type="button" className="btn" onClick={() => setMaking(true)}>Make a token</button>}
      </div>
      <p className="hint">A token lets Claude or another AI tool act as one person here, with that person’s rights. Every change it makes is logged as theirs, marked “via MCP”.</p>
      {app.mode === 'demo' ? <p className="hint">{DEMO_LINE}</p> : !live.length ? <p className="hint">No MCP tokens yet.</p> : (
        <ul className="token-list" aria-label="MCP tokens">{live.map((t) => <TokenRow key={t.id} t={t} mine={false} />)}</ul>
      )}
      {making && <TokenSheet onClose={() => setMaking(false)} />}
    </section>
  );
}

/** Settings: the tokens that act as you, with Revoke. Making one is an admin's, on AI access. */
export function MyTokens() {
  const app = useApp();
  const mine = useLiveTokens().filter((t) => t.personId === app.viewer.id);
  return (
    <section className="block settings-block ai-block" aria-labelledby="ai-mine">
      <h2 className="block-title" id="ai-mine">Your MCP tokens · {app.mode === 'demo' ? 0 : mine.length}</h2>
      <p className="hint" style={{ marginTop: 0 }}>A token lets Claude or another AI tool act as you through MCP, with your rights. Every change it makes is logged as yours, marked “via MCP”.</p>
      {app.mode === 'demo' ? <p className="hint">{DEMO_LINE}</p> : mine.length > 0 && <ul className="token-list" aria-label="Your MCP tokens">{mine.map((t) => <TokenRow key={t.id} t={t} mine />)}</ul>}
      {app.mode === 'live' && <p className="hint">{app.viewer.admin ? <>Make one on <Link to="/workspace/ai">Workspace, AI access</Link>.</> : 'An admin makes a token for you.'}</p>}
    </section>
  );
}

/** Making a token: whom it acts as (chosen already from a person's page) and what it's for; then the token, once. */
export function TokenSheet({ onClose, personId: fixed }: { onClose: () => void; personId?: string }) {
  const app = useApp();
  const [personId, setPersonId] = useState(fixed ?? app.viewer.id);
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
        {fixed ? <p className="small">It acts as <strong>{who}</strong>.</p> : (
          <PersonPick label="Who it acts as" value={personId} onChange={setPersonId} />
        )}
        <span className="hint">The AI tool can do anything {who.split(' ')[0] || 'they'} can in the app, with the same rights: check in, change their own goals{app.person(personId)?.admin ? ' (and any goal, as they’re an admin)' : ''}, answer asks, take part in reviews and more.</span>
        <label className="field"><span className="field-label">What it’s for</span>
          <input className="input" value={name} placeholder="e.g. Claude on my laptop" onChange={(e) => setName(e.target.value)} />
        </label>
        <p className="hint">Until company sign-in arrives, the app itself doesn’t check who people are. A token makes clear who an AI tool acts for, and it can be revoked at any time.</p>
        <div className="foot-row"><button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary big-btn" disabled={name.trim().length < 2 || busy}>{busy ? 'Making…' : 'Make the token'}</button></div>
      </form>
    </Sheet>
  );
}

/** "See the {n} tokens", over Features' read-back for AI access (SW2, spec 4.2): every live token as AI access lists it,
    with Revoke, even while AI access is off. Closing it returns to the read-back, counted again. */
export function TokenListSheet({ onClose }: { onClose: () => void }) {
  const live = useLiveTokens();
  return (
    <Sheet open onClose={onClose} title={live.length === 1 ? '1 MCP token' : `${live.length} MCP tokens`}>
      <div className="stack" style={{ gap: 'var(--s3)' }}>
        {!live.length ? <p className="hint">No MCP tokens now.</p> : <ul className="token-list" aria-label="MCP tokens">{live.map((t) => <TokenRow key={t.id} t={t} mine={false} />)}</ul>}
        <div className="foot-row"><button type="button" className="btn ghost big-btn" onClick={onClose}>Back</button></div>
      </div>
    </Sheet>
  );
}
