import { createFileRoute } from "@tanstack/react-router";
import { Plus, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDemo } from "@/data/negocio";
import { brl } from "@/data/demo";

export const Route = createFileRoute("/painel/profissionais")({
  head: () => ({
    meta: [
      { title: "Profissionais — Painel Lu IA Studio" },
      {
        name: "description",
        content: "Equipe, agenda individual, comissão e desempenho de cada profissional.",
      },
      { property: "og:title", content: "Profissionais — Painel Lu IA Studio" },
      { property: "og:description", content: "Equipe, comissões e desempenho individual." },
    ],
  }),
  component: Profissionais,
});

function Profissionais() {
  const { profissionais, rotulos, fila, financeiro } = useDemo();
  const maior = Math.max(...profissionais.map((p) => p.faturamento));

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow">{rotulos.equipeEyebrow}</p>
          <h1 className="mt-1 text-3xl">{rotulos.profissionais}</h1>
        </div>
        <Button className="shrink-0 rounded-full">
          <Plus className="h-4 w-4" /> Novo {rotulos.profissionalSingular.toLowerCase()}
        </Button>
      </div>

      <div className="mt-8 grid gap-3">
        {profissionais.map((p) => (
          <Card key={p.id} className="gap-4 p-5">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4">
              <img
                src={p.foto}
                alt={p.nome}
                loading="lazy"
                width={800}
                height={800}
                className="h-14 w-14 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-lg">{p.nome}</p>
                <p className="truncate text-sm text-muted-foreground">{p.funcao}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.especialidades.map((e) => (
                    <Badge key={e} variant="outline" className="rounded-full font-normal">
                      {e}
                    </Badge>
                  ))}
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0 rounded-full font-normal">
                {p.comissao}% comissão
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-eyebrow">Atendimentos no mês</p>
                <p className="font-display text-2xl">{p.atendimentosMes}</p>
              </div>
              <div>
                <p className="text-eyebrow">Faturamento gerado</p>
                <p className="font-display text-2xl">{brl(p.faturamento)}</p>
              </div>
              <div>
                <p className="text-eyebrow">Comissão estimada</p>
                <p className="font-display text-2xl">
                  {brl(Math.round((p.faturamento * p.comissao) / 100))}
                </p>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" /> Desempenho relativo
              </div>
              <Progress value={(p.faturamento / maior) * 100} />
            </div>

            <div>
              <p className="text-eyebrow">Agenda individual de hoje</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.agendaHoje.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Sem atendimentos hoje</span>
                ) : (
                  p.agendaHoje.map((a) => (
                    <span key={a} className="rounded-md bg-secondary px-2 py-1 text-xs">
                      {a}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-full">
                Ver agenda
              </Button>
              <Button variant="outline" size="sm" className="rounded-full">
                Editar comissão
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-2xl">Fila de atendimento</h2>
          <Card className="divide-y p-0">
            {fila.map((f) => (
              <div key={f.cliente} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{f.cliente}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {f.servico} · {f.profissional}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 rounded-full font-normal">
                  {f.espera}
                </Badge>
              </div>
            ))}
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-2xl">Rateio do faturamento</h2>
          <Card className="gap-3 p-5">
            <p className="text-sm text-muted-foreground">
              Faturamento do mês: <span className="font-medium text-foreground">{brl(financeiro.mes)}</span>
            </p>
            {profissionais.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{p.nome}</span>
                <span className="shrink-0 font-medium">
                  {Math.round((p.faturamento / financeiro.mes) * 100)}%
                </span>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </div>
  );
}
