import { NextResponse } from "next/server";
import { checkReadiness } from "@/lib/readiness.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkReadiness(process.env, fetch, 5_000, ["GAMEON_ADMIN_USER_IDS", "GAMEON_SCANNER_WEBHOOK_SECRET"]);
  return NextResponse.json(
    { service: "game-on-creator", status: result.ready ? "ready" : "not_ready" },
    {
      status: result.ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Retry-After": result.ready ? "0" : "30",
      },
    },
  );
}
