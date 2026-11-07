import { createClient } from "@supabase/supabase-js";

// These are public client settings, not secrets. RLS controls all client access.
// Environment variables override the staging defaults for other deployments.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://viwczhmthlyagqwcrgrt.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_U5kiDPYsfyUje8HvkDABKw_4cBW8SCO";

export const supabase = url && anonKey ? createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
export const isSupabaseConfigured = Boolean(supabase);
