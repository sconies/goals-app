/* The two levels a form asks at (round 2's shared decision; check-in spec, 2 "Levels"): a Must fix, which stops the form
   until it is fixed, and a Check, a question that must be answered. Drawn as wireframe 4: a block with a full outline or a
   wash, the warning mark and the level's word; never a status shape, never an edge stripe. Shared by the check-in form
   and its table, goal entry's forms (GE2: New goal, the edit page, set-up's goal cards) and the import (IM2). */
import type { ReactNode, RefObject } from 'react';
import { WarnMark } from './bits';

/** A question to answer before the form goes on: the question in bold and two plain buttons. */
export function CheckBlock({ id, question, yes, no, onYes, onNo, alert, blockRef, slot }: { id: string; question: string; yes: string; no: string; onYes: () => void; onNo: () => void; alert?: boolean; blockRef?: RefObject<HTMLDivElement | null>; slot?: string }) {
  return (
    <div className={'level-block level-check' + (alert ? ' level-alert' : '')} role="group" aria-labelledby={id} tabIndex={-1} ref={blockRef} data-check={slot}>
      <span className="level-head"><WarnMark /><span className="level-word">Check</span></span>
      <strong id={id} className="level-q">{question}</strong>
      <span className="level-actions">
        <button type="button" className="btn" onClick={onYes}>{yes}</button>
        <button type="button" className="btn" onClick={onNo}>{no}</button>
      </span>
    </div>
  );
}

/** A question already answered, collapsed to one line (goal entry 2.1, item 3): "You said 150% is right." with Change,
    which asks it again. */
export function CheckSaid({ children, onChange }: { children: ReactNode; onChange: () => void }) {
  return <p className="small check-said" role="status">{children} <button type="button" className="linkish" onClick={onChange}>Change</button></p>;
}

/** Something to fix: what was read, in bold, and the fix. */
export function MustFixBlock({ id, read, fix }: { id: string; read: string; fix: string }) {
  // What was read, in bold, unless the fix already starts with it (“0.415 has 3 decimal places…”): said once.
  const bare = read.replace(/^“|”$/g, '');
  const lead = [read, bare].find((x) => !!x && fix.startsWith(x));
  const says = lead ? <><strong>{lead}</strong>{fix.slice(lead.length)}</> : <><strong>{read}</strong> {fix}</>;
  return (
    <div className="level-block level-fix" id={id} role="alert">
      <span className="level-head"><WarnMark /><span className="level-word">Must fix</span></span>
      <span>{says}</span>
    </div>
  );
}

/** A Must fix under its own field (goal entry 2.1, item 2): the warning mark and the words, read out as they appear. The
    field itself carries `aria-invalid` and a full outline. Never a status shape, never an edge stripe. */
export function MustFixLine({ id, children }: { id?: string; children: ReactNode }) {
  return <span className="field-error must-fix-line" id={id} role="alert"><WarnMark /><span>{children}</span></span>;
}

/** The line above a form's button when it can't go on yet (goal entry rule 4, check-in rule 3): the mark and the line. */
export function FixLine({ children }: { children: ReactNode }) {
  return <p className="fix-line small" role="status"><WarnMark /><span>{children}</span></p>;
}
