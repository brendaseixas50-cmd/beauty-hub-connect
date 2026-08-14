import { createClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente do navegador apontando para o backend de produção (mesmo da Vercel).
 * Usado para iniciar o acesso com Google e concluir a troca do código PKCE;
 * a sessão definitiva do app continua nos cookies httpOnly do servidor.
 */
function build() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      flowType: "pkce",
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: typeof window !== "undefined",
      autoRefreshToken: typeof window !== "undefined",
      detectSessionInUrl: false,
    },
  });
}

let client: ReturnType<typeof build> | undefined;

export function getBrowserSupabase() {
  if (!client) client = build();
  return client;
}
