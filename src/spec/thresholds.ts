/* A spec lint (handoff kit review, gap 6): one named threshold, one number. Every page of the kit that names a
   threshold in words ("on track at 95%", "stale after 14 days") must give the number in `RULES` and the other constants
   of src/domain/thresholds.ts. Run over every generated file by src/spec/spec.test.ts, so a page written by hand in a
   generator, or a rule's words in src/spec/rules.ts, can't drift from the code. */
import { RESTORE_DAYS, RULES } from '../domain/thresholds';

export interface NamedThreshold {
  name: string;
  /** The number the words must give. */
  value: number;
  /** Each pattern's first group is the number, as digits. */
  patterns: RegExp[];
  /** Turns the number as written into the threshold's unit (weeks to days, say); by pattern, defaults to as written. */
  unit?: (n: number, pattern: number) => number;
}

const pct = (x: number) => Math.round(x * 100);

export const NAMED_THRESHOLDS: NamedThreshold[] = [
  { name: 'on track (RULES.onTrack)', value: pct(RULES.onTrack), patterns: [/\bon track at (\d+) ?%/gi] },
  { name: 'at risk (RULES.atRisk)', value: pct(RULES.atRisk), patterns: [/\bat risk from (\d+) ?%/gi] },
  { name: 'well ahead (RULES.wellAhead)', value: pct(RULES.wellAhead), patterns: [/\bwell ahead at (\d+) ?%/gi] },
  {
    name: 'no recent update (RULES.staleDays)', value: RULES.staleDays,
    patterns: [/\b(?:stale|no recent update|no (?:owner )?check-in) (?:after|for) (\d+) days\b/gi, /\bno (?:owner )?check-in for (\d+) weeks or more\b/gi],
    unit: (n, p) => (p === 1 ? n * 7 : n),
  },
  { name: 'a stage off track (RULES.lateWeeksOff)', value: RULES.lateWeeksOff, patterns: [/\bmore than (\d+) weeks? late\b/gi] },
  { name: 'Recently removed (RESTORE_DAYS)', value: RESTORE_DAYS, patterns: [/\brecently removed (?:for|and can be restored for) (\d+) days\b/gi, /\b(\d+) days (?:on|under) recently removed\b/gi] },
];

/** Every place in `files` (path → text) that names a threshold with a number other than the code's. */
export function thresholdClashes(files: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [path, text] of Object.entries(files)) {
    for (const t of NAMED_THRESHOLDS) {
      t.patterns.forEach((re, i) => {
        for (const m of text.matchAll(re)) {
          const n = (t.unit ?? ((x) => x))(Number(m[1]), i);
          if (n !== t.value) out.push(`${path}: “${m[0]}” gives ${n} for ${t.name}, the code says ${t.value}`);
        }
      });
    }
  }
  return out;
}
