/* Start over is an admin's, everywhere (deep dive, 15 Nov, item 2): it resets the whole workspace, drafts included, so a
   member who owns nothing (Oskar, in the example) is never offered it, in the example or in a workspace of their own. */
import { mayStartOver } from './actions';
import { PEOPLE } from '../data/platformOrg/people';

describe('who may Start over', () => {
  it('lets an admin start the example and their own workspace over', () => {
    expect(mayStartOver({ admin: true }, 'example')).toBe(true);
    expect(mayStartOver({ admin: true }, 'own')).toBe(true);
  });

  it('never offers it to a member, in the example as in a workspace of their own', () => {
    const oskar = PEOPLE.find((p) => p.id === 'oskar')!;
    expect(oskar.admin).toBe(false);
    expect(mayStartOver(oskar, 'example')).toBe(false);
    expect(mayStartOver(oskar, 'own')).toBe(false);
  });
});
