import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, PageHeader } from "@/components/mvp-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { brl } from "@/modules/mvp/domain";
import { getReports } from "@/modules/mvp/server";

export const Route = createFileRoute("/painel/relatorios")({
  staleTime: 60_000,
  loader: () => getReports(),
  head: () => ({ meta: [{ title: "Relatórios — Beauty Hub Connect" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const data = Route.useLoaderData();
  const months = useMemo(() => {
    const result: string[] = [];
    const date = new Date();
    for (let index = 0; index < 6; index += 1) {
      result.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
      date.setMonth(date.getMonth() - 1);
    }
    return result;
  }, []);
  const [month, setMonth] = useState(months[0]!);
  const appointments = data.appointments.filter((item) => item.starts_at.startsWith(month));
  // Relatório por competência (mês de referência), com fallback no vencimento.
  const finances = data.finances.filter((item) =>
    (item.competence_date ?? item.due_date).startsWith(month),
  );
  const paid = finances.filter((item) => item.status === "paid");
  const income = paid
    .filter((item) => item.entry_type === "income")
    .reduce((total, item) => total + item.amount_cents, 0);
  const expense = paid
    .filter((item) => item.entry_type === "expense")
    .reduce((total, item) => total + item.amount_cents, 0);
  const byOrigin = Object.entries(
    paid.reduce<Record<string, number>>((result, item) => {
      const key = originLabel(item.origin ?? "other");
      result[key] =
        (result[key] ?? 0) + (item.entry_type === "income" ? item.amount_cents : -item.amount_cents);
      return result;
    }, {}),
  ).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const completed = appointments.filter((item) => item.status === "completed");
  const serviceCounts = completed.reduce<Record<string, number>>((result, item) => {
    const name = item.services?.name ?? "Serviço";
    result[name] = (result[name] ?? 0) + 1;
    return result;
  }, {});
  const ranking = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]);
  const max = ranking[0]?.[1] ?? 1;
  const stockValue = data.products.reduce(
    (total, product) => total + product.stock_quantity * product.cost_cents,
    0,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Indicadores"
        title="Relatórios"
        description="Indicadores calculados diretamente a partir da agenda, financeiro e estoque."
        action={
          <Button
            variant="outline"
            onClick={() =>
              exportReport(month, {
                appointments: appointments.length,
                completed: completed.length,
                income,
                expense,
                stockValue,
              })
            }
          >
            <Download className="h-4 w-4" /> Exportar resumo
          </Button>
        }
      />

      <div className="mt-6 max-w-xs">
        <label className="grid gap-2 text-sm">
          Período
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="h-10 rounded-md border bg-background px-3"
          >
            {months.map((item) => (
              <option key={item} value={item}>
                {new Date(item + "-01T12:00:00").toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Agendamentos" value={String(appointments.length)} />
        <Metric title="Atendimentos concluídos" value={String(completed.length)} />
        <Metric title="Receitas realizadas" value={brl(income)} />
        <Metric title="Saldo do período" value={brl(income - expense)} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-2xl">Serviços mais realizados</h2>
          {ranking.length === 0 ? (
            <EmptyState
              title="Sem dados no período"
              description="Conclua agendamentos para formar este relatório."
            />
          ) : (
            <Card className="mt-4 gap-4 p-5">
              {ranking.map(([name, count]) => (
                <div key={name}>
                  <div className="mb-2 flex justify-between gap-4 text-sm">
                    <span className="truncate">{name}</span>
                    <span>{count}</span>
                  </div>
                  <Progress value={(count / max) * 100} />
                </div>
              ))}
            </Card>
          )}
        </section>
        <section>
          <h2 className="text-2xl">Estoque</h2>
          <Card className="mt-4 gap-4 p-5">
            <div>
              <p className="text-sm text-muted-foreground">Valor estimado pelo custo</p>
              <p className="font-display text-3xl">{brl(stockValue)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Produtos ativos</p>
              <p className="text-2xl">{data.products.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Abaixo do estoque mínimo</p>
              <p className="text-2xl">
                {data.products.filter((item) => item.stock_quantity <= item.minimum_stock).length}
              </p>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card className="gap-1 p-5">
      <p className="text-eyebrow">{title}</p>
      <p className="font-display text-3xl">{value}</p>
    </Card>
  );
}
function exportReport(
  month: string,
  values: {
    appointments: number;
    completed: number;
    income: number;
    expense: number;
    stockValue: number;
  },
) {
  const csv = [
    ["Período", month],
    ["Agendamentos", values.appointments],
    ["Concluídos", values.completed],
    ["Receitas", (values.income / 100).toFixed(2)],
    ["Despesas", (values.expense / 100).toFixed(2)],
    ["Valor do estoque", (values.stockValue / 100).toFixed(2)],
  ]
    .map((row) => row.join(";"))
    .join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `relatorio-${month}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
