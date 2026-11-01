-- Slice 1: goals, plans and check-ins. Mirrors src/domain/types.ts.
-- Tables carry an okr_ prefix so they can share a Supabase project with other apps.
-- The status rules stay in the app (src/domain); the database keeps the records and the invariants.

create table okr_teams (
  id text primary key,
  name text not null,
  lead_id text,
  objective text not null default ''
);

create table okr_people (
  id text primary key,
  name text not null,
  role text not null default '',
  initials text not null,
  team_id text references okr_teams (id) on delete set null
);

alter table okr_teams add constraint okr_teams_lead_fk foreign key (lead_id) references okr_people (id) on delete set null deferrable initially deferred;

create table okr_cycles (
  id text primary key,
  name text not null,
  start_date date not null,
  weeks int not null default 13 check (weeks between 1 and 52)
);

create table okr_goals (
  id text primary key,
  cycle_id text not null references okr_cycles (id),
  team_id text not null references okr_teams (id),
  owner_id text not null references okr_people (id),
  parent_id text references okr_goals (id),
  title text not null check (length(trim(title)) >= 3),
  kind text not null check (kind in ('metric', 'range', 'milestone')),
  io text not null check (io in ('input', 'output')),
  headline boolean not null default false,
  guardrail boolean not null default false,
  effect numeric,
  source text not null default '',
  definition text not null default '',
  unit text,
  decimals int check (decimals between 0 and 3),
  -- metric
  plan_start numeric,
  plan_target numeric,
  plan_shape text check (plan_shape in ('straight', 'back', 'stepped')),
  original_plan jsonb,
  rebaselined_week int,
  -- range
  range_bound text check (range_bound in ('atMost', 'atLeast')),
  range_limit numeric,
  range_margin numeric check (range_margin >= 0),
  created_at timestamptz not null default now(),
  check (kind <> 'metric' or (plan_start is not null and plan_target is not null and plan_shape is not null and plan_start <> plan_target)),
  check (kind <> 'range' or (range_bound is not null and range_limit is not null and range_margin is not null)),
  check (not headline or parent_id is null)
);

-- One headline goal per cycle.
create unique index okr_one_headline on okr_goals (cycle_id) where headline;

create table okr_stages (
  id text not null,
  goal_id text not null references okr_goals (id) on delete cascade,
  name text not null,
  due_week int not null check (due_week >= 1),
  primary key (goal_id, id)
);

create table okr_check_ins (
  id text primary key,
  goal_id text not null references okr_goals (id) on delete cascade,
  author_id text not null references okr_people (id),
  week int not null check (week >= 1),
  posted_at timestamptz not null default now(),
  value numeric,
  stages jsonb,
  status text not null check (status in ('on', 'risk', 'off', 'done')),
  calculated text not null check (calculated in ('on', 'risk', 'off', 'done')),
  cause text check (cause in ('aggressive', 'slower', 'blocked', 'external', 'data', 'cautious', 'early', 'oneoff')),
  why text not null default '',
  greener_why text not null default '',
  propose_target numeric,
  ptg_what text,
  ptg_by_week int,
  ptg_needs text not null default '',
  next text not null default '',
  data_flagged boolean not null default false,
  -- One check-in per goal per week; editing replaces it.
  unique (goal_id, week),
  -- At risk and Off track carry a path to green with a later week.
  -- coalesce: a CHECK that evaluates to NULL passes, so missing fields must count as empty.
  check (status not in ('risk', 'off') or (length(trim(coalesce(ptg_what, ''))) >= 8 and coalesce(ptg_by_week, 0) > week)),
  -- A call greener than the calculation carries its reason.
  check (
    (case status when 'off' then 3 when 'risk' then 2 else 1 end) >= (case calculated when 'off' then 3 when 'risk' then 2 else 1 end)
    or length(trim(greener_why)) >= 10
  )
);

create index okr_check_ins_goal_week on okr_check_ins (goal_id, week);

-- Row-level security is on. With no policies nothing is readable; 0002 opens the okr_ tables
-- (and only those) for the demo until sign-in lands.
alter table okr_teams enable row level security;
alter table okr_people enable row level security;
alter table okr_cycles enable row level security;
alter table okr_goals enable row level security;
alter table okr_stages enable row level security;
alter table okr_check_ins enable row level security;
