/* The motion layer's logic: numbers that count to their new value, and rows that slide to their new place (FLIP).
   Interface motion is short (250ms at most) and the goal page's story slower (STORY_MS); all of it eases out, never blocks a click, and is off when the person asks for reduced
   motion. The CSS half lives in styles/notes/print-motion.css. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** The longest everyday interface motion takes (rows sliding, menus, counts in lists), in ms. */
export const MOTION_MS = 240;
/** The goal page's storytelling motion (its headline number counting up, its chart drawing in) runs slower, so it can be
   seen (Lane, 5 Nov). Still never blocking a click, and off under reduced motion. */
export const STORY_MS = 900;

export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
/** Where a count is at time t (0..1): eased, and exactly the final value at the end. */
export const tween = (from: number, to: number, t: number) => (t >= 1 ? to : from + (to - from) * easeOut(t));

/** Reduced motion asked for, or nowhere to move (no browser: tests and the server render the final state). */
export function reducedMotion(): boolean {
  try { return typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
}

/** The last value each counter showed, so a number counts from what you last saw to what it is now. */
const lastSeen = new Map<string, number>();

/**
 * A number that counts to its value: from what was last shown under `memo` (or `from` the first time), and from where
 * it is whenever the value changes. Returns the number to show this frame; it always lands on the value exactly.
 */
export function useCountUp(value: number, opts: { from?: number | null; memo?: string; duration?: number } = {}): number {
  const ms = opts.duration ?? MOTION_MS;
  const start = () => {
    if (reducedMotion()) return value;
    const prev = opts.memo != null ? lastSeen.get(opts.memo) : undefined;
    return prev ?? opts.from ?? value;
  };
  const [shown, setShown] = useState<number>(start);
  const cur = useRef(shown);
  cur.current = shown;
  useLayoutEffect(() => {
    if (opts.memo != null) lastSeen.set(opts.memo, value);
    const from = cur.current;
    if (from === value || reducedMotion() || !Number.isFinite(from)) { setShown(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = (now - t0) / ms;
      setShown(tween(from, value, t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // A hidden tab can hold frames back: the final value lands regardless.
    const done = setTimeout(() => { cancelAnimationFrame(raf); setShown(value); }, ms + 60);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return shown;
}

/* ---------- FLIP: rows slide to their new places ---------- */

export interface Pos { x: number; y: number }

/** How far each kept row has to travel back to where it was, and which rows are new. Moves under 1px are ignored. */
export function flipDeltas(before: Map<string, Pos>, after: Map<string, Pos>): { moved: Map<string, Pos>; added: string[] } {
  const moved = new Map<string, Pos>();
  const added: string[] = [];
  for (const [k, a] of after) {
    const b = before.get(k);
    if (!b) { added.push(k); continue; }
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) moved.set(k, { x: dx, y: dy });
  }
  return { moved, added };
}

/** The rows that move: goals in lists, the table, the board and cards, the attention lists and a review's agenda. */
export const FLIP_ITEMS = '.tree > li, .gtable > tbody > tr, .alist > *, .glist > *, .board-col > .board-card, .gcards > .gcard';

/** A row's identity: its own data-flip, else the goal it links to; a row with neither follows the row before it. */
function keyOf(el: Element, prev: string): string {
  const own = (el as HTMLElement).dataset?.flip;
  if (own) return own;
  const a = el.matches('a[href]') ? el : el.querySelector('a[href]');
  return a ? a.getAttribute('href')! : prev + '+';
}

function collect(root: Element): { els: HTMLElement[]; keys: string[] } {
  // Only the outermost rows: a nested list moves with its parent row.
  const all = [...root.querySelectorAll<HTMLElement>(FLIP_ITEMS)];
  const set = new Set<Element>(all);
  const els = all.filter((el) => { for (let p = el.parentElement; p && p !== root; p = p.parentElement) if (set.has(p)) return false; return true; });
  const seen = new Map<string, number>();
  let prev = '';
  const keys = els.map((el) => {
    const k = keyOf(el, prev);
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    prev = k;
    return n ? `${k}#${n}` : k;
  });
  return { els, keys };
}

function measure(root: Element, els: HTMLElement[], keys: string[]): Map<string, Pos> {
  const r = root.getBoundingClientRect();
  const m = new Map<string, Pos>();
  els.forEach((el, i) => { const b = el.getBoundingClientRect(); m.set(keys[i]!, { x: b.left - r.left, y: b.top - r.top + root.scrollTop }); });
  return m;
}

/**
 * Watches the work area: when the rows in it change order or membership (a sort, a filter, a goal moving status) on the
 * same page, each kept row slides from where it was to its new place and each new row fades in. Only transforms and
 * opacity move, so nothing shifts the layout, and the rows are clickable at their final place throughout.
 */
export function installFlip(root: HTMLElement): () => void {
  let keys: string[] = [];
  let pos = new Map<string, Pos>();
  let path = location.pathname;
  const refresh = () => {
    const c = collect(root);
    keys = c.keys;
    pos = measure(root, c.els, c.keys);
    path = location.pathname;
  };
  refresh();
  const onChange = () => {
    const c = collect(root);
    if (c.keys.length === keys.length && c.keys.every((k, i) => k === keys[i])) return;
    // Rows still sliding from a moment ago start again from their real place.
    c.els.forEach((el) => el.getAnimations?.().forEach((a) => { if (a.id === 'flip') a.cancel(); }));
    const now = measure(root, c.els, c.keys);
    const samePage = path === location.pathname;
    const { moved, added } = flipDeltas(pos, now);
    const kept = c.keys.length - added.length;
    if (samePage && kept > 0 && c.els.length <= 400 && !reducedMotion() && typeof c.els[0]?.animate === 'function') {
      c.els.forEach((el, i) => {
        const k = c.keys[i]!;
        const d = moved.get(k);
        if (d) el.animate([{ transform: `translate(${d.x}px, ${d.y}px)` }, { transform: 'none' }], { duration: MOTION_MS - 20, easing: 'cubic-bezier(.2, .8, .2, 1)', id: 'flip' });
        else if (!pos.has(k)) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out', id: 'flip' });
      });
    }
    keys = c.keys;
    pos = now;
    path = location.pathname;
  };
  const mo = new MutationObserver(onChange);
  mo.observe(root, { childList: true, subtree: true });
  // Where the rows are just before someone acts: a scroll or a resize since the last change doesn't count as a move.
  const before = () => refresh();
  root.addEventListener('pointerdown', before, true);
  root.addEventListener('keydown', before, true);
  addEventListener('resize', before);
  return () => {
    mo.disconnect();
    root.removeEventListener('pointerdown', before, true);
    root.removeEventListener('keydown', before, true);
    removeEventListener('resize', before);
  };
}

/** Puts the FLIP watcher on the work area once it exists. */
export function useFlipLayer() {
  useEffect(() => {
    const root = document.getElementById('main');
    if (!root) return;
    return installFlip(root);
  }, []);
}
