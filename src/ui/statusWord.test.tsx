/* Status is a shape plus a word, always together (design rules). StatusWord is the one way a list's status slot is drawn. */
import { render } from '@testing-library/react';
import { LABEL } from '../domain/status';
import type { DisplayStatus } from '../domain/types';
import { StatusWord } from './bits';
import { StatusLegend } from './StatusLegend';

describe('StatusWord', () => {
  it('draws the status shape and its word together, in the status colour', () => {
    for (const k of ['on', 'risk', 'off', 'stale', 'done'] as DisplayStatus[]) {
      const { container, unmount } = render(<StatusWord k={k} className="trow-icon" wordClass="trow-status" />);
      const slot = container.firstElementChild as HTMLElement;
      // The slot's own class first, then the tone: lists and evals find it by both.
      expect(slot.className).toBe('trow-icon tone-' + k);
      expect(slot.querySelector('svg.status-shape')).not.toBeNull();
      expect(slot.querySelector('.trow-status')?.textContent).toBe(LABEL[k]);
      expect(slot.textContent).toBe(LABEL[k]);
      unmount();
    }
  });

  it('puts anything after the word, and can be a list item in a key', () => {
    const { container } = render(<ul><StatusWord as="li" k="off" className="map-status"><span className="result-tag">Not met</span></StatusWord></ul>);
    const li = container.querySelector('li')!;
    expect(li.className).toBe('map-status tone-off');
    expect(li.textContent).toBe('Off trackNot met');
    expect(li.firstElementChild?.tagName.toLowerCase()).toBe('svg');
  });
});

describe('StatusLegend', () => {
  it('as a key, lists each status with its shape and word, and anything extra after them', () => {
    const { container } = render(<StatusLegend kind="key" statuses={['on', 'risk', 'off', 'done']} className="hlegend" itemClass="hcell-key" extra={<li className="hcell-key">No check-in</li>} />);
    const items = [...container.querySelectorAll('ul.status-key.hlegend > li')];
    expect(items.map((x) => x.textContent)).toEqual(['On track', 'At risk', 'Off track', 'Done', 'No check-in']);
    expect(items.slice(0, 4).every((x) => x.querySelector('svg.status-shape'))).toBe(true);
  });

  it('in full, says what each status means, with the results', () => {
    const { container } = render(<StatusLegend />);
    expect(container.querySelectorAll('summary .legend-key')).toHaveLength(4);
    expect(container.querySelector('.legend-full')?.textContent).toMatch(/Met late/);
    expect(container.querySelector('.legend-full')?.textContent).not.toMatch(/Completed|Did not meet/);
  });
});
