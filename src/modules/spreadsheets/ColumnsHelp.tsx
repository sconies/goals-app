/* "Every column, and what it needs" (backlog IM1, wireframe 8), in Help's columns article through the help.article
   place: the field table of each sheet that loads back, from domain/columns, so Help can't say a column differently
   from the template's Start here sheet. A tab per sheet with its count of fill-in columns; what a new row must have
   first, the optional columns on request; one list that reads the same on a phone. The one action is the template. */
import { useState } from 'react';
import { useApp } from '../../app/state';
import type { PlaceProps } from '../../core/app';
import { emptyText, fieldTable, FILL_SHEETS, isFillIn, requiredLine, requiredText, specOf, type FieldRow, type FillKind } from '../../domain/columns';
import { saveTemplate } from './template';

/** Optional columns, shown on request: the table leads with what a new row needs. */
const isOptional = (c: FieldRow) => !!c.required && typeof c.required === 'object' && 'optional' in c.required;

/** The help.article place: drawn only in the columns article (this module's, src/modules/spreadsheets/help.ts). */
export function ColumnsHelp({ article }: PlaceProps['help.article']) {
  return article === 'columns' ? <FieldTable /> : null;
}

function FieldTable() {
  const app = useApp();
  const [kind, setKind] = useState<FillKind>('goals');
  const [all, setAll] = useState(false);
  const table = fieldTable(kind);
  const fill = table.filter(isFillIn);
  const shown = all ? fill : fill.filter((c) => !isOptional(c));
  const more = fill.length - shown.length;
  const worked = table.filter((c) => !isFillIn(c)).map((c) => c.header);
  const spec = specOf(kind);
  const line = kind === 'plan' ? 'Its Key or ID says which number goal it is; type a number into any week to set the plan by hand.' : `A new row needs: ${requiredLine(kind)}`;
  return (
    <section className="help-section" aria-labelledby="help-columns">
      <h2 className="h2" id="help-columns">The columns</h2>
      <div className="seg tabs one-row" role="tablist" aria-label="Sheet">
        {FILL_SHEETS.map((k) => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setAll(false); }}>{specOf(k).name}<span className="tabcount">{fieldTable(k).filter(isFillIn).length}</span></button>)}
      </div>
      <p>One row per {spec.rowIs}. {line}</p>
      <ul className="help-points" aria-label={`${spec.name} columns`}>
        {shown.map((c) => (
          <li key={c.header}>
            <span className="strong">{c.header}</span>: {requiredText(c, table)}.{' '}
            <span className="hint">{c.format}. For example, {c.example}. If it’s left empty: {emptyText(c)}.</span>
          </li>
        ))}
        {worked.length > 0 && <li><span className="strong">{worked.slice(0, 3).join(', ')}{worked.length > 3 ? '…' : ''}</span>: {kind === 'plan' ? 'For reading' : 'Worked out'}. <span className="hint">Never read. Leave them or delete them.</span></li>}
      </ul>
      {more > 0 && <p>{more} more optional {more === 1 ? 'column' : 'columns'}: <button type="button" className="linkish tap" onClick={() => setAll(true)}>show them all</button>.</p>}
      <p><button type="button" className="btn primary" onClick={() => void saveTemplate(app)}>Download the template</button></p>
    </section>
  );
}
