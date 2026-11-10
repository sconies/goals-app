/* The Prefs port (docs/design/architecture.md, 1.1: AR1): a few small values per person and workspace that aren't
   records: the things they opened lately, the Goals scope they used last, what "Getting started" has told them. Faro
   keeps them in this browser (src/adapters/local.ts, `browserPrefs`); the internal app keeps them on its server. The
   redesign's loose localStorage keys go through here instead. Its contract: src/ports/contracts/parts.ts. */

export interface Prefs {
  /** The value kept under `key` for this person in this workspace; null when there is none. */
  get<T = unknown>(workspaceId: string, personId: string, key: string): T | null;
  /** Keeps `value` (anything JSON can hold; null forgets it) for this person in this workspace only. */
  set(workspaceId: string, personId: string, key: string, value: unknown): void;
}
