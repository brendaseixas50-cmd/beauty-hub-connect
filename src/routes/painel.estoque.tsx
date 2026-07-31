import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { estoque } from "@/data/demo";

export const Route = createFileRoute("/painel/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Painel Lu IA Studio" },
      { name: "description", content: "Controle de produtos, quantidade mínima e reposição." },
      { property: "og:title", content: "Estoque — Painel Lu IA Studio" },
      { property: "og:description", content: "Controle de produtos e reposição." },
    ],
  }),
  component: Estoque,
});

const cor = (status: string) =>
  status === "Ok"
    ? "secondary"
    : status === "Esgotado"
      ? "destructive"
      : ("outline" as const);

function Estoque() {
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow">Insumos</p>
          <h1 className="mt-1 text-3xl">Estoque</h1>
        </div>
        <Button className="shrink-0 rounded-full">
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>

      <Card className="mt-8 divide-y p-0">
        {estoque.map((e) => (
          <div key={e.item} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{e.item}</p>
              <p className="text-sm text-muted-foreground">
                {e.categoria} · mínimo {e.minimo}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-lg font-medium">{e.quantidade}</span>
              <Badge
                variant={cor(e.status) as "secondary" | "destructive" | "outline"}
                className="rounded-full font-normal"
              >
                {e.status}
              </Badge>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
