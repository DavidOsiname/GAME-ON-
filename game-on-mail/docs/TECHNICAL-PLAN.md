# GAME ON MAIL — Initial Technical Plan

**Status:** Proposed architecture; subject to a local proof of concept before final selection.

## 1. Architecture boundary

GAME ON MAIL has two cooperating systems:

1. **Product application:** The branded web interface, application accounts, invitations, preferences, admin controls and API.
2. **Mail system:** The mail transfer and mailbox services that speak standard SMTP and IMAP to the wider internet and email clients.

The product application must not pretend to be a mail server. A message is only reported as sent or delivered according to the actual mail system's status.

## 2. Proposed components

| Layer | Proposed choice | Responsibility |
|---|---|---|
| Web client | Next.js + React + TypeScript | Responsive GAME ON MAIL inbox |
| API | Node.js + TypeScript | Application logic and controlled mail integration |
| Application database | PostgreSQL | Accounts, invitations, preferences, aliases, audit metadata |
| Mail distribution | Evaluate Mailu stable release | Self-hosted SMTP/IMAP services, mailbox administration and filtering |
| Mail protocols | SMTP submission + IMAP over TLS | Sending and reading mail |
| Mail storage | Persistent volumes managed by mail system | Message bodies, mailbox indexes and queue |
| Attachments | Mail system storage initially | Avoid unnecessary duplicate message storage |
| Deployment | Linux server with Docker Compose for mail; app hosting selected separately | Keep mail networking and persistent data under our control |

Mailu is a candidate, not an unchangeable decision. Before production, confirm its supported stable release, resource requirements, license obligations, security advisories and operational fit. Do not deploy a development master image as production.

## 3. Logical data ownership

**PostgreSQL stores application data:**
- user account ID and normalized login identity
- display name and preferences
- invitation state and verification state
- mailbox address and mail-system identifier
- role and account status
- quota settings
- audit-event metadata
- contact metadata only where needed

**The mail system stores email data:**
- message content and headers
- mailbox folders and indexes
- delivery queue and delivery state
- server-side filtering metadata
- mailbox attachments as part of message storage

Do not copy complete message bodies into PostgreSQL in the MVP unless a documented feature requires it.

## 4. Authentication and mailbox connection

The application account and mailbox identity must be linked safely. The implementation must not store a user's mailbox password in plaintext.

During Phase 2, compare supported authentication approaches:
- short-lived, per-session credential handling;
- a supported mailbox authentication integration;
- or a controlled mail-access service that enforces user-to-mailbox authorization.

Use the mail system's supported administration interface for mailbox provisioning. Never expose mail-server administrator credentials to the browser or ordinary user API.

## 5. Network and DNS requirements

Production mail hosting needs:
- a domain GAME ON controls;
- an always-on server with a stable public address;
- provider permission for inbound and outbound SMTP and mail submission;
- reverse DNS/PTR configuration for the server IP;
- matching hostname and forward DNS;
- MX records directing inbound email to the mail host;
- SPF and DKIM authentication, plus a published DMARC policy;
- TLS certificates and secure client connections.

Many general web-app hosting platforms are not suitable for hosting the mail server itself. Keep the mail engine on infrastructure that explicitly supports mail networking, persistent storage and reverse DNS.

## 6. Security controls

- HTTPS for browser-to-API traffic and TLS for mail connections.
- Modern password hashing for application accounts.
- Secrets stored in deployment secret management, never in Git.
- Role-based access control and least privilege.
- Per-account quotas and sending rate limits.
- Anti-spam filtering, attachment scanning and open-relay prevention.
- Audit logs for admin and security actions.
- Persistent encrypted backups and tested restoration.
- No message bodies or passwords in routine application logs.

## 7. Development environments

**Local development:** Use a local test domain such as gameon.test, synthetic users and test messages. Do not use real customer information. The local environment must not send to the public internet by default.

**Private test server:** Use a dedicated test domain and server only after network and DNS requirements are available. Restrict accounts to invited testers.

**Production:** Use a separately configured production domain, server, secrets, backups, monitoring and documented recovery procedures. No production mailbox data should be stored in a public test environment.

## 8. Decisions still open

- Final domain name and registrar
- Mail-server distribution and pinned release
- Application API framework
- Mailbox authentication integration
- Hosting provider, region, IP reputation and SMTP port availability
- Storage quotas and attachment size limits
- Backup retention and recovery-point objectives
- Account deletion and data retention policy
- Applicable legal and privacy requirements for target markets

## 9. Architecture acceptance test

Before implementation is considered proven, the prototype must:
1. Create a test application user and associated test mailbox.
2. Authenticate without exposing administrator credentials.
3. List and open messages over a secure mailbox connection.
4. Submit a message through authenticated SMTP.
5. Receive a reply in the mailbox.
6. Confirm mailbox A cannot read mailbox B.
7. Shut down and restart the mail service without losing persistent test data.
