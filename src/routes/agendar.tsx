import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Clock, Home, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { brl, type Servico } from "@/data/demo";
import { useDemo } from "@/data/negocio";
import { linkWhatsapp } from "@/lib/contato";

type Busca = { servico?: string | undefined };

export const Route = createFileRoute("/agendar")({
  validateSearch: (search: Record<string, unknown>): Busca => ({
    servico: typeof search["servico"] === "string" ? (search["servico"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Agendar horário — Lu IA Studio" },
      {
        name: "description",
        content:
          "Escolha o serviço, o formato de atendimento, a data e o horário do seu agendamento.",
      },
      { property: "og:title", content: "Agendar horário — Lu IA Studio" },

      { property: "og:description", content: "Agendamento online em poucos passos." },
    ],
  }),
  component: Agendar,
});

const DIAS = ["01/08", "02/08", "03/08", "05/08", "06/08", "07/08"];

function Agendar() {
  const { servico: servicoInicial } = Route.useSearch();
  const { estudio, servicos, horariosDisponiveis, profissionais } = useDemo();
  const disponiveis = servicos.filter((s) => s.disponivel);

  const domicilioLiberado =
    estudio.formatoAtendimento === "domicilio" ||
    (estudio.formatoAtendimento === "ambos" && estudio.domicilioAtivo);
  const somenteDomicilio = estudio.formatoAtendimento === "domicilio";
  const escolheFormato = estudio.formatoAtendimento === "ambos" && estudio.domicilioAtivo;

  const [passo, setPasso] = useState(servicoInicial ? 2 : 1);
  const [servico, setServico] = useState<Servico | null>(
    disponiveis.find((s) => s.id === servicoInicial) ?? null,
  );
  const [formato, setFormato] = useState<"espaco" | "domicilio">(
    somenteDomicilio ? "domicilio" : "espaco",
  );
  const [data, setData] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [profissional, setProfissional] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [whats, setWhats] = useState("");

  const totalPassos = escolheFormato ? 6 : 5;
  const passoVisual = escolheFormato ? passo : passo > 1 ? passo - 1 : passo;

  const emDomicilio = formato === "domicilio" && domicilioLiberado;
  const precoServico =
    servico == null
      ? 0
      : emDomicilio && !servico.mesmoPreco
        ? (servico.precoDomicilio ?? servico.precoLocal)
        : servico.precoLocal;
  const taxaFixa =
    servico && emDomicilio && servico.cobrarTaxa && servico.tipoTaxa === "fixa"
      ? (servico.valorTaxa ?? 0)
      : 0;
  const taxaCombinar = Boolean(
    servico && emDomicilio && servico.cobrarTaxa && servico.tipoTaxa === "combinar",
  );

  const avancar = () => setPasso((p) => Math.min(p + 1, 6));
  const voltar = () => setPasso((p) => Math.max(p - (escolheFormato || p !== 3 ? 1 : 2), 1));

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto max-w-2xl px-5 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para a página
        </Link>

        <div className="mt-6">
          <p className="text-eyebrow">
            Passo {Math.min(passoVisual, totalPassos)} de {totalPassos}
          </p>
          <h1 className="mt-1 text-3xl">Agendar horário</h1>
          <div className="mt-4 flex gap-1.5">
            {Array.from({ length: totalPassos }).map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i < passoVisual ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-8 space-y-3">
          {passo === 1 && (
            <>
              <h2 className="text-2xl">Escolha o serviço</h2>
              {disponiveis.map((s) => (
                <Card
                  key={s.id}
                  onClick={() => {
                    setServico(s);
                    setPasso(escolheFormato && s.formato !== "espaco" ? 2 : 3);
                    if (s.formato === "espaco") setFormato("espaco");
                  }}
                  className={`flex cursor-pointer flex-row items-center justify-between p-4 transition-shadow hover:shadow-md ${
                    servico?.id === s.id ? "ring-2 ring-ring" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-eyebrow">{s.categoria}</p>
                    <p className="truncate font-medium">{s.nome}</p>
                    <p className="text-sm text-muted-foreground">{s.duracao}</p>
                  </div>
                  <span className="shrink-0 font-medium">{brl(s.precoLocal)}</span>
                </Card>
              ))}
            </>
          )}

          {passo === 2 && (
            <>
              <h2 className="text-2xl">Como você deseja ser atendido?</h2>
              <Card
                onClick={() => setFormato("espaco")}
                className={`flex cursor-pointer flex-row items-center gap-3 p-5 ${
                  formato === "espaco" ? "ring-2 ring-ring" : ""
                }`}
              >
                <Store className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">No espaço da profissional</p>
                  <p className="text-sm text-muted-foreground">{estudio.endereco}</p>
                </div>
              </Card>
              <Card
                onClick={() => setFormato("domicilio")}
                className={`flex cursor-pointer flex-row items-center gap-3 p-5 ${
                  formato === "domicilio" ? "ring-2 ring-ring" : ""
                }`}
              >
                <Home className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Em domicílio</p>
                  <p className="text-sm text-muted-foreground">{estudio.regioesDomicilio}</p>
                </div>
              </Card>
              <Button className="w-full rounded-full" onClick={avancar}>
                Continuar
              </Button>
            </>
          )}

          {passo === 3 && (
            <>
              <h2 className="text-2xl">Escolha a data</h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {DIAS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setData(d)}
                    className={`rounded-xl border px-3 py-3 text-sm ${
                      data === d
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <Button className="w-full rounded-full" disabled={!data} onClick={avancar}>
                Continuar
              </Button>
            </>
          )}

          {passo === 4 && (
            <>
              <h2 className="text-2xl">Escolha o horário</h2>
              <div className="grid grid-cols-3 gap-2">
                {horariosDisponiveis.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHora(h)}
                    className={`rounded-xl border px-3 py-3 text-sm ${
                      hora === h
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>

              {profissionais.length > 1 && (
                <div className="mt-2">
                  <p className="text-eyebrow mb-2">Com quem você quer ser atendido?</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setProfissional(null)}
                      className={`rounded-full border px-4 py-1.5 text-sm ${
                        profissional === null
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      Qualquer profissional disponível
                    </button>
                    {profissionais.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setProfissional(p.nome)}
                        className={`rounded-full border px-4 py-1.5 text-sm ${
                          profissional === p.nome
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {p.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button className="w-full rounded-full" disabled={!hora} onClick={avancar}>
                Continuar
              </Button>
            </>
          )}

          {passo === 5 && (
            <>
              <h2 className="text-2xl">Seus dados</h2>
              <Card className="gap-4 p-5">
                <div className="grid gap-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="whats">WhatsApp</Label>
                  <Input
                    id="whats"
                    placeholder="(11) 90000-0000"
                    value={whats}
                    onChange={(e) => setWhats(e.target.value)}
                  />
                </div>
              </Card>

              {emDomicilio && (
                <Card className="gap-4 p-5">
                  <p className="font-medium">Endereço do atendimento</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo id="cep" label="CEP" />
                    <Campo id="rua" label="Rua" />
                    <Campo id="numero" label="Número" />
                    <Campo id="complemento" label="Complemento" />
                    <Campo id="bairro" label="Bairro" />
                    <Campo id="cidade" label="Cidade" />
                  </div>
                  <Campo id="referencia" label="Ponto de referência" />
                </Card>
              )}

              <Button
                className="w-full rounded-full"
                disabled={nome.trim().length < 3 || whats.trim().length < 8}
                onClick={avancar}
              >
                Ver resumo
              </Button>
              {(nome.trim().length < 3 || whats.trim().length < 8) && (
                <p className="text-center text-xs text-muted-foreground">
                  Informe seu nome e WhatsApp para continuar.
                </p>
              )}
            </>
          )}

          {passo === 6 && servico && (
            <>
              <h2 className="text-2xl">Resumo do agendamento</h2>
              <Card className="gap-3 p-5">
                <Linha label="Serviço" valor={servico.nome} />
                <Linha label="Data" valor={data ?? "—"} />
                <Linha label="Horário" valor={hora ?? "—"} />
                <Linha
                  label="Profissional"
                  valor={profissional ?? "Qualquer profissional disponível"}
                />

                <Linha
                  label="Duração"
                  valor={servico.duracao}
                  icone={<Clock className="h-3.5 w-3.5" />}
                />
                <Linha
                  label="Formato"
                  valor={emDomicilio ? "Em domicílio" : "No espaço da profissional"}
                />
                <Linha
                  label="Endereço"
                  valor={emDomicilio ? "Endereço informado pelo cliente" : estudio.endereco}
                />
                <Separator />
                <Linha
                  label={emDomicilio ? "Valor do serviço em domicílio" : "Valor do serviço"}
                  valor={brl(precoServico)}
                />
                {taxaFixa > 0 && <Linha label="Taxa de deslocamento" valor={brl(taxaFixa)} />}
                {taxaCombinar && <Linha label="Taxa de deslocamento" valor="A combinar" />}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {taxaCombinar ? "Valor parcial" : "Valor final"}
                  </span>
                  <span className="text-xl font-medium">{brl(precoServico + taxaFixa)}</span>
                </div>
                {taxaCombinar && (
                  <p className="rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">
                    Seu agendamento será enviado para análise. A profissional confirmará a
                    disponibilidade e o valor do deslocamento após verificar o endereço.
                  </p>
                )}
              </Card>

              <Button className="w-full rounded-full" size="lg" onClick={() => setPasso(7)}>
                <Check className="h-4 w-4" /> Confirmar agendamento
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Demonstração visual — nenhum agendamento é realmente enviado nesta etapa.
              </p>
            </>
          )}

          {passo === 7 && servico && (
            <Card className="items-center gap-3 p-8 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-6 w-6" />
              </div>
              <h2 className="text-2xl">
                {taxaCombinar ? "Solicitação enviada!" : "Agendamento confirmado!"}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {nome.split(" ")[0]}, seu horário para <strong>{servico.nome}</strong> em {data} às{" "}
                {hora}
                {profissional ? ` com ${profissional}` : ""} foi registrado.
                {taxaCombinar
                  ? " Você receberá a confirmação do valor de deslocamento no WhatsApp."
                  : " Enviaremos a confirmação e lembretes no seu WhatsApp."}
              </p>
              <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline" className="flex-1 rounded-full">
                  <a
                    href={linkWhatsapp(estudio.whatsapp, estudio.nome)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Falar no WhatsApp
                  </a>
                </Button>
                <Button asChild className="flex-1 rounded-full">
                  <Link to="/">Voltar para a página</Link>
                </Button>
              </div>
            </Card>
          )}

          {passo > 1 && passo < 7 && (
            <Button variant="ghost" className="w-full" onClick={voltar}>
              Voltar
            </Button>
          )}
        </div>

        {servico && passo > 1 && passo < 6 && (
          <Badge variant="secondary" className="mt-6 rounded-full px-3 py-1.5 font-normal">
            {servico.nome} · {servico.duracao}
          </Badge>
        )}
      </div>
    </div>
  );
}

function Campo({ id, label }: { id: string; label: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} />
    </div>
  );
}

function Linha({ label, valor, icone }: { label: string; valor: string; icone?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1.5 text-right font-medium">
        {icone}
        {valor}
      </span>
    </div>
  );
}
