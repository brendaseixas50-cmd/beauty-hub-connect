import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ImageUp, Pencil, Plus, UserRound } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";

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
import { linkUpgradeEquipe } from "@/lib/upgrade";
import type { ProfessionalWithServices } from "@/modules/mvp/domain";
import {
  deleteProfessional,
  deleteProfessionalUnavailability,
  getProfessionalCapacity,
  listProfessionalUnavailability,
  listProfessionals,
  listServices,
  saveProfessional,
  saveProfessionalSchedule,
  saveProfessionalUnavailability,
  uploadPublicMedia,
} from "@/modules/mvp/server";
import {
  emptyDaySchedule,
  hasCustomWorkingHours,
  parseWorkingHours,
  weekdayLabels,
  type DaySchedule,
} from "@/modules/mvp/agenda-disponibilidade";
import { useMvpAction } from "@/modules/mvp/use-action";
import { LuviContextBridge } from "@/modules/luvi-core/context";

export const Route = createFileRoute("/painel/profissionais")({
  staleTime: 60_000,
  loader: async () => {
    const [professionals, services, capacity, blocks] = await Promise.all([
      listProfessionals(),
      listServices(),
      getProfessionalCapacity(),
      listProfessionalUnavailability(),
    ]);
    return { professionals, services, capacity, blocks };
  },
  head: () => ({ meta: [{ title: "Profissionais — Beauty Hub Connect" }] }),
  component: ProfessionalsPage,
});

function ProfessionalsPage() {
  const { professionals, services, capacity, blocks } = Route.useLoaderData();
  const remove = useServerFn(deleteProfessional);
  const action = useMvpAction();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<ProfessionalWithServices | null>();
  const term = search.trim().toLowerCase();
  const filtered = professionals.filter((professional) => {
    const matches =
      !term ||
      [professional.name, professional.specialty, professional.email].some((value) =>
        value?.toLowerCase().includes(term),
      );
    return (
      matches &&
      (status === "all" || (status === "active" ? professional.active : !professional.active))
    );
  });

  return (
    <div>
      <LuviContextBridge
        facts={{ professionals: professionals.length, services: services.length }}
      />
      <PageHeader
        eyebrow="Equipe"
        title="Profissionais"
        description="Organize a equipe, comissões e disponibilidade na agenda."
        action={
          <Button
            className="rounded-full"
            disabled={!capacity.canAddMore}
            onClick={() => setEditing(null)}
          >
            <Plus className="h-4 w-4" /> Novo profissional
          </Button>
        }
      />

      <Card className="mt-2 mb-6 flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">
            Plano {capacity.planName} · {capacity.used} de {capacity.limit} profissionais ativos
          </p>
          <p className="text-sm text-muted-foreground">
            {capacity.canAddMore
              ? `Você ainda pode ativar ${capacity.remaining} profissional(is) neste plano.`
              : "Limite do plano atingido. Faça upgrade para ativar mais profissionais."}
          </p>
        </div>
        {!capacity.canAddMore ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="destructive" className="w-fit">
              Limite atingido
            </Badge>
            {capacity.limit === 1 && linkUpgradeEquipe() ? (
              <Button asChild size="sm" className="rounded-full">
                <a href={linkUpgradeEquipe()} target="_blank" rel="noreferrer">
                  Fazer upgrade para Equipe
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar profissional" />
        <select
          aria-label="Filtrar profissionais"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum profissional encontrado"
          description="Cadastre quem atende na empresa para usar a agenda."
        />
      ) : (
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {filtered.map((professional) => (
            <Card key={professional.id} className="gap-4 p-5">
              <div className="flex items-start gap-4">
                {professional.photo_url ? (
                  <img
                    src={professional.photo_url}
                    alt={`Foto de ${professional.name}`}
                    className="h-12 w-12 shrink-0 rounded-full border object-cover"
                  />
                ) : (
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: professional.color }}
                  >
                    {initials(professional.name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-medium">{professional.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {professional.specialty || "Especialidade não informada"}
                  </p>
                </div>
                <Badge variant={professional.active ? "secondary" : "outline"}>
                  {professional.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                <p>Comissão: {Number(professional.commission_percent).toLocaleString("pt-BR")}%</p>
                <p>{professional.phone || professional.email || "Sem contato"}</p>
              </div>
              {professional.notes ? (
                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  {professional.notes}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(professional)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <DeleteButton
                  label={professional.name}
                  pending={action.pending}
                  onConfirm={() =>
                    void action.run(
                      () => remove({ data: { id: professional.id } }),
                      "Profissional excluído.",
                    )
                  }
                />
              </div>
              <AcessoProfissional professional={professional} />
            </Card>

          ))}
        </div>
      )}
      {editing !== undefined ? (
        <ProfessionalDialog
          professional={editing}
          services={services}
          blocks={blocks.filter((block) => block.professional_id === editing?.id)}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}

function ProfessionalDialog({
  professional,
  services,
  blocks,
  onClose,
}: {
  professional: ProfessionalWithServices | null;
  services: Awaited<ReturnType<typeof listServices>>;
  blocks: Awaited<ReturnType<typeof listProfessionalUnavailability>>;
  onClose: () => void;
}) {
  const save = useServerFn(saveProfessional);
  const saveSchedule = useServerFn(saveProfessionalSchedule);
  const saveBlock = useServerFn(saveProfessionalUnavailability);
  const removeBlock = useServerFn(deleteProfessionalUnavailability);
  const upload = useServerFn(uploadPublicMedia);
  const action = useMvpAction();
  const initialHours = parseWorkingHours(professional?.working_hours);
  const [followCompanyHours, setFollowCompanyHours] = useState(
    !hasCustomWorkingHours(initialHours),
  );
  const [days, setDays] = useState<DaySchedule[]>(() =>
    weekdayLabels.map((_, weekday) => initialHours[String(weekday)] ?? defaultDay(weekday)),
  );
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  function updateDay(weekday: number, patch: Partial<DaySchedule>) {
    setDays((current) =>
      current.map((day, index) => (index === weekday ? { ...day, ...patch } : day)),
    );
  }
  const [photoUrl, setPhotoUrl] = useState(professional?.photo_url ?? "");
  const [uploading, setUploading] = useState(false);

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file || !professional) return;
    if (
      !(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type) ||
      file.size > 3 * 1024 * 1024
    ) {
      await action.run(
        () => Promise.reject(new Error("Use JPG, PNG ou WebP com no máximo 3 MB.")),
        "",
      );
      return;
    }
    setUploading(true);
    try {
      const result = await upload({
        data: {
          kind: "gallery",
          key: professional.id,
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
          base64: await fileToBase64(file),
        },
      });
      setPhotoUrl(result.url);
    } finally {
      setUploading(false);
    }
  }
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let savedId = professional?.id ?? "";
    const ok = await action.run(
      async () => {
        const saved = await save({
          data: {
            id: professional?.id,
            name: String(form.get("name")),
            specialty: String(form.get("specialty")),
            email: String(form.get("email")),
            phone: String(form.get("phone")),
            commissionPercent: Number(form.get("commissionPercent")),
            color: String(form.get("color")),
            active: form.get("active") === "on",
            notes: String(form.get("notes")),
            bio: String(form.get("bio")),
            photoUrl,
            serviceIds: form.getAll("serviceIds").map(String),
          },
        });
        savedId = saved.id;
        return saved;
      },
      professional ? "Profissional atualizado." : "Profissional cadastrado.",
    );
    if (!ok) return;
    if (savedId) {
      await action.run(
        () =>
          saveSchedule({
            data: {
              professionalId: savedId,
              followCompanyHours,
              days: days.map((day, weekday) => ({
                weekday,
                dayOff: day.dayOff,
                startsAt: day.startsAt,
                endsAt: day.endsAt,
                breakStartsAt: day.breakStartsAt ?? "",
                breakEndsAt: day.breakEndsAt ?? "",
              })),
            },
          }),
        "Agenda do profissional salva.",
      );
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{professional ? "Editar profissional" : "Novo profissional"}</DialogTitle>
          <DialogDescription>
            Este cadastro ficará disponível para criação de agendamentos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label="Nome" name="name" defaultValue={professional?.name ?? ""} required />
          <Field
            label="Especialidade"
            name="specialty"
            defaultValue={professional?.specialty ?? ""}
          />
          <div className="grid gap-2">
            <Label>Foto do profissional</Label>
            <div className="flex items-center gap-4 rounded-2xl border p-3">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Prévia da foto"
                  className="h-20 w-20 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-muted">
                  <UserRound className="h-8 w-8 text-muted-foreground" />
                </span>
              )}
              <div className="grid min-w-0 flex-1 gap-2">
                {professional ? (
                  <>
                    <label
                      htmlFor="professional-photo"
                      className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium"
                    >
                      <ImageUp className="h-4 w-4" />{" "}
                      {uploading ? "Enviando…" : photoUrl ? "Substituir foto" : "Adicionar foto"}
                    </label>
                    <input
                      id="professional-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={uploading}
                      onChange={(event) => void onPhoto(event)}
                    />
                    {photoUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPhotoUrl("")}
                      >
                        Remover foto
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Salve o profissional e depois adicione a foto.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  A foto aparecerá ao lado do nome no agendamento público.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefone" name="phone" defaultValue={professional?.phone ?? ""} />
            <Field
              label="E-mail"
              name="email"
              type="email"
              defaultValue={professional?.email ?? ""}
            />
            <Field
              label="Comissão (%)"
              name="commissionPercent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={professional?.commission_percent ?? 0}
            />
            <Field
              label="Cor na agenda"
              name="color"
              type="color"
              defaultValue={professional?.color ?? "#8b5e67"}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bio">Apresentação pública</Label>
            <Textarea id="bio" name="bio" maxLength={500} defaultValue={professional?.bio ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label>Serviços realizados</Label>
            <div className="grid max-h-44 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
              {services.map((service) => (
                <label key={service.id} className="flex items-center gap-2 text-sm">
                  <input
                    name="serviceIds"
                    value={service.id}
                    type="checkbox"
                    defaultChecked={professional?.serviceIds.includes(service.id) ?? false}
                  />
                  {service.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Sem seleção, o profissional ficará disponível para todos os serviços.
            </p>
          </div>
          <div className="grid gap-3 rounded-2xl border p-3">
            <div>
              <Label>Agenda individual</Label>
              <p className="text-xs text-muted-foreground">
                Dias, horários e intervalos deste profissional. A página pública mostra apenas os
                horários realmente livres para ele.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={followCompanyHours}
                onChange={(event) => setFollowCompanyHours(event.currentTarget.checked)}
              />
              Seguir os horários da empresa
            </label>
            {!followCompanyHours ? (
              <div className="grid gap-2">
                {days.map((day, weekday) => (
                  <div key={weekday} className="grid gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={!day.dayOff}
                        onChange={(event) =>
                          updateDay(weekday, { dayOff: !event.currentTarget.checked })
                        }
                      />
                      {weekdayLabels[weekday]}
                    </label>
                    {day.dayOff ? (
                      <span className="text-sm text-muted-foreground">Folga</span>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="time"
                          aria-label={`Início ${weekdayLabels[weekday]}`}
                          value={day.startsAt}
                          onChange={(event) =>
                            updateDay(weekday, { startsAt: event.currentTarget.value })
                          }
                        />
                        <Input
                          type="time"
                          aria-label={`Fim ${weekdayLabels[weekday]}`}
                          value={day.endsAt}
                          onChange={(event) =>
                            updateDay(weekday, { endsAt: event.currentTarget.value })
                          }
                        />
                        <Input
                          type="time"
                          aria-label={`Início do intervalo ${weekdayLabels[weekday]}`}
                          value={day.breakStartsAt ?? ""}
                          onChange={(event) =>
                            updateDay(weekday, { breakStartsAt: event.currentTarget.value || null })
                          }
                        />
                        <Input
                          type="time"
                          aria-label={`Fim do intervalo ${weekdayLabels[weekday]}`}
                          value={day.breakEndsAt ?? ""}
                          onChange={(event) =>
                            updateDay(weekday, { breakEndsAt: event.currentTarget.value || null })
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {professional ? (
            <div className="grid gap-3 rounded-2xl border p-3">
              <div>
                <Label>Folgas e bloqueios</Label>
                <p className="text-xs text-muted-foreground">
                  Períodos em que este profissional não recebe agendamentos.
                </p>
              </div>
              {blocks.length ? (
                <ul className="grid gap-2">
                  {blocks.map((block) => (
                    <li
                      key={block.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 p-3 text-sm"
                    >
                      <span>
                        {formatBlock(block.starts_at)} → {formatBlock(block.ends_at)}
                        {block.reason ? ` · ${block.reason}` : ""}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void action.run(
                            () => removeBlock({ data: { id: block.id } }),
                            "Bloqueio removido.",
                          )
                        }
                      >
                        Remover
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum bloqueio cadastrado.</p>
              )}
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  type="datetime-local"
                  aria-label="Início do bloqueio"
                  value={blockStart}
                  onChange={(event) => setBlockStart(event.currentTarget.value)}
                />
                <Input
                  type="datetime-local"
                  aria-label="Fim do bloqueio"
                  value={blockEnd}
                  onChange={(event) => setBlockEnd(event.currentTarget.value)}
                />
                <Input
                  aria-label="Motivo do bloqueio"
                  placeholder="Motivo (opcional)"
                  value={blockReason}
                  onChange={(event) => setBlockReason(event.currentTarget.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={!blockStart || !blockEnd || action.pending}
                onClick={() =>
                  void action
                    .run(
                      () =>
                        saveBlock({
                          data: {
                            professionalId: professional.id,
                            startsAt: new Date(blockStart).toISOString(),
                            endsAt: new Date(blockEnd).toISOString(),
                            reason: blockReason,
                          },
                        }),
                      "Bloqueio adicionado.",
                    )
                    .then((ok) => {
                      if (ok) {
                        setBlockStart("");
                        setBlockEnd("");
                        setBlockReason("");
                      }
                    })
                }
              >
                Adicionar bloqueio
              </Button>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" name="notes" defaultValue={professional?.notes ?? ""} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input name="active" type="checkbox" defaultChecked={professional?.active ?? true} />{" "}
            Profissional ativo
          </label>
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
function defaultDay(weekday: number): DaySchedule {
  const base = emptyDaySchedule();
  return { ...base, dayOff: weekday === 0 };
}

function formatBlock(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}
