# GAME ON MAIL database

This folder contains the application schema and a local-only PostgreSQL service. Better Auth owns the core identity, password credential, session and verification tables. The application schema stores GAME ON mailbox ownership, roles, domains, aliases and other product metadata.

## Data ownership

- Better Auth tables: users, password credentials, sessions, email verification and password-reset tokens, and database-backed rate limits.
- GAME ON application tables: platform profile projection, roles, mail domains, mailboxes, memberships, addresses, invitations, contacts, delivery metadata and audit records.
- Mail server: message bodies, headers, mailbox folders, indexes, attachments and SMTP delivery queue.

The user profile projection stores Better Auth's user ID. Password hashes are not duplicated in the GAME ON application tables.

## Local setup

Requires Docker Engine and the Docker Compose plugin.

1. Copy `.env.example` to `.env`.
2. Replace `GAMEON_DB_PASSWORD` with a long random password used only for local development.
3. In `web/.env.local`, set `DATABASE_URL` to the same database username, password, host and database name used below.
4. Start PostgreSQL from this folder:

```bash
docker compose --env-file .env -f compose.yaml up -d
docker compose --env-file .env -f compose.yaml ps
```

5. From `game-on-mail/web`, install dependencies and apply the Better Auth schema:

```bash
npm install
npm run auth:migrate
```

6. From `game-on-mail/database`, apply the GAME ON application schema after Better Auth has created its core user table:

```bash
docker compose --env-file .env -f compose.yaml exec -T postgres \
  psql -U gameon_mail_dev -d gameon_mail -v ON_ERROR_STOP=1 \
  < migrations/0001_initial_schema.sql
```

7. Run the schema smoke test:

```bash
docker compose --env-file .env -f compose.yaml exec -T postgres \
  psql -U gameon_mail_dev -d gameon_mail -v ON_ERROR_STOP=1 \
  < tests/0001_smoke.sql
```

The smoke test inserts synthetic data, checks that primary and alias addresses share one uniqueness constraint, and rolls all test rows back.

## Reset local development data

To stop the service but keep the database:

```bash
docker compose --env-file .env -f compose.yaml down
```

To permanently delete the local development database volume and all data in it:

```bash
docker compose --env-file .env -f compose.yaml down -v
```

Do not run the destructive command if you need the data. After a reset, repeat both Better Auth and GAME ON schema migrations.

## Safety

- Port 5432 is bound to 127.0.0.1 only; it is not exposed to other devices or the public internet.
- The Compose user is a local development superuser for convenience. Production must use separate migration-owner and least-privilege runtime database roles.
- Never commit `.env`, `.env.local`, database passwords, production connection strings or backups.
- The GAME ON migration references the Better Auth user table, so run Better Auth migrations first.
- Public sign-up is disabled in production. Local sign-up is enabled only by explicit development configuration.
- Verification and password-reset links are printed only by the local development server; production must have a real GAME ON mail transport before these workflows are enabled for users.
- The schema is an initial draft and must pass the CI migration and smoke tests before production use.
