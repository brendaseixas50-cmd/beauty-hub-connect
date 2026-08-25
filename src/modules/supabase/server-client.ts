import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getCookies, getRequest, setCookie } from "@tanstack/react-start/server";

import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

function normalizeSameSite(
  sameSite: CookieOptions["sameSite"],
): "lax" | "strict" | "none" | undefined {
  if (sameSite === true) return "strict";
  if (sameSite === false) return undefined;
  return sameSite;
}

/**
 * Um cliente por requisição: assim a sessão trocada no callback do Google já fica
 * visível para as validações seguintes da mesma requisição (sem exigir 2º clique).
 */
const perRequest = new WeakMap<Request, ReturnType<typeof buildSupabaseServerClient>>();

/**
 * Duração dos cookies de sessão:
 * - `days`: mantém conectado por esse período (checkbox "Manter conectado").
 * - `null`: cookie de sessão, encerrado ao fechar o navegador.
 * - `undefined`: mantém o comportamento padrão do Supabase.
 */
export type SessionPersistence = { days: number } | null | undefined;

export function createSupabaseServerClient(persistence?: SessionPersistence) {
  let request: Request | undefined;
  try {
    request = getRequest();
  } catch {
    request = undefined;
  }
  if (!request) return buildSupabaseServerClient(persistence);
  const existing = perRequest.get(request);
  if (existing && persistence === undefined) return existing;
  const client = buildSupabaseServerClient(persistence);
  perRequest.set(request, client);
  return client;
}

function buildSupabaseServerClient(persistence?: SessionPersistence) {
  const requestCookies = new Map(Object.entries(getCookies()));

  return createServerClient<Database>(
    publicEnv.VITE_SUPABASE_URL,
    publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return Array.from(requestCookies, ([name, value]) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            requestCookies.set(name, value);
            const normalizedOptions: NonNullable<Parameters<typeof setCookie>[2]> = {
              httpOnly: true,
              path: options.path ?? "/",
              sameSite: normalizeSameSite(options.sameSite) ?? "lax",
              secure: options.secure ?? process.env["NODE_ENV"] === "production",
            };
            if (options.domain !== undefined) normalizedOptions.domain = options.domain;
            if (persistence === null) {
              // Cookie de sessão: expira quando o navegador é fechado.
            } else if (persistence) {
              normalizedOptions.maxAge = persistence.days * 24 * 60 * 60;
            } else {
              if (options.expires !== undefined) normalizedOptions.expires = options.expires;
              if (options.maxAge !== undefined) normalizedOptions.maxAge = options.maxAge;
            }
            setCookie(name, value, normalizedOptions);
          }
        },
      },
    },
  );
}
