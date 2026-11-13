/* How many single-character edits apart two strings are: shared by rule 6's close names (rulesDefine.ts) and rule 7's
   close parts (rulesParts.ts), and kept apart from both so rule 7, which linking needs on a first visit, stays small. */

/** Edits (insert, delete, change one character) between two strings, stopping once past `max`. */
export function editsBetween(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let least = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      row.push(v);
      if (v < least) least = v;
    }
    if (least > max) return max + 1;
    prev = row;
  }
  return prev[b.length]!;
}
