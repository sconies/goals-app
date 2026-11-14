import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { browserPrefs } from './local';
import { serverPrefs, SERVER_PREF_KEYS } from './serverPrefs';
import { markOpened, mergeProposals, proposalSeen, putOff } from '../app/proposalSeen';
import type { PersonPref } from '../ports/store';
import { PREF_MERGES } from '../app/prefs';

/** A Storage in memory, one per device. */
function device() {
  const m = new Map<string, string>();
  const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as unknown as Storage;
  return serverPrefs(browserPrefs('t:', () => storage), { proposals: mergeProposals });
}

/** Lets the writes in flight (a read, then a write) finish. */
const settle = () => new Promise((r) => setTimeout(r, 0));

/** The server's person_prefs, as the store reads and writes it. */
function server() {
  const rows = new Map<string, PersonPref>();
  return {
    rows: (): PersonPref[] => [...rows.values()],
    read: async (): Promise<PersonPref[]> => [...rows.values()],
    keep: async (_ws: string, p: PersonPref) => { rows.set(`${p.personId}:${p.key}`, p); },
  };
}

describe('Prefs kept on the server (PP1, migration 0053)', () => {
  it('a proposed goal opened on one device reads as opened on another', async () => {
    const db = server();
    const phone = device();
    const laptop = device();
    phone.adopt('ws', db.rows(), db);
    laptop.adopt('ws', db.rows(), db);
    markOpened(phone, 'ws', 'tunde', 'g1');
    await settle();
    expect(proposalSeen(laptop, 'ws', 'tunde').opened.has('g1')).toBe(false);
    laptop.adopt('ws', db.rows(), db); // the laptop's next load
    expect(proposalSeen(laptop, 'ws', 'tunde').opened.has('g1')).toBe(true);
    expect(proposalSeen(laptop, 'ws', 'oskar').opened.size).toBe(0);
  });

  it('two devices open at once keep each other’s (build review of #485): each merges into the server’s before writing', async () => {
    const db = server();
    const laptop = device();
    const phone = device();
    laptop.adopt('ws', db.rows(), db);
    markOpened(laptop, 'ws', 'tunde', 'A');
    await settle();
    phone.adopt('ws', db.rows(), db);
    markOpened(phone, 'ws', 'tunde', 'B');
    putOff(phone, 'ws', 'tunde', 'P', new Date('2026-11-14T12:00:00Z'));
    await settle();
    // The laptop was never reloaded: its copy is stale (A only), and it opens C and puts P off from an earlier day.
    markOpened(laptop, 'ws', 'tunde', 'C');
    putOff(laptop, 'ws', 'tunde', 'P', new Date('2026-11-01T12:00:00Z'));
    await settle();
    const kept = db.rows().find((r) => r.personId === 'tunde')!.value as { opened: string[]; putOff: Record<string, string> };
    expect([...kept.opened].sort()).toEqual(['A', 'B', 'C']);
    expect(kept.putOff.P).toBe('2027-01-09');
    // And the laptop reads the merged copy straight away, without a reload.
    expect(proposalSeen(laptop, 'ws', 'tunde').opened.has('B')).toBe(true);
  });

  it('keeps every other preference in this browser only', async () => {
    const db = server();
    const phone = device();
    phone.adopt('ws', db.rows(), db);
    phone.set('ws', 'tunde', 'recents', [{ kind: 'goal', id: 'g1' }]);
    await settle();
    expect(db.rows()).toEqual([]);
    expect(phone.get('ws', 'tunde', 'recents')).toEqual([{ kind: 'goal', id: 'g1' }]);
    expect(SERVER_PREF_KEYS).toEqual(['proposals']);
  });

  it('reads this browser’s value until the server has one, and with no server is browser Prefs', () => {
    const alone = device();
    markOpened(alone, 'ws', 'tunde', 'g1');
    expect(proposalSeen(alone, 'ws', 'tunde').opened.has('g1')).toBe(true);
    const db = server();
    alone.adopt('ws', db.rows(), db);
    expect(proposalSeen(alone, 'ws', 'tunde').opened.has('g1')).toBe(true);
  });

  it('a failed send keeps the change for this visit', () => {
    const phone = device();
    phone.adopt('ws', [], { read: () => Promise.reject(new Error('offline')), keep: () => Promise.reject(new Error('offline')) });
    markOpened(phone, 'ws', 'tunde', 'g1');
    expect(proposalSeen(phone, 'ws', 'tunde').opened.has('g1')).toBe(true);
  });
});

describe('mergeProposals', () => {
  it('keeps every goal either copy opened and each put-off’s later day', () => {
    expect(mergeProposals({ opened: ['a'], putOff: { x: '2027-01-01', y: '2027-03-01' } }, { opened: ['b', 'a'], putOff: { x: '2027-02-01' } }))
      .toEqual({ opened: ['a', 'b'], putOff: { x: '2027-02-01', y: '2027-03-01' } });
    expect(mergeProposals(null, { opened: ['a'] })).toEqual({ opened: ['a'], putOff: {} });
  });
});

describe('the keys kept on the server', () => {
  it('are exactly the ones migration 0053 allows', () => {
    const sql = readFileSync('supabase/migrations/0053_person_prefs.sql', 'utf8');
    expect(sql).toContain(`check (key in (${SERVER_PREF_KEYS.map((k) => `'${k}'`).join(', ')}))`);
  });
  it('each has a merge, so no device’s write drops another’s', () => {
    expect(Object.keys(PREF_MERGES).sort()).toEqual([...SERVER_PREF_KEYS].sort());
  });
});
