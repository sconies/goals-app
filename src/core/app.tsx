/* Feature modules, on screen (docs/architecture.md). A module's app.tsx default-exports an AppModule: the routes it
   adds, the navigation items, and what it puts in the named places on core screens. The core asks for them here and
   gets only the modules that are on in the open workspace (src/core/registry.ts), so a module that's switched off,
   or left out of the build, has no route, no navigation item and nothing in any place. */
import { useMemo, type ComponentType, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import APP from 'virtual:faro-modules/app';
import { useApp } from '../app/state';
import type { Cell } from '../domain/export';
import type { Goal, GoalKind, Person, Snapshot, Team } from '../domain/types';
import type { WorkspaceNeed } from '../domain/workspaceAttention';
import type { NavGroup } from '../domain/navigation';
import { addColumnParams, type QueryContext, type QueryNames } from '../domain/query';
import type { Finder } from '../adapters/localSearch';
import { MODULES, modulesOn } from './registry';
import type { PlaceName } from './module';

/** What each place on a core screen gives the module that fills it. */
export interface PlaceProps {
  /** Home, after its own blocks. */
  'home.blocks': Record<never, never>;
  /** A goal's summary, one line under its owner and level: a fact about the goal, such as what measures it (goal spec, section 5). */
  'goal.facts': { goal: Goal };
  /** A goal's page, inside About this goal, after its facts (goal spec, 5: a module's block is about the goal, not a section of the page). */
  'goal.sections': { goal: Goal };
  /** Data's toolbar, after Columns and Saved layouts. `asShown` is the open table exactly as laid out. */
  'data.tools': { table: string; asShown: () => { rows: Cell[][]; muted?: string[]; scope: string } };
  /** Goals' Views menu (the View sheet on a phone), after Copy link: the goals shown now. Always drawn as an item there (`inMenu` is always true since GL2). */
  'goals.tools': { goals: Goal[]; viewName: string; inMenu?: boolean };
  /**
   * New goal and goal edit, with the goal's own fields: what measures the goal (backlog 0b). Given the goal as saved
   * (null while it's new) and the form's kind, unit and team as typed. `onChange` says what to save with it: one of the
   * module's own actions and its input for the goal as saved (measured by a metric, say, or no longer), or undefined to
   * leave it as it is. The form runs it after the goal (app.run). Nothing renders here unless a module fills it.
   */
  'goal.measure': {
    goal: Goal | null; kind: GoalKind; unit: string; decimals: string; teamId: string;
    /** On a new goal: the form's unit and decimals are still its own defaults (nobody has typed them). */
    untouched?: boolean;
    onChange: (pick: MeasurePick | undefined) => void;
    /** Sets the form's unit and decimals from what's chosen, and whether their fields show (hidden: said in one line instead). */
    fill?: (f: { unit: string; decimals: string; hidden: boolean }) => void;
    /** Whether the person chose "No metric": the form then asks how it's measured in its own words. */
    onNone?: (none: boolean) => void;
  };
  /** A person's page in People, after their facts: what the module knows about them (the metrics they own, say). */
  'people.person': { person: Person };
  /** A team's page in People, after its people: what the module knows about the team. */
  'people.team': { team: Team };
  /** A Help article, under its title and before its sections: given the article's id, so a module draws only in its own article (the spreadsheets module's field table in `columns`). */
  'help.article': { article: string };
}

/** What a goal form saves after the goal, from the goal.measure place: a module's action (app.run, AS part 2), with its
    input for the goal as saved. The core names no module's records or actions. */
export interface MeasurePick {
  action: string;
  input: (goal: Goal) => unknown;
  /** The choice in words, for New goal's Check ("Measured by Lead time for changes, for CI/CD."). */
  says?: string;
  /** Why it can't be saved with the goal as typed (a unit that differs): the form stops on its step and says so. */
  blocks?: string;
  /** What measures it, for goal entry's questions (rule 3's wrong-side): its name and which way is better. */
  metric?: { name: string; direction: 'lower' | 'higher' };
}

export interface ModuleRoute {
  /** As React Router writes it; listed in the module's module.json too, and each has a Help article. */
  path: string;
  element: ReactNode;
  /** A focused task: the page takes the screen without the sidebar's distractions, as check-in does (ui/Shell). */
  focus?: boolean;
  /** The page's name in the phone's top bar, when it is always the same. */
  title?: string;
  /** The page's name from its thing (a metric's own name), for the top bar, the browser's title and "Opened lately". */
  name?: (params: Record<string, string | undefined>, reads: PageReads) => string | null;
}

/** What a page's name may read: names by id. */
export interface PageReads { goal(id: string): Goal | undefined; person(id: string): Person | undefined; team(id: string): Team | undefined }

export interface ModuleNav {
  id: string;
  to: string;
  label: string;
  icon: ReactNode;
  /** Where it sits in the menu: your work (after Reviews) or things to look up (after Data, the default). */
  group?: NavGroup;
}

/** A kind of thing a module makes findable: in find-and-pick and Find, through the Search port (src/ports/search.ts). */
export interface ModuleFinder {
  kind: string;
  /** Its nouns: "metric", "metrics". */
  things: { thing: string; things: string };
  /** Its search over the open workspace, for the person looking: made again whenever the workspace changes. */
  search: (snapshot: Snapshot, viewer: Person, today: Date) => Finder;
  /** Where a row opens. */
  open(id: string): string;
}

/**
 * A filter a module adds to a core list, declared as data so a server can apply it (docs/design/architecture.md, 4.2):
 * a column the module adds to the list's summary rows, compared with what is picked.
 */
export interface ModuleFilter {
  list: 'goals';
  id: string;
  label: string;
  /** Its parameter in the list's address (?metric=). */
  param: string;
  /** The summary row's column it compares. */
  column: string;
  /** The kind of thing it is chosen with (find-and-pick). */
  pick: string;
  /** How the column is filled for a goal, from the open workspace: the value it holds (a metric's id), or null. */
  fill: (snapshot: Snapshot) => (goal: Goal) => string | null;
  /** The picked value in words, for the filter line ("Measured by Lead time for changes"); null when it names nothing. */
  says: (snapshot: Snapshot, value: string) => string | null;
}

// Every module filter's parameter is read from a Goals address as the core's own are (domain/query).
addColumnParams(APP.flatMap((m) => m.part.filters ?? []).map((f) => f.param));



/**
 * A section of Workspace (backlog W): its own address, /workspace/<id>, an entry in Workspace's menu (a side menu on a
 * computer, a list on a phone) and one main action. The core's sections are About (id `overview`), Cycles,
 * Access, Features, Privacy and Recently removed (src/screens/Workspace.tsx); a module adds its own here, the settings
 * extension point.
 */
export interface WorkspaceSection {
  /** Its address under /workspace: lower case, words joined by hyphens. Never changes. */
  id: string;
  /** Its name in the menu and its heading. */
  label: string;
  /** What it's for, in a line: under its name in the phone's list, and under its heading. */
  summary: string;
  /** Only admins see it in the menu; anyone else opening its address is told who the admins are. */
  admins?: boolean;
  /** Its screen. */
  element: ReactNode;
  /** The section it follows in the menu (the end, when not said). */
  after?: string;
  /** Its fact on About, and its line in the phone's "More in Workspace" (WR2): one true sentence, from what's open. */
  says?: (app: ReturnType<typeof useApp>) => string;
  /** What an admin has to sort out about it, added to About's "To sort out" after the core's (WR2). */
  needs?: (snapshot: Snapshot, viewer: Person) => WorkspaceNeed[];
}

/** A module's screens and where they go: its app.tsx's default export. */
export interface AppModule {
  routes?: ModuleRoute[];
  /** Sidebar items, placed after the core's (before New goal). */
  navigation?: ModuleNav[];
  places?: { [K in PlaceName]?: ComponentType<PlaceProps[K]> };
  /** Workspace sections (module.json `sections`, by id). */
  sections?: WorkspaceSection[];
  /** Kinds it makes findable (module.json `finders`, by kind). */
  finders?: ModuleFinder[];
  /** Filters it adds to core lists (module.json `filters`, by id). */
  filters?: ModuleFilter[];
  /** What it raises on About's "To sort out" without a Workspace section of its own (module.json `toSortOut`, AR2):
      the same shape a section's `needs` gives. */
  toSortOut?: (snapshot: Snapshot, viewer: Person) => WorkspaceNeed[];
}

/** The modules on in the open workspace: their facts and screens, and why the others are off. */
export function useModules() {
  const app = useApp();
  const off = app.ws.modulesOff;
  return useMemo(() => {
    const r = modulesOn({ modulesOff: off });
    return {
      on: r.on,
      off: r.off,
      /** Every module this build has, on or not. */
      installed: MODULES,
      /** The screens of the modules that are on. */
      screens: APP.filter((m) => r.on.has(m.id)).map((m) => ({ id: m.id, ...m.part })),
      /** Old addresses that lead to a module's route (module.json `redirects`). */
      redirects: MODULES.filter((m) => r.on.has(m.id)).flatMap((m) => m.redirects),
    };
  }, [off]);
}

/** The filters of the modules that are on, for Goals: each column by its parameter, and its words for the filter line. */
export function useGoalColumns(): { columns: NonNullable<QueryContext['columns']>; col: NonNullable<QueryNames['col']>; filters: ModuleFilter[] } {
  const { screens } = useModules();
  const app = useApp();
  return useMemo(() => {
    const filters = screens.flatMap((m) => m.filters ?? []).filter((f) => f.list === 'goals');
    return {
      filters,
      columns: Object.fromEntries(filters.map((f) => [f.param, f.fill(app.snapshot)])),
      col: (param, value) => { const f = filters.find((x) => x.param === param); const v = f?.says(app.snapshot, value); return f && v ? { label: f.label, value: v } : null; },
    };
  }, [screens, app.snapshot]);
}

/** Whatever the modules that are on put in one place on a core screen, in module order. */
export function Place<K extends PlaceName>({ name, ...props }: { name: K } & PlaceProps[K]) {
  const { screens } = useModules();
  return (
    <>
      {screens.map((m) => {
        const C = m.places?.[name] as ComponentType<PlaceProps[K]> | undefined;
        return C ? <C key={m.id} {...(props as unknown as PlaceProps[K])} /> : null;
      })}
    </>
  );
}

/** Whether any module that's on fills a place: so a core screen can leave out a heading with nothing under it. */
export function useFilled(name: PlaceName) {
  return useModules().screens.some((m) => !!m.places?.[name]);
}

/** An old address that moved into a module: on to the new one, keeping the query. */
export function Moved({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={to + search + hash} replace />;
}
