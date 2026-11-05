/* What kind of failure something was, as a short class for `error.type`: never its message, which can quote what
   someone typed (a rule saying "There's already a team called …"). A rule saying no is told apart from a save that
   didn't get through, and that from a database fault. */
import { NotAllowed } from '../domain/actions';
import { isStale } from '../data/store';

export type ErrorType = 'not_allowed' | 'stale' | 'timeout' | 'network' | 'database' | 'error';

export function errorType(e: unknown): ErrorType {
  if (e instanceof NotAllowed) return 'not_allowed';
  if (isStale(e)) return 'stale';
  const msg = e instanceof Error ? e.message : String(e);
  // A rule in the app itself (a goal that would feed into itself) says no before saving.
  if (msg === 'loop') return 'not_allowed';
  if (/did not answer in time|AbortError|aborted/i.test(msg) || (e instanceof Error && e.name === 'AbortError')) return 'timeout';
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return 'network';
  if (/^(Saving|Creating|Deleting|Removing|Renaming|Logging|Adding|Sending|Watching|Stopping|Unlinking|Setting)\b|okr_|violates|constraint|PGRST|permission denied/i.test(msg)) return 'database';
  return 'error';
}

/** The save outcome a failure means: a rule said no, someone else changed it first, or it didn't get through. */
export const saveOutcome = (t: ErrorType): 'refused' | 'stale' | 'failed' => (t === 'not_allowed' ? 'refused' : t === 'stale' ? 'stale' : 'failed');

/** An exception's class name, safe to record: Error, TypeError, NotAllowed… */
export const exceptionType = (e: unknown) => (e instanceof Error && /^[A-Za-z]\w{0,59}$/.test(e.name) ? (e instanceof NotAllowed ? 'NotAllowed' : e.name) : typeof e === 'object' ? 'Object' : typeof e);
