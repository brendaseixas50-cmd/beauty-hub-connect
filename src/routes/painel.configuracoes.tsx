import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type FormEvent } from "react";
import { ExternalLink, Link2, ShieldCheck, Unlink } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/mvp-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { coresDaEmpresa } from "@/lib/cores-publicas";
import { getCompany, updateCompany, updatePublicSettings } from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";
import {
  disconnectMercadoPago,
  getMercadoPagoConnection,
  startMercadoPagoConnection,
} from "@/modules/payments/mercado-pago.server";

export const Route = createFileRoute("/painel/configuracoes")({
  loader: async () => {
    const [company, mercadoPago] = await Promise.all([getCompany(), getMercadoPagoConnection()]);
    return { company, mercadoPago };
  },
  head: () => ({
    meta: [
      { title: "Configurações do atendimento — Lu IA Studio" },
      {
        name: "description",
        content:
          "Horários de funcionamento, políticas de cancelamento, sinal e meios de pagamento do seu atendimento.",
      },
      { property: "og:title", content: "Configurações do atendimento" },
      {
        property: "og:description",
        content: "Defina horários, políticas de agendamento e formas de pagamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
  const { company, mercadoPago } = Route.useLoaderData();
  const save = useServerFn(updateCompany);
  const action = useMvpAction();
  const hours = (company.business_hours ?? {}) as Record<string, string>;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const businessHours = Object.fromEntries(days.map(([key]) => [key, String(form.get(key))]));
    await action.run(async () => {
      const result = await save({
        data: {
          name: company.name,
          productType: company.product_type === "barber" ? "barber" : "beauty",
          document: company.document ?? "",
          email: company.email ?? "",
          phone: company.phone ?? "",
          whatsapp: company.whatsapp ?? "",
          whatsappInitialMessage: company.whatsapp_initial_message ?? "",
          whatsappNotificationPhone: company.whatsapp_notification_phone ?? "",
          whatsappIntegrationMode: "development",
          metaPhoneNumberId: company.meta_phone_number_id ?? "",
          metaWabaId: company.meta_waba_id ?? "",
          instagram: company.instagram ?? "",
          facebook: company.facebook ?? "",
          description: company.description ?? "",
          addressLine: company.address_line ?? "",
          city: company.city ?? "",
          state: company.state ?? "",
          postalCode: company.postal_code ?? "",
          mapUrl: company.map_url ?? "",
          businessHours,
        },
      });
      if (result.locationWarning) toast.warning(result.locationWarning);
    }, "Horários atualizados.");
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Preferências"
        title="Configurações"
        description="Horários, políticas de agendamento e formas de pagamento. Os dados do seu estabelecimento ficam em Empresa."
      />
      <form onSubmit={onSubmit} className="mt-8 grid gap-6">
        <Card className="grid gap-4 p-5 sm:p-6">
          <div>
            <h2 className="text-xl">Horários de funcionamento</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use o formato 09:00-18:00 ou escreva “closed” nos dias fechados.
            </p>
          </div>
          {days.map(([key, label]) => (
            <div key={key} className="grid items-center gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <Label htmlFor={key}>{label}</Label>
              <Input id={key} name={key} defaultValue={hours[key] ?? "closed"} required />
            </div>
          ))}
          <Button
            type="submit"
            size="lg"
            className="w-full rounded-full sm:w-fit"
            disabled={action.pending}
          >
            {action.pending ? "Salvando…" : "Salvar horários"}
          </Button>
        </Card>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card className="grid gap-3 p-5 sm:p-6">
            <h2 className="text-lg">Áreas e serviços sugeridos</h2>
            <p className="text-sm text-muted-foreground">
              Revise suas áreas de atuação e adicione novas sugestões de serviços.
            </p>
            <Button asChild variant="outline" className="w-fit">
              <Link to="/onboarding" search={{ retorno: "/painel/configuracoes" }}>
                Alterar áreas
              </Link>
            </Button>
          </Card>

          <Card className="grid gap-3 p-5 sm:p-6">
            <h2 className="text-lg">Segurança da conta</h2>
            <p className="text-sm text-muted-foreground">
              Receba um link seguro por e-mail para trocar sua senha.
            </p>
            <Button asChild variant="outline" className="w-fit">
              <Link to="/recuperar-senha">Alterar senha</Link>
            </Button>
          </Card>
        </div>

        <Card className="grid gap-3 p-5 sm:p-6">
          <h2 className="text-lg">Aparência da página pública</h2>
          <p className="text-sm text-muted-foreground">
            Logo, banner, cores e textos ficam no módulo Empresa.
          </p>
          <Button asChild variant="outline" className="w-fit">
            <Link to="/painel/empresa">
              <ExternalLink className="h-4 w-4" /> Abrir Empresa
            </Link>
          </Button>
        </Card>
      </form>
      <BookingSettings company={company} mercadoPago={mercadoPago} />
    </div>
  );
}

function BookingSettings({
  company,
  mercadoPago,
}: {
  company: Awaited<ReturnType<typeof getCompany>>;
  mercadoPago: Awaited<ReturnType<typeof getMercadoPagoConnection>>;
}) {
  const save = useServerFn(updatePublicSettings);
  const action = useMvpAction();
  const connect = useServerFn(startMercadoPagoConnection);
  const disconnect = useServerFn(disconnectMercadoPago);
  const cores = coresDaEmpresa(company);
  const payments = (company.payment_methods ?? {
    pix: false,
    card: false,
    local: true,
    mercadoPago: false,
  }) as Record<string, boolean>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(async () => {
      const result = await save({
        data: {
          logoUrl: company.logo_url ?? "",
          bannerUrl: company.banner_url ?? "",
          description: company.description ?? "",
          addressLine: company.address_line ?? "",
          city: company.city ?? "",
          state: company.state ?? "",
          postalCode: company.postal_code ?? "",
          mapUrl: company.map_url ?? "",
          showPublicLocation: form.get("showPublicLocation") === "on",
          primaryColor: cores.destaque,
          secondaryColor: company.secondary_color,
          textColor: cores.texto,
          pageEnabled: form.get("pageEnabled") === "on",
          cancellationPolicyEnabled: form.get("cancellationPolicyEnabled") === "on",
          cancellationPolicy: String(form.get("cancellationPolicy")),
          depositEnabled: form.get("depositEnabled") === "on",
          depositType: String(form.get("depositType")) as
            "none" | "percent_30" | "percent_50" | "fixed",
          depositValueCents: Math.max(
            0,
            Math.round(Number(String(form.get("depositValue")).replace(",", ".")) * 100) || 0,
          ),
          paymentMethods: {
            pix: form.get("pix") === "on",
            card: form.get("card") === "on",
            local: form.get("local") === "on",
            mercadoPago: mercadoPago.connected && form.get("mercadoPago") === "on",
          },
          publicStoreEnabled: form.get("publicStoreEnabled") === "on",
        },
      });
      if (result.locationWarning) toast.warning(result.locationWarning);
    }, "Configurações de atendimento atualizadas.");
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-6">
      <Card className="grid gap-5 p-5 sm:p-6">
        <h2 className="text-xl">Agendamento e cancelamento</h2>
        <label className="flex items-start gap-3 rounded-xl border p-4">
          <input
            name="pageEnabled"
            type="checkbox"
            className="mt-1"
            defaultChecked={company.public_page_status === "published"}
          />
          <span>
            <strong className="block text-sm">Página pública ativa</strong>
            <span className="text-sm text-muted-foreground">
              Libera o agendamento online para suas clientes.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl bg-muted/40 p-4">
          <input
            name="showPublicLocation"
            type="checkbox"
            className="mt-1"
            defaultChecked={company.show_public_location}
          />
          <span>
            <strong className="block text-sm">Exibir localização na página pública</strong>
            <span className="text-sm text-muted-foreground">
              Mostra endereço, mapa e o botão “Como chegar”.
            </span>
          </span>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            name="cancellationPolicyEnabled"
            type="checkbox"
            defaultChecked={company.cancellation_policy_enabled}
          />
          Ativar política de cancelamento
        </label>
        <div className="grid gap-2">
          <Label htmlFor="cancellationPolicy">Texto da política</Label>
          <Textarea
            id="cancellationPolicy"
            name="cancellationPolicy"
            rows={3}
            defaultValue={company.cancellation_policy ?? ""}
            maxLength={500}
          />
        </div>
      </Card>

      <Card className="grid gap-5 p-5 sm:p-6">
        <h2 className="text-xl">Sinal e pagamentos</h2>
        <label className="flex items-center gap-3 text-sm">
          <input name="depositEnabled" type="checkbox" defaultChecked={company.deposit_enabled} />
          Cobrar sinal para confirmar o horário
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="depositType">Regra do sinal</Label>
            <select
              id="depositType"
              name="depositType"
              defaultValue={company.deposit_type}
              className="h-11 rounded-xl border bg-card px-3"
            >
              <option value="none">Não cobrar</option>
              <option value="percent_30">30%</option>
              <option value="percent_50">50%</option>
              <option value="fixed">Valor fixo</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="depositValue">Valor fixo (R$)</Label>
            <Input
              id="depositValue"
              name="depositValue"
              inputMode="decimal"
              defaultValue={(company.deposit_value_cents / 100).toFixed(2).replace(".", ",")}
            />
          </div>
        </div>
        <div>
          <h3 className="font-semibold">Meios de pagamento aceitos</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["pix", "Pix"],
                ["card", "Cartão"],
                ["local", "Pagamento no local"],
              ] as const
            ).map(([name, label]) => (
              <label key={name} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                <input name={name} type="checkbox" defaultChecked={payments[name]} /> {label}
              </label>
            ))}
            <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <input
                name="mercadoPago"
                type="checkbox"
                defaultChecked={
                  mercadoPago.connected && mercadoPago.webhookConfigured && payments["mercadoPago"]
                }
                disabled={!mercadoPago.connected || !mercadoPago.webhookConfigured}
              />
              Mercado Pago
              {mercadoPago.connected && mercadoPago.webhookConfigured ? "" : " (indisponível)"}
            </label>
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            name="publicStoreEnabled"
            type="checkbox"
            defaultChecked={company.public_store_enabled}
          />
          Ativar Loja na página pública
        </label>
        <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 text-primary" />
            <div>
              <h3 className="font-semibold">Recebimentos online</h3>
              <p className="text-sm text-muted-foreground">
                Conecte sua conta em poucos cliques. Nenhuma senha ou chave é exibida aqui.
              </p>
            </div>
          </div>
          {mercadoPago.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-950">
              <div>
                <strong className="block">Conta conectada</strong>
                <span className="text-sm">Pronta para receber pagamentos.</span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void action.run(async () => {
                    await disconnect();
                    window.location.reload();
                  }, "Conta desconectada.")
                }
                disabled={action.pending}
              >
                <Unlink /> Desconectar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-fit"
              disabled={!mercadoPago.configured || action.pending}
              onClick={() =>
                void action.run(async () => {
                  const result = await connect();
                  window.location.assign(result.url);
                }, "Abrindo a autorização…")
              }
            >
              <Link2 /> Conectar conta de recebimento
            </Button>
          )}
          {!mercadoPago.configured ? (
            <p className="text-sm text-muted-foreground">
              Os recebimentos online serão liberados em breve para a sua conta.
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={action.pending}
          className="w-full rounded-full sm:w-fit"
        >
          {action.pending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </Card>
    </form>
  );
}
