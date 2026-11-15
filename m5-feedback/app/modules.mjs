// The core's extension points for feature modules (added for stage 5; see modules/feedback/CORE-CHANGES.md).
// A module is a folder rebuild/modules/<id>/ whose index.mjs exports `register(core)` and returns:
//   { id, name, what, group,                       Features: its row and the group it sits in
//     menu: 'feedback' | null,                      the menu item it owns (the core's menuGroups already places it)
//     owns(P) -> bool,                              the addresses that are its own (off: Page not found + the off sentence)
//     get(ctx, req, res, url, P) -> bool,           its GET routes (true when handled)
//     post(ctx, req, res, url, P) -> bool,          its POST routes (it reads its own body)
//     tools: [{ name, title, changes, inputSchema, call(ctx, args) }],
//     help: { '<article title>': '<id>' },          its Help articles, hidden while off
//     script(ctx) -> string,                        JS the shell adds to every page while it is on
//     badge(ctx) -> string,                         plain text beside its menu row
//     holds(ctx) -> string,                         Features' third line while on
//     importNotes(file) -> string[] }               what the import did not read while it is off
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const GROUPS = ['Working together', 'Tools', 'Beyond this workspace'];

export const isOn = (W, id) => !(W.modulesOff || []).includes(id);
export const offPageSentence = (name, ws) => `${name} is switched off in ${ws}. An admin can switch it on in Workspace, Features.`;
export const offToolSentence = (name, ws, tool) => `${name} is switched off in ${ws}, so ${tool} can’t be used there. An admin can switch it on in Workspace, under Features.`;

export async function loadModules(core) {
  const dir = path.join(here, '../modules');
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const id of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, id, 'index.mjs');
    if (!fs.existsSync(file)) continue;
    const mod = await import(pathToFileURL(file).href);
    out.push(mod.register(core));
  }
  return out;
}
