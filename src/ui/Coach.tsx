/* The walkthrough coach: a small card saying what to do next, and a ring round the thing to use. You do the steps
   yourself; it notices and moves on. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { readTour, TOURS, writeTour, type TourState } from '../app/tours';
import { placeCoach, ringBox, type Box, type PlaceOptions, type Side } from './coachPlace';

function find(target: { selector: string; text?: string } | undefined): HTMLElement | null {
  if (!target) return null;
  const all = [...document.querySelectorAll<HTMLElement>(target.selector)].filter((e) => e.offsetParent !== null || e.getClientRects().length > 0);
  return (target.text ? all.find((e) => e.textContent?.toLowerCase().includes(target.text!.toLowerCase())) : all[0]) ?? null;
}

/** The bars a phone keeps on screen: the top bar and the tab bar (none in a focused flow, where they're hidden). */
const reserved = () => {
  const phone = window.innerWidth <= 760;
  return { top: phone ? 60 : 0, bottom: phone ? 80 : 0 };
};

export function Coach() {
  const [state, setState] = useState<TourState | null>(readTour);
  const [ring, setRing] = useState<Box | null>(null);
  const [missing, setMissing] = useState(false);
  // The card's real size, measured after each render, so it's placed from what it shows now (not the last step's text).
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const box = useRef<HTMLElement>(null);
  // A step that's done on reaching a page only counts once you've been somewhere else since it began, so starting a
  // walkthrough while already on that page doesn't skip the step.
  const away = useRef(false);
  // Each step's target is scrolled into view once, when it's first found; after that the page is yours to scroll.
  const shown = useRef<string | null>(null);
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
    const key = `${tour.id}:${state.step}`;
    const tick = () => {
      // When the step's target isn't there (the demo has moved on), point at its alternative and say why.
      const main = find(step.target);
      const alt = !main && step.ifMissing ? find(step.ifMissing.target) : null;
      setMissing(!main && !!step.ifMissing);
      const el = main ?? alt;
      const r = el?.getBoundingClientRect();
      // Below the fold (or under a bar): bring it to the middle of the screen first. The map pans itself, so not there.
      if (el && r && shown.current !== key) {
        shown.current = key;
        const res = reserved();
        const out = r.top < res.top + 16 || r.bottom > window.innerHeight - res.bottom - 16;
        if (out && !el.closest('.react-flow, .goalmap')) {
          const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
        }
      }
      const next = r ? ringBox(r, { width: window.innerWidth, height: window.innerHeight }) : null;
      setRing((cur) => (cur && next && cur.left === next.left && cur.top === next.top && cur.width === next.width && cur.height === next.height ? cur : next));
      setHint(readHint(el));
      const d = step.doneWhen;
      if (!d) return;
      const route = pathname + search;
      if (d.route && !d.route.test(route)) away.current = true;
      const text = d.text;
      const said = !!text && (typeof text === 'string' ? document.body.innerText.includes(text) : text.test(document.body.innerText));
      const done = (d.route && away.current && d.route.test(route)) || (d.selector && !!document.querySelector(d.selector)) || said;
      if (done) writeTour({ id: tour.id, step: state.step + 1 });
    };
    tick();
    const t = setInterval(tick, 350);
    // Scrolling moves the target: follow it at once rather than at the next tick.
    const onScroll = () => { const el = find(step.target) ?? (step.ifMissing ? find(step.ifMissing.target) : null); const r = el?.getBoundingClientRect(); setRing(r ? ringBox(r, { width: window.innerWidth, height: window.innerHeight }) : null); };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll);
    return () => { clearInterval(t); window.removeEventListener('scroll', onScroll, { capture: true }); window.removeEventListener('resize', onScroll); };
  }, [tour, step, state, pathname, search]);

  // Measure the card as it is now, before it's painted, so a longer or shorter step never ends off the screen.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const s = { width: el.offsetWidth, height: el.offsetHeight };
    if (!size || size.width !== s.width || size.height !== s.height) setSize(s);
  });

  if (!tour || !step || !state) return null;
  const last = state.step >= tour.steps.length - 1;
  return (
    <>
      {ring && <div className="coach-ring" aria-hidden="true" style={{ top: ring.top, left: ring.left, width: ring.width, height: ring.height }} />}
      <aside ref={box} className="coach" style={coachAt(ring, size, hint)} role="dialog" aria-modal="false" aria-label={`Walkthrough: ${tour.title}`}>
        <span className="coach-head"><span className="label">{tour.role} · step {state.step + 1} of {tour.steps.length}</span><button type="button" className="linkish small" onClick={() => writeTour(null)}>End</button></span>
        <span className="coach-title">{tour.title}</span>
        <p className="coach-say" aria-live="polite">{missing && step.ifMissing ? step.ifMissing.say : step.say}</p>
        <span className="row coach-actions" style={{ gap: 'var(--s2)' }}>
          {state.step > 0 && <button type="button" className="btn sm" onClick={() => writeTour({ id: tour.id, step: state.step - 1 })}>Back</button>}
          {last
            ? <button type="button" className="btn sm" onClick={() => writeTour(null)}>Finish</button>
            : <button type="button" className="btn ghost sm coach-skip" onClick={() => writeTour({ id: tour.id, step: state.step + 1 })}>Skip this step</button>}
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

/** The coach beside its target (see coachPlace): on a phone, clear of the top bar and the tab bar; on a desktop, clear of
    the sidebar. A step that points at nothing is placed beside the screen's anchor, if it marks one. */
function coachAt(ring: Box | null, size: { width: number; height: number } | null, hint?: Hint | null): { left: number; top: number } {
  const w = window.innerWidth, h = window.innerHeight;
  const res = reserved();
  const main = document.querySelector('main.work')?.getBoundingClientRect();
  const s = size ?? { width: Math.min(360, w - 32), height: 210 };
  const a = hint?.anchor;
  const target = ring ?? (a ? { left: a.left, top: a.top, width: a.width, height: a.height } : null);
  return placeCoach(target, s, { width: w, height: h, reservedTop: res.top, reservedBottom: res.bottom, reservedLeft: Math.max(0, Math.round(main?.left ?? 0)) }, hint?.gap ?? 12, hint?.opts);
}
