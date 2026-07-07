# Frontend data access

Phase 3 keeps the static vanilla JavaScript PWA and adds a compatibility layer between the existing UI record shape and the normalized local Supabase schema.

## Data-access structure

- `js/data/crm-mappers.js` maps normalized rows to and from the existing card and form shape.
- `js/data/supabase-crm-repository.js` owns local Supabase Auth, table queries, writes, activities, settings, and realtime subscriptions.
- `js/data/mock-crm-repository.js` provides synthetic browser-local fallback records and basic CRUD.
- `js/data/crm-repository-contract.js` defines and validates the shared repository interface and core CRUD contract.
- `js/data/crm-data-service.js` selects the local Supabase repository or the mock fallback.

UI code should call `window.MarelCRMData.service`. Do not add Supabase queries to `index.html` or `partners.js` for supported Phase 3 flows.

## Run with local Supabase

From the CRM directory:

```sh
export PATH="$HOME/.orbstack/bin:/opt/homebrew/opt/libpq/bin:$PATH"
supabase start
supabase db reset
supabase status -o env
```

Copy the ignored runtime configuration:

```sh
cp config/runtime-config.example.js config/runtime-config.js
```

Set these browser-safe values in `config/runtime-config.js`:

- `supabaseUrl`: the local `API_URL`, normally `http://127.0.0.1:54321`;
- `supabasePublishableKey`: the local `PUBLISHABLE_KEY`;
- `workspaceId`: `10000000-0000-4000-8000-000000000001`;
- `publicUrl`: the local preview URL.

Only `127.0.0.1` and `localhost` Supabase URLs are accepted by the Phase 3 frontend. A hosted Supabase URL intentionally falls back to mock mode.

Never put the service-role key, database password, access token, JWT secret, or any hosted-project credential in frontend configuration.

Start the static preview:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

Open `http://127.0.0.1:8766` and sign in with a synthetic user listed in `docs/SUPABASE_SETUP.md`.

## Mock fallback

Leave `supabaseUrl` and `supabasePublishableKey` empty to force mock mode. If the configured local Supabase endpoint cannot be reached before a session is established, the service switches to mock mode automatically.

Mock records are synthetic and stored only in browser `localStorage` under `marel_crm_mock_repository_v1`. They are not synchronized to Supabase. The fallback supports loading, search, filters, basic create/edit, stage changes, and settings.

## Supported normalized flows

- profiles and CRM settings;
- leads and professional partners;
- opportunities represented as active lead-compatible cards;
- projects represented as closed/project-compatible cards;
- notes and the earliest open next-action task;
- basic create and edit operations;
- opportunity, project, lead, and partner stage changes;
- normalized activity and status history reads;
- realtime refresh for the supported normalized tables.

## Deferred modules

The obsolete persistence paths for combined CRM records, weekly snapshots, calendar integration, JSON restore, and service-item tables were removed in Phase 4A.

The following compatibility surfaces remain intentionally:

- the Service & Tasks navigation tab is a stable placeholder with no persistence or mutation controls;
- JSON export remains available as a browser-local emergency snapshot, but restore is not supported;
- partner cadence, content suggestions, and content-library UI structures remain for visual continuity, while content-library persistence stays unavailable;
- the mock repository retains synthetic mapped records and browser-local storage for offline operation.

## Role-aware UI guardrails

RLS remains authoritative. The frontend additionally hides or disables controls that the current role should not use:

| Role | UI mutation controls |
|---|---|
| `admin` | Full supported CRUD, stage changes, project conversion, deletion, and settings |
| `sales_manager` | Create and edit sales/partner records, activities, stage changes, won/lost; no deletion or project editing |
| `sales_user` | Create sales/partner records and mutate owned/created sales records only; no deletion or project conversion |
| `project_manager` | Project workflow stage changes and project activities where compatible; no sales-record editing |
| `viewer` | Read-only cards, details, search, filters, reports, and settings visibility |

Cards without an allowed action do not display a mutation menu. Read-only detail forms disable fields and hide save and quick-action buttons.

## Repository contract validation

With local Supabase and the static preview running, open:

```text
http://127.0.0.1:8766/scripts/repository-contract-validation.html
```

Enter the synthetic local admin password and select **Run validation**. The page:

- verifies that mock and Supabase repositories expose the same methods;
- loads profiles and mapped records;
- exercises search/filter behavior;
- creates and edits a synthetic lead and partner;
- verifies note and next-action task round trips;
- changes a stage;
- deletes the temporary synthetic records.

The run reports `PASS` only when both repositories satisfy the same contract. It never accepts a hosted Supabase URL.

## Smoke validation

With the preview running:

```sh
python3 scripts/validate-phase3.py --url http://127.0.0.1:8766
```

The script uses only the Python standard library. It verifies script order, service-worker caching, normalized repository coverage, absence of obsolete persistence tokens in active UI code, absence of remote Supabase URLs, and availability of preview assets.
