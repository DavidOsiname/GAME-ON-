# Game ON

**Game ON is a two-app game marketplace:** a separate player-facing Store and a separate developer-facing Creator portal, sharing one Supabase backend.

> Current source package: **MVP 0.9.10**. This repository contains source code and deployment configuration; it is not a live, production-hosted marketplace.

## The two applications

| Application | Audience | Main capabilities |
|---|---|---|
| **Game ON Store** | Players | Browse published games, view listings, create a player account, manage a library and wishlist, review games, receive notifications, view purchase history, request refunds and download approved builds they own. |
| **Game ON Creator** | Developers and Game ON moderators | Create a developer account and studio, submit and edit game listings, upload builds into private quarantine, track scan/release status, view studio analytics and sales summaries, and access authorised moderation queues. |

These are independent Next.js applications and separate deployable images. They are not a single application with a role switch:

- Store runs on port **3000** locally.
- Creator runs on port **3001** locally.
- Both use the same Supabase project for authentication and marketplace data.

## Architecture

- **apps/store/** — player marketplace and server-side commerce/download routes.
- **apps/creator/** — developer portal, moderation console and private build-upload APIs.
- **supabase/migrations/** — ordered database migrations, row-level security policies, private build storage and commerce functions.
- **supabase/tests/** — pgTAP database security tests.
- **services/build-scanner/** — separate private worker that streams quarantined builds to ClamAV and reports scan results to Creator.
- **deploy/** and **docker-compose.yml** — separate Store and Creator production images, a Caddy HTTPS reverse proxy and self-host deployment configuration.

## Local development

Requirements: Node.js 22.12 or newer (below 25), npm 10 or newer, and Docker Engine with Compose v2 for the local Supabase stack.

Install the exact workspace dependency tree:

    npm ci

Start the local Supabase stack and apply the migrations:

    supabase start
    supabase db reset
    supabase test db

Use the local Supabase URL and publishable/anon key in each app's .env.local. The server-only SUPABASE_SERVICE_ROLE_KEY must also be configured for secure server routes. Copy the example files as a starting point:

    cp apps/store/.env.example apps/store/.env.local
    cp apps/creator/.env.example apps/creator/.env.local

Replace the placeholders with values from your local Supabase instance. In Creator, set NEXT_PUBLIC_STORE_URL=http://localhost:3000 and configure GAMEON_ADMIN_USER_IDS with the Auth UUID of each authorised moderator. Never commit .env.local files or put a server secret in a NEXT_PUBLIC_ variable.

Run each application in a separate terminal from the repository root:

    npm run dev:store
    npm run dev:creator

Open Store at http://localhost:3000 and Creator at http://localhost:3001.

## Verification commands

    npm test
    npm run typecheck
    npm run build
    supabase db reset
    supabase test db

- npm test runs the source, migration, commerce-safety, scanner, payment configuration, refund-event, webhook-body, readiness and deployment-configuration checks.
- npm run typecheck checks both TypeScript workspaces.
- npm run build produces the production Next.js build for both apps.
- supabase test db runs the database security suite against the local Supabase stack.

GitHub Actions runs these checks using the committed root package-lock.json. It also builds the separate production Docker images for Store, Creator and the private scanner.

## Android release builds

See [the Android release runbook](deploy/ANDROID-RELEASE-RUNBOOK.md) for the adult-owner EAS project setup, production environment variables, remote signing credentials, protected GitHub release workflow, and APK/AAB verification.

## Self-hosted staging

Start with [the deployment guide](deploy/README.md). It explains how to configure two hostnames, a Supabase project, the two app environment files, Docker Compose and Caddy HTTPS. The malware scanner has its own [private deployment guide](services/build-scanner/README.md).

Before staging can be deployed, an operator must provide:

1. A dedicated Supabase staging project, with the reviewed migrations applied.
2. A Linux host with Docker Engine/Compose v2 and enough memory for the apps and ClamAV scanner.
3. Two DNS hostnames pointing to that host: one for Store and one for Creator.
4. Server-side Supabase secrets and a strong scanner callback secret, stored only in private environment files or secrets management.

The deployment scripts do not create a Supabase account, rent a server, register domains or configure DNS. Do not paste service-role keys, Paystack secrets or scanner secrets into GitHub source files or chat.

## Payment and release boundaries

- Marketplace payments are **disabled by default**. Keep them disabled during initial staging.
- Use a Paystack test environment only after the staging backend and webhook flow are configured and verified.
- Live payments require provider onboarding, commercial/legal approval and explicit operator approval.
- Developer payout transfers are **not implemented**. Sales/earnings figures are not a payable wallet balance.
- A clean malware scan is not enough to publish a build: Game ON release moderation must also approve it.
- Do not distribute builds until storage privacy, account permissions, abuse reporting, refunds, monitoring, backup/recovery and manual end-to-end tests have been reviewed.

## Project status

The CI workflow checks dependency installation, migrations, pgTAP database tests, automated source/safety checks, both TypeScript workspaces, both production Next.js builds and the deployment container images.

A green CI run proves that the checked-in source passes the automated checks in GitHub's test environment. It does **not** mean that a staging or production service is deployed, that Paystack has been activated, or that the product is ready for public release.
