/* The module platform's page (drill 11, fix 1) says what Faro's code says: every sentence it reads from a file is still
   written there, and every place has its words. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLACES } from '../core/module';
import { CORE_HOOKS, CORE_SPOTS, DOOR, OFF_SENTENCES, PLACE_WORDS } from './modulePlatform';

const root = path.join(__dirname, '..', '..');

describe('the module platform page', () => {
  it('words every place, and no place that is gone', () => {
    expect(Object.keys(PLACE_WORDS).sort()).toEqual([...PLACES].sort());
  });

  it('finds each sentence it reads from a file still written there', () => {
    const missing = [...OFF_SENTENCES.filter((x) => x.needle), ...DOOR].filter((x) => !fs.readFileSync(path.join(root, x.from), 'utf8').includes(x.needle!)).map((x) => `${x.from}: ${x.needle}`);
    expect(missing).toEqual([]);
  });
  it('finds each spot the core still draws for a module where it says, asking for a module that exists (drill 11)', () => {
    const ids = new Set(fs.readdirSync(path.join(root, 'src/modules')).filter((d) => fs.existsSync(path.join(root, 'src/modules', d, 'module.json'))));
    const missing = CORE_SPOTS.filter((x) => !fs.readFileSync(path.join(root, x.from), 'utf8').includes(x.needle)).map((x) => `${x.name}: ${x.from}`);
    const unknown = [...CORE_SPOTS, ...CORE_HOOKS].flatMap((x) => x.modules.filter((m) => !ids.has(m)).map((m) => `${x.name}: ${m}`));
    expect({ missing, unknown }).toEqual({ missing: [], unknown: [] });
  });
});
