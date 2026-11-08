import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import {
  buildAuthEmailMessages,
  createRawGmailMessage,
} from "./email.mjs";

const EXPECTED_SENDER = "contactgameoninternational@gmail.com";
const JSON_HEADERS = { "Content-Type": "application/json" };
const TOKEN_TIMEOUT_MS = 1700;
const SEND_TIMEOUT_MS = 1700;

type HookUser = {
  email?: string;
  new_email?: string;
};

type AuthEmailHookPayload = {
  user: HookUser;
  email_data: Record<string, unknown>;
};

type OutboundMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

class SenderError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "SenderError";
    this.code = code;
  }
}

let cachedAccessToken = "";
let cachedAccessTokenExpiresAt = 0;
let refreshInFlight: Promise<string> | null = null;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function authHookError(status: number, code: string, message: string) {
  console.error(JSON.stringify({
    event: "gameon_auth_email_error",
    code,
    status,
  }));
  return jsonResponse(status, {
    error: {
      http_code: status,
      message,
    },
  });
}

function normalizeHookSecret(value: string) {
  return value.trim().replace(/^v1,whsec_/, "");
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new SenderError("missing_" + name.toLowerCase());
  return value;
}

async function refreshGmailAccessToken(): Promise<string> {
  const clientId = getRequiredEnv("GMAIL_OAUTH_CLIENT_ID");
  const clientSecret = getRequiredEnv("GMAIL_OAUTH_CLIENT_SECRET");
  const refreshToken = getRequiredEnv("GMAIL_OAUTH_REFRESH_TOKEN");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
  } catch {
    throw new SenderError("gmail_oauth_endpoint_unreachable");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.access_token !== "string" || !payload.access_token) {
    throw new SenderError("gmail_oauth_rejected_" + response.status);
  }

  const expiresIn = Number(payload.expires_in) || 3600;
  cachedAccessToken = payload.access_token;
  cachedAccessTokenExpiresAt = Date.now() + Math.max(60, expiresIn) * 1000;
  return cachedAccessToken;
}

async function getGmailAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now() + 60_000) {
    return cachedAccessToken;
  }
  if (!refreshInFlight) {
    refreshInFlight = refreshGmailAccessToken();
  }
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function sendGmailMessage(accessToken: string, raw: string) {
  let response: Response;
  try {
    response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch {
    throw new SenderError("gmail_api_endpoint_unreachable");
  }

  if (!response.ok) {
    if (response.status === 401) {
      cachedAccessToken = "";
      cachedAccessTokenExpiresAt = 0;
    }
    throw new SenderError("gmail_api_rejected_" + response.status);
  }

  const result = await response.json().catch(() => ({}));
  if (typeof result.id !== "string" || !result.id) {
    throw new SenderError("gmail_api_missing_message_id");
  }
  return result.id as string;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 96_000) {
    return new Response("Payload too large", { status: 413 });
  }

  const hookSecretValue = Deno.env.get("SEND_EMAIL_HOOK_SECRET") || "";
  if (!hookSecretValue.trim()) {
    return authHookError(503, "send_email_hook_not_configured", "GAME ON email sending is not configured yet.");
  }

  let payloadText = "";
  try {
    payloadText = await request.text();
  } catch {
    return authHookError(400, "invalid_hook_body", "The email request could not be read.");
  }
  if (payloadText.length > 96_000) {
    return new Response("Payload too large", { status: 413 });
  }

  let event: AuthEmailHookPayload;
  try {
    const webhook = new Webhook(normalizeHookSecret(hookSecretValue));
    event = webhook.verify(payloadText, Object.fromEntries(request.headers)) as AuthEmailHookPayload;
  } catch {
    return authHookError(401, "invalid_auth_hook_signature", "The email request signature could not be verified.");
  }

  const senderEmail = Deno.env.get("GMAIL_SENDER_EMAIL")?.trim().toLowerCase() || "";
  if (senderEmail !== EXPECTED_SENDER) {
    return authHookError(503, "gmail_sender_account_mismatch", "GAME ON's configured Gmail sender account does not match the approved sender.");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  let messages: OutboundMessage[];
  try {
    messages = buildAuthEmailMessages({
      user: event?.user || {},
      emailData: event?.email_data || {},
      supabaseUrl,
    }) as OutboundMessage[];
  } catch {
    return authHookError(400, "invalid_auth_email_payload", "The authentication email request is incomplete or unsupported.");
  }

  if (!messages.length || messages.length > 2) {
    return authHookError(400, "invalid_auth_email_recipient_count", "The authentication email request has an invalid recipient count.");
  }

  try {
    const accessToken = await getGmailAccessToken();
    const outbound = messages.map((message) => {
      const raw = createRawGmailMessage({
        fromEmail: senderEmail,
        fromName: Deno.env.get("GMAIL_SENDER_NAME") || "GAME ON",
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return sendGmailMessage(accessToken, raw);
    });
    const results = await Promise.allSettled(outbound);
    const acceptedCount = results.filter((item) => item.status === "fulfilled").length;
    if (acceptedCount !== messages.length) {
      const failed = results.find((item) => item.status === "rejected");
      const errorCode = failed?.status === "rejected" && failed.reason instanceof SenderError
        ? failed.reason.code
        : "gmail_send_failed";
      return authHookError(502, errorCode, "GAME ON could not send the authentication email through Gmail. Please try again shortly.");
    }

    console.info(JSON.stringify({
      event: "gameon_auth_email_accepted_by_gmail",
      action: String(event.email_data.email_action_type || "unknown"),
      message_count: acceptedCount,
    }));

    return jsonResponse(200, {});
  } catch (error) {
    const code = error instanceof SenderError ? error.code : "gmail_sender_internal_error";
    return authHookError(502, code, "GAME ON could not send the authentication email through Gmail. Please try again shortly.");
  }
});
