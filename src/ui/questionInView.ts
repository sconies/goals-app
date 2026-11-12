/* Goal entry's questions, seen where they are asked (GE2, 2.1 item 3; U93): one way for New goal, the edit page and
   set-up's goal cards. A question that appears while a number is typed is scrolled into view, the field still in view
   and still focused: nothing is taken from the person mid-typing. Continue or Save with a question open moves focus to it
   at once. The scroll is smooth unless the person asks for reduced motion; nothing moves if the question is already seen. */
import { reducedMotion } from './motion';

/** Room kept above and below, in px, so the question isn't flush with the edge or the sticky foot. */
const ROOM = 16;

/** The bottom of what can be seen: the screen, or the top of a sticky foot (the form's button) or a fixed tab bar. */
function foldOf(el: HTMLElement): number {
  let fold = window.innerHeight;
  const covers = [el.closest('form')?.querySelector<HTMLElement>('.focus-foot'), ...document.querySelectorAll<HTMLElement>('.tabbar')];
  for (const c of covers) {
    if (!c || !c.getClientRects().length) continue;
    const pos = getComputedStyle(c).position;
    if (pos !== 'sticky' && pos !== 'fixed') continue;
    const top = c.getBoundingClientRect().top;
    if (top > 0 && top < fold) fold = top;
  }
  return fold;
}

/**
 * Scrolls `el` up into view when its bottom is below the fold, by no more than keeps its own top, and `keep`'s (the field
 * being typed in), in view. Never scrolls down to it, and never moves focus.
 */
export function bringIntoView(el: HTMLElement, keep?: Element | null): void {
  const r = el.getBoundingClientRect();
  const fold = foldOf(el);
  let by = r.bottom - (fold - ROOM);
  if (by <= 0) return;
  by = Math.min(by, r.top - ROOM);
  if (keep) by = Math.min(by, keep.getBoundingClientRect().top - ROOM);
  if (by <= 0) return;
  window.scrollBy({ top: by, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** Called when a question first shows: brought into view only when it came from typing in a field of the same form. */
export function questionAppeared(el: HTMLElement | null): void {
  if (!el) return;
  const a = document.activeElement;
  const typing = a instanceof HTMLElement && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && a.closest('form') === el.closest('form');
  if (typing) bringIntoView(el, a);
}

/**
 * Continue or Save with a question open: focus goes to it now (it is already drawn under its field), scrolled into view
 * without a jump under reduced motion. A question on another step isn't drawn yet, so it is looked for again once it is.
 */
export function focusQuestion(root: ParentNode | null | undefined, slot: string | null | undefined): void {
  if (!root || !slot) return;
  const find = () => root.querySelector<HTMLElement>(`[data-check="${CSS.escape(slot)}"]`);
  const go = (el: HTMLElement) => {
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  const now = find();
  if (now) { go(now); return; }
  setTimeout(() => { const later = find(); if (later) go(later); }, 0);
}
