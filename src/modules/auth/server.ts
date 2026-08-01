import { type AuthError, type EmailOtpType } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/modules/supabase/server-client";
import { getPermissionsForRole, roles, type Role, type Session } from "./domain";

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(72, "A senha deve ter no máximo 72 caracteres.")
  .regex(/[A-Za-zÀ-ÿ]/, "Inclua pelo menos uma letra na senha.")
  .regex(/[0-9]/, "Inclua pelo menos um número na senha.");

const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

const signupSchema = z
  .object({
    productType: z.enum(["beauty", "barber"]),
    fullName: z.string().trim().min(2, "Informe seu nome completo.").max(120),
    businessName: z.string().trim().min(2, "Informe o nome da empresa.").max(120),
    email: z.string().trim().email("Informe um e-mail válido."),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "As senhas não coincidem.",
    path: ["passwordConfirmation"],
  });

const emailSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
});

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

function callbackUrl(next: "/painel" | "/redefinir-senha"): string {
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

async function resolveSession(): Promise<Session | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id, full_name, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) return null;

  const role = z.enum(roles).safeParse(profile.role);
  if (!role.success) return null;

  const [{ data: tenant, error: tenantError }, { data: authSession }] = await Promise.all([
    supabase
      .from("tenants")
      .select("name, slug, status, product_type")
      .eq("id", profile.tenant_id)
      .single(),
    supabase.auth.getSession(),
  ]);

  if (tenantError || !tenant || tenant.status !== "active" || !authSession.session) return null;

  return {
    user: {
      id: user.id,
      tenantId: profile.tenant_id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      productType: tenant.product_type === "barber" ? "barber" : "beauty",
      email: user.email,
      name: profile.full_name,
      role: role.data as Role,
      permissions: getPermissionsForRole(role.data as Role),
    },
    expiresAt: new Date(authSession.session.expires_at! * 1000).toISOString(),
  };
}

export const getSession = createServerFn({ method: "GET" }).handler(resolveSession);

export const login = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }): Promise<Session> => {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email.toLowerCase(),
      password: data.password,
    });

    if (error) throw new Error(authErrorMessage(error, "Não foi possível entrar."));

    const session = await resolveSession();
    if (!session) {
      await supabase.auth.signOut({ scope: "local" });
      throw new Error("Sua conta não possui acesso ativo a uma empresa.");
    }

    return session;
  });

export const signup = createServerFn({ method: "POST" })
  .validator(signupSchema)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email.toLowerCase(),
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          business_name: data.businessName,
          product_type: data.productType,
        },
        emailRedirectTo: callbackUrl("/painel"),
      },
    });

    if (error) throw new Error(authErrorMessage(error, "Não foi possível criar a conta."));

    if (authData.session) {
      await supabase.auth.signOut({ scope: "local" });
      throw new Error("A confirmação obrigatória por e-mail não está habilitada no Supabase.");
    }

    return { success: true, requiresEmailConfirmation: true } as const;
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
