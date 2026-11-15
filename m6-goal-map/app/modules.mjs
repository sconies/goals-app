// The core's extension points (added for stage 6: the core rebuild had none).
// A module registers itself here; the core asks `isOn` and draws what each module adds.
//
// A module is { id, name, group, about, layouts?, help?, assets?, offSentence? }
//   layouts: [{ id, label, about, offNotice, render(ctx, q) -> html }]   Goals' Layout menu
//   help:    [{ title, id }]   Help-guide articles (### headings) that are the module's
//   assets:  { '<file>': '<absolute path>' }   served at /modules/<id>/<file>
import path from 'node:path';

export const MODULES = [];
export function register(m) {
  if (MODULES.some((x) => x.id === m.id)) return;
  MODULES.push(m);
}
export const moduleById = (id) => MODULES.find((m) => m.id === id);

// Workspace.modulesOff (data model): ids switched off here; everything else is on.
export const isOn = (W, id) => !(W.modulesOff || []).includes(id);
export function setOn(W, id, on) {
  const off = new Set(W.modulesOff || []);
  if (on) off.delete(id); else off.add(id);
  W.modulesOff = [...off];
}

// The sentences every switched-off module uses (spec: stages 4, 5, 8, 11, 12 pages).
export const offPage = (name, ws) => `${name} is switched off in ${ws}. An admin can switch it on in Workspace, Features.`;
export const offAction = (name, ws) => `${name} is off in ${ws}.`;
export const offTool = (name, ws, tool) => `${name} is switched off in ${ws}, so ${tool} can’t be used there. An admin can switch it on in Workspace, under Features.`;

// Goals' layouts: the core's four, then each module's that is on.
export function layoutsFor(W) {
  return MODULES.filter((m) => isOn(W, m.id)).flatMap((m) => (m.layouts || []).map((l) => ({ ...l, module: m })));
}
// A layout asked for by a link, a saved view or a remembered choice that a switched-off module owns.
export function offLayout(W, view) {
  for (const m of MODULES) for (const l of m.layouts || []) if (l.id === view && !isOn(W, m.id)) return { ...l, module: m };
  return null;
}
// Help articles a switched-off module owns are hidden.
export function hiddenHelp(W) {
  const out = new Set();
  for (const m of MODULES) if (!isOn(W, m.id)) for (const h of m.help || []) out.add(h.title);
  return out;
}
export function helpSlugs() {
  const o = {};
  for (const m of MODULES) for (const h of m.help || []) o[h.title] = h.id;
  return o;
}
export function assetPath(id, file) {
  const m = moduleById(id);
  if (!m || !m.assets) return null;
  const p = m.assets[path.basename(file)];
  return p || null;
}

// Installed modules (this rebuild): each one's folder registers itself.
export async function loadInstalled() {
  await import('../modules/index.mjs');
}
