/* One page header (PAGE-HEADER; docs/design/patterns/spec.md section 2). Pure words and choices, no screen code: what kind
   of page an address is, what a focused task's header says at its left, which of a header's buttons stay in it, and what
   the phone's top bar names. The screens draw them with PageHeader and TaskHeader (src/ui/PageHeader.tsx). */
import { isForm } from './navigation';

/** The three kinds of page (2.1): a list, one thing's own page, and a focused task (a form, drawn in focus mode). */
export type PageKind = 'list' | 'detail' | 'task';

/** One thing's own page: a goal, a person, a team, a metric, a review, a past import, a Help article. */
const DETAIL = /^\/(goals|people|teams|reviews|metrics|help)\/[^/]+(\/(print|summary))?$|^\/data\/imports\/[^/]+$/;

/** The kind of page at an address. A form is a task whatever its path (`forms`: the modules' focus pages). */
export function pageKind(path: string, search = '', forms: readonly string[] = []): PageKind {
  const [p = ''] = path.split('?');
  if (isForm(path, search, forms)) return 'task';
  return DETAIL.test(p) && !/^\/goals\/(new|views)$|^\/metrics\/baselines$/.test(p) ? 'detail' : 'list';
}

/**
 * The left of a focused task's header (2.4): the task's name and, when there is more than one, where you are in it:
 * "Week 46 check-in · 2 of 7". One of one, or no count, is the name alone.
 */
export function taskLine(name: string, at?: number, of?: number): string {
  return at != null && of != null && of > 1 ? `${name} · ${Math.min(Math.max(at, 1), of)} of ${of}` : name;
}

/** A button a header could hold: filled (the primary), or a plain standing one ("Check in again", "Watch"). */
export interface HeaderButton { label: string; filled?: boolean }

/**
 * Rule 4. What a header shows and what goes into its "More": a list page keeps one filled button; a detail page one filled
 * and one plain standing button; a focused task none (its primary is the footer's). Earlier ones win; the rest are More's.
 */
export function headerButtons(kind: PageKind, buttons: readonly HeaderButton[]): { shown: HeaderButton[]; more: HeaderButton[] } {
  const shown: HeaderButton[] = [];
  const more: HeaderButton[] = [];
  let filled = false;
  let plain = false;
  for (const b of buttons) {
    const keep = kind !== 'task' && (b.filled ? !filled : kind === 'detail' && !plain);
    if (keep && b.filled) filled = true;
    else if (keep) plain = true;
    (keep ? shown : more).push(b);
  }
  return { shown, more };
}

/** Rule 2. The app's utilities: they live in the shell (the sidebar, the phone's top bar), never in a page's header. */
export const SHELL_UTILITIES = ['Find', 'Demo', 'You'] as const;

/**
 * Rule 8. What the phone's top bar names: the workspace while the page's title is in view, so the page's name isn't said
 * twice on one screen; the page's name once the title has scrolled away (or a page has none on a phone). A focused task
 * has no top bar.
 */
/**
 * Rule 8's exception: the pages whose title is for screen readers only on a phone (Goals and Watching, whose list starts
 * at once). Their title is never in view there, so the top bar names them from the start.
 */
export function phoneTitleShown(path: string): boolean {
  const [p = ''] = path.split('?');
  return !/^\/(goals|watching)\/?$/.test(p);
}

export function topBarSays(kind: PageKind, page: string, workspace: string, titleInView: boolean): string | null {
  if (kind === 'task') return null;
  return titleInView ? workspace : page;
}
