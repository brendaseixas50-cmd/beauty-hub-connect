import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Check, Scissors, Sparkles, Users, Wallet } from "lucide-react";

import bannerBeauty from "@/assets/banner.jpg";
import bannerBarber from "@/assets/barbearia-banner.jpg";
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
  beleza: bannerBeauty,
  barbearia: bannerBarber,
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
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/login" search={{ redirect: "/painel", produto: undefined }}>
              Entrar
            </Link>
          </Button>
        </div>
      </header>

      <section className="px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-eyebrow">Gestão simples e profissional</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl leading-tight sm:text-6xl">
            Escolha a plataforma certa para o seu negócio
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Crie sua conta e gerencie empresa, profissionais, clientes, agenda, serviços, produtos,
            estoque e financeiro em um único lugar.
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
        © {new Date().getFullYear()} Lu IA Studio
      </footer>
    </main>
  );
}

function ProductCard({ type }: { type: TipoNegocio }) {
  const brand = marcasProduto[type];
  const productType = type === "barbearia" ? "barber" : "beauty";
  const Icon = type === "barbearia" ? Scissors : Sparkles;
  const theme = type === "barbearia" ? "tema-barbearia" : "tema-beleza";

  return (
    <article
      className={`${theme} relative isolate min-h-[31rem] overflow-hidden rounded-3xl border border-border bg-background p-7 text-foreground shadow-xl sm:p-10`}
    >
      <img
        src={images[type]}
        alt=""
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/95 to-background/25" />
      <div className="flex h-full flex-col justify-end">
        <span className="product-mark mb-auto grid h-12 w-12 place-items-center rounded-full">
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-eyebrow">{brand.estilo}</p>
        <h2 className="product-wordmark mt-3 text-4xl sm:text-5xl">{brand.nome} Pro</h2>
        <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">{brand.descricao}</p>
        <ul className="mt-6 grid gap-2 text-sm">
          {brand.recursos.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" /> {feature}
            </li>
          ))}
        </ul>
        <Button asChild size="lg" className="mt-8 w-full rounded-full sm:w-fit">
          <Link to="/cadastro" search={{ produto: productType }}>
            Criar conta <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
