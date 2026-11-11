/* Find from anywhere (docs/design/find/spec.md, 2.4): one search across goals, people, teams and a module's kinds
   (the metric library's), opened by the sidebar's Find, the phone's Find button, or Ctrl K (Cmd K on a Mac). It asks the
   Search port (rule 8, findAll) and never filters the workspace itself. A sheet in the middle on a computer, the whole
   screen on a phone. Rows are links; Enter opens the first, or the one the arrow keys reached; Escape closes. */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router';
import { recentsOf, remember, usePrefs, useSearch } from '../app/search';
import { useApp } from '../app/state';
import { useModules } from '../core/app';
import { findAllAsync, type FoundGroup } from '../domain/find';
import type { FoundRow } from '../ports/search';
import { Icon } from './Icon';
import { RowText, rowFor } from './Pick';

/** The core's kinds as Find names them and where each opens; a module's come from its finder. */
const CORE: Record<string, { thing: string; things: string; group: string; open: (id: string) => string; all: string }> = {
  goal: { thing: 'goal', things: 'goals', group: 'Goals', open: (id) => `/goals/${encodeURIComponent(id)}`, all: '/goals?scope=all&q=' },
  person: { thing: 'person', things: 'people', group: 'People', open: (id) => `/people/${encodeURIComponent(id)}`, all: '/people?q=' },
  team: { thing: 'team', things: 'teams', group: 'Teams', open: (id) => `/teams/${encodeURIComponent(id)}`, all: '/teams?q=' },
};
/** "Opened lately": rows of any kind. */
const LATELY = 8;
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** The key that opens Find, as this computer writes it. */
export const FIND_KEY = MAC ? '⌘K' : 'Ctrl K';
/** Ctrl K, or Cmd K on a Mac. */
export const isFindKey = (e: globalThis.KeyboardEvent) => (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k';

/** One row Find offers: a thing, or "See all" for its kind. */
type Option = { key: string; to: string; row?: FoundRow; all?: string; kind: string };

export function Find({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const search = useSearch();
  const prefs = usePrefs();
  const navigate = useNavigate();
  const { screens } = useModules();
  const finders = useMemo(() => Object.fromEntries(screens.flatMap((m) => m.finders ?? []).map((f) => [f.kind, f])), [screens]);
  const kindOf = (kind: string) => CORE[kind] ?? (finders[kind] ? { ...finders[kind].things, group: cap(finders[kind].things.things), open: finders[kind].open, all: `/${finders[kind].things.things}?q=` } : null);
  const id = useId();
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState<FoundGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const [at, setAt] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const typed = q.trim().length > 0;
  const kinds = search.kinds();
  const metrics = kinds.includes('metric');

  // The answer to the last thing typed; an older one arriving late is dropped.
  const asked = useRef(0);
  useEffect(() => {
    const mine = ++asked.current;
    setFailed(false);
    if (!typed) { setGroups(null); return; }
    findAllAsync(q, kinds, (k, a) => search.search(k, a))
      .then((g) => { if (mine === asked.current) { setGroups(g); setAt(0); } })
      .catch(() => { if (mine === asked.current) setFailed(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, search, tries]);

  // Before typing: what this person opened or chose lately, of any kind Find knows.
  const lately = useMemo(() => recentsOf(prefs, app.ws.id, app.viewer.id)
    .filter((r) => !!CORE[r.kind])
    .map((r) => rowFor(app, r.kind, r.id))
    .filter((r): r is FoundRow => !!r)
    .slice(0, LATELY), [prefs, app]);

  const options: Option[] = typed
    ? (groups ?? []).flatMap((g) => {
      const k = kindOf(g.kind);
      if (!k) return [];
      const rows: Option[] = g.rows.map((r) => ({ key: `${g.kind}:${r.id}`, to: k.open(r.id), row: r, kind: g.kind }));
      return g.total > g.rows.length ? [...rows, { key: `${g.kind}:all`, to: k.all + encodeURIComponent(g.near ?? q.trim()), all: `See all ${g.total} ${k.things}`, kind: g.kind }] : rows;
    })
    : lately.map((r) => ({ key: `${r.kind}:${r.id}`, to: CORE[r.kind]!.open(r.id), row: r, kind: r.kind }));

  // Focus stays in the sheet; Escape closes and gives focus back to what opened it.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = [...(ref.current?.querySelectorAll<HTMLElement>('input, button, a[href]') ?? [])];
      if (!els.length) return;
      const first = els[0]!, last = els[els.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); prev?.focus?.(); };
  }, [onClose]);

  const open = (o: Option) => {
    if (o.row) remember(prefs, app.ws.id, app.viewer.id, { kind: o.row.kind, id: o.row.id });
    onClose();
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.length) setAt((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = options[at];
      if (!o) return;
      open(o);
      void navigate(o.to);
    }
  };
  const optId = (i: number) => `${id}-o${i}`;
  const index = (o: Option) => options.indexOf(o);
  const placeholder = metrics ? 'Find a goal, person, team or metric' : 'Find a goal, person or team';

  const row = (o: Option) => {
    const i = index(o);
    return (
      <li key={o.key} role="presentation">
        <Link to={o.to} id={optId(i)} role="option" aria-selected={i === at} tabIndex={-1} className={'pick-row option find-row' + (i === at ? ' active' : '') + (o.all ? ' find-all' : '')} onMouseEnter={() => setAt(i)} onClick={() => open(o)}>
          {o.row ? <RowText row={o.row} you={o.row.kind === 'person' && o.row.id === app.viewer.id} /> : <span className="pick-text"><span className="pick-name">{o.all}</span></span>}
        </Link>
      </li>
    );
  };

  return createPortal(
    <div className="sheet-wrap find-wrap" onClick={onClose}>
      <div className="sheet find-sheet" role="dialog" aria-modal="true" aria-label="Find" ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="find-head">
          <Icon name="search" size={18} />
          <input
            autoFocus className="find-input" type="search" value={q} maxLength={200} placeholder={placeholder}
            role="combobox" aria-expanded={options.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list" aria-label={placeholder}
            aria-activedescendant={options.length ? optId(at) : undefined}
            onChange={(e) => setQ(e.target.value)} onKeyDown={key}
          />
          <button type="button" className="linkish find-close" onClick={onClose}>Close</button>
        </div>
        <div className="find-body">
          {failed ? (
            <div className="pick-note" role="alert">Couldn’t search just now. <button type="button" className="linkish" onClick={() => setTries((t) => t + 1)}>Try again</button></div>
          ) : !typed ? (
            lately.length
              ? <ul className="pick-list find-list" role="listbox" id={`${id}-list`} aria-label="Opened lately"><li role="presentation" className="find-group-head field-label">Opened lately</li>{options.map(row)}</ul>
              : <p className="hint find-hint">Type a name, a key like G-48, or a few words.</p>
          ) : groups && groups.length === 0 ? (
            <p className="hint find-hint" role="status">Nothing matches “{q.trim()}”.</p>
          ) : (
            <ul className="pick-list find-list" role="listbox" id={`${id}-list`} aria-label="Found">
              {(groups ?? []).map((g) => {
                const k = kindOf(g.kind);
                if (!k) return null;
                const mine = options.filter((o) => o.kind === g.kind);
                return (
                  <li key={g.kind} role="presentation" className="find-group">
                    <ul role="group" aria-label={`${k.group} · ${g.total}`} className="find-group-list">
                      <li role="presentation" className="find-group-head field-label">{k.group} · {g.total}</li>
                      {g.near && <li role="presentation" className="hint find-near">No {k.thing} matches “{q.trim()}”. Showing {k.things} that match “{g.near}”.</li>}
                      {mine.map(row)}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
