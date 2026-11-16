// @vitest-environment node
/* home.csv is the same in every time zone (drill, 15 Nov: made in Pacific/Auckland it moved a receipt a day, since a
   check-in's day is read on the machine's clock). Its records are judged in UTC, whatever zone the spec is made in. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPlatformOrg } from '../data/platformOrg/generate';
import { CHECK_IN_MOMENT, conformanceWorkspace, HOME_HEADER, homeRowsOf, toCsv } from './conformance';

describe('home.csv in another time zone', () => {
  it('is what spec/conformance/home.csv says, made in Pacific/Auckland, and the zone is put back after', () => {
    const was = process.env.TZ;
    process.env.TZ = 'Pacific/Auckland';
    try {
      const w = conformanceWorkspace(buildPlatformOrg(new Date(CHECK_IN_MOMENT)));
      const made = toCsv(HOME_HEADER, homeRowsOf(w));
      expect(made).toBe(readFileSync(join(__dirname, '../../spec/conformance/home.csv'), 'utf8'));
      expect(process.env.TZ).toBe('Pacific/Auckland');
    } finally {
      if (was === undefined) delete process.env.TZ; else process.env.TZ = was;
    }
  });
});
