import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Flag, GoalAttention } from '../domain/attention';
import { LABEL } from '../domain/status';
import type { DisplayStatus, Person, Profile } from '../domain/types';

/** Status is shape plus word, never colour alone. */
export function StatusShape({ k }: { k: DisplayStatus }) {
  if (k === 'on') return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="currentColor" stroke="currentColor" strokeWidth="2" /></svg>;
  if (k === 'risk') return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" /></svg>;
  if (k === 'off') return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
  if (k === 'done') return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="m5 8.2 2 2 4-4.4" fill="none" stroke="var(--surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2.5 2.5" /></svg>;
}

const chipClass = (k: DisplayStatus) => (k === 'none' ? 'planned' : k);

export function Chip({ k, label, className }: { k: DisplayStatus; label?: string; className?: string }) {
  return (
    <span className={'chip ' + chipClass(k) + (className ? ' ' + className : '')}>
      <StatusShape k={k} />
      {label ?? LABEL[k]}
    </span>
  );
}

/** A neutral label, not a status. */
export const Tag = ({ children }: { children: ReactNode }) => <span className="chip tag">{children}</span>;

export const Dot = ({ k }: { k: DisplayStatus }) => <span className={'dot ' + chipClass(k)} aria-hidden="true" />;

export const Avatar = ({ p, size }: { p: Pick<Person, 'initials' | 'name'>; size?: 'sm' | 'lg' }) => (
  <span className={'avatar' + (size ? ' ' + size : '')} aria-hidden="true" data-hue={hue(p.name)}>{p.initials}</span>
);
const hue = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 6;

export const PROFILE_LABEL: Record<Profile, string> = { lead: 'Team lead', sponsor: 'Sponsor', coach: 'Goals coach', contributor: 'Contributor' };
export const PROFILE_HELP: Record<Profile, string> = {
  lead: 'Owns goals and checks in each week',
  sponsor: 'Runs the weekly review and makes the calls',
  coach: 'Sets up workspaces and keeps the rhythm going',
  contributor: 'Follows the goals their work feeds',
};

export function Header({ eyebrow, title, sub, actions }: { eyebrow?: ReactNode; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="hdr">
      <div className="stack" style={{ gap: 2, minWidth: 0 }}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'ahead' | 'off' | 'on' | '' }) {
  return (
    <div className={'stat' + (tone ? ' ' + tone : '')}>
      <span className="tiny muted">{label}</span>
      <span className="big">{value}</span>
      {note && <span className="tiny" style={{ color: 'var(--fg-2)' }}>{note}</span>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flat stack">
      <span className="h3">{title}</span>
      {children}
    </div>
  );
}

/** A ring that fills as work gets done. The number in the middle is what's left. */
export function ProgressRing({ done, total, size = 56, label }: { done: number; total: number; size?: number; label?: string }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r, frac = total ? done / total : 1;
  const complete = total > 0 && done >= total;
  return (
    <span className={'ring' + (complete ? ' complete' : '')} style={{ width: size, height: size }} role="img" aria-label={label ?? `${done} of ${total} done`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        {frac > 0 && <circle cx={size / 2} cy={size / 2} r={r} className="ring-fill" strokeDasharray={`${c * frac} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
      </svg>
      <span className="ring-text" aria-hidden="true">
        {complete ? <svg viewBox="0 0 16 16" width={size / 2.6} height={size / 2.6}><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg> : `${done}/${total}`}
      </span>
    </span>
  );
}

/** Where you are in a flow: a bar with "Step 2 of 4 · label". */
export function Steps({ at, of, label }: { at: number; of: number; label?: string }) {
  return (
    <div className="steps" aria-label={`Step ${at} of ${of}${label ? ': ' + label : ''}`}>
      <div className="steps-bar" aria-hidden="true">
        {Array.from({ length: of }, (_, i) => <i key={i} className={i < at - 1 ? 'done' : i === at - 1 ? 'now' : ''} />)}
      </div>
      <span className="tiny muted">Step {at} of {of}{label ? ' · ' + label : ''}</span>
    </div>
  );
}

const flagStatus = (f: Flag): DisplayStatus => (f.tone === 'off' ? 'off' : f.tone === 'risk' ? 'risk' : f.tone === 'stale' ? 'stale' : 'planned');

/** A flag as words with its status icon: no filled pill, so a list stays calm. */
export function FlagPill({ f }: { f: Flag }) {
  return <span className={'flag flag-' + f.kind} data-tone={f.tone}><StatusShape k={flagStatus(f)} />{f.label}</span>;
}

/** One goal that needs someone, as a list row: status icon, name, the reason in one line, one action. */
export function AttentionCard({ a, action, to }: { a: GoalAttention; action?: ReactNode; to: string }) {
  const flags = a.flags.filter((f) => f.kind !== 'due');
  const top = flags[0] ?? a.flags[0];
  if (!top) return null;
  return (
    <div className="arow" data-tone={top.tone}>
      <span className="arow-icon" data-tone={top.tone}><StatusShape k={flagStatus(top)} /></span>
      <Link to={to} className="arow-main">
        <span className="arow-title">{a.goal.title}</span>
        <span className="arow-why"><span className="arow-flags">{flags.slice(0, 2).map((f) => f.label).join(' · ')}</span>{flags.length ? ' — ' : ''}{top.detail}</span>
      </Link>
      {action && <div className="arow-action">{action}</div>}
    </div>
  );
}

const DATE_FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

/** "3 h ago" for recent changes, a plain date for older ones. */
export function timeAgo(iso: string, now: Date): string {
  const s = Math.max(0, (now.getTime() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  const d = Math.round(s / 86400);
  if (d < 14) return d === 1 ? 'yesterday' : d + ' days ago';
  return new Date(iso).toLocaleDateString('en-GB', DATE_FMT);
}

/** A panel that slides up on a phone and drops down as a popover on a desktop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, a, input, select')?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><span className="h3">{title}</span><button className="iconbtn" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
