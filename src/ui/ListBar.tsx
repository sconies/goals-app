/* The list bar (docs/design/find/spec.md, 2.1): one way every list is searched, filtered, sorted and counted. A search
   field, up to two inline filters, Filters, Sort, the page's extras; under it the count line, the filter line, and,
   where the list would be, what found nothing. The words come from src/domain/find.ts (rules 2, 3 and 5), so every list
   says them alike. The list's state lives in the address (useListQuery). */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { countLine, filterText, noneFound, type FilterPart, type Things } from '../domain/find';
import { MenuButton } from './MenuButton';
import { EmptyResult } from './bits';

/** A search field that writes to the address a moment after typing stops (rule 4: typing replaces until it settles). */
export function ListSearch({ value, onSearch, label, placeholder, autoFocus }: { value: string; onSearch: (text: string, settled: boolean) => void; label: string; placeholder: string; autoFocus?: boolean }) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mine = useRef(value);
  // The address changed from elsewhere (Back, Clear the search): the field follows it.
  useEffect(() => { if (value !== mine.current) { mine.current = value; setText(value); } }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const send = (t: string, settled: boolean) => { const w = t.trim().slice(0, 200); mine.current = w; onSearch(w, settled); };
  return (
    <label className="filter-search list-search"><span className="sr">{label}</span>
      <input className="input" type="search" placeholder={placeholder} maxLength={200} value={text} autoFocus={autoFocus && typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 761px)').matches} aria-label={label}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => send(t, false), 150);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') { if (timer.current) clearTimeout(timer.current); send(e.currentTarget.value, true); } }}
        onBlur={(e) => { if (timer.current) clearTimeout(timer.current); if (e.currentTarget.value.trim() !== value) send(e.currentTarget.value, true); }} />
    </label>
  );
}

/** Sort as a menu button that says its value: "Sort: Newest first". */
export function SortMenu({ options, value, onSort }: { options: [string, string][]; value: string; onSort: (v: string) => void }) {
  const label = options.find(([k]) => k === value)?.[1] ?? options[0]?.[1] ?? '';
  return <MenuButton label="Sort" display={`Sort: ${label}`} items={options.map(([k, l]) => ({ label: l, current: k === value, onClick: () => onSort(k) }))} />;
}

/** The bar itself: the search, then whatever the page puts beside it (filters, sort, extras). */
export function ListBar({ children, search }: { search: ReactNode; children?: ReactNode }) {
  return <div className="list-bar"><div className="list-bar-row">{search}{children}</div></div>;
}

/** Rule 2's line, read out when it changes. */
export function CountLine({ things, n, narrowed, order, shown, after }: { things: Things; n: number; narrowed: boolean; order?: string | null; shown?: { from: number; to: number } | null; after?: ReactNode }) {
  const text = countLine(things, n, narrowed, order, shown);
  return <p className="count-line small" role="status">{text}{after}</p>;
}

/** Rule 3's line: each filter in words with Remove, and Clear filters once there are two. Nothing with none on. */
export function FilterLine({ parts, onRemove, onClear }: { parts: FilterPart[]; onRemove: (key: string) => void; onClear: () => void }) {
  if (!parts.length) return null;
  return (
    <p className="filter-line small">
      <span>Filtered by: </span>
      {parts.map((p, i) => (
        <span key={p.key} className="filter-part">{i > 0 && ' · '}{filterText(p)} <button type="button" className="linkish" aria-label={`Remove the filter ${filterText(p)}`} onClick={() => onRemove(p.key)}>Remove</button></span>
      ))}
      {parts.length > 1 && <> · <button type="button" className="linkish" onClick={onClear}>Clear filters</button></>}
    </p>
  );
}

/**
 * What found nothing, where the list would be (2.1's table), with the links that undo it: the empty-state card. A near
 * miss is one plain line above the list it found instead.
 */
export function NoneFound({ things, q, filtered, near, onClearSearch, onClearFilters }: { things: Things; q: string; filtered: boolean; near?: string | null; onClearSearch: () => void; onClearFilters: () => void }) {
  const said = noneFound(things, q, filtered, near);
  if (near) return <p className="none-found small" role="status">{said} <button type="button" className="linkish" onClick={onClearSearch}>Clear the search</button></p>;
  return (
    <EmptyResult title={said} action={<>
      {q.trim() && <button type="button" className="btn" onClick={onClearSearch}>Clear the search</button>}
      {filtered && <button type="button" className="btn" onClick={onClearFilters}>Clear filters</button>}
    </>}>{q.trim() ? 'Try fewer or plainer words.' : 'Remove a filter to see more.'}</EmptyResult>
  );
}
