/* Goals' "Export these goals" (the spreadsheets module's goals.tools place). The button is drawn with the page, so
   nothing above the goals moves when it arrives; the export itself (the sheet, the writers and the column rules) loads
   when it is opened (the bundle budget, scripts/check-bundle.mjs). */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../app/state';
import type { Goal } from '../../domain/types';

const ExportSheet = lazy(() => import('./Export').then((m) => ({ default: m.ExportSheet })));

/** Goals' one way out (the goals.tools place): an item in the Views menu, or the phone's View sheet. Import and the rest are on Data. */
export function ExportTheseGoals({ goals, viewName, inMenu }: { goals: Goal[]; viewName: string; inMenu?: boolean }) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const item = useRef<HTMLButtonElement>(null);
  // Opened from the phone's View sheet, Export sits over it: the View sheet is hidden meanwhile, so its Done isn't a
  // second primary in view (one primary per screen), and it is back as it was when Export closes.
  useEffect(() => {
    const under = open && inMenu ? item.current?.closest<HTMLElement>('.sheet-wrap') : null;
    if (!under) return;
    under.classList.add('under-sheet');
    return () => under.classList.remove('under-sheet');
  }, [open, inMenu]);
  if (!app.snapshot.goals.length) return null;
  // An item in Goals' Views menu on every width (goals spec, 2.1; GL2), and in the phone's View sheet. The sheet opens in
  // the page, outside the menu, which closes as it opens.
  return (
    <>
      <button type="button" className="menuitem export-these-item" ref={item} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 2v8m0 0 3-3m-3 3L5 7M3 12.5h10" /></svg>Export these goals
      </button>
      {open && createPortal(<Suspense fallback={null}><ExportSheet goals={goals} viewName={viewName} onClose={() => setOpen(false)} /></Suspense>, item.current?.closest('.page') ?? document.body)}
    </>
  );
}
