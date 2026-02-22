-- Evidence + Scores + Job-locking columns
-- Run in Supabase SQL editor (staging first, then prod)

create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  attempt_id uuid not null references simulation_attempts(id) on delete cascade,
  domain text not null,
  indicator text not null,
  strength text not null check (strength in ('strong','moderate','weak')),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  excerpts jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamp default now()
);

create index if not exists evidence_attempt_id_idx on evidence(attempt_id);
create index if not exists evidence_org_id_idx on evidence(org_id);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  attempt_id uuid not null references simulation_attempts(id) on delete cascade,
  domain text not null,
  score numeric not null check (score >= 0 and score <= 5),
  maturity text not null check (maturity in ('foundation','advanced','future_ready')),
  evidence_count integer not null default 0,
  created_at timestamp default now(),
  unique (attempt_id, domain)
);

create index if not exists scores_attempt_id_idx on scores(attempt_id);

alter table jobs add column if not exists locked_at timestamp;
alter table jobs add column if not exists locked_by text;
alter table jobs add column if not exists attempts integer not null default 0;
alter table jobs add column if not exists last_error text;
