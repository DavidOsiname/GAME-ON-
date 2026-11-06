# GAME ON MAIL — Database Design

**Status:** Initial schema draft  
**Target database:** PostgreSQL 18  
**Migration:** `database/migrations/0001_initial_schema.sql`

## Data boundary

The PostgreSQL database is for application identity and control-plane data. The mail system stores actual email messages and mailbox data.

| Data | System of record |
|---|---|
| User profile, account status and verified login identity | PostgreSQL |
| Password hash and account lock metadata | PostgreSQL |
| Platform roles and mailbox memberships | PostgreSQL |
| Verified mail domains, primary mailbox addresses and aliases | PostgreSQL |
| Invitations and user preferences | PostgreSQL |
| Contacts | PostgreSQL |
| Delivery-status references and security audit metadata | PostgreSQL |
| Message bodies, full headers, mailbox folders and attachments | Mail server storage |
| SMTP queue and IMAP mailbox indexes | Mail server storage |

This avoids building a second email store in the product database and limits exposure of message content.

## Tables

- `platform_users`: application users and account lifecycle.
- `user_password_credentials`: Argon2id encoded password hashes and login lock metadata.
- `platform_user_roles`: platform owner, admin and support role assignments.
- `mail_domains`: GAME ON-controlled domains and verification/activation state.
- `mailboxes`: personal, shared and service mailboxes plus quota and mail-engine reference.
- `mailbox_members`: users authorized to access a mailbox and their role.
- `mailbox_addresses`: primary addresses and aliases in one unique registry, preventing address collisions.
- `account_invitations`: invite token digests, expiry and acceptance state.
- `user_preferences`: display and notification preferences.
- `user_contacts`: per-user address book.
- `mail_delivery_events`: non-content delivery references and status events.
- `security_audit_events`: security and administrator activity metadata.

## Security properties

1. Email identifiers are normalized to lowercase before storage and protected by unique indexes.
2. Passwords are represented only by encoded Argon2id hashes. Raw passwords must never reach logs or database fields.
3. Invitation tokens are stored as SHA-256 digests (32 bytes), not as usable tokens.
4. Mailbox membership is explicit. A signed-in user must not be able to read another mailbox just by guessing an identifier.
5. Platform and mailbox roles are kept separate.
6. Audit details must contain only allowlisted metadata; never store passwords, authentication tokens, full message bodies or DKIM private keys.
7. Database access is server-side only. The PostgreSQL port is bound to localhost in the local development Compose setup.
8. Production will use separate database roles for migrations and application runtime. The application runtime role must not own tables or have schema-alteration privileges.

## Deliberate omissions

- No email body or attachment table.
- No SMTP credentials or DKIM private key fields.
- No browser-facing database credentials.
- No public sign-up records until invitation, verification and abuse controls are ready.
- No full-text message search index until its privacy and retention design is approved.

## Review items before production

- Validate the mailbox local-part policy against the domain and mail-server implementation.
- Ensure mailbox creation always inserts the mailbox and exactly one primary address in a single transaction.
- Decide password policy, reset token flow and multi-factor authentication.
- Define platform owner bootstrap and recovery.
- Define mailbox provisioning reconciliation and handling of mail-server outages.
- Add database role grants and backups for the chosen production environment.
- Test migration against a clean PostgreSQL 18 instance and an upgrade path.
