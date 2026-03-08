-- Pass 1: admin-managed setup + invite tracking

create table if not exists assessment360_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table assessment360_cycle_participants
  add column if not exists name text,
  add column if not exists invite_status text not null default 'pending' check (invite_status in ('pending', 'sent', 'failed', 'accepted')),
  add column if not exists invite_sent_at timestamptz,
  add column if not exists invite_error text,
  add column if not exists active boolean not null default true;

create index if not exists idx_assessment360_cycle_participants_role
  on assessment360_cycle_participants(cycle_id, role);
