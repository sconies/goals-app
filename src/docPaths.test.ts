/* Pages that tell the truth (backlog AX10): every file path the hand-written pages name, in backticks, exists. These
   pages are read first by a new session or the team taking Faro on, so a path that has moved sends them nowhere.
   Design notes and reviews are left out: they name files still to be made, or as they were on the day. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const PAGES = ['CLAUDE.md', 'README.md', 'supabase/README.md', 'docs/handoff.md', 'docs/handover.md', 'docs/architecture.md', 'docs/backlog.md'];
/** Named on purpose though not on main, with the reason. */
const ELSEWHERE: Record<string, string> = {
  'docs/reviews/2026-11-10-rd-pr-reviews.md': 'kept on the rd-reviews branch, as docs/handover.md says',
};
const ROOTS = /^(\.github|src|docs|spec|supabase|scripts|server|api|evals|public)\//;

export function pathsNamed(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    // A line or a range after the path (`src/app/state.tsx:427-438`), and punctuation inside the backticks, go.
    const p = m[1]!.replace(/:\d+(-\d+)?(,\s*:?\d+(-\d+)?)*$/, '').replace(/[),.;]+$/, '');
    if (ROOTS.test(p) && !/[<>*…{}]/.test(p)) out.add(p);
  }
  return [...out];
}

const exists = (p: string) => ['', '.ts', '.tsx'].some((ext) => existsSync(join(ROOT, p + ext)));

describe('the hand-written pages name only files that exist', () => {
  it('reads a path out of backticks, with or without a line number', () => {
    expect(pathsNamed('see `src/app/state.tsx:427-438`, `docs/x.md` and `npm test`')).toEqual(['src/app/state.tsx', 'docs/x.md']);
  });
  for (const page of PAGES) {
    it(page, () => {
      const missing = pathsNamed(readFileSync(join(ROOT, page), 'utf8')).filter((p) => !exists(p) && !ELSEWHERE[p]);
      expect(missing).toEqual([]);
    });
  }
});
