/* Fields the new-goal wizard, Edit goal and setting up a workspace share, so they look and behave the same in each. */
import { useState, type ReactNode } from 'react';
import { levelsOf } from '../domain/levels';
import { useApp } from '../app/state';
import type { Level } from '../domain/types';
import type { GoalAnswers, GoalCheck, MustFix } from '../domain/goalEntry';
import { placesText } from '../domain/numbers';
import { Icon } from './Icon';
import { CheckBlock, CheckSaid, MustFixLine } from './Levels';


/** A field's Must fix: said in words under the field, with the warning mark (ui/Levels, shared with the check-in). */
export function FieldError({ children, id }: { children: ReactNode; id?: string }) {
  return <MustFixLine id={id}>{children}</MustFixLine>;
}

/**
 * Goal entry's questions under the field they are about (rule 3; 2.1, item 3), in the shared Check block: the question
 * and its two answers; once answered, one line, "You said …", with Change. `onAnswer` keeps the answer (`answers[slot] =
 * key`); `onNo` is the second answer: a change made at once, an answer too (a stage overdue), or the field to change.
 * `alert`: the first open one, after Continue was pressed.
 */
export function Questions({ checks, answers, onAnswer, onNo, onChange, alertSlot }: {
  checks: readonly GoalCheck[];
  answers: GoalAnswers;
  onAnswer: (c: GoalCheck) => void;
  onNo: (c: GoalCheck) => void;
  /** Asks an answered question again. */
  onChange: (c: GoalCheck) => void;
  alertSlot?: string | null;
}) {
  if (!checks.length) return null;
  return (
    <>
      {checks.map((c) => answers[c.slot] === c.key
        ? <CheckSaid key={c.slot} onChange={() => onChange(c)}>{c.readBack || `You said: ${c.yes}.`}</CheckSaid>
        : <CheckBlock key={c.slot} id={`q-${c.slot.replace(/[^\w-]/g, '-')}`} slot={c.slot} question={c.question} yes={c.yes} no={c.no} alert={alertSlot === c.slot} onYes={() => onAnswer(c)} onNo={() => onNo(c)} />)}
    </>
  );
}

/** A date range that never breaks inside itself ("28 Dec–3 Jan 2027"). */
export const DateRange = ({ children }: { children: ReactNode }) => <span className="nobreak">{children}</span>;

/** The level: one segmented choice, with what it means underneath. */
export function LevelField({ level, onChange, labelClass }: { level: Level; onChange: (l: Level) => void; labelClass: string }) {
  const levels = levelsOf(useApp().cycle);
  return (
    <div className="field"><span className={labelClass} id="level-l">Level</span>
      <div className="seg full" role="group" aria-labelledby="level-l">
        {/* Everyday first, the top last, as the form has always read. */}
        {[...levels].reverse().map((l) => <button key={l.id} type="button" aria-pressed={level === l.id} onClick={() => onChange(l.id)}>{l.name}</button>)}
      </div>
      <span className="hint">{levels.find((l) => l.id === level)?.hint ?? ''}</span>
    </div>
  );
}

/** When the target is due. A choice only when there is one: a single option is said in words. */
export function DueField({ label, options, choice, onChoose, dates, labelClass, after }: {
  label: string;
  options: [number, string][];
  /** The week it's due. */
  choice: number;
  onChoose: (week: number) => void;
  /** That week's dates: "28 Dec–3 Jan 2027". */
  dates: string;
  labelClass: string;
  /** A sentence after, such as what carrying into next year means. */
  after?: string;
}) {
  if (options.length < 2) {
    const only = options.find(([w]) => w === choice) ?? options[0];
    return (
      <div className="field"><span className={labelClass}>{label}</span>
        <span className="due-only">{only ? only[1] + ' · ' : ''}due week {choice}, <DateRange>{dates}</DateRange></span>
        {after && <span className="hint">{after}</span>}
      </div>
    );
  }
  return (
    <div className="field"><span className={labelClass} id="end-l">{label}</span>
      <div className="seg full" role="group" aria-labelledby="end-l">
        {options.map(([w, l]) => <button key={w} type="button" aria-pressed={choice === w} onClick={() => onChoose(w)}>{l}</button>)}
      </div>
      <span className="hint">Due week {choice}, <DateRange>{dates}</DateRange>.{after ? ' ' + after : ''}</span>
    </div>
  );
}

type Stage = { id: string; name: string; dueWeek: string; done?: '' | 'yes' | 'no' };
/** A stage row's Must fix: the row (an index into the stages), which of its fields, and the words. */
export interface StageError { row: number; field: 'name' | 'week' | 'row'; text: string }

/** Dated stages: "Stage" and "Due week" said once above the rows; an error sits under the first row it's about. */
export function StageFields({ stages, onChange, onAdd, error, rowErrors, labelClass, weeks, goalName, onLeave, below }: {
  stages: Stage[];
  onChange: (stages: Stage[]) => void;
  onAdd: () => void;
  /** The validation message, shown once tried (set-up's cards, which say one line for the stages). */
  error: string | null;
  /** Each row's own Must fix (goal entry rule 2, by row), under the field it is about: the name, the week, or the row. */
  rowErrors?: StageError[];
  /** A field left (blur): Must fix is shown for a field once it has been changed and left. */
  onLeave?: () => void;
  labelClass: string;
  /** The cycle's weeks: only to find which row a week error is about. */
  weeks: number;
  /** Where several goals' stages share a screen (setting up a workspace), the goal each field belongs to. */
  goalName?: string;
  /** What is asked under a row (goal entry rule 3's stage-past, in the shared Check block): drawn by the form. */
  below?: (row: number) => ReactNode;
}) {
  const named = (what: string) => (goalName ? `${goalName}: ${what.charAt(0).toLowerCase()}${what.slice(1)}` : what);
  // A stage whose week changes is asked about again: "done" was said of the week it had.
  const edit = (id: string, patch: Partial<Stage>) => onChange(stages.map((x) => (x.id === id ? { ...x, ...patch, ...(patch.dueWeek != null && patch.dueWeek !== x.dueWeek ? { done: '' as const } : {}) } : x)));
  // The error goes under the row it's about: the first unnamed stage, the first with a week out of range, or the first row.
  const badName = !!error && !/week/.test(error);
  const used = (s: Stage) => !!(s.name.trim() || s.dueWeek.trim());
  const weekOk = (s: Stage) => { const w = Number(s.dueWeek.trim()); return s.dueWeek.trim() !== '' && Number.isInteger(w) && w >= 1 && w <= weeks; };
  const bad = !error ? -1 : Math.max(0, badName ? stages.findIndex((s) => used(s) && !s.name.trim()) : stages.findIndex((s) => used(s) && !weekOk(s)));
  // Rows with their own Must fix (New goal, the edit page); else the one line under the row it's about (set-up).
  const rowsSaid: StageError[] = rowErrors ?? (bad >= 0 && error ? [{ row: bad, field: badName ? 'name' : 'week', text: error }] : []);
  const said = (i: number, f: StageError['field']) => rowsSaid.some((e) => e.row === i && e.field === f);
  return (
    <div className="stages" role="group" aria-label="Stages">
      <div className="stage-head" aria-hidden="true"><span className={labelClass}>Stage</span><span className={labelClass}>Due week</span></div>
      {stages.map((s, i) => (
        <div key={s.id} className="stage">
          <div className="stage-row">
            <input className="input stage-name" value={s.name} aria-label={named(`Stage ${i + 1}`)} aria-invalid={said(i, 'name')} data-field={i === 0 ? 'stages' : undefined} onBlur={onLeave} onChange={(e) => edit(s.id, { name: e.target.value })} placeholder={i === 0 ? 'e.g. Threat model' : 'Stage name'} />
            <input className="input stage-week" inputMode="numeric" aria-label={named(`Stage ${i + 1}: due week`)} aria-invalid={said(i, 'week')} onBlur={onLeave} value={s.dueWeek} onChange={(e) => edit(s.id, { dueWeek: e.target.value })} placeholder="Due week" />
            {stages.length > 1 ? <button type="button" className="iconbtn stage-remove" onClick={() => onChange(stages.filter((x) => x.id !== s.id))} aria-label={named('Remove stage ' + (i + 1))}><Icon name="close" /></button> : <span className="stage-remove" aria-hidden="true" />}
          </div>
          {below?.(i)}
          {rowsSaid.filter((e) => e.row === i).map((e) => <FieldError key={e.field + e.text}>{e.text}</FieldError>)}
        </div>
      ))}
      <div><button type="button" className="btn sm" onClick={onAdd}><Icon name="plus" />Add a stage</button></div>
    </div>
  );
}

/** The stage rows' own Must fix, from goal entry's rule 2: a name twice or missing under the name, a week under the week. */
export const stageErrors = (fix: readonly MustFix[]): StageError[] =>
  fix.filter((f) => f.field === 'stages').map((f) => ({ row: f.row ?? 0, field: f.id === 'stage-name' || f.id === 'stage-twice' || f.id === 'stage-none' ? 'name' : f.id === 'stage-week' ? 'week' : 'row', text: f.text }));

/**
 * Decimals, worked out (goal entry 2.4, item 4): no field, one line under the numbers, "Kept as whole numbers, as you
 * typed them." with Change, which shows the four choices. `chosen` is what Decimals says ('' while worked out).
 */
export function DecimalsLine({ places, chosen, onChoose }: { places: number; chosen: string; onChoose: (d: string) => void }) {
  const [open, setOpen] = useState(false);
  const said = places === 0 ? 'Kept as whole numbers' : `Kept to ${placesText(places)}`;
  if (!open) return <p className="hint decimals-line">{said}{chosen.trim() ? '.' : ', as you typed them.'} <button type="button" className="linkish" onClick={() => setOpen(true)} aria-label="Change the decimal places">Change</button></p>;
  return (
    <div className="field"><span className="small strong" id="dp-l">Decimal places</span>
      <div className="seg full" role="group" aria-labelledby="dp-l">
        {[0, 1, 2, 3].map((n) => <button key={n} type="button" aria-pressed={places === n} onClick={() => { onChoose(String(n)); setOpen(false); }}>{n === 0 ? 'Whole numbers' : n === 3 ? '3 decimal places' : String(n)}</button>)}
      </div>
    </div>
  );
}
