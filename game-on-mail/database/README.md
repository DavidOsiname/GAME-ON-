# GAME ON MAIL database

This folder contains the initial PostgreSQL schema and a local-only Docker Compose service.

## Why PostgreSQL?

PostgreSQL stores GAME ON MAIL application data: user identities, password hashes, roles, mailbox addresses and memberships, aliases, invitations, preferences, contacts, delivery-event metadata and security audit metadata.

The mail server remains the source of truth for message bodies, mailbox folders and attachments. The application database must not become a second copy of every private email.

## Local setup

Requires Docker Engine and the Docker Compose plugin.

1. Copy `.env.example` to `.env`.
2. Replace `GAMEON_DB_PASSWORD` with a long random password used only for local development.
3. Start the database:

```bash
docker compose --env-file .env -f compose.yaml up -d
```

4. Check that it is healthy:

```bash
docker compose --env-file .env -f compose.yaml ps
```

5. Connect with psql:

```bash
docker compose --env-file .env -f compose.yaml exec postgres \
  psql -U gameon_mail_dev -d gameon_mail
```

The first migration is mounted into the official PostgreSQL initialization directory and runs automatically when the database volume is initialized for the first time.

## Reset local development data

To stop the service but keep the database:

```bash
docker compose --env-file .env -f compose.yaml down
```

To permanently delete the local development database volume and all data in it:

```bash
docker compose --env-file .env -f compose.yaml down -v
```

Do not run the destructive command if you need the data.

## Safety

- Port 5432 is bound to 127.0.0.1 only; it is not exposed to other devices or the public internet.
- The Compose user is a local development superuser for convenience. Production must use separate migration-owner and least-privilege runtime database roles.
- Never commit `.env`, database passwords, production connection strings or backups.
- The migration stores no email body, attachment bytes, SMTP password or DKIM private key.
- The SQL is a first schema draft and must be reviewed and tested against a fresh PostgreSQL instance before any production use.

## Current schema

See `migrations/0001_initial_schema.sql`.
