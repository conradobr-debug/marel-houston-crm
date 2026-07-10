# Shared Google Calendar setup

The CRM is the source of truth. This integration is one-way: CRM tasks and next actions can create, update, or delete matching events in the shared Google Calendar. Google Calendar edits never write back to the CRM.

## Google setup

1. Use a Marel-controlled Google account.
2. Create a calendar named `Marel Houston CRM` and share it with Conrado, Wilson, and Fabiola.
3. In Google Cloud, create a Marel-only project, enable **Google Calendar API**, configure the OAuth consent screen, and create a Web Application OAuth client.
4. Register the production callback URL for the Marel Supabase project: `https://ptlrdykvfrsetvxxhxdq.supabase.co/functions/v1/calendar-oauth-callback`.
5. Obtain a refresh token for the Marel-controlled calendar account through the approved OAuth flow. Never paste it into the CRM, GitHub, browser, or chat.

## Supabase Edge Function secrets

Set these only in Supabase Edge Function secrets:

```sh
supabase secrets set GOOGLE_CALENDAR_ID='...'
supabase secrets set GOOGLE_OAUTH_CLIENT_ID='...'
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET='...'
supabase secrets set GOOGLE_OAUTH_REFRESH_TOKEN='...'
```

`SUPABASE_SERVICE_ROLE_KEY` is supplied to Edge Functions by Supabase and must never be added to frontend configuration.

## Apple Calendar

Each user adds their Google account to Apple Calendar and enables the shared `Marel Houston CRM` calendar. No Apple ID or CalDAV credentials are stored by the CRM.

## Deployment

```sh
supabase db push
supabase functions deploy calendar-sync
```

Do not run `seed.sql` in production. Confirm a server-side calendar connection before selecting **Sync to calendar**.
