// @vitest-environment jsdom
/* Faro's teal is the default accent (6 Nov), with the earlier colours kept as choices, and a saved choice still counts. */
import { ACCENTS, applyAppearance, setAppearance, storyOn } from './appearance';

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

/* Backlog T (8 Nov): a goal's page is readable the moment it opens; its slow story is the Motion lab's to switch on. */
describe('The goal page story', () => {
  it('is off by default, stores nothing for it, and marks the page only when switched on', () => {
    localStorage.clear();
    applyAppearance();
    expect(storyOn()).toBe(false);
    expect(document.documentElement.hasAttribute('data-story')).toBe(false);
    setAppearance({ story: true });
    expect(storyOn()).toBe(true);
    expect(localStorage.getItem('goals-story')).toBe('1');
    expect(document.documentElement.hasAttribute('data-story')).toBe(true);
    setAppearance({ story: false });
    expect(localStorage.getItem('goals-story')).toBeNull();
    expect(document.documentElement.hasAttribute('data-story')).toBe(false);
  });
});
