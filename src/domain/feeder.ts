/* The words a goal row and a goal page share for counting goals: kept apart from goalPage.ts and summaryFacts.ts so
   Home's rows don't download either on a first visit (backlog FD). */

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** "two", "three" … for small counts in a sentence; digits from 11. */
export const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);

/** The two ways feeders are counted, always labelled, so a goal page and a list card never look contradictory. */
export const FEEDER_SCOPE = { direct: 'Directly feeding it', tree: 'Everything under it' } as const;
/** "Directly feeding it (four goals)", "Everything under it (16 goals)". */
export const feederHead = (scope: keyof typeof FEEDER_SCOPE, n: number) => `${FEEDER_SCOPE[scope]} (${n === 1 ? 'one goal' : `${countWord(n)} goals`})`;
