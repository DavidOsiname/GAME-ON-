const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Checks only server-side readiness. The caller must never return the detailed
 * checks object to an unauthenticated client.
 */
export async function checkReadiness(env = process.env, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, requiredServerSettings = []) {
  const checks = {
    supabaseUrl: false,
    anonKey: false,
    serviceRoleKey: false,
    database: false,
  };
  for (const setting of requiredServerSettings) checks[`setting:${setting}`] = false;

  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  checks.anonKey = typeof anonKey === "string" && anonKey.length > 20;
  checks.serviceRoleKey = typeof serviceRoleKey === "string" && serviceRoleKey.length > 20;
  for (const setting of requiredServerSettings) {
    const value = env[setting];
    if (setting === "GAMEON_ADMIN_USER_IDS") {
      const ids = typeof value === "string" ? value.split(",").map((id) => id.trim()).filter(Boolean) : [];
      checks[`setting:${setting}`] = ids.length > 0 && ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
    } else if (setting === "GAMEON_SCANNER_WEBHOOK_SECRET") {
      checks[`setting:${setting}`] = typeof value === "string" && value.length >= 32;
    } else {
      checks[`setting:${setting}`] = typeof value === "string" && value.trim().length > 0;
    }
  }

  let supabaseUrl;
  try {
    const parsed = new URL(rawUrl);
    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if ((parsed.protocol === "https:" || (isLocal && parsed.protocol === "http:")) && !parsed.username && !parsed.password) {
      supabaseUrl = parsed;
      checks.supabaseUrl = true;
    }
  } catch {
    // Invalid or missing URL is reported as not-ready, without exposing details.
  }

  const settingsReady = Object.entries(checks).filter(([key]) => key.startsWith("setting:")).every(([, value]) => value);
  if (checks.supabaseUrl && checks.anonKey && checks.serviceRoleKey && settingsReady) {
    const probeUrl = new URL("/rest/v1/games?select=id&status=eq.published&limit=1", supabaseUrl);
    try {
      const response = await fetchImpl(probeUrl, {
        method: "HEAD",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      checks.database = response.ok;
    } catch {
      checks.database = false;
    }
  }

  return {
    ready: Object.values(checks).every(Boolean),
    checks,
  };
}
