import { describe, expect, it } from 'vitest';
import { countLine, editsBetween, formerNames, meaningChecks, metricChecks, nameChecks, stillToSay, unansweredChecks, unitChecks, type CheckReads } from './rulesDefine';

const full = { meaning: 'Hours from commit to production.', source: 'DORA dashboard', sourceOwner: 'SRE', refresh: 'daily' as const };

describe('stillToSay (rule 1)', () => {
  it('says “Fully defined” when everything is said and the owner is here', () => {
    expect(stillToSay(full, true)).toEqual({ usable: true, full: true, missing: [], ownerLeft: false, line: 'Fully defined' });
  });
  it('lists everything missing, in order, for a metric added in a goal form', () => {
    expect(stillToSay({ meaning: '', source: '', sourceOwner: '', refresh: null }, true).line).toBe('Still to say: what it means, where the number comes from, who owns that source, how often it refreshes.');
  });
  it('lists only what is missing', () => {
    expect(stillToSay({ ...full, sourceOwner: ' ', refresh: null }, true).line).toBe('Still to say: who owns that source, how often it refreshes.');
  });
  it('says only that its owner has left when nothing else is missing', () => {
    const s = stillToSay(full, false);
    expect(s.line).toBe('Its owner has left.');
    expect(s.full).toBe(false);
  });
  it('adds the owner after what is missing', () => {
    expect(stillToSay({ ...full, meaning: '' }, false).line).toBe('Still to say: what it means. Its owner has left.');
  });
  it('never returns a number to sort by', () => {
    expect(Object.values(stillToSay(full, true)).some((v) => typeof v === 'number')).toBe(false);
  });
});

describe('nameChecks (rule 1)', () => {
  const lib = [
    { id: 'm1', name: 'Deploy success rate' }, { id: 'm2', name: 'Deploy frequency' }, { id: 'm3', name: 'Flaky test rate' },
    { id: 'm4', name: 'CI compute cost per pipeline run' }, { id: 'm5', name: 'MTTD' }, { id: 'm6', name: 'Production deploys per day' },
  ];
  const kind = (typed: string, former: { id: string; name: string }[] = []) => nameChecks(typed, lib.filter((o) => o.name !== 'Deploy frequency' || !former.length), former).map((c) => `${c.kind}:${c.other.name}`);
  it.each([
    ['Deploy sucess rate', 'letters:Deploy success rate'],
    ['Deploy frequncy', 'letters:Deploy frequency'],
    ['Flaky tests rate', 'letters:Flaky test rate'],
    ['CI cost per pipeline run', 'words:CI compute cost per pipeline run'],
  ])('“%s” → %s', (typed, want) => expect(kind(typed)[0]).toBe(want));
  it('never calls 4 characters or fewer a letter apart', () => expect(kind('MTTR')).toEqual([]));
  it('knows a former name', () => expect(kind('Deploy frequency', [{ id: 'm6', name: 'Deploy frequency' }])[0]).toBe('former:Production deploys per day'));
  it('finds nothing for a different name', () => expect(kind('Change failure rate')).toEqual([]));
  it('leaves an exact match to the Must fix', () => expect(kind('flaky TEST rate')).toEqual([]));
  it('counts edits, stopping past the most', () => {
    expect(editsBetween('kitten', 'sitting', 5)).toBe(3);
    expect(editsBetween('abc', 'abcdefgh', 2)).toBe(3);
  });
  it('reads former names from the change log’s renames', () => {
    const changes = [{ entity: 'metric', entityId: 'm6', diffs: [{ field: 'Name', from: 'Deploy frequency', to: 'Production deploys per day' }] }, { entity: 'goal', entityId: 'g', diffs: [{ field: 'Name', from: 'x', to: 'y' }] }];
    expect(formerNames(changes, lib)).toEqual([{ id: 'm6', name: 'Deploy frequency' }]);
  });
});

describe('unitChecks (rule 1)', () => {
  it.each([
    ['mins', ['min', 'hours', '%'], 'min'],
    ['percent', ['%'], '%'],
    ['min', ['min'], null],
    ['deploys', ['deploys per day'], null],
    ['ms', ['min'], null],
    ['Hours', ['hours'], 'hours'],
    ['secs', ['min'], null],
  ])('“%s” with %j in use → %s', (typed, inUse, want) => expect(unitChecks(typed, inUse)?.use ?? null).toBe(want));
});

describe('meaningChecks (rule 1)', () => {
  it.each([
    ['Change failure rate', '%', 'Share of production deploys that led to an incident.', null],
    ['Remote build cache hit rate', '%', 'Build actions served from the cache, out of all cacheable actions', null],
    ['Deploy success rate', '%', 'Deploys that worked.', 'out-of-what'],
    ['Anything', '%', '', null],
    ['Pipeline queue wait (p90)', 'min', 'Minutes a job waits for a runner.', null],
    ['Error rate', 'errors per hour', 'Errors seen.', null],
  ])('%s (%s): %s → %s', (name, unit, meaning, want) => expect(meaningChecks({ name, unit, meaning })).toBe(want));
});

describe('metricChecks', () => {
  const r: CheckReads = {
    metrics: [{ id: 'm1', name: 'Deploy success rate', unit: '%', direction: 'higher', ownerId: 'rhea' }, { id: 'm2', name: 'Queue wait', unit: 'min', direction: 'lower', ownerId: 'tunde' }],
    people: [{ id: 'rhea', name: 'Rhea Kapoor' }, { id: 'tunde', name: 'Tunde Bello', leftAt: '2026-11-01' }],
    goalsOf: (id) => (id === 'm1' ? 2 : 0),
    former: [],
  };
  const typed = { id: 'new', name: 'Deploy sucess rate', unit: '%', meaning: 'Deploys that worked.' };
  it('asks about the name and the meaning, in the spec’s words', () => {
    const cs = metricChecks(typed, null, r);
    expect(cs.map((c) => c.field)).toEqual(['name', 'meaning']);
    expect(cs[0]!.words).toBe('This is one letter from “Deploy success rate” (%, higher is better, owned by Rhea Kapoor, 2 goals).');
    expect(cs[0]!.answers.map((a) => a.choice)).toEqual(['use:m1', 'keep']);
  });
  it('asks about a unit spelt another way, and says no owner who has left', () => {
    const cs = metricChecks({ id: 'new', name: 'Queue waits', unit: 'mins', meaning: '' }, null, r);
    expect(cs.map((c) => c.words)).toEqual(['This is one letter from “Queue wait” (min, lower is better, 0 goals).', 'Other metrics here use “min”. Use “min”, or keep “mins”?']);
  });
  it('asks only about what changed', () => {
    expect(metricChecks({ ...typed, id: 'm9' }, { name: 'Deploy sucess rate', unit: '%', meaning: 'Deploys that worked.' }, r)).toEqual([]);
  });
  it('an answer covers its check only when it is one of its choices', () => {
    const cs = metricChecks(typed, null, r);
    expect(unansweredChecks(cs, { name: 'keep', meaning: 'nope' }).map((c) => c.field)).toEqual(['meaning']);
    expect(unansweredChecks(cs, { name: 'use:m1', meaning: 'as-written' })).toEqual([]);
  });
  it('says the count line', () => {
    expect(countLine(1, 2)).toBe('1 to fix, 2 to check.');
    expect(countLine(0, 1)).toBe('1 to check.');
    expect(countLine(0, 0)).toBe('');
  });
});
