# GAME ON MAIL — Roadmap

Use this checklist as the project's source of truth. Only mark an item complete after the code or configuration exists and its acceptance test passes.

## Phase 1 — Product planning

- [x] Choose product name: GAME ON MAIL
- [x] Define the vision and initial audience
- [x] Choose invite-only accounts for the private alpha
- [x] Define the MVP and out-of-scope features
- [x] Write privacy, security and deliverability requirements
- [ ] Review and approve the product requirements

**Exit criteria:** The product owner accepts the requirements and first-release scope.

## Phase 2 — Technical architecture

- [x] Confirm web-first application architecture
- [x] Create the initial Next.js App Router web-app foundation
- [x] Add a demo inbox, compose-draft interaction and application health endpoint
- [x] Confirm backend framework and API boundaries: Next.js, Better Auth and PostgreSQL
- [x] Apply and validate initial Better Auth and GAME ON database migrations in CI

- [x] Draft the initial PostgreSQL schema and migration
- [x] Add a localhost-only PostgreSQL development service
- [x] Add a database smoke test for mailbox address uniqueness
- [ ] Complete mail-server proof of concept
- [ ] Define mailbox provisioning and authentication integration
- [ ] Define attachment storage, quotas and backups
- [x] Document local development environment and migration order

**Exit criteria:** A documented architecture and a local proof of concept can create a test mailbox and access it securely.

## Phase 3 — Design and web application foundation

- [ ] Approve GAME ON MAIL visual identity
- [ ] Build responsive application shell
- [ ] Build sign-in and invitation screens
- [ ] Build mailbox navigation
- [ ] Build inbox and message-reading screens
- [ ] Build compose and attachment screens
- [ ] Add accessibility and mobile-layout checks

**Exit criteria:** Users can navigate the complete interface using test data; no real email delivery is claimed yet.

## Phase 4 — Identity and mailbox provisioning

- [x] Add Better Auth API route with PostgreSQL-backed identities and sessions
- [x] Configure password sign-in, verification gate, password-reset hooks and rate limiting
- [x] Build sign-in, local-development sign-up, account and recovery screens
- [x] Link Better Auth identities to GAME ON profile records with a database foreign key
- [ ] Pass the end-to-end account smoke test in CI
- [ ] Implement invite creation and acceptance
- [ ] Implement administrator provisioning and account suspension
- [ ] Connect account records to provisioned mailboxes
- [ ] Enable real verification and password-reset delivery through GAME ON mail infrastructure
- [ ] Complete session-management and audit-event controls

**Exit criteria:** An administrator can invite, suspend and recover test accounts without exposing secrets.

## Phase 5 — Mail engine integration

- [ ] Deploy the selected self-hosted mail engine in a test environment
- [ ] Provision and remove test mailboxes
- [ ] Connect the app to IMAP for mailbox reading
- [ ] Connect the app to SMTP submission for sending
- [ ] Implement message status and bounce handling
- [ ] Implement attachments, folders, search and spam handling

**Exit criteria:** Two test mailboxes can exchange email in the controlled test environment.

## Phase 6 — Domain and public infrastructure

- [ ] Select and register a GAME ON MAIL domain
- [ ] Choose a server provider that supports required mail ports and reverse DNS
- [ ] Configure hostname, A/AAAA, MX and PTR records
- [ ] Configure SPF, DKIM and DMARC
- [ ] Configure TLS and automatic certificate renewal
- [ ] Configure monitoring, log retention and backups
- [ ] Verify the mail server is not an open relay

**Exit criteria:** Independent external mailboxes can send to and receive from GAME ON MAIL with authentication passing.

## Phase 7 — Security and private beta

- [ ] Test authentication, authorization and mailbox isolation
- [ ] Test malicious and oversized attachments
- [ ] Test spam and abuse controls
- [ ] Test backup restoration and account recovery
- [ ] Test Gmail, Outlook and at least one other external provider
- [ ] Invite a small group of testers
- [ ] Resolve all critical and high-severity issues

**Exit criteria:** The service passes the security and reliability review and has an operator on call.

## Phase 8 — Public launch

- [ ] Publish privacy notice and acceptable-use policy
- [ ] Publish support and abuse-reporting contacts
- [ ] Set quotas and fair-use limits
- [ ] Complete launch review
- [ ] Open registration gradually
- [ ] Monitor delivery, queue health, abuse and costs

**Exit criteria:** Public registration is enabled only when the service can be safely operated and supported.

## Current milestone

**Phase 4 — Account foundation.** The authentication API, local sign-up and sign-in screens, protected account page, PostgreSQL identity integration, and CI migration checks have been added. The end-to-end sign-up test is now part of CI. Production registration and recovery remain disabled until GAME ON mail delivery is implemented and tested.
