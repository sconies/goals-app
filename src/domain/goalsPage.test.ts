import { describeView, movedGoals, ownGroup, scopesFor } from './goalsPage';
import { EMPTY_QUERY, parseQuery } from './query';

const goals = [{ id: 'a', ownerId: 'rhea', teamId: 'ci' }, { id: 'b', ownerId: 'pat', teamId: 'ci' }, { id: 'c', ownerId: 'pat', teamId: 'vp' }];

describe('rule 1: the scopes someone has (scopesFor)', () => {
  it('gives Mine only to an owner, My team to someone with a team, and opens on the last, then Mine, Watching, All', () => {
    const rhea = scopesFor({ goals, viewerId: 'rhea', teams: [{ id: 'ci', name: 'CI/CD' }], watched: new Set(['c']) }, null);
    expect(rhea.tabs.map((t) => `${t.id}:${t.ids.length}`)).toEqual(['mine:1', 'team:2', 'watching:1', 'all:3']);
    expect(rhea.opens).toBe('mine');
    expect(scopesFor({ goals, viewerId: 'rhea', teams: [], watched: new Set() }, 'all').opens).toBe('all');
    expect(scopesFor({ goals, viewerId: 'nobody', teams: [], watched: new Set(['c']) }, 'mine').opens).toBe('watching');
    expect(scopesFor({ goals, viewerId: 'nobody', teams: [], watched: new Set() }, null).opens).toBe('all');
    // Two teams that between them hold every goal: My teams is the same list as All, so it waits (SM1); it still opens.
    const two = scopesFor({ goals, viewerId: 'x', teams: [{ id: 'ci', name: 'CI/CD' }, { id: 'vp', name: 'VP' }], watched: new Set() }, null);
    expect(two.tabs.map((t) => t.id)).toEqual(['all']);
    expect(two.every.find((t) => t.id === 'team')).toMatchObject({ label: 'My teams', ids: ['a', 'b', 'c'] });
  });

  // Small workspaces, rule 1 (SM1): a tab is drawn when its list has a goal and isn't the same list as one drawn before it.
  const nine = Array.from({ length: 9 }, (_, i) => ({ id: `g${i}`, ownerId: i < 3 ? 'ines' : 'kim', teamId: 'studio' }));
  it.each([
    ['One team of five; Ines owns 3 of 9 goals', { goals: nine, viewerId: 'ines', teams: [{ id: 'studio', name: 'Studio' }], watched: new Set<string>() }, 'mine 3 · all 9'],
    ['The viewer owns nothing, in the one team', { goals: nine, viewerId: 'lee', teams: [{ id: 'studio', name: 'Studio' }], watched: new Set<string>() }, 'all 9'],
    ['Watching exactly the goals of Mine', { goals: nine, viewerId: 'ines', teams: [], watched: new Set(['g0', 'g1', 'g2']) }, 'mine 3 · all 9'],
    ['Rhea in the demo-like case', { goals, viewerId: 'rhea', teams: [{ id: 'ci', name: 'CI/CD' }], watched: new Set(['c']) }, 'mine 1 · team 2 · watching 1 · all 3'],
  ])('%s: %s', (_, f, said) => {
    expect(scopesFor(f, null).tabs.map((t) => `${t.id} ${t.ids.length}`).join(' · ')).toBe(said);
  });
});

describe('rule 1 with Watching switched off (SW1, spec 2.3)', () => {
  it('has no Watching tab, and a remembered Watching opens Mine for an owner, else All', () => {
    const off = { watching: false };
    const rhea = scopesFor({ goals, viewerId: 'rhea', teams: [{ id: 'ci', name: 'CI/CD' }], watched: new Set(['c']) }, 'watching', off);
    expect(rhea.tabs.map((t) => t.id)).toEqual(['mine', 'team', 'all']);
    expect(rhea.opens).toBe('mine');
    expect(scopesFor({ goals, viewerId: 'nobody', teams: [], watched: new Set(['c']) }, 'watching', off)).toMatchObject({ opens: 'all', tabs: [{ id: 'all' }] });
  });
});

describe('rule 2: a scope’s own group', () => {
  it('is trees for All and one list for every other scope', () => expect((['mine', 'team', 'watching', 'all'] as const).map(ownGroup)).toEqual(['none', 'none', 'none', 'tree']));
});

describe('rule 5: a view in words (describeView)', () => {
  const names = { team: (id: string) => (id === 'cicd' ? 'CI/CD' : id), person: (id: string) => id, goal: (id: string) => id };
  const label = (s: string) => ({ mine: 'Mine', team: 'My team', watching: 'Watching', all: 'All' } as Record<string, string>)[s]!;
  it.each([
    ['scope=team&attention=1&view=table', 'My team, needs attention, Table.'],
    ['scope=all&group=team', 'All, by team.'],
    ['scope=mine&sort=due', 'Mine. Sorted by due soonest.'],
  ])('%s → %s', (q, want) => { const p = new URLSearchParams(q); expect(describeView(p, parseQuery(p), names, label)).toBe(want); });
  it('lists the filters as the filter line does', () => {
    const p = new URLSearchParams('scope=all&level=north-star');
    expect(describeView(p, { ...EMPTY_QUERY, level: ['north-star'] }, names, label)).toBe('All, as trees. North star.');
  });
});

describe('rule 6: old addresses (movedGoals)', () => {
  const has = () => true;
  it.each([
    ['show=mine', 'scope=mine'], ['show=watching', 'scope=watching'], ['show=outcomes', 'scope=all'], ['show=levels', 'scope=all&group=level'],
    ['show=teams&sort=worst', 'scope=all&group=team&sort=worst'], ['show=attention&needs=decision', 'scope=all&attention=1&needs=decision'],
    ['owner=rhea', 'scope=all&owner=rhea'], ['today=2026-11-11', 'scope=mine&today=2026-11-11'], ['view=table&today=x', 'scope=mine&view=table&today=x'],
  ])('%s → %s', (from, to) => expect(movedGoals(from, 'mine', has)?.search).toBe(to));
  it('leaves a new address alone, and moves a scope the viewer doesn’t have', () => {
    expect(movedGoals('scope=team', 'mine', has)).toBeNull();
    expect(movedGoals('scope=mine', 'watching', (s) => s !== 'mine')?.search).toBe('scope=watching');
    expect(movedGoals('show=nope', 'all', has)?.note).toBe('There’s no “nope” tab, so these are all goals.');
  });
});
