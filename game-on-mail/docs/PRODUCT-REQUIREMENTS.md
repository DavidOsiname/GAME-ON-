# GAME ON MAIL — Product Requirements

**Document status:** Phase 1 working specification  
**Version:** 0.1  
**Product owner:** GAME ON  
**Release target:** Private alpha first; public launch only after operational checks

## 1. Product vision

Build a GAME ON-branded email service that lets people create and use email accounts on a GAME ON-controlled domain through a custom, mobile-friendly inbox. GAME ON will operate the application and mail infrastructure rather than relying on Gmail, Outlook or Zoho as the mailbox provider.

The service will use established open email standards and proven open-source mail components. GAME ON will own the product experience, account management, integrations, configuration and operation of its service.

## 2. Target users

1. **Platform owner:** Controls the service, domains, security settings and administrator access.
2. **Mail administrator:** Invites and manages users, handles abuse reports and supports account recovery.
3. **Mailbox member:** Sends, receives and organizes their own email.
4. **Service mailbox:** A role-based address such as support@ or contact@, managed by authorized team members.

## 3. Account and address model

- Each person has a GAME ON MAIL application account and an associated mailbox.
- Each mailbox receives one primary address on the production domain selected by GAME ON.
- Role addresses may be implemented as aliases or shared mailboxes, depending on permissions and audit requirements.
- The production domain has **not** been selected or purchased yet. Use a reserved local-development domain such as gameon.test in development only; never publish it in DNS or use it for real email.
- The first release is invite-only. Public self-registration is deferred until abuse controls, rate limits, verification and support processes are ready.
- Administrators must not be able to casually browse users' message contents. Any exceptional access for support or security must be narrowly permissioned and audited.

## 4. MVP features

### Account access
- Invite-based account creation
- Secure sign-in and sign-out
- Email address and account verification
- Password reset and recovery
- Session management and sign-out of other sessions
- Profile and display-name settings

### Mailbox
- Inbox and unread counts
- Sent messages
- Drafts
- Compose and send
- Read and reply
- Reply-all and forward
- Basic folders or labels
- Archive, trash and spam
- Search by sender, recipient, subject and message text where supported
- Attachment upload and download with type and size restrictions
- Contacts and recent recipients

### Administration
- Invite, suspend and reactivate accounts
- Manage mailbox aliases and quotas
- Review delivery and security events without exposing message bodies by default
- View abuse reports and apply sending limits
- Audit important administrator actions

### Experience
- Responsive layout for Android phones, tablets and desktop browsers
- Accessible forms, clear loading and error states
- Consistent GAME ON branding
- No misleading claim that messages are delivered until the mail server confirms acceptance

## 5. Out of scope for the first release

- Public anonymous sign-up
- Bulk marketing campaigns
- AI email assistant
- Calendar, documents, chat or video meetings
- Custom mobile apps before the web inbox is stable
- End-to-end encryption claims unless the complete design and key management are independently reviewed
- Unlimited storage or unlimited sending
- Promising that every receiving provider will place messages in the inbox rather than spam

## 6. Security, privacy and trust requirements

- Use HTTPS for the web application and TLS for mail connections.
- Hash application passwords with a modern password-hashing algorithm; never store plaintext passwords.
- Keep SMTP/IMAP credentials, signing keys and service secrets out of source control.
- Apply rate limits to login, password reset, invitation and sending actions.
- Validate and safely handle message content, HTML, links and file attachments.
- Scan or quarantine risky attachments before users download them.
- Prevent open-relay behavior: unauthenticated outsiders must never be able to use GAME ON MAIL to send arbitrary mail.
- Use least-privilege service accounts and separate application, database and mail-server permissions.
- Keep security and administrator audit logs, but do not log message bodies or passwords.
- Encrypt server disks and backups; restrict backup access and test restoration.
- Define a privacy notice, retention rules, account deletion process and abuse-reporting contact before public launch.
- Provide a way to suspend compromised or abusive accounts quickly.

## 7. Deliverability requirements

Before public email service is enabled, GAME ON must have:
- A registered domain and control of its DNS.
- A stable public server address and a hostname with matching forward DNS.
- Provider support for the required mail ports and the ability to configure reverse DNS/PTR.
- Correct MX, SPF and DKIM records; publish a DMARC policy and monitor reports.
- Valid TLS certificates and secure SMTP submission and IMAP access.
- Queue monitoring, bounce handling, spam filtering and outbound rate limits.
- External tests proving that messages can be sent to and received from multiple major providers.
- An open-relay test and documented incident-response procedure.

## 8. First-release success criteria

The private alpha is successful when an invited user can sign in, view a real mailbox, compose and send a message, receive a reply from an external mailbox, open an attachment safely, and organize messages. Delivery events must be visible to operators, account data must be isolated, and the service must pass the security checks listed in the launch checklist.

## 9. Product principles

1. **Ownership:** GAME ON operates the product and its mail infrastructure.
2. **Reliability before scale:** Start with a small private alpha.
3. **Privacy by default:** Administrative access is limited and audited.
4. **Open standards:** Use SMTP, IMAP and standard email authentication.
5. **Honest delivery status:** Show queued, sent, bounced or failed states accurately.
6. **Safe growth:** Do not open registration until abuse prevention is ready.
