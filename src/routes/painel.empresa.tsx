import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { FormEvent } from "react";

import { PageHeader } from "@/components/mvp-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCompany, updateCompany } from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";

export const Route = createFileRoute("/painel/empresa")({
  loader: () => getCompany(),
  head: () => ({ meta: [{ title: "Empresa — Beauty Hub Connect" }] }),
  component: CompanyPage,
});

function CompanyPage() {
  const company = Route.useLoaderData();
  const save = useServerFn(updateCompany);
  const action = useMvpAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(
      () =>
        save({
          data: {
            name: String(form.get("name")),
            productType: company.product_type === "barber" ? "barber" : "beauty",
            document: String(form.get("document")),
            email: String(form.get("email")),
            phone: String(form.get("phone")),
            whatsapp: String(form.get("whatsapp")),
            instagram: String(form.get("instagram")),
            description: String(form.get("description")),
            addressLine: String(form.get("addressLine")),
            city: String(form.get("city")),
            state: String(form.get("state")),
            postalCode: String(form.get("postalCode")),
            businessHours: (company.business_hours ?? {}) as Record<string, string>,
          },
        }),
      "Dados da empresa atualizados.",
    );
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Cadastro empresarial"
        title="Empresa"
        description="Mantenha os dados de contato e localização sempre atualizados."
      />

      <form onSubmit={onSubmit} className="mt-8 grid gap-6">
        <Card className="grid gap-5 p-6">
          <h2 className="text-xl">Dados principais</h2>
          <Field label="Nome da empresa" name="name" defaultValue={company.name} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CPF ou CNPJ" name="document" defaultValue={company.document ?? ""} />
            <Field
              label="E-mail comercial"
              name="email"
              type="email"
              defaultValue={company.email ?? ""}
            />
            <Field label="Telefone" name="phone" defaultValue={company.phone ?? ""} />
            <Field label="WhatsApp" name="whatsapp" defaultValue={company.whatsapp ?? ""} />
            <Field label="Instagram" name="instagram" defaultValue={company.instagram ?? ""} />
            <Field label="Identificador público" name="slug" defaultValue={company.slug} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descrição da empresa</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={company.description ?? ""}
            />
          </div>
        </Card>

        <Card className="grid gap-5 p-6">
          <h2 className="text-xl">Endereço</h2>
          <Field
            label="Endereço completo"
            name="addressLine"
            defaultValue={company.address_line ?? ""}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Cidade" name="city" defaultValue={company.city ?? ""} />
            <Field label="UF" name="state" maxLength={2} defaultValue={company.state ?? ""} />
            <Field label="CEP" name="postalCode" defaultValue={company.postal_code ?? ""} />
          </div>
        </Card>

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full sm:w-fit"
          disabled={action.pending}
        >
          {action.pending ? "Salvando…" : "Salvar empresa"}
        </Button>
      </form>
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
