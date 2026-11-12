/* The prefs contract's cases (the Prefs port, src/ports/prefs.ts), as data. `npm run spec` writes them to
   spec/conformance/contracts/prefs.json; src/ports/contracts/search.ts runs them on Faro's adapter. */
import type { Contract } from './format';

const get = (ws: string, person: string, key: string) => ({ op: 'get', args: [ws, person, key] });
const set = (ws: string, person: string, key: string, value: unknown) => ({ op: 'set', args: [ws, person, key, value] });

export const PREFS_CONTRACT: Contract = {
  port: 'prefs',
  about: 'The Prefs port: a few small values per person and workspace that aren’t records (the things they opened lately, the Goals scope they used last). `given` is null: each case starts with nothing kept.',
  ops: {
    given: 'Start with nothing kept. Answers null.',
    get: '(workspaceId, personId, key) The value kept under `key` for this person in this workspace; null when there is none.',
    set: '(workspaceId, personId, key, value) Keeps `value` (anything JSON can hold; null forgets it) for this person in this workspace only. Answers null.',
    reopen: 'Open the same store again, as a new page load would: what was kept is still there. Answers null.',
  },
  given: null,
  cases: [
    {
      name: 'reads a value back for that person in that workspace, and for nobody else',
      steps: [
        { when: get('ws_a', 'ada', 'recents'), then: { equals: null } },
        { when: set('ws_a', 'ada', 'recents', [{ kind: 'goal', id: 'g1' }]), then: {} },
        { when: set('ws_a', 'ada', 'scope', 'mine'), then: {} },
        { when: get('ws_a', 'ada', 'recents'), then: { equals: [{ kind: 'goal', id: 'g1' }] } },
        { when: get('ws_a', 'ada', 'scope'), then: { equals: 'mine' } },
        { when: get('ws_a', 'grace', 'recents'), then: { equals: null } },
        { when: get('ws_b', 'ada', 'recents'), then: { equals: null } },
      ],
    },
    {
      name: 'keeps a value when the store is opened again',
      steps: [
        { when: set('ws_a', 'ada', 'scope', 'mine'), then: {} },
        { when: { op: 'reopen' }, then: {} },
        { when: get('ws_a', 'ada', 'scope'), then: { equals: 'mine' } },
      ],
    },
    {
      name: 'forgets a value set to null, and a later value replaces an earlier one',
      steps: [
        { when: set('ws_a', 'ada', 'scope', 'mine'), then: {} },
        { when: set('ws_a', 'ada', 'scope', 'team'), then: {} },
        { when: get('ws_a', 'ada', 'scope'), then: { equals: 'team' } },
        { when: set('ws_a', 'ada', 'scope', null), then: {} },
        { when: get('ws_a', 'ada', 'scope'), then: { equals: null } },
      ],
    },
  ],
};
