import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Check, LogIn, Users, Wallet } from "lucide-react";

import logoBeauty from "@/assets/brand/lubeauty-app-icon.webp";
import logoBarber from "@/assets/brand/lubarber-logo-round.webp";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { marcasProduto, type TipoNegocio } from "@/products/catalog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LuBeauty Pro e LuBarber Pro — gestão para seu negócio" },
      {
        name: "description",
        content:
          "Agenda, clientes, serviços, estoque e financeiro para profissionais de beleza e barbearias.",
      },
    ],
  }),
  component: Home,
});

const images: Record<TipoNegocio, string> = {
  beleza: logoBeauty,
  barbearia: logoBarber,
};

const features = [
  {
    icon: CalendarDays,
    title: "Agenda completa",
    description: "Agendamentos por profissional com proteção contra conflitos.",
  },
  {
    icon: Users,
    title: "Clientes e equipe",
    description: "Cadastros, histórico operacional e isolamento por empresa.",
  },
  {
    icon: Wallet,
    title: "Financeiro e estoque",
    description: "Entradas, despesas, produtos e movimentações reais.",
  },
];

function Home() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card/80 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="font-display text-xl">Lu IA Studio</p>
            <p className="text-xs text-muted-foreground">Soluções para profissionais</p>
          </div>
        </div>
      </header>

      <section className="px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-eyebrow">Gestão simples e profissional</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl leading-tight sm:text-6xl">
            Escolha a plataforma certa para o seu negócio
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Já possui ou vai criar uma conta? Entre diretamente na plataforma do seu segmento.
          </p>

          <div className="mt-10 grid gap-6 text-left lg:grid-cols-2">
            <ProductCard type="beleza" />
            <ProductCard type="barbearia" />
          </div>
        </div>
      </section>

      <section className="border-y bg-secondary/35 px-5 py-14">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="p-6">
              <feature.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-3 text-xl">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="px-5 py-8 text-center text-sm text-muted-foreground">
        Desenvolvido por <strong className="font-semibold text-foreground">Lu IA Studio</strong> · ©{" "}
        {new Date().getFullYear()}
      </footer>
    </main>
  );
}

function ProductCard({ type }: { type: TipoNegocio }) {
  const brand = marcasProduto[type];
  const productType = type === "barbearia" ? "barber" : "beauty";
  const theme = type === "barbearia" ? "tema-barbearia" : "tema-beleza";

  return (
    <article
      className={`${theme} overflow-hidden rounded-[20px] border border-border bg-background text-foreground shadow-xl`}
    >
      <div className="product-card-visual" aria-label={`Logo ${brand.nome} Pro`}>
        <img
          src={images[type]}
          alt={`Identidade oficial ${brand.nome} Pro`}
          width={1024}
          height={1024}
          loading={type === "barbearia" ? "lazy" : "eager"}
          decoding="async"
        />
      </div>
      <div className="p-7 sm:p-10">
        <p className="text-eyebrow">{brand.estilo}</p>
        <h2 className="product-wordmark mt-3 text-3xl sm:text-4xl">{brand.nome} Pro</h2>
        <p className="product-slogan mt-2 font-semibold">{brand.assinatura}</p>
        <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">{brand.descricao}</p>
        <ul className="mt-6 grid gap-2 text-sm">
          {brand.recursos.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" /> {feature}
            </li>
          ))}
        </ul>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Button asChild size="lg" variant="outline" className="min-w-0 px-3 sm:px-5">
            <Link to="/login" search={{ redirect: "/painel", produto: productType }}>
              <LogIn /> <span className="truncate">Entrar no painel</span>
            </Link>
          </Button>
          <Button asChild size="lg" className="min-w-0 px-3 sm:px-5">
            <Link to="/cadastro" search={{ produto: productType }}>
              <span className="truncate">Criar conta</span> <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
