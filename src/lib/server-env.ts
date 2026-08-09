import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  SIGNUP_RATE_LIMIT_SECRET: z.string().min(32),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_SECRET_KEY: process.env["SUPABASE_SECRET_KEY"],
    SIGNUP_RATE_LIMIT_SECRET: process.env["SIGNUP_RATE_LIMIT_SECRET"],
  });
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
