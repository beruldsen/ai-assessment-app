-- Adds lightweight telemetry storage for behavioural interviews.
-- Apply in Supabase SQL editor (staging first, then prod).

alter table if exists interviews
add column if not exists telemetry jsonb not null default '{}'::jsonb;
