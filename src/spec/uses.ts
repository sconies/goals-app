/**
 * Copy, replace or demo-only (backlog KT, gap 7): what the internal app does
 * with each requirement in evals/requirements.json, in words a page can show.
 */
import { INTERNAL } from './internal';
import type { Requirement, RequirementUse } from './sources';

export const USES: Record<RequirementUse, string> = {
  copy: 'build it as Faro does.',
  replace: 'the internal platform does this its own way; Faro’s is a stand-in.',
  'demo-only': 'Faro’s own, for the demo and its builders. Don’t build it.',
};

const internalOf = (id: string) => INTERNAL.find((q) => q.id === id);

/** The requirement's use, as one Markdown line; `up` is the path from the page to `spec/`. */
export function useLine(q: Requirement, up: string): string {
  const r = q.by ? internalOf(q.by) : undefined;
  const by = r ? ` See [${r.title}](${up}requirements/internal/${r.file}.md).` : '';
  return `- **${useName(q.use)}:** ${USES[q.use]}${by}`;
}

export const useName = (u: RequirementUse) => (u === 'copy' ? 'Copy' : u === 'replace' ? 'Replace' : 'Demo only');

/** Short form for a list: "Copy", "Replace by R1", "Demo only". */
export const useShort = (q: Requirement) => (q.use === 'replace' ? `Replace by ${q.by}` : useName(q.use));

/** Every requirement whose tag is missing or wrong, in words. */
export function wrongUses(reqs: Requirement[]): string[] {
  const out: string[] = [];
  for (const q of reqs) {
    if (!(q.use in USES)) out.push(`${q.id}: "use" must be copy, replace or demo-only, not ${JSON.stringify(q.use)}`);
    else if (q.use === 'replace' && !(q.by && internalOf(q.by))) out.push(`${q.id}: a replaced requirement names the internal requirement that replaces it ("by": R1 to R10), not ${JSON.stringify(q.by)}`);
    else if (q.use !== 'replace' && q.by !== undefined) out.push(`${q.id}: only a replaced requirement has "by"`);
  }
  return out;
}
