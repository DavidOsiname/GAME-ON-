import { NextRequest, NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/payment-server";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await authenticateBearer(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.clients.admin.from("marketplace_orders")
    .select("id,reference,game_title_snapshot,amount_minor,currency,status,created_at,paid_at,refund_requests(id,status,reason,requested_at)")
    .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Unable to load your purchase history." }, { status: 500 });
  return NextResponse.json({ orders: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
