import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";

import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

function normalizeSameSite(
  sameSite: CookieOptions["sameSite"],
): "lax" | "strict" | "none" | undefined {
  if (sameSite === true) return "strict";
  if (sameSite === false) return undefined;
  return sameSite;
}

export function createSupabaseServerClient() {
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
            if (options.expires !== undefined) normalizedOptions.expires = options.expires;
            if (options.maxAge !== undefined) normalizedOptions.maxAge = options.maxAge;
            setCookie(name, value, normalizedOptions);
          }
        },
      },
    },
  );
}
