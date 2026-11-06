-- GAME ON MAIL — initial application database schema
-- PostgreSQL 18+
-- This database stores application identities and mailbox metadata.
-- Email bodies and attachments remain in the mail server's mailbox storage.

BEGIN;

CREATE TABLE platform_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login_email text NOT NULL,
  display_name text NOT NULL,
  account_status text NOT NULL DEFAULT 'invited'
    CHECK (account_status IN ('invited', 'active', 'suspended', 'closed')),
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_users_login_email_normalized
    CHECK (
      login_email = lower(btrim(login_email))
      AND char_length(login_email) BETWEEN 5 AND 320
      AND strpos(login_email, '@') > 1
      AND strpos(login_email, '@') < char_length(login_email)
    ),
  CONSTRAINT platform_users_display_name_not_blank
    CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 100)
);

CREATE UNIQUE INDEX platform_users_login_email_uq
  ON platform_users (login_email);

CREATE TABLE user_password_credentials (
  user_id uuid PRIMARY KEY REFERENCES platform_users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  hash_scheme text NOT NULL DEFAULT 'argon2id'
    CHECK (hash_scheme = 'argon2id'),
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  failed_attempts smallint NOT NULL DEFAULT 0
    CHECK (failed_attempts BETWEEN 0 AND 100),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_password_hash_is_encoded
    CHECK (password_hash LIKE '$argon2id$%')
);

CREATE TABLE platform_user_roles (
  user_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  role_name text NOT NULL
    CHECK (role_name IN ('owner', 'admin', 'support')),
  assigned_by uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_name)
);

CREATE UNIQUE INDEX platform_single_owner_uq
  ON platform_user_roles ((role_name))
  WHERE role_name = 'owner';

CREATE TABLE mail_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_name text NOT NULL,
  domain_status text NOT NULL DEFAULT 'pending_verification'
    CHECK (domain_status IN ('pending_verification', 'verified', 'active', 'suspended')),
  created_by uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mail_domains_name_normalized
    CHECK (
      domain_name = lower(btrim(domain_name))
      AND char_length(domain_name) BETWEEN 3 AND 253
      AND strpos(domain_name, '.') > 1
      AND domain_name !~ '[^a-z0-9.-]'
      AND domain_name !~ '(^-|-$|\.\.|^\.|\.$)'
    )
);

CREATE UNIQUE INDEX mail_domains_domain_name_uq
  ON mail_domains (domain_name);

CREATE TABLE mailboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES mail_domains(id) ON DELETE RESTRICT,
  local_part text NOT NULL,
  display_name text NOT NULL,
  mailbox_kind text NOT NULL DEFAULT 'personal'
    CHECK (mailbox_kind IN ('personal', 'shared', 'service')),
  mailbox_status text NOT NULL DEFAULT 'provisioning'
    CHECK (mailbox_status IN ('provisioning', 'active', 'suspended', 'closed')),
  quota_bytes bigint NOT NULL DEFAULT 1073741824
    CHECK (quota_bytes BETWEEN 1048576 AND 1099511627776),
  mail_system_ref text UNIQUE,
  created_by uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mailboxes_local_part_normalized
    CHECK (
      local_part = lower(btrim(local_part))
      AND char_length(local_part) BETWEEN 1 AND 64
      AND local_part ~ '^[a-z0-9]([a-z0-9._+-]{0,62}[a-z0-9])?$'
    ),
  CONSTRAINT mailboxes_display_name_not_blank
    CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 100)
);

CREATE UNIQUE INDEX mailboxes_domain_local_part_uq
  ON mailboxes (domain_id, local_part);

CREATE TABLE mailbox_members (
  mailbox_id uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'member'
    CHECK (member_role IN ('owner', 'member', 'viewer')),
  granted_by uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mailbox_id, user_id)
);

CREATE UNIQUE INDEX mailbox_single_owner_uq
  ON mailbox_members (mailbox_id)
  WHERE member_role = 'owner';

CREATE INDEX mailbox_members_user_idx
  ON mailbox_members (user_id, mailbox_id);

CREATE TABLE mailbox_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES mail_domains(id) ON DELETE RESTRICT,
  local_part text NOT NULL,
  created_by uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mailbox_aliases_local_part_normalized
    CHECK (
      local_part = lower(btrim(local_part))
      AND char_length(local_part) BETWEEN 1 AND 64
      AND local_part ~ '^[a-z0-9]([a-z0-9._+-]{0,62}[a-z0-9])?$'
    )
);

CREATE UNIQUE INDEX mailbox_aliases_domain_local_part_uq
  ON mailbox_aliases (domain_id, local_part);

CREATE INDEX mailbox_aliases_mailbox_idx
  ON mailbox_aliases (mailbox_id);

CREATE TABLE account_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitee_email text NOT NULL,
  token_hash bytea NOT NULL,
  invited_by uuid NOT NULL REFERENCES platform_users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_invitations_email_normalized
    CHECK (
      invitee_email = lower(btrim(invitee_email))
      AND char_length(invitee_email) BETWEEN 5 AND 320
      AND strpos(invitee_email, '@') > 1
      AND strpos(invitee_email, '@') < char_length(invitee_email)
    ),
  CONSTRAINT account_invitations_token_hash_length
    CHECK (octet_length(token_hash) = 32),
  CONSTRAINT account_invitations_expiry_after_creation
    CHECK (expires_at > created_at),
  CONSTRAINT account_invitations_single_terminal_state
    CHECK (NOT (accepted_at IS NOT NULL AND revoked_at IS NOT NULL))
);

CREATE UNIQUE INDEX account_invitations_token_hash_uq
  ON account_invitations (token_hash);

CREATE INDEX account_invitations_email_idx
  ON account_invitations (invitee_email, expires_at DESC);

CREATE TABLE user_preferences (
  user_id uuid PRIMARY KEY REFERENCES platform_users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system'
    CHECK (theme IN ('light', 'dark', 'system')),
  locale text NOT NULL DEFAULT 'en',
  timezone text NOT NULL DEFAULT 'Africa/Lagos',
  email_notifications boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_contacts_email_normalized
    CHECK (
      email_address = lower(btrim(email_address))
      AND char_length(email_address) BETWEEN 5 AND 320
      AND strpos(email_address, '@') > 1
      AND strpos(email_address, '@') < char_length(email_address)
    ),
  CONSTRAINT user_contacts_display_name_not_blank
    CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 100)
);

CREATE UNIQUE INDEX user_contacts_per_user_email_uq
  ON user_contacts (user_id, email_address);

CREATE TABLE mail_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id uuid REFERENCES mailboxes(id) ON DELETE SET NULL,
  mail_system_message_ref text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  delivery_status text NOT NULL
    CHECK (delivery_status IN ('queued', 'processing', 'accepted', 'deferred', 'bounced', 'rejected', 'failed')),
  remote_domain text,
  diagnostic_code text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mail_delivery_events_ref_not_blank
    CHECK (char_length(btrim(mail_system_message_ref)) BETWEEN 1 AND 255)
);

CREATE INDEX mail_delivery_events_mailbox_time_idx
  ON mail_delivery_events (mailbox_id, occurred_at DESC);

CREATE INDEX mail_delivery_events_status_time_idx
  ON mail_delivery_events (delivery_status, occurred_at DESC);

CREATE TABLE security_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'user'
    CHECK (actor_type IN ('user', 'system')),
  event_name text NOT NULL,
  target_type text,
  target_id uuid,
  request_id text,
  source_ip inet,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT security_audit_event_name_not_blank
    CHECK (char_length(btrim(event_name)) BETWEEN 1 AND 120)
);

CREATE INDEX security_audit_events_actor_time_idx
  ON security_audit_events (actor_user_id, created_at DESC);

CREATE INDEX security_audit_events_name_time_idx
  ON security_audit_events (event_name, created_at DESC);

CREATE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER platform_users_set_updated_at
  BEFORE UPDATE ON platform_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER mail_domains_set_updated_at
  BEFORE UPDATE ON mail_domains
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER mailboxes_set_updated_at
  BEFORE UPDATE ON mailboxes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER user_preferences_set_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER user_contacts_set_updated_at
  BEFORE UPDATE ON user_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
