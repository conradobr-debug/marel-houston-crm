begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.crm_app_role as enum (
  'admin',
  'sales_manager',
  'sales_user',
  'project_manager',
  'viewer'
);

create type public.crm_lead_classification as enum (
  'unreviewed',
  'hot',
  'warm',
  'cold',
  'unqualified'
);

create type public.crm_partner_classification as enum (
  'unclassified',
  'strategic',
  'potential',
  'developing'
);

create type public.crm_relationship_level as enum (
  'new',
  'developing',
  'active',
  'recurring',
  'inactive'
);

create type public.crm_opportunity_status as enum ('open', 'won', 'lost', 'on_hold');
create type public.crm_task_status as enum ('open', 'in_progress', 'completed', 'canceled');
create type public.crm_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.crm_activity_kind as enum (
  'phone_call',
  'email',
  'meeting',
  'showroom_visit',
  'site_visit',
  'stage_change',
  'status_change',
  'task_update',
  'other'
);
create type public.crm_proposal_status as enum (
  'draft',
  'in_review',
  'ready',
  'presented',
  'accepted',
  'rejected',
  'expired',
  'withdrawn'
);
create type public.crm_contract_status as enum (
  'not_started',
  'drafting',
  'sent',
  'signed',
  'canceled'
);
create type public.crm_production_status as enum (
  'not_started',
  'technical_review',
  'client_approval',
  'production_ready',
  'in_production',
  'completed',
  'on_hold'
);
create type public.crm_shipment_status as enum (
  'not_started',
  'booking',
  'in_transit',
  'customs_hold',
  'customs_cleared',
  'delivered'
);
create type public.crm_installation_status as enum (
  'not_scheduled',
  'scheduled',
  'in_progress',
  'completed',
  'on_hold'
);
create type public.crm_punch_status as enum ('open', 'in_progress', 'resolved', 'deferred');
create type public.crm_warranty_status as enum ('open', 'triage', 'in_progress', 'waiting', 'completed', 'closed');

create table public.crm_workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  market text not null,
  timezone text not null default 'America/Chicago',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  role public.crm_app_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  phone text,
  email text,
  city text,
  state text,
  postal_code text,
  source text,
  customer_type text,
  classification public.crm_lead_classification not null default 'unreviewed',
  stage text not null default 'New Lead',
  owner_id uuid references public.profiles(id) on delete set null,
  preferred_contact text,
  estimated_value_usd numeric(14,2) check (estimated_value_usd is null or estimated_value_usd >= 0),
  property_status text,
  professional_name text,
  has_floor_plan boolean,
  investment_profile text,
  decision_due_on date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  company_name text,
  partner_type text not null,
  phone text,
  email text,
  city text,
  state text,
  service_area text,
  classification public.crm_partner_classification not null default 'unclassified',
  relationship_level public.crm_relationship_level not null default 'new',
  stage text not null default 'Identified',
  owner_id uuid references public.profiles(id) on delete set null,
  source text,
  first_visit_on date,
  client_profile text,
  project_profile text,
  preferred_styles text[] not null default '{}',
  preferred_spaces text[] not null default '{}',
  current_suppliers text,
  valued_differentials text,
  objections text,
  mentioned_projects text,
  interest_tags text[] not null default '{}',
  created_by uuid not null references public.profiles(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete restrict,
  referring_partner_id uuid references public.partners(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  stage text not null default 'Qualified',
  status public.crm_opportunity_status not null default 'open',
  owner_id uuid references public.profiles(id) on delete set null,
  estimated_value_usd numeric(14,2) check (estimated_value_usd is null or estimated_value_usd >= 0),
  probability_percent smallint check (probability_percent is null or probability_percent between 0 and 100),
  target_close_on date,
  lost_reason text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'lost' and lost_reason is not null) or status <> 'lost')
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  opportunity_id uuid not null unique references public.opportunities(id) on delete restrict,
  project_code text,
  name text not null check (length(trim(name)) > 0),
  stage text not null default 'Deposit Received',
  project_manager_id uuid references public.profiles(id) on delete set null,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  target_completion_on date,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, project_code)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  kind public.crm_activity_kind not null,
  subject text not null check (length(trim(subject)) > 0),
  details text,
  outcome text,
  occurred_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (num_nonnulls(lead_id, partner_id, opportunity_id, project_id) = 1)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(lead_id, partner_id, opportunity_id, project_id) = 1)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  details text,
  due_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  priority public.crm_priority not null default 'normal',
  status public.crm_task_status not null default 'open',
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(lead_id, partner_id, opportunity_id, project_id) = 1),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create table public.project_rooms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  room_type text,
  specification_status text,
  notes text,
  sort_order integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  bucket_name text not null default 'marel-crm-files',
  object_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  category text,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (num_nonnulls(lead_id, partner_id, opportunity_id, project_id) = 1)
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  status public.crm_proposal_status not null default 'draft',
  amount_usd numeric(14,2) check (amount_usd is null or amount_usd >= 0),
  issued_at timestamptz,
  presented_at timestamptz,
  accepted_at timestamptz,
  expires_on date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, revision)
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  proposal_id uuid references public.proposals(id) on delete set null,
  status public.crm_contract_status not null default 'not_started',
  sent_at timestamptz,
  signed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_tracking (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  status public.crm_production_status not null default 'not_started',
  external_reference text,
  technical_review_at timestamptz,
  client_approved_at timestamptz,
  production_released_at timestamptz,
  production_completed_at timestamptz,
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  status public.crm_shipment_status not null default 'not_started',
  reference text,
  carrier text,
  departed_at timestamptz,
  customs_cleared_at timestamptz,
  delivered_at timestamptz,
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.installations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  status public.crm_installation_status not null default 'not_scheduled',
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end_at is null or scheduled_start_at is null or scheduled_end_at >= scheduled_start_at)
);

create table public.punch_list_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  installation_id uuid references public.installations(id) on delete set null,
  room_id uuid references public.project_rooms(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  details text,
  priority public.crm_priority not null default 'normal',
  status public.crm_punch_status not null default 'open',
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.warranty_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  room_id uuid references public.project_rooms(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  details text,
  category text,
  priority public.crm_priority not null default 'normal',
  status public.crm_warranty_status not null default 'open',
  owner_id uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.status_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  proposal_id uuid references public.proposals(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete cascade,
  production_tracking_id uuid references public.production_tracking(id) on delete cascade,
  shipment_id uuid references public.shipments(id) on delete cascade,
  installation_id uuid references public.installations(id) on delete cascade,
  punch_list_item_id uuid references public.punch_list_items(id) on delete cascade,
  warranty_case_id uuid references public.warranty_cases(id) on delete cascade,
  area text not null,
  from_status text,
  to_status text not null,
  reason text,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default now(),
  check (num_nonnulls(lead_id, partner_id, opportunity_id, project_id, proposal_id, contract_id, production_tracking_id, shipment_id, installation_id, punch_list_item_id, warranty_case_id) = 1)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.crm_workspaces(id) on delete restrict,
  entity_table text not null,
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_id uuid references public.profiles(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);

create table public.crm_settings (
  workspace_id uuid primary key references public.crm_workspaces(id) on delete cascade,
  lead_sources jsonb not null default '[]'::jsonb check (jsonb_typeof(lead_sources) = 'array'),
  lost_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(lost_reasons) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'crm_workspaces', 'profiles', 'leads', 'partners', 'opportunities', 'projects',
    'notes', 'tasks', 'project_rooms', 'proposals', 'contracts',
    'production_tracking', 'shipments', 'installations', 'punch_list_items',
    'warranty_cases', 'crm_settings'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      'set_' || target_table || '_updated_at',
      target_table
    );
  end loop;
end;
$$;

create index leads_workspace_stage_idx on public.leads (workspace_id, stage) where archived_at is null;
create index leads_workspace_owner_idx on public.leads (workspace_id, owner_id) where archived_at is null;
create index leads_search_idx on public.leads using gin (to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(city, '')));
create index partners_workspace_stage_idx on public.partners (workspace_id, stage) where archived_at is null;
create index partners_workspace_owner_idx on public.partners (workspace_id, owner_id) where archived_at is null;
create index partners_search_idx on public.partners using gin (to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(company_name, '') || ' ' || coalesce(city, '')));
create index opportunities_workspace_stage_idx on public.opportunities (workspace_id, stage, status) where archived_at is null;
create index opportunities_owner_idx on public.opportunities (workspace_id, owner_id) where archived_at is null;
create index projects_workspace_stage_idx on public.projects (workspace_id, stage) where archived_at is null;
create index activities_entity_time_idx on public.activities (workspace_id, occurred_at desc);
create index tasks_assignee_due_idx on public.tasks (workspace_id, assigned_to, due_at) where status in ('open', 'in_progress');
create index tasks_entity_idx on public.tasks (lead_id, partner_id, opportunity_id, project_id);
create index notes_entity_idx on public.notes (lead_id, partner_id, opportunity_id, project_id);
create index documents_entity_idx on public.documents (lead_id, partner_id, opportunity_id, project_id);
create index status_history_workspace_time_idx on public.status_history (workspace_id, changed_at desc);
create index audit_events_workspace_time_idx on public.audit_events (workspace_id, occurred_at desc);

comment on schema private is 'Internal helper functions that are not exposed through the Data API.';
comment on table public.audit_events is 'Immutable trigger-generated audit history. Direct client writes are prohibited by RLS.';
comment on table public.status_history is 'Append-only business stage and status changes.';
comment on table public.documents is 'Metadata only. File bytes belong in the private marel-crm-files Storage bucket.';

commit;
