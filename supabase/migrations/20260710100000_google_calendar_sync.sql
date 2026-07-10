begin;

create type public.crm_calendar_sync_status as enum ('not_synced', 'pending', 'synced', 'failed');

alter table public.tasks
  add column external_calendar_event_id text unique,
  add column calendar_sync_status public.crm_calendar_sync_status not null default 'not_synced',
  add column calendar_synced_at timestamptz,
  add column calendar_sync_error text,
  add column appointment_location text,
  add column appointment_duration_minutes integer not null default 30 check (appointment_duration_minutes between 5 and 480);

create index tasks_calendar_sync_idx on public.tasks (workspace_id, calendar_sync_status) where external_calendar_event_id is not null;

comment on column public.tasks.external_calendar_event_id is 'Google Calendar event identifier. CRM task data remains authoritative.';
comment on column public.tasks.calendar_sync_error is 'Last server-side calendar synchronization error. Never expose OAuth or Google secrets.';

commit;
