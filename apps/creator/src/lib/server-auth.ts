import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export type DeveloperContext =
  | { ok: true; admin: SupabaseClient; userId: string }
  | { ok: false; error: string; status: number };

export async function getDeveloperContext(request: NextRequest): Promise<DeveloperContext> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = (process.env.SUPABASE_SECRET_KEY || process.(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY));
  if (!url || !anonKey || !serviceKey) return { ok: false, error: "Game ON upload services are not configured.", status: 503 };
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return { ok: false, error: "Sign in to Game ON Creator first.", status: 401 };
  const verifier = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user) return { ok: false, error: "Your session is invalid or has expired. Sign in again.", status: 401 };
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { ok: true, admin, userId: data.user.id };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function apiJsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
