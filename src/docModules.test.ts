/* Docs follow the build: every feature module in src/modules/<id>/module.json is named (by its name or title, in any
   case) in the pages a new session or the team taking Faro on reads first. A module added without a line in each fails
   here, naming the module and the file, so the fix is one line. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const PAGES = ['README.md', 'docs/architecture.md', 'docs/handoff.md'];

interface Facts { id: string; label: string }

function modules(): Facts[] {
  const dir = join(ROOT, 'src/modules');
  return readdirSync(dir)
    .filter((id) => existsSync(join(dir, id, 'module.json')))
    .map((id) => {
      const j = JSON.parse(readFileSync(join(dir, id, 'module.json'), 'utf8')) as { name?: string; title?: string };
      return { id, label: j.name ?? j.title ?? id };
    });
}

describe('the hand-written pages mention every feature module', () => {
  it('finds the modules', () => {
    expect(modules().length).toBeGreaterThan(0);
  });
  for (const page of PAGES) {
    it(page, () => {
      const text = readFileSync(join(ROOT, page), 'utf8').toLowerCase();
      const missing = modules().filter((m) => !text.includes(m.label.toLowerCase()));
      expect(
        missing.map((m) => `${page} does not mention the module "${m.label}" (src/modules/${m.id}/module.json): add a line saying what it is`),
      ).toEqual([]);
    });
  }
});
