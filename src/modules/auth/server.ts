import { type AuthError, type EmailOtpType, type SupabaseClient } from "@supabase/supabase-js";
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
): Promise<Session | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) return null;

  const [{ data: memberships, error: membershipError }, { data: active }, { data: authSession }] =
    await Promise.all([
      supabase.from("tenant_memberships").select("tenant_id, role").eq("user_id", user.id),
      supabase.from("user_active_tenants").select("tenant_id").eq("user_id", user.id).maybeSingle(),
      supabase.auth.getSession(),
    ]);

  if (membershipError || !memberships?.length || !authSession.session) return null;

  const tenantIds = memberships.map((membership) => membership.tenant_id);
  const [{ data: tenants, error: tenantError }, { data: licenses, error: licenseError }] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("id, name, slug, status, product_type, onboarding_completed_at, logo_url")
        .in("id", tenantIds)
        .eq("status", "active"),
      supabase
        .from("tenant_licenses")
        .select("tenant_id, product_type, status")
        .in("tenant_id", tenantIds)
        .in("status", ["trial", "active"]),
    ]);

  if (tenantError || licenseError || !tenants?.length || !licenses?.length) return null;

  const companies = memberships.flatMap((membership): CompanyAccess[] => {
    const tenant = tenants.find((candidate) => candidate.id === membership.tenant_id);
    const license = licenses.find(
      (candidate) =>
        candidate.tenant_id === membership.tenant_id &&
        candidate.product_type === tenant?.product_type,
    );
    const role = z.enum(roles).safeParse(membership.role);
    if (!tenant || !license || !role.success) return [];
    return [
      {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        logoUrl: tenant.logo_url,
        productType: tenant.product_type === "barber" ? "barber" : "beauty",
        onboardingCompleted: Boolean(tenant.onboarding_completed_at),
        licenseStatus: license.status === "trial" ? "trial" : "active",
        role: role.data as Role,
        permissions: getPermissionsForRole(role.data as Role),
      },
    ];
  });

  if (!companies.length) return null;
  const selected = selectActiveCompany(companies, active?.tenant_id);
  if (!selected) return null;
  if (selected.tenantId !== active?.tenant_id) {
    const { error } = await supabase.rpc("switch_active_tenant", {
      target_tenant_id: selected.tenantId,
    });
    if (error) return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: profile.full_name,
      companies,
      ...selected,
    },
    expiresAt: new Date(authSession.session.expires_at! * 1000).toISOString(),
  };
}

export const getSession = createServerFn({ method: "GET" }).handler(() => resolveSession());

export const login = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }): Promise<Session> => {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email.toLowerCase(),
      password: data.password,
    });

    if (error) throw new Error(authErrorMessage(error, "Não foi possível entrar."));

    let session = await resolveSession(supabase);
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
      session = await resolveSession(supabase);
      if (!session) throw new Error("Não foi possível abrir o produto escolhido.");
    }

    return session;
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

      const session = await resolveSession(supabase);
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
