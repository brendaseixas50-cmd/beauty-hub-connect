import {
  type AuthError,
  type EmailOtpType,
  type Session as SupabaseAuthSession,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/modules/supabase/server-client";
import { createSupabaseAdminClient } from "@/modules/supabase/admin-client";
import type { Database } from "@/modules/supabase/database.types";
import {
  getPermissionsForRole,
  roles,
  selectActiveCompany,
  selectCompanyForProduct,
  type CompanyAccess,
  type Role,
  type Session,
} from "./domain";
import { signupAttemptFingerprint } from "./signup-rate-limit";

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(72, "A senha deve ter no máximo 72 caracteres.")
  .regex(/[A-Za-zÀ-ÿ]/, "Inclua pelo menos uma letra na senha.")
  .regex(/[0-9]/, "Inclua pelo menos um número na senha.");

const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(254),
  password: z.string().min(1, "Informe a senha."),
  productType: z.enum(["beauty", "barber"]).optional(),
});

const signupSchema = z
  .object({
    productType: z.enum(["beauty", "barber"]),
    fullName: z.string().trim().min(2, "Informe seu nome completo.").max(120),
    businessName: z.string().trim().min(2, "Informe o nome da empresa.").max(120),
    email: z.string().trim().email("Informe um e-mail válido.").max(254),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "As senhas não coincidem.",
    path: ["passwordConfirmation"],
  });

const emailSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(254),
});
const resendSchema = emailSchema.extend({ productType: z.enum(["beauty", "barber"]) });

const switchCompanySchema = z.object({ tenantId: z.string().uuid() });
const productSchema = z.object({ productType: z.enum(["beauty", "barber"]) });

const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "As senhas não coincidem.",
    path: ["passwordConfirmation"],
  });

const otpTypes = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;
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
const sessionBootstrapSchema = z.object({
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
const confirmSchema = z
  .object({
    code: z.string().min(1).optional(),
    tokenHash: z.string().min(1).optional(),
    type: z.enum(otpTypes).optional(),
  })
  .refine((data) => Boolean(data.code || (data.tokenHash && data.type)), {
    message: "Link de confirmação inválido.",
  });

function callbackUrl(next: "/painel" | "/onboarding" | "/redefinir-senha"): string {
  const url = new URL("/auth/confirm", getRequestUrl().origin);
  url.searchParams.set("next", next);
  return url.toString();
}

function oauthCallbackUrl(productType: "beauty" | "barber"): string {
  const url = new URL("/auth/confirm", getRequestUrl().origin);
  url.searchParams.set("next", "/painel");
  url.searchParams.set("produto", productType);
  return url.toString();
}

function authErrorMessage(error: AuthError, fallback: string): string {
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
    const betaGrant = platformAccess.grants.find(
      (grant) =>
        grant.productType === productType &&
        grant.status === "active" &&
        new Date(grant.startsAt).getTime() <= now &&
        (!grant.expiresAt || new Date(grant.expiresAt).getTime() > now),
    );
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
        betaAccessActive: Boolean(betaGrant),
        betaAccessType: betaGrant?.accessType ?? null,
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
      betaAccessType: null,
    })),
    parsed.data.activeTenantId,
  );
  if (!company) return null;
  const now = Date.now();
  const grant = parsed.data.platformAccess.grants.find(
    (item) =>
      item.productType === company.productType &&
      item.status === "active" &&
      new Date(item.startsAt).getTime() <= now &&
      (!item.expiresAt || new Date(item.expiresAt).getTime() > now),
  );
  if (!grant) return null;
  return { userId: authSession.session.user.id, tenantId: company.tenantId, role: company.role };
}

export const getSession = createServerFn({ method: "GET" }).handler(() => resolveSession());

export const login = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }): Promise<Session> => {
    const supabase = createSupabaseServerClient();
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email.toLowerCase(),
      password: data.password,
    });

    if (error) throw new Error(authErrorMessage(error, "Não foi possível entrar."));

    let session =
      authData.user && authData.session
        ? await resolveSession(supabase, { user: authData.user, session: authData.session })
        : null;
    if (!session) {
      await supabase.auth.signOut({ scope: "local" });
      throw new Error("Sua conta não possui acesso ativo a uma empresa.");
    }

    const preferredCompany = selectCompanyForProduct(session.user.companies, data.productType);
    if (preferredCompany && preferredCompany.tenantId !== session.user.tenantId) {
      const { error: switchError } = await supabase.rpc("switch_active_tenant", {
        target_tenant_id: preferredCompany.tenantId,
      });
      if (switchError) throw new Error("Não foi possível abrir o produto escolhido.");
      session = { ...session, user: { ...session.user, ...preferredCompany } };
    }

    return session;
  });

export const startGoogleSignIn = createServerFn({ method: "POST" })
  .validator(productSchema)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { data: oauth, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: oauthCallbackUrl(data.productType), skipBrowserRedirect: true },
    });
    if (error || !oauth.url) throw new Error("Não foi possível iniciar o acesso com Google.");
    return { url: oauth.url };
  });

export const ensureOAuthProductCompany = createServerFn({ method: "POST" })
  .validator(productSchema)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const session = await resolveSession(supabase);
    if (!session) throw new Error("Não foi possível concluir o acesso com Google.");
    const existing = session.user.companies.find(
      (company) => company.productType === data.productType,
    );
    if (existing) {
      if (existing.tenantId !== session.user.tenantId) {
        await supabase.rpc("switch_active_tenant", { target_tenant_id: existing.tenantId });
      }
      return { ok: true };
    }
    const { error } = await supabase.rpc("create_company_for_current_user", {
      company_name: data.productType === "barber" ? "Minha barbearia" : "Meu negócio de beleza",
      selected_product: data.productType,
    });
    if (error) throw new Error("Não foi possível preparar o produto escolhido.");
    return { ok: true };
  });

export const signup = createServerFn({ method: "POST" })
  .validator(signupSchema)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const email = data.email.toLowerCase();

    const admin = createSupabaseAdminClient();
    const { data: accountExists, error: lookupError } = await admin.rpc(
      "check_signup_attempt_and_account",
      {
        request_fingerprint: signupAttemptFingerprint(email),
        target_email: email,
      },
    );

    if (lookupError?.code === "P0001") {
      throw new Error("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
    }
    if (lookupError) throw new Error("Não foi possível concluir o cadastro. Tente novamente.");

    if (accountExists) {
      const { data: existingAccount, error: existingError } =
        await supabase.auth.signInWithPassword({
          email,
          password: data.password,
        });

      if (existingError || !existingAccount.session) {
        throw new Error(
          "Não foi possível concluir o cadastro. Confira os dados e tente novamente.",
        );
      }

      const { error: companyError } = await supabase.rpc("create_company_for_current_user", {
        company_name: data.businessName,
        selected_product: data.productType,
      });
      if (companyError) throw new Error("Não foi possível adicionar esta empresa à sua conta.");

      const session = await resolveSession(supabase, {
        user: existingAccount.user,
        session: existingAccount.session,
      });
      if (!session) throw new Error("A empresa foi criada, mas não foi possível abrir o painel.");
      return { success: true, requiresEmailConfirmation: false, session } as const;
    }

    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          business_name: data.businessName,
          product_type: data.productType,
        },
        emailRedirectTo: callbackUrl(data.productType === "beauty" ? "/onboarding" : "/painel"),
      },
    });

    if (error) throw new Error(authErrorMessage(error, "Não foi possível criar a conta."));

    if (authData.user?.identities?.length === 0) {
      throw new Error(
        "Este e-mail já possui uma conta. Informe a senha correta para adicionar o novo produto.",
      );
    }

    if (authData.session) {
      await supabase.auth.signOut({ scope: "local" });
      throw new Error("A confirmação obrigatória por e-mail não está habilitada no Supabase.");
    }

    return { success: true, requiresEmailConfirmation: true, session: null } as const;
  });

export const resendSignupConfirmation = createServerFn({ method: "POST" })
  .validator(resendSchema)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: data.email.toLowerCase(),
      options: {
        emailRedirectTo: callbackUrl(data.productType === "beauty" ? "/onboarding" : "/painel"),
      },
    });
    if (error) throw new Error(authErrorMessage(error, "Não foi possível reenviar a confirmação."));
    return { success: true } as const;
  });

export const switchCompany = createServerFn({ method: "POST" })
  .validator(switchCompanySchema)
  .handler(async ({ data }): Promise<Session> => {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.rpc("switch_active_tenant", {
      target_tenant_id: data.tenantId,
    });
    if (error) throw new Error("Você não possui acesso a esta empresa.");
    const session = await resolveSession(supabase);
    if (!session) throw new Error("Não foi possível trocar de empresa.");
    return session;
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator(emailSchema)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(data.email.toLowerCase(), {
      redirectTo: callbackUrl("/redefinir-senha"),
    });

    if (error) {
      throw new Error(authErrorMessage(error, "Não foi possível enviar o e-mail de recuperação."));
    }

    return { success: true } as const;
  });

export const confirmAuth = createServerFn({ method: "POST" })
  .validator(confirmSchema)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();

    const result = data.code
      ? await supabase.auth.exchangeCodeForSession(data.code)
      : await supabase.auth.verifyOtp({
          token_hash: data.tokenHash!,
          type: data.type as EmailOtpType,
        });

    if (result.error) {
      throw new Error(authErrorMessage(result.error, "O link expirou ou já foi utilizado."));
    }

    return { success: true } as const;
  });

export const updatePassword = createServerFn({ method: "POST" })
  .validator(updatePasswordSchema)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("Sessão de recuperação inválida ou expirada.");

    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) throw new Error(authErrorMessage(error, "Não foi possível alterar a senha."));

    return { success: true } as const;
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Não foi possível encerrar a sessão.");
  return { success: true } as const;
});
