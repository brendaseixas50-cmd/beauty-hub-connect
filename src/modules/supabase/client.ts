import { publicEnv } from "@/lib/env";

export interface SupabaseConfiguration {
  url: string;
  anonKey: string;
}

/**
 * Configuration boundary for the future Supabase adapter. No network client
 * is created in this version, keeping the demo independent from a real bank.
 */
export function getSupabaseConfiguration(): SupabaseConfiguration | null {
  if (!publicEnv.VITE_SUPABASE_URL || !publicEnv.VITE_SUPABASE_ANON_KEY) return null;
  return {
    url: publicEnv.VITE_SUPABASE_URL,
    anonKey: publicEnv.VITE_SUPABASE_ANON_KEY,
  };
}
