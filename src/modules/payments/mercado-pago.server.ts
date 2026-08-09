import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";

import { getMercadoPagoEnv } from "@/lib/server-env";
import { resolveSession } from "@/modules/auth/server";
import { createSupabaseAdminClient } from "@/modules/supabase/admin-client";
import { createSupabaseServerClient } from "@/modules/supabase/server-client";

type ConnectionStatus = {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  connectedAt: string | null;
  error: string | null;
};

function environment() {
  const result = getMercadoPagoEnv();
  if (!result.success) return null;
  return result.data;
}

function key(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    body.toString("base64url"),
  ].join(".");
}

function manager(role: string) {
  if (role !== "owner" && role !== "admin")
    throw new Error("Você não possui permissão para configurar pagamentos.");
}

async function context() {
  const supabase = createSupabaseServerClient();
  const session = await resolveSession(supabase);
  if (!session) throw new Error("Entre novamente para continuar.");
  manager(session.user.role);
  return { supabase, session };
}

export const getMercadoPagoConnection = createServerFn({ method: "GET" }).handler(
  async (): Promise<ConnectionStatus> => {
    const { supabase, session } = await context();
    const { data } = await supabase
      .from("payment_provider_connections")
      .select("status, account_email, connected_at, last_error")
      .eq("tenant_id", session.user.tenantId)
      .eq("provider", "mercado_pago")
      .maybeSingle();
    return {
      configured: Boolean(environment()),
      connected: data?.status === "connected",
      accountEmail: data?.account_email ?? null,
      connectedAt: data?.connected_at ?? null,
      error: data?.last_error ?? null,
    };
  },
);

export const startMercadoPagoConnection = createServerFn({ method: "POST" }).handler(async () => {
  const env = environment();
  if (!env)
    throw new Error("A aplicação do Mercado Pago ainda precisa ser configurada no servidor.");
  const { session } = await context();
  const admin = createSupabaseAdminClient();
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirectUri = new URL(
    "/integracoes/mercado-pago/retorno",
    getRequestUrl().origin,
  ).toString();
  const { error } = await admin.from("payment_provider_oauth_states").insert({
    tenant_id: session.user.tenantId,
    provider: "mercado_pago",
    state_hash: createHash("sha256").update(state).digest("hex"),
    code_verifier_ciphertext: encrypt(verifier, env.encryptionKey),
    redirect_uri: redirectUri,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) throw new Error("Não foi possível iniciar a conexão segura.");
  const url = new URL("https://auth.mercadopago.com/authorization");
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { url: url.toString() };
});

function decrypt(value: string, secret: string) {
  const [version, iv, tag, body] = value.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("Credencial segura inválida.");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

const callbackSchema = z.object({ code: z.string().min(1), state: z.string().min(20) });
export const finishMercadoPagoConnection = createServerFn({ method: "POST" })
  .validator(callbackSchema)
  .handler(async ({ data }) => {
    const env = environment();
    if (!env) throw new Error("Configuração do servidor incompleta.");
    const { session } = await context();
    const admin = createSupabaseAdminClient();
    const stateHash = createHash("sha256").update(data.state).digest("hex");
    const { data: oauth, error: oauthError } = await admin
      .from("payment_provider_oauth_states")
      .select("id, tenant_id, code_verifier_ciphertext, redirect_uri, expires_at, used_at")
      .eq("state_hash", stateHash)
      .maybeSingle();
    if (
      oauthError ||
      !oauth ||
      oauth.tenant_id !== session.user.tenantId ||
      oauth.used_at ||
      new Date(oauth.expires_at).getTime() < Date.now()
    ) {
      throw new Error("Esta autorização expirou ou não pertence à empresa ativa.");
    }
    const response = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.clientId,
        client_secret: env.clientSecret,
        grant_type: "authorization_code",
        code: data.code,
        redirect_uri: oauth.redirect_uri,
        code_verifier: decrypt(oauth.code_verifier_ciphertext, env.encryptionKey),
      }),
    });
    const token = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      user_id?: number;
      scope?: string;
      message?: string;
    };
    if (!response.ok || !token.access_token)
      throw new Error("O Mercado Pago não autorizou a conexão. Tente novamente.");
    const now = new Date().toISOString();
    const { error } = await admin.from("payment_provider_connections").upsert(
      {
        tenant_id: session.user.tenantId,
        provider: "mercado_pago",
        status: "connected",
        provider_user_id: token.user_id ? String(token.user_id) : null,
        access_token_ciphertext: encrypt(token.access_token, env.encryptionKey),
        refresh_token_ciphertext: token.refresh_token
          ? encrypt(token.refresh_token, env.encryptionKey)
          : null,
        token_expires_at: token.expires_in
          ? new Date(Date.now() + token.expires_in * 1000).toISOString()
          : null,
        scopes: token.scope ?? null,
        last_error: null,
        connected_at: now,
        updated_at: now,
      },
      { onConflict: "tenant_id,provider" },
    );
    if (error) throw new Error("A conta foi autorizada, mas não foi possível salvar a conexão.");
    await admin.from("payment_provider_oauth_states").update({ used_at: now }).eq("id", oauth.id);
    return { ok: true };
  });

export const disconnectMercadoPago = createServerFn({ method: "POST" }).handler(async () => {
  const { session } = await context();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("payment_provider_connections").upsert(
    {
      tenant_id: session.user.tenantId,
      provider: "mercado_pago",
      status: "disconnected",
      access_token_ciphertext: null,
      refresh_token_ciphertext: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,provider" },
  );
  if (error) throw new Error("Não foi possível desconectar a conta.");
  return { ok: true };
});
