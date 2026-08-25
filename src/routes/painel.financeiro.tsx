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
import { brl, centsFromInput } from "@/modules/mvp/domain";
import {
  deleteFinancialEntry,
  listFinanceLinkOptions,
  listFinancialEntries,
  saveFinancialEntry,
  type FinancialEntryWithLinks,
} from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";
import { LuviContextBridge } from "@/modules/luvi-core/context";

type LinkOptions = Awaited<ReturnType<typeof listFinanceLinkOptions>>;

const origens: { value: string; label: string }[] = [
  { value: "service", label: "Serviços" },
  { value: "product", label: "Produtos" },
  { value: "commission", label: "Comissões" },
  { value: "rent", label: "Aluguel / estrutura" },
  { value: "supply", label: "Insumos" },
  { value: "tax", label: "Impostos e taxas" },
  { value: "other", label: "Outros" },
];

function origemLabel(origin: string) {
  return origens.find((item) => item.value === origin)?.label ?? "Outros";
}

/** Competência é o mês de referência do lançamento (regime de competência). */
function mesDe(entry: FinancialEntryWithLinks) {
  return (entry.competence_date ?? entry.due_date).slice(0, 7);
}

export const Route = createFileRoute("/painel/financeiro")({
  staleTime: 60_000,
  loader: async () => {
    const [entries, options] = await Promise.all([
      listFinancialEntries(),
      listFinanceLinkOptions(),
    ]);
    return { entries, options };
  },
  head: () => ({
    meta: [
      { title: "Financeiro — LuBeauty Pro e LuBarber Pro" },
      {
        name: "description",
        content:
          "Receitas, despesas, competência mensal e vínculos com clientes, profissionais e produtos.",
      },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const { entries, options } = Route.useLoaderData();
  const remove = useServerFn(deleteFinancialEntry);
  const action = useMvpAction();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [origin, setOrigin] = useState("all");
  const [editing, setEditing] = useState<FinancialEntryWithLinks | null>();

  const meses = useMemo(() => {
    const atual = new Date().toISOString().slice(0, 7);
    return Array.from(new Set([atual, ...entries.map(mesDe)])).sort().reverse();
  }, [entries]);
  const [month, setMonth] = useState("all");

  const term = search.trim().toLowerCase();
  const filtered = entries.filter(
    (entry) =>
      (!term ||
        [
          entry.description,
          entry.category,
          entry.payment_method,
          entry.clients?.name,
          entry.professionals?.name,
          entry.products?.name,
        ].some((value) => value?.toLowerCase().includes(term))) &&
      (type === "all" || entry.entry_type === type) &&
      (status === "all" || entry.status === status) &&
      (origin === "all" || (entry.origin ?? "other") === origin) &&
      (month === "all" || mesDe(entry) === month),
  );

  const totals = useMemo(
    () =>
      filtered.reduce(
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
    [filtered],
  );

  const porOrigem = useMemo(() => {
    const mapa = new Map<string, { income: number; expense: number }>();
    for (const entry of filtered) {
      if (entry.status !== "paid") continue;
      const chave = entry.origin ?? "other";
      const atual = mapa.get(chave) ?? { income: 0, expense: 0 };
      atual[entry.entry_type === "income" ? "income" : "expense"] += entry.amount_cents;
      mapa.set(chave, atual);
    }
    return [...mapa.entries()].sort(
      (a, b) => b[1].income + b[1].expense - (a[1].income + a[1].expense),
    );
  }, [filtered]);

  return (
    <div>
      <LuviContextBridge facts={{ financialEntries: entries.length }} />
      <PageHeader
        eyebrow="Controle financeiro"
        title="Financeiro"
        description="Receitas e despesas por competência, com origem e vínculo real da operação."
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

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar descrição, categoria, cliente ou profissional"
        />
        <select
          aria-label="Filtrar competência"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="all">Todas as competências</option>
          {meses.map((item) => (
            <option key={item} value={item}>
              {new Date(item + "-01T12:00:00").toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric",
              })}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar tipo"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="all">Receitas e despesas</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
        </select>
        <select
          aria-label="Filtrar origem"
          value={origin}
          onChange={(event) => setOrigin(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="all">Todas as origens</option>
          {origens.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
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

      {porOrigem.length > 0 ? (
        <Card className="mt-6 gap-3 p-5">
          <p className="text-eyebrow">Realizado por origem</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {porOrigem.map(([chave, valores]) => (
              <div
                key={chave}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="truncate">{origemLabel(chave)}</span>
                <span className="whitespace-nowrap">
                  <span className="text-success">+{brl(valores.income)}</span>{" "}
                  <span className="text-destructive">-{brl(valores.expense)}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

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
                  {new Date(entry.due_date + "T12:00:00").toLocaleDateString("pt-BR")} ·
                  competência{" "}
                  {new Date((entry.competence_date ?? entry.due_date) + "T12:00:00").toLocaleDateString(
                    "pt-BR",
                    { month: "2-digit", year: "numeric" },
                  )}
                </p>
                {entry.clients?.name || entry.professionals?.name || entry.products?.name ? (
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {[
                      entry.clients?.name && `Cliente: ${entry.clients.name}`,
                      entry.professionals?.name && `Profissional: ${entry.professionals.name}`,
                      entry.products?.name && `Produto: ${entry.products.name}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={entry.entry_type === "income" ? "secondary" : "outline"}>
                    {entry.entry_type === "income" ? "Receita" : "Despesa"}
                  </Badge>
                  <Badge variant="outline">{origemLabel(entry.origin ?? "other")}</Badge>
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
        <FinanceDialog
          entry={editing}
          options={options}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}

function FinanceDialog({
  entry,
  options,
  onClose,
}: {
  entry: FinancialEntryWithLinks | null;
  options: LinkOptions;
  onClose: () => void;
}) {
  const save = useServerFn(saveFinancialEntry);
  const action = useMvpAction();
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const texto = (name: string) => String(form.get(name) ?? "");
    const ok = await action.run(
      () =>
        save({
          data: {
            id: entry?.id,
            entryType: texto("entryType") as "income" | "expense",
            origin: texto("origin") || "other",
            description: texto("description"),
            category: texto("category"),
            amountCents: centsFromInput(texto("amount")),
            dueDate: texto("dueDate"),
            competenceDate: texto("competenceDate") || texto("dueDate"),
            status: texto("status") as "pending" | "paid" | "cancelled",
            paymentMethod: texto("paymentMethod"),
            clientId: texto("clientId") || undefined,
            professionalId: texto("professionalId") || undefined,
            productId: texto("productId") || undefined,
            notes: texto("notes"),
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
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Tipo" name="entryType" defaultValue={entry?.entry_type ?? "income"}>
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </SelectField>
            <SelectField label="Origem" name="origin" defaultValue={entry?.origin ?? "service"}>
              {origens.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </SelectField>
          </div>
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
            <Field
              label="Competência"
              name="competenceDate"
              type="date"
              defaultValue={
                entry?.competence_date ?? entry?.due_date ?? new Date().toISOString().slice(0, 10)
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Status" name="status" defaultValue={entry?.status ?? "pending"}>
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="cancelled">Cancelado</option>
            </SelectField>
            <Field
              label="Forma de pagamento"
              name="paymentMethod"
              defaultValue={entry?.payment_method ?? ""}
            />
          </div>
          <SelectField label="Cliente (opcional)" name="clientId" defaultValue={entry?.client_id ?? ""}>
            <option value="">Sem vínculo</option>
            {options.clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Profissional (opcional)"
              name="professionalId"
              defaultValue={entry?.professional_id ?? ""}
            >
              <option value="">Sem vínculo</option>
              {options.professionals.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Produto (opcional)"
              name="productId"
              defaultValue={entry?.product_id ?? ""}
            >
              <option value="">Sem vínculo</option>
              {options.products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </SelectField>
          </div>
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
        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
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
function exportCsv(entries: FinancialEntryWithLinks[]) {
  const rows = [
    [
      "Tipo",
      "Origem",
      "Descrição",
      "Categoria",
      "Valor",
      "Vencimento",
      "Competência",
      "Status",
      "Cliente",
      "Profissional",
      "Produto",
    ],
    ...entries.map((entry) => [
      entry.entry_type,
      origemLabel(entry.origin ?? "other"),
      entry.description,
      entry.category ?? "",
      (entry.amount_cents / 100).toFixed(2),
      entry.due_date,
      entry.competence_date ?? entry.due_date,
      entry.status,
      entry.clients?.name ?? "",
      entry.professionals?.name ?? "",
      entry.products?.name ?? "",
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
