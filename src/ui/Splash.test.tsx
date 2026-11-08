// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { SPLASH_SEEN, SPLASH_TIMING, Splash, shouldShowSplash } from './Splash';

const store = (seen?: string) => { const m = new Map<string, string>(seen ? [[SPLASH_SEEN, seen]] : []); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe('Faro’s splash', () => {
  it('shows once per browser session, which is once per launch', () => {
    expect(shouldShowSplash({ webdriver: false, forced: false, storage: store() })).toBe(true);
    expect(shouldShowSplash({ webdriver: false, forced: false, storage: store('1') })).toBe(false);
  });

  it('never shows to an automated browser (the evals) unless it asks', () => {
    expect(shouldShowSplash({ webdriver: true, forced: false, storage: store() })).toBe(false);
    expect(shouldShowSplash({ webdriver: true, forced: true, storage: store() })).toBe(true);
  });

  it('is about 1.5 seconds, and draws the whole logo without words for screen readers', () => {
    expect(SPLASH_TIMING.outAt + SPLASH_TIMING.out).toBeLessThanOrEqual(1600);
    expect(SPLASH_TIMING.reduced.in).toBeLessThan(250);
    const { container } = render(<Splash onDone={() => {}} />);
    expect(container.querySelectorAll('.sp-letter')).toHaveLength(3);
    expect([...container.querySelectorAll('svg')].every((s) => s.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});
