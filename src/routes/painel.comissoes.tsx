import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { EmptyState, PageHeader } from "@/components/mvp-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brl, centsFromInput } from "@/modules/mvp/domain";
import {
  competenceMonth,
  dateLabel,
  ledgerKindHelp,
  ledgerKindLabels,
  monthLabel,
  summarizeLedger,
} from "@/modules/finance/comissoes";
import { listProfessionalLedger, saveProfessionalLedgerEntry } from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";
import { LuviContextBridge } from "@/modules/luvi-core/context";

type Kind = "advance" | "payment" | "adjustment";

export const Route = createFileRoute("/painel/comissoes")({
  staleTime: 30_000,
  loader: () => listProfessionalLedger(),
  head: () => ({
    meta: [
      { title: "Comissões e repasses — LuBeauty Pro e LuBarber Pro" },
      {
        name: "description",
        content:
          "Comissões geradas por atendimento, vales, pagamentos e saldo a receber de cada profissional.",
      },
      { property: "og:title", content: "Comissões e repasses da equipe" },
      {
        property: "og:description",
        content: "Controle o quanto cada profissional gerou, recebeu e ainda tem a receber.",
      },
    ],
  }),
  component: CommissionsPage,
});

function CommissionsPage() {
  const data = Route.useLoaderData();
  const action = useMvpAction();
  const [dialogFor, setDialogFor] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("payment");
  const [month, setMonth] = useState("all");

  const months = useMemo(() => {
    const unique = new Set(data.entries.map((entry) => competenceMonth(entry)));
    return Array.from(unique).sort().reverse();
  }, [data.entries]);

  const entries = useMemo(
    () =>
      month === "all"
        ? data.entries
        : data.entries.filter((entry) => competenceMonth(entry) === month),
    [data.entries, month],
  );

  const total = useMemo(() => summarizeLedger(entries), [entries]);
  const professional = data.professionals.find((item) => item.id === dialogFor) ?? null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = centsFromInput(String(form.get("amount") ?? "0"));
    const ok = await action.run(
      () =>
        saveProfessionalLedgerEntry({
          data: {
            professionalId: String(form.get("professionalId")),
            kind,
            amountCents: kind === "adjustment" ? amount * Number(form.get("sign") ?? 1) : amount,
            competenceDate: String(form.get("competenceDate")),
            description: String(form.get("description")),
            notes: String(form.get("notes") ?? "") || undefined,
          },
        }),
      "Movimentação registrada.",
    );
    if (ok) setDialogFor(null);
  }

  return (
    <div className="space-y-6">
      <LuviContextBridge facts={{ financialEntries: data.entries.length }} />
      <PageHeader
        eyebrow="Equipe e repasses"
        title="Comissões e repasses"
        description={
          data.commissionTrigger === "paid"
            ? "As comissões são geradas quando a receita do atendimento é confirmada."
            : "As comissões são geradas assim que o atendimento é concluído."
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Resumo titulo="Comissões geradas" valor={total.commissionCents} />
        <Resumo titulo="Vales concedidos" valor={total.advanceCents} />
        <Resumo titulo="Pagamentos feitos" valor={total.paymentCents} />
        <Resumo titulo="Saldo a pagar" valor={total.balanceCents} destaque />
      </div>

      {months.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={month === "all" ? "default" : "outline"}
            onClick={() => setMonth("all")}
          >
            Todas as competências
          </Button>
          {months.map((item) => (
            <Button
              key={item}
              size="sm"
              className="capitalize"
              variant={month === item ? "default" : "outline"}
              onClick={() => setMonth(item)}
            >
              {monthLabel(item)}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {data.professionals.length === 0 ? (
          <EmptyState
            title="Nenhum profissional cadastrado"
            description="Cadastre a equipe para acompanhar comissões e repasses."
          />
        ) : (
          data.professionals.map((item) => {
            const resumo = summarizeLedger(
              entries.filter((entry) => entry.professionalId === item.id),
            );
            const linhas = entries.filter((entry) => entry.professionalId === item.id);
            return (
              <Card key={item.id} className="gap-3 p-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Comissão de {item.commissionPercent.toLocaleString("pt-BR")}%
                      {item.active ? "" : " — acesso desativado"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setKind("payment");
                      setDialogFor(item.id);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Lançar
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-muted-foreground">
                    Comissões: <span className="font-medium text-foreground">{brl(resumo.commissionCents)}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Vales: <span className="font-medium text-foreground">{brl(resumo.advanceCents)}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Pagos: <span className="font-medium text-foreground">{brl(resumo.paymentCents)}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Saldo: <span className="font-semibold text-primary">{brl(resumo.balanceCents)}</span>
                  </p>
                </div>
                <div className="divide-y rounded-md border">
                  {linhas.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">
                      Nenhuma movimentação nesta competência.
                    </p>
                  ) : (
                    linhas.slice(0, 8).map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{entry.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {dateLabel(entry.competenceDate)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="secondary">{ledgerKindLabels[entry.kind]}</Badge>
                          <span className="text-sm font-medium">{brl(entry.amountCents)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={Boolean(dialogFor)} onOpenChange={(open) => setDialogFor(open ? dialogFor : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova movimentação</DialogTitle>
            <DialogDescription>
              {professional ? `${professional.name} — ` : ""}
              {ledgerKindHelp[kind]} O histórico é permanente: correções entram como ajuste.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submit}>
            <input type="hidden" name="professionalId" value={dialogFor ?? ""} />
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <div className="flex flex-wrap gap-2">
                {(["payment", "advance", "adjustment"] as Kind[]).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={kind === option ? "default" : "outline"}
                    onClick={() => setKind(option)}
                  >
                    {ledgerKindLabels[option]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="amount">Valor</Label>
                <Input id="amount" name="amount" inputMode="decimal" required placeholder="0,00" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="competenceDate">Competência</Label>
                <Input
                  id="competenceDate"
                  name="competenceDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </div>
            {kind === "adjustment" ? (
              <div className="grid gap-2">
                <Label htmlFor="sign">Efeito no saldo</Label>
                <select
                  id="sign"
                  name="sign"
                  className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                  defaultValue="1"
                >
                  <option value="1">Aumentar o saldo do profissional</option>
                  <option value="-1">Reduzir o saldo do profissional</option>
                </select>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Input id="description" name="description" required maxLength={160} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" name="notes" rows={2} maxLength={500} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={action.pending}>
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Resumo({
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
