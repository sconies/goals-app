/* The walkthrough coach: a small card saying what to do next, and a ring round the thing to use. You do the steps
   yourself; it notices and moves on. */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { readTour, TOURS, writeTour, type TourState } from '../app/tours';

function find(target: { selector: string; text?: string } | undefined): HTMLElement | null {
  if (!target) return null;
  const all = [...document.querySelectorAll<HTMLElement>(target.selector)].filter((e) => e.offsetParent !== null || e.getClientRects().length > 0);
  return (target.text ? all.find((e) => e.textContent?.toLowerCase().includes(target.text!.toLowerCase())) : all[0]) ?? null;
}

/** Would the coach, in its usual place (bottom right; along the bottom on a phone), cover what it points at? */
function hidesTarget(r: DOMRect): boolean {
  const w = window.innerWidth, h = window.innerHeight;
  const phone = w <= 640;
  const box = phone ? { left: 0, right: w, top: h - 72 - 230, bottom: h } : { left: w - 400, right: w, top: h - 240, bottom: h };
  return r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom;
}

export function Coach() {
  const [state, setState] = useState<TourState | null>(readTour);
  const [ring, setRing] = useState<DOMRect | null>(null);
  const { pathname, search } = useLocation();
  useEffect(() => {
    const on = () => setState(readTour());
    window.addEventListener('goals-tour', on);
    return () => window.removeEventListener('goals-tour', on);
  }, []);
  const tour = state ? TOURS.find((t) => t.id === state.id) : undefined;
  const step = tour?.steps[state!.step];

  // Watch for the step being done, and keep the ring on its target as the page moves.
  useEffect(() => {
    if (!tour || !step || !state) { setRing(null); return; }
    const tick = () => {
      const el = find(step.target);
      setRing(el ? el.getBoundingClientRect() : null);
      const d = step.doneWhen;
      if (!d) return;
      const route = pathname + search;
      const done = (d.route && d.route.test(route)) || (d.selector && !!document.querySelector(d.selector)) || (d.text && document.body.innerText.includes(d.text));
      if (done) writeTour({ id: tour.id, step: state.step + 1 });
    };
    tick();
    const t = setInterval(tick, 350);
    return () => clearInterval(t);
  }, [tour, step, state, pathname, search]);

  if (!tour || !step || !state) return null;
  const last = state.step >= tour.steps.length - 1;
  return (
    <>
      {ring && <div className="coach-ring" aria-hidden="true" style={{ top: ring.top - 6, left: ring.left - 6, width: ring.width + 12, height: ring.height + 12 }} />}
      <aside className={'coach' + (ring && hidesTarget(ring) ? ' at-top' : '')} role="dialog" aria-modal="false" aria-label={`Walkthrough: ${tour.title}`}>
        <span className="coach-head"><span className="label">{tour.role} · step {state.step + 1} of {tour.steps.length}</span><button type="button" className="linkish small" onClick={() => writeTour(null)}>End</button></span>
        <span className="coach-title">{tour.title}</span>
        <p className="coach-say" aria-live="polite">{step.say}</p>
        <span className="row" style={{ gap: 'var(--s2)' }}>
          {state.step > 0 && <button type="button" className="btn sm" onClick={() => writeTour({ id: tour.id, step: state.step - 1 })}>Back</button>}
          {last
            ? <button type="button" className="btn sm" onClick={() => writeTour(null)}>Finish</button>
            : <button type="button" className="btn ghost sm" onClick={() => writeTour({ id: tour.id, step: state.step + 1 })}>Skip this step</button>}
        </span>
      </aside>
    </>
  );
}
