/* The row half of R1's two admin exceptions (Lane, 13 Nov; backlog AD): goalRights mayPostCheckIn says which doors
   an admin may use for someone else's check-in; this says which rows they are for. Apart from goalRights so that only
   the change engine (lazy) carries it, not the first download. The import, Data's tables and the AI tools all ask it
   through the engine. Pure. */
import { mayPostCheckIn } from './goalRights';
import type { Goal, Person } from './types';
import type { Via } from './via';

/** What a check-in row is: its week, this week, and whether a check-in is already there. */
export interface CheckInRow { week: number; thisWeek: number; exists: boolean }

/**
 * Whether `actor` may post or correct this check-in row on `goal`. The owner always; an admin at one of the two doors
 * only for what it is for: a workbook brings in past weeks or corrects a check-in that is there, never this week's new
 * one (one pasted row on Import is no history); Data's tables correct a check-in that exists, never add one.
 */
export function mayPostCheckInRow(actor: Pick<Person, 'id' | 'admin'>, goal: Pick<Goal, 'ownerId'>, via: Via, row: CheckInRow): boolean {
  if (goal.ownerId === actor.id) return true;
  return mayPostCheckIn(actor, goal, via) && (row.exists || (via !== 'table' && row.week < row.thisWeek));
}

/** Why an admin's row is refused at one of the two doors, in the words the import and the tools say. */
export const ADMIN_DOOR_LIMIT = (via: Via) => (via === 'table' ? 'Data’s tables correct a check-in; they don’t add one.' : 'A workbook brings in past weeks, not this week’s new check-in.');
