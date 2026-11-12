import { describe, expect, it } from 'vitest';
import { resumeWalk } from './checkin';

describe('the week’s walk (NV3, build review of #114)', () => {
  it('carries on after a reload: a goal posted in the walk keeps its place, so it says “2 of 2”', () => {
    expect(resumeWalk(['b'], { queue: ['a', 'b'], walked: ['a'] })).toEqual({ walk: { queue: ['a', 'b'], walked: ['a'] }, start: 1 });
  });
  it('starts afresh when a goal was checked in outside the walk, so it is never walked again and the count is the list’s', () => {
    expect(resumeWalk(['a', 'b', 'd', 'e'], { queue: ['a', 'b', 'c', 'd', 'e'], walked: [] })).toEqual({ walk: { queue: ['a', 'b', 'd', 'e'], walked: [] }, start: 0 });
  });
  it('starts afresh when something new is due, or nothing usable is kept', () => {
    expect(resumeWalk(['a', 'f'], { queue: ['a'], walked: [] }).walk.queue).toEqual(['a', 'f']);
    expect(resumeWalk(['a'], ['a']).walk).toEqual({ queue: ['a'], walked: [] });
    expect(resumeWalk(['a'], null).start).toBe(0);
  });
});
