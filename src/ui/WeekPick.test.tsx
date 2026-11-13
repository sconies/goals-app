// @vitest-environment jsdom
/* The week picker by keyboard and pointer (goal entry 2.13; GE9 review). The cycle is the demo's 2026; this week is 46. */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { WeekPick } from './WeekPick';

const cycle = { startDate: '2025-12-22', weeks: 53 };
const pick = (onChange = vi.fn()) => {
  render(<><WeekPick cycle={cycle} week={46} field="to" from={46} label="To" value={null} onChange={onChange} /><button type="button">After</button></>);
  fireEvent.click(screen.getByRole('button', { name: /^To/ }));
  return onChange;
};
const isOpen = () => !!document.querySelector('.weekpick.open');
const frame = () => act(() => new Promise((r) => requestAnimationFrame(() => r(null))));

describe('the week picker (GE9 review)', () => {
  beforeAll(() => { Element.prototype.scrollIntoView ??= () => {}; });

  it('moves the highlight when the pointer moves, not when rows slide under a still pointer', () => {
    const onChange = pick();
    const row = document.querySelector('[data-week="50"]')!;
    fireEvent.mouseEnter(row);
    fireEvent.mouseOver(row);
    expect(row.className).not.toMatch(/active/);
    fireEvent.mouseMove(row);
    expect(row.className).toMatch(/active/);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it('closes on Escape from the Year buttons and from Close', () => {
    pick();
    fireEvent.keyDown(screen.getByRole('button', { name: '2027' }), { key: 'Escape' });
    expect(isOpen()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /^To/ }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'Escape' });
    expect(isOpen()).toBe(false);
  });

  it('closes when Tab takes the focus out of it', async () => {
    pick();
    const year = screen.getByRole('button', { name: '2027' });
    fireEvent.keyDown(year, { key: 'Tab' });
    screen.getByRole('button', { name: 'After' }).focus();
    await frame();
    expect(isOpen()).toBe(false);
  });

  it('chooses the highlighted week on Enter with nothing typed, and says nothing about an empty week', () => {
    const onChange = pick();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(screen.queryByText(/isn’t a week or a date/)).toBeNull();
    expect(onChange).toHaveBeenCalledWith(47);
  });

  it('moves one week per key even when keys come faster than a render (U109 on a slow phone)', () => {
    const onChange = pick();
    const list = screen.getByRole('listbox');
    act(() => {
      for (let i = 0; i < 5; i++) list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(52);
  });
});
