-- Markups and the builder inbox (Faro's plan, release 1, 6 Nov), and closing the AI-token hole. No new secrets: the
-- inbox signs builders in with Supabase Auth (an email link), and everything else runs on the app's public key.
--
-- 1. Builders. okr_builders lists the email addresses of the people building Faro (Lane first). okr_is_builder() says
--    whether the person signed in (Supabase Auth, the inbox's email link) is one of them. Only the inbox signs in;
--    the rest of the app has no sign-in until release 4, and an admin who isn't a builder can't read the inbox until then.
--
-- 2. Markups. Anyone using the app can mark up a screen and send it: okr_markups gets one row per markup, and its
--    pictures go to the private Storage bucket "markups", in a folder named by the markup's id. The id comes from the
--    database (okr_markup_new_id), so the public key can only add a markup, and upload its pictures, under an id the
--    database issued in the last two hours. The public key can add rows and pictures; it can never read, change or
--    delete them. A markup sent from the demo is kept too, marked demo, like demo feedback (0019).
--    Signed-in builders read every markup and triage it (status, its GitHub issue's address, the What's new entry that
--    fixed it), and read the pictures through signed links. okr_markups_raised tells a person which of their own
--    markups were fixed, so What's new can say "You raised this"; it returns ids and statuses only.
--
-- 3. AI assistant tokens. The public key can no longer read, add or change okr_api_tokens. A token is made by
--    okr_token_create, which makes the secret in the database, stores only its SHA-256 hash and returns the secret
--    once; okr_token_revoke revokes one. The app lists tokens with okr_token_list (never the hash), and the MCP server
--    finds a token by its hash with okr_token_find and okr_token_touch. Saves (okr_write) no longer write tokens.
--    A signed-in builder can make a builder token (okr_builder_token_create): the MCP server's markup tools work only
--    with one, through okr_markups_for_token, okr_markup_for_token and okr_markup_triage_for_token.
--
-- 4. Feedback. The public key can still send feedback but no longer read the whole table; Workspace reads one
--    workspace's with okr_feedback_list.
--
-- Safe to run more than once. The parts that need Supabase Auth or Storage (the "authenticated" role, auth.jwt(), the
-- storage schema) are skipped on a database without them.

/* ---------- 1. Builders ---------- */

create table if not exists okr_builders (
  email text primary key check (email = lower(trim(email)) and email like '%_@_%')
);
alter table okr_builders enable row level security;
insert into okr_builders (email) values ('lanehirschfield@gmail.com') on conflict do nothing;

-- Whether the person signed in to the inbox is a builder: their email (from Supabase Auth's token) is on the list.
-- plpgsql, so a database without Supabase Auth can still load this file.
create or replace function okr_is_builder() returns boolean
language plpgsql stable security definer set search_path = public as $$
declare e text;
begin
  e := lower(trim(coalesce(auth.jwt()->>'email', '')));
  return e <> '' and exists (select 1 from okr_builders b where b.email = e);
end $$;

/* ---------- 2. Markups ---------- */

-- Ids the database has issued for a markup. Read only by the functions below; kept a day.
create table if not exists okr_markup_ids (
  id text primary key,
  issued_at timestamptz not null default now()
);
alter table okr_markup_ids enable row level security;

create or replace function okr_markup_new_id() returns text
language plpgsql volatile security definer set search_path = public as $$
declare v text;
begin
  delete from okr_markup_ids where issued_at < now() - interval '1 day';
  v := 'mk_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into okr_markup_ids (id) values (v);
  return v;
end $$;

-- An id the database issued in the last two hours: what a new markup, and the folder of its pictures, must be named by.
create or replace function okr_markup_id_ok(mid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from okr_markup_ids where id = mid and issued_at > now() - interval '2 hours')
$$;

create table if not exists okr_markups (
  id text primary key check (id ~ '^mk_[0-9a-f]{16}$'),
  -- Not a foreign key: a markup from the demo names the demo's workspace, which lives in the visitor's browser.
  workspace_id text not null check (length(workspace_id) between 1 and 80),
  workspace_name text not null default '' check (length(workspace_name) <= 200),
  demo boolean not null default false,
  person_id text not null default '' check (length(person_id) <= 80),
  person_name text not null default '' check (length(person_name) <= 200),
  -- "What should change?", in the sender's words, and how the app is working for them.
  line text not null check (length(trim(line)) between 1 and 500),
  mood text check (mood is null or mood in ('good', 'meh', 'bad')),
  route text not null default '' check (length(route) <= 200),
  path text not null default '' check (length(path) <= 500),
  goal_id text check (goal_id is null or length(goal_id) <= 80),
  review_id text check (review_id is null or length(review_id) <= 80),
  -- The named screen parts under each stroke, each a path such as ["Goal page", "Scorecard", "Will it hit"].
  parts jsonb not null default '[]' check (jsonb_typeof(parts) = 'array' and octet_length(parts::text) <= 16384),
  -- Pen lines, arrows, boxes and numbered notes, as vectors in the screen's CSS pixels.
  strokes jsonb not null default '[]' check (jsonb_typeof(strokes) = 'array' and octet_length(strokes::text) <= 200000),
  -- Viewport, theme, accent, app version, this tab's session id.
  context jsonb not null default '{}' check (jsonb_typeof(context) = 'object' and octet_length(context::text) <= 8192),
  -- The last 20 steps of the visit (only when the sender left that ticked), and the errors and failed saves of the visit.
  steps jsonb not null default '[]' check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 20 and octet_length(steps::text) <= 32768),
  errors jsonb not null default '[]' check (jsonb_typeof(errors) = 'array' and jsonb_array_length(errors) <= 25 and octet_length(errors::text) <= 32768),
  -- The pictures uploaded to markups/<id>/: the screen, the drawing on its own, a thumbnail, and the two together.
  pictures text[] not null default '{}' check (pictures <@ array['screen.png', 'ink.png', 'thumb.jpg', 'marked.jpg']),
  -- Triage, by builders only.
  status text not null default 'new' check (status in ('new', 'in-hand', 'fixed', 'wont-fix')),
  issue_url text check (issue_url is null or issue_url ~ '^https://github\.com/[^/]+/[^/]+/issues/[0-9]+$'),
  fixed_in text check (fixed_in is null or fixed_in ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  wont_fix_reason text check (wont_fix_reason is null or length(trim(wont_fix_reason)) between 1 and 2000),
  status_by text check (status_by is null or length(status_by) <= 200),
  status_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists okr_markups_time on okr_markups (created_at desc);
create index if not exists okr_markups_person on okr_markups (workspace_id, person_id);
alter table okr_markups enable row level security;

-- Whether a markup may be added: an issued id, and a workspace that exists (or the demo). Runs as the owner, so the
-- insert policy doesn't depend on what the public key can read.
create or replace function okr_markup_allowed(mid text, ws text, is_demo boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select okr_markup_id_ok(mid) and (is_demo or exists (select 1 from okr_workspaces w where w.id = ws))
$$;

-- The public key adds new markups, untriaged, and nothing else.
drop policy if exists "markups: add" on okr_markups;
create policy "markups: add" on okr_markups for insert to anon with check (
  okr_markup_allowed(id, workspace_id, demo)
  and status = 'new' and issue_url is null and fixed_in is null and wont_fix_reason is null and status_by is null and status_at is null
);
grant insert on okr_markups to anon;
revoke select, update, delete on okr_markups from anon;
revoke all on okr_markup_ids from anon;
revoke all on okr_builders from anon;

-- Which of a person's own markups (not the demo's) are where: for What's new's "You raised this". Ids and status only.
create or replace function okr_markups_raised(ws text, person text) returns table (id text, status text, fixed_in text)
language sql stable security definer set search_path = public as $$
  select m.id, m.status, m.fixed_in from okr_markups m where m.workspace_id = ws and m.person_id = person and not m.demo order by m.created_at desc limit 200
$$;

grant execute on function okr_markup_new_id(), okr_markup_id_ok(text), okr_markup_allowed(text, text, boolean), okr_markups_raised(text, text) to anon;

-- Signed-in builders read and triage markups; anyone else signed in gets nothing (the app's own tables are the public
-- key's, so a signed-in session has no more access than that). Only the triage columns can change.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on okr_markups, okr_markup_ids, okr_builders from authenticated';
    execute 'grant select on okr_markups to authenticated';
    execute 'grant update (status, issue_url, fixed_in, wont_fix_reason, status_by, status_at) on okr_markups to authenticated';
    execute 'drop policy if exists "markups: builders read" on okr_markups';
    execute 'create policy "markups: builders read" on okr_markups for select to authenticated using (okr_is_builder())';
    execute 'drop policy if exists "markups: builders triage" on okr_markups';
    execute 'create policy "markups: builders triage" on okr_markups for update to authenticated using (okr_is_builder()) with check (okr_is_builder())';
    execute 'grant execute on function okr_is_builder() to authenticated';
  end if;
end $$;

-- The pictures: a private bucket. The public key may upload the four pictures of a markup into the folder named by an
-- issued id, and nothing else: no reading, replacing or deleting. Signed-in builders read them (the inbox makes signed
-- links for them). Only where the database has Supabase Storage.
do $$
begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('markups', 'markups', false, 5242880, array['image/png', 'image/jpeg'])
      on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists "markups: upload" on storage.objects';
    execute $policy$
      create policy "markups: upload" on storage.objects for insert to anon with check (
        bucket_id = 'markups'
        and public.okr_markup_id_ok((storage.foldername(name))[1])
        and array_length(storage.foldername(name), 1) = 1
        and storage.filename(name) in ('screen.png', 'ink.png', 'thumb.jpg', 'marked.jpg')
      )
    $policy$;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'drop policy if exists "markups: builders read" on storage.objects';
      execute $policy$
        create policy "markups: builders read" on storage.objects for select to authenticated using (bucket_id = 'markups' and public.okr_is_builder())
      $policy$;
    end if;
  end if;
end $$;

/* ---------- 3. AI assistant tokens ---------- */

drop policy if exists "demo: read" on okr_api_tokens;
drop policy if exists "demo: add" on okr_api_tokens;
drop policy if exists "demo: change" on okr_api_tokens;
revoke all on okr_api_tokens from anon;

-- A builder token (made by a signed-in builder) carries the builder's email: the MCP server's markup tools need one.
alter table okr_api_tokens add column if not exists builder_email text;

-- A new secret: "gk_" and 40 letters and digits, from the random bytes of version-4 UUIDs (a strong random source),
-- skipping the two bytes that carry the version and variant bits. Not for the public key: only the functions below.
create or replace function okr_token_secret() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  abc constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  secret text := 'gk_';
  raw bytea;
  n int := 0;
  i int;
begin
  while n < 40 loop
    raw := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    for i in 0..15 loop
      continue when i in (6, 8) or n >= 40;
      secret := secret || substr(abc, get_byte(raw, i) % 62 + 1, 1);
      n := n + 1;
    end loop;
  end loop;
  return secret;
end $$;

-- A workspace's tokens, without their hashes.
create or replace function okr_token_list(ws text)
returns table (id text, workspace_id text, person_id text, name text, created_by text, created_at timestamptz, last_used_at timestamptz, revoked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.workspace_id, t.person_id, t.name, t.created_by, t.created_at, t.last_used_at, t.revoked_at
    from okr_api_tokens t where t.workspace_id = ws order by t.created_at, t.id
$$;

-- Makes a token: an admin of the workspace, for someone in it. The secret is made here, only its SHA-256 hash is stored,
-- and it is returned this once. The change-log entry is written in the same transaction. `token` carries id,
-- person_id, name and created_by; `change` is an okr_changes row.
create or replace function okr_token_create(ws text, token jsonb, change jsonb default null) returns text
language plpgsql volatile security definer set search_path = public as $$
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

-- A builder token: a signed-in builder makes one for themselves, acting as a person in a workspace, so their AI
-- assistant can use the MCP server's markup tools. It carries the builder's email; it stops counting as a builder
-- token if that email leaves okr_builders.
create or replace function okr_builder_token_create(ws text, person text, token_name text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  nm text := trim(coalesce(token_name, ''));
  secret text;
begin
  if not okr_is_builder() then raise exception 'Only builders, signed in to the inbox, make a builder token.' using errcode = 'P0001'; end if;
  if not exists (select 1 from okr_people p where p.id = person and p.workspace_id = ws) then
    raise exception 'There’s no one with that ID in this workspace.' using errcode = 'P0001';
  end if;
  if length(nm) < 2 or length(nm) > 120 then raise exception 'Say what the token is for.' using errcode = 'P0001'; end if;
  secret := okr_token_secret();
  insert into okr_api_tokens (id, workspace_id, person_id, name, token_hash, created_by, created_at, builder_email)
    values ('tok_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), ws, person, nm, encode(sha256(convert_to(secret, 'UTF8')), 'hex'),
      person, now(), lower(trim(auth.jwt()->>'email')));
  return secret;
end $$;

-- Revokes a token: an admin of the workspace, or the token's own person. False when it was already revoked.
create or replace function okr_token_revoke(ws text, token_id text, by_id text, change jsonb default null) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare t okr_api_tokens;
begin
  select * into t from okr_api_tokens where id = token_id and workspace_id = ws;
  if not found then raise exception 'There’s no token with that ID.' using errcode = 'P0001'; end if;
  if t.revoked_at is not null then return false; end if;
  if t.person_id <> by_id and not exists (select 1 from okr_people p where p.id = by_id and p.workspace_id = ws and p.is_admin) then
    raise exception 'Only an admin or the token’s person can revoke it.' using errcode = 'P0001';
  end if;
  if change is not null and (change->>'workspace_id') is distinct from ws then
    raise exception 'The change belongs to another workspace.' using errcode = 'P0001';
  end if;
  update okr_api_tokens set revoked_at = now() where id = token_id;
  if change is not null then perform okr_upsert('okr_changes', jsonb_build_array(change), 'id', 'nothing'); end if;
  return true;
end $$;

-- The email of the builder whose live builder token this is (still on the list), or null.
create or replace function okr_token_builder(hash text) returns text
language sql stable security definer set search_path = public as $$
  select t.builder_email from okr_api_tokens t join okr_builders b on b.email = t.builder_email
   where t.token_hash = hash and t.revoked_at is null
$$;

-- For the MCP server: the live token with this hash (whoever holds the token can find it), whether it is a builder
-- token, and noting when it was used.
create or replace function okr_token_find(hash text)
returns table (id text, workspace_id text, person_id text, name text, created_by text, created_at timestamptz, last_used_at timestamptz, revoked_at timestamptz, builder boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.workspace_id, t.person_id, t.name, t.created_by, t.created_at, t.last_used_at, t.revoked_at, okr_token_builder(hash) is not null
    from okr_api_tokens t where t.token_hash = hash and t.revoked_at is null
$$;

create or replace function okr_token_touch(hash text) returns void
language sql volatile security definer set search_path = public as $$
  update okr_api_tokens set last_used_at = now() where token_hash = hash and revoked_at is null
$$;

-- The MCP server's markup tools, with a builder token: list, open and triage markups. The checks on what a status
-- change needs live in the app's code (src/markup/model.ts statusPatch), shared with the inbox; the table's own checks
-- back them up.
create or replace function okr_markups_for_token(hash text, ws text default null, st text default null, lim int default 50) returns setof okr_markups
language plpgsql stable security definer set search_path = public as $$
begin
  if okr_token_builder(hash) is null then raise exception 'Only a builder token can read markups.' using errcode = 'P0001'; end if;
  return query select * from okr_markups m
    where (ws is null or (m.workspace_id = ws and not m.demo)) and (st is null or m.status = st)
    order by m.created_at desc limit least(greatest(coalesce(lim, 50), 1), 500);
end $$;

create or replace function okr_markup_for_token(hash text, mid text) returns setof okr_markups
language plpgsql stable security definer set search_path = public as $$
begin
  if okr_token_builder(hash) is null then raise exception 'Only a builder token can read markups.' using errcode = 'P0001'; end if;
  return query select * from okr_markups m where m.id = mid;
end $$;

create or replace function okr_markup_triage_for_token(hash text, mid text, patch jsonb) returns setof okr_markups
language plpgsql volatile security definer set search_path = public as $$
begin
  if okr_token_builder(hash) is null then raise exception 'Only a builder token can change markups.' using errcode = 'P0001'; end if;
  return query update okr_markups m set
      status = case when patch ? 'status' then patch->>'status' else m.status end,
      issue_url = case when patch ? 'issue_url' then patch->>'issue_url' else m.issue_url end,
      fixed_in = case when patch ? 'fixed_in' then patch->>'fixed_in' else m.fixed_in end,
      wont_fix_reason = case when patch ? 'wont_fix_reason' then patch->>'wont_fix_reason' else m.wont_fix_reason end,
      status_by = case when patch ? 'status_by' then patch->>'status_by' else m.status_by end,
      status_at = case when patch ? 'status_at' then (patch->>'status_at')::timestamptz else m.status_at end
    where m.id = mid returning m.*;
end $$;

revoke execute on function okr_token_secret() from public;
revoke execute on function okr_token_builder(text) from public;
grant execute on function okr_token_list(text), okr_token_create(text, jsonb, jsonb), okr_token_revoke(text, text, text, jsonb), okr_token_find(text), okr_token_touch(text),
  okr_markups_for_token(text, text, text, int), okr_markup_for_token(text, text), okr_markup_triage_for_token(text, text, jsonb) to anon;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function okr_token_secret() from %I', r);
      execute format('revoke execute on function okr_token_builder(text) from %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on okr_api_tokens from authenticated';
    execute 'grant execute on function okr_builder_token_create(text, text, text) to authenticated';
  end if;
  -- Only a signed-in builder makes a builder token.
  execute 'revoke execute on function okr_builder_token_create(text, text, text) from anon';
end $$;
revoke execute on function okr_builder_token_create(text, text, text) from public;

-- Feedback a save sends, added once (a retried save doesn't send it twice). "On conflict do nothing" has to look for the
-- row already there, which the public key can no longer do, so this runs as the owner, for this workspace's rows only.
create or replace function okr_feedback_add(ws text, rows jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if rows is null or jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then return; end if;
  if exists (select 1 from jsonb_array_elements(rows) r where (r->>'workspace_id') is distinct from ws) then
    raise exception 'a feedback row belongs to another workspace' using errcode = 'P0001';
  end if;
  perform okr_upsert('okr_feedback', rows, 'id', 'nothing');
end $$;
grant execute on function okr_feedback_add(text, jsonb) to anon;

-- Saves no longer write tokens, and send feedback through okr_feedback_add. okr_write as 0022 left it, otherwise.
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
  perform okr_feedback_add(ws, p->'feedback');
  perform okr_upsert('okr_retros', p->'retros', 'id');
  perform okr_upsert('okr_decisions', p->'decisions', 'id');
  perform okr_upsert('okr_watches', p->'watches', 'id', 'nothing');
  delete from okr_watches where workspace_id = ws and id = any (array(select jsonb_array_elements_text(coalesce(p->'unwatch', '[]'::jsonb))));
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

/* ---------- 4. Feedback ---------- */

drop policy if exists "demo: read" on okr_feedback;
revoke select, update, delete on okr_feedback from anon;

-- A workspace's feedback, newest first: what Workspace shows its admins. Scoped to one workspace, like the rest of the
-- workspace's data until sign-in; never every workspace's at once.
create or replace function okr_feedback_list(ws text) returns setof okr_feedback
language sql stable security definer set search_path = public as $$
  select * from okr_feedback f where f.workspace_id = ws order by f.at desc limit 500
$$;
grant execute on function okr_feedback_list(text) to anon;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke select, update, delete on okr_feedback from authenticated';
  end if;
end $$;
