begin;

alter table public.leads
  add column client_photo_path text,
  add column client_photo_mime_type text check (client_photo_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  add column client_photo_size_bytes bigint check (client_photo_size_bytes is null or client_photo_size_bytes > 0);

comment on column public.leads.client_photo_path is 'Private marel-client-photos Storage object path. No image bytes are stored in Postgres.';

create or replace function private.can_manage_lead_photo_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[];
  target_lead_id uuid;
begin
  parts := storage.foldername(object_name);
  if coalesce(array_length(parts, 1), 0) <> 3
     or parts[1] <> (select private.current_workspace_id())::text
     or parts[2] <> 'leads'
     or storage.filename(object_name) !~ '^photo\.(jpg|png|webp)$' then
    return false;
  end if;

  begin
    target_lead_id := parts[3]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return exists (
    select 1
    from public.leads l
    where l.id = target_lead_id
      and l.workspace_id = (select private.current_workspace_id())
      and (
        private.has_any_role(array['admin'::public.crm_app_role, 'sales_manager'::public.crm_app_role])
        or (
          private.has_any_role(array['sales_user'::public.crm_app_role])
          and (l.owner_id = (select auth.uid()) or l.created_by = (select auth.uid()))
        )
      )
  );
end;
$$;

create or replace function private.can_view_lead_photo_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.leads l
    where l.workspace_id = (select private.current_workspace_id())
      and l.client_photo_path = object_name
  );
end;
$$;

revoke all on function private.can_manage_lead_photo_path(text) from public, anon;
revoke all on function private.can_view_lead_photo_path(text) from public, anon;
grant execute on function private.can_manage_lead_photo_path(text) to authenticated;
grant execute on function private.can_view_lead_photo_path(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marel-client-photos',
  'marel-client-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy marel_client_photos_authorized_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'marel-client-photos'
  and (
    private.can_view_lead_photo_path(name)
    or private.can_manage_lead_photo_path(name)
  )
);

create policy marel_client_photos_authorized_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'marel-client-photos'
  and private.can_manage_lead_photo_path(name)
);

create policy marel_client_photos_authorized_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'marel-client-photos'
  and private.can_manage_lead_photo_path(name)
)
with check (
  bucket_id = 'marel-client-photos'
  and private.can_manage_lead_photo_path(name)
);

create policy marel_client_photos_authorized_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'marel-client-photos'
  and private.can_manage_lead_photo_path(name)
);

comment on function private.can_manage_lead_photo_path(text) is 'Restricts private lead-photo Storage writes to the active workspace and authorized lead owner/manager.';
comment on function private.can_view_lead_photo_path(text) is 'Restricts private lead-photo Storage reads to active workspace records with matching metadata.';

commit;
