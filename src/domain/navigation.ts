/* Navigation as rules (docs/design/architecture.md, 1.2: AR2): the menu, the lit item and a page's name are worked out
   from who is looking and the address, not drawn inline in the shell. The shell (src/ui/Shell.tsx) and the Back link
   (src/ui/BackLink.tsx) draw what these say; a rebuild copies these and draws its own. Pure: each takes what it reads
   (whether the viewer owns goals, names looked up by id), never the workspace. */

/** The core's places in the menu. */
export type NavId = 'home' | 'checkin' | 'watching' | 'reviews' | 'goals' | 'activity' | 'people' | 'data' | 'new' | 'workspace' | 'settings' | 'help' | 'feedback';

/** Where a menu item belongs: your work (Home, Check-in, Goals, Reviews), or things to look up (Activity, Data…). */
export type NavGroup = 'work' | 'lookup';

export const CORE_NAV: Record<NavId, { to: string; label: string; group: NavGroup | 'you' }> = {
  home: { to: '/', label: 'Home', group: 'work' },
  checkin: { to: '/check-in', label: 'Check-in', group: 'work' },
  watching: { to: '/watching', label: 'Watching', group: 'work' },
  reviews: { to: '/reviews', label: 'Reviews', group: 'work' },
  goals: { to: '/goals', label: 'Goals', group: 'work' },
  activity: { to: '/activity', label: 'Activity', group: 'lookup' },
  people: { to: '/people', label: 'People', group: 'lookup' },
  data: { to: '/data', label: 'Data', group: 'lookup' },
  new: { to: '/goals/new', label: 'New goal', group: 'work' },
  workspace: { to: '/workspace', label: 'Workspace', group: 'you' },
  settings: { to: '/settings', label: 'Settings', group: 'you' },
  help: { to: '/help', label: 'Help', group: 'you' },
  feedback: { to: '/feedback', label: 'Feedback', group: 'you' },
};

/** The menu's groups (navigation spec, 2.1): each a row of places, a group to screen readers, hairlines between. */
export interface MenuGroups { work: string[]; lookup: string[]; make: string[]; you: string[] }
export const GROUP_NAMES: Record<keyof MenuGroups, string> = { work: 'Your work', lookup: 'Look up', make: 'Make', you: 'This workspace and you' };

/**
 * Rule 1. The menu in its groups: your work (Home; Check-in for someone with a goal to check in on; Goals; Reviews),
 * things to look up (People, then the modules' items in the order they register, then Activity and Data), New goal, and
 * this workspace and you (Workspace, Settings, Help, Feedback). A module's item in the work group follows Reviews.
 */
export function menuGroups(checksIn: boolean, modules: ModuleNavItem[] = []): MenuGroups {
  const id = (m: ModuleNavItem) => `module:${m.id}`;
  return {
    work: ['home', ...(checksIn ? ['checkin'] : []), 'goals', 'reviews', ...modules.filter((m) => m.group === 'work').map(id)],
    lookup: ['people', ...modules.filter((m) => m.group !== 'work').map(id), 'activity', 'data'],
    make: ['new'],
    you: ['workspace', 'settings', 'help', 'feedback'],
  };
}

/** The phone's four tabs: Check-in for whoever checks in, People for anyone else. More holds the rest. */
export function phoneTabs(checksIn: boolean): NavId[] {
  return checksIn ? ['home', 'checkin', 'goals', 'reviews'] : ['home', 'goals', 'reviews', 'people'];
}

/** More, on a phone: every row the tabs don't hold, in the menu's groups (work's rows are all tabs). */
export function moreFor(groups: MenuGroups, tabs: string[]): Pick<MenuGroups, 'lookup' | 'make' | 'you'> {
  const not = (xs: string[]) => xs.filter((x) => !tabs.includes(x));
  return { lookup: not([...groups.work.filter((x) => x.startsWith('module:')), ...groups.lookup]), make: not(groups.make), you: not(groups.you) };
}

/** A saved view as the menu lists it. */
export interface MenuView { id: string; name: string; pinned: boolean; mine: boolean; createdAt: string }

/** Up to four saved views under Goals: those pinned for everyone A to Z, then your own, the latest opened first. */
export function menuViews(views: MenuView[], openedLately: string[]): MenuView[] {
  const pinned = views.filter((v) => v.pinned).sort((a, b) => a.name.localeCompare(b.name));
  const rank = (v: MenuView) => { const i = openedLately.indexOf(v.id); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
  const mine = views.filter((v) => !v.pinned && v.mine).sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
  return [...pinned, ...mine].slice(0, 4);
}

/** A module's menu item, as its app.tsx gives it (module.json lists it by label). */
export interface ModuleNavItem { id: string; to: string; label: string; group?: NavGroup }

/** Every row of the menu, in order (the groups flattened). */
export const menuRows = (g: MenuGroups) => [...g.work, ...g.lookup, ...g.make, ...g.you];

/** Whether a core item is the one lit for this address. On a phone without a Watching tab, Watching lights Goals. */
export function isLit(id: NavId, path: string, tabs?: NavId[]): boolean {
  const to = CORE_NAV[id].to;
  if (id === 'home') return path === '/';
  if (id === 'goals') return (path.startsWith('/goals') && path !== '/goals/new') || (path === '/watching' && !!tabs && !tabs.includes('watching'));
  // People and Teams are one place (app redesign WR1).
  if (id === 'people') return /^\/(people|teams)(\/|$)/.test(path);
  if (id === 'help') return /^\/(help|whats-new)(\/|$)/.test(path);
  if (id === 'checkin') return /^\/(check-in|quick-check-in)(\/|$)/.test(path);
  if (id === 'workspace') return /^\/workspace(\/|$)/.test(path) && !path.startsWith('/workspace/new');
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
  person(id: string): string | null;
  team(id: string): string | null;
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
  const who = /^\/people\/([^/]+)$/.exec(p);
  if (who) return names.person(decodeURIComponent(who[1]!)) ?? 'People';
  const team = /^\/teams\/([^/]+)$/.exec(p);
  if (team) return names.team(decodeURIComponent(team[1]!)) ?? 'Teams';
  const help = /^\/help\/([^/]+)$/.exec(p);
  if (help) return names.article(help[1]!) ?? 'Help';
  const known: Record<string, string> = { '/people': 'People', '/teams': 'Teams', '/feedback': 'Feedback', '/watching': 'Watching', '/reviews': 'Reviews', '/activity': 'Activity', '/data': 'Data', '/workspace': 'Workspace', '/settings': 'Settings', '/retro': 'Wrap up', '/research': 'Research', '/help': 'Help', '/whats-new': 'What’s new' };
  return known[p] ?? 'the last page';
}
