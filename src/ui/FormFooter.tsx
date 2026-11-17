/* One form footer (FORM-FOOTER; docs/design/patterns/spec.md section 3). A status line above the buttons (what the
   primary will do on the last step, or what is left to fix), Back at the left from the second step on, and the one
   primary at the right, labelled with a verb and an object: never "Continue", "Submit", "OK" or "Save" alone. A form's
   exit is the header's Close, never the footer's; a sheet, which has no header, puts Cancel at the left instead. */
import type { ReactNode } from 'react';

export function FormFooter({ status, statusTone, onBack, children, className, sheet }: {
  /** One short line above the buttons; nothing takes no space. */
  status?: ReactNode;
  /** 'off' when the line says what is left to fix. */
  statusTone?: 'off';
  /** Back, kept for the second step of a stepped form and later; it keeps what was typed. */
  onBack?: () => void;
  /** The primary (and, in a sheet, Cancel before it). */
  children: ReactNode;
  className?: string;
  /** In a sheet: not sticky, as the sheet's own foot. */
  sheet?: boolean;
}) {
  return (
    <div className={(sheet ? 'sheet-foot-wrap' : 'focus-foot') + ' form-foot' + (className ? ' ' + className : '')}>
      {status ? <p className={'foot-status small' + (statusTone ? ' tone-' + statusTone : ' muted')} role="status">{status}</p> : null}
      <div className="foot-row">
        {onBack && <button type="button" className="btn ghost" onClick={onBack}>Back</button>}
        {children}
      </div>
    </div>
  );
}
