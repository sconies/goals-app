// The core's extension points (added for stage 8: the core rebuild had none). A module registers what it adds;
// the core asks the registry, never the module by name. A module is off when the workspace's modulesOff holds its id.
export const MODULES = [];
export function register(m) { if (!MODULES.find((x) => x.id === m.id)) MODULES.push(m); return m; }
export const isOn = (W, id) => !(W.modulesOff || []).includes(id);
export const moduleById = (id) => MODULES.find((m) => m.id === id);
export const onModules = (W) => MODULES.filter((m) => isOn(W, m.id));
// The switched-off module's sentences: one for a closed page, one for an action, one for an AI tool (check N30).
export const pageOff = (wsName, m) => `${m.label} is switched off in ${wsName}. An admin can switch it on in Workspace, Features.`;
export const actionOff = (wsName, m) => `${m.label} is switched off in ${wsName}. An admin can switch it on in Workspace, under Features.`;
export const toolOff = (wsName, m, tool) => `${m.label} is switched off in ${wsName}, so ${tool} can’t be used there. An admin can switch it on in Workspace, under Features.`;
// The module whose address this is ("/reviews/x" belongs to the module that lists "/reviews").
export function routeOwner(pathname) {
  const p = '/' + pathname.split('/').filter(Boolean)[0];
  return MODULES.find((m) => (m.routes || []).includes(p)) || null;
}
export const toolOwner = (name) => MODULES.find((m) => m.tools && Object.hasOwn(m.tools, name)) || null;
// Every save passes here: a switched-off module refuses whatever would save its records (its `writes` rule).
export const refuser = (W, commit, input = {}) => MODULES.find((m) => !isOn(W, m.id) && m.writes && m.writes(W, commit, input)) || null;
export function refusalFor(W, wsName, commit, input = {}) {
  const m = refuser(W, commit, input);
  return m ? actionOff(wsName, m) : null;
}
// The extensions a module puts on the core's rules object (R.ext), only while it is on.
export function extFor(W, R, S1) {
  const ext = {};
  for (const m of onModules(W)) if (m.ext) Object.assign(ext, m.ext(R, W, S1));
  return ext;
}
