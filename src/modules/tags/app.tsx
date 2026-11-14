/* Fields on screen (TG1): its Workspace section, /workspace/fields, and a goal's Fields block in About (the goal.sections
   place). Both load when first shown, never with the first download (scripts/check-bundle.mjs). With Fields switched
   off neither is drawn, and /workspace/fields is Page not found saying Fields is switched off. Its facts are in
   module.json. The filters, Data's column and the sheet's columns are TG2's. */
import { lazy, Suspense, type ComponentType } from 'react';
import { useApp } from '../../app/state';
import type { AppModule, PlaceProps } from '../../core/app';
import { moduleRows, type ModuleRows } from '../../domain/records';

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
};

export default tags;
