-- 180 assessment: per-rater submission states + development action plan

create table if not exists assessment360_submissions (
  cycle_id uuid not null references assessment360_cycles(id) on delete cascade,
  rater_type text not null check (rater_type in ('self', 'manager')),
  status text not null default 'draft' check (status in ('draft', 'final_submitted')),
  submitted_at timestamptz,
  submitted_by text,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (cycle_id, rater_type)
);

create index if not exists idx_assessment360_submissions_cycle_id
  on assessment360_submissions(cycle_id);

create table if not exists assessment360_action_plans (
  cycle_id uuid primary key references assessment360_cycles(id) on delete cascade,
  strengths text,
  priorities text,
  plan_30 text,
  plan_60 text,
  plan_90 text,
  updated_at timestamptz not null default now()
);
