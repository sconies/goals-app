// @vitest-environment node
/* Settings' "On this page" links only to the sections the page has (drill, 15 Nov: it linked to “Your MCP tokens”
   while AI access was off and the section wasn't there). Journey U175 checks the page itself. */
import { readFileSync } from 'node:fs';
import { settingsSections } from './Settings';

describe('Settings’ section links', () => {
  it('leave out Your MCP tokens while AI access is off, and keep it while on', () => {
    expect(settingsSections(false).map(([, l]) => l)).toEqual(['You', 'Appearance', 'Navigation', 'Recording', 'Motion lab', 'Leave']);
    expect(settingsSections(true).map(([, l]) => l)).toEqual(['You', 'Appearance', 'Navigation', 'Your MCP tokens', 'Recording', 'Motion lab', 'Leave']);
  });
  it('link to every section the page has (usability study, 17 Nov: Recording and Motion lab had no link)', () => {
    const page = readFileSync(new URL('./Settings.tsx', import.meta.url), 'utf8');
    const headings = [...page.matchAll(/className="block-title" id="([\w-]+)"/g)].map((m) => m[1]!);
    const linked = settingsSections(true).map(([id]) => id);
    expect(headings.length).toBeGreaterThan(4);
    expect(headings.filter((id) => !linked.includes(id))).toEqual([]);
  });
});
