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

/** How the app reaches the server's rows: the store's personPrefs and keepPersonPref. */
export interface PrefsServer {
  read(workspaceId: string): Promise<PersonPref[]>;
  keep(workspaceId: string, p: PersonPref): Promise<void>;
}

/** How a key's value on the server and this device's are made one before a write (build review of #485): each
    device holds the value as it loaded it, so writing it whole would drop what another device added since. */
export type PrefMerge = (onServer: unknown, here: unknown) => unknown;

export interface ServerPrefs extends Prefs {
  /** Takes every person's server rows for a workspace, as just loaded, and the server to write changes to. */
  adopt(workspaceId: string, rows: PersonPref[], server: PrefsServer): void;
}

/** `merges` holds one merge for each of SERVER_PREF_KEYS (the key's owner says how two copies combine). */
export function serverPrefs(local: Prefs, merges: Record<string, PrefMerge>): ServerPrefs {
  const kept = new Map<string, Map<string, unknown>>();
  let server: PrefsServer | null = null;
  const at = (person: string, key: string) => `${person}\u0000${key}`;
  const onServer = (key: string) => SERVER_PREF_KEYS.includes(key);
  /** Re-reads the server, merges this device's value into what is there, keeps the result here and writes it. */
  const write = async (srv: PrefsServer, ws: string, person: string, key: string, value: unknown) => {
    const there = (await srv.read(ws)).find((r) => r.personId === person && r.key === key);
    const merge = merges[key];
    const next = there && merge ? merge(there.value, value) : value;
    kept.get(ws)?.set(at(person, key), next);
    local.set(ws, person, key, next);
    await srv.keep(ws, { personId: person, key, value: next });
  };
  return {
    get<T>(ws: string, person: string, key: string): T | null {
      const here = onServer(key) ? kept.get(ws)?.get(at(person, key)) : undefined;
      return here === undefined ? local.get<T>(ws, person, key) : (here as T | null);
    },
    set(ws, person, key, value) {
      local.set(ws, person, key, value);
      if (!onServer(key) || !server || !kept.has(ws)) return;
      kept.get(ws)!.set(at(person, key), value ?? null);
      // Forgetting one is for this browser and this visit: the server keeps no empty value (its column is not null).
      if (value == null) return;
      // Kept here already; a failed read or write leaves the server as it was and this visit with the new value.
      write(server, ws, person, key, value).catch(() => {});
    },
    adopt(ws, rows, srv) {
      server = srv;
      kept.set(ws, new Map(rows.filter((r) => onServer(r.key)).map((r) => [at(r.personId, r.key), r.value])));
    },
  };
}
