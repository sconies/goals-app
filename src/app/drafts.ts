/* Drafts survive a closed tab or a lost train of thought. They are never logged: only saves are. */
import { useCallback, useState } from 'react';

const PREFIX = 'goals-app-draft:';

/* The browser's storage, in three places only (scripts/browser-storage.json); each forgives storage that is blocked. */
const get = (k: string): string | null => { try { return localStorage.getItem(PREFIX + k); } catch { return null; } };
const put = (k: string, v: string): void => { try { localStorage.setItem(PREFIX + k, v); } catch { /* storage blocked */ } };
const drop = (k: string): void => { try { localStorage.removeItem(PREFIX + k); } catch { /* storage blocked */ } };

function read<T>(key: string): T | null {
  try {
    const raw = get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** When a draft was last kept, beside it, to say a resumed draft's day ("Draft from Tuesday": FORM-FOOTER 3.4.3). */
const AT = '@at';
export function clearDraft(key: string) {
  drop(key); drop(key + AT);
}
/** When the draft at `key` was last kept (ms), or null when it says nothing (kept before this was recorded). */
export function draftSavedAt(key: string): number | null {
  const n = Number(get(key + AT));
  return n > 0 ? n : null;
}

/** A draft's contents without restoring it, to offer it back by name. */
export function peekDraft<T>(key: string): T | null {
  return read<T>(key);
}

/** Save a draft whole, from somewhere other than the screen that owns it (the one-table check-in shares the check-in's). */
export function writeDraft<T>(key: string, value: T) {
  put(key, JSON.stringify(value));
}

export function hasDraft(key: string): boolean {
  return read(key) != null;
}

/** State that is saved as you type and restored when you come back. */
/** A draft kept in this browser: its value, a setter that keeps every change, clear, whether it was there on arrival, and
    whether one is kept now (restored, or something typed since), which a form's Close says ("Close" until then: FORM-FOOTER). */
/** `quiet`: a change that isn't typing (the step a form is on). It is kept with a draft that exists, but makes none, and
    the form's Close still says "Close" (FORM-FOOTER: `touched` only for typing, not a step change). */
export function useDraft<T extends object>(key: string, initial: () => T): [T, (patch: Partial<T>, quiet?: boolean) => void, () => void, boolean, boolean] {
  const [restored] = useState(() => read<T>(key) != null);
  const [touched, setTouched] = useState(restored);
  const [value, setValue] = useState<T>(() => ({ ...initial(), ...(read<T>(key) ?? {}) }));
  const set = useCallback((patch: Partial<T>, quiet = false) => {
    setValue((v) => {
      const next = { ...v, ...patch };
      if (!quiet || get(key) != null) put(key, JSON.stringify(next));
      if (!quiet) put(key + AT, String(Date.now()));
      return next;
    });
    if (!quiet) setTouched(true);
  }, [key]);
  const clear = useCallback(() => clearDraft(key), [key]);
  return [value, set, clear, restored, touched];
}

export const checkInDraftKey = (ws: string, goalId: string, week: number) => `${ws}:checkin:${goalId}:${week}`;
/** Where the one-by-one check-in keeps the step a draft was left at (outside the drafts' prefix, as it always has been). */
export const checkInStepKey = (ws: string, goalId: string, week: number) => checkInDraftKey(ws, goalId, week) + ':step';
export const goalDraftKey = (ws: string, goalId: string | null) => `${ws}:goal:${goalId ?? 'new'}`;
