// @vitest-environment node
/* Each journey's steps and checks are in the kit (item 11, drill gaps 3.27 and 5.2): every journey in
   evals/journeys.cjs has a page that says what a person does and what must then be true, read from its code. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { journeyDocs, journeyPage, withoutSteps } from './journeySteps';
import { checks, moduleFacts } from './sources';

const root = path.resolve(__dirname, '../..');

describe('each journey’s steps and checks (spec/core/journeys/, a module’s journeys/)', () => {
  const docs = journeyDocs({ root });

  it('reads every journey in evals/journeys.cjs, and no other', () => {
    const listed = checks({ root }).filter((c) => c.kind === 'journey').map((c) => c.id).sort();
    expect(docs.map((j) => j.id).sort()).toEqual(listed);
  });

  it('gives every journey at least one thing a person does and one thing to check', () => {
    expect(withoutSteps(docs)).toEqual([]);
  });

  it('files every journey’s page: a module’s under its section, the rest under the core', () => {
    const owned = new Map<string, string[]>();
    for (const m of moduleFacts({ root })) for (const id of m.journeys) owned.set(id, [...(owned.get(id) ?? []), m.id]);
    const missing = docs.flatMap((j) => (owned.get(j.id) ?? ['core']).map((m) => (m === 'core' ? `spec/core/journeys/${j.id}.md` : `spec/modules/${m}/journeys/${j.id}.md`)))
      .filter((f) => !fs.existsSync(path.join(root, f)));
    expect(missing).toEqual([]);
  });

  it('fails a journey whose code it can’t read into a step or a check', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'journeys-'));
    fs.mkdirSync(path.join(dir, 'evals'));
    fs.writeFileSync(path.join(dir, 'evals/journeys.cjs'), [
      "journey('U1', ['A'], 'Opaque', 3, async (h, device) => { await somethingElse(h); });",
      "journey('U2', ['B'], 'Check in', 2, async (h, device) => {",
      "  const p = h.use(await newPage(device, 'rhea'));",
      "  await p.goto(url('/check-in/x'));",
      "  await h.fill(p.getByLabel('This week’s value'), '12');",
      "  await h.click(p.getByRole('button', { name: 'Post check-in' }));",
      "  await see(p, 'Check-in saved');",
      "  h.set('finish', await p.getByRole('link', { name: 'Back to home' }).isVisible(), 'no way on');",
      '});',
    ].join('\n'));
    try {
      const two = journeyDocs({ root: dir });
      expect(withoutSteps(two)).toEqual(['U1']);
      const page = journeyPage(two[1]!, '../../', 'the core');
      expect(page).toContain('**Starts:** As Rhea, at `/check-in/x` in the demo.');
      expect(page).toContain('- **Step.** Type “12” into the “This week’s value” field.');
      expect(page).toContain('- **Step.** Press the “Post check-in” button.');
      expect(page).toContain('- **Check:** “Check-in saved” is shown.');
      expect(page).toContain('- **Check:** (`finish`) the “Back to home” link is visible (else: no way on).');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
