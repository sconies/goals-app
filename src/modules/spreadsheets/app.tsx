/* The spreadsheets module on screen (src/core/app.tsx): Import at /data/import, the Spreadsheets menu on Data,
   Goals' quiet "Export these goals", and the field table in Help's columns article. Its facts are in module.json. */
import { lazy, Suspense, type ComponentType } from 'react';
import type { AppModule, PlaceProps } from '../../core/app';
import { ExportTheseGoals } from './ExportButton';

/* Import and the Data menu carry the reader, the writer and the column rules: they load when first shown, not on a first
   visit (the bundle budget, scripts/check-bundle.mjs). "Export these goals" is drawn with Goals, so nothing above the
   goals moves when it arrives; its sheet loads when opened (ExportButton.tsx). */
const Import = lazy(() => import('./Import').then((m) => ({ default: m.Import })));
function later<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  const Lazy = lazy(() => load().then((c) => ({ default: c as ComponentType<object> })));
  return (props: P) => <Suspense fallback={null}><Lazy {...props} /></Suspense>;
}
const DataMenu = later<PlaceProps['data.tools']>(() => import('./DataMenu').then((m) => m.DataMenu as ComponentType<PlaceProps['data.tools']>));

// The field table is read in one Help article only: it loads when that article opens, not on a first visit.
const FieldTable = lazy(() => import('./ColumnsHelp').then((m) => ({ default: m.ColumnsHelp })));
const ColumnsHelp = (p: PlaceProps['help.article']) => (p.article === 'columns' ? <Suspense fallback={null}><FieldTable {...p} /></Suspense> : null);

const spreadsheets: AppModule = {
  routes: [{ path: '/data/import', element: <Import />, focus: true, title: 'Import' }],
  places: {
    'data.tools': DataMenu,
    'goals.tools': ExportTheseGoals,
    'help.article': ColumnsHelp,
  },
};

export default spreadsheets;
