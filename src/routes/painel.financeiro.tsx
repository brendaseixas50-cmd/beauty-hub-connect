import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl } from "@/data/demo";
import { useDemo } from "@/data/negocio";


export const Route = createFileRoute("/painel/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Painel Lu IA Studio" },
      { name: "description", content: "Faturamento, ticket médio e lançamentos do período." },
      { property: "og:title", content: "Financeiro — Painel Lu IA Studio" },
      { property: "og:description", content: "Faturamento e lançamentos do seu estúdio." },
    ],
  }),
  component: Financeiro,
});

function Financeiro() {
  const { financeiro } = useDemo();
  return (

    <div>
      <p className="text-eyebrow">Resultados</p>
      <h1 className="mt-1 text-3xl">Financeiro</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Bloco titulo="Faturamento do mês" valor={brl(financeiro.mes)} />
        <Bloco titulo="Esta semana" valor={brl(financeiro.semana)} />
        <Bloco titulo="Ticket médio" valor={brl(financeiro.ticket)} />
        <Bloco titulo="A receber" valor={brl(financeiro.aReceber)} />
      </div>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <h2 className="text-2xl">Lançamentos recentes</h2>
        <Button variant="outline" size="sm" className="shrink-0 rounded-full">
          Exportar
        </Button>
      </div>

      <Card className="mt-4 divide-y p-0">
        {financeiro.lancamentos.map((l, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{l.cliente}</p>
              <p className="truncate text-sm text-muted-foreground">
                {l.servico} · {l.data}
              </p>
              <Badge variant="outline" className="mt-1.5 rounded-full font-normal">
                {l.forma}
              </Badge>
            </div>
            <span className="shrink-0 font-medium">{brl(l.valor)}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Bloco({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Card className="gap-1 p-5">
      <p className="text-eyebrow">{titulo}</p>
      <p className="font-display text-3xl">{valor}</p>
    </Card>
  );
}
