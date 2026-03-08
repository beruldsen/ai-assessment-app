-- A-lite access control: cycle participants mapped by email+role

create table if not exists assessment360_cycle_participants (
  cycle_id uuid not null references assessment360_cycles(id) on delete cascade,
  email text not null,
  role text not null check (role in ('self', 'manager', 'admin')),
  created_at timestamptz not null default now(),
  primary key (cycle_id, email)
);

create index if not exists idx_assessment360_cycle_participants_email
  on assessment360_cycle_participants(email);
