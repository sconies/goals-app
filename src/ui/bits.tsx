import type { ReactNode } from 'react';
import { LABEL } from '../domain/status';
import type { DisplayStatus, Person } from '../domain/types';

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

export const Avatar = ({ p, small }: { p: Person; small?: boolean }) => (
  <span className={'avatar' + (small ? ' sm' : '')} aria-hidden="true">{p.initials}</span>
);

export function Header({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="hdr">
      <div className="stack" style={{ gap: 2 }}>
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
