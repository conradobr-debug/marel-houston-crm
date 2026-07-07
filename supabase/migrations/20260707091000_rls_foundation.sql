begin;

create or replace function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  join public.crm_workspaces w on w.id = p.workspace_id
  where p.id = (select auth.uid())
    and p.is_active
    and w.is_active
  limit 1;
$$;

create or replace function private.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.workspace_id
  from public.profiles p
  join public.crm_workspaces w on w.id = p.workspace_id
  where p.id = (select auth.uid())
    and p.is_active
    and w.is_active
  limit 1;
$$;

create or replace function private.current_role()
returns public.crm_app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  join public.crm_workspaces w on w.id = p.workspace_id
  where p.id = (select auth.uid())
    and p.is_active
    and w.is_active
  limit 1;
$$;

create or replace function private.is_active_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.crm_workspaces w on w.id = p.workspace_id
    where p.id = (select auth.uid())
      and p.workspace_id = target_workspace_id
      and p.is_active
      and w.is_active
  );
$$;

create or replace function private.has_any_role(allowed_roles public.crm_app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.crm_workspaces w on w.id = p.workspace_id
    where p.id = (select auth.uid())
      and p.role = any(allowed_roles)
      and p.is_active
      and w.is_active
  );
$$;

revoke all on function private.current_profile_id() from public, anon;
revoke all on function private.current_workspace_id() from public, anon;
revoke all on function private.current_role() from public, anon;
revoke all on function private.is_active_workspace_member(uuid) from public, anon;
revoke all on function private.has_any_role(public.crm_app_role[]) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.current_profile_id() to authenticated;
grant execute on function private.current_workspace_id() to authenticated;
grant execute on function private.current_role() to authenticated;
grant execute on function private.is_active_workspace_member(uuid) to authenticated;
grant execute on function private.has_any_role(public.crm_app_role[]) to authenticated;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  target_display_name text;
begin
  select w.id
    into target_workspace_id
  from public.crm_workspaces w
  where w.slug = coalesce(new.raw_user_meta_data ->> 'workspace_slug', 'marel-houston')
    and w.is_active
  limit 1;

  if target_workspace_id is null then
    raise exception 'No active CRM workspace is available for this user';
  end if;

  target_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Marel User'
  );

  insert into public.profiles (id, workspace_id, display_name, role, is_active)
  values (new.id, target_workspace_id, target_display_name, 'viewer', true)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function private.write_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_before jsonb;
  row_after jsonb;
  target_workspace_id uuid;
  target_entity_id uuid;
begin
  row_before := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  row_after := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  target_workspace_id := coalesce((row_after ->> 'workspace_id')::uuid, (row_before ->> 'workspace_id')::uuid);
  target_entity_id := coalesce(
    (row_after ->> 'id')::uuid,
    (row_before ->> 'id')::uuid,
    (row_after ->> 'workspace_id')::uuid,
    (row_before ->> 'workspace_id')::uuid
  );

  insert into public.audit_events (
    workspace_id,
    entity_table,
    entity_id,
    action,
    actor_id,
    before_data,
    after_data
  )
  values (
    target_workspace_id,
    tg_table_name,
    target_entity_id,
    lower(tg_op),
    (select auth.uid()),
    row_before,
    row_after
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.write_audit_event() from public, anon, authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'profiles', 'leads', 'partners', 'opportunities', 'projects', 'activities',
    'notes', 'tasks', 'project_rooms', 'documents', 'proposals', 'contracts',
    'production_tracking', 'shipments', 'installations', 'punch_list_items',
    'warranty_cases', 'crm_settings'
  ]
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.write_audit_event()',
      'audit_' || target_table,
      target_table
    );
  end loop;
end;
$$;

create or replace function private.capture_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_state text;
  new_state text;
  state_area text;
  actor uuid;
begin
  if tg_table_name in ('leads', 'partners', 'opportunities', 'projects') then
    old_state := to_jsonb(old) ->> 'stage';
    new_state := to_jsonb(new) ->> 'stage';
  else
    old_state := to_jsonb(old) ->> 'status';
    new_state := to_jsonb(new) ->> 'status';
  end if;

  if old_state is not distinct from new_state then
    return new;
  end if;

  state_area := case tg_table_name
    when 'leads' then 'lead_pipeline'
    when 'partners' then 'partner_pipeline'
    when 'opportunities' then 'opportunity_pipeline'
    when 'projects' then 'project_delivery'
    when 'proposals' then 'proposal'
    when 'contracts' then 'contract'
    when 'production_tracking' then 'production'
    when 'shipments' then 'shipment'
    when 'installations' then 'installation'
    when 'punch_list_items' then 'punch_list'
    when 'warranty_cases' then 'warranty'
  end;

  actor := coalesce(
    (select auth.uid()),
    (to_jsonb(new) ->> 'created_by')::uuid,
    (to_jsonb(old) ->> 'created_by')::uuid
  );

  insert into public.status_history (
    workspace_id,
    lead_id,
    partner_id,
    opportunity_id,
    project_id,
    proposal_id,
    contract_id,
    production_tracking_id,
    shipment_id,
    installation_id,
    punch_list_item_id,
    warranty_case_id,
    area,
    from_status,
    to_status,
    changed_by
  )
  values (
    new.workspace_id,
    case when tg_table_name = 'leads' then new.id end,
    case when tg_table_name = 'partners' then new.id end,
    case when tg_table_name = 'opportunities' then new.id end,
    case when tg_table_name = 'projects' then new.id end,
    case when tg_table_name = 'proposals' then new.id end,
    case when tg_table_name = 'contracts' then new.id end,
    case when tg_table_name = 'production_tracking' then new.id end,
    case when tg_table_name = 'shipments' then new.id end,
    case when tg_table_name = 'installations' then new.id end,
    case when tg_table_name = 'punch_list_items' then new.id end,
    case when tg_table_name = 'warranty_cases' then new.id end,
    state_area,
    old_state,
    new_state,
    actor
  );

  return new;
end;
$$;

revoke all on function private.capture_status_change() from public, anon, authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'leads', 'partners', 'opportunities', 'projects', 'proposals', 'contracts',
    'production_tracking', 'shipments', 'installations', 'punch_list_items',
    'warranty_cases'
  ]
  loop
    execute format(
      'create trigger %I after update on public.%I for each row execute function private.capture_status_change()',
      'history_' || target_table,
      target_table
    );
  end loop;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'crm_workspaces', 'profiles', 'leads', 'partners', 'opportunities', 'projects',
    'activities', 'notes', 'tasks', 'project_rooms', 'documents', 'proposals',
    'contracts', 'production_tracking', 'shipments', 'installations',
    'punch_list_items', 'warranty_cases', 'status_history', 'audit_events',
    'crm_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', target_table);
    execute format('revoke all on table public.%I from anon', target_table);
  end loop;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy workspace_member_select
on public.crm_workspaces
for select
to authenticated
using (private.is_active_workspace_member(id));

create policy workspace_admin_update
on public.crm_workspaces
for update
to authenticated
using (
  private.is_active_workspace_member(id)
  and private.has_any_role(array['admin'::public.crm_app_role])
)
with check (
  private.is_active_workspace_member(id)
  and private.has_any_role(array['admin'::public.crm_app_role])
);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'profiles', 'leads', 'partners', 'opportunities', 'projects', 'activities',
    'notes', 'tasks', 'project_rooms', 'documents', 'proposals', 'contracts',
    'production_tracking', 'shipments', 'installations', 'punch_list_items',
    'warranty_cases', 'status_history', 'audit_events', 'crm_settings'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.is_active_workspace_member(workspace_id))',
      target_table || '_active_member_select',
      target_table
    );
  end loop;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'profiles', 'leads', 'partners', 'opportunities', 'projects', 'notes', 'tasks',
    'project_rooms', 'documents', 'proposals', 'contracts', 'production_tracking',
    'shipments', 'installations', 'punch_list_items', 'warranty_cases', 'crm_settings'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.is_active_workspace_member(workspace_id) and private.has_any_role(array[''admin''::public.crm_app_role])) with check (private.is_active_workspace_member(workspace_id) and private.has_any_role(array[''admin''::public.crm_app_role]))',
      target_table || '_admin_all',
      target_table
    );
  end loop;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['leads', 'partners', 'opportunities', 'proposals', 'contracts']
  loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.is_active_workspace_member(workspace_id) and private.has_any_role(array[''sales_manager''::public.crm_app_role]) and created_by = (select auth.uid()))',
      target_table || '_sales_manager_insert',
      target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.is_active_workspace_member(workspace_id) and private.has_any_role(array[''sales_manager''::public.crm_app_role])) with check (private.is_active_workspace_member(workspace_id) and private.has_any_role(array[''sales_manager''::public.crm_app_role]))',
      target_table || '_sales_manager_update',
      target_table
    );
  end loop;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['leads', 'partners', 'opportunities']
  loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.is_active_workspace_member(workspace_id) and private.has_any_role(array[''sales_user''::public.crm_app_role]) and created_by = (select auth.uid()) and (owner_id is null or owner_id = (select auth.uid())))',
      target_table || '_sales_user_insert',
      target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.is_active_workspace_member(workspace_id) and private.has_any_role(array[''sales_user''::public.crm_app_role]) and (owner_id = (select auth.uid()) or created_by = (select auth.uid()))) with check (private.is_active_workspace_member(workspace_id) and (owner_id is null or owner_id = (select auth.uid())))',
      target_table || '_sales_user_update',
      target_table
    );
  end loop;
end;
$$;

create policy projects_sales_manager_insert
on public.projects
for insert
to authenticated
with check (
  private.is_active_workspace_member(workspace_id)
  and private.has_any_role(array['sales_manager'::public.crm_app_role])
  and created_by = (select auth.uid())
);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'projects', 'project_rooms', 'production_tracking', 'shipments',
    'installations', 'punch_list_items', 'warranty_cases'
  ]
  loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.is_active_workspace_member(workspace_id) and private.has_any_role(array[''project_manager''::public.crm_app_role]) and created_by = (select auth.uid()))',
      target_table || '_project_manager_insert',
      target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.is_active_workspace_member(workspace_id) and private.has_any_role(array[''project_manager''::public.crm_app_role])) with check (private.is_active_workspace_member(workspace_id) and private.has_any_role(array[''project_manager''::public.crm_app_role]))',
      target_table || '_project_manager_update',
      target_table
    );
  end loop;
end;
$$;

create policy activities_staff_insert
on public.activities
for insert
to authenticated
with check (
  private.is_active_workspace_member(workspace_id)
  and private.has_any_role(array[
    'admin'::public.crm_app_role,
    'sales_manager'::public.crm_app_role,
    'sales_user'::public.crm_app_role,
    'project_manager'::public.crm_app_role
  ])
  and created_by = (select auth.uid())
);

create policy notes_staff_insert
on public.notes
for insert
to authenticated
with check (
  private.is_active_workspace_member(workspace_id)
  and private.has_any_role(array[
    'sales_manager'::public.crm_app_role,
    'sales_user'::public.crm_app_role,
    'project_manager'::public.crm_app_role
  ])
  and created_by = (select auth.uid())
);

create policy notes_author_or_manager_update
on public.notes
for update
to authenticated
using (
  private.is_active_workspace_member(workspace_id)
  and (
    created_by = (select auth.uid())
    or private.has_any_role(array['sales_manager'::public.crm_app_role, 'project_manager'::public.crm_app_role])
  )
)
with check (private.is_active_workspace_member(workspace_id));

create policy tasks_staff_insert
on public.tasks
for insert
to authenticated
with check (
  private.is_active_workspace_member(workspace_id)
  and private.has_any_role(array[
    'sales_manager'::public.crm_app_role,
    'sales_user'::public.crm_app_role,
    'project_manager'::public.crm_app_role
  ])
  and created_by = (select auth.uid())
);

create policy tasks_assignee_author_or_manager_update
on public.tasks
for update
to authenticated
using (
  private.is_active_workspace_member(workspace_id)
  and (
    assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
    or private.has_any_role(array['sales_manager'::public.crm_app_role, 'project_manager'::public.crm_app_role])
  )
)
with check (private.is_active_workspace_member(workspace_id));

create policy documents_staff_insert
on public.documents
for insert
to authenticated
with check (
  private.is_active_workspace_member(workspace_id)
  and private.has_any_role(array[
    'sales_manager'::public.crm_app_role,
    'sales_user'::public.crm_app_role,
    'project_manager'::public.crm_app_role
  ])
  and uploaded_by = (select auth.uid())
  and bucket_name = 'marel-crm-files'
);

insert into storage.buckets (id, name, public, file_size_limit)
values ('marel-crm-files', 'marel-crm-files', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create policy marel_files_authenticated_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'marel-crm-files'
  and private.current_workspace_id() is not null
  and (storage.foldername(name))[1] = private.current_workspace_id()::text
  and private.has_any_role(array[
    'admin'::public.crm_app_role,
    'sales_manager'::public.crm_app_role,
    'sales_user'::public.crm_app_role,
    'project_manager'::public.crm_app_role
  ])
);

create policy marel_files_authorized_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'marel-crm-files'
  and exists (
    select 1
    from public.documents d
    where d.bucket_name = bucket_id
      and d.object_path = name
      and private.is_active_workspace_member(d.workspace_id)
  )
);

create policy marel_files_manager_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'marel-crm-files'
  and private.has_any_role(array['admin'::public.crm_app_role, 'project_manager'::public.crm_app_role])
  and (storage.foldername(name))[1] = private.current_workspace_id()::text
);

alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.partners;
alter publication supabase_realtime add table public.opportunities;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.production_tracking;
alter publication supabase_realtime add table public.shipments;
alter publication supabase_realtime add table public.installations;
alter publication supabase_realtime add table public.punch_list_items;
alter publication supabase_realtime add table public.warranty_cases;

comment on function private.current_profile_id() is 'Returns the active authenticated Marel CRM profile id.';
comment on function private.current_workspace_id() is 'Returns the active authenticated Marel CRM workspace id.';
comment on function private.current_role() is 'Returns the active authenticated Marel CRM application role.';
comment on function private.has_any_role(public.crm_app_role[]) is 'Checks the current active profile against one or more application roles.';

commit;
