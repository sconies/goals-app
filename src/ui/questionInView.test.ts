// @vitest-environment jsdom
import { bringIntoView, focusQuestion, questionAppeared } from './questionInView';

/** A box at a place on the screen (jsdom draws nothing). */
const at = (el: Element, top: number, height: number) => {
  el.getBoundingClientRect = () => ({ top, bottom: top + height, height, left: 0, right: 390, width: 390, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
  (el as HTMLElement).getClientRects = () => [el.getBoundingClientRect()] as unknown as DOMRectList;
};

function form() {
  document.body.innerHTML = '<form><input data-field="target"><div class="level-check" tabindex="-1" data-check="over-100"></div><div class="focus-foot" style="position: sticky"></div></form>';
  const input = document.querySelector('input')!;
  const q = document.querySelector<HTMLElement>('[data-check]')!;
  const foot = document.querySelector('.focus-foot')!;
  Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
  at(input, 596, 50);
  at(foot, 764, 80);
  return { input, q };
}

describe('a question about a number is seen where it is asked (goal entry 2.1, item 3; U93)', () => {
  let by: number[] = [];
  beforeEach(() => { by = []; window.scrollBy = ((o: ScrollToOptions) => { by.push(o.top ?? 0); }) as typeof window.scrollBy; });

  it('below the fold, asked while typing: scrolled up to clear the sticky button, focus left in the field', () => {
    const { input, q } = form();
    at(q, 730, 222);
    input.focus();
    questionAppeared(q);
    expect(by).toEqual([730 + 222 - (764 - 16)]);
    expect(document.activeElement).toBe(input);
  });

  it('never scrolls the field being typed in off the top, and does nothing when the question is already seen', () => {
    const { input, q } = form();
    at(q, 700, 900);
    bringIntoView(q, input);
    expect(by).toEqual([596 - 16]);
    by = [];
    at(q, 300, 200);
    bringIntoView(q, input);
    expect(by).toEqual([]);
  });

  it('shown when the page opens, not from typing: nothing moves', () => {
    const { q } = form();
    at(q, 730, 222);
    (document.activeElement as HTMLElement | null)?.blur();
    questionAppeared(q);
    expect(by).toEqual([]);
  });

  it('Continue or Save with it open: focus goes to it at once', () => {
    const { q } = form();
    q.scrollIntoView = () => {};
    focusQuestion(document, 'over-100');
    expect(document.activeElement).toBe(q);
  });
});
