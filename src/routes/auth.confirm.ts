import { createFileRoute } from "@tanstack/react-router";

import { handleAuthCallbackRequest } from "@/modules/auth/callback.server";

// Rota de servidor: o retorno do Google/e-mail é resolvido e redirecionado em uma única
// requisição, com os cookies de sessão anexados à resposta 302.
export const Route = createFileRoute("/auth/confirm")({
  server: {
    handlers: {
      GET: async ({ request }) => handleAuthCallbackRequest(request),
      POST: async ({ request }) => handleAuthCallbackRequest(request),
    },
  },
});
