import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";

import { getMercadoPagoEnv, getMercadoPagoWebhookSecret } from "@/lib/server-env";
import { requireApprovedSession } from "@/modules/auth/session.server";
import { createSupabaseAdminClient } from "@/modules/supabase/admin-client";
import { createSupabaseServerClient } from "@/modules/supabase/server-client";

type ConnectionStatus = {
  configured: boolean;
  webhookConfigured: boolean;
  connected: boolean;
  accountEmail: string | null;
  connectedAt: string | null;
  error: string | null;
};

type CheckoutInput = {
  slug: string;
  entityType: "appointment" | "store_order";
  entityId: string;
  amountCents: number;
  title: string;
  requestId: string;
};

type MercadoPagoToken = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
  scope?: string;
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
  const session = await requireApprovedSession(supabase);
  manager(session.user.role);
  return { supabase, session };
}

export const getMercadoPagoConnection = createServerFn({ method: "GET" }).handler(
  async (): Promise<ConnectionStatus> => {
    const { supabase, session } = await context();
    const { data } = await supabase
      .from("payment_provider_connections")
      .select(
        "status, account_email, connected_at, last_error, access_token_ciphertext, refresh_token_ciphertext, token_expires_at",
      )
      .eq("tenant_id", session.user.tenantId)
      .eq("provider", "mercado_pago")
      .maybeSingle();
    const expired =
      Boolean(data?.token_expires_at) &&
      new Date(data!.token_expires_at as string).getTime() <= Date.now() &&
      !data?.refresh_token_ciphertext;
    const connected =
      data?.status === "connected" && Boolean(data?.access_token_ciphertext) && !expired;
    return {
      configured: Boolean(environment()),
      webhookConfigured: Boolean(getMercadoPagoWebhookSecret()),
      connected,
      accountEmail: data?.account_email ?? null,
      connectedAt: data?.connected_at ?? null,
      error: connected
        ? (data?.last_error ?? null)
        : (data?.last_error ??
          (data ? "A conexão do Mercado Pago expirou. Conecte a conta novamente." : null)),
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

async function connectionAccessToken(tenantId: string) {
  const env = environment();
  if (!env) throw new Error("Configuração do Mercado Pago indisponível.");
  const admin = createSupabaseAdminClient();
  const { data: connection, error } = await admin
    .from("payment_provider_connections")
    .select(
      "id, status, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, provider_user_id",
    )
    .eq("tenant_id", tenantId)
    .eq("provider", "mercado_pago")
    .maybeSingle();
  if (
    error ||
    !connection ||
    connection.status !== "connected" ||
    !connection.access_token_ciphertext
  )
    throw new Error("Esta empresa ainda não conectou uma conta do Mercado Pago.");

  const expiresSoon =
    connection.token_expires_at &&
    new Date(connection.token_expires_at).getTime() <= Date.now() + 5 * 60_000;
  if (!expiresSoon) {
    return {
      token: decrypt(connection.access_token_ciphertext, env.encryptionKey),
      providerUserId: connection.provider_user_id,
    };
  }
  if (!connection.refresh_token_ciphertext)
    throw new Error("A conexão do Mercado Pago expirou. Conecte a conta novamente.");

  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      grant_type: "refresh_token",
      refresh_token: decrypt(connection.refresh_token_ciphertext, env.encryptionKey),
    }),
  });
  const refreshed = (await response.json()) as MercadoPagoToken;
  if (!response.ok || !refreshed.access_token)
    throw new Error("A conexão do Mercado Pago expirou. Conecte a conta novamente.");
  await admin
    .from("payment_provider_connections")
    .update({
      access_token_ciphertext: encrypt(refreshed.access_token, env.encryptionKey),
      refresh_token_ciphertext: refreshed.refresh_token
        ? encrypt(refreshed.refresh_token, env.encryptionKey)
        : connection.refresh_token_ciphertext,
      token_expires_at: refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
        : null,
      provider_user_id: refreshed.user_id ? String(refreshed.user_id) : connection.provider_user_id,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);
  return {
    token: refreshed.access_token,
    providerUserId: refreshed.user_id ? String(refreshed.user_id) : connection.provider_user_id,
  };
}

export const createMercadoPagoCheckout = createServerOnlyFn(async (input: CheckoutInput) => {
  const admin = createSupabaseAdminClient();
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", input.slug)
    .eq("status", "active")
    .maybeSingle();
  if (tenantError || !tenant) throw new Error("Empresa indisponível para pagamento.");
  const externalReference = `lu:${input.entityType}:${input.entityId}`;
  const { data: existing } = await admin
    .from("payment_provider_transactions")
    .select("checkout_url")
    .eq("tenant_id", tenant.id)
    .eq("external_reference", externalReference)
    .maybeSingle();
  if (existing?.checkout_url) return { checkoutUrl: existing.checkout_url };

  const { token } = await connectionAccessToken(tenant.id);
  const origin = getRequestUrl().origin;
  const returnUrl = new URL(`/p/${encodeURIComponent(input.slug)}`, origin);
  returnUrl.searchParams.set("pagamento", "retorno");
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-idempotency-key": input.requestId,
    },
    body: JSON.stringify({
      items: [
        {
          id: input.entityId,
          title: input.title.slice(0, 120),
          quantity: 1,
          currency_id: "BRL",
          unit_price: input.amountCents / 100,
        },
      ],
      external_reference: externalReference,
      notification_url: new URL("/api/mercado-pago/webhook", origin).toString(),
      back_urls: {
        success: returnUrl.toString(),
        pending: returnUrl.toString(),
        failure: returnUrl.toString(),
      },
      auto_return: "approved",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 30 * 60_000).toISOString(),
      statement_descriptor: "LU IA STUDIO",
    }),
  });
  const preference = (await response.json()) as {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
    message?: string;
  };
  if (!response.ok || !preference.id || !preference.init_point)
    throw new Error("Não foi possível abrir o pagamento no Mercado Pago.");
  const { error } = await admin.from("payment_provider_transactions").upsert(
    {
      tenant_id: tenant.id,
      provider: "mercado_pago",
      entity_type: input.entityType,
      entity_id: input.entityId,
      external_reference: externalReference,
      preference_id: preference.id,
      amount_cents: input.amountCents,
      status: "pending",
      checkout_url: preference.init_point,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,entity_type,entity_id" },
  );
  if (error) throw new Error("Pagamento criado, mas não foi possível registrar a cobrança.");
  return { checkoutUrl: preference.init_point };
});

export const processMercadoPagoNotification = createServerOnlyFn(
  async (paymentId: string, providerUserId: string) => {
    const admin = createSupabaseAdminClient();
    const { data: connection } = await admin
      .from("payment_provider_connections")
      .select("tenant_id, provider_user_id")
      .eq("provider", "mercado_pago")
      .eq("provider_user_id", providerUserId)
      .eq("status", "connected")
      .maybeSingle();
    if (!connection) return false;
    const { token } = await connectionAccessToken(connection.tenant_id);
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );
    const payment = (await response.json()) as {
      id?: number;
      collector_id?: number;
      external_reference?: string;
      status?: string;
      status_detail?: string;
      transaction_amount?: number;
      date_approved?: string;
    };
    if (
      !response.ok ||
      !payment.id ||
      String(payment.collector_id ?? "") !== providerUserId ||
      !payment.external_reference ||
      !payment.status ||
      typeof payment.transaction_amount !== "number"
    )
      return false;
    const { data: applied } = await admin.rpc("apply_mercado_pago_payment", {
      p_tenant_id: connection.tenant_id,
      p_external_reference: payment.external_reference,
      p_provider_payment_id: String(payment.id),
      p_status: payment.status,
      p_status_detail: payment.status_detail ?? "",
      p_amount_cents: Math.round(payment.transaction_amount * 100),
      p_approved_at: payment.date_approved ?? null,
    });
    return Boolean(applied);
  },
);

export const validateMercadoPagoWebhook = createServerOnlyFn(
  (dataId: string, requestId: string, signature: string) => {
    const secret = getMercadoPagoWebhookSecret();
    if (!secret) return { configured: false, valid: false };
    const fields = Object.fromEntries(
      signature.split(",").map((part) => {
        const separator = part.indexOf("=");
        return separator > 0
          ? [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
          : [part.trim(), ""];
      }),
    );
    const timestamp = fields["ts"];
    const received = fields["v1"];
    if (!timestamp || !received || !/^[a-f0-9]{64}$/i.test(received))
      return { configured: true, valid: false };
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
    const expected = createHmac("sha256", secret).update(manifest).digest();
    const supplied = Buffer.from(received, "hex");
    return {
      configured: true,
      valid: supplied.length === expected.length && timingSafeEqual(supplied, expected),
    };
  },
);

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
