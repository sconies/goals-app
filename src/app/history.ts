/* Older change-log entries than the app's windowed load holds (AX5 part 2b), for Activity and a goal's History. The load
   keeps entries from its window's start on plus anchors of any age (src/ports/window.ts); this pages the rest in from
   Store.history, newest first, a page at a time, and leaves out anchors the load already has. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Change } from '../domain/types';
import type { HistoryKey } from '../ports/store';
import { useApp } from './state';

export interface OlderChanges {
  /** Entries paged in so far, newest first, none of them already in the load. */
  older: Change[];
  /** Whether there may be more: the load was windowed and the last page wasn't the end. */
  more: boolean;
  /** Whether a page is on its way. */
  loading: boolean;
  /** Fetches the next page. */
  next(): void;
}

export function useOlderChanges(goalId?: string): OlderChanges {
  const app = useApp();
  const from = app.full.history?.from ?? null;
  // Strictly older than the window's start: every entry from it on is in the load already.
  const start: HistoryKey | null = from ? { at: from, id: '' } : null;
  const [state, setState] = useState<{ older: Change[]; before: HistoryKey | null; loading: boolean }>({ older: [], before: start, loading: false });
  const key = `${app.ws.id}|${goalId ?? ''}|${from ?? ''}`;
  const seen = useRef(key);
  useEffect(() => {
    if (seen.current === key) return;
    seen.current = key;
    setState({ older: [], before: start, loading: false });
    // start follows key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const { olderChanges, full } = app;
  const next = useCallback(() => {
    if (!state.before || state.loading) return;
    const asked = key;
    setState((s) => ({ ...s, loading: true }));
    olderChanges({ before: state.before, ...(goalId ? { goalId } : {}) }).then((page) => {
      if (seen.current !== asked) return;
      const loaded = new Set(full.changes.map((c) => c.id));
      setState((s) => ({ older: [...s.older, ...page.changes.filter((c) => !loaded.has(c.id))], before: page.next, loading: false }));
    }, () => {
      if (seen.current !== asked) return;
      setState((s) => ({ ...s, loading: false }));
      app.toast('Couldn’t fetch older changes. Try again in a moment.', 'error');
    });
  }, [state.before, state.loading, key, olderChanges, goalId, full, app]);
  return { older: state.older, more: !!state.before, loading: state.loading, next };
}
