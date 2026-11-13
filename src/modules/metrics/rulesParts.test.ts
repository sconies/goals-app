// @vitest-environment node
/* Rule 2 of the metric library's round 2 (MT2; docs/design/metrics-2/spec.md): which part of a number a goal is
   measured by, the parts in use, and what linking asks. Worked examples from the spec's table. */
import { closePart, forWords, linkChanges, linkChecks, partKey, partsOf, type LinkReads, type OtherLink } from './rulesParts';

const metric = { id: 'metric_queue-wait', name: 'Pipeline queue wait (p90)' };
const goal = { id: 'g-new' };
const other = (o: Partial<OtherLink> & Pick<OtherLink, 'goalId'>): OtherLink => ({ teamId: 'build', part: '', title: 'Release build queue', key: 'G-61', ownerName: 'Pavel Novak', ...o });
const reads = (r: Partial<LinkReads> = {}): LinkReads => ({ present: null, others: [], hasCheckIns: false, sliceName: (t) => (t === 'build' ? 'Build & Release' : t === 'cicd' ? 'CI/CD' : 'The whole company'), ...r });
const none = { errors: [], warnings: [] };

describe('partKey: the same part however it is spelt', () => {
  it('folds case, accents, punctuation, spaces and a trailing s per word', () => {
    expect(partKey('Tier 1 service')).toBe(partKey('tier-1 services'));
    expect(partKey('  Release   Builds ')).toBe('release build');
    expect(partKey('Région EU')).toBe('region eu');
    expect(partKey('')).toBe('');
  });
  it('keeps the s of a short word: “US” is not “U”, “gas” is not “ga” (#308’s review)', () => {
    expect(partKey('US')).not.toBe(partKey('U'));
    expect(partKey('gas')).toBe('gas');
    expect(partKey('jobs')).toBe('job');
  });
});

describe('partsOf: the parts a metric’s live links use', () => {
  it('lists distinct parts, most used first, each in its most used spelling, leaving out all-of-it and removed links', () => {
    const links = [
      { goalId: 'a', teamId: null, part: 'tier-1 services' },
      { goalId: 'b', teamId: null, part: 'Tier 1 service' },
      { goalId: 'c', teamId: null, part: 'tier-1 services' },
      { goalId: 'd', teamId: null, part: 'EU' },
      { goalId: 'e', teamId: null, part: '' },
      { goalId: 'f', teamId: null, part: 'APAC', removedAt: '2026-11-01T00:00:00Z' },
    ];
    expect(partsOf(links)).toEqual(['tier-1 services', 'EU']);
  });
});

describe('closePart: a part in use the typed one probably means', () => {
  it('never asks about a part whose numbers differ: “Region 2” is not “Region 1” (#308’s review)', () => {
    expect(closePart('Region 2', ['Region 1'])).toBeNull();
    expect(closePart('Tier 2 services', ['tier-1 services'])).toBeNull();
    expect(closePart('Regon 2', ['Region 2'])).toBe('Region 2');
  });
  it('finds the same part spelt differently', () => expect(closePart('Tier 1 service', ['tier-1 services'])).toBe('tier-1 services'));
  it('finds one a single edit away', () => expect(closePart('release bilds', ['release builds'])).toBe('release builds'));
  it('never matches parts of two characters: “EU” is not “US”', () => expect(closePart('EU', ['US', 'APAC'])).toBeNull());
  it('says nothing for a part in use as typed, a new one, or none', () => {
    expect(closePart('release builds', ['release builds'])).toBeNull();
    expect(closePart('nightly jobs', ['release builds'])).toBeNull();
    expect(closePart('', ['release builds'])).toBeNull();
  });
});

describe('linkChecks: what measuring a goal by a metric asks', () => {
  it('passes linkProblems’ errors through as Must fix under Measured by, and its warnings as Checks', () => {
    const c = linkChecks(goal, metric, { teamId: null, part: '' }, { errors: ['The goal is in hours and the metric is in min. Use the same unit for both.'], warnings: ['The goal aims up, but for Pipeline queue wait (p90) lower is better. Check it’s meant.'] }, reads(), '');
    expect(c.map((x) => [x.field, x.kind])).toEqual([['measuredBy', 'fix'], ['target', 'check']]);
    expect(c[0]!.words).toBe('The goal is in hours and the metric is in min. Use the same unit for both.');
  });
  it('asks when another goal already measures the same number: for Build & Release, part “release builds”, when G-61 has the same', () => {
    const c = linkChecks(goal, metric, { teamId: 'build', part: 'Release builds' }, none, reads({ others: [other({ goalId: 'g61', part: 'release builds' })] }), '');
    expect(c).toEqual([{ field: 'part', kind: 'check', words: 'Another goal already measures this for Build & Release, Release builds: “Release build queue” (G-61, Pavel Novak). Two goals on one number is unusual.', answers: [{ choice: 'carry-on', label: 'Carry on' }] }]);
  });
  it('asks to reuse a part spelt differently: “Tier 1 service” when “tier-1 services” is in use', () => {
    const c = linkChecks(goal, metric, { teamId: 'cicd', part: 'Tier 1 service' }, none, reads({ others: [other({ goalId: 'g1', teamId: 'build', part: 'tier-1 services' })] }), '');
    expect(c).toEqual([{ field: 'part', kind: 'check', words: 'Pipeline queue wait (p90) already has a part called “tier-1 services”.', answers: [{ choice: 'use:tier-1 services', label: 'Use “tier-1 services”' }, { choice: 'keep', label: 'Keep “Tier 1 service”' }] }]);
  });
  it('is fine with “EU” when the parts in use are “US” and “APAC”', () => {
    expect(linkChecks(goal, metric, { teamId: 'cicd', part: 'EU' }, none, reads({ others: [other({ goalId: 'a', part: 'US' }), other({ goalId: 'b', part: 'APAC' })] }), '')).toEqual([]);
  });
  it('needs a reason when a goal with check-ins changes its metric, team or part; not before its first check-in', () => {
    const present = { metricId: 'metric_flaky-old', teamId: 'cicd', part: '' };
    const flaky = { id: 'metric_flaky-rate', name: 'Flaky test rate' };
    expect(linkChecks(goal, flaky, { teamId: 'cicd', part: '' }, none, reads({ present, hasCheckIns: true }), '')).toEqual([{ field: 'why', kind: 'fix', words: 'Say why this goal is measured differently now.', answers: [] }]);
    expect(linkChecks(goal, flaky, { teamId: 'cicd', part: '' }, none, reads({ present, hasCheckIns: true }), 'The old rate counted retries')).toEqual([]);
    expect(linkChecks(goal, flaky, { teamId: 'cicd', part: '' }, none, reads({ present, hasCheckIns: false }), '')).toEqual([]);
  });
  it('holds the part to 60 characters', () => {
    expect(linkChecks(goal, metric, { teamId: null, part: 'x'.repeat(61) }, none, reads(), '').map((x) => [x.field, x.kind, x.words])).toEqual([['part', 'fix', 'Keep the part to 60 characters or fewer.']]);
  });
  it('leaves out the goal’s own link and removed links when looking for another goal', () => {
    expect(linkChecks(goal, metric, { teamId: 'build', part: '' }, none, reads({ others: [other({ goalId: 'g-new' }), other({ goalId: 'gone', removedAt: '2026-11-01T00:00:00Z' })] }), '')).toEqual([]);
  });
});

describe('the words around it', () => {
  it('says a slice and its part', () => {
    expect(forWords('CI/CD', 'main pipelines')).toBe('CI/CD · main pipelines');
    expect(forWords('The whole company', '')).toBe('the whole company');
  });
  it('a part spelt differently is no change; another part is', () => {
    const present = { metricId: 'm', teamId: null, part: 'tier-1 services' };
    expect(linkChanges(present, 'm', null, 'Tier 1 service')).toBe(false);
    expect(linkChanges(present, 'm', null, 'EU')).toBe(true);
    expect(linkChanges(null, 'm', null, 'EU')).toBe(false);
  });
});

describe('linkReads: what linking reads, the same at every door', () => {
  it('reads other goals in the goal’s own cycle only, and the goal’s last link even once removed (#308’s review)', async () => {
    const { buildPlatformOrg } = await import('../../data/platformOrg');
    const { linkReads } = await import('./rulesLink');
    const { linksOf, LINKS_KEY, MODULE } = await import('./rules');
    const s = buildPlatformOrg(new Date('2026-11-02T12:00:00Z'));
    const g = s.goals.find((x) => x.id === 'lead-ci-time')!;
    const old = { ...g, id: 'lead-ci-time-2025', cycleId: 'cycle-2025' };
    const links = linksOf(s);
    const was = links.find((l) => l.goalId === g.id)!;
    const full = { ...s, goals: [...s.goals, old], modules: { ...s.modules, [MODULE]: { ...s.modules![MODULE], [LINKS_KEY]: [...links.filter((l) => l.goalId !== 'ns-ci'), { ...was, id: old.id, goalId: old.id }, { ...links.find((l) => l.goalId === 'ns-ci')!, removedAt: '2026-11-01T00:00:00Z' }] } } };
    const r = linkReads({ snapshot: s, full }, { id: 'ns-ci' }, 'metric_queue-wait');
    expect(r.others.map((o) => o.goalId)).toEqual(['lead-ci-time']);
    expect(r.present).toMatchObject({ metricId: 'metric_ci-time' });
  });
});
