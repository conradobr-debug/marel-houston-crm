# Phase 1 limitations

This repository now contains a local database and RLS foundation. It is not production-ready yet.

## Deliberately excluded

- No real Supabase project or remote connection
- No production credentials
- No frontend queries against the normalized schema
- No migration of legacy `crm_records` data
- No Criare data, configuration, integrations, or history
- No real Marel client data
- No WhatsApp functionality
- No Outlook or calendar integration
- No email automation
- No automated lead intake or webhooks

## Current technical limitations

- A successful `supabase db reset` has not yet been executed on this machine because the Supabase CLI and a container runtime are not installed.
- The frontend still expects the legacy monolithic table names.
- Automated SQL and RLS tests are not included in Phase 1.
- Role assignments are seeded only for local development.
- Status vocabularies require business approval before production.
- The project assumes one active Marel Houston workspace.
- Cross-workspace foreign-key consistency is currently enforced by RLS and the single-workspace model, not by composite foreign keys.
- File metadata and Storage policies exist, but no frontend upload flow is connected.
- Hard deletion remains technically available to `admin`; production retention and archival rules are pending.
- Legal contact, privacy retention, production region, hosting, backups, monitoring, and recovery objectives are pending.

## Safe offline behavior

If Supabase is not configured, the frontend remains a read-only offline template. Phase 1 does not add local CRM persistence, offline mutation queues, or cached client data.

