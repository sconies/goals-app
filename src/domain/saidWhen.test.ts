// @vitest-environment node
import { saidWhen } from './checkin';

describe('when the note offered back was written (review F10)', () => {
  it('a correction in the same week asks about this week’s earlier check-in, not last week', () => {
    expect(`Is what you said ${saidWhen(46, 46)} still true?`).toBe('Is what you said in this week’s earlier check-in still true?');
    expect(saidWhen(45, 46)).toBe('last week');
    expect(saidWhen(43, 46)).toBe('in week 43');
  });
});
