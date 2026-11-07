/**
 * Central Paystack kill switch and key/mode validation.
 * Defaults to disabled, including production. Live funds require a separate
 * explicit approval flag so a copied test configuration cannot go live by accident.
 */
export function paystackConfiguration(env = process.env) {
  const secret = env.PAYSTACK_SECRET_KEY || "";
  const mode = String(env.GAMEON_PAYMENTS_MODE || "test").toLowerCase();
  if (env.GAMEON_PAYMENTS_ENABLED !== "true") {
    return { enabled: false, reason: "Marketplace payments are disabled until Game ON completes staging and provider onboarding." };
  }
  if (mode === "test" && secret.startsWith("sk_test_")) {
    return { enabled: true, mode: "test", secret };
  }
  if (mode === "live" && secret.startsWith("sk_live_") && env.GAMEON_LIVE_PAYMENTS_APPROVED === "true") {
    return { enabled: true, mode: "live", secret };
  }
  return {
    enabled: false,
    reason: mode === "live"
      ? "Live payments require a live Paystack secret and explicit Game ON approval."
      : "Test payments require GAMEON_PAYMENTS_MODE=test and a Paystack test secret.",
  };
}
