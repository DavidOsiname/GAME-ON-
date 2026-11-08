import assert from "node:assert/strict";
import {
  buildAuthEmailMessages,
  createRawGmailMessage,
} from "../supabase/functions/send-auth-email/email.mjs";

const supabaseUrl = "https://viwczhmthlyagqwcrgrt.supabase.co";
const redirectTo = "https://game-on-creator-staging-o5hh.onrender.com";
const baseUser = { email: "player@example.com" };

function linkFor(message) {
  const links = message.text.match(/https:\/\/[^\s]+/g) || [];
  return links.find((value) => value.includes("/auth/v1/verify")) || "";
}

const signup = buildAuthEmailMessages({
  user: baseUser,
  supabaseUrl,
  emailData: {
    email_action_type: "signup",
    token: "123456",
    token_hash: "signup-hash-123",
    redirect_to: redirectTo,
  },
});
assert.equal(signup.length, 1);
assert.equal(signup[0].to, baseUser.email);
assert.match(signup[0].subject, /Confirm your GAME ON account/);
assert.match(signup[0].text, /123456/);
const signupLink = new URL(linkFor(signup[0]));
assert.equal(signupLink.searchParams.get("token"), "signup-hash-123");
assert.equal(signupLink.searchParams.get("type"), "signup");
assert.equal(signupLink.searchParams.get("redirect_to"), redirectTo);

const recovery = buildAuthEmailMessages({
  user: baseUser,
  supabaseUrl,
  emailData: {
    email_action_type: "recovery",
    token: "654321",
    token_hash: "recovery-hash",
    redirect_to: redirectTo,
  },
});
assert.match(recovery[0].subject, /Reset your GAME ON password/);
assert.equal(new URL(linkFor(recovery[0])).searchParams.get("type"), "recovery");

const invite = buildAuthEmailMessages({
  user: baseUser,
  supabaseUrl,
  emailData: {
    email_action_type: "invite",
    token: "777111",
    token_hash: "invite-hash",
    redirect_to: redirectTo,
  },
});
assert.match(invite[0].subject, /invited to GAME ON/);
assert.equal(new URL(linkFor(invite[0])).searchParams.get("type"), "invite");

const secureEmailChange = buildAuthEmailMessages({
  user: { email: "old@example.com", new_email: "new@example.com" },
  supabaseUrl,
  emailData: {
    email_action_type: "email_change",
    token: "111222",
    token_hash_new: "current-email-hash",
    token_new: "333444",
    token_hash: "new-email-hash",
    redirect_to: redirectTo,
  },
});
assert.equal(secureEmailChange.length, 2);
assert.equal(secureEmailChange[0].to, "old@example.com");
assert.equal(new URL(linkFor(secureEmailChange[0])).searchParams.get("token"), "current-email-hash");
assert.equal(secureEmailChange[1].to, "new@example.com");
assert.equal(new URL(linkFor(secureEmailChange[1])).searchParams.get("token"), "new-email-hash");

const singleEmailChange = buildAuthEmailMessages({
  user: { email: "old@example.com", new_email: "new@example.com" },
  supabaseUrl,
  emailData: {
    email_action_type: "email_change",
    token: "333444",
    token_hash: "new-email-hash",
    redirect_to: redirectTo,
  },
});
assert.equal(singleEmailChange.length, 1);
assert.equal(singleEmailChange[0].to, "new@example.com");
assert.equal(new URL(linkFor(singleEmailChange[0])).searchParams.get("token"), "new-email-hash");

const reauthentication = buildAuthEmailMessages({
  user: baseUser,
  supabaseUrl,
  emailData: {
    email_action_type: "reauthentication",
    token: "999000",
  },
});
assert.match(reauthentication[0].text, /999000/);
assert.equal(linkFor(reauthentication[0]), "");

const emailChanged = buildAuthEmailMessages({
  user: { email: "new@example.com" },
  supabaseUrl,
  emailData: {
    email_action_type: "email_changed_notification",
    old_email: "old@example.com",
  },
});
assert.deepEqual(emailChanged.map((message) => message.to), ["new@example.com", "old@example.com"]);

const raw = createRawGmailMessage({
  fromEmail: "contactgameoninternational@gmail.com",
  fromName: "GAME ON",
  to: "player@example.com",
  subject: "GAME ON test",
  text: "GAME ON test body — café",
  html: "<p>GAME ON test body — café</p>",
  boundary: "game-on-test-boundary",
});
assert.match(raw, /^[A-Za-z0-9_-]+$/);
const rawBytes = Uint8Array.from(atob(raw.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - raw.length % 4) % 4)), (character) => character.charCodeAt(0));
const rawMessage = new TextDecoder().decode(rawBytes);
assert.match(rawMessage, /From: GAME ON <contactgameoninternational@gmail\.com>/);
assert.match(rawMessage, /To: player@example\.com/);
assert.match(rawMessage, /Subject: GAME ON test/);
assert.match(rawMessage, /multipart\/alternative/);
assert.throws(() => createRawGmailMessage({
  fromEmail: "contactgameoninternational@gmail.com",
  fromName: "GAME ON\r\nBcc: attacker@example.com",
  to: "player@example.com",
  subject: "test",
  text: "test",
  html: "<p>test</p>",
}));
assert.throws(() => buildAuthEmailMessages({
  user: baseUser,
  supabaseUrl,
  emailData: { email_action_type: "unsupported_action" },
}));

console.log("Gmail Auth email helper tests passed: signup, recovery, invitations, secure and single-address email changes, reauthentication, security notices, and Gmail MIME encoding.");
