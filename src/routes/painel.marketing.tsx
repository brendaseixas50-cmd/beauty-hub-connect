import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { brl } from "@/data/demo";
import { useDemo, useNegocio } from "@/data/negocio";

export const Route = createFileRoute("/painel/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing — Painel Lu IA Studio" },
      {
        name: "description",
        content: "Campanhas, assinaturas mensais e programa de fidelidade.",
      },
      { property: "og:title", content: "Marketing — Painel Lu IA Studio" },
      { property: "og:description", content: "Campanhas, assinaturas e fidelidade." },
    ],
  }),
  component: Marketing,
});

function Marketing() {
  const { tipo } = useNegocio();
  const { campanhas, assinaturas, fidelidade, combos } = useDemo();

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

      <section className="mt-10">
        <h2 className="mb-4 text-2xl">Assinaturas mensais</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {assinaturas.map((a) => (
            <Card key={a.nome} className="gap-2 p-5">
              <p className="text-eyebrow">{a.assinantes} assinantes</p>
              <h3 className="text-xl">{a.nome}</h3>
              <p className="font-display text-2xl">{brl(a.preco)}/mês</p>
              <ul className="mt-1 grid gap-1 text-sm text-muted-foreground">
                {a.beneficios.map((b) => (
                  <li key={b}>· {b}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 text-2xl">Programa de fidelidade</h2>
        <p className="mb-4 text-sm text-muted-foreground">{fidelidade.regra}</p>
        <Card className="gap-4 p-5">
          {fidelidade.clientes.map((c) => (
            <div key={c.nome}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="truncate">{c.nome}</span>
                <span className="shrink-0 text-muted-foreground">
                  {c.selos}/{c.meta} selos
                </span>
              </div>
              <Progress value={(c.selos / c.meta) * 100} />
            </div>
          ))}
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-2xl">
          {tipo === "barbearia" ? "Combos da barbearia" : "Combos de serviços"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {combos.map((c) => (
            <Card key={c.nome} className="gap-2 p-5">
              <p className="text-eyebrow">{c.duracao}</p>
              <h3 className="text-xl">{c.nome}</h3>
              <p className="text-sm text-muted-foreground">{c.itens.join(" + ")}</p>
              <p className="font-display text-2xl">{brl(c.preco)}</p>
            </Card>
          ))}
        </div>
      </section>

      <Card className="surface-soft mt-10 gap-2 p-6">
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
