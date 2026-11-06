-- GAME ON MAIL initial schema smoke test.
-- Run after 0001_initial_schema.sql. All sample rows are rolled back.

BEGIN;

INSERT INTO "user" (
  id, name, email, "emailVerified", "createdAt", "updatedAt"
) VALUES (
  'auth-test-owner-0001',
  'GAME ON Test Owner',
  'owner@example.test',
  true,
  now(),
  now()
);

INSERT INTO platform_users (
  id, auth_user_id, login_email, display_name, account_status, email_verified_at
) VALUES (
  '10000000-0000-4000-8000-000000000001',
  'auth-test-owner-0001',
  'owner@example.test',
  'GAME ON Test Owner',
  'active',
  now()
);

INSERT INTO platform_user_roles (user_id, role_name)
VALUES ('10000000-0000-4000-8000-000000000001', 'owner');

INSERT INTO mail_domains (id, domain_name, domain_status)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  'gameon.test',
  'active'
);

INSERT INTO mailboxes (
  id, display_name, mailbox_kind, mailbox_status, quota_bytes
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  'Test Owner Mailbox',
  'personal',
  'active',
  1073741824
);

INSERT INTO mailbox_members (mailbox_id, user_id, member_role)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'owner'
);

INSERT INTO mailbox_addresses (
  mailbox_id, domain_id, local_part, address_kind
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'owner',
  'primary'
);

INSERT INTO mailbox_addresses (
  mailbox_id, domain_id, local_part, address_kind
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'hello',
  'alias'
);

DO $$
DECLARE
  address_count integer;
BEGIN
  SELECT count(*) INTO address_count
  FROM mailbox_addresses
  WHERE mailbox_id = '30000000-0000-4000-8000-000000000001';

  IF address_count <> 2 THEN
    RAISE EXCEPTION 'Expected 2 mailbox addresses, found %', address_count;
  END IF;

  INSERT INTO mailboxes (
    id, display_name, mailbox_kind, mailbox_status, quota_bytes
  ) VALUES (
    '30000000-0000-4000-8000-000000000002',
    'Second Test Mailbox',
    'personal',
    'active',
    1073741824
  );

  -- The same domain/local-part cannot be assigned to another mailbox,
  -- even when one record would be a primary address and the other an alias.
  BEGIN
    INSERT INTO mailbox_addresses (
      mailbox_id, domain_id, local_part, address_kind
    ) VALUES (
      '30000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000001',
      'hello',
      'primary'
    );
    RAISE EXCEPTION 'Duplicate mailbox address was unexpectedly accepted';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;
END;
$$;

ROLLBACK;
