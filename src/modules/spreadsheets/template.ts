/* The template download (backlog IM1): Start here, the fill-in columns with the required ones in bold, and example rows
   that are never imported. One helper, so Help's columns article and Import save the same file under the same name,
   faro-template.xlsx. */
import { saveAndSay } from '../../app/files';
import type { AppState } from '../../app/state';
import { templateWorkbook } from '../../domain/export';

export function saveTemplate(app: Pick<AppState, 'toast' | 'ws' | 'cycle' | 'week' | 'today'>): Promise<boolean> {
  return saveAndSay(app.toast, { workspace: app.ws.name, what: 'template', date: app.today, as: 'faro-template' }, { kind: 'xlsx', sheets: templateWorkbook({ ws: app.ws, cycle: app.cycle, week: app.week, today: app.today }) }, 'Template saved');
}
