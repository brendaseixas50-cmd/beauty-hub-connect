import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  emptyDaySchedule,
  hasCustomWorkingHours,
  weekdayLabels,
  type DaySchedule,
} from "@/modules/mvp/agenda-disponibilidade";
import { professionalSaveWorkingHours } from "@/modules/professional-panel/server";

const layoutApi = getRouteApi("/profissional");

export const Route = createFileRoute("/profissional/horarios")({
  head: () => ({ meta: [{ title: "Meus horários — Painel Profissional" }] }),
  component: ProfessionalHours,
});

function ProfessionalHours() {
  const result = layoutApi.useLoaderData();
  const router = useRouter();
  const save = useServerFn(professionalSaveWorkingHours);
  const hours = result.status === "ok" ? result.data.identity.workingHours : {};
  const [followCompany, setFollowCompany] = useState(!hasCustomWorkingHours(hours));
  const [days, setDays] = useState<DaySchedule[]>(() =>
    weekdayLabels.map((_, weekday) => hours[String(weekday)] ?? defaultDay(weekday)),
  );
  const [pending, setPending] = useState(false);

  if (result.status !== "ok") return null;

  function updateDay(weekday: number, patch: Partial<DaySchedule>) {
    setDays((current) =>
      current.map((day, index) => (index === weekday ? { ...day, ...patch } : day)),
    );
  }

  async function submit() {
    setPending(true);
    try {
      await save({
        data: {
          followCompanyHours: followCompany,
          days: days.map((day, weekday) => ({
            weekday,
            dayOff: day.dayOff,
            startsAt: day.startsAt,
            endsAt: day.endsAt,
            breakStartsAt: day.breakStartsAt ?? "",
            breakEndsAt: day.breakEndsAt ?? "",
          })),
        },
      });
      await router.invalidate();
      toast.success("Horários atualizados.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Meus horários</h1>
        <p className="text-sm text-muted-foreground">
          Define quando os clientes podem agendar com você na página pública.
        </p>
      </div>

      <Card className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Seguir o horário da empresa</p>
          <p className="text-sm text-muted-foreground">
            Desative para definir seus próprios dias, horários e intervalos.
          </p>
        </div>
        <Switch
          className="shrink-0"
          checked={followCompany}
          onCheckedChange={setFollowCompany}
        />
      </Card>

      {!followCompany ? (
        <div className="grid gap-3">
          {weekdayLabels.map((label, weekday) => {
            const day = days[weekday]!;
            return (
              <Card key={label} className="gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <p className="min-w-0 truncate font-medium">{label}</p>
                  <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                    Atendo neste dia
                    <Switch
                      checked={!day.dayOff}
                      onCheckedChange={(checked) => updateDay(weekday, { dayOff: !checked })}
                    />
                  </label>
                </div>
                {!day.dayOff ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TimeField
                      label="Início"
                      value={day.startsAt}
                      onChange={(value) => updateDay(weekday, { startsAt: value })}
                    />
                    <TimeField
                      label="Fim"
                      value={day.endsAt}
                      onChange={(value) => updateDay(weekday, { endsAt: value })}
                    />
                    <TimeField
                      label="Intervalo — início"
                      value={day.breakStartsAt ?? ""}
                      onChange={(value) => updateDay(weekday, { breakStartsAt: value || null })}
                    />
                    <TimeField
                      label="Intervalo — fim"
                      value={day.breakEndsAt ?? ""}
                      onChange={(value) => updateDay(weekday, { breakEndsAt: value || null })}
                    />
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}

      <Button className="w-full sm:w-fit" disabled={pending} onClick={() => void submit()}>
        {pending ? "Salvando…" : "Salvar horários"}
      </Button>
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input type="time" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function defaultDay(weekday: number): DaySchedule {
  const base = emptyDaySchedule();
  return weekday === 0 ? base : { ...base, dayOff: false };
}
