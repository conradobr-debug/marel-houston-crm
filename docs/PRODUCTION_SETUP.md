# Marel Houston CRM production setup

This document covers the safest manual cutover for a real Marel Supabase project.

## Scope

- One separate Marel Supabase project
- Real Supabase Auth users for Conrado, Wilson, and Fabiola
- Production profile loading and role checks
- Manual shared iCloud Calendar workflow
- No WhatsApp, Outlook, Google Calendar, CalDAV, or lead-intake automations

## Before you start

- Keep the Criare CRM untouched.
- Use only Marel Supabase credentials.
- Do not place any service-role key in frontend files.
- Keep `config/runtime-config.js` out of version control.

## Manual Supabase project steps

1. Create or open the Marel Supabase project.
2. Apply the repository migrations in order.
3. Run the local pgTAP suite against the local validation database before any hosted cutover.
4. Confirm Row Level Security is enabled on every exposed CRM table.
5. Confirm the private storage bucket is present or intentionally disabled for the MVP.
6. Configure the hosted project Auth settings:
   - disable public sign-ups;
   - keep email confirmation on;
   - allow only invited or manually created users.
7. Confirm the application runtime config uses the production Supabase URL and publishable key only.

## Manual user creation

Create these users in Supabase Auth:

| Person | Email | Recommended final role |
|---|---|---|
| Conrado | `contact@marelhouston.com` | `admin` |
| Wilson | `wilson@marelhouston.com` | `sales_manager` |
| Fabiola | `fabiola@marelhouston.com` | `sales_user` |

Safest manual flow:

1. Use Supabase Auth invite or manual user creation.
2. Assign a temporary password only if invite flow is not available.
3. Require the user to change the password on first login.
4. Create or verify the matching `profiles` row for each user.
5. Set the correct `workspace_id`, `role`, and `is_active = true`.

Use the smallest possible privilege set:

- Conrado: `admin`
- Wilson: `sales_manager` unless direct admin access is truly needed
- Fabiola: `sales_user` unless workflow ownership proves she must manage all sales records

## Browser runtime configuration

Create `config/runtime-config.js` from `config/runtime-config.example.js` and set:

- `environment: "production"`
- `supabaseUrl`: the hosted Marel Supabase URL
- `supabasePublishableKey`: the hosted anon/publishable key
- `workspaceId`: the Marel workspace UUID
- `publicUrl`: the deployed CRM URL

Never place the service-role key, database password, or access token in this file.

## Shared iCloud Calendar workflow

The MVP uses the CRM as the source of truth for `next_action` and `next_action_date`.

Manual workflow:

1. Create a shared iCloud Calendar named `Marel Houston CRM`.
2. Invite Conrado, Wilson, and Fabiola.
3. Use the calendar for showroom visits, consultations, follow-ups, and project meetings.
4. Add events manually from CRM next actions.
5. Keep the CRM database authoritative for pipeline and follow-up state.

Phase 6 can evaluate calendar sync later if the business still wants it.

## Production smoke validation

Before go-live, confirm:

- login works for the three approved users;
- profile and role load before any write action;
- lead, partner, opportunity, note, and next-action edits persist;
- viewer access stays read-only;
- sales-user ownership checks work;
- the app shows a clear warning if production config is missing;
- no Criare data or credentials were introduced.
