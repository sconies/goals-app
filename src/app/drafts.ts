/* Drafts survive a closed tab or a lost train of thought. They are never logged: only saves are. */
import { useCallback, useState } from 'react';

const PREFIX = 'goals-app-draft:';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* storage blocked */ }
}

/** A draft's contents without restoring it, to offer it back by name. */
export function peekDraft<T>(key: string): T | null {
  return read<T>(key);
}

export function hasDraft(key: string): boolean {
  return read(key) != null;
}

/** State that is saved as you type and restored when you come back. */
export function useDraft<T extends object>(key: string, initial: () => T): [T, (patch: Partial<T>) => void, () => void, boolean] {
  const [restored] = useState(() => read<T>(key) != null);
  const [value, setValue] = useState<T>(() => ({ ...initial(), ...(read<T>(key) ?? {}) }));
  const set = useCallback((patch: Partial<T>) => {
    setValue((v) => {
      const next = { ...v, ...patch };
      try { localStorage.setItem(PREFIX + key, JSON.stringify(next)); } catch { /* storage blocked */ }
      return next;
    });
  }, [key]);
  const clear = useCallback(() => clearDraft(key), [key]);
  return [value, set, clear, restored];
}

export const checkInDraftKey = (ws: string, goalId: string, week: number) => `${ws}:checkin:${goalId}:${week}`;
export const goalDraftKey = (ws: string, goalId: string | null) => `${ws}:goal:${goalId ?? 'new'}`;
