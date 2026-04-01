alter table assessment360_cycles
  add column if not exists send_completion_email boolean not null default true,
  add column if not exists completion_email_sent_at timestamptz;
