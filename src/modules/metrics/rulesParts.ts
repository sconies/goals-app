/* Measuring a goal by a metric, round 2 (MT2; docs/design/metrics-2/spec.md rule 2): which part of a team's or the
   company's number a goal is measured by, the parts other goals on the metric already use, and what linking asks. The
   goal forms (MeasuredBy.tsx), linkGoalMetric (rules.ts), link_goal_metric (tools.ts) and the conformance rows call
   these, so they can't disagree.

   Pure: each takes only what it reads. A Check is a question answered once; a Must fix stops the link. */
import { fold } from '../../domain/fold';
import type { Goal } from '../../domain/types';
import { editsBetween } from './edits';
import type { Metric } from './types';

/** "Which part" holds at most this many characters (migration 0043's okr_goal_metrics_part_len). */
export const PART_MAX = 60;
/** Why a goal is measured differently, said once it has check-ins, holds at most this many characters. */
export const LINK_REASON_MAX = 300;

/**
 * Two parts are the same part when this matches: lower case, accents and punctuation removed, spaces collapsed, and a
 * trailing "s" dropped from each word ("Tier 1 service" and "tier-1 services" are one part).
 */
export const partKey = (part: string) =>
  fold(part).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean).map((w) => (w.length > 1 && w.endsWith('s') ? w.slice(0, -1) : w)).join(' ');

/** A metric's link as these rules read it: whose number (team, or null for the company) and which part. */
export interface PartLink { goalId: string; teamId: string | null; part?: string; removedAt?: string | null }

/**
 * The distinct parts a metric's live links use, by `partKey`, most used first (ties by name), each in its most used
 * spelling (ties: the first seen). Empty parts (all of it) aren't parts.
 */
export function partsOf(links: readonly PartLink[]): string[] {
  const byKey = new Map<string, { n: number; first: number; spellings: Map<string, number> }>();
  links.forEach((l, i) => {
    const p = (l.part ?? '').trim();
    if (l.removedAt || !p) return;
    const k = partKey(p);
    const e = byKey.get(k) ?? { n: 0, first: i, spellings: new Map() };
    e.n++;
    e.spellings.set(p, (e.spellings.get(p) ?? 0) + 1);
    byKey.set(k, e);
  });
  const best = (s: Map<string, number>) => [...s.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  return [...byKey.values()].sort((a, b) => b.n - a.n || a.first - b.first).map((e) => best(e.spellings));
}

/**
 * A part in use that the typed one probably means: the same `partKey` spelt differently, or one edit away from one
 * (never for parts of two characters or fewer: "EU" is not "US"). Null when it is a part in use as typed, or new.
 */
export function closePart(part: string, parts: readonly string[]): string | null {
  const p = part.trim();
  if (!p || parts.includes(p)) return null;
  const k = partKey(p);
  const same = parts.find((x) => partKey(x) === k);
  if (same) return same;
  if (k.length <= 2) return null;
  return parts.find((x) => partKey(x).length > 2 && editsBetween(partKey(x), k, 1) === 1) ?? null;
}

export type LinkField = 'measuredBy' | 'target' | 'decimals' | 'part' | 'why';
export interface LinkCheck { field: LinkField; kind: 'fix' | 'check'; words: string; answers: { choice: string; label: string }[] }

/** Another goal measured by the same metric, as the "another goal" Check names it. */
export interface OtherLink extends PartLink { title: string; key: string; ownerName: string }

/** What linking reads: the goal's present link (if any), the metric's other live links, and whether it has check-ins. */
export interface LinkReads {
  present: { metricId: string; teamId: string | null; part?: string } | null;
  others: readonly OtherLink[];
  hasCheckIns: boolean;
  sliceName: (teamId: string | null) => string;
}

/** Whether the metric, the team or the part differ from the goal's present link (a new link differs from nothing). */
export const linkChanges = (present: LinkReads['present'], metricId: string, teamId: string | null, part: string) =>
  !!present && (present.metricId !== metricId || present.teamId !== teamId || partKey(present.part ?? '') !== partKey(part));

/**
 * Rule 2. What measuring `goal` by `metric`, for `teamId` and `part`, asks. `problems` are linkProblems' (rules.ts:
 * dated stages and unit are Must fix; aim and decimals are Checks). It adds: the part over 60 characters (Must fix);
 * another live goal with the same metric, team and part (Check); a part close to one in use (Check); and, on a goal
 * with check-ins whose metric, team or part changes, an empty reason (Must fix).
 */
export function linkChecks(
  goal: Pick<Goal, 'id'>,
  metric: Pick<Metric, 'id' | 'name'>,
  slice: { teamId: string | null; part: string },
  problems: { errors: string[]; warnings: string[] },
  r: LinkReads,
  reason: string,
): LinkCheck[] {
  const out: LinkCheck[] = [];
  for (const w of problems.errors) out.push({ field: 'measuredBy', kind: 'fix', words: w, answers: [] });
  for (const w of problems.warnings) out.push({ field: /keeps/.test(w) ? 'decimals' : 'target', kind: 'check', words: w, answers: [{ choice: 'meant', label: 'Yes, it’s meant' }] });
  const part = slice.part.trim();
  if (part.length > PART_MAX) out.push({ field: 'part', kind: 'fix', words: `Keep the part to ${PART_MAX} characters or fewer.`, answers: [] });
  const live = r.others.filter((o) => !o.removedAt && o.goalId !== goal.id);
  const twin = live.find((o) => o.teamId === slice.teamId && partKey(o.part ?? '') === partKey(part));
  // Another goal on the same number is the bigger question; a spelling is asked about only when there's none.
  const close = twin ? null : closePart(part, partsOf(live));
  if (close) out.push({ field: 'part', kind: 'check', words: `${metric.name} already has a part called “${close}”.`, answers: [{ choice: `use:${close}`, label: `Use “${close}”` }, { choice: 'keep', label: `Keep “${part}”` }] });
  if (twin) {
    const who = `${r.sliceName(slice.teamId) === 'The whole company' ? 'the whole company' : r.sliceName(slice.teamId)}${part ? `, ${part}` : ''}`;
    out.push({ field: 'part', kind: 'check', words: `Another goal already measures this for ${who}: “${twin.title}” (${twin.key}, ${twin.ownerName}). Two goals on one number is unusual.`, answers: [{ choice: 'carry-on', label: 'Carry on' }] });
  }
  // Why is asked only of a link that could be made: a goal that can't be measured by the metric needs no reason.
  if (!problems.errors.length && r.hasCheckIns && linkChanges(r.present, metric.id, slice.teamId, part) && !reason.trim()) {
    out.push({ field: 'why', kind: 'fix', words: 'Say why this goal is measured differently now. It shows in its History.', answers: [] });
  }
  if (reason.trim().length > LINK_REASON_MAX) out.push({ field: 'why', kind: 'fix', words: `Keep the reason to ${LINK_REASON_MAX} characters or fewer.`, answers: [] });
  return out;
}

/** "for CI/CD · tier-1 services", "for the whole company": a link's slice and part in words. */
export const forWords = (sliceName: string, part: string | undefined) =>
  `${sliceName === 'The whole company' ? 'the whole company' : sliceName}${(part ?? '').trim() ? ` · ${(part ?? '').trim()}` : ''}`;
