// The module platform (spec/rebuild/module-platform.md): facts, the switch's rule, and every sentence the core says while a module is off.
// The core never names a module: it reads the installed modules' facts.

// The ids Faro installs; the core-only conformance workspace switches all of them off. Their facts here are the kit's table
// ("What each installed module plugs in"); a rebuild stage for each module fills in the rest.
export const INSTALLED = [
  { id: 'ai-access', name: 'AI access', group: 'beyond', summary: 'Personal tokens so an AI assistant can act as you.', needs: [] },
  { id: 'feedback', name: 'Feedback', group: 'beyond', summary: 'Send feedback about Faro, or mark up the screen you are on.', needs: [] },
  { id: 'goal-map', name: 'Goal map', group: 'tools', summary: 'Every goal on one canvas, with what feeds what.', needs: [] },
  { id: 'metrics', name: 'Metric library', group: 'tools', summary: 'Define each metric once and link goals to it.', needs: [] },
  { id: 'reviews', name: 'Reviews', group: 'together', summary: 'Walk a set of goals together on a cadence.', needs: [] },
  { id: 'spreadsheets', name: 'Spreadsheets', group: 'tools', summary: 'Download and load back every goal as a workbook.', needs: [] },
  { id: 'tags', name: 'Fields', group: 'tools', summary: 'Up to six fields of your own on goals.', needs: [] },
  { id: 'watching', name: 'Watching', group: 'together', summary: 'Watch goals and see them on Home.', needs: [] },
  { id: 'wrap-up', name: 'Wrap-up', group: 'together', summary: 'Say how each goal landed at the end of the year.', needs: [] },
];
export const MODULE_IDS = INSTALLED.map((m) => m.id);
export const GROUPS = [['together', 'Working together'], ['tools', 'Tools'], ['beyond', 'Beyond this workspace']];

// resolveModules: on when installed, not in modulesOff, and everything it needs is on, however deep
export function resolveModules(installed, modulesOff = []) {
  const off = new Set(modulesOff || []);
  const byId = new Map(installed.map((m) => [m.id, m]));
  const memo = new Map();
  const isOn = (id, seen = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    const m = byId.get(id);
    if (!m || off.has(id) || seen.has(id)) { memo.set(id, false); return false; }
    seen.add(id);
    const r = (m.needs || []).every((n) => isOn(n, seen));
    memo.set(id, r);
    return r;
  };
  return (id) => isOn(id);
}
export const modulesOn = (W, installed = INSTALLED) => resolveModules(installed, W.modulesOff);

// what needs a module, however deep (switching it off takes these with it)
export function dependents(installed, id) {
  const out = [];
  const walk = (x) => { for (const m of installed) if ((m.needs || []).includes(x) && !out.includes(m.id)) { out.push(m.id); walk(m.id); } };
  walk(id);
  return out;
}

// setModule: admins only; one change on the workspace, logged
export function setModule(W, installed, actor, id, on) {
  const person = (W.people || []).find((p) => p.id === actor);
  if (!person || !person.admin) return { error: 'Only admins can switch features on or off.' };
  const m = installed.find((x) => x.id === id);
  if (!m) return { error: `There’s no feature called ${id}.` };
  const off = new Set(W.modulesOff || []);
  if (off.has(id) === !on) return { saved: false };
  if (on) off.delete(id); else off.add(id);
  const others = on ? [] : dependents(installed, id).filter((d) => !off.has(d)).map((d) => installed.find((x) => x.id === d).name);
  const what = `Switched ${on ? 'on' : 'off'} ${m.name}${others.length ? `, and with it ${others.join(', ')}` : ''}`;
  return { saved: true, modulesOff: [...off].sort(), change: { kind: 'workspace', what, diffs: [`${m.name}: ${on ? 'Off → On' : 'On → Off'}`], by: actor } };
}

// ---------- every sentence the core says while a module is off ----------
export const W_ = {
  page: (m, ws) => `${m} is switched off in ${ws}. An admin can switch it on in Workspace, Features.`,
  action: (m, ws) => `${m} is switched off in ${ws}. An admin can switch it on in Workspace, under Features.`,
  coreAction: (m, ws) => `${m} is off in ${ws}.`,
  tool: (m, ws, tool) => `${m} is switched off in ${ws}, so ${tool} can’t be used there. An admin can switch it on in Workspace, under Features.`,
  help: (m, ws) => `${m} is switched off in ${ws}, so its Help isn’t shown there. An admin can switch it on in Workspace, under Features.`,
  aiShut: (ws) => `AI access is switched off in ${ws}. An admin can switch it on in Faro, under Workspace, Features.`,
  aiLast: (ws) => `AI access is off in ${ws}. This connection stops working now. An admin switches it back on in Faro.`,
  reviewsOffRead: (ws) => `Reviews is off in ${ws}, so the Notes sheet and the Review column were not read.`,
  moduleOffLine: (m, ws, sheet) => `${m} is off in ${ws}, so the ${sheet} sheet was not read.`,
  switchedOff: (m, ws) => `${m} is off in ${ws}. Nothing it saved is lost.`,
  switchedOn: (m, ws) => `${m} is on in ${ws}.`,
  undoOff: (m) => `${m} is off again.`,
  undoOn: (m) => `${m} is back on.`,
  needsOff: (names) => `Off until ${names.join(' and ')} is on.`,
  featuresFoot: 'Switching one off hides it and keeps what it saved.',
};

// ---------- places ----------
export const PLACES = ['home.blocks', 'goal.facts', 'goal.sections', 'data.tools', 'goals.tools', 'goal.measure', 'people.person', 'people.team', 'help.article', 'checkin.number', 'checkin.table'];

// A registry the app fills from modules' facts and code. Every place draws what the modules that are on put there, A to Z by id.
export function makeRegistry(modules) {
  const sorted = [...modules].sort((a, b) => (a.id < b.id ? -1 : 1));
  return {
    modules: sorted,
    place(name, on, input) { const out = []; for (const m of sorted) if (on(m.id) && m.places && m.places[name]) out.push(m.places[name](input)); return out.join(''); },
    routes(on) { return sorted.flatMap((m) => (m.routes || []).map((r) => ({ ...r, module: m }))); },
    menu(on) { return sorted.filter((m) => m.menu && on(m.id)).map((m) => ({ id: m.id, ...m.menu })); },
    sections(on) { return sorted.filter((m) => on(m.id)).flatMap((m) => m.sections || []); },
    help(on) { return sorted.filter((m) => on(m.id)).flatMap((m) => m.help || []); },
    scopes(on) { return sorted.filter((m) => on(m.id)).flatMap((m) => (m.scopes || []).map((s) => ({ ...s, module: m }))); },
    tools() { return sorted.flatMap((m) => (m.aiTools || []).map((t) => ({ ...t, module: m }))); },
    actions() { const a = {}; for (const m of sorted) for (const [k, f] of Object.entries(m.actions || {})) a[k] = { run: f, module: m }; return a; },
  };
}
