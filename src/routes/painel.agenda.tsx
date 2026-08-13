import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlus, Pencil } from "lucide-react";
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
import {
  brl,
  formatDateTime,
  type Appointment,
  type Client,
  type Professional,
  type Service,
} from "@/modules/mvp/domain";
import { deleteAppointment, getAgenda, saveAppointment } from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";
import { LuviContextBridge } from "@/modules/luvi-core/context";

export const Route = createFileRoute("/painel/agenda")({
  staleTime: 60_000,
  loader: () => getAgenda(),
  head: () => ({ meta: [{ title: "Agenda — Beauty Hub Connect" }] }),
  component: AgendaPage,
});

function AgendaPage() {
  const data = Route.useLoaderData();
  const remove = useServerFn(deleteAppointment);
  const action = useMvpAction();
  const [search, setSearch] = useState("");
  const [professional, setProfessional] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState(todayInput());
  const [to, setTo] = useState(addDaysInput(30));
  const [editing, setEditing] = useState<Appointment | null>();
  const canCreate =
    data.clients.length > 0 && data.services.length > 0 && data.professionals.length > 0;
  const term = search.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      data.appointments.filter((appointment) => {
        const date = appointment.starts_at.slice(0, 10);
        const matchesText =
          !term ||
          [
            appointment.clients?.name,
            appointment.services?.name,
            appointment.professionals?.name,
          ].some((value) => value?.toLowerCase().includes(term));
        return (
          matchesText &&
          date >= from &&
          date <= to &&
          (professional === "all" || appointment.professional_id === professional) &&
          (status === "all" || appointment.status === status)
        );
      }),
    [data.appointments, from, professional, status, term, to],
  );

  return (
    <div>
      <LuviContextBridge facts={{ appointmentsToday: data.appointments.length }} />
      <PageHeader
        eyebrow="Agenda operacional"
        title="Agendamentos"
        description="Crie, edite, filtre e acompanhe todos os atendimentos."
        action={
          <Button className="rounded-full" disabled={!canCreate} onClick={() => setEditing(null)}>
            <CalendarPlus className="h-4 w-4" /> Novo agendamento
          </Button>
        }
      />

      {!canCreate ? (
        <Card className="mt-6 p-5 text-sm text-muted-foreground">
          Para criar um agendamento, cadastre ao menos um{" "}
          <Link className="text-primary underline" to="/painel/clientes">
            cliente
          </Link>
          , um{" "}
          <Link className="text-primary underline" to="/painel/servicos">
            serviço
          </Link>{" "}
          e um{" "}
          <Link className="text-primary underline" to="/painel/profissionais">
            profissional
          </Link>
          .
        </Card>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar cliente, serviço ou profissional"
          />
        </div>
        <Filter label="De">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Filter>
        <Filter label="Até">
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Filter>
        <Filter label="Profissional">
          <select
            value={professional}
            onChange={(event) => setProfessional(event.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Todos</option>
            {data.professionals.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Status">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Todos</option>
            {statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Filter>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento encontrado"
          description="Altere os filtros ou crie um novo atendimento."
        />
      ) : (
        <div className="mt-6 grid gap-3">
          {filtered.map((appointment) => (
            <Card key={appointment.id} className="gap-4 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-lg font-medium">{appointment.clients?.name ?? "Cliente"}</p>
                  <p className="text-sm text-muted-foreground">
                    {appointment.services?.name ?? "Serviço"} ·{" "}
                    {appointment.professionals?.name ?? "Profissional"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={appointment.status === "cancelled" ? "destructive" : "secondary"}>
                    {statusLabel(appointment.status)}
                  </Badge>
                  <span className="text-sm font-medium">
                    {formatDateTime(appointment.starts_at)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>Valor: {brl(appointment.price_cents)}</span>
                <span>
                  Término:{" "}
                  {new Date(appointment.ends_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {appointment.notes ? (
                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  {appointment.notes}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(appointment)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <DeleteButton
                  label="o agendamento"
                  pending={action.pending}
                  onConfirm={() =>
                    void action.run(
                      () => remove({ data: { id: appointment.id } }),
                      "Agendamento excluído.",
                    )
                  }
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing !== undefined ? (
        <AppointmentDialog
          appointment={editing}
          clients={data.clients}
          services={data.services}
          professionals={data.professionals}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}

function AppointmentDialog({
  appointment,
  clients,
  services,
  professionals,
  onClose,
}: {
  appointment: Appointment | null;
  clients: Client[];
  services: Service[];
  professionals: Professional[];
  onClose: () => void;
}) {
  const save = useServerFn(saveAppointment);
  const action = useMvpAction();
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startsAt = new Date(String(form.get("startsAt"))).toISOString();
    const ok = await action.run(
      () =>
        save({
          data: {
            id: appointment?.id,
            clientId: String(form.get("clientId")),
            serviceId: String(form.get("serviceId")),
            professionalId: String(form.get("professionalId")),
            startsAt,
            status: String(form.get("status")) as
              "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show",
            notes: String(form.get("notes")),
          },
        }),
      appointment ? "Agendamento atualizado." : "Agendamento criado.",
    );
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{appointment ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
          <DialogDescription>
            O sistema bloqueia conflitos de horário para o mesmo profissional.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <SelectField label="Cliente" name="clientId" defaultValue={appointment?.client_id}>
            {clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Serviço" name="serviceId" defaultValue={appointment?.service_id}>
            {services.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.duration_minutes} min · {brl(item.price_cents)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Profissional"
            name="professionalId"
            defaultValue={appointment?.professional_id}
          >
            {professionals.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>
          <div className="grid gap-2">
            <Label htmlFor="startsAt">Data e hora</Label>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              defaultValue={appointment ? toLocalInput(appointment.starts_at) : defaultStart()}
              required
            />
          </div>
          <SelectField
            label="Status"
            name="status"
            defaultValue={appointment?.status ?? "scheduled"}
          >
            {statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectField>
          <div className="grid gap-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" name="notes" defaultValue={appointment?.notes ?? ""} />
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

const statuses = [
  { value: "scheduled", label: "Agendado" },
  { value: "confirmed", label: "Confirmado" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
  { value: "no_show", label: "Faltou" },
] as const;
function statusLabel(status: string) {
  return statuses.find((item) => item.value === status)?.label ?? status;
}
function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      {children}
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
  defaultValue?: string | undefined;
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
        required
      >
        {children}
      </select>
    </div>
  );
}
function todayInput() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysInput(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
function defaultStart() {
  const date = new Date();
  date.setMinutes(Math.ceil(date.getMinutes() / 30) * 30, 0, 0);
  return toLocalInput(date.toISOString());
}
function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
