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
import type { ProfessionalWithServices } from "@/modules/mvp/domain";
import {
  deleteProfessional,
  listProfessionals,
  listServices,
  saveProfessional,
  uploadPublicMedia,
} from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";
import { LuviContextBridge } from "@/modules/luvi-core/context";

export const Route = createFileRoute("/painel/profissionais")({
  loader: async () => {
    const [professionals, services] = await Promise.all([listProfessionals(), listServices()]);
    return { professionals, services };
  },
  head: () => ({ meta: [{ title: "Profissionais — Beauty Hub Connect" }] }),
  component: ProfessionalsPage,
});

function ProfessionalsPage() {
  const { professionals, services } = Route.useLoaderData();
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
          <Button className="rounded-full" onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" /> Novo profissional
          </Button>
        }
      />
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
            </Card>
          ))}
        </div>
      )}
      {editing !== undefined ? (
        <ProfessionalDialog
          professional={editing}
          services={services}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}

function ProfessionalDialog({
  professional,
  services,
  onClose,
}: {
  professional: ProfessionalWithServices | null;
  services: Awaited<ReturnType<typeof listServices>>;
  onClose: () => void;
}) {
  const save = useServerFn(saveProfessional);
  const upload = useServerFn(uploadPublicMedia);
  const action = useMvpAction();
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
    const ok = await action.run(
      () =>
        save({
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
        }),
      professional ? "Profissional atualizado." : "Profissional cadastrado.",
    );
    if (ok) onClose();
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
