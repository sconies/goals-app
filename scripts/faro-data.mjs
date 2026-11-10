/* Faro's shared database, in one step each (backlog 0c). Only ever Faro's own schema, faro: nothing outside it is read.
   DATABASE_URL=postgres://… node scripts/faro-data.mjs export        (npm run faro:export)
   DATABASE_URL=postgres://… node scripts/faro-data.mjs reset --yes   (npm run faro:reset -- --yes)
   DATABASE_URL=postgres://… node scripts/faro-data.mjs nightly       (npm run faro:nightly; CI runs it every night)
   - export: every row of every table in faro, to faro-exports/faro-<time>.json (kept out of git: it holds token hashes
     and feedback). Each workspace can also be downloaded as a spreadsheet in the app (Data → Spreadsheets), in the one
     format the import reads.
   - reset: exports first, then deletes every workspace (the example aside) with the database's own rule for deleting a
     workspace (okr_delete_workspace), all in one transaction: the shared app starts empty, as on day one. The builders'
     inbox (markups) stays, as when one workspace is deleted. The demo itself (/demo) lives in each visitor's browser:
     Demo controls → Start over resets it.
   - nightly: rolls yesterday's telemetry up and prunes rows past 90 days (faro.okr_telemetry_nightly, migration 0022),
     as the role DATABASE_URL names: since 0036 no stronger role runs Faro's code (it used to be pg_cron, as postgres). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Every row of every table in faro, by table. `query(sql, params)` returns rows. */
export async function exportFaro(query) {
  const tables = await query(`select c.relname as name from pg_class c where c.relnamespace = 'faro'::regnamespace and c.relkind in ('r', 'p') order by 1`);
  if (!tables.length) throw new Error('There is no faro schema here, or it has no tables: apply migration 0035 first.');
  const out = {};
  for (const { name } of tables) out[name] = await query(`select * from faro.${quote(name)} order by 1`);
  return out;
}

/** Deletes every workspace but the example, by the database's own rule, and says how many went. Run inside a transaction. */
export async function resetFaro(query) {
  const ws = await query(`select id from faro.okr_workspaces where id <> 'example' and coalesce(kind, '') <> 'example' order by id`);
  for (const { id } of ws) await query('select faro.okr_delete_workspace($1)', [id]);
  return ws.length;
}

const quote = (name) => { if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Not a plain table name: ' + name); return `"${name}"`; };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd] = process.argv.slice(2);
  const yes = process.argv.includes('--yes');
  if (cmd !== 'export' && cmd !== 'reset' && cmd !== 'nightly') { console.log('Usage: node scripts/faro-data.mjs export | reset --yes | nightly'); process.exit(1); }
  const url = process.env.DATABASE_URL;
  if (!url) { console.log('Set DATABASE_URL to Faro’s database (the faro_owner role).'); process.exit(1); }
  if (cmd === 'reset' && !yes) { console.log('This deletes every workspace in Faro’s shared database (it exports them first). Run it again with --yes.'); process.exit(1); }
  const { default: pg } = await import('pg');
  const local = /sslmode=disable|@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  const query = async (sql, params) => (await client.query(sql, params)).rows;
  try {
    if (cmd === 'nightly') {
      await query('select faro.okr_telemetry_nightly()');
      console.log('Telemetry rolled up and pruned.');
      process.exit(0);
    }
    const data = await exportFaro(query);
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'faro-exports');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `faro-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({ exportedAt: new Date().toISOString(), schema: 'faro', tables: data }, null, 1));
    const rows = Object.values(data).reduce((n, t) => n + t.length, 0);
    console.log(`Exported ${rows} rows from ${Object.keys(data).length} tables to ${path.relative(process.cwd(), file)}.`);
    if (cmd === 'reset') {
      await client.query('begin');
      try {
        const n = await resetFaro(query);
        await client.query('commit');
        console.log(`Reset: deleted ${n} workspace${n === 1 ? '' : 's'}. The builders’ inbox is kept.`);
      } catch (e) {
        await client.query('rollback');
        throw e;
      }
    }
  } finally {
    await client.end();
  }
}
