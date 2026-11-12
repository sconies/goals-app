/* The database as it is (AX8, architecture readiness review findings 10 and 11): Faro's schema after every migration,
   and every grant, row rule and definer function, read from a real Postgres (PGlite, bootstrap.sql then each migration,
   as src/adapters/postgres/testDb.ts sets it up), so a team reads one file instead of replaying the migrations, and
   sees the whole access surface in one place. Written by `npm run spec` into spec/core/schema.sql and
   spec/rebuild/access-today.md. Node only. */
import { migratedPostgres, migrationFiles } from '../adapters/postgres/testDb';
import { cell, table } from './md';

const SCHEMA = 'faro';

type Row = Record<string, unknown>;
interface Db { query<T = Row>(text: string, params?: unknown[]): Promise<{ rows: T[] }> }

interface Column { tbl: string; col: string; type: string; nn: boolean; def: string | null; identity: string; generated: string }
interface Constraint { tbl: string; name: string; def: string }
interface Fn { name: string; args: string; def: string; definer: boolean; runners: string[] | null }
interface Policy { schemaname: string; tablename: string; policyname: string; permissive: string; roles: string[]; cmd: string; qual: string | null; with_check: string | null }
interface Grant { tbl: string; grantee: string; privs: string[] }
/** A grant on some of a table's columns only (`grant insert (a, b) on t to anon`). */
interface ColumnGrant { tbl: string; grantee: string; priv: string; cols: string[] }

/** What the database holds, read once. */
export interface Catalog {
  migrations: string[];
  tables: { name: string; rls: boolean }[];
  columns: Column[];
  constraints: Constraint[];
  indexes: string[];
  triggers: string[];
  views: { name: string; def: string }[];
  functions: Fn[];
  policies: Policy[];
  grants: Grant[];
  columnGrants: ColumnGrant[];
  schemaUsage: string[];
  redirects: { views: string[]; functions: string[] };
}

const PRIVS: Record<string, string> = { SELECT: 'select', INSERT: 'insert', UPDATE: 'update', DELETE: 'delete', TRUNCATE: 'truncate', REFERENCES: 'references', TRIGGER: 'trigger' };
const ORDER = Object.values(PRIVS);

async function read(db: Db, migrations: string[]): Promise<Catalog> {
  const q = async <T = Row>(sql: string): Promise<T[]> => (await db.query<T>(sql, [])).rows;
  // Names as the migrations write them since 0036: unqualified, in faro.
  await db.query(`set search_path = ${SCHEMA}`);
  const ns = `n.nspname = '${SCHEMA}'`;
  const tables = await q<{ name: string; rls: boolean }>(`select c.relname as name, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace where ${ns} and c.relkind in ('r', 'p') order by 1`);
  const columns = await q<Column>(`select c.relname as tbl, a.attname as col, format_type(a.atttypid, a.atttypmod) as type, a.attnotnull as nn, pg_get_expr(d.adbin, d.adrelid) as def, a.attidentity as identity, a.attgenerated as generated
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where ${ns} and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped order by c.relname, a.attnum`);
  const constraints = await q<Constraint>(`select c.relname as tbl, k.conname as name, pg_get_constraintdef(k.oid) as def from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
    where ${ns} and k.contype <> 'n' order by c.relname, case k.contype when 'p' then 0 when 'u' then 1 when 'f' then 2 else 3 end, k.conname`);
  const indexes = (await q<{ def: string }>(`select pg_get_indexdef(i.indexrelid) as def from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace
    where ${ns} and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid and k.conrelid = i.indrelid and k.contype in ('p', 'u', 'x')) order by 1`)).map((r) => r.def);
  const triggers = (await q<{ def: string }>(`select pg_get_triggerdef(t.oid) as def from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where ${ns} and not t.tgisinternal order by c.relname, t.tgname`)).map((r) => r.def);
  const views = await q<{ name: string; def: string }>(`select c.relname as name, pg_get_viewdef(c.oid, true) as def from pg_class c join pg_namespace n on n.oid = c.relnamespace where ${ns} and c.relkind = 'v' order by 1`);
  const functions = await q<Fn>(`select p.proname as name, pg_get_function_identity_arguments(p.oid) as args, pg_get_functiondef(p.oid) as def, p.prosecdef as definer,
    (select array_agg(coalesce(r.rolname, 'public') order by coalesce(r.rolname, 'public')) from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a left join pg_roles r on r.oid = a.grantee
      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner) as runners
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where ${ns} and p.prokind in ('f', 'p') order by 1, 2`);
  const policies = await q<Policy>(`select schemaname::text, tablename::text, policyname::text, permissive, roles::text[] as roles, cmd, qual, with_check from pg_policies
    where schemaname = '${SCHEMA}' or (schemaname = 'storage' and tablename = 'objects') order by 1 desc, 2, 3`);
  const grants = await q<Grant>(`select c.relname as tbl, coalesce(r.rolname, 'public') as grantee, array_agg(a.privilege_type::text) as privs
    from pg_class c join pg_namespace n on n.oid = c.relnamespace, aclexplode(c.relacl) a left join pg_roles r on r.oid = a.grantee
    where ${ns} and c.relkind in ('r', 'p', 'v') and a.grantee <> c.relowner group by 1, 2 order by 1, 2`);
  // Grants on single columns (0026's feedback, 0031's markups): a table can be closed as a whole and open column by column.
  const columnGrants = await q<ColumnGrant>(`select c.relname as tbl, coalesce(r.rolname, 'public') as grantee, a.privilege_type as priv, array_agg(t.attname::text order by t.attnum) as cols
    from pg_attribute t join pg_class c on c.oid = t.attrelid join pg_namespace n on n.oid = c.relnamespace, aclexplode(t.attacl) a left join pg_roles r on r.oid = a.grantee
    where ${ns} and t.attacl is not null and t.attnum > 0 and not t.attisdropped and a.grantee <> c.relowner group by 1, 2, 3 order by 1, 2, 3`);
  const schemaUsage = (await q<{ who: string }>(`select coalesce(r.rolname, 'public') as who from pg_namespace n, aclexplode(n.nspacl) a left join pg_roles r on r.oid = a.grantee
    where ${ns} and a.privilege_type = 'USAGE' and a.grantee <> n.nspowner order by 1`)).map((r) => r.who);
  const redirects = {
    views: (await q<{ name: string }>(`select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v' order by 1`)).map((r) => r.name),
    functions: (await q<{ name: string }>(`select distinct p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'okr\\_%' order by 1`)).map((r) => r.name),
  };
  return { migrations, tables, columns, constraints, indexes, triggers, views, functions, policies, grants, columnGrants, schemaUsage, redirects };
}

/** Faro's database after every migration, read from PGlite. */
export async function catalog(root: string): Promise<Catalog> {
  const db = await migratedPostgres(root);
  try { return await read(db as unknown as Db, migrationFiles(root)); } finally { await db.close(); }
}

const privs = (p: string[]) => ORDER.filter((x) => p.map((y) => PRIVS[y] ?? y.toLowerCase()).includes(x));
const fnName = (f: Fn) => `${f.name}(${f.args})`;
const policySql = (p: Policy) => [
  `create policy "${p.policyname}" on ${p.schemaname === SCHEMA ? '' : `${p.schemaname}.`}${p.tablename}`,
  p.permissive === 'PERMISSIVE' ? '' : ' as restrictive',
  p.cmd === 'ALL' ? '' : ` for ${p.cmd.toLowerCase()}`,
  ` to ${p.roles.join(', ')}`,
  p.qual ? ` using (${p.qual})` : '',
  p.with_check ? ` with check (${p.with_check})` : '',
  ';',
].join('');

/** spec/core/schema.sql: what the migrations add up to, as one file to read (not to run on top of them). */
export function schemaSql(c: Catalog): string {
  const last = c.migrations[c.migrations.length - 1] ?? '(none)';
  const out = [
    `-- Generated by npm run spec from supabase/migrations (src/spec/schema.ts). Edit the migrations, not this file.`,
    `--`,
    `-- Faro's database as it is after every migration (${c.migrations.length}, the last ${last}): read here, not by replaying`,
    `-- them. It is read back from Postgres (PGlite, after src/adapters/postgres/bootstrap.sql's stand-ins for Supabase),`,
    `-- so it says what the database holds, not what any one migration meant. Everything is in the faro schema (backlog 0c).`,
    `-- To set up a database, run the migrations in order; this file is for reading. Who may do what is in`,
    `-- spec/rebuild/access-today.md: all of it is the demo's open access, to be replaced (requirement R1).`,
    '',
    `create schema ${SCHEMA};`,
    `set search_path = ${SCHEMA};`,
    '',
    '-- ---------- Tables ----------',
    '',
  ];
  for (const t of c.tables) {
    const cols = c.columns.filter((x) => x.tbl === t.name).map((x) => {
      const gen = x.generated === 's' ? ` generated always as (${x.def}) stored` : '';
      const ident = x.identity === 'a' ? ' generated always as identity' : x.identity === 'd' ? ' generated by default as identity' : '';
      return `  ${x.col} ${x.type}${x.nn ? ' not null' : ''}${!gen && x.def ? ` default ${x.def}` : ''}${gen}${ident}`;
    });
    const cons = c.constraints.filter((x) => x.tbl === t.name).map((x) => `  constraint ${x.name} ${x.def}`);
    out.push(`create table ${t.name} (`, [...cols, ...cons].join(',\n'), ');', '');
  }
  if (c.indexes.length) out.push('-- ---------- Indexes ----------', '', ...c.indexes.map((x) => `${x};`), '');
  if (c.views.length) out.push('-- ---------- Views ----------', '', ...c.views.flatMap((v) => [`create view ${v.name} as`, v.def.trimEnd(), '']));
  out.push('-- ---------- Functions ----------', '', `-- ${c.functions.length} functions; ${c.functions.filter((f) => f.definer).length} run with their owner's rights (security definer).`, '');
  for (const f of c.functions) out.push(`${f.def.trimEnd()};`, '');
  if (c.triggers.length) out.push('-- ---------- Triggers ----------', '', ...c.triggers.map((x) => `${x};`), '');
  out.push('-- ---------- Access (the demo\'s, to be replaced: spec/rebuild/access-today.md) ----------', '');
  out.push(`grant usage on schema ${SCHEMA} to ${c.schemaUsage.join(', ')};`, '');
  for (const t of c.tables.filter((x) => x.rls)) out.push(`alter table ${t.name} enable row level security;`);
  out.push('');
  for (const p of c.policies) out.push(policySql(p));
  out.push('');
  for (const g of c.grants) out.push(`grant ${privs(g.privs).join(', ')} on ${g.tbl} to ${g.grantee};`);
  for (const g of c.columnGrants) out.push(`grant ${PRIVS[g.priv] ?? g.priv.toLowerCase()} (${g.cols.join(', ')}) on ${g.tbl} to ${g.grantee};`);
  out.push('');
  for (const f of c.functions) {
    if (!f.runners?.includes('public')) out.push(`revoke execute on function ${fnName(f)} from public;`);
    const named = (f.runners ?? []).filter((r) => r !== 'public');
    if (named.length) out.push(`grant execute on function ${fnName(f)} to ${named.join(', ')};`);
  }
  out.push('', `-- ---------- Not shown: the redirects in public ----------`, '--',
    `-- Migration 0035 left a view under each old name in public (${c.redirects.views.length}) and a function under each old`,
    `-- function name (${c.redirects.functions.length}), so a client that still asks for public reaches the same tables. They go`,
    `-- once the Data API offers faro (backlog 0c2). A rebuild doesn't need them.`, '');
  return out.join('\n');
}

const ROLE_WORD: Record<string, string> = { anon: 'the public key (`anon`)', authenticated: 'anyone signed in (`authenticated`)', public: 'everyone (`public`)' };
const who = (roles: string[]) => roles.map((r) => ROLE_WORD[r] ?? `\`${r}\``).join(', ');
const today = (f: Fn) => (f.runners ?? []).some((r) => r === 'anon' || r === 'public') ? 'Demo access: replace' : f.runners?.length ? 'Signed in: check the caller first (shape 2)' : 'Owner only (scheduled jobs and helpers)';
const short = (s: string | null) => (s == null ? '' : s.replace(/\s+/g, ' ').trim());

/** spec/rebuild/access-today.md: every grant, row rule and definer function, each marked as the demo's. */
export function accessPage(c: Catalog): string {
  const defs = c.functions.filter((f) => f.definer);
  const out = [
    '<!-- Generated by npm run spec from supabase/migrations (src/spec/schema.ts). Edit the migrations, not this file. -->',
    '',
    '# Access today',
    '',
    `Who may read and change what in Faro’s database today, read from the database itself after every migration (${c.migrations.length}). **All of it is demo access: replace.** Faro has no sign-in on purpose (a demo that never holds real data), so the app’s public key (\`anon\`) may read and change every workspace. Requirement R1 ([sign-in and access](../requirements/internal/r1-sign-in-and-access.md)) says what the internal app does instead; the two shapes at the end of this page are what replaces each line here. The full schema is [schema.sql](../core/schema.sql).`,
    '',
    'Each new table in the migrations copied the block before it, so the pattern seen most often there is the one not to keep. Read this page, not the migrations, for the access surface.',
    '',
    '## Tables',
    '',
    `The schema \`${SCHEMA}\` may be used by ${who(c.schemaUsage)}. A grant on some columns only is shown as “insert (7 columns)”; [schema.sql](../core/schema.sql) names them. A table with no grant can be reached only through the functions below.`,
    '',
    table(['Table', 'Row rules', 'Granted to', 'Rules', 'Today'], c.tables.map((t) => {
      const g = c.grants.filter((x) => x.tbl === t.name);
      const cg = c.columnGrants.filter((x) => x.tbl === t.name && !g.some((y) => y.grantee === x.grantee && privs(y.privs).includes(PRIVS[x.priv] ?? '')));
      const granted = [...g.map((x) => `${x.grantee}: ${privs(x.privs).join(', ')}`), ...cg.map((x) => `${x.grantee}: ${PRIVS[x.priv] ?? x.priv.toLowerCase()} (${x.cols.length} ${x.cols.length === 1 ? 'column' : 'columns'})`)];
      const p = c.policies.filter((x) => x.schemaname === SCHEMA && x.tablename === t.name);
      return [
        `\`${t.name}\``,
        t.rls ? 'on' : '**off**',
        granted.length ? granted.join('; ') : 'nobody',
        p.length ? p.map((x) => `“${cell(x.policyname)}”: ${x.cmd.toLowerCase()} for ${x.roles.join(', ')}${x.qual ? ` where \`${cell(short(x.qual))}\`` : ''}${x.with_check ? ` checking \`${cell(short(x.with_check))}\`` : ''}`).join('<br>') : 'none',
        granted.length || p.length ? 'Demo access: replace' : 'Functions only',
      ];
    })),
    '',
    '## Functions that run with their owner’s rights',
    '',
    `${defs.length} of the ${c.functions.length} functions are \`security definer\`: they pass every row rule above, so each is as open as the list of who may run it. Some check what they are handed (a live token’s hash, for the AI tools’ endpoint) or that the person signed in is one of Faro’s builders (\`okr_is_builder\`). None checks that the caller belongs to the workspace it names, because nobody signs in to a workspace. In the internal app each must check its caller first (shape 2).`,
    '',
    table(['Function', 'Who may run it', 'Today'], defs.map((f) => [`\`${cell(fnName(f))}\``, f.runners?.length ? who(f.runners) : 'its owner only', today(f)]),
    ),
    '',
    `The other ${c.functions.length - defs.length} run with the caller’s rights, so the table rules above apply to them.`,
    '',
    '## Files',
    '',
    'Markup pictures are files in Supabase Storage (bucket `markups`); Faro’s rules on Supabase’s `storage.objects`:',
    '',
    table(['Rule', 'For', 'Condition'], c.policies.filter((x) => x.schemaname === 'storage').map((x) => [`“${cell(x.policyname)}”`, `${x.cmd.toLowerCase()} by ${x.roles.join(', ')}`, `\`${cell(short(x.with_check ?? x.qual))}\``])),
    '',
    '## What replaces it',
    '',
    'Two shapes, written out so a team copies them and not the demo block.',
    '',
    '**1. A membership rule.** Rows belong to a workspace; a person reaches a row only if they belong to its workspace. With a `memberships` table (person, workspace, role) kept by the platform’s sign-in:',
    '',
    '```sql',
    'alter table okr_goals enable row level security;',
    'create policy "members read" on okr_goals for select to authenticated',
    '  using (workspace_id in (select workspace_id from memberships where person_id = auth.uid()));',
    'create policy "members change" on okr_goals for update to authenticated',
    '  using (workspace_id in (select workspace_id from memberships where person_id = auth.uid()))',
    '  with check (workspace_id in (select workspace_id from memberships where person_id = auth.uid()));',
    'revoke all on okr_goals from anon;',
    '```',
    '',
    '**2. A definer function checks who is calling before it does anything.** A function that runs with its owner’s rights passes every rule, so its first lines decide whether this caller may do this:',
    '',
    '```sql',
    'create or replace function okr_delete_workspace(ws text) returns void',
    'language plpgsql security definer set search_path = faro as $$',
    'begin',
    '  if not exists (select 1 from memberships where person_id = auth.uid() and workspace_id = ws and role = \'admin\') then',
    '    raise exception \'not allowed\' using errcode = \'42501\';',
    '  end if;',
    '  -- … then the work',
    'end $$;',
    'revoke execute on function okr_delete_workspace(text) from public, anon;',
    'grant execute on function okr_delete_workspace(text) to authenticated;',
    '```',
    '',
    `Not listed: the redirects migration 0035 left in \`public\` (${c.redirects.views.length} views, ${c.redirects.functions.length} functions), which reach the same tables under their old names until backlog 0c2 removes them.`,
    '',
  ];
  return out.join('\n');
}

/** Both files, by path. */
export async function databaseFiles(root: string): Promise<Record<string, string>> {
  const c = await catalog(root);
  return { 'spec/core/schema.sql': schemaSql(c), 'spec/rebuild/access-today.md': accessPage(c) };
}
