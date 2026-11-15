// The core's extension points (added for stage 7: the core rebuild of stages 1-3 had none; see
// modules/metrics/CORE-CHANGES.md). A module registers one declaration; the core asks the registry, never the module.
//
//   { id, name, records: [{ name, table, under, removable }], nav: { id, label, href, after },
//     routes(ctx, req, res, P, url, helpers) -> true when handled, oldAddresses(url) -> new address or null,
//     places: { 'goal.facts': fn, 'goal.sections': fn, 'people.person': fn, 'people.team': fn, 'checkin.number': fn, ... },
//     tools: { name: { kind, run(api, args) } }, homeCards(ctx) -> html, importNotes(W) -> [sentence],
//     onSwitch(W, on, ctx), conformance(W, S1, R, outDir), help: [{ slug, title, summary }] }
//
// A module is off when the workspace's modulesOff holds its id. Built without a module (FARO_WITHOUT=<id>), its rows in
// W.modules[<id>] are kept exactly as loaded and saved back unchanged: the core never reads or drops them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REG = new Map();
let loaded = false;

export function registerModule(def) { REG.set(def.id, def); }
export async function loadModules() {
  if (loaded) return modulesIn();
  loaded = true;
  const without = String(process.env.FARO_WITHOUT || '').split(',').map((s) => s.trim()).filter(Boolean);
  const dir = path.join(here, '..', 'modules');
  if (!fs.existsSync(dir)) return [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (without.includes(name)) continue;
    const f = path.join(dir, name, 'module.mjs');
    if (fs.existsSync(f)) { const mod = await import(f); if (mod.default) registerModule(mod.default); }
  }
  return modulesIn();
}
export const modulesIn = () => [...REG.values()];
export const moduleById = (id) => REG.get(id) || null;
export const isOn = (W, id) => REG.has(id) && !(W.modulesOff || []).includes(id);
export const onModules = (W) => modulesIn().filter((m) => isOn(W, m.id));
/** The module-off sentence (spec/core/tools.md, "Every tool can also say"). */
export const offSentence = (W, id, tool, wsName) => `${REG.get(id)?.name || id} is switched off in ${wsName}, so ${tool} can’t be used there. An admin can switch it on in Workspace, under Features.`;
/** Everything the on modules put at one place on a core screen, in registration order. */
export function placesAt(W, place, ...args) {
  return onModules(W).map((m) => (m.places && m.places[place] ? m.places[place](...args) : '')).filter(Boolean).join('');
}
/** The menu items the on modules add (after People: the core's `module:<id>` slot). */
export const navModules = (W) => onModules(W).filter((m) => m.nav).map((m) => m.id);
/** Switching a module on or off (Workspace → Features): the core flips modulesOff, the module re-works what it holds. */
export function setModule(W, id, on, ctx) {
  const off = new Set(W.modulesOff || []);
  if (on) off.delete(id); else off.add(id);
  W.modulesOff = [...off];
  const m = REG.get(id);
  if (m && m.onSwitch) m.onSwitch(W, on, ctx);
}
/** A module's own records, as the core keeps them: filed under W.modules[id][record.under]. */
export function recordsOf(W, id) {
  W.modules = W.modules || {};
  W.modules[id] = W.modules[id] || {};
  const m = REG.get(id);
  for (const r of m?.records || []) W.modules[id][r.under] = W.modules[id][r.under] || [];
  return W.modules[id];
}
/** What an import says once about the sheets it didn't read because of a module, on or off (the import's own notes). */
export function importNotesFor(W, sheets) {
  return modulesIn().flatMap((m) => (m.importNotes ? m.importNotes(W, sheets, isOn(W, m.id)) : []));
}
