// @vitest-environment node
/* Nothing on AppState saves except through the dispatcher (AX2; architecture review finding 2). Every change a person
   makes goes through `run(action, input)` (app/actions.ts), so the rules in src/domain, who-may and Undo are never
   skipped. This reads state.tsx and holds that invariant structurally: the store is written to only inside `commit`
   and `issueToken`, those are called only inside `run`, and the inner `save` (the one guard-and-commit helper) is
   called only inside `run` too. A new method that reached `store.commit`, or `save`, on its own would fail here. */
import fs from 'node:fs';
import path from 'node:path';

/** state.tsx with comments and string/template literals blanked, so braces and call sites are code only. */
function code(): string {
  const src = fs.readFileSync(path.join(__dirname, 'state.tsx'), 'utf8');
  let out = '';
  for (let i = 0; i < src.length; ) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
    if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? src.length : j + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < src.length && src[i] !== c) { if (src[i] === '\\') i++; i++; }
      i++; out += '""'; continue;
    }
    out += c; i++;
  }
  return out;
}

/** The body of a `{ … }` block, given the index of a line that opens it: from its first `{` to the matching `}`. */
function block(src: string, from: number): { start: number; end: number } {
  const open = src.indexOf('{', from);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return { start: open, end: i };
  }
  throw new Error('unbalanced');
}
const inside = (b: { start: number; end: number }, i: number) => i > b.start && i < b.end;
const sites = (src: string, call: RegExp) => [...src.matchAll(call)].map((m) => m.index!);

describe('nothing on AppState saves except through run', () => {
  const src = code();
  const at = (marker: string) => { const i = src.indexOf(marker); expect(i, marker).toBeGreaterThan(0); return block(src, i); };
  // The dispatcher, and the three helpers that reach the store.
  const run = at('): Promise<RunResult<N>> {');
  const save = at('const save = (c: Commit) =>');
  const commit = at('const commit = useCallback(async (given: Commit) =>');
  const issueToken = at('const issueToken = useCallback(async (c: Commit) =>');

  it('writes to the store only inside commit and issueToken', () => {
    for (const i of sites(src, /\bstore\.commit\(/g)) expect(inside(commit, i), `store.commit at ${i}`).toBe(true);
    for (const i of sites(src, /\bstore\.issueToken\(/g)) expect(inside(issueToken, i), `store.issueToken at ${i}`).toBe(true);
  });

  it('calls the committing helpers only from within the dispatcher chain', () => {
    // `commit(c)` is the save helper's one job; `save(` and `issueToken(` are the dispatcher's.
    for (const i of sites(src, /[^.]\bcommit\(c\)/g)) expect(inside(save, i), `commit() at ${i}`).toBe(true);
    for (const i of sites(src, /\bawait save\(/g)) expect(inside(run, i), `save() at ${i}`).toBe(true);
    for (const i of sites(src, /\bawait issueToken\(/g)) expect(inside(run, i), `issueToken() at ${i}`).toBe(true);
    // And the dispatcher saves in exactly one place, so there is one path from AppState to the store.
    expect(sites(src, /\bawait save\(/g).length).toBe(1);
  });
});
