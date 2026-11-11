/* Find-and-pick (docs/design/find/spec.md, 2.3): the one way a person, a team, a goal (and a module's kind, such as a
   metric) is chosen anywhere in the app. Closed, it says the choice in words with "Change"; open, it suggests a few
   (you, your team, lately), then finds by typing, a page of rows at most, never a list of everything. Arrow keys and
   Enter choose, Escape closes. It asks the Search port (src/app/search.ts) and never filters the workspace itself. */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { recentsOf, remember, usePrefs, useSearch } from '../app/search';
import { useApp } from '../app/state';
import { latestOnly, type FoundRow, type Search, type SearchKind } from '../ports/search';
import type { Person } from '../domain/types';
import { Avatar, StatusWord } from './bits';

/** The words for each kind: its name, the field's placeholder when nothing is chosen, and the search's placeholder. */
const KINDS: Record<string, { thing: string; things: string; find: string }> = {
  person: { thing: 'person', things: 'people', find: 'Find by name, job title or team' },
  team: { thing: 'team', things: 'teams', find: 'Find a team or its lead' },
  goal: { thing: 'goal', things: 'goals', find: 'Find by name, key, owner or team' },
  metric: { thing: 'metric', things: 'metrics', find: 'Find by name, unit or owner' },
  workspace: { thing: 'workspace', things: 'workspaces', find: 'Find a workspace' },
};
const words = (kind: string) => KINDS[kind] ?? { thing: kind, things: kind + 's', find: 'Find by name' };
/** Rows drawn while typing: the rest are counted, never drawn. */
const SHOWN = 50;

export interface PickProps {
  kind: SearchKind;
  label: string;
  /** Chosen ids: one, or several with `several`. */
  value: string[];
  onChange: (ids: string[]) => void;
  several?: boolean;
  /** The first row, when choosing nothing is allowed ("Nothing: top of its own tree"); choosing it empties the value. */
  none?: string;
  /** Rows that can't be chosen here, with the rule's own words for why ("Feeds this goal already"); null when it can. */
  refuse?: (row: FoundRow) => string | null;
  /** Ids that aren't offered at all (the goal being edited, say). */
  hide?: string[];
  /** A hint under the label. */
  hint?: ReactNode;
  invalid?: boolean;
  /** A chosen row that can't be removed (a review's creator, say). */
  keep?: (id: string) => boolean;
  /** In a table cell or a filter row: the label is for screen readers only (the column or the row says it), and the
      choice is one line of words with Change. */
  compact?: boolean;
  /** The chosen one's words, when the caller already has them (a Data cell's name): shown closed without asking the
      Search port, so a table of pickers doesn't ask once per cell. */
  shown?: string;
  /** Offered first, before anything is typed, each with a note ("who owns this goal"), then the usual suggestions. */
  first?: { id: string; note: string }[];
}

/** One person chosen, or none: Pick for the common case. */
export function PickOne({ value, onChange, source, ...p }: Omit<PickProps, 'value' | 'onChange' | 'several'> & { value: string | null; onChange: (id: string | null) => void; source?: PickSource }) {
  const one = { ...p, value: value ? [value] : [], onChange: (ids: string[]) => onChange(ids[0] ?? null) };
  return source ? <PickFrom {...one} source={source} /> : <Pick {...one} />;
}

/** Where a picker asks and who for: the open workspace's Search port, or (in set-up, before there is one) a draft's. */
export interface PickSource {
  search: Search;
  viewerId: string;
  ws: string;
  /** A person, for the avatar on their row. */
  person?: (id: string) => Person | undefined;
}

export function Pick(p: PickProps) {
  const app = useApp();
  const search = useSearch();
  return <PickFrom {...p} source={{ search, viewerId: app.viewer.id, ws: app.ws.id, person: app.person }} />;
}

/** A picker that asks the source it is given: set-up's people, before the workspace exists. */
export function PickFrom({ source, kind, label, value, onChange, several = false, none, refuse, hide = [], hint, invalid = false, keep, compact = false, shown, first = [] }: PickProps & { source: PickSource }) {
  const { search, viewerId, ws } = source;
  const app = { viewer: { id: viewerId }, ws: { id: ws } };
  const prefs = usePrefs();
  const ask = useMemo(() => latestOnly(search), [search]);
  const id = useId();
  const w = words(kind);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<FoundRow[]>([]);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [at, setAt] = useState(0);
  const [tries, setTries] = useState(0);
  /** The rows of what's chosen (and offered first), by id, as the Search port words them. */
  const [known, setKnown] = useState<Record<string, FoundRow>>({});
  const firstIds = first.map((f) => f.id);
  const wrap = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const typed = q.trim().length > 0;

  // What's offered: suggestions before typing, then what the search finds. The last question asked wins.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setFailed(false);
    const shown = (r: FoundRow[]) => r.filter((x) => !hide.includes(x.id));
    (typed
      ? ask(kind, { q, size: SHOWN }).then((a) => { if (a && live) { setRows(shown(a.rows)); setTotal(a.total - (a.rows.length - shown(a.rows).length)); } })
      : Promise.all([search.suggest(kind, app.viewer.id, recentsOf(prefs, app.ws.id, app.viewer.id)), firstIds.length ? search.byIds(kind, firstIds) : []]).then(([r, lead]) => {
        if (!live) return;
        const all = shown([...lead, ...r.filter((x) => !lead.some((l) => l.id === x.id))]).slice(0, 6);
        setRows(all); setTotal(all.length);
      })
    ).catch(() => { if (live) setFailed(true); });
    setAt(0);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q, kind, search, tries]);

  // What's chosen, in the words a search gives it: asked of the Search port by id, never read from the workspace here.
  useEffect(() => {
    if (!value.length || shown !== undefined) return;
    let live = true;
    search.byIds(kind, value).then((rs) => { if (live) setKnown((k) => ({ ...k, ...Object.fromEntries(rs.map((r) => [r.id, r])) })); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, search, value.join(' ')]);

  // Closing on a click elsewhere keeps what was chosen.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const options: ({ none: true } | FoundRow)[] = [...(none && !several ? [{ none: true as const }] : []), ...rows];
  const close = () => { setOpen(false); setQ(''); requestAnimationFrame(() => opener.current?.focus()); };
  const choose = (o: { none: true } | FoundRow) => {
    if ('none' in o) { onChange([]); close(); return; }
    if (refuse?.(o)) return;
    remember(prefs, app.ws.id, app.viewer.id, { kind: o.kind, id: o.id });
    setKnown((k) => ({ ...k, [o.id]: o }));
    if (several) { onChange(value.includes(o.id) ? value.filter((x) => x !== o.id) : [...value, o.id]); return; }
    onChange([o.id]);
    close();
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.length) setAt((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = options[at];
      if (o) choose(o);
    } else if (e.key === 'Escape') {
      // Only the picker closes, not a sheet it sits in.
      e.preventDefault(); e.stopPropagation();
      close();
    }
  };
  const optId = (i: number) => `${id}-o${i}`;
  const chosen = value.map((v) => known[v]).filter((r): r is FoundRow => !!r);
  const count = typed ? (total === 0 ? 'None match' : `${total} ${total === 1 ? 'matches' : 'match'}`) : '';

  return (
    <div className={'field pick' + (open ? ' open' : '') + (compact ? ' compact' : '')} ref={wrap}>
      <span className={compact ? 'sr' : 'field-label'} id={`${id}-l`}>{label}</span>
      {hint && <span className="hint">{hint}</span>}
      {several && chosen.length > 0 && (
        <ul className="pick-chosen" aria-labelledby={`${id}-l`}>
          {chosen.map((r) => (
            <li key={r.id} className="pick-row"><RowText person={source.person} row={r} you={r.id === app.viewer.id} />
              {!keep?.(r.id) && <button type="button" className="linkish" aria-label={`Remove ${r.name}`} onClick={() => onChange(value.filter((x) => x !== r.id))}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
      {!several && (chosen[0] || (shown !== undefined && value[0])) ? (
        <div className={'pick-field' + (invalid ? ' invalid' : '')}>
          {compact || !chosen[0] ? <span className="pick-name">{chosen[0]?.name ?? shown}</span> : <RowText person={source.person} row={chosen[0]} you={chosen[0].id === app.viewer.id} />}
          <button type="button" className="linkish" ref={opener} aria-expanded={open} aria-label={`${label}: ${chosen[0]?.name ?? shown}. Change`} onClick={() => setOpen((o) => !o)}>Change</button>
        </div>
      ) : (
        <button type="button" className={'input pick-open' + (invalid ? ' invalid' : '')} ref={opener} aria-expanded={open} aria-labelledby={`${id}-l ${id}-b`} onClick={() => setOpen((o) => !o)}>
          <span id={`${id}-b`}>{several && chosen.length ? `Add another ${w.thing}` : !several && none ? none : `Choose a ${w.thing}`}</span>
        </button>
      )}
      {open && (
        <div className="pick-panel" role="dialog" aria-label={label}>
          <div className="pick-head"><span className="strong">{label}</span><button type="button" className="linkish" onClick={close}>Close</button></div>
          <input
            ref={field} autoFocus className="input" type="search" value={q} maxLength={200} placeholder={w.find}
            role="combobox" aria-expanded="true" aria-controls={`${id}-list`} aria-autocomplete="list" aria-label={`${label}: ${w.find.toLowerCase()}`}
            aria-activedescendant={options.length ? optId(at) : undefined}
            onChange={(e) => setQ(e.target.value)} onKeyDown={key}
          />
          {failed ? (
            <div className="pick-note" role="alert">Couldn’t search just now. <button type="button" className="linkish" onClick={() => setTries((t) => t + 1)}>Try again</button></div>
          ) : (
            <>
              {typed ? <div className="pick-count hint" role="status">{count}</div> : rows.length > 0 && <div className="pick-count hint">Suggested</div>}
              {!typed && !rows.length && !none && <div className="pick-note hint">Type a name{kind === 'goal' ? ' or a key like G-48' : ''}.</div>}
              {typed && total === 0 && <div className="pick-note hint">None match “{q.trim()}”.</div>}
              <ul className="pick-list" role="listbox" id={`${id}-list`} aria-label={label} aria-multiselectable={several || undefined}>
                {options.map((o, i) => {
                  const no = 'none' in o ? null : refuse?.(o) ?? null;
                  const on = 'none' in o ? value.length === 0 : value.includes(o.id);
                  return (
                    <li key={'none' in o ? '_none' : o.id} id={optId(i)} role="option" aria-selected={on} aria-disabled={no ? true : undefined}
                      className={'pick-row option' + (i === at ? ' active' : '') + (no ? ' refused' : '')}
                      onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setAt(i)} onClick={() => choose(o)}>
                      {'none' in o ? <span className="pick-text"><span className="pick-name">{none}</span></span> : <RowText person={source.person} row={o} you={o.id === app.viewer.id} why={no} note={!typed ? first.find((f) => f.id === o.id && f.note !== 'you')?.note : undefined} />}
                      {several && on && <span className="pick-tick">Chosen</span>}
                    </li>
                  );
                })}
              </ul>
              {typed && total > rows.length && <div className="pick-note hint">Keep typing to narrow the other {total - rows.length}.</div>}
            </>
          )}
          {several && <div className="pick-foot"><button type="button" className="btn primary" onClick={close}>Done</button></div>}
        </div>
      )}
    </div>
  );
}

/** A row's two lines: a goal's status (shape and word) and title; a person's avatar and name; then line 2. */
function RowText({ row, you, why, note, person }: { row: FoundRow; you?: boolean; why?: string | null; note?: string; person?: (id: string) => Person | undefined }) {
  const p = row.kind === 'person' ? person?.(row.id) : undefined;
  return (
    <span className="pick-text">
      <span className="pick-name">
        {row.status && <StatusWord k={row.status} className="pick-status" />}
        {p && <Avatar p={p} size="sm" />}
        <span>{row.name}{you && row.kind === 'person' ? ' (you)' : ''}{note ? `, ${note}` : ''}</span>
      </span>
      <span className="pick-detail hint">{why ?? row.detail}</span>
    </span>
  );
}
