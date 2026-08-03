import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  SIGNUP_RATE_LIMIT_SECRET: z.string().min(32),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_SECRET_KEY: process.env["SUPABASE_SECRET_KEY"],
    SIGNUP_RATE_LIMIT_SECRET: process.env["SIGNUP_RATE_LIMIT_SECRET"],
  });
}
