/* Fields the new-goal wizard, Edit goal and setting up a workspace share, so they look and behave the same in each. */
import type { ReactNode } from 'react';
import { LEVEL_LABEL } from '../domain/format';
import type { Level } from '../domain/types';
import { Icon } from './Icon';

const LEVEL_ORDER: Level[] = ['team', 'svp', 'north-star'];
const LEVEL_HINT: Record<Level, string> = {
  team: 'Most goals. Flag SVP or North star only for goals reported at major reviews.',
  svp: 'Reported at SVP reviews.',
  'north-star': 'Reported at the top. You can have several.',
};

/** A field's error: said in words under the field, in the error colour. */
export function FieldError({ children }: { children: ReactNode }) {
  return <span className="field-error tone-off" role="alert">{children}</span>;
}

/** A date range that never breaks inside itself ("28 Dec–3 Jan 2027"). */
export const DateRange = ({ children }: { children: ReactNode }) => <span className="nobreak">{children}</span>;

/** The level: one segmented choice, with what it means underneath. */
export function LevelField({ level, onChange, labelClass }: { level: Level; onChange: (l: Level) => void; labelClass: string }) {
  return (
    <div className="field"><span className={labelClass} id="level-l">Level</span>
      <div className="seg full" role="group" aria-labelledby="level-l">
        {LEVEL_ORDER.map((l) => <button key={l} type="button" aria-pressed={level === l} onClick={() => onChange(l)}>{LEVEL_LABEL[l]}</button>)}
      </div>
      <span className="hint">{LEVEL_HINT[level]}</span>
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

/** Dated stages: "Stage" and "Due week" said once above the rows; an error sits under the first row it's about. */
export function StageFields({ stages, onChange, onAdd, error, labelClass, weeks, goalName, week }: {
  stages: Stage[];
  onChange: (stages: Stage[]) => void;
  onAdd: () => void;
  /** The validation message, shown once tried. */
  error: string | null;
  labelClass: string;
  /** The cycle's weeks: only to find which row a week error is about. */
  weeks: number;
  /** Where several goals' stages share a screen (setting up a workspace), the goal each field belongs to. */
  goalName?: string;
  /** This week, for a new goal: a stage due before it asks whether it is already done (onboarding spec, rule 3). */
  week?: number;
}) {
  const named = (what: string) => (goalName ? `${goalName}: ${what.charAt(0).toLowerCase()}${what.slice(1)}` : what);
  const edit = (id: string, patch: Partial<Stage>) => onChange(stages.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  // The error goes under the row it's about: the first unnamed stage, the first with a week out of range, or the first row.
  const badName = !!error && !/week/.test(error);
  const used = (s: Stage) => !!(s.name.trim() || s.dueWeek.trim());
  const weekOk = (s: Stage) => { const w = Number(s.dueWeek.trim()); return s.dueWeek.trim() !== '' && Number.isInteger(w) && w >= 1 && w <= weeks; };
  const past = (s: Stage) => week != null && weekOk(s) && Number(s.dueWeek.trim()) < week;
  const unanswered = !!error && /^Say whether/.test(error);
  const bad = !error ? -1 : Math.max(0, unanswered ? stages.findIndex((s) => past(s) && !s.done) : badName ? stages.findIndex((s) => used(s) && !s.name.trim()) : stages.findIndex((s) => used(s) && !weekOk(s)));
  return (
    <div className="stages" role="group" aria-label="Stages">
      <div className="stage-head" aria-hidden="true"><span className={labelClass}>Stage</span><span className={labelClass}>Due week</span></div>
      {stages.map((s, i) => (
        <div key={s.id} className="stage">
          <div className="stage-row">
            <input className="input stage-name" value={s.name} aria-label={named(`Stage ${i + 1}`)} aria-invalid={i === bad && badName} onChange={(e) => edit(s.id, { name: e.target.value })} placeholder={i === 0 ? 'e.g. Threat model' : 'Stage name'} />
            <input className="input stage-week" inputMode="numeric" aria-label={named(`Stage ${i + 1}: due week`)} aria-invalid={i === bad && !badName} value={s.dueWeek} onChange={(e) => edit(s.id, { dueWeek: e.target.value })} placeholder="Due week" />
            {stages.length > 1 ? <button type="button" className="iconbtn stage-remove" onClick={() => onChange(stages.filter((x) => x.id !== s.id))} aria-label={named('Remove stage ' + (i + 1))}><Icon name="close" /></button> : <span className="stage-remove" aria-hidden="true" />}
          </div>
          {past(s) && (() => {
            const w = Number(s.dueWeek.trim());
            const ago = week! - w;
            return s.done === 'yes'
              ? <p className="stage-past small">Done in week {w}. <button type="button" className="linkish" onClick={() => edit(s.id, { done: '' })}>Change</button></p>
              : (
                <div className="stage-past" role="status">
                  <span className="small">Week {w} was {ago} {ago === 1 ? 'week' : 'weeks'} ago. Is this stage already done?</span>
                  <span className="row stage-past-do">
                    <button type="button" className="btn sm" aria-pressed={false} onClick={() => edit(s.id, { done: 'yes' })}>Yes, done in week {w}</button>
                    <button type="button" className="btn sm" aria-pressed={s.done === 'no'} onClick={() => edit(s.id, { done: 'no' })}>No, it’s overdue</button>
                  </span>
                </div>
              );
          })()}
          {i === bad && error && <FieldError>{error}</FieldError>}
        </div>
      ))}
      <div><button type="button" className="btn sm" onClick={onAdd}><Icon name="plus" />Add a stage</button></div>
    </div>
  );
}
