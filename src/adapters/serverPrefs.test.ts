import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { browserPrefs } from './local';
import { serverPrefs, SERVER_PREF_KEYS } from './serverPrefs';
import { markOpened, proposalSeen } from '../app/proposalSeen';
import type { PersonPref } from '../ports/store';

/** A Storage in memory, one per device. */
function device() {
  const m = new Map<string, string>();
  const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as unknown as Storage;
  return serverPrefs(browserPrefs('t:', () => storage));
}

/** The server's person_prefs, as the store reads and writes it. */
function server() {
  const rows = new Map<string, PersonPref>();
  return {
    read: (): PersonPref[] => [...rows.values()],
    keep: async (_ws: string, p: PersonPref) => { rows.set(`${p.personId}:${p.key}`, p); },
  };
}

describe('Prefs kept on the server (PP1, migration 0053)', () => {
  it('a proposed goal opened on one device reads as opened on another', async () => {
    const db = server();
    const phone = device();
    const laptop = device();
    phone.adopt('ws', db.read(), db.keep);
    laptop.adopt('ws', db.read(), db.keep);
    markOpened(phone, 'ws', 'tunde', 'g1');
    await Promise.resolve();
    expect(proposalSeen(laptop, 'ws', 'tunde').opened.has('g1')).toBe(false);
    laptop.adopt('ws', db.read(), db.keep); // the laptop's next load
    expect(proposalSeen(laptop, 'ws', 'tunde').opened.has('g1')).toBe(true);
    expect(proposalSeen(laptop, 'ws', 'oskar').opened.size).toBe(0);
  });

  it('keeps every other preference in this browser only', async () => {
    const db = server();
    const phone = device();
    phone.adopt('ws', db.read(), db.keep);
    phone.set('ws', 'tunde', 'recents', [{ kind: 'goal', id: 'g1' }]);
    await Promise.resolve();
    expect(db.read()).toEqual([]);
    expect(phone.get('ws', 'tunde', 'recents')).toEqual([{ kind: 'goal', id: 'g1' }]);
    expect(SERVER_PREF_KEYS).toEqual(['proposals']);
  });

  it('reads this browser’s value until the server has one, and with no server is browser Prefs', () => {
    const alone = device();
    markOpened(alone, 'ws', 'tunde', 'g1');
    expect(proposalSeen(alone, 'ws', 'tunde').opened.has('g1')).toBe(true);
    const db = server();
    alone.adopt('ws', db.read(), db.keep);
    expect(proposalSeen(alone, 'ws', 'tunde').opened.has('g1')).toBe(true);
  });

  it('a failed send keeps the change for this visit', () => {
    const phone = device();
    phone.adopt('ws', [], () => Promise.reject(new Error('offline')));
    markOpened(phone, 'ws', 'tunde', 'g1');
    expect(proposalSeen(phone, 'ws', 'tunde').opened.has('g1')).toBe(true);
  });
});

describe('the keys kept on the server', () => {
  it('are exactly the ones migration 0053 allows', () => {
    const sql = readFileSync('supabase/migrations/0053_person_prefs.sql', 'utf8');
    expect(sql).toContain(`check (key in (${SERVER_PREF_KEYS.map((k) => `'${k}'`).join(', ')}))`);
  });
});
