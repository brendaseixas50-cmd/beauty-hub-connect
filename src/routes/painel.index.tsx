import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, Clock, Star, TrendingUp, UserRound, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  agendamentosHoje,
  proximosAtendimentos,
  horariosDisponiveis,
  financeiro,
  clientes,
  brl,
} from "@/data/demo";

export const Route = createFileRoute("/painel/")({
  head: () => ({
    meta: [
      { title: "Visão geral — Painel Lu IA Studio" },
      { name: "description", content: "Resumo do dia: agendamentos, faturamento e clientes." },
      { property: "og:title", content: "Visão geral — Painel Lu IA Studio" },
      { property: "og:description", content: "Resumo do dia da sua agenda e do seu faturamento." },
    ],
  }),
  component: VisaoGeral,
});

function VisaoGeral() {
  return (
    <div>
      <p className="text-eyebrow">Sexta-feira, 31 de julho</p>
      <h1 className="mt-1 text-3xl">Olá, Luana</h1>
      <p className="mt-1 text-muted-foreground">Aqui está o resumo do seu dia.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metrica
          icon={CalendarCheck}
          titulo="Agendamentos de hoje"
          valor={String(agendamentosHoje.length)}
          detalhe="1 aguardando análise"
        />
        <Metrica
          icon={TrendingUp}
          titulo="Faturamento do mês"
          valor={brl(financeiro.mes)}
          detalhe={`Ticket médio ${brl(financeiro.ticket)}`}
        />
        <Metrica
          icon={Users}
          titulo="Clientes cadastradas"
          valor={String(clientes.length * 32)}
          detalhe="+9 neste mês"
        />
        <Metrica
          icon={Clock}
          titulo="Horários disponíveis hoje"
          valor={String(horariosDisponiveis.length)}
          detalhe={horariosDisponiveis.slice(0, 3).join(" · ")}
        />
        <Metrica
          icon={Star}
          titulo="Serviço mais procurado"
          valor="Fibra de vidro"
          detalhe="38% dos agendamentos"
        />
        <Metrica
          icon={UserRound}
          titulo="Próximos atendimentos"
          valor={String(proximosAtendimentos.length)}
          detalhe="nos próximos 3 dias"
        />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-2xl">Agendamentos de hoje</h2>
          <Card className="divide-y p-0">
            {agendamentosHoje.map((a) => (
              <div key={a.hora} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 px-5 py-4">
                <span className="text-sm font-medium">{a.hora}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.cliente}</p>
                  <p className="truncate text-sm text-muted-foreground">{a.servico}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="rounded-full font-normal">
                      {a.formato}
                    </Badge>
                    <Badge
                      variant={a.status === "Confirmado" ? "secondary" : "default"}
                      className="rounded-full font-normal"
                    >
                      {a.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-2xl">Próximos atendimentos</h2>
          <Card className="divide-y p-0">
            {proximosAtendimentos.map((a) => (
              <div key={a.cliente} className="flex items-center justify-between px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.cliente}</p>
                  <p className="truncate text-sm text-muted-foreground">{a.servico}</p>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {a.data} · {a.hora}
                </span>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </div>
  );
}

function Metrica({
  icon: Icon,
  titulo,
  valor,
  detalhe,
}: {
  icon: typeof Users;
  titulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <Card className="gap-2 p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{titulo}</span>
      </div>
      <p className="font-display text-3xl">{valor}</p>
      <p className="text-xs text-muted-foreground">{detalhe}</p>
    </Card>
  );
}
