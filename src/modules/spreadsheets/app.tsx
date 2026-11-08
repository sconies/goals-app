/* The spreadsheets module on screen (src/core/app.tsx): Import at /data/import, the Spreadsheets menu on Data, and
   Goals' quiet "Export these goals". Its facts are in module.json. */
import type { AppModule } from '../../core/app';
import { DataMenu } from './DataMenu';
import { ExportTheseGoals } from './Export';
import { Import } from './Import';

const spreadsheets: AppModule = {
  routes: [{ path: '/data/import', element: <Import />, focus: true, title: 'Import' }],
  places: {
    'data.tools': DataMenu,
    'goals.tools': ExportTheseGoals,
  },
};

export default spreadsheets;
