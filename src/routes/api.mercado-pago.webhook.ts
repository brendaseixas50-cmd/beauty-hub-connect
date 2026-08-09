import { createFileRoute } from "@tanstack/react-router";

import {
  processMercadoPagoNotification,
  validateMercadoPagoWebhook,
} from "@/modules/payments/mercado-pago.server";

export const Route = createFileRoute("/api/mercado-pago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
        if (!validation.valid)
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        try {
          await processMercadoPagoNotification(paymentId, providerUserId);
        } catch {
          return Response.json({ received: true }, { status: 200 });
        }
        return Response.json({ received: true }, { status: 200 });
      },
      GET: async () => Response.json({ status: "ok" }),
    },
  },
});
