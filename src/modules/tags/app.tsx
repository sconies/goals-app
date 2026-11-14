/* Fields on screen (TG1): its Workspace section, /workspace/fields, and a goal's Fields block in About (the goal.sections
   place). Both load when first shown, never with the first download (scripts/check-bundle.mjs). With Fields switched
   off neither is drawn, and /workspace/fields is Page not found saying Fields is switched off. Its facts are in
   module.json. Goals' filters are below; Data's column and the sheet's columns are records.ts's (TG2). */
import { lazy, Suspense, type ComponentType } from 'react';
import { useApp } from '../../app/state';
import type { AppModule, ModuleFilterFamily, PlaceProps } from '../../core/app';
import { moduleRows, type ModuleRows } from '../../domain/records';
import { filterParam, NOT_SET, pickedOf, pickedText } from './filter';
import RECORDS from './records';

const LazySection = lazy(() => import('./FieldsSection').then((m) => ({ default: m.FieldsSection })));
const LazyBlock = lazy(() => import('./FieldsBlock').then((m) => ({ default: m.FieldsBlock as ComponentType<PlaceProps['goal.sections']> })));
/** How many live fields a workspace has, read here without the module's rules (fields.ts), which load with its screens. */
const liveCount = (s: { modules?: ModuleRows }) => moduleRows<{ retiredAt?: string | null }>(s, 'tags', 'fields').filter((f) => !f.retiredAt).length;
// Nothing to load while the workspace has no live field: the block would draw nothing.
function FieldsBlock(props: PlaceProps['goal.sections']) {
  const app = useApp();
  return liveCount(app.full ?? app.snapshot) ? <Suspense fallback={null}><LazyBlock {...props} /></Suspense> : null;
}

const n = (k: number) => (k === 1 ? '1 field' : `${k} fields`);

/* Goals' filters (TG2): a row per live list field in the Filters sheet, "Stage is Build or Run" on the filter line, and
   the address `?f.<field id>=Build,Run`, which a saved view keeps. The columns are records.ts's, so find_goals matches
   alike. Free text isn't a filter (Lane, 2a). */
type Field = { id: string; name: string; kind: string; options: string[]; position: number; retiredAt?: string | null };
const listFields = (s: { modules?: ModuleRows }) => moduleRows<Field>(s, 'tags', 'fields').filter((f) => !f.retiredAt && f.kind === 'list').sort((a, b) => a.position - b.position);
const fieldOf = (s: { modules?: ModuleRows }, param: string) => listFields(s).find((f) => filterParam(f.id) === param) ?? null;
const or = (v: string[]) => (v.length > 1 ? `${v.slice(0, -1).join(', ')} or ${v[v.length - 1]}` : v[0] ?? '');

const fieldFilters: ModuleFilterFamily = {
  list: 'goals', id: 'fields', family: RECORDS.goalColumnFamilies![0]!,
  rows: (s) => listFields(s).map((f) => ({ param: filterParam(f.id), label: f.name, options: [...f.options, NOT_SET] })),
  picked: (s, param, text) => { const f = fieldOf(s, param); return f ? pickedOf(f, text) : []; },
  text: (s, param, picked) => { const f = fieldOf(s, param); return f ? pickedText(f, picked) : ''; },
  says: (s, param, text) => { const f = fieldOf(s, param); const p = f ? pickedOf(f, text) : []; return f && p.length ? { label: `${f.name} is`, value: or(p) } : null; },
};

const tags: AppModule = {
  sections: [{
    id: 'fields',
    label: 'Fields',
    summary: 'The workspace’s own fields on goals, such as a stage or a programme. Admins add and change them.',
    after: 'features',
    element: <Suspense fallback={null}><LazySection /></Suspense>,
    says: (app) => { const live = liveCount(app.full ?? app.snapshot); return live ? n(live) : 'No fields yet'; },
  }],
  places: { 'goal.sections': FieldsBlock },
  filterFamilies: [fieldFilters],
};

export default tags;
