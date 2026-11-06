/* Faro's teal is the default accent (6 Nov), with the earlier colours kept as choices, and a saved choice still counts. */
import { ACCENTS, applyAppearance, setAppearance } from './appearance';

describe('Accent colours', () => {
  it('offers Faro first, as the default, and keeps cobalt, violet, petrol and graphite', () => {
    expect(ACCENTS.map(([k]) => k)).toEqual(['faro', 'cobalt', 'violet', 'petrol', 'graphite']);
    expect(ACCENTS[0]![1]).toBe('Faro (teal)');
  });

  it('puts no data-accent on the page for the default, and stores nothing for it', () => {
    localStorage.clear();
    applyAppearance();
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
    setAppearance({ accent: 'faro' });
    expect(localStorage.getItem('goals-accent')).toBeNull();
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
  });

  it('keeps an earlier colour once chosen, cobalt included', () => {
    setAppearance({ accent: 'cobalt' });
    expect(localStorage.getItem('goals-accent')).toBe('cobalt');
    expect(document.documentElement.getAttribute('data-accent')).toBe('cobalt');
    setAppearance({ accent: 'faro' });
    expect(localStorage.getItem('goals-accent')).toBeNull();
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
  });
});
