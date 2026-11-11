import { rowsByIds, countLine, filterLine, historyStep, nearMiss, noneFound, oneEditApart, page, suggest, textMatches, withRecent, wordsOf, type FoundRow } from './find';

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

describe('rule 6: suggestions before typing (suggest)', () => {
  const person = (id: string, name: string, teamId: string | null, leftAt: string | null = null) => ({ id, name, role: '', initials: '', teamId, admin: false, leftAt });
  const rows = { kind: 'person' as const, people: [person('rhea', 'Rhea Kapoor', 'ci'), person('zed', 'Zed Ames', 'ci'), person('ann', 'Ann Bell', 'ci'), person('gone', 'Al Gone', 'ci', '2026-01-01'), person('dan', 'Daniel Okafor', 'dp')], teamName: (id: string) => (id === 'ci' ? 'CI/CD' : 'DevProd') };
  it('a person: you, your team A to Z, then those chosen lately; never someone who left', () => {
    expect(suggest(rows, 'rhea', []).map((r) => r.id)).toEqual(['rhea', 'ann', 'zed']);
    expect(suggest(rows, 'rhea', [{ kind: 'person', id: 'dan' }, { kind: 'goal', id: 'g1' }, { kind: 'person', id: 'gone' }]).map((r) => r.id)).toEqual(['rhea', 'ann', 'zed', 'dan']);
  });
  it('a person: their team lead comes straight after you, before the rest A to Z', () => {
    expect(suggest({ ...rows, teamLead: () => 'zed' }, 'rhea', []).map((r) => r.id)).toEqual(['rhea', 'zed', 'ann']);
    expect(suggest({ ...rows, teamLead: () => 'zed' }, 'ann', []).map((r) => r.id)).toEqual(['ann', 'zed', 'rhea']);
  });
  it('keeps the newest twelve recents, without repeats', () => {
    let r: { kind: string; id: string }[] = [];
    for (let i = 0; i < 15; i++) r = withRecent(r, { kind: 'person', id: `p${i % 13}` });
    expect(r.length).toBe(12);
    expect(r[0]).toEqual({ kind: 'person', id: 'p1' });
  });
});

describe('rows by id: what a closed picker shows', () => {
  const person = (id: string, name: string, teamId: string | null, leftAt: string | null = null) => ({ id, name, role: 'Engineer', initials: '', teamId, admin: false, leftAt });
  const rows = { kind: 'person' as const, people: [person('rhea', 'Rhea Kapoor', 'ci'), person('gone', 'Al Gone', 'ci', '2026-01-01')], teamName: () => 'CI/CD' };
  it('gives the same two lines a search does, in the order asked, someone who left included, and leaves out what it can’t find', () => {
    expect(rowsByIds(rows, ['gone', 'nobody', 'rhea'])).toEqual([
      { kind: 'person', id: 'gone', name: 'Al Gone', detail: 'Engineer · CI/CD' },
      { kind: 'person', id: 'rhea', name: 'Rhea Kapoor', detail: 'Engineer · CI/CD' },
    ]);
  });
});

describe('rules 2 to 4: the count line, the filter line, none found and history', () => {
  const goals = { thing: 'goal', things: 'goals' }, people = { thing: 'person', things: 'people' };
  it.each([
    [goals, 126, false, 'worst first', null, '126 goals, worst first.'],
    [people, 97, false, 'A to Z', { from: 1, to: 50 }, '97 people, A to Z. Showing 1 to 50.'],
    [goals, 1, false, 'worst first', null, '1 goal.'],
    [goals, 17, true, null, null, '17 goals match.'],
    [goals, 1, true, null, null, '1 goal matches.'],
    [goals, 0, true, null, null, ''],
    [people, 1, true, null, null, '1 person matches.'],
    [goals, 0, false, null, null, ''],
  ])('%j, %i, narrowed %s → “%s”', (t, n, narrowed, order, shown, want) => expect(countLine(t, n, narrowed, order, shown)).toBe(want));
  it('says the filters in words', () => {
    expect(filterLine([{ key: 'team', label: 'Team', values: ['CI/CD'] }])).toBe('Filtered by: Team CI/CD');
    expect(filterLine([{ key: 'team', label: 'Team', values: ['CI/CD'] }, { key: 'status', label: 'Status', values: ['Off track', 'At risk'] }])).toBe('Filtered by: Team CI/CD · Status Off track or At risk');
    expect(filterLine([])).toBe('');
  });
  it('says what found nothing', () => {
    expect(noneFound(goals, 'zzzz', false)).toBe('No goal matches “zzzz”.');
    expect(noneFound(goals, '', true)).toBe('No goals match these filters.');
    expect(noneFound(goals, 'zzzz', true)).toBe('No goal matches “zzzz” with these filters.');
    expect(noneFound(goals, 'rolback', false, 'rollback')).toBe('No goal matches “rolback”. Showing goals that match “rollback”.');
  });
  it('adds a history entry for a choice, replaces while typing', () => {
    expect(['choice', 'started', 'typing', 'settled', 'clear', 'remembered', 'dropped'].map((c) => historyStep(c as never))).toEqual(['push', 'push', 'replace', 'replace', 'push', 'replace', 'replace']);
  });
});
