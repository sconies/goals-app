/* The template download (backlog IM1): Start here, the fill-in columns with the required ones in bold, and example rows
   that are never imported. One helper, so Help's columns article, Import and Data's Spreadsheets menu save the same file
   under the same name. */
import { saveAndSay } from '../../app/files';
import type { AppState } from '../../app/state';
import { templateWorkbook } from '../../domain/export';

export function saveTemplate(app: Pick<AppState, 'toast' | 'ws' | 'cycle' | 'week' | 'today'>): Promise<boolean> {
  return saveAndSay(app.toast, { workspace: app.ws.name, what: 'template', date: app.today }, { kind: 'xlsx', sheets: templateWorkbook({ ws: app.ws, cycle: app.cycle, week: app.week, today: app.today }) }, 'Template saved');
}
