// @vitest-environment node
/* Small workspaces, rule 2: a nought is not printed beside a tab, a menu row or a section's name. */
import { countWords } from './format';

describe('rule 2: countWords', () => {
  it.each([
    [0, undefined, ''],
    [3, undefined, '3'],
    [0, { one: 'goal', many: 'goals' }, ''],
    [1, { one: 'goal', many: 'goals' }, '1 goal'],
    [9, { one: 'goal', many: 'goals' }, '9 goals'],
  ])('%i → “%s”', (n, noun, said) => { expect(countWords(n, noun)).toBe(said); });
});
