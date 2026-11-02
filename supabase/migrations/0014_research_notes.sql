-- User research: notes, task results and reports from people and AI agents trying the app. Anyone using the app can
-- add one; nobody can read them back through the app's public key, so researchers can't see each other's notes.
-- They're read by the team (and Claude) with the database's own access.
create table if not exists okr_research_notes (
  id text primary key,
  session_id text not null,
  researcher text not null default '',
  researcher_kind text not null default 'person' check (researcher_kind in ('person', 'ai')),
  kind text not null check (kind in ('first-glance', 'comment', 'task', 'report')),
  persona text not null default '',
  route text not null default '',
  target text not null default '',
  task_id text,
  outcome text check (outcome is null or outcome in ('done', 'stuck', 'gave-up')),
  severity text check (severity is null or severity in ('blocker', 'major', 'minor', 'polish', 'idea')),
  rating int check (rating is null or rating between 1 and 5),
  text text not null check (length(text) <= 20000),
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists okr_research_notes_session on okr_research_notes (session_id, created_at);
alter table okr_research_notes enable row level security;
create policy "research: add" on okr_research_notes for insert to anon with check (true);
grant insert on okr_research_notes to anon;
