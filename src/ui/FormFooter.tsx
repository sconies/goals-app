/* One form footer (FORM-FOOTER; docs/design/patterns/spec.md section 3). A status line above the buttons (what the
   primary will do on the last step, or what is left to fix), Back at the left from the second step on, and the one
   primary at the right, labelled with a verb and an object: never "Continue", "Submit", "OK" or "Save" alone. A form's
   exit is the header's Close, never the footer's; a sheet, which has no header, puts Cancel at the left instead (3.5).
   At 360px, when Back and the primary don't fit side by side, the primary takes the full width and Back sits above it
   as a text link (form-footer.css). */
import { useRef, type ReactNode } from 'react';
import { DRAFT_KEPT } from '../domain/formFooter';

export function FormFooter({ status, statusTone, onBack, onCancel, cancelLabel, children, className, sheet }: {
  /** One short line above the buttons; nothing takes no space. */
  status?: ReactNode;
  /** 'off' when the line says what is left to fix. */
  statusTone?: 'off';
  /** Back, kept for the second step of a stepped form and later; it keeps what was typed. */
  onBack?: () => void;
  /** In a sheet: Cancel at the left (a sheet has no header exit). */
  onCancel?: () => void;
  /** Cancel's words, when a sheet's quiet action is something else ("Close", "Clear"). */
  cancelLabel?: string;
  /** The primary (and anything quiet that sits before it). */
  children?: ReactNode;
  className?: string;
  /** In a sheet: the sheet's own sticky foot, not the page's. */
  sheet?: boolean;
}) {
  const line = status ? <p className={'foot-status small' + (statusTone ? ' tone-' + statusTone : ' muted')} role="status">{status}</p> : null;
  if (sheet) {
    return (
      <div className={'sheet-foot form-foot' + (line ? ' has-status' : '') + (className ? ' ' + className : '')}>
        {line}
        {onCancel && <button type="button" className="btn ghost foot-cancel" onClick={onCancel}>{cancelLabel ?? 'Cancel'}</button>}
        {children}
      </div>
    );
  }
  return (
    <div className={'focus-foot form-foot' + (className ? ' ' + className : '')}>
      {line}
      <div className={'foot-row' + (onBack ? ' has-back' : '')}>
        {onBack && <button type="button" className="btn ghost foot-back" onClick={onBack}>Back</button>}
        {children}
      </div>
    </div>
  );
}

/** "Draft kept in this browser.", said once: on the first step after the draft was first saved (patterns spec 3.4.2).
    Not for a draft that was resumed: whoever resumed it knows where it was kept. */
export function useKeptOnce(typed: boolean, resumed: boolean, step: string | number): string | null {
  const first = useRef<string | number | null>(null);
  const shown = useRef<string | number | null>(null);
  if (typed && !resumed && first.current == null) first.current = step;
  if (first.current != null && shown.current == null && step !== first.current) shown.current = step;
  return shown.current != null && step === shown.current ? DRAFT_KEPT : null;
}
