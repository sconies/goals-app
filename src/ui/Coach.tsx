/* The walkthrough coach: a small card saying what to do next, and a ring round the thing to use. You do the steps
   yourself; it notices and moves on. */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { readTour, TOURS, writeTour, type TourState } from '../app/tours';
import { placeCoach, type PlaceOptions, type Side } from './coachPlace';

function find(target: { selector: string; text?: string } | undefined): HTMLElement | null {
  if (!target) return null;
  const all = [...document.querySelectorAll<HTMLElement>(target.selector)].filter((e) => e.offsetParent !== null || e.getClientRects().length > 0);
  return (target.text ? all.find((e) => e.textContent?.toLowerCase().includes(target.text!.toLowerCase())) : all[0]) ?? null;
}

export function Coach() {
  const [state, setState] = useState<TourState | null>(readTour);
  const [ring, setRing] = useState<DOMRect | null>(null);
  const [missing, setMissing] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const box = useRef<HTMLElement>(null);
  // A step that's done on reaching a page only counts once you've been somewhere else since it began, so starting a
  // walkthrough while already on that page doesn't skip the step.
  const away = useRef(false);
  useEffect(() => { away.current = false; }, [state?.id, state?.step]);
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
      // When the step's target isn't there (the demo has moved on), point at its alternative and say why.
      const main = find(step.target);
      const alt = !main && step.ifMissing ? find(step.ifMissing.target) : null;
      setMissing(!main && !!step.ifMissing);
      const el = main ?? alt;
      setRing(el ? el.getBoundingClientRect() : null);
      setHint(readHint(el));
      const d = step.doneWhen;
      if (!d) return;
      const route = pathname + search;
      if (d.route && !d.route.test(route)) away.current = true;
      const done = (d.route && away.current && d.route.test(route)) || (d.selector && !!document.querySelector(d.selector)) || (d.text && document.body.innerText.includes(d.text));
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
      <aside ref={box} className="coach" style={coachAt(ring, box.current, hint)} role="dialog" aria-modal="false" aria-label={`Walkthrough: ${tour.title}`}>
        <span className="coach-head"><span className="label">{tour.role} · step {state.step + 1} of {tour.steps.length}</span><button type="button" className="linkish small" onClick={() => writeTour(null)}>End</button></span>
        <span className="coach-title">{tour.title}</span>
        <p className="coach-say" aria-live="polite">{missing && step.ifMissing ? step.ifMissing.say : step.say}</p>
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

/**
 * A screen can say where the coach goes (the map does): on the target, `data-coach-place="left below end"` (the sides to
 * try, and 'end' to line up with its far edge) and `data-coach-gap`; when a step points at nothing, an element marked
 * `data-coach-anchor` is placed beside instead, without a ring; anything marked `data-coach-avoid` is kept clear.
 */
type Hint = { anchor: DOMRect | null; gap?: number; opts: PlaceOptions };
const SIDES: Side[] = ['below', 'above', 'right', 'left'];
function readHint(target: HTMLElement | null): Hint | null {
  const el = target ?? document.querySelector<HTMLElement>('[data-coach-anchor]');
  const avoid = [...document.querySelectorAll<Element>('[data-coach-avoid]')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({ left: r.left, top: r.top, width: r.width, height: r.height }));
  if (!el?.dataset.coachPlace && !el?.dataset.coachGap && !avoid.length && !(el && !target)) return null;
  const words = (el?.dataset.coachPlace ?? '').split(/\s+/);
  return {
    anchor: el && !target ? el.getBoundingClientRect() : null,
    gap: el?.dataset.coachGap ? Number(el.dataset.coachGap) : undefined,
    opts: { sides: SIDES.filter((s) => words.includes(s)).sort((a, b) => words.indexOf(a) - words.indexOf(b)), align: words.includes('end') ? 'end' : 'start', avoid },
  };
}

/** The coach beside its target (see coachPlace): on a phone, clear of the top bar and the tab bar. */
function coachAt(ring: DOMRect | null, el: HTMLElement | null, hint?: Hint | null): { left: number; top: number } {
  const w = window.innerWidth, h = window.innerHeight;
  const phone = w <= 760;
  const size = { width: el?.offsetWidth || Math.min(360, w - 32), height: el?.offsetHeight || 210 };
  const a = hint?.anchor;
  const target = ring ? { left: ring.left - 6, top: ring.top - 6, width: ring.width + 12, height: ring.height + 12 } : a ? { left: a.left, top: a.top, width: a.width, height: a.height } : null;
  return placeCoach(target, size, { width: w, height: h, reservedTop: phone ? 60 : 0, reservedBottom: phone ? 80 : 0 }, hint?.gap ?? 12, hint?.opts);
}
