import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";

const isProduction = process.env.NODE_ENV === "production";
const mailDeliveryEnabled = process.env.MAIL_DELIVERY_ENABLED === "true";
const secret = process.env.BETTER_AUTH_SECRET;

if (mailDeliveryEnabled) {
  throw new Error(
    "MAIL_DELIVERY_ENABLED cannot be true until the self-hosted GAME ON mail transport is implemented and tested.",
  );
}

if (isProduction && (!secret || secret.length < 32)) {
  throw new Error(
    "BETTER_AUTH_SECRET must be set to at least 32 characters in production.",
  );
}

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const trustedOrigins = (
  process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? baseURL
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

async function handleAuthLink(
  label: "verification" | "password reset",
  email: string,
  url: string,
) {
  if (isProduction) {
    // Never log tokens or verification URLs in production.
    console.warn(
      `GAME ON MAIL: ${label} message was not sent because mail delivery is not configured. Recipient: ${email}`,
    );
    return;
  }

  // Local developer-only handoff. The URL contains a short-lived token and
  // must never be copied into production logs or shared publicly.
  console.info(
    `[LOCAL DEVELOPMENT ONLY] GAME ON MAIL ${label} link for ${email}: ${url}`,
  );
}

export const auth = betterAuth({
  appName: "GAME ON MAIL",
  baseURL,
  basePath: "/api/auth",
  secret:
    secret ??
    "game-on-mail-local-development-secret-only-not-for-production",
  trustedOrigins,
  database: db,
  emailAndPassword: {
    enabled: true,
    disableSignUp:
      isProduction || process.env.ALLOW_PUBLIC_SIGNUP !== "true",
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: false,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await handleAuthLink("password reset", user.email, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await handleAuthLink("verification", user.email, url);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: false,
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.query(
            `INSERT INTO platform_users (
              auth_user_id,
              login_email,
              display_name,
              account_status,
              email_verified_at
            )
            VALUES ($1, $2, $3, 'active', CASE WHEN $4 THEN now() ELSE NULL END)
            ON CONFLICT (auth_user_id) DO UPDATE SET
              login_email = EXCLUDED.login_email,
              display_name = EXCLUDED.display_name,
              email_verified_at = EXCLUDED.email_verified_at,
              updated_at = now()`,
            [
              user.id,
              user.email.toLowerCase(),
              user.name,
              user.emailVerified,
            ],
          );
        },
      },
      update: {
        after: async (user) => {
          await db.query(
            `UPDATE platform_users
             SET login_email = $2,
                 display_name = $3,
                 email_verified_at = CASE
                   WHEN $4::boolean IS NULL THEN email_verified_at
                   WHEN $4::boolean IS TRUE THEN COALESCE(email_verified_at, now())
                   ELSE NULL
                 END,
                 updated_at = now()
             WHERE auth_user_id = $1`,
            [
              user.id,
              user.email.toLowerCase(),
              user.name,
              user.emailVerified,
            ],
          );
        },
      },
    },
  },
  advanced: {
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
    },
  },
  telemetry: {
    enabled: false,
  },
  plugins: [nextCookies()],
});
