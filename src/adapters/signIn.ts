/* An Identity from a sign-in (backlog AX3): the shape a company's single sign-on plugs into. The sign-in says who is
   signed in, by email; the person is whoever in the workspace has that email (spec/requirements/internal R1, rule 2):
   lower case, one per workspace, and nobody once marked as left or removed. It has no `choose`: who you are is not a
   choice. When it opens no one, `why` says which of the four reasons it is, for the page that turns them away.
   Faro itself uses the picker (adapters/local.ts); this is here to copy, and its contract runs on it. */
import type { Identity, NoEntry } from '../ports';
import type { Person } from '../domain/types';

/** The person a signed-in email opens in a workspace's people, or why it opens no one. */
export function matchSignIn(signedIn: string | null | undefined, people: readonly Person[]): { id: string } | NoEntry {
  const email = signedIn?.trim().toLowerCase();
  if (!email) return { reason: 'signed-out' };
  const same = people.filter((p) => p.email?.trim().toLowerCase() === email);
  const here = same.filter((p) => !p.leftAt && !p.removedAt);
  if (here.length === 1) return { id: here[0]!.id };
  if (here.length > 1) return { reason: 'shared', email };
  return { reason: same.length ? 'left' : 'no-one', email };
}

export function signInIdentity(signedInEmail: () => Promise<string | null>, peopleOf: (workspaceId: string) => Promise<Person[]>): Identity {
  const match = async (ws: string) => matchSignIn(await signedInEmail(), await peopleOf(ws));
  return {
    async current(ws) { const m = await match(ws); return 'id' in m ? m.id : null; },
    async why(ws) { const m = await match(ws); return 'id' in m ? null : m; },
  };
}
