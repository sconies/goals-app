import { createPortal } from 'react-dom';
import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Flag, GoalAttention } from '../domain/attention';
import { LABEL } from '../domain/status';
import type { DisplayStatus, Goal, Level, Person } from '../domain/types';
import { LEVEL_LABEL } from '../domain/format';
import { Icon } from './Icon';
import { useMaybeApp, useToasts } from '../app/state';

/**
 * Status is shape plus word, never colour alone. When a shape's status changes in place (a check-in previewed or
 * posted), the new shape is drawn fresh and fades in over the old one (motion layer).
 */
export function StatusShape({ k }: { k: DisplayStatus }) {
  const first = useRef(k);
  const cls = 'status-shape' + (first.current !== k ? ' shape-swap' : '');
  // data-status names the status the shape stands for, so a check can hold it to the word beside it (SHAPE_WORDS).
  const at = { className: cls, viewBox: '0 0 16 16', 'aria-hidden': true, 'data-status': k } as const;
  if (k === 'on') return <svg key={k} {...at}><circle cx="8" cy="8" r="6" fill="currentColor" stroke="currentColor" strokeWidth="2" /></svg>;
  if (k === 'risk') return <svg key={k} {...at}><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" /></svg>;
  if (k === 'off') return <svg key={k} {...at}><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
  if (k === 'done') return <svg key={k} {...at}><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="m5 8.2 2 2 4-4.4" fill="none" stroke="var(--surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <svg key={k} {...at}><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2.5 2.5" /></svg>;
}

/** A small warning mark: the app's own shape, not an emoji. */
export function WarnMark() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8 6.2v3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="8" cy="11.8" r="1" fill="currentColor" /></svg>;
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

/**
 * A status as it leads a row, card or node: its shape, then its word, in the status's colour. Every list's status slot
 * is this, so the shape never appears without its word. `className` names the slot (it comes first, then the tone);
 * `wordClass` styles the word; anything after the word (a result, say) goes in `children`.
 */
export function StatusWord({ k, className, wordClass, children, as: Tag = 'span' }: { k: DisplayStatus; className?: string; wordClass?: string; children?: ReactNode; as?: 'span' | 'li' }) {
  return (
    <Tag className={(className ? className + ' ' : '') + 'tone-' + k}>
      <StatusShape k={k} />
      <span className={wordClass}>{LABEL[k]}</span>
      {children}
    </Tag>
  );
}

/** A neutral label, not a status. */
export const Tag = ({ children }: { children: ReactNode }) => <span className="chip tag">{children}</span>;

export const Dot = ({ k }: { k: DisplayStatus }) => <span className={'dot ' + chipClass(k)} aria-hidden="true" />;

/** A person's initials in their colour: from who they are, so two people with the same name or initials differ (backlog N). */
export function Avatar({ p, size }: { p: Pick<Person, 'initials' | 'name'> & { id?: string }; size?: 'sm' | 'lg' }) {
  const app = useMaybeApp();
  const h = (p.id != null ? app?.avatarHue(p.id) : undefined) ?? hue(p.id ?? p.name);
  return <span className={'avatar' + (size ? ' ' + size : '')} aria-hidden="true" data-hue={h}>{p.initials}</span>;
}
const hue = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 6;

/** The key (or team) beside a goal's title, only when another goal has the same title: so two are never confused. */
export function TitleTell({ goal }: { goal: Goal }) {
  const app = useMaybeApp();
  const t = app?.goalTell(goal);
  return t ? <span className="gkey title-tell" title="Another goal has this title">{t}</span> : null;
}

/** A goal's level, for reporting at major reviews. Team goals show nothing; north star and SVP stand out a little. */
export function LevelTag({ level, always }: { level: Level; always?: boolean }) {
  if (level === 'team' && !always) return null;
  return <span className={'level level-' + level}>{LEVEL_LABEL[level]}</span>;
}

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
  // The arc draws in from empty and moves on when another goal is done (CSS). The count is always the true one, the
  // same as the label: it never counts (a count caught mid-way, or held back by a busy browser, once read 2/56 beside
  // a label of 0 of 56: re-review, 8 Nov, backlog T).
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

/**
 * A flag as words with a mark: no filled pill, so a list stays calm. The status shapes mean a status, so only a goal gone
 * quiet uses one (its word says so); every other flag (a trend, a missed date, no recovery plan) uses the warning mark.
 */
export function FlagPill({ f }: { f: Flag }) {
  return <span className={'flag flag-' + f.kind} data-tone={f.tone}>{f.kind === 'stale' ? <StatusShape k="stale" /> : f.tone === 'off' || f.tone === 'risk' ? <WarnMark /> : null}{f.label}</span>;
}

/**
 * One goal that needs someone, as a list row: its status (shape, and its word leading the reason), its name, what else
 * flags it, the reason in a line or two, and one action. The shape and the word come from the goal's status, never from
 * what flags it: an on-track goal that is getting worse keeps the On track shape, and says Getting worse beside the
 * warning mark, as the goal's page does.
 */
export function AttentionCard({ a, action, to }: { a: GoalAttention; action?: ReactNode; to: string }) {
  const flags = a.flags.filter((f) => f.kind !== 'due');
  const top = flags[0] ?? a.flags[0];
  if (!top) return null;
  const k = a.status.status;
  // Off track, at risk and no recent update are flags that say the status's own word: the status says them already.
  // Two words of why at most, the status's own among them, so the reason still has room in two lines on a phone.
  const others = flags.filter((f) => f.kind !== k).slice(0, flags.some((f) => f.kind === k) ? 1 : 2);
  return (
    <div className="arow" data-tone={k}>
      <span className={'arow-icon tone-' + k}><StatusShape k={k} /></span>
      <Link to={to} className="arow-main">
        <span className="arow-title">{a.goal.title}</span>
        <span className="arow-why" title={a.lookedAt && !a.handled ? `${top.detail} (${a.lookedAt.text})` : top.detail}>
          <span className={'arow-status tone-' + k}>{LABEL[k]}</span>
          {others.length > 0 && <>{' · '}<span className="arow-flags"><WarnMark />{others.map((f) => f.label).join(' · ')}</span></>}
          {' — '}{top.detail}
        </span>
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

/** Nothing to show yet: a heading, one line on why, and the way out (a search or filter that matched nothing). */
export function EmptyResult({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-title">{title}</span>
      {children && <span className="empty-state-line">{children}</span>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

/**
 * A panel that slides up on a phone and drops down as a popover on a desktop. Its body scrolls; a `.sheet-foot` inside
 * it stays at the bottom of the sheet at every scroll position. Messages raised while it's open show inside it, below
 * everything, so they never cover what you're doing.
 */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const toasts = useToasts();
  // The latest onClose, so a parent passing a new function each render doesn't re-run the focus effect.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () => [...(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select, textarea') ?? [])];
    // A field that asked for focus (autoFocus) keeps it. Otherwise the first control, never the close button or a link
    // inside a sentence (Enter on it would leave the sheet).
    if (!ref.current?.contains(document.activeElement)) {
      const inline = (el: HTMLElement) => el.matches('a') && !!el.closest('p, .hint, .small, .tiny');
      const all = focusables();
      (all.find((el) => !el.matches('.sheet-head .iconbtn') && !inline(el)) ?? all[0])?.focus();
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close.current(); return; }
      if (e.key !== 'Tab') return;
      // Keep Tab inside the sheet while it's open.
      const els = focusables();
      if (!els.length) return;
      const first = els[0]!, last = els[els.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  // Rendered at the top of the page so a phone shows it as a bottom sheet over everything.
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className={'sheet' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><span className="h3">{title}</span><button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
        <div className="sheet-body">{children}</div>
        {/* The page's own message region (role=status) still announces these; this is the copy you can see. */}
        {toasts.length > 0 && <div className="sheet-toasts" aria-hidden="true">{toasts.map((t) => <div key={t.id} className={'sheet-toast ' + t.kind}>{t.text}</div>)}</div>}
      </div>
    </div>,
    document.body,
  );
}
