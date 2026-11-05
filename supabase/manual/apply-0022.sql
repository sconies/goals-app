-- Paste into Supabase → SQL editor → Run. Applies migration 0022 (observability: the telemetry tables, their nightly
-- roll-up and 90-day prune on pg_cron, and the workspace's recording switch) and records it, so the CI migrator won't
-- run it again. Safe to run more than once.
begin;
-- Observability, release 1 (Lane's grill, 5 Nov): how the app is used and where it goes wrong, recorded in the app's own
-- database in OpenTelemetry's shape, so it can be forwarded to a company's tool (Datadog, Grafana) later without rework.
--
--   okr_telemetry_spans    traces: one per thing a person does (page, action, the save it makes, flow steps), and the
--                          MCP server's tool calls. trace_id 32 hex, span_id 16 hex, parent, kind, start and end, status.
--   okr_telemetry_logs     errors, failed saves (a rule saying no told apart from a save that didn't get through) and
--                          other events, in the trace they happened in.
--   okr_telemetry_metrics  load timings: time to first byte, page load, largest contentful paint.
--   okr_telemetry_daily    daily totals, kept for good: counts, errors, p50 and p95 durations by name, route and flow
--                          step, and flow starts, finishes and stops by step.
--
-- Never anything a person types: the app sends only attributes on an allow-list (src/telemetry/attributes.ts), and
-- attributes are capped in size here. Anyone using the app can add rows; nobody can read them through the app's public
-- key. They're read with the database's own access (the service role) by the people building the app.
-- Raw rows are kept 90 days. Every night pg_cron rolls yesterday up into okr_telemetry_daily, and before anything
-- older than 90 days is deleted its days are rolled up again, so late arrivals are counted too.
--
-- Recording is on for everyone by default. An admin can turn it off for a workspace (okr_workspaces.recording, saved by
-- okr_write); while it's off the app sends nothing, and the database refuses rows for that workspace anyway.
-- Safe to run more than once.

-- The recording switch. Null (a workspace created before this, or by a save that doesn't say) means on.
alter table okr_workspaces add column if not exists recording boolean default true;

-- Whether rows may be added for a workspace: yes unless it has turned recording off. Rows with no workspace (setting
-- one up) are allowed. Runs as the owner, so the insert policies don't depend on what the public key can read.
create or replace function okr_telemetry_allowed(ws text) returns boolean
language sql stable security definer set search_path = public as $$
  select ws is null or not exists (select 1 from okr_workspaces w where w.id = ws and w.recording = false)
$$;

create table if not exists okr_telemetry_spans (
  id uuid primary key default gen_random_uuid(),
  trace_id text not null check (trace_id ~ '^[0-9a-f]{32}$' and trace_id <> repeat('0', 32)),
  span_id text not null check (span_id ~ '^[0-9a-f]{16}$' and span_id <> repeat('0', 16)),
  parent_span_id text check (parent_span_id is null or (parent_span_id ~ '^[0-9a-f]{16}$' and parent_span_id <> span_id)),
  name text not null check (length(name) between 1 and 120),
  kind text not null default 'INTERNAL' check (kind in ('INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER')),
  start_time timestamptz not null,
  end_time timestamptz not null check (end_time >= start_time),
  duration_ms double precision not null check (duration_ms >= 0),
  status_code text not null default 'UNSET' check (status_code in ('UNSET', 'OK', 'ERROR')),
  status_message text check (status_message is null or length(status_message) <= 120),
  attributes jsonb not null default '{}' check (jsonb_typeof(attributes) = 'object' and octet_length(attributes::text) <= 8192),
  resource jsonb not null default '{}' check (jsonb_typeof(resource) = 'object' and octet_length(resource::text) <= 4096),
  workspace_id text check (workspace_id is null or length(workspace_id) <= 80),
  session_id text check (session_id is null or session_id ~ '^[0-9a-f]{32}$'),
  received_at timestamptz not null default now()
);
create index if not exists okr_telemetry_spans_time on okr_telemetry_spans (start_time);
create index if not exists okr_telemetry_spans_trace on okr_telemetry_spans (trace_id);
create index if not exists okr_telemetry_spans_workspace on okr_telemetry_spans (workspace_id, start_time);

create table if not exists okr_telemetry_logs (
  id uuid primary key default gen_random_uuid(),
  "timestamp" timestamptz not null,
  observed_timestamp timestamptz not null default now(),
  severity_number int not null check (severity_number between 1 and 24),
  severity_text text not null check (severity_text in ('TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
  body text not null check (length(body) between 1 and 120),
  attributes jsonb not null default '{}' check (jsonb_typeof(attributes) = 'object' and octet_length(attributes::text) <= 8192),
  resource jsonb not null default '{}' check (jsonb_typeof(resource) = 'object' and octet_length(resource::text) <= 4096),
  trace_id text check (trace_id is null or trace_id ~ '^[0-9a-f]{32}$'),
  span_id text check (span_id is null or span_id ~ '^[0-9a-f]{16}$'),
  workspace_id text check (workspace_id is null or length(workspace_id) <= 80),
  session_id text check (session_id is null or session_id ~ '^[0-9a-f]{32}$'),
  received_at timestamptz not null default now()
);
create index if not exists okr_telemetry_logs_time on okr_telemetry_logs ("timestamp");
create index if not exists okr_telemetry_logs_trace on okr_telemetry_logs (trace_id);

create table if not exists okr_telemetry_metrics (
  id uuid primary key default gen_random_uuid(),
  "timestamp" timestamptz not null,
  name text not null check (length(name) between 1 and 120),
  kind text not null default 'gauge' check (kind in ('gauge', 'sum', 'histogram')),
  unit text not null default 'ms' check (length(unit) <= 16),
  value double precision not null,
  attributes jsonb not null default '{}' check (jsonb_typeof(attributes) = 'object' and octet_length(attributes::text) <= 8192),
  resource jsonb not null default '{}' check (jsonb_typeof(resource) = 'object' and octet_length(resource::text) <= 4096),
  trace_id text check (trace_id is null or trace_id ~ '^[0-9a-f]{32}$'),
  span_id text check (span_id is null or span_id ~ '^[0-9a-f]{16}$'),
  workspace_id text check (workspace_id is null or length(workspace_id) <= 80),
  session_id text check (session_id is null or session_id ~ '^[0-9a-f]{32}$'),
  received_at timestamptz not null default now()
);
create index if not exists okr_telemetry_metrics_time on okr_telemetry_metrics ("timestamp", name);

-- Daily totals, kept indefinitely. One row per day and what was counted:
--   signal 'span'   name = span name, route = http.route; count, errors, p50/p95 of duration_ms
--   signal 'log'    name = body, step = severity; count, errors (ERROR and above)
--   signal 'metric' name = metric, route = http.route; count, p50/p95 of the value (all in ms)
--   signal 'flow'   name = flow, step = step reached; starts, steps reached, finishes and stops there, p50/p95 of how
--                   long finished or stopped flows took
create table if not exists okr_telemetry_daily (
  day date not null,
  signal text not null check (signal in ('span', 'log', 'metric', 'flow')),
  name text not null,
  route text not null default '',
  step text not null default '',
  environment text not null default '',
  service text not null default '',
  workspace_id text not null default '',
  count bigint not null default 0,
  error_count bigint not null default 0,
  p50_ms double precision,
  p95_ms double precision,
  flow_starts bigint not null default 0,
  flow_finishes bigint not null default 0,
  flow_stops bigint not null default 0,
  sessions bigint not null default 0,
  primary key (day, signal, name, route, step, environment, service, workspace_id)
);

-- Anyone using the app can add rows (not for a workspace that has turned recording off); nobody can read, change or
-- delete them through the public key. The same pattern as okr_research_notes (0014).
alter table okr_telemetry_spans enable row level security;
alter table okr_telemetry_logs enable row level security;
alter table okr_telemetry_metrics enable row level security;
alter table okr_telemetry_daily enable row level security;
drop policy if exists "telemetry: add spans" on okr_telemetry_spans;
create policy "telemetry: add spans" on okr_telemetry_spans for insert to anon with check (okr_telemetry_allowed(workspace_id));
drop policy if exists "telemetry: add logs" on okr_telemetry_logs;
create policy "telemetry: add logs" on okr_telemetry_logs for insert to anon with check (okr_telemetry_allowed(workspace_id));
drop policy if exists "telemetry: add metrics" on okr_telemetry_metrics;
create policy "telemetry: add metrics" on okr_telemetry_metrics for insert to anon with check (okr_telemetry_allowed(workspace_id));
grant insert on okr_telemetry_spans, okr_telemetry_logs, okr_telemetry_metrics to anon;
grant execute on function okr_telemetry_allowed(text) to anon;

-- One UTC day's raw rows as daily totals. Recomputed whole, so running it again (or later, with late arrivals) is safe.
create or replace function okr_telemetry_rollup(d date) returns void
language plpgsql security definer set search_path = public as $$
declare
  t0 timestamptz := d::timestamp at time zone 'UTC';
  t1 timestamptz := (d + 1)::timestamp at time zone 'UTC';
begin
  delete from okr_telemetry_daily where day = d;

  insert into okr_telemetry_daily (day, signal, name, route, step, environment, service, workspace_id, count, error_count, p50_ms, p95_ms, sessions)
  select d, 'span', name, coalesce(attributes->>'http.route', ''), '', coalesce(resource->>'deployment.environment', ''), coalesce(resource->>'service.name', ''), coalesce(workspace_id, ''),
         count(*), count(*) filter (where status_code = 'ERROR'),
         percentile_cont(0.5) within group (order by duration_ms), percentile_cont(0.95) within group (order by duration_ms),
         count(distinct session_id)
    from okr_telemetry_spans
   where start_time >= t0 and start_time < t1 and not (attributes ? 'app.flow.event')
   group by 3, 4, 6, 7, 8;

  insert into okr_telemetry_daily (day, signal, name, route, step, environment, service, workspace_id, count, error_count, flow_starts, flow_finishes, flow_stops, p50_ms, p95_ms, sessions)
  select d, 'flow', attributes->>'app.flow.name', '', coalesce(attributes->>'app.flow.step', ''), coalesce(resource->>'deployment.environment', ''), coalesce(resource->>'service.name', ''), coalesce(workspace_id, ''),
         count(*), 0,
         count(*) filter (where attributes->>'app.flow.event' = 'start'),
         count(*) filter (where attributes->>'app.flow.event' = 'finish'),
         count(*) filter (where attributes->>'app.flow.event' = 'stop'),
         percentile_cont(0.5) within group (order by (attributes->>'app.flow.duration_ms')::double precision) filter (where attributes ? 'app.flow.duration_ms'),
         percentile_cont(0.95) within group (order by (attributes->>'app.flow.duration_ms')::double precision) filter (where attributes ? 'app.flow.duration_ms'),
         count(distinct session_id)
    from okr_telemetry_spans
   where start_time >= t0 and start_time < t1 and attributes ? 'app.flow.event' and coalesce(attributes->>'app.flow.name', '') <> ''
   group by 3, 5, 6, 7, 8;

  insert into okr_telemetry_daily (day, signal, name, route, step, environment, service, workspace_id, count, error_count, sessions)
  select d, 'log', body, coalesce(attributes->>'http.route', ''), severity_text, coalesce(resource->>'deployment.environment', ''), coalesce(resource->>'service.name', ''), coalesce(workspace_id, ''),
         count(*), count(*) filter (where severity_number >= 17), count(distinct session_id)
    from okr_telemetry_logs
   where "timestamp" >= t0 and "timestamp" < t1
   group by 3, 4, 5, 6, 7, 8;

  insert into okr_telemetry_daily (day, signal, name, route, step, environment, service, workspace_id, count, p50_ms, p95_ms, sessions)
  select d, 'metric', name, coalesce(attributes->>'http.route', ''), '', coalesce(resource->>'deployment.environment', ''), coalesce(resource->>'service.name', ''), coalesce(workspace_id, ''),
         count(*), percentile_cont(0.5) within group (order by value), percentile_cont(0.95) within group (order by value), count(distinct session_id)
    from okr_telemetry_metrics
   where "timestamp" >= t0 and "timestamp" < t1
   group by 3, 4, 6, 7, 8;
end $$;

-- Deletes raw rows older than `keep_days`, after rolling up every day it's about to delete.
create or replace function okr_telemetry_prune(keep_days int default 90) returns void
language plpgsql security definer set search_path = public as $$
declare
  cutoff timestamptz := (current_date - keep_days)::timestamp at time zone 'UTC';
  d date;
begin
  for d in
    select distinct (start_time at time zone 'UTC')::date from okr_telemetry_spans where start_time < cutoff
    union select distinct ("timestamp" at time zone 'UTC')::date from okr_telemetry_logs where "timestamp" < cutoff
    union select distinct ("timestamp" at time zone 'UTC')::date from okr_telemetry_metrics where "timestamp" < cutoff
  loop
    perform okr_telemetry_rollup(d);
  end loop;
  delete from okr_telemetry_spans where start_time < cutoff;
  delete from okr_telemetry_logs where "timestamp" < cutoff;
  delete from okr_telemetry_metrics where "timestamp" < cutoff;
end $$;

-- The nightly job: yesterday's totals, then the 90-day prune.
create or replace function okr_telemetry_nightly() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform okr_telemetry_rollup(current_date - 1);
  perform okr_telemetry_prune(90);
end $$;

-- None of these are for the public key. Supabase grants new functions to anon and authenticated by default, so
-- revoking from public alone would leave them callable (and prune(0) would wipe the raw rows).
revoke execute on function okr_telemetry_rollup(date) from public, anon, authenticated;
revoke execute on function okr_telemetry_prune(int) from public, anon, authenticated;
revoke execute on function okr_telemetry_nightly() from public, anon, authenticated;

-- Every night at 03:17 UTC (pg_cron, where the database has it; a local test database doesn't). Scheduling by name
-- replaces the job if it's already there.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $job$select cron.schedule('okr-telemetry-nightly', '17 3 * * *', 'select okr_telemetry_nightly()')$job$;
  end if;
end $$;

-- Saving the workspace's recording switch, in the same transaction as the rest of the save. okr_write as 0020 left it,
-- plus the switch.
create or replace function okr_write(ws text, p jsonb) returns void
language plpgsql as $$
declare s jsonb;
begin
  perform okr_upsert('okr_teams', p->'teams', 'id');
  perform okr_upsert('okr_people', p->'people', 'id');
  perform okr_upsert('okr_cycles', p->'cycles', 'id');
  perform okr_upsert('okr_goals', p->'goals', 'id');
  for s in select * from jsonb_array_elements(coalesce(p->'stages', '[]'::jsonb)) loop
    delete from okr_stages where goal_id = s->>'goal_id' and not (id = any (array(select jsonb_array_elements_text(coalesce(s->'keep', '[]'::jsonb)))));
    perform okr_upsert('okr_stages', s->'rows', 'goal_id, id');
  end loop;
  perform okr_upsert('okr_check_ins', p->'check_ins', 'id');
  perform okr_upsert('okr_reviews', p->'reviews', 'id');
  perform okr_upsert('okr_feedback', p->'feedback', 'id', 'nothing');
  perform okr_upsert('okr_retros', p->'retros', 'id');
  perform okr_upsert('okr_decisions', p->'decisions', 'id');
  perform okr_upsert('okr_watches', p->'watches', 'id', 'nothing');
  delete from okr_watches where workspace_id = ws and id = any (array(select jsonb_array_elements_text(coalesce(p->'unwatch', '[]'::jsonb))));
  perform okr_upsert('okr_api_tokens', p->'tokens', 'id');
  perform okr_upsert('okr_views', p->'views', 'id');
  perform okr_upsert('okr_requests', p->'requests', 'id');
  -- A removed team's people and goals have moved above; a goal still on it stops the whole save.
  delete from okr_teams where workspace_id = ws and id = any (array(select jsonb_array_elements_text(coalesce(p->'remove_teams', '[]'::jsonb))));
  if coalesce(trim(p->>'workspace_name'), '') <> '' then
    update okr_workspaces set name = trim(p->>'workspace_name') where id = ws;
  end if;
  if jsonb_typeof(p->'workspace_recording') = 'boolean' then
    update okr_workspaces set recording = (p->>'workspace_recording')::boolean where id = ws;
  end if;
  perform okr_upsert('okr_changes', p->'changes', 'id', 'nothing');
end $$;

insert into okr_schema_migrations (name) values ('0022_telemetry.sql') on conflict do nothing;
commit;
