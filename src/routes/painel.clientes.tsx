import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDemo } from "@/data/negocio";
import { DialogoInfo } from "@/components/dialogo-info";
import { avisoDemo } from "@/components/acao-demo";

export const Route = createFileRoute("/painel/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Painel Lu IA Studio" },
      {
        name: "description",
        content: "Ficha das clientes com histórico, aniversário e observações.",
      },
      { property: "og:title", content: "Clientes — Painel Lu IA Studio" },
      {
        property: "og:description",
        content: "Histórico, contatos e observações das suas clientes.",
      },
    ],
  }),
  component: Clientes,
});

type Cliente = ReturnType<typeof useDemo>["clientes"][number];

function Clientes() {
  const { clientes, rotulos, servicos } = useDemo();
  const feminino = rotulos.clientes.toLowerCase().includes("cadastradas");
  const [busca, setBusca] = useState("");
  const [novos, setNovos] = useState<Cliente[]>([]);

  const todos = [...novos, ...clientes];
  const termo = busca.trim().toLowerCase();
  const lista = termo
    ? todos.filter(
        (c) => c.nome.toLowerCase().includes(termo) || c.telefone.toLowerCase().includes(termo),
      )
    : todos;

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow">Relacionamento</p>
          <h1 className="mt-1 text-3xl">Clientes</h1>
        </div>
        <NovoCliente feminino={feminino} onCriar={(c) => setNovos((l) => [c, ...l])} />
      </div>

      <div className="relative mt-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          className="pl-9"
          aria-label="Buscar cliente"
        />
      </div>

      <div className="mt-6 grid gap-3">
        {lista.length === 0 && (
          <Card className="p-5 text-sm text-muted-foreground">
            Nenhum resultado para “{busca}”.
          </Card>
        )}
        {lista.map((c) => (
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
              <DialogoInfo
                gatilho={
                  <Button variant="outline" size="sm" className="rounded-full">
                    Ver histórico
                  </Button>
                }
                titulo={`Histórico de ${c.nome}`}
                descricao={`${c.historico} atendimentos registrados`}
                acao="Enviar mensagem"
                onAcao={() => avisoDemo(`Mensagem preparada para ${c.nome}`)}
              >
                {servicos.slice(0, 4).map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2"
                  >
                    <span className="min-w-0 truncate">{s.nome}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {["12/07", "26/06", "05/06", "18/05"][i]}
                    </span>
                  </div>
                ))}
                <p className="text-muted-foreground">
                  Último: {c.ultimo} · Próximo: {c.proximo}
                </p>
              </DialogoInfo>
              <DialogoInfo
                gatilho={
                  <Button variant="outline" size="sm" className="rounded-full">
                    Editar ficha
                  </Button>
                }
                titulo={`Ficha de ${c.nome}`}
                descricao="Alterações ficam apenas nesta sessão de demonstração."
                acao="Salvar ficha"
                onAcao={() => avisoDemo("Ficha atualizada")}
              >
                <Campo rotulo="Telefone" valor={c.telefone} />
                <Campo rotulo="Aniversário" valor={c.aniversario} />
                <Campo rotulo="Endereço" valor={c.endereco} />
                <div className="grid gap-1.5">
                  <Label htmlFor={`obs-${c.id}`}>Observações</Label>
                  <Textarea id={`obs-${c.id}`} defaultValue={c.observacoes} />
                </div>
              </DialogoInfo>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NovoCliente({ feminino, onCriar }: { feminino: boolean; onCriar: (c: Cliente) => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const salvar = () => {
    const nomeFinal = nome.trim() || (feminino ? "Nova cliente" : "Novo cliente");
    onCriar({
      id: `novo-${Date.now()}`,
      nome: nomeFinal,
      telefone: telefone.trim() || "(00) 00000-0000",
      aniversario: "—",
      endereco: "—",
      ultimo: "—",
      proximo: "—",
      historico: 0,
      observacoes: observacoes.trim() || "Cadastro criado no modo demonstração.",
    });
    setAberto(false);
    setNome("");
    setTelefone("");
    setObservacoes("");
    avisoDemo(`${nomeFinal} adicionado à lista`);
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className="shrink-0 rounded-full">
          <Plus className="h-4 w-4" /> {feminino ? "Nova cliente" : "Novo cliente"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{feminino ? "Nova cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            Cadastro demonstrativo — os dados ficam apenas nesta sessão.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cli-nome">Nome</Label>
            <Input id="cli-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cli-tel">Telefone</Label>
            <Input
              id="cli-tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(11) 90000-0000"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cli-obs">Observações</Label>
            <Textarea
              id="cli-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button className="rounded-full" onClick={salvar}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="grid gap-1.5">
      <Label>{rotulo}</Label>
      <Input defaultValue={valor} />
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
