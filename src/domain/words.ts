/* The words for records that were removed, archived or ended, said the same way everywhere (the app, the exports and
   the AI assistant). Release 2 gathers the rest of the app's vocabulary; until then these live here, once. */

/** A person who has left the workspace. */
export const LEFT = 'Left';
/** A goal stopped before the end of its cycle. */
export const STOPPED = 'Stopped';
/** A review that has ended. */
export const ENDED = 'Ended';
/** Anything deleted, while it can still be restored. */
export const REMOVED = 'Removed';
/** What a thread shows where a comment was. */
export const COMMENT_REMOVED = 'Comment removed';
/** What a review's record shows where a note was. */
export const NOTE_REMOVED = 'Note removed';
/** Beside words corrected after they were posted. */
export const EDITED = 'edited';

/** A person who left, as history names them: "Maya Patel (left)". */
export const leftName = (name: string) => `${name} (left)`;

/** How long a removed record is listed under Recently removed, in days. The row itself stays for good. */
export const RESTORE_DAYS = 30;
/** How long a removal's Undo stays on screen, in milliseconds. */
export const UNDO_MS = 10_000;
/** A stopped goal's reason is at least a short sentence. */
export const MIN_STOP_REASON = 10;
