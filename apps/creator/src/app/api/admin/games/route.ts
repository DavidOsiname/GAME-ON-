import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AdminContext =
  | { ok: true; admin: ReturnType<typeof createClient<any>>; user: { id: string } }
  | { ok: false; error: string; status: number };

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function getAdminClients(request: NextRequest): Promise<AdminContext> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const allowedIds = (process.env.GAMEON_ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);

  if (!url || !anonKey || !serviceKey) {
    return { ok: false, error: "Admin services are not configured on this deployment.", status: 503 };
  }
  if (!allowedIds.length) {
    return { ok: false, error: "No Game ON administrators have been configured.", status: 503 };
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return { ok: false, error: "Sign in with an authorised Game ON administrator account.", status: 401 };

  const verifier = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user) return { ok: false, error: "Your session is invalid or has expired. Sign in again.", status: 401 };
  if (!allowedIds.includes(data.user.id)) return { ok: false, error: "This account is not authorised to moderate Game ON listings.", status: 403 };

  const admin = createClient<any>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { ok: true, admin, user: { id: data.user.id } };
}

export async function GET(request: NextRequest) {
  const context = await getAdminClients(request);
  if (!context.ok) return jsonError(context.error, context.status);

  const { data: games, error } = await context.admin
    .from("games")
    .select("id,title,slug,genre,short_description,description,supported_platforms,monetization_type,offline_support,contains_ads,has_in_app_purchases,status,rejection_reason,created_at,updated_at,studio_id,reviewed_at,moderation_note")
    .in("status", ["submitted", "in_review"])
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return jsonError("Unable to load moderation queue.", 500);

  const { data: reviews, error: reviewsError } = await context.admin
    .from("reviews")
    .select("id,user_id,game_id,rating,review_text,created_at,moderation_status")
    .eq("moderation_status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);
  if (reviewsError) return jsonError("Unable to load player review queue.", 500);

  const reviewRows = (reviews || []) as Array<{ id: string; user_id: string; game_id: string; rating: number; review_text: string | null; created_at: string; moderation_status: string }>;
  const reviewGameIds = [...new Set(reviewRows.map((review) => review.game_id))];
  const reviewUserIds = [...new Set(reviewRows.map((review) => review.user_id))];
  const [{ data: reviewGames, error: reviewGamesError }, { data: reviewProfiles, error: reviewProfilesError }] = await Promise.all([
    reviewGameIds.length ? context.admin.from("games").select("id,title,slug").in("id", reviewGameIds) : Promise.resolve({ data: [], error: null }),
    reviewUserIds.length ? context.admin.from("profiles").select("id,username,display_name").in("id", reviewUserIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (reviewGamesError || reviewProfilesError) return jsonError("Unable to load player review details.", 500);
  const reviewGameRows = (reviewGames || []) as Array<{ id: string; title: string; slug: string }>;
  const reviewProfileRows = (reviewProfiles || []) as Array<{ id: string; username: string | null; display_name: string | null }>;
  const gameById = new Map(reviewGameRows.map((game) => [game.id, game]));
  const profileById = new Map(reviewProfileRows.map((profile) => [profile.id, profile]));
  const reviewResult = reviewRows.map((review) => ({ ...review, game: gameById.get(review.game_id) || null, player: profileById.get(review.user_id) || null }));

  const { data: studios, error: studioError } = await context.admin
    .from("developer_studios")
    .select("id,studio_name,slug,verification_status,description,website_url,created_at,verification_note")
    .in("verification_status", ["pending", "rejected"])
    .order("created_at", { ascending: true })
    .limit(100);
  if (studioError) return jsonError("Unable to load studio verification queue.", 500);

  const { data: reports, error: reportError } = await context.admin
    .from("game_reports")
    .select("id,reporter_user_id,game_id,category,details,status,created_at")
    .in("status", ["pending", "in_review"])
    .order("created_at", { ascending: true })
    .limit(100);
  if (reportError) return jsonError("Unable to load player reports.", 500);
  const reportRows = (reports || []) as Array<{ id: string; reporter_user_id: string; game_id: string; category: string; details: string; status: string; created_at: string }>;
  const reportGameIds = [...new Set(reportRows.map((report) => report.game_id))];
  const reportUserIds = [...new Set(reportRows.map((report) => report.reporter_user_id))];
  const [{ data: reportGames, error: reportGamesError }, { data: reportProfiles, error: reportProfilesError }] = await Promise.all([
    reportGameIds.length ? context.admin.from("games").select("id,title,slug").in("id", reportGameIds) : Promise.resolve({ data: [], error: null }),
    reportUserIds.length ? context.admin.from("profiles").select("id,username,display_name").in("id", reportUserIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (reportGamesError || reportProfilesError) return jsonError("Unable to load player report details.", 500);
  const reportGameRows = (reportGames || []) as Array<{ id: string; title: string; slug: string }>;
  const reportProfileRows = (reportProfiles || []) as Array<{ id: string; username: string | null; display_name: string | null }>;
  const reportGameById = new Map(reportGameRows.map((game) => [game.id, game]));
  const reportProfileById = new Map(reportProfileRows.map((profile) => [profile.id, profile]));
  const reportResult = reportRows.map((report) => ({ ...report, game: reportGameById.get(report.game_id) || null, player: reportProfileById.get(report.reporter_user_id) || null }));

  const gameRows = (games || []) as Array<Record<string, unknown> & { id: string; studio_id: string; title: string; slug: string; status: string }>;
  const studioIds = [...new Set(gameRows.map((game) => game.studio_id))];
  const { data: relatedStudios, error: relatedStudioError } = studioIds.length
    ? await context.admin.from("developer_studios").select("id,studio_name,slug,verification_status").in("id", studioIds)
    : { data: [], error: null };
  if (relatedStudioError) return jsonError("Unable to load game studio details.", 500);

  const relatedStudioRows = (relatedStudios || []) as Array<{ id: string; studio_name: string; slug: string; verification_status: string }>;
  const studioById = new Map(relatedStudioRows.map((studio) => [studio.id, studio]));
  const result = gameRows.map((game) => ({ ...game, studio: studioById.get(game.studio_id) || null }));
  return NextResponse.json({ games: result, studios: studios || [], reviews: reviewResult, reports: reportResult }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const context = await getAdminClients(request);
  if (!context.ok) return jsonError(context.error, context.status);

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Request body must be valid JSON.", 400); }
  if (!body || typeof body !== "object") return jsonError("Invalid request body.", 400);
  const { entityType = "game", entityId, gameId, action, reason } = body as { entityType?: unknown; entityId?: unknown; gameId?: unknown; action?: unknown; reason?: unknown };
  const recordId = typeof entityId === "string" ? entityId : gameId;
  if (typeof recordId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recordId)) {
    return jsonError("A valid record ID is required.", 400);
  }
  const cleanReason = typeof reason === "string" ? reason.trim() : "";

  if (entityType === "report") {
    if (action !== "start_review" && action !== "resolve" && action !== "dismiss") return jsonError("Choose start_review, resolve or dismiss for a report.", 400);
    if (action === "dismiss" && (cleanReason.length < 10 || cleanReason.length > 1000)) return jsonError("A dismissal reason of 10 to 1,000 characters is required.", 400);
    const { data: existingReport, error: reportLookupError } = await context.admin.from("game_reports").select("id,status,game_id,category,reporter_user_id").eq("id", recordId).maybeSingle();
    if (reportLookupError) return jsonError("Unable to verify this player report.", 500);
    if (!existingReport) return jsonError("Player report not found.", 404);
    if (!['pending', 'in_review'].includes(existingReport.status)) return jsonError("Only pending or in-review reports can be moderated.", 409);
    const nextStatus = action === "start_review" ? "in_review" : action === "resolve" ? "resolved" : "dismissed";
    const now = new Date().toISOString();
    const { data: updatedReport, error: reportUpdateError } = await context.admin.from("game_reports")
      .update({ status: nextStatus, reviewed_at: action === "start_review" ? null : now, reviewed_by: action === "start_review" ? null : context.user.id, moderator_note: action === "dismiss" ? cleanReason : action === "resolve" ? (cleanReason || "Action taken by Game ON moderation.") : null, updated_at: now })
      .eq("id", recordId).in("status", ["pending", "in_review"])
      .select("id,status,moderator_note").maybeSingle();
    if (reportUpdateError) return jsonError("Player report moderation could not be saved.", 500);
    if (!updatedReport) return jsonError("This report changed while you were reviewing it. Refresh the queue.", 409);
    const { error: reportAuditError } = await context.admin.from("audit_events").insert({ actor_user_id: context.user.id, event_type: `game_report_${action}`, entity_type: "game_report", entity_id: recordId, event_data: { previous_status: existingReport.status, new_status: nextStatus, game_id: existingReport.game_id, category: existingReport.category, reason: cleanReason || null } });
    if (reportAuditError) return NextResponse.json({ report: updatedReport, warning: "The report was updated, but its audit event could not be recorded." }, { status: 207, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ report: updatedReport }, { headers: { "Cache-Control": "no-store" } });
  }

  if (entityType === "review") {
    if (action !== "approve" && action !== "reject") return jsonError("Choose approve or reject for a review.", 400);
    if (action === "reject" && (cleanReason.length < 10 || cleanReason.length > 1000)) return jsonError("A rejection reason of 10 to 1,000 characters is required.", 400);
    const { data: existingReview, error: reviewLookupError } = await context.admin.from("reviews").select("id,rating,moderation_status,game_id,user_id").eq("id", recordId).maybeSingle();
    if (reviewLookupError) return jsonError("Unable to verify this player review.", 500);
    if (!existingReview) return jsonError("Review not found.", 404);
    if (existingReview.moderation_status !== "pending") return jsonError("Only pending reviews can be moderated.", 409);
    const nextModeration = action === "approve" ? "approved" : "rejected";
    const now = new Date().toISOString();
    const { data: updatedReview, error: reviewUpdateError } = await context.admin.from("reviews")
      .update({ moderation_status: nextModeration, moderated_at: now, moderated_by: context.user.id, moderation_note: action === "reject" ? cleanReason : null, updated_at: now })
      .eq("id", recordId).eq("moderation_status", "pending")
      .select("id,rating,moderation_status,moderation_note").maybeSingle();
    if (reviewUpdateError) return jsonError("Review moderation could not be saved.", 500);
    if (!updatedReview) return jsonError("This review changed while you were reviewing it. Refresh the queue.", 409);
    const { error: reviewAuditError } = await context.admin.from("audit_events").insert({ actor_user_id: context.user.id, event_type: `review_${action}`, entity_type: "review", entity_id: recordId, event_data: { previous_status: existingReview.moderation_status, new_status: nextModeration, game_id: existingReview.game_id, reason: cleanReason || null } });
    if (reviewAuditError) return NextResponse.json({ review: updatedReview, warning: "The review was updated, but its audit event could not be recorded." }, { status: 207, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ review: updatedReview }, { headers: { "Cache-Control": "no-store" } });
  }

  if (entityType === "studio") {
    if (action !== "verify" && action !== "reject") return jsonError("Choose verify or reject for a studio.", 400);
    if (action === "reject" && (cleanReason.length < 10 || cleanReason.length > 1000)) return jsonError("A reason of 10 to 1,000 characters is required.", 400);
    const { data: existingStudio, error: studioLookupError } = await context.admin.from("developer_studios").select("id,studio_name,verification_status").eq("id", recordId).maybeSingle();
    if (studioLookupError) return jsonError("Unable to verify this studio.", 500);
    if (!existingStudio) return jsonError("Studio not found.", 404);
    if (!["pending", "rejected"].includes(existingStudio.verification_status)) return jsonError("Only pending or rejected studios can be reviewed.", 409);
    const nextVerification = action === "verify" ? "verified" : "rejected";
    const now = new Date().toISOString();
    const { data: updatedStudio, error: studioUpdateError } = await context.admin.from("developer_studios")
      .update({ verification_status: nextVerification, verification_reviewed_at: now, verification_reviewed_by: context.user.id, verification_note: action === "verify" ? null : cleanReason, updated_at: now })
      .eq("id", recordId).in("verification_status", ["pending", "rejected"])
      .select("id,studio_name,verification_status,verification_note").maybeSingle();
    if (studioUpdateError) return jsonError("Studio verification could not be saved.", 500);
    if (!updatedStudio) return jsonError("This studio changed while you were reviewing it. Refresh the queue.", 409);
    const { error: studioAuditError } = await context.admin.from("audit_events").insert({ actor_user_id: context.user.id, event_type: `studio_${action}`, entity_type: "studio", entity_id: recordId, event_data: { previous_status: existingStudio.verification_status, new_status: nextVerification, reason: cleanReason || null } });
    if (studioAuditError) return NextResponse.json({ studio: updatedStudio, warning: "Studio status was updated, but its audit event could not be recorded." }, { status: 207, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ studio: updatedStudio }, { headers: { "Cache-Control": "no-store" } });
  }

  if (entityType !== "game") return jsonError("entityType must be game, studio, review or report.", 400);
  if (action !== "start_review" && action !== "approve" && action !== "reject") return jsonError("Choose start_review, approve or reject for a game.", 400);
  if (action === "reject" && (cleanReason.length < 10 || cleanReason.length > 1000)) return jsonError("A rejection reason of 10 to 1,000 characters is required.", 400);

  const { data: existing, error: lookupError } = await context.admin
    .from("games")
    .select("id,status,title,studio_id")
    .eq("id", recordId)
    .maybeSingle();
  if (lookupError) return jsonError("Unable to verify this listing.", 500);
  if (!existing) return jsonError("Game listing not found.", 404);
  if (!["submitted", "in_review"].includes(existing.status)) {
    return jsonError("Only submitted or in-review listings can be moderated.", 409);
  }
  if (action === "approve") {
    const { data: studioForApproval, error: approvalStudioError } = await context.admin.from("developer_studios").select("verification_status").eq("id", existing.studio_id).maybeSingle();
    if (approvalStudioError) return jsonError("Unable to verify the developer studio.", 500);
    if (studioForApproval?.verification_status !== "verified") return jsonError("Verify the developer studio before publishing its games.", 409);
    const { data: releasableBuild, error: buildApprovalError } = await context.admin.from("game_builds")
      .select("id").eq("game_id", existing.id).eq("upload_status", "uploaded").eq("scan_status", "clean").eq("release_status", "approved").limit(1).maybeSingle();
    if (buildApprovalError) return jsonError("Unable to verify the game's approved build.", 500);
    if (!releasableBuild) return jsonError("This game cannot be published yet. It needs at least one uploaded build that has passed a trusted malware scan and received Game ON release approval.", 409);
  }

  const nextStatus = action === "start_review" ? "in_review" : action === "approve" ? "published" : "rejected";
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: nextStatus,
    updated_at: now,
    reviewed_at: action === "start_review" ? null : now,
    reviewed_by: action === "start_review" ? null : context.user.id,
    moderation_note: action === "reject" ? cleanReason : null,
    rejection_reason: action === "reject" ? cleanReason : null,
  };

  const { data: updated, error: updateError } = await context.admin
    .from("games")
    .update(update)
    .eq("id", recordId)
    .in("status", ["submitted", "in_review"])
    .select("id,title,status,reviewed_at,moderation_note,rejection_reason")
    .maybeSingle();
  if (updateError) return jsonError("The moderation action could not be saved.", 500);
  if (!updated) return jsonError("This listing changed while you were reviewing it. Refresh the queue.", 409);

  const { error: auditError } = await context.admin.from("audit_events").insert({
    actor_user_id: context.user.id,
    event_type: `game_${action}`,
    entity_type: "game",
    entity_id: recordId,
    event_data: { previous_status: existing.status, new_status: nextStatus, reason: action === "reject" ? cleanReason : null },
  });
  if (auditError) {
    // The moderation state is already saved. Surface an audit warning rather than pretending it was rolled back.
    return NextResponse.json({ game: updated, warning: "The listing was updated, but the audit event could not be recorded. Contact the platform operator." }, { status: 207, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ game: updated }, { headers: { "Cache-Control": "no-store" } });
}
