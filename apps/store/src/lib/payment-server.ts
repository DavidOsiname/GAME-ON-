import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type StoreSupabaseClient = SupabaseClient<any, "public", "public", any, any>;
import { timingSafeEqual, createHmac } from "node:crypto";

import { paystackConfiguration } from "./payment-config.mjs";
export { paystackConfiguration } from "./payment-config.mjs";

export function serverClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return null;
  return {
    verifier: createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } }),
    admin: createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}

export async function authenticateBearer(request: Request) {
  const clients = serverClients();
  if (!clients) return { error: "Game ON account services are not configured.", status: 503 as const };
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { error: "Sign in to your Game ON player account.", status: 401 as const };
  const { data, error } = await clients.verifier.auth.getUser(token);
  if (error || !data.user) return { error: "Your session is invalid or expired. Sign in again.", status: 401 as const };
  return { clients, user: data.user };
}

export function validatePaystackSignature(rawBody: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function verifyPaystackAndFulfil(reference: string, admin: StoreSupabaseClient) {
  const paymentConfig = paystackConfiguration();
  if (!paymentConfig.enabled) throw new Error(paymentConfig.reason);
  const secret = paymentConfig.secret;
  const { data: order, error: orderError } = await admin.from("marketplace_orders")
    .select("id,reference,amount_minor,currency,status").eq("reference", reference).maybeSingle();
  if (orderError) throw new Error("Unable to load the matching Game ON order.");
  if (!order) throw new Error("No Game ON order matches this payment reference.");
  if (order.status === "paid") return { fulfilled: true, alreadyPaid: true };
  if (order.status !== "pending") throw new Error("This order is not awaiting payment.");

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null) as { status?: boolean; message?: string; data?: { id?: number | string; status?: string; reference?: string; amount?: number; currency?: string } } | null;
  const payment = payload?.data;
  if (!response.ok || !payload?.status || !payment) throw new Error(payload?.message || "Unable to verify the payment with Paystack.");
  if (payment.status !== "success" || payment.reference !== reference) throw new Error("Paystack has not confirmed this payment as successful.");
  if (Number(payment.amount) !== Number(order.amount_minor) || String(payment.currency).toUpperCase() !== String(order.currency).trim().toUpperCase()) {
    throw new Error("Verified payment amount or currency does not match the Game ON order.");
  }
  const { error: fulfilError } = await admin.rpc("complete_marketplace_order", {
    p_reference: reference,
    p_provider_transaction_id: String(payment.id ?? reference),
    p_amount_minor: Number(payment.amount),
    p_currency: String(payment.currency),
  });
  if (fulfilError) throw new Error("Payment was verified but Game ON could not complete fulfilment. Support must reconcile this order.");
  return { fulfilled: true, alreadyPaid: false };
}
