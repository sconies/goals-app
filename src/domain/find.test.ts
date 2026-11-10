import { nearMiss, oneEditApart, page, textMatches, wordsOf, type FoundRow } from './find';

describe('rule 1: does text match (textMatches)', () => {
  const row = 'Rollback in under five minutes G-48 Tunde Bakare Build & Release Team Off track';
  it.each([
    [row, 'rollback', 'G-48', true],
    [row, 'roll min', 'G-48', true],
    [row, 'back', 'G-48', false],
    [row, 'off track', 'G-48', true],
    [row, 'g-48', 'G-48', true],
    [row, 'G48', 'G-48', true],
    [row, '48', 'G-48', true],
    ['Canary halt G-4', 'G-48', 'G-4', false],
    ['Lucía Romero Staff Engineer CI/CD', 'lucia ci', null, true],
    ['Anything', '', null, true],
    ['Anything', '   ', null, true],
  ])('%s, “%s” → %s', (words, q, key, want) => expect(textMatches(words, q, key)).toBe(want));

  it('breaks words at spaces and / - , . : ( )', () => {
    expect(wordsOf('CI/CD (p90): queue-wait, Lucía.')).toEqual(['ci', 'cd', 'p90', 'queue', 'wait', 'lucia']);
  });
});

describe('rule 5: a near miss (nearMiss)', () => {
  it('is one letter added, dropped, changed, or two swapped', () => {
    expect(oneEditApart('rolback', 'rollback')).toBe(true);
    expect(oneEditApart('kafak', 'kafka')).toBe(true);
    expect(oneEditApart('piplin', 'pipeline')).toBe(false);
    expect(oneEditApart('same', 'same')).toBe(false);
  });
  it.each([
    ['rolback', ['rollback'], 'rollback'],
    ['kafak', ['kafka'], 'kafka'],
    ['piplin', ['pipeline'], null],
    ['rolbak', ['rollback'], null],
    ['qeue wait', ['queue', 'wait'], 'queue wait'],
    ['cost', ['costs'], null],
    ['G-480', ['G-48'], null],
  ])('“%s” with %j → %s', (q, words, want) => expect(nearMiss(q, words)).toBe(want));
  it('chooses the commonest candidate', () => {
    expect(nearMiss('caches', ['cachet', 'cached', 'cached'])).toBe('cached');
  });
});

describe('rule 7: a page of the answer', () => {
  const rows: FoundRow[] = Array.from({ length: 7 }, (_, i) => ({ kind: 'goal', id: `g${i}`, name: `Goal ${i}`, detail: '' }));
  it('gives every row once, a page at a time, and says where the next starts', () => {
    expect(page(rows, { q: '', size: 3 })).toMatchObject({ total: 7, next: '3' });
    expect(page(rows, { q: '', size: 3, after: '6' })).toMatchObject({ total: 7, next: null, rows: [{ id: 'g6' }] });
    expect(page(rows, { q: '' }).rows.length).toBe(7);
  });
});
