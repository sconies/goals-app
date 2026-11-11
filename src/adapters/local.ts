/* Adapters that need no outside service (backlog 8c): who is viewing, chosen with the "Who are you?" picker and
   remembered in this browser; the clock; and files kept in memory (for tests, and as the smallest Files to copy). */
import type { Clock, Files, Picker, Prefs } from '../ports';

/** "Who are you?": the person picked, per workspace, kept in this browser under `prefix` + the workspace's id. */
export function pickerIdentity(prefix: string, storage: () => Storage | null = () => { try { return localStorage; } catch { return null; } }): Picker {
  return {
    async current(ws) { try { return storage()?.getItem(prefix + ws) ?? null; } catch { return null; } },
    choose(ws, id) { try { storage()?.setItem(prefix + ws, id); } catch { /* storage blocked: it lasts for this visit */ } },
  };
}

/** The picker the app uses when it is given no Identity: the demo and the real app remember their own person. */
export const viewerPicker = (mode: 'demo' | 'live'): Picker => pickerIdentity(mode === 'demo' ? 'goals-app-viewer:' : 'goals-live-me:');

export const systemClock: Clock = () => new Date();
/** A clock stopped at one moment, for the demo (`?today=`) and the evals. */
export const fixedClock = (at: Date): Clock => { const t = new Date(at); return () => new Date(t); };

/** Files in memory, with data addresses. */
export function memoryFiles(): Files {
  const kept = new Map<string, { data: Uint8Array; type: string }>();
  return {
    async put(path, data, type) {
      if (kept.has(path)) throw new Error(`There’s already a file at ${path}.`);
      kept.set(path, { data: new Uint8Array(await data.arrayBuffer()), type });
    },
    async url(path) {
      const f = kept.get(path);
      return f ? `data:${f.type};base64,${btoa(Array.from(f.data, (b) => String.fromCharCode(b)).join(''))}` : null;
    },
    async bytes(path) { return kept.get(path)?.data ?? null; },
  };
}

/** Prefs kept in this browser, one entry per workspace, person and key: `prefix` + "ws:person:key", as JSON. */
export function browserPrefs(prefix: string, storage: () => Storage | null = () => { try { return localStorage; } catch { return null; } }): Prefs {
  const at = (ws: string, person: string, key: string) => `${prefix}${ws}:${person}:${key}`;
  return {
    get<T>(ws: string, person: string, key: string): T | null {
      try { const v = storage()?.getItem(at(ws, person, key)); return v == null ? null : (JSON.parse(v) as T); } catch { return null; }
    },
    set(ws, person, key, value) {
      try { if (value == null) storage()?.removeItem(at(ws, person, key)); else storage()?.setItem(at(ws, person, key), JSON.stringify(value)); } catch { /* storage blocked: it lasts for this visit */ }
    },
  };
}
