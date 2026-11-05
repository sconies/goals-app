/* A pull request that changes the app tells people about it. If any file under src/ or supabase/migrations changed
   against the base branch (tests aside), src/help/whatsNew.ts must have changed too: a What's new entry, and the guide
   (src/help/guide.ts) updated alongside it. A pure refactor that people can't see opts out with "[no news]" in one of
   its commit messages.

   Usage: node scripts/check-whats-new.mjs [base]     base defaults to origin/$GITHUB_BASE_REF; with neither (a push,
   not a pull request) there is nothing to compare and the check passes. CI runs it with the full history
   (actions/checkout fetch-depth: 0). */
import { execFileSync } from 'node:child_process';

const NEWS = 'src/help/whatsNew.ts';
const OPT_OUT = '[no news]';

/** Files people can see a change in: the app's source and the database's migrations, not tests. */
export const visible = (file) =>
  (/^src\//.test(file) || /^supabase\/migrations\//.test(file)) &&
  !/\.test\.(ts|tsx|js|mjs)$/.test(file) && file !== 'src/test-setup.ts' && file !== NEWS;

/** The verdict for a set of changed files and the commit messages that made them. */
export function decide(files, messages) {
  const changed = files.filter(visible);
  if (!changed.length) return { ok: true, why: 'No change to src/ or supabase/migrations: nothing to announce.' };
  if (files.includes(NEWS)) return { ok: true, why: `${NEWS} changed alongside ${changed.length} app ${changed.length === 1 ? 'file' : 'files'}.` };
  if (messages.some((m) => m.includes(OPT_OUT))) return { ok: true, why: `A commit says ${OPT_OUT}: a change people can't see.` };
  return {
    ok: false,
    why: [
      `This pull request changes the app but not What's new. Changed: ${changed.slice(0, 8).join(', ')}${changed.length > 8 ? ` and ${changed.length - 8} more` : ''}.`,
      `Add an entry at the top of ${NEWS} (a stable id, today's date, a title and two to six plain lines for people), and update the guide in src/help/guide.ts.`,
      `If people can't see the change (a pure refactor), put ${OPT_OUT} in a commit message.`,
    ].join('\n'),
  };
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

function main() {
  const base = process.argv[2] || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : '');
  if (!base) { console.log('Not a pull request: nothing to compare What’s new against.'); return 0; }
  const files = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
  const messages = git('log', '--format=%B%x00', `${base}..HEAD`).split('\0').map((m) => m.trim()).filter(Boolean);
  const v = decide(files, messages);
  (v.ok ? console.log : console.error)(v.why);
  return v.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
