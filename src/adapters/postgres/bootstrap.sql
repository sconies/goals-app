-- Plain Postgres, before Faro's migrations (backlog 8c). The migrations in supabase/migrations were written for
-- Supabase, which provides two roles (anon: the app's public key; authenticated: someone signed in) and two schemas
-- (storage, for files; auth, for who is signed in). On plain Postgres, run this once, then every migration in order.
-- It makes stand-ins with the same names, so the migrations run unchanged. Your service connects as the owner of the
-- tables; the stand-in roles exist so the migrations' grants and row rules have someone to name. Files themselves live
-- wherever your Files adapter keeps them (src/ports/index.ts); storage.objects here only records the paths.
-- Migration 0035 moves Faro's tables and functions into their own schema, faro: connect with search_path faro (or as a
-- role whose default it is, like supabase/manual/faro-role.sql's faro_owner).
-- Safe to run twice.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, unique (bucket_id, name));
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create or replace function storage.filename(name text) returns text language sql immutable as $$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
grant usage on schema storage to anon, authenticated;
grant insert on storage.objects to anon;
grant select, insert on storage.objects to authenticated;
create schema if not exists auth;
-- Who is signed in, as Supabase Auth would say: nobody, unless the connection sets request.jwt.claims.
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated;
