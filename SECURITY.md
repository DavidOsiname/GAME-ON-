# Security policy — Game ON

Game ON Store and Game ON Creator are separate applications sharing a backend. Security reports must be handled privately; do not publish exploit details, credentials, personal data or malicious files in public issues.

## Reporting

Until a monitored security contact is officially established, report suspected vulnerabilities to the project owner through a private channel. Include the affected application, endpoint or component, impact, and safe reproduction steps. Do not test against real player accounts or production payment systems without explicit authorisation.

## Secret handling

- Never commit `.env`, `.env.local`, Supabase secret/service-role keys, Paystack secret keys, scanner webhook secrets, or real customer data.
- Browser bundles may contain only the Supabase project URL and publishable key. Supabase secret/service-role keys and Paystack secret keys belong only in server-side secrets.
- Prefer Supabase `sb_publishable_...` and `sb_secret_...` keys. The existing environment variable names are retained for compatibility; the secret value must remain server-only.
- Use Paystack test keys in staging. Do not run real charges or refunds during development.
- Rotate any credential that may have been exposed, then inspect deployment logs and provider audit history.

## Release security requirements

- Apply all database migrations to a staging project and run the pgTAP security tests.
- Verify RLS, SQL grants and RPC execute privileges with anon, authenticated and service roles.
- Keep game builds in private quarantine storage until a trusted scanner marks the file clean and an authorised Game ON reviewer approves it.
- Use short-lived signed upload/download URLs; never expose the storage bucket publicly.
- Verify payment webhooks from the raw request body and verify transactions server-to-server before granting library entitlements.
- Review rate limits, abuse monitoring, backups, refund reconciliation and incident response before public launch.
