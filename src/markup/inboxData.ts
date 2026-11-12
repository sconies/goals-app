/* The inbox's markups and feedback, loaded once for Workspace: its menu shows the New count beside Inbox, and the Inbox
   section lists them (backlog W). Open to anyone, with no sign-in (backlog O): on the shared database, or, with none,
   the markups kept in this browser and this workspace's feedback. A change of status goes through the shared rule
   (statusPatch, via markupOps and feedbackOps) for every markup or piece of feedback a row stands for, and can be undone
   the same way. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/state';
import { inboxFeedback, inboxOps, markupsShared } from './backend';
import type { FeedbackOps, InboxFeedback } from './feedback';
import { newCount } from './inboxList';
import { undoChange, type Markup, type StatusChange } from './model';
import type { ListedMarkup, MarkupOps } from './ops';

/** How many of each the inbox reads: the newest 500 of each, enough for hundreds of items. */
const READ = 500;

export interface InboxData {
  /** Whether the inbox reads the shared database (every workspace and the demo) or this browser. */
  shared: boolean;
  ops: MarkupOps | null;
  fbOps: FeedbackOps | null;
  /** Null until the markups have loaded. */
  markups: ListedMarkup[] | null;
  feedback: InboxFeedback[];
  problem: string;
  /** Every new markup and piece of feedback: the count beside Inbox in the menu. Null until loaded. */
  newCount: number | null;
  reload(): Promise<void>;
  /** Changes the status of every markup and piece of feedback named, through the shared rule, as the person using the
      app. Gives back the change that undoes it all. */
  setStatus(ids: { markups: string[]; feedback: string[] }, c: Omit<StatusChange, 'by' | 'admin'>): Promise<() => Promise<void>>;
  /** Puts a markup changed elsewhere (the issue's address) into the list. */
  patchMarkup(m: Markup): void;
}

export function useInboxData(): InboxData {
  const app = useApp();
  const shared = markupsShared();
  const [ops, setOps] = useState<MarkupOps | null>(null);
  const [fbOps, setFbOps] = useState<FeedbackOps | null>(null);
  const [markups, setMarkups] = useState<ListedMarkup[] | null>(null);
  const [feedback, setFeedback] = useState<InboxFeedback[]>([]);
  const [problem, setProblem] = useState('');
  // With no database, the inbox's feedback is this workspace's, as the app has it now.
  const appNow = useRef(app);
  appNow.current = app;
  const here = useMemo(() => ({
    workspaceId: app.ws.id, workspaceName: app.ws.name,
    feedback: () => appNow.current.snapshot.feedback ?? [],
    personName: (id: string) => appNow.current.person(id)?.name ?? '',
  }), [app.ws.id, app.ws.name]);

  useEffect(() => {
    let live = true;
    void Promise.all([inboxOps(), inboxFeedback(here)]).then(([m, f]) => { if (live) { setOps(m); setFbOps(f); } }, (e: unknown) => { if (live) setProblem(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [here]);

  const reload = useCallback(async () => {
    if (!ops) return;
    // Feedback is listed when the database can give it (migration 0026); without it the inbox still shows markups.
    const [m, f] = await Promise.all([
      ops.list({ limit: READ }).catch((e: unknown) => { appNow.current.toast(e instanceof Error ? e.message : String(e), 'error'); return [] as ListedMarkup[]; }),
      fbOps ? fbOps.list(READ).catch(() => [] as InboxFeedback[]) : Promise.resolve([] as InboxFeedback[]),
    ]);
    setMarkups(m); setFeedback(f);
  }, [ops, fbOps]);
  useEffect(() => { void reload(); }, [reload]);

  const setStatus = useCallback<InboxData['setStatus']>(async (ids, c) => {
    if (!ops) throw new Error('The inbox isn’t ready yet.');
    const by = appNow.current.viewer.name, admin = !!appNow.current.viewer.admin;
    const beforeM = new Map((markups ?? []).filter((m) => ids.markups.includes(m.id)).map((m) => [m.id, { status: m.status, fixedIn: m.fixedIn, wontFixReason: m.wontFixReason }]));
    const beforeF = new Map(feedback.filter((f) => ids.feedback.includes(f.id)).map((f) => [f.id, { status: f.status, fixedIn: f.fixedIn, wontFixReason: f.wontFixReason }]));
    const apply = async (forM: (id: string) => StatusChange, forF: (id: string) => StatusChange) => {
      const doneM = await Promise.all(ids.markups.map((id) => ops.setStatus(id, forM(id))));
      const doneF = fbOps ? await Promise.all(ids.feedback.map(async (id) => [id, await fbOps.setStatus(id, forF(id))] as const)) : [];
      const m = new Map(doneM.map((x) => [x.id, x]));
      const f = new Map(doneF);
      setMarkups((xs) => xs && xs.map((x) => (m.has(x.id) ? { ...x, ...m.get(x.id)! } : x)));
      setFeedback((xs) => xs.map((x) => (f.has(x.id) ? { ...x, ...f.get(x.id)! } : x)));
    };
    await apply(() => ({ ...c, by, admin }), () => ({ ...c, by, admin }));
    return async () => {
      const who = appNow.current.viewer.name, still = !!appNow.current.viewer.admin;
      await apply((id) => undoChange(beforeM.get(id)!, who, still), (id) => undoChange(beforeF.get(id)!, who, still));
    };
  }, [ops, fbOps, markups, feedback]);

  const patchMarkup = useCallback((next: Markup) => setMarkups((xs) => xs && xs.map((x) => (x.id === next.id ? { ...x, ...next } : x))), []);

  return {
    shared, ops, fbOps, markups, feedback, problem, reload, setStatus, patchMarkup,
    newCount: markups ? newCount(markups, feedback) : null,
  };
}
