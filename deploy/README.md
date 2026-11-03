# Game ON self-hosted deployment (MVP 0.9.10)

This deployment keeps **Game ON Store** and **Game ON Creator** as two independent Next.js services and two separate containers. They share the same configured Supabase project, but are not merged into one application. The Compose stack binds to localhost by default so a host reverse proxy can terminate HTTPS.

## Requirements

- A Linux server or development computer with Docker Engine and Docker Compose v2.
- Node 22 is used inside both image builds.
- A configured Supabase project with the ten migrations in `supabase/migrations` applied and the Auth/Storage policies reviewed.
- A domain and HTTPS reverse proxy for public access. The supplied Compose file deliberately binds ports to `127.0.0.1` by default.

## Configure

From the repository root:

```bash
cp deploy/store.env.example deploy/store.env
cp deploy/creator.env.example deploy/creator.env
```

Edit both files with the real Supabase URL and public key. These public values are passed as build arguments because Next.js embeds `NEXT_PUBLIC_` variables into browser bundles during `next build`. Add the server-only Supabase secret key to each. In Store's environment file, replace `STORE_DOMAIN` and `CREATOR_DOMAIN` with the two DNS names you created. In Creator, set `GAMEON_ADMIN_USER_IDS` to the authorised admin Auth UUID(s) and set a strong random `GAMEON_SCANNER_WEBHOOK_SECRET` of at least 32 characters. Configure `GAMEON_STORE_URL` in Store and `NEXT_PUBLIC_STORE_URL` in both files to `https://` plus the Store hostname. Keep all secrets out of Git and out of every `NEXT_PUBLIC_` variable.

Payments remain disabled and the Paystack secret can remain blank for this first deployment. Add a Paystack test secret only when you are ready to carry out controlled staging checkout/refund tests. Do not enable live payments. Payment activation requires merchant onboarding, approved commercial/legal terms, test transactions, refund and reconciliation checks, and a responsible adult/business owner's explicit approval.

## Build and start

```bash
./scripts/deploy-self-hosted.sh
```

The script loads both env files into Compose so the public Supabase/site settings are available at Next.js build time. To run the commands manually, include both `--env-file deploy/store.env --env-file deploy/creator.env` options on `docker compose config`, `build`, `up`, and `ps`. Check logs with `docker compose logs -f store creator`.

The public endpoints are:

- Store: `https://` followed by `STORE_DOMAIN`
- Creator: `https://` followed by `CREATOR_DOMAIN`

Caddy handles routing and TLS certificate renewal. The local app endpoints remain available only on the server at `http://127.0.0.1:3000` and `http://127.0.0.1:3001` for diagnostics. Add both HTTPS domains to the Supabase Auth redirect URL allow-list. Do not expose the app ports directly to the public internet.

## Health checks and scanner

`GET /api/health` confirms the Node/Next process is responding. `GET /api/ready` checks the required backend configuration and Supabase availability; it should return HTTP 200 before sending public traffic. A health response alone does not mean the marketplace is fully configured.

The malware scanner remains a separate private service. After Creator has its public HTTPS URL, configure `services/build-scanner/.env` from its example and deploy it with its own Compose file. Keep ClamAV port 3310 private. Verify clean, EICAR, malformed, oversized, stale-lease and outage cases before accepting developer uploads.

## Dependency lockfile recovery (network-restricted workstation)

The first network-enabled GitHub Actions run installs the two npm workspaces and generates the genuine root `package-lock.json`. The workflow runs the strict release preflight and uploads the generated file as the `game-on-root-package-lock` artifact for 14 days. It deliberately has read-only repository permissions: it does not push commits or create pull requests automatically.

To finish the bootstrap, open the successful validation run in GitHub Actions, download the `game-on-root-package-lock` artifact, extract `package-lock.json` into the repository root, and commit that file to the feature branch for review. The next CI run uses `npm ci`; both production Dockerfiles also prefer `npm ci` when the committed lockfile is present. Keep the lockfile committed and regenerate it only through a reviewed dependency update.
## Rollback

Use the Git commit/image tag that was previously verified, then run `docker compose up -d --no-build`. Keep database backups and never roll back a database migration by deleting production tables. Database restore and migration rollback must follow the reviewed Supabase recovery procedure.

**Important:** this package configures the applications, private network, reverse proxy and automatic TLS, but it does not rent or create a public server, register domains, create DNS records, or create a Supabase/Paystack account. Those require accounts and credentials controlled by the project owner.
