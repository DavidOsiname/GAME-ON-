import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isUuid } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

async function getAdmin(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const allowlist = (process.env.GAMEON_ADMIN_USER_IDS || "").split(",").map((v) => v.trim()).filter(Boolean);
  if (!url || !anon || !service || !allowlist.length) return { error: "Admin build review is not configured.", status: 503 as const };
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { error: "Sign in as an authorised Game ON administrator.", status: 401 as const };
  const verifier = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user) return { error: "Your session is invalid or expired.", status: 401 as const };
  if (!allowlist.includes(data.user.id)) return { error: "This account is not authorised to review builds.", status: 403 as const };
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  return { admin, userId: data.user.id };
}

export async function GET(request: NextRequest) {
  const context = await getAdmin(request);
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  const { data: rows, error } = await context.admin.from("game_builds")
    .select("id,game_id,version_label,platform,file_size_bytes,original_file_name,upload_status,scan_status,release_status,scan_report,sha256_hex,scan_attempts,scan_started_at,created_at,uploaded_at")
    .in("upload_status", ["uploaded", "awaiting_upload", "failed"]).order("created_at", { ascending: true }).limit(200);
  if (error) return NextResponse.json({ error: "Unable to load build review queue." }, { status: 500 });
  const gameIds = [...new Set((rows || []).map((r) => r.game_id))];
  const { data: games, error: gamesError } = gameIds.length ? await context.admin.from("games").select("id,title,slug,studio_id,status").in("id", gameIds) : { data: [], error: null };
  if (gamesError) return NextResponse.json({ error: "Unable to load associated game listings." }, { status: 500 });
  const studioIds = [...new Set((games || []).map((g) => g.studio_id))];
  const { data: studios, error: studiosError } = studioIds.length ? await context.admin.from("developer_studios").select("id,studio_name,verification_status").in("id", studioIds) : { data: [], error: null };
  if (studiosError) return NextResponse.json({ error: "Unable to load associated studios." }, { status: 500 });
  const gamesById = new Map((games || []).map((g) => [g.id, g]));
  const studiosById = new Map((studios || []).map((s) => [s.id, s]));
  const builds = (rows || []).map((row) => {
    const game = gamesById.get(row.game_id) || null;
    return { ...row, game, studio: game ? studiosById.get(game.studio_id) || null : null };
  });
  return NextResponse.json({ builds }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const context = await getAdmin(request);
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const buildId = input.buildId;
  const action = input.action;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!isUuid(buildId)) return NextResponse.json({ error: "A valid build ID is required." }, { status: 400 });
  if (!(["approve", "reject", "withdraw", "retry_scan"] as unknown[]).includes(action)) return NextResponse.json({ error: "Choose approve, reject, withdraw or retry_scan." }, { status: 400 });
  if (action === "reject" && (reason.length < 10 || reason.length > 1000)) return NextResponse.json({ error: "A rejection reason of 10–1,000 characters is required." }, { status: 400 });

  const { data: build, error: lookupError } = await context.admin.from("game_builds")
    .select("id,game_id,upload_status,scan_status,release_status,version_label,platform").eq("id", buildId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Unable to verify this build." }, { status: 500 });
  if (!build) return NextResponse.json({ error: "Build not found." }, { status: 404 });
  if (action === "retry_scan") {
    if (build.upload_status !== "uploaded" || build.scan_status !== "failed" || build.release_status !== "pending") {
      return NextResponse.json({ error: "Only uploaded builds with a failed scan and pending release decision can be retried." }, { status: 409 });
    }
    const { data: retried, error: retryError } = await context.admin.from("game_builds").update({
      scan_status: "quarantined", scan_started_at: null, scan_worker_id: null, scan_attempts: 0,
      scan_completed_at: null, scan_report: "Requeued for a new malware scan by Game ON moderation.", sha256_hex: null,
    }).eq("id", buildId).eq("scan_status", "failed").eq("release_status", "pending")
      .select("id,game_id,version_label,platform,scan_status,release_status").maybeSingle();
    if (retryError) return NextResponse.json({ error: "Unable to requeue this build for scanning." }, { status: 500 });
    if (!retried) return NextResponse.json({ error: "This build changed during the retry request. Refresh the queue." }, { status: 409 });
    await context.admin.from("audit_events").insert({ actor_user_id: context.userId, event_type: "game_build_scan_retried", entity_type: "game_build", entity_id: buildId, event_data: { reason: reason || null } });
    return NextResponse.json({ build: retried }, { headers: { "Cache-Control": "no-store" } });
  }
  if (build.upload_status !== "uploaded") return NextResponse.json({ error: "Only completed uploads can be release-reviewed." }, { status: 409 });
  if (action === "approve" && build.scan_status !== "clean") return NextResponse.json({ error: "A trusted scanner must mark this build clean before release approval." }, { status: 409 });
  if (action !== "withdraw" && build.release_status !== "pending") return NextResponse.json({ error: "This build has already received a release decision." }, { status: 409 });

  const releaseStatus = action === "approve" ? "approved" : action === "reject" ? "withdrawn" : "withdrawn";
  const { data: updated, error: updateError } = await context.admin.from("game_builds").update({
    release_status: releaseStatus,
    release_reviewed_at: new Date().toISOString(),
    release_reviewed_by: context.userId,
    release_note: action === "approve" ? "Approved by Game ON release moderation." : (reason || "Withdrawn by Game ON moderation."),
  }).eq("id", buildId).eq("release_status", "pending").select("id,game_id,version_label,platform,scan_status,release_status").maybeSingle();
  if (updateError) return NextResponse.json({ error: "Unable to save release decision." }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "This build changed during review. Refresh the queue." }, { status: 409 });
  const { error: auditError } = await context.admin.from("audit_events").insert({ actor_user_id: context.userId, event_type: `game_build_release_${action}`, entity_type: "game_build", entity_id: buildId, event_data: { game_id: build.game_id, version_label: build.version_label, platform: build.platform, reason: reason || null } });
  if (auditError) return NextResponse.json({ build: updated, warning: "Build decision saved, but the audit event failed." }, { status: 207 });
  return NextResponse.json({ build: updated }, { headers: { "Cache-Control": "no-store" } });
}
