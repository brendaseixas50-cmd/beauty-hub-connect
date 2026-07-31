import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Home, Store, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { brl } from "@/data/demo";
import { useDemo } from "@/data/negocio";

export const Route = createFileRoute("/servico/$id")({
  head: () => ({
    meta: [
      { title: "Detalhes do serviço — Lu IA Studio" },
      {
        name: "description",
        content: "Duração, valores, formato de atendimento e fotos do serviço escolhido.",
      },
      { property: "og:title", content: "Detalhes do serviço — Lu IA Studio" },
      {
        property: "og:description",
        content: "Duração, valores e formato de atendimento do serviço escolhido.",
      },
    ],
  }),
  component: DetalheServico,
});

function DetalheServico() {
  const { id } = Route.useParams();
  const { estudio, servicos } = useDemo();
  const servico = servicos.find((s) => s.id === id);

  if (!servico) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-3xl">Serviço não encontrado</h1>
        <p className="mt-2 text-muted-foreground">
          Este serviço não faz parte do catálogo demonstrativo atual.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/">Voltar para a página inicial</Link>
        </Button>
      </div>
    );
  }

  const domicilioLiberado =
    estudio.formatoAtendimento === "domicilio" ||
    (estudio.formatoAtendimento === "ambos" && estudio.domicilioAtivo);
  const aceitaDomicilio = servico.formato !== "espaco" && domicilioLiberado;
  const aceitaLocal = servico.formato !== "domicilio" && estudio.formatoAtendimento !== "domicilio";


  const precoDomicilio = servico.mesmoPreco
    ? servico.precoLocal
    : (servico.precoDomicilio ?? servico.precoLocal);

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {servico.fotos.map((f: string, i: number) => (
            <img
              key={i}
              src={f}
              alt={`${servico.nome} — foto ${i + 1}`}
              width={800}
              height={800}
              className="aspect-[4/3] w-full rounded-2xl object-cover"
            />
          ))}
        </div>

        <p className="mt-7 text-eyebrow">{servico.categoria}</p>
        <h1 className="mt-1 text-4xl">{servico.nome}</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">{servico.descricao}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Card className="gap-1 p-4">
            <p className="text-eyebrow">Duração</p>
            <p className="inline-flex items-center gap-2 text-lg">
              <Clock className="h-4 w-4 text-muted-foreground" /> {servico.duracao}
            </p>
          </Card>
          <Card className="gap-1 p-4">
            <p className="text-eyebrow">Profissional responsável</p>
            <p className="inline-flex items-center gap-2 text-lg">
              <User className="h-4 w-4 text-muted-foreground" /> {servico.responsavel}
            </p>
          </Card>
        </div>

        <h2 className="mt-10 text-2xl">Formatos e valores</h2>
        <div className="mt-3 grid gap-3">
          {aceitaLocal && (
            <Card className="flex flex-row items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <Store className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">No espaço da profissional</p>
                  <p className="text-sm text-muted-foreground">{estudio.nomeLocal}</p>
                </div>
              </div>
              <span className="text-lg font-medium">{brl(servico.precoLocal)}</span>
            </Card>
          )}
          {aceitaDomicilio && (
            <Card className="gap-2 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Em domicílio</p>
                    <p className="text-sm text-muted-foreground">{estudio.regioesDomicilio}</p>
                  </div>
                </div>
                <span className="text-lg font-medium">{brl(precoDomicilio)}</span>
              </div>
              {servico.cobrarTaxa && servico.tipoTaxa === "fixa" && servico.valorTaxa && (
                <Badge variant="secondary" className="w-fit rounded-full font-normal">
                  + taxa de deslocamento de {brl(servico.valorTaxa)}
                </Badge>
              )}
              {servico.cobrarTaxa && servico.tipoTaxa === "combinar" && (
                <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                  O valor da taxa de deslocamento será confirmado após a análise do endereço.
                </p>
              )}
              {!servico.cobrarTaxa && (
                <Badge variant="outline" className="w-fit rounded-full font-normal">
                  Sem taxa de deslocamento
                </Badge>
              )}
            </Card>
          )}
        </div>

        {!servico.disponivel && (
          <p className="mt-6 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            Este serviço está temporariamente indisponível para agendamento online.
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          {servico.disponivel ? (
            <Button asChild className="w-full rounded-full" size="lg">
              <Link to="/agendar" search={{ servico: servico.id }}>
                Agendar este serviço
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="w-full rounded-full" size="lg">
              <a
                href={linkWhatsapp(estudio.whatsapp, estudio.nome)}
                target="_blank"
                rel="noreferrer"
              >
                Entrar na lista de espera pelo WhatsApp
              </a>
            </Button>
          )}
        </div>
      </div>

    </div>
  );
}
