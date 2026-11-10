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
import { MODULES, modulesOn } from './registry';
import type { PlaceName } from './module';

/** What each place on a core screen gives the module that fills it. */
export interface PlaceProps {
  /** Home, after its own blocks. */
  'home.blocks': Record<never, never>;
  /** A goal's page, after its own sections. */
  'goal.sections': { goal: Goal };
  /** Data's toolbar, after Columns and Saved layouts. `asShown` is the open table exactly as laid out. */
  'data.tools': { table: string; asShown: () => { rows: Cell[][]; muted?: string[]; scope: string } };
  /** Goals' view bar, after the layouts: the goals shown now. On a phone it's in the Views menu instead (`inMenu`). */
  'goals.tools': { goals: Goal[]; viewName: string; inMenu?: boolean };
  /**
   * New goal and goal edit, with the goal's own fields: what measures the goal (backlog 0b). Given the goal as saved
   * (null while it's new) and the form's kind, unit and team as typed. `onChange` says what to save with it: a metric and
   * a slice, null for none, or undefined to leave it as it is. The form saves it after the goal (app.linkGoalMetric or
   * app.unlinkGoalMetric). Nothing renders here unless a module fills it.
   */
  'goal.measure': { goal: Goal | null; kind: GoalKind; unit: string; teamId: string; onChange: (pick: MeasurePick | null | undefined) => void };
  /** A person's page in People, after their facts: what the module knows about them (the metrics they own, say). */
  'people.person': { person: Person };
  /** A team's page in People, after its people: what the module knows about the team. */
  'people.team': { team: Team };
}

/** What a goal form saves after the goal, from the goal.measure place: a metric, for a team or the whole company (null). */
export interface MeasurePick { metricId: string; teamId: string | null }

export interface ModuleRoute {
  /** As React Router writes it; listed in the module's module.json too, and each has a Help article. */
  path: string;
  element: ReactNode;
  /** A focused task: the page takes the screen without the sidebar's distractions, as check-in does (ui/Shell). */
  focus?: boolean;
  /** The page's name in the phone's top bar. */
  title?: string;
}

export interface ModuleNav {
  id: string;
  to: string;
  label: string;
  icon: ReactNode;
}

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
