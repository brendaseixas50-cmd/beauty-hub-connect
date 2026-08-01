import { z } from "zod";

const publicEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_"),
});

export const publicEnv = publicEnvSchema.parse({
  VITE_SUPABASE_URL: import.meta.env["VITE_SUPABASE_URL"],
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
});

export const isSupabaseConfigured = true;
