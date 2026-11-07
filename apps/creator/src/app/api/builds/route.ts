import { NextRequest, NextResponse } from "next/server";
import { apiJsonError, getDeveloperContext } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = await getDeveloperContext(request);
  if (!context.ok) return apiJsonError(context.error, context.status);
  const { data: studio, error: studioError } = await context.admin.from("developer_studios").select("id").eq("owner_user_id", context.userId).maybeSingle();
  if (studioError) return apiJsonError("Unable to load studio.", 500);
  if (!studio) return apiJsonError("Developer studio not found.", 404);
  const { data: games, error: gamesError } = await context.admin.from("games").select("id,title").eq("studio_id", studio.id);
  if (gamesError) return apiJsonError("Unable to load your games.", 500);
  const gameIds = (games || []).map((game) => game.id);
  if (!gameIds.length) return NextResponse.json({ builds: [] }, { headers: { "Cache-Control": "no-store" } });
  const { data: builds, error: buildsError } = await context.admin.from("game_builds")
    .select("id,game_id,version_label,platform,file_size_bytes,scan_status,release_status,upload_status,original_file_name,created_at,uploaded_at,scan_completed_at,scan_report")
    .in("game_id", gameIds).order("created_at", { ascending: false }).limit(100);
  if (buildsError) return apiJsonError("Unable to load your build history.", 500);
  const gameById = new Map((games || []).map((game) => [game.id, game.title]));
  return NextResponse.json({ builds: (builds || []).map((build) => ({ ...build, game_title: gameById.get(build.game_id) || "Unknown game" })) }, { headers: { "Cache-Control": "no-store" } });
}
