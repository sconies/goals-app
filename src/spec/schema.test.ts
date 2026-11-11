// @vitest-environment node
/* The kit's database pages (AX8, src/spec/schema.ts) read the whole access surface, column grants included (build
   review, 11 Nov): a table closed as a whole may still be open column by column. */
import { join } from 'node:path';
import { accessPage, catalog, schemaSql } from './schema';

describe('the database as it is', () => {
  it('shows grants on single columns, on the access page and in schema.sql', async () => {
    const c = await catalog(join(__dirname, '../..'));
    const row = (t: string) => accessPage(c).split('\n').find((l) => l.startsWith(`| \`${t}\` |`)) ?? '';
    expect(row('okr_feedback')).toMatch(/anon: insert \(\d+ columns\)/);
    expect(row('okr_markups')).toMatch(/anon: update \(\d+ columns\)/);
    expect(schemaSql(c)).toMatch(/^grant insert \(id, workspace_id, .*\) on okr_feedback to anon;$/m);
  }, 60_000);
});
