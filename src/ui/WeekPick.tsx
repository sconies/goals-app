/* The week picker (goal entry 2.13; GE9): one control for a plan's From and To, and a stage's Due. It holds a week
   counted from the cycle's start, as the data does; everything it shows comes from domain/weeks (rule 13): the week as
   words with its dates and year, what that week is ("This week", "The end of 2026"), the named weeks, the goal years and
   their weeks. A short fixed list, so a plain listbox (find spec, section 4), never a calendar of days. It lives inside
   New goal and the edit page, which are loaded when opened. */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { weekSays, yearWeek } from '../domain/weeks';
import { readWeek, weekChoices, weekIs, type WeekField } from '../domain/weekChoices';
import type { Cycle } from '../domain/types';

export function WeekPick({ cycle, week, field, label, value, onChange, from, labelClass = 'field-label', invalid = false, dataField, disabled = false }: {
  cycle: Pick<Cycle, 'startDate' | 'weeks'>;
  /** This week. */
  week: number;
  field: WeekField;
  label: string;
  /** The week chosen, from the cycle's start; null when none is. */
  value: number | null;
  onChange: (n: number) => void;
  /** For To: the week it comes after. */
  from?: number;
  labelClass?: string;
  invalid?: boolean;
  /** The form field this is, for focus (data-field). */
  dataField?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const choices = weekChoices(cycle, week, field, from);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  /** What was typed and can't be chosen: 'unread' (not a week or a date) or 'outside' (a week this field doesn't offer). */
  const [unread, setUnread] = useState<'' | 'unread' | 'outside'>('');
  const start = value != null && value >= choices.min && value <= choices.max ? value : Math.max(choices.min, Math.min(choices.max, week));
  const [at, setAtState] = useState(start);
  // The highlighted week, read by the keys: keys pressed faster than a render (a slow phone) each move on from the last,
  // not from the week the last render saw (U109).
  const atNow = useRef(start);
  const setAt = (n: number) => { atNow.current = n; setAtState(n); };
  // The shown year rides along the same way, so a key that crosses into another year reads the right one.
  const [shownYear, setShownState] = useState(yearWeek(cycle, start).year);
  const shownNow = useRef(shownYear);
  const setShownYear = (y: number) => { shownNow.current = y; setShownState(y); };
  const wrap = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const text = useRef<HTMLInputElement>(null);
  const year = choices.years.find((y) => y.year === shownYear) ?? choices.years[0];

  // Opened: the list at the chosen week, else this week, scrolled into view.
  useEffect(() => { if (open) { setAt(start); setShownYear(yearWeek(cycle, start).year); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) list.current?.querySelector(`[data-week="${at}"]`)?.scrollIntoView({ block: 'nearest' }); }, [open, at, shownYear]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const shut = () => { setOpen(false); setQ(''); setUnread(''); };
  const close = () => { shut(); requestAnimationFrame(() => opener.current?.focus()); };
  // Escape anywhere in the panel closes it; Tab out of it closes it without taking the focus back (GE9 review).
  const keyOnPanel = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') requestAnimationFrame(() => { if (!wrap.current?.contains(document.activeElement)) shut(); });
  };
  const choose = (n: number) => { if (n < choices.min || n > choices.max) return; onChange(n); close(); };
  const move = (n: number) => { const c = Math.max(choices.min, Math.min(choices.max, n)); setAt(c); setShownYear(yearWeek(cycle, c).year); };
  const typed = (v: string) => {
    setQ(v);
    const n = readWeek(cycle, week, v, shownYear);
    setUnread(!v.trim() ? '' : n == null ? 'unread' : n < choices.min || n > choices.max ? 'outside' : '');
    if (n != null && n >= choices.min && n <= choices.max) move(n);
  };
  const keyOnList = (e: KeyboardEvent<HTMLElement>) => {
    const at = atNow.current;
    const shownYear = shownNow.current;
    const year = choices.years.find((y) => y.year === shownYear) ?? choices.years[0];
    const yearOf = (y: number) => choices.years.find((x) => x.year === y);
    const k = e.key;
    if (k === 'ArrowDown') move(at + 1);
    else if (k === 'ArrowUp') { if (at === choices.min || at === year?.weeks[0]) { e.preventDefault(); (wrap.current?.querySelector('.weekpick-named button') as HTMLElement | null)?.focus(); return; } move(at - 1); }
    else if (k === 'PageDown') move(at + 4);
    else if (k === 'PageUp') move(at - 4);
    else if (k === 'Home' && year) move(year.weeks[0]!);
    else if (k === 'End' && year) move(year.weeks.at(-1)!);
    else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      const y = yearOf(shownYear + (k === 'ArrowLeft' ? -1 : 1));
      if (y) { const w = yearWeek(cycle, at).week; move(y.weeks.find((n) => yearWeek(cycle, n).week === w) ?? (k === 'ArrowLeft' ? y.weeks.at(-1)! : y.weeks[0]!)); }
    } else if (k === 'Enter' || k === ' ') choose(at);
    else if (k.length === 1 && /\S/.test(k)) { text.current?.focus(); return; }
    else return;
    e.preventDefault();
  };
  const keyOnText = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Nothing typed: the highlighted week, as in the list.
      if (!q.trim()) { choose(at); return; }
      const n = readWeek(cycle, week, q, shownYear);
      if (n != null && n >= choices.min && n <= choices.max) choose(n); else setUnread(n == null ? 'unread' : 'outside');
    } else if (e.key === 'ArrowDown') { e.preventDefault(); list.current?.focus(); }
  };
  const optId = (n: number) => `${id}-w${n}`;
  const says = value != null ? weekSays(cycle, value, 'field') : 'Choose a week';

  return (
    <div className={'field weekpick' + (open ? ' open' : '')} ref={wrap} data-field={dataField}>
      <span className="weekpick-label"><span className={labelClass} id={`${id}-l`}>{label}</span>{value != null && <span className="hint weekpick-is-inline" aria-hidden="true"> · {weekIs(cycle, value, week)}</span>}</span>
      <button type="button" ref={opener} className={'input weekpick-open' + (invalid ? ' invalid' : '')} disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${id}-l ${id}-v`} aria-invalid={invalid || undefined} onClick={() => setOpen((o) => !o)}>
        <span id={`${id}-v`}>{says}</span>
      </button>
      {value != null && <span className="hint weekpick-is">{weekIs(cycle, value, week)}</span>}
      {open && (
        <div className="pick-panel weekpick-panel" role="dialog" aria-label={label} onKeyDown={keyOnPanel}>
          <div className="pick-head"><span className="strong">{label}</span><button type="button" className="linkish" onClick={close}>Close</button></div>
          <input ref={text} autoFocus className="input" value={q} maxLength={40} placeholder="Type a week or a date: 50, 14 Dec" aria-label={`${label}: type a week or a date`}
            onChange={(e) => typed(e.target.value)} onKeyDown={keyOnText} />
          {unread && <div className="hint" role="status">{unread === 'unread' ? `“${q.trim()}” isn’t a week or a date. Try 50, or 14 Dec.` : `“${q.trim()}” can’t be chosen here. ${choices.says}`}</div>}
          {choices.named.length > 0 && (
            <ul className="pick-list weekpick-named" aria-label="Named weeks">
              {choices.named.map((x) => (
                <li key={x.name} className="pick-row">
                  <button type="button" className="weekpick-row" onClick={() => choose(x.n)}
                    onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); const next = (e.currentTarget.closest('li')?.nextElementSibling?.querySelector('button')); if (next) (next as HTMLElement).focus(); else list.current?.focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); (e.currentTarget.closest('li')?.previousElementSibling?.querySelector('button') as HTMLElement | null)?.focus(); } }}>
                    <span className="strong">{x.name}</span><span className="hint">{weekSays(cycle, x.n, 'field')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <span className="small strong" id={`${id}-or`}>Or choose a week</span>
          {choices.years.length > 1 && (
            <div className="seg" role="group" aria-label="Year">
              {choices.years.map((y) => <button key={y.year} type="button" aria-pressed={y.year === shownYear} onClick={() => { setShownYear(y.year); setAt(y.weeks.includes(at) ? at : y.weeks.includes(week) ? week : y.weeks[0]!); }}>{y.year}</button>)}
            </div>
          )}
          <ul ref={list} className="pick-list weekpick-list" role="listbox" tabIndex={0} aria-labelledby={`${id}-or`} aria-activedescendant={year?.weeks.includes(at) ? optId(at) : undefined} onKeyDown={keyOnList}>
            {(year?.weeks ?? []).map((n) => {
              const marks = [n === week ? 'this week' : '', /^The end of Q|^The end of \d/.test(weekIs(cycle, n, -999)) ? weekIs(cycle, n, -999).replace(/^The /, 'the ') : '', n === value ? 'chosen' : ''].filter(Boolean);
              return (
                <li key={n} id={optId(n)} data-week={n} role="option" aria-selected={n === value} className={'pick-row option' + (n === at ? ' active' : '')}
                  onMouseDown={(e) => e.preventDefault()} onMouseMove={() => { if (at !== n) setAt(n); }} onClick={() => choose(n)}>
                  <span>{weekSays(cycle, n, 'row')}{marks.length ? <span className="hint"> · {marks.join(' · ')}</span> : null}</span>
                </li>
              );
            })}
          </ul>
          <span className="hint">{choices.says}</span>
        </div>
      )}
    </div>
  );
}
