import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/server-env";
import type { Database } from "./database.types";

export function createSupabaseAdminClient() {
  return createClient<Database>(publicEnv.VITE_SUPABASE_URL, getServerEnv().SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
