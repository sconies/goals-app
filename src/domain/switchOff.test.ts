/* The read-backs before switching Watching or the Wrap-up off (SW1, docs/design/feature-switches/spec.md 2.5 and 4.2):
   each worked example of the spec, and the lines they give. */
import { aiAccessAsks, aiAccessInUse, aiAccessOffLines, aiAccessOnLines, aiAccessReadBack, tokenNames, watchingAsks, watchingOffLines, watchingOffReadBack, wrapUpAsks, wrapUpOffLines, wrapUpOffReadBack } from './switchOff';

const text = (ls: { strong: string; rest: string }[]) => ls.map((l) => l.strong + l.rest);

describe('switching Watching off: what the read-back counts', () => {
  const people = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  // A watches a level, B two goals, C one tree; C owns no goal (spec 2.5's example). D has one watch, stopped.
  const watches = [
    { personId: 'a', removedAt: null }, { personId: 'b' }, { personId: 'b' }, { personId: 'c' }, { personId: 'd', removedAt: '2026-11-01' },
  ];
  const goals = [{ ownerId: 'a' }, { ownerId: 'b' }, { ownerId: 'c', removedAt: '2026-10-01' }];

  it('counts the people with a live watch, the live watches, and of those people the ones who own no goal', () => {
    expect(watchingOffReadBack({ people, watches, goals })).toEqual({ people: 3, watches: 4, seeThrough: 1 });
  });

  it('leaves out the watches of someone who has left, and asks first only with a watch to keep', () => {
    const r = watchingOffReadBack({ people: [...people.slice(0, 3), { id: 'd', leftAt: '2026-10-01' }], watches: [{ personId: 'd' }], goals });
    expect(r).toEqual({ people: 0, watches: 0, seeThrough: 0 });
    expect(watchingAsks(r)).toBe(false);
    expect(watchingAsks(watchingOffReadBack({ people, watches, goals }))).toBe(true);
  });

  it('says what leaves and what stays, in the spec’s words, with “and in its reviews” only while Reviews is on', () => {
    const r = watchingOffReadBack({ people, watches, goals });
    expect(text(watchingOffLines(r, true))).toEqual([
      'Watching leaves Goals, Home and every goal’s page: the Watching tab, “Goals you watch” and the Watch button.',
      '3 people’s 4 watches are kept. Nobody is shown as watching while it is off.',
      '1 person owns no goal and sees Home through what they watch. Their Home will show every goal that needs attention instead.',
      'Goals don’t change. Each is still on its owner’s Home, in Goals and in its reviews.',
      'Nothing is deleted. Switch Watching back on and each person watches what they did.',
    ]);
    expect(text(watchingOffLines({ people: 1, watches: 1, seeThrough: 0 }, false))).toEqual([
      'Watching leaves Goals, Home and every goal’s page: the Watching tab, “Goals you watch” and the Watch button.',
      '1 person’s 1 watch is kept. Nobody is shown as watching while it is off.',
      'Goals don’t change. Each is still on its owner’s Home, in Goals.',
      'Nothing is deleted. Switch Watching back on and each person watches what they did.',
    ]);
  });
});

describe('switching the Wrap-up off: what the read-back counts', () => {
  const goals = [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }, { id: 'g4', stoppedAt: '2026-06-01' }, { id: 'g5', removedAt: '2026-06-01' }];
  const retros = [{ goalId: 'g1', next: 'carry' as const }, { goalId: 'g2', next: 'stop' as const }, { goalId: 'g5', next: 'stop' as const }];

  it('counts the wrap-ups on goals not removed, those saying stop, and while it is open the goals still to wrap up', () => {
    expect(wrapUpOffReadBack({ retros, goals, open: true, next: '2027' })).toEqual({ written: 2, stops: 1, open: true, left: 1, next: '2027' });
    expect(wrapUpOffReadBack({ retros: [], goals, open: false, next: '2027' })).toEqual({ written: 0, stops: 0, open: false, left: 0, next: '2027' });
  });

  it('asks first only with a wrap-up written or while it is open', () => {
    expect(wrapUpAsks(wrapUpOffReadBack({ retros: [], goals, open: false, next: '2027' }))).toBe(false);
    expect(wrapUpAsks(wrapUpOffReadBack({ retros: [], goals, open: true, next: '2027' }))).toBe(true);
  });

  it('says what leaves and what stays, and that the year still ends', () => {
    expect(text(wrapUpOffLines(wrapUpOffReadBack({ retros, goals, open: true, next: '2027' })))).toEqual([
      'The wrap-up leaves Home, Goals and Cycles. Owners aren’t asked how their goals landed. 1 goal is not wrapped up yet and won’t be asked for.',
      '2 wrap-ups already written stay in each goal’s History.',
      '1 goal was marked “Stop” at its wrap-up, and it stops when 2027 starts.',
      'The year still ends. Results are worked out as before, and an admin starts 2027 from Cycles.',
    ]);
  });
});

describe('switching AI access off or on: what the read-back names (SW2)', () => {
  const people = [{ id: 'a', name: 'Amara Nwosu' }, { id: 'r', name: 'Rhea Kapoor' }, { id: 'h', name: 'Hamid Rezaei', leftAt: '2026-11-01' }];
  const tok = (id: string, personId: string, name: string, createdAt: string, revokedAt: string | null = null) => ({ id, personId, name, createdAt, revokedAt });
  const via = (to: string) => ({ diffs: [{ field: 'Via', to }] });

  it('names live tokens of people still here, newest first, and counts changes made through MCP', () => {
    const r = aiAccessReadBack({ people, tokens: [tok('1', 'a', 'Claude on my laptop', '2026-11-01'), tok('2', 'r', 'Claude', '2026-11-03'), tok('3', 'a', 'Old', '2026-10-01', '2026-10-02'), tok('4', 'h', 'Weekly brief', '2026-11-04')], changes: [via('MCP'), via('AI assistant (MCP)'), via('Spreadsheet'), { diffs: [] }] });
    expect(r.tokens.map((t) => t.id)).toEqual(['2', '1']);
    expect(r.changes).toBe(2);
    expect(aiAccessAsks(r)).toBe(true);
    expect(aiAccessInUse(r)).toBe('2 tokens are in use.');
    expect(aiAccessOffLines(r).map((l) => l.strong + l.rest)).toEqual([
      '2 tokens stop working at once: Rhea Kapoor’s “Claude” and Amara Nwosu’s “Claude on my laptop”.',
      'They are kept, not revoked. Switch AI access back on and they work again. To end one for good, revoke it first.',
      'What AI tools already changed stays, marked “via MCP” in Activity: 2 changes.',
      'An AI tool can’t switch this back on. An admin does, here.',
    ]);
    expect(aiAccessOnLines(r)[0]!.strong + aiAccessOnLines(r)[0]!.rest).toBe('2 tokens made before will work again at once: Rhea Kapoor’s “Claude” and Amara Nwosu’s “Claude on my laptop”.');
  });

  it('names the first five and how many more; with no token it acts at once', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, person: 'Amara Nwosu', name: `T${i}` }));
    expect(tokenNames(many)).toMatch(/“T4” and 2 more$/);
    const none = aiAccessReadBack({ people, tokens: [], changes: [] });
    expect(aiAccessAsks(none)).toBe(false);
    expect(aiAccessInUse(none)).toBeNull();
  });
});
