/* MQ: a metric's structure: its parent and level, a confidence in its number, and how it could be gamed (rulesStructure.ts). */
import { describe, expect, it } from 'vitest';
import { metricFromRow, metricToRow } from './records';
import * as M from './rules';
import { childrenOf, makesLoop, parentRefusal, placeWords, structureProblems } from './rulesStructure';
import type { Metric } from './types';

const base = { meaning: '', unit: 'min', decimals: 0, direction: 'lower' as const, source: '', sourceOwner: '', refresh: null, ownerId: 'rhea', caveats: '', createdBy: 'rhea', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' };
const lead: Metric = { ...base, id: 'lead', name: 'Lead time for changes' };
const review: Metric = { ...base, id: 'review', name: 'Review wait', parentId: 'lead', level: 'component' };
const ci: Metric = { ...base, id: 'ci', name: 'CI time', parentId: 'lead', level: 'driver', confidence: 'medium', gaming: 'Skipping slow suites on main' };
const lib = { metrics: [lead, review, ci] };

describe('metric structure', () => {
  it('shows a metric with its children, by name, and says where it sits', () => {
    expect(childrenOf(lib, 'lead').map((m) => m.name)).toEqual(['CI time', 'Review wait']);
    expect(placeWords(ci, lib)).toBe('A driver of Lead time for changes.');
    expect(placeWords({ parentId: 'lead' }, lib)).toBe('Under Lead time for changes.');
    expect(placeWords(lead, lib)).toBeNull();
    // A removed child isn't listed.
    expect(childrenOf({ metrics: [lead, { ...ci, removedAt: '2026-11-02' }] }, 'lead').map((m) => m.id)).toEqual([]);
  });

  it('refuses a parent that is itself, removed or under it already', () => {
    expect(parentRefusal(lib, lead, lead)).toBe('A metric can’t be its own parent');
    expect(parentRefusal(lib, lead, ci)).toBe('It’s already under this one');
    expect(makesLoop(lib, 'lead', 'review')).toBe(true);
    expect(parentRefusal(lib, review, { ...ci, removedAt: '2026-11-02' })).toBe('It’s been removed');
    expect(parentRefusal(lib, review, lead)).toBeNull();
  });

  it('says what is wrong in words someone can act on', () => {
    expect(structureProblems(ci, lib)).toEqual([]);
    expect(structureProblems({ id: 'x', level: 'driver' }, lib)).toEqual(['Say what it is a driver of: choose its parent, or leave the level empty.']);
    expect(structureProblems({ id: 'x', parentId: 'nope' }, lib)).toEqual(['Choose another parent: there’s no such metric in this workspace.']);
    expect(structureProblems({ id: 'lead', parentId: 'ci' }, lib)).toEqual(['Choose another parent: it’s already under this one.']);
    expect(structureProblems({ id: 'x', confidence: 'certain' as never, gaming: 'x'.repeat(501) }, lib)).toEqual(['Its confidence is high, medium or low, or left empty.', 'Keep how it could be gamed to 500 characters or fewer.']);
  });

  it('is kept through the form’s rule and the database row; a metric that says none reads as before', () => {
    const x = { actor: { id: 'rhea' } as never, now: '2026-11-03T00:00:00.000Z', newId: (p: string) => `${p}_1` };
    const made = M.metricFrom({ parentId: 'lead', level: 'driver', confidence: 'low', gaming: '  Counting retries as passes ' }, ci, x);
    expect([made.parentId, made.level, made.confidence, made.gaming]).toEqual(['lead', 'driver', 'low', 'Counting retries as passes']);
    const cleared = M.metricFrom({ parentId: null as never, level: null as never, confidence: null as never, gaming: '' }, ci, x);
    expect(['parentId', 'level', 'confidence', 'gaming'].filter((k) => k in cleared)).toEqual([]);
    // Left out of the input: kept as it was.
    expect(M.metricFrom({ name: 'CI time (p50)' }, ci, x).gaming).toBe('Skipping slow suites on main');
    const row = metricToRow('ws', ci);
    expect([row.level, row.parent_id, row.confidence, row.gaming]).toEqual(['driver', 'lead', 'medium', 'Skipping slow suites on main']);
    expect(metricFromRow(row)).toMatchObject({ level: 'driver', parentId: 'lead', confidence: 'medium', gaming: 'Skipping slow suites on main' });
    const plain = metricToRow('ws', lead);
    expect([plain.level, plain.parent_id, plain.confidence, plain.gaming]).toEqual([null, null, null, null]);
    expect(['parentId', 'level', 'confidence', 'gaming'].filter((k) => k in metricFromRow(plain))).toEqual([]);
  });
});
