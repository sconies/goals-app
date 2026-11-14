-- PP0: a few small values per person and workspace kept on the server, so they follow the person between devices
-- (Lane, 14 Nov: opening a proposed goal on a phone marks it opened on the laptop too). The Prefs port's server side
-- (src/ports/prefs.ts): one row per person, workspace and key, its value any JSON. Only the keys listed here are kept
-- on the server; the rest of the Prefs stay in the browser. First key: `proposals`, the proposed goals the person has
-- opened and the "has been proposed for n weeks" asks they put off ("Not yet"), as src/app/proposalSeen.ts keeps them.
-- Shipped one merge ahead of the code that uses it (AX10): nothing reads it yet.
-- Not a record: no change log, no save through okr_commit, nothing in Recently removed. The app writes a row as the
-- person acts and reads their rows when a workspace opens.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro, every grant written out, row
-- rules as the workspace's other tables. Safe to run twice. Named without `okr_` (see 0052).

create table if not exists faro.person_prefs (
  workspace_id text not null references faro.okr_workspaces (id) on delete cascade,
  person_id text not null,
  key text not null constraint person_prefs_key_check check (key in ('proposals')),
  -- Small by design: a list of goal ids and a few dates.
  value jsonb not null constraint person_prefs_value_check check (pg_column_size(value) <= 16384),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, person_id, key)
);

-- The app's public key reads, adds and changes them, as the workspace's other tables; nothing deletes them (a deleted
-- workspace takes its rows with it).
alter table faro.person_prefs enable row level security;
drop policy if exists "demo: read" on faro.person_prefs;
drop policy if exists "demo: add" on faro.person_prefs;
drop policy if exists "demo: change" on faro.person_prefs;
create policy "demo: read" on faro.person_prefs for select to anon using (true);
create policy "demo: add" on faro.person_prefs for insert to anon with check (true);
create policy "demo: change" on faro.person_prefs for update to anon using (true) with check (true);
grant select, insert, update on faro.person_prefs to anon;
