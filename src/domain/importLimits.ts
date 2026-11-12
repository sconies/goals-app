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
/** Rows drawn at a time: the changes list and a group's rows show this many, then "Show 50 more". */
export const PAGE = 50;

/** A count as people read it: 5,000. */
export const count = (n: number) => n.toLocaleString('en-GB');

/** Import's limit line (spec 2.1). */
export const limitLine = () => `Up to ${count(ROWS_COMFORT)} rows a file.`;

/** Why a file is refused for its size (spec 2.1): too many rows, or too many bytes. */
export function tooLarge(name: string, got: { rows?: number; bytes?: number }): string | null {
  if (got.bytes != null && got.bytes > BYTES_READ_MAX) return `${name} is larger than 20 MB. Faro reads up to ${count(ROWS_READ_MAX)} rows in one file. Split it and import each part.`;
  if (got.rows != null && got.rows > ROWS_READ_MAX) return `${name} has ${count(got.rows)} rows. Faro reads up to ${count(ROWS_READ_MAX)} in one file. Split it and import each part.`;
  return null;
}
