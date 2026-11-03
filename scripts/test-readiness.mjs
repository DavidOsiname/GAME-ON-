import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const store = await import(pathToFileURL(path.join(root, "apps/store/src/lib/readiness.mjs")));
const creator = await import(pathToFileURL(path.join(root, "apps/creator/src/lib/readiness.mjs")));
const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-that-is-long-enough-for-test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-that-is-long-enough-for-test",
};

for (const [name, module] of [["Store", store], ["Creator", creator]]) {
  let requested;
  const ok = await module.checkReadiness(validEnv, async (url, options) => {
    requested = { url: String(url), options };
    return new Response(null, { status: 200 });
  });
  assert.equal(ok.ready, true, `${name} should be ready when configuration and database probe pass`);
  assert.equal(ok.checks.database, true);
  assert.equal(requested.options.method, "HEAD");
  assert.equal(requested.options.cache, "no-store");
  assert.equal(requested.options.headers.apikey, validEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  assert.match(requested.url, /\/rest\/v1\/games\?/);

  const missingSecret = await module.checkReadiness({ ...validEnv, SUPABASE_SERVICE_ROLE_KEY: "" }, async () => {
    throw new Error("database probe must not run when config is missing");
  });
  assert.equal(missingSecret.ready, false);
  assert.equal(missingSecret.checks.serviceRoleKey, false);

  const rejectedDb = await module.checkReadiness(validEnv, async () => new Response(null, { status: 401 }));
  assert.equal(rejectedDb.ready, false);
  assert.equal(rejectedDb.checks.database, false);

  const networkFailure = await module.checkReadiness(validEnv, async () => { throw new Error("offline"); });
  assert.equal(networkFailure.ready, false);
  assert.equal(networkFailure.checks.database, false);

  if (name === "Creator") {
    const creatorEnv = {
      ...validEnv,
      GAMEON_ADMIN_USER_IDS: "123e4567-e89b-42d3-a456-426614174000",
      GAMEON_SCANNER_WEBHOOK_SECRET: "a-long-random-scanner-secret-for-tests-123",
    };
    const creatorReady = await module.checkReadiness(creatorEnv, async () => new Response(null, { status: 200 }), 5_000, ["GAMEON_ADMIN_USER_IDS", "GAMEON_SCANNER_WEBHOOK_SECRET"]);
    assert.equal(creatorReady.ready, true);
    const creatorMissingOps = await module.checkReadiness({ ...creatorEnv, GAMEON_ADMIN_USER_IDS: "not-a-uuid", GAMEON_SCANNER_WEBHOOK_SECRET: "short" }, async () => {
      throw new Error("DB probe must not run when Creator operations settings are invalid");
    }, 5_000, ["GAMEON_ADMIN_USER_IDS", "GAMEON_SCANNER_WEBHOOK_SECRET"]);
    assert.equal(creatorMissingOps.ready, false);
    assert.equal(creatorMissingOps.checks["setting:GAMEON_ADMIN_USER_IDS"], false);
    assert.equal(creatorMissingOps.checks["setting:GAMEON_SCANNER_WEBHOOK_SECRET"], false);
  }

  const unsafeUrl = await module.checkReadiness({ ...validEnv, NEXT_PUBLIC_SUPABASE_URL: "http://example.com" }, async () => {
    throw new Error("database probe must not run for insecure URLs");
  });
  assert.equal(unsafeUrl.ready, false);
  assert.equal(unsafeUrl.checks.supabaseUrl, false);
}

console.log("Readiness checks passed for Store and Creator: ready, missing secrets, Creator admin/scanner configuration, DB rejection, network failure and insecure URL.");
