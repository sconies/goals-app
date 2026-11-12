// @vitest-environment node
/* A sign-in by email opens the one person here with that email (R1, rule 2), and when it opens no one it says which of
   the four reasons it is: the page that turns someone away tells the truth (build review of #154, finding 5). */
import type { Person } from '../domain/types';
import { matchSignIn, signInIdentity } from './signIn';

const person = (id: string, email: string, more: Partial<Person> = {}) => ({ id, name: id, role: '', initials: '', teamId: null, admin: false, email, ...more }) as Person;
const people = [
  person('ada', 'ada@example.com'),
  person('sam1', 'sam@example.com'), person('sam2', 'Sam@Example.com '),
  person('oskar', 'oskar@example.com', { leftAt: '2026-10-01' }),
  person('rex', 'rex@example.com', { removedAt: '2026-10-01' }),
];

describe('matchSignIn', () => {
  it('opens the one person with the email, whatever its case and spaces', () => {
    expect(matchSignIn(' ADA@example.com', people)).toEqual({ id: 'ada' });
  });
  it('says why it opens no one', () => {
    expect(matchSignIn(null, people)).toEqual({ reason: 'signed-out' });
    expect(matchSignIn('  ', people)).toEqual({ reason: 'signed-out' });
    expect(matchSignIn('nobody@example.com', people)).toEqual({ reason: 'no-one', email: 'nobody@example.com' });
    expect(matchSignIn('sam@example.com', people)).toEqual({ reason: 'shared', email: 'sam@example.com' });
    expect(matchSignIn('oskar@example.com', people)).toEqual({ reason: 'left', email: 'oskar@example.com' });
    expect(matchSignIn('rex@example.com', people)).toEqual({ reason: 'left', email: 'rex@example.com' });
  });
  it('a person who left and came back under the same email is opened, not refused', () => {
    expect(matchSignIn('oskar@example.com', [...people, person('oskar2', 'oskar@example.com')])).toEqual({ id: 'oskar2' });
  });
});

describe('signInIdentity', () => {
  it('names the person, or says why not, never both', async () => {
    let email: string | null = 'sam@example.com';
    const id = signInIdentity(async () => email, async () => people);
    expect(await id.current('ws')).toBeNull();
    expect(await id.why!('ws')).toEqual({ reason: 'shared', email: 'sam@example.com' });
    email = 'ada@example.com';
    expect(await id.current('ws')).toBe('ada');
    expect(await id.why!('ws')).toBeNull();
  });
});
