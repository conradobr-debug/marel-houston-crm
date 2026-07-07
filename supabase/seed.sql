begin;

-- Synthetic local-development data only.
-- None of the names, companies, addresses, emails, or projects below represent real clients.

insert into public.crm_workspaces (id, slug, name, market, timezone)
values (
  '10000000-0000-4000-8000-000000000001',
  'marel-houston',
  'Marel Houston',
  'Houston, Texas',
  'America/Chicago'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'admin@marel-houston.local',
    extensions.crypt('MarelLocalOnly!2026', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Alex Admin","workspace_slug":"marel-houston"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'sales.manager@marel-houston.local',
    extensions.crypt('MarelLocalOnly!2026', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Morgan Manager","workspace_slug":"marel-houston"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'sales.user@marel-houston.local',
    extensions.crypt('MarelLocalOnly!2026', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Jamie Sales","workspace_slug":"marel-houston"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'project.manager@marel-houston.local',
    extensions.crypt('MarelLocalOnly!2026', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Casey Projects","workspace_slug":"marel-houston"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000005',
    'authenticated',
    'authenticated',
    'viewer@marel-houston.local',
    extensions.crypt('MarelLocalOnly!2026', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Riley Viewer","workspace_slug":"marel-houston"}'::jsonb,
    now(), now(), '', '', '', ''
  );

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  ('21000000-0000-4000-8000-' || lpad(row_number() over (order by id)::text, 12, '0'))::uuid,
  id::text,
  id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  now(),
  now(),
  now()
from auth.users
where id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005'
);

update public.profiles
set role = case id
  when '20000000-0000-4000-8000-000000000001' then 'admin'::public.crm_app_role
  when '20000000-0000-4000-8000-000000000002' then 'sales_manager'::public.crm_app_role
  when '20000000-0000-4000-8000-000000000003' then 'sales_user'::public.crm_app_role
  when '20000000-0000-4000-8000-000000000004' then 'project_manager'::public.crm_app_role
  else 'viewer'::public.crm_app_role
end
where id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005'
);

insert into public.crm_settings (workspace_id, lead_sources, lost_reasons)
values (
  '10000000-0000-4000-8000-000000000001',
  '["Website Form","Google Ads","Showroom Visit","Referral","Architect Introduction","Interior Designer Introduction","Builder / Contractor Referral","Event / Networking","Phone","Email","Other"]'::jsonb,
  '["Price","Timeline","Competitor","No response","Changed plans","Budget not available","Other"]'::jsonb
);

insert into public.leads (
  id, workspace_id, first_name, last_name, phone, email, city, state, source,
  customer_type, classification, stage, owner_id, preferred_contact,
  estimated_value_usd, property_status, has_floor_plan, investment_profile,
  decision_due_on, created_by
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Avery', 'Morgan', '+1 713-555-0101', 'avery.morgan@example.test',
    'Houston', 'TX', 'Showroom Visit', 'Homeowner', 'hot', 'Won',
    '20000000-0000-4000-8000-000000000003', 'Email', 185000,
    'Under renovation', true, 'Comprehensive', current_date - 45,
    '20000000-0000-4000-8000-000000000003'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'Cameron', 'Ellis', '+1 713-555-0102', 'cameron.ellis@example.test',
    'Houston', 'TX', 'Interior Designer Introduction', 'Designer-Referred Client',
    'warm', 'Design in Progress', '20000000-0000-4000-8000-000000000003',
    'Phone', 92000, 'Existing / Ready', true, 'Balanced', current_date + 21,
    '20000000-0000-4000-8000-000000000003'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'Rowan', 'Bennett', '+1 713-555-0103', 'rowan.bennett@example.test',
    'Bellaire', 'TX', 'Referral', 'Repeat Client', 'hot', 'Won',
    '20000000-0000-4000-8000-000000000002', 'Email', 210000,
    'Existing / Ready', true, 'Comprehensive', current_date - 180,
    '20000000-0000-4000-8000-000000000002'
  );

insert into public.partners (
  id, workspace_id, first_name, last_name, company_name, partner_type, phone,
  email, city, state, service_area, classification, relationship_level, stage,
  owner_id, source, first_visit_on, client_profile, project_profile,
  preferred_styles, preferred_spaces, interest_tags, created_by
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Jordan', 'Lee', 'Northline Studio', 'Architect', '+1 713-555-0201',
    'jordan.lee@northline.example.test', 'Houston', 'TX', 'Greater Houston',
    'strategic', 'active', 'Active Referral Partner',
    '20000000-0000-4000-8000-000000000002', 'Event / Networking',
    current_date - 120, 'High-end residential', 'Renovation and new construction',
    array['Contemporary', 'Warm minimalism'], array['Kitchens', 'Closets'],
    array['Natural wood', 'Technical solutions'],
    '20000000-0000-4000-8000-000000000002'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'Taylor', 'Brooks', 'Bayou Form Design', 'Interior Designer', '+1 713-555-0202',
    'taylor.brooks@bayouform.example.test', 'Houston', 'TX', 'Houston Inner Loop',
    'potential', 'developing', 'Relationship Development',
    '20000000-0000-4000-8000-000000000003', 'Interior Designer Introduction',
    current_date - 30, 'Design-focused homeowners', 'Kitchen and living spaces',
    array['Transitional', 'Contemporary'], array['Kitchens', 'Entertainment spaces'],
    array['Lighting', 'Lacquer'],
    '20000000-0000-4000-8000-000000000003'
  );

insert into public.opportunities (
  id, workspace_id, lead_id, referring_partner_id, title, stage, status, owner_id,
  estimated_value_usd, probability_percent, target_close_on, created_by
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'Westhaven Residence', 'Won', 'won',
    '20000000-0000-4000-8000-000000000003', 185000, 100,
    current_date - 60, '20000000-0000-4000-8000-000000000003'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    'Memorial View Kitchen', 'Design in Progress', 'open',
    '20000000-0000-4000-8000-000000000003', 92000, 60,
    current_date + 35, '20000000-0000-4000-8000-000000000003'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003', null,
    'Lakeside Residence', 'Won', 'won',
    '20000000-0000-4000-8000-000000000002', 210000, 100,
    current_date - 240, '20000000-0000-4000-8000-000000000002'
  );

insert into public.projects (
  id, workspace_id, opportunity_id, project_code, name, stage, project_manager_id,
  address_line_1, city, state, postal_code, target_completion_on, completed_at, created_by
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'MH-DEMO-001', 'Westhaven Residence', 'Punch List',
    '20000000-0000-4000-8000-000000000004',
    '101 Demo Lane', 'Houston', 'TX', '77001', current_date + 14, null,
    '20000000-0000-4000-8000-000000000004'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000003',
    'MH-DEMO-002', 'Lakeside Residence', 'Warranty / Aftercare',
    '20000000-0000-4000-8000-000000000004',
    '202 Sample Court', 'Bellaire', 'TX', '77401', current_date - 90, now() - interval '75 days',
    '20000000-0000-4000-8000-000000000004'
  );

insert into public.project_rooms (
  id, workspace_id, project_id, name, room_type, specification_status, notes,
  sort_order, created_by
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'Main Kitchen', 'Kitchen', 'Approved', 'Synthetic room record.', 1,
    '20000000-0000-4000-8000-000000000004'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'Primary Closet', 'Closet', 'Approved', 'Synthetic room record.', 2,
    '20000000-0000-4000-8000-000000000004'
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    'Library', 'Built-in', 'Completed', 'Synthetic aftercare example.', 1,
    '20000000-0000-4000-8000-000000000004'
  );

insert into public.activities (
  id, workspace_id, lead_id, partner_id, opportunity_id, project_id, kind,
  subject, details, outcome, occurred_at, created_by
)
values
  (
    '80000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002', null, null, null,
    'meeting', 'Design review', 'Reviewed the synthetic kitchen brief.',
    'Revisions requested', now() - interval '3 days',
    '20000000-0000-4000-8000-000000000003'
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    null, '40000000-0000-4000-8000-000000000002', null, null,
    'phone_call', 'Partner follow-up', 'Discussed a fictional upcoming project.',
    'Follow-up scheduled', now() - interval '2 days',
    '20000000-0000-4000-8000-000000000003'
  );

insert into public.notes (
  id, workspace_id, opportunity_id, body, created_by
)
values (
  '81000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  'Synthetic note: confirm the next design-review agenda before the meeting.',
  '20000000-0000-4000-8000-000000000003'
);

insert into public.tasks (
  id, workspace_id, lead_id, partner_id, opportunity_id, project_id, title,
  details, due_at, assigned_to, priority, status, created_by
)
values
  (
    '82000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    null, null, '50000000-0000-4000-8000-000000000002', null,
    'Schedule proposal review', 'Synthetic next action.', now() + interval '4 days',
    '20000000-0000-4000-8000-000000000003', 'high', 'open',
    '20000000-0000-4000-8000-000000000003'
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    null, '40000000-0000-4000-8000-000000000002', null, null,
    'Send showroom invitation', 'Synthetic partner next action.', now() + interval '7 days',
    '20000000-0000-4000-8000-000000000003', 'normal', 'open',
    '20000000-0000-4000-8000-000000000003'
  );

insert into public.proposals (
  id, workspace_id, opportunity_id, project_id, revision, status, amount_usd,
  issued_at, presented_at, accepted_at, created_by
)
values
  (
    '83000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    1, 'accepted', 185000, now() - interval '150 days',
    now() - interval '145 days', now() - interval '135 days',
    '20000000-0000-4000-8000-000000000002'
  ),
  (
    '83000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002', null,
    1, 'in_review', 92000, null, null, null,
    '20000000-0000-4000-8000-000000000003'
  );

insert into public.contracts (
  id, workspace_id, opportunity_id, project_id, proposal_id, status, sent_at,
  signed_at, created_by
)
values (
  '84000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  'signed', now() - interval '132 days', now() - interval '128 days',
  '20000000-0000-4000-8000-000000000002'
);

insert into public.production_tracking (
  id, workspace_id, project_id, status, external_reference, technical_review_at,
  client_approved_at, production_released_at, production_completed_at, owner_id, created_by
)
values
  (
    '85000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'completed', 'DEMO-PROD-001', now() - interval '120 days',
    now() - interval '110 days', now() - interval '105 days', now() - interval '45 days',
    '20000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004'
  ),
  (
    '85000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    'completed', 'DEMO-PROD-002', now() - interval '300 days',
    now() - interval '290 days', now() - interval '280 days', now() - interval '220 days',
    '20000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004'
  );

insert into public.shipments (
  id, workspace_id, project_id, status, reference, carrier, departed_at,
  customs_cleared_at, delivered_at, owner_id, created_by
)
values
  (
    '86000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'delivered', 'DEMO-SHIP-001', 'Synthetic Carrier', now() - interval '40 days',
    now() - interval '24 days', now() - interval '18 days',
    '20000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004'
  ),
  (
    '86000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    'delivered', 'DEMO-SHIP-002', 'Synthetic Carrier', now() - interval '210 days',
    now() - interval '195 days', now() - interval '185 days',
    '20000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004'
  );

insert into public.installations (
  id, workspace_id, project_id, status, scheduled_start_at, scheduled_end_at,
  started_at, completed_at, owner_id, created_by
)
values
  (
    '87000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'completed', now() - interval '14 days', now() - interval '10 days',
    now() - interval '14 days', now() - interval '10 days',
    '20000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004'
  ),
  (
    '87000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    'completed', now() - interval '170 days', now() - interval '165 days',
    now() - interval '170 days', now() - interval '165 days',
    '20000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004'
  );

insert into public.punch_list_items (
  id, workspace_id, project_id, installation_id, room_id, title, details,
  priority, status, assigned_to, due_at, created_by
)
values (
  '88000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '87000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  'Adjust demonstration cabinet door',
  'Synthetic punch-list item for local testing.',
  'normal', 'open', '20000000-0000-4000-8000-000000000004',
  now() + interval '5 days', '20000000-0000-4000-8000-000000000004'
);

insert into public.warranty_cases (
  id, workspace_id, project_id, room_id, title, details, category, priority,
  status, owner_id, opened_at, created_by
)
values (
  '89000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000003',
  'Review demonstration hardware alignment',
  'Synthetic warranty case for local aftercare testing.',
  'Adjustment', 'normal', 'triage',
  '20000000-0000-4000-8000-000000000004', now() - interval '2 days',
  '20000000-0000-4000-8000-000000000004'
);

insert into public.status_history (
  id, workspace_id, opportunity_id, area, from_status, to_status, reason,
  changed_by, changed_at
)
values (
  '90000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  'opportunity_pipeline', 'Discovery', 'Design in Progress',
  'Synthetic stage-history example.',
  '20000000-0000-4000-8000-000000000003', now() - interval '5 days'
);

commit;
