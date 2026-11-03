import { NextRequest, NextResponse } from "next/server";
import { apiJsonError, getDeveloperContext, isUuid } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
const BUCKET = "game-build-quarantine";

export async function POST(request: NextRequest) {
  const context = await getDeveloperContext(request);
  if (!context.ok) return apiJsonError(context.error, context.status);
  let body: unknown;
  try { body = await request.json(); } catch { return apiJsonError("Request body must be valid JSON.", 400); }
  const buildId = body && typeof body === "object" ? (body as Record<string, unknown>).buildId : null;
  if (!isUuid(buildId)) return apiJsonError("A valid build ID is required.", 400);

  const { data: build, error: buildError } = await context.admin.from("game_builds")
    .select("id,game_id,object_path,file_size_bytes,upload_status,version_label,platform")
    .eq("id", buildId).maybeSingle();
  if (buildError) return apiJsonError("Unable to verify the build upload.", 500);
  if (!build) return apiJsonError("Build upload not found.", 404);
  if (build.upload_status === "uploaded") return NextResponse.json({ buildId, status: "uploaded", message: "This build was already finalized." }, { headers: { "Cache-Control": "no-store" } });
  if (build.upload_status !== "awaiting_upload") return apiJsonError("This upload can no longer be finalized.", 409);

  const { data: game, error: gameError } = await context.admin.from("games").select("id,studio_id").eq("id", build.game_id).maybeSingle();
  if (gameError) return apiJsonError("Unable to verify game ownership.", 500);
  if (!game) return apiJsonError("Game listing no longer exists.", 404);
  const { data: studio, error: studioError } = await context.admin.from("developer_studios").select("id,owner_user_id").eq("id", game.studio_id).maybeSingle();
  if (studioError) return apiJsonError("Unable to verify studio ownership.", 500);
  if (!studio || studio.owner_user_id !== context.userId) return apiJsonError("You do not own this build.", 403);

  const { data: fileInfo, error: infoError } = await context.admin.storage.from(BUCKET).info(build.object_path);
  if (infoError || !fileInfo) return apiJsonError("The file has not arrived in quarantine storage yet. Retry after the upload finishes.", 409);
  const actualSize = Number(fileInfo.size);
  if (!Number.isSafeInteger(actualSize) || actualSize !== Number(build.file_size_bytes)) {
    const { error: failError } = await context.admin.from("game_builds").update({
      upload_status: "failed", scan_status: "failed", scan_report: "Uploaded file size did not match the declared size.",
    }).eq("id", build.id).eq("upload_status", "awaiting_upload");
    // A size-mismatched object must never remain available for a later release.
    const { error: cleanupError } = await context.admin.storage.from(BUCKET).remove([build.object_path]);
    if (failError) return apiJsonError("The file size did not match and the build could not be safely closed. Contact Game ON support.", 500);
    if (cleanupError) return apiJsonError("The uploaded file size did not match. The build is blocked, but private quarantine cleanup needs operator attention.", 422);
    return apiJsonError("The uploaded file size did not match the upload request. The build was blocked and the quarantined object was removed.", 422);
  }

  const { data: finalized, error: updateError } = await context.admin.from("game_builds").update({
    upload_status: "uploaded", uploaded_at: new Date().toISOString(), scan_status: "quarantined", release_status: "pending",
  }).eq("id", build.id).eq("upload_status", "awaiting_upload").select("id").maybeSingle();
  if (updateError) return apiJsonError("The upload arrived, but its metadata could not be finalized. Contact Game ON support.", 500);
  if (!finalized) return apiJsonError("This upload was already finalized or changed. Refresh the build history before retrying.", 409);
  await context.admin.from("audit_events").insert({ actor_user_id: context.userId, event_type: "game_build_uploaded_quarantined", entity_type: "game_build", entity_id: build.id, event_data: { game_id: build.game_id, file_size_bytes: actualSize, platform: build.platform, version_label: build.version_label } });

  return NextResponse.json({ buildId, status: "quarantined", message: "Upload received. The file remains private until a trusted malware scanner and Game ON release review both approve it." }, { headers: { "Cache-Control": "no-store" } });
}
