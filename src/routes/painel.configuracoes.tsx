import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { ExternalLink, ImageUp, Link2, ShieldCheck, Trash2, Unlink } from "lucide-react";

import { PageHeader } from "@/components/mvp-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getCompany,
  updateCompany,
  updatePublicSettings,
  uploadPublicMedia,
} from "@/modules/mvp/server";
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
  const { company, mercadoPago } = Route.useLoaderData();
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
            <Label>Produto licenciado</Label>
            <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm font-medium">
              {company.product_type === "barber" ? "LuBarber Pro" : "LuBeauty Pro"}
            </div>
            <p className="text-xs text-muted-foreground">
              O produto é definido pela licença independente desta empresa e não pode ser trocado
              apenas pela interface.
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
          <h2 className="text-xl">Áreas de atuação e serviços iniciais</h2>
          <p className="text-sm text-muted-foreground">
            Revise suas áreas, escolha a principal e adicione novas sugestões sem duplicar os
            serviços existentes.
          </p>
          <Button asChild variant="outline" className="w-fit">
            <Link to="/onboarding" search={{ retorno: "/painel/configuracoes" }}>
              Alterar áreas e sugestões
            </Link>
          </Button>
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
      <PublicSettings company={company} mercadoPago={mercadoPago} />
    </div>
  );
}

function PublicSettings({
  company,
  mercadoPago,
}: {
  company: Awaited<ReturnType<typeof getCompany>>;
  mercadoPago: Awaited<ReturnType<typeof getMercadoPagoConnection>>;
}) {
  const save = useServerFn(updatePublicSettings);
  const upload = useServerFn(uploadPublicMedia);
  const action = useMvpAction();
  const connect = useServerFn(startMercadoPagoConnection);
  const disconnect = useServerFn(disconnectMercadoPago);
  const [logo, setLogo] = useState(company.logo_url ?? "");
  const [banner, setBanner] = useState(company.banner_url ?? "");
  const [primary, setPrimary] = useState(company.primary_color);
  const [secondary, setSecondary] = useState(company.secondary_color);
  const [text, setText] = useState(company.text_color);
  const payments = (company.payment_methods ?? {
    pix: false,
    card: false,
    local: true,
    mercadoPago: false,
  }) as Record<string, boolean>;

  async function uploadImage(event: ChangeEvent<HTMLInputElement>, kind: "logo" | "banner") {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 3 * 1024 * 1024
    )
      return;
    const result = await upload({
      data: {
        kind,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        base64: await fileToBase64(file),
      },
    });
    if (kind === "logo") setLogo(result.url);
    else setBanner(result.url);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(
      () =>
        save({
          data: {
            logoUrl: logo,
            bannerUrl: banner,
            description: String(form.get("description")),
            addressLine: String(form.get("addressLine")),
            city: String(form.get("city")),
            state: String(form.get("state")),
            postalCode: String(form.get("postalCode")),
            mapUrl: String(form.get("mapUrl")),
            showPublicLocation: form.get("showPublicLocation") === "on",
            primaryColor: primary,
            secondaryColor: secondary,
            textColor: text,
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
        }),
      "Página pública atualizada com sucesso.",
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-6">
      <Card className="grid gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl">Página pública</h2>
            <p className="text-sm text-muted-foreground">
              Personalização simples, visual e aplicada imediatamente.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href={`/p/${company.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink /> Visualizar página pública
            </a>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageSetting
            label="Logo redonda"
            help="Recomendado: imagem quadrada."
            url={logo}
            kind="logo"
            onChange={uploadImage}
            onRemove={() => setLogo("")}
          />
          <ImageSetting
            label="Banner quadrado"
            help="Recomendado: imagem 1:1 com área segura central."
            url={banner}
            kind="banner"
            onChange={uploadImage}
            onRemove={() => setBanner("")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="public-description">Descrição sobre a empresa</Label>
          <Textarea
            id="public-description"
            name="description"
            defaultValue={company.description ?? ""}
            maxLength={500}
          />
        </div>
        <div className="grid gap-4 rounded-2xl border p-4 sm:p-5">
          <div>
            <h3 className="font-semibold">Localização do estabelecimento</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Aparece somente no final da página pública, depois do agendamento.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="public-address">Endereço completo</Label>
              <Input
                id="public-address"
                name="addressLine"
                defaultValue={company.address_line ?? ""}
                placeholder="Rua, número e bairro"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="public-city">Cidade</Label>
              <Input id="public-city" name="city" defaultValue={company.city ?? ""} />
            </div>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <div className="grid gap-2">
                <Label htmlFor="public-postal-code">CEP</Label>
                <Input
                  id="public-postal-code"
                  name="postalCode"
                  inputMode="numeric"
                  defaultValue={company.postal_code ?? ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="public-state">UF</Label>
                <Input
                  id="public-state"
                  name="state"
                  maxLength={2}
                  defaultValue={company.state ?? ""}
                />
              </div>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="public-map-url">Link do Google Maps (opcional)</Label>
              <Input
                id="public-map-url"
                name="mapUrl"
                type="url"
                defaultValue={company.map_url ?? ""}
                placeholder="https://maps.google.com/..."
              />
              <p className="text-xs text-muted-foreground">
                Se não informar o link, o mapa será localizado pelo endereço cadastrado.
              </p>
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-xl bg-muted/40 p-4">
            <input
              name="showPublicLocation"
              type="checkbox"
              defaultChecked={company.show_public_location}
              className="mt-1"
            />
            <span>
              <strong className="block text-sm">Exibir localização na página pública</strong>
              <span className="text-sm text-muted-foreground">
                Mostra endereço, mapa e o botão “Como chegar”.
              </span>
            </span>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SimpleColor
            label="Cor principal"
            value={primary}
            onChange={setPrimary}
            presets={["#ec78a8", "#a66ef2", "#1b4d63", "#c9a227"]}
          />
          <SimpleColor
            label="Cor secundária"
            value={secondary}
            onChange={setSecondary}
            presets={["#f5afc8", "#c9b8ff", "#2f2f2f", "#d9b670"]}
          />
          <SimpleColor
            label="Cor do texto"
            value={text}
            onChange={setText}
            presets={["#161616", "#5e5e5e", "#ffffff", "#1b4d63"]}
          />
        </div>
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ background: secondary, color: text }}
        >
          {banner ? (
            <img
              src={banner}
              alt="Prévia do banner"
              className="aspect-square max-h-52 w-full object-cover"
            />
          ) : null}
          <div className="grid gap-3 p-5">
            {logo ? (
              <img
                src={logo}
                alt="Prévia da logo"
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full bg-white/70 font-semibold">
                {company.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <strong>{company.name}</strong>
            <button
              type="button"
              className="min-h-11 rounded-xl px-4 font-semibold"
              style={{ background: primary, color: contrastColor(primary) }}
            >
              Agendar
            </button>
            <p className="text-sm">Exemplo de texto da sua página.</p>
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-xl border p-4">
          <input
            name="pageEnabled"
            type="checkbox"
            defaultChecked={company.public_page_status === "published"}
          />
          <span>
            <strong className="block text-sm">Página pública ativa</strong>
            <span className="text-sm text-muted-foreground">
              Disponibiliza o agendamento para clientes.
            </span>
          </span>
        </label>
      </Card>

      <Card className="grid gap-5 p-5 sm:p-6">
        <h2 className="text-xl">Políticas de Agendamento</h2>
        <label className="flex items-center gap-3">
          <input
            name="cancellationPolicyEnabled"
            type="checkbox"
            defaultChecked={company.cancellation_policy_enabled}
          />{" "}
          Ativar política de cancelamento
        </label>
        <div className="grid gap-2">
          <Label htmlFor="cancellationPolicy">Texto da política</Label>
          <Textarea
            id="cancellationPolicy"
            name="cancellationPolicy"
            defaultValue={company.cancellation_policy ?? ""}
            maxLength={500}
          />
        </div>
        <label className="flex items-center gap-3">
          <input name="depositEnabled" type="checkbox" defaultChecked={company.deposit_enabled} />{" "}
          Cobrar sinal
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
          <h3 className="font-semibold">Meios de pagamento</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["pix", "Pix"],
                ["card", "Cartão"],
                ["local", "Pagamento no local"],
              ] as const
            ).map(([name, label]) => (
              <label key={name} className="flex items-center gap-3 rounded-xl border p-3">
                <input name={name} type="checkbox" defaultChecked={payments[name]} /> {label}
              </label>
            ))}
            <label className="flex items-center gap-3 rounded-xl border p-3">
              <input
                name="mercadoPago"
                type="checkbox"
                defaultChecked={
                  mercadoPago.connected && mercadoPago.webhookConfigured && payments["mercadoPago"]
                }
                disabled={!mercadoPago.connected || !mercadoPago.webhookConfigured}
              />
              Mercado Pago ·{" "}
              {mercadoPago.connected && mercadoPago.webhookConfigured
                ? "pronto"
                : mercadoPago.connected
                  ? "webhook pendente"
                  : "conexão necessária"}
            </label>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            O Mercado Pago só será liberado depois que a aplicação e o webhook forem conectados. O
            Access Token nunca deve ser colado neste formulário.
          </p>
          {!mercadoPago.webhookConfigured ? (
            <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              A chave de assinatura do webhook ainda precisa ser cadastrada no ambiente seguro da
              Vercel antes de liberar pagamentos.
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 text-primary" />
            <div>
              <h3 className="font-semibold">Conexão segura com Mercado Pago</h3>
              <p className="text-sm text-muted-foreground">
                Cada empresa conecta a própria conta. Senhas e tokens nunca aparecem no painel.
              </p>
            </div>
          </div>
          {mercadoPago.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-950">
              <div>
                <strong className="block">Conta conectada</strong>
                <span className="text-sm">Pronta para habilitar testes de pagamento.</span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void action.run(async () => {
                    await disconnect();
                    window.location.reload();
                  }, "Mercado Pago desconectado.")
                }
                disabled={action.pending}
              >
                <Unlink /> Desconectar
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {!mercadoPago.configured ? (
                <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  Falta cadastrar as credenciais da aplicação no servidor antes de conectar a conta.
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-fit"
                disabled={!mercadoPago.configured || action.pending}
                onClick={() =>
                  void action.run(async () => {
                    const result = await connect();
                    window.location.assign(result.url);
                  }, "Abrindo a autorização do Mercado Pago…")
                }
              >
                <Link2 /> Conectar Mercado Pago
              </Button>
            </div>
          )}
        </div>
        <label className="flex items-center gap-3">
          <input
            name="publicStoreEnabled"
            type="checkbox"
            defaultChecked={company.public_store_enabled}
          />{" "}
          Ativar Loja na página pública
        </label>
        <Button type="submit" size="lg" disabled={action.pending} className="w-full sm:w-fit">
          {action.pending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </Card>
    </form>
  );
}

function ImageSetting({
  label,
  help,
  url,
  kind,
  onChange,
  onRemove,
}: {
  label: string;
  help: string;
  url: string;
  kind: "logo" | "banner";
  onChange: (event: ChangeEvent<HTMLInputElement>, kind: "logo" | "banner") => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border p-4">
      <div>
        <strong>{label}</strong>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      {url ? (
        <img
          src={url}
          alt={`Prévia ${label}`}
          className={
            kind === "logo"
              ? "h-28 w-28 rounded-full object-cover"
              : "aspect-square max-h-56 w-full rounded-2xl object-cover"
          }
        />
      ) : null}
      <div className="flex gap-2">
        <label className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold">
          <ImageUp /> {url ? "Substituir" : "Adicionar"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void onChange(event, kind)}
          />
        </label>
        {url ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onRemove}
            aria-label={`Remover ${label}`}
          >
            <Trash2 />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
function SimpleColor({
  label,
  value,
  onChange,
  presets,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets: string[];
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Selecionar ${color}`}
            className={`h-8 w-8 rounded-lg border-2 ${value === color ? "border-primary" : "border-white"}`}
            style={{ background: color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="h-10 w-12"
        />{" "}
        Mais opções
      </label>
      <Input
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        maxLength={7}
      />
    </div>
  );
}
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}
function contrastColor(hex: string) {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? "#161616" : "#ffffff";
}
