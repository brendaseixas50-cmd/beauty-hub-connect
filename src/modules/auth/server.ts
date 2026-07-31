import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import { getPermissionsForRole, type Session } from "./domain";

const SESSION_COOKIE = "beauty_hub_session";
const DEMO_SESSION_TOKEN = "beauty-hub-demo-owner";

// Temporary adapter used until Supabase Auth is connected. The route contract
// remains the same when the implementation is replaced by Supabase.
const demoSession: Session = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    tenantId: "00000000-0000-4000-8000-000000000101",
    email: "demo@beautyhub.local",
    name: "Profissional Demo",
    role: "owner",
    permissions: getPermissionsForRole("owner"),
  },
  expiresAt: "2099-12-31T23:59:59.999Z",
};

export const getSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<Session | null> => {
    return getCookie(SESSION_COOKIE) === DEMO_SESSION_TOKEN ? demoSession : null;
  },
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const login = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }): Promise<Session> => {
    if (data.email !== "demo@beautyhub.local" || data.password !== "demo123") {
      throw new Error("E-mail ou senha inválidos.");
    }

    setCookie(SESSION_COOKIE, DEMO_SESSION_TOKEN, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return demoSession;
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(SESSION_COOKIE, { path: "/" });
  return { success: true } as const;
});
