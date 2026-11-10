/* The app's own label (navigation spec, 2.2): on the collapsed rail, each row names itself in a small flat box to its
   right, after 300 ms on pointer hover and at once on keyboard focus, with the row's full words ("Check-in, 5 to do").
   It reads the row's data-label, so the native title (said twice by screen readers) isn't needed. Only while `on`. */
import { useEffect, useRef, useState, type RefObject } from 'react';

export function RailLabel({ within, on }: { within: RefObject<HTMLElement | null>; on: boolean }) {
  const [shown, setShown] = useState<{ text: string; top: number; left: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const el = within.current;
    if (!el || !on) { setShown(null); return; }
    const target = (e: Event) => (e.target as HTMLElement | null)?.closest?.('[data-label]') as HTMLElement | null;
    const show = (t: HTMLElement) => { const r = t.getBoundingClientRect(); setShown({ text: t.dataset.label ?? '', top: r.top + r.height / 2, left: r.right + 8 }); };
    const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
    const over = (e: Event) => { const t = target(e); clear(); if (t) timer.current = setTimeout(() => show(t), 300); else setShown(null); };
    const focus = (e: Event) => { const t = target(e); clear(); if (t && (t as HTMLElement).matches(':focus-visible')) show(t); };
    const hide = () => { clear(); setShown(null); };
    el.addEventListener('mouseover', over);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focusin', focus);
    el.addEventListener('focusout', hide);
    return () => { clear(); el.removeEventListener('mouseover', over); el.removeEventListener('mouseleave', hide); el.removeEventListener('focusin', focus); el.removeEventListener('focusout', hide); };
  }, [within, on]);
  return shown ? <div className="rail-label" role="tooltip" style={{ top: shown.top, left: shown.left }}>{shown.text}</div> : null;
}
