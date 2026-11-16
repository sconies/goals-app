-- 0058: the database refuses what a switched-off module would write (backlog, bugs found by the drill, 15 Nov).
-- Until now only the app's actions and the MCP server's tools checked a workspace's switches: okr_commit kept a save
-- that wrote Reviews' records, a watch, or a metric or field change while that module was off, and okr_token_create
-- made a token while AI access was off. Both now check `okr_workspaces.modules_off`, as the app's rules do:
--   * okr_token_create refuses while `ai-access` is off ("AI access is off in {workspace}.", the app's words);
--     revoking a token is never refused, so one can be ended for good while it is off.
--   * okr_commit refuses, while a module is off, a save that logs a change to that module's own kind of record
--     (faro.module_entities: a metric, a field, a review, a note said in one, a watch), and the rest of Reviews' and
--     Watching's rules (src/domain/reviewWrites.ts, src/domain/watchWrites.ts): a note or a review not stored before,
--     an ask raised in a review, a goal proposed in one; a watch stopped by its id, or watches written with nothing
--     else. What a save only carries along still runs: a module's rows moving with a goal into the next cycle, or the
--     reviews someone leaves when marked as left. The switches read are the ones the save leaves in force (a save that
--     switches a module on may write its records; one that switches it off may not).
-- The app and the MCP server already refuse all of this, so no code relies on it: it ships with the code that says so.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro. One new table, read by anon
-- (grants written out); one new function, revoked from public (okr_commit calls it as its owner's caller, anon).
-- okr_commit and okr_token_create keep their owner and grants (create or replace changes neither). Safe to run twice.

-- Which module owns each kind of change-log entry: a module with a kind of its own adds it here in its migration.
create table if not exists faro.module_entities (
  entity text primary key,
  module text not null,
  module_name text not null
);
alter table faro.module_entities enable row level security;
drop policy if exists "saves: read" on faro.module_entities;
create policy "saves: read" on faro.module_entities for select to anon using (true);
grant select on faro.module_entities to anon;

insert into faro.module_entities (entity, module, module_name) values
  ('metric', 'metrics', 'Metric library'),
  ('field', 'tags', 'Fields'),
  ('review', 'reviews', 'Reviews'),
  ('decision', 'reviews', 'Reviews'),
  ('watch', 'watching', 'Watching')
on conflict (entity) do nothing;

create or replace function faro.modules_off_check(ws text, p jsonb) returns void
language plpgsql set search_path = faro, pg_temp as $$
declare
  off text[];
  wsname text;
  hit text;
  sentence constant text := '%s is switched off in %s. An admin can switch it on in Workspace, Features.';
begin
  select coalesce(w.modules_off, '{}'), w.name into off, wsname from okr_workspaces w where w.id = ws;
  -- The switches this save leaves in force.
  if jsonb_typeof(p->'workspace_modules_off') = 'array' then
    off := array(select jsonb_array_elements_text(p->'workspace_modules_off'));
  end if;
  if coalesce(cardinality(off), 0) = 0 then return; end if;

  -- A change logged to a switched-off module's own kind of record.
  select e.module_name into hit
    from jsonb_array_elements(case jsonb_typeof(p->'changes') when 'array' then p->'changes' else '[]'::jsonb end) c
    join module_entities e on e.entity = c->>'entity'
    where e.module = any (off) limit 1;
  if hit is not null then raise exception using errcode = 'P0001', message = format(sentence, hit, wsname); end if;

  -- Reviews' records (src/domain/reviewWrites.ts writesReviews).
  if 'reviews' = any (off) and (
    (jsonb_typeof(p->'decisions') = 'array' and jsonb_array_length(p->'decisions') > 0)
    or exists (select 1 from jsonb_array_elements(case jsonb_typeof(p->'reviews') when 'array' then p->'reviews' else '[]'::jsonb end) r
               where not exists (select 1 from okr_reviews v where v.workspace_id = ws and v.id = r->>'id'))
    or exists (select 1 from jsonb_array_elements(case jsonb_typeof(p->'goals') when 'array' then p->'goals' else '[]'::jsonb end) g
               where coalesce(g->>'proposed_in', '') <> ''
                 and g->>'proposed_in' is distinct from (select s.proposed_in from okr_goals s where s.workspace_id = ws and s.id = g->>'id'))
    or exists (select 1 from jsonb_array_elements(case jsonb_typeof(p->'requests') when 'array' then p->'requests' else '[]'::jsonb end) a
               where coalesce(a->>'review_id', '') <> ''
                 and a->>'review_id' is distinct from (select s.review_id from okr_requests s where s.workspace_id = ws and s.id = a->>'id'))
  ) then
    raise exception using errcode = 'P0001', message = format(sentence, 'Reviews', wsname);
  end if;

  -- Watching's records (src/domain/watchWrites.ts writesWatches): a watch stopped by its id, or watches and nothing else.
  if 'watching' = any (off) and (
    (jsonb_typeof(p->'unwatch') = 'array' and jsonb_array_length(p->'unwatch') > 0)
    or (jsonb_typeof(p->'watches') = 'array' and jsonb_array_length(p->'watches') > 0
        and not exists (select 1 from jsonb_each(p) k
                        where k.key not in ('changes', 'watches', 'expect')
                          and ((jsonb_typeof(k.value) = 'array' and jsonb_array_length(k.value) > 0)
                               or (jsonb_typeof(k.value) = 'object' and k.value <> '{}'::jsonb))))
  ) then
    raise exception using errcode = 'P0001', message = format(sentence, 'Watching', wsname);
  end if;
end $$;
revoke execute on function faro.modules_off_check(text, jsonb) from public;
grant execute on function faro.modules_off_check(text, jsonb) to anon;

-- 0011's save, with the switches checked before anything is written.
create or replace function faro.okr_commit(ws text, payload jsonb) returns void
language plpgsql set search_path = faro, pg_temp as $$
begin
  if not exists (select 1 from okr_workspaces where id = ws) then raise exception 'no workspace %', ws using errcode = 'P0001'; end if;
  perform okr_same_workspace(ws, payload);
  perform modules_off_check(ws, payload);
  perform okr_check_expectations(ws, payload->'expect');
  perform okr_write(ws, payload);
end $$;

-- 0024's token maker, refusing while AI access is off.
create or replace function faro.okr_token_create(ws text, token jsonb, change jsonb default null) returns text
language plpgsql volatile security definer set search_path = faro, pg_temp as $$
declare
  tid text := token->>'id';
  pid text := token->>'person_id';
  by_id text := token->>'created_by';
  nm text := trim(coalesce(token->>'name', ''));
  secret text;
begin
  if not exists (select 1 from okr_people p where p.id = by_id and p.workspace_id = ws and p.is_admin) then
    raise exception 'Only admins can make tokens.' using errcode = 'P0001';
  end if;
  if exists (select 1 from okr_workspaces w where w.id = ws and 'ai-access' = any (coalesce(w.modules_off, '{}'))) then
    raise exception using errcode = 'P0001', message = format('AI access is off in %s.', (select w.name from okr_workspaces w where w.id = ws));
  end if;
  if not exists (select 1 from okr_people p where p.id = pid and p.workspace_id = ws) then
    raise exception 'There’s no one with that ID in this workspace.' using errcode = 'P0001';
  end if;
  if length(nm) < 2 or length(nm) > 120 then
    raise exception 'Say what the token is for, e.g. “Claude on my laptop”.' using errcode = 'P0001';
  end if;
  if coalesce(tid, '') !~ '^tok_[a-z0-9]{4,60}$' then
    raise exception 'A token id is tok_ and letters or digits.' using errcode = 'P0001';
  end if;
  if change is not null and (change->>'workspace_id') is distinct from ws then
    raise exception 'The change belongs to another workspace.' using errcode = 'P0001';
  end if;
  secret := okr_token_secret();
  insert into okr_api_tokens (id, workspace_id, person_id, name, token_hash, created_by, created_at)
    values (tid, ws, pid, nm, encode(sha256(convert_to(secret, 'UTF8')), 'hex'), by_id, now());
  if change is not null then perform okr_upsert('okr_changes', jsonb_build_array(change), 'id', 'nothing'); end if;
  return secret;
end $$;

notify pgrst, 'reload schema';
