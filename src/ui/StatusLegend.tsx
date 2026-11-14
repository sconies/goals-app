/* The one status legend. As a key, the shapes and their words (Help, the weekly history); in full, each status with what
   it means and the results, folded under the goals where they're listed. Every word and meaning is the vocabulary's
   (domain/vocabulary.ts): the legend is generated from it, never written here. */
import { Fragment, type ReactNode } from 'react';
import type { DisplayStatus } from '../domain/types';
import { FLAG, lower, RESULT, STATUS } from '../domain/vocabulary';
import { StatusWord } from './bits';

/** The statuses the legend lists, in order. */
export const LISTED = ['on', 'risk', 'off', 'stale'] as const;
const RESULTS = ['completed', 'late', 'missed'] as const;

export function StatusLegend({ kind = 'full', statuses, className, itemClass, wordClass, label = 'Key', extra }: {
  /** `full`: what each status means, always in view where goals are listed. `key`: the shapes and their words. */
  kind?: 'full' | 'key';
  /** The statuses a key shows, in order. */
  statuses?: readonly DisplayStatus[];
  className?: string;
  /** The class of each item in a key. */
  itemClass?: string;
  /** The class of each word in a key. */
  wordClass?: string;
  label?: string;
  /** Anything after the statuses in a key, as list items (such as "No check-in"). */
  extra?: ReactNode;
}) {
  if (kind === 'key') {
    return (
      <ul className={'status-key' + (className ? ' ' + className : '')} aria-label={label}>
        {(statuses ?? LISTED).map((k) => <StatusWord key={k} as="li" k={k} className={itemClass} wordClass={wordClass} />)}
        {extra}
      </ul>
    );
  }
  return (
    <details className="legend">
      <summary>
        {(statuses ?? LISTED).map((k) => <StatusWord key={k} k={k} className="legend-key" wordClass="strong"><span className="muted">{STATUS[k].short}</span></StatusWord>)}
        <span className="linkish small legend-more">What these mean</span>
      </summary>
      <dl className="legend-full">
        {(statuses ?? LISTED).map((k) => <Fragment key={k}><dt className={'tone-' + k}>{STATUS[k].label}</dt><dd>{STATUS[k].long}</dd></Fragment>)}
        {RESULTS.map((k) => <Fragment key={k}><dt><span className={'result-tag result-' + k}>{RESULT[k].label}</span></dt><dd>{RESULT[k].long}</dd></Fragment>)}
        <dt>The call</dt><dd>The status is the owner’s call each week, checked against the numbers. A call {lower(FLAG.greener)} needs a reason, and is flagged.</dd>
      </dl>
    </details>
  );
}
