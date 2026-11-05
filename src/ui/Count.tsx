import { useEffect, useRef } from 'react';
import { useCountUp, useFlipLayer } from './motion';

/**
 * A number that counts to its value when it changes (or, the first time, from `from`). Its final text, drawn invisibly
 * underneath, reserves the width, so the words beside it never shift while it counts.
 */
export function CountNumber({ value, format, from, memo, className, duration, onLanded }: { value: number; format: (n: number) => string; from?: number | null; memo?: string; className?: string; duration?: number; onLanded?: () => void }) {
  const n = useCountUp(value, { from, memo, duration });
  // Once it has counted and reached its value it has "landed": the page can mark the moment (a thump).
  const counted = useRef(false);
  if (n !== value) counted.current = true;
  const landed = counted.current && n === value;
  const told = useRef(false);
  useEffect(() => { if (landed && !told.current) { told.current = true; onLanded?.(); } }, [landed, onLanded]);
  return (
    <span className={'countup' + (landed ? ' landed' : '') + (className ? ' ' + className : '')} data-final={format(value)} data-counting={n !== value ? '' : undefined}>
      <span className="countup-now">{format(n)}</span>
    </span>
  );
}

/** Mounted once inside the shell: rows in the work area slide to their new places when they're sorted or filtered. */
export function MotionLayer() {
  useFlipLayer();
  return null;
}
