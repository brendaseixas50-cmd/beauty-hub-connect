import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";

import { getMercadoPagoEnv, getMercadoPagoWebhookSecret } from "@/lib/server-env";
import { canonicalOrigin, requireApprovedSession } from "@/modules/auth/session.server";
import { createSupabaseAdminClient } from "@/modules/supabase/admin-client";
import { createSupabaseServerClient } from "@/modules/supabase/server-client";

type ConnectionState =
  | "not_configured"
  | "disconnected"
  | "connected"
  | "token_invalid"
  | "authorization_error";

type ConnectionStatus = {
  configured: boolean;
  webhookConfigured: boolean;
  connected: boolean;
  state: ConnectionState;
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

/** Confirma junto à API do Mercado Pago que o token salvo realmente funciona. */
async function verifyAccessToken(token: string) {
  try {
    const response = await fetch("https://api.mercadopago.com/users/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await response.json().catch(() => ({}))) as {
      email?: string;
      message?: string;
      error?: string;
    };
    if (!response.ok)
      return {
        ok: false as const,
        email: null,
        message: `A API do Mercado Pago recusou a autorização salva (${response.status}): ${body.message ?? body.error ?? "token inválido"}`,
      };
    return { ok: true as const, email: body.email ?? null, message: null };
  } catch (cause) {
    console.error("[mercado-pago] falha ao validar token", cause);
    return {
      ok: false as const,
      email: null,
      message: "Não foi possível validar a autorização com o Mercado Pago agora.",
    };
  }
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
    const env = environment();
    const configured = Boolean(env);
    const expired =
      Boolean(data?.token_expires_at) &&
      new Date(data!.token_expires_at as string).getTime() <= Date.now() &&
      !data?.refresh_token_ciphertext;
    const stored =
      data?.status === "connected" && Boolean(data?.access_token_ciphertext) && !expired;
    // O token só é utilizável se a chave atual conseguir lê-lo E a API aceitá-lo.
    let readable = stored;
    let liveEmail: string | null = null;
    let liveError: string | null = null;
    if (stored && env) {
      let plainToken: string | null = null;
      try {
        plainToken = decrypt(data!.access_token_ciphertext as string, env.encryptionKey);
      } catch {
        readable = false;
        liveError =
          "A autorização salva foi criptografada com outra chave e não pode mais ser lida. Reconecte a conta.";
      }
      if (plainToken) {
        const verified = await verifyAccessToken(plainToken);
        if (verified.ok) {
          liveEmail = verified.email;
        } else {
          readable = false;
          liveError = verified.message;
        }
      }
      if (!readable) {
        const admin = createSupabaseAdminClient();
        await admin
          .from("payment_provider_connections")
          .update({ last_error: liveError, updated_at: new Date().toISOString() })
          .eq("tenant_id", session.user.tenantId)
          .eq("provider", "mercado_pago");
      }
    }
    const connected = stored && configured && readable;

    const lastError = liveError ?? data?.last_error ?? null;
    const authorizationError =
      !connected && Boolean(lastError) && !(stored && !configured) && !(stored && !readable);
    const state: ConnectionState = !configured
      ? "not_configured"
      : connected
        ? "connected"
        : stored && !readable
          ? "token_invalid"
          : authorizationError
            ? "authorization_error"
            : expired
              ? "token_invalid"
              : "disconnected";

    const messages: Record<ConnectionState, string | null> = {
      not_configured:
        "Os recebimentos online ainda não estão liberados neste ambiente. Fale com o suporte.",
      connected: null,
      token_invalid:
        liveError ??
        "A autorização salva não é mais válida. Reconecte a conta do Mercado Pago para voltar a receber pagamentos.",
      authorization_error:
        lastError ?? "O Mercado Pago recusou a autorização. Reconecte a conta para tentar de novo.",
      disconnected: null,
    };

    return {
      configured,
      webhookConfigured: Boolean(getMercadoPagoWebhookSecret()),
      connected,
      state,
      accountEmail: liveEmail ?? data?.account_email ?? null,
      connectedAt: data?.connected_at ?? null,
      error: messages[state],
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
    canonicalOrigin(),
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
  if (!env) {
    console.error(
      "[mercado-pago] credenciais do servidor ausentes",
      JSON.stringify({
        tenantId,
        hasClientId: Boolean(process.env["MERCADO_PAGO_CLIENT_ID"]),
        hasClientSecret: Boolean(process.env["MERCADO_PAGO_CLIENT_SECRET"]),
        hasEncryptionKey: Boolean(process.env["MERCADO_PAGO_TOKEN_ENCRYPTION_KEY"]),
      }),
    );
    throw new Error(
      "As credenciais da aplicação do Mercado Pago não estão configuradas neste ambiente do servidor.",
    );
  }
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
  const safeDecrypt = (value: string, label: string) => {
    try {
      return decrypt(value, env.encryptionKey);
    } catch (cause) {
      console.error(`[mercado-pago] falha ao decifrar ${label}`, { tenantId, cause });
      throw new Error(
        "As credenciais salvas do Mercado Pago não puderam ser lidas com a chave de criptografia atual do servidor. Conecte a conta novamente.",
      );
    }
  };

  if (!expiresSoon) {
    return {
      token: safeDecrypt(connection.access_token_ciphertext, "access_token"),
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
      refresh_token: safeDecrypt(connection.refresh_token_ciphertext, "refresh_token"),
    }),
  });
  const refreshed = (await response.json().catch(() => ({}))) as MercadoPagoToken & {
    message?: string;
    error?: string;
  };
  if (!response.ok || !refreshed.access_token) {
    console.error("[mercado-pago] falha ao renovar token", {
      tenantId,
      status: response.status,
      message: refreshed.message ?? refreshed.error ?? null,
    });
    await admin
      .from("payment_provider_connections")
      .update({
        last_error: `Renovação do token falhou (${response.status}): ${refreshed.message ?? refreshed.error ?? "erro desconhecido"}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
    throw new Error("A conexão do Mercado Pago expirou. Conecte a conta novamente.");
  }
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
  const origin = canonicalOrigin();
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
  const preference = (await response.json().catch(() => ({}))) as {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
    message?: string;
    error?: string;
    cause?: unknown;
  };
  if (!response.ok || !preference.id || !preference.init_point) {
    console.error("[mercado-pago] falha ao criar preferência", {
      tenantId: tenant.id,
      status: response.status,
      message: preference.message ?? preference.error ?? null,
      cause: preference.cause ?? null,
    });
    throw new Error(
      `Não foi possível abrir o pagamento no Mercado Pago (${response.status}): ${preference.message ?? preference.error ?? "resposta inesperada da API"}`,
    );
  }
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
    const admin = createSupabaseAdminClient();
    const stateHash = createHash("sha256").update(data.state).digest("hex");
    const callbackId = stateHash.slice(0, 12);
    console.info("[mercado-pago] callback recebido", { callbackId });
    const { data: oauth, error: oauthError } = await admin
      .from("payment_provider_oauth_states")
      .select("id, tenant_id, code_verifier_ciphertext, redirect_uri, expires_at, used_at")
      .eq("state_hash", stateHash)
      .eq("provider", "mercado_pago")
      .maybeSingle();
    if (oauthError || !oauth) {
      console.error("[mercado-pago] state não encontrado", {
        callbackId,
        databaseError: oauthError?.message ?? null,
      });
      throw new Error("Esta autorização não foi encontrada. Inicie a conexão novamente.");
    }
    const waitForPersistedConnection = async () => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const { data: existing } = await admin
          .from("payment_provider_connections")
          .select("status, access_token_ciphertext")
          .eq("tenant_id", oauth.tenant_id)
          .eq("provider", "mercado_pago")
          .maybeSingle();
        if (existing?.status === "connected" && existing.access_token_ciphertext) return true;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return false;
    };
    if (oauth.used_at) {
      if (await waitForPersistedConnection()) {
        console.info("[mercado-pago] callback repetido já concluído", {
          callbackId,
          tenantId: oauth.tenant_id,
        });
        return { ok: true };
      }
      throw new Error("Esta autorização já foi utilizada e não gerou uma conexão válida.");
    }
    if (new Date(oauth.expires_at).getTime() < Date.now()) {
      console.error("[mercado-pago] state expirado", {
        callbackId,
        tenantId: oauth.tenant_id,
      });
      throw new Error("Esta autorização expirou. Inicie a conexão novamente.");
    }
    const claimedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await admin
      .from("payment_provider_oauth_states")
      .update({ used_at: claimedAt })
      .eq("id", oauth.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (claimError) {
      console.error("[mercado-pago] falha ao reservar state", {
        callbackId,
        tenantId: oauth.tenant_id,
        databaseError: claimError.message,
      });
      throw new Error("Não foi possível confirmar esta autorização com segurança.");
    }
    if (!claimed) {
      if (await waitForPersistedConnection()) return { ok: true };
      throw new Error("Esta autorização já está sendo processada. Volte às configurações.");
    }
    let codeVerifier: string;
    try {
      codeVerifier = decrypt(oauth.code_verifier_ciphertext, env.encryptionKey);
    } catch (cause) {
      console.error("[mercado-pago] code verifier ilegível", {
        callbackId,
        tenantId: oauth.tenant_id,
        cause,
      });
      throw new Error("A conexão foi iniciada com outra chave segura. Inicie uma nova conexão.");
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
        code_verifier: codeVerifier,
      }),
    });
    const token = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      user_id?: number;
      scope?: string;
      message?: string;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !token.access_token) {
      console.error("[mercado-pago] troca do código OAuth falhou", {
        callbackId,
        tenantId: oauth.tenant_id,
        status: response.status,
        message: token.message ?? token.error_description ?? token.error ?? null,
        redirectUri: oauth.redirect_uri,
      });
      throw new Error(
        `O Mercado Pago não autorizou a conexão (${response.status}): ${token.message ?? token.error_description ?? token.error ?? "tente novamente"}`,
      );
    }
    // Só marcamos como conectada depois de a API aceitar o token recém-emitido.
    const verified = await verifyAccessToken(token.access_token);
    if (!verified.ok) {
      console.error("[mercado-pago] token emitido não foi validado", {
        callbackId,
        tenantId: oauth.tenant_id,
        message: verified.message,
      });
      throw new Error(verified.message);
    }
    const now = new Date().toISOString();
    const { error } = await admin.from("payment_provider_connections").upsert(
      {
        tenant_id: oauth.tenant_id,
        provider: "mercado_pago",
        status: "connected",
        provider_user_id: token.user_id ? String(token.user_id) : null,
        account_email: verified.email,
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
    if (error) {
      console.error("[mercado-pago] persistência da conexão falhou", {
        callbackId,
        tenantId: oauth.tenant_id,
        databaseError: error.message,
      });
      throw new Error("A conta foi autorizada, mas não foi possível salvar a conexão.");
    }
    console.info("[mercado-pago] conexão persistida e validada", {
      callbackId,
      tenantId: oauth.tenant_id,
      providerUserId: token.user_id ? String(token.user_id) : null,
    });
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
