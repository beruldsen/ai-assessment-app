-- Compatibility migration for jobs table
-- Keeps older code paths using `error` and newer worker code using `last_error` working together.

alter table public.jobs add column if not exists error text;
alter table public.jobs add column if not exists last_error text;
alter table public.jobs add column if not exists locked_at timestamp;
alter table public.jobs add column if not exists locked_by text;
alter table public.jobs add column if not exists attempts integer not null default 0;
