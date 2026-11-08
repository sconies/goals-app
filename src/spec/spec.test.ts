/* The spec can't drift (backlog 8a): every file under spec/ and llms.txt is what `npm run spec` makes from the code
   now, every worked example gives what it says, and every core screen has its main action. */
import fs from 'node:fs';
import path from 'node:path';
import { buildSpec } from './build';
import { systemOverview } from './overview';
import { wrongExamples } from './rules';
import { MAIN_ACTION } from './screens';
import { coreRoutes } from './sources';

const root = path.resolve(__dirname, '../..');

describe('the spec', () => {
  it('gives what each worked example says, run against the real rules', async () => {
    expect(await wrongExamples()).toEqual([]);
  });

  it('is current: every file is what npm run spec makes now (run it and commit what it writes)', async () => {
    const want = await buildSpec(root);
    const onDisk: string[] = [];
    const walk = (rel: string) => { for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) { const p = `${rel}/${e.name}`; if (e.isDirectory()) walk(p); else onDisk.push(p); } };
    walk('spec');
    const stale = Object.entries(want).filter(([f, text]) => !fs.existsSync(path.join(root, f)) || fs.readFileSync(path.join(root, f), 'utf8') !== text).map(([f]) => f);
    expect({ stale, extra: onDisk.filter((f) => !(f in want)) }).toEqual({ stale: [], extra: [] });
  }, 60_000);

  it('says the same overview in llms.txt as the AI assistant’s describe_system', () => {
    expect(fs.readFileSync(path.join(root, 'llms.txt'), 'utf8')).toBe(systemOverview());
  });

  it('names a main action for every core screen, and none for a screen that has gone', () => {
    const screens = [...new Set(coreRoutes({ root }).map((r) => r.file.split('/').pop()!.replace('.tsx', '')))].sort();
    expect(Object.keys(MAIN_ACTION).sort()).toEqual(screens);
  });
});
