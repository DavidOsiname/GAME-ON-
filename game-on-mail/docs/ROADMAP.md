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
- [ ] Confirm backend framework and API boundaries
- [ ] Confirm database schema and migrations
- [ ] Complete mail-server proof of concept
- [ ] Define mailbox provisioning and authentication integration
- [ ] Define attachment storage, quotas and backups
- [ ] Document local development and deployment environments

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

- [ ] Implement invite creation and acceptance
- [ ] Implement secure application authentication
- [ ] Implement password recovery and session controls
- [ ] Connect account records to mailboxes
- [ ] Implement administrator account management
- [ ] Add audit events and rate limits

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

**Phase 1 — Product planning.** The first five planning tasks are drafted. Product-owner review remains open.
