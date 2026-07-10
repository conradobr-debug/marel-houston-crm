begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(37);

-- Test-only second workspace and member. Everything in this file is rolled back.
insert into public.crm_workspaces (id, slug, name, market, timezone)
values (
  '10000000-0000-4000-8000-000000000002',
  'synthetic-test-workspace',
  'Synthetic Test Workspace',
  'Test Market',
  'America/Chicago'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '20000000-0000-4000-8000-000000000099',
  'authenticated',
  'authenticated',
  'isolated.user@example.test',
  extensions.crypt('SyntheticTestOnly!2026', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Isolated Test User","workspace_slug":"synthetic-test-workspace"}'::jsonb,
  now(),
  now()
);

insert into public.leads (
  id, workspace_id, first_name, last_name, classification, stage, owner_id, created_by
)
values (
  '30000000-0000-4000-8000-000000000099',
  '10000000-0000-4000-8000-000000000002',
  'Synthetic',
  'Isolation',
  'unreviewed',
  'New Lead',
  '20000000-0000-4000-8000-000000000099',
  '20000000-0000-4000-8000-000000000099'
);

-- Anonymous access is denied at the grant layer.
set local role anon;
select throws_ok(
  $$select * from public.leads limit 1$$,
  '42501',
  'permission denied for table leads',
  'anonymous users cannot read leads'
);
reset role;

-- An authenticated JWT without an active profile sees no workspace data.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000098', true);
select is(
  (select count(*) from public.leads),
  0::bigint,
  'authenticated users without active membership cannot read leads'
);
select is(
  private.current_workspace_id(),
  null::uuid,
  'authenticated users without active membership have no current workspace'
);
reset role;

-- Workspace isolation applies in both directions.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select is(
  (select count(*) from public.leads where id = '30000000-0000-4000-8000-000000000099'),
  0::bigint,
  'Marel workspace members cannot read another workspace lead'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000099', true);
select is(
  (select count(*) from public.leads where workspace_id = '10000000-0000-4000-8000-000000000002'),
  1::bigint,
  'second workspace member can read its workspace lead'
);
select is(
  (select count(*) from public.leads where workspace_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'second workspace member cannot read Marel workspace leads'
);
reset role;

-- Admin has full workspace CRUD access.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$
    insert into public.leads (
      id, workspace_id, first_name, last_name, owner_id, created_by
    ) values (
      '31000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'Admin', 'Synthetic',
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001'
    )
  $$,
  'admin can create a lead in the active workspace'
);
select lives_ok(
  $$delete from public.leads where id = '31000000-0000-4000-8000-000000000001'$$,
  'admin can delete a lead in the active workspace'
);
reset role;

-- Sales managers can create and manage sales records, but cannot delete them.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$
    insert into public.partners (
      id, workspace_id, first_name, last_name, partner_type, owner_id, created_by
    ) values (
      '41000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'Manager', 'Synthetic', 'Designer',
      '20000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000002'
    )
  $$,
  'sales manager can create a partner'
);
select lives_ok(
  $$update public.leads set classification = 'warm' where id = '30000000-0000-4000-8000-000000000002'$$,
  'sales manager can update a workspace lead'
);
select is_empty(
  $$
    delete from public.leads
    where id = '30000000-0000-4000-8000-000000000002'
    returning id
  $$,
  'sales manager cannot delete a lead'
);
reset role;

-- Sales users can write owned records only.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
select lives_ok(
  $$
    insert into public.leads (
      id, workspace_id, first_name, last_name, owner_id, created_by
    ) values (
      '31000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001',
      'Sales', 'Synthetic',
      '20000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000003'
    )
  $$,
  'sales user can create an owned lead'
);
select throws_ok(
  $$
    insert into public.leads (
      id, workspace_id, first_name, last_name, owner_id, created_by
    ) values (
      '31000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000001',
      'Wrong', 'Owner',
      '20000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "leads"',
  'sales user cannot create a lead owned by another user'
);
select lives_ok(
  $$update public.leads set classification = 'hot' where id = '30000000-0000-4000-8000-000000000002'$$,
  'sales user can update an owned lead'
);
select is_empty(
  $$
    update public.leads
    set classification = 'cold'
    where id = '30000000-0000-4000-8000-000000000003'
    returning id
  $$,
  'sales user cannot update another owner lead'
);
reset role;

-- Project managers can manage project workflow, but not sales records.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000004', true);
select lives_ok(
  $$
    insert into public.shipments (
      id, workspace_id, project_id, status, reference, owner_id, created_by
    ) values (
      '86000000-0000-4000-8000-000000000099',
      '10000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'booking', 'SYNTHETIC-TEST',
      '20000000-0000-4000-8000-000000000004',
      '20000000-0000-4000-8000-000000000004'
    )
  $$,
  'project manager can create project workflow records'
);
select lives_ok(
  $$update public.production_tracking set status = 'on_hold' where id = '85000000-0000-4000-8000-000000000001'$$,
  'project manager can update project workflow status'
);
select is_empty(
  $$
    update public.leads
    set classification = 'cold'
    where id = '30000000-0000-4000-8000-000000000001'
    returning id
  $$,
  'project manager cannot update sales records'
);
reset role;

-- Viewer is read-only.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000005', true);
select ok(
  (select count(*) from public.leads) > 0,
  'viewer can read workspace records'
);
select throws_ok(
  $$
    insert into public.leads (
      id, workspace_id, first_name, last_name, owner_id, created_by
    ) values (
      '31000000-0000-4000-8000-000000000005',
      '10000000-0000-4000-8000-000000000001',
      'Viewer', 'Synthetic', null,
      '20000000-0000-4000-8000-000000000005'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "leads"',
  'viewer cannot create records'
);
select is_empty(
  $$
    update public.leads
    set classification = 'cold'
    where id = '30000000-0000-4000-8000-000000000001'
    returning id
  $$,
  'viewer cannot update records'
);
reset role;

-- Storage objects must stay in the current workspace path and require metadata to read.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
select lives_ok(
  $$
    insert into public.documents (
      id, workspace_id, lead_id, bucket_name, object_path, file_name, uploaded_by
    ) values (
      '84000000-0000-4000-8000-000000000099',
      '10000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      'marel-crm-files',
      '10000000-0000-4000-8000-000000000001/tests/safe.pdf',
      'safe.pdf',
      '20000000-0000-4000-8000-000000000003'
    );
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'marel-crm-files',
      '10000000-0000-4000-8000-000000000001/tests/safe.pdf',
      '20000000-0000-4000-8000-000000000003'
    )
  $$,
  'staff can create metadata and an object in the current workspace path'
);
select is(
  (select count(*) from storage.objects where name = '10000000-0000-4000-8000-000000000001/tests/safe.pdf'),
  1::bigint,
  'workspace member can read a storage object with authorized metadata'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'marel-crm-files',
      '10000000-0000-4000-8000-000000000002/tests/wrong-workspace.pdf',
      '20000000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'storage insert rejects a different workspace path'
);

-- Client photos use a separate private bucket with ownership-aware paths.
select lives_ok(
  $$
    update public.leads
    set client_photo_path = '10000000-0000-4000-8000-000000000001/leads/30000000-0000-4000-8000-000000000002/photo.webp',
        client_photo_mime_type = 'image/webp',
        client_photo_size_bytes = 1024
    where id = '30000000-0000-4000-8000-000000000002'
  $$,
  'sales user can attach photo metadata to an owned lead'
);
select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'marel-client-photos',
      '10000000-0000-4000-8000-000000000001/leads/30000000-0000-4000-8000-000000000002/photo.webp',
      '20000000-0000-4000-8000-000000000003'
    )
  $$,
  'sales user can upload a client photo for an owned lead'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'marel-client-photos'),
  1::bigint,
  'authorized workspace member can read linked private client photos'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'marel-client-photos',
      '10000000-0000-4000-8000-000000000002/leads/30000000-0000-4000-8000-000000000002/photo.webp',
      '20000000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'client photo upload rejects another workspace path'
);
select is_empty(
  $$
    update public.leads
    set client_photo_path = '10000000-0000-4000-8000-000000000001/leads/30000000-0000-4000-8000-000000000003/photo.webp'
    where id = '30000000-0000-4000-8000-000000000003'
    returning id
  $$,
  'sales user cannot attach photo metadata to another owner lead'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000005', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'marel-client-photos'),
  1::bigint,
  'viewer can read a linked client photo'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'marel-client-photos',
      '10000000-0000-4000-8000-000000000001/leads/30000000-0000-4000-8000-000000000001/photo.webp',
      '20000000-0000-4000-8000-000000000005'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'viewer cannot upload a client photo'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000099', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'marel-client-photos'),
  0::bigint,
  'other workspace member cannot read Marel client photos'
);
reset role;

-- Status and audit triggers retain actor and transition context.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$
    update public.leads
    set client_photo_path = '10000000-0000-4000-8000-000000000001/leads/30000000-0000-4000-8000-000000000001/photo.jpg',
        client_photo_mime_type = 'image/jpeg',
        client_photo_size_bytes = 2048
    where id = '30000000-0000-4000-8000-000000000001';
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'marel-client-photos',
      '10000000-0000-4000-8000-000000000001/leads/30000000-0000-4000-8000-000000000001/photo.jpg',
      '20000000-0000-4000-8000-000000000002'
    )
  $$,
  'sales manager can upload a client photo for a workspace lead'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select is(
  private.can_manage_lead_photo_path('10000000-0000-4000-8000-000000000001/leads/30000000-0000-4000-8000-000000000001/photo.jpg'),
  true,
  'admin is authorized to remove a workspace client photo through the Storage API'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
select lives_ok(
  $$update public.leads set stage = 'Proposal Presented' where id = '30000000-0000-4000-8000-000000000002'$$,
  'sales user can change the stage of an owned lead'
);
select is(
  (
    select count(*)
    from public.status_history
    where lead_id = '30000000-0000-4000-8000-000000000002'
      and area = 'lead_pipeline'
      and to_status = 'Proposal Presented'
      and changed_by = '20000000-0000-4000-8000-000000000003'
  ),
  1::bigint,
  'stage changes create attributed status history'
);
select is(
  (
    select count(*)
    from public.audit_events
    where entity_table = 'leads'
      and entity_id = '30000000-0000-4000-8000-000000000002'
      and action = 'update'
      and actor_id = '20000000-0000-4000-8000-000000000003'
      and after_data ->> 'stage' = 'Proposal Presented'
  ),
  1::bigint,
  'record changes create attributed audit events'
);
reset role;

select * from finish();
rollback;
