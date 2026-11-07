import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BUCKET = "game-build-quarantine";
const PLATFORMS = ["android", "windows", "web"] as const;

export async function POST(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: "Secure downloads are not configured on this Game ON Store deployment." }, { status: 503, headers: { "Cache-Control": "no-store" } });

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Sign in to your player account before downloading." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const verifier = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await verifier.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "Your player session is invalid or expired. Sign in again." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const { gameId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(gameId)) {
    return NextResponse.json({ error: "Invalid game ID." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Choose a download platform." }, { status: 400 }); }
  const platform = body && typeof body === "object" ? (body as Record<string, unknown>).platform : null;
  if (typeof platform !== "string" || !PLATFORMS.includes(platform as (typeof PLATFORMS)[number])) {
    return NextResponse.json({ error: "Choose Android, Windows or Web." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: game, error: gameError } = await admin.from("games")
    .select("id,title,status,monetization_type").eq("id", gameId).maybeSingle();
  if (gameError) return NextResponse.json({ error: "Unable to verify this game." }, { status: 500 });
  if (!game || game.status !== "published") return NextResponse.json({ error: "This game is not currently published." }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const { data: entitlement, error: entitlementError } = await admin.from("user_library")
    .select("game_id").eq("user_id", authData.user.id).eq("game_id", game.id).maybeSingle();
  if (entitlementError) return NextResponse.json({ error: "Unable to verify your game library." }, { status: 500 });
  if (!entitlement) return NextResponse.json({ error: "Add or purchase this game before downloading it." }, { status: 403, headers: { "Cache-Control": "no-store" } });

  const { data: build, error: buildError } = await admin.from("game_builds")
    .select("id,object_path,version_label,platform,original_file_name,scan_status,release_status,upload_status,sha256_hex")
    .eq("game_id", game.id).eq("platform", platform).eq("upload_status", "uploaded")
    .eq("scan_status", "clean").eq("release_status", "approved")
    .order("uploaded_at", { ascending: false }).limit(1).maybeSingle();
  if (buildError) return NextResponse.json({ error: "Unable to locate an approved game build." }, { status: 500 });
  if (!build) return NextResponse.json({ error: `There is no approved ${platform} build available for this game yet.` }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const { data: signed, error: signedError } = await admin.storage.from(BUCKET).createSignedUrl(build.object_path, 120, { download: build.original_file_name || true });
  if (signedError || !signed?.signedUrl) return NextResponse.json({ error: "Unable to prepare a secure download. Please try again later." }, { status: 503 });

  // Record issuance only; this is not proof that the file transfer completed.
  const { error: eventError } = await admin.from("download_events").insert({
    user_id: authData.user.id, game_id: game.id, build_id: build.id, platform,
  });
  if (eventError) return NextResponse.json({ error: "The download could not be recorded. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  await admin.from("audit_events").insert({ actor_user_id: authData.user.id, event_type: "game_download_link_issued", entity_type: "game_build", entity_id: build.id, event_data: { game_id: game.id, platform, version_label: build.version_label, expires_in_seconds: 120 } });
  return NextResponse.json({ url: signed.signedUrl, expiresIn: 120, version: build.version_label, platform, sha256: build.sha256_hex }, { headers: { "Cache-Control": "no-store, private" } });
}
