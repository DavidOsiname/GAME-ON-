import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isUuid } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

function safeSecretEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const expected = process.env.GAMEON_SCANNER_WEBHOOK_SECRET || "";
  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!expected || !supplied || !safeSecretEqual(expected, supplied)) {
    return NextResponse.json({ error: "Scanner authentication failed." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceKey) return NextResponse.json({ error: "Scanner storage is not configured." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const buildId = input.buildId;
  const workerId = input.workerId;
  const result = input.result;
  const sha256 = typeof input.sha256 === "string" ? input.sha256.toLowerCase() : "";
  const report = typeof input.report === "string" ? input.report.trim().slice(0, 2000) : "";
  if (!isUuid(buildId)) return NextResponse.json({ error: "A valid buildId is required." }, { status: 400 });
  if (!isUuid(workerId)) return NextResponse.json({ error: "A valid workerId lease is required." }, { status: 400 });
  if (result !== "clean" && result !== "rejected") return NextResponse.json({ error: "result must be clean or rejected." }, { status: 400 });
  if (!/^[a-f0-9]{64}$/.test(sha256)) return NextResponse.json({ error: "A SHA-256 hex digest is required." }, { status: 400 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: build, error: lookupError } = await admin.from("game_builds").select("id,game_id,upload_status,scan_status,scan_worker_id").eq("id", buildId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Unable to load build record." }, { status: 500 });
  if (!build) return NextResponse.json({ error: "Build not found." }, { status: 404 });
  if (build.upload_status !== "uploaded" || build.scan_status !== "scanning" || build.scan_worker_id !== workerId) {
    return NextResponse.json({ error: "This scanner lease is no longer active. The job may have been reclaimed." }, { status: 409 });
  }
  const scanStatus = result === "clean" ? "clean" : "rejected";
  const { data: updated, error: updateError } = await admin.from("game_builds").update({
    scan_status: scanStatus,
    sha256_hex: sha256,
    scan_completed_at: new Date().toISOString(),
    scan_started_at: null,
    scan_worker_id: null,
    scan_report: report || (scanStatus === "clean" ? "No threats detected by the configured scanner." : "Rejected by the configured scanner."),
  }).eq("id", buildId).eq("upload_status", "uploaded").eq("scan_status", "scanning").eq("scan_worker_id", workerId).select("id,scan_status,release_status").maybeSingle();
  if (updateError) return NextResponse.json({ error: "Unable to save the scanner result." }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "The build changed while scanning. Refresh and retry." }, { status: 409 });
  await admin.from("audit_events").insert({ actor_user_id: null, event_type: `game_build_scan_${scanStatus}`, entity_type: "game_build", entity_id: buildId, event_data: { sha256, report: report || null, source: "clamav_scanner_worker", worker_id: workerId } });
  return NextResponse.json({ build: updated }, { headers: { "Cache-Control": "no-store" } });
}
