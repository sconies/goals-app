/* Fields the new-goal wizard, Edit goal and setting up a workspace share, so they look and behave the same in each. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { levelsOf } from '../domain/levels';
import { useApp } from '../app/state';
import type { Cycle, Level } from '../domain/types';
import { WeekPick } from './WeekPick';
import type { GoalAnswers, GoalCheck, MustFix } from '../domain/goalEntry';
import { placesText } from '../domain/numbers';
import { Icon } from './Icon';
import { CheckBlock, CheckSaid, MustFixLine } from './Levels';
import { questionAppeared } from './questionInView';


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
        : <OpenQuestion key={c.slot} c={c} alert={alertSlot === c.slot} onYes={() => onAnswer(c)} onNo={() => onNo(c)} />)}
    </>
  );
}

/** One open question. Asked while a number is typed, it is scrolled into view (U93: on a phone it was below the fold),
    leaving focus in the field; asked again for new values (150 then 160), the same. */
function OpenQuestion({ c, alert, onYes, onNo }: { c: GoalCheck; alert: boolean; onYes: () => void; onNo: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { questionAppeared(ref.current); }, [c.slot, c.key]);
  return <CheckBlock id={`q-${c.slot.replace(/[^\w-]/g, '-')}`} slot={c.slot} question={c.question} yes={c.yes} no={c.no} alert={alert} onYes={onYes} onNo={onNo} blockRef={ref} />;
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

type Stage = { id: string; name: string; dueWeek: string; done?: '' | 'yes' | 'no' };
/** A stage row's Must fix: the row (an index into the stages), which of its fields, and the words. */
export interface StageError { row: number; field: 'name' | 'week' | 'row'; text: string }

/** Dated stages: "Stage" and "Due" said once above the rows, each Due the week picker (2.13); an error sits under the
    first row it's about. */
export function StageFields({ stages, onChange, onAdd, error, rowErrors, labelClass, cycle, week, goalName, onLeave, below }: {
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
  /** The cycle (its first day and length): what the picker offers, within this goal year. */
  cycle: Pick<Cycle, 'startDate' | 'weeks'>;
  /** This week. */
  week: number;
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
  const weekOk = (s: Stage) => { const w = Number(s.dueWeek.trim()); return s.dueWeek.trim() !== '' && Number.isInteger(w) && w >= 1 && w <= cycle.weeks; };
  const bad = !error ? -1 : Math.max(0, badName ? stages.findIndex((s) => used(s) && !s.name.trim()) : stages.findIndex((s) => used(s) && !weekOk(s)));
  // Rows with their own Must fix (New goal, the edit page); else the one line under the row it's about (set-up).
  const rowsSaid: StageError[] = rowErrors ?? (bad >= 0 && error ? [{ row: bad, field: badName ? 'name' : 'week', text: error }] : []);
  const said = (i: number, f: StageError['field']) => rowsSaid.some((e) => e.row === i && e.field === f);
  return (
    <div className="stages" role="group" aria-label="Stages">
      <div className="stage-head" aria-hidden="true"><span className={labelClass}>Stage</span><span className={labelClass}>Due</span></div>
      {stages.map((s, i) => (
        <div key={s.id} className="stage">
          <div className="stage-row">
            <input className="input stage-name" value={s.name} aria-label={named(`Stage ${i + 1}`)} aria-invalid={said(i, 'name')} data-field={i === 0 ? 'stages' : undefined} onBlur={onLeave} onChange={(e) => edit(s.id, { name: e.target.value })} placeholder={i === 0 ? 'e.g. Threat model' : 'Stage name'} />
            <div className="stage-week" onBlur={onLeave}>
              <WeekPick cycle={cycle} week={week} field="stage" label={named(`Stage ${i + 1}: due`)} labelClass="sr" value={weekOk(s) ? Number(s.dueWeek) : null} invalid={said(i, 'week')} onChange={(n) => edit(s.id, { dueWeek: String(n) })} />
            </div>
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
