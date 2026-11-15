// The module platform (spec/rebuild/module-platform.md): where a module plugs in, how a workspace switches one off,
// what the core says while one is off. The core never names a module: it reads the installed modules' facts.

// Places on core screens (the kit's PLACES), then the places and hooks the kit names for what Faro's core still draws.
export const PLACES = ['home.blocks', 'goal.facts', 'goal.sections', 'data.tools', 'goals.tools', 'goal.measure', 'people.person', 'people.team',
  'help.article', 'checkin.number', 'checkin.table',
  'goals.layouts', 'goals.scopes', 'goals.header', 'goal.buttons', 'home.lead', 'settings.you', 'workspace.about', 'cycles.cycle', 'cycles.start',
  'features.line', 'features.readBack', 'activity.entry', 'menu.count'];
export const HOOKS = ['afterGoalSaved', 'beforeCheckIn', 'onSwitch', 'writesWhenOff', 'drill'];
export const GROUPS = [['together', 'Working together'], ['tools', 'Tools'], ['beyond', 'Beyond this workspace']];

// Every sentence the core says while a module is off (the table "What the core says while a module is off").
export const words = {
  page: (m, ws) => `${m} is switched off in ${ws}. An admin can switch it on in Workspace, Features.`,
  action: (m, ws) => `${m} is switched off in ${ws}. An admin can switch it on in Workspace, under Features.`,
  actionShort: (m, ws) => `${m} is off in ${ws}.`,
  tool: (m, ws, tool) => `${m} is switched off in ${ws}, so ${tool} can’t be used there. An admin can switch it on in Workspace, under Features.`,
  help: (m, ws) => `${m} is switched off in ${ws}, so its Help isn’t shown there. An admin can switch it on in Workspace, under Features.`,
  aiShut: (ws) => `AI access is switched off in ${ws}. An admin can switch it on in Faro, under Workspace, Features.`,
  aiLast: (ws) => `AI access is off in ${ws}. This connection stops working now. An admin switches it back on in Faro.`,
  sheetOff: (m, ws, sheet) => `${m} is off in ${ws}, so the ${sheet} sheet was not read.`,
  switchedOff: (m, ws) => `${m} is off in ${ws}. Nothing it saved is lost.`,
  switchedOn: (m, ws) => `${m} is on in ${ws}.`,
  offUntil: (names) => `Off until ${names} is on.`,
  undoneOff: (m) => `${m} is off again.`,
  undoneOn: (m) => `${m} is back on.`,
  notAdmin: 'Only admins can switch features on or off.',
  unknown: (id) => `There’s no feature called ${id}.`,
};
const listAnd = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// installed: module definitions (facts plus optional parts, routes, actions, tools, help).
export function createPlatform(installed) {
  const mods = [...installed].sort((a, b) => (a.id < b.id ? -1 : 1)); // module order: ids A to Z
  const byId = new Map(mods.map((m) => [m.id, m]));

  // The rule (resolveModules): installed, not in modulesOff, and everything in needs on, however deep.
  function resolve(modulesOff) {
    const off = modulesOff === 'all' ? new Set(mods.map((m) => m.id)) : new Set(modulesOff || []);
    const on = new Set();
    const isOn = (id, seen = new Set()) => {
      const m = byId.get(id);
      if (!m || off.has(id) || seen.has(id)) return false;
      seen.add(id);
      return (m.needs || []).every((n) => isOn(n, seen));
    };
    for (const m of mods) if (isOn(m.id)) on.add(m.id);
    return on;
  }
  const dependents = (id) => {
    const out = [];
    const walk = (x) => { for (const m of mods) if ((m.needs || []).includes(x) && !out.includes(m)) { out.push(m); walk(m.id); } };
    walk(id);
    return out;
  };

  // A place: what the modules that are on put there, in module order; nothing when none does.
  function draw(place, on, ctx) {
    if (!PLACES.includes(place)) throw new Error(`No place called ${place}.`);
    return mods.filter((m) => on.has(m.id) && m.parts && m.parts[place]).map((m) => m.parts[place](ctx)).filter(Boolean).join('');
  }
  function hook(name, on, ctx) {
    if (!HOOKS.includes(name)) throw new Error(`No hook called ${name}.`);
    const out = [];
    for (const m of mods) if (on.has(m.id) && m.hooks && m.hooks[name]) out.push(m.hooks[name](ctx));
    return out;
  }
  // A route's module (on or off), matched by its pattern.
  function route(path) {
    for (const m of mods) {
      for (const [pattern, handler] of Object.entries(m.routes || {})) {
        const ps = pattern.split('/').filter(Boolean), as = path.split('/').filter(Boolean);
        if (ps.length !== as.length) continue;
        const params = {};
        if (ps.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = decodeURIComponent(as[i])), true) : p === as[i]))) return { module: m, handler, params, pattern };
      }
      for (const [from, to] of m.redirects || []) if (path === from) return { module: m, redirect: to };
    }
    return null;
  }
  const menuItems = (on) => mods.filter((m) => on.has(m.id)).flatMap((m) => (m.navigation || []).map((n) => ({ id: m.id, label: n.label, group: n.group || 'lookup', to: n.to })));
  const sections = (on) => mods.filter((m) => on.has(m.id)).flatMap((m) => (m.sections || []).map((s) => ({ ...s, module: m.id })));
  const helpArticles = (on) => mods.filter((m) => on.has(m.id)).flatMap((m) => (m.help || []).map((h) => ({ ...h, module: m.id })));
  const helpOwner = (articleId) => mods.find((m) => (m.help || []).some((h) => h.id === articleId)) || null;
  const tools = () => mods.flatMap((m) => (m.tools || []).map((t) => ({ ...t, module: m.id })));
  const actionOf = (name) => { for (const m of mods) if (m.actions && m.actions[name]) return { module: m, action: m.actions[name] }; return null; };

  // Run a module's action: refused while its module is off, unless it only takes something away (whileOff).
  function runAction(name, on, wsName, ctx) {
    const a = actionOf(name);
    if (!a) return { error: `No action called ${name}.` };
    if (!on.has(a.module.id) && !a.action.whileOff) {
      const say = a.module.offWords === 'short' ? words.actionShort : words.action;
      return { error: say(a.module.name, wsName) };
    }
    return a.action.run(ctx);
  }

  // setModule: who, the unknown id, nothing to do, and the log entry with "and with it".
  function setModule({ actor, isAdmin, modulesOff, id, on: wantOn, wsName }) {
    if (!isAdmin) return { error: words.notAdmin };
    const m = byId.get(id);
    if (!m) return { error: words.unknown(id) };
    const off = new Set(modulesOff === 'all' ? mods.map((x) => x.id) : modulesOff || []);
    const was = !off.has(id);
    if (was === wantOn) return { nothing: true, modulesOff: [...off] };
    const beforeOn = resolve([...off]);
    if (wantOn) off.delete(id); else off.add(id);
    const afterOn = resolve([...off]);
    const goneWith = wantOn ? [] : dependents(id).filter((d) => beforeOn.has(d.id) && !afterOn.has(d.id));
    const cameWith = wantOn ? dependents(id).filter((d) => !beforeOn.has(d.id) && afterOn.has(d.id)) : [];
    const others = wantOn ? cameWith : goneWith;
    const summary = `Switched ${wantOn ? 'on' : 'off'} ${m.name}${others.length ? `, and with it ${listAnd(others.map((d) => d.name))}` : ''}`;
    const diffs = [{ field: m.name, from: wantOn ? 'Off' : 'On', to: wantOn ? 'On' : 'Off' }];
    return { modulesOff: [...off].sort(), summary, diffs, message: wantOn ? words.switchedOn(m.name, wsName) : words.switchedOff(m.name, wsName), onSwitch: (m.hooks && m.hooks.onSwitch) || null, module: m };
  }

  return { mods, byId, resolve, dependents, draw, hook, route, menuItems, sections, helpArticles, helpOwner, tools, actionOf, runAction, setModule };
}
