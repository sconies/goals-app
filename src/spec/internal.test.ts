/* The requirements for the internal app (backlog 8r) can't drift from Faro's code: every example run against the code
   gives what it says, R1's access table names only functions that exist, and every shared action that says who may do
   something is in it. */
import fs from 'node:fs';
import path from 'node:path';
import { ACCESS, INTERNAL, wrongInternalExamples } from './internal';
import { INTERNAL_PAGES } from './overview';

const root = path.resolve(__dirname, '../..');
const src = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');

/** Each exported function in a file, with its text up to the next export. */
function exported(file: string): { name: string; body: string }[] {
  const s = src(file);
  const at = [...s.matchAll(/export (?:async )?(?:function (\w+)|const (\w+) = )/g)].map((m) => ({ name: (m[1] ?? m[2])!, i: m.index! }));
  return at.map((x, k) => ({ name: x.name, body: s.slice(x.i, at[k + 1]?.i ?? s.length) }));
}

/** Whether a function decides who may do something: it refuses with "Only …", checks an admin or the owner, or asks a can… rule. */
const saysWho = (body: string) => /no\([`'"]Only |\.admin\b|ownsOrAdmin\(|may(Change|Add)Goal\(|\bcan(Answer|MarkDone|Withdraw|Change|DeleteCheckIn|UndoImport)\(/.test(body);

describe('the requirements for the internal app', () => {
  it('gives what each Faro-today example says, run against the code', () => {
    expect(wrongInternalExamples()).toEqual([]);
  });

  it('names only functions that exist in R1’s access table', () => {
    const missing = ACCESS.flatMap((a) => a.code).filter((ref) => {
      const [file, fn] = ref.split('#');
      return !fs.existsSync(path.join(root, file!)) || (fn && !exported(file!).some((e) => e.name === fn));
    });
    expect(missing).toEqual([]);
  });

  it('lists every shared action that says who may do something in R1’s access table', () => {
    const listed = new Set(ACCESS.flatMap((a) => a.code).map((r) => r.split('#')[1]));
    // Read-only helpers that decide nothing on their own: they count or list for an action that is listed.
    const helpers = new Set(['personHistory', 'recentlyRemoved', 'commentsOf', 'teamMembers', 'teamPeople', 'cycleDeletable', 'cycleStanding']);
    const unlisted = ['src/domain/actions.ts', 'src/domain/removal.ts'].flatMap((f) => exported(f).filter((e) => saysWho(e.body) && !listed.has(e.name) && !helpers.has(e.name)).map((e) => `${f}#${e.name}`));
    expect(unlisted).toEqual([]);
  });

  it('has a page for each requirement in the overview’s list, with the same title', () => {
    expect(INTERNAL.map((q) => [q.file, q.title])).toEqual(INTERNAL_PAGES.filter(([f]) => f !== 'observability').map(([f, t]) => [f, t]));
  });
});
