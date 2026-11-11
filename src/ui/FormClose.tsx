/* Leaving a form (navigation spec 2.5): one control, top right, a button with words. A form that keeps a draft says
   "Close and keep the draft" and closes at once. One that keeps nothing says "Close without saving", and when something
   was typed it asks first: "Close without saving? What you typed here will be lost." */
import { useState } from 'react';
import { Sheet } from './bits';
import { Icon } from './Icon';

export const KEEP = 'Close and keep the draft';
export const DISCARD = 'Close without saving';

export function FormClose({ keeps, dirty = false, onClose }: { keeps: boolean; dirty?: boolean; onClose: () => void }) {
  const [asking, setAsking] = useState(false);
  const words = keeps ? KEEP : DISCARD;
  return (
    <>
      <button type="button" className="btn ghost sm form-close" onClick={() => (!keeps && dirty ? setAsking(true) : onClose())}>
        <Icon name="close" /><span>{words}</span>
      </button>
      <Sheet open={asking} onClose={() => setAsking(false)} title={`${DISCARD}?`}>
        <div className="stack" style={{ gap: 'var(--s4)' }}>
          <p style={{ margin: 0 }}>What you typed here will be lost.</p>
          <div className="sheet-foot">
            <button type="button" className="btn ghost" onClick={() => setAsking(false)}>Keep editing</button>
            <button type="button" className="btn primary" onClick={() => { setAsking(false); onClose(); }}>{DISCARD}</button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
