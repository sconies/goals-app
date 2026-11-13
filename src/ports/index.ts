/* The outside parts (backlog 8c): every dependency on the world outside Faro's own code sits behind one of these
   interfaces, and each has a contract test any replacement must pass (src/ports/contracts/). To move Faro onto another
   platform, write an adapter for each part you swap and run its contract on it (spec/rebuild/adapters.md).

   | Part              | Interface        | Adapters today                                                           |
   | The goals store   | Store            | browser (data/store.ts), Supabase, plain Postgres (src/adapters/)       |
   |                   |                  | (ports/store.ts; the demo's example plumbing is the browser store's)     |
   | Markups           | MarkupStore      | Supabase (adapters/supabase/markups.ts), this browser (markup/backend)  |
   | Feedback          | FeedbackStore    | Supabase (adapters/supabase/feedback.ts), this browser (markup/feedback)|
   | Who is viewing    | Identity         | the "Who are you?" picker (adapters/local.ts); your sign-in replaces it |
   | The time          | Clock            | the system clock, or one fixed for the demo and the evals               |
   | Files             | Files            | Supabase Storage (adapters/supabase/files.ts), memory (adapters/local)  |
   | Finding things    | Search           | over the loaded workspace (adapters/localSearch.ts); a server's search  |
   | Goal lists, counts| Goals            | over the loaded workspace (adapters/localGoals.ts); a server's queries  |
   | Small preferences | Prefs            | this browser (adapters/local.ts); later, the server                      |

   A module's own outside part is the module's, not the core's: the metric library's number source (`NumberSource`) is
   declared in src/modules/metrics/source.ts, with its contract beside it (module map, F9).

   Supabase is imported only by src/adapters/supabase/ (the layers lint, rule 4). */

export type { Store } from './store';
export type { Goals, GoalAsk, GoalPage, GoalCounts, GoalRow } from './goals';
export type { MarkupStore } from '../markup/ops';
export type { FeedbackStore } from '../markup/feedback';

/** Who is using the app, per workspace. In the demo, a picker ("Who are you?") remembered in this browser; on a company
    platform, the person signed in, matched to a person record by their email (spec/requirements/internal R1, rule 2;
    R2). Passed to the app beside the store (src/main.tsx). Outside the demo, nobody means nothing can be saved: the app
    never acts as a stand-in. */
export interface Identity {
  /** The person's id in this workspace; null when nobody is signed in (or, in the demo, nobody has been chosen), or the
      person signed in matches no one in it. Asynchronous: a sign-in is asked, not remembered. */
  current(workspaceId: string): Promise<string | null>;
  /** Only on the demo's picker: says who is using it. A real sign-in has none, since who you are is not a choice. */
  choose?(workspaceId: string, personId: string): void;
  /** Why `current` said nobody, when it can tell (a sign-in can): the page that turns someone away says so, and how to
      get in. Null when `current` names someone. */
  why?(workspaceId: string): Promise<NoEntry | null>;
}

/** Why a sign-in opens no one in a workspace: not signed in; no one there has the email; more than one person has it;
    or the only ones who have it are marked as left or removed. With the email signed in with, where there is one. */
export interface NoEntry {
  reason: 'signed-out' | 'no-one' | 'shared' | 'left';
  email?: string;
}

/** The demo's picker: an Identity that can be told who is using it. */
export type Picker = Identity & { choose(workspaceId: string, personId: string): void };

/** The time, as the app should see it: the system's, or a fixed one for the demo and the evals. */
export type Clock = () => Date;

/** Somewhere to keep files by path (markup pictures: markups/<id>/<name>). A file is added once and never replaced. */
export interface Files {
  /** Adds a file. Refuses a path that already has one. */
  put(path: string, data: Blob, type: string): Promise<void>;
  /** An address the browser can open it at; null when there's no such file, or no way to make one. */
  url(path: string): Promise<string | null>;
  /** The file itself; null when there's no such file. */
  bytes(path: string): Promise<Uint8Array | null>;
}

export type { Search, SearchKind, SearchAsk, SearchAnswer, FoundRow } from './search';
export type { Prefs } from './prefs';
