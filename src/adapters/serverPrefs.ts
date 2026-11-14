/* The Prefs port's server side (migration 0053, PP1): the few keys that should follow a person between devices are
   kept on the server as well as in this browser, so a proposed goal opened on a phone reads as opened on the laptop
   (Lane, 14 Nov). Everything else stays in this browser only.

   Prefs are read as screens draw, so they can't wait for the network: the person's rows arrive with the workspace
   (`adopt`, from the store's `personPrefs`) and are read from memory; a change is kept here at once and sent to the
   server behind it (`keep`, the store's `keepPersonPref`). Until the server has a value for a key, this browser's is
   read. A store with no server (the demo, a workspace kept in this browser) never adopts, and this is browser Prefs. */
import type { Prefs } from '../ports/prefs';
import type { PersonPref } from '../ports/store';

/** The keys kept on the server: exactly the ones migration 0053's `person_prefs_key_check` allows. */
export const SERVER_PREF_KEYS: readonly string[] = ['proposals'];

export interface ServerPrefs extends Prefs {
  /** Takes every person's server rows for a workspace, as just loaded, and where to send this browser's changes. */
  adopt(workspaceId: string, rows: PersonPref[], keep: (workspaceId: string, p: PersonPref) => Promise<void>): void;
}

export function serverPrefs(local: Prefs): ServerPrefs {
  const kept = new Map<string, Map<string, unknown>>();
  let send: ((workspaceId: string, p: PersonPref) => Promise<void>) | null = null;
  const at = (person: string, key: string) => `${person}\u0000${key}`;
  const onServer = (key: string) => SERVER_PREF_KEYS.includes(key);
  return {
    get<T>(ws: string, person: string, key: string): T | null {
      const here = onServer(key) ? kept.get(ws)?.get(at(person, key)) : undefined;
      return here === undefined ? local.get<T>(ws, person, key) : (here as T | null);
    },
    set(ws, person, key, value) {
      local.set(ws, person, key, value);
      if (!onServer(key) || !send || !kept.has(ws)) return;
      kept.get(ws)!.set(at(person, key), value ?? null);
      // Forgetting one is for this browser and this visit: the server keeps no empty value (its column is not null).
      if (value == null) return;
      // Kept here already; a failed send leaves the server as it was and this visit with the new value.
      send(ws, { personId: person, key, value }).catch(() => {});
    },
    adopt(ws, rows, keep) {
      send = keep;
      kept.set(ws, new Map(rows.filter((r) => onServer(r.key)).map((r) => [at(r.personId, r.key), r.value])));
    },
  };
}
