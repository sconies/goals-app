/* The import's size limits (import spec 2.8; backlog IM6), said once: Import's limit line and its errors, the preview's
   paging and the size checks read them, and so does the spec. Faro is a model that checks and saves in the browser;
   at the internal app's size an import is a server-side job (requirement IMPORT-LARGE, R-L1 to R-L6). */

/** Rows a file can have and still be comfortable: what Import's limit line promises. */
export const ROWS_COMFORT = 5000;
/** The most rows Faro reads from one file; more is refused, with a way through (split it). */
export const ROWS_READ_MAX = 30_000;
/** The largest file Faro reads, in bytes (20 MB). */
export const BYTES_READ_MAX = 20 * 1024 * 1024;
/** The most rows one import saves; a file that changes more is checked, not saved, and offered in parts. */
export const CHANGES_SAVE_MAX = 5000;
/** Rows the engine checks between two progress reports (rule 10), and the most a file has and is still checked at once
    on the page: a larger one is checked in the import's worker. */
export const CHUNK = 500;
/** Rows drawn at a time: the changes list and a group's rows show this many, then "Show 50 more". */
export const PAGE = 50;

/** A count as people read it: 5,000. */
export const count = (n: number) => n.toLocaleString('en-GB');

/** Import's limit line (spec 2.1): what Faro reads and what it saves at once, both true of the workbook offered beside it
    (a whole workspace's is more than ROWS_COMFORT rows, and loads back; #257 review). */
export const limitLine = () => `Up to ${count(ROWS_READ_MAX)} rows a file, and ${count(CHANGES_SAVE_MAX)} changes at a time.`;

/** Help's sentence on size (the import article): the limits as Import says them, and what is quick. */
export const limitHelp = () => `up to ${count(ROWS_READ_MAX)} rows or 20 MB a file, and ${count(CHANGES_SAVE_MAX)} changes at a time; up to ${count(ROWS_COMFORT)} rows is checked in a second or two`;

/** Why a file (or, through the AI tools, one call's rows) is refused for its size (spec 2.1): too many rows, or too many
    bytes. Every door checks it: Import, set-up's upload and the MCP tools. */
export function tooLarge(name: string, got: { rows?: number; bytes?: number }, door: 'file' | 'call' = 'file'): string | null {
  const then = door === 'file' ? 'Split it and import each part.' : 'Send them in parts.';
  if (got.bytes != null && got.bytes > BYTES_READ_MAX) return `${name} is larger than 20 MB. Faro reads up to ${count(ROWS_READ_MAX)} rows in one file. ${then}`;
  if (got.rows != null && got.rows > ROWS_READ_MAX) return `${name} has ${count(got.rows)} rows. Faro reads up to ${count(ROWS_READ_MAX)} in one ${door}. ${then}`;
  return null;
}

/** Why a change is too large to save at once (spec 2.8), or null: the preview offers it in parts; the AI tools say so. */
export const tooManyChanges = (changes: number): string | null =>
  changes > CHANGES_SAVE_MAX ? `This would change ${count(changes)} rows. Faro saves up to ${count(CHANGES_SAVE_MAX)} at a time.` : null;
