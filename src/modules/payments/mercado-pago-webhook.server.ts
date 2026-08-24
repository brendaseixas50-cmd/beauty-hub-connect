import {
  processMercadoPagoNotification,
  validateMercadoPagoWebhook,
} from "@/modules/payments/mercado-pago.server";

/**
 * Handler único do webhook do Mercado Pago, usado pela rota pública
 * (/api/public/mercado-pago/webhook) e pela rota legada
 * (/api/mercado-pago/webhook), que segue ativa para preferências já criadas.
 */
export async function handleMercadoPagoWebhook(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // Notifications may also arrive with identifiers only in the query string.
  }
  const payload = body as {
    data?: { id?: string | number };
    id?: string | number;
    user_id?: string | number;
  } | null;
  const paymentId = String(
    url.searchParams.get("data.id") ?? payload?.data?.id ?? payload?.id ?? "",
  );
  const providerUserId = String(url.searchParams.get("user_id") ?? payload?.user_id ?? "");
  if (!/^\d{1,30}$/.test(paymentId) || !/^\d{1,30}$/.test(providerUserId))
    return Response.json({ received: true }, { status: 200 });
  const validation = validateMercadoPagoWebhook(
    url.searchParams.get("data.id") ?? "",
    request.headers.get("x-request-id") ?? "",
    request.headers.get("x-signature") ?? "",
  );
  if (!validation.configured)
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  if (!validation.valid) return Response.json({ error: "Invalid signature" }, { status: 401 });
  try {
    // A aplicação do pagamento é idempotente no banco (apply_mercado_pago_payment
    // usa a referência externa + id do pagamento do provedor).
    await processMercadoPagoNotification(paymentId, providerUserId);
  } catch {
    return Response.json({ received: true }, { status: 200 });
  }
  return Response.json({ received: true }, { status: 200 });
}
