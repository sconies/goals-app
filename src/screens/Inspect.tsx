/* The leader's view: outcome trees, the request on a goal, and the call they make on it.
   The weekly review is these goal pages in a fixed order, with next and previous. */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { openProposal, pendingSummary, type GoalAttention } from '../domain/attention';
import { fmt, gapText } from '../domain/format';
import { DECISION_LABEL, reviewQueue } from '../domain/review';
import { assessPosted, LABEL, RANK } from '../domain/status';
import { descendants, forecastText, statusChange, type TreeNode } from '../domain/tree';
import type { Decision, Goal } from '../domain/types';
import { Chip, StatusShape } from '../ui/bits';

/* ---------- review order: fixed when the review starts, so deciding doesn't reshuffle it ---------- */
const orderKey = (ws: string, week: number) => `goals-app-review:${ws}:${week}`;
export function saveReviewOrder(ws: string, week: number, ids: string[]) {
  try { sessionStorage.setItem(orderKey(ws, week), JSON.stringify(ids)); } catch { /* private mode: fall back to the live order */ }
}
function loadReviewOrder(ws: string, week: number): string[] | null {
  try { const v = sessionStorage.getItem(orderKey(ws, week)); return v ? JSON.parse(v) as string[] : null; } catch { return null; }
}

/** Where this goal sits in the weekly review, and how to move on from it. */
export function useReview(goalId: string) {
  const app = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const q = reviewQueue(app.snapshot, app.cycle, app.today, app.week);
  const inQueue = new Set(q.items.map((a) => a.goal.id));
  const order = loadReviewOrder(app.ws.id, app.week) ?? q.items.map((a) => a.goal.id);
  const isOpen = (id: string) => inQueue.has(id) && !q.handled.has(id);
  const index = order.indexOf(goalId);
  const go = (id: string | undefined) => nav(id ? `/goals/${id}?review=1` : '/review?from=end');
  const nextOpen = () => order.slice(index + 1).find((id) => id !== goalId && isOpen(id)) ?? order.slice(0, Math.max(0, index)).find((id) => id !== goalId && isOpen(id));
  return {
    active: params.get('review') === '1' && app.viewer.profile === 'sponsor' && index >= 0,
    total: order.length,
    done: order.filter((id) => !isOpen(id)).length,
    index,
    prev: () => { if (index > 0) go(order[index - 1]); },
    next: () => go(order[index + 1]),
    /** After a call: the next goal still open, or the summary. */
    afterDecision: () => { const n = nextOpen(); if (n) go(n); else nav('/review'); },
  };
}

export function ReviewBar({ goalId }: { goalId: string }) {
  const rv = useReview(goalId);
  const nav = useNavigate();
  if (!rv.active) return null;
  return (
    <div className="reviewbar" role="navigation" aria-label="Weekly review">
      <span className="small strong">Weekly review</span>
      <span className="hint">{rv.done} of {rv.total} done</span>
      <div className="bar ok" aria-hidden="true"><i style={{ width: `${rv.total ? (rv.done / rv.total) * 100 : 100}%` }} /></div>
      <button className="iconbtn" aria-label="Previous goal" disabled={rv.index <= 0} onClick={rv.prev}>‹</button>
      <button className="iconbtn" aria-label="Next goal" onClick={rv.next}>›</button>
      <button className="iconbtn" aria-label="Close the review" onClick={() => nav('/')}>✕</button>
    </div>
  );
}

/* ---------- what the sponsor is asked on a goal ---------- */
export function requestOf(goal: Goal, a: GoalAttention, app: ReturnType<typeof useApp>) {
  const proposal = openProposal(goal, app.snapshot.checkIns, app.snapshot.decisions);
  const latest = a.status.latest;
  const needs = latest?.pathToGreen?.needs || '';
  const stale = a.flags.find((f) => f.kind === 'stale');
  return { proposal, pending: !proposal ? goal.pending ?? null : null, needs, stale, latest };
}

/** "Elena Ruiz: approve an interim scope" reads as "Approve an interim scope" to Elena. */
const askText = (needs: string) => { const t = needs.replace(/^[^:]{2,40}:\s*/, ''); return t.charAt(0).toUpperCase() + t.slice(1); };

/** The question on this goal for the sponsor, said once, above everything else. */
export function RequestBlock({ goal, a }: { goal: Goal; a: GoalAttention }) {
  const app = useApp();
  const r = requestOf(goal, a, app);
  const owner = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'The owner';
  if (r.proposal && goal.kind === 'metric') {
    return (
      <section className="request" aria-label="Asks you">
        <span className="field-label">{owner} proposes a new target</span>
        <span className="proposal-change">{fmt(goal.plan.target, goal)} → {fmt(r.proposal.proposeTarget as number, goal)}</span>
        {r.proposal.why && r.proposal.why !== 'On plan.' && <p>“{r.proposal.why}”</p>}
      </section>
    );
  }
  if (r.pending) {
    return (
      <section className="request" aria-label="Asks you">
        <span className="field-label">{app.person(r.pending.byId)?.name.split(' ')[0] ?? owner} proposes a plan change</span>
        <span className="proposal-change">{pendingSummary(goal)}</span>
        <p>“{r.pending.reason}”</p>
        <span className="hint">If you approve, the old plan stays on the chart for comparison.</span>
      </section>
    );
  }
  if (r.needs) {
    return (
      <section className="request" aria-label="Asks you">
        <span className="field-label">{owner} asks you</span>
        <p className="request-ask">{askText(r.needs)}</p>
      </section>
    );
  }
  return null;
}

/** The sponsor's call on a goal. In the review it sits at the bottom of the screen and moves on after. */
export function DecideBar({ goal, a, inReview }: { goal: Goal; a: GoalAttention; inReview: boolean }) {
  const app = useApp();
  const rv = useReview(goal.id);
  const r = requestOf(goal, a, app);
  const owner = app.person(goal.ownerId);
  const first = owner?.name.split(' ')[0] ?? 'the owner';
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const decisions = app.snapshot.decisions.filter((d) => d.goalId === goal.id && d.week === app.week);

  const decide = async (kind: Decision['kind'], said?: string) => {
    if (busy) return;
    if (kind === 'ask' && note.trim().length < 3) { setAsking(true); return; }
    setBusy(true);
    try {
      // Agreeing to a request records what was agreed, so the owner sees it on their goal.
      const text = kind === 'acknowledge' && r.needs && !note.trim() ? `Agreed: ${askText(r.needs)}` : note;
      await app.decide(goal, kind, text, r.proposal && (kind === 'approve-target' || kind === 'decline-target') ? r.proposal : r.latest);
      app.toast(kind === 'ask' ? `Question sent to ${first}` : said ?? DECISION_LABEL[kind]);
      if (inReview) rv.afterDecision();
      else { setNote(''); setAsking(false); setBusy(false); }
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className={inReview ? 'decide' : 'decide inline'}>
      {decisions.length > 0 && <span className="calm small">✓ {decisions.map((d) => DECISION_LABEL[d.kind] + (d.note ? `: “${d.note}”` : '')).join('; ')}</span>}
      {(asking || note) && (
        <label className="field"><span className="field-label">{asking ? `Your question for ${first}` : `Note for ${first}`}</span>
          <input className="input" autoFocus value={note} onChange={(ev) => setNote(ev.target.value)} placeholder={asking ? 'e.g. What would it take to land the interim scope by week 8?' : 'Optional'} />
        </label>
      )}
      <div className="row decide-buttons">
        {asking ? (
          <>
            <button className="btn primary big-btn" disabled={busy} onClick={() => decide('ask')}>Send question</button>
            <button className="btn big-btn" disabled={busy} onClick={() => { setAsking(false); setNote(''); }}>Cancel</button>
          </>
        ) : r.proposal && goal.kind === 'metric' ? (
          <>
            <button className="btn primary big-btn" disabled={busy} onClick={() => decide('approve-target')}>Approve {fmt(r.proposal.proposeTarget as number, goal)}</button>
            <button className="btn big-btn" disabled={busy} onClick={() => decide('decline-target')}>Keep {fmt(goal.plan.target, goal)}</button>
          </>
        ) : r.pending ? (
          <>
            <button className="btn primary big-btn" disabled={busy} onClick={() => decide('approve-change')}>Approve change</button>
            <button className="btn big-btn" disabled={busy} onClick={() => decide('decline-change')}>Keep as is</button>
          </>
        ) : r.stale ? (
          <>
            <button className="btn primary big-btn" disabled={busy} onClick={() => { setNote(`Can you check in on ${goal.title} before the review?`); setAsking(true); }}>Ask for a check-in</button>
            <button className="btn big-btn" disabled={busy} onClick={() => decide('acknowledge')}>Seen, no action</button>
          </>
        ) : (
          <>
            <button className="btn primary big-btn" disabled={busy} onClick={() => decide('acknowledge', r.needs ? 'Agreed. Saved on the goal.' : undefined)}>{decisions.length ? 'Seen again' : r.needs ? 'Agree' : 'Seen, no action'}</button>
            <button className="btn big-btn" disabled={busy} onClick={() => decide('ask')}>Ask a question</button>
          </>
        )}
      </div>
      {!asking && (
        <div className="quiet-links">
          {(r.proposal || r.pending || r.stale) && <button type="button" className="linkish" onClick={() => decide('ask')}>Ask a question</button>}
          {!note && <button type="button" className="linkish" onClick={() => setNote(' ')}>Add a note</button>}
          {inReview && <button type="button" className="linkish" onClick={rv.next}>Skip for now</button>}
        </div>
      )}
    </div>
  );
}

/* ---------- outcome trees ---------- */
export function OutcomeCard({ node, compact }: { node: TreeNode; compact?: boolean }) {
  const app = useApp();
  const g = node.goal;
  const st = app.statusOf(g);
  const a = assessPosted(g, app.cycle, app.snapshot.checkIns, app.week);
  const gap = gapText(g, a);
  const fc = forecastText(g, a, app.cycle.weeks);
  const req = requestOf(g, app.attentionOf(g), app);
  const asksYou = app.viewer.profile === 'sponsor' && (!!req.proposal || !!req.pending || !!req.needs);
  const feed = descendants(node);
  const counts = (['off', 'risk', 'stale', 'on', 'done'] as const).map((k) => [k, feed.filter((c) => app.statusOf(c).status === k).length] as const).filter(([, n]) => n);
  const now = a.kind === 'milestone' ? `${a.doneCount} of ${a.stages.length} stages` : a.actual == null || g.kind === 'milestone' ? 'No value yet' : fmt(a.actual, g);
  return (
    <Link to={'/goals/' + g.id} className="outcome-card">
      <span className="outcome-title">{g.title}{asksYou && <span className="asks">Needs you</span>}</span>
      <span className="outcome-now">
        <Chip k={st.status} />
        <span className="big">{now}</span>
        {g.kind === 'metric' && <span className="hint">target {fmt(g.plan.target, g)}</span>}
        {st.status !== 'stale' && <span className={'small strong tone-' + gap.tone}>{gap.short}</span>}
      </span>
      {fc && !compact && <span className={fc.warn ? 'forecast small' : 'hint'}>{fc.warn && <span aria-hidden="true">↘ </span>}{fc.text}</span>}
      {feed.length > 0 && (
        <span className="stack" style={{ gap: 'var(--s2)' }}>
          <span className="mix" role="img" aria-label={counts.map(([k, n]) => `${n} ${LABEL[k].toLowerCase()}`).join(', ')}>
            {counts.map(([k, n]) => <i key={k} className={'mix-' + k} style={{ flexGrow: n }} />)}
          </span>
          <span className="hint">{feed.length} {feed.length === 1 ? 'goal feeds' : 'goals feed'} it: {counts.map(([k, n]) => `${n} ${LABEL[k].toLowerCase()}`).join(', ')}</span>
        </span>
      )}
    </Link>
  );
}

/** Worst first: what needs attention, then the status, then the name. */
export function worstFirst(app: ReturnType<typeof useApp>) {
  return (x: Goal, y: Goal) => app.attentionOf(y).weight - app.attentionOf(x).weight || RANK[app.statusOf(y).status] - RANK[app.statusOf(x).status] || x.title.localeCompare(y.title);
}

export function TreeRows({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  if (!nodes.length) return null;
  return (
    <ul className={depth ? 'tree sub' : 'tree'}>
      {nodes.map((n) => <li key={n.goal.id}><TreeRow g={n.goal} />{n.children.length > 0 && <TreeRows nodes={n.children} depth={depth + 1} />}</li>)}
    </ul>
  );
}

export function TreeRow({ g }: { g: Goal }) {
  const app = useApp();
  const att = app.attentionOf(g);
  const st = att.status;
  const a = assessPosted(g, app.cycle, app.snapshot.checkIns, app.week);
  const gap = gapText(g, a);
  const flag = att.flags.find((f) => f.kind !== 'due');
  const r = requestOf(g, att, app);
  const asksYou = app.viewer.profile === 'sponsor' && (!!r.proposal || !!r.pending || !!r.needs);
  const moved = statusChange(g, app.snapshot.checkIns);
  const owner = app.person(g.ownerId);
  const now = a.kind === 'milestone' ? `${a.doneCount} of ${a.stages.length} stages` : a.actual == null || g.kind === 'milestone' ? '—' : fmt(a.actual, g);
  return (
    <Link to={'/goals/' + g.id} className="trow" data-tone={st.status}>
      <span className={'trow-icon tone-' + st.status} aria-hidden="true"><StatusShape k={st.status} /></span>
      <span className="trow-main">
        <span className="trow-title">{g.title}</span>
        <span className="trow-why">
          {asksYou && <span className="asks">Needs you</span>}
          {moved?.worse && <span className="tone-risk">Was {LABEL[moved.from].toLowerCase()} in week {moved.week}. </span>}
          {flag ? flag.detail : `${owner?.name ?? 'The owner'}, ${LABEL[st.status].toLowerCase()}.`}
        </span>
      </span>
      <span className="trow-now"><span>{now}</span><span className={'tone-' + gap.tone}>{st.status === 'stale' ? 'Stale' : gap.short}</span></span>
      <span className="sr">{LABEL[st.status]}</span>
    </Link>
  );
}
