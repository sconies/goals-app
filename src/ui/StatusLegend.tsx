/* The one status legend. As a key, the shapes and their words (Help, the weekly history); in full, each status with what
   it means and the results, folded under the goals where they're listed. */
import { Fragment, type ReactNode } from 'react';
import { LABEL } from '../domain/status';
import { MEANING, RESULT_MEANING, RESULT_TEXT, SHORT_MEANING } from '../domain/story';
import type { DisplayStatus } from '../domain/types';
import { StatusWord } from './bits';

const LISTED = ['on', 'risk', 'off', 'stale'] as const;

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
        {(statuses ?? LISTED).map((k) => <StatusWord key={k} k={k} className="legend-key" wordClass="strong"><span className="muted">{SHORT_MEANING[k]}</span></StatusWord>)}
        <span className="linkish small legend-more">What these mean</span>
      </summary>
      <dl className="legend-full">
        {(statuses ?? LISTED).map((k) => <Fragment key={k}><dt className={'tone-' + k}>{LABEL[k]}</dt><dd>{MEANING[k]}</dd></Fragment>)}
        {(['completed', 'late', 'missed'] as const).map((k) => <Fragment key={k}><dt><span className={'result-tag result-' + k}>{RESULT_TEXT[k]}</span></dt><dd>{RESULT_MEANING[k]}</dd></Fragment>)}
        <dt>The call</dt><dd>The status is the owner’s call each week, checked against the numbers. A call greener than the numbers needs a reason, and is flagged.</dd>
      </dl>
    </details>
  );
}
