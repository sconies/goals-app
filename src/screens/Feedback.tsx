/* Feedback: the inbox of markups and feedback, in its own place beside Help (backlog WS, Lane 9 Nov). It was a section
   of Workspace, but it reads every workspace and the demo, so it belongs to none of them: "From every workspace and
   the demo". Still open to everyone, with every status change recorded and undoable (backlog O); it names people,
   never their email. The old address, /workspace/inbox, leads here. The inbox itself is src/markup/Inbox.tsx. */
import { lazy, Suspense, useState } from 'react';
import { useInboxData } from '../markup/inboxData';
import { useWidth } from '../ui/useWidth';

const Inbox = lazy(() => import('../markup/Inbox'));
/** Below this width, the inbox shows one item at a time (a phone). */
const NARROW = 720;

export function Feedback({ onSend }: { onSend?: () => void }) {
  const data = useInboxData();
  const [ref, width] = useWidth<HTMLDivElement>();
  const narrow = width > 0 && width < NARROW;
  const [sending, setSending] = useState(false);
  return (
    <div className={'page feedback-page' + (narrow ? ' ws-narrow' : '')} ref={ref}>
      <div className="page-head wsp-head">
        <div className="row between" style={{ alignItems: 'baseline', gap: 'var(--s3)', flexWrap: 'wrap' }}>
          <h1 className="title-xl">Feedback</h1>
          {onSend && <button type="button" className="btn" aria-expanded={sending} onClick={() => { setSending(true); onSend(); setSending(false); }}>Send feedback</button>}
        </div>
        <span className="hint">{data.shared ? 'From every workspace and the demo.' : 'From this browser and this workspace: no database is set up.'} Anyone can read it and send feedback; only an admin changes a status, and every change says who made it and can be undone.</span>
      </div>
      <Suspense fallback={<p className="hint" role="status">Opening the inbox…</p>}><Inbox data={data} narrow={narrow} inPage /></Suspense>
    </div>
  );
}
