/* The spreadsheets module on screen (src/core/app.tsx): Import at /data/import, the Spreadsheets menu on Data,
   Goals' quiet "Export these goals", and the field table in Help's columns article. Its facts are in module.json. */
import { lazy, Suspense } from 'react';
import type { AppModule, PlaceProps } from '../../core/app';
import { DataMenu } from './DataMenu';
import { ExportTheseGoals } from './Export';
import { Import } from './Import';

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
