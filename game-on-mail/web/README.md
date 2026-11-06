# GAME ON MAIL — Web application

The web application is a responsive Next.js interface backed by Better Auth and PostgreSQL. It currently contains a synthetic demo inbox plus the first account-management flows.

## Requirements

- Node.js 26 LTS (the project requires Node.js 22.11 or newer)
- npm
- Docker Engine and Docker Compose plugin for the local PostgreSQL database

## Environment

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` to the same local PostgreSQL credentials as `database/.env`.
3. Replace `BETTER_AUTH_SECRET` with a random value of at least 32 characters.
4. Keep `MAIL_DELIVERY_ENABLED=false`.
5. Keep `NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP=true` only for local development. Production sign-up is forcibly disabled by the server configuration.

## Start the local database and migrate

Follow `../database/README.md` to start PostgreSQL. Apply Better Auth's schema first, then the GAME ON application schema. The application migration references Better Auth's user table.

When running the Better Auth CLI, export `DATABASE_URL` in the same shell, or prefix the command with it:

```bash
DATABASE_URL="postgresql://gameon_mail_dev:YOUR_LOCAL_PASSWORD@127.0.0.1:5432/gameon_mail" npm run auth:migrate
```

Then apply `../database/migrations/0001_initial_schema.sql` using the command in the database README.

## Run the application

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Account routes

- `/sign-up`: local-development registration; disabled in production.
- `/sign-in`: secure email/password sign-in.
- `/account`: protected account page.
- `/forgot-password` and `/reset-password`: recovery interface. Recovery is deliberately unavailable until a working GAME ON mail transport is added.

The verification callback prints a short-lived verification URL only in the local server terminal. Never expose those logs publicly or copy their contents into issue trackers. Production never logs verification or password-reset tokens.

## Checks

```bash
npm run auth:migrate
npm run typecheck
npm run build
```

Health endpoint: http://localhost:3000/api/health

## Safety boundary

- The inbox still contains synthetic demo messages.
- No real GAME ON mailbox has been provisioned yet.
- Compose drafts are kept in browser memory only.
- Sending is disabled.
- Public sign-up is disabled in production.
- Do not enter real personal information into the preview.
- Never commit `.env.local`, passwords, API keys, mail credentials or private keys.

## Next milestones

1. Finish account integration and migration tests.
2. Add secure invitation and administrator provisioning.
3. Complete a local-only mail-server proof of concept.
4. Connect mailbox reading and sending through server-side IMAP and SMTP adapters.
