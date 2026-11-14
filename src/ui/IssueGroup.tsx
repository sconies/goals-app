/* One group of a spreadsheet's problems (import spec 2.3, rule 6): its title, where its rows are and the fix, its
   answers, and its rows on request. Shared by the import's preview (spreadsheets module) and set-up's (IM8), which
   differ only in where an answer goes and which people, teams and goals "Choose…" finds. */
import { useState } from 'react';
import type { Answer, Choice, Issue, IssueGroup as Group } from '../domain/problemLevels';
import { PAGE } from '../domain/importLimits';
import { WarnMark } from './bits';
import type { ChangeSet } from '../domain/changeset';
import { PickOne, type PickSource } from './Pick';

const n = (k: number, one: string, many = one + 's') => `${k.toLocaleString('en-GB')} ${k === 1 ? one : many}`;
const rowKey = (x: { sheet: string; row: number }) => `${x.sheet}:${x.row}`;

/** What a choice that needs a value finds: a team, a person or a goal, by the group's column. */
export const pickKind = (g: Group): 'team' | 'person' | 'goal' => (g.column === 'Team' ? 'team' : ['Owner', 'Owner email', 'Takes over', 'Name', 'Email'].includes(g.column ?? '') ? 'person' : 'goal');

/** An answer given: the group's answer, and the words its closed line says ("{title}: {label}"). */
export interface Given { answer: Answer; title: string; label: string; level: 'must' | 'check' }

export function IssueGroup({ g, rows, prior, onAnswer, source, valueOf }: {
  g: Group;
  /** The group's rows, for "Show the {n} rows". */
  rows: readonly Issue[];
  prior?: Answer;
  onAnswer: (given: Given) => void;
  /** Where "Choose…" searches: the workspace's (unset), or set-up's draft. */
  source?: PickSource;
  /** The cell a chosen record reads as: a team's name, a person's email (or name), a goal's key. */
  valueOf: (kind: 'team' | 'person' | 'goal', id: string) => string;
}) {
  const [chosen, setChosen] = useState('');
  const [shown, setShown] = useState(0);
  const give = (c: Choice, v?: string) => {
    // An unlikely number's answer covers the numbers it was given for, and those of the answer before it.
    const covers = g.values ? [...new Set([...(prior?.covers ?? []), ...g.values])] : undefined;
    onAnswer({ answer: { choice: c.choice, ...(v ? { value: v } : {}), ...(covers ? { covers } : {}) }, title: g.title, label: v ? `Use “${v}”` : c.label, level: g.level === 'must' ? 'must' : 'check' });
  };
  const valueChoice = g.answers.find((c) => c.choice === chosen && c.needsValue);
  const list = valueChoice?.options?.filter((o) => o !== g.suggest) ?? [];
  const isMust = g.level === 'must';
  return (
    <div className={'level-block import-group ' + (isMust ? 'level-fix' : 'level-check')} role="group" aria-labelledby={`t-${g.id}`}>
      <span className="level-head"><WarnMark /><span className="level-word">{isMust ? 'Must fix' : 'Check'}</span></span>
      <strong id={`t-${g.id}`} className="level-q">{g.title}</strong>
      <span className="small">{g.where}. {g.count > 1 || g.example !== g.title ? g.example : ''}</span>
      {g.answers.length > 0 && (
        <fieldset className="import-answers">
          <legend className="sr">{g.title}</legend>
          {g.answers.map((c) => (
            <label key={c.choice} className="import-answer">
              <input type="radio" name={`a-${g.id}`} checked={chosen === c.choice} onChange={() => { setChosen(c.choice); if (!c.needsValue) give(c); }} />
              <span>{c.label}</span>
            </label>
          ))}
          {valueChoice && (
            <span className="import-value">
              {valueChoice.options ? (
                // A column's few words: one radio each, chosen at once.
                <span className="import-answers" role="radiogroup" aria-label={valueChoice.label}>
                  {list.map((o) => <label key={o} className="import-answer"><input type="radio" name={`o-${g.id}`} onChange={() => give(valueChoice, o)} /><span>Use “{o}”</span></label>)}
                </span>
              ) : (
                // A team, a person or a goal: found by typing (find-and-pick), never chosen from a list of everything.
                <PickOne kind={pickKind(g)} label={valueChoice.label} value={null} {...(source ? { source } : {})} onChange={(id) => { const v = id ? valueOf(pickKind(g), id) : ''; if (v) give(valueChoice, v); }} />
              )}
            </span>
          )}
        </fieldset>
      )}
      {rows.length > 0 && (shown === 0 ? (
        <button type="button" className="linkish tap import-show" onClick={() => setShown(PAGE)}>Show the {n(rows.length, 'row')}</button>
      ) : (
        <div className="import-rows">
          <table className="import-rows-table">
            <thead><tr><th scope="col" className="num">Row</th><th scope="col">Name</th><th scope="col">{g.column ?? 'Cell'}</th></tr></thead>
            <tbody>{rows.slice(0, shown).map((i) => <tr key={rowKey(i)}><td className="num">{i.row}</td><td>{i.name || '—'}</td><td>{i.value ?? i.found ?? '—'}</td></tr>)}</tbody>
          </table>
          {rows.length > shown && <button type="button" className="linkish tap" onClick={() => setShown(shown + PAGE)}>Show {PAGE} more</button>}
        </div>
      ))}
    </div>
  );
}

/** A question answered: what was asked and the answer, with Change. */
export function Answered({ id, title, label, onChange }: { id: string; title: string; label: string; onChange: () => void }) {
  return (
    <div className="import-answered" id={`answered-${id}`} tabIndex={-1}>
      <span>{title}: <span className="strong">{label}</span></span>
      <button type="button" className="btn ghost sm" onClick={onChange}>Change</button>
    </div>
  );
}

/** The reason box's words for a change set (shared by Preview and the import's Check): a correction of a week's
    check-in, or a plan change once check-ins have started (review of #225; Lane, 14 Nov). */
export function ReasonWords({ items }: { items: ChangeSet['items'] }) {
  return items.every((x) => !x.needsReason || x.kind === 'replaces check-in')
            ? <><span className="field-label">Why are you correcting {items.filter((x) => x.needsReason).length === 1 ? 'this check-in' : 'these check-ins'}?</span>
              <span className="hint">Say why to save, in a sentence: changing a week’s check-in corrects it, and History keeps the reason with what it said before.</span></>
            : <><span className="field-label">Why are these plans changing?</span>
              <span className="hint">Say why to save: check-ins have started on {items.filter((x) => x.needsReason).length === 1 ? 'this goal' : 'these goals'}, so the change log keeps the reason with the old and new plan{items.some((x) => x.needsReason && x.kind === 'replaces check-in') ? ', and with any check-in it corrects' : ''}. A Reason column in the file is used first.</span></>;
}
