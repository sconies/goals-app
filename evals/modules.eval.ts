/* Spec scenarios for feature modules (backlog item 0, docs/architecture.md).
   MODULES: the layers hold (the rules layer imports only itself; the core imports no module), every folder in
     src/modules is a module the registry has, a workspace's switch turns a module and what needs it off, and a module's
     AI tool refuses in a workspace that has it off.
   SPREADSHEETS-ON-DATA: the blank template is the workbook's sheets with their headers and no rows, and the AI's
     export tools are the spreadsheets module's. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveModules } from '../src/core/module';
import { isModuleOn, MODULES } from '../src/core/registry';
import { leftOut } from '../src/core/sources';
import { buildPlatformOrg } from '../src/data/platformOrg';
import { currentCycle, scopeToCycle } from '../src/domain/cycle';
import { templateWorkbook, workbook } from '../src/domain/export';
import { currentWeek } from '../src/domain/plan';
import { callTool, type McpContext } from '../src/mcp/tools';
// @ts-expect-error: a plain JavaScript script, run by CI with node, has no type declarations.
import { checkLayers } from '../scripts/check-layers.mjs';

const root = path.join(__dirname, '..');
const today = new Date('2026-11-05T12:00:00Z');
/** Built without the spreadsheets module (FARO_WITHOUT): its scenarios skip. */
const noSheets = !isModuleOn(null, 'spreadsheets');

async function context(modulesOff?: string[]): Promise<McpContext> {
  const all = await buildPlatformOrg(today);
  const cycle = currentCycle(all.cycles, today)!;
  return {
    ws: { id: 'platform-org', name: 'Platform', ...(modulesOff ? { modulesOff } : {}) }, snapshot: scopeToCycle(all, cycle), cycle, week: currentWeek(cycle, today), today,
    actor: all.people.find((p) => p.admin)!, now: today.toISOString(), newId: (p) => `${p}_x`, save: async () => {}, issueToken: async () => 'x',
  };
}

describe('Feature modules', () => {
  it('[MODULES] keep the layers: the rules layer imports only itself, and the core imports no module', () => {
    expect((checkLayers as (r: string) => string[])(root)).toEqual([]);
  });

  it('[MODULES] has every folder in src/modules in the registry, each with a module.json', () => {
    const folders = fs.readdirSync(path.join(root, 'src/modules'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    expect(MODULES.map((m) => m.id)).toEqual(folders.filter((f) => !leftOut(root).modules.has(f)));
    for (const id of folders) expect(fs.existsSync(path.join(root, 'src/modules', id, 'module.json')), id).toBe(true);
  });

  it('[MODULES] switches a module off with everything that needs it', () => {
    const r = resolveModules([{ id: 'asks', needs: [] }, { id: 'reviews', needs: ['asks'] }], ['asks']);
    expect([...r.on]).toEqual([]);
    expect(resolveModules(MODULES, ['spreadsheets']).on.has('spreadsheets')).toBe(false);
  });

  it.skipIf(noSheets)('[MODULES] refuses a switched-off module’s AI tool, and runs it when it’s on', async () => {
    const off = await callTool('export', { format: 'goals_csv' }, await context(['spreadsheets']));
    expect(off.isError).toBe(true);
    expect(off.text).toMatch(/Spreadsheets is switched off in Platform/);
    const on = await callTool('export', { format: 'goals_csv' }, await context());
    expect(on.isError).toBeFalsy();
    expect(on.text.split('\n')[0]).toMatch(/Key/);
  });

  it('[SPREADSHEETS-ON-DATA] [FIELD-TABLE] makes the template: Start here, then Goals, Plan, Check-ins and People with only the columns a person fills in, required headers in bold, and example rows', async () => {
    const x = await context();
    const input = { ws: x.ws, snapshot: x.snapshot, cycle: x.cycle, week: x.week, today };
    const full = workbook(input);
    const book = templateWorkbook(input);
    expect(book.map((t) => t.name)).toEqual(['Start here', 'Goals', 'Plan', 'Check-ins', 'People']);
    for (const t of book.slice(1)) {
      const head = t.rows[0]!.map(String);
      // The workbook's own headers, worked-out and for-reading columns left out.
      expect(head.every((h) => full.find((f) => f.name === t.name)!.rows[0]!.includes(h)), t.name).toBe(true);
      expect(head.some((h) => ['Status', 'Calculated', 'Posted at'].includes(h)), t.name).toBe(false);
    }
    expect(book.find((t) => t.name === 'Goals')!.bold).toEqual(['Goal', 'Owner', 'Owner email']);
    expect(book.find((t) => t.name === 'People')!.bold).toEqual(['Email', 'Name']);
    expect(book.find((t) => t.name === 'Goals')!.rows).toHaveLength(3);
    expect(book.find((t) => t.name === 'People')!.rows).toHaveLength(2);
    expect(book[0]!.rows.length).toBeGreaterThan(40);
  });

  it.skipIf(noSheets)('[SPREADSHEETS-ON-DATA] has the AI’s export tools in the spreadsheets module', () => {
    expect(MODULES.find((m) => m.id === 'spreadsheets')?.aiTools).toEqual(['export', 'export_table']);
  });
});
