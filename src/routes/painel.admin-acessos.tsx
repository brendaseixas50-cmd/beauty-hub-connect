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
import {
  listPlatformAccess,
  listTenantPlans,
  removePlatformAccess,
  savePlatformAccess,
  setTenantPlan,
} from "@/modules/beta-access/server";

export const Route = createFileRoute("/painel/admin-acessos")({
  staleTime: 60_000,
  beforeLoad: ({ context }) => {
    const administrator =
      context.session.user.isPlatformAdministrator ||
      context.session.user.betaAccessType === "administrator";
    if (!administrator) throw redirect({ to: "/painel" });
  },
  loader: async () => {
    // Cada card carrega de forma independente: uma consulta com problema não derruba o painel.
    const [access, plans] = await Promise.allSettled([
      listPlatformAccess({ data: { email: "" } }),
      listTenantPlans({ data: { email: "" } }),
    ]);
    const planResult = plans.status === "fulfilled" ? plans.value : null;
    return {
      rows: access.status === "fulfilled" ? access.value : [],
      tenants: planResult?.tenants ?? [],
      loadError:
        access.status === "rejected"
          ? "Não foi possível carregar os acessos agora."
          : plans.status === "rejected"
            ? `Não foi possível carregar as empresas agora. ${
                plans.reason instanceof Error ? plans.reason.message : ""
              }`.trim()
            : (planResult?.warning ?? null),
    };
  },

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
type TenantPlanRow = Awaited<ReturnType<typeof listTenantPlans>>[number];

function BetaAccessAdmin() {
  const { rows: initialRows, tenants: initialTenants, loadError } = Route.useLoaderData();
  const listFn = useServerFn(listPlatformAccess);
  const saveFn = useServerFn(savePlatformAccess);
  const removeFn = useServerFn(removePlatformAccess);
  const tenantsFn = useServerFn(listTenantPlans);
  const planFn = useServerFn(setTenantPlan);
  const [rows, setRows] = useState<AccessRow[]>(initialRows ?? []);
  const [tenants, setTenants] = useState<TenantPlanRow[]>(initialTenants ?? []);
  const [message, setMessage] = useState<string | undefined>(loadError ?? undefined);
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
          status: String(form.get("status")) as "active" | "suspended" | "revoked" | "expired",
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
              ["active", "Ativo"],
              ["suspended", "Suspenso"],
              ["revoked", "Revogado"],
              ["expired", "Expirado"],
            ]}
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

      <Card className="mt-6 grid gap-4 p-5 sm:p-6">
        <div>
          <h2 className="text-xl">Plano de cada empresa</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Solo libera 1 profissional e Equipe libera até 8 profissionais.
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setTenants((await tenantsFn({ data: { email: String(form.get("empresa") ?? "") } })) ?? []);
          }}
        >
          <Input name="empresa" type="search" placeholder="Localizar por nome ou link" />
          <Button type="submit" size="icon" aria-label="Buscar empresa">
            <Search />
          </Button>
        </form>
        <div className="grid gap-3">
          {tenants.map((tenant: TenantPlanRow) => (
            <div
              key={tenant.id}
              className="grid gap-4 rounded-lg border p-4"
            >
              <div className="grid gap-1 sm:grid-cols-2 sm:gap-x-6">
                <div>
                  <strong className="block break-all">{tenant.name}</strong>
                  <p className="text-sm text-muted-foreground">{tenant.ownerEmail}</p>
                </div>
                <div className="text-sm sm:text-right">
                  <p>{tenant.productType === "barber" ? "LuBarber Pro" : "LuBeauty Pro"}</p>
                  <p className="text-muted-foreground">
                    {tenant.activeProfessionals} profissional
                    {tenant.activeProfessionals === 1 ? " ativo" : "is ativos"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                <p className="text-sm">
                  <span className="text-muted-foreground">Plano atual: </span>
                  <strong>{tenant.planCode === "team" ? "Equipe" : "Solo"}</strong>
                </p>
                <div className="flex flex-wrap gap-2">
                {(["solo", "team"] as const).map((code) => (
                  <Button
                    key={code}
                    type="button"
                    size="sm"
                    variant={tenant.planCode === code ? "default" : "outline"}
                    disabled={pending}
                    onClick={async () => {
                      setPending(true);
                      setMessage(undefined);
                      try {
                        const result = await planFn({
                          data: { tenantId: tenant.id, planCode: code },
                        });
                        setTenants((current) =>
                          current.map((item) =>
                            item.id === tenant.id
                              ? {
                                  ...item,
                                  planCode: code,
                                  planName:
                                    code === "team"
                                      ? "Equipe (até 8)"
                                      : "Solo (1 profissional)",
                                }
                              : item,
                          ),
                        );
                        const planLabel = code === "team" ? "Equipe" : "Solo";
                        const capacityLabel =
                          code === "team" ? "até 8 profissionais" : "1 profissional";
                        setMessage(
                          result.overLimit
                            ? `Plano alterado para ${planLabel} — ${capacityLabel}. Existem ${result.activeProfessionals} profissionais ativos; nenhum dado foi excluído e novas ativações ficam bloqueadas até a quantidade ser compatível.`
                            : `Plano alterado para ${planLabel} — ${capacityLabel}.`,
                        );
                      } catch (cause) {
                        setMessage(
                          cause instanceof Error ? cause.message : "Não foi possível alterar.",
                        );
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    {code === "solo" ? "Definir como Solo" : "Definir como Equipe"}
                  </Button>
                ))}
                </div>
              </div>
            </div>
          ))}
        </div>
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
                  {row.product_type === "barber" ? "LuBarber Pro" : "LuBeauty Pro"} ·{" "}
                  {row.access_type} · {row.status}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  await removeFn({ data: { id: row.id } });
                  await refresh();
                }}
              >
                <Trash2 /> Remover
              </Button>
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
