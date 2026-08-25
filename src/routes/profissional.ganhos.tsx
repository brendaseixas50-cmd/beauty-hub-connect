import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { brl } from "@/modules/mvp/domain";
import {
  competenceMonth,
  dateLabel,
  ledgerKindLabels,
  monthLabel,
  summarizeLedger,
  type LedgerEntry,
} from "@/modules/finance/comissoes";
import { getProfessionalEarnings } from "@/modules/professional-panel/server";

export const Route = createFileRoute("/profissional/ganhos")({
  staleTime: 30_000,
  loader: () => getProfessionalEarnings(),
  head: () => ({
    meta: [
      { title: "Meus ganhos — Painel Profissional" },
      {
        name: "description",
        content: "Comissões geradas, vales recebidos, pagamentos e saldo a receber do profissional.",
      },
    ],
  }),
  component: ProfessionalEarnings,
  errorComponent: () => (
    <Card className="p-6 text-center text-sm text-muted-foreground">
      Não foi possível carregar seus ganhos agora. Atualize a página em alguns instantes.
    </Card>
  ),
});

function ProfessionalEarnings() {
  const { entries } = Route.useLoaderData();
  const months = useMemo(() => {
    const unique = new Set(entries.map((entry) => competenceMonth(entry)));
    return Array.from(unique).sort().reverse();
  }, [entries]);
  const [month, setMonth] = useState<string>("all");
  const filtered = useMemo(
    () => (month === "all" ? entries : entries.filter((entry) => competenceMonth(entry) === month)),
    [entries, month],
  );
  const summary = useMemo(() => summarizeLedger(filtered), [filtered]);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Meus ganhos</h1>
        <p className="text-sm text-muted-foreground">
          Comissões dos atendimentos concluídos, vales e pagamentos já recebidos.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <ResumoCard titulo="Comissões" valor={summary.commissionCents} />
        <ResumoCard titulo="Vales" valor={summary.advanceCents} />
        <ResumoCard titulo="Pagamentos" valor={summary.paymentCents} />
        <ResumoCard titulo="Saldo a receber" valor={summary.balanceCents} destaque />
      </div>

      {months.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FiltroMes ativo={month === "all"} onClick={() => setMonth("all")} label="Tudo" />
          {months.map((item) => (
            <FiltroMes
              key={item}
              ativo={month === item}
              onClick={() => setMonth(item)}
              label={monthLabel(item)}
            />
          ))}
        </div>
      ) : null}

      <Card className="divide-y p-0">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma movimentação registrada nesta competência.
          </p>
        ) : (
          filtered.map((entry) => <LinhaGanho key={entry.id} entry={entry} />)
        )}
      </Card>
    </section>
  );
}

function ResumoCard({
  titulo,
  valor,
  destaque,
}: {
  titulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <Card className={`gap-1 p-4 ${destaque ? "border-primary" : ""}`}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`text-lg font-semibold ${destaque ? "text-primary" : ""}`}>{brl(valor)}</p>
    </Card>
  );
}

function FiltroMes({
  ativo,
  label,
  onClick,
}: {
  ativo: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={ativo ? "default" : "outline"}
      className="shrink-0 capitalize"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function LinhaGanho({ entry }: { entry: LedgerEntry }) {
  const negativo = entry.kind === "advance" || entry.kind === "payment" || entry.amountCents < 0;
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{entry.description}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {dateLabel(entry.competenceDate)}
          {entry.notes ? ` — ${entry.notes}` : ""}
        </p>
        <Badge variant="secondary" className="mt-1.5">
          {ledgerKindLabels[entry.kind]}
        </Badge>
      </div>
      <p className={`shrink-0 text-sm font-semibold ${negativo ? "text-destructive" : ""}`}>
        {negativo ? "−" : "+"}
        {brl(Math.abs(entry.amountCents))}
      </p>
    </div>
  );
}
