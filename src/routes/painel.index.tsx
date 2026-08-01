import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, PackageSearch, Scissors, TrendingUp, UserRound, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/mvp-page";
import { brl, formatDateTime } from "@/modules/mvp/domain";
import { getDashboard } from "@/modules/mvp/server";

export const Route = createFileRoute("/painel/")({
  loader: () => getDashboard(),
  head: () => ({ meta: [{ title: "Dashboard — Beauty Hub Connect" }] }),
  component: Dashboard,
});

function Dashboard() {
  const data = Route.useLoaderData();
  const { session } = Route.useRouteContext();
  const firstName = session.user.name.split(" ")[0];
  const product = session.user.productType === "barber" ? "LuBarber Pro" : "LuBeauty Pro";

  return (
    <div>
      <PageHeader
        eyebrow={product}
        title={`Olá, ${firstName}`}
        description="Acompanhe os principais números da empresa e os atendimentos de hoje."
        action={
          <Button asChild className="rounded-full">
            <Link to="/painel/agenda">Novo agendamento</Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric
          icon={CalendarCheck}
          title="Agendamentos hoje"
          value={String(data.appointments.length)}
        />
        <Metric icon={TrendingUp} title="Saldo do mês" value={brl(data.monthBalanceCents)} />
        <Metric icon={Users} title="Clientes ativos" value={String(data.clients)} />
        <Metric icon={UserRound} title="Profissionais ativos" value={String(data.professionals)} />
        <Metric icon={Scissors} title="Serviços ativos" value={String(data.services)} />
        <Metric
          icon={PackageSearch}
          title="Itens com estoque baixo"
          value={String(data.lowStock)}
          alert={data.lowStock > 0}
        />
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl">Agenda de hoje</h2>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/painel/agenda">Ver agenda completa</Link>
          </Button>
        </div>

        {data.appointments.length === 0 ? (
          <EmptyState
            title="Nenhum atendimento hoje"
            description="Crie um agendamento para começar a organizar a agenda da empresa."
          />
        ) : (
          <Card className="mt-4 divide-y p-0">
            {data.appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{appointment.clients?.name ?? "Cliente"}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {appointment.services?.name ?? "Serviço"} ·{" "}
                    {appointment.professionals?.name ?? "Profissional"}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="text-sm">{formatDateTime(appointment.starts_at)}</span>
                  <Badge variant={appointment.status === "cancelled" ? "destructive" : "secondary"}>
                    {statusLabel(appointment.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  title,
  value,
  alert = false,
}: {
  icon: typeof Users;
  title: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <Card className="gap-2 p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{title}</span>
      </div>
      <p className={`font-display text-3xl ${alert ? "text-destructive" : ""}`}>{value}</p>
    </Card>
  );
}

function statusLabel(status: string) {
  return (
    (
      {
        scheduled: "Agendado",
        confirmed: "Confirmado",
        completed: "Concluído",
        cancelled: "Cancelado",
        no_show: "Faltou",
      } as Record<string, string>
    )[status] ?? status
  );
}
