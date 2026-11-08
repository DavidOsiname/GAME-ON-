import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function parseEnvOutput(output) {
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.trim().match(/^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function recipients(message) {
  const to = Array.isArray(message?.To) ? message.To : [];
  return to.map((item) => {
    if (typeof item === "string") return item.toLowerCase();
    return String(item?.Address || item?.Email || "").toLowerCase();
  }).filter(Boolean);
}

async function readMessages(mailpitUrl, email) {
  const response = await fetch(new URL("/api/v1/messages?limit=100", mailpitUrl), {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 200, "Mailpit must expose its local messages API");
  const payload = await response.json();
  assert.ok(Array.isArray(payload.messages), "Mailpit response must contain a messages array");
  return payload.messages.filter((message) => recipients(message).includes(email.toLowerCase()));
}

async function waitForMessages(mailpitUrl, email, expectedCount, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let found = [];
  while (Date.now() < deadline) {
    found = await readMessages(mailpitUrl, email);
    if (found.length >= expectedCount) return found;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  assert.ok(found.length >= expectedCount,
    "Expected " + expectedCount + " confirmation emails in Mailpit for the local test address; found " + found.length);
  return found;
}

async function readMessage(mailpitUrl, id) {
  const response = await fetch(new URL("/api/v1/message/" + encodeURIComponent(id), mailpitUrl), {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 200, "Mailpit must return message " + id);
  return response.json();
}

function confirmationLink(message) {
  const body = String(message.HTML || "") + "\n" + String(message.Text || "");
  const links = body.match(/https?:\/\/[^"'<> \r\n]+/gi) || [];
  const candidate = links.find((link) => link.includes("/auth/v1/verify"));
  assert.ok(candidate, "Confirmation email must contain a Supabase Auth verification link");
  return new URL(candidate.replaceAll("&amp;", "&").replaceAll("&#38;", "&"));
}

async function main() {
  const statusOutput = execFileSync("supabase", ["status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const env = parseEnvOutput(statusOutput);
  const apiUrl = env.API_URL || env.SUPABASE_URL || "http://127.0.0.1:54321";
  const anonKey = env.ANON_KEY || env.PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  const serviceRoleKey = env.SERVICE_ROLE_KEY || env.SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const mailpitUrl = process.env.MAILPIT_URL || "http://127.0.0.1:54324";
  const creatorOrigin = process.env.CREATOR_TEST_REDIRECT_URL || "http://localhost:3001";

  const api = new URL(apiUrl);
  const mailpit = new URL(mailpitUrl);
  assert.ok(["127.0.0.1", "localhost", "::1"].includes(api.hostname),
    "Refusing to run the Creator Auth email test against a hosted/non-local Supabase project");
  assert.ok(["127.0.0.1", "localhost", "::1"].includes(mailpit.hostname),
    "Refusing to inspect a non-local Mailpit instance");
  assert.ok(anonKey, "Supabase CLI status must provide a local publishable/anon key");
  assert.ok(serviceRoleKey, "Supabase CLI status must provide a local service-role/secret key");

  const email = "creator-confirmation-" + randomUUID() + "@example.com";
  const password = randomBytes(24).toString("base64url") + "A9!";
  const client = createClient(apiUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let userId = null;
  const mailpitIds = [];

  try {
    const signup = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: creatorOrigin },
    });
    assert.ifError(signup.error);
    assert.ok(signup.data.user?.id, "Signup must create a local Auth user");
    userId = signup.data.user.id;
    assert.equal(signup.data.session, null, "Unconfirmed signup must not create a signed-in session");
    assert.equal(signup.data.user.email_confirmed_at, undefined,
      "Unconfirmed signup must not return a confirmed email timestamp");

    const blockedSignIn = await client.auth.signInWithPassword({ email, password });
    assert.ok(blockedSignIn.error, "Password sign-in must be blocked until email confirmation");
    assert.equal(blockedSignIn.data.session, null);

    const firstEmails = await waitForMessages(mailpitUrl, email, 1);
    mailpitIds.push(...firstEmails.map((message) => message.ID).filter(Boolean));

    // Local Auth throttles repeated messages to the same address; this wait does not affect hosted users.
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    const resend = await client.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: creatorOrigin },
    });
    assert.ifError(resend.error);

    const allEmails = await waitForMessages(mailpitUrl, email, 2);
    mailpitIds.push(...allEmails.map((message) => message.ID).filter(Boolean));
    const distinctIds = [...new Set(mailpitIds)];
    assert.ok(distinctIds.length >= 2, "Signup and resend must create two distinct confirmation emails");

    const latest = await readMessage(mailpitUrl, distinctIds[0]);
    const link = confirmationLink(latest);
    assert.equal(link.searchParams.get("redirect_to"), creatorOrigin,
      "Resent confirmation link must redirect to the Creator application");

    const verification = await fetch(link, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    assert.ok(verification.status >= 300 && verification.status < 400,
      "Confirming the email link must redirect; received HTTP " + verification.status);
    const location = verification.headers.get("location");
    assert.ok(location, "Email confirmation must return a redirect location");
    assert.equal(new URL(location).origin, creatorOrigin,
      "Completed email confirmation must return the user to GAME ON Creator");

    const signedIn = await client.auth.signInWithPassword({ email, password });
    assert.ifError(signedIn.error);
    assert.ok(signedIn.data.session, "The user must be able to sign in after confirming the email");
    assert.equal(signedIn.data.user?.email?.toLowerCase(), email);
    await client.auth.signOut();

    console.log("Creator Auth email integration passed: signup is unconfirmed, sign-in is blocked, resend sends a second email, the confirmation link returns to Creator, and sign-in succeeds after confirmation.");
  } finally {
    if (userId) {
      const cleanup = await fetch(new URL("/auth/v1/admin/users/" + encodeURIComponent(userId), apiUrl), {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          authorization: "Bearer " + serviceRoleKey,
        },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);
      if (cleanup && !cleanup.ok) {
        console.warn("Local Auth test user cleanup returned HTTP " + cleanup.status + ". The user exists only in the disposable local CI database.");
      }
    }

    const uniqueMailIds = [...new Set(mailpitIds)].filter(Boolean);
    if (uniqueMailIds.length) {
      await fetch(new URL("/api/v1/messages", mailpitUrl), {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ IDs: uniqueMailIds }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);
    }
  }
}

main().catch((error) => {
  console.error("Creator Auth email integration failed:", error);
  process.exitCode = 1;
});
