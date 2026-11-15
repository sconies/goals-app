// Navigation (spec/core/rules/navigation.md): the menu, the phone's tabs, the lit item and a page's name.
// Pure: every input is passed in. `mods` is the list of module menu items that are on: [{ id, label, group, to }].

export const GROUP_NAMES = ['your work', 'look up', 'make', 'this workspace and you'];

// The menu as groups of ids. opts: { checkin, reviewsOn, feedbackOn, mods, views }
export function menuGroups({ checkin, reviewsOn = true, feedbackOn = true, mods = [] }) {
  const work = ['home', ...(checkin ? ['checkin'] : []), 'goals', ...(reviewsOn ? ['reviews'] : []),
    ...mods.filter((m) => m.group === 'work').map((m) => `module:${m.id}`)];
  const look = ['people', ...mods.filter((m) => (m.group ?? 'lookup') === 'lookup').map((m) => `module:${m.id}`), 'activity', 'data'];
  const make = ['new'];
  const you = ['workspace', 'settings', 'help', ...(feedbackOn ? ['feedback'] : [])];
  return [work, look, make, you];
}

export function phoneTabs({ checkin, reviewsOn = true }) {
  if (reviewsOn) return checkin ? ['home', 'checkin', 'goals', 'reviews'] : ['home', 'goals', 'reviews', 'people'];
  return checkin ? ['home', 'checkin', 'goals', 'people'] : ['home', 'goals', 'people', 'activity'];
}

export function moreRows(opts) {
  const tabs = new Set(phoneTabs(opts));
  return menuGroups(opts).map((g) => g.filter((id) => !tabs.has(id))).filter((g) => g.length);
}

const splitAddress = (address) => {
  const [p, q = ''] = address.split('?');
  const params = new URLSearchParams(q);
  const parts = p.split('/').filter(Boolean);
  return { path: p, parts, params };
};

// The item an address belongs to (before checking it is in the viewer's menu). mods: modules on (or all, for naming).
export function placeOf(address, mods = []) {
  const { path, parts, params } = splitAddress(address);
  if (parts[0] === 'goals' && parts[1] && parts[1] !== 'new' && params.get('review')) return 'reviews';
  if (path === '/') return 'home';
  const mod = mods.find((m) => m.to && (path === m.to || path.startsWith(m.to + '/')));
  if (mod) return `module:${mod.id}`;
  switch (parts[0]) {
    case 'check-in': case 'quick-check-in': return 'checkin';
    case 'goals': return parts[1] === 'new' ? 'new' : 'goals';
    case 'watching': return 'goals';
    case 'retro': return 'goals';
    case 'reviews': return 'reviews';
    case 'people': case 'teams': return 'people';
    case 'activity': return 'activity';
    case 'data': return 'data';
    case 'workspace': return parts[1] === 'new' ? null : 'workspace';
    case 'settings': return 'settings';
    case 'help': case 'whats-new': return 'help';
    case 'feedback': return 'feedback';
    default: return null;
  }
}

export function litItem(address, opts, views = []) {
  const view = views.find((v) => v.address === address);
  if (view) return `view:${view.id}`;
  let place = placeOf(address, opts.mods || []);
  if (!place) return '';
  const menu = menuGroups(opts).flat();
  // a goal in a review's walk lights Reviews; with Reviews switched off it is just a goal
  if (place === 'reviews' && !menu.includes('reviews') && /^\/goals\/[^/?]+/.test(address)) place = 'goals';
  return menu.includes(place) ? place : '';
}

export function litTab(address, opts) {
  const lit = litItem(address, opts);
  if (!lit) return '';
  return phoneTabs(opts).includes(lit) ? lit : 'more';
}

const FIXED = {
  '/': 'Home', '/goals': 'Goals', '/watching': 'Goals', '/goals/new': 'New goal', '/check-in': 'Check-in',
  '/quick-check-in': 'Check-in, all in one table', '/reviews': 'Reviews', '/reviews/new': 'New review', '/people': 'People',
  '/teams': 'Teams', '/activity': 'Activity', '/data': 'Data', '/workspace': 'Workspace', '/workspace/new': 'Set up a workspace',
  '/settings': 'Settings', '/help': 'Help', '/whats-new': 'What’s new', '/feedback': 'Feedback', '/research': 'Research', '/ready': 'Ready to start',
};
export const SECTION_NAMES = { overview: 'About', cycles: 'Cycles', access: 'Access', features: 'Features', privacy: 'Privacy', removed: 'Recently removed' };
export const NEW_GOAL_STEPS = { what: 'What', who: 'Who and where', measure: 'How it’s measured', check: 'Check' };

// A page's name (rule 2). names: { goal(id), review(id), person(id), team(id), sectionLabel(id), modulePage(path) , off(path) }
export function pageName(address, names) {
  const { path, parts, params } = splitAddress(address);
  if (names.off && names.off(path)) return 'Page not found';
  const modName = names.modulePage && names.modulePage(path);
  if (modName) return modName;
  if (FIXED[path]) return FIXED[path];
  const goalOr = (id, f) => { const g = names.goal(id); return g ? f(g) : 'Goal not found'; };
  switch (parts[0]) {
    case 'goals': {
      if (parts[1] === 'new') return NEW_GOAL_STEPS[parts[2]] ?? 'New goal';
      if (parts.length === 2) {
        const rid = params.get('review');
        return goalOr(parts[1], (g) => { const r = rid && names.review(rid); return r ? `${g.title} · ${r.name}` : g.title; });
      }
      if (parts[2] === 'edit' && parts.length === 3) return goalOr(parts[1], (g) => `Change ${g.title}`);
      if (parts[2] === 'print' && parts.length === 3) return goalOr(parts[1], (g) => `${g.title}, to print`);
      return 'Page not found';
    }
    case 'check-in': return parts.length === 2 ? goalOr(parts[1], (g) => `Check in: ${g.title}`) : 'Page not found';
    case 'retro': return parts.length === 2 ? goalOr(parts[1], (g) => `Wrap up: ${g.title}`) : (names.yearName ? `Wrap up ${names.yearName}` : 'Wrap up');
    case 'reviews': {
      const r = names.review(parts[1]);
      if (!r) return 'Review not found';
      if (parts.length === 2) return r.name;
      if (parts[2] === 'edit') return `Change ${r.name}`;
      if (parts[2] === 'summary') return `${r.name}: summary`;
      if (parts[2] === 'print') return `${r.name}, to print`;
      return 'Page not found';
    }
    case 'people': { const p = names.person(parts[1]); return p ? p.name : 'Person not found'; }
    case 'teams': { const t = names.team(parts[1]); return t ? t.name : 'Team not found'; }
    case 'help': return 'Help';
    case 'workspace': {
      if (path === '/workspace/cycles/next') return 'Start the next year · Workspace';
      const label = SECTION_NAMES[parts[1]] ?? (names.sectionLabel && names.sectionLabel(parts[1]));
      return label ? `${label} · Workspace` : 'Workspace';
    }
    default: return 'Page not found';
  }
}

// The browser's title.
export const docTitle = (page, workspaceName) => `${page} · ${workspaceName} · Faro`;

// The back link (rule 4): history is the tab's earlier addresses, oldest first. Returns { label, back: n } or { label, to } or null.
export const FIRST_PAGES = ['/', '/check-in', '/goals', '/reviews', '/people', '/teams', '/activity', '/data', '/workspace', '/settings', '/help', '/feedback'];
export const isForm = (path) => /^\/check-in(\/|$)|^\/quick-check-in|^\/goals\/new|\/edit$|^\/workspace\/new|^\/retro\/|^\/workspace\/cycles\/next/.test(path);
export function backTo(address, history, names, firstPagesExtra = []) {
  const { path, parts, params } = splitAddress(address);
  if (FIRST_PAGES.includes(path) || firstPagesExtra.includes(path) || isForm(path)) return null;
  const same = (a) => {
    const s = splitAddress(a);
    if (s.path === path) return true;
    const rid = params.get('review');
    return rid && s.params.get('review') === rid && s.parts[0] === 'goals';
  };
  for (let i = history.length - 1, n = 1; i >= 0; i--, n++) {
    const a = history[i];
    const s = splitAddress(a);
    if (isForm(s.path) || same(a)) continue;
    return { label: placeLabel(a, names), back: n };
  }
  // from outside: the parent
  if (parts[0] === 'goals' && parts[1]) {
    const rid = params.get('review');
    if (rid && names.review(rid)) return { label: names.review(rid).name, to: `/reviews/${rid}` };
    const g = names.goal(parts[1]);
    if (parts[2] === 'print' && g) return { label: g.title, to: `/goals/${g.id}` };
    const parent = g && g.parentId && names.goal(g.parentId);
    return parent ? { label: parent.title, to: `/goals/${parent.id}` } : { label: 'Goals', to: '/goals' };
  }
  if (parts[0] === 'reviews') return { label: 'Reviews', to: '/reviews' };
  if (parts[0] === 'people') return { label: 'People', to: '/people' };
  if (parts[0] === 'teams') return { label: 'Teams', to: '/teams' };
  if (parts[0] === 'help' || parts[0] === 'whats-new') return { label: 'Help', to: '/help' };
  if (parts[0] === 'workspace') return { label: 'Workspace', to: '/workspace' };
  return { label: 'Home', to: '/' };
}
export function placeLabel(address, names) {
  const { path, params } = splitAddress(address);
  if (path === '/') return 'Home';
  if (path === '/goals' && params.get('scope') === 'mine') return 'your goals';
  if (path === '/goals') return 'Goals';
  const n = pageName(address, names);
  return n.split(' · ')[0] === n ? n : n;
}
