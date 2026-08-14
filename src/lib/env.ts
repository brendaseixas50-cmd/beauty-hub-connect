/**
 * Backend de produção (o mesmo já usado pela versão publicada na Vercel).
 *
 * Estes valores são fixos de propósito: o app publicado no Lovable deve apontar
 * para ESTE projeto Supabase já em produção — com empresas, usuários,
 * profissionais, clientes, agenda e configurações existentes — e não para o
 * banco criado automaticamente pelo ambiente. A chave é publicável (anon), por
 * isso pode ficar no código.
 */
export const SUPABASE_URL = "https://vctmjgezsdfwblemrjav.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_DdzRB5DSvp73mnDbdLfraw_wm87F8p0";

export const publicEnv = {
  VITE_SUPABASE_URL: SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY,
} as const;

export const isSupabaseConfigured = true;
