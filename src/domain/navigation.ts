/* Navigation as rules (docs/design/architecture.md, 1.2: AR2): the menu, the lit item and a page's name are worked out
   from who is looking and the address, not drawn inline in the shell. The shell (src/ui/Shell.tsx) and the Back link
   (src/ui/BackLink.tsx) draw what these say; a rebuild copies these and draws its own. Pure: each takes what it reads
   (whether the viewer owns goals, names looked up by id), never the workspace. */
import { NEW_GOAL_STEPS } from './newGoal';

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

/** Whether a core item is the one lit for this address (rule 3), before a saved view or a review walk is considered. */
export function isLit(id: NavId, path: string): boolean {
  const to = CORE_NAV[id].to;
  if (id === 'home') return path === '/';
  if (id === 'new') return path === '/goals/new' || path.startsWith('/goals/new/');
  if (id === 'goals') return (/^\/goals(\/|$)/.test(path) && !isLit('new', path)) || path === '/watching' || /^\/retro(\/|$)/.test(path);
  // People and Teams are one place (app redesign WR1).
  if (id === 'people') return /^\/(people|teams)(\/|$)/.test(path);
  if (id === 'help') return /^\/(help|whats-new)(\/|$)/.test(path);
  if (id === 'checkin') return /^\/(check-in|quick-check-in)(\/|$)/.test(path);
  if (id === 'workspace') return /^\/workspace(\/|$)/.test(path) && !/^\/workspace\/new(\/|$)/.test(path);
  return path === to || path.startsWith(to + '/');
}

/** A saved view under Goals, as the menu matches it: its id and its address's parameters. */
export interface LitView { id: string; params: string }

/**
 * Rule 3. The one row lit for an address, among these (core ids, or "module:<id>"), or null: a goal opened in a
 * review's walk lights Reviews; Goals at a saved view's exact address lights that view ("view:<id>") instead of Goals;
 * otherwise the row whose place the address is in. `viewKey` puts Goals' parameters in the order a view keeps them.
 */
export function litItem(path: string, search: string, items: string[], modules: ModuleNavItem[] = [], views: LitView[] = [], viewKey: (p: URLSearchParams) => string = (p) => p.toString()): string | null {
  const sp = new URLSearchParams(search);
  if (sp.get('review') && /^\/goals\/[^/]+$/.test(path) && items.includes('reviews')) return 'reviews';
  if (path === '/goals' && items.includes('goals')) {
    const v = views.find((x) => x.params === viewKey(sp));
    if (v) return `view:${v.id}`;
  }
  for (const id of items) {
    if (id.startsWith('module:')) {
      const m = modules.find((x) => `module:${x.id}` === id);
      if (m && (path === m.to || path.startsWith(m.to + '/'))) return id;
    } else if (isLit(id as NavId, path)) return id;
  }
  return null;
}

/** On a phone: the tab that holds the lit row, or "more" when More does. */
export function litTab(lit: string | null, tabs: string[]): string | null {
  if (!lit) return null;
  if (lit.startsWith('view:')) return tabs.includes('goals') ? 'goals' : 'more';
  return tabs.includes(lit) ? lit : 'more';
}

/** Where you are under Goals, as the menu says it: Mine, Watching, or none. */
export type GoalsAt = 'mine' | 'watching' | 'all' | `view:${string}` | null;

/** Names looked up by id, for a page's name and a Back link's words. Each gives null for something that isn't there. */
export interface PlaceNames {
  goal(id: string): string | null;
  review(id: string): string | null;
  /** A saved view open at these Goals params, if any. */
  view(params: URLSearchParams): string | null;
  article(id: string): string | null;
  person(id: string): string | null;
  team(id: string): string | null;
  /** A Workspace section's name (Access, Cycles…). */
  section?(id: string): string | null;
  /** The running year or quarter's name, for Wrap up. */
  cycle?(): string | null;
  /** A module's page names itself (its fixed title, or from its thing: "Lead time for changes (metric)"). */
  module?(path: string): string | null;
  /** The goal a goal feeds, for a Back link up the tree. */
  parent?(goalId: string): string | null;
}


/** The places named the same wherever they are. */
const FIXED: Record<string, string> = {
  '/': 'Home', '/goals': 'Goals', '/watching': 'Goals', '/goals/new': 'New goal', '/check-in': 'Check-in', '/quick-check-in': 'Check-in, all in one table',
  '/reviews': 'Reviews', '/reviews/new': 'New review', '/people': 'People', '/teams': 'Teams', '/activity': 'Activity', '/data': 'Data',
  '/workspace': 'Workspace', '/workspace/new': 'Set up a workspace', '/settings': 'Settings', '/help': 'Help', '/whats-new': 'What’s new',
  '/feedback': 'Feedback', '/research': 'Research', '/ready': 'Ready to start',
};

/**
 * Rule 2. A page's name, for the browser's title ("{name} · {workspace} · Faro"), the phone's top bar and Find's
 * "Opened lately": a module's page names itself; the fixed places by name (Goals is "Goals" on every tab); a goal, a
 * review, a person, a team and a Help article by their own name, with what the page does to it ("Change {goal}",
 * "Check in: {goal}", "{goal}, to print", "{goal} · {review}" in a review's walk); a Workspace section as
 * "{section} · Workspace"; something that isn't there as "Goal not found" (and so on); any other address "Page not found".
 */
export function pageName(path: string, search: string, names: PlaceNames): string {
  const sp = new URLSearchParams(search);
  const mod = names.module?.(path);
  if (mod) return mod;
  if (FIXED[path]) return FIXED[path]!;
  const m = (re: RegExp) => re.exec(path)?.slice(1).map((x) => decodeURIComponent(x));
  let x: string[] | undefined;
  if ((x = m(/^\/goals\/new\/([^/]+)$/))) return NEW_GOAL_STEPS.find((st) => st.slug === x![0])?.title ?? 'New goal';
  if ((x = m(/^\/goals\/([^/]+)(\/edit|\/print)?$/))) {
    const t = names.goal(x[0]!);
    if (!t) return 'Goal not found';
    if (x[1] === '/edit') return `Change ${t}`;
    if (x[1] === '/print') return `${t}, to print`;
    const r = sp.get('review');
    const rn = r ? names.review(r) : null;
    return rn ? `${t} · ${rn}` : t;
  }
  if ((x = m(/^\/check-in\/([^/]+)(?:\/[^/]+)?$/))) { const t = names.goal(x[0]!); return t ? `Check in: ${t}` : 'Goal not found'; }
  if ((x = m(/^\/retro\/([^/]+)$/))) { const t = names.goal(x[0]!); return t ? `Wrap up: ${t}` : 'Goal not found'; }
  if (path === '/retro') { const c = names.cycle?.(); return c ? `Wrap up ${c}` : 'Wrap up'; }
  if ((x = m(/^\/reviews\/([^/]+)(\/edit|\/summary|\/print)?$/))) {
    const r = names.review(x[0]!);
    if (!r) return 'Review not found';
    return x[1] === '/edit' ? `Change ${r}` : x[1] === '/summary' ? `${r}: summary` : x[1] === '/print' ? `${r}, to print` : r;
  }
  if ((x = m(/^\/people\/([^/]+)$/))) return names.person(x[0]!) ?? 'Person not found';
  if ((x = m(/^\/teams\/([^/]+)$/))) return names.team(x[0]!) ?? 'Team not found';
  if ((x = m(/^\/help\/([^/]+)$/))) return names.article(x[0]!) ?? 'Help';
  if (path.split('?')[0] === '/workspace/cycles/next') return 'Start the next year · Workspace';
  if ((x = m(/^\/workspace\/([^/]+)$/))) { const s = names.section?.(x[0]!); return s ? `${s} · Workspace` : 'Workspace'; }
  return 'Page not found';
}

/** Where a Back link leads, said the way the menu says it: "Reviews", "Lead time for changes", "your goals". */
export function placeName(path: string, names: PlaceNames): string {
  const [p = '/', q = ''] = path.split('?');
  const sp = new URLSearchParams(q);
  const review = sp.get('review');
  if (review && p.startsWith('/goals/')) return names.review(review) ?? 'the review';
  const scope = sp.get('scope') ?? sp.get('show');
  if (p === '/goals') return names.view(sp) ?? (scope === 'mine' ? 'your goals' : scope === 'watching' ? 'Watching' : 'Goals');
  if (p === '/watching') return 'Watching';
  const name = pageName(p, q, names);
  return /not found$/.test(name) ? 'the last page' : name;
}

/** A place's first page: no Back link there (navigation spec, 2.5). */
export const FIRST_PAGES = ['/', '/check-in', '/goals', '/watching', '/reviews', '/people', '/teams', '/activity', '/data', '/workspace', '/settings', '/help', '/feedback'];

/**
 * Forms (navigation spec, 2.5 item 3): a goal's check-in and the walk Home starts, the table check-in, New goal and its
 * steps, goal edit, set-up, a review's set-up and edit, a goal's wrap-up, and the import. Check-in's list is a first page
 * (NV3), not a form. A form is drawn in focus mode, and Back passes through it, never to it (it has its one closing
 * control instead). The Shell and the back link both ask here.
 */
export const FORM = /^\/(check-in\/[^/]+|quick-check-in|data\/import|workspace\/new)(\/|$)|^\/goals\/new(\/|$)|^\/goals\/[^/]+\/edit$|^\/reviews\/(new|[^/]+\/edit)$|^\/retro\/[^/]+$/;

/** Does a route's pattern (`/metrics/:metricId/edit`) match this path? */
const matches = (pattern: string, path: string) => new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}/?$`).test(path);

/**
 * Is this address a form? `path` may carry its query, or the query may be given apart. `forms` are the patterns of the
 * modules' pages drawn in focus mode (`focus: true`): a form as much as the core's (build review of #282).
 */
export function isForm(path: string, search = '', forms: readonly string[] = []): boolean {
  const [p = '', q = ''] = path.split('?');
  if (FORM.test(p) || forms.some((f) => matches(f, p))) return true;
  return p === '/check-in' && new URLSearchParams(search || q).get('start') === '1';
}

/** What a Back link says and does: go back `steps` entries in the tab (0: open `to` instead). */
export interface BackTo { label: string; to: string; steps: number }

/** Earlier pages of this tab, oldest first, up to and including this one. */
export type Trail = { path: string }[];

/**
 * Rule 4. The back link: none on a place's first page (or a module's) nor on a form, which has its closing control; else the last earlier page in this tab that isn't
 * a form and isn't this page (a goal walked in a review counts as the review's walk, so its other goals are stepped
 * over), named by rule 2 in the navigation's words, `steps` back; else the page's parent: the goal it feeds or Goals for
 * a goal, the goal for its print page, the review for a goal in its walk and for its summary, Reviews for a
 * review, People or Teams, Help for an article and What's new, Workspace for a section.
 */
export function backTo(path: string, search: string, trail: Trail, names: PlaceNames, firsts: string[] = [], forms: readonly string[] = []): BackTo | null {
  // A form has its one closing control instead (navigation spec 2.5: goal edit's second exit is removed).
  if (isForm(path, search, forms) || FIRST_PAGES.includes(path) || firsts.includes(path)) return null;
  const review = new URLSearchParams(search).get('review');
  const goal = /^\/goals\/([^/]+)$/.exec(path)?.[1];
  const same = (p: string) => {
    const [pp = '', q = ''] = p.split('?');
    if (pp === path) return true;
    return !!review && /^\/goals\/[^/]+$/.test(pp) && new URLSearchParams(q).get('review') === review;
  };
  const now = trail.length - 1;
  let j = now - 1;
  while (j >= 0 && (isForm(trail[j]!.path, '', forms) || same(trail[j]!.path))) j--;
  if (j >= 0) return { label: placeName(trail[j]!.path, names), to: trail[j]!.path, steps: now - j };
  const up = (to: string, label: string | null, fallback: string): BackTo => ({ label: label ?? fallback, to, steps: 0 });
  if (goal && review) return up(`/reviews/${review}`, names.review(review), 'the review');
  if (goal) { const parent = names.parent?.(decodeURIComponent(goal)); return parent ? up(`/goals/${parent}`, names.goal(parent), 'Goals') : up('/goals', 'Goals', 'Goals'); }
  let x: RegExpExecArray | null;
  if ((x = /^\/goals\/([^/]+)\/print$/.exec(path))) return up(`/goals/${x[1]}`, names.goal(decodeURIComponent(x[1]!)), 'the goal');
  if ((x = /^\/reviews\/([^/]+)\/(summary|print)$/.exec(path))) return up(`/reviews/${x[1]}`, names.review(decodeURIComponent(x[1]!)), 'the review');
  if (/^\/reviews\/[^/]+$/.test(path)) return up('/reviews', 'Reviews', 'Reviews');
  if (/^\/people\/[^/]+$/.test(path)) return up('/people', 'People', 'People');
  if (/^\/teams\/[^/]+$/.test(path)) return up('/teams', 'Teams', 'Teams');
  if (/^\/help\/[^/]+$/.test(path) || path === '/whats-new') return up('/help', 'Help', 'Help');
  if (/^\/retro\/[^/]+$/.test(path)) return up('/retro', names.cycle?.() ? `Wrap up ${names.cycle!()}` : 'Wrap up', 'Wrap up');
  if (/^\/workspace\/[^/]+$/.test(path)) return up('/workspace', 'Workspace', 'Workspace');
  // A module's page under its first page (a metric under Metrics).
  const first = firsts.find((f) => path.startsWith(f + '/'));
  if (first) return up(first, pageName(first, '', names), 'the last page');
  return up('/', 'Home', 'Home');
}
