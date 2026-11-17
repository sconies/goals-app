/* One form footer (UX2b; docs/design/patterns/spec.md section 3; requirement FORM-FOOTER): the words a form's footer
   and its one exit say. Pure. The screens draw them with FormFooter and FormClose (src/ui). */

/** A form that keeps drafts, once something is typed. */
export const KEEP = 'Close and keep the draft';
/** A form that keeps nothing: it asks first when something was typed. */
export const DISCARD = 'Close without saving';
/** A form that keeps drafts, before anything is typed: there is no draft yet to keep. */
export const CLOSE = 'Close';

/** The one exit's words, top right (navigation spec 2.5; Lane, 17 Nov: "Close" until something is typed). */
export const closeWords = (keepsDrafts: boolean, typed: boolean): string => (keepsDrafts ? (typed ? KEEP : CLOSE) : DISCARD);

/** Labels a primary may never have alone: they don't say what happens. */
export const VAGUE_PRIMARY = ['Continue', 'Submit', 'OK', 'Save'];
/** Whether a primary's label says what happens: a verb and an object, or the next step by name. */
export const primarySays = (label: string): boolean => !VAGUE_PRIMARY.some((v) => label.trim().toLowerCase() === v.toLowerCase());

/** A step's primary names the next step: "Next: why it’s behind". */
export const nextLabel = (step: string): string => `Next: ${step}`;

/** The check-in's next step, by what it will ask. `null` before the number says which comes next. */
export function checkInNext(next: 'carry' | 'account' | null, account: { why: boolean; reason?: 'ahead' | 'behind' | null; milestone: boolean }): string {
  if (next === 'carry') return nextLabel('what you said last time');
  if (next === 'account') return nextLabel(!account.why ? 'what changes' : account.reason === 'ahead' ? 'why it’s ahead' : account.milestone ? 'why it’s late' : 'why it’s behind');
  return 'Next';
}

/** The check-in's status line on its last step: on record for the week, and who sees it. */
export const checkInPostSays = (week: number, watchers: number): string =>
  `Goes on record for week ${week}.${watchers ? ` The ${watchers === 1 ? 'person' : `${watchers} people`} watching see${watchers === 1 ? 's' : ''} it on Home.` : ''}`;

/** The status line with errors: a summary only when it helps (two or more, or one out of view); else nothing. */
export function fixSummary(fields: string[], oneInView = true): string | null {
  if (!fields.length || (fields.length === 1 && oneInView)) return null;
  return `${fields.length === 1 ? '1 thing' : `${fields.length} things`} to fix: ${fields.join(', ')}`;
}

/** The table check-in: "Post 5 check-ins", and its status line "5 ready. 2 need a reason before they can post." */
export const postCheckIns = (ready: number): string => (ready ? `Post ${ready} ${ready === 1 ? 'check-in' : 'check-ins'}` : 'Post check-ins');
export const tableSays = (ready: number, needReason: number): string =>
  [`${ready} ready.`, needReason ? `${needReason} ${needReason === 1 ? 'needs' : 'need'} a reason before ${needReason === 1 ? 'it' : 'they'} can post.` : ''].filter(Boolean).join(' ');
