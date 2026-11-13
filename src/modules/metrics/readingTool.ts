/* The metric module's reader for post_check_in (NR rule 3; src/mcp/checkInReaders.ts): the same source the number step
   asks, under the same rule. Registered by ./tools.ts. On the server the demo's sources are made from the example's
   check-ins before this week (the server can't rebuild the example as it was seeded, and this week's are the ones a
   post could fill in); a workspace of your own has none. */
import { checkInsFor } from '../../domain/status';
import type { CheckInReading, Goal, ReadingWhyKind } from '../../domain/types';
import type { CheckInReader } from '../../mcp/checkInReaders';
import type { McpContext } from '../../mcp/tools';
import { measureOf } from './rules';
import { askSource, readingState, recordReading } from './rulesReading';
import { sliceOf, type NumberSource } from './source';
import { sourcesFrom } from './sources';

/** The sources an assistant's check-in reads: the demo's in the example, none elsewhere. */
export function toolSources(ctx: Pick<McpContext, 'ws' | 'snapshot' | 'full' | 'cycle' | 'week'>): NumberSource[] {
  if (ctx.ws.kind !== 'example') return [];
  const s = ctx.full ?? ctx.snapshot;
  return sourcesFrom({ ...s, checkIns: s.checkIns.filter((c) => c.week < ctx.week && !c.removedAt) }, ctx.cycle);
}

export async function readForTool(ctx: McpContext, goal: Goal, ask: { value: number | null; confirmed: boolean; why?: { kind: ReadingWhyKind; text?: string } }): Promise<{ reading: CheckInReading | null; says?: string }> {
  const m = goal.kind === 'milestone' ? null : measureOf(ctx.snapshot, goal);
  if (!m) return { reading: null, says: `“${goal.title}” isn’t measured by a metric with a number source, so no reading was recorded.` };
  const asked = await askSource(toolSources(ctx), m.metric, sliceOf(m.link), ctx.today);
  if (!asked.source) return { reading: null, says: `No source can read ${m.metric.name}, so no reading was recorded.` };
  const last = checkInsFor(goal, ctx.snapshot.checkIns).at(-1) ?? null;
  const value = ask.value ?? (ask.confirmed && asked.reading && typeof asked.reading === 'object' ? asked.reading.value : null);
  const state = readingState(asked.reading, last?.reading ?? null, last?.value ?? null, ctx.today, value, m.metric.decimals);
  const r = asked.reading && typeof asked.reading === 'object' ? asked.reading : null;
  const says: Record<string, string> = {
    'no-slice': `${asked.source} doesn’t read ${m.metric.name} for this goal’s team or part, so no reading was recorded.`,
    unreachable: `${asked.source} couldn’t be reached just now, so no reading was recorded.`,
    missing: `${asked.source} has no number for this yet, so no reading was recorded.`,
    old: `${asked.source}’s latest reading is more than a week old, so it wasn’t recorded.`,
    same: `${asked.source} has no new reading since the last check-in, so none was recorded.`,
  };
  if (!r || says[state]) return { reading: null, says: says[state] };
  return { reading: recordReading(asked.source, r, value, m.metric.decimals, ask.why) ?? null };
}

export const metricReader: CheckInReader = { module: 'metrics', read: readForTool };
