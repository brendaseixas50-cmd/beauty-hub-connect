import { createFileRoute } from "@tanstack/react-router";

/** Rota legada: preferências criadas antes de /api/public/* continuam funcionando. */
export const Route = createFileRoute("/api/mercado-pago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleMercadoPagoWebhook } = await import(
          "@/modules/payments/mercado-pago-webhook.server"
        );
        return handleMercadoPagoWebhook(request);
      },
      GET: async () => Response.json({ status: "ok" }),
    },
  },
});
