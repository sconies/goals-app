/* The builder inbox, on Workspace: markups people sent, newest first, grouped when they're about the same part of the
   same page, each with its status as a shape and a word (New, In hand, Fixed, Won't fix). A markup opens with its
   picture (the drawing can be hidden), the parts it names, the steps before it, errors, and where it came from.
   Builders sign in here with an email link (Supabase Auth) and triage: mark it in hand, open its GitHub issue (a
   pre-filled link; paste the issue's address back), mark it fixed in a What's new entry, or say why it won't be fixed.
   Admins who aren't builders can't read it until sign-in comes (release 4). With no database, it shows the markups
   kept in this browser, without signing in.
   Feedback sent with a mood and a few words joins it (Lane, 6 Nov; migration 0026): listed among the markups, newest
   first, and triaged with the same states and rules (src/markup/feedback.ts). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { WHATS_NEW } from '../help/whatsNew';
import { Sheet, timeAgo } from '../ui/bits';
import { builderClient, builderSession, inboxFeedback, inboxOps, makeBuilderToken, markupsShared, sendSignInLink, signOutBuilder, type BuilderSession } from './backend';
import type { FeedbackOps, InboxFeedback } from './feedback';
import { PartPath } from './Markup';
import { MOOD_WORD, STATUS_WORD, groupMarkups, namedParts, problemText, stepText, type Markup, type MarkupStatus } from './model';
import type { ListedMarkup, MarkupOps, OpenedMarkup } from './ops';

/** A markup's status: its shape and its word, always together. Diamonds, so they're never read as a goal's status. */
export function MarkupStatusMark({ status }: { status: MarkupStatus }) {
  const d = 'M8 1.8 14.2 8 8 14.2 1.8 8z';
  return (
    <span className={`mk-status mk-${status}`}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        {status === 'new' && <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" />}
        {status === 'in-hand' && <><path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 1.8 1.8 8 8 14.2z" fill="currentColor" /></>}
        {status === 'fixed' && <><path d={d} fill="currentColor" stroke="currentColor" strokeWidth="1.6" /><path d="m5.3 8.2 1.9 1.8 3.5-3.6" fill="none" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>}
        {status === 'wont-fix' && <><path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m5 11 6-6" stroke="currentColor" strokeWidth="1.6" /></>}
      </svg>
      <span>{STATUS_WORD[status]}</span>
    </span>
  );
}

type Access = { kind: 'loading' } | { kind: 'local' } | { kind: 'signed-out' } | { kind: 'signed-in'; session: BuilderSession } | { kind: 'error'; text: string };

export default function Inbox() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const shared = markupsShared();
  const [access, setAccess] = useState<Access>(shared ? { kind: 'loading' } : { kind: 'local' });
  const [ops, setOps] = useState<MarkupOps | null>(null);
  const [list, setList] = useState<ListedMarkup[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(params.get('markup'));
  const [fbOps, setFbOps] = useState<FeedbackOps | null>(null);
  const [feedback, setFeedback] = useState<InboxFeedback[]>([]);
  const [openFb, setOpenFb] = useState<string | null>(null);
  // With no database, the inbox's feedback is this workspace's, as the app has it now.
  const appNow = useRef(app);
  appNow.current = app;
  const here = useMemo(() => ({
    workspaceId: app.ws.id, workspaceName: app.ws.name,
    feedback: () => appNow.current.snapshot.feedback ?? [],
    personName: (id: string) => appNow.current.person(id)?.name ?? '',
  }), [app.ws.id, app.ws.name]);

  // Who is signed in to the inbox here: also finishes a sign-in arriving from the email link.
  const refresh = useCallback(async () => {
    if (!shared) { setOps(await inboxOps()); setFbOps(await inboxFeedback(here)); return; }
    try {
      const session = await builderSession();
      setAccess(session ? { kind: 'signed-in', session } : { kind: 'signed-out' });
      setOps(session?.builder ? await inboxOps() : null);
      setFbOps(session?.builder ? await inboxFeedback(here) : null);
    } catch (e) { setAccess({ kind: 'error', text: e instanceof Error ? e.message : String(e) }); }
  }, [shared, here]);
  useEffect(() => {
    void refresh();
    if (!shared) return;
    let stop: (() => void) | undefined;
    void builderClient().then((db) => { stop = db.auth.onAuthStateChange(() => { void refresh(); }).data.subscription.unsubscribe; });
    return () => stop?.();
  }, [refresh, shared]);
  const load = useCallback(async () => {
    if (!ops) return;
    try { setList(await ops.list({})); } catch (e) { app.toast(e instanceof Error ? e.message : String(e), 'error'); setList([]); }
  }, [ops, app]);
  useEffect(() => { void load(); }, [load]);
  // Feedback is listed when the database can give it (migration 0026); without it the inbox still shows markups.
  const loadFeedback = useCallback(async () => {
    if (!fbOps) { setFeedback([]); return; }
    try { setFeedback(await fbOps.list()); } catch { setFeedback([]); }
  }, [fbOps]);
  useEffect(() => { void loadFeedback(); }, [loadFeedback]);
  // Coming back from the email link, the inbox is where the page opens.
  useEffect(() => { if (params.get('inbox')) document.getElementById('inbox')?.scrollIntoView({ block: 'start' }); }, [params]);

  const groups = useMemo(() => groupMarkups(list ?? []), [list]);
  // Markups (grouped by part) and feedback, newest first.
  const rows = useMemo(() => [
    ...groups.map((g) => ({ kind: 'markup' as const, key: 'm:' + g.key, at: g.markups[0]!.createdAt, g })),
    ...feedback.map((f) => ({ kind: 'feedback' as const, key: 'f:' + f.id, at: f.at, f })),
  ].sort((a, b) => b.at.localeCompare(a.at)), [groups, feedback]);
  const newCount = (list ?? []).filter((m) => m.status === 'new').length + feedback.filter((f) => f.status === 'new').length;
  const openedFb = openFb ? feedback.find((f) => f.id === openFb) ?? null : null;
  const builderName = access.kind === 'signed-in' ? access.session.email : 'This browser';
  const open = (id: string | null) => {
    setOpenId(id);
    const next = new URLSearchParams(params);
    if (id) next.set('markup', id); else next.delete('markup');
    setParams(next, { replace: true });
  };

  return (
    <section className="block inbox-block" id="inbox" aria-labelledby="inbox-title">
      <div className="row between">
        <h2 className="block-title" id="inbox-title">Inbox{list ? <span className="hint count-after">· {newCount} new</span> : null}</h2>
        {access.kind === 'signed-in' && <button type="button" className="btn sm ghost" onClick={async () => { await signOutBuilder(); setList(null); void refresh(); }}>Sign out</button>}
      </div>
      <p className="hint">What people send with Send feedback: markups (a picture of a screen with their drawing, and a line saying what should change) and feedback (a mood and a few words). {shared ? 'For the people building Faro, who sign in here.' : 'No database is set up, so these are the markups sent from this browser and this workspace’s feedback.'}</p>
      {access.kind === 'loading' && <p className="hint" role="status">Checking who’s signed in…</p>}
      {access.kind === 'error' && <p className="hint tone-off" role="alert">{access.text}</p>}
      {access.kind === 'signed-out' && <SignIn />}
      {access.kind === 'signed-in' && !access.session.builder && (
        <p className="hint" role="status">You’re signed in as {access.session.email}, which isn’t on the builders list. Until sign-in comes to the whole app, only builders read markups; admins will see their own workspace’s then.</p>
      )}
      {ops && list === null && <p className="hint" role="status">Loading markups…</p>}
      {ops && list && !rows.length && <p className="hint">Nothing yet. When someone marks up a screen or sends feedback, it arrives here.</p>}
      {ops && list && rows.length > 0 && (
        <ul className="mk-list">
          {rows.map((r) => {
            if (r.kind === 'feedback') return <li key={r.key}><FeedbackRow f={r.f} onOpen={() => setOpenFb(r.f.id)} /></li>;
            const g = r.g;
            const m = g.markups[0]!;
            return (
              <li key={r.key}>
                <button type="button" className="mk-row" onClick={() => open(m.id)}>
                  <MarkupStatusMark status={m.status} />
                  {m.thumbUrl ? <img className="mk-thumb" src={m.thumbUrl} alt="" loading="lazy" /> : <span className="mk-thumb empty" aria-hidden="true" />}
                  <span className="stack mk-row-text">
                    <span className="mk-line">{m.line}</span>
                    <span className="tiny muted">{namedParts(m)[0] ? <PartPath path={namedParts(m)[0]!} /> : m.route}</span>
                    <span className="tiny muted">{m.personName || 'Someone'}, {m.demo ? 'the demo' : m.workspaceName}, {timeAgo(m.createdAt, app.today)}{g.markups.length > 1 ? <strong className="mk-count"> · {g.markups.length} on this part</strong> : null}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {access.kind === 'signed-in' && access.session.builder && app.mode === 'live' && <BuilderToken />}
      {ops && openId && <Detail id={openId} ops={ops} by={builderName} siblings={groups.find((g) => g.markups.some((m) => m.id === openId))?.markups ?? []} onOpen={open} onChanged={load} />}
      {fbOps && openedFb && <FeedbackDetail f={openedFb} ops={fbOps} by={builderName} onClose={() => setOpenFb(null)} onChanged={(id, t) => setFeedback((xs) => xs.map((x) => (x.id === id ? { ...x, ...t } : x)))} />}
    </section>
  );
}

function SignIn() {
  const app = useApp();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (sent) return <p className="hint" role="status">Check your email: the link in it signs you in and brings you back here, in this browser.</p>;
  return (
    <form className="stack inbox-signin" style={{ gap: 'var(--s2)' }} onSubmit={async (e) => {
      e.preventDefault();
      if (!/^\S+@\S+\.\S+$/.test(email.trim()) || busy) return;
      setBusy(true);
      try { await sendSignInLink(email); setSent(true); } catch (err) { app.toast('Couldn’t send the link: ' + (err instanceof Error ? err.message : String(err)), 'error'); }
      setBusy(false);
    }}>
      <label className="field"><span className="field-label">Building Faro? Sign in with your email</span>
        <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </label>
      <div><button type="submit" className="btn" aria-disabled={busy || undefined}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button></div>
      <span className="hint">Only the inbox signs in; the rest of the app doesn’t change. <Link to="/help/inbox">About the inbox</Link></span>
    </form>
  );
}

/** A builder token, so a builder's AI assistant can use the markup tools (list_markups, get_markup, update_markup). */
function BuilderToken() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  if (!open) return <p className="hint"><button type="button" className="linkish" onClick={() => setOpen(true)}>Make a builder token for your AI assistant</button></p>;
  if (token) return (
    <div className="stack" style={{ gap: 'var(--s2)' }}>
      <p className="hint tone-risk" role="status">Copy it now: it isn’t shown again. It acts as {app.viewer.name} in {app.ws.name} and can read and triage markups.</p>
      <input className="input mono" readOnly value={token} aria-label="Builder token" onFocus={(e) => e.target.select()} />
    </div>
  );
  return (
    <form className="row" style={{ gap: 'var(--s2)', alignItems: 'flex-end' }} onSubmit={async (e) => {
      e.preventDefault();
      try { setToken(await makeBuilderToken(app.ws.id, app.viewer.id, name)); } catch (err) { app.toast(err instanceof Error ? err.message : String(err), 'error'); }
    }}>
      <label className="field" style={{ flex: 1 }}><span className="field-label">What it’s for</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude on my laptop" /></label>
      <button type="submit" className="btn" disabled={name.trim().length < 2}>Make it</button>
    </form>
  );
}

function Detail({ id, ops, by, siblings, onOpen, onChanged }: { id: string; ops: MarkupOps; by: string; siblings: Markup[]; onOpen: (id: string | null) => void; onChanged: () => void }) {
  const app = useApp();
  const [m, setM] = useState<OpenedMarkup | null>(null);
  const [failed, setFailed] = useState('');
  const [ink, setInk] = useState(true);
  const [form, setForm] = useState<'fixed' | 'wont-fix' | 'issue' | null>(null);
  const [issue, setIssue] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setM(null); setForm(null); setFailed('');
    ops.open(id).then((x) => { if (live) setM(x); }, (e: unknown) => { if (live) setFailed(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [id, ops]);
  const act = async (run: () => Promise<Markup>, done: string) => {
    if (busy) return;
    setBusy(true);
    try { const next = await run(); setM((x) => (x ? { ...x, ...next } : x)); setForm(null); app.toast(done); onChanged(); } catch (e) { app.toast(e instanceof Error ? e.message : String(e), 'error'); }
    setBusy(false);
  };
  const openIssue = async () => {
    try { window.open(await ops.issueLink(id), '_blank', 'noopener'); setForm('issue'); } catch (e) { app.toast(e instanceof Error ? e.message : String(e), 'error'); }
  };
  const notes = m?.strokes.flatMap((s) => (s.kind === 'note' && s.text ? [s] : [])) ?? [];
  return (
    <Sheet open wide onClose={() => onOpen(null)} title={m ? `Markup: ${m.line.length > 48 ? m.line.slice(0, 47) + '…' : m.line}` : 'Markup'}>
      {failed && <p className="hint tone-off" role="alert">{failed}</p>}
      {!m && !failed && <p className="hint" role="status">Opening the markup…</p>}
      {m && (
        <div className="stack mk-detail" style={{ gap: 'var(--s4)' }}>
          <div className="row between" style={{ flexWrap: 'wrap', gap: 'var(--s2)' }}>
            <MarkupStatusMark status={m.status} />
            <span className="tiny muted">{m.personName || 'Someone'}, {m.demo ? 'from the demo' : `in ${m.workspaceName}`}, {timeAgo(m.createdAt, app.today)}{m.mood ? ` · ${MOOD_WORD[m.mood]}` : ''}</span>
          </div>
          <p className="mk-said">{m.line}</p>
          <figure className="mk-figure">
            {m.urls.screen ? (
              <span className="mk-layers">
                <img src={m.urls.screen} alt={`The screen ${m.personName || 'they'} marked up, on ${m.route}`} />
                {ink && m.urls.ink && <img className="mk-ink-layer" src={m.urls.ink} alt="" />}
              </span>
            ) : <span className="hint">The picture isn’t there.</span>}
            {m.urls.ink && <label className="check"><input type="checkbox" checked={ink} onChange={(e) => setInk(e.target.checked)} /><span>Show the drawing</span></label>}
          </figure>
          <Actions m={m} busy={busy} form={form} setForm={setForm} onInHand={() => act(() => ops.setStatus(id, { status: 'in-hand', by }), 'Marked in hand')} onIssue={openIssue} onReopen={() => act(() => ops.setStatus(id, { status: 'new', by }), 'Marked new again')} />
          {form === 'issue' && (
            <form className="stack mk-form" onSubmit={(e) => { e.preventDefault(); void act(() => ops.setIssueUrl(id, issue), 'Kept the issue’s address'); }}>
              <label className="field"><span className="field-label">Paste issue link</span><input className="input" value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="https://github.com/sconies/goals-app/issues/123" autoFocus /></label>
              <span className="hint">GitHub opened in a new tab with the issue filled in: press Submit there, then paste its address here.</span>
              <div className="row" style={{ gap: 'var(--s2)' }}><button type="submit" className="btn">Keep the link</button><button type="button" className="btn ghost" onClick={() => setForm(null)}>Not now</button></div>
            </form>
          )}
          {form === 'fixed' && (
            <FixedForm onFixed={(fixedIn) => act(() => ops.setStatus(id, { status: 'fixed', fixedIn, by }), 'Marked fixed')} onCancel={() => setForm(null)}
              hint={`${m.personName || 'The sender'} sees “You raised this” on that entry. List the markup’s id (${m.id}) in the entry’s fixes, too.`} />
          )}
          {form === 'wont-fix' && <WontFixForm onWontFix={(reason) => act(() => ops.setStatus(id, { status: 'wont-fix', reason, by }), 'Marked won’t fix')} onCancel={() => setForm(null)} />}
          {m.issueUrl && <p className="small">Issue: <a href={m.issueUrl} target="_blank" rel="noopener noreferrer">{m.issueUrl.replace('https://github.com/', '')}</a></p>}
          {m.fixedIn && <p className="small">Fixed in <Link to={`/whats-new#${m.fixedIn}`}>{WHATS_NEW.find((e) => e.id === m.fixedIn)?.title ?? m.fixedIn}</Link>.</p>}
          {m.wontFixReason && <p className="small">Won’t fix: {m.wontFixReason}</p>}
          <div className="mk-facts">
            <section>
              <h3 className="field-label">Parts named</h3>
              {namedParts(m).length ? <ul className="mk-parts">{namedParts(m).map((p, i) => <li key={i}><PartPath path={p} /></li>)}</ul> : <p className="hint">No named part under the drawing.</p>}
              {notes.length > 0 && <><h3 className="field-label">Notes on the picture</h3><ol className="mk-notes">{notes.map((n) => <li key={n.n} value={n.n}>{n.text}</li>)}</ol></>}
            </section>
            <section>
              <h3 className="field-label">Where it was sent from</h3>
              <dl className="mk-where">
                <dt>Page</dt><dd><code>{m.path || m.route}</code></dd>
                {m.goalId && <><dt>Goal</dt><dd><code>{m.goalId}</code></dd></>}
                {m.reviewId && <><dt>Review</dt><dd><code>{m.reviewId}</code></dd></>}
                <dt>Screen</dt><dd>{m.context.viewport.w} by {m.context.viewport.h}, {m.context.theme}{m.context.themeChoice === 'system' ? ' (the device’s)' : ''}, accent {m.context.accent}</dd>
                <dt>Version</dt><dd><code>{m.context.appVersion}</code></dd>
                <dt>Markup</dt><dd><code>{m.id}</code></dd>
              </dl>
            </section>
          </div>
          <section>
            <h3 className="field-label">Steps before it</h3>
            {m.steps.length ? <ol className="mk-steps">{m.steps.map((s, i) => <li key={i}>{stepText(s)}</li>)}</ol> : <p className="hint">Not included.</p>}
          </section>
          <section>
            <h3 className="field-label">Errors and failed saves on that visit</h3>
            {m.errors.length ? <ul className="mk-errors">{m.errors.map((e, i) => <li key={i}>{problemText(e)}</li>)}</ul> : <p className="hint">None.</p>}
          </section>
          {siblings.length > 1 && (
            <section>
              <h3 className="field-label">On the same part</h3>
              <ul className="mk-siblings">{siblings.map((s) => <li key={s.id}><button type="button" className="linkish" aria-current={s.id === id || undefined} onClick={() => onOpen(s.id)}>{s.line}</button> <span className="tiny muted">{timeAgo(s.createdAt, app.today)}, <MarkupStatusMark status={s.status} /></span></li>)}</ul>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** The next step for a markup is the main action; the others are plain. */
function Actions({ m, busy, form, setForm, onInHand, onIssue, onReopen }: { m: Pick<Markup, 'status' | 'issueUrl'>; busy: boolean; form: string | null; setForm: (f: 'fixed' | 'wont-fix' | null) => void; onInHand: () => void; onIssue?: () => void; onReopen: () => void }) {
  if (form === 'fixed') return null;
  const open = m.status === 'new' || m.status === 'in-hand';
  return (
    <div className="row mk-actions" style={{ gap: 'var(--s2)', flexWrap: 'wrap' }}>
      {m.status === 'new' && <button type="button" className="btn primary" aria-disabled={busy || undefined} onClick={onInHand}>Mark in hand</button>}
      {open && onIssue && !m.issueUrl && <button type="button" className="btn" onClick={onIssue}>Open GitHub issue</button>}
      {open && <button type="button" className={'btn' + (m.status === 'in-hand' ? ' primary' : '')} onClick={() => setForm('fixed')}>Mark fixed</button>}
      {open && <button type="button" className="btn" onClick={() => setForm('wont-fix')}>Won’t fix</button>}
      {!open && <button type="button" className="btn" onClick={onReopen}>Mark new again</button>}
    </div>
  );
}

/** Marking something fixed: in which What's new entry. */
function FixedForm({ hint, onFixed, onCancel }: { hint: string; onFixed: (fixedIn: string) => void; onCancel: () => void }) {
  const [fixedIn, setFixedIn] = useState(WHATS_NEW[0]?.id ?? '');
  return (
    <form className="stack mk-form" onSubmit={(e) => { e.preventDefault(); onFixed(fixedIn); }}>
      <label className="field"><span className="field-label">Fixed in this What’s new entry</span>
        <select className="input" value={fixedIn} onChange={(e) => setFixedIn(e.target.value)}>{WHATS_NEW.slice(0, 30).map((e) => <option key={e.id} value={e.id}>{e.date}: {e.title}</option>)}</select>
      </label>
      <span className="hint">{hint}</span>
      <div className="row" style={{ gap: 'var(--s2)' }}><button type="submit" className="btn primary">Mark fixed</button><button type="button" className="btn ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

/** Saying why something won't be fixed. */
function WontFixForm({ onWontFix, onCancel }: { onWontFix: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <form className="stack mk-form" onSubmit={(e) => { e.preventDefault(); onWontFix(reason); }}>
      <label className="field"><span className="field-label">Why it won’t be fixed</span><textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></label>
      <div className="row" style={{ gap: 'var(--s2)' }}><button type="submit" className="btn" disabled={!reason.trim()}>Won’t fix</button><button type="button" className="btn ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

/** A piece of feedback in the inbox list: its status, a speech mark where a markup has its picture, its words, its
    mood and page, who sent it, where and when. */
function FeedbackRow({ f, onOpen }: { f: InboxFeedback; onOpen: () => void }) {
  const app = useApp();
  return (
    <button type="button" className="mk-row fb-row" onClick={onOpen}>
      <MarkupStatusMark status={f.status} />
      <span className="mk-thumb fb-thumb" aria-hidden="true"><svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /></svg></span>
      <span className="stack mk-row-text">
        <span className="mk-line">{f.text.trim() || MOOD_WORD[f.mood]}</span>
        <span className="tiny muted">Feedback · {MOOD_WORD[f.mood]} · {f.path || '/'}</span>
        <span className="tiny muted">{f.personName || 'Someone'}, {f.workspaceName || f.workspaceId}, {timeAgo(f.at, app.today)}</span>
      </span>
    </button>
  );
}

/** A piece of feedback opened: what was said, from where, and the same triage as a markup (no picture, no issue). */
function FeedbackDetail({ f, ops, by, onClose, onChanged }: { f: InboxFeedback; ops: FeedbackOps; by: string; onClose: () => void; onChanged: (id: string, t: Partial<InboxFeedback>) => void }) {
  const app = useApp();
  const [form, setForm] = useState<'fixed' | 'wont-fix' | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (c: Parameters<FeedbackOps['setStatus']>[1], done: string) => {
    if (busy) return;
    setBusy(true);
    try { onChanged(f.id, await ops.setStatus(f.id, c)); setForm(null); app.toast(done); } catch (e) { app.toast(e instanceof Error ? e.message : String(e), 'error'); }
    setBusy(false);
  };
  const said = f.text.trim();
  return (
    <Sheet open onClose={onClose} title={`Feedback: ${said ? (said.length > 48 ? said.slice(0, 47) + '…' : said) : MOOD_WORD[f.mood]}`}>
      <div className="stack mk-detail" style={{ gap: 'var(--s4)' }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 'var(--s2)' }}>
          <MarkupStatusMark status={f.status} />
          <span className="tiny muted">{f.personName || 'Someone'}, in {f.workspaceName || f.workspaceId}, {timeAgo(f.at, app.today)} · {MOOD_WORD[f.mood]}</span>
        </div>
        {said ? <p className="mk-said">{said}</p> : <p className="hint">Only a mood, no words.</p>}
        <Actions m={{ status: f.status, issueUrl: null }} busy={busy} form={form} setForm={setForm} onInHand={() => act({ status: 'in-hand', by }, 'Marked in hand')} onReopen={() => act({ status: 'new', by }, 'Marked new again')} />
        {form === 'fixed' && <FixedForm hint={`${f.personName || 'The sender'} sees “You raised this” on that entry. List the feedback’s id (${f.id}) in the entry’s fixes, too.`} onFixed={(fixedIn) => act({ status: 'fixed', fixedIn, by }, 'Marked fixed')} onCancel={() => setForm(null)} />}
        {form === 'wont-fix' && <WontFixForm onWontFix={(reason) => act({ status: 'wont-fix', reason, by }, 'Marked won’t fix')} onCancel={() => setForm(null)} />}
        {f.fixedIn && <p className="small">Fixed in <Link to={`/whats-new#${f.fixedIn}`}>{WHATS_NEW.find((e) => e.id === f.fixedIn)?.title ?? f.fixedIn}</Link>.</p>}
        {f.wontFixReason && <p className="small">Won’t fix: {f.wontFixReason}</p>}
        <dl className="mk-where">
          <dt>Page</dt><dd><code>{f.path || '/'}</code></dd>
          <dt>Feedback</dt><dd><code>{f.id}</code></dd>
        </dl>
      </div>
    </Sheet>
  );
}
