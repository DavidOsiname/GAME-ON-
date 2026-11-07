import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// These are public client settings, not secrets. RLS controls all client access.
// Environment variables override the staging defaults for other deployments.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://viwczhmthlyagqwcrgrt.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_U5kiDPYsfyUje8HvkDABKw_4cBW8SCO";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    })
  : null;
