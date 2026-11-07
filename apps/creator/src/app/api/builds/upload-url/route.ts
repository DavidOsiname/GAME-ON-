import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiJsonError, getDeveloperContext, isUuid } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
const BUCKET = "game-build-quarantine";
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const BUCKET_MAX_BYTES = 50 * 1024 * 1024;
const EXTENSIONS: Record<string, string[]> = {
  android: ["apk", "aab"],
  windows: ["exe", "msi", "zip"],
  web: ["zip"],
};

export async function POST(request: NextRequest) {
  const context = await getDeveloperContext(request);
  if (!context.ok) return apiJsonError(context.error, context.status);
  if (process.env.GAMEON_SCANNER_ENABLED !== "true") return apiJsonError("Secure game-build scanning is not enabled. Uploads will open after the private scanner is deployed and tested.", 503);

  let body: unknown;
  try { body = await request.json(); } catch { return apiJsonError("Request body must be valid JSON.", 400); }
  if (!body || typeof body !== "object") return apiJsonError("Invalid upload request.", 400);
  const input = body as Record<string, unknown>;
  const gameId = input.gameId;
  const version = typeof input.version === "string" ? input.version.trim() : "";
  const platform = typeof input.platform === "string" ? input.platform : "";
  const fileName = typeof input.fileName === "string" ? input.fileName.trim() : "";
  const fileSize = input.fileSize;
  if (!isUuid(gameId)) return apiJsonError("Choose a valid game listing.", 400);
  if (!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/.test(version)) return apiJsonError("Version must be 1–40 characters and use letters, numbers, dots, underscores, plus signs or hyphens.", 400);
  if (!Object.prototype.hasOwnProperty.call(EXTENSIONS, platform)) return apiJsonError("Choose a supported platform.", 400);
  if (!fileName || fileName.length > 180 || /[\\/\0]/.test(fileName)) return apiJsonError("Invalid file name.", 400);
  if (typeof fileSize !== "number" || !Number.isSafeInteger(fileSize) || fileSize < 1) return apiJsonError("Invalid file size.", 400);
  const configuredMaxBytes = Number(process.env.GAMEON_MAX_BUILD_BYTES || DEFAULT_MAX_BYTES);
  if (!Number.isSafeInteger(configuredMaxBytes) || configuredMaxBytes < 1) return apiJsonError("The upload size limit is not configured correctly.", 503);
  // The database migration provisions a 50 MiB bucket. Never let an environment
  // override exceed that bucket limit; raise both together in a reviewed migration.
  const maxBytes = Math.min(configuredMaxBytes, BUCKET_MAX_BYTES);
  if (fileSize > maxBytes) return apiJsonError(`This build is larger than the current ${Math.floor(maxBytes / 1024 / 1024)} MB upload limit.`, 413);

  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  if (!EXTENSIONS[platform].includes(extension)) return apiJsonError(`The selected file type is not supported for ${platform}.`, 415);

  const { data: studio, error: studioError } = await context.admin.from("developer_studios")
    .select("id,verification_status").eq("owner_user_id", context.userId).maybeSingle();
  if (studioError) return apiJsonError("Unable to verify your developer studio.", 500);
  if (!studio) return apiJsonError("Create a developer studio before uploading a build.", 404);
  if (studio.verification_status !== "verified") return apiJsonError("Your studio must be verified before you can upload game builds.", 403);

  const { data: game, error: gameError } = await context.admin.from("games")
    .select("id,title,studio_id,status,supported_platforms").eq("id", gameId).eq("studio_id", studio.id).maybeSingle();
  if (gameError) return apiJsonError("Unable to verify this game listing.", 500);
  if (!game) return apiJsonError("Game listing not found in your studio.", 404);
  if (!["draft", "submitted", "rejected"].includes(game.status)) return apiJsonError("This listing is locked while it is under active review or already published.", 409);
  if (!(game.supported_platforms || []).includes(platform)) return apiJsonError("This platform is not declared in the game listing. Update the listing before uploading this build.", 409);

  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120);
  const objectPath = `${studio.id}/${game.id}/${randomUUID()}.${extension}`;
  const { data: signed, error: signedError } = await context.admin.storage.from(BUCKET).createSignedUploadUrl(objectPath, { upsert: false });
  if (signedError || !signed) return apiJsonError("Unable to prepare a secure upload. Check that migration 0005 has been applied and Storage is enabled.", 503);

  const { data: build, error: insertError } = await context.admin.from("game_builds").insert({
    game_id: game.id,
    version_label: version,
    platform,
    object_path: objectPath,
    file_size_bytes: fileSize,
    sha256_hex: null,
    scan_status: "quarantined",
    release_status: "pending",
    original_file_name: safeName,
    declared_content_type: "application/octet-stream",
    upload_status: "awaiting_upload",
    uploaded_by: context.userId,
  }).select("id").single();

  if (insertError || !build) {
    // The one-time URL is not returned if the metadata row cannot be recorded.
    return apiJsonError(insertError?.code === "23505" ? "That version and platform already exist for this game." : "Unable to register this build upload.", insertError?.code === "23505" ? 409 : 500);
  }

  await context.admin.from("audit_events").insert({ actor_user_id: context.userId, event_type: "game_build_upload_prepared", entity_type: "game_build", entity_id: build.id, event_data: { game_id: game.id, platform, version_label: version, file_size_bytes: fileSize } });

  return NextResponse.json({ bucket: BUCKET, path: objectPath, token: signed.token, buildId: build.id, maxBytes }, { headers: { "Cache-Control": "no-store" } });
}
