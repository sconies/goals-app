// @vitest-environment node
/* NR rule 1 (a reading's state) and rule 2 (what is recorded): the spec's worked table. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { askSource, differentNumbers, differentWords, fillsIn, fillsInWords, readingRevised, readingState, recordReading } from './rulesReading';
import type { NumberSource } from './source';

const now = new Date('2026-11-12T10:00:00Z');
const r = (value: number, at: string) => ({ value, at });

describe('rule 1: a reading’s state', () => {
  it('gives the spec’s table', () => {
    expect(readingState(r(12, '2026-11-12T09:02:00Z'), null, 13, now, null, 0)).toBe('fresh');
    expect(readingState(r(12, '2026-11-12T09:02:00Z'), null, 13, now, 14, 0)).toBe('changed');
    expect(readingState(r(12, '2026-11-12T09:02:00Z'), null, 13, now, 12.0, 0)).toBe('fresh');
    expect(readingState(r(13, '2026-11-02T09:00:00Z'), null, 13, now, null, 0)).toBe('old');
    expect(readingState(r(13, '2026-11-06T09:00:00Z'), { at: '2026-11-06T09:00:00Z' }, 13, now, null, 0)).toBe('same');
    expect(readingState(r(13, '2026-11-05T09:00:00Z'), { at: '2026-11-05T09:00:00Z' }, 13, now, null, 0)).toBe('old');
    expect(readingState(r(40, '2026-11-01T00:00:00Z'), null, 41, now, null, 0)).toBe('old');
    expect(readingState('no-slice', null, 13, now, null, 0)).toBe('no-slice');
    expect(readingState(r(130, '2026-11-12T09:02:00Z'), null, 13, now, null, 0)).toBe('jump');
    // MT4's Check is ten times or more: 120 against 13 is 9.2 times, so the spec's own example is fresh.
    expect(readingState(r(120, '2026-11-12T09:02:00Z'), null, 13, now, null, 0)).toBe('fresh');
    expect(readingState('unreachable', null, 13, now, null, 0)).toBe('unreachable');
    expect(readingState(null, null, 13, now, null, 0)).toBe('missing');
  });
  it('says revised when the source now gives another number for the last reading’s moment', () => {
    expect(readingRevised({ value: 43 }, r(45, '2026-11-05T09:00:00Z'), 0)).toBe(true);
    expect(readingRevised({ value: 43 }, r(43.2, '2026-11-05T09:00:00Z'), 0)).toBe(false);
  });
});

describe('asking a source', () => {
  const m = { id: 'm', source: 'CI analytics' };
  const company: NumberSource = { name: 'CI analytics', reads: (x, sl) => x.source === 'CI analytics' && (!sl || sl.teamId == null), read: async () => r(12, '2026-11-12T09:02:00Z') };
  it('never gives a team the company’s number', async () => {
    expect(await askSource([company], m, { teamId: 'cicd', part: '' }, now)).toEqual({ source: 'CI analytics', reading: 'no-slice' });
    expect(await askSource([company], m, { teamId: null, part: '' }, now)).toEqual({ source: 'CI analytics', reading: r(12, '2026-11-12T09:02:00Z') });
  });
  it('says unreachable when the source throws, and nothing when no source reads the metric', async () => {
    const down: NumberSource = { ...company, read: async () => { throw new Error('down'); } };
    expect((await askSource([down], m, { teamId: null, part: '' }, now)).reading).toBe('unreachable');
    expect(await askSource([company], { id: 'x', source: 'Elsewhere' }, { teamId: null, part: '' }, now)).toEqual({ source: null, reading: null });
  });
});

describe('rule 2: what is recorded', () => {
  it('keeps the reason only when the number differs, and nothing when nothing was read', () => {
    const why = { kind: 'behind' as const };
    expect(recordReading('CI analytics', r(12, 'T'), 12, 0, why)).toEqual({ source: 'CI analytics', value: 12, at: 'T' });
    expect(recordReading('CI analytics', r(12, 'T'), 14, 0, why)).toEqual({ source: 'CI analytics', value: 12, at: 'T', why });
    expect(recordReading(null, null, 14, 0)).toBe(null);
  });
  // The engine writes it (rule 3: changeset.ts) and reading.ts puts it in words; neither judges a goal.
  it('is read by no rule that judges a goal: nothing in src/domain but the types, the engine that records it and its words names a check-in’s reading', () => {
    const dir = path.join(__dirname, '../../domain');
    const readers = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.includes('.test.') && !['types.ts', 'changeset.ts', 'reading.ts'].includes(f))
      .filter((f) => /\.reading\b|\breading\?\s*:|\breading:\s/.test(fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')));
    expect(readers).toEqual([]);
  });
});

describe('rule 2: the row', () => {
  it('writes reading only when set, and reads it back', async () => {
    const { checkInToRow, checkInFromRow } = await import('../../data/rows');
    const c = { id: 'c', goalId: 'g', authorId: 'p', week: 46, postedAt: '2026-11-12T10:00:00Z', value: 14, stages: null, status: 'on', calculated: 'on', cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false } as const;
    expect('reading' in checkInToRow('ws', c)).toBe(false);
    const reading = { source: 'CI analytics', value: 12, at: '2026-11-12T09:02:00Z', why: { kind: 'behind' as const } };
    expect(checkInFromRow(checkInToRow('ws', { ...c, reading })).reading).toEqual(reading);
    expect('reading' in checkInFromRow(checkInToRow('ws', c))).toBe(false);
  });
});

describe('rule 4: where a reading shows on the metric’s page', () => {
  const m = { id: 'm', source: 'CI analytics' };
  const company: NumberSource = { name: 'CI analytics', reads: (x, sl) => x.source === 'CI analytics' && (!sl || sl.teamId == null), read: async () => null };
  const when = (at: string) => `${at.slice(11, 16)} today`;
  it('says how each goal’s check-in gets its number, asking no source', () => {
    const read = [{ reading: { source: 'CI analytics', value: 12, at: '2026-11-12T09:02:00Z' } }, { reading: { source: 'CI analytics', value: 13, at: '2026-11-05T09:00:00Z' } }, { reading: null }];
    expect(fillsInWords(fillsIn([company], m, { teamId: null, part: '' }, read), when)).toBe('Filled in from CI analytics · last read 09:02 today');
    expect(fillsInWords(fillsIn([company], m, { teamId: null, part: '' }, []), when)).toBe('Filled in from CI analytics');
    expect(fillsInWords(fillsIn([company], m, { teamId: 'cicd', part: '' }, read), when)).toBe('Typed by hand: CI analytics has no number per team');
    expect(fillsInWords(fillsIn([], m, { teamId: null, part: '' }, read), when)).toBe('Typed by hand: no source can be read');
  });
  it('counts, over the last 8 weeks, the check-ins filled in from a source that used a different number', () => {
    const rd = (value: number) => ({ source: 'CI analytics', value, at: 'T' });
    const ci = [
      { goalId: 'a', week: 46, value: 12, reading: rd(12) },
      { goalId: 'a', week: 45, value: 15, reading: rd(13), removedAt: null },
      { goalId: 'b', week: 44, value: 9.04, reading: rd(9) }, // one number at b's 1 decimal place
      { goalId: 'b', week: 43, value: 8, reading: null }, // typed, nothing read: not counted
      { goalId: 'a', week: 38, value: 20, reading: rd(10) }, // nine weeks back: outside
      { goalId: 'a', week: 47, value: 20, reading: rd(10) }, // after this week
      { goalId: 'a', week: 44, value: 30, reading: rd(10), removedAt: '2026-11-01' }, // removed
      { goalId: 'z', week: 46, value: 30, reading: rd(10) }, // not measured by this metric
    ];
    const out = differentNumbers(ci, new Map([['a', 0], ['b', 1]]), 46);
    expect(out).toEqual([{ source: 'CI analytics', n: 3, k: 1, weeks: [{ goalId: 'a', week: 45 }] }]);
    expect(differentWords(out[0]!)).toBe('In the last 8 weeks, 1 of 3 check-ins filled in from CI analytics used a different number.');
    expect(differentWords({ source: 'CI analytics', n: 1, k: 1 })).toBe('In the last 8 weeks, 1 of 1 check-in filled in from CI analytics used a different number.');
    expect(differentNumbers(ci, new Map([['b', 0]]), 30)).toEqual([]);
  });
});
