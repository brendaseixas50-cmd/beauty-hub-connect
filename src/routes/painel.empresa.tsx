import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, ExternalLink, ImageUp } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";

import { PageHeader } from "@/components/mvp-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCompany, updateCompany, uploadPublicMedia } from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";

export const Route = createFileRoute("/painel/empresa")({
  loader: () => getCompany(),
  head: () => ({ meta: [{ title: "Empresa — Beauty Hub Connect" }] }),
  component: CompanyPage,
});

function CompanyPage() {
  const company = Route.useLoaderData();
  const save = useServerFn(updateCompany);
  const upload = useServerFn(uploadPublicMedia);
  const action = useMvpAction();
  const [logoUrl, setLogoUrl] = useState(company.logo_url ?? "");
  const [bannerUrl, setBannerUrl] = useState(company.banner_url ?? "");
  const [photoUrl, setPhotoUrl] = useState(company.photo_url ?? "");
  const [uploading, setUploading] = useState<"logo" | "banner" | "photo">();
  const [copied, setCopied] = useState(false);

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
            whatsappInitialMessage: String(form.get("whatsappInitialMessage")),
            whatsappNotificationPhone: String(form.get("whatsappNotificationPhone")),
            whatsappIntegrationMode: "development",
            metaPhoneNumberId: String(form.get("metaPhoneNumberId")),
            metaWabaId: String(form.get("metaWabaId")),
            instagram: String(form.get("instagram")),
            facebook: String(form.get("facebook")),
            description: String(form.get("description")),
            addressLine: String(form.get("addressLine")),
            city: String(form.get("city")),
            state: String(form.get("state")),
            postalCode: String(form.get("postalCode")),
            mapUrl: String(form.get("mapUrl")),
            businessHours: (company.business_hours ?? {}) as Record<string, string>,
            publicPage: {
              publicName: String(form.get("publicName")),
              logoUrl,
              bannerUrl,
              photoUrl,
              primaryColor: String(form.get("primaryColor")),
              secondaryColor: String(form.get("secondaryColor")),
              accentColor: String(form.get("accentColor")),
              buttonColor: String(form.get("buttonColor")),
              cardColor: String(form.get("cardColor")),
              menuColor: String(form.get("menuColor")),
              backgroundColor: String(form.get("backgroundColor")),
              titleColor: String(form.get("titleColor")),
              textColor: String(form.get("textColor")),
              welcomeMessage: String(form.get("welcomeMessage")),
              cancellationPolicy: String(form.get("cancellationPolicy")),
              publicInformation: String(form.get("publicInformation")),
              status: form.get("publicPageEnabled") === "on" ? "published" : "disabled",
              bookingIntervalMinutes: Number(form.get("bookingIntervalMinutes")) as
                10 | 15 | 20 | 30 | 45 | 60,
            },
          },
        }),
      "Dados da empresa atualizados.",
    );
  }

  async function onMedia(event: ChangeEvent<HTMLInputElement>, kind: "logo" | "banner" | "photo") {
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
    setUploading(kind);
    try {
      const base64 = await fileToBase64(file);
      const result = await upload({
        data: { kind, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", base64 },
      });
      if (kind === "logo") setLogoUrl(result.url);
      else if (kind === "banner") setBannerUrl(result.url);
      else setPhotoUrl(result.url);
    } finally {
      setUploading(undefined);
    }
  }

  async function copyPublicLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/p/${company.slug}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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
            <Field label="Facebook" name="facebook" defaultValue={company.facebook ?? ""} />
            <Field label="Identificador público" name="slug" defaultValue={company.slug} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="whatsappInitialMessage">Mensagem inicial do WhatsApp</Label>
            <Textarea
              id="whatsappInitialMessage"
              name="whatsappInitialMessage"
              rows={3}
              maxLength={500}
              defaultValue={
                company.whatsapp_initial_message ??
                "Olá! Encontrei seu espaço pela página de agendamento e gostaria de mais informações."
              }
            />
            <p className="text-xs text-muted-foreground">
              O cliente revisará a mensagem no WhatsApp antes de enviar.
            </p>
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
          <div>
            <h2 className="text-xl">Página pública</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Personalize o link que clientes usam para conhecer seus serviços e solicitar horários.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void copyPublicLink()}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Link copiado" : "Copiar link público"}
            </Button>
            <Button asChild type="button" variant="outline">
              <a href={`/p/${company.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Abrir página
              </a>
            </Button>
          </div>

          <Field
            label="Nome exibido ao público"
            name="publicName"
            defaultValue={company.public_name ?? company.name}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <MediaField
              label="Logo"
              kind="logo"
              url={logoUrl}
              pending={uploading === "logo"}
              onChange={onMedia}
            />
            <MediaField
              label="Banner"
              kind="banner"
              url={bannerUrl}
              pending={uploading === "banner"}
              onChange={onMedia}
            />
            <MediaField
              label="Foto principal"
              kind="photo"
              url={photoUrl}
              pending={uploading === "photo"}
              onChange={onMedia}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ColorField
              label="Cor principal"
              name="primaryColor"
              defaultValue={company.primary_color}
            />
            <ColorField
              label="Cor secundária"
              name="secondaryColor"
              defaultValue={company.secondary_color}
            />
            <ColorField
              label="Cor de destaque"
              name="accentColor"
              defaultValue={company.accent_color}
            />
            <ColorField
              label="Cor dos botões"
              name="buttonColor"
              defaultValue={company.button_color}
            />
            <ColorField label="Cor dos cards" name="cardColor" defaultValue={company.card_color} />
            <ColorField label="Cor do menu" name="menuColor" defaultValue={company.menu_color} />
            <ColorField
              label="Cor do fundo"
              name="backgroundColor"
              defaultValue={company.background_color}
            />
            <ColorField
              label="Cor dos títulos"
              name="titleColor"
              defaultValue={company.title_color}
            />
            <ColorField label="Cor dos textos" name="textColor" defaultValue={company.text_color} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="welcomeMessage">Mensagem de boas-vindas</Label>
            <Textarea
              id="welcomeMessage"
              name="welcomeMessage"
              rows={3}
              defaultValue={company.welcome_message ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cancellationPolicy">Política de cancelamento</Label>
            <Textarea
              id="cancellationPolicy"
              name="cancellationPolicy"
              rows={3}
              defaultValue={company.cancellation_policy ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="publicInformation">Informações públicas</Label>
            <Textarea
              id="publicInformation"
              name="publicInformation"
              rows={4}
              maxLength={1500}
              defaultValue={company.public_information ?? ""}
            />
          </div>
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="bookingIntervalMinutes">Intervalo entre opções de horário</Label>
            <select
              id="bookingIntervalMinutes"
              name="bookingIntervalMinutes"
              defaultValue={company.booking_interval_minutes}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              {[10, 15, 20, 30, 45, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutos
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-3 rounded-xl border p-4">
            <input
              name="publicPageEnabled"
              type="checkbox"
              className="mt-1 h-4 w-4"
              defaultChecked={company.public_page_status === "published"}
            />
            <span>
              <strong className="block text-sm">Página pública ativa</strong>
              <span className="text-sm text-muted-foreground">
                Ao ativar, o link ficará acessível sem login. Mantenha desativado enquanto configura
                serviços e horários.
              </span>
            </span>
          </label>
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
          <Field
            label="Link do mapa"
            name="mapUrl"
            type="url"
            defaultValue={company.map_url ?? ""}
            placeholder="https://maps.google.com/..."
          />
        </Card>

        <Card className="grid gap-5 p-6">
          <div>
            <h2 className="text-xl">Notificações de novos agendamentos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O modo de desenvolvimento registra a mensagem prevista sem chamar o WhatsApp.
            </p>
          </div>
          <Field
            label="Número que receberá as notificações"
            name="whatsappNotificationPhone"
            inputMode="tel"
            defaultValue={company.whatsapp_notification_phone ?? ""}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Meta Phone Number ID"
              name="metaPhoneNumberId"
              defaultValue={company.meta_phone_number_id ?? ""}
              placeholder="Será informado futuramente"
            />
            <Field
              label="Meta Business Account ID"
              name="metaWabaId"
              defaultValue={company.meta_waba_id ?? ""}
              placeholder="Será informado futuramente"
            />
          </div>
          <p className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
            Tokens não são salvos aqui. A integração futura utilizará segredos protegidos no
            servidor: <strong>{company.meta_access_token_secret_name}</strong> e{" "}
            <strong>{company.meta_webhook_verify_secret_name}</strong>.
          </p>
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

function MediaField({
  label,
  kind,
  url,
  pending,
  onChange,
}: {
  label: string;
  kind: "logo" | "banner" | "photo";
  url: string;
  pending: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>, kind: "logo" | "banner" | "photo") => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${kind}-upload`}>{label}</Label>
      {url ? (
        <img
          src={url}
          alt={`Prévia de ${label.toLowerCase()}`}
          className={`w-full rounded-xl border object-cover ${kind === "logo" ? "h-32" : "h-32"}`}
        />
      ) : (
        <div className="grid h-32 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
          Sem imagem
        </div>
      )}
      <label
        htmlFor={`${kind}-upload`}
        className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
      >
        <ImageUp className="h-4 w-4" /> {pending ? "Enviando…" : `Enviar ${label.toLowerCase()}`}
      </label>
      <input
        id={`${kind}-upload`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={pending}
        onChange={(event) => void onChange(event, kind)}
      />
      <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 3 MB.</p>
    </div>
  );
}

const palette = [
  "#8b5e67",
  "#d8a7b1",
  "#b7791f",
  "#1f6f78",
  "#2563eb",
  "#7c3aed",
  "#111827",
  "#ffffff",
];

function ColorField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="grid gap-2 rounded-xl border p-3">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={name}
          name={name}
          type="color"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          className="h-10 w-14 p-1"
        />
        <Input
          aria-label={`${label} em hexadecimal`}
          value={value}
          onChange={(event) => {
            const next = event.currentTarget.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(next)) setValue(next);
          }}
          maxLength={7}
        />
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label={`Paleta para ${label}`}>
        {palette.map((color) => (
          <button
            key={color}
            type="button"
            className="h-7 w-7 rounded-full border shadow-sm"
            style={{ backgroundColor: color }}
            aria-label={`Usar ${color}`}
            onClick={() => setValue(color)}
          />
        ))}
      </div>
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
