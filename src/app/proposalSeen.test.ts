import { describe, expect, it } from 'vitest';
import { markOpened, proposalSeen, putOff } from './proposalSeen';
import type { Prefs } from '../ports/prefs';

const memory = (): Prefs => { const m = new Map<string, unknown>(); return { get: <T,>(w: string, p: string, k: string) => (m.get(`${w}|${p}|${k}`) as T) ?? null, set: (w, p, k, v) => { m.set(`${w}|${p}|${k}`, v); } }; };

describe('what Home’s proposal rows know (rule 14)', () => {
  it('keeps what the owner opened and puts a stale ask off for 8 weeks', () => {
    const p = memory();
    expect(proposalSeen(p, 'ws', 'tunde').opened.size).toBe(0);
    markOpened(p, 'ws', 'tunde', 'g1');
    markOpened(p, 'ws', 'tunde', 'g1');
    putOff(p, 'ws', 'tunde', 'g2', new Date('2027-01-15T12:00:00Z'));
    const seen = proposalSeen(p, 'ws', 'tunde');
    expect([...seen.opened]).toEqual(['g1']);
    expect(seen.putOff.get('g2')).toBe('2027-03-12');
    // Another person's are their own.
    expect(proposalSeen(p, 'ws', 'oskar').opened.size).toBe(0);
  });
});
