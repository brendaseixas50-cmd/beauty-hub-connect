import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { FormEvent } from "react";

import { PageHeader } from "@/components/mvp-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCompany, updateCompany } from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";

export const Route = createFileRoute("/painel/configuracoes")({
  loader: () => getCompany(),
  head: () => ({ meta: [{ title: "Configurações — Beauty Hub Connect" }] }),
  component: SettingsPage,
});

const days = [
  ["monday", "Segunda-feira"],
  ["tuesday", "Terça-feira"],
  ["wednesday", "Quarta-feira"],
  ["thursday", "Quinta-feira"],
  ["friday", "Sexta-feira"],
  ["saturday", "Sábado"],
  ["sunday", "Domingo"],
] as const;

function SettingsPage() {
  const company = Route.useLoaderData();
  const save = useServerFn(updateCompany);
  const action = useMvpAction();
  const hours = (company.business_hours ?? {}) as Record<string, string>;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const businessHours = Object.fromEntries(days.map(([key]) => [key, String(form.get(key))]));
    await action.run(
      () =>
        save({
          data: {
            name: company.name,
            productType: String(form.get("productType")) as "beauty" | "barber",
            document: company.document ?? "",
            email: company.email ?? "",
            phone: company.phone ?? "",
            whatsapp: company.whatsapp ?? "",
            instagram: company.instagram ?? "",
            description: company.description ?? "",
            addressLine: company.address_line ?? "",
            city: company.city ?? "",
            state: company.state ?? "",
            postalCode: company.postal_code ?? "",
            businessHours,
          },
        }),
      "Configurações atualizadas.",
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Preferências"
        title="Configurações"
        description="Defina o produto utilizado e os horários padrão da empresa."
      />
      <form onSubmit={onSubmit} className="mt-8 grid gap-6">
        <Card className="grid gap-4 p-6">
          <h2 className="text-xl">Produto</h2>
          <div className="grid gap-2">
            <Label htmlFor="productType">Experiência da empresa</Label>
            <select
              id="productType"
              name="productType"
              defaultValue={company.product_type}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="beauty">LuBeauty Pro</option>
              <option value="barber">LuBarber Pro</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Esta escolha altera a identidade visual e os textos do painel sem afetar os dados.
            </p>
          </div>
        </Card>

        <Card className="grid gap-4 p-6">
          <h2 className="text-xl">Horários de funcionamento</h2>
          <p className="text-sm text-muted-foreground">
            Use o formato 09:00-18:00 ou escreva “closed” para dias fechados.
          </p>
          {days.map(([key, label]) => (
            <div key={key} className="grid items-center gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <Label htmlFor={key}>{label}</Label>
              <Input id={key} name={key} defaultValue={hours[key] ?? "closed"} required />
            </div>
          ))}
        </Card>

        <Card className="grid gap-3 p-6">
          <h2 className="text-xl">Segurança da conta</h2>
          <p className="text-sm text-muted-foreground">
            Para trocar a senha, solicite um link seguro de recuperação no e-mail da conta.
          </p>
          <Button asChild variant="outline" className="w-fit">
            <Link to="/recuperar-senha">Alterar senha</Link>
          </Button>
        </Card>

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full sm:w-fit"
          disabled={action.pending}
        >
          {action.pending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </form>
    </div>
  );
}
