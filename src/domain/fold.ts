/* Text folded for comparing: lower case, accents gone. Find's rule 1 (find.ts) and the metric library's parts
   (modules/metrics/rulesParts.ts) both use it; it lives on its own so a rule that needs only this imports nothing else. */

/** Lower case, accents gone: "Lucía" reads as "lucia". */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
