/* Where a record is in its life, not how it's doing: Stopped (a goal), Ended (a review), Left (a person), Removed.
   Like a status it's always a shape and a word together (design rules), but its shapes are its own, so a status shape
   still only ever means a status. */
import { ENDED, LEFT, REMOVED, STOPPED } from '../domain/vocabulary';

export type Life = 'stopped' | 'ended' | 'left' | 'removed';
const WORD: Record<Life, string> = { stopped: STOPPED, ended: ENDED, left: LEFT, removed: REMOVED };

/** The shape alone: a ring with a bar across (stopped), a square in it (ended), a slash (left), a cross (removed). Held to
    no number is a status of its own, Not measured yet (StatusShape; Lane, 14 Nov). */
export function LifeShape({ k }: { k: Life }) {
  return (
    <svg className="life-shape" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {k === 'stopped' && <path d="M4.6 8h6.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      {k === 'ended' && <rect x="5.6" y="5.6" width="4.8" height="4.8" rx="0.8" fill="currentColor" />}
      {k === 'left' && <path d="m5 11 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      {k === 'removed' && <path d="m5.6 5.6 4.8 4.8m0-4.8-4.8 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

/** The shape and its word: "Stopped". */
export function LifeMark({ k, className }: { k: Life; className?: string }) {
  return <span className={'life-mark' + (className ? ' ' + className : '')}><LifeShape k={k} />{WORD[k]}</span>;
}
