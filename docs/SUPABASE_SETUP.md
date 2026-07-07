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
```

`supabase db reset` applies the migrations in order and then runs `supabase/seed.sql`.

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

