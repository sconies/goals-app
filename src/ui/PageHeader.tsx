/* One page header (PAGE-HEADER; docs/design/patterns/spec.md section 2). PageHeader for list and detail pages: what sits
   above the title (a detail page's status line, an eyebrow), the h1 at the content's left edge, at most one filled button
   (and on a detail page one plain standing one) at the right of its first line, and one line under it. Below 700px it
   stacks: above, title, line, then the actions in one row. TaskHeader for focused tasks: the task's name and where you
   are at the left, the one exit at the right; on a phone, when both don't fit, the exit keeps the first line and the name
   goes under it. Find, Demo and your avatar are the shell's, never a header's (rule 2). Words: src/domain/pageHeader.ts. */
import type { ReactNode } from 'react';
import { FormClose } from './FormClose';

export function PageHeader({ title, above, line, actions, inListBar, children, className, part }: {
  /** The h1: the place's name on a list, the thing's own name on a detail page. */
  title: ReactNode;
  /** Above the title: a detail page's status and number line, an eyebrow ("Q4 · week 46"), a person's picture. */
  above?: ReactNode;
  /** The one line under the title: what's in scope on a list; who and where on a detail page. A string is a hint. */
  line?: ReactNode;
  /** At most one filled button; on a detail page one plain standing button and More after it (`headerButtons`). */
  actions?: ReactNode;
  /** A list page whose list bar also carries the action: below 700px the header leaves it out and the bar shows it at its
      end, so the first row stays near the top (Lane, 18 Nov; F15). */
  inListBar?: boolean;
  /** What else belongs to the header (a second hint), under the line. */
  children?: ReactNode;
  className?: string;
  /** The named part, for Help's pointers and the evals. */
  part?: string;
}) {
  return (
    <div className={'page-head page-header' + (inListBar ? ' ph-list' : '') + (className ? ' ' + className : '')} data-part={part}>
      {above ? <div className="ph-above">{above}</div> : null}
      <h1 className="title-xl ph-title">{title}</h1>
      {actions ? <div className="ph-actions">{actions}</div> : null}
      {line ? (typeof line === 'string' ? <span className="hint ph-line">{line}</span> : <div className="ph-line">{line}</div>) : null}
      {children ? <div className="ph-more">{children}</div> : null}
    </div>
  );
}

export function TaskHeader({ name, nameClass, title, steps, actions, close, className }: {
  /** The task's name and where you are, from `taskLine`: "Week 46 check-in · 2 of 7". */
  name?: ReactNode;
  /** A class for the name, for the evals and Help's pointers ("ci-week"). */
  nameClass?: string;
  /** A task with no steps may say its question here as the page's h1 (a review's set-up). */
  title?: ReactNode;
  /** A stepped form's step list. */
  steps?: ReactNode;
  /** Beside the exit: "Discard draft". */
  actions?: ReactNode;
  /** The one exit, worded by `closeWords`. */
  close: { keeps: boolean; dirty?: boolean; onClose: () => void };
  className?: string;
}) {
  return (
    <div className={'focus-top task-head' + (className ? ' ' + className : '')}>
      {title ? <h1 className="focus-title task-name">{title}</h1> : <span className={'small strong task-name' + (nameClass ? ' ' + nameClass : '')}>{name}</span>}
      {steps}
      <span className="row task-exit">
        {actions}
        <FormClose keeps={close.keeps} dirty={close.dirty} onClose={close.onClose} />
      </span>
    </div>
  );
}
