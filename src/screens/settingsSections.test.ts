// @vitest-environment node
/* Settings' "On this page" links only to the sections the page has (drill, 15 Nov: it linked to “Your MCP tokens”
   while AI access was off and the section wasn't there). Journey U175 checks the page itself. */
import { settingsSections } from './Settings';

describe('Settings’ section links', () => {
  it('leave out Your MCP tokens while AI access is off, and keep it while on', () => {
    expect(settingsSections(false).map(([, l]) => l)).toEqual(['You', 'Appearance', 'Navigation', 'Leave']);
    expect(settingsSections(true).map(([, l]) => l)).toEqual(['You', 'Appearance', 'Navigation', 'Your MCP tokens', 'Leave']);
  });
});
