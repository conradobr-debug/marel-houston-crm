# Marel Houston CRM go-live checklist

Use this checklist right before launch.

## Configuration

- `config/runtime-config.js` exists locally and is not committed
- `environment` is set to `production`
- Production Supabase URL is correct
- Production publishable key is correct
- `workspaceId` matches the Marel workspace
- `publicUrl` matches the deployed CRM URL
- `SUPABASE_SERVICE_ROLE_KEY` is not present in frontend code or runtime config

## Supabase

- All migrations are applied in order
- Seed data is synthetic only
- RLS is enabled on exposed tables
- Anonymous access is blocked
- Authenticated access is limited to active Marel workspace users
- Storage is private or intentionally not used for MVP uploads
- pgTAP validation passed

## Authentication and profiles

- `contact@marelhouston.com` can sign in as Conrado
- `wilson@marelhouston.com` can sign in as Wilson
- `fabiola@marelhouston.com` can sign in as Fabiola
- Each user loads the correct profile row and workspace id
- Temporary passwords are changed after first login when used

## Frontend behavior

- Leads load from the normalized repository layer
- Partners load from the normalized repository layer
- Opportunities load from the normalized repository layer
- Notes and next actions persist
- Search and filters work
- Role guardrails work for viewer, sales_user, sales_manager, project_manager, and admin
- Missing production config shows a clear error instead of a silent fallback
- Service & Tasks stays labeled as coming soon unless fully implemented

## Calendar workflow

- Shared iCloud Calendar exists
- Conrado, Wilson, and Fabiola are invited
- Next actions are entered manually in the calendar when needed
- The CRM remains the source of truth for CRM follow-up dates

## Deployment

- Static hosting points at the correct CRM build
- GitHub Pages is configured for the `main` branch root folder
- The published site URL is `https://conradobr-debug.github.io/marel-houston-crm/`
- The repo includes a browser-safe `config/runtime-config.js` for the live site
- Browser cache has been refreshed after the latest release
- The app loads over HTTPS in production
- Smoke tests passed from the deployed URL
- Rollback instructions are documented
