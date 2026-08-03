import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, MessageCircle, Plus, Save } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { EmptyState, PageHeader } from "@/components/mvp-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MarketingClient } from "@/modules/mvp/domain";
import {
  getMarketing,
  saveMarketingAction,
  saveMarketingCampaign,
  saveMarketingTemplate,
} from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";

export const Route = createFileRoute("/painel/marketing")({
  loader: () => getMarketing(),
  head: () => ({ meta: [{ title: "Marketing — Lu IA Studio" }] }),
  component: MarketingPage,
});

const types = [
  ["post_service", "Pós-atendimento"],
  ["birthday", "Aniversário"],
  ["promotion", "Promoção ou campanha"],
  ["win_back", "Cliente ausente / saudade"],
  ["return_reminder", "Lembrete de retorno"],
  ["custom", "Mensagem personalizada"],
] as const;
type CampaignType = (typeof types)[number][0];

const defaults: Record<CampaignType, string> = {
  post_service:
    "Olá, {nome_cliente}! Foi um prazer receber você hoje na {nome_empresa}. Esperamos que tenha amado o resultado.",
  birthday:
    "Feliz aniversário, {nome_cliente}! A equipe da {nome_empresa} deseja um dia maravilhoso para você.",
  promotion:
    "Olá, {nome_cliente}! Temos novidades na {nome_empresa}. Conheça nossa campanha e agende pelo link {link_publico}.",
  win_back:
    "Olá, {nome_cliente}! Sentimos sua falta na {nome_empresa}. Já faz {dias_desde_ultimo_atendimento} dias desde sua última visita.",
  return_reminder:
    "Olá, {nome_cliente}! Está na hora de cuidar de você novamente. Agende seu retorno na {nome_empresa}: {link_publico}.",
  custom: "Olá, {nome_cliente}!",
};

function MarketingPage() {
  const data = Route.useLoaderData();
  const saveAction = useServerFn(saveMarketingAction);
  const saveTemplate = useServerFn(saveMarketingTemplate);
  const saveCampaign = useServerFn(saveMarketingCampaign);
  const action = useMvpAction();
  const [birthday, setBirthday] = useState("all");
  const [absence, setAbsence] = useState("0");
  const [service, setService] = useState("all");
  const [professional, setProfessional] = useState("all");
  const [onlyWhatsapp, setOnlyWhatsapp] = useState(true);
  const [onlyConsent, setOnlyConsent] = useState(true);
  const [selected, setSelected] = useState<string>();
  const [campaignType, setCampaignType] = useState<CampaignType>("custom");
  const [message, setMessage] = useState(defaults.custom);
  const [templateId, setTemplateId] = useState<string>();
  const [templateName, setTemplateName] = useState("");
  const [campaignId, setCampaignId] = useState<string>();
  const [campaignName, setCampaignName] = useState("");

  const services = [
    ...new Set(data.clients.map((item) => item.lastServiceName).filter(Boolean)),
  ] as string[];
  const professionals = [
    ...new Set(data.clients.map((item) => item.lastProfessionalName).filter(Boolean)),
  ] as string[];
  const filtered = useMemo(
    () =>
      data.clients.filter((client) => {
        if (onlyWhatsapp && !client.phone_normalized) return false;
        if (onlyConsent && !client.contact_allowed) return false;
        if (service !== "all" && client.lastServiceName !== service) return false;
        if (professional !== "all" && client.lastProfessionalName !== professional) return false;
        if (Number(absence) && daysSince(client.lastAppointmentAt) < Number(absence)) return false;
        return matchesBirthday(client.birth_date, birthday);
      }),
    [data.clients, onlyWhatsapp, onlyConsent, service, professional, absence, birthday],
  );

  const client = filtered.find((item) => item.id === selected) ?? filtered[0];
  const rendered = client
    ? renderMessage(message, client, data.company.name, data.company.slug)
    : message;

  async function openWhatsapp() {
    if (!client?.phone_normalized || !client.contact_allowed) return;
    const popup = window.open("about:blank", "_blank");
    const ok = await action.run(
      () =>
        saveAction({
          data: {
            campaignId: campaignId ?? null,
            clientId: client.id,
            message: rendered,
            status: "initiated",
          },
        }),
      "Ação registrada. Finalize o envio no WhatsApp.",
    );
    if (ok) {
      const phone = client.phone_normalized.startsWith("55")
        ? client.phone_normalized
        : `55${client.phone_normalized}`;
      if (popup)
        popup.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(rendered)}`;
      else
        window.open(
          `https://wa.me/${phone}?text=${encodeURIComponent(rendered)}`,
          "_blank",
          "noopener,noreferrer",
        );
    } else popup?.close();
  }

  async function submitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(
      () =>
        saveTemplate({
          data: {
            id: templateId,
            name: String(form.get("name")),
            campaignType,
            body: message,
            active: true,
          },
        }),
      templateId ? "Modelo atualizado." : "Modelo salvo.",
    );
  }

  async function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(
      () =>
        saveCampaign({
          data: {
            id: campaignId,
            name: String(form.get("campaignName")),
            campaignType,
            message,
            status: "active",
            templateId: templateId ?? null,
          },
        }),
      campaignId ? "Campanha atualizada." : "Campanha criada.",
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Relacionamento"
        title="Marketing"
        description="Campanhas assistidas e seguras: o WhatsApp abre uma conversa por vez e você confirma o envio."
      />

      <Card className="mt-8 grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Público</h2>
          <Badge variant="secondary">{filtered.length} cliente(s)</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Filter
            label="Aniversário"
            value={birthday}
            onChange={setBirthday}
            options={[
              ["all", "Qualquer data"],
              ["today", "Hoje"],
              ["week", "Esta semana"],
              ["month", "Este mês"],
            ]}
          />
          <Filter
            label="Sem retorno"
            value={absence}
            onChange={setAbsence}
            options={[
              ["0", "Qualquer período"],
              ["30", "30+ dias"],
              ["60", "60+ dias"],
              ["90", "90+ dias"],
            ]}
          />
          <Filter
            label="Último serviço"
            value={service}
            onChange={setService}
            options={[["all", "Todos"], ...services.map((v) => [v, v])]}
          />
          <Filter
            label="Profissional"
            value={professional}
            onChange={setProfessional}
            options={[["all", "Todos"], ...professionals.map((v) => [v, v])]}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={onlyWhatsapp}
              onChange={(e) => setOnlyWhatsapp(e.target.checked)}
            />{" "}
            Com WhatsApp
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={onlyConsent}
              onChange={(e) => setOnlyConsent(e.target.checked)}
            />{" "}
            Aceitou contato
          </label>
          <span className="text-muted-foreground">
            Produto: {data.company.product_type === "barber" ? "LuBarber" : "LuBeauty"}
          </span>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="max-h-[38rem] overflow-y-auto p-3">
          {filtered.length ? (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={`w-full rounded-lg p-3 text-left text-sm ${client?.id === item.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <strong className="block">{item.name}</strong>
                <span className="opacity-80">{item.phone || "Sem WhatsApp"}</span>
              </button>
            ))
          ) : (
            <EmptyState
              title="Nenhum cliente"
              description="Altere os filtros ou registre o consentimento no cadastro do cliente."
            />
          )}
        </Card>

        <div className="grid gap-6">
          <Card className="grid gap-4 p-5">
            <h2 className="text-xl">Preparar mensagem</h2>
            <Filter
              label="Tipo"
              value={campaignType}
              onChange={(value) => {
                const next = value as CampaignType;
                setCampaignType(next);
                setMessage(defaults[next]);
              }}
              options={types.map(([v, l]) => [v, l])}
            />
            <Filter
              label="Modelo reutilizável"
              value={templateId ?? ""}
              onChange={(value) => {
                setTemplateId(value || undefined);
                const template = data.templates.find((item) => item.id === value);
                if (!template) {
                  setTemplateName("");
                  return;
                }
                setTemplateName(template.name);
                setCampaignType(template.campaign_type as CampaignType);
                setMessage(template.body);
              }}
              options={[["", "Novo modelo"], ...data.templates.map((item) => [item.id, item.name])]}
            />
            <Filter
              label="Campanha (opcional)"
              value={campaignId ?? ""}
              onChange={(value) => {
                setCampaignId(value || undefined);
                const campaign = data.campaigns.find((item) => item.id === value);
                if (!campaign) {
                  setCampaignName("");
                  return;
                }
                setCampaignName(campaign.name);
                setCampaignType(campaign.campaign_type as CampaignType);
                setMessage(campaign.message);
                setTemplateId(campaign.template_id ?? undefined);
              }}
              options={[["", "Nova / sem campanha"], ...data.campaigns.map((c) => [c.id, c.name])]}
            />
            <div className="grid gap-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                rows={6}
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Variáveis:{" "}
              {
                "{nome_cliente}, {nome_empresa}, {nome_profissional}, {servico_realizado}, {data_atendimento}, {dias_desde_ultimo_atendimento}, {link_publico}"
              }
            </p>
            <div className="rounded-xl bg-muted p-4 text-sm whitespace-pre-line">
              <strong className="mb-2 block">Prévia</strong>
              {rendered}
            </div>
            <Button
              disabled={!client?.phone_normalized || !client?.contact_allowed || action.pending}
              onClick={() => void openWhatsapp()}
            >
              <MessageCircle className="h-4 w-4" /> Enviar pelo WhatsApp
            </Button>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <form onSubmit={submitTemplate}>
              <Card className="grid h-full gap-3 p-5">
                <h3 className="text-lg">Salvar como modelo</h3>
                <Input
                  name="name"
                  placeholder="Nome do modelo"
                  required
                  minLength={2}
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                />
                <Button variant="outline">
                  <Save className="h-4 w-4" /> {templateId ? "Atualizar modelo" : "Salvar modelo"}
                </Button>
              </Card>
            </form>
            <form onSubmit={submitCampaign}>
              <Card className="grid h-full gap-3 p-5">
                <h3 className="text-lg">{campaignId ? "Editar campanha" : "Criar campanha"}</h3>
                <Input
                  name="campaignName"
                  placeholder="Nome da campanha"
                  required
                  minLength={2}
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                />
                <Button variant="outline">
                  <Plus className="h-4 w-4" />{" "}
                  {campaignId ? "Atualizar campanha" : "Criar campanha"}
                </Button>
              </Card>
            </form>
          </div>
        </div>
      </div>

      <Card className="mt-6 grid gap-3 p-5">
        <h2 className="text-xl">Histórico e fila</h2>
        {data.actions.length ? (
          data.actions.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm"
            >
              <span>
                {item.clients?.name ?? "Cliente"} · {item.status}
              </span>
              <div className="flex gap-2">
                {(["sent", "responded", "converted"] as const).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void action.run(
                        () =>
                          saveAction({
                            data: {
                              id: item.id,
                              clientId: item.client_id,
                              campaignId: item.campaign_id,
                              message: item.message_snapshot,
                              status,
                            },
                          }),
                        "Status atualizado.",
                      )
                    }
                  >
                    {status === "sent"
                      ? "Enviada"
                      : status === "responded"
                        ? "Respondida"
                        : "Convertida"}
                  </Button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma ação iniciada.</p>
        )}
      </Card>

      <Card className="mt-6 bg-secondary/40 p-5 text-sm text-muted-foreground">
        <ExternalLink className="mb-2 h-4 w-4" />
        <strong className="text-foreground">Envio automático não está ativo.</strong> Disparos em
        massa dependerão da WhatsApp Business Platform/API oficial, provedor autorizado, templates
        aprovados, consentimento e custos/regras do serviço.
      </Card>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly string[])[];
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-md border bg-background px-3"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
function daysSince(value: string | null) {
  return value
    ? Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
    : Number.POSITIVE_INFINITY;
}
function matchesBirthday(value: string | null, filter: string) {
  if (filter === "all") return true;
  if (!value) return false;
  const now = new Date();
  const date = new Date(`${value}T12:00:00`);
  const birthday = new Date(now.getFullYear(), date.getMonth(), date.getDate());
  const delta = Math.floor(
    (birthday.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  if (filter === "today") return delta === 0;
  if (filter === "week") return delta >= 0 && delta <= 7;
  return date.getMonth() === now.getMonth();
}
function renderMessage(template: string, client: MarketingClient, company: string, slug: string) {
  const vars: Record<string, string> = {
    nome_cliente: client.name,
    nome_empresa: company,
    nome_profissional: client.lastProfessionalName ?? "nossa equipe",
    servico_realizado: client.lastServiceName ?? "seu atendimento",
    data_atendimento: client.lastAppointmentAt
      ? new Date(client.lastAppointmentAt).toLocaleDateString("pt-BR")
      : "",
    dias_desde_ultimo_atendimento: Number.isFinite(daysSince(client.lastAppointmentAt))
      ? String(daysSince(client.lastAppointmentAt))
      : "",
    link_publico:
      typeof window === "undefined" ? `/p/${slug}` : `${window.location.origin}/p/${slug}`,
  };
  return template.replace(/\{([a-z_]+)\}/g, (match, key: string) => vars[key] ?? match);
}
