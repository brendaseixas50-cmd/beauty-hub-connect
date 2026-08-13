import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, ExternalLink, ImageUp } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/mvp-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { coresDaEmpresa, corDeContraste, derivarPaleta, textoSeguro } from "@/lib/cores-publicas";
import { formatarTelefone, telefoneInternacional } from "@/lib/telefone";
import { getCompany, updateCompany, uploadPublicMedia } from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";

export const Route = createFileRoute("/painel/empresa")({
  staleTime: 60_000,
  loader: () => getCompany(),
  head: () => ({
    meta: [
      { title: "Empresa e página pública — Lu IA Studio" },
      {
        name: "description",
        content:
          "Atualize os dados do seu estabelecimento, a identidade visual e o link público de agendamento.",
      },
      { property: "og:title", content: "Empresa e página pública" },
      {
        property: "og:description",
        content: "Dados do estabelecimento, logo, banner e cores da página pública.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanyPage,
});

function CompanyPage() {
  const company = Route.useLoaderData();
  const save = useServerFn(updateCompany);
  const upload = useServerFn(uploadPublicMedia);
  const action = useMvpAction();
  const [logoUrl, setLogoUrl] = useState(company.logo_url ?? "");
  const [bannerUrl, setBannerUrl] = useState(company.banner_url ?? "");
  const [uploading, setUploading] = useState<"logo" | "banner">();
  const [copied, setCopied] = useState(false);
  const iniciais = coresDaEmpresa(company);
  const [fundo, setFundo] = useState(iniciais.fundo);
  const [destaque, setDestaque] = useState(iniciais.destaque);
  const [texto, setTexto] = useState(iniciais.texto);
  const [whatsapp, setWhatsapp] = useState(formatarTelefone(company.whatsapp));
  const [telefone, setTelefone] = useState(formatarTelefone(company.phone));
  const [notificacao, setNotificacao] = useState(
    formatarTelefone(company.whatsapp_notification_phone),
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(async () => {
      const result = await save({
        data: {
          name: String(form.get("name")),
          productType: company.product_type === "barber" ? "barber" : "beauty",
          document: String(form.get("document")),
          email: String(form.get("email")),
          phone: telefoneInternacional(telefone),
          whatsapp: telefoneInternacional(whatsapp),
          whatsappInitialMessage: String(form.get("whatsappInitialMessage")),
          whatsappNotificationPhone: telefoneInternacional(notificacao),
          whatsappIntegrationMode: "development",
          metaPhoneNumberId: company.meta_phone_number_id ?? "",
          metaWabaId: company.meta_waba_id ?? "",
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
            photoUrl: "",
            ...derivarPaleta({ fundo, destaque, texto }),
            welcomeMessage: String(form.get("welcomeMessage")),
            cancellationPolicy: String(form.get("cancellationPolicy")),
            publicInformation: String(form.get("publicInformation")),
            status: form.get("publicPageEnabled") === "on" ? "published" : "disabled",
            bookingIntervalMinutes: Number(form.get("bookingIntervalMinutes")) as
              10 | 15 | 20 | 30 | 45 | 60,
          },
        },
      });
      if (result.locationWarning) toast.warning(result.locationWarning);
    }, "Dados da empresa atualizados.");
  }

  async function onMedia(event: ChangeEvent<HTMLInputElement>, kind: "logo" | "banner") {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (
      !(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type) ||
      file.size > 3 * 1024 * 1024
    ) {
      toast.error("Use JPG, PNG ou WebP com no máximo 3 MB.");
      return;
    }
    setUploading(kind);
    try {
      const base64 = await fileToBase64(file);
      const result = await upload({
        data: { kind, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", base64 },
      });
      if (kind === "logo") setLogoUrl(result.url);
      else setBannerUrl(result.url);
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
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Meu estabelecimento"
        title="Empresa"
        description="Dados de contato, endereço e a aparência da sua página pública em um só lugar."
      />

      <form onSubmit={onSubmit} className="mt-8 grid gap-6">
        <Card className="grid gap-5 p-5 sm:p-6">
          <h2 className="text-xl">Dados principais</h2>
          <Field label="Nome da empresa" name="name" defaultValue={company.name} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CPF ou CNPJ" name="document" defaultValue={company.document ?? ""} />
            <Field label="E-mail" name="email" type="email" defaultValue={company.email ?? ""} />
            <PhoneField label="Telefone" id="phone" value={telefone} onValueChange={setTelefone} />
            <PhoneField
              label="WhatsApp"
              id="whatsapp"
              value={whatsapp}
              onValueChange={setWhatsapp}
            />
            <Field label="Instagram" name="instagram" defaultValue={company.instagram ?? ""} />
            <Field label="Facebook" name="facebook" defaultValue={company.facebook ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Sobre o seu espaço</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={company.description ?? ""}
              placeholder="Conte em poucas linhas o que você oferece."
            />
          </div>
        </Card>

        <Card className="grid gap-5 p-5 sm:p-6">
          <h2 className="text-xl">Endereço</h2>
          <Field
            label="Endereço completo"
            name="addressLine"
            defaultValue={company.address_line ?? ""}
            placeholder="Rua, número e bairro"
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Cidade" name="city" defaultValue={company.city ?? ""} />
            <Field label="UF" name="state" maxLength={2} defaultValue={company.state ?? ""} />
            <Field label="CEP" name="postalCode" defaultValue={company.postal_code ?? ""} />
          </div>
          <Field
            label="Link do mapa (opcional)"
            name="mapUrl"
            type="url"
            defaultValue={company.map_url ?? ""}
            placeholder="https://maps.google.com/..."
          />
        </Card>

        <Card className="grid gap-5 p-5 sm:p-6">
          <div>
            <h2 className="text-xl">Página pública</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              É o link que suas clientes usam para agendar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void copyPublicLink()}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Link copiado" : "Copiar link"}
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
          </div>

          <div className="grid gap-4">
            <div>
              <h3 className="font-semibold">Cores da página</h3>
              <p className="text-sm text-muted-foreground">
                Escolha três cores. O sistema ajusta o restante e garante a leitura dos textos.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ColorField label="Fundo" value={fundo} onChange={setFundo} presets={fundos} />
              <ColorField
                label="Destaque"
                value={destaque}
                onChange={setDestaque}
                presets={destaques}
              />
              <ColorField label="Texto" value={texto} onChange={setTexto} presets={textos} />
            </div>
            <ColorPreview
              fundo={fundo}
              destaque={destaque}
              texto={texto}
              name={company.public_name ?? company.name}
              logoUrl={logoUrl}
              bannerUrl={bannerUrl}
            />
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
            <Label htmlFor="publicInformation">Informações adicionais</Label>
            <Textarea
              id="publicInformation"
              name="publicInformation"
              rows={3}
              maxLength={1500}
              defaultValue={company.public_information ?? ""}
            />
          </div>
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="bookingIntervalMinutes">Intervalo entre horários</Label>
            <select
              id="bookingIntervalMinutes"
              name="bookingIntervalMinutes"
              defaultValue={company.booking_interval_minutes}
              className="h-11 rounded-xl border bg-background px-3 text-sm"
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
                Ao ativar, o link fica acessível para suas clientes.
              </span>
            </span>
          </label>
        </Card>

        <Card className="grid gap-5 p-5 sm:p-6">
          <div>
            <h2 className="text-xl">Mensagens e avisos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Defina a mensagem que a cliente envia por WhatsApp e onde você recebe os avisos.
            </p>
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
          </div>
          <div className="sm:max-w-sm">
            <PhoneField
              label="Número que recebe os avisos"
              id="whatsappNotificationPhone"
              value={notificacao}
              onValueChange={setNotificacao}
            />
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

function PhoneField({
  label,
  id,
  value,
  onValueChange,
}: {
  label: string;
  id: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="bg-card flex items-center gap-2 rounded-xl border pl-3 focus-within:ring-2 focus-within:ring-ring">
        <span className="text-muted-foreground text-sm font-medium">+55</span>
        <Input
          id={id}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(11) 91234-5678"
          value={value}
          onChange={(event) => onValueChange(formatarTelefone(event.currentTarget.value))}
          className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>
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
  kind: "logo" | "banner";
  url: string;
  pending: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>, kind: "logo" | "banner") => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${kind}-upload`}>{label}</Label>
      {url ? (
        <span
          className={
            kind === "logo"
              ? "mx-auto grid h-32 w-32 place-items-center overflow-hidden rounded-full border bg-background"
              : "grid h-32 w-full place-items-center overflow-hidden rounded-xl border bg-background"
          }
        >
          <img
            src={url}
            alt={`Prévia de ${label.toLowerCase()}`}
            className={
              kind === "logo" ? "h-full w-full object-contain p-1" : "h-full w-full object-cover"
            }
          />
        </span>
      ) : (
        <div className="grid h-32 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
          Sem imagem
        </div>
      )}
      <label
        htmlFor={`${kind}-upload`}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-medium hover:bg-accent"
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

const fundos = ["#ffffff", "#fdf7f4", "#f6f4f1", "#161616", "#1f2430"];
const destaques = ["#8b5e67", "#d8a7b1", "#b7791f", "#1f6f78", "#c9a227"];
const textos = ["#161616", "#3f3f46", "#5e5e5e", "#ffffff", "#f5f5f5"];

function ColorField({
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
    <div className="grid gap-2 rounded-xl border p-3">
      <Label htmlFor={`cor-${label}`}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={`cor-${label}`}
          type="color"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="h-11 w-14 p-1"
        />
        <Input
          aria-label={`${label} em hexadecimal`}
          value={value}
          maxLength={7}
          onChange={(event) => {
            const next = event.currentTarget.value;
            if (/^#?[0-9a-fA-F]{0,6}$/.test(next))
              onChange(next.startsWith("#") ? next : `#${next}`);
          }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label={`Sugestões para ${label}`}>
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            className="h-7 w-7 rounded-full border shadow-sm"
            style={{ backgroundColor: color }}
            aria-label={`Usar ${color}`}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </div>
  );
}

function ColorPreview({
  fundo,
  destaque,
  texto,
  name,
  logoUrl,
  bannerUrl,
}: {
  fundo: string;
  destaque: string;
  texto: string;
  name: string;
  logoUrl: string;
  bannerUrl: string;
}) {
  const paleta = derivarPaleta({ fundo, destaque, texto });
  const corTexto = textoSeguro(texto, fundo);
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Prévia em tempo real</p>
      <div
        className="overflow-hidden rounded-2xl border"
        style={{ background: paleta.backgroundColor, color: corTexto }}
      >
        {bannerUrl ? (
          <img src={bannerUrl} alt="" className="h-28 w-full object-cover" />
        ) : (
          <div className="h-28 w-full" style={{ background: paleta.secondaryColor }} />
        )}
        <div className="grid gap-3 p-5">
          <span
            className="grid h-14 w-14 place-items-center overflow-hidden rounded-full border"
            style={{ background: paleta.cardColor }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
            ) : (
              <strong className="text-sm" style={{ color: destaque }}>
                {name.slice(0, 2).toUpperCase()}
              </strong>
            )}
          </span>
          <strong className="text-lg">{name}</strong>
          <p className="text-sm opacity-90">
            Exemplo do texto que suas clientes verão na página de agendamento.
          </p>
          <span
            className="inline-flex min-h-11 w-fit items-center rounded-xl px-5 text-sm font-semibold"
            style={{ background: destaque, color: corDeContraste(destaque) }}
          >
            Agendar horário
          </span>
        </div>
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
