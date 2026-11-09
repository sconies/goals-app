import { splitHistory } from './GoalStory';
import type { GoalSummary } from '../domain/summary';

const sum = (status: string, flags: string[]) => ({ status, story: { flags, warnings: flags.map((f) => `${f}. Detail.`) } }) as unknown as GoalSummary;

describe('a quarter not met is history once a goal is on track (review F08)', () => {
  it('sets it apart from the warnings on a goal on track or done', () => {
    expect(splitHistory(sum('on', ['missed-quarter', 'slipped']))).toEqual({ now: ['slipped. Detail.'], past: ['missed-quarter. Detail.'] });
    expect(splitHistory(sum('done', ['missed-quarter']))).toEqual({ now: [], past: ['missed-quarter. Detail.'] });
  });
  it('keeps it a warning while the goal is behind', () => {
    expect(splitHistory(sum('risk', ['missed-quarter']))).toEqual({ now: ['missed-quarter. Detail.'], past: [] });
  });
});
