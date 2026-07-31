import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agendamentosHoje, horariosDisponiveis } from "@/data/demo";

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

const SEMANA = [
  { dia: "Seg 28", itens: [] as string[] },
  { dia: "Ter 29", itens: ["09:00 Patrícia", "14:00 Renata"] },
  { dia: "Qua 30", itens: ["10:30 Marina"] },
  { dia: "Qui 31", itens: ["09:00 Patrícia", "11:00 Marina", "14:30 Juliana", "17:00 Beatriz"] },
  { dia: "Sex 01", itens: ["10:00 Camila"] },
  { dia: "Sáb 02", itens: ["08:30 Renata", "13:00 Ana"] },
  { dia: "Dom 03", itens: [] },
];

function Agenda() {
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow">Agenda</p>
          <h1 className="mt-1 truncate text-3xl">Julho / Agosto 2026</h1>
        </div>
        <Button className="shrink-0 rounded-full">Novo agendamento</Button>
      </div>

      <Tabs defaultValue="dia" className="mt-8">
        <TabsList>
          <TabsTrigger value="dia">Dia</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Mês</TabsTrigger>
        </TabsList>

        <TabsContent value="dia" className="mt-6 space-y-3">
          {agendamentosHoje.map((a) => (
            <Card key={a.hora} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 p-5">
              <span className="font-medium">{a.hora}</span>
              <div className="min-w-0">
                <p className="truncate font-medium">{a.cliente}</p>
                <p className="truncate text-sm text-muted-foreground">{a.servico}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="rounded-full font-normal">
                    {a.formato}
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
        </TabsContent>

        <TabsContent value="semana" className="mt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {SEMANA.map((d) => (
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
                  <div
                    key={i}
                    className="aspect-square rounded-lg border p-1.5 text-left text-xs"
                  >
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
