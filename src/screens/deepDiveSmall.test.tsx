// @vitest-environment jsdom
/* Deep dive, 15 Nov: the map's words for screen readers (item 5) and a two-sided range in the Goals table (item 7). */
import { render } from '@testing-library/react';
import { MAP_ARIA } from './GoalMap';
import { TargetWords } from './GoalTable';

describe('deep dive, small fixes', () => {
  it('never tells a screen reader that Delete removes a goal from the map: it does nothing there (item 5)', () => {
    for (const words of Object.values(MAP_ARIA)) expect(words).not.toMatch(/delete/i);
    expect(MAP_ARIA['node.a11yDescription.default']).toMatch(/never removes a goal/);
  });

  it('lets a range kept between two limits break after its dash, each limit whole, so it stays in its cell (item 7)', () => {
    const { container } = render(<TargetWords text="1,200 ms–1,500 ms" />);
    expect([...container.querySelectorAll('.nb')].map((e) => e.textContent)).toEqual(['1,200 ms–', '1,500 ms']);
    expect(container.querySelector('wbr')).not.toBeNull();
    const one = render(<TargetWords text="≤ 15.0%" />).container;
    expect(one.textContent).toBe('≤ 15.0%');
    expect(one.querySelector('wbr')).toBeNull();
  });
});
