import { getBrowserSupabase } from "@/modules/supabase/browser-client";

/**
 * Inicia o acesso com Google direto no projeto Supabase de produção (mesmo da
 * Vercel), onde o provedor Google já está habilitado. O retorno cai em
 * /auth/google, que troca o código por sessão e grava os cookies do servidor.
 */
export async function startGoogleSignIn(options: {
  productType?: "beauty" | "barber";
  redirect: string;
}): Promise<void> {
  const callback = new URL("/auth/google", window.location.origin);
  if (options.productType) callback.searchParams.set("produto", options.productType);
  callback.searchParams.set("redirect", options.redirect);

  const { data, error } = await getBrowserSupabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      queryParams: { prompt: "select_account" },
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) {
    throw new Error("Não foi possível iniciar o acesso com Google.");
  }
  // Em iframe (preview) o topo precisa navegar para o consentimento do Google.
  (window.top ?? window).location.assign(data.url);
}
