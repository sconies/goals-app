/* Saved views: what a view is made of and the views a person sees. Apart from GoalFilters, so the shell and the back
   link, in the first download, needn't load the Goals screen's filters to name a view. */
import { isTableView } from '../domain/tableLayout';
import { movedGoals } from '../domain/goalsPage';
import { useApp } from '../app/state';
import { QUERY_KEYS } from '../domain/query';
import type { SavedView } from '../domain/types';

/** The params a view is made of: which goals and how they're grouped (show), the layout (view), and the query. */
const VIEW_KEYS = ['scope', 'group', 'show', 'view', 'weeks', 'hist', ...QUERY_KEYS];
// view=list is the list said out loud (GoalViews' useLayout), the same view as no layout at all.
export const viewParams = (p: URLSearchParams) => new URLSearchParams([...p].filter(([k, v]) => VIEW_KEYS.includes(k) && !(k === 'view' && v === 'list')).sort(([a], [b]) => VIEW_KEYS.indexOf(a) - VIEW_KEYS.indexOf(b))).toString();

/** The views this person sees: their own and the ones an admin pinned for everyone. Data's saved layouts are kept apart. */
export function useViews(): SavedView[] {
  const app = useApp();
  // A view saved in the Cards layout is the same view in List (Lane, 9 Nov): opening it says so once (GoalsScreen).
  // A view saved in the old form (show=…, no scope) is read in the new one (goals spec, rule 6); the record isn't rewritten.
  const fresh = (params: string) => viewParams(new URLSearchParams(movedGoals(params, 'all', () => true)?.search ?? params));
  return (app.snapshot.views ?? []).filter((v) => !v.deletedAt && !isTableView(v) && (v.pinned || v.personId === app.viewer.id))
    .map((v) => (new URLSearchParams(v.params).get('view') === 'cards' ? { ...v, params: fresh(viewParams(new URLSearchParams([...new URLSearchParams(v.params)].filter(([k]) => k !== 'view')))) } : { ...v, params: fresh(v.params) })).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.createdAt.localeCompare(b.createdAt));
}
