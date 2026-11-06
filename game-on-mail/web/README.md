# GAME ON MAIL — Web application

This is the first web-app foundation for GAME ON MAIL. It is a UI prototype with synthetic demonstration messages. It does **not** connect to a mail server and cannot send or receive real email yet.

## Requirements

- Node.js 26 LTS (the project also requires Node.js 22.11 or newer)
- npm

## Run locally

```bash
cd game-on-mail/web
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

## Checks

```bash
npm run typecheck
npm run build
```

Health endpoint: http://localhost:3000/api/health

## Safety boundary

- All inbox messages shown by the interface are synthetic demo content.
- The compose screen can save a draft in browser memory only.
- The Send action is intentionally unavailable.
- Do not enter real personal information or real passwords.
- Do not add mail-server secrets to this repository.
- Do not enable public registration or mail delivery until the backend, mail engine, DNS authentication, abuse controls and security review are complete.

## Next engineering milestones

1. Implement account and invitation flows.
2. Add a database schema and migrations.
3. Create a local-only mail-server proof of concept.
4. Integrate authenticated IMAP and SMTP submission through a server-side service.
