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

The frontend compatibility adapter reads the normalized schema while preserving the existing card and form interface. Leads, partners, opportunities, projects, profiles, settings, notes, tasks, activities, and stage changes pass through the centralized data-access layer. A synthetic browser-local fallback remains available for local and development use only.

Phase 4A removes executable legacy persistence paths, adds role-aware UI guardrails aligned with RLS, and provides a shared contract validation for the mock and Supabase repositories.

## Production MVP

The production cutover keeps the UI intact while allowing a real Marel Supabase project to be configured through `config/runtime-config.js`.

- `environment: "production"` enables hosted Supabase values.
- If production configuration is missing, the app stops in a safe blocked state instead of silently switching to mock mode.
- `config/runtime-config.js` must never contain service-role credentials.
- For GitHub Pages, the browser-safe production `config/runtime-config.js` is committed so the static site can boot without any server-side injection.
- `service_role` must never be used in frontend code.

See:

- [`docs/PRODUCTION_SETUP.md`](docs/PRODUCTION_SETUP.md)
- [`docs/GO_LIVE_CHECKLIST.md`](docs/GO_LIVE_CHECKLIST.md)
- [`docs/MVP_LIMITATIONS.md`](docs/MVP_LIMITATIONS.md)

## GitHub Pages deployment

This repository can be published as a static site from the `main` branch root folder.

- Recommended repository name: `marel-houston-crm`
- Recommended Pages URL: `https://conradobr-debug.github.io/marel-houston-crm/`
- GitHub Pages should load the browser-safe `config/runtime-config.js` file from the repo
- That runtime file may include only browser-safe values:
  - Marel Supabase URL
  - Marel publishable key
  - Marel workspace id
  - final public URL

RLS remains the security boundary. The publishable key is safe to ship in the browser only because the Supabase policies already restrict access to the Marel workspace.

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
