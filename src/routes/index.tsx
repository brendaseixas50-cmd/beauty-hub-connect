import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock,
  Instagram,
  MapPin,
  MessageCircle,
  Star,
  CreditCard,
  Home,
  Store,
  LayoutDashboard,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { brl } from "@/data/demo";
import { useDemo, useNegocio } from "@/data/negocio";
import { linkInstagram, linkWhatsapp } from "@/lib/contato";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agendamento online — Lu IA Studio" },
      {
        name: "description",
        content:
          "Página pública da profissional: serviços, preços, portfólio e agendamento online em poucos passos.",
      },
      { property: "og:title", content: "Agendamento online — Lu IA Studio" },
      {
        property: "og:description",
        content: "Serviços, preços e agendamento online no espaço ou em domicílio.",
      },
    ],
  }),
  component: PaginaPublica,
});

function PaginaPublica() {
  const { estudio, servicos, categorias, galeria, avaliacoes } = useDemo();
  const { marca } = useNegocio();

  const [categoria, setCategoria] = useState<string>("Todos");

  const mostraDomicilio =
    estudio.formatoAtendimento === "domicilio" ||
    (estudio.formatoAtendimento === "ambos" && estudio.domicilioAtivo);
  const mostraLocal = estudio.formatoAtendimento !== "domicilio";

  const lista =
    categoria === "Todos" ? servicos : servicos.filter((s) => s.categoria === categoria);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="relative">
        <img
          src={estudio.banner}
          alt={`Ambiente do ${estudio.nome}`}
          width={1600}
          height={900}
          className="h-56 w-full object-cover sm:h-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <Link
          to="/painel"
          className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full bg-card/85 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur"
        >
          <LayoutDashboard className="h-3.5 w-3.5" /> Painel
        </Link>
      </header>

      <main className="mx-auto -mt-16 max-w-3xl px-5">
        <section className="text-center">
          <img
            src={estudio.fotoPerfil}
            alt={estudio.profissional}
            width={800}
            height={800}
            className="mx-auto h-28 w-28 rounded-full border-4 border-background object-cover shadow-lg"
          />
          <p className="mt-5 text-eyebrow">{estudio.especialidade}</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">{estudio.nome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">com {estudio.profissional}</p>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            {estudio.descricao}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {mostraLocal && (
              <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 font-normal">
                <Store className="h-3.5 w-3.5" /> No espaço
              </Badge>
            )}
            {mostraDomicilio && (
              <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 font-normal">
                <Home className="h-3.5 w-3.5" /> Em domicílio
              </Badge>
            )}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="rounded-full px-8">
              <Link to="/agendar">Agendar horário</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-8">
              <a
                href={linkWhatsapp(estudio.whatsapp, estudio.nome)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
              </a>
            </Button>
          </div>
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-2">
          <InfoLinha icon={MapPin} titulo="Endereço" texto={estudio.endereco} />
          <InfoLinha icon={Home} titulo="Região atendida" texto={estudio.regiao} />
          <InfoLinha
            icon={Instagram}
            titulo="Instagram"
            texto={estudio.instagram}
            href={linkInstagram(estudio.instagram)}
          />
          <InfoLinha
            icon={MessageCircle}
            titulo="WhatsApp"
            texto={estudio.whatsapp}
            href={linkWhatsapp(estudio.whatsapp, estudio.nome)}
          />
        </section>

        <Secao titulo="Horários de funcionamento" eyebrow="Atendimento">
          <Card className="divide-y p-0">
            {estudio.horarios.map((h) => (
              <div key={h.dia} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-muted-foreground">{h.dia}</span>
                <span className={h.horario === "Fechado" ? "text-muted-foreground" : "font-medium"}>
                  {h.horario}
                </span>
              </div>
            ))}
          </Card>
        </Secao>

        <Secao titulo="Serviços" eyebrow="Cardápio">
          <div className="mb-4 flex flex-wrap gap-2">
            {["Todos", ...categorias].map((c) => (
              <button
                key={c}
                onClick={() => setCategoria(c)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  categoria === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid gap-3">
            {lista.map((s) => (
              <Link key={s.id} to="/servico/$id" params={{ id: s.id }}>
                <Card className="flex flex-row items-center gap-4 p-4 transition-shadow hover:shadow-md">
                  <img
                    src={s.fotos[0]}
                    alt={s.nome}
                    loading="lazy"
                    width={800}
                    height={800}
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-eyebrow">{s.categoria}</p>
                    <h3 className="truncate text-lg leading-snug">{s.nome}</h3>
                    <p className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {s.duracao}
                      </span>
                      <span className="font-medium text-foreground">{brl(s.precoLocal)}</span>
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </Secao>

        <Secao titulo="Galeria de trabalhos" eyebrow="Portfólio">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {galeria.map((foto, i) => (
              <img
                key={i}
                src={foto}
                alt={`Trabalho realizado ${i + 1}`}
                loading="lazy"
                width={800}
                height={800}
                className="aspect-square w-full rounded-xl object-cover"
              />
            ))}
          </div>
        </Secao>

        <Secao titulo="Avaliações de clientes" eyebrow="Depoimentos">
          <div className="grid gap-3">
            {avaliacoes.map((a) => (
              <Card key={a.nome} className="gap-2 p-5">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{a.nome}</p>
                  <span className="text-xs text-muted-foreground">{a.data}</span>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${i < a.nota ? "fill-gold text-gold" : "text-border"}`}
                    />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{a.texto}</p>
              </Card>
            ))}
          </div>
        </Secao>

        <Secao titulo="Políticas de atendimento" eyebrow="Combinados">
          <Card className="p-2">
            <Accordion type="single" collapsible>
              {estudio.politicas.map((p) => (
                <AccordionItem key={p.titulo} value={p.titulo} className="px-3 last:border-b-0">
                  <AccordionTrigger className="text-base">{p.titulo}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{p.texto}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </Secao>

        <Secao titulo="Formas de pagamento" eyebrow="Pagamento">
          <div className="flex flex-wrap gap-2">
            {estudio.pagamentos.map((p) => (
              <Badge key={p} variant="outline" className="gap-1.5 rounded-full px-3 py-1.5">
                <CreditCard className="h-3.5 w-3.5" /> {p}
              </Badge>
            ))}
          </div>
        </Secao>

        {mostraDomicilio && (
          <Card className="surface-soft mt-10 gap-2 p-6">
            <p className="text-eyebrow">Atendimento em domicílio</p>
            <h3 className="text-2xl">Vou até você</h3>
            <p className="text-sm text-muted-foreground">{estudio.observacoesDomicilio}</p>
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Regiões: </span>
              {estudio.regioesDomicilio}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Dias: </span>
              {estudio.diasDomicilio.join(", ")}
            </p>
          </Card>
        )}

        <footer className="mt-14 border-t pt-6 text-center text-xs text-muted-foreground">
          {estudio.nome} · Página criada com {marca.nome} por Lu IA Studio
        </footer>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button asChild className="flex-1 rounded-full">
            <Link to="/agendar">Agendar horário</Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="rounded-full">
            <a
              href={linkWhatsapp(estudio.whatsapp, estudio.nome)}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoLinha({
  icon: Icon,
  titulo,
  texto,
  href,
}: {
  icon: typeof MapPin;
  titulo: string;
  texto: string;
  href?: string;
}) {
  const conteudo = (
    <Card className="flex h-full flex-row items-start gap-3 p-4 transition-shadow hover:shadow-md">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-eyebrow">{titulo}</p>
        <p className="text-sm">{texto}</p>
      </div>
    </Card>
  );

  if (!href) return conteudo;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="block">
      {conteudo}
    </a>
  );
}

function Secao({
  titulo,
  eyebrow,
  children,
}: {
  titulo: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <p className="text-eyebrow">{eyebrow}</p>
      <h2 className="mb-4 mt-1 text-3xl">{titulo}</h2>
      {children}
    </section>
  );
}
