import { z } from "zod";

const supabaseSecretSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

const signupRateLimitSchema = z.object({
  SIGNUP_RATE_LIMIT_SECRET: z.string().min(32),
});

/** Chave secreta do projeto de produção (o mesmo usado pela Vercel). */
export function getServerEnv() {
  return supabaseSecretSchema.parse({
    SUPABASE_SECRET_KEY:
      process.env["PROD_SUPABASE_SECRET_KEY"] ?? process.env["SUPABASE_SECRET_KEY"],
  });
}

/** Segredo usado apenas para o rate limit de cadastro/agendamento. */
export function getSignupRateLimitSecret() {
  return signupRateLimitSchema.parse({
    SIGNUP_RATE_LIMIT_SECRET: process.env["SIGNUP_RATE_LIMIT_SECRET"],
  }).SIGNUP_RATE_LIMIT_SECRET;
}

const mercadoPagoEnvSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  encryptionKey: z.string().min(32),
});

export function getMercadoPagoEnv() {
  return mercadoPagoEnvSchema.safeParse({
    clientId: process.env["MERCADO_PAGO_CLIENT_ID"],
    clientSecret: process.env["MERCADO_PAGO_CLIENT_SECRET"],
    encryptionKey: process.env["MERCADO_PAGO_TOKEN_ENCRYPTION_KEY"],
  });
}

export function getMercadoPagoWebhookSecret() {
  const value = process.env["MERCADO_PAGO_WEBHOOK_SECRET"];
  return value && value.length >= 16 ? value : null;
}
