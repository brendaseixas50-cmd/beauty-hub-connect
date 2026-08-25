import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TemaProduto } from "@/components/tema-produto";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelManagedBooking,
  getManagedBooking,
  rescheduleManagedBooking,
} from "@/modules/public-booking/gerenciar.functions";
import { getPublicAvailability } from "@/modules/public-booking/server";
import { brl } from "@/modules/public-booking/domain";

export const Route = createFileRoute("/agendamento/$token")({
  loader: ({ params }) => getManagedBooking({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: "Meus agendamentos — Lu IA Studio" },
      {
        name: "description",
        content: "Consulte, remarque ou cancele seu agendamento pelo link seguro recebido.",
      },
      { property: "og:title", content: "Meus agendamentos" },
      {
        property: "og:description",
        content: "Gerencie seu agendamento com segurança, sem criar conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ManagePage,
});

function ManagePage() {
  const initial = Route.useLoaderData();
  const { token } = Route.useParams();
  const router = useRouter();
  const cancelFn = useServerFn(cancelManagedBooking);
  const rescheduleFn = useServerFn(rescheduleManagedBooking);
  const availabilityFn = useServerFn(getPublicAvailability);
  const [pending, setPending] = useState(false);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ startsAt: string }[]>([]);
  const [mode, setMode] = useState<"view" | "reschedule">("view");

  if (!initial.ok) {
    return (
      <TemaProduto produto="portal" className="grid min-h-screen place-items-center bg-background p-6">
        <Card className="max-w-md gap-3 p-6 text-center">
          <XCircle className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="text-xl font-semibold">Link inválido</h1>
          <p className="text-sm text-muted-foreground">{initial.error}</p>
        </Card>
      </TemaProduto>
    );
  }

  const booking = initial;
  const timezone = booking.company.timezone;
  const today = new Date().toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + booking.rules.horizonDays * 86_400_000)
    .toISOString()
    .slice(0, 10);

  async function loadSlots(value: string) {
    setDate(value);
    setSlots([]);
    if (!value) return;
    setPending(true);
    try {
      const response = await availabilityFn({
        data: {
          slug: booking.company.slug,
          date: value,
          serviceIds: [booking.serviceId],
          professionalId: booking.professionalId,
        },
      });
      setSlots(response.slots);
    } catch {
      toast.error("Não foi possível consultar os horários.");
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    setPending(true);
    const result = await cancelFn({ data: { token } });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Não foi possível cancelar.");
      return;
    }
    toast.success("Agendamento cancelado.");
    await router.invalidate();
  }

  async function reschedule(startsAt: string) {
    setPending(true);
    const result = await rescheduleFn({ data: { token, startsAt } });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Não foi possível remarcar.");
      return;
    }
    toast.success("Agendamento remarcado.");
    setMode("view");
    await router.invalidate();
  }

  return (
    <TemaProduto
      produto={booking.company.productType}
      className="min-h-screen bg-background px-4 py-10"
    >
      <main className="mx-auto grid w-full max-w-xl gap-4">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {booking.company.name}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Meus agendamentos</h1>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Acesso seguro por link — sem criar conta.
          </p>
        </header>

        <Card className="gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {booking.code ? `Código ${booking.code}` : "Agendamento"}
            </span>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
              {statusLabel(booking.status)}
            </span>
          </div>
          <p className="text-lg font-medium">{booking.serviceName ?? "Atendimento"}</p>
          <p className="text-sm text-muted-foreground">
            {booking.professionalName ? `com ${booking.professionalName} · ` : ""}
            {formatDateTime(booking.startsAt, timezone)}
          </p>
          <p className="text-sm">Valor: {brl(booking.priceCents)}</p>
          {booking.company.cancellationPolicy ? (
            <p className="rounded-xl bg-secondary p-3 text-sm">
              {booking.company.cancellationPolicy}
            </p>
          ) : null}
          {booking.blockedReason ? (
            <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
              {booking.blockedReason}
            </p>
          ) : null}
          {booking.rules.deadlineEnabled && !booking.blockedReason ? (
            <p className="text-xs text-muted-foreground">
              Cancelamento e remarcação online até {booking.rules.deadlineHours} h antes.
            </p>
          ) : null}
        </Card>

        {booking.canReschedule || booking.canCancel ? (
          <Card className="gap-4 p-5">
            {mode === "view" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  disabled={!booking.canReschedule || pending}
                  onClick={() => setMode("reschedule")}
                >
                  <CalendarClock className="h-4 w-4" /> Remarcar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!booking.canCancel || pending}
                  onClick={() => void cancel()}
                >
                  <XCircle className="h-4 w-4" /> Cancelar agendamento
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="novaData">Nova data</Label>
                  <Input
                    id="novaData"
                    type="date"
                    min={today}
                    max={maxDate}
                    value={date}
                    onChange={(event) => void loadSlots(event.currentTarget.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {pending ? (
                    <p className="col-span-full text-sm">Consultando horários…</p>
                  ) : slots.length ? (
                    slots.map((slot) => (
                      <Button
                        key={slot.startsAt}
                        type="button"
                        variant="outline"
                        onClick={() => void reschedule(slot.startsAt)}
                      >
                        {formatTime(slot.startsAt, timezone)}
                      </Button>
                    ))
                  ) : date ? (
                    <p className="col-span-full rounded-xl bg-secondary p-3 text-sm">
                      Nenhum horário disponível nesta data.
                    </p>
                  ) : (
                    <p className="col-span-full text-sm text-muted-foreground">
                      Escolha uma data para ver os horários.
                    </p>
                  )}
                </div>
                <Button type="button" variant="ghost" onClick={() => setMode("view")}>
                  Voltar
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <Card className="gap-2 p-5 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Este agendamento não pode mais ser alterado online.
            {booking.company.whatsapp ? " Fale com a empresa pelo WhatsApp." : ""}
          </Card>
        )}
      </main>
    </TemaProduto>
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

function formatDateTime(value: string, timeZone: string) {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: string, timeZone: string) {
  return new Date(value).toLocaleTimeString("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
}
