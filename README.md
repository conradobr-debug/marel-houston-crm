# Marel Houston CRM

Independent CRM shell for Marel Houston. This repository is intentionally isolated from the Criare Mogi Guacu production CRM.

## Safety status

- No Criare customer data is included.
- No Criare Supabase project, webhook, token, or secret is configured.
- WhatsApp-specific workflows are not part of the Marel product direction.
- Until a Marel Supabase project is configured, the application opens in safe offline-template mode.

## Local database and frontend foundation

The repository includes a local-only Supabase foundation under `supabase/`:

- normalized CRM tables for sales, partners, projects, delivery, installation, and aftercare;
- invite-only local Auth configuration;
- workspace-aware RLS policies for five application roles;
- immutable audit and status-history triggers;
- a private local file bucket;
- deterministic synthetic seed data.

No remote Supabase project is linked. Do not run `supabase link` or `supabase db push` during local development.

The Phase 3 frontend compatibility adapter reads the normalized local schema while preserving the existing card and form interface. Leads, partners, opportunities, projects, profiles, settings, notes, tasks, activities, and stage changes now pass through the centralized data-access layer. An explicitly synthetic browser-local fallback remains available when local Supabase is not configured or cannot be reached.

## Local Supabase setup

Install the Supabase CLI and a Docker-compatible local container runtime. Then run from this directory:

```sh
supabase start
supabase db reset
supabase status
```

See:

- [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md)
- [`docs/RLS_POLICY_PLAN.md`](docs/RLS_POLICY_PLAN.md)
- [`docs/MVP_LIMITATIONS.md`](docs/MVP_LIMITATIONS.md)
- [`docs/FRONTEND_DATA_ACCESS.md`](docs/FRONTEND_DATA_ACCESS.md)

The frontend accepts only local `127.0.0.1` or `localhost` Supabase endpoints during Phase 3.

## Local preview

Serve this directory with any static HTTP server and open `index.html`. See `docs/FRONTEND_DATA_ACCESS.md` for local runtime configuration and fallback behavior. Do not add production credentials to tracked files.
