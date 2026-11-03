import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { authenticateBearer, paystackConfiguration } from "@/lib/payment-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await authenticateBearer(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: { "Cache-Control": "no-store" } });
  const paymentConfig = paystackConfiguration();
  if (!paymentConfig.enabled) return NextResponse.json({ error: paymentConfig.reason }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const secret = paymentConfig.secret;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 }); }
  const gameId = body && typeof body === "object" ? (body as Record<string, unknown>).gameId : null;
  if (typeof gameId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(gameId)) {
    return NextResponse.json({ error: "Choose a valid published game." }, { status: 400 });
  }
  const { admin } = auth.clients;
  const { data: game, error } = await admin.from("games")
    .select("id,title,status,monetization_type,price_minor,currency,studio_id,developer_studios(verification_status,owner_user_id)")
    .eq("id", gameId).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to verify this game." }, { status: 500 });
  if (!game || game.status !== "published") return NextResponse.json({ error: "This game is not currently available for purchase." }, { status: 404 });
  const studio = Array.isArray(game.developer_studios) ? game.developer_studios[0] : game.developer_studios;
  if (studio?.verification_status !== "verified") return NextResponse.json({ error: "This developer is not currently verified for marketplace sales." }, { status: 409 });
  const amount = Number(game.price_minor);
  const currency = String(game.currency || "").trim().toUpperCase();
  if (game.monetization_type !== "paid" || !Number.isSafeInteger(amount) || amount <= 0) return NextResponse.json({ error: "This listing does not have a valid paid-game price." }, { status: 409 });
  if (currency !== "NGN") return NextResponse.json({ error: "The first checkout release supports NGN-priced games only. This listing needs an eligible supported currency." }, { status: 409 });
  const email = auth.user.email;
  if (!email || !auth.user.email_confirmed_at) return NextResponse.json({ error: "Confirm your Game ON account email before checkout." }, { status: 400 });
  if (studio?.owner_user_id === auth.user.id) return NextResponse.json({ error: "Developers cannot purchase their own game through the marketplace." }, { status: 403 });
  const { count: openOrders, error: openOrderError } = await admin.from("marketplace_orders").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id).eq("status", "pending").gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());
  if (openOrderError) return NextResponse.json({ error: "Unable to check your existing checkout sessions." }, { status: 500 });
  if ((openOrders || 0) >= 5) return NextResponse.json({ error: "You have several pending checkouts. Complete or wait for one to expire before starting another." }, { status: 429 });

  const reference = `GON${Date.now()}${randomBytes(8).toString("hex")}`;
  const feeBps = Math.max(0, Math.min(2500, Number.parseInt(process.env.GAMEON_PLATFORM_FEE_BPS || "1000", 10) || 1000));
  const platformFee = Math.floor(amount * feeBps / 10000);
  const developerNet = amount - platformFee;
  const { data: order, error: orderError } = await admin.from("marketplace_orders").insert({
    reference, user_id: auth.user.id, game_id: game.id, studio_id: game.studio_id,
    game_title_snapshot: game.title, amount_minor: amount, platform_fee_minor: platformFee,
    developer_net_minor: developerNet, platform_fee_bps: feeBps, currency, provider: "paystack", status: "pending",
  }).select("id,reference,amount_minor,currency").single();
  if (orderError || !order) return NextResponse.json({ error: "Unable to create your Game ON order. Please try again." }, { status: 500 });

  const origin = process.env.GAMEON_STORE_URL || request.nextUrl.origin;
  const callbackUrl = `${origin.replace(/\/$/, "")}/?payment=return&reference=${encodeURIComponent(reference)}`;
  const initResponse = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, amount: String(amount), currency, reference, callback_url: callbackUrl, metadata: JSON.stringify({ order_id: order.id, game_id: game.id, user_id: auth.user.id, platform: "game_on_store" }) }),
    cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  const initPayload = await initResponse.json().catch(() => null) as { status?: boolean; message?: string; data?: { authorization_url?: string; reference?: string } } | null;
  if (!initResponse.ok || !initPayload?.status || !initPayload.data?.authorization_url || initPayload.data.reference !== reference) {
    await admin.from("marketplace_orders").update({ status: "failed", provider_status: "initialization_failed", updated_at: new Date().toISOString() }).eq("id", order.id).eq("status", "pending");
    return NextResponse.json({ error: initPayload?.message || "The payment provider could not start checkout." }, { status: 502 });
  }
  await admin.from("marketplace_orders").update({ checkout_url: initPayload.data.authorization_url, provider_status: "initialized", updated_at: new Date().toISOString() }).eq("id", order.id);
  return NextResponse.json({ authorizationUrl: initPayload.data.authorization_url, reference }, { headers: { "Cache-Control": "no-store" } });
}
