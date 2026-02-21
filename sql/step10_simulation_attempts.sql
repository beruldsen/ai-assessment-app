-- Step 10: Simulation attempts table
-- Run this in Supabase SQL Editor (staging + prod)

create extension if not exists pgcrypto;

create table if not exists public.simulation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_key text not null,
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  input_payload jsonb not null default '{}'::jsonb,
  transcript jsonb not null default '[]'::jsonb,
  score jsonb,
  feedback jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists simulation_attempts_user_idx
  on public.simulation_attempts (user_id, created_at desc);

create index if not exists simulation_attempts_status_idx
  on public.simulation_attempts (status);

alter table public.simulation_attempts enable row level security;

-- Participants can only see and create their own attempts
drop policy if exists "attempts_select_own" on public.simulation_attempts;
create policy "attempts_select_own"
on public.simulation_attempts
for select
using (auth.uid() = user_id);

drop policy if exists "attempts_insert_own" on public.simulation_attempts;
create policy "attempts_insert_own"
on public.simulation_attempts
for insert
with check (auth.uid() = user_id);

-- Block direct updates/deletes from client by default.
-- Server-side service role key can still update rows.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_simulation_attempts_updated_at on public.simulation_attempts;
create trigger trg_simulation_attempts_updated_at
before update on public.simulation_attempts
for each row execute function public.set_updated_at();
