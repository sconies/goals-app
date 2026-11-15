/* Senders see their own feedback (deep dive, 15 Nov, item 8). On the live site the inbox reads the shared database,
   but feedback sent in the demo is kept in this browser's copy of the example, so it never came back to its sender. */
import { withOwnSent, type InboxFeedback } from './feedback';

const fb = (id: string, personId: string, at: string): InboxFeedback => ({
  id, workspaceId: 'platform-org', workspaceName: 'Example', personId, personName: personId, path: '/', mood: 'bad', text: id, at,
  status: 'new', fixedIn: null, wontFixReason: null, statusBy: null, statusAt: null,
});

describe('feedback a sender sees', () => {
  const shared = [fb('f-shared', 'amara', '2026-11-05T09:00:00Z')];
  const here = [fb('f-oskar', 'oskar', '2026-11-05T10:00:00Z'), fb('f-rhea', 'rhea', '2026-11-05T11:00:00Z')];

  it('lists the sender’s own feedback kept in this browser beside the shared inbox, newest first, marked as only here', () => {
    const out = withOwnSent(shared, here, 'oskar');
    expect(out.map((f) => f.id)).toEqual(['f-oskar', 'f-shared']);
    expect(out[0]!.onlyHere).toBe(true);
    expect(out[1]!.onlyHere).toBeUndefined();
  });

  it('never lists anyone else’s, nor one the shared inbox already has', () => {
    expect(withOwnSent(shared, here, 'tunde')).toEqual(shared);
    expect(withOwnSent([...shared, here[0]!], here, 'oskar').filter((f) => f.id === 'f-oskar')).toHaveLength(1);
  });
});
