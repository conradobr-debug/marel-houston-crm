# Phase 1 limitations

This repository now contains a local database, RLS foundation, and a production-cutover-safe frontend. It still has deliberate MVP limits.

## Deliberately excluded

- No real Supabase project or remote connection in this workspace
- No production credentials in tracked files
- No frontend queries against the normalized schema outside the approved repository layer
- No migration of legacy `crm_records` data
- No Criare data, configuration, integrations, or history
- No real Marel client data
- No WhatsApp functionality
- No Outlook, Apple/CalDAV, inbound, or two-way calendar integration
- No email automation
- No automated lead intake or webhooks

## Current technical limitations

- A successful `supabase db reset` has not yet been executed on this machine because the Supabase CLI and a container runtime are not installed.
- The Service & Tasks area is intentionally not a full production workflow yet.
- Shared Google Calendar sync is CRM-to-calendar only; inbound and two-way sync are deferred.
- Client photos are manual uploads only. The CRM does not collect photos from social profiles, perform facial recognition, or analyze biometric information.
- The client-photo bucket uses short-lived signed URLs. Users need an active session and a network connection to view uploaded photos.
- Future hosted Supabase deployment details, backups, monitoring, and recovery objectives still need final operational approval.
- Hard deletion remains technically available to `admin`; production retention and archival rules are pending.

## Safe offline behavior

If Supabase is not configured in a local or development environment, the frontend falls back to a synthetic browser-local repository.

If production configuration is missing, the frontend now stops in a safe blocked state instead of silently switching to mock mode.
