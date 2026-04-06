-- Behavioural interview module foundation
-- Apply in Supabase SQL editor (staging first, then prod)

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  user_id uuid,
  status text not null default 'running' check (status in ('running','completed','failed')),
  selected_capabilities jsonb not null default '[]'::jsonb,
  current_capability text,
  started_at timestamp not null default now(),
  completed_at timestamp,
  created_at timestamp not null default now()
);

create index if not exists interviews_org_id_idx on interviews(org_id);
create index if not exists interviews_user_id_idx on interviews(user_id);

create table if not exists interview_messages (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  capability text,
  role text not null check (role in ('assistant','user','system')),
  transcript_text text not null,
  audio_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now()
);

create index if not exists interview_messages_interview_id_idx on interview_messages(interview_id);
create index if not exists interview_messages_capability_idx on interview_messages(capability);

create table if not exists interview_scores (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  capability text not null,
  score numeric not null check (score >= 1 and score <= 5),
  evidence_summary text,
  strengths jsonb not null default '[]'::jsonb,
  development_areas jsonb not null default '[]'::jsonb,
  behavioural_patterns jsonb not null default '[]'::jsonb,
  coaching_recommendations jsonb not null default '[]'::jsonb,
  created_at timestamp not null default now(),
  unique (interview_id, capability)
);

create index if not exists interview_scores_interview_id_idx on interview_scores(interview_id);
