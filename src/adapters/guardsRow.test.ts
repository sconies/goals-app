// @vitest-environment node
/* GR: a goal's guards reach Postgres as SQL null or a list, never a JSON null, which migration 0051's check refuses
   (jsonb_typeof is 'null', not 'array'). okr_commit reads each row with jsonb_populate_recordset, so this reads the
   rows the mapper writes the same way and puts them through the check's own expression. */
import type { PGlite } from '@electric-sql/pglite';
import { goalToRows } from '../data/rows';
import type { Goal } from '../domain/types';
import { contractWorkspace } from '../ports/contracts/store';
import { freshPostgres } from './postgres/testDb';

describe('guards on a goal row, on plain Postgres (GR)', () => {
  let db: PGlite;
  beforeAll(async () => { db = await freshPostgres(); }, 60_000);

  it('writes SQL null for no guards and a list for some, in one mixed batch, and both pass 0051’s check', async () => {
    const s = contractWorkspace('gr1');
    const [a, b, c] = s.goals as Goal[];
    const rows = [
      goalToRows('ws_gr1', { ...a!, guards: [{ goal: b!.id }] } as Goal).goal,
      goalToRows('ws_gr1', { ...b!, guards: [] } as Goal).goal,
      goalToRows('ws_gr1', { ...c!, guards: undefined } as Goal).goal,
    ];
    const { rows: out } = await db.query<{ id: string; sql_null: boolean; ok: boolean }>(
      `select id, guards is null as sql_null,
              (guards is null or (jsonb_typeof(guards) = 'array' and jsonb_array_length(guards) <= 5)) as ok
         from jsonb_populate_recordset(null::faro.okr_goals, $1::jsonb)`, [JSON.stringify(rows)]);
    expect(out.map((r) => [r.sql_null, r.ok])).toEqual([[false, true], [true, true], [true, true]]);
  });
});
