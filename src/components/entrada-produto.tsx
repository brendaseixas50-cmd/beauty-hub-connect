import { ArrowLeft, ArrowRight, Check, Scissors, Sparkles } from "lucide-react";
import { useState } from "react";
import bannerBeauty from "@/assets/banner.jpg";
import bannerBarber from "@/assets/barbearia-banner.jpg";
import { Button } from "@/components/ui/button";
import { useNegocio } from "@/data/negocio";
import { marcasProduto, type TipoNegocio } from "@/products/catalog";

const imagens: Record<TipoNegocio, string> = {
  beleza: bannerBeauty,
  barbearia: bannerBarber,
};

export function EntradaProduto() {
  const [etapa, setEtapa] = useState<"escolha" | "splash">("escolha");
  const { tipo, marca, definirTipo, concluir } = useNegocio();

  function escolher(produto: TipoNegocio) {
    definirTipo(produto);
    setEtapa("splash");
  }

  if (etapa === "splash") {
    const Icone = tipo === "barbearia" ? Scissors : Sparkles;

    return (
      <main className="relative isolate flex min-h-screen items-center overflow-hidden px-5 py-12">
        <img
          src={imagens[tipo]}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/95 to-background/35" />

        <div className="mx-auto w-full max-w-6xl">
          <button
            type="button"
            onClick={() => setEtapa("escolha")}
            className="mb-12 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar aos produtos
          </button>

          <section className="max-w-2xl" aria-labelledby="splash-title">
            <div className="mb-7 inline-flex items-center gap-3">
              <span className="product-mark grid h-12 w-12 place-items-center rounded-full">
                <Icone className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="product-wordmark text-3xl leading-none">{marca.nome}</p>
                <p className="mt-1 text-eyebrow">{marca.selo}</p>
              </div>
            </div>

            <p className="text-eyebrow">Uma experiência Lu IA Studio</p>
            <h1 id="splash-title" className="mt-3 text-5xl leading-[0.95] sm:text-7xl">
              {marca.destaque}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {marca.assinatura} {marca.descricao}
            </p>

            <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
              {marca.recursos.map((recurso) => (
                <li key={recurso} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                  {recurso}
                </li>
              ))}
            </ul>

            <Button size="lg" className="mt-10 rounded-full px-8" onClick={concluir}>
              Conhecer {marca.nome} <ArrowRight className="h-4 w-4" />
            </Button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-eyebrow">Lu IA Studio apresenta</p>
          <h1 className="mt-3 text-4xl sm:text-6xl">Escolha a experiência do seu negócio</h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Dois produtos com identidade, linguagem e recursos pensados para rotinas diferentes.
          </p>
        </header>

        <section className="mt-10 grid gap-5 lg:grid-cols-2" aria-label="Produtos disponíveis">
          <CartaoProduto tipo="beleza" onChoose={escolher} />
          <CartaoProduto tipo="barbearia" onChoose={escolher} />
        </section>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
          Nesta demonstração, a escolha define apenas a experiência visual. O acesso definitivo a
          cada produto será validado pela conta e pelas permissões no servidor.
        </p>
      </div>
    </main>
  );
}

function CartaoProduto({
  tipo,
  onChoose,
}: {
  tipo: TipoNegocio;
  onChoose: (tipo: TipoNegocio) => void;
}) {
  const marca = marcasProduto[tipo];
  const Icone = tipo === "barbearia" ? Scissors : Sparkles;

  return (
    <button
      type="button"
      onClick={() => onChoose(tipo)}
      className={`${tipo === "barbearia" ? "tema-barbearia" : "tema-beleza"} group relative isolate min-h-[31rem] overflow-hidden rounded-3xl border border-border bg-background p-7 text-left text-foreground shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-10`}
      aria-label={`Escolher ${marca.nome}`}
    >
      <img
        src={imagens[tipo]}
        alt=""
        className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-700 group-hover:scale-105"
        aria-hidden="true"
      />
      <span className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/90 to-background/20" />

      <span className="flex h-full flex-col justify-end">
        <span className="product-mark mb-auto grid h-11 w-11 place-items-center rounded-full">
          <Icone className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="text-eyebrow">{marca.estilo}</span>
        <span className="product-wordmark mt-3 block text-4xl sm:text-5xl">{marca.nome}</span>
        <span className="mt-3 block max-w-md text-base leading-relaxed text-muted-foreground">
          {marca.descricao}
        </span>
        <span className="mt-7 inline-flex items-center gap-2 font-medium text-primary">
          Entrar na experiência <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}
