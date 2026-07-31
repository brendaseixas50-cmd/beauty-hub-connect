import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDemo } from "@/data/negocio";
import { avisoDemo } from "@/components/acao-demo";

export type NovoAgendamento = {
  hora: string;
  cliente: string;
  servico: string;
  formato: string;
  status: string;
  profissional: string;
};

/**
 * Fluxo interno de novo agendamento (painel). Sem banco: o registro criado
 * entra apenas na lista da sessão atual.
 */
export function DialogoAgendamento({
  gatilho,
  onCriar,
  horaInicial,
  profissionalInicial,
}: {
  gatilho: ReactNode;
  onCriar: (a: NovoAgendamento) => void;
  horaInicial?: string | undefined;
  profissionalInicial?: string | undefined;
}) {
  const { servicos, profissionais, horariosDisponiveis, rotulos } = useDemo();
  const [aberto, setAberto] = useState(false);
  const [cliente, setCliente] = useState("");
  const [servico, setServico] = useState(servicos[0]?.nome ?? "");
  const [profissional, setProfissional] = useState(
    profissionalInicial ?? profissionais[0]?.nome ?? "",
  );
  const [hora, setHora] = useState(horaInicial ?? horariosDisponiveis[0] ?? "09:00");
  const [obs, setObs] = useState("");

  const salvar = () => {
    onCriar({
      hora,
      cliente: cliente.trim() || "Cliente sem nome",
      servico,
      formato: "No espaço",
      status: "Confirmado",
      profissional,
    });
    setAberto(false);
    setCliente("");
    setObs("");
    avisoDemo(
      "Agendamento criado na agenda de hoje",
      `${hora} · ${servico} · ${profissional} (dados de demonstração)`,
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            Preencha os dados do atendimento. Nesta etapa do protótipo o registro fica só nesta
            sessão.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ag-cliente">Cliente</Label>
            <Input
              id="ag-cliente"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome do cliente"
            />
          </div>

          <Campo titulo="Serviço">
            {servicos.map((s) => (
              <Chip key={s.id} ativo={servico === s.nome} onClick={() => setServico(s.nome)}>
                {s.nome}
              </Chip>
            ))}
          </Campo>

          <Campo titulo={rotulos.profissionalSingular}>
            {profissionais.map((p) => (
              <Chip
                key={p.id}
                ativo={profissional === p.nome}
                onClick={() => setProfissional(p.nome)}
              >
                {p.nome}
              </Chip>
            ))}
          </Campo>

          <Campo titulo="Horário">
            {horariosDisponiveis.map((h) => (
              <Chip key={h} ativo={hora === h} onClick={() => setHora(h)}>
                {h}
              </Chip>
            ))}
          </Campo>

          <div className="grid gap-1.5">
            <Label htmlFor="ag-obs">Observações</Label>
            <Textarea
              id="ag-obs"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Preferências, alergias, referências…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button className="rounded-full" onClick={salvar}>
            Salvar agendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-eyebrow">{titulo}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
        ativo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}
