import { NextResponse } from "next/server";
import { checkReadiness } from "@/lib/readiness.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkReadiness();
  return NextResponse.json(
    { service: "game-on-store", status: result.ready ? "ready" : "not_ready" },
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
