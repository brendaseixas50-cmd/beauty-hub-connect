import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint público do webhook do Mercado Pago.
 * O prefixo /api/public/* garante que o provedor alcance a rota no site
 * publicado. A autenticação real é a validação de assinatura HMAC do provedor.
 */
export const Route = createFileRoute("/api/public/mercado-pago/webhook")({
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
