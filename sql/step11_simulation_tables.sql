-- Step 11: Simulation MVP tables
-- Apply in staging + production

create table if not exists public.simulation_scenarios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  name text not null,
  role text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Keep compatibility with earlier step10 table
alter table if exists public.simulation_attempts
  add column if not exists org_id uuid,
  add column if not exists scenario_id uuid references public.simulation_scenarios(id);

-- ChatGPT flow does not require user_id on insert; relax constraint if present
alter table if exists public.simulation_attempts
  alter column user_id drop not null;

create table if not exists public.simulation_messages (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references public.simulation_attempts(id) on delete cascade,
  sender text not null check (sender in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index if not exists simulation_messages_attempt_idx
  on public.simulation_messages (attempt_id, created_at asc);
