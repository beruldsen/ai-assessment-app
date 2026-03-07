-- 360 Assessment MVP (self + manager)

create table if not exists public.assessment360_cycles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  participant_name text not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.assessment360_responses (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.assessment360_cycles(id) on delete cascade,
  rater_type text not null check (rater_type in ('self','manager')),
  question_id text not null,
  dimension text not null,
  question_text text not null,
  score int not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (cycle_id, rater_type, question_id)
);

create index if not exists assessment360_responses_cycle_idx
  on public.assessment360_responses (cycle_id, rater_type);
