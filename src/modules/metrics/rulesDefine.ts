/* Defining a metric well (round 2, MT1; docs/design/metrics-2/spec.md rule 1): what a metric still needs to say, and the
   three questions adding or changing one may ask (a name a letter or a word from another's, a unit spelt differently from
   one in use, a percentage whose meaning doesn't say out of what). The form (Metrics.tsx), save_metric (tools.ts), the
   metric's page, get_metric and the conformance rows all call these, so they can't disagree.

   Pure: each takes only what it reads. Nothing here is a score: "Still to say" is words, never a number, and nothing may
   sort by it. A Check never stops a metric being usable; it is a question to answer once. */
import { NotAllowed } from '../../domain/actions';
import { fold } from '../../domain/find';
import { editsBetween } from './edits';
import { closeNames, directionWords } from './rulesLibrary';

export { editsBetween };
import type { Metric, MetricDirection } from './types';

/* ---------- what a metric still needs ---------- */

/** The four things that make a metric fully defined beyond its name, unit and direction, in the order they are said. */
export const STILL_TO_SAY = [
  ['what it means', 'meaning'],
  ['where the number comes from', 'source'],
  ['who owns that source', 'sourceOwner'],
  ['how often it refreshes', 'refresh'],
] as const;
export type StillItem = (typeof STILL_TO_SAY)[number][0];
/** The form field each missing item opens (`/metrics/<id>/edit?field=…`). */
export const STILL_FIELD: Record<StillItem, string> = Object.fromEntries(STILL_TO_SAY) as Record<StillItem, string>;
export const FULLY_DEFINED = 'Fully defined';
export const OWNER_LEFT = 'Its owner has left.';

export interface StillToSay { usable: true; full: boolean; missing: StillItem[]; ownerLeft: boolean; line: string }

/**
 * Rule 1. What a metric still needs to say. A metric with a name, a unit and a direction is usable; `missing` lists, in
 * order, what it means (meaning empty), where the number comes from (source empty), who owns that source (empty) and how
 * often it refreshes (not said). The line is “Fully defined” when nothing is missing and its owner is here; “Its owner
 * has left.” alone when only that; otherwise “Still to say: {missing, commas}.”, with “ Its owner has left.” after it.
 */
export function stillToSay(m: Pick<Metric, 'meaning' | 'source' | 'sourceOwner' | 'refresh'>, ownerIsHere: boolean): StillToSay {
  const empty = (k: (typeof STILL_TO_SAY)[number][1]) => (k === 'refresh' ? m.refresh == null : !(m[k] ?? '').trim());
  const missing = STILL_TO_SAY.filter(([, k]) => empty(k)).map(([w]) => w);
  const left = !ownerIsHere;
  const said = missing.length ? `Still to say: ${missing.join(', ')}.` : '';
  const line = !missing.length && !left ? FULLY_DEFINED : [said, left ? OWNER_LEFT : ''].filter(Boolean).join(' ');
  return { usable: true, full: !missing.length && !left, missing, ownerLeft: left, line };
}

/* ---------- a name close to another ---------- */

export type NameCheckKind = 'letters' | 'words' | 'former';
export interface NameCheck { kind: NameCheckKind; other: { id: string; name: string }; edits?: number }

/** A name as `letters` compares it: lower case, no accents, no punctuation, single spaces. */
const bare = (s: string) => fold(s).replace(/[^\p{L}\p{N}%]+/gu, ' ').trim();


/**
 * Rule 1. Up to two names close to `name`, closest first. **former**: `name` is a name a metric in use used to have
 * (its rename in the change log). **letters**: the two names, bared, differ by one edit for names up to 12 characters and
 * two for longer, and are not equal; names of 4 characters or fewer are never `letters` (too many false alarms).
 * **words**: the library's rule 4 (`closeNames`). An exact match (any case) is a Must fix, not this.
 */
export function nameChecks(name: string, others: readonly { id: string; name: string }[], former: readonly { id: string; name: string }[] = []): NameCheck[] {
  const mine = bare(name);
  if (!mine) return [];
  const out: NameCheck[] = [];
  const seen = new Set<string>();
  const add = (c: NameCheck) => { if (!seen.has(c.other.id)) { seen.add(c.other.id); out.push(c); } };
  for (const f of former) {
    const now = others.find((o) => o.id === f.id);
    if (now && bare(f.name) === mine && bare(now.name) !== mine) add({ kind: 'former', other: now });
  }
  const letters: NameCheck[] = [];
  for (const o of others) {
    const theirs = bare(o.name);
    if (theirs === mine || mine.length <= 4 || theirs.length <= 4) continue;
    const max = Math.max(mine.length, theirs.length) > 12 ? 2 : 1;
    const d = editsBetween(mine, theirs, max);
    if (d <= max) letters.push({ kind: 'letters', other: o, edits: d });
  }
  letters.sort((a, b) => a.edits! - b.edits! || fold(a.other.name).localeCompare(fold(b.other.name))).forEach(add);
  const asMetrics = others.map((o) => ({ ...o, removedAt: undefined }) as unknown as Metric);
  for (const m of closeNames(name, asMetrics)) add({ kind: 'words', other: { id: m.id, name: m.name } });
  return out.slice(0, 2);
}

/** The names metrics in use used to have, from the change log's renames: `{ id: the metric, name: its old name }`. */
export function formerNames(changes: readonly { entity: string; entityId: string; diffs: readonly { field: string; from: string; to: string }[] }[], live: readonly { id: string; name: string }[]): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (const c of changes) {
    if (c.entity !== 'metric') continue;
    const now = live.find((m) => m.id === c.entityId);
    const d = c.diffs.find((x) => x.field === 'Name');
    if (now && d && d.from && d.from !== '—' && fold(d.from) !== fold(now.name)) out.push({ id: now.id, name: d.from });
  }
  return out;
}

/* ---------- a unit spelt another way ---------- */

/** Spellings of a unit that mean one already written another way. `s` only when `s` is in use (as every one is). */
const UNIT_SPELLINGS: Record<string, string> = {
  percent: '%', pct: '%', 'per cent': '%',
  mins: 'min', minutes: 'min', minute: 'min',
  hrs: 'hours', hr: 'hours', hour: 'hours',
  secs: 's', seconds: 's', sec: 's',
  dollars: 'USD', $: 'USD',
};
const unitBare = (u: string) => u.trim().toLowerCase().replace(/\.$/, '').replace(/s$/, '');

/**
 * Rule 1. A unit written differently from one in use: lower case and without a trailing “s” or “.”, it equals one in
 * use, or it is a known spelling of one in use (percent → %, mins → min, hrs → hours, secs → s, dollars → USD). Nothing
 * when it is already identical to one in use.
 */
export function unitChecks(unit: string, unitsInUse: readonly string[]): { use: string } | null {
  const typed = unit.trim();
  if (!typed || unitsInUse.includes(typed)) return null;
  const raw = typed.toLowerCase().replace(/\.$/, '');
  const known = UNIT_SPELLINGS[raw];
  if (known && unitsInUse.includes(known)) return { use: known };
  const same = unitsInUse.find((u) => unitBare(u) === unitBare(typed));
  return same ? { use: same } : null;
}

/* ---------- a percentage that doesn't say out of what ---------- */

const TIME_UNIT = /^(ms|s|secs?|seconds?|min|mins|minutes?|h|hrs?|hours?|days?|weeks?|months?)$/i;
const PER_TIME = /\bper\b|\//i;
const OUT_OF = ['out of', 'share of', 'of all', 'of every', 'divided by', 'per ', '÷', '/', 'percentage of', 'proportion of', 'fraction of'];

/**
 * Rule 1. A share whose meaning doesn't say out of what: the unit is %, or the name has “rate”, “share” or “ratio” and the
 * unit isn't a time or a count per time; the meaning is said; and it has none of “out of”, “share of”, “of all”, “of
 * every”, “divided by”, “per ”, “÷”, “/”, “percentage of”, “proportion of”, “fraction of”. An empty meaning is never this
 * (it is “Still to say”).
 */
export function meaningChecks(m: Pick<Metric, 'name' | 'unit' | 'meaning'>): 'out-of-what' | null {
  const meaning = (m.meaning ?? '').trim().toLowerCase();
  if (!meaning) return null;
  const unit = m.unit.trim();
  const share = unit === '%' || (/\b(rate|share|ratio)\b/i.test(m.name) && !TIME_UNIT.test(unit) && !PER_TIME.test(unit));
  if (!share) return null;
  return OUT_OF.some((w) => meaning.includes(w)) ? null : 'out-of-what';
}

/* ---------- the questions, as the form and save_metric ask them ---------- */

export type CheckField = 'name' | 'unit' | 'meaning';
export interface MetricCheck { field: CheckField; level: 'check'; words: string; answers: { choice: string; label: string }[] }
export interface CheckReads {
  /** Every metric in use (not removed), the one being changed included. */
  metrics: readonly Pick<Metric, 'id' | 'name' | 'unit' | 'direction' | 'ownerId'>[];
  people: readonly { id: string; name: string; leftAt?: string | null }[];
  /** How many goals in force each metric measures. */
  goalsOf: (metricId: string) => number;
  former: readonly { id: string; name: string }[];
}

const OUT_OF_WHAT = 'This is a percentage, and the words don’t say out of what. For example: “production deploys with no rollback or hotfix, out of all production deploys, over 28 days”.';

/**
 * The Checks a metric as typed raises (rule 1), one per field at most, each with its answers. Adding: all three. Changing:
 * only for a field that changed. An answer's `choice` is what save_metric's `answers` takes: name `keep:<id>` or `use:<id>`
 * (the id of the metric the question names, so an answer covers only the question it was given to), unit `keep` or `use`,
 * meaning `as-written`.
 */
export function metricChecks(next: Pick<Metric, 'id' | 'name' | 'unit' | 'meaning'>, before: Pick<Metric, 'name' | 'unit' | 'meaning'> | null, r: CheckReads): MetricCheck[] {
  const out: MetricCheck[] = [];
  const others = r.metrics.filter((m) => m.id !== next.id);
  if (!before || fold(before.name.trim()) !== fold(next.name.trim())) {
    const c = nameChecks(next.name, others, r.former)[0];
    if (c) {
      const m = r.metrics.find((x) => x.id === c.other.id)!;
      const owner = r.people.find((p) => p.id === m.ownerId && !p.leftAt)?.name;
      const n = r.goalsOf(m.id);
      const about = `${m.unit}, ${directionWords(m.direction as MetricDirection)}${owner ? `, owned by ${owner}` : ''}, ${n} ${n === 1 ? 'goal' : 'goals'}`;
      const words = c.kind === 'former' ? `“${next.name.trim()}” is now called “${m.name}”.`
        : c.kind === 'letters' ? `This is ${c.edits === 1 ? 'one letter' : 'two letters'} from “${m.name}” (${about}).`
          : `This looks like “${m.name}” (${about}).`;
      const answers = c.kind === 'former'
        ? [{ choice: `use:${m.id}`, label: `Use ${m.name}` }, { choice: `keep:${m.id}`, label: `Add “${next.name.trim()}” as a new metric` }]
        : [{ choice: `use:${m.id}`, label: 'Use that one' }, { choice: `keep:${m.id}`, label: 'Mine is different: keep it' }];
      out.push({ field: 'name', level: 'check', words, answers });
    }
  }
  if (!before || before.unit.trim() !== next.unit.trim()) {
    const u = unitChecks(next.unit, [...new Set(others.map((m) => m.unit))]);
    if (u) out.push({ field: 'unit', level: 'check', words: `Other metrics here use “${u.use}”. Use “${u.use}”, or keep “${next.unit.trim()}”?`, answers: [{ choice: 'use', label: `Use “${u.use}”` }, { choice: 'keep', label: `Keep “${next.unit.trim()}”` }] });
  }
  if (!before || before.meaning.trim() !== next.meaning.trim() || before.unit.trim() !== next.unit.trim() || before.name.trim() !== next.name.trim()) {
    if (meaningChecks(next)) out.push({ field: 'meaning', level: 'check', words: OUT_OF_WHAT, answers: [{ choice: 'as-written', label: 'It’s right as written' }] });
  }
  return out;
}

/** The checks an answer doesn't cover yet. An answer must be one of its check's choices. */
export const unansweredChecks = (checks: readonly MetricCheck[], answers: Partial<Record<CheckField, string>>) => checks.filter((c) => !c.answers.some((a) => a.choice === answers[c.field]));

/**
 * The answers as given, checked: an object of words for name, unit and meaning only. Anything else is refused in plain
 * words rather than read wrongly (an answer of 5 is not a choice).
 */
export function answersFrom(raw: unknown): Partial<Record<CheckField, string>> {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new NotAllowed('Answers are words for name, unit or meaning, from the questions you were asked.');
  const out: Partial<Record<CheckField, string>> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k !== 'name' && k !== 'unit' && k !== 'meaning') throw new NotAllowed(`There’s no question about “${k}”: answers are for name, unit or meaning.`);
    if (typeof v !== 'string') throw new NotAllowed(`The answer for ${k} is one of the words the question offered, such as “keep:<id>”, “use” or “as-written”.`);
    out[k] = v;
  }
  return out;
}

/** The count line at the foot of the form: “1 to fix, 2 to check.”; either part left out at zero; empty for none. */
export const countLine = (fix: number, check: number) => [fix ? `${fix} to fix` : '', check ? `${check} to check` : ''].filter(Boolean).join(', ') + (fix || check ? '.' : '');
