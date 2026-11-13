/* Rule 4's close names and the words for a direction (spec 2.2): kept apart from the library's rules so saving a metric
   (rulesSave.ts) loads them without the library's reads. Passed on by rulesLibrary.ts. */
import { fold } from '../../domain/fold';
import type { Metric, MetricDirection } from './types';

/** "lower is better" / "higher is better". */
export const directionWords = (d: MetricDirection) => (d === 'lower' ? 'lower is better' : 'higher is better');

/** Words that say little about which number a metric is: left out when names are compared (rule 4). */
const FILLER = new Set(['the', 'of', 'per', 'for', 'in', 'a', 'rate', 'time']);
/** A name's words for rule 4: lower case, without accents, punctuation, anything in brackets, or filler. */
export const nameWords = (name: string) => new Set(fold(name.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')).split(/[^\p{L}\p{N}%]+/u).filter((w) => w && !FILLER.has(w)));

/**
 * Rule 4. Up to two metrics in use whose names are close to `name`, closest first: one name's words contain the
 * other's, or they share at least two words and differ by at most one. An exact match (any case) is metricProblems'
 * error, not this; nor is a metric being changed (`except`).
 */
export function closeNames(name: string, metrics: readonly Metric[], except?: string): Metric[] {
  const mine = nameWords(name);
  if (!mine.size) return [];
  const scored: { m: Metric; d: number }[] = [];
  for (const m of metrics) {
    if (m.removedAt || m.id === except || fold(m.name.trim()) === fold(name.trim())) continue;
    const theirs = nameWords(m.name);
    if (!theirs.size) continue;
    const shared = [...mine].filter((w) => theirs.has(w)).length;
    const extra = mine.size + theirs.size - 2 * shared;
    const contained = shared === Math.min(mine.size, theirs.size);
    if (contained || (shared >= 2 && extra <= 1)) scored.push({ m, d: extra });
  }
  return scored.sort((a, b) => a.d - b.d || fold(a.m.name).localeCompare(fold(b.m.name))).slice(0, 2).map((x) => x.m);
}
