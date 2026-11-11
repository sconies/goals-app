/* The two levels a form asks at (round 2's shared decision; check-in spec, 2 "Levels"): a Must fix, which stops the form
   until it is fixed, and a Check, a question that must be answered. Drawn as wireframe 4: a block with a full outline or a
   wash, the warning mark and the level's word; never a status shape, never an edge stripe. Shared by the check-in form
   and its table, and meant for goal entry and the import (IM2, GE2). */
import type { RefObject } from 'react';
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
