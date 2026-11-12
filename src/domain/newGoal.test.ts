// @vitest-environment node
/* New goal's own rules (onboarding spec, rules 1, 2 and 5; OB1), with the spec's worked examples on the demo. */
import { buildPlatformOrg } from '../data/platformOrg';
import { NEW_GOAL_STEPS, parentSuggestions, planNote, startLevel, stepIndex } from './newGoal';
import type { Goal } from './types';

const s = buildPlatformOrg(new Date('2026-11-11T12:00:00Z'));
const cycle = s.cycles[0]!;
const goal = (id: string) => s.goals.find((g) => g.id === id)!;
const byTitle = (a: Goal, b: Goal) => a.title.localeCompare(b.title);

describe('the steps (onboarding spec, 1)', () => {
  it('are four addresses, in the order people think', () => {
    expect(NEW_GOAL_STEPS.map((x) => x.slug)).toEqual(['what', 'who', 'measure', 'check']);
    expect([stepIndex('who'), stepIndex('check'), stepIndex('nope'), stepIndex(undefined)]).toEqual([1, 3, null, null]);
  });
});

describe('rule 1: the level a new goal starts at', () => {
  it('Rhea, no parent (CI/CD owns SVP goals and her north star): none, so she is asked', () => {
    expect(startLevel(cycle, 'rhea', s.teams, s.goals, null)).toBeNull();
  });
  it('Tunde, no parent: Team', () => {
    expect(startLevel(cycle, 'tunde', s.teams, s.goals, null)).toBe('team');
  });
  it('anyone, under a north star: SVP; under an SVP goal: Team', () => {
    expect(startLevel(cycle, 'tunde', s.teams, s.goals, goal('ns-lead'))).toBe('svp');
    expect(startLevel(cycle, 'rhea', s.teams, s.goals, goal('lead-flaky'))).toBe('team');
  });
  it('a lead whose team owns a north star: none', () => {
    const own = { teams: [{ id: 'office', name: 'Office of the VP', leadId: 'amara', objective: '' }], goals: [{ ...goal('ns-lead'), teamId: 'office' }] };
    expect(startLevel(cycle, 'amara', own.teams, own.goals, null)).toBeNull();
  });
});

describe('rule 2: suggestions for “Feeds into”', () => {
  it('Tunde, a Team goal in Build & Release: Build & Release’s SVP goals first', () => {
    const got = parentSuggestions(cycle, 'team', 'build', 'tunde', s.goals, byTitle);
    expect(got.length).toBeLessThanOrEqual(6);
    expect(got.every((g) => g.level === 'svp')).toBe(true);
    const own = s.goals.filter((g) => g.level === 'svp' && g.teamId === 'build').length;
    expect(got.slice(0, Math.min(6, own)).every((g) => g.teamId === 'build')).toBe(true);
  });
  it('Rhea, an SVP goal in CI/CD: the north stars, CI/CD’s own first', () => {
    const got = parentSuggestions(cycle, 'svp', 'cicd', 'rhea', s.goals, byTitle);
    expect(got[0]!.title).toBe('Lead time for changes');
    expect(got.every((g) => g.level === 'north-star')).toBe(true);
  });
  it('a team with no goals a level up: goals opened lately above the level, else none', () => {
    expect(parentSuggestions(cycle, 'team', 'office', 'amara', s.goals, byTitle, ['ns-cfr', 'lead-merge', 'nope']).map((g) => g.id)).toEqual(['ns-cfr', 'lead-merge']);
    expect(parentSuggestions(cycle, 'team', 'office', 'amara', s.goals, byTitle)).toEqual([]);
  });
  it('a north star: none', () => {
    expect(parentSuggestions(cycle, 'north-star', 'cicd', 'rhea', s.goals, byTitle)).toEqual([]);
  });
});

describe('rule 5: the plan table’s explanation', () => {
  it('week 46 of 2026: Q4 closes in week 53', () => {
    expect(planNote(cycle, 46)).toMatch(/^Each week’s number is checked in during that week, so the one that closes Q4 is week 53, checked in 28 Dec–3 Jan/);
  });
  it('week 10: Q1 closes in week 13', () => {
    expect(planNote(cycle, 10)).toMatch(/so the one that closes Q1 is week 13, checked in 23–29 Mar/);
  });
});
