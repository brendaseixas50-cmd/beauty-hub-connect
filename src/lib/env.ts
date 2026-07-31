import { z } from "zod";

const publicEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

export const publicEnv = publicEnvSchema.parse({
  VITE_SUPABASE_URL: import.meta.env["VITE_SUPABASE_URL"],
  VITE_SUPABASE_ANON_KEY: import.meta.env["VITE_SUPABASE_ANON_KEY"],
});

export const isSupabaseConfigured = Boolean(
  publicEnv.VITE_SUPABASE_URL && publicEnv.VITE_SUPABASE_ANON_KEY,
);
