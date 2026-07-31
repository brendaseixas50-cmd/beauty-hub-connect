import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Home, Store } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { type FormatoAtendimento } from "@/data/demo";
import { useDemo } from "@/data/negocio";


export const Route = createFileRoute("/painel/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações da página pública — Lu IA Studio" },
      {
        name: "description",
        content: "Personalize logo, cores, políticas, horários e formatos de atendimento.",
      },
      { property: "og:title", content: "Configurações da página pública — Lu IA Studio" },
      { property: "og:description", content: "Personalize a sua página pública." },
    ],
  }),
  component: Configuracoes,
});

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

function Configuracoes() {
  const { estudio } = useDemo();
  const [formato, setFormato] = useState<FormatoAtendimento>(estudio.formatoAtendimento);

  const [domicilioAtivo, setDomicilioAtivo] = useState(estudio.domicilioAtivo);
  const [dias, setDias] = useState<string[]>(estudio.diasDomicilio);

  const toggleDia = (d: string) =>
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <div className="max-w-3xl">
      <p className="text-eyebrow">Sua marca</p>
      <h1 className="mt-1 text-3xl">Configurações da página pública</h1>

      <Bloco titulo="Identidade">
        <div className="flex flex-wrap items-center gap-4">
          <img
            src={estudio.fotoPerfil}
            alt="Logo atual"
            loading="lazy"
            width={800}
            height={800}
            className="h-16 w-16 rounded-full object-cover"
          />
          <Button variant="outline" size="sm" className="rounded-full">
            Alterar logo
          </Button>
        </div>
        <Campo label="Nome do espaço" valor={estudio.nome} />
        <Campo label="Nome da profissional" valor={estudio.profissional} />
        <div className="grid gap-2">
          <Label>Descrição</Label>
          <Textarea rows={4} defaultValue={estudio.descricao} />
        </div>
        <div className="grid gap-2">
          <Label>Cores da página</Label>
          <div className="flex gap-2">
            {["bg-primary", "bg-accent", "bg-gold", "bg-secondary"].map((c) => (
              <span key={c} className={`h-9 w-9 rounded-full border ${c}`} />
            ))}
            <Button variant="outline" size="sm" className="rounded-full">
              Personalizar
            </Button>
          </div>
        </div>
      </Bloco>

      <Bloco titulo="Banner">
        <img
          src={estudio.banner}
          alt="Banner atual"
          loading="lazy"
          width={1600}
          height={900}
          className="h-36 w-full rounded-xl object-cover"
        />
        <Button variant="outline" size="sm" className="w-fit rounded-full">
          Trocar banner
        </Button>
      </Bloco>

      <Bloco titulo="Contato e localização">
        <Campo label="Endereço" valor={estudio.endereco} />
        <Campo label="Região atendida" valor={estudio.regiao} />
        <Campo label="WhatsApp" valor={estudio.whatsapp} />
        <Campo label="Instagram" valor={estudio.instagram} />
      </Bloco>

      <Bloco titulo="Formato de atendimento">
        <div className="grid gap-2">
          {(
            [
              { id: "espaco", label: "Somente no meu espaço", icon: Store },
              { id: "domicilio", label: "Somente em domicílio", icon: Home },
              { id: "ambos", label: "Atendimento no meu espaço e em domicílio", icon: Store },
            ] as const
          ).map((op) => (
            <button
              key={op.id}
              onClick={() => setFormato(op.id)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left text-sm ${
                formato === op.id ? "border-primary bg-secondary" : "border-border"
              }`}
            >
              <op.icon className="h-4 w-4 text-muted-foreground" />
              {op.label}
            </button>
          ))}
        </div>

        {formato === "ambos" && (
          <label className="flex items-center justify-between rounded-xl border p-4">
            <span className="min-w-0 pr-4 text-sm">
              Exibir a opção de atendimento em domicílio na página pública
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Quando desativado, a cliente vê apenas o atendimento no espaço.
              </span>
            </span>
            <Switch checked={domicilioAtivo} onCheckedChange={setDomicilioAtivo} />
          </label>
        )}

        <Separator />

        <Campo label="Nome ou identificação do local de atendimento" valor={estudio.nomeLocal} />
        <Campo label="Endereço ou região do espaço" valor={estudio.endereco} />

        {(formato === "domicilio" || (formato === "ambos" && domicilioAtivo)) && (
          <>
            <div className="grid gap-2">
              <Label>Cidades, bairros ou regiões atendidas em domicílio</Label>
              <Textarea rows={2} defaultValue={estudio.regioesDomicilio} />
            </div>
            <div className="grid gap-2">
              <Label>Observações sobre atendimento externo</Label>
              <Textarea rows={3} defaultValue={estudio.observacoesDomicilio} />
            </div>
            <div className="grid gap-2">
              <Label>Dias disponíveis para atendimento em domicílio</Label>
              <div className="flex flex-wrap gap-2">
                {DIAS.map((d) => (
                  <button key={d} onClick={() => toggleDia(d)}>
                    <Badge
                      variant={dias.includes(d) ? "default" : "outline"}
                      className="rounded-full px-3 py-1.5 font-normal"
                    >
                      {d}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </Bloco>

      <Bloco titulo="Horários de funcionamento">
        {estudio.horarios.map((h) => (
          <div key={h.dia} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <Label className="min-w-0">{h.dia}</Label>
            <Input defaultValue={h.horario} className="w-36 shrink-0" />
          </div>
        ))}
      </Bloco>

      <Bloco titulo="Políticas">
        {estudio.politicas.map((p) => (
          <div key={p.titulo} className="grid gap-2">
            <Label>{p.titulo}</Label>
            <Textarea rows={3} defaultValue={p.texto} />
          </div>
        ))}
      </Bloco>

      <div className="sticky bottom-4 mt-8">
        <Button className="w-full rounded-full" size="lg">
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card className="mt-6 gap-4 p-6">
      <h2 className="text-2xl">{titulo}</h2>
      {children}
    </Card>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input defaultValue={valor} />
    </div>
  );
}
