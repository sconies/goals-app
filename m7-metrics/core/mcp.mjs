// A minimal tool door (added for stage 7: the core rebuild had no MCP server). One call: { tool, args } as a person.
// The core lists every module's tools, on or off (spec/core/tools.md: a switched-off module's tools are still listed);
// a call to an off module's tool answers the module-off sentence and changes nothing.
import { modulesIn, isOn, offSentence } from './modules.mjs';

export function listTools() {
  return modulesIn().flatMap((m) => Object.entries(m.tools || {}).map(([name, t]) => ({ name, module: m.id, kind: t.kind || 'reads', title: t.title || name })));
}
export function callTool(api, { tool, args = {} }) {
  for (const m of modulesIn()) {
    const t = (m.tools || {})[tool];
    if (!t) continue;
    if (!isOn(api.W, m.id)) return { isError: true, text: offSentence(api.W, m.id, tool, api.wsName) };
    try { return t.run(api, args); } catch (e) { return { isError: true, text: e.message }; }
  }
  return { isError: true, text: `There’s no tool called ${tool}.` };
}
