/* Metric structure (backlog MQ; docs/architecture/module-map.md, the MQ row: part of the metric library, no switch of its
   own). A register says how its metrics relate and how far to trust them; the library keeps that. Each metric may say:
   - its parent, another metric, and how it relates to it (its level): a component of it, a driver of it, a control on
     it, or a breakdown of it;
   - a confidence in its number: high, medium or low;
   - in words, how the number could be gamed.
   All optional; a metric that says none reads as before. The library shows a metric with its children. It is not a
   second goal tree: goals still feed goals, and nothing here judges a goal. */
import type { Id } from '../../domain/types';
import type { Metric } from './types';

export type MetricLevel = 'component' | 'driver' | 'control' | 'breakdown';
export type MetricConfidence = 'high' | 'medium' | 'low';

export const LEVELS: readonly MetricLevel[] = ['component', 'driver', 'control', 'breakdown'];
export const CONFIDENCES: readonly MetricConfidence[] = ['high', 'medium', 'low'];
/** The most characters "how it could be gamed" keeps (okr_metrics_gaming_len). */
export const GAMING_MAX = 500;

/** Each level's word and what it means, as the form and the metric's page say it. */
export const LEVEL_WORDS: Record<MetricLevel, { label: string; of: string; meaning: string }> = {
  component: { label: 'Component', of: 'a component of', meaning: 'Part of its parent’s number: they add up to it.' },
  driver: { label: 'Driver', of: 'a driver of', meaning: 'Moves its parent’s number, without being part of it.' },
  control: { label: 'Control', of: 'a control on', meaning: 'Watched so that improving its parent doesn’t break something else.' },
  breakdown: { label: 'Breakdown', of: 'a breakdown of', meaning: 'Its parent’s number split one way: by team, region or service.' },
};
export const CONFIDENCE_WORDS: Record<MetricConfidence, { label: string; meaning: string }> = {
  high: { label: 'High', meaning: 'Measured directly and checked: the number can be trusted.' },
  medium: { label: 'Medium', meaning: 'Measured, with known gaps or a manual step.' },
  low: { label: 'Low', meaning: 'Estimated, sampled or new: read it with care.' },
};

type Rows = { metrics: readonly Metric[] };
const live = (s: Rows) => s.metrics.filter((m) => !m.removedAt);

/** The metrics whose parent is `id`, live ones only, by name. */
export const childrenOf = (s: Rows, id: Id): Metric[] =>
  live(s).filter((m) => m.parentId === id).sort((a, b) => a.name.localeCompare(b.name, 'en'));

/** Whether making `parentId` the parent of `id` would make a loop (the parent is the metric or one of its children). */
export function makesLoop(s: Rows, id: Id, parentId: Id): boolean {
  const byId = new Map(s.metrics.map((m) => [m.id, m]));
  const seen = new Set<Id>();
  for (let at: Id | null | undefined = parentId; at; at = byId.get(at)?.parentId) {
    if (at === id) return true;
    if (seen.has(at)) return false;
    seen.add(at);
  }
  return false;
}

/** Why `other` can't be `m`'s parent, in words; null when it can. */
export function parentRefusal(s: Rows, m: Pick<Metric, 'id'>, other: Metric): string | null {
  if (other.id === m.id) return 'A metric can’t be its own parent';
  if (other.removedAt) return 'It’s been removed';
  if (makesLoop(s, m.id, other.id)) return 'It’s already under this one';
  return null;
}

/** What's wrong with a metric's structure, in words someone can act on. */
export function structureProblems(m: Pick<Metric, 'id' | 'level' | 'parentId' | 'confidence' | 'gaming'>, s: Rows): string[] {
  const out: string[] = [];
  if (m.level != null && !LEVELS.includes(m.level)) out.push('Its level is component, driver, control or breakdown, or left empty.');
  if (m.confidence != null && !CONFIDENCES.includes(m.confidence)) out.push('Its confidence is high, medium or low, or left empty.');
  if (m.parentId) {
    const p = s.metrics.find((x) => x.id === m.parentId);
    const why = p ? parentRefusal(s, m, p) : 'There’s no such metric in this workspace';
    if (why) out.push(`Choose another parent: ${why.charAt(0).toLowerCase()}${why.slice(1)}.`);
  }
  if (m.level && !m.parentId) out.push(`Say what it is ${LEVEL_WORDS[m.level].of}: choose its parent, or leave the level empty.`);
  if ((m.gaming ?? '').length > GAMING_MAX) out.push(`Keep how it could be gamed to ${GAMING_MAX} characters or fewer.`);
  return out;
}

/** The structure as a metric keeps it: each part only when said, so a metric that says none reads as before. */
export function structured(level: MetricLevel | null | undefined, parentId: Id | null | undefined, confidence: MetricConfidence | null | undefined, gaming: string | null | undefined): Pick<Metric, 'level' | 'parentId' | 'confidence' | 'gaming'> {
  const g = (gaming ?? '').trim();
  return { ...(level ? { level } : {}), ...(parentId ? { parentId } : {}), ...(confidence ? { confidence } : {}), ...(g ? { gaming: g } : {}) };
}

/** Its place in words: “A driver of Lead time for changes.”; null when it has no parent. */
export function placeWords(m: Pick<Metric, 'level' | 'parentId'>, s: Rows): string | null {
  const p = m.parentId ? s.metrics.find((x) => x.id === m.parentId) : null;
  if (!p) return null;
  return m.level ? `${LEVEL_WORDS[m.level].of.charAt(0).toUpperCase()}${LEVEL_WORDS[m.level].of.slice(1)} ${p.name}.` : `Under ${p.name}.`;
}
