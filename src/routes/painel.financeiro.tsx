import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Pencil, Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { DeleteButton, EmptyState, PageHeader, SearchField } from "@/components/mvp-page";
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
import { brl, centsFromInput, type FinancialEntry } from "@/modules/mvp/domain";
import {
  deleteFinancialEntry,
  listFinancialEntries,
  saveFinancialEntry,
} from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";
import { LuviContextBridge } from "@/modules/luvi-core/context";

export const Route = createFileRoute("/painel/financeiro")({
  loader: () => listFinancialEntries(),
  head: () => ({ meta: [{ title: "Financeiro — Beauty Hub Connect" }] }),
  component: FinancePage,
});

function FinancePage() {
  const entries = Route.useLoaderData();
  const remove = useServerFn(deleteFinancialEntry);
  const action = useMvpAction();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<FinancialEntry | null>();
  const term = search.trim().toLowerCase();
  const filtered = entries.filter(
    (entry) =>
      (!term ||
        [entry.description, entry.category, entry.payment_method].some((value) =>
          value?.toLowerCase().includes(term),
        )) &&
      (type === "all" || entry.entry_type === type) &&
      (status === "all" || entry.status === status),
  );
  const totals = useMemo(
    () =>
      entries.reduce(
        (result, entry) => {
          if (entry.status === "paid")
            result[entry.entry_type === "income" ? "income" : "expense"] += entry.amount_cents;
          if (entry.status === "pending")
            result.pending +=
              entry.entry_type === "income" ? entry.amount_cents : -entry.amount_cents;
          return result;
        },
        { income: 0, expense: 0, pending: 0 },
      ),
    [entries],
  );

  return (
    <div>
      <LuviContextBridge facts={{ financialEntries: entries.length }} />
      <PageHeader
        eyebrow="Controle financeiro"
        title="Financeiro"
        description="Registre receitas e despesas, acompanhe pendências e exporte seus dados."
        action={
          <Button className="rounded-full" onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" /> Novo lançamento
          </Button>
        }
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Receitas pagas" value={brl(totals.income)} />
        <Metric title="Despesas pagas" value={brl(totals.expense)} />
        <Metric title="Saldo realizado" value={brl(totals.income - totals.expense)} />
        <Metric title="Saldo pendente" value={brl(totals.pending)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar descrição, categoria ou forma"
        />
        <select
          aria-label="Filtrar tipo"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">Receitas e despesas</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
        </select>
        <select
          aria-label="Filtrar status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="paid">Pago</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <Button variant="outline" onClick={() => exportCsv(filtered)}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento encontrado"
          description="Cadastre uma receita ou despesa para iniciar o controle financeiro."
        />
      ) : (
        <Card className="mt-6 divide-y p-0">
          {filtered.map((entry) => (
            <div key={entry.id} className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="truncate font-medium">{entry.description}</p>
                <p className="text-sm text-muted-foreground">
                  {entry.category || "Sem categoria"} · vencimento{" "}
                  {new Date(entry.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={entry.entry_type === "income" ? "secondary" : "outline"}>
                    {entry.entry_type === "income" ? "Receita" : "Despesa"}
                  </Badge>
                  <Badge variant={entry.status === "cancelled" ? "destructive" : "outline"}>
                    {statusLabel(entry.status)}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <span
                  className={`font-medium ${entry.entry_type === "income" ? "text-success" : "text-destructive"}`}
                >
                  {entry.entry_type === "income" ? "+" : "-"} {brl(entry.amount_cents)}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(entry)}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <DeleteButton
                    label={entry.description}
                    pending={action.pending}
                    onConfirm={() =>
                      void action.run(
                        () => remove({ data: { id: entry.id } }),
                        "Lançamento excluído.",
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
      {editing !== undefined ? (
        <FinanceDialog entry={editing} onClose={() => setEditing(undefined)} />
      ) : null}
    </div>
  );
}

function FinanceDialog({ entry, onClose }: { entry: FinancialEntry | null; onClose: () => void }) {
  const save = useServerFn(saveFinancialEntry);
  const action = useMvpAction();
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await action.run(
      () =>
        save({
          data: {
            id: entry?.id,
            entryType: String(form.get("entryType")) as "income" | "expense",
            description: String(form.get("description")),
            category: String(form.get("category")),
            amountCents: centsFromInput(String(form.get("amount"))),
            dueDate: String(form.get("dueDate")),
            status: String(form.get("status")) as "pending" | "paid" | "cancelled",
            paymentMethod: String(form.get("paymentMethod")),
            notes: String(form.get("notes")),
          },
        }),
      entry ? "Lançamento atualizado." : "Lançamento criado.",
    );
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>Informe os dados financeiros reais da operação.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <SelectField label="Tipo" name="entryType" defaultValue={entry?.entry_type ?? "income"}>
            <option value="income">Receita</option>
            <option value="expense">Despesa</option>
          </SelectField>
          <Field
            label="Descrição"
            name="description"
            defaultValue={entry?.description ?? ""}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria" name="category" defaultValue={entry?.category ?? ""} />
            <Field
              label="Valor (R$)"
              name="amount"
              inputMode="decimal"
              defaultValue={entry ? (entry.amount_cents / 100).toFixed(2).replace(".", ",") : ""}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Vencimento"
              name="dueDate"
              type="date"
              defaultValue={entry?.due_date ?? new Date().toISOString().slice(0, 10)}
              required
            />
            <SelectField label="Status" name="status" defaultValue={entry?.status ?? "pending"}>
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="cancelled">Cancelado</option>
            </SelectField>
          </div>
          <Field
            label="Forma de pagamento"
            name="paymentMethod"
            defaultValue={entry?.payment_method ?? ""}
          />
          <div className="grid gap-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" name="notes" defaultValue={entry?.notes ?? ""} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={action.pending}>
              {action.pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card className="gap-1 p-5">
      <p className="text-eyebrow">{title}</p>
      <p className="font-display text-2xl">{value}</p>
    </Card>
  );
}
function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
function SelectField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="h-10 rounded-md border bg-background px-3 text-sm"
      >
        {children}
      </select>
    </div>
  );
}
function statusLabel(status: string) {
  return (
    ({ pending: "Pendente", paid: "Pago", cancelled: "Cancelado" } as Record<string, string>)[
      status
    ] ?? status
  );
}
function exportCsv(entries: FinancialEntry[]) {
  const rows = [
    ["Tipo", "Descrição", "Categoria", "Valor", "Vencimento", "Status"],
    ...entries.map((entry) => [
      entry.entry_type,
      entry.description,
      entry.category ?? "",
      (entry.amount_cents / 100).toFixed(2),
      entry.due_date,
      entry.status,
    ]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "financeiro.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
