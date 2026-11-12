/* The port contracts as data (handoff kit review, gap 1(b)): each contract is a list of cases, each case a `given` and
   one or more steps of `when` (an operation and its arguments) and `then` (what the answer must be). The vitest
   contracts in src/ports/contracts run these lists on Faro's adapters; `npm run spec` writes each to
   spec/conformance/contracts/<port>.json; and the drill harness (scripts/drill.mjs, `runContract`) runs them on any
   build through a shim that answers one JSON request per line. The checks themselves live once, in the harness. */

/** What an answer must be. Every key given must hold; `select` first picks the part of the answer the rest look at. */
export interface Then {
  /** A path into the answer: `total`, `rows[0].name`, `rows[].id` (every row's id), `[].id` when the answer is a list. */
  select?: string;
  /** Equal, as JSON: same keys, same values, lists in the same order. */
  equals?: unknown;
  /** Has at least these: an object's keys (others may be there too), a list's items one for one, as deep as given. */
  has?: unknown;
  /** A list holding each of these (as JSON), anywhere in it. */
  includes?: unknown[];
  /** A list holding none of these. */
  excludes?: unknown[];
  /** A list or text this long. */
  length?: number;
  /** A list or text no longer than this. */
  maxLength?: number;
  /** A list with no item twice. */
  distinct?: boolean;
  /** A list in this order: `text` (A to Z, by the language's own order), or by rank, highest first (ties in any order). */
  ordered?: 'text' | { rank: Record<string, number> };
  /** The operation refuses: the shim answers an error, whatever its words. */
  throws?: boolean;
  /** Nothing there: the key is left out of the answer, or is null. */
  absent?: boolean;
  /** Every one of these holds. */
  all?: Then[];
  /** At least one of these holds: where the contract allows either of two answers (the near miss is optional). */
  anyOf?: Then[];
}

export interface When {
  /** The port's operation, by its name in the port (`search`, `byIds`, `get`, …). */
  op: string;
  /** Its arguments, in order. */
  args?: unknown[];
}

/**
 * One step. With `pages`, the operation is called again with the last answer's `next` put in as `after` (in the
 * argument at `pages.arg`), until `next` is null or `pages.max` calls; `each` is checked on every answer, and `then` on
 * `{ pages, rows }`: how many calls were made and every page's rows, in order.
 */
export interface Step {
  when: When;
  then: Then;
  pages?: { arg: number; max: number; each?: Then };
}

export interface Case {
  /** A sentence: what any build must do. */
  name: string;
  /** Overrides the contract's `given` for this case. */
  given?: unknown;
  steps: Step[];
}

export interface Contract {
  /** The port, as a shim names it. */
  port: string;
  /** What the port is for and how a shim takes `given`: Markdown, one paragraph. */
  about: string;
  /** The operations a shim answers, each with what it does. */
  ops: Record<string, string>;
  /** What each case starts from, unless it says otherwise: the shim makes a fresh port from it. */
  given: unknown;
  cases: Case[];
}
