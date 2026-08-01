import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

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
import type { Client } from "@/modules/mvp/domain";
import { deleteClient, listClients, saveClient } from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";

export const Route = createFileRoute("/painel/clientes")({
  loader: () => listClients(),
  head: () => ({ meta: [{ title: "Clientes — Beauty Hub Connect" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const clients = Route.useLoaderData();
  const remove = useServerFn(deleteClient);
  const action = useMvpAction();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Client | null>();
  const term = search.trim().toLowerCase();
  const filtered = clients.filter((client) => {
    const matchesSearch =
      !term ||
      [client.name, client.phone, client.email].some((value) =>
        value?.toLowerCase().includes(term),
      );
    const matchesStatus =
      status === "all" || (status === "active" ? client.active : !client.active);
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <PageHeader
        eyebrow="Relacionamento"
        title="Clientes"
        description="Cadastre e mantenha os dados dos seus clientes."
        action={
          <Button className="rounded-full" onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, telefone ou e-mail"
        />
        <select
          aria-label="Filtrar clientes"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          className="h-10 rounded-md border bg-background px-3 text-sm sm:mb-0"
        >
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description="Cadastre seu primeiro cliente ou altere os filtros."
        />
      ) : (
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {filtered.map((client) => (
            <Card key={client.id} className="gap-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-medium">{client.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {client.phone || client.email || "Sem contato informado"}
                  </p>
                </div>
                <Badge variant={client.active ? "secondary" : "outline"}>
                  {client.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="grid gap-1 text-sm text-muted-foreground">
                {client.email ? <p>E-mail: {client.email}</p> : null}
                {client.birth_date ? (
                  <p>
                    Nascimento:{" "}
                    {new Date(client.birth_date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </p>
                ) : null}
                {client.address ? <p>Endereço: {client.address}</p> : null}
                {client.notes ? <p className="rounded-lg bg-muted p-3">{client.notes}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(client)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <DeleteButton
                  label={client.name}
                  pending={action.pending}
                  onConfirm={() =>
                    void action.run(() => remove({ data: { id: client.id } }), "Cliente excluído.")
                  }
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing !== undefined ? (
        <ClientDialog client={editing} onClose={() => setEditing(undefined)} />
      ) : null}
    </div>
  );
}

function ClientDialog({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const save = useServerFn(saveClient);
  const action = useMvpAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await action.run(
      () =>
        save({
          data: {
            id: client?.id,
            name: String(form.get("name")),
            phone: String(form.get("phone")),
            email: String(form.get("email")),
            birthDate: String(form.get("birthDate")),
            address: String(form.get("address")),
            notes: String(form.get("notes")),
            active: form.get("active") === "on",
          },
        }),
      client ? "Cliente atualizado." : "Cliente cadastrado.",
    );
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{client ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>Os dados serão salvos na empresa atual.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label="Nome" name="name" defaultValue={client?.name ?? ""} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefone" name="phone" defaultValue={client?.phone ?? ""} />
            <Field label="E-mail" name="email" type="email" defaultValue={client?.email ?? ""} />
            <Field
              label="Data de nascimento"
              name="birthDate"
              type="date"
              defaultValue={client?.birth_date ?? ""}
            />
            <Field label="Endereço" name="address" defaultValue={client?.address ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ""} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input name="active" type="checkbox" defaultChecked={client?.active ?? true} /> Cliente
            ativo
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
