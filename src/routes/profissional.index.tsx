import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlus, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

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
import { linkWhatsapp } from "@/lib/telefone";
import { brl } from "@/modules/mvp/domain";
import {
  appointmentStatusLabels,
  dayKey,
  hourLabel,
  longDateLabel,
  shiftDayKey,
  weekKeys,
  type ProfessionalAppointment,
  type ProfessionalPanelData,
} from "@/modules/professional-panel/domain";
import {
  professionalCreateClient,
  professionalSaveAppointment,
  professionalSetAppointmentStatus,
} from "@/modules/professional-panel/server";

const layoutApi = getRouteApi("/profissional");

export const Route = createFileRoute("/profissional/")({
  head: () => ({ meta: [{ title: "Minha agenda — Painel Profissional" }] }),
  component: ProfessionalAgenda,
});

function ProfessionalAgenda() {
  const result = layoutApi.useLoaderData();
  if (result.status !== "ok") return null;
  return <AgendaView data={result.data} />;
}

function AgendaView({ data }: { data: ProfessionalPanelData }) {
  const router = useRouter();
  const timeZone = data.identity.timezone;
  const today = dayKey(new Date().toISOString(), timeZone);
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState<"day" | "week">("day");
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const setStatus = useServerFn(professionalSetAppointmentStatus);

  const byDay = useMemo(() => {
    const map = new Map<string, ProfessionalAppointment[]>();
    for (const appointment of data.appointments) {
      const key = dayKey(appointment.startsAt, timeZone);
      const list = map.get(key) ?? [];
      list.push(appointment);
      map.set(key, list);
    }
    return map;
  }, [data.appointments, timeZone]);

  const weekStart = shiftDayKey(selected, -new Date(`${selected}T12:00:00Z`).getUTCDay());
  const days = weekKeys(weekStart);

  async function updateStatus(appointment: ProfessionalAppointment, status: ProfessionalAppointment["status"]) {
    setPending(true);
    try {
      await setStatus({ data: { id: appointment.id, status } });
      await router.invalidate();
      toast.success(`Atendimento marcado como ${appointmentStatusLabels[status].toLowerCase()}.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível atualizar.");
    } finally {
      setPending(false);
    }
  }

  const visible = view === "day" ? [selected] : days;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Minha agenda</h1>
          <p className="text-sm text-muted-foreground">
            Somente seus atendimentos aparecem aqui.
          </p>
        </div>
        <Button className="rounded-full" onClick={() => setCreating(true)}>
          <CalendarPlus className="h-4 w-4" /> Novo atendimento
        </Button>
      </div>

      <Card className="gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Semana anterior"
            onClick={() => setSelected(shiftDayKey(selected, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex gap-1 rounded-full bg-secondary p-1">
            {(["day", "week"] as const).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={view === option ? "default" : "ghost"}
                className="rounded-full"
                onClick={() => setView(option)}
              >
                {option === "day" ? "Dia" : "Semana"}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próxima semana"
            onClick={() => setSelected(shiftDayKey(selected, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((key) => {
            const count = byDay.get(key)?.length ?? 0;
            const isSelected = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelected(key);
                  setView("day");
                }}
                className={`rounded-xl border px-1 py-2 text-center text-xs transition-colors ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-secondary"
                }`}
              >
                <span className="block font-semibold">{key.slice(8)}</span>
                <span className="block opacity-80">
                  {key === today ? "hoje" : count ? `${count}` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {visible.map((key) => {
        const list = (byDay.get(key) ?? []).slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        return (
          <section key={key} className="grid gap-2">
            <h2 className="text-sm font-semibold capitalize text-muted-foreground">
              {longDateLabel(key)}
            </h2>
            {list.length === 0 ? (
              <Card className="p-4 text-sm text-muted-foreground">Nenhum atendimento neste dia.</Card>
            ) : (
              list.map((appointment) => (
                <Card key={appointment.id} className="gap-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {hourLabel(appointment.startsAt, timeZone)} –{" "}
                        {hourLabel(appointment.endsAt, timeZone)}
                      </p>
                      <p className="truncate text-base font-medium">{appointment.clientName}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {appointment.serviceName}
                      </p>
                    </div>
                    <Badge variant={appointment.status === "cancelled" ? "outline" : "secondary"}>
                      {appointmentStatusLabels[appointment.status]}
                    </Badge>
                  </div>
                  {appointment.items.length > 1 ? (
                    <ul className="grid gap-1 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                      {appointment.items.map((item) => (
                        <li key={`${appointment.id}-${item.serviceId}-${item.position}`}>
                          {item.name} · {item.durationMinutes} min · {brl(item.priceCents)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{brl(appointment.priceCents)}</span>
                    {linkWhatsapp(appointment.clientPhone) ? (
                      <a
                        className="inline-flex items-center gap-1 underline"
                        href={linkWhatsapp(appointment.clientPhone)!}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir conversa no WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> {appointment.clientPhone}
                      </a>
                    ) : appointment.clientPhone ? (
                      <span>{appointment.clientPhone}</span>
                    ) : null}
                  </div>
                  {appointment.notes ? (
                    <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                      {appointment.notes}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {appointment.status !== "confirmed" && appointment.status !== "completed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => void updateStatus(appointment, "confirmed")}
                      >
                        {data.canCompleteAppointments ? "Confirmar" : "Aceitar atendimento"}
                      </Button>
                    ) : null}
                    {data.canCompleteAppointments && appointment.status !== "completed" ? (
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => void updateStatus(appointment, "completed")}
                      >
                        Concluir
                      </Button>
                    ) : null}
                    {appointment.status !== "cancelled" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => void updateStatus(appointment, "cancelled")}
                      >
                        Cancelar
                      </Button>
                    ) : null}
                    {appointment.status !== "no_show" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => void updateStatus(appointment, "no_show")}
                      >
                        Não compareceu
                      </Button>
                    ) : null}
                  </div>
                </Card>
              ))
            )}
          </section>
        );
      })}

      {creating ? (
        <NewAppointmentDialog data={data} day={selected} onClose={() => setCreating(false)} />
      ) : null}
    </div>
  );
}

function NewAppointmentDialog({
  data,
  day,
  onClose,
}: {
  data: ProfessionalPanelData;
  day: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const save = useServerFn(professionalSaveAppointment);
  const createClient = useServerFn(professionalCreateClient);
  const [pending, setPending] = useState(false);
  const [newClient, setNewClient] = useState(data.clients.length === 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      let clientId = String(form.get("clientId") ?? "");
      if (newClient) {
        const created = await createClient({
          data: {
            name: String(form.get("clientName") ?? ""),
            phone: String(form.get("clientPhone") ?? ""),
            email: "",
          },
        });
        clientId = created.id;
      }
      const date = String(form.get("date") ?? "");
      const time = String(form.get("time") ?? "");
      await save({
        data: {
          clientId,
          serviceId: String(form.get("serviceId") ?? ""),
          startsAt: new Date(`${date}T${time}`).toISOString(),
          status: "scheduled",
          notes: String(form.get("notes") ?? ""),
        },
      });
      await router.invalidate();
      toast.success("Atendimento agendado.");
      onClose();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível agendar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo atendimento</DialogTitle>
          <DialogDescription>
            O atendimento é criado na sua agenda, respeitando seus horários e bloqueios.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          {data.clients.length > 0 ? (
            <div className="flex gap-2 text-sm">
              <Button
                type="button"
                size="sm"
                variant={newClient ? "outline" : "default"}
                onClick={() => setNewClient(false)}
              >
                Cliente existente
              </Button>
              <Button
                type="button"
                size="sm"
                variant={newClient ? "default" : "outline"}
                onClick={() => setNewClient(true)}
              >
                Novo cliente
              </Button>
            </div>
          ) : null}
          {newClient ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="clientName">Nome do cliente</Label>
                <Input id="clientName" name="clientName" required minLength={2} maxLength={120} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="clientPhone">WhatsApp (opcional)</Label>
                <Input id="clientPhone" name="clientPhone" inputMode="tel" maxLength={40} />
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="clientId">Cliente</Label>
              <select
                id="clientId"
                name="clientId"
                required
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                {data.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="serviceId">Serviço</Label>
            <select
              id="serviceId"
              name="serviceId"
              required
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              {data.services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.durationMinutes} min · {brl(service.priceCents)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" name="date" type="date" required defaultValue={day} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time">Horário</Label>
              <Input id="time" name="time" type="time" required defaultValue="09:00" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" name="notes" maxLength={500} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || data.services.length === 0}>
              {pending ? "Salvando…" : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
