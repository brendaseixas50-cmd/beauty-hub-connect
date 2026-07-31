import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Scissors, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNegocio, type TipoNegocio } from "@/data/negocio";
import { areasBeleza } from "@/data/demo";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — escolha o tipo do seu negócio | Lu IA Studio" },
      {
        name: "description",
        content:
          "Primeiro passo do cadastro: escolha entre Beleza ou Barbearia e receba um painel e uma página pública já no estilo do seu negócio.",
      },
      { property: "og:title", content: "Escolha o tipo do seu negócio — Lu IA Studio" },
      {
        property: "og:description",
        content: "Duas experiências completas: Beleza e Barbearia.",
      },
    ],
  }),
  component: Cadastro,
});

function Cadastro() {
  const { tipo, area, concluido, definirTipo, definirArea, concluir } = useNegocio();
  const navigate = useNavigate();

  const escolhido = concluido || area !== null;

  const finalizar = () => {
    concluir();
    void navigate({ to: "/painel" });
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <p className="text-eyebrow">Lu IA Studio · cadastro</p>
      <h1 className="mt-2 text-4xl">Qual é o tipo do seu negócio?</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        Esta escolha é obrigatória e define todo o visual do painel, os exemplos de serviços e o
        modelo da sua página pública.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Opcao
          id="beleza"
          ativo={tipo === "beleza"}
          onClick={() => definirTipo("beleza")}
          icone={Sparkles}
          titulo="Beleza"
          texto="Painel claro, elegante e acolhedor. Para unhas, cabelos, cílios, estética, massoterapia, depilação e maquiagem."
          exemplo="Tons claros, rosé e bege"
        />
        <Opcao
          id="barbearia"
          ativo={tipo === "barbearia"}
          onClick={() => definirTipo("barbearia")}
          icone={Scissors}
          titulo="Barbearia"
          texto="Painel escuro, forte e profissional. Vários barbeiros, fila de atendimento, combos e assinaturas."
          exemplo="Preto, grafite, madeira e cobre"
        />
      </div>

      {tipo === "beleza" && (
        <section className="mt-12">
          <p className="text-eyebrow">Etapa 2</p>
          <h2 className="mt-1 text-3xl">Qual é a sua principal área de atuação?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Isso muda apenas os exemplos de serviços e textos demonstrativos — o tema de beleza
            continua o mesmo.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {areasBeleza.map((a) => (
              <button
                key={a.id}
                onClick={() => definirArea(a.id)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  area === a.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {tipo === "barbearia" && (
        <Card className="mt-12 gap-3 p-6">
          <p className="text-eyebrow">Etapa 2</p>
          <h2 className="text-2xl">Sua barbearia já vem preparada para</h2>
          <div className="flex flex-wrap gap-2">
            {[
              "Vários barbeiros",
              "Agenda individual",
              "Qualquer profissional disponível",
              "Fila de atendimento",
              "Encaixes",
              "Combos",
              "Assinaturas mensais",
              "Fidelidade",
              "Comissão por barbeiro",
              "Venda de produtos",
              "Desempenho por barbeiro",
            ].map((r) => (
              <Badge key={r} variant="outline" className="rounded-full font-normal">
                {r}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="rounded-full px-8"
          disabled={tipo === "beleza" && !escolhido}
          onClick={finalizar}
        >
          Criar meu painel <ArrowRight className="h-4 w-4" />
        </Button>
        <Button asChild variant="outline" size="lg" className="rounded-full px-8">
          <Link to="/">Ver modelo de página pública</Link>
        </Button>
      </div>

      {tipo === "beleza" && !escolhido && (
        <p className="mt-3 text-sm text-muted-foreground">
          Selecione a sua principal área de atuação para continuar.
        </p>
      )}
    </div>
  );
}

function Opcao({
  ativo,
  onClick,
  icone: Icone,
  titulo,
  texto,
  exemplo,
}: {
  id: TipoNegocio;
  ativo: boolean;
  onClick: () => void;
  icone: typeof Sparkles;
  titulo: string;
  texto: string;
  exemplo: string;
}) {
  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer gap-3 p-6 transition-shadow hover:shadow-md ${
        ativo ? "ring-2 ring-ring" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <Icone className="h-5 w-5 text-primary" />
        {ativo && <Check className="h-4 w-4 text-primary" />}
      </div>
      <h2 className="text-2xl">{titulo}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{texto}</p>
      <p className="text-eyebrow">{exemplo}</p>
    </Card>
  );
}
