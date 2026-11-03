import { NextRequest, NextResponse } from "next/server";
import { authenticateBearer, paystackConfiguration, verifyPaystackAndFulfil } from "@/lib/payment-server";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const paymentConfig = paystackConfiguration();
  if (!paymentConfig.enabled) return NextResponse.json({ error: paymentConfig.reason }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const auth = await authenticateBearer(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: { "Cache-Control": "no-store" } });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid verification request." }, { status: 400 }); }
  const reference = body && typeof body === "object" ? (body as Record<string, unknown>).reference : null;
  if (typeof reference !== "string" || !/^[A-Za-z0-9.=\-]{10,80}$/.test(reference)) return NextResponse.json({ error: "A valid payment reference is required." }, { status: 400 });
  const { data: order, error } = await auth.clients.admin.from("marketplace_orders").select("id,user_id,reference").eq("reference", reference).eq("user_id", auth.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to verify your order." }, { status: 500 });
  if (!order) return NextResponse.json({ error: "This order does not belong to your account." }, { status: 404 });
  try {
    const result = await verifyPaystackAndFulfil(reference, auth.clients.admin);
    return NextResponse.json({ success: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment verification failed." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
}
