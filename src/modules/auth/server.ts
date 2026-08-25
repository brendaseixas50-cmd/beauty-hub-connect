import { type EmailOtpType } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createSupabaseServerClient } from "@/modules/supabase/server-client";
import { createSupabaseAdminClient } from "@/modules/supabase/admin-client";
import { selectCompanyForProduct, type Session } from "./domain";
import {
  authErrorMessage,
  callbackUrl,
  oauthCallbackUrl,
  resolveOperationalContext,
  resolveSession,
} from "./session.server";
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
  remember: z.boolean().optional(),
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

const oauthSessionSchema = z.object({
  accessToken: z.string().min(10),
  refreshToken: z.string().min(10),
  productType: z.enum(["beauty", "barber"]).optional(),
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
    productType: z.enum(["beauty", "barber"]).optional(),
  })
  .refine((data) => Boolean(data.code || (data.tokenHash && data.type)), {
    message: "Link de confirmação inválido.",
  });

export const getSession = createServerFn({ method: "GET" }).handler(() => resolveSession());

export const login = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }): Promise<Session> => {
    // "Manter conectado" define se os cookies duram 30 dias ou apenas a sessão.
    const supabase = createSupabaseServerClient(data.remember === false ? null : { days: 30 });
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

/**
 * Conclui o acesso com Google: os tokens devolvidos pelo broker existem apenas no
 * navegador, então precisam ser gravados nos cookies httpOnly do servidor — que são a
 * única fonte de sessão do app. Sem esta troca o painel continuava mostrando "Entrar".
 */
export const establishOAuthSession = createServerFn({ method: "POST" })
  .validator(oauthSessionSchema)
  .handler(async ({ data }): Promise<Session> => {
    const supabase = createSupabaseServerClient();
    const { data: authData, error } = await supabase.auth.setSession({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
    });
    if (error || !authData.user || !authData.session) {
      throw new Error("Não foi possível concluir o acesso com Google.");
    }

    const known = { user: authData.user, session: authData.session };
    let session = await resolveSession(supabase, known);

    if (!session) {
      // Primeiro acesso com Google: ainda não existe empresa para este usuário.
      const { error: createError } = await supabase.rpc("create_company_for_current_user", {
        company_name:
          data.productType === "barber" ? "Minha barbearia" : "Meu negócio de beleza",
        selected_product: data.productType ?? "beauty",
      });
      if (createError) throw new Error("Não foi possível preparar o produto escolhido.");
      session = await resolveSession(supabase, known);
    } else if (data.productType) {
      const preferred = selectCompanyForProduct(session.user.companies, data.productType);
      if (preferred && preferred.tenantId !== session.user.tenantId) {
        const { error: switchError } = await supabase.rpc("switch_active_tenant", {
          target_tenant_id: preferred.tenantId,
        });
        if (switchError) throw new Error("Não foi possível abrir o produto escolhido.");
        session = { ...session, user: { ...session.user, ...preferred } };
      }
    }

    if (!session) throw new Error("Sua conta não possui acesso ativo a uma empresa.");
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

    // OAuth must finish in this same request. Starting another server function before this
    // response commits its cookies races the newly-created session and causes a second login.
    if (data.productType && result.data.user && result.data.session) {
      let session = await resolveSession(supabase, {
        user: result.data.user,
        session: result.data.session,
      });
      const company = session?.user.companies.find(
        (item) => item.productType === data.productType,
      );
      if (company) {
        if (company.tenantId !== session?.user.tenantId) {
          const { error } = await supabase.rpc("switch_active_tenant", {
            target_tenant_id: company.tenantId,
          });
          if (error) throw new Error("Não foi possível abrir o produto escolhido.");
        }
      } else {
        const { error } = await supabase.rpc("create_company_for_current_user", {
          company_name:
            data.productType === "barber" ? "Minha barbearia" : "Meu negócio de beleza",
          selected_product: data.productType,
        });
        if (error) throw new Error("Não foi possível preparar o produto escolhido.");
        session = await resolveSession(supabase, {
          user: result.data.user,
          session: result.data.session,
        });
        if (!session) throw new Error("Não foi possível abrir o painel após o acesso com Google.");
      }
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
