// The core's extension points (added for stage 10; CORE-CHANGES.md). A module is a folder in rebuild/modules with a
// module.mjs whose default export declares what it adds. The core asks on(W, id) before reaching any of it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../modules');
export const MODULES = [];
for (const name of fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []) {
  const file = path.join(dir, name, 'module.mjs');
  if (fs.existsSync(file)) MODULES.push((await import(pathToFileURL(file).href)).default);
}
/** A module is on unless the workspace's modulesOff holds its id. */
export const on = (W, id) => !(W.modulesOff || []).includes(id);
export const live = (W) => MODULES.filter((m) => on(W, m.id));
export const byId = (id) => MODULES.find((m) => m.id === id);
/** The switched-off sentences: a page (help-guide “Getting around”), an action (actions.md) and a tool (tools.md). */
export const offPage = (m, ws) => `${m.name} is switched off in ${ws}. An admin can switch it on in Workspace, Features.`;
export const offAction = (m, ws) => `${m.name} is switched off in ${ws}. An admin can switch it on in Workspace, under Features.`;
export const offTool = (m, ws, what) => `${m.name} is switched off in ${ws}, so ${what} can’t be used there. An admin can switch it on in Workspace, under Features.`;
/** Which module owns a Workspace section, a tool, a Help article. */
export const sectionOwner = (id) => MODULES.find((m) => (m.workspaceSections || []).some((s) => s.id === id));
export const toolOwner = (name) => MODULES.find((m) => (m.tools?.defs || []).some((t) => t.name === name));
export const helpOwner = (title) => MODULES.find((m) => (m.help || []).some((h) => h.title === title));
