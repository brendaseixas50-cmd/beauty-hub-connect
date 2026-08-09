import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { finishMercadoPagoConnection } from "@/modules/payments/mercado-pago.server";

const searchSchema = z.object({ code: z.string().optional(), state: z.string().optional() });

export const Route = createFileRoute("/integracoes/mercado-pago/retorno")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (!deps.code || !deps.state)
      return { ok: false, message: "Autorização cancelada ou incompleta." };
    try {
      await finishMercadoPagoConnection({ data: { code: deps.code, state: deps.state } });
      return { ok: true, message: "Mercado Pago conectado com segurança." };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Não foi possível concluir a conexão.",
      };
    }
  },
  component: MercadoPagoReturn,
});

function MercadoPagoReturn() {
  const result = Route.useLoaderData();
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/30 p-4">
      <Card className="grid w-full max-w-lg justify-items-center gap-5 p-8 text-center">
        {result.ok ? (
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        ) : (
          <CircleAlert className="h-12 w-12 text-destructive" />
        )}
        <div>
          <h1 className="text-2xl font-semibold">
            {result.ok ? "Conexão concluída" : "Conexão não concluída"}
          </h1>
          <p className="mt-2 text-muted-foreground">{result.message}</p>
        </div>
        <Button asChild>
          <Link to="/painel/configuracoes">Voltar às configurações</Link>
        </Button>
      </Card>
    </main>
  );
}
