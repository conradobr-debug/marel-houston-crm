# Local Supabase setup

This phase is local-only. Do not run `supabase link`, `supabase db push`, or configure a remote project.

## Prerequisites

- Supabase CLI
- A Docker-compatible local container runtime
- At least 7 GB of memory available for the local Supabase services

## Start the local environment

From `04_apps/marel-crm/`:

```sh
supabase start
supabase db reset
supabase status
supabase test db supabase/tests/database --local
```

`supabase db reset` applies the migrations in order and then runs `supabase/seed.sql`.

The database test command runs the pgTAP RLS suite against the local database. The suite opens a transaction, creates temporary synthetic isolation records, tests each application role, and rolls everything back. Run it after every migration or policy change.

If OrbStack stalls while the Supabase CLI starts its containerized `pg_prove` runner, restart OrbStack without resetting its data and run the same suite directly against the local database:

```sh
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -X -v ON_ERROR_STOP=1 \
  -f supabase/tests/database/rls_policies.test.sql
```

A passing run reports `ok 1` through `ok 37`, no `not ok` lines, and finishes with `ROLLBACK`. The URL and password above are Supabase's standard local-development defaults only; do not reuse them for a hosted project.

## Start the Phase 3 frontend

After the database reset, configure the ignored browser runtime file and start the static preview as described in [`FRONTEND_DATA_ACCESS.md`](FRONTEND_DATA_ACCESS.md). The frontend accepts local Supabase endpoints only and automatically uses synthetic mock data when local Supabase is not configured.

The local configuration deliberately disables public, email, and anonymous sign-up. Synthetic users are inserted by the local seed after the Marel workspace exists.

## Synthetic local users

All seeded users use the local-only password `MarelLocalOnly!2026`.

| Role | Local email |
|---|---|
| Admin | `admin@marel-houston.local` |
| Sales manager | `sales.manager@marel-houston.local` |
| Sales user | `sales.user@marel-houston.local` |
| Project manager | `project.manager@marel-houston.local` |
| Viewer | `viewer@marel-houston.local` |

These identities exist only for local development. They must never be copied to staging or production.

## Local database contents

The seed creates:

- one Marel Houston workspace;
- five synthetic role accounts;
- fictional leads and professional partners;
- fictional open and won opportunities;
- fictional proposal, contract, production, shipment, installation, punch-list, and warranty examples.

No Criare information and no real Marel client information is permitted.

## Reset and troubleshooting

Use `supabase db reset` whenever migrations or seed data change. A successful reset is the authoritative local SQL validation.

If the CLI version generates a different PostgreSQL major version than `supabase/config.toml`, update the local configuration in a dedicated review before starting the stack.

The frontend is not connected to this schema in Phase 1. The existing application remains in safe offline-template mode.

## Client photos

Migration `20260710090000_client_photos.sql` creates the private `marel-client-photos` bucket and lead metadata columns. Client-photo objects use:

```
<workspace_id>/leads/<lead_id>/photo.webp
```

Modern browsers resize and compress supported uploads to WebP. A browser without WebP canvas export retains the validated JPG or PNG extension. The bucket remains private in every case; the app requests short-lived signed URLs after RLS authorizes the record.

Only JPG, PNG, and WebP files up to 5 MB may enter Storage. Do not upload a photo unless the Marel team has the right to use it. The application does not collect images from social networks, perform facial recognition, or process biometric data.
