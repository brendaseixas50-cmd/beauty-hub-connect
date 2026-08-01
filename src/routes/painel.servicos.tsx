import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Pencil, Plus } from "lucide-react";
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
import { brl, centsFromInput, type Service } from "@/modules/mvp/domain";
import { deleteService, listServices, saveService } from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";

export const Route = createFileRoute("/painel/servicos")({
  loader: () => listServices(),
  head: () => ({ meta: [{ title: "Serviços — Beauty Hub Connect" }] }),
  component: ServicesPage,
});

function ServicesPage() {
  const services = Route.useLoaderData();
  const remove = useServerFn(deleteService);
  const action = useMvpAction();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<Service | null>();
  const categories = useMemo(
    () => [...new Set(services.map((item) => item.category).filter(Boolean))] as string[],
    [services],
  );
  const term = search.trim().toLowerCase();
  const filtered = services.filter(
    (service) =>
      (!term || service.name.toLowerCase().includes(term)) &&
      (category === "all" || service.category === category),
  );

  return (
    <div>
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
                <div className="min-w-0">
                  <p className="truncate text-lg font-medium">{service.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {service.category || "Sem categoria"}
                  </p>
                </div>
                <Badge variant={service.active ? "secondary" : "outline"}>
                  {service.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              {service.description ? (
                <p className="text-sm text-muted-foreground">{service.description}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="font-medium">{brl(service.price_cents)}</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" /> {service.duration_minutes} min
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(service)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <DeleteButton
                  label={service.name}
                  pending={action.pending}
                  onConfirm={() =>
                    void action.run(() => remove({ data: { id: service.id } }), "Serviço excluído.")
                  }
                />
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing !== undefined ? (
        <ServiceDialog service={editing} onClose={() => setEditing(undefined)} />
      ) : null}
    </div>
  );
}

function ServiceDialog({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const save = useServerFn(saveService);
  const action = useMvpAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await action.run(
      () =>
        save({
          data: {
            id: service?.id,
            name: String(form.get("name")),
            category: String(form.get("category")),
            description: String(form.get("description")),
            durationMinutes: Number(form.get("durationMinutes")),
            priceCents: centsFromInput(String(form.get("price"))),
            active: form.get("active") === "on",
          },
        }),
      service ? "Serviço atualizado." : "Serviço cadastrado.",
    );
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>
            As alterações ficam disponíveis imediatamente na agenda.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label="Nome" name="name" defaultValue={service?.name ?? ""} required />
          <Field label="Categoria" name="category" defaultValue={service?.category ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Duração (minutos)"
              name="durationMinutes"
              type="number"
              min={5}
              defaultValue={service?.duration_minutes ?? 60}
              required
            />
            <Field
              label="Preço (R$)"
              name="price"
              inputMode="decimal"
              defaultValue={service ? (service.price_cents / 100).toFixed(2).replace(".", ",") : ""}
              required
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
