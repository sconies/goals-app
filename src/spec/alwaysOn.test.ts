import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { allModules } from '../core/sources';
import { ALWAYS_ON } from './alwaysOn';

const root = path.resolve(__dirname, '../..');

describe('features that can’t be switched off yet (module map F1)', () => {
  it('each says why and which item gives it a switch, and none is a module already', () => {
    const modules = new Set(allModules(root).map((m) => m.id));
    for (const f of ALWAYS_ON) {
      expect(f.why.length, f.id).toBeGreaterThan(40);
      expect(f.until, f.id).toMatch(/^[A-Z]+\d+$/);
      expect(modules.has(f.id), `${f.id} is a module now: take it off src/spec/alwaysOn.ts`).toBe(false);
    }
  });
});
