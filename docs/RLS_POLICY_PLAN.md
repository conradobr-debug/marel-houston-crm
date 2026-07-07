# RLS policy foundation

## Security boundary

- Every public CRM table has Row Level Security enabled.
- `anon` has no table grants or policies.
- Access requires an authenticated, active profile in an active Marel workspace.
- A user can access rows only when `workspace_id` matches the profile workspace.
- The browser must use only the Supabase publishable key.
- The service-role key bypasses RLS and must never appear in frontend code, static hosting variables, browser logs, or `config/runtime-config.js`.

## Helper functions

The private schema contains security-definer functions with an empty search path:

- `private.current_profile_id()`
- `private.current_workspace_id()`
- `private.current_role()`
- `private.is_active_workspace_member(uuid)`
- `private.has_any_role(crm_app_role[])`

The `private` schema is not exposed through the Data API. Authenticated users receive execute permission only for the listed authorization helpers.

## Role matrix

| Capability | admin | sales_manager | sales_user | project_manager | viewer |
|---|---:|---:|---:|---:|---:|
| Read workspace CRM data | Yes | Yes | Yes | Yes | Yes |
| Manage profiles and settings | Yes | No | No | No | No |
| Create/update all sales records | Yes | Yes | Owned records | No | No |
| Create project at sales handoff | Yes | Yes | No | Yes | No |
| Manage project-delivery workflow | Yes | No | No | Yes | No |
| Add activities, notes, tasks, files | Yes | Yes | Yes | Yes | No |
| Hard delete business rows | Yes | No | No | No | No |
| Change audit or status history | No direct writes | No | No | No | No |

## Append-only records

- `audit_events` is written by database triggers for inserts, updates, and deletes.
- `status_history` is written by database triggers when pipeline or workflow status changes.
- Activities can be inserted by operational roles but are not editable through initial client policies.

## Storage

The local migration creates a private `marel-crm-files` bucket.

- Objects must use the path prefix `<workspace_id>/...`.
- Upload is limited to authenticated operational roles.
- Read access requires matching metadata in `public.documents` and workspace membership.
- Delete access is initially limited to `admin` and `project_manager`.
- No bucket is public.

## Required Phase 2 tests

RLS tests must impersonate `anon` and each authenticated role. Tests must cover `SELECT`, `INSERT`, `UPDATE`, and `DELETE` against every table, ownership changes, inactive users, cross-workspace identifiers, audit immutability, and Storage access.

