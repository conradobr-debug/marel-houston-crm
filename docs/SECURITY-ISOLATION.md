# Security and isolation

The Marel Houston CRM must never connect to Criare production resources.

## Prohibited

- Criare customer records, exports, backups, photos, or attachments
- Criare Supabase URL, keys, project references, or database connection strings
- Criare OAuth tokens, Microsoft credentials, Make webhooks, or webhook secrets
- Criare WhatsApp extensions, functions, migrations, message history, or AI prompts
- Criare Git history or deployment configuration

## Required checks before every deployment

1. Search the repository for Criare names, domains, project references, and Brazilian locale settings.
2. Confirm the configured Supabase project belongs only to Marel Houston.
3. Use synthetic US test data until production approval.
4. Verify that WhatsApp-specific code and data structures are absent.

