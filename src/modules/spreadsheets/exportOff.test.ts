// @vitest-environment node
/* Fix item F2: a module switched off in a workspace adds no sheet to its exports, at every door: the workbook (Export,
   Import's "Export everything", the preview's "Nothing would change"), the zipped CSVs, and the MCP export tool. */
import { serve, type Deps } from '../../../server/mcp';
import { exportOn, MODULE_RECORDS, MODULE_SHEETS, sheetsOn } from '../../core/records';
import { MODULES } from '../../core/registry';
import { REVIEWS_COLUMN, REVIEWS_SHEET } from '../../domain/columns';
import { buildPlatformOrg } from '../../data/platformOrg';
import { sheetNamed, workbook } from '../../domain/export';
import type { ApiToken, Snapshot } from '../../domain/types';
import { hashToken, newToken } from '../../mcp/protocol';

const MODULE_IDS = MODULES.map((m) => m.id);
const today = new Date('2026-11-02T12:00:00Z');
const built = buildPlatformOrg(today);
// The first module in this build that adds a sheet (the metric library's Metrics); none in a build without one.
const owner = MODULE_RECORDS.find((m) => m.sheets?.length);
const sheet = owner?.sheets?.[0];
const csvFormat = sheet ? `${sheet.spec.name.toLowerCase().replace(/[^a-z]+/g, '_')}_csv` : '';

async function call(modulesOff: string[], name: string, args: object) {
  const token = newToken();
  const t: ApiToken = { id: 'tok1', personId: 'grace', name: 'Test', tokenHash: await hashToken(token), createdBy: 'grace', createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null };
  const data: Snapshot = structuredClone(built);
  const deps: Deps = {
    findToken: async (h) => (h === t.tokenHash ? { token: t, workspaceId: 'platform-org' } : null),
    workspaceName: async () => 'Platform Engineering',
    modulesOff: async () => modulesOff,
    load: async () => data,
    commit: async () => undefined,
    touch: async () => undefined,
    now: () => today,
  };
  const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) }), deps);
  return (await res.json()).result as { content: { text: string }[]; isError: boolean };
}

describe.skipIf(!owner)('a switched-off module’s sheet leaves every export (F2)', () => {
  const ws = (off: string[]) => ({ id: 'platform-org', name: 'Platform Engineering', modulesOff: off });
  const names = (off: string[]) => workbook({ ws: ws(off), snapshot: built, cycle: built.cycles[0]!, week: 10, today, sheets: sheetsOn(ws(off)) }).map((x) => x.name);

  it('sheetsOn gives every module sheet while on, and none of a module that is off', () => {
    expect(sheetsOn(ws([]))).toEqual(MODULE_SHEETS);
    expect(sheetsOn(ws([owner!.module]))).not.toContain(sheet);
    expect(sheetsOn(null)).toEqual(MODULE_SHEETS);
  });

  it('the workbook has the sheet while the module is on, and not once it is off', () => {
    expect(names([])).toContain(sheet!.spec.name);
    expect(names([owner!.module])).not.toContain(sheet!.spec.name);
    // Its columns are gone from Start here's field table too.
    const start = workbook({ ws: ws([owner!.module]), snapshot: built, cycle: built.cycles[0]!, week: 10, today, sheets: sheetsOn(ws([owner!.module])) })[0]!;
    expect(start.rows.some((r) => r.includes(sheet!.spec.name))).toBe(false);
  });

  it('the MCP export tool gives the sheet while on, and says it is switched off once off', async () => {
    const on = await call([], 'export', { format: csvFormat });
    expect(on.isError).toBe(false);
    expect(on.content[0]!.text.split('\n')[0]).toContain(sheet!.spec.columns[0]!.header);
    const off = await call([owner!.module], 'export', { format: csvFormat });
    expect(off.isError).toBe(true);
    expect(off.content[0]!.text).toMatch(/switched off in Platform Engineering/);
    // The JSON and the core's sheets are unchanged.
    expect((await call([owner!.module], 'export', { format: 'goals_csv' })).isError).toBe(false);
  });
});

describe('with Reviews switched off, every export leaves out the Notes sheet and the Review column (RS1, Reviews switch spec 5)', () => {
  const ws = (off: string[]) => ({ id: 'platform-org', name: 'Platform Engineering', modulesOff: off });
  const book = (off: string[]) => workbook({ ws: ws(off), snapshot: built, cycle: built.cycles[0]!, week: 10, today, ...exportOn(ws(off)) });

  it('exportOn carries the sheets and Reviews, from the one switch', () => {
    expect(exportOn(ws([]))).toEqual({ sheets: MODULE_SHEETS, goalColumns: MODULE_RECORDS.flatMap((m) => (m.goalSheet ? [m.goalSheet] : [])), reviews: MODULE_IDS.includes('reviews') });
    // A module's Goals columns (Fields') go with its switch, as its sheets do.
    if (MODULE_IDS.includes('tags')) expect(exportOn(ws(['tags'])).goalColumns).toEqual([]);
    expect(exportOn(ws(['reviews'])).reviews).toBe(false);
  });

  it.skipIf(!MODULE_IDS.includes('reviews'))('the workbook has Notes and a Review column while on, and neither once off', () => {
    const on = book([]), off = book(['reviews']);
    expect(on.map((x) => x.name)).toContain(REVIEWS_SHEET);
    expect(off.map((x) => x.name)).not.toContain(REVIEWS_SHEET);
    expect(sheetNamed(on, 'Asks').rows[0]).toContain(REVIEWS_COLUMN);
    expect(sheetNamed(off, 'Asks').rows[0]).not.toContain(REVIEWS_COLUMN);
  });

  it.skipIf(!MODULE_IDS.includes('reviews'))('the MCP export tool says the Notes sheet is switched off, and still gives Asks', async () => {
    const off = await call(['reviews'], 'export', { format: 'notes_csv' });
    expect(off.isError).toBe(true);
    expect(off.content[0]!.text).toMatch(/Notes sheet’s module is switched off in Platform Engineering/);
    const asks = await call(['reviews'], 'export', { format: 'asks_csv' });
    expect(asks.isError).toBe(false);
    expect(asks.content[0]!.text.split('\n')[0]).not.toContain(REVIEWS_COLUMN);
  });
});
