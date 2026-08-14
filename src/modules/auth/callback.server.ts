import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/modules/supabase/database.types";
import { authErrorMessage, resolveSession } from "./session.server";

const otpTypes = new Set(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

type Destination = "/painel" | "/onboarding" | "/redefinir-senha";

/**
 * O callback do Google/e-mail é resolvido inteiramente nesta requisição e responde um 302
 * com os cookies de sessão anexados de forma explícita. Assim o navegador chega ao painel
 * já autenticado — sem depender de um segundo clique em "Entrar".
 */
export async function handleAuthCallbackRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  const type = rawType && otpTypes.has(rawType) ? (rawType as EmailOtpType) : undefined;
  const produto = url.searchParams.get("produto");
  const productType = produto === "barber" ? "barber" : produto === "beauty" ? "beauty" : undefined;
  const nextParam = url.searchParams.get("next");
  const next: Destination =
    nextParam === "/redefinir-senha"
      ? "/redefinir-senha"
      : nextParam === "/onboarding"
        ? "/onboarding"
        : "/painel";

  const cookieHeaders: string[] = [];
  const jar = new Map(
    parseCookieHeader(request.headers.get("cookie") ?? "").map(
      (cookie) => [cookie.name, cookie.value ?? ""] as const,
    ),
  );

  const supabase = createServerClient<Database>(
    publicEnv.VITE_SUPABASE_URL,
    publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return Array.from(jar, ([name, value]) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            jar.set(name, value);
            cookieHeaders.push(
              serializeCookieHeader(name, value, {
                ...options,
                httpOnly: true,
                path: options.path ?? "/",
                sameSite: "lax",
                secure: url.protocol === "https:",
              }),
            );
          }
        },
      },
    },
  );

  function respond(location: string): Response {
    const headers = new Headers({ location, "cache-control": "no-store" });
    for (const cookie of cookieHeaders) headers.append("set-cookie", cookie);
    return new Response(null, { status: 302, headers });
  }

  function backToLogin(message: string): Response {
    const target = new URL("/login", url.origin);
    target.searchParams.set("redirect", "/painel");
    target.searchParams.set("message", message.slice(0, 240));
    if (productType) target.searchParams.set("produto", productType);
    return respond(target.toString());
  }

  const errorDescription = url.searchParams.get("error_description");
  if (errorDescription) {
    return backToLogin("O link expirou ou não é mais válido. Solicite um novo acesso.");
  }
  if (!code && !(tokenHash && type)) {
    return backToLogin("Link de confirmação inválido. Solicite um novo acesso.");
  }

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });

  if (result.error) {
    return backToLogin(authErrorMessage(result.error, "O link expirou ou já foi utilizado."));
  }

  // Seleciona/prepara a empresa do produto que originou o acesso, ainda nesta requisição.
  if (productType && result.data.user && result.data.session) {
    const known = { user: result.data.user, session: result.data.session };
    try {
      const session = await resolveSession(supabase, known);
      const company = session?.user.companies.find((item) => item.productType === productType);
      if (company) {
        if (company.tenantId !== session?.user.tenantId) {
          const { error } = await supabase.rpc("switch_active_tenant", {
            target_tenant_id: company.tenantId,
          });
          if (error) return backToLogin("Não foi possível abrir o produto escolhido.");
        }
      } else {
        const { error } = await supabase.rpc("create_company_for_current_user", {
          company_name: productType === "barber" ? "Minha barbearia" : "Meu negócio de beleza",
          selected_product: productType,
        });
        if (error) return backToLogin("Não foi possível preparar o produto escolhido.");
      }
    } catch {
      return backToLogin("Não foi possível abrir o painel após o acesso com Google.");
    }
  }

  return respond(new URL(next, url.origin).toString());
}
