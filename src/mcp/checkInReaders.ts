/* A feature module's part in the core's post_check_in (NR rule 3): reading a goal's number from where it comes from.
   The core names no metric and no source, so a module that has them registers a reader here from its tools.ts (the
   metric module's ./modules/metrics/tools.ts). post_check_in asks it only when the call says `reading_confirmed` or
   `different_because`; without them nothing is read or recorded, as with the import. With the module switched off in
   the workspace, the tool says the module-off sentence instead. */
import type { CheckInReading, Goal, ReadingWhyKind } from '../domain/types';
import type { McpContext } from './tools';

export interface CheckInReader {
  /** The module it is from: its switch decides whether it answers. */
  module: string;
  /**
   * What the goal's source says now, as the check-in would record it: `value` is the owner's number (left out, the
   * reading's, when they confirm it); `why` is why it differs. A null reading records nothing, and `says` tells the
   * assistant why (no source, too old, no number yet).
   */
  read(ctx: McpContext, goal: Goal, ask: { value: number | null; confirmed: boolean; why?: { kind: ReadingWhyKind; text?: string } }): Promise<{ reading: CheckInReading | null; says?: string }>;
}

const READERS: CheckInReader[] = [];

/** Registers a module's reader, once. */
export function addCheckInReader(r: CheckInReader) {
  if (!READERS.some((x) => x.module === r.module)) READERS.push(r);
}

/** The readers registered by the modules in this build. */
export const checkInReaders = (): readonly CheckInReader[] => READERS;
