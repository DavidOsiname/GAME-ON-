import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";

const origin = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for the auth smoke test.");
}

const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const server = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1"],
  {
    env: {
      ...process.env,
      NODE_ENV: "development",
      ALLOW_PUBLIC_SIGNUP: "true",
      MAIL_DELIVERY_ENABLED: "false",
      AUTH_LINK_LOGGING: "false",
      BETTER_AUTH_URL: origin,
      BETTER_AUTH_TRUSTED_ORIGINS: origin,
    },
    stdio: "ignore",
  },
);

let email = "";
let createdUserId = "";

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error("Next.js exited before the auth smoke test started.");
    }

    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }

    await delay(1_000);
  }

  throw new Error("Next.js did not become healthy within 60 seconds.");
}

try {
  await waitForServer();

  email = `gameon-ci-${Date.now()}@example.test`;
  const signUpResponse = await fetch(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify({
      name: "GAME ON CI Test",
      email,
      password: "CI-only-Password-1234",
      callbackURL: "/account",
    }),
  });

  const signUpBody = await signUpResponse.json().catch(() => ({}));
  assert.equal(
    signUpResponse.ok,
    true,
    `Sign-up endpoint failed: ${signUpBody.message ?? signUpResponse.status}`,
  );
  assert.equal(signUpBody.user?.email, email, "Sign-up did not return the created user.");
  createdUserId = String(signUpBody.user.id);

  const result = await pool.query(
    `SELECT p.auth_user_id, p.login_email, u."emailVerified"
     FROM platform_users p
     JOIN "user" u ON u.id = p.auth_user_id
     WHERE p.auth_user_id = $1`,
    [createdUserId],
  );
  assert.equal(result.rowCount, 1, "The GAME ON profile projection was not created.");
  assert.equal(result.rows[0].login_email, email);
  assert.equal(result.rows[0].emailVerified, false);

  const signInResponse = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify({
      email,
      password: "CI-only-Password-1234",
    }),
  });
  const signInBody = await signInResponse.json().catch(() => ({}));
  assert.equal(
    signInResponse.ok && Boolean(signInBody.token),
    false,
    "An unverified user unexpectedly received a sign-in session.",
  );

  console.log("GAME ON MAIL auth smoke test passed: sign-up, profile sync and unverified sign-in rejection.");
} finally {
  if (createdUserId) {
    await pool.query('DELETE FROM "user" WHERE id = $1', [createdUserId]).catch(() => undefined);
  }
  await pool.end();
  server.kill("SIGTERM");
}
