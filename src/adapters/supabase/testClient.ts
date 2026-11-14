/* A stand-in for the Supabase client, for the contract tests: the few calls Faro's Supabase adapters make (table reads
   and updates with filters, database functions, a picture's public address), answered by a real Postgres (PGlite)
   with Faro's migrations, the way Supabase's REST interface answers them: rows as JSON, errors as { message, code },
   in one schema (faro, as Faro's client asks for since migration 0035; `public` reaches the redirects 0035 left).
   It is not Supabase; it lets the Supabase adapters run the same contract tests as every other adapter without a
   network. Node only. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Sql } from '../postgres/goalsStore';

type Result = { data: unknown; error: { message: string; code?: string } | null };
const fail = (e: unknown): Result => ({ data: null, error: { message: e instanceof Error ? e.message : String(e), code: (e as { code?: string }).code } });
const ident = (s: string) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('Not a plain name: ' + s); return s; };

async function json(db: Sql, from: string, params: unknown[]): Promise<unknown[]> {
  const r = (await db.query<{ v: unknown }>(`select coalesce(json_agg(t), '[]'::json) as v from (${from}) t`, params)).rows[0]!.v;
  return (typeof r === 'string' ? JSON.parse(r) : r) as unknown[];
}

/** Splits a PostgREST filter list at its top-level commas (not inside brackets or quotes). */
function terms(list: string): string[] {
  const out: string[] = [];
  let depth = 0, quoted = false, cur = '';
  for (let i = 0; i < list.length; i++) {
    const ch = list[i]!;
    if (quoted && ch === '\\') { cur += ch + (list[++i] ?? ''); continue; }
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === '(') depth++;
    else if (!quoted && ch === ')') depth--;
    if (ch === ',' && !quoted && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  return cur ? [...out, cur] : out;
}
const unquote = (v: string) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/\\(.)/g, '$1') : v);
const OPS: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };

function table(db: Sql, schema: string, bare: string) {
  const name = `${ident(schema)}.${ident(bare)}`;
  const where: string[] = [];
  const params: unknown[] = [];
  let order = '';
  let limit = '';
  let single = false;
  let op: { kind: 'select' } | { kind: 'update'; patch: Record<string, unknown>; returning: boolean } | { kind: 'insert'; rows: object[]; upsert?: boolean } | { kind: 'delete' } = { kind: 'select' };
  const p = (v: unknown) => { params.push(v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v); return `$${params.length}`; };
  const run = async (): Promise<Result> => {
    try {
      const w = where.length ? ' where ' + where.join(' and ') : '';
      if (op.kind === 'insert') {
        for (const row of op.rows) {
          const cols = Object.keys(row).map(ident);
          // upsert: on the table's primary key, as supabase-js's default (only person_prefs uses it).
          const onKey = op.upsert ? ` on conflict on constraint ${ident(bare + '_pkey')} do update set ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}` : '';
          await db.query(`insert into ${name} (${cols.join(', ')}) select ${cols.join(', ')} from json_populate_record(null::${name}, $1::json)${onKey}`, [JSON.stringify(row)]);
        }
        return { data: null, error: null };
      }
      if (op.kind === 'delete') { await db.query(`delete from ${name}${w}`, params); return { data: null, error: null }; }
      if (op.kind === 'update') {
        const patch = op.patch;
        const sets = Object.keys(patch).map((k) => `${ident(k)} = (json_populate_record(null::${name}, ${p(JSON.stringify(patch))}::json)).${ident(k)}`);
        const r = (await db.query<{ v: unknown }>(`with u as (update ${name} set ${sets.join(', ')}${w} returning *) select coalesce(json_agg(u), '[]'::json) as v from u`, params)).rows[0]!.v;
        return { data: op.returning ? (typeof r === 'string' ? JSON.parse(r) : r) : null, error: null };
      }
      const rows = await json(db, `select * from ${name}${w}${order}${limit}`, params);
      return { data: single ? rows[0] ?? null : rows, error: null };
    } catch (e) { return fail(e); }
  };
  const q = {
    select: (_cols?: string) => { if (op.kind === 'update') op.returning = true; return q; },
    eq: (c: string, v: unknown) => { where.push(`${ident(c)} = ${p(v)}`); return q; },
    gt: (c: string, v: unknown) => { where.push(`${ident(c)} > ${p(v)}`); return q; },
    gte: (c: string, v: unknown) => { where.push(`${ident(c)} >= ${p(v)}`); return q; },
    lt: (c: string, v: unknown) => { where.push(`${ident(c)} < ${p(v)}`); return q; },
    lte: (c: string, v: unknown) => { where.push(`${ident(c)} <= ${p(v)}`); return q; },
    // PostgREST's `or`, for the few forms Faro writes: column.[not.]op.value, with eq, neq, gt, gte, lt, lte, in.(…) and is.null.
    or: (list: string) => {
      const sql = terms(list).map((t) => {
        const m = /^([a-z_][a-z0-9_]*)\.(not\.)?(eq|neq|gt|gte|lt|lte|in|is)\.(.*)$/s.exec(t);
        if (!m) throw new Error('Not a filter the stand-in reads: ' + t);
        const [, col, not, op, raw] = m as unknown as [string, string, string | undefined, string, string];
        const c = ident(col);
        const e = op === 'is' ? `${c} is ${raw === 'null' ? 'null' : ident(raw)}`
          : op === 'in' ? `${c} = any(${p(terms(raw.replace(/^\(|\)$/g, '')).map(unquote))})`
          : `${c} ${OPS[op]} ${p(unquote(raw))}`;
        return not ? `not (${e})` : e;
      });
      where.push(`(${sql.join(' or ')})`);
      return q;
    },
    in: (c: string, vs: unknown[]) => { where.push(`${ident(c)} = any(${p(vs)})`); return q; },
    is: (c: string, v: null) => { where.push(`${ident(c)} is ${v === null ? 'null' : 'not null'}`); return q; },
    order: (c: string, o?: { ascending?: boolean }) => { order += `${order ? ',' : ' order by'} ${ident(c)}${o?.ascending === false ? ' desc' : ''}`; return q; },
    limit: (n: number) => { limit = ` limit ${Number(n)}`; return q; },
    maybeSingle: () => { single = true; return q; },
    update: (patch: Record<string, unknown>) => { op = { kind: 'update', patch, returning: false }; return q; },
    insert: (rows: object | object[]) => { op = { kind: 'insert', rows: Array.isArray(rows) ? rows : [rows] }; return q; },
    upsert: (rows: object | object[]) => { op = { kind: 'insert', rows: Array.isArray(rows) ? rows : [rows], upsert: true }; return q; },
    delete: () => { op = { kind: 'delete' }; return q; },
    then: <A, B>(ok: (r: Result) => A, ko?: (e: unknown) => B) => run().then(ok, ko),
  };
  return q;
}

async function rpc(db: Sql, schema: string, fn: string, args: Record<string, unknown> = {}): Promise<Result> {
  try {
    const [info] = (await db.query<{ set: boolean; ret: string }>(`select proretset as set, prorettype::regtype::text as ret from pg_proc where proname = $1 and pronamespace::regnamespace::text = $2 limit 1`, [ident(fn), ident(schema)])).rows;
    if (!info) return { data: null, error: { message: `Could not find the function ${schema}.${fn}`, code: 'PGRST202' } };
    const params: unknown[] = [];
    const named = Object.entries(args).map(([k, v]) => { params.push(v !== null && typeof v === 'object' ? JSON.stringify(v) : v); return `${ident(k)} => $${params.length}`; }).join(', ');
    const call = `${ident(schema)}.${ident(fn)}(${named})`;
    if (info.set) return { data: await json(db, `select * from ${call}`, params), error: null };
    if (info.ret === 'void') { await db.query(`select ${call}`, params); return { data: null, error: null }; }
    const v = (await db.query<{ v: unknown }>(`select to_json(${call}) as v`, params)).rows[0]!.v;
    return { data: typeof v === 'string' && info.ret === 'json' ? JSON.parse(v) : v, error: null };
  } catch (e) { return fail(e); }
}

/** The stand-in client. Pictures' public addresses are made the way Supabase makes them, under `base`. */
export function pgSupabase(db: Sql, base = 'https://stand-in.supabase.co', schema = 'faro'): SupabaseClient {
  return {
    from: (t: string) => table(db, schema, t),
    rpc: (fn: string, args?: Record<string, unknown>) => ({ then: <A, B>(ok: (r: Result) => A, ko?: (e: unknown) => B) => rpc(db, schema, fn, args).then(ok, ko) }),
    storage: { from: (bucket: string) => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `${base}/storage/v1/object/public/${bucket}/${path}` } }) }) },
  } as unknown as SupabaseClient;
}
