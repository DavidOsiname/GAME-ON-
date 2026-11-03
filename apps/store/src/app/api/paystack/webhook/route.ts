import { NextRequest, NextResponse } from "next/server";
import { validatePaystackSignature, serverClients, verifyPaystackAndFulfil, paystackConfiguration } from "@/lib/payment-server";
import { refundEventEffects } from "@/lib/refund-event.mjs";
import { readUtf8BodyLimited } from "@/lib/body-limit.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const paymentConfig = paystackConfiguration();
  if (!paymentConfig.enabled) return NextResponse.json({ error: paymentConfig.reason }, { status: 503 });
  const secret = paymentConfig.secret;
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;
  if (Number.isFinite(contentLength) && contentLength > 256 * 1024) return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  const rawBody = await readUtf8BodyLimited(request.body, 256 * 1024);
  if (rawBody === null) return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  const signature = request.headers.get("x-paystack-signature") || "";
  if (!signature || !validatePaystackSignature(rawBody, signature, secret)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  let event: unknown;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid event payload." }, { status: 400 }); }
  const record = event && typeof event === "object" ? event as Record<string, unknown> : {};
  const data = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : {};
  const clients = serverClients();
  if (!clients) return NextResponse.json({ error: "Game ON backend is not configured." }, { status: 503 });
  if (record.event === "charge.success") {
    const reference = data.reference;
    if (typeof reference !== "string") return NextResponse.json({ received: true });
    try {
      await verifyPaystackAndFulfil(reference, clients.admin);
      return NextResponse.json({ received: true });
    } catch (error) {
      // Provider retries are safe: fulfilment is idempotent and verified server-side.
      return NextResponse.json({ error: error instanceof Error ? error.message : "Payment fulfilment failed." }, { status: 500 });
    }
  }
  if (typeof record.event === "string" && record.event.startsWith("refund.")) {
    const transaction = data.transaction && typeof data.transaction === "object" ? data.transaction as Record<string, unknown> : {};
    const reference = transaction.reference;
    if (typeof reference !== "string") return NextResponse.json({ received: true });
    const { data: order } = await clients.admin.from("marketplace_orders").select("id,user_id,game_id").eq("reference", reference).maybeSingle();
    if (!order) return NextResponse.json({ received: true });
    const refundStatus = record.event === "refund.processed" ? "processed" : record.event === "refund.failed" ? "failed" : record.event === "refund.needs-attention" ? "needs_attention" : "processing";
    const { data: refund, error: refundUpdateError } = await clients.admin.from("refund_requests").update({ status: refundStatus, updated_at: new Date().toISOString(), processed_at: refundStatus === "processed" ? new Date().toISOString() : null, provider_refund_id: String(data.id ?? "") })
      .eq("order_id", order.id).in("status", ["requested", "processing", "needs_attention", "failed"]).select("id,status").maybeSingle();
    if (refundUpdateError) return NextResponse.json({ error: "Unable to reconcile refund event." }, { status: 500 });
    // Only apply an order/entitlement transition when this event actually advanced
    // an eligible refund row. A stale `refund.failed` event must never reverse a
    // previously processed refund after a later webhook retry.
    const effects = refundEventEffects(refund, refundStatus);
    if (effects.markOrderRefunded) {
      await clients.admin.from("marketplace_orders").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", order.id).eq("status", "paid");
    } else if (effects.restorePaidOrder) {
      await clients.admin.from("marketplace_orders").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", order.id).eq("status", "refunded");
    }
    if (effects.removeLibraryEntitlement) {
      await clients.admin.from("user_library").delete().eq("user_id", order.user_id).eq("game_id", order.game_id);
    }
    return NextResponse.json({ received: true, updated: effects.applied });
  }
  return NextResponse.json({ received: true });
}
