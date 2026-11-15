/* The module platform's page (drill 11, fix 1) says what Faro's code says: every sentence it reads from a file is still
   written there, and every place has its words. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLACES } from '../core/module';
import { DOOR, OFF_SENTENCES, PLACE_WORDS } from './modulePlatform';

const root = path.join(__dirname, '..', '..');

describe('the module platform page', () => {
  it('words every place, and no place that is gone', () => {
    expect(Object.keys(PLACE_WORDS).sort()).toEqual([...PLACES].sort());
  });

  it('finds each sentence it reads from a file still written there', () => {
    const missing = [...OFF_SENTENCES.filter((x) => x.needle), ...DOOR].filter((x) => !fs.readFileSync(path.join(root, x.from), 'utf8').includes(x.needle!)).map((x) => `${x.from}: ${x.needle}`);
    expect(missing).toEqual([]);
  });
});
