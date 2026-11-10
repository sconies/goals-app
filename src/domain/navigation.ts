/* Navigation as rules (docs/design/architecture.md, 1.2: AR2): the menu, the lit item and a page's name are worked out
   from who is looking and the address, not drawn inline in the shell. The shell (src/ui/Shell.tsx) and the Back link
   (src/ui/BackLink.tsx) draw what these say; a rebuild copies these and draws its own. Pure: each takes what it reads
   (whether the viewer owns goals, names looked up by id), never the workspace. */

/** The core's places in the menu. */
export type NavId = 'home' | 'checkin' | 'watching' | 'reviews' | 'goals' | 'activity' | 'data' | 'new' | 'workspace' | 'settings';

/** Where a menu item belongs: your work (Home, Check-in, Goals, Reviews), or things to look up (Activity, Data…). */
export type NavGroup = 'work' | 'lookup';

export const CORE_NAV: Record<NavId, { to: string; label: string; group: NavGroup | 'you' }> = {
  home: { to: '/', label: 'Home', group: 'work' },
  checkin: { to: '/check-in', label: 'Check-in', group: 'work' },
  watching: { to: '/watching', label: 'Watching', group: 'work' },
  reviews: { to: '/reviews', label: 'Reviews', group: 'work' },
  goals: { to: '/goals', label: 'Goals', group: 'work' },
  activity: { to: '/activity', label: 'Activity', group: 'lookup' },
  data: { to: '/data', label: 'Data', group: 'lookup' },
  new: { to: '/goals/new', label: 'New goal', group: 'work' },
  workspace: { to: '/workspace', label: 'Workspace', group: 'you' },
  settings: { to: '/settings', label: 'Settings', group: 'you' },
};

/** A module's menu item, as its app.tsx gives it (module.json lists it by label). */
export interface ModuleNavItem { id: string; to: string; label: string; group?: NavGroup }

/** The sidebar: Check-in only for someone who owns a goal. */
export function sideFor(ownsGoals: boolean): NavId[] {
  return ['home', ...(ownsGoals ? ['checkin' as const] : []), 'goals', 'reviews', 'activity', 'data', 'new', 'workspace'];
}

/** The phone's tabs. An owner gets Check-in; someone who owns nothing mostly follows goals, so gets Watching. */
export function tabsFor(ownsGoals: boolean): NavId[] {
  return ownsGoals ? ['home', 'checkin', 'goals', 'reviews'] : ['home', 'goals', 'watching', 'reviews'];
}

/**
 * The sidebar with the modules' items in it: a module's item in the work group follows Reviews, one to look things up
 * (the default) follows Data. Ids, in order; a module's item is "module:<id>".
 */
export function menuFor(ownsGoals: boolean, modules: ModuleNavItem[]): string[] {
  const out: string[] = [];
  for (const id of sideFor(ownsGoals)) {
    out.push(id);
    if (id === 'reviews') out.push(...modules.filter((m) => m.group === 'work').map((m) => `module:${m.id}`));
    if (id === 'data') out.push(...modules.filter((m) => m.group !== 'work').map((m) => `module:${m.id}`));
  }
  return out;
}

/** Whether a core item is the one lit for this address. On a phone without a Watching tab, Watching lights Goals. */
export function isLit(id: NavId, path: string, tabs?: NavId[]): boolean {
  const to = CORE_NAV[id].to;
  if (id === 'home') return path === '/';
  if (id === 'goals') return (path.startsWith('/goals') && path !== '/goals/new') || (path === '/watching' && !!tabs && !tabs.includes('watching'));
  return path === to || path.startsWith(to + '/');
}

/** The one item lit for an address, among these (core ids, or "module:<id>" with its address). Null when none is. */
export function litItem(path: string, items: string[], modules: ModuleNavItem[] = [], tabs?: NavId[]): string | null {
  for (const id of items) {
    if (id.startsWith('module:')) {
      const m = modules.find((x) => `module:${x.id}` === id);
      if (m && (path === m.to || path.startsWith(m.to + '/'))) return id;
    } else if (isLit(id as NavId, path, tabs)) return id;
  }
  return null;
}

/** Where you are under Goals, as the menu says it: Mine, Watching, or none. */
export type GoalsAt = 'mine' | 'watching' | 'all' | `view:${string}` | null;

/**
 * A page's name, for the phone's top bar and the browser's title: a module's page names itself; Watching and Mine
 * under Goals; the places without a menu item; then the menu item that is lit; then what a focused task is.
 */
export function pageName(path: string, at: GoalsAt, items: NavId[], moduleName?: string | null): string {
  if (moduleName) return moduleName;
  if (at === 'watching') return 'Watching';
  if (at === 'mine') return 'Mine';
  const fixed: Record<string, string> = { '/settings': 'Settings', '/feedback': 'Feedback', '/whats-new': 'What’s new' };
  if (fixed[path]) return fixed[path]!;
  if (path.startsWith('/help')) return 'Help';
  const lit = items.find((id) => isLit(id, path));
  if (lit) return CORE_NAV[lit].label;
  if (path.startsWith('/retro')) return 'Wrap up';
  if (path.startsWith('/check-in') || path.startsWith('/quick-check-in')) return 'Check-in';
  if (path.startsWith('/research')) return 'Research';
  return 'Goals';
}

/** Names looked up by id, for a Back link's words. */
export interface PlaceNames {
  goal(id: string): string | null;
  review(id: string): string | null;
  /** A saved view open at these Goals params, if any. */
  view(params: URLSearchParams): string | null;
  article(id: string): string | null;
}

/** Where a Back link leads, said the way the menu says it: "Back to Reviews", "Back to Lead time for changes". */
export function placeName(path: string, names: PlaceNames): string {
  const [p = '/', q = ''] = path.split('?');
  const sp = new URLSearchParams(q);
  const review = sp.get('review');
  if (review && p.startsWith('/goals/')) return names.review(review) ?? 'the review';
  if (p === '/') return 'Home';
  if (p === '/goals') return names.view(sp) ?? (sp.get('show') === 'mine' ? 'your goals' : sp.get('show') === 'watching' ? 'Watching' : 'Goals');
  const goal = /^\/goals\/([^/]+)$/.exec(p);
  if (goal) return names.goal(goal[1]!) ?? 'the goal';
  const rev = /^\/reviews\/([^/]+)$/.exec(p);
  if (rev) return names.review(rev[1]!) ?? 'the review';
  const help = /^\/help\/([^/]+)$/.exec(p);
  if (help) return names.article(help[1]!) ?? 'Help';
  const known: Record<string, string> = { '/watching': 'Watching', '/reviews': 'Reviews', '/activity': 'Activity', '/data': 'Data', '/workspace': 'Workspace', '/settings': 'Settings', '/retro': 'Wrap up', '/research': 'Research', '/help': 'Help', '/whats-new': 'What’s new' };
  return known[p] ?? 'the last page';
}
