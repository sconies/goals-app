// The core's extension points (added for the spreadsheets module: CORE-CHANGES 1). Each module registers
// its routes, old addresses, places on core screens, Help articles and AI tools here; a module is off when
// the workspace's modulesOff holds its id, and then none of it shows, answers or is listed as working.
import * as spreadsheets from './spreadsheets/index.mjs';

export const MODULES = [spreadsheets];
export const isOn = (W, id) => !(W.modulesOff || []).includes(id);
export const moduleById = (id) => MODULES.find((m) => m.id === id);
// every feature id the kit names, so a workspace may hold one this rebuild hasn't built (left as it is)
export const KNOWN = ['ai-access', 'feedback', 'goal-map', 'metrics', 'reviews', 'spreadsheets', 'tags', 'watching', 'wrap-up'];

// the module whose route an address is, on or off
export function routeOwner(P) {
  const path = P.join('/');
  return MODULES.find((m) => (m.routes || []).some((r) => path === r || path.startsWith(`${r}/`)));
}
export function oldAddress(pathname) {
  for (const m of MODULES) for (const [from, to] of Object.entries(m.oldAddresses || {})) if (pathname === from) return { m, to };
  return null;
}
// what the modules that are on put in a place on a core screen
export function place(ctx, h, name, ...args) {
  return MODULES.filter((m) => isOn(ctx.W, m.id) && m.places?.[name]).map((m) => m.places[name](ctx, h, ...args)).join('');
}
// Help articles a module owns: by title, hidden while it is off
export function helpOwner(title) { return MODULES.find((m) => m.helpArticles && title in m.helpArticles); }
export const offSentence = (m, wsName) => `${m.name} is switched off in ${wsName}. An admin can switch it on in Workspace, under Features.`;
export const toolOffSentence = (m, tool, wsName) => `${m.name} is switched off in ${wsName}, so ${tool} can’t be used there. An admin can switch it on in Workspace, under Features.`;
