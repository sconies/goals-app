/* The two levels a form asks at (round 2's shared decision; check-in spec, 2 "Levels"): a Must fix, which stops the form
   until it is fixed, and a Check, a question that must be answered. Drawn as wireframe 4: a block with a full outline or a
   wash, the warning mark and the level's word; never a status shape, never an edge stripe. Shared by the check-in form
   and its table, and meant for goal entry and the import (IM2, GE2). */
import type { ReactNode, RefObject } from 'react';
import { WarnMark } from './bits';

/** A question to answer before the form goes on: the question in bold and two plain buttons. */
export function CheckBlock({ id, question, yes, no, onYes, onNo, alert, blockRef }: { id: string; question: string; yes: string; no: string; onYes: () => void; onNo: () => void; alert?: boolean; blockRef?: RefObject<HTMLDivElement | null> }) {
  return (
    <div className={'level-block level-check' + (alert ? ' level-alert' : '')} role="group" aria-labelledby={id} tabIndex={-1} ref={blockRef}>
      <span className="level-head"><WarnMark /><span className="level-word">Check</span></span>
      <strong id={id} className="level-q">{question}</strong>
      <span className="level-actions">
        <button type="button" className="btn" onClick={onYes}>{yes}</button>
        <button type="button" className="btn" onClick={onNo}>{no}</button>
      </span>
    </div>
  );
}

/** Something to fix: what was read, in bold, and the fix. */
export function MustFixBlock({ id, read, fix }: { id: string; read: string; fix: string }) {
  return (
    <div className="level-block level-fix" id={id} role="alert">
      <span className="level-head"><WarnMark /><span className="level-word">Must fix</span></span>
      <span><strong>{read}</strong> {fix}</span>
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
