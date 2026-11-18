/* What is left to fix, in a form's status line (FORM-FOOTER; patterns spec 3.3). Pressing the primary with something
   missing shows the errors and moves focus to the first field in error, scrolled into view below any sticky header;
   with two or more, the status line names them, each a link to its field. */
import { Fragment, type RefObject } from 'react';
import { fixCount, fixSummary } from '../domain/formFooter';

const FOCUSABLE = 'input, textarea, select, button, [tabindex]';

/** Focus `el` (or the first control inside it) and bring it to the middle of the window, clear of the sticky parts. */
export function focusEl(el: HTMLElement | null | undefined): boolean {
  if (!el) return false;
  const target = el.matches(FOCUSABLE) ? el : el.querySelector<HTMLElement>(FOCUSABLE) ?? el;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'center' });
  return true;
}

/** Focus the field marked `data-field="{field}"`, else the first field marked in error. */
export const focusField = (root: HTMLElement | null | undefined, field: string): boolean =>
  focusEl(root?.querySelector<HTMLElement>(`[data-field="${field}"]`) ?? root?.querySelector<HTMLElement>('[aria-invalid="true"]'));

/** Focus the first field in error in `root`. */
export const focusFirstError = (root: HTMLElement | null | undefined): boolean =>
  focusEl(root?.querySelector<HTMLElement>('[aria-invalid="true"], .level-alert'));

export type FixItem = { label: string; field: string };

/** "2 things to fix: Target, Owner", each name a link to its field; nothing when it wouldn't help. */
export function FixSummary({ items, root, oneInView = true }: { items: FixItem[]; root: RefObject<HTMLElement | null>; oneInView?: boolean }) {
  if (!fixSummary(items.map((i) => i.label), oneInView)) return null;
  return (
    <span className="fix-summary">
      {fixCount(items.length)}{' '}
      {items.map((it, i) => (
        <Fragment key={it.field}>{i ? ', ' : ''}<button type="button" className="linkish" onClick={() => focusField(root.current, it.field)}>{it.label}</button></Fragment>
      ))}
    </span>
  );
}
