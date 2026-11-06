import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isUuid } from "@/lib/server-auth";
export const dynamic = "force-dynamic";

async function context(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = (process.env.SUPABASE_SECRET_KEY || process.(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY));
  const admins = (process.env.GAMEON_ADMIN_USER_IDS || "").split(",").map((v) => v.trim()).filter(Boolean);
  if (!url || !anon || !service || !admins.length) return { error: "Admin refund management is not configured.", status: 503 as const };
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { error: "Sign in with an authorised Game ON administrator account.", status: 401 as const };
  const verifier = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user) return { error: "Your session is invalid or expired.", status: 401 as const };
  if (!admins.includes(data.user.id)) return { error: "You are not authorised to manage refund requests.", status: 403 as const };
  return { admin: createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }), userId: data.user.id };
}

export async function GET(request: NextRequest) {
  const auth = await context(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.admin.from("refund_requests")
    .select("id,order_id,user_id,reason,status,admin_note,provider_refund_id,requested_at,marketplace_orders(reference,game_title_snapshot,amount_minor,currency,status,provider_transaction_id)")
    .order("requested_at", { ascending: true }).limit(200);
  if (error) return NextResponse.json({ error: "Unable to load refund requests." }, { status: 500 });
  return NextResponse.json({ refunds: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const auth = await context(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const refundId = input.refundId;
  const action = input.action;
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (!isUuid(refundId) || (action !== "reject" && action !== "process")) return NextResponse.json({ error: "Choose a valid refund and action." }, { status: 400 });
  const { data: refund, error } = await auth.admin.from("refund_requests")
    .select("id,status,order_id,user_id,marketplace_orders(reference,game_id,user_id,amount_minor,currency,provider_transaction_id,status)")
    .eq("id", refundId).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to verify refund request." }, { status: 500 });
  if (!refund || refund.status !== "requested") return NextResponse.json({ error: "This refund request has already been actioned." }, { status: 409 });
  const order = Array.isArray(refund.marketplace_orders) ? refund.marketplace_orders[0] : refund.marketplace_orders;
  if (!order || order.status !== "paid") return NextResponse.json({ error: "The associated purchase is not refundable in its current state." }, { status: 409 });

  if (action === "reject") {
    if (note.length < 10 || note.length > 1000) return NextResponse.json({ error: "Provide a clear rejection note of 10–1,000 characters." }, { status: 400 });
    const { data: updated, error: updateError } = await auth.admin.from("refund_requests").update({ status: "rejected", admin_note: note, updated_at: new Date().toISOString() }).eq("id", refundId).eq("status", "requested").select("id,status").maybeSingle();
    if (updateError || !updated) return NextResponse.json({ error: "Unable to reject this request. Refresh and try again." }, { status: 409 });
    await auth.admin.from("audit_events").insert({ actor_user_id: auth.userId, event_type: "marketplace_refund_rejected", entity_type: "refund_request", entity_id: refundId, event_data: { note } });
    return NextResponse.json({ refund: updated });
  }

  const secret = process.env.PAYSTACK_SECRET_KEY || "";
  const paymentsEnabled = process.env.GAMEON_PAYMENTS_ENABLED === "true";
  const paymentMode = (process.env.GAMEON_PAYMENTS_MODE || "test").toLowerCase();
  const keyMatchesMode = paymentMode === "test" ? secret.startsWith("sk_test_")
    : paymentMode === "live" && secret.startsWith("sk_live_") && process.env.GAMEON_LIVE_PAYMENTS_APPROVED === "true";
  if (!paymentsEnabled || !keyMatchesMode) return NextResponse.json({ error: "Refund processing is disabled until the matching Paystack environment and Game ON approval are configured." }, { status: 503 });

  // Claim the request before calling the provider. This prevents two admins from
  // submitting the same refund concurrently and accidentally issuing duplicates.
  const { data: claim, error: claimError } = await auth.admin.from("refund_requests").update({
    status: "processing", admin_note: note || "Refund submission started; awaiting provider result.", updated_at: new Date().toISOString(),
  }).eq("id", refundId).eq("status", "requested").select("id").maybeSingle();
  if (claimError || !claim) return NextResponse.json({ error: "Another administrator has already actioned this request. Refresh the queue." }, { status: 409 });

  const transaction = order.provider_transaction_id || order.reference;
  let response: Response;
  try {
    response = await fetch("https://api.paystack.co/refund", {
      method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ transaction, customer_note: "Game ON purchase refund", merchant_note: note || "Approved after Game ON support review." }), cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
  } catch {
    await auth.admin.from("refund_requests").update({
      status: "needs_attention", admin_note: "The refund request timed out or the provider connection failed. Check the Paystack Dashboard before retrying to avoid a duplicate refund.", updated_at: new Date().toISOString(),
    }).eq("id", refundId).eq("status", "processing");
    return NextResponse.json({ error: "The provider response could not be confirmed. Check Paystack before taking another action." }, { status: 502 });
  }
  const payload = await response.json().catch(() => null) as { status?: boolean; message?: string; data?: { id?: number | string; status?: string } } | null;
  if (!response.ok || !payload?.status || !payload.data) {
    await auth.admin.from("refund_requests").update({
      status: "needs_attention", admin_note: `Provider response needs review: ${payload?.message || `HTTP ${response.status}`}`.slice(0, 1000), updated_at: new Date().toISOString(),
    }).eq("id", refundId).eq("status", "processing");
    return NextResponse.json({ error: payload?.message || "Paystack response needs manual reconciliation before retrying." }, { status: 502 });
  }
  const providerStatus = String(payload.data.status || "pending").toLowerCase();
  const nextStatus = providerStatus === "processed" ? "processed" : providerStatus === "failed" ? "failed" : providerStatus === "needs-attention" ? "needs_attention" : "processing";
  const { data: updated, error: updateError } = await auth.admin.from("refund_requests").update({
    status: nextStatus, admin_note: note || "Approved by Game ON support.", provider_refund_id: String(payload.data.id || ""),
    updated_at: new Date().toISOString(), processed_at: nextStatus === "processed" ? new Date().toISOString() : null,
  }).eq("id", refundId).eq("status", "processing").select("id,status,provider_refund_id").maybeSingle();
  // A fast provider webhook may win the race and set the row to processed first.
  const finalRefund = updated || (await auth.admin.from("refund_requests").select("id,status,provider_refund_id").eq("id", refundId).maybeSingle()).data;
  if (updateError || !finalRefund) return NextResponse.json({ error: "Paystack accepted the refund, but Game ON could not reconcile its ledger. Check the provider dashboard." }, { status: 207 });
  if (finalRefund.status === "processed") {
    await auth.admin.from("marketplace_orders").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", refund.order_id);
    await auth.admin.from("user_library").delete().eq("user_id", order.user_id).eq("game_id", order.game_id);
  }
  await auth.admin.from("audit_events").insert({ actor_user_id: auth.userId, event_type: "marketplace_refund_processing_started", entity_type: "refund_request", entity_id: refundId, event_data: { provider_refund_id: finalRefund.provider_refund_id, status: finalRefund.status } });
  return NextResponse.json({ refund: finalRefund }, { headers: { "Cache-Control": "no-store" } });

}
