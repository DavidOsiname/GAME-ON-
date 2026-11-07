import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { service: "game-on-store", status: "ok", timestamp: new Date().toISOString() },
    { status: 200, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}
