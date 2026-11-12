/* The spreadsheets module on screen (src/core/app.tsx): Import at /data/import, the Spreadsheets menu on Data,
   Goals' quiet "Export these goals", and the field table in Help's columns article. Its facts are in module.json. */
import { lazy, Suspense, type ComponentType } from 'react';
import type { AppModule, PlaceProps } from '../../core/app';
import { DataMenu } from './DataMenu';
import { ExportTheseGoals } from './Export';

// The field table is read in one Help article only: it loads when that article opens, not on a first visit.
const FieldTable = lazy(() => import('./ColumnsHelp').then((m) => ({ default: m.ColumnsHelp })));
const ColumnsHelp = (p: PlaceProps['help.article']) => (p.article === 'columns' ? <Suspense fallback={null}><FieldTable {...p} /></Suspense> : null);

// Import, its preview and its changes load when opened (the bundle budget, scripts/check-bundle.mjs).
const LazyImport = lazy(() => import('./Import').then((m) => ({ default: m.Import })));
const LazyCheck = lazy(() => import('./Check').then((m) => ({ default: m.Check })));
const LazyChanges = lazy(() => import('./Changes').then((m) => ({ default: m.Changes })));
const later = (C: ComponentType) => <Suspense fallback={null}><C /></Suspense>;

const spreadsheets: AppModule = {
  routes: [
    { path: '/data/import', element: later(LazyImport), focus: true, title: 'Import' },
    { path: '/data/import/check', element: later(LazyCheck), focus: true, title: 'Check this import' },
    { path: '/data/import/check/changes', element: later(LazyChanges), focus: true, title: 'The changes' },
  ],
  places: {
    'data.tools': DataMenu,
    'goals.tools': ExportTheseGoals,
    'help.article': ColumnsHelp,
  },
};

export default spreadsheets;
