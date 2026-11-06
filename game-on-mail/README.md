# GAME ON MAIL

**Tagline:** Your inbox. Your world.

GAME ON MAIL is GAME ON's planned independent email service. The product will provide branded email accounts, a custom web inbox and the infrastructure needed to send and receive internet email.

## Product direction

- **Product:** GAME ON MAIL
- **Owner:** GAME ON
- **First client:** Responsive web application
- **Initial audience:** Founders, team members and invited beta testers
- **Account model:** Individual mailboxes on a GAME ON-controlled domain, plus role-based service addresses such as support@
- **Mail infrastructure:** Self-hosted SMTP and IMAP services; no Gmail, Outlook or Zoho mailbox provider in the delivery path
- **Development approach:** Build and test locally first; publish only after delivery, security and abuse controls pass

## Current status

**Phase 1 — Product planning: started.**

This folder is deliberately separate from the GAME ON Store project.

## Documents

- [Product requirements](docs/PRODUCT-REQUIREMENTS.md)
- [Roadmap and acceptance criteria](docs/ROADMAP.md)
- [Initial technical architecture](docs/TECHNICAL-PLAN.md)

## Important launch constraint

Writing the application is only one part of operating an email service. Public sending and receiving require a registered domain, a persistent server with a public IP, suitable network access, reverse DNS/PTR control, DNS authentication records, TLS, monitoring, backups and abuse handling. Local development can begin before those are purchased or configured.

Do not put real passwords, API keys, private keys, recovery codes or production mailbox data in this repository.
