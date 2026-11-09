/* Adapters that need no outside service (backlog 8c): who is viewing, chosen with the "Who are you?" picker and
   remembered in this browser; the clock; and files kept in memory (for tests, and as the smallest Files to copy). */
import type { Clock, Files, Identity } from '../ports';

/** "Who are you?": the person picked, per workspace, kept in this browser under `prefix` + the workspace's id. */
export function pickerIdentity(prefix: string, storage: () => Storage | null = () => { try { return localStorage; } catch { return null; } }): Identity {
  return {
    who(ws) { try { return storage()?.getItem(prefix + ws) ?? null; } catch { return null; } },
    choose(ws, id) { try { storage()?.setItem(prefix + ws, id); } catch { /* storage blocked: it lasts for this visit */ } },
  };
}

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
