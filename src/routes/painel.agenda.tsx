import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemo, useNegocio } from "@/data/negocio";

export const Route = createFileRoute("/painel/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Painel Lu IA Studio" },
      { name: "description", content: "Visualize sua agenda por dia, semana e mês." },
      { property: "og:title", content: "Agenda — Painel Lu IA Studio" },
      { property: "og:description", content: "Agenda por dia, semana e mês." },
    ],
  }),
  component: Agenda,
});

function Agenda() {
  const { tipo } = useNegocio();
  const { agendamentosHoje, horariosDisponiveis, semana, profissionais, fila, encaixes, rotulos } =
    useDemo();
  const barbearia = tipo === "barbearia";
  const [filtro, setFiltro] = useState("Qualquer profissional disponível");

  const lista =
    filtro === "Qualquer profissional disponível"
      ? agendamentosHoje
      : agendamentosHoje.filter((a) => a.profissional === filtro);

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow">Agenda</p>
          <h1 className="mt-1 truncate text-3xl">Julho / Agosto 2026</h1>
        </div>
        <Button className="shrink-0 rounded-full">Novo agendamento</Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {["Qualquer profissional disponível", ...profissionais.map((p) => p.nome)].map((n) => (
          <button
            key={n}
            onClick={() => setFiltro(n)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              filtro === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <Tabs defaultValue="dia" className="mt-6">
        <TabsList>
          <TabsTrigger value="dia">Dia</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Mês</TabsTrigger>
        </TabsList>

        <TabsContent value="dia" className="mt-6 space-y-3">
          {lista.length === 0 && (
            <Card className="p-5 text-sm text-muted-foreground">
              Nenhum atendimento para este {rotulos.profissionalSingular.toLowerCase()} hoje.
            </Card>
          )}
          {lista.map((a) => (
            <Card key={a.hora} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 p-5">
              <span className="font-medium">{a.hora}</span>
              <div className="min-w-0">
                <p className="truncate font-medium">{a.cliente}</p>
                <p className="truncate text-sm text-muted-foreground">{a.servico}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="rounded-full font-normal">
                    {a.formato}
                  </Badge>
                  <Badge variant="outline" className="rounded-full font-normal">
                    {a.profissional}
                  </Badge>
                  <Badge variant="secondary" className="rounded-full font-normal">
                    {a.status}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
          <Card className="gap-2 p-5">
            <p className="text-eyebrow">Horários livres hoje</p>
            <div className="flex flex-wrap gap-2">
              {horariosDisponiveis.map((h) => (
                <Badge key={h} variant="outline" className="rounded-full font-normal">
                  {h}
                </Badge>
              ))}
            </div>
          </Card>

          {barbearia && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="gap-3 p-5">
                <p className="text-eyebrow">Fila de atendimento</p>
                {fila.map((f) => (
                  <div key={f.cliente} className="flex items-center justify-between text-sm">
                    <span className="truncate">
                      {f.cliente} · {f.servico}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{f.espera}</span>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="mt-1 rounded-full">
                  Chamar próximo
                </Button>
              </Card>
              <Card className="gap-3 p-5">
                <p className="text-eyebrow">Pedidos de encaixe</p>
                {encaixes.map((e) => (
                  <div key={e.cliente} className="flex items-center justify-between text-sm">
                    <span className="truncate">
                      {e.horario} · {e.cliente}
                    </span>
                    <Badge variant="outline" className="shrink-0 rounded-full font-normal">
                      {e.status}
                    </Badge>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="mt-1 rounded-full">
                  Abrir encaixe
                </Button>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="semana" className="mt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {semana.map((d) => (
              <Card key={d.dia} className="gap-2 p-4">
                <p className="text-eyebrow">{d.dia}</p>
                {d.itens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem atendimentos</p>
                ) : (
                  d.itens.map((i) => (
                    <p key={i} className="rounded-md bg-secondary px-2 py-1.5 text-xs">
                      {i}
                    </p>
                  ))
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="mes" className="mt-6">
          <Card className="p-4">
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                <span key={i} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: 31 }).map((_, i) => {
                const qtd = [3, 0, 2, 4, 1, 0, 5][i % 7] ?? 0;
                return (
                  <div key={i} className="aspect-square rounded-lg border p-1.5 text-left text-xs">
                    <span className={i === 30 ? "font-bold" : "text-muted-foreground"}>
                      {i + 1}
                    </span>
                    {qtd > 0 && (
                      <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                        {qtd} ag.
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
