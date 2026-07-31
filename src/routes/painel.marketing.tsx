import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { campanhas } from "@/data/demo";

export const Route = createFileRoute("/painel/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing — Painel Lu IA Studio" },
      { name: "description", content: "Campanhas de indicação, aniversário e reativação de clientes." },
      { property: "og:title", content: "Marketing — Painel Lu IA Studio" },
      { property: "og:description", content: "Campanhas para atrair e reativar clientes." },
    ],
  }),
  component: Marketing,
});

function Marketing() {
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow">Crescimento</p>
          <h1 className="mt-1 text-3xl">Marketing</h1>
        </div>
        <Button className="shrink-0 rounded-full">
          <Plus className="h-4 w-4" /> Nova campanha
        </Button>
      </div>

      <div className="mt-8 grid gap-3">
        {campanhas.map((c) => (
          <Card key={c.nome} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-5">
            <div className="min-w-0">
              <p className="truncate text-lg">{c.nome}</p>
              <p className="text-sm text-muted-foreground">
                {c.publico} · retorno: {c.retorno}
              </p>
            </div>
            <Badge
              variant={c.status === "Ativa" ? "default" : "outline"}
              className="shrink-0 rounded-full font-normal"
            >
              {c.status}
            </Badge>
          </Card>
        ))}
      </div>

      <Card className="surface-soft mt-8 gap-2 p-6">
        <p className="text-eyebrow">Em breve</p>
        <h2 className="text-2xl">Mensagens automáticas</h2>
        <p className="text-sm text-muted-foreground">
          Lembretes de horário, pós-atendimento e aniversário serão enviados automaticamente nas
          próximas etapas da plataforma.
        </p>
      </Card>
    </div>
  );
}
