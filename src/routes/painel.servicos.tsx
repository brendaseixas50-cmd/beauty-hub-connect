import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock, EyeOff, ImagePlus, Layers, Pencil, Plus, PlusCircle, RotateCcw } from "lucide-react";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";


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
  centsFromInput,
  type ComboItemConfig,
  type ProfessionalWithServices,
  type ServiceWithUsage,
} from "@/modules/mvp/domain";
import {
  deleteService,
  listProfessionals,
  listServices,
  saveService,
  setServiceActive,
  uploadPublicMedia,
} from "@/modules/mvp/server";

import { useMvpAction } from "@/modules/mvp/use-action";
import { LuviContextBridge } from "@/modules/luvi-core/context";

export const Route = createFileRoute("/painel/servicos")({
  staleTime: 60_000,
  loader: async () => {
    // Os profissionais alimentam a definição de quem executa cada item do combo.
    const [services, professionals] = await Promise.all([listServices(), listProfessionals()]);
    return { services, professionals };
  },
  head: () => ({ meta: [{ title: "Serviços — Beauty Hub Connect" }] }),
  component: ServicesPage,
});

function ServicesPage() {
  const { services, professionals } = Route.useLoaderData();
  const remove = useServerFn(deleteService);
  const toggleActive = useServerFn(setServiceActive);
  const action = useMvpAction();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [situation, setSituation] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<ServiceWithUsage | null>();
  const categories = useMemo(
    () => [...new Set(services.map((item) => item.category).filter(Boolean))] as string[],
    [services],
  );
  const term = search.trim().toLowerCase();
  const filtered = services.filter(
    (service) =>
      (!term || service.name.toLowerCase().includes(term)) &&
      (category === "all" || service.category === category) &&
      (situation === "all" ||
        (situation === "active" ? service.active : !service.active)),
  );

  return (
    <div>
      <LuviContextBridge
        facts={{
          services: services.length,
          inactiveServices: services.filter((service) => !service.active).length,
        }}
      />
      <PageHeader
        eyebrow="Catálogo"
        title="Serviços"
        description="Defina duração, preço e disponibilidade para a agenda."
        action={
          <Button className="rounded-full" onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" /> Novo serviço
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar serviço" />
        <select
          aria-label="Filtrar categoria"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">Todas as categorias</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div
        role="group"
        aria-label="Filtrar situação"
        className="mt-3 flex flex-wrap gap-2"
      >
        {(
          [
            ["all", "Todos"],
            ["active", "Ativos"],
            ["inactive", "Inativos"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={situation === value ? "default" : "outline"}
            className="rounded-full"
            aria-pressed={situation === value}
            onClick={() => setSituation(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum serviço encontrado"
          description="Cadastre os serviços oferecidos pela empresa."
        />
      ) : (
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {filtered.map((service) => (
            <Card key={service.id} className="gap-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  {service.image_url ? (
                    <img
                      src={service.image_url}
                      alt={service.name}
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-lg font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {service.category || "Sem categoria"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={service.active ? "secondary" : "outline"}>
                    {service.active ? "Ativo" : "Inativo"}
                  </Badge>
                  {service.is_combo ? (
                    <Badge variant="outline" className="gap-1">
                      <Layers className="h-3 w-3" /> Combo
                    </Badge>
                  ) : null}
                  {service.is_addon ? (
                    <Badge variant="outline" className="gap-1">
                      <PlusCircle className="h-3 w-3" /> Adicional
                    </Badge>
                  ) : null}
                </div>
              </div>

              {service.description ? (
                <p className="text-sm text-muted-foreground">{service.description}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="font-medium">{brl(service.price_cents)}</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" /> {formatDuration(service.duration_minutes)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {service.active
                  ? "Visível na página pública e disponível para novos agendamentos."
                  : "Fora da página pública. Histórico, pagamentos e relatórios preservados."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(service)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={action.pending}
                  onClick={() =>
                    void action.run(
                      () => toggleActive({ data: { id: service.id, active: !service.active } }),
                      service.active ? "Serviço inativado." : "Serviço reativado.",
                    )
                  }
                >
                  {service.active ? (
                    <>
                      <EyeOff className="h-4 w-4" /> Inativar
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" /> Reativar
                    </>
                  )}
                </Button>
                {service.deletable ? (
                  <DeleteButton
                    label={`${service.name} (exclusão definitiva)`}
                    pending={action.pending}
                    onConfirm={() =>
                      void action.run(
                        () => remove({ data: { id: service.id } }),
                        "Serviço excluído definitivamente.",
                      )
                    }
                  />
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing !== undefined ? (
        <ServiceDialog
          service={editing}
          services={services}
          professionals={professionals}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}

function ServiceDialog({
  service,
  services,
  professionals,
  onClose,
}: {
  service: ServiceWithUsage | null;
  services: ServiceWithUsage[];
  professionals: ProfessionalWithServices[];
  onClose: () => void;
}) {
  const save = useServerFn(saveService);
  const upload = useServerFn(uploadPublicMedia);
  const action = useMvpAction();
  const [imageUrl, setImageUrl] = useState(service?.image_url ?? "");
  const [mediaKey] = useState(() => service?.id ?? crypto.randomUUID());
  const [uploading, setUploading] = useState(false);
  const [isCombo, setIsCombo] = useState(service?.is_combo ?? false);
  const [requiresProfessional, setRequiresProfessional] = useState(
    service?.requires_professional ?? true,
  );
  const [comboServiceIds, setComboServiceIds] = useState<string[]>(service?.comboServiceIds ?? []);
  const [isAddon, setIsAddon] = useState(service?.is_addon ?? false);
  const [addonForServiceIds, setAddonForServiceIds] = useState<string[]>(
    service?.addonForServiceIds ?? [],
  );
  const options = services.filter(
    (item) => item.id !== service?.id && !item.is_combo && !item.is_addon,
  );
  /** Serviços principais e combos que podem oferecer este adicional. */
  const addonParentOptions = services.filter((item) => item.id !== service?.id && !item.is_addon);
  const [comboItems, setComboItems] = useState<ComboItemConfig[]>(service?.comboItems ?? []);
  /** Configuração de um item, com o padrão sequencial e sem responsável fixo. */
  function itemConfig(serviceId: string): ComboItemConfig {
    return (
      comboItems.find((item) => item.serviceId === serviceId) ?? {
        serviceId,
        professionalId: null,
        executionMode: "sequential",
      }
    );
  }
  function updateItem(serviceId: string, patch: Partial<ComboItemConfig>) {
    setComboItems((current) => {
      const base = current.filter((item) => item.serviceId !== serviceId);
      return [...base, { ...itemConfig(serviceId), ...patch }];
    });
  }
  const combined = options.filter((item) => comboServiceIds.includes(item.id));
  /**
   * Duração real: itens simultâneos ocupam a mesma janela do item anterior,
   * então não somam tempo — só o mais longo dos dois conta.
   */
  const comboMinutes = combined.reduce((total, item, index) => {
    if (index > 0 && itemConfig(item.id).executionMode === "parallel") {
      const previous = combined[index - 1]!;
      return total + Math.max(0, item.duration_minutes - previous.duration_minutes);
    }
    return total + item.duration_minutes;
  }, 0);
  const comboCents = combined.reduce((total, item) => total + item.price_cents, 0);

  async function onImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
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
          key: mediaKey,
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
          base64: await fileToBase64(file),
        },
      });
      setImageUrl(result.url);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const manualMinutes =
      Math.max(
        0,
        Number(form.get("durationHours") || 0) * 60 +
          Number(form.get("durationMinutesPart") || 0),
      ) || 60;
    const manualCents = centsFromInput(String(form.get("price") ?? ""));
    const ok = await action.run(
      () =>
        save({
          data: {
            id: service?.id,
            name: String(form.get("name")),
            category: String(form.get("category")),
            description: String(form.get("description")),
            durationMinutes: isCombo && comboMinutes > 0 ? comboMinutes : manualMinutes,
            priceCents: isCombo && manualCents === 0 ? comboCents : manualCents,
            active: form.get("active") === "on",
            imageUrl,
            isCombo,
            requiresProfessional,
            comboServiceIds: isCombo ? comboServiceIds : [],
            comboItems: isCombo ? comboServiceIds.map((id) => itemConfig(id)) : [],
            isAddon: isCombo ? false : isAddon,
            addonForServiceIds: !isCombo && isAddon ? addonForServiceIds : [],
          },
        }),
      service ? "Serviço atualizado." : "Serviço cadastrado.",
    );
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>
            As alterações ficam disponíveis imediatamente na agenda.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label="Nome" name="name" defaultValue={service?.name ?? ""} required />
          <Field label="Categoria" name="category" defaultValue={service?.category ?? ""} />

          <div className="grid gap-2">
            <Label htmlFor="serviceImage">Foto do serviço (opcional)</Label>
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Pré-visualização do serviço"
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <ImagePlus className="h-5 w-5" />
                </div>
              )}
              <div className="grid gap-2">
                <Input
                  id="serviceImage"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => void onImage(event)}
                  disabled={uploading}
                />
                {imageUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-self-start"
                    onClick={() => setImageUrl("")}
                  >
                    Remover foto
                  </Button>
                ) : null}
              </div>
            </div>
            {uploading ? (
              <p className="text-xs text-muted-foreground">Enviando imagem…</p>
            ) : null}
          </div>

          <div className="grid gap-2 rounded-lg border p-3">
            <Label>Cliente precisa escolher um profissional para este serviço?</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="requiresProfessional"
                  checked={requiresProfessional}
                  onChange={() => setRequiresProfessional(true)}
                />
                Sim
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="requiresProfessional"
                  checked={!requiresProfessional}
                  onChange={() => setRequiresProfessional(false)}
                />
                Não
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Com “Não”, o cliente agenda normalmente e a empresa define internamente quem executa.
              O serviço continua valendo na página pública e dentro de combos.
            </p>
          </div>

          <div className="grid gap-3 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={isAddon}
                disabled={isCombo}
                onChange={(event) => setIsAddon(event.currentTarget.checked)}
              />
              Pode ser oferecido como adicional?
            </label>
            {isAddon && !isCombo ? (
              <div className="grid gap-2">
                <p className="text-xs text-muted-foreground">
                  Escolha em quais serviços e combos este adicional aparece na seção “Adicionar
                  também” da página pública. Preço e duração continuam sendo os deste serviço.
                </p>
                <div className="grid max-h-40 gap-1 overflow-y-auto">
                  {addonParentOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Cadastre primeiro os serviços ou combos principais.
                    </p>
                  ) : (
                    addonParentOptions.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={addonForServiceIds.includes(item.id)}
                          onChange={(event) => {
                            // Lemos o valor antes do updater: o evento do React é
                            // reciclado e currentTarget fica null dentro do callback.
                            const { checked } = event.currentTarget;
                            setAddonForServiceIds((current) =>
                              checked
                                ? [...new Set([...current, item.id])]
                                : current.filter((id) => id !== item.id),
                            );
                          }}
                        />
                        <span className="truncate">{item.name}</span>
                        {item.is_combo ? (
                          <span className="text-xs text-muted-foreground">Combo</span>
                        ) : null}
                      </label>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={isCombo}
                onChange={(event) => setIsCombo(event.currentTarget.checked)}
              />
              Este serviço é um combo (composição de serviços)
            </label>
            {isCombo ? (
              <div className="grid gap-2">
                <p className="text-xs text-muted-foreground">
                  Escolha pelo menos dois serviços. Duração é somada automaticamente e o preço pode
                  receber desconto no campo abaixo.
                </p>
                <div className="grid max-h-40 gap-1 overflow-y-auto">
                  {options.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Cadastre serviços simples antes de criar um combo.
                    </p>
                  ) : (
                    options.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={comboServiceIds.includes(item.id)}
                          onChange={(event) => {
                            const { checked } = event.currentTarget;
                            setComboServiceIds((current) =>
                              checked
                                ? [...new Set([...current, item.id])]
                                : current.filter((id) => id !== item.id),
                            );
                          }}
                        />
                        <span className="truncate">{item.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {formatDuration(item.duration_minutes)} · {brl(item.price_cents)}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {combined.length > 0 ? (
                  <div className="grid gap-2 rounded-xl border p-3">
                    <p className="text-sm font-medium">Quem executa cada serviço</p>
                    <p className="text-xs text-muted-foreground">
                      Cada serviço ocupa apenas a agenda do profissional responsável, e a comissão
                      vai para ele. O cliente continua vendo um único agendamento.
                    </p>
                    {combined.map((item, index) => {
                      const config = itemConfig(item.id);
                      const habilitados = professionals.filter(
                        (professional) =>
                          professional.active &&
                          (professional.serviceIds.length === 0 ||
                            professional.serviceIds.includes(item.id)),
                      );
                      return (
                        <div key={item.id} className="grid gap-2 border-t pt-2 first:border-0 first:pt-0">
                          <span className="text-sm">{item.name}</span>
                          <select
                            aria-label={`Profissional responsável por ${item.name}`}
                            value={config.professionalId ?? ""}
                            onChange={(event) =>
                              updateItem(item.id, {
                                professionalId: event.target.value || null,
                              })
                            }
                            className="h-10 rounded-md border bg-background px-3 text-sm"
                          >
                            <option value="">Qualquer profissional disponível</option>
                            {habilitados.map((professional) => (
                              <option key={professional.id} value={professional.id}>
                                {professional.name}
                              </option>
                            ))}
                          </select>
                          {index > 0 ? (
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={config.executionMode === "parallel"}
                                onChange={(event) =>
                                  updateItem(item.id, {
                                    executionMode: event.currentTarget.checked
                                      ? "parallel"
                                      : "sequential",
                                  })
                                }
                              />
                              Ao mesmo tempo que o serviço anterior
                            </label>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Este serviço inicia o atendimento.
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground">
                      Duração real do atendimento: {formatDuration(comboMinutes)} · {brl(comboCents)}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="durationHours">Duração</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    id="durationHours"
                    name="durationHours"
                    type="number"
                    min={0}
                    max={12}
                    placeholder="0"
                    disabled={isCombo && comboMinutes > 0}
                    defaultValue={service ? Math.floor(service.duration_minutes / 60) || "" : ""}
                  />
                  <span className="text-sm text-muted-foreground">h</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="durationMinutesPart"
                    name="durationMinutesPart"
                    type="number"
                    min={0}
                    max={59}
                    step={5}
                    placeholder="30"
                    disabled={isCombo && comboMinutes > 0}
                    defaultValue={service ? service.duration_minutes % 60 || "" : ""}
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </div>
            </div>
            <Field
              label="Preço (R$)"
              name="price"
              inputMode="decimal"
              placeholder={isCombo ? (comboCents / 100).toFixed(2).replace(".", ",") : "0,00"}
              defaultValue={
                service?.price_cents ? (service.price_cents / 100).toFixed(2).replace(".", ",") : ""
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={service?.description ?? ""}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input name="active" type="checkbox" defaultChecked={service?.active ?? true} />{" "}
            Disponível
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={action.pending || uploading}>
              {action.pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!);
  return btoa(binary);
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

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h${String(rest).padStart(2, "0")}`;
  if (hours) return `${hours}h`;
  return `${rest} min`;
}
