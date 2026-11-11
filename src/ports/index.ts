/* The outside parts (backlog 8c): every dependency on the world outside Faro's own code sits behind one of these
   interfaces, and each has a contract test any replacement must pass (src/ports/contracts/). To move Faro onto another
   platform, write an adapter for each part you swap and run its contract on it (spec/rebuild/adapters.md).

   | Part              | Interface        | Adapters today                                                           |
   | The goals store   | Store            | browser (data/store.ts), Supabase, plain Postgres (src/adapters/)       |
   | Markups           | MarkupStore      | Supabase (adapters/supabase/markups.ts), this browser (markup/backend)  |
   | Feedback          | FeedbackStore    | Supabase (adapters/supabase/feedback.ts), this browser (markup/feedback)|
   | Who is viewing    | Identity         | the "Who are you?" picker (adapters/local.ts); your sign-in replaces it |
   | The time          | Clock            | the system clock, or one fixed for the demo and the evals               |
   | Files             | Files            | Supabase Storage (adapters/supabase/files.ts), memory (adapters/local)  |
   | Numbers           | NumberSource     | the metric module's demo (modules/metrics/numbers.ts); yours otherwise  |
   | Finding things    | Search           | over the loaded workspace (adapters/localSearch.ts); a server's search  |
   | Small preferences | Prefs            | this browser (adapters/local.ts); later, the server                      |

   Supabase is imported only by src/adapters/supabase/ (the layers lint, rule 4). */

export type { Store } from '../data/store';
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

/** One reading of a metric, from where its numbers come from. */
export interface Reading {
  value: number;
  /** When the source measured it (an ISO time). */
  at: string;
}

/** What a number source reads of a metric: which one, and where its numbers come from. The metric library's records
    (src/modules/metrics) are a module's, not the core's, so the port names only what it reads. */
export interface SourcedMetric {
  id: string;
  /** Where its number comes from: a number source of this name reads it. */
  source: string;
  removedAt?: string | null;
}

/** Where a metric's numbers come from (a dashboard, a warehouse, a monitoring tool), so it can fill itself in. */
export interface NumberSource {
  /** Its name as a metric's `source` names it (e.g. "CI analytics"). */
  readonly name: string;
  /** Whether it can read this metric. */
  reads(metric: SourcedMetric): boolean;
  /** The latest reading at or before `at`; null when it has none yet. */
  read(metric: SourcedMetric, at: Date): Promise<Reading | null>;
}

export type { Search, SearchKind, SearchAsk, SearchAnswer, FoundRow } from './search';
export type { Prefs } from './prefs';
