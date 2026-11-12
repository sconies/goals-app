import { describe, expect, it, beforeEach } from 'vitest';
import { isStaleCodeError, recoverFromStaleCode, reloadOnce, resetStaleCode, RELOAD_WINDOW_MS } from './staleCode';

function env(start = 1_000_000) {
  const store = new Map<string, string>();
  const e = {
    t: start,
    reloads: 0,
    storage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } },
    reload: () => { e.reloads++; },
    now: () => e.t,
    isOnline: true,
    online: () => e.isOnline,
  };
  return e;
}

describe('stale code after a deploy (review F16)', () => {
  beforeEach(() => resetStaleCode());

  it('recognises a part of the build that has gone, in each browser’s words', () => {
    expect(isStaleCodeError(new TypeError('Failed to fetch dynamically imported module: https://faro.app/assets/GoalMap-abc.js'))).toBe(true);
    expect(isStaleCodeError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isStaleCodeError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleCodeError(new Error('Unable to preload CSS for /assets/map.css'))).toBe(true);
    expect(isStaleCodeError(new TypeError("Cannot read properties of undefined (reading 'name')"))).toBe(false);
    expect(isStaleCodeError(null)).toBe(false);
  });

  it('reloads once, and shows the error if the same thing fails again just after', () => {
    const e = env();
    expect(recoverFromStaleCode(new TypeError('Failed to fetch dynamically imported module'), e)).toBe(true);
    expect(e.reloads).toBe(1);
    // The reloaded page: a new page, the same tab.
    resetStaleCode();
    e.t += 5_000;
    expect(recoverFromStaleCode(new TypeError('Failed to fetch dynamically imported module'), e)).toBe(false);
    expect(e.reloads).toBe(1);
    // Much later, after another deploy: once more.
    resetStaleCode();
    e.t += RELOAD_WINDOW_MS;
    expect(reloadOnce(e)).toBe(true);
    expect(e.reloads).toBe(2);
  });

  it('asks for one reload when two parts fail together', () => {
    const e = env();
    expect(reloadOnce(e)).toBe(true);
    expect(reloadOnce(e)).toBe(true);
    expect(e.reloads).toBe(1);
  });

  it('never reloads an error that isn’t stale code, nor without a way to remember it did', () => {
    const e = env();
    expect(recoverFromStaleCode(new Error('boom'), e)).toBe(false);
    expect(reloadOnce({ storage: null, reload: e.reload, now: e.now })).toBe(false);
    expect(e.reloads).toBe(0);
  });

  it('never reloads while offline, and still reloads once when back online (#167)', () => {
    const e = env();
    e.isOnline = false;
    expect(recoverFromStaleCode(new TypeError('Failed to fetch dynamically imported module'), e)).toBe(false);
    expect(reloadOnce(e)).toBe(false);
    expect(e.reloads).toBe(0);
    e.isOnline = true;
    expect(recoverFromStaleCode(new TypeError('Failed to fetch dynamically imported module'), e)).toBe(true);
    expect(e.reloads).toBe(1);
  });
});
