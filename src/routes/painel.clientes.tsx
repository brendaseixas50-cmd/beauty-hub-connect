import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDemo } from "@/data/negocio";

export const Route = createFileRoute("/painel/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Painel Lu IA Studio" },
      { name: "description", content: "Ficha das clientes com histórico, aniversário e observações." },
      { property: "og:title", content: "Clientes — Painel Lu IA Studio" },
      { property: "og:description", content: "Histórico, contatos e observações das suas clientes." },
    ],
  }),
  component: Clientes,
});

function Clientes() {
  const { clientes, rotulos } = useDemo();
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow">Relacionamento</p>
          <h1 className="mt-1 text-3xl">Clientes</h1>
        </div>
        <Button className="shrink-0 rounded-full">
          <Plus className="h-4 w-4" /> {rotulos.clientes.startsWith("Clientes cadastradas") ? "Nova cliente" : "Novo cliente"}
        </Button>

      </div>

      <div className="relative mt-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou telefone" className="pl-9" />
      </div>

      <div className="mt-6 grid gap-3">
        {clientes.map((c) => (
          <Card key={c.id} className="gap-3 p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <p className="truncate text-lg">{c.nome}</p>
                <p className="text-sm text-muted-foreground">{c.telefone}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 rounded-full font-normal">
                {c.historico} atendimentos
              </Badge>
            </div>
            <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Info label="Aniversário" valor={c.aniversario} />
              <Info label="Endereço" valor={c.endereco} />
              <Info label="Último atendimento" valor={c.ultimo} />
              <Info label="Próximo agendamento" valor={c.proximo} />
            </div>
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              {c.observacoes}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-full">
                Ver histórico
              </Button>
              <Button variant="outline" size="sm" className="rounded-full">
                Editar ficha
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <p className="min-w-0">
      <span className="text-muted-foreground">{label}: </span>
      {valor}
    </p>
  );
}
