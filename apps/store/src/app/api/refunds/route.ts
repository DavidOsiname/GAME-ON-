import { NextRequest, NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/payment-server";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const auth = await authenticateBearer(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid refund request." }, { status: 400 }); }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  if (typeof input.orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.orderId)) return NextResponse.json({ error: "A valid order is required." }, { status: 400 });
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 10 || reason.length > 2000) return NextResponse.json({ error: "Please explain the refund request in 10–2,000 characters." }, { status: 400 });
  const { data: order, error: orderError } = await auth.clients.admin.from("marketplace_orders").select("id,user_id,status").eq("id", input.orderId).eq("user_id", auth.user.id).maybeSingle();
  if (orderError) return NextResponse.json({ error: "Unable to verify this order." }, { status: 500 });
  if (!order || order.status !== "paid") return NextResponse.json({ error: "Only completed purchases can be submitted for refund review." }, { status: 409 });
  const { data, error } = await auth.clients.admin.from("refund_requests").insert({ order_id: order.id, user_id: auth.user.id, reason }).select("id,status,requested_at").single();
  if (error?.code === "23505") return NextResponse.json({ error: "A refund request already exists for this purchase." }, { status: 409 });
  if (error || !data) return NextResponse.json({ error: "Unable to submit the refund request." }, { status: 500 });
  return NextResponse.json({ refund: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
