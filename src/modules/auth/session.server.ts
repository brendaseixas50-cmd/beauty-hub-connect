import {
  type AuthError,
  type Session as SupabaseAuthSession,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/modules/supabase/server-client";
import type { Database } from "@/modules/supabase/database.types";
import { resolveBetaAccess } from "./beta-access";
import {
  getPermissionsForRole,
  roles,
  selectActiveCompany,
  type BetaAccessStatus,
  type CompanyAccess,
  type Role,
  type Session,
} from "./domain";

const platformAccessSchema = z.object({
  isAdministrator: z.boolean().default(false),
  grants: z
    .array(
      z.object({
        productType: z.enum(["beauty", "barber"]),
        accessType: z.enum(["administrator", "courtesy", "beta_tester"]),
        status: z.enum(["active", "suspended", "revoked", "expired"]),
        startsAt: z.string(),
        expiresAt: z.string().nullable(),
      }),
    )
    .default([]),
});

export const sessionBootstrapSchema = z.object({
  profileName: z.string(),
  activeTenantId: z.string().uuid().nullable(),
  companies: z.array(
    z.object({
      tenantId: z.string().uuid(),
      tenantName: z.string(),
      tenantSlug: z.string(),
      logoUrl: z.string().nullable(),
      productType: z.enum(["beauty", "barber"]),
      onboardingCompleted: z.boolean(),
      licenseStatus: z.enum(["trial", "active"]),
      role: z.enum(roles),
    }),
  ),
  platformAccess: platformAccessSchema,
});

export function callbackUrl(next: "/painel" | "/onboarding" | "/redefinir-senha"): string {
  const url = new URL("/auth/confirm", canonicalOrigin());
  url.searchParams.set("next", next);
  return url.toString();
}

export function oauthCallbackUrl(productType: "beauty" | "barber"): string {
  const url = new URL("/auth/confirm", canonicalOrigin());
  url.searchParams.set("next", "/painel");
  url.searchParams.set("produto", productType);
  return url.toString();
}

function canonicalOrigin(): string {
  const configured = process.env["PUBLIC_SITE_URL"]?.trim();
  if (!configured) return getRequestUrl().origin;
  try {
    return new URL(configured).origin;
  } catch {
    return getRequestUrl().origin;
  }
}

export function authErrorMessage(error: AuthError, fallback: string): string {
  switch (error.code) {
    case "invalid_credentials":
      return "E-mail ou senha inválidos.";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar.";
    case "user_already_exists":
      return "Já existe uma conta com este e-mail.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    case "same_password":
      return "A nova senha deve ser diferente da senha atual.";
    case "weak_password":
      return "Escolha uma senha mais forte.";
    default:
      return fallback;
  }
}

export async function resolveSession(
  supabase: SupabaseClient<Database> = createSupabaseServerClient(),
  knownAuth?: { user: User; session: SupabaseAuthSession },
): Promise<Session | null> {
  const auth = knownAuth
    ? { user: knownAuth.user, session: knownAuth.session, error: null }
    : await (async () => {
        const [{ data: userData, error }, { data: sessionData }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ]);
        return { user: userData.user, session: sessionData.session, error };
      })();
  if (auth.error || !auth.user?.email || !auth.session) return null;

  const { data: rawBootstrap, error: bootstrapError } = await supabase.rpc(
    "get_my_session_bootstrap",
  );
  const parsedBootstrap = sessionBootstrapSchema.safeParse(rawBootstrap);
  if (bootstrapError || !parsedBootstrap.success) return null;
  const bootstrap = parsedBootstrap.data;
  const platformAccess = bootstrap.platformAccess;
  const now = Date.now();
  const companies = bootstrap.companies.flatMap((company): CompanyAccess[] => {
    const productType = company.productType;
    const access = resolveBetaAccess(platformAccess.grants, productType, now);
    return [
      {
        tenantId: company.tenantId,
        tenantName: company.tenantName,
        tenantSlug: company.tenantSlug,
        logoUrl: company.logoUrl,
        productType,
        onboardingCompleted: company.onboardingCompleted,
        licenseStatus: company.licenseStatus,
        role: company.role as Role,
        permissions: getPermissionsForRole(company.role as Role),
        betaAccessActive: access.status === "approved",
        betaAccessStatus: access.status,
        betaAccessType: access.accessType,
      },
    ];
  });

  if (!companies.length) return null;
  const selected = selectActiveCompany(companies, bootstrap.activeTenantId);
  if (!selected) return null;
  if (selected.tenantId !== bootstrap.activeTenantId) {
    const { error } = await supabase.rpc("switch_active_tenant", {
      target_tenant_id: selected.tenantId,
    });
    if (error) return null;
  }

  return {
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: bootstrap.profileName,
      companies,
      isPlatformAdministrator: platformAccess.isAdministrator,
      ...selected,
    },
    expiresAt: new Date(auth.session.expires_at! * 1000).toISOString(),
  };
}


/** Sessão autorizada no beta fechado — usada por toda leitura/escrita protegida. */
export async function requireApprovedSession(
  supabase: SupabaseClient<Database> = createSupabaseServerClient(),
): Promise<Session> {
  const session = await resolveSession(supabase);
  if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
  if (!session.user.betaAccessActive) {
    throw new Error(
      session.user.betaAccessStatus === "pending"
        ? "Seu acesso está aguardando aprovação da administração do beta fechado."
        : "Seu acesso ao beta fechado não está ativo. Fale com a administração.",
    );
  }
  return session;
}

export async function resolveOperationalContext(
  supabase: SupabaseClient<Database>,
): Promise<{ userId: string; tenantId: string; role: Role } | null> {
  const [{ data: rawBootstrap, error }, { data: authSession }] = await Promise.all([
    supabase.rpc("get_my_session_bootstrap"),
    supabase.auth.getSession(),
  ]);
  const parsed = sessionBootstrapSchema.safeParse(rawBootstrap);
  if (error || !parsed.success || !authSession.session) return null;
  const company = selectActiveCompany(
    parsed.data.companies.map((item) => ({
      ...item,
      permissions: getPermissionsForRole(item.role),
      betaAccessActive: false,
      betaAccessStatus: "pending" as BetaAccessStatus,
      betaAccessType: null,
    })),
    parsed.data.activeTenantId,
  );
  if (!company) return null;
  const access = resolveBetaAccess(parsed.data.platformAccess.grants, company.productType);
  if (access.status !== "approved") return null;
  return { userId: authSession.session.user.id, tenantId: company.tenantId, role: company.role };
}
