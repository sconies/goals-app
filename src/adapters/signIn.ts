/* An Identity from a sign-in (backlog AX3): the shape a company's single sign-on plugs into. The sign-in says who is
   signed in, by email; the person is whoever in the workspace has that email (spec/requirements/internal R1, rule 2):
   lower case, one per workspace, and nobody once marked as left or removed. It has no `choose`: who you are is not a
   choice. Faro itself uses the picker (adapters/local.ts); this is here to copy, and its contract runs on it. */
import type { Identity } from '../ports';
import type { Person } from '../domain/types';

export function signInIdentity(signedInEmail: () => Promise<string | null>, peopleOf: (workspaceId: string) => Promise<Person[]>): Identity {
  return {
    async current(ws) {
      const email = (await signedInEmail())?.trim().toLowerCase();
      if (!email) return null;
      const match = (await peopleOf(ws)).filter((p) => !p.leftAt && !p.removedAt && p.email?.trim().toLowerCase() === email);
      return match.length === 1 ? match[0]!.id : null;
    },
  };
}
