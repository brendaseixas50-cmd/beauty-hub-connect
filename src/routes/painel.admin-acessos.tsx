import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, ShieldCheck, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { PageHeader } from "@/components/mvp-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listPlatformAccess, removePlatformAccess, savePlatformAccess } from "@/modules/beta-access/server";

export const Route = createFileRoute("/painel/admin-acessos")({
  staleTime: 60_000,
  beforeLoad: ({ context }) => {
    const administrator =
      context.session.user.isPlatformAdministrator ||
      context.session.user.betaAccessType === "administrator";
    if (!administrator) throw redirect({ to: "/painel" });
  },
  loader: async () => ({ rows: await listPlatformAccess({ data: { email: "" } }) }),

  head: () => ({ meta: [{ title: "Acessos do Beta — Lu IA Studio" }] }),
  component: BetaAccessAdmin,
  errorComponent: () => (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Lu IA Studio"
        title="Acessos do Beta"
        description="Não foi possível carregar os dados administrativos agora. Atualize a página em alguns instantes."
      />
    </div>
  ),
});



type AccessRow = Awaited<ReturnType<typeof listPlatformAccess>>[number];
function BetaAccessAdmin() {
  const { rows: initialRows } = Route.useLoaderData();
  const listFn = useServerFn(listPlatformAccess);
  const saveFn = useServerFn(savePlatformAccess);
  const removeFn = useServerFn(removePlatformAccess);
  const [rows, setRows] = useState<AccessRow[]>(initialRows ?? []);
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  async function refresh(email = "") {
    setRows((await listFn({ data: { email } })) ?? []);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    setPending(true);
    setMessage(undefined);
    try {
      const expires = String(form.get("expiresAt") ?? "");
      await saveFn({
        data: {
          email: String(form.get("email")),
          productType: String(form.get("productType")) as "beauty" | "barber",
          accessType: String(form.get("accessType")) as
            "administrator" | "courtesy" | "beta_tester",
          status: String(form.get("status")) as AccessStatus,
          planCode: String(form.get("planCode")) as "solo" | "team",
          expiresAt: expires ? new Date(`${expires}T23:59:59-03:00`).toISOString() : null,
          notes: String(form.get("notes") ?? ""),
        },
      });
      formElement.reset();
      await refresh();
      setMessage("Acesso atualizado com sucesso.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setPending(false);
    }
  }


  async function changeStatus(row: AccessRow, status: AccessStatus, success: string) {
    setPending(true);
    setMessage(undefined);
    try {
      await saveFn({
        data: {
          email: row.email,
          productType: row.product_type as "beauty" | "barber",
          accessType: row.access_type as "administrator" | "courtesy" | "beta_tester",
          status,
          planCode: (row.plan_code === "team" ? "team" : "solo") as "solo" | "team",
          expiresAt: row.expires_at,
          notes: row.notes ?? "",
        },
      });
      await refresh();
      setMessage(success);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível atualizar o acesso.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Lu IA Studio"
        title="Acessos do Beta"
        description="Libere cada produto de forma independente e segura."
      />
      <Card className="mt-6 grid gap-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <ShieldCheck /> Liberar ou atualizar acesso
        </h2>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <Field label="E-mail" name="email" type="email" required />
          <SelectField
            label="Produto"
            name="productType"
            options={[
              ["beauty", "LuBeauty Pro"],
              ["barber", "LuBarber Pro"],
            ]}
          />
          <SelectField
            label="Tipo"
            name="accessType"
            options={[
              ["administrator", "Administrador"],
              ["courtesy", "Cortesia"],
              ["beta_tester", "Beta Tester"],
            ]}
          />
          <SelectField
            label="Status"
            name="status"
            options={[
              ["pending", "Pendente (aguardando aprovação)"],
              ["active", "Ativo"],
              ["suspended", "Suspenso"],
              ["revoked", "Revogado"],
              ["expired", "Expirado"],
            ]}
          />
          <SelectField
            label="Plano"
            name="planCode"
            options={[["solo", "Solo — 1 profissional"], ["team", "Equipe — até 8 profissionais"]]}
          />
          <Field label="Expiração opcional" name="expiresAt" type="date" />
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="notes">Observações administrativas</Label>
            <Textarea id="notes" name="notes" maxLength={1000} />
          </div>
          <Button type="submit" disabled={pending} className="md:col-span-2 md:w-fit">
            {pending ? "Salvando…" : "Salvar acesso"}
          </Button>
        </form>
        {message ? (
          <p role="status" className="text-sm font-medium text-primary">
            {message}
          </p>
        ) : null}
      </Card>

      <Card className="mt-6 gap-4 p-5 sm:p-6">
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await refresh(String(form.get("search")));
          }}
        >
          <Input name="search" type="search" placeholder="Localizar por e-mail" />
          <Button type="submit" size="icon" aria-label="Buscar">
            <Search />
          </Button>
        </form>
        <div className="grid gap-3">
          {rows.map((row: AccessRow) => (
            <div
              key={row.id}
              className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <strong className="block break-all">{row.email}</strong>
                <p className="text-sm text-muted-foreground">
                  {row.product_type === "barber" ? "LuBarber Pro" : "LuBeauty Pro"} · {statusLabel(row.status)} · Plano {row.plan_code === "team" ? "Equipe" : "Solo"}
                </p>
                <p className="text-xs text-muted-foreground">{row.active_professionals ?? 0} profissionais ativos</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["solo", "team"] as const).map((planCode) => (
                  <Button key={planCode} type="button" size="sm" variant={row.plan_code === planCode ? "default" : "outline"} disabled={pending}
                    onClick={async () => {
                      setPending(true);
                      try {
                        await saveFn({ data: { email: row.email, productType: row.product_type as "beauty" | "barber", accessType: row.access_type as "administrator" | "courtesy" | "beta_tester", status: row.status as AccessStatus, planCode, expiresAt: row.expires_at, notes: row.notes ?? "" } });
                        await refresh();
                        const excess = planCode === "solo" && (row.active_professionals ?? 0) > 1;
                        setMessage(excess ? `Plano alterado para Solo. Nenhum dado foi excluído; novas ativações ficam bloqueadas até restar 1 profissional ativo.` : `Plano alterado para ${planCode === "team" ? "Equipe — até 8 profissionais" : "Solo — 1 profissional"}.`);
                      } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível alterar o plano."); }
                      finally { setPending(false); }
                    }}>
                    {planCode === "solo" ? "Definir como Solo" : "Definir como Equipe"}
                  </Button>
                ))}
                {row.status === "pending" ? (
                  <>
                    <Button type="button" size="sm" disabled={pending}
                      onClick={() => void changeStatus(row, "active", "Acesso aprovado e liberado.")}>
                      Aprovar acesso
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={pending}
                      onClick={() => void changeStatus(row, "revoked", "Solicitação recusada.")}>
                      Recusar
                    </Button>
                  </>
                ) : null}
                <Button type="button" variant="outline" size="icon" aria-label="Remover acesso" onClick={async () => { await removeFn({ data: { id: row.id } }); await refresh(); }}><Trash2 /></Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
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
function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select name={name} defaultValue={options[0]?.[0] ?? ""}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([value, text]) => (
            <SelectItem key={value} value={value}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type AccessStatus = "pending" | "active" | "suspended" | "revoked" | "expired";

function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Aguardando aprovação";
    case "active":
      return "Ativo";
    case "suspended":
      return "Suspenso";
    case "revoked":
      return "Recusado/Revogado";
    case "expired":
      return "Expirado";
    default:
      return status;
  }
}
